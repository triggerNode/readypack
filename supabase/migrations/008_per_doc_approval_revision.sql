-- ============================================================
-- ReadyPack — Per-document approval + the revision loop
-- Migration 008.
--
-- Adds the per-document state the hybrid approval model needs:
--   • generated_documents.delivery_status gains 'in_revision' — a
--     single document the customer asked us to change (and which is
--     therefore NOT approvable/downloadable until we re-release it).
--   • The cases VIEW gains per-document COUNT columns so the admin
--     list/header and the progress screen can show PARTIAL completion
--     ("7 of 9 final · 1 in revision") without every screen having to
--     re-derive it. The order's own delivery_status stays the high-level
--     state; 'delivered' now means "all 9 documents are final".
--   • audit_events.action_type gains the new per-document events.
--
-- Per-document delivery_status values after this migration:
--   pending      — Draft, awaiting the customer's review (initial + re-release)
--   in_revision  — customer requested changes; with our team
--   delivered    — Final (customer-approved, watermark removed, downloadable)
--   approved     — legacy/unused (kept in the constraint for back-compat)
--   failed       — generation failed
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Allow 'in_revision' on the per-document delivery_status.
-- ─────────────────────────────────────────
ALTER TABLE public.generated_documents
  DROP CONSTRAINT IF EXISTS generated_documents_delivery_status_check;

ALTER TABLE public.generated_documents
  ADD CONSTRAINT generated_documents_delivery_status_check
  CHECK (delivery_status IN ('pending', 'approved', 'in_revision', 'delivered', 'failed'));

-- ─────────────────────────────────────────
-- 2. Recreate the cases VIEW with per-document count columns.
--    DROP first because the column shape changes (CREATE OR REPLACE
--    VIEW fails when the column set differs).
--    Everything below is identical to migration 002 except for the
--    four new doc-count columns at the end.
-- ─────────────────────────────────────────
DROP VIEW IF EXISTS public.cases;

CREATE VIEW public.cases AS
SELECT
  o.id                                                          AS id,
  o.user_id,
  o.billing_org_id,
  o.client_org_id,
  o.plan_selected,
  o.payment_status,
  o.delivery_status,
  o.stripe_payment_id,
  o.stripe_session_id,
  o.created_at                                                  AS order_created_at,
  o.updated_at                                                  AS order_updated_at,
  (o.created_at + INTERVAL '48 hours')                          AS delivery_deadline,

  s.id                                                          AS submission_id,
  s.completion_status,
  s.risk_level,
  s.last_saved,
  s.section_completion,
  s.raw_answers,
  s.normalised_answers,

  u.email                                                       AS customer_email,
  u.company_name,
  u.trading_name,

  client_org.name                                               AS client_org_name,
  client_org.type                                               AS client_org_type,

  billing_org.name                                              AS billing_org_name,
  billing_org.type                                              AS billing_org_type,
  billing_org.partner_display_name,

  CASE
    WHEN o.delivery_status = 'delivered' THEN 'delivered'
    WHEN o.delivery_status = 'escalated' THEN 'flagged'
    WHEN EXISTS (
      SELECT 1 FROM public.risk_flags rf
      WHERE rf.submission_id = s.id
        AND rf.status = 'open'
        AND rf.severity IN ('high', 'critical')
    ) THEN 'flagged'
    WHEN o.delivery_status = 'approved' THEN 'ready'
    WHEN o.delivery_status IN ('generating', 'qa_review') THEN 'in_progress'
    ELSE 'pending'
  END                                                           AS status,

  (SELECT COUNT(*) FROM public.risk_flags rf
     WHERE rf.submission_id = s.id AND rf.status = 'open')      AS open_flag_count,

  (SELECT COUNT(*) FROM public.risk_flags rf
     WHERE rf.submission_id = s.id
       AND rf.status = 'open'
       AND rf.severity = 'critical')                            AS critical_flag_count,

  -- ── Per-document completion counts (per-doc approval / revision) ──
  -- Drive the admin partial-completion display + the progress screen.
  (SELECT COUNT(*) FROM public.generated_documents gd
     WHERE gd.submission_id = s.id)                             AS docs_total,
  (SELECT COUNT(*) FROM public.generated_documents gd
     WHERE gd.submission_id = s.id
       AND gd.delivery_status = 'delivered')                    AS docs_final,
  (SELECT COUNT(*) FROM public.generated_documents gd
     WHERE gd.submission_id = s.id
       AND gd.delivery_status = 'in_revision')                  AS docs_in_revision

FROM public.orders o
LEFT JOIN public.intake_submissions s ON s.order_id = o.id
LEFT JOIN public.users u              ON u.id = o.user_id
LEFT JOIN public.organisations client_org  ON client_org.id = o.client_org_id
LEFT JOIN public.organisations billing_org ON billing_org.id = o.billing_org_id;

ALTER VIEW public.cases SET (security_invoker = true);

GRANT SELECT ON public.cases TO authenticated, service_role;

-- ─────────────────────────────────────────
-- 3. Extend audit_events.action_type for the per-document events.
--    Carries forward every previously valid type (001 + 002 + 004 + 007)
--    and adds:
--      • customer_document_approved — customer approved ONE document
--      • document_revised           — admin regenerated a doc with feedback
--      • revision_released          — admin re-released a revised doc for review
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
    'customer_document_approved', 'document_revised', 'revision_released'
  ));
