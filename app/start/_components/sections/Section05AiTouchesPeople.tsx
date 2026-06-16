'use client'

import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup } from '../shared/FormPrimitives'
import type { Section4Answers, Section5Answers } from '../types'

type Props = {
  answers: Section5Answers
  section4: Section4Answers
  isSaving: boolean
  onChange: (next: Section5Answers) => void
  onBack?: () => void
  onContinue: (final: Section5Answers) => Promise<void>
}

const DISCLOSURE = [
  { value: 'Yes', label: 'Yes — we inform customers when/how AI is used' },
  { value: 'Partial', label: "Partial — we mention it but it's not comprehensive" },
  { value: 'No', label: "No — we don't currently disclose AI use to customers" },
]

const OPT_OUT = [
  { value: 'Yes', label: 'Yes — we offer this' },
  { value: 'No', label: "No — we don't currently offer this" },
  { value: 'N/A', label: 'Not applicable' },
]

export function Section05AiTouchesPeople({
  answers,
  section4,
  isSaving,
  onChange,
  onBack,
  onContinue,
}: Props) {
  // Conditional — if no customer-facing AI, show skip CTA
  if (section4.ai_customer_facing !== 'Yes') {
    return (
      <>
        <SectionHeader
          eyebrow="Section 5 of 10"
          heading="AI and your customers"
          description="If AI interacts with or affects your customers, we need to document how you disclose this and how they can object."
        />
        <div className="qz-reveal" style={{ marginTop: 24 }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            You indicated AI doesn&apos;t interact directly with customers — no disclosure
            obligations apply here. Skip to Section 6.
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

  function patch(p: Partial<Section5Answers>) {
    onChange({ ...answers, ...p })
  }

  const showDisclosureWording =
    answers.current_ai_disclosure === 'Yes' || answers.current_ai_disclosure === 'Partial'
  const showOptOutMethod = answers.ai_opt_out_mechanism === 'Yes'

  return (
    <>
      <SectionHeader
        eyebrow="Section 5 of 10"
        heading="AI and your customers"
        description="If AI interacts with or affects your customers, we need to document how you disclose this and how they can object."
      />
      <div className="qz-questions">
        <FieldGroup
          label="Do you currently have any customer-facing disclosure about your use of AI?"
          helpTitle="What is an AI disclosure?"
          helpText="UK data law (GDPR Article 13) says you must tell people when you're using automated processing that affects them. A disclosure is simply a statement — in your terms, privacy notice, or website — that explains you use AI and what it does."
        >
          <RadioGroup
            name="Current disclosure"
            options={DISCLOSURE}
            value={answers.current_ai_disclosure}
            onChange={(v) => patch({ current_ai_disclosure: v })}
          />
        </FieldGroup>

        {showDisclosureWording ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup
              label="Where and how do you currently disclose AI use?"
              micro="Paste any existing disclosure wording here. We'll use it when building your Customer Disclosure Snippets document."
            >
              <textarea
                className="qz-textarea"
                placeholder={'e.g. "We include a line in our terms of service. Our chatbot has a banner saying it\'s AI-powered."'}
                value={answers.current_disclosure_wording ?? ''}
                onChange={(e) => patch({ current_disclosure_wording: e.target.value })}
              />
            </FieldGroup>
          </div>
        ) : null}

        <FieldGroup label="Do customers have a way to opt out of AI processing or request a human instead?">
          <RadioGroup
            name="AI opt-out"
            options={OPT_OUT}
            value={answers.ai_opt_out_mechanism}
            onChange={(v) => patch({ ai_opt_out_mechanism: v })}
          />
        </FieldGroup>

        {showOptOutMethod ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup label="How can customers opt out or request a human?">
              <textarea
                className="qz-textarea"
                value={answers.ai_opt_out_method ?? ''}
                onChange={(e) => patch({ ai_opt_out_method: e.target.value })}
              />
            </FieldGroup>
          </div>
        ) : null}
      </div>

      <NavButtons onBack={onBack} onContinue={() => onContinue(answers)} isSaving={isSaving} />
    </>
  )
}
