import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'
import { PERSONAS } from './lib/personas'

// ──────────────────────────────────────────────────────────────────────────
// ST2-5 reliability fix verification.
// Before the fix, the procurement-tier `procurement_response_memo` stalled the
// synchronous generation and the job/order wedged with no surfaced error.
// After bounding the Anthropic client (timeout + maxRetries), a stalled memo
// call should THROW, the per-document catch should log a `failed` event, and the
// run should FINALISE as a partial → order `escalated`, job terminal, 8/9 docs.
// Gated (spends some credit; mostly content-reuse from the prior Cobalt run).
// ──────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

test('ST2-5: a stalled procurement memo now SURFACES (escalated 8/9) instead of wedging', async ({ request }) => {
  test.skip(process.env.RUN_REAL_GENERATION !== '1', 'Gated: set RUN_REAL_GENERATION=1 (spends AI credit).')
  test.setTimeout(900_000)
  const sb = db()
  const cobalt = PERSONAS.find((p) => p.key === 'cobalt')!

  const createRes = await request.post('/api/admin/dev/create-test', { data: { plan: cobalt.tier, prefillTo: 0, reset: false } })
  expect(createRes.ok(), `create-test failed: ${await createRes.text()}`).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
  const orderId = sub!.order_id as string
  await sb.from('intake_submissions').update({ raw_answers: cobalt.answers }).eq('id', submissionId)
  const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
  expect(submitRes.ok(), `submit failed: ${await submitRes.text()}`).toBeTruthy()

  // Poll the job to a terminal state (the memo timeout is ~4 min × up to 1 retry).
  let jobStatus = 'running'
  let docCount = 0
  for (let i = 0; i < 160; i++) {
    const { data: job } = await sb.from('document_generation_jobs').select('status')
      .eq('submission_id', submissionId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    jobStatus = (job?.status as string) ?? 'none'
    const { data: docs } = await sb.from('generated_documents').select('id').eq('submission_id', submissionId)
    docCount = docs?.length ?? 0
    if (jobStatus !== 'running' && jobStatus !== 'pending' && jobStatus !== 'none') break
    await new Promise((r) => setTimeout(r, 5000))
  }

  const { data: order } = await sb.from('orders').select('delivery_status').eq('id', orderId).single()
  const { data: events } = await sb.from('generation_events').select('document_type, status, error_message').eq('order_id', orderId)
  const memoEvent = (events ?? []).find((e) => e.document_type === 'procurement_response_memo')
  console.log(`\nST2-5 verify → job=${jobStatus}, docs=${docCount}, order=${order?.delivery_status}`)
  console.log('memo event:', JSON.stringify(memoEvent))

  // The fix: NOT wedged. Job reached terminal, order not stuck 'generating'.
  expect(jobStatus, 'job should reach a terminal state, not stay running').not.toBe('running')
  expect(order?.delivery_status, 'order must not be stuck in generating').not.toBe('generating')
  // Partial pack surfaced: 8/9 with the memo recorded as a failure.
  expect(docCount, 'the 8 non-memo docs should still generate').toBeGreaterThanOrEqual(8)
  expect(order?.delivery_status, 'a partial pack escalates for human review').toBe('escalated')
  expect(memoEvent?.status, 'the stalled memo should now be a SURFACED failure').toBe('failed')
})
