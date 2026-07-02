import { test, expect } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import { scoreRisk } from '../lib/risk/score'
import {
  provisionViaWebhook,
  customerContext,
  seedAnswers,
  submitAs,
  jobCount,
  cleanupProvisioned,
  db,
  type ProvisionedOrder,
} from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// LAYER B — risk routing + auto-gen/held gating, all 10 personas.
//
// Each persona is provisioned the REALISTIC way (a genuinely Stripe-signed
// webhook → magic-link session, see e2e/lib/journey.ts), then driven through
// the real /api/intake/submit. That endpoint is the single source of truth
// for risk level AND for the auto-gen/held decision (low/medium auto-trigger
// real document generation; high/critical are HELD for the admin "Generate
// Pack" button — see app/api/intake/submit/route.ts).
//
// Cost note: this layer proves the *gating decision* — auto-gen cases enqueue a
// generation job, held (high/critical) cases don't — NOT that a full 9-document
// pack finishes rendering. A test-only kill-switch (E2E_SKIP_REAL_GENERATION,
// set by the Playwright webServer; see playwright.config.ts + generation-queue.ts)
// lets the 'queued' job row still be written while the worker no-ops, so this
// layer is seconds-long, free, and deterministic. Real end-to-end generation
// (the full pack actually rendering) is Layer C's job, gated behind
// RUN_REAL_GENERATION=1. Runs in the logged-out "chromium" project (each test
// mints its own customer context; no shared auth state needed).
// ──────────────────────────────────────────────────────────────────────────

const provisioned: ProvisionedOrder[] = []

test.afterAll(async () => {
  await cleanupProvisioned(provisioned)
})

test.describe('Layer B — risk routing (unit, free, no server)', () => {
  // Fast, zero-cost sanity check: every persona's answers run through the
  // real scoreRisk source of truth and land on the intended level/gating
  // BEFORE we spend anything hitting the live pipeline below. Catches persona
  // drift against lib/risk/score.ts early and cheaply.
  for (const p of PERSONAS) {
    test(`${p.company} answers → ${p.expectedRisk} (scoreRisk unit)`, async () => {
      const { riskLevel } = scoreRisk(p.answers)
      expect(riskLevel, `${p.company} risk level`).toBe(p.expectedRisk)
      const autoGen = riskLevel === 'low' || riskLevel === 'medium'
      expect(autoGen, `${p.company} auto-gen gating`).toBe(p.expectAutoGen)
    })
  }
})

test.describe('Layer B — realistic routing + gating (webhook → submit)', () => {
  for (const persona of PERSONAS) {
    test(`${persona.company} (${persona.tier}, target ${persona.expectedRisk}) provisions, submits, and gates correctly`, async ({
      request,
      browser,
    }) => {
      // No real generation runs in this layer (kill-switch), so the whole
      // journey is provision → mint session → submit → read a few rows: seconds.
      test.setTimeout(120_000)

      const order = await provisionViaWebhook(request, { email: persona.email, tier: persona.tier })
      provisioned.push(order)

      await seedAnswers(order.submissionId, persona.answers)

      const ctx = await customerContext(browser, persona.email)
      try {
        const { riskLevel } = await submitAs(ctx.request, order.submissionId)
        expect(riskLevel, `${persona.company} server-computed risk level`).toBe(persona.expectedRisk)

        // ── Gating: auto-gen enqueues a job; HELD enqueues none ────────────
        // This is the real contract — does the submit *trigger* generation?
        // (Whether the pack then finishes rendering is Layer C's concern.)
        if (persona.expectAutoGen) {
          await expect
            .poll(() => jobCount(order.submissionId), {
              message: `${persona.company} (auto-gen) should enqueue a generation job`,
              timeout: 15_000,
            })
            .toBeGreaterThanOrEqual(1)
        } else {
          const count = await jobCount(order.submissionId)
          expect(count, `${persona.company} should be HELD — no generation job enqueued`).toBe(0)
        }

        // ── Flag rows match the severity mix scoreRisk's level boundary needs ──
        const sb = db()
        const { data: flagRows, error: flagErr } = await sb
          .from('risk_flags')
          .select('severity')
          .eq('submission_id', order.submissionId)
        expect(flagErr, `${persona.company} risk_flags lookup`).toBeNull()
        const severities = (flagRows ?? []).map((r) => r.severity as string)
        const highCount = severities.filter((s) => s === 'high').length
        const mediumCount = severities.filter((s) => s === 'medium').length

        if (persona.expectedRisk === 'low') {
          expect(highCount, `${persona.company} low case should have no high flags`).toBe(0)
          expect(mediumCount, `${persona.company} low case should have <2 medium flags`).toBeLessThan(2)
        } else if (persona.expectedRisk === 'medium') {
          expect(highCount, `${persona.company} medium case should have no high flags`).toBe(0)
          expect(mediumCount, `${persona.company} medium case should have >=2 medium flags`).toBeGreaterThanOrEqual(2)
        } else if (persona.expectedRisk === 'high') {
          expect(highCount, `${persona.company} high case should have >=1 high flag`).toBeGreaterThanOrEqual(1)
        } else {
          expect(highCount, `${persona.company} critical case should have >=2 high flags`).toBeGreaterThanOrEqual(2)
        }

        // ── Baseline: nothing has asked for a revision or more info yet ──
        const { data: revisions, error: revErr } = await sb
          .from('case_revisions')
          .select('id')
          .eq('order_id', order.orderId)
        expect(revErr, `${persona.company} case_revisions lookup`).toBeNull()
        expect(revisions ?? [], `${persona.company} should have no revisions yet`).toHaveLength(0)

        const { data: infoRequests, error: infoErr } = await sb
          .from('info_requests')
          .select('id')
          .eq('order_id', order.orderId)
        expect(infoErr, `${persona.company} info_requests lookup`).toBeNull()
        expect(infoRequests ?? [], `${persona.company} should have no info requests yet`).toHaveLength(0)
      } finally {
        await ctx.close()
      }
    })
  }
})
