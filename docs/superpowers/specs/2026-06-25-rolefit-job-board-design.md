# Design — Rolefit Job Board

**Owner:** Andrew
**Status:** Approved for planning
**Date:** 2026-06-25
**Extends:** [`2026-06-25-openrouter-model-selection-design.md`](2026-06-25-openrouter-model-selection-design.md)
**Source design:** Claude Design project `Job board` → `Rolefit Job Board.dc.html`

---

## 1. Summary

Replace the current table dashboard with **Rolefit**, a polished split-pane job
board (left: ranked role list; right: rich role detail with an AI review, a fit
ring, and a tailored-résumé generator). To populate the design's richer panels,
the **AI review pipeline is extended** so Stage 2 extracts the missing data, and a
**deterministic scorer** derives the headline 0–100 fit from the extracted
attributes. The résumé generator becomes a **real OpenRouter-backed feature**.

Scope spans three areas:

1. **Reviewer (Python):** Stage 2 extracts pay, category, seniority, work
   arrangement, headcount, "about", benefits, requirements, red flags, skill gaps,
   and three component sub-scores. A new `reviewer/scoring.py` computes the overall
   fit. New fields persist in `job_reviews`.
2. **Database:** an additive migration adds the new `job_reviews` columns and a
   `profiles.model_resume` column; `schema.sql` mirrors them.
3. **Dashboard (Next.js):** a full rewrite of `/` into the Rolefit split-pane,
   wired to real jobs + reviews, plus a real `POST /api/resume` route and a profile
   modal.

The board stays **public read-only** (anonymous visitors see jobs + the operator's
reviews, exactly like today's `showMatch` guard). **Résumé generation and profile
editing are operator-only** (require auth).

---

## 2. Decisions (from brainstorming)

- **Replace the main board.** Rolefit becomes `/`. The old table UI
  (`JobsTable`, the table `FilterBar`/`Header`, and their tests) is removed.
  Operator-only signals (run health, unreviewed count) fold into the new header.
- **Hybrid data sourcing.** Hard facts (pay, headcount) are **honest-null** when
  not explicitly in the JD — never fabricated; the UI hides them or labels them
  "Not disclosed".
  Soft prose (about, category, seniority, work arrangement) the LLM **may infer**
  from the JD + company name.
- **Résumé model = new profile setting.** Add a third model picker
  (`model_resume`) alongside stage1/stage2. Default `anthropic/claude-haiku-4.5`.
- **Overall fit = deterministic scoring system** (§4.2), not an LLM free-pick.
- **`verdict`, `experience_match`, `confidence`, `industry`/`subcategory` keep
  their current meaning and filter semantics.** Fit is layered on top.

---

## 3. Architecture

```
poller run
  └─ reviewer.run.review_all
       └─ per candidate: Stage 1 gate → Stage 2 extract (richer schema)
                                          └─ reviewer.scoring.compute_fit(...)
                                               └─ job_reviews upsert (new columns)

Next.js  /  (server component)
  ├─ getJobs(filters, ownerId)   → JobRow[] incl. new review columns
  └─ <RolefitBoard jobs ... isOperator>   (client)
        ├─ FilterBar / JobList / JobCard / JobDetail / ProfileModal
        └─ Generate résumé → POST /api/resume {jobId}
                                └─ server: profile + jd → OpenRouter (model_resume)
                                     → structured résumé JSON → client jsPDF download
```

**Boundaries / responsibilities**

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `reviewer/scoring.py` | Pure: attributes → fit (0–100) | nothing (stdlib) |
| `reviewer/schemas.py` | `Stage2Result` shape (validation) | pydantic |
| `reviewer/run.py` | orchestrate stages, call scorer, build row | schemas, scoring, db |
| `reviewer/db.py` | column list + upsert SQL (JSONB-aware) | psycopg |
| `lib/rolefit/fit.ts` | pure fit color (oklch) + formatting | none |
| `lib/rolefit/filter.ts` | pure client filter/sort/search + facet counts | types |
| `lib/rolefit/resumeSchema.ts` | shared résumé shape + prompt builder | none |
| `components/rolefit/*` | presentational + local UI state | lib/rolefit |
| `app/api/resume/route.ts` | auth, load data, OpenRouter call | queries, openrouter |

---

## 4. Data model

### 4.1 New `job_reviews` columns

Scalars (with CHECK constraints on enums where listed):

| Column | Type | Source | Notes |
|--------|------|--------|-------|
| `role_category` | TEXT | soft | enum (see below) |
| `seniority` | TEXT | soft | enum: `junior,mid,senior,staff,principal,lead,manager,unknown` |
| `work_arrangement` | TEXT | soft | enum: `remote,hybrid,onsite,unknown` |
| `about` | TEXT | soft | 1–2 sentences |
| `pay_min` | INT | hard | null unless in JD |
| `pay_max` | INT | hard | null unless in JD |
| `pay_currency` | TEXT | hard | e.g. `USD`; null unless pay present |
| `pay_period` | TEXT | hard | enum: `year,hour,month`; null unless pay present |
| `headcount` | TEXT | hard | e.g. `"1,400"`; null unless in JD |
| `skills_score` | INT | LLM | 0–100 |
| `experience_score` | INT | LLM | 0–100 |
| `comp_score` | INT | LLM | 0–100 |
| `fit_score` | INT | **computed** | 0–100 (scorer) |

JSONB columns: `red_flags` (list[str]), `skill_gaps` (list[str]), `benefits`
(list[str]), `requirements` (list of `{text: str, met: bool}`). Default `'[]'::jsonb`.

`reasoning` is repurposed as the 2–4 sentence **fit summary** (no schema change;
prompt-only change).

`role_category` enum: `Frontend, Backend, Full-stack, Platform, Infra/DevOps,
Data/ML, Mobile, Security, Product eng, QA/Test, Eng management, Other`. Stored
verbatim (display strings). Kept as a Python/TS shared constant list; documented as
manually synced (same convention as the taxonomy lists in `reviewer/schemas.py` ↔
`dashboard/lib/config.ts`).

These are distinct from the existing `industry`/`industry_subcategory` vertical
taxonomy, which is retained (the Rolefit "Category" filter uses `role_category`).

### 4.2 Scoring rubric (`reviewer/scoring.py`)

Named module-level constants:

```python
WEIGHTS = {"skills": 0.45, "experience": 0.30, "comp": 0.25}
EXPERIENCE_BONUS = {"match": 4, "step_down": 2, "reach": -3, "far_reach": -8}
CONFIDENCE_BONUS = {"high": 3, "medium": 0, "low": -5}
RED_FLAG_PENALTY = 3           # per flag
RED_FLAG_PENALTY_CAP = 9
DENY_CAP = 58                  # a denied role never shows green
```

```
base = 0.45·skills_score + 0.30·experience_score + 0.25·comp_score
fit  = base
     + EXPERIENCE_BONUS[experience_match]
     + CONFIDENCE_BONUS[confidence]
     − min(RED_FLAG_PENALTY_CAP, RED_FLAG_PENALTY × len(red_flags))
fit  = round(clamp(fit, 0, 100))
if verdict == "deny":  fit = min(fit, DENY_CAP)
```

`compute_fit(...)` is pure and total: it tolerates `None`/unknown enum keys
(treated as 0 bonus) and missing sub-scores (treated as 0) so a partial Stage-2
result still scores deterministically. Requirements-met ratio is **display only**,
not scored (avoids double-counting with `skills_score`).

The dashboard fit **color** is a separate concern: `lib/rolefit/fit.ts` ports the
design's oklch ramp verbatim (`fitColor(fit)` → `{strong, textOn, tint, ...}`,
remapping the 48–96 realistic range across red→yellow→green).

### 4.3 `profiles` column

`model_resume TEXT` — OpenRouter model id for résumé generation; NULL = default
(`anthropic/claude-haiku-4.5`). Excluded from `profile_version` (model choice must
not invalidate verdicts — same rule as stage1/stage2).

### 4.4 Backfill

`reviewer/db.select_candidates` adds `r.fit_score IS NULL` to its re-review
predicate:

```sql
WHERE j.closed_at IS NULL
  AND (r.job_id IS NULL OR r.profile_version <> %(pv)s OR r.fit_score IS NULL)
```

So existing reviews (same profile_version, pre-migration) are picked up and
repopulated on the next reviewer run, subject to the existing `MAX_JOBS_PER_RUN`
cap and overflow note. No separate backfill script.

---

## 5. Reviewer changes (Python)

### 5.1 `reviewer/schemas.py`
Extend `Stage2Result` with the §4.1 LLM fields. Add `ROLE_CATEGORIES`,
`SENIORITY`, `WORK_ARRANGEMENT` literal lists and a `Requirement` model
(`text: str`, `met: bool`). Sub-scores typed `int` (prompt constrains 0–100;
scorer clamps defensively).

### 5.2 `reviewer/scoring.py` (new)
`compute_fit(*, skills_score, experience_score, comp_score, experience_match,
confidence, red_flags, verdict) -> int`, plus the constants in §4.2. Pure, no I/O.

### 5.3 `reviewer/llm.py`
Rewrite `_STAGE2_INSTRUCTIONS` to request the new fields, stating the
**hard-fact-null vs soft-infer** rule explicitly and the `role_category` /
`seniority` / `work_arrangement` enums. Bump Stage-2 `max_tokens` 4096 → 6000.

### 5.4 `reviewer/run.py`
`ReviewResult` gains the new fields. `review_one` copies them off `s2` and calls
`scoring.compute_fit(...)` to set `fit_score`. `as_row` already derives from
`db._REVIEW_COLUMNS`, so it picks up new columns once that tuple grows; JSONB
fields are wrapped (see §5.5).

### 5.5 `reviewer/db.py`
Extend `_REVIEW_COLUMNS` with the new columns (the upsert SQL is generated from
it). JSONB columns (`red_flags`, `skill_gaps`, `benefits`, `requirements`) bound
via `psycopg.types.json.Json(...)` in `upsert_review` (wrap just those keys before
execute). Add `fit_score IS NULL` to `select_candidates`.

---

## 6. Database migration

`migrations/2026-06-25-rolefit-fields.sql` (additive, `IF NOT EXISTS` /
`ADD COLUMN`), mirrored into `schema.sql`:

- `ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS ...` for each §4.1 column,
  with CHECK constraints for the enum scalars and `DEFAULT '[]'::jsonb` for the
  four JSONB columns.
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_resume TEXT;`

No data migration; backfill is via re-review (§4.4).

---

## 7. Dashboard changes (Next.js / TS)

### 7.1 Types & query
- `lib/types.ts` `JobRow` gains the new review columns (typed nullable; present
  only when an owner's reviews are joined — same caveat as existing review fields).
- `lib/jobsQuery.ts` adds the new columns to `selectCols` under the `hasReviews`
  branch. Server-side filtering stays minimal (status/company/keywords/remote);
  the Rolefit category/pay/match/location/sort/search filtering happens
  **client-side** over the returned set (≤500 rows), matching the design's
  instant-filter UX.

### 7.2 Server page — `app/page.tsx`
Fetch jobs + companies + run/review telemetry (as today), compute `isOperator =
!!ownerId` and `isAuthed = !!viewerId`, render `<RolefitBoard ...>`. `export const
dynamic = "force-dynamic"` retained. Hanken Grotesk via `next/font/google` in
`app/layout.tsx`; `globals.css` updated to the design's base (bg `#f4f6fa`, scroll
styling).

### 7.3 Client components — `components/rolefit/`
- `RolefitBoard.tsx` — top-level client component; owns selection/filter/menu/
  search/sort/profile-modal state (ported from the design's `Component` state).
- `Header.tsx`, `FilterBar.tsx`, `JobList.tsx`, `JobCard.tsx`, `JobDetail.tsx`,
  `ProfileModal.tsx`, `ResumePanel.tsx` — presentational, props-driven.
- Detail panels render real data; **honest-null handling**: pay chip / headcount
  chip / benefits / red flags / skill gaps / requirements hide when empty;
  sub-score bars + fit ring show whenever a review exists. For anonymous visitors
  with no operator review on a job, the detail shows the role facts and a muted
  "Not yet reviewed" state.

### 7.4 Pure helpers — `lib/rolefit/`
- `fit.ts` — `fitColor`, `initialsOf`, `fmtPay`, `fmtPosted`, `formatRange`.
- `filter.ts` — `applyFilters(jobs, state)`, `sortJobs`, `facetCounts`.
- `resumeSchema.ts` — résumé TS type + JSON schema + `buildResumePrompt`.

### 7.5 Removed
`components/JobsTable.tsx`, `components/FilterBar.tsx`, `components/Header.tsx`,
`components/RefreshButton.tsx`, and their tests. The manual refresh button is
dropped — the page is `force-dynamic`, so every load is fresh. `lib/filters.ts` is
retained unchanged (the server query still parses status/company/keywords/remote);
no slimming in this work.

---

## 8. Résumé generation (real)

### 8.1 `app/api/resume/route.ts` (POST)
- Auth required (`requireUserId`); 401 for anonymous.
- Body `{ jobId }`. Load the user's profile (`resume_text`, `model_resume`) and the
  job (`title`, `company_name`, `description`).
- Call OpenRouter chat completions (server `fetch`, OpenAI-compatible, key
  `OPENROUTER_API_KEY`) with `response_format` JSON schema =
  `lib/rolefit/resumeSchema.ts`. Model = `model_resume ?? DEFAULT_RESUME_MODEL`.
- Return the validated résumé JSON `{name, headline, summary, skills[],
  experience[{role, company, dates, bullets[]}], education}`.
- Errors: missing profile → 422 ("set up your profile first"); OpenRouter failure
  → 502 with a short message. No silent fallback.

### 8.2 Client (`ResumePanel.tsx`)
Idle → "Generate résumé" (or "Sign in to tailor a résumé" when anonymous). Busy →
spinner. Done → preview card (name/summary/skills) + **Download PDF** (jsPDF,
dynamically imported, design's layout ported), **Copy text**, **Regenerate**.
State keyed per job id (design parity). `jspdf` added as a dashboard dependency
(replaces the design's CDN script).

---

## 9. Profile handling

- `ProfileModal.tsx` (paste text / upload PDF tabs) wired to a real
  `POST /api/profile` (or server action) that upserts `resume_text` /
  `resume_file_path` via the existing `extractPdfText` + Supabase storage path.
  Requires auth.
- `/profile` page retained for advanced settings; gains the `model_resume`
  picker (third `ModelPicker`) and remains the home for instructions + stage
  models. The modal links to it ("Advanced settings →").
- `saveProfile` action + `upsertProfile` extend to accept `modelResume`
  (validated against the catalog like stage1/stage2).

---

## 10. Error handling

- **Reviewer:** per-job isolation unchanged; a Stage-2 parse/scoring failure sets
  `error` and the row persists with nulls (board renders it as "not reviewed").
  `compute_fit` never throws on partial input.
- **Honest-null UI:** no fabricated chips; absent hard facts are hidden or labelled
  "Not disclosed".
- **Résumé route:** explicit 401/422/502, surfaced inline in the panel; never a
  fake/empty résumé.
- **JSONB binding:** wrapped via `Json(...)`; reads come back as Python lists /
  parsed JS objects (postgres.js returns `jsonb` as parsed values).

---

## 11. Testing

**Python (pytest):**
- `scoring.py`: table-driven cases — weighting math, each bonus map, red-flag cap,
  deny-cap, clamping, partial/None inputs.
- `Stage2Result` parses a full rich payload; enums reject bad values.
- `db._REVIEW_COLUMNS` ↔ `ReviewResult` field parity; upsert SQL includes new
  columns; JSONB wrapping.
- `select_candidates` re-selects when `fit_score IS NULL` (DB integration test,
  guarded by `TEST_DATABASE_URL`).

**TypeScript (vitest):**
- `fit.ts`: `fitColor` boundaries (48/72/96), formatting helpers.
- `filter.ts`: filter/sort/search + facet counts.
- `resumeSchema.ts`: prompt builder + schema shape.
- Remove obsolete table-component tests; keep `lib` smoke/query tests green.

**Manual:** browser smoke of the board (list, select, filter, sort, profile modal,
résumé generate + PDF) after wiring.

---

## 12. Out of scope

- Re-review/force-refresh UI button (backfill is automatic via §4.4).
- Multi-tenant résumés / per-visitor profiles (single-operator model retained).
- Persisting generated résumés server-side (generated on demand).
- Pay normalization across currencies/periods (stored as stated; UI formats).
- Real company headcount enrichment beyond what the JD states.

---

## 13. Verified facts (at design time)

- `job_reviews` PK `(user_id, job_id)`; upsert SQL is generated from
  `reviewer/db._REVIEW_COLUMNS`; `ReviewResult.as_row` derives from the same tuple.
- `reviewer/run.review_one` runs Stage 1 → (on pass) Stage 2; writes
  `jobs.description` from the extracted JD.
- `select_candidates` currently re-reviews on `r.job_id IS NULL OR
  r.profile_version <> pv`.
- Dashboard board is public; review columns are joined/selected only when a board
  owner exists (`getBoardOwnerId`), gated in UI by `showMatch`/`isOperator`.
- `lib/openrouter.ts` provides the model catalog + `validateModelId`; default
  review model `deepseek/deepseek-v4-flash`.
- The design file is a self-contained prototype (`x-dc`/`DCLogic` framework, mock
  data, client jsPDF); we port its visuals + helper logic, not its framework.
