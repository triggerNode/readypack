import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildSubmitConfirmationEmail } from '@/lib/email'
import { notifyAdmin } from '@/lib/notifications'
import { scoreRisk, type RawAnswers } from '@/lib/risk/score'
import { isHandledAtIntake } from '@/lib/risk/resolution'
import { enqueueGeneration } from '@/lib/documents/generation-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The HTTP response returns immediately; this only bounds the background
// lifetime of the waitUntil-kept generation kick (kickWorker). The worker claims
// its job within the first couple of seconds and runs as its own 800s
// invocation, so a 60s ceiling here is ample to guarantee delivery without
// billing this instance for the full multi-minute pipeline.
export const maxDuration = 60

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

// Maps the stored plan code to its customer-facing display name.
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  solo: 'Solo Pack',
  procurement_ready: 'Procurement-Ready Pack',
  adviser: 'Adviser Pack',
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

  // Insert risk_flags rows. Persist the deterministic `code` (stable rule identity)
  // and auto-close the no-action ("handled") flags at intake: most flags are already
  // addressed by the pack, so closing them here keeps the admin surface to a short
  // "needs a human" list instead of a wall of resolve/resolve. Query (customer gap)
  // and hold (high-risk sign-off) flags stay open for the admin/customer flow.
  // scoreRisk stays pure — the handled/query/hold classification happens here.
  if (flags.length > 0) {
    const nowIso = new Date().toISOString()
    const flagRows = flags.map((f) => {
      const handled = isHandledAtIntake(f)
      return {
        submission_id: submission.id,
        org_id: submission.org_id,
        code: f.code,
        severity: f.severity,
        triggering_answer: f.triggering_answer,
        explanation: f.explanation,
        required_action: f.required_action,
        status: handled ? 'resolved' : 'open',
        resolution_type: handled ? 'handled' : null,
        // resolved_by stays NULL — closed automatically by the system, not a person.
        resolved_at: handled ? nowIso : null,
      }
    })
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
      // Link to the unified customer portal (progress tracker + documents on one
      // page) — except for critical cases, where a specialist makes contact first
      // and there is no live progress to show.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const statusUrl =
        riskLevel !== 'critical' && submission.order_id
          ? `${appUrl}/portal/${submission.order_id}`
          : null
      const sendResult = await resend.emails.send({
        from: FROM_ADDRESS,
        replyTo: 'hello@readypack.co.uk',
        to: [user.email],
        subject: "We've received your ReadyPack answers",
        html: buildSubmitConfirmationEmail({ customerName, riskLevel, planName, statusUrl }),
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
  // Durable enqueue (not fire-and-forget): write a `queued` generation job and
  // best-effort kick the worker. The Vercel Cron drain is the backstop if the
  // kick never lands. enqueueGeneration is fast (a few queries + a non-blocking
  // kick), so awaiting it just guarantees the durable job row is written before
  // we respond — it does NOT wait on the multi-minute pipeline.
  if ((riskLevel === 'low' || riskLevel === 'medium') && submission.order_id) {
    await enqueueGeneration(submission.order_id).catch((err) =>
      console.error('[intake/submit] enqueue failed:', err),
    )
  }

  return NextResponse.json({
    ok: true,
    riskLevel,
    submissionId: submission.id,
    orderId: submission.order_id ?? null,
  })
}
