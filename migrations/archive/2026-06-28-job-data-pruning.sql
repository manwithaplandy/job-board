-- Job-data pruning + raw elimination.
-- Apply DURING the rollout maintenance window, AFTER the description backfill
-- has run and `SELECT count(*) FROM jobs WHERE description IS NULL AND raw IS NOT NULL` = 0.

-- 1. Cascade review rows when their job is pruned.
ALTER TABLE job_reviews DROP CONSTRAINT job_reviews_job_id_fkey;
ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 2. Drop the now-distilled raw payload (instant catalog change; space is
--    returned by the separate `VACUUM FULL jobs;` run in the SQL editor).
ALTER TABLE jobs DROP COLUMN raw;
