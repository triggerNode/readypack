-- ============================================================
-- ReadyPack — Make Stripe webhook retries actually safe
-- Migration 012: enforce order idempotency in the DATABASE, and record whether
-- the customer ever received their access email.
--
-- WHY THIS EXISTS
--
-- The webhook used to catch every handler error and return 200, so Stripe never
-- retried and a transient database blip silently lost a paid order. The fix is to
-- return 500 on transient failures so Stripe redelivers — but that is only safe if
-- redelivery cannot duplicate anything, and until now the guard was a plain
-- SELECT-then-INSERT in application code with no constraint behind it. That is a
-- read-then-write race: two deliveries of the same event arriving together would
-- both find "no order" and both insert one. Turning retries ON without this
-- migration would have made the problem worse, not better.
--
--   • orders_stripe_session_id_key — one order per Stripe Checkout session, full
--     stop. Partial (WHERE NOT NULL) because dev/admin test orders are created
--     without a session id and there may be many of those. Doubles as the index
--     for the webhook's own lookup, which was a sequential scan.
--
--   • orders.welcome_email_sent_at — the access email is the LAST step of
--     provisioning and the one most likely to fail on its own (Resend down, or the
--     free tier's 100/day cap returning 429). Without this marker a retry would
--     find the order already created, return early, and the customer would have
--     paid and never received their magic link. With it, a retry resumes at the
--     email instead of skipping it — and a NULL here on a paid order is a
--     queryable "this customer is locked out" alert.
--
-- Both changes are additive and idempotent. Verified before writing: 19 orders,
-- 0 null session ids, 0 duplicates, so the unique index applies cleanly.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.welcome_email_sent_at IS
  'When the post-payment access email was accepted by Resend. NULL on a paid order means the customer has no way in — the Stripe webhook resumes at this step on retry.';

-- Existing paid orders predate the column. Backfill them as already-emailed so a
-- replayed historical event cannot email a customer from weeks ago a second time.
UPDATE public.orders
   SET welcome_email_sent_at = created_at
 WHERE welcome_email_sent_at IS NULL
   AND payment_status = 'paid';
