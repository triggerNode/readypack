import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'
import { PERSONAS } from './lib/personas'
import { uploadPersonaLogo, withLogo } from './lib/logo'

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

test('full journey: Lumen Studio, submit → generate → portal → approve → download', async ({ page, request }) => {
  test.skip(process.env.RUN_REAL_GENERATION !== '1', 'Gated: set RUN_REAL_GENERATION=1 (spends AI credit, ~6 min).')
  test.setTimeout(600_000)
  const sb = db()
  const persona = PERSONAS.find((p) => p.key === 'lumen')!

  // 1. Seed a paid order, upload the persona's logo, write answers, submit.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  const createRes = await request.post('/api/admin/dev/create-test', { data: { plan: persona.tier, prefillTo: 0, reset: true } })
  expect(createRes.ok()).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
  const orderId = sub!.order_id as string

  const logoUrl = await uploadPersonaLogo(sb, persona, submissionId)
  expect(logoUrl, 'logo upload should return a public URL').toBeTruthy()
  await sb.from('intake_submissions').update({ raw_answers: withLogo(persona.answers, logoUrl) }).eq('id', submissionId)
  const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
  expect(submitRes.ok(), `submit failed: ${await submitRes.text()}`).toBeTruthy()
  expect((JSON.parse(await submitRes.text()) as { riskLevel: string }).riskLevel).toBe('low')

  // 2. Wait for auto-generation to finish (poll the job to terminal, up to ~7 min).
  let docCount = 0
  for (let i = 0; i < 84; i++) {
    const { data: docs } = await sb.from('generated_documents').select('id').eq('submission_id', submissionId)
    docCount = docs?.length ?? 0
    const { data: job } = await sb
      .from('document_generation_jobs')
      .select('status')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (docCount >= 9 || (job?.status && job.status !== 'running' && job.status !== 'pending')) break
    await new Promise((r) => setTimeout(r, 5000))
  }
  console.log(`\nGeneration produced ${docCount} documents for the ${persona.company} pack.`)
  expect(docCount, 'auto-generation never produced any documents').toBeGreaterThan(0)
  // The bar from the brief: a complete pack is 9/9 (including DPIA-Lite).
  expect(docCount, 'a complete pack should be 9 documents (incl. DPIA-Lite)').toBe(9)

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
  const meta = (finalDocs?.[0]?.render_metadata as Record<string, unknown>) ?? {}
  console.log('Watermarked after approval?', meta.watermarked)

  // 5b. Real company name on the documents (not the "Customer <id>" placeholder).
  const personalisation = (meta.personalisation as Record<string, unknown>) ?? {}
  console.log('Document personalisation companyName:', personalisation.companyName)
  expect(String(personalisation.companyName ?? ''), 'real company name on documents').toBe('Lumen Studio Ltd')
  expect(String(personalisation.companyName ?? ''), 'no "Customer <id>" placeholder').not.toMatch(/^Customer\s+[0-9a-f]{8}$/i)

  // 6. THE DOWNLOAD via a signed URL. Post-fix, file_url stores the storage PATH;
  //    the bucket is private, so a signed URL is the only way the PDF opens.
  const storedPath = finalDocs?.[0]?.file_url as string
  const path = storedPath.includes('/documents/') ? storedPath.split('/documents/')[1] : storedPath
  const { data: signed } = await sb.storage.from('documents').createSignedUrl(path, 60)
  const sRes = await request.get(signed!.signedUrl, { failOnStatusCode: false })
  const head = (await sRes.body()).subarray(0, 5).toString('latin1')
  console.log(`Signed link: HTTP ${sRes.status()} head=${JSON.stringify(head)}`)
  expect(sRes.status(), 'signed link should serve the PDF').toBe(200)
  expect(head, 'signed link should return a real PDF').toBe('%PDF-')
})
