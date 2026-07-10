-- ============================================================
-- ReadyPack — Stage 3: flag sign-off + completion read-me
-- Migration 011: the audit type for the meaningful held-flag sign-off, and the
-- email type for the completion "read-me" email (which also serves as the
-- send-once idempotency marker).
--
-- Additive only (extends two CHECK constraints). No data change, reversible.
-- Apply in Supabase BEFORE deploying the Stage 3 code (the 010 lesson).
--
-- NOTE: this migration is FINALISED as Stage 3 is built — 3d (the query loop) may
-- append its own audit types here before the single deploy.
-- ============================================================

-- ─────────────────────────────────────────
-- audit_events.action_type — carry forward every existing type (001 → 008) and
-- add 'flag_signed_off' (a human accepted-with-justification / remediated a
-- held high-risk flag, recorded on the flag + here).
-- ─────────────────────────────────────────
ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_action_type_check;

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_action_type_check
  CHECK (action_type IN (
    'login', 'case_view', 'generate_rerun', 'approve_delivery',
    'delivery_resend', 'escalation_set', 'escalation_cleared',
    'intake_answer_view', 'document_edit', 'template_edit',
    'refund_issued', 'data_deletion_requested', 'data_export_requested',
    'settings_change',
    'request_more_info', 'mark_flag_resolved', 'override_decision',
    'customer_revision_requested', 'customer_pack_approved',
    'info_answered', 'info_resolved',
    'customer_document_approved', 'document_revised', 'revision_released',
    'flag_signed_off'
  ));

-- ─────────────────────────────────────────
-- customer_communications.email_type — carry forward the original set (001) and
-- add 'pack_complete': the final "all done, read-me attached" email. A row of
-- this type is written exactly once per order, so it also guards the completion
-- email + read-me against a double-send (approve-all vs last per-doc approval).
-- ─────────────────────────────────────────
ALTER TABLE public.customer_communications
  DROP CONSTRAINT IF EXISTS customer_communications_email_type_check;

ALTER TABLE public.customer_communications
  ADD CONSTRAINT customer_communications_email_type_check
  CHECK (email_type IN (
    'magic_link', 'needs_more_info', 'delivery',
    'escalation_notice', 'welcome',
    'pack_complete'
  ));

-- ─────────────────────────────────────────
-- Send-once guard: at most one 'pack_complete' row per order. The completion email
-- fires from two portal paths (approve-all + the last per-doc approval); the code
-- claims the send by inserting this marker FIRST, so this unique partial index makes
-- it an atomic lock — a second concurrent caller hits a 23505 conflict and bails,
-- and the read-me email + attachment can never double-send.
-- ─────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS customer_communications_pack_complete_once
  ON public.customer_communications (order_id)
  WHERE email_type = 'pack_complete';

-- ─────────────────────────────────────────
-- Stage 3d: the query loop. A held 'query' flag (currently vendor_dpa) is asked of
-- the customer as an info-request carrying risk_flag_id (column added in 010); the
-- answer folds into the affected document (auto-regenerate + scoped re-QA) and
-- closes the flag as resolution_type='query'.
--
--  • audit types: 'flag_queried' (the AI-drafted question was sent, tied to the flag)
--    and 'query_auto_regenerated' (the answer folded into the doc).
--  • info_requests.regenerated_at: the ONE-REGENERATE lock — set atomically before
--    the fold-in runs (UPDATE ... WHERE regenerated_at IS NULL), so a re-kick or a
--    concurrent worker is a no-op. Also the admin's "answered, not yet processed" signal.
-- Additive, nullable, reversible.
-- ─────────────────────────────────────────
ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_action_type_check;

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_action_type_check
  CHECK (action_type IN (
    'login', 'case_view', 'generate_rerun', 'approve_delivery',
    'delivery_resend', 'escalation_set', 'escalation_cleared',
    'intake_answer_view', 'document_edit', 'template_edit',
    'refund_issued', 'data_deletion_requested', 'data_export_requested',
    'settings_change',
    'request_more_info', 'mark_flag_resolved', 'override_decision',
    'customer_revision_requested', 'customer_pack_approved',
    'info_answered', 'info_resolved',
    'customer_document_approved', 'document_revised', 'revision_released',
    'flag_signed_off',
    'flag_queried', 'query_auto_regenerated'
  ));

ALTER TABLE public.info_requests
  ADD COLUMN IF NOT EXISTS regenerated_at TIMESTAMPTZ;
