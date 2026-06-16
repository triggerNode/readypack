'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dev.module.css'

type Plan = 'solo' | 'procurement_ready' | 'adviser'

export default function DevToolsPage() {
  const router = useRouter()
  const [prefillTo, setPrefillTo] = useState(0)
  const [plan, setPlan] = useState<Plan>('procurement_ready')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [qaSubmissionId, setQaSubmissionId] = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)
  const [qaResult, setQaResult] = useState<unknown>(null)

  type RepairAction = 'resend_magic_link' | 'resend_delivery_email' | 'retrigger_generation'
  const [repairOrderId, setRepairOrderId] = useState('')
  const [repairLoading, setRepairLoading] = useState<RepairAction | null>(null)
  const [repairError, setRepairError] = useState<string | null>(null)
  const [repairResult, setRepairResult] = useState<string | null>(null)

  async function repairOrder(action: RepairAction) {
    setRepairLoading(action)
    setRepairError(null)
    setRepairResult(null)
    try {
      const res = await fetch('/api/admin/dev/repair-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: repairOrderId.trim(), action }),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? 'Request failed')
      }
      setRepairResult(body.message ?? 'Done.')
    } catch (e) {
      setRepairError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRepairLoading(null)
    }
  }

  async function rerunQa() {
    setQaLoading(true)
    setQaError(null)
    setQaResult(null)
    try {
      const res = await fetch('/api/admin/dev/rerun-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: qaSubmissionId.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? 'Request failed')
      }
      setQaResult(body)
    } catch (e) {
      setQaError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setQaLoading(false)
    }
  }

  async function createTest(reset = true) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dev/create-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefillTo, plan, reset }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Request failed')
      }
      router.push('/start')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pagehead}>
          <h1>Dev Tools</h1>
          <div className={styles.pagesub}>
            <span className={styles.envChip}>
              <FlaskIcon />
              staging
            </span>
            Internal utilities for testing the intake and QA pipeline.
          </div>
        </div>

        {/* ── Test questionnaire ───────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>
              <FilePlusIcon />
            </span>
            <h2>Test questionnaire</h2>
          </div>
          <p className={styles.sectionSub}>
            Creates a fresh intake submission for your account and drops you directly into the
            questionnaire. Any previous incomplete test submissions are deleted first.
          </p>

          <div className={styles.card}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="planSelect">Plan</label>
              <div className={styles.control}>
                <select
                  className={styles.select}
                  id="planSelect"
                  value={plan}
                  onChange={e => setPlan(e.target.value as Plan)}
                >
                  <option value="solo">Solo — £249</option>
                  <option value="procurement_ready">Procurement Ready — £499</option>
                  <option value="adviser">Adviser Pack — £799</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="startSelect">Start point</label>
              <div className={styles.control}>
                <select
                  className={styles.select}
                  id="startSelect"
                  value={prefillTo}
                  onChange={e => setPrefillTo(Number(e.target.value))}
                >
                  <option value={0}>Welcome screen (empty)</option>
                  <option value={1}>Section 1 — Your business</option>
                  <option value={2}>Section 2 — Markets &amp; customers</option>
                  <option value={3}>Section 3 — AI tools</option>
                  <option value={4}>Section 4 — How AI is used</option>
                  <option value={5}>Section 5 — AI &amp; people</option>
                  <option value={6}>Section 6 — Data &amp; vendors</option>
                  <option value={7}>Section 7 — Existing documents</option>
                  <option value={8}>Section 8 — Complaints &amp; incidents</option>
                  <option value={9}>Section 9 — Procurement</option>
                  <option value={10}>Section 10 — Review &amp; submit (all pre-filled)</option>
                </select>
              </div>
              <span className={styles.fieldHint}>
                Sections before the start point are pre-filled with realistic test data.
              </span>
            </div>

            {error ? <p className={styles.errorLine}>Error: {error}</p> : null}

            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => createTest(true)}
                disabled={loading}
              >
                <span className={styles.arrowPrefix}>→</span>
                {loading ? 'Creating…' : 'Create test submission'}
              </button>
            </div>
          </div>

          <div className={styles.warn}>
            <span className={styles.warnIcon}>
              <TriangleAlertIcon />
            </span>
            <span className={styles.warnText}>
              <b>Dev only.</b> This page creates real database records (org, order,
              intake_submission) with <code>stripe_payment_id = null</code> as a test marker so they
              can be cleaned up automatically.
            </span>
          </div>
        </section>

        {/* ── Re-run QA ─────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>
              <RefreshIcon />
            </span>
            <h2>
              Re-run QA layer
              <span className={styles.sectionStage}> (Stage 6)</span>
            </h2>
          </div>
          <p className={styles.sectionSub}>
            Replays the Haiku QA pass against the already-generated documents for a submission.
            Useful for iterating on the QA prompt without re-running Stage 5.
          </p>

          <div className={styles.card}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="submissionId">Submission ID</label>
              <div className={styles.control}>
                <input
                  type="text"
                  id="submissionId"
                  value={qaSubmissionId}
                  onChange={e => setQaSubmissionId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className={`${styles.input} ${styles.inputMono}`}
                />
              </div>
            </div>

            {qaError ? <p className={styles.errorLine}>Error: {qaError}</p> : null}

            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={rerunQa}
                disabled={qaLoading || !qaSubmissionId.trim()}
              >
                <span className={styles.arrowPrefix}>→</span>
                {qaLoading ? 'Running QA…' : 'Re-run QA'}
              </button>
            </div>
          </div>

          {qaResult ? (
            <>
              <div className={styles.outputLabel}>
                <span className={styles.outputLabelLbl}>QA result</span>
                <span className={styles.outputStatus}>
                  <span className={styles.outputStatusDot} />
                  200 · completed
                </span>
              </div>
              <div className={styles.terminal}>
                <div className={styles.terminalBar}>
                  <span className={`${styles.terminalDot} ${styles.terminalDotR}`} />
                  <span className={`${styles.terminalDot} ${styles.terminalDotY}`} />
                  <span className={`${styles.terminalDot} ${styles.terminalDotG}`} />
                  <span className={styles.terminalTitle}>qa_result.json — claude-haiku</span>
                </div>
                <pre>{JSON.stringify(qaResult, null, 2)}</pre>
              </div>
            </>
          ) : null}
        </section>

        {/* ── Repair / recover an order ─────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>
              <WrenchIcon />
            </span>
            <h2>Repair order</h2>
          </div>
          <p className={styles.sectionSub}>
            Re-drive a step that failed mid-pipeline for an existing order: resend the intake
            magic link, resend the delivery email, or wipe and re-run document generation.
          </p>

          <div className={styles.card}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="repairOrderId">Order ID</label>
              <div className={styles.control}>
                <input
                  type="text"
                  id="repairOrderId"
                  value={repairOrderId}
                  onChange={e => setRepairOrderId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className={`${styles.input} ${styles.inputMono}`}
                />
              </div>
            </div>

            {repairError ? <p className={styles.errorLine}>Error: {repairError}</p> : null}
            {repairResult ? <p className={styles.successLine}>{repairResult}</p> : null}

            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => repairOrder('resend_magic_link')}
                disabled={!repairOrderId.trim() || repairLoading !== null}
              >
                <span className={styles.arrowPrefix}>→</span>
                {repairLoading === 'resend_magic_link' ? 'Sending…' : 'Resend Magic Link'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => repairOrder('resend_delivery_email')}
                disabled={!repairOrderId.trim() || repairLoading !== null}
              >
                <span className={styles.arrowPrefix}>→</span>
                {repairLoading === 'resend_delivery_email' ? 'Sending…' : 'Resend Delivery Email'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => repairOrder('retrigger_generation')}
                disabled={!repairOrderId.trim() || repairLoading !== null}
              >
                <span className={styles.arrowPrefix}>→</span>
                {repairLoading === 'retrigger_generation' ? 'Running…' : 'Retrigger Generation'}
              </button>
            </div>
          </div>

          <div className={styles.warn}>
            <span className={styles.warnIcon}>
              <TriangleAlertIcon />
            </span>
            <span className={styles.warnText}>
              <b>Destructive.</b> &ldquo;Retrigger Generation&rdquo; deletes the existing
              generated documents and jobs for this order before re-running the pipeline.
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── Inline icons ────────────────────────── */

function FlaskIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 2v7.31" />
      <path d="M14 9.3V2" />
      <path d="M8.5 2h7" />
      <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
    </svg>
  )
}

function FilePlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function TriangleAlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  )
}
