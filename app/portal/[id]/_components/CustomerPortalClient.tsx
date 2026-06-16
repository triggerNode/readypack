'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Check,
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
import type { DocumentType } from '@/types/database'
import { approvePackAction, submitRevisionAction } from '../actions'
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

interface Props {
  orderId: string
  customerName: string
  customerInitials: string
  packReference: string
  isApproved: boolean
  documents: PortalDocument[]
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
              {isApproved ? (
                <span className={`${styles.statusPill} ${styles.pillApproved}`}>
                  <span className={styles.dot} /> Pack finalised
                </span>
              ) : (
                <span className={`${styles.statusPill} ${styles.pillPending}`}>
                  <span className={styles.dot} /> Pending your approval
                </span>
              )}
            </div>

            {isApproved ? (
              <h1 className={styles.heroTitle}>
                <span className={styles.checkIco}>
                  <Check width={18} height={18} aria-hidden />
                </span>
                Your compliance pack is complete
              </h1>
            ) : (
              <h1 className={styles.heroTitle}>Your compliance pack is ready for review</h1>
            )}

            <p className={styles.heroSub}>
              {isApproved
                ? 'Your final, un-watermarked documents are now unlocked and ready to deploy in your business. Download individually or as a single ZIP archive.'
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

          {/* Doc grid */}
          <div className={styles.docGrid}>
            {documents.map((doc) => {
              const isSelected = selected.has(doc.documentType)
              return (
                <div
                  key={doc.documentType}
                  className={`${styles.docCard} ${isSelected ? styles.docCardSelected : ''}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a')) return
                    toggleSelect(doc.documentType)
                  }}
                  role={isApproved ? 'group' : 'button'}
                  aria-pressed={isApproved ? undefined : isSelected}
                  tabIndex={isApproved ? -1 : 0}
                  onKeyDown={(e) => {
                    if (isApproved) return
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      toggleSelect(doc.documentType)
                    }
                  }}
                >
                  <div className={styles.docWm} aria-hidden>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i}>DRAFT &nbsp; DRAFT &nbsp; DRAFT</span>
                    ))}
                  </div>

                  <div className={styles.docTop}>
                    <div className={styles.docTopLeft}>
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
                      <span className={styles.docIcon}>
                        <DocIcon name={doc.icon} />
                      </span>
                    </div>
                    <span
                      className={`${styles.cardBadge} ${
                        isApproved ? styles.badgeFinal : styles.badgeDraft
                      }`}
                    >
                      <span className={styles.bdot} />
                      {isApproved ? 'Final' : 'Draft'}
                    </span>
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

      {/* ── Sticky action bar (pending state only) ────────── */}
      {!isApproved ? (
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
