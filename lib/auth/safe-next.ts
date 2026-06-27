/**
 * Guard a post-authentication redirect target.
 *
 * The `next` value rides through magic-link URLs and the /resume flow, so it is
 * attacker-influenceable. We only ever redirect to a SAME-ORIGIN absolute path
 * (a single leading `/`), never to an absolute URL (`https://evil.com`) or a
 * protocol-relative host (`//evil.com`) that the browser would treat as a new
 * origin. Anything else collapses to the fallback — closing the open-redirect
 * hole at the point every redirect is built.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback
  // Must be an absolute path on our own origin.
  if (!next.startsWith('/')) return fallback
  // Reject protocol-relative ("//host") and backslash tricks ("/\\host").
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  // Reject control characters (tab/newline/etc.) — URL parsers strip these,
  // which can change where the path resolves; only allow printable ASCII.
  if (!/^\/[\x20-\x7E]*$/.test(next)) return fallback
  return next
}
