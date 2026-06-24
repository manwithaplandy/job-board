# Design — Login + Resume/Instructions + AI Relevance Review

**Owner:** Andrew
**Status:** Approved for planning
**Date:** 2026-06-24
**Supersedes nothing; extends:** [`job-tracker-prd.md`](../../../job-tracker-prd.md)

---

## 1. Summary

Add personalized, AI-driven relevance filtering to the existing remote-job tracker.
The operator uploads a resume and free-form instructions; each open job is run
through a two-stage LLM gate (cheap title reject → full JD-vs-resume evaluation)
that returns an approve/deny verdict plus experience-match, industry, and a short
rationale. Results are stored per user and surfaced as new filters in the
dashboard. Supabase Auth (email/password) gates the dashboard so the resume,
instructions, and verdicts persist to a personal account.

This reverses three explicit V1 PRD non-goals — auth, description-level matching,
and (implicitly) per-user state. It is built **user-scoped** (multi-user-ready)
but **without RLS / tenant-isolation hardening**, because there is exactly one
real user. The PRD's direct-SQL data-access pattern is preserved; the Supabase
client is used only for Auth and resume file Storage.

### Scope

This spec covers **one** sub-project of a larger effort. The full effort decomposes into:

- **B — Login + Resume/Instructions + AI relevance review** ← *this spec*
- **A — Location filtering** — forward stub (§12)
- **C — Automatic company discovery** — forward stub (§12)

A and C each get their own spec → plan → build cycle later.

---

## 2. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Who is this for | One real user (the operator) + login. Single tenant, user-scoped data, **no RLS hardening**. |
| Review execution | **Event-driven, folded into the poller run** (not a separate cron). Triggered by polling; LLM inference runs asynchronously. |
| Review models | Claude **Haiku 4.5** for both stages, each behind an env var (`REVIEW_MODEL_STAGE1` / `REVIEW_MODEL_STAGE2`). |
| Login method | Supabase Auth **email + password**. |
| Resume input | **Both** PDF upload and paste-text. |
| Industry | Two-level taxonomy (`industry` + `industry_subcategory`), tech/SWE/DevOps-focused (§Appendix A). |
| Experience match | `step_down` / `match` / `reach` / `far_reach`. |
| Data access | Direct SQL for all app data (scoped by `user_id`); Supabase client only for Auth + Storage. |

---

## 3. Architecture

Two deployables (poller, dashboard) sharing one Supabase Postgres. **No new
service** — review runs inside the existing poller.

```
Railway cron: poller  ──(0 */2 * * *)──────────────┐
  1. poll + upsert jobs   (sync, existing)          │ writes
  2. review phase         (async LLM inference) ─────┤  reads (direct SQL,
       Anthropic API ◀────────────────────────┐     │         scoped by user_id)
                                               │     ▼
                                        ┌──────────────────┐
                                        │ Supabase         │   Vercel: Next.js dashboard
                                        │  Postgres        │     - email/password login
                                        │  + Auth          │◀──  - Profile page
                                        │  + Storage       │     - Jobs table + verdict filters
                                        └──────────────────┘
```

The review code lives in its own `reviewer/` module for isolation and
testability, but executes **in the poller process**. A standalone entry
(`python -m reviewer`) runs only the review phase — for manual re-review after a
profile edit, and for testing.

**Tradeoff (accepted):** folding review into the poller couples the poller to the
Anthropic API; a review-phase failure shares the poller's run. This is contained
by **per-job isolation** — an error on one job records `error` on that job's
review row and the run continues — mirroring the existing per-company isolation
(`FR-4`).

---

## 4. Data model

Schema additions (new migration alongside `schema.sql`). `auth.users` is managed
by Supabase.

```sql
-- one row per user (the operator)
CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id),
  resume_text      TEXT,                 -- what the LLM reads
  resume_file_path TEXT,                 -- Supabase Storage path (nullable)
  instructions     TEXT,                 -- free-form focus/avoid guidance
  profile_version  TEXT NOT NULL,        -- sha256(resume_text || '\0' || instructions)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one current verdict per (user, job); re-review upserts in place
CREATE TABLE job_reviews (
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  job_id             TEXT NOT NULL REFERENCES jobs(id),
  profile_version    TEXT NOT NULL,      -- profile this verdict was computed against
  stage1_decision    TEXT NOT NULL CHECK (stage1_decision IN ('pass','reject')),
  stage1_reason      TEXT,
  verdict            TEXT CHECK (verdict IN ('approve','deny')),          -- NULL if gate-rejected
  experience_match   TEXT CHECK (experience_match IN
                       ('step_down','match','reach','far_reach')),        -- NULL if gate-rejected
  industry           TEXT,              -- top-level enum (Appendix A); NULL if gate-rejected
  industry_subcategory TEXT,            -- sub enum (Appendix A); NULL if gate-rejected
  confidence         TEXT CHECK (confidence IN ('low','medium','high')),  -- NULL if gate-rejected
  reasoning          TEXT,
  model_stage1       TEXT,
  model_stage2       TEXT,
  error              TEXT,              -- set if the review failed (per-job isolation)
  reviewed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);

-- accounting, mirrors poll_runs (powers the dashboard health header)
CREATE TABLE review_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  reviewed      INT,   -- jobs that ran Stage 1
  gate_rejected INT,   -- rejected at Stage 1
  approved      INT,
  denied        INT,
  errors        INT,
  notes         TEXT
);

ALTER TABLE jobs ADD COLUMN description TEXT;  -- cached full JD text, fetched lazily
```

`profile_version` is the invalidation key: editing the resume or instructions
changes the hash, marking every verdict stale and causing recomputation on the
next review pass.

---

## 5. Two-stage review

Both stages use **Anthropic structured outputs** (`output_config.format` /
`messages.parse()`) so the JSON is schema-validated, and the **async** client
(`AsyncAnthropic`). Both model IDs are env vars defaulting to `claude-haiku-4-5`.

### Stage 1 — title gate (cheap reject)

- **Model:** `REVIEW_MODEL_STAGE1` (default `claude-haiku-4-5`).
- **System:** resume text + instructions + role as a relevance gatekeeper that
  rejects only obvious non-fits by title.
- **User:** job title + company name + location.
- **Output schema:**
  ```json
  { "decision": "pass" | "reject", "reason": "string" }
  ```
- A reject writes the review row (verdict and all Stage-2 fields NULL) and skips
  Stage 2 and the JD fetch. Example: a software-dev resume rejects "Social Media
  Manager" / "Forklift Operator" here.

### Stage 2 — full evaluation (only for Stage-1 passes)

- **Model:** `REVIEW_MODEL_STAGE2` (default `claude-haiku-4-5`).
- **System:** resume text + instructions + rubric (defines `verdict`,
  `experience_match`, `industry`/`industry_subcategory`, `confidence`).
- **User:** title + company + location + **full JD text**.
- **Output schema:**
  ```json
  {
    "verdict": "approve" | "deny",
    "experience_match": "step_down" | "match" | "reach" | "far_reach",
    "industry": "<top-level enum, Appendix A>",
    "industry_subcategory": "<sub enum, Appendix A>",
    "confidence": "low" | "medium" | "high",
    "reasoning": "1–3 sentences"
  }
  ```
- `industry` and `industry_subcategory` are flat enums; the model fills a
  consistent pair.

### JD sourcing

Stage 2 needs the description, which the poller does not store today. The review
phase obtains it lazily, **only for Stage-1 passes**, and caches it on
`jobs.description`:

- **Lever** — `descriptionPlain` is already present in the stored `raw` JSONB →
  extract from there (no extra HTTP call).
- **Ashby** — extract from `raw` if the job-board payload carries description
  text; otherwise fall back to a detail fetch (verify the exact payload shape at
  plan time).
- **Greenhouse** — list endpoint omits it → fetch the detail endpoint
  (`/v1/boards/{token}/jobs/{id}`) once via `httpx.AsyncClient`, strip HTML to
  text, cache it.

Encapsulated per adapter: `fetch_description(token, external_id, raw) -> str | None`
(prefers `raw`, falls back to a detail fetch, strips HTML). This single abstraction
keeps the design correct regardless of which ATS happens to include description text
inline.

### Cost controls

1. **Stage-1 gating** — the primary saver; avoids Stage 2 + JD fetch for obvious rejects.
2. **Prompt caching** of the resume/instructions prefix — helps only when the
   prefix exceeds Haiku's 4096-token cache minimum. A short resume will not cache;
   Haiku input is cheap ($1/1M) so the impact is negligible either way. Place
   `cache_control` on the resume/instructions system block.
3. **`REVIEW_MAX_JOBS_PER_RUN`** caps jobs reviewed per run; overflow rolls to the
   next run and is logged (no silent truncation).
4. **Batches API** (50% off, fine for a background worker) is a documented future
   optimization, not in V1.

---

## 6. Review phase (poller-integrated)

`reviewer/` module invoked at the end of the poller's `run()`. Also runnable as
`python -m reviewer` (review phase only).

```
1. poll + upsert all companies          (existing, synchronous)          → commit
2. for each user with a profile (just the operator in V1):
     load profile (resume_text, instructions, profile_version)            [sync DB]
     candidates = open jobs (closed_at IS NULL) whose job_reviews row
                  is missing OR has profile_version ≠ current             [sync DB read]
     results = asyncio.run(review_batch(candidates, profile)):            [ASYNC]
         • bounded concurrency via semaphore (REVIEW_CONCURRENCY, default 5)
         • capped at REVIEW_MAX_JOBS_PER_RUN
         • per job: Stage 1 → (JD fetch if pass) → Stage 2
         • per-job isolation: exception → result carries error, batch continues
     upsert job_reviews rows from results                                 [sync DB write]
3. write review_runs accounting row; close DB; exit
```

DB reads/writes stay synchronous (psycopg) on either side of the async batch; only
the API calls and Greenhouse JD fetches are async. Candidate job data needed by
tasks (title, company, location, ats, token, external_id, `raw`) is read into
memory before the async batch so tasks do not touch the DB.

### Re-review / invalidation

Because the poller sees every open job each run, candidate selection
(missing-or-stale verdict) covers all cases with one mechanism:

- **New job** — no review row → reviewed on the poll that first sees it.
- **Profile edit** — `profile_version` changes → all verdicts stale → recomputed
  next run. The standalone `python -m reviewer` triggers this immediately without
  waiting for the next poll.
- **Prior error** — error rows are re-selected and retried next run.

Jobs that already have a fresh verdict (matching `profile_version`) are **not**
re-reviewed, bounding cost. One profile edit costs one full re-review pass
(Stage-1 gated).

---

## 7. Auth, Profile & dashboard

- **Auth:** Supabase email/password via `@supabase/ssr` (cookie sessions).
  Middleware redirects unauthenticated requests to a login page. Single account
  created once; no public sign-up UI.
- **Profile page** (new, authenticated): upload resume PDF and/or paste text;
  instructions textarea; save.
  - PDF upload → stored in a **private** Supabase Storage bucket
    (`resumes/{user_id}/`) and text-extracted **server-side in Next.js** to
    populate `resume_text`. Paste-text writes `resume_text` directly (and is the
    robust fallback if extraction is poor).
  - Save recomputes `profile_version`.
- **Jobs table:** existing filters (company / title include-exclude / remote /
  status) stay. The query gains a `LEFT JOIN job_reviews` scoped by session
  `user_id`, plus filters for **verdict** (`approve` / `deny` / `pending` /
  `gate_rejected`), **experience_match**, **industry**, and **industry_subcategory**.
  Default view shows **approved** jobs. Each row surfaces verdict, experience
  match, industry/subcategory, and reasoning (expand/hover).
- **Header:** add review-run health (last `review_runs`: approved / denied /
  errors) next to existing poll health.

Reads remain **direct SQL scoped by the authenticated `user_id`**; no RLS. The
session `user_id` is read from the Supabase session server-side and passed into
the query layer.

---

## 8. Testing

Follows existing pytest + vitest patterns.

- **Reviewer (pytest):**
  - Stage 1 / Stage 2 prompt construction and structured-output parsing with a
    **mocked Anthropic client** (no live API calls); a thin injectable client
    wrapper makes the LLM mockable.
  - `profile_version` hashing.
  - Candidate-selection SQL (missing-or-stale verdict, open jobs only).
  - JD extraction from `raw` + HTML stripping; per-adapter `fetch_description`
    (Lever/Ashby from `raw`, Greenhouse detail fetch).
  - Per-job isolation (one job's error does not abort the batch).
  - DB integration tests gated on `TEST_DATABASE_URL`, like the poller.
- **Dashboard (vitest):**
  - Extended `buildJobsQuery` (verdict / experience / industry / subcategory
    filters + the reviews join).
  - Filter parsing for the new dimensions.
  - Auth-gating helpers where feasible.

No test makes a real Anthropic API call.

---

## 9. Deployment & config

- **No new service.** The existing **poller** Railway cron now also runs the review
  phase; its watch patterns extend to include `reviewer/**`.
- **New env (poller):** `ANTHROPIC_API_KEY`, `REVIEW_MODEL_STAGE1`,
  `REVIEW_MODEL_STAGE2`, `REVIEW_CONCURRENCY`, `REVIEW_MAX_JOBS_PER_RUN`.
- **New env (dashboard):** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Supabase:** enable email/password Auth; create a private `resumes` Storage
  bucket; apply the §4 migration.
- New Python dependency for the poller: `anthropic` (and the async extra if
  needed). New dashboard dependencies: `@supabase/ssr` / `@supabase/supabase-js`
  and a JS PDF text-extraction library.

---

## 10. Out of scope (V1 of this sub-project)

- Multi-user sign-up, RLS, tenant isolation hardening.
- Notifications on approval (email/Slack) — fits naturally as a later add.
- Batches API cost optimization.
- Re-review UI button (invalidation is automatic via `profile_version`; the
  standalone runner covers manual triggering).

---

## 11. Cost note

Per poll, only jobs with a missing/stale verdict are reviewed; Stage 1 gates the
expensive Stage 2 + JD fetch. With Haiku at $1/$5 per 1M tokens and a small
tracked-company set, steady-state cost (mostly new jobs per run) is negligible;
the largest single cost is a full re-review after a profile edit, still
Stage-1-gated and capped by `REVIEW_MAX_JOBS_PER_RUN`.

---

## 12. Forward stubs (separate specs later)

- **A — Location filtering.** The poller already captures `jobs.location`.
  Normalize it into a queryable form and add a location filter to the dashboard.
  No auth dependency; smallest sub-project; can ship independently.
- **C — Automatic company discovery.** Expand the tracked-company set without
  hand-editing `targets.json`. Discovery source is the open question (e.g. curated
  seed lists, ATS token probing, aggregator crawl). Poller-side; loosely coupled.

---

## Appendix A — Industry taxonomy

`industry` (top-level) and `industry_subcategory` are both stored on
`job_reviews` and both filterable. Richest under software/SWE/DevOps.

| `industry` | `industry_subcategory` |
|---|---|
| `software_internet` | `devtools_platforms`, `cloud_infrastructure`, `cybersecurity`, `data_ml_ai`, `devops_observability_sre`, `saas_productivity`, `consumer_social_media`, `ecommerce_marketplace_tech`, `gaming` |
| `fintech_finance` | `fintech_payments_crypto`, `banking_trading_inhouse`, `insurance_insurtech` |
| `healthcare_life_sciences` | `health_tech_digital_health` *(product)*, `provider_hospital_inhouse` *(in-house IT)*, `biotech_pharma_software`, `medical_devices` |
| `commerce_consumer` | `retail_ecommerce_inhouse`, `logistics_supply_chain`, `travel_hospitality` |
| `industrial_hardware` | `manufacturing_industrial_software`, `iot_embedded_robotics`, `automotive_aerospace_defense`, `energy_climate_cleantech` |
| `public_education` | `government_govtech`, `education_edtech`, `nonprofit_ngo` |
| `services_other` | `consulting_agency_staffing`, `telecom_networking`, `other_unclear` |

Example: "developing a HealthTech app" → `healthcare_life_sciences /
health_tech_digital_health`; "in-house software for a hospital system" →
`healthcare_life_sciences / provider_hospital_inhouse`.
