-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Company-enrichment substrate: real display names + grounding text for the screener.
-- Raw `name` (slug) is NOT overwritten — it stays the stable join/display fallback.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS display_name    TEXT,
  ADD COLUMN IF NOT EXISTS about           TEXT,
  ADD COLUMN IF NOT EXISTS about_source    TEXT
    CHECK (about_source IN ('ats_board','jd_probe','serp')),
  ADD COLUMN IF NOT EXISTS web_description TEXT,
  ADD COLUMN IF NOT EXISTS web_searched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enriched_at     TIMESTAMPTZ;
