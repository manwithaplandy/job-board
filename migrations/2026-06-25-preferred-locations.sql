-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user location include-list used to pre-filter jobs before AI review and on
-- the dashboard list. Empty array = no location preference (review/show everything).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] NOT NULL DEFAULT '{}';
