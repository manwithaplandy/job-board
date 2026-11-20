-- Résumé-generation eval golden dataset.
-- Human scores (grounding + JD-relevance, 1–5) over generated résumés, joined to
-- the managed judge's LangFuse trace via resume_trace_id. Overlay table; never
-- mutates application_packages. Keyed (user_id, job_id) — one score per résumé
-- per operator; re-scoring overwrites (last-write-wins).
BEGIN;

CREATE TABLE IF NOT EXISTS resume_scores (
  user_id          UUID NOT NULL,
  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
  comment          TEXT,
  resume_trace_id  TEXT,                                -- join key to the judge's trace score
  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- the exact TailoredResume scored
  model            TEXT,                                -- model that generated the scored résumé
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_resume_scores_user ON resume_scores (user_id);

-- LangFuse trace id captured at generation, so a score can reference the judge's
-- trace even after the résumé is regenerated (resume_snapshot pins what was scored).
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS resume_trace_id TEXT;

-- Deny-all RLS (access via the service-role DIRECT connection only).
ALTER TABLE resume_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON resume_scores;
CREATE POLICY no_anon_access ON resume_scores FOR ALL USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-02-resume-scores.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
