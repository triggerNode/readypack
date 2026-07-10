// The case lifecycle stepper — DERIVED from case state, like the runbook.
//
// Pure and total: every case maps to the six ordered stops with each marked
// done / current / upcoming. "reached" is made monotonic (a stop only counts if
// every earlier stop is reached too) so a malformed state can never light a later
// stop while an earlier one is dark.

import type { DeliveryStatus } from '@/types/database'

export type LifecycleKey = 'submitted' | 'generated' | 'qa' | 'released' | 'reviewing' | 'delivered'
export type LifecycleStepState = 'done' | 'current' | 'upcoming'
export type LifecycleStep = { key: LifecycleKey; label: string; state: LifecycleStepState }

export type LifecycleInput = {
  intakeSubmitted: boolean
  deliveryStatus: DeliveryStatus
  /** How many of the 9 documents exist — generation + QA are treated as reached once any do. */
  docsTotal: number
}

// The pack has left us for the customer once it has reached (or passed) review.
const RELEASED: ReadonlySet<DeliveryStatus> = new Set<DeliveryStatus>(['qa_review', 'escalated', 'approved', 'delivered'])
// The customer has engaged / approved.
const REVIEWED: ReadonlySet<DeliveryStatus> = new Set<DeliveryStatus>(['approved', 'delivered'])

const ORDER: readonly LifecycleKey[] = ['submitted', 'generated', 'qa', 'released', 'reviewing', 'delivered']
const LABELS: Record<LifecycleKey, string> = {
  submitted: 'Submitted',
  generated: 'Generated',
  qa: 'QA',
  released: 'Released',
  reviewing: 'Reviewing',
  delivered: 'Delivered',
}

export function deriveLifecycle(input: LifecycleInput): LifecycleStep[] {
  const generated = input.docsTotal > 0
  const raw: Record<LifecycleKey, boolean> = {
    submitted: input.intakeSubmitted,
    generated,
    qa: generated,
    released: RELEASED.has(input.deliveryStatus),
    reviewing: REVIEWED.has(input.deliveryStatus),
    delivered: input.deliveryStatus === 'delivered',
  }

  // Monotonic reached: a stop is reached only if all prior stops are too.
  let prior = true
  const reached = ORDER.map((k) => {
    prior = prior && raw[k]
    return prior
  })

  const lastReached = reached.lastIndexOf(true) // -1 when nothing reached yet
  const allReached = lastReached === ORDER.length - 1

  return ORDER.map((key, i) => {
    let state: LifecycleStepState
    if (i <= lastReached) state = 'done'
    else if (i === lastReached + 1 && !allReached) state = 'current'
    else state = 'upcoming'
    return { key, label: LABELS[key], state }
  })
}
