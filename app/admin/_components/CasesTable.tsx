import Link from 'next/link'
import {
  customerDisplayName,
  planLabel,
  type CaseRow,
  type CaseStatus,
} from '../_lib/cases'
import {
  formatDueDate,
  formatRemaining,
  urgencyFor,
} from './DeadlineCell'
import styles from '../cases-list.module.css'

type Props = {
  rows: ReadonlyArray<CaseRow>
  nowMs: number
}

type ActionSpec = {
  label: string
  primary: boolean
}

function actionForStatus(row: CaseRow): ActionSpec {
  switch (row.status) {
    case 'ready':
      return { label: 'Deliver', primary: true }
    case 'flagged':
      return { label: 'Review', primary: true }
    case 'delivered':
    case 'in_progress':
      return { label: 'View', primary: false }
    case 'pending':
    default:
      return { label: 'Open', primary: false }
  }
}

function StatusBadgeCell({ status }: { status: CaseStatus }) {
  switch (status) {
    case 'flagged':
      return (
        <span className={`${styles.badge} ${styles.badgeFlag}`}>
          <FlagIcon />
          QA flagged
        </span>
      )
    case 'in_progress':
      return (
        <span className={`${styles.badge} ${styles.badgeRunning}`}>
          <LoaderIcon />
          QA running
        </span>
      )
    case 'ready':
      return (
        <span className={`${styles.badge} ${styles.badgeReady}`}>
          <CheckCircleIcon />
          Ready to deliver
        </span>
      )
    case 'delivered':
      return (
        <span className={`${styles.badge} ${styles.badgeDelivered}`}>
          <PackageCheckIcon />
          Delivered
        </span>
      )
    case 'pending':
    default:
      return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>
  }
}

function QaCell({ row }: { row: CaseRow }) {
  if (row.open_flag_count > 0) {
    return (
      <span className={`${styles.badge} ${styles.badgeFlag}`}>
        {row.open_flag_count} {row.open_flag_count === 1 ? 'flag' : 'flags'}
      </span>
    )
  }
  if (row.status === 'ready') {
    return (
      <span className={`${styles.badge} ${styles.badgeReady}`}>
        <CheckIcon />
        Passed
      </span>
    )
  }
  if (row.status === 'delivered') {
    return (
      <span className={`${styles.badge} ${styles.badgePassMuted}`}>
        <CheckIcon />
        Passed
      </span>
    )
  }
  return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>
}

function DeliveryCell({ row, nowMs }: { row: CaseRow; nowMs: number }) {
  if (row.status === 'delivered') {
    const dt = row.order_updated_at ? new Date(row.order_updated_at) : null
    const formatted = dt
      ? `Delivered ${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}`
      : 'Delivered'
    return (
      <>
        <div className={`${styles.deliveryClock} ${styles.deliveryNone}`}>—</div>
        <div className={styles.deliveryDue}>{formatted}</div>
      </>
    )
  }

  const deadlineMs = new Date(row.delivery_deadline).getTime()
  const urgency = urgencyFor(deadlineMs, row.status, nowMs)
  const remaining = formatRemaining(deadlineMs, nowMs)
  const due = formatDueDate(row.delivery_deadline)
  const isOver = urgency === 'overdue'

  const clockClass =
    urgency === 'overdue' || urgency === 'danger'
      ? styles.deliveryDanger
      : urgency === 'warn'
      ? styles.deliveryWarn
      : styles.deliveryCalm

  const dotClass =
    urgency === 'overdue' || urgency === 'danger'
      ? `${styles.dot} ${styles.dotRed} ${urgency === 'danger' ? styles.dotPulse : ''}`
      : urgency === 'warn'
      ? `${styles.dot} ${styles.dotAmber}`
      : `${styles.dot} ${styles.dotGrey}`

  return (
    <>
      <div className={`${styles.deliveryClock} ${clockClass}`}>
        <span className={dotClass.trim()} aria-hidden />
        {isOver ? `Overdue ${remaining}` : remaining}
      </div>
      <div className={styles.deliveryDue}>Due {due}</div>
    </>
  )
}

export function CasesTable({ rows, nowMs }: Props) {
  if (rows.length === 0) {
    return <div className={styles.empty}>No cases match the current filters.</div>
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col" className={styles.colCustomer}>Customer</th>
          <th scope="col" className={styles.colStatus}>Status</th>
          <th scope="col" className={styles.colDelivery}>Delivery</th>
          <th scope="col" className={styles.colQa}>QA</th>
          <th scope="col" className={styles.colTier}>Tier</th>
          <th scope="col" className={`${styles.colAction} ${styles.right}`}>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const name = customerDisplayName(row)
          const action = actionForStatus(row)
          return (
            <tr key={row.id}>
              <td className={styles.colCustomer}>
                <Link href={`/admin/cases/${row.id}`} className={styles.custLink}>
                  <span className={styles.custName}>{name}</span>
                  {row.customer_email ? (
                    <span className={styles.custEmail}>{row.customer_email}</span>
                  ) : null}
                </Link>
              </td>
              <td className={styles.colStatus}>
                <StatusBadgeCell status={row.status} />
              </td>
              <td className={styles.colDelivery}>
                <DeliveryCell row={row} nowMs={nowMs} />
              </td>
              <td className={styles.colQa}>
                <QaCell row={row} />
              </td>
              <td className={styles.colTier}>
                <span className={styles.tierChip}>{planLabel(row.plan_selected)}</span>
              </td>
              <td className={`${styles.colAction} ${styles.right}`}>
                <Link
                  href={`/admin/cases/${row.id}`}
                  className={`${styles.act} ${action.primary ? styles.actPrimary : styles.actGhost}`}
                >
                  {action.label}
                  <ArrowRightIcon />
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── Inline icons (SVG, stroke-based) ────────────────────────── */

function FlagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function LoaderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PackageCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 16l2 2 4-4" />
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
