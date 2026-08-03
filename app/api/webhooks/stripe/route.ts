import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildMagicLinkEmail } from '@/lib/email'
import { generateMagicLink } from '@/lib/auth/magic-link'
import {
  WebhookStepError,
  isUniqueViolation,
  permanentFailure,
  shouldRetry,
} from '@/lib/webhooks/retry-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TierKey = 'solo' | 'procurement_ready' | 'adviser'

const TIER_DISPLAY: Record<TierKey, string> = {
  solo: 'Solo Pack',
  procurement_ready: 'Procurement-Ready Pack',
  adviser: 'Adviser Pack',
}

// TierKey doubles as the stored value: orders_plan_selected_check on the live
// database allows exactly ('solo', 'procurement_ready', 'adviser'), so the
// checkout metadata goes straight into the column with no translation.
const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

function isTier(value: unknown): value is TierKey {
  return value === 'solo' || value === 'procurement_ready' || value === 'adviser'
}

type ProvisionedOrder = {
  id: string
  paymentStatus: string
  welcomeEmailSentAt: string | null
}

async function findOrCreateAuthUser(email: string): Promise<string> {
  // Direct indexed lookup on public.users (populated for every customer via the
  // auth trigger + the upsert below). This is O(1) and — unlike the previous
  // listUsers() with no perPage (default 50) — cannot silently miss an existing
  // user past a page boundary and create a duplicate account + orphan order.
  const normalized = email.toLowerCase()
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle()
  if (lookupError) {
    throw new WebhookStepError('user lookup', lookupError)
  }
  if (existing) {
    return existing.id
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new WebhookStepError('auth user create', createError)
  }
  return created.user.id
}

/** Read the order for this Checkout session, if we already made one. */
async function findOrderBySession(stripeSessionId: string): Promise<ProvisionedOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, welcome_email_sent_at')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle()
  if (error) {
    throw new WebhookStepError('order lookup', error)
  }
  if (!data) return null
  return {
    id: data.id as string,
    paymentStatus: data.payment_status as string,
    welcomeEmailSentAt: (data.welcome_email_sent_at as string | null) ?? null,
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    console.log(`[webhook] session ${session.id} payment_status=${session.payment_status}; skipping`)
    return
  }

  const email = session.customer_details?.email
  const planRaw = session.metadata?.plan_selected
  const amountPence = session.amount_total ?? 0
  const stripeSessionId = session.id
  const stripePaymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  // These two can never succeed on redelivery — Stripe would send identical bytes.
  if (!email) {
    throw permanentFailure(`session ${stripeSessionId} has no customer email`)
  }
  if (!isTier(planRaw)) {
    throw permanentFailure(
      `session ${stripeSessionId} has invalid plan_selected metadata: ${planRaw}`,
    )
  }
  const plan: TierKey = planRaw

  // Stable, customer-facing reference. Derived from the session id, so a retry
  // computes the same value rather than minting a second one.
  const displayRef = `RP-${stripeSessionId.slice(-8).toUpperCase()}`

  // Provisioning is RESUMABLE, not skippable. A redelivered event picks up at the
  // first step that has not completed instead of returning early — otherwise a
  // retry after a failed email would find the order present, skip, and leave a
  // paying customer with no way in. See migration 012.
  const existing = await findOrderBySession(stripeSessionId)
  if (existing && existing.paymentStatus !== 'paid') {
    console.warn(
      `[webhook] order ${existing.id} for session ${stripeSessionId} is ${existing.paymentStatus}; not sending an access email`,
    )
    return
  }

  const order =
    existing ??
    (await provisionOrder({
      email,
      plan,
      amountPence,
      stripeSessionId,
      stripePaymentId,
      displayRef,
    }))

  if (order.welcomeEmailSentAt) {
    console.log(
      `[webhook] order ${order.id} was already emailed at ${order.welcomeEmailSentAt}; nothing to do`,
    )
    return
  }

  await sendAccessEmail({ orderId: order.id, email, plan, displayRef })

  // Log IDs only — no customer email/PII in function logs (accessible to anyone
  // with Vercel project access / log integrations).
  console.log(`[webhook] processed session ${stripeSessionId}: order ${order.id}, access email sent`)
}

/**
 * Create the user, org, order and intake row for a newly paid session.
 *
 * Not wrapped in a transaction: if this fails partway it can leave an unused
 * `organisations` row behind. That is cosmetic clutter, invisible to customers,
 * and cheaper to live with than a stored-procedure rewrite of a working path.
 * The money-critical guarantees — never two orders, never a lost order — come
 * from the unique index and the retry, not from atomicity here.
 */
async function provisionOrder(args: {
  email: string
  plan: TierKey
  amountPence: number
  stripeSessionId: string
  stripePaymentId: string | null
  displayRef: string
}): Promise<ProvisionedOrder> {
  const userId = await findOrCreateAuthUser(args.email)

  // Trigger on auth.users normally creates the public.users row; upsert protects against race.
  // Store the normalised (lower-cased) email so the findOrCreateAuthUser lookup
  // above matches reliably regardless of how the customer typed it at checkout.
  const { error: userUpsertError } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, email: args.email.toLowerCase() }, { onConflict: 'id' })
  if (userUpsertError) {
    throw new WebhookStepError('user upsert', userUpsertError)
  }

  // Create org for direct buyer (placeholder name — refined in intake)
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .insert({
      name: `Customer ${userId.slice(0, 8)}`,
      type: 'direct',
    })
    .select('id')
    .single()
  if (orgError || !org) {
    throw new WebhookStepError('organisation insert', orgError)
  }

  const { error: memberError } = await supabaseAdmin.from('organisation_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  })
  if (memberError) {
    throw new WebhookStepError('organisation member insert', memberError)
  }

  const { data: order, error: orderInsertError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId,
      billing_org_id: org.id,
      client_org_id: org.id,
      stripe_session_id: args.stripeSessionId,
      stripe_payment_id: args.stripePaymentId,
      plan_selected: args.plan,
      amount_pence: args.amountPence,
      payment_status: 'paid',
      delivery_status: 'pending',
      display_reference: args.displayRef,
    })
    .select('id')
    .single()

  if (orderInsertError) {
    // A concurrent delivery of the same event got there first. The unique index on
    // stripe_session_id is what turns that from a duplicate order into a race we
    // can safely lose: adopt the winner and carry on to the email step.
    if (isUniqueViolation(orderInsertError)) {
      const winner = await findOrderBySession(args.stripeSessionId)
      if (winner) {
        console.log(
          `[webhook] session ${args.stripeSessionId} was provisioned concurrently as order ${winner.id}`,
        )
        return winner
      }
    }
    throw new WebhookStepError('order insert', orderInsertError)
  }
  if (!order) {
    throw new WebhookStepError('order insert', { message: 'insert returned no row' })
  }

  const { error: submissionError } = await supabaseAdmin.from('intake_submissions').insert({
    user_id: userId,
    order_id: order.id,
    org_id: org.id,
    completion_status: 'not_started',
  })
  if (submissionError) {
    throw new WebhookStepError('intake submission insert', submissionError)
  }

  return { id: order.id as string, paymentStatus: 'paid', welcomeEmailSentAt: null }
}

/** Send the magic link that is the customer's only way into what they just paid for. */
async function sendAccessEmail(args: {
  orderId: string
  email: string
  plan: TierKey
  displayRef: string
}): Promise<void> {
  const magicLink = await generateMagicLink(args.email, '/start')

  const sendResult = await resend.emails.send({
    from: FROM_ADDRESS,
    replyTo: 'hello@readypack.co.uk',
    to: [args.email],
    subject: 'Your ReadyPack intake questionnaire is ready',
    html: buildMagicLinkEmail({
      magicLink,
      planName: TIER_DISPLAY[args.plan],
      packReference: args.displayRef,
    }),
  })
  if (sendResult.error) {
    // Transient by default: a Resend outage, or the free tier's 100/day cap
    // answering 429. Bubbles up as a 500 so Stripe redelivers and we try again.
    throw new WebhookStepError('access email send', sendResult.error)
  }

  const { error: markError } = await supabaseAdmin
    .from('orders')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', args.orderId)
  if (markError) {
    // The customer HAS their link. Retrying would only send a duplicate, so this
    // must not fail the event — but the marker is now wrong, so say so loudly.
    console.error(
      `[webhook] order ${args.orderId} was emailed but welcome_email_sent_at did not save: ${markError.message}`,
    )
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'signature verification error'
    console.error('[webhook] signature verification failed:', message)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }
      default:
        // Acknowledge — we don't process other event types yet.
        break
    }
  } catch (err) {
    const retry = shouldRetry(err)
    console.error(
      `[webhook] handler error for event ${event.id} (${event.type}) — ${
        retry ? 'transient, returning 500 so Stripe retries' : 'permanent, returning 200'
      }:`,
      err,
    )
    if (retry) {
      // A 500 makes Stripe redeliver with backoff for roughly three days. That is
      // safe because provisioning is idempotent (unique index on
      // orders.stripe_session_id) and resumable (orders.welcome_email_sent_at).
      // This route used to return 200 here, which meant a transient database blip
      // silently swallowed a PAID order and Stripe never told us.
      return NextResponse.json({ error: 'Temporary failure; please retry' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
