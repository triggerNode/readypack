import { test, expect, type Page } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────
// STAGE 1 — Safe diagnostic sweep.
//
// No payments. No AI. No emails. This only loads public pages and follows
// links, exactly like clicking by hand — but it checks every link and reports
// every dead page and 404 automatically.
//
// It changes nothing in the app or the database.
// ──────────────────────────────────────────────────────────────────────────

// Public pages a real visitor can reach without logging in.
const PUBLIC_ROUTES: { path: string; label: string }[] = [
  { path: '/', label: 'Landing page' },
  { path: '/samples', label: 'Sample documents' },
  { path: '/gap-scan', label: 'Gap Scan (coming soon)' },
  { path: '/gap-scan-result', label: 'Gap Scan result (should redirect)' },
  { path: '/privacy', label: 'Privacy policy' },
  { path: '/terms', label: 'Terms' },
  { path: '/complaints', label: 'Complaints intake' },
]

// Admin pages that MUST be locked to anyone who is not signed in as admin.
// (The cases list lives at /admin itself; individual cases at /admin/cases/<id>.)
const PROTECTED_ROUTES: { path: string; label: string }[] = [
  { path: '/admin', label: 'Admin dashboard / cases list' },
  { path: '/admin/generation-queue', label: 'Admin generation queue' },
  { path: '/admin/dev', label: 'Admin dev tools' },
  {
    path: '/admin/cases/00000000-0000-0000-0000-000000000000',
    label: 'Admin case detail (real route, fake id)',
  },
]

test.describe('Public pages load without error', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.label} (${route.path}) responds OK`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      const status = response?.status() ?? 0
      // A server error (500) or a not-found (404) is a real failure.
      expect(status, `${route.path} returned HTTP ${status}`).toBeLessThan(400)
      // The page should render a real <body> with some visible text.
      const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''
      expect(bodyText.trim().length, `${route.path} rendered an empty page`).toBeGreaterThan(0)
    })
  }
})

test.describe('Admin area is locked to outsiders', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.label} (${route.path}) redirects a logged-out visitor to login`, async ({
      page,
    }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      // requireAdmin() redirects unauthenticated users to /admin/login.
      await expect(page).toHaveURL(/\/admin\/login/)
    })
  }
})

test.describe('No broken internal links on the public site', () => {
  // Crawl the homepage, collect every internal link, and check each one.
  test('every link on the landing page resolves (no 404s / errors)', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const hrefs = await collectInternalHrefs(page)
    const broken: { href: string; status: number }[] = []

    for (const href of hrefs) {
      // Skip anchors and admin/auth links (admin is meant to redirect).
      if (href.startsWith('#') || href.includes('/admin')) continue
      const url = href.startsWith('http') ? href : new URL(href, page.url()).toString()
      const res = await request.get(url, { failOnStatusCode: false })
      if (res.status() >= 400) {
        broken.push({ href, status: res.status() })
      }
    }

    // Report all broken links together, not just the first.
    expect(broken, `Broken links found: ${JSON.stringify(broken, null, 2)}`).toEqual([])
  })
})

// Collect unique, in-site hrefs from the current page.
async function collectInternalHrefs(page: Page): Promise<string[]> {
  const all = await page.locator('a[href]').evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''),
  )
  const origin = new URL(page.url()).origin
  const internal = all.filter((h) => {
    if (!h) return false
    if (h.startsWith('mailto:') || h.startsWith('tel:')) return false
    if (h.startsWith('http')) return h.startsWith(origin)
    return true // relative links are internal
  })
  return Array.from(new Set(internal))
}
