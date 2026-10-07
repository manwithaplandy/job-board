-- Checkpoint A. Legacy/collect stay compatible; readiness is NOT fabricated here.
CREATE TABLE IF NOT EXISTS lifecycle_claims (
  kind text NOT NULL, work_id text NOT NULL, PRIMARY KEY(kind,work_id),
  owner_token text NOT NULL UNIQUE, generation bigint NOT NULL DEFAULT 1 CHECK(generation>0),
  replay_floor bigint NOT NULL DEFAULT 0 CHECK(replay_floor>=0 AND replay_floor<=generation),
  invoking_role name NOT NULL, subject_id uuid,
  lease_until timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled','complete')),
  terminal_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_recovery ON lifecycle_claims(state,lease_until);
CREATE INDEX IF NOT EXISTS idx_lifecycle_claims_terminal ON lifecycle_claims(terminal_at) WHERE terminal_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS capacity_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_kind text NOT NULL,claim_id text NOT NULL,
  FOREIGN KEY(claim_kind,claim_id) REFERENCES lifecycle_claims(kind,work_id),
  owner_token text NOT NULL,generation bigint NOT NULL CHECK(generation>0),
  bytes bigint NOT NULL CHECK(bytes>=0),critical boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','settled','fenced')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), terminal_at timestamptz,
  backend_pid integer,transaction_id xid8,invoking_role name,subject_id uuid,
  job_id text,scope text,measured_database_bytes bigint,
  CHECK((backend_pid IS NULL)=(transaction_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_capacity_held ON capacity_reservations(state) INCLUDE(bytes);
CREATE INDEX IF NOT EXISTS idx_capacity_claim ON capacity_reservations(claim_kind,claim_id,generation);
CREATE INDEX IF NOT EXISTS idx_capacity_terminal ON capacity_reservations(terminal_at) WHERE terminal_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS source_enumerations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES source_accounts(id),
 sequence bigint NOT NULL CHECK(sequence>0),owner_token text NOT NULL,generation bigint NOT NULL CHECK(generation>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','complete','partial','failed','cancelled')),
 cursor jsonb CHECK(cursor IS NULL OR jsonb_typeof(cursor)='object'),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,reconciled_at timestamptz,
 terminal_at timestamptz,UNIQUE(source_id,sequence)
);
CREATE INDEX IF NOT EXISTS idx_enumerations_terminal ON source_enumerations(terminal_at) WHERE terminal_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enumerations_recovery ON source_enumerations(status,started_at);
CREATE TABLE IF NOT EXISTS enumeration_members (
 enumeration_id uuid NOT NULL REFERENCES source_enumerations(id) ON DELETE CASCADE,
 external_id text NOT NULL,public_metadata jsonb NOT NULL CHECK(jsonb_typeof(public_metadata)='object'),
 PRIMARY KEY(enumeration_id,external_id)
);
CREATE TABLE IF NOT EXISTS reconciliation_checkpoints (
 enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id) ON DELETE CASCADE,
 last_external_id text,generation bigint NOT NULL CHECK(generation>0),
 reconciled_count bigint NOT NULL DEFAULT 0 CHECK(reconciled_count>=0),
 completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_completed ON reconciliation_checkpoints(completed_at) WHERE completed_at IS NOT NULL;
-- Append-only receipts support total per-transaction budgets without a privileged
-- writer. Authenticated callers may add their own receipts (which only consume
-- budget), never edit/delete them. Helpers below read claims/reservations ONLY.
CREATE TABLE IF NOT EXISTS lifecycle_write_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),backend_pid integer NOT NULL DEFAULT pg_backend_pid(),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 invoking_role name NOT NULL,subject_id uuid,
 owner_token text,generation bigint,reservation_id uuid,
 job_id text,scope text,bytes bigint NOT NULL DEFAULT 0 CHECK(bytes>=0),
 row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 1),
 total_bytes numeric NOT NULL DEFAULT 0,total_rows bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_write_checks_transaction ON lifecycle_write_checks(transaction_id,backend_pid);
CREATE INDEX IF NOT EXISTS idx_write_checks_terminal ON lifecycle_write_checks(created_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lifecycle_claims','capacity_reservations','source_enumerations','enumeration_members','reconciliation_checkpoints','lifecycle_write_checks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
-- Explicit read-only control projection contains no credentials or tenant data.
-- It lets invoker triggers select the actual persisted stage without a definer.
GRANT SELECT ON lifecycle_control TO authenticated;
DROP POLICY IF EXISTS lifecycle_control_read ON lifecycle_control;
CREATE POLICY lifecycle_control_read ON lifecycle_control FOR SELECT TO authenticated USING(true);
GRANT SELECT,INSERT ON lifecycle_write_checks TO authenticated;
DROP POLICY IF EXISTS owner_receipts ON lifecycle_write_checks;
CREATE POLICY owner_receipts ON lifecycle_write_checks TO authenticated
 USING(subject_id=app_user_id()) WITH CHECK(subject_id=app_user_id() AND invoking_role=current_user AND backend_pid=pg_backend_pid() AND transaction_id=pg_current_xact_id());
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS protection_until timestamptz;
ALTER TABLE job_payload_demands ALTER COLUMN protection_until SET DEFAULT (clock_timestamp()+interval '180 seconds');
REVOKE ALL ON job_payload_demands FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON job_payload_demands TO authenticated;
GRANT INSERT(user_id,job_id,kind) ON job_payload_demands TO authenticated;
DROP POLICY IF EXISTS owner_access ON job_payload_demands;
CREATE POLICY owner_access ON job_payload_demands TO authenticated
 USING(user_id=app_user_id()) WITH CHECK(user_id=app_user_id());

CREATE OR REPLACE FUNCTION lifecycle_gate() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'lifecycle writes require read committed'; END IF;
 PERFORM set_config('lock_timeout','2s',true);
 PERFORM set_config('statement_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(20916294442894917);
 IF TG_OP='TRUNCATE' AND (TG_TABLE_NAME IN ('lifecycle_claims','capacity_reservations','lifecycle_write_checks') OR EXISTS(SELECT FROM public.lifecycle_control WHERE safety_stage='enforced' OR archive_ever_activated)) THEN RAISE EXCEPTION 'lifecycle history cannot be truncated'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_gate() FROM PUBLIC,anon,authenticated;
-- Captured SQL/FK/caller inventory is checked by real catalog tests. Include all
-- account-deletion siblings: they may be touched before a job child in a single
-- existing transaction, so gating only the eventual child would invert locks.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[
 'jobs','job_questions','job_reviews','review_corrections','application_packages',
 'resume_scores','cover_letter_edits','generation_jobs','job_payload_demands',
 'companies','locations','brands','skills','source_accounts','source_listings',
 'job_versions','company_brands','company_sources','job_locations','job_skills',
 'identity_assertions','lifecycle_control','lifecycle_claims','capacity_reservations',
 'source_enumerations','enumeration_members','reconciliation_checkpoints','lifecycle_write_checks',
 'profiles','matching_activity','account_deletions','company_reviews','company_overrides',
 'classification_jobs','usage_counters','subscriptions','review_requests','review_runs',
 'invite_codes','invite_redemptions','invite_allowances','plan_overrides','feedback'
 ] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_pre_dml ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION lifecycle_check_totals() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_check_totals() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS a_check_totals ON lifecycle_write_checks;
CREATE TRIGGER a_check_totals BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_check_totals();
CREATE SCHEMA IF NOT EXISTS lifecycle_private;
REVOKE ALL ON SCHEMA lifecycle_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.validate_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.lifecycle_claims; r public.capacity_reservations; actor name;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.validate_write() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS b_validate_write ON lifecycle_write_checks;
CREATE TRIGGER b_validate_write BEFORE INSERT ON lifecycle_write_checks FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();
DROP TRIGGER IF EXISTS z_validate_commit ON lifecycle_write_checks;
CREATE CONSTRAINT TRIGGER z_validate_commit AFTER INSERT ON lifecycle_write_checks DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_write();

CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
 payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
 rid uuid;
BEGIN
 SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
 n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
 IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
 -- Task10 installs outbox pairing. Until then even test-fixture activation fails
 -- closed on eventful public writes; export_enabled is never a producer bypass.
 IF ctl.archive_ever_activated AND TG_TABLE_NAME IN ('jobs','job_questions','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions')
 AND (TG_OP<>'UPDATE' OR n IS DISTINCT FROM o) THEN
  RAISE EXCEPTION 'archive producer paused or matching outbox contract unavailable';
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
  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
   oldpayload:=o->>k;
   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
     AND (jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
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
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions','source_enumerations','enumeration_members','reconciliation_checkpoints'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_validate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_validate BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lifecycle_validate_row()',t);
 END LOOP;
END $$;
-- Reuse the Task2 history function so earlier migration reapplication cannot
-- accidentally remove the stronger barrier. No writer/destination readiness yet.
CREATE OR REPLACE FUNCTION preserve_lifecycle_control() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'lifecycle control history cannot be removed'; END IF;
 IF OLD.archive_ever_activated AND NOT NEW.archive_ever_activated THEN RAISE EXCEPTION 'archive activation history is monotonic'; END IF;
 IF OLD.identity_migration_activated_at IS NOT NULL AND NEW.identity_migration_activated_at IS DISTINCT FROM OLD.identity_migration_activated_at THEN RAISE EXCEPTION 'identity migration activation is immutable'; END IF;
 IF NEW.activation_generation<OLD.activation_generation OR NEW.flags_version<OLD.flags_version THEN RAISE EXCEPTION 'control generation and schema version are monotonic'; END IF;
 IF (to_jsonb(NEW)-'identity_migration_activated_at') IS DISTINCT FROM (to_jsonb(OLD)-'identity_migration_activated_at') AND NEW.activation_generation<=OLD.activation_generation THEN RAISE EXCEPTION 'control changes require a newer activation generation'; END IF;
 IF NEW.safety_stage='enforced' AND OLD.safety_stage<>'enforced' OR (NEW.retirement_enabled AND NOT NEW.retirement_dry_run) THEN
  RAISE EXCEPTION 'lifecycle activation requires compatible writer and backfill readiness'; END IF;
 IF OLD.safety_stage='enforced' AND NEW.safety_stage<>'enforced' THEN RAISE EXCEPTION 'unsafe legacy rollback after cutover'; END IF;
 IF NEW.archive_stage<> 'never_activated' AND NOT OLD.archive_ever_activated OR NEW.export_enabled AND NOT OLD.export_enabled THEN
  RAISE EXCEPTION 'archive activation requires validated destination and producer readiness'; END IF;
 IF OLD.archive_ever_activated AND NEW.archive_stage='active' AND OLD.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-lifecycle-safety.sql') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION resume_matching() RETURNS TABLE(status text, existing boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
REVOKE ALL ON FUNCTION resume_matching() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resume_matching() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_message text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
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
REVOKE ALL ON FUNCTION public.submit_feedback(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION lifecycle_reservation_integrity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
 IF NEW.state='held' THEN
  SELECT pg_database_size(current_database())+COALESCE(sum(bytes),0)+NEW.bytes INTO allocated
  FROM public.capacity_reservations WHERE state='held' AND id<>NEW.id;
  IF allocated>6291456000 THEN RAISE EXCEPTION 'physical capacity budget exceeded'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_reservation_integrity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS reservation_integrity ON capacity_reservations;
CREATE TRIGGER reservation_integrity BEFORE INSERT OR UPDATE OR DELETE ON capacity_reservations
 FOR EACH ROW EXECUTE FUNCTION lifecycle_reservation_integrity();
CREATE OR REPLACE FUNCTION lifecycle_claim_integrity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'compact claim replay fence must survive cleanup'; END IF;
 IF NEW.kind<>OLD.kind OR NEW.work_id<>OLD.work_id OR NEW.generation<OLD.generation OR NEW.replay_floor<OLD.replay_floor THEN
  RAISE EXCEPTION 'claim identity and replay floor are monotonic'; END IF;
 IF (NEW.owner_token<>OLD.owner_token OR NEW.state<>OLD.state OR NEW.invoking_role<>OLD.invoking_role OR NEW.subject_id IS DISTINCT FROM OLD.subject_id) AND
 (NEW.generation<=OLD.generation OR NEW.replay_floor<OLD.generation) THEN
  RAISE EXCEPTION 'claim replacement requires a fenced generation'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_claim_integrity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS claim_integrity ON lifecycle_claims;
CREATE TRIGGER claim_integrity BEFORE UPDATE OR DELETE ON lifecycle_claims FOR EACH ROW EXECUTE FUNCTION lifecycle_claim_integrity();

CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
 IF TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
 IF TG_TABLE_NAME='source_enumerations' AND TG_OP='UPDATE' AND
 (NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence OR NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation) THEN
  RAISE EXCEPTION 'enumeration identity is immutable'; END IF;
 INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
 VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_source_floor ON source_accounts;
CREATE TRIGGER lifecycle_source_floor BEFORE UPDATE ON source_accounts FOR EACH ROW EXECUTE FUNCTION lifecycle_staging_fence();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['source_enumerations','enumeration_members','reconciliation_checkpoints'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_staging_claim ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_staging_claim BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lifecycle_staging_fence()',t);
 END LOOP;
END $$;

-- Existing account erasure calls this service-only INVOKER function under the
-- same gate. It touches operational state only, preserving compact replay fences.
CREATE OR REPLACE FUNCTION lifecycle_forget_subject(target uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(20916294442894917);
 UPDATE public.lifecycle_claims c SET replay_floor=generation,generation=generation+1,
 state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL
 WHERE c.subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
  WHERE r.subject_id=target AND r.state='held' AND r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation);
 UPDATE public.capacity_reservations r SET state='fenced',terminal_at=clock_timestamp()
 FROM public.lifecycle_claims c WHERE c.kind=r.claim_kind AND c.work_id=r.claim_id
  AND r.state='held' AND r.generation<c.generation;
 UPDATE public.capacity_reservations SET subject_id=NULL WHERE subject_id=target AND state<>'held';
 DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;
END $$;
REVOKE ALL ON FUNCTION lifecycle_forget_subject(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION lifecycle_private.protect_demand_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('role')='authenticated' AND OLD.user_id IS DISTINCT FROM public.app_user_id() THEN RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
 -- Deleting an owner queue row cannot silently cancel/release a live service
 -- claim. The service must fence the claim first (account erasure does so).
 IF EXISTS(SELECT FROM public.lifecycle_claims WHERE kind='demand' AND work_id=OLD.id::text
 AND state='active' AND generation>replay_floor) THEN
  RAISE EXCEPTION 'demand removal requires fenced service claim'; END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION lifecycle_private.protect_demand_claim() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_demand_removal ON job_payload_demands;
CREATE TRIGGER lifecycle_demand_removal BEFORE DELETE ON job_payload_demands
 FOR EACH ROW EXECUTE FUNCTION lifecycle_private.protect_demand_claim();
