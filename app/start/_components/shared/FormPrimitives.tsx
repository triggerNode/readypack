'use client'

type RadioOption = { value: string; label: string; sublabel?: string }

export function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: RadioOption[]
  value?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="qz-radio-group" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`qz-radio-opt ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="qz-radio-mark" aria-hidden />
            <span className="qz-radio-opt-text">
              {opt.sublabel ? (
                <>
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    {opt.label}
                  </strong>
                  {opt.sublabel}
                </>
              ) : (
                opt.label
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function PillMultiSelect({
  options,
  values,
  onChange,
  specialSet,
}: {
  options: string[]
  values: string[]
  onChange: (next: string[]) => void
  specialSet?: Set<string>
}) {
  function toggle(opt: string) {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt))
    } else {
      onChange([...values, opt])
    }
  }
  return (
    <div className="qz-pill-row" role="group">
      {options.map((opt) => {
        const isSelected = values.includes(opt)
        const isSpecial = specialSet?.has(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={isSelected}
            className={`qz-pill-opt ${isSelected ? 'is-selected' : ''} ${isSpecial ? 'is-special' : ''}`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  value?: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div className="qz-select-wrap">
      <select
        className="qz-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

export function CheckIcon() {
  return (
    <svg className="qz-cbx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
