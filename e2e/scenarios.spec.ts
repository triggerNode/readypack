import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'
import { PERSONAS, type Persona } from './lib/personas'

// ──────────────────────────────────────────────────────────────────────────
// The 10 friends — risk routing & generation gating.
//
// For each persona we: create a paid order, write their answers, submit, and
// check (a) the system assigns the RIGHT risk level and (b) it auto-generates
// for low/medium but HOLDS high/critical for admin review.
//
// By default only the HELD personas (high/critical) run — they don't generate,
// so it's free and fast. The auto-generating ones run with RUN_REAL_GENERATION=1.
// ──────────────────────────────────────────────────────────────────────────

const RUN_ALL = process.env.RUN_REAL_GENERATION === '1'
const SELECTED: Persona[] = RUN_ALL ? PERSONAS : PERSONAS.filter((p) => !p.expectAutoGen)

function db() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type Row = { company: string; tier: string; expected: string; actual: string; autoGenExpected: boolean; jobCreated: boolean; caseStatus: string; ok: boolean }
const results: Row[] = []

test.describe.serial('The 10 friends — routing & gating', () => {
  SELECTED.forEach((p, index) => {
    test(`${p.company} → expect ${p.expectedRisk}${p.expectAutoGen ? ' (auto-gen)' : ' (held)'}`, async ({ request }) => {
      test.setTimeout(120_000)
      const sb = db()

      // 1. Seed a paid order on the right tier. Reset only on the first run.
      const createRes = await request.post('/api/admin/dev/create-test', {
        data: { plan: p.tier, prefillTo: 0, reset: index === 0 },
      })
      expect(createRes.ok(), `create-test failed: ${createRes.status()} ${await createRes.text()}`).toBeTruthy()
      const { submissionId } = (await createRes.json()) as { submissionId: string }

      const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
      const orderId = sub?.order_id as string

      // 2. Write this persona's answers, then submit through the real pipeline.
      await sb.from('intake_submissions').update({ raw_answers: p.answers }).eq('id', submissionId)
      const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
      const submitBody = await submitRes.text()
      expect(submitRes.ok(), `submit failed: ${submitRes.status()} ${submitBody}`).toBeTruthy()
      const actualRisk = (JSON.parse(submitBody) as { riskLevel: string }).riskLevel

      // 3. Gating: a generation job should exist only for low/medium.
      let jobCreated = false
      for (let i = 0; i < 6; i++) {
        const { data: jobs } = await sb.from('document_generation_jobs').select('id').eq('submission_id', submissionId).limit(1)
        if (jobs && jobs.length > 0) { jobCreated = true; break }
        if (!p.expectAutoGen && i >= 2) break // held cases shouldn't ever create one
        await new Promise((r) => setTimeout(r, 700))
      }

      const { data: caseRow } = await sb.from('cases').select('status').eq('id', orderId).maybeSingle()
      const caseStatus = (caseRow?.status as string) ?? 'unknown'

      const ok = actualRisk === p.expectedRisk && jobCreated === p.expectAutoGen
      results.push({ company: p.company, tier: p.tier, expected: p.expectedRisk, actual: actualRisk, autoGenExpected: p.expectAutoGen, jobCreated, caseStatus, ok })

      expect(actualRisk, `${p.company}: wrong risk level`).toBe(p.expectedRisk)
      expect(jobCreated, `${p.company}: auto-gen gating wrong (expected ${p.expectAutoGen})`).toBe(p.expectAutoGen)
    })
  })

  test.afterAll(() => {
    console.log('\n=== SCENARIO SUMMARY ===')
    console.log('company             | tier              | expect→actual | autoGen exp/act | case_status')
    for (const r of results) {
      console.log(
        `${r.company.padEnd(20)}| ${r.tier.padEnd(18)}| ${r.expected}→${r.actual}`.padEnd(58) +
          `| ${r.autoGenExpected}/${r.jobCreated}`.padEnd(18) +
          `| ${r.caseStatus}  ${r.ok ? 'OK' : 'MISMATCH'}`,
      )
    }
  })
})
