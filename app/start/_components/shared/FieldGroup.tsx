import type { ReactNode } from 'react'
import { HelpPopover } from './HelpPopover'

type Props = {
  label: string
  helpTitle?: string
  helpText?: string
  micro?: string
  required?: boolean
  error?: string | null
  children: ReactNode
}

export function FieldGroup({
  label,
  helpTitle,
  helpText,
  micro,
  required,
  error,
  children,
}: Props) {
  return (
    <div className="qz-field">
      <label className="qz-field-label">
        {label}
        {required ? (
          <span style={{ color: 'var(--danger)', marginLeft: 4 }} aria-hidden>*</span>
        ) : null}
        {helpTitle && helpText ? (
          <HelpPopover title={helpTitle}>{helpText}</HelpPopover>
        ) : null}
      </label>
      {micro ? <p className="qz-field-micro">{micro}</p> : null}
      <div className="qz-field-control">{children}</div>
      {error ? <p className="qz-field-error" role="alert">{error}</p> : null}
    </div>
  )
}
