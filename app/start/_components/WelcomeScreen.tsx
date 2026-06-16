'use client'

type Props = {
  onStart: () => void
  isReturning: boolean
}

export function WelcomeScreen({ onStart, isReturning }: Props) {
  return (
    <section className="qz-welcome">
      <div className="qz-welcome-card">
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(22, 163, 74, 0.08)',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          You are entering an AI-orchestrated environment. All questionnaire responses
          are processed under structural pseudonymization and zero-egress boundaries.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <span className="qz-welcome-check">
            <ShieldCheckIcon />
          </span>
        </div>
        <h2 className="qz-h2" style={{ marginTop: 24 }}>
          {isReturning ? 'Welcome back' : "Let's build your compliance pack"}
        </h2>
        {isReturning ? (
          <p className="qz-welcome-body">
            Your progress has been saved. Pick up where you left off — your answers are exactly
            as you left them.
          </p>
        ) : (
          <p className="qz-welcome-body">
            This questionnaire takes 20–35 minutes. You can save your progress at any time and
            return via your email link. Take your time — the detail you provide directly shapes
            the accuracy of your nine documents.
          </p>
        )}

        <div className="qz-welcome-how">
          <div className="qz-welcome-how-col">
            <span className="qz-welcome-how-ico"><ClipboardIcon /></span>
            <h4>Answer questions</h4>
            <p>We&apos;ll ask about your AI tools, data flows, and governance.</p>
          </div>
          <div className="qz-welcome-how-col">
            <span className="qz-welcome-how-ico"><CpuIcon /></span>
            <h4>We build your pack</h4>
            <p>AI drafts your nine documents, our team QA-checks the output.</p>
          </div>
          <div className="qz-welcome-how-col">
            <span className="qz-welcome-how-ico"><DownloadIcon /></span>
            <h4>Delivered in 48h</h4>
            <p>Documents arrive in your inbox, ready to use or share.</p>
          </div>
        </div>

        <p className="qz-welcome-note">
          Higher-risk use cases may take up to 72 hours and include a manual review step.
        </p>

        <button
          type="button"
          className="qz-btn qz-btn-primary qz-btn-lg qz-btn-block"
          style={{ marginTop: 32 }}
          onClick={onStart}
        >
          {isReturning ? 'Continue questionnaire' : 'Start your questionnaire'} →
        </button>

        <p className="qz-welcome-fine">
          Your answers are encrypted in transit and stored securely. Readypack uses your answers
          only to generate your compliance documents.
        </p>
      </div>
    </section>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}
function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}
function CpuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
