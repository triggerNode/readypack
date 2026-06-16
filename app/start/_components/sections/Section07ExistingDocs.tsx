'use client'

import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, PillMultiSelect } from '../shared/FormPrimitives'
import type { Section7Answers } from '../types'

type Props = {
  answers: Section7Answers
  isSaving: boolean
  onChange: (next: Section7Answers) => void
  onBack?: () => void
  onContinue: (final: Section7Answers) => Promise<void>
}

const OWNER = [
  { value: 'dpo', label: 'Yes — dedicated DPO (Data Protection Officer)' },
  { value: 'internal_owner', label: 'Yes — an internal owner (not a formal DPO)' },
  { value: 'none', label: 'No — no one is formally responsible' },
]

const YES_NO_NOT_SURE = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Not sure', label: 'Not sure' },
]

const DPIA = [
  { value: 'Yes', label: 'Yes (at least one)' },
  { value: 'No', label: 'No' },
  { value: 'In progress', label: 'In progress' },
]

const POLICY = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'In progress', label: 'In progress' },
]

const CERTS = [
  'ISO 27001', 'Cyber Essentials', 'Cyber Essentials Plus', 'SOC 2', 'IASME', 'NHS DSPT', 'None of these',
]

export function Section07ExistingDocs({ answers, isSaving, onChange, onBack, onContinue }: Props) {
  function patch(p: Partial<Section7Answers>) {
    onChange({ ...answers, ...p })
  }
  function patchContact(p: Partial<NonNullable<Section7Answers['governance_contact']>>) {
    onChange({
      ...answers,
      governance_contact: { ...(answers.governance_contact ?? {}), ...p },
    })
  }

  const showContact = answers.governance_owner === 'dpo' || answers.governance_owner === 'internal_owner'

  return (
    <>
      <SectionHeader
        eyebrow="Section 7 of 10"
        heading="What you already have"
        description="Understanding your existing documentation lets us fill the gaps rather than duplicate what's already in place."
      />
      <div className="qz-questions">
        <FieldGroup label="Do you have a named person responsible for data protection / AI governance?">
          <RadioGroup
            name="Governance owner"
            options={OWNER}
            value={answers.governance_owner}
            onChange={(v) => patch({ governance_owner: v })}
          />
        </FieldGroup>

        {showContact ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Contact details</div>
            <FieldGroup label="Who should be named in your documents as the AI / data governance contact?">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  className="qz-input"
                  type="text"
                  placeholder="Name"
                  value={answers.governance_contact?.name ?? ''}
                  onChange={(e) => patchContact({ name: e.target.value })}
                />
                <input
                  className="qz-input"
                  type="text"
                  placeholder="Job title"
                  value={answers.governance_contact?.job_title ?? ''}
                  onChange={(e) => patchContact({ job_title: e.target.value })}
                />
                <input
                  className="qz-input"
                  type="email"
                  placeholder="Email"
                  value={answers.governance_contact?.email ?? ''}
                  onChange={(e) => patchContact({ email: e.target.value })}
                />
              </div>
            </FieldGroup>
          </div>
        ) : null}

        <FieldGroup
          label="Do you have an existing Records of Processing Activities (RoPA)?"
          helpTitle="What is a RoPA?"
          helpText="A Record of Processing Activities (RoPA) is an internal document that lists all the personal data your organisation handles — what data, why, who sees it, and how long you keep it. Most businesses under 250 employees are technically required to maintain one if they process personal data regularly."
        >
          <RadioGroup
            name="Has RoPA"
            options={YES_NO_NOT_SURE}
            value={answers.has_ropa}
            onChange={(v) => patch({ has_ropa: v })}
          />
        </FieldGroup>

        <FieldGroup
          label="Have you conducted any Data Protection Impact Assessments (DPIAs) for your AI tools?"
          helpTitle="What is a DPIA?"
          helpText="A Data Protection Impact Assessment (DPIA) is a structured analysis you run when introducing a new high-risk data processing activity — like a new AI tool that handles sensitive information. It helps you identify and reduce risks before they become problems."
        >
          <RadioGroup
            name="Has DPIA"
            options={DPIA}
            value={answers.has_dpia}
            onChange={(v) => patch({ has_dpia: v })}
          />
        </FieldGroup>

        <FieldGroup label="Do you have an internal AI use policy?">
          <RadioGroup
            name="Has AI policy"
            options={POLICY}
            value={answers.has_ai_policy}
            onChange={(v) => patch({ has_ai_policy: v })}
          />
        </FieldGroup>

        <FieldGroup label="What certifications does your business hold?">
          <PillMultiSelect
            options={CERTS}
            values={answers.certifications ?? []}
            onChange={(v) => patch({ certifications: v })}
          />
        </FieldGroup>
      </div>

      <NavButtons onBack={onBack} onContinue={() => onContinue(answers)} isSaving={isSaving} />
    </>
  )
}
