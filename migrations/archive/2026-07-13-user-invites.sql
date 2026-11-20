-- User-sent invites (spec docs/superpowers/specs/2026-07-13-user-invites-design.md).
--
-- invite_codes gains attribution: created_by (NULL = operator/admin-minted — every
-- pre-existing row stays valid) and recipient_email (bookkeeping for emailed invites;
-- redemption does NOT enforce it — codes stay open single-use). The column is named
-- created_by, not user_id, deliberately: the user_id-discovery drift guards
-- (test_rls_isolation / accountDeletion.test) key on `user_id`, and this table's
-- erasure semantics are custom (anonymize, never delete — a code already in someone's
-- inbox must keep redeeming; see dashboard/lib/accountDeletion.ts deleteUserRowsTx).
--
-- invite_allowances: per-user invite budget. Rows are lazy-created on first invite
-- action with the then-current default (app_settings.invite_default_allowance);
-- `granted` records the initial grant for audit/top-up legibility. Service-write-only
-- (all writes in dashboard/lib/invites.ts, the serviceSql-allowlisted file); the owner
-- may only SELECT ("2 of 3 invites left" renders under the user's own session).
-- Correctness of the spend rests on the atomic UPDATE … WHERE remaining > 0 RETURNING
-- guard in lib/invites.ts createUserInvite, same idiom as redeemInvite.
--
-- app_settings: generic operator key-value config (deliberately separate from
-- tier_settings, whose PK is CHECK-constrained to plan names). Same RLS shape as
-- tier_settings: shared operator policy, non-secret → shared_read for anon +
-- authenticated (dashboard reads via withAnonSql; reviewer reads on its privileged
-- conn); ALL writes are service-role (admin-gated lib/appSettings.ts). Unseeded keys
-- mean "use the compiled defaults" (invite_comp_plan='standard',
-- invite_default_allowance=3 — dashboard/lib/appSettings.ts + reviewer/entitlements.py).
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql mirrors it. Applies cleanly twice on a scratch DB.

BEGIN;

ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS recipient_email TEXT;
-- Sender-scoped lookups (deletion scrub, export of "codes I minted").
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by
  ON invite_codes (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS invite_allowances (
  user_id    UUID PRIMARY KEY,
  remaining  INT NOT NULL CHECK (remaining >= 0),
  granted    INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_allowances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON invite_allowances;
CREATE POLICY no_anon_access ON invite_allowances FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_read ON invite_allowances;
CREATE POLICY owner_read ON invite_allowances FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
GRANT SELECT ON invite_allowances TO authenticated;

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON app_settings;
CREATE POLICY no_anon_access ON app_settings FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS shared_read ON app_settings;
CREATE POLICY shared_read ON app_settings FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON app_settings TO anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-13-user-invites.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
