'use client'

import { useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, PillMultiSelect } from '../shared/FormPrimitives'
import type { Section3Answers, Section4Answers } from '../types'

type Props = {
  answers: Section4Answers
  section3: Section3Answers
  isSaving: boolean
  onChange: (next: Section4Answers) => void
  onBack?: () => void
  onContinue: (final: Section4Answers) => Promise<void>
}

const DECISION_OPTIONS = [
  {
    value: 'Yes',
    label: 'Yes — AI output influences or makes these decisions',
  },
  {
    value: 'Partly',
    label: 'Partly — AI provides information, but humans always make the final call',
  },
  {
    value: 'No',
    label: 'No — AI is used only for internal tasks or content creation',
  },
]

const DECISION_CATEGORIES = [
  'Screening or ranking job applications',
  'Assessing creditworthiness or financial eligibility',
  'Deciding on insurance pricing or coverage',
  'Access to healthcare, benefits, or essential services',
  'Assessing students, candidates, or learners',
  'Customer profiling or targeted marketing',
  'Fraud or risk scoring',
  'Other',
]

const CUSTOMER_FACING = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
]

const CHANNELS = [
  'Website chatbot or live chat',
  'Email (AI-written messages sent to named individuals)',
  'Social media',
  'Phone / voice AI',
  'Mobile app',
  'Other',
]

const CHILDREN_OPTIONS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Possibly / not sure', label: 'Possibly / not sure' },
]

export function Section04HowAiUsed({
  answers,
  section3,
  isSaving,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  // If the user said "no AI tools", show only a forward CTA
  if (section3.no_ai_tools) {
    return (
      <>
        <SectionHeader
          eyebrow="Section 4 of 10"
          heading="How you use AI"
          description="We need to understand the role AI plays in your operations — particularly whether it touches decisions that affect people."
        />
        <div className="qz-reveal" style={{ marginTop: 24 }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            You indicated you don&apos;t currently use AI tools — skip ahead to Section 6.
          </p>
        </div>
        <NavButtons
          onBack={onBack}
          onContinue={() => onContinue(answers)}
          continueLabel="Continue →"
          isSaving={isSaving}
        />
      </>
    )
  }

  function patch(p: Partial<Section4Answers>) {
    onChange({ ...answers, ...p })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!answers.ai_decision_making) e.ai_decision_making = 'Required'
    if (
      (answers.ai_decision_making === 'Yes' || answers.ai_decision_making === 'Partly') &&
      (!answers.ai_decision_categories || answers.ai_decision_categories.length === 0)
    ) {
      e.ai_decision_categories = 'Select at least one'
    }
    if (!answers.ai_customer_facing) e.ai_customer_facing = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleContinue() {
    if (!validate()) return
    await onContinue(answers)
  }

  const showCategories = answers.ai_decision_making === 'Yes' || answers.ai_decision_making === 'Partly'
  const showChannels = answers.ai_customer_facing === 'Yes'

  return (
    <>
      <SectionHeader
        eyebrow="Section 4 of 10"
        heading="How you use AI"
        description="We need to understand the role AI plays in your operations — particularly whether it touches decisions that affect people."
      />
      <div className="qz-questions">
        <FieldGroup
          label="Does AI ever inform or contribute to decisions about individual people?"
          helpTitle="What counts as an AI-assisted decision?"
          helpText="If your AI tool scores job applicants, generates credit recommendations, filters customer enquiries, or profiles people in any way that affects what they receive — that's a decision. It doesn't have to be automatic. If AI output influences what a human then decides, it still counts."
          micro="e.g. screening job applicants, scoring creditworthiness, deciding on insurance, marketing profiling. This is critical for Article 22 UK GDPR and EU AI Act Annex III. Answer carefully."
          required
          error={errors.ai_decision_making}
        >
          <RadioGroup
            name="AI decision making"
            options={DECISION_OPTIONS}
            value={answers.ai_decision_making}
            onChange={(v) => patch({ ai_decision_making: v as Section4Answers['ai_decision_making'] })}
          />
        </FieldGroup>

        {showCategories ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup
              label="What kinds of decisions does AI contribute to?"
              helpTitle="What are Annex III high-risk categories?"
              helpText="The EU AI Act lists specific types of AI use that carry higher risk — mainly where AI affects people's access to employment, credit, education, healthcare, or benefits. If your AI does any of these things, stricter documentation rules apply."
              micro="The first five categories trigger EU AI Act high-risk classification under Annex III."
              required
              error={errors.ai_decision_categories}
            >
              <PillMultiSelect
                options={DECISION_CATEGORIES}
                values={answers.ai_decision_categories ?? []}
                onChange={(v) => patch({ ai_decision_categories: v })}
              />
            </FieldGroup>
            {(answers.ai_decision_categories ?? []).includes('Other') ? (
              <FieldGroup label="Describe">
                <input
                  className="qz-input"
                  type="text"
                  value={answers.ai_decision_categories_other ?? ''}
                  onChange={(e) => patch({ ai_decision_categories_other: e.target.value })}
                />
              </FieldGroup>
            ) : null}
          </div>
        ) : null}

        <FieldGroup
          label="Do any of your AI tools interact directly with customers or members of the public?"
          micro="e.g. chatbots, AI-generated emails addressed to specific individuals, AI phone systems"
          required
          error={errors.ai_customer_facing}
        >
          <RadioGroup
            name="AI customer facing"
            options={CUSTOMER_FACING}
            value={answers.ai_customer_facing}
            onChange={(v) => patch({ ai_customer_facing: v as Section4Answers['ai_customer_facing'] })}
          />
        </FieldGroup>

        {showChannels ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup label="Which channels does customer-facing AI operate in?">
              <PillMultiSelect
                options={CHANNELS}
                values={answers.ai_customer_channels ?? []}
                onChange={(v) => patch({ ai_customer_channels: v })}
              />
            </FieldGroup>
            {(answers.ai_customer_channels ?? []).includes('Other') ? (
              <FieldGroup label="Describe other channel">
                <input
                  className="qz-input"
                  type="text"
                  value={answers.ai_customer_channels_other ?? ''}
                  onChange={(e) => patch({ ai_customer_channels_other: e.target.value })}
                />
              </FieldGroup>
            ) : null}
          </div>
        ) : null}

        <FieldGroup
          label="Do any AI tools process content that includes the personal data of children under 18?"
          micro="Even if children aren't your target audience, some products (e.g. education, family services) inevitably involve minors' data."
        >
          <RadioGroup
            name="AI children data"
            options={CHILDREN_OPTIONS}
            value={answers.ai_children_data}
            onChange={(v) => patch({ ai_children_data: v as Section4Answers['ai_children_data'] })}
          />
        </FieldGroup>
      </div>

      <NavButtons onBack={onBack} onContinue={handleContinue} isSaving={isSaving} />
    </>
  )
}
