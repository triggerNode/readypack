import { test, expect, type APIRequestContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from './lib/test-env'
import { PERSONAS, type Persona } from './lib/personas'
import { uploadPersonaLogo, withLogo } from './lib/logo'

// ──────────────────────────────────────────────────────────────────────────
// Smoke Test 2 — paid coverage beyond the Lumen anchor (full-journey.spec.ts).
// Deliberately does NOT reset, so the Lumen anchor pack survives for the
// uniqueness comparison. Gated; serial.
//   $env:RUN_REAL_GENERATION = "1"
// Covers: a second deep pack (Cobalt, medium/procurement), pack uniqueness,
// the high-risk admin "Generate → flags block approval → resolve → unblock"
// loop (Northwind), and the critical hold (MediMind).
// ──────────────────────────────────────────────────────────────────────────

function db(): SupabaseClient {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function seedSubmit(request: APIRequestContext, sb: SupabaseClient, persona: Persona) {
  const createRes = await request.post('/api/admin/dev/create-test', {
    data: { plan: persona.tier, prefillTo: 0, reset: false },
  })
  expect(createRes.ok(), `create-test failed: ${await createRes.text()}`).toBeTruthy()
  const { submissionId } = (await createRes.json()) as { submissionId: string }
  const { data: sub } = await sb.from('intake_submissions').select('order_id').eq('id', submissionId).single()
  const orderId = sub!.order_id as string
  const logoUrl = await uploadPersonaLogo(sb, persona, submissionId)
  await sb.from('intake_submissions').update({ raw_answers: withLogo(persona.answers, logoUrl) }).eq('id', submissionId)
  const submitRes = await request.post('/api/intake/submit', { data: { submissionId } })
  expect(submitRes.ok(), `submit failed: ${await submitRes.text()}`).toBeTruthy()
  const riskLevel = (JSON.parse(await submitRes.text()) as { riskLevel: string }).riskLevel
  return { orderId, submissionId, riskLevel, logoUrl }
}

async function waitForDocs(sb: SupabaseClient, submissionId: string, target = 9, tries = 84) {
  let count = 0
  for (let i = 0; i < tries; i++) {
    const { data: docs } = await sb.from('generated_documents').select('id').eq('submission_id', submissionId)
    count = docs?.length ?? 0
    const { data: job } = await sb
      .from('document_generation_jobs').select('status').eq('submission_id', submissionId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (count >= target || (job?.status && job.status !== 'running' && job.status !== 'pending')) break
    await new Promise((r) => setTimeout(r, 5000))
  }
  return count
}

const persona = (k: string) => PERSONAS.find((p) => p.key === k)!

test.describe.serial('Smoke Test 2 — paid coverage', () => {
  test.skip(process.env.RUN_REAL_GENERATION !== '1', 'Gated: set RUN_REAL_GENERATION=1 (spends AI credit).')

  test('Cobalt (medium/procurement) generates a branded, personalised 9-doc pack', async ({ request }) => {
    test.setTimeout(600_000)
    const sb = db()
    const cobalt = persona('cobalt')
    const { submissionId, riskLevel } = await seedSubmit(request, sb, cobalt)
    expect(riskLevel, 'Cobalt should be medium').toBe('medium')

    const count = await waitForDocs(sb, submissionId, 9)
    console.log(`Cobalt produced ${count} documents.`)
    expect(count, 'Cobalt should be a complete 9-doc pack (incl. DPIA-Lite)').toBe(9)

    const { data: docs } = await sb
      .from('generated_documents').select('document_type, render_metadata').eq('submission_id', submissionId)
    const types = (docs ?? []).map((d) => d.document_type).sort()
    expect(types, 'includes DPIA-Lite').toContain('dpia_lite')
    const p = ((docs?.[0]?.render_metadata as Record<string, unknown>)?.personalisation as Record<string, unknown>) ?? {}
    console.log('Cobalt personalisation:', JSON.stringify({ companyName: p.companyName, contactName: p.contactName, contactRole: p.contactRole }))
    expect(p.companyName, 'real company name').toBe('Cobalt Labs Ltd')
    expect(p.contactName, 'real governance contact (ST2-2 fix)').toBe('Daniel Okafor')
    expect(String(p.contactName ?? ''), 'not the generic default').not.toBe('Document Owner')
  })

  test('two packs (Lumen vs Cobalt) are clearly different', async () => {
    const sb = db()
    async function packDoc(company: string, docType: string) {
      const { data: subs } = await sb.from('intake_submissions').select('id, normalised_answers, created_at').order('created_at', { ascending: false }).limit(40)
      const sub = (subs ?? []).find((s) => (s.normalised_answers as Record<string, unknown> | null)?.company_name === company)
      if (!sub) return null
      const { data: d } = await sb.from('generated_documents').select('content_json').eq('submission_id', sub.id).eq('document_type', docType).maybeSingle()
      return d?.content_json ?? null
    }
    const lumen = await packDoc('Lumen Studio Ltd', 'vendor_ai_register')
    const cobalt = await packDoc('Cobalt Labs Ltd', 'vendor_ai_register')
    test.skip(!lumen || !cobalt, 'Need both Lumen (anchor) and Cobalt packs present to compare.')
    const lj = JSON.stringify(lumen)
    const cj = JSON.stringify(cobalt)
    console.log(`Lumen vendor_ai_register length=${lj.length}, Cobalt length=${cj.length}`)
    expect(cj, 'the two packs must not be identical').not.toBe(lj)
    // Cobalt's register should mention a vendor unique to it (Anthropic/Pinecone); Lumen's should not.
    expect(cj.includes('Pinecone') || cj.includes('Anthropic'), 'Cobalt register reflects its own vendors').toBeTruthy()
    expect(lj.includes('Pinecone'), 'Lumen register should not contain Cobalt-only vendors').toBeFalsy()
  })

  test('Northwind (HIGH) — admin generate → flags block approval → resolve → unblock (no limbo)', async ({ request }) => {
    test.setTimeout(600_000)
    const sb = db()
    const northwind = persona('northwind')
    const { orderId, submissionId, riskLevel } = await seedSubmit(request, sb, northwind)
    expect(riskLevel, 'Northwind should be high').toBe('high')

    // Held: no auto-generation job should have been created.
    await new Promise((r) => setTimeout(r, 2500))
    const { data: autoJobs } = await sb.from('document_generation_jobs').select('id').eq('submission_id', submissionId)
    expect((autoJobs ?? []).length, 'high-risk case must NOT auto-generate').toBe(0)

    // Admin "Generate Pack" — same call triggerGenerationAction makes.
    const genRes = await request.post('/api/generate', { data: { order_id: orderId, _internal: true }, timeout: 300_000 })
    expect(genRes.ok(), `admin generate failed: ${genRes.status()} ${await genRes.text()}`).toBeTruthy()
    const count = await waitForDocs(sb, submissionId, 9)
    console.log(`Northwind (admin-generated) produced ${count} documents.`)
    expect(count, 'admin-generated high-risk pack should be 9 docs').toBe(9)

    // Approval gating: the exact query approvePackAction runs (open high/critical flags).
    async function blockingFlags() {
      const { count: n } = await sb.from('risk_flags').select('id', { count: 'exact', head: true })
        .eq('submission_id', submissionId).eq('status', 'open').in('severity', ['high', 'critical'])
      return n ?? 0
    }
    const before = await blockingFlags()
    console.log(`Open high/critical flags before resolution: ${before}`)
    expect(before, 'high-risk case should have open flags that block approval').toBeGreaterThan(0)

    // Admin resolves/overrides them (mirrors markFlagResolvedAction's DB effect).
    await sb.from('risk_flags').update({ status: 'resolved' })
      .eq('submission_id', submissionId).eq('status', 'open').in('severity', ['high', 'critical'])
    const after = await blockingFlags()
    console.log(`Open high/critical flags after resolution: ${after}`)
    expect(after, 'after resolution, nothing should block approval').toBe(0)
  })

  test('MediMind (CRITICAL) is held — no auto-generation, no documents', async ({ request }) => {
    test.setTimeout(120_000)
    const sb = db()
    const medimind = persona('medimind')
    const { submissionId, riskLevel } = await seedSubmit(request, sb, medimind)
    expect(riskLevel, 'MediMind should be critical').toBe('critical')
    await new Promise((r) => setTimeout(r, 3000))
    const { data: jobs } = await sb.from('document_generation_jobs').select('id').eq('submission_id', submissionId)
    const { data: docs } = await sb.from('generated_documents').select('id').eq('submission_id', submissionId)
    console.log(`MediMind held → jobs=${(jobs ?? []).length}, docs=${(docs ?? []).length}`)
    expect((jobs ?? []).length, 'critical case must NOT auto-generate a job').toBe(0)
    expect((docs ?? []).length, 'critical case must have no documents until admin acts').toBe(0)
  })
})
