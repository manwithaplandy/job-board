# Company Auto-Discovery + AI Review + Human Override — Design

**Owner:** Andrew
**Status:** Approved for planning
**Date:** 2026-06-26
**Supersedes/extends:** the manual `targets.json` company list

---

## 1. Summary

Today the set of companies the poller watches is a hand-curated `targets.json` (3 companies). This feature scales that up: a **discovery stage** ingests a large public dataset of ATS job-board tokens, an **AI reviewer** classifies each company (include / exclude / unknown) against the operator's stated company preferences, the AI's decision **auto-applies** (an "include" starts polling that company's jobs), and a **dashboard surface** lets the operator review and **override** any decision — stickily.

It lifts the existing "AI decides → human overrides" pattern (already built for *jobs* in `reviewer/` + `job_reviews`) up to the **company** level, and adds a sourcing mechanism upstream of the poller. Everything downstream of the `companies` table (poll → job review → Rolefit board) is unchanged.

---

## 2. Context — the existing system

- **`poller/`** (Python, Railway cron, every 2–4h): reads `targets.json`, upserts into `companies`, polls Greenhouse/Lever/Ashby public APIs, dedups jobs, detects new/closed. Folds the reviewer in at the end.
- **`reviewer/`** (Python): two-stage AI review of *jobs* against a *profile* (résumé + `instructions`). Stage 1 = cheap relevance gate; stage 2 = full fit review via OpenRouter (`deepseek/deepseek-v4-flash` default). Writes `job_reviews` (one current verdict per `(user_id, job_id)`, re-review upserts; invalidated by `profile_version`).
- **`dashboard/`** (Next.js, Vercel): "Rolefit" board — filtered job list, detail, résumé panel, profile modal. Single operator (Supabase Auth); server-side via direct `DATABASE_URL`, RLS deny-all on every table.

This feature reuses those patterns wholesale: the OpenRouter client shape, the `*_runs` accounting tables, the `profile_version` re-review trigger, per-item isolation, and the Tailwind/`components/rolefit/*` UI language.

---

## 3. Goals & non-goals

### Goals
- Source candidate companies automatically from a free public ATS-board dataset.
- AI-classify each company **include / exclude / unknown** against operator-supplied company preferences (e.g. *"prefer devtools & AI infra, exclude defense, exclude legacy Java/C/C++ shops"*).
- Auto-apply the AI verdict (`include` → company becomes active and gets polled).
- Let the operator override any verdict from the dashboard; overrides are **sticky** across re-reviews.
- Keep cost low and predictable; never strand a half-finished scan when OpenRouter credits run out.

### Non-goals (v1)
- **JD-based enrichment** of the company dossier — v1 reviews on company *name + model knowledge only* (token-frugal). The enrichment hook is left pluggable for later.
- **Embedding / "similar-to-seed" curation** — brute-forcing the whole dataset by name is cheap enough (~$10 once) to make this unnecessary.
- **Multi-user company sets** — single operator; `companies.active` is driven by the one operator's verdicts (generalization noted in §11).
- **Synchronous "retry from the browser"** — retry is flag + next discovery run (see §8).

---

## 4. Key decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Candidate source | **Public dataset firehose**, brute-forced | Free CC-BY-NC dataset of ~95k board tokens exists; filtered to Greenhouse/Lever/Ashby ≈ 50–65k. AI reviews *all* of them by name. |
| 2 | What the reviewer reads | **Company name + model knowledge only** | Minimizes tokens. JD enrichment is pluggable but deferred. Weaker on "uses Java/C/C++" (a JD signal) — accepted v1 tradeoff. |
| 3 | Review shape | **Single LLM call** (not two-stage) | Input is tiny; no need for a cheap gate before an "expensive" review when the review is already cheap. |
| 4 | Human-in-the-loop | **AI verdict auto-applies; human override is sticky** | Matches "overwrite the AI's decisions." The UI is a review/override surface, not a mandatory approval gate. |
| 5 | Unknown companies | **Default to `exclude`, surfaced in their own bucket** | Model can't judge what it doesn't know. Keeps the active poll set clean; operator can hand-rescue the long tail. |
| 6 | Location | **Handled downstream** by existing `preferred_locations` job filter | No need to probe 50k+ boards to location-gate; approved companies' jobs already get location-filtered. |
| 7 | Verification / probing | **Deferred to first poll** | The dataset asserts these are live boards; the existing poller's per-company isolation handles boards that have since died (mark inactive). No 50k+ discovery-time HTTP probes. |
| 8 | Discovery cadence | **Separate entrypoint** `python -m discovery`, slow/on-demand cron | The heavy pass is one-time/occasional; keeps the 2–4h poll path fast. |
| 9 | Source of truth | **`companies` table (DB-authoritative)**; `targets.json` demotes to a seed | Discovery owns `active`; `targets.json` is a small always-included auto-approved seed. |

### Cost analysis (deepseek-v4-flash, $0.09/M in, $0.18/M out, non-reasoning)

Per company ≈ 660 input (≈600 shared, cacheable preferences/schema block + ≈60 company) + 250 output tokens.

| Scenario | Total for ~95k |
|---|---|
| Typical, no caching | ~$9.92 |
| Typical, with prompt caching | ~$5.90 |
| Heavy prompts (1k/400) | ~$15.40 |

≈ **$10 one-time** to classify the whole universe; pennies to keep current. Filtering to the 3 supported ATSes (~50–65k) lowers it further. Re-review only runs on non-overridden + stale rows.

---

## 5. Architecture & data flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │  NEW: discovery stage  (python -m discovery; slow/on-demand) │
   │                                                              │
   │  1. INGEST    dataset JSON (CC-BY-NC ~95k) ─┐                 │
   │               filter to greenhouse/lever/ashby (~50–65k)     │
   │               + targets.json seed (auto-approved)            │
   │                                             ▼                │
   │  2. UPSERT    companies as candidates (active=FALSE)         │
   │                                             ▼                │
   │  3. REVIEW    each un-reviewed / stale, non-overridden co.:  │
   │               single deepseek-v4-flash call                  │
   │               (name + model knowledge vs company-prefs)      │
   │               → verdict: include | exclude | unknown         │
   │               unknown ⇒ excluded (own bucket)               │
   │               writes company_reviews                         │
   │               402 from OpenRouter ⇒ HALT, no retry, backlog  │
   │                                             ▼                │
   │  4. RECONCILE companies.active = (effective verdict=include) │
   └───────────────────────────────────┬─────────────────────────┘
                                        │ active=TRUE companies
                                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  EXISTING poller (every 2–4h) — now reads active companies   │
   │  from DB instead of targets.json → polls jobs → job review   │
   │  → preferred_locations + résumé fit → Rolefit board          │
   └─────────────────────────────────────────────────────────────┘
                                        ▲
   ┌────────────────────────────────────┴────────────────────────┐
   │  Dashboard: NEW "Companies" surface                          │
   │  • tabs: Included / Excluded / Unknown (+ counts)            │
   │  • per company: verdict, confidence, reasoning, tags, source │
   │  • override toggle (sticky) → flips companies.active          │
   │  • company-preferences textarea + model picker in Profile    │
   │  • out-of-credits banner + Refresh button                    │
   └─────────────────────────────────────────────────────────────┘
```

**Effective verdict** = `override_verdict` if `human_override` else `verdict`. `companies.active` reconciles to `(effective verdict == 'include')`. `exclude` and `unknown` both reconcile to inactive.

---

## 6. Data model

One migration `migrations/2026-06-26-company-discovery.sql`; `schema.sql` updated to match. All new tables get `ENABLE ROW LEVEL SECURITY` + the deny-all `no_anon_access` policy used elsewhere.

**Extend `companies`:**
```sql
ALTER TABLE companies ADD COLUMN discovery_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (discovery_source IN ('manual','seed','dataset','expansion'));
ALTER TABLE companies ADD COLUMN first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- discovered candidates insert active=FALSE; only an 'include' verdict (or seed) flips it TRUE
```

**New `company_reviews`** (mirrors `job_reviews`; one row per operator+company, re-review upserts):
```sql
CREATE TABLE company_reviews (
  user_id                 UUID NOT NULL,
  company_id              INT  NOT NULL REFERENCES companies(id),
  company_profile_version TEXT NOT NULL,                 -- sha256(company_instructions)
  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
  reasoning               TEXT,
  industry                TEXT,
  industry_subcategory    TEXT,
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
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
```

**Extend `profiles`:**
```sql
ALTER TABLE profiles ADD COLUMN company_instructions    TEXT;
ALTER TABLE profiles ADD COLUMN company_profile_version TEXT;  -- sha256(company_instructions)
ALTER TABLE profiles ADD COLUMN model_company           TEXT;  -- OpenRouter id; NULL = deepseek-v4-flash
```

**Accounting + credit-halt signal:**
```sql
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

CREATE TABLE discovery_state (             -- single mutable row
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
  resume_requested_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Sticky-override semantics:**
- Re-review (when `company_profile_version` changes) selects `human_override = FALSE` AND (no review OR stale version). It **skips human-decided rows** (saves tokens) and the UPSERT touches only AI fields, never `human_override` / `override_verdict`.
- `unknown` is stored distinctly (own UI bucket) but reconciles to `active = FALSE`.

---

## 7. Backend — new `discovery/` package

Mirrors `poller/` / `reviewer/` layout and style.

- **`discovery/__main__.py`** — `python -m discovery` entrypoint.
- **`discovery/config.py`** — `BATCH_CAP` (companies reviewed per run), `CONCURRENCY`, dataset source path/URL, default model, `has_api_key()`.
- **`discovery/dataset.py`** — load/refresh the dataset; parse to `(name, ats, token)`; filter to the three supported ATSes; dedup; tolerate malformed rows. Pinned to a vendored snapshot (CC-BY-NC 4.0 — attribution recorded in repo). Source dir/URL configurable.
- **`discovery/schemas.py`** — `CompanyReviewResult` (pydantic): `verdict`, `confidence`, `reasoning`, `industry`, `industry_subcategory`, `tech_tags`, `red_flags`. Reuses the `INDUSTRIES`/`SUBCATEGORIES` taxonomy from `reviewer/schemas.py`.
- **`discovery/llm.py`** — `CompanyReviewClient`: single OpenRouter `parse` call; default `deepseek/deepseek-v4-flash` or `profiles.model_company`. `build_company_block(company_instructions)` mirrors `build_profile_block`. Classifies **HTTP 402 → `OutOfCreditsError`**; transient errors (429/5xx) raise normally and are isolated per-company. Prompt instructs: *return `verdict='unknown'` when you have no real knowledge of the company.*
- **`discovery/db.py`** — `upsert_candidates` (source='dataset', active=FALSE), `select_for_review` (unreviewed/stale, non-overridden, `LIMIT BATCH_CAP`), `upsert_company_review`, `reconcile_active` (set `companies.active` from effective verdict), `start_run`/`finish_run`, `read_state`/`set_halted`/`clear_halt`.
- **`discovery/run.py`** — orchestrates ingest → upsert → review batch (asyncio + semaphore) → reconcile → accounting. A shared `asyncio.Event` halt: first `OutOfCreditsError` stops launching new calls, lets in-flight finish, leaves the rest **pending** (not errored), sets run status `halted_no_credits` + `discovery_state.halted_no_credits = TRUE`, records `backlog`.

**Poller integration refactor:**
- `poller/db.sync_companies` becomes seed-only: upsert `targets.json` rows as `discovery_source='seed'`, `active=TRUE`; it **no longer deactivates** non-seed companies (discovery owns `active`).
- `poller/run.py` iterates `db.active_companies(conn)` (`SELECT … WHERE active=TRUE`) instead of `targets.json`.
- First poll of a newly-approved company validates liveness via the existing adapter fetch; a dead board is isolated (existing behavior) and marked `active=FALSE` with a note.

---

## 8. Credit-exhaustion handling (cross-cutting)

- **Detect:** OpenRouter HTTP 402 → `OutOfCreditsError` (distinct from 429/5xx).
- **Stop, don't retry, preserve backlog:** halt the scan on first 402; unreviewed companies stay `pending`; run status `halted_no_credits`; `discovery_state.halted_no_credits = TRUE`; `backlog` count recorded. No backoff/retry on 402.
- **UI banner** (Companies surface + dashboard header) shown when `discovery_state.halted_no_credits` is true:
  > ⚠️ Company scan paused — OpenRouter out of credits. N companies still pending. **[ Refresh ]**
- **Refresh button** (server action `refreshDiscoveryStatus`): queries OpenRouter `GET /api/v1/credits`; if topped up, clears `halted_no_credits`; sets `resume_requested_at`. The backlog drains on the **next discovery run** (cron tick or manual `python -m discovery`) — reusing the existing "select pending" query. (Immediate browser-triggered retry is deferred; would need a trigger endpoint.)

---

## 9. Dashboard UI

Matches the existing Rolefit design language (`components/rolefit/*`, Tailwind, `app/page.tsx`).

- **`app/companies/page.tsx`** — server component; lists companies + the operator's `company_reviews`, bucketed into **Included / Excluded / Unknown** tabs with counts; search/filter by name, industry, source.
- **`components/companies/CompanyList.tsx` + `CompanyCard.tsx`** — name, ATS, verdict badge, confidence, reasoning, `tech_tags` / `red_flags`, source. Include/Exclude override control.
- **`components/companies/CreditBanner.tsx`** — reads `discovery_state`; renders the out-of-credits banner + Refresh.
- **`lib/companiesQuery.ts`** — list-by-verdict + count helpers (mirrors `lib/jobsQuery.ts`).
- **`app/actions/companies.ts`** — `setCompanyOverride(companyId, verdict)` (sets `human_override` + `override_verdict`, reconciles that company's `active`); `refreshDiscoveryStatus()`.
- **Profile modal** (`components/rolefit/ProfileModal.tsx` + `app/actions/profile.ts`) — add a `company_instructions` textarea + `model_company` `ModelPicker`. Saving recomputes `company_profile_version = sha256(company_instructions)` → triggers re-review on the next discovery run.
- **Header** — nav link to Companies; global credit banner when halted.

---

## 10. Error handling & testing

**Isolation:** a single non-402 review failure → `error` field, counted, batch continues (mirrors `reviewer/`). A 402 halts the whole scan (§8). Batch-capped per run so even a full pass is chunked and resumable.

**Tests** (pytest for Python, vitest for dashboard — TDD per repo style):
- dataset parse/filter: ATS filter, dedup, malformed-row tolerance.
- `upsert_candidates`: active=FALSE, correct source.
- `select_for_review`: skips overridden, picks unreviewed + stale, honors `BATCH_CAP`.
- effective-verdict + `reconcile_active`: override beats AI; `unknown` → inactive; `include` → active.
- sticky override preserved across a re-review upsert.
- 402 → `OutOfCreditsError` → halt: status `halted_no_credits`, backlog counted, pending rows **not** errored.
- `CompanyReviewClient` schema parse (mocked OpenRouter), incl. `unknown` path.
- poller refactor: seed sync doesn't deactivate discovered companies; poll loop reads `active=TRUE`.
- dashboard: `companiesQuery` bucketing/counts; `setCompanyOverride` flips active; credit-banner state; `company_instructions` version bump.

Note (per project memory): lib-only tests + `next build` run in a worktree, but the running dashboard needs `dashboard/.env.local` (`NEXT_PUBLIC_SUPABASE_*`) copied from the main checkout for browser/visual checks.

---

## 11. Future / deferred
- **JD enrichment** for unknowns or for tech-stack rules ("uses Java/C/C++"): sample a few JDs at review time → re-ask. Pluggable enrichment step.
- **Embedding-ranked or seed-similar curation** if the brute-force pass ever gets too costly.
- **Multi-user company sets:** `companies.active` = union of includes across operators.
- **Immediate browser-triggered retry** via an authenticated trigger endpoint.
- **AI expansion** ("find companies like my approved set") as a complementary candidate source feeding the same review pipeline.
