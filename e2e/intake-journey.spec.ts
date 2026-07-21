import { test, expect, request as pwRequest } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import {
  provisionViaWebhook,
  mintCustomerCookies,
  seedAnswers,
  submitAs,
  cleanupProvisioned,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// GROUP 2 (server-side roadblocks) — the "hit a wall" intake scenarios that the
// API enforces, so they can be proven deterministically without driving the form.
// Free (no generation, no AI). The submit endpoint is the source of truth
// (app/api/intake/submit/route.ts): it rejects an unaccepted declaration (400),
// a double-submit (409), and an unauthenticated caller (401).
//
// (The pure UI parts of Group 2 — the "?" help tooltips and the resume-lands-on-
// the-right-section behaviour — are exercised through the real form in
// portal-ui.spec.ts.)
// ──────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const CLEAN = PERSONAS.find((p) => p.key === 'ledgerly')! // clean low-risk answers

const provisioned: ProvisionedOrder[] = []

test.afterAll(async () => {
  await cleanupProvisioned(provisioned)
})

test('submit is blocked server-side until the declaration is accepted', async ({ request }) => {
  test.setTimeout(120_000)
  const email = 'olutags+intakedecl@gmail.com'
  const order = await provisionViaWebhook(request, { email, tier: 'solo' })
  provisioned.push(order)

  // Seed every section EXCEPT a valid declaration (section 10 accepted = false).
  await seedAnswers(order.submissionId, { ...CLEAN.answers, '10': { declaration_accepted: false } })

  const customerApi = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: await mintCustomerCookies(email),
  })
  try {
    const res = await customerApi.post('/api/intake/submit', { data: { submissionId: order.submissionId } })
    expect(res.status(), 'submitting without the declaration must be rejected').toBe(400)
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    expect(String(body.error ?? ''), 'the message should mention the declaration').toMatch(/declaration/i)
  } finally {
    await customerApi.dispose()
  }
})

test('a submission cannot be submitted twice', async ({ request }) => {
  test.setTimeout(120_000)
  const email = 'olutags+intakeresubmit@gmail.com'
  const order = await provisionViaWebhook(request, { email, tier: 'solo' })
  provisioned.push(order)
  await seedAnswers(order.submissionId, CLEAN.answers) // includes a valid declaration

  const customerApi = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: await mintCustomerCookies(email),
  })
  try {
    const first = await submitAs(customerApi, order.submissionId)
    expect(first.riskLevel, 'first submit should succeed and score a risk level').toBeTruthy()

    const res = await customerApi.post('/api/intake/submit', { data: { submissionId: order.submissionId } })
    expect(res.status(), 'a second submit of the same submission must be rejected (409)').toBe(409)
  } finally {
    await customerApi.dispose()
  }
})

test('an unauthenticated caller cannot submit a questionnaire', async ({ request }) => {
  test.setTimeout(120_000)
  const email = 'olutags+intakeauth@gmail.com'
  const order = await provisionViaWebhook(request, { email, tier: 'solo' })
  provisioned.push(order)
  await seedAnswers(order.submissionId, CLEAN.answers)

  // The `request` fixture carries NO customer session — the endpoint must 401
  // before it does anything with the (otherwise valid) submissionId.
  const res = await request.post('/api/intake/submit', { data: { submissionId: order.submissionId } })
  expect(res.status(), 'a submit with no session must be unauthorised').toBe(401)
})
