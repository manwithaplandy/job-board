-- Profile-level (standing) generation instructions for résumé + cover letter.
-- Layered UNDERNEATH the per-job application_packages.*_instructions boxes at
-- generation time. Distinct from profiles.instructions, which is reviewer-only
-- and feeds profile_version — these two columns do NOT affect the reviewer or
-- that hash. User-writable, so both need explicit column-level GRANTs (the table
-- default is non-writable — the safe direction).
BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS resume_generation_instructions       TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_generation_instructions TEXT;

GRANT INSERT (resume_generation_instructions, cover_letter_generation_instructions)
  ON profiles TO authenticated;
GRANT UPDATE (resume_generation_instructions, cover_letter_generation_instructions)
  ON profiles TO authenticated;

INSERT INTO schema_migrations (filename)
  VALUES ('2026-07-08-profile-generation-instructions.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
