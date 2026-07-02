// lib/documents/delivery-email.ts
//
// Sends the customer "your compliance pack is ready to review" email + logs the
// customer_communications row. Self-contained (takes only an orderId and loads
// what it needs) so BOTH the automatic self-serve path (api/generate, on
// completion for low/medium risk) and any future caller share one implementation
// — the admin "Release for review" route (send-delivery) still owns its own
// status-advance/audit flow.

import { generateMagicLink } from '@/lib/auth/magic-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildDeliveryEmail } from '@/lib/email'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

export interface DeliveryEmailResult {
  ok: boolean
  error?: string
  docCount?: number
  resendId?: string | null
}

/**
 * Email the customer a fresh magic link into /portal/[orderId] announcing that
 * their pack is ready for review. Never throws — returns a result object so
 * callers (notably the generation pipeline) can log-and-continue.
 */
export async function sendDeliveryEmailForOrder(orderId: string): Promise<DeliveryEmailResult> {
  try {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, display_reference')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return { ok: false, error: 'order not found' }

    const { data: customer } = await supabaseAdmin
      .from('users')
      .select('email, company_name, trading_name')
      .eq('id', order.user_id)
      .maybeSingle()
    if (!customer?.email) return { ok: false, error: 'customer email not found' }

    const { data: submission } = await supabaseAdmin
      .from('intake_submissions')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle()

    const { count: docCount } = await supabaseAdmin
      .from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submission?.id ?? '00000000-0000-0000-0000-000000000000')
    if (!docCount || docCount < 1) return { ok: false, error: 'no documents to deliver' }

    const magicLink = await generateMagicLink(customer.email, `/portal/${order.id}`)
    const packRef = order.display_reference ?? `RP-${order.id.slice(0, 8).toUpperCase()}`

    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      replyTo: 'hello@readypack.co.uk',
      to: [customer.email],
      subject: 'Your ReadyPack compliance documents are ready for review',
      html: buildDeliveryEmail({
        magicLink,
        customerName: customer.trading_name || customer.company_name || null,
        packReference: packRef,
        documentCount: docCount,
      }),
    })
    if (sendResult.error) return { ok: false, error: sendResult.error.message }

    await supabaseAdmin.from('customer_communications').insert({
      order_id: order.id,
      email_type: 'delivery',
      sent_at: new Date().toISOString(),
      resend_id: sendResult.data?.id ?? null,
      delivery_status: 'sent',
    })

    return { ok: true, docCount, resendId: sendResult.data?.id ?? null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unexpected error' }
  }
}
