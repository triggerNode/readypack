// Test-side reader for the email-capture file written by lib/resend.ts under
// E2E_CAPTURE_EMAIL=1. The dev server appends one JSON line per outbound email;
// these helpers let a spec assert exactly what ReadyPack tried to send — recipient,
// subject, attachment — without a real email leaving the building.
//
// IMPORTANT: capture only happens when the Playwright-managed web server is the one
// running (it sets E2E_CAPTURE_EMAIL). If you point the suite at your OWN already-
// running `npm run dev` (reuseExistingServer), the flag won't be set and real emails
// WILL send — same caveat as E2E_SKIP_REAL_GENERATION. Email assertions assume the
// managed server.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CAPTURE_FILE = resolve(process.cwd(), 'e2e/.captured-emails.jsonl')

export interface CapturedEmail {
  ts: string
  to: string | string[]
  from: string
  subject: string
  replyTo: string | null
  hasHtml: boolean
  hasPortalLink: boolean
  attachments: string[]
}

/** Truncate the capture file — call once at the start of a run (global-setup). */
export function clearCapturedEmails(): void {
  writeFileSync(CAPTURE_FILE, '')
}

/** All emails captured so far this run. */
export function readCapturedEmails(): CapturedEmail[] {
  if (!existsSync(CAPTURE_FILE)) return []
  return readFileSync(CAPTURE_FILE, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CapturedEmail)
}

function recipients(email: CapturedEmail): string[] {
  return Array.isArray(email.to) ? email.to : [email.to]
}

/** Every captured email addressed to `address` (case-insensitive). */
export function capturedFor(address: string): CapturedEmail[] {
  const target = address.toLowerCase()
  return readCapturedEmails().filter((e) => recipients(e).some((r) => r?.toLowerCase() === target))
}

/**
 * Poll until a captured email matches `predicate` (server-side sends are async, so
 * a just-triggered email may take a beat to land). Returns it, or null on timeout.
 */
export async function waitForCapturedEmail(
  predicate: (email: CapturedEmail) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<CapturedEmail | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000)
  const interval = opts.intervalMs ?? 500
  for (;;) {
    const hit = readCapturedEmails().find(predicate)
    if (hit) return hit
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, interval))
  }
}

/** Convenience: wait for an email to `address` whose subject matches `subject`. */
export function waitForEmailTo(
  address: string,
  subject: RegExp,
  opts: { timeoutMs?: number } = {},
): Promise<CapturedEmail | null> {
  const target = address.toLowerCase()
  return waitForCapturedEmail(
    (e) => recipients(e).some((r) => r?.toLowerCase() === target) && subject.test(e.subject),
    opts,
  )
}
