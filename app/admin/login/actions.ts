'use server'

import { ADMIN_EMAIL } from '@/lib/auth'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { resend } from '@/lib/resend'
import { buildAdminLoginEmail } from '@/lib/email'

const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

/**
 * Send the admin a browser-independent sign-in link.
 *
 * Uses the token_hash magic-link flow (lib/auth/magic-link.ts) delivered via
 * Resend — so the link works regardless of which browser/app opens it, unlike
 * the previous client-side PKCE flow which required the same browser that
 * requested it. Anti-enumeration: we always report success and only actually
 * send a link to the single permitted admin address.
 */
export async function sendAdminMagicLink(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase()
  if (normalized !== ADMIN_EMAIL) {
    // Do not reveal whether an address is the admin.
    return { ok: true }
  }

  try {
    const magicLink = await generateMagicLink(ADMIN_EMAIL, '/admin')
    const sendResult = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [ADMIN_EMAIL],
      subject: 'Your ReadyPack admin sign-in link',
      html: buildAdminLoginEmail({ magicLink }),
    })
    if (sendResult.error) {
      return { ok: false, error: sendResult.error.message }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send link' }
  }
}
