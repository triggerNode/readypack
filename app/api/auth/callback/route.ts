import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-next'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  // Guard against open redirect — only ever bounce to a same-origin path.
  const next = safeNextPath(requestUrl.searchParams.get('next'))
  const origin = requestUrl.origin

  // No code means no auth event happened — don't perform a "free" redirect to
  // `next` (which could bounce an unauthenticated visitor toward a gated route).
  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('Auth callback error')
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
