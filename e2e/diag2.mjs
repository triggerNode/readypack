// Check whether the latest generation actually produced documents + PDFs.
// Read-only. Run: node e2e/diag2.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).replace(/\s+#.*$/, '').trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: orders } = await db
  .from('orders')
  .select('id, created_at, delivery_status')
  .order('created_at', { ascending: false })
  .limit(3)

for (const o of orders ?? []) {
  console.log(`\n=== order ${o.id}  (${o.delivery_status})  ${o.created_at} ===`)
  const { data: docs } = await db
    .from('generated_documents')
    .select('document_type, page_count, file_size_bytes, file_url')
    .eq('org_id', null) // placeholder, replaced below
  // generated_documents links by submission; fetch via submission
  const { data: sub } = await db.from('intake_submissions').select('id').eq('order_id', o.id).maybeSingle()
  if (sub) {
    const { data: gdocs } = await db
      .from('generated_documents')
      .select('document_type, page_count, file_size_bytes')
      .eq('submission_id', sub.id)
    console.log(`  generated_documents rows: ${gdocs?.length ?? 0}`)
    for (const d of gdocs ?? []) {
      console.log(`    - ${d.document_type}: ${d.page_count}pp, ${d.file_size_bytes} bytes`)
    }
  }
  const { data: files, error: lerr } = await db.storage.from('documents').list(o.id)
  console.log(`  storage files: ${lerr ? 'ERR ' + lerr.message : (files?.length ?? 0)}`)
  for (const f of files ?? []) console.log(`    - ${f.name} (${f.metadata?.size ?? '?'} bytes)`)
}

const { data: ev } = await db
  .from('generation_events')
  .select('status')
  .order('created_at', { ascending: false })
  .limit(20)
const counts = (ev ?? []).reduce((a, e) => ((a[e.status] = (a[e.status] || 0) + 1), a), {})
console.log('\n=== last 20 generation_events by status ===')
console.log(counts)
