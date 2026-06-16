// lib/documents/content-reuse.ts
// Aggressive content reuse to minimize Claude API costs.
//
// Strategy:
// 1. Hash the "content fingerprint" of a submission's key parameters
//    (industry, AI tools count, risk level, vendor count, has EU customers, etc.)
// 2. Query generated_documents for any prior generation with a matching fingerprint
// 3. If match found: clone the content_json, replace client-specific variables
//    (company name, contact details, dates, logo URL) — zero API cost
// 4. If no match: call Claude API, then store the fingerprint for future reuse
//
// IMPORTANT: This NEVER reuses raw client data. It reuses the GENERIC
// compliance prose that Claude generates. Client-specific details are always swapped.

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { DocumentType } from '@/types/database'
import type { SpecificDocumentContent } from './content-schemas'

export interface ContentFingerprint {
  // Environment is part of the fingerprint so test-generated content can never
  // be reused for production customers (and vice versa), even when every other
  // intake parameter matches.
  env: string
  industry_sector: string
  employee_count_band: string
  ai_tool_count: number
  has_eu_customers: boolean
  risk_level: string
  vendor_count: number
  has_customer_facing_ai: boolean
  has_automated_decisions: boolean
  has_special_category_data: boolean
}

function pickString(o: Record<string, unknown> | undefined, key: string): string {
  if (!o) return ''
  const v = o[key]
  return typeof v === 'string' ? v : ''
}

// Build a fingerprint from intake data
export function buildFingerprint(
  normalised_answers: Record<string, unknown>,
  aiToolCount: number,
  vendorCount: number,
  riskLevel: string,
): ContentFingerprint {
  // normalised_answers may be keyed by section number ("1", "2", …) or by flat
  // attribute names. Handle both shapes defensively.
  const s1 = (normalised_answers['1'] as Record<string, unknown>) || normalised_answers
  const s2 = (normalised_answers['2'] as Record<string, unknown>) || normalised_answers
  const s4 = (normalised_answers['4'] as Record<string, unknown>) || normalised_answers
  const s6 = (normalised_answers['6'] as Record<string, unknown>) || normalised_answers

  const industry =
    pickString(s1, 'sector') ||
    pickString(normalised_answers, 'industry') ||
    'unspecified'
  const employees =
    pickString(s1, 'employee_count') ||
    pickString(normalised_answers, 'employee_count') ||
    'unspecified'

  const customerGeo = pickString(s2, 'customer_geography')
  const hasEu =
    customerGeo.includes('eu') ||
    Boolean(normalised_answers.has_eu_customers) ||
    pickString(normalised_answers, 'has_eu_customers') === 'true'

  const aiCustomerFacing = pickString(s4, 'ai_customer_facing')
  const aiDecisionMaking = pickString(s4, 'ai_decision_making')

  const dataCategories = Array.isArray(s6.data_categories)
    ? (s6.data_categories as unknown[]).map((x) => String(x))
    : []
  const hasSpecial = dataCategories.some((c) =>
    /health|biometric|genetic|sexual|political|religious|trade union|criminal|children/i.test(c),
  )

  const env = process.env.READYPACK_ENV ?? process.env.NODE_ENV ?? 'development'

  return {
    env,
    industry_sector: industry,
    employee_count_band: employees,
    ai_tool_count: aiToolCount,
    has_eu_customers: hasEu,
    risk_level: riskLevel,
    vendor_count: vendorCount,
    has_customer_facing_ai: /yes/i.test(aiCustomerFacing),
    has_automated_decisions: /yes/i.test(aiDecisionMaking),
    has_special_category_data: hasSpecial,
  }
}

// Generate a hash string from a fingerprint for DB lookup
export function fingerprintHash(fp: ContentFingerprint): string {
  // Deterministic JSON serialisation
  const keys = Object.keys(fp).sort()
  const ordered: Record<string, unknown> = {}
  const fpRecord = fp as unknown as Record<string, unknown>
  for (const k of keys) {
    ordered[k] = fpRecord[k]
  }
  const json = JSON.stringify(ordered)
  return createHash('sha256').update(json).digest('hex').substring(0, 16)
}

// Search for a matching prior generation
export async function findReusableContent(
  documentType: DocumentType,
  fingerprintHashValue: string,
): Promise<SpecificDocumentContent | null> {
  const { data, error } = await supabaseAdmin
    .from('generated_documents')
    .select('content_json, render_metadata')
    .eq('document_type', documentType)
    .eq('qa_status', 'passed')
    .not('content_json', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(50)

  if (error || !data) return null

  for (const row of data) {
    const meta = (row.render_metadata || {}) as Record<string, unknown>
    if (meta.fingerprint_hash === fingerprintHashValue && row.content_json) {
      return row.content_json as unknown as SpecificDocumentContent
    }
  }
  return null
}

// Recursively traverse a JSON-safe object and replace occurrences of strings
// with their corresponding values from `replacements`.
export function deepReplacePlaceholders<T>(value: T, replacements: Record<string, string>): T {
  if (typeof value === 'string') {
    let result: string = value
    for (const [placeholder, val] of Object.entries(replacements)) {
      result = result.split(placeholder).join(val || '')
    }
    return result as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepReplacePlaceholders(v, replacements)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepReplacePlaceholders(v, replacements)
    }
    return out as unknown as T
  }
  return value
}

// Clone content_json and replace client-specific variables. Uses the previously
// stored personalisation metadata from the source document to drive replacement.
export function cloneAndPersonalise(
  sourceContent: SpecificDocumentContent,
  sourcePersonalisation: Record<string, string>,
  clientData: {
    companyName: string
    tradingName?: string
    contactEmail: string
    contactName: string
    contactRole: string
    preparedDate: string
    reviewDate: string
  },
): SpecificDocumentContent {
  const cloned = JSON.parse(JSON.stringify(sourceContent)) as SpecificDocumentContent

  const replacements: Record<string, string> = {
    [sourcePersonalisation.companyName]: clientData.companyName,
    [sourcePersonalisation.tradingName || '']: clientData.tradingName || '',
    [sourcePersonalisation.contactName]: clientData.contactName,
    [sourcePersonalisation.contactEmail]: clientData.contactEmail,
    [sourcePersonalisation.contactRole]: clientData.contactRole,
    [sourcePersonalisation.preparedDate]: clientData.preparedDate,
    [sourcePersonalisation.reviewDate]: clientData.reviewDate,
  }

  // Clean empty replacements
  const active: Record<string, string> = {}
  for (const [k, v] of Object.entries(replacements)) {
    if (k && k.trim()) {
      active[k] = v
    }
  }

  const personalised = deepReplacePlaceholders(cloned, active)
  personalised.prepared_for = clientData.companyName
  personalised.prepared_date = clientData.preparedDate
  personalised.review_date = clientData.reviewDate

  return personalised
}
