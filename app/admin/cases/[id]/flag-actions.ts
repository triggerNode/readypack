'use server'

// Stage 3 flag server actions, split out of ./actions to keep that file under the
// 800-line ceiling. Same conventions as the rest of the case actions: Zod-validated
// input, requireAdmin() re-run per mutation, per-record authorisation, supabaseAdmin
// writes, an audit_events row, and a case UI revalidate. Shared helpers come from
// ./_shared.
//
//   • signOffFlagAction       — sign off a HELD flag (the delivery-gate KEY)
//   • draftFlagQuestionAction  — AI-draft a clarifying question for a 'query' flag
//   • sendFlagQueryAction      — send the (admin-reviewed) query as a flag-linked info-request

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildRequestInfoEmail } from '@/lib/email'
import { isBlockingFlag } from '@/lib/risk/gate'
import { draftClarifyingQuestion } from '@/lib/documents/query-ai'
import { affectedDocForCode } from '@/lib/documents/query-loop'
import type { RiskFlagCode } from '@/lib/risk/score'
import { type ActionResult, UUID, FROM_ADDRESS, loadCase, writeAudit, refreshCaseUi } from './_shared'

// ActionResult is re-exported so the sign-off / query form components can import the
// action and its result type from one place.
export type { ActionResult } from './_shared'

// ─────────────────────────────────────────
// 4b. Sign off a HELD flag — the delivery-gate KEY.
// Records a human decision ON the flag: accept-with-justification or remediate,
// with a required reason (resolution_type + resolution_note + resolved_by +
// resolved_at). This is the ONLY way to close a high/critical flag — the hollow
// markFlagResolved / override paths reject blocking flags. Once every high flag is
// signed off, hasOpenHighRiskFlags clears and the pack can be released.
// ─────────────────────────────────────────
const SignOffSchema = z.object({
  caseId: UUID,
  flagId: UUID,
  decision: z.enum(['accept', 'remediate']),
  note: z.string().trim().min(10, 'Please record a reason (at least 10 characters)').max(4000, 'Reason too long'),
})

export async function signOffFlagAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = SignOffSchema.safeParse({
      caseId: formData.get('caseId'),
      flagId: formData.get('flagId'),
      decision: formData.get('decision'),
      note: formData.get('note'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }
    if (!c.submission_id) return { success: false, error: 'Case has no submission' }

    // Per-record authorisation + gate check: the flag must belong to this case
    // AND still be an OPEN high/critical flag (only held flags are signed off).
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('risk_flags')
      .select('id, submission_id, severity, status')
      .eq('id', parsed.data.flagId)
      .maybeSingle()
    if (flagError) return { success: false, error: flagError.message }
    if (!flag) return { success: false, error: 'Flag not found' }
    if (flag.submission_id !== c.submission_id) {
      return { success: false, error: 'Flag does not belong to this case' }
    }
    if (!isBlockingFlag(flag)) {
      return { success: false, error: 'Only an open high-risk flag can be signed off.' }
    }

    const nowIso = new Date().toISOString()
    // .eq('status','open') makes a concurrent double sign-off a no-op.
    const { error: updateError } = await supabaseAdmin
      .from('risk_flags')
      .update({
        status: 'resolved',
        resolution_type: parsed.data.decision,
        resolution_note: parsed.data.note,
        resolved_by: admin.id,
        resolved_at: nowIso,
      })
      .eq('id', flag.id)
      .eq('status', 'open')
    if (updateError) return { success: false, error: updateError.message }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'flag_signed_off',
      targetType: 'risk_flag',
      targetId: flag.id,
      metadata: { case_id: c.id, decision: parsed.data.decision, note: parsed.data.note },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 11. Query the customer (Stage 3d — the query loop).
// AI-drafts a clarifying question for a 'query' flag so the admin can review/edit
// it before sending. Returns the draft; does NOT send. Never throws to the UI.
// ─────────────────────────────────────────
export type DraftResult =
  | { success: true; question: string }
  | { success: false; error: string }

export async function draftFlagQuestionAction(caseId: string, flagId: string): Promise<DraftResult> {
  try {
    await requireAdmin()
    if (!UUID.safeParse(caseId).success || !UUID.safeParse(flagId).success) {
      return { success: false, error: 'Invalid id' }
    }
    const c = await loadCase(caseId)
    if (!c || !c.submission_id) return { success: false, error: 'Case not found' }
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('risk_flags')
      .select('id, submission_id, code, severity, explanation, required_action, triggering_answer')
      .eq('id', flagId)
      .maybeSingle()
    if (flagError) return { success: false, error: flagError.message }
    if (!flag || flag.submission_id !== c.submission_id) {
      return { success: false, error: 'Flag does not belong to this case' }
    }
    const question = await draftClarifyingQuestion({
      code: ((flag.code as RiskFlagCode) ?? 'vendor_dpa') as RiskFlagCode,
      explanation: flag.explanation,
      requiredAction: flag.required_action ?? '',
      triggeringAnswer: flag.triggering_answer,
    })
    return { success: true, question }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 12. Send the (admin-reviewed) query as a flag-linked info-request.
// Creates an info_requests row carrying risk_flag_id + the affected document, and
// emails the customer via the existing needs-more-info flow. When the customer
// answers, submitInfoRequestAnswerAction folds it back in (foldInAnswer).
// ─────────────────────────────────────────
const SendFlagQuerySchema = z.object({
  caseId: UUID,
  flagId: UUID,
  message: z.string().trim().min(10, 'The question must be at least 10 characters').max(2000, 'Message too long'),
})

export async function sendFlagQueryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = SendFlagQuerySchema.safeParse({
      caseId: formData.get('caseId'),
      flagId: formData.get('flagId'),
      message: formData.get('message'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }
    if (!c.submission_id) return { success: false, error: 'Case has no submission' }
    if (!c.customer_email) {
      return { success: false, error: 'Customer has no email on file — cannot send the query.' }
    }

    // Per-record authorisation: the flag must belong to this case's submission.
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('risk_flags')
      .select('id, submission_id, code, status')
      .eq('id', parsed.data.flagId)
      .maybeSingle()
    if (flagError) return { success: false, error: flagError.message }
    if (!flag || flag.submission_id !== c.submission_id) {
      return { success: false, error: 'Flag does not belong to this case' }
    }
    // Idempotency (closes known edge (a)): only an OPEN flag can be queried, and
    // never stack a second outstanding question on the same flag. Without this a
    // re-click inserts a second flag-linked info_request; each answer then folds in
    // independently (foldInAnswer's lock is per-request, not per-flag), and the
    // later regenerate silently overwrites the earlier one.
    if (flag.status !== 'open') {
      return { success: false, error: 'This flag is already resolved — no query needed.' }
    }
    const { data: outstanding, error: outstandingErr } = await supabaseAdmin
      .from('info_requests')
      .select('id')
      .eq('risk_flag_id', flag.id)
      .in('status', ['open', 'submitted'])
      .limit(1)
    if (outstandingErr) return { success: false, error: outstandingErr.message }
    if (outstanding && outstanding.length > 0) {
      return {
        success: false,
        error: 'A question is already out for this flag — wait for the customer to answer before sending another.',
      }
    }

    const affectedDoc = affectedDocForCode((flag.code ?? null) as RiskFlagCode | null)

    // The info-request carries risk_flag_id so the answer folds back into the flag.
    const { data: infoReq, error: infoErr } = await supabaseAdmin
      .from('info_requests')
      .insert({
        order_id: c.id,
        submission_id: c.submission_id,
        document_type: affectedDoc,
        prompt: parsed.data.message,
        created_by: admin.id,
        status: 'open',
        risk_flag_id: flag.id,
      })
      .select('id')
      .single()
    if (infoErr || !infoReq) {
      return { success: false, error: `Could not save the query: ${infoErr?.message ?? 'unknown error'}` }
    }

    const { error: commsError } = await supabaseAdmin.from('customer_communications').insert({
      order_id: c.id,
      email_type: 'needs_more_info',
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
    })
    if (commsError) return { success: false, error: commsError.message }

    let magicLink: string
    try {
      magicLink = await generateMagicLink(c.customer_email, `/portal/${c.id}`)
    } catch (err) {
      return {
        success: false,
        error: `Could not generate the portal link: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }

    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      replyTo: 'hello@readypack.co.uk',
      to: [c.customer_email],
      subject: 'We need a bit more information for your ReadyPack order',
      html: buildRequestInfoEmail({
        magicLink,
        customerName: c.trading_name || c.company_name || null,
        adminMessage: parsed.data.message,
      }),
    })
    if (sendResult.error) {
      return { success: false, error: `Email send failed: ${sendResult.error.message}` }
    }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'flag_queried',
      targetType: 'risk_flag',
      targetId: flag.id,
      metadata: {
        case_id: c.id,
        info_request_id: infoReq.id,
        document_type: affectedDoc,
        resend_id: sendResult.data?.id ?? null,
      },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}
