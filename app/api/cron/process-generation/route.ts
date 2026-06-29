// app/api/cron/process-generation/route.ts
// Durable backstop for document generation (#7).
//
// Vercel Cron hits this every minute. It finds generation jobs that need a push
// — `queued` jobs (the trigger's best-effort kick never landed) and `running`
// jobs whose worker died (started too long ago to still be in flight) — and
// re-kicks the worker for each. The worker (/api/generate) is idempotent and
// resumable, so re-kicking converges (finishes the missing docs) rather than
// duplicating. This is what makes generation survive a frozen/dead instance.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { kickWorker } from '@/lib/documents/generation-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The cron only kicks workers (each /api/generate runs as its own invocation);
// it does no generation itself, so it stays short.
export const maxDuration = 60

// A `running` job older than this has outlived any worker invocation
// (maxDuration 800s) — its worker died, so it is safe to re-kick.
const STUCK_AFTER_MS = 15 * 60 * 1000

export async function GET(request: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Fail CLOSED: if the
  // secret is not configured, refuse rather than leave the worker-kick endpoint
  // open to anonymous abuse (runaway Anthropic spend). Reject any mismatch.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: jobs } = await supabaseAdmin
    .from('document_generation_jobs')
    .select('id, order_id, status, started_at')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(20)

  const now = Date.now()
  let kicked = 0
  for (const job of (jobs ?? []) as Array<{
    id: string
    order_id: string
    status: string
    started_at: string | null
  }>) {
    if (job.status === 'running') {
      const startedMs = job.started_at ? new Date(job.started_at).getTime() : 0
      // Healthy in-flight run — leave it alone.
      if (now - startedMs < STUCK_AFTER_MS) continue
    }
    kickWorker(job.order_id)
    kicked += 1
  }

  return NextResponse.json({ ok: true, considered: jobs?.length ?? 0, kicked })
}
