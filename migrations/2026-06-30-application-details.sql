-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Reusable candidate "application answers" on the profile, plus a per-stage model
-- override for the tailored cover-letter generator. None of these affect job/company
-- review verdicts, so profile_version / company_profile_version are unchanged.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone             TEXT;
-- links: { linkedin, github, portfolio } — free-form profile URLs.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS links             JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location          TEXT;
-- Tri-state work-eligibility answers; NULL = unspecified.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_authorized   BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS needs_sponsorship BOOLEAN;
-- Voluntary EEO self-identification; NULL = declined / unspecified.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eeo_gender        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eeo_race          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eeo_veteran       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eeo_disability    TEXT;
-- screening_answers: free-form { notice_period, salary_expectation, relocation, … }.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Per-stage OpenRouter model override for cover-letter generation; NULL = default.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_cover       TEXT;
