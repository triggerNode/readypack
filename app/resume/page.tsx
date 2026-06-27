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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Already signed in here — straight back in, no fresh link required.
    redirect(next)
  }

  return <ResumeForm next={next} expired={reason === 'link_expired'} />
}
