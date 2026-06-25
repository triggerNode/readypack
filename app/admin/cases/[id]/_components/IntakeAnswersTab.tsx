'use client'

import { useState } from 'react'
import styles from './detail-tabs.module.css'

type RawAnswers = Record<string, unknown> | null
type SectionCompletion = Record<string, boolean> | null

type Props = {
  rawAnswers: RawAnswers
  sectionCompletion: SectionCompletion
}

// `key` is a stable React/accordion id; `dataKey` is how the answer is actually
// stored in raw_answers / section_completion. The intake saves these keyed by
// the bare section number ("1".."10"), not "section_1" — so we look up by
// dataKey (with a section_N fallback for any older submissions).
const SECTION_ORDER: ReadonlyArray<{ key: string; dataKey: string; num: string; title: string }> = [
  { key: 'section_1', dataKey: '1', num: '01', title: 'Your business' },
  { key: 'section_2', dataKey: '2', num: '02', title: 'Markets & customers' },
  { key: 'section_3', dataKey: '3', num: '03', title: 'AI tools' },
  { key: 'section_4', dataKey: '4', num: '04', title: 'How AI is used' },
  { key: 'section_5', dataKey: '5', num: '05', title: 'AI & people' },
  { key: 'section_6', dataKey: '6', num: '06', title: 'Data & vendors' },
  { key: 'section_7', dataKey: '7', num: '07', title: 'Existing documents' },
  { key: 'section_8', dataKey: '8', num: '08', title: 'Complaints & incidents' },
  { key: 'section_9', dataKey: '9', num: '09', title: 'Procurement' },
  { key: 'section_10', dataKey: '10', num: '10', title: 'Governance & sign-off' },
]

/** Heuristic: render a primitive answer value as a readable string. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value
      .map(v => (typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)))
      .join(', ')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

export function IntakeAnswersTab({ rawAnswers, sectionCompletion }: Props) {
  const completedKeys = sectionCompletion ? Object.keys(sectionCompletion) : []
  const completedCount = completedKeys.filter(k => sectionCompletion?.[k]).length
  const totalSections = completedKeys.length > 0 ? completedKeys.length : SECTION_ORDER.length

  const [openSet, setOpenSet] = useState<ReadonlySet<string>>(() => new Set(['section_1']))

  function toggle(key: string) {
    setOpenSet(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function exportJson() {
    if (!rawAnswers) return
    const blob = new Blob([JSON.stringify(rawAnswers, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'intake-answers.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadLeft}>
          <h2>Intake Responses</h2>
          <span className={styles.panelSub}>
            {completedCount} of {totalSections} sections completed
          </span>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={exportJson}
          disabled={!rawAnswers}
        >
          <DownloadIcon />
          Export answers (JSON)
        </button>
      </div>

      {!rawAnswers ? (
        <div className={styles.empty}>No intake answers submitted yet.</div>
      ) : (
        <div className={styles.intakeList}>
          {SECTION_ORDER.map(section => {
            const raw = rawAnswers as Record<string, unknown>
            const sectionData = asObject(raw[section.dataKey] ?? raw[section.key])
            const completed = sectionCompletion
              ? sectionCompletion[section.dataKey] === true || sectionCompletion[section.key] === true
              : false
            const isOpen = openSet.has(section.key)
            const entries = sectionData ? Object.entries(sectionData) : []
            const hasContent = entries.length > 0

            return (
              <div key={section.key} className={styles.acc}>
                <button
                  type="button"
                  className={styles.accHead}
                  onClick={() => toggle(section.key)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.accNum}>{section.num}</span>
                  <span className={styles.accTitle}>{section.title}</span>
                  {completed ? (
                    <span className={styles.accCheck} aria-label="completed">
                      <CheckCircleIcon />
                    </span>
                  ) : null}
                  <span
                    className={`${styles.accChev} ${isOpen ? styles.accChevOpen : ''}`}
                    aria-hidden
                  >
                    <ChevronDownIcon />
                  </span>
                </button>
                {isOpen ? (
                  <div className={styles.accBody}>
                    {hasContent ? (
                      <div className={styles.kvGrid}>
                        {entries.map(([k, v]) => {
                          const isMono = /^[a-f0-9-]{8,}$/i.test(String(v))
                          const valStr = renderValue(v)
                          const isLong = valStr.length > 60
                          return (
                            <div
                              key={k}
                              className={`${styles.kv} ${isLong ? styles.kvFull : ''}`}
                            >
                              <span className={styles.kvKey}>{humanLabel(k)}</span>
                              <span
                                className={`${styles.kvVal} ${isMono ? styles.kvValMono : ''}`}
                              >
                                {valStr}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={styles.empty}>No answers recorded for this section.</div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ── Icons ─────────────────────────────────── */

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
