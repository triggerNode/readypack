'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './detail-tabs.module.css'

type DeliveryStatus =
  | 'pending'
  | 'generating'
  | 'qa_review'
  | 'escalated'
  | 'approved'
  | 'delivered'
  | 'failed'

type Props = {
  caseId: string
  deliveryStatus: DeliveryStatus
  deliveredAt: string | null
}

function statusLabel(status: DeliveryStatus): { label: string; toneClass: string } {
  switch (status) {
    case 'delivered':
      return { label: 'Delivered', toneClass: styles.delStatusGreen }
    case 'approved':
      return { label: 'Approved — Ready to deliver', toneClass: styles.delStatusGreen }
    case 'qa_review':
      return { label: 'Pending Customer Approval', toneClass: styles.delStatusAmber }
    case 'escalated':
      return { label: 'Escalated', toneClass: styles.delStatusAmber }
    case 'failed':
      return { label: 'Delivery Failed', toneClass: styles.delStatusRed }
    case 'generating':
      return { label: 'Generating', toneClass: styles.delStatusGrey }
    case 'pending':
    default:
      return { label: 'Pending', toneClass: styles.delStatusGrey }
  }
}

export function DeliveryTab({ caseId, deliveryStatus, deliveredAt }: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const status = statusLabel(deliveryStatus)
  const deliveredAtFmt = deliveredAt ? new Date(deliveredAt).toLocaleString('en-GB') : null
  const isApproved = deliveryStatus === 'approved' || deliveryStatus === 'delivered'

  async function sendDelivery() {
    setSending(true)
    setSuccess(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/send-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as
        | { success: true; pack_reference: string }
        | { error?: string }

      if (!res.ok || !('success' in body)) {
        const message =
          'error' in body && body.error
            ? body.error
            : `Delivery email failed (HTTP ${res.status})`
        throw new Error(message)
      }

      setSuccess(
        `Delivery email sent. Pack reference ${body.pack_reference}. Customer can now review their pack via the secure portal link.`,
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to trigger delivery')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadLeft}>
          <h2>Delivery</h2>
          <span className={styles.panelSub}>Send the pack and manage customer revisions</span>
        </div>
      </div>

      <div className={styles.delStack}>
        <div className={styles.delCard}>
          <div className={styles.delCardTop}>
            <div>
              <div className={styles.delCardTitle}>Customer Delivery Workflow</div>
              <p className={styles.delCardBody}>
                Send the secure magic-link to the customer so they can review their watermarked
                drafts. Once they approve, watermarks are removed and the final PDFs are unlocked
                for download.
              </p>
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={sendDelivery}
              disabled={sending || !isApproved}
              title={isApproved ? undefined : 'Approve the pack before sending the delivery email.'}
            >
              <SendIcon />
              {sending ? 'Sending…' : 'Send Delivery Email'}
            </button>
          </div>

          {!isApproved ? (
            <p className={styles.delCardBody} style={{ marginTop: 12 }}>
              Approve the pack before sending the delivery email.
            </p>
          ) : null}
          {error ? <p className={styles.errorLine}>Error: {error}</p> : null}
          {success ? <p className={styles.successLine}>{success}</p> : null}

          <div className={styles.delStatusRow}>
            <span className={styles.delStatusLabel}>Current status:</span>
            <span className={`${styles.delStatus} ${status.toneClass}`}>
              <span className={styles.delStatusDot} />
              {status.label}
            </span>
            {deliveredAtFmt ? (
              <span className={styles.delStatusMeta}>Last update: {deliveredAtFmt}</span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
