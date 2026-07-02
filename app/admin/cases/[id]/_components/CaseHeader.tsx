import Link from 'next/link'
import type { CaseRow } from '../../../_lib/cases'
import { customerDisplayName, planLabel } from '../../../_lib/cases'
import { StatusBadge } from '../../../_components/StatusBadge'
import { DeadlineCountdown } from './DeadlineCountdown'
import {
  ReleaseForReviewButton,
  EscalateCaseForm,
  RequestMoreInfoForm,
  GeneratePackButton,
} from './ActionForms'
import styles from '../case-detail.module.css'

type Props = {
  c: CaseRow
  /** Number of generated documents for this case; 0 = pack not built yet. */
  documentCount: number
}

function formatOrderedAt(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `Ordered ${day} ${month} ${year}, ${time}`
}

export function CaseHeader({ c, documentCount }: Props) {
  const name = customerDisplayName(c)
  // Held cases (high/critical) skip auto-generation, and failed runs leave 0
  // documents — surface "Generate Pack" until the pack has actually been built.
  const packNotGenerated = documentCount === 0
  // The pack has already been released to the customer once it has reached (or
  // passed) the customer-review stage — relabel the button to "Resend" then.
  const alreadyReleased =
    c.delivery_status === 'qa_review' ||
    c.delivery_status === 'escalated' ||
    c.delivery_status === 'approved' ||
    c.delivery_status === 'delivered'

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
          {packNotGenerated ? <GeneratePackButton caseId={c.id} /> : null}
          <ReleaseForReviewButton caseId={c.id} alreadyReleased={alreadyReleased} />
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
