// app/api/admin/dev/rerun-qa/route.ts
// Dev-only: re-trigger the Stage 6 QA layer for an already-generated submission.
// Reads the existing 9 generated_documents.content_json rows and replays QA
// so we can iterate on the Haiku prompt without re-running Stage 5.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runQaChecks } from '@/lib/documents/qa-runner'
import type {
  DocumentType,
  GeneratedDocument,
  Order,
  IntakeSubmission,
} from '@/types/database'
import type { SpecificDocumentContent } from '@/lib/documents/content-schemas'
import type { PromptIntake } from '@/lib/documents/prompts/types'
import { ADMIN_EMAIL } from '@/lib/auth'
import { devToolsBlocked } from '@/lib/dev-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asString(o: Record<string, unknown> | undefined, key: string): string {
  if (!o) return ''
  const v = o[key]
  return typeof v === 'string' ? v : ''
}

function asBool(o: Record<string, unknown> | undefined, key: string): boolean {
  if (!o) return false
  const v = o[key]
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return /^(yes|true|1)$/i.test(v)
  return false
}

export async function POST(req: NextRequest) {
  const blocked = devToolsBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    submission_id?: string
  }
  const submissionId = body.submission_id
  if (!submissionId) {
    return NextResponse.json(
      { error: 'submission_id required' },
      { status: 400 },
    )
  }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('*')
    .eq('id', submissionId)
    .single<IntakeSubmission>()

  if (!submission) {
    return NextResponse.json(
      { error: 'Submission not found' },
      { status: 404 },
    )
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', submission.order_id)
    .single<Order>()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const [aiToolsResult, vendorsResult, riskFlagsResult, orgResult, userResult, generatedResult] =
    await Promise.all([
      supabaseAdmin.from('ai_tools').select('*').eq('submission_id', submission.id),
      supabaseAdmin.from('vendors').select('*').eq('submission_id', submission.id),
      supabaseAdmin.from('risk_flags').select('*').eq('submission_id', submission.id),
      supabaseAdmin
        .from('organisations')
        .select('*')
        .eq('id', order.client_org_id)
        .single(),
      supabaseAdmin.from('users').select('*').eq('id', order.user_id).single(),
      supabaseAdmin
        .from('generated_documents')
        .select('*')
        .eq('submission_id', submission.id),
    ])

  const aiTools = aiToolsResult.data || []
  const vendors = vendorsResult.data || []
  const riskFlags = riskFlagsResult.data || []
  const org = orgResult.data
  const accountUser = userResult.data
  const generated = (generatedResult.data || []) as GeneratedDocument[]

  if (generated.length === 0) {
    return NextResponse.json(
      { error: 'No generated_documents found for submission — run /api/generate first.' },
      { status: 400 },
    )
  }

  const generatedContent: Partial<Record<DocumentType, SpecificDocumentContent>> = {}
  for (const doc of generated) {
    if (doc.content_json) {
      generatedContent[doc.document_type] =
        doc.content_json as unknown as SpecificDocumentContent
    }
  }

  // Reconstruct the same PromptIntake the generation pipeline used.
  const normalised = (submission.normalised_answers || {}) as Record<string, unknown>
  const companyName =
    org?.name || accountUser?.company_name || asString(normalised, 'company_name') || 'Client Company'
  const tradingName =
    accountUser?.trading_name || asString(normalised, 'trading_name') || undefined
  const s1 = (normalised['1'] as Record<string, unknown>) || {}
  const s2 = (normalised['2'] as Record<string, unknown>) || {}
  const s7 = (normalised['7'] as Record<string, unknown>) || {}
  const s9 = (normalised['9'] as Record<string, unknown>) || {}
  const govContact = (s7.governance_contact as Record<string, unknown>) || {}
  const contactName =
    asString(govContact, 'name') ||
    asString(normalised, 'contact_name') ||
    accountUser?.company_name ||
    'Document Owner'
  const contactRole =
    asString(govContact, 'job_title') ||
    asString(normalised, 'contact_role') ||
    'Director'
  const contactEmail =
    asString(govContact, 'email') ||
    asString(normalised, 'contact_email') ||
    accountUser?.email ||
    ''
  const industry = asString(s1, 'sector') || asString(normalised, 'industry') || 'Technology'
  const employeeCount =
    asString(s1, 'employee_count') || asString(normalised, 'employee_count') || '1-10'
  const customerGeo = asString(s2, 'customer_geography')
  const hasEuCustomers = customerGeo.includes('eu') || asBool(normalised, 'has_eu_customers')
  const euRevenuePercentage =
    asString(s2, 'eu_customer_proportion') ||
    asString(normalised, 'eu_revenue_percentage') ||
    undefined
  const orderRecord = order as unknown as Record<string, unknown>
  const tier =
    (typeof orderRecord.plan_selected === 'string' && orderRecord.plan_selected) ||
    (typeof orderRecord.tier === 'string' && orderRecord.tier) ||
    asString(normalised, 'plan_selected') ||
    asString(normalised, 'tier') ||
    'solo'
  const targetTenderContext =
    Object.keys(s9).length > 0 ? s9 : asString(normalised, 'target_tender_context') || undefined
  const today = new Date()
  const preparedDate = today.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const reviewDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const intake: PromptIntake = {
    companyName,
    tradingName,
    industry,
    employeeCount,
    aiTools: aiTools.map((t) => ({
      tool_name: t.tool_name,
      vendor: t.vendor,
      purpose: t.purpose,
      internal_or_customer_facing: t.internal_or_customer_facing,
      risk_classification: t.risk_classification,
      decision_making_role: t.decision_making_role,
      data_involved: t.data_involved,
    })),
    vendors: vendors.map((v) => ({
      vendor_name: v.vendor_name,
      product: v.product,
      processor_controller_role: v.processor_controller_role,
      jurisdiction: v.jurisdiction,
      data_categories: v.data_categories,
      dpa_status: v.dpa_status,
      transfer_mechanism: v.transfer_mechanism,
      training_data_reuse: v.training_data_reuse,
      security_certifications: v.security_certifications,
    })),
    riskFlags: riskFlags.map((f) => ({
      severity: f.severity,
      explanation: f.explanation,
      required_action: f.required_action,
    })),
    hasEuCustomers,
    euRevenuePercentage,
    contactName,
    contactRole,
    contactEmail,
    riskLevel: submission.risk_level || 'low',
    preparedDate,
    reviewDate,
    tier,
    targetTenderContext,
  }

  try {
    const qaResult = await runQaChecks(
      order.id,
      submission.id,
      order.client_org_id,
      intake,
      generatedContent,
    )

    const newQaStatus: 'passed' | 'flagged' =
      qaResult.report.recommended_action === 'approve' ? 'passed' : 'flagged'

    await supabaseAdmin
      .from('generated_documents')
      .update({ qa_status: newQaStatus })
      .eq('submission_id', submission.id)

    if (qaResult.report.human_escalation_required) {
      await supabaseAdmin
        .from('orders')
        .update({ delivery_status: 'escalated', updated_at: new Date().toISOString() })
        .eq('id', order.id)
    }

    return NextResponse.json({
      ok: true,
      qa_report: qaResult.report,
      tokens: {
        prompt: qaResult.prompt_tokens,
        completion: qaResult.completion_tokens,
      },
      cost_usd: qaResult.cost_usd,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'QA run failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    )
  }
}
