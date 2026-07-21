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
import { waitForEmailTo, capturedFor } from './lib/captured-emails'
import { inspectPdf, pdfHasText, pdfHasDraftWatermark, LOGO_PLACEHOLDER } from './lib/pdf-fidelity'
import { uploadPersonaLogo, withLogo } from './lib/logo'

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
// The shipped held-case path is: generate → SIGN OFF each held flag on the case
// runbook (accept or remediate + a required reason — the delivery-gate KEY) → the
// gate clears and the admin clicks "Release for customer review" → the CUSTOMER
// approves in the portal. Layer C exercises that real shipped path.
//
// NOTE on the "Generate Pack" trigger: the button IS rendered on the runbook (see
// CaseRunbook.tsx; d-admin-actions.spec.ts clicks it for real and asserts a job
// enqueues, in the free layer). Here in the PAID layer we trigger held-case
// generation via the underlying seam instead (an admin-authenticated POST
// /api/generate — exactly what triggerGenerationAction calls under the hood):
// the button's realness is already covered by d-admin, and going through the seam
// avoids tying a multi-minute real-generation wait to UI hydration timing.
// Stage 3d's query loop (a gap flag the customer answers, which auto-folds into the
// one affected document) is exercised at the end on the same held pack.
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
  // Upload the persona's logo fixture the same shape the real upload route uses, so
  // the generated pack actually carries a logo — this makes the Group 7 "logo
  // present" fidelity check meaningful (and exercises the logo pipeline end to end).
  const logoUrl = await uploadPersonaLogo(db(), persona, order.submissionId)
  await seedAnswers(order.submissionId, withLogo(persona.answers, logoUrl))
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

    // The release (beforeAll) emailed the customer a "ready for review" notice.
    expect(
      await waitForEmailTo(ADVISER.email, /ready for review/i),
      'releasing the pack should email the customer a delivery notice',
    ).toBeTruthy()
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
    // The always-on CaseRunbook (above the tabs) offers the SAME revision actions
    // as a convenience, so an un-scoped button name matches twice. Scope to the
    // active tabpanel — only the selected panel is mounted (Tabs.Panel returns
    // null when inactive), so this resolves to exactly the Revisions-tab control.
    const revPanel = page.getByRole('tabpanel')
    await revPanel.getByRole('button', { name: /Regenerate with AI/i }).click()
    // Regeneration runs the AI synchronously — wait for the "revised draft ready".
    await expect(revPanel.getByText(/Revised draft ready/i)).toBeVisible({ timeout: 3 * 60_000 })
    await revPanel.getByRole('button', { name: /Re-release & notify customer/i }).click()
    await expect(revPanel.getByText(/Re-released — customer notified/i)).toBeVisible({ timeout: 60_000 })

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

    // The request emailed the customer (needs_more_info).
    expect(
      await waitForEmailTo(ADVISER.email, /need a bit more information/i),
      'requesting more info should email the customer',
    ).toBeTruthy()

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

  // ── C4b — customer approves the WHOLE pack: it finalises and the completion ──
  //          email fires ONCE (send-once), rolling the order up to delivered ─────
  //
  // Runs last on the adviser pack (after C2 approve / C3 revision / C4 info) — it
  // finalises everything, so it must come after the tests that need draft docs.
  test('customer approves every document; the pack completes and the completion email fires exactly once', async ({
    browser,
  }) => {
    test.setTimeout(9 * 60_000)
    const ctx = await customerContext(browser, ADVISER.email)
    const cpage = await ctx.newPage()
    try {
      await cpage.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      // Drive the pack to completion: repeatedly RE-QUERY the reviewable documents
      // and approve each, until the order rolls up to 'delivered'. Re-querying (not a
      // single up-front snapshot) is what makes this deterministic — a document can
      // settle into an approvable state a beat after the list is taken (a late
      // finalise from an earlier step, generation finishing), and a one-shot list
      // silently misses it, leaving the pack one approval short of complete. The LAST
      // approval fires sendPackCompleteEmail (send-once); approveDocViaPortal tolerates
      // the flaky finalise-upload with its own retry.
      await expect
        .poll(
          async () => {
            // NOTE: the pack's 9 documents generate PROGRESSIVELY — their rows appear
            // over time, so a one-shot list taken here can miss docs that generate a
            // beat later. Re-listing every poll cycle is what closes that gap.
            const reviewable = (await listGeneratedDocs(autoPack.submissionId)).filter(
              (d) => d.deliveryStatus !== 'delivered' && d.deliveryStatus !== 'in_revision',
            )
            for (const d of reviewable) {
              await approveDocViaPortal(cpage, autoPack.submissionId, d.documentType)
            }
            return orderDeliveryStatus(autoPack.orderId)
          },
          {
            timeout: 6 * 60_000,
            message: 'approving every reviewable document should roll the order up to delivered',
          },
        )
        .toBe('delivered')
    } finally {
      await ctx.close()
    }

    // The completion email fired — exactly once (the unique pack_complete marker is
    // an atomic send-once lock across the approve-all + last-per-doc paths).
    const complete = await waitForEmailTo(ADVISER.email, /pack is complete/i, { timeoutMs: 60_000 })
    expect(complete, 'a "pack is complete" email should be sent on completion').toBeTruthy()
    const completeCount = capturedFor(ADVISER.email).filter((e) => /pack is complete/i.test(e.subject)).length
    expect(completeCount, 'the completion email must send exactly once').toBe(1)
  })

  // ── C4c — output FIDELITY: the delivered pack LOOKS right ─────────────────
  //          Real business name, logo present, and NO draft watermark on finals.
  test('the delivered pack looks right: real business name, logo present, no draft watermark', async ({
    browser,
  }) => {
    test.setTimeout(4 * 60_000)
    const ctx = await customerContext(browser, ADVISER.email)
    const page = await ctx.newPage()
    try {
      await page.goto(`/portal/${autoPack.orderId}`, { waitUntil: 'domcontentloaded' })
      const finalCard = page.locator('[data-card-state="final"]').first()
      await finalCard.waitFor({ state: 'visible', timeout: 30_000 })
      const href = await finalCard.getByRole('link', { name: /Download PDF/i }).getAttribute('href')
      expect(href, 'a delivered doc should expose a signed download link').toBeTruthy()

      const res = await ctx.request.get(href!)
      expect(res.ok(), 'the signed PDF URL should fetch').toBeTruthy()
      const pdf = await inspectPdf(Buffer.from(await res.body()))

      expect(pdf.pageCount, 'the delivered PDF should have real pages').toBeGreaterThan(0)
      expect(
        pdfHasText(pdf, 'Verde Consulting'),
        'the PDF should carry the real business name, not "Customer <id>"',
      ).toBeTruthy()
      expect(
        pdfHasText(pdf, LOGO_PLACEHOLDER),
        'the logo should have rendered (no "CLIENT LOGO" placeholder text)',
      ).toBeFalsy()
      expect(
        pdfHasDraftWatermark(pdf),
        'a DELIVERED (final) document must NOT carry the DRAFT watermark',
      ).toBeFalsy()
    } finally {
      await ctx.close()
    }
  })

  // ── C5 — high-risk HELD: admin generates, the gate blocks until each held ──
  //         flag is signed off on the runbook, then the admin releases ─────────
  test('high-risk case is held; the gate blocks until each held flag is signed off, then the admin releases', async ({ browser, page }) => {
    test.setTimeout(12 * 60_000)

    // Held: no auto-generation job was enqueued on submit.
    expect(await jobCount(heldPack.submissionId), 'high-risk case must be HELD (no auto job)').toBe(0)

    // The flag-gate contract: open high/critical flags exist — exactly what
    // isBlockingFlag / openHighRiskFlagCount block delivery on (see lib/risk/gate.ts).
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

    // Admin triggers generation via the real underlying seam. (The runbook's
    // "Generate Pack" button IS wired — d-admin-actions clicks it for real; Layer C
    // uses the seam here so the held pack is ready without re-driving that click.)
    await adminGenerate(adminApi, heldPack.orderId)
    const count = await waitForDocs(adminApi, heldPack, { min: 1, ceilingMs: 10 * 60_000 })
    expect(count, 'held pack should generate at least one document once triggered').toBeGreaterThan(0)

    // Open the case: the runbook (with the delivery-gate banner) renders at the top.
    await page.goto(`/admin/cases/${heldPack.orderId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/admin\/login/)

    // Gate BLOCKED: the banner's "Release for review" button is present but locked.
    await expect(
      page.getByRole('button', { name: /^Release for review$/i }),
      'the release button must be locked while a held flag is unresolved',
    ).toBeDisabled({ timeout: 15_000 })

    // Sign off each held (open high/critical) flag from the runbook flag cards, ONE
    // AT A TIME, gating each on the DB — not on button text (a submitted sign-off
    // form flips to "Saving…" while its server action is in flight). Each sign-off
    // records an accept/remediate decision + a required reason and closes the flag.
    //
    // This case carries two blocking flags (ai_decision_making + annex_iii), so the
    // loop runs twice. Two races to absorb: (a) a successful sign-off calls
    // revalidatePath, re-rendering the whole runbook — so reload at the TOP for a
    // clean DOM; (b) after a reload, the "Sign off" client onClick may not be
    // attached the instant the button paints, so a single click can no-op — retry
    // the expand click until the form's radio actually appears (same hydration-safe
    // pattern as openAdminTab). Then verify the radio really checked before confirm,
    // so we never submit an empty decision.
    for (let i = 0; i < 20; i++) {
      const before = await openHighBefore()
      if (before === 0) break

      await page.reload({ waitUntil: 'domcontentloaded' })
      const signOff = page.getByRole('button', { name: /^Sign off$/i }).first()
      if (!(await signOff.isVisible({ timeout: 15_000 }).catch(() => false))) {
        continue
      }

      // Click "Sign off" until the sign-off form expands (its radio becomes visible).
      const acceptRadio = page.locator('input[name="decision"][value="accept"]').first()
      await expect(async () => {
        if (!(await acceptRadio.isVisible().catch(() => false))) {
          await signOff.click({ timeout: 2_000 }).catch(() => undefined)
        }
        await expect(acceptRadio).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 30_000 })

      // Choose "Accept with justification"; the label click checks its radio — retry
      // until the radio reports checked.
      await expect(async () => {
        await page.getByText('Accept with justification').first().click()
        await expect(acceptRadio).toBeChecked({ timeout: 1_000 })
      }).toPass({ timeout: 10_000 })

      const note = page.locator('textarea[name="note"]').first()
      await note.waitFor({ state: 'visible', timeout: 10_000 })
      await note.fill(
        'Lawful basis is legitimate interests; an LIA is completed and attached. The AI output is advisory only — a human makes the final decision, so Article 22 does not bite.',
      )
      await page.getByRole('button', { name: /Confirm sign-off/i }).click()
      await expect
        .poll(openHighBefore, { timeout: 30_000, message: 'sign-off should close the held flag in the DB' })
        .toBeLessThan(before)
    }
    expect(await openHighBefore(), 'all blocking flags should be signed off').toBe(0)

    // Gate CLEARED: the real Release button unlocks. Release for customer review.
    await page.reload({ waitUntil: 'domcontentloaded' })
    const release = page.getByRole('button', { name: /Release for customer review/i })
    await expect(release, 'the release button should unlock once the gate clears').toBeEnabled({ timeout: 15_000 })
    await expect(async () => {
      await release.click({ timeout: 2_000 }).catch(() => undefined)
      expect(await orderDeliveryStatus(heldPack.orderId)).toBe('qa_review')
    }).toPass({ timeout: 30_000 })

    // Releasing emailed the customer a "ready for review" delivery notice.
    expect(
      await waitForEmailTo(HELD.email, /ready for review/i),
      'releasing the held pack should email the customer',
    ).toBeTruthy()

    // The customer approves a document in the portal.
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

  // ── C5b — the customer read-me ("What we noticed") renders with the MOFE line ──
  //          Owner-authorised portal backup of the completion attachment. The held
  //          pack carries real flags, so its read-me model exists → a real PDF.
  test("the held pack's read-me renders as a PDF carrying the MOFE trading line", async ({ browser }) => {
    test.setTimeout(3 * 60_000)
    const ctx = await customerContext(browser, HELD.email)
    try {
      const res = await ctx.request.get(`/api/portal/${heldPack.orderId}/readme`)
      expect(res.status(), 'the owner should get the read-me PDF (200)').toBe(200)
      expect(res.headers()['content-type'] ?? '', 'the read-me should be a PDF').toContain('application/pdf')

      const pdf = await inspectPdf(Buffer.from(await res.body()))
      expect(pdf.pageCount, 'the read-me should have at least one page').toBeGreaterThan(0)
      expect(
        pdfHasText(pdf, 'MOFE Ltd') && pdfHasText(pdf, '16633320'),
        'the read-me should carry the MOFE trading-disclosure line',
      ).toBeTruthy()
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

  // ── C7 — the query loop (Stage 3d): admin queries a gap flag, the customer ──
  //         answers, and the answer auto-folds into the ONE affected document ──
  //
  // Reuses heldPack (procurement tier). It carries an OPEN vendor_dpa flag — a
  // 'query'-path gap (medium severity: HireRank AI, USA, no DPA). C5 signed off the
  // HIGH flags but never touches this one, and C5 generated the pack, so the affected
  // document (Vendor AI Register) exists. Answering an info-request that carries a
  // risk_flag_id kicks foldInAnswer: regenerate that one doc with the answer folded
  // in, a scoped side-effect-free re-QA, then close the flag as resolution_type=query.
  test('query loop: admin queries the vendor-DPA gap; the customer answers; the answer auto-folds into the Vendor AI Register', async ({
    browser,
    page,
  }) => {
    test.setTimeout(8 * 60_000)
    const sb = db()

    // The fold-in regenerates the Vendor AI Register — if a Storage flake meant it
    // never generated, the loop cannot run end to end. Skip (don't fail) on pure infra.
    const docs = await listGeneratedDocs(heldPack.submissionId)
    test.skip(
      !docs.some((d) => d.documentType === 'vendor_ai_register'),
      'vendor_ai_register did not generate (Storage flake) — cannot exercise the fold-in end to end',
    )

    // The open query flag C5 deliberately left alone.
    const { data: qflag } = await sb
      .from('risk_flags')
      .select('id, status')
      .eq('submission_id', heldPack.submissionId)
      .eq('code', 'vendor_dpa')
      .maybeSingle()
    expect(qflag, 'held procurement case should carry a vendor_dpa query flag').toBeTruthy()
    expect(qflag!.status, 'the query flag should still be open before the loop').toBe('open')

    // 1. Admin opens the case and queries the customer from the runbook's query card.
    await page.goto(`/admin/cases/${heldPack.orderId}`, { waitUntil: 'domcontentloaded' })
    const queryBtn = page.getByRole('button', { name: /Query the customer/i }).first()
    await expect(queryBtn).toBeVisible({ timeout: 15_000 })

    // The AI drafts a question into the message box; wait for it, else type our own
    // (the field is required, min 10 chars). Either way, review-then-send is real.
    // Scope to the query form: the always-present whole-case "Request More Info" form
    // ALSO has a name="message" textarea (same placeholder once drafting finishes), so
    // an un-scoped locator matches twice — pin to the form that owns the unique
    // "Send to customer" button. Click "Query the customer" until that form opens
    // (hydration-safe: the client onClick may not be attached the instant it paints).
    const message = page.locator('form:has(button:has-text("Send to customer")) textarea[name="message"]')
    await expect(async () => {
      if (!(await message.isVisible().catch(() => false))) {
        await queryBtn.click({ timeout: 2_000 }).catch(() => undefined)
      }
      await expect(message).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    await expect(async () => {
      if ((await message.inputValue()).trim().length < 10) {
        await message.fill(
          'Do you have a signed data processing agreement (DPA) with HireRank AI? If so, please confirm so we can record the transfer safeguard in your Vendor AI Register.',
        )
      }
      expect((await message.inputValue()).trim().length).toBeGreaterThanOrEqual(10)
    }).toPass({ timeout: 60_000 })
    await page.getByRole('button', { name: /Send to customer/i }).click()

    // Server side: a flag-linked, open info request now exists.
    let infoRequestId: string | null = null
    await expect
      .poll(async () => {
        const { data } = await sb
          .from('info_requests')
          .select('id, status')
          .eq('order_id', heldPack.orderId)
          .eq('risk_flag_id', qflag!.id)
          .maybeSingle()
        infoRequestId = data?.id ?? null
        return data?.status ?? null
      }, { timeout: 30_000, message: 'a flag-linked info request should be created' })
      .toBe('open')

    // The query emailed the customer the AI-drafted question (needs_more_info).
    expect(
      await waitForEmailTo(HELD.email, /need a bit more information/i),
      'querying the customer should email them the question',
    ).toBeTruthy()

    // 2. Customer answers it in the portal remediation flow. Answering an
    //    info-request that carries a risk_flag_id kicks the fold-in (kickFoldIn).
    const ctx = await customerContext(browser, HELD.email)
    const cpage = await ctx.newPage()
    try {
      await cpage.goto(`/portal/${heldPack.orderId}`, { waitUntil: 'domcontentloaded' })
      const provide = cpage.getByRole('button', { name: /Provide the information|Answer this question/i }).first()
      const answer = cpage.locator('#reqText')
      await expect(async () => {
        await provide.click({ timeout: 2_000 }).catch(() => undefined)
        await expect(answer).toBeVisible({ timeout: 2_500 })
      }).toPass({ timeout: 30_000 })
      await answer.fill(
        'Yes — we signed a DPA with HireRank AI on 3 March 2026, with EU Standard Contractual Clauses as the transfer mechanism.',
      )
      await cpage.getByRole('button', { name: /Submit & finish|Submit answer/i }).click()
      await expect(cpage.getByText(/your answers are in|Thank you/i)).toBeVisible({ timeout: 30_000 })
    } finally {
      await ctx.close()
    }

    // 3. The fold-in runs off the request path (real AI regenerate + scoped re-QA).
    //    It claims regenerated_at exactly once, then closes the flag as 'query'.
    expect(infoRequestId, 'the info request id should have been captured').toBeTruthy()
    await expect
      .poll(async () => {
        const { data } = await sb
          .from('info_requests')
          .select('regenerated_at')
          .eq('id', infoRequestId!)
          .maybeSingle()
        return data?.regenerated_at ?? null
      }, { timeout: 4 * 60_000, message: 'the answer should be folded in (regenerated_at claimed)' })
      .not.toBeNull()

    // The gap flag is now closed as resolution_type='query'.
    await expect
      .poll(async () => {
        const { data } = await sb
          .from('risk_flags')
          .select('status, resolution_type')
          .eq('id', qflag!.id)
          .maybeSingle()
        return `${data?.status}:${data?.resolution_type}`
      }, { timeout: 60_000, message: 'the query flag should close as resolution_type=query' })
      .toBe('resolved:query')

    // And the scoped fold-in left its audit trail.
    const { data: audit } = await sb
      .from('audit_events')
      .select('action_type')
      .eq('target_id', qflag!.id)
      .eq('action_type', 'query_auto_regenerated')
    // Idempotency (5.3b): EXACTLY one regeneration — guards the known 2nd-answer
    // double-fire edge that was fixed. More than one = the fold-in ran twice.
    expect(
      (audit ?? []).length,
      'the fold-in must regenerate the affected doc exactly once (idempotent)',
    ).toBe(1)
  })
})
