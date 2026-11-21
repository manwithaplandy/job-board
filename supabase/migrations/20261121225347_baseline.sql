


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "lifecycle_private";


ALTER SCHEMA "lifecycle_private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_baseline_ready"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE t text; key text; missing boolean;
BEGIN
 FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations',
  'brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
  key:=CASE WHEN t='locations' THEN 'raw' ELSE 'id' END;
  EXECUTE format('SELECT EXISTS(SELECT FROM public.%I t WHERE NOT EXISTS(SELECT FROM public.public_archive_heads h WHERE h.aggregate_type=$1 AND h.aggregate_id=t.%I::text))',t,key) INTO missing USING t;
  IF missing THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $_$;


ALTER FUNCTION "lifecycle_private"."archive_baseline_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_budget_bytes"() RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT
 COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
   +lifecycle_private.archive_processing_charge(canonical_event)) FROM public.public_outbox),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
   +CASE WHEN state='pending' THEN lifecycle_private.archive_processing_charge(canonical_event) ELSE 0 END)
   FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
$$;


ALTER FUNCTION "lifecycle_private"."archive_budget_bytes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_clock"() RETURNS timestamp with time zone
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog'
    AS $$ SELECT clock_timestamp() $$;


ALTER FUNCTION "lifecycle_private"."archive_clock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_destination_ready"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $_$
 SELECT EXISTS(SELECT FROM public.public_archive_destination
  WHERE singleton AND validated_at<=clock_timestamp() AND private_validated AND encryption_validated
  AND policy_validated AND length(btrim(validation_evidence))>0
  AND bucket ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' AND bucket NOT LIKE '%..%' AND bucket !~ '^[0-9.]+$'
  AND region ~ '^[a-z]{2}(-[a-z]+)+-[0-9]$' AND expected_owner ~ '^[0-9]{12}$'
  AND length(object_prefix)<=256 AND object_prefix ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$')
$_$;


ALTER FUNCTION "lifecycle_private"."archive_destination_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_live_bytes"() RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT
 COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_outbox),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(NULL,i.canonical_event,1024)) FROM public.public_archive_items i JOIN public.public_archive_batches b USING(batch_id) WHERE b.state<>'acked'),0)
 +COALESCE((SELECT sum(8192+CASE WHEN state='sealed' THEN 4096+2::bigint*manifest_bytes ELSE 0 END) FROM public.public_archive_batches WHERE state<>'acked'),0)
$$;


ALTER FUNCTION "lifecycle_private"."archive_live_bytes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_processing_charge"("canonical" "bytea") RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT 6::bigint*COALESCE(octet_length(canonical),0)+128000
$$;


ALTER FUNCTION "lifecycle_private"."archive_processing_charge"("canonical" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."archive_row_charge"("body" "jsonb", "canonical" "bytea", "overhead" integer) RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT 2::bigint*(COALESCE(octet_length(body::text),0)+COALESCE(octet_length(canonical),0))+overhead
$$;


ALTER FUNCTION "lifecycle_private"."archive_row_charge"("body" "jsonb", "canonical" "bytea", "overhead" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."consume_archive_authorization"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'archive authorization cannot be deleted or truncated'; END IF;
 IF OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL OR NEW.replacement_batch_id IS NULL
 OR (to_jsonb(NEW)-ARRAY['consumed_at','replacement_batch_id']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['consumed_at','replacement_batch_id'])
 OR OLD.approved_at>clock_timestamp() OR OLD.expires_at<=clock_timestamp()
 OR NOT EXISTS(SELECT FROM public.public_archive_batches b WHERE b.batch_id=NEW.replacement_batch_id
  AND b.prior_batch_id=OLD.batch_id AND b.state='claimed') THEN
  RAISE EXCEPTION 'invalid archive authorization consumption'; END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "lifecycle_private"."consume_archive_authorization"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."edge_compaction_ready"("t" "text", "edge_id" "uuid", "version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $_$
 SELECT t IN ('job_locations','job_skills')
 AND EXISTS(SELECT FROM public.public_archive_heads h JOIN public.public_archive_coverage c
  ON c.aggregate_type=h.aggregate_type AND c.aggregate_id=h.aggregate_id AND c.revision=h.revision
  JOIN public.public_archive_batch_markers m ON m.batch_id=c.batch_id
  WHERE h.aggregate_type=t AND h.aggregate_id=edge_id::text)
 AND NOT EXISTS(SELECT FROM public.public_pending_events WHERE aggregate_type=t AND aggregate_id=edge_id::text)
 AND EXISTS(SELECT FROM public.job_versions v JOIN public.public_archive_version_coverage c
  ON c.version_id=v.id AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash
  WHERE v.id=$3)
$_$;


ALTER FUNCTION "lifecycle_private"."edge_compaction_ready"("t" "text", "edge_id" "uuid", "version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."operational_receipt_valid"("sid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
 ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
 WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
 AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
 AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
 AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
$$;


ALTER FUNCTION "lifecycle_private"."operational_receipt_valid"("sid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."operational_update"("t" "text", "n" "jsonb", "o" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE sid uuid; fields text[];
BEGIN
 IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak','followup_due_at','last_followup_at','followup_status'];
 ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
 ELSIF t='jobs' THEN
  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
  fields:=ARRAY['closed_at'];
 ELSE RETURN false;
 END IF;
 IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
 IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
 IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
 IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
 UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
 RETURN true;
END $$;


ALTER FUNCTION "lifecycle_private"."operational_update"("t" "text", "n" "jsonb", "o" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."preserve_archive_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='public_archive_batches' THEN
  IF TG_OP='DELETE' AND OLD.state='superseded' AND EXISTS(
   SELECT FROM public.public_archive_supersessions s WHERE s.old_batch_id=OLD.batch_id
   AND s.replaced_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
 END IF;
 IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'batch_id')=(to_jsonb(OLD)-'batch_id') AND EXISTS(
   SELECT FROM public.public_archive_supersessions s
   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
   JOIN public.public_archive_batches b ON b.batch_id=s.new_batch_id
   WHERE s.old_batch_id=OLD.batch_id AND s.new_batch_id=NEW.batch_id
    AND a.replacement_batch_id=s.new_batch_id AND a.consumed_at IS NOT NULL
    AND b.state='claimed' AND b.prior_batch_id=OLD.batch_id
    AND EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.event_id
      AND e.canonical_event=NEW.canonical_event)) THEN RETURN NEW; END IF;
  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'immutable pending membership';
 END IF;
 IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
  IF OLD.state IN ('acked','superseded') AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'terminal archive state immutable'; END IF;
  IF NEW.state='superseded' AND OLD.state<>'superseded' AND NOT EXISTS(
   SELECT FROM public.public_archive_supersessions s
   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
   WHERE s.old_batch_id=OLD.batch_id AND a.replacement_batch_id=s.new_batch_id
    AND a.consumed_at IS NOT NULL AND OLD.eligible_until<=lifecycle_private.archive_clock()) THEN
   RAISE EXCEPTION 'explicit consumed archive replacement authorization required'; END IF;
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


ALTER FUNCTION "lifecycle_private"."preserve_archive_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."preserve_operational_slot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
  SELECT count(*),lifecycle_private.archive_budget_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "lifecycle_private"."preserve_operational_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."protect_demand_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF current_setting('role')='authenticated' AND OLD.user_id IS DISTINCT FROM public.app_user_id() THEN RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
 -- Deleting an owner queue row cannot silently cancel/release a live service
 -- claim. The service must fence the claim first (account erasure does so).
 IF EXISTS(SELECT FROM public.lifecycle_claims WHERE kind='demand' AND work_id=OLD.id::text
 AND state='active' AND generation>replay_floor) THEN
  RAISE EXCEPTION 'demand removal requires fenced service claim'; END IF;
 RETURN OLD;
END $$;


ALTER FUNCTION "lifecycle_private"."protect_demand_claim"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."public_projection"("t" "text", "n" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE fields text[]; result jsonb;
BEGIN
 CASE t
 WHEN 'jobs' THEN fields:=ARRAY['id','company_id','external_id','title','url','location','department','remote','closed_at'];
 WHEN 'source_accounts' THEN fields:=ARRAY['id','legacy_company_id','ats','public_board_ref','public_url','exclusion_state'];
 WHEN 'source_listings' THEN fields:=ARRAY['id','source_account_id','external_id','job_id','current_version_id','current_revision','original_discovered_at','source_published_at','source_published_provenance','discovery_anchor_at','discovery_anchor_provenance','discovery_expires_at','source_availability','suspected_id_reuse'];
 WHEN 'job_versions' THEN fields:=ARRAY['id','job_id','source_listing_id','revision','content_hash','public_metadata','observed_at'];
 WHEN 'companies' THEN fields:=ARRAY['id','name','ats','token','display_name','industry','industry_subcategory','size','hq_country'];
 WHEN 'locations' THEN fields:=ARRAY['raw','canonicals','components','source'];
 WHEN 'brands' THEN fields:=ARRAY['id','name'];
 WHEN 'skills' THEN fields:=ARRAY['id','canonical_name'];
 WHEN 'company_brands' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','brand_id'];
 WHEN 'company_sources' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','source_account_id'];
 WHEN 'job_locations' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','location_id'];
 WHEN 'job_skills' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','skill_id'];
 WHEN 'identity_assertions' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','left_listing_id','right_listing_id','relation','reviewed_at'];
 ELSE RETURN NULL;
 END CASE;
 SELECT jsonb_object_agg(key,value) INTO result FROM jsonb_each(n) WHERE key=ANY(fields);
 RETURN result;
END $$;


ALTER FUNCTION "lifecycle_private"."public_projection"("t" "text", "n" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."release_ready"("generation" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "lifecycle_private"."release_ready"("generation" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."require_public_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
 -- Exact acknowledged local edge compaction retains the public history/head.
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('job_locations','job_skills') AND
  lifecycle_private.edge_compaction_ready(TG_TABLE_NAME,(o->>'id')::uuid,(o->>'job_version_id')::uuid)
  AND NOT EXISTS(SELECT FROM public.source_listings WHERE current_version_id=(o->>'job_version_id')::uuid)
 THEN RETURN NULL; END IF;
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


ALTER FUNCTION "lifecycle_private"."require_public_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_archive_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE b public.public_archive_batches;
BEGIN
 SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
 IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "lifecycle_private"."validate_archive_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_operational_receipt"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $_$
BEGIN
 IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
 IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
 IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
 RETURN NULL;
END $_$;


ALTER FUNCTION "lifecycle_private"."validate_operational_receipt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_operational_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE sid uuid;
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'preallocated operational identity cannot be deleted or truncated'; END IF;
 sid:=NEW.source_id;
 IF sid<>OLD.source_id OR NOT lifecycle_private.operational_receipt_valid(sid) THEN
  RAISE EXCEPTION 'operational update requires same-source current receipt'; END IF;
 IF TG_TABLE_NAME='lifecycle_operational_listings' AND to_jsonb(NEW)->>'listing_id' IS DISTINCT FROM to_jsonb(OLD)->>'listing_id' THEN
  RAISE EXCEPTION 'operational listing identity immutable'; END IF;
 UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
 RETURN NEW;
END $$;


ALTER FUNCTION "lifecycle_private"."validate_operational_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_outbox_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
 SELECT count(*),lifecycle_private.archive_budget_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
 critical:=NEW.kind IN ('closed','reopened');
 IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
 OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "lifecycle_private"."validate_outbox_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_public_pair"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at AND e.observed_at IS NOT DISTINCT FROM NEW.observed_at AND e.recorded_at=NEW.recorded_at AND e.provenance=NEW.provenance) THEN
  RAISE EXCEPTION 'public change requires exact transactional outbox event';
 END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "lifecycle_private"."validate_public_pair"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "lifecycle_private"."validate_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE c public.lifecycle_claims; r public.capacity_reservations; actor name;
BEGIN
 -- PostgreSQL lets any caller consume a deferred constraint early. Only the
 -- actual top-level, standalone transaction boundary may run this AFTER check.
 -- current_query() is server-provided, not a GUC. Fail closed for comments,
 -- multi-statements, SET CONSTRAINTS, implicit/autocommit and PREPARE TRANSACTION.
 -- Supported writers explicitly finish with COMMIT/END [WORK|TRANSACTION].
 IF TG_WHEN='AFTER' AND COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
  RAISE EXCEPTION 'lifecycle receipts require standalone COMMIT or END validation';
 END IF;
 -- role is PostgreSQL's actual SET ROLE state, not a caller-supplied identity GUC.
 actor:=CASE WHEN current_setting('role')='none' THEN session_user ELSE current_setting('role') END;
 IF TG_WHEN='BEFORE' AND (NEW.invoking_role<>actor OR NEW.subject_id IS DISTINCT FROM public.app_user_id()
 OR NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id()) THEN
  RAISE EXCEPTION 'invalid lifecycle invoking identity';
 END IF;
 IF NEW.bytes>0 AND pg_database_size(current_database())+(SELECT COALESCE(sum(bytes),0) FROM public.capacity_reservations WHERE state='held')>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
 IF NEW.total_rows>500 THEN RAISE EXCEPTION 'lifecycle admission chunk exceeds 500 rows'; END IF;
 IF NEW.bytes>0 AND NEW.reservation_id IS NULL THEN RAISE EXCEPTION 'growth_without_reservation'; END IF;
 IF NEW.reservation_id IS NOT NULL THEN
  SELECT * INTO r FROM public.capacity_reservations WHERE id=NEW.reservation_id;
  IF NOT FOUND OR r.state NOT IN ('held','settled') OR r.backend_pid<>NEW.backend_pid OR r.transaction_id<>NEW.transaction_id
   OR r.invoking_role<>NEW.invoking_role OR r.subject_id IS DISTINCT FROM NEW.subject_id
   OR r.job_id IS DISTINCT FROM NEW.job_id OR r.scope IS DISTINCT FROM NEW.scope OR r.bytes<NEW.total_bytes
   OR r.backend_pid IS NULL THEN RAISE EXCEPTION 'invalid capacity reservation owner, scope or budget'; END IF;
  SELECT * INTO c FROM public.lifecycle_claims WHERE kind=r.claim_kind AND work_id=r.claim_id;
  IF NOT FOUND OR c.owner_token<>r.owner_token OR c.generation<>r.generation THEN
   RAISE EXCEPTION 'stale or fenced capacity claim'; END IF;
 ELSIF NEW.owner_token IS NOT NULL THEN
  SELECT * INTO c FROM public.lifecycle_claims WHERE owner_token=NEW.owner_token AND generation=NEW.generation;
  IF NOT FOUND OR c.invoking_role<>NEW.invoking_role OR c.subject_id IS DISTINCT FROM NEW.subject_id THEN
   RAISE EXCEPTION 'stale or foreign lifecycle claim'; END IF;
 ELSE RETURN NEW;
 END IF;
 IF c.state<>'active' OR c.generation<=c.replay_floor OR c.lease_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'stale, expired or fenced lifecycle claim'; END IF;
 RETURN NEW;
END $_$;


ALTER FUNCTION "lifecycle_private"."validate_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  claims text;
  sub    text;
BEGIN
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;
  sub := (claims::json ->> 'sub');
  IF sub IS NULL OR sub = '' THEN
    RETURN NULL;
  END IF;
  RETURN sub::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."app_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_check_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF NOT has_table_privilege(current_user,'public.lifecycle_claims','INSERT') THEN
  IF pg_trigger_depth()<>2 THEN RAISE EXCEPTION 'lifecycle receipts require a row trigger'; END IF;
  NEW.row_count:=1;
 END IF;
 IF NEW.backend_pid<>pg_backend_pid() OR NEW.transaction_id<>pg_current_xact_id() OR
 NEW.invoking_role<>current_user OR NEW.subject_id IS DISTINCT FROM public.app_user_id() THEN
  RAISE EXCEPTION 'invalid lifecycle invoking identity';
 END IF;
 SELECT COALESCE(sum(c.bytes) FILTER(WHERE c.reservation_id=NEW.reservation_id),0)+NEW.bytes,
 COALESCE(sum(c.row_count),0)+NEW.row_count INTO NEW.total_bytes,NEW.total_rows
 FROM public.lifecycle_write_checks c WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id();
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_check_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_claim_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'compact claim replay fence must survive cleanup'; END IF;
 IF NEW.kind<>OLD.kind OR NEW.work_id<>OLD.work_id OR NEW.generation<OLD.generation OR NEW.replay_floor<OLD.replay_floor THEN
  RAISE EXCEPTION 'claim identity and replay floor are monotonic'; END IF;
 IF NEW.generation=OLD.generation AND OLD.reservation_subject_bound AND
 (NOT NEW.reservation_subject_bound OR NEW.reservation_subject_id IS DISTINCT FROM OLD.reservation_subject_id) THEN
  RAISE EXCEPTION 'capacity subject requires a fenced generation'; END IF;
 IF (NEW.owner_token<>OLD.owner_token OR NEW.state<>OLD.state OR NEW.invoking_role<>OLD.invoking_role OR NEW.subject_id IS DISTINCT FROM OLD.subject_id) AND
 (NEW.generation<=OLD.generation OR NEW.replay_floor<OLD.generation) THEN
  RAISE EXCEPTION 'claim replacement requires a fenced generation'; END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_claim_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_forget_subject"("target" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE jid text;
BEGIN
 PERFORM pg_advisory_xact_lock(20916294442894917);
 -- Service erasure prelocks the entire owner Job set before claim/child rows.
 FOR jid IN SELECT job_id FROM (
  SELECT job_id FROM public.job_reviews WHERE user_id=target
  UNION SELECT job_id FROM public.review_corrections WHERE user_id=target
  UNION SELECT job_id FROM public.application_packages WHERE user_id=target
  UNION SELECT job_id FROM public.resume_scores WHERE user_id=target
  UNION SELECT job_id FROM public.cover_letter_edits WHERE user_id=target
  UNION SELECT job_id FROM public.generation_jobs WHERE user_id=target
  UNION SELECT job_id FROM public.job_payload_demands WHERE user_id=target
  UNION SELECT job_id FROM public.capacity_reservations WHERE subject_id=target
 ) owned WHERE job_id IS NOT NULL ORDER BY job_id COLLATE "C" LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0));
 END LOOP;
 UPDATE public.lifecycle_claims c SET replay_floor=generation,generation=generation+1,
 state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL,reservation_subject_id=NULL,reservation_subject_bound=false
 WHERE c.subject_id=target OR c.reservation_subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
  WHERE r.subject_id=target AND r.state='held' AND r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation);
 UPDATE public.capacity_reservations r SET state='fenced',terminal_at=clock_timestamp()
 FROM public.lifecycle_claims c WHERE c.kind=r.claim_kind AND c.work_id=r.claim_id
  AND r.state='held' AND r.generation<c.generation;
 UPDATE public.capacity_reservations SET subject_id=NULL WHERE subject_id=target AND state<>'held';
 DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;
END $$;


ALTER FUNCTION "public"."lifecycle_forget_subject"("target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_gate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'lifecycle writes require read committed'; END IF;
 PERFORM set_config('lock_timeout','2s',true);
 PERFORM set_config('statement_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(20916294442894917);
 IF TG_OP='TRUNCATE' AND (TG_TABLE_NAME IN ('lifecycle_claims','capacity_reservations','lifecycle_write_checks') OR EXISTS(SELECT FROM public.lifecycle_control WHERE safety_stage='enforced' OR archive_ever_activated)) THEN RAISE EXCEPTION 'lifecycle history cannot be truncated'; END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "public"."lifecycle_gate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_identity_check_authorization"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF NEW.turns IS NOT DISTINCT FROM OLD.turns
    AND NEW.mapped_jobs IS NOT DISTINCT FROM OLD.mapped_jobs
    AND NEW.mapped_accounts IS NOT DISTINCT FROM OLD.mapped_accounts
    AND NEW.state<>'completed' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT FROM public.lifecycle_identity_authorizations a
   WHERE a.campaign_id=NEW.id AND a.source_revision=NEW.source_revision
     AND a.activation_generation=NEW.activation_generation
     AND a.project_ref='fdhspmavadgucktetzoi' AND a.source='supabase_metrics'
     AND a.authorized_at<=clock_timestamp() AND a.valid_until>clock_timestamp()
     AND a.observed_at<=clock_timestamp() AND a.observed_at>clock_timestamp()-interval '90 seconds'
     AND a.free_bytes>greatest(1073741824::bigint,a.capacity_bytes/5)
     AND a.resident_wal_bytes<4294967296::bigint) THEN
   RAISE EXCEPTION 'identity campaign authorization/capacity expired before commit' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "public"."lifecycle_identity_check_authorization"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_identity_mutated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 -- Same global lock order as existing statement gates, before any row/FK locks.
 PERFORM pg_advisory_xact_lock(20916294442894917);
 UPDATE public.lifecycle_identity_generation SET generation=generation+1 WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'identity mutation generation missing'; END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "public"."lifecycle_identity_mutated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean DEFAULT false) RETURNS TABLE("job_id" "text", "discovery_visible" boolean, "source_closed" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER ROWS 1e+06
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean DEFAULT false) RETURNS TABLE("job_id" "text", "discovery_visible" boolean, "source_closed" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER ROWS 1e+06
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_maintenance_cutover"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF TG_TABLE_NAME='lifecycle_control' THEN
  IF NEW.maintenance_enabled THEN
   UPDATE public.lifecycle_maintenance_state SET cutover_at=COALESCE(cutover_at,clock_timestamp()) WHERE singleton;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='lifecycle_maintenance_state' THEN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'maintenance cutover history must survive'; END IF;
  IF OLD.cutover_at IS NOT NULL AND NEW.cutover_at IS DISTINCT FROM OLD.cutover_at THEN
   RAISE EXCEPTION 'maintenance cutover is permanent'; END IF;
  RETURN NEW;
 END IF;
 IF EXISTS(SELECT FROM public.lifecycle_maintenance_state WHERE cutover_at IS NOT NULL) THEN
  RAISE EXCEPTION 'legacy destructive prune disabled after maintenance cutover';
 END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "public"."lifecycle_maintenance_cutover"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_reservation_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE c public.lifecycle_claims; allocated numeric;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.state='held' THEN RAISE EXCEPTION 'held reservation requires fencing before cleanup'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND (OLD.id<>NEW.id OR OLD.owner_token<>NEW.owner_token OR OLD.generation<>NEW.generation
  OR OLD.claim_kind<>NEW.claim_kind OR OLD.claim_id<>NEW.claim_id) THEN
  RAISE EXCEPTION 'reservation claim identity is immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'held' AND (to_jsonb(NEW)-'subject_id') IS DISTINCT FROM (to_jsonb(OLD)-'subject_id') THEN
  RAISE EXCEPTION 'terminal reservation cannot resurrect or change'; END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'held' THEN
  IF NEW.subject_id IS NOT NULL AND NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN RAISE EXCEPTION 'terminal reservation owner cannot change'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO STRICT c FROM public.lifecycle_claims WHERE kind=NEW.claim_kind AND work_id=NEW.claim_id;
 IF NEW.state='fenced' THEN
  IF c.generation<=NEW.generation OR c.replay_floor<NEW.generation THEN
   RAISE EXCEPTION 'reservation release requires fenced generation'; END IF;
 ELSIF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN
  IF c.owner_token<>NEW.owner_token OR c.generation<>NEW.generation OR c.state<>'active'
   OR c.generation<=c.replay_floor OR c.lease_until<=clock_timestamp() THEN
   RAISE EXCEPTION 'stale, expired or fenced capacity claim'; END IF;
  IF NEW.state='settled' AND (NEW.backend_pid IS DISTINCT FROM pg_backend_pid() OR NEW.transaction_id IS DISTINCT FROM pg_current_xact_id()) THEN
   RAISE EXCEPTION 'settlement requires current backend transaction'; END IF;
 END IF;
 IF NEW.state='held' AND NEW.backend_pid IS NOT NULL THEN
  IF c.reservation_subject_bound AND c.reservation_subject_id IS DISTINCT FROM NEW.subject_id THEN
   RAISE EXCEPTION 'capacity claim already bound to another subject owner'; END IF;
  IF c.subject_id IS NOT NULL AND c.subject_id IS DISTINCT FROM NEW.subject_id THEN
   RAISE EXCEPTION 'capacity subject differs from claim owner'; END IF;
  IF NOT c.reservation_subject_bound THEN
   UPDATE public.lifecycle_claims SET reservation_subject_bound=true,reservation_subject_id=NEW.subject_id
    WHERE kind=c.kind AND work_id=c.work_id;
  END IF;
 END IF;
 IF NEW.state='held' THEN
  SELECT pg_database_size(current_database())+COALESCE(sum(bytes),0)+NEW.bytes INTO allocated
  FROM public.capacity_reservations WHERE state='held' AND id<>NEW.id;
  IF allocated>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_reservation_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT CASE
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
      THEN p_legacy_closed_at IS NOT NULL
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
    ELSE false END
  FROM public.lifecycle_control ctl WHERE ctl.singleton
$$;


ALTER FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_staging_fence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE e public.source_enumerations; c public.lifecycle_claims; floor bigint;
BEGIN
 IF TG_TABLE_NAME='source_accounts' THEN
  IF NEW.replay_floor<OLD.replay_floor OR NEW.enumeration_sequence<OLD.enumeration_sequence OR NEW.claim_generation<OLD.claim_generation THEN
   RAISE EXCEPTION 'source generation and replay floor are monotonic'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='source_enumerations' THEN e:=NEW;
 ELSE SELECT * INTO STRICT e FROM public.source_enumerations WHERE id=NEW.enumeration_id;
 END IF;
 SELECT replay_floor INTO STRICT floor FROM public.source_accounts WHERE id=e.source_id;
 IF e.sequence<=floor THEN RAISE EXCEPTION 'enumeration sequence rejected by replay floor'; END IF;
 SELECT * INTO c FROM public.lifecycle_claims WHERE kind='source' AND work_id=e.source_id::text
 AND owner_token=e.owner_token AND generation=e.generation AND generation>replay_floor
 AND state='active' AND lease_until>clock_timestamp() AND invoking_role=current_user
 AND subject_id IS NOT DISTINCT FROM public.app_user_id();
 IF NOT FOUND THEN RAISE EXCEPTION 'stale, foreign or fenced enumeration claim'; END IF;
 IF TG_TABLE_NAME='enumeration_members' AND e.status<>'running' THEN
  RAISE EXCEPTION 'completed or terminal membership cannot change';
 END IF;
 IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
 END IF;
 IF TG_TABLE_NAME='source_enumerations' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.id<>OLD.id OR NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence THEN
    RAISE EXCEPTION 'enumeration identity is immutable';
   END IF;
   IF OLD.status='complete' AND NEW.status<>'complete' THEN
    RAISE EXCEPTION 'completed enumeration status is immutable';
   END IF;
   IF NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation THEN
    -- The current same-source claim was validated above. A takeover fences its
    -- old generation first; only ownership may change on an unfinished complete
    -- snapshot. Completion/evidence identity and cursor are never reconstructed.
    IF OLD.status<>'complete' OR OLD.reconciled_at IS NOT NULL
       OR NEW.generation<=OLD.generation OR c.replay_floor<OLD.generation
       OR (to_jsonb(NEW)-'owner_token'-'generation') IS DISTINCT FROM
          (to_jsonb(OLD)-'owner_token'-'generation') THEN
     RAISE EXCEPTION 'only completed pending reconciliation permits ownership handoff';
    END IF;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
 VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_staging_fence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_stamp_consumption"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
  IF OLD.status<>'ready' OR OLD.job_version_id IS NULL OR NULLIF(btrim(OLD.description_snapshot),'') IS NULL THEN
   RAISE EXCEPTION 'consumption requires durable ready snapshot';
  END IF;
  NEW.consumed_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_stamp_consumption"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lifecycle_validate_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
 payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
 rid uuid; json_keys text[];
BEGIN
 SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
 n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
 IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
 -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
 IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
 END IF;
 IF ctl.safety_stage<>'enforced' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
 END IF;
 IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 owner_id:=(n->>'user_id')::uuid;
 IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
 protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
 OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
 OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
 OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
 -- Existing legacy artifacts can change status without fabricated input provenance.
 -- All input, artifact, owner and identity columns must remain exactly unchanged.
 IF TG_TABLE_NAME='application_packages' AND TG_OP='UPDATE'
  AND n-ARRAY['status','applied_at','updated_at'] IS NOT DISTINCT FROM o-ARRAY['status','applied_at','updated_at']
 THEN protection:=false; END IF;
 IF protection THEN
  vid:=n->>'job_version_id';
  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
 END IF;
 IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
 AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
 AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
 END IF;
 IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
 END IF;
 -- Payload fields are charged on every rewrite, including same-size replacements;
 -- a prior DELETE or shrink never supplies physical allocation credit.
 IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
   oldpayload:=o->>k;
   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
       OR jsonb_typeof(n->k)='string' AND
       (octet_length(payload)>256 OR (k NOT IN (
        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
        'experience_match','confidence','work_arrangement','pay_period','status','kind',
        'description_capture_provenance','capture_provenance','description_version_id',
        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
   THEN growth:=growth+octet_length(payload)*4+256; END IF;
  END LOOP;
  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
 ELSE
  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
 END IF;
 IF growth>0 THEN
  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
 END IF;
 INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
 VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."lifecycle_validate_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."matching_paused"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
 SELECT NOT EXISTS (
   SELECT 1 FROM subscriptions s WHERE s.user_id=uid AND s.plan IN ('standard','pro')
     AND s.status='active' AND nullif(s.stripe_subscription_id,'') IS NOT NULL
     AND s.current_period_end + interval '3 days' > clock_timestamp()
 ) AND EXISTS (
   SELECT 1 FROM matching_activity a WHERE a.user_id=uid
     AND (a.paused_at IS NOT NULL OR a.last_meaningful_at <= clock_timestamp()-interval '7 days')
 )
$$;


ALTER FUNCTION "public"."matching_paused"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preserve_lifecycle_control"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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
 IF OLD.archive_ever_activated AND NEW.archive_stage='active' AND OLD.archive_stage<>'active' THEN
  IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
    OR NOT lifecycle_private.release_ready(OLD.activation_generation)
    OR NOT lifecycle_private.archive_destination_ready() THEN
   RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."preserve_lifecycle_control"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resume_matching"() RETURNS TABLE("status" "text", "existing" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE uid uuid := public.app_user_id(); was_paused boolean; req review_requests%ROWTYPE;
BEGIN
 PERFORM set_config('lock_timeout','2s',true);
 PERFORM set_config('statement_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(20916294442894917);
 IF uid IS NULL OR EXISTS(SELECT 1 FROM account_deletions WHERE user_id=uid) THEN
   RAISE EXCEPTION 'sign in' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM matching_activity WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile required' USING ERRCODE='42501'; END IF;
 -- Inspect stored pause/expiry, not the paid exemption: billing may have
 -- activated after the running worker already skipped this paused account.
 SELECT paused_at IS NOT NULL OR last_meaningful_at <= clock_timestamp()-interval '7 days'
 INTO was_paused FROM matching_activity WHERE user_id=uid;
 UPDATE matching_activity SET last_meaningful_at=clock_timestamp(),paused_at=NULL WHERE user_id=uid;
 INSERT INTO review_requests(user_id) VALUES(uid)
 ON CONFLICT (user_id) WHERE review_requests.status IN ('pending','running') DO NOTHING
 RETURNING * INTO req;
 IF FOUND THEN RETURN QUERY SELECT req.status,false; RETURN; END IF;
 -- The worker might finish between conflict detection and this row lock. Retry
 -- insertion if so; never return a synthetic pending success without durable work.
 SELECT * INTO req FROM review_requests WHERE user_id=uid AND review_requests.status IN ('pending','running') FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO review_requests(user_id) VALUES(uid) RETURNING * INTO req;
   RETURN QUERY SELECT req.status,false; RETURN;
 END IF;
 IF was_paused AND req.status='running' THEN
   UPDATE review_requests SET resume_requested=true WHERE id=req.id;
 END IF;
 RETURN QUERY SELECT req.status,true;
END
$$;


ALTER FUNCTION "public"."resume_matching"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_feedback"("p_kind" "text", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE caller uuid := public.app_user_id();
BEGIN
 PERFORM set_config('lock_timeout','2s',true);
 PERFORM set_config('statement_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(20916294442894917);
  IF caller IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  -- A fresh post-lock snapshot prevents stale-snapshot rate bypasses.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'read committed required' USING ERRCODE = '25000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('issue','criticism','feature_request')
     OR p_message IS NULL OR char_length(p_message) > 4000
     OR p_message !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('feedback:' || caller::text, 0));
  IF EXISTS (SELECT 1 FROM public.account_deletions WHERE user_id = caller) THEN
    RAISE EXCEPTION 'account deleted' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.feedback WHERE user_id = caller
      AND created_at > clock_timestamp() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'feedback rate limit' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.feedback(user_id, kind, message) VALUES (caller, p_kind, btrim(p_message));
END;
$$;


ALTER FUNCTION "public"."submit_feedback"("p_kind" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_matching_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE actor uuid := CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
BEGIN
 IF TG_TABLE_NAME='profiles' AND TG_OP='INSERT' THEN
   INSERT INTO matching_activity(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
 ELSIF current_setting('role',true)='authenticated' AND actor=public.app_user_id()
       AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE user_id=actor) THEN
   -- Preserve the expiry BEFORE advancing activity. Only explicit resume clears it.
   UPDATE matching_activity SET
     paused_at=CASE WHEN public.matching_paused(actor) THEN coalesce(paused_at,clock_timestamp()) ELSE paused_at END,
     last_meaningful_at=clock_timestamp() WHERE user_id=actor;
 END IF;
 RETURN NEW;
END
$$;


ALTER FUNCTION "public"."track_matching_activity"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletions" (
    "user_id" "uuid" NOT NULL,
    "email_hash" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_packages" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "resume_json" "jsonb",
    "cover_letter_json" "jsonb",
    "answers_snapshot" "jsonb",
    "greenhouse_questions" "jsonb",
    "prefilled_answers" "jsonb",
    "apply_url" "text",
    "status" "text" DEFAULT 'prepared'::"text" NOT NULL,
    "prepared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone,
    "resume_trace_id" "text",
    "profile_version" "text",
    "cover_letter_trace_id" "text",
    "resume_instructions" "text",
    "cover_letter_instructions" "text",
    "resume_instructions_draft" "text",
    "cover_letter_instructions_draft" "text",
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "application_packages_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"])))),
    CONSTRAINT "application_packages_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'applied'::"text"]))),
    CONSTRAINT "applied_iff_timestamp" CHECK ((("status" = 'applied'::"text") = ("applied_at" IS NOT NULL)))
);


ALTER TABLE "public"."application_packages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."application_packages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."application_packages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."application_packages_id_seq" OWNED BY "public"."application_packages"."id";



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capacity_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_kind" "text" NOT NULL,
    "claim_id" "text" NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "bytes" bigint NOT NULL,
    "critical" boolean DEFAULT false NOT NULL,
    "state" "text" DEFAULT 'held'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "terminal_at" timestamp with time zone,
    "backend_pid" integer,
    "transaction_id" "xid8",
    "invoking_role" "name",
    "subject_id" "uuid",
    "job_id" "text",
    "scope" "text",
    "measured_database_bytes" bigint,
    CONSTRAINT "capacity_reservations_bytes_check" CHECK (("bytes" >= 0)),
    CONSTRAINT "capacity_reservations_check" CHECK ((("backend_pid" IS NULL) = ("transaction_id" IS NULL))),
    CONSTRAINT "capacity_reservations_generation_check" CHECK (("generation" > 0)),
    CONSTRAINT "capacity_reservations_state_check" CHECK (("state" = ANY (ARRAY['held'::"text", 'settled'::"text", 'fenced'::"text"])))
);


ALTER TABLE "public"."capacity_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classification_jobs" (
    "id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "model" "text" NOT NULL,
    "company_cap" integer NOT NULL,
    "selection_mode" "text" NOT NULL,
    "use_serp" boolean DEFAULT false NOT NULL,
    "est_cost" numeric(10,4),
    "processed" integer DEFAULT 0 NOT NULL,
    "errored" integer DEFAULT 0 NOT NULL,
    "serp_queries" integer DEFAULT 0 NOT NULL,
    "actual_prompt_tokens" bigint DEFAULT 0 NOT NULL,
    "actual_completion_tokens" bigint DEFAULT 0 NOT NULL,
    "actual_cost" numeric(10,4),
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "last_progress_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    CONSTRAINT "classification_jobs_company_cap_check" CHECK (("company_cap" > 0)),
    CONSTRAINT "classification_jobs_selection_mode_check" CHECK (("selection_mode" = ANY (ARRAY['unclassified'::"text", 'unknown_repass'::"text", 'all'::"text"]))),
    CONSTRAINT "classification_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'canceled'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."classification_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."classification_jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."classification_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."classification_jobs_id_seq" OWNED BY "public"."classification_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "ats" "text" NOT NULL,
    "token" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "discovery_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "about" "text",
    "about_source" "text",
    "web_description" "text",
    "web_searched_at" timestamp with time zone,
    "enriched_at" timestamp with time zone,
    "industry" "text",
    "industry_subcategory" "text",
    "size" "text",
    "hq_country" "text",
    "tech_tags" "jsonb",
    "red_flags" "jsonb",
    "classification_confidence" "text",
    "classified_at" timestamp with time zone,
    "classification_model" "text",
    "classification_source" "text",
    "poll_failures" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "companies_about_source_check" CHECK (("about_source" = ANY (ARRAY['ats_board'::"text", 'jd_probe'::"text", 'serp'::"text"]))),
    CONSTRAINT "companies_ats_check" CHECK (("ats" = ANY (ARRAY['greenhouse'::"text", 'lever'::"text", 'ashby'::"text", 'workable'::"text", 'smartrecruiters'::"text", 'workday'::"text"]))),
    CONSTRAINT "companies_classification_confidence_check" CHECK (("classification_confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "companies_classification_source_check" CHECK (("classification_source" = ANY (ARRAY['seeded_from_user_review'::"text", 'job'::"text", 'job_serp'::"text"]))),
    CONSTRAINT "companies_discovery_source_check" CHECK (("discovery_source" = ANY (ARRAY['manual'::"text", 'seed'::"text", 'dataset'::"text", 'expansion'::"text"]))),
    CONSTRAINT "companies_size_check" CHECK (("size" = ANY (ARRAY['1-10'::"text", '11-50'::"text", '51-200'::"text", '201-1000'::"text", '1001-5000'::"text", '5000+'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."companies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."companies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."companies_id_seq" OWNED BY "public"."companies"."id";



CREATE TABLE IF NOT EXISTS "public"."company_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" integer NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "evidence_kind" "text" NOT NULL,
    "public_evidence_ref" "text" NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "confidence" numeric,
    "revision" bigint DEFAULT 1 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "company_brands_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "revision"))),
    CONSTRAINT "company_brands_check1" CHECK ((("valid_from" IS NULL) OR ("valid_to" IS NULL) OR ("valid_from" <= "valid_to"))),
    CONSTRAINT "company_brands_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "company_brands_evidence_kind_check" CHECK (("evidence_kind" = ANY (ARRAY['structured_source'::"text", 'reviewed_public'::"text", 'legacy_mapping'::"text"]))),
    CONSTRAINT "company_brands_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "company_brands_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'retracted'::"text"])))
);


ALTER TABLE "public"."company_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_overrides" (
    "user_id" "uuid" NOT NULL,
    "company_id" integer NOT NULL,
    "verdict" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_overrides_verdict_check" CHECK (("verdict" = ANY (ARRAY['include'::"text", 'exclude'::"text"])))
);


ALTER TABLE "public"."company_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_reviews" (
    "user_id" "uuid" NOT NULL,
    "company_id" integer NOT NULL,
    "company_profile_version" "text" NOT NULL,
    "verdict" "text",
    "confidence" "text",
    "reasoning" "text",
    "industry" "text",
    "industry_subcategory" "text",
    "tech_tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "red_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "human_override" boolean DEFAULT false NOT NULL,
    "override_verdict" "text",
    "model" "text",
    "error" "text",
    "reviewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_reviews_confidence_check" CHECK (("confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "company_reviews_override_verdict_check" CHECK (("override_verdict" = ANY (ARRAY['include'::"text", 'exclude'::"text"]))),
    CONSTRAINT "company_reviews_verdict_check" CHECK (("verdict" = ANY (ARRAY['include'::"text", 'exclude'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."company_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" integer NOT NULL,
    "source_account_id" "uuid" NOT NULL,
    "evidence_kind" "text" NOT NULL,
    "public_evidence_ref" "text" NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "confidence" numeric,
    "revision" bigint DEFAULT 1 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "company_sources_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "revision"))),
    CONSTRAINT "company_sources_check1" CHECK ((("valid_from" IS NULL) OR ("valid_to" IS NULL) OR ("valid_from" <= "valid_to"))),
    CONSTRAINT "company_sources_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "company_sources_evidence_kind_check" CHECK (("evidence_kind" = ANY (ARRAY['structured_source'::"text", 'reviewed_public'::"text", 'legacy_mapping'::"text"]))),
    CONSTRAINT "company_sources_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "company_sources_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'retracted'::"text"])))
);


ALTER TABLE "public"."company_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cover_letter_edits" (
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "edited_text" "text" NOT NULL,
    "original_text" "text",
    "cover_letter_trace_id" "text",
    "model" "text",
    "comment" "text",
    "superseded_at" timestamp with time zone,
    "edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "cover_letter_edits_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"]))))
);


ALTER TABLE "public"."cover_letter_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discovery_runs" (
    "id" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "ingested" integer,
    "reviewed" integer,
    "included" integer,
    "excluded" integer,
    "unknown" integer,
    "errors" integer,
    "backlog" integer,
    "notes" "text",
    CONSTRAINT "discovery_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'halted_no_credits'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."discovery_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."discovery_runs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."discovery_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."discovery_runs_id_seq" OWNED BY "public"."discovery_runs"."id";



CREATE TABLE IF NOT EXISTS "public"."discovery_state" (
    "id" boolean DEFAULT true NOT NULL,
    "halted_no_credits" boolean DEFAULT false NOT NULL,
    "resume_requested_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discovery_state_id_check" CHECK ("id")
);


ALTER TABLE "public"."discovery_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enumeration_members" (
    "enumeration_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "public_metadata" "jsonb" NOT NULL,
    CONSTRAINT "enumeration_members_public_metadata_check" CHECK (("jsonb_typeof"("public_metadata") = 'object'::"text"))
);


ALTER TABLE "public"."enumeration_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "feedback_kind_check" CHECK (("kind" = ANY (ARRAY['issue'::"text", 'criticism'::"text", 'feature_request'::"text"]))),
    CONSTRAINT "feedback_message_check" CHECK ((("char_length"("btrim"("message")) >= 1) AND ("char_length"("btrim"("message")) <= 4000)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


ALTER TABLE "public"."feedback" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "generation_jobs_kind_check" CHECK (("kind" = ANY (ARRAY['resume'::"text", 'cover'::"text", 'prepare'::"text"]))),
    CONSTRAINT "generation_jobs_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"])))),
    CONSTRAINT "generation_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."identity_assertions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "left_listing_id" "uuid" NOT NULL,
    "right_listing_id" "uuid" NOT NULL,
    "relation" "text" NOT NULL,
    "evidence_kind" "text" NOT NULL,
    "public_evidence_ref" "text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "revision" bigint DEFAULT 1 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "identity_assertions_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "revision"))),
    CONSTRAINT "identity_assertions_check1" CHECK (("left_listing_id" <> "right_listing_id")),
    CONSTRAINT "identity_assertions_check2" CHECK ((("status" <> 'accepted'::"text") OR (("evidence_kind" = 'reviewed_public'::"text") AND ("reviewed_at" IS NOT NULL)))),
    CONSTRAINT "identity_assertions_evidence_kind_check" CHECK (("evidence_kind" = ANY (ARRAY['structured_source'::"text", 'reviewed_public'::"text"]))),
    CONSTRAINT "identity_assertions_relation_check" CHECK (("relation" = ANY (ARRAY['same_job'::"text", 'repost_of'::"text", 'source_migration'::"text"]))),
    CONSTRAINT "identity_assertions_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "identity_assertions_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'retracted'::"text"])))
);


ALTER TABLE "public"."identity_assertions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_allowances" (
    "user_id" "uuid" NOT NULL,
    "remaining" integer NOT NULL,
    "granted" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invite_allowances_remaining_check" CHECK (("remaining" >= 0))
);


ALTER TABLE "public"."invite_allowances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_codes" (
    "code" "text" NOT NULL,
    "note" "text",
    "max_uses" integer DEFAULT 1 NOT NULL,
    "uses" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "recipient_email" "text",
    CONSTRAINT "invite_codes_check" CHECK ((("uses" >= 0) AND ("uses" <= "max_uses")))
);


ALTER TABLE "public"."invite_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_redemptions" (
    "email" "text" NOT NULL,
    "code" "text" NOT NULL,
    "user_id" "uuid",
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invite_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_version_id" "uuid" NOT NULL,
    "location_id" "text" NOT NULL,
    "evidence_kind" "text" NOT NULL,
    "public_evidence_ref" "text" NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "confidence" numeric,
    "revision" bigint DEFAULT 1 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "job_locations_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "revision"))),
    CONSTRAINT "job_locations_check1" CHECK ((("valid_from" IS NULL) OR ("valid_to" IS NULL) OR ("valid_from" <= "valid_to"))),
    CONSTRAINT "job_locations_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "job_locations_evidence_kind_check" CHECK (("evidence_kind" = ANY (ARRAY['structured_source'::"text", 'reviewed_public'::"text", 'legacy_mapping'::"text"]))),
    CONSTRAINT "job_locations_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "job_locations_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'retracted'::"text"])))
);


ALTER TABLE "public"."job_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_payload_demands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "claim_owner_token" "text",
    "claim_generation" bigint DEFAULT 0 NOT NULL,
    "lease_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settled_at" timestamp with time zone,
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    "protection_until" timestamp with time zone DEFAULT ("clock_timestamp"() + '00:03:00'::interval),
    "consumed_at" timestamp with time zone,
    "consumption_applied_at" timestamp with time zone,
    CONSTRAINT "job_payload_demands_check" CHECK ((("claim_owner_token" IS NULL) = ("lease_until" IS NULL))),
    CONSTRAINT "job_payload_demands_claim_generation_check" CHECK (("claim_generation" >= 0)),
    CONSTRAINT "job_payload_demands_kind_check" CHECK (("kind" = ANY (ARRAY['description'::"text", 'questions'::"text", 'review'::"text", 'prepare'::"text", 'generation'::"text"]))),
    CONSTRAINT "job_payload_demands_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"])))),
    CONSTRAINT "job_payload_demands_ready_version" CHECK ((("status" <> 'ready'::"text") OR ("job_version_id" IS NOT NULL))),
    CONSTRAINT "job_payload_demands_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'ready'::"text", 'deferred'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."job_payload_demands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_questions" (
    "job_id" "text" NOT NULL,
    "questions" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "captured_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "capture_provenance" "text",
    "job_version_id" "uuid"
);


ALTER TABLE "public"."job_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_reviews" (
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "profile_version" "text" NOT NULL,
    "stage1_decision" "text",
    "stage1_reason" "text",
    "verdict" "text",
    "experience_match" "text",
    "industry" "text",
    "industry_subcategory" "text",
    "confidence" "text",
    "reasoning" "text",
    "model_stage1" "text",
    "model_stage2" "text",
    "error" "text",
    "reviewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_category" "text",
    "seniority" "text",
    "work_arrangement" "text",
    "about" "text",
    "pay_min" integer,
    "pay_max" integer,
    "pay_currency" "text",
    "pay_period" "text",
    "headcount" "text",
    "skills_score" integer,
    "experience_score" integer,
    "comp_score" integer,
    "fit_score" integer,
    "red_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "skill_gaps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "human_override" boolean DEFAULT false NOT NULL,
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "job_reviews_confidence_check" CHECK (("confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "job_reviews_experience_match_check" CHECK (("experience_match" = ANY (ARRAY['step_down'::"text", 'match'::"text", 'reach'::"text", 'far_reach'::"text"]))),
    CONSTRAINT "job_reviews_pay_period_check" CHECK (("pay_period" = ANY (ARRAY['year'::"text", 'hour'::"text", 'month'::"text"]))),
    CONSTRAINT "job_reviews_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"])))),
    CONSTRAINT "job_reviews_scores_range" CHECK (((("skills_score" IS NULL) OR (("skills_score" >= 0) AND ("skills_score" <= 100))) AND (("experience_score" IS NULL) OR (("experience_score" >= 0) AND ("experience_score" <= 100))) AND (("comp_score" IS NULL) OR (("comp_score" >= 0) AND ("comp_score" <= 100))) AND (("fit_score" IS NULL) OR (("fit_score" >= 0) AND ("fit_score" <= 100))))),
    CONSTRAINT "job_reviews_stage1_decision_check" CHECK (("stage1_decision" = ANY (ARRAY['pass'::"text", 'reject'::"text"]))),
    CONSTRAINT "job_reviews_verdict_check" CHECK (("verdict" = ANY (ARRAY['approve'::"text", 'deny'::"text"]))),
    CONSTRAINT "job_reviews_work_arrangement_check" CHECK (("work_arrangement" = ANY (ARRAY['remote'::"text", 'hybrid'::"text", 'onsite'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."job_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_version_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "evidence_kind" "text" NOT NULL,
    "public_evidence_ref" "text" NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "confidence" numeric,
    "revision" bigint DEFAULT 1 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "job_skills_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "revision"))),
    CONSTRAINT "job_skills_check1" CHECK ((("valid_from" IS NULL) OR ("valid_to" IS NULL) OR ("valid_from" <= "valid_to"))),
    CONSTRAINT "job_skills_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "job_skills_evidence_kind_check" CHECK (("evidence_kind" = ANY (ARRAY['structured_source'::"text", 'reviewed_public'::"text", 'legacy_mapping'::"text"]))),
    CONSTRAINT "job_skills_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "job_skills_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'retracted'::"text"])))
);


ALTER TABLE "public"."job_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "text" NOT NULL,
    "source_listing_id" "uuid" NOT NULL,
    "revision" bigint NOT NULL,
    "content_hash" "text" NOT NULL,
    "public_metadata" "jsonb" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload_ref" "text",
    "payload_expires_at" timestamp with time zone,
    CONSTRAINT "job_versions_check" CHECK ((("payload_ref" IS NULL) = ("payload_expires_at" IS NULL))),
    CONSTRAINT "job_versions_content_hash_check" CHECK (("content_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "job_versions_public_metadata_check" CHECK (("jsonb_typeof"("public_metadata") = 'object'::"text")),
    CONSTRAINT "job_versions_revision_check" CHECK (("revision" > 0))
);


ALTER TABLE "public"."job_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "text" NOT NULL,
    "company_id" integer NOT NULL,
    "external_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "location" "text",
    "department" "text",
    "remote" boolean,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "description" "text",
    "description_pruned" boolean DEFAULT false NOT NULL,
    "location_canonicals" "text"[],
    "description_captured_at" timestamp with time zone,
    "description_last_used_at" timestamp with time zone,
    "description_capture_provenance" "text",
    "description_version_id" "uuid"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_backfill_readiness" (
    "singleton" boolean DEFAULT true NOT NULL,
    "activation_generation" bigint,
    "source_revision" "text",
    "phase" "text" DEFAULT 'jobs'::"text" NOT NULL,
    "cursor" "text",
    "completed_at" timestamp with time zone,
    CONSTRAINT "lifecycle_backfill_readiness_phase_check" CHECK (("phase" = ANY (ARRAY['jobs'::"text", 'companies'::"text"]))),
    CONSTRAINT "lifecycle_backfill_readiness_singleton_check" CHECK ("singleton"),
    CONSTRAINT "lifecycle_backfill_readiness_source_revision_check" CHECK (("source_revision" ~ '^[0-9a-f]{40}$'::"text"))
);


ALTER TABLE "public"."lifecycle_backfill_readiness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_claims" (
    "kind" "text" NOT NULL,
    "work_id" "text" NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint DEFAULT 1 NOT NULL,
    "replay_floor" bigint DEFAULT 0 NOT NULL,
    "invoking_role" "name" NOT NULL,
    "subject_id" "uuid",
    "lease_until" timestamp with time zone NOT NULL,
    "state" "text" DEFAULT 'active'::"text" NOT NULL,
    "terminal_at" timestamp with time zone,
    "reservation_subject_id" "uuid",
    "reservation_subject_bound" boolean DEFAULT false NOT NULL,
    CONSTRAINT "lifecycle_claims_check" CHECK ((("replay_floor" >= 0) AND ("replay_floor" <= "generation"))),
    CONSTRAINT "lifecycle_claims_generation_check" CHECK (("generation" > 0)),
    CONSTRAINT "lifecycle_claims_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'complete'::"text"])))
);


ALTER TABLE "public"."lifecycle_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_control" (
    "singleton" boolean DEFAULT true NOT NULL,
    "flags_version" integer DEFAULT 1 NOT NULL,
    "safety_stage" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "identity_enabled" boolean DEFAULT false NOT NULL,
    "source_enabled" boolean DEFAULT false NOT NULL,
    "maintenance_enabled" boolean DEFAULT false NOT NULL,
    "hydration_enabled" boolean DEFAULT false NOT NULL,
    "feed_enabled" boolean DEFAULT false NOT NULL,
    "retirement_enabled" boolean DEFAULT false NOT NULL,
    "retirement_dry_run" boolean DEFAULT true NOT NULL,
    "archive_ever_activated" boolean DEFAULT false NOT NULL,
    "archive_stage" "text" DEFAULT 'never_activated'::"text" NOT NULL,
    "export_enabled" boolean DEFAULT false NOT NULL,
    "activation_generation" bigint DEFAULT 0 NOT NULL,
    "identity_migration_activated_at" timestamp with time zone,
    CONSTRAINT "lifecycle_control_activation_generation_check" CHECK (("activation_generation" >= 0)),
    CONSTRAINT "lifecycle_control_archive_stage_check" CHECK (("archive_stage" = ANY (ARRAY['never_activated'::"text", 'active'::"text", 'producer_paused'::"text"]))),
    CONSTRAINT "lifecycle_control_check" CHECK (("archive_ever_activated" = ("archive_stage" <> 'never_activated'::"text"))),
    CONSTRAINT "lifecycle_control_check1" CHECK (((NOT "export_enabled") OR "archive_ever_activated")),
    CONSTRAINT "lifecycle_control_flags_version_check" CHECK (("flags_version" > 0)),
    CONSTRAINT "lifecycle_control_safety_stage_check" CHECK (("safety_stage" = ANY (ARRAY['legacy'::"text", 'collect'::"text", 'enforced'::"text"]))),
    CONSTRAINT "lifecycle_control_singleton_check" CHECK ("singleton")
);


ALTER TABLE "public"."lifecycle_control" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_identity_authorizations" (
    "campaign_id" "uuid" NOT NULL,
    "source_revision" "text" NOT NULL,
    "activation_generation" bigint NOT NULL,
    "authorized_at" timestamp with time zone NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "project_ref" "text" NOT NULL,
    "source" "text" NOT NULL,
    "volume" "text" NOT NULL,
    "capacity_bytes" bigint NOT NULL,
    "free_bytes" bigint NOT NULL,
    "resident_wal_bytes" bigint NOT NULL,
    CONSTRAINT "lifecycle_identity_authorizations_activation_generation_check" CHECK (("activation_generation" >= 0)),
    CONSTRAINT "lifecycle_identity_authorizations_capacity_bytes_check" CHECK (("capacity_bytes" > 0)),
    CONSTRAINT "lifecycle_identity_authorizations_check" CHECK ((("valid_until" > "authorized_at") AND ("valid_until" <= ("authorized_at" + '00:00:45'::interval)))),
    CONSTRAINT "lifecycle_identity_authorizations_check1" CHECK ((("free_bytes" >= 0) AND ("free_bytes" <= "capacity_bytes"))),
    CONSTRAINT "lifecycle_identity_authorizations_check2" CHECK ((("resident_wal_bytes" >= 0) AND ("resident_wal_bytes" <= ("capacity_bytes" - "free_bytes")))),
    CONSTRAINT "lifecycle_identity_authorizations_source_check" CHECK (("source" = 'supabase_metrics'::"text")),
    CONSTRAINT "lifecycle_identity_authorizations_source_revision_check" CHECK (("source_revision" ~ '^[0-9a-f]{40}$'::"text")),
    CONSTRAINT "lifecycle_identity_authorizations_volume_check" CHECK (("length"("volume") > 0))
);


ALTER TABLE "public"."lifecycle_identity_authorizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_identity_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state" "text" DEFAULT 'paused'::"text" NOT NULL,
    "source_revision" "text" NOT NULL,
    "activation_generation" bigint NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "max_job_rows" integer NOT NULL,
    "max_company_rows" integer NOT NULL,
    "max_turns" integer NOT NULL,
    "job_high_water" "text",
    "company_high_water" bigint NOT NULL,
    "phase" "text" DEFAULT 'jobs'::"text" NOT NULL,
    "job_cursor" "text",
    "company_cursor" bigint DEFAULT 0 NOT NULL,
    "job_rows" bigint DEFAULT 0 NOT NULL,
    "mapped_jobs" bigint DEFAULT 0 NOT NULL,
    "company_rows" bigint DEFAULT 0 NOT NULL,
    "mapped_accounts" bigint DEFAULT 0 NOT NULL,
    "turns" integer DEFAULT 0 NOT NULL,
    "next_turn_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "heartbeat_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "before_bytes" bigint,
    "after_bytes" bigint,
    "stop_reason" "text",
    CONSTRAINT "lifecycle_identity_campaigns_activation_generation_check" CHECK (("activation_generation" >= 0)),
    CONSTRAINT "lifecycle_identity_campaigns_check" CHECK ((("job_rows" >= 0) AND ("mapped_jobs" >= 0) AND ("mapped_jobs" <= "job_rows") AND ("job_rows" <= "max_job_rows"))),
    CONSTRAINT "lifecycle_identity_campaigns_check1" CHECK ((("company_rows" >= 0) AND ("mapped_accounts" >= 0) AND ("mapped_accounts" <= "max_company_rows"))),
    CONSTRAINT "lifecycle_identity_campaigns_check2" CHECK ((("turns" >= 0) AND ("turns" <= "max_turns"))),
    CONSTRAINT "lifecycle_identity_campaigns_company_high_water_check" CHECK (("company_high_water" >= 0)),
    CONSTRAINT "lifecycle_identity_campaigns_max_company_rows_check" CHECK ((("max_company_rows" >= 0) AND ("max_company_rows" <= 50000))),
    CONSTRAINT "lifecycle_identity_campaigns_max_job_rows_check" CHECK ((("max_job_rows" >= 0) AND ("max_job_rows" <= 1000000))),
    CONSTRAINT "lifecycle_identity_campaigns_max_turns_check" CHECK ((("max_turns" >= 1) AND ("max_turns" <= 1000))),
    CONSTRAINT "lifecycle_identity_campaigns_phase_check" CHECK (("phase" = ANY (ARRAY['jobs'::"text", 'companies'::"text", 'finished'::"text"]))),
    CONSTRAINT "lifecycle_identity_campaigns_source_revision_check" CHECK (("source_revision" ~ '^[0-9a-f]{40}$'::"text")),
    CONSTRAINT "lifecycle_identity_campaigns_state_check" CHECK (("state" = ANY (ARRAY['paused'::"text", 'running'::"text", 'completed'::"text", 'stopped'::"text", 'budget_exhausted'::"text"])))
);


ALTER TABLE "public"."lifecycle_identity_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_identity_generation" (
    "singleton" boolean DEFAULT true NOT NULL,
    "generation" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "lifecycle_identity_generation_generation_check" CHECK (("generation" >= 0)),
    CONSTRAINT "lifecycle_identity_generation_singleton_check" CHECK ("singleton")
);


ALTER TABLE "public"."lifecycle_identity_generation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_maintenance_state" (
    "singleton" boolean DEFAULT true NOT NULL,
    "cutover_at" timestamp with time zone,
    "cursor" "text",
    "next_phase" integer DEFAULT 0 NOT NULL,
    "last_success_at" timestamp with time zone,
    "eligible_rows" bigint DEFAULT 0 NOT NULL,
    "retired_rows" bigint DEFAULT 0 NOT NULL,
    "retired_bytes" bigint DEFAULT 0 NOT NULL,
    "physical_bytes" bigint,
    "held_bytes" bigint,
    "live_tuples" bigint,
    "dead_tuples" bigint,
    "reusable_bytes" bigint,
    "wal_bytes" numeric,
    "guard_active" boolean DEFAULT false NOT NULL,
    "guard_scheduled_streak" integer DEFAULT 0 NOT NULL,
    "action_needed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "lifecycle_maintenance_state_singleton_check" CHECK ("singleton")
);


ALTER TABLE "public"."lifecycle_maintenance_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_operational_listings" (
    "listing_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "seen_sequence" bigint DEFAULT 0 NOT NULL,
    "seen_at" timestamp with time zone,
    "seen_kind" "text",
    "miss_sequence" bigint DEFAULT 0 NOT NULL,
    "miss_count" integer DEFAULT 0 NOT NULL,
    "first_miss_at" timestamp with time zone,
    CONSTRAINT "lifecycle_operational_listings_miss_count_check" CHECK ((("miss_count" >= 0) AND ("miss_count" <= 2))),
    CONSTRAINT "lifecycle_operational_listings_seen_kind_check" CHECK ((("seen_kind" IS NULL) OR ("seen_kind" = ANY (ARRAY['seen'::"text", 'unlisted'::"text", 'removed'::"text", 'expired'::"text"]))))
);


ALTER TABLE "public"."lifecycle_operational_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_operational_receipts" (
    "source_id" "uuid" NOT NULL,
    "backend_pid" integer,
    "transaction_id" "xid8",
    "owner_token" "text",
    "generation" bigint,
    "invoking_role" "name",
    "subject_id" "uuid",
    "row_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "lifecycle_operational_receipts_row_count_check" CHECK ((("row_count" >= 0) AND ("row_count" <= 500)))
);


ALTER TABLE "public"."lifecycle_operational_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_operational_sources" (
    "source_id" "uuid" NOT NULL,
    "sequence" bigint DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'idle'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_turn_at" timestamp with time zone,
    "cursor" "uuid",
    "reconciled" boolean DEFAULT true NOT NULL,
    "members_seen" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "lifecycle_operational_sources_status_check" CHECK (("status" = ANY (ARRAY['idle'::"text", 'running'::"text", 'complete'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."lifecycle_operational_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_staging_cleanup" (
    "enumeration_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "lifecycle_staging_cleanup_reason_check" CHECK (("reason" = ANY (ARRAY['completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."lifecycle_staging_cleanup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_write_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "backend_pid" integer DEFAULT "pg_backend_pid"() NOT NULL,
    "transaction_id" "xid8" DEFAULT "pg_current_xact_id"() NOT NULL,
    "invoking_role" "name" NOT NULL,
    "subject_id" "uuid",
    "owner_token" "text",
    "generation" bigint,
    "reservation_id" "uuid",
    "job_id" "text",
    "scope" "text",
    "bytes" bigint DEFAULT 0 NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "total_bytes" numeric DEFAULT 0 NOT NULL,
    "total_rows" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "lifecycle_write_checks_bytes_check" CHECK (("bytes" >= 0)),
    CONSTRAINT "lifecycle_write_checks_row_count_check" CHECK ((("row_count" >= 0) AND ("row_count" <= 1)))
);


ALTER TABLE "public"."lifecycle_write_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lifecycle_writer_readiness" (
    "writer" "text" NOT NULL,
    "contract_version" integer NOT NULL,
    "installed_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "validated_at" timestamp with time zone,
    "notes" "text" NOT NULL,
    "source_revision" "text",
    CONSTRAINT "lifecycle_writer_readiness_source_revision_check" CHECK ((("source_revision" IS NULL) OR ("source_revision" ~ '^[0-9a-f]{40}$'::"text")))
);


ALTER TABLE "public"."lifecycle_writer_readiness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "raw" "text" NOT NULL,
    "canonicals" "text"[] NOT NULL,
    "components" "jsonb" NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "locations_source_check" CHECK (("source" = ANY (ARRAY['rule'::"text", 'llm'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_activity" (
    "user_id" "uuid" NOT NULL,
    "last_meaningful_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paused_at" timestamp with time zone
);


ALTER TABLE "public"."matching_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."openrouter_usage_snapshots" (
    "taken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_usage" numeric NOT NULL,
    "total_credits" numeric
);


ALTER TABLE "public"."openrouter_usage_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_overrides" (
    "user_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plan_overrides_plan_check" CHECK (("plan" = ANY (ARRAY['standard'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."plan_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_runs" (
    "id" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "companies_ok" integer,
    "companies_failed" integer,
    "new_jobs" integer,
    "closed_jobs" integer,
    "notes" "text"
);


ALTER TABLE "public"."poll_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."poll_runs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."poll_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."poll_runs_id_seq" OWNED BY "public"."poll_runs"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "resume_text" "text",
    "resume_file_path" "text",
    "instructions" "text",
    "profile_version" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model_stage1" "text",
    "model_stage2" "text",
    "preferred_locations" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "model_resume" "text",
    "company_instructions" "text",
    "company_profile_version" "text",
    "model_company" "text",
    "board_filters" "jsonb",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "location" "text",
    "work_authorized" boolean,
    "needs_sponsorship" boolean,
    "eeo_gender" "text",
    "eeo_race" "text",
    "eeo_veteran" "text",
    "eeo_disability" "text",
    "screening_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_cover" "text",
    "daily_review_cap" integer,
    "reasoning_effort_resume" "text",
    "reasoning_effort_cover" "text",
    "resume_generation_instructions" "text",
    "cover_letter_generation_instructions" "text",
    "company_exclusions" "jsonb",
    CONSTRAINT "reasoning_effort_cover_valid" CHECK (("reasoning_effort_cover" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "reasoning_effort_resume_valid" CHECK (("reasoning_effort_resume" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_batch_markers" (
    "batch_id" "uuid" NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "event_ids_sha256" "text" NOT NULL,
    "manifest_hash" "text" NOT NULL,
    "acked_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."public_archive_batch_markers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_batches" (
    "batch_id" "uuid" NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "serializer_version" integer NOT NULL,
    "state" "text" DEFAULT 'claimed'::"text" NOT NULL,
    "sealed_at" timestamp with time zone NOT NULL,
    "eligible_until" timestamp with time zone NOT NULL,
    "prior_batch_id" "uuid",
    "data_key" "text",
    "manifest_key" "text",
    "canonical_hash" "text",
    "compressed_hash" "text",
    "manifest_hash" "text",
    "event_count" integer NOT NULL,
    "expanded_bytes" integer NOT NULL,
    "compressed_bytes" integer,
    "manifest_bytes" integer,
    "acked_at" timestamp with time zone,
    "object_prefix" "text",
    "event_ids_sha256" "text",
    "aggregate_revision_ranges" "jsonb",
    "schema_version" integer DEFAULT 1 NOT NULL,
    "ingestion_date" "date",
    CONSTRAINT "archive_sealed_fields" CHECK ((("state" = ANY (ARRAY['claimed'::"text", 'superseded'::"text"])) OR (("data_key" IS NOT NULL) AND ("manifest_key" IS NOT NULL) AND ("canonical_hash" IS NOT NULL) AND ("compressed_hash" IS NOT NULL) AND ("manifest_hash" IS NOT NULL) AND (("compressed_bytes" >= 1) AND ("compressed_bytes" <= 16777216)) AND (("manifest_bytes" >= 1) AND ("manifest_bytes" <= 1048576))))),
    CONSTRAINT "public_archive_batches_check" CHECK (("eligible_until" = ("sealed_at" + '17520:00:00'::interval))),
    CONSTRAINT "public_archive_batches_event_count_check" CHECK ((("event_count" >= 1) AND ("event_count" <= 2000))),
    CONSTRAINT "public_archive_batches_expanded_bytes_check" CHECK ((("expanded_bytes" >= 1) AND ("expanded_bytes" <= 8388608))),
    CONSTRAINT "public_archive_batches_schema_version_check" CHECK (("schema_version" = 1)),
    CONSTRAINT "public_archive_batches_serializer_version_check" CHECK (("serializer_version" = 1)),
    CONSTRAINT "public_archive_batches_state_check" CHECK (("state" = ANY (ARRAY['claimed'::"text", 'sealed'::"text", 'acked'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."public_archive_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_coverage" (
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "revision" bigint NOT NULL,
    "event_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."public_archive_coverage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_destination" (
    "singleton" boolean DEFAULT true NOT NULL,
    "object_prefix" "text" NOT NULL,
    "validated_at" timestamp with time zone NOT NULL,
    "bucket" "text",
    "region" "text",
    "expected_owner" "text",
    "private_validated" boolean DEFAULT false NOT NULL,
    "encryption_validated" boolean DEFAULT false NOT NULL,
    "policy_validated" boolean DEFAULT false NOT NULL,
    "validation_evidence" "text",
    CONSTRAINT "public_archive_destination_object_prefix_check" CHECK ((("length"("object_prefix") >= 1) AND ("length"("object_prefix") <= 256) AND ("object_prefix" ~ '^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$'::"text"))),
    CONSTRAINT "public_archive_destination_singleton_check" CHECK ("singleton")
);


ALTER TABLE "public"."public_archive_destination" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_heads" (
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "revision" bigint NOT NULL,
    CONSTRAINT "public_archive_heads_revision_check" CHECK (("revision" > 0))
);


ALTER TABLE "public"."public_archive_heads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_items" (
    "batch_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "event_id" "uuid" NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "revision" bigint NOT NULL,
    "canonical_event" "bytea" NOT NULL,
    CONSTRAINT "public_archive_items_position_check" CHECK ((("position" >= 0) AND ("position" <= 1999)))
);


ALTER TABLE "public"."public_archive_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_quarantine" (
    "batch_id" "uuid" NOT NULL,
    "diagnostic_code" "text" NOT NULL,
    "quarantined_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "public_archive_quarantine_diagnostic_code_check" CHECK (("diagnostic_code" = 'invalid_archive'::"text"))
);


ALTER TABLE "public"."public_archive_quarantine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_receipts" (
    "batch_id" "uuid" NOT NULL,
    "data_receipt" "jsonb" NOT NULL,
    "manifest_receipt" "jsonb" NOT NULL,
    "verified_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."public_archive_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_recovery_authorizations" (
    "authorization_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "event_ids_sha256" "text" NOT NULL,
    "manifest_hash" "text",
    "approved_by" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "replacement_batch_id" "uuid",
    CONSTRAINT "public_archive_recovery_authorizations_approved_by_check" CHECK ((("length"("approved_by") >= 1) AND ("length"("approved_by") <= 256))),
    CONSTRAINT "public_archive_recovery_authorizations_check" CHECK (("expires_at" > "approved_at")),
    CONSTRAINT "public_archive_recovery_authorizations_check1" CHECK ((("consumed_at" IS NULL) = ("replacement_batch_id" IS NULL))),
    CONSTRAINT "public_archive_recovery_authorizations_reason_check" CHECK ((("length"("reason") >= 1) AND ("length"("reason") <= 1024)))
);


ALTER TABLE "public"."public_archive_recovery_authorizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_supersessions" (
    "old_batch_id" "uuid" NOT NULL,
    "new_batch_id" "uuid" NOT NULL,
    "authorization_id" "uuid" NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "event_ids_sha256" "text" NOT NULL,
    "manifest_hash" "text",
    "replaced_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."public_archive_supersessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_suppressions" (
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "suppressed_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "reason" "text" NOT NULL
);


ALTER TABLE "public"."public_archive_suppressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_archive_version_coverage" (
    "version_id" "uuid" NOT NULL,
    "source_listing_id" "uuid" NOT NULL,
    "version_revision" bigint NOT NULL,
    "content_hash" "text" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."public_archive_version_coverage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_change_requirements" (
    "id" bigint NOT NULL,
    "transaction_id" "xid8" DEFAULT "pg_current_xact_id"() NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "revision" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "body" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "observed_at" timestamp with time zone,
    "recorded_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "provenance" "text" DEFAULT 'current_baseline'::"text" NOT NULL,
    CONSTRAINT "public_change_requirements_body_check" CHECK ((("jsonb_typeof"("body") = 'object'::"text") AND ("octet_length"(("body")::"text") <= 8192))),
    CONSTRAINT "public_change_requirements_kind_check" CHECK (("kind" = ANY (ARRAY['baseline'::"text", 'upsert'::"text", 'closed'::"text", 'reopened'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."public_change_requirements" OWNER TO "postgres";


ALTER TABLE "public"."public_change_requirements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."public_change_requirements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."public_critical_event_slots" (
    "slot" integer NOT NULL,
    "state" "text" DEFAULT 'free'::"text" NOT NULL,
    "transaction_id" "xid8",
    "source_id" "uuid",
    "aggregate_type" "text",
    "aggregate_id" "text",
    "revision" bigint,
    "event_id" "uuid",
    "predecessor_id" "uuid",
    "kind" "text",
    "body" "jsonb",
    "occurred_at" timestamp with time zone,
    "canonical_event" "bytea",
    "recorded_at" timestamp with time zone,
    "padding" "bytea" DEFAULT "decode"("repeat"('00'::"text", 24576), 'hex'::"text") NOT NULL,
    "observed_at" timestamp with time zone,
    "provenance" "text" DEFAULT 'database_change'::"text" NOT NULL,
    CONSTRAINT "public_critical_event_slots_body_check" CHECK ((("body" IS NULL) OR ("octet_length"(("body")::"text") <= 8192))),
    CONSTRAINT "public_critical_event_slots_canonical_event_check" CHECK ((("canonical_event" IS NULL) OR ("octet_length"("canonical_event") <= 12288))),
    CONSTRAINT "public_critical_event_slots_check" CHECK ((("state" = 'free'::"text") OR (("aggregate_type" IS NOT NULL) AND ("aggregate_id" IS NOT NULL) AND ("revision" IS NOT NULL)))),
    CONSTRAINT "public_critical_event_slots_check1" CHECK ((("state" <> ALL (ARRAY['pending'::"text", 'acked'::"text"])) OR (("event_id" IS NOT NULL) AND ("canonical_event" IS NOT NULL)))),
    CONSTRAINT "public_critical_event_slots_slot_check" CHECK ((("slot" >= 1) AND ("slot" <= 12500))),
    CONSTRAINT "public_critical_event_slots_state_check" CHECK (("state" = ANY (ARRAY['free'::"text", 'allocated'::"text", 'pending'::"text", 'acked'::"text"])))
);
ALTER TABLE ONLY "public"."public_critical_event_slots" ALTER COLUMN "padding" SET STORAGE EXTERNAL;


ALTER TABLE "public"."public_critical_event_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_outbox" (
    "event_id" "uuid" NOT NULL,
    "requirement_id" bigint NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "revision" bigint NOT NULL,
    "predecessor_id" "uuid",
    "kind" "text" NOT NULL,
    "body" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "canonical_event" "bytea" NOT NULL,
    "body_bytes" integer NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "observed_at" timestamp with time zone,
    "provenance" "text" DEFAULT 'current_baseline'::"text" NOT NULL,
    CONSTRAINT "public_outbox_body_bytes_check" CHECK ((("body_bytes" >= 1) AND ("body_bytes" <= 8192))),
    CONSTRAINT "public_outbox_canonical_event_check" CHECK (("octet_length"("canonical_event") <= 12288)),
    CONSTRAINT "public_outbox_revision_check" CHECK (("revision" > 0))
);


ALTER TABLE "public"."public_outbox" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_pending_events" AS
 SELECT "public_outbox"."event_id",
    "public_outbox"."requirement_id",
    "public_outbox"."aggregate_type",
    "public_outbox"."aggregate_id",
    "public_outbox"."revision",
    "public_outbox"."predecessor_id",
    "public_outbox"."kind",
    "public_outbox"."body",
    "public_outbox"."occurred_at",
    "public_outbox"."canonical_event",
    "public_outbox"."body_bytes",
    "public_outbox"."recorded_at"
   FROM "public"."public_outbox"
UNION ALL
 SELECT "public_critical_event_slots"."event_id",
    NULL::bigint AS "requirement_id",
    "public_critical_event_slots"."aggregate_type",
    "public_critical_event_slots"."aggregate_id",
    "public_critical_event_slots"."revision",
    "public_critical_event_slots"."predecessor_id",
    "public_critical_event_slots"."kind",
    "public_critical_event_slots"."body",
    "public_critical_event_slots"."occurred_at",
    "public_critical_event_slots"."canonical_event",
    "octet_length"(("public_critical_event_slots"."body")::"text") AS "body_bytes",
    "public_critical_event_slots"."recorded_at"
   FROM "public"."public_critical_event_slots"
  WHERE ("public_critical_event_slots"."state" = 'pending'::"text");


ALTER VIEW "public"."public_pending_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reconciliation_checkpoints" (
    "enumeration_id" "uuid" NOT NULL,
    "last_external_id" "text",
    "generation" bigint NOT NULL,
    "reconciled_count" bigint DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "reconciliation_checkpoints_generation_check" CHECK (("generation" > 0)),
    CONSTRAINT "reconciliation_checkpoints_reconciled_count_check" CHECK (("reconciled_count" >= 0))
);


ALTER TABLE "public"."reconciliation_checkpoints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resume_scores" (
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "grounding" integer,
    "jd_relevance" integer,
    "comment" "text",
    "resume_trace_id" "text",
    "resume_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model" "text",
    "scored_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_version_id" "uuid",
    "description_snapshot" "text",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "resume_scores_grounding_check" CHECK ((("grounding" >= 1) AND ("grounding" <= 5))),
    CONSTRAINT "resume_scores_jd_relevance_check" CHECK ((("jd_relevance" >= 1) AND ("jd_relevance" <= 5))),
    CONSTRAINT "resume_scores_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"]))))
);


ALTER TABLE "public"."resume_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_corrections" (
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "verdict" "text",
    "experience_match" "text",
    "industry" "text",
    "industry_subcategory" "text",
    "confidence" "text",
    "role_category" "text",
    "seniority" "text",
    "work_arrangement" "text",
    "skills_score" integer,
    "experience_score" integer,
    "comp_score" integer,
    "fit_score" integer,
    "reasoning" "text",
    "about" "text",
    "pay_min" integer,
    "pay_max" integer,
    "pay_currency" "text",
    "pay_period" "text",
    "headcount" "text",
    "red_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "skill_gaps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "note" "text",
    "corrected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description_snapshot" "text",
    "resume_text_snapshot" "text",
    "instructions_snapshot" "text",
    "job_version_id" "uuid",
    "questions_snapshot" "jsonb",
    "snapshot_captured_at" timestamp with time zone,
    CONSTRAINT "review_corrections_confidence_check" CHECK (("confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "review_corrections_experience_match_check" CHECK (("experience_match" = ANY (ARRAY['step_down'::"text", 'match'::"text", 'reach'::"text", 'far_reach'::"text"]))),
    CONSTRAINT "review_corrections_pay_period_check" CHECK (("pay_period" = ANY (ARRAY['year'::"text", 'hour'::"text", 'month'::"text"]))),
    CONSTRAINT "review_corrections_questions_shape" CHECK ((("questions_snapshot" IS NULL) OR ("jsonb_typeof"("questions_snapshot") = ANY (ARRAY['object'::"text", 'array'::"text"])))),
    CONSTRAINT "review_corrections_scores_range" CHECK (((("skills_score" IS NULL) OR (("skills_score" >= 0) AND ("skills_score" <= 100))) AND (("experience_score" IS NULL) OR (("experience_score" >= 0) AND ("experience_score" <= 100))) AND (("comp_score" IS NULL) OR (("comp_score" >= 0) AND ("comp_score" <= 100))) AND (("fit_score" IS NULL) OR (("fit_score" >= 0) AND ("fit_score" <= 100))))),
    CONSTRAINT "review_corrections_verdict_check" CHECK (("verdict" = ANY (ARRAY['approve'::"text", 'deny'::"text"]))),
    CONSTRAINT "review_corrections_work_arrangement_check" CHECK (("work_arrangement" = ANY (ARRAY['remote'::"text", 'hybrid'::"text", 'onsite'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."review_corrections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_requests" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "notes" "text",
    "resume_requested" boolean DEFAULT false NOT NULL,
    "claim_version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "review_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."review_requests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."review_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."review_requests_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."review_requests_id_seq" OWNED BY "public"."review_requests"."id";



CREATE TABLE IF NOT EXISTS "public"."review_runs" (
    "id" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "reviewed" integer,
    "gate_rejected" integer,
    "approved" integer,
    "denied" integer,
    "errors" integer,
    "notes" "text",
    "user_id" "uuid"
);


ALTER TABLE "public"."review_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."review_runs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."review_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."review_runs_id_seq" OWNED BY "public"."review_runs"."id";



CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "filename" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "canonical_name" "text" NOT NULL
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_company_id" integer,
    "ats" "text" NOT NULL,
    "public_board_ref" "text" NOT NULL,
    "public_url" "text",
    "legacy_active" boolean,
    "exclusion_state" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "last_complete_success_at" timestamp with time zone,
    "last_outcome" "text",
    "next_due_at" timestamp with time zone,
    "suspicious_empty_streak" integer DEFAULT 0 NOT NULL,
    "failure_streak" integer DEFAULT 0 NOT NULL,
    "claim_owner_token" "text",
    "claim_generation" bigint DEFAULT 0 NOT NULL,
    "lease_until" timestamp with time zone,
    "current_revision" bigint DEFAULT 0 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    "enumeration_sequence" bigint DEFAULT 0 NOT NULL,
    "replay_floor" bigint DEFAULT 0 NOT NULL,
    "reconciliation_cursor" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "followup_due_at" timestamp with time zone,
    "last_followup_at" timestamp with time zone,
    "followup_status" "text",
    CONSTRAINT "source_accounts_ats_check" CHECK (("ats" = ANY (ARRAY['greenhouse'::"text", 'lever'::"text", 'ashby'::"text", 'workable'::"text", 'smartrecruiters'::"text", 'workday'::"text"]))),
    CONSTRAINT "source_accounts_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "current_revision"))),
    CONSTRAINT "source_accounts_check1" CHECK ((("claim_owner_token" IS NULL) = ("lease_until" IS NULL))),
    CONSTRAINT "source_accounts_claim_generation_check" CHECK (("claim_generation" >= 0)),
    CONSTRAINT "source_accounts_current_revision_check" CHECK (("current_revision" >= 0)),
    CONSTRAINT "source_accounts_enumeration_sequence_check" CHECK (("enumeration_sequence" >= 0)),
    CONSTRAINT "source_accounts_exclusion_state_check" CHECK (("exclusion_state" = ANY (ARRAY['unknown'::"text", 'enabled'::"text", 'failure_disabled'::"text", 'deliberate'::"text"]))),
    CONSTRAINT "source_accounts_failure_streak_check" CHECK (("failure_streak" >= 0)),
    CONSTRAINT "source_accounts_followup_status_check" CHECK (("followup_status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'migration_review'::"text"]))),
    CONSTRAINT "source_accounts_replay_floor_check" CHECK (("replay_floor" >= 0)),
    CONSTRAINT "source_accounts_suspicious_empty_streak_check" CHECK (("suspicious_empty_streak" >= 0))
);


ALTER TABLE "public"."source_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_enumerations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "sequence" bigint NOT NULL,
    "owner_token" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cursor" "jsonb",
    "started_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "completed_at" timestamp with time zone,
    "reconciled_at" timestamp with time zone,
    "terminal_at" timestamp with time zone,
    CONSTRAINT "source_enumerations_cursor_check" CHECK ((("cursor" IS NULL) OR ("jsonb_typeof"("cursor") = 'object'::"text"))),
    CONSTRAINT "source_enumerations_generation_check" CHECK (("generation" > 0)),
    CONSTRAINT "source_enumerations_sequence_check" CHECK (("sequence" > 0)),
    CONSTRAINT "source_enumerations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'complete'::"text", 'partial'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."source_enumerations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_account_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "job_id" "text" NOT NULL,
    "current_version_id" "uuid",
    "current_revision" bigint DEFAULT 0 NOT NULL,
    "archived_revision" bigint DEFAULT 0 NOT NULL,
    "original_discovered_at" timestamp with time zone NOT NULL,
    "source_published_at" timestamp with time zone,
    "source_published_provenance" "text",
    "discovery_anchor_at" timestamp with time zone NOT NULL,
    "discovery_anchor_provenance" "text" NOT NULL,
    "discovery_expires_at" timestamp with time zone NOT NULL,
    "successful_last_observed_at" timestamp with time zone,
    "successful_sighting_count" bigint DEFAULT 0 NOT NULL,
    "content_changed_at" timestamp with time zone,
    "content_hash" "text",
    "consecutive_complete_misses" integer DEFAULT 0 NOT NULL,
    "first_complete_miss_at" timestamp with time zone,
    "last_miss_enumeration_id" "uuid",
    "last_membership_sequence" bigint DEFAULT 0 NOT NULL,
    "last_complete_miss_sequence" bigint DEFAULT 0 NOT NULL,
    "last_direct_verification_sequence" bigint DEFAULT 0 NOT NULL,
    "source_availability" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "legacy_closed_at" timestamp with time zone,
    "payload_retired_at" timestamp with time zone,
    "suspected_id_reuse" boolean DEFAULT false NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_demand_verification_id" "uuid",
    "last_observation_kind" "text",
    CONSTRAINT "source_listings_check" CHECK ((("archived_revision" >= 0) AND ("archived_revision" <= "current_revision"))),
    CONSTRAINT "source_listings_check1" CHECK (("discovery_expires_at" = ("discovery_anchor_at" + '720:00:00'::interval))),
    CONSTRAINT "source_listings_check2" CHECK ((("source_published_at" IS NULL) = ("source_published_provenance" IS NULL))),
    CONSTRAINT "source_listings_consecutive_complete_misses_check" CHECK (("consecutive_complete_misses" >= 0)),
    CONSTRAINT "source_listings_content_hash_check" CHECK (("content_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "source_listings_current_revision_check" CHECK (("current_revision" >= 0)),
    CONSTRAINT "source_listings_discovery_anchor_provenance_check" CHECK (("discovery_anchor_provenance" = ANY (ARRAY['legacy_local_observation'::"text", 'local_observation'::"text", 'source_published'::"text"]))),
    CONSTRAINT "source_listings_last_complete_miss_sequence_check" CHECK (("last_complete_miss_sequence" >= 0)),
    CONSTRAINT "source_listings_last_direct_verification_sequence_check" CHECK (("last_direct_verification_sequence" >= 0)),
    CONSTRAINT "source_listings_last_membership_sequence_check" CHECK (("last_membership_sequence" >= 0)),
    CONSTRAINT "source_listings_last_observation_kind_check" CHECK (("last_observation_kind" = ANY (ARRAY['enumeration'::"text", 'demand'::"text", 'followup'::"text"]))),
    CONSTRAINT "source_listings_source_availability_check" CHECK (("source_availability" = ANY (ARRAY['open'::"text", 'unknown'::"text", 'closed'::"text"]))),
    CONSTRAINT "source_listings_successful_sighting_count_check" CHECK (("successful_sighting_count" >= 0))
);


ALTER TABLE "public"."source_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan" "text",
    "status" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_event_at" timestamp with time zone,
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['standard'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscriptions"."last_event_at" IS 'Stripe event.created of the last webhook event applied to this row; the monotonic watermark that lets upsertSubscription drop stale out-of-order deliveries (M-WEBHOOK-ORDER).';



CREATE TABLE IF NOT EXISTS "public"."tier_settings" (
    "plan" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tier_settings_plan_check" CHECK (("plan" = ANY (ARRAY['standard'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."tier_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_counters" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "kind" "text" NOT NULL,
    "n" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."usage_counters" OWNER TO "postgres";


ALTER TABLE ONLY "public"."application_packages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."application_packages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."classification_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."classification_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."companies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."companies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."discovery_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."discovery_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."poll_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."poll_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."review_requests" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."review_requests_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."review_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."review_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_deletions"
    ADD CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."application_packages"
    ADD CONSTRAINT "application_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_packages"
    ADD CONSTRAINT "application_packages_user_id_job_id_key" UNIQUE ("user_id", "job_id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacity_reservations"
    ADD CONSTRAINT "capacity_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classification_jobs"
    ADD CONSTRAINT "classification_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_ats_token_key" UNIQUE ("ats", "token");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_brands"
    ADD CONSTRAINT "company_brands_company_id_brand_id_key" UNIQUE ("company_id", "brand_id");



ALTER TABLE ONLY "public"."company_brands"
    ADD CONSTRAINT "company_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_overrides"
    ADD CONSTRAINT "company_overrides_pkey" PRIMARY KEY ("user_id", "company_id");



ALTER TABLE ONLY "public"."company_reviews"
    ADD CONSTRAINT "company_reviews_pkey" PRIMARY KEY ("user_id", "company_id");



ALTER TABLE ONLY "public"."company_sources"
    ADD CONSTRAINT "company_sources_company_id_source_account_id_key" UNIQUE ("company_id", "source_account_id");



ALTER TABLE ONLY "public"."company_sources"
    ADD CONSTRAINT "company_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cover_letter_edits"
    ADD CONSTRAINT "cover_letter_edits_pkey" PRIMARY KEY ("user_id", "job_id");



ALTER TABLE ONLY "public"."discovery_runs"
    ADD CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discovery_state"
    ADD CONSTRAINT "discovery_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enumeration_members"
    ADD CONSTRAINT "enumeration_members_pkey" PRIMARY KEY ("enumeration_id", "external_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identity_assertions"
    ADD CONSTRAINT "identity_assertions_left_listing_id_right_listing_id_relati_key" UNIQUE ("left_listing_id", "right_listing_id", "relation");



ALTER TABLE ONLY "public"."identity_assertions"
    ADD CONSTRAINT "identity_assertions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_allowances"
    ADD CONSTRAINT "invite_allowances_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."invite_redemptions"
    ADD CONSTRAINT "invite_redemptions_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."job_locations"
    ADD CONSTRAINT "job_locations_job_version_id_location_id_key" UNIQUE ("job_version_id", "location_id");



ALTER TABLE ONLY "public"."job_locations"
    ADD CONSTRAINT "job_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payload_demands"
    ADD CONSTRAINT "job_payload_demands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_questions"
    ADD CONSTRAINT "job_questions_pkey" PRIMARY KEY ("job_id");



ALTER TABLE ONLY "public"."job_reviews"
    ADD CONSTRAINT "job_reviews_pkey" PRIMARY KEY ("user_id", "job_id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_job_version_id_skill_id_key" UNIQUE ("job_version_id", "skill_id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_id_job_id_key" UNIQUE ("id", "job_id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_id_source_listing_id_key" UNIQUE ("id", "source_listing_id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_source_listing_id_revision_key" UNIQUE ("source_listing_id", "revision");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifecycle_backfill_readiness"
    ADD CONSTRAINT "lifecycle_backfill_readiness_pkey" PRIMARY KEY ("singleton");



ALTER TABLE ONLY "public"."lifecycle_claims"
    ADD CONSTRAINT "lifecycle_claims_owner_token_key" UNIQUE ("owner_token");



ALTER TABLE ONLY "public"."lifecycle_claims"
    ADD CONSTRAINT "lifecycle_claims_pkey" PRIMARY KEY ("kind", "work_id");



ALTER TABLE ONLY "public"."lifecycle_control"
    ADD CONSTRAINT "lifecycle_control_pkey" PRIMARY KEY ("singleton");



ALTER TABLE ONLY "public"."lifecycle_identity_authorizations"
    ADD CONSTRAINT "lifecycle_identity_authorizations_pkey" PRIMARY KEY ("campaign_id");



ALTER TABLE ONLY "public"."lifecycle_identity_campaigns"
    ADD CONSTRAINT "lifecycle_identity_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifecycle_identity_generation"
    ADD CONSTRAINT "lifecycle_identity_generation_pkey" PRIMARY KEY ("singleton");



ALTER TABLE ONLY "public"."lifecycle_maintenance_state"
    ADD CONSTRAINT "lifecycle_maintenance_state_pkey" PRIMARY KEY ("singleton");



ALTER TABLE ONLY "public"."lifecycle_operational_listings"
    ADD CONSTRAINT "lifecycle_operational_listings_pkey" PRIMARY KEY ("listing_id");



ALTER TABLE ONLY "public"."lifecycle_operational_receipts"
    ADD CONSTRAINT "lifecycle_operational_receipts_pkey" PRIMARY KEY ("source_id");



ALTER TABLE ONLY "public"."lifecycle_operational_sources"
    ADD CONSTRAINT "lifecycle_operational_sources_pkey" PRIMARY KEY ("source_id");



ALTER TABLE ONLY "public"."lifecycle_staging_cleanup"
    ADD CONSTRAINT "lifecycle_staging_cleanup_pkey" PRIMARY KEY ("enumeration_id");



ALTER TABLE ONLY "public"."lifecycle_write_checks"
    ADD CONSTRAINT "lifecycle_write_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lifecycle_writer_readiness"
    ADD CONSTRAINT "lifecycle_writer_readiness_pkey" PRIMARY KEY ("writer");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("raw");



ALTER TABLE ONLY "public"."matching_activity"
    ADD CONSTRAINT "matching_activity_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."openrouter_usage_snapshots"
    ADD CONSTRAINT "openrouter_usage_snapshots_pkey" PRIMARY KEY ("taken_at");



ALTER TABLE ONLY "public"."plan_overrides"
    ADD CONSTRAINT "plan_overrides_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."poll_runs"
    ADD CONSTRAINT "poll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."public_archive_batch_markers"
    ADD CONSTRAINT "public_archive_batch_markers_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."public_archive_batches"
    ADD CONSTRAINT "public_archive_batches_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."public_archive_coverage"
    ADD CONSTRAINT "public_archive_coverage_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."public_archive_coverage"
    ADD CONSTRAINT "public_archive_coverage_pkey" PRIMARY KEY ("aggregate_type", "aggregate_id", "revision");



ALTER TABLE ONLY "public"."public_archive_destination"
    ADD CONSTRAINT "public_archive_destination_pkey" PRIMARY KEY ("singleton");



ALTER TABLE ONLY "public"."public_archive_heads"
    ADD CONSTRAINT "public_archive_heads_pkey" PRIMARY KEY ("aggregate_type", "aggregate_id");



ALTER TABLE ONLY "public"."public_archive_items"
    ADD CONSTRAINT "public_archive_items_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."public_archive_items"
    ADD CONSTRAINT "public_archive_items_pkey" PRIMARY KEY ("batch_id", "position");



ALTER TABLE ONLY "public"."public_archive_quarantine"
    ADD CONSTRAINT "public_archive_quarantine_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."public_archive_receipts"
    ADD CONSTRAINT "public_archive_receipts_pkey" PRIMARY KEY ("batch_id");



ALTER TABLE ONLY "public"."public_archive_recovery_authorizations"
    ADD CONSTRAINT "public_archive_recovery_authorizations_pkey" PRIMARY KEY ("authorization_id");



ALTER TABLE ONLY "public"."public_archive_recovery_authorizations"
    ADD CONSTRAINT "public_archive_recovery_authorizations_replacement_batch_id_key" UNIQUE ("replacement_batch_id");



ALTER TABLE ONLY "public"."public_archive_supersessions"
    ADD CONSTRAINT "public_archive_supersessions_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "public"."public_archive_supersessions"
    ADD CONSTRAINT "public_archive_supersessions_new_batch_id_key" UNIQUE ("new_batch_id");



ALTER TABLE ONLY "public"."public_archive_supersessions"
    ADD CONSTRAINT "public_archive_supersessions_pkey" PRIMARY KEY ("old_batch_id");



ALTER TABLE ONLY "public"."public_archive_suppressions"
    ADD CONSTRAINT "public_archive_suppressions_pkey" PRIMARY KEY ("aggregate_type", "aggregate_id");



ALTER TABLE ONLY "public"."public_archive_version_coverage"
    ADD CONSTRAINT "public_archive_version_coverage_pkey" PRIMARY KEY ("version_id");



ALTER TABLE ONLY "public"."public_change_requirements"
    ADD CONSTRAINT "public_change_requirements_aggregate_type_aggregate_id_revi_key" UNIQUE ("aggregate_type", "aggregate_id", "revision");



ALTER TABLE ONLY "public"."public_change_requirements"
    ADD CONSTRAINT "public_change_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_critical_event_slots"
    ADD CONSTRAINT "public_critical_event_slots_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."public_critical_event_slots"
    ADD CONSTRAINT "public_critical_event_slots_pkey" PRIMARY KEY ("slot");



ALTER TABLE ONLY "public"."public_outbox"
    ADD CONSTRAINT "public_outbox_aggregate_type_aggregate_id_revision_key" UNIQUE ("aggregate_type", "aggregate_id", "revision");



ALTER TABLE ONLY "public"."public_outbox"
    ADD CONSTRAINT "public_outbox_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."public_outbox"
    ADD CONSTRAINT "public_outbox_requirement_id_key" UNIQUE ("requirement_id");



ALTER TABLE ONLY "public"."reconciliation_checkpoints"
    ADD CONSTRAINT "reconciliation_checkpoints_pkey" PRIMARY KEY ("enumeration_id");



ALTER TABLE ONLY "public"."resume_scores"
    ADD CONSTRAINT "resume_scores_pkey" PRIMARY KEY ("user_id", "job_id");



ALTER TABLE ONLY "public"."review_corrections"
    ADD CONSTRAINT "review_corrections_pkey" PRIMARY KEY ("user_id", "job_id");



ALTER TABLE ONLY "public"."review_requests"
    ADD CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_runs"
    ADD CONSTRAINT "review_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("filename");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_canonical_name_key" UNIQUE ("canonical_name");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_accounts"
    ADD CONSTRAINT "source_accounts_ats_public_board_ref_key" UNIQUE ("ats", "public_board_ref");



ALTER TABLE ONLY "public"."source_accounts"
    ADD CONSTRAINT "source_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_enumerations"
    ADD CONSTRAINT "source_enumerations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_enumerations"
    ADD CONSTRAINT "source_enumerations_source_id_sequence_key" UNIQUE ("source_id", "sequence");



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_id_job_id_key" UNIQUE ("id", "job_id");



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_source_account_id_external_id_key" UNIQUE ("source_account_id", "external_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."tier_settings"
    ADD CONSTRAINT "tier_settings_pkey" PRIMARY KEY ("plan");



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("user_id", "day", "kind");



CREATE INDEX "feedback_user_created_idx" ON "public"."feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_application_packages_job" ON "public"."application_packages" USING "btree" ("job_id");



CREATE INDEX "idx_application_packages_version" ON "public"."application_packages" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_capacity_claim" ON "public"."capacity_reservations" USING "btree" ("claim_kind", "claim_id", "generation");



CREATE INDEX "idx_capacity_held" ON "public"."capacity_reservations" USING "btree" ("state") INCLUDE ("bytes");



CREATE INDEX "idx_capacity_terminal" ON "public"."capacity_reservations" USING "btree" ("terminal_at") WHERE ("terminal_at" IS NOT NULL);



CREATE INDEX "idx_checkpoints_completed" ON "public"."reconciliation_checkpoints" USING "btree" ("completed_at") WHERE ("completed_at" IS NOT NULL);



CREATE INDEX "idx_company_brands_right" ON "public"."company_brands" USING "btree" ("brand_id");



CREATE INDEX "idx_company_overrides_company" ON "public"."company_overrides" USING "btree" ("company_id");



CREATE INDEX "idx_company_reviews_user_verdict" ON "public"."company_reviews" USING "btree" ("user_id", "verdict");



CREATE INDEX "idx_company_reviews_user_version" ON "public"."company_reviews" USING "btree" ("user_id", "company_profile_version");



CREATE INDEX "idx_company_sources_right" ON "public"."company_sources" USING "btree" ("source_account_id");



CREATE INDEX "idx_cover_letter_edits_job" ON "public"."cover_letter_edits" USING "btree" ("job_id");



CREATE INDEX "idx_cover_letter_edits_user" ON "public"."cover_letter_edits" USING "btree" ("user_id");



CREATE INDEX "idx_cover_letter_edits_version" ON "public"."cover_letter_edits" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_discovery_runs_started_at" ON "public"."discovery_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_enumerations_pending_reconciliation" ON "public"."source_enumerations" USING "btree" ("source_id", "sequence") WHERE (("status" = 'complete'::"text") AND ("reconciled_at" IS NULL));



CREATE INDEX "idx_enumerations_recovery" ON "public"."source_enumerations" USING "btree" ("status", "started_at");



CREATE INDEX "idx_enumerations_terminal" ON "public"."source_enumerations" USING "btree" ("terminal_at") WHERE ("terminal_at" IS NOT NULL);



CREATE INDEX "idx_generation_jobs_job" ON "public"."generation_jobs" USING "btree" ("job_id");



CREATE INDEX "idx_generation_jobs_user" ON "public"."generation_jobs" USING "btree" ("user_id", "status");



CREATE INDEX "idx_generation_jobs_version" ON "public"."generation_jobs" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_identity_assertions_right" ON "public"."identity_assertions" USING "btree" ("right_listing_id");



CREATE INDEX "idx_invite_codes_created_by" ON "public"."invite_codes" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_job_locations_right" ON "public"."job_locations" USING "btree" ("location_id");



CREATE INDEX "idx_job_payload_demands_job" ON "public"."job_payload_demands" USING "btree" ("job_id", "status");



CREATE INDEX "idx_job_payload_demands_owner" ON "public"."job_payload_demands" USING "btree" ("user_id", "status");



CREATE INDEX "idx_job_payload_demands_terminal" ON "public"."job_payload_demands" USING "btree" ("settled_at") WHERE ("settled_at" IS NOT NULL);



CREATE INDEX "idx_job_payload_demands_version" ON "public"."job_payload_demands" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_job_questions_version" ON "public"."job_questions" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_job_reviews_job" ON "public"."job_reviews" USING "btree" ("job_id");



CREATE INDEX "idx_job_reviews_user_profile_version" ON "public"."job_reviews" USING "btree" ("user_id", "profile_version");



CREATE INDEX "idx_job_reviews_user_verdict" ON "public"."job_reviews" USING "btree" ("user_id", "verdict");



CREATE INDEX "idx_job_reviews_version" ON "public"."job_reviews" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_job_skills_right" ON "public"."job_skills" USING "btree" ("skill_id");



CREATE INDEX "idx_job_versions_job" ON "public"."job_versions" USING "btree" ("job_id");



CREATE INDEX "idx_job_versions_recorded" ON "public"."job_versions" USING "btree" ("recorded_at", "id");



CREATE INDEX "idx_jobs_closed_at" ON "public"."jobs" USING "btree" ("closed_at");



CREATE INDEX "idx_jobs_company_open" ON "public"."jobs" USING "btree" ("company_id") WHERE ("closed_at" IS NULL);



CREATE INDEX "idx_jobs_description_version" ON "public"."jobs" USING "btree" ("description_version_id") WHERE ("description_version_id" IS NOT NULL);



CREATE INDEX "idx_jobs_first_seen" ON "public"."jobs" USING "btree" ("first_seen_at" DESC);



CREATE INDEX "idx_jobs_location_canonicals" ON "public"."jobs" USING "gin" ("location_canonicals");



CREATE INDEX "idx_jobs_open" ON "public"."jobs" USING "btree" ("closed_at") WHERE ("closed_at" IS NULL);



CREATE INDEX "idx_lifecycle_claims_recovery" ON "public"."lifecycle_claims" USING "btree" ("state", "lease_until");



CREATE INDEX "idx_lifecycle_claims_terminal" ON "public"."lifecycle_claims" USING "btree" ("terminal_at") WHERE ("terminal_at" IS NOT NULL);



CREATE INDEX "idx_poll_runs_started_at" ON "public"."poll_runs" USING "btree" ("started_at" DESC);



CREATE UNIQUE INDEX "idx_public_archive_recovery_one_consumption" ON "public"."public_archive_recovery_authorizations" USING "btree" ("batch_id") WHERE ("consumed_at" IS NOT NULL);



CREATE INDEX "idx_public_outbox_pending" ON "public"."public_outbox" USING "btree" ("recorded_at", "event_id");



CREATE INDEX "idx_resume_scores_user" ON "public"."resume_scores" USING "btree" ("user_id");



CREATE INDEX "idx_resume_scores_version" ON "public"."resume_scores" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_review_corrections_job" ON "public"."review_corrections" USING "btree" ("job_id");



CREATE INDEX "idx_review_corrections_version" ON "public"."review_corrections" USING "btree" ("job_version_id") WHERE ("job_version_id" IS NOT NULL);



CREATE INDEX "idx_review_requests_pending" ON "public"."review_requests" USING "btree" ("requested_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_review_runs_started_at" ON "public"."review_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_source_accounts_due" ON "public"."source_accounts" USING "btree" ("next_due_at", "last_complete_success_at", "id");



CREATE INDEX "idx_source_accounts_legacy" ON "public"."source_accounts" USING "btree" ("legacy_company_id");



CREATE INDEX "idx_source_listings_expiry" ON "public"."source_listings" USING "btree" ("discovery_expires_at", "id");



CREATE INDEX "idx_source_listings_job" ON "public"."source_listings" USING "btree" ("job_id");



CREATE INDEX "idx_source_listings_source_availability" ON "public"."source_listings" USING "btree" ("source_account_id", "source_availability", "id");



CREATE INDEX "idx_write_checks_terminal" ON "public"."lifecycle_write_checks" USING "btree" ("created_at");



CREATE INDEX "idx_write_checks_transaction" ON "public"."lifecycle_write_checks" USING "btree" ("transaction_id", "backend_pid");



CREATE UNIQUE INDEX "one_active_payload_demand" ON "public"."job_payload_demands" USING "btree" ("user_id", "job_id", "kind") WHERE ("status" = ANY (ARRAY['pending'::"text", 'running'::"text"]));



CREATE UNIQUE INDEX "one_active_review_request" ON "public"."review_requests" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'running'::"text"]));



CREATE UNIQUE INDEX "one_pending_generation" ON "public"."generation_jobs" USING "btree" ("user_id", "job_id", "kind") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "one_running_identity_campaign" ON "public"."lifecycle_identity_campaigns" USING "btree" ("state") WHERE ("state" = 'running'::"text");



CREATE INDEX "operational_listing_source" ON "public"."lifecycle_operational_listings" USING "btree" ("source_id", "listing_id");



CREATE OR REPLACE TRIGGER "a_check_totals" BEFORE INSERT ON "public"."lifecycle_write_checks" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_check_totals"();



CREATE OR REPLACE TRIGGER "a_outbox_contract" BEFORE INSERT ON "public"."public_outbox" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_outbox_insert"();



CREATE OR REPLACE TRIGGER "applied_delete_matching_activity" AFTER DELETE ON "public"."application_packages" FOR EACH ROW WHEN (("old"."status" = 'applied'::"text")) EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "applied_insert_matching_activity" AFTER INSERT ON "public"."application_packages" FOR EACH ROW WHEN (("new"."status" = 'applied'::"text")) EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "applied_update_matching_activity" AFTER UPDATE OF "status" ON "public"."application_packages" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") AND (("old"."status" = 'applied'::"text") OR ("new"."status" = 'applied'::"text")))) EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "archive_authorization_consume" BEFORE DELETE OR UPDATE ON "public"."public_archive_recovery_authorizations" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."consume_archive_authorization"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_batch_markers" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_batches" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_coverage" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_items" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_receipts" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_supersessions" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_suppressions" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_archive_version_coverage" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_change_requirements" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_immutable" BEFORE DELETE OR UPDATE ON "public"."public_outbox" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_item_insert" BEFORE INSERT ON "public"."public_archive_items" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_archive_item"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_batch_markers" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_batches" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_coverage" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_heads" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_items" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_recovery_authorizations" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."consume_archive_authorization"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_supersessions" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_suppressions" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_archive_version_coverage" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_change_requirements" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_no_truncate" BEFORE TRUNCATE ON "public"."public_outbox" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_archive_row"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_brands" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_sources" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."identity_assertions" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."job_locations" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."job_skills" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."job_versions" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."skills" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."source_accounts" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "archive_public_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."source_listings" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."require_public_change"();



CREATE OR REPLACE TRIGGER "b_validate_write" BEFORE INSERT ON "public"."lifecycle_write_checks" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_write"();



CREATE OR REPLACE TRIGGER "claim_integrity" BEFORE DELETE OR UPDATE ON "public"."lifecycle_claims" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_claim_integrity"();



CREATE OR REPLACE TRIGGER "company_override_matching_activity" AFTER INSERT OR UPDATE ON "public"."company_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "correction_matching_activity" AFTER INSERT ON "public"."review_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "critical_slot_integrity" BEFORE DELETE OR UPDATE ON "public"."public_critical_event_slots" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."preserve_operational_slot"();



CREATE OR REPLACE TRIGGER "critical_slot_no_truncate" BEFORE TRUNCATE ON "public"."public_critical_event_slots" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."preserve_operational_slot"();



CREATE OR REPLACE TRIGGER "initialize_matching_activity" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "lifecycle_consumption_stamp" BEFORE UPDATE OF "consumed_at" ON "public"."job_payload_demands" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_stamp_consumption"();



CREATE OR REPLACE TRIGGER "lifecycle_control_history" BEFORE DELETE OR UPDATE ON "public"."lifecycle_control" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_lifecycle_control"();



CREATE OR REPLACE TRIGGER "lifecycle_control_no_truncate" BEFORE TRUNCATE ON "public"."lifecycle_control" FOR EACH STATEMENT EXECUTE FUNCTION "public"."preserve_lifecycle_control"();



CREATE OR REPLACE TRIGGER "lifecycle_demand_removal" BEFORE DELETE ON "public"."job_payload_demands" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."protect_demand_claim"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_identity_authorizations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_identity_campaigns" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_operational_listings" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_operational_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_operational_sources" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_batch_markers" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_batches" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_coverage" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_destination" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_heads" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_items" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_quarantine" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_recovery_authorizations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_supersessions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_suppressions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_archive_version_coverage" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_change_requirements" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_critical_event_slots" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_gate" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."public_outbox" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE CONSTRAINT TRIGGER "lifecycle_identity_authorized_commit" AFTER UPDATE ON "public"."lifecycle_identity_campaigns" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_identity_check_authorization"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."account_deletions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."application_packages" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."brands" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."capacity_reservations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."classification_jobs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."companies" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."company_brands" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."company_overrides" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."company_reviews" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."company_sources" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."cover_letter_edits" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."enumeration_members" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."feedback" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."generation_jobs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."identity_assertions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."invite_allowances" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."invite_codes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."invite_redemptions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_locations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_payload_demands" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_questions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_reviews" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_skills" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."job_versions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."jobs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_claims" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_control" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_maintenance_state" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_staging_cleanup" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."lifecycle_write_checks" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."locations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."matching_activity" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."plan_overrides" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."profiles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."reconciliation_checkpoints" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."resume_scores" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."review_corrections" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."review_requests" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."review_runs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."skills" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."source_accounts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."source_enumerations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."source_listings" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."subscriptions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_pre_dml" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."usage_counters" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_gate"();



CREATE OR REPLACE TRIGGER "lifecycle_source_floor" BEFORE UPDATE ON "public"."source_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_staging_fence"();



CREATE OR REPLACE TRIGGER "lifecycle_staging_claim" BEFORE INSERT OR UPDATE ON "public"."enumeration_members" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_staging_fence"();



CREATE OR REPLACE TRIGGER "lifecycle_staging_claim" BEFORE INSERT OR UPDATE ON "public"."reconciliation_checkpoints" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_staging_fence"();



CREATE OR REPLACE TRIGGER "lifecycle_staging_claim" BEFORE INSERT OR UPDATE ON "public"."source_enumerations" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_staging_fence"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."application_packages" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."company_brands" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."company_sources" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."cover_letter_edits" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."enumeration_members" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."generation_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."identity_assertions" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_locations" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_payload_demands" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_questions" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_skills" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_versions" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT ON "public"."public_outbox" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."reconciliation_checkpoints" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."resume_scores" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."review_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."skills" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."source_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."source_enumerations" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "lifecycle_validate" BEFORE INSERT OR DELETE OR UPDATE ON "public"."source_listings" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_validate_row"();



CREATE OR REPLACE TRIGGER "maintenance_cutover" AFTER UPDATE ON "public"."lifecycle_control" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_maintenance_cutover"();



CREATE OR REPLACE TRIGGER "maintenance_history" BEFORE DELETE OR UPDATE ON "public"."lifecycle_maintenance_state" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_maintenance_cutover"();



CREATE OR REPLACE TRIGGER "maintenance_history_truncate" BEFORE TRUNCATE ON "public"."lifecycle_maintenance_state" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_maintenance_cutover"();



CREATE OR REPLACE TRIGGER "maintenance_no_job_delete" BEFORE DELETE OR TRUNCATE ON "public"."jobs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_maintenance_cutover"();



CREATE CONSTRAINT TRIGGER "operational_commit_receipt" AFTER UPDATE ON "public"."lifecycle_operational_receipts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_operational_receipt"();



CREATE OR REPLACE TRIGGER "operational_state_integrity" BEFORE DELETE OR UPDATE ON "public"."lifecycle_operational_listings" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_operational_state"();



CREATE OR REPLACE TRIGGER "operational_state_integrity" BEFORE DELETE OR UPDATE ON "public"."lifecycle_operational_sources" FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_operational_state"();



CREATE OR REPLACE TRIGGER "operational_state_no_truncate" BEFORE TRUNCATE ON "public"."lifecycle_operational_listings" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."validate_operational_state"();



CREATE OR REPLACE TRIGGER "operational_state_no_truncate" BEFORE TRUNCATE ON "public"."lifecycle_operational_sources" FOR EACH STATEMENT EXECUTE FUNCTION "lifecycle_private"."validate_operational_state"();



CREATE OR REPLACE TRIGGER "profile_matching_activity" AFTER UPDATE OF "resume_text", "instructions", "preferred_locations", "company_exclusions", "company_instructions", "full_name", "email", "phone", "links", "location", "screening_answers", "resume_generation_instructions", "cover_letter_generation_instructions" ON "public"."profiles" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE CONSTRAINT TRIGGER "public_pair" AFTER INSERT ON "public"."public_change_requirements" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_public_pair"();



CREATE OR REPLACE TRIGGER "reject_insert_matching_activity" AFTER INSERT ON "public"."job_reviews" FOR EACH ROW WHEN ("new"."human_override") EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "reject_update_matching_activity" AFTER UPDATE OF "human_override", "verdict" ON "public"."job_reviews" FOR EACH ROW WHEN ((("old"."human_override" OR "new"."human_override") AND ("old".* IS DISTINCT FROM "new".*))) EXECUTE FUNCTION "public"."track_matching_activity"();



CREATE OR REPLACE TRIGGER "reservation_integrity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capacity_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."lifecycle_reservation_integrity"();



CREATE CONSTRAINT TRIGGER "z_validate_commit" AFTER INSERT ON "public"."lifecycle_write_checks" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "lifecycle_private"."validate_write"();



CREATE OR REPLACE TRIGGER "zz_lifecycle_identity_mutated" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."companies" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_identity_mutated"();



CREATE OR REPLACE TRIGGER "zz_lifecycle_identity_mutated" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."jobs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_identity_mutated"();



CREATE OR REPLACE TRIGGER "zz_lifecycle_identity_mutated" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."source_accounts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_identity_mutated"();



CREATE OR REPLACE TRIGGER "zz_lifecycle_identity_mutated" BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON "public"."source_listings" FOR EACH STATEMENT EXECUTE FUNCTION "public"."lifecycle_identity_mutated"();



ALTER TABLE ONLY "public"."application_packages"
    ADD CONSTRAINT "application_packages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_packages"
    ADD CONSTRAINT "application_packages_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."capacity_reservations"
    ADD CONSTRAINT "capacity_reservations_claim_kind_claim_id_fkey" FOREIGN KEY ("claim_kind", "claim_id") REFERENCES "public"."lifecycle_claims"("kind", "work_id");



ALTER TABLE ONLY "public"."company_brands"
    ADD CONSTRAINT "company_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."company_brands"
    ADD CONSTRAINT "company_brands_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_overrides"
    ADD CONSTRAINT "company_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_reviews"
    ADD CONSTRAINT "company_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_sources"
    ADD CONSTRAINT "company_sources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_sources"
    ADD CONSTRAINT "company_sources_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE ONLY "public"."cover_letter_edits"
    ADD CONSTRAINT "cover_letter_edits_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cover_letter_edits"
    ADD CONSTRAINT "cover_letter_edits_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."enumeration_members"
    ADD CONSTRAINT "enumeration_members_enumeration_id_fkey" FOREIGN KEY ("enumeration_id") REFERENCES "public"."source_enumerations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."identity_assertions"
    ADD CONSTRAINT "identity_assertions_left_listing_id_fkey" FOREIGN KEY ("left_listing_id") REFERENCES "public"."source_listings"("id");



ALTER TABLE ONLY "public"."identity_assertions"
    ADD CONSTRAINT "identity_assertions_right_listing_id_fkey" FOREIGN KEY ("right_listing_id") REFERENCES "public"."source_listings"("id");



ALTER TABLE ONLY "public"."invite_redemptions"
    ADD CONSTRAINT "invite_redemptions_code_fkey" FOREIGN KEY ("code") REFERENCES "public"."invite_codes"("code");



ALTER TABLE ONLY "public"."job_locations"
    ADD CONSTRAINT "job_locations_job_version_id_fkey" FOREIGN KEY ("job_version_id") REFERENCES "public"."job_versions"("id");



ALTER TABLE ONLY "public"."job_locations"
    ADD CONSTRAINT "job_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("raw");



ALTER TABLE ONLY "public"."job_payload_demands"
    ADD CONSTRAINT "job_payload_demands_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_payload_demands"
    ADD CONSTRAINT "job_payload_demands_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."job_questions"
    ADD CONSTRAINT "job_questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_questions"
    ADD CONSTRAINT "job_questions_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."job_reviews"
    ADD CONSTRAINT "job_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reviews"
    ADD CONSTRAINT "job_reviews_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_job_version_id_fkey" FOREIGN KEY ("job_version_id") REFERENCES "public"."job_versions"("id");



ALTER TABLE ONLY "public"."job_skills"
    ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_versions"
    ADD CONSTRAINT "job_versions_source_listing_id_job_id_fkey" FOREIGN KEY ("source_listing_id", "job_id") REFERENCES "public"."source_listings"("id", "job_id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_description_version_fk" FOREIGN KEY ("description_version_id", "id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."lifecycle_identity_authorizations"
    ADD CONSTRAINT "lifecycle_identity_authorizations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."lifecycle_identity_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lifecycle_operational_listings"
    ADD CONSTRAINT "lifecycle_operational_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."source_listings"("id");



ALTER TABLE ONLY "public"."lifecycle_operational_listings"
    ADD CONSTRAINT "lifecycle_operational_listings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE ONLY "public"."lifecycle_operational_receipts"
    ADD CONSTRAINT "lifecycle_operational_receipts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE ONLY "public"."lifecycle_operational_sources"
    ADD CONSTRAINT "lifecycle_operational_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE ONLY "public"."lifecycle_staging_cleanup"
    ADD CONSTRAINT "lifecycle_staging_cleanup_enumeration_id_fkey" FOREIGN KEY ("enumeration_id") REFERENCES "public"."source_enumerations"("id");



ALTER TABLE ONLY "public"."matching_activity"
    ADD CONSTRAINT "matching_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_archive_coverage"
    ADD CONSTRAINT "public_archive_coverage_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."public_archive_batch_markers"("batch_id");



ALTER TABLE ONLY "public"."public_archive_items"
    ADD CONSTRAINT "public_archive_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."public_archive_batches"("batch_id");



ALTER TABLE ONLY "public"."public_archive_receipts"
    ADD CONSTRAINT "public_archive_receipts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."public_archive_batches"("batch_id");



ALTER TABLE ONLY "public"."public_archive_supersessions"
    ADD CONSTRAINT "public_archive_supersessions_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "public"."public_archive_recovery_authorizations"("authorization_id");



ALTER TABLE ONLY "public"."public_archive_version_coverage"
    ADD CONSTRAINT "public_archive_version_coverage_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."public_archive_batch_markers"("batch_id");



ALTER TABLE ONLY "public"."public_outbox"
    ADD CONSTRAINT "public_outbox_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."public_change_requirements"("id");



ALTER TABLE ONLY "public"."reconciliation_checkpoints"
    ADD CONSTRAINT "reconciliation_checkpoints_enumeration_id_fkey" FOREIGN KEY ("enumeration_id") REFERENCES "public"."source_enumerations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_scores"
    ADD CONSTRAINT "resume_scores_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_scores"
    ADD CONSTRAINT "resume_scores_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."review_corrections"
    ADD CONSTRAINT "review_corrections_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_corrections"
    ADD CONSTRAINT "review_corrections_version_job_fk" FOREIGN KEY ("job_version_id", "job_id") REFERENCES "public"."job_versions"("id", "job_id");



ALTER TABLE ONLY "public"."source_accounts"
    ADD CONSTRAINT "source_accounts_legacy_company_id_fkey" FOREIGN KEY ("legacy_company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."source_enumerations"
    ADD CONSTRAINT "source_enumerations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_current_version_fk" FOREIGN KEY ("current_version_id", "id") REFERENCES "public"."job_versions"("id", "source_listing_id");



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."source_listings"
    ADD CONSTRAINT "source_listings_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."source_accounts"("id");



ALTER TABLE "public"."account_deletions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capacity_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classification_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cover_letter_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discovery_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discovery_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enumeration_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_owner_read" ON "public"."feedback" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identity_assertions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_allowances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_payload_demands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_backfill_readiness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_control" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lifecycle_control_read" ON "public"."lifecycle_control" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lifecycle_identity_authorizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_identity_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_identity_generation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_maintenance_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_operational_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_operational_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_operational_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_staging_cleanup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_write_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lifecycle_writer_readiness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maintenance_cutover_read" ON "public"."lifecycle_maintenance_state" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."matching_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no_anon_access" ON "public"."account_deletions" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."app_settings" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."application_packages" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."classification_jobs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."companies" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."company_overrides" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."company_reviews" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."cover_letter_edits" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."discovery_runs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."discovery_state" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."generation_jobs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."invite_allowances" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."invite_codes" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."invite_redemptions" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."job_reviews" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."jobs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."openrouter_usage_snapshots" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."plan_overrides" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."poll_runs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."profiles" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."resume_scores" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."review_corrections" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."review_requests" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."review_runs" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."schema_migrations" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."subscriptions" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."tier_settings" USING (false) WITH CHECK (false);



CREATE POLICY "no_anon_access" ON "public"."usage_counters" USING (false) WITH CHECK (false);



ALTER TABLE "public"."openrouter_usage_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_access" ON "public"."application_packages" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."company_overrides" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."company_reviews" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."cover_letter_edits" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."generation_jobs" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."job_payload_demands" TO "authenticated" USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "owner_access" ON "public"."job_reviews" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."profiles" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."resume_scores" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."review_corrections" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_access" ON "public"."usage_counters" TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_insert" ON "public"."review_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_or_legacy_read" ON "public"."review_runs" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")) OR ("user_id" IS NULL)));



CREATE POLICY "owner_read" ON "public"."invite_allowances" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_read" ON "public"."matching_activity" FOR SELECT TO "authenticated" USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "owner_read" ON "public"."plan_overrides" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_read" ON "public"."review_requests" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_read" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "public"."app_user_id"() AS "app_user_id")));



CREATE POLICY "owner_receipts" ON "public"."lifecycle_write_checks" TO "authenticated" USING (("subject_id" = "public"."app_user_id"())) WITH CHECK ((("subject_id" = "public"."app_user_id"()) AND ("invoking_role" = CURRENT_USER) AND ("backend_pid" = "pg_backend_pid"()) AND ("transaction_id" = "pg_current_xact_id"())));



ALTER TABLE "public"."plan_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_batch_markers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_coverage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_destination" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_heads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_quarantine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_recovery_authorizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_supersessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_suppressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_archive_version_coverage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_change_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_critical_event_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reconciliation_checkpoints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resume_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shared_read" ON "public"."app_settings" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."companies" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."discovery_runs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."discovery_state" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."job_questions" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."jobs" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."poll_runs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shared_read" ON "public"."tier_settings" FOR SELECT TO "anon", "authenticated" USING (true);



ALTER TABLE "public"."skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_enumerations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tier_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_counters" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "lifecycle_private"."archive_baseline_ready"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_budget_bytes"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_clock"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_destination_ready"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_live_bytes"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_processing_charge"("canonical" "bytea") FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."archive_row_charge"("body" "jsonb", "canonical" "bytea", "overhead" integer) FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."consume_archive_authorization"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."edge_compaction_ready"("t" "text", "edge_id" "uuid", "version_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."operational_receipt_valid"("sid" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."operational_update"("t" "text", "n" "jsonb", "o" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."preserve_archive_row"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."preserve_operational_slot"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."protect_demand_claim"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."public_projection"("t" "text", "n" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."release_ready"("generation" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."require_public_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_archive_item"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_operational_receipt"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_operational_state"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_outbox_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_public_pair"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "lifecycle_private"."validate_write"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."app_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_check_totals"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_check_totals"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_claim_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_claim_integrity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lifecycle_discovery_visible"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone, "p_include_older_live" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_forget_subject"("target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_forget_subject"("target" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_gate"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_gate"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_identity_check_authorization"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_identity_check_authorization"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_identity_mutated"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_identity_mutated"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lifecycle_job_state"("p_job_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lifecycle_job_visibility"("p_include_older_live" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lifecycle_listing_visibility"("p_include_older_live" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_maintenance_cutover"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_maintenance_cutover"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_reservation_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_reservation_integrity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lifecycle_source_closed"("p_job_id" "text", "p_legacy_closed_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_staging_fence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_staging_fence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_stamp_consumption"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_stamp_consumption"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lifecycle_validate_row"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lifecycle_validate_row"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."matching_paused"("uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."matching_paused"("uid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."matching_paused"("uid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."preserve_lifecycle_control"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preserve_lifecycle_control"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."resume_matching"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resume_matching"() TO "service_role";
GRANT ALL ON FUNCTION "public"."resume_matching"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_feedback"("p_kind" "text", "p_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_feedback"("p_kind" "text", "p_message" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_feedback"("p_kind" "text", "p_message" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."track_matching_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_matching_activity"() TO "service_role";


















GRANT ALL ON TABLE "public"."account_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."app_settings" TO "anon";
GRANT SELECT ON TABLE "public"."app_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."application_packages" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."application_packages" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."application_packages_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."application_packages_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."capacity_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."classification_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classification_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "service_role";
GRANT SELECT ON TABLE "public"."companies" TO "authenticated";
GRANT SELECT ON TABLE "public"."companies" TO "anon";



GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company_brands" TO "service_role";



GRANT ALL ON TABLE "public"."company_overrides" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_overrides" TO "authenticated";



GRANT ALL ON TABLE "public"."company_reviews" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."company_sources" TO "service_role";



GRANT ALL ON TABLE "public"."cover_letter_edits" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."cover_letter_edits" TO "authenticated";



GRANT ALL ON TABLE "public"."discovery_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."discovery_runs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."discovery_runs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."discovery_state" TO "service_role";
GRANT SELECT ON TABLE "public"."discovery_state" TO "authenticated";



GRANT ALL ON TABLE "public"."enumeration_members" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "service_role";
GRANT SELECT ON TABLE "public"."feedback" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."generation_jobs" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."generation_jobs" TO "authenticated";



GRANT ALL ON TABLE "public"."identity_assertions" TO "service_role";



GRANT ALL ON TABLE "public"."invite_allowances" TO "service_role";
GRANT SELECT ON TABLE "public"."invite_allowances" TO "authenticated";



GRANT ALL ON TABLE "public"."invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."invite_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."job_locations" TO "service_role";



GRANT ALL ON TABLE "public"."job_payload_demands" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."job_payload_demands" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."job_payload_demands" TO "authenticated";



GRANT INSERT("job_id") ON TABLE "public"."job_payload_demands" TO "authenticated";



GRANT INSERT("kind") ON TABLE "public"."job_payload_demands" TO "authenticated";



GRANT UPDATE("consumed_at") ON TABLE "public"."job_payload_demands" TO "authenticated";



GRANT ALL ON TABLE "public"."job_questions" TO "service_role";
GRANT SELECT ON TABLE "public"."job_questions" TO "anon";
GRANT SELECT ON TABLE "public"."job_questions" TO "authenticated";



GRANT ALL ON TABLE "public"."job_reviews" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_reviews" TO "authenticated";
GRANT SELECT ON TABLE "public"."job_reviews" TO "anon";



GRANT ALL ON TABLE "public"."job_skills" TO "service_role";



GRANT ALL ON TABLE "public"."job_versions" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "service_role";
GRANT SELECT ON TABLE "public"."jobs" TO "authenticated";
GRANT SELECT ON TABLE "public"."jobs" TO "anon";



GRANT ALL ON TABLE "public"."lifecycle_backfill_readiness" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_claims" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_control" TO "service_role";
GRANT SELECT ON TABLE "public"."lifecycle_control" TO "authenticated";



GRANT ALL ON TABLE "public"."lifecycle_identity_authorizations" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_identity_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_identity_generation" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_maintenance_state" TO "service_role";



GRANT SELECT("cutover_at") ON TABLE "public"."lifecycle_maintenance_state" TO "authenticated";



GRANT ALL ON TABLE "public"."lifecycle_operational_listings" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_operational_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_operational_sources" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_staging_cleanup" TO "service_role";



GRANT ALL ON TABLE "public"."lifecycle_write_checks" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."lifecycle_write_checks" TO "authenticated";



GRANT ALL ON TABLE "public"."lifecycle_writer_readiness" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."matching_activity" TO "service_role";
GRANT SELECT ON TABLE "public"."matching_activity" TO "authenticated";



GRANT ALL ON TABLE "public"."openrouter_usage_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."plan_overrides" TO "service_role";
GRANT SELECT ON TABLE "public"."plan_overrides" TO "authenticated";



GRANT ALL ON TABLE "public"."poll_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."poll_runs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."poll_runs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("resume_text"),UPDATE("resume_text") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("resume_file_path"),UPDATE("resume_file_path") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("instructions"),UPDATE("instructions") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("profile_version"),UPDATE("profile_version") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("model_stage1"),UPDATE("model_stage1") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("model_stage2"),UPDATE("model_stage2") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("preferred_locations"),UPDATE("preferred_locations") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("model_resume"),UPDATE("model_resume") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("company_instructions"),UPDATE("company_instructions") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("company_profile_version"),UPDATE("company_profile_version") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("model_company"),UPDATE("model_company") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("board_filters"),UPDATE("board_filters") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("links"),UPDATE("links") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("location"),UPDATE("location") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("work_authorized"),UPDATE("work_authorized") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("needs_sponsorship"),UPDATE("needs_sponsorship") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("eeo_gender"),UPDATE("eeo_gender") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("eeo_race"),UPDATE("eeo_race") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("eeo_veteran"),UPDATE("eeo_veteran") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("eeo_disability"),UPDATE("eeo_disability") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("screening_answers"),UPDATE("screening_answers") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("model_cover"),UPDATE("model_cover") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("reasoning_effort_resume"),UPDATE("reasoning_effort_resume") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("reasoning_effort_cover"),UPDATE("reasoning_effort_cover") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("resume_generation_instructions"),UPDATE("resume_generation_instructions") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("cover_letter_generation_instructions"),UPDATE("cover_letter_generation_instructions") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("company_exclusions"),UPDATE("company_exclusions") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."public_archive_batch_markers" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_batches" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_coverage" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_destination" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_heads" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_items" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_quarantine" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_recovery_authorizations" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_supersessions" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_suppressions" TO "service_role";



GRANT ALL ON TABLE "public"."public_archive_version_coverage" TO "service_role";



GRANT ALL ON TABLE "public"."public_change_requirements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."public_change_requirements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."public_critical_event_slots" TO "service_role";



GRANT ALL ON TABLE "public"."public_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."public_pending_events" TO "service_role";



GRANT ALL ON TABLE "public"."reconciliation_checkpoints" TO "service_role";



GRANT ALL ON TABLE "public"."resume_scores" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."resume_scores" TO "authenticated";



GRANT ALL ON TABLE "public"."review_corrections" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."review_corrections" TO "authenticated";
GRANT SELECT ON TABLE "public"."review_corrections" TO "anon";



GRANT ALL ON TABLE "public"."review_requests" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."review_requests" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."review_requests_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "public"."review_requests_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."review_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."review_runs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."review_runs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."source_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."source_enumerations" TO "service_role";



GRANT ALL ON TABLE "public"."source_listings" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";
GRANT SELECT ON TABLE "public"."subscriptions" TO "authenticated";



GRANT ALL ON TABLE "public"."tier_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."tier_settings" TO "anon";
GRANT SELECT ON TABLE "public"."tier_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."usage_counters" TO "service_role";
GRANT SELECT ON TABLE "public"."usage_counters" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































