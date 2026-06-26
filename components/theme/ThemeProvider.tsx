'use client'

import { useState, type ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { THEME_COOKIE, THEME_MAX_AGE, type Theme } from './theme'

type Props = {
  initialTheme: Theme
  children: ReactNode
}

/**
 * Owns the live theme in React state so React owns the `data-theme` attribute
 * (no imperative DOM mutation). `initialTheme` comes from the cookie read at SSR,
 * so the server-rendered attribute and this initial state always agree — no flash,
 * no hydration mismatch. The toggle updates state AND writes the cookie so the
 * next SSR render paints the chosen theme.
 *
 * The light palette (globals.css `[data-theme="light"]`) is scoped to this wrapper
 * div, not <html>, so the landing page and admin stay dark. One known limitation:
 * anything portaled to <body> renders outside this subtree and keeps the dark vars.
 */
export function ThemeProvider({ initialTheme, children }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    const secure =
      typeof location !== 'undefined' && location.protocol === 'https:' ? ';secure' : ''
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=${THEME_MAX_AGE};samesite=lax${secure}`
  }

  return (
    <div className="rp-theme-scope" data-theme={theme}>
      <ThemeToggle theme={theme} onToggle={toggle} />
      {children}
    </div>
  )
}
