-- Read-only estimate. Run against the intended database with a read-only role.
-- Matches the closed-job retention policy; never treat stale last_seen_at or
-- company deactivation as evidence that an upstream posting is closed.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
WITH candidates AS (
  SELECT j.id, j.description
  FROM public.jobs j
  WHERE j.closed_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.job_reviews r
                    WHERE r.job_id = j.id AND r.verdict = 'approve')
    AND NOT EXISTS (SELECT 1 FROM public.review_corrections rc WHERE rc.job_id = j.id)
    AND NOT EXISTS (SELECT 1 FROM public.application_packages ap WHERE ap.job_id = j.id)
)
SELECT now() AS measured_at,
       pg_database_size(current_database()) AS database_bytes,
       pg_total_relation_size('public.jobs') AS jobs_total_bytes,
       pg_relation_size('public.jobs') AS jobs_heap_bytes,
       pg_indexes_size('public.jobs') AS jobs_index_bytes,
       (SELECT count(*) FROM candidates) AS eligible_rows,
       (SELECT coalesce(sum(coalesce(pg_column_size(description), 0)), 0)
        FROM candidates) AS eligible_description_bytes;
COMMIT;
-- pg_column_size is a payload estimate, NOT bytes that the filesystem will recover.
-- It excludes row/index overhead, dead tuples, page packing and WAL/replica effects.
