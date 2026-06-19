import type { DocumentType, InfoRequestStatus } from '@/types/database'
import { ResolveInfoRequestButton } from './ActionForms'
import styles from '../case-detail.module.css'

export type InfoRequestRow = {
  id: string
  document_type: DocumentType | null
  prompt: string
  options: string[]
  answer_text: string | null
  answer_selections: string[]
  status: InfoRequestStatus
  created_at: string
  answered_at: string | null
}

type Props = {
  caseId: string
  requests: ReadonlyArray<InfoRequestRow>
}

const DOC_LABEL: Record<DocumentType, string> = {
  ai_use_statement: 'AI Use Statement',
  privacy_notice_addendum: 'Privacy Notice Addendum',
  ai_risk_register: 'AI Risk Register',
  dpia_lite: 'DPIA-Lite Assessment',
  internal_ai_use_policy: 'Internal AI Use Policy',
  customer_disclosure_snippets: 'Customer Disclosure Snippets',
  vendor_ai_register: 'Vendor AI Register',
  complaints_procedure_pack: 'Complaints Procedure Pack',
  procurement_response_memo: 'Procurement Response Memo',
}

const STATUS_LABEL: Record<InfoRequestStatus, string> = {
  open: 'Awaiting customer',
  submitted: 'Answer received',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
}

function relatesTo(documentType: DocumentType | null): string {
  return documentType ? DOC_LABEL[documentType] : 'Whole case'
}

function formatAnswer(req: InfoRequestRow): string | null {
  const parts: string[] = []
  if (req.answer_selections.length > 0) parts.push(req.answer_selections.join(', '))
  if (req.answer_text) parts.push(req.answer_text)
  return parts.length > 0 ? parts.join(' — ') : null
}

export function InfoRequestsTab({ caseId, requests }: Props) {
  const active = requests.filter((r) => r.status === 'open' || r.status === 'submitted')
  const closed = requests.filter((r) => r.status === 'resolved' || r.status === 'cancelled')
  const openCount = requests.filter((r) => r.status === 'open').length
  const submittedCount = requests.filter((r) => r.status === 'submitted').length

  return (
    <div>
      <div className={styles.rfHead}>
        <h2>Information Requests</h2>
        <span className={styles.rfMeta}>
          {openCount} awaiting customer · {submittedCount} answered · {closed.length} resolved
        </span>
      </div>

      <p className={styles.rfIntro}>
        Structured questions sent to the customer (via &ldquo;Request More Info&rdquo;). The customer
        answers these in their portal. Once you&apos;ve acted on an answer — regenerated the affected
        document or confirmed no change is needed — mark it resolved to clear it from the
        customer&apos;s portal and progress screen.
      </p>

      {active.length === 0 ? (
        <div className={styles.rfResolved}>No outstanding information requests.</div>
      ) : (
        active.map((req) => {
          const answer = formatAnswer(req)
          return (
            <article key={req.id} className={styles.flagcard}>
              <div className={styles.flagcardHead}>
                <span className={styles.sevPill}>{relatesTo(req.document_type)}</span>
                <span className={styles.flagcardTitle}>{req.prompt}</span>
                <span className={styles.flagcardState}>{STATUS_LABEL[req.status]}</span>
              </div>

              {req.options.length > 0 ? (
                <div className={styles.flagcardAffected}>
                  <span className={styles.flagcardAffectedLbl}>Options offered:</span>
                  {req.options.map((o) => (
                    <span key={o} className={styles.chip}>
                      {o}
                    </span>
                  ))}
                </div>
              ) : null}

              {answer ? (
                <div className={styles.flagcardBody}>
                  <strong style={{ color: 'var(--text-primary)' }}>Customer answer: </strong>
                  {answer}
                </div>
              ) : (
                <div className={styles.flagcardBody}>
                  <em>Awaiting the customer&apos;s answer.</em>
                </div>
              )}

              <div className={styles.flagcardActions}>
                <ResolveInfoRequestButton caseId={caseId} infoRequestId={req.id} />
              </div>
            </article>
          )
        })
      )}

      {closed.length > 0 ? (
        <>
          <p className={styles.rfResolvedHead}>Resolved &amp; cancelled</p>
          <ul className={styles.rfResolvedList}>
            {closed.map((r) => (
              <li key={r.id} className={styles.rfResolvedItem}>
                <strong>[{relatesTo(r.document_type)}] </strong>
                {r.prompt.slice(0, 160)}
                <span style={{ marginLeft: 8, fontStyle: 'italic' }}>· {STATUS_LABEL[r.status]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
