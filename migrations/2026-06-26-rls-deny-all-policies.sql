-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Security hardening for Supabase advisor `rls_enabled_no_policy` (lint 0008).
--
-- The dashboard and reviewer reach Postgres exclusively through a privileged DIRECT
-- connection (DATABASE_URL / postgres.js) that bypasses RLS. Nothing is served via the
-- anon/PostgREST API — there are zero `supabase.from(<table>)` reads in the app; the
-- Supabase JS client is used only for auth sessions and Storage.
--
-- Every public table already has RLS ENABLED with NO policies, i.e. deny-all to the
-- anon/authenticated API roles. That is the secure default, but the linter flags the
-- missing policy. Add one explicit PERMISSIVE deny-all policy per table so the intent
-- ("no API access; data is served server-side") is declarative and the advisory clears.
-- USING (false) grants no rows; a future read policy can be added alongside this one
-- (permissive policies are OR-ed) without removing it. Privileged/owner roles bypass RLS
-- regardless, so the dashboard and reviewer are unaffected.

ALTER TABLE companies    ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON companies;
CREATE POLICY no_anon_access ON companies   FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON jobs;
CREATE POLICY no_anon_access ON jobs        FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE poll_runs    ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON poll_runs;
CREATE POLICY no_anon_access ON poll_runs   FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON profiles;
CREATE POLICY no_anon_access ON profiles    FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE job_reviews  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON job_reviews;
CREATE POLICY no_anon_access ON job_reviews FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE review_runs  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON review_runs;
CREATE POLICY no_anon_access ON review_runs FOR ALL USING (false) WITH CHECK (false);
