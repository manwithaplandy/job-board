-- Admin plan override (spec docs/superpowers/specs/2026-07-16-admin-plan-override-design.md).
--
-- plan_overrides: operator-pinned effective tier, one row per user. An ACTIVE row
-- (expires_at NULL or in the future) WINS over both the Stripe subscription mirror
-- and the invite comp in resolvePlan/resolve_plan — pin semantics, explicit operator
-- intent, so the trialing-below-Pro clamp does not apply. Clearing the pin = DELETE.
-- subscriptions keeps its invariant (the Stripe webhook stays its sole state writer);
-- this table is a separate overlay — like tier_settings, but per-user.
--
-- RLS mirrors invite_allowances: deny-all + owner SELECT (the pin already surfaces to
-- its owner as their effective plan; getViewerPlan reads the row under the user's own
-- session); ALL writes are service-role (isAdmin-gated app/actions/adminSettings.ts →
-- dashboard/lib/planOverrides.ts).
--
-- user_id deliberately NOT FK'd to auth.users (house convention, see profiles).
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql mirrors it. Applies cleanly twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS plan_overrides (
  user_id    UUID PRIMARY KEY,
  plan       TEXT NOT NULL CHECK (plan IN ('standard','pro')),
  expires_at TIMESTAMPTZ,          -- NULL = pinned until cleared
  note       TEXT,                 -- operator memo ("comped for feedback")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plan_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON plan_overrides;
CREATE POLICY no_anon_access ON plan_overrides FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_read ON plan_overrides;
CREATE POLICY owner_read ON plan_overrides FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
GRANT SELECT ON plan_overrides TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-16-plan-overrides.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
