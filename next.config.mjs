/** @type {import('next').NextConfig} */

// Content-Security-Policy is shipped in REPORT-ONLY mode first: the browser logs
// what it WOULD block (visible in DevTools console) without actually blocking
// anything, so we can tune it against real traffic before switching the header
// name to enforcing `Content-Security-Policy`. Kept deliberately permissive on
// script/style (Next injects inline hydration scripts; a proper enforce pass
// would move to per-request nonces).
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://m.stripe.com",
  "frame-src 'self' https://*.supabase.co https://js.stripe.com https://checkout.stripe.com",
  "object-src 'self' https://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
].join('; ')

// Safe headers — these cannot break the app, so they are enforced immediately.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
]

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
