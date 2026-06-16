'use client'

import { useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import type { RawAnswers } from '../types'
import { SECTION_NAMES, SPECIAL_CATEGORY_CHIPS } from '../types'

type Props = {
  answers: RawAnswers
  completedSections: Set<number>
  isSaving: boolean
  onBack?: () => void
  onEdit: (section: number) => void
  onSubmit: (s10: { declaration_accepted: boolean }) => Promise<void>
}

const REQUIRED_SECTIONS = [1, 2, 3]

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.join(', ')
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, val]) => val !== undefined && val !== '')
    if (entries.length === 0) return '—'
    return entries.map(([k, val]) => `${k}: ${fmt(val)}`).join('; ')
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function summarise(section: number, answers: RawAnswers): Array<[string, string]> {
  switch (section) {
    case 1: {
      const a = answers['1'] ?? {}
      return [
        ['Company name', fmt(a.company_name)],
        ['Trading name', fmt(a.trading_name)],
        ['Companies House', fmt(a.company_number)],
        ['Sector', fmt(a.sector === 'Other (specify)' ? a.sector_other : a.sector)],
        ['Employees', fmt(a.employee_count)],
        ['Logo uploaded', a.logo_url ? 'Yes' : 'No'],
      ]
    }
    case 2: {
      const a = answers['2'] ?? {}
      return [
        ['Customer geography', fmt(a.customer_geography)],
        ['EU proportion', fmt(a.eu_customer_proportion)],
        ['Customer type', fmt(a.customer_type)],
        ['Customer sectors', fmt(a.customer_sectors)],
      ]
    }
    case 3: {
      const a = answers['3'] ?? {}
      if (a.no_ai_tools) return [['AI tools', 'None — no AI in use']]
      const selectedTools = Object.entries(a.tools ?? {})
        .filter(([, d]) => d.selected)
        .map(([n]) => n)
      return [
        ['Tools in use', fmt(selectedTools)],
        ['Custom tools', fmt(a.custom_tools)],
      ]
    }
    case 4: {
      const a = answers['4'] ?? {}
      return [
        ['AI in decisions', fmt(a.ai_decision_making)],
        ['Decision categories', fmt(a.ai_decision_categories)],
        ['Customer-facing AI', fmt(a.ai_customer_facing)],
        ['Channels', fmt(a.ai_customer_channels)],
        ["Children's data", fmt(a.ai_children_data)],
      ]
    }
    case 5: {
      const a = answers['5'] ?? {}
      return [
        ['Current disclosure', fmt(a.current_ai_disclosure)],
        ['Opt-out mechanism', fmt(a.ai_opt_out_mechanism)],
      ]
    }
    case 6: {
      const a = answers['6'] ?? {}
      return [
        ['Data categories', fmt(a.data_categories)],
        ['Special-category basis', fmt(a.special_category_basis)],
        ['Vendors documented', fmt((a.vendors ?? []).map((v) => v.vendor_name))],
      ]
    }
    case 7: {
      const a = answers['7'] ?? {}
      return [
        ['Governance owner', fmt(a.governance_owner)],
        ['RoPA', fmt(a.has_ropa)],
        ['DPIA', fmt(a.has_dpia)],
        ['AI policy', fmt(a.has_ai_policy)],
        ['Certifications', fmt(a.certifications)],
      ]
    }
    case 8: {
      const a = answers['8'] ?? {}
      return [
        ['Complaints procedure', fmt(a.has_complaints_procedure)],
        ['Past complaints', fmt(a.has_past_complaints)],
        ['ICO contact', fmt(a.ico_contact)],
      ]
    }
    case 9: {
      const a = answers['9'] ?? {}
      return [
        ['Purchase reason', fmt(a.purchase_reason === 'other' ? a.purchase_reason_other : a.purchase_reason)],
        ['Procurement context', fmt(a.procurement_context)],
        ['Additional notes', fmt(a.additional_context)],
      ]
    }
    default:
      return []
  }
}

function estimateRiskBand(answers: RawAnswers): 48 | 72 {
  const s4 = answers['4']
  const s6 = answers['6']
  const s2 = answers['2']
  const decisionRisk = s4?.ai_decision_making === 'Yes' || s4?.ai_decision_making === 'Partly'
  const specialData = (s6?.data_categories ?? []).some((c) => SPECIAL_CATEGORY_CHIPS.has(c))
  const eu = s2?.customer_geography === 'uk_eu' || s2?.customer_geography === 'uk_eu_row'
  if (decisionRisk && specialData && eu) return 72
  return 48
}

export function Section10ReviewSubmit({
  answers,
  completedSections,
  isSaving,
  onBack,
  onEdit,
  onSubmit,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [accepted, setAccepted] = useState<boolean>(false)
  const riskBand = estimateRiskBand(answers)
  const missingSections = REQUIRED_SECTIONS.filter((n) => !completedSections.has(n))
  const canSubmit = accepted && missingSections.length === 0

  return (
    <>
      <SectionHeader
        eyebrow="Section 10 of 10"
        heading="Review and submit"
        description="Take a moment to check your answers before we start building your pack."
      />

      <div className="qz-questions">
        <div>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
            const rows = summarise(n, answers)
            const isOpen = expanded === n
            return (
              <div key={n}>
                <button
                  type="button"
                  className="qz-review-row"
                  onClick={() => setExpanded(isOpen ? null : n)}
                  aria-expanded={isOpen}
                >
                  <span className="qz-review-num">{n}</span>
                  <span className="qz-review-name">{SECTION_NAMES[n]}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="qz-review-edit"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(n)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        onEdit(n)
                      }
                    }}
                  >
                    Go back to edit
                  </span>
                </button>
                {isOpen ? (
                  <div className="qz-review-body">
                    <table className="qz-answer-table">
                      <tbody>
                        {rows.map(([k, v]) => (
                          <tr key={k}>
                            <td className="k">{k}</td>
                            <td className="v">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="qz-reveal">
          <div className="qz-reveal-eyebrow">Estimated delivery</div>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Based on your answers, your pack should be ready within{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {riskBand === 48 ? '48 hours' : '72 hours'}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          className={`qz-confirm-row ${accepted ? 'is-checked' : ''}`}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
          onClick={() => setAccepted(!accepted)}
          aria-pressed={accepted}
        >
          <span className={`qz-cbx ${accepted ? 'is-selected' : ''}`} aria-hidden>
            <svg className="qz-cbx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="qz-confirm-label">
            I confirm the information I&apos;ve provided is accurate to the best of my knowledge. I
            understand that Readypack will use this information solely to generate my compliance
            documentation pack, and that the documents produced are templates based on my answers
            — not legal advice.
          </span>
        </button>
      </div>

      {missingSections.length > 0 ? (
        <div
          className="qz-reveal"
          style={{
            borderColor: 'var(--warning)',
            background: 'rgba(202, 138, 4, 0.06)',
            marginTop: 24,
          }}
        >
          <div className="qz-reveal-eyebrow" style={{ color: 'var(--warning)' }}>
            Complete before submitting
          </div>
          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--text-secondary)',
              fontSize: 'var(--body-sm)',
            }}
          >
            The following sections need to be saved before you can submit:
          </p>
          <ul
            style={{
              margin: '8px 0 0',
              paddingLeft: 20,
              color: 'var(--text-secondary)',
              fontSize: 'var(--body-sm)',
            }}
          >
            {missingSections.map((n) => (
              <li key={n} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => onEdit(n)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'inherit',
                    fontSize: 'var(--body-sm)',
                    fontWeight: 600,
                  }}
                >
                  Section {n}: {SECTION_NAMES[n]} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="qz-nav-buttons">
        <button
          type="button"
          className="qz-btn qz-btn-ghost"
          onClick={onBack}
          disabled={!onBack || isSaving}
        >
          Back
        </button>
        <button
          type="button"
          className="qz-btn qz-btn-primary qz-btn-lg"
          onClick={() => onSubmit({ declaration_accepted: true })}
          disabled={!canSubmit || isSaving}
        >
          {isSaving ? 'Submitting…' : 'Submit and build my pack →'}
        </button>
      </div>
    </>
  )
}
