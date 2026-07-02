# Company Red-Flag Enum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the company reviewer's free-text `red_flags` with a bounded `{category, note}` enum, backfill existing rows deterministically, and surface un-categorized (`other`) flags on the analytics dashboard.

**Architecture:** The company reviewer (`company_discovery/`) emits `red_flags` as a list of `{category, note}` objects where `category` is one of 7 enum values (structured output enforces the enum). A pure keyword classifier (`company_discovery/reclassify.py`) backfills the ~1,580 existing free-text rows in place. The dashboard aggregates by category and adds a table of `other` notes so new enum candidates are visible.

**Tech Stack:** Python 3 + pydantic (reviewer), psycopg (DB), Next.js + TypeScript + postgres.js + recharts (dashboard), pytest + vitest (tests).

## Global Constraints

- **Scope:** company red flags only (`company_reviews.red_flags`). Do NOT touch job red flags (`job_reviews.red_flags`), `JobDetail.tsx`, or the job-detail queries in `dashboard/lib/queries.ts`.
- **No DDL:** `red_flags` stays `JSONB`. No `ALTER TABLE`, no new migration file. Do not edit already-applied migrations.
- **Enum values (exact, 7):** `consulting_agency`, `defense_military`, `non_tech`, `unknown_unverified`, `early_stage_risk`, `values_mismatch`, `other`.
- **Match existing style:** `Literal[tuple(...)]` enum pattern (as in `reviewer/schemas.py`); dashboard card chrome from `dashboard/components/analytics/Chart.tsx`; inline `sql\`...\`` thunks run via `seq(...)` in `metrics.ts`.
- **Python tests:** run with `python3 -m pytest` (no venv). The tasks here are pure-function tests needing no DB.
- **Dashboard tests/build:** `cd dashboard && npx vitest run <file>` and `cd dashboard && npm run build`.

## File Structure

- `company_discovery/schemas.py` — enum constants + `RedFlag` model + updated `CompanyReviewResult` (Task 1).
- `schema.sql` — doc comment on the company_reviews `red_flags` shape (Task 1).
- `company_discovery/llm.py` — rewritten `red_flags` prompt block (Task 2).
- `company_discovery/reclassify.py` — new: classifier + idempotent backfill runner (Task 3).
- `dashboard/lib/redFlags.ts` — new shared: `RedFlag` type, labels, `redFlagLabel`, `redFlagCategoryLabel` (Task 4).
- `dashboard/lib/metrics.ts` — category aggregation + `otherRedFlags` query (Task 5).
- `dashboard/components/analytics/Chart.tsx` — new `SimpleTableCard` (Task 6).
- `dashboard/components/analytics/BreakdownsSection.tsx` — relabeled chart + new table (Task 6).
- `dashboard/lib/types.ts` + `dashboard/components/companies/CompanyCard.tsx` — read-side type + render (Task 7).
- Tests: `tests/test_company_discovery_schemas.py` (extend), `tests/test_reclassify.py` (new), `dashboard/lib/redFlags.test.ts` (new).

---

### Task 1: Enum + RedFlag schema

**Files:**
- Modify: `company_discovery/schemas.py` (whole file)
- Modify: `schema.sql` (company_reviews `red_flags` line)
- Test: `tests/test_company_discovery_schemas.py`

**Interfaces:**
- Produces: `RED_FLAG_CATEGORIES: list[str]`, `RedFlagCategory` (Literal), `class RedFlag(BaseModel)` with `category: RedFlagCategory` and `note: str | None = None`, and `CompanyReviewResult.red_flags: list[RedFlag]`.

- [ ] **Step 1: Update the two existing schema tests to the new shape and add new ones**

Replace the body of `tests/test_company_discovery_schemas.py` `test_result_full` and add three tests. Full new content of the relevant parts:

```python
import hashlib

import pytest
from pydantic import ValidationError

from company_discovery.profile import compute_company_profile_version
from company_discovery.schemas import CompanyReviewResult, RedFlag


def test_version_is_sha256_of_instructions():
    assert compute_company_profile_version("prefer devtools") == \
        hashlib.sha256(b"prefer devtools").hexdigest()
    assert compute_company_profile_version(None) == hashlib.sha256(b"").hexdigest()


def test_result_parses_with_defaults():
    r = CompanyReviewResult.model_validate({"verdict": "unknown"})
    assert r.verdict == "unknown"
    assert r.confidence == "low"
    assert r.tech_tags == [] and r.red_flags == []
    assert r.industry is None


def test_result_full():
    r = CompanyReviewResult.model_validate({
        "verdict": "exclude", "confidence": "high", "reasoning": "defense",
        "industry": "industrial_hardware",
        "industry_subcategory": "automotive_aerospace_defense",
        "tech_tags": ["c++"],
        "red_flags": [{"category": "defense_military", "note": "defense industry"}],
    })
    assert r.verdict == "exclude" and r.tech_tags == ["c++"]
    assert r.red_flags[0].category == "defense_military"
    assert r.red_flags[0].note == "defense industry"


def test_red_flag_note_defaults_none():
    rf = RedFlag.model_validate({"category": "consulting_agency"})
    assert rf.note is None


def test_red_flag_rejects_unknown_category():
    with pytest.raises(ValidationError):
        RedFlag.model_validate({"category": "banana"})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_company_discovery_schemas.py -q`
Expected: FAIL — `ImportError: cannot import name 'RedFlag'` (and/or validation failures).

- [ ] **Step 3: Rewrite `company_discovery/schemas.py`**

Full new file content:

```python
from typing import Literal

from pydantic import BaseModel, Field

from reviewer.schemas import Industry, Subcategory

# Company red-flag taxonomy. `other` is the escape hatch: the model (and the
# backfill in reclassify.py) route anything that fits no concrete category here,
# with the specific reason in `note`. Recurring `other` notes surface on the
# analytics dashboard as candidates for promotion to a real category.
RED_FLAG_CATEGORIES: list[str] = [
    "consulting_agency", "defense_military", "non_tech",
    "unknown_unverified", "early_stage_risk", "values_mismatch", "other",
]
RedFlagCategory = Literal[tuple(RED_FLAG_CATEGORIES)]


class RedFlag(BaseModel):
    category: RedFlagCategory
    note: str | None = None


class CompanyReviewResult(BaseModel):
    verdict: Literal["include", "exclude", "unknown"]
    confidence: Literal["low", "medium", "high"] = "low"
    reasoning: str = ""
    industry: Industry | None = None
    industry_subcategory: Subcategory | None = None
    tech_tags: list[str] = Field(default_factory=list)
    red_flags: list[RedFlag] = Field(default_factory=list)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_company_discovery_schemas.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Add a doc comment to `schema.sql`**

Use this exact two-line anchor (unique to the `company_reviews` table) and insert a comment above `red_flags`:

Find:
```sql
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
```
Replace with:
```sql
  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of {category, note}: category is one of RED_FLAG_CATEGORIES
  -- (company_discovery/schemas.py); note is optional free text (required for
  -- category='other'). Backfilled by company_discovery/reclassify.py.
  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
```

- [ ] **Step 6: Commit**

```bash
git add company_discovery/schemas.py schema.sql tests/test_company_discovery_schemas.py
git commit -m "feat(company_discovery): {category, note} red-flag enum schema"
```

---

### Task 2: Reviewer prompt emits the enum

**Files:**
- Modify: `company_discovery/llm.py:15-29` (the `_INSTRUCTIONS` constant)
- Test: `tests/test_company_discovery_llm.py` (new)

**Interfaces:**
- Consumes: `RED_FLAG_CATEGORIES` from Task 1.
- Produces: `_INSTRUCTIONS` string that names every category and instructs the `{category, note}` shape.

- [ ] **Step 1: Write the failing test**

Create `tests/test_company_discovery_llm.py`:

```python
from company_discovery.llm import _INSTRUCTIONS
from company_discovery.schemas import RED_FLAG_CATEGORIES


def test_instructions_document_every_category():
    for category in RED_FLAG_CATEGORIES:
        assert category in _INSTRUCTIONS, f"prompt is missing category {category}"


def test_instructions_ask_for_empty_list_when_none():
    assert "[]" in _INSTRUCTIONS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_company_discovery_llm.py -q`
Expected: FAIL — categories like `consulting_agency` not present in the current prompt.

- [ ] **Step 3: Rewrite the `red_flags` line in `_INSTRUCTIONS`**

In `company_discovery/llm.py`, replace this final line of the `_INSTRUCTIONS` string:

```python
    "- red_flags: short reasons the candidate might avoid it; [] if none."
```

with:

```python
    "- red_flags: a list of {category, note} objects for reasons the candidate "
    "might avoid this company; [] if none. Choose category from:\n"
    "  * consulting_agency: consulting, agency, staffing, recruiting, advisory, "
    "or outsourcing/IT-services shop.\n"
    "  * defense_military: defense, military, aerospace-defense, weapons, "
    "intelligence, or surveillance work.\n"
    "  * non_tech: not a software/tech company; minimal in-house engineering.\n"
    "  * unknown_unverified: you do not recognize the company / cannot verify it "
    "against the preferences.\n"
    "  * early_stage_risk: very early-stage, limited track record, tiny "
    "engineering footprint.\n"
    "  * values_mismatch: ethical/values conflict (e.g. cannabis, fossil fuel, "
    "gambling, predatory lending, tobacco).\n"
    "  * other: none of the above — put the specific reason in note.\n"
    "  Set note to the specific reason (required for 'other'; optional otherwise)."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_company_discovery_llm.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add company_discovery/llm.py tests/test_company_discovery_llm.py
git commit -m "feat(company_discovery): prompt for {category, note} red flags"
```

---

### Task 3: Deterministic backfill classifier + runner

**Files:**
- Create: `company_discovery/reclassify.py`
- Test: `tests/test_reclassify.py`

**Interfaces:**
- Consumes: `RedFlag` from Task 1; `job_discovery.db.connect()` (returns a `psycopg.Connection` with `dict_row` factory; DSN from `DATABASE_URL`).
- Produces:
  - `classify_red_flag(text: str) -> RedFlag | None` — `None` for non-flags ("no red flags"/"none"/empty).
  - `reclassify_flags(flags: list) -> list[dict]` — maps a whole `red_flags` array; dict elements pass through (idempotent); drops non-flags.
  - `main()` — the `python -m company_discovery.reclassify` runner.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_reclassify.py`:

```python
import pytest

from company_discovery.reclassify import classify_red_flag, reclassify_flags


@pytest.mark.parametrize("text,category", [
    ("Consulting firm", "consulting_agency"),
    ("consulting/staffing agency", "consulting_agency"),
    ("Defense industry involvement", "defense_military"),
    ("aerospace/defense contractor", "defense_military"),
    ("not a tech company", "non_tech"),
    ("unknown company, cannot verify preferences", "unknown_unverified"),
    ("very early-stage startup with limited public track record", "early_stage_risk"),
    ("cannabis industry may not fit values", "values_mismatch"),
    ("predatory lending practices", "values_mismatch"),
    ("some entirely novel concern", "other"),
])
def test_classify_categories(text, category):
    rf = classify_red_flag(text)
    assert rf is not None
    assert rf.category == category
    assert rf.note == text.strip()


def test_defense_precedes_consulting():
    assert classify_red_flag("defense/intelligence consulting").category == "defense_military"


@pytest.mark.parametrize("text", [
    "no obvious red flags from known information", "none", "   ",
])
def test_non_flags_are_dropped(text):
    assert classify_red_flag(text) is None


def test_reclassify_flags_maps_and_drops():
    out = reclassify_flags(["Consulting firm", "no red flags", "defense industry"])
    assert out == [
        {"category": "consulting_agency", "note": "Consulting firm"},
        {"category": "defense_military", "note": "defense industry"},
    ]


def test_reclassify_flags_idempotent_on_objects():
    already = [{"category": "consulting_agency", "note": "Consulting firm"}]
    assert reclassify_flags(already) == already


def test_reclassify_flags_handles_empty_and_none():
    assert reclassify_flags([]) == []
    assert reclassify_flags(None) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_reclassify.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'company_discovery.reclassify'`.

- [ ] **Step 3: Create `company_discovery/reclassify.py`**

```python
"""Backfill: convert company_reviews.red_flags from free-text strings to the
{category, note} enum shape using deterministic keyword rules (no LLM).

Run against a database:  DATABASE_URL=... python -m company_discovery.reclassify
"""
import logging
import re

from psycopg.types.json import Json

from company_discovery.schemas import RedFlag

log = logging.getLogger("reclassify")

# Ordered (pattern, category) rules — FIRST match wins. defense_military is ahead
# of consulting_agency on purpose so "defense/intelligence consulting" routes to
# defense (the narrower, more severe signal).
_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"defense|military|aerospace|weapon|missile|intelligence|surveillance|warfare"),
     "defense_military"),
    (re.compile(r"consult|agency|staffing|recruit|advisory|outsourc|contracting firm"),
     "consulting_agency"),
    (re.compile(r"cannabis|fossil fuel|gambling|predatory|payday|tobacco|vaping"),
     "values_mismatch"),
    (re.compile(r"non-?tech|not a (software|tech|technology)"),
     "non_tech"),
    (re.compile(r"unknown|unrecognized|cannot verify|can't verify|no real knowledge"),
     "unknown_unverified"),
    (re.compile(r"early-?stage|limited (public )?track record|small.*(tech|engineering) footprint|very small"),
     "early_stage_risk"),
]
# Strings that are not real red flags — dropped entirely.
_DROP = re.compile(r"no (obvious )?red flags?|^\s*none\s*$")


def classify_red_flag(text: str) -> RedFlag | None:
    t = text.strip().lower()
    if not t or _DROP.search(t):
        return None
    for pattern, category in _RULES:
        if pattern.search(t):
            return RedFlag(category=category, note=text.strip())
    return RedFlag(category="other", note=text.strip())


def reclassify_flags(flags: list) -> list[dict]:
    """Map a red_flags array to the new shape. Idempotent: dict elements (already
    migrated) pass through unchanged. Non-flag strings are dropped."""
    out: list[dict] = []
    for f in flags or []:
        if isinstance(f, dict):
            out.append(f)
            continue
        rf = classify_red_flag(str(f))
        if rf is not None:
            out.append(rf.model_dump())
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id, company_id, red_flags FROM company_reviews")
            rows = cur.fetchall()
        updated = 0
        for r in rows:
            new = reclassify_flags(r["red_flags"])
            if new == (r["red_flags"] or []):
                continue  # already migrated / nothing to change
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE company_reviews SET red_flags = %s "
                    "WHERE user_id = %s AND company_id = %s",
                    (Json(new), r["user_id"], r["company_id"]),
                )
            updated += 1
        conn.commit()
        log.info("reclassified red_flags on %s of %s company_reviews rows", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_reclassify.py -q`
Expected: PASS (all parametrized cases).

- [ ] **Step 5: Commit**

```bash
git add company_discovery/reclassify.py tests/test_reclassify.py
git commit -m "feat(company_discovery): deterministic red-flag backfill classifier"
```

---

### Task 4: Shared dashboard red-flag module

**Files:**
- Create: `dashboard/lib/redFlags.ts`
- Test: `dashboard/lib/redFlags.test.ts`

**Interfaces:**
- Produces:
  - `type RedFlagCategory` (7-value union).
  - `interface RedFlag { category: RedFlagCategory; note: string | null }`.
  - `RED_FLAG_LABELS: Record<RedFlagCategory, string>`.
  - `redFlagLabel(flag: RedFlag | string): string` — label for concrete categories, `note` for `other`, passthrough for legacy strings.
  - `redFlagCategoryLabel(key: string): string` — maps a raw category key (from the metrics query) to its label; unknown keys pass through.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/redFlags.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { redFlagLabel, redFlagCategoryLabel } from "@/lib/redFlags";

describe("redFlagLabel", () => {
  test("concrete category maps to label", () => {
    expect(redFlagLabel({ category: "consulting_agency", note: null })).toBe("Consulting / agency");
  });
  test("other uses the note", () => {
    expect(redFlagLabel({ category: "other", note: "fossil fuel exposure" })).toBe("fossil fuel exposure");
  });
  test("other with no note falls back", () => {
    expect(redFlagLabel({ category: "other", note: null })).toBe("Other");
  });
  test("legacy bare string passes through", () => {
    expect(redFlagLabel("consulting firm")).toBe("consulting firm");
  });
});

describe("redFlagCategoryLabel", () => {
  test("maps a category key to its label", () => {
    expect(redFlagCategoryLabel("defense_military")).toBe("Defense / military");
  });
  test("unknown key passes through unchanged", () => {
    expect(redFlagCategoryLabel("weird_new_key")).toBe("weird_new_key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/redFlags.test.ts`
Expected: FAIL — cannot resolve `@/lib/redFlags`.

- [ ] **Step 3: Create `dashboard/lib/redFlags.ts`**

```typescript
export type RedFlagCategory =
  | "consulting_agency"
  | "defense_military"
  | "non_tech"
  | "unknown_unverified"
  | "early_stage_risk"
  | "values_mismatch"
  | "other";

export interface RedFlag {
  category: RedFlagCategory;
  note: string | null;
}

export const RED_FLAG_LABELS: Record<RedFlagCategory, string> = {
  consulting_agency: "Consulting / agency",
  defense_military: "Defense / military",
  non_tech: "Not a tech company",
  unknown_unverified: "Unknown / unverified",
  early_stage_risk: "Early-stage risk",
  values_mismatch: "Values mismatch",
  other: "Other",
};

// Human-readable text for one red flag. For `other`, prefer the free-text note.
// Tolerant of legacy bare-string flags (rows not yet backfilled).
export function redFlagLabel(flag: RedFlag | string): string {
  if (typeof flag === "string") return flag;
  if (flag.category === "other") return flag.note ?? "Other";
  return RED_FLAG_LABELS[flag.category] ?? flag.category;
}

// Label for a raw category key (as returned by the metrics aggregation query).
// Unknown keys pass through so a not-yet-labeled category is still visible.
export function redFlagCategoryLabel(key: string): string {
  return RED_FLAG_LABELS[key as RedFlagCategory] ?? key;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/redFlags.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/redFlags.ts dashboard/lib/redFlags.test.ts
git commit -m "feat(dashboard): shared red-flag category labels + helpers"
```

---

### Task 5: Metrics — aggregate by category + `other` notes query

**Files:**
- Modify: `dashboard/lib/metrics.ts` (the `Distributions` interface ~line 243-250, the `getDistributions` `seq([...])` block ~line 254-330)

**Interfaces:**
- Consumes: existing `Bar` interface, `sql`, `seq`, `TOP_N` in `metrics.ts`.
- Produces: `Distributions.topRedFlags` now holds **raw category keys** as `label`; new `Distributions.otherRedFlags: Bar[]` holds `other` `note` text.

- [ ] **Step 1: Add `otherRedFlags` to the `Distributions` interface**

In `dashboard/lib/metrics.ts`, change:

```typescript
  topTechTags: Bar[]; topRedFlags: Bar[];
}
```

to:

```typescript
  topTechTags: Bar[]; topRedFlags: Bar[]; otherRedFlags: Bar[];
}
```

- [ ] **Step 2: Replace the `topRedFlags` query and add the `otherRedFlags` query**

In the `seq([...])` array, replace this thunk (currently last):

```typescript
    () => sql`SELECT f AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements_text(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY f ORDER BY count DESC LIMIT ${TOP_N}`,
```

with these two thunks (category aggregation, tolerant of un-backfilled string rows; plus the `other`-notes table):

```typescript
    () => sql`SELECT CASE WHEN jsonb_typeof(f) = 'object' THEN f->>'category' ELSE 'other' END AS label,
               count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY 1 ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT COALESCE(f->>'note', '(no note)') AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
          AND jsonb_typeof(f) = 'object' AND f->>'category' = 'other'
        GROUP BY 1 ORDER BY count DESC LIMIT ${TOP_N}`,
```

- [ ] **Step 3: Add `otherRedFlags` to the destructuring and the return**

In the destructuring list at the top of `getDistributions` (`const [ ... ] = await seq([`), change the tail:

```typescript
    companiesByAts, companiesBySource, includedByIndustry, topTechTags, topRedFlags,
  ] = await seq([
```

to:

```typescript
    companiesByAts, companiesBySource, includedByIndustry, topTechTags, topRedFlags,
    otherRedFlags,
  ] = await seq([
```

Then in the `return { ... }`, change:

```typescript
    includedByIndustry: asBars(includedByIndustry), topTechTags: asBars(topTechTags),
    topRedFlags: asBars(topRedFlags),
  };
```

to:

```typescript
    includedByIndustry: asBars(includedByIndustry), topTechTags: asBars(topTechTags),
    topRedFlags: asBars(topRedFlags), otherRedFlags: asBars(otherRedFlags),
  };
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no errors). BreakdownsSection still compiles because it does not yet reference `otherRedFlags`.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/metrics.ts
git commit -m "feat(dashboard): aggregate red flags by category + other-notes query"
```

---

### Task 6: `SimpleTableCard` + wire the analytics breakdowns

**Files:**
- Modify: `dashboard/components/analytics/Chart.tsx` (add `SimpleTableCard`)
- Modify: `dashboard/components/analytics/BreakdownsSection.tsx` (relabel chart, add table)

**Interfaces:**
- Consumes: `Bar` (as `BarDatum`), the file-local `Card`/`EMPTY` styles in `Chart.tsx`; `redFlagCategoryLabel` from Task 4; `Distributions.topRedFlags`/`otherRedFlags` from Task 5.
- Produces: `SimpleTableCard({ title, data, empty? })` exported from `Chart.tsx`.

- [ ] **Step 1: Add `SimpleTableCard` to `Chart.tsx`**

Append to `dashboard/components/analytics/Chart.tsx` (after `SimpleBarCard`):

```typescript
export function SimpleTableCard(
  { title, data, empty = "No data yet." }:
  { title: string; data: BarDatum[]; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <div style={{ paddingBottom: "8px" }}>
        {data.map((row, i) => (
          <div key={`${row.label}-${i}`} style={{
            display: "flex", justifyContent: "space-between", gap: "12px",
            fontSize: "12.5px", padding: "6px 2px",
            borderBottom: i < data.length - 1 ? "1px solid #f0f2f6" : "none",
          }}>
            <span style={{ color: "#5b6472", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.label}
            </span>
            <span style={{ color: "#161d29", fontWeight: 700, flexShrink: 0 }}>{row.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Update `BreakdownsSection.tsx` imports and the COMPANIES group**

Change the import line:

```typescript
import { SimpleBarCard } from "@/components/analytics/Chart";
```

to:

```typescript
import { SimpleBarCard, SimpleTableCard } from "@/components/analytics/Chart";
import { redFlagCategoryLabel } from "@/lib/redFlags";
```

At the top of the `BreakdownsSection` function body (before `return`), add:

```typescript
  const redFlagBars = d.topRedFlags.map((b) => ({ ...b, label: redFlagCategoryLabel(b.label) }));
```

In the COMPANIES `<Group>`, replace:

```tsx
        <SimpleBarCard title="Top red flags" data={d.topRedFlags} color="#e0607e" />
```

with:

```tsx
        <SimpleBarCard title="Top red flags" data={redFlagBars} color="#e0607e" />
        <SimpleTableCard title="Uncategorized red flags (other)" data={d.otherRedFlags} />
```

- [ ] **Step 3: Typecheck + run the existing dashboard test suite**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: PASS (tsc clean; all vitest suites green, including `redFlags.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/analytics/Chart.tsx dashboard/components/analytics/BreakdownsSection.tsx
git commit -m "feat(dashboard): category-labeled red-flag chart + other-notes table"
```

---

### Task 7: Read-side type + company card render

**Files:**
- Modify: `dashboard/lib/types.ts` (top import + `CompanyReviewRow.red_flags` at ~line 204)
- Modify: `dashboard/components/companies/CompanyCard.tsx:15`

**Interfaces:**
- Consumes: `RedFlag` + `redFlagLabel` from Task 4.
- Produces: `CompanyReviewRow.red_flags: RedFlag[] | null`; card renders labels.

- [ ] **Step 1: Change the `CompanyReviewRow.red_flags` type**

At the top of `dashboard/lib/types.ts`, add the import (place with the other imports; if the file has no imports yet, add it as the first line):

```typescript
import type { RedFlag } from "@/lib/redFlags";
```

Then change **only** the `red_flags` field inside `interface CompanyReviewRow` (the one at ~line 204, NOT the two earlier job-side `red_flags` fields):

```typescript
  red_flags: string[] | null;
```

to:

```typescript
  red_flags: RedFlag[] | null;
```

- [ ] **Step 2: Render red flags via `redFlagLabel` in `CompanyCard.tsx`**

Add the import at the top of `dashboard/components/companies/CompanyCard.tsx`:

```typescript
import { redFlagLabel } from "@/lib/redFlags";
```

Change line 15:

```typescript
  const tags = [...(company.tech_tags ?? []), ...(company.red_flags ?? [])];
```

to:

```typescript
  const tags = [...(company.tech_tags ?? []), ...(company.red_flags ?? []).map(redFlagLabel)];
```

- [ ] **Step 3: Typecheck + full dashboard test suite**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: PASS. (`getCompanyReviews` in `queries.ts` returns `rows as unknown as CompanyReviewRow[]`, so no query change is needed and no cast breaks.)

- [ ] **Step 4: Build the dashboard**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/components/companies/CompanyCard.tsx
git commit -m "feat(dashboard): render company red flags from {category, note}"
```

---

### Task 8: Run the production backfill

**Files:** none (operational task, run after Tasks 1-7 are merged/deployed).

- [ ] **Step 1: Dry-run count locally (optional sanity check)**

The runner is idempotent and only updates rows whose shape changes. Before running against prod, confirm the module imports cleanly:

Run: `python3 -c "import company_discovery.reclassify as r; print(r.classify_red_flag('Consulting firm'))"`
Expected: prints `category='consulting_agency' note='Consulting firm'`.

- [ ] **Step 2: Run the backfill against production**

Run (with the production `DATABASE_URL` in the environment):
`DATABASE_URL="<prod-dsn>" python3 -m company_discovery.reclassify`
Expected log line: `reclassified red_flags on N of M company_reviews rows` (N ≈ number of rows that still had string flags).

- [ ] **Step 3: Verify on the analytics dashboard**

Load `/analytics`. The "Top red flags" chart now shows ≤7 category bars (Consulting / agency, Defense / military, …). The "Uncategorized red flags (other)" table lists the remaining free-text notes with counts. Re-running the backfill a second time should report `0 of M` rows updated (idempotent).

---

## Self-Review

**Spec coverage:**
- Enum (7 values) → Task 1. ✅
- `{category, note}` schema → Task 1. ✅
- Reviewer prompt emits enum + `[]` when none → Task 2. ✅
- Deterministic keyword backfill, drops "no red flags", idempotent → Task 3; run in prod → Task 8. ✅
- `schema.sql` doc comment; no DDL / no migration edit → Task 1 (Global Constraints). ✅
- Dashboard: category aggregation (tolerant), `other`-notes query → Task 5; `SimpleTableCard` + relabeled chart + table → Task 6. ✅
- Shared `redFlags.ts` labels/helpers → Task 4. ✅
- `CompanyCard` + `types.ts` read-side → Task 7. ✅
- Tests: classifier (Task 3), schema (Task 1), `redFlags` helper (Task 4), prompt-sync (Task 2). ✅
- Deploy sequence (tolerant query → deploy → backfill) → Global Constraints + Task 8. ✅
- Job red flags out of scope → Global Constraints. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**Type consistency:** `RedFlagCategory` (7 values) identical in Python (Task 1) and TS (Task 4). `RedFlag { category, note }` consistent across Python model, TS interface, and JSONB shape. `redFlagLabel` (per-flag, Task 4/7) vs `redFlagCategoryLabel` (per-key, Task 4/6) used in the right places. `otherRedFlags` named identically in `metrics.ts` (Task 5) and `BreakdownsSection.tsx` (Task 6). ✅

**Note on metrics SQL testing:** the spec mentioned a metrics query-shape test, but `metrics.ts` executes inline tagged-template `sql` (no pure builder like `jobsQuery.ts`), so a unit test would require a live DB — inconsistent with the rest of that file, which has no unit tests. The real logic (category→label mapping, `other`→note, legacy tolerance) is covered by `redFlags.test.ts` (Task 4); the SQL is verified by `tsc`, `npm run build`, and the Task 8 dashboard check. This is a deliberate, documented deviation, not a gap.
