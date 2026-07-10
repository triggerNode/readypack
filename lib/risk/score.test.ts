import { describe, it, expect } from 'vitest'
import { scoreRisk, type RawAnswers, type RiskFlagCode } from './score'

// A single fixture that fires all seven deterministic flag rules at once. Used to
// prove (a) every rule now carries a stable `code`, and (b) adding `code` did NOT
// change the scoring output (this scenario must still resolve to 'critical').
const ALL_RULES: RawAnswers = {
  '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50' },
  '4': {
    ai_decision_making: 'Yes',
    ai_decision_categories: ['Screening or ranking job applications'],
    ai_customer_facing: 'Yes',
    ai_children_data: 'Yes',
  },
  '5': { current_ai_disclosure: 'No' },
  '6': {
    data_categories: ['Health or medical information'],
    vendors: [{ vendor_name: 'Acme US', hq_location: 'US', dpa_signed: 'No' }],
  },
  '7': { governance_owner: 'none' },
}

describe('scoreRisk — flag codes (additive, no behaviour change)', () => {
  it('tags every flag with a stable code', () => {
    const { flags } = scoreRisk(ALL_RULES)
    const codes = flags.map((f) => f.code)
    const expected: RiskFlagCode[] = [
      'ai_decision_making',
      'annex_iii_category',
      'special_category',
      'customer_facing_no_disclosure',
      'eu_ai_act_applicability',
      'vendor_dpa',
      'no_governance_owner',
    ]
    // Every rule fired exactly once and each carries its code.
    expect(codes.sort()).toEqual([...expected].sort())
    // No flag is missing a code.
    expect(flags.every((f) => typeof f.code === 'string' && f.code.length > 0)).toBe(true)
  })

  it('still resolves this scenario to critical (scoring unchanged)', () => {
    expect(scoreRisk(ALL_RULES).riskLevel).toBe('critical')
  })

  it('an empty questionnaire is still low risk with no flags', () => {
    const { riskLevel, flags } = scoreRisk({})
    expect(riskLevel).toBe('low')
    expect(flags).toHaveLength(0)
  })
})

// Locks the deterministic level boundaries the delivery gate depends on. These
// exercise pre-existing scoring logic (unchanged by the code addition) so a future
// edit can't silently move a boundary.
describe('scoreRisk — level boundaries', () => {
  it('a single high flag ("Partly" decision-making) is high, not critical', () => {
    const { riskLevel, flags } = scoreRisk({ '4': { ai_decision_making: 'Partly' } })
    expect(riskLevel).toBe('high')
    expect(flags.map((f) => f.code)).toEqual(['ai_decision_making'])
  })

  it('counts children declared only via the s4 question (not the s6 chip)', () => {
    const { riskLevel, flags } = scoreRisk({ '4': { ai_children_data: 'Yes' } })
    expect(flags.map((f) => f.code)).toContain('special_category')
    expect(riskLevel).toBe('high')
  })

  it('needs two medium flags to reach medium; one stays low', () => {
    const oneMedium = scoreRisk({
      '4': { ai_customer_facing: 'Yes' },
      '5': { current_ai_disclosure: 'No' },
    })
    expect(oneMedium.flags.map((f) => f.code)).toEqual(['customer_facing_no_disclosure'])
    expect(oneMedium.riskLevel).toBe('low')

    const twoMedium = scoreRisk({
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50' },
      '4': { ai_customer_facing: 'Yes' },
      '5': { current_ai_disclosure: 'No' },
    })
    expect(twoMedium.flags.map((f) => f.code).sort()).toEqual(
      ['customer_facing_no_disclosure', 'eu_ai_act_applicability'].sort(),
    )
    expect(twoMedium.riskLevel).toBe('medium')
  })
})
