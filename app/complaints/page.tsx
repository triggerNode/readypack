'use client'

import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Gavel,
  Hash,
  MessageSquareWarning,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import styles from '@/app/landing.module.css'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Article50Disclosure } from '@/components/layout/Article50Disclosure'

const ICON_STROKE = 1.5

type SubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | {
      status: 'success'
      id: string
      acknowledged_at: string
      statutory_deadline: string
    }
  | { status: 'error'; message: string }

function formatLongDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ComplaintsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState('')
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmission({ status: 'submitting' })
    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complainant_name: name,
          complainant_email: email,
          complaint_text: details,
        }),
      })
      const data = (await response.json()) as {
        ok?: boolean
        id?: string
        acknowledged_at?: string
        statutory_deadline?: string
        error?: string
      }
      if (!response.ok || !data.ok || !data.id) {
        setSubmission({
          status: 'error',
          message: data.error || 'Unable to submit complaint. Please try again.',
        })
        return
      }
      setSubmission({
        status: 'success',
        id: data.id,
        acknowledged_at: data.acknowledged_at || new Date().toISOString(),
        statutory_deadline:
          data.statutory_deadline ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (error) {
      setSubmission({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unexpected submission error.',
      })
    }
  }

  function handleFileAnother() {
    setName('')
    setEmail('')
    setDetails('')
    setSubmission({ status: 'idle' })
  }

  const isSubmitting = submission.status === 'submitting'
  const isSuccess = submission.status === 'success'

  return (
    <>
      <AnnouncementBar />
      <Article50Disclosure />
      <Nav />

      <main className={styles['cmp-page']}>
        <div className={styles['cmp-page-grid']} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles['cmp-page-inner']}>
            <header className={styles['cmp-head']}>
              <span className={styles['cmp-pill']}>
                <span className={styles['pill-dot']} aria-hidden="true" />
                DUAA Section 103
              </span>
              <h1>Complaints Procedure</h1>
              <p>
                Your complaint will be officially logged under Section 103 of the UK
                DUAA, acknowledged immediately, and resolved within the 30-day statutory
                legal window.
              </p>
            </header>

            {isSuccess ? (
              <section
                className={`${styles.glass} ${styles['cmp-success']}`}
                aria-live="polite"
              >
                <div className={styles['success-check']} aria-hidden="true">
                  <Check width={34} height={34} strokeWidth={ICON_STROKE} />
                </div>
                <h2>Complaint logged</h2>
                <p className={styles['cmp-success-body']}>
                  Thank you. Your complaint has been recorded under our statutory DUAA
                  Section 103 process. A copy of the acknowledgement has been saved
                  against your case reference.
                </p>

                <div className={styles.summary}>
                  <div className={styles['summary-row']}>
                    <span className={styles.k}>
                      <span className={styles.ki} aria-hidden="true">
                        <Hash width={15} height={15} strokeWidth={ICON_STROKE} />
                      </span>
                      Complaint ID
                    </span>
                    <span className={styles.v}>{submission.id}</span>
                  </div>
                  <div className={styles['summary-row']}>
                    <span className={styles.k}>
                      <span className={styles.ki} aria-hidden="true">
                        <CalendarCheck
                          width={15}
                          height={15}
                          strokeWidth={ICON_STROKE}
                        />
                      </span>
                      Received
                    </span>
                    <span className={styles.v}>
                      {formatLongDate(submission.acknowledged_at)}
                    </span>
                  </div>
                  <div className={styles['summary-row']}>
                    <span className={styles.k}>
                      <span className={styles.ki} aria-hidden="true">
                        <Gavel width={15} height={15} strokeWidth={ICON_STROKE} />
                      </span>
                      Statutory resolution target
                    </span>
                    <span className={styles.v}>
                      {formatLongDate(submission.statutory_deadline)}{' '}
                      <span className={styles.tag}>30 days</span>
                    </span>
                  </div>
                </div>

                <div className={styles['success-foot']}>
                  <Link
                    href="/"
                    className={`${styles.btn} ${styles['btn-secondary']}`}
                  >
                    <ArrowLeft width={16} height={16} strokeWidth={ICON_STROKE} />
                    Back to home
                  </Link>
                  <button
                    type="button"
                    onClick={handleFileAnother}
                    className={`${styles.btn} ${styles['btn-primary']}`}
                  >
                    File another complaint
                  </button>
                </div>
              </section>
            ) : (
              <section className={`${styles.glass} ${styles['cmp-card']}`}>
                <div className={styles['cmp-card-head']}>
                  <span className={styles['cmp-card-head-ico']} aria-hidden="true">
                    <MessageSquareWarning
                      width={18}
                      height={18}
                      strokeWidth={ICON_STROKE}
                    />
                  </span>
                  <div>
                    <div className={styles['cmp-card-head-ttl']}>File a complaint</div>
                    <div className={styles['cmp-card-head-sub']}>
                      Statutory · UK DUAA s.103
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <div className={styles['field-row']}>
                    <div className={styles.field}>
                      <label htmlFor="fullName">
                        Full name <span className={styles.req}>*</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        className={styles.input}
                        placeholder="Jordan Avery"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="email">
                        Email address <span className={styles.req}>*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className={styles.input}
                        placeholder="you@company.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="details">
                      Complaint details <span className={styles.req}>*</span>
                    </label>
                    <textarea
                      id="details"
                      name="details"
                      rows={6}
                      className={styles.textarea}
                      placeholder="Describe your complaint in as much detail as you can. Include any relevant dates, case references, or correspondence."
                      required
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <button
                    type="submit"
                    className={`${styles.btn} ${styles['btn-primary']} ${styles['cmp-submit']}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Logging complaint…' : 'Submit complaint'}
                    {!isSubmitting && (
                      <ArrowRight width={16} height={16} strokeWidth={ICON_STROKE} />
                    )}
                  </button>

                  {submission.status === 'error' ? (
                    <p className={styles['cmp-error']} role="alert">
                      <AlertCircle
                        width={15}
                        height={15}
                        strokeWidth={ICON_STROKE}
                      />
                      <span>{submission.message}</span>
                    </p>
                  ) : null}

                  <p className={styles['cmp-disclaimer']}>
                    <span className={styles['cmp-disclaimer-ico']} aria-hidden="true">
                      <ShieldCheck
                        width={15}
                        height={15}
                        strokeWidth={ICON_STROKE}
                      />
                    </span>
                    <span>
                      By submitting you confirm the details above are accurate. We
                      acknowledge every complaint immediately and target resolution
                      within 30 calendar days.
                    </span>
                  </p>
                </form>
              </section>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
