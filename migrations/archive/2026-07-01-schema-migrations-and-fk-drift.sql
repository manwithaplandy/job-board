BEGIN;
-- Minimal applied-migrations ledger (applied manually alongside each migration).
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Deny-all RLS to match every other table (advisor lint 0008); the app never reads
-- this via the anon API. Mirrors 2026-06-26-rls-deny-all-policies.sql's idempotent form.
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON schema_migrations;
CREATE POLICY no_anon_access ON schema_migrations FOR ALL USING (false) WITH CHECK (false);
-- Reconcile drift: 2026-06-24-reviews.sql created auth.users FKs in prod that
-- schema.sql (the canonical schema) deliberately omits. Drop them so prod,
-- tests, and schema.sql enforce identical rules.
ALTER TABLE profiles    DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE job_reviews DROP CONSTRAINT IF EXISTS job_reviews_user_id_fkey;
COMMIT;
