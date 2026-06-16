'use client'

import { useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, PillMultiSelect, CheckIcon } from '../shared/FormPrimitives'
import type { Section3Answers, ToolDetail } from '../types'
import { PREPOPULATED_TOOLS } from '../types'

type Props = {
  answers: Section3Answers
  isSaving: boolean
  onChange: (next: Section3Answers) => void
  onBack?: () => void
  onContinue: (final: Section3Answers) => Promise<void>
}

const PURPOSE_OPTIONS = [
  'Content creation / writing',
  'Customer communications',
  'Data analysis / reporting',
  'HR or recruitment tasks',
  'Financial operations',
  'Marketing / advertising',
  'Sales support',
  'Internal productivity / admin',
  'Software development',
  'Other',
]

const CUSTOMER_FACING_OPTIONS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Sometimes', label: 'Sometimes' },
]

export function Section03AiTools({ answers, isSaving, onChange, onBack, onContinue }: Props) {
  const [customToolInput, setCustomToolInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const tools = answers.tools ?? {}
  const customTools = answers.custom_tools ?? []
  const noAi = answers.no_ai_tools === true

  function patch(p: Partial<Section3Answers>) {
    onChange({ ...answers, ...p })
  }

  function toggleTool(name: string) {
    if (noAi) return
    const current = tools[name]?.selected ?? false
    const existing = tools[name]
    const nextDetail: ToolDetail = current
      ? { ...existing, selected: false }
      : { purposes: [], customer_facing: undefined, ...existing, selected: true }
    patch({ tools: { ...tools, [name]: nextDetail } })
  }

  function updateToolDetail(name: string, p: Partial<ToolDetail>) {
    const existing = tools[name] ?? { selected: true }
    patch({ tools: { ...tools, [name]: { ...existing, ...p } } })
  }

  function addCustomTool() {
    const trimmed = customToolInput.trim()
    if (!trimmed) return
    if (customTools.length >= 10) {
      setError('You can add up to 10 custom tools.')
      return
    }
    if ([...PREPOPULATED_TOOLS.map((t) => t.name), ...customTools].some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setError('That tool is already in the list.')
      return
    }
    setError(null)
    patch({
      custom_tools: [...customTools, trimmed],
      tools: { ...tools, [trimmed]: { selected: true, purposes: [] } },
    })
    setCustomToolInput('')
  }

  function removeCustomTool(name: string) {
    const nextTools = { ...tools }
    delete nextTools[name]
    patch({
      custom_tools: customTools.filter((t) => t !== name),
      tools: nextTools,
    })
  }

  function toggleNoAi() {
    if (!noAi) {
      // Switching to "no AI" — clear selections
      const cleared: Section3Answers['tools'] = {}
      patch({ no_ai_tools: true, tools: cleared, custom_tools: [] })
    } else {
      patch({ no_ai_tools: false })
    }
  }

  async function handleContinue() {
    const anySelected = noAi || Object.values(tools).some((t) => t.selected)
    if (!anySelected) {
      setError('Select at least one tool, or tick "We don\'t currently use any AI tools".')
      return
    }
    setError(null)
    await onContinue(answers)
  }

  const allTools = [
    ...PREPOPULATED_TOOLS.map((t) => ({ name: t.name, category: t.category, custom: false })),
    ...customTools.map((name) => ({ name, category: 'Custom tool', custom: true })),
  ]

  return (
    <>
      <SectionHeader
        eyebrow="Section 3 of 10"
        heading="Your AI tools"
        description="Select every AI tool your business currently uses, even if only by one person on one task. We need the full picture to document your AI footprint accurately."
      />

      <div className="qz-questions">
        <div>
          <div className="qz-tool-grid" style={noAi ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            {allTools.map((t) => {
              const selected = tools[t.name]?.selected ?? false
              return (
                <div
                  key={t.name}
                  role="checkbox"
                  aria-checked={selected}
                  tabIndex={0}
                  className={`qz-tool-card ${selected ? 'is-selected' : ''}`}
                  onClick={() => toggleTool(t.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleTool(t.name)
                    }
                  }}
                >
                  <div className="qz-tool-name">{t.name}</div>
                  <div className="qz-tool-category">{t.category}</div>
                  <span className={`qz-cbx ${selected ? 'is-selected' : ''}`} aria-hidden>
                    <CheckIcon />
                  </span>
                  {t.custom ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCustomTool(t.name)
                      }}
                      style={{
                        position: 'absolute', top: 14, left: 14, background: 'transparent',
                        border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0,
                      }}
                      aria-label={`Remove ${t.name}`}
                    >
                      remove
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {!noAi ? (
            <div className="qz-add-tool-row">
              <input
                className="qz-input"
                type="text"
                placeholder="Add a tool not on this list"
                value={customToolInput}
                onChange={(e) => setCustomToolInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomTool()
                  }
                }}
              />
              <button type="button" className="qz-btn qz-btn-ghost" onClick={addCustomTool}>
                Add
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className={`qz-radio-opt ${noAi ? 'is-selected' : ''}`}
            style={{ marginTop: 20 }}
            onClick={toggleNoAi}
            aria-pressed={noAi}
          >
            <span className={`qz-cbx ${noAi ? 'is-selected' : ''}`} aria-hidden>
              <CheckIcon />
            </span>
            <span className="qz-radio-opt-text">
              We don&apos;t currently use any AI tools
            </span>
          </button>

          {error ? <p className="qz-field-error" style={{ marginTop: 12 }}>{error}</p> : null}
        </div>

        {/* Per-tool follow-up panels */}
        {!noAi
          ? allTools
              .filter((t) => tools[t.name]?.selected)
              .map((t) => {
                const detail = tools[t.name] ?? { selected: true }
                return (
                  <div key={t.name} className="qz-tool-detail">
                    <div className="qz-tool-detail-title">{t.name}</div>
                    <FieldGroup label="What do you mainly use it for?">
                      <PillMultiSelect
                        options={PURPOSE_OPTIONS}
                        values={detail.purposes ?? []}
                        onChange={(v) => updateToolDetail(t.name, { purposes: v })}
                      />
                    </FieldGroup>
                    {(detail.purposes ?? []).includes('Other') ? (
                      <FieldGroup label="Describe other use">
                        <input
                          className="qz-input"
                          type="text"
                          value={detail.purpose_other ?? ''}
                          onChange={(e) => updateToolDetail(t.name, { purpose_other: e.target.value })}
                        />
                      </FieldGroup>
                    ) : null}
                    <FieldGroup
                      label="Is this tool used in any customer-facing interactions?"
                      micro="e.g. chatbot on your website, AI-written emails sent to customers"
                    >
                      <RadioGroup
                        name={`${t.name} customer facing`}
                        options={CUSTOMER_FACING_OPTIONS}
                        value={detail.customer_facing}
                        onChange={(v) => updateToolDetail(t.name, { customer_facing: v as ToolDetail['customer_facing'] })}
                      />
                    </FieldGroup>
                  </div>
                )
              })
          : null}
      </div>

      <NavButtons onBack={onBack} onContinue={handleContinue} isSaving={isSaving} />
    </>
  )
}
