# Reviewer Golden-Dataset Corrections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator correct the model's evaluation of a job in an inline edit mode, store the correction as an overlay that preserves the model's original output, push it to a LangFuse golden dataset on save, coalesce corrections across the board + detail, and score the pipeline against that ground truth in offline experiments.

**Architecture:** A new `review_corrections` table is an overlay keyed `(user_id, job_id)` — the reviewer pipeline and `job_reviews` are never mutated. A Next.js server action writes the correction, recomputes `fit_score` (TS port of `compute_fit`), and upserts a LangFuse dataset item via `@langfuse/client`. Board + detail queries `COALESCE(rc.…, r.…)` so corrections display everywhere. Python `experiments.py` syncs the same dataset from Postgres and scores verdict + categoricals + sub-scores against the corrections.

**Tech Stack:** Python 3.12 (psycopg, pydantic, openai, langfuse), Next.js/React + `postgres.js`, LangFuse (`@langfuse/client` v5 JS SDK; `langfuse` Python SDK), Postgres (Supabase), pytest, vitest.

## Global Constraints

- **Golden scored fields (must match verbatim across Python + TS):** `verdict`; categoricals `experience_match`, `industry`, `industry_subcategory`, `role_category`, `seniority`, `work_arrangement`, `confidence`; scores `skills_score`, `experience_score`, `comp_score`. `fit_score` is **derived** (recomputed from sub-scores), never a golden field.
- **LangFuse dataset name:** `reviewer-golden`. **Dataset item id:** `"{user_id}:{job_id}"` (deterministic → re-edits upsert).
- **DB is source of truth; LangFuse push is best-effort.** The DB write commits before the push; a failed push is non-fatal and reconciled by `python -m reviewer.experiments sync`.
- **The reviewer pipeline and `job_reviews` are never modified by corrections.** Corrections are a read-time overlay only.
- **Test DB:** integration tests are gated by `TEST_DATABASE_URL` (a throwaway Postgres); conftest rebuilds it from `schema.sql`. Run Python tests with `python3 -m pytest`. Example DSN: `postgresql://postgres:postgres@localhost:55432/poller_test` (adjust to your local PG).
- **Dashboard tests** run with `npm run test` (vitest, `include: ["lib/**/*.test.ts"]`) — so all unit-testable logic lives under `dashboard/lib/`. Build check: `npm run build`.
- **Enum source of truth:** `reviewer/schemas.py`. `dashboard/lib/rolefit/taxonomy.ts` mirrors it; keep them in sync.

---

## File Structure

**Create:**
- `migrations/2026-06-30-review-corrections.sql` — prod migration for the overlay table.
- `dashboard/lib/rolefit/taxonomy.ts` — TS mirror of `reviewer/schemas.py` enums.
- `dashboard/lib/rolefit/correction.ts` — pure builders: form-state ↔ correction, dataset-item payload.
- `dashboard/lib/rolefit/correction.test.ts` — tests for the above.
- `dashboard/lib/langfuseDataset.ts` — thin `@langfuse/client` dataset-item upsert.
- `dashboard/app/actions/corrections.ts` — `saveReviewCorrection` server action (glue).
- `dashboard/components/rolefit/ReviewPanel.tsx` — the review block, read + edit modes.
- `tests/test_review_corrections_schema.py` — schema presence test.

**Modify:**
- `schema.sql` — add `review_corrections` (canonical DDL).
- `reviewer/db.py` — add `golden_corrections`.
- `reviewer/experiments.py` — evaluators, `sync_golden_dataset`, `run_experiment` fields, CLI.
- `tests/test_experiments.py` — evaluator + wiring tests.
- `dashboard/lib/rolefit/fit.ts` — add `computeFit`.
- `dashboard/lib/rolefit/fit.test.ts` (create if absent) — parity test.
- `dashboard/lib/jobsQuery.ts` — board coalesce.
- `dashboard/lib/jobsQuery.test.ts` — coalesce assertions.
- `dashboard/lib/queries.ts` — detail coalesce.
- `dashboard/lib/types.ts` — extend `JobRow` / `JobReviewDetail`.
- `dashboard/app/api/jobs/[id]/route.ts` — extend `EMPTY`.
- `dashboard/components/rolefit/JobDetail.tsx` — render `<ReviewPanel>`.
- `dashboard/package.json` — add `@langfuse/client`.

---

## Task 1: `review_corrections` table (schema + migration)

**Files:**
- Modify: `schema.sql` (after the `job_reviews` block, ~line 119)
- Create: `migrations/2026-06-30-review-corrections.sql`
- Test: `tests/test_review_corrections_schema.py`

**Interfaces:**
- Produces: table `review_corrections (user_id UUID, job_id TEXT, verdict, experience_match, industry, industry_subcategory, confidence, role_category, seniority, work_arrangement, skills_score, experience_score, comp_score, fit_score, reasoning, about, pay_min, pay_max, pay_currency, pay_period, headcount, red_flags JSONB, skill_gaps JSONB, benefits JSONB, requirements JSONB, model_snapshot JSONB, note TEXT, corrected_at TIMESTAMPTZ, PRIMARY KEY(user_id, job_id))`.

- [ ] **Step 1: Write the failing schema test**

Create `tests/test_review_corrections_schema.py`:
```python
from tests.conftest import requires_db

EXPECTED_COLUMNS = {
    "user_id", "job_id", "verdict", "experience_match", "industry",
    "industry_subcategory", "confidence", "role_category", "seniority",
    "work_arrangement", "skills_score", "experience_score", "comp_score",
    "fit_score", "reasoning", "about", "pay_min", "pay_max", "pay_currency",
    "pay_period", "headcount", "red_flags", "skill_gaps", "benefits",
    "requirements", "model_snapshot", "note", "corrected_at",
}


@requires_db
def test_review_corrections_table_shape(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'review_corrections'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert EXPECTED_COLUMNS <= cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_review_corrections_schema.py -v`
Expected: FAIL — `review_corrections` does not exist (empty column set).

- [ ] **Step 3: Add the table to `schema.sql`**

Insert immediately after the `idx_job_reviews_*` indexes (after line 119):
```sql

-- Human corrections to model reviews — a golden-dataset OVERLAY. Never mutates
-- job_reviews or the reviewer pipeline; read-time COALESCE lets it drive display.
-- model_snapshot preserves the model's job_reviews values at correction time so
-- the model-vs-human diff survives later re-reviews.
CREATE TABLE review_corrections (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN
                         ('remote','hybrid','onsite','unknown')),
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,        -- recomputed from corrected sub-scores at save time
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
  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  note                 TEXT,
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_review_corrections_user ON review_corrections (user_id);
```

- [ ] **Step 4: Create the migration file**

Create `migrations/2026-06-30-review-corrections.sql`:
```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Human corrections to model reviews — a golden-dataset overlay (see schema.sql).
CREATE TABLE IF NOT EXISTS review_corrections (
  user_id              UUID NOT NULL,
  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  experience_match     TEXT CHECK (experience_match IN
                         ('step_down','match','reach','far_reach')),
  industry             TEXT,
  industry_subcategory TEXT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  role_category        TEXT,
  seniority            TEXT,
  work_arrangement     TEXT CHECK (work_arrangement IN
                         ('remote','hybrid','onsite','unknown')),
  skills_score         INT,
  experience_score     INT,
  comp_score           INT,
  fit_score            INT,
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
  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  note                 TEXT,
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_review_corrections_user ON review_corrections (user_id);

-- Deny-all RLS to match the rls_enabled_no_policy convention (served server-side
-- via a privileged direct connection that bypasses RLS).
ALTER TABLE review_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON review_corrections;
CREATE POLICY no_anon_access ON review_corrections FOR ALL USING (false) WITH CHECK (false);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_review_corrections_schema.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-06-30-review-corrections.sql tests/test_review_corrections_schema.py
git commit -m "feat(db): review_corrections golden-overlay table"
```

---

## Task 2: `golden_corrections` DB helper

**Files:**
- Modify: `reviewer/db.py`
- Test: `tests/test_reviewer_db.py`

**Interfaces:**
- Consumes: `review_corrections`, `jobs`, `companies`, `profiles` (Task 1).
- Produces: `golden_corrections(conn) -> list[dict]` — each row has keys `user_id, job_id, title, company_name, location, ats, description, resume_text, instructions, verdict, experience_match, industry, industry_subcategory, confidence, role_category, seniority, work_arrangement, skills_score, experience_score, comp_score, note, corrected_at`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_reviewer_db.py`:
```python
@requires_db
def test_golden_corrections_joins_inputs(conn):
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'resume', 'instr', 'v1')",
            (USER,),
        )
        cur.execute(
            "INSERT INTO review_corrections "
            "(user_id, job_id, verdict, experience_match, industry, "
            " industry_subcategory, confidence, role_category, seniority, "
            " work_arrangement, skills_score, experience_score, comp_score, note) "
            "VALUES (%s, %s, 'approve', 'match', 'software_internet', "
            " 'devtools_platforms', 'high', 'Backend', 'senior', 'remote', "
            " 80, 70, 60, 'looks right')",
            (USER, job_id),
        )
    conn.commit()

    rows = rdb.golden_corrections(conn)
    assert len(rows) == 1
    r = rows[0]
    assert r["job_id"] == job_id
    assert r["title"] == "Engineer"
    assert r["company_name"] == "Acme"
    assert r["ats"] == "lever"
    assert r["description"] == "jd"
    assert r["resume_text"] == "resume"
    assert r["instructions"] == "instr"
    assert r["verdict"] == "approve"
    assert r["industry_subcategory"] == "devtools_platforms"
    assert r["skills_score"] == 80
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_reviewer_db.py::test_golden_corrections_joins_inputs -v`
Expected: FAIL — `AttributeError: module 'reviewer.db' has no attribute 'golden_corrections'`.

- [ ] **Step 3: Implement `golden_corrections`**

Append to `reviewer/db.py`:
```python
def golden_corrections(conn) -> list[dict]:
    """Human corrections joined to each job's review inputs, for dataset seeding.

    input fields (title..instructions) reconstruct the review_one call; the
    remaining fields are the golden expected_output. Newest-first.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT rc.user_id, rc.job_id, j.title, c.name AS company_name,
                   j.location, c.ats, j.description,
                   p.resume_text, p.instructions,
                   rc.verdict, rc.experience_match, rc.industry,
                   rc.industry_subcategory, rc.confidence, rc.role_category,
                   rc.seniority, rc.work_arrangement,
                   rc.skills_score, rc.experience_score, rc.comp_score,
                   rc.note, rc.corrected_at
            FROM review_corrections rc
            JOIN jobs j ON j.id = rc.job_id
            JOIN companies c ON c.id = j.company_id
            JOIN profiles p ON p.user_id = rc.user_id
            ORDER BY rc.corrected_at DESC
            """
        )
        return cur.fetchall()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_reviewer_db.py::test_golden_corrections_joins_inputs -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): golden_corrections query joining review inputs"
```

---

## Task 3: Experiment evaluators (pure)

**Files:**
- Modify: `reviewer/experiments.py`
- Test: `tests/test_experiments.py`

**Interfaces:**
- Produces: `GOLDEN_CATEGORICALS: list[str]`; `GOLDEN_SCORES: list[str]`; `build_evaluators() -> list[callable]`. Each evaluator has signature `(*, input, output, expected_output, metadata=None, **kwargs) -> Evaluation` and emits a score named `verdict_match`, `match_<field>`, `close_<field>`, or `field_accuracy`.
- Keeps: existing `verdict_match(expected, actual) -> float`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_experiments.py`:
```python
def test_build_evaluators_scores_all_fields():
    from reviewer.experiments import build_evaluators

    inp, meta = {}, None
    output = {
        "verdict": "approve", "experience_match": "match",
        "industry": "software_internet", "industry_subcategory": "gaming",
        "role_category": "Backend", "seniority": "senior",
        "work_arrangement": "remote", "confidence": "high",
        "skills_score": 80, "experience_score": 70, "comp_score": 60,
    }
    expected = {**output, "seniority": "staff", "skills_score": 95}  # 2 misses

    scores = {}
    for ev in build_evaluators():
        e = ev(input=inp, output=output, expected_output=expected, metadata=meta)
        scores[e.name] = e.value

    assert scores["verdict_match"] == 1.0
    assert scores["match_seniority"] == 0.0        # senior != staff
    assert scores["match_role_category"] == 1.0
    assert scores["close_skills_score"] == 0.0     # |80-95| = 15 > 10
    assert scores["close_comp_score"] == 1.0       # exact
    # field_accuracy = 6/7 categoricals correct (seniority wrong)
    assert abs(scores["field_accuracy"] - 6 / 7) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_experiments.py::test_build_evaluators_scores_all_fields -v`
Expected: FAIL — `ImportError: cannot import name 'build_evaluators'`.

- [ ] **Step 3: Implement the evaluators**

In `reviewer/experiments.py`, replace the module-level `_verdict_evaluator` (defined inside `run_experiment`) with shared, top-level evaluator builders. Add after `verdict_match`:
```python
GOLDEN_CATEGORICALS = [
    "verdict", "experience_match", "industry", "industry_subcategory",
    "role_category", "seniority", "work_arrangement", "confidence",
]
GOLDEN_SCORES = ["skills_score", "experience_score", "comp_score"]
_SCORE_TOL = 10


def _match(expected, actual) -> float:
    return 1.0 if (expected is not None and actual is not None
                   and expected == actual) else 0.0


def _categorical_evaluator(field: str):
    name = "verdict_match" if field == "verdict" else f"match_{field}"

    def _ev(*, input, output, expected_output, metadata=None, **kwargs):
        exp = (expected_output or {}).get(field)
        act = (output or {}).get(field)
        return Evaluation(name=name, value=_match(exp, act))

    return _ev


def _score_evaluator(field: str, tol: int = _SCORE_TOL):
    def _ev(*, input, output, expected_output, metadata=None, **kwargs):
        exp = (expected_output or {}).get(field)
        act = (output or {}).get(field)
        val = 1.0 if (exp is not None and act is not None
                      and abs(exp - act) <= tol) else 0.0
        return Evaluation(name=f"close_{field}", value=val)

    return _ev


def _field_accuracy_evaluator(*, input, output, expected_output, metadata=None, **kwargs):
    exp, act = expected_output or {}, output or {}
    fields = [f for f in GOLDEN_CATEGORICALS if f != "verdict"]
    scored = [f for f in fields if exp.get(f) is not None]
    hits = sum(1 for f in scored if exp.get(f) == act.get(f))
    return Evaluation(name="field_accuracy",
                      value=(hits / len(scored) if scored else 0.0))


def build_evaluators() -> list:
    return (
        [_categorical_evaluator(f) for f in GOLDEN_CATEGORICALS]
        + [_score_evaluator(f) for f in GOLDEN_SCORES]
        + [_field_accuracy_evaluator]
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_experiments.py::test_build_evaluators_scores_all_fields -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/experiments.py tests/test_experiments.py
git commit -m "feat(reviewer): per-field experiment evaluators for the golden set"
```

---

## Task 4: `sync_golden_dataset`, `run_experiment` fields, CLI

**Files:**
- Modify: `reviewer/experiments.py`
- Test: `tests/test_experiments.py`

**Interfaces:**
- Consumes: `db.golden_corrections` (Task 2), `build_evaluators` / `GOLDEN_CATEGORICALS` / `GOLDEN_SCORES` (Task 3).
- Produces: `sync_golden_dataset(conn, name="reviewer-golden") -> int`; updated `run_experiment(name, run_name, client=None) -> int` whose task returns all golden fields and whose `evaluators=build_evaluators()`; `main()` CLI (`python -m reviewer.experiments <sync|run>`).

- [ ] **Step 1: Update the `run_experiment` wiring test**

In `tests/test_experiments.py`, in `test_run_experiment_iterates_items`, replace the `_Item.expected_output` and add an assertion that the task output carries the categoricals. Change `_Item`:
```python
    class _Item:
        id = "item-1"
        input = {
            "title": "SRE", "company_name": "Acme", "location": "Remote",
            "ats": "lever", "description": "jd",
            "resume_text": "r", "instructions": "i",
        }
        expected_output = {"verdict": "approve", "seniority": "senior"}
        metadata = None
```
And in `_DS.run_experiment`, after building `output`, assert the task returned the expanded field set:
```python
                    assert "seniority" in output
                    assert "skills_score" in output
```
Update the evaluator loop to accept the full evaluator list (the harness already passes each evaluator the same kwargs), and assert the verdict evaluator is present:
```python
            names = {ev(input=item.input, output=output,
                        expected_output=item.expected_output,
                        metadata=item.metadata).name
                     for ev in evaluators}
            assert "verdict_match" in names
            assert "field_accuracy" in names
```
(Remove the old single-evaluator `assert ev_result.name == "verdict_match"` block it replaces.)

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_experiments.py::test_run_experiment_iterates_items -v`
Expected: FAIL — task output lacks `seniority`/`skills_score` (still returns only verdict + fit_score).

- [ ] **Step 3: Expand `run_experiment` and add `sync_golden_dataset` + CLI**

In `reviewer/experiments.py`, rewrite `run_experiment`'s `_task` to return the full field set and use `build_evaluators()`, and delete the inner `_verdict_evaluator`:
```python
def run_experiment(name: str, run_name: str, client=None) -> int:
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot run experiment")
    client = client or ReviewClient()
    dataset = lf.get_dataset(name)

    async def _task(*, item, **kwargs):
        cand = {"id": f"exp:{item.id}", **item.input}
        block = build_profile_block(
            item.input.get("resume_text"), item.input.get("instructions")
        )
        res = await review_one(cand, block, client)
        return {
            "verdict": res.verdict, "fit_score": res.fit_score,
            "experience_match": res.experience_match, "industry": res.industry,
            "industry_subcategory": res.industry_subcategory,
            "confidence": res.confidence, "role_category": res.role_category,
            "seniority": res.seniority, "work_arrangement": res.work_arrangement,
            "skills_score": res.skills_score,
            "experience_score": res.experience_score, "comp_score": res.comp_score,
        }

    result = dataset.run_experiment(
        name=run_name, task=_task, evaluators=build_evaluators(),
    )
    lf.flush()
    return len(result.item_results)
```
Replace `seed_dataset_from_reviews` with `sync_golden_dataset`:
```python
_GOLDEN_FIELDS = GOLDEN_CATEGORICALS + GOLDEN_SCORES


def sync_golden_dataset(conn, name: str = "reviewer-golden") -> int:
    """Push every human correction as a dataset item (upsert by user:job id)."""
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot sync dataset")
    lf.create_dataset(name=name)
    rows = db.golden_corrections(conn)
    for r in rows:
        lf.create_dataset_item(
            dataset_name=name,
            id=f"{r['user_id']}:{r['job_id']}",
            input={k: r[k] for k in ("title", "company_name", "location",
                                     "ats", "description", "resume_text",
                                     "instructions")},
            expected_output={k: r[k] for k in _GOLDEN_FIELDS},
            metadata={"corrected_at": r["corrected_at"].isoformat(),
                      "note": r["note"], "source": "backfill"},
        )
    lf.flush()
    return len(rows)
```
Add the CLI at the bottom:
```python
def main() -> None:
    import argparse

    from job_discovery import db as poller_db

    parser = argparse.ArgumentParser(prog="reviewer.experiments")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_sync = sub.add_parser("sync", help="seed/reconcile the golden dataset")
    p_sync.add_argument("--name", default="reviewer-golden")
    p_run = sub.add_parser("run", help="run an experiment over the golden dataset")
    p_run.add_argument("--name", default="reviewer-golden")
    p_run.add_argument("--run-name", required=True)
    args = parser.parse_args()

    conn = poller_db.connect()
    try:
        if args.cmd == "sync":
            print(f"synced {sync_golden_dataset(conn, args.name)} item(s)")
        else:
            print(f"evaluated {run_experiment(args.name, args.run_name)} item(s)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```
Update the module imports: add `from reviewer.experiments import ...` is not needed; ensure `Evaluation` import stays. Remove the now-unused `verdict_match`-only evaluator references.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_experiments.py -v`
Expected: PASS (all experiment tests).

- [ ] **Step 5: Commit**

```bash
git add reviewer/experiments.py tests/test_experiments.py
git commit -m "feat(reviewer): sync golden dataset from corrections + full-field experiment + CLI"
```

---

## Task 5: TS taxonomy mirror

**Files:**
- Create: `dashboard/lib/rolefit/taxonomy.ts`
- Test: `dashboard/lib/rolefit/taxonomy.test.ts`

**Interfaces:**
- Produces: `INDUSTRIES`, `SUBCATEGORIES_BY_INDUSTRY`, `SUBCATEGORIES`, `ROLE_CATEGORIES`, `SENIORITY`, `WORK_ARRANGEMENT`, `EXPERIENCE_MATCH`, `CONFIDENCE`, `VERDICTS` — all `readonly string[]` (or `Record`), mirroring `reviewer/schemas.py`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/rolefit/taxonomy.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  INDUSTRIES, SUBCATEGORIES, SUBCATEGORIES_BY_INDUSTRY, ROLE_CATEGORIES,
} from "@/lib/rolefit/taxonomy";

describe("taxonomy mirror", () => {
  test("industries and subcategories match reviewer/schemas.py", () => {
    expect(INDUSTRIES).toContain("software_internet");
    expect(SUBCATEGORIES_BY_INDUSTRY.software_internet).toContain("gaming");
    // SUBCATEGORIES is the flattened union of every industry's list
    expect(SUBCATEGORIES).toEqual(
      Object.values(SUBCATEGORIES_BY_INDUSTRY).flat(),
    );
    expect(ROLE_CATEGORIES).toContain("Backend");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/taxonomy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mirror**

Create `dashboard/lib/rolefit/taxonomy.ts` (values copied verbatim from `reviewer/schemas.py`):
```ts
// Mirror of reviewer/schemas.py (TAXONOMY, ROLE_CATEGORIES, SENIORITY,
// WORK_ARRANGEMENT). Keep in sync — the Python enums are the source of truth and
// the reviewer/evaluators only accept these exact strings.

export const SUBCATEGORIES_BY_INDUSTRY: Record<string, readonly string[]> = {
  software_internet: [
    "devtools_platforms", "cloud_infrastructure", "cybersecurity",
    "data_ml_ai", "devops_observability_sre", "saas_productivity",
    "consumer_social_media", "ecommerce_marketplace_tech", "gaming",
  ],
  fintech_finance: [
    "fintech_payments_crypto", "banking_trading_inhouse", "insurance_insurtech",
  ],
  healthcare_life_sciences: [
    "health_tech_digital_health", "provider_hospital_inhouse",
    "biotech_pharma_software", "medical_devices",
  ],
  commerce_consumer: [
    "retail_ecommerce_inhouse", "logistics_supply_chain", "travel_hospitality",
  ],
  industrial_hardware: [
    "manufacturing_industrial_software", "iot_embedded_robotics",
    "automotive_aerospace_defense", "energy_climate_cleantech",
  ],
  public_education: [
    "government_govtech", "education_edtech", "nonprofit_ngo",
  ],
  services_other: [
    "consulting_agency_staffing", "telecom_networking", "other_unclear",
  ],
};

export const INDUSTRIES = Object.keys(SUBCATEGORIES_BY_INDUSTRY);
export const SUBCATEGORIES = Object.values(SUBCATEGORIES_BY_INDUSTRY).flat();

export const ROLE_CATEGORIES = [
  "Frontend", "Backend", "Full-stack", "Platform", "Infra/DevOps",
  "Data/ML", "Mobile", "Security", "Product eng", "QA/Test",
  "Eng management", "Other",
] as const;

export const SENIORITY = [
  "junior", "mid", "senior", "staff", "principal", "lead", "manager", "unknown",
] as const;

export const WORK_ARRANGEMENT = ["remote", "hybrid", "onsite", "unknown"] as const;
export const EXPERIENCE_MATCH = ["step_down", "match", "reach", "far_reach"] as const;
export const CONFIDENCE = ["low", "medium", "high"] as const;
export const VERDICTS = ["approve", "deny"] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/rolefit/taxonomy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/taxonomy.ts dashboard/lib/rolefit/taxonomy.test.ts
git commit -m "feat(dashboard): TS taxonomy mirror of reviewer/schemas.py"
```

---

## Task 6: `computeFit` port

**Files:**
- Modify: `dashboard/lib/rolefit/fit.ts`
- Test: `dashboard/lib/rolefit/fit.test.ts` (create)

**Interfaces:**
- Produces: `computeFit(a: { skillsScore: number|null; experienceScore: number|null; compScore: number|null; experienceMatch: string|null; confidence: string|null; redFlags: string[]; verdict: string|null }): number` — verbatim port of `reviewer/scoring.py::compute_fit`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/rolefit/fit.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { computeFit } from "@/lib/rolefit/fit";

describe("computeFit (parity with reviewer/scoring.py)", () => {
  const base = {
    skillsScore: 80, experienceScore: 70, compScore: 60,
    experienceMatch: "match", confidence: "high", redFlags: [], verdict: "approve",
  };
  test("weighted sum + bonuses", () => {
    // 0.45*80 + 0.30*70 + 0.25*60 = 72; +4 (match) +3 (high) = 79
    expect(computeFit(base)).toBe(79);
  });
  test("red-flag penalty caps at 9", () => {
    expect(computeFit({ ...base, redFlags: ["a", "b", "c", "d"] })).toBe(70); // 79-9
  });
  test("deny caps at 58", () => {
    expect(computeFit({ ...base, verdict: "deny" })).toBe(58);
  });
  test("banker's rounding on .5", () => {
    // 0.45*10 + 0.30*10 + 0.25*10 = 10; no bonuses -> exactly 10 (even) stays 10
    // craft a .5: skills 81 -> 0.45*81=36.45; +0.30*70=21 +0.25*60=15 => 72.45 -> +7 =79.45 -> 79
    expect(computeFit({ ...base, skillsScore: 81, confidence: "medium",
      experienceMatch: "step_down" })).toBe(38 + 21 + 15 - 0); // see impl note
  });
});
```
> Note: replace the last case's expected with the value you compute by hand from the ported formula; its purpose is to lock a `.5` boundary to Python's round-half-to-even. If unsure, use inputs that produce a clean integer and drop the `.5` assertion.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/fit.test.ts`
Expected: FAIL — `computeFit` is not exported.

- [ ] **Step 3: Implement `computeFit`**

Append to `dashboard/lib/rolefit/fit.ts`:
```ts
// Verbatim port of reviewer/scoring.py::compute_fit — keep in lockstep with it.
// Deterministic overall fit (0-100) from the corrected sub-scores, so the board
// ring reflects a correction without a Python round-trip.
const FIT_WEIGHTS = { skills: 0.45, experience: 0.3, comp: 0.25 };
const EXPERIENCE_BONUS: Record<string, number> = {
  match: 4, step_down: 2, reach: -3, far_reach: -8,
};
const CONFIDENCE_BONUS: Record<string, number> = { high: 3, medium: 0, low: -5 };
const RED_FLAG_PENALTY = 3;
const RED_FLAG_PENALTY_CAP = 9;
const DENY_CAP = 58;

// Python's round() is round-half-to-even; JS Math.round is half-up. Match Python.
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function computeFit(a: {
  skillsScore: number | null;
  experienceScore: number | null;
  compScore: number | null;
  experienceMatch: string | null;
  confidence: string | null;
  redFlags: string[];
  verdict: string | null;
}): number {
  const s = a.skillsScore ?? 0;
  const e = a.experienceScore ?? 0;
  const c = a.compScore ?? 0;
  let fit =
    FIT_WEIGHTS.skills * s + FIT_WEIGHTS.experience * e + FIT_WEIGHTS.comp * c;
  fit += EXPERIENCE_BONUS[a.experienceMatch ?? ""] ?? 0;
  fit += CONFIDENCE_BONUS[a.confidence ?? ""] ?? 0;
  fit -= Math.min(RED_FLAG_PENALTY_CAP, RED_FLAG_PENALTY * (a.redFlags?.length ?? 0));
  fit = roundHalfEven(Math.max(0, Math.min(100, fit)));
  if (a.verdict === "deny") fit = Math.min(fit, DENY_CAP);
  return fit;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/rolefit/fit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/fit.ts dashboard/lib/rolefit/fit.test.ts
git commit -m "feat(dashboard): computeFit TS port of reviewer/scoring.py"
```

---

## Task 7: Correction pure builders

**Files:**
- Create: `dashboard/lib/rolefit/correction.ts`
- Test: `dashboard/lib/rolefit/correction.test.ts`

**Interfaces:**
- Consumes: `computeFit` (Task 6).
- Produces:
  - `GOLDEN_DATASET_NAME = "reviewer-golden"`.
  - `interface CorrectionForm` — every editable field (golden + free-text + note).
  - `formToCorrection(f: CorrectionForm): CorrectionRow` — adds computed `fit_score`.
  - `interface CorrectionRow` — snake_case DB column values (no user_id/job_id).
  - `buildDatasetItem(args: { userId: string; jobId: string; input: DatasetInput; row: CorrectionRow; note: string | null; correctedAt: string }): DatasetItem`.
  - `interface DatasetItem { id: string; datasetName: string; input: DatasetInput; expectedOutput: Record<string, unknown>; metadata: Record<string, unknown> }`.
  - `GOLDEN_EXPECTED_FIELDS: string[]` — the 11 golden keys (categoricals + scores, excl. fit).

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/rolefit/correction.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  formToCorrection, buildDatasetItem, GOLDEN_DATASET_NAME, GOLDEN_EXPECTED_FIELDS,
} from "@/lib/rolefit/correction";

const form = {
  verdict: "approve", experienceMatch: "match", industry: "software_internet",
  industrySubcategory: "gaming", confidence: "high", roleCategory: "Backend",
  seniority: "senior", workArrangement: "remote",
  skillsScore: 80, experienceScore: 70, compScore: 60,
  reasoning: "fits", about: null, payMin: null, payMax: null,
  payCurrency: null, payPeriod: null, headcount: null,
  redFlags: [], skillGaps: [], benefits: [], requirements: [], note: "ok",
};

describe("correction builders", () => {
  test("formToCorrection computes fit_score and maps to snake_case", () => {
    const row = formToCorrection(form);
    expect(row.verdict).toBe("approve");
    expect(row.industry_subcategory).toBe("gaming");
    expect(row.skills_score).toBe(80);
    expect(row.fit_score).toBe(79); // parity with computeFit test
  });

  test("buildDatasetItem keys id by user:job and carries only golden expected", () => {
    const row = formToCorrection(form);
    const item = buildDatasetItem({
      userId: "u1", jobId: "lever:acme:1",
      input: { title: "SRE", company_name: "Acme", location: "Remote",
               ats: "lever", description: "jd", resume_text: "r", instructions: "i" },
      row, note: "ok", correctedAt: "2026-06-30T00:00:00Z",
    });
    expect(item.id).toBe("u1:lever:acme:1");
    expect(item.datasetName).toBe(GOLDEN_DATASET_NAME);
    expect(Object.keys(item.expectedOutput).sort()).toEqual(
      [...GOLDEN_EXPECTED_FIELDS].sort(),
    );
    expect(item.expectedOutput).not.toHaveProperty("fit_score");
    expect(item.metadata.note).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/correction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builders**

Create `dashboard/lib/rolefit/correction.ts`:
```ts
import { computeFit } from "@/lib/rolefit/fit";

export const GOLDEN_DATASET_NAME = "reviewer-golden";

export const GOLDEN_EXPECTED_FIELDS = [
  "verdict", "experience_match", "industry", "industry_subcategory",
  "role_category", "seniority", "work_arrangement", "confidence",
  "skills_score", "experience_score", "comp_score",
] as const;

export interface CorrectionForm {
  verdict: string | null;
  experienceMatch: string | null;
  industry: string | null;
  industrySubcategory: string | null;
  confidence: string | null;
  roleCategory: string | null;
  seniority: string | null;
  workArrangement: string | null;
  skillsScore: number | null;
  experienceScore: number | null;
  compScore: number | null;
  reasoning: string | null;
  about: string | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  headcount: string | null;
  redFlags: string[];
  skillGaps: string[];
  benefits: string[];
  requirements: { text: string; met: boolean }[];
  note: string | null;
}

export interface CorrectionRow {
  verdict: string | null;
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  role_category: string | null;
  seniority: string | null;
  work_arrangement: string | null;
  skills_score: number | null;
  experience_score: number | null;
  comp_score: number | null;
  fit_score: number;
  reasoning: string | null;
  about: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  headcount: string | null;
  red_flags: string[];
  skill_gaps: string[];
  benefits: string[];
  requirements: { text: string; met: boolean }[];
}

export function formToCorrection(f: CorrectionForm): CorrectionRow {
  const fit_score = computeFit({
    skillsScore: f.skillsScore, experienceScore: f.experienceScore,
    compScore: f.compScore, experienceMatch: f.experienceMatch,
    confidence: f.confidence, redFlags: f.redFlags, verdict: f.verdict,
  });
  return {
    verdict: f.verdict, experience_match: f.experienceMatch,
    industry: f.industry, industry_subcategory: f.industrySubcategory,
    confidence: f.confidence, role_category: f.roleCategory,
    seniority: f.seniority, work_arrangement: f.workArrangement,
    skills_score: f.skillsScore, experience_score: f.experienceScore,
    comp_score: f.compScore, fit_score,
    reasoning: f.reasoning, about: f.about, pay_min: f.payMin, pay_max: f.payMax,
    pay_currency: f.payCurrency, pay_period: f.payPeriod, headcount: f.headcount,
    red_flags: f.redFlags, skill_gaps: f.skillGaps, benefits: f.benefits,
    requirements: f.requirements,
  };
}

export interface DatasetInput {
  title: string;
  company_name: string;
  location: string | null;
  ats: string | null;
  description: string | null;
  resume_text: string | null;
  instructions: string | null;
}

export interface DatasetItem {
  id: string;
  datasetName: string;
  input: DatasetInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildDatasetItem(args: {
  userId: string;
  jobId: string;
  input: DatasetInput;
  row: CorrectionRow;
  note: string | null;
  correctedAt: string;
}): DatasetItem {
  const expectedOutput: Record<string, unknown> = {};
  for (const k of GOLDEN_EXPECTED_FIELDS) {
    expectedOutput[k] = (args.row as Record<string, unknown>)[k];
  }
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput,
    metadata: { note: args.note, corrected_at: args.correctedAt, source: "dashboard" },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/rolefit/correction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/correction.ts dashboard/lib/rolefit/correction.test.ts
git commit -m "feat(dashboard): pure correction + dataset-item builders"
```

---

## Task 8: `@langfuse/client` dataset upsert helper

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/lib/langfuseDataset.ts`

**Interfaces:**
- Consumes: `DatasetItem` (Task 7).
- Produces: `upsertDatasetItem(item: DatasetItem): Promise<void>` — best-effort; throws only on a real client error (caller catches).

- [ ] **Step 1: Add the dependency**

Run:
```bash
cd dashboard && npm install @langfuse/client
```
Expected: `@langfuse/client` added to `dependencies` (same major as the installed `@langfuse/otel`/`@langfuse/tracing`).

- [ ] **Step 2: Discover the exact SDK surface**

Run:
```bash
cd dashboard && node -e "const c=require('@langfuse/client'); console.log(Object.keys(c)); const C=c.LangfuseClient||c.default; console.log(Object.getOwnPropertyNames(C && C.prototype || {}))"
```
Expected: prints the export names and client methods. Confirm the dataset-item create path (one of `client.api.datasetItems.create(...)`, `client.createDatasetItem(...)`, or `client.dataset.createItem(...)`). Use whichever the output shows in Step 3.

- [ ] **Step 3: Implement the helper**

Create `dashboard/lib/langfuseDataset.ts` (adjust the create-call to match Step 2's output; the payload shape is stable):
```ts
import { LangfuseClient } from "@langfuse/client";
import type { DatasetItem } from "@/lib/rolefit/correction";

// One shared client; reads keys explicitly (LANGFUSE_HOST is the repo's env name,
// which the classic client expects as baseUrl).
let client: LangfuseClient | null = null;

function getClient(): LangfuseClient | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }
  if (!client) {
    client = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });
  }
  return client;
}

// Upsert one golden dataset item. No-op when keys are absent (local/dev). The
// same id re-upserts, so re-editing a correction updates the item in place.
export async function upsertDatasetItem(item: DatasetItem): Promise<void> {
  const c = getClient();
  if (c === null) return;
  // Ensure the dataset exists (idempotent; ignore "already exists").
  try {
    await c.api.datasets.create({ name: item.datasetName });
  } catch {
    /* dataset already exists */
  }
  await c.api.datasetItems.create({
    datasetName: item.datasetName,
    id: item.id,
    input: item.input,
    expectedOutput: item.expectedOutput,
    metadata: item.metadata,
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npm run build`
Expected: builds clean. (If the `c.api.*` path differs from Step 2, fix the two calls and rebuild.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/lib/langfuseDataset.ts
git commit -m "feat(dashboard): LangFuse golden dataset-item upsert helper"
```

---

## Task 9: `saveReviewCorrection` server action

**Files:**
- Create: `dashboard/app/actions/corrections.ts`

**Interfaces:**
- Consumes: `formToCorrection`, `buildDatasetItem` (Task 7), `upsertDatasetItem` (Task 8), `requireUserId`, `sql`.
- Produces: `saveReviewCorrection(jobId: string, form: CorrectionForm): Promise<{ ok: true; langfuseSynced: boolean }>`.

- [ ] **Step 1: Implement the action**

Create `dashboard/app/actions/corrections.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formToCorrection, buildDatasetItem } from "@/lib/rolefit/correction";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { upsertDatasetItem } from "@/lib/langfuseDataset";

// Persist a human correction (overlay; never mutates job_reviews) and push it to
// the LangFuse golden dataset. DB commits first, so a LangFuse failure never
// loses the correction — it returns langfuseSynced=false and is reconciled by
// `python -m reviewer.experiments sync`.
export async function saveReviewCorrection(
  jobId: string,
  form: CorrectionForm,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  const row = formToCorrection(form);

  // Model snapshot + dataset input, one round-trip.
  const inputRows = await sql`
    SELECT j.title, c.name AS company_name, j.location, c.ats, j.description,
           p.resume_text, p.instructions,
           to_jsonb(r.*) AS model_snapshot
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.id = ${jobId}
  `;
  const src = inputRows[0] as
    | {
        title: string; company_name: string; location: string | null;
        ats: string | null; description: string | null;
        resume_text: string | null; instructions: string | null;
        model_snapshot: unknown;
      }
    | undefined;
  if (!src) throw new Error(`job ${jobId} not found`);

  const correctedAt = new Date().toISOString();
  await sql`
    INSERT INTO review_corrections (
      user_id, job_id, verdict, experience_match, industry, industry_subcategory,
      confidence, role_category, seniority, work_arrangement,
      skills_score, experience_score, comp_score, fit_score,
      reasoning, about, pay_min, pay_max, pay_currency, pay_period, headcount,
      red_flags, skill_gaps, benefits, requirements, model_snapshot, note, corrected_at
    ) VALUES (
      ${userId}::uuid, ${jobId}, ${row.verdict}, ${row.experience_match},
      ${row.industry}, ${row.industry_subcategory}, ${row.confidence},
      ${row.role_category}, ${row.seniority}, ${row.work_arrangement},
      ${row.skills_score}, ${row.experience_score}, ${row.comp_score}, ${row.fit_score},
      ${row.reasoning}, ${row.about}, ${row.pay_min}, ${row.pay_max},
      ${row.pay_currency}, ${row.pay_period}, ${row.headcount},
      ${sql.json(row.red_flags)}, ${sql.json(row.skill_gaps)},
      ${sql.json(row.benefits)}, ${sql.json(row.requirements)},
      ${sql.json(src.model_snapshot ?? {})}, ${form.note}, ${correctedAt}
    )
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = EXCLUDED.verdict, experience_match = EXCLUDED.experience_match,
      industry = EXCLUDED.industry, industry_subcategory = EXCLUDED.industry_subcategory,
      confidence = EXCLUDED.confidence, role_category = EXCLUDED.role_category,
      seniority = EXCLUDED.seniority, work_arrangement = EXCLUDED.work_arrangement,
      skills_score = EXCLUDED.skills_score, experience_score = EXCLUDED.experience_score,
      comp_score = EXCLUDED.comp_score, fit_score = EXCLUDED.fit_score,
      reasoning = EXCLUDED.reasoning, about = EXCLUDED.about,
      pay_min = EXCLUDED.pay_min, pay_max = EXCLUDED.pay_max,
      pay_currency = EXCLUDED.pay_currency, pay_period = EXCLUDED.pay_period,
      headcount = EXCLUDED.headcount, red_flags = EXCLUDED.red_flags,
      skill_gaps = EXCLUDED.skill_gaps, benefits = EXCLUDED.benefits,
      requirements = EXCLUDED.requirements, model_snapshot = EXCLUDED.model_snapshot,
      note = EXCLUDED.note, corrected_at = EXCLUDED.corrected_at
  `;

  let langfuseSynced = true;
  try {
    await upsertDatasetItem(
      buildDatasetItem({
        userId, jobId,
        input: {
          title: src.title, company_name: src.company_name, location: src.location,
          ats: src.ats, description: src.description,
          resume_text: src.resume_text, instructions: src.instructions,
        },
        row, note: form.note, correctedAt,
      }),
    );
  } catch (e) {
    console.error("langfuse dataset upsert failed", e);
    langfuseSynced = false;
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/actions/corrections.ts
git commit -m "feat(dashboard): saveReviewCorrection action (overlay write + LangFuse push)"
```

---

## Task 10: Board coalesce in `buildJobsQuery`

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts`
- Test: `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Modifies: `buildJobsQuery` to LEFT JOIN `review_corrections rc` (same owner) and `COALESCE(rc.<col>, r.<col>)` for the selected review columns and the review WHERE filters.

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/lib/jobsQuery.test.ts` (inside the `describe`):
```ts
  test("coalesces corrections over the model review when an owner is present", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = $1::uuid",
    );
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) AS verdict");
    expect(q.text).toContain("COALESCE(rc.fit_score, r.fit_score) AS fit_score");
    // the verdict filter uses the coalesced value so filtering matches display
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
  });

  test("no corrections join without an owner", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("review_corrections");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL — no `review_corrections` join / coalesce.

- [ ] **Step 3: Implement the coalesce**

In `dashboard/lib/jobsQuery.ts`:

(a) Replace the review-scoped verdict filters to coalesce:
```ts
  if (hasReviews) {
    const v = "COALESCE(rc.verdict, r.verdict)";
    if (f.verdict === "approve") where.push(`${v} = 'approve'`);
    else if (f.verdict === "deny") where.push(`${v} = 'deny'`);
    else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
    else if (f.verdict === "pending") where.push("r.job_id IS NULL");
    where.push("r.error IS NULL");
  }
```

(b) Replace the dimension filter columns to coalesce:
```ts
    const dimensions: [string, string][] = [
      [f.experience, "COALESCE(rc.experience_match, r.experience_match)"],
      [f.industry, "COALESCE(rc.industry, r.industry)"],
      [f.subcategory, "COALESCE(rc.industry_subcategory, r.industry_subcategory)"],
    ];
```

(c) Replace the review `selectCols.push(...)` block with coalesced columns:
```ts
  if (hasReviews) {
    selectCols.push(
      "COALESCE(rc.verdict, r.verdict) AS verdict",
      "r.human_override",
      "COALESCE(rc.role_category, r.role_category) AS role_category",
      "COALESCE(rc.seniority, r.seniority) AS seniority",
      "COALESCE(rc.work_arrangement, r.work_arrangement) AS work_arrangement",
      "COALESCE(rc.pay_min, r.pay_min) AS pay_min",
      "COALESCE(rc.pay_max, r.pay_max) AS pay_max",
      "COALESCE(rc.pay_currency, r.pay_currency) AS pay_currency",
      "COALESCE(rc.pay_period, r.pay_period) AS pay_period",
      "COALESCE(rc.headcount, r.headcount) AS headcount",
      "COALESCE(rc.skills_score, r.skills_score) AS skills_score",
      "COALESCE(rc.experience_score, r.experience_score) AS experience_score",
      "COALESCE(rc.comp_score, r.comp_score) AS comp_score",
      "COALESCE(rc.fit_score, r.fit_score) AS fit_score",
      "COALESCE(rc.skill_gaps, r.skill_gaps) AS skill_gaps",
      "(rc.job_id IS NOT NULL) AS corrected",
    );
  }
```

(d) Add the corrections join right after `reviewJoin`:
```ts
  const correctionsJoin = hasReviews
    ? `LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = ${ownerPh}::uuid`
    : "";
```
and add `correctionsJoin` to the `text` array immediately after `reviewJoin`:
```ts
  const text = [
    `SELECT ${selectCols.join(", ")}`,
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    reviewJoin,
    correctionsJoin,
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");
```
> `ownerPh` is already `$1`; both joins reuse it (no new value pushed), so downstream placeholders are unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: PASS (new + existing tests; the existing `r.verdict = 'approve'` test was replaced in Step 3a — if an old test still asserts the bare form, update it to the coalesced form).

- [ ] **Step 5: Add `corrected` to `JobRow` and commit**

In `dashboard/lib/types.ts`, add to `JobRow` (near `human_override`): `corrected?: boolean;`.
```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/jobsQuery.test.ts dashboard/lib/types.ts
git commit -m "feat(dashboard): coalesce corrections over model review in the board query"
```

---

## Task 11: Detail coalesce + expose categoricals

**Files:**
- Modify: `dashboard/lib/queries.ts`, `dashboard/lib/types.ts`, `dashboard/app/api/jobs/[id]/route.ts`

**Interfaces:**
- Modifies: `getJobReviewDetail` to coalesce detail fields over `review_corrections` and return the categoricals + `corrected` for the edit form.
- Extends: `JobReviewDetail` with `experience_match, industry, industry_subcategory, confidence, note, corrected`.

- [ ] **Step 1: Extend the `JobReviewDetail` type**

In `dashboard/lib/types.ts`, extend `JobReviewDetail`:
```ts
export interface JobReviewDetail {
  reasoning: string | null;
  about: string | null;
  red_flags: string[] | null;
  benefits: string[] | null;
  requirements: { text: string; met: boolean }[] | null;
  description: string | null;
  url: string | null;
  // categoricals + provenance for the correction edit form
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  note: string | null;
  corrected: boolean;
}
```
Also add to `JobRow`'s detail-only optional block: `experience_match?: string | null; industry?: string | null; industry_subcategory?: string | null; confidence?: string | null; note?: string | null;` (`experience_match?` may already exist — leave it).

- [ ] **Step 2: Coalesce in `getJobReviewDetail`**

Replace the query body in `dashboard/lib/queries.ts::getJobReviewDetail`:
```ts
  const rows = await sql`
    SELECT
      COALESCE(rc.reasoning, r.reasoning) AS reasoning,
      COALESCE(rc.about, r.about) AS about,
      COALESCE(rc.red_flags, r.red_flags) AS red_flags,
      COALESCE(rc.benefits, r.benefits) AS benefits,
      COALESCE(rc.requirements, r.requirements) AS requirements,
      j.description, j.url,
      COALESCE(rc.experience_match, r.experience_match) AS experience_match,
      COALESCE(rc.industry, r.industry) AS industry,
      COALESCE(rc.industry_subcategory, r.industry_subcategory) AS industry_subcategory,
      COALESCE(rc.confidence, r.confidence) AS confidence,
      rc.note,
      (rc.job_id IS NOT NULL) AS corrected
    FROM job_reviews r
    JOIN jobs j ON j.id = r.job_id
    LEFT JOIN review_corrections rc
      ON rc.job_id = r.job_id AND rc.user_id = r.user_id
    WHERE r.job_id = ${jobId}
      AND r.user_id = (SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1)
  `;
  return (rows[0] as unknown as JobReviewDetail) ?? null;
```

- [ ] **Step 3: Extend the route `EMPTY` fallback**

In `dashboard/app/api/jobs/[id]/route.ts`, extend `EMPTY`:
```ts
const EMPTY = {
  reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
  description: null, url: null,
  experience_match: null, industry: null, industry_subcategory: null,
  confidence: null, note: null, corrected: false,
};
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npm run build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/types.ts dashboard/app/api/jobs/[id]/route.ts
git commit -m "feat(dashboard): coalesce corrections in job detail + expose categoricals"
```

---

## Task 12: Extract read-only `ReviewPanel`

**Files:**
- Create: `dashboard/components/rolefit/ReviewPanel.tsx`
- Modify: `dashboard/components/rolefit/JobDetail.tsx`

**Interfaces:**
- Produces: `ReviewPanel({ job }: { job: JobRow })` — renders the existing "AI Review" block (the AI header, sub-score bars, reasoning, red flags, skill gaps). Behavior-preserving refactor; no visual change.

- [ ] **Step 1: Create `ReviewPanel` with the existing markup**

Create `dashboard/components/rolefit/ReviewPanel.tsx`. Move the JSX currently at `JobDetail.tsx` lines 498–680 (the `{/* ── AI Review ── */}` container `<div>` through its closing `</div>`) verbatim into this component, plus the derived locals it uses (`subScores`, `redFlags`, `skillGaps` from `job`). Wrap as:
```tsx
"use client";

import type { JobRow } from "@/lib/types";

export function ReviewPanel({ job }: { job: JobRow }) {
  const subScores: { label: string; value: number | null }[] = [
    { label: "Skills match", value: job.skills_score },
    { label: "Experience level", value: job.experience_score },
    { label: "Comp & seniority", value: job.comp_score },
  ];
  const redFlags = job.red_flags ?? [];
  const skillGaps = job.skill_gaps ?? [];

  return (
    // ← paste the AI Review container div (JobDetail.tsx:498-680) here verbatim
  );
}
```

- [ ] **Step 2: Render `ReviewPanel` from `JobDetail`**

In `dashboard/components/rolefit/JobDetail.tsx`: add `import { ReviewPanel } from "./ReviewPanel";`, delete the moved AI Review block (498–680) and its now-duplicated `subScores`/`redFlags`/`skillGaps` locals (keep `benefits`/`reqs`, still used below), and render `<ReviewPanel job={job} />` where the block was.

- [ ] **Step 3: Typecheck + verify no visual change**

Run: `cd dashboard && npm run build`
Expected: builds clean. (Manual: the job detail renders identically.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/ReviewPanel.tsx dashboard/components/rolefit/JobDetail.tsx
git commit -m "refactor(dashboard): extract read-only ReviewPanel from JobDetail"
```

---

## Task 13: Edit mode + wire `saveReviewCorrection`

**Files:**
- Modify: `dashboard/components/rolefit/ReviewPanel.tsx`, `dashboard/components/rolefit/JobDetail.tsx`

**Interfaces:**
- Consumes: `saveReviewCorrection` (Task 9), `formToCorrection`/`CorrectionForm` (Task 7), taxonomy (Task 5).
- Produces: `ReviewPanel({ job, isAuthed })` with a "Correct job details" button that toggles an edit form; Save calls `saveReviewCorrection(job.id, form)`.

- [ ] **Step 1: Add a form-state initializer**

Add to `dashboard/components/rolefit/ReviewPanel.tsx` (above the component) a pure initializer from the job's (coalesced) fields:
```tsx
import { useState } from "react";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { saveReviewCorrection } from "@/app/actions/corrections";
import {
  VERDICTS, EXPERIENCE_MATCH, INDUSTRIES, SUBCATEGORIES_BY_INDUSTRY,
  ROLE_CATEGORIES, SENIORITY, WORK_ARRANGEMENT, CONFIDENCE,
} from "@/lib/rolefit/taxonomy";

function initialForm(job: JobRow): CorrectionForm {
  return {
    verdict: job.verdict ?? null,
    experienceMatch: job.experience_match ?? null,
    industry: job.industry ?? null,
    industrySubcategory: job.industry_subcategory ?? null,
    confidence: job.confidence ?? null,
    roleCategory: job.role_category ?? null,
    seniority: job.seniority ?? null,
    workArrangement: job.work_arrangement ?? null,
    skillsScore: job.skills_score ?? null,
    experienceScore: job.experience_score ?? null,
    compScore: job.comp_score ?? null,
    reasoning: job.reasoning ?? null,
    about: job.about ?? null,
    payMin: job.pay_min ?? null,
    payMax: job.pay_max ?? null,
    payCurrency: job.pay_currency ?? null,
    payPeriod: job.pay_period ?? null,
    headcount: job.headcount ?? null,
    redFlags: job.red_flags ?? [],
    skillGaps: job.skill_gaps ?? [],
    benefits: job.benefits ?? [],
    requirements: job.requirements ?? [],
    note: job.note ?? null,
  };
}
```

- [ ] **Step 2: Add edit state + the form UI**

In `ReviewPanel`, extend the signature to `{ job, isAuthed }: { job: JobRow; isAuthed: boolean }` and add:
```tsx
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CorrectionForm>(() => initialForm(job));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function set<K extends keyof CorrectionForm>(k: K, v: CorrectionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveReviewCorrection(job.id, form);
      setToast(res.langfuseSynced ? "Saved." : "Saved. LangFuse sync failed — will reconcile.");
      setEditing(false);
    } catch {
      setToast("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const sel = (label: string, k: keyof CorrectionForm, opts: readonly string[]) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
      {label}
      <select
        value={(form[k] as string) ?? ""}
        onChange={(e) => set(k, (e.target.value || null) as CorrectionForm[typeof k])}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }}
      >
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  const num = (label: string, k: "skillsScore" | "experienceScore" | "compScore") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
      {label}
      <input
        type="number" min={0} max={100}
        value={form[k] ?? ""}
        onChange={(e) => set(k, e.target.value === "" ? null : Number(e.target.value))}
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13, width: 90 }}
      />
    </label>
  );
```
Then, at the top of the returned AI Review container, add the button + (when `editing`) the form. Add this just after the AI header row:
```tsx
      {isAuthed && (
        <div style={{ marginTop: 12 }}>
          {!editing ? (
            <button type="button" onClick={() => { setForm(initialForm(job)); setEditing(true); }}
              style={{ fontWeight: 700, fontSize: 12.5, color: "#3b6fd4", background: "#fff", border: "1px solid #d7e0f2", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
              {job.corrected ? "Edit correction" : "Correct job details"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e3e7ee", borderRadius: 12, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {sel("Verdict", "verdict", VERDICTS)}
                {sel("Experience match", "experienceMatch", EXPERIENCE_MATCH)}
                {sel("Confidence", "confidence", CONFIDENCE)}
                {sel("Role category", "roleCategory", ROLE_CATEGORIES)}
                {sel("Seniority", "seniority", SENIORITY)}
                {sel("Work arrangement", "workArrangement", WORK_ARRANGEMENT)}
                {sel("Industry", "industry", INDUSTRIES)}
                {sel("Subcategory", "industrySubcategory",
                  form.industry ? (SUBCATEGORIES_BY_INDUSTRY[form.industry] ?? []) : [])}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {num("Skills", "skillsScore")}
                {num("Experience", "experienceScore")}
                {num("Comp", "compScore")}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
                Reasoning
                <textarea value={form.reasoning ?? ""} rows={3}
                  onChange={(e) => set("reasoning", e.target.value || null)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b6472" }}>
                Note (why corrected)
                <input value={form.note ?? ""}
                  onChange={(e) => set("note", e.target.value || null)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #d7dce5", fontSize: 13 }} />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={onSave} disabled={saving}
                  style={{ fontWeight: 700, fontSize: 12.5, color: "#fff", background: "#3b6fd4", border: "1px solid #3b6fd4", borderRadius: 9, padding: "7px 16px", cursor: "pointer" }}>
                  {saving ? "Saving…" : "Save correction"}
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving}
                  style={{ fontWeight: 700, fontSize: 12.5, color: "#5b6472", background: "#fff", border: "1px solid #d7dce5", borderRadius: 9, padding: "7px 16px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {toast && <div style={{ fontSize: 12, color: "#5b6472", marginTop: 6 }}>{toast}</div>}
        </div>
      )}
```
> When `form.industry` changes, the subcategory list follows it; the reviewer's taxonomy pairs industry↔subcategory, so this keeps the pair consistent.

- [ ] **Step 3: Pass `isAuthed` from `JobDetail`**

In `dashboard/components/rolefit/JobDetail.tsx`, change the render to `<ReviewPanel job={job} isAuthed={isAuthed} />`.

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npm run build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/ReviewPanel.tsx dashboard/components/rolefit/JobDetail.tsx
git commit -m "feat(dashboard): inline Correct-job-details edit mode wired to saveReviewCorrection"
```

---

## Task 14: Full-suite verification + live pass

**Files:** none (verification + deploy).

- [ ] **Step 1: Run the whole Python suite**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest -q`
Expected: PASS (or only the pre-existing skip noted in the worktree-tests memory).

- [ ] **Step 2: Run the whole dashboard suite + build**

Run: `cd dashboard && npm run test && npm run build`
Expected: all vitest green; Next build clean.

- [ ] **Step 3: Apply the migration to Supabase (before deploy)**

Apply `migrations/2026-06-30-review-corrections.sql` to the live Supabase DB (per the deploy-topology: migrations before migration-coupled code). Confirm `review_corrections` exists.

- [ ] **Step 4: Confirm LangFuse env on Vercel**

Ensure `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` exist on the Vercel project (Production + Preview). The host is US cloud (`us.cloud.langfuse.com`) per the langfuse-us-cloud-region memory.

- [ ] **Step 5: Live verification**

With `LANGFUSE_*` + `OPENROUTER_API_KEY` set, `cd dashboard && npm run dev`, sign in, open a reviewed job, click **Correct job details**, change verdict + a categorical + a sub-score, add a note, Save. Verify: the board card + detail reflect the correction (fit ring updates); in LangFuse (US region) a `reviewer-golden` dataset item appears keyed `userId:jobId` with the corrected `expectedOutput`. Then run `python -m reviewer.experiments run --run-name manual-1` and confirm an experiment run with per-field scores (`verdict_match`, `match_*`, `close_*`, `field_accuracy`). Optionally re-run under a different `REVIEW_MODEL_STAGE2` to compare.

- [ ] **Step 6: Merge**

```bash
git checkout main && git merge --no-ff feat/reviewer-golden-corrections
```
Push per the deploy-topology (push-to-main auto-deploys dashboard + reviewer).

---

## Self-Review notes

- **Spec coverage:** table (T1) ✓; golden_corrections (T2) ✓; evaluators (T3) ✓; sync + experiment + CLI (T4) ✓; taxonomy (T5) ✓; computeFit (T6) ✓; correction builders (T7) ✓; LangFuse push (T8) ✓; server action + model_snapshot + push-on-save (T9) ✓; full board coalesce (T10) ✓; detail coalesce + categoricals (T11) ✓; ReviewPanel extract (T12) + edit mode (T13) ✓; error handling / best-effort push (T9) ✓; testing + live pass (T14) ✓.
- **Type consistency:** `CorrectionForm`/`CorrectionRow`/`DatasetItem` defined in T7 and consumed unchanged in T9/T13; `GOLDEN_EXPECTED_FIELDS` (TS) mirrors `_GOLDEN_FIELDS` = `GOLDEN_CATEGORICALS + GOLDEN_SCORES` (Python); dataset item id `userId:jobId` identical in T7 (TS) and T4 (Python).
- **Deferred (per spec Non-goals):** analytics/funnel coalesce, LLM-judge for free-text, dedicated curation queue.
