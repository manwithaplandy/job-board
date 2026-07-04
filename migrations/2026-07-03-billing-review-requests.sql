-- Phase 1: billing + on-demand review queue (go-public SaaS, spec subsystems C/F).
--
-- Two tables that ship together this phase:
--   * subscriptions — the local mirror of Stripe truth, keyed by user_id. The
--     Stripe webhook (service role) is the SOLE writer; users only ever read their
--     own row under RLS. No FK to auth.users (house convention, see profiles).
--   * review_requests — the on-demand "review my board now" queue shared by the
--     dashboard (enqueue) and the reviewer worker (claim/transition). A partial
--     unique index enforces one active request per user.
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, RLS enabled with a
-- deny-all no_anon_access policy per table PLUS the Phase-1 per-user policies,
-- recorded in schema_migrations. schema.sql mirrors this exactly. Applies cleanly
-- twice on a scratch DB.
--
-- ORDERING: apply 2026-07-03-rls-tenant-isolation.sql FIRST — the per-user policies
-- below call public.app_user_id(), which that migration creates.

BEGIN;

-- 1. subscriptions --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                UUID PRIMARY KEY,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan                   TEXT CHECK (plan IN ('standard','pro')),
  status                 TEXT NOT NULL,             -- raw Stripe status string
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. review_requests ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_requests (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','done','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  notes        TEXT
);
-- One active (pending or running) request per user — the enqueue path treats the
-- resulting 23505 as idempotent success, and the worker's partial index count is
-- what "one active slot" means for stale-claim recovery.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_review_request
  ON review_requests (user_id) WHERE status IN ('pending','running');
-- Worker claim scan (oldest pending first).
CREATE INDEX IF NOT EXISTS idx_review_requests_pending
  ON review_requests (requested_at) WHERE status = 'pending';

-- 3. RLS ------------------------------------------------------------------------
-- Deny-all baseline (house style; clears advisor lint 0008) + Phase-1 per-user policies.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON subscriptions;
CREATE POLICY no_anon_access ON subscriptions FOR ALL USING (false) WITH CHECK (false);
-- Read-only for the owner; ALL writes are service-role/webhook.
DROP POLICY IF EXISTS owner_read ON subscriptions;
CREATE POLICY owner_read ON subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON review_requests;
CREATE POLICY no_anon_access ON review_requests FOR ALL USING (false) WITH CHECK (false);
-- Owner may read their requests and enqueue new ones; only the worker (service
-- role) transitions status, so NO authenticated UPDATE/DELETE policy.
DROP POLICY IF EXISTS owner_read ON review_requests;
CREATE POLICY owner_read ON review_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
DROP POLICY IF EXISTS owner_insert ON review_requests;
CREATE POLICY owner_insert ON review_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- 4. Grants ---------------------------------------------------------------------
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT, INSERT ON review_requests TO authenticated;
GRANT USAGE ON SEQUENCE review_requests_id_seq TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-03-billing-review-requests.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
