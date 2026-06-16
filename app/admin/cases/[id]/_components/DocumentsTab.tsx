import { DOCUMENT_TYPE_TITLES } from '@/lib/documents/content-schemas'
import type { DocumentType } from '@/types/database'
import styles from './detail-tabs.module.css'

type DocStatus = 'pending' | 'passed' | 'flagged' | 'failed'

type DocumentRow = {
  id: string
  document_type: string
  qa_status: DocStatus
  delivery_status: 'pending' | 'approved' | 'delivered' | 'failed'
  generated_at: string | null
  file_url?: string | null
  file_size_bytes?: number | null
}

type DocumentFailure = {
  documentType: string
  error: string
}

type Props = {
  documents: ReadonlyArray<DocumentRow>
  expectedCount?: number
  failures?: ReadonlyArray<DocumentFailure>
}

function docTitle(type: string): string {
  const known = (DOCUMENT_TYPE_TITLES as Record<string, string>)[type]
  return known ?? type
}

function formatBytes(bytes: number | null | undefined): string {
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
  if (mins < 60) return `Generated ${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Generated ${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `Generated ${days} day${days === 1 ? '' : 's'} ago`
}

function qaBadge(status: DocStatus): { label: string; className: string } {
  switch (status) {
    case 'passed':
      return { label: 'Passed QA', className: styles.docBadgeGen }
    case 'flagged':
      return { label: 'QA Flagged', className: styles.docBadgeFlagged }
    case 'failed':
      return { label: 'QA Failed', className: styles.docBadgeFlagged }
    case 'pending':
    default:
      return { label: 'QA Running', className: styles.docBadgeRunning }
  }
}

export function DocumentsTab({ documents, expectedCount, failures = [] }: Props) {
  const allPassed =
    documents.length > 0 && documents.every(d => d.qa_status === 'passed')
  const failedCount = failures.length
  const expected = expectedCount ?? documents.length

  return (
    <>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadLeft}>
          <h2>Generated Documents</h2>
          <span className={styles.panelSub}>
            {documents.length === 0 && failedCount === 0 ? (
              'No documents generated yet'
            ) : failedCount > 0 ? (
              <span className={styles.panelSubFail}>
                {documents.length} of {expected} generated · {failedCount} failed
              </span>
            ) : allPassed ? (
              <span className={styles.panelSubOk}>
                All {documents.length} documents generated successfully
              </span>
            ) : (
              <>
                {documents.length} document{documents.length === 1 ? '' : 's'} generated
              </>
            )}
          </span>
        </div>
      </div>

      {failedCount > 0 ? (
        <div className={styles.failBanner}>
          <p className={styles.failBannerTitle}>
            {failedCount} document{failedCount === 1 ? '' : 's'} failed to generate
          </p>
          <ul className={styles.failList}>
            {failures.map(f => (
              <li key={f.documentType} className={styles.failItem}>
                <strong>{docTitle(f.documentType)}</strong> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div className={styles.empty}>No documents generated yet.</div>
      ) : (
        <div className={styles.docTable}>
          <div className={`${styles.docRow} ${styles.docRowHead}`}>
            <span className={styles.docHead} />
            <span className={styles.docHead}>Document</span>
            <span className={styles.docHead}>QA Status</span>
            <span className={styles.docHead}>File</span>
            <span className={`${styles.docHead} ${styles.docHeadRight}`}>Action</span>
          </div>

          {documents.map(doc => {
            const badge = qaBadge(doc.qa_status)
            const docType = doc.document_type as DocumentType
            const fileLabel = doc.file_size_bytes
              ? `${formatBytes(doc.file_size_bytes)} · ${formatRelative(doc.generated_at)}`
              : formatRelative(doc.generated_at)

            return (
              <div key={doc.id} className={styles.docRow}>
                <span className={styles.docIco}>
                  <FileTextIcon />
                </span>
                <div className={styles.docName}>
                  <span className={styles.docTitle}>{docTitle(docType)}</span>
                  <span className={styles.docFile}>{fileLabel}</span>
                </div>
                <span className={`${styles.docBadge} ${badge.className}`}>{badge.label}</span>
                <span className={styles.docFileSans}>PDF · Draft (watermarked)</span>
                <span className={styles.docAction}>
                  {doc.file_url ? (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.ghostLink}
                    >
                      <FileTextIcon />
                      View Draft PDF →
                    </a>
                  ) : (
                    <span className={styles.docFileSans}>Not yet generated</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function FileTextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
