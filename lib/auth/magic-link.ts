import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Build a magic-link URL that authenticates the recipient via our own
 * server-side `/api/auth/confirm` route.
 *
 * We deliberately do NOT use the `action_link` returned by Supabase. That link
 * routes through Supabase's `/auth/v1/verify` endpoint, which returns the
 * session in the URL hash fragment (implicit flow) and lands on the project's
 * Site URL. A server-side route can never read a `#hash` fragment, so the
 * session is never persisted and the customer is dropped, unauthenticated, on
 * the home page.
 *
 * Instead we take the one-time `hashed_token` from the same `generateLink`
 * response and build a link straight to `/api/auth/confirm`. That route calls
 * `verifyOtp({ token_hash })`, which sets the auth cookie server-side, then
 * redirects to `next`. No hash fragment, and no dependency on the Supabase
 * redirect-URL allowlist (the link points at our own domain).
 */
export async function generateMagicLink(email: string, next: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const props = data?.properties
  if (error || !props?.hashed_token) {
    throw new Error(`Magic link generation failed: ${error?.message ?? 'no token_hash'}`)
  }

  const params = new URLSearchParams({
    token_hash: props.hashed_token,
    type: props.verification_type,
    next,
  })
  return `${appUrl}/api/auth/confirm?${params.toString()}`
}
