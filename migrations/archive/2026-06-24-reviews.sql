-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS profiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id),
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  profile_version  TEXT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_reviews (
  user_id              UUID NOT NULL REFERENCES auth.users(id),
  job_id               TEXT NOT NULL REFERENCES jobs(id),
  profile_version      TEXT NOT NULL,
  stage1_decision      TEXT CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason        TEXT,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning            TEXT,
  model_stage1         TEXT,
  model_stage2         TEXT,
  error                TEXT,
  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);
CREATE INDEX IF NOT EXISTS idx_job_reviews_user_profile_version ON job_reviews (user_id, profile_version);

CREATE TABLE IF NOT EXISTS review_runs (
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
CREATE INDEX IF NOT EXISTS idx_review_runs_started_at ON review_runs (started_at DESC);
