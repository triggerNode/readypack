// lib/documents/generation-queue.ts
// Durable enqueue for document generation (#7).
//
// Replaces the old fire-and-forget `fetch('/api/generate')` trigger, which was
// unreliable on serverless: once the originating request returned, the platform
// could freeze the instance before the outbound kick even left. Instead we write
// a durable `queued` job row (the source of truth) and best-effort kick the
// worker now. If the kick never lands, the Vercel Cron drain (/api/cron/
// process-generation) finds the queued job and runs it. The worker (/api/generate)
// is idempotent and resumable, so re-invocation converges rather than duplicating.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { INTERNAL_SECRET_HEADER, getInternalSecret } from '@/lib/auth/internal-secret'
import { waitUntil } from '@vercel/functions'

const DOC_TOTAL = 9

export interface EnqueueResult {
  enqueued: boolean
  jobId?: string
  reason?: string
}

/**
 * Ensure a generation job exists for this order and kick the worker.
 * Idempotent: no-op if the pack is already complete or a job is already active.
 */
export async function enqueueGeneration(orderId: string): Promise<EnqueueResult> {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, client_org_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return { enqueued: false, reason: 'order not found' }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!submission) return { enqueued: false, reason: 'no submission' }

  // Already complete? Don't enqueue.
  const { count: docCount } = await supabaseAdmin
    .from('generated_documents')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id)
  if ((docCount ?? 0) >= DOC_TOTAL) {
    return { enqueued: false, reason: 'already complete' }
  }

  // Already has an active job? Reuse it (don't duplicate) but still kick.
  const { data: active } = await supabaseAdmin
    .from('document_generation_jobs')
    .select('id')
    .eq('submission_id', submission.id)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let jobId = active?.id as string | undefined
  if (!jobId) {
    const { data: job, error } = await supabaseAdmin
      .from('document_generation_jobs')
      .insert({
        order_id: orderId,
        submission_id: submission.id,
        org_id: order.client_org_id,
        status: 'queued',
        attempt_count: 0,
      })
      .select('id')
      .single()
    if (error || !job) return { enqueued: false, reason: error?.message ?? 'job insert failed' }
    jobId = job.id
  }

  kickWorker(orderId)
  return { enqueued: true, jobId }
}

/**
 * Kick the generation worker. A fresh inbound request to /api/generate is a new
 * function invocation that runs to completion independently of the caller.
 *
 * The catch on serverless: a bare `void fetch(...)` is frozen the instant the
 * caller's handler returns, so the request never actually leaves the instance —
 * which is exactly why queued jobs sat unstarted and packs never generated
 * (both the inline kick AND the cron backstop fired this same dead fetch). We
 * now hand the request to `waitUntil`, which keeps the instance alive until the
 * kick has been delivered, so it reliably reaches the worker. The worker has its
 * own (800s) invocation, so the caller letting go after delivery never stops it.
 *
 * `fallbackOrigin` is used only when NEXT_PUBLIC_APP_URL is unset. It is NOT a
 * preferred source, and briefly was: the cron passed its own request origin, but
 * Vercel Cron invokes the DEPLOYMENT url (readypack-<hash>.vercel.app), which
 * deployment protection answers with 401 while the production alias is public.
 * That turned a working kick into a refused one. The stable public URL is the
 * right target; the request origin is only a last resort.
 *
 * Never throws and never rejects: it resolves to an outcome the caller can log.
 * Callers that do not care may ignore the promise.
 */
export type KickOutcome = 'delivered' | 'refused' | 'unreachable' | 'not-dispatched' | 'skipped'

export function kickWorker(orderId: string, fallbackOrigin?: string): Promise<KickOutcome> {
  // Test-only kill-switch. When the E2E suite runs the routing/gating layer it
  // needs to prove that generation gets *triggered* for auto-gen cases (a queued
  // job row is written by enqueueGeneration) WITHOUT actually spending Claude
  // credit or depending on a reliable Supabase Storage upload. This flag is only
  // ever set by the Playwright webServer (see playwright.config.ts) and is unset
  // whenever RUN_REAL_GENERATION=1, so the deliberate end-to-end generation layer
  // and production are entirely unaffected. With it set, the 'queued' job stays
  // queued (jobCount still proves the gating decision) and no worker fires.
  if (process.env.E2E_SKIP_REAL_GENERATION === '1') return Promise.resolve('skipped')

  // `||` not `??`: an env var present but EMPTY is effectively unset, and `??`
  // would happily build "/api/generate" and post it nowhere.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || 'http://localhost:3000'
  const target = `${appUrl}/api/generate`

  // Report the outcome. This used to be `.catch(() => undefined)` — a kick that
  // never left the instance, was refused, or hit the wrong host looked exactly
  // like a delivered one, so a dead backstop was indistinguishable from an idle
  // healthy one and stayed invisible. A paid order that silently never generates
  // is the worst failure this system has, so it gets a log line.
  // The whole body is guarded because `fetch` can throw SYNCHRONOUSLY — a base
  // URL with no scheme ("readypack.co.uk") fails URL parsing before any promise
  // exists. That is precisely the misconfiguration this function defends
  // against, and an escaping throw would abort the caller: the cron loop would
  // stop kicking every job after the bad one, and enqueueGeneration would fail
  // having already written the job row.
  let delivered: Promise<KickOutcome>
  try {
    delivered = fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SECRET_HEADER]: getInternalSecret() ?? '',
      },
      body: JSON.stringify({ order_id: orderId, _internal: true }),
    })
      .then((res): KickOutcome => {
        if (!res.ok) {
          console.error(
            `[kick] worker refused order ${orderId}: HTTP ${res.status} from ${target}`,
          )
          return 'refused'
        }
        return 'delivered'
      })
      .catch((error): KickOutcome => {
        console.error(
          `[kick] worker UNREACHABLE for order ${orderId} at ${target}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        return 'unreachable'
      })
  } catch (error) {
    console.error(
      `[kick] could not even dispatch for order ${orderId} at ${target}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return Promise.resolve('not-dispatched')
  }

  try {
    // On Vercel: keep this instance alive until the kick is delivered.
    waitUntil(delivered)
  } catch {
    // Not in a Vercel request scope (local dev / tests). The fetch still fires;
    // the long-lived dev server keeps it alive without waitUntil.
  }

  return delivered
}
