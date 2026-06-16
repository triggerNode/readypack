'use client'

type Props = {
  onBack?: () => void
  onContinue: () => void
  continueLabel?: string
  isSaving?: boolean
  canContinue?: boolean
  hideBack?: boolean
}

export function NavButtons({
  onBack,
  onContinue,
  continueLabel = 'Save & Continue',
  isSaving = false,
  canContinue = true,
  hideBack = false,
}: Props) {
  return (
    <div className="qz-nav-buttons">
      {hideBack ? (
        <span />
      ) : (
        <button
          type="button"
          className="qz-btn qz-btn-ghost"
          onClick={onBack}
          disabled={!onBack || isSaving}
        >
          Back
        </button>
      )}
      <button
        type="button"
        className="qz-btn qz-btn-primary"
        onClick={onContinue}
        disabled={!canContinue || isSaving}
      >
        {isSaving ? 'Saving…' : continueLabel}
      </button>
    </div>
  )
}
