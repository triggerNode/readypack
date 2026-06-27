'use client'

import type { ReactNode } from 'react'
import {
  ArrowRight,
  Download,
  FileCheck2,
  Loader,
  Lock,
  MessageSquareWarning,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import type { OverallState, ScrollTargetState } from '@/lib/documents/portal-view'
import styles from './unified.module.css'

interface Props {
  overall: OverallState
  /** Documents currently in revision (drives the "revising" copy). */
  revisionCount: number
  /** Open info-requests still needing an answer (drives the "action" copy). */
  openRequestCount: number
  /** Smooth-scroll the page to the first card in the given lifecycle state. */
  onScrollTo: (target: ScrollTargetState) => void
  /** Trigger the bulk download of every final document. */
  onDownloadAll: () => void
}

type Tone = '' | 'toneAmber' | 'toneReady' | 'toneComplete' | 'toneRev'

interface CtxAction {
  label: string
  variant: 'btnPrimary' | 'btnAmber' | 'btnSurface'
  kind: 'scroll' | 'download'
  target?: ScrollTargetState
}

interface CtxView {
  icon: ReactNode
  tone: Tone
  title: string
  body: string
  /** "You can safely close this page" reassurance line. */
  quiet: boolean
  action: CtxAction | null
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function ctxView(
  overall: OverallState,
  revisionCount: number,
  openRequestCount: number,
): CtxView {
  switch (overall) {
    case 'action':
      return {
        icon: <MessageSquareWarning width={24} height={24} aria-hidden />,
        tone: 'toneAmber',
        title: `We need ${openRequestCount} quick ${plural(openRequestCount, 'answer', 'answers')} first`,
        body: 'A couple of your answers need clarifying before we can finish those documents. Everything else keeps moving in the background.',
        quiet: false,
        action: { label: 'Answer now', variant: 'btnAmber', kind: 'scroll', target: 'flagged' },
      }
    case 'escalated':
      return {
        icon: <UserCheck width={24} height={24} aria-hidden />,
        tone: '',
        title: 'A specialist is reviewing your pack',
        body: 'Because of your answers, one of our team is checking this personally to make sure everything holds up. We’ll be in touch — there’s nothing you need to do.',
        quiet: true,
        action: null,
      }
    case 'ready': {
      // When a change request is already in flight on some docs while others
      // still await review, acknowledge the revision without telling the
      // client to "do nothing" — there are still drafts to review below.
      const readyBody =
        revisionCount > 0
          ? `We’ve got your change request on ${revisionCount} ${plural(revisionCount, 'document', 'documents')} — we’ll email you when the updated ${plural(revisionCount, 'version is', 'versions are')} ready. The rest are ready for you to review below.`
          : 'Review each one below. Approve what you’re happy with, or request a change.'
      return {
        icon: <FileCheck2 width={24} height={24} aria-hidden />,
        tone: 'toneReady',
        title: 'Your documents are ready to review',
        body: readyBody,
        quiet: false,
        action: { label: 'Start review', variant: 'btnPrimary', kind: 'scroll', target: 'draft' },
      }
    }
    case 'revising':
      return {
        icon: <RotateCcw width={24} height={24} aria-hidden />,
        tone: 'toneRev',
        title: `We’re revising ${revisionCount} ${plural(revisionCount, 'document', 'documents')}`,
        body: `We’ve got your changes. You’re all set for now — we’ll email you the moment the updated ${plural(revisionCount, 'version is', 'versions are')} ready to approve.`,
        quiet: true,
        action: null,
      }
    case 'complete':
      return {
        icon: <ShieldCheck width={24} height={24} aria-hidden />,
        tone: 'toneComplete',
        title: 'Your compliance pack is complete',
        body: 'Every document is approved and un-watermarked. Download them individually below, or grab the whole pack at once.',
        quiet: false,
        action: { label: 'Download your pack', variant: 'btnPrimary', kind: 'download' },
      }
    case 'preparing':
    default:
      return {
        icon: <Loader width={24} height={24} aria-hidden />,
        tone: '',
        title: 'We’re preparing your compliance pack',
        body: 'Your nine documents are being assembled now. There’s nothing you need to do — we’ll email you the moment they’re ready.',
        quiet: true,
        action: null,
      }
  }
}

export function PortalContextBlock({
  overall,
  revisionCount,
  openRequestCount,
  onScrollTo,
  onDownloadAll,
}: Props) {
  const view = ctxView(overall, revisionCount, openRequestCount)
  const toneClass = view.tone ? styles[view.tone] : ''

  const handleAction = () => {
    if (!view.action) return
    if (view.action.kind === 'download') onDownloadAll()
    else if (view.action.target) onScrollTo(view.action.target)
  }

  return (
    <section className={`${styles.context} ${toneClass}`} aria-live="polite">
      <span className={styles.ctxIco}>{view.icon}</span>
      <h2 className={styles.ctxTitle}>{view.title}</h2>
      <p className={styles.ctxBody}>{view.body}</p>

      {view.action ? (
        <div className={styles.ctxActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles[view.action.variant]}`}
            onClick={handleAction}
          >
            {view.action.kind === 'download' ? (
              <>
                <Download width={17} height={17} strokeWidth={1.6} aria-hidden /> {view.action.label}
              </>
            ) : (
              <>
                {view.action.label} <ArrowRight width={17} height={17} strokeWidth={1.6} aria-hidden />
              </>
            )}
          </button>
        </div>
      ) : null}

      {view.quiet ? (
        <span className={styles.ctxQuiet}>
          <Lock aria-hidden /> You can safely close this page
        </span>
      ) : null}
    </section>
  )
}
