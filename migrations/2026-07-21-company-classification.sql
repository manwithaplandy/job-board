-- Global company classification (spec 2026-07-21-global-company-classification-design.md).
-- 1) Global facts move onto companies; 2) admin-triggered classification_jobs queue;
-- 3) per-user company_overrides replaces company_reviews.human_override;
-- 4) profiles.company_exclusions = structured facet exclusions.
-- company_reviews becomes read-only legacy (dropped by a later cleanup migration).

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS industry_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT
    CHECK (size IN ('1-10','11-50','51-200','201-1000','1001-5000','5000+','unknown')),
  ADD COLUMN IF NOT EXISTS hq_country TEXT,   -- ISO-3166 alpha-2 (uppercase) or 'unknown'
  ADD COLUMN IF NOT EXISTS tech_tags JSONB,
  ADD COLUMN IF NOT EXISTS red_flags JSONB,   -- [{category, note}] — company_discovery taxonomy
  ADD COLUMN IF NOT EXISTS classification_confidence TEXT
    CHECK (classification_confidence IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS classification_model TEXT,
  ADD COLUMN IF NOT EXISTS classification_source TEXT
    CHECK (classification_source IN ('seeded_from_user_review','job','job_serp')),
  ADD COLUMN IF NOT EXISTS poll_failures INT NOT NULL DEFAULT 0;

-- Admin-triggered LLM classification runs. Service/admin only: RLS deny-all, NO grants —
-- the dashboard admin UI reads/writes via serviceSql (postgres role bypasses RLS).
CREATE TABLE IF NOT EXISTS classification_jobs (
  id             SERIAL PRIMARY KEY,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','done','canceled','error')),
  model          TEXT NOT NULL,
  company_cap    INT NOT NULL CHECK (company_cap > 0),
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('unclassified','unknown_repass')),
  use_serp       BOOLEAN NOT NULL DEFAULT FALSE,
  est_cost       NUMERIC(10,4),
  processed      INT NOT NULL DEFAULT 0,
  errored        INT NOT NULL DEFAULT 0,
  serp_queries   INT NOT NULL DEFAULT 0,
  actual_prompt_tokens     BIGINT NOT NULL DEFAULT 0,
  actual_completion_tokens BIGINT NOT NULL DEFAULT 0,
  actual_cost    NUMERIC(10,4),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  last_progress_at TIMESTAMPTZ,   -- progress heartbeat; stale-job recovery gate (worker.py)
  finished_at    TIMESTAMPTZ
);
-- Belt-and-braces for a re-run where CREATE TABLE IF NOT EXISTS found the table already
-- present (from an earlier partial apply): the new heartbeat column is added idempotently.
ALTER TABLE classification_jobs ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ;
ALTER TABLE classification_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON classification_jobs;
CREATE POLICY no_anon_access ON classification_jobs FOR ALL USING (false) WITH CHECK (false);

-- Per-user manual include/exclude. Replaces company_reviews.human_override/override_verdict.
CREATE TABLE IF NOT EXISTS company_overrides (
  user_id    UUID NOT NULL,          -- mirrors auth.users; deliberately no FK (house convention)
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verdict    TEXT NOT NULL CHECK (verdict IN ('include','exclude')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_overrides_company ON company_overrides (company_id);
ALTER TABLE company_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON company_overrides;
CREATE POLICY no_anon_access ON company_overrides FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_access ON company_overrides;
CREATE POLICY owner_access ON company_overrides FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON company_overrides TO authenticated;

-- Structured facet exclusions: {industries[], countries[], sizes[], redFlagCategories[]}.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_exclusions JSONB;
GRANT INSERT (company_exclusions) ON profiles TO authenticated;
GRANT UPDATE (company_exclusions) ON profiles TO authenticated;

-- Seed global classification from the existing per-user reviews ($0): most recent
-- successful review per company. size/hq_country start 'unknown' (unknown_repass backfills).
UPDATE companies c SET
  industry = s.industry, industry_subcategory = s.industry_subcategory,
  tech_tags = s.tech_tags, red_flags = s.red_flags,
  classification_confidence = s.confidence, classified_at = s.reviewed_at,
  classification_model = s.model, classification_source = 'seeded_from_user_review',
  size = 'unknown', hq_country = 'unknown'
FROM (
  SELECT DISTINCT ON (company_id) company_id, industry, industry_subcategory,
         tech_tags, red_flags, confidence, reviewed_at, model
  FROM company_reviews
  WHERE error IS NULL AND verdict IS NOT NULL
  ORDER BY company_id, reviewed_at DESC
) s
WHERE c.id = s.company_id AND c.classified_at IS NULL;

-- Migrate manual overrides into the slim per-user table.
INSERT INTO company_overrides (user_id, company_id, verdict)
SELECT user_id, company_id, override_verdict FROM company_reviews
WHERE human_override = TRUE AND override_verdict IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-21-company-classification.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
