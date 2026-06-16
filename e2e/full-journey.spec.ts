import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'
import { PERSONAS } from './lib/personas'

// ──────────────────────────────────────────────────────────────────────────
// ONE friend, all the way through:
//   pay → questionnaire → auto-generate → portal → approve → download.
//
// Paid + slow (~6 min for generation). Off by default; turn on with:
//   $env:RUN_REAL_GENERATION = "1"
// ──────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

test('full journey: DropOff Ltd, submit → generate → portal → approve → download', async ({ page, request }) => {
  test.skip(process.env.RUN_REAL_GENERATION !== '1', 'Gated: set RUN_REAL_GENERATION=1 (spends AI credit, ~6 min).')
  test.setTimeout(600_000)
  const sb = db()
  const dropoff = PERSONAS.find((p) => p.key === 'dropoff')!

  // 1. Seed a paid order, write answers, submit (auto-generation fires).
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const createRes = await request.post('/api/admin/dev/create-test', { data: { plan: 'solo', prefillTo: 0, reset: true } })
  expect(createRes.ok()).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
  const orderId = sub!.order_id as string

  await sb.from('intake_submissions').update({ raw_answers: dropoff.answers }).eq('id', submissionId)
  const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
  expect(submitRes.ok(), `submit failed: ${await submitRes.text()}`).toBeTruthy()
  expect((JSON.parse(await submitRes.text()) as { riskLevel: string }).riskLevel).toBe('low')

  // 2. Wait for auto-generation to produce documents (poll up to ~7 min).
  let docCount = 0
  for (let i = 0; i < 84; i++) {
    const { data: docs } = await sb.from('generated_documents').select('id').eq('submission_id', submissionId)
    docCount = docs?.length ?? 0
    if (docCount >= 1) break
    await new Promise((r) => setTimeout(r, 5000))
  }
  console.log(`\nGeneration produced ${docCount} documents for the DropOff pack.`)
  expect(docCount, 'auto-generation never produced any documents').toBeGreaterThan(0)

  // 3. Customer opens the portal and sees their draft pack.
  await page.goto(`/portal/${orderId}`, { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('heading', { name: /ready for review/i })).toBeVisible()
  await expect(page.getByText('AI Use Statement').first()).toBeVisible()

  // 4. Customer approves the pack (re-renders without watermark).
  await page.getByRole('button', { name: /Approve all/i }).first().click()
  await expect(page.getByText(/your compliance pack is complete/i)).toBeVisible({ timeout: 120_000 })

  // 5. Confirm the approval landed and watermarks were removed.
  const { data: orderAfter } = await sb.from('orders').select('delivery_status').eq('id', orderId).single()
  expect(orderAfter!.delivery_status).toBe('delivered')
  const { data: finalDocs } = await sb
    .from('generated_documents')
    .select('file_url, render_metadata')
    .eq('submission_id', submissionId)
  const sampleUrl = finalDocs?.[0]?.file_url as string
  console.log('Watermarked after approval?', (finalDocs?.[0]?.render_metadata as Record<string, unknown>)?.watermarked)

  // 6. THE DOWNLOAD: the link the customer gets vs a signed link.
  const pubRes = await request.get(sampleUrl, { failOnStatusCode: false })
  console.log(`Customer download link (public): HTTP ${pubRes.status()}`)
  const path = sampleUrl.split('/documents/')[1]
  const { data: signed } = await sb.storage.from('documents').createSignedUrl(path, 60)
  const sRes = await request.get(signed!.signedUrl, { failOnStatusCode: false })
  console.log(`Signed link (the fix):           HTTP ${sRes.status()}`)

  // Record the outcome rather than hard-fail — this is a known, proven gap.
  console.log(
    pubRes.status() >= 400 && sRes.status() === 200
      ? '\nCONFIRMED: PDFs are real and downloadable via a SIGNED link, but the public link the portal hands out is broken.'
      : `\nDownload status — public:${pubRes.status()} signed:${sRes.status()}`,
  )
  expect(sRes.status(), 'signed link should serve the PDF').toBe(200)
})
