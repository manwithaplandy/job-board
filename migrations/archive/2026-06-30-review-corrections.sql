-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Human corrections to model reviews — a golden-dataset overlay (see schema.sql).
CREATE TABLE IF NOT EXISTS review_corrections (
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
  fit_score            INT,
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
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_review_corrections_user ON review_corrections (user_id);

-- Deny-all RLS to match the rls_enabled_no_policy convention (served server-side
-- via a privileged direct connection that bypasses RLS).
ALTER TABLE review_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON review_corrections;
CREATE POLICY no_anon_access ON review_corrections FOR ALL USING (false) WITH CHECK (false);
