# PRD — Remote Job Tracker

**Owner:** Andrew
**Status:** Draft for implementation
**Audience:** Software developer agent
**Last updated:** 2026-06-22

---

## 1. Summary

A personal tool that polls the public APIs of applicant-tracking systems (ATS) for a curated list of target companies, detects newly opened and newly closed roles, and surfaces filtered results in a read-only web dashboard. The goal is to replace manually checking ~15 company career pages with a single, always-current view filtered to roles that match the operator's interests.

This is a **single-operator, personal-use** tool. No multi-tenancy, no public sign-up.

---

## 2. Problem & motivation

For specialized senior roles, generic job boards are low-signal and high-competition, and good listings are often filled before they're widely aggregated. The higher-signal channel is tracking specific companies' career pages directly — but doing that by hand across many companies is tedious and easy to let slip.

Almost every modern tech company runs its careers page on Greenhouse, Lever, or Ashby, all of which expose **public, structured JSON APIs**. This makes reliable polling possible without scraping JS-rendered HTML.

---

## 3. Goals & non-goals

### Goals
- Poll a configurable list of target companies on a schedule (default: every 2–4 hours).
- Normalize postings from Greenhouse, Lever, and Ashby into one schema.
- Detect **new** postings (first seen) and **closed** postings (disappeared from feed) across runs.
- Provide a dashboard with server-side filtering by company, title keywords (include/exclude), location/remote, and status.
- Run at ~zero marginal cost on top of the operator's existing Railway Hobby plan.

### Non-goals (V1)
- Notifications (email/Slack) — designed for, but deferred to V2.
- In-app editing of the target list — V1 edits a committed config file. (Supabase Auth makes this a cheap V2 add.)
- Authentication / multi-user — V1 dashboard is single-operator and may be a public URL (operator has accepted that the target list is non-sensitive).
- Description-level keyword matching — V1 matches on title only.
- ATS platforms beyond the core three (Workday, Workable, SmartRecruiters, Gem, custom) — adapters added later as needed.

---

## 4. Key decisions & rationale

| Decision | Choice | Why |
|---|---|---|
| **Scheduler** | Railway cron service | Operator already runs a Railway Hobby plan. A cron service runs only for the seconds it executes, so its compute cost is negligible and stays inside the included $5/mo credit. Vercel Hobby cron was rejected: it caps at once/day with unpredictable timing and no retries. |
| **Poller language** | Python | Operator preference; ATS adapters are naturally expressed in Python; trivially testable locally outside any deploy (`python -m poller`). |
| **Database** | Supabase (managed Postgres, free tier) | Stateless runtimes need external state for dedup and "new" detection. Supabase free gives 500 MB Postgres — far more than this workload. Free projects pause after 7 days of *database* inactivity, but the 2–4h poll cadence resets that timer continuously, so it won't pause in normal operation (see §9). Chosen over Neon because Supabase's built-in Auth + table editor make the V2 in-app target-management feature cheap to add later. An always-on Railway Postgres would instead burn ~$5–15/mo continuously — see alternative below. |
| **DB access pattern** | Direct SQL (psycopg / Postgres driver), **not** the PostgREST Data API or RLS | Keeps the schema in §7 identical to a plain Postgres setup, avoids RLS complexity (pointless for a single operator), and sidesteps the 2026 Data API Postgres-grants changes. |
| **Dashboard** | Next.js (read-only) on Vercel Hobby | Satisfies the "Vercel dashboard" requirement; read-only means minimal function usage and no cron dependency. Connects to Supabase via the transaction-mode pooler. |
| **Target list source** | Committed `targets.json` in repo | At ~15 companies, redeploy-to-edit is acceptable and removes all write-auth surface from V1. |

### Cost note
Recommended topology — Railway cron poller + Supabase DB + Vercel dashboard — costs **~$0 on top of the existing Railway Hobby subscription** (poller usage is negligible; Supabase and Vercel are free). The poller's only Railway footprint is a few seconds of compute per run.

### Alternative architectures (documented, not chosen)
1. **Railway-hosted Postgres (consolidation).** Run the database on Railway too, dropping Supabase. Fewer platforms, but the always-on Postgres container consumes compute continuously and pushes usage **~$5–15/mo over the $5 credit**. Choose this only if one fewer platform is worth the monthly overage.
2. **Supabase-native (SDK + PostgREST + RLS).** Use `supabase-js`/`supabase-py` against the auto-generated Data API with Row Level Security instead of direct SQL. More idiomatic and a head start on auth, but adds RLS policy work and a dependency on the Data API. Deferred until the V2 auth feature actually needs it.
3. **All-Vercel / all-TypeScript.** Poller as a Vercel API route triggered by an external scheduler (the daily Vercel-cron limit forces this). Single platform/language, but loses local Python testability and reintroduces a second scheduling service anyway. Rejected.

---

## 5. Architecture

```
┌──────────────────────────┐   cron schedule (UTC, e.g. 0 */2 * * *)
│  Railway: Python poller   │◄─────────────────────────────────────
│  (cron service)           │
│  - fetch adapters         │   reads targets.json (in repo)
│  - normalize              │
│  - upsert + dedup         │   writes (psycopg, direct SQL)
│  - closed-detection       │──────────────┐
│  - MUST exit on completion│              ▼
└──────────────────────────┘     ┌──────────────────┐
                                 │  Supabase        │
                                 │  (managed        │
                                 │   Postgres, free)│
                                 │  companies, jobs,│
                                 │  poll_runs       │
                                 └──────────────────┘
                                          ▲
                                 reads    │  (transaction-mode pooler, :6543)
┌──────────────────────────┐              │
│  Vercel (Hobby)           │──────────────┘
│  Next.js dashboard        │
│  - read-only              │
│  - server-side filtering  │◄─── operator's browser
└──────────────────────────┘
```

Two deployables sharing one database. The Supabase connection string is set in **Railway service variables** (poller, direct connection or session pooler) and **Vercel env vars** (dashboard, transaction-mode pooler).

---

## 6. Source adapters

Each adapter takes a company `token` and returns a list of normalized postings. Endpoints are public, unauthenticated GET requests.

| ATS | Endpoint | Key fields to extract |
|---|---|---|
| **Greenhouse** | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs` | `id`, `title`, `location.name`, `absolute_url`, `updated_at` |
| **Lever** | `https://api.lever.co/v0/postings/{token}?mode=json` | `id`, `text`, `categories.location`, `categories.team`, `hostedUrl` |
| **Ashby** | `https://api.ashbyhq.com/posting-api/job-board/{token}` | `id`, `title`, `location`, `department`, `jobUrl` |

**Normalized posting schema** (adapter output):

```python
@dataclass
class Posting:
    external_id: str       # the ATS's own job id
    title: str
    url: str               # apply / detail URL
    location: str | None
    department: str | None
    remote: bool | None    # best-effort; see below
    raw: dict              # original payload, for debugging
```

**Remote detection is best-effort and imperfect.** Flag `remote = True` if the ATS exposes a remote flag, or if the location string matches `/remote/i`. Document this as a known weakness — some genuinely-remote roles won't be flagged, and some "remote" labels are hybrid.

**Adapter contract:**
```python
def fetch(token: str) -> list[Posting]: ...

ADAPTERS: dict[str, Callable[[str], list[Posting]]] = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
}
```

Adapters must fail independently: one company's API erroring (or changing shape) must not abort the whole run. Wrap each in try/except, record the failure in `poll_runs`, continue.

---

## 7. Data model (Supabase Postgres)

```sql
CREATE TABLE companies (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby')),
  token   TEXT NOT NULL,
  active  BOOLEAN NOT NULL DEFAULT TRUE,
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
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  raw           JSONB
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;

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
```

Apply via the Supabase SQL editor (or a migration). `companies` is seeded/synced from `targets.json` at the start of each run (upsert by `(ats, token)`; mark missing ones `active = false`).

---

## 8. Functional requirements

**Polling**
- **FR-1** Load `targets.json` and upsert into `companies`.
- **FR-2** For each active company, call the matching adapter and collect normalized postings.
- **FR-3** Upsert each posting into `jobs` keyed on `{ats}:{token}:{external_id}`. On insert, set `first_seen_at = now()`. On any sighting, set `last_seen_at = now()` and clear `closed_at` (reopened roles).
- **FR-4** Closed detection: for each successfully-polled company, set `closed_at = now()` on any of its jobs where `closed_at IS NULL` and the `external_id` is absent from the current feed. **Skip closed-detection for companies whose fetch failed** (an API error must not mass-close their roles).
- **FR-5** Record each run in `poll_runs` (counts + per-company failures in `notes`).
- **FR-6** The poller process **must close all DB connections and exit** when finished (Railway requirement — see §9).

**Dashboard**
- **FR-7** Default view: open jobs (`closed_at IS NULL`) across all companies, sorted `first_seen_at DESC`.
- **FR-8** "New" badge on jobs with `first_seen_at` within a configurable window (default 48h).
- **FR-9** Filters (server-side, via query params → SQL): company (multi-select), title include keywords, title exclude keywords, remote-only toggle, status (open / closed / all).
- **FR-10** A configurable default filter (e.g., the operator's target titles) applied on first load, overridable in the UI.
- **FR-11** Each row links to its ATS apply URL and shows company, title, location, first-seen date.
- **FR-12** Header shows last successful poll time and a health indicator derived from the latest `poll_runs` row (e.g., red if last run had failures or is stale > 12h).

---

## 9. Non-functional requirements

- **Railway cron — must exit cleanly (critical).** Railway runs the service's start command on the schedule and expects the process to finish and release all resources. If the process does not exit (lingering DB connections, un-awaited tasks, background threads), **subsequent cron executions are skipped**. The poller must `close()` the connection and return. Recommended start command: `python -m poller`.
- **Schedule constraints.** Railway cron is UTC-only, has a 5-minute minimum interval, and is not minute-precise (runs can drift a few minutes). The 2–4h cadence is well within limits; e.g. `0 */2 * * *`.
- **Supabase inactivity pause — neutralized by poll cadence.** Free Supabase projects pause after 7 days with no database activity and must be restored from the dashboard (~30s, data preserved). The inactivity timer resets on any DB query, and the poller writes every 2–4 hours — roughly 40–80x under the threshold — so the project will not pause in normal operation. No separate keep-alive ping is required. (If polling is ever suspended for a week+, manually restore from the dashboard.)
- **Connection pooling.** Free tier allows 60 direct and 200 pooler connections. The Vercel dashboard must connect via Supabase's **transaction-mode pooler (port 6543)** to avoid exhausting direct connections from short-lived serverless invocations. The Railway poller (one short-lived process per run) may use the direct connection (5432) or session pooler.
- **Backups.** The free tier has no automatic backups, but the `jobs` data is reconstructible by re-polling the live feeds; the only non-regenerable field is `first_seen_at` history. Backups are therefore low priority — optionally add a periodic `pg_dump` later if history matters.
- **No built-in failure alerting.** Railway logs runs but will not alert on failure. `poll_runs` is the primary record; a lightweight external dead-man's-switch ping (e.g. healthchecks.io) is an optional V2 add to catch silent failures.
- **Free-tier budgets.** Poller compute is a few seconds per run → negligible Railway usage, inside the $5 Hobby credit. Supabase free (500 MB Postgres, 5 GB egress) far exceeds the few-hundred-row data volume. Vercel function usage is minimal (read-only dashboard).
- **Secrets.** Supabase connection string(s) in Railway service variables and Vercel env. Never commit credentials.
- **Resilience & idempotency.** Per-company isolation (FR-4 caveat); network calls get a timeout and small retry-with-backoff. Re-running the poller must not create duplicates or spuriously bump `first_seen_at`.

---

## 10. Tech stack

- **Poller:** Python 3.12, `httpx` (or `requests`), `psycopg` (v3) connecting to the Supabase connection string via direct SQL. Single entry point runnable via `python -m poller`. Deployed to Railway via Nixpacks (auto-detected — no Dockerfile required).
- **Scheduler:** Railway cron service. Cron schedule set under the service's Settings; start command runs the poller to completion and exits.
- **DB:** Supabase (managed Postgres, free tier), accessed as plain Postgres (no PostgREST Data API / RLS).
- **Dashboard:** Next.js (App Router), TypeScript, connecting to Supabase via the transaction-mode pooler with a standard Postgres driver (e.g. the `postgres` npm package); `@supabase/supabase-js` is optional and only needed if/when the V2 auth feature lands. Server components for data fetching. Minimal, responsive UI, deployed to Vercel Hobby.

---

## 11. Build phases

- **M0 — Scaffold:** Repo, `targets.json`, Supabase project provisioned, schema applied via the SQL editor, env/secrets wired in Railway and Vercel (direct connection for poller, transaction pooler for dashboard).
- **M1 — Poller core:** Three adapters + normalization + upsert/dedup + closed-detection + clean exit. Runs locally against 2–3 real companies and populates Supabase correctly. Unit tests for each adapter's field mapping (use captured fixture payloads).
- **M2 — Schedule:** Deploy the poller to Railway as a service with a cron schedule. Verify scheduled runs populate the DB, write `poll_runs`, and that the deployment reaches **Completed** status (i.e., the process exited — confirming the next run won't be skipped).
- **M3 — Dashboard:** Read-only Next.js app with FR-7 through FR-12, deployed to Vercel reading Supabase via the pooler.
- **M4 (optional/V2):** Notifications on new matches; dead-man's-switch monitoring; in-app target management via Supabase Auth; additional ATS adapters.

---

## 12. Acceptance criteria (Definition of Done)

1. Running the poller twice in a row against the same feeds produces **zero** new inserts and **zero** `first_seen_at` changes on the second run.
2. The Railway cron service reaches **Completed** after each run (process exits, no lingering connections); a second scheduled run is **not** skipped.
3. Introducing a company whose API returns an error leaves all other companies' data intact and records the failure in `poll_runs`; **none** of the failing company's open jobs are marked closed.
4. A role removed from a company's live feed gets `closed_at` set on the next run; a role re-added gets `closed_at` cleared.
5. The dashboard, given include-keyword `engineer` and exclude-keyword `manager`, returns only open titles containing "engineer" and not "manager", newest first.
6. The "New" badge appears only on jobs first seen within the configured window.
7. Over a normal week, Railway usage stays within the $5 Hobby credit and Supabase/Vercel stay within free limits; the Supabase project remains active (un-paused) under the normal polling cadence.

---

## 13. Open questions

1. **Notification channel** (V2): email vs Slack webhook vs both, and whether to also wire a dead-man's-switch to catch silent poller failures.
2. **Title-only vs description matching.** Title-only is cheap and covers most needs. Description matching means fetching each posting's full body (Greenhouse `?content=true`, etc.) — many more requests and HTML parsing. Worth it only if title filtering proves too coarse.
3. **Long-tail ATS.** Workday is notably harder (tenant-specific, no clean public JSON). Decide per-company whether it's worth a bespoke adapter or just a manual-check bookmark.

---

## Appendix A — Finding a company's ATS + token

The token is visible in the careers URL:
- `boards.greenhouse.io/{token}` or `job-boards.greenhouse.io/{token}` → **greenhouse**, token = slug.
- `jobs.lever.co/{token}` → **lever**, token = slug.
- `jobs.ashbyhq.com/{token}` → **ashby**, token = slug.

Many companies embed one of these behind a custom `/careers` page — check the network tab or the "View all jobs" link, which usually redirects to the underlying board. Companies on Workday/Workable/SmartRecruiters/custom systems are out of scope for V1.

## Appendix B — `targets.json` shape

```json
[
  { "name": "Anthropic", "ats": "ashby",      "token": "anthropic" },
  { "name": "Modal",     "ats": "greenhouse", "token": "modallabs" }
]
```
