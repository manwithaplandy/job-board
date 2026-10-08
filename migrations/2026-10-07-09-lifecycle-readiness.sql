-- Task13 integration readiness only. No attestations, mapping, destinations or activation.
BEGIN;
ALTER TABLE lifecycle_writer_readiness ADD COLUMN IF NOT EXISTS source_revision text
 CHECK(source_revision IS NULL OR source_revision ~ '^[0-9a-f]{40}$');
CREATE TABLE IF NOT EXISTS lifecycle_backfill_readiness (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 activation_generation bigint, source_revision text CHECK(source_revision ~ '^[0-9a-f]{40}$'),
 phase text NOT NULL DEFAULT 'jobs' CHECK(phase IN ('jobs','companies')),
 cursor text, completed_at timestamptz
);
INSERT INTO lifecycle_backfill_readiness(singleton) VALUES(true) ON CONFLICT DO NOTHING;
REVOKE ALL ON lifecycle_backfill_readiness FROM PUBLIC,anon,authenticated;
ALTER TABLE lifecycle_backfill_readiness ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION lifecycle_private.release_ready(generation bigint) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.lifecycle_backfill_readiness b
  WHERE b.singleton AND b.activation_generation=generation AND b.completed_at IS NOT NULL
   AND b.source_revision IS NOT NULL AND NOT EXISTS (
    SELECT FROM unnest(ARRAY['source_metadata','company_writers','location_writers','demand_snapshots',
     'dashboard_snapshots','reviewer_snapshots','account_cascade','legacy_consumers',
     'archive_producers','operational_preallocation']) required(writer)
    WHERE NOT EXISTS(SELECT FROM public.lifecycle_writer_readiness r
     WHERE r.writer=required.writer AND r.contract_version=1 AND r.source_revision=b.source_revision
      AND r.validated_at IS NOT NULL AND r.validated_at<=clock_timestamp() AND length(btrim(r.notes))>0)))
$$;
REVOKE ALL ON FUNCTION lifecycle_private.release_ready(bigint) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.archive_destination_ready() RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.public_archive_destination
  WHERE singleton AND validated_at<=clock_timestamp() AND private_validated AND encryption_validated
  AND policy_validated AND length(btrim(validation_evidence))>0
  AND bucket ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' AND bucket NOT LIKE '%..%' AND bucket !~ '^[0-9.]+$'
  AND region ~ '^[a-z]{2}(-[a-z]+)+-[0-9]$' AND expected_owner ~ '^[0-9]{12}$'
  AND length(object_prefix)<=256 AND object_prefix ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$')
$$;
REVOKE ALL ON FUNCTION lifecycle_private.archive_destination_ready() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.archive_baseline_ready() RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE t text; key text; missing boolean;
BEGIN
 FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations',
  'brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
  key:=CASE WHEN t='locations' THEN 'raw' ELSE 'id' END;
  EXECUTE format('SELECT EXISTS(SELECT FROM public.%I t WHERE NOT EXISTS(SELECT FROM public.public_archive_heads h WHERE h.aggregate_type=$1 AND h.aggregate_id=t.%I::text))',t,key) INTO missing USING t;
  IF missing THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.archive_baseline_ready() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION preserve_lifecycle_control() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'lifecycle control history cannot be removed'; END IF;
 IF OLD.archive_ever_activated AND NOT NEW.archive_ever_activated THEN RAISE EXCEPTION 'archive activation history is monotonic'; END IF;
 IF OLD.identity_migration_activated_at IS NOT NULL AND NEW.identity_migration_activated_at IS DISTINCT FROM OLD.identity_migration_activated_at THEN RAISE EXCEPTION 'identity migration activation is immutable'; END IF;
 IF NEW.activation_generation<OLD.activation_generation OR NEW.flags_version<OLD.flags_version THEN RAISE EXCEPTION 'control generation and schema version are monotonic'; END IF;
 IF (to_jsonb(NEW)-'identity_migration_activated_at') IS DISTINCT FROM (to_jsonb(OLD)-'identity_migration_activated_at') AND NEW.activation_generation<=OLD.activation_generation THEN RAISE EXCEPTION 'control changes require a newer activation generation'; END IF;
 IF NEW.safety_stage='enforced' AND OLD.safety_stage<>'enforced' OR (NEW.retirement_enabled AND NOT NEW.retirement_dry_run) THEN
  IF NOT (NEW.identity_enabled AND NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
    OR NOT lifecycle_private.release_ready(OLD.activation_generation) THEN
   RAISE EXCEPTION 'lifecycle activation requires compatible writer and backfill readiness'; END IF;
  IF NEW.retirement_enabled AND NOT NEW.retirement_dry_run AND NEW.safety_stage<>'enforced' THEN
   RAISE EXCEPTION 'retirement requires enforced lifecycle stage'; END IF;
 END IF;
 IF OLD.safety_stage='enforced' AND NEW.safety_stage<>'enforced' THEN RAISE EXCEPTION 'unsafe legacy rollback after cutover'; END IF;
 IF NEW.archive_stage<> 'never_activated' AND NOT OLD.archive_ever_activated OR NEW.export_enabled AND NOT OLD.export_enabled THEN
  IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
    OR NOT lifecycle_private.release_ready(OLD.activation_generation)
    OR NOT lifecycle_private.archive_destination_ready() THEN
   RAISE EXCEPTION 'archive activation requires validated destination and producer readiness'; END IF;
 END IF;
 IF NEW.export_enabled AND NOT OLD.export_enabled AND NOT lifecycle_private.archive_baseline_ready() THEN
  RAISE EXCEPTION 'archive export requires completed bounded baseline'; END IF;
 IF OLD.archive_ever_activated AND NEW.archive_stage='active' AND OLD.archive_stage<>'active' THEN
  IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
    OR NOT lifecycle_private.release_ready(OLD.activation_generation)
    OR NOT lifecycle_private.archive_destination_ready() THEN
   RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-07-09-lifecycle-readiness.sql') ON CONFLICT DO NOTHING;
COMMIT;
