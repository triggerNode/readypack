'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildRequestInfoEmail, buildRevisedDocReadyEmail } from '@/lib/email'
import { enqueueGeneration } from '@/lib/documents/generation-queue'
import { regenerateDocumentWithFeedback } from '@/lib/documents/regenerate-document'
import { openHighRiskFlagCount, isBlockingFlag } from '@/lib/risk/gate'
import type { CaseRevisionStatus, DocumentType } from '@/types/database'
import { type ActionResult, UUID, FROM_ADDRESS, loadCase, writeAudit, refreshCaseUi } from './_shared'

// The held-flag sign-off + Stage-3d query actions live in ./flag-actions (keeps this
// file under the 800-line ceiling). ActionResult is re-exported so existing import
// sites (e.g. ActionForms) resolve unchanged.
export type { ActionResult } from './_shared'

const DOC_LABEL: Record<DocumentType, string> = {
  ai_use_statement: 'AI Use Statement',
  privacy_notice_addendum: 'Privacy Notice Addendum',
  ai_risk_register: 'AI Risk Register',
  dpia_lite: 'DPIA-Lite Assessment',
  internal_ai_use_policy: 'Internal AI Use Policy',
  customer_disclosure_snippets: 'Customer Disclosure Snippets',
  vendor_ai_register: 'Vendor AI Register',
  complaints_procedure_pack: 'Complaints Procedure Pack',
  procurement_response_memo: 'Procurement Response Memo',
}

/**
 * Server Actions for the admin case detail page.
 *
 * Every action below:
 *   • parses input via a Zod schema (treat each action as a public API)
 *   • re-runs requireAdmin() — never trusts the layout-level guard for a mutation
 *   • uses supabaseAdmin (service-role) for writes
 *   • revalidates the case detail + cases list paths
 *   • logs an audit_events row for traceability
 *
 * The 5 actions:
 *   1. requestMoreInfoAction
 *   2. escalateCaseAction
 *   3. markFlagResolvedAction
 *   4. overrideAndNoteAction
 *   5. approvePackAction
 *   6. triggerGenerationAction
 *   7. requestInfoEmail is sent from within requestMoreInfoAction
 */

// ActionResult, UUID, FROM_ADDRESS, loadCase, writeAudit, and refreshCaseUi now live
// in ./_shared (imported above) — shared with ./flag-actions.

// ─────────────────────────────────────────
// 1. Request More Info
// Records a customer_communications row + audit_events row with the
// admin's message. The actual outbound email is left as a TODO since
// the customer-facing "needs more info" template isn't built yet —
// the comms row marks intent and gives the email worker something to
// pick up later.
// ─────────────────────────────────────────
const DOCUMENT_TYPE_VALUES = [
  'ai_use_statement',
  'privacy_notice_addendum',
  'ai_risk_register',
  'dpia_lite',
  'internal_ai_use_policy',
  'customer_disclosure_snippets',
  'vendor_ai_register',
  'complaints_procedure_pack',
  'procurement_response_memo',
] as const

const RequestMoreInfoSchema = z.object({
  caseId: UUID,
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
  // Optional: tie the request to a specific document card. Omitted = case-level.
  documentType: z.enum(DOCUMENT_TYPE_VALUES).optional(),
})

export async function requestMoreInfoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    // The header form's default "Whole case" option submits documentType="".
    // Coerce empty string to undefined so z.enum().optional() accepts it (an
    // empty string is not a valid enum member and previously failed validation).
    const documentTypeRaw = formData.get('documentType')
    const documentType =
      typeof documentTypeRaw === 'string' && documentTypeRaw.length > 0 ? documentTypeRaw : undefined
    const parsed = RequestMoreInfoSchema.safeParse({
      caseId: formData.get('caseId'),
      message: formData.get('message'),
      documentType,
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    if (!c.customer_email) {
      return { success: false, error: 'Customer has no email on file — cannot send the request.' }
    }

    // Persist the structured request FIRST — this row is the portal's source of
    // truth for the outstanding item (the email below is only the notification).
    const { data: infoReq, error: infoErr } = await supabaseAdmin
      .from('info_requests')
      .insert({
        order_id: c.id,
        submission_id: c.submission_id,
        document_type: parsed.data.documentType ?? null,
        prompt: parsed.data.message,
        created_by: admin.id,
        status: 'open',
      })
      .select('id')
      .single()
    if (infoErr || !infoReq) {
      return { success: false, error: `Could not save the request: ${infoErr?.message ?? 'unknown error'}` }
    }

    const { error: commsError } = await supabaseAdmin.from('customer_communications').insert({
      order_id: c.id,
      email_type: 'needs_more_info',
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
    })
    if (commsError) return { success: false, error: commsError.message }

    // Send the customer-facing "we need more info" email. We generate a fresh
    // magic link into their portal so they can act on the request immediately.
    const portalPath = `/portal/${c.id}`
    let magicLink: string
    try {
      magicLink = await generateMagicLink(c.customer_email, portalPath)
    } catch (err) {
      return {
        success: false,
        error: `Could not generate the portal link: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }

    const customerName = c.trading_name || c.company_name || null
    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      replyTo: 'hello@readypack.co.uk',
      to: [c.customer_email],
      subject: 'We need a bit more information for your ReadyPack order',
      html: buildRequestInfoEmail({
        magicLink,
        customerName,
        adminMessage: parsed.data.message,
      }),
    })
    if (sendResult.error) {
      return { success: false, error: `Email send failed: ${sendResult.error.message}` }
    }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'request_more_info',
      targetType: 'order',
      targetId: c.id,
      metadata: {
        message: parsed.data.message,
        resend_id: sendResult.data?.id ?? null,
        info_request_id: infoReq.id,
        document_type: parsed.data.documentType ?? null,
      },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 2. Escalate Case
// Flips orders.delivery_status to 'escalated'.
// ─────────────────────────────────────────
const EscalateSchema = z.object({
  caseId: UUID,
  reason: z.string().trim().max(2000, 'Reason too long').optional(),
})

export async function escalateCaseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = EscalateSchema.safeParse({
      caseId: formData.get('caseId'),
      reason: formData.get('reason') ?? undefined,
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'escalated', updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (updateError) return { success: false, error: updateError.message }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'escalation_set',
      targetType: 'order',
      targetId: c.id,
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : {},
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 3. Mark Flag Resolved
// Sets risk_flags.status = 'resolved'. Confirms the flag belongs to this
// case's submission before writing (per-record authorisation).
// ─────────────────────────────────────────
const MarkResolvedSchema = z.object({
  caseId: UUID,
  flagId: UUID,
})

export async function markFlagResolvedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = MarkResolvedSchema.safeParse({
      caseId: formData.get('caseId'),
      flagId: formData.get('flagId'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }
    if (!c.submission_id) return { success: false, error: 'Case has no submission' }

    // Per-record authorisation: the flag must belong to this case's submission.
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
    // High-risk flags gate delivery, so they can only be closed via the recorded
    // sign-off (accept/remediate + reason), never the hollow "Mark resolved".
    if (isBlockingFlag(flag)) {
      return {
        success: false,
        error: 'High-risk flags must be signed off with a recorded decision — use Sign off.',
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('risk_flags')
      .update({ status: 'resolved' })
      .eq('id', flag.id)
    if (updateError) return { success: false, error: updateError.message }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'mark_flag_resolved',
      targetType: 'risk_flag',
      targetId: flag.id,
      metadata: { case_id: c.id },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 4. Override & Note
// Records an admin override decision with a justification note.
// The note is persisted on the audit_events row (metadata.note) — this
// gives the compliance paper trail required: admin identity (admin_user_id),
// timestamp (created_at), and the justification text in metadata. If a
// `flagId` is supplied the override is treated as a per-flag override
// (the flag is marked acknowledged rather than resolved).
// ─────────────────────────────────────────
const OverrideSchema = z.object({
  caseId: UUID,
  flagId: UUID.optional(),
  note: z.string().trim().min(10, 'Justification must be at least 10 characters').max(4000, 'Note too long'),
})

export async function overrideAndNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const flagIdRaw = formData.get('flagId')
    const parsed = OverrideSchema.safeParse({
      caseId: formData.get('caseId'),
      flagId: typeof flagIdRaw === 'string' && flagIdRaw.length > 0 ? flagIdRaw : undefined,
      note: formData.get('note'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    if (parsed.data.flagId) {
      if (!c.submission_id) return { success: false, error: 'Case has no submission' }
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
      // A high-risk flag can only be closed via the recorded sign-off, not a
      // free-text override — keeps one accountable path to clear the gate.
      if (isBlockingFlag(flag)) {
        return {
          success: false,
          error: 'High-risk flags must be signed off with a recorded decision — use Sign off.',
        }
      }
      const { error: updateError } = await supabaseAdmin
        .from('risk_flags')
        .update({ status: 'acknowledged' })
        .eq('id', flag.id)
      if (updateError) return { success: false, error: updateError.message }
    }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'override_decision',
      targetType: parsed.data.flagId ? 'risk_flag' : 'order',
      targetId: parsed.data.flagId ?? c.id,
      metadata: {
        case_id: c.id,
        note: parsed.data.note,
        flag_id: parsed.data.flagId ?? null,
      },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 5. Approve Pack
// Sets orders.delivery_status = 'approved'. Blocked when the case has
// unresolved CRITICAL severity open flags — the admin must resolve or
// override those first. This only approves the pack — sending the delivery
// email is a separate step on the Delivery tab.
// ─────────────────────────────────────────
const ApproveSchema = z.object({
  caseId: UUID,
})

export async function approvePackAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = ApproveSchema.safeParse({ caseId: formData.get('caseId') })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    // Block approval while any high/critical-severity flag is still open.
    // (Flags never reach 'critical' severity, so the cases view's
    // critical_flag_count was always 0 — smoke-test finding #5. Count the real
    // open high-risk flags instead.) Shared with the send-delivery route and the
    // customer finalise paths via lib/risk/gate.ts so every door enforces one rule.
    if (c.submission_id) {
      const blockingFlags = await openHighRiskFlagCount(c.submission_id)
      if (blockingFlags > 0) {
        return {
          success: false,
          error: `Cannot approve: ${blockingFlags} unresolved high-risk flag(s) must be resolved or overridden first.`,
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (updateError) return { success: false, error: updateError.message }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'approve_delivery',
      targetType: 'order',
      targetId: c.id,
      metadata: { plan: c.plan_selected },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 6. Trigger Generation ("Generate Pack")
// Manually kicks off the document generation pipeline for a case whose intake
// has been submitted but not yet generated (e.g. a high/critical-risk case that
// the auto-trigger intentionally skips, or a case that needs a re-run).
// Fires a same-server POST to /api/generate using the _internal trigger path —
// the admin is already authenticated here via requireAdmin().
// ─────────────────────────────────────────
const TriggerGenerationSchema = z.object({
  caseId: UUID,
})

export async function triggerGenerationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin()
    const parsed = TriggerGenerationSchema.safeParse({ caseId: formData.get('caseId') })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    // Durable enqueue: write a `queued` job + best-effort kick. The case detail /
    // generation-queue pages show progress; the Vercel Cron drain is the backstop.
    // (c.id is the order id — the `cases` view is keyed by order id.)
    const result = await enqueueGeneration(c.id)
    if (!result.enqueued && result.reason !== 'already complete') {
      return { success: false, error: `Could not start generation: ${result.reason ?? 'unknown error'}` }
    }

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 8. Resolve Info Request (ST2-4)
// Marks an outstanding info_requests row resolved once the admin has
// processed the customer's answer (e.g. regenerated the affected docs).
// Clears it from the portal's "action needed" surface + the progress screen.
// ─────────────────────────────────────────
const ResolveInfoRequestSchema = z.object({
  caseId: UUID,
  infoRequestId: UUID,
})

export async function resolveInfoRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = ResolveInfoRequestSchema.safeParse({
      caseId: formData.get('caseId'),
      infoRequestId: formData.get('infoRequestId'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    // Per-record authorisation: the request must belong to this case's order.
    const { data: info, error: infoError } = await supabaseAdmin
      .from('info_requests')
      .select('id, order_id')
      .eq('id', parsed.data.infoRequestId)
      .maybeSingle()
    if (infoError) return { success: false, error: infoError.message }
    if (!info) return { success: false, error: 'Info request not found' }
    if (info.order_id !== c.id) {
      return { success: false, error: 'Info request does not belong to this case' }
    }

    const { error: updateError } = await supabaseAdmin
      .from('info_requests')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: admin.id })
      .eq('id', info.id)
    if (updateError) return { success: false, error: updateError.message }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'info_resolved',
      targetType: 'info_request',
      targetId: info.id,
      metadata: { case_id: c.id },
    })

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 9. Regenerate a revision (per-document revision loop)
// Re-runs generation for each document the customer asked to revise, applying
// their feedback. Leaves each as a watermarked draft in 'in_revision'; the
// admin then re-releases it. Moves the revision row to 'in_review'.
// ─────────────────────────────────────────
const RevisionActionSchema = z.object({
  caseId: UUID,
  revisionId: UUID,
})

async function loadRevision(
  caseId: string,
  revisionId: string,
): Promise<
  | {
      ok: true
      orderId: string
      documentTypes: DocumentType[]
      feedback: string | null
      status: CaseRevisionStatus
    }
  | { ok: false; error: string }
> {
  const { data: rev, error } = await supabaseAdmin
    .from('case_revisions')
    .select('id, order_id, document_types, feedback_text, kind, status')
    .eq('id', revisionId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!rev) return { ok: false, error: 'Revision not found' }
  if (rev.order_id !== caseId) return { ok: false, error: 'Revision does not belong to this case' }
  if (rev.kind !== 'revision') return { ok: false, error: 'Not a revision request' }
  const documentTypes = (Array.isArray(rev.document_types) ? rev.document_types : []) as DocumentType[]
  return {
    ok: true,
    orderId: rev.order_id,
    documentTypes,
    feedback: rev.feedback_text,
    status: (rev.status as CaseRevisionStatus | null) ?? 'submitted',
  }
}

export async function regenerateRevisionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = RevisionActionSchema.safeParse({
      caseId: formData.get('caseId'),
      revisionId: formData.get('revisionId'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const rev = await loadRevision(parsed.data.caseId, parsed.data.revisionId)
    if (!rev.ok) return { success: false, error: rev.error }
    if (rev.documentTypes.length === 0) {
      return { success: false, error: 'This revision has no documents to regenerate.' }
    }

    // Regenerate each requested document with the customer's feedback applied.
    const failures: string[] = []
    for (const docType of rev.documentTypes) {
      const result = await regenerateDocumentWithFeedback({
        orderId: rev.orderId,
        documentType: docType,
        feedback: rev.feedback ?? '',
      })
      if (!result.success) failures.push(`${DOC_LABEL[docType]}: ${result.error ?? 'failed'}`)
    }

    if (failures.length === rev.documentTypes.length) {
      return { success: false, error: `Regeneration failed — ${failures.join('; ')}` }
    }

    await supabaseAdmin
      .from('case_revisions')
      .update({ status: 'in_review', updated_at: new Date().toISOString() })
      .eq('id', parsed.data.revisionId)

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'document_revised',
      targetType: 'order',
      targetId: rev.orderId,
      metadata: {
        revision_id: parsed.data.revisionId,
        document_types: rev.documentTypes,
        partial_failures: failures.length > 0 ? failures : undefined,
      },
    })

    refreshCaseUi(parsed.data.caseId)
    return failures.length > 0
      ? { success: false, error: `Some documents failed to regenerate: ${failures.join('; ')}` }
      : { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 10. Re-release a revised document for customer review
// Flips the revised document(s) back to a reviewable draft ('pending'),
// emails the customer a fresh portal link, and marks the revision 'completed'.
// If no documents remain in revision, eases the order back from 'escalated' to
// 'qa_review' (awaiting customer review).
// ─────────────────────────────────────────
export async function releaseRevisionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = RevisionActionSchema.safeParse({
      caseId: formData.get('caseId'),
      revisionId: formData.get('revisionId'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const rev = await loadRevision(parsed.data.caseId, parsed.data.revisionId)
    if (!rev.ok) return { success: false, error: rev.error }
    if (rev.documentTypes.length === 0) {
      return { success: false, error: 'This revision has no documents to re-release.' }
    }
    // 2-step guard: block re-release until Regenerate has run (revision is
    // 'in_review'). Stops an operator re-sending the unchanged draft, and emailing
    // the customer that a "revised" document is ready when nothing was revised.
    if (rev.status !== 'in_review') {
      return {
        success: false,
        error:
          rev.status === 'completed' || rev.status === 'approved'
            ? 'This revision has already been re-released.'
            : 'Regenerate with AI first — the customer must receive the updated document.',
      }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }
    if (!c.customer_email) {
      return { success: false, error: 'Customer has no email on file — cannot notify them.' }
    }
    if (!c.submission_id) return { success: false, error: 'Case has no submission' }

    // Flip the revised documents back to a reviewable draft.
    const { error: docErr } = await supabaseAdmin
      .from('generated_documents')
      .update({ delivery_status: 'pending' })
      .eq('submission_id', c.submission_id)
      .in('document_type', rev.documentTypes)
      .eq('delivery_status', 'in_revision')
    if (docErr) return { success: false, error: `Could not re-release the document(s): ${docErr.message}` }

    // Notify the customer with a fresh portal link.
    const portalPath = `/portal/${rev.orderId}`
    let magicLink: string
    try {
      magicLink = await generateMagicLink(c.customer_email, portalPath)
    } catch (err) {
      return {
        success: false,
        error: `Could not generate the portal link: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }
    const customerName = c.trading_name || c.company_name || null
    const docTitle =
      rev.documentTypes.length === 1
        ? DOC_LABEL[rev.documentTypes[0]]
        : `${rev.documentTypes.length} documents`
    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      replyTo: 'hello@readypack.co.uk',
      to: [c.customer_email],
      subject: 'Your revised ReadyPack document is ready to review',
      html: buildRevisedDocReadyEmail({
        magicLink,
        customerName,
        documentTitle: docTitle,
        packReference: `RP-${rev.orderId.slice(0, 8).toUpperCase()}`,
      }),
    })
    if (sendResult.error) {
      return { success: false, error: `Email send failed: ${sendResult.error.message}` }
    }

    await supabaseAdmin
      .from('case_revisions')
      .update({
        status: 'completed',
        resolved_at: new Date().toISOString(),
        resolved_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.revisionId)

    // If nothing else is in revision, ease the order back to 'qa_review'
    // (awaiting the customer's review) from the 'escalated' state the revision
    // request set. Don't touch an already-delivered order.
    const { count: stillInRevision } = await supabaseAdmin
      .from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', c.submission_id)
      .eq('delivery_status', 'in_revision')
    if ((stillInRevision ?? 0) === 0 && c.delivery_status === 'escalated') {
      await supabaseAdmin
        .from('orders')
        .update({ delivery_status: 'qa_review', updated_at: new Date().toISOString() })
        .eq('id', rev.orderId)
    }

    await writeAudit({
      adminUserId: admin.id,
      actionType: 'revision_released',
      targetType: 'order',
      targetId: rev.orderId,
      metadata: {
        revision_id: parsed.data.revisionId,
        document_types: rev.documentTypes,
        resend_id: sendResult.data?.id ?? null,
      },
    })

    refreshCaseUi(parsed.data.caseId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

