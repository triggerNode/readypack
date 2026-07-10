// Flag closure model — how each deterministic risk flag is meant to close.
//
// Pure and dependency-free (like score.ts). This is the "meaning" layer that sits
// on top of the deterministic scorer: it does NOT change scoring, it decides which
// of three paths a flag takes once it exists. Consumed at intake
// (app/api/intake/submit/route.ts) to auto-close the no-action flags, and later by
// the admin runbook + the customer read-me.
//
//   • handled — the pack already addresses it; NO admin action. Auto-closed at
//               intake (resolution_type='handled'). The customer is told on the read-me.
//   • query   — a genuine gap we ask the customer about (currently the vendor-DPA
//               check). Stays open; the answer attaches to the flag and regenerates
//               the affected doc (Stage 3).
//   • hold    — high-risk; a human must sign it off (accept-with-justification or
//               remediate) before the pack can pass the delivery gate. Stays open.

import type { RiskFlagCode } from './score'
import type { RiskFlagSeverity, RiskFlagResolutionType } from '@/types/database'

export type FlagClosurePath = 'handled' | 'query' | 'hold'

// The two ways a human closes a HELD (high-risk) flag at sign-off.
export type SignOffDecision = Extract<RiskFlagResolutionType, 'accept' | 'remediate'>

const RESOLUTION_LABELS: Record<RiskFlagResolutionType, string> = {
  handled: 'Handled by the pack',
  query: 'Queried with the customer',
  accept: 'Accepted with justification',
  remediate: 'Remediated',
}

/** Human label for how a flag closed — used by the admin runbook + the read-me. */
export function resolutionLabel(type: RiskFlagResolutionType): string {
  return RESOLUTION_LABELS[type]
}

// Accept the full DB severity union (incl. 'critical') even though scoreRisk only
// emits low/medium/high today — so a future critical-severity flag, or a persisted
// row read back in Stage 3, is classified correctly rather than falling through.
export type FlagForClassification = { code: RiskFlagCode; severity: RiskFlagSeverity }

export function classifyFlag(flag: FlagForClassification): FlagClosurePath {
  // A high/critical-severity flag is always HELD for a human sign-off first — this
  // must win over any per-rule path so a held flag can never be silently downgraded.
  // (Kept in lockstep with isBlockingFlag in gate.ts.)
  if (flag.severity === 'high' || flag.severity === 'critical') return 'hold'
  // The vendor-DPA rule is a real gap: we QUERY the customer, and their answer
  // later closes the flag and regenerates the affected document.
  if (flag.code === 'vendor_dpa') return 'query'
  // Everything else the pack already covers — no admin action needed. NOTE: any
  // NEW rule that represents a genuine customer gap (like vendor_dpa) must be added
  // to the 'query' branch above, or it will be silently auto-closed at intake here.
  return 'handled'
}

/**
 * True when a flag needs no admin action and can be auto-closed at intake.
 * Convenience wrapper used by the submit route.
 */
export function isHandledAtIntake(flag: FlagForClassification): boolean {
  return classifyFlag(flag) === 'handled'
}
