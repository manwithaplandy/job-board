-- Phase 0: multi-tenant foundation (go-public SaaS, spec 2026-07-03).
--
-- Turns the single-operator board into a multi-tenant one. Four moves:
--   1. Drop the board-owner concept. The `one_board_owner` unique index forced
--      exactly one is_owner=TRUE profile; every dashboard read is now
--      viewer-scoped, so the flag + index are gone. (Ship the code that stops
--      reading is_owner BEFORE applying this in prod — the DROP is destructive.)
--   2. Invite-gated signup. invite_codes + invite_redemptions are the
--      server-side source of truth for "this account was invited"; user_metadata
--      is client-settable and must NOT be trusted.
--   3. Per-user daily review budget. usage_counters(user_id, day, kind) backs a
--      rolling daily spend the reviewer decrements; profiles.daily_review_cap is
--      an optional per-user override (NULL = env default). review_runs.user_id
--      makes per-user runs attributable.
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, one deny-all RLS
-- policy per new table (migrations/2026-06-26-rls-deny-all-policies.sql), recorded
-- in schema_migrations. Re-running this file is a no-op.
--
-- MANUAL TEST SEED: this migration inserts one ready-to-use invite code,
-- 'FOUNDER-01' (max_uses=5), so the branch is testable immediately after apply.
-- Mint more with:
--   INSERT INTO invite_codes (code, note, max_uses) VALUES ('<CODE>', '<who>', 1);
--
-- MANUAL WALKTHROUGH (the phase reviewer runs this against a local dev server):
--   1. Sign out. Visit /signup, enter an email + password + code 'FOUNDER-01'.
--   2. "Check your email" screen shows. Confirm via the Supabase local inbucket
--      (or a prod-test project) link → lands on /onboarding.
--   3. Onboard: paste/upload a résumé, pick at least one location (mandatory),
--      add instructions → redirected to /. Board shows "pending review" (empty
--      until the next reviewer cycle) and NONE of account A's jobs/reviews.
--   4. Account A's board is unchanged (its own reviews, its own locations).
--   5. Run the reviewer (`python -m reviewer`) → each user's jobs are reviewed
--      independently under their own location filter + daily cap; review_runs
--      has one row per user with a distinct user_id.

BEGIN;

-- 1. Drop the board-owner concept ------------------------------------------------
DROP INDEX IF EXISTS one_board_owner;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_owner;

-- Optional per-user override of the env daily review cap. NULL = use the
-- REVIEW_DAILY_CAP_DEFAULT env default (reviewer/config.py).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_review_cap INT;

-- Attribute each review run to the user it reviewed (multi-user runs).
ALTER TABLE review_runs ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Invite-gated signup ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  note       TEXT,
  max_uses   INT NOT NULL DEFAULT 1,
  uses       INT NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One redemption per email — the server-side proof that an account was invited.
-- (user_metadata is client-settable; only this table is trusted at cost boundaries.)
CREATE TABLE IF NOT EXISTS invite_redemptions (
  email       TEXT NOT NULL,
  code        TEXT NOT NULL REFERENCES invite_codes(code),
  user_id     UUID,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email)
);

-- 3. Per-user, per-day usage counters -------------------------------------------
-- kind='review' is used this phase; generation kinds arrive in Phase 1. "Reset at
-- midnight" falls out of the (user_id, day) key — no cron needed.
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id UUID NOT NULL,
  day     DATE NOT NULL,
  kind    TEXT NOT NULL,
  n       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

-- Deny-all RLS per new table (served via the privileged DIRECT connection only;
-- clears Supabase advisor lint 0008). Mirrors 2026-06-26-rls-deny-all-policies.sql.
ALTER TABLE invite_codes       ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON invite_codes;
CREATE POLICY no_anon_access ON invite_codes       FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE invite_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON invite_redemptions;
CREATE POLICY no_anon_access ON invite_redemptions FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE usage_counters     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON usage_counters;
CREATE POLICY no_anon_access ON usage_counters     FOR ALL USING (false) WITH CHECK (false);

-- Ready-to-use invite for immediate testing of the branch (see header).
INSERT INTO invite_codes (code, note, max_uses)
  VALUES ('FOUNDER-01', 'Phase 0 seed — trusted testers', 5)
  ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-03-multitenant-foundation.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
