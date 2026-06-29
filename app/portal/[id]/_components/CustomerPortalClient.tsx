'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Database,
  Download,
  Eye,
  FileClock,
  FileText,
  Loader,
  Lock,
  MessageSquare,
  MessageSquareText,
  RotateCcw,
  Search,
  ScrollText,
  Send,
  Shield,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DocumentType } from '@/types/database'
import {
  approveDocumentAction,
  approvePackAction,
  submitInfoRequestAnswerAction,
  submitRevisionAction,
} from '../actions'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { DOC_CATALOG, DEFAULT_PAGE_COUNT } from '@/lib/documents/doc-catalog'
import type { CardState, PortalFeed } from '@/lib/documents/portal-feed'
import type { PackState } from '@/lib/documents/pack-status'
import { deriveOverall, type ScrollTargetState } from '@/lib/documents/portal-view'
import { PackTracker } from './PackTracker'
import { PortalContextBlock } from './PortalContextBlock'
import styles from './portal.module.css'

interface Props {
  orderId: string
  customerName: string
  customerInitials: string
  packReference: string
  /** The full feed for the first SSR paint — kept live thereafter by polling. */
  initialFeed: PortalFeed
}

// A document merged for rendering: the feed's per-doc facts + the static catalog
// display metadata (kept out of the polled payload to stay lean).
interface PortalCard {
  documentType: DocumentType
  ref: string
  title: string
  icon: string
  reg: string
  audience: string
  pages: number
  cardState: CardState
  isRevised: boolean
  fileUrl: string | null
  downloadUrl: string | null
}

// The optimistic override only ever advances a card to one of these terminal /
// with-us states (approve → final, request changes → revision). It wins over the
// feed's cardState until the next poll confirms the same thing.
type Override = Extract<CardState, 'final' | 'revision'>

const ICONS: Record<string, LucideIcon> = {
  'file-text': FileText,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  search: Search,
  users: Users,
  'message-square': MessageSquare,
  database: Database,
  'scroll-text': ScrollText,
  'clipboard-check': ClipboardCheck,
}

const FINALISE_STEPS = [
  'Approval recorded',
  'Removing draft watermarks',
  'Unlocking final PDFs',
] as const

function DocIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? FileText
  return <Cmp width={size} height={size} strokeWidth={1.5} aria-hidden />
}

// Poll cadence: fast while actively generating, slower once settled, stop only
// at the terminal `complete`. Keep polling through released/partial/review so a
// revision being re-released (or generation progress) shows up live.
function pollDelay(state: PackState): number | null {
  if (state === 'complete') return null
  if (state === 'progress') return 4000
  return 12000
}

// Build the merged card view-models from the feed (canonical order preserved).
function cardsFromFeed(feed: PortalFeed): PortalCard[] {
  return feed.docs.map((d) => {
    const meta = DOC_CATALOG[d.documentType]
    return {
      documentType: d.documentType,
      ref: meta.ref,
      title: meta.title,
      icon: meta.icon,
      reg: meta.reg,
      audience: meta.audience,
      pages: d.pageCount ?? DEFAULT_PAGE_COUNT,
      cardState: d.cardState,
      isRevised: d.isRevised,
      fileUrl: d.fileUrl,
      downloadUrl: d.downloadUrl,
    }
  })
}

// Fire individual downloads for a set of documents (staggered so the browser
// doesn't drop concurrent navigations).
function triggerBulkDownload(items: ReadonlyArray<{ downloadUrl: string | null; fileUrl: string | null }>) {
  items.forEach((doc, i) => {
    const url = doc.downloadUrl ?? doc.fileUrl
    if (!url) return
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }, i * 400)
  })
}

export function CustomerPortalClient({
  orderId,
  customerName,
  customerInitials,
  packReference,
  initialFeed,
}: Props) {
  // Read prefers-reduced-motion after mount so SSR and first client render agree.
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mql.matches)
    const onChange = () => setPrefersReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // ── Live feed (single source of truth for tracker + cards) ───────
  const [feed, setFeed] = useState<PortalFeed>(initialFeed)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest phase, kept in a ref so the poll's error/retry branches reschedule at
  // the CURRENT cadence even if a refetch advanced the phase mid-request.
  const phaseRef = useRef(feed.phase.state)
  phaseRef.current = feed.phase.state

  // Poll the unified feed. Recursive setTimeout so the cadence adapts to the
  // current phase (and stops once the pack is complete). One read feeds both
  // the tracker and the cards, so they can never disagree.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const schedule = (state: PackState) => {
      const delay = pollDelay(state)
      if (delay === null) return
      timerRef.current = setTimeout(tick, delay)
    }
    const tick = async () => {
      // Pause while the tab is hidden — a backgrounded portal shouldn't keep
      // polling every 4-12s (real server load at scale). We simply stop
      // re-arming the loop; the visibilitychange handler resumes with a fresh
      // poll the moment the tab is in the foreground again.
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch(`/api/portal/${orderId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          if (!cancelled) schedule(phaseRef.current)
          return
        }
        const next = (await res.json()) as PortalFeed
        if (cancelled) return
        setFeed(next)
        schedule(next.phase.state)
      } catch {
        if (!cancelled) schedule(phaseRef.current)
      }
    }

    // Resume immediately when the tab returns to the foreground.
    const onVisibility = () => {
      if (document.hidden) return
      if (timerRef.current) clearTimeout(timerRef.current)
      void tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    schedule(feed.phase.state)
    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // Re-arm whenever the phase changes so the cadence follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, feed.phase.state])

  // Immediate re-poll after an action, so the server truth replaces the
  // optimistic override within the same beat (replaces the old router.refresh).
  const refetch = async () => {
    try {
      const res = await fetch(`/api/portal/${orderId}`, { cache: 'no-store' })
      if (res.ok) setFeed((await res.json()) as PortalFeed)
    } catch {
      /* a regular poll will catch up */
    }
  }

  const cards = useMemo(() => cardsFromFeed(feed), [feed])

  // ── Optimistic overrides — reconciled against the feed ───────────
  const [overrides, setOverrides] = useState<Map<DocumentType, Override>>(new Map())
  // Drop an override once the feed reports the same state (server caught up),
  // instead of blunt-clearing every poll — that would flash a card back mid-action.
  useEffect(() => {
    setOverrides((prev) => {
      if (prev.size === 0) return prev
      const feedState = new Map(
        feed.docs.map((d) => [d.documentType, d.cardState] as [DocumentType, CardState]),
      )
      let changed = false
      const next = new Map(prev)
      prev.forEach((ov, docType) => {
        if (feedState.get(docType) === ov) {
          next.delete(docType)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [feed])

  const stateOf = (card: PortalCard): CardState =>
    overrides.get(card.documentType) ?? card.cardState

  const setOverride = (docTypes: DocumentType[], status: Override) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      docTypes.forEach((t) => next.set(t, status))
      return next
    })
  }

  // ── Remediation (info_requests) — open drives "action" ───────────
  const openRequests = useMemo(
    () => feed.infoRequests.filter((r) => r.status === 'open'),
    [feed.infoRequests],
  )
  const submittedRequests = feed.infoRequests.filter((r) => r.status === 'submitted')
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  // Keep only answered ids that are still open on the server (optimistic window);
  // once a request flips to submitted/resolved the feed itself drives the state.
  useEffect(() => {
    setAnsweredIds((prev) => {
      if (prev.size === 0) return prev
      const openIds = new Set(openRequests.map((r) => r.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (openIds.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [openRequests])
  const remainingRequests = openRequests.filter((r) => !answeredIds.has(r.id))

  const portalMode: 'action' | 'submitted' | 'review' =
    remainingRequests.length > 0
      ? 'action'
      : submittedRequests.length > 0 || answeredIds.size > 0
        ? 'submitted'
        : 'review'
  const reviewActive = portalMode === 'review'

  // ── Counts from the EFFECTIVE (override-applied) states ──────────
  // Computing from the same states the cards render guarantees the tracker, the
  // context block and the cards move together — even during an optimistic flip.
  const finalCount = cards.filter((c) => stateOf(c) === 'final').length
  const revisionCount = cards.filter((c) => stateOf(c) === 'revision').length
  const awaitingTypes = cards.filter((c) => stateOf(c) === 'draft').map((c) => c.documentType)
  const awaitingCount = awaitingTypes.length
  const total = cards.length
  const allFinal = total > 0 && finalCount === total
  const finalDocs = cards.filter((c) => stateOf(c) === 'final')

  const overall = deriveOverall(
    feed.phase.state,
    { total, finalCount, revisionCount, awaitingCount },
    remainingRequests.length > 0,
  )

  // ── Selection (draft cards only) ─────────────────────────────────
  const [selected, setSelected] = useState<Set<DocumentType>>(new Set())

  // ── Request-changes overlay ──────────────────────────────────────
  const [reqOpen, setReqOpen] = useState(false)
  const [reqTargets, setReqTargets] = useState<DocumentType[]>([])
  const [reqText, setReqText] = useState('')
  const [reqError, setReqError] = useState<string | null>(null)
  const reqTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Finalising overlay + per-card micro-moment ───────────────────
  const [overlayShow, setOverlayShow] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [finalising, setFinalising] = useState<Set<DocumentType>>(new Set())
  const [justFinal, setJustFinal] = useState<Set<DocumentType>>(new Set())
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // ── Remediation flow overlay state ───────────────────────────────
  const [flowOpen, setFlowOpen] = useState(false)
  const [currentReqId, setCurrentReqId] = useState<string | null>(null)
  const [flowSelections, setFlowSelections] = useState<string[]>([])
  const [flowText, setFlowText] = useState('')
  const [flowError, setFlowError] = useState<string | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)

  const currentRequest = openRequests.find((r) => r.id === currentReqId) ?? null
  const flaggedDocTypes = new Map<DocumentType, string>()
  for (const r of remainingRequests) {
    if (r.documentType) flaggedDocTypes.set(r.documentType, r.id)
  }
  const topLevelRequest = remainingRequests.find((r) => r.documentType === null) ?? null

  useEffect(() => {
    if (reqOpen) {
      const t = setTimeout(() => reqTextareaRef.current?.focus(), 280)
      return () => clearTimeout(t)
    }
  }, [reqOpen])

  // ── Smooth scroll-to-card (from the context CTAs) ────────────────
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [highlightType, setHighlightType] = useState<DocumentType | null>(null)
  const hiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (hiTimer.current) clearTimeout(hiTimer.current) }, [])

  const scrollToCard = (target: ScrollTargetState) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-card-state="${target}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' })
    const dt = el.dataset.doctype as DocumentType | undefined
    if (!dt) return
    setHighlightType(dt)
    if (hiTimer.current) clearTimeout(hiTimer.current)
    hiTimer.current = setTimeout(() => setHighlightType(null), 2000)
  }
  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
  const handleDownloadAll = () => triggerBulkDownload(finalDocs)

  // ── Selection helpers ────────────────────────────────────────────
  const toggleSelect = (docType: DocumentType) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(docType)) next.delete(docType)
      else next.add(docType)
      return next
    })
  }
  const deselectAll = () => setSelected(new Set())

  type DocTypeSetter = Dispatch<SetStateAction<Set<DocumentType>>>
  const addTo = (setter: DocTypeSetter, docType: DocumentType) =>
    setter((prev) => new Set(prev).add(docType))
  const removeFrom = (setter: DocTypeSetter, docType: DocumentType) =>
    setter((prev) => {
      const next = new Set(prev)
      next.delete(docType)
      return next
    })

  // ── Approve a single document — with the finalising micro-moment ──
  const resolveFinal = (docType: DocumentType) => {
    setOverride([docType], 'final')
    addTo(setJustFinal, docType)
    setTimeout(() => removeFrom(setJustFinal, docType), 6000)
    void refetch()
  }
  const approveOne = (docType: DocumentType) => {
    setErrorBanner(null)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(docType)
      return next
    })

    if (prefersReduced) {
      startTransition(async () => {
        const result = await approveDocumentAction({ orderId, documentType: docType })
        if (!result.success) {
          setErrorBanner(result.error)
          return
        }
        resolveFinal(docType)
      })
      return
    }

    const startedAt = Date.now()
    addTo(setFinalising, docType)
    startTransition(async () => {
      const result = await approveDocumentAction({ orderId, documentType: docType })
      const wait = Math.max(0, 1100 - (Date.now() - startedAt))
      setTimeout(() => {
        removeFrom(setFinalising, docType)
        if (!result.success) {
          setErrorBanner(result.error)
          return
        }
        resolveFinal(docType)
      }, wait)
    })
  }

  // ── Approve all remaining drafts (whole-pack helper) ─────────────
  const approveRemaining = () => {
    if (awaitingCount === 0) return
    setErrorBanner(null)

    const finish = async () => {
      const result = await approvePackAction({ orderId })
      if (!result.success) {
        setOverlayShow(false)
        setActiveStep(-1)
        setErrorBanner(result.error)
        return
      }
      setOverride(awaitingTypes, 'final')
      void refetch()
      setTimeout(() => setOverlayShow(false), 400)
    }

    if (prefersReduced) {
      startTransition(() => {
        void finish()
      })
      return
    }
    setOverlayShow(true)
    setActiveStep(-1)
    ;[260, 780, 1300].forEach((ms, i) => setTimeout(() => setActiveStep(i), ms))
    startTransition(() => {
      void finish()
    })
  }

  // ── Request changes (single or multi) ────────────────────────────
  const openRequest = (targets: DocumentType[]) => {
    if (targets.length === 0) return
    setReqTargets(targets)
    setReqText('')
    setReqError(null)
    setReqOpen(true)
  }
  const closeRequest = () => {
    setReqOpen(false)
    setReqError(null)
  }
  const sendRequest = () => {
    setReqError(null)
    const trimmed = reqText.trim()
    if (trimmed.length < 10) {
      setReqError('Please describe what needs changing (at least 10 characters).')
      return
    }
    const targets = reqTargets
    startTransition(async () => {
      const result = await submitRevisionAction({
        orderId,
        documentTypes: targets,
        feedbackText: trimmed,
      })
      if (!result.success) {
        setReqError(result.error)
        return
      }
      // Flip the cards to "revision" immediately. Because the tracker + context
      // recompute off these same effective states, they re-engage in the very
      // same render — the revision-sync rule, by construction.
      setOverride(targets, 'revision')
      setSelected(new Set())
      setReqOpen(false)
      void refetch()
    })
  }

  // ── Remediation flow handlers ────────────────────────────────────
  const startFlow = (startId?: string | null) => {
    const start =
      startId && !answeredIds.has(startId) ? startId : (remainingRequests[0]?.id ?? null)
    if (!start) return
    setCurrentReqId(start)
    setFlowSelections([])
    setFlowText('')
    setFlowError(null)
    setFlowOpen(true)
  }
  const closeFlow = () => {
    setFlowOpen(false)
    setFlowError(null)
  }
  const toggleFlowOption = (option: string) => {
    setFlowSelections((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    )
  }
  const advanceTo = (nextId: string) => {
    setCurrentReqId(nextId)
    setFlowSelections([])
    setFlowText('')
    setFlowError(null)
  }
  const submitFlowItem = () => {
    if (!currentRequest) return
    setFlowError(null)
    const text = flowText.trim()
    if (flowSelections.length === 0 && text.length === 0) {
      setFlowError('Please choose an option or add a short answer before submitting.')
      return
    }
    startTransition(async () => {
      const result = await submitInfoRequestAnswerAction({
        orderId,
        infoRequestId: currentRequest.id,
        answerText: text.length > 0 ? text : undefined,
        answerSelections: flowSelections.length > 0 ? flowSelections : undefined,
      })
      if (!result.success) {
        setFlowError(result.error)
        return
      }
      const answeredNow = new Set(answeredIds).add(currentRequest.id)
      setAnsweredIds(answeredNow)
      const next = openRequests.find((r) => !answeredNow.has(r.id))
      const remaining = result.remainingOpen ?? (next ? 1 : 0)
      if (remaining > 0 && next) {
        advanceTo(next.id)
      } else {
        setFlowOpen(false)
        setDoneOpen(true)
        void refetch()
      }
    })
  }

  const totalFlowItems = openRequests.length
  const answeredCount = answeredIds.size
  const remainingCount = remainingRequests.length
  const selectedCount = selected.size

  const shellClass = `${styles.shell} ${allFinal ? styles.approved : ''}`

  return (
    <div className={shellClass}>
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Portal">
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

      {/* ── Main ─────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={`${styles.glow} ${allFinal ? styles.glowOn : ''}`} aria-hidden />

        <div className={styles.container}>
          {/* Tracker + context (single source of truth, on top) */}
          <PackTracker phase={feed.phase} overall={overall} />
          <PortalContextBlock
            overall={overall}
            revisionCount={revisionCount}
            openRequestCount={remainingRequests.length}
            onScrollTo={scrollToCard}
            onDownloadAll={handleDownloadAll}
          />

          {/* List head */}
          <div className={styles.listHead}>
            <div className={styles.listHeadLeft}>
              <span className={styles.listHeadTitle}>Your documents</span>
              {reviewActive && (finalCount > 0 || revisionCount > 0) ? (
                <span className={styles.summaryChip}>
                  {finalCount > 0 ? (
                    <span className={`${styles.scSeg} ${styles.scFinal}`}>
                      <span className={styles.scDot} />
                      {finalCount} of {total} final
                    </span>
                  ) : null}
                  {revisionCount > 0 ? (
                    <span className={`${styles.scSeg} ${styles.scRev}`}>
                      <span className={styles.scDot} />
                      {revisionCount} in revision
                    </span>
                  ) : null}
                  {awaitingCount > 0 ? (
                    <span className={`${styles.scSeg} ${styles.scDraft}`}>
                      <span className={styles.scDot} />
                      {awaitingCount} awaiting your review
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className={styles.listHeadCount}>
                  {overall === 'preparing'
                    ? `Pack ${packReference}`
                    : `${total} of ${total} · Pack ${packReference}`}
                </span>
              )}
            </div>
            {reviewActive && finalCount > 0 ? (
              <DownloadAllButton
                documents={finalDocs}
                packReference={packReference}
                someInRevision={revisionCount > 0}
              />
            ) : (
              <span className={styles.listHeadAside}>Watermarked previews</span>
            )}
          </div>

          {errorBanner ? (
            <p className={styles.revError} role="alert" style={{ marginBottom: 16 }}>
              {errorBanner}
            </p>
          ) : null}

          {/* Top-level (case-wide) information request — not tied to one card */}
          {portalMode === 'action' && topLevelRequest ? (
            <button
              type="button"
              className={styles.actionBanner}
              onClick={() => startFlow(topLevelRequest.id)}
            >
              <span className={styles.banIco}>
                <Building2 width={22} height={22} strokeWidth={1.5} aria-hidden />
              </span>
              <span className={styles.banBody}>
                <span className={styles.banTitle}>About your business</span>
                <span className={styles.banSub}>{topLevelRequest.prompt}</span>
              </span>
              <span className={styles.banCta}>
                <ArrowRight width={18} height={18} strokeWidth={1.5} aria-hidden />
              </span>
            </button>
          ) : null}

          {/* Doc grid */}
          <div className={styles.docGrid} ref={gridRef}>
            {cards.map((doc) => {
              const st = stateOf(doc)
              const isRemediation = portalMode === 'action' || portalMode === 'submitted'
              const flaggedReqId =
                portalMode === 'action' ? flaggedDocTypes.get(doc.documentType) : undefined
              const isFlagged = st === 'flagged'
              const isRevisedDraft = st === 'draft' && doc.isRevised
              // Selectable only in review mode on a draft card.
              const selectable = reviewActive && st === 'draft'
              const isSelected = selected.has(doc.documentType)
              const isFinalising = finalising.has(doc.documentType)
              const isJustFinal = justFinal.has(doc.documentType)
              const cardClass = [
                styles.docCard,
                st === 'final' ? styles.docCardFinal : '',
                st === 'revision' ? styles.docCardRevision : '',
                st === 'flagged' ? styles.docCardFlagged : '',
                st === 'queued' ? styles.docCardQueued : '',
                st === 'drafting' ? styles.docCardDrafting : '',
                st === 'qa' ? styles.docCardQa : '',
                st === 'failed' ? styles.docCardFailed : '',
                isSelected ? styles.docCardSelected : '',
                isFinalising ? styles.docCardFinalising : '',
                isJustFinal ? styles.justFinal : '',
                highlightType === doc.documentType ? styles.cardHi : '',
              ]
                .filter(Boolean)
                .join(' ')
              const showWatermark = st === 'draft'
              return (
                <div
                  key={doc.documentType}
                  className={cardClass}
                  data-card-state={st}
                  data-doctype={doc.documentType}
                  onClick={
                    selectable
                      ? (e) => {
                          if ((e.target as HTMLElement).closest('button, a')) return
                          toggleSelect(doc.documentType)
                        }
                      : undefined
                  }
                  role={selectable ? 'button' : 'group'}
                  aria-pressed={selectable ? isSelected : undefined}
                  tabIndex={selectable ? 0 : -1}
                  onKeyDown={
                    selectable
                      ? (e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            toggleSelect(doc.documentType)
                          }
                        }
                      : undefined
                  }
                >
                  {showWatermark ? (
                    <div className={styles.docWm} aria-hidden>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i}>DRAFT &nbsp; DRAFT &nbsp; DRAFT</span>
                      ))}
                    </div>
                  ) : null}

                  {isFinalising ? (
                    <div className={styles.finLayer} aria-hidden>
                      <span className={styles.finIco}>
                        <Loader width={20} height={20} aria-hidden />
                      </span>
                      <div className={styles.finCopy}>
                        <span className={styles.finTitle}>Finalising your document</span>
                        <span className={styles.finSub}>Removing the draft watermark.</span>
                      </div>
                      <span className={styles.finShimmer} />
                    </div>
                  ) : null}

                  <div className={styles.docTop}>
                    <div className={styles.docTopLeft}>
                      {selectable ? (
                        <button
                          className={styles.docCheck}
                          type="button"
                          aria-label={`Select ${doc.title}`}
                          aria-pressed={isSelected}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelect(doc.documentType)
                          }}
                          tabIndex={-1}
                        >
                          <Check width={13} height={13} strokeWidth={3} aria-hidden />
                        </button>
                      ) : null}
                      <span
                        className={`${styles.docIcon} ${
                          st === 'final'
                            ? styles.docIconFinal
                            : st === 'revision'
                              ? styles.docIconRevision
                              : ''
                        }`}
                      >
                        <DocIcon name={doc.icon} />
                      </span>
                    </div>
                    <div className={styles.badgeStack}>
                      {isRevisedDraft ? (
                        <span className={styles.revisedTag}>
                          <RotateCcw width={11} height={11} strokeWidth={2.2} aria-hidden /> Revised
                        </span>
                      ) : null}
                      <CardBadge state={st} />
                    </div>
                  </div>

                  <div className={styles.docRef}>{doc.ref}</div>
                  <h3 className={styles.docTitle}>{doc.title}</h3>

                  <CardBody
                    state={st}
                    reg={doc.reg}
                    pages={doc.pages}
                    audience={doc.audience}
                    isRevisedDraft={isRevisedDraft}
                  />

                  <div className={styles.docAction}>
                    {st === 'final' ? (
                      <>
                        {isJustFinal ? (
                          <span className={styles.dlNote}>
                            <Download width={13} height={13} strokeWidth={2.2} aria-hidden />
                            Your final document is ready — download it
                          </span>
                        ) : null}
                        <a
                          className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm} ${styles.actionDownload}`}
                          href={doc.downloadUrl ?? doc.fileUrl ?? '#'}
                          onClick={(e) => {
                            if (!doc.downloadUrl && !doc.fileUrl) e.preventDefault()
                            e.stopPropagation()
                          }}
                        >
                          <Download width={15} height={15} strokeWidth={1.5} aria-hidden /> Download PDF
                        </a>
                      </>
                    ) : st === 'revision' ? (
                      <div className={styles.actRevision}>
                        <Clock width={14} height={14} strokeWidth={1.7} aria-hidden /> We&rsquo;ll let
                        you know when it&rsquo;s ready
                      </div>
                    ) : st === 'failed' ? (
                      <div className={styles.actFailed}>
                        <Clock width={14} height={14} strokeWidth={1.7} aria-hidden /> Our team has
                        been notified
                      </div>
                    ) : st === 'draft' && isRemediation ? (
                      // Draft while remediation is outstanding: flagged → answer,
                      // else a calm muted note (no approve/revise until resolved).
                      isFlagged ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnAmber} ${styles.btnSm} ${styles.actionAnswer}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            startFlow(flaggedReqId)
                          }}
                        >
                          <MessageSquareText width={15} height={15} strokeWidth={1.5} aria-hidden />
                          Answer this question
                        </button>
                      ) : (
                        <span className={styles.actionNoAction}>
                          <Check width={14} height={14} strokeWidth={2} aria-hidden /> No action needed
                        </span>
                      )
                    ) : st === 'flagged' ? (
                      // A flagged card (open question on a generated doc) → answer.
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnAmber} ${styles.btnSm} ${styles.actionAnswer}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startFlow(flaggedReqId)
                        }}
                      >
                        <MessageSquareText width={15} height={15} strokeWidth={1.5} aria-hidden />
                        Answer this question
                      </button>
                    ) : st === 'draft' ? (
                      // Review mode draft: per-card approve + request changes + preview
                      <>
                        <div className={styles.scopeLabel}>This document</div>
                        <div className={styles.actRow}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.actApprove}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              approveOne(doc.documentType)
                            }}
                            disabled={pending}
                          >
                            <Check width={15} height={15} strokeWidth={2} aria-hidden /> Approve
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRequest([doc.documentType])
                            }}
                            disabled={pending}
                          >
                            <MessageSquareText width={15} height={15} strokeWidth={1.5} aria-hidden />{' '}
                            Request changes
                          </button>
                        </div>
                        <div className={styles.actSecondrow}>
                          <a
                            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                            href={doc.fileUrl ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!doc.fileUrl) e.preventDefault()
                              e.stopPropagation()
                            }}
                          >
                            <Eye width={15} height={15} strokeWidth={1.5} aria-hidden /> Preview
                          </a>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <p className={styles.secureNote}>
            <Lock width={14} height={14} strokeWidth={1.5} aria-hidden />
            Delivered over a secure, single-use link.&nbsp;
            <a href="mailto:hello@readypack.co.uk">Documentation support, not legal advice.</a>
          </p>
        </div>
      </main>

      {/* ── Sticky action bar — remediation: items need input ────── */}
      {portalMode === 'action' ? (
        <div className={styles.actionBar}>
          <div className={styles.container}>
            <div className={styles.actionBarInner}>
              <div className={styles.abInfo}>
                <span className={`${styles.abShield} ${styles.abShieldAction}`} aria-hidden>
                  {remainingCount}
                </span>
                <div className={styles.abText}>
                  <span className={styles.abTitle}>
                    {remainingCount} {remainingCount === 1 ? 'item needs' : 'items need'} your input
                  </span>
                  <span className={styles.abSub}>
                    Answer a few quick questions from our compliance team so we can finish your pack.
                    You don’t need to approve anything yet.
                  </span>
                </div>
              </div>
              <div className={styles.abActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnAmber} ${styles.btnLg}`}
                  onClick={() => startFlow()}
                >
                  Provide the information
                  <ArrowRight width={18} height={18} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Sticky action bar — submitted: awaiting admin review ──── */}
      {portalMode === 'submitted' ? (
        <div className={styles.actionBar}>
          <div className={styles.container}>
            <div className={styles.actionBarInner}>
              <div className={styles.abInfo}>
                <span className={`${styles.abShield} ${styles.abShieldOk}`} aria-hidden>
                  <Check width={22} height={22} strokeWidth={1.5} />
                </span>
                <div className={styles.abText}>
                  <span className={styles.abTitle}>Your answers have been received</span>
                  <span className={styles.abSub}>
                    Our compliance team is reviewing your responses and will update your pack. We’ll
                    email you when it’s ready.
                  </span>
                </div>
              </div>
              <div className={styles.abActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSurface} ${styles.btnMd}`}
                  onClick={scrollToTop}
                >
                  <Activity width={16} height={16} strokeWidth={1.5} aria-hidden /> View pack progress
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Sticky action bar — review: approve / request changes ── */}
      {reviewActive && awaitingCount > 0 ? (
        <div className={styles.actionBar}>
          <div className={styles.container}>
            <div className={styles.actionBarInner}>
              <div className={styles.abInfo}>
                <span
                  className={`${styles.abShield} ${selectedCount > 0 ? styles.abShieldSel : ''}`}
                  aria-hidden
                >
                  {selectedCount > 0 ? (
                    selectedCount
                  ) : (
                    <FileClock width={22} height={22} strokeWidth={1.5} />
                  )}
                </span>
                <div className={styles.abText}>
                  <span className={styles.abTitle}>
                    {selectedCount > 0
                      ? `${selectedCount} document${selectedCount === 1 ? '' : 's'} selected`
                      : `${awaitingCount} document${awaitingCount === 1 ? '' : 's'} awaiting your review`}
                  </span>
                  <span className={styles.abSub}>
                    {selectedCount > 0
                      ? `Request changes on the selected document${selectedCount === 1 ? '' : 's'} — each moves into revision while the rest stay yours to approve.`
                      : 'Approve each document individually, or approve everything still in draft at once.'}
                  </span>
                </div>
              </div>
              <div className={styles.abActions}>
                {selectedCount > 0 ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
                      onClick={deselectAll}
                      disabled={pending}
                    >
                      Deselect
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
                      onClick={() => openRequest(Array.from(selected))}
                      disabled={pending}
                    >
                      <MessageSquareText width={17} height={17} strokeWidth={1.5} aria-hidden />
                      Request changes ({selectedCount})
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
                      onClick={approveRemaining}
                      disabled={pending || awaitingCount === 0}
                    >
                      <ShieldCheck width={16} height={16} strokeWidth={1.5} aria-hidden /> Approve
                      remaining {awaitingCount}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                    onClick={approveRemaining}
                    disabled={pending || awaitingCount === 0}
                  >
                    <ShieldCheck width={18} height={18} strokeWidth={1.5} aria-hidden />
                    Approve remaining {awaitingCount}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Finalising overlay ───────────────────────────────── */}
      <div
        className={`${styles.overlay} ${overlayShow ? styles.overlayShow : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Finalising your pack"
        aria-hidden={!overlayShow}
      >
        <div className={styles.overlayCard}>
          <svg className={styles.ovSpinner} viewBox="0 0 50 50" aria-hidden>
            <circle cx="25" cy="25" r="20" />
            <circle className="arc" cx="25" cy="25" r="20" />
          </svg>
          <h2 className={styles.ovTitle}>Finalising your documents</h2>
          <p className={styles.ovSub}>Confirming your approval and preparing your final PDFs.</p>
          <div className={styles.ovSteps}>
            {FINALISE_STEPS.map((label, i) => (
              <div
                key={label}
                className={`${styles.ovStep} ${i <= activeStep ? styles.ovStepActive : ''}`}
              >
                <span className={styles.sIco}>
                  <Check width={13} height={13} strokeWidth={2.4} aria-hidden />
                </span>
                <span className={styles.sLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Request-changes overlay (per-document revision) ─────── */}
      <div
        className={`${styles.reqOverlay} ${reqOpen ? styles.reqOverlayShow : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Request changes"
        aria-hidden={!reqOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeRequest()
        }}
      >
        <div className={styles.reqCard}>
          <div className={styles.reqHead}>
            <span className={styles.reqEyebrow}>Request changes</span>
            <button type="button" className={styles.reqClose} aria-label="Close" onClick={closeRequest}>
              <X width={18} height={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
          <div className={styles.reqBody}>
            {reqTargets.length === 1 ? (
              <span className={styles.reqRelates}>
                <FileText width={14} height={14} strokeWidth={1.6} aria-hidden />
                {cards.find((d) => d.documentType === reqTargets[0])?.title ?? 'Document'}
                <span className={styles.reqRelatesRef}>
                  · {cards.find((d) => d.documentType === reqTargets[0])?.ref ?? ''}
                </span>
              </span>
            ) : reqTargets.length > 1 ? (
              <div className={styles.reqChips}>
                {reqTargets.map((t) => (
                  <span key={t} className={styles.reqMchip}>
                    {cards.find((d) => d.documentType === t)?.title ?? t}
                  </span>
                ))}
              </div>
            ) : null}
            <p className={styles.reqPrompt}>
              {reqTargets.length > 1
                ? `${reqTargets.length} documents selected — what would you like us to change?`
                : 'What would you like us to change?'}
            </p>
            <p className={styles.reqWhy}>
              {reqTargets.length > 1
                ? 'Each of these moves into revision while the rest of your pack stays yours to approve.'
                : 'Tell us what’s not right and we’ll revise this document. The rest of your pack is unaffected — you can keep approving the others.'}
            </p>
            <label className={styles.reqFtLabel} htmlFor="reqChangeText">
              Your change request
            </label>
            <textarea
              id="reqChangeText"
              ref={reqTextareaRef}
              className={styles.reqTextarea}
              placeholder="For example: the registered company name should read ‘Brightfield’, or the risk scoring needs to reflect our human-review step."
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
              maxLength={4000}
            />
            {reqError ? (
              <p className={styles.revError} role="alert">
                {reqError}
              </p>
            ) : null}
          </div>
          <div className={styles.reqFoot}>
            <span className={styles.reqFootHint}>
              Your reviewer is notified immediately. We’ll email you when the revised version is ready
              to approve.
            </span>
            <div className={styles.reqFootActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
                onClick={closeRequest}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
                onClick={sendRequest}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader
                      width={16}
                      height={16}
                      style={{ animation: 'spin 0.9s linear infinite' }}
                      aria-hidden
                    />{' '}
                    Sending…
                  </>
                ) : (
                  <>
                    <Send width={16} height={16} strokeWidth={1.6} aria-hidden /> Send change request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Information-request overlay (remediation flow) ─────── */}
      <div
        className={`${styles.reqOverlay} ${flowOpen ? styles.reqOverlayShow : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Information request"
        aria-hidden={!flowOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeFlow()
        }}
      >
        {currentRequest ? (
          <div className={styles.reqCard}>
            <div className={styles.reqHead}>
              <span className={styles.reqEyebrow}>Information request</span>
              <span className={styles.reqProgress}>
                Item <b>{Math.min(answeredCount + 1, totalFlowItems)}</b> of {totalFlowItems}
              </span>
              <button type="button" className={styles.reqClose} aria-label="Close" onClick={closeFlow}>
                <X width={18} height={18} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <div className={styles.reqDots}>
              {openRequests.map((r, i) => {
                const done = answeredIds.has(r.id)
                const active = r.id === currentReqId
                return (
                  <span
                    key={r.id}
                    className={`${styles.reqDot} ${done ? styles.reqDotDone : ''} ${
                      active && !done ? styles.reqDotActive : ''
                    }`}
                    aria-hidden
                  >
                    <span className={styles.srOnly}>{`Item ${i + 1}`}</span>
                  </span>
                )
              })}
            </div>

            <div className={styles.reqBody}>
              <span className={styles.reqRelates}>
                {currentRequest.documentType ? (
                  <>
                    <FileText width={14} height={14} strokeWidth={1.5} aria-hidden /> Relates to ·{' '}
                    {cards.find((d) => d.documentType === currentRequest.documentType)?.title ??
                      'your pack'}
                  </>
                ) : (
                  <>
                    <Building2 width={14} height={14} strokeWidth={1.5} aria-hidden /> About your
                    business
                  </>
                )}
              </span>
              <p className={styles.reqPrompt}>{currentRequest.prompt}</p>

              {currentRequest.options.length > 0 ? (
                <div className={styles.reqOptions}>
                  {currentRequest.options.map((option) => {
                    const checked = flowSelections.includes(option)
                    return (
                      <button
                        type="button"
                        key={option}
                        className={`${styles.reqOpt} ${checked ? styles.reqOptChecked : ''}`}
                        onClick={() => toggleFlowOption(option)}
                        aria-pressed={checked}
                      >
                        <span className={styles.reqMark}>
                          <Check width={13} height={13} strokeWidth={3.2} aria-hidden />
                        </span>
                        <span className={styles.reqOptLabel}>{option}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <label className={styles.reqFtLabel} htmlFor="reqText">
                {currentRequest.options.length > 0
                  ? 'Add anything that helps us get this right'
                  : 'Your answer'}
              </label>
              <textarea
                id="reqText"
                className={styles.reqTextarea}
                placeholder={
                  currentRequest.options.length > 0
                    ? 'Optional — a sentence or two of context is plenty.'
                    : 'Type your answer here.'
                }
                value={flowText}
                onChange={(e) => setFlowText(e.target.value)}
                maxLength={4000}
              />

              {flowError ? (
                <p className={styles.revError} role="alert">
                  {flowError}
                </p>
              ) : null}
            </div>

            <div className={styles.reqFoot}>
              <span className={styles.reqFootHint}>
                Your answer goes straight to your reviewer. Your pack stays in review until every item
                is resolved.
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
                onClick={submitFlowItem}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader
                      width={16}
                      height={16}
                      style={{ animation: 'spin 0.9s linear infinite' }}
                      aria-hidden
                    />{' '}
                    Saving…
                  </>
                ) : remainingCount <= 1 ? (
                  'Submit & finish'
                ) : (
                  'Submit answer'
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Done / "we're reviewing your answers" confirmation ──── */}
      <div
        className={`${styles.reqOverlay} ${doneOpen ? styles.reqOverlayShow : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Answers submitted"
        aria-hidden={!doneOpen}
      >
        <div className={styles.doneCard}>
          <span className={styles.doneIco}>
            <CheckCheck width={28} height={28} strokeWidth={2} aria-hidden />
          </span>
          <h2 className={styles.doneTitle}>Thank you — your answers are in.</h2>
          <p className={styles.doneSub}>
            Our compliance team is reviewing your responses. We’ll update your pack and email you when
            it’s ready. There’s nothing else you need to do right now.
          </p>
          <div className={styles.doneActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
              onClick={() => {
                setDoneOpen(false)
                scrollToTop()
              }}
            >
              <Activity width={17} height={17} strokeWidth={1.5} aria-hidden /> View pack progress
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
              onClick={() => setDoneOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
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

// ── Per-card badge ─────────────────────────────────────────────────
function CardBadge({ state }: { state: CardState }) {
  switch (state) {
    case 'final':
      return <span className={`${styles.cardBadge} ${styles.badgeFinal}`}><span className={styles.bdot} /> Final</span>
    case 'revision':
      return <span className={`${styles.cardBadge} ${styles.badgeRev}`}><span className={styles.bdot} /> In revision</span>
    case 'flagged':
      return <span className={`${styles.cardBadge} ${styles.badgeAction}`}><span className={styles.bdot} /> Action needed</span>
    case 'queued':
      return <span className={`${styles.cardBadge} ${styles.badgeQueued}`}><span className={styles.bdot} /> Queued</span>
    case 'drafting':
      return <span className={`${styles.cardBadge} ${styles.badgeWork} ${styles.badgeLive}`}><span className={styles.bdot} /> Drafting</span>
    case 'qa':
      return <span className={`${styles.cardBadge} ${styles.badgeWork} ${styles.badgeLive}`}><span className={styles.bdot} /> In QA</span>
    case 'failed':
      return <span className={`${styles.cardBadge} ${styles.badgeFail}`}><span className={styles.bdot} /> Needs another pass</span>
    case 'draft':
    default:
      return <span className={`${styles.cardBadge} ${styles.badgeDraft}`}><span className={styles.bdot} /> Draft</span>
  }
}

// ── Per-card body (the non-action middle of the card) ──────────────
function CardBody({
  state,
  reg,
  pages,
  audience,
  isRevisedDraft,
}: {
  state: CardState
  reg: string
  pages: number
  audience: string
  isRevisedDraft: boolean
}): ReactNode {
  const skeleton = (
    <div className={styles.docSkel}>
      <span />
      <span />
      <span />
    </div>
  )

  if (state === 'queued') {
    return (
      <>
        {skeleton}
        <div className={styles.queuedNote}>
          <Clock aria-hidden /> Waiting to start
        </div>
      </>
    )
  }
  if (state === 'drafting') {
    return (
      <>
        {skeleton}
        <div className={styles.workRow}>
          <Loader aria-hidden /> Drafting your document…
        </div>
      </>
    )
  }
  if (state === 'qa') {
    return (
      <>
        {skeleton}
        <div className={styles.workRow}>
          <Loader aria-hidden /> Checking quality…
        </div>
      </>
    )
  }
  if (state === 'failed') {
    return (
      <div className={styles.failMsg}>
        <RotateCcw aria-hidden />
        <span>This document needs another pass — we’re on it. No action needed from you.</span>
      </div>
    )
  }
  if (state === 'revision') {
    return (
      <div className={styles.revMsg}>
        <Loader width={16} height={16} strokeWidth={1.7} aria-hidden />
        <span>
          We&rsquo;re working on your changes — we&rsquo;ll email you when it&rsquo;s ready to
          approve.
        </span>
      </div>
    )
  }
  // draft, revised draft, flagged, final → the standard meta line.
  return (
    <>
      <div className={styles.docMeta}>
        <span className={styles.metaReg}>{reg}</span>
        <span className={styles.metaDot} />
        <span className={styles.metaPages}>
          {pages} pages · {audience}
        </span>
      </div>
      {isRevisedDraft ? (
        <p className={styles.revisedNote}>Updated version — ready to review again.</p>
      ) : null}
    </>
  )
}

function DownloadAllButton({
  documents,
  packReference,
  someInRevision,
  label,
}: {
  documents: ReadonlyArray<{ downloadUrl: string | null; fileUrl: string | null }>
  packReference: string
  someInRevision: boolean
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  const handleDownload = () => {
    setBusy(true)
    triggerBulkDownload(documents)
    setTimeout(() => setBusy(false), Math.max(800, documents.length * 450))
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm}`}
      onClick={handleDownload}
      aria-label={`Download all ${documents.length} final documents in ${packReference}`}
    >
      {busy ? (
        <>
          <Loader width={15} height={15} style={{ animation: 'spin 0.9s linear infinite' }} aria-hidden />{' '}
          Preparing…
        </>
      ) : (
        <>
          <Download width={15} height={15} strokeWidth={1.5} aria-hidden />{' '}
          {label ?? (someInRevision ? `Download ${documents.length} ready` : 'Download all')}
        </>
      )}
    </button>
  )
}
