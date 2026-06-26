'use client'

import Link from 'next/link'
import type { RiskLevel } from '../types'

type Props = {
  riskLevel: RiskLevel
  /** Order id — present once the questionnaire is submitted; lets us link to
   *  the live Pack Progress screen. Null only if the order link is unavailable. */
  orderId: string | null
}

export function RiskRouting({ riskLevel, orderId }: Props) {
  if (riskLevel === 'critical') {
    // No generation is enqueued for critical cases — a specialist makes contact
    // first — so there is no live progress to show. Keep the contact-only screen.
    return (
      <RoutingShell variant="danger" icon={<AlertIcon />} heading="This case needs specialist attention.">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your answers indicate a use case that may fall outside our standard documentation pack.
          A member of our team will be in touch within 1 business day to discuss next steps.
        </p>
        <ContactLine />
      </RoutingShell>
    )
  }

  if (riskLevel === 'high') {
    return (
      <RoutingShell variant="warning" icon={<ClockIcon />} heading="Your pack needs a manual review.">
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your answers indicate a higher-risk use case — our team will review your pack before
          delivery. Allow up to 72 hours rather than 48.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8 }}>
          We&apos;ll send you an update by email once the review is underway.
        </p>
        <ProgressLink orderId={orderId} />
        <ContactLine />
      </RoutingShell>
    )
  }

  // low / medium
  return (
    <RoutingShell variant="success" icon={<ShieldCheckIcon />} heading="Your pack is being prepared.">
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        We&apos;re building your nine compliance documents now. You&apos;ll receive them by email
        within 48 hours. You don&apos;t need to do anything else.
      </p>
      <Timeline />
      <ProgressLink orderId={orderId} />
      <ContactLine />
    </RoutingShell>
  )
}

function ProgressLink({ orderId }: { orderId: string | null }) {
  if (!orderId) return null
  return (
    <Link
      href={`/portal/${orderId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        padding: '13px 24px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--accent-primary)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 'var(--body-sm)',
        textDecoration: 'none',
      }}
    >
      View pack progress →
    </Link>
  )
}

function RoutingShell({
  variant,
  icon,
  heading,
  children,
}: {
  variant: 'success' | 'warning' | 'danger'
  icon: React.ReactNode
  heading: string
  children: React.ReactNode
}) {
  return (
    <main className="qz-routing">
      <div className="qz-routing-card">
        <div className={`qz-routing-icon is-${variant}`}>{icon}</div>
        <h2 className="qz-h2" style={{ marginBottom: 16 }}>
          {heading}
        </h2>
        {children}
      </div>
    </main>
  )
}

function Timeline() {
  return (
    <div className="qz-routing-timeline">
      <div className="qz-routing-step">
        <span className="qz-routing-step-num">1</span>
        <h4>Pack building</h4>
        <p>AI drafts your nine documents.</p>
      </div>
      <div className="qz-routing-step">
        <span className="qz-routing-step-num">2</span>
        <h4>QA check</h4>
        <p>Our team reviews and finalises.</p>
      </div>
      <div className="qz-routing-step">
        <span className="qz-routing-step-num">3</span>
        <h4>Delivered</h4>
        <p>Documents arrive in your inbox.</p>
      </div>
    </div>
  )
}

function ContactLine() {
  return (
    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--body-sm)', marginTop: 20 }}>
      Questions? Email{' '}
      <a href="mailto:hello@readypack.co.uk" style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>
        hello@readypack.co.uk
      </a>
    </p>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
