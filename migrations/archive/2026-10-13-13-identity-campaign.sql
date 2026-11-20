BEGIN;
-- Private operator opt-in/progress only. No campaign, mapping or activation is created.
CREATE TABLE IF NOT EXISTS lifecycle_identity_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'paused' CHECK(state IN ('paused','running','completed','stopped','budget_exhausted')),
 source_revision text NOT NULL CHECK(source_revision ~ '^[0-9a-f]{40}$'),
 activation_generation bigint NOT NULL CHECK(activation_generation>=0),
 expires_at timestamptz NOT NULL,
 max_job_rows integer NOT NULL CHECK(max_job_rows BETWEEN 0 AND 1000000),
 max_company_rows integer NOT NULL CHECK(max_company_rows BETWEEN 0 AND 50000),
 max_turns integer NOT NULL CHECK(max_turns BETWEEN 1 AND 1000),
 job_high_water text,
 company_high_water bigint NOT NULL CHECK(company_high_water>=0),
 phase text NOT NULL DEFAULT 'jobs' CHECK(phase IN ('jobs','companies','finished')),
 job_cursor text,
 company_cursor bigint NOT NULL DEFAULT 0,
 job_rows bigint NOT NULL DEFAULT 0,
 mapped_jobs bigint NOT NULL DEFAULT 0,
 company_rows bigint NOT NULL DEFAULT 0,
 mapped_accounts bigint NOT NULL DEFAULT 0,
 turns integer NOT NULL DEFAULT 0,
 next_turn_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 heartbeat_at timestamptz,
 finished_at timestamptz,
 before_bytes bigint,
 after_bytes bigint,
 stop_reason text,
 CHECK(job_rows>=0 AND mapped_jobs>=0 AND mapped_jobs<=job_rows AND job_rows<=max_job_rows),
 CHECK(company_rows>=0 AND mapped_accounts>=0 AND mapped_accounts<=max_company_rows),
 CHECK(turns>=0 AND turns<=max_turns)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_identity_campaign ON lifecycle_identity_campaigns(state) WHERE state='running';
ALTER TABLE lifecycle_identity_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lifecycle_identity_campaigns FROM PUBLIC,anon,authenticated;
INSERT INTO schema_migrations(filename) VALUES('2026-10-13-13-identity-campaign.sql') ON CONFLICT DO NOTHING;
COMMIT;
