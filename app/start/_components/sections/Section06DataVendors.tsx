'use client'

import { useEffect, useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, PillMultiSelect, Select } from '../shared/FormPrimitives'
import { HelpPopover } from '../shared/HelpPopover'
import type { Section3Answers, Section6Answers, VendorDetail } from '../types'
import { SPECIAL_CATEGORY_CHIPS } from '../types'

type Props = {
  answers: Section6Answers
  section3: Section3Answers
  isSaving: boolean
  onChange: (next: Section6Answers) => void
  onBack?: () => void
  onContinue: (final: Section6Answers) => Promise<void>
}

const DATA_CATEGORIES = [
  'Names and contact details',
  'Job applications or CVs',
  'Financial information',
  'Browsing or behavioural data',
  'Location data',
  'Employment or performance records',
  'Health or medical information',
  'Biometric data (e.g. face recognition, fingerprints)',
  'Ethnic or racial data',
  'Political or religious opinions',
  'Sexual orientation or gender identity',
  "Children's data",
  'None — AI tools do not process personal data',
]

const SPECIAL_BASIS = [
  { value: 'consent', label: 'Explicit consent from the individual' },
  { value: 'substantial_public', label: 'Substantial public interest (specify)' },
  { value: 'employment_law', label: 'Necessary for employment law obligations' },
  { value: 'vital_interests', label: 'Vital interests (emergency, life-threatening)' },
  { value: 'other_unsure', label: 'Other / not sure' },
]

const HQ_LOCATIONS = ['UK', 'EU/EEA', 'USA', 'Other (specify)']

const DPA_OPTIONS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Not sure', label: 'Not sure' },
]

const TRANSFER_MECH = [
  'Standard Contractual Clauses (SCCs)',
  'Adequacy decision',
  'Binding Corporate Rules',
  'Not applicable',
  'Not sure / need to check',
]

const TRAINING_REUSE = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Not sure', label: 'Not sure' },
  { value: 'Opt-out available', label: 'Opt-out available' },
]

const CERTS = ['ISO 27001', 'SOC 2 Type II', 'Cyber Essentials', 'UK DSPT', 'None / Don\'t know']

export function Section06DataVendors({
  answers,
  section3,
  isSaving,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pre-populate vendors from selected tools on first mount when none exist
  useEffect(() => {
    if (answers.vendors !== undefined) return
    if (section3.no_ai_tools) {
      onChange({ ...answers, vendors: [] })
      return
    }
    const selectedTools = Object.entries(section3.tools ?? {})
      .filter(([, d]) => d.selected)
      .map(([name]) => name)
    if (selectedTools.length === 0) {
      onChange({ ...answers, vendors: [] })
      return
    }
    const vendors: VendorDetail[] = selectedTools.map((name) => ({ vendor_name: name }))
    onChange({ ...answers, vendors })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function patch(p: Partial<Section6Answers>) {
    onChange({ ...answers, ...p })
  }

  function updateVendor(idx: number, p: Partial<VendorDetail>) {
    const vendors = [...(answers.vendors ?? [])]
    vendors[idx] = { ...vendors[idx], ...p }
    patch({ vendors })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!answers.data_categories || answers.data_categories.length === 0) {
      e.data_categories = 'Select at least one (or "None")'
    }
    const specialSelected = (answers.data_categories ?? []).some((c) => SPECIAL_CATEGORY_CHIPS.has(c))
    if (specialSelected && !answers.special_category_basis) {
      e.special_category_basis = 'Required for special-category data'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleContinue() {
    if (!validate()) return
    await onContinue(answers)
  }

  const showSpecialBasis = (answers.data_categories ?? []).some((c) => SPECIAL_CATEGORY_CHIPS.has(c))
  const vendors = answers.vendors ?? []

  return (
    <>
      <SectionHeader
        eyebrow="Section 6 of 10"
        heading="Data and vendors"
        description="We need to document what personal data your AI tools process and who processes it on your behalf."
      />
      <div className="qz-questions">
        <FieldGroup
          label="What categories of personal data do your AI tools process?"
          helpTitle="What is special-category data?"
          helpText="UK law treats certain types of personal information as extra-sensitive — things like health details, ethnic background, religious beliefs, trade union membership, or sexual orientation. If your AI tools ever process this kind of information, stricter rules apply."
          micro="The categories highlighted in amber are 'special category data' under UK GDPR Article 9 and attract stricter processing conditions."
          required
          error={errors.data_categories}
        >
          <PillMultiSelect
            options={DATA_CATEGORIES}
            values={answers.data_categories ?? []}
            onChange={(v) => patch({ data_categories: v })}
            specialSet={SPECIAL_CATEGORY_CHIPS}
          />
        </FieldGroup>

        {showSpecialBasis ? (
          <div className="qz-reveal">
            <div className="qz-reveal-eyebrow">Special-category data</div>
            <FieldGroup
              label="What is the lawful basis for processing this special-category data with AI tools?"
              required
              error={errors.special_category_basis}
            >
              <RadioGroup
                name="Special category basis"
                options={SPECIAL_BASIS}
                value={answers.special_category_basis}
                onChange={(v) => patch({ special_category_basis: v })}
              />
            </FieldGroup>
            {answers.special_category_basis === 'substantial_public' ? (
              <FieldGroup label="Specify the substantial public interest">
                <input
                  className="qz-input"
                  type="text"
                  value={answers.special_category_basis_other ?? ''}
                  onChange={(e) => patch({ special_category_basis_other: e.target.value })}
                />
              </FieldGroup>
            ) : null}
          </div>
        ) : null}

        {vendors.length > 0 ? (
          <div>
            <div className="qz-field-label">Vendor details</div>
            <p className="qz-field-micro">
              For each AI vendor you use, we need to document how they handle your data.
            </p>
            <div style={{ marginTop: 16 }}>
              {vendors.map((v, idx) => (
                <div key={`${v.vendor_name}-${idx}`} className="qz-vendor-card">
                  <div className="qz-vendor-grid">
                    <div className="qz-vendor-full">
                      <label className="qz-field-label">Vendor / product name</label>
                      <div style={{ marginTop: 8 }}>
                        <input
                          className="qz-input"
                          type="text"
                          value={v.vendor_name}
                          onChange={(e) => updateVendor(idx, { vendor_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="qz-field-label">HQ location</label>
                      <div style={{ marginTop: 8 }}>
                        <Select
                          options={HQ_LOCATIONS}
                          value={v.hq_location}
                          onChange={(val) => updateVendor(idx, { hq_location: val })}
                          placeholder="Select…"
                        />
                      </div>
                      {v.hq_location === 'Other (specify)' ? (
                        <input
                          className="qz-input"
                          type="text"
                          placeholder="Country"
                          style={{ marginTop: 8 }}
                          value={v.hq_location_other ?? ''}
                          onChange={(e) => updateVendor(idx, { hq_location_other: e.target.value })}
                        />
                      ) : null}
                    </div>
                    <div>
                      <label className="qz-field-label">
                        DPA signed?
                        <HelpPopover title="What is a Data Processing Agreement (DPA)?">
                          A DPA is a contract between you and a company that handles personal data
                          on your behalf — like OpenAI, Microsoft, or Google. It sets out what
                          they&apos;re allowed to do with your customers&apos; information. Most
                          major AI providers offer these — often called &quot;Data Processing
                          Terms&quot; in their settings.
                        </HelpPopover>
                      </label>
                      <div style={{ marginTop: 8 }}>
                        <RadioGroup
                          name={`DPA ${idx}`}
                          options={DPA_OPTIONS}
                          value={v.dpa_signed}
                          onChange={(val) => updateVendor(idx, { dpa_signed: val })}
                        />
                      </div>
                    </div>
                    <div className="qz-vendor-full">
                      <label className="qz-field-label">
                        Transfer mechanism (if non-UK/EEA)
                        <HelpPopover title="What is a transfer mechanism?">
                          If an AI vendor is based outside the UK or EU (e.g. a US company), you
                          need a legal basis for sending personal data to them. The most common one
                          is Standard Contractual Clauses (SCCs) — a standard contract template
                          approved by regulators. Check the vendor&apos;s privacy terms or data
                          processing agreement.
                        </HelpPopover>
                      </label>
                      <div style={{ marginTop: 8 }}>
                        <Select
                          options={TRANSFER_MECH}
                          value={v.transfer_mechanism}
                          onChange={(val) => updateVendor(idx, { transfer_mechanism: val })}
                          placeholder="Select…"
                        />
                      </div>
                    </div>
                    <div className="qz-vendor-full">
                      <label className="qz-field-label">Does this vendor use your data to train their AI models?</label>
                      <div style={{ marginTop: 8 }}>
                        <RadioGroup
                          name={`Training reuse ${idx}`}
                          options={TRAINING_REUSE}
                          value={v.training_reuse}
                          onChange={(val) => updateVendor(idx, { training_reuse: val })}
                        />
                      </div>
                    </div>
                    <div className="qz-vendor-full">
                      <label className="qz-field-label">Certifications held</label>
                      <div style={{ marginTop: 8 }}>
                        <PillMultiSelect
                          options={CERTS}
                          values={v.certifications ?? []}
                          onChange={(val) => updateVendor(idx, { certifications: val })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <NavButtons onBack={onBack} onContinue={handleContinue} isSaving={isSaving} />
    </>
  )
}
