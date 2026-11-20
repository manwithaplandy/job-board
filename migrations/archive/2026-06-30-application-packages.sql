-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Phase 3: persist prepared application packages so "Prepare" stops regenerating the
-- résumé/cover letter on every click, and cache Greenhouse's real question schema plus
-- the LLM-prefilled answers for the posting. None of this affects review verdicts, so
-- profile_version / company_profile_version are unchanged.
--
-- One package per (user, job); re-preparing upserts content in place (status/applied_at
-- preserved). user_id mirrors auth.users(id) with no FK, matching job_reviews /
-- company_reviews (auth.users is Supabase-managed and absent in the throwaway test DB).
CREATE TABLE IF NOT EXISTS application_packages (
  id                   SERIAL PRIMARY KEY,
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_json          JSONB,                 -- TailoredResume (NULL until generated)
  cover_letter_json    JSONB,                 -- TailoredCoverLetter (NULL until generated)
  answers_snapshot     JSONB,                 -- reusable profile answers at prepare time
  greenhouse_questions JSONB,                 -- parsed GH question schema (NULL = not GH / fetch failed)
  prefilled_answers    JSONB,                 -- [{ question, answer }] mapped by the LLM (NULL = none)
  apply_url            TEXT,
  status               TEXT NOT NULL DEFAULT 'prepared'
                         CHECK (status IN ('prepared','applied')),
  prepared_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ,
  UNIQUE (user_id, job_id)
);

ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON application_packages;
CREATE POLICY no_anon_access ON application_packages FOR ALL USING (false) WITH CHECK (false);
