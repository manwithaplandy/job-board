BEGIN;
-- Owner-approved assumption for the single exploratory pilot only. No data seeded.
ALTER TABLE lifecycle_identity_authorizations
 ADD COLUMN IF NOT EXISTS wal_basis text NOT NULL DEFAULT 'verified_bytes',
 ADD COLUMN IF NOT EXISTS wal_native_mb numeric,
 ADD COLUMN IF NOT EXISTS wal_assumed_mib_upper_bytes bigint GENERATED ALWAYS AS (
   CASE WHEN wal_native_mb>=0 AND ceil(wal_native_mb*1048576)<=9223372036854775807::numeric
        THEN ceil(wal_native_mb*1048576)::bigint END
 ) STORED;
ALTER TABLE lifecycle_identity_authorizations ALTER COLUMN resident_wal_bytes DROP NOT NULL;
ALTER TABLE lifecycle_identity_authorizations DROP CONSTRAINT IF EXISTS identity_wal_basis;
ALTER TABLE lifecycle_identity_authorizations ADD CONSTRAINT identity_wal_basis CHECK ((
 (wal_basis='verified_bytes' AND resident_wal_bytes IS NOT NULL AND wal_native_mb IS NULL)
 OR (wal_basis='assumed_mib' AND resident_wal_bytes IS NULL AND wal_native_mb IS NOT NULL
     AND wal_assumed_mib_upper_bytes IS NOT NULL
     AND wal_assumed_mib_upper_bytes<=capacity_bytes-free_bytes)
) IS TRUE);

-- Exact bytes and assumed bounds remain distinct in storage. Only this helper
-- selects the appropriate input for the unchanged capacity threshold.
CREATE OR REPLACE FUNCTION lifecycle_identity_wal_bound(
 a public.lifecycle_identity_authorizations, c public.lifecycle_identity_campaigns
) RETURNS bigint LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT CASE WHEN a.wal_basis='verified_bytes' THEN a.resident_wal_bytes
   WHEN a.wal_basis='assumed_mib' AND c.exploratory_pilot THEN a.wal_assumed_mib_upper_bytes
   ELSE NULL END
$$;
REVOKE ALL ON FUNCTION lifecycle_identity_wal_bound(public.lifecycle_identity_authorizations,public.lifecycle_identity_campaigns) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION lifecycle_identity_check_authorization() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE current_campaign public.lifecycle_identity_campaigns;
BEGIN
 IF NEW.turns IS NOT DISTINCT FROM OLD.turns
    AND NEW.mapped_jobs IS NOT DISTINCT FROM OLD.mapped_jobs
    AND NEW.mapped_accounts IS NOT DISTINCT FROM OLD.mapped_accounts
    AND NEW.state<>'completed' THEN RETURN NULL; END IF;
 -- Read the final row: a later UPDATE in this transaction cannot hide expiry
 -- behind the earlier transition that queued this deferred trigger.
 SELECT * INTO current_campaign FROM public.lifecycle_identity_campaigns WHERE id=NEW.id;
 IF NOT EXISTS(SELECT FROM public.lifecycle_identity_authorizations a
   WHERE a.campaign_id=NEW.id AND a.source_revision=current_campaign.source_revision
     AND a.activation_generation=current_campaign.activation_generation
     AND a.project_ref='fdhspmavadgucktetzoi' AND a.source='supabase_metrics'
     AND a.authorized_at<=clock_timestamp() AND a.valid_until>clock_timestamp()
     AND public.lifecycle_identity_observation_current(a,current_campaign)
     AND a.free_bytes>greatest(1073741824::bigint,a.capacity_bytes/5)
     AND public.lifecycle_identity_wal_bound(a,current_campaign)<4294967296::bigint) THEN
   RAISE EXCEPTION 'identity campaign authorization/capacity expired before commit' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_identity_check_authorization() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-16-16-identity-pilot-wal-assumption.sql') ON CONFLICT DO NOTHING;
COMMIT;
