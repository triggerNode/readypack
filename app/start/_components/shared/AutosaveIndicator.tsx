'use client'

type Props = {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function AutosaveIndicator({ status }: Props) {
  const label =
    status === 'saving' ? 'Saving…' :
    status === 'error' ? 'Save failed' :
    'Saved automatically'

  return (
    <div className="qz-autosave">
      <span className="qz-autosave-dot" aria-hidden />
      <span className="qz-autosave-text">{label}</span>
    </div>
  )
}
