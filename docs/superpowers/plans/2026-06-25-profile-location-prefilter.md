# Profile Location Pre-Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator pick which job locations to include on the profile page, and use that include-list to skip AI review of excluded-location jobs and to hide them from the dashboard.

**Architecture:** Add a `preferred_locations TEXT[]` column to `profiles`. A job is kept when `remote IS TRUE OR location = ANY(preferred_locations)`; blank locations are dropped; an empty list means "no preference". The same clause is applied in the Python reviewer's candidate selection (saves LLM tokens) and in the dashboard's `buildJobsQuery` (board owner's preference). A new multi-select `LocationPicker` on the profile page submits the picks as a JSON array.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / Tailwind / vitest (dashboard); Python 3.12 / psycopg 3 / pytest (poller + reviewer); PostgreSQL (Supabase).

## Global Constraints

- No new runtime dependencies on either side.
- `profile_version = sha256(resume_text || '\0' || instructions)` — do **not** add locations (or models) to it. Changing locations must not invalidate verdicts.
- Empty `preferred_locations` (`[]` / `{}`) must behave exactly like today (no filtering, no SQL clause added).
- `remote = true` jobs always pass the location filter regardless of location text.
- Location matching is **exact** (`= ANY(...)`), not substring.
- DB-backed pytest tests use the `@requires_db` marker and need `TEST_DATABASE_URL` (a throwaway Postgres) set; otherwise they skip. The `conn` fixture rebuilds the schema from `schema.sql` each test.
- Dashboard tests run with `vitest`; the `@/` import alias maps to the `dashboard/` root.
- Match existing style: 2-space indent in TS, comments explain *why*; mirror the existing `ModelPicker`/query patterns.

---

### Task 1: Add `preferred_locations` column, migration, and type

**Files:**
- Modify: `schema.sql` (profiles table, ~lines 44-50)
- Create: `migrations/2026-06-25-preferred-locations.sql`
- Modify: `dashboard/lib/types.ts:53-62` (`ProfileRow`)
- Test: `tests/test_schema.py` (add one test)

**Interfaces:**
- Produces: `profiles.preferred_locations TEXT[] NOT NULL DEFAULT '{}'`; `ProfileRow.preferred_locations: string[]`.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_schema.py` (after `test_profiles_has_model_columns`):

```python
@requires_db
def test_profiles_has_preferred_locations_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'profiles'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "preferred_locations" in cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_schema.py::test_profiles_has_preferred_locations_column -v`
Expected: FAIL (`assert 'preferred_locations' in cols`) — column not yet in `schema.sql`.

- [ ] **Step 3: Add the column to `schema.sql`**

In the `CREATE TABLE profiles (...)` block, add the column after `model_stage2`:

```sql
  model_stage2     TEXT,                     -- OpenRouter model id; NULL = default
  preferred_locations TEXT[] NOT NULL DEFAULT '{}',  -- location include-list; empty = no pre-filter
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
```

- [ ] **Step 4: Create the incremental migration**

Create `migrations/2026-06-25-preferred-locations.sql`:

```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user location include-list used to pre-filter jobs before AI review and on
-- the dashboard list. Empty array = no location preference (review/show everything).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 5: Add the field to `ProfileRow`**

In `dashboard/lib/types.ts`, add to the `ProfileRow` interface after `model_stage2`:

```ts
  model_stage2: string | null;
  preferred_locations: string[];
  profile_version: string;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_schema.py::test_profiles_has_preferred_locations_column -v`
Expected: PASS.

- [ ] **Step 7: Verify the TS type compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add schema.sql migrations/2026-06-25-preferred-locations.sql dashboard/lib/types.ts tests/test_schema.py
git commit -m "feat(profiles): add preferred_locations column + migration + type"
```

---

### Task 2: Reviewer pre-filter (skip AI on excluded locations)

**Files:**
- Modify: `reviewer/db.py:25-49` (`load_profiles`, `select_candidates`)
- Modify: `reviewer/run.py:91` (`select_candidates` call)
- Test: `tests/test_reviewer_db.py`

**Interfaces:**
- Consumes: `profiles.preferred_locations` (Task 1).
- Produces: `select_candidates(conn, user_id, profile_version, limit, preferred_locations=None) -> list[dict]`; `load_profiles` rows now include key `preferred_locations: list[str]`.

- [ ] **Step 1: Update the failing `test_load_profiles` expectation**

In `tests/test_reviewer_db.py::test_load_profiles`, add the new key to the expected dict:

```python
    profiles = rdb.load_profiles(conn)
    assert profiles == [
        {"user_id": uuid.UUID(USER), "resume_text": "r", "instructions": "i",
         "profile_version": "v1", "model_stage1": None, "model_stage2": None,
         "preferred_locations": []}
    ]
```

- [ ] **Step 2: Write the new failing filter test**

Add to `tests/test_reviewer_db.py` (after `test_candidates_missing_then_excluded_when_fresh`):

```python
def _seed_loc(conn, ext, location, remote):
    job_id = _seed_job(conn, ext)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET location = %s, remote = %s WHERE id = %s",
            (location, remote, job_id),
        )
    conn.commit()
    return job_id


@requires_db
def test_candidates_filtered_by_preferred_locations(conn):
    berlin = _seed_loc(conn, "1", "Berlin, Germany", False)
    ny = _seed_loc(conn, "2", "New York, NY", False)
    blank = _seed_loc(conn, "3", None, False)
    remote = _seed_loc(conn, "4", "Anywhere", True)

    # no preference -> every open job is a candidate
    assert {c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)} == {
        berlin, ny, blank, remote}

    # include-list -> exact match + remote pass; non-match and blank dropped
    got = {c["id"] for c in rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=["Berlin, Germany"])}
    assert got == {berlin, remote}

    # empty list behaves like no preference
    assert {c["id"] for c in rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=[])} == {berlin, ny, blank, remote}
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pytest tests/test_reviewer_db.py::test_load_profiles tests/test_reviewer_db.py::test_candidates_filtered_by_preferred_locations -v`
Expected: `test_load_profiles` FAILs (missing `preferred_locations` key / unexpected kwarg path), `test_candidates_filtered_by_preferred_locations` FAILs with `TypeError: select_candidates() got an unexpected keyword argument 'preferred_locations'`.

- [ ] **Step 4: Add `preferred_locations` to `load_profiles`**

In `reviewer/db.py`, replace the `load_profiles` SELECT:

```python
def load_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, resume_text, instructions, profile_version, "
            "model_stage1, model_stage2, preferred_locations FROM profiles"
        )
        return cur.fetchall()
```

- [ ] **Step 5: Add the location clause to `select_candidates`**

In `reviewer/db.py`, replace `select_candidates` with:

```python
def select_candidates(
    conn, user_id: str, profile_version: str, limit: int,
    preferred_locations: list[str] | None = None,
) -> list[dict]:
    # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
    # guard makes the whole OR true). When set, keep remote jobs always and
    # otherwise require an exact location match; blank locations are dropped.
    prefs = preferred_locations or []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id, j.title, j.location, j.raw, c.ats, c.name AS company_name, COUNT(*) OVER() AS total_stale
            FROM jobs j
            JOIN companies c ON c.id = j.company_id
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
            WHERE j.closed_at IS NULL
              AND (r.job_id IS NULL OR r.profile_version <> %(pv)s)
              AND (NOT %(has_prefs)s OR j.remote IS TRUE OR j.location = ANY(%(prefs)s::text[]))
            ORDER BY j.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": profile_version, "lim": limit,
             "has_prefs": bool(prefs), "prefs": prefs},
        )
        return cur.fetchall()
```

- [ ] **Step 6: Run the two tests to verify they pass**

Run: `pytest tests/test_reviewer_db.py::test_load_profiles tests/test_reviewer_db.py::test_candidates_filtered_by_preferred_locations -v`
Expected: both PASS.

- [ ] **Step 7: Wire the preference through the run loop**

In `reviewer/run.py`, replace the `select_candidates` call in `_review_user` (line ~91):

```python
        candidates = db.select_candidates(
            conn, user_id, pv, config.MAX_JOBS_PER_RUN,
            preferred_locations=profile.get("preferred_locations"),
        )
```

- [ ] **Step 8: Run the reviewer test suites to confirm nothing regressed**

Run: `pytest tests/test_reviewer_db.py tests/test_reviewer_run.py -v`
Expected: PASS (or SKIP where `TEST_DATABASE_URL` is unset — none should FAIL).

- [ ] **Step 9: Commit**

```bash
git add reviewer/db.py reviewer/run.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): pre-filter candidates by preferred_locations"
```

---

### Task 3: `parsePreferredLocations` form-value helper

**Files:**
- Create: `dashboard/lib/preferredLocations.ts`
- Test: `dashboard/lib/preferredLocations.test.ts`

**Interfaces:**
- Produces: `parsePreferredLocations(raw: string): string[]`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/preferredLocations.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parsePreferredLocations } from "@/lib/preferredLocations";

describe("parsePreferredLocations", () => {
  test("parses a JSON array and preserves comma-containing values", () => {
    expect(parsePreferredLocations('["San Francisco, CA","Berlin, Germany"]'))
      .toEqual(["San Francisco, CA", "Berlin, Germany"]);
  });

  test("trims, drops empties, and de-dupes (first occurrence wins)", () => {
    expect(parsePreferredLocations('[" Berlin ","Berlin","","   "]'))
      .toEqual(["Berlin"]);
  });

  test("invalid JSON, non-array, or empty input yields []", () => {
    expect(parsePreferredLocations("not json")).toEqual([]);
    expect(parsePreferredLocations('{"a":1}')).toEqual([]);
    expect(parsePreferredLocations("")).toEqual([]);
  });

  test("ignores non-string entries", () => {
    expect(parsePreferredLocations('["Berlin",5,null,"Paris"]'))
      .toEqual(["Berlin", "Paris"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/preferredLocations.test.ts`
Expected: FAIL — cannot resolve `@/lib/preferredLocations`.

- [ ] **Step 3: Write the implementation**

Create `dashboard/lib/preferredLocations.ts`:

```ts
const MAX_LOCATIONS = 100;

// The profile form submits the picked locations as a JSON string array in a
// hidden field — JSON, not CSV, because location strings contain commas (e.g.
// "San Francisco, CA"). Parse defensively: any bad/missing input degrades to
// "no preference" ([]) rather than throwing in the server action.
export function parsePreferredLocations(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of parsed) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_LOCATIONS) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/preferredLocations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/preferredLocations.ts dashboard/lib/preferredLocations.test.ts
git commit -m "feat(dashboard): add parsePreferredLocations form-value helper"
```

---

### Task 4: `buildJobsQuery` baseline location clause

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts:8` (signature) and after line 50 (new clause)
- Test: `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildJobsQuery(f: Filters, userId: string | null, ownerLocations?: string[]): SqlQuery` — when `ownerLocations` is non-empty, appends `(j.remote IS TRUE OR j.location = ANY($n))` and pushes the array value.

- [ ] **Step 1: Write the failing tests**

Add to `dashboard/lib/jobsQuery.test.ts` inside the `describe("buildJobsQuery", ...)` block (after the existing location tests):

```ts
  test("owner preferred locations add a remote-or-exact-match clause at $2", () => {
    const q = buildJobsQuery(base, UID, ["Berlin, Germany", "Remote"]);
    expect(q.text).toContain("(j.remote IS TRUE OR j.location = ANY($2))");
    expect(q.values).toEqual([UID, ["Berlin, Germany", "Remote"]]);
  });

  test("empty owner preferred locations add no baseline clause", () => {
    const q = buildJobsQuery(base, UID, []);
    expect(q.text).not.toContain("j.location = ANY(");
  });

  test("owner preferred locations apply without an owner, binding from $1", () => {
    const q = buildJobsQuery(base, null, ["Berlin, Germany"]);
    expect(q.text).toContain("(j.remote IS TRUE OR j.location = ANY($1))");
    expect(q.values).toEqual([["Berlin, Germany"]]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL — the new clause is absent (and the 3-arg call is ignored).

- [ ] **Step 3: Update the signature**

In `dashboard/lib/jobsQuery.ts`, change the function signature:

```ts
export function buildJobsQuery(
  f: Filters,
  userId: string | null,
  ownerLocations: string[] = [],
): SqlQuery {
```

- [ ] **Step 4: Add the clause**

In `dashboard/lib/jobsQuery.ts`, in the "plain job filters" section, immediately after the existing `if (f.location) { ... }` block (ends ~line 50), add:

```ts
  // Board owner's location include-list (set on the profile). Mirrors the
  // reviewer pre-filter: keep remote jobs always, else require an exact match.
  // Empty list => no clause (everything shows). Applies with or without an owner.
  if (ownerLocations.length) {
    where.push(`(j.remote IS TRUE OR j.location = ANY(${ph()}))`);
    values.push(ownerLocations);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: PASS (all existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat(dashboard): filter jobs by owner preferred_locations in buildJobsQuery"
```

---

### Task 5: Wire the dashboard list to the owner's preference

**Files:**
- Modify: `dashboard/lib/queries.ts:7-11` (`getJobs`) and add `getBoardOwnerLocations`
- Modify: `dashboard/app/page.tsx:1-6, 24, 29` (import, fetch, pass)

**Interfaces:**
- Consumes: `buildJobsQuery(..., ownerLocations)` (Task 4); `profiles.preferred_locations` (Task 1).
- Produces: `getJobs(f, userId, ownerLocations?)`; `getBoardOwnerLocations(): Promise<string[]>`.

- [ ] **Step 1: Update `getJobs` to pass owner locations**

In `dashboard/lib/queries.ts`, replace `getJobs`:

```ts
export async function getJobs(
  f: Filters,
  userId: string | null,
  ownerLocations: string[] = [],
): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f, userId, ownerLocations);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}
```

- [ ] **Step 2: Add `getBoardOwnerLocations`**

In `dashboard/lib/queries.ts`, add after `getBoardOwnerId` (line ~17):

```ts
export async function getBoardOwnerLocations(): Promise<string[]> {
  // Single-tenant: the board owner's location include-list (same profile that
  // getBoardOwnerId resolves). Empty array = no location pre-filter on the board.
  const rows = await sql`
    SELECT preferred_locations FROM profiles ORDER BY updated_at DESC LIMIT 1
  `;
  return (rows[0]?.preferred_locations as string[] | undefined) ?? [];
}
```

- [ ] **Step 3: Fetch and pass it in the page**

In `dashboard/app/page.tsx`:

Add `getBoardOwnerLocations` to the import from `@/lib/queries`:

```ts
import {
  getBoardOwnerId, getBoardOwnerLocations, getCompanies, getJobs, getLatestPollRun,
  getLatestReviewRun, getReviewStats,
} from "@/lib/queries";
```

Replace the first `Promise.all` (line ~24):

```ts
  const [viewerId, ownerId, ownerLocations] = await Promise.all([
    getUserId(), getBoardOwnerId(), getBoardOwnerLocations(),
  ]);
```

Replace the `getJobs` call inside the second `Promise.all` (line ~29):

```ts
    getJobs(filters, ownerId, ownerLocations),
```

- [ ] **Step 4: Type-check and run the dashboard tests**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all vitest suites PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/app/page.tsx
git commit -m "feat(dashboard): apply board owner preferred_locations to the job list"
```

---

### Task 6: `LocationPicker` multi-select component

**Files:**
- Create: `dashboard/components/LocationPicker.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LocationPicker` (client component) with props `{ name: string; options: { location: string; count: number }[]; defaultValue: string[] }`. Emits a hidden input `name={name}` whose value is `JSON.stringify(selected)`.

- [ ] **Step 1: Create the component**

Create `dashboard/components/LocationPicker.tsx`:

```tsx
"use client";

import { useState } from "react";

type LocationOption = { location: string; count: number };

// Multi-select type-to-filter picker, modeled on ModelPicker. Selected values
// render as removable chips (from state, so they persist even if a value drops
// out of `options` because its jobs closed). The picks are submitted as a JSON
// string array in a hidden field — JSON, not CSV, because locations contain commas.
export function LocationPicker({
  name, options, defaultValue,
}: {
  name: string;
  options: LocationOption[];
  defaultValue: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = `location-picker-${name}`;

  const selectedSet = new Set(selected);
  const q = query.trim().toLowerCase();
  const results = options
    .filter((o) => !selectedSet.has(o.location))
    .filter((o) => !q || o.location.toLowerCase().includes(q))
    .slice(0, 50);

  const add = (loc: string) => {
    setSelected((prev) => (prev.includes(loc) ? prev : [...prev, loc]));
    setQuery("");
    setOpen(false);
  };
  const remove = (loc: string) =>
    setSelected((prev) => prev.filter((l) => l !== loc));

  return (
    <div className="flex flex-col text-sm text-gray-700">
      <label htmlFor={inputId}>
        Locations to include (blank = all; remote always included)
      </label>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {selected.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {selected.map((loc) => (
            <li key={loc}
              className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs">
              <span>{loc}</span>
              <button type="button" aria-label={`Remove ${loc}`}
                className="text-gray-500 hover:text-gray-900"
                onClick={() => remove(loc)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        type="text"
        className="mt-1 rounded border px-2 py-1 text-sm"
        placeholder="Type to filter locations…"
        value={query}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul role="listbox"
          className="mt-1 max-h-56 overflow-auto rounded border bg-white text-sm shadow">
          {results.map((o) => (
            <li key={o.location} role="option" aria-selected={false}>
              <button type="button"
                className="flex w-full justify-between px-2 py-1 text-left hover:bg-gray-100"
                onClick={() => add(o.location)}>
                <span>{o.location}</span>
                <span className="text-gray-400">{o.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check the component**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/LocationPicker.tsx
git commit -m "feat(dashboard): add multi-select LocationPicker component"
```

---

### Task 7: Wire the profile page (input + save)

**Files:**
- Modify: `dashboard/lib/queries.ts` (add `getDistinctLocations`; extend `upsertProfile`)
- Modify: `dashboard/app/profile/page.tsx` (imports, `saveProfile`, `ProfilePage`)

**Interfaces:**
- Consumes: `LocationPicker` (Task 6); `parsePreferredLocations` (Task 3); `getProfile().preferred_locations` (Task 1).
- Produces: `getDistinctLocations(): Promise<{ location: string; count: number }[]>`; `upsertProfile(userId, { ..., preferredLocations: string[] })`.

- [ ] **Step 1: Add `getDistinctLocations`**

In `dashboard/lib/queries.ts`, add after `getCompanies` (line ~43):

```ts
export async function getDistinctLocations(): Promise<{ location: string; count: number }[]> {
  // Distinct non-empty locations from open jobs, most common first — the option
  // set for the profile LocationPicker. Capped so the payload stays bounded.
  const rows = await sql`
    SELECT location, count(*)::int AS count
    FROM jobs
    WHERE closed_at IS NULL AND location IS NOT NULL AND location <> ''
    GROUP BY location
    ORDER BY count DESC, location ASC
    LIMIT 500
  `;
  return rows as unknown as { location: string; count: number }[];
}
```

- [ ] **Step 2: Extend `upsertProfile` to persist `preferred_locations`**

In `dashboard/lib/queries.ts`, replace `upsertProfile` with:

```ts
export async function upsertProfile(
  userId: string,
  data: {
    resumeText: string | null;
    instructions: string | null;
    resumeFilePath: string | null;
    modelStage1: string | null;
    modelStage2: string | null;
    preferredLocations: string[];
  },
): Promise<void> {
  // profile_version intentionally excludes the model choice AND preferred
  // locations — neither must invalidate existing verdicts (spec §4).
  const version = profileVersion(data.resumeText, data.instructions);
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          model_stage1, model_stage2, preferred_locations,
                          profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${data.modelStage1}, ${data.modelStage2},
            ${data.preferredLocations}, ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text         = EXCLUDED.resume_text,
      instructions        = EXCLUDED.instructions,
      resume_file_path    = EXCLUDED.resume_file_path,
      model_stage1        = EXCLUDED.model_stage1,
      model_stage2        = EXCLUDED.model_stage2,
      preferred_locations = EXCLUDED.preferred_locations,
      profile_version     = EXCLUDED.profile_version,
      updated_at          = now()
  `;
}
```

- [ ] **Step 3: Update `profile/page.tsx` imports**

In `dashboard/app/profile/page.tsx`, update the queries import and add two imports:

```ts
import { getProfile, upsertProfile, getDistinctLocations } from "@/lib/queries";
```

Add below the existing component imports (near the `ModelPicker` import, line ~11):

```ts
import { ModelPicker } from "@/components/ModelPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { parsePreferredLocations } from "@/lib/preferredLocations";
```

- [ ] **Step 4: Parse + persist locations in `saveProfile`**

In `dashboard/app/profile/page.tsx` `saveProfile`, after the model validation block (after line ~32), add:

```ts
  const preferredLocations = parsePreferredLocations(
    String(formData.get("preferred_locations") ?? ""),
  );
```

And replace the `upsertProfile(...)` call (lines ~48-51) with:

```ts
  await upsertProfile(userId, {
    resumeText, instructions, resumeFilePath,
    modelStage1: s1.value, modelStage2: s2.value,
    preferredLocations,
  });
```

- [ ] **Step 5: Fetch options and render the picker**

In `dashboard/app/profile/page.tsx` `ProfilePage`, replace the `Promise.all` (lines ~57-59):

```ts
  const [profile, models, locations, headerList] = await Promise.all([
    getProfile(userId), getStructuredModels(), getDistinctLocations(), headers(),
  ]);
```

Add the picker inside the `<form>`, immediately after the Instructions `<label>` block (after line ~83, before the models `<fieldset>`):

```tsx
        <LocationPicker name="preferred_locations" options={locations}
          defaultValue={profile?.preferred_locations ?? []} />
```

- [ ] **Step 6: Type-check, run tests, and build**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all vitest suites PASS; `next build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/app/profile/page.tsx
git commit -m "feat(profile): add location include-list input and persist it"
```

---

### Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the Python suite**

Run: `pytest -q`
Expected: PASS or SKIP only (no failures). DB-backed tests SKIP if `TEST_DATABASE_URL` is unset — set it (a throwaway Postgres) to actually exercise the schema/reviewer changes, then re-run.

- [ ] **Step 2: Run the dashboard suite + build**

Run: `cd dashboard && npx vitest run && npm run build`
Expected: all vitest suites PASS; `next build` succeeds with no type errors.

- [ ] **Step 3 (optional, recommended): Manual smoke against a real DB**

With the app running and `preferred_locations` migration applied: open `/profile`, pick a couple of locations, Save; confirm the dashboard only shows those locations plus remote jobs, and that a subsequent reviewer run logs fewer candidates. (No commit.)

---

## Self-Review

**Spec coverage:**
- Schema column + migration + type → Task 1. ✓
- Matching semantics (remote-or-exact, blank dropped, empty=all) → Task 2 (reviewer) + Task 4 (dashboard), identical clause. ✓
- Reviewer pre-filter + run wiring → Task 2. ✓
- `parsePreferredLocations` (JSON, commas, dedupe) → Task 3. ✓
- Dashboard baseline filter + page wiring + `getBoardOwnerLocations` → Tasks 4–5. ✓
- `LocationPicker` multi-select + `getDistinctLocations` + profile form/save + `upsertProfile` → Tasks 6–7. ✓
- `profile_version` unchanged → enforced by the comment + unchanged `profileVersion(...)` call in Task 7. ✓

**Placeholder scan:** none — every code/step is concrete.

**Type consistency:** `select_candidates(..., preferred_locations=None)` defined Task 2, called Task 2 step 7. `buildJobsQuery(f, userId, ownerLocations=[])` defined Task 4, consumed by `getJobs` Task 5. `getBoardOwnerLocations(): Promise<string[]>` defined Task 5, consumed Task 5. `getDistinctLocations(): Promise<{location, count}[]>` defined Task 7, shape matches `LocationPicker` `options` prop (Task 6). `upsertProfile` `data.preferredLocations: string[]` defined Task 7, supplied by `parsePreferredLocations` (Task 3). `ProfileRow.preferred_locations: string[]` (Task 1) read in Task 7. Consistent. ✓
