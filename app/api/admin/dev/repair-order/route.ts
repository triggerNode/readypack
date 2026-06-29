// app/api/admin/dev/repair-order/route.ts
// Admin-only recovery tool. When something fails mid-pipeline (webhook created
// an order but the email bounced, generation died partway, etc.) this endpoint
// lets the operator re-drive the affected step without hand-editing the DB.
//
// POST body: { order_id: string, action: 'resend_magic_link' | 'resend_delivery_email' | 'retrigger_generation' }

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { devToolsBlocked } from '@/lib/dev-guard'
import { INTERNAL_SECRET_HEADER, getInternalSecret } from '@/lib/auth/internal-secret'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildMagicLinkEmail, buildDeliveryEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  solo: 'Solo Pack',
  procurement_ready: 'Procurement-Ready Pack',
  adviser: 'Adviser Pack',
}

type RepairAction = 'resend_magic_link' | 'resend_delivery_email' | 'retrigger_generation'

const VALID_ACTIONS: ReadonlyArray<RepairAction> = [
  'resend_magic_link',
  'resend_delivery_email',
  'retrigger_generation',
]

function isRepairAction(value: unknown): value is RepairAction {
  return typeof value === 'string' && (VALID_ACTIONS as readonly string[]).includes(value)
}

export async function POST(request: NextRequest) {
  const blocked = devToolsBlocked()
  if (blocked) return blocked

  const admin = await requireAdmin()

  const body = (await request.json().catch(() => ({}))) as {
    order_id?: string
    action?: unknown
  }
  const orderId = body.order_id
  const action = body.action

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }
  if (!isRepairAction(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, plan_selected, display_reference')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: customer } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name, trading_name')
    .eq('id', order.user_id)
    .maybeSingle()
  if (!customer?.email) {
    return NextResponse.json({ error: 'Customer email not found' }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const planName = PLAN_DISPLAY_NAMES[order.plan_selected ?? ''] ?? 'ReadyPack Pack'
  const customerName = customer.trading_name || customer.company_name || null

  async function logAudit(detail: Record<string, unknown>): Promise<void> {
    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: admin.id,
      action_type: 'dev_repair',
      target_type: 'order',
      target_id: order!.id,
      metadata: { action, ...detail },
    })
  }

  try {
    if (action === 'resend_magic_link') {
      let magicLink: string
      try {
        magicLink = await generateMagicLink(customer.email, '/start')
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Magic link generation failed' },
          { status: 500 },
        )
      }
      const sendResult = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [customer.email],
        subject: 'Your ReadyPack intake questionnaire is ready',
        html: buildMagicLinkEmail({
          magicLink,
          planName,
          packReference: order.display_reference,
        }),
      })
      if (sendResult.error) {
        return NextResponse.json({ error: `Email send failed: ${sendResult.error.message}` }, { status: 502 })
      }
      await logAudit({ resend_id: sendResult.data?.id ?? null })
      return NextResponse.json({ ok: true, action, message: 'Magic link email resent.' })
    }

    if (action === 'resend_delivery_email') {
      const { data: submission } = await supabaseAdmin
        .from('intake_submissions')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle()
      let documentCount = 9
      if (submission?.id) {
        const { count } = await supabaseAdmin
          .from('generated_documents')
          .select('id', { count: 'exact', head: true })
          .eq('submission_id', submission.id)
        if (typeof count === 'number' && count > 0) documentCount = count
      }
      let magicLink: string
      try {
        magicLink = await generateMagicLink(customer.email, `/portal/${order.id}`)
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Magic link generation failed' },
          { status: 500 },
        )
      }
      const sendResult = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [customer.email],
        subject: 'Your ReadyPack compliance documents are ready for review',
        html: buildDeliveryEmail({
          magicLink,
          customerName,
          packReference: order.display_reference,
          documentCount,
        }),
      })
      if (sendResult.error) {
        return NextResponse.json({ error: `Email send failed: ${sendResult.error.message}` }, { status: 502 })
      }
      await logAudit({ resend_id: sendResult.data?.id ?? null })
      return NextResponse.json({ ok: true, action, message: 'Delivery email resent.' })
    }

    // retrigger_generation
    const { data: submission } = await supabaseAdmin
      .from('intake_submissions')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle()
    if (!submission?.id) {
      return NextResponse.json({ error: 'No intake submission found for this order.' }, { status: 404 })
    }
    // Clear prior generation artefacts so /api/generate's idempotency guard
    // doesn't short-circuit, and we don't pile up duplicate documents.
    await supabaseAdmin.from('generated_documents').delete().eq('submission_id', submission.id)
    await supabaseAdmin.from('document_generation_jobs').delete().eq('submission_id', submission.id)

    const genRes = await fetch(`${appUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SECRET_HEADER]: getInternalSecret() ?? '',
      },
      body: JSON.stringify({ order_id: order.id, _internal: true }),
    })
    if (!genRes.ok) {
      const detail = (await genRes.json().catch(() => null)) as { error?: string } | null
      return NextResponse.json(
        { error: `Generation retrigger failed (${genRes.status}): ${detail?.error ?? 'unknown'}` },
        { status: 502 },
      )
    }
    await logAudit({ submission_id: submission.id })
    return NextResponse.json({ ok: true, action, message: 'Generation retriggered.' })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}
