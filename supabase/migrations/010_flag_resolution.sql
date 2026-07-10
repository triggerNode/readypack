-- ============================================================
-- ReadyPack — Flag resolution model + flag <-> info-request link
-- Migration 010: give a risk flag a real closure.
--
-- Today a flag only has a `status` (open/acknowledged/resolved/escalated) —
-- "resolving" one records no reason, no author, no decision type. This migration
-- adds the columns that make a closure MEAN something:
--   • resolution_type — HOW the flag closed:
--       handled   — the pack already addresses it; no admin action (auto-set at
--                   intake for the no-action flags — see lib/risk/resolution.ts)
--       query     — a genuine gap we asked the customer about
--       accept    — a human signed it off, accepting the risk (needs a note)
--       remediate — a human signed it off, with a remediation (needs a note)
--   • resolution_note — the justification (required for accept / remediate at sign-off)
--   • resolved_by     — who signed it off (NULL = closed automatically by the system)
--   • resolved_at     — when it closed
--   • code            — the deterministic rule that raised it (stable identity used by
--                       the closure classifier + the customer "what we noticed" read-me)
--
-- Plus info_requests.risk_flag_id: links a customer's answer back to the exact flag
-- it resolves (a `query`-path flag) so the answer can close it and regenerate the
-- affected document (Stage 3).
--
-- Additive + reversible (nullable columns, no backfill). NOT retroactive: existing
-- flags keep NULL resolution fields and their current status.
-- ============================================================

-- ─────────────────────────────────────────
-- risk_flags: resolution columns
-- ─────────────────────────────────────────
ALTER TABLE public.risk_flags
  ADD COLUMN IF NOT EXISTS resolution_type TEXT
    CHECK (resolution_type IS NULL OR resolution_type IN ('handled', 'query', 'accept', 'remediate')),
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,
  -- Free text (not a CHECK): the app-level code union (lib/risk/score.ts) may grow
  -- as new deterministic rules are added; the DB should not need an alter each time.
  ADD COLUMN IF NOT EXISTS code            TEXT;

-- ─────────────────────────────────────────
-- info_requests: link an answer to the flag it resolves
-- ─────────────────────────────────────────
ALTER TABLE public.info_requests
  ADD COLUMN IF NOT EXISTS risk_flag_id UUID REFERENCES public.risk_flags(id) ON DELETE SET NULL;

-- FK lookup ("which answer closes this flag?") + supports the ON DELETE SET NULL.
-- Partial: only the small subset of requests that are tied to a flag.
CREATE INDEX IF NOT EXISTS info_requests_risk_flag_id_idx
  ON public.info_requests (risk_flag_id)
  WHERE risk_flag_id IS NOT NULL;
