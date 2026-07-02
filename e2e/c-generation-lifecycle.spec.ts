import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import {
  provisionViaWebhook,
  customerContext,
  mintCustomerCookies,
  seedAnswers,
  submitAs,
  jobCount,
  waitForDocs,
  releaseForReview,
  adminGenerate,
  listGeneratedDocs,
  orderDeliveryStatus,
  orderPlan,
  cleanupProvisioned,
  db,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// LAYER C — the real post-generation lifecycle. GATED behind RUN_REAL_GENERATION=1.
//
// This layer DOES spend Claude credit and DOES inherit this machine's flaky
// Supabase Storage uploads (ConnectTimeoutError), so it is built to:
//   • generate only TWO real packs (an adviser-tier auto-gen pack + a high-risk
//     held pack) and reuse each across many assertions;
//   • never hard-assert docCount === 9 — it waits for ENOUGH documents with a
//     long ceiling and re-kicks a stalled/terminal job (waitForDocs), then works
//     with whatever landed;
//   • tolerate a flaky finalise-upload by re-clicking Approve until the DB
//     confirms the document was delivered.
//
// Reality first (Olu's instruction): every mutation goes through the REAL product
// surface — the customer drives the real portal UI (a genuine magic-link
// session), and the admin drives the real case-detail UI / REST endpoints with
// the saved admin session.
//
// DISCOVERY worth flagging (see the run log): the admin "Generate Pack" button
// (GeneratePackButton / triggerGenerationAction) and the standalone
// "Approve & Deliver" button (ApprovePackButton) are defined in ActionForms.tsx
// but are NOT rendered on any admin page. The shipped held-case path is:
// generate (backend) → resolve flags (Red Flags tab) → Release for customer
// review (send-delivery) → the CUSTOMER approves in the portal. Layer C exercises
// that real shipped path, and triggers held-case generation via the real
// underlying seam (an admin-authenticated POST /api/generate — exactly what
// triggerGenerationAction calls under the hood).
//
// Runs in the "authed" project (admin storageState + the setup dependency). The
// customer side mints its own magic-link session per interaction.
// ──────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const RUN = process.env.RUN_REAL_GENERATION === '1'

const ADVISER = PERSONAS.find((p) => p.key === 'verde')! // adviser tier, low → auto-gen
const HELD = PERSONAS.find((p) => p.key === 'northwind')! // procurement, high → HELD
const CRITICAL = PERSONAS.find((p) => p.key === 'medimind')! // procurement, critical → HELD

const provisioned: ProvisionedOrder[] = []
let adminApi: APIRequestContext
let autoPack: ProvisionedOrder // ADVISER — reused across approve / revision / info
let heldPack: ProvisionedOrder // HIGH held — admin generate → flag-gate → approve
let criticalPack: ProvisionedOrder // CRITICAL held — gating only, no generation
let approvedType: string | null = null // the doc approved in the approve test

// Provision + seed + submit one persona the realistic way. submitAs must run as
// the OWNER, so we mint a real magic-link session (the same one the portal uses)
// into a customer-authed request context. Returns the order + server risk level.
async function provisionAndSubmit(persona: typeof ADVISER) {
  const order = await provisionViaWebhook(adminApi, { email: persona.email, tier: persona.tier })
  provisioned.push(order)
  await seedAnswers(order.submissionId, persona.answers)
  const customerApi = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: await mintCustomerCookies(persona.email),
  })
  try {
    const { riskLevel } = await submitAs(customerApi, order.submissionId)
    return { order, riskLevel }
  } finally {
    await customerApi.dispose()
  }
}

// Poll the DB until a specific document reaches 'delivered', re-clicking the
// portal Approve button on stall (tolerates a flaky finalise-upload).
async function approveDocViaPortal(page: Page, submissionId: string, docType: string): Promise<void> {
  const card = page.locator(`[data-doctype="${docType}"]`)
  for (let attempt = 0; attempt < 4; attempt++) {
    const approveBtn = card.getByRole('button', { name: 'Approve', exact: true })
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click().catch(() => undefined)
    }
    // Give the finalise (watermark-free re-render + Storage upload) up to ~40s.
    const delivered = await waitForDelivered(submissionId, docType, 40_000)
    if (delivered) return
  }
  throw new Error(`document ${docType} never reached 'delivered' after retries (flaky finalise upload?)`)
}

// Switch to an admin case-detail tab, hydration-safely. The Tabs are client
// components, so a click right after page.goto(domcontentloaded) can land before
// React attaches the onClick (a no-op, leaving the panel on Overview). Retry the
// click until the tab actually reports aria-selected="true".
async function openAdminTab(page: Page, name: RegExp): Promise<void> {
  const tab = page.getByRole('tab', { name })
  await expect(tab).toBeVisible({ timeout: 15_000 })
  await expect(async () => {
    await tab.click({ timeout: 2_000 }).catch(() => undefined)
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
}

async function waitForDelivered(submissionId: string, docType: string, ceilingMs: number): Promise<boolean> {
  const deadline = Date.now() + ceilingMs
  while (Date.now() < deadline) {
    const docs = await listGeneratedDocs(submissionId)
    const doc = docs.find((d) => d.documentType === docType)
    if (doc?.deliveryStatus === 'delivered') return true
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

test.describe.serial('Layer C — real generation lifecycle (gated)', () => {
  test.beforeAll(async () => {
    test.skip(!RUN, 'Gated: set RUN_REAL_GENERATION=1 to spend Claude credit on the real lifecycle.')
    test.setTimeout(15 * 60_000)

    adminApi = await pwRequest.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/admin.json',
    })

    // Provision all three the realistic way (webhook → mint session → submit).
    // ADVISER auto-generates; HELD + CRITICAL are held (no auto job).
    const adviser = await provisionAndSubmit(ADVISER)
    autoPack = adviser.order

    const held = await provisionAndSubmit(HELD)
    heldPack = held.order

    const critical = await provisionAndSubmit(CRITICAL)
    criticalPack = critical.order

    // Wait for the ADVISER pack to generate ENOUGH real documents (tolerating
    // Storage flakiness), then release it so the customer can review.
    const count = await waitForDocs(adminApi, autoPack, { min: 3, ceilingMs: 10 * 60_000 })
    expect(count, 'adviser pack generated no documents at all (total Storage failure?)').toBeGreaterThan(0)
    await releaseForReview(adminApi, autoPack.orderId)
  })

  test.afterAll(async () => {
    await cleanupProvisioned(provisioned)
    await adminApi?.dispose()
  })

  // ── C1 — adviser tier auto-generated + released ─────────────────────────
  test('adviser-tier pack auto-generates real documents and is released for review', async () => {
    expect(await orderPlan(autoPack.orderId), 'provisioned tier').toBe('adviser')
    const docs = await listGeneratedDocs(autoPack.submissionId)
    expect(docs.length, 'adviser pack should have at least one generated document').toBeGreaterThan(0)
    expect(await orderDeliveryStatus(autoPack.orderId), 'released → qa_review').toBe('qa_review')
  })

  // ── C2 — customer approves a single document and can download it ────────
  test('customer approves one document in the portal and gets a downloadable PDF', async ({ browser }) => {
    test.setTimeout(4 * 60_000)
    const ctx = await customerContext(browser, ADVISER.email)
    const page = await ctx.newPage()
    try {
      await page.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      await expect(page).not.toHaveURL(/\/admin\/login|\/resume/)

      const draft = page.locator('[data-card-state="draft"]').first()
      await draft.waitFor({ state: 'visible', timeout: 60_000 })
      approvedType = await draft.getAttribute('data-doctype')
      expect(approvedType, 'a draft card should expose its document type').toBeTruthy()

      await approveDocViaPortal(page, autoPack.submissionId, approvedType!)

      // The card is now final with a working download link.
      const finalCard = page.locator(`[data-doctype="${approvedType}"][data-card-state="final"]`)
      await expect(finalCard).toBeVisible({ timeout: 20_000 })
      const dl = finalCard.getByRole('link', { name: /Download PDF/i })
      const href = await dl.getAttribute('href')
      expect(href, 'download link should be a real signed storage URL').toBeTruthy()
      expect(href!, 'download href should be a signed URL, not a dead #').not.toBe('#')
      expect(href!).toMatch(/token=|\/storage\/|supabase/i)
    } finally {
      await ctx.close()
    }
  })

  // ── C3 — request changes → admin regenerate → re-release → re-approve ───
  test('customer requests changes; admin regenerates and re-releases; customer re-approves', async ({
    browser,
    page,
  }) => {
    test.setTimeout(8 * 60_000)

    // Pick a draft document DIFFERENT from the one approved in C2.
    const docs = await listGeneratedDocs(autoPack.submissionId)
    const target = docs.find((d) => d.deliveryStatus !== 'delivered' && d.documentType !== approvedType)
    expect(target, 'need a second reviewable document for the revision loop').toBeTruthy()
    const docType = target!.documentType

    // 1. Customer requests a change on that document.
    const ctx = await customerContext(browser, ADVISER.email)
    const cpage = await ctx.newPage()
    try {
      await cpage.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      const card = cpage.locator(`[data-doctype="${docType}"]`)
      await card.waitFor({ state: 'visible', timeout: 60_000 })
      await card.getByRole('button', { name: /Request changes/i }).click()
      const textarea = cpage.locator('#reqChangeText')
      await textarea.waitFor({ state: 'visible', timeout: 10_000 })
      await textarea.fill('Please correct our registered company name on this document.')
      await cpage.getByRole('button', { name: /Send change request/i }).click()
      await expect(
        cpage.locator(`[data-doctype="${docType}"][data-card-state="revision"]`),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      await ctx.close()
    }

    // Server side: revision recorded, doc in revision, order escalated.
    const sb = db()
    const { data: revs } = await sb
      .from('case_revisions')
      .select('kind, status, document_types')
      .eq('order_id', autoPack.orderId)
    expect(
      (revs ?? []).some((r) => r.kind === 'revision' && (r.document_types as string[]).includes(docType)),
      'a revision row for the requested document should exist',
    ).toBeTruthy()

    // 2. Admin regenerates (real AI, ONE document) then re-releases.
    await page.goto(`/admin/cases/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/admin\/login/)
    await openAdminTab(page, /Revisions/i)
    await page.getByRole('button', { name: /Regenerate with AI/i }).click()
    // Regeneration runs the AI synchronously — wait for the "revised draft ready".
    await expect(page.getByText(/Revised draft ready/i)).toBeVisible({ timeout: 3 * 60_000 })
    await page.getByRole('button', { name: /Re-release & notify customer/i }).click()
    await expect(page.getByText(/Re-released — customer notified/i)).toBeVisible({ timeout: 60_000 })

    // Server side: revised doc is reviewable again (pending).
    await expect
      .poll(async () => {
        const d = (await listGeneratedDocs(autoPack.submissionId)).find((x) => x.documentType === docType)
        return d?.deliveryStatus
      }, { timeout: 30_000, message: 'revised doc should return to a reviewable draft' })
      .toBe('pending')

    // 3. Customer re-approves the revised document.
    const ctx2 = await customerContext(browser, ADVISER.email)
    const cpage2 = await ctx2.newPage()
    try {
      await cpage2.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      const card = cpage2.locator(`[data-doctype="${docType}"]`)
      await card.waitFor({ state: 'visible', timeout: 60_000 })
      await approveDocViaPortal(cpage2, autoPack.submissionId, docType)
    } finally {
      await ctx2.close()
    }
  })

  // ── C4 — info-request round-trip (admin ↔ customer ↔ admin) ─────────────
  test('info request round-trips: admin asks, customer answers, admin resolves', async ({ browser, page }) => {
    test.setTimeout(8 * 60_000)

    // 1. Admin requests more info from the case header. The header
    // "Request More Info" is a <details><summary>; open it, tie the request to a
    // specific document, and submit. (The whole-case default option — value="" —
    // is now handled too: requestMoreInfoAction coerces "" -> undefined before
    // Zod validation. We target a specific document here to also assert the
    // customer-side per-card remediation path.)
    await page.goto(`/admin/cases/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
    const summary = page.getByText('Request More Info', { exact: true }).first()
    await summary.click()
    await page.locator('select[name="documentType"]').first().selectOption('complaints_procedure_pack')
    const msg = page.locator('textarea[name="message"]').first()
    await msg.waitFor({ state: 'visible', timeout: 10_000 })
    await msg.fill('Could you confirm which markets you sell into? This helps us finalise your pack.')
    await page.getByRole('button', { name: /Send request/i }).first().click()
    await expect(page.getByText(/^Done\.$/).first()).toBeVisible({ timeout: 30_000 })

    // Server side: an open info request now exists.
    const sb = db()
    await expect
      .poll(async () => {
        const { data } = await sb
          .from('info_requests')
          .select('id, status')
          .eq('order_id', autoPack.orderId)
          .eq('status', 'open')
        return (data ?? []).length
      }, { timeout: 20_000, message: 'an open info request should be created' })
      .toBeGreaterThan(0)

    // 2. Customer answers it in the portal remediation flow.
    const ctx = await customerContext(browser, ADVISER.email)
    const cpage = await ctx.newPage()
    try {
      await cpage.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      // Hydration-safe: the portal is a client component, so retry opening the
      // remediation flow until the answer textarea appears.
      const provide = cpage.getByRole('button', { name: /Provide the information|Answer this question/i }).first()
      const answer = cpage.locator('#reqText')
      await expect(async () => {
        await provide.click({ timeout: 2_000 }).catch(() => undefined)
        await expect(answer).toBeVisible({ timeout: 2_500 })
      }).toPass({ timeout: 30_000 })
      await answer.fill('We sell to UK and EU business customers only.')
      await cpage.getByRole('button', { name: /Submit & finish|Submit answer/i }).click()
      // Done confirmation overlay.
      await expect(cpage.getByText(/your answers are in|Thank you/i)).toBeVisible({ timeout: 30_000 })
    } finally {
      await ctx.close()
    }

    // Server side: the request is now 'submitted'.
    await expect
      .poll(async () => {
        const { data } = await sb
          .from('info_requests')
          .select('status')
          .eq('order_id', autoPack.orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return data?.status
      }, { timeout: 30_000, message: 'the answered request should be submitted' })
      .toBe('submitted')

    // 3. Admin resolves it from the Info Requests tab. On success the request
    // card moves to the "Resolved" list (its inline "Done." line unmounts with
    // it), so the DB poll below — not a transient "Done." — is the real check.
    await page.goto(`/admin/cases/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
    await openAdminTab(page, /Info Requests/i)
    await page.getByRole('button', { name: /Mark Resolved/i }).first().click()

    await expect
      .poll(async () => {
        const { data } = await sb
          .from('info_requests')
          .select('status')
          .eq('order_id', autoPack.orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return data?.status
      }, { timeout: 20_000, message: 'the request should be resolved' })
      .toBe('resolved')
  })

  // ── C5 — high-risk HELD: admin generates, flags gate, resolve, approve ──
  test('high-risk case is held, admin generates, flags gate approval, then approve', async ({ browser, page }) => {
    test.setTimeout(12 * 60_000)

    // Held: no auto-generation job was enqueued on submit.
    expect(await jobCount(heldPack.submissionId), 'high-risk case must be HELD (no auto job)').toBe(0)

    // The flag-gate contract: open high/critical flags exist (these are exactly
    // what the admin approvePackAction blocks on — see actions.ts approvePackAction).
    const sb = db()
    const openHighBefore = async () => {
      const { data } = await sb
        .from('risk_flags')
        .select('id')
        .eq('submission_id', heldPack.submissionId)
        .eq('status', 'open')
        .in('severity', ['high', 'critical'])
      return (data ?? []).length
    }
    expect(await openHighBefore(), 'a held high-risk case should carry open high flags').toBeGreaterThan(0)

    // Admin triggers generation (the real underlying seam — the "Generate Pack"
    // button is orphaned, see the file header).
    await adminGenerate(adminApi, heldPack.orderId)
    const count = await waitForDocs(adminApi, heldPack, { min: 1, ceilingMs: 10 * 60_000 })
    expect(count, 'held pack should generate at least one document once triggered').toBeGreaterThan(0)

    // Resolve every open flag from the Red Flags tab, ONE AT A TIME, gating each
    // on the DB — not on button text. (A clicked "Mark Resolved" button flips to
    // "Working…" while its server action is in flight, so counting "Mark Resolved"
    // buttons would falsely read as resolved and fire many concurrent, contending
    // actions. Waiting for the DB open-flag count to actually drop resolves them
    // cleanly, one completed action at a time.)
    const openFlagCount = async () => {
      const { data } = await sb
        .from('risk_flags')
        .select('id')
        .eq('submission_id', heldPack.submissionId)
        .eq('status', 'open')
      return (data ?? []).length
    }
    await page.goto(`/admin/cases/${heldPack.orderId}`, { waitUntil: 'domcontentloaded' })
    await openAdminTab(page, /Red Flags/i)
    for (let i = 0; i < 20; i++) {
      const before = await openFlagCount()
      if (before === 0) break
      const btn = page.getByRole('button', { name: /^Mark Resolved$/i }).first()
      if (!(await btn.isVisible().catch(() => false))) {
        // DB still has open flags but no button rendered — reload to re-render.
        await page.reload({ waitUntil: 'domcontentloaded' })
        await openAdminTab(page, /Red Flags/i)
        continue
      }
      await btn.click()
      await expect
        .poll(openFlagCount, { timeout: 30_000, message: 'flag resolution should land in the DB' })
        .toBeLessThan(before)
    }
    expect(await openHighBefore(), 'all blocking flags should be resolved').toBe(0)

    // Release, then the customer approves a document.
    await releaseForReview(adminApi, heldPack.orderId)
    const ctx = await customerContext(browser, HELD.email)
    const cpage = await ctx.newPage()
    try {
      await cpage.goto(`/portal/${heldPack.orderId}`, { waitUntil: 'domcontentloaded' })
      const draft = cpage.locator('[data-card-state="draft"]').first()
      await draft.waitFor({ state: 'visible', timeout: 60_000 })
      const docType = await draft.getAttribute('data-doctype')
      await approveDocViaPortal(cpage, heldPack.submissionId, docType!)
    } finally {
      await ctx.close()
    }
  })

  // ── C6 — critical HELD: gated, nothing generated ────────────────────────
  test('critical case is held with no generation and carries multiple high flags', async () => {
    expect(await jobCount(criticalPack.submissionId), 'critical case must be HELD (no auto job)').toBe(0)
    const docs = await listGeneratedDocs(criticalPack.submissionId)
    expect(docs.length, 'a held critical case should not have auto-generated documents').toBe(0)

    const sb = db()
    const { data: flags } = await sb
      .from('risk_flags')
      .select('severity')
      .eq('submission_id', criticalPack.submissionId)
    const highCount = (flags ?? []).filter((f) => f.severity === 'high').length
    expect(highCount, 'a critical case should carry >=2 high flags').toBeGreaterThanOrEqual(2)
  })
})
