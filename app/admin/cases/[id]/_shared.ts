// Shared helpers + types for the admin case-detail server actions.
//
// A PLAIN module (deliberately NOT 'use server') so both ./actions and ./flag-actions
// can import these non-async helpers, the ActionResult type, and the UUID/FROM_ADDRESS
// constants. A 'use server' file may only export async server actions, so the shared
// pieces cannot live in either action file — they live here.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

export const UUID = z.string().uuid('Invalid id')

export const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

export async function loadCase(caseId: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('id, submission_id, status, critical_flag_count, customer_email, company_name, trading_name, plan_selected, delivery_status')
    .eq('id', caseId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function writeAudit(input: {
  adminUserId: string
  actionType:
    | 'request_more_info'
    | 'escalation_set'
    | 'mark_flag_resolved'
    | 'override_decision'
    | 'approve_delivery'
    | 'info_resolved'
    | 'document_revised'
    | 'revision_released'
    | 'flag_signed_off'
    | 'flag_queried'
  targetType: 'order' | 'risk_flag' | 'submission' | 'info_request'
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

export function refreshCaseUi(caseId: string): void {
  revalidatePath('/admin')
  revalidatePath(`/admin/cases/${caseId}`)
}
