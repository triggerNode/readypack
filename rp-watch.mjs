import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL||env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_ROLE||env.SUPABASE_KEY)
const email = process.argv[2]
if (!email) { console.log('usage: node rp-watch.mjs <email>'); process.exit(0) }
const { data: users } = await db.from('users').select('id,email,created_at').eq('email', email)
if (!users || !users.length) { console.log('No user for '+email+' yet (payment/webhook not landed).'); process.exit(0) }
for (const u of users) {
  const { data: orders } = await db.from('orders').select('*').eq('user_id', u.id).order('created_at',{ascending:false})
  for (const o of (orders||[])) {
    console.log(`\nORDER ${o.display_reference||o.id}  plan=${o.plan_selected}  pay=${o.payment_status}  delivery=${o.delivery_status}  ${o.created_at}`)
    const { data: subs } = await db.from('intake_submissions').select('*').eq('order_id', o.id)
    for (const s of (subs||[])) {
      console.log(`  SUBMISSION ${s.id.slice(0,8)}  completion=${s.completion_status}  risk=${s.risk_level}`)
      const { data: jobs } = await db.from('document_generation_jobs').select('*').eq('submission_id', s.id).order('created_at')
      for (const j of (jobs||[])) console.log(`    JOB ${j.status}  attempts=${j.attempt_count}  err=${j.error_message||'-'}  ${j.completed_at||''}`)
      const { data: docs } = await db.from('generated_documents').select('document_type,version_number,qa_status,delivery_status,file_url,page_count').eq('submission_id', s.id).order('document_type')
      console.log(`    DOCS: ${docs?docs.length:0}`)
      for (const d of (docs||[])) console.log(`      ${d.document_type} v${d.version_number} qa=${d.qa_status} delivery=${d.delivery_status} pages=${d.page_count} ${d.file_url?'[file]':'[no-file]'}`)
      const { data: flags } = await db.from('risk_flags').select('severity,status,explanation').eq('submission_id', s.id)
      if (flags&&flags.length) { console.log(`    FLAGS: ${flags.length}`); for (const f of flags) console.log(`      [${f.severity}/${f.status}] ${(f.explanation||'').slice(0,80)}`) }
      const { data: revs } = await db.from('case_revisions').select('kind,status,document_types,feedback_text').eq('submission_id', s.id)
      for (const r of (revs||[])) console.log(`    REVISION ${r.kind}/${r.status} docs=${JSON.stringify(r.document_types)} "${(r.feedback_text||'').slice(0,50)}"`)
    }
  }
}
