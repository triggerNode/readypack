import type { CSSProperties } from 'react'
import type { CaseStatus } from '../_lib/cases'

type Urgency = 'danger' | 'warn' | 'normal' | 'overdue' | 'delivered'

/**
 * Pure helpers — exported so the case detail header can reuse the same
 * urgency logic without depending on this presentational component.
 */
export function urgencyFor(deadlineMs: number, status: CaseStatus, nowMs: number): Urgency {
  if (status === 'delivered') return 'delivered'
  const remainingMs = deadlineMs - nowMs
  if (remainingMs <= 0) return 'overdue'
  const remainingHours = remainingMs / (1000 * 60 * 60)
  if (remainingHours < 12) return 'danger'
  if (remainingHours < 36) return 'warn'
  return 'normal'
}

export function formatRemaining(deadlineMs: number, nowMs: number): string {
  const diffMs = deadlineMs - nowMs
  const absMs = Math.abs(diffMs)
  const totalMinutes = Math.floor(absMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function formatDueDate(deadlineIso: string): string {
  const d = new Date(deadlineIso)
  // e.g. "7 Jun, 11:20"
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${month}, ${time}`
}

export function colorForUrgency(urgency: Urgency): string {
  switch (urgency) {
    case 'overdue':
    case 'danger':
      return 'var(--status-overdue)'
    case 'warn':
      return 'var(--status-urgent)'
    case 'delivered':
      return 'var(--text-muted)'
    case 'normal':
    default:
      return 'var(--text-secondary)'
  }
}

type Props = {
  deadlineIso: string
  status: CaseStatus
  /** Time used to compute urgency. Server-component-friendly (no setInterval). */
  nowMs: number
  deliveredAtIso?: string | null
}

export function DeadlineCell({ deadlineIso, status, nowMs, deliveredAtIso }: Props) {
  if (status === 'delivered') {
    const dt = deliveredAtIso ? new Date(deliveredAtIso) : null
    const formatted = dt
      ? `Delivered ${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}`
      : 'Delivered'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>—</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatted}</span>
      </div>
    )
  }

  const deadlineMs = new Date(deadlineIso).getTime()
  const urgency = urgencyFor(deadlineMs, status, nowMs)
  const remaining = formatRemaining(deadlineMs, nowMs)
  const due = formatDueDate(deadlineIso)
  const color = colorForUrgency(urgency)
  const isOverdue = urgency === 'overdue'

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={dotStyle} aria-hidden />
        <span style={{ color, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {isOverdue ? `Overdue ${remaining}` : remaining}
        </span>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Due {due}</span>
    </div>
  )
}
