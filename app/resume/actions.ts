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
  // listUsers paginates — acceptable for MVP, same approach as the Stripe
  // webhook; revisit with a direct auth.users query when volume justifies it.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
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
  const hdrs = await headers()
  const ip = clientIpFrom(hdrs)
  const limit = rateLimit(`resume:${ip}`, { windowMs: 15 * 60 * 1000, maxRequests: 5 })
  if (!limit.ok) {
    return { ok: false, error: 'Too many requests — please wait a few minutes and try again.' }
  }

  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  const email = parsed.data
  const next = safeNextPath(nextInput, '/start')

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
