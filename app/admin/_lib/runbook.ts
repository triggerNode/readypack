// The admin runbook — "what to do next", DERIVED from case state.
//
// Pure and dependency-free (types only) so it is fully unit-testable and can never
// drift from a stored checklist: the numbered steps are a function of flags + docs
// + revisions + info-requests + delivery status. The admin case surface renders
// exactly what this returns; the actual buttons map RunbookActionKey -> the wired
// server actions.
//
// Design goal: the runbook does the thinking so the admin doesn't have to. It is
// TOTAL — every reachable case state resolves to a defined runbook, with a safe
// "review manually" default for anything unmapped.

import type { DeliveryStatus, RiskLevel } from '@/types/database'

export type RunbookStepStatus = 'done' | 'active' | 'locked'

// Which wired admin action the UI surfaces on a step (maps to the server actions /
// send-delivery route). 'none' = an informational step with no button.
export type RunbookActionKey =
  | 'generate'
  | 'sign_off'
  | 'release'
  | 'regenerate_revision'
  | 'rerelease_revision'
  | 'review_answer'
  | 'none'

export type RunbookStep = {
  title: string
  desc: string
  status: RunbookStepStatus
  action: RunbookActionKey
}

export type Runbook =
  | { kind: 'calm'; tone: 'good' | 'waiting' | 'done'; title: string; sub: string }
  | { kind: 'steps'; steps: RunbookStep[] }

// The normalised snapshot the runbook reads. Built from the case page's already-
// loaded rows (see app/admin/cases/[id]/page.tsx) — the runbook never touches the DB.
export type CaseRunbookState = {
  intakeSubmitted: boolean
  deliveryStatus: DeliveryStatus
  riskLevel: RiskLevel | null
  /** How many of the 9 documents exist (generated), regardless of delivery state. */
  docsTotal: number
  /** Document types whose generation failed and were never recovered. */
  docsFailed: number
  /** Open high/critical flags still needing a human sign-off (the delivery gate). */
  openHighFlags: number
  /** Customer revisions still needing admin action (regenerate / re-release). */
  openRevisions: number
  /** Info-requests the customer has answered but the admin hasn't processed. */
  answeredInfoRequests: number
  /** Info-requests still awaiting the customer's answer. */
  openInfoRequests: number
}

function isHeld(riskLevel: RiskLevel | null): boolean {
  return riskLevel === 'high' || riskLevel === 'critical'
}

// The 4-step workflow for a held (high/critical) case: generate -> QA -> sign off
// the high flags -> release. Step status is derived from what's actually happened.
function heldSteps(state: CaseRunbookState): RunbookStep[] {
  const generated = state.docsTotal > 0
  const flagsOpen = state.openHighFlags > 0

  const generate: RunbookStep = {
    title: 'Generate the pack',
    desc: generated
      ? `${state.docsTotal} documents generated from the intake answers.`
      : 'This case is held for review — generate the 9 documents to begin.',
    status: generated ? 'done' : 'active',
    action: generated ? 'none' : 'generate',
  }

  const qa: RunbookStep = {
    title: 'Run QA',
    desc: generated
      ? 'QA has run — see the flags below.'
      : 'Runs automatically once the pack is generated.',
    status: generated ? 'done' : 'locked',
    action: 'none',
  }

  const flagLabel =
    state.openHighFlags === 1 ? '1 flag that needs a human' : `${state.openHighFlags} flags that need a human`
  const signOff: RunbookStep = {
    title: flagsOpen ? `Review the ${flagLabel}` : 'Sign off the high-risk flags',
    desc: flagsOpen
      ? 'Sign each off with a reason — accept with justification, or remediate. The pack can’t ship until this is done.'
      : 'All high-risk flags are signed off.',
    status: !generated ? 'locked' : flagsOpen ? 'active' : 'done',
    action: generated && flagsOpen ? 'sign_off' : 'none',
  }

  const canRelease = generated && !flagsOpen
  const release: RunbookStep = {
    title: 'Release the pack for customer review',
    desc: 'Sends the secure review link. Watermarks lift once the customer approves.',
    status: canRelease ? 'active' : 'locked',
    action: canRelease ? 'release' : 'none',
  }

  return [generate, qa, signOff, release]
}

export function deriveRunbook(state: CaseRunbookState): Runbook {
  // Order matters: the first matching condition wins. Terminal + waiting states
  // first, then the active-work states (revision, held sign-off, failed, answers),
  // then the calm "nothing to do", then a safe default.

  if (!state.intakeSubmitted) {
    return {
      kind: 'calm',
      tone: 'waiting',
      title: 'Waiting on the customer',
      sub: 'They haven’t finished the questionnaire yet — nothing to do here.',
    }
  }

  if (state.deliveryStatus === 'delivered') {
    return {
      kind: 'calm',
      tone: 'done',
      title: 'Delivered',
      sub: 'The customer has their finalised pack. Nothing to do.',
    }
  }

  if (state.deliveryStatus === 'generating') {
    return {
      kind: 'calm',
      tone: 'waiting',
      title: 'Generating the pack…',
      sub: 'This runs automatically and takes a few minutes. Watch it, or check back shortly.',
    }
  }

  // A customer revision is the active work — regenerate the affected doc(s), then
  // re-release. (By the time a revision exists the pack was released, so any high
  // flags were already signed off — this correctly takes priority over "clean".)
  if (state.openRevisions > 0) {
    return {
      kind: 'steps',
      steps: [
        {
          title: 'Regenerate the revised document(s) with AI',
          desc: 'Applies the customer’s feedback. Leaves a fresh watermarked draft.',
          status: 'active',
          action: 'regenerate_revision',
        },
        {
          title: 'Re-release the revised document(s)',
          desc: 'Emails the customer their updated document to review and approve.',
          status: 'locked',
          action: 'rerelease_revision',
        },
      ],
    }
  }

  // Held (high/critical) case: the 4-step sign-off workflow.
  if (isHeld(state.riskLevel)) {
    return { kind: 'steps', steps: heldSteps(state) }
  }

  // ---- low / medium from here ----

  // Generation failed and nothing recovered — the admin must retry.
  if (state.docsTotal === 0 && state.docsFailed > 0) {
    return {
      kind: 'steps',
      steps: [
        {
          title: 'Retry generation',
          desc: 'Some documents failed to generate. Re-run the pipeline for this case.',
          status: 'active',
          action: 'generate',
        },
      ],
    }
  }

  // Not generated yet (submitted but no docs, not currently generating) — kick it off.
  if (state.docsTotal === 0) {
    return {
      kind: 'steps',
      steps: [
        {
          title: 'Generate the pack',
          desc: 'The intake is in — generate the 9 documents.',
          status: 'active',
          action: 'generate',
        },
      ],
    }
  }

  // The customer answered an outstanding question — review the update.
  if (state.answeredInfoRequests > 0) {
    return {
      kind: 'steps',
      steps: [
        {
          title: 'Review the customer’s answer',
          desc: 'The customer replied to an information request. Check the update, then mark it resolved.',
          status: 'active',
          action: 'review_answer',
        },
      ],
    }
  }

  // Waiting on the customer to answer an outstanding question.
  if (state.openInfoRequests > 0) {
    return {
      kind: 'calm',
      tone: 'waiting',
      title: 'Waiting on the customer’s answer',
      sub: 'An information request is out with the customer. Nothing to do until they reply.',
    }
  }

  // Released and with the customer for review/approval.
  if (state.deliveryStatus === 'qa_review' || state.deliveryStatus === 'approved') {
    return {
      kind: 'calm',
      tone: 'good',
      title: 'With the customer for review',
      sub: 'The pack is released. It finalises when the customer approves — nothing to do.',
    }
  }

  // Generated, clean, not yet released (low/medium).
  if (state.docsTotal > 0) {
    return {
      kind: 'calm',
      tone: 'good',
      title: 'Nothing to do — watch it deliver',
      sub: 'The pack generated cleanly and passed QA. It releases automatically, or you can release it now.',
    }
  }

  // Safe default — anything unmapped gets a human eye rather than a wrong answer.
  return {
    kind: 'calm',
    tone: 'waiting',
    title: 'Review this case',
    sub: 'This case isn’t in a standard state — open the tabs below and review it manually.',
  }
}
