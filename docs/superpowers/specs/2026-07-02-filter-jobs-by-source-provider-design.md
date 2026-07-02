# Filter jobs by source provider — design

**Date:** 2026-07-02
**Status:** Approved, ready for planning

## Summary

Add a **"Source"** multi-select filter to the job board's `FilterBar`, letting the
user narrow the list to jobs from specific ATS providers (Greenhouse, Lever, Ashby,
Workable, SmartRecruiters, Workday). It mirrors the existing Category/Location
filters exactly: a dropdown of checkboxes with live facet counts, multi-select,
client-side, persisted alongside the other board filters. It is a neutral "Source"
filter — no special framing around auto-apply or data quality.

## Motivation

The board already filters by Category, Pay, Match, Location, and Remote. Provider is
another attribute the user wants to slice by. Each job's provider is already known
(it is a checked enum on `companies.ats` and the first segment of every job `id`),
so this is purely a matter of surfacing an existing field through the established
facet-filter pattern.

## Provider values

The six ATS identifiers, from the `companies.ats` CHECK constraint
(`schema.sql`) and the Python adapter registry
(`job_discovery/adapters/__init__.py`):

| Identifier (stored) | Display label |
|---------------------|---------------|
| `greenhouse`        | Greenhouse    |
| `lever`             | Lever         |
| `ashby`             | Ashby         |
| `workable`          | Workable      |
| `smartrecruiters`   | SmartRecruiters |
| `workday`           | Workday       |

Display labels live in an `ATS_LABELS` map in `FilterBar.tsx`. An unknown/absent
identifier falls back to the raw string so the UI never crashes on unexpected data.

## Data source

**Decision: select `companies.ats` (Option A).** The value is added to the jobs
query and populates the already-reserved `JobRow.ats` field. This is explicit and
consistent with every other facet, which reads a real selected column rather than a
parsed string. `companies` is already joined, so there is no query-cost impact.

The rejected alternative (parsing `ats` from the first segment of `job.id`) avoids a
query change but couples UI logic to the implicit ID format `{ats}:{token}:{external_id}`,
which would break silently if that format ever changed.

## Components & changes

Data flows unchanged through the existing client-side filter pipeline; the new field
is threaded through the same seams as `cats`/`locs`.

### 1. `dashboard/lib/jobsQuery.ts`
Add `c.ats` to the SELECT column list in `buildJobsQuery()`. No change to WHERE,
ORDER BY, or LIMIT — filtering stays client-side.

### 2. `dashboard/lib/types.ts`
Change `ats?: string` to `ats: string` on `JobRow` (the field is now always
selected and populated). Remove the "genuinely dropped" note for `ats`.

### 3. `dashboard/lib/rolefit/filter.ts`
- `BoardFilterState`: add `sources: string[]`.
- `DEFAULT_FILTERS`: add `sources: []`.
- `applyFilters`: add
  `if (st.sources.length && !st.sources.includes(j.ats)) return false;`
  (OR within the filter, AND across filters — same semantics as `cats`/`locs`).
- `facetCounts`: extend the return type with `sources: Record<string, number>` and
  tally `j.ats` the same way `role_category`/`location` are tallied.

### 4. `dashboard/lib/rolefit/boardFilters.ts`
- `parseBoardFilters`: parse `sources` via the existing `strList` helper
  (bounded item count/length), so it round-trips through the cookie and
  `profiles.board_filters` JSONB exactly like `cats`/`locs`.
- `defaults()`: include `sources: []`.
- `serializeBoardFilters` needs no change (it serializes the whole object).

### 5. `dashboard/components/rolefit/FilterBar.tsx`
- Add an `ATS_LABELS: Record<string, string>` map for the six providers.
- Add `sources: string[]` and `onToggleSource: (ats: string) => void` to
  `FilterBarProps`.
- Read `sources` from `facetCounts(jobs)`.
- Add a "Source" dropdown block cloned from the Category block: an active-state
  button with a `· N` count badge (reusing `activeBtn`/`box` helpers), and a
  checkbox list of the providers present in the current job set, each showing its
  display label and facet count. Sort items by display label
  (`localeCompare`), matching Category/Location.
- Placement: immediately after the Location block in the filter row.

### 6. `dashboard/components/rolefit/RolefitBoard.tsx`
- Add `sources` to the board's filter state and initialize from parsed filters.
- Add an `onToggleSource` handler mirroring `onToggleCat` (toggle membership in the
  `sources` array).
- Thread `sources`/`onToggleSource` into `<FilterBar>`, pass `sources` into
  `applyFilters`, and include `sources` in the debounced `/api/board-filters`
  persistence payload.

## Behavior details

- **Only providers present in the current job set appear** in the dropdown, each
  with a count — identical to Category/Location. No empty `Workday (0)` rows.
- **Facet counts reflect the loaded job window** (the existing 500-row query), the
  same as today's facets. No separate query is issued.
- **Active-state styling and the `Source · N` badge** reuse the existing helpers so
  the new control is visually indistinguishable from Category/Location.
- **Persistence:** an anonymous user's selection persists via the `board_filters`
  cookie; a signed-in user's persists in `profiles.board_filters`. Existing saved
  filters without a `sources` key parse to `sources: []` (no migration needed).

## Testing

- **`applyFilters`** (filter unit test file): source filter alone; source combined
  with category/location; empty `sources` is a no-op; a job whose `ats` is not in
  `sources` is excluded.
- **`facetCounts`**: source tallies are correct across a mixed-provider job list.
- **`parseBoardFilters`**: `sources` round-trips; invalid input (non-array,
  over-long items, non-strings) collapses to `[]`; a payload with no `sources` key
  yields `[]`.
- **Manual:** in the running dashboard, confirm the Source dropdown populates with
  the providers present, counts are correct, toggling filters the list, the badge
  updates, and the selection survives a reload.

## Out of scope (YAGNI)

- No server-side or URL-param filtering (filtering stays in memory, like all current
  facets).
- No database migration and no changes to the poller or ATS adapters.
- No provider concept beyond the six existing `companies.ats` values.
- No auto-apply / data-quality framing — this is a neutral provider filter.
