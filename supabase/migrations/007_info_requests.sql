-- ============================================================
-- ReadyPack — Portal "Request More Info" remediation (ST2-4)
-- Migration 007: info_requests table + audit action types.
--
-- Fixes the "Request More Info" limbo: today the admin's ask goes
-- out only by email and the portal gives the customer no structured
-- way to answer it. This table is the single source of truth for
-- each outstanding question (modelled on Stripe's requirements /
-- outstanding-items pattern). The email becomes just the notification.
--
-- Lifecycle of one request:
--   open       — admin asked; awaiting the customer (portal shows it,
--                the relevant card pulses, progress screen → "Action needed")
--   submitted  — customer answered; back with the compliance team
--   resolved   — admin processed the answer (re-generated / cleared); cleared
--   cancelled  — withdrawn / superseded
-- ============================================================

-- ─────────────────────────────────────────
-- TABLE: info_requests
-- One row per outstanding question. document_type is nullable: a
-- NULL request is case-level (shown as a top-level banner in the
-- portal); a set value ties the request to one of the 9 document
-- cards so that card can flag/pulse.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.info_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  submission_id      UUID REFERENCES public.intake_submissions(id) ON DELETE SET NULL,
  -- NULL = case-level; otherwise one of the 9 document types.
  document_type      TEXT
                     CHECK (document_type IS NULL OR document_type IN (
                       'ai_use_statement', 'privacy_notice_addendum', 'ai_risk_register',
                       'dpia_lite', 'internal_ai_use_policy', 'customer_disclosure_snippets',
                       'vendor_ai_register', 'complaints_procedure_pack', 'procurement_response_memo'
                     )),
  -- The plain-English question shown to the customer.
  prompt             TEXT NOT NULL,
  -- Optional closed-ended choices (tick boxes / select) the customer may pick.
  options            JSONB NOT NULL DEFAULT '[]',
  -- The customer's answer.
  answer_text        TEXT,
  answer_selections  JSONB NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'submitted', 'resolved', 'cancelled')),
  created_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- admin who asked
  answered_at        TIMESTAMPTZ,
  answered_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- customer who answered
  resolved_at        TIMESTAMPTZ,
  resolved_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS info_requests_order_id_idx
  ON public.info_requests (order_id, created_at DESC);

-- Hot path: "are there any outstanding items for this order?" drives the
-- portal flagging and the progress-screen "Action needed" state.
CREATE INDEX IF NOT EXISTS info_requests_open_idx
  ON public.info_requests (order_id)
  WHERE status IN ('open', 'submitted');

-- ─────────────────────────────────────────
-- RLS — customers can read their own requests. Admin work (create,
-- resolve) and the customer's answer write both flow through the
-- service-role client behind authorising server actions, so no
-- customer INSERT/UPDATE policy is required here.
-- ─────────────────────────────────────────
ALTER TABLE public.info_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own_info_requests" ON public.info_requests;
CREATE POLICY "customers_read_own_info_requests" ON public.info_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- Extend audit_events.action_type for the remediation flow.
-- Carries forward every previously valid type (001 + 004) and adds:
--   • info_answered  — customer answered an info request
--   • info_resolved  — admin marked an info request resolved
-- (The initial "ask" reuses the existing 'request_more_info' type.)
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
    'info_answered', 'info_resolved'
  ));

-- updated_at trigger ───────────────────────
-- set_updated_at() is created in migration 004; reuse it.
DROP TRIGGER IF EXISTS info_requests_set_updated_at ON public.info_requests;
CREATE TRIGGER info_requests_set_updated_at
  BEFORE UPDATE ON public.info_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
