BEGIN;
-- Private, default-deny operator input. No authorization or campaign is created.
CREATE TABLE IF NOT EXISTS lifecycle_identity_authorizations (
 campaign_id uuid PRIMARY KEY REFERENCES lifecycle_identity_campaigns(id) ON DELETE CASCADE,
 source_revision text NOT NULL CHECK(source_revision ~ '^[0-9a-f]{40}$'),
 activation_generation bigint NOT NULL CHECK(activation_generation>=0),
 authorized_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL CHECK(valid_until>authorized_at AND valid_until<=authorized_at+interval '45 seconds'),
 observed_at timestamptz NOT NULL,
 project_ref text NOT NULL,
 source text NOT NULL CHECK(source='supabase_metrics'),
 volume text NOT NULL CHECK(length(volume)>0),
 capacity_bytes bigint NOT NULL CHECK(capacity_bytes>0),
 free_bytes bigint NOT NULL CHECK(free_bytes>=0 AND free_bytes<=capacity_bytes),
 resident_wal_bytes bigint NOT NULL CHECK(resident_wal_bytes>=0 AND resident_wal_bytes<=capacity_bytes-free_bytes)
);
ALTER TABLE lifecycle_identity_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lifecycle_identity_authorizations FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS lifecycle_identity_generation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0)
);
INSERT INTO lifecycle_identity_generation(singleton) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE lifecycle_identity_generation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lifecycle_identity_generation FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION lifecycle_identity_mutated() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 -- Same global lock order as existing statement gates, before any row/FK locks.
 PERFORM pg_advisory_xact_lock(20916294442894917);
 UPDATE public.lifecycle_identity_generation SET generation=generation+1 WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'identity mutation generation missing'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION lifecycle_identity_mutated() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['jobs','companies','source_listings','source_accounts'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS zz_lifecycle_identity_mutated ON public.%I',t);
  EXECUTE format('CREATE TRIGGER zz_lifecycle_identity_mutated BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_identity_mutated()',t);
 END LOOP;
END $$;
-- Renewal/revocation follows the same gate order; certification cannot race a
-- change to the authorization row between its final check and commit.
DROP TRIGGER IF EXISTS lifecycle_gate ON lifecycle_identity_authorizations;
CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON lifecycle_identity_authorizations
 FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate();

DROP TRIGGER IF EXISTS lifecycle_gate ON lifecycle_identity_campaigns;
CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON lifecycle_identity_campaigns
 FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate();

CREATE OR REPLACE FUNCTION lifecycle_identity_check_authorization() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
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
REVOKE ALL ON FUNCTION lifecycle_identity_check_authorization() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS lifecycle_identity_authorized_commit ON lifecycle_identity_campaigns;
CREATE CONSTRAINT TRIGGER lifecycle_identity_authorized_commit AFTER UPDATE ON lifecycle_identity_campaigns
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_identity_check_authorization();
INSERT INTO schema_migrations(filename) VALUES('2026-10-14-14-identity-reliability.sql') ON CONFLICT DO NOTHING;
COMMIT;
