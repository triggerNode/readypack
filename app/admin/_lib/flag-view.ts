// Flag → admin card display model.
//
// Pure, dependency-free (types + the shared risk helpers only) so it is fully
// unit-testable and can never drift from the gate/classifier rules it renders.
// The admin runbook surface shows exactly what this returns; it does NOT re-decide
// what blocks delivery (that stays in lib/risk/gate.ts).
//
// A flag lands in one of four display paths:
//   • hold       — OPEN + high/critical: a human must sign it off (the gate).
//   • query      — OPEN + a genuine gap we ask the customer about (vendor_dpa today).
//   • handled    — the pack already covers it; informational, no action. (Handled
//                  flags are auto-closed at intake, so most arrive here CLOSED.)
//   • signed-off — CLOSED with a recorded human decision (accept / remediate / query),
//                  rendered as a resolved card with the reason.
//
// Old rows (pre-migration-010) have code = null and resolution_type = null — they
// fall back to severity so nothing crashes and no old flag is mislabelled a "query".

import { classifyFlag, resolutionLabel } from '@/lib/risk/resolution'
import { isBlockingFlag } from '@/lib/risk/gate'
import type { RiskFlagCode } from '@/lib/risk/score'
import type { RiskFlagSeverity, RiskFlagStatus, RiskFlagResolutionType } from '@/types/database'

export type FlagPath = 'hold' | 'query' | 'handled' | 'signed-off'

// The flag columns the case page loads (see app/admin/cases/[id]/page.tsx). `code`
// and the resolution_* columns are nullable for rows written before migration 010.
export type FlagRowForView = {
  id: string
  code: RiskFlagCode | null
  severity: RiskFlagSeverity
  status: RiskFlagStatus
  explanation: string
  required_action: string | null
  triggering_answer: string | null
  resolution_type: RiskFlagResolutionType | null
  resolution_note: string | null
  resolved_at: string | null
}

export type FlagView = {
  id: string
  path: FlagPath
  isOpen: boolean
  /** First sentence of the explanation — the card heading. */
  title: string
  /** The law / why, verbatim from the deterministic rule. */
  explanation: string
  /** What the pack does about it. */
  requiredAction: string | null
  triggeringAnswer: string | null
  severity: RiskFlagSeverity
  /** Human decision label for a closed flag (e.g. "Accepted with justification"). */
  resolutionLabel: string | null
  resolutionNote: string | null
  resolvedAt: string | null
}

export type FlagSummary = {
  /** Open held flags — the ones that block delivery and need a human. */
  needsYou: number
  /** Open query flags — out with the customer. */
  outWithCustomer: number
  /** Everything already covered (handled + signed-off). */
  handled: number
}

/** The card heading: the explanation's first sentence, trailing dot trimmed. */
function firstSentence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ''
  const dot = trimmed.indexOf('. ')
  const head = dot > 0 ? trimmed.slice(0, dot) : trimmed
  return head.replace(/\.$/, '')
}

function openPath(flag: Pick<FlagRowForView, 'code' | 'severity' | 'status'>): FlagPath {
  // High/critical always holds for a human, regardless of code (matches the gate).
  if (isBlockingFlag(flag)) return 'hold'
  // A null-code old row can't be classified by rule — it isn't a known query, so
  // treat it as handled/informational rather than inventing a customer question.
  if (flag.code == null) return 'handled'
  // classifyFlag returns 'query' (vendor_dpa) or 'handled' for a non-blocking flag.
  return classifyFlag({ code: flag.code, severity: flag.severity })
}

function closedPath(resolutionType: RiskFlagResolutionType | null): FlagPath {
  // A recorded human decision (accept/remediate) or a query closure shows a
  // resolution box; a 'handled' or missing type is a quiet informational card.
  if (resolutionType === 'accept' || resolutionType === 'remediate' || resolutionType === 'query') {
    return 'signed-off'
  }
  return 'handled'
}

export function deriveFlagView(flag: FlagRowForView): FlagView {
  const isOpen = flag.status === 'open'
  const path = isOpen ? openPath(flag) : closedPath(flag.resolution_type)
  // Only a signed-off card shows a resolution box (decision + reason). A handled
  // card is quiet — its "Handled by the pack" wording is the path badge, not a box.
  const showResolution = path === 'signed-off' && flag.resolution_type != null
  return {
    id: flag.id,
    path,
    isOpen,
    title: firstSentence(flag.explanation),
    explanation: flag.explanation,
    requiredAction: flag.required_action,
    triggeringAnswer: flag.triggering_answer,
    severity: flag.severity,
    resolutionLabel: showResolution ? resolutionLabel(flag.resolution_type as RiskFlagResolutionType) : null,
    resolutionNote: flag.resolution_note,
    resolvedAt: flag.resolved_at,
  }
}

// Card order: the things that need a human first (hold), then out-with-customer
// (query), then everything already covered (signed-off, then quiet handled).
const PATH_RANK: Record<FlagPath, number> = { hold: 0, query: 1, 'signed-off': 2, handled: 3 }

export function orderFlagViews(views: ReadonlyArray<FlagView>): FlagView[] {
  return [...views].sort((a, b) => PATH_RANK[a.path] - PATH_RANK[b.path])
}

export function summariseFlagViews(views: ReadonlyArray<FlagView>): FlagSummary {
  let needsYou = 0
  let outWithCustomer = 0
  let handled = 0
  for (const v of views) {
    if (v.path === 'hold') needsYou += 1
    else if (v.path === 'query') outWithCustomer += 1
    else handled += 1
  }
  return { needsYou, outWithCustomer, handled }
}
