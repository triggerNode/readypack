'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { finaliseOrderPack } from '@/lib/documents/finalise-pack'
import { notifyAdmin } from '@/lib/notifications'
import type { DocumentType } from '@/types/database'

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

    // Block if already approved/delivered — the customer should download
    // their final PDFs, not request more changes.
    if (auth.deliveryStatus === 'approved' || auth.deliveryStatus === 'delivered') {
      return {
        success: false,
        error: 'This pack has already been approved and cannot be revised here. Please contact support.',
      }
    }

    const { error: insertError } = await supabaseAdmin.from('case_revisions').insert({
      order_id: auth.orderId,
      submission_id: auth.submissionId,
      user_id: auth.userId,
      document_types: parsed.data.documentTypes,
      feedback_text: parsed.data.feedbackText,
      kind: 'revision',
      status: 'submitted',
    })
    if (insertError) {
      return { success: false, error: `Could not save your request: ${insertError.message}` }
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

    // Idempotency: a second approval should be a no-op success, not an error.
    if (auth.deliveryStatus === 'delivered' || auth.deliveryStatus === 'approved') {
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
      },
    })

    await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'delivered', updated_at: nowIso })
      .eq('id', auth.orderId)

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
    return { success: true, message: `Your pack is finalised.${partialNote}` }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    }
  }
}
