-- migrations/2026-07-01-indexes-and-pruned-flag.sql
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run each statement individually against Supabase.

-- job_id-leading indexes: FK-cascade lookups from jobs deletes and prune's
-- EXISTS subqueries currently seq-scan these tables per deleted row.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_reviews_job          ON job_reviews (job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_corrections_job   ON review_corrections (job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_packages_job ON application_packages (job_id);

-- Poller: get_open_external_ids / close_jobs filter WHERE company_id = $1 AND closed_at IS NULL.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_open ON jobs (company_id) WHERE closed_at IS NULL;

-- Dashboard getLatestPollRun / pipeline health sort on started_at.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_poll_runs_started_at ON poll_runs (started_at DESC);

-- Redundant: PK (user_id, job_id) already serves user_id-leading lookups.
DROP INDEX CONCURRENTLY IF EXISTS idx_review_corrections_user;

-- Distinguishes "JD pruned by lifecycle Rule A" (final) from "JD never captured"
-- (refillable). Backfill: every currently-NULL description on a row with a
-- deny/reject review was pruned by Rule A.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_pruned BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE jobs j SET description_pruned = TRUE
WHERE j.description IS NULL
  AND EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
              AND (r.verdict = 'deny' OR r.stage1_decision = 'reject'));
