-- Poll-time Greenhouse application-question schema, stored job-level (shared across
-- users). See docs/superpowers/specs/2026-07-07-prefill-application-design.md.
BEGIN;

CREATE TABLE IF NOT EXISTS job_questions (
  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY shared_read ON job_questions FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON job_questions TO anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-07-job-questions.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
