// Realistic end-to-end journey engine for the final E2E pass.
//
// Design goal (Olu's instruction): scenarios must be AS CLOSE TO REALITY AS
// POSSIBLE so the suite surfaces real bugs. So instead of the old dev-only
// create-test shortcut (which fabricates an admin-owned order and skips the
// whole payment → provisioning → auth path), this engine reproduces the genuine
// customer journey:
//
//   1. provisionViaWebhook — POST a REAL Stripe-signed `checkout.session.completed`
//      event to /api/webhooks/stripe. This runs the actual production webhook
//      handler: it creates the auth user, the org, the paid order, the empty
//      intake_submission, and fires the magic-link email — exactly as a live
//      purchase does. The only thing skipped is Stripe's own hosted card page
//      (which cannot be automated headlessly); the signature is real and the
//      handler code path is identical.
//
//   2. mintCustomerCookies — take the same one-time hashed_token a magic link
//      carries and exchange it for a real session (verifyOtp), encoded into the
//      exact cookies @supabase/ssr writes. Navigating a browser to the resulting
//      /api/auth/confirm URL, or loading these cookies as storage state, is
//      behaviourally identical to the customer clicking the emailed link.
//
//   3. seedAnswers / submitAs / pollDocs — helpers to drive the rest of the real
//      pipeline (questionnaire answers, the real /api/intake/submit, generation).
//
// Everything here is read/mint only against the project's own service key
// (already in .env.local and used by the app itself). It changes nothing about
// the founder's credentials.

import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test'
import { requireEnv } from './test-env'
import type { Persona, Tier } from './personas'

// Amounts in pence, matching app/api/checkout TIER_CONFIG.
const TIER_AMOUNT_PENCE: Record<Tier, number> = {
  solo: 24900,
  procurement_ready: 49900,
  adviser: 79900,
}

export interface ProvisionedOrder {
  orderId: string
  submissionId: string
  userId: string
  orgId: string
  email: string
  sessionId: string
}

export function db(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Provision a paid order the real way: a Stripe-signed checkout.session.completed
 * event through the live webhook handler. Returns the created order + submission.
 */
export async function provisionViaWebhook(
  request: APIRequestContext,
  opts: { email: string; tier: Tier },
): Promise<ProvisionedOrder> {
  // No apiVersion pin needed — generateTestHeaderString is version-independent,
  // and the SDK default matches the app's pinned version anyway.
  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'))
  const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET')

  const sessionId = `cs_test_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const paymentIntentId = `pi_test_e2e_${Date.now()}`
  const event = {
    id: `evt_test_e2e_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: TIER_AMOUNT_PENCE[opts.tier],
        payment_intent: paymentIntentId,
        customer_details: { email: opts.email },
        metadata: { plan_selected: opts.tier },
      },
    },
  }

  const payload = JSON.stringify(event)
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret })

  const res = await request.post('/api/webhooks/stripe', {
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    data: payload,
  })
  if (!res.ok()) {
    throw new Error(`webhook provisioning failed: ${res.status()} ${await res.text()}`)
  }

  // The handler is synchronous for the DB writes, so the order exists by now.
  const sb = db()
  const { data: order, error } = await sb
    .from('orders')
    .select('id, user_id, billing_org_id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(`order lookup failed: ${error.message}`)
  if (!order) throw new Error(`webhook ran but no order was created for ${sessionId}`)

  const { data: sub, error: subErr } = await sb
    .from('intake_submissions')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle()
  if (subErr) throw new Error(`submission lookup failed: ${subErr.message}`)
  if (!sub) throw new Error(`order created but no intake_submission for order ${order.id}`)

  return {
    orderId: order.id,
    submissionId: sub.id,
    userId: order.user_id as string,
    orgId: order.billing_org_id as string,
    email: opts.email,
    sessionId,
  }
}

export interface CookieState {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: 'Lax' | 'Strict' | 'None'
  }>
  origins: never[]
}

/**
 * Mint a real logged-in session for `email` and return it as Playwright storage
 * state. This is the same mechanism a magic-link click uses (generateLink →
 * verifyOtp → @supabase/ssr cookie encoding), so an authed context built from it
 * behaves exactly like the customer having clicked their emailed link.
 */
export async function mintCustomerCookies(email: string, domain = 'localhost'): Promise<CookieState> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`could not mint session token for ${email}: ${linkErr?.message ?? 'no token'}`)
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  const session = verifyData?.session
  if (verifyErr || !session) {
    throw new Error(`could not exchange token for ${email}: ${verifyErr?.message ?? 'no session'}`)
  }

  const captured: { name: string; value: string; options: Record<string, unknown> }[] = []
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (list) => {
        for (const c of list) captured.push(c as (typeof captured)[number])
      },
    },
  })
  await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  const farFuture = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const cookies = captured.map((c) => ({
    name: c.name,
    value: c.value,
    domain,
    path: (c.options?.path as string) ?? '/',
    expires: farFuture,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }))
  if (cookies.length === 0) throw new Error(`no cookies produced for ${email}`)
  return { cookies, origins: [] }
}

/** Open a browser context authenticated as the given customer email. */
export async function customerContext(browser: Browser, email: string): Promise<BrowserContext> {
  const storageState = await mintCustomerCookies(email)
  return browser.newContext({ storageState })
}

/**
 * Write a persona's questionnaire answers straight onto the submission
 * (service-role). Used by the fast routing matrix (Layer B) where driving all 10
 * personas through the real form UI would be needlessly slow. Hero journeys type
 * the real form instead.
 */
export async function seedAnswers(
  submissionId: string,
  answers: Persona['answers'],
): Promise<void> {
  const sb = db()
  const { error } = await sb
    .from('intake_submissions')
    .update({ raw_answers: answers })
    .eq('id', submissionId)
  if (error) throw new Error(`seedAnswers failed: ${error.message}`)
}

/** Submit a seeded submission through the real /api/intake/submit as the owner. */
export async function submitAs(
  ctxRequest: APIRequestContext,
  submissionId: string,
): Promise<{ riskLevel: string; orderId: string | null }> {
  const res = await ctxRequest.post('/api/intake/submit', { data: { submissionId } })
  const bodyText = await res.text()
  if (!res.ok()) throw new Error(`submit failed: ${res.status()} ${bodyText}`)
  const body = JSON.parse(bodyText) as { riskLevel: string; orderId: string | null }
  return { riskLevel: body.riskLevel, orderId: body.orderId }
}

/** Poll generated_documents / the generation job until terminal or `target` docs. */
export async function pollDocs(
  submissionId: string,
  target = 9,
  tries = 90,
  intervalMs = 5000,
): Promise<number> {
  const sb = db()
  let count = 0
  for (let i = 0; i < tries; i++) {
    const { data: docs } = await sb
      .from('generated_documents')
      .select('id')
      .eq('submission_id', submissionId)
    count = docs?.length ?? 0
    const { data: job } = await sb
      .from('document_generation_jobs')
      .select('status')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const terminal = job?.status && job.status !== 'running' && job.status !== 'pending' && job.status !== 'queued'
    if (count >= target || terminal) break
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return count
}

/** How many generation jobs exist for a submission (held cases should have 0). */
export async function jobCount(submissionId: string): Promise<number> {
  const sb = db()
  const { data } = await sb
    .from('document_generation_jobs')
    .select('id')
    .eq('submission_id', submissionId)
  return data?.length ?? 0
}

// ──────────────────────────────────────────────────────────────────────────
// Layer C helpers (real generation lifecycle). Only used with
// RUN_REAL_GENERATION=1, so they DO spend Claude credit and DO inherit this
// machine's flaky Supabase Storage uploads — the callers must tolerate/retry.
// ──────────────────────────────────────────────────────────────────────────

export interface GeneratedDoc {
  documentType: string
  deliveryStatus: string
  fileUrl: string | null
}

/** The generated_documents rows for a submission (type + delivery + file). */
export async function listGeneratedDocs(submissionId: string): Promise<GeneratedDoc[]> {
  const sb = db()
  const { data } = await sb
    .from('generated_documents')
    .select('document_type, delivery_status, file_url')
    .eq('submission_id', submissionId)
    .order('document_type', { ascending: true })
  return (data ?? []).map((d) => ({
    documentType: d.document_type as string,
    deliveryStatus: d.delivery_status as string,
    fileUrl: (d.file_url as string | null) ?? null,
  }))
}

/** Latest generation job status for a submission ('completed'|'failed'|... | null). */
export async function latestJobStatus(submissionId: string): Promise<string | null> {
  const sb = db()
  const { data } = await sb
    .from('document_generation_jobs')
    .select('status')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.status as string | undefined) ?? null
}

/**
 * Admin-authenticated re-kick of the generation worker for an order. The admin
 * request context (built from the saved admin storageState) authenticates the
 * POST, so /api/generate accepts it exactly as the case-detail trigger does.
 */
export async function adminGenerate(
  adminRequest: APIRequestContext,
  orderId: string,
): Promise<void> {
  await adminRequest
    .post('/api/generate', { data: { order_id: orderId }, timeout: 290_000 })
    .catch(() => undefined)
}

/**
 * Wait for a real pack to generate ENOUGH documents, tolerating this machine's
 * flaky Supabase Storage uploads (ConnectTimeoutError). Polls, and if the job
 * has gone terminal (or stalled) with fewer than `min` docs, re-kicks the worker
 * as admin and keeps waiting up to `ceilingMs`. Never hard-asserts 9 — returns
 * however many landed so the caller can proceed with whatever is available.
 */
export async function waitForDocs(
  adminRequest: APIRequestContext,
  order: { orderId: string; submissionId: string },
  opts: { min?: number; ceilingMs?: number } = {},
): Promise<number> {
  const min = opts.min ?? 1
  const ceilingMs = opts.ceilingMs ?? 8 * 60_000
  const deadline = Date.now() + ceilingMs
  let count = await pollDocs(order.submissionId, min, 1, 0)
  let rekicks = 0
  while (count < min && Date.now() < deadline) {
    const status = await latestJobStatus(order.submissionId)
    const stalled = status === 'failed' || status === 'completed' || status === null
    // Re-kick a terminal/stalled job that fell short (a Storage timeout mid-run).
    if (stalled && rekicks < 4) {
      rekicks++
      await adminGenerate(adminRequest, order.orderId)
    }
    // Poll for ~30s then re-evaluate.
    count = await pollDocs(order.submissionId, min, 6, 5000)
  }
  return count
}

/** Admin releases a generated pack for customer review (the real send-delivery
 *  route). Makes the pack customer-reviewable (writes the 'delivery' comms row
 *  that portal-feed reads as `released`). Returns the JSON body. */
export async function releaseForReview(
  adminRequest: APIRequestContext,
  orderId: string,
): Promise<{ success?: boolean; error?: string; pack_reference?: string }> {
  const res = await adminRequest.post(`/api/admin/cases/${orderId}/send-delivery`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  })
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    pack_reference?: string
  }
  if (!res.ok() || !body.success) {
    throw new Error(`releaseForReview failed: ${res.status()} ${body.error ?? JSON.stringify(body)}`)
  }
  return body
}

/** The order's current delivery_status roll-up. */
export async function orderDeliveryStatus(orderId: string): Promise<string | null> {
  const sb = db()
  const { data } = await sb.from('orders').select('delivery_status').eq('id', orderId).maybeSingle()
  return (data?.delivery_status as string | undefined) ?? null
}

/** The order's plan tier (used to assert the adviser tier provisioned). */
export async function orderPlan(orderId: string): Promise<string | null> {
  const sb = db()
  const { data } = await sb.from('orders').select('plan_selected').eq('id', orderId).maybeSingle()
  return (data?.plan_selected as string | undefined) ?? null
}

/**
 * Targeted, best-effort cleanup for orders this test run provisioned.
 *
 * Deletes exactly the rows tied to the given ProvisionedOrder ids — never a
 * broad "olutags+%" pattern delete — in FK-safe order (children before
 * parents). Each table delete is wrapped independently so one failure (e.g. a
 * table that never got any rows for a HELD persona) doesn't abort the rest.
 * Call from afterAll once a test file is done with its provisioned orders.
 */
export async function cleanupProvisioned(orders: ProvisionedOrder[]): Promise<void> {
  if (orders.length === 0) return
  const sb = db()

  const submissionIds = Array.from(new Set(orders.map((o) => o.submissionId)))
  const orderIds = Array.from(new Set(orders.map((o) => o.orderId)))
  const orgIds = Array.from(new Set(orders.map((o) => o.orgId)))
  const userIds = Array.from(new Set(orders.map((o) => o.userId)))

  const safeDelete = async (
    label: string,
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ): Promise<void> => {
    try {
      const { error } = await fn()
      if (error) console.warn(`[cleanup] ${label} delete failed (non-fatal): ${error.message}`)
    } catch (err) {
      console.warn(`[cleanup] ${label} delete threw (non-fatal): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Children of intake_submissions first (generated_documents/qa_reports/
  // risk_flags/ai_tools/vendors cascade on submission delete, but deleting
  // explicitly keeps this correct even if a cascade rule ever changes).
  await safeDelete('generated_documents', () =>
    sb.from('generated_documents').delete().in('submission_id', submissionIds),
  )
  await safeDelete('document_generation_jobs', () =>
    sb.from('document_generation_jobs').delete().in('submission_id', submissionIds),
  )
  await safeDelete('qa_reports', () => sb.from('qa_reports').delete().in('submission_id', submissionIds))
  await safeDelete('risk_flags', () => sb.from('risk_flags').delete().in('submission_id', submissionIds))
  await safeDelete('ai_tools', () => sb.from('ai_tools').delete().in('submission_id', submissionIds))
  await safeDelete('vendors', () => sb.from('vendors').delete().in('submission_id', submissionIds))

  // Children of orders.
  await safeDelete('info_requests', () => sb.from('info_requests').delete().in('order_id', orderIds))
  await safeDelete('case_revisions', () => sb.from('case_revisions').delete().in('order_id', orderIds))
  await safeDelete('generation_events', () => sb.from('generation_events').delete().in('order_id', orderIds))
  await safeDelete('customer_communications', () =>
    sb.from('customer_communications').delete().in('order_id', orderIds),
  )

  // Now the submission + order rows, then org + user. A held pack's REAL
  // generation can still be running in the background (Layer C proceeds once a
  // FEW docs exist, not all 9), so it keeps inserting generation_events /
  // generated_documents / jobs / qa_reports AFTER the first child sweep above —
  // which FK-blocks the orders delete. Retry the FK-sensitive tail, re-sweeping
  // those late children each attempt, until the orders are gone (or we give up).
  const ordersGone = async (): Promise<boolean> => {
    const { data } = await sb.from('orders').select('id').in('id', orderIds)
    return (data ?? []).length === 0
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    // Re-sweep the tables a late-running generation writes into.
    await safeDelete('generated_documents (resweep)', () =>
      sb.from('generated_documents').delete().in('submission_id', submissionIds),
    )
    await safeDelete('document_generation_jobs (resweep)', () =>
      sb.from('document_generation_jobs').delete().in('submission_id', submissionIds),
    )
    await safeDelete('qa_reports (resweep)', () => sb.from('qa_reports').delete().in('submission_id', submissionIds))
    await safeDelete('generation_events (resweep)', () =>
      sb.from('generation_events').delete().in('order_id', orderIds),
    )
    await safeDelete('customer_communications (resweep)', () =>
      sb.from('customer_communications').delete().in('order_id', orderIds),
    )
    await safeDelete('intake_submissions', () => sb.from('intake_submissions').delete().in('id', submissionIds))
    await safeDelete('orders', () => sb.from('orders').delete().in('id', orderIds))
    if (await ordersGone()) break
    // A generation write beat us — wait for the worker to move on, then retry.
    await new Promise((r) => setTimeout(r, 4000))
  }

  // The org this run created (webhook always inserts a fresh org per
  // provisioned order — never the shared admin org), plus its membership row
  // and any brand profile, then finally the auth user.
  await safeDelete('brand_profiles', () => sb.from('brand_profiles').delete().in('org_id', orgIds))
  await safeDelete('organisation_members', () => sb.from('organisation_members').delete().in('org_id', orgIds))
  await safeDelete('organisations', () => sb.from('organisations').delete().in('id', orgIds))

  for (const userId of userIds) {
    try {
      const { error } = await sb.auth.admin.deleteUser(userId)
      if (error) console.warn(`[cleanup] deleteUser ${userId} failed (non-fatal): ${error.message}`)
    } catch (err) {
      console.warn(`[cleanup] deleteUser ${userId} threw (non-fatal): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
