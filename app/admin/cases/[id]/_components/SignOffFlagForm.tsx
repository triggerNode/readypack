'use client'

// The held-flag sign-off — the delivery-gate KEY, from the customer's side of the
// runbook. Collapsed to a "Sign off" button; expands to accept/remediate + a
// required reason, then posts signOffFlagAction. On success the server action
// revalidates the case, so the flag re-renders in its resolved state.

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { PenLine, Check } from 'lucide-react'
import { signOffFlagAction, type ActionResult } from '../flag-actions'
import styles from './signoff.module.css'

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${styles.sbtn} ${styles.sbtnPrimary}`}>
      <Check size={14} aria-hidden />
      {pending ? 'Saving…' : 'Confirm sign-off'}
    </button>
  )
}

export function SignOffFlagForm({ caseId, flagId }: { caseId: string; flagId: string }) {
  const [result, formAction] = useFormState(signOffFlagAction, null as ActionResult | null)
  const [signing, setSigning] = useState(false)
  const [decision, setDecision] = useState<'accept' | 'remediate' | ''>('')

  if (!signing) {
    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.sbtn} ${styles.sbtnPrimary}`}
          onClick={() => setSigning(true)}
        >
          <PenLine size={14} aria-hidden /> Sign off
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="flagId" value={flagId} />

      <p className={styles.q}>How is this being resolved?</p>
      <div className={styles.radios} role="radiogroup" aria-label="Sign-off decision">
        <label className={`${styles.radio}${decision === 'accept' ? ` ${styles.radioSel}` : ''}`}>
          <input
            type="radio"
            name="decision"
            value="accept"
            checked={decision === 'accept'}
            onChange={() => setDecision('accept')}
            className={styles.radioInput}
          />
          <span>
            <span className={styles.radioTitle}>Accept with justification</span>
            <span className={styles.radioDesc}>The processing is lawful as-is. Record why it’s acceptable.</span>
          </span>
        </label>
        <label className={`${styles.radio}${decision === 'remediate' ? ` ${styles.radioSel}` : ''}`}>
          <input
            type="radio"
            name="decision"
            value="remediate"
            checked={decision === 'remediate'}
            onChange={() => setDecision('remediate')}
            className={styles.radioInput}
          />
          <span>
            <span className={styles.radioTitle}>Remediate</span>
            <span className={styles.radioDesc}>Change what the pack states or asks for, then record the fix.</span>
          </span>
        </label>
      </div>

      <label htmlFor={`signoff-note-${flagId}`} className={styles.noteLabel}>
        Reason <span className={styles.req}>— required</span>
      </label>
      <textarea
        id={`signoff-note-${flagId}`}
        name="note"
        required
        minLength={10}
        maxLength={4000}
        rows={4}
        className={styles.textarea}
        placeholder="e.g. Lawful basis is legitimate interests; LIA completed and attached. AI output is advisory only — a human makes every hiring decision, so Article 22 does not bite."
      />

      <div className={styles.foot}>
        <ConfirmButton />
        <button
          type="button"
          className={`${styles.sbtn} ${styles.sbtnSecondary}`}
          onClick={() => setSigning(false)}
        >
          Cancel
        </button>
        {result && !result.success ? (
          <span className={styles.err} role="alert">
            {result.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
