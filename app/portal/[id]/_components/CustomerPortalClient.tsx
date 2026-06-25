'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Dispatch, SetStateAction } from 'react'
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
import type { DocumentType, InfoRequestStatus } from '@/types/database'
import {
  approveDocumentAction,
  approvePackAction,
  submitInfoRequestAnswerAction,
  submitRevisionAction,
} from '../actions'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import styles from './portal.module.css'

export interface PortalDocument {
  id: string
  documentType: DocumentType
  ref: string
  title: string
  icon: string
  reg: string
  pages: number
  audience: string
  fileUrl: string | null
  /** Download-disposition URL (forces a real file save), vs fileUrl for inline preview. */
  downloadUrl: string | null
  deliveryStatus: 'pending' | 'approved' | 'in_revision' | 'delivered' | 'failed'
  /** True once this document has been revised + re-released (a fresh draft to re-review). */
  isRevised: boolean
}

export interface PortalInfoRequest {
  id: string
  /** NULL = case-level (top-level banner); otherwise tied to one document card. */
  documentType: DocumentType | null
  prompt: string
  options: string[]
  status: InfoRequestStatus
}

interface Props {
  orderId: string
  customerName: string
  customerInitials: string
  packReference: string
  isApproved: boolean
  documents: PortalDocument[]
  infoRequests: PortalInfoRequest[]
}

// Per-document UI status: draft (awaiting review) · revised (re-released draft) ·
// revision (with our team) · final (approved, downloadable).
type DocStatus = 'draft' | 'revised' | 'revision' | 'final'

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

function serverStatus(doc: PortalDocument): DocStatus {
  if (doc.deliveryStatus === 'delivered') return 'final'
  if (doc.deliveryStatus === 'in_revision') return 'revision'
  return doc.isRevised ? 'revised' : 'draft'
}

export function CustomerPortalClient({
  orderId,
  customerName,
  customerInitials,
  packReference,
  documents,
  infoRequests,
}: Props) {
  const router = useRouter()
  // Read prefers-reduced-motion after mount so SSR and first client render agree
  // (false on both → no hydration mismatch), then track live changes.
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mql.matches)
    const onChange = () => setPrefersReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // ── Per-document status, with optimistic overrides cleared on fresh data ──
  const [overrides, setOverrides] = useState<Map<DocumentType, DocStatus>>(new Map())
  // When the server sends fresh documents (after router.refresh), drop overrides.
  useEffect(() => {
    setOverrides(new Map())
  }, [documents])

  const statusOf = (doc: PortalDocument): DocStatus =>
    overrides.get(doc.documentType) ?? serverStatus(doc)

  const setOverride = (docTypes: DocumentType[], status: DocStatus) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      docTypes.forEach((t) => next.set(t, status))
      return next
    })
  }

  // ── Selection (draft/revised cards only) ─────────────────────────
  const [selected, setSelected] = useState<Set<DocumentType>>(new Set())

  // ── Request-changes overlay ──────────────────────────────────────
  const [reqOpen, setReqOpen] = useState(false)
  const [reqTargets, setReqTargets] = useState<DocumentType[]>([])
  const [reqText, setReqText] = useState('')
  const [reqError, setReqError] = useState<string | null>(null)
  const reqTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Finalising overlay (whole-pack / approve-remaining) ──────────
  const [overlayShow, setOverlayShow] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  // Per-document finalising micro-moment: cards mid-finalise show the in-card
  // "Finalising your document" layer; once Final they briefly show a download nudge.
  const [finalising, setFinalising] = useState<Set<DocumentType>>(new Set())
  const [justFinal, setJustFinal] = useState<Set<DocumentType>>(new Set())
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // ── Remediation flow (ST2-4 info_requests) — unchanged ───────────
  const openRequests = useMemo(() => infoRequests.filter((r) => r.status === 'open'), [infoRequests])
  const submittedRequests = infoRequests.filter((r) => r.status === 'submitted')
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const remainingRequests = openRequests.filter((r) => !answeredIds.has(r.id))

  // Remediation overrides the review experience: while our team has questions
  // outstanding, we don't let the customer approve/revise.
  const portalMode: 'action' | 'submitted' | 'review' =
    remainingRequests.length > 0
      ? 'action'
      : submittedRequests.length > 0 || answeredIds.size > 0
        ? 'submitted'
        : 'review'
  const reviewActive = portalMode === 'review'

  // ── Per-document counts (drive summary chip + hero + bar) ────────
  const statuses = documents.map(statusOf)
  const finalCount = statuses.filter((s) => s === 'final').length
  const revisionCount = statuses.filter((s) => s === 'revision').length
  const awaitingTypes = documents
    .filter((d) => {
      const s = statusOf(d)
      return s === 'draft' || s === 'revised'
    })
    .map((d) => d.documentType)
  const awaitingCount = awaitingTypes.length
  const total = documents.length
  const allFinal = total > 0 && finalCount === total
  const finalDocs = documents.filter((d) => statusOf(d) === 'final')

  // "You're all set for now" closure: the customer has nothing left to act on —
  // every document is Final or In-revision, none awaiting review, no open
  // info-requests — but the pack isn't complete because something's being revised.
  const showAllSet =
    reviewActive && !allFinal && awaitingCount === 0 && revisionCount > 0

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
  // The in-card "Finalising your document — removing the draft watermark" layer
  // shows while the server re-renders the un-watermarked PDF (real work), then
  // resolves to Final with a one-off download nudge. Reduced motion → instant swap.
  // Note: the finalising card state is driven by the `finalising` Set, NOT the
  // transition's `pending` (which clears when the action resolves, before the
  // min-beat setTimeout fires).
  const resolveFinal = (docType: DocumentType) => {
    setOverride([docType], 'final')
    // One-off download nudge that self-expires (it must not persist for the
    // session — the old justApproved flash auto-cleared the same way).
    addTo(setJustFinal, docType)
    setTimeout(() => removeFrom(setJustFinal, docType), 6000)
    router.refresh()
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

    // Show the finalising layer for the duration of the real server work, with a
    // minimum premium beat so it never just flickers.
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
        setOverrides(new Map())
        setErrorBanner(result.error)
        return
      }
      setOverride(awaitingTypes, 'final')
      router.refresh()
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
      setOverride(targets, 'revision')
      setSelected(new Set())
      setReqOpen(false)
      router.refresh()
    })
  }

  // ── Remediation flow handlers (unchanged) ────────────────────────
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
        router.refresh()
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
          {/* Hero */}
          <section className={styles.hero}>
            <div className={styles.heroBadgeRow}>
              {portalMode === 'action' ? (
                <span className={`${styles.statusPill} ${styles.pillAction}`}>
                  <span className={styles.dot} /> Action needed
                </span>
              ) : portalMode === 'submitted' ? (
                <span className={`${styles.statusPill} ${styles.pillReview}`}>
                  <span className={styles.dot} /> In review
                </span>
              ) : allFinal ? (
                <span className={`${styles.statusPill} ${styles.pillApproved}`}>
                  <span className={styles.dot} /> Pack complete
                </span>
              ) : finalCount > 0 || revisionCount > 0 ? (
                <span className={`${styles.statusPill} ${styles.pillApproved}`}>
                  <span className={styles.dot} /> In progress
                </span>
              ) : (
                <span className={`${styles.statusPill} ${styles.pillPending}`}>
                  <span className={styles.dot} /> Pending your approval
                </span>
              )}
            </div>

            {portalMode === 'action' ? (
              <h1 className={styles.heroTitle}>We need a little more information</h1>
            ) : portalMode === 'submitted' ? (
              <h1 className={styles.heroTitle}>Thanks — your answers are in</h1>
            ) : allFinal ? (
              <h1 className={styles.heroTitle}>
                <span className={styles.checkIco}>
                  <Check width={18} height={18} aria-hidden />
                </span>
                Your compliance pack is complete
              </h1>
            ) : finalCount > 0 || revisionCount > 0 ? (
              <h1 className={styles.heroTitle}>Approve what&rsquo;s ready — we&rsquo;ll keep working on the rest</h1>
            ) : (
              <h1 className={styles.heroTitle}>Your compliance pack is ready for review</h1>
            )}

            <p className={styles.heroSub}>
              {portalMode === 'action'
                ? 'Our compliance team has a few quick questions about your answers. The cards below show what needs your input — answer them and we’ll pick your pack straight back up.'
                : portalMode === 'submitted'
                  ? 'Our compliance team is reviewing your responses and will update your pack. We’ll email you when it’s ready — there’s nothing else you need to do right now.'
                  : allFinal
                    ? 'Every document is approved and un-watermarked. Download them individually below, or all at once.'
                    : finalCount > 0 || revisionCount > 0
                      ? 'Approved documents are unlocked for download right away. Anything you’ve sent back for changes is with our team — we’ll email you when it’s ready to approve.'
                      : 'Review each draft below. Approve the documents you’re happy with to download them straight away, or request changes on any that aren’t right yet — just those go back to our team.'}
            </p>
          </section>

          {/* "You're all set for now" closure panel */}
          {showAllSet ? (
            <section className={styles.allset} aria-live="polite">
              <div className={styles.allsetInner}>
                <div className={styles.allsetGlow} aria-hidden />
                <span className={styles.allsetIco}>
                  <CheckCheck width={26} height={26} strokeWidth={1.8} aria-hidden />
                </span>
                <h2 className={styles.allsetTitle}>You&rsquo;re all set for now</h2>
                <p className={styles.allsetBody}>
                  We&rsquo;re preparing the {revisionCount === 1 ? 'change' : 'changes'} you asked for
                  on {revisionCount} {revisionCount === 1 ? 'document' : 'documents'}. We&rsquo;ll
                  email you the moment {revisionCount === 1 ? 'it&rsquo;s' : 'they&rsquo;re'} ready to
                  approve — there&rsquo;s nothing else you need to do right now.
                </p>
                <p className={styles.allsetQuiet}>
                  <Lock width={13} height={13} aria-hidden /> You can safely close this page
                </p>
                <div className={styles.allsetActions}>
                  <Link
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
                    href={`/status/${orderId}`}
                  >
                    <Activity width={16} height={16} strokeWidth={1.5} aria-hidden /> View pack
                    progress →
                  </Link>
                  {finalCount > 0 ? (
                    <DownloadAllButton
                      documents={finalDocs}
                      packReference={packReference}
                      someInRevision={revisionCount > 0}
                      label="Download your approved documents"
                    />
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

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
                  {total} of {total} · Pack {packReference}
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
          <div className={styles.docGrid}>
            {documents.map((doc) => {
              const st = statusOf(doc)
              const isRemediation = portalMode === 'action' || portalMode === 'submitted'
              const flaggedReqId =
                portalMode === 'action' ? flaggedDocTypes.get(doc.documentType) : undefined
              const isFlagged = Boolean(flaggedReqId)
              // Selectable only in review mode on a draft/revised card.
              const selectable = reviewActive && (st === 'draft' || st === 'revised')
              const isSelected = selected.has(doc.documentType)
              const isFinalising = finalising.has(doc.documentType)
              const isJustFinal = justFinal.has(doc.documentType)
              const cardClass = [
                styles.docCard,
                st === 'final' ? styles.docCardFinal : '',
                st === 'revision' ? styles.docCardRevision : '',
                isSelected ? styles.docCardSelected : '',
                isFlagged ? styles.docCardFlagged : '',
                isFinalising ? styles.docCardFinalising : '',
                isJustFinal ? styles.justFinal : '',
              ]
                .filter(Boolean)
                .join(' ')
              const showWatermark = st === 'draft' || st === 'revised'
              return (
                <div
                  key={doc.documentType}
                  className={cardClass}
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
                      {st === 'revised' ? (
                        <span className={styles.revisedTag}>
                          <RotateCcw width={11} height={11} strokeWidth={2.2} aria-hidden /> Revised
                        </span>
                      ) : null}
                      {isFlagged ? (
                        <span className={`${styles.cardBadge} ${styles.badgeAction}`}>
                          <span className={styles.bdot} /> Action needed
                        </span>
                      ) : st === 'final' ? (
                        <span className={`${styles.cardBadge} ${styles.badgeFinal}`}>
                          <span className={styles.bdot} /> Final
                        </span>
                      ) : st === 'revision' ? (
                        <span className={`${styles.cardBadge} ${styles.badgeRev}`}>
                          <span className={styles.bdot} /> In revision
                        </span>
                      ) : (
                        <span className={`${styles.cardBadge} ${styles.badgeDraft}`}>
                          <span className={styles.bdot} /> Draft
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.docRef}>{doc.ref}</div>
                  <h3 className={styles.docTitle}>{doc.title}</h3>

                  {st === 'revision' ? (
                    <div className={styles.revMsg}>
                      <Loader width={16} height={16} strokeWidth={1.7} aria-hidden />
                      <span>
                        We&rsquo;re working on your changes — we&rsquo;ll email you when it&rsquo;s
                        ready to approve.
                      </span>
                    </div>
                  ) : (
                    <div className={styles.docMeta}>
                      <span className={styles.metaReg}>{doc.reg}</span>
                      <span className={styles.metaDot} />
                      <span className={styles.metaPages}>
                        {doc.pages} pages · {doc.audience}
                      </span>
                    </div>
                  )}
                  {st === 'revised' ? (
                    <p className={styles.revisedNote}>Updated version — ready to review again.</p>
                  ) : null}

                  <div className={styles.docAction}>
                    {/* Final → download */}
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
                    ) : isRemediation ? (
                      // Draft/revised while remediation is outstanding: flagged → answer,
                      // else a calm muted note (no approve/revise until questions are resolved).
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
                    ) : (
                      // Review mode draft/revised: per-card approve + request changes + preview
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
                    )}
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
                <Link
                  className={`${styles.btn} ${styles.btnSurface} ${styles.btnMd}`}
                  href={`/status/${orderId}`}
                >
                  <Activity width={16} height={16} strokeWidth={1.5} aria-hidden /> View pack progress
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Sticky action bar — review: approve / request changes ──
          Only when there are documents left to act on (drafts/revised). When
          everything is Final or In-revision there's nothing to approve, so the
          bar is hidden rather than showing a disabled "Approve remaining 0". */}
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
                {documents.find((d) => d.documentType === reqTargets[0])?.title ?? 'Document'}
                <span className={styles.reqRelatesRef}>
                  · {documents.find((d) => d.documentType === reqTargets[0])?.ref ?? ''}
                </span>
              </span>
            ) : reqTargets.length > 1 ? (
              <div className={styles.reqChips}>
                {reqTargets.map((t) => (
                  <span key={t} className={styles.reqMchip}>
                    {documents.find((d) => d.documentType === t)?.title ?? t}
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
                    {documents.find((d) => d.documentType === currentRequest.documentType)?.title ??
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
            <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`} href={`/status/${orderId}`}>
              <Activity width={17} height={17} strokeWidth={1.5} aria-hidden /> View pack progress
            </Link>
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

function DownloadAllButton({
  documents,
  packReference,
  someInRevision,
  label,
}: {
  documents: PortalDocument[]
  packReference: string
  someInRevision: boolean
  /** Overrides the default "Download all" / "Download N ready" label. */
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  const handleDownload = () => {
    setBusy(true)
    documents.forEach((doc, i) => {
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
