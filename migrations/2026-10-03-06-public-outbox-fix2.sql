-- Task10 Fix2: logical processing escrow, no physical/role/claim enforcement change.
-- C is the immutable canonical event size. Each event can drain as a singleton:
-- membership 2C+1024; batch 8192; seal 4096+2*(8192+2C);
-- exact ack receipts/coverage/marker workspace 98304. Total 6C+128000.
CREATE OR REPLACE FUNCTION lifecycle_private.archive_processing_charge(canonical bytea) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT 6::bigint*COALESCE(octet_length(canonical),0)+128000
$$;
-- Total committed lifecycle forecast: base pending representations plus escrow.
-- Membership/seal copies consume escrow, never fresh ordinary/critical allowance.
CREATE OR REPLACE FUNCTION lifecycle_private.archive_budget_bytes() RETURNS bigint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT
 COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
   +lifecycle_private.archive_processing_charge(canonical_event)) FROM public.public_outbox),0)
 +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
   +CASE WHEN state='pending' THEN lifecycle_private.archive_processing_charge(canonical_event) ELSE 0 END)
   FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
$$;
REVOKE ALL ON FUNCTION lifecycle_private.archive_processing_charge(bytea),lifecycle_private.archive_budget_bytes() FROM PUBLIC,anon,authenticated;
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
 SELECT count(*),lifecycle_private.archive_budget_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
 critical:=NEW.kind IN ('closed','reopened');
 IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
 OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
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
  SELECT count(*),lifecycle_private.archive_budget_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
 END IF;
 RETURN NEW;
END $$;
