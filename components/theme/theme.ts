export type Theme = 'light' | 'dark'

/** Cookie the client theme is persisted in. Read at SSR so the first paint is
 *  already the right theme (no flash), and written on toggle so it sticks. */
export const THEME_COOKIE = 'rp-theme'

/** One year. */
export const THEME_MAX_AGE = 60 * 60 * 24 * 365

/** Everyone starts dark; light is opt-in. Anything that isn't 'light' is dark. */
export function parseTheme(value: string | undefined): Theme {
  return value === 'light' ? 'light' : 'dark'
}
