'use client'

import { useState } from 'react'
import { requestFreshLink } from './actions'

type Props = {
  /** Validated destination the fresh link should land on. */
  next: string
  /** True when we arrived here from a consumed/expired link. */
  expired: boolean
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ResumeForm({ next, expired }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const result = await requestFreshLink(email, next)
    if (result.ok) {
      setStatus('sent')
    } else {
      setStatus('error')
      setErrorMessage(result.error ?? 'Could not send the link. Please try again.')
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-0.01em',
            color: 'var(--text-primary)',
            display: 'inline-block',
            marginBottom: 24,
          }}
        >
          Ready<span style={{ color: 'var(--accent-primary)' }}>Pack</span>
        </span>

        {status === 'sent' ? (
          <>
            <h1 style={{ fontSize: 'var(--h3)', margin: '0 0 12px', lineHeight: 1.25 }}>
              Check your inbox
            </h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              If that email is on file, we&rsquo;ve just sent a fresh secure link. It expires in an
              hour — open it on this device and you&rsquo;re back in, right where you left off.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 'var(--h3)', margin: '0 0 12px', lineHeight: 1.25 }}>
              {expired ? 'That link has expired' : 'Return to your questionnaire'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
              Secure links can only be used once. Enter the email you used and we&rsquo;ll send a fresh
              one — your progress is saved.
            </p>

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <label
                htmlFor="resume-email"
                style={{
                  display: 'block',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--label)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </label>
              <input
                id="resume-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--body)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 16,
                }}
              />

              {status === 'error' ? (
                <p
                  role="alert"
                  style={{ color: 'var(--danger)', fontSize: 'var(--body-sm)', margin: '0 0 12px' }}
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background:
                    status === 'sending' ? 'var(--accent-hover)' : 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 'var(--body)',
                  fontWeight: 600,
                  cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'sending' ? 'Sending…' : 'Send me a fresh link'}
              </button>
            </form>
          </>
        )}

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--body-sm)',
            margin: '24px 0 0',
          }}
        >
          Need a hand? Email{' '}
          <a
            href="mailto:hello@readypack.co.uk"
            style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}
          >
            hello@readypack.co.uk
          </a>
        </p>
      </div>
    </main>
  )
}
