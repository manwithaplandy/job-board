# Remote Job Tracker

Polls the public APIs of applicant-tracking systems (Greenhouse, Lever, Ashby)
for a curated list of companies, detects newly opened and closed roles, and
stores them in Postgres for a read-only dashboard.

See [`job-tracker-prd.md`](job-tracker-prd.md) for the full product spec and
[`docs/superpowers/plans/`](docs/superpowers/plans/) for the implementation plans.

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

## Configuration

- `targets.json` — the tracked companies (`{ name, ats, token }`); `ats` is one
  of `greenhouse` / `lever` / `ashby`.
- `DATABASE_URL` — Postgres connection string (Railway service variable; never committed).
