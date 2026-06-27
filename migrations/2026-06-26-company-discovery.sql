-- migrations/2026-06-26-company-discovery.sql
-- Company auto-discovery + AI review + human override (design 2026-06-26).

ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (discovery_source IN ('manual','seed','dataset','expansion'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS company_reviews (
  user_id                 UUID NOT NULL,
  company_id              INT  NOT NULL REFERENCES companies(id),
  company_profile_version TEXT NOT NULL,
  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning               TEXT,
  industry                TEXT,
  industry_subcategory    TEXT,
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_override          BOOLEAN NOT NULL DEFAULT FALSE,
  override_verdict        TEXT CHECK (override_verdict IN ('include','exclude')),
  model                   TEXT,
  error                   TEXT,
  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_company_reviews_user_verdict ON company_reviews (user_id, verdict);
CREATE INDEX IF NOT EXISTS idx_company_reviews_user_version ON company_reviews (user_id, company_profile_version);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_instructions    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_profile_version TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_company           TEXT;

CREATE TABLE IF NOT EXISTS discovery_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','halted_no_credits','error')),
  ingested    INT, reviewed INT, included INT, excluded INT, unknown INT,
  errors      INT, backlog  INT,
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_started_at ON discovery_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS discovery_state (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
  resume_requested_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO discovery_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON company_reviews FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_runs  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_runs  FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_state FOR ALL USING (false) WITH CHECK (false);
