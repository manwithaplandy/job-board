# Remote Job Tracker

Polls the public APIs of applicant-tracking systems (Greenhouse, Lever, Ashby)
for a curated list of companies, detects newly opened and closed roles, and
stores them in Postgres for a read-only dashboard.

See [`job-tracker-prd.md`](job-tracker-prd.md) for the full product spec.

## Components

| Part | Location | Deploys to | Status |
|------|----------|-----------|--------|
| Poller (backend) | repo root (`poller/`) | Railway cron service | ✅ live |
| Database | `schema.sql` | Supabase (Postgres) | ✅ live |
| Dashboard (frontend) | `dashboard/` | Vercel | planned (M3) |

## Poller

A Python package run as `python -m poller`. It reads `targets.json`, fetches
each company's open roles via the matching ATS adapter, normalizes them, and
upserts into Postgres with new/closed detection and per-run accounting, then
closes its connection and exits (a hard requirement for the Railway cron model).

### Run locally

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv -e ".[dev]"
DATABASE_URL="postgresql://…" .venv/bin/python -m poller
```

### Tests

```bash
.venv/bin/pytest                 # unit tests
# DB integration tests run when TEST_DATABASE_URL points at a throwaway Postgres:
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest
```

### Review phase

At the end of each poll run the poller automatically calls the reviewer, which
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
| `REVIEW_CONCURRENCY` | `5` | Max concurrent Anthropic requests per run. |
| `REVIEW_MAX_JOBS_PER_RUN` | `200` | Cap on jobs reviewed in a single run. |

**No-op conditions:** the review phase exits immediately (no API calls, no DB
writes) when `ANTHROPIC_API_KEY` is unset or when no active user profile exists
in the database.

**Railway note:** set the env vars above on the poller service, and extend the
watch patterns in the Railway dashboard to include `reviewer/**` so that
reviewer-only commits also redeploy the poller service.

## Configuration

- `targets.json` — the tracked companies (`{ name, ats, token }`); `ats` is one
  of `greenhouse` / `lever` / `ashby`.
- `DATABASE_URL` — Postgres connection string (Railway service variable; never committed).

## Deployment

- **Poller** → Railway cron service (`0 */2 * * *` UTC), root `/`, start `python -m poller`.
  Railway **watch patterns** are scoped to backend paths (`poller/**`, `requirements.txt`,
  `pyproject.toml`, `railway.json`, `targets.json`, `schema.sql`), so frontend/docs-only
  commits do not rebuild the poller.
- **Discovery** → Railway cron service (slow, e.g. weekly), root `/`, start `python -m discovery`.
  Reuses the poller's `DATABASE_URL` + `OPENROUTER_API_KEY`; reviews dataset companies against the
  operator's company preferences and reconciles `companies.active`. The dataset snapshot is vendored
  under `discovery/data/`. Watch patterns: `discovery/**`, `requirements.txt`, `pyproject.toml`,
  `railway.json`, `schema.sql`. Raise `DISCOVERY_BATCH_CAP` (default 500/run) for the one-time bulk pass.
- **Database** → Supabase (Postgres). Apply `schema.sql` as a migration.
- **Dashboard** → Vercel (root `dashboard/`), connecting via the Supabase transaction pooler.

Pushes to `main` auto-deploy the affected component.
