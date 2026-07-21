# Remote Job Tracker

Polls the public APIs of applicant-tracking systems (Greenhouse, Lever, Ashby)
for a curated list of companies, detects newly opened and closed roles, and
stores them in Postgres for a read-only dashboard.

See [`job-tracker-prd.md`](job-tracker-prd.md) for the full product spec.

## Components

| Part | Location | Deploys to | Status |
|------|----------|-----------|--------|
| Job Discovery (backend) | repo root (`job_discovery/`) | Railway cron service | ✅ live |
| Database | `schema.sql` | Supabase (Postgres) | ✅ live |
| Dashboard (frontend) | `dashboard/` | Vercel | planned (M3) |

## Job Discovery

A Python package run as `python -m job_discovery`. It reads `targets.json`, fetches
each company's open roles via the matching ATS adapter, normalizes them, and
upserts into Postgres with new/closed detection and per-run accounting, then
closes its connection and exits (a hard requirement for the Railway cron model).

### Run locally

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv -e ".[dev]"
DATABASE_URL="postgresql://…" .venv/bin/python -m job_discovery
```

### Tests

```bash
.venv/bin/pytest                 # unit tests
# DB integration tests run when TEST_DATABASE_URL points at a throwaway Postgres:
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest
```

### Review phase

At the end of each poll run Job Discovery automatically calls the reviewer, which
scores every unreviewed job against the active user profile and writes results
to the `reviews` table.  It can also be run standalone:

```bash
DATABASE_URL="postgresql://…" ANTHROPIC_API_KEY="sk-…" .venv/bin/python -m reviewer
```

**Required env var:**

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key. The review phase is silently skipped when this is absent. |

**Optional env vars (all have defaults):**

| Variable | Default | Description |
|----------|---------|-------------|
| `REVIEW_MODEL_STAGE1` | `claude-haiku-4-5` | Model used for the gate (title-only) pass. |
| `REVIEW_MODEL_STAGE2` | `claude-haiku-4-5` | Model used for the full JD pass. |
| `REVIEW_DEFAULT_MODEL_STANDARD` | `deepseek/deepseek-v4-flash` | Default stage-2 model for **Standard** users who haven't picked one (`profiles.model_stage2` unset). |
| `REVIEW_DEFAULT_MODEL_PRO` | `gemini-flash-latest` | Default stage-2 model for **Pro** users who haven't picked one. Set identically on the reviewer and dashboard services so the enforced and displayed daily caps agree. The resolved model is still tier-gated and metered, so an unassigned model (like this one) meters at the Pro premium cap. |
| `REVIEW_CONCURRENCY` | `5` | Max concurrent Anthropic requests per run. |
| `REVIEW_DAILY_CAP_DEFAULT` | `400` | Per-user, per-day ceiling on jobs entering review (a hard cost cap regardless of run cadence, pool size, or profile edits). A profile's `daily_review_cap` column overrides this per-user. Spend is tracked in `usage_counters` and rolls over at UTC midnight. |

**No-op conditions:** the review phase exits immediately (no API calls, no DB
writes) when `ANTHROPIC_API_KEY` is unset or when no active user profile exists
in the database.

**Railway note:** set the env vars above on the Job Discovery service, and extend the
watch patterns in the Railway dashboard to include `reviewer/**` so that
reviewer-only commits also redeploy the Job Discovery service.

### On-demand review worker

The cron reviewer runs on a schedule, so a brand-new account (or a user who clicks
"Review my board now") would otherwise wait until the next cycle. A small always-on
worker consumes the `review_requests` queue near-real-time:

```bash
DATABASE_URL="postgresql://…" OPENROUTER_API_KEY="sk-or-…" python -m reviewer.worker
```

It claims the oldest `pending` request (`FOR UPDATE SKIP LOCKED`, so multiple workers
are safe), loads that user's profile, and runs the **same** `run._review_user` path as
the cron reviewer — so the per-tier daily cap, mandatory location filter, and
model-entitlement policy all apply with no duplicated logic. A request stuck `running`
longer than 30 minutes (crashed worker) is auto-failed so a user's single active slot
can't wedge. Idle poll interval: `REVIEW_WORKER_POLL_SECONDS` (default 15). SIGTERM/
SIGINT exit cleanly after the in-flight request.

Deploys as its own **always-on** Railway service (no cron): `railway.reviewer-worker.json`,
start `python -m reviewer.worker`.

> **Pre-launch (manual, do NOT push migration-coupled code first):** creating the
> Railway worker service AND applying both Phase-1 migrations
> (`migrations/2026-07-03-rls-tenant-isolation.sql` then
> `migrations/2026-07-03-billing-review-requests.sql`, in that order) are manual steps.
> Apply the migrations before the code that depends on `review_requests` / RLS ships.

## Configuration

- `targets.json` — the tracked companies (`{ name, ats, token }`); `ats` is one
  of `greenhouse` / `lever` / `ashby` / `workable` / `smartrecruiters` / `workday`.
  Workday packs its three coordinates into `token` as `tenant:datacenter:site`
  (e.g. `acme:wd5:External`); the others use the provider's account slug.
- `DATABASE_URL` — Postgres connection string (Railway service variable; never committed).

## Deployment

- **Job Discovery** → Railway cron service (`0 */2 * * *` UTC), root `/`, start `python -m job_discovery`.
  Railway **watch patterns** are scoped to backend paths (`job_discovery/**`, `requirements.txt`,
  `pyproject.toml`, `railway.json`, `targets.json`, `schema.sql`), so frontend/docs-only
  commits do not rebuild Job Discovery.
- **Company Discovery** → Railway cron service (slow, e.g. weekly), root `/`, start `python -m company_discovery`.
  Reuses Job Discovery's `DATABASE_URL` + `OPENROUTER_API_KEY`; reviews dataset companies against the
  operator's company preferences and reconciles `companies.active`. The dataset snapshot is vendored
  under `company_discovery/data/`. Watch patterns: `company_discovery/**`, `requirements.txt`, `pyproject.toml`,
  `railway.discovery.json`, `schema.sql`. `DISCOVERY_BATCH_CAP` (default 500/run) bounds how many *new*
  candidates a single run reviews — keep it small so one run cannot activate thousands of companies
  at once (each active company is then polled and accrues `jobs` rows). Company Discovery is incremental: a
  company is re-reviewed only when its `company_profile_version` changes.
- **Disk safety valve** → both Job Discovery and Company Discovery call `db.over_size_ceiling()` at startup and
  **halt the run with no writes** once `pg_database_size` reaches `DB_SIZE_CEILING_MB` (default
  **6000** = 6 GB). The Supabase Pro volume is 8 GB; the ~2 GB headroom absorbs one poll's growth plus
  WAL so the DB can never reach the hard limit (which forces Postgres read-only and, if WAL then fills
  the disk, a crash-recovery loop). Lower the ceiling for a smaller plan; never set it at/above the
  actual volume size.
- **Job-data retention** → Job Discovery distils each role's JD into `jobs.description`
  at poll time (no raw payload is stored) and prunes at the end of every run:
  denied roles lose their `description` (the review record is kept; a denied role is
  never re-reviewed even after a résumé edit — its pruned JD makes re-review moot), and closed or
  deactivated-company roles are deleted after `CLOSED_JOB_RETENTION_DAYS` (default 30)
  unless approved. Tuning: `PRUNE_BATCH_SIZE` (2000), `PRUNE_MAX_ROWS_PER_RUN` (20000).
  One-time migration of pre-existing rows: `python -m job_discovery.backfill_descriptions`.
- **Database** → Supabase (Postgres). Apply `schema.sql` as a migration. Incremental
  changes are in `migrations/` — apply each file manually in filename order against Supabase,
  then record it with `INSERT INTO schema_migrations (filename) VALUES ('<file>');`.
  Every migration must be idempotent (`IF [NOT] EXISTS`), transactional where possible
  (`BEGIN/COMMIT`), and mirrored into `schema.sql`. `CREATE INDEX CONCURRENTLY` statements
  cannot run inside a transaction — keep them outside `BEGIN/COMMIT` and run them individually.
- **Dashboard** → Vercel (root `dashboard/`), connecting via the Supabase transaction pooler.
- **OpenRouter spend alert** → Railway **cron** service (`railway.spend-alert.json`, hourly
  `0 * * * *`), root `/`, start `python -m observability.spend_alert`. It snapshots
  OpenRouter usage/credits into `openrouter_usage_snapshots`, computes the trailing-24h
  burn, and POSTs to `ALERT_WEBHOOK_URL` when the 24h burn exceeds `SPEND_ALERT_DAILY_USD`
  (default $10) or remaining credits fall below `SPEND_ALERT_CREDITS_FLOOR_USD` (default
  $20). If a threshold trips but the webhook is unset or the POST fails, it exits nonzero
  so the cron surfaces the failure (never a silent pass). This is the backstop *behind*
  the per-user daily caps and the `OutOfCreditsError` hard halt — not a replacement.

Pushes to `main` auto-deploy the affected component.

## Ops runbooks

- **Backup & restore:** [`docs/runbooks/backup-restore.md`](docs/runbooks/backup-restore.md)
  — verified Supabase backup posture for prod `fdhspmavadgucktetzoi`, the restore
  procedure + post-restore checklist (schema-migration audit, Stripe re-sync, stuck
  review-request cleanup, worker restart), the not-restorable list (storage objects,
  LangFuse traces), and the RPO/RTO the current setup provides.
