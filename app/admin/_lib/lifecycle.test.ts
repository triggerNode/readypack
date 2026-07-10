import { describe, it, expect } from 'vitest'
import { deriveLifecycle, type LifecycleInput, type LifecycleKey, type LifecycleStepState } from './lifecycle'

const base: LifecycleInput = {
  intakeSubmitted: true,
  deliveryStatus: 'pending',
  docsTotal: 9,
}

function stateOf(steps: ReturnType<typeof deriveLifecycle>, key: LifecycleKey): LifecycleStepState {
  const s = steps.find((x) => x.key === key)
  if (!s) throw new Error(`no ${key} step`)
  return s.state
}

describe('deriveLifecycle', () => {
  it('has exactly one current step in an in-flight case', () => {
    const steps = deriveLifecycle(base)
    expect(steps.filter((s) => s.state === 'current')).toHaveLength(1)
  })

  it('before submission, Submitted is current and everything else upcoming', () => {
    const steps = deriveLifecycle({ ...base, intakeSubmitted: false, docsTotal: 0 })
    expect(stateOf(steps, 'submitted')).toBe('current')
    expect(stateOf(steps, 'generated')).toBe('upcoming')
    expect(stateOf(steps, 'delivered')).toBe('upcoming')
  })

  it('submitted but not generated → Generated is current', () => {
    const steps = deriveLifecycle({ ...base, docsTotal: 0 })
    expect(stateOf(steps, 'submitted')).toBe('done')
    expect(stateOf(steps, 'generated')).toBe('current')
    expect(stateOf(steps, 'qa')).toBe('upcoming')
  })

  it('generated + QA done, not released → Released is current', () => {
    const steps = deriveLifecycle(base)
    expect(stateOf(steps, 'submitted')).toBe('done')
    expect(stateOf(steps, 'generated')).toBe('done')
    expect(stateOf(steps, 'qa')).toBe('done')
    expect(stateOf(steps, 'released')).toBe('current')
  })

  it('released and with the customer → Reviewing is current', () => {
    const steps = deriveLifecycle({ ...base, deliveryStatus: 'qa_review' })
    expect(stateOf(steps, 'released')).toBe('done')
    expect(stateOf(steps, 'reviewing')).toBe('current')
    expect(stateOf(steps, 'delivered')).toBe('upcoming')
  })

  it('escalated (revision loop) still counts as released and reviewing-current', () => {
    const steps = deriveLifecycle({ ...base, deliveryStatus: 'escalated' })
    expect(stateOf(steps, 'released')).toBe('done')
    expect(stateOf(steps, 'reviewing')).toBe('current')
  })

  it('delivered → every step done, no current', () => {
    const steps = deriveLifecycle({ ...base, deliveryStatus: 'delivered' })
    expect(steps.every((s) => s.state === 'done')).toBe(true)
    expect(steps.some((s) => s.state === 'current')).toBe(false)
  })

  it('is monotonic — an advanced delivery status with zero docs never lights a later stop past a dark one', () => {
    // Malformed: qa_review but no documents. Generated/QA are not reached, so
    // Released/Reviewing must not show as done ahead of them.
    const steps = deriveLifecycle({ ...base, deliveryStatus: 'qa_review', docsTotal: 0 })
    expect(stateOf(steps, 'generated')).toBe('current')
    expect(stateOf(steps, 'released')).toBe('upcoming')
    expect(stateOf(steps, 'reviewing')).toBe('upcoming')
  })
})
