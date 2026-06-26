# Profile Location Pre-Filter — Design

**Date:** 2026-06-25
**Status:** Approved

## Problem

The reviewer spends LLM tokens (stage-1 and stage-2) on every unreviewed open
job. Many of those jobs are in locations the operator would never consider, so
the spend is wasted. We want the operator to declare which locations they care
about on the profile page, and use that to pre-filter jobs *before* the AI runs.

## Goal

Add a multi-select location input to the profile page. The selected locations
form an **include-list** that:

1. Stops the reviewer from sending excluded-location jobs to the LLM (the core
   goal — save tokens), and
2. Hides excluded-location jobs from the dashboard list, so the board stays
   consistent with what the operator would consider.

## Decisions (from brainstorming)

- **Input:** a type-to-filter multi-select dropdown (like the existing
  `ModelPicker`), populated from the **distinct `location` strings actually
  present in the jobs DB**.
- **Matching:** a job is **kept** when `remote IS TRUE` **OR**
  `location = ANY(preferred_locations)` (exact-string match against the picked
  values). Blank/unknown location → **dropped**. Empty preference list → **no
  filtering** (today's behavior).
  - Exact match (not substring) because options come from the real stored
    values, so selections are predictable. The picker shows each value with its
    open-job count so the operator can see and pick variants.
- **Remote handling:** `remote = true` jobs always pass, regardless of their
  location text.
- **Scope:** the preference affects **both** the reviewer pre-filter **and** the
  dashboard list (applied as a baseline filter on the board owner's preference).
- **Not in `profile_version`:** changing locations must NOT invalidate existing
  verdicts. Like the model pickers, location preference only changes *which
  unreviewed jobs get reviewed*, never the AI's judgment of a given job. So
  re-tweaking locations never triggers re-review.

## Data Model

Add one column to `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN preferred_locations TEXT[] NOT NULL DEFAULT '{}';
```

- Empty array `{}` = "no location preference, review/show everything."
- Shipped both as a new incremental migration
  (`migrations/2026-06-25-preferred-locations.sql`, for the live Supabase DB)
  and in `schema.sql` (the full-schema source the test DB rebuilds from).
- `ProfileRow` (TypeScript) gains `preferred_locations: string[]`.

## Components & Data Flow

### Storage / queries (`dashboard/lib/`)

- `parsePreferredLocations(raw: string): string[]` — new pure helper in
  `lib/preferredLocations.ts`. Parses the form's JSON-encoded hidden field into
  a clean string array: ignores non-arrays/invalid JSON, trims, drops empties,
  de-dupes (first occurrence wins), caps at 100. JSON (not CSV) because location
  strings contain commas (e.g. `"San Francisco, CA"`).
- `upsertProfile(...)` — gains a `preferredLocations: string[]` field on its
  `data` param; writes the `preferred_locations` column on insert and update.
  `profile_version` computation is unchanged (locations excluded by design).
- `getDistinctLocations(): Promise<{ location: string; count: number }[]>` —
  distinct non-empty `location` from **open** jobs, `GROUP BY location ORDER BY
  count DESC, location ASC LIMIT 500`. Feeds the picker's options.
- `getBoardOwnerLocations(): Promise<string[]>` — the board owner's
  `preferred_locations` (same "most-recently-updated profile" selection as
  `getBoardOwnerId`). Feeds the dashboard baseline filter.
- `getJobs(f, userId, ownerLocations)` / `buildJobsQuery(f, userId,
  ownerLocations = [])` — new third arg. When non-empty, adds the baseline
  clause `(j.remote IS TRUE OR j.location = ANY($n))`. The existing manual
  `location` ILIKE filter (FilterBar) still works as additional narrowing.

### Profile page (`dashboard/app/profile/`)

- New `LocationPicker` client component (`dashboard/components/LocationPicker.tsx`),
  modeled on `ModelPicker` but **multi-select**:
  - Props: `name`, `options: {location, count}[]`, `defaultValue: string[]`.
  - State: `selected: string[]`, `query`, `open`.
  - Renders selected values as removable chips (chips render from saved state
    even if a value is no longer in `options` because its jobs closed).
  - Type-to-filter the option list (case-insensitive substring on the location
    text); clicking an option appends it; already-selected options are hidden
    from the list.
  - Emits a single hidden input `name="preferred_locations"` with
    `value={JSON.stringify(selected)}`.
- `profile/page.tsx`:
  - Server component fetches `getDistinctLocations()` (added to its existing
    `Promise.all`) and passes options + `profile?.preferred_locations ?? []` to
    `LocationPicker`.
  - `saveProfile` server action reads `formData.get("preferred_locations")`,
    runs it through `parsePreferredLocations`, and passes the result to
    `upsertProfile`.

### Reviewer (`reviewer/`)

- `load_profiles(conn)` — also selects `preferred_locations` (psycopg returns it
  as a Python `list[str]`).
- `select_candidates(conn, user_id, profile_version, limit,
  preferred_locations=None)` — new trailing param (default keeps existing call
  sites working). Adds, inside the existing query so `COUNT(*) OVER()` overflow
  accounting still reflects the reviewable set:

  ```sql
  AND (NOT %(has_prefs)s OR j.remote IS TRUE OR j.location = ANY(%(prefs)s::text[]))
  ```

  with params `has_prefs = bool(prefs)`, `prefs = preferred_locations or []`.
- `run.py::_review_user` — passes
  `preferred_locations=profile.get("preferred_locations")` into
  `select_candidates`.

### Dashboard page (`dashboard/app/page.tsx`)

- First `Promise.all` also calls `getBoardOwnerLocations()`; the result is
  passed as the third arg to `getJobs`. (No dependency on `ownerId`, so it
  parallelizes cleanly.)

## Matching Semantics Summary

| Job state                                   | preferred_locations empty | preferred_locations = ["Berlin, Germany"] |
|--------------------------------------------|---------------------------|-------------------------------------------|
| `remote = true` (any location)             | kept                      | **kept** (remote always passes)           |
| `location = "Berlin, Germany"`, not remote | kept                      | **kept** (exact match)                    |
| `location = "New York, NY"`, not remote    | kept                      | **dropped**                               |
| `location = NULL`/`''`, not remote         | kept                      | **dropped**                               |

This table holds identically in the reviewer pre-filter and the dashboard
baseline filter.

## Error Handling

- Malformed/absent `preferred_locations` form value → `parsePreferredLocations`
  returns `[]` (degrades to "no preference"); never throws in the server action.
- Empty array everywhere short-circuits to no-op filtering (no clause added in
  SQL), preserving current behavior for users who never set a preference.

## Testing

- **pytest** (`tests/test_reviewer_db.py`):
  - Update `test_load_profiles` expected dict to include `preferred_locations: []`.
  - New `select_candidates` test: remote kept, exact-match kept, blank dropped,
    non-matching dropped, empty/None list = all jobs.
- **vitest**:
  - `lib/preferredLocations.test.ts`: JSON parse incl. a comma-containing value,
    trim/de-dupe, and invalid-input → `[]`.
  - `lib/jobsQuery.test.ts`: baseline owner-location clause (owner + no-owner
    placeholder numbering) and empty list = no clause.

## Out of Scope

- Normalizing/canonicalizing messy location strings (we match the raw values).
- A dashboard control to temporarily bypass the owner's location preference.
- Per-viewer (non-owner) location preferences — single-tenant board.
