import { clearCapturedEmails } from './lib/captured-emails'

// Runs once before the whole Playwright run. Truncates the email-capture file so a
// re-run never matches stale lines from a previous run (personas reuse the same
// olutags+<name>@gmail.com addresses, so old captures could otherwise false-match).
export default function globalSetup(): void {
  clearCapturedEmails()
}
