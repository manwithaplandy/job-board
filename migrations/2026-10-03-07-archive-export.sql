-- Task11: archive-only explicit replacement and validated transport configuration.
CREATE OR REPLACE FUNCTION lifecycle_private.archive_clock() RETURNS timestamptz
LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$;
REVOKE ALL ON FUNCTION lifecycle_private.archive_clock() FROM PUBLIC,anon,authenticated;
-- Empty destination and false validation flags keep transport inactive.
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS bucket text;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS expected_owner text;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS private_validated boolean NOT NULL DEFAULT false;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS encryption_validated boolean NOT NULL DEFAULT false;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS policy_validated boolean NOT NULL DEFAULT false;
ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS validation_evidence text;
ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_state_check;
ALTER TABLE public_archive_batches ADD CONSTRAINT public_archive_batches_state_check CHECK(state IN ('claimed','sealed','acked','superseded'));
-- A never-uploaded claimed batch can also require authorized replacement.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public_archive_batches'::regclass
 AND contype='c' AND pg_get_constraintdef(oid) LIKE '%data_key IS NOT NULL%' LOOP
  EXECUTE format('ALTER TABLE public_archive_batches DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public_archive_batches ADD CONSTRAINT archive_sealed_fields CHECK(
 state IN ('claimed','superseded') OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
 AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
 AND manifest_bytes BETWEEN 1 AND 1048576));
CREATE TABLE IF NOT EXISTS public_archive_recovery_authorizations (
 authorization_id uuid PRIMARY KEY, batch_id uuid NOT NULL UNIQUE,
 event_ids_sha256 text NOT NULL, manifest_hash text,
 approved_by text NOT NULL CHECK(length(approved_by) BETWEEN 1 AND 256),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1024),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz, replacement_batch_id uuid UNIQUE,
 CHECK(expires_at>approved_at), CHECK((consumed_at IS NULL)=(replacement_batch_id IS NULL))
);
CREATE TABLE IF NOT EXISTS public_archive_supersessions (
 old_batch_id uuid PRIMARY KEY, new_batch_id uuid NOT NULL UNIQUE,
 authorization_id uuid NOT NULL UNIQUE REFERENCES public_archive_recovery_authorizations(authorization_id),
 owner_token text NOT NULL,generation bigint NOT NULL,event_ids_sha256 text NOT NULL,
 manifest_hash text,replaced_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION lifecycle_private.consume_archive_authorization() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_private.consume_archive_authorization() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public_archive_recovery_authorizations','public_archive_supersessions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS archive_immutable ON public_archive_supersessions;
CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_supersessions FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_supersessions;
CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_supersessions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
DROP TRIGGER IF EXISTS archive_authorization_consume ON public_archive_recovery_authorizations;
CREATE TRIGGER archive_authorization_consume BEFORE UPDATE OR DELETE ON public_archive_recovery_authorizations FOR EACH ROW EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();
DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_recovery_authorizations;
CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_recovery_authorizations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();

-- Payload/config integrity failures are durable operator work, never dropped events.
CREATE TABLE IF NOT EXISTS public_archive_quarantine (
 batch_id uuid PRIMARY KEY, diagnostic_code text NOT NULL CHECK(diagnostic_code='invalid_archive'),
 quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public_archive_quarantine ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_archive_quarantine FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_gate ON public_archive_quarantine;
CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public_archive_quarantine
 FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate();
