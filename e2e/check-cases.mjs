// Do the held high/critical cases actually appear in the admin queue data?
// Reads the `cases` view the admin list is built from. Read-only.
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

const { data, error } = await db
  .from('cases')
  .select('id, company_name, client_org_name, risk_level, status, completion_status, open_flag_count, critical_flag_count')
  .order('order_created_at', { ascending: false })
  .limit(8)

if (error) {
  console.log('CASES VIEW ERROR:', error.message)
} else {
  console.log(`cases view returned ${data.length} rows:`)
  for (const c of data) {
    console.log(
      `  - ${(c.company_name || c.client_org_name || '?').padEnd(26)} risk=${(c.risk_level ?? '-').padEnd(8)} status=${(c.status ?? '-').padEnd(12)} openFlags=${c.open_flag_count} critical=${c.critical_flag_count}`,
    )
  }
}
