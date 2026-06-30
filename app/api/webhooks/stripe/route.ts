import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildMagicLinkEmail } from '@/lib/email'
import { generateMagicLink } from '@/lib/auth/magic-link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TierKey = 'solo' | 'procurement_ready' | 'adviser'

const TIER_DISPLAY: Record<TierKey, string> = {
  solo: 'Solo Pack',
  procurement_ready: 'Procurement-Ready Pack',
  adviser: 'Adviser Pack',
}

// DB constraint allows ('solo', 'team', 'adviser') only. Map marketing name → DB value.
const TIER_DB_VALUE: Record<TierKey, 'solo' | 'procurement_ready' | 'adviser'> = {
  solo: 'solo',
  procurement_ready: 'procurement_ready',
  adviser: 'adviser',
}

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

function isTier(value: unknown): value is TierKey {
  return value === 'solo' || value === 'procurement_ready' || value === 'adviser'
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
    throw new Error(`Failed to look up user: ${lookupError.message}`)
  }
  if (existing) {
    return existing.id
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Failed to create auth user: ${createError?.message ?? 'unknown error'}`)
  }
  return created.user.id
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

  if (!email) {
    console.error(`[webhook] session ${stripeSessionId} missing customer email`)
    return
  }
  if (!isTier(planRaw)) {
    console.error(`[webhook] session ${stripeSessionId} has invalid plan_selected metadata: ${planRaw}`)
    return
  }
  const plan: TierKey = planRaw

  // Idempotency check
  const { data: existingOrder, error: orderLookupError } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle()

  if (orderLookupError) {
    throw new Error(`Order lookup failed: ${orderLookupError.message}`)
  }
  if (existingOrder && existingOrder.payment_status === 'paid') {
    console.log(`[webhook] order already processed for session ${stripeSessionId}; skipping`)
    return
  }

  const userId = await findOrCreateAuthUser(email)

  // Trigger on auth.users normally creates the public.users row; upsert protects against race.
  // Store the normalised (lower-cased) email so the findOrCreateAuthUser lookup
  // above matches reliably regardless of how the customer typed it at checkout.
  const { error: userUpsertError } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, email: email.toLowerCase() }, { onConflict: 'id' })
  if (userUpsertError) {
    throw new Error(`User upsert failed: ${userUpsertError.message}`)
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
    throw new Error(`Organisation insert failed: ${orgError?.message ?? 'unknown'}`)
  }

  const { error: memberError } = await supabaseAdmin.from('organisation_members').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  })
  if (memberError) {
    throw new Error(`Organisation member insert failed: ${memberError.message}`)
  }

  const { data: order, error: orderInsertError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId,
      billing_org_id: org.id,
      client_org_id: org.id,
      stripe_session_id: stripeSessionId,
      stripe_payment_id: stripePaymentId,
      plan_selected: TIER_DB_VALUE[plan],
      amount_pence: amountPence,
      payment_status: 'paid',
      delivery_status: 'pending',
    })
    .select('id')
    .single()
  if (orderInsertError || !order) {
    throw new Error(`Order insert failed: ${orderInsertError?.message ?? 'unknown'}`)
  }

  // Persist a stable, customer-facing order reference so it can be quoted in
  // support queries and shown consistently across the confirmation page and emails.
  const displayRef = `RP-${stripeSessionId.slice(-8).toUpperCase()}`
  const { error: displayRefError } = await supabaseAdmin
    .from('orders')
    .update({ display_reference: displayRef })
    .eq('id', order.id)
  if (displayRefError) {
    console.error(`[webhook] failed to set display_reference for order ${order.id}: ${displayRefError.message}`)
  }

  const { error: submissionError } = await supabaseAdmin.from('intake_submissions').insert({
    user_id: userId,
    order_id: order.id,
    org_id: org.id,
    completion_status: 'not_started',
  })
  if (submissionError) {
    throw new Error(`Intake submission insert failed: ${submissionError.message}`)
  }

  const magicLink = await generateMagicLink(email, '/start')

  const sendResult = await resend.emails.send({
    from: FROM_ADDRESS,
    replyTo: 'hello@readypack.co.uk',
    to: [email],
    subject: 'Your ReadyPack intake questionnaire is ready',
    html: buildMagicLinkEmail({ magicLink, planName: TIER_DISPLAY[plan], packReference: displayRef }),
  })
  if (sendResult.error) {
    throw new Error(`Resend send failed: ${sendResult.error.message}`)
  }

  // Log IDs only — no customer email/PII in function logs (accessible to anyone
  // with Vercel project access / log integrations).
  console.log(
    `[webhook] processed session ${stripeSessionId}: user ${userId}, order ${order.id}, delivery email sent`,
  )
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
    // Log but return 200 so Stripe doesn't retry and re-create duplicate side effects.
    // Errors here typically mean partial state in the DB; we recover manually for MVP.
    console.error(`[webhook] handler error for event ${event.id} (${event.type}):`, err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
