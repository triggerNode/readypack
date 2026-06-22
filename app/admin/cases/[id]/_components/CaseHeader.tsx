import Link from 'next/link'
import type { CaseRow } from '../../../_lib/cases'
import { customerDisplayName, planLabel } from '../../../_lib/cases'
import { StatusBadge } from '../../../_components/StatusBadge'
import { DeadlineCountdown } from './DeadlineCountdown'
import {
  ApprovePackButton,
  EscalateCaseForm,
  RequestMoreInfoForm,
} from './ActionForms'
import styles from '../case-detail.module.css'

type Props = {
  c: CaseRow
  // True when the case has open high/critical-severity flags that must be
  // resolved or overridden before the pack can be approved.
  hasBlockingFlags: boolean
}

function formatOrderedAt(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `Ordered ${day} ${month} ${year}, ${time}`
}

export function CaseHeader({ c, hasBlockingFlags }: Props) {
  const name = customerDisplayName(c)
  // Lock approval only while work is GENUINELY still in progress (payment not
  // settled, or generation still queued/running). The `qa_review` state — which
  // the cases view also rolls up into `in_progress` — is precisely the
  // human-review state where the admin is meant to approve, so it must NOT lock
  // the button. (Without this, every completed pack sits forever as "QA
  // running" with Approve disabled.)
  const isQaRunning =
    c.delivery_status === 'pending' || c.delivery_status === 'generating'

  return (
    <div>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/admin">Cases</Link>
        <span className={styles.breadcrumbChev}>›</span>
        <span className={styles.breadcrumbCurrent}>{name}</span>
      </div>

      <section aria-label="Case summary" className={styles.casehead}>
        <div className={styles.caseheadRow1}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.chNameLine}>
              <span className={styles.chName}>{name}</span>
              <StatusBadge status={c.status} />
            </div>
            <div className={styles.chMeta}>
              {c.customer_email ?? '—'} · {planLabel(c.plan_selected)} ·{' '}
              {formatOrderedAt(c.order_created_at)}
            </div>
          </div>
          <DeadlineCountdown deadlineIso={c.delivery_deadline} status={c.status} />
        </div>

        <div className={styles.caseheadRow2}>
          <ApprovePackButton
            caseId={c.id}
            hasCriticalFlags={hasBlockingFlags}
            isQaRunning={isQaRunning}
          />
          <RequestMoreInfoForm caseId={c.id} />
          <EscalateCaseForm caseId={c.id} />
          {c.stripe_payment_id ? (
            <a
              href={`https://dashboard.stripe.com/payments/${encodeURIComponent(c.stripe_payment_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnLink}`}
            >
              View in Stripe →
            </a>
          ) : null}
        </div>
      </section>
    </div>
  )
}
