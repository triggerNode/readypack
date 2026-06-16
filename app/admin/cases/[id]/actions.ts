'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildRequestInfoEmail } from '@/lib/email'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

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

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

const UUID = z.string().uuid('Invalid id')

async function loadCase(caseId: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('id, submission_id, status, critical_flag_count, customer_email, company_name, trading_name, plan_selected, delivery_status')
    .eq('id', caseId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function writeAudit(input: {
  adminUserId: string
  actionType:
    | 'request_more_info'
    | 'escalation_set'
    | 'mark_flag_resolved'
    | 'override_decision'
    | 'approve_delivery'
  targetType: 'order' | 'risk_flag' | 'submission'
  targetId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_events').insert({
    admin_user_id: input.adminUserId,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId,
    metadata: input.metadata ?? {},
  })
  if (error) {
    // Audit-log failure should not silently succeed an admin mutation —
    // surface it to the caller so the UI shows an error and the admin retries.
    throw new Error(`Audit log write failed: ${error.message}`)
  }
}

function refreshCaseUi(caseId: string): void {
  revalidatePath('/admin')
  revalidatePath(`/admin/cases/${caseId}`)
}

// ─────────────────────────────────────────
// 1. Request More Info
// Records a customer_communications row + audit_events row with the
// admin's message. The actual outbound email is left as a TODO since
// the customer-facing "needs more info" template isn't built yet —
// the comms row marks intent and gives the email worker something to
// pick up later.
// ─────────────────────────────────────────
const RequestMoreInfoSchema = z.object({
  caseId: UUID,
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
})

export async function requestMoreInfoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    const parsed = RequestMoreInfoSchema.safeParse({
      caseId: formData.get('caseId'),
      message: formData.get('message'),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }

    const c = await loadCase(parsed.data.caseId)
    if (!c) return { success: false, error: 'Case not found' }

    if (!c.customer_email) {
      return { success: false, error: 'Customer has no email on file — cannot send the request.' }
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const portalPath = `/portal/${c.id}`
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: c.customer_email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(portalPath)}`,
      },
    })
    if (linkError || !linkData?.properties?.action_link) {
      return {
        success: false,
        error: `Could not generate the portal link: ${linkError?.message ?? 'no action link'}`,
      }
    }

    const customerName = c.trading_name || c.company_name || null
    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [c.customer_email],
      subject: 'We need a bit more information for your ReadyPack order',
      html: buildRequestInfoEmail({
        magicLink: linkData.properties.action_link,
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
      metadata: { message: parsed.data.message, resend_id: sendResult.data?.id ?? null },
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
      .select('id, submission_id')
      .eq('id', parsed.data.flagId)
      .maybeSingle()
    if (flagError) return { success: false, error: flagError.message }
    if (!flag) return { success: false, error: 'Flag not found' }
    if (flag.submission_id !== c.submission_id) {
      return { success: false, error: 'Flag does not belong to this case' }
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
        .select('id, submission_id')
        .eq('id', parsed.data.flagId)
        .maybeSingle()
      if (flagError) return { success: false, error: flagError.message }
      if (!flag) return { success: false, error: 'Flag not found' }
      if (flag.submission_id !== c.submission_id) {
        return { success: false, error: 'Flag does not belong to this case' }
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
    // open high-risk flags instead.)
    if (c.submission_id) {
      const { count: blockingFlags } = await supabaseAdmin
        .from('risk_flags')
        .select('id', { count: 'exact', head: true })
        .eq('submission_id', c.submission_id)
        .eq('status', 'open')
        .in('severity', ['high', 'critical'])
      if ((blockingFlags ?? 0) > 0) {
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    let res: Response
    try {
      res = await fetch(`${appUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // c.id is the order id — the `cases` view is keyed by order id.
        body: JSON.stringify({ order_id: c.id, _internal: true }),
      })
    } catch (fetchErr) {
      return {
        success: false,
        error: `Could not reach generation endpoint: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`,
      }
    }

    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null
      return {
        success: false,
        error: `Generation request failed (${res.status}): ${detail?.error ?? 'unknown error'}`,
      }
    }

    refreshCaseUi(c.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' }
  }
}
