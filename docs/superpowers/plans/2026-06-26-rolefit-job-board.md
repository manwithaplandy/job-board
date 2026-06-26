# Rolefit Job Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the table dashboard with the Rolefit split-pane job board, wired to real jobs + an AI review pipeline extended to extract richer fields, with a deterministic fit scorer and real résumé generation.

**Architecture:** The Python reviewer's Stage 2 extracts the design's fields and a pure scorer derives the 0–100 fit; new columns persist in `job_reviews`. The Next.js `/` route becomes a client split-pane fed by the existing server query (plus the new columns), with a `POST /api/resume` route calling OpenRouter for tailored résumés.

**Tech Stack:** Python 3.12 + psycopg + pydantic (reviewer); Next.js 15 App Router + React 19 + TypeScript + postgres.js + Supabase + jsPDF (dashboard); pytest + vitest.

**Spec:** [`docs/superpowers/specs/2026-06-25-rolefit-job-board-design.md`](../specs/2026-06-25-rolefit-job-board-design.md)
**Design reference (exact markup/styles):** [`docs/superpowers/specs/rolefit-reference.dc.html`](../specs/rolefit-reference.dc.html) — a self-contained prototype using a custom `x-dc`/`DCLogic` framework with `{{ }}` bindings and mock data. **Port its visuals and helper logic, not its framework.** Section markers (`<!-- ====== HEADER ====== -->`, etc.) are cited by task.

## Global Constraints

- **Python:** 3.12; reviewer per-job isolation must hold (one job's failure never aborts the batch). Run tests with `.venv/bin/pytest`. DB-integration tests are guarded by `TEST_DATABASE_URL` (`requires_db` mark in `tests/conftest.py`, which applies `schema.sql` to a throwaway DB — so **`schema.sql` must always mirror the migrations**).
- **TypeScript:** strict; path alias `@/` → `dashboard/`. Vitest only runs `lib/**/*.test.ts` (node env) — all unit-testable logic lives under `dashboard/lib/`. React components are verified by `npm run build` (typecheck) + a browser smoke checklist, not unit tests.
- **DB:** Supabase transaction pooler — `postgres.js` uses `prepare: false`; Python migrations are additive (`ADD COLUMN IF NOT EXISTS`).
- **Honest-null:** hard facts (pay, headcount) are stored null when not stated in the JD; the UI hides them or shows "Not disclosed". Never fabricate hard facts.
- **Auth model:** board is public read-only (shows the operator's reviews); résumé generation + profile editing require auth.
- **Scoring constants & enum lists** are the single source of truth in their defining module; the TS copies (`role_category` list) are documented as manually synced (same convention as the existing taxonomy ↔ `dashboard/lib/config.ts`).
- **Résumé default model:** `anthropic/claude-haiku-4.5`. **Reviewer default model:** `deepseek/deepseek-v4-flash` (unchanged).
- Commit after each task. Commit message footer line: `Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC`

---

## Phase 1 — Reviewer backend + DB

### Task 1: Deterministic fit scorer

**Files:**
- Create: `reviewer/scoring.py`
- Test: `tests/test_scoring.py`

**Interfaces:**
- Produces: `compute_fit(*, skills_score: int|None, experience_score: int|None, comp_score: int|None, experience_match: str|None, confidence: str|None, red_flags: list[str]|None, verdict: str|None) -> int` and module constants `WEIGHTS`, `EXPERIENCE_BONUS`, `CONFIDENCE_BONUS`, `RED_FLAG_PENALTY`, `RED_FLAG_PENALTY_CAP`, `DENY_CAP`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_scoring.py
import pytest

from reviewer.scoring import (
    DENY_CAP, compute_fit,
)


def _fit(**kw):
    base = dict(
        skills_score=100, experience_score=100, comp_score=100,
        experience_match="match", confidence="high", red_flags=[], verdict="approve",
    )
    base.update(kw)
    return compute_fit(**base)


def test_perfect_inputs_clamp_to_100():
    assert _fit() == 100


def test_weighted_base_only():
    # base = 0.45*100 + 0.30*0 + 0.25*0 = 45; no bonuses (unknown match/confidence)
    assert compute_fit(skills_score=100, experience_score=0, comp_score=0,
                       experience_match=None, confidence="medium",
                       red_flags=[], verdict="approve") == 45


def test_experience_and_confidence_bonuses_apply():
    # base 60 (=0.45*40+0.30*60+0.25*60? compute exactly): use simple numbers
    # base = 0.45*60+0.30*60+0.25*60 = 60; far_reach -8; low -5 -> 47
    assert compute_fit(skills_score=60, experience_score=60, comp_score=60,
                       experience_match="far_reach", confidence="low",
                       red_flags=[], verdict="approve") == 47


def test_red_flag_penalty_caps_at_three_flags():
    # base 100, +4 +3 = 107, minus min(9, 3*4)=9 -> 98 -> clamp 98
    assert _fit(red_flags=["a", "b", "c", "d"]) == 98


def test_deny_caps_score():
    assert _fit(verdict="deny") == DENY_CAP


def test_none_inputs_score_zero():
    assert compute_fit(skills_score=None, experience_score=None, comp_score=None,
                       experience_match=None, confidence=None,
                       red_flags=None, verdict=None) == 0


def test_unknown_enum_keys_contribute_zero_bonus():
    assert compute_fit(skills_score=40, experience_score=40, comp_score=40,
                       experience_match="bogus", confidence="bogus",
                       red_flags=[], verdict="approve") == 40
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_scoring.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'reviewer.scoring'`

- [ ] **Step 3: Write minimal implementation**

```python
# reviewer/scoring.py
"""Deterministic overall-fit score (0-100) from the Stage-2 review attributes.

The LLM produces component sub-scores; this module combines them into the
headline fit so the number is reproducible and tunable rather than an LLM
free-pick. Pure and total: tolerates None / unknown enum keys."""

WEIGHTS = {"skills": 0.45, "experience": 0.30, "comp": 0.25}
EXPERIENCE_BONUS = {"match": 4, "step_down": 2, "reach": -3, "far_reach": -8}
CONFIDENCE_BONUS = {"high": 3, "medium": 0, "low": -5}
RED_FLAG_PENALTY = 3
RED_FLAG_PENALTY_CAP = 9
DENY_CAP = 58  # a denied role never shows green


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_fit(*, skills_score, experience_score, comp_score,
                experience_match, confidence, red_flags, verdict) -> int:
    s = skills_score or 0
    e = experience_score or 0
    c = comp_score or 0
    fit = WEIGHTS["skills"] * s + WEIGHTS["experience"] * e + WEIGHTS["comp"] * c
    fit += EXPERIENCE_BONUS.get(experience_match or "", 0)
    fit += CONFIDENCE_BONUS.get(confidence or "", 0)
    fit -= min(RED_FLAG_PENALTY_CAP, RED_FLAG_PENALTY * len(red_flags or []))
    fit = round(_clamp(fit, 0, 100))
    if verdict == "deny":
        fit = min(fit, DENY_CAP)
    return fit
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_scoring.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/scoring.py tests/test_scoring.py
git commit -m "feat(reviewer): deterministic fit scorer

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 2: Extend the Stage-2 schema

**Files:**
- Modify: `reviewer/schemas.py`
- Test: `tests/test_schemas.py` (add cases)

**Interfaces:**
- Produces: `Stage2Result` with new optional fields (defaults so a model omission never fails validation): `role_category: RoleCategory = "Other"`, `seniority: Seniority = "unknown"`, `work_arrangement: WorkArrangement = "unknown"`, `about: str|None = None`, `pay_min/pay_max: int|None = None`, `pay_currency: str|None = None`, `pay_period: Literal["year","hour","month"]|None = None`, `headcount: str|None = None`, `skills_score/experience_score/comp_score: int = 0`, `red_flags/skill_gaps/benefits: list[str] = []`, `requirements: list[Requirement] = []`. New constants `ROLE_CATEGORIES`, `SENIORITY`, `WORK_ARRANGEMENT` and model `Requirement{text:str, met:bool}`.

- [ ] **Step 1: Write the failing test** (append to `tests/test_schemas.py`)

```python
from reviewer.schemas import ROLE_CATEGORIES, Requirement


def test_stage2_defaults_when_new_fields_omitted():
    r = Stage2Result(
        verdict="approve", experience_match="match",
        industry="software_internet", industry_subcategory="devtools_platforms",
        confidence="high", reasoning="ok",
    )
    assert r.role_category == "Other"
    assert r.seniority == "unknown"
    assert r.work_arrangement == "unknown"
    assert r.skills_score == 0 and r.red_flags == [] and r.requirements == []
    assert r.pay_min is None and r.headcount is None


def test_stage2_parses_rich_payload():
    r = Stage2Result(
        verdict="approve", experience_match="match",
        industry="software_internet", industry_subcategory="devtools_platforms",
        confidence="high", reasoning="Strong fit.",
        role_category="Frontend", seniority="senior", work_arrangement="hybrid",
        about="Cobalt builds analytics tooling.",
        pay_min=170000, pay_max=210000, pay_currency="USD", pay_period="year",
        headcount="120", skills_score=96, experience_score=93, comp_score=90,
        red_flags=["Ships daily."], skill_gaps=["WebGL"], benefits=["Equity"],
        requirements=[{"text": "5+ years React", "met": True}],
    )
    assert r.role_category == "Frontend"
    assert r.requirements[0].met is True
    assert isinstance(r.requirements[0], Requirement)


def test_stage2_rejects_unknown_role_category():
    with pytest.raises(ValidationError):
        Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="x", role_category="Astronaut",
        )


def test_role_categories_nonempty_and_has_other():
    assert "Other" in ROLE_CATEGORIES and len(ROLE_CATEGORIES) >= 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_schemas.py -v`
Expected: FAIL — `ImportError: cannot import name 'ROLE_CATEGORIES'`

- [ ] **Step 3: Write minimal implementation** (edit `reviewer/schemas.py`)

Add after the existing `Subcategory = Literal[...]` line and before `class Stage1Result`:

```python
ROLE_CATEGORIES: list[str] = [
    "Frontend", "Backend", "Full-stack", "Platform", "Infra/DevOps",
    "Data/ML", "Mobile", "Security", "Product eng", "QA/Test",
    "Eng management", "Other",
]
SENIORITY: list[str] = [
    "junior", "mid", "senior", "staff", "principal", "lead", "manager", "unknown",
]
WORK_ARRANGEMENT: list[str] = ["remote", "hybrid", "onsite", "unknown"]

RoleCategory = Literal[tuple(ROLE_CATEGORIES)]
Seniority = Literal[tuple(SENIORITY)]
WorkArrangement = Literal[tuple(WORK_ARRANGEMENT)]
PayPeriod = Literal["year", "hour", "month"]


class Requirement(BaseModel):
    text: str
    met: bool
```

Replace the `Stage2Result` class body, keeping the existing fields and appending the new ones:

```python
class Stage2Result(BaseModel):
    verdict: Literal["approve", "deny"]
    experience_match: Literal["step_down", "match", "reach", "far_reach"]
    industry: Industry
    industry_subcategory: Subcategory
    confidence: Literal["low", "medium", "high"]
    reasoning: str
    # --- Rolefit extraction (optional; defaults tolerate model omissions) ---
    role_category: RoleCategory = "Other"
    seniority: Seniority = "unknown"
    work_arrangement: WorkArrangement = "unknown"
    about: str | None = None
    pay_min: int | None = None
    pay_max: int | None = None
    pay_currency: str | None = None
    pay_period: PayPeriod | None = None
    headcount: str | None = None
    skills_score: int = 0
    experience_score: int = 0
    comp_score: int = 0
    red_flags: list[str] = Field(default_factory=list)
    skill_gaps: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)
```

Add `Field` to the pydantic import at the top: `from pydantic import BaseModel, Field`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_schemas.py -v`
Expected: PASS (all, including the pre-existing taxonomy tests)

- [ ] **Step 5: Commit**

```bash
git add reviewer/schemas.py tests/test_schemas.py
git commit -m "feat(reviewer): extend Stage2 schema with Rolefit fields

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 3: DB migration + persistence layer

**Files:**
- Create: `migrations/2026-06-26-rolefit-fields.sql`
- Modify: `schema.sql` (mirror the columns)
- Modify: `reviewer/db.py` (`_REVIEW_COLUMNS`, JSONB-aware `upsert_review`, backfill predicate in `select_candidates`)
- Test: `tests/test_reviewer_db.py` (update existing dicts, add new cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: `reviewer/db._REVIEW_COLUMNS` (extended tuple), `reviewer/db._JSONB_COLUMNS = ("red_flags","skill_gaps","benefits","requirements")`. `upsert_review(conn, row: dict)` now tolerates missing keys (defaults to None / `[]` for JSONB) and wraps JSONB columns. `select_candidates` re-selects rows where `fit_score IS NULL`.

- [ ] **Step 1: Write the migration + mirror schema.sql**

Create `migrations/2026-06-26-rolefit-fields.sql`:

```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Rolefit: richer review extraction + computed fit + résumé model.
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS role_category    TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS seniority        TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS work_arrangement TEXT
  CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown'));
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS about            TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_min          INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_max          INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_currency     TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS pay_period       TEXT
  CHECK (pay_period IN ('year','hour','month'));
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS headcount        TEXT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS skills_score     INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS experience_score INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS comp_score       INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS fit_score        INT;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS red_flags    JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS skill_gaps   JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS benefits     JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS model_resume TEXT;
```

In `schema.sql`, add the same columns to the `CREATE TABLE job_reviews (...)` block (after `reasoning`, before `model_stage1`, matching types above; `work_arrangement` and `pay_period` keep their CHECK constraints; the four JSONB columns `NOT NULL DEFAULT '[]'::jsonb`) and add `model_resume TEXT` to the `profiles` block (after `model_stage2`).

- [ ] **Step 2: Write the failing test** (edit `tests/test_reviewer_db.py`)

Add `"fit_score": 80` to the upsert dict inside `test_candidates_missing_then_excluded_when_fresh` (so a "reviewed" row is not treated as needing backfill). Then append:

```python
@requires_db
def test_candidate_reselected_when_fit_score_null(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "fit_score": None,  # pre-migration row
    })
    conn.commit()
    # null fit_score forces re-review even when profile_version matches
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)] == [job_id]


@requires_db
def test_upsert_persists_new_columns_and_jsonb(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "role_category": "Frontend", "seniority": "senior",
        "work_arrangement": "hybrid", "pay_min": 170000, "pay_max": 210000,
        "pay_currency": "USD", "pay_period": "year", "headcount": "120",
        "skills_score": 96, "experience_score": 93, "comp_score": 90, "fit_score": 94,
        "red_flags": ["Ships daily."], "skill_gaps": ["WebGL"],
        "benefits": ["Equity"], "requirements": [{"text": "5+ yrs React", "met": True}],
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM job_reviews WHERE job_id = %s", (job_id,))
        row = cur.fetchone()
    assert row["role_category"] == "Frontend" and row["fit_score"] == 94
    assert row["pay_min"] == 170000 and row["headcount"] == "120"
    assert row["red_flags"] == ["Ships daily."]            # jsonb -> python list
    assert row["requirements"] == [{"text": "5+ yrs React", "met": True}]


@requires_db
def test_upsert_tolerates_missing_jsonb_keys(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target",
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT red_flags, requirements FROM job_reviews WHERE job_id = %s", (job_id,))
        row = cur.fetchone()
    assert row["red_flags"] == [] and row["requirements"] == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_reviewer_db.py -v`
Expected: FAIL — new columns don't exist / `upsert_review` doesn't wrap JSONB. (If no local Postgres, these are skipped; rely on CI. Note the skip in the commit.)

- [ ] **Step 4: Write minimal implementation** (edit `reviewer/db.py`)

Extend the columns tuple and add the JSONB set:

```python
import uuid
from psycopg.types.json import Json

_REVIEW_COLUMNS = (
    "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
    "verdict", "experience_match", "industry", "industry_subcategory",
    "confidence", "reasoning", "model_stage1", "model_stage2", "error",
    "role_category", "seniority", "work_arrangement", "about",
    "pay_min", "pay_max", "pay_currency", "pay_period", "headcount",
    "skills_score", "experience_score", "comp_score", "fit_score",
    "red_flags", "skill_gaps", "benefits", "requirements",
)
_JSONB_COLUMNS = ("red_flags", "skill_gaps", "benefits", "requirements")
```

Replace `upsert_review`:

```python
def upsert_review(conn, row: dict) -> None:
    # Normalize to the full column set so callers may omit new keys; wrap JSONB.
    full = {c: row.get(c) for c in _REVIEW_COLUMNS}
    full["user_id"] = _uuid(full["user_id"])
    for c in _JSONB_COLUMNS:
        full[c] = Json(full[c] if full[c] is not None else [])
    with conn.cursor() as cur:
        cur.execute(_UPSERT_REVIEW_SQL, full)
```

In `select_candidates`, change the WHERE clause to:

```sql
WHERE j.closed_at IS NULL
  AND (r.job_id IS NULL OR r.profile_version <> %(pv)s OR r.fit_score IS NULL)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest tests/test_reviewer_db.py -v`
Expected: PASS (or SKIP if no DB).

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-06-26-rolefit-fields.sql schema.sql reviewer/db.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): persist Rolefit review fields + fit-score backfill

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 4: Wire extraction + scoring into the review loop + prompt

**Files:**
- Modify: `reviewer/run.py` (`ReviewResult` fields, `review_one` copies new fields + calls `compute_fit`, serializes `requirements`)
- Modify: `reviewer/llm.py` (`_STAGE2_INSTRUCTIONS` rewrite, `max_tokens` 4096 → 6000)
- Test: `tests/test_reviewer_run.py` (update `test_as_row_maps_all_columns`, add fit/requirements cases)

**Interfaces:**
- Consumes: `reviewer.scoring.compute_fit` (Task 1), extended `Stage2Result` (Task 2), `reviewer.db._REVIEW_COLUMNS` (Task 3).
- Produces: `ReviewResult` carrying all new columns; `fit_score` set whenever Stage 2 succeeds; `requirements` stored as `list[dict]` (`{text, met}`).

- [ ] **Step 1: Write the failing test** (edit `tests/test_reviewer_run.py`)

Update `StubClient.stage2` to return a richer result so fit is non-trivial:

```python
    async def stage2(self, *, profile_block, title, company, location, jd):
        self.stage2_calls.append(jd)
        if title == "BOOM2":
            raise RuntimeError("stage2 down")
        return Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="fit",
            role_category="Backend", skills_score=80, experience_score=70, comp_score=60,
            red_flags=["on-call"], requirements=[{"text": "Go", "met": False}],
        )
```

Replace the column-set assertion in `test_as_row_maps_all_columns` and add new assertions:

```python
def test_as_row_maps_all_columns():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    row = res.as_row(user_id="u", profile_version="v1")
    assert row["user_id"] == "u" and row["profile_version"] == "v1"
    assert row["job_id"] == "lever:acme:SRE"
    from reviewer.db import _REVIEW_COLUMNS
    assert set(row) == set(_REVIEW_COLUMNS)


def test_fit_score_computed_and_requirements_serialized():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    # base = 0.45*80+0.30*70+0.25*60 = 72; +4(match)+3(high) -3(1 flag) = 76
    assert res.fit_score == 76
    assert res.role_category == "Backend"
    assert res.requirements == [{"text": "Go", "met": False}]  # list[dict], JSONB-ready
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_reviewer_run.py -v`
Expected: FAIL — `ReviewResult` has no `fit_score`/`role_category`; column set mismatch.

- [ ] **Step 3: Write minimal implementation** (edit `reviewer/run.py`)

Add `from dataclasses import dataclass, field` and `from reviewer import config, db, scoring`. Extend `ReviewResult` with the new fields (after the existing ones, before `description`):

```python
    role_category: str | None = None
    seniority: str | None = None
    work_arrangement: str | None = None
    about: str | None = None
    pay_min: int | None = None
    pay_max: int | None = None
    pay_currency: str | None = None
    pay_period: str | None = None
    headcount: str | None = None
    skills_score: int | None = None
    experience_score: int | None = None
    comp_score: int | None = None
    fit_score: int | None = None
    red_flags: list = field(default_factory=list)
    skill_gaps: list = field(default_factory=list)
    benefits: list = field(default_factory=list)
    requirements: list = field(default_factory=list)
```

In `review_one`, after the existing `res.reasoning = s2.reasoning` line, add:

```python
        res.role_category = s2.role_category
        res.seniority = s2.seniority
        res.work_arrangement = s2.work_arrangement
        res.about = s2.about
        res.pay_min, res.pay_max = s2.pay_min, s2.pay_max
        res.pay_currency, res.pay_period = s2.pay_currency, s2.pay_period
        res.headcount = s2.headcount
        res.skills_score = s2.skills_score
        res.experience_score = s2.experience_score
        res.comp_score = s2.comp_score
        res.red_flags = list(s2.red_flags)
        res.skill_gaps = list(s2.skill_gaps)
        res.benefits = list(s2.benefits)
        res.requirements = [r.model_dump() for r in s2.requirements]
        res.fit_score = scoring.compute_fit(
            skills_score=s2.skills_score, experience_score=s2.experience_score,
            comp_score=s2.comp_score, experience_match=s2.experience_match,
            confidence=s2.confidence, red_flags=s2.red_flags, verdict=s2.verdict,
        )
```

(`as_row` already derives from `db._REVIEW_COLUMNS` via `getattr`, so it picks up the new fields automatically.)

- [ ] **Step 4: Edit the Stage-2 prompt** (`reviewer/llm.py`)

Replace `_STAGE2_INSTRUCTIONS` with a version that requests the new fields and states the hard/soft rule. Keep the existing verdict/experience/industry/confidence/reasoning instructions and append:

```python
_STAGE2_INSTRUCTIONS = (
    "Evaluate this single job posting against the candidate's resume and "
    "instructions. Decide:\n"
    "- verdict: 'approve' if genuinely relevant and worth applying, else 'deny'.\n"
    "- experience_match: 'step_down', 'match', 'reach', or 'far_reach'.\n"
    "- industry and industry_subcategory: choose exactly one consistent pair from "
    "this taxonomy:\n"
    f"{TAXONOMY_TEXT}\n"
    "- confidence: low, medium, or high.\n"
    "- reasoning: a 2-4 sentence fit summary written to the candidate.\n"
    "- role_category: one of Frontend, Backend, Full-stack, Platform, Infra/DevOps, "
    "Data/ML, Mobile, Security, Product eng, QA/Test, Eng management, Other.\n"
    "- seniority: junior|mid|senior|staff|principal|lead|manager|unknown.\n"
    "- work_arrangement: remote|hybrid|onsite|unknown.\n"
    "- skills_score, experience_score, comp_score: integers 0-100 (how well the "
    "candidate's skills, experience level, and the comp/seniority fit).\n"
    "- requirements: the role's key requirements, each {text, met} where met is "
    "whether the candidate meets it.\n"
    "- red_flags, skill_gaps, benefits: short string lists ([] if none).\n"
    "HARD FACTS — set to null unless explicitly stated in the description: "
    "pay_min, pay_max, pay_currency, pay_period (year|hour|month), headcount.\n"
    "SOFT FIELDS — you may infer from the description and company name: "
    "about (1-2 sentences), role_category, seniority, work_arrangement.\n"
    "Honor the candidate's focus/avoid instructions."
)
```

Change the `stage2` call's `max_tokens=4096` to `max_tokens=6000`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/test_reviewer_run.py tests/test_llm.py -v`
Expected: PASS (the `test_llm.py` fake returns a valid `Stage2Result`; defaults cover new fields).

- [ ] **Step 6: Run the full Python suite**

Run: `.venv/bin/pytest -q`
Expected: PASS (DB tests skip without `TEST_DATABASE_URL`).

- [ ] **Step 7: Commit**

```bash
git add reviewer/run.py reviewer/llm.py tests/test_reviewer_run.py
git commit -m "feat(reviewer): extract Rolefit fields + compute fit in review loop

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

## Phase 2 — Dashboard data layer + pure helpers

### Task 5: Extend JobRow type + jobs query

**Files:**
- Modify: `dashboard/lib/types.ts` (`JobRow`)
- Modify: `dashboard/lib/jobsQuery.ts` (`selectCols`)
- Test: `dashboard/lib/jobsQuery.test.ts` (add cases)

**Interfaces:**
- Produces: `JobRow` with the new nullable review fields; `buildJobsQuery` selects `r.*` Rolefit columns only in the owner branch.

- [ ] **Step 1: Write the failing test** (append to `dashboard/lib/jobsQuery.test.ts`)

```typescript
  test("selects rolefit review columns when an owner is present", () => {
    const t = buildJobsQuery(base, UID).text;
    for (const col of ["r.role_category", "r.fit_score", "r.pay_min",
      "r.skills_score", "r.red_flags", "r.requirements", "r.work_arrangement"]) {
      expect(t).toContain(col);
    }
  });

  test("rolefit columns absent without an owner", () => {
    const t = buildJobsQuery(base, null).text;
    expect(t).not.toContain("r.fit_score");
    expect(t).not.toContain("r.requirements");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- jobsQuery`
Expected: FAIL — columns not in query.

- [ ] **Step 3: Implement** — in `dashboard/lib/jobsQuery.ts`, inside `if (hasReviews) { selectCols.push(...) }`, append after the existing review columns:

```typescript
    selectCols.push(
      "r.role_category", "r.seniority", "r.work_arrangement", "r.about",
      "r.pay_min", "r.pay_max", "r.pay_currency", "r.pay_period", "r.headcount",
      "r.skills_score", "r.experience_score", "r.comp_score", "r.fit_score",
      "r.red_flags", "r.skill_gaps", "r.benefits", "r.requirements",
    );
```

In `dashboard/lib/types.ts`, add to `JobRow` (after `stage1_reason`):

```typescript
  role_category: string | null;
  seniority: string | null;
  work_arrangement: string | null;
  about: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  headcount: string | null;
  skills_score: number | null;
  experience_score: number | null;
  comp_score: number | null;
  fit_score: number | null;
  red_flags: string[] | null;
  skill_gaps: string[] | null;
  benefits: string[] | null;
  requirements: { text: string; met: boolean }[] | null;
```

Also add `model_resume: string | null;` to the `ProfileRow` interface (after `model_stage2`) — needed typed by the résumé route (Task 9) and the profile wiring (Task 10).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npm test -- jobsQuery`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/jobsQuery.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat(dashboard): select Rolefit review columns

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 6: Fit color + formatting helpers

**Files:**
- Create: `dashboard/lib/rolefit/fit.ts`
- Test: `dashboard/lib/rolefit/fit.test.ts`

**Interfaces:**
- Produces: `fitColor(fit: number): { strong, textOn, tint, tintVivid, tintBorder }`; `initialsOf(name: string): string`; `fmtPay(j: PayLike): string | null`; `fmtPosted(firstSeenIso: string, nowIso: string): string`. Port `fitColor`/`initialsOf` verbatim from the design's `<script type="text/x-dc">` block (`fitColor`, `initialsOf` methods).

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/fit.test.ts
import { describe, expect, test } from "vitest";
import { fitColor, fmtPay, fmtPosted, initialsOf } from "@/lib/rolefit/fit";

describe("fitColor", () => {
  test("returns oklch strings across the range", () => {
    for (const f of [48, 72, 96]) {
      expect(fitColor(f).strong).toMatch(/^oklch\(/);
    }
  });
  test("low fit uses light text-on, high fit also defined", () => {
    expect(typeof fitColor(50).textOn).toBe("string");
    expect(typeof fitColor(95).textOn).toBe("string");
  });
});

describe("initialsOf", () => {
  test("two words -> first letters", () => { expect(initialsOf("Pixel Co")).toBe("PC"); });
  test("single word -> first two chars upper", () => { expect(initialsOf("cobalt")).toBe("CO"); });
});

describe("fmtPay", () => {
  test("annual range formats to $k", () => {
    expect(fmtPay({ pay_min: 170000, pay_max: 210000, pay_currency: "USD", pay_period: "year" }))
      .toBe("$170k–210k");
  });
  test("hourly formats with /hr", () => {
    expect(fmtPay({ pay_min: 80, pay_max: 100, pay_currency: "USD", pay_period: "hour" }))
      .toBe("$80–100/hr");
  });
  test("no pay -> null", () => {
    expect(fmtPay({ pay_min: null, pay_max: null, pay_currency: null, pay_period: null })).toBeNull();
  });
});

describe("fmtPosted", () => {
  test("same day -> today", () => {
    expect(fmtPosted("2026-06-26T08:00:00Z", "2026-06-26T20:00:00Z")).toBe("today");
  });
  test("one day -> 1 day ago", () => {
    expect(fmtPosted("2026-06-25T08:00:00Z", "2026-06-26T20:00:00Z")).toBe("1 day ago");
  });
  test("n days", () => {
    expect(fmtPosted("2026-06-20T08:00:00Z", "2026-06-26T08:00:00Z")).toBe("6 days ago");
  });
});
```

(Fix the `initialsOf` two-word case to a plain `expect(initialsOf("Pixel Co")).toBe("PC")` when writing — the convoluted form above is a placeholder to avoid copy errors; use the simple assertion.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- rolefit/fit`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// dashboard/lib/rolefit/fit.ts
export interface FitColors {
  strong: string; textOn: string; tint: string; tintVivid: string; tintBorder: string;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// Ported verbatim from the design's DCLogic.fitColor: remap the realistic 48-96
// fit range across the full red->yellow->green oklch scale.
export function fitColor(fit: number): FitColors {
  const f = Math.max(0, Math.min(1, (fit - 48) / 48));
  const red = [0.635, 0.205, 27], yel = [0.85, 0.15, 92], grn = [0.66, 0.16, 150];
  let a, b, t;
  if (f < 0.5) { a = red; b = yel; t = f / 0.5; } else { a = yel; b = grn; t = (f - 0.5) / 0.5; }
  const L = lerp(a[0], b[0], t), C = lerp(a[1], b[1], t), H = lerp(a[2], b[2], t);
  return {
    strong: `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`,
    textOn: L > 0.72 ? "#2a2410" : "#ffffff",
    tint: `oklch(0.975 ${Math.min(C, 0.026).toFixed(3)} ${H.toFixed(1)})`,
    tintVivid: `oklch(0.95 ${Math.min(C, 0.058).toFixed(3)} ${H.toFixed(1)})`,
    tintBorder: `oklch(0.905 ${Math.min(C, 0.05).toFixed(3)} ${H.toFixed(1)})`,
  };
}

export function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export interface PayLike {
  pay_min: number | null; pay_max: number | null;
  pay_currency: string | null; pay_period: string | null;
}

export function fmtPay(j: PayLike): string | null {
  if (j.pay_min == null && j.pay_max == null) return null;
  const cur = !j.pay_currency || j.pay_currency === "USD" ? "$" : `${j.pay_currency} `;
  if (j.pay_period === "hour") {
    return `${cur}${j.pay_min ?? "?"}–${j.pay_max ?? "?"}/hr`;
  }
  const k = (n: number | null) => (n == null ? "?" : `${Math.round(n / 1000)}k`);
  return `${cur}${k(j.pay_min)}–${k(j.pay_max)}`;
}

export function fmtPosted(firstSeenIso: string, nowIso: string): string {
  const days = Math.floor(
    (new Date(nowIso).getTime() - new Date(firstSeenIso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npm test -- rolefit/fit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/fit.ts dashboard/lib/rolefit/fit.test.ts
git commit -m "feat(dashboard): rolefit fit color + formatting helpers

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 7: Client filter / sort / facet helpers

**Files:**
- Create: `dashboard/lib/rolefit/filter.ts`
- Test: `dashboard/lib/rolefit/filter.test.ts`

**Interfaces:**
- Produces:
  - `interface BoardFilterState { search: string; cats: string[]; locs: string[]; remote: "all"|"remote"|"hybrid"|"onsite"; minFit: number; payMin: number; sort: "match"|"pay"|"newest"|"az" }`
  - `applyFilters(jobs: JobRow[], st: BoardFilterState): JobRow[]`
  - `sortJobs(jobs: JobRow[], sort: BoardFilterState["sort"]): JobRow[]`
  - `facetCounts(jobs: JobRow[]): { categories: Record<string, number>; locations: Record<string, number> }`
- Consumes: `JobRow` (Task 5).

Semantics (match the design's `renderVals` filter logic, adapted to real fields):
- `search`: case-insensitive substring over `title + company_name + role_category + skill_gaps`.
- `cats`: keep when `role_category ∈ cats` (empty = all).
- `locs`: keep when `location ∈ locs` (empty = all).
- `remote`: `"all"` = all; else keep when `work_arrangement === remote` (fallback: when `work_arrangement` null, map `remote===true`→"remote").
- `minFit`: keep when `(fit_score ?? 0) >= minFit`.
- `payMin` (in $k): when `> 0`, keep only annual-pay jobs with `pay_period === "year" && pay_max != null && pay_max >= payMin*1000` (jobs without disclosed annual pay are excluded — opt-in filter, matches the design).
- `sort`: `match`→`fit_score` desc (null last); `pay`→`pay_max` desc (null last); `newest`→`first_seen_at` desc; `az`→`company_name` asc.
- `facetCounts`: counts by `role_category` and `location` over the passed jobs (skip nulls).

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/filter.test.ts
import { describe, expect, test } from "vitest";
import { applyFilters, facetCounts, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

function job(p: Partial<JobRow>): JobRow {
  return {
    id: "x", title: "Engineer", url: "u", location: "Remote (US)", remote: true,
    first_seen_at: "2026-06-20T00:00:00Z", closed_at: null, company_name: "Acme", ats: "lever",
    verdict: "approve", experience_match: "match", industry: null, industry_subcategory: null,
    confidence: "high", reasoning: null, stage1_decision: "pass", stage1_reason: null,
    role_category: "Backend", seniority: "senior", work_arrangement: "remote", about: null,
    pay_min: 150000, pay_max: 200000, pay_currency: "USD", pay_period: "year", headcount: null,
    skills_score: 80, experience_score: 70, comp_score: 60, fit_score: 80,
    red_flags: [], skill_gaps: ["Go"], benefits: [], requirements: null, ...p,
  };
}
const ST: BoardFilterState = { search: "", cats: [], locs: [], remote: "all", minFit: 0, payMin: 0, sort: "match" };

describe("applyFilters", () => {
  test("category filter", () => {
    const jobs = [job({ id: "a", role_category: "Backend" }), job({ id: "b", role_category: "Frontend" })];
    expect(applyFilters(jobs, { ...ST, cats: ["Frontend"] }).map((j) => j.id)).toEqual(["b"]);
  });
  test("search across title and skills", () => {
    const jobs = [job({ id: "a", title: "SRE" }), job({ id: "b", title: "Designer", role_category: "Frontend", skill_gaps: [] })];
    expect(applyFilters(jobs, { ...ST, search: "sre" }).map((j) => j.id)).toEqual(["a"]);
  });
  test("minFit excludes lower scores", () => {
    const jobs = [job({ id: "a", fit_score: 90 }), job({ id: "b", fit_score: 60 })];
    expect(applyFilters(jobs, { ...ST, minFit: 75 }).map((j) => j.id)).toEqual(["a"]);
  });
  test("payMin excludes undisclosed and hourly", () => {
    const jobs = [
      job({ id: "a", pay_max: 200000, pay_period: "year" }),
      job({ id: "b", pay_min: null, pay_max: null, pay_period: null }),
    ];
    expect(applyFilters(jobs, { ...ST, payMin: 180 }).map((j) => j.id)).toEqual(["a"]);
  });
  test("remote arrangement filter", () => {
    const jobs = [job({ id: "a", work_arrangement: "hybrid" }), job({ id: "b", work_arrangement: "remote" })];
    expect(applyFilters(jobs, { ...ST, remote: "hybrid" }).map((j) => j.id)).toEqual(["a"]);
  });
});

describe("sortJobs", () => {
  test("match sorts by fit desc, nulls last", () => {
    const jobs = [job({ id: "a", fit_score: 50 }), job({ id: "b", fit_score: null }), job({ id: "c", fit_score: 90 })];
    expect(sortJobs(jobs, "match").map((j) => j.id)).toEqual(["c", "a", "b"]);
  });
  test("az sorts by company", () => {
    const jobs = [job({ id: "a", company_name: "Zeta" }), job({ id: "b", company_name: "Acme" })];
    expect(sortJobs(jobs, "az").map((j) => j.id)).toEqual(["b", "a"]);
  });
});

describe("facetCounts", () => {
  test("counts categories and locations", () => {
    const jobs = [job({ role_category: "Backend", location: "NYC" }), job({ role_category: "Backend", location: "SF" })];
    const f = facetCounts(jobs);
    expect(f.categories).toEqual({ Backend: 2 });
    expect(f.locations).toEqual({ NYC: 1, SF: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- rolefit/filter`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// dashboard/lib/rolefit/filter.ts
import type { JobRow } from "@/lib/types";

export interface BoardFilterState {
  search: string;
  cats: string[];
  locs: string[];
  remote: "all" | "remote" | "hybrid" | "onsite";
  minFit: number;
  payMin: number; // in $k
  sort: "match" | "pay" | "newest" | "az";
}

function arrangementOf(j: JobRow): string {
  if (j.work_arrangement) return j.work_arrangement;
  if (j.remote === true) return "remote";
  return "unknown";
}

export function applyFilters(jobs: JobRow[], st: BoardFilterState): JobRow[] {
  const q = st.search.trim().toLowerCase();
  return jobs.filter((j) => {
    if (q) {
      const hay = `${j.title} ${j.company_name} ${j.role_category ?? ""} ${(j.skill_gaps ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (st.cats.length && !(j.role_category && st.cats.includes(j.role_category))) return false;
    if (st.locs.length && !(j.location && st.locs.includes(j.location))) return false;
    if (st.remote !== "all" && arrangementOf(j) !== st.remote) return false;
    if (st.minFit && (j.fit_score ?? 0) < st.minFit) return false;
    if (st.payMin) {
      if (j.pay_period !== "year" || j.pay_max == null || j.pay_max < st.payMin * 1000) return false;
    }
    return true;
  });
}

export function sortJobs(jobs: JobRow[], sort: BoardFilterState["sort"]): JobRow[] {
  const nullLast = (n: number | null) => (n == null ? -Infinity : n);
  const copy = [...jobs];
  switch (sort) {
    case "pay": return copy.sort((a, b) => nullLast(b.pay_max) - nullLast(a.pay_max));
    case "newest": return copy.sort((a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at));
    case "az": return copy.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "match":
    default: return copy.sort((a, b) => nullLast(b.fit_score) - nullLast(a.fit_score));
  }
}

export function facetCounts(jobs: JobRow[]): {
  categories: Record<string, number>;
  locations: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  const locations: Record<string, number> = {};
  for (const j of jobs) {
    if (j.role_category) categories[j.role_category] = (categories[j.role_category] ?? 0) + 1;
    if (j.location) locations[j.location] = (locations[j.location] ?? 0) + 1;
  }
  return { categories, locations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npm test -- rolefit/filter`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/filter.test.ts
git commit -m "feat(dashboard): rolefit client filter/sort/facet helpers

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 8: Résumé schema + prompt builder

**Files:**
- Create: `dashboard/lib/rolefit/resumeSchema.ts`
- Test: `dashboard/lib/rolefit/resumeSchema.test.ts`

**Interfaces:**
- Produces:
  - `interface TailoredResume { name: string; headline: string; summary: string; skills: string[]; experience: { role: string; company: string; dates: string; bullets: string[] }[]; education: string }`
  - `RESUME_JSON_SCHEMA` — an OpenRouter `json_schema` `response_format` value.
  - `buildResumePrompt(args: { resumeText: string; job: { title: string; company: string; description: string | null } }): { system: string; user: string }`

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/resumeSchema.test.ts
import { describe, expect, test } from "vitest";
import { RESUME_JSON_SCHEMA, buildResumePrompt } from "@/lib/rolefit/resumeSchema";

describe("buildResumePrompt", () => {
  const out = buildResumePrompt({
    resumeText: "Alex Morgan — Senior Engineer, React/TS",
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
  });
  test("includes the candidate resume", () => { expect(out.user).toContain("Alex Morgan"); });
  test("includes the job title, company, and JD", () => {
    expect(out.user).toContain("Frontend Engineer");
    expect(out.user).toContain("Cobalt");
    expect(out.user).toContain("Build React apps.");
  });
  test("system instructs tailoring without fabrication", () => {
    expect(out.system.toLowerCase()).toContain("tailor");
  });
  test("handles a missing JD", () => {
    const o = buildResumePrompt({ resumeText: "x", job: { title: "T", company: "C", description: null } });
    expect(o.user).toContain("T");
  });
});

describe("RESUME_JSON_SCHEMA", () => {
  test("declares the required résumé fields", () => {
    const s = JSON.stringify(RESUME_JSON_SCHEMA);
    for (const k of ["name", "headline", "summary", "skills", "experience", "education"]) {
      expect(s).toContain(k);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- rolefit/resumeSchema`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// dashboard/lib/rolefit/resumeSchema.ts
export interface ResumeExperience {
  role: string; company: string; dates: string; bullets: string[];
}
export interface TailoredResume {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: string;
}

// OpenRouter (OpenAI-compatible) structured-output schema.
export const RESUME_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "tailored_resume",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "headline", "summary", "skills", "experience", "education"],
      properties: {
        name: { type: "string" },
        headline: { type: "string" },
        summary: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        experience: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "company", "dates", "bullets"],
            properties: {
              role: { type: "string" },
              company: { type: "string" },
              dates: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
        },
        education: { type: "string" },
      },
    },
  },
} as const;

export function buildResumePrompt(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
}): { system: string; user: string } {
  const system =
    "You are a professional résumé writer. Tailor the candidate's real " +
    "experience to the target role. Emphasize genuinely relevant skills and " +
    "achievements; never invent employers, titles, dates, or credentials the " +
    "candidate does not have. Return only the structured résumé.";
  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n\n` +
    `JOB DESCRIPTION:\n${args.job.description ?? "(none provided)"}\n\n` +
    `CANDIDATE RÉSUMÉ / BACKGROUND:\n${args.resumeText}`;
  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npm test -- rolefit/resumeSchema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/resumeSchema.ts dashboard/lib/rolefit/resumeSchema.test.ts
git commit -m "feat(dashboard): tailored résumé schema + prompt builder

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

## Phase 3 — Résumé + profile backend

### Task 9: Résumé OpenRouter client + API route

**Files:**
- Create: `dashboard/lib/rolefit/resumeClient.ts`
- Create: `dashboard/app/api/resume/route.ts`
- Modify: `dashboard/lib/queries.ts` (add `getJobForResume`)
- Modify: `dashboard/.env.example` (add `OPENROUTER_API_KEY`)
- Test: `dashboard/lib/rolefit/resumeClient.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5"`
  - `generateResume(args: { resumeText: string; job: { title: string; company: string; description: string | null }; model: string; apiKey: string; fetchImpl?: typeof fetch }): Promise<TailoredResume>`
  - `getJobForResume(jobId: string): Promise<{ title: string; company_name: string; description: string | null } | null>`
  - `POST /api/resume` accepting `{ jobId }`.
- Consumes: `buildResumePrompt`, `RESUME_JSON_SCHEMA`, `TailoredResume` (Task 8); `getUserId` (`lib/auth`), `getProfile` (`lib/queries`).

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/resumeClient.test.ts
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";

const RESUME = {
  name: "Alex Morgan", headline: "Senior Engineer", summary: "…",
  skills: ["React"], experience: [{ role: "SWE", company: "X", dates: "2020", bullets: ["a"] }],
  education: "BS CS",
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

describe("generateResume", () => {
  const args = {
    resumeText: "Alex Morgan, React engineer",
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build apps." },
    model: "test/model", apiKey: "sk-test",
  };

  test("posts model + messages + response_format and returns parsed résumé", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(RESUME) } }] });
    const out = await generateResume({ ...args, fetchImpl: f });
    expect(out.name).toBe("Alex Morgan");
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.model).toBe("test/model");
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body.messages)).toContain("Cobalt");
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  test("throws on non-ok response", async () => {
    await expect(generateResume({ ...args, fetchImpl: fakeFetch({}, false) })).rejects.toThrow();
  });

  test("throws when content is not valid résumé JSON", async () => {
    const f = fakeFetch({ choices: [{ message: { content: "not json" } }] });
    await expect(generateResume({ ...args, fetchImpl: f })).rejects.toThrow();
  });
});

test("DEFAULT_RESUME_MODEL is claude haiku", () => {
  expect(DEFAULT_RESUME_MODEL).toBe("anthropic/claude-haiku-4.5");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- rolefit/resumeClient`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the client**

```typescript
// dashboard/lib/rolefit/resumeClient.ts
import { RESUME_JSON_SCHEMA, buildResumePrompt, type TailoredResume } from "@/lib/rolefit/resumeSchema";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredResume> {
  const doFetch = args.fetchImpl ?? fetch;
  const { system, user } = buildResumePrompt({ resumeText: args.resumeText, job: args.job });
  const res = await doFetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "job-board",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: RESUME_JSON_SCHEMA,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter résumé request failed: ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  let parsed: TailoredResume;
  try { parsed = JSON.parse(content) as TailoredResume; }
  catch { throw new Error("OpenRouter returned non-JSON résumé content"); }
  if (!parsed.name || !Array.isArray(parsed.experience)) {
    throw new Error("OpenRouter résumé missing required fields");
  }
  return parsed;
}
```

- [ ] **Step 4: Add `getJobForResume`** to `dashboard/lib/queries.ts`:

```typescript
export async function getJobForResume(
  jobId: string,
): Promise<{ title: string; company_name: string; description: string | null } | null> {
  const rows = await sql`
    SELECT j.title, c.name AS company_name, j.description
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.id = ${jobId}
  `;
  return (rows[0] as unknown as { title: string; company_name: string; description: string | null }) ?? null;
}
```

- [ ] **Step 5: Add the route** `dashboard/app/api/resume/route.ts`:

```typescript
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForResume } from "@/lib/queries";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForResume(jobId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  try {
    const resume = await generateResume({
      resumeText: profile.resume_text,
      job: { title: job.title, company: job.company_name, description: job.description },
      model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
      apiKey,
    });
    return Response.json(resume);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

(`profile.model_resume` is typed via the `ProfileRow` field added in Task 5; the DB column comes from Task 3's migration. The value is `null` until the operator sets it on `/profile`, which falls back to `DEFAULT_RESUME_MODEL`.)

- [ ] **Step 6: Add `OPENROUTER_API_KEY`** to `dashboard/.env.example`:

```
# OpenRouter (résumé generation). Same key as the reviewer.
OPENROUTER_API_KEY=sk-or-...
```

- [ ] **Step 7: Run tests + build**

Run: `cd dashboard && npm test -- rolefit/resumeClient && npm run build`
Expected: tests PASS; build succeeds (do Task 10 first if the `model_resume` type errors).

- [ ] **Step 8: Commit**

```bash
git add dashboard/lib/rolefit/resumeClient.ts dashboard/lib/rolefit/resumeClient.test.ts dashboard/app/api/resume/route.ts dashboard/lib/queries.ts dashboard/.env.example
git commit -m "feat(dashboard): real OpenRouter résumé generation route

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 10: Profile `model_resume` + résumé-only save action

**Files:**
- Modify: `dashboard/lib/queries.ts` (`upsertProfile` gains `modelResume`)
- Create: `dashboard/app/actions/profile.ts` (`saveProfileResume` server action for the modal)
- Modify: `dashboard/app/profile/page.tsx` (third `ModelPicker`; pass `modelResume` through `saveProfile`)
- Test: none new unit (DB/server-action plumbing) — covered by `npm run build` typecheck + manual smoke. `validateModelId` (already tested) is reused for validation.

**Interfaces:**
- Produces: `ProfileRow.model_resume: string | null`; `upsertProfile(userId, { resumeText, instructions, resumeFilePath, modelStage1, modelStage2, modelResume })`; `saveProfileResume(formData: FormData): Promise<void>` (server action, `"use server"`, requires auth, preserves existing model choices).
- Consumes: `extractPdfText`, Supabase storage, `getProfile`, `validateModelId`, `getStructuredModels`.

- [ ] **Step 1: Confirm the type** — `ProfileRow.model_resume: string | null` was added in Task 5; verify it's present (`grep model_resume dashboard/lib/types.ts`).

- [ ] **Step 2: Extend `upsertProfile`** (`dashboard/lib/queries.ts`): add `modelResume: string | null` to the `data` param, the INSERT column list (`model_resume`), the VALUES (`${data.modelResume}`), and the `ON CONFLICT DO UPDATE SET` (`model_resume = EXCLUDED.model_resume`).

- [ ] **Step 3: Update the existing `saveProfile`** in `dashboard/app/profile/page.tsx` to validate + pass `modelResume` (mirror `s1`/`s2`):

```typescript
  const r = validateModelId(String(formData.get("model_resume") ?? ""), catalogIds);
  if (!r.ok) throw new Error(r.reason);
  // …
  await upsertProfile(userId, {
    resumeText, instructions, resumeFilePath,
    modelStage1: s1.value, modelStage2: s2.value, modelResume: r.value,
  });
```

Add a third `<ModelPicker label="Résumé generation model" name="model_resume" models={models} curated={CURATED_MODELS} defaultValue={profile?.model_resume ?? null} placeholder={DEFAULT_RESUME_MODEL} />` inside the fieldset. Import `DEFAULT_RESUME_MODEL` from `@/lib/rolefit/resumeClient`.

- [ ] **Step 4: Create the modal action** `dashboard/app/actions/profile.ts`:

```typescript
"use server";

import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";

// Résumé-only save from the board's profile modal. Preserves model choices and
// instructions the user set on /profile (the modal doesn't expose them).
export async function saveProfileResume(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const existing = await getProfile(userId);

  let resumeText = String(formData.get("resume_text") ?? "").trim() || existing?.resume_text || null;
  let resumeFilePath = existing?.resume_file_path ?? null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted;
  }

  await upsertProfile(userId, {
    resumeText,
    instructions: existing?.instructions ?? null,
    resumeFilePath,
    modelStage1: existing?.model_stage1 ?? null,
    modelStage2: existing?.model_stage2 ?? null,
    modelResume: existing?.model_resume ?? null,
  });
}
```

- [ ] **Step 5: Verify build + existing tests**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds; all `lib` tests pass.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/app/actions/profile.ts dashboard/app/profile/page.tsx
git commit -m "feat(dashboard): résumé model setting + modal save action

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

## Phase 4 — Dashboard UI (port the Rolefit design)

> UI tasks port markup/styles from `docs/superpowers/specs/rolefit-reference.dc.html`. **Use inline styles copied from the reference** (the design is inline-styled; this keeps fidelity exact). Replace `{{ binding }}` placeholders with React props per each task's mapping. Each `sc-for` → `.map(...)`; each `sc-if value="{{ x }}"` → `{x && (...)}`. Verification is `npm run build` (typecheck) + the browser smoke checklist; no component unit tests (vitest is `lib`-only).

### Task 11: Foundations — font, globals, deps, remove old UI

**Files:**
- Modify: `dashboard/app/layout.tsx` (Hanken Grotesk via `next/font/google`)
- Modify: `dashboard/app/globals.css` (design base + `rf-scroll` + `rf-spin`)
- Modify: `dashboard/package.json` (add `jspdf`)
- Delete: `dashboard/components/JobsTable.tsx`, `dashboard/components/FilterBar.tsx`, `dashboard/components/Header.tsx`, `dashboard/components/RefreshButton.tsx`

- [ ] **Step 1:** Add Hanken Grotesk in `layout.tsx`:

```typescript
import { Hanken_Grotesk } from "next/font/google";
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
// apply className={hanken.className} on <body>; update metadata.title to "Rolefit"
```

- [ ] **Step 2:** Replace `globals.css` body rule with the design base (from the reference `<style>` block): set `body { background: #f4f6fa; color: #1f2430; }`, keep `@tailwind` directives, and add the `@keyframes rf-spin` and `.rf-scroll` scrollbar rules verbatim from the reference.

- [ ] **Step 3:** Add jsPDF: `cd dashboard && npm install jspdf` (verify it lands in `package.json` dependencies).

- [ ] **Step 4:** Delete the four old component files. (The page still imports them — it will be rewritten in Task 13/15; until then the build may break. That's expected mid-phase; do not commit a broken build — sequence Task 12 in the same working session, or temporarily stub `page.tsx` to `export default function Page(){return null}` and note it.)

- [ ] **Step 5: Visual validation (Claude for Chrome)** — REQUIRED gate before commit (foundations smoke).
  Dispatch the validation subagent (execution plan → "Visual validation protocol"). Ensure `cd dashboard && npm run dev` is up (http://localhost:3000); the subagent loads the core Chrome tools in ONE ToolSearch, opens a NEW tab, navigates to `/`, and confirms: the app boots with no console errors, Hanken Grotesk is applied to `<body>`, and the page background matches the design base (`#f4f6fa`). (The board itself arrives in Task 12; if `page.tsx` is stubbed this is a boot/font/globals smoke only.) Report pass/fail; fix and re-validate before committing.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/layout.tsx dashboard/app/globals.css dashboard/package.json dashboard/package-lock.json
git rm dashboard/components/JobsTable.tsx dashboard/components/FilterBar.tsx dashboard/components/Header.tsx dashboard/components/RefreshButton.tsx
git commit -m "chore(dashboard): rolefit font/globals/deps; remove table UI

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 12: Board shell — Header, FilterBar, JobList/JobCard

**Files:**
- Create: `dashboard/components/rolefit/RolefitBoard.tsx` (client; owns state)
- Create: `dashboard/components/rolefit/Header.tsx`
- Create: `dashboard/components/rolefit/FilterBar.tsx`
- Create: `dashboard/components/rolefit/JobList.tsx`
- Create: `dashboard/components/rolefit/JobCard.tsx`
- Modify: `dashboard/app/page.tsx` (server: fetch + render `<RolefitBoard>`)

**Interfaces:**
- Consumes: `JobRow` (Task 5); `applyFilters`/`sortJobs`/`facetCounts`/`BoardFilterState` (Task 7); `fitColor`/`initialsOf`/`fmtPay`/`fmtPosted` (Task 6).
- Produces:
  - `RolefitBoard({ jobs, nowIso, isOperator, isAuthed, saveResume }: { jobs: JobRow[]; nowIso: string; isOperator: boolean; isAuthed: boolean; saveResume: (fd: FormData) => Promise<void> })` — `"use client"`. Holds `BoardFilterState`, `selectedId`, `openMenu`, `profileOpen`, résumé gen state. Computes `visible = sortJobs(applyFilters(jobs, state), state.sort)`.
  - `Header`, `FilterBar`, `JobList`, `JobCard` presentational props-driven components.

State shape (mirror the reference `state = {...}`, real fields): `{ search, cats, locs, remote, minFit, payMin, sort, openMenu, selectedId, profileOpen, profileTab, gen: Record<id,'idle'|'busy'|'done'|'error'>, genData: Record<id, TailoredResume>, copiedId }`. Default `sort = "match"`. Outside-click closes `openMenu` (port `componentDidMount` doc listener → `useEffect`).

Mapping (reference → real):
- Header (`<!-- ====== HEADER ====== -->`): logo + "Rolefit" + "AI-REVIEWED" badge static; search `value=search onInput=setSearch`; profile button → opens modal (Task 14). `profileBtn*` styling: authed+profile → green "✓ name", else blue "Set up profile" (for anon, label "Sign in"). Use `isAuthed` to decide.
- FilterBar (`<!-- ====== FILTER BAR ====== -->`): Category/Location dropdowns from `facetCounts(jobs)`; Pay/Match radio dropdowns from the static defs in the reference (`payDefs`, `matchDefs`); Remote segmented toggle (`all/Remote/Hybrid/Onsite` → state `remote` values `all/remote/hybrid/onsite`); result count `"{visible.length} of {jobs.length} roles"`; Sort dropdown (`match/pay/newest/az`).
- JobList/JobCard (`<!-- LIST -->`): map `visible` → `JobCard`. Card uses `fitColor(j.fit_score ?? 0)` for the accent bar/badge/tint, `initialsOf(j.company_name)`, `fmtPay(j)` (hide chip if null), `j.work_arrangement ?? (j.remote?'remote':'—')`, `j.role_category`. Fit badge shows `j.fit_score ?? "—"`. Selected card = white bg + blue border. No-results → "No roles match your filters" + Clear filters button (resets state).

`app/page.tsx` (server):

```typescript
import { parseFilters } from "@/lib/filters";
import { getBoardOwnerId, getCompanies, getJobs } from "@/lib/queries";
import { DEFAULT_INCLUDE_KEYWORDS } from "@/lib/config";
import { getUserId } from "@/lib/auth";
import { saveProfileResume } from "@/app/actions/profile";
import { RolefitBoard } from "@/components/rolefit/RolefitBoard";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, ownerId] = await Promise.all([getUserId(), getBoardOwnerId()]);
  await searchParams; // filters now client-side; keep the param contract
  const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });
  const jobs = await getJobs(filters, ownerId);
  return (
    <RolefitBoard
      jobs={jobs}
      nowIso={new Date().toISOString()}
      isOperator={!!ownerId}
      isAuthed={!!viewerId}
      saveResume={saveProfileResume}
    />
  );
}
```

(Note: server-side `parseFilters` still applies the default `include: ["engineer"]` + open-status filter so the result set is sensible; Rolefit's own filters refine client-side. `getCompanies` is no longer needed here — drop the import if unused.)

- [ ] **Step 1:** Create `JobCard.tsx` (presentational) porting the LIST card markup; props `{ job, selected, tintMode?, onSelect }`. Use inline styles from the reference card block, swapping bindings per the mapping.
- [ ] **Step 2:** Create `JobList.tsx` rendering `jobs.map(JobCard)` + the no-results block.
- [ ] **Step 3:** Create `Header.tsx` and `FilterBar.tsx` per the mapping (dropdown open/close driven by `openMenu` prop + `onToggle*`).
- [ ] **Step 4:** Create `RolefitBoard.tsx` wiring state + helpers + the three children + the split container (`<!-- ====== SPLIT ====== -->` left pane only for now; right pane renders a placeholder `<div>Select a role</div>` until Task 13).
- [ ] **Step 5:** Rewrite `app/page.tsx` as above.
- [ ] **Step 6: Build + browser smoke**

Run: `cd dashboard && npm run build`
Then `npm run dev` and verify in the browser:
  - Board renders; list shows real roles sorted by fit (highest first).
  - Category/Location dropdowns list real values with counts; selecting filters the list.
  - Pay/Match/Remote/Sort change the list; result count updates.
  - Search filters; "Clear filters" resets.
  - Cards are color-coded by fit; selecting highlights a card.

- [ ] **Step 7: Visual validation (Claude for Chrome)** — REQUIRED gate before commit.
  Dispatch the validation subagent (execution plan → "Visual validation protocol"). With `npm run dev` up, the subagent loads the core Chrome tools in ONE ToolSearch, opens a NEW tab on `/`, and screenshots: the board at rest; each dropdown open (Category, Location, Pay, Match, Sort); the Remote segmented toggle states; a selected card; and the no-results state (search a nonsense string). Compare against `docs/superpowers/specs/rolefit-reference.dc.html` (HEADER + FILTER BAR + LIST markers; read inline styles for exact colors/spacing/radii) and the spec. Verify: split-pane layout, header (logo/"Rolefit"/"AI-REVIEWED" badge/search/profile button), filter bar (all dropdowns + counts + remote toggle + result count + sort), color-coded list (**fit color ramp oklch red→yellow→green matches each score**), selection highlight, Hanken Grotesk typography. Report pass/fail + concrete discrepancies; the implementer fixes and re-validates until it matches. Only then commit.

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/rolefit dashboard/app/page.tsx
git commit -m "feat(dashboard): rolefit board shell — header, filters, job list

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 13: Role detail — AI review, requirements, benefits, about, résumé panel

**Files:**
- Create: `dashboard/components/rolefit/JobDetail.tsx`
- Create: `dashboard/components/rolefit/ResumePanel.tsx`
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (render `JobDetail` in the right pane; wire résumé gen)

**Interfaces:**
- Consumes: `JobRow`, `fitColor`/`fmtPay`/`fmtPosted`/`initialsOf`, `TailoredResume` (Task 8), `POST /api/resume` (Task 9).
- Produces:
  - `JobDetail({ job, nowIso, isAuthed, gen, genData, onGenerate, onRegenerate, onDownload, onCopy, copyLabel, onOpenProfile })`.
  - `ResumePanel({ job, isAuthed, state, data, onGenerate, onRegenerate, onDownload, onCopy, copyLabel, usingSample, onOpenProfile })`.

Mapping (reference `<!-- DETAIL -->`):
- Header block: logo (`initialsOf`), title, `metaLine = company · location · work_arrangement`, tag chips (`role_category`, `seniority`, `headcount && "${headcount} people"`, `fmtPay` if present, `"Posted " + fmtPosted`). Fit ring SVG: `strong = fitColor(fit).strong`, `ringDash = 2π·34`, `ringOffset = circ·(1 - fit/100)`, center number `fit_score ?? "—"`.
- Résumé generator (`<!-- résumé generator -->`) → `ResumePanel` (see below).
- AI Review (`<!-- AI review -->`): sub-score bars from `skills_score`/`experience_score`/`comp_score` (label/width `${n}%`/value); `fitSummary = reasoning`; Red flags list (`red_flags`, hide section if empty); Skill gaps chips (`skill_gaps`, hide if empty); "Auto-categorized · {role_category}".
- Requirements (`<!-- requirements -->`): map `requirements` → row with ✓ (met) / △ (unmet) mark; hide section if empty.
- Benefits (`<!-- benefits -->`): chips from `benefits`; hide if empty.
- About (`<!-- about -->`): `aboutTitle = "About " + company`, body `about`; hide if null.
- For a job with **no review** (anonymous viewing a non-reviewed job, or null fit): show the header facts and a muted "Not yet reviewed" panel instead of ring/review/résumé.

`ResumePanel` states (reference `sc-if genIdle/genBusy/genDone`):
- `isAuthed === false`: idle card shows "Sign in to tailor a résumé" linking `/login`.
- idle: "Generate résumé" button → `onGenerate`.
- busy: spinner ("Tailoring your résumé to {company}…").
- done: preview (`data.name`, `data.summary`, `data.skills` chips) + Download PDF / Copy text / Regenerate.
- error: inline message + Retry.
- `usingSample` note hidden (real profiles only; show nothing when `isAuthed`).

Résumé gen wiring in `RolefitBoard`:

```typescript
const onGenerate = async (job: JobRow) => {
  setGen((g) => ({ ...g, [job.id]: "busy" }));
  try {
    const res = await fetch("/api/resume", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "failed");
    const data = (await res.json()) as TailoredResume;
    setGenData((d) => ({ ...d, [job.id]: data }));
    setGen((g) => ({ ...g, [job.id]: "done" }));
  } catch (e) {
    setGen((g) => ({ ...g, [job.id]: "error" }));
    setGenError((m) => ({ ...m, [job.id]: (e as Error).message }));
  }
};
```

PDF download (port the reference `download()` jsPDF layout) in `ResumePanel`, dynamically importing jsPDF:

```typescript
const onDownload = async (job: JobRow, data: TailoredResume) => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  // …port the reference layout: name, headline line, "TAILORED FOR" box,
  // Summary, Core skills, Experience (role/company/dates + bullets), Education…
  doc.save(`Resume - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " "));
};
```

Copy text builds a plain-text résumé from `data` (port `composeResumeText`) and uses `navigator.clipboard.writeText` with the reference's `legacyCopy` fallback; `copiedId` flips the label to "Copied!" for ~1.6s.

- [ ] **Step 1:** Create `ResumePanel.tsx` (idle/busy/done/error + anon prompt + PDF/copy).
- [ ] **Step 2:** Create `JobDetail.tsx` (header/ring + review + requirements + benefits + about + `ResumePanel`), including the "Not yet reviewed" branch.
- [ ] **Step 3:** Wire `JobDetail` into `RolefitBoard`'s right pane; add `gen`/`genData`/`genError`/`copiedId` state + handlers; reset scroll on selection (`detailRef`).
- [ ] **Step 4: Build + browser smoke**

Run: `cd dashboard && npm run build`, then `npm run dev`:
  - Selecting a reviewed role shows the ring (matching fit color), sub-score bars, fit summary, red flags, skill gaps, requirements (✓/△), benefits, about.
  - Empty sections are hidden (no empty headers).
  - As the operator with a saved profile: "Generate résumé" → spinner → preview; **Download PDF** produces a tailored PDF; Copy/Regenerate work.
  - Signed out: résumé panel shows the sign-in prompt.

- [ ] **Step 5: Visual validation (Claude for Chrome)** — REQUIRED gate before commit.
  Dispatch the validation subagent (execution plan → "Visual validation protocol"). With `npm run dev` up, the subagent loads the core Chrome tools in ONE ToolSearch, opens a NEW tab on `/`, selects a **high-fit** role and a **low-fit** role, and screenshots the detail pane for each plus: the AI-review sub-score bars, red flags / skill gaps / requirements (✓/△) / benefits / about sections, and the résumé panel states (idle / busy / done — and the anon sign-in prompt if signed out). Compare against `docs/superpowers/specs/rolefit-reference.dc.html` (DETAIL marker; read inline styles). Verify: detail layout vs design, **fit ring color matches the score** (oklch ramp), every review panel present, sub-score bar widths track the scores, résumé idle/busy/done/anon states, the "not yet reviewed" branch for null-fit jobs, and **honest-null hiding** (empty sections/chips absent — no empty headers). Report pass/fail + discrepancies; fix and re-validate until it matches. Only then commit. (If no logged-in session is available, validate the anonymous + structural views and flag the operator-only résumé-generate path for manual confirmation.)

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/rolefit
git commit -m "feat(dashboard): rolefit role detail + résumé panel

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 14: Profile modal

**Files:**
- Create: `dashboard/components/rolefit/ProfileModal.tsx`
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (render modal; header button opens it)

**Interfaces:**
- Consumes: `saveResume` server action (passed from `page.tsx`, Task 12).
- Produces: `ProfileModal({ open, isAuthed, profileName, onClose, saveResume })`.

Mapping (reference `<!-- ====== PROFILE MODAL ====== -->`):
- `open && (...)` overlay; click-outside closes; inner card stops propagation.
- Paste/Upload tabs (`profileTab` state).
- Paste: `<textarea name="resume_text">`. Upload: `<input id="rf-file" type="file" name="resume_pdf" accept=".pdf,.txt,.doc,.docx">` styled drop label.
- Form: `<form action={saveResume}>` with the textarea/file; Save submits the server action then closes; "Advanced settings →" links `/profile`.
- If `!isAuthed`: replace the body with a sign-in prompt linking `/login` (the action requires auth anyway).
- Footer subtitle: "Used to tailor résumés. Saved to your account." (not "locally" — real server-side storage).

- [ ] **Step 1:** Create `ProfileModal.tsx` per the mapping, form posting to `saveResume`.
- [ ] **Step 2:** Render `<ProfileModal>` in `RolefitBoard`; the header profile button sets `profileOpen` (authed) or routes to `/login` (anon).
- [ ] **Step 3: Build + browser smoke**

Run: `cd dashboard && npm run build`, then `npm run dev`:
  - Authed: profile button opens the modal; paste text + Save persists (re-open shows it); upload a PDF + Save extracts text; "Advanced settings" opens `/profile`.
  - Signed out: button routes to `/login`.

- [ ] **Step 4: Visual validation (Claude for Chrome)** — REQUIRED gate before commit.
  Dispatch the validation subagent (execution plan → "Visual validation protocol"). With `npm run dev` up, the subagent loads the core Chrome tools in ONE ToolSearch, opens a NEW tab on `/`, clicks the header profile button, and screenshots: the modal open, both Paste/Upload tabs, and (signed out) the sign-in prompt variant. Compare against `docs/superpowers/specs/rolefit-reference.dc.html` (PROFILE MODAL marker; read inline styles). Verify: overlay + centered card, click-outside-closes affordance, Paste/Upload tab switch, textarea + file drop label, Save button, footer subtitle ("Saved to your account."), and the anon → "Sign in" body. Report pass/fail + discrepancies; fix and re-validate until it matches. Only then commit. (If no logged-in session is available, validate the anon prompt + structural layout and flag the authed save path for manual confirmation.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit
git commit -m "feat(dashboard): rolefit profile modal wired to server save

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

### Task 15: Integration pass — operator signals, cleanup, full verification

**Files:**
- Modify: `dashboard/components/rolefit/Header.tsx` (operator-only run health / unreviewed signals)
- Modify: `dashboard/app/page.tsx` (fetch + pass telemetry when operator)
- Verify/cleanup: imports, dead code (`lib/status.isNew` if unused), `getCompanies` import.

**Interfaces:**
- Consumes: `getLatestPollRun`, `getLatestReviewRun`, `getReviewStats`, `computeHealth` (existing).
- Produces: Header shows a health dot + "{n} unreviewed" only when `isOperator` (and authed for review stats), per the existing semantics in the old `Header`.

- [ ] **Step 1:** In `page.tsx`, when `viewerId`, also fetch `getLatestPollRun`/`getLatestReviewRun`/`getReviewStats` (as the old page did) and pass a compact `operator` prop to `RolefitBoard` → `Header`. Render a small health dot + unreviewed count in the header right cluster (subtle; doesn't disturb the design's layout).
- [ ] **Step 2:** Remove now-unused imports/exports (`getCompanies` in page if unused; `lib/status.isNew` if no longer referenced — keep `computeHealth`). Run a grep to confirm no references to the deleted components remain.

Run: `cd dashboard && grep -rn "JobsTable\|RefreshButton\|components/Header\|components/FilterBar" app components || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Full verification**

```bash
# Python
.venv/bin/pytest -q
# (with a throwaway DB, optional)
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" .venv/bin/pytest -q
# Dashboard
cd dashboard && npm test && npm run build
```
Expected: all green; build succeeds.

- [ ] **Step 4: Browser smoke (end-to-end)** — `npm run dev`:
  - Board loads with real reviewed roles; filter/sort/search/select all work.
  - Detail shows the full review; honest-null sections hidden.
  - Operator: header shows health + unreviewed; profile modal saves; résumé generates + downloads.
  - Anonymous (sign out): board + review visible; résumé + profile prompt sign-in; no operator signals.

- [ ] **Step 5: Visual validation (Claude for Chrome)** — REQUIRED final gate before commit (end-to-end).
  Dispatch the validation subagent (execution plan → "Visual validation protocol"). With `npm run dev` up, the subagent loads the core Chrome tools in ONE ToolSearch, opens a NEW tab on `/`, and validates the full operator vs anonymous experience: operator view shows header health dot + "{n} unreviewed"; board lists real reviewed roles sorted by fit; filter/sort/search/select all work; detail shows the full review with honest-null sections hidden and the fit ring color matching the score; profile modal + résumé generate→download path (operator) work. Then validate the anonymous view (signed out): board + reviews visible read-only, résumé/profile prompt sign-in, no operator signals. Compare against `docs/superpowers/specs/rolefit-reference.dc.html` and the spec. Report pass/fail + discrepancies; fix and re-validate until it matches. Only then commit. (If no logged-in session is available, validate the anonymous + structural views fully and flag the operator-only signals/résumé/save paths for manual confirmation.)

- [ ] **Step 6: Commit**

```bash
git add dashboard
git commit -m "feat(dashboard): operator signals + integration cleanup

Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC"
```

---

## Post-implementation notes

- **Backfill:** after deploying, run the reviewer (`python -m reviewer`) so existing reviews repopulate the new columns (the `fit_score IS NULL` predicate selects them), subject to `REVIEW_MAX_JOBS_PER_RUN` — may take several runs for a large backlog.
- **Migration:** apply `migrations/2026-06-26-rolefit-fields.sql` to the live Supabase DB before deploying the reviewer/dashboard.
- **Env:** set `OPENROUTER_API_KEY` in the dashboard's Vercel env (résumé route).
- **Design parity:** `tintMode`/`density`/`defaultSort` were design editor props; default to `subtle`/`comfortable`/`match` (not exposed as settings unless later wanted).
