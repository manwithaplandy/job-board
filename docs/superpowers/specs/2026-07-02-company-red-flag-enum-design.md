# Company red-flag enum — design

**Date:** 2026-07-02
**Status:** Approved, pending implementation plan
**Scope:** Company-level red flags only (`company_reviews.red_flags`). Job-level red flags (`job_reviews.red_flags`) are explicitly out of scope.

## Problem

The company reviewer (`company_discovery/`) emits `red_flags` as a free-text `list[str]`. In production this has produced **1,580 flag instances across 968 distinct strings**, but the distinct values are overwhelmingly noisy phrasings of a small set of ideas. On the analytics dashboard's "Top red flags" chart this shows up as many near-duplicate bars — e.g. "Consulting firm" (185), "consulting" (63), "consulting agency" (33), "consulting/agency" (15), "consulting/agency firm" (11)… all the same concept. Because the values are free text, they cannot be aggregated, and there is no mechanism to notice when a genuinely new kind of red flag starts appearing.

Job-level red flags (`job_reviews.red_flags`) are a separate source: 790 instances, 773 distinct (~99% unique). They are per-role specifics ("no generative AI work", "no salary listed", "location mismatch", "requires PhD", "contract role"). They do not cluster and are **not** part of this work.

## Goal

Convert company red flags from free text to a bounded enum, while:
1. keeping an escape hatch (`other` + free text) for values that don't fit, so the model is never forced into a wrong bucket, and
2. surfacing the `other` free-text values on the analytics dashboard so we can tell when a new enum value is worth adding.

## Decisions (settled during brainstorming)

- **Source:** company red flags only.
- **Representation:** each flag becomes an object `{category, note}` — a category enum plus optional free-text detail — rather than an enum-only list or dual parallel fields. This keeps the specific phrasing (useful on the company card and for `other` triage) while giving a clean field to aggregate on.
- **Backfill:** deterministic keyword remap of the ~1,580 existing rows (no LLM cost, no nondeterminism), with unmatched rows falling to `other` carrying the original text as `note`.

## The enum

Seven values. Definitions live in `company_discovery/schemas.py` (Python, enforced at inference by structured output); display labels live in a new shared `dashboard/lib/redFlags.ts`.

| key | covers | display label |
|---|---|---|
| `consulting_agency` | consulting / agency / staffing / recruiting / advisory / outsourcing / IT-services shops | Consulting / agency |
| `defense_military` | defense / military / aerospace-defense / weapons / intelligence / surveillance / warfare | Defense / military |
| `non_tech` | not a software/tech company; minimal in-house engineering | Not a tech company |
| `unknown_unverified` | company not recognized; cannot verify against preferences | Unknown / unverified |
| `early_stage_risk` | very early-stage, limited public track record, tiny engineering footprint | Early-stage risk |
| `values_mismatch` | ethical/values conflicts — cannabis, fossil fuel, gambling, predatory lending, tobacco | Values mismatch |
| `other` | anything that fits none of the above; **`note` is required** | Other |

Rationale for coverage: `consulting_agency` + `defense_military` alone account for roughly 85% of all instances, so this set absorbs the bulk. Anything genuinely new lands in `other` and is surfaced for review (see Dashboard).

**Judgment calls (approved):**
- Government / intelligence / surveillance are folded into `defense_military` rather than a separate `government` value. If non-defense government flags become common, the `other` table will surface them.
- For a flag that mentions both defense and consulting (e.g. "defense/intelligence consulting"), precedence is **`defense_military` first** — it is the narrower, more severe signal and less prone to false positives.

## Data model

`company_reviews.red_flags` stays JSONB and stays a list. Each element changes from a string to an object. **No DDL change** — the column type is already JSONB. `schema.sql` gets a comment documenting the new element shape. (The already-applied `migrations/2026-06-26-company-discovery.sql` is left untouched — we don't edit applied migrations.)

```python
# company_discovery/schemas.py
RED_FLAG_CATEGORIES: list[str] = [
    "consulting_agency", "defense_military", "non_tech",
    "unknown_unverified", "early_stage_risk", "values_mismatch", "other",
]
RedFlagCategory = Literal[tuple(RED_FLAG_CATEGORIES)]

class RedFlag(BaseModel):
    category: RedFlagCategory
    note: str | None = None   # original/extra detail; expected present when category == "other"

class CompanyReviewResult(BaseModel):
    ...
    red_flags: list[RedFlag] = Field(default_factory=list)
```

`note` is optional for the six concrete categories (lets the model retain the specific phrasing, which the company card can display) and expected-present for `other`. JSON Schema can't express "required only when category == other", so this is enforced softly via the prompt and always set by the backfill for `other`.

`company_discovery/db.py` needs no structural change: `red_flags` is already in `_JSONB_COLUMNS`, and pydantic `model_dump()` will serialize the list of objects. Confirm the write path dumps `RedFlag` objects to plain dicts before the `Json()` wrap.

## Reviewer prompt (`company_discovery/llm.py`)

Rewrite the single `red_flags` instruction line into a short block that:
- lists the seven categories, each with a one-line definition;
- instructs the model to emit `{category, note}` per flag;
- says to use `other` with a short `note` **only** when nothing else fits;
- instructs it to emit `[]` when there are no red flags (this removes the "no obvious red flags" / "none" strings currently polluting the data).

Structured output (`response_format=CompanyReviewResult`) enforces the enum automatically — the same mechanism already used for `verdict` and `confidence`. No client-code change beyond the schema.

## Backfill (`company_discovery/reclassify.py`, new)

Pure function:

```python
def classify_red_flag(text: str) -> RedFlag | None:
    # returns None for "no red flags" / "none" style strings (dropped),
    # otherwise a RedFlag with note=original text for traceability.
```

Implementation: an **ordered** list of `(compiled_regex, category)` rules, first match wins, precedence:
`defense_military → consulting_agency → values_mismatch → non_tech → unknown_unverified → early_stage_risk`, else `other`.

- `defense_military`: `defense|military|aerospace|weapon|missile|intelligence|surveillance|warfare` (deliberately **not** bare "government", so "government consulting" still routes to consulting).
- `consulting_agency`: `consult|agency|staffing|recruit|advisory|outsourc|contracting firm`
- `values_mismatch`: `cannabis|fossil fuel|gambling|predatory|payday|tobacco|vaping`
- `non_tech`: `non-?tech|not a (software|tech)|not a technology`
- `unknown_unverified`: `unknown|unrecognized|cannot verify|can't verify|no real knowledge`
- `early_stage_risk`: `early-?stage|limited (public )?track record|small.*(tech|engineering) footprint|very small`
- drop: `no (obvious )?red flags?|^none$`

For matched concrete categories, `note` retains the **original** flag text (so no detail is lost and the company card still shows meaningful text). For `other`, `note` is the original text.

Runner: `python -m company_discovery.reclassify` iterates every `company_reviews` row, maps `list[str] → list[RedFlag]` (dropping `None`s), and writes the JSONB back via the existing psycopg connection helper. **Idempotent** — a row whose elements are already objects is left unchanged (detect via element type). Log a summary: rows updated, per-category counts, count routed to `other`.

## Dashboard

### `dashboard/lib/redFlags.ts` (new, shared server + client)
- `RedFlagCategory` union type (mirrors the Python list).
- `RED_FLAG_LABELS: Record<RedFlagCategory, string>` (the display labels above).
- `redFlagLabel(flag)` helper: returns the label for a concrete category; for `other` returns the `note`; tolerant of a legacy bare string (returns the string).

### `dashboard/lib/metrics.ts`
- `topRedFlags` query changes to group by **category**, tolerant of un-backfilled stragglers:
  ```sql
  SELECT CASE WHEN jsonb_typeof(f) = 'object' THEN f->>'category' ELSE 'other' END AS label,
         count(*)::int AS count
  FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
  WHERE cr.user_id = $userId::uuid
  GROUP BY 1 ORDER BY count DESC;
  ```
  (Labels are mapped to human text in the component via `RED_FLAG_LABELS`; the query returns raw category keys.)
- New `otherRedFlags` query for the triage table:
  ```sql
  SELECT COALESCE(f->>'note', '(no note)') AS label, count(*)::int AS count
  FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
  WHERE cr.user_id = $userId::uuid
    AND jsonb_typeof(f) = 'object' AND f->>'category' = 'other'
  GROUP BY 1 ORDER BY count DESC LIMIT 20;
  ```
- Add both to the `Distributions` interface and the `seq([...])` batch.

### `dashboard/components/analytics/Chart.tsx`
- Add `SimpleTableCard` — a card rendering label + count rows (a simple two-column table), matching existing card chrome (`CARD`/`TITLE`/`EMPTY` styles). This is the "table" for catching new enum values.

### `dashboard/components/analytics/BreakdownsSection.tsx`
- "Top red flags" bar chart: feed it category-labelled data (map keys → `RED_FLAG_LABELS`).
- Add a "Uncategorized red flags (other)" `SimpleTableCard` fed by `otherRedFlags`, in the COMPANIES group.

### `dashboard/components/companies/CompanyCard.tsx` + `dashboard/lib/types.ts`
- `CompanyReviewRow.red_flags` type changes from `string[] | null` to `RedFlag[] | null` (import the shape from `redFlags.ts` / a shared type).
- `getCompanyReviews` in `queries.ts` already selects `r.red_flags` raw — no query change; only the consuming type/render changes.
- The card currently spreads `red_flags` into a flat tag list alongside `tech_tags`. Change to render `redFlagLabel(flag)` per flag, tolerant of legacy strings.

## Testing

**Python**
- `tests/test_reclassify.py` (new): table-driven tests for `classify_red_flag` — at least one representative real string per category (drawn from the DB sample), the `other` fallback, and the dropped "no red flags" case. Assert precedence on a defense+consulting string.
- Extend `tests/test_company_discovery_schemas.py`: `CompanyReviewResult` accepts `red_flags` as a list of `{category, note}`; `category` outside the enum is rejected; `note` defaults to `None`.

**TypeScript**
- `redFlags.test.ts` (new): `redFlagLabel` returns the label for a concrete category, the `note` for `other`, and passes a legacy string through.
- A metrics query-shape test (in the style of the existing `jobsQuery.test.ts`) asserting the category-aggregation and `other`-notes SQL select the expected columns.

## Deploy sequence

Push-to-main auto-deploys reviewer + dashboard together (per deploy topology). There is no DDL migration to apply first. The dashboard queries are tolerant of the pre-backfill string shape, so there is no broken window.

1. Merge / push → reviewer starts emitting `{category, note}`; dashboard reads tolerant queries.
2. Run `python -m company_discovery.reclassify` against production to convert the ~1,580 existing rows so history is consistent.

## Files touched

- `company_discovery/schemas.py` — `RED_FLAG_CATEGORIES`, `RedFlagCategory`, `RedFlag`, updated `CompanyReviewResult.red_flags`.
- `company_discovery/llm.py` — rewritten `red_flags` prompt block.
- `company_discovery/reclassify.py` — new: `classify_red_flag` + `python -m` backfill runner.
- `company_discovery/db.py` — verify `RedFlag` objects serialize to dicts on write (likely no change).
- `schema.sql` — doc comment documenting the JSONB element shape.
- `dashboard/lib/redFlags.ts` — new shared type + labels + `redFlagLabel`.
- `dashboard/lib/metrics.ts` — category aggregation + `otherRedFlags` query + `Distributions`.
- `dashboard/lib/types.ts` — `CompanyReviewRow.red_flags` type.
- `dashboard/components/analytics/Chart.tsx` — `SimpleTableCard`.
- `dashboard/components/analytics/BreakdownsSection.tsx` — relabelled chart + new table.
- `dashboard/components/companies/CompanyCard.tsx` — render via `redFlagLabel`.
- Tests: `tests/test_reclassify.py`, `tests/test_company_discovery_schemas.py`, `dashboard/lib/redFlags.test.ts`, dashboard metrics query test.

## Out of scope

- Job-level red flags (`job_reviews.red_flags`).
- Any DDL / column-type change.
- Codegen to unify the Python enum and TS label map (intentional dual source of truth; 7 low-churn values, and the `other` table catches drift).
