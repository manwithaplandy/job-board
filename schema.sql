CREATE TABLE companies (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby',
                                        'workable','smartrecruiters','workday')),
  token   TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  discovery_source TEXT NOT NULL DEFAULT 'manual'
                     CHECK (discovery_source IN ('manual','seed','dataset','expansion')),
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Company-enrichment substrate (see migrations/2026-07-05-company-enrichment.sql).
  -- Raw `name` (slug) stays the stable join/display fallback; these are populated by
  -- later enrichment tasks. enriched_at > company_reviews.reviewed_at re-triggers a screen.
  display_name     TEXT,
  about            TEXT,
  about_source     TEXT CHECK (about_source IN ('ats_board','jd_probe','serp')),
  web_description  TEXT,
  web_searched_at  TIMESTAMPTZ,
  enriched_at      TIMESTAMPTZ,
  -- Global company classification (migrations/2026-07-21-company-classification.sql).
  -- Written once, globally, by the admin-launched classification_jobs worker; per-user
  -- judgment now lives in profiles.company_exclusions + company_overrides.
  industry                  TEXT,
  industry_subcategory      TEXT,
  size                      TEXT
    CHECK (size IN ('1-10','11-50','51-200','201-1000','1001-5000','5000+','unknown')),
  hq_country                TEXT,   -- ISO-3166 alpha-2 (uppercase) or 'unknown'
  tech_tags                 JSONB,
  red_flags                 JSONB,  -- [{category, note}] — company_discovery taxonomy
  classification_confidence TEXT
    CHECK (classification_confidence IN ('low','medium','high')),
  classified_at             TIMESTAMPTZ,
  classification_model      TEXT,
  classification_source     TEXT
    CHECK (classification_source IN ('seeded_from_user_review','job','job_serp')),
  poll_failures             INT NOT NULL DEFAULT 0,
  UNIQUE (ats, token)
);

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,             -- '{ats}:{token}:{external_id}'
  company_id    INT NOT NULL REFERENCES companies(id),
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  location      TEXT,
  department    TEXT,
  remote        BOOLEAN,
  location_canonicals TEXT[],                 -- stamped from locations.canonicals; NULL = not yet resolved
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  description   TEXT,                         -- cached full JD plaintext (from the ATS payload)
  description_pruned BOOLEAN NOT NULL DEFAULT FALSE  -- legacy pruning marker; current maintenance never strips shared descriptions
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;
-- Lets the analytics "job lifespan" query (WHERE closed_at IS NOT NULL — a small
-- minority of rows) use a bitmap index scan instead of a full seq scan of the large
-- jobs table. (The whole-table funnel count still seq-scans, which is correct for a
-- full count.) The durable fix for the /analytics load is the request-level caching.
CREATE INDEX idx_jobs_closed_at ON jobs (closed_at);
-- Poller: get_open_external_ids / close_jobs filter WHERE company_id = $1 AND closed_at IS NULL.
CREATE INDEX idx_jobs_company_open ON jobs (company_id) WHERE closed_at IS NULL;
CREATE INDEX idx_jobs_location_canonicals ON jobs USING GIN (location_canonicals);

-- Raw->canonical location cache, poller-owned (service-only: RLS on, no policies,
-- no grants). See docs/superpowers/specs/2026-07-16-location-dedupe-design.md.
CREATE TABLE locations (
  raw         TEXT PRIMARY KEY,
  canonicals  TEXT[] NOT NULL,
  components  JSONB NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Per-job application question schema, fetched once at poll time (Greenhouse only
-- today). GLOBAL/shared job data — no user_id; keyed by jobs.id. Populated by the
-- poller; the dashboard reads it job-level (shared_read) and the Prefill route uses
-- it to draft answers + decide whether the posting asks for a cover letter.
CREATE TABLE job_questions (
  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE poll_runs (
  id               SERIAL PRIMARY KEY,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  companies_ok     INT,
  companies_failed INT,
  new_jobs         INT,
  closed_jobs      INT,
  notes            TEXT
);
-- Dashboard getLatestPollRun / pipeline health sort on started_at.
CREATE INDEX idx_poll_runs_started_at ON poll_runs (started_at DESC);

-- one row per user (the operator). user_id mirrors auth.users(id) in production,
-- but no FK: auth.users is Supabase-managed and absent in the throwaway test DB.
CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY,
  resume_text      TEXT,
  resume_file_path TEXT,
  instructions     TEXT,
  model_stage1     TEXT,                     -- OpenRouter model id; NULL = default
  model_stage2     TEXT,                     -- OpenRouter model id; NULL = default
  preferred_locations TEXT[] NOT NULL DEFAULT '{}',  -- location include-list; empty = no pre-filter
  model_resume     TEXT,                     -- OpenRouter model id; NULL = default
  company_instructions    TEXT,
  company_profile_version TEXT,
  model_company           TEXT,
  board_filters    JSONB,                     -- remembered board filter state; NULL = defaults
  -- Structured company facet exclusions: {industries[], countries[], sizes[],
  -- redFlagCategories[]}. Deterministic per-user gate (no LLM); enforced in the
  -- reviewer + board. See migrations/2026-07-21-company-classification.sql.
  company_exclusions JSONB,
  -- Reusable application answers (do not affect review verdicts).
  full_name         TEXT,
  email             TEXT,
  phone             TEXT,
  links             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { linkedin, github, portfolio }
  location          TEXT,
  work_authorized   BOOLEAN,                  -- tri-state; NULL = unspecified
  needs_sponsorship BOOLEAN,                  -- tri-state; NULL = unspecified
  eeo_gender        TEXT,                     -- voluntary EEO; NULL = declined
  eeo_race          TEXT,
  eeo_veteran       TEXT,
  eeo_disability    TEXT,
  screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { notice_period, salary_expectation, relocation, … }
  model_cover       TEXT,                     -- OpenRouter model id; NULL = default
  -- Reasoning effort for generation ('low'|'medium'|'high'); NULL = off (default).
  -- medium/high are Pro-gated (dashboard/lib/entitlements.ts, TS-only).
  reasoning_effort_resume TEXT CHECK (reasoning_effort_resume IN ('low', 'medium', 'high')),
  reasoning_effort_cover  TEXT CHECK (reasoning_effort_cover  IN ('low', 'medium', 'high')),
  -- Standing generation guidance, layered UNDER the per-job instruction boxes at
  -- generate time. Reviewer-independent: NOT part of profile_version.
  resume_generation_instructions       TEXT,
  cover_letter_generation_instructions TEXT,
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optional per-user override of the env daily review cap (reviewer/config.py
  -- DAILY_REVIEW_CAP_DEFAULT). NULL = use the env default.
  daily_review_cap INT
);

-- one current verdict per (user, job); re-review upserts in place
CREATE TABLE job_reviews (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version      TEXT NOT NULL,
  stage1_decision      TEXT CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason        TEXT,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  human_override       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = operator set this verdict by hand
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning            TEXT,
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown')),
  about                TEXT,
  pay_min              INT,
  pay_max              INT,
  pay_currency         TEXT,
  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
  headcount            TEXT,
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,
  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_stage1         TEXT,
  model_stage2         TEXT,
  error                TEXT,
  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_reviews_scores_range CHECK (
    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);
CREATE INDEX idx_job_reviews_user_profile_version ON job_reviews (user_id, profile_version);
-- FK-cascade lookup: jobs DELETE cascades require job_id-leading index on child tables.
CREATE INDEX idx_job_reviews_job ON job_reviews (job_id);

-- Human corrections to model reviews — a golden-dataset OVERLAY. Never mutates
-- job_reviews or the reviewer pipeline; read-time COALESCE lets it drive display.
-- model_snapshot preserves the model's job_reviews values at correction time so
-- the model-vs-human diff survives later re-reviews.
CREATE TABLE review_corrections (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN
                         ('remote','hybrid','onsite','unknown')),
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,        -- recomputed from corrected sub-scores at save time
  reasoning            TEXT,
  about                TEXT,
  pay_min              INT,
  pay_max              INT,
  pay_currency         TEXT,
  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
  headcount            TEXT,
  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  note                 TEXT,
  -- Frozen at correction time so golden-dataset eval inputs survive JD pruning and profile drift.
  description_snapshot  TEXT,
  resume_text_snapshot  TEXT,
  instructions_snapshot TEXT,
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_corrections_scores_range CHECK (
    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
  PRIMARY KEY (user_id, job_id)
);
-- Redundant idx_review_corrections_user removed: PK (user_id, job_id) already serves user_id-leading lookups.
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX idx_review_corrections_job ON review_corrections (job_id);

-- accounting, mirrors poll_runs. user_id attributes a run to the user it reviewed
-- (multi-tenant); NULL for legacy rows written before the column existed.
CREATE TABLE review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,
  gate_rejected INT,
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT,
  user_id       UUID
);
CREATE INDEX idx_review_runs_started_at ON review_runs (started_at DESC);

-- one current verdict per (user, company); re-review upserts in place
CREATE TABLE company_reviews (
  user_id                 UUID NOT NULL,
  company_id              INT  NOT NULL REFERENCES companies(id),
  company_profile_version TEXT NOT NULL,
  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning               TEXT,
  industry                TEXT,
  industry_subcategory    TEXT,
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of {category, note}: category is one of RED_FLAG_CATEGORIES
  -- (company_discovery/schemas.py); note is optional free text (required for
  -- category='other'). Backfilled by company_discovery/reclassify.py.
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_override          BOOLEAN NOT NULL DEFAULT FALSE,
  override_verdict        TEXT CHECK (override_verdict IN ('include','exclude')),
  model                   TEXT,
  error                   TEXT,
  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX idx_company_reviews_user_verdict ON company_reviews (user_id, verdict);
CREATE INDEX idx_company_reviews_user_version ON company_reviews (user_id, company_profile_version);

-- Admin-triggered LLM classification runs (migrations/2026-07-21-company-classification.sql).
-- Service/admin only: RLS deny-all, NO grants — the dashboard admin UI reads/writes via
-- serviceSql (postgres role bypasses RLS). RLS enable/policy sit in the RLS section below.
CREATE TABLE classification_jobs (
  id             SERIAL PRIMARY KEY,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','done','canceled','error')),
  model          TEXT NOT NULL,
  company_cap    INT NOT NULL CHECK (company_cap > 0),
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('unclassified','unknown_repass','all')),
  use_serp       BOOLEAN NOT NULL DEFAULT FALSE,
  est_cost       NUMERIC(10,4),
  processed      INT NOT NULL DEFAULT 0,
  errored        INT NOT NULL DEFAULT 0,
  serp_queries   INT NOT NULL DEFAULT 0,
  actual_prompt_tokens     BIGINT NOT NULL DEFAULT 0,
  actual_completion_tokens BIGINT NOT NULL DEFAULT 0,
  actual_cost    NUMERIC(10,4),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  last_progress_at TIMESTAMPTZ,   -- progress heartbeat; stale-job recovery gate (worker.py)
  finished_at    TIMESTAMPTZ
);

-- Per-user manual include/exclude (migrations/2026-07-21-company-classification.sql).
-- Replaces company_reviews.human_override/override_verdict. Owner-scoped RLS + grant sit
-- in the RLS/grants sections below (owner_access references public.app_user_id(), which is
-- defined further down, so the policy cannot live inline here).
CREATE TABLE company_overrides (
  user_id    UUID NOT NULL,          -- mirrors auth.users; deliberately no FK (house convention)
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verdict    TEXT NOT NULL CHECK (verdict IN ('include','exclude')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX idx_company_overrides_company ON company_overrides (company_id);

-- accounting for discovery pipeline runs
CREATE TABLE discovery_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','halted_no_credits','error')),
  ingested    INT, reviewed INT, included INT, excluded INT, unknown INT,
  errors      INT, backlog  INT,
  notes       TEXT
);
CREATE INDEX idx_discovery_runs_started_at ON discovery_runs (started_at DESC);

-- singleton row tracking global discovery state (e.g. credit exhaustion)
CREATE TABLE discovery_state (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
  resume_requested_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO discovery_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- one prepared application package per (user, job); re-preparing upserts in place.
-- Persists the tailored résumé/cover letter so the board stops regenerating on every
-- click, plus (Greenhouse only) the fetched question schema and the LLM-prefilled
-- answers for the posting. user_id mirrors auth.users(id) with no FK (see profiles).
CREATE TABLE application_packages (
  id                   SERIAL PRIMARY KEY,
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_json          JSONB,                 -- TailoredResume (NULL until generated)
  cover_letter_json    JSONB,                 -- TailoredCoverLetter (NULL until generated)
  answers_snapshot     JSONB,                 -- reusable profile answers at prepare time
  greenhouse_questions JSONB,                 -- parsed GH question schema (NULL = not GH / fetch failed)
  prefilled_answers    JSONB,                 -- [{ question, answer }] mapped by the LLM (NULL = none)
  apply_url            TEXT,
  resume_trace_id      TEXT,
  cover_letter_trace_id TEXT,
  resume_instructions             TEXT,  -- per-job "Generation instructions" (résumé leg)
  cover_letter_instructions       TEXT,  -- per-job "Generation instructions" (cover-letter leg)
  resume_instructions_draft       TEXT,  -- saved draft of the résumé instructions box (survives reload; NULL = mirror generated-with)
  cover_letter_instructions_draft TEXT,  -- saved draft of the cover-letter instructions box
  profile_version      TEXT,                  -- profiles.profile_version at generation time (NULL = pre-column row)
  status               TEXT NOT NULL DEFAULT 'prepared'
                         CHECK (status IN ('prepared','applied')),
  prepared_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ,
  CONSTRAINT applied_iff_timestamp CHECK ((status = 'applied') = (applied_at IS NOT NULL)),
  UNIQUE (user_id, job_id)
);
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX idx_application_packages_job ON application_packages (job_id);

-- Résumé-generation eval golden dataset (see migrations/2026-07-02-resume-scores.sql).
CREATE TABLE resume_scores (
  user_id          UUID NOT NULL,
  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
  comment          TEXT,
  resume_trace_id  TEXT,
  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  model            TEXT,
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_resume_scores_user ON resume_scores (user_id);

-- Cover-letter edit overlay (see migrations/2026-07-07-cover-letter-edits.sql).
CREATE TABLE cover_letter_edits (
  user_id               UUID NOT NULL,
  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  edited_text           TEXT NOT NULL,
  original_text         TEXT,
  cover_letter_trace_id TEXT,
  model                 TEXT,
  comment               TEXT,
  superseded_at         TIMESTAMPTZ,
  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_cover_letter_edits_user ON cover_letter_edits (user_id);
CREATE INDEX idx_cover_letter_edits_job ON cover_letter_edits (job_id);

-- Multi-tenant foundation (see migrations/2026-07-03-multitenant-foundation.sql).
-- Invite-gated signup: invite_codes + invite_redemptions are the server-side source
-- of truth for "this account was invited" (user_metadata is client-settable and must
-- NOT be trusted).
CREATE TABLE invite_codes (
  code       TEXT PRIMARY KEY,
  note       TEXT,
  max_uses   INT NOT NULL DEFAULT 1,
  uses       INT NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TIMESTAMPTZ,
  -- NULL = operator/admin-minted. Named created_by, NOT the account-id column the erasure
  -- drift guards + deletion loop key on, deliberately: erasure here is a custom ANONYMIZE
  -- (see 2026-07-13-user-invites.sql), never that per-account DELETE. (This comment avoids
  -- the literal column-name token on purpose: the drift guard scans CREATE TABLE bodies
  -- for it, and this table has no such column — mentioning it here would false-positive.)
  created_by      UUID,
  -- Recorded for emailed invites (bookkeeping only — redemption does not enforce it).
  recipient_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One redemption per email — the trusted proof an account was invited.
CREATE TABLE invite_redemptions (
  email       TEXT NOT NULL,
  code        TEXT NOT NULL REFERENCES invite_codes(code),
  user_id     UUID,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email)
);

-- Per-user, per-day usage counters. kind='review' backs the reviewer's rolling
-- daily budget; generation kinds arrive in Phase 1. "Reset at midnight" falls out
-- of the (user_id, day) key — no cron.
CREATE TABLE usage_counters (
  user_id UUID NOT NULL,
  day     DATE NOT NULL,
  kind    TEXT NOT NULL,
  n       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

-- Billing (see migrations/2026-07-03-billing-review-requests.sql). Local mirror of
-- Stripe truth, keyed by user_id; the Stripe webhook (service role) is the sole
-- writer. No FK to auth.users (house convention, see profiles).
CREATE TABLE subscriptions (
  user_id                UUID PRIMARY KEY,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan                   TEXT CHECK (plan IN ('standard','pro')),
  status                 TEXT NOT NULL,             -- raw Stripe status string
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  last_event_at          TIMESTAMPTZ,               -- Stripe event.created watermark (M-WEBHOOK-ORDER)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- On-demand "review my board now" queue, shared by the dashboard (enqueue) and the
-- reviewer worker (claim + status transition). One active request per user.
CREATE TABLE review_requests (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','done','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  notes        TEXT
);
CREATE UNIQUE INDEX one_active_review_request
  ON review_requests (user_id) WHERE status IN ('pending','running');
CREATE INDEX idx_review_requests_pending
  ON review_requests (requested_at) WHERE status = 'pending';

-- DB-overridable tier settings (see migrations/2026-07-04-tier-settings.sql). ONE
-- jsonb config row per plan that OVERLAYS the compiled entitlement/price defaults
-- field-by-field (dashboard/lib/tierConfig.ts, reviewer.db.load_tier_settings) so
-- caps/allowances/prices are tunable WITHOUT a redeploy. Shared operator policy (not
-- per-user); empty by default = use the compiled defaults everywhere.
CREATE TABLE tier_settings (
  plan       TEXT PRIMARY KEY CHECK (plan IN ('standard','pro')),
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-sent invites (see migrations/2026-07-13-user-invites.sql). The invite_codes
-- attribution columns (created_by, recipient_email) live in that table above; the RLS
-- enable/policies/GRANTs for the two tables below sit in the RLS section further down
-- (they reference public.app_user_id()/the anon+authenticated roles, which are only
-- defined there — schema.sql builds top-to-bottom on a DROP SCHEMA'd DB).

-- Sender-scoped lookups (deletion scrub, export of "codes I minted").
CREATE INDEX idx_invite_codes_created_by
  ON invite_codes (created_by) WHERE created_by IS NOT NULL;

-- Per-user invite budget. Rows are lazy-created on first invite action with the
-- then-current default (app_settings.invite_default_allowance); `granted` records the
-- initial grant. Service-write-only (dashboard/lib/invites.ts); the owner may only
-- SELECT their own count.
CREATE TABLE invite_allowances (
  user_id    UUID PRIMARY KEY,
  remaining  INT NOT NULL CHECK (remaining >= 0),
  granted    INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operator-pinned effective tier (see migrations/2026-07-16-plan-overrides.sql).
-- An ACTIVE row (expires_at NULL or future) wins over subscription + invite comp in
-- resolvePlan/resolve_plan. Service-write-only; owner may SELECT their own pin.
CREATE TABLE plan_overrides (
  user_id    UUID PRIMARY KEY,
  plan       TEXT NOT NULL CHECK (plan IN ('standard','pro')),
  expires_at TIMESTAMPTZ,          -- NULL = pinned until cleared
  note       TEXT,                 -- operator memo ("comped for feedback")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic operator key-value config (deliberately separate from tier_settings, whose PK
-- is CHECK-constrained to plan names). Shared operator RLS like tier_settings; ALL writes
-- are service-role (admin-gated dashboard/lib/appSettings.ts).
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account-deletion erasure ledger (see migrations/2026-07-04-account-deletions.sql).
-- One row per deleted account, keyed by user_id, with a HASH of the email (never
-- plaintext) as tamper-evident proof of erasure. Written by the deletion cascade
-- (dashboard/lib/accountDeletion.ts) via the service role; users never read it.
CREATE TABLE account_deletions (
  user_id    UUID PRIMARY KEY,
  email_hash TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OpenRouter spend-alert snapshots (see migrations/2026-07-04-openrouter-usage-snapshots.sql).
-- observability.spend_alert (Railway cron) records total_usage/total_credits here and
-- differences the trailing-24h window to compute burn. Service-role only.
CREATE TABLE openrouter_usage_snapshots (
  taken_at      TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  total_usage   NUMERIC NOT NULL,
  total_credits NUMERIC
);

-- Async generation tracking (see migrations/2026-07-05-generation-jobs.sql). The
-- generate routes 202 immediately and settle the row from a background `after()`
-- callback; the dashboard polls GET /api/generations for completion toasts.
-- `error` holds the USER-SAFE failure/partial-failure message. kind='prepare' is
-- the multi-leg prepare tracked as one row.
CREATE TABLE generation_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  -- kind='prepare' backs the Greenhouse "Prefill application" action (user-facing
  -- label is "Prefill"; the internal identifier stays 'prepare' to avoid a
  -- kind-constraint migration + dual-value transition). See the /api/application/prepare route.
  kind       TEXT NOT NULL CHECK (kind IN ('resume','cover','prepare')),
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','failed')),
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX idx_generation_jobs_job ON generation_jobs (job_id);
-- Poll query: the viewer's pending rows + recently-settled rows.
CREATE INDEX idx_generation_jobs_user ON generation_jobs (user_id, status);
-- One in-flight generation per (user, job, kind); settled rows don't block a rerun.
CREATE UNIQUE INDEX one_pending_generation
  ON generation_jobs (user_id, job_id, kind) WHERE status = 'pending';

-- Applied-migrations ledger. Record each migration with:
--   INSERT INTO schema_migrations (filename) VALUES ('<file>');
-- when applied. Every new migration must be idempotent, transactional where
-- possible, and recorded here so the applied set is auditable.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-level security. The app and reviewer connect via a privileged DIRECT connection
-- (DATABASE_URL) that bypasses RLS; nothing is served through the anon/PostgREST API.
-- Each table gets RLS enabled plus one explicit permissive deny-all policy so the
-- "no API access; served server-side" intent is declarative and Supabase's
-- rls_enabled_no_policy advisor (lint 0008) stays clear. Portable to plain Postgres:
-- no Supabase-specific roles or auth.* functions, and test queries run as a superuser
-- that bypasses RLS. Mirrors migrations/2026-06-26-rls-deny-all-policies.sql.
ALTER TABLE companies    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON companies   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON jobs        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE poll_runs    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON poll_runs   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON profiles    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE job_reviews  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON job_reviews FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_runs      ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_runs      FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE company_reviews  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON company_reviews  FOR ALL USING (false) WITH CHECK (false);
-- See migrations/2026-07-21-company-classification.sql. classification_jobs is service-only
-- (deny-all is its whole contract); company_overrides also gets owner_access further down.
ALTER TABLE classification_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON classification_jobs FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE company_overrides   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON company_overrides   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_runs   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_runs   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE discovery_state  ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON discovery_state  FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON application_packages FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE resume_scores        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON resume_scores        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE cover_letter_edits   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON cover_letter_edits   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_corrections   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_corrections   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE schema_migrations    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON schema_migrations    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE invite_codes         ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON invite_codes         FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE invite_redemptions   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON invite_redemptions   FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE usage_counters       ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON usage_counters       FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON subscriptions        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE review_requests      ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON review_requests      FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE tier_settings        ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON tier_settings        FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE account_deletions    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON account_deletions    FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE openrouter_usage_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON openrouter_usage_snapshots FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE generation_jobs      ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON generation_jobs      FOR ALL USING (false) WITH CHECK (false);
-- See migrations/2026-07-13-user-invites.sql.
ALTER TABLE invite_allowances    ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON invite_allowances    FOR ALL USING (false) WITH CHECK (false);
-- See migrations/2026-07-16-plan-overrides.sql.
ALTER TABLE plan_overrides       ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON plan_overrides       FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE app_settings         ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON app_settings         FOR ALL USING (false) WITH CHECK (false);

-- ── Phase-1 tenant isolation (mirrors migrations/2026-07-03-rls-tenant-isolation.sql
-- + the per-user policies of 2026-07-03-billing-review-requests.sql) ────────────
-- Real per-user RLS with teeth. The dashboard drops into the `authenticated` role
-- per-transaction (SET LOCAL ROLE + request.jwt.claims); public.app_user_id() reads
-- the JWT `sub` out of that GUC. The privileged `postgres`/service role OWNS these
-- tables and bypasses RLS, so the reviewer, pollers, discovery, the Stripe webhook,
-- and the invite path are unaffected. The deny-all policies above OR harmlessly with
-- these permissive ones. Roles are DO-guarded so schema.sql loads on plain Postgres
-- (the test DB), where the roles survive DROP SCHEMA public CASCADE (cluster-level).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- search_path pinned (mirrors migrations/2026-07-05-app-user-id-search-path.sql): this
-- SECURITY-critical RLS resolver touches only pg_catalog built-ins, so pinning it to
-- pg_catalog fixes the function_search_path_mutable advisor while leaving behaviour
-- identical.
CREATE OR REPLACE FUNCTION public.app_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $$
DECLARE
  claims text;
  sub    text;
BEGIN
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;
  sub := (claims::json ->> 'sub');
  IF sub IS NULL OR sub = '' THEN
    RETURN NULL;
  END IF;
  RETURN sub::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Owner policies (SELECT/INSERT/UPDATE/DELETE own rows only).
CREATE POLICY owner_access ON profiles FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON job_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON review_corrections FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON company_reviews FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON application_packages FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON resume_scores FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON cover_letter_edits FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON usage_counters FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_access ON generation_jobs FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
-- Per-user company include/exclude (2026-07-21-company-classification): owner CRUD.
CREATE POLICY owner_access ON company_overrides FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
-- Per-user invite budget: owner may READ their own count; writes are service-role
-- (dashboard/lib/invites.ts). See migrations/2026-07-13-user-invites.sql.
CREATE POLICY owner_read ON invite_allowances FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
-- Operator-pinned effective tier: owner may READ their own pin; writes are service-role
-- (dashboard/lib/planOverrides.ts). See migrations/2026-07-16-plan-overrides.sql.
CREATE POLICY owner_read ON plan_overrides FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- Shared-read policies (global corpus + pipeline accounting).
CREATE POLICY shared_read ON jobs      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shared_read ON companies FOR SELECT TO anon, authenticated USING (true);
-- job_questions: shared like jobs/companies (poll-time Greenhouse question schema);
-- writes are poller/service-role only (no anon/authenticated write grant below).
ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY shared_read ON job_questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shared_read ON poll_runs       FOR SELECT TO authenticated USING (true);
CREATE POLICY shared_read ON discovery_runs  FOR SELECT TO authenticated USING (true);
CREATE POLICY shared_read ON discovery_state FOR SELECT TO authenticated USING (true);
CREATE POLICY owner_or_legacy_read ON review_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR user_id IS NULL);

-- Billing per-user policies (webhook/worker keep the service role).
CREATE POLICY owner_read ON subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_read ON review_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY owner_insert ON review_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- Tier settings: shared operator policy (not per-user). Writes are service-role only.
CREATE POLICY shared_read ON tier_settings FOR SELECT TO anon, authenticated USING (true);
-- app_settings: shared operator config, same shape as tier_settings (values non-secret).
-- Writes are service-role only. See migrations/2026-07-13-user-invites.sql.
CREATE POLICY shared_read ON app_settings FOR SELECT TO anon, authenticated USING (true);

-- Grants (table privilege is the outer gate; RLS filters within — a granted table
-- with no matching policy returns zero rows, not permission-denied). This block is a
-- positive ALLOWLIST: it first strips every default anon/authenticated privilege
-- (Supabase grants full arwdDxt by default) so a slipped RLS policy is not the only
-- gate, then re-grants exactly what each role needs. Mirrors
-- migrations/2026-07-04-cost-cap-hardening.sql (finding B-COST).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON jobs, companies, poll_runs, discovery_runs, discovery_state, review_runs
  TO authenticated;
-- Owner-scoped CRUD (usage_counters excluded — SELECT-only for users; writes are
-- service-role only, so a user cannot zero their own review/generation counters).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  job_reviews, review_corrections, company_reviews, application_packages, resume_scores,
  cover_letter_edits, company_overrides
  TO authenticated;
-- generation_jobs: owner-scoped CRUD (DELETE backs the per-user housekeeping prune of
-- old settled rows). Cost integrity is unaffected: allowance charges live in
-- usage_counters (SELECT-only above) and status rows never drive refunds server-side.
GRANT SELECT, INSERT, UPDATE, DELETE ON generation_jobs TO authenticated;
GRANT SELECT ON usage_counters TO authenticated;
-- profiles: full user control EXCEPT the operator-only cost lever daily_review_cap.
-- INSERT/UPDATE are column-level over every column but daily_review_cap. (A bare
-- REVOKE UPDATE (daily_review_cap) would NOT work: a table-level UPDATE grant is not
-- affected by a column-level revoke — the column stays writable. So we grant only the
-- allowed columns.) Keep this list in sync with the profiles table when a column is
-- ADDED (new columns default to non-user-writable — the safe direction).
GRANT SELECT, DELETE ON profiles TO authenticated;
GRANT INSERT (user_id, resume_text, resume_file_path, instructions, model_stage1,
              model_stage2, preferred_locations, model_resume, company_instructions,
              company_profile_version, model_company, board_filters, company_exclusions,
              full_name, email,
              phone, links, location, work_authorized, needs_sponsorship, eeo_gender,
              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
              reasoning_effort_resume, reasoning_effort_cover,
              resume_generation_instructions, cover_letter_generation_instructions,
              profile_version, updated_at)
  ON profiles TO authenticated;
GRANT UPDATE (resume_text, resume_file_path, instructions, model_stage1,
              model_stage2, preferred_locations, model_resume, company_instructions,
              company_profile_version, model_company, board_filters, company_exclusions,
              full_name, email,
              phone, location, links, work_authorized, needs_sponsorship, eeo_gender,
              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
              reasoning_effort_resume, reasoning_effort_cover,
              resume_generation_instructions, cover_letter_generation_instructions,
              profile_version, updated_at)
  ON profiles TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT, INSERT ON review_requests TO authenticated;
GRANT USAGE ON SEQUENCE application_packages_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE review_requests_id_seq TO authenticated;
-- anon reads the public board + gets SELECT (no policy → zero rows) on the two
-- review tables getJobReviewDetail LEFT JOINs so its anon query isn't denied.
GRANT SELECT ON jobs, companies, job_reviews, review_corrections TO anon;
-- Tier settings: shared operator config read by the dashboard (withAnonSql) + reviewer.
GRANT SELECT ON tier_settings TO anon, authenticated;
-- job_questions: shared read for the board/Prefill route; writes are poller/service-role only.
GRANT SELECT ON job_questions TO anon, authenticated;
-- invite_allowances: owner reads own count (writes service-role). app_settings: shared
-- operator config read (writes service-role). See migrations/2026-07-13-user-invites.sql.
GRANT SELECT ON invite_allowances TO authenticated;
-- plan_overrides: owner reads own pin (writes service-role). See
-- migrations/2026-07-16-plan-overrides.sql.
GRANT SELECT ON plan_overrides TO authenticated;
GRANT SELECT ON app_settings TO anon, authenticated;

-- Default-privilege deny (mirrors migrations/2026-07-05-default-privileges-revoke.sql,
-- finding minor 6): the REVOKE above only touches tables that exist NOW. Strip the
-- default anon/authenticated grant for FUTURE tables + sequences too, so a new table
-- starts deny-by-default and its creating migration must explicitly grant the intended
-- subset (the safe direction). Owner (postgres/service role) bypasses grants + RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Storage RLS (résumé bucket) is NOT represented here: the `storage` schema is
-- Supabase-managed and does not exist in the plain-Postgres test DB this file
-- builds. Per-prefix tenant isolation for `storage.objects` (bucket `resumes`,
-- finding B-STORAGE) lives in migrations/2026-07-04-resume-bucket-storage-policies.sql
-- and MUST be applied to the live Supabase project + live cross-account verified
-- (see that file's header). tests/test_resume_storage_policies.py proves the policy
-- predicate against a faithful in-DB mock of the storage/auth schema.


-- BEGIN mirrored 2026-10-02-matching-activity.sql
-- Existing users receive a seven-day rollout grace period. No historical GET,
-- last login, profile updated_at or background job is treated as meaningful activity.
CREATE TABLE IF NOT EXISTS matching_activity (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  last_meaningful_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz
);
ALTER TABLE matching_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read ON matching_activity;
CREATE POLICY owner_read ON matching_activity FOR SELECT TO authenticated
  USING (user_id = public.app_user_id());
REVOKE ALL ON matching_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON matching_activity TO authenticated;
INSERT INTO matching_activity(user_id) SELECT user_id FROM profiles ON CONFLICT DO NOTHING;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS resume_requested boolean NOT NULL DEFAULT false;
-- Fences late completions after stale recovery/reclaim across worker processes.
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS claim_version bigint NOT NULL DEFAULT 0;

-- Only the actual, non-trial paid subscription mirror qualifies. Align expiry's
-- three-day grace with the existing entitlement resolver, ignoring comp/override tiers.
CREATE OR REPLACE FUNCTION matching_paused(uid uuid) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
 SELECT NOT EXISTS (
   SELECT 1 FROM subscriptions s WHERE s.user_id=uid AND s.plan IN ('standard','pro')
     AND s.status='active' AND nullif(s.stripe_subscription_id,'') IS NOT NULL
     AND s.current_period_end + interval '3 days' > clock_timestamp()
 ) AND EXISTS (
   SELECT 1 FROM matching_activity a WHERE a.user_id=uid
     AND (a.paused_at IS NOT NULL OR a.last_meaningful_at <= clock_timestamp()-interval '7 days')
 )
$$;
-- Supabase defaults grant EXECUTE directly to anon/authenticated as well as
-- PUBLIC. Reset all client grants; retain existing service_role backend access.
REVOKE ALL ON FUNCTION matching_paused(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION matching_paused(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION track_matching_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
BEGIN
 IF TG_TABLE_NAME='profiles' AND TG_OP='INSERT' THEN
   INSERT INTO matching_activity(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
 ELSIF current_setting('role',true)='authenticated' AND actor=public.app_user_id()
       AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE user_id=actor) THEN
   -- Preserve the expiry BEFORE advancing activity. Only explicit resume clears it.
   UPDATE matching_activity SET
     paused_at=CASE WHEN public.matching_paused(actor) THEN coalesce(paused_at,clock_timestamp()) ELSE paused_at END,
     last_meaningful_at=clock_timestamp() WHERE user_id=actor;
 END IF;
 RETURN NEW;
END
$$;
-- Trigger execution needs no caller EXECUTE grant; this is not a client RPC.
REVOKE ALL ON FUNCTION track_matching_activity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS initialize_matching_activity ON profiles;
CREATE TRIGGER initialize_matching_activity AFTER INSERT ON profiles
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
-- Deliberate saved profile/preferences changes; no generic updated_at trigger.
-- board_filters is excluded: pagehide beacons can persist it without a user edit.
DROP TRIGGER IF EXISTS profile_matching_activity ON profiles;
CREATE TRIGGER profile_matching_activity AFTER UPDATE OF resume_text,instructions,
 preferred_locations,company_exclusions,company_instructions,
 full_name,email,phone,links,location,screening_answers,
 resume_generation_instructions,cover_letter_generation_instructions ON profiles
 FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW) EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS correction_matching_activity ON review_corrections;
CREATE TRIGGER correction_matching_activity AFTER INSERT ON review_corrections
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS company_override_matching_activity ON company_overrides;
CREATE TRIGGER company_override_matching_activity AFTER INSERT OR UPDATE ON company_overrides
 FOR EACH ROW EXECUTE FUNCTION track_matching_activity();

-- Only manual verdict changes and applied-state transitions count; generated
-- package content and automatic AI reviews never advance the activity clock.
DROP TRIGGER IF EXISTS reject_insert_matching_activity ON job_reviews;
CREATE TRIGGER reject_insert_matching_activity AFTER INSERT ON job_reviews
 FOR EACH ROW WHEN (NEW.human_override) EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS reject_update_matching_activity ON job_reviews;
CREATE TRIGGER reject_update_matching_activity AFTER UPDATE OF human_override,verdict ON job_reviews
 FOR EACH ROW WHEN ((OLD.human_override OR NEW.human_override) AND OLD IS DISTINCT FROM NEW)
 EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_insert_matching_activity ON application_packages;
CREATE TRIGGER applied_insert_matching_activity AFTER INSERT ON application_packages
 FOR EACH ROW WHEN (NEW.status='applied') EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_update_matching_activity ON application_packages;
CREATE TRIGGER applied_update_matching_activity AFTER UPDATE OF status ON application_packages
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND (OLD.status='applied' OR NEW.status='applied'))
 EXECUTE FUNCTION track_matching_activity();
DROP TRIGGER IF EXISTS applied_delete_matching_activity ON application_packages;
CREATE TRIGGER applied_delete_matching_activity AFTER DELETE ON application_packages
 FOR EACH ROW WHEN (OLD.status='applied') EXECUTE FUNCTION track_matching_activity();

-- Serialize resume calls on this user's activity row. Queue insertion and state
-- change commit together; RLS is supplemented with a checked server JWT identity.
CREATE OR REPLACE FUNCTION resume_matching() RETURNS TABLE(status text, existing boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.app_user_id(); was_paused boolean; req review_requests%ROWTYPE;
BEGIN
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

INSERT INTO schema_migrations(filename) VALUES ('2026-10-02-matching-activity.sql') ON CONFLICT DO NOTHING;
-- END mirrored 2026-10-02-matching-activity.sql


-- BEGIN mirrored 2026-10-02-feedback.sql
-- Authenticated feedback: owner export reads; all writes go through the bounded RPC.
-- Requires tenant-isolation identity helper and account-deletions migration.
CREATE TABLE IF NOT EXISTS public.feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('issue', 'criticism', 'feature_request')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.feedback_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;
DROP POLICY IF EXISTS feedback_owner_read ON public.feedback;
CREATE POLICY feedback_owner_read ON public.feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_message text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE caller uuid := public.app_user_id();
BEGIN
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
INSERT INTO schema_migrations (filename) VALUES ('2026-10-02-feedback.sql') ON CONFLICT DO NOTHING;
-- END mirrored 2026-10-02-feedback.sql

-- Lifecycle core (2026-10-03-01).
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
-- Capacity subjects belong to one claim generation, independently of the service
-- invoking identity. First binding fixes even a NULL (public) subject.
ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_id uuid;
ALTER TABLE lifecycle_claims ADD COLUMN IF NOT EXISTS reservation_subject_bound boolean NOT NULL DEFAULT false;
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
-- writer. Authenticated row triggers append owner receipts; direct client
-- INSERT/UPDATE/DELETE is forbidden. Helpers below read claims/reservations ONLY.
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
 -- PostgreSQL lets any caller consume a deferred constraint early. Only the
 -- actual top-level, standalone transaction boundary may run this AFTER check.
 -- current_query() is server-provided, not a GUC. Fail closed for comments,
 -- multi-statements, SET CONSTRAINTS, implicit/autocommit and PREPARE TRANSACTION.
 -- Supported writers explicitly finish with COMMIT/END [WORK|TRANSACTION].
 IF TG_WHEN='AFTER' AND COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
  RAISE EXCEPTION 'lifecycle receipts require standalone COMMIT or END validation';
 END IF;
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
 rid uuid; json_keys text[];
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
 IF NEW.state='held' AND NEW.backend_pid IS NOT NULL THEN
  IF c.reservation_subject_bound AND c.reservation_subject_id IS DISTINCT FROM NEW.subject_id THEN
   RAISE EXCEPTION 'capacity claim already bound to another subject owner'; END IF;
  IF c.subject_id IS NOT NULL AND c.subject_id IS DISTINCT FROM NEW.subject_id THEN
   RAISE EXCEPTION 'capacity subject differs from claim owner'; END IF;
  IF NOT c.reservation_subject_bound THEN
   UPDATE public.lifecycle_claims SET reservation_subject_bound=true,reservation_subject_id=NEW.subject_id
    WHERE kind=c.kind AND work_id=c.work_id;
  END IF;
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
 IF NEW.generation=OLD.generation AND OLD.reservation_subject_bound AND
 (NOT NEW.reservation_subject_bound OR NEW.reservation_subject_id IS DISTINCT FROM OLD.reservation_subject_id) THEN
  RAISE EXCEPTION 'capacity subject requires a fenced generation'; END IF;
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
DECLARE jid text;
BEGIN
 PERFORM pg_advisory_xact_lock(20916294442894917);
 -- Service erasure prelocks the entire owner Job set before claim/child rows.
 FOR jid IN SELECT job_id FROM (
  SELECT job_id FROM public.job_reviews WHERE user_id=target
  UNION SELECT job_id FROM public.review_corrections WHERE user_id=target
  UNION SELECT job_id FROM public.application_packages WHERE user_id=target
  UNION SELECT job_id FROM public.resume_scores WHERE user_id=target
  UNION SELECT job_id FROM public.cover_letter_edits WHERE user_id=target
  UNION SELECT job_id FROM public.generation_jobs WHERE user_id=target
  UNION SELECT job_id FROM public.job_payload_demands WHERE user_id=target
  UNION SELECT job_id FROM public.capacity_reservations WHERE subject_id=target
 ) owned WHERE job_id IS NOT NULL ORDER BY job_id COLLATE "C" LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0));
 END LOOP;
 UPDATE public.lifecycle_claims c SET replay_floor=generation,generation=generation+1,
 state='cancelled',terminal_at=clock_timestamp(),subject_id=NULL,reservation_subject_id=NULL,reservation_subject_bound=false
 WHERE c.subject_id=target OR c.reservation_subject_id=target OR (c.kind='demand' AND EXISTS(SELECT FROM public.job_payload_demands d WHERE d.id::text=c.work_id AND d.user_id=target)) OR EXISTS(SELECT FROM public.capacity_reservations r
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

-- Task8 consumes prerequisite snapshot columns from migration01. No activation.
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
BEGIN;
-- Read-only public lifecycle display/predicate. Underlying tables stay service-only.
-- Fixed SELECTs expose no private rows, claims, credentials or control internals.
CREATE OR REPLACE FUNCTION public.lifecycle_job_state(p_job_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'feedEnabled', ctl.feed_enabled, 'sourceEnabled', ctl.source_enabled,
    'sourceAvailability', sl.source_availability,
    'discoveryAnchorAt', sl.discovery_anchor_at,
    'discoveryExpiresAt', sl.discovery_expires_at,
    'payloadAvailability', CASE WHEN j.description IS NOT NULL THEN 'available'
      WHEN sl.payload_retired_at IS NOT NULL OR j.description_pruned THEN 'retired' ELSE 'missing' END)
  FROM public.jobs j
  CROSS JOIN public.lifecycle_control ctl
  JOIN LATERAL (
    SELECT l.source_availability,l.discovery_anchor_at,l.discovery_expires_at,l.payload_retired_at
    FROM public.source_listings l WHERE l.job_id=j.id
    ORDER BY (l.source_availability='closed') ASC,
      (l.discovery_expires_at > statement_timestamp()) DESC,
      (l.source_availability='open') DESC,l.discovery_expires_at DESC,l.id ASC LIMIT 1
  ) sl ON true
  WHERE j.id=p_job_id AND ctl.singleton
$$;
CREATE OR REPLACE FUNCTION public.lifecycle_discovery_visible(p_job_id text,p_legacy_closed_at timestamptz,p_include_older_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    -- Missing mappings retain honest legacy behavior; rollout requires mapping readiness.
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
      THEN p_legacy_closed_at IS NULL
    -- Proven closure remains excluded when flags roll back.
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN false
    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NULL
    ELSE EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id
      AND l.source_availability<>'closed'
      AND (NOT ctl.feed_enabled OR l.discovery_expires_at > statement_timestamp()
        OR (p_include_older_live AND l.source_availability='open')))
    END
  FROM public.lifecycle_control ctl WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_job_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_job_state(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.lifecycle_source_closed(p_job_id text,p_legacy_closed_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
      THEN p_legacy_closed_at IS NOT NULL
    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
    ELSE false END
  FROM public.lifecycle_control ctl WHERE ctl.singleton
$$;
REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
COMMIT;
