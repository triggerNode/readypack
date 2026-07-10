// Delivery gate — the single source of truth for "can this pack reach the customer,
// or does a human still need to sign off a high-risk flag?".
//
// One rule, one helper, wired into every door that pushes a pack toward the customer:
//   • admin approvePackAction        (approve for delivery)
//   • admin send-delivery route      (release drafts for customer review)
//   • customer approvePackAction /   (finalise → watermark off → delivered)
//     approveDocumentAction
//
// isBlockingFlag is the ONE encoding of the rule; openHighRiskFlagCount fetches the
// submission's flags and applies it (so the SQL and the tested predicate can never
// drift). supabaseAdmin is imported LAZILY so this module stays importable from pure
// unit tests (the admin client builds at module scope and throws without env).

import type { RiskFlagSeverity, RiskFlagStatus } from '@/types/database'

/**
 * A flag blocks delivery only while it is still OPEN and high/critical severity —
 * i.e. it needs a human sign-off (accept-with-justification or remediate). Handled,
 * low, medium, or already-closed flags never gate. Pure — the single source of truth
 * for the gate rule.
 */
export function isBlockingFlag(flag: { severity: RiskFlagSeverity; status: RiskFlagStatus }): boolean {
  return flag.status === 'open' && (flag.severity === 'high' || flag.severity === 'critical')
}

/**
 * How many high-risk flags on this submission still need a human sign-off before the
 * pack can be delivered. Fetches the submission's flags and counts via isBlockingFlag.
 * Fail-closed: any query error THROWS (the caller must not treat a broken read as
 * "zero open flags").
 */
export async function openHighRiskFlagCount(submissionId: string): Promise<number> {
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  const { data, error } = await supabaseAdmin
    .from('risk_flags')
    .select('severity, status')
    .eq('submission_id', submissionId)
  if (error) throw new Error(`Risk-flag gate query failed: ${error.message}`)
  const rows = (data ?? []) as Array<{ severity: RiskFlagSeverity; status: RiskFlagStatus }>
  return rows.filter(isBlockingFlag).length
}

/**
 * True when at least one high-risk flag on this submission still needs a human
 * sign-off. The gate every customer-facing door checks. Fail-closed (throws on a
 * query error) — callers must treat a thrown error as "cannot verify → do not ship".
 */
export async function hasOpenHighRiskFlags(submissionId: string): Promise<boolean> {
  return (await openHighRiskFlagCount(submissionId)) > 0
}
