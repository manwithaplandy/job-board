# Golden-dataset correction framework for reviewer evals

- **Date:** 2026-06-30
- **Status:** Approved design — ready for implementation plan
- **Area:** `reviewer/` (Python eval pipeline), `dashboard/` (Next.js), Postgres, LangFuse

## Problem

The reviewer runs a two-stage LLM pass over each job and writes a structured
evaluation (`Stage2Result`: verdict, experience_match, industry, sub-scores,
etc.) to `job_reviews`. We want to measurably improve that model's accuracy, but
we have no ground truth to measure against.

The existing eval scaffold (`reviewer/experiments.py`) is circular: it seeds a
LangFuse dataset using the model's **own** verdict as `expected_output`, so an
experiment can only measure whether a model reproduces the prior model's output —
not whether it is *correct*. The only field a human can currently change is the
verdict, via `rejectJob`, which **overwrites** the model output in `job_reviews`
(losing the original for comparison).

## Goal

Give the operator an interface to **correct** the model's evaluation of a job,
store the correction so the model-vs-human diff is preserved, and sync it to a
LangFuse **golden dataset** so experiments can score the current pipeline against
human ground truth — driving prompt/model improvements.

## Non-goals

- Scoring free-text quality (reasoning prose) — that needs LLM-as-judge and is
  deferred. Free-text fields are editable and stored, but are not hard metrics.
- A dedicated batch "curation queue" page — the inline edit flow is the MVP.
- Multi-operator/labeler workflows — this is a single-operator tool (`isAuthed`).
- Changing the reviewer pipeline's stage-1/stage-2 logic. Corrections are an
  **overlay**; the pipeline is untouched.

## Approach decisions

These were settled during brainstorming:

1. **Golden lives in a new `review_corrections` table**, not by overwriting
   `job_reviews`. Both the model output and the human correction are preserved
   and diffable.
2. **Inline edit mode** in `JobDetail`, toggled by a **"Correct job details"**
   button that turns the review panel's fields into form controls.
3. **Push-on-save**: the save server action writes Postgres *and* upserts a
   LangFuse dataset item, so the golden dataset is always live. We add the
   **`@langfuse/client`** JS SDK (companion to the already-installed
   `@langfuse/otel`/`@langfuse/tracing` v5 packages) rather than adding a heavy
   classic client or hand-rolling REST — avoids compatibility drift.
4. **Full board coalesce now**: when a correction exists, the board list *and*
   the detail view display the corrected values (not just the detail view).
5. **Scored golden subset** = verdict + categoricals + sub-scores. Free-text is
   editable but unscored.

## Field taxonomy

| Group | Fields | In golden `expected_output`? | Evaluator |
|-------|--------|------------------------------|-----------|
| Headline | `verdict` (approve\|deny) | yes | exact match (headline metric) |
| Categoricals | `experience_match`, `industry`, `industry_subcategory`, `role_category`, `seniority`, `work_arrangement` | yes | per-field exact match |
| Soft categorical | `confidence` (low\|med\|high) | yes | per-field exact match (secondary) |
| Sub-scores | `skills_score`, `experience_score`, `comp_score` (0–100) | yes | within-tolerance pass + abs-error |
| Derived | `fit_score` | **no** (recomputed from sub-scores) | — |
| Free-text / lists | `reasoning`, `red_flags`, `skill_gaps`, `requirements`, `benefits`, `about`, `pay_*`, `headcount` | stored + dataset metadata, not scored | none (future: LLM-judge) |

`fit_score` is deterministic from the sub-scores (`reviewer/scoring.py::compute_fit`),
so it is never a golden field — it is recomputed whenever sub-scores change.

## Architecture & data flow

```
Operator ── "Correct job details" ──▶ JobDetail edit mode (ReviewPanel)
                                            │ Save
                                            ▼
                         saveReviewCorrection(jobId, corrected)  [server action]
                            1. SELECT model output + review inputs  (job_reviews, jobs, companies, profiles)
                            2. recompute fit from corrected sub-scores (computeFit, TS)
                            3. UPSERT review_corrections  (model_snapshot, corrected fields, fit, note)
                            4. upsert LangFuse dataset item  (@langfuse/client, id = userId:jobId)   ← best-effort
                            5. revalidatePath("/")
                                            │
        Board list + detail COALESCE(rc.field, r.field) ◀── review_corrections overlay
                                            │
   (later, terminal)  python -m reviewer.experiments run <model>
                            replays current pipeline over the golden dataset,
                            scores each field vs. corrected ground truth
                                            ▼
                         LangFuse experiment run (per-field scores, comparable across models/prompts)
```

The DB is the source of truth; LangFuse is kept live on save and reconcilable via
a Python backfill (`sync_golden_dataset`) if a live push ever fails.

## Component 1 — Data model

### New table `review_corrections` (migration `migrations/2026-06-30-review-corrections.sql`, mirrored into `schema.sql`)

Keyed `(user_id, job_id)`, one correction per job per operator. Mirrors the
correctable `job_reviews` columns as typed columns so the board can coalesce and
the golden payload is a straight column read.

```sql
CREATE TABLE review_corrections (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  -- corrected golden fields (mirror job_reviews; nullable = "not corrected / N/A")
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown')),
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,               -- recomputed from corrected sub-scores at save time
  -- editable-but-unscored fields
  reasoning            TEXT,
  about                TEXT,
  pay_min              INT,
  pay_max              INT,
  pay_currency         TEXT,
  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
  headcount            TEXT,
  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- provenance
  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- job_reviews values at correction time
  note                 TEXT,                                -- optional operator rationale
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_review_corrections_user ON review_corrections (user_id);
```

`model_snapshot` captures the model's `job_reviews` row at the moment of
correction, so "what did I change" and disagreement-rate analytics are computable
even after a later re-review mutates `job_reviews`.

RLS: follow the existing `2026-06-26-rls-deny-all-policies.sql` convention (deny-all;
access is via the service role used by the dashboard/pipeline).

## Component 2 — Reviewer / Python

**`reviewer/db.py`**
- `golden_corrections(conn) -> list[dict]`: `review_corrections` joined to
  `jobs` + `companies` + `profiles` to assemble each dataset item's `input`
  (title, company_name, location, ats, description, resume_text, instructions)
  and `expected_output` (the corrected golden fields). Mirrors the query style of
  `recent_stage2_reviews`.

**`reviewer/experiments.py`**
- Replace circular `seed_dataset_from_reviews` with
  `sync_golden_dataset(conn, name) -> int`: pushes every `review_corrections`
  row as a dataset item (id = `f"{user_id}:{job_id}"`, `expected_output` = the
  corrected golden fields). This is the reconcile/backfill path and produces the
  **same** dataset items the dashboard writes live.
- Extend evaluators (each returns a `langfuse.experiment.Evaluation`):
  - `verdict_match` (keep) — headline.
  - `categorical_match(field)` for experience_match, industry,
    industry_subcategory, role_category, seniority, work_arrangement, confidence
    — exact match → 1.0/0.0, named `match_<field>`.
  - `score_within(field, tol=10)` for the three sub-scores — `|expected-actual|
    <= tol` → 1.0/0.0, named `close_<field>`; plus `abs_err_<field>` numeric.
  - `field_accuracy` — mean of the categorical matches (convenience aggregate).
- `run_experiment`'s `_task` returns the full corrected-field set from
  `review_one` (not just `{verdict, fit_score}`); `evaluators=[...]` lists all of
  the above. All scored fields are pure comparisons.
- Small CLI (argparse in `reviewer/experiments.py`'s `__main__`, or a thin
  `python -m reviewer.experiments <sync|run> ...`): `sync` seeds/reconciles the
  dataset from Postgres; `run <model> [--stage2-model M]` runs an experiment and
  labels the run. Replaces the current `python -c` invocation documented in the
  old plan.

## Component 3 — Dashboard

**Shared taxonomy — `dashboard/lib/rolefit/taxonomy.ts` (new)**
Mirrors the enums in `reviewer/schemas.py` (INDUSTRIES, SUBCATEGORIES + their
mapping, ROLE_CATEGORIES, SENIORITY, WORK_ARRANGEMENT, experience_match,
confidence) so the edit-form selects offer exactly the values the model and
evaluators expect. Header comment cross-links `reviewer/schemas.py` and notes the
manual-mirror drift risk (a future step could generate one from the other).

**Fit recompute — `dashboard/lib/rolefit/fit.ts`**
Add `computeFit({...}): number`, a verbatim TS port of
`reviewer/scoring.py::compute_fit` (weights, experience/confidence bonuses,
red-flag penalty, deny cap). Cross-reference the Python source in a comment. Used
by the save action to recompute `fit_score` from corrected sub-scores.

**Review panel extraction — `dashboard/components/rolefit/ReviewPanel.tsx` (new)**
Extract the ~180-line "AI Review" block (sub-score bars, reasoning, red flags,
skill gaps) out of the 845-line `JobDetail.tsx` into a focused `ReviewPanel` with
read and edit sub-modes. `JobDetail` renders `<ReviewPanel job=... isAuthed=...
onSaveCorrection=... />`. This is a targeted cleanup that keeps files small and
the edit logic self-contained.

**Edit mode (in `ReviewPanel`)**
- A **"Correct job details"** button, shown when `isAuthed && hasReview`, toggles
  `editing`.
- Edit controls: verdict (approve/deny toggle), selects for the categoricals
  (from `taxonomy.ts`), 0–100 number inputs for the three sub-scores, editable
  text for the free-text/list fields, a note field. **Save** / **Cancel**.
- Save calls `onSaveCorrection(jobId, corrected)`; a non-fatal toast surfaces a
  LangFuse-sync failure ("Saved. LangFuse sync failed — will reconcile.").
  Cancel discards and exits edit mode.

**Server action — `dashboard/app/actions/corrections.ts` (new)**
`saveReviewCorrection(jobId, corrected)`:
1. `requireUserId()`.
2. `SELECT` the current model output (`job_reviews`) → `model_snapshot`, and the
   dataset `input` fields (`jobs`/`companies`/`profiles`).
3. `computeFit(...)` → corrected `fit_score`, using the corrected
   `skills_score`, `experience_score`, `comp_score`, `experience_match`,
   `confidence`, `red_flags`, and `verdict` (the exact inputs `compute_fit` takes).
4. `UPSERT review_corrections` (`ON CONFLICT (user_id, job_id) DO UPDATE`).
5. Upsert the LangFuse dataset item via a `lib/langfuseDataset.ts` helper
   (best-effort; DB commit already durable). Return `{ ok, langfuseSynced }`.
6. `revalidatePath("/")`.

**LangFuse helper — `dashboard/lib/langfuseDataset.ts` (new)**
Wraps `@langfuse/client` to upsert one dataset item: fixed dataset
`reviewer-golden`, item id = `${userId}:${jobId}` (deterministic → re-edits
upsert), `input` = review_one inputs, `expectedOutput` = corrected golden fields,
`metadata` = `{ corrected_at, note, source: "dashboard" }`. Reads the existing
`LANGFUSE_*` envs. Exact SDK method verified at implementation time; the payload
shape is stable.

**Board coalesce — `dashboard/lib/jobsQuery.ts` (`buildJobsQuery`)**
When an owner is present, add `LEFT JOIN review_corrections rc ON rc.job_id = j.id
AND rc.user_id = <owner>::uuid` and wrap each selected review column in
`COALESCE(rc.<col>, r.<col>) AS <col>` (verdict, role_category, seniority,
work_arrangement, pay_*, headcount, skills/experience/comp/fit_score, skill_gaps).
The review-scoped **WHERE** filters (verdict, experience/industry/subcategory
dimensions) reference the same coalesced expression so filtering matches display.

**Detail coalesce — `dashboard/lib/queries.ts` (`getJobReviewDetail`) + `/api/jobs/[id]`**
Coalesce the detail-only fields (reasoning, about, red_flags, benefits,
requirements) over `review_corrections`, and expose the categoricals
(`experience_match`, `industry`, `industry_subcategory`, `confidence`) needed to
pre-fill the edit form. `JobRow`/`JobReviewDetail` types extended accordingly.

**Coalesce precedence:** `review_corrections` (the operator's explicit
correction) wins over `job_reviews` for any field it sets. The existing
`rejectJob`/`human_override` reject path is unchanged; if both exist, the
correction overlay drives display. Documented inline.

## Error handling

- DB write is committed before the LangFuse push; a correction is never lost to a
  sync failure. Failed pushes are reconciled by `python -m reviewer.experiments
  sync`.
- LangFuse push failures are caught, logged, and returned as
  `langfuseSynced: false` → non-fatal toast.
- Missing profile inputs (null resume/instructions) are tolerated end-to-end
  (`build_profile_block` already handles `None`; the dataset input carries nulls).
- Last-write-wins on the `(user_id, job_id)` upsert; single operator, no
  concurrent-edit contention expected.

## Testing

**Python**
- `tests/test_experiments.py`: unit tests for each new evaluator (categorical
  exact match, `score_within` tolerance boundary, `field_accuracy` aggregate);
  extend the `run_experiment` wiring stub so `expected_output`/`output` carry the
  full field set and all evaluators fire.
- `tests/test_reviewer_db.py` (or sibling): integration test for
  `golden_corrections` (gated on `TEST_DATABASE_URL`, matching existing conventions).

**Dashboard (vitest)**
- Pure-function tests for `computeFit` (parity with `scoring.py` — a shared
  fixture of inputs→expected), the LangFuse item-payload builder, and the
  `buildJobsQuery` coalesce (assert the `COALESCE(rc.…, r.…)` columns + join
  appear only with an owner, mirroring `jobsQuery.test.ts`).

**Manual live pass**
Set `LANGFUSE_*` + `OPENROUTER_API_KEY`, `npm run dev`, sign in, correct a job.
Verify: the board + detail reflect the correction; a `reviewer-golden` dataset
item appears in LangFuse (US region) with the corrected `expectedOutput`; then
`python -m reviewer.experiments run <model>` produces an experiment run with
per-field scores; re-run under a different `REVIEW_MODEL_STAGE2` to compare.

## Rollout / deploy

Order matters (migration-coupled code):
1. Apply `migrations/2026-06-30-review-corrections.sql` to Supabase **before**
   pushing code that reads/writes the table.
2. Add `@langfuse/client` to `dashboard/package.json`; ensure `LANGFUSE_*` env
   vars exist on the Vercel project (Production + Preview) — the résumé-tracing
   work already introduced these; confirm presence.
3. Push; push-to-main auto-deploys dashboard (Vercel) and reviewer (Railway).
   Extend Railway watch patterns only if new reviewer paths fall outside the
   existing `reviewer/**` scope (they don't).

## Future / deferred

- Coalesce corrections into `/analytics` metrics (funnel, counts) — MVP leaves
  analytics on model output.
- LLM-as-judge scoring for free-text (reasoning/red_flags) golden fields.
- A dedicated curation-queue page for batch building the golden set.
- A "disagreement rate" view (model_snapshot vs. corrected) as a standing metric.
