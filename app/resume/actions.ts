'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'
import { buildResumeLinkEmail } from '@/lib/email'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { safeNextPath } from '@/lib/auth/safe-next'
import { rateLimit, clientIpFrom } from '@/lib/rate-limit'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

const emailSchema = z.string().trim().toLowerCase().email()

/** True if an auth user already exists for this email. */
async function authUserExists(email: string): Promise<boolean> {
  // listUsers paginates (default 50/page). Bump the page size so pre-launch
  // volume is fully covered; a later customer must still match. TODO (D2):
  // replace with a direct indexed lookup (public.users by email) so this is
  // O(1) and cannot miss at scale.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    throw new Error(`Failed to list auth users: ${error.message}`)
  }
  return data.users.some((u) => u.email?.toLowerCase() === email)
}

/**
 * Email the caller a fresh single-use magic link to `next`.
 *
 * Anti-enumeration: we ALWAYS report success regardless of whether the address
 * has an account or the send actually succeeded — the only non-ok response is a
 * rate-limit or an invalid email. We never create a user for an unknown
 * address (that would be an abuse vector), and we never re-use a consumed token.
 */
export async function requestFreshLink(
  emailInput: string,
  nextInput: string,
): Promise<{ ok: boolean; error?: string }> {
  const WINDOW_MS = 15 * 60 * 1000
  const TOO_MANY = 'Too many requests — please wait a few minutes and try again.'

  // Coarse per-IP gate first. x-forwarded-for is spoofable, so this is only the
  // first layer; the per-email key below caps abuse against a specific address
  // regardless of source IP. (D2: move to a shared store + trusted client IP.)
  const hdrs = await headers()
  const ip = clientIpFrom(hdrs)
  if (!rateLimit(`resume:ip:${ip}`, { windowMs: WINDOW_MS, maxRequests: 5 }).ok) {
    return { ok: false, error: TOO_MANY }
  }

  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  const email = parsed.data
  const next = safeNextPath(nextInput, '/start')

  // Per-target-address gate — resilient to IP spoofing. Applied before the
  // existence check so it triggers identically whether or not the account
  // exists (no enumeration signal).
  if (!rateLimit(`resume:email:${email}`, { windowMs: WINDOW_MS, maxRequests: 5 }).ok) {
    return { ok: false, error: TOO_MANY }
  }

  try {
    if (await authUserExists(email)) {
      const magicLink = await generateMagicLink(email, next)
      const sendResult = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [email],
        subject: 'Your ReadyPack secure link',
        html: buildResumeLinkEmail({ magicLink }),
      })
      if (sendResult.error) {
        // Log server-side; still report generic success so we don't leak
        // which addresses exist.
        console.error('[resume] resend send failed:', sendResult.error.message)
      }
    }
  } catch (err) {
    console.error('[resume] requestFreshLink error:', err)
    // Fall through to the same generic success — never reveal account existence.
  }

  return { ok: true }
}
