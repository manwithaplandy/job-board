-- Phase 1: RLS tenant isolation (go-public SaaS, spec 2026-07-03 subsystem B).
--
-- The DB must refuse cross-tenant access even if app code slips. This adds real
-- per-user RLS policies with teeth, plus the two Postgres roles the dashboard
-- drops into per-request (see dashboard/lib/db.ts withUserSql / withAnonSql).
--
-- Trust model: the dashboard connects as the privileged `postgres` role (table
-- OWNER — bypasses RLS), then per-transaction does SET LOCAL ROLE authenticated +
-- set_config('request.jwt.claims', …). public.app_user_id() reads the `sub` out of
-- that GUC — the SAME current_setting Supabase's auth.uid() reads — so the policies
-- work identically on Supabase (real auth roles) and on the plain-Postgres test DB
-- (roles are DO-guard-created here; auth.uid()/auth schema do not exist there).
--
-- Purely additive: the existing no_anon_access USING(false) deny-all policies stay
-- (permissive policies OR together, so they grant nothing and don't remove the new
-- access). The `postgres`/service role still bypasses RLS, so the reviewer, pollers,
-- company-discovery, the Stripe webhook, and the invite-redemption path are unaffected.
--
-- House conventions: BEGIN/COMMIT, fully idempotent (DROP POLICY IF EXISTS,
-- CREATE OR REPLACE, DO-guarded CREATE ROLE), recorded in schema_migrations.
-- Applying it twice on a scratch DB is a clean no-op. schema.sql mirrors this DDL
-- byte-for-byte so the pytest conftest exercises the real policies.

BEGIN;

-- 1. Roles ----------------------------------------------------------------------
-- On Supabase these already exist (managed); the guard makes CREATE a no-op there.
-- On the throwaway test DB they must be created so SET ROLE + the GRANTs below work.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- A freshly-created `public` schema (the test DB DROP/CREATEs it) does not grant
-- USAGE to these roles by default; without it every policy'd read is a schema
-- permission error. Idempotent on Supabase (already granted).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Identity helper ------------------------------------------------------------
-- The current user's id from the verified JWT claims GUC. STABLE, and NEVER raises:
-- absent/empty setting, malformed JSON, missing/blank sub, or a non-uuid sub all
-- return NULL (a NULL user_id matches no owner row, so a bad claim = no access).
CREATE OR REPLACE FUNCTION public.app_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims text;
  sub    text;
BEGIN
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;
  sub := (claims::json ->> 'sub');
  IF sub IS NULL OR sub = '' THEN
    RETURN NULL;
  END IF;
  RETURN sub::uuid;
EXCEPTION WHEN others THEN
  -- Malformed claims JSON or a non-uuid sub must degrade to "no user", never error.
  RETURN NULL;
END;
$$;

-- 3. Owner policies -------------------------------------------------------------
-- Each user sees and mutates ONLY their own rows. FOR ALL covers SELECT/INSERT/
-- UPDATE/DELETE; WITH CHECK blocks writing a row owned by anyone else. The
-- (SELECT app_user_id()) wrapper lets the planner treat it as an init-plan constant.
DROP POLICY IF EXISTS owner_access ON profiles;
CREATE POLICY owner_access ON profiles FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON job_reviews;
CREATE POLICY owner_access ON job_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON review_corrections;
CREATE POLICY owner_access ON review_corrections FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON company_reviews;
CREATE POLICY owner_access ON company_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON application_packages;
CREATE POLICY owner_access ON application_packages FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON resume_scores;
CREATE POLICY owner_access ON resume_scores FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY IF EXISTS owner_access ON usage_counters;
CREATE POLICY owner_access ON usage_counters FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- 4. Shared-read policies -------------------------------------------------------
-- The job corpus is global (spec: shared pool). Anon + authenticated read it all.
DROP POLICY IF EXISTS shared_read ON jobs;
CREATE POLICY shared_read ON jobs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS shared_read ON companies;
CREATE POLICY shared_read ON companies FOR SELECT TO anon, authenticated USING (true);

-- Pipeline accounting the authed dashboard renders (analytics / pipeline health).
DROP POLICY IF EXISTS shared_read ON poll_runs;
CREATE POLICY shared_read ON poll_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read ON discovery_runs;
CREATE POLICY shared_read ON discovery_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read ON discovery_state;
CREATE POLICY shared_read ON discovery_state FOR SELECT TO authenticated USING (true);

-- review_runs is per-user attributable; a viewer sees their own runs plus the
-- legacy pre-multitenant rows (user_id IS NULL) so historical analytics don't vanish.
DROP POLICY IF EXISTS owner_or_legacy_read ON review_runs;
CREATE POLICY owner_or_legacy_read ON review_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR user_id IS NULL);

-- 5. Grants ---------------------------------------------------------------------
-- Table privileges are the outer gate; RLS filters WITHIN a granted table. A table
-- with a GRANT but no matching policy returns ZERO ROWS (not permission-denied) —
-- relied on below for anon's job_reviews/review_corrections access.
GRANT SELECT ON jobs, companies, poll_runs, discovery_runs, discovery_state, review_runs
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  profiles, job_reviews, review_corrections, company_reviews,
  application_packages, resume_scores, usage_counters
  TO authenticated;

-- application_packages.id is SERIAL; INSERT needs its sequence.
GRANT USAGE ON SEQUENCE application_packages_id_seq TO authenticated;

-- anon reads the public board. It gets SELECT on job_reviews + review_corrections
-- (with NO anon policy) so getJobReviewDetail's anonymous LEFT JOIN
-- (ON user_id = NULL::uuid) yields zero review rows rather than a permission error.
GRANT SELECT ON jobs, companies, job_reviews, review_corrections TO anon;

-- invite_codes, invite_redemptions, schema_migrations get NO authenticated/anon
-- policy or DML grant — service-role only (deny-all no_anon_access stays in force).

INSERT INTO schema_migrations (filename) VALUES ('2026-07-03-rls-tenant-isolation.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
