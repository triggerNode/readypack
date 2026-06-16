-- 005_display_reference.sql
-- Adds a customer-facing order reference (e.g. "RP-AB12CD34") that is stable and
-- stored, so customers can quote it in support queries. Previously this was
-- computed on-the-fly on the confirmation page and never persisted.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS display_reference TEXT;
