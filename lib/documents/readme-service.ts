// Server-side loader for the "What we noticed" read-me: turns an order id into the
// ReadmeModel by reading its company, deterministic flags, and any open query. Used
// by BOTH the completion-email attachment and the portal backup route so they render
// the identical read-me. Impure (DB) — the pure builder lives in readme-content.ts.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildReadme, type ReadmeModel, type ReadmeFlagInput } from './readme-content'
import type { RiskFlagCode } from '@/lib/risk/score'
import type { RiskFlagResolutionType } from '@/types/database'

export async function loadReadmeModel(orderId: string): Promise<ReadmeModel | null> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.user_id) return null

  const { data: customer } = await supabaseAdmin
    .from('users')
    .select('company_name, trading_name')
    .eq('id', order.user_id)
    .maybeSingle()
  const companyName = customer?.trading_name || customer?.company_name || 'your organisation'

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  const submissionId = submission?.id ?? null

  let flags: ReadmeFlagInput[] = []
  if (submissionId) {
    const { data } = await supabaseAdmin
      .from('risk_flags')
      .select('code, resolution_type')
      .eq('submission_id', submissionId)
    flags = (data ?? []).map((r) => ({
      code: (r.code ?? null) as RiskFlagCode | null,
      resolutionType: (r.resolution_type ?? null) as RiskFlagResolutionType | null,
    }))
  }

  // Only a genuinely-open info-request (awaiting the customer) surfaces the portal note.
  const { count } = await supabaseAdmin
    .from('info_requests')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('status', 'open')
  const hasOpenQuery = (count ?? 0) > 0

  return buildReadme({ companyName, flags, hasOpenQuery })
}
