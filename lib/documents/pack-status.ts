// lib/documents/pack-status.ts
// Maps an order's generation/delivery state onto the customer-facing Pack
// Progress screen states (design: design/PackProgress-Partial.html). Pure and
// dependency-free so it can be unit-tested and reused by the status API.
//
// Phases (the 5-step stepper): 0 Intake received · 1 Reviewing your answers ·
// 2 Drafting your documents · 3 Quality assurance · 4 Ready / Your review.
//
// Pre-release states describe OUR work: progress · action · review · delayed ·
// ready. Once the pack has been released to the customer (a delivery email was
// sent), the screen describes the CUSTOMER'S own review instead of internal QA:
// released (nothing approved yet) · partial (some approved / in revision) ·
// complete (all nine final). This kills the "in manual review while I'm
// approving" contradiction the paid e2e surfaced (DECISIONS-LOG 2026-06-24).

export type PackState =
  | 'progress'
  | 'action'
  | 'review'
  | 'ready'
  | 'delayed'
  | 'released'
  | 'partial'
  | 'complete'

export const PACK_PHASES = [
  'Intake received',
  'Reviewing your answers',
  'Drafting your documents',
  'Quality assurance',
  'Ready',
] as const

export const DOC_TOTAL = 9

// A `running` job older than this has outlived any worker invocation
// (maxDuration 800s) — surface the gentle "taking longer" state.
const STUCK_MS = 15 * 60 * 1000

export interface PackStatusInputs {
  deliveryStatus: string
  jobStatus: string | null
  jobStartedAt: string | null
  docsReady: number
  openInfoRequests: number
  /** Per-document approval/revision counts (migration 008). Optional so older
   *  callers keep working; default to 0. */
  docsFinal?: number
  docsInRevision?: number
  /** True once the pack has been released to the customer for review (a
   *  delivery email was sent). Flips the screen from internal-QA copy to the
   *  customer's-own-review copy. Optional → defaults false. */
  released?: boolean
  now?: number
}

export interface PackStatus {
  state: PackState
  /** Index into PACK_PHASES of the current phase. */
  phaseIndex: number
  docsReady: number
  docsTotal: number
  /** Documents the customer has approved (final/downloadable). */
  docsFinal: number
  /** Documents currently being revised by our team. */
  docsInRevision: number
  /** Documents still awaiting the customer's review (drafts, not in revision). */
  docsAwaitingReview: number
}

export function computePackState(input: PackStatusInputs): PackStatus {
  const docsReady = input.docsReady
  const docsFinal = input.docsFinal ?? 0
  const docsInRevision = input.docsInRevision ?? 0
  // Drafts the customer still needs to look at = generated, minus the ones
  // already final and the ones in revision. Never negative.
  const docsAwaitingReview = Math.max(0, docsReady - docsFinal - docsInRevision)
  const base = { docsReady, docsTotal: DOC_TOTAL, docsFinal, docsInRevision, docsAwaitingReview }
  const now = input.now ?? Date.now()
  const released = input.released ?? false

  // 1. Needs the customer to supply information — highest priority, drives the
  //    portal remediation flow. Stepper pauses at "Reviewing your answers".
  if (input.openInfoRequests > 0) {
    return { state: 'action', phaseIndex: 1, ...base }
  }

  // 2. Pack fully complete — every document approved & un-watermarked. Reached
  //    by the order roll-up to `delivered`, or by counting all docs final. Both
  //    mean "all done" — which is only ever reachable after release — so this is
  //    the terminal celebratory state independent of the `released` flag.
  if (input.deliveryStatus === 'delivered' || docsFinal >= DOC_TOTAL) {
    return { state: 'complete', phaseIndex: 4, ...base }
  }

  // 3. Released to the customer — describe THEIR review, never internal QA.
  //    The QA step reads as done; the final node becomes "Your review".
  if (released) {
    // Some documents approved or in revision (but not all) → partial progress.
    if (docsFinal > 0 || docsInRevision > 0) {
      return { state: 'partial', phaseIndex: 4, ...base }
    }
    // Released but nothing acted on yet → awaiting your review.
    return { state: 'released', phaseIndex: 4, ...base }
  }

  // 4. Not released, but flagged approved/delivered (vestigial pre-release
  //    edge from the retired admin-approves model) → ready to review.
  if (input.deliveryStatus === 'approved') {
    return { state: 'ready', phaseIndex: 4, ...base }
  }

  // 5. Generation failed outright.
  if (input.deliveryStatus === 'failed' || input.jobStatus === 'failed') {
    return { state: 'delayed', phaseIndex: 2, ...base }
  }

  // 6. With our compliance team — genuine pre-release QA (manual review /
  //    escalated, generated, NOT yet released to the customer).
  if (input.deliveryStatus === 'escalated' || input.deliveryStatus === 'qa_review') {
    return { state: 'review', phaseIndex: 3, ...base }
  }

  // 7. Generating / queued.
  if (
    input.deliveryStatus === 'generating' ||
    input.jobStatus === 'running' ||
    input.jobStatus === 'queued'
  ) {
    if (
      input.jobStatus === 'running' &&
      input.jobStartedAt &&
      now - new Date(input.jobStartedAt).getTime() > STUCK_MS
    ) {
      return { state: 'delayed', phaseIndex: 2, ...base }
    }
    // Once at least one document exists we're visibly "Drafting"; before that
    // we're still "Reviewing your answers".
    return { state: 'progress', phaseIndex: docsReady > 0 ? 2 : 1, ...base }
  }

  // 8. Default early state (pending, no job yet).
  return { state: 'progress', phaseIndex: 0, ...base }
}
