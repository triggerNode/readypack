import { describe, it, expect } from 'vitest'
import {
  deriveFlagView,
  orderFlagViews,
  summariseFlagViews,
  type FlagRowForView,
} from './flag-view'

// A generated, low-severity handled flag — each test overrides only what it needs.
const base: FlagRowForView = {
  id: 'f1',
  code: 'no_governance_owner',
  severity: 'low',
  status: 'resolved',
  explanation: 'No formal owner for data protection / AI governance.',
  required_action: 'Internal AI Use Policy recommends nominating a responsible person.',
  triggering_answer: 'governance_owner=none',
  resolution_type: 'handled',
  resolution_note: null,
  resolved_at: '2026-07-09T10:00:00Z',
}

describe('deriveFlagView — open flags', () => {
  it('an open high-severity flag holds for a human', () => {
    const v = deriveFlagView({ ...base, code: 'ai_decision_making', severity: 'high', status: 'open', resolution_type: null })
    expect(v.path).toBe('hold')
    expect(v.isOpen).toBe(true)
  })

  it('an open critical-severity flag also holds', () => {
    const v = deriveFlagView({ ...base, code: 'special_category', severity: 'critical', status: 'open', resolution_type: null })
    expect(v.path).toBe('hold')
  })

  it('an open vendor_dpa flag is a customer query', () => {
    const v = deriveFlagView({ ...base, code: 'vendor_dpa', severity: 'medium', status: 'open', resolution_type: null })
    expect(v.path).toBe('query')
  })

  it('an open non-query, non-blocking flag is handled/informational', () => {
    const v = deriveFlagView({ ...base, code: 'customer_facing_no_disclosure', severity: 'medium', status: 'open', resolution_type: null })
    expect(v.path).toBe('handled')
  })
})

describe('deriveFlagView — closed flags', () => {
  it('accept sign-off renders as signed-off with the label + note', () => {
    const v = deriveFlagView({
      ...base,
      code: 'ai_decision_making',
      severity: 'high',
      status: 'resolved',
      resolution_type: 'accept',
      resolution_note: 'LIA completed; advisory only.',
    })
    expect(v.path).toBe('signed-off')
    expect(v.resolutionLabel).toBe('Accepted with justification')
    expect(v.resolutionNote).toMatch(/LIA completed/)
  })

  it('remediate sign-off renders as signed-off with the Remediated label', () => {
    const v = deriveFlagView({
      ...base,
      severity: 'high',
      status: 'resolved',
      resolution_type: 'remediate',
      resolution_note: 'Removed the screening step.',
    })
    expect(v.path).toBe('signed-off')
    expect(v.resolutionLabel).toBe('Remediated')
  })

  it('a handled auto-closed flag is a quiet informational card (no resolution box)', () => {
    const v = deriveFlagView(base)
    expect(v.path).toBe('handled')
    expect(v.resolutionLabel).toBeNull()
  })

  it('a query closure shows a resolution box', () => {
    const v = deriveFlagView({ ...base, code: 'vendor_dpa', severity: 'medium', resolution_type: 'query' })
    expect(v.path).toBe('signed-off')
    expect(v.resolutionLabel).toBe('Queried with the customer')
  })
})

describe('deriveFlagView — old rows (pre-migration-010)', () => {
  it('a null-code open blocking flag still holds (severity fallback)', () => {
    const v = deriveFlagView({ ...base, code: null, severity: 'high', status: 'open', resolution_type: null })
    expect(v.path).toBe('hold')
  })

  it('a null-code open non-blocking flag is handled, never a phantom query', () => {
    const v = deriveFlagView({ ...base, code: null, severity: 'medium', status: 'open', resolution_type: null })
    expect(v.path).toBe('handled')
  })

  it('a null-resolution closed flag (old Mark Resolved) is a quiet handled card', () => {
    const v = deriveFlagView({ ...base, code: null, status: 'resolved', resolution_type: null })
    expect(v.path).toBe('handled')
    expect(v.resolutionLabel).toBeNull()
  })

  it('an acknowledged (overridden) old flag is treated as closed/handled', () => {
    const v = deriveFlagView({ ...base, code: null, status: 'acknowledged', resolution_type: null })
    expect(v.isOpen).toBe(false)
    expect(v.path).toBe('handled')
  })
})

describe('deriveFlagView — title', () => {
  it('takes the first sentence of the explanation, trailing dot trimmed', () => {
    const v = deriveFlagView({
      ...base,
      explanation: 'AI contributes to decisions about individual people. This implicates Article 22.',
    })
    expect(v.title).toBe('AI contributes to decisions about individual people')
  })

  it('uses the whole string when there is a single sentence', () => {
    const v = deriveFlagView({ ...base, explanation: 'No formal owner for AI governance.' })
    expect(v.title).toBe('No formal owner for AI governance')
  })
})

describe('orderFlagViews + summariseFlagViews', () => {
  const flags: FlagRowForView[] = [
    { ...base, id: 'handled1' },
    { ...base, id: 'hold1', code: 'ai_decision_making', severity: 'high', status: 'open', resolution_type: null },
    { ...base, id: 'query1', code: 'vendor_dpa', severity: 'medium', status: 'open', resolution_type: null },
    { ...base, id: 'signed1', code: 'annex_iii_category', severity: 'high', status: 'resolved', resolution_type: 'accept', resolution_note: 'ok' },
  ]
  const views = flags.map(deriveFlagView)

  it('orders hold → query → signed-off → handled', () => {
    const ordered = orderFlagViews(views).map((v) => v.id)
    expect(ordered).toEqual(['hold1', 'query1', 'signed1', 'handled1'])
  })

  it('summarises the counts the header line shows', () => {
    const s = summariseFlagViews(views)
    expect(s.needsYou).toBe(1)
    expect(s.outWithCustomer).toBe(1)
    expect(s.handled).toBe(2) // handled + signed-off
  })
})
