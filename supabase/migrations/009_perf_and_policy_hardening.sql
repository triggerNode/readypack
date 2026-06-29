-- 009_perf_and_policy_hardening.sql
--
-- D1 (performance) + D2 (security) hardening pass.
--
-- APPLY IN SUPABASE SQL EDITOR BEFORE DEPLOYING the matching app code (same as
-- migrations 003-008). All statements are idempotent (IF [NOT] EXISTS / DROP IF
-- EXISTS), so re-running is safe.
--
-- ── Part 1: hot-path indexes (D1) ──────────────────────────────────────────
-- The original 001 schema declared foreign keys but NO indexes. Postgres does
-- not auto-index FK columns, so every portal load + poll (which filters these
-- columns every 4-12s per open tab) does a sequential scan. Invisible at a
-- handful of rows; a real bottleneck at scale. These cover the columns the
-- portal feed loader, the generation queue/cron, and the cases view filter on.

CREATE INDEX IF NOT EXISTS intake_submissions_order_id_idx
  ON public.intake_submissions (order_id);

CREATE INDEX IF NOT EXISTS generated_documents_submission_id_idx
  ON public.generated_documents (submission_id);

CREATE INDEX IF NOT EXISTS document_generation_jobs_submission_id_idx
  ON public.document_generation_jobs (submission_id);

CREATE INDEX IF NOT EXISTS customer_communications_order_id_idx
  ON public.customer_communications (order_id);

CREATE INDEX IF NOT EXISTS qa_reports_submission_id_idx
  ON public.qa_reports (submission_id);

-- Email lookup used by the Stripe webhook (findOrCreateAuthUser) and /resume
-- (authUserExists), replacing the previous full listUsers() scans.
CREATE INDEX IF NOT EXISTS users_email_idx
  ON public.users (email);

-- ── Part 2: tighten over-permissive RLS write policies (D2) ────────────────

-- MED-5: scan_reports allowed ANY anonymous client to INSERT arbitrary rows
-- (WITH CHECK (TRUE)). The /api/gap-scan feature is still a stub, so there is no
-- legitimate client-side insert yet. Remove the open policy until the real,
-- validated + rate-limited API route ships; server-side writes use the
-- service-role client (which bypasses RLS) and are unaffected.
DROP POLICY IF EXISTS "anyone_can_create_scan_report" ON public.scan_reports;

-- ── Part 3: normalise stored email (D2 HIGH-1 robustness) ──────────────────
-- The webhook + /resume now look up public.users by lower-cased email. Supabase
-- Auth already stores emails lower-cased, but make the trigger explicit so the
-- lookup can never miss on a casing mismatch, and backfill any existing rows.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, LOWER(NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.users SET email = LOWER(email) WHERE email <> LOWER(email);

-- MED-6: case_revisions had a customer-facing INSERT policy, but every real
-- revision write goes through a server action using the service-role client.
-- The policy is dead weight that would silently permit a direct client-side
-- insert (with unvalidated JSONB) if a future bug used the anon client. Remove
-- it to shrink the write surface; the SELECT policy (customers read own) stays.
DROP POLICY IF EXISTS "customers_insert_own_revisions" ON public.case_revisions;
