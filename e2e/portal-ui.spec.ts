import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import {
  provisionViaWebhook,
  customerContext,
  mintCustomerCookies,
  seedAnswers,
  submitAs,
  db,
  cleanupProvisioned,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// PORTAL & QUESTIONNAIRE UI SWEEP — clickables, overlays, and the questionnaire
// HelpPopover "?" tooltips. Free (no AI): the portal order is a HELD high-risk
// case (no auto-generation) and the questionnaire order is never submitted.
//
// Each surface is reached through a REAL magic-link customer session
// (customerContext), exactly as a customer would. Runs in the logged-out
// "chromium" project — every context here mints its own auth.
// ──────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'

// A distinct email keeps these UI orders separable from the routing-matrix
// personas (Gmail +addressing → all still reach the founder's monitored inbox).
const QUESTIONNAIRE_EMAIL = 'olutags+uiquestionnaire@gmail.com'
const PORTAL_EMAIL = 'olutags+uiportal@gmail.com'

const ADVISER = PERSONAS.find((p) => p.key === 'verde')! // clean answers to seed sections 1-3
const HELD = PERSONAS.find((p) => p.key === 'northwind')! // high risk → HELD (no generation)

const provisioned: ProvisionedOrder[] = []
let publicApi: APIRequestContext // for the public Stripe-signed webhook POST
let questionnaireOrder: ProvisionedOrder
let portalOrder: ProvisionedOrder

test.beforeAll(async () => {
  test.setTimeout(120_000)
  publicApi = await pwRequest.newContext({ baseURL: BASE_URL })

  // 1. A questionnaire order left UNSUBMITTED, seeded so it opens partway through
  //    (sections 1-3 done → the stepper lands on section 4, which carries "?" help).
  questionnaireOrder = await provisionViaWebhook(publicApi, { email: QUESTIONNAIRE_EMAIL, tier: 'solo' })
  provisioned.push(questionnaireOrder)
  const sb = db()
  await sb
    .from('intake_submissions')
    .update({
      raw_answers: { '1': ADVISER.answers['1'], '2': ADVISER.answers['2'], '3': ADVISER.answers['3'] },
      section_completion: {
        '1': { completed: true },
        '2': { completed: true },
        '3': { completed: true },
      },
    })
    .eq('id', questionnaireOrder.submissionId)

  // 2. A HELD (high-risk) submitted order → the portal renders its shell with no
  //    auto-generation (free). We submit as the owner via a minted session.
  portalOrder = await provisionViaWebhook(publicApi, { email: PORTAL_EMAIL, tier: 'procurement_ready' })
  provisioned.push(portalOrder)
  await seedAnswers(portalOrder.submissionId, HELD.answers)
  const customerApi = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: await mintCustomerCookies(PORTAL_EMAIL),
  })
  try {
    await submitAs(customerApi, portalOrder.submissionId)
  } finally {
    await customerApi.dispose()
  }
})

test.afterAll(async () => {
  await cleanupProvisioned(provisioned)
  await publicApi?.dispose()
})

test('questionnaire "?" help tooltips each open a tooltip and close again', async ({ browser }) => {
  const ctx = await customerContext(browser, QUESTIONNAIRE_EMAIL)
  const page = await ctx.newPage()
  try {
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/resume|\/admin\/login/)

    // Dismiss the welcome screen to reach the seeded active section. The button
    // is server-rendered, so a click can land before React hydrates the onStart
    // handler (a no-op) — retry the click until the section actually appears.
    const startBtn = page.getByRole('button', { name: /Continue questionnaire|Start your questionnaire/i })
    const helpButtons = page.locator('button.qz-help-btn')
    await expect(startBtn).toBeVisible({ timeout: 15_000 })
    await expect(async () => {
      await startBtn.click({ timeout: 2_000 }).catch(() => undefined)
      await expect(helpButtons.first()).toBeVisible({ timeout: 2_500 })
    }).toPass({ timeout: 30_000 })

    // Every field-level help control is a `.qz-help-btn` ("?"). Sweep them all.
    const count = await helpButtons.count()
    expect(count, 'the active questionnaire section should expose help "?" controls').toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const btn = helpButtons.nth(i)
      await btn.click()
      // The popover renders with role="tooltip" and a title.
      const tip = page.locator('[role="tooltip"]')
      await expect(tip).toBeVisible({ timeout: 5_000 })
      // Close via the popover's own close control, then confirm it's gone.
      await page.getByRole('button', { name: /Close help/i }).click()
      await expect(tip).toBeHidden({ timeout: 5_000 })
    }
  } finally {
    await ctx.close()
  }
})

test('portal renders the pack shell: nav, all nine document cards, footer links', async ({ browser }) => {
  const ctx = await customerContext(browser, PORTAL_EMAIL)
  const page = await ctx.newPage()
  try {
    await page.goto(`/portal/${portalOrder.orderId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/resume|\/admin\/login/)

    // Brand chrome.
    await expect(page.getByLabel('ReadyPack').first()).toBeVisible()

    // All nine document cards render from the very first paint (queued/drafting
    // placeholders when nothing is generated yet).
    const cards = page.locator('[data-doctype]')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    expect(await cards.count(), 'the portal should render all nine document cards').toBe(9)

    // The secure-link note + footer legal/links.
    await expect(page.getByText(/Delivered over a secure, single-use link/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Privacy Policy/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Terms$/i })).toBeVisible()
  } finally {
    await ctx.close()
  }
})

test('portal internal links all resolve (<400)', async ({ browser }) => {
  const ctx = await customerContext(browser, PORTAL_EMAIL)
  const page = await ctx.newPage()
  try {
    await page.goto(`/portal/${portalOrder.orderId}`, { waitUntil: 'domcontentloaded' })
    const hrefs = await page.$$eval('a[href]', (as) =>
      Array.from(new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''))),
    )
    const internal = hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'))
    const broken: string[] = []
    for (const href of internal) {
      const path = href.split('#')[0]
      if (!path) continue
      const res = await ctx.request.get(path, { failOnStatusCode: false })
      if (res.status() >= 400) broken.push(`${href} → ${res.status()}`)
    }
    expect(broken, `broken internal portal links: ${broken.join(', ')}`).toEqual([])
  } finally {
    await ctx.close()
  }
})
