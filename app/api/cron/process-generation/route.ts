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
import { selectJobsToKick, type BackstopJob } from '@/lib/documents/generation-backstop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The cron only kicks workers (each /api/generate runs as its own invocation);
// it does no generation itself, so it stays short.
export const maxDuration = 60

// A job still `queued` this long after it was created has been kicked by this
// cron several times over and never claimed. That is a broken handoff, not a
// slow one — generation claims its job within a second or two of starting.
const STALE_QUEUE_MS = 3 * 60 * 1000

// How long to hold the cron open so a kick is actually handed to the network
// before this invocation ends. Not the worker's runtime — just the handover.
const KICK_HANDOVER_MS = 5000

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
    .select('id, order_id, status, started_at, created_at')
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

  const considered = (jobs ?? []) as Array<BackstopJob & { created_at: string }>
  const now = Date.now()
  const decisions = selectJobsToKick(considered, now)

  // Kick against the origin this request actually arrived on rather than a
  // build-time env var, so the backstop cannot be pointed at localhost by a
  // misconfigured NEXT_PUBLIC_APP_URL.
  const origin = request.nextUrl.origin
  // Record each kick's outcome as it settles so the log can state it rather than
  // leave it to be inferred. 'pending' means it had not settled by the time we
  // stopped waiting, which is normal for a real generation run (the worker takes
  // minutes to respond) and is NOT a failure on its own.
  const outcomes = new Map<string, string>()
  const kicks = decisions.map(({ job }) => {
    outcomes.set(job.order_id, 'pending')
    return kickWorker(job.order_id, origin).then((outcome) => {
      outcomes.set(job.order_id, outcome)
      return outcome
    })
  })

  // Hold the handler open briefly so the kicks actually leave the instance.
  // Returning immediately is what makes this fragile: the request is in flight,
  // nobody is awaiting it, and if the runtime tears the invocation down the
  // connection dies without ever rejecting — silence, not an error. We do NOT
  // wait for the worker to finish (that is ~8 minutes and has its own
  // invocation); we only wait long enough for the request to be handed over.
  // Bounded well inside maxDuration, and skipped entirely when there is no work.
  if (kicks.length > 0) {
    await Promise.race([
      Promise.allSettled(kicks),
      new Promise((resolve) => setTimeout(resolve, KICK_HANDOVER_MS)),
    ])
  }

  // THE ALARM. The kick is fire-and-forget, and a fetch that hangs never settles
  // — so the kick's own outcome cannot be trusted to reveal a broken backstop.
  // What can: a job that is still sitting `queued` several minutes after we
  // started kicking it. By then the worker has had many chances to claim it and
  // has not, which means a paid order is not being generated and nobody knows.
  // This is the line to grep for.
  const stale = considered.filter(
    (job) =>
      job.status === 'queued' && now - Date.parse(job.created_at) >= STALE_QUEUE_MS,
  )

  // Say what happened, EVERY run, even when there is nothing to do.
  //
  // The counts used to exist only in the JSON response body, and nothing reads a
  // cron's response body — so a backstop that could not see a queued job looked
  // exactly like one with nothing to do. Logging only when there was work kept
  // that ambiguity alive: no line still meant either "healthy and idle" or
  // "blind". One line a minute is a cheap price for being able to tell those
  // apart, and `rows` doubles as proof the keep-alive query really reached the
  // database rather than merely not erroring.
  const detail = decisions
    .map(({ job, reason }) => `${job.order_id} ${reason}->${outcomes.get(job.order_id)}`)
    .join(', ')
  console.log(
    `[cron] tick: rows=${considered.length} kicked=${decisions.length} stale=${stale.length}` +
      (detail ? ` | ${detail}` : ''),
  )

  if (stale.length > 0) {
    const staleDetail = stale
      .map(
        (job) =>
          `${job.order_id} queued ${Math.round((now - Date.parse(job.created_at)) / 60000)}min`,
      )
      .join(', ')
    console.error(
      `[cron] BACKSTOP FAILING — ${stale.length} job(s) still queued after repeated kicks: ${staleDetail}`,
    )
  }

  return NextResponse.json({
    ok: true,
    considered: considered.length,
    kicked: decisions.length,
    stale: stale.length,
  })
}
