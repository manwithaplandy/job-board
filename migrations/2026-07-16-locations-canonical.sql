-- Gazetteer-anchored location canonicalization: raw->canonicals cache + denormalized
-- jobs column. See docs/superpowers/specs/2026-07-16-location-dedupe-design.md.
BEGIN;

CREATE TABLE IF NOT EXISTS locations (
  raw         TEXT PRIMARY KEY,   -- exact string as seen on jobs.location
  canonicals  TEXT[] NOT NULL,    -- e.g. '{"New York City, NY","Remote"}'; '{raw}' if unmappable
  components  JSONB NOT NULL,     -- [{canonical, kind, geonameid, country_code, admin1_code}]
  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Poller/service-only: RLS on with NO policies and NO grants. The dashboard never
-- reads this table — jobs.location_canonicals is the denormalized read surface.
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_canonicals TEXT[];
CREATE INDEX IF NOT EXISTS idx_jobs_location_canonicals
  ON jobs USING GIN (location_canonicals);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-16-locations-canonical.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
