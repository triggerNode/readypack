-- ============================================================
-- ReadyPack — Customer Portal Revisions & Approvals
-- Migration 004: case_revisions table + customer_communications
-- enum extensions + audit action types.
--
-- Captures customer-driven revision requests scoped to specific
-- documents inside the pack, plus the eventual approval event that
-- finalises delivery. This replaces the earlier "single feedback
-- textbox" assumption: customers now select N of the 9 documents
-- and the revision request carries that scope explicitly so the
-- reviewer can re-render only what changed.
-- ============================================================

-- ─────────────────────────────────────────
-- TABLE: case_revisions
-- One row per customer-initiated revision (or approval) event.
-- A single order may accumulate multiple revision rounds before
-- the final approval. The order's delivery_status is the source
-- of truth for the current state; this table is the audit trail.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_revisions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  submission_id      UUID REFERENCES public.intake_submissions(id) ON DELETE SET NULL,
  user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Document types selected for revision. Empty array means
  -- "whole pack" (or, for approval events, "all 9 approved").
  document_types     TEXT[] NOT NULL DEFAULT '{}',
  feedback_text      TEXT,
  -- Lifecycle of a single revision request.
  --   submitted   — customer just hit "Request revision"
  --   in_review   — admin opened it / began work
  --   completed   — admin re-ran generation and re-delivered
  --   approved    — terminal: customer approved the pack
  --   cancelled   — withdrawn by customer or superseded
  status             TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'in_review', 'completed', 'approved', 'cancelled')),
  -- Distinguishes a request-for-changes from the final approval event
  -- in the same audit table.
  kind               TEXT NOT NULL DEFAULT 'revision'
                     CHECK (kind IN ('revision', 'approval')),
  resolved_at        TIMESTAMPTZ,
  resolved_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_revisions_order_id_idx
  ON public.case_revisions (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS case_revisions_status_idx
  ON public.case_revisions (status)
  WHERE status IN ('submitted', 'in_review');

-- ─────────────────────────────────────────
-- RLS — customers can read/insert their own revisions.
-- Server-side admin work flows through the service-role client.
-- ─────────────────────────────────────────
ALTER TABLE public.case_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own_revisions" ON public.case_revisions;
CREATE POLICY "customers_read_own_revisions" ON public.case_revisions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_insert_own_revisions" ON public.case_revisions;
CREATE POLICY "customers_insert_own_revisions" ON public.case_revisions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- Extend audit_events.action_type so the portal flow can write
-- its own audit trail entries without breaking the existing
-- enum. Two new types:
--   • customer_revision_requested — customer hit "Request revision"
--   • customer_pack_approved       — customer approved the pack
-- All previously valid action types remain valid.
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
    'customer_revision_requested', 'customer_pack_approved'
  ));

-- updated_at trigger ───────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS case_revisions_set_updated_at ON public.case_revisions;
CREATE TRIGGER case_revisions_set_updated_at
  BEFORE UPDATE ON public.case_revisions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
