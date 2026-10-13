-- Final functional composition: additive compact observation/follow-up state and
-- exact archived edge storage retirement. Existing enforcement is unchanged.
BEGIN;
ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_demand_verification_id uuid;
ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_observation_kind text
 CHECK(last_observation_kind IN ('enumeration','demand','followup'));
ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_due_at timestamptz;
ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;
ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_status text
 CHECK(followup_status IN ('pending','running','migration_review'));
CREATE OR REPLACE FUNCTION lifecycle_private.edge_compaction_ready(t text, edge_id uuid, version_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT t IN ('job_locations','job_skills')
 AND EXISTS(SELECT FROM public.public_archive_heads h JOIN public.public_archive_coverage c
  ON c.aggregate_type=h.aggregate_type AND c.aggregate_id=h.aggregate_id AND c.revision=h.revision
  JOIN public.public_archive_batch_markers m ON m.batch_id=c.batch_id
  WHERE h.aggregate_type=t AND h.aggregate_id=edge_id::text)
 AND NOT EXISTS(SELECT FROM public.public_pending_events WHERE aggregate_type=t AND aggregate_id=edge_id::text)
 AND EXISTS(SELECT FROM public.job_versions v JOIN public.public_archive_version_coverage c
  ON c.version_id=v.id AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash
  WHERE v.id=$3)
$$;
REVOKE ALL ON FUNCTION lifecycle_private.edge_compaction_ready(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
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
CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
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
INSERT INTO schema_migrations(filename) VALUES('2026-10-08-10-lifecycle-composition.sql') ON CONFLICT DO NOTHING;
COMMIT;
