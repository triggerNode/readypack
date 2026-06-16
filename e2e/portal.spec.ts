import { test, expect, type APIRequestContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv, ADMIN_EMAIL } from './lib/test-env'
import { PERSONAS, type Persona } from './lib/personas'

// ──────────────────────────────────────────────────────────────────────────
// Customer portal — the two pieces the earlier runs skipped:
//   1. Arriving via the delivery email's magic link (the real front door).
//   2. Requesting a revision on a document.
//
// Uses a HIGH-risk persona (held, no auto-generation) so these are free.
// ──────────────────────────────────────────────────────────────────────────

const APP_URL = 'http://localhost:3000'

function db(): SupabaseClient {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Seed a paid order, write the persona's answers, and submit it.
async function seedSubmittedOrder(request: APIRequestContext, sb: SupabaseClient, persona: Persona) {
  const createRes = await request.post('/api/admin/dev/create-test', {
    data: { plan: persona.tier, prefillTo: 0, reset: false },
  })
  expect(createRes.ok(), `create-test failed: ${await createRes.text()}`).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
  const orderId = sub!.order_id as string
  await sb.from('intake_submissions').update({ raw_answers: persona.answers }).eq('id', submissionId)
  const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
  expect(submitRes.ok(), `submit failed: ${await submitRes.text()}`).toBeTruthy()
  return orderId
}

const HELD = PERSONAS.find((p) => p.key === 'talentbridge')!

test('delivery magic link logs a logged-out customer into their portal', async ({ browser, request }) => {
  const sb = db()
  const orderId = await seedSubmittedOrder(request, sb, HELD)

  // Generate the exact magic link the delivery email would carry.
  const admin = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
    options: { redirectTo: `${APP_URL}/api/auth/callback?next=/portal/${orderId}` },
  })
  expect(error, error?.message).toBeFalsy()
  const actionLink = link!.properties!.action_link

  // Fresh, logged-OUT browser — exactly like a customer clicking the email link.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(actionLink, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})
  const finalUrl = page.url()
  console.log('\nMagic link landed on:', finalUrl.split('#')[0])

  // The real test: does the PAGE render the customer's portal (authenticated),
  // not just the URL? A bounced login would show the login form instead.
  const onLogin = /\/admin\/login/.test(finalUrl)
  let portalVisible = false
  try {
    await expect(page.getByRole('heading', { name: /ready for review|pack is complete/i })).toBeVisible({ timeout: 15_000 })
    portalVisible = true
  } catch {
    portalVisible = false
  }
  console.log('Portal content visible (authenticated):', portalVisible, '| bounced to login:', onLogin)
  await ctx.close()

  expect(onLogin, 'magic link bounced the customer to the LOGIN page instead of the portal').toBeFalsy()
  expect(portalVisible, 'magic link reached the portal URL but the page did not render as logged-in').toBeTruthy()
})

test('customer can request a revision from the portal', async ({ page, request }) => {
  const sb = db()
  const orderId = await seedSubmittedOrder(request, sb, HELD)

  await page.goto(`/portal/${orderId}`, { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/admin\/login/)

  // Select a document, open the revision panel, describe the change, submit.
  await page.getByRole('button', { name: 'Select AI Use Statement', exact: true }).click()
  await page.getByRole('button', { name: /Request revision/i }).click()
  await page.locator('textarea').fill('Please correct our registered company name on this document.')
  await page.getByRole('button', { name: /Submit feedback/i }).click()
  await expect(page.getByText(/Feedback received/i)).toBeVisible({ timeout: 30_000 })

  // Server side: a revision row exists and the order is escalated for re-review.
  const { data: revs } = await sb.from('case_revisions').select('kind, status, document_types').eq('order_id', orderId)
  console.log('case_revisions:', JSON.stringify(revs))
  expect((revs ?? []).some((r) => r.kind === 'revision'), 'no revision row written').toBeTruthy()
  const { data: order } = await sb.from('orders').select('delivery_status').eq('id', orderId).single()
  expect(order!.delivery_status, 'order should escalate after a revision request').toBe('escalated')
})
