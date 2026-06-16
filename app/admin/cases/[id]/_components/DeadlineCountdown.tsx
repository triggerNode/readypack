'use client'

import { useEffect, useState } from 'react'
import { formatRemaining, urgencyFor } from '../../../_components/DeadlineCell'
import type { CaseStatus } from '../../../_lib/cases'
import styles from '../case-detail.module.css'

type Props = {
  deadlineIso: string
  status: CaseStatus
}

function formatHeaderDue(deadlineIso: string): string {
  const d = new Date(deadlineIso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${month} ${year} at ${time}`
}

/**
 * Delivery-deadline clock for the case header card. Mirrors the
 * `.ch-deadline` block in design/AdminCaseDetail.html and ticks once a
 * minute (per-second precision adds no value at the hours scale shown).
 */
export function DeadlineCountdown({ deadlineIso, status }: Props) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (status === 'delivered') {
    return (
      <div className={styles.chDeadline}>
        <div className={styles.chDeadlineLabel}>Delivery deadline</div>
        <div className={`${styles.chDeadlineClock} ${styles.chDeadlineClockNone}`}>—</div>
        <div className={styles.chDeadlineDue}>Delivered</div>
      </div>
    )
  }

  const deadlineMs = new Date(deadlineIso).getTime()
  const urgency = urgencyFor(deadlineMs, status, nowMs)
  const remaining = formatRemaining(deadlineMs, nowMs)
  const due = formatHeaderDue(deadlineIso)
  const isOverdue = urgency === 'overdue'

  const clockClass =
    urgency === 'overdue' || urgency === 'danger'
      ? styles.chDeadlineClockDanger
      : urgency === 'warn'
      ? styles.chDeadlineClockWarn
      : styles.chDeadlineClockCalm

  return (
    <div className={styles.chDeadline}>
      <div className={styles.chDeadlineLabel}>Delivery deadline</div>
      <div className={`${styles.chDeadlineClock} ${clockClass}`} aria-live="polite">
        {isOverdue ? `Overdue ${remaining}` : remaining}
      </div>
      <div className={styles.chDeadlineDue}>{isOverdue ? `Was due ${due}` : `Due ${due}`}</div>
    </div>
  )
}
