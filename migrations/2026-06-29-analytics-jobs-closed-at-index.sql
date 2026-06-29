-- Analytics dashboard perf: the /analytics funnel runs a full-table jobs aggregate
-- (count(*) + count FILTER (WHERE closed_at IS NULL / IS NOT NULL)) which, without an
-- index on closed_at, does a sequential scan of the large jobs table (~116k rows,
-- bloated by the raw column). This index lets that aggregate use an index-only scan and
-- also supports the closed_at IS NOT NULL job-lifespan query. Additive and safe.
--
-- Apply to prod via the Supabase MCP (apply_migration) or the SQL editor. IF NOT EXISTS
-- makes it idempotent. Pair with the app-side caching of getPipelineSnapshot/getRunSeries.
CREATE INDEX IF NOT EXISTS idx_jobs_closed_at ON jobs (closed_at);
