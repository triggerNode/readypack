'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { finaliseDocument, finaliseOrderPack } from '@/lib/documents/finalise-pack'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { resend } from '@/lib/resend'
import { buildPackCompleteEmail } from '@/lib/email'
import { notifyAdmin } from '@/lib/notifications'
import type { DocumentType } from '@/types/database'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

function packReferenceForOrder(orderId: string): string {
  return `RP-${orderId.slice(0, 8).toUpperCase()}`
}

// Best-effort "your pack is complete" email once every document is final.
// Never throws into the action — the in-app result is the source of truth;
// the email is a courtesy notification.
async function sendPackCompleteEmail(orderId: string): Promise<void> {
  try {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('user_id, display_reference')
      .eq('id', orderId)
      .maybeSingle()
    if (!order?.user_id) return
    const { data: customer } = await supabaseAdmin
      .from('users')
      .select('email, company_name, trading_name')
      .eq('id', order.user_id)
      .maybeSingle()
    if (!customer?.email) return
    const { count } = await supabaseAdmin
      .from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id',
        (await supabaseAdmin.from('intake_submissions').select('id').eq('order_id', orderId).maybeSingle())
          .data?.id ?? '00000000-0000-0000-0000-000000000000',
      )
    const magicLink = await generateMagicLink(customer.email, `/portal/${orderId}`)
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customer.email],
      subject: 'Your ReadyPack compliance pack is complete',
      html: buildPackCompleteEmail({
        magicLink,
        customerName: customer.trading_name || customer.company_name || null,
        packReference: order.display_reference ?? packReferenceForOrder(orderId),
        documentCount: count ?? 9,
      }),
    })
  } catch {
    // swallow — courtesy email failure must not fail the approval
  }
}

/**
 * Customer Portal Server Actions
 *
 * Two mutations:
 *   1. submitRevisionAction — customer requests changes to N specific docs
 *   2. approvePackAction    — customer approves the whole pack, triggering
 *                             a watermark-free re-render of all PDFs.
 *
 * Both actions:
 *   • run under the customer's session (RLS-enforced) for the auth check
 *   • re-derive ownership server-side (never trust the client)
 *   • use supabaseAdmin for writes that need to bypass RLS (e.g. transition
 *     the order status, write audit log)
 */

const UUID = z.string().uuid('Invalid id')

const DOCUMENT_TYPES = [
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

const DocumentTypeSchema = z.enum(DOCUMENT_TYPES)

export type PortalActionResult =
  | { success: true; message?: string }
  | { success: false; error: string }

async function requireCustomerOwner(orderId: string): Promise<
  | { ok: true; userId: string; submissionId: string | null; orderId: string; deliveryStatus: string }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in to perform this action.', status: 401 }
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status')
    .eq('id', orderId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!order) return { ok: false, error: 'Pack not found.', status: 404 }
  if (order.user_id !== user.id) {
    return { ok: false, error: 'You do not have access to this pack.', status: 403 }
  }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

  return {
    ok: true,
    userId: user.id,
    submissionId: submission?.id ?? null,
    orderId: order.id,
    deliveryStatus: order.delivery_status,
  }
}

// ─────────────────────────────────────────
// 1. Submit revision request
// Writes a case_revisions row scoped to the documents the customer
// selected, transitions the order to 'escalated' (admin must re-review
// before delivery), and creates an audit trail.
// ─────────────────────────────────────────
const RevisionSchema = z.object({
  orderId: UUID,
  documentTypes: z.array(DocumentTypeSchema).min(1, 'Select at least one document'),
  feedbackText: z
    .string()
    .trim()
    .min(10, 'Please describe what needs changing (min. 10 characters)')
    .max(4000, 'Feedback is too long (max 4000 characters)'),
})

export async function submitRevisionAction(input: {
  orderId: string
  documentTypes: DocumentType[]
  feedbackText: string
}): Promise<PortalActionResult> {
  try {
    const parsed = RevisionSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const auth = await requireCustomerOwner(parsed.data.orderId)
    if (!auth.ok) return { success: false, error: auth.error }

    // Block only once the pack is finalised ('delivered') — at that point the
    // customer should download their final PDFs, not request more changes.
    if (auth.deliveryStatus === 'delivered') {
      return {
        success: false,
        error: 'This pack has already been finalised and cannot be revised here. Please contact support.',
      }
    }

    // Consistency safeguard (build-spec §6): the 9 documents share facts (dates,
    // AI tool names, risk decisions). A revision that changes a shared fact can
    // leave an ALREADY-FINAL document stale. We can't know what will change until
    // the admin regenerates, so we conservatively record which documents are
    // already final (and not themselves being revised) so the admin Revisions
    // surface can flag them for a re-check. Inform, don't block.
    let consistencyAffected: string[] = []
    if (auth.submissionId) {
      const { data: finalDocs } = await supabaseAdmin
        .from('generated_documents')
        .select('document_type')
        .eq('submission_id', auth.submissionId)
        .eq('delivery_status', 'delivered')
      consistencyAffected = ((finalDocs ?? []) as Array<{ document_type: string }>)
        .map((d) => d.document_type)
        .filter((t) => !parsed.data.documentTypes.includes(t as DocumentType))
    }

    const { error: insertError } = await supabaseAdmin.from('case_revisions').insert({
      order_id: auth.orderId,
      submission_id: auth.submissionId,
      user_id: auth.userId,
      document_types: parsed.data.documentTypes,
      feedback_text: parsed.data.feedbackText,
      kind: 'revision',
      status: 'submitted',
      metadata: { consistency_affected: consistencyAffected },
    })
    if (insertError) {
      return { success: false, error: `Could not save your request: ${insertError.message}` }
    }

    // Move the affected documents into the 'in_revision' state so the portal
    // stops offering Approve/Download on them (fixes the §3 bug where a customer
    // could request a change then "Approve all" and silently discard it).
    if (auth.submissionId) {
      const { error: docErr } = await supabaseAdmin
        .from('generated_documents')
        .update({ delivery_status: 'in_revision' })
        .eq('submission_id', auth.submissionId)
        .in('document_type', parsed.data.documentTypes)
      if (docErr) {
        return { success: false, error: `Could not flag the documents for revision: ${docErr.message}` }
      }
    }

    // Escalate to admin queue so the case is visibly flagged.
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'escalated', updated_at: new Date().toISOString() })
      .eq('id', auth.orderId)
    if (orderError) {
      return { success: false, error: orderError.message }
    }

    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: null,
      action_type: 'customer_revision_requested',
      target_type: 'order',
      target_id: auth.orderId,
      metadata: {
        customer_user_id: auth.userId,
        document_types: parsed.data.documentTypes,
        feedback_length: parsed.data.feedbackText.length,
      },
    })

    await notifyAdmin(
      'Revision requested',
      `<p>Customer requested revisions on order <strong>${auth.orderId}</strong>.</p>
       <p>Documents: ${parsed.data.documentTypes.join(', ')}</p>`,
    )

    revalidatePath(`/portal/${auth.orderId}`)
    revalidatePath(`/admin/cases/${auth.orderId}`)
    revalidatePath('/admin')

    return {
      success: true,
      message: 'Your feedback has been received. Your reviewer will be in touch shortly.',
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    }
  }
}

// ─────────────────────────────────────────
// 2. Approve pack
// Records the approval, kicks off a watermark-free re-render of every
// document in the pack, and transitions the order to 'delivered'.
//
// We intentionally do the re-render inline. The renderer is fast enough
// (sub-second per document on react-pdf) for the customer to wait through
// the "Finalising your pack" overlay. If a future product decision moves
// generation to a worker, swap this for a job enqueue + the UI already
// supports polling.
// ─────────────────────────────────────────
const ApproveSchema = z.object({
  orderId: UUID,
})

export async function approvePackAction(input: {
  orderId: string
}): Promise<PortalActionResult> {
  try {
    const parsed = ApproveSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const auth = await requireCustomerOwner(parsed.data.orderId)
    if (!auth.ok) return { success: false, error: auth.error }

    // Idempotency: only a finalised pack ('delivered') is a no-op. Any earlier
    // state (incl. a stale 'approved') still needs finalising — the customer's
    // approval is what removes the watermarks.
    if (auth.deliveryStatus === 'delivered') {
      return { success: true, message: 'Your pack is already finalised.' }
    }

    const result = await finaliseOrderPack(auth.orderId)

    if (result.succeeded === 0) {
      return {
        success: false,
        error:
          result.failed[0]?.error ??
          'No documents were available to finalise. Please contact support.',
      }
    }

    const nowIso = new Date().toISOString()

    await supabaseAdmin.from('case_revisions').insert({
      order_id: auth.orderId,
      submission_id: auth.submissionId,
      user_id: auth.userId,
      document_types: [],
      feedback_text: null,
      kind: 'approval',
      status: 'approved',
      resolved_at: nowIso,
      resolved_by: auth.userId,
      metadata: {
        documents_finalised: result.succeeded,
        documents_failed: result.failed.length,
        all_final: result.allFinal,
      },
    })

    // The order roll-up to 'delivered' is handled inside finaliseOrderPack
    // (only once EVERY document is final). When some are still in revision the
    // order stays escalated/qa_review until those complete.
    if (result.allFinal) {
      await sendPackCompleteEmail(auth.orderId)
    }

    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: null,
      action_type: 'customer_pack_approved',
      target_type: 'order',
      target_id: auth.orderId,
      metadata: {
        customer_user_id: auth.userId,
        documents_finalised: result.succeeded,
        documents_failed: result.failed.length,
        partial: result.failed.length > 0,
      },
    })

    revalidatePath(`/portal/${auth.orderId}`)
    revalidatePath(`/admin/cases/${auth.orderId}`)
    revalidatePath('/admin')

    const partialNote =
      result.failed.length > 0
        ? ` (${result.failed.length} document(s) need attention — we'll follow up shortly).`
        : ''
    const message = result.allFinal
      ? `Your pack is finalised.${partialNote}`
      : `Your ready documents are finalised and downloadable. Documents still in revision will be ready to approve once we've made your changes.${partialNote}`
    return { success: true, message }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    }
  }
}

// ─────────────────────────────────────────
// 2b. Approve a SINGLE document (per-document approval)
// Finalises just one document (watermark off → downloadable) while the rest
// of the pack stays in its own state. Rolls the order up to 'delivered' only
// once every document is final (handled inside finaliseDocument).
// ─────────────────────────────────────────
const ApproveDocSchema = z.object({
  orderId: UUID,
  documentType: DocumentTypeSchema,
})

export async function approveDocumentAction(input: {
  orderId: string
  documentType: DocumentType
}): Promise<PortalActionResult> {
  try {
    const parsed = ApproveDocSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const auth = await requireCustomerOwner(parsed.data.orderId)
    if (!auth.ok) return { success: false, error: auth.error }
    if (!auth.submissionId) {
      return { success: false, error: 'No documents found for this pack.' }
    }

    // Find the single document by type for this pack.
    const { data: doc, error: docError } = await supabaseAdmin
      .from('generated_documents')
      .select('id, delivery_status')
      .eq('submission_id', auth.submissionId)
      .eq('document_type', parsed.data.documentType)
      .maybeSingle()
    if (docError) return { success: false, error: docError.message }
    if (!doc) return { success: false, error: 'That document was not found.' }

    if (doc.delivery_status === 'delivered') {
      return { success: true, message: 'That document is already finalised.' }
    }
    if (doc.delivery_status === 'in_revision') {
      return {
        success: false,
        error: "That document is being revised — you'll be able to approve it once we re-release it.",
      }
    }

    const result = await finaliseDocument(doc.id)
    if (result.succeeded === 0) {
      return {
        success: false,
        error: result.failed[0]?.error ?? 'Could not finalise that document. Please contact support.',
      }
    }

    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: null,
      action_type: 'customer_document_approved',
      target_type: 'order',
      target_id: auth.orderId,
      metadata: { customer_user_id: auth.userId, document_type: parsed.data.documentType, all_final: result.allFinal },
    })

    if (result.allFinal) {
      await sendPackCompleteEmail(auth.orderId)
    }

    revalidatePath(`/portal/${auth.orderId}`)
    revalidatePath(`/admin/cases/${auth.orderId}`)
    revalidatePath('/admin')

    return {
      success: true,
      message: result.allFinal
        ? 'Document approved — your full pack is now complete.'
        : 'Document approved and ready to download.',
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}

// ─────────────────────────────────────────
// 3. Submit an answer to an information request (ST2-4)
// The structured response path the portal was missing: the customer
// answers one outstanding `info_requests` item. Moves it open → submitted
// and re-notifies the admin. Returns whether any items remain open so the
// portal can show "a couple more to go" vs the final "we're reviewing" state.
// ─────────────────────────────────────────
const InfoAnswerSchema = z
  .object({
    orderId: UUID,
    infoRequestId: UUID,
    answerText: z.string().trim().max(4000, 'Answer is too long (max 4000 characters)').optional(),
    answerSelections: z.array(z.string().trim().max(200)).max(50).optional(),
  })
  .refine(
    (d) => (d.answerText?.length ?? 0) > 0 || (d.answerSelections?.length ?? 0) > 0,
    { message: 'Please provide an answer before submitting.' },
  )

export async function submitInfoRequestAnswerAction(input: {
  orderId: string
  infoRequestId: string
  answerText?: string
  answerSelections?: string[]
}): Promise<PortalActionResult & { remainingOpen?: number }> {
  try {
    const parsed = InfoAnswerSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const auth = await requireCustomerOwner(parsed.data.orderId)
    if (!auth.ok) return { success: false, error: auth.error }

    // The request must belong to this customer's order and still be open.
    const { data: info, error: infoError } = await supabaseAdmin
      .from('info_requests')
      .select('id, order_id, status')
      .eq('id', parsed.data.infoRequestId)
      .maybeSingle()
    if (infoError) return { success: false, error: infoError.message }
    if (!info || info.order_id !== auth.orderId) {
      return { success: false, error: 'That request was not found for this pack.' }
    }
    if (info.status !== 'open') {
      return { success: false, error: 'This question has already been answered.' }
    }

    const nowIso = new Date().toISOString()
    // The .eq('status','open') guard makes a concurrent double-submit a no-op.
    const { error: updateError } = await supabaseAdmin
      .from('info_requests')
      .update({
        answer_text: parsed.data.answerText ?? null,
        answer_selections: parsed.data.answerSelections ?? [],
        status: 'submitted',
        answered_at: nowIso,
        answered_by: auth.userId,
      })
      .eq('id', info.id)
      .eq('status', 'open')
    if (updateError) {
      return { success: false, error: `Could not save your answer: ${updateError.message}` }
    }

    await supabaseAdmin.from('audit_events').insert({
      admin_user_id: null,
      action_type: 'info_answered',
      target_type: 'info_request',
      target_id: info.id,
      metadata: { customer_user_id: auth.userId, order_id: auth.orderId },
    })

    // How many items remain open? Drives the portal's "all done" confirmation.
    const { count: remaining } = await supabaseAdmin
      .from('info_requests')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', auth.orderId)
      .eq('status', 'open')
    const remainingOpen = remaining ?? 0

    await notifyAdmin(
      'Customer answered an information request',
      `<p>The customer answered an outstanding question on order <strong>${auth.orderId}</strong>.</p>
       <p>${
         remainingOpen > 0
           ? `${remainingOpen} item(s) still outstanding.`
           : 'All outstanding items are now answered — ready for review.'
       }</p>`,
    )

    revalidatePath(`/portal/${auth.orderId}`)
    revalidatePath(`/admin/cases/${auth.orderId}`)
    revalidatePath('/admin')

    return {
      success: true,
      remainingOpen,
      message:
        remainingOpen > 0
          ? 'Thanks — saved. Just a couple more to go.'
          : "Thanks — that's everything. Our compliance team is reviewing your answers and we'll be in touch.",
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    }
  }
}
