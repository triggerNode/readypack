'use client'

import { useRef, useState } from 'react'
import { SectionHeader } from '../shared/SectionHeader'
import { FieldGroup } from '../shared/FieldGroup'
import { NavButtons } from '../shared/NavButtons'
import { RadioGroup, Select } from '../shared/FormPrimitives'
import type { Section1Answers } from '../types'

type Props = {
  answers: Section1Answers
  isSaving: boolean
  onChange: (next: Section1Answers) => void
  onContinue: (final: Section1Answers) => Promise<void>
}

const SECTORS = [
  'Marketing / advertising',
  'Recruitment / staffing',
  'B2B SaaS / technology',
  'Professional services',
  'Financial services',
  'Healthcare / life sciences',
  'Education / training',
  'Legal services',
  'Retail / e-commerce',
  'Other (specify)',
]

const EMPLOYEE_OPTIONS = [
  { value: '1-9', label: '1–9' },
  { value: '10-49', label: '10–49' },
  { value: '50-249', label: '50–249' },
  { value: '250+', label: '250+' },
]

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg']

export function Section01Business({ answers, isSaving, onChange, onContinue }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function patch(p: Partial<Section1Answers>) {
    onChange({ ...answers, ...p })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!answers.company_name?.trim()) e.company_name = 'Required'
    if (!answers.sector) e.sector = 'Required'
    if (answers.sector === 'Other (specify)' && !answers.sector_other?.trim()) {
      e.sector_other = 'Please describe your sector'
    }
    if (!answers.employee_count) e.employee_count = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleFile(file: File) {
    setUploadError(null)
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setUploadError('Logo must be SVG, PNG or JPEG')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setUploadError('Logo must be under 2MB')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/intake/upload-logo', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Upload failed')
      }
      const data = (await res.json()) as { url: string }
      patch({ logo_url: data.url, logo_filename: file.name })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removeLogo() {
    patch({ logo_url: undefined, logo_filename: undefined })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleContinue() {
    if (!validate()) return
    await onContinue(answers)
  }

  return (
    <>
      <SectionHeader
        eyebrow="Section 1 of 10"
        heading="Tell us about your business"
        description="We'll use this to personalise your documents and confirm your legal entity details."
      />
      <div className="qz-questions">
        <FieldGroup
          label="Company name"
          micro="The full registered name, as it appears on Companies House."
          required
          error={errors.company_name}
        >
          <input
            className="qz-input"
            type="text"
            placeholder="Acme Ltd"
            value={answers.company_name ?? ''}
            onChange={(e) => patch({ company_name: e.target.value })}
          />
        </FieldGroup>

        <FieldGroup label="Trading name">
          <input
            className="qz-input"
            type="text"
            placeholder="If different from company name"
            value={answers.trading_name ?? ''}
            onChange={(e) => patch({ trading_name: e.target.value })}
          />
        </FieldGroup>

        <FieldGroup
          label="Companies House number"
          micro="Optional but recommended — used in your AI Use Statement and Policy documents."
        >
          <input
            className="qz-input w-sm"
            type="text"
            maxLength={8}
            placeholder="e.g. 12345678"
            value={answers.company_number ?? ''}
            onChange={(e) => patch({ company_number: e.target.value })}
          />
        </FieldGroup>

        <FieldGroup label="Sector" required error={errors.sector}>
          <Select
            value={answers.sector}
            onChange={(v) => patch({ sector: v })}
            options={SECTORS}
            placeholder="Select your sector…"
          />
        </FieldGroup>

        {answers.sector === 'Other (specify)' ? (
          <FieldGroup label="Describe your sector" required error={errors.sector_other}>
            <input
              className="qz-input"
              type="text"
              value={answers.sector_other ?? ''}
              onChange={(e) => patch({ sector_other: e.target.value })}
            />
          </FieldGroup>
        ) : null}

        <FieldGroup label="Employees" required error={errors.employee_count}>
          <RadioGroup
            name="Employees"
            options={EMPLOYEE_OPTIONS}
            value={answers.employee_count}
            onChange={(v) => patch({ employee_count: v })}
          />
        </FieldGroup>

        <FieldGroup
          label="Company logo"
          micro="Used as a header on your nine documents. Skip if you don't have one ready."
        >
          {answers.logo_url ? (
            <div className="qz-upload is-filled">
              <div style={{ width: 60, height: 40, background: 'var(--bg-primary)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={answers.logo_url}
                  alt="Uploaded logo preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
              <div className="qz-upload-meta">
                <span className="qz-upload-filename">{answers.logo_filename ?? 'logo'}</span>
                <button type="button" className="qz-upload-remove" onClick={removeLogo}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="qz-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <UploadIcon />
              <span className="qz-upload-primary">
                {uploading ? 'Uploading…' : 'Click to upload or drag here'}
              </span>
              <span className="qz-upload-secondary">SVG, PNG or JPEG · max 2MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          {uploadError ? <p className="qz-field-error">{uploadError}</p> : null}
        </FieldGroup>
      </div>

      <NavButtons
        hideBack
        onContinue={handleContinue}
        isSaving={isSaving || uploading}
        canContinue={!uploading}
      />
    </>
  )
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
