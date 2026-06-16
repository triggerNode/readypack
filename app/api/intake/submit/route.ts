import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildSubmitConfirmationEmail } from '@/lib/email'
import { notifyAdmin } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

// Maps the stored plan code to its customer-facing display name.
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  solo: 'Solo Pack',
  procurement_ready: 'Procurement-Ready Pack',
  adviser: 'Adviser Pack',
}

type RiskSeverity = 'low' | 'medium' | 'high'
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

type RiskFlag = {
  severity: RiskSeverity
  triggering_answer: string
  explanation: string
  required_action: string
}

const ANNEX_III_CATEGORIES = new Set([
  'Screening or ranking job applications',
  'Assessing creditworthiness or financial eligibility',
  'Deciding on insurance pricing or coverage',
  'Access to healthcare, benefits, or essential services',
  'Assessing students, candidates, or learners',
])

const SPECIAL_CATEGORY_CHIPS = new Set([
  'Health or medical information',
  'Biometric data (e.g. face recognition, fingerprints)',
  'Ethnic or racial data',
  'Political or religious opinions',
  'Sexual orientation or gender identity',
  "Children's data",
])

const CHILDREN_KEY = "Children's data"

type RawAnswers = Record<string, Record<string, unknown> | undefined>

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

function scoreRisk(raw: RawAnswers): { riskLevel: RiskLevel; flags: RiskFlag[] } {
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
  const hasChildrenData = dataCats.includes(CHILDREN_KEY)
  if (specialHits.length > 0) {
    flags.push({
      severity: 'high',
      triggering_answer: `data_categories=${specialHits.join(', ')}`,
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
    (specialHits.length > 0 || hasChildrenData)

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

export async function POST(req: NextRequest) {
  let body: { submissionId?: string }
  try {
    body = (await req.json()) as { submissionId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { submissionId } = body
  if (!submissionId || typeof submissionId !== 'string') {
    return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: submission, error: fetchErr } = await supabase
    .from('intake_submissions')
    .select('id, org_id, order_id, raw_answers, completion_status')
    .eq('id', submissionId)
    .single()
  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }
  if (submission.completion_status === 'submitted') {
    return NextResponse.json({ error: 'Submission already submitted' }, { status: 409 })
  }

  const raw = (submission.raw_answers ?? {}) as RawAnswers

  // Server-side enforcement of the Section 10 declaration. The questionnaire UI
  // gates submission on this checkbox, but the API must not trust the client.
  const s10 = raw['10']
  if (!s10 || s10.declaration_accepted !== true) {
    return NextResponse.json(
      { error: 'You must accept the declaration before submitting.' },
      { status: 400 },
    )
  }

  const { riskLevel, flags } = scoreRisk(raw)

  // Build a flat, canonical view of the answers. The generation pipeline reads
  // normalised_answers (with raw_answers as a fallback); persisting a single-depth
  // structure keeps downstream consumers off the section-nested raw shape.
  // Structured fields (tools, vendors, governance/procurement contacts) stay as
  // nested objects since they are inherently multi-field records.
  const n1 = raw['1'] ?? {}
  const n2 = raw['2'] ?? {}
  const n3 = raw['3'] ?? {}
  const n4 = raw['4'] ?? {}
  const n5 = raw['5'] ?? {}
  const n6 = raw['6'] ?? {}
  const n7 = raw['7'] ?? {}
  const n8 = raw['8'] ?? {}
  const n9 = raw['9'] ?? {}
  const normalised: Record<string, unknown> = {
    // Section 1 — business
    company_name: n1.company_name ?? '',
    trading_name: n1.trading_name ?? '',
    company_number: n1.company_number ?? '',
    sector: n1.sector ?? '',
    sector_other: n1.sector_other ?? '',
    employee_count: n1.employee_count ?? '',
    logo_url: n1.logo_url ?? '',
    // Section 2 — markets & customers
    customer_geography: n2.customer_geography ?? '',
    eu_customer_proportion: n2.eu_customer_proportion ?? '',
    customer_type: n2.customer_type ?? '',
    customer_sectors: n2.customer_sectors ?? [],
    // Section 3 — AI tools (tools is a structured map)
    no_ai_tools: n3.no_ai_tools ?? false,
    tools: n3.tools ?? {},
    custom_tools: n3.custom_tools ?? [],
    // Section 4 — how AI is used
    ai_decision_making: n4.ai_decision_making ?? '',
    ai_decision_categories: n4.ai_decision_categories ?? [],
    ai_decision_categories_other: n4.ai_decision_categories_other ?? '',
    ai_customer_facing: n4.ai_customer_facing ?? '',
    ai_customer_channels: n4.ai_customer_channels ?? [],
    ai_customer_channels_other: n4.ai_customer_channels_other ?? '',
    ai_children_data: n4.ai_children_data ?? '',
    // Section 5 — AI & people
    current_ai_disclosure: n5.current_ai_disclosure ?? '',
    current_disclosure_wording: n5.current_disclosure_wording ?? '',
    ai_opt_out_mechanism: n5.ai_opt_out_mechanism ?? '',
    ai_opt_out_method: n5.ai_opt_out_method ?? '',
    // Section 6 — data & vendors (vendors is a structured array)
    data_categories: n6.data_categories ?? [],
    special_category_basis: n6.special_category_basis ?? '',
    special_category_basis_other: n6.special_category_basis_other ?? '',
    vendors: n6.vendors ?? [],
    // Section 7 — existing documents & governance (contact is a structured object)
    governance_owner: n7.governance_owner ?? '',
    governance_contact: n7.governance_contact ?? {},
    has_ropa: n7.has_ropa ?? '',
    has_dpia: n7.has_dpia ?? '',
    has_ai_policy: n7.has_ai_policy ?? '',
    certifications: n7.certifications ?? [],
    // Section 8 — complaints & incidents
    has_complaints_procedure: n8.has_complaints_procedure ?? '',
    has_past_complaints: n8.has_past_complaints ?? '',
    past_complaint_detail: n8.past_complaint_detail ?? '',
    ico_contact: n8.ico_contact ?? '',
    ico_contact_type: n8.ico_contact_type ?? '',
    // Section 9 — procurement (context & policy owner are structured objects)
    purchase_reason: n9.purchase_reason ?? '',
    purchase_reason_other: n9.purchase_reason_other ?? '',
    procurement_context: n9.procurement_context ?? {},
    procurement_policy_owner: n9.procurement_policy_owner ?? {},
    additional_context: n9.additional_context ?? '',
    // Section 10 — declaration
    declaration_accepted: s10.declaration_accepted === true,
  }

  // Use admin client for the cross-table writes (ai_tools, vendors, risk_flags
  // require service-role for inserts because RLS is restrictive).
  // Update intake_submissions: set status, risk level, and normalised answers.
  const { error: updateErr } = await supabaseAdmin
    .from('intake_submissions')
    .update({
      completion_status: 'submitted',
      risk_level: riskLevel,
      normalised_answers: normalised,
      last_saved: new Date().toISOString(),
    })
    .eq('id', submission.id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Insert ai_tools rows from raw_answers["3"].tools
  const s3 = raw['3']
  const tools = (s3?.['tools'] ?? {}) as Record<string, { selected?: boolean; purposes?: string[]; customer_facing?: string }>
  const aiToolsRows: Array<Record<string, unknown>> = []
  if (s3?.['no_ai_tools'] !== true) {
    for (const [name, detail] of Object.entries(tools)) {
      if (!detail?.selected) continue
      const customerFacing = detail.customer_facing
      const direction =
        customerFacing === 'Yes' ? 'customer_facing'
          : customerFacing === 'Sometimes' ? 'both'
          : customerFacing === 'No' ? 'internal'
          : null
      aiToolsRows.push({
        submission_id: submission.id,
        org_id: submission.org_id,
        tool_name: name,
        purpose: (detail.purposes ?? []).join(', ') || null,
        internal_or_customer_facing: direction,
      })
    }
  }
  if (aiToolsRows.length > 0) {
    const { error: aiErr } = await supabaseAdmin.from('ai_tools').insert(aiToolsRows)
    if (aiErr) {
      console.error('[intake/submit] ai_tools insert failed:', aiErr.message)
    }
  }

  // Insert vendors rows from raw_answers["6"].vendors
  const s6 = raw['6']
  const vendors = Array.isArray(s6?.['vendors']) ? (s6!['vendors'] as Array<Record<string, unknown>>) : []
  const vendorRows: Array<Record<string, unknown>> = []
  for (const v of vendors) {
    if (!v['vendor_name']) continue
    const dpaSigned = v['dpa_signed']
    const dpaStatus =
      dpaSigned === 'Yes' ? 'signed'
        : dpaSigned === 'No' ? 'not_in_place'
        : dpaSigned === 'Not sure' ? 'requested'
        : null
    const certs = Array.isArray(v['certifications']) ? (v['certifications'] as string[]) : null
    vendorRows.push({
      submission_id: submission.id,
      org_id: submission.org_id,
      vendor_name: String(v['vendor_name']),
      jurisdiction: typeof v['hq_location'] === 'string'
        ? (v['hq_location'] === 'Other (specify)' ? (v['hq_location_other'] as string) ?? 'Other' : (v['hq_location'] as string))
        : null,
      dpa_status: dpaStatus,
      transfer_mechanism: typeof v['transfer_mechanism'] === 'string' ? (v['transfer_mechanism'] as string) : null,
      training_data_reuse: v['training_reuse'] === 'Yes' ? true : v['training_reuse'] === 'No' ? false : null,
      security_certifications: certs && certs.length > 0 ? certs : null,
    })
  }
  if (vendorRows.length > 0) {
    const { error: vErr } = await supabaseAdmin.from('vendors').insert(vendorRows)
    if (vErr) {
      console.error('[intake/submit] vendors insert failed:', vErr.message)
    }
  }

  // Insert risk_flags rows
  if (flags.length > 0) {
    const flagRows = flags.map((f) => ({
      submission_id: submission.id,
      org_id: submission.org_id,
      severity: f.severity,
      triggering_answer: f.triggering_answer,
      explanation: f.explanation,
      required_action: f.required_action,
      status: 'open',
    }))
    const { error: rfErr } = await supabaseAdmin.from('risk_flags').insert(flagRows)
    if (rfErr) {
      console.error('[intake/submit] risk_flags insert failed:', rfErr.message)
    }
  }

  // Refine the org's placeholder name ("Customer <id>", set at checkout) to the
  // real company name from the questionnaire. The org name flows onto generated
  // documents, the admin queue, and the portal — so this fixes "Customer <id>"
  // appearing on the actual compliance PDFs. Only overwrite with a genuine name.
  {
    const realCompanyName =
      (typeof n1.company_name === 'string' && n1.company_name.trim()) ||
      (typeof n1.trading_name === 'string' && n1.trading_name.trim()) ||
      ''
    if (realCompanyName && submission.org_id) {
      const { error: orgNameError } = await supabaseAdmin
        .from('organisations')
        .update({ name: realCompanyName })
        .eq('id', submission.org_id)
      if (orgNameError) {
        console.error('[intake/submit] org name refine failed:', orgNameError.message)
      }
    }
  }

  // Notify the admin that a new submission landed (non-blocking).
  {
    const companyName =
      (typeof n1.company_name === 'string' && n1.company_name) ||
      (typeof n1.trading_name === 'string' && n1.trading_name) ||
      user.email ||
      'A customer'
    const safeCompany = String(companyName)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    await notifyAdmin(
      'New submission',
      `<p><strong>${safeCompany}</strong> submitted their questionnaire. Risk level: <strong>${riskLevel}</strong>.</p>`,
    )
  }

  // Send the customer a submission-received confirmation email. Email failure
  // must not fail the submit — log and continue.
  if (user.email) {
    try {
      let planName: string | null = null
      if (submission.order_id) {
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('plan_selected')
          .eq('id', submission.order_id)
          .maybeSingle()
        planName = PLAN_DISPLAY_NAMES[orderRow?.plan_selected ?? ''] ?? null
      }
      const customerName =
        (typeof n1.trading_name === 'string' && n1.trading_name) ||
        (typeof n1.company_name === 'string' && n1.company_name) ||
        null
      const sendResult = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [user.email],
        subject: "We've received your ReadyPack answers",
        html: buildSubmitConfirmationEmail({ customerName, riskLevel, planName }),
      })
      if (sendResult.error) {
        console.error('[intake/submit] confirmation email failed:', sendResult.error.message)
      }
    } catch (emailErr) {
      console.error('[intake/submit] confirmation email threw:', emailErr)
    }
  }

  // Auto-trigger document generation for low/medium risk cases. High/critical
  // cases wait for an admin to review flags and trigger generation manually.
  // Fire-and-forget — we do not await this so the intake submit response is not
  // delayed by the (multi-minute) generation pipeline.
  if ((riskLevel === 'low' || riskLevel === 'medium') && submission.order_id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: submission.order_id, _internal: true }),
    }).catch((err) => console.error('[intake/submit] auto-generation trigger failed:', err))
  }

  return NextResponse.json({ ok: true, riskLevel, submissionId: submission.id })
}
