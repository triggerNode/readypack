'use client'

import { AutosaveIndicator } from './AutosaveIndicator'
import { SECTION_NAMES } from '../types'

type Props = {
  currentSection: number
  completedSections: Set<number>
  skippedSections: Set<number>
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onJump: (section: number) => void
  onSaveAndExit: () => void
}

export function SectionNav({
  currentSection,
  completedSections,
  skippedSections,
  autosaveStatus,
  onJump,
  onSaveAndExit,
}: Props) {
  const totalCompletable = 10 - skippedSections.size
  const completedCount = Array.from(completedSections).filter(
    (n) => !skippedSections.has(n),
  ).length
  const progressPct = totalCompletable === 0
    ? 0
    : Math.round((completedCount / totalCompletable) * 100)

  return (
    <aside className="qz-sidebar" aria-label="Questionnaire navigation">
      <div className="qz-sidebar-label">Your progress</div>
      <div
        className="qz-progress-track"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Questionnaire completion"
      >
        <div className="qz-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="qz-progress-caption">
        {completedCount} of {totalCompletable} sections complete
      </div>

      <nav className="qz-sidebar-list" aria-label="Section navigation">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const isActive = n === currentSection
          const isComplete = completedSections.has(n)
          const isSkipped = skippedSections.has(n)
          const cls = [
            'qz-side-item',
            isActive && 'is-active',
            isComplete && 'is-complete',
            isSkipped && 'is-skipped',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={n}
              type="button"
              className={cls}
              onClick={() => !isSkipped && onJump(n)}
              disabled={isSkipped}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="qz-side-num">
                {isComplete ? (
                  <CheckIcon />
                ) : (
                  <span>{n}</span>
                )}
              </span>
              <span className="qz-side-name">{SECTION_NAMES[n]}</span>
              <span className="qz-side-status" aria-hidden>
                {isSkipped ? (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>N/A</span>
                ) : isComplete ? (
                  <CheckIcon className="qz-side-check" />
                ) : (
                  <span className="qz-side-dot-empty" />
                )}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="qz-sidebar-foot">
        <AutosaveIndicator status={autosaveStatus} />
        <button type="button" className="qz-save-return" onClick={onSaveAndExit}>
          Save and return later
        </button>
      </div>
    </aside>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
