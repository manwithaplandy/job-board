# Filter jobs by source provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Source" multi-select filter to the job board so the user can narrow the list to jobs from specific ATS providers (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday).

**Architecture:** Surface `companies.ats` through the existing lean jobs query onto `JobRow.ats`, then thread a `sources: string[]` field through the same client-side filter pipeline the Category/Location facets already use (`applyFilters`, `facetCounts`, `parseBoardFilters`, `FilterBar`, `RolefitBoard`). Filtering stays entirely in memory over the loaded 500-row window — no new SQL WHERE clause, no migration.

**Tech Stack:** Next.js (App Router) dashboard, TypeScript, Vitest. All work is in `/Users/andrew/Scripts/job-board/dashboard`.

## Global Constraints

- All commands run from `dashboard/` (the Next.js project root). Tests: `npx vitest run`. Typecheck: `npx tsc --noEmit`.
- Filtering stays **client-side / in-memory** — no server-side or URL-param filtering, no DB migration, no poller/adapter changes.
- The six ATS identifiers are **exactly**: `greenhouse`, `lever`, `ashby`, `workable`, `smartrecruiters`, `workday` (from the `companies.ats` CHECK constraint).
- `c.ats` is a **base** select column: present with and without a board owner. `JobRow.ats` is therefore always populated (non-optional).
- The Source filter must be visually indistinguishable from the Category/Location facets — reuse the existing inline-style helpers (`activeBtn`, `box`) and the facet-count pattern. No new styling system.
- Multi-select semantics match `cats`/`locs`: **OR within** the Source filter, **AND across** filters.

---

### Task 1: Plumb `ats` through the jobs query and `JobRow` type

Adds `c.ats` to the lean list query and makes `JobRow.ats` a populated, non-optional field. There is an existing test that explicitly asserts `c.ats` is NOT selected — it must flip.

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts` (select-columns comment ~79-89, `selectCols` base array ~90-93)
- Modify: `dashboard/lib/types.ts` (`JobRow` — add `ats`, remove the old optional, fix comments)
- Test: `dashboard/lib/jobsQuery.test.ts` (flip the "dead columns" test, add a positive test)

**Interfaces:**
- Produces: `JobRow.ats: string` (always present on every list row). Consumed by Tasks 2 and 4.
- Produces: `buildJobsQuery(...).text` now contains `c.ats` in its SELECT, with and without an owner.

- [ ] **Step 1: Update the query tests (this is the failing test)**

In `dashboard/lib/jobsQuery.test.ts`, the test `"does NOT select heavy detail-only or dead columns"` currently lists `"c.ats"` among the not-selected columns. Remove `"c.ats"` from that array. The array on lines ~145-147 becomes:

```ts
    for (const col of ["r.reasoning", "r.requirements", "r.about", "r.benefits",
      "r.red_flags", "r.stage1_reason", "r.stage1_decision", "r.confidence",
      "r.experience_match", "r.industry", "r.industry_subcategory", "j.url"]) {
      expect(t).not.toContain(col);
    }
```

Then add this new test immediately after that `test(...)` block (before the final closing `});` of the `describe`):

```ts
  test("selects c.ats for the Source facet — with and without an owner", () => {
    expect(buildJobsQuery(base, UID).text).toContain("c.ats");
    expect(buildJobsQuery(base, null).text).toContain("c.ats");
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL on `"selects c.ats for the Source facet"` — `expected '…' to contain 'c.ats'` (the column isn't selected yet).

- [ ] **Step 3: Add `c.ats` to the query's base columns**

In `dashboard/lib/jobsQuery.ts`, add `"c.ats"` to the base `selectCols` array (~line 90-93):

```ts
  const selectCols = [
    "j.id", "j.title", "j.location", "j.remote",
    "j.first_seen_at", "j.closed_at", "c.name AS company_name",
    "c.ats",
  ];
```

- [ ] **Step 4: Update the select-columns comment in `jobsQuery.ts`**

The block comment above `selectCols` (~lines 79-89) still lists `ats` as dropped. Replace this exact text:

```ts
  // GET /api/jobs/[id] instead. Eight more columns that no render path reads
  // (url, ats, experience_match, industry, industry_subcategory, confidence,
  // stage1_decision, stage1_reason) are dropped entirely. Note experience_match /
```

with:

```ts
  // GET /api/jobs/[id] instead. c.ats IS selected (below) — the board's Source facet
  // filter (lib/rolefit/filter.ts) reads it. Seven more columns that no render path
  // reads (url, experience_match, industry, industry_subcategory, confidence,
  // stage1_decision, stage1_reason) are dropped entirely. Note experience_match /
```

- [ ] **Step 5: Make `JobRow.ats` a populated base field in `types.ts`**

In `dashboard/lib/types.ts`, add `ats` to the always-present block. Find (~line 35):

```ts
  company_name: string;
  // Review fields below are populated only when the board has an owner whose
```

and insert the `ats` field between them:

```ts
  company_name: string;
  // Source ATS provider (companies.ats): one of greenhouse/lever/ashby/workable/
  // smartrecruiters/workday. Always selected (present with or without an owner);
  // read by the board's Source facet filter (lib/rolefit/filter.ts).
  ats: string;
  // Review fields below are populated only when the board has an owner whose
```

- [ ] **Step 6: Remove the old optional `ats` and fix its comment in `types.ts`**

Still in `dashboard/lib/types.ts`, replace this exact block (~lines 68-71):

```ts
  // the correction edit form (ReviewPanel). ats/stage1_decision/stage1_reason remain
  // genuinely dropped from every query — no render path reads them — and are kept
  // optional only so a stray reference still type-checks rather than silently breaking.
  ats?: string;
  experience_match?: string | null;
```

with (drops the `ats?: string;` line and the `ats/` prefix):

```ts
  // the correction edit form (ReviewPanel). stage1_decision/stage1_reason remain
  // genuinely dropped from every query — no render path reads them — and are kept
  // optional only so a stray reference still type-checks rather than silently breaking.
  experience_match?: string | null;
```

- [ ] **Step 7: Run the query tests + typecheck to verify green**

Run: `npx vitest run lib/jobsQuery.test.ts && npx tsc --noEmit`
Expected: jobsQuery tests PASS. `tsc` PASS (the pre-existing `job()` factory in `filter.test.ts` already sets `ats: "lever"`, so making `ats` required does not break it).

- [ ] **Step 8: Commit**

```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/types.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat(board): select companies.ats onto JobRow for source filtering"
```

---

### Task 2: Add `sources` to the board filter state, matching, and faceting

Extends the client-side filter model with a `sources` array: default empty, matched in `applyFilters`, tallied in `facetCounts`.

**Files:**
- Modify: `dashboard/lib/rolefit/filter.ts` (`BoardFilterState`, `DEFAULT_FILTERS`, `applyFilters`, `facetCounts`)
- Test: `dashboard/lib/rolefit/filter.test.ts` (fix the `ST` literal, add matching + facet tests)

**Interfaces:**
- Consumes: `JobRow.ats: string` (Task 1).
- Produces: `BoardFilterState.sources: string[]`; `DEFAULT_FILTERS.sources = []`; `facetCounts(jobs)` now returns `{ categories, locations, sources }`, each `Record<string, number>`. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

In `dashboard/lib/rolefit/filter.test.ts`, first fix the shared `ST` literal (line ~17) so it satisfies the soon-to-be-required field — add `sources: []`:

```ts
const ST: BoardFilterState = { search: "", cats: [], locs: [], sources: [], remote: "all", minFit: 0, payMin: 0, sort: "match" };
```

Add these tests inside the existing `describe("applyFilters", ...)` block:

```ts
  test("source filter keeps only matching providers", () => {
    const jobs = [job({ id: "a", ats: "greenhouse" }), job({ id: "b", ats: "workday" })];
    expect(applyFilters(jobs, { ...ST, sources: ["workday"] }).map((j) => j.id)).toEqual(["b"]);
  });
  test("source filter is multi-select (OR within the filter)", () => {
    const jobs = [
      job({ id: "a", ats: "greenhouse" }),
      job({ id: "b", ats: "workday" }),
      job({ id: "c", ats: "lever" }),
    ];
    expect(applyFilters(jobs, { ...ST, sources: ["greenhouse", "lever"] }).map((j) => j.id))
      .toEqual(["a", "c"]);
  });
  test("empty sources is a no-op", () => {
    const jobs = [job({ id: "a", ats: "greenhouse" }), job({ id: "b", ats: "workday" })];
    expect(applyFilters(jobs, { ...ST, sources: [] }).map((j) => j.id)).toEqual(["a", "b"]);
  });
  test("source combines with category (AND across filters)", () => {
    const jobs = [
      job({ id: "a", ats: "greenhouse", role_category: "Backend" }),
      job({ id: "b", ats: "greenhouse", role_category: "Frontend" }),
      job({ id: "c", ats: "workday", role_category: "Backend" }),
    ];
    expect(applyFilters(jobs, { ...ST, sources: ["greenhouse"], cats: ["Backend"] }).map((j) => j.id))
      .toEqual(["a"]);
  });
```

And add this test inside the existing `describe("facetCounts", ...)` block:

```ts
  test("counts sources", () => {
    const jobs = [job({ ats: "greenhouse" }), job({ ats: "greenhouse" }), job({ ats: "workday" })];
    expect(facetCounts(jobs).sources).toEqual({ greenhouse: 2, workday: 1 });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/rolefit/filter.test.ts`
Expected: FAIL — the source `applyFilters` cases don't filter yet (all jobs pass), and `facetCounts(...).sources` is `undefined`.

- [ ] **Step 3: Add `sources` to the filter interface and defaults**

In `dashboard/lib/rolefit/filter.ts`, add `sources` to `BoardFilterState` (after `locs`):

```ts
export interface BoardFilterState {
  search: string;
  cats: string[];
  locs: string[];
  sources: string[];
  remote: "all" | "remote" | "hybrid" | "onsite";
  minFit: number;
  payMin: number; // in $k
  sort: "match" | "pay" | "newest" | "az";
}
```

and to `DEFAULT_FILTERS` (after `locs: []`):

```ts
export const DEFAULT_FILTERS: BoardFilterState = {
  search: "",
  cats: [],
  locs: [],
  sources: [],
  remote: "all",
  minFit: 0,
  payMin: 0,
  sort: "match",
};
```

- [ ] **Step 4: Match on `sources` in `applyFilters`**

In `applyFilters`, add the source clause right after the `locs` clause:

```ts
    if (st.locs.length && !(j.location && st.locs.includes(j.location))) return false;
    if (st.sources.length && !st.sources.includes(j.ats)) return false;
```

- [ ] **Step 5: Tally `sources` in `facetCounts`**

Replace the whole `facetCounts` function body so the return type and loop include `sources`:

```ts
export function facetCounts(jobs: JobRow[]): {
  categories: Record<string, number>;
  locations: Record<string, number>;
  sources: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  const locations: Record<string, number> = {};
  const sources: Record<string, number> = {};
  for (const j of jobs) {
    if (j.role_category) categories[j.role_category] = (categories[j.role_category] ?? 0) + 1;
    if (j.location) locations[j.location] = (locations[j.location] ?? 0) + 1;
    if (j.ats) sources[j.ats] = (sources[j.ats] ?? 0) + 1;
  }
  return { categories, locations, sources };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/rolefit/filter.test.ts`
Expected: PASS (all applyFilters + facetCounts cases green).

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/filter.test.ts
git commit -m "feat(board): add sources to filter state, matching, and facets"
```

---

### Task 3: Persist `sources` across reloads

Round-trips `sources` through the `board_filters` cookie / `profiles.board_filters` JSONB via the existing bounded `strList` parser.

**Files:**
- Modify: `dashboard/lib/rolefit/boardFilters.ts` (`defaults`, `parseBoardFilters`)
- Test: `dashboard/lib/rolefit/boardFilters.test.ts` (fix the exact-object assertion, add a `sources` test)

**Interfaces:**
- Consumes: `BoardFilterState.sources` and `DEFAULT_FILTERS.sources` (Task 2).
- Produces: `parseBoardFilters(raw).sources` — a string array (bounded), `[]` on missing/invalid input.

- [ ] **Step 1: Write the failing tests**

In `dashboard/lib/rolefit/boardFilters.test.ts`, first fix the exact-object assertion in the `"parses a valid JSON string"` test (~lines 17-20) — the parsed result now carries `sources: []` (the input JSON has no `sources` key). Change it to:

```ts
    expect(f).toEqual({
      search: "eng", cats: ["Backend"], locs: ["Berlin"], sources: [],
      remote: "remote", minFit: 75, payMin: 150, sort: "pay",
    });
```

Then add this test inside the `describe("parseBoardFilters", ...)` block:

```ts
  test("sources round-trips; invalid input collapses to []", () => {
    expect(parseBoardFilters({ sources: ["greenhouse", "workday"] }).sources)
      .toEqual(["greenhouse", "workday"]);
    expect(parseBoardFilters({ sources: "greenhouse" }).sources).toEqual([]);
    expect(parseBoardFilters({ sources: ["greenhouse", 5, null] }).sources).toEqual(["greenhouse"]);
    expect(parseBoardFilters({}).sources).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/rolefit/boardFilters.test.ts`
Expected: FAIL — the round-trip cases see `sources: undefined`, and the exact-object test would already be red if reached. (Note: the `"…→ all defaults"` and round-trip tests that compare against `DEFAULT_FILTERS` stay green because `DEFAULT_FILTERS.sources` now exists from Task 2.)

- [ ] **Step 3: Parse `sources` and include it in `defaults()`**

In `dashboard/lib/rolefit/boardFilters.ts`, add `sources` to `defaults()`:

```ts
function defaults(): BoardFilterState {
  return { ...DEFAULT_FILTERS, cats: [], locs: [], sources: [] };
}
```

and add the `sources` line to the object returned by `parseBoardFilters` (right after `locs`):

```ts
    cats: strList(o.cats),
    locs: strList(o.locs),
    sources: strList(o.sources),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/rolefit/boardFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/boardFilters.ts dashboard/lib/rolefit/boardFilters.test.ts
git commit -m "feat(board): persist source filter in board_filters"
```

---

### Task 4: Source dropdown in `FilterBar` + wire into `RolefitBoard`

Adds the "Source" facet dropdown (cloned from the Location block) and the state/handler that drives it. These land together because `FilterBar`'s new props are required — the board must pass them for the app to typecheck.

**Files:**
- Modify: `dashboard/components/rolefit/FilterBar.tsx` (labels map, props, facet destructure, active styling, dropdown block)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (state, `filterState`, handler, `clearFilters`, `FilterBar` usage)

**Interfaces:**
- Consumes: `facetCounts(...).sources` (Task 2), `BoardFilterState.sources` (Task 2), `initialFilters.sources` (parsed via Task 3).
- Produces: no new exported types; `FilterBarProps` gains `sources: string[]` and `onToggleSource: (ats: string) => void`.

- [ ] **Step 1: Add the ATS label map to `FilterBar.tsx`**

In `dashboard/components/rolefit/FilterBar.tsx`, add this after the `REMOTE_DEFS` constant (~line 33), above `export interface FilterBarProps`:

```ts
// Human-readable labels for the six companies.ats identifiers. Unknown values fall
// back to the raw identifier so an unexpected provider never blanks or crashes.
const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};
const atsLabel = (ats: string) => ATS_LABELS[ats] ?? ats;
```

- [ ] **Step 2: Add the new props to `FilterBarProps` and the function signature**

In `FilterBarProps`, add `sources` next to `locs`, and `onToggleSource` next to `onToggleLoc`:

```ts
  cats: string[];
  locs: string[];
  sources: string[];
```

```ts
  onToggleCat: (cat: string) => void;
  onToggleLoc: (loc: string) => void;
  onToggleSource: (ats: string) => void;
```

Then add `sources` and `onToggleSource` to the destructured parameters of the `FilterBar` function (alongside `locs` and `onToggleLoc`):

```ts
  cats,
  locs,
  sources,
```

```ts
  onToggleCat,
  onToggleLoc,
  onToggleSource,
```

- [ ] **Step 3: Destructure source facet counts and compute active-state + items**

Change the `facetCounts` destructure (~line 78) to also pull sources (aliased to avoid colliding with the `sources` prop):

```ts
  const { categories, locations, sources: sourceCounts } = facetCounts(jobs);
```

Add an active-button style + badge next to the existing `lb`/`locBadge` definitions (~lines 85, 90):

```ts
  const sb = activeBtn(sources.length > 0);
```

```ts
  const srcBadge = sources.length ? ` · ${sources.length}` : "";
```

Add a `sourceItems` list next to `locItems` (~line 110-112), sorted by display label:

```ts
  const sourceItems = Object.entries(sourceCounts)
    .map(([ats, count]) => ({ ats, label: atsLabel(ats), count, ...box(sources.includes(ats)) }))
    .sort((a, b) => a.label.localeCompare(b.label));
```

- [ ] **Step 4: Add the Source dropdown block after the Location block**

In the JSX, immediately after the Location block's closing `</div>` (the one closing `{/* Location */}`, ~line 394) and before `{/* Remote segmented toggle */}`, insert:

```tsx
      {/* Source */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("source")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: sb.bg,
            border: `1px solid ${sb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Source{srcBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "source" && (
          <div
            style={{
              ...dropdownBase,
              left: 0,
              width: "230px",
              maxHeight: "320px",
              overflow: "auto",
            }}
          >
            {sourceItems.map(({ ats, label, count, boxBg, boxBorder, check }) => (
              <div
                key={ats}
                onClick={() => onToggleSource(ats)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "5px",
                    border: `1.5px solid ${boxBorder}`,
                    background: boxBg,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {check}
                </span>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
                  {label}
                </span>
                <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 5: Add `sources` state to `RolefitBoard.tsx`**

In `dashboard/components/rolefit/RolefitBoard.tsx`, add the state hook right after the `locs` hook (~line 64):

```ts
  const [locs, setLocs] = useState<string[]>(initialFilters.locs);
  const [sources, setSources] = useState<string[]>(initialFilters.sources);
```

- [ ] **Step 6: Include `sources` in `filterState` and add the toggle handler**

Update the `filterState` memo (~lines 160-163) to carry `sources`:

```ts
  const filterState: BoardFilterState = useMemo(
    () => ({ search, cats, locs, sources, remote, minFit, payMin, sort }),
    [search, cats, locs, sources, remote, minFit, payMin, sort],
  );
```

Add a `toggleSource` handler right after `toggleLoc` (~line 246), mirroring it:

```ts
  const toggleSource = (ats: string) =>
    setSources((prev) =>
      prev.includes(ats) ? prev.filter((s) => s !== ats) : [...prev, ats],
    );
```

Add `setSources([])` to `clearFilters` (~lines 250-257), next to `setLocs([])`:

```ts
  const clearFilters = () => {
    setSearch("");
    setCats([]);
    setLocs([]);
    setSources([]);
    setRemote("all");
    setMinFit(0);
    setPayMin(0);
  };
```

- [ ] **Step 7: Pass the new props into `<FilterBar>`**

In the `<FilterBar ... />` usage (~lines 544-564), add `sources` next to `locs` and `onToggleSource` next to `onToggleLoc`:

```tsx
        cats={cats}
        locs={locs}
        sources={sources}
```

```tsx
        onToggleCat={toggleCat}
        onToggleLoc={toggleLoc}
        onToggleSource={toggleSource}
```

- [ ] **Step 8: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` PASS (all required props are now supplied), all tests PASS.

- [ ] **Step 9: Manual verification in the running board**

Prereq: `dashboard/.env.local` must be present (contains `NEXT_PUBLIC_SUPABASE_*`; middleware 500s without it — and it is NOT copied into git worktrees, so if you're in a worktree, copy it from the main checkout and run `npm install` there first).

Run: `npm run dev`, open the board, and confirm:
- A **Source** button appears immediately after **Location** in the filter row.
- Opening it lists only the providers present in the loaded jobs, each with a count, labeled (e.g. "SmartRecruiters", not "smartrecruiters"), sorted by label.
- Checking one or more providers narrows the list; the button shows a `Source · N` badge and the active (blue-tinted) background.
- The result count (`X of Y roles`) updates, and Source combines with Category/Location.
- Reload the page: the selection persists (cookie for anon, `profiles.board_filters` when signed in).

- [ ] **Step 10: Commit**

```bash
git add dashboard/components/rolefit/FilterBar.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): add Source provider filter to the board UI"
```

---

## Self-Review

**Spec coverage** — every spec section maps to a task:
- Provider values + labels → Task 4 Step 1 (`ATS_LABELS`), Task 1 (data source).
- Data source (Option A: select `c.ats`) → Task 1.
- `lib/jobsQuery.ts` / `lib/types.ts` → Task 1. `lib/rolefit/filter.ts` → Task 2. `lib/rolefit/boardFilters.ts` → Task 3. `FilterBar.tsx` / `RolefitBoard.tsx` → Task 4.
- Behavior: facet-only-when-present → Task 2 (`facetCounts`) + Task 4 (`sourceItems` iterates only present providers); active badge/styling → Task 4 Step 3; persistence incl. legacy filters → Task 3 (`strList` → `[]` on missing key); facets reflect loaded window → unchanged (`facetCounts(jobs)`).
- Testing: `applyFilters`/`facetCounts` → Task 2; `parseBoardFilters` → Task 3; query flip → Task 1; manual → Task 4.
- Out of scope respected: no migration, no WHERE clause, no adapter/poller edits.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step shows the full literal to insert or replace.

**Type consistency:** `sources: string[]` used identically across `BoardFilterState`, `DEFAULT_FILTERS`, `parseBoardFilters`, `FilterBarProps`, and `RolefitBoard` state. `onToggleSource: (ats: string) => void` matches between `FilterBarProps` and the `toggleSource` handler passed in. `facetCounts` returns `sources` and `FilterBar` reads it as `sourceCounts` (aliased to avoid shadowing the `sources` prop). `JobRow.ats: string` (Task 1) is what `applyFilters`/`facetCounts` (Task 2) read.
