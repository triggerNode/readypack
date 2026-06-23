import type { DocumentType } from '@/types/database'
import { RegenerateRevisionButton, ReleaseRevisionButton } from './ActionForms'
import styles from '../case-detail.module.css'

export type RevisionStatus = 'submitted' | 'in_review' | 'completed' | 'approved' | 'cancelled'

export type RevisionRow = {
  id: string
  document_types: string[]
  feedback_text: string | null
  status: RevisionStatus
  kind: 'revision' | 'approval'
  created_at: string
  metadata: Record<string, unknown> | null
}

type Props = {
  caseId: string
  revisions: ReadonlyArray<RevisionRow>
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

const STATUS_LABEL: Record<RevisionStatus, string> = {
  submitted: 'Awaiting action',
  in_review: 'Revising',
  completed: 'Re-released',
  approved: 'Approved',
  cancelled: 'Cancelled',
}

function labelFor(types: string[]): string {
  if (!types || types.length === 0) return 'Whole pack'
  return types.map((t) => DOC_LABEL[t as DocumentType] ?? t).join(', ')
}

function consistencyAffected(meta: Record<string, unknown> | null): string[] {
  const raw = meta?.consistency_affected
  if (!Array.isArray(raw)) return []
  return raw.map((t) => DOC_LABEL[t as DocumentType] ?? String(t))
}

export function RevisionsTab({ caseId, revisions }: Props) {
  // Only customer-initiated revision requests belong here (approval events live
  // in the audit trail, not this surface).
  const requests = revisions.filter((r) => r.kind === 'revision')
  const active = requests.filter((r) => r.status === 'submitted' || r.status === 'in_review')
  const closed = requests.filter(
    (r) => r.status === 'completed' || r.status === 'approved' || r.status === 'cancelled',
  )
  const awaiting = requests.filter((r) => r.status === 'submitted').length
  const released = requests.filter((r) => r.status === 'completed').length

  return (
    <div>
      <div className={styles.rfHead}>
        <h2>Revision Requests</h2>
        <span className={styles.rfMeta}>
          {awaiting} awaiting action · {released} re-released · {closed.length} closed
        </span>
      </div>

      <p className={styles.rfIntro}>
        Changes the customer asked for on specific documents. Regenerate the document(s) with their
        feedback applied, then re-release them for the customer to review and approve.
      </p>

      {active.length === 0 ? (
        <div className={styles.rfResolved}>No outstanding revision requests.</div>
      ) : (
        active.map((req) => {
          const affected = consistencyAffected(req.metadata)
          return (
            <article key={req.id} className={styles.flagcard}>
              <div className={styles.flagcardHead}>
                <span className={styles.sevPill}>{labelFor(req.document_types)}</span>
                <span className={styles.flagcardTitle}>Revision requested</span>
                <span className={styles.flagcardState}>{STATUS_LABEL[req.status]}</span>
              </div>

              {req.feedback_text ? (
                <div className={styles.flagcardBody}>
                  <strong style={{ color: 'var(--text-primary)' }}>What the customer wants: </strong>
                  {req.feedback_text}
                </div>
              ) : (
                <div className={styles.flagcardBody}>
                  <em>No feedback text provided.</em>
                </div>
              )}

              {affected.length > 0 ? (
                <div className={styles.flagcardAffected}>
                  <span className={styles.flagcardAffectedLbl}>
                    Heads-up — already-final document(s) may reference what&apos;s changing, review them:
                  </span>
                  {affected.map((a) => (
                    <span key={a} className={styles.chip}>
                      {a}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={styles.flagcardActions}>
                <RegenerateRevisionButton caseId={caseId} revisionId={req.id} />
                <ReleaseRevisionButton caseId={caseId} revisionId={req.id} />
              </div>
            </article>
          )
        })
      )}

      {closed.length > 0 ? (
        <>
          <p className={styles.rfResolvedHead}>Closed</p>
          <ul className={styles.rfResolvedList}>
            {closed.map((r) => (
              <li key={r.id} className={styles.rfResolvedItem}>
                <strong>[{labelFor(r.document_types)}] </strong>
                {(r.feedback_text ?? '').slice(0, 160)}
                <span style={{ marginLeft: 8, fontStyle: 'italic' }}>· {STATUS_LABEL[r.status]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
