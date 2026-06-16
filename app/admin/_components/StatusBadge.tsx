import type { CSSProperties, ReactNode } from 'react'
import {
  Check,
  CheckCircle2,
  Flag,
  Loader,
  PackageCheck,
} from 'lucide-react'
import type { CaseStatus } from '../_lib/cases'

type Tone = 'flag' | 'running' | 'ready' | 'muted' | 'neutral'

type BadgeStyle = {
  label: string
  tone: Tone
  icon: ReactNode
}

const ICON_PROPS = { size: 13, strokeWidth: 1.5 } as const

const STATUS_BADGES: Record<CaseStatus, BadgeStyle> = {
  pending:     { label: 'Pending',          tone: 'muted',   icon: null },
  in_progress: { label: 'QA running',       tone: 'running', icon: <Loader {...ICON_PROPS} /> },
  ready:       { label: 'Ready to deliver', tone: 'ready',   icon: <CheckCircle2 {...ICON_PROPS} /> },
  flagged:     { label: 'QA flagged',       tone: 'flag',    icon: <Flag {...ICON_PROPS} /> },
  delivered:   { label: 'Delivered',        tone: 'neutral', icon: <PackageCheck {...ICON_PROPS} /> },
}

function toneStyles(tone: Tone): CSSProperties {
  switch (tone) {
    case 'flag':
      return {
        background: 'var(--status-flag-bg)',
        border: '1px solid var(--status-flag-border)',
        color: 'var(--status-flag)',
      }
    case 'running':
      return {
        background: 'var(--status-running-bg)',
        border: '1px solid var(--status-running-border)',
        color: 'var(--status-running)',
      }
    case 'ready':
      return {
        background: 'var(--status-ready-bg)',
        border: '1px solid var(--status-ready-border)',
        color: 'var(--text-accent)',
      }
    case 'neutral':
      return {
        background: 'var(--status-muted-bg)',
        border: '1px solid var(--admin-divider-strong)',
        color: 'var(--text-muted)',
      }
    case 'muted':
    default:
      return {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--admin-divider-strong)',
        color: 'var(--text-muted)',
      }
  }
}

type Props = {
  status: CaseStatus
}

export function StatusBadge({ status }: Props) {
  const badge = STATUS_BADGES[status]
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px var(--sp-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...toneStyles(badge.tone),
  }
  return (
    <span style={style}>
      {badge.icon}
      <span>{badge.label}</span>
    </span>
  )
}

type FlagCountProps = {
  open: number
  critical: number
  passed?: boolean
}

const COUNT_BADGE_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px var(--sp-2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

export function QaFlagCountBadge({ open, critical, passed }: FlagCountProps) {
  void critical
  if (open === 0) {
    if (passed) {
      return (
        <span
          style={{
            ...COUNT_BADGE_BASE,
            background: 'var(--status-ready-bg)',
            border: '1px solid var(--status-ready-border)',
            color: 'var(--text-accent)',
          }}
        >
          <Check {...ICON_PROPS} />
          <span>Passed</span>
        </span>
      )
    }
    return (
      <span
        style={{
          ...COUNT_BADGE_BASE,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--admin-divider-strong)',
          color: 'var(--text-muted)',
        }}
      >
        Pending
      </span>
    )
  }

  return (
    <span
      style={{
        ...COUNT_BADGE_BASE,
        background: 'var(--status-flag-bg)',
        border: '1px solid var(--status-flag-border)',
        color: 'var(--status-flag)',
      }}
    >
      {open} {open === 1 ? 'flag' : 'flags'}
    </span>
  )
}
