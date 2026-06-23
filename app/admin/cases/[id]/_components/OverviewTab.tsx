import type { ReactNode } from 'react'
import { AlertTriangle, Check, Loader, X } from 'lucide-react'
import type { CaseRow } from '../../../_lib/cases'
import { DOCUMENT_TYPE_TITLES } from '@/lib/documents/content-schemas'
import styles from '../case-detail.module.css'

type DocumentRow = {
  id: string
  document_type: string
  qa_status: 'pending' | 'passed' | 'flagged' | 'failed'
  delivery_status: 'pending' | 'approved' | 'in_revision' | 'delivered' | 'failed'
  generated_at: string | null
}

type AiToolRow = { id: string; tool_name: string; vendor: string | null }
type VendorRow = { id: string; vendor_name: string }
type FlagPreview = { id: string; severity: 'low' | 'medium' | 'high' | 'critical'; explanation: string }
type ActivityRow = { label: string; at: string; tone: 'green' | 'indigo' | 'grey' }

type Props = {
  c: CaseRow
  documents: ReadonlyArray<DocumentRow>
  aiTools: ReadonlyArray<AiToolRow>
  vendors: ReadonlyArray<VendorRow>
  openFlags: ReadonlyArray<FlagPreview>
  activity: ReadonlyArray<ActivityRow>
  qaStartedIso: string | null
}

const ICON = { size: 11, strokeWidth: 1.5 } as const

function docBadge(status: DocumentRow['qa_status']): { label: string; className: string; icon: ReactNode } {
  switch (status) {
    case 'passed':
      return { label: 'Generated', className: styles.docBadgeGen, icon: <Check {...ICON} /> }
    case 'pending':
      return { label: 'QA Running', className: styles.docBadgeRunning, icon: <Loader {...ICON} /> }
    case 'flagged':
      return { label: 'QA Flagged', className: styles.docBadgeFlagged, icon: <AlertTriangle {...ICON} /> }
    case 'failed':
    default:
      return { label: 'Failed', className: styles.docBadgeFailed, icon: <X {...ICON} /> }
  }
}

function docTitle(type: string): string {
  return (DOCUMENT_TYPE_TITLES as Record<string, string>)[type] ?? type
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / (1000 * 60))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) return `${hours}h ${remMins.toString().padStart(2, '0')}m ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function qaTone(status: CaseRow['status']): { dot: string; text: string; label: string } {
  switch (status) {
    case 'flagged':
      return { dot: styles.qaDotFlag, text: styles.qaStatusTextFlag, label: 'QA Flagged' }
    case 'in_progress':
      return { dot: styles.qaDotRunning, text: styles.qaStatusTextRunning, label: 'QA Running' }
    case 'ready':
      return { dot: styles.qaDotReady, text: styles.qaStatusTextReady, label: 'QA Passed' }
    case 'delivered':
      return { dot: styles.qaDotReady, text: styles.qaStatusTextReady, label: 'Delivered' }
    case 'pending':
    default:
      return { dot: styles.qaDotMuted, text: styles.qaStatusTextMuted, label: 'QA Pending' }
  }
}

export function OverviewTab({ c, documents, aiTools, vendors, openFlags, activity, qaStartedIso }: Props) {
  const qa = qaTone(c.status)

  return (
    <div className={styles.grid2}>
      {/* Card 1 — Customer */}
      <div className={styles.ocard}>
        <div className={styles.ocardLabel}>Customer</div>
        <div className={styles.custName}>{c.client_org_name ?? c.company_name ?? '—'}</div>
        {c.trading_name ? (
          <div className={styles.custLine}>Trading as: {c.trading_name}</div>
        ) : null}
        <div className={`${styles.custLine} ${styles.custLineMuted}`}>{c.customer_email ?? '—'}</div>
        <hr className={styles.hr} />
        <div className={styles.custFact}>Billing org: {c.billing_org_name ?? '—'}</div>
        <div className={styles.custFact}>AI tools declared: {aiTools.length}</div>
        <div className={styles.custFact}>Vendors declared: {vendors.length}</div>
      </div>

      {/* Card 2 — QA Report */}
      <div className={styles.ocard}>
        <div className={styles.ocardLabel}>QA Report</div>
        <div className={styles.qaStatus}>
          <span className={`${styles.qaDot} ${qa.dot}`} aria-hidden />
          <span className={`${styles.qaStatusText} ${qa.text}`}>{qa.label}</span>
          {qaStartedIso ? (
            <span className={styles.qaSub}>· Started {formatTimeAgo(qaStartedIso)}</span>
          ) : null}
        </div>
        <div className={styles.qaCount}>
          {c.open_flag_count} {c.open_flag_count === 1 ? 'flag' : 'flags'} detected
          {c.risk_level === 'critical' || c.risk_level === 'high'
            ? ` · ${c.risk_level} risk`
            : ''}
        </div>
        {openFlags.length === 0 ? (
          <div className={styles.qaNote}>No open flags.</div>
        ) : (
          openFlags.slice(0, 2).map(f => (
            <div key={f.id} className={styles.qaFlagrow}>
              <span className={styles.fdot} aria-hidden />
              {f.explanation.slice(0, 120)}
            </div>
          ))
        )}
        <div className={styles.qaNote}>Full report available in QA Report tab</div>
      </div>

      {/* Card 3 — Documents */}
      <div className={styles.ocard}>
        <div className={styles.ocardLabel}>Documents</div>
        <div style={{ marginTop: 10 }}>
          {documents.length === 0 ? (
            <div className={styles.qaNote}>No documents generated yet.</div>
          ) : (
            documents.map(d => {
              const badge = docBadge(d.qa_status)
              return (
                <div key={d.id} className={styles.docRow}>
                  <span>{docTitle(d.document_type)}</span>
                  <span className={`${styles.docBadge} ${badge.className}`}>
                    {badge.icon}
                    {badge.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Card 4 — Recent Activity */}
      <div className={styles.ocard}>
        <div className={styles.ocardLabel}>Recent Activity</div>
        <div style={{ marginTop: 10 }}>
          {activity.length === 0 ? (
            <div className={styles.qaNote}>Nothing recent.</div>
          ) : (
            activity.map((row, i) => {
              const dotClass =
                row.tone === 'green'
                  ? styles.actDotGreen
                  : row.tone === 'indigo'
                  ? styles.actDotIndigo
                  : styles.actDotGrey
              return (
                <div key={`${row.at}-${i}`} className={styles.actRow}>
                  <span className={`${styles.actDot} ${dotClass}`} aria-hidden />
                  <span className={styles.actText}>{row.label}</span>
                  <span className={styles.actTime}>{formatTimeAgo(row.at)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
