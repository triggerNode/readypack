'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { WelcomeScreen } from './WelcomeScreen'
import { SectionNav } from './shared/SectionNav'
import { Section01Business } from './sections/Section01Business'
import { Section02Markets } from './sections/Section02Markets'
import { Section03AiTools } from './sections/Section03AiTools'
import { Section04HowAiUsed } from './sections/Section04HowAiUsed'
import { Section05AiTouchesPeople } from './sections/Section05AiTouchesPeople'
import { Section06DataVendors } from './sections/Section06DataVendors'
import { Section07ExistingDocs } from './sections/Section07ExistingDocs'
import { Section08Complaints } from './sections/Section08Complaints'
import { Section09Procurement } from './sections/Section09Procurement'
import { Section10ReviewSubmit } from './sections/Section10ReviewSubmit'
import { RiskRouting } from './routing/RiskRouting'
import type { RawAnswers, RiskLevel, SectionCompletion } from './types'
import { SECTION_NAMES } from './types'

type Props = {
  submissionId: string
  initialAnswers: RawAnswers
  initialCompletion: SectionCompletion
  isReturning: boolean
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// localStorage key for a section's in-progress (not-yet-server-saved) answers.
function draftKey(submissionId: string, sectionNum: number): string {
  return `readypack_draft_${submissionId}_section_${sectionNum}`
}

export function QuestionnaireShell({
  submissionId,
  initialAnswers,
  initialCompletion,
  isReturning,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<RawAnswers>(initialAnswers)
  const [showWelcome, setShowWelcome] = useState(true)
  const [currentSection, setCurrentSection] = useState<number>(() => {
    // Start at first incomplete section
    for (let i = 1; i <= 10; i++) {
      const c = initialCompletion[String(i) as keyof SectionCompletion]
      const done = typeof c === 'boolean' ? c : c?.completed
      if (!done) return i
    }
    return 10
  })
  const [completed, setCompleted] = useState<Set<number>>(() => {
    const s = new Set<number>()
    for (let i = 1; i <= 10; i++) {
      const c = initialCompletion[String(i) as keyof SectionCompletion]
      const done = typeof c === 'boolean' ? c : c?.completed
      if (done) s.add(i)
    }
    return s
  })
  const [autosave, setAutosave] = useState<AutosaveStatus>('saved')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<
    { status: 'pending' } | { status: 'submitted'; riskLevel: RiskLevel }
  >({ status: 'pending' })

  // Compute skipped sections (4 + 5 if "no AI tools" picked, etc.)
  const skipped = useMemo(() => {
    const s = new Set<number>()
    if (answers['3']?.no_ai_tools === true) {
      s.add(4)
      s.add(5)
    } else if (answers['4'] && answers['4'].ai_customer_facing === 'No') {
      // Section 5 only relevant if customer-facing AI = Yes
      s.add(5)
    }
    return s
  }, [answers])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  const save = useCallback(
    async (sectionNum: number, sectionAnswers: unknown) => {
      setIsSaving(true)
      setAutosave('saving')
      try {
        const res = await fetch('/api/intake/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            section: sectionNum,
            answers: sectionAnswers,
          }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? 'Save failed')
        }
        setAutosave('saved')
        return true
      } catch {
        setAutosave('error')
        showToast('Save failed. Check your connection and try again.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [submissionId, showToast],
  )

  const updateSection = useCallback(
    <K extends keyof RawAnswers>(key: K, value: RawAnswers[K]) => {
      setAnswers((prev) => ({ ...prev, [key]: value }))
      setIsDirty(true)
      // Mirror the in-progress section to localStorage so a tab close before
      // "Continue" doesn't lose the answers.
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(draftKey(submissionId, Number(key)), JSON.stringify(value))
        } catch {
          // localStorage may be unavailable (private mode / quota) — non-fatal.
        }
      }
    },
    [submissionId],
  )

  // Warn before unloading the tab while there are unsaved (not-yet-continued) changes.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // On mount, restore any localStorage drafts for sections that were never
  // saved to the server. Runs once.
  const didRestore = useRef(false)
  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    if (typeof window === 'undefined') return

    const restored: Partial<RawAnswers> = {}
    let restoredAny = false
    for (let i = 1; i <= 10; i++) {
      const completion = initialCompletion[String(i) as keyof SectionCompletion]
      const savedToServer = typeof completion === 'boolean' ? completion : completion?.completed
      if (savedToServer) continue
      let raw: string | null = null
      try {
        raw = window.localStorage.getItem(draftKey(submissionId, i))
      } catch {
        raw = null
      }
      if (!raw) continue
      try {
        restored[String(i) as keyof RawAnswers] = JSON.parse(raw)
        restoredAny = true
      } catch {
        // Corrupt draft — ignore it.
      }
    }
    if (restoredAny) {
      setAnswers((prev) => ({ ...prev, ...restored }))
      showToast('We restored your unsaved answers for this section.')
    }
  }, [submissionId, initialCompletion, showToast])

  const handleContinue = useCallback(
    async (sectionNum: number, sectionAnswers: unknown) => {
      const ok = await save(sectionNum, sectionAnswers)
      if (!ok) return
      // Server now has this section — clear the local draft + dirty flag.
      setIsDirty(false)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(draftKey(submissionId, sectionNum))
        } catch {
          // non-fatal
        }
      }
      setCompleted((prev) => new Set(prev).add(sectionNum))

      // Determine next section (skip ahead if necessary)
      let next = sectionNum + 1
      while (next <= 10 && skipped.has(next)) next++
      if (next > 10) next = 10
      setCurrentSection(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [save, skipped, submissionId],
  )

  const handleBack = useCallback(() => {
    let prev = currentSection - 1
    while (prev >= 1 && skipped.has(prev)) prev--
    if (prev < 1) prev = 1
    setCurrentSection(prev)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentSection, skipped])

  const handleJump = useCallback((n: number) => {
    if (n >= 1 && n <= 10) {
      setCurrentSection(n)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSaveAndExit = useCallback(() => {
    router.push('/')
  }, [router])

  const handleSubmit = useCallback(
    async (section10Answers: RawAnswers['10']) => {
      setIsSaving(true)
      try {
        // Save final section first
        const saveRes = await fetch('/api/intake/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            section: 10,
            answers: section10Answers,
          }),
        })
        if (!saveRes.ok) {
          showToast('Save failed. Check your connection and try again.')
          setIsSaving(false)
          return
        }

        // Section 10 is now persisted — clear its local draft + dirty flag so the
        // post-submit navigation doesn't trip the beforeunload guard.
        setIsDirty(false)
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(draftKey(submissionId, 10))
          } catch {
            // non-fatal
          }
        }

        const res = await fetch('/api/intake/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          showToast(body.error ?? 'Submit failed. Please try again.')
          setIsSaving(false)
          return
        }
        const data = (await res.json()) as { riskLevel: RiskLevel }
        setSubmitState({ status: 'submitted', riskLevel: data.riskLevel })
      } catch {
        showToast('Submit failed. Please try again.')
      } finally {
        setIsSaving(false)
      }
    },
    [submissionId, showToast],
  )

  if (submitState.status === 'submitted') {
    return <RiskRouting riskLevel={submitState.riskLevel} />
  }

  if (showWelcome) {
    return (
      <>
        <QzNavBar autosave={autosave} />
        <WelcomeScreen
          isReturning={isReturning}
          onStart={() => setShowWelcome(false)}
        />
      </>
    )
  }

  return (
    <>
      <QzNavBar autosave={autosave} />
      <MobileStrip
        currentSection={currentSection}
        completed={completed}
        skipped={skipped}
      />
      <div className="qz-layout">
        <SectionNav
          currentSection={currentSection}
          completedSections={completed}
          skippedSections={skipped}
          autosaveStatus={autosave}
          onJump={handleJump}
          onSaveAndExit={handleSaveAndExit}
        />
        <main className="qz-main">
          <ActiveSection
            currentSection={currentSection}
            answers={answers}
            completedSections={completed}
            isSaving={isSaving}
            onUpdate={updateSection}
            onBack={currentSection > 1 ? handleBack : undefined}
            onContinue={handleContinue}
            onJump={handleJump}
            onSubmit={handleSubmit}
          />
        </main>
      </div>
      {toast ? <div className="qz-toast" role="alert">{toast}</div> : null}
    </>
  )
}

function ActiveSection({
  currentSection,
  answers,
  completedSections,
  isSaving,
  onUpdate,
  onBack,
  onContinue,
  onJump,
  onSubmit,
}: {
  currentSection: number
  answers: RawAnswers
  completedSections: Set<number>
  isSaving: boolean
  onUpdate: <K extends keyof RawAnswers>(key: K, value: RawAnswers[K]) => void
  onBack?: () => void
  onContinue: (sectionNum: number, sectionAnswers: unknown) => Promise<void>
  onJump: (n: number) => void
  onSubmit: (section10Answers: RawAnswers['10']) => Promise<void>
}) {
  switch (currentSection) {
    case 1:
      return (
        <Section01Business
          answers={answers['1'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('1', v)}
          onContinue={(v) => onContinue(1, v)}
        />
      )
    case 2:
      return (
        <Section02Markets
          answers={answers['2'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('2', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(2, v)}
        />
      )
    case 3:
      return (
        <Section03AiTools
          answers={answers['3'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('3', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(3, v)}
        />
      )
    case 4:
      return (
        <Section04HowAiUsed
          answers={answers['4'] ?? {}}
          section3={answers['3'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('4', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(4, v)}
        />
      )
    case 5:
      return (
        <Section05AiTouchesPeople
          answers={answers['5'] ?? {}}
          section4={answers['4'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('5', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(5, v)}
        />
      )
    case 6:
      return (
        <Section06DataVendors
          answers={answers['6'] ?? {}}
          section3={answers['3'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('6', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(6, v)}
        />
      )
    case 7:
      return (
        <Section07ExistingDocs
          answers={answers['7'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('7', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(7, v)}
        />
      )
    case 8:
      return (
        <Section08Complaints
          answers={answers['8'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('8', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(8, v)}
        />
      )
    case 9:
      return (
        <Section09Procurement
          answers={answers['9'] ?? {}}
          isSaving={isSaving}
          onChange={(v) => onUpdate('9', v)}
          onBack={onBack}
          onContinue={(v) => onContinue(9, v)}
        />
      )
    case 10:
      return (
        <Section10ReviewSubmit
          answers={answers}
          completedSections={completedSections}
          isSaving={isSaving}
          onBack={onBack}
          onEdit={onJump}
          onSubmit={onSubmit}
        />
      )
    default:
      return null
  }
}

function QzNavBar({ autosave }: { autosave: AutosaveStatus }) {
  return (
    <nav className="qz-nav-bar">
      <div className="qz-container qz-nav-inner">
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          <ReadyPackLogo style={{ width: 28, height: 28, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>Readypack</span>
        </a>
        <div className="qz-nav-account">
          <span className="qz-nav-saved">
            <SavedIcon />
            {autosave === 'error' ? 'Error' : autosave === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>
      </div>
    </nav>
  )
}

function SavedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MobileStrip({
  currentSection,
  completed,
  skipped,
}: {
  currentSection: number
  completed: Set<number>
  skipped: Set<number>
}) {
  const totalCompletable = 10 - skipped.size
  const doneCount = Array.from(completed).filter((n) => !skipped.has(n)).length
  const pct = totalCompletable === 0 ? 0 : Math.round((doneCount / totalCompletable) * 100)
  return (
    <div className="qz-mobile-strip">
      <div className="qz-mobile-strip-track">
        <div className="qz-mobile-strip-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="qz-mobile-strip-caption">
        Section {currentSection} of 10 · {SECTION_NAMES[currentSection]}
      </div>
    </div>
  )
}
