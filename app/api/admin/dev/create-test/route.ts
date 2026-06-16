import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'olutags@gmail.com'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Plan = 'solo' | 'procurement_ready' | 'adviser'

export async function POST(req: NextRequest) {
  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    prefillTo?: number
    plan?: string
    reset?: boolean
  }
  const prefillTo = typeof body.prefillTo === 'number' ? body.prefillTo : 0
  const plan: Plan = (['solo', 'procurement_ready', 'adviser'] as const).includes(
    body.plan as Plan,
  )
    ? (body.plan as Plan)
    : 'procurement_ready'
  const reset = body.reset !== false

  // 2. Optionally delete existing non-submitted submissions for this user
  if (reset) {
    const { data: oldSubs } = await supabaseAdmin
      .from('intake_submissions')
      .select('id, order_id')
      .eq('user_id', user.id)
      .neq('completion_status', 'submitted')

    if (oldSubs && oldSubs.length > 0) {
      const submissionIds = oldSubs.map((s) => s.id)
      const orderIds = oldSubs.map((s) => s.order_id).filter(Boolean) as string[]

      // Delete in FK dependency order (children before parents).
      // generated_documents, generation_events, document_generation_jobs,
      // customer_communications all reference orders / intake_submissions and
      // were not previously cleaned up by the dev reset.
      if (submissionIds.length > 0) {
        await supabaseAdmin
          .from('generated_documents')
          .delete()
          .in('submission_id', submissionIds)
        await supabaseAdmin
          .from('document_generation_jobs')
          .delete()
          .in('submission_id', submissionIds)
        await supabaseAdmin.from('qa_reports').delete().in('submission_id', submissionIds)
        await supabaseAdmin.from('risk_flags').delete().in('submission_id', submissionIds)
        await supabaseAdmin.from('ai_tools').delete().in('submission_id', submissionIds)
        await supabaseAdmin.from('vendors').delete().in('submission_id', submissionIds)
      }
      if (orderIds.length > 0) {
        await supabaseAdmin.from('generation_events').delete().in('order_id', orderIds)
        await supabaseAdmin.from('customer_communications').delete().in('order_id', orderIds)
      }
      await supabaseAdmin.from('intake_submissions').delete().in('id', submissionIds)

      // Also delete associated test orders (stripe_payment_id IS NULL marks them as dev test records)
      await supabaseAdmin
        .from('orders')
        .delete()
        .eq('user_id', user.id)
        .is('stripe_payment_id', null)
    }
  }

  // 3. Get or create a test organisation for admin user
  const { data: existingMembership } = await supabaseAdmin
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let orgId: string

  if (existingMembership) {
    orgId = existingMembership.org_id
  } else {
    const { data: newOrg, error: orgErr } = await supabaseAdmin
      .from('organisations')
      .insert({
        name: 'Test Organisation (Dev)',
        type: 'direct',
        billing_email: ADMIN_EMAIL,
      })
      .select('id')
      .single()
    if (orgErr || !newOrg) {
      return NextResponse.json(
        { error: 'Failed to create org: ' + orgErr?.message },
        { status: 500 },
      )
    }
    orgId = newOrg.id

    await supabaseAdmin.from('organisation_members').insert({
      org_id: orgId,
      user_id: user.id,
      role: 'owner',
    })
  }

  // 4. Create test order (stripe_payment_id = null marks it as a dev test record)
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: user.id,
      billing_org_id: orgId,
      client_org_id: orgId,
      plan_selected: plan,
      payment_status: 'paid',
      delivery_status: 'pending',
    })
    .select('id')
    .single()
  if (orderErr || !order) {
    return NextResponse.json(
      { error: 'Failed to create order: ' + orderErr?.message },
      { status: 500 },
    )
  }

  // 5. Pre-fill answers if requested
  const rawAnswers = prefillTo > 0 ? buildTestAnswers(prefillTo) : {}
  const sectionCompletion = prefillTo > 0 ? buildTestCompletion(prefillTo) : {}

  // 6. Create intake_submission
  const { data: submission, error: subErr } = await supabaseAdmin
    .from('intake_submissions')
    .insert({
      user_id: user.id,
      order_id: order.id,
      org_id: orgId,
      completion_status: prefillTo >= 10 ? 'in_progress' : 'not_started',
      raw_answers: rawAnswers,
      section_completion: sectionCompletion,
      last_saved: prefillTo > 0 ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (subErr || !submission) {
    return NextResponse.json(
      { error: 'Failed to create submission: ' + subErr?.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, submissionId: submission.id })
}

// ─── Test data helpers ───────────────────────────────────────────

function buildTestAnswers(upToSection: number): Record<string, unknown> {
  const all: Record<string, unknown> = {}

  if (upToSection >= 1)
    all['1'] = {
      company_name: 'Brightfield Digital Ltd',
      trading_name: '',
      company_number: '12345678',
      sector: 'Marketing / advertising',
      employee_count: '10-49',
    }
  if (upToSection >= 2)
    all['2'] = {
      customer_geography: 'uk_eu',
      eu_customer_proportion: '10-25',
      customer_type: 'b2b',
      customer_sectors: ['Technology', 'Professional services'],
    }
  if (upToSection >= 3)
    all['3'] = {
      no_ai_tools: false,
      tools: {
        'ChatGPT / OpenAI': {
          selected: true,
          purposes: ['Content creation / writing', 'Marketing / advertising'],
          customer_facing: 'No',
        },
        'Notion AI': {
          selected: true,
          purposes: ['Internal productivity / admin'],
          customer_facing: 'No',
        },
      },
      custom_tools: [],
    }
  if (upToSection >= 4)
    all['4'] = {
      ai_decision_making: 'No',
      ai_customer_facing: 'No',
      ai_children_data: 'No',
    }
  if (upToSection >= 5)
    all['5'] = {
      current_ai_disclosure: 'No',
      ai_opt_out_mechanism: 'Not applicable',
    }
  if (upToSection >= 6)
    all['6'] = {
      data_categories: ['Names and contact details', 'Browsing or behavioural data'],
      vendors: [
        {
          vendor_name: 'ChatGPT / OpenAI',
          hq_location: 'USA',
          dpa_signed: 'Yes',
          transfer_mechanism: 'Standard Contractual Clauses (SCCs)',
          training_reuse: 'Opt-out available',
          certifications: ['SOC 2 Type II'],
        },
        {
          vendor_name: 'Notion AI',
          hq_location: 'USA',
          dpa_signed: 'Yes',
          transfer_mechanism: 'Standard Contractual Clauses (SCCs)',
          training_reuse: 'No',
          certifications: ['SOC 2 Type II'],
        },
      ],
    }
  if (upToSection >= 7)
    all['7'] = {
      governance_owner: 'internal_owner',
      governance_contact: { name: 'Olu Tayo', job_title: 'Founder', email: ADMIN_EMAIL },
      has_ropa: 'No',
      has_dpia: 'No',
      has_ai_policy: 'No',
      certifications: ['None of these'],
    }
  if (upToSection >= 8)
    all['8'] = {
      has_complaints_procedure: 'No',
      has_past_complaints: 'No',
      ico_contact: 'No',
    }
  if (upToSection >= 9)
    all['9'] = {
      purchase_reason: 'proactive',
      additional_context: 'Test submission created via dev tools.',
    }

  return all
}

function buildTestCompletion(upToSection: number): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (let i = 1; i < upToSection; i++) {
    c[String(i)] = { completed: true, completed_at: new Date().toISOString() }
  }
  return c
}
