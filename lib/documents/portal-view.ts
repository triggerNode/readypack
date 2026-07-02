// lib/documents/portal-view.ts
//
// Pure, client-safe presentation derivation for the unified customer portal
// (design brief 14). The phase tracker AND the context/CTA block must always
// tell the SAME story, so they both render off ONE derived `OverallState`. The
// client computes it from the live feed's phase + the EFFECTIVE per-card counts
// (after optimistic overrides), so a revision flips the tracker and the cards
// together in the very same render — the "never two stories" rule, by
// construction.
//
// No React, no server imports — just the state machine.

import type { PackState } from './pack-status'

// The six mutually-exclusive overall states the top of the page can be in
// (mirrors the design brief's context table + the mock's STATES).
export type OverallState =
  | 'preparing' // generating, nothing to act on yet
  | 'action' // open info-requests need the customer's answer
  | 'escalated' // a specialist is reviewing pre-release
  | 'ready' // documents released, awaiting the customer's review
  | 'revising' // ≥1 doc in revision and nothing left to review ("you're all set")
  | 'complete' // every document approved + un-watermarked

export interface PortalCounts {
  total: number
  finalCount: number
  revisionCount: number
  /** Drafts/revised drafts still awaiting the customer's review. */
  awaitingCount: number
}

// Resolve the single overall state. Precedence mirrors computePackState so the
// tracker and the cards agree with the phase: remediation first, then the
// terminal complete, then the released review/revising split, then preparing.
export function deriveOverall(
  packState: PackState,
  counts: PortalCounts,
  hasOpenInfoRequests: boolean,
): OverallState {
  // 1. The customer owes us an answer — highest priority (matches portalMode).
  if (hasOpenInfoRequests || packState === 'action') return 'action'

  // 2. Every document final → complete (terminal celebratory state). This is
  //    driven by the per-card final COUNT, not the server packState alone: the
  //    "Download your pack" CTA lives in this state, so it must not appear until
  //    every card is actually final. Trusting pack['complete'] while the local
  //    per-card set is still catching up (right after "approve remaining", before
  //    the poll reconciles) made the bulk download grab only the already-final
  //    subset. finaliseOrderPack only rolls the order to complete once EVERY doc
  //    is final anyway, so a genuinely-complete order always satisfies this.
  if (counts.total > 0 && counts.finalCount === counts.total) return 'complete'

  // 3. A specialist is reviewing pre-release (genuine internal QA).
  if (packState === 'review') return 'escalated'

  // 4. Released to the customer. If anything is still awaiting their review the
  //    primary story is "ready to review"; otherwise, if work is in revision,
  //    they're "all set" while we re-draft.
  if (packState === 'ready' || packState === 'released' || packState === 'partial') {
    if (counts.awaitingCount > 0) return 'ready'
    if (counts.revisionCount > 0) return 'revising'
    return 'ready'
  }

  // 5. Default: still being assembled (progress / delayed / pending).
  return 'preparing'
}

// A few CTA/scroll targets reference a card lifecycle state to jump to. Kept
// here so the context block and the client agree on the vocabulary.
export type ScrollTargetState = 'flagged' | 'draft' | 'revision' | 'final'
