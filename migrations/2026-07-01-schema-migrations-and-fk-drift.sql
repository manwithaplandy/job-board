BEGIN;
-- Minimal applied-migrations ledger (applied manually alongside each migration).
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Reconcile drift: 2026-06-24-reviews.sql created auth.users FKs in prod that
-- schema.sql (the canonical schema) deliberately omits. Drop them so prod,
-- tests, and schema.sql enforce identical rules.
ALTER TABLE profiles    DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE job_reviews DROP CONSTRAINT IF EXISTS job_reviews_user_id_fkey;
COMMIT;
