'use client'

import { Check, Loader, Pause } from 'lucide-react'
import { PACK_PHASES, type PackStatus } from '@/lib/documents/pack-status'
import type { OverallState } from '@/lib/documents/portal-view'
import styles from './unified.module.css'

interface Props {
  /** Live phase data — drives the dynamic "preparing" node + drafted micro. */
  phase: PackStatus
  /** The resolved overall state (shared with the context block, so they agree). */
  overall: OverallState
}

// The active node mode controls the bullet glyph + its animation.
type NodeMode = 'active' | 'paused' | 'held' | 'done'

interface TrackerView {
  pillText: string
  pillClass: string
  pillLive: boolean
  /** Active node index (overridden by the real phaseIndex for "preparing"). */
  current: number
  mode: NodeMode
  /** The final node reads "Your review" once released, else "Ready". */
  finalLabel: string
}

// Per-overall-state tracker config — mirrors the mock's STATES.tracker. For
// "preparing" the active node + fill follow the real phaseIndex so the rail
// tracks live generation; every other state pins to its designed node. The
// "revising" state deliberately animates the rail BACK to "Drafting" to signal
// we're re-engaging on the customer's changes (brief 14, core idea).
const FINAL = PACK_PHASES.length - 1 // 4

function trackerView(overall: OverallState, phase: PackStatus): TrackerView {
  switch (overall) {
    case 'action':
      return { pillText: 'Action needed', pillClass: styles.pillAmber, pillLive: true, current: 1, mode: 'paused', finalLabel: 'Ready' }
    case 'escalated':
      return { pillText: 'Specialist review', pillClass: styles.pillReview, pillLive: false, current: 3, mode: 'held', finalLabel: 'Ready' }
    case 'ready':
      return { pillText: 'Ready for review', pillClass: styles.pillReady, pillLive: true, current: FINAL, mode: 'active', finalLabel: 'Your review' }
    case 'revising':
      return { pillText: 'Revising', pillClass: styles.pillRev, pillLive: true, current: 2, mode: 'active', finalLabel: 'Your review' }
    case 'complete':
      return { pillText: 'Pack complete', pillClass: styles.pillReady, pillLive: false, current: FINAL, mode: 'done', finalLabel: 'Your review' }
    case 'preparing':
    default:
      return { pillText: 'Preparing', pillClass: styles.pillNeutral, pillLive: true, current: phase.phaseIndex, mode: 'active', finalLabel: 'Ready' }
  }
}

function BulletInner({ mode }: { mode: NodeMode | 'todo' }) {
  if (mode === 'done') return <Check width={22} height={22} aria-hidden />
  if (mode === 'paused') return <Pause width={18} height={18} aria-hidden />
  if (mode === 'held') return <Loader width={20} height={20} aria-hidden />
  if (mode === 'active') return <span className={styles.dot} />
  return <span className={styles.dotSm} />
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function PackTracker({ phase, overall }: Props) {
  const view = trackerView(overall, phase)
  const current = view.current
  const fill = current / FINAL
  // The drafted micro-count only makes sense while preparing.
  const showMicro = overall === 'preparing'
  const microText = `${phase.docsReady} of ${phase.docsTotal} documents drafted`

  return (
    <div className={styles.topcol}>
      <span
        className={`${styles.statusPill} ${view.pillClass} ${view.pillLive ? styles.live : ''}`}
      >
        <span className={styles.pillDot} />
        {view.pillText}
      </span>

      <div className={styles.stepperCard}>
        <div className={styles.stepper} style={{ '--fill': fill } as React.CSSProperties}>
          <div className={styles.track}>
            <div className={styles.trackFill} />
          </div>
          <div className={styles.nodes}>
            {PACK_PHASES.map((phaseLabel, i) => {
              const isDone = i < current
              const isCurrent = i === current
              const isLast = i === FINAL
              const nodeMode: NodeMode | 'todo' = isCurrent ? view.mode : 'todo'
              const nodeClass = [
                styles.node,
                isDone ? styles.nodeDone : '',
                isCurrent ? styles.nodeCurrent : '',
                isCurrent ? styles[`mode${capitalise(view.mode)}`] : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <div key={phaseLabel} className={nodeClass}>
                  <span className={styles.bullet}>
                    <BulletInner mode={isDone ? 'done' : nodeMode} />
                  </span>
                  <span className={styles.nodeLabel}>{isLast ? view.finalLabel : phaseLabel}</span>
                  {isCurrent && showMicro ? (
                    <span className={styles.nodeMicro}>{microText}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
