-- Phase 2: DB-overridable tier settings (go-public SaaS, spec 2026-07-03 "Pricing &
-- tiers" + the ±3.6x cost-band caveat). Tier caps/allowances/prices are compile-time
-- constants in dashboard/lib/entitlements.ts, mirrored by reviewer/entitlements.py and
-- guarded by tests/test_entitlements_parity.py. The spec flags those numbers as
-- uncertain and REQUIRES tuning them WITHOUT a redeploy.
--
-- tier_settings holds ONE jsonb config row per plan that OVERLAYS the compiled
-- defaults field-by-field (see dashboard/lib/tierConfig.ts / reviewer.db.load_tier_settings).
-- The compiled values remain the fallback for any absent/invalid field, so the parity
-- test keeps guarding the DEFAULTS while the DB row only ever tightens/loosens them.
-- Stripe price IDs stay in env (checkout identity); only DISPLAY prices + caps/allowances
-- are DB-tunable here.
--
-- Config is NOT per-user — it is shared operator policy — so it is readable under a
-- shared_read RLS policy by anon + authenticated (the dashboard reads it via withAnonSql,
-- keeping the serviceSql allowlist untouched). Empty by default: an unseeded table means
-- "use the compiled defaults everywhere".
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, RLS enabled with a
-- deny-all no_anon_access policy + the shared_read policy, recorded in schema_migrations.
-- schema.sql mirrors this exactly. Applies cleanly twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS tier_settings (
  plan       TEXT PRIMARY KEY CHECK (plan IN ('standard','pro')),
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tier_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON tier_settings;
CREATE POLICY no_anon_access ON tier_settings FOR ALL USING (false) WITH CHECK (false);
-- Shared operator policy, not per-user: any signed-in user (and the anon board) may
-- read it. ALL writes are service-role/operator (psql / migration), so no
-- authenticated INSERT/UPDATE/DELETE policy.
DROP POLICY IF EXISTS shared_read ON tier_settings;
CREATE POLICY shared_read ON tier_settings FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON tier_settings TO anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-tier-settings.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
