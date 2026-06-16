-- ============================================================
-- Readypack — Stage 7 / Admin Queue
-- Replaces the cases VIEW from 001_initial_schema.sql with the
-- shape consumed by the admin queue UI:
--   • exposes `id`     (renamed from `order_id`) as the primary key
--   • exposes `status` (computed) — drives filter tabs + sorting
--   • exposes `open_flag_count` / `critical_flag_count`
--   • exposes raw / normalised intake answers for the detail page
--
-- Also extends `audit_events.action_type` with the action types the
-- admin Server Actions write (request_more_info, mark_flag_resolved,
-- override_decision). Existing types are preserved.
-- ============================================================

-- ─────────────────────────────────────────
-- VIEW: public.cases
-- DROP first because the column shape changes (CREATE OR REPLACE
-- VIEW fails when column names/types differ from the prior version).
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

  -- High-level computed status. Precedence (top wins):
  --   delivered  > flagged (escalated OR has open high/critical flag)
  --              > ready (approved) > in_progress (generating/qa_review)
  --              > pending (everything else)
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
       AND rf.severity = 'critical')                            AS critical_flag_count

FROM public.orders o
LEFT JOIN public.intake_submissions s ON s.order_id = o.id
LEFT JOIN public.users u              ON u.id = o.user_id
LEFT JOIN public.organisations client_org  ON client_org.id = o.client_org_id
LEFT JOIN public.organisations billing_org ON billing_org.id = o.billing_org_id;

-- Views inherit RLS from underlying tables only when created with
-- security_invoker. Admin queries flow through the service-role client
-- (which bypasses RLS), but this keeps the view predictable if it is
-- ever queried with a user-scoped client.
ALTER VIEW public.cases SET (security_invoker = true);

GRANT SELECT ON public.cases TO authenticated, service_role;

-- ─────────────────────────────────────────
-- Extend audit_events.action_type CHECK constraint so the admin
-- Server Actions can write their own audit trail entries.
--   • request_more_info     — Request More Info action
--   • mark_flag_resolved    — Mark Flag Resolved action
--   • override_decision     — Override & Note action
--   • case_view (existing), approve_delivery (existing),
--     escalation_set (existing) cover the rest.
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
    'request_more_info', 'mark_flag_resolved', 'override_decision'
  ));
