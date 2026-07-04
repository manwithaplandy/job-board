-- Phase 2: account-deletion erasure ledger (go-public SaaS, spec subsystem E).
--
-- user_id is deliberately NOT FK'd to auth.users, so account deletion is an explicit,
-- ordered cross-table cascade (dashboard/lib/accountDeletion.ts), not a DB cascade.
-- account_deletions is the tamper-evident PROOF that an erasure happened: one row per
-- deleted account, keyed by user_id, storing a HASH of the email (never plaintext) so
-- a later "did you delete my data?" request can be answered without retaining PII.
--
-- The insert is idempotent (ON CONFLICT DO NOTHING) so a retry after a partial failure
-- converges. Service-role only: RLS enabled + deny-all no_anon_access, no authenticated
-- grant/policy (users never read the ledger).
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql + tests/conftest mirror it. Clean twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id    UUID PRIMARY KEY,
  email_hash TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON account_deletions;
CREATE POLICY no_anon_access ON account_deletions FOR ALL USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-account-deletions.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
