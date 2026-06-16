import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuestionnaireShell } from './_components/QuestionnaireShell'
import type { RawAnswers, SectionCompletion } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // No session — user should reach this page only via magic link
    redirect('/')
  }

  const { data: submission, error } = await supabase
    .from('intake_submissions')
    .select('id, raw_answers, section_completion, completion_status')
    .eq('user_id', user.id)
    .neq('completion_status', 'submitted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !submission) {
    // Distinguish: has the user already submitted, or do they have no submission at all?
    const { data: submittedSub } = await supabase
      .from('intake_submissions')
      .select('id, completion_status')
      .eq('user_id', user.id)
      .eq('completion_status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (submittedSub) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(22, 163, 74, 0.12)',
                border: '1px solid rgba(22, 163, 74, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                marginBottom: 24,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h1 style={{ fontSize: 'var(--h2)', margin: '0 0 12px', lineHeight: 1.2 }}>
              Your questionnaire has been submitted
            </h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
              We&apos;ve received your answers and we&apos;re building your compliance pack.
              You&apos;ll receive an email when it&apos;s ready — usually within 48 hours.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--body-sm)', margin: 0 }}>
              Questions? Email{' '}
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

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: 'var(--h2)', margin: '0 0 16px', lineHeight: 1.2 }}>
            No active questionnaire
          </h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            We couldn&apos;t find an active intake submission for your account. If you believe
            this is an error, email{' '}
            <a
              href="mailto:hello@readypack.co.uk"
              style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}
            >
              hello@readypack.co.uk
            </a>
            .
          </p>
        </div>
      </main>
    )
  }

  const rawAnswers = (submission.raw_answers ?? {}) as RawAnswers
  const sectionCompletion = (submission.section_completion ?? {}) as SectionCompletion
  const isReturning = Object.keys(rawAnswers).length > 0

  return (
    <QuestionnaireShell
      submissionId={submission.id}
      initialAnswers={rawAnswers}
      initialCompletion={sectionCompletion}
      isReturning={isReturning}
    />
  )
}
