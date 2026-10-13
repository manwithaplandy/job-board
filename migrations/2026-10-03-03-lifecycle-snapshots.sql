-- Task8 consumes prerequisite snapshot columns from migration01. No activation.
BEGIN;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['job_reviews','review_corrections','application_packages','generation_jobs','resume_scores','cover_letter_edits','job_payload_demands'] LOOP
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid=('public.'||t)::regclass
    AND attname IN ('job_version_id','description_snapshot','questions_snapshot','snapshot_captured_at') AND NOT attisdropped) <> 4 THEN
   RAISE EXCEPTION 'Task2 snapshot prerequisites missing for %',t;
  END IF;
  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_version_job_fk');
  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_questions_shape');
 END LOOP;
END $$;
-- Owner records consumption in the same transaction as successful private work;
-- service workers apply corresponding shared-cache use stamps asynchronously.
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumption_applied_at timestamptz;
GRANT UPDATE(consumed_at) ON job_payload_demands TO authenticated;
CREATE OR REPLACE FUNCTION lifecycle_stamp_consumption() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
  IF OLD.status<>'ready' OR OLD.job_version_id IS NULL OR NULLIF(btrim(OLD.description_snapshot),'') IS NULL THEN
   RAISE EXCEPTION 'consumption requires durable ready snapshot';
  END IF;
  NEW.consumed_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lifecycle_stamp_consumption() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_consumption_stamp ON job_payload_demands;
CREATE TRIGGER lifecycle_consumption_stamp BEFORE UPDATE OF consumed_at ON job_payload_demands
FOR EACH ROW EXECUTE FUNCTION lifecycle_stamp_consumption();
CREATE TABLE IF NOT EXISTS lifecycle_writer_readiness (
 writer text PRIMARY KEY, contract_version integer NOT NULL,
 installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 validated_at timestamptz, notes text NOT NULL
);
REVOKE ALL ON lifecycle_writer_readiness FROM PUBLIC,anon,authenticated;
ALTER TABLE lifecycle_writer_readiness ENABLE ROW LEVEL SECURITY;
INSERT INTO lifecycle_writer_readiness(writer,contract_version,notes)
VALUES ('demand_snapshots',1,'Prerequisite columns present; runtime writers require release verification. No activation granted.')
ON CONFLICT(writer) DO NOTHING;
INSERT INTO schema_migrations(filename) VALUES('2026-10-03-03-lifecycle-snapshots.sql') ON CONFLICT DO NOTHING;
COMMIT;
