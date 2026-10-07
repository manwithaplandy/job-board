-- Task10: transactional public projections, exact membership and durable receipts.
-- Defaults and destination/readiness guards remain unchanged: no activation here.
CREATE TABLE IF NOT EXISTS public_archive_heads (
 aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 PRIMARY KEY(aggregate_type,aggregate_id)
);
CREATE TABLE IF NOT EXISTS public_change_requirements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL,
 kind text NOT NULL CHECK(kind IN ('baseline','upsert','closed','reopened','removed')),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8192),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(aggregate_type,aggregate_id,revision)
);
CREATE TABLE IF NOT EXISTS public_outbox (
 event_id uuid PRIMARY KEY,
 requirement_id bigint NOT NULL UNIQUE REFERENCES public_change_requirements(id),
 aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 predecessor_id uuid, kind text NOT NULL,
 body jsonb NOT NULL, occurred_at timestamptz NOT NULL,
 canonical_event bytea NOT NULL CHECK(octet_length(canonical_event)<=12288),
 body_bytes integer NOT NULL CHECK(body_bytes BETWEEN 1 AND 8192),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(aggregate_type,aggregate_id,revision)
);
CREATE INDEX IF NOT EXISTS idx_public_outbox_pending ON public_outbox(recorded_at,event_id);
CREATE TABLE IF NOT EXISTS public_archive_batches (
 batch_id uuid PRIMARY KEY, owner_token text NOT NULL,generation bigint NOT NULL,
 serializer_version integer NOT NULL CHECK(serializer_version=1),
 state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','sealed','acked')),
 sealed_at timestamptz NOT NULL,eligible_until timestamptz NOT NULL,
 prior_batch_id uuid REFERENCES public_archive_batches(batch_id),
 data_key text,manifest_key text,canonical_hash text,compressed_hash text,manifest_hash text,
 event_count integer NOT NULL CHECK(event_count BETWEEN 1 AND 2000),
 expanded_bytes integer NOT NULL CHECK(expanded_bytes BETWEEN 1 AND 8388608),
 compressed_bytes integer,manifest_bytes integer,acked_at timestamptz,
 CHECK(eligible_until=sealed_at+interval '17520 hours'),
 CHECK(state='claimed' OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
 AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
 AND manifest_bytes BETWEEN 1 AND 1048576))
);
CREATE TABLE IF NOT EXISTS public_archive_items (
 batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),position integer NOT NULL,
 event_id uuid NOT NULL UNIQUE,aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
 canonical_event bytea NOT NULL,
 PRIMARY KEY(batch_id,position),CHECK(position BETWEEN 0 AND 1999)
);
CREATE TABLE IF NOT EXISTS public_archive_receipts (
 batch_id uuid PRIMARY KEY REFERENCES public_archive_batches(batch_id),
 data_receipt jsonb NOT NULL,manifest_receipt jsonb NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public_archive_coverage (
 aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
 event_id uuid NOT NULL UNIQUE,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(aggregate_type,aggregate_id,revision)
);
CREATE TABLE IF NOT EXISTS public_archive_suppressions (
 aggregate_type text NOT NULL,aggregate_id text NOT NULL,suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id)
);
CREATE TABLE IF NOT EXISTS public_archive_version_coverage (
 version_id uuid PRIMARY KEY,source_listing_id uuid NOT NULL,version_revision bigint NOT NULL,
 content_hash text NOT NULL,event_id uuid NOT NULL,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION lifecycle_private.public_projection(t text,n jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_private.public_projection(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text;
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
 INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
 ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
 k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
  ELSE 'upsert' END;
 INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
 VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.require_public_change() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at) THEN
  RAISE EXCEPTION 'public change requires exact transactional outbox event';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.validate_public_pair() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS public_pair ON public_change_requirements;
CREATE CONSTRAINT TRIGGER public_pair AFTER INSERT ON public_change_requirements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_public_pair();
CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
 IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'immutable pending membership';
 END IF;
 IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
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
REVOKE ALL ON FUNCTION lifecycle_private.preserve_archive_row() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public_archive_heads','public_change_requirements','public_outbox','public_archive_batches','public_archive_items','public_archive_receipts','public_archive_coverage','public_archive_suppressions','public_archive_version_coverage'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
  IF t<>'public_archive_heads' THEN
   EXECUTE format('DROP TRIGGER IF EXISTS archive_immutable ON public.%I',t);
   EXECUTE format('CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
  END IF;
  EXECUTE format('DROP TRIGGER IF EXISTS archive_no_truncate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS archive_public_change ON public.%I',t);
  EXECUTE format('CREATE TRIGGER archive_public_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.require_public_change()',t);
 END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public_change_requirements_id_seq FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
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

REVOKE ALL ON FUNCTION lifecycle_validate_row() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-03-04-public-outbox.sql') ON CONFLICT DO NOTHING;
-- R6-4: provision below the physical guard, then reuse only fixed operational rows.
CREATE TABLE IF NOT EXISTS lifecycle_operational_sources (
 source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
 sequence bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'idle'
 CHECK(status IN ('idle','running','complete','partial','failed')),
 started_at timestamptz,completed_at timestamptz,last_turn_at timestamptz,cursor uuid,reconciled boolean NOT NULL DEFAULT true,
 members_seen bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lifecycle_operational_listings (
 listing_id uuid PRIMARY KEY REFERENCES source_listings(id),source_id uuid NOT NULL REFERENCES source_accounts(id),
 seen_sequence bigint NOT NULL DEFAULT 0,seen_at timestamptz,seen_kind text,
 miss_sequence bigint NOT NULL DEFAULT 0,miss_count integer NOT NULL DEFAULT 0 CHECK(miss_count BETWEEN 0 AND 2),
 first_miss_at timestamptz,
 CHECK(seen_kind IS NULL OR seen_kind IN ('seen','unlisted','removed','expired'))
);
CREATE INDEX IF NOT EXISTS operational_listing_source ON lifecycle_operational_listings(source_id,listing_id);
CREATE TABLE IF NOT EXISTS lifecycle_operational_receipts (
 source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
 backend_pid integer,transaction_id xid8,owner_token text,generation bigint,invoking_role name,subject_id uuid,
 row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 500)
);
CREATE TABLE IF NOT EXISTS public_critical_event_slots (
 slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 12500),
 state text NOT NULL DEFAULT 'free' CHECK(state IN ('free','allocated','pending','acked')),
 transaction_id xid8,source_id uuid,aggregate_type text,aggregate_id text,revision bigint,
 event_id uuid UNIQUE,predecessor_id uuid,kind text,body jsonb,occurred_at timestamptz,
 canonical_event bytea,recorded_at timestamptz,
 padding bytea NOT NULL DEFAULT decode(repeat('00',24576),'hex'),
 CHECK(body IS NULL OR octet_length(body::text)<=8192),
 CHECK(canonical_event IS NULL OR octet_length(canonical_event)<=12288),
 CHECK(state='free' OR (aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL AND revision IS NOT NULL)),
 CHECK(state NOT IN ('pending','acked') OR (event_id IS NOT NULL AND canonical_event IS NOT NULL))
);
ALTER TABLE public_critical_event_slots ALTER COLUMN padding SET STORAGE EXTERNAL;
CREATE OR REPLACE VIEW public_pending_events AS
 SELECT event_id,requirement_id,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
 canonical_event,body_bytes,recorded_at FROM public_outbox
 UNION ALL
 SELECT event_id,NULL::bigint,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
 canonical_event,octet_length(body::text),recorded_at FROM public_critical_event_slots WHERE state='pending';
REVOKE ALL ON public_pending_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.operational_receipt_valid(sid uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
 ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
 WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
 AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
 AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
 AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
$$;
REVOKE ALL ON FUNCTION lifecycle_private.operational_receipt_valid(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE sid uuid; fields text[];
BEGIN
 IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak'];
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
REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_receipt() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
 IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
 IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_receipt() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS operational_commit_receipt ON lifecycle_operational_receipts;
CREATE CONSTRAINT TRIGGER operational_commit_receipt AFTER UPDATE ON lifecycle_operational_receipts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_receipt();
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
  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batches b USING(batch_id)
    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id AND b.state='acked'
    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
 ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
 IF NEW.state='pending' THEN
  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
    OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
  SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO total_count,total_bytes FROM public.public_pending_events;
  IF total_count+1>100000 OR total_bytes+octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.preserve_operational_slot() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS critical_slot_integrity ON public_critical_event_slots;
CREATE TRIGGER critical_slot_integrity BEFORE UPDATE OR DELETE ON public_critical_event_slots
FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
DROP TRIGGER IF EXISTS critical_slot_no_truncate ON public_critical_event_slots;
CREATE TRIGGER critical_slot_no_truncate BEFORE TRUNCATE ON public_critical_event_slots
FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings','lifecycle_operational_receipts','public_critical_event_slots'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
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


CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer;
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
 IF sid IS NOT NULL THEN
  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp()
   WHERE slot=slot_id;
  RETURN NULL;
 END IF;
 INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
 VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
BEGIN
 SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
 IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at)
 IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at) THEN
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
 OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
 SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO usage_count,usage_bytes FROM public.public_pending_events;
 critical:=NEW.kind IN ('closed','reopened');
 IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
 OR usage_bytes+octet_length(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.validate_outbox_insert() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS a_outbox_contract ON public_outbox;
CREATE TRIGGER a_outbox_contract BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_outbox_insert();
DROP TRIGGER IF EXISTS lifecycle_validate ON public_outbox;
CREATE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();

CREATE OR REPLACE FUNCTION lifecycle_private.validate_archive_item() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE b public.public_archive_batches;
BEGIN
 SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
 IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.validate_archive_item() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS archive_item_insert ON public_archive_items;
CREATE TRIGGER archive_item_insert BEFORE INSERT ON public_archive_items FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_archive_item();

CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_state() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
  EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
 END LOOP;
END $$;
