-- Phase 2: OpenRouter spend-alert snapshots (go-public SaaS, spec D/G — the spend
-- alert backstop behind the per-user caps).
--
-- observability.spend_alert (a Railway cron) periodically records OpenRouter's
-- total_usage / total_credits here, then computes the trailing-24h BURN by differencing
-- against the oldest snapshot in the window. This complements — does not replace — the
-- hard OutOfCreditsError halt in observability/llm.py: a cap bug or cost-capture gap
-- should page the operator BEFORE the credit balance hits zero.
--
-- Service-role only: RLS enabled + deny-all no_anon_access (the dashboard never reads it).
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql + tests/conftest mirror it. Clean twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS openrouter_usage_snapshots (
  taken_at      TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  total_usage   NUMERIC NOT NULL,
  total_credits NUMERIC
);

ALTER TABLE openrouter_usage_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON openrouter_usage_snapshots;
CREATE POLICY no_anon_access ON openrouter_usage_snapshots FOR ALL USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-openrouter-usage-snapshots.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
