import { describe, it, expect } from 'vitest'
import { classifyFlag, resolutionLabel, type FlagClosurePath } from './resolution'
import type { RiskFlagCode } from './score'

describe('classifyFlag — how a flag closes', () => {
  it('HELDs any high-severity flag for a human sign-off, regardless of rule', () => {
    const highCodes: RiskFlagCode[] = ['ai_decision_making', 'annex_iii_category', 'special_category']
    for (const code of highCodes) {
      expect(classifyFlag({ code, severity: 'high' })).toBe<FlagClosurePath>('hold')
    }
  })

  it('QUERYs the customer for the vendor-DPA gap', () => {
    expect(classifyFlag({ code: 'vendor_dpa', severity: 'medium' })).toBe<FlagClosurePath>('query')
  })

  it('marks every other flag as HANDLED by the pack (no admin action)', () => {
    expect(classifyFlag({ code: 'customer_facing_no_disclosure', severity: 'medium' })).toBe('handled')
    expect(classifyFlag({ code: 'eu_ai_act_applicability', severity: 'medium' })).toBe('handled')
    expect(classifyFlag({ code: 'no_governance_owner', severity: 'low' })).toBe('handled')
  })

  it('prioritises HELD over QUERY if a vendor rule ever escalated to high', () => {
    // Defensive: vendor_dpa is always medium today, but a human sign-off must win
    // if the severity is ever high — a held flag must never be downgraded to a query.
    expect(classifyFlag({ code: 'vendor_dpa', severity: 'high' })).toBe('hold')
  })

  it('HELDs a critical-severity flag too (never auto-closes at intake)', () => {
    // scoreRisk never emits per-flag 'critical' today, but the DB severity union
    // includes it — a critical flag must be held, not handled/queried.
    expect(classifyFlag({ code: 'special_category', severity: 'critical' })).toBe('hold')
    expect(classifyFlag({ code: 'vendor_dpa', severity: 'critical' })).toBe('hold')
  })
})

describe('resolutionLabel', () => {
  it('maps each resolution type to a human label', () => {
    expect(resolutionLabel('handled')).toBe('Handled by the pack')
    expect(resolutionLabel('query')).toBe('Queried with the customer')
    expect(resolutionLabel('accept')).toBe('Accepted with justification')
    expect(resolutionLabel('remediate')).toBe('Remediated')
  })
})
