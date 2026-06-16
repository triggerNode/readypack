import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'

// ──────────────────────────────────────────────────────────────────────────
// Admin-side journey tests. These run with the saved admin login state.
// ──────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

test('robot is logged in as admin and can open the dashboard', async ({ page }) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  // If login failed we'd be bounced to /admin/login. We must NOT be.
  await expect(page).not.toHaveURL(/\/admin\/login/)
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0)
})

// ──────────────────────────────────────────────────────────────────────────
// THE REAL-PDF PROBE.
//
// Spends a small amount of AI credit. Off by default. Turn on with:
//   $env:RUN_REAL_GENERATION = "1"   (PowerShell)
//
// It: creates a paid test order (low-risk "solo"), runs the real document
// engine, then checks whether actual PDF files land in storage. This is the
// direct answer to "why have I never seen a PDF?".
// ──────────────────────────────────────────────────────────────────────────
test('REAL run: a paid order generates real PDFs into storage', async ({ page, request }) => {
  test.skip(process.env.RUN_REAL_GENERATION !== '1', 'Gated: set RUN_REAL_GENERATION=1 to spend AI credit.')
  test.setTimeout(300_000)

  // 1. Seed a paid, prefilled, low-risk test order via the admin dev tool.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const createRes = await request.post('/api/admin/dev/create-test', {
    data: { prefillTo: 9, plan: 'solo', reset: true },
  })
  expect(createRes.ok(), `create-test failed: ${createRes.status()} ${await createRes.text()}`).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  expect(submissionId, 'no submissionId returned').toBeTruthy()

  // 2. Look up the order id for that submission (service key, read-only).
  const db = adminDb()
  const { data: sub } = await db
    .from('intake_submissions')
    .select('order_id')
    .eq('id', submissionId)
    .single()
  const orderId = sub?.order_id as string
  expect(orderId, 'could not resolve order_id').toBeTruthy()

  // 3. Run the real generation pipeline.
  const genRes = await request.post('/api/generate', {
    data: { order_id: orderId },
    timeout: 290_000,
  })
  const genBody = await genRes.text()
  console.log('\n=== /api/generate response ===\n' + genBody + '\n')
  expect(genRes.ok(), `generate failed: ${genRes.status()} ${genBody}`).toBeTruthy()
  const gen = JSON.parse(genBody) as { documents_generated?: number }

  // 4. Did the database record 9 documents?
  const { data: docs } = await db
    .from('generated_documents')
    .select('document_type, file_url, page_count, file_size_bytes')
    .eq('submission_id', submissionId)
  console.log('=== generated_documents rows ===\n' + JSON.stringify(docs, null, 2) + '\n')

  // 5. THE KEY CHECK: do actual PDF files exist in the "documents" storage area?
  const { data: files, error: listErr } = await db.storage.from('documents').list(orderId)
  console.log('=== storage "documents/' + orderId + '" ===')
  console.log(listErr ? 'LIST ERROR: ' + listErr.message : JSON.stringify(files, null, 2))

  // Report-style assertions so a failure pinpoints the exact stage it died at.
  expect(gen.documents_generated, 'engine reported 0 documents generated').toBeGreaterThan(0)
  expect(docs?.length ?? 0, 'no generated_documents rows written').toBeGreaterThan(0)
  expect(listErr, `storage list failed — the "documents" area may not exist: ${listErr?.message}`).toBeFalsy()
  expect((files?.length ?? 0), 'documents recorded in DB but NO PDF files in storage').toBeGreaterThan(0)
})
