// app/api/admin/cases/[id]/send-delivery/route.ts
//
// Admin-triggered customer delivery email.
//
// Flow:
//   1. Require admin auth.
//   2. Load the case (order + customer + documents).
//   3. Guard: the case must have at least some generated documents and
//      cannot be in a payment_status of refunded / failed.
//   4. Generate a Supabase magic link that redirects through the auth
//      callback into /portal/[orderId].
//   5. Send the magic-link email via Resend.
//   6. Transition orders.delivery_status -> 'qa_review' (customer review).
//   7. Log a customer_communications row + audit_events row.
//
// Idempotent enough to resend: the magic link is regenerated each call
// and the order's delivery_status is only forward-advanced (won't clobber
// an already-approved order).

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildDeliveryEmail } from '@/lib/email'
import { openHighRiskFlagCount } from '@/lib/risk/gate'
import { revalidatePath } from 'next/cache'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function packReferenceForOrder(orderId: string): string {
  // Stable, customer-friendly pack ref. Top 8 chars of the order id are
  // unique enough to disambiguate cases for support without leaking
  // the full UUID.
  return `RP-${orderId.slice(0, 8).toUpperCase()}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id: caseId } = await params

    if (!UUID_REGEX.test(caseId)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 })
    }

    // ── 1. Load order + user ───────────────────────────────────────
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, payment_status, delivery_status, plan_selected, display_reference')
      .eq('id', caseId)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }
    if (order.payment_status === 'refunded' || order.payment_status === 'failed') {
      return NextResponse.json(
        { error: `Cannot send delivery: payment status is ${order.payment_status}` },
        { status: 409 },
      )
    }
    // Customer-approves model: the admin RELEASES the watermarked drafts for the
    // customer to review (which the customer then approves to finalise). So a
    // generated pack awaiting review (qa_review / escalated) — or one already
    // approved/delivered (a resend) — is releasable; only a pack that hasn't been
    // generated yet is not. (The doc-count guard below enforces "has documents".)
    const releasableFrom: ReadonlyArray<typeof order.delivery_status> = [
      'pending',
      'generating',
      'qa_review',
      'escalated',
      'approved',
      'delivered',
      'failed',
    ]
    if (!releasableFrom.includes(order.delivery_status)) {
      return NextResponse.json(
        { error: `Cannot send delivery email from status "${order.delivery_status}".` },
        { status: 400 },
      )
    }

    // Resolve the submission once — used by both the flag gate and the doc-count guard.
    // Fail closed: if this read errors we cannot verify the gate, so do NOT release.
    const { data: submissionRow, error: submissionLookupError } = await supabaseAdmin
      .from('intake_submissions')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle()
    if (submissionLookupError) {
      return NextResponse.json(
        { error: `Could not verify the pack before release: ${submissionLookupError.message}` },
        { status: 500 },
      )
    }
    const submissionId = submissionRow?.id ?? null

    // ── Flag gate ──────────────────────────────────────────────────
    // Don't release a high-risk pack for customer review until a human has signed
    // off its high flags (accept-with-justification or remediate). This is the
    // runbook's step order: sign off, THEN release for review. A resend of an
    // already-approved/delivered pack is exempt — the sign-off already happened and
    // this is just re-emailing the portal link.
    if (
      submissionId &&
      order.delivery_status !== 'approved' &&
      order.delivery_status !== 'delivered'
    ) {
      const blockingFlags = await openHighRiskFlagCount(submissionId)
      if (blockingFlags > 0) {
        return NextResponse.json(
          {
            error: `Cannot release: ${blockingFlags} high-risk flag(s) still need sign-off before this pack can go to the customer.`,
          },
          { status: 409 },
        )
      }
    }

    const { data: customer, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, company_name, trading_name')
      .eq('id', order.user_id)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }
    if (!customer?.email) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 409 })
    }

    // ── 2. Guard: at least 1 document rendered ─────────────────────
    const { count: docCount, error: docCountError } = await supabaseAdmin
      .from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submissionId ?? '00000000-0000-0000-0000-000000000000')

    if (docCountError) {
      return NextResponse.json({ error: docCountError.message }, { status: 500 })
    }
    if (!docCount || docCount < 1) {
      return NextResponse.json(
        { error: 'No documents have been generated for this case yet.' },
        { status: 409 },
      )
    }

    // ── 3. Generate magic link ─────────────────────────────────────
    const portalPath = `/portal/${order.id}`
    let magicLink: string
    try {
      magicLink = await generateMagicLink(customer.email, portalPath)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Magic link generation failed' },
        { status: 500 },
      )
    }

    // ── 4. Send email ──────────────────────────────────────────────
    const displayName = customer.trading_name || customer.company_name || null
    // Prefer the stored, customer-facing reference so it matches the confirmation
    // page and the magic-link email; fall back to the order-id-derived value.
    const packRef = order.display_reference ?? packReferenceForOrder(order.id)

    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      replyTo: 'hello@readypack.co.uk',
      to: [customer.email],
      subject: 'Your ReadyPack compliance documents are ready for review',
      html: buildDeliveryEmail({
        magicLink,
        customerName: displayName,
        packReference: packRef,
        documentCount: docCount,
      }),
    })

    if (sendResult.error) {
      return NextResponse.json(
        { error: `Email send failed: ${sendResult.error.message}` },
        { status: 502 },
      )
    }

    // ── 5. Record comms + transition order ─────────────────────────
    const nowIso = new Date().toISOString()

    await supabaseAdmin.from('customer_communications').insert({
      order_id: order.id,
      email_type: 'delivery',
      sent_at: nowIso,
      resend_id: sendResult.data?.id ?? null,
      delivery_status: 'sent',
    })

    // Only advance the delivery state forward — never clobber a more
    // progressed state.
    const advanceableFrom: ReadonlyArray<typeof order.delivery_status> = [
      'pending',
      'generating',
      'qa_review',
      'escalated',
      'failed',
    ]
    if (advanceableFrom.includes(order.delivery_status)) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ delivery_status: 'qa_review', updated_at: nowIso })
        .eq('id', order.id)
      if (updateError) {
        return NextResponse.json(
          { error: `Order status update failed: ${updateError.message}` },
          { status: 500 },
        )
      }
    }

    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: admin.id,
      action_type: 'delivery_resend',
      target_type: 'order',
      target_id: order.id,
      metadata: {
        email: customer.email,
        resend_id: sendResult.data?.id ?? null,
        pack_ref: packRef,
        document_count: docCount,
      },
    })

    revalidatePath('/admin')
    revalidatePath(`/admin/cases/${order.id}`)

    return NextResponse.json({
      success: true,
      pack_reference: packRef,
      resend_id: sendResult.data?.id ?? null,
      delivery_status: 'qa_review',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
