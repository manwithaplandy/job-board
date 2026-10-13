BEGIN;
-- Read-only public lifecycle display/predicate. Underlying tables stay service-only.
-- Fixed SELECTs expose no private rows, claims, credentials or control internals.
CREATE OR REPLACE FUNCTION public.lifecycle_job_state(p_job_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'feedEnabled', ctl.feed_enabled, 'sourceEnabled', ctl.source_enabled,
    'sourceAvailability', sl.source_availability,
    'discoveryAnchorAt', sl.discovery_anchor_at,
    'discoveryExpiresAt', sl.discovery_expires_at,
    'payloadAvailability', CASE WHEN j.description IS NOT NULL THEN 'available'
      WHEN sl.payload_retired_at IS NOT NULL OR j.description_pruned THEN 'retired' ELSE 'missing' END)
  FROM public.jobs j
  CROSS JOIN public.lifecycle_control ctl
  JOIN LATERAL (
    SELECT l.source_availability,l.discovery_anchor_at,l.discovery_expires_at,l.payload_retired_at
    FROM public.source_listings l WHERE l.job_id=j.id
    ORDER BY (l.source_availability='closed') ASC,
      (l.discovery_expires_at > statement_timestamp()) DESC,
      (l.source_availability='open') DESC,l.discovery_expires_at DESC,l.id ASC LIMIT 1
  ) sl ON true
  WHERE j.id=p_job_id AND ctl.singleton
$$;
CREATE OR REPLACE FUNCTION public.lifecycle_discovery_visible(p_job_id text,p_legacy_closed_at timestamptz,p_include_older_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    -- Missing mappings retain honest legacy behavior; rollout requires mapping readiness.
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
      THEN p_legacy_closed_at IS NULL
    -- Proven closure remains excluded when flags roll back.
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN false
    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NULL
    ELSE EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id
      AND l.source_availability<>'closed'
      AND (NOT ctl.feed_enabled OR l.discovery_expires_at > statement_timestamp()
        OR (p_include_older_live AND l.source_availability='open')))
    END
  FROM public.lifecycle_control ctl WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_job_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_job_state(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.lifecycle_source_closed(p_job_id text,p_legacy_closed_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
      THEN p_legacy_closed_at IS NOT NULL
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
    ELSE false END
  FROM public.lifecycle_control ctl WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
COMMIT;
