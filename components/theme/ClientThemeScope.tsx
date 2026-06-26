import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { ThemeProvider } from './ThemeProvider'
import { THEME_COOKIE, parseTheme } from './theme'

type Props = {
  children: ReactNode
}

/**
 * Server shell for a CLIENT-facing surface (questionnaire/portal). Reads the
 * theme cookie at SSR and hands it to the client `ThemeProvider`, which owns the
 * live theme. Applying the theme to a wrapper (not <html>) keeps landing + admin dark.
 */
export async function ClientThemeScope({ children }: Props) {
  const store = await cookies()
  const theme = parseTheme(store.get(THEME_COOKIE)?.value)

  return <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
}
