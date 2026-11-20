# job-board: architecture

Status: living description of the system **as built on `main`** (checked against code at
`a478659`, 2026-11-19; Railway service list read 2026-11-19, see §9). Product behavior is in [`product.md`](product.md). Where the
running system depends on configuration outside the repo (Railway service settings,
the `lifecycle_control` row, Supabase auth settings), this doc says **unverified**.

## 1. Components

| Component | Code | Runs as | Deploys to |
|---|---|---|---|
| Job discovery (poller) | `job_discovery/` | `python -m job_discovery`, cron | Railway (`railway.json`) |
| Company discovery / classification | `company_discovery/` | `python -m company_discovery`, always-on worker | Railway (`railway.discovery.json`) |
| Reviewer supervisor | `reviewer/`, `job_discovery/lifecycle/`, `job_discovery/archive/` | `python -m reviewer.supervisor`, always-on | Railway (`railway.reviewer-worker.json`) |
| Spend alert | `observability/spend_alert.py` | `python -m observability.spend_alert`, hourly cron | Railway (`railway.spend-alert.json`), **but no such service exists in Railway** (§9) |
| Dashboard | `dashboard/` (Next.js 16) | Server components, server actions, API routes | Vercel (region `sfo1`) |
| Database | `schema.sql`, `migrations/` | Supabase Postgres (prod project `fdhspmavadgucktetzoi`) | Manual migrations |

External services: OpenRouter (all LLM calls), Stripe (billing), Supabase Auth and
Storage (résumé PDFs), Langfuse (optional tracing and eval datasets), AWS SES (optional
invite email), Serper (optional search grounding for company classification), S3 (public
archive export, dormant).

```
 ATS APIs (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday)
        │
        ▼
 job_discovery (cron) ──► companies, jobs, source_* tables ◄── company_discovery (worker)
                                   │                                 │ weekly dataset ingest
                                   ▼                                 │ admin-launched LLM classification
 reviewer.supervisor ──► reviewer.worker ──► job_reviews, usage_counters
        │                   ▲ claims review_requests
        ├─ lifecycle maintenance / source verification / archive / identity (flag-gated)
        ▼
 dashboard (Vercel) ── reads with RLS, writes review_requests, profiles, packages ──► Postgres
        │  résumé / cover / prefill generation ──► OpenRouter
        │  checkout / portal / webhook ──► Stripe
```

## 2. Job discovery

Entry: `job_discovery/__main__.py` (450 s hard kill) calls `run(require_source_enabled=True)`.

**Scheduled path** (the only path the deployed service takes):
1. If `lifecycle_control.source_enabled` is false, log "scheduled poll paused" and exit.
   The column defaults to false (`schema.sql:1036-1056`).
2. Pre-admission maintenance, load `targets.json`, take the `job_discovery_poll` advisory
   lock, check the DB size ceiling, start a `poll_runs` row.
3. Upsert the `targets.json` seed (3 companies) into `companies`.
4. Register up to 100 new source accounts, then `verify_due_sources`: fetch each due
   board (per board: 60 s, 50 requests, 10,000 rows), admit new listings, close and reopen
   jobs, all bounded by the capacity ceiling.
5. Finish the run.

**Legacy path** (`run.py:223-427`) loops active companies through the adapters, resolves
locations, calls `review_all`, and prunes. It is reachable only when a caller passes
`require_source_enabled=False`; the deployed entry point never does. So **discovery no
longer triggers reviews**, despite the README.

Adapters: `job_discovery/adapters/` (greenhouse, lever, ashby, workable,
smartrecruiters, workday). Workday tokens are `tenant:datacenter:site`.

Company corpus: `targets.json` is only a seed. The real corpus is the `companies` table,
filled by company discovery's dataset ingest.

**Production state (read-only check of `lifecycle_control` and `jobs`, 2026-11-19):**
`source_enabled` is **false**, so every scheduled poll exits as "paused". The `jobs`
table holds 835,466 rows; the newest `first_seen_at` and `last_seen_at` are both
2026-10-12 17:20 UTC, with no new jobs in the last 7 days. **Discovery has added or
re-confirmed nothing since 2026-10-12**, just before the identity migration was
activated (2026-10-13 03:08 UTC). The cron schedule itself lives in Railway service
settings and is still unverified.

## 3. Reviewer

### Supervisor
`reviewer/supervisor.py` holds no DB connection and runs child processes:

| Child | Module | Cadence |
|---|---|---|
| reviewer | `reviewer.worker` | Always running; respawned on exit |
| maintenance | `job_discovery.lifecycle.worker` | Every 15 min, 90 s deadline; no-op unless `maintenance_enabled` |
| archive | `reviewer.archive_worker` | Every 60 s; no-op until archive activated and `export_enabled` |
| source | `job_discovery.lifecycle.source_worker` | Every 60 s, 330 s deadline; no-op unless `source_enabled` |
| identity | `job_discovery.lifecycle.identity_campaign` | Every 60 s, only if `IDENTITY_BACKFILL_CAMPAIGN` is set and Railway service/env/branch IDs match |

SIGTERM drains for 30 s, then kills.

### Worker and the review queue
`reviewer.worker` runs `REVIEW_WORKER_PARALLELISM` loops (default 3). Each cycle: demand
hydration, recover requests stuck `running` over 30 min, claim the oldest `pending`
`review_requests` row (`FOR UPDATE SKIP LOCKED`; a partial unique index allows one
active request per user), run `run._review_user`.

`review_requests` rows are inserted only by `resume_matching()` / `enqueueReviewRequest`
from the dashboard (onboarding, Review now, Resume matching). There is no periodic
enqueue in the repo. `python -m reviewer` (`review_all` over every profile, then exit)
exists but nothing runs it: Railway has no service for it (verified 2026-11-19, §9),
although `dashboard/lib/schedules.ts` tells users reviews run every 2 h. **So in
production, reviews happen only when a user's request is queued.**

### Per-user review (`run._review_user`)
1. Per-user advisory lock; skip if held.
2. Skip if matching is paused (`matching_paused(uid)`: no paid subscription and 7 days
   inactive or explicitly paused).
3. Resolve plan (`reviewer/entitlements.py`); no plan means zero LLM calls.
4. Skip if no preferred locations.
5. Cap = min(profile cap, plan cap); spend from `usage_counters` (kind `review`, UTC day).
6. Select candidates: company exclusions and overrides, location prefs, not already
   reviewed for this `profile_version` (unless errored or missing a fit score). Human
   overrides are sticky.
7. **Stage 1:** batches of 50, title/company/location only, always `CHEAP_MODEL`.
8. **Stage 2** for passes: résumé, full description, verified company facts; structured
   output; write-time floors for seniority and work arrangement; `compute_fit`. Jobs
   without a description are deferred.
9. Persist to `job_reviews` in chunks; log to `review_runs`. One unit charged per job with
   a stage-1 decision plus billed errors.

A 402, or a 403 "key limit exceeded", from OpenRouter raises `OutOfCreditsError` and halts.

### Models and tiers
All LLM traffic goes through OpenRouter (`https://openrouter.ai/api/v1`, openai SDK,
`OPENROUTER_API_KEY`). No direct Anthropic calls.

| Use | Model | Where set |
|---|---|---|
| Stage 1 gate | `deepseek/deepseek-v4-flash` | `entitlements.CHEAP_MODEL`, forced |
| Stage 2, Standard default | `deepseek/deepseek-v4-flash` | `reviewer/config.py`, env `REVIEW_DEFAULT_MODEL_STANDARD` |
| Stage 2, Pro default | `openai/gpt-6-luna` (premium slot) | `reviewer/config.py`, env `REVIEW_DEFAULT_MODEL_PRO` |
| Stage 2, user pick | `profiles.model_stage2`, gated by `resolve_stage2_model` | profile |
| Company classification | `deepseek/deepseek-v4-flash` default, per job | `company_discovery/llm.py`, `classification_jobs.model` |
| Résumé / cover letter | `anthropic/claude-haiku-4.5` default, user-selectable | `dashboard/lib/rolefit/*Client.ts` |
| Prefill | `anthropic/claude-haiku-4.5`, fixed | `dashboard/lib/rolefit/prefillClient.ts` |

Tier policy lives in two mirrors: `reviewer/entitlements.py` and
`dashboard/lib/entitlements.ts`, checked by `tests/test_entitlements_parity.py`. The
per-plan default stage-2 model (`reviewer/config.py` vs `dashboard/lib/reviewRequests.ts`)
and the `REVIEW_DEFAULT_MODEL_*` env values are **not** parity-tested. `tier_settings`
rows overlay caps per plan at runtime. `REVIEW_MODEL_STAGE1/2` are only used by the
offline experiments harness (`reviewer/experiments.py`).

## 4. Company discovery

`company_discovery/worker.py`, always-on, 15 s poll:
- **Weekly ingest** (if the last `discovery_runs` row is over 7 days old): load the vendored
  dataset (`company_discovery/data/`, snapshot 2026-06-30), insert new companies as
  active, enrich up to `DISCOVERY_BATCH_CAP` (500) with LLM-free board metadata.
- **Classification:** claims one admin-launched `classification_jobs` row (mode
  `unclassified`, `unknown_repass` or `all`; company cap; model; optional Serper
  grounding), classifies in chunks of 25, writes industry, subcategory, size, HQ country,
  tech tags, red flags and confidence. Out-of-credits sets `discovery_state.halted_no_credits`;
  an admin clears it from the Companies page.
- `companies.active` reflects board health, not a per-user LLM verdict. Per-user filtering
  happens in the reviewer.
- The legacy per-user company review (`company_discovery/run.py`) is not wired to the
  service. The DB size ceiling is only checked on that legacy path.

## 5. Lifecycle, outbox and archive

A staged rework of how jobs are tracked and retired, controlled by the singleton
`lifecycle_control` row (no env overrides). It adds source accounts and listings, job
versions, reconciliation checkpoints, capacity reservations, payload demand and
retirement, an identity campaign that maps legacy rows into the new model in
operator-authorized batches, and a public outbox that seals changes into batches for S3
export.

Code defaults: every flag off (`source_enabled`, `maintenance_enabled`,
`hydration_enabled`, `feed_enabled`, `retirement_enabled`, `export_enabled`,
`identity_enabled`), `retirement_dry_run = true`, `archive_stage = 'never_activated'`.
Production values (read 2026-11-19): `safety_stage = 'collect'`, `identity_enabled = true`
(identity migration activated 2026-10-13 03:08 UTC), `source_enabled`,
`maintenance_enabled`, `hydration_enabled`, `feed_enabled`, `retirement_enabled` and
`export_enabled` all false, `retirement_dry_run = true`, `archive_stage =
'never_activated'`. The rollout is stalled partway: identity is on, the source path that
replaced the legacy poll is off. Operate it with the runbooks:
[job-lifecycle-outbox](runbooks/job-lifecycle-outbox.md),
[lifecycle-consumers](runbooks/2026-10-07-lifecycle-consumers.md),
[initial identity turn](runbooks/2026-10-13-initial-identity-turn.md),
[identity campaign reliability](identity-campaign-reliability.md),
[identity exploratory pilot](identity-exploratory-pilot.md).

### Retention and disk safety
- Legacy prune (`job_discovery/prune.py`): delete jobs closed over
  `CLOSED_JOB_RETENTION_DAYS` (30), except those with an approved review, correction or
  application package; 2,000 per batch, 20,000 per run. Skipped once lifecycle
  maintenance takes over.
- Lifecycle maintenance retires descriptions unused for 30 days and Greenhouse question
  schemas after 7 days, within 64 MiB per sweep.
- DB size ceiling: `DB_SIZE_CEILING_MB` (6000) in `job_discovery/db.py`, but
  `job_discovery/lifecycle/capacity.py` hard-codes its own 6000 MiB `CEILING_BYTES` that
  ignores the env var. The identity campaign stops at 5800 MiB.

## 6. Dashboard

- Next.js 16 on Vercel. `proxy.ts` (middleware) refreshes the Supabase session on every
  non-static route and rewrites logged-out `/` to the ISR `/board`.
- **Data access:** postgres.js with direct SQL (`lib/db.ts`), not supabase-js. The pool
  connects as the owning role through the Supabase transaction pooler (`prepare:false`,
  `max:3`). Per-request helpers (`withUserSql`, `withAnonSql`, mutation variants) open a
  transaction, set `request.jwt.claims` and `role = authenticated|anon`, so RLS applies.
  Direct use of the privileged pool is restricted to an allowlist enforced by
  `lib/serviceRoleAllowlist.test.ts` (Stripe webhook, account deletion, invites,
  subscriptions internals).
- supabase-js / `@supabase/ssr` are used for auth only; the service-role key is used for
  `auth.admin` account deletion.
- **jsonb reads** go through hand-rolled total parsers (no zod); see `dashboard/CLAUDE.md`.
- **Generation** (`app/api/resume`, `app/api/cover-letter`, `app/api/application/prepare`):
  reserve allowance under an advisory lock, return 202, run in `after()` with
  `maxDuration = 300`; client polls `GET /api/generations`. OpenRouter calls: 120 s
  timeout, 2 attempts, 12,000 max tokens. PDF extraction is local (`unpdf`).
- **Billing:** `POST /api/stripe/checkout` (409 if a live subscription exists),
  `POST /api/stripe/portal`, `/api/stripe/webhook` (signature-verified; the only writer of
  `subscriptions`). Handled events: `checkout.session.completed`,
  `customer.subscription.created|updated|deleted`. Out-of-order guard on `last_event_at`.
  Price ID maps to plan; unknown price means no plan.
- **Security headers** set in `next.config.mjs` (frame-ancestors none, HSTS, nosniff,
  etc.; no script-src).
- **Tracing:** Langfuse via OpenTelemetry, started lazily (`lib/observability.ts`).

## 7. Schedules: what the repo says vs what's configured

| Service | `railway*.json` | README | `dashboard/lib/schedules.ts` |
|---|---|---|---|
| Job discovery | no `cronSchedule` | `0 0 * * *` | `0 */2 * * *` |
| Periodic reviewer | not configured | "end of each poll run" | `0 */2 * * *` (no such service exists in Railway) |
| Company discovery | always-on (restart on failure) | "slow, e.g. weekly" cron | `0 6 * * 1` |
| Spend alert | `0 * * * *` | hourly | n/a (service not deployed) |

Only the spend alert's schedule is in the repo. The rest live in Railway service settings
and should be read from Railway, then committed (open question for the owner).

## 8. Database

Supabase Postgres. `schema.sql` (~4,000 lines, 75 tables) is the cumulative schema; later
migrations append full function replacements, so it reads as history rather than a clean
current state.

| Domain | Tables |
|---|---|
| Catalog (shared) | `companies`, `jobs` (descriptions live here), `locations`, `job_questions`, `poll_runs`, plus lifecycle dimensions `brands`, `skills`, `company_brands`, `company_sources`, `job_locations`, `job_skills` |
| Company discovery | `classification_jobs`, `discovery_runs`, `discovery_state` |
| Per-user review | `profiles`, `job_reviews`, `review_corrections`, `review_runs`, `company_reviews`, `company_overrides`, `review_requests`, `usage_counters`, `matching_activity` |
| Applications | `application_packages`, `resume_scores`, `cover_letter_edits`, `generation_jobs` |
| Billing and tiers | `subscriptions`, `tier_settings`, `plan_overrides` |
| Invites and admin | `invite_codes`, `invite_redemptions`, `invite_allowances`, `app_settings`, `account_deletions` |
| Feedback | `feedback` (via `submit_feedback()`, 5/hour) |
| Lifecycle / outbox / archive | `lifecycle_*`, `source_*`, `job_versions`, `job_payload_demands`, `identity_assertions`, `capacity_reservations`, `reconciliation_checkpoints`, `public_outbox`, `public_archive_*`, `lifecycle_identity_*` |
| Ops | `schema_migrations`, `openrouter_usage_snapshots` |

### RLS
- RLS is enabled on every table. Early tables add explicit deny-all policies for `anon`.
- Identity comes from `public.app_user_id()`, which reads `sub` from `request.jwt.claims`
  (no dependency on Supabase's `auth.uid()`).
- Patterns: owner CRUD (`user_id = app_user_id()`) on profile, review, package and
  override tables; owner read-only on subscriptions, plan overrides, invite allowances,
  review requests (plus insert), matching activity, feedback; shared read on jobs,
  companies, job questions, tier and app settings.
- Default privileges are revoked and re-granted from an allowlist; `profiles` excludes
  `daily_review_cap` from user writes; `usage_counters` is read-only to users.
- Python services connect with a privileged `DATABASE_URL` (psycopg) and bypass RLS.
- Résumé storage bucket policies live only in
  `migrations/2026-07-04-resume-bucket-storage-policies.sql`, not in `schema.sql`.

### Migration process today
- Files in `migrations/` named `YYYY-MM-DD[-NN]-slug.sql`; each must be idempotent,
  transactional where possible (`CREATE INDEX CONCURRENTLY` outside the transaction), and
  mirrored into `schema.sql`.
- **Applied by hand** against Supabase (SQL editor or MCP), then recorded with
  `INSERT INTO schema_migrations (filename) ...`. Nothing in CI, Railway or Vercel applies
  migrations. Because a push to `main` auto-deploys, runbooks apply the migration **before**
  merging dependent code.
- Supabase keeps its own `supabase_migrations.schema_migrations` history; the two ledgers
  are not synchronized. See [migration-ledger-state](runbooks/migration-ledger-state.md).
- Drift checks exist only in DB tests (`tests/test_lifecycle_migrations.py`,
  `tests/test_metadata_migration_grants.py`). Nothing compares the repo to production.
- (planned) Applying migrations in CI/CD is under discussion; not built.

## 9. Deploy topology

**Railway as read 2026-11-19** (project `job-board-poller`, production): exactly three
services, `poller`, `discovery` and `reviewer-worker`.
- `reviewer-worker` runs `python -m reviewer.worker` from `main` with no cron, even though
  its config file (`railway.reviewer-worker.json`) says `python -m reviewer.supervisor`.
  The service's start command appears to override the file, so the supervisor's
  lifecycle children (maintenance, archive, source verification, identity) are **not
  running** in production (inferred from that start command).
- There is **no spend-alert service**, so `railway.spend-alert.json` is not deployed and
  the hourly OpenRouter burn alert is not running.
- There is no scheduled `python -m reviewer` service.
- The poller and discovery service configs (schedule, start command) could not be read
  and remain **unverified**.

- **Push to `main` auto-deploys.** Railway services rebuild when files matching their
  watch patterns change (all include `schema.sql`; `railway.json` has none set in the
  repo). Vercel deploys the dashboard. Database migrations are separate and manual.
- `.railwayignore` excludes `docs/`, `.superpowers/`, `.env*`.
- Vercel previews trigger the authenticated visual workflow (§11).
- Release preflight for lifecycle work: `tools/lifecycle_release.py` (read-only by
  default; pins the Railway reviewer service and production environment IDs).

## 10. Environment variables

The full value sets live in Railway and Vercel; this lists what the code reads.

**All Python services:** `DATABASE_URL` (required; privileged connection),
`OPENROUTER_API_KEY` (required for LLM work), `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`
(optional, both needed), `LANGFUSE_SAMPLE_RATE` (1.0).

| Service | Optional vars (default) |
|---|---|
| job_discovery | `DB_SIZE_CEILING_MB` (6000), `CLOSED_JOB_RETENTION_DAYS` (30), `PRUNE_BATCH_SIZE` (2000), `PRUNE_MAX_ROWS_PER_RUN` (20000), `LOCATION_MODEL` (legacy path only) |
| reviewer supervisor | `REVIEW_CONCURRENCY` (5), `REVIEW_DAILY_CAP_DEFAULT` (400, fallback only), `REVIEW_STAGE1_BATCH` (50), `REVIEW_PERSIST_CHUNK` (20), `REVIEW_WORKER_POLL_SECONDS` (15), `REVIEW_WORKER_PARALLELISM` (3), `REVIEW_DEFAULT_MODEL_STANDARD`, `REVIEW_DEFAULT_MODEL_PRO`, `IDENTITY_BACKFILL_CAMPAIGN`, the job_discovery vars above; Railway-injected `RAILWAY_*` IDs; AWS credentials via boto3's default chain for archive export |
| company_discovery | `CLASSIFY_WORKER_POLL_SECONDS` (15), `CLASSIFY_CALL_TIMEOUT_SECONDS` (300), `DISCOVERY_CONCURRENCY` (5), `DISCOVERY_BATCH_CAP` (500), `DISCOVERY_DATASET_DIR`, `DISCOVERY_MODEL`, `SERP_ENABLED` (off), `SERPER_API_KEY`, `SERP_MIN_INTERVAL_SECONDS` (0.5) |
| spend_alert | `ALERT_WEBHOOK_URL` (exits 1 if a threshold trips without it), `SPEND_ALERT_DAILY_USD` (10), `SPEND_ALERT_CREDITS_FLOOR_USD` (20) |

**Dashboard (Vercel):**
- Required: `DATABASE_URL` (transaction pooler), `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS` (no admins if unset).
- Feature-required: `OPENROUTER_API_KEY`; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PRO`; `SUPABASE_SERVICE_ROLE_KEY` and
  `ACCOUNT_DELETION_HASH_SECRET` (deletion fails closed without them).
- Optional: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `LANGFUSE_*`
  (+ `LANGFUSE_HOST`), `SES_REGION` / `SES_FROM_ADDRESS` / `SES_ACCESS_KEY_ID` /
  `SES_SECRET_ACCESS_KEY` (all four or no invite email), `REVIEW_DEFAULT_MODEL_*` (must
  match the reviewer), `NEW_WINDOW_HOURS` (48).

`.env.example` covers only a subset of these.

## 11. Tests and CI

- **Python:** ~110 test files under `tests/`. DB tests need `TEST_DATABASE_URL` pointing at
  a throwaway Postgres. CI runs an allowlisted subset
  (`tools/lifecycle_test_selection.json`) via
  `python tools/lifecycle_test_db.py --postgres-major 17 -- python tools/run_lifecycle_acceptance.py`,
  which starts a disposable Postgres container. The full pytest suite is not run in CI.
- **Dashboard:** ~230 vitest files (`npm test`), a DB-backed "owned" set
  (`vitest.owned.config.ts`), UI contract tests, and Playwright visual tests
  (`test:visual:public`, `test:visual:authenticated`).
- **`.github/workflows/ci.yml`** (push/PR to `main`, no secrets): `python` job (Postgres 16
  and 17 matrix: ruff, allowlisted pytest, owned dashboard tests); `dashboard` job
  (typecheck, lint, vitest, build); `public-visual` job (macOS, Playwright).
- **`.github/workflows/authenticated-visual.yml`**: on a successful Vercel Preview
  deployment, runs authenticated visual tests against the preview URL (secrets:
  `VISUAL_AUTH_*`, `VISUAL_ONBOARDING_*`, `VERCEL_AUTOMATION_BYPASS_SECRET`).
- No branch protection or required-check config in the repo.

## 12. Runbooks

- [Backup and restore](runbooks/backup-restore.md)
- [Migration ledger state](runbooks/migration-ledger-state.md)
- [Job lifecycle and outbox](runbooks/job-lifecycle-outbox.md)
- [Lifecycle consumers cutover](runbooks/2026-10-07-lifecycle-consumers.md)
- [Initial identity turn](runbooks/2026-10-13-initial-identity-turn.md)
- [Maintenance and inactivity rollout](runbooks/2026-10-02-maintenance-inactivity-rollout.md)
  and [cleanup estimate SQL](runbooks/sql/maintenance-cleanup-estimate.sql)
- [Company classification rollout](runbooks/2026-07-21-company-classification-rollout.md)
- [Location canonicalization rollout](runbooks/2026-07-16-location-canonicalization-rollout.md)
- UI rules: [ui-contracts](ui-contracts.md)

## 13. Known drift and open issues

1. Schedules disagree across Railway, README and `lib/schedules.ts` (§7).
2. `source_enabled` is false in prod, so scheduled discovery is a no-op and no jobs have
   been added or re-confirmed since 2026-10-12;
   no periodic reviewer exists in the repo or in Railway (§2, §3, §9).
3. Railway's `reviewer-worker` runs `reviewer.worker`, not the supervisor its config file
   names, and the spend-alert service isn't deployed (§9).
4. Two DB ceilings: env-driven 6000 MB and a hard-coded 6000 MiB in `capacity.py`.
5. Per-plan default stage-2 model mirrored by comment only between Python and TS.
6. `schema.sql` carries repeated function definitions from appended migrations.
7. `.superpowers/sdd/` task reports are tracked in git.
8. The README's review-phase and model sections predate the move to OpenRouter and the
   reviewer supervisor.
