// Loads the app's .env.local into process.env for the test runner.
// Read-only: it never writes secrets anywhere, only into this process.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

let loaded = false

export function loadTestEnv(): void {
  if (loaded) return
  // Playwright runs with cwd = readypack/, where .env.local lives.
  const envPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      // Strip any trailing " # inline comment" but keep tokens intact.
      let value = trimmed.slice(eq + 1).replace(/\s+#.*$/, '').trim()
      // Strip surrounding quotes if present.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
  loaded = true
}

export function requireEnv(key: string): string {
  loadTestEnv()
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing ${key}. The robot needs it from readypack/.env.local to run this test.`,
    )
  }
  return value
}

export const ADMIN_EMAIL = 'olutags@gmail.com'
