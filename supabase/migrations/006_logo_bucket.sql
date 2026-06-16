-- ============================================================
-- Readypack — Customer logo storage bucket
-- Fixes smoke-test finding: logo upload fails with "Bucket not found".
--
-- The intake questionnaire (POST /api/intake/upload-logo) uploads the
-- customer's logo to the `readypack-logos` bucket and stores the public URL,
-- which the PDF renderer later fetches to white-label the generated documents.
-- That bucket was never created. This migration creates it as a PUBLIC bucket
-- (logos are brand assets embedded in deliverables, not sensitive data — unlike
-- the private `documents` bucket).
--
-- Idempotent: safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'readypack-logos',
  'readypack-logos',
  true,
  2097152, -- 2 MB, matches MAX_BYTES in the upload route
  ARRAY['image/svg+xml', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Uploads run through the service-role client (supabaseAdmin), which bypasses
-- RLS, so no INSERT policy is required. Reads are served via the public URL
-- because the bucket is public. A public read policy is added explicitly so
-- the bucket behaves correctly even if the global "public bucket" shortcut is
-- ever tightened.
DROP POLICY IF EXISTS "Public read access for readypack-logos" ON storage.objects;
CREATE POLICY "Public read access for readypack-logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'readypack-logos');
