-- Cutover baseline, part 2: the Storage objects that `supabase db dump` leaves out.
--
-- The schema dump in the paired *_baseline.sql covers the app's own schemas only.
-- Production also has the private `resumes` bucket and four per-user policies on
-- storage.objects (first applied by migrations/archive/2026-07-04-resume-bucket-
-- storage-policies.sql). They are written here to match the production fingerprint
-- captured at cutover (supabase/snapshots/prod-fingerprint-cutover.json), so a replay
-- from scratch rebuilds them. Production records this file as applied at cutover; it
-- never runs there.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY resumes_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY resumes_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY resumes_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY resumes_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
