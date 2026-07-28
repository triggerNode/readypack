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

  const { data: jobs, error } = await supabaseAdmin
    .from('document_generation_jobs')
    .select('id, order_id, status, started_at')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(20)

  // This query has a SECOND job: it is what stops the free-tier Supabase project
  // pausing. Supabase pauses a free project after 7 idle days, and that is what
  // took prod down on 2026-07-21. Running every minute, this query means the
  // database never sees 7 idle days — so the keep-alive is free and needs no
  // alarm, no extra service and nobody remembering to do it.
  //
  // It only works if the query actually REACHES the database. Until now the error
  // was discarded (`const { data: jobs } =`), so an unreachable Supabase was
  // indistinguishable from "no jobs to do": the route returned 200 either way.
  // The keep-alive could have been dead for a week with nothing to show for it,
  // and the generation backstop would have been dead alongside it — a paid order
  // stuck `queued` with nothing left to rescue it. Same blind spot that caused a
  // wrong diagnosis during the 2026-07-21 outage (see rp-watch.mjs, commit
  // 2ce212b). Surface it: a dead database now shows up in the Vercel logs within
  // the minute instead of as a dead site seven days later.
  if (error) {
    console.error(`[cron] Supabase unreachable — keep-alive and generation backstop are both down: ${error.message}`)
    return NextResponse.json(
      { ok: false, db: 'unreachable', error: error.message },
      { status: 500 },
    )
  }

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
