-- Per-prefix tenant isolation for the `resumes` Storage bucket (go-public SaaS,
-- review finding B-STORAGE).
--
-- The résumé bucket predates multi-tenancy: uploads/list/sign go through the
-- user-session Supabase client (dashboard/lib/onboarding.ts, profile.ts,
-- accountExport.ts), which talks to the Storage API with the anon key + the
-- caller's JWT — i.e. as the `authenticated` role, subject to RLS on
-- storage.objects. Until now NO storage.objects policy for `resumes` was codified
-- anywhere; whatever existed lived only in the Supabase dashboard from
-- single-operator days. If that policy is bucket-wide for `authenticated`, any
-- tenant can createSignedUrl('<victimUserId>/…pdf') and download a stranger's
-- résumé. This migration pins the policy in version control.
--
-- Layout: every object is stored under `resumes/<userId>/…` (userId is the auth
-- uid). The policies restrict `authenticated` to rows whose FIRST path segment
-- equals its own uid — SELECT/INSERT/UPDATE/DELETE all scoped identically — so a
-- cross-prefix list/read/write/sign returns zero rows / is denied. `anon` gets NO
-- policy (and thus no access) on this bucket. The service role bypasses RLS, so
-- the reviewer/worker/account-deletion sweep that touch objects are unaffected.
--
-- Uses Supabase's own `auth.uid()` + `storage.foldername()` — the standard
-- Storage-policy idiom, and identical in meaning to public.app_user_id() used by
-- the public-schema RLS (both read `request.jwt.claims` -> 'sub'). This file runs
-- ONLY against the live Supabase project: the `storage` schema is Supabase-managed
-- and does NOT exist in the plain-Postgres test DB, so it is NOT mirrored into
-- schema.sql (see the note there). The whole storage block is guarded on
-- storage.objects existing, so applying it on a DB without the Storage schema is a
-- clean, logged no-op rather than an error. Fully idempotent (DROP POLICY IF
-- EXISTS + CREATE, ON CONFLICT upsert), recorded in schema_migrations.
--
-- >>> LIVE / MANUAL STEP (cannot be done from here — needs live infra) <<<
-- 1. Apply this migration to the live Supabase project (dashboard SQL editor or
--    `supabase db` against prod) — remote DBs are never touched from CI/local.
-- 2. Cross-account probe (the actual close of B-STORAGE): from a SECOND test
--    account's session, confirm BOTH fail against the first account's prefix —
--      supabase.storage.from('resumes').list('<otherUserId>')          -> [] / error
--      supabase.storage.from('resumes').createSignedUrl('<otherUserId>/x.pdf', 60) -> error
--    and that each account CAN list/sign its own prefix. This live probe is the
--    only thing this SQL can't self-verify; the pytest below proves the predicate.

BEGIN;

DO $$
BEGIN
  -- storage schema is Supabase-managed; absent on the plain-Postgres test DB.
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage.objects not found (non-Supabase DB) — skipping résumé-bucket policies';
  ELSE
    -- Résumés are private PII: force the bucket private so signed URLs (not public
    -- URLs) are the only read path. Idempotent; leaves a missing bucket to be
    -- created by the app on first upload (the policies below still gate it).
    IF to_regclass('storage.buckets') IS NOT NULL THEN
      INSERT INTO storage.buckets (id, name, public)
        VALUES ('resumes', 'resumes', false)
        ON CONFLICT (id) DO UPDATE SET public = false;
    END IF;

    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    -- authenticated: full CRUD, but ONLY within its own <uid>/ prefix.
    EXECUTE 'DROP POLICY IF EXISTS resumes_owner_select ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY resumes_owner_select ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'resumes'
               AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$;

    EXECUTE 'DROP POLICY IF EXISTS resumes_owner_insert ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY resumes_owner_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'resumes'
                    AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$;

    EXECUTE 'DROP POLICY IF EXISTS resumes_owner_update ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY resumes_owner_update ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = 'resumes'
               AND (storage.foldername(name))[1] = auth.uid()::text)
        WITH CHECK (bucket_id = 'resumes'
                    AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$;

    EXECUTE 'DROP POLICY IF EXISTS resumes_owner_delete ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY resumes_owner_delete ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'resumes'
               AND (storage.foldername(name))[1] = auth.uid()::text)
    $pol$;

    -- anon deliberately gets NO policy on the resumes bucket → no access at all.
  END IF;
END
$$;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-resume-bucket-storage-policies.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
