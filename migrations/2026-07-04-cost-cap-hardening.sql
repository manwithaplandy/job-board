-- Close the self-serve cost-cap bypass (go-public SaaS, review finding B-COST).
--
-- THREAT (confirmed live): Supabase's default privileges grant full arwdDxt to
-- `anon` + `authenticated` on every `public` table, and PostgREST exposes those
-- tables to the browser via the anon key + the user's JWT. RLS filters WHICH rows a
-- role touches, but the TABLE/COLUMN privilege is a separate, outer gate — and the
-- Supabase default handed writes to `authenticated` on tables that were only ever
-- meant to be service-role-written. So a normal user could, with their own JWT:
--   * PATCH/DELETE their own usage_counters row → zero their daily 'review' spend
--     and monthly 'resume'/'cover' allowance (the counters pass RLS: they own the row);
--   * PATCH profiles.daily_review_cap up → raise their per-day review budget,
-- both of which spend the operator's OpenRouter balance without bound.
--
-- This migration removes those write paths at the privilege layer (RLS is no longer
-- the only gate), in three moves + a systemic blanket revoke:
--
--   1. usage_counters is now SELECT-only for `authenticated`. All WRITES move to the
--      service role: the reviewer/worker already write as `postgres`, and the
--      dashboard's generation charge (dashboard/lib/usage.ts chargeGenerations) now
--      routes through serviceSql. Users keep SELECT so remaining-budget reads work.
--   2. profiles.daily_review_cap becomes non-user-writable. Column privileges (NOT a
--      bare column REVOKE — see the gotcha note below) grant INSERT/UPDATE on every
--      profiles column EXCEPT daily_review_cap. Users keep full control of
--      resume_text / model_* / preferred_locations / application answers; only the
--      cost lever is operator-only (service role bypasses this).
--   3. (defense in depth, in app code) reviewer/run.py + dashboard/lib/reviewRequests.ts
--      clamp any daily_review_cap override to `min(override, tier_cap)` so even a
--      forced write can only LOWER the cap, never raise it.
--   4. Systemic guard: blanket-REVOKE every default anon/authenticated privilege on
--      all public tables + sequences, then re-GRANT ONLY the intended allowlist. This
--      strips the Supabase-default arwdDxt from the deny-all tables (invite_codes,
--      schema_migrations, account_deletions, …) and the read-only/service-write
--      tables (subscriptions, review_requests writes, jobs/companies writes, …), so a
--      slipped RLS policy is no longer a single point of failure.
--
-- COLUMN-PRIVILEGE GOTCHA (why not `REVOKE UPDATE (daily_review_cap)`): in Postgres a
-- role's effective column privilege is the UNION of table-level and column-level
-- grants. A table-level `GRANT UPDATE ON profiles` is unaffected by a later
-- `REVOKE UPDATE (col)` — the column stays updatable. The only correct way is to
-- REVOKE the table-level UPDATE and re-GRANT UPDATE on the specific allowed columns.
-- (Verified empirically before writing this migration.)
--
-- House conventions: BEGIN/COMMIT, idempotent (REVOKE/GRANT are naturally so),
-- recorded in schema_migrations. schema.sql mirrors this posture (its grant block).
-- The privileged `postgres`/service role OWNS every table and bypasses all of this,
-- so the reviewer, pollers, discovery, the Stripe webhook, invites, account deletion,
-- and the dashboard's serviceSql charge path are unaffected.
--
-- >>> LIVE / MANUAL STEP (cannot be done from here) <<<
--  * Apply to the live Supabase project (remote DBs are never touched from CI/local).
--  * After apply, re-run the live probe from the review (finding B-COST step 3):
--      curl "https://<proj>.supabase.co/rest/v1/usage_counters" \
--        -H "apikey: <anon key>" -H "Authorization: Bearer <a real user JWT>" \
--        -X PATCH -H "Content-Type: application/json" -d '{"n":0}'
--    → must fail with a 401/403 privilege error (not silently 200). Same for a
--      PATCH of profiles setting daily_review_cap. Consider disabling public-schema
--      Data API exposure entirely (Supabase → Settings → API) as the belt-and-braces
--      posture; this migration is the braces.

BEGIN;

-- 1. Systemic: strip ALL default anon/authenticated table+sequence privileges, so the
--    grants below are a positive allowlist (not Supabase's permissive default). Owner
--    (postgres) is unaffected — it owns the tables and bypasses grants + RLS.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2. Re-GRANT the intended allowlist (mirrors schema.sql's grant block) ------------
-- Global corpus + pipeline accounting: read-only for the authed dashboard.
GRANT SELECT ON jobs, companies, poll_runs, discovery_runs, discovery_state, review_runs
  TO authenticated;

-- Owner-scoped CRUD tables (RLS confines to own rows). usage_counters is DELIBERATELY
-- excluded here — it is SELECT-only for users (writes are service-role, see below).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  job_reviews, review_corrections, company_reviews, application_packages, resume_scores
  TO authenticated;

-- usage_counters: users may READ their budget, never write it (cost integrity).
GRANT SELECT ON usage_counters TO authenticated;

-- profiles: full user control EXCEPT the operator-only cost lever daily_review_cap.
-- SELECT + DELETE are table-level; INSERT/UPDATE are column-level over every column
-- but daily_review_cap (see the gotcha note in the header). Keep this list in sync
-- with the profiles table definition when a column is ADDED (new columns default to
-- NOT user-writable, which is the safe direction).
GRANT SELECT, DELETE ON profiles TO authenticated;
GRANT INSERT (user_id, resume_text, resume_file_path, instructions, model_stage1,
              model_stage2, preferred_locations, model_resume, company_instructions,
              company_profile_version, model_company, board_filters, full_name, email,
              phone, links, location, work_authorized, needs_sponsorship, eeo_gender,
              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
              profile_version, updated_at)
  ON profiles TO authenticated;
GRANT UPDATE (resume_text, resume_file_path, instructions, model_stage1,
              model_stage2, preferred_locations, model_resume, company_instructions,
              company_profile_version, model_company, board_filters, full_name, email,
              phone, links, location, work_authorized, needs_sponsorship, eeo_gender,
              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
              profile_version, updated_at)
  ON profiles TO authenticated;

-- Billing mirror: owner reads only; the Stripe webhook (service role) is the sole writer.
GRANT SELECT ON subscriptions TO authenticated;
-- On-demand review queue: owner enqueues (INSERT) + reads; the worker (service role)
-- transitions status, so NO UPDATE/DELETE for users.
GRANT SELECT, INSERT ON review_requests TO authenticated;

-- Sequences backing the INSERT grants above.
GRANT USAGE ON SEQUENCE application_packages_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE review_requests_id_seq TO authenticated;

-- anon reads the public board + gets SELECT (no policy → zero rows) on the two review
-- tables getJobReviewDetail LEFT JOINs so its anon query isn't denied.
GRANT SELECT ON jobs, companies, job_reviews, review_corrections TO anon;

-- Tier settings: shared operator config read by the dashboard (withAnonSql) + reviewer.
GRANT SELECT ON tier_settings TO anon, authenticated;

-- Tables that get NO anon/authenticated grant (deny-all, service-role only):
--   invite_codes, invite_redemptions, schema_migrations, account_deletions,
--   openrouter_usage_snapshots — the blanket REVOKE above is what now enforces this
--   even against the Supabase default ACL.

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-cost-cap-hardening.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
