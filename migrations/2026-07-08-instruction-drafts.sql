-- Per-job "Generation instructions" SAVED DRAFT (rides the next generate; survives reload).
-- Distinct from resume_instructions / cover_letter_instructions, which record the
-- instructions the CURRENT artifact was generated with (the "applied" reference).
-- NULL draft => the box falls back to the generated-with value (existing rows unchanged).
BEGIN;

ALTER TABLE application_packages
  ADD COLUMN IF NOT EXISTS resume_instructions_draft       TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_instructions_draft TEXT;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-08-instruction-drafts.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
