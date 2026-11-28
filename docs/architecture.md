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
| Supabase storage metrics reader | `supabase_metrics/` | `python -m supabase_metrics` (CLI) or `python -m supabase_metrics.mcp_server` (local stdio MCP), on demand only | Not deployed; no prod wiring ([guide](supabase-metrics-reader.md)) |
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
- Disk and WAL observation: `supabase_metrics` reads two fixed Supabase Management API
  GET routes (disk util, Prometheus metrics) for the prod project. It never touches the
  database. Its source contract is unverified (`_VERIFIED_CONTRACT = None`), so every
  live result is `incomplete` and `operationally_eligible=false`; nothing gates on it yet
  ([source evidence](supabase-metrics-source-evidence.md)).

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
  `migrations/archive/2026-07-04-resume-bucket-storage-policies.sql`, not in `schema.sql`.

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

**Metrics reader (local/agent use only):** `SUPABASE_METRICS_PAT` (fine-grained PAT scoped
to the prod project with Disk Config Read and Logs Read; not set on any Railway or Vercel
service).

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
- **`.github/workflows/ci.yml`** (push/PR to `main`, no secrets): `metrics-reader` job
  (fixture-only `supabase_metrics` core, CLI and MCP tests); `python` job (Postgres 16
  and 17 matrix: ruff, allowlisted pytest, owned dashboard tests); `dashboard` job
  (typecheck, lint, vitest, build); `public-visual` job (macOS, Playwright);
  `sandbox-enforcement` job (the sandbox's real-browser suite) and `render-smoke` job
  (the render smoke, its own job with a 60 minute timeout), both in the pinned
  Playwright container.
- **`.github/workflows/authenticated-visual.yml`**: on a successful Vercel Preview
  deployment, runs authenticated visual tests against the preview URL (secrets:
  `VISUAL_AUTH_*`, `VISUAL_ONBOARDING_*`, `VERCEL_AUTOMATION_BYPASS_SECRET`).
- No branch protection or required-check config in the repo.

### Running the live agent eval

The live agent eval plays scripted scenarios against a real model. It is never part of
CI. **It spends money on Andrew's OpenRouter key.** Use a dedicated OpenRouter key with
its own credit limit set in OpenRouter, as an outer guard beyond the caps below.

Since PR J7 the eval is sized to Andrew's limit, "max $2-3 per pass total, ideally without
compromising quality": Haiku 5.5 (`AGENT_EVAL_DEFAULT_MODEL`) is the default model of
every mode, the judge included; the agent loop and the re-render use the prompt cache; and
no mode can spend more than $3 on its own. That holds because every mode, the golden run
included (PR J7 fix round 1), stops at the first call that reports no cost, runs only
models with a row in the price table, and before each call reserves that call's worst
case, so a call that could pass a dollar cap never starts (at list prices; see the caps
below). Production's model (`AGENT_MODEL_DEFAULT`, Sonnet 5.5) is unchanged.

```
python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \
  npm --prefix dashboard run eval:agent -- --pass
```

- `tools/lifecycle_test_db.py` forwards a variable only when it is named with
  `--allow-env`, and only `OPENROUTER_API_KEY` is allowed (gate A17). Without the flag
  the key never reaches the eval, and the eval refuses to start. The key goes to the
  test command alone, never to docker, the database container, argv or the logs.
- `npm run eval:agent` (`dashboard/scripts/eval-agent.mjs`) is the only entry point. It
  needs Node 22.18 or later.

Andrew's commands (every one but the free ones runs inside the wrapper above; each live
mode takes `--dry-run`, which needs no key and no database, prints the plan, the estimate
uncached and cached, and the caps, and spends nothing):

| Command | What it does |
|---|---|
| `eval:agent -- --pass [--max-usd <n>]` | One full pass on Haiku 5.5 under one budget, $3 by default and at most: the matrix, then the injection set, then the judge over that matrix run. Each stage's dollar caps are what is left after the reported cost of the stages before it; a stage that stops, reports no cost, or a budget with less than a cent left stops the pass. Every `run.json` of the pass carries the pass id and the pass's `--max-usd`, and the end prints the pass's reported spend against it ("at least" when a stage stopped on a call whose cost or usage it could not read). |
| `npm run test:render-smoke` (free) | The render smoke over the latest complete matrix and injection runs, before the judge reads variant 3 (below). In a pass, the judge runs without it and judges the variant 1 and 2 pairs only (60 for a one-model matrix). |
| `npm run eval:summary` (free) | The per-variant summary; for a matrix run from a pass it adds the pass's spend against that pass's `--max-usd` ("at least" as above; a pass recorded before fix round 1 shows the $3 ceiling, labelled as such). |
| `eval:agent -- --matrix --spot-check [--persona <id>]` | The opt-in Sonnet 5.5 spot check, never part of a pass: one persona (`senior-backend` unless named), one repeat, all 4 scenarios in all 3 variants (12 cells), $2.90 at most. Its run (`run.json` kind `spot-check`) is read only when named with `--run`. Since PR 7 its 12 cells are $3.30 uncached ($2.54 cached), over $2.90 before the look-ahead's $0.2051 reserve, so a real spot check is refused before any call (exit 4, `matrixPlan.ts spotCheckRefusal`); nothing starts it on the cached figure, and the cap does not rise. `--max-cells 8` fits uncached. |
| `eval:agent -- --matrix --rerender-only --run <matrix run id>` | Variants 2 and 3 again without replaying variant 1: every recorded variant 1 surface of that complete full matrix run is written into the throwaway database and re-rendered from its stored gathered data, on that run's models, into a new matrix run (`run.json` kind `rerender-only`, `sourceRun` the run re-rendered). Only re-render calls are spent; readers pair its variants 2 and 3 with the source's variant 1. A non-Haiku source needs `--allow-non-haiku`. |
| `eval:agent -- --variant <1\|2\|3> [--model <id>] [--allow-non-haiku]` | The golden scenarios alone (12 cases), Haiku 5.5 unless `--model` names another. `--model` must name a priced model, and any model but Haiku 5.5 also needs `--allow-non-haiku` (exit 2 otherwise, dry run included). A Sonnet 5.5 golden run is estimated at $3.67 uncached, so it fits its $2 default (or the $3 ceiling) only with the cache working ($1.80). |
| `eval:agent -- --matrix`, `--injection`, `--judge [--run <id>]` | Each stage of the pass on its own, under its own caps. A matrix or injection run on any model but Haiku 5.5 needs `--allow-non-haiku` (exit 2 otherwise, dry run included); a full Sonnet matrix does not fit the $3 ceiling. |

Every run is capped, and the caps fail closed. A flag may lower a cap; a value above its
ceiling is refused before anything runs. The golden run's caps:

| Flag | Bounds | Default | Ceiling |
|---|---|---|---|
| `--max-cases <n>` | scenario × persona cases played (the first n) | 12 | 12 |
| `--max-steps <n>` | model calls in one turn of a case | 8 | 8 (the route's own step limit) |
| `--max-tokens <n>` | input + output tokens over the whole run | 2,000,000 | 8,000,000 |
| `--max-usd <n>` | cost OpenRouter reports, over the whole run | $2 | $3 |
| `--max-minutes <n>` | wall clock for the whole run | 30 | 60 |

- Every model call is checked before it is sent, including whether it could pass the
  token or dollar cap. The first cap reached stops the whole run: the case in progress
  writes no recording, later cases are skipped, the run is reported as `cap_exceeded`
  with the cap, the usage table so far is printed, and the command exits non-zero.
- The dollar look-ahead (PR J7 fix round 1): before each call the budget reserves that
  call's worst case, and the call starts only if the spend so far plus the reserve fits
  under the cap (and under a pass's or a command's whole budget). The worst case
  (`worstCaseCallMicros` in `lib/agent/prices.ts`) takes the prompt's serialized size in
  bytes, plus 2,048, as its input tokens, priced at the dearest tier that could apply
  and all as cache writes (1.25×), plus the call's whole output limit (128K if it sets
  none) at the dearest output price; a prompt with a file given by URL has no bound and
  never starts under a dollar cap. The reserve is never less than the dearest call the
  run has made so far. A run may therefore stop up to one reserve short of its cap: on
  Haiku 5.5 about $0.01 at the plan's call sizes (0.3% of $3), $0.11 for a step whose
  history fills the window (about 160K bytes, the long tier); on Sonnet 5.5 about $0.20
  ($0.45 at the full window). Each dry run prints its reserve and counts it in "Within
  caps".
- A call whose token usage cannot be read stops the run too (`usage_unknown`). It is
  never counted as zero.
- Every mode, the golden run included since fix round 1, stops at the first call that
  reports no cost (`cost_unknown`), so no dollar cap ever switches off. A run that stops
  on `cost_unknown` or `usage_unknown` records its reported cost as a floor
  (`costFloor` in `run.json`), and the pass and the summary print it as "at least".
- Sizing: one call sends about 7k tokens of fixed prefix (tool schemas, instructions,
  profile, memo) plus the thread so far. The scripted gate turns make about 100 calls
  for 12 cases, so a run is roughly 1.5M tokens: $0.18 on Haiku 5.5 at list price ($0.09
  cached), and $3.67 on Sonnet 5.5 uncached, so a Sonnet golden run fits only with the
  prompt cache working ($1.80 cached). `--variant <n> --dry-run` prints this estimate.

Prices and the prompt cache (PR J7). Haiku 5.5 is priced per call by prompt size: $0.10 /
$0.50 per million tokens up to 100K input tokens, $0.50 / $2.50 above (`lib/agent/prices.ts`).
The agent loop and the re-render mark Anthropic cache breakpoints through OpenRouter
(`lib/agent/cache.ts`): one on the system message, which caches tools and instructions,
and, in the loop, one on each call's last user or tool message. Estimates price cache
writes at 1.25× and reads at 0.1× the input price; the cached column assumes
`CACHE_SHARES` in `lib/agent/evals/matrixPlan.ts` (an agent step reads 75% of its input
from the cache and writes 25%; a re-render reads 25% and writes 10%; the judge caches
nothing). The caps are sized against the uncached figures. The eval's budget report
shows the cache read and write tokens each call reported; `agent_runs` has no column for
them.

- How the provider sends a breakpoint (`@openrouter/ai-sdk-provider` 3.1.0, cited by
  line in `lib/agent/cache.ts`): on the system message and a user message it becomes
  `cache_control` on the last text block; on a tool message it becomes a `cache_control`
  field on each tool result's own `role: "tool"` message, so a tool message carrying two
  results sends two. `countCacheBreakpoints` counts the same way, alias spellings and the
  call-level option included, and the history test counts 5 for the prompt that sends 5.
  Whether OpenRouter passes a tool message's `cache_control` on to Anthropic is
  unverified; if it does not, that tail breakpoint is simply not cached and the estimate
  is high, never low.
- When a call reports no billed cost, the budget prices it from its tokens and takes its
  input as the larger of the reported input tokens and the cache read plus write tokens,
  so a route whose input count leaves out cached tokens is not priced low (fix round 1).
- Production cost (left as it is, review M-4): with the tail breakpoint, the first call
  of a turn that starts more than 5 minutes after the last writes its prompt to the
  cache at 1.25×; a turn with no tool call never reads it back, so a one-step answer
  costs about 25% more input than before. Multi-step turns, the common case, cost less.
  This is a cost-only change.

### The variant comparison (plan Tasks 2.10 to 2.13)

The matrix, the injection set and the judge, the stages of a pass, and two free commands.
The estimates are list prices from `lib/agent/prices.ts` (OpenRouter's prices for these
slugs are unverified); the caps are what stop a real run.

| Command | What it runs | Writes |
|---|---|---|
| `eval:agent -- --matrix [--models a,b \| --model id] [--allow-non-haiku]` | Per model, 4 scenarios × 3 personas × 5 repeats played live in variant 1, each surface re-rendered into variants 2 and 3 from the same gathered data (180 cells a model; Haiku 5.5 by default) | `lib/agent/evals/recordings/matrix/<run>/<model>/v<n>/` |
| `eval:agent -- --matrix --spot-check [--persona <id>]` | Sonnet 5.5, one persona, one repeat: 12 cells | the same, `run.json` kind `spot-check` |
| `eval:agent -- --matrix --rerender-only --run <run>` | The plan's variant 2 and 3 cells from the recorded variant 1 surfaces of that complete full matrix run (`--max-cells` counts re-render cells) | the same, `run.json` kind `rerender-only` with `sourceRun`; no `v1/` folder of its own |
| `eval:agent -- --injection [--models a,b \| --model id] [--allow-non-haiku]` | Per model, the 19 model-driven prompt-injection cases in variants 1, 2 and 3 (57 runs) | `lib/agent/evals/recordings/injection/<run>/<model>/v<n>/<case>.json` |
| `npm run test:render-smoke` (free; needs Playwright's Chromium) | The hand-written surfaces (golden recordings and fixtures) at 390 and 1440 px, light and dark, and the latest complete matrix and injection runs' surfaces at 1440 px light (a rerender-only run brings its source's variant 1 surfaces): overflow, 44 px targets, axe; for variant 3, misstatements, canary hits and frame loads. Screenshots only of failures. `EVAL_MATRIX_RUN=<run>` / `EVAL_INJECTION_RUN=<run>` pick other runs. CI runs it in its own `render-smoke` job and uploads `render-smoke` | `test-results/render-smoke/` |
| `eval:agent -- --judge [--run <run>]` | Haiku 5.5 (`AGENT_JUDGE_MODEL`) compares two variants of one cell of one matrix run (the latest complete one unless named), blind to the variant and in a random order; variant 3 is read from the render smoke's frame text for that run, and a pair without it is skipped. The judge is now the same family as the eval model: what keeps the grading fair is that it never sees the variant, sees each pair in a random order, informs and never decides, and the 10% hand-check stays | `lib/agent/evals/recordings/judge/<run>/results.json` and `hand-check.csv` (10% sample) |
| `npm run eval:summary [-- --run <run>] [--injection-run <run>] [--judge-run <run>]` (free) | The per-variant summary from one run of each mode (the latest complete one unless named; the judge run must be one that judged the matrix run) and the render smoke's results for those runs. It names the runs it read; missing inputs read "not run yet"; a matrix run from a pass adds a "Pass spend" table | `docs/superpowers/plans/2026-11-20-variant-summary.md` |

Runs. Each live run of the matrix, the injection set or the judge writes into a new folder
named by its run id, the UTC time it started (`20261126T011500Z`), with a `run.json` that
says what ran and how it ended: `running`, then `complete`, `cap_exceeded` or `failed`,
with the cost its calls reported. A matrix run's `run.json` also says its kind (`full`,
`spot-check` or `rerender-only`, with `sourceRun`), and a stage of a pass carries the pass
id and the pass's `--max-usd` (`passBudgetUsd`). `costFloor` says the cost is only a floor
(the run stopped on `cost_unknown` or `usage_unknown`). Every recording and result carries its run id (`evalRun`), and a reader leaves out a
file whose id is not its folder's. Readers take the latest `complete` run that is not a
spot check unless one is named, and a named run may have any status or kind, so a stopped
run or the spot check can be read on purpose. A rerender-only run is read as a matrix run,
with its variant 1 from its source run. Two runs never mix, and the judge never writes over
an earlier run's `hand-check.csv` (nor writes one when it judged nothing). Each `*.eval.ts`
refuses to start unless `EVAL_MODE` is its own mode, which only `eval:agent` sets.

In the summary, the matrix's variant 1 rows time and cost the whole scenario; variants 2
and 3 time and cost the re-render only, and count only the surfaces' own assert failures
(a re-render repeats no tool calls). Each row says which it covers.

Caps (a flag lowers a cap; above its ceiling is a usage error). The matrix and the
injection set cap each model's run and, with the two total flags, the whole command; the
first cap to trip stops everything. No mode's dollar ceiling is above $3, and in a pass
each stage's dollar caps are what is left of the pass budget (never above the mode's own
ceiling). A rerender-only run has the matrix caps.

| Mode | Flag | Bounds | Default | Ceiling |
|---|---|---|---|---|
| pass | `--max-usd` | reported dollars over all three stages | $3 | $3 |
| matrix | `--max-cells` | cells per model | 180 | 180 |
| matrix | `--max-steps` | model calls in one turn or re-render | 8 | 8 |
| matrix | `--max-tokens` | tokens per model | 22,000,000 | 44,000,000 |
| matrix | `--max-usd` | reported dollars per model | $3 | $3 |
| matrix | `--max-minutes` | wall clock per model | 360 | 600 |
| matrix | `--max-total-tokens` | tokens over every model | 44,000,000 | 88,000,000 |
| matrix | `--max-total-usd` | dollars over every model | $3 | $3 |
| spot check | `--max-cells` | cells | 12 | 12 |
| spot check | `--max-steps` | model calls in one turn or re-render | 8 | 8 |
| spot check | `--max-tokens`, `--max-total-tokens` | tokens | 2,000,000 | 4,000,000 |
| spot check | `--max-usd`, `--max-total-usd` | reported dollars | $2.90 | $2.90 |
| spot check | `--max-minutes` | wall clock | 60 | 120 |
| injection | `--max-cases` | runs per model | 57 | 57 |
| injection | `--max-steps` | model calls in one turn | 8 | 8 |
| injection | `--max-tokens` | tokens per model | 9,000,000 | 18,000,000 |
| injection | `--max-usd` | reported dollars per model | $1 | $1.50 |
| injection | `--max-minutes` | wall clock per model | 120 | 240 |
| injection | `--max-total-tokens` | tokens over every model | 18,000,000 | 36,000,000 |
| injection | `--max-total-usd` | dollars over every model | $1 | $1.50 |
| judge | `--max-pairs` | pairs judged, repeat by repeat | 144 | 360 |
| judge | `--max-steps` | model calls per pair | 1 | 1 |
| judge | `--max-tokens` | tokens over the run | 3,000,000 | 6,000,000 |
| judge | `--max-usd` | reported dollars over the run | $0.50 | $1 |
| judge | `--max-minutes` | wall clock for the run | 60 | 120 |

Estimated cost (the dry runs, list price; uncached, and with the prompt cache at
`CACHE_SHARES`):

| Run | Model | Calls | Tokens (in / out) | Uncached | Cached |
|---|---|---|---|---|---|
| Pass (matrix, injection, judge up to 144 pairs) | Haiku 5.5 | 1,530 | 21.26M / 2.74M | $3.49 | $2.51 |
| Matrix, 180 cells | Haiku 5.5 | 930 | 12.69M / 2.41M | $2.47 | $1.90 |
| Matrix, 180 cells | Sonnet 5.5 | 930 | 12.69M / 2.41M | $49.44 | $38.05 |
| Spot check, 12 cells | Sonnet 5.5 | 62 | 0.85M / 0.16M | $3.30 | $2.54 |
| Re-render only, of a full one-model run (120 cells) | Haiku 5.5 | 420 | 5.04M / 2.10M | $1.55 | $1.45 |
| Injection, 57 runs | Haiku 5.5 | 456 | 6.84M / 0.27M (up to 0.55M) | $0.82 (up to $0.96) | $0.40 (up to $0.54) |
| Injection, 57 runs | Sonnet 5.5 | 456 | 6.84M / 0.27M (up to 0.55M) | $16.42 (up to $19.23) | $8.04 (up to $10.85) |
| Judge, 144 pairs | Haiku 5.5 | 144 | 1.73M / 0.06M | $0.20 | $0.20 |
| Golden, 12 cases | Haiku 5.5 | 102 | 1.53M / 0.06M | $0.18 | $0.09 |
| Golden, 12 cases | Sonnet 5.5 (`--allow-non-haiku`) | 102 | 1.53M / 0.06M | $3.67 | $1.80 |

- Sizing: since PR 7 a variant 3 step or re-render may emit 8,000 output tokens
  (`outputTokensFor(3)`, `AGENT_LIMITS.maxOutputTokensV3`), so the matrix is $2.47
  uncached and its dollar defaults are $3 (plan D11; the ceiling stays $3). The pass is
  the matrix ($2.47), the injection set ($0.82, up to $0.96 if two variant 3 calls in each
  of its 19 variant 3 runs emit 8,000 output tokens: `matrixPlan.ts
  estimateInjectionUpper`) and the judge ($0.20 for 144 pairs; about $0.08 for the 60
  pairs a pass judges without the render smoke), $3.49 uncached: over its $3 budget, so a
  real `--pass` is refused before any call (exit 4, `matrixPlan.ts passRefusal`; a cap
  stop is 3) and the modes run on their own instead: `--matrix`, then `--injection`, then
  `--judge --run <that matrix run id>`. No full matrix run is recorded yet, so the cheaper
  `--matrix --rerender-only --run <id>` ($1.55) cannot stand in for `--matrix`. Each mode's default leaves
  room under its ceiling for the Haiku estimate; the ceilings are what a single mode may
  spend. The judge takes pairs repeat
  by repeat, 36 a repeat for one model (4 scenarios × 3 personas × 3 pairings), so its
  144 are four of the five repeats; all 180 of a one-model matrix need `--max-pairs 180`
  (about $0.25, inside the other defaults).
- With the look-ahead, `--pass --dry-run` checks each stage's estimate plus its reserve
  against what is left when it starts: matrix $2.4823 against $3.00 fits, injection
  $0.8326 against $0.52 and judge $0.2089 against $0.00 do not uncached; cached, all
  three fit. The injection set and a golden `--variant 3` run reserve a variant 3 step
  ($0.0118 on Haiku; $0.1213 if its history filled the window). A refused pass's dry run
  ends with its refusal. The Sonnet spot check does not fit uncached ($3.30 against
  $2.90; $2.54 cached), so a real one is refused before any call (exit 4) and its refusal
  names `--max-cells 8`, which fits. Its cap stays at $2.90, under Andrew's limit.
- The production signals (fallback rate, re-render use, undo within 60 seconds, a
  question asked again, a surface left for a workspace) are read-only queries in
  [agent-variant-signals.sql](runbooks/agent-variant-signals.sql), run by hand.
- The demos on prod follow the [variant demo script](demo/README.md), with the synthetic
  persona résumés in `demo/personas/` (`npm --prefix dashboard run demo:personas`).

### Diagnosing a failed agent answer

When a model call fails, `/api/agent` writes one Vercel runtime log line:
`agent: <where> name=<error> status=<http status|none> retryable=<true|false|unknown> [code=…] [provider="…"]`.
The provider message is cut to 300 characters with key-shaped text, bearer tokens and
long tokens replaced by `[redacted]`; headers, the request body and the URL are never
logged. The run's `agent_runs.error` holds `model_error:<status>` (for example
`model_error:402`), or `model_error` when there was no status. The browser shows one
inline error with Retry: 401, 402 and 403 read as "unavailable", 429 as "too many
requests", 5xx as "service trouble", anything else as the generic message.

Retry sends `{ kind: "retry", id }`, not the text again. The server answers the stored
question `id` only when it is the thread's last question and is followed by at most one
assistant row that did not complete (`failed`, or `pending` from an interrupted turn); the
new answer is written into that row, so the question is stored once. Anything else is
refused as `retry_not_found` (400) after the run opens.

## 12. Runbooks

- [Backup and restore](runbooks/backup-restore.md)
- [Migration ledger state](runbooks/migration-ledger-state.md)
- [Job lifecycle and outbox](runbooks/job-lifecycle-outbox.md)
- [Lifecycle consumers cutover](runbooks/2026-10-07-lifecycle-consumers.md)
- [Initial identity turn](runbooks/2026-10-13-initial-identity-turn.md)
- [Maintenance and inactivity rollout](runbooks/2026-10-02-maintenance-inactivity-rollout.md)
  and [cleanup estimate SQL](runbooks/sql/maintenance-cleanup-estimate.sql)
- [Agent variant production signals SQL](runbooks/agent-variant-signals.sql) (read-only)
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
