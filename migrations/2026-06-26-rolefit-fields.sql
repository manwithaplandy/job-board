-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Rolefit: richer review extraction + computed fit + résumé model.
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS role_category    TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS seniority        TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS work_arrangement TEXT
  CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown'));
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS about            TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_min          INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_max          INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_currency     TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_period       TEXT
  CHECK (pay_period IN ('year','hour','month'));
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS headcount        TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS skills_score     INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS experience_score INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS comp_score       INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS fit_score        INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS red_flags    JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS skill_gaps   JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS benefits     JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_resume TEXT;
