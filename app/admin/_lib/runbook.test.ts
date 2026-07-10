import { describe, it, expect } from 'vitest'
import { deriveRunbook, type CaseRunbookState, type Runbook } from './runbook'

// A clean, generated, low-risk case — each test overrides only what it needs.
const base: CaseRunbookState = {
  intakeSubmitted: true,
  deliveryStatus: 'pending',
  riskLevel: 'low',
  docsTotal: 9,
  docsFailed: 0,
  openHighFlags: 0,
  openRevisions: 0,
  answeredInfoRequests: 0,
  openInfoRequests: 0,
}

function calm(r: Runbook): Extract<Runbook, { kind: 'calm' }> {
  if (r.kind !== 'calm') throw new Error('expected a calm runbook')
  return r
}
function steps(r: Runbook) {
  if (r.kind !== 'steps') throw new Error('expected a steps runbook')
  return r.steps
}

describe('deriveRunbook — terminal + waiting states', () => {
  it('waits when intake is not yet submitted', () => {
    const r = calm(deriveRunbook({ ...base, intakeSubmitted: false }))
    expect(r.tone).toBe('waiting')
    expect(r.title).toMatch(/waiting on the customer/i)
  })

  it('is done when delivered', () => {
    const r = calm(deriveRunbook({ ...base, deliveryStatus: 'delivered' }))
    expect(r.tone).toBe('done')
    expect(r.title).toMatch(/delivered/i)
  })

  it('waits while generating', () => {
    const r = calm(deriveRunbook({ ...base, deliveryStatus: 'generating' }))
    expect(r.tone).toBe('waiting')
    expect(r.title).toMatch(/generating/i)
  })
})

describe('deriveRunbook — held (high-risk) sign-off workflow', () => {
  it('held + not generated: generate is the active first step, sign-off + release locked', () => {
    const s = steps(deriveRunbook({ ...base, riskLevel: 'high', docsTotal: 0, openHighFlags: 2 }))
    expect(s).toHaveLength(4)
    expect(s[0].action).toBe('generate')
    expect(s[0].status).toBe('active')
    expect(s[2].status).toBe('locked') // sign-off locked until generated
    expect(s[3].status).toBe('locked') // release locked
  })

  it('held + generated + open flags: sign-off is active, release locked', () => {
    const s = steps(deriveRunbook({ ...base, riskLevel: 'high', docsTotal: 9, openHighFlags: 1 }))
    expect(s[0].status).toBe('done') // generate
    expect(s[1].status).toBe('done') // QA
    expect(s[2].status).toBe('active')
    expect(s[2].action).toBe('sign_off')
    expect(s[3].status).toBe('locked')
    expect(s[3].action).toBe('none')
  })

  it('held + generated + all flags signed off: release is the active step', () => {
    const s = steps(deriveRunbook({ ...base, riskLevel: 'critical', docsTotal: 9, openHighFlags: 0 }))
    expect(s[2].status).toBe('done')
    expect(s[3].status).toBe('active')
    expect(s[3].action).toBe('release')
  })
})

describe('deriveRunbook — revision loop', () => {
  it('surfaces regenerate then re-release', () => {
    const s = steps(deriveRunbook({ ...base, openRevisions: 1 }))
    expect(s).toHaveLength(2)
    expect(s[0].action).toBe('regenerate_revision')
    expect(s[0].status).toBe('active')
    expect(s[1].action).toBe('rerelease_revision')
    expect(s[1].status).toBe('locked')
  })

  it('a revision takes priority even on a held case (flags already signed off pre-release)', () => {
    const s = steps(deriveRunbook({ ...base, riskLevel: 'high', openRevisions: 1, openHighFlags: 0 }))
    expect(s[0].action).toBe('regenerate_revision')
  })
})

describe('deriveRunbook — low/medium states', () => {
  it('retries when generation failed with nothing recovered', () => {
    const s = steps(deriveRunbook({ ...base, docsTotal: 0, docsFailed: 3 }))
    expect(s[0].action).toBe('generate')
    expect(s[0].title).toMatch(/retry/i)
  })

  it('generates when submitted but not yet generated', () => {
    const s = steps(deriveRunbook({ ...base, docsTotal: 0 }))
    expect(s[0].action).toBe('generate')
    expect(s[0].title).toMatch(/generate the pack/i)
  })

  it('reviews the answer when the customer replied to an info-request', () => {
    const s = steps(deriveRunbook({ ...base, answeredInfoRequests: 1 }))
    expect(s[0].action).toBe('review_answer')
  })

  it('waits on the customer when an info-request is still open', () => {
    const r = calm(deriveRunbook({ ...base, openInfoRequests: 1 }))
    expect(r.tone).toBe('waiting')
    expect(r.title).toMatch(/waiting on the customer/i)
  })

  it('is calm-good while the customer reviews a released pack', () => {
    const r = calm(deriveRunbook({ ...base, deliveryStatus: 'qa_review' }))
    expect(r.tone).toBe('good')
    expect(r.title).toMatch(/with the customer/i)
  })

  it('is calm-good "nothing to do" for a clean generated pack', () => {
    const r = calm(deriveRunbook(base))
    expect(r.tone).toBe('good')
    expect(r.title).toMatch(/nothing to do/i)
  })
})
