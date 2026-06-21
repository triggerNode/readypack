import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Server-side magic-link confirmation.
 *
 * Magic-link emails point here carrying a one-time `token_hash` (see
 * `lib/auth/magic-link.ts`). We exchange it via `verifyOtp`, which sets the
 * auth session cookie, then redirect to `next`. This is the server-side
 * counterpart to `/api/auth/callback` (which handles the client PKCE `?code=`
 * flow used by the admin login).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/'
  const origin = url.origin

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Auth confirm error:', error.message)
  }

  return NextResponse.redirect(`${origin}/?auth_error=link_invalid`)
}
