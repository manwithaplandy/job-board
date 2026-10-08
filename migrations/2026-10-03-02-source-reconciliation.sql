-- Completed source membership can resume under the existing newer same-source
-- claim. No claim, lease, capacity, role or owner validator is relaxed.
CREATE INDEX IF NOT EXISTS idx_enumerations_pending_reconciliation
 ON source_enumerations(source_id,sequence)
 WHERE status='complete' AND reconciled_at IS NULL;
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
REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-source-reconciliation.sql') ON CONFLICT DO NOTHING;
