// lib/documents/generation-backstop.ts
// Which generation jobs the every-minute cron should re-kick.
//
// Split out of the cron route so the decision is a pure function with tests.
// The route around it does I/O (query, kick, log) and is not unit-testable; this
// part is the actual policy and is the part that can be wrong silently.

/**
 * A `running` job older than this has outlived any worker invocation
 * (/api/generate caps at 800s), so its worker is dead and re-kicking is safe.
 * The worker is idempotent and resumable, so a re-kick converges on the missing
 * documents rather than duplicating the finished ones.
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000

export interface BackstopJob {
  id: string
  order_id: string
  status: string
  started_at: string | null
}

export interface KickDecision {
  job: BackstopJob
  /** Why this job is being kicked — carried into the log line. */
  reason: 'queued' | 'stuck'
}

/**
 * Decide which jobs need a worker kick.
 *
 * - `queued`  — the trigger's best-effort kick never landed. Always kick.
 * - `running` — only if it started long enough ago that its worker must be dead.
 *   A `running` job with no `started_at` is treated as stuck rather than left
 *   alone: something wrote the row without stamping a start, and the alternative
 *   is a paid order that never generates and never gets retried.
 * - anything else (`completed`, `failed`) — never kicked.
 */
export function selectJobsToKick(
  jobs: readonly BackstopJob[],
  nowMs: number,
  stuckAfterMs: number = STUCK_AFTER_MS,
): KickDecision[] {
  const decisions: KickDecision[] = []

  for (const job of jobs) {
    if (job.status === 'queued') {
      decisions.push({ job, reason: 'queued' })
      continue
    }
    if (job.status !== 'running') continue

    const startedMs = job.started_at ? new Date(job.started_at).getTime() : NaN
    const isUnstamped = Number.isNaN(startedMs)
    if (isUnstamped || nowMs - startedMs >= stuckAfterMs) {
      decisions.push({ job, reason: 'stuck' })
    }
  }

  return decisions
}
