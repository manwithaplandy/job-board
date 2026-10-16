BEGIN;
-- One retained opt-in row, not a reusable global relaxation. No pilot is created.
ALTER TABLE lifecycle_identity_campaigns ADD COLUMN IF NOT EXISTS exploratory_pilot boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS one_exploratory_identity_pilot
 ON lifecycle_identity_campaigns(exploratory_pilot) WHERE exploratory_pilot;

ALTER TABLE lifecycle_identity_authorizations
 ADD COLUMN IF NOT EXISTS observation_basis text NOT NULL DEFAULT 'measurement',
 ADD COLUMN IF NOT EXISTS disk_fetched_at timestamptz,
 ADD COLUMN IF NOT EXISTS wal_fetched_at timestamptz,
 ADD COLUMN IF NOT EXISTS disk_source_observed_at timestamptz,
 ADD COLUMN IF NOT EXISTS wal_source_observed_at timestamptz;
ALTER TABLE lifecycle_identity_authorizations ALTER COLUMN observed_at DROP NOT NULL;
ALTER TABLE lifecycle_identity_authorizations DROP CONSTRAINT IF EXISTS identity_observation_basis;
ALTER TABLE lifecycle_identity_authorizations ADD CONSTRAINT identity_observation_basis CHECK (
 (observation_basis='measurement' AND observed_at IS NOT NULL AND disk_fetched_at IS NULL AND wal_fetched_at IS NULL)
 OR (observation_basis='retrieval_unknown' AND observed_at IS NULL AND disk_fetched_at IS NOT NULL AND wal_fetched_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION lifecycle_identity_pilot_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN
   IF EXISTS(SELECT FROM public.lifecycle_identity_campaigns WHERE exploratory_pilot) THEN
     RAISE EXCEPTION 'exploratory pilot receipt must be retained' USING ERRCODE='23514';
   END IF;
   RETURN NULL;
 END IF;
 IF TG_OP='DELETE' THEN
   IF OLD.exploratory_pilot THEN
     RAISE EXCEPTION 'exploratory pilot receipt must be retained' USING ERRCODE='23514';
   END IF;
   RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.exploratory_pilot IS DISTINCT FROM OLD.exploratory_pilot THEN
     RAISE EXCEPTION 'pilot must be a new explicitly scoped campaign' USING ERRCODE='23514';
   END IF;
   IF OLD.exploratory_pilot AND (
     ROW(NEW.id,NEW.source_revision,NEW.activation_generation,NEW.created_at,NEW.job_high_water,NEW.company_high_water)
       IS DISTINCT FROM ROW(OLD.id,OLD.source_revision,OLD.activation_generation,OLD.created_at,OLD.job_high_water,OLD.company_high_water)
     OR NEW.expires_at>OLD.expires_at OR NEW.max_job_rows>OLD.max_job_rows
     OR NEW.max_company_rows>OLD.max_company_rows OR NEW.max_turns>OLD.max_turns
     OR NEW.turns<OLD.turns OR NEW.job_rows<OLD.job_rows OR NEW.mapped_jobs<OLD.mapped_jobs
     OR NEW.company_rows<OLD.company_rows OR NEW.mapped_accounts<OLD.mapped_accounts
     OR NEW.company_cursor<OLD.company_cursor
     OR (OLD.job_cursor IS NOT NULL AND (NEW.job_cursor IS NULL OR NEW.job_cursor<OLD.job_cursor))
     OR (OLD.before_bytes IS NOT NULL AND NEW.before_bytes IS DISTINCT FROM OLD.before_bytes)
     OR (OLD.state IN ('completed','stopped','budget_exhausted') AND NEW.state<>OLD.state)
   ) THEN
     RAISE EXCEPTION 'exploratory pilot scope or progress cannot reset or expand' USING ERRCODE='23514';
   END IF;
 END IF;
 IF NEW.exploratory_pilot THEN
   IF NEW.max_job_rows>2000 OR NEW.max_company_rows>2000 OR NEW.max_turns<>1
      OR NEW.expires_at>NEW.created_at+interval '30 minutes' THEN
     RAISE EXCEPTION 'exploratory pilot exceeds approved limits' USING ERRCODE='23514';
   END IF;
   IF TG_OP='INSERT' AND (
     NEW.created_at>clock_timestamp() OR NEW.created_at<clock_timestamp()-interval '5 seconds'
     OR NEW.expires_at<=clock_timestamp() OR NEW.turns<>0 OR NEW.job_rows<>0
     OR NEW.mapped_jobs<>0 OR NEW.company_rows<>0 OR NEW.mapped_accounts<>0
     OR NEW.job_cursor IS NOT NULL OR NEW.company_cursor<>0 OR NEW.before_bytes IS NOT NULL
     OR NEW.phase<>'jobs' OR NEW.state NOT IN ('paused','running')
   ) THEN
     RAISE EXCEPTION 'exploratory pilot must start empty with a current expiry' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_identity_pilot_scope() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_identity_pilot_scope ON lifecycle_identity_campaigns;
CREATE TRIGGER lifecycle_identity_pilot_scope BEFORE INSERT OR UPDATE OR DELETE ON lifecycle_identity_campaigns
 FOR EACH ROW EXECUTE FUNCTION lifecycle_identity_pilot_scope();
DROP TRIGGER IF EXISTS lifecycle_identity_pilot_retain ON lifecycle_identity_campaigns;
CREATE TRIGGER lifecycle_identity_pilot_retain BEFORE TRUNCATE ON lifecycle_identity_campaigns
 FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_identity_pilot_scope();

-- Shared by worker admission and deferred commit. Receipt recency is explicitly
-- distinct from measurement freshness, which remains unknown for the pilot.
CREATE OR REPLACE FUNCTION lifecycle_identity_observation_current(
 a public.lifecycle_identity_authorizations, c public.lifecycle_identity_campaigns
) RETURNS boolean LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT COALESCE((NOT c.exploratory_pilot OR c.expires_at>clock_timestamp()) AND CASE a.observation_basis
 WHEN 'measurement' THEN a.observed_at<=clock_timestamp()
   AND a.observed_at>clock_timestamp()-interval '90 seconds'
 WHEN 'retrieval_unknown' THEN c.exploratory_pilot AND a.observed_at IS NULL
   AND c.max_job_rows<=2000 AND c.max_company_rows<=2000 AND c.max_turns=1
   AND c.expires_at<=c.created_at+interval '30 minutes' AND c.expires_at>clock_timestamp()
   AND a.disk_fetched_at<=clock_timestamp() AND a.wal_fetched_at<=clock_timestamp()
   AND a.disk_fetched_at>clock_timestamp()-interval '90 seconds'
   AND a.wal_fetched_at>clock_timestamp()-interval '90 seconds'
 ELSE false END,false)
$$;
REVOKE ALL ON FUNCTION lifecycle_identity_observation_current(public.lifecycle_identity_authorizations,public.lifecycle_identity_campaigns) FROM PUBLIC,anon,authenticated;

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
     AND a.resident_wal_bytes<4294967296::bigint) THEN
   RAISE EXCEPTION 'identity campaign authorization/capacity expired before commit' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_identity_check_authorization() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-15-15-identity-exploratory-pilot.sql') ON CONFLICT DO NOTHING;
COMMIT;
