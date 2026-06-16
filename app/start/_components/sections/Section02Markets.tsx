'use client'

import { useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, PillMultiSelect } from '../shared/FormPrimitives'
import type { Section2Answers } from '../types'

type Props = {
  answers: Section2Answers
  isSaving: boolean
  onChange: (next: Section2Answers) => void
  onBack?: () => void
  onContinue: (final: Section2Answers) => Promise<void>
}

const GEOGRAPHY = [
  { value: 'uk_only', label: 'UK only' },
  { value: 'uk_eu', label: 'UK and EU / EEA' },
  { value: 'uk_row', label: 'UK and rest of world (non-EU)' },
  { value: 'uk_eu_row', label: 'UK, EU, and rest of world' },
]

const PROPORTION = [
  { value: '<10', label: 'Less than 10%' },
  { value: '10-25', label: '10–25%' },
  { value: '25-50', label: '25–50%' },
  { value: '>50', label: 'More than 50%' },
]

const CUSTOMER_TYPE = [
  { value: 'b2c', label: 'Consumers only (B2C)' },
  { value: 'b2b', label: 'Businesses only (B2B)' },
  { value: 'b2b_b2c', label: 'Both businesses and consumers (B2B and B2C)' },
]

const SECTORS = [
  'Healthcare', 'Financial services', 'Education', 'Recruitment', 'Legal',
  'Government / public sector', 'Retail', 'Technology', 'Professional services', 'Other',
]

function isEuSelected(geo: string | undefined): boolean {
  return geo === 'uk_eu' || geo === 'uk_eu_row'
}

export function Section02Markets({ answers, isSaving, onChange, onBack, onContinue }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function patch(p: Partial<Section2Answers>) {
    onChange({ ...answers, ...p })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!answers.customer_geography) e.customer_geography = 'Required'
    if (isEuSelected(answers.customer_geography) && !answers.eu_customer_proportion) {
      e.eu_customer_proportion = 'Required'
    }
    if (!answers.customer_type) e.customer_type = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleContinue() {
    if (!validate()) return
    await onContinue(answers)
  }

  return (
    <>
      <SectionHeader
        eyebrow="Section 2 of 10"
        heading="Your markets and customers"
        description="This helps us identify which regulatory frameworks apply to your business."
      />
      <div className="qz-questions">
        <FieldGroup label="Where are your customers based?" required error={errors.customer_geography}>
          <RadioGroup
            name="Customer geography"
            options={GEOGRAPHY}
            value={answers.customer_geography}
            onChange={(v) => patch({ customer_geography: v })}
          />
        </FieldGroup>

        {isEuSelected(answers.customer_geography) ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Based on your answer</div>
            <FieldGroup
              label="Roughly what proportion of your customers are in the EU or EEA?"
              helpTitle="Why does EU proportion matter?"
              helpText="The EU AI Act applies to UK businesses if they use AI to interact with people in the EU — even as a small proportion of customers. Knowing your EU proportion helps us work out whether the EU Act's rules apply to you."
              micro="Even a small EU customer proportion can trigger EU AI Act obligations for some use cases. We'll flag this in your documents."
              required
              error={errors.eu_customer_proportion}
            >
              <RadioGroup
                name="EU proportion"
                options={PROPORTION}
                value={answers.eu_customer_proportion}
                onChange={(v) => patch({ eu_customer_proportion: v })}
              />
            </FieldGroup>
          </div>
        ) : null}

        <FieldGroup
          label="Do you sell to consumers, businesses, or both?"
          required
          error={errors.customer_type}
        >
          <RadioGroup
            name="Customer type"
            options={CUSTOMER_TYPE}
            value={answers.customer_type}
            onChange={(v) => patch({ customer_type: v })}
          />
        </FieldGroup>

        <FieldGroup
          label="Which sectors do your customers primarily operate in?"
          micro="If your customers are in regulated sectors, their procurement questions will be more demanding. We'll make sure your documents can answer them."
        >
          <PillMultiSelect
            options={SECTORS}
            values={answers.customer_sectors ?? []}
            onChange={(v) => patch({ customer_sectors: v })}
          />
        </FieldGroup>
      </div>

      <NavButtons
        onBack={onBack}
        onContinue={handleContinue}
        isSaving={isSaving}
      />
    </>
  )
}
