-- Editable cover letters → golden evals + per-job generation instructions
-- (docs/superpowers/specs/2026-07-07-editable-cover-letter-evals-design.md).
--
-- cover_letter_edits is an OVERLAY: it never mutates application_packages. Keyed
-- (user_id, job_id) — one edit per letter per operator; re-editing overwrites
-- (last-write-wins). The edited text is BOTH the product-facing persisted letter
-- AND the golden expected_output. superseded_at is stamped when a NEWER cover
-- letter is generated (NULL = the edit is current and displays over the original).
BEGIN;

CREATE TABLE IF NOT EXISTS cover_letter_edits (
  user_id               UUID NOT NULL,
  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  edited_text           TEXT NOT NULL,        -- human-edited plain-text letter
  original_text         TEXT,                 -- composed text of the model letter at edit time (eval "before")
  cover_letter_trace_id TEXT,                 -- join key to the generation's LangFuse trace
  model                 TEXT,                 -- model that generated the original
  comment               TEXT,                 -- optional operator note
  superseded_at         TIMESTAMPTZ,          -- set when a NEWER cover letter is generated; NULL = current
  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_user ON cover_letter_edits (user_id);
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_job ON cover_letter_edits (job_id);

-- Symmetric to resume_trace_id: trace id captured at generation so a golden item can
-- reference the generation trace even after the letter is regenerated.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_trace_id TEXT;

-- Per-job generation instructions (sole generation-instruction source;
-- profile.instructions is reviewer-only). NULL/empty = no extra instructions.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS resume_instructions       TEXT;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_instructions TEXT;

-- RLS + grants: deny-all + owner_access + owner-scoped CRUD grant — the post-go-public
-- pattern for a new user_id table (mirrors 2026-07-05-generation-jobs.sql). NOTE: the
-- design spec said deny-all only, "matching resume_scores" — stale: resume_scores has
-- since gained owner_access (2026-07-03-rls-tenant-isolation) + authenticated grants
-- (2026-07-04-cost-cap-hardening), and all dashboard access runs through withUserSql
-- (authenticated role), so deny-all alone would block the feature.
ALTER TABLE cover_letter_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON cover_letter_edits;
CREATE POLICY no_anon_access ON cover_letter_edits FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_access ON cover_letter_edits;
CREATE POLICY owner_access ON cover_letter_edits FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON cover_letter_edits TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-07-cover-letter-edits.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
