-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user remembered board filter state (search, categories, locations, remote,
-- min fit, min pay, sort). NULL = no saved filters (board shows defaults).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS board_filters JSONB;
