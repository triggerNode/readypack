// One-off diagnostic: read why document generation produced zero documents.
// Read-only. Prints the recorded error for each failed document and lists
// the storage buckets. Run: node e2e/diag.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// minimal .env.local loader
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

console.log('ANTHROPIC_API_KEY present:', !!env.ANTHROPIC_API_KEY, '| length:', (env.ANTHROPIC_API_KEY || '').length)
console.log('ANTHROPIC_ZDR_VERIFIED:', env.ANTHROPIC_ZDR_VERIFIED)

const { data: events, error } = await db
  .from('generation_events')
  .select('document_type, model, status, error_message, created_at')
  .order('created_at', { ascending: false })
  .limit(15)

if (error) console.log('events query error:', error.message)
else {
  console.log('\n=== latest generation_events ===')
  for (const e of events) {
    console.log(`- [${e.status}] ${e.document_type} (${e.model ?? 'no-model'}): ${e.error_message ?? 'no error recorded'}`)
  }
}

const { data: buckets, error: bErr } = await db.storage.listBuckets()
console.log('\n=== storage buckets ===')
console.log(bErr ? 'error: ' + bErr.message : buckets.map((b) => `${b.name} (public=${b.public})`).join(', '))
