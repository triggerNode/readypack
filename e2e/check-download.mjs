// Does a customer's download link actually work?
// The app builds links with getPublicUrl() but the "documents" store is private.
// This proves whether that link opens, and whether a *signed* link would.
// Read-only. Run: node e2e/check-download.mjs
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

// Find the most recent order that actually has PDF files in storage.
const { data: orders } = await db
  .from('orders')
  .select('id')
  .order('created_at', { ascending: false })
  .limit(5)

let orderId = null
let fileName = null
for (const o of orders ?? []) {
  const { data: files } = await db.storage.from('documents').list(o.id)
  if (files && files.length > 0) {
    orderId = o.id
    fileName = files[0].name
    break
  }
}
if (!orderId) {
  console.log('No order with stored PDFs found — run the generation probe first.')
  process.exit(0)
}
const path = `${orderId}/${fileName}`
console.log('Testing download of:', path, '\n')

// 1. The PUBLIC link the app currently hands the customer.
const { data: pub } = db.storage.from('documents').getPublicUrl(path)
const pubRes = await fetch(pub.publicUrl)
console.log('PUBLIC link (what the customer gets today):')
console.log('  url   :', pub.publicUrl)
console.log('  status:', pubRes.status, pubRes.statusText)
console.log('  type  :', pubRes.headers.get('content-type'), '\n')

// 2. A SIGNED link (the fix).
const { data: signed, error: signErr } = await db.storage
  .from('documents')
  .createSignedUrl(path, 60)
if (signErr) {
  console.log('SIGNED link error:', signErr.message)
} else {
  const sRes = await fetch(signed.signedUrl)
  const buf = Buffer.from(await sRes.arrayBuffer())
  console.log('SIGNED link (the fix):')
  console.log('  status:', sRes.status, sRes.statusText)
  console.log('  type  :', sRes.headers.get('content-type'))
  console.log('  bytes :', buf.length, '| starts with %PDF:', buf.subarray(0, 4).toString() === '%PDF')
}
