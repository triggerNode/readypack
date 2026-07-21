import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Resend } from 'resend'

// ──────────────────────────────────────────────────────────────────────────
// Test-only email CAPTURE (not a cost hack — the professional way to test email).
//
// When E2E_CAPTURE_EMAIL=1 — set ONLY by the Playwright web server, NEVER in
// production — every outbound email is RECORDED to a JSONL file that the test
// process reads, and the real Resend HTTP call is skipped. Delivery is Resend's
// job and we trust it; our job is to verify ReadyPack asked for the right email,
// to the right person, with the right subject + attachment. So the suite asserts
// the capture instead of spamming a real inbox — which also means automated runs
// never touch the Resend daily quota.
//
// This mirrors the E2E_SKIP_REAL_GENERATION generation kill-switch exactly:
// additive, env-gated, and completely inert in production (the flag is unset, so
// `resend` is the real client and none of this runs).
// ──────────────────────────────────────────────────────────────────────────

interface CaptureableSend {
  from: string
  to: string | string[]
  subject: string
  replyTo?: string
  html?: string
  attachments?: Array<{ filename: string; content?: unknown }>
}

// Same file both processes agree on: the dev server (cwd = readypack/) writes it,
// the Playwright test process reads it via e2e/lib/captured-emails.ts.
const CAPTURE_FILE = join(process.cwd(), 'e2e', '.captured-emails.jsonl')

function recordCapturedEmail(payload: CaptureableSend): { data: { id: string }; error: null } {
  const html = typeof payload.html === 'string' ? payload.html : ''
  const record = {
    ts: new Date().toISOString(),
    to: payload.to,
    from: payload.from,
    subject: payload.subject,
    replyTo: payload.replyTo ?? null,
    hasHtml: html.length > 0,
    // Non-sensitive booleans for assertions — we deliberately do NOT store the html
    // body (it carries one-time magic-link tokens). `hasPortalLink` lets a test
    // prove the critical-case promise: a self-serve portal link for low/med/high,
    // and NONE for critical ("a specialist will be in touch").
    hasPortalLink: /\/portal\//.test(html),
    attachments: (payload.attachments ?? []).map((a) => a.filename),
  }
  try {
    mkdirSync(join(process.cwd(), 'e2e'), { recursive: true })
    appendFileSync(CAPTURE_FILE, `${JSON.stringify(record)}\n`)
  } catch {
    // Capture is best-effort — it must never break the flow under test.
  }
  // Resend-shaped success. REQUIRED: some callers (e.g. the Stripe webhook) throw
  // when `error` is set, so a stub that returned an error would break provisioning.
  return { data: { id: `captured_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }, error: null }
}

const client = new Resend(process.env.RESEND_API_KEY)

if (process.env.E2E_CAPTURE_EMAIL === '1') {
  // Shadow the shared singleton's send so every caller captures instead of sending.
  client.emails.send = (async (payload: CaptureableSend) =>
    recordCapturedEmail(payload)) as unknown as typeof client.emails.send
}

export const resend = client
