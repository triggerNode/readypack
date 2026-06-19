'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileClock,
  FileText,
  Loader,
  Lock,
  MessageSquare,
  MessageSquareText,
  PencilLine,
  Search,
  ScrollText,
  Shield,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DocumentType, InfoRequestStatus } from '@/types/database'
import { approvePackAction, submitInfoRequestAnswerAction, submitRevisionAction } from '../actions'
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
  deliveryStatus: 'pending' | 'approved' | 'delivered' | 'failed'
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

// Lucide icon registry — keeps the bundle tree-shakable while supporting
// the design's string-keyed icon name on each document.
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

export function CustomerPortalClient({
  orderId,
  customerName,
  customerInitials,
  packReference,
  isApproved: initialIsApproved,
  documents,
  infoRequests,
}: Props) {
  const router = useRouter()
  const [isApproved, setIsApproved] = useState(initialIsApproved)
  const [selected, setSelected] = useState<Set<DocumentType>>(new Set())
  const [revOpen, setRevOpen] = useState(false)
  const [revText, setRevText] = useState('')
  const [revError, setRevError] = useState<string | null>(null)
  const [revDone, setRevDone] = useState(false)
  const [overlayShow, setOverlayShow] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const revTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Remediation flow (ST2-4 info_requests) ───────────────────────
  const openRequests = infoRequests.filter((r) => r.status === 'open')
  const submittedRequests = infoRequests.filter((r) => r.status === 'submitted')
  // Items answered in this session (props won't refresh until router.refresh()).
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const remainingRequests = openRequests.filter((r) => !answeredIds.has(r.id))

  // Portal mode — these are mutually exclusive. Approve/revise is only offered in
  // 'pending'; while any info_request is open or awaiting admin review we keep the
  // customer in the remediation / "we're reviewing" flow instead.
  const portalMode: 'approved' | 'action' | 'submitted' | 'pending' = isApproved
    ? 'approved'
    : remainingRequests.length > 0
      ? 'action'
      : submittedRequests.length > 0 || answeredIds.size > 0
        ? 'submitted'
        : 'pending'

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

  // Reset selection when the pack flips into approved state.
  useEffect(() => {
    if (isApproved) {
      setSelected(new Set())
      setRevOpen(false)
    }
  }, [isApproved])

  // Focus the textarea when the revision panel opens.
  useEffect(() => {
    if (revOpen) {
      const t = setTimeout(() => revTextareaRef.current?.focus(), 280)
      return () => clearTimeout(t)
    }
  }, [revOpen])

  const selectedCount = selected.size

  const toggleSelect = (docType: DocumentType) => {
    if (isApproved) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(docType)) next.delete(docType)
      else next.add(docType)
      return next
    })
  }

  const deselectAll = () => {
    setSelected(new Set())
    setRevOpen(false)
  }

  const openRevision = (preselect?: DocumentType) => {
    if (preselect && !selected.has(preselect)) {
      setSelected((prev) => new Set(prev).add(preselect))
    }
    setRevDone(false)
    setRevError(null)
    setRevOpen(true)
  }

  const closeRevision = () => {
    setRevOpen(false)
    setRevError(null)
  }

  const submitRevision = () => {
    setRevError(null)
    const docTypes = Array.from(selected)
    if (docTypes.length === 0) {
      setRevError('Select at least one document to request changes.')
      return
    }
    const trimmed = revText.trim()
    if (trimmed.length < 10) {
      setRevError('Please describe what needs changing (at least 10 characters).')
      return
    }

    startTransition(async () => {
      const result = await submitRevisionAction({
        orderId,
        documentTypes: docTypes,
        feedbackText: trimmed,
      })
      if (!result.success) {
        setRevError(result.error)
        return
      }
      setRevDone(true)
      setRevText('')
      setSelected(new Set())
      // Refresh server data, then auto-collapse the panel after a beat.
      router.refresh()
      setTimeout(() => {
        setRevDone(false)
        setRevOpen(false)
      }, 4800)
    })
  }

  const runFinalise = () => {
    setErrorBanner(null)
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const finish = async () => {
      const result = await approvePackAction({ orderId })
      if (!result.success) {
        setOverlayShow(false)
        setActiveStep(-1)
        setErrorBanner(result.error)
        return
      }
      setIsApproved(true)
      router.refresh()
      setTimeout(() => setOverlayShow(false), 400)
    }

    closeRevision()
    if (prefersReduced) {
      void finish()
      return
    }

    setOverlayShow(true)
    setActiveStep(-1)
    // Walk through the visual steps while the server action runs in parallel.
    const tickAt = [260, 780, 1300]
    tickAt.forEach((ms, i) => {
      setTimeout(() => setActiveStep(i), ms)
    })
    startTransition(() => {
      void finish()
    })
  }

  // ── Remediation flow handlers ────────────────────────────────────
  const startFlow = (startId?: string | null) => {
    const start =
      startId && !answeredIds.has(startId)
        ? startId
        : (remainingRequests[0]?.id ?? null)
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
        // All items answered — show the distinct "we're reviewing" confirmation
        // (never drop back to approve/revise), then refresh server state.
        setFlowOpen(false)
        setDoneOpen(true)
        router.refresh()
      }
    })
  }

  const totalFlowItems = openRequests.length
  const answeredCount = answeredIds.size
  const remainingCount = remainingRequests.length

  const shellClass = `${styles.shell} ${isApproved ? styles.approved : ''}`

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
        <div className={`${styles.glow} ${isApproved ? styles.glowOn : ''}`} aria-hidden />

        <div className={styles.container}>
          {/* Hero */}
          <section className={styles.hero}>
            <div className={styles.heroBadgeRow}>
              {portalMode === 'approved' ? (
                <span className={`${styles.statusPill} ${styles.pillApproved}`}>
                  <span className={styles.dot} /> Pack finalised
                </span>
              ) : portalMode === 'action' ? (
                <span className={`${styles.statusPill} ${styles.pillAction}`}>
                  <span className={styles.dot} /> Action needed
                </span>
              ) : portalMode === 'submitted' ? (
                <span className={`${styles.statusPill} ${styles.pillReview}`}>
                  <span className={styles.dot} /> In review
                </span>
              ) : (
                <span className={`${styles.statusPill} ${styles.pillPending}`}>
                  <span className={styles.dot} /> Pending your approval
                </span>
              )}
            </div>

            {portalMode === 'approved' ? (
              <h1 className={styles.heroTitle}>
                <span className={styles.checkIco}>
                  <Check width={18} height={18} aria-hidden />
                </span>
                Your compliance pack is complete
              </h1>
            ) : portalMode === 'action' ? (
              <h1 className={styles.heroTitle}>We need a little more information</h1>
            ) : portalMode === 'submitted' ? (
              <h1 className={styles.heroTitle}>Thanks — your answers are in</h1>
            ) : (
              <h1 className={styles.heroTitle}>Your compliance pack is ready for review</h1>
            )}

            <p className={styles.heroSub}>
              {portalMode === 'approved'
                ? 'Your final, un-watermarked documents are now unlocked and ready to deploy in your business. Download individually or as a single ZIP archive.'
                : portalMode === 'action'
                  ? 'Our compliance team has a few quick questions about your answers. The cards below show what needs your input — answer them and we’ll pick your pack straight back up.'
                  : portalMode === 'submitted'
                    ? 'Our compliance team is reviewing your responses and will update your pack. We’ll email you when it’s ready — there’s nothing else you need to do right now.'
                    : 'Please review your draft documents below. Once you approve the pack, the watermarks will be removed and your final PDFs will be unlocked for download.'}
            </p>
          </section>

          {/* List head */}
          <div className={styles.listHead}>
            <div className={styles.listHeadLeft}>
              <span className={styles.listHeadTitle}>
                {isApproved ? 'Final documents' : 'Draft documents'}
              </span>
              <span className={styles.listHeadCount}>
                {documents.length} of {documents.length} · Pack {packReference}
              </span>
            </div>
            {isApproved ? (
              <DownloadAllButton documents={documents} packReference={packReference} />
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
              const isSelected = selected.has(doc.documentType)
              const isRemediation = portalMode === 'action' || portalMode === 'submitted'
              const flaggedReqId =
                portalMode === 'action' ? flaggedDocTypes.get(doc.documentType) : undefined
              const isFlagged = Boolean(flaggedReqId)
              const selectable = !isApproved && !isRemediation
              const cardClass = [
                styles.docCard,
                isSelected ? styles.docCardSelected : '',
                isFlagged ? styles.docCardFlagged : '',
              ]
                .filter(Boolean)
                .join(' ')
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
                  <div className={styles.docWm} aria-hidden>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i}>DRAFT &nbsp; DRAFT &nbsp; DRAFT</span>
                    ))}
                  </div>

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
                      <span className={styles.docIcon}>
                        <DocIcon name={doc.icon} />
                      </span>
                    </div>
                    {isFlagged ? (
                      <span className={`${styles.cardBadge} ${styles.badgeAction}`}>
                        <span className={styles.bdot} />
                        Action needed
                      </span>
                    ) : (
                      <span
                        className={`${styles.cardBadge} ${
                          isApproved ? styles.badgeFinal : styles.badgeDraft
                        }`}
                      >
                        <span className={styles.bdot} />
                        {isApproved ? 'Final' : 'Draft'}
                      </span>
                    )}
                  </div>

                  <div className={styles.docRef}>{doc.ref}</div>
                  <h3 className={styles.docTitle}>{doc.title}</h3>
                  <div className={styles.docMeta}>
                    <span className={styles.metaReg}>{doc.reg}</span>
                    <span className={styles.metaDot} />
                    <span className={styles.metaPages}>
                      {doc.pages} pages · {doc.audience}
                    </span>
                  </div>

                  <div className={styles.docAction}>
                    {isApproved ? (
                      <a
                        className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm} ${styles.actionDownload}`}
                        href={doc.fileUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!doc.fileUrl) e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                        <Download width={15} height={15} strokeWidth={1.5} aria-hidden /> Download
                        PDF
                      </a>
                    ) : isRemediation ? (
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
                          <Check width={14} height={14} strokeWidth={2} aria-hidden />
                          {portalMode === 'submitted' ? 'Answer received' : 'No action needed'}
                        </span>
                      )
                    ) : (
                      <div className={styles.docActionRow}>
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
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openRevision(doc.documentType)
                          }}
                        >
                          <PencilLine width={15} height={15} strokeWidth={1.5} aria-hidden /> Revise
                        </button>
                      </div>
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

      {/* ── Sticky action bar (pending state only) ────────── */}
      {portalMode === 'pending' ? (
        <div className={styles.actionBar}>
          <div className={styles.container}>
            <div className={styles.actionBarInner}>
              <div className={styles.abInfo}>
                <span
                  className={`${styles.abShield} ${selectedCount > 0 ? styles.abShieldSel : ''}`}
                  aria-hidden
                >
                  {selectedCount > 0 ? selectedCount : <FileClock width={22} height={22} strokeWidth={1.5} />}
                </span>
                <div className={styles.abText}>
                  <span className={styles.abTitle}>
                    {selectedCount > 0
                      ? `${selectedCount} document${selectedCount === 1 ? '' : 's'} selected`
                      : `${documents.length} documents awaiting your approval`}
                  </span>
                  <span className={styles.abSub}>
                    {selectedCount > 0
                      ? `Request changes to the selected document${selectedCount === 1 ? '' : 's'} — your pack stays in review until they're resolved.`
                      : 'Select any document to request changes, or approve the full pack to finalise.'}
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
                      Deselect all
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                      onClick={() => (revOpen ? closeRevision() : openRevision())}
                      disabled={pending}
                    >
                      <MessageSquareText width={18} height={18} strokeWidth={1.5} aria-hidden />
                      Request revision ({selectedCount})
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
                      onClick={runFinalise}
                      disabled={pending}
                    >
                      <ShieldCheck width={16} height={16} strokeWidth={1.5} aria-hidden /> Approve
                      all {documents.length}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                    onClick={runFinalise}
                    disabled={pending}
                  >
                    <ShieldCheck width={18} height={18} strokeWidth={1.5} aria-hidden />
                    Approve all {documents.length} documents
                  </button>
                )}
              </div>
            </div>

            {/* Revision panel */}
            <div
              className={`${styles.revisionPanel} ${
                revOpen ? styles.revisionPanelOpen : ''
              }`}
            >
              <div className={styles.revisionInner}>
                {revDone ? (
                  <div className={styles.revDone}>
                    <span className={styles.rdIco}>
                      <Check width={20} height={20} strokeWidth={2} aria-hidden />
                    </span>
                    <span className={styles.rdText}>
                      <b>Feedback received.</b> Your reviewer has been notified and will return
                      revised drafts shortly. Your pack stays in review until then.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className={styles.revHead}>
                      <span className={styles.revTitle}>
                        <MessageSquareText width={17} height={17} strokeWidth={1.5} aria-hidden />
                        Request a revision
                      </span>
                      <button
                        type="button"
                        className={styles.revClose}
                        aria-label="Close revision form"
                        onClick={closeRevision}
                      >
                        <X width={18} height={18} strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>

                    <div className={styles.revScope}>
                      <span className={styles.revScopeLabel}>For</span>
                      <div className={styles.revChips}>
                        {Array.from(selected).map((docType) => {
                          const doc = documents.find((d) => d.documentType === docType)
                          if (!doc) return null
                          return (
                            <span key={docType} className={styles.revChip}>
                              {doc.title}
                              <button
                                type="button"
                                className={styles.revChipX}
                                aria-label={`Remove ${doc.title}`}
                                onClick={() => toggleSelect(docType)}
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <textarea
                      ref={revTextareaRef}
                      className={styles.revTextarea}
                      placeholder="Please describe what needs changing — for example, a correction to your registered company name, a document that needs different scope, or wording you'd like adjusted."
                      value={revText}
                      onChange={(e) => setRevText(e.target.value)}
                      maxLength={4000}
                    />

                    {revError ? (
                      <p className={styles.revError} role="alert">
                        {revError}
                      </p>
                    ) : null}

                    <div className={styles.revFoot}>
                      <span className={styles.revHint}>
                        Your reviewer receives this directly. Revised drafts are typically returned
                        within one business day, and your pack stays in review until then.
                      </span>
                      <div className={styles.revFootActions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnMd}`}
                          onClick={closeRevision}
                          disabled={pending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnMd}`}
                          onClick={submitRevision}
                          disabled={pending}
                        >
                          {pending ? (
                            <>
                              <Loader width={16} height={16} style={{ animation: 'spin 0.9s linear infinite' }} aria-hidden /> Sending…
                            </>
                          ) : (
                            'Submit feedback'
                          )}
                        </button>
                      </div>
                    </div>
                  </>
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
          <h2 className={styles.ovTitle}>Finalising your pack</h2>
          <p className={styles.ovSub}>Confirming your approval and preparing your final documents.</p>
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
              <button
                type="button"
                className={styles.reqClose}
                aria-label="Close"
                onClick={closeFlow}
              >
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
                Your answer goes straight to your reviewer. Your pack stays in review until every
                item is resolved.
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
            Our compliance team is reviewing your responses. We’ll update your pack and email you
            when it’s ready. There’s nothing else you need to do right now.
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
}: {
  documents: PortalDocument[]
  packReference: string
}) {
  const [busy, setBusy] = useState(false)

  const handleDownload = () => {
    setBusy(true)
    // Sequential window.open for each document URL — keeps things working
    // without a zip server. Future enhancement: bundle on the server.
    documents.forEach((doc, i) => {
      if (!doc.fileUrl) return
      setTimeout(() => {
        window.open(doc.fileUrl as string, '_blank', 'noopener,noreferrer')
      }, i * 150)
    })
    setTimeout(() => setBusy(false), Math.max(800, documents.length * 200))
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnSurface} ${styles.btnSm}`}
      onClick={handleDownload}
      aria-label={`Download all ${documents.length} documents in ${packReference}`}
    >
      {busy ? (
        <>
          <Loader width={15} height={15} style={{ animation: 'spin 0.9s linear infinite' }} aria-hidden /> Opening…
        </>
      ) : (
        <>
          <Download width={15} height={15} strokeWidth={1.5} aria-hidden /> Download all ({documents.length})
        </>
      )}
    </button>
  )
}
