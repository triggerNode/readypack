import { test, expect } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────
// LAYER A — public / static sweep. No auth, no AI spend, seconds to run.
//
// Confirms the logged-out surface is sound before we exercise the paid flows:
// every public page loads, the landing funnel + pricing CTAs are wired to real
// Stripe test-mode checkout, internal links aren't broken, the retired routes
// behave (status → portal redirect, /api/status gone), and the admin area is
// locked to logged-out visitors.
//
// Runs in the logged-out "chromium" project (see playwright.config.ts).
// ──────────────────────────────────────────────────────────────────────────

const A_UUID = '00000000-0000-4000-8000-000000000000'

const PUBLIC_PAGES: { path: string; expect: RegExp }[] = [
  { path: '/', expect: /ReadyPack|compliance/i },
  { path: '/samples', expect: /sample/i },
  { path: '/privacy', expect: /privacy/i },
  { path: '/terms', expect: /terms/i },
  { path: '/complaints', expect: /complaint/i },
  { path: '/gap-scan', expect: /gap|scan/i },
  { path: '/resume', expect: /link|email|resume|expired/i },
]

test.describe('Layer A — public pages load', () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.path} loads and renders real content`, async ({ page }) => {
      const res = await page.goto(p.path, { waitUntil: 'domcontentloaded' })
      expect(res, `no response for ${p.path}`).toBeTruthy()
      expect(res!.status(), `${p.path} returned ${res!.status()}`).toBeLessThan(400)
      // Body has real, non-empty content.
      const body = (await page.locator('body').innerText()).trim()
      expect(body.length, `${p.path} rendered an empty body`).toBeGreaterThan(50)
      await expect(page.locator('body')).toContainText(p.expect)
    })
  }
})

test.describe('Layer A — landing funnel', () => {
  test('all three tier prices are shown', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const body = page.locator('body')
    await expect(body).toContainText('£249')
    await expect(body).toContainText('£499')
    await expect(body).toContainText('£799')
  })

  test('a pricing CTA creates a real Stripe test-mode checkout session', async ({ page }) => {
    // Intercept the checkout call so we can read its body deterministically —
    // the CTA redirects the whole page to Stripe on success, which would
    // otherwise evict the response body before we can inspect it. We still let
    // the REAL request through (route.fetch), so a genuine test-mode session is
    // created; we just block the follow-on navigation to Stripe's hosted page.
    let checkoutBody: { url?: string; error?: string } | null = null
    let checkoutStatus = 0
    await page.route('**/api/checkout', async (route) => {
      const response = await route.fetch()
      checkoutStatus = response.status()
      checkoutBody = (await response.json().catch(() => null)) as typeof checkoutBody
      await route.fulfill({ response })
    })
    await page.route(/checkout\.stripe\.com/, (route) => route.abort())

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const cta = page.getByRole('button', { name: /solo|get.*pack|get started/i }).first()
    await expect(cta).toBeVisible()
    await cta.click()
    await expect.poll(() => checkoutStatus, { timeout: 15_000 }).toBe(200)
    expect(checkoutBody, 'no checkout body captured').not.toBeNull()
    expect(checkoutBody!.url, 'checkout did not return a session url').toBeTruthy()
    expect(checkoutBody!.url!, 'checkout url is not a Stripe checkout link').toMatch(/checkout\.stripe\.com|stripe/i)
  })
})

test.describe('Layer A — retired routes behave', () => {
  test('/status/[id] permanently redirects to /portal/[id]', async ({ request }) => {
    // Inspect the redirect at the HTTP level (auth-independent): the 307/308
    // Location must point at /portal. Following it while logged-out would bounce
    // to auth and mask the redirect we actually want to verify.
    const res = await request.get(`/status/${A_UUID}`, { maxRedirects: 0, failOnStatusCode: false })
    expect([307, 308], `status returned ${res.status()}`).toContain(res.status())
    expect(res.headers()['location'] ?? '', 'redirect target is not /portal').toContain(`/portal/${A_UUID}`)
  })

  test('/api/status/[id] is gone (404)', async ({ request }) => {
    const res = await request.get(`/api/status/${A_UUID}`, { failOnStatusCode: false })
    expect(res.status(), 'legacy /api/status should be 404').toBe(404)
  })
})

test.describe('Layer A — access control', () => {
  test('logged-out visitor is bounced from /admin to /admin/login', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('Layer A — no broken internal links on the landing page', () => {
  test('every internal <a href> resolves (<400)', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const hrefs = await page.$$eval('a[href]', (as) =>
      Array.from(new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''))),
    )
    const internal = hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'))
    expect(internal.length, 'landing page had no internal links').toBeGreaterThan(0)
    const broken: string[] = []
    for (const href of internal) {
      const path = href.split('#')[0]
      if (!path) continue // pure in-page anchor
      const res = await request.get(path, { failOnStatusCode: false })
      if (res.status() >= 400) broken.push(`${href} → ${res.status()}`)
    }
    expect(broken, `broken internal links: ${broken.join(', ')}`).toEqual([])
  })
})
