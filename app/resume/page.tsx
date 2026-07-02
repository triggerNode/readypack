import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth/safe-next'
import { ResumeForm } from './ResumeForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Return to ReadyPack' }

type Props = {
  searchParams: Promise<{ next?: string; reason?: string }>
}

/**
 * Graceful re-entry screen.
 *
 * Reached when a one-time magic link has been consumed/expired (from
 * `/api/auth/confirm`) or when `/start` is hit without a session. If the user
 * still has a live session on this device we send them straight to where they
 * were going; otherwise we offer to email a fresh secure link.
 */
export default async function ResumePage({ searchParams }: Props) {
  const { next: rawNext, reason } = await searchParams
  const next = safeNextPath(rawNext, '/start')
  const switchAccount = reason === 'switch_account'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A live session normally means "just go back in". The exception is
  // switch_account: the session on this device is the WRONG one (it just failed
  // the portal owner check), so forwarding them back would loop — show the form so
  // they can request a link for their own account instead.
  if (user && !switchAccount) {
    redirect(next)
  }

  return (
    <ResumeForm
      next={next}
      expired={reason === 'link_expired'}
      switchAccount={switchAccount}
      signedInEmail={user?.email ?? null}
    />
  )
}
