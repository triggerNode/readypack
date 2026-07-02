'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader, Lock, Send, Sparkles } from 'lucide-react'
import {
  approvePackAction,
  escalateCaseAction,
  markFlagResolvedAction,
  overrideAndNoteAction,
  requestMoreInfoAction,
  resolveInfoRequestAction,
  regenerateRevisionAction,
  releaseRevisionAction,
  triggerGenerationAction,
  type ActionResult,
} from '../actions'
import detail from '../case-detail.module.css'
import flag from './flag-actions.module.css'

// Document cards an information request can be tied to (NULL = case-level).
// Mirrors the canonical pack order; lets the admin target a specific card.
const DOC_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Whole case (no specific document)' },
  { value: 'ai_use_statement', label: 'AI Use Statement' },
  { value: 'privacy_notice_addendum', label: 'Privacy Notice Addendum' },
  { value: 'ai_risk_register', label: 'AI Risk Register' },
  { value: 'dpia_lite', label: 'DPIA-Lite Assessment' },
  { value: 'internal_ai_use_policy', label: 'Internal AI Use Policy' },
  { value: 'customer_disclosure_snippets', label: 'Customer Disclosure Snippets' },
  { value: 'vendor_ai_register', label: 'Vendor AI Register' },
  { value: 'complaints_procedure_pack', label: 'Complaints Procedure Pack' },
  { value: 'procurement_response_memo', label: 'Procurement Response Memo' },
]

type BtnVariant = 'primary' | 'secondary' | 'escalate'

function btnClass(variant: BtnVariant): string {
  switch (variant) {
    case 'primary':
      return `${detail.btn} ${detail.btnPrimary}`
    case 'escalate':
      return `${detail.btn} ${detail.btnEscalate}`
    case 'secondary':
    default:
      return `${detail.btn} ${detail.btnSecondary}`
  }
}

function SubmitButton({
  children,
  variant,
  disabled,
  title,
}: {
  children: ReactNode
  variant: BtnVariant
  disabled?: boolean
  title?: string
}) {
  const { pending } = useFormStatus()
  const isDisabled = pending || disabled
  return (
    <button
      type="submit"
      disabled={isDisabled}
      title={title}
      className={btnClass(variant)}
    >
      {pending ? 'Working…' : children}
    </button>
  )
}

function FieldError({ result }: { result: ActionResult | null }) {
  if (!result) return null
  if (result.success) {
    return <p className={flag.doneLine}>Done.</p>
  }
  return (
    <p className={flag.errorLine} role="alert">
      {result.error}
    </p>
  )
}

const FORM_STACK: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: 6,
}

// ─────────────────────────────────────────
// Approve & Deliver — case header.
// Locked (disabled + lock icon) while QA is running or critical flags remain.
// The server action also enforces the critical-flag block. Approving only marks
// the pack approved — sending the delivery email is a separate step on Delivery.
// ─────────────────────────────────────────
export function ApprovePackButton({
  caseId,
  hasCriticalFlags,
  isQaRunning,
}: {
  caseId: string
  hasCriticalFlags: boolean
  isQaRunning: boolean
}) {
  const [result, formAction] = useFormState(approvePackAction, null)
  const lockReason = hasCriticalFlags
    ? 'Unresolved high-risk flags must be resolved or overridden first.'
    : isQaRunning
    ? 'QA is still running.'
    : undefined
  const locked = Boolean(lockReason)
  return (
    <form action={formAction} style={FORM_STACK}>
      <input type="hidden" name="caseId" value={caseId} />
      <button
        type="submit"
        disabled={locked}
        title={lockReason}
        className={`${detail.btn} ${detail.btnPrimary}${locked ? ` ${detail.btnLocked}` : ''}`}
      >
        {locked ? <Lock size={15} strokeWidth={1.5} /> : null}
        Approve &amp; Deliver
      </button>
      <FieldError result={result} />
    </form>
  )
}

// ─────────────────────────────────────────
// Release for customer review — case header primary action.
// Sends the customer the secure portal link to review their watermarked drafts
// (reusing the send-delivery route, which sets delivery_status='qa_review').
// The CUSTOMER's approval in the portal is what finalises the pack and removes
// the watermarks — the admin never pre-approves on the customer's behalf.
// ─────────────────────────────────────────
export function ReleaseForReviewButton({
  caseId,
  alreadyReleased,
}: {
  caseId: string
  alreadyReleased: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function release() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/send-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as { success?: true; error?: string }
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `Release failed (HTTP ${res.status})`)
      }
      setMessage('Sent. The customer can now review their pack via the secure link.')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to release')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={FORM_STACK}>
      <button
        type="button"
        onClick={release}
        disabled={busy}
        className={`${detail.btn} ${detail.btnPrimary}`}
      >
        {busy ? 'Sending…' : alreadyReleased ? 'Resend customer review link' : 'Release for customer review'}
      </button>
      {message ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--accent-primary)' }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)' }}>{error}</p>
      ) : null}
    </div>
  )
}

// Generate Pack — kicks off the document generation pipeline. Rendered in the
// case header for held cases (high/critical) that skip auto-generation, and for
// cases whose generation failed (0 documents). Low/medium cases auto-generate,
// so the button is hidden once documents exist (see CaseHeader documentCount).
export function GeneratePackButton({ caseId }: { caseId: string }) {
  const [result, formAction] = useFormState(triggerGenerationAction, null)
  return (
    <form action={formAction} style={FORM_STACK}>
      <input type="hidden" name="caseId" value={caseId} />
      <SubmitButton variant="primary">Generate Pack</SubmitButton>
      {result?.success ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--accent-primary)' }}>
          Generation started — this can take a few minutes. Refresh to see the documents appear.
        </p>
      ) : result && !result.success ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)' }} role="alert">
          {result.error}
        </p>
      ) : null}
    </form>
  )
}

// ─────────────────────────────────────────
// Request More Info — ghost button that expands an inline message form.
// ─────────────────────────────────────────
export function RequestMoreInfoForm({ caseId }: { caseId: string }) {
  const [result, formAction] = useFormState(requestMoreInfoAction, null)
  return (
    <details>
      <summary className={`${detail.btn} ${detail.btnSecondary} ${flag.summary}`}>
        Request More Info
      </summary>
      <form action={formAction} className={flag.disclosureForm}>
        <input type="hidden" name="caseId" value={caseId} />
        <label htmlFor={`rmi-doc-${caseId}`} className={flag.fieldLabel}>
          Which document does this relate to?
        </label>
        <select id={`rmi-doc-${caseId}`} name="documentType" className={flag.textarea} defaultValue="">
          {DOC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label htmlFor={`rmi-msg-${caseId}`} className={flag.fieldLabel}>
          What do you need from the customer?
        </label>
        <textarea
          id={`rmi-msg-${caseId}`}
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Ask one clear, plain-English question. The customer sees this on the card you choose above."
          className={flag.textarea}
        />
        <div className={flag.disclosureActions}>
          <SubmitButton variant="primary">Send request</SubmitButton>
        </div>
        <FieldError result={result} />
      </form>
    </details>
  )
}

// ─────────────────────────────────────────
// Escalate Case — amber ghost button with optional reason.
// ─────────────────────────────────────────
export function EscalateCaseForm({ caseId }: { caseId: string }) {
  const [result, formAction] = useFormState(escalateCaseAction, null)
  return (
    <details>
      <summary className={`${detail.btn} ${detail.btnEscalate} ${flag.summary}`}>
        Escalate Case
      </summary>
      <form action={formAction} className={flag.disclosureForm}>
        <input type="hidden" name="caseId" value={caseId} />
        <label htmlFor={`esc-${caseId}`} className={flag.fieldLabel}>
          Reason (optional)
        </label>
        <textarea
          id={`esc-${caseId}`}
          name="reason"
          maxLength={2000}
          rows={3}
          placeholder="Why is this case being escalated?"
          className={flag.textarea}
        />
        <div className={flag.disclosureActions}>
          <SubmitButton variant="escalate">Escalate</SubmitButton>
        </div>
        <FieldError result={result} />
      </form>
    </details>
  )
}

// ─────────────────────────────────────────
// Flag-level actions (Red Flags tab) — design `.sbtn` styling.
// ─────────────────────────────────────────
export function MarkFlagResolvedButton({
  caseId,
  flagId,
}: {
  caseId: string
  flagId: string
}) {
  const [result, formAction] = useFormState(markFlagResolvedAction, null)
  return (
    <form action={formAction} className={flag.sbtnStack}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="flagId" value={flagId} />
      <FlagSubmit variant="secondary">Mark Resolved</FlagSubmit>
      <FieldError result={result} />
    </form>
  )
}

export function RequestMoreInfoForFlagButton({ caseId }: { caseId: string }) {
  const [result, formAction] = useFormState(requestMoreInfoAction, null)
  return (
    <details>
      <summary className={`${flag.sbtn} ${flag.sbtnGreenOutline} ${flag.summary}`}>
        Request More Info
      </summary>
      <form action={formAction} className={flag.disclosureForm}>
        <input type="hidden" name="caseId" value={caseId} />
        <label htmlFor={`rmi-flag-${caseId}`} className={flag.fieldLabel}>
          What do you need from the customer?
        </label>
        <textarea
          id={`rmi-flag-${caseId}`}
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Describe the missing information clearly."
          className={flag.textarea}
        />
        <div className={flag.disclosureActions}>
          <FlagSubmit variant="green-outline">Send request</FlagSubmit>
        </div>
        <FieldError result={result} />
      </form>
    </details>
  )
}

export function OverrideAndNoteForm({
  caseId,
  flagId,
}: {
  caseId: string
  flagId?: string
}) {
  const [result, formAction] = useFormState(overrideAndNoteAction, null)
  return (
    <details>
      <summary className={`${flag.sbtn} ${flag.sbtnMuted} ${flag.summary}`}>
        Override &amp; Note
      </summary>
      <form action={formAction} className={flag.disclosureForm}>
        <input type="hidden" name="caseId" value={caseId} />
        {flagId ? <input type="hidden" name="flagId" value={flagId} /> : null}
        <label htmlFor={`ov-${flagId ?? caseId}`} className={flag.fieldLabel}>
          Justification (required for audit trail)
        </label>
        <textarea
          id={`ov-${flagId ?? caseId}`}
          name="note"
          required
          minLength={10}
          maxLength={4000}
          rows={4}
          placeholder="Explain why this is being overridden."
          className={flag.textarea}
        />
        <div className={flag.disclosureActions}>
          <FlagSubmit variant="green-outline">Record override</FlagSubmit>
        </div>
        <FieldError result={result} />
      </form>
    </details>
  )
}

// ─────────────────────────────────────────
// Resolve Information Request (ST2-4) — Info Requests tab.
// Marks an outstanding info_requests row resolved once the admin has acted on
// the customer's answer. Clears it from the portal + progress screen.
// ─────────────────────────────────────────
export function ResolveInfoRequestButton({
  caseId,
  infoRequestId,
}: {
  caseId: string
  infoRequestId: string
}) {
  const [result, formAction] = useFormState(resolveInfoRequestAction, null)
  return (
    <form action={formAction} className={flag.sbtnStack}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="infoRequestId" value={infoRequestId} />
      <FlagSubmit variant="green-outline">Mark Resolved</FlagSubmit>
      <FieldError result={result} />
    </form>
  )
}

// ─────────────────────────────────────────
// Revisions tab — STEP 1: Regenerate with AI.
// Runs the AI synchronously (~15–60s), so the submit shows a calm working
// state ("Applying the customer's changes with AI…") instead of looking frozen.
// On success the revision flips to in_review → the card shows "Revised draft ready".
// ─────────────────────────────────────────
export function RegenerateRevisionButton({
  caseId,
  revisionId,
}: {
  caseId: string
  revisionId: string
}) {
  const [result, formAction] = useFormState(regenerateRevisionAction, null)
  return (
    <form action={formAction} className={flag.sbtnStack}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <RegenerateSubmit />
      <FieldError result={result} />
    </form>
  )
}

function RegenerateSubmit() {
  const { pending } = useFormStatus()
  if (pending) {
    return (
      <span className={detail.revstepWorking}>
        <Loader size={15} aria-hidden />
        Applying the customer’s changes with AI… this can take up to a minute
      </span>
    )
  }
  return (
    <button type="submit" className={`${flag.sbtn} ${flag.sbtnPrimary}`}>
      <Sparkles size={14} aria-hidden />
      Regenerate with AI
    </button>
  )
}

// ─────────────────────────────────────────
// Revisions tab — STEP 2: Re-release & notify customer.
// Only rendered once Regenerate has run (revision in_review); the server action
// also enforces this guard. Emails the customer their revised document is ready.
// ─────────────────────────────────────────
export function ReleaseRevisionButton({
  caseId,
  revisionId,
}: {
  caseId: string
  revisionId: string
}) {
  const [result, formAction] = useFormState(releaseRevisionAction, null)
  return (
    <form action={formAction} className={flag.sbtnStack}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <ReleaseSubmit />
      <FieldError result={result} />
    </form>
  )
}

function ReleaseSubmit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${flag.sbtn} ${flag.sbtnPrimary}`}>
      <Send size={14} aria-hidden />
      {pending ? 'Sending…' : 'Re-release & notify customer'}
    </button>
  )
}

type FlagBtnVariant = 'green-outline' | 'secondary' | 'muted'

function flagBtnClass(variant: FlagBtnVariant): string {
  switch (variant) {
    case 'green-outline':
      return `${flag.sbtn} ${flag.sbtnGreenOutline}`
    case 'muted':
      return `${flag.sbtn} ${flag.sbtnMuted}`
    case 'secondary':
    default:
      return `${flag.sbtn} ${flag.sbtnSecondary}`
  }
}

function FlagSubmit({
  children,
  variant,
}: {
  children: ReactNode
  variant: FlagBtnVariant
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={flagBtnClass(variant)}>
      {pending ? 'Working…' : children}
    </button>
  )
}
