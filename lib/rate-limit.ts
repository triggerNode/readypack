// lib/rate-limit.ts
// Simple in-memory sliding-window rate limiter using a Map.
// No external dependencies — suitable for a single-server MVP. For a multi-
// instance deployment this would need to move to a shared store (e.g. Redis).

type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

export function rateLimit(
  key: string,
  opts: { windowMs: number; maxRequests: number },
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.maxRequests - 1 }
  }

  if (entry.count >= opts.maxRequests) {
    return { ok: false, remaining: 0 }
  }

  entry.count++
  return { ok: true, remaining: opts.maxRequests - entry.count }
}

// Extract a best-effort client IP from the standard proxy headers.
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be a comma-separated chain — the first entry is the client.
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return headers.get('x-real-ip') ?? 'unknown'
}

// Clean expired entries every 5 minutes to prevent unbounded memory growth.
const sweep = setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)
// Don't let the sweep timer hold the process open on its own.
if (typeof sweep.unref === 'function') sweep.unref()
