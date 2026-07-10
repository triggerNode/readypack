'use client'

// Stage 3d — "Query the customer" on a query-path flag. Clicking drafts an AI
// question for the flag; the admin reviews/edits it, then sends. When the customer
// answers, the answer folds back into the affected document (foldInAnswer). Reuses
// the sign-off form's styles.

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { MessagesSquare, Send, Sparkles } from 'lucide-react'
import { draftFlagQuestionAction, sendFlagQueryAction, type ActionResult } from '../flag-actions'
import styles from './signoff.module.css'

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${styles.sbtn} ${styles.sbtnPrimary}`}>
      <Send size={14} aria-hidden />
      {pending ? 'Sending…' : 'Send to customer'}
    </button>
  )
}

export function QueryFlagForm({ caseId, flagId }: { caseId: string; flagId: string }) {
  const [result, formAction] = useFormState(sendFlagQueryAction, null as ActionResult | null)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [drafting, startDraft] = useTransition()
  const [draftErr, setDraftErr] = useState<string | null>(null)

  function begin() {
    setOpen(true)
    setDraftErr(null)
    startDraft(async () => {
      const r = await draftFlagQuestionAction(caseId, flagId)
      if (r.success) setQuestion(r.question)
      else setDraftErr(r.error)
    })
  }

  if (result?.success) {
    return (
      <p className={styles.q} style={{ color: 'var(--text-accent)', marginTop: 12 }}>
        Query sent — the customer’s answer will fold into their pack automatically.
      </p>
    )
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button type="button" className={`${styles.sbtn} ${styles.sbtnSecondary}`} onClick={begin}>
          <MessagesSquare size={14} aria-hidden /> Query the customer
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="flagId" value={flagId} />
      <p className={styles.q}>
        <Sparkles size={13} aria-hidden /> AI-drafted question — review and edit before it sends
      </p>
      <textarea
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={4}
        className={styles.textarea}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={drafting ? 'Drafting a question…' : 'Ask one clear, plain-English question.'}
      />
      <div className={styles.foot}>
        <SendButton />
        <button type="button" className={`${styles.sbtn} ${styles.sbtnSecondary}`} onClick={() => setOpen(false)}>
          Cancel
        </button>
        {draftErr ? <span className={styles.err} role="alert">{draftErr}</span> : null}
        {result && !result.success ? (
          <span className={styles.err} role="alert">
            {result.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
