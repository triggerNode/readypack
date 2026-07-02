'use client'

import { useState } from 'react'
import { sendAdminMagicLink } from './actions'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('olutags@gmail.com')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()

  const authError = searchParams.get('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    // Browser-independent sign-in: the server generates a token_hash magic link
    // and emails it. It works no matter which browser/app opens it.
    const result = await sendAdminMagicLink(email)

    if (result.ok) {
      setStatus('sent')
    } else {
      setStatus('error')
      setErrorMessage(result.error ?? 'Could not send the link. Please try again.')
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--sp-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: 'var(--sp-8)',
      }}>
        <h1 style={{
          fontSize: 'var(--h4)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--sp-2)',
          fontWeight: 700,
        }}>
          ReadyPack Admin
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--body-sm)',
          marginBottom: 'var(--sp-6)',
        }}>
          Enter your email to receive a magic link.
        </p>

        {authError && (
          <p style={{
            color: 'var(--danger)',
            fontSize: 'var(--body-sm)',
            marginBottom: 'var(--sp-4)',
          }}>
            {authError === 'unauthorised'
              ? 'This email is not authorised for admin access.'
              : 'Authentication failed. Please try again.'}
          </p>
        )}

        {status === 'sent' ? (
          <p style={{ color: 'var(--success)', fontSize: 'var(--body-sm)' }}>
            Magic link sent — check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--label)',
                  marginBottom: 'var(--sp-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 'var(--sp-3) var(--sp-4)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--body)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {status === 'error' && (
              <p style={{
                color: 'var(--danger)',
                fontSize: 'var(--body-sm)',
                marginBottom: 'var(--sp-3)',
              }}>
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                width: '100%',
                padding: 'var(--sp-3) var(--sp-4)',
                backgroundColor: status === 'sending' ? 'var(--accent-hover)' : 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: 'var(--body)',
                fontWeight: 600,
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
