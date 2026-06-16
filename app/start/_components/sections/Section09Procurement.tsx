'use client'

import { useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup } from '../shared/FormPrimitives'
import type { Section9Answers } from '../types'

type Props = {
  answers: Section9Answers
  isSaving: boolean
  onChange: (next: Section9Answers) => void
  onBack?: () => void
  onContinue: (final: Section9Answers) => Promise<void>
}

const PURCHASE_REASON = [
  { value: 'client_partner', label: 'A client or partner is asking us to demonstrate AI / data governance compliance' },
  { value: 'procurement_bid', label: 'We have an active procurement bid or tender that requires it' },
  { value: 'ico_regulator', label: 'We received contact from the ICO or a regulator' },
  { value: 'proactive', label: 'We want to be proactive ahead of the regulatory deadlines' },
  { value: 'other', label: 'Other' },
]

const MAX_CONTEXT = 500

export function Section09Procurement({ answers, isSaving, onChange, onBack, onContinue }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function patch(p: Partial<Section9Answers>) {
    onChange({ ...answers, ...p })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!answers.purchase_reason) e.purchase_reason = 'Required'
    if (answers.purchase_reason === 'other' && !answers.purchase_reason_other?.trim()) {
      e.purchase_reason_other = 'Please describe'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleContinue() {
    if (!validate()) return
    await onContinue(answers)
  }

  const showProcurementContext = answers.purchase_reason === 'procurement_bid'
  const showPolicyOwner =
    answers.purchase_reason === 'procurement_bid' || answers.purchase_reason === 'client_partner'
  const additional = answers.additional_context ?? ''

  return (
    <>
      <SectionHeader
        eyebrow="Section 9 of 10"
        heading="Procurement and business context"
        description="Understanding what prompted this purchase helps us build the right documents for your situation."
      />
      <div className="qz-questions">
        <FieldGroup
          label="What is the primary reason you're getting your compliance documentation in order?"
          required
          error={errors.purchase_reason}
        >
          <RadioGroup
            name="Purchase reason"
            options={PURCHASE_REASON}
            value={answers.purchase_reason}
            onChange={(v) => patch({ purchase_reason: v })}
          />
        </FieldGroup>

        {answers.purchase_reason === 'other' ? (
          <FieldGroup label="Tell us more" required error={errors.purchase_reason_other}>
            <input
              className="qz-input"
              type="text"
              value={answers.purchase_reason_other ?? ''}
              onChange={(e) => patch({ purchase_reason_other: e.target.value })}
            />
          </FieldGroup>
        ) : null}

        {showProcurementContext ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Procurement context</div>
            <FieldGroup
              label="Tell us about the procurement requirement"
              micro="We'll reference this in your Procurement Response Memo to help you answer enterprise security questionnaires quickly."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  className="qz-input"
                  type="text"
                  placeholder="Client or tender name (optional)"
                  value={answers.procurement_context?.client_name ?? ''}
                  onChange={(e) =>
                    patch({
                      procurement_context: {
                        ...(answers.procurement_context ?? {}),
                        client_name: e.target.value,
                      },
                    })
                  }
                />
                <input
                  className="qz-input"
                  type="date"
                  value={answers.procurement_context?.deadline ?? ''}
                  onChange={(e) =>
                    patch({
                      procurement_context: {
                        ...(answers.procurement_context ?? {}),
                        deadline: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </FieldGroup>
          </div>
        ) : null}

        {showPolicyOwner ? (
          <FieldGroup
            label="Who should be named as the AI/data policy owner in procurement responses?"
            micro="Optional — defaults to the governance contact from Section 7 if provided."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="qz-input"
                type="text"
                placeholder="Name"
                value={answers.procurement_policy_owner?.name ?? ''}
                onChange={(e) =>
                  patch({
                    procurement_policy_owner: {
                      ...(answers.procurement_policy_owner ?? {}),
                      name: e.target.value,
                    },
                  })
                }
              />
              <input
                className="qz-input"
                type="text"
                placeholder="Job title"
                value={answers.procurement_policy_owner?.job_title ?? ''}
                onChange={(e) =>
                  patch({
                    procurement_policy_owner: {
                      ...(answers.procurement_policy_owner ?? {}),
                      job_title: e.target.value,
                    },
                  })
                }
              />
            </div>
          </FieldGroup>
        ) : null}

        <FieldGroup
          label="Is there anything else about your situation you'd like us to know?"
          micro="For example: a specific client questionnaire you're trying to answer, a compliance audit coming up, or anything else that gives us context."
        >
          <textarea
            className="qz-textarea"
            maxLength={MAX_CONTEXT}
            value={additional}
            onChange={(e) => patch({ additional_context: e.target.value })}
          />
          <p className="qz-field-micro" style={{ textAlign: 'right', marginTop: 4 }}>
            {additional.length} / {MAX_CONTEXT}
          </p>
        </FieldGroup>
      </div>

      <NavButtons onBack={onBack} onContinue={handleContinue} isSaving={isSaving} />
    </>
  )
}
