'use client'

import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup } from '../shared/FormPrimitives'
import type { Section8Answers } from '../types'

type Props = {
  answers: Section8Answers
  isSaving: boolean
  onChange: (next: Section8Answers) => void
  onBack?: () => void
  onContinue: (final: Section8Answers) => Promise<void>
}

const PROCEDURE = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Informal', label: 'Informal process (nothing written down)' },
]

const PAST_COMPLAINTS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
]

const ICO_CONTACT = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Not to my knowledge', label: 'Not to my knowledge' },
]

const ICO_TYPE = [
  { value: 'Routine enquiry', label: 'Routine enquiry' },
  { value: 'Investigation or audit', label: 'Investigation or audit' },
  { value: 'Enforcement action or reprimand', label: 'Enforcement action or reprimand' },
  { value: 'Prefer not to say', label: "I'd prefer not to say" },
]

export function Section08Complaints({ answers, isSaving, onChange, onBack, onContinue }: Props) {
  function patch(p: Partial<Section8Answers>) {
    onChange({ ...answers, ...p })
  }

  const showPastDetail = answers.has_past_complaints === 'Yes'
  const showIcoType = answers.ico_contact === 'Yes'

  return (
    <>
      <SectionHeader
        eyebrow="Section 8 of 10"
        heading="Complaints and incidents"
        description="The DUAA 2025 (Section 103) requires a structured complaints procedure from 19 June 2026. We'll build one that meets the statutory requirements."
      />
      <div className="qz-questions">
        <FieldGroup
          label="Do you currently have a documented complaints procedure for data-related complaints?"
          helpTitle="What is required from June 2026?"
          helpText="The Data Use and Access Act (Section 103, in force 19 June 2026) requires all businesses to have a process for handling data-related complaints. You must acknowledge within 30 days and investigate properly before a customer can go to the ICO. Readypack will build this procedure document for you."
        >
          <RadioGroup
            name="Procedure"
            options={PROCEDURE}
            value={answers.has_complaints_procedure}
            onChange={(v) => patch({ has_complaints_procedure: v })}
          />
        </FieldGroup>

        <FieldGroup label="Has your business had any complaints, subject access requests, or data incidents involving AI in the last 24 months?">
          <RadioGroup
            name="Past complaints"
            options={PAST_COMPLAINTS}
            value={answers.has_past_complaints}
            onChange={(v) => patch({ has_past_complaints: v })}
          />
        </FieldGroup>

        {showPastDetail ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup
              label="Briefly describe the nature of the complaint or incident"
              micro="This stays confidential and helps us tailor your Complaints Procedure Pack. Do not include names or contact details of complainants."
            >
              <textarea
                className="qz-textarea"
                value={answers.past_complaint_detail ?? ''}
                onChange={(e) => patch({ past_complaint_detail: e.target.value })}
              />
            </FieldGroup>
          </div>
        ) : null}

        <FieldGroup label="Has your business ever been contacted by the ICO (Information Commissioner's Office)?">
          <RadioGroup
            name="ICO contact"
            options={ICO_CONTACT}
            value={answers.ico_contact}
            onChange={(v) => patch({ ico_contact: v })}
          />
        </FieldGroup>

        {showIcoType ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Follow-up</div>
            <FieldGroup label="What was the nature of the contact?">
              <RadioGroup
                name="ICO type"
                options={ICO_TYPE}
                value={answers.ico_contact_type}
                onChange={(v) => patch({ ico_contact_type: v })}
              />
            </FieldGroup>
          </div>
        ) : null}
      </div>

      <NavButtons onBack={onBack} onContinue={() => onContinue(answers)} isSaving={isSaving} />
    </>
  )
}
