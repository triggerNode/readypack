// Risk scoring — the single source of truth for how intake answers map to a
// risk level and the flags that drive document generation and admin gating.
//
// Pure and dependency-free so it can be unit-tested without the Next.js / Supabase
// runtime. Consumed by app/api/intake/submit/route.ts.

export type RiskSeverity = 'low' | 'medium' | 'high'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type RiskFlag = {
  severity: RiskSeverity
  triggering_answer: string
  explanation: string
  required_action: string
}

export type RawAnswers = Record<string, Record<string, unknown> | undefined>

export const ANNEX_III_CATEGORIES = new Set([
  'Screening or ranking job applications',
  'Assessing creditworthiness or financial eligibility',
  'Deciding on insurance pricing or coverage',
  'Access to healthcare, benefits, or essential services',
  'Assessing students, candidates, or learners',
])

export const SPECIAL_CATEGORY_CHIPS = new Set([
  'Health or medical information',
  'Biometric data (e.g. face recognition, fingerprints)',
  'Ethnic or racial data',
  'Political or religious opinions',
  'Sexual orientation or gender identity',
  "Children's data",
])

const CHILDREN_KEY = "Children's data"

function arrAt(obj: Record<string, unknown> | undefined, key: string): string[] {
  if (!obj) return []
  const v = obj[key]
  return Array.isArray(v) ? (v as string[]) : []
}

function strAt(obj: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!obj) return undefined
  const v = obj[key]
  return typeof v === 'string' ? v : undefined
}

export function scoreRisk(raw: RawAnswers): { riskLevel: RiskLevel; flags: RiskFlag[] } {
  const flags: RiskFlag[] = []
  const s2 = raw['2']
  const s4 = raw['4']
  const s5 = raw['5']
  const s6 = raw['6']
  const s7 = raw['7']

  const decisionMaking = strAt(s4, 'ai_decision_making')
  if (decisionMaking === 'Yes' || decisionMaking === 'Partly') {
    flags.push({
      severity: 'high',
      triggering_answer: `ai_decision_making=${decisionMaking}`,
      explanation: 'AI contributes to decisions about individual people. This implicates Article 22 UK GDPR and potentially EU AI Act Annex III.',
      required_action: 'Add Article 22 disclosure and DPIA references to the AI Use Statement.',
    })
  }

  const categories = arrAt(s4, 'ai_decision_categories')
  const annexHits = categories.filter((c) => ANNEX_III_CATEGORIES.has(c))
  if (annexHits.length > 0) {
    flags.push({
      severity: 'high',
      triggering_answer: `ai_decision_categories=${annexHits.join(', ')}`,
      explanation: `Selected categories trigger EU AI Act Annex III high-risk classification: ${annexHits.join(', ')}.`,
      required_action: 'Generate EU AI Act high-risk section in the AI Use Statement and DPIA.',
    })
  }

  const dataCats = arrAt(s6, 'data_categories')
  const specialHits = dataCats.filter((c) => SPECIAL_CATEGORY_CHIPS.has(c))
  // Children's data may be declared two ways: the s6 data_categories chip OR the
  // dedicated s4 ai_children_data question. BOTH must feed special-category
  // scoring (decision 2026-06-17, ST2-3) — otherwise a firm that answers "Yes,
  // children's data" in s4 but does not also chip it in s6 escapes the Article 9
  // high flag and the critical escalation. This matters most for edtech.
  const childrenViaS4 = strAt(s4, 'ai_children_data') === 'Yes'
  const hasChildrenData = dataCats.includes(CHILDREN_KEY) || childrenViaS4
  // Special-category signals for the flag message — include children's data even
  // when it was declared only via the s4 answer.
  const specialSignals =
    childrenViaS4 && !specialHits.includes(CHILDREN_KEY)
      ? [...specialHits, CHILDREN_KEY]
      : specialHits
  if (specialSignals.length > 0) {
    flags.push({
      severity: 'high',
      triggering_answer: `special_category=${specialSignals.join(', ')}`,
      explanation: 'Special-category personal data under UK GDPR Article 9 requires explicit lawful basis and stricter safeguards.',
      required_action: 'Add Article 9 lawful basis section to the Privacy Notice Addendum and DPIA.',
    })
  }

  const customerFacingAi = strAt(s4, 'ai_customer_facing') === 'Yes'
  const currentDisclosure = strAt(s5, 'current_ai_disclosure')
  if (customerFacingAi && (!currentDisclosure || currentDisclosure === 'No')) {
    flags.push({
      severity: 'medium',
      triggering_answer: 'customer-facing AI with no disclosure',
      explanation: 'Customer-facing AI without current disclosure creates transparency exposure under UK GDPR Article 13 and emerging regulator guidance.',
      required_action: 'Prioritise Customer Disclosure Snippets and recommend immediate publication.',
    })
  }

  const euGeo = strAt(s2, 'customer_geography')
  const euProp = strAt(s2, 'eu_customer_proportion')
  const euAndProp = (euGeo === 'uk_eu' || euGeo === 'uk_eu_row') && (euProp === '25-50' || euProp === '>50')
  if (euAndProp && customerFacingAi) {
    flags.push({
      severity: 'medium',
      triggering_answer: `eu_proportion=${euProp}, customer-facing AI`,
      explanation: 'EU customer proportion above 25% combined with customer-facing AI raises EU AI Act applicability.',
      required_action: 'Generate EU AI Act compliance section and confirm representative if needed.',
    })
  }

  const vendors = Array.isArray(s6?.['vendors']) ? (s6!['vendors'] as Array<Record<string, unknown>>) : []
  for (const v of vendors) {
    const hq = typeof v['hq_location'] === 'string' ? (v['hq_location'] as string) : undefined
    const dpa = typeof v['dpa_signed'] === 'string' ? (v['dpa_signed'] as string) : undefined
    const nonUkEea = hq && hq !== 'UK' && hq !== 'EU/EEA'
    if (nonUkEea && dpa !== 'Yes') {
      flags.push({
        severity: 'medium',
        triggering_answer: `vendor=${String(v['vendor_name'] ?? 'unknown')}, hq=${hq}, dpa=${dpa ?? 'unknown'}`,
        explanation: 'Non-UK/EEA vendor without confirmed DPA creates international transfer compliance risk.',
        required_action: 'Add to Vendor AI Register with action item: request DPA and transfer mechanism.',
      })
    }
  }

  const governanceOwner = strAt(s7, 'governance_owner')
  if (governanceOwner === 'none') {
    flags.push({
      severity: 'low',
      triggering_answer: 'governance_owner=none',
      explanation: 'No formal owner for data protection / AI governance.',
      required_action: 'Internal AI Use Policy recommends nominating a responsible person.',
    })
  }

  // Compute level
  const highFlags = flags.filter((f) => f.severity === 'high')
  const mediumFlags = flags.filter((f) => f.severity === 'medium')
  const criticalTrigger =
    highFlags.length >= 2 &&
    annexHits.length > 0 &&
    (specialSignals.length > 0 || hasChildrenData)

  let riskLevel: RiskLevel
  if (criticalTrigger) {
    riskLevel = 'critical'
  } else if (highFlags.length > 0) {
    riskLevel = 'high'
  } else if (mediumFlags.length >= 2) {
    riskLevel = 'medium'
  } else {
    riskLevel = 'low'
  }

  return { riskLevel, flags }
}
