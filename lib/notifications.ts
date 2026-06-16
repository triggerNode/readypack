// lib/notifications.ts
// Internal admin notifications. These are plain-HTML, non-customer-facing emails
// sent to the operator when key events happen. Always non-blocking — a failed
// notification must never break the customer-facing flow that triggered it.

import { resend } from '@/lib/resend'

const ADMIN_EMAIL = 'olutags@gmail.com'
const FROM_ADDRESS = 'ReadyPack <hello@mail.readypack.co.uk>'

export async function notifyAdmin(subject: string, bodyHtml: string): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: [ADMIN_EMAIL],
      subject: `[ReadyPack Admin] ${subject}`,
      html: bodyHtml,
    })
  } catch (err) {
    // Non-blocking — log but don't throw.
    console.error('[notify] admin notification failed:', err)
  }
}
