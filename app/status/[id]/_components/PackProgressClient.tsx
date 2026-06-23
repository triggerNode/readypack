'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Clock,
  Info,
  Loader,
  Lock,
  MessageSquareText,
  Pause,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { PACK_PHASES, type PackState, type PackStatus } from '@/lib/documents/pack-status'
import styles from './pack-progress.module.css'

interface Props {
  orderId: string
  customerName: string
  customerInitials: string
  packReference: string
  initialStatus: PackStatus
}

// Per-state presentation derived from the live status. Mirrors the design's
// STATES map (design/PackProgress.html) but the current node + micro line are
// driven by the real phaseIndex / docsReady so the stepper tracks generation.
type NodeMode = 'active' | 'paused' | 'held' | 'done'

interface StateView {
  stateClass: string
  mode: NodeMode
  pillText: string
  pillClass: string
  pillLive: boolean
  headline: string
  sub: string
}

const STATE_VIEW: Record<PackState, StateView> = {
  progress: {
    stateClass: 'stateProgress',
    mode: 'active',
    pillText: 'Preparing',
    pillClass: 'pillNeutral',
    pillLive: true,
    headline: 'We’re preparing your compliance pack',
    sub: 'Your nine documents are being assembled now. There’s nothing you need to do.',
  },
  action: {
    stateClass: 'stateAction',
    mode: 'paused',
    pillText: 'Action needed',
    pillClass: 'pillAmber',
    pillLive: true,
    headline: 'We need a little more information',
    sub: 'We’ve paused while we wait for a quick answer from you. It only takes a moment.',
  },
  review: {
    stateClass: 'stateReview',
    mode: 'held',
    pillText: 'In manual review',
    pillClass: 'pillReview',
    pillLive: false,
    headline: 'Your pack is in manual review',
    sub: 'A member of our compliance team is checking your documents before they’re released.',
  },
  ready: {
    stateClass: 'stateReady',
    mode: 'done',
    pillText: 'Ready',
    pillClass: 'pillReady',
    pillLive: false,
    headline: 'Your compliance pack is ready',
    sub: 'Every document has passed review. Open the portal to review and download your pack.',
  },
  delayed: {
    stateClass: 'stateDelayed',
    mode: 'active',
    pillText: 'Preparing',
    pillClass: 'pillNeutral',
    pillLive: true,
    headline: 'We’re preparing your compliance pack',
    sub: 'Your documents are still being assembled. Thank you for your patience.',
  },
}

// Poll cadence: fast while actively generating, slow once settled, stop on ready.
function pollDelay(state: PackState): number | null {
  if (state === 'ready') return null
  if (state === 'progress') return 4000
  return 15000
}

function BulletInner({ mode }: { mode: NodeMode | 'todo' }) {
  if (mode === 'done') return <Check width={22} height={22} aria-hidden />
  if (mode === 'paused') return <Pause width={18} height={18} aria-hidden />
  if (mode === 'held') return <Loader width={20} height={20} aria-hidden />
  if (mode === 'active') return <span className={styles.dot} />
  return <span className={styles.dotSm} />
}

export function PackProgressClient({
  orderId,
  customerName,
  customerInitials,
  packReference,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState<PackStatus>(initialStatus)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll the status feed. Recursive setTimeout so the cadence can adapt to the
  // current state (and stop entirely once the pack is ready).
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const schedule = (state: PackState) => {
      const delay = pollDelay(state)
      if (delay === null) return
      timerRef.current = setTimeout(tick, delay)
    }

    const tick = async () => {
      try {
        const res = await fetch(`/api/status/${orderId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          if (!cancelled) schedule(status.state)
          return
        }
        const next = (await res.json()) as PackStatus
        if (cancelled) return
        setStatus(next)
        schedule(next.state)
      } catch {
        if (!cancelled) schedule(status.state)
      }
    }

    schedule(status.state)
    return () => {
      cancelled = true
      controller.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // Re-arm whenever the state changes so the cadence follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, status.state])

  const view = STATE_VIEW[status.state]
  const current = status.phaseIndex
  const fill = current / (PACK_PHASES.length - 1)
  const showMicro = status.state === 'progress' || status.state === 'delayed'
  const microText = `${status.docsReady} of ${status.docsTotal} documents drafted`

  // Per-document partial completion (design: PackProgress-Partial).
  const finalN = status.docsFinal ?? 0
  const revN = status.docsInRevision ?? 0
  const awaitN = status.docsAwaitingReview ?? 0
  const showCounts = finalN > 0 || revN > 0
  const isPartial = finalN > 0 && finalN < status.docsTotal && status.state !== 'ready'

  return (
    <div className={`${styles.shell} ${styles[view.stateClass]}`}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Pack progress">
        <div className={`${styles.container} ${styles.navInner}`}>
          <span className={styles.logo} aria-label="ReadyPack">
            <ReadyPackLogo style={{ width: 26, height: 26 }} />
            <span className={styles.logoWord}>
              Ready<span className={styles.logoAccent}>Pack</span>
            </span>
          </span>
          <div className={styles.client}>
            <div className={styles.clientMeta}>
              <span className={styles.clientLabel}>Prepared for</span>
              <span className={styles.clientName}>{customerName}</span>
            </div>
            <span className={styles.avatar} aria-hidden>
              {customerInitials}
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.container}>
          <div className={styles.stage}>
            <span
              className={`${styles.statusPill} ${styles[view.pillClass]} ${
                view.pillLive ? styles.live : ''
              }`}
            >
              <span className={styles.pillDot} />
              {view.pillText}
            </span>

            <h1 className={styles.h1}>
              {status.state === 'ready' ? (
                <span className={styles.h1Check}>
                  <Check width={22} height={22} aria-hidden />
                </span>
              ) : null}
              <span>{view.headline}</span>
            </h1>
            <p className={styles.sub}>{view.sub}</p>

            {/* Per-document counts (partial / complete) */}
            {showCounts ? (
              <div className={styles.counts}>
                {finalN > 0 ? (
                  <span className={`${styles.countsSeg} ${styles.countsFinal}`}>
                    <span className={styles.cdot} />
                    {finalN} of {status.docsTotal} approved
                  </span>
                ) : null}
                {revN > 0 ? (
                  <span className={`${styles.countsSeg} ${styles.countsRev}`}>
                    <span className={styles.cdot} />
                    {revN} in revision
                  </span>
                ) : null}
                {awaitN > 0 ? (
                  <span className={`${styles.countsSeg} ${styles.countsAwait}`}>
                    <span className={styles.cdot} />
                    {awaitN} awaiting your review
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Stepper card */}
            <div className={styles.stepperCard}>
              <div className={styles.stepper} style={{ '--fill': fill } as React.CSSProperties}>
                <div className={styles.track}>
                  <div className={styles.trackFill} />
                </div>
                <div className={styles.nodes}>
                  {PACK_PHASES.map((phase, i) => {
                    const isDone = i < current
                    const isCurrent = i === current
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
                      <div key={phase} className={nodeClass}>
                        <span className={styles.bullet}>
                          <BulletInner mode={isDone ? 'done' : nodeMode} />
                        </span>
                        <span className={styles.nodeLabel}>{phase}</span>
                        {isCurrent && showMicro ? (
                          <span className={styles.nodeMicro}>{microText}</span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className={styles.reassure}>
                <Info width={15} height={15} aria-hidden />
                This usually takes a little while. You can safely close this page — we’ll email you
                when it’s ready, and you can return here any time via your link.
              </p>
            </div>

            {/* State callouts */}
            {status.state === 'action' ? (
              <div className={`${styles.callout} ${styles.calloutAction}`}>
                <span className={styles.calloutIco}>
                  <MessageSquareText width={22} height={22} aria-hidden />
                </span>
                <div className={styles.calloutBody}>
                  <p className={styles.calloutTitle}>
                    We need a little more information to finish your pack.
                  </p>
                  <p className={styles.calloutText}>
                    Our compliance team has one or two quick questions about your answers. Once
                    you’ve responded, we’ll pick your pack straight back up.
                  </p>
                  <div className={styles.calloutCta}>
                    <Link className={`${styles.btn} ${styles.btnAmber} ${styles.btnLg}`} href={`/portal/${orderId}`}>
                      Provide the information →
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {status.state === 'review' && !isPartial ? (
              <div className={`${styles.callout} ${styles.calloutReview}`}>
                <span className={styles.calloutIco}>
                  <Users width={22} height={22} aria-hidden />
                </span>
                <div className={styles.calloutBody}>
                  <p className={styles.calloutTitle}>
                    Your pack is with our compliance team for a manual review.
                  </p>
                  <p className={styles.calloutText}>
                    A specialist is reviewing your documents to make sure everything holds up. We’ll
                    be in touch within one business day — there’s nothing you need to do right now.
                  </p>
                </div>
              </div>
            ) : null}

            {status.state === 'delayed' ? (
              <div className={`${styles.callout} ${styles.calloutDelayed}`}>
                <span className={styles.calloutIco}>
                  <Clock width={22} height={22} aria-hidden />
                </span>
                <div className={styles.calloutBody}>
                  <p className={styles.calloutTitle}>This is taking a little longer than usual.</p>
                  <p className={styles.calloutText}>
                    Our team has been notified and is on it. Your pack is safe, and we’ll email you
                    the moment it’s ready.
                  </p>
                </div>
              </div>
            ) : null}

            {isPartial && status.state === 'review' ? (
              <div className={`${styles.callout} ${styles.calloutPartial}`}>
                <span className={styles.calloutIco}>
                  <ShieldCheck width={22} height={22} aria-hidden />
                </span>
                <div className={styles.calloutBody}>
                  <p className={styles.calloutTitle}>Your approved documents are unlocked.</p>
                  <p className={styles.calloutText}>
                    Download the approved documents now and keep approving the rest at your own pace.
                    We’ll email you when any document you’ve sent back is ready to approve.
                  </p>
                  <div className={styles.calloutCta}>
                    <Link
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                      href={`/portal/${orderId}`}
                    >
                      Review your pack →
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {status.state === 'ready' ? (
              <div className={`${styles.callout} ${styles.calloutReady}`}>
                <span className={styles.calloutIco}>
                  <ShieldCheck width={22} height={22} aria-hidden />
                </span>
                <div className={styles.calloutBody}>
                  <p className={styles.calloutTitle}>Your compliance pack is ready.</p>
                  <p className={styles.calloutText}>
                    All nine documents have passed review and are unlocked for you to review and
                    download.
                  </p>
                  <div className={styles.calloutCta}>
                    <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} href={`/portal/${orderId}`}>
                      Review &amp; download your pack →
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            <p className={styles.secureNote}>
              <Lock width={14} height={14} aria-hidden />
              Saved to your secure, single-use link · Pack {packReference}
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span className={styles.footerLegal}>
            ReadyPack · MOFE LTD · Company No. 16633320 · Documentation support — not legal advice.
          </span>
          <span className={styles.footerLinks}>
            <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a> ·{' '}
            <a href="mailto:hello@readypack.co.uk">Contact support</a>
          </span>
        </div>
      </footer>
    </div>
  )
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
