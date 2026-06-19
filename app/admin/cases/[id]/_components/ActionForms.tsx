'use client'

import { useFormState, useFormStatus } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { Lock } from 'lucide-react'
import {
  approvePackAction,
  escalateCaseAction,
  markFlagResolvedAction,
  overrideAndNoteAction,
  requestMoreInfoAction,
  resolveInfoRequestAction,
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

// Generate Pack — kicks off the document generation pipeline. Retained for
// callers that need it; not rendered in the design's header button row.
export function GeneratePackButton({ caseId }: { caseId: string }) {
  const [result, formAction] = useFormState(triggerGenerationAction, null)
  return (
    <form action={formAction} style={FORM_STACK}>
      <input type="hidden" name="caseId" value={caseId} />
      <SubmitButton variant="primary">Generate Pack</SubmitButton>
      <FieldError result={result} />
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
