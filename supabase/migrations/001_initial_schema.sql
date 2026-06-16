-- ============================================================
-- Readypack — Initial Schema
-- Run this in the Supabase SQL Editor (or via Supabase CLI).
-- Idempotent: safe to re-run (uses IF NOT EXISTS where possible).
-- ============================================================

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- TABLE: organisations
-- Every user belongs to one org. Direct buyers get an org
-- auto-created at purchase (transparent to them). Partners
-- buy an org with credit_balance. The platform org = ReadyPack.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('platform', 'direct', 'partner', 'client')),
  credit_balance        INTEGER NOT NULL DEFAULT 0,
  plan                  TEXT,
  billing_email         TEXT,
  -- Shown in co-branded questionnaire header and delivery emails (partners only)
  partner_display_name  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: users
-- Mirrors auth.users. Trigger-populated on signup.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  company_name   TEXT,
  trading_name   TEXT,
  role           TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'partner')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create public.users row when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─────────────────────────────────────────
-- TABLE: organisation_members
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- ─────────────────────────────────────────
-- HELPER FUNCTIONS (used by RLS policies)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS UUID AS $$
  SELECT om.org_id
  FROM public.organisation_members om
  WHERE om.user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auth_user_org_type()
RETURNS TEXT AS $$
  SELECT o.type
  FROM public.organisations o
  JOIN public.organisation_members om ON om.org_id = o.id
  WHERE om.user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────
-- TABLE: orders
-- One order per purchase. billing_org_id = who paid.
-- client_org_id = whose documents these are.
-- For direct buyers both are the same org.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id),
  billing_org_id    UUID NOT NULL REFERENCES public.organisations(id),
  client_org_id     UUID NOT NULL REFERENCES public.organisations(id),
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  plan_selected     TEXT NOT NULL CHECK (plan_selected IN ('solo', 'team', 'adviser')),
  amount_pence      INTEGER,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  delivery_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (delivery_status IN (
                      'pending', 'generating', 'qa_review', 'escalated',
                      'approved', 'delivered', 'failed'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: intake_submissions
-- One per order. Autosaves at section level.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id),
  order_id            UUID NOT NULL REFERENCES public.orders(id),
  org_id              UUID NOT NULL REFERENCES public.organisations(id),
  completion_status   TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (completion_status IN ('not_started', 'in_progress', 'submitted')),
  last_saved          TIMESTAMPTZ,
  -- { "1": true, "2": false, ... } — which of 10 sections are complete
  section_completion  JSONB NOT NULL DEFAULT '{}',
  raw_answers         JSONB NOT NULL DEFAULT '{}',
  normalised_answers  JSONB NOT NULL DEFAULT '{}',
  risk_level          TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: ai_tools
-- One row per AI tool declared in Section 3/4 of the intake.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_tools (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id               UUID NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  org_id                      UUID NOT NULL REFERENCES public.organisations(id),
  tool_name                   TEXT NOT NULL,
  vendor                      TEXT,
  purpose                     TEXT,
  internal_or_customer_facing TEXT CHECK (internal_or_customer_facing IN (
                                'internal', 'customer_facing', 'both'
                              )),
  data_involved               TEXT[],
  ai_interaction_type         TEXT,  -- e.g. generative, classification, recommendation
  decision_making_role        TEXT CHECK (decision_making_role IN (
                                'none', 'informing', 'automated'
                              )),
  jurisdiction                TEXT[],
  risk_classification         TEXT CHECK (risk_classification IN (
                                'minimal', 'limited', 'high', 'unacceptable'
                              )),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: vendors
-- One row per vendor declared in Section 6.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id             UUID NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  org_id                    UUID NOT NULL REFERENCES public.organisations(id),
  vendor_name               TEXT NOT NULL,
  product                   TEXT,
  processor_controller_role TEXT CHECK (processor_controller_role IN (
                              'processor', 'controller', 'joint_controller'
                            )),
  jurisdiction              TEXT,
  data_categories           TEXT[],
  dpa_status                TEXT CHECK (dpa_status IN (
                              'signed', 'requested', 'not_in_place', 'not_required'
                            )),
  transfer_mechanism        TEXT,  -- e.g. SCCs, adequacy, binding corporate rules
  training_data_reuse       BOOLEAN,
  security_certifications   TEXT[],
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: risk_flags
-- Written by the QA layer. Each flag is a specific issue.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES public.organisations(id),
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  triggering_answer TEXT,
  explanation       TEXT NOT NULL,
  required_action   TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'acknowledged', 'resolved', 'escalated')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: generated_documents
-- One row per document type per submission.
-- Nine document types in total (see CHECK constraint).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES public.organisations(id),
  document_type   TEXT NOT NULL CHECK (document_type IN (
                    'ai_use_statement',
                    'privacy_notice_addendum',
                    'ai_risk_register',
                    'dpia_lite',
                    'internal_ai_use_policy',
                    'customer_disclosure_snippets',
                    'vendor_ai_register',
                    'complaints_procedure_pack',
                    'procurement_response_memo'
                  )),
  version_number  INTEGER NOT NULL DEFAULT 1,
  generated_at    TIMESTAMPTZ,
  qa_status       TEXT NOT NULL DEFAULT 'pending'
                  CHECK (qa_status IN ('pending', 'passed', 'flagged', 'failed')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (delivery_status IN ('pending', 'approved', 'delivered', 'failed')),
  file_url        TEXT,   -- Supabase Storage signed URL
  -- Document generation architecture fields (2026-06-03)
  -- AI outputs structured JSON; templates render it to PDF.
  -- content_json is the source of truth for regeneration and versioning.
  content_json    JSONB,  -- structured document content produced by AI (pre-render)
  template_version TEXT,  -- which PDF template version rendered this document
  renderer        TEXT DEFAULT 'react_pdf'
                  CHECK (renderer IN ('react_pdf', 'typst', 'playwright')),
  render_metadata JSONB DEFAULT '{}',  -- render log, warnings, timing
  page_count      INTEGER,
  file_size_bytes INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: qa_reports
-- One per submission. Written by the QA layer after generation.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id               UUID NOT NULL REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  org_id                      UUID NOT NULL REFERENCES public.organisations(id),
  completeness_score          INTEGER,  -- 0–100
  risk_score                  INTEGER,  -- 0–100
  consistency_issues          JSONB NOT NULL DEFAULT '[]',
  missing_info                JSONB NOT NULL DEFAULT '[]',
  red_flags                   JSONB NOT NULL DEFAULT '[]',
  recommended_action          TEXT CHECK (recommended_action IN (
                                'approve', 'request_more_info', 'escalate', 'specialist_route'
                              )),
  human_escalation_required   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: review_notes
-- Manual review decisions by Olu or a specialist.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_report_id  UUID NOT NULL REFERENCES public.qa_reports(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('system', 'founder', 'specialist')),
  notes         TEXT,
  decision      TEXT CHECK (decision IN (
                  'approve', 'request_more_info', 'escalate', 'reject'
                )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: scan_reports
-- Public gap scan results. No auth required to create.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scan_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL,
  email       TEXT,
  scan_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  findings    JSONB NOT NULL DEFAULT '{}',
  pdf_url     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: generation_events
-- Logs every Claude API call for usage tracking and margin analysis.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generation_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES public.orders(id),
  document_type     TEXT,
  model             TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  cost_usd          NUMERIC(10, 6),
  status            TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retry')),
  error_message     TEXT,
  -- Content reuse tracking (2026-06-03)
  -- Tracks whether this generation used approved reusable blocks
  -- (pattern matching system is Phase 2, Stage 5 — these fields are ready for it)
  content_reused    BOOLEAN DEFAULT FALSE,  -- true if any blocks came from content_blocks table
  reused_block_ids  TEXT[],                 -- which content_block IDs were reused
  pattern_id        TEXT,                   -- which use-case pattern was matched (null = fresh AI generation)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: audit_events
-- Append-only log of all admin actions.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.users(id),
  action_type   TEXT NOT NULL CHECK (action_type IN (
                  'login', 'case_view', 'generate_rerun', 'approve_delivery',
                  'delivery_resend', 'escalation_set', 'escalation_cleared',
                  'intake_answer_view', 'document_edit', 'template_edit',
                  'refund_issued', 'data_deletion_requested', 'data_export_requested',
                  'settings_change'
                )),
  target_type   TEXT,
  target_id     UUID,
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: customer_communications
-- Logs every outbound email to a customer (via Resend).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id),
  email_type      TEXT NOT NULL CHECK (email_type IN (
                    'magic_link', 'needs_more_info', 'delivery',
                    'escalation_notice', 'welcome'
                  )),
  sent_at         TIMESTAMPTZ,
  resend_id       TEXT,
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: document_generation_jobs
-- Async job tracking for document generation runs.
-- Generation takes time (9 documents, multiple Claude calls).
-- Job state is tracked here; per-document state in generated_documents.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id),
  submission_id   UUID NOT NULL REFERENCES public.intake_submissions(id),
  org_id          UUID NOT NULL REFERENCES public.organisations(id),
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: content_blocks
-- Reusable, approved compliance content blocks.
-- Initially empty. Stage 5 populates it as patterns emerge from real cases.
-- Matching logic (pattern rules → block reuse) is built at Stage 5.
-- IMPORTANT: blocks here are generic/sanitised — never raw client-specific content.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type      TEXT NOT NULL CHECK (block_type IN ('paragraph', 'table', 'list', 'clause', 'heading')),
  document_type   TEXT NOT NULL CHECK (document_type IN (
                    'ai_use_statement', 'privacy_notice_addendum', 'ai_risk_register',
                    'dpia_lite', 'internal_ai_use_policy', 'customer_disclosure_snippets',
                    'vendor_ai_register', 'complaints_procedure_pack', 'procurement_response_memo'
                  )),
  section_id      TEXT NOT NULL,       -- section this block belongs to within its document type
  heading         TEXT,
  content         TEXT NOT NULL,       -- the sanitised, generic prose/clause text
  risk_levels     TEXT[] DEFAULT '{}', -- applicable risk levels: low, medium, high, critical
  conditions      JSONB DEFAULT '{}',  -- future matching conditions (for Stage 5 pattern logic)
  tags            TEXT[] DEFAULT '{}',
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: brand_profiles
-- One per organisation. Drives partner co-branding on documents.
-- Created now so partner branding can be added to documents
-- without a schema migration when the partner portal ships (Phase 3).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organisations(id) UNIQUE,
  display_name    TEXT,          -- shown on documents in place of or alongside "Readypack"
  logo_url        TEXT,          -- Supabase Storage URL for org logo
  accent_colour   TEXT,          -- hex colour for branded document elements (e.g. #16a34a)
  co_brand_type   TEXT NOT NULL DEFAULT 'none'
                  CHECK (co_brand_type IN ('none', 'powered_by', 'white_label')),
  -- 'none'        = Readypack-branded only (all direct buyers)
  -- 'powered_by'  = "Powered by Readypack for [Partner Name]" (default for partners)
  -- 'white_label' = Partner-branded only, no Readypack mention (Phase 3+, requires approval)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- VIEW: cases
-- Joins orders + intake_submissions + users + organisations.
-- Computes case_status, delivery_deadline, and hours_remaining.
-- Used as the basis for the admin cases queue.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.cases AS
SELECT
  o.id                                                          AS order_id,
  o.user_id,
  o.billing_org_id,
  o.client_org_id,
  o.plan_selected,
  o.payment_status,
  o.delivery_status,
  o.stripe_payment_id,
  o.stripe_session_id,
  o.created_at                                                  AS order_created_at,
  -- Delivery deadline: 48 hours from order creation
  (o.created_at + INTERVAL '48 hours')                         AS delivery_deadline,
  -- Hours remaining until deadline (negative = overdue)
  EXTRACT(EPOCH FROM ((o.created_at + INTERVAL '48 hours') - NOW())) / 3600
                                                                AS hours_remaining,
  u.email                                                       AS customer_email,
  u.company_name,
  u.trading_name,
  client_org.name                                               AS client_org_name,
  billing_org.name                                              AS billing_org_name,
  s.id                                                          AS submission_id,
  s.completion_status                                           AS intake_status,
  s.risk_level,
  s.last_saved,
  qr.id                                                         AS qa_report_id,
  qr.recommended_action                                         AS qa_recommendation,
  qr.human_escalation_required,
  qr.completeness_score,
  qr.risk_score,
  -- Most recent generation job status (NULL if no job yet)
  dgj.id                                                        AS generation_job_id,
  dgj.status                                                    AS generation_job_status,
  -- Computed case status (drives colour-coding and urgency in admin queue)
  -- Evaluated top-to-bottom; first matching condition wins.
  CASE
    WHEN o.payment_status = 'refunded'                          THEN 'refunded'
    WHEN o.payment_status = 'failed'                            THEN 'cancelled'
    WHEN o.payment_status = 'pending'                           THEN 'awaiting_payment'
    WHEN s.id IS NULL                                           THEN 'intake_not_started'
    WHEN s.completion_status = 'in_progress'                    THEN 'intake_in_progress'
    WHEN s.completion_status = 'submitted' AND dgj.id IS NULL   THEN 'intake_submitted'
    WHEN dgj.status = 'queued'                                  THEN 'generation_queued'
    WHEN dgj.status = 'running'                                 THEN 'generating'
    WHEN dgj.status = 'failed'                                  THEN 'generation_failed'
    WHEN qr.id IS NULL                                          THEN 'qa_running'
    WHEN qr.human_escalation_required
         AND s.risk_level = 'critical'                          THEN 'high_risk_escalation'
    WHEN qr.human_escalation_required                           THEN 'escalated'
    WHEN qr.recommended_action = 'request_more_info'            THEN 'needs_more_info'
    WHEN qr.recommended_action = 'specialist_route'             THEN 'specialist_route'
    WHEN qr.recommended_action = 'approve'
         AND o.delivery_status = 'pending'                      THEN 'qa_passed'
    WHEN o.delivery_status = 'approved'                         THEN 'ready_for_delivery'
    WHEN o.delivery_status = 'delivered'                        THEN 'delivered'
    ELSE 'qa_review'
  END                                                           AS case_status
FROM public.orders o
JOIN public.users u                   ON u.id = o.user_id
JOIN public.organisations client_org  ON client_org.id = o.client_org_id
JOIN public.organisations billing_org ON billing_org.id = o.billing_org_id
LEFT JOIN public.intake_submissions s ON s.order_id = o.id
LEFT JOIN public.qa_reports qr        ON qr.submission_id = s.id
-- Most recent generation job for this submission (LATERAL allows ORDER BY + LIMIT 1)
LEFT JOIN LATERAL (
  SELECT * FROM public.document_generation_jobs
  WHERE submission_id = s.id
  ORDER BY created_at DESC
  LIMIT 1
) dgj ON TRUE;

-- ─────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE public.organisations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_generation_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles               ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- RLS POLICIES
-- Using DROP POLICY IF EXISTS before each CREATE so this block
-- is safe to re-run on a database where policies already exist.
--
-- Architecture:
--   • All server-side API routes use the service-role client → bypass RLS entirely.
--     This covers admin actions, generation, QA, webhooks, email delivery.
--   • Customers use the anon client with their session cookie → RLS enforced.
--   • Partner tier RLS is deferred to Phase 3 (partner portal).
--   • For MVP: customer sees their own rows only.
-- ─────────────────────────────────────────

-- organisations
DROP POLICY IF EXISTS "users_see_own_org" ON public.organisations;
CREATE POLICY "users_see_own_org" ON public.organisations
  FOR SELECT USING (id = public.auth_user_org_id());

-- organisation_members
DROP POLICY IF EXISTS "users_see_own_memberships" ON public.organisation_members;
CREATE POLICY "users_see_own_memberships" ON public.organisation_members
  FOR SELECT USING (user_id = auth.uid());

-- users
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- orders
DROP POLICY IF EXISTS "customers_own_orders" ON public.orders;
CREATE POLICY "customers_own_orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());

-- intake_submissions
DROP POLICY IF EXISTS "customers_own_submissions" ON public.intake_submissions;
CREATE POLICY "customers_own_submissions" ON public.intake_submissions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_update_own_submissions" ON public.intake_submissions;
CREATE POLICY "customers_update_own_submissions" ON public.intake_submissions
  FOR UPDATE USING (user_id = auth.uid());

-- ai_tools, vendors, risk_flags, generated_documents, qa_reports
DROP POLICY IF EXISTS "customers_own_ai_tools" ON public.ai_tools;
CREATE POLICY "customers_own_ai_tools" ON public.ai_tools
  FOR ALL USING (org_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "customers_own_vendors" ON public.vendors;
CREATE POLICY "customers_own_vendors" ON public.vendors
  FOR ALL USING (org_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "customers_own_risk_flags" ON public.risk_flags;
CREATE POLICY "customers_own_risk_flags" ON public.risk_flags
  FOR SELECT USING (org_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "customers_own_documents" ON public.generated_documents;
CREATE POLICY "customers_own_documents" ON public.generated_documents
  FOR SELECT USING (org_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "customers_own_qa_reports" ON public.qa_reports;
CREATE POLICY "customers_own_qa_reports" ON public.qa_reports
  FOR SELECT USING (org_id = public.auth_user_org_id());

-- server-side only tables
DROP POLICY IF EXISTS "no_client_access_review_notes" ON public.review_notes;
CREATE POLICY "no_client_access_review_notes" ON public.review_notes
  FOR ALL USING (FALSE);

DROP POLICY IF EXISTS "no_client_access_generation_events" ON public.generation_events;
CREATE POLICY "no_client_access_generation_events" ON public.generation_events
  FOR ALL USING (FALSE);

DROP POLICY IF EXISTS "no_client_access_audit_events" ON public.audit_events;
CREATE POLICY "no_client_access_audit_events" ON public.audit_events
  FOR ALL USING (FALSE);

DROP POLICY IF EXISTS "no_client_access_customer_comms" ON public.customer_communications;
CREATE POLICY "no_client_access_customer_comms" ON public.customer_communications
  FOR ALL USING (FALSE);

-- scan_reports
DROP POLICY IF EXISTS "anyone_can_create_scan_report" ON public.scan_reports;
CREATE POLICY "anyone_can_create_scan_report" ON public.scan_reports
  FOR INSERT WITH CHECK (TRUE);

-- document_generation_jobs
DROP POLICY IF EXISTS "no_client_access_generation_jobs" ON public.document_generation_jobs;
CREATE POLICY "no_client_access_generation_jobs" ON public.document_generation_jobs
  FOR ALL USING (FALSE);

-- content_blocks
DROP POLICY IF EXISTS "customers_read_approved_blocks" ON public.content_blocks;
CREATE POLICY "customers_read_approved_blocks" ON public.content_blocks
  FOR SELECT USING (approved = TRUE);

-- brand_profiles
DROP POLICY IF EXISTS "users_see_own_brand_profile" ON public.brand_profiles;
CREATE POLICY "users_see_own_brand_profile" ON public.brand_profiles
  FOR SELECT USING (org_id = public.auth_user_org_id());
