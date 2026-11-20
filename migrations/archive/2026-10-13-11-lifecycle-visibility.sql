BEGIN;
-- Set-based equivalent of the existing public scalar visibility/closure reads.
-- The row estimate prevents corpus scans from becoming 800k individual index probes.
-- No private columns, write grants, control changes, or population writes.
-- Both client roles already read all jobs and execute the equivalent scalar helpers.
-- Re-review this definer function if jobs' shared-read RLS policy becomes narrower.
CREATE OR REPLACE FUNCTION public.lifecycle_job_visibility(p_include_older_live boolean DEFAULT false)
RETURNS TABLE(job_id text, discovery_visible boolean, source_closed boolean)
LANGUAGE sql STABLE SECURITY DEFINER ROWS 1000000 SET search_path = pg_catalog, public AS $$
  WITH listing_state AS (
    SELECT l.job_id,
      bool_or(l.source_availability <> 'closed') AS has_live_source,
      bool_or(l.source_availability <> 'closed' AND
        (l.discovery_expires_at > statement_timestamp()
         OR (COALESCE(p_include_older_live,false) AND l.source_availability = 'open'))) AS has_discovery
    FROM public.source_listings l GROUP BY l.job_id
  )
  SELECT j.id,
    CASE WHEN s.job_id IS NULL THEN j.closed_at IS NULL
      WHEN NOT s.has_live_source THEN false
      WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN j.closed_at IS NULL
      ELSE NOT ctl.feed_enabled OR s.has_discovery END,
    CASE WHEN s.job_id IS NULL THEN j.closed_at IS NOT NULL
      WHEN NOT s.has_live_source THEN true
      WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN j.closed_at IS NOT NULL
      ELSE false END
  FROM public.jobs j
  CROSS JOIN public.lifecycle_control ctl
  LEFT JOIN listing_state s ON s.job_id = j.id
  WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_job_visibility(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_job_visibility(boolean) TO anon,authenticated;
INSERT INTO public.schema_migrations(filename) VALUES ('2026-10-13-11-lifecycle-visibility.sql') ON CONFLICT DO NOTHING;
COMMIT;
