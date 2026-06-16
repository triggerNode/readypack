-- ============================================================
-- ReadyPack — Statutory DUAA Section 103 complaints intake
-- Migration 003: public.complaints table with RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.complaints (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  complainant_name   TEXT NOT NULL,
  complainant_email  TEXT NOT NULL,
  complaint_text     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'investigating', 'resolved', 'escalated')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at    TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  statutory_deadline TIMESTAMPTZ NOT NULL, -- locked to 30 days from received_at
  investigation_notes TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a complaint anonymously
DROP POLICY IF EXISTS "anyone_can_create_complaint" ON public.complaints;
CREATE POLICY "anyone_can_create_complaint" ON public.complaints
  FOR INSERT WITH CHECK (TRUE);

-- Only system admins can select/update complaints
DROP POLICY IF EXISTS "only_admins_see_complaints" ON public.complaints;
CREATE POLICY "only_admins_see_complaints" ON public.complaints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
