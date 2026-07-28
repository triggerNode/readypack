/**
 * Retry policy for the Stripe webhook.
 *
 * Stripe decides whether to redeliver an event purely from our HTTP status. A 2xx
 * means "handled, never send this again". A 5xx means "we failed, please retry" —
 * Stripe then backs off over roughly three days before giving up.
 *
 * Getting that choice wrong costs a PAID ORDER, so the default here is deliberately
 * RETRY: anything we do not positively recognise as unfixable is treated as
 * transient. An unnecessary retry is cheap, because the handler resumes rather than
 * duplicating work. A missed retry means money taken and nothing delivered.
 *
 * Only two things are treated as permanent:
 *   1. Something we explicitly decided is unfixable — a malformed event payload.
 *      Retrying delivers the identical bytes, so it can only fail the same way.
 *   2. A Postgres data or integrity error (SQLSTATE class 22 or 23). Those mean the
 *      row we are writing is wrong, not that the database is away.
 *
 * Deliberately NOT permanent: class 08 (connection), 40 (deadlock / serialization),
 * 53 (out of resources), 57 (operator intervention — this is what a paused or
 * restarting Supabase looks like), every network error, and every Resend failure.
 */

/** SQLSTATE classes where a retry writes the same bad row and fails identically. */
const PERMANENT_SQLSTATE_CLASSES = ['22', '23'] as const

function sqlstateOf(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null) return null
  const code = (cause as { code?: unknown }).code
  return typeof code === 'string' && /^[0-9A-Za-z]{5}$/.test(code) ? code : null
}

/** True when a Postgres error code means the data is wrong rather than the DB unreachable. */
export function isPermanentSqlstate(code: string | null | undefined): boolean {
  if (!code) return false
  return PERMANENT_SQLSTATE_CLASSES.some((cls) => code.startsWith(cls))
}

/** Postgres unique-violation. On `orders.stripe_session_id` it means a concurrent
 *  delivery of the same event won the race — a success, not a failure. */
export const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(cause: unknown): boolean {
  return sqlstateOf(cause) === UNIQUE_VIOLATION
}

/**
 * An error raised by one named step of webhook provisioning.
 *
 * `permanent` is decided at construction so the decision sits next to the thing
 * that knows the context, and the route is left with a single boolean to read.
 */
export class WebhookStepError extends Error {
  readonly permanent: boolean
  readonly sqlstate: string | null

  constructor(
    step: string,
    cause?: { message?: string | null; code?: string | null } | null,
    options?: { permanent?: boolean },
  ) {
    super(`${step}: ${cause?.message ?? 'unknown error'}`)
    this.name = 'WebhookStepError'
    this.sqlstate = cause?.code ?? null
    this.permanent = options?.permanent ?? isPermanentSqlstate(this.sqlstate)
  }
}

/** A payload we can never process, no matter how many times Stripe sends it. */
export function permanentFailure(reason: string): WebhookStepError {
  return new WebhookStepError('unprocessable event', { message: reason }, { permanent: true })
}

/**
 * The single decision the route makes: should Stripe send this event again?
 *
 * Unknown error shapes answer `true` on purpose — see the note at the top.
 */
export function shouldRetry(err: unknown): boolean {
  if (err instanceof WebhookStepError) return !err.permanent
  return !isPermanentSqlstate(sqlstateOf(err))
}
