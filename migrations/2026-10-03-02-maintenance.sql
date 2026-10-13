-- Task 4 operational progress and permanent legacy-prune cutover. No activation.
CREATE TABLE IF NOT EXISTS lifecycle_maintenance_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 cutover_at timestamptz,
 cursor text,
 next_phase integer NOT NULL DEFAULT 0,
 last_success_at timestamptz,
 eligible_rows bigint NOT NULL DEFAULT 0,
 retired_rows bigint NOT NULL DEFAULT 0,
 retired_bytes bigint NOT NULL DEFAULT 0,
 physical_bytes bigint,
 held_bytes bigint,
 live_tuples bigint,
 dead_tuples bigint,
 reusable_bytes bigint, -- NULL: pg_stat_all_tables does not measure free bytes.
 wal_bytes numeric, -- server-wide cumulative pg_stat_wal, not per-sweep WAL.
 guard_active boolean NOT NULL DEFAULT false,
 guard_scheduled_streak integer NOT NULL DEFAULT 0,
 action_needed boolean NOT NULL DEFAULT false
);
INSERT INTO lifecycle_maintenance_state(singleton,cutover_at)
 SELECT true,CASE WHEN maintenance_enabled THEN clock_timestamp() END FROM lifecycle_control
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS lifecycle_staging_cleanup (
 enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id),
 reason text NOT NULL CHECK(reason IN ('completed','abandoned')),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lifecycle_maintenance_state','lifecycle_staging_cleanup'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_pre_dml ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;
-- Invoker deletion guards need only the non-sensitive permanent cutover bit.
GRANT SELECT(cutover_at) ON lifecycle_maintenance_state TO authenticated;
DROP POLICY IF EXISTS maintenance_cutover_read ON lifecycle_maintenance_state;
CREATE POLICY maintenance_cutover_read ON lifecycle_maintenance_state FOR SELECT TO authenticated USING(true);
CREATE OR REPLACE FUNCTION lifecycle_maintenance_cutover() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_maintenance_cutover() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS maintenance_cutover ON lifecycle_control;
CREATE TRIGGER maintenance_cutover AFTER UPDATE ON lifecycle_control FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
DROP TRIGGER IF EXISTS maintenance_history ON lifecycle_maintenance_state;
CREATE TRIGGER maintenance_history BEFORE UPDATE OR DELETE ON lifecycle_maintenance_state FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
DROP TRIGGER IF EXISTS maintenance_history_truncate ON lifecycle_maintenance_state;
CREATE TRIGGER maintenance_history_truncate BEFORE TRUNCATE ON lifecycle_maintenance_state FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
DROP TRIGGER IF EXISTS maintenance_no_job_delete ON jobs;
CREATE TRIGGER maintenance_no_job_delete BEFORE DELETE OR TRUNCATE ON jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
-- Normal membership rows have no generation/source_id fields. Nest table-specific
-- checks before resolving NEW fields; the existing validation comparisons remain.
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
 IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
 END IF;
 IF TG_TABLE_NAME='source_enumerations' THEN
  IF TG_OP='UPDATE' AND (NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence OR NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation) THEN
   RAISE EXCEPTION 'enumeration identity is immutable';
  END IF;
 END IF;
 INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
 VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-maintenance.sql') ON CONFLICT DO NOTHING;
