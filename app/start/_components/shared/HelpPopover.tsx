'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
}

export function HelpPopover({ title, children }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        type="button"
        className="qz-help-btn"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label={`Help: ${title}`}
        aria-expanded={open}
      >
        ?
      </button>
      {open ? (
        <div className="qz-help-popover" role="tooltip">
          <div className="qz-help-popover-title">{title}</div>
          <div className="qz-help-popover-body">{children}</div>
          <button
            type="button"
            className="qz-help-popover-close"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }}
            aria-label="Close help"
          >
            ×
          </button>
        </div>
      ) : null}
    </span>
  )
}
