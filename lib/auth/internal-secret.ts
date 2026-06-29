// lib/auth/internal-secret.ts
//
// Shared secret that proves a POST to /api/generate is a genuine INTERNAL
// trigger (the durable-queue kick in generation-queue.ts, the cron drain, or an
// admin repair) rather than an external caller.
//
// Why this exists: the old guard compared the request's `Host` header to the
// app's own host. But every legitimate external request to the live site
// ALREADY carries that same host, so the check passed for anyone — the
// `_internal` path was effectively unauthenticated, letting a stranger trigger
// document generation (and Anthropic spend) for any order id. A server-only
// shared secret can't be produced by an outside caller, so it closes that hole.
//
// Resolution: prefer a dedicated INTERNAL_TRIGGER_SECRET, but fall back to the
// already-required CRON_SECRET so existing production deploys need NO new env
// var. Fails closed in production when neither is set; in dev/test there is
// usually no secret, so the same-process kick is allowed.

import { timingSafeEqual } from 'crypto'

export const INTERNAL_SECRET_HEADER = 'x-internal-secret'

export function getInternalSecret(): string | undefined {
  return process.env.INTERNAL_TRIGGER_SECRET ?? process.env.CRON_SECRET ?? undefined
}

/** Constant-time check that `provided` matches the configured internal secret. */
export function verifyInternalSecret(provided: string | null): boolean {
  const expected = getInternalSecret()
  if (!expected) {
    // No secret configured. In production that is a misconfiguration → fail
    // closed. In dev/test there is no secret by default, so allow the local
    // same-process kick to keep generation working.
    return process.env.NODE_ENV !== 'production'
  }
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Length check first: timingSafeEqual throws on length mismatch. Leaking the
  // length of a high-entropy secret is not a practical risk.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
