import { test, expect } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import {
  provisionViaWebhook,
  customerContext,
  seedAnswers,
  submitAs,
  jobCount,
  cleanupProvisioned,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// ADMIN CASE-PAGE ACTIONS — FREE checks (no AI spend).
//
// Runs in the admin-authed project (saved admin storageState). Uses the
// generation kill-switch (E2E_SKIP_REAL_GENERATION, ON in normal runs), so a
// "Generate Pack" click still writes the queued job row that proves the button
// is wired and calls triggerGenerationAction — without spending Claude credit.
//
// Skipped during the paid Layer C run (RUN_REAL_GENERATION=1), where the
// kill-switch is OFF and clicking Generate Pack would spend real AI; Layer C
// already exercises real held-case generation there.
// ──────────────────────────────────────────────────────────────────────────

test.skip(
  process.env.RUN_REAL_GENERATION === '1',
  'free enqueue check — skipped during the paid real-generation run (Layer C covers it)',
)

// Northwind is the high-risk persona: HELD on submit (no auto-generation), so
// the admin "Generate Pack" button is exactly the trigger under test.
const HELD = PERSONAS.find((p) => p.key === 'northwind')
if (!HELD) throw new Error('northwind persona not found')

const provisioned: ProvisionedOrder[] = []

test.afterAll(async () => {
  await cleanupProvisioned(provisioned)
})

test('admin "Generate Pack" button enqueues generation for a held case', async ({ browser, page, request }) => {
  test.setTimeout(120_000)

  // Provision + submit the held case the realistic way (webhook → session → submit).
  const order = await provisionViaWebhook(request, { email: HELD.email, tier: HELD.tier })
  provisioned.push(order)
  await seedAnswers(order.submissionId, HELD.answers)

  const ctx = await customerContext(browser, HELD.email)
  try {
    const { riskLevel } = await submitAs(ctx.request, order.submissionId)
    expect(riskLevel, 'northwind should score high (held)').toBe('high')
  } finally {
    await ctx.close()
  }

  // Held: the submit did NOT auto-enqueue generation.
  expect(await jobCount(order.submissionId), 'held case must start with no generation job').toBe(0)

  // Admin opens the case. Because 0 documents exist, the "Generate Pack" button
  // is rendered in the header (see CaseHeader documentCount gate).
  await page.goto(`/admin/cases/${order.orderId}`, { waitUntil: 'domcontentloaded' })
  const genBtn = page.getByRole('button', { name: /^Generate Pack$/i })
  await expect(genBtn, 'the Generate Pack button should be visible for a held, ungenerated case').toBeVisible({
    timeout: 15_000,
  })

  // Hydration-safe click: retry until a generation job is enqueued. The
  // kill-switch no-ops the worker, so this proves the button → triggerGeneration
  // → enqueueGeneration wiring without any real document generation.
  await expect(async () => {
    await genBtn.click({ timeout: 2_000 }).catch(() => undefined)
    expect(await jobCount(order.submissionId)).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 30_000 })
})
