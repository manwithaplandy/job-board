-- Stamp each application_packages row with the profiles.profile_version it was
-- generated from, so the board can flag a tailored résumé as stale after the
-- user changes their résumé/instructions. Nullable + no backfill: rows written
-- before this column stay NULL and are treated as "provenance unknown" (never
-- badged). Additive and non-breaking — safe to apply before deploying the code
-- that SELECTs it.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS profile_version TEXT;
