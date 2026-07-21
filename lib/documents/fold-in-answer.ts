// Stage 3d — fold a customer's query answer back into the pack.
//
// Runs off the request path (kicked via waitUntil to /api/internal/fold-in-answer),
// because a regenerate + scoped QA is ~60–90s and must not block the customer's
// answer submit. `info_requests` IS the durable record: answered + regenerated_at
// NULL means "needs processing", and claiming regenerated_at atomically makes the
// whole thing run exactly once (a re-kick or the admin's manual "process now" is a
// no-op). Blast radius is deliberately ONE document — no pack-level QA, no
// escalation, no other docs touched.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { INTERNAL_SECRET_HEADER, getInternalSecret } from '@/lib/auth/internal-secret'
import { waitUntil } from '@vercel/functions'
import { notifyAdmin } from '@/lib/notifications'
import { regenerateDocumentWithFeedback } from './regenerate-document'
import { checkRegeneratedDocument } from './query-ai'
import { affectedDocForCode, shouldAutoRegenerate, buildAnswerInstruction } from './query-loop'
import { classifyFlag } from '@/lib/risk/resolution'
import type { RiskFlagCode } from '@/lib/risk/score'
import type { DeliveryStatus, RiskFlagSeverity } from '@/types/database'

export interface FoldInResult {
  ok: boolean
  reason?: string
  docStatus?: 'passed' | 'flagged'
}

async function pingAdmin(subject: string, orderId: string, detail: string): Promise<void> {
  try {
    await notifyAdmin(subject, `<p>Order <strong>${orderId}</strong></p><p>${detail}</p>`)
  } catch {
    // notification is best-effort
  }
}

export async function foldInAnswer(orderId: string, infoRequestId: string): Promise<FoldInResult> {
  // 1. The info-request must belong to this order, carry a flag, and be unprocessed.
  const { data: info } = await supabaseAdmin
    .from('info_requests')
    .select('id, order_id, risk_flag_id, prompt, answer_text, answer_selections, regenerated_at')
    .eq('id', infoRequestId)
    .maybeSingle()
  if (!info || info.order_id !== orderId) return { ok: false, reason: 'info request not found' }
  if (!info.risk_flag_id) return { ok: false, reason: 'no linked flag' }
  if (info.regenerated_at) return { ok: false, reason: 'already processed' }

  // 2. Load the flag + order state and decide eligibility (pure predicate).
  const { data: flag } = await supabaseAdmin
    .from('risk_flags')
    .select('id, submission_id, code, severity, status')
    .eq('id', info.risk_flag_id)
    .maybeSingle()
  if (!flag) return { ok: false, reason: 'flag not found' }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('delivery_status')
    .eq('id', orderId)
    .maybeSingle()
  const deliveryStatus = (order?.delivery_status ?? 'pending') as DeliveryStatus
  const code = (flag.code ?? null) as RiskFlagCode | null
  const closurePath = code ? classifyFlag({ code, severity: flag.severity as RiskFlagSeverity }) : null
  if (!shouldAutoRegenerate({ closurePath, regeneratedAt: info.regenerated_at, deliveryStatus })) {
    return { ok: false, reason: 'not eligible' }
  }
  const affectedDoc = affectedDocForCode(code)
  if (!affectedDoc) return { ok: false, reason: 'no affected document' }

  // 3. Claim the one-regenerate lock atomically. If another worker beat us, bail.
  const nowIso = new Date().toISOString()
  const { data: claimed } = await supabaseAdmin
    .from('info_requests')
    .update({ regenerated_at: nowIso })
    .eq('id', info.id)
    .is('regenerated_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return { ok: false, reason: 'already claimed' }

  // 4. Regenerate the ONE affected document with the answer folded in.
  const answerText =
    info.answer_text ??
    (Array.isArray(info.answer_selections) ? (info.answer_selections as string[]).join(', ') : '')
  const instruction = buildAnswerInstruction(info.prompt ?? 'A clarifying question', answerText)
  const regen = await regenerateDocumentWithFeedback({
    orderId,
    documentType: affectedDoc,
    feedback: instruction,
    mode: 'answer',
  })
  if (!regen.success) {
    // Surface to the admin; the flag stays open and the manual path is the backstop.
    await pingAdmin(
      'A customer answer could not be auto-applied',
      orderId,
      `We could not regenerate ${affectedDoc} from the customer's answer (${regen.error ?? 'unknown error'}). Please handle it manually.`,
    )
    return { ok: false, reason: regen.error ?? 'regenerate failed' }
  }

  // 5. Scoped, side-effect-free re-QA of just that document.
  const { data: doc } = await supabaseAdmin
    .from('generated_documents')
    .select('id, content_json')
    .eq('submission_id', flag.submission_id)
    .eq('document_type', affectedDoc)
    .maybeSingle()
  const check = doc
    ? await checkRegeneratedDocument({ documentType: affectedDoc, contentJson: doc.content_json })
    : { status: 'flagged' as const, note: 'document not found after regenerate' }

  // 6. Set ONLY this doc's status. Passed -> a reviewable draft in place (no email;
  //    the customer is already in the portal). Flagged -> stays in revision for the
  //    admin, who is handed the document in step 6b.
  if (doc) {
    await supabaseAdmin
      .from('generated_documents')
      .update({
        qa_status: check.status,
        delivery_status: check.status === 'passed' ? 'pending' : 'in_revision',
      })
      .eq('id', doc.id)
  }

  // 6b. A flagged re-QA leaves the doc in 'in_revision'. WITHOUT AN OWNER THAT IS A
  //     DEAD END: the customer's card reads "we're working on your changes" forever,
  //     the flag is closed in step 7 so the runbook says "nothing to do", and the pack
  //     can never complete (observed in prod, 2026-07-21). Open a revision row already
  //     in 'in_review' — the document IS regenerated, so the admin's existing
  //     "Re-release & notify customer" step is the live action; releasing it flips the
  //     doc back to 'pending' and emails the customer. No extra AI spend.
  if (doc && check.status !== 'passed') {
    const { error: revErr } = await supabaseAdmin.from('case_revisions').insert({
      order_id: orderId,
      submission_id: flag.submission_id,
      document_types: [affectedDoc],
      feedback_text:
        `Regenerated from the customer's answer, but the quality check flagged it` +
        `${check.note ? `: ${check.note}` : '.'} Review the draft, then re-release it to the customer.`,
      kind: 'revision',
      status: 'in_review',
      metadata: { source: 'query_fold_in', info_request_id: info.id, qa_note: check.note ?? null },
    })
    if (revErr) {
      await pingAdmin(
        'A regenerated document needs manual release',
        orderId,
        `${affectedDoc} was regenerated but the quality check flagged it, and the revision hand-off could not be created (${revErr.message}). Please release it manually.`,
      )
    }
  }

  // 7. Close the flag as 'query' (the gap has been answered). The answer stays
  //    attached to it via info_requests.risk_flag_id.
  await supabaseAdmin
    .from('risk_flags')
    .update({ status: 'resolved', resolution_type: 'query', resolved_at: nowIso })
    .eq('id', flag.id)
    .eq('status', 'open')

  // 8. If clean, auto-resolve the info-request; if flagged, leave it for the admin.
  if (check.status === 'passed') {
    await supabaseAdmin
      .from('info_requests')
      .update({ status: 'resolved', resolved_at: nowIso })
      .eq('id', info.id)
  }

  // 9. Audit + notify (visibility, not a human gate).
  await supabaseAdmin.from('audit_events').insert({
    admin_user_id: null,
    action_type: 'query_auto_regenerated',
    target_type: 'risk_flag',
    target_id: flag.id,
    metadata: {
      order_id: orderId,
      document_type: affectedDoc,
      info_request_id: info.id,
      doc_status: check.status,
    },
  })
  await pingAdmin(
    `Customer answered — ${affectedDoc} auto-updated (${check.status})`,
    orderId,
    check.status === 'passed'
      ? 'The document was regenerated from the answer and passed a scoped check. It is back with the customer to approve.'
      : `The regenerated document was held for review: ${check.note}`,
  )

  return { ok: true, docStatus: check.status }
}

/**
 * Kick the fold-in off the request path. Mirrors kickWorker: a fresh internal
 * request runs to completion independently; waitUntil keeps the instance alive on
 * Vercel until the kick is delivered. Never throws.
 */
export function kickFoldIn(orderId: string, infoRequestId: string): void {
  if (process.env.E2E_SKIP_REAL_GENERATION === '1') return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const delivered = fetch(`${appUrl}/api/internal/fold-in-answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_SECRET_HEADER]: getInternalSecret() ?? '',
    },
    body: JSON.stringify({ order_id: orderId, info_request_id: infoRequestId }),
  })
    .then(() => undefined)
    .catch(() => undefined)
  try {
    waitUntil(delivered)
  } catch {
    // Not in a Vercel request scope (local dev / tests) — the fetch still fires.
  }
}
