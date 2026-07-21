import { test, expect } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import {
  provisionViaWebhook,
  customerContext,
  cleanupProvisioned,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// GROUP 8 — in-app access control. Free (no generation, no AI). Proves the REAL
// guards ship and hold:
//   • a signed-in customer cannot open ANOTHER customer's portal
//     (portal/[id]/page.tsx authorises on order.user_id === user.id),
//   • a signed-in non-admin customer cannot reach the admin area.
// Runs logged-out in the chromium project; each check mints its own real
// magic-link customer session.
// ──────────────────────────────────────────────────────────────────────────

const CUSTOMER_A = PERSONAS.find((p) => p.key === 'lumen')! // owner of order A
const CUSTOMER_B = PERSONAS.find((p) => p.key === 'ledgerly')! // owner of order B

const provisioned: ProvisionedOrder[] = []
let orderA: ProvisionedOrder
let orderB: ProvisionedOrder

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000)
  // Provisioning needs a public API context (the Stripe-signed webhook POST).
  const request = await browser.newContext().then((c) => c.request)
  orderA = await provisionViaWebhook(request, { email: CUSTOMER_A.email, tier: CUSTOMER_A.tier })
  provisioned.push(orderA)
  orderB = await provisionViaWebhook(request, { email: CUSTOMER_B.email, tier: CUSTOMER_B.tier })
  provisioned.push(orderB)
})

test.afterAll(async () => {
  await cleanupProvisioned(provisioned)
})

test("a customer cannot open another customer's portal", async ({ browser }) => {
  // Signed in as customer A, try to open customer B's portal.
  const ctx = await customerContext(browser, CUSTOMER_A.email)
  const page = await ctx.newPage()
  try {
    await page.goto(`/portal/${orderB.orderId}`, { waitUntil: 'domcontentloaded' })
    // Ownership mismatch → the page redirects to the customer re-entry screen
    // (/resume?...&reason=switch_account), never rendering B's pack.
    await expect(page).toHaveURL(/\/resume/)
    await expect(page, "must not stay on B's portal").not.toHaveURL(new RegExp(`/portal/${orderB.orderId}$`))
  } finally {
    await ctx.close()
  }
})

test('a signed-in non-admin customer cannot reach the admin area', async ({ browser }) => {
  const ctx = await customerContext(browser, CUSTOMER_A.email)
  const page = await ctx.newPage()
  try {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login/)
  } finally {
    await ctx.close()
  }
})
