BEGIN;
-- Additive prerequisites only. No corpus UPDATE, version capture or consumer cutover.
-- Explicit bounded mapping is job_discovery.lifecycle.identity.migrate_identity_batch.
CREATE TABLE IF NOT EXISTS lifecycle_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  flags_version INTEGER NOT NULL DEFAULT 1 CHECK (flags_version > 0),
  safety_stage TEXT NOT NULL DEFAULT 'legacy' CHECK (safety_stage IN ('legacy','collect','enforced')),
  identity_enabled BOOLEAN NOT NULL DEFAULT false,
  source_enabled BOOLEAN NOT NULL DEFAULT false,
  maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
  hydration_enabled BOOLEAN NOT NULL DEFAULT false,
  feed_enabled BOOLEAN NOT NULL DEFAULT false,
  retirement_enabled BOOLEAN NOT NULL DEFAULT false,
  retirement_dry_run BOOLEAN NOT NULL DEFAULT true,
  archive_ever_activated BOOLEAN NOT NULL DEFAULT false,
  archive_stage TEXT NOT NULL DEFAULT 'never_activated'
    CHECK (archive_stage IN ('never_activated','active','producer_paused')),
  export_enabled BOOLEAN NOT NULL DEFAULT false,
  activation_generation BIGINT NOT NULL DEFAULT 0 CHECK (activation_generation >= 0),
  identity_migration_activated_at TIMESTAMPTZ,
  CHECK (archive_ever_activated = (archive_stage <> 'never_activated')),
  CHECK (NOT export_enabled OR archive_ever_activated)
);
INSERT INTO lifecycle_control(singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- A small invoker-only guard protects durable control history. Task 3 owns the
-- gated transition API/readiness validation; no producer can be activated here.
CREATE OR REPLACE FUNCTION preserve_lifecycle_control() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN
    RAISE EXCEPTION 'lifecycle control history cannot be removed';
  END IF;
  IF OLD.archive_ever_activated AND NOT NEW.archive_ever_activated THEN
    RAISE EXCEPTION 'archive activation history is monotonic';
  END IF;
  IF OLD.identity_migration_activated_at IS NOT NULL AND
     NEW.identity_migration_activated_at IS DISTINCT FROM OLD.identity_migration_activated_at THEN
    RAISE EXCEPTION 'identity migration activation is immutable';
  END IF;
  IF NEW.activation_generation < OLD.activation_generation OR NEW.flags_version < OLD.flags_version THEN
    RAISE EXCEPTION 'control generation and schema version are monotonic';
  END IF;
  IF (to_jsonb(NEW) - 'identity_migration_activated_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'identity_migration_activated_at') AND
     NEW.activation_generation <= OLD.activation_generation THEN
    RAISE EXCEPTION 'control changes require a newer activation generation';
  END IF;
  -- No active safety/outbox contract exists at this schema stage. Later ordered
  -- safety/outbox migrations replace this activation barrier after review.
  IF NEW.safety_stage = 'enforced' OR NEW.archive_stage <> 'never_activated' OR NEW.export_enabled THEN
    RAISE EXCEPTION 'lifecycle activation requires installed safety and outbox contracts';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lifecycle_control_history ON lifecycle_control;
CREATE TRIGGER lifecycle_control_history BEFORE UPDATE OR DELETE ON lifecycle_control
FOR EACH ROW EXECUTE FUNCTION preserve_lifecycle_control();
DROP TRIGGER IF EXISTS lifecycle_control_no_truncate ON lifecycle_control;
CREATE TRIGGER lifecycle_control_no_truncate BEFORE TRUNCATE ON lifecycle_control
FOR EACH STATEMENT EXECUTE FUNCTION preserve_lifecycle_control();

CREATE TABLE IF NOT EXISTS source_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_company_id INTEGER REFERENCES companies(id),
  ats TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby','workable','smartrecruiters','workday')),
  public_board_ref TEXT NOT NULL,
  public_url TEXT,
  legacy_active BOOLEAN,
  exclusion_state TEXT NOT NULL DEFAULT 'unknown' CHECK (exclusion_state IN ('unknown','enabled','failure_disabled','deliberate')),
  last_attempt_at TIMESTAMPTZ,
  last_complete_success_at TIMESTAMPTZ,
  last_outcome TEXT,
  next_due_at TIMESTAMPTZ,
  suspicious_empty_streak INTEGER NOT NULL DEFAULT 0 CHECK (suspicious_empty_streak >= 0),
  failure_streak INTEGER NOT NULL DEFAULT 0 CHECK (failure_streak >= 0),
  claim_owner_token TEXT,
  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
  lease_until TIMESTAMPTZ,
  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
  enumeration_sequence BIGINT NOT NULL DEFAULT 0 CHECK (enumeration_sequence >= 0),
  replay_floor BIGINT NOT NULL DEFAULT 0 CHECK (replay_floor >= 0),
  reconciliation_cursor TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats, public_board_ref),
  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_source_accounts_legacy ON source_accounts(legacy_company_id);
CREATE INDEX IF NOT EXISTS idx_source_accounts_due ON source_accounts(next_due_at,last_complete_success_at,id);

CREATE TABLE IF NOT EXISTS source_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
  external_id TEXT NOT NULL,
  -- Pre-cutover mapping follows legacy deletion. Task3/4 must reject Job
  -- DELETE at identity-preserving cutover; never weaken existing private FKs.
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  current_version_id UUID,
  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
  original_discovered_at TIMESTAMPTZ NOT NULL,
  source_published_at TIMESTAMPTZ,
  source_published_provenance TEXT,
  discovery_anchor_at TIMESTAMPTZ NOT NULL,
  discovery_anchor_provenance TEXT NOT NULL
    CHECK (discovery_anchor_provenance IN ('legacy_local_observation','local_observation','source_published')),
  discovery_expires_at TIMESTAMPTZ NOT NULL,
  successful_last_observed_at TIMESTAMPTZ,
  successful_sighting_count BIGINT NOT NULL DEFAULT 0 CHECK (successful_sighting_count >= 0),
  content_changed_at TIMESTAMPTZ,
  content_hash TEXT CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  consecutive_complete_misses INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_complete_misses >= 0),
  first_complete_miss_at TIMESTAMPTZ,
  last_miss_enumeration_id UUID,
  last_membership_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_membership_sequence >= 0),
  last_complete_miss_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_complete_miss_sequence >= 0),
  last_direct_verification_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_direct_verification_sequence >= 0),
  source_availability TEXT NOT NULL DEFAULT 'unknown' CHECK (source_availability IN ('open','unknown','closed')),
  legacy_closed_at TIMESTAMPTZ,
  payload_retired_at TIMESTAMPTZ,
  suspected_id_reuse BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_account_id,external_id),
  UNIQUE (id,job_id),
  CHECK (discovery_expires_at = discovery_anchor_at + interval '720 hours'),
  CHECK ((source_published_at IS NULL) = (source_published_provenance IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_source_listings_job ON source_listings(job_id);
CREATE INDEX IF NOT EXISTS idx_source_listings_expiry ON source_listings(discovery_expires_at,id);
CREATE INDEX IF NOT EXISTS idx_source_listings_source_availability ON source_listings(source_account_id,source_availability,id);

CREATE TABLE IF NOT EXISTS job_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  source_listing_id UUID NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  public_metadata JSONB NOT NULL CHECK (jsonb_typeof(public_metadata) = 'object'),
  observed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_ref TEXT,
  payload_expires_at TIMESTAMPTZ,
  UNIQUE (source_listing_id,revision),
  UNIQUE (id,job_id),
  UNIQUE (id,source_listing_id),
  FOREIGN KEY (source_listing_id,job_id) REFERENCES source_listings(id,job_id),
  CHECK ((payload_ref IS NULL) = (payload_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_job_versions_job ON job_versions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_versions_recorded ON job_versions(recorded_at,id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='source_listings'::regclass AND conname='source_listings_current_version_fk') THEN
    ALTER TABLE source_listings ADD CONSTRAINT source_listings_current_version_fk
      FOREIGN KEY (current_version_id,id) REFERENCES job_versions(id,source_listing_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), canonical_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS company_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
  public_evidence_ref TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
  UNIQUE (company_id,brand_id),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_company_brands_right ON company_brands(brand_id);

CREATE TABLE IF NOT EXISTS company_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
  public_evidence_ref TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
  UNIQUE (company_id,source_account_id),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_company_sources_right ON company_sources(source_account_id);

CREATE TABLE IF NOT EXISTS job_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_version_id UUID NOT NULL REFERENCES job_versions(id),
  location_id TEXT NOT NULL REFERENCES locations(raw),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
  public_evidence_ref TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
  UNIQUE (job_version_id,location_id),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_job_locations_right ON job_locations(location_id);

CREATE TABLE IF NOT EXISTS job_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_version_id UUID NOT NULL REFERENCES job_versions(id),
  skill_id UUID NOT NULL REFERENCES skills(id),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
  public_evidence_ref TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
  UNIQUE (job_version_id,skill_id),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_job_skills_right ON job_skills(skill_id);

CREATE TABLE IF NOT EXISTS identity_assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  left_listing_id UUID NOT NULL REFERENCES source_listings(id),
  right_listing_id UUID NOT NULL REFERENCES source_listings(id),
  relation TEXT NOT NULL CHECK (relation IN ('same_job','repost_of','source_migration')),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public')),
  public_evidence_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
  CHECK (left_listing_id <> right_listing_id),
  CHECK (status <> 'accepted' OR (evidence_kind = 'reviewed_public' AND reviewed_at IS NOT NULL)),
  UNIQUE (left_listing_id,right_listing_id,relation)
);
CREATE INDEX IF NOT EXISTS idx_identity_assertions_right ON identity_assertions(right_listing_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_captured_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_last_used_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_capture_provenance TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_version_id UUID;
ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS capture_provenance TEXT;
ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS job_version_id UUID;

-- Prerequisite queue, kept service-only until Task 3 adds its owner access API.
CREATE TABLE IF NOT EXISTS job_payload_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  kind TEXT NOT NULL CHECK (kind IN ('description','questions','review','prepare','generation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','deferred','failed','cancelled')),
  claim_owner_token TEXT,
  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_job_payload_demands_job ON job_payload_demands(job_id,status);
CREATE INDEX IF NOT EXISTS idx_job_payload_demands_owner ON job_payload_demands(user_id,status);
CREATE INDEX IF NOT EXISTS idx_job_payload_demands_terminal ON job_payload_demands(settled_at) WHERE settled_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_payload_demand ON job_payload_demands(user_id,job_id,kind) WHERE status IN ('pending','running');

ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_reviews'::regclass AND conname='job_reviews_version_job_fk') THEN
    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_job_reviews_version ON job_reviews(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='review_corrections'::regclass AND conname='review_corrections_version_job_fk') THEN
    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_review_corrections_version ON review_corrections(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='application_packages'::regclass AND conname='application_packages_version_job_fk') THEN
    ALTER TABLE application_packages ADD CONSTRAINT application_packages_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE application_packages ADD CONSTRAINT application_packages_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_application_packages_version ON application_packages(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='generation_jobs'::regclass AND conname='generation_jobs_version_job_fk') THEN
    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_generation_jobs_version ON generation_jobs(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='resume_scores'::regclass AND conname='resume_scores_version_job_fk') THEN
    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_resume_scores_version ON resume_scores(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='cover_letter_edits'::regclass AND conname='cover_letter_edits_version_job_fk') THEN
    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_version ON cover_letter_edits(job_version_id) WHERE job_version_id IS NOT NULL;

ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS job_version_id UUID;
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_version_job_fk') THEN
    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_questions_shape
      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_job_payload_demands_version ON job_payload_demands(job_version_id) WHERE job_version_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_ready_version') THEN
    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_ready_version
      CHECK (status <> 'ready' OR job_version_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='jobs'::regclass AND conname='jobs_description_version_fk') THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_description_version_fk
      FOREIGN KEY (description_version_id,id) REFERENCES job_versions(id,job_id);
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_questions'::regclass AND conname='job_questions_version_job_fk') THEN
    ALTER TABLE job_questions ADD CONSTRAINT job_questions_version_job_fk
      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jobs_description_version ON jobs(description_version_id) WHERE description_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_questions_version ON job_questions(job_version_id) WHERE job_version_id IS NOT NULL;
ALTER TABLE lifecycle_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lifecycle_control FROM PUBLIC, anon, authenticated;
ALTER TABLE source_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON source_accounts FROM PUBLIC, anon, authenticated;
ALTER TABLE source_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON source_listings FROM PUBLIC, anon, authenticated;
ALTER TABLE job_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON brands FROM PUBLIC, anon, authenticated;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON skills FROM PUBLIC, anon, authenticated;
ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON company_brands FROM PUBLIC, anon, authenticated;
ALTER TABLE company_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON company_sources FROM PUBLIC, anon, authenticated;
ALTER TABLE job_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_locations FROM PUBLIC, anon, authenticated;
ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_skills FROM PUBLIC, anon, authenticated;
ALTER TABLE identity_assertions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON identity_assertions FROM PUBLIC, anon, authenticated;
ALTER TABLE job_payload_demands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_payload_demands FROM PUBLIC, anon, authenticated;

INSERT INTO schema_migrations(filename) VALUES ('2026-10-03-01-lifecycle-core.sql') ON CONFLICT DO NOTHING;
COMMIT;
