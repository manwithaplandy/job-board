CREATE TABLE companies (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby',
                                        'workable','smartrecruiters','workday')),
  token   TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  discovery_source TEXT NOT NULL DEFAULT 'manual'
                     CHECK (discovery_source IN ('manual','seed','dataset','expansion')),
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats, token)
);

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,             -- '{ats}:{token}:{external_id}'
  company_id    INT NOT NULL REFERENCES companies(id),
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  location      TEXT,
  department    TEXT,
  remote        BOOLEAN,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  description   TEXT,                         -- cached full JD plaintext (from the ATS payload)
  description_pruned BOOLEAN NOT NULL DEFAULT FALSE  -- TRUE = JD pruned by lifecycle Rule A (final); FALSE = never captured or not yet pruned
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;
-- Lets the analytics "job lifespan" query (WHERE closed_at IS NOT NULL — a small
-- minority of rows) use a bitmap index scan instead of a full seq scan of the large
-- jobs table. (The whole-table funnel count still seq-scans, which is correct for a
-- full count.) The durable fix for the /analytics load is the request-level caching.
CREATE INDEX idx_jobs_closed_at ON jobs (closed_at);
-- Poller: get_open_external_ids / close_jobs filter WHERE company_id = $1 AND closed_at IS NULL.
CREATE INDEX idx_jobs_company_open ON jobs (company_id) WHERE closed_at IS NULL;

CREATE TABLE poll_runs (
  id               SERIAL PRIMARY KEY,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  companies_ok     INT,
  companies_failed INT,
  new_jobs         INT,
  closed_jobs      INT,
  notes            TEXT
);
-- Dashboard getLatestPollRun / pipeline health sort on started_at.
CREATE INDEX idx_poll_runs_started_at ON poll_runs (started_at DESC);

-- one row per user (the operator). user_id mirrors auth.users(id) in production,
-- but no FK: auth.users is Supabase-managed and absent in the throwaway test DB.
CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY,
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  model_stage1     TEXT,                     -- OpenRouter model id; NULL = default
  model_stage2     TEXT,                     -- OpenRouter model id; NULL = default
  preferred_locations TEXT[] NOT NULL DEFAULT '{}',  -- location include-list; empty = no pre-filter
  model_resume     TEXT,                     -- OpenRouter model id; NULL = default
  company_instructions    TEXT,
  company_profile_version TEXT,
  model_company           TEXT,
  board_filters    JSONB,                     -- remembered board filter state; NULL = defaults
  -- Reusable application answers (do not affect review verdicts).
  full_name         TEXT,
  email             TEXT,
  phone             TEXT,
  links             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { linkedin, github, portfolio }
  location          TEXT,
  work_authorized   BOOLEAN,                  -- tri-state; NULL = unspecified
  needs_sponsorship BOOLEAN,                  -- tri-state; NULL = unspecified
  eeo_gender        TEXT,                     -- voluntary EEO; NULL = declined
  eeo_race          TEXT,
  eeo_veteran       TEXT,
  eeo_disability    TEXT,
  screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { notice_period, salary_expectation, relocation, … }
  model_cover       TEXT,                     -- OpenRouter model id; NULL = default
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optional per-user override of the env daily review cap (reviewer/config.py
  -- DAILY_REVIEW_CAP_DEFAULT). NULL = use the env default.
  daily_review_cap INT
);

-- one current verdict per (user, job); re-review upserts in place
CREATE TABLE job_reviews (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version      TEXT NOT NULL,
  stage1_decision      TEXT CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason        TEXT,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  human_override       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = operator set this verdict by hand
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning            TEXT,
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown')),
  about                TEXT,
  pay_min              INT,
  pay_max              INT,
  pay_currency         TEXT,
  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
  headcount            TEXT,
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,
  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_stage1         TEXT,
  model_stage2         TEXT,
  error                TEXT,
  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_reviews_scores_range CHECK (
    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);
CREATE INDEX idx_job_reviews_user_profile_version ON job_reviews (user_id, profile_version);
-- FK-cascade lookup: jobs DELETE cascades require job_id-leading index on child tables.
CREATE INDEX idx_job_reviews_job ON job_reviews (job_id);

-- Human corrections to model reviews — a golden-dataset OVERLAY. Never mutates
-- job_reviews or the reviewer pipeline; read-time COALESCE lets it drive display.
-- model_snapshot preserves the model's job_reviews values at correction time so
-- the model-vs-human diff survives later re-reviews.
CREATE TABLE review_corrections (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN
                         ('remote','hybrid','onsite','unknown')),
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,        -- recomputed from corrected sub-scores at save time
  reasoning            TEXT,
  about                TEXT,
  pay_min              INT,
  pay_max              INT,
  pay_currency         TEXT,
  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
  headcount            TEXT,
  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  note                 TEXT,
  -- Frozen at correction time so golden-dataset eval inputs survive JD pruning and profile drift.
  description_snapshot  TEXT,
  resume_text_snapshot  TEXT,
  instructions_snapshot TEXT,
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_corrections_scores_range CHECK (
    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
  PRIMARY KEY (user_id, job_id)
);
-- Redundant idx_review_corrections_user removed: PK (user_id, job_id) already serves user_id-leading lookups.
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX idx_review_corrections_job ON review_corrections (job_id);

-- accounting, mirrors poll_runs. user_id attributes a run to the user it reviewed
-- (multi-tenant); NULL for legacy rows written before the column existed.
CREATE TABLE review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,
  gate_rejected INT,
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT,
  user_id       UUID
);
CREATE INDEX idx_review_runs_started_at ON review_runs (started_at DESC);

-- one current verdict per (user, company); re-review upserts in place
CREATE TABLE company_reviews (
  user_id                 UUID NOT NULL,
  company_id              INT  NOT NULL REFERENCES companies(id),
  company_profile_version TEXT NOT NULL,
  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning               TEXT,
  industry                TEXT,
  industry_subcategory    TEXT,
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of {category, note}: category is one of RED_FLAG_CATEGORIES
  -- (company_discovery/schemas.py); note is optional free text (required for
  -- category='other'). Backfilled by company_discovery/reclassify.py.
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_override          BOOLEAN NOT NULL DEFAULT FALSE,
  override_verdict        TEXT CHECK (override_verdict IN ('include','exclude')),
  model                   TEXT,
  error                   TEXT,
  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX idx_company_reviews_user_verdict ON company_reviews (user_id, verdict);
CREATE INDEX idx_company_reviews_user_version ON company_reviews (user_id, company_profile_version);

-- accounting for discovery pipeline runs
CREATE TABLE discovery_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','halted_no_credits','error')),
  ingested    INT, reviewed INT, included INT, excluded INT, unknown INT,
  errors      INT, backlog  INT,
  notes       TEXT
);
CREATE INDEX idx_discovery_runs_started_at ON discovery_runs (started_at DESC);

-- singleton row tracking global discovery state (e.g. credit exhaustion)
CREATE TABLE discovery_state (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
  resume_requested_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO discovery_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- one prepared application package per (user, job); re-preparing upserts in place.
-- Persists the tailored résumé/cover letter so the board stops regenerating on every
-- click, plus (Greenhouse only) the fetched question schema and the LLM-prefilled
-- answers for the posting. user_id mirrors auth.users(id) with no FK (see profiles).
CREATE TABLE application_packages (
  id                   SERIAL PRIMARY KEY,
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_json          JSONB,                 -- TailoredResume (NULL until generated)
  cover_letter_json    JSONB,                 -- TailoredCoverLetter (NULL until generated)
  answers_snapshot     JSONB,                 -- reusable profile answers at prepare time
  greenhouse_questions JSONB,                 -- parsed GH question schema (NULL = not GH / fetch failed)
  prefilled_answers    JSONB,                 -- [{ question, answer }] mapped by the LLM (NULL = none)
  apply_url            TEXT,
  resume_trace_id      TEXT,
  profile_version      TEXT,                  -- profiles.profile_version at generation time (NULL = pre-column row)
  status               TEXT NOT NULL DEFAULT 'prepared'
                         CHECK (status IN ('prepared','applied')),
  prepared_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ,
  CONSTRAINT applied_iff_timestamp CHECK ((status = 'applied') = (applied_at IS NOT NULL)),
  UNIQUE (user_id, job_id)
);
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX idx_application_packages_job ON application_packages (job_id);

-- Résumé-generation eval golden dataset (see migrations/2026-07-02-resume-scores.sql).
CREATE TABLE resume_scores (
  user_id          UUID NOT NULL,
  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
  comment          TEXT,
  resume_trace_id  TEXT,
  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  model            TEXT,
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_resume_scores_user ON resume_scores (user_id);

-- Multi-tenant foundation (see migrations/2026-07-03-multitenant-foundation.sql).
-- Invite-gated signup: invite_codes + invite_redemptions are the server-side source
-- of truth for "this account was invited" (user_metadata is client-settable and must
-- NOT be trusted).
CREATE TABLE invite_codes (
  code       TEXT PRIMARY KEY,
  note       TEXT,
  max_uses   INT NOT NULL DEFAULT 1,
  uses       INT NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One redemption per email — the trusted proof an account was invited.
CREATE TABLE invite_redemptions (
  email       TEXT NOT NULL,
  code        TEXT NOT NULL REFERENCES invite_codes(code),
  user_id     UUID,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email)
);

-- Per-user, per-day usage counters. kind='review' backs the reviewer's rolling
-- daily budget; generation kinds arrive in Phase 1. "Reset at midnight" falls out
-- of the (user_id, day) key — no cron.
CREATE TABLE usage_counters (
  user_id UUID NOT NULL,
  day     DATE NOT NULL,
  kind    TEXT NOT NULL,
  n       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

-- Billing (see migrations/2026-07-03-billing-review-requests.sql). Local mirror of
-- Stripe truth, keyed by user_id; the Stripe webhook (service role) is the sole
-- writer. No FK to auth.users (house convention, see profiles).
CREATE TABLE subscriptions (
  user_id                UUID PRIMARY KEY,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan                   TEXT CHECK (plan IN ('standard','pro')),
  status                 TEXT NOT NULL,             -- raw Stripe status string
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  last_event_at          TIMESTAMPTZ,               -- Stripe event.created watermark (M-WEBHOOK-ORDER)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- On-demand "review my board now" queue, shared by the dashboard (enqueue) and the
-- reviewer worker (claim + status transition). One active request per user.
CREATE TABLE review_requests (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','done','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  notes        TEXT
);
CREATE UNIQUE INDEX one_active_review_request
  ON review_requests (user_id) WHERE status IN ('pending','running');
CREATE INDEX idx_review_requests_pending
  ON review_requests (requested_at) WHERE status = 'pending';

-- DB-overridable tier settings (see migrations/2026-07-04-tier-settings.sql). ONE
-- jsonb config row per plan that OVERLAYS the compiled entitlement/price defaults
-- field-by-field (dashboard/lib/tierConfig.ts, reviewer.db.load_tier_settings) so
-- caps/allowances/prices are tunable WITHOUT a redeploy. Shared operator policy (not
-- per-user); empty by default = use the compiled defaults everywhere.
CREATE TABLE tier_settings (
  plan       TEXT PRIMARY KEY CHECK (plan IN ('standard','pro')),
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account-deletion erasure ledger (see migrations/2026-07-04-account-deletions.sql).
-- One row per deleted account, keyed by user_id, with a HASH of the email (never
-- plaintext) as tamper-evident proof of erasure. Written by the deletion cascade
-- (dashboard/lib/accountDeletion.ts) via the service role; users never read it.
CREATE TABLE account_deletions (
  user_id    UUID PRIMARY KEY,
  email_hash TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OpenRouter spend-alert snapshots (see migrations/2026-07-04-openrouter-usage-snapshots.sql).
-- observability.spend_alert (Railway cron) records total_usage/total_credits here and
-- differences the trailing-24h window to compute burn. Service-role only.
CREATE TABLE openrouter_usage_snapshots (
  taken_at      TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  total_usage   NUMERIC NOT NULL,
  total_credits NUMERIC
);

-- Applied-migrations ledger. Record each migration with:
--   INSERT INTO schema_migrations (filename) VALUES ('<file>');
-- when applied. Every new migration must be idempotent, transactional where
-- possible, and recorded here so the applied set is auditable.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-level security. The app and reviewer connect via a privileged DIRECT connection
-- (DATABASE_URL) that bypasses RLS; nothing is served through the anon/PostgREST API.
-- Each table gets RLS enabled plus one explicit permissive deny-all policy so the
-- "no API access; served server-side" intent is declarative and Supabase's
-- rls_enabled_no_policy advisor (lint 0008) stays clear. Portable to plain Postgres:
-- no Supabase-specific roles or auth.* functions, and test queries run as a superuser
-- that bypasses RLS. Mirrors migrations/2026-06-26-rls-deny-all-policies.sql.
ALTER TABLE companies    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON companies   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON jobs        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE poll_runs    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON poll_runs   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON profiles    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE job_reviews  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON job_reviews FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_runs      ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_runs      FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE company_reviews  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON company_reviews  FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_runs   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_runs   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_state  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_state  FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON application_packages FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE resume_scores        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON resume_scores        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_corrections   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_corrections   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE schema_migrations    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON schema_migrations    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE invite_codes         ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON invite_codes         FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE invite_redemptions   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON invite_redemptions   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE usage_counters       ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON usage_counters       FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON subscriptions        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_requests      ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_requests      FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE tier_settings        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON tier_settings        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE account_deletions    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON account_deletions    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE openrouter_usage_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON openrouter_usage_snapshots FOR ALL USING (false) WITH CHECK (false);

-- ── Phase-1 tenant isolation (mirrors migrations/2026-07-03-rls-tenant-isolation.sql
-- + the per-user policies of 2026-07-03-billing-review-requests.sql) ────────────
-- Real per-user RLS with teeth. The dashboard drops into the `authenticated` role
-- per-transaction (SET LOCAL ROLE + request.jwt.claims); public.app_user_id() reads
-- the JWT `sub` out of that GUC. The privileged `postgres`/service role OWNS these
-- tables and bypasses RLS, so the reviewer, pollers, discovery, the Stripe webhook,
-- and the invite path are unaffected. The deny-all policies above OR harmlessly with
-- these permissive ones. Roles are DO-guarded so schema.sql loads on plain Postgres
-- (the test DB), where the roles survive DROP SCHEMA public CASCADE (cluster-level).
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
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- search_path pinned (mirrors migrations/2026-07-05-app-user-id-search-path.sql): this
-- SECURITY-critical RLS resolver touches only pg_catalog built-ins, so pinning it to
-- pg_catalog fixes the function_search_path_mutable advisor while leaving behaviour
-- identical.
CREATE OR REPLACE FUNCTION public.app_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $$
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
  RETURN NULL;
END;
$$;

-- Owner policies (SELECT/INSERT/UPDATE/DELETE own rows only).
CREATE POLICY owner_access ON profiles FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON job_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON review_corrections FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON company_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON application_packages FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON resume_scores FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON usage_counters FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));

-- Shared-read policies (global corpus + pipeline accounting).
CREATE POLICY shared_read ON jobs      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shared_read ON companies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shared_read ON poll_runs       FOR SELECT TO authenticated USING (true);
CREATE POLICY shared_read ON discovery_runs  FOR SELECT TO authenticated USING (true);
CREATE POLICY shared_read ON discovery_state FOR SELECT TO authenticated USING (true);
CREATE POLICY owner_or_legacy_read ON review_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR user_id IS NULL);

-- Billing per-user policies (webhook/worker keep the service role).
CREATE POLICY owner_read ON subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_read ON review_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_insert ON review_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- Tier settings: shared operator policy (not per-user). Writes are service-role only.
CREATE POLICY shared_read ON tier_settings FOR SELECT TO anon, authenticated USING (true);

-- Grants (table privilege is the outer gate; RLS filters within — a granted table
-- with no matching policy returns zero rows, not permission-denied). This block is a
-- positive ALLOWLIST: it first strips every default anon/authenticated privilege
-- (Supabase grants full arwdDxt by default) so a slipped RLS policy is not the only
-- gate, then re-grants exactly what each role needs. Mirrors
-- migrations/2026-07-04-cost-cap-hardening.sql (finding B-COST).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON jobs, companies, poll_runs, discovery_runs, discovery_state, review_runs
  TO authenticated;
-- Owner-scoped CRUD (usage_counters excluded — SELECT-only for users; writes are
-- service-role only, so a user cannot zero their own review/generation counters).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  job_reviews, review_corrections, company_reviews, application_packages, resume_scores
  TO authenticated;
GRANT SELECT ON usage_counters TO authenticated;
-- profiles: full user control EXCEPT the operator-only cost lever daily_review_cap.
-- INSERT/UPDATE are column-level over every column but daily_review_cap. (A bare
-- REVOKE UPDATE (daily_review_cap) would NOT work: a table-level UPDATE grant is not
-- affected by a column-level revoke — the column stays writable. So we grant only the
-- allowed columns.) Keep this list in sync with the profiles table when a column is
-- ADDED (new columns default to non-user-writable — the safe direction).
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
              phone, location, links, work_authorized, needs_sponsorship, eeo_gender,
              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
              profile_version, updated_at)
  ON profiles TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT, INSERT ON review_requests TO authenticated;
GRANT USAGE ON SEQUENCE application_packages_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE review_requests_id_seq TO authenticated;
-- anon reads the public board + gets SELECT (no policy → zero rows) on the two
-- review tables getJobReviewDetail LEFT JOINs so its anon query isn't denied.
GRANT SELECT ON jobs, companies, job_reviews, review_corrections TO anon;
-- Tier settings: shared operator config read by the dashboard (withAnonSql) + reviewer.
GRANT SELECT ON tier_settings TO anon, authenticated;

-- Default-privilege deny (mirrors migrations/2026-07-05-default-privileges-revoke.sql,
-- finding minor 6): the REVOKE above only touches tables that exist NOW. Strip the
-- default anon/authenticated grant for FUTURE tables + sequences too, so a new table
-- starts deny-by-default and its creating migration must explicitly grant the intended
-- subset (the safe direction). Owner (postgres/service role) bypasses grants + RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Storage RLS (résumé bucket) is NOT represented here: the `storage` schema is
-- Supabase-managed and does not exist in the plain-Postgres test DB this file
-- builds. Per-prefix tenant isolation for `storage.objects` (bucket `resumes`,
-- finding B-STORAGE) lives in migrations/2026-07-04-resume-bucket-storage-policies.sql
-- and MUST be applied to the live Supabase project + live cross-account verified
-- (see that file's header). tests/test_resume_storage_policies.py proves the policy
-- predicate against a faithful in-DB mock of the storage/auth schema.
