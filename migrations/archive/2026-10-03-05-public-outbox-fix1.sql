-- Task10 Fix1. Additive archive contract; physical admission/enforcement unchanged.
ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS observed_at timestamptz;
ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS observed_at timestamptz;
ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS observed_at timestamptz;
ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'database_change';
CREATE TABLE IF NOT EXISTS public_archive_destination (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 object_prefix text NOT NULL CHECK(length(object_prefix) BETWEEN 1 AND 256 AND object_prefix ~ '^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$'),
 validated_at timestamptz NOT NULL
);
-- No destination row is created. Provisioning/validation belongs to the later rollout.
ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS object_prefix text;
ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS event_ids_sha256 text;
ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS aggregate_revision_ranges jsonb;
ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1);
ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS ingestion_date date;
CREATE TABLE IF NOT EXISTS public_archive_batch_markers (
 batch_id uuid PRIMARY KEY, owner_token text NOT NULL, generation bigint NOT NULL,
 event_ids_sha256 text NOT NULL, manifest_hash text NOT NULL, acked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public_archive_batch_markers(batch_id,owner_token,generation,event_ids_sha256,manifest_hash,acked_at)
 SELECT batch_id,owner_token,generation,COALESCE(event_ids_sha256,'legacy-exact-coverage'),manifest_hash,acked_at
 FROM public_archive_batches WHERE state='acked' ON CONFLICT DO NOTHING;
ALTER TABLE public_archive_coverage DROP CONSTRAINT IF EXISTS public_archive_coverage_batch_id_fkey;
ALTER TABLE public_archive_coverage ADD CONSTRAINT public_archive_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
ALTER TABLE public_archive_version_coverage DROP CONSTRAINT IF EXISTS public_archive_version_coverage_batch_id_fkey;
ALTER TABLE public_archive_version_coverage ADD CONSTRAINT public_archive_version_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
-- A prior batch remains identifiable by the compact durable marker after retirement.
ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_prior_batch_id_fkey;
CREATE OR REPLACE FUNCTION lifecycle_private.archive_row_charge(body jsonb, canonical bytea, overhead integer) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT 2::bigint*(COALESCE(octet_length(body::text),0)+COALESCE(octet_length(canonical),0))+overhead
$$;
CREATE OR REPLACE FUNCTION lifecycle_private.archive_live_bytes() RETURNS bigint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT
 COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_outbox),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(NULL,i.canonical_event,1024)) FROM public.public_archive_items i JOIN public.public_archive_batches b USING(batch_id) WHERE b.state<>'acked'),0)
 +COALESCE((SELECT sum(8192+CASE WHEN state='sealed' THEN 4096+2::bigint*manifest_bytes ELSE 0 END) FROM public.public_archive_batches WHERE state<>'acked'),0)
$$;
REVOKE ALL ON FUNCTION lifecycle_private.archive_row_charge(jsonb,bytea,integer),lifecycle_private.archive_live_bytes() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer; raw jsonb; oldraw jsonb; observed timestamptz; provenance_value text;
BEGIN
 SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
 IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
 n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
 o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
 IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
 -- Safe local version retirement does not assert disappearance of public facts.
 IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
 IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
 aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
 SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
 IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
 IF sid IS NOT NULL THEN
  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
 ELSE
 INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
 ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
 END IF;
 k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
  ELSE 'upsert' END;
 raw:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 oldraw:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 observed:=NULLIF(raw->>'observed_at','')::timestamptz;
 IF TG_TABLE_NAME='jobs' THEN
  IF k='closed' THEN observed:=(raw->>'closed_at')::timestamptz;
  ELSIF raw->>'last_seen_at' IS DISTINCT FROM oldraw->>'last_seen_at' THEN
   observed:=(raw->>'last_seen_at')::timestamptz;
  ELSIF k='reopened' THEN observed:=(SELECT successful_last_observed_at FROM public.source_listings WHERE job_id=aid ORDER BY successful_last_observed_at DESC NULLS LAST LIMIT 1);
  END IF;
 ELSIF TG_TABLE_NAME='source_listings' THEN
  IF raw->>'successful_last_observed_at' IS DISTINCT FROM oldraw->>'successful_last_observed_at' THEN
   observed:=(raw->>'successful_last_observed_at')::timestamptz;
  ELSIF raw->>'content_changed_at' IS DISTINCT FROM oldraw->>'content_changed_at' THEN
   observed:=(raw->>'content_changed_at')::timestamptz;
  ELSIF k='closed' AND sid IS NOT NULL THEN
   observed:=(SELECT completed_at FROM public.lifecycle_operational_sources WHERE source_id=sid);
  ELSIF k='closed' THEN observed:=(SELECT completed_at FROM public.source_enumerations WHERE id=(raw->>'last_miss_enumeration_id')::uuid);
  END IF;
 END IF;
 provenance_value:=CASE WHEN observed IS NOT NULL THEN 'source_observation' WHEN k='baseline' THEN 'current_baseline' ELSE 'database_change' END;
 IF sid IS NOT NULL THEN
  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp(),observed_at=observed,provenance=provenance_value
   WHERE slot=slot_id;
  RETURN NULL;
 END IF;
 INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body,observed_at,provenance)
 VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o),observed,provenance_value);
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at AND e.observed_at IS NOT DISTINCT FROM NEW.observed_at AND e.recorded_at=NEW.recorded_at AND e.provenance=NEW.provenance) THEN
  RAISE EXCEPTION 'public change requires exact transactional outbox event';
 END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
BEGIN
 SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
 IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at,r.observed_at,r.recorded_at,r.provenance)
 IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at,NEW.observed_at,NEW.recorded_at,NEW.provenance) THEN
  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
 IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
 IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
 envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
 IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
 OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
 OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
 OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
 SELECT count(*),lifecycle_private.archive_live_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
 critical:=NEW.kind IN ('closed','reopened');
 IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
 OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
 IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
 IF OLD.state='free' AND NEW.state='allocated' THEN
  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
 ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
 ELSIF OLD.state='pending' AND NEW.state='acked' THEN
  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
 ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batch_markers b USING(batch_id) WHERE c.event_id=OLD.event_id
    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
 ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
 IF NEW.state='pending' THEN
  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
    OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
  SELECT count(*),lifecycle_private.archive_live_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'immutable pending membership';
 END IF;
 IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
 END IF;
 RAISE EXCEPTION 'immutable pending event or archive history';
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public_archive_destination','public_archive_batch_markers'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS archive_immutable ON public_archive_batch_markers;
CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_batch_markers FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_batch_markers;
CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
