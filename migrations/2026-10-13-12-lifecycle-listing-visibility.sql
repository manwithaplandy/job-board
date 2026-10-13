BEGIN;
-- Mapped-listing overrides only: NULL or absent rows retain the caller's closed_at gate.
-- Avoid scanning jobs again inside a SECURITY DEFINER function. Existing scalar
-- helpers and shared jobs reads expose the same results to these roles. Re-review
-- this enumeration helper if the shared jobs RLS policy becomes narrower.
CREATE OR REPLACE FUNCTION public.lifecycle_listing_visibility(p_include_older_live boolean DEFAULT false)
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
  SELECT s.job_id,
    CASE WHEN NOT s.has_live_source THEN false
      WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN NULL::boolean
      ELSE NOT ctl.feed_enabled OR s.has_discovery END,
    CASE WHEN NOT s.has_live_source THEN true
      WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN NULL::boolean
      ELSE false END
  FROM listing_state s CROSS JOIN public.lifecycle_control ctl
  WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_listing_visibility(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_listing_visibility(boolean) TO anon,authenticated;
INSERT INTO public.schema_migrations(filename) VALUES ('2026-10-13-12-lifecycle-listing-visibility.sql') ON CONFLICT DO NOTHING;
COMMIT;
