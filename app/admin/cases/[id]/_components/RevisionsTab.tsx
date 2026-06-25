import { AlertTriangle, Check, CheckCircle2, FileText, Info, Lock, Send } from 'lucide-react'
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

// The customer-facing 2-step progression (design: AdminCaseDetail-Revisions):
// awaiting action → revised, ready → re-released. Maps from the DB status.
type DesignStatus = 'await' | 'ready' | 'released'

function designStatusFor(s: RevisionStatus): DesignStatus {
  if (s === 'in_review') return 'ready'
  if (s === 'completed' || s === 'approved') return 'released'
  return 'await'
}

const PILL: Record<DesignStatus, { cls: string; label: string }> = {
  await: { cls: styles.rstatusAwait, label: 'Awaiting action' },
  ready: { cls: styles.rstatusReady, label: 'Revised, ready' },
  released: { cls: styles.rstatusReleased, label: 'Re-released' },
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

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RevisionCard({ caseId, req }: { caseId: string; req: RevisionRow }) {
  const ds = designStatusFor(req.status)
  const affected = consistencyAffected(req.metadata)
  const step1Done = ds !== 'await'
  const step2Done = ds === 'released'
  const pill = PILL[ds]

  return (
    <article className={`${styles.reqcard} ${ds === 'released' ? styles.reqcardReleased : ''}`}>
      <div className={styles.reqcardTop}>
        <div className={styles.reqcardDocs}>
          <div className={styles.reqcardDocLine}>
            <span className={styles.reqcardDico}>
              {affected.length > 0 ? (
                <AlertTriangle size={15} aria-hidden />
              ) : (
                <FileText size={15} aria-hidden />
              )}
            </span>
            <span className={styles.reqcardDtitle}>{labelFor(req.document_types)}</span>
          </div>
          <span className={styles.reqcardWho}>Requested {formatWhen(req.created_at)}</span>
        </div>
        <span className={`${styles.rstatus} ${pill.cls}`}>
          {ds === 'await' ? <span className={styles.pdot} /> : <Check size={12} aria-hidden />}
          {pill.label}
        </span>
      </div>

      {req.feedback_text ? (
        <p className={styles.reqcardQuote}>
          <span className={styles.qlabel}>Customer feedback</span>
          {req.feedback_text}
        </p>
      ) : (
        <p className={styles.reqcardQuote}>
          <span className={styles.qlabel}>Customer feedback</span>
          <em>No feedback text provided.</em>
        </p>
      )}

      {affected.length > 0 ? (
        <div className={styles.conswarn}>
          <AlertTriangle aria-hidden />
          <div className={styles.conswarnBody}>
            <strong>Heads-up:</strong> already-final document(s) may reference what&rsquo;s changing
            here — review them after regenerating.
            <div className={styles.conswarnChips}>
              {affected.map((a) => (
                <span key={a} className={styles.chip}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.revsteps}>
        {/* Step 1 — Regenerate with AI */}
        <div className={`${styles.revstep} ${step1Done ? styles.revstepDone : styles.revstepActive}`}>
          <span className={styles.revstepNum}>
            {step1Done ? <Check size={15} aria-hidden /> : '1'}
          </span>
          <div className={styles.revstepMain}>
            <div className={styles.revstepHead}>
              <span className={styles.revstepTitle}>Regenerate with AI</span>
              <span className={styles.revstepSub}>
                Applies the customer&rsquo;s feedback to this document.
              </span>
            </div>
            <div className={styles.revstepAction}>
              {step1Done ? (
                <span className={styles.revstepDonenote}>
                  <CheckCircle2 size={15} aria-hidden />
                  Revised draft ready
                </span>
              ) : (
                <RegenerateRevisionButton caseId={caseId} revisionId={req.id} />
              )}
            </div>
          </div>
        </div>

        <div className={`${styles.revstepRail} ${step1Done ? styles.revstepRailOn : ''}`} />

        {/* Step 2 — Re-release & notify customer (unlocked only after step 1) */}
        <div
          className={`${styles.revstep} ${
            step2Done
              ? styles.revstepDone
              : ds === 'ready'
              ? styles.revstepActive
              : styles.revstepPending
          }`}
        >
          <span className={styles.revstepNum}>
            {step2Done ? <Check size={15} aria-hidden /> : '2'}
          </span>
          <div className={styles.revstepMain}>
            <div className={styles.revstepHead}>
              <span className={styles.revstepTitle}>Re-release &amp; notify customer</span>
              {ds === 'await' ? (
                <span id={`rev-step2-hint-${req.id}`} className={styles.revstepSub}>
                  <Lock
                    size={12}
                    aria-hidden
                    style={{ verticalAlign: -2, marginRight: 4 }}
                  />
                  Regenerate first so the customer receives the updated document.
                </span>
              ) : ds === 'ready' ? (
                <span className={styles.revstepSub}>
                  Emails the customer that their revised document is ready to approve.
                </span>
              ) : null}
            </div>
            <div className={styles.revstepAction}>
              {step2Done ? (
                <span className={styles.revstepReleased}>
                  <CheckCircle2 size={15} aria-hidden />
                  Re-released — customer notified by email
                </span>
              ) : ds === 'ready' ? (
                <ReleaseRevisionButton caseId={caseId} revisionId={req.id} />
              ) : (
                <button
                  type="button"
                  disabled
                  aria-describedby={`rev-step2-hint-${req.id}`}
                  className={styles.revstepBtnDisabled}
                >
                  <Send size={14} aria-hidden />
                  Re-release &amp; notify customer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function RevisionsTab({ caseId, revisions }: Props) {
  // Only customer-initiated revision requests belong here (approval events live
  // in the audit trail, not this surface).
  const requests = revisions.filter((r) => r.kind === 'revision')
  // Cards shown in the ordered 2-step list — everything except cancelled.
  const live = requests.filter((r) => r.status !== 'cancelled')
  const cancelled = requests.filter((r) => r.status === 'cancelled')

  // Order: awaiting action → revised/ready → re-released.
  const rank: Record<RevisionStatus, number> = {
    submitted: 0,
    in_review: 1,
    completed: 2,
    approved: 2,
    cancelled: 3,
  }
  const ordered = [...live].sort((a, b) => rank[a.status] - rank[b.status])

  const awaiting = requests.filter((r) => r.status === 'submitted').length
  const ready = requests.filter((r) => r.status === 'in_review').length
  const released = requests.filter((r) => r.status === 'completed' || r.status === 'approved').length

  const summaryParts: string[] = []
  if (awaiting) summaryParts.push(`${awaiting} awaiting action`)
  if (ready) summaryParts.push(`${ready} ready to re-release`)
  if (released) summaryParts.push(`${released} re-released`)
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'No revision requests.'

  return (
    <div>
      <div className={styles.panelHead}>
        <div>
          <h2>Revision Requests</h2>
          <span className={styles.panelSub}>{summary}</span>
        </div>
        <div className={styles.revHeadAction}>
          <span className={styles.revHeadActionCap}>
            <Info aria-hidden />
            Re-releasing notifies the customer about that one document. The whole-pack “Resend
            customer review link” in the case header re-sends the entire review link — not needed
            for revisions.
          </span>
        </div>
      </div>

      <p className={styles.rfIntro}>
        Changes the customer asked for on specific documents. Work each one in order: regenerate the
        document with their feedback applied, then re-release it for the customer to review and
        approve.
      </p>

      {ordered.length === 0 ? (
        <div className={styles.rfResolved}>No outstanding revision requests.</div>
      ) : (
        <div className={styles.revList}>
          {ordered.map((req) => (
            <RevisionCard key={req.id} caseId={caseId} req={req} />
          ))}
        </div>
      )}

      {cancelled.length > 0 ? (
        <>
          <p className={styles.rfResolvedHead}>Cancelled</p>
          <ul className={styles.rfResolvedList}>
            {cancelled.map((r) => (
              <li key={r.id} className={styles.rfResolvedItem}>
                <strong>[{labelFor(r.document_types)}] </strong>
                {(r.feedback_text ?? '').slice(0, 160)}
                <span style={{ marginLeft: 8, fontStyle: 'italic' }}>· Cancelled</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
