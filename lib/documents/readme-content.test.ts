import { describe, it, expect } from 'vitest'
import { buildReadme, type ReadmeFlagInput } from './readme-content'

const company = 'Brightfield Digital Ltd'

describe('buildReadme', () => {
  it('renders one item per flag code, in the fixed order', () => {
    const flags: ReadmeFlagInput[] = [
      { code: 'vendor_dpa', resolutionType: null },
      { code: 'annex_iii_category', resolutionType: 'accept' },
      { code: 'customer_facing_no_disclosure', resolutionType: 'handled' },
    ]
    const m = buildReadme({ companyName: company, flags, hasOpenQuery: false })
    // annex_iii first (fixed order), then customer_facing, then vendor_dpa last.
    expect(m.items.map((i) => i.fact[0])).toEqual([
      'Y', // annex_iii_category: "You use AI in a decision…"
      'Y', // customer_facing: "You use AI in ways…"
      'S', // vendor_dpa: "Some of the AI tools…"
    ])
    expect(m.items).toHaveLength(3)
  })

  it('deduplicates multiple flags of the same code (e.g. several non-UK vendors)', () => {
    const flags: ReadmeFlagInput[] = [
      { code: 'vendor_dpa', resolutionType: null },
      { code: 'vendor_dpa', resolutionType: null },
      { code: 'vendor_dpa', resolutionType: null },
    ]
    const m = buildReadme({ companyName: company, flags, hasOpenQuery: false })
    expect(m.items).toHaveLength(1)
  })

  it('picks the accept cover for a held flag accepted with justification', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: 'annex_iii_category', resolutionType: 'accept' }],
      hasOpenQuery: false,
    })
    expect(m.items[0].cover).toMatch(/records the lawful basis/i)
  })

  it('picks the remediate cover for a held flag that was remediated', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: 'annex_iii_category', resolutionType: 'remediate' }],
      hasOpenQuery: false,
    })
    expect(m.items[0].cover).toMatch(/following our review/i)
  })

  it('defaults a held flag with no recorded decision to the accept wording', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: 'special_category', resolutionType: null }],
      hasOpenQuery: false,
    })
    expect(m.items[0].cover).toMatch(/sets out the specific lawful basis/i)
  })

  it('maps refs to their document number + title', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: 'no_governance_owner', resolutionType: 'handled' }],
      hasOpenQuery: false,
    })
    expect(m.items[0].refs).toEqual([{ num: '05', title: 'Internal AI Use Policy' }])
  })

  it('includes the portal note only when a query is open', () => {
    const withQuery = buildReadme({
      companyName: company,
      flags: [{ code: 'vendor_dpa', resolutionType: null }],
      hasOpenQuery: true,
    })
    expect(withQuery.portalNote).toMatch(/review portal/i)

    const without = buildReadme({
      companyName: company,
      flags: [{ code: 'vendor_dpa', resolutionType: null }],
      hasOpenQuery: false,
    })
    expect(without.portalNote).toBeNull()
  })

  it('skips null-code and unknown-code flags (old rows)', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: null, resolutionType: null }],
      hasOpenQuery: false,
    })
    expect(m.items).toHaveLength(0)
  })

  it('gives a reassuring lead and no items when nothing was flagged', () => {
    const m = buildReadme({ companyName: company, flags: [], hasOpenQuery: false })
    expect(m.items).toHaveLength(0)
    expect(m.lead).toMatch(/nothing in your setup raised a specific flag/i)
  })

  it('personalises the lead with the company name when there are items', () => {
    const m = buildReadme({
      companyName: company,
      flags: [{ code: 'vendor_dpa', resolutionType: null }],
      hasOpenQuery: false,
    })
    expect(m.lead).toContain(company)
    expect(m.guardrail).toMatch(/we don’t invent findings/i)
  })
})
