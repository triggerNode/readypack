// Admin Generation Queue
// Server Component. Auth is enforced by app/admin/layout.tsx → requireAdmin().
// Lists all document generation jobs with their documents, QA status, reuse stats, and cost.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { DOCUMENT_TYPE_TITLES } from '@/lib/documents/content-schemas'
import type { DocumentType } from '@/types/database'
import styles from './generation-queue.module.css'

export const dynamic = 'force-dynamic'

interface JobRow {
  id: string
  order_id: string
  submission_id: string
  org_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  attempt_count: number
  created_at: string
}

interface OrderRow {
  id: string
  user_id: string
  client_org_id: string
  plan_selected: string
  delivery_status: string
  created_at: string
}

interface GeneratedDocRow {
  id: string
  submission_id: string
  document_type: DocumentType
  qa_status: string
  file_url: string | null
  render_metadata: Record<string, unknown> | null
  generated_at: string | null
  page_count: number | null
  file_size_bytes: number | null
}

interface EventRow {
  order_id: string
  cost_usd: number | null
  content_reused: boolean
  status: string
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'running':
      return styles.badgeRunning
    case 'completed':
      return styles.badgeCompleted
    case 'failed':
      return styles.badgeFailed
    default:
      return styles.badgeQueued
  }
}

function qaBadgeClass(qa: string): string {
  switch (qa) {
    case 'passed':
      return styles.qaBadgePass
    case 'flagged':
      return styles.qaBadgeFlagged
    case 'failed':
      return styles.qaBadgeFlagged
    case 'running':
      return styles.qaBadgeRunning
    default:
      return styles.qaBadgePending
  }
}

function qaLabel(qa: string): string {
  switch (qa) {
    case 'passed':
      return 'QA pass'
    case 'flagged':
      return 'QA flagged'
    case 'failed':
      return 'QA failed'
    case 'running':
      return 'QA running'
    default:
      return 'Pending QA'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'running':
      return 'Running'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatAbs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${month} ${time}`
}

export default async function GenerationQueuePage() {
  const { data: jobs } = await supabaseAdmin
    .from('document_generation_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const jobList = (jobs || []) as JobRow[]
  const orderIds = jobList.map(j => j.order_id)
  const submissionIds = jobList.map(j => j.submission_id)

  let orderMap = new Map<string, OrderRow>()
  let userMap = new Map<string, { email: string; company_name: string | null }>()
  let orgMap = new Map<string, { name: string }>()
  const docsByJob = new Map<string, GeneratedDocRow[]>()
  const eventsByOrder = new Map<string, { cost: number; reused: number; failed: number }>()

  if (orderIds.length > 0) {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id,user_id,client_org_id,plan_selected,delivery_status,created_at')
      .in('id', orderIds)
    const orderRows = (orders || []) as OrderRow[]
    orderMap = new Map(orderRows.map(o => [o.id, o]))

    const userIds = Array.from(new Set(orderRows.map(o => o.user_id)))
    const orgIds = Array.from(new Set(orderRows.map(o => o.client_org_id)))

    const [usersResult, orgsResult] = await Promise.all([
      supabaseAdmin.from('users').select('id,email,company_name').in('id', userIds),
      supabaseAdmin.from('organisations').select('id,name').in('id', orgIds),
    ])
    userMap = new Map(
      ((usersResult.data || []) as { id: string; email: string; company_name: string | null }[]).map(
        u => [u.id, { email: u.email, company_name: u.company_name }],
      ),
    )
    orgMap = new Map(
      ((orgsResult.data || []) as { id: string; name: string }[]).map(o => [o.id, { name: o.name }]),
    )
  }

  if (submissionIds.length > 0) {
    const { data: docs } = await supabaseAdmin
      .from('generated_documents')
      .select('id,submission_id,document_type,qa_status,file_url,render_metadata,generated_at,page_count,file_size_bytes')
      .in('submission_id', submissionIds)
      .order('document_type', { ascending: true })

    const docList = (docs || []) as GeneratedDocRow[]
    const subToJob = new Map<string, string>()
    for (const job of jobList) subToJob.set(job.submission_id, job.id)
    for (const doc of docList) {
      const jobId = subToJob.get(doc.submission_id)
      if (!jobId) continue
      const arr = docsByJob.get(jobId) || []
      arr.push(doc)
      docsByJob.set(jobId, arr)
    }
  }

  if (orderIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from('generation_events')
      .select('order_id,cost_usd,content_reused,status')
      .in('order_id', orderIds)

    for (const e of (events || []) as EventRow[]) {
      const agg = eventsByOrder.get(e.order_id) || { cost: 0, reused: 0, failed: 0 }
      agg.cost += Number(e.cost_usd || 0)
      if (e.content_reused) agg.reused++
      if (e.status === 'failed') agg.failed++
      eventsByOrder.set(e.order_id, agg)
    }
  }

  // Aggregate stats
  const totalJobs = jobList.length
  const completedJobs = jobList.filter(j => j.status === 'completed').length
  const failedJobs = jobList.filter(j => j.status === 'failed').length
  let pendingQa = 0
  Array.from(docsByJob.values()).forEach(docs => {
    pendingQa += docs.filter(d => d.qa_status === 'pending').length
  })
  let totalCost = 0
  let totalReused = 0
  Array.from(eventsByOrder.values()).forEach(agg => {
    totalCost += agg.cost
    totalReused += agg.reused
  })

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pagehead}>
          <div>
            <h1>Document Generation Queue</h1>
            <div className={styles.subtitle}>
              <span className={styles.liveDot} aria-hidden />
              Live feed of background document compilation jobs and API costs.
            </div>
          </div>
          <div className={styles.refresh}>
            <RefreshIcon />
            Auto-refreshing · 5s
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Total jobs</p>
            <p className={styles.statValue}>{totalJobs}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Completed</p>
            <p className={`${styles.statValue} ${styles.statValueGreen}`}>{completedJobs}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Failed</p>
            <p className={`${styles.statValue} ${styles.statValueRed}`}>{failedJobs}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Pending QA</p>
            <p className={`${styles.statValue} ${styles.statValueAmber}`}>{pendingQa}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Docs reused</p>
            <p className={styles.statValue}>{totalReused}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Est. API cost</p>
            <p className={styles.statValue}>${totalCost.toFixed(2)}</p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          {jobList.length === 0 ? (
            <div className={styles.empty}>
              No generation jobs yet. Generate a pack via POST /api/generate.
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.colOrder}>Order / Customer</th>
                  <th scope="col" className={styles.colStatus}>Status</th>
                  <th scope="col" className={`${styles.colDocs} ${styles.thCenter}`}>Documents</th>
                  <th scope="col" className={`${styles.colReused} ${styles.thCenter}`}>Reused</th>
                  <th scope="col" className={`${styles.colCost} ${styles.thRight}`}>Cost</th>
                  <th scope="col" className={`${styles.colStarted} ${styles.thRight}`}>Started</th>
                </tr>
              </thead>
              <tbody>
                {jobList.map(job => {
                  const order = orderMap.get(job.order_id)
                  const user = order ? userMap.get(order.user_id) : undefined
                  const orgRow = order ? orgMap.get(order.client_org_id) : undefined
                  const docs = docsByJob.get(job.id) || []
                  const eventAgg = eventsByOrder.get(job.order_id)
                  const customerLabel = orgRow?.name || user?.company_name || user?.email || 'Unknown'
                  const docsCount = docs.length
                  const docsCountLabel = `${docsCount} / 9`
                  const cost = eventAgg?.cost ?? 0

                  return (
                    <tr key={job.id}>
                      <td className={styles.colOrder}>
                        <div className={styles.custName}>{customerLabel}</div>
                        <div className={styles.custEmail}>
                          {user?.email || '—'} · Order {job.order_id.substring(0, 8)}
                        </div>
                        {docs.length > 0 ? (
                          <div className={styles.doclist}>
                            {docs.slice(0, 4).map(doc => {
                              const reused =
                                doc.render_metadata &&
                                (doc.render_metadata as Record<string, unknown>).content_reused === true
                              return (
                                <div key={doc.id} className={styles.doclistRow}>
                                  <span className={styles.doclistIcon}>
                                    <FileTextIcon />
                                  </span>
                                  <span className={styles.doclistName}>
                                    {DOCUMENT_TYPE_TITLES[doc.document_type]}
                                  </span>
                                  <span className={styles.doclistSize}>{formatBytes(doc.file_size_bytes)}</span>
                                  <span className={styles.doclistSpacer} />
                                  {reused ? (
                                    <span className={styles.reusePill}>
                                      <RecycleIcon />
                                      reused
                                    </span>
                                  ) : null}
                                  <span className={`${styles.qaBadge} ${qaBadgeClass(doc.qa_status)}`}>
                                    {qaLabel(doc.qa_status)}
                                  </span>
                                  {doc.file_url ? (
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={styles.doclistLink}
                                    >
                                      View →
                                    </a>
                                  ) : null}
                                </div>
                              )
                            })}
                            {docs.length > 4 ? (
                              <div className={styles.doclistRow}>
                                <span className={styles.doclistSize}>
                                  + {docs.length - 4} more documents
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className={styles.colStatus}>
                        <span className={`${styles.badge} ${statusBadgeClass(job.status)}`}>
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      <td className={`${styles.colDocs} ${styles.center}`}>
                        <span className={`${styles.num} ${docsCount === 9 ? styles.numFull : ''}`}>
                          {docsCountLabel}
                        </span>
                      </td>
                      <td className={`${styles.colReused} ${styles.center}`}>
                        <span className={styles.num}>{eventAgg?.reused ?? 0}</span>
                      </td>
                      <td className={`${styles.colCost} ${styles.right}`}>
                        <span className={`${styles.cost} ${cost > 0 ? styles.costCharged : styles.costZero}`}>
                          ${cost.toFixed(4)}
                        </span>
                      </td>
                      <td className={`${styles.colStarted} ${styles.right}`}>
                        <div className={styles.started}>{formatRelative(job.started_at)}</div>
                        <div className={styles.startedAbs}>{formatAbs(job.started_at)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.footerLine}>
          Showing {jobList.length} of {jobList.length} jobs
        </div>
      </div>
    </div>
  )
}

/* ── Inline icons ────────────────────────── */

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function RecycleIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 19H4a2 2 0 0 1-1.73-3l5-9" />
      <path d="m17 5 3 5h-3" />
      <path d="m14 19 3-3-3-3" />
      <path d="m7 5 4 6" />
    </svg>
  )
}
