import {
  MarkFlagResolvedButton,
  OverrideAndNoteForm,
  RequestMoreInfoForFlagButton,
} from './ActionForms'
import styles from '../case-detail.module.css'

export type FlagRow = {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved' | 'escalated'
  explanation: string
  required_action: string | null
  triggering_answer: string | null
  created_at: string
}

type Props = {
  caseId: string
  flags: ReadonlyArray<FlagRow>
}

const SEVERITY_LABEL: Record<FlagRow['severity'], string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
}

export function RedFlagsTab({ caseId, flags }: Props) {
  const open = flags.filter(f => f.status === 'open')
  const resolved = flags.filter(f => f.status !== 'open')

  return (
    <div>
      <div className={styles.rfHead}>
        <h2>Red Flags</h2>
        <span className={styles.rfMeta}>
          {open.length} unresolved · {resolved.length} resolved
        </span>
      </div>

      <p className={styles.rfIntro}>
        These flags were raised by the automated QA check. Review each one and either mark as
        resolved (no action needed), request more information from the customer, or escalate.
        Approve &amp; Deliver is locked until all flags are resolved or overridden.
      </p>

      {open.map(flag => {
        const sevClass =
          flag.severity === 'critical'
            ? `${styles.sevPill} ${styles.sevPillCritical}`
            : styles.sevPill
        const title = flag.explanation.split('.')[0] ?? flag.explanation
        return (
          <article key={flag.id} className={styles.flagcard}>
            <div className={styles.flagcardHead}>
              <span className={sevClass}>{SEVERITY_LABEL[flag.severity]}</span>
              <span className={styles.flagcardTitle}>{title}</span>
              <span className={styles.flagcardState}>Unresolved</span>
            </div>

            <div className={styles.flagcardBody}>{flag.explanation}</div>

            {flag.required_action ? (
              <div className={styles.flagcardBody}>
                <strong style={{ color: 'var(--text-primary)' }}>Required action: </strong>
                {flag.required_action}
              </div>
            ) : null}

            {flag.triggering_answer ? (
              <div className={styles.flagcardAffected}>
                <span className={styles.flagcardAffectedLbl}>Triggering answer:</span>
                <span className={styles.chip}>{flag.triggering_answer}</span>
              </div>
            ) : null}

            <div className={styles.flagcardActions}>
              <RequestMoreInfoForFlagButton caseId={caseId} />
              <MarkFlagResolvedButton caseId={caseId} flagId={flag.id} />
              <OverrideAndNoteForm caseId={caseId} flagId={flag.id} />
            </div>
          </article>
        )
      })}

      {resolved.length === 0 ? (
        <div className={styles.rfResolved}>No resolved flags yet.</div>
      ) : (
        <>
          <p className={styles.rfResolvedHead}>Resolved</p>
          <ul className={styles.rfResolvedList}>
            {resolved.map(f => (
              <li key={f.id} className={styles.rfResolvedItem}>
                <strong>[{SEVERITY_LABEL[f.severity]}] </strong>
                {f.explanation.slice(0, 200)}
                <span style={{ marginLeft: 8, fontStyle: 'italic' }}>· {f.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
