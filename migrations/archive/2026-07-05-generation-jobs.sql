-- Async generation tracking (background résumé / cover-letter / prepare).
--
-- The generate routes now return 202 immediately and finish the LLM work in a
-- Vercel `after()` callback, so the client learns about completion by POLLING
-- (GET /api/generations) instead of holding the request open. generation_jobs is
-- that poll's source of truth: one row per accepted generation, `pending` at
-- accept time, settled to `ready`/`failed` by the background work. `error` holds
-- the USER-SAFE failure/partial-failure message (never a raw upstream error).
--
-- kind='prepare' is the multi-leg /api/application/prepare tracked as ONE row:
-- `ready` when its legs settle (the route salvages per-leg), `failed` only when
-- the whole prepare throws or every LLM leg fails.
--
-- user_id is deliberately NOT FK'd to auth.users (house convention, see profiles);
-- job_id is TEXT — jobs.id is a composite "ats:company:external" string, not a uuid.
--
-- The partial unique index makes double-submits converge on the existing pending
-- row instead of racing two background generations for the same (user, job, kind).
--
-- RLS: deny-all + owner_access, same pattern as application_packages. All
-- dashboard reads/writes run through withUserSql (authenticated role); rows are
-- charged/refunded against usage_counters by the routes, never by this table.
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql + tests/conftest mirror it. Clean twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS generation_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('resume','cover','prepare')),
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','failed')),
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX IF NOT EXISTS idx_generation_jobs_job ON generation_jobs (job_id);
-- Poll query: the viewer's pending rows + recently-settled rows.
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user ON generation_jobs (user_id, status);
-- One in-flight generation per (user, job, kind); settled rows don't block a rerun.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_generation
  ON generation_jobs (user_id, job_id, kind) WHERE status = 'pending';

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON generation_jobs;
CREATE POLICY no_anon_access ON generation_jobs FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_access ON generation_jobs;
CREATE POLICY owner_access ON generation_jobs FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));

-- Owner-scoped CRUD (DELETE backs the per-user housekeeping prune of old settled
-- rows). Cost integrity is unaffected: allowance charges live in usage_counters
-- (SELECT-only for users) and status rows never drive refunds server-side.
GRANT SELECT, INSERT, UPDATE, DELETE ON generation_jobs TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-05-generation-jobs.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
