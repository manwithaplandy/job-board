# Company display-name casing — design

**Date:** 2026-07-06
**Problem:** Nearly every company row (15,859 / 15,864 in prod) has `companies.name`
set to the lowercase ATS board token (e.g. `maplighttherapeutics`, `pushpress`),
because bulk dataset ingestion uses the slug as the name. The `display_name`
column (real name, fetched by enrichment) exists, but ~80% of companies with open
jobs lack it, and several dashboard surfaces ignore it entirely — so users see
lowercase slugs.

**Constraint (user):** the fix must not require LLM inference. Everything below is
deterministic HTTP + SQL.

## Why coverage is bad today

| ATS | companies w/ open jobs | missing display_name | cause |
|---|---|---|---|
| greenhouse | 2,129 | 1,409 | enrichment deliberately skips active/seed companies (avoids re-queueing LLM review via `enriched_at > reviewed_at`) |
| ashby | 971 | 971 | `enrich_from_jd` returns `(None, about)` — the ashby JSON API has no org-name field |
| lever | 609 | 609 | same |

Validated name sources (no auth, same public boards the poller already hits):

- **greenhouse:** board root `https://boards-api.greenhouse.io/v1/boards/{token}`
  → `name` (existing `enrich_greenhouse`; 0 enriched-but-nameless rows in prod).
- **lever:** `https://jobs.lever.co/{token}` HTML `<title>` is the exact name
  (`PushPress`, `CIC`).
- **ashby:** `https://jobs.ashbyhq.com/{token}` HTML `<title>` is `{Name} Jobs`
  (strip the suffix).
- workable / smartrecruiters: existing enrichers already return names.

## Design

### 1. Backend: lever/ashby board-title name fetcher

- Add `get_text(url)` to `job_discovery/http.py` (mirror of `get_json`, returns
  `resp.text`; same retry/backoff/shared-client contract).
- Add `fetch_board_name(ats, token)` to `company_discovery/enrich.py` for
  lever/ashby: fetch the board page, extract the first `<title>…</title>`,
  `html.unescape`, strip, then strip a trailing case-insensitive ` jobs` word.
  Empty/missing title → `None`.
- Wire it into `enrich_from_jd` so the standing enrichment path returns
  `(name, about)` for lever/ashby going forward. A title-fetch failure must not
  sink the JD probe (and vice versa) — guard each independently.

### 2. One-time name backfill (`company_discovery/name_backfill.py`)

- **Scope:** `active = TRUE AND display_name IS NULL` (~5.8k rows; covers all
  2,989 slug-showing companies with open jobs).
- **Per-ATS name source:** greenhouse/workable/smartrecruiters → name half of the
  existing enrichers; lever/ashby → `fetch_board_name`. Unsupported ATS / dead
  board / empty name → skip (no write), so a rerun retries transient failures.
- **Write:** `UPDATE companies SET display_name = %s WHERE id = %s AND
  display_name IS NULL`. **Deliberately does NOT touch `enriched_at` / `about` /
  `about_source`:** stamping `enriched_at` would re-queue thousands of
  already-reviewed companies for LLM re-screen (`enriched_at > reviewed_at`
  predicate in `select_for_review`) — cost + verdict churn, and it would violate
  the no-LLM constraint.
- Concurrency/durability mirrors `enrich_backfill.py`: `MAX_WORKERS = 5` thread
  pool for HTTP, DB writes on the main thread, commit every 50, resumable via the
  `display_name IS NULL` guard.
- Rollout artifact: operator runs once with prod `DATABASE_URL` after deploy.

### 3. Dashboard: coalesce `display_name` on the remaining surfaces

The board, reviewer, and metrics already use `COALESCE(c.display_name, c.name)`.
Extend the same to:

- `dashboard/lib/queries.ts` `listCompanies` (~line 615): select the coalesced
  value as `name`, ORDER BY it, and make search match
  `(c.name ILIKE … OR c.display_name ILIKE …)` so slug searches still work.
- `dashboard/lib/generationJobs.ts` (~line 125) — toast labels.
- `dashboard/app/actions/corrections.ts` (~line 34) and
  `dashboard/app/actions/resumeScores.ts` (~line 34) — LLM generation context
  should carry the real company name.
- `dashboard/lib/accountExport.ts` (lines ~92–98) — exported review rows.
- Sweep for any other bare `c.name` reads during implementation (admin surfaces).

### Non-goals

- Do **not** rewrite `companies.name` — it is the slug-keyed identity used by
  dataset dedup (`ON CONFLICT (ats, token)`), seed sync, and joins. `display_name`
  stays the display layer.
- No titleize heuristic (wrong for run-together slugs and acronyms).
- No LLM-derived names (fabrication risk; violates the constraint).
- No schema change — `display_name` already exists.

## Error handling

- Fetch failures skip the row (log + no write) — same policy as
  `plan_enrichment`; reruns are idempotent.
- Title parsing is defensive: no `<title>`, empty after strip → `None` → skip.

## Testing

- Python: unit tests for title extraction (suffix strip, entity unescape, missing
  title); `enrich_from_jd` still returns about-text when the title fetch fails and
  vice versa; backfill scope + display_name-only write (local PG,
  `TEST_DATABASE_URL`, per repo test conventions).
- Dashboard: vitest — `listCompanies` coalescing/search follows existing
  query-test patterns; adjust any tests asserting bare `c.name`.

## Rollout

1. Merge → push to main (auto-deploys Vercel dashboard + Railway pollers; no
   migrations involved).
2. Run `name_backfill` once against prod.
3. Verify: Companies page + board show cased names; re-run the coverage SQL
   (visible companies missing display_name should drop to ~0 for
   greenhouse/lever/ashby minus dead boards).
