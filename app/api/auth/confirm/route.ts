import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-next'

export const dynamic = 'force-dynamic'

/**
 * Server-side magic-link confirmation.
 *
 * Magic-link emails point here carrying a one-time `token_hash` (see
 * `lib/auth/magic-link.ts`). We exchange it via `verifyOtp`, which sets the
 * auth session cookie, then redirect to `next`. This is the server-side
 * counterpart to `/api/auth/callback` (which handles the client PKCE `?code=`
 * flow used by the admin login).
 *
 * The token is single-use. To keep the emailed link usable when a customer
 * closes the tab and clicks it again later, we fall back to an EXISTING valid
 * session on this device (the link keeps working for the life of the session
 * cookie) — without ever re-accepting the consumed token itself. When there is
 * neither a valid token nor a live session (different device, or the cookie is
 * gone), we hand off to `/resume`, which can issue a fresh link, rather than
 * dumping the user on the landing page with a cryptic `?auth_error`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(url.searchParams.get('next'))
  const origin = url.origin

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Auth confirm error:', error.message)

    // Token consumed/expired. If this browser still holds a valid session
    // (they clicked the same link before and are simply returning), honour it.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // No token, or a consumed/expired token with no live session. Route to the
  // graceful re-entry screen carrying the intended destination.
  const resumeUrl = new URL(`${origin}/resume`)
  resumeUrl.searchParams.set('next', next)
  resumeUrl.searchParams.set('reason', 'link_expired')
  return NextResponse.redirect(resumeUrl.toString())
}
