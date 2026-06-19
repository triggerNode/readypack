// lib/documents/pack-status.ts
// Maps an order's generation/delivery state onto the customer-facing Pack
// Progress screen states (design: design/PackProgress.html). Pure and
// dependency-free so it can be unit-tested and reused by the status API.
//
// Phases (the 5-step stepper): 0 Intake received · 1 Reviewing your answers ·
// 2 Drafting your documents · 3 Quality assurance · 4 Ready.

export type PackState = 'progress' | 'action' | 'review' | 'ready' | 'delayed'

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
  now?: number
}

export interface PackStatus {
  state: PackState
  /** Index into PACK_PHASES of the current phase. */
  phaseIndex: number
  docsReady: number
  docsTotal: number
}

export function computePackState(input: PackStatusInputs): PackStatus {
  const docsReady = input.docsReady
  const base = { docsReady, docsTotal: DOC_TOTAL }
  const now = input.now ?? Date.now()

  // 1. Needs the customer to supply information — highest priority, drives the
  //    portal remediation flow. Stepper pauses at "Reviewing your answers".
  if (input.openInfoRequests > 0) {
    return { state: 'action', phaseIndex: 1, ...base }
  }

  // 2. Ready for the customer: pack approved/delivered → review & download.
  if (input.deliveryStatus === 'approved' || input.deliveryStatus === 'delivered') {
    return { state: 'ready', phaseIndex: 4, ...base }
  }

  // 3. Generation failed outright.
  if (input.deliveryStatus === 'failed' || input.jobStatus === 'failed') {
    return { state: 'delayed', phaseIndex: 2, ...base }
  }

  // 4. With our compliance team (manual review / escalated, generated).
  if (input.deliveryStatus === 'escalated' || input.deliveryStatus === 'qa_review') {
    return { state: 'review', phaseIndex: 3, ...base }
  }

  // 5. Generating / queued.
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

  // 6. Default early state (pending, no job yet).
  return { state: 'progress', phaseIndex: 0, ...base }
}
