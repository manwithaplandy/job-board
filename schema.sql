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
  description   TEXT                          -- cached full JD plaintext (from the ATS payload)
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;
-- Lets the analytics "job lifespan" query (WHERE closed_at IS NOT NULL — a small
-- minority of rows) use a bitmap index scan instead of a full seq scan of the large
-- jobs table. (The whole-table funnel count still seq-scans, which is correct for a
-- full count.) The durable fix for the /analytics load is the request-level caching.
CREATE INDEX idx_jobs_closed_at ON jobs (closed_at);

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
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
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
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);
CREATE INDEX idx_job_reviews_user_profile_version ON job_reviews (user_id, profile_version);

-- accounting, mirrors poll_runs
CREATE TABLE review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,
  gate_rejected INT,
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT
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
