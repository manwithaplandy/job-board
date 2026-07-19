# Non-engineer users see an empty board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the authed board query from silently restricting every tenant to engineer-*titled* jobs, so a non-engineer user (e.g. Katie, user `92b27148`) sees their full approved match set instead of zero rows.

**Architecture:** The board loader (`app/page.tsx`) builds one `Filters` object today and shares it between the authed and anon `getJobs` branches; that object carries the default `include: ["engineer"]`, which `buildJobsQuery` turns into `j.title ILIKE '%engineer%'`. Option A from the spec: give the two branches **different** filter objects — the authed branch drops the title-keyword prefilter (`include: []`, matching `getReviewFeed`/`getRejectedJobs`), while the anon/public branch deliberately keeps the engineer curation. We centralize that decision in a tiny pure helper `serverBoardFilters(audience)` (named to disambiguate from the client-side `lib/rolefit/boardFilters.ts`) so the seam is unit-testable and a future edit can't silently re-apply the prefilter to authed viewers, and rename the constant to `PUBLIC_BOARD_INCLUDE_KEYWORDS` to document its anon-only scope.

**Second fix (folded in per the 2026-07-19 scope change): `board_filters` double-encoding.** `saveBoardFilters` (`lib/queries.ts`) writes `SET board_filters = ${JSON.stringify(filters)}::jsonb`, which postgres.js stores as a **jsonb string scalar** (double-encoded), not a jsonb object. This is empirically reproduced against the local test DB: that exact write yields `jsonb_typeof(board_filters) = 'string'`, whereas binding the object once via postgres.js's `tx.json(filters)` (no `::jsonb` cast) yields `'object'` — confirmed working even inside `sql.begin` (the `withUserSql` path). `parseBoardFilters` already tolerates the string form on read (it `JSON.parse`s a string input first), so it never broke the board — but the stored shape is wrong at the source. We (a) correct the write via an executor-taking `saveBoardFiltersWith` that binds `tx.json(filters)`, (b) **keep** `parseBoardFilters`' string-tolerance (load-bearing for the anon board-filter cookie replayed at login, and for legacy rows), and (c) one-off backfill the existing double-encoded prod rows AFTER the fixed code deploys.

**Tech Stack:** Next.js 16 (App Router, server components), TypeScript 6, vitest 4 (+ jsdom for component tests), postgres.js. Frontend-only code change; **no migration file** (the one-off prod data repair runs via Supabase MCP `execute_sql`, matching the `package-jsonb-hardening` precedent).

## Global Constraints

- **Never rewrite commits.** No `--amend`, no rebase, no force-push, no `git reset` of shared history. Reconcile forward with **new** commits only. (Repo `CLAUDE.md`.)
- **No migration file.** No schema change. The board fix touches no jsonb column. The `board_filters` double-encode fix is a code + one-off data-repair change (repair via Supabase MCP `execute_sql`, not a migration file — the `package-jsonb-hardening` precedent). (Spec §4 Cost, §5.5.)
- **Never `as`-cast a jsonb column** (`dashboard/CLAUDE.md`). No new jsonb *reads* are introduced. The `board_filters` fix corrects a jsonb *write*: bind the object via `tx.json(...)` — never `${JSON.stringify(x)}::jsonb`, which double-encodes to a jsonb string scalar.
- **UI-cohesion contracts must stay green:** `npm run test:ui-contract` (run from `dashboard/`). This change is logic-only in a server component (no JSX/markup change), so the contract must pass **unchanged**.
- **This worktree has no `node_modules`** — install once (Task 1 Step 0) before any `npx`/`npm` command.
- **All commands run from `dashboard/`** unless a step states otherwise (Stage 4/5 call out the steps that run from the worktree root).
- **The full suite must pass before finishing:** `npm test` **and** `npm run test:ui-contract`.
- Deployment is push-to-`main` → Vercel auto-deploy. Apply nothing to Supabase/Railway (frontend-only).

---

## Pre-flight decisions (spec open questions, resolved with the spec's defaults)

The implementer is **not** blocked on any of these — proceed with the default shown.

1. **Anon/public board content** → **KEEP** engineer-only curation. The anon branch keeps `include: ["engineer"]`. (Spec Q1 default.)
2. **Authed include/exclude control** → **NONE / defer Option B.** Reviewer curation + the client `search` box are sufficient; do not add a user-facing server-side keyword control. (Spec Q2 default.)
3. **Constant rename** → **YES.** Rename `DEFAULT_INCLUDE_KEYWORDS` → `PUBLIC_BOARD_INCLUDE_KEYWORDS`, documented anon-only. Sole consumer is `app/page.tsx` (grep-verified: only `lib/config.ts` declares it and `app/page.tsx` imports it). (Spec Q3 default.)
4. **Owner's board growth** → **ACCEPTED** as correct multi-tenant behavior. With the owner's `preferred_locations` pre-filter applied, dropping the title prefilter adds roughly **+70** non-engineer approved rows on top of his engineer-titled set — a **relative** increase; absolute counts drift daily as jobs close and stay well under `LIMIT 500`. (The spec's 257→355 figures were measured **without** the location pre-filter, so treat them as illustrative, not targets.) Verify this as relative growth, never an absolute count. No index/limit change. (Spec Q4 default, §6 perf note.)

---

## File Structure (what each touched file is responsible for)

| File | Change | Responsibility after the change |
|---|---|---|
| `dashboard/lib/config.ts` | Modify (rename `DEFAULT_INCLUDE_KEYWORDS` → `PUBLIC_BOARD_INCLUDE_KEYWORDS` + comment) | Owns the anon/public board's editorial keyword list; comment forbids re-applying it to authed viewers. |
| `dashboard/lib/filters.ts` | Modify (add `serverBoardFilters(audience)`) | Owns the server-side board `Filters` per viewer class — the one place the authed-vs-anon include decision lives. |
| `dashboard/app/page.tsx` | Modify (use `serverBoardFilters("authed")` authed / `serverBoardFilters("anon")` anon; drop the shared object + the constant import) | Board loader wires the correct filter object into each `getJobs` branch. |
| `dashboard/lib/filters.test.ts` | Modify (add `serverBoardFilters` tests) | Locks the authed=`[]` / anon=`["engineer"]` decision at the seam. |
| `dashboard/lib/jobsQuery.test.ts` | Modify (add contract + parity guards) | Locks: empty include → no `j.title ILIKE`; anon include → ILIKE present; board/feed parity. |
| `dashboard/lib/queries.boardInclude.db.test.ts` | Create (OPTIONAL, `skipIf(!TEST_DATABASE_URL)`) | Real-Postgres proof that a non-engineer-titled approved job is returned under `include: []` and dropped under the old `["engineer"]`. |
| `dashboard/lib/queries.ts` | Modify (Task 4: extract `saveBoardFiltersWith` executor + fix the write to `tx.json`) | Owns the `board_filters` write; stores a jsonb object, not a double-encoded string scalar. |
| `dashboard/lib/rolefit/boardFilters.ts` | Modify (Task 4: add a load-bearing comment on `parseBoardFilters`' string branch) | Read boundary; keeps string-tolerance for the anon cookie + legacy rows, documented so nobody removes it. |
| `dashboard/lib/queries.boardFilters.test.ts` | Modify (Task 4: mock gains `tx.json`; binding assertion flips) | DB-free guard that the write binds an object (not `JSON.stringify`). |
| `dashboard/lib/queries.saveBoardFilters.db.test.ts` | Create (Task 4, `skipIf(!TEST_DATABASE_URL)`) | Real-Postgres proof the write stores `jsonb_typeof = 'object'` and round-trips through `parseBoardFilters`. |

**Seam-testability note (why the helper, not an inline literal):** the spec's implementation shape is non-prescriptive and even sketches an inline `parseFilters({}, { include: [] })`. We prefer a named pure helper because (a) it gives a genuinely failing-first unit test for the fix without mounting the Next.js server component (there is **no** `app/page.tsx` test harness — grep-verified), (b) it matches this codebase's house style of extracting small pure functions "for unit tests" (e.g. `companyNameSearchFragment`, `reviewStatsWith`, `distinctLocationsWith`), and (c) it is a stronger guardrail than the rename alone against a future re-application of the prefilter. **Naming (per review):** it is `serverBoardFilters` with a `"authed" | "anon"` union arg — combining both reviewer suggestions — which disambiguates from the client-side `lib/rolefit/boardFilters.ts` module and reads clearly at call sites (`serverBoardFilters("authed")`).

---

## Task 1: `serverBoardFilters(audience)` helper — split the authed/anon include (THE FIX)

**Files:**
- Modify: `dashboard/lib/config.ts:4-5` (rename constant + comment)
- Modify: `dashboard/lib/filters.ts:1` (import) and end-of-file (add helper)
- Modify: `dashboard/app/page.tsx:8` (imports), `dashboard/app/page.tsx:32` (remove shared object), `dashboard/app/page.tsx:40-41` (authed filter), `dashboard/app/page.tsx:102-103` (anon filter)
- Test: `dashboard/lib/filters.test.ts` (add a `serverBoardFilters` describe block)

**Interfaces:**
- Consumes: `parseFilters(params, { include })` (existing, `lib/filters.ts`); `Filters` type (existing, `lib/filters.ts`).
- Produces:
  - `PUBLIC_BOARD_INCLUDE_KEYWORDS: string[]` (renamed from `DEFAULT_INCLUDE_KEYWORDS`, in `lib/config.ts`).
  - `serverBoardFilters(audience: "authed" | "anon"): Filters` (in `lib/filters.ts`). Returns `parseFilters({}, { include: audience === "authed" ? [] : PUBLIC_BOARD_INCLUDE_KEYWORDS })`. `"authed"` → `include: []`; `"anon"` → `include: ["engineer"]`; all other fields are the `parseFilters` empty-params defaults (`verdict: "approve"`, `status: "open"`, everything else empty/false).

- [ ] **Step 0: One-time worktree setup — install deps**

This worktree has no `node_modules` — every `npx`/`npm` command below fails without it. Run once from `dashboard/`:

Run: `npm install`
Expected: dependencies install cleanly (may take a minute). Skip only if `dashboard/node_modules/` already exists.

- [ ] **Step 1: Write the failing test**

Add to `dashboard/lib/filters.test.ts` (update the import on line 2 to also pull in `serverBoardFilters`, then append the new describe block):

```ts
import { serverBoardFilters, parseFilters } from "@/lib/filters";
```

```ts
describe("serverBoardFilters", () => {
  test("authed board drops the title-keyword prefilter (include: [])", () => {
    // The reviewer's verdict='approve' join already curates the viewer's board;
    // a title prefilter on top only removes correct matches (bug 2026-07-19).
    expect(serverBoardFilters("authed").include).toEqual([]);
  });

  test("anon/public board keeps the deliberate engineer curation", () => {
    expect(serverBoardFilters("anon").include).toEqual(["engineer"]);
  });

  test("both classes share the non-include parseFilters defaults", () => {
    for (const f of [serverBoardFilters("authed"), serverBoardFilters("anon")]) {
      expect(f.verdict).toBe("approve");
      expect(f.status).toBe("open");
      expect(f.companies).toEqual([]);
      expect(f.exclude).toEqual([]);
      expect(f.remoteOnly).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/filters.test.ts`
Expected: FAIL — `serverBoardFilters` is not exported from `@/lib/filters` (import error / "serverBoardFilters is not a function").

- [ ] **Step 3: Rename the constant (config.ts)**

In `dashboard/lib/config.ts`, replace lines 4-5:

```ts
// FR-10: the operator's default filter, applied on first load only.
export const DEFAULT_INCLUDE_KEYWORDS: string[] = ["engineer"];
```

with:

```ts
// The anon/public board's editorial curation. The public board has no per-user
// reviewer curation, so it deliberately restricts to engineering roles by title.
// This applies to the ANON board ONLY — the authed board runs with include: []
// (see lib/filters.ts serverBoardFilters). Do NOT re-apply this to authed viewers:
// it empties every non-engineer tenant's board (bug 2026-07-19).
export const PUBLIC_BOARD_INCLUDE_KEYWORDS: string[] = ["engineer"];
```

- [ ] **Step 4: Add the helper (filters.ts)**

In `dashboard/lib/filters.ts`, change the import on line 1:

```ts
import { VERDICT_OPTIONS } from "@/lib/config";
```

to:

```ts
import { VERDICT_OPTIONS, PUBLIC_BOARD_INCLUDE_KEYWORDS } from "@/lib/config";
```

Then append at the end of the file (after `parseFilters`):

```ts
// The board's server-side Filters, one object per viewer class. All client filters now
// apply client-side (app/page.tsx passes {} to parseFilters), so the ONLY server-side
// decision left is the title-keyword prefilter's default:
//   - "authed" -> include: []  The reviewer's verdict='approve' join already curates the
//     viewer's board, so a title prefilter on top only drops correctly-approved matches
//     and empties non-engineer tenants' boards (bug 2026-07-19). include: [] also makes
//     the authed board agree with getReviewFeed / getRejectedJobs (both include: []),
//     so matches streamed during a review run survive the settle-time router.refresh().
//   - "anon" -> include: PUBLIC_BOARD_INCLUDE_KEYWORDS  Deliberate public-board curation;
//     the public board has no per-user reviews.
// Named serverBoardFilters (not boardFilters) to disambiguate from the client-side
// lib/rolefit/boardFilters.ts.
export function serverBoardFilters(audience: "authed" | "anon"): Filters {
  return parseFilters({}, {
    include: audience === "authed" ? [] : PUBLIC_BOARD_INCLUDE_KEYWORDS,
  });
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run: `npx vitest run lib/filters.test.ts`
Expected: PASS (all `parseFilters` + `serverBoardFilters` tests green).

- [ ] **Step 6: Wire `app/page.tsx` to use the helper per branch**

In `dashboard/app/page.tsx`:

(a) Line 8 — drop the constant import:

```ts
import { DEFAULT_INCLUDE_KEYWORDS, STALE_HEALTH_HOURS } from "@/lib/config";
```
→
```ts
import { STALE_HEALTH_HOURS } from "@/lib/config";
```

(b) Line 3 — swap the `parseFilters` import for `serverBoardFilters` (page no longer calls `parseFilters` directly):

```ts
import { parseFilters } from "@/lib/filters";
```
→
```ts
import { serverBoardFilters } from "@/lib/filters";
```

(c) Lines 31-32 — remove the shared filter object; keep the `await searchParams` line:

```ts
  await searchParams; // filters now client-side; keep the param contract
  const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });

  if (viewerId) {
```
→
```ts
  await searchParams; // filters now client-side; keep the param contract

  if (viewerId) {
```

(d) Lines 40-41 — build the authed filter inside the authed branch, just before the `getJobs` call:

```ts
    const viewerLocations = profile.preferred_locations ?? [];
    const jobsP = getJobs(filters, viewerId, viewerLocations);
```
→
```ts
    const viewerLocations = profile.preferred_locations ?? [];
    // Authed board: the reviewer's approve join already curates it, so no title
    // prefilter (include: []). See lib/filters.ts serverBoardFilters.
    const filters = serverBoardFilters("authed");
    const jobsP = getJobs(filters, viewerId, viewerLocations);
```

(e) Lines 102-103 — build the anon filter in the anon branch:

```ts
  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  const jobs = await getJobs(filters, null, []);
```
→
```ts
  // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
  // The public board keeps the deliberate engineer-only editorial curation.
  const filters = serverBoardFilters("anon");
  const jobs = await getJobs(filters, null, []);
```

- [ ] **Step 7: Run typecheck + full suite to verify green**

Run: `npm run typecheck && npm test`
Expected: typecheck clean (no unused `parseFilters`/`DEFAULT_INCLUDE_KEYWORDS`, no missing symbol); all vitest suites PASS.

- [ ] **Step 8: Run the UI-cohesion contract (no UI changed → must be unchanged-green)**

Run: `npm run test:ui-contract`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add dashboard/lib/config.ts dashboard/lib/filters.ts dashboard/app/page.tsx dashboard/lib/filters.test.ts
git commit -m "fix(board): drop engineer title prefilter for authed viewers (non-engineer empty board)"
```

---

## Task 2: query-contract + feed/board parity guards

Locks the invariants the fix relies on, so a future edit re-adding an unconditional title filter is caught. These assert on `buildJobsQuery`'s emitted SQL (the existing test file's style). Note: guards (a) and (c) encode already-correct `buildJobsQuery` behavior — they pass immediately and exist to prevent regression, not to drive new code. Guard (b) documents the preserved anon curation.

**Files:**
- Test: `dashboard/lib/jobsQuery.test.ts` (add three tests + import `serverBoardFilters`)

**Interfaces:**
- Consumes: `buildJobsQuery(f, userId, viewerLocations?, opts?)` (existing); `serverBoardFilters(audience)` (Task 1); `Filters`, `base` fixture (existing in the test file).

- [ ] **Step 1: Write the tests**

In `dashboard/lib/jobsQuery.test.ts`, add to the imports (after line 3):

```ts
import { serverBoardFilters } from "@/lib/filters";
```

Then add inside the `describe("buildJobsQuery", ...)` block:

```ts
  test("empty include emits no title ILIKE clause (authed board contract)", () => {
    const q = buildJobsQuery({ ...base, include: [] }, UID);
    expect(q.text).not.toContain("j.title ILIKE");
  });

  test("anon board (serverBoardFilters('anon')) keeps the engineer title ILIKE", () => {
    const q = buildJobsQuery(serverBoardFilters("anon"), null);
    expect(q.text).toContain("j.title ILIKE $1");
    expect(q.values).toEqual(["%engineer%"]);
  });

  test("authed board and review feed agree: neither emits a title ILIKE (parity)", () => {
    // Authed board (serverBoardFilters("authed") -> include: []).
    const authed = buildJobsQuery(serverBoardFilters("authed"), UID, ["Remote"]);
    expect(authed.text).not.toContain("j.title ILIKE");
    // getReviewFeed (lib/queries.ts) builds its Filters with include: [] and a
    // reviewedSince cursor — same title predicate (none). getRejectedJobs also uses
    // include: []. All three now agree, so streamed matches survive router.refresh().
    const feedLike = buildJobsQuery(
      { ...base, include: [] },
      UID,
      ["Remote"],
      { reviewedSince: "2026-07-16T00:00:00.000Z" },
    );
    expect(feedLike.text).not.toContain("j.title ILIKE");
  });
```

- [ ] **Step 2: Run to verify they pass**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: PASS (all existing + 3 new tests). If any of the three FAILS, the fix regressed — do not "fix" the test; re-check Task 1.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/jobsQuery.test.ts
git commit -m "test(board): guard authed no-title-filter + feed/board include parity"
```

---

## Task 3 (OPTIONAL — real Postgres): non-engineer approved job is returned

The strongest regression artifact: seeds a non-engineer-titled approved job and proves it comes back under the fixed `include: []` but is dropped under the old `["engineer"]`. Self-skips when `TEST_DATABASE_URL` is unset (like `lib/queries.locationScoping.db.test.ts`).

**Tradeoff (read before deciding):** the temp-table DDL must mirror every column `buildJobsQuery`'s SELECT names (the review COALESCE set), so it is coupled to that SELECT list and will need updating if the list changes. If that coupling is not worth it for your team, **skip this task** — the live dev-shim stage (Stage 4) proves row-return against Katie's real approved set at lower cost. Included here complete so the implementer is never blocked.

**Files:**
- Create: `dashboard/lib/queries.boardInclude.db.test.ts`

**Interfaces:**
- Consumes: `buildJobsQuery` (existing); `serverBoardFilters` (Task 1); `Filters` (existing). Runs the built SQL via `postgres` against session-local TEMP tables.

- [ ] **Step 1: Write the test**

Create `dashboard/lib/queries.boardInclude.db.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { buildJobsQuery } from "@/lib/jobsQuery";
import { serverBoardFilters } from "@/lib/filters";
import type { Filters } from "@/lib/filters";

// Real-Postgres proof for the authed board's include contract (bug 2026-07-19):
// with include: [] a non-engineer-titled approved job is returned; the OLD
// include: ["engineer"] prefilter would have dropped it. Gated on
// TEST_DATABASE_URL (unset -> skips). Session-local TEMP tables shadow public.*;
// max: 1 pins the connection they live on. The temp schema mirrors the columns
// buildJobsQuery's SELECT names (keep in lockstep with lib/jobsQuery.ts).

const TEST_DSN = process.env.TEST_DATABASE_URL;
const U1 = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!TEST_DSN)("authed board include contract — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    await sql`CREATE TEMP TABLE companies (
      id INT PRIMARY KEY, name TEXT, display_name TEXT, ats TEXT
    )`;
    await sql`CREATE TEMP TABLE jobs (
      id TEXT PRIMARY KEY, title TEXT, location TEXT, location_canonicals TEXT[],
      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
    )`;
    // Only the columns buildJobsQuery reads (SELECT COALESCE set + WHERE predicates).
    await sql`CREATE TEMP TABLE job_reviews (
      user_id UUID, job_id TEXT, verdict TEXT, error TEXT,
      human_override BOOLEAN NOT NULL DEFAULT FALSE, stage1_decision TEXT,
      role_category TEXT, seniority TEXT, work_arrangement TEXT,
      pay_min INT, pay_max INT, pay_currency TEXT, pay_period TEXT, headcount TEXT,
      skills_score INT, experience_score INT, comp_score INT, fit_score INT,
      skill_gaps TEXT[],
      PRIMARY KEY (user_id, job_id)
    )`;
    await sql`CREATE TEMP TABLE review_corrections (
      user_id UUID, job_id TEXT, verdict TEXT,
      role_category TEXT, seniority TEXT, work_arrangement TEXT,
      pay_min INT, pay_max INT, pay_currency TEXT, pay_period TEXT, headcount TEXT,
      skills_score INT, experience_score INT, comp_score INT, fit_score INT,
      skill_gaps TEXT[],
      PRIMARY KEY (user_id, job_id)
    )`;

    await sql`INSERT INTO companies (id, name, display_name, ats) VALUES
      (1, 'acme', 'Acme', 'greenhouse')`;
    await sql`INSERT INTO jobs
      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
      ('j-eng', 'Senior Software Engineer', 'Remote', ARRAY['Remote'], true, now(), NULL, 1),
      ('j-pm',  'Program Manager',          'Remote', ARRAY['Remote'], true, now(), NULL, 1)`;
    // Both approved for U1, no error — the reviewer curated both onto her board.
    await sql`INSERT INTO job_reviews (user_id, job_id, verdict, error) VALUES
      (${U1}, 'j-eng', 'approve', NULL),
      (${U1}, 'j-pm',  'approve', NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("authed board (include: []) returns the non-engineer-titled approved job", async () => {
    const { text, values } = buildJobsQuery(serverBoardFilters("authed"), U1, []);
    const rows = await sql.begin((tx) => tx.unsafe(text, values as never[]));
    const titles = (rows as unknown as { title: string }[]).map((r) => r.title).sort();
    expect(titles).toEqual(["Program Manager", "Senior Software Engineer"]);
  });

  it("the OLD engineer prefilter dropped the non-engineer job (bug repro)", async () => {
    const engineerOnly: Filters = { ...serverBoardFilters("authed"), include: ["engineer"] };
    const { text, values } = buildJobsQuery(engineerOnly, U1, []);
    const rows = await sql.begin((tx) => tx.unsafe(text, values as never[]));
    const titles = (rows as unknown as { title: string }[]).map((r) => r.title);
    expect(titles).toEqual(["Senior Software Engineer"]);
  });
});
```

- [ ] **Step 2: Run against the local test DB**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.boardInclude.db.test.ts`
Expected: 2 passing (`include: []` returns both titles; `["engineer"]` returns only the engineer title). If `TEST_DATABASE_URL` is unset the suite reports **skipped** — that is acceptable and expected in a worktree without the DB.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/queries.boardInclude.db.test.ts
git commit -m "test(board): real-PG repro — authed include:[] returns non-engineer approved job"
```

---

## Task 4: Fix `saveBoardFilters` double-encode (store a jsonb object, not a string scalar)

The `board_filters` write currently double-encodes to a jsonb string scalar. Fix the write and add a real-Postgres proof. **Empirically verified** during planning against `poller_test`: `${JSON.stringify(filters)}::jsonb` → `jsonb_typeof = 'string'`; `${tx.json(filters)}` → `'object'` (works inside `sql.begin` too). The existing data is repaired in Stage 5 (after deploy).

**Files:**
- Modify: `dashboard/lib/queries.ts` (`saveBoardFilters` at lines 323-335 — extract an executor + fix the bind)
- Modify: `dashboard/lib/rolefit/boardFilters.ts:30-32` (load-bearing comment on `parseBoardFilters`' string branch)
- Modify: `dashboard/lib/queries.boardFilters.test.ts` (mock gains `tx.json`; binding assertion flips)
- Create: `dashboard/lib/queries.saveBoardFilters.db.test.ts`

**Interfaces:**
- Consumes: `parseBoardFilters` (`lib/rolefit/boardFilters.ts`); `BoardFilterState`, `DEFAULT_FILTERS` (`lib/rolefit/filter.ts`); `Sql`, `TransactionSql` (already imported in `queries.ts`).
- Produces: `saveBoardFiltersWith(tx: Sql | TransactionSql, userId: string, filters: BoardFilterState)` — executor-taking impl (mirrors `reviewStatsWith` / `distinctLocationsWith`), used by both `saveBoardFilters` and the db test. `saveBoardFilters(userId, filters)` becomes a thin `withUserSql` wrapper around it.

**Why extract an executor:** the real write must be driven against session-`TEMP` tables on a pinned connection; `withUserSql` opens its own RLS-scoped connection that can't see them (same reason `reviewStatsWith` etc. are executor-taking — see `queries.locationScoping.db.test.ts`). No caller changes: `app/api/board-filters/route.ts:22-25` and `app/login/page.tsx:27` already pass real objects (the latter via `parseBoardFilters`).

- [ ] **Step 1: Refactor — extract the executor, keeping the buggy write (no behavior change)**

In `dashboard/lib/queries.ts`, replace the current `saveBoardFilters` (lines 323-335):

```ts
export async function saveBoardFilters(
  userId: string,
  filters: BoardFilterState,
): Promise<void> {
  // UPDATE-only and intentionally does NOT touch updated_at: profile_version is
  // NOT NULL with no default, so we must not INSERT a row or bump updated_at when
  // persisting a viewer's filters (a filter change is not a profile edit).
  await withUserSql(userId, (tx) => tx`
    UPDATE profiles
    SET board_filters = ${JSON.stringify(filters)}::jsonb
    WHERE user_id = ${userId}::uuid
  `);
}
```

with:

```ts
// Executor-taking impl (mirrors reviewStatsWith / distinctLocationsWith) so the real
// write can be exercised against TEMP tables on a pinned connection — withUserSql opens
// its own RLS-scoped connection that can't see session-TEMP tables.
export function saveBoardFiltersWith(
  tx: Sql | TransactionSql,
  userId: string,
  filters: BoardFilterState,
) {
  // UPDATE-only and intentionally does NOT touch updated_at: profile_version is
  // NOT NULL with no default, so we must not INSERT a row or bump updated_at when
  // persisting a viewer's filters (a filter change is not a profile edit).
  return tx`
    UPDATE profiles
    SET board_filters = ${JSON.stringify(filters)}::jsonb
    WHERE user_id = ${userId}::uuid
  `;
}

export async function saveBoardFilters(
  userId: string,
  filters: BoardFilterState,
): Promise<void> {
  await withUserSql(userId, (tx) => saveBoardFiltersWith(tx, userId, filters));
}
```

Run: `npx vitest run lib/queries.boardFilters.test.ts`
Expected: PASS (pure refactor — same SQL, same bound value). Do not commit yet.

- [ ] **Step 2: Write the failing real-Postgres test (RED)**

Create `dashboard/lib/queries.saveBoardFilters.db.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { saveBoardFiltersWith } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import type { BoardFilterState } from "@/lib/rolefit/filter";

// Real-Postgres proof that the board_filters WRITE stores a jsonb OBJECT, not a
// double-encoded jsonb STRING scalar (bug 2026-07-19). Gated on TEST_DATABASE_URL
// (unset -> skips). Session-local TEMP profiles shadows public.profiles; max: 1 pins
// the connection. Drives the executor impl directly (withUserSql opens its own
// connection that can't see these temp tables — same pattern as locationScoping.db).

const TEST_DSN = process.env.TEST_DATABASE_URL;
const U1 = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!TEST_DSN)("saveBoardFilters storage shape — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });
    await sql`CREATE TEMP TABLE profiles (user_id uuid PRIMARY KEY, board_filters jsonb)`;
    await sql`INSERT INTO profiles (user_id, board_filters) VALUES (${U1}, NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  const state: BoardFilterState = {
    search: "react", cats: ["Engineering"], locs: ["Remote"], sources: ["greenhouse"],
    remote: "remote", minFit: 70, payMin: 100000, sort: "pay",
  };

  it("stores a jsonb OBJECT, not a double-encoded string scalar", async () => {
    await sql.begin((tx) => saveBoardFiltersWith(tx, U1, state));
    const [row] = await sql`
      SELECT jsonb_typeof(board_filters) AS typ, board_filters AS bf
      FROM profiles WHERE user_id = ${U1}::uuid`;
    // RED discriminator: the old ${JSON.stringify(filters)}::jsonb write yields 'string'.
    expect(row.typ).toBe("object");
    // Value integrity (order-independent — jsonb doesn't preserve key order).
    expect(parseBoardFilters(row.bf)).toEqual(state);
  });
});
```

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.saveBoardFilters.db.test.ts`
Expected: FAIL — `expect(row.typ).toBe("object")` gets `"string"` (the current write double-encodes). If `TEST_DATABASE_URL` is unset the suite **skips** — then rely on the DB-free RED in Step 3.

- [ ] **Step 3: Flip the DB-free binding guard to expect an object (RED)**

In `dashboard/lib/queries.boardFilters.test.ts`, give the mock `tx` a `json` helper, and replace the "binds the serialized filters" test.

Change the mock factory:

```ts
vi.mock("@/lib/db", () => {
  const tx = (strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    return Promise.resolve([]);
  };
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});
```

to (use `Object.assign` so TS accepts the added `.json`):

```ts
vi.mock("@/lib/db", () => {
  const tx = Object.assign(
    (strings: readonly string[], ...values: unknown[]) => {
      calls.push({ strings, values });
      return Promise.resolve([]);
    },
    // postgres.js json() helper — the fix binds the object through this instead of
    // pre-stringifying. Sentinel wrapper so the test can assert the object was passed.
    { json: (v: unknown) => ({ __json: v }) },
  );
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});
```

Replace the `test("binds the serialized filters and the user id", ...)` block with:

```ts
  test("binds the filters as a json object — not a double-encoded JSON string", async () => {
    const filters = { ...DEFAULT_FILTERS, sort: "pay" as const };
    await saveBoardFilters("22222222-2222-2222-2222-222222222222", filters);
    // The fix passes tx.json(filters) (mock wraps it {__json}) instead of
    // JSON.stringify(filters); the latter double-encodes to a jsonb string scalar.
    expect(calls[0].values[0]).toEqual({ __json: filters });
    expect(calls[0].values[1]).toBe("22222222-2222-2222-2222-222222222222");
  });
```

Run: `npx vitest run lib/queries.boardFilters.test.ts`
Expected: FAIL — the executor still binds `JSON.stringify(filters)` (a string), so `values[0]` is the string, not `{ __json: filters }`. (The "issues a bare UPDATE" test still passes.)

- [ ] **Step 4: Fix the write (GREEN) + document the read tolerance**

In `dashboard/lib/queries.ts`, fix `saveBoardFiltersWith`: put the rationale in the JS `//` comment block **above** the template (matching the existing `updated_at` comment style) and bind via `tx.json`. The tagged template must contain **only the two real binds** — `${tx.json(filters)}` and `${userId}::uuid` — with **no backticks and no other `${}` inside it** (a stray backtick would terminate the template literal; a stray `${}` inside a SQL comment would bind a phantom third parameter → runtime bind-count error). Final form:

```ts
export function saveBoardFiltersWith(
  tx: Sql | TransactionSql,
  userId: string,
  filters: BoardFilterState,
) {
  // UPDATE-only and intentionally does NOT touch updated_at: profile_version is
  // NOT NULL with no default, so we must not INSERT a row or bump updated_at when
  // persisting a viewer's filters (a filter change is not a profile edit).
  //
  // Bind the object ONCE via postgres.js's json() helper so board_filters stores a jsonb
  // OBJECT. The old JSON.stringify(filters) + ::jsonb double-encoded to a jsonb STRING
  // scalar (verified: jsonb_typeof = 'string'); parseBoardFilters tolerates that on read,
  // but the stored shape must be correct at the source. No ::jsonb cast — tx.json sends jsonb.
  return tx`
    UPDATE profiles
    SET board_filters = ${tx.json(filters)}
    WHERE user_id = ${userId}::uuid
  `;
}
```

In `dashboard/lib/rolefit/boardFilters.ts`, add the load-bearing comment to `parseBoardFilters`' string branch (lines 30-32):

```ts
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return defaults(); }
  }
```

→

```ts
  if (typeof raw === "string") {
    // LOAD-BEARING string tolerance — do NOT remove. Legit string inputs: the anon
    // board-filter cookie (app/api/board-filters/route.ts stores serializeBoardFilters())
    // replayed at login (app/login/page.tsx), plus legacy double-encoded
    // profiles.board_filters rows. The write path (saveBoardFilters) now stores jsonb
    // objects, but this branch must stay for those inputs.
    try { obj = JSON.parse(raw); } catch { return defaults(); }
  }
```

Run: `npx vitest run lib/queries.boardFilters.test.ts` → Expected: PASS (mock now receives `tx.json(filters)`).
Run (if DB available): `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run lib/queries.saveBoardFilters.db.test.ts` → Expected: PASS (`jsonb_typeof = 'object'`, round-trip equal).

- [ ] **Step 5: Typecheck + full suite, then commit**

Run: `npm run typecheck && npm test`
Expected: clean + all PASS. (If `tx.json` trips typecheck on the `Sql | TransactionSql` union, it is a postgres.js helper present on both — confirm the import of `Sql`/`TransactionSql` in `queries.ts` is intact; do not cast the value.)

```bash
git add dashboard/lib/queries.ts dashboard/lib/rolefit/boardFilters.ts dashboard/lib/queries.boardFilters.test.ts dashboard/lib/queries.saveBoardFilters.db.test.ts
git commit -m "fix(board-filters): store board_filters as a jsonb object, not a double-encoded string"
```

---

## Stage 4: Live verification via the dev-auth shim (NOT committed)

Confirms the fix against **real prod data**: Katie (`92b27148`) gets a populated board (was empty) and a populated Source dropdown; the owner's board grows relative to its pre-fix engineer-only count; anon still shows engineering roles. Uses the `local-authed-page-dev-shim` technique. **The shim edits are temporary and MUST be reverted before any deploy — never let them into a commit or diff.** Command working directories are called out per step (some run from the worktree root, `npm run dev` runs from `dashboard/`).

- [ ] **Step 1: Bring the worktree env up**

Run (from the **worktree root**, `/Users/andrew/Scripts/job-board/.claude/worktrees/abundant-rolling-yao`):
```bash
cp /Users/andrew/Scripts/job-board/dashboard/.env.local dashboard/.env.local
```
(A fresh worktree only has `DATABASE_URL`; the dev server needs `NEXT_PUBLIC_SUPABASE_*` from the main checkout — see `dashboard-env-local-not-in-worktrees`.)

- [ ] **Step 2: Point the shim at Katie**

Append to `dashboard/.env.local` (gitignored): `DEV_USER_ID=92b27148-...` — use Katie's **full** `user_id` (short form `92b27148` is from the spec; obtain the full UUID from the DB or the spec author / `db-state` teammate). Do not commit `.env.local`.

- [ ] **Step 3: Add the dev-only auth shim (three gates)**

All three guards are env-gated (`NODE_ENV !== "production"` **and** `DEV_USER_ID` set) — inert in prod. Mark each clearly with a `// DEV SHIM — do not commit` comment.

- `dashboard/lib/auth.ts` `getUserClaims()` — first line of the body:
```ts
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID)
    return { id: process.env.DEV_USER_ID, email: "katiemalvani@gmail.com" }; // DEV SHIM — do not commit
```
(The board page reads `getUserClaims`, not `getUserId`; the email must be Katie's so any email-keyed entitlement/invite check resolves to her comped Pro access.)

- `dashboard/lib/auth.ts` `getUserId()` — first line of the body:
```ts
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID)
    return process.env.DEV_USER_ID; // DEV SHIM — do not commit
```

- `dashboard/lib/supabase/middleware.ts` `updateSession()` — first line of the body (before the `NextResponse.next` on line 6):
```ts
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID)
    return NextResponse.next({ request }); // DEV SHIM — do not commit
```

- [ ] **Step 4: Run the dev server and verify Katie's board**

Run (from `dashboard/`): `PORT=3000 npm run dev` (background), then load `http://localhost:3000/`.
Expected: the board renders authed (Prepare / Mark-applied controls, not the Sign-in header) and the **Source** dropdown is **populated** with Katie's ATS sources (before the fix it was empty — that contrast is the proof). Screenshot via claude-in-chrome for the record (subagents can drive `mcp__claude-in-chrome__*`).

**Visible-count caveat (important — visible ≠ server rows):** Katie's saved `profiles.board_filters` decodes to a valid object with `remote: "remote"`, and `applyFilters` honors it — her ~7 non-remote approved rows are hidden, and 1 human-override reject is hidden too — so expect roughly **47-48 visible cards**, not the full ~55 server rows. The Source dropdown is still populated from the full server set (`facetCounts` runs on all server rows **before** the client filter, so it doesn't depend on the Remote toggle). To see all ~55, flip the **Remote** segmented control to **All**. The pass condition is "board is populated (not empty) + Source dropdown populated", not a specific card count.

- [ ] **Step 5: Spot-check the owner and anon boards**

- Owner: set `DEV_USER_ID=9ae8b777-7c24-4290-8aad-bd2b10eff23b` (the operator), reload `/` → the board still renders and its approved-row count **strictly exceeds** its pre-fix engineer-only count (roughly **+70** non-engineer rows added; absolute counts drift daily as jobs close, so assert the *relative* increase, not a fixed number). The owner's saved FilterBar state is **also** `remote: "remote"`, so visible cards reflect that filter — flip **Remote → All** for the full set. (Set the shim email to the owner's if any email-keyed gate matters, or leave it — the owner is comped regardless.)
- Anon: remove `DEV_USER_ID` from `.env.local` (or comment the shim guards), reload `/` → the public board still shows **engineering roles only** (engineer title curation preserved).

- [ ] **Step 6: Tear down the shim — leave a clean tree**

Run (from the **worktree root**, so the `dashboard/...` paths resolve):
```bash
git checkout -- dashboard/lib/auth.ts dashboard/lib/supabase/middleware.ts
git status   # MUST show no shim edits staged or unstaged
```
Remove `DEV_USER_ID` from `dashboard/.env.local` (or delete the file — it is gitignored either way). Stop the dev server. Confirm `git status` shows only the committed Task 1-4 changes (no shim, no `.env.local`).

---

## Stage 5: Final verification, deploy, and prod smoke

- [ ] **Step 1: Full suite + contract + typecheck (from `dashboard/`)**

Run: `npm test && npm run test:ui-contract && npm run typecheck`
Expected: all PASS / clean. (This feature worktree's `node_modules` was installed in Task 1 Step 0. Separately, per `main-worktree-node-modules-stale`: if you later verify in the **main** checkout after merge and see spurious dashboard failures, run `npm install` in that checkout's `dashboard/` first.)

- [ ] **Step 2: Confirm the diff is the fix only**

Local `main` and `origin/main` have diverged (parallel work landed on `origin` — e.g. the stage-2-model-tiers ff push — that local `main` never pulled), so **compare against `origin/main`, not local `main`.** Run (from the **worktree root**):

Run: `git fetch origin && git log --oneline origin/main..HEAD && git diff origin/main --stat`
Expected: `origin/main..HEAD` lists the 3 new commits from Tasks 1, 2, 4 (or 4 commits, if the optional Task 3 db test is included); `--stat` shows touched files limited to `dashboard/lib/config.ts`, `dashboard/lib/filters.ts`, `dashboard/app/page.tsx`, `dashboard/lib/filters.test.ts`, `dashboard/lib/jobsQuery.test.ts`, `dashboard/lib/queries.ts`, `dashboard/lib/rolefit/boardFilters.ts`, `dashboard/lib/queries.boardFilters.test.ts`, `dashboard/lib/queries.saveBoardFilters.db.test.ts` (+ optional `dashboard/lib/queries.boardInclude.db.test.ts`), plus any `docs/plans/*` doc commits. No `.env.local`, no `auth.ts`/`middleware.ts` shim.

- [ ] **Step 3: Integrate `origin/main`, then push (auto-deploys Vercel)**

Frontend-only, no migration file — the board fix (Tasks 1-2) and the `board_filters` write fix (Task 4) ship together in this push. **Deploy the code FIRST; the prod data backfill (Step 5) runs only after Vercel is READY**, because the old code re-pollutes `board_filters` on every filter save until the fixed code is live. Because local `main` is behind `origin/main`, first merge `origin/main` **forward** into the branch (never rebase/force — the repo forbids rewriting commits), re-run the suite if the merge touched anything, then push. Run (from the **worktree root**):
```bash
git fetch origin
git merge origin/main            # a merge commit is fine; resolve any conflict forward
# (re-run `cd dashboard && npm test && npm run test:ui-contract` if the merge changed files)
git push origin HEAD:main
```
(Never amend/rebase/force. If the push is rejected as non-fast-forward, `origin/main` advanced again — fetch + merge forward once more and retry.)

- [ ] **Step 4: Confirm the Vercel deploy is READY**

Wait for the Vercel deployment of the pushed commit to reach **READY** (dashboard project). Do not smoke prod until READY.

- [ ] **Step 5: One-off prod backfill of double-encoded `board_filters` (AFTER Vercel READY)**

Repair the existing double-encoded rows via Supabase MCP `execute_sql` (no migration file — the `package-jsonb-hardening` one-off-repair precedent). **Do this only after Step 4 shows READY** (the fixed write path must be live so no new string rows appear). Idempotent / rerunnable.

(a) **Precheck** — count double-encoded rows and confirm every one is a single-level encode of an object (no non-object, no triple-nesting):

```sql
SELECT
  count(*)                                                       AS total_profiles,
  count(*) FILTER (WHERE board_filters IS NULL)                  AS null_rows,
  count(*) FILTER (WHERE jsonb_typeof(board_filters) = 'object') AS already_object,
  count(*) FILTER (WHERE jsonb_typeof(board_filters) = 'string') AS string_rows,
  count(*) FILTER (WHERE jsonb_typeof(board_filters) = 'string'
                   AND jsonb_typeof((board_filters #>> '{}')::jsonb) = 'object') AS repairable
FROM profiles;
```
Expected: `string_rows = repairable` (every string row's inner text is a JSON object). **Dry-run baseline (as of 2026-07-19; drifts with signups):** `total_profiles=4, null_rows=1, already_object=0, string_rows=3, repairable=3` → the UPDATE (b) should report exactly `UPDATE 3`. If `string_rows ≠ repairable`, **STOP and investigate** (a non-object or multiply-nested value) — do NOT run the UPDATE. (If the SELECT itself errors on `::jsonb`, some inner text is not valid JSON — fail-closed, also stop and investigate.)

**RLS note:** MCP `execute_sql` runs as the table-owner role `postgres`, which **bypasses RLS**, so both the precheck and the UPDATE reach **all** tenants' rows — intended, this is a cross-tenant one-off repair.

(b) **Repair** — unwrap the string scalar back to the object it encodes:

```sql
UPDATE profiles
SET board_filters = (board_filters #>> '{}')::jsonb
WHERE jsonb_typeof(board_filters) = 'string';
```

(c) **Re-run the precheck** — expect `string_rows = 0`. Rerunnable: once fixed, no row is a string, so a second run updates 0 rows.

- [ ] **Step 6: Post-backfill data smoke**

- Katie's row decodes identically: `SELECT jsonb_typeof(board_filters) AS typ, board_filters->>'remote' AS remote FROM profiles WHERE user_id = '92b27148-...'::uuid` → `typ = 'object'` and `remote = 'remote'` (her saved state preserved through the unwrap).
- Save→reload round-trip on prod: as an authed user, change a board filter and reload → the filter persists, and `SELECT jsonb_typeof(board_filters)` for that user is now `'object'` (proves the fixed write path). Repeat-saving does not re-create a string scalar.

- [ ] **Step 7: Board prod smoke**

- Ask Andrew (or Katie) to load the prod board while signed in as Katie (`92b27148`): expect a **populated** board (was empty) with a **populated Source** dropdown. Per Stage 4 Step 4's caveat, her saved Remote filter + 1 hidden reject mean ~**47-48** visible cards; flipping **Remote → All** shows the full ~55. Prod authed pages are **not** viewable via claude-in-chrome (no session cookie → redirects to `/login`), so this check is user-driven — see `local-authed-page-dev-shim`.
- Owner loads their board: expect it still renders and its count **strictly exceeds** its pre-fix engineer-only set (~+70 non-engineer rows) — assert relative growth, not an absolute (his saved Remote filter applies too; flip Remote → All for the full set).
- Anon (logged-out) prod board: expect engineering roles still shown.
- Optional: during a live review run for a non-engineer tenant, confirm streamed matches **persist** after settle (no "appeared then vanished") — the feed/board parity from `include: []`.

---

## Rollback

Single revert commit (no history rewrite):
```bash
git revert <task-1-sha>   # and <task-2-sha>, <task-4-sha> (+ <task-3-sha> if included) if they must go too
git push origin HEAD:main
```
Reverting Task 1 alone restores the old shared-filter behavior (engineer prefilter for all). The test-only commits (Tasks 2-3) are safe to leave or revert independently. No migration means no schema rollback. Because Vercel auto-deploys `main`, the revert push redeploys the prior behavior.

**Double-encode fix (Task 4).** Reverting the write-path commit restores `${JSON.stringify(filters)}::jsonb` and re-introduces double-encoding **on new saves only**. The rows already backfilled in Stage 5 Step 5 stay valid under **both** code versions: `parseBoardFilters` reads a jsonb **object** natively (an object is what it always expected — the string branch is only a tolerance), so a revert does not corrupt already-repaired rows and **no data rollback is needed**. Only saves made after a revert would re-pollute.

---

## Non-goals (do not do here — spec §8)

- Katie's double-encoded `profiles.board_filters` jsonb row — **now IN SCOPE** (Task 4 fixes the write; Stage 5 Step 5 backfills all such prod rows). It was never a cause of the empty board (Tasks 1-2); it moved into this plan per the 2026-07-19 scope change.
- **The other `${JSON.stringify(x)}::jsonb` writers are out of scope.** They share the same double-encode shape (empirically, *every* `${JSON.stringify(x)}::jsonb` stores a jsonb string scalar — objects, arrays, and even number/string scalars), but their reads already tolerate it and none are part of this outage. Behavior-preserving; do NOT fold them into this plan. The grep-verified inventory (for a future dedicated sweep, not now):
  - `dashboard/lib/queries.ts:759,762` — `upsertProfile` links / screening_answers.
  - `dashboard/lib/queries.ts:618-619` — `upsertApplicationPackage` resume / cover-letter / prefilled_answers via the `j()` helper.
  - `dashboard/lib/profileSettings.ts:75,79` — settings-save links / screening_answers.
  - `dashboard/lib/appSettings.ts:131,150,155` — `saveAppSetting` + invite comp-plan / default-allowance.
  - `dashboard/app/actions/resumeScores.ts:57` — resume-score `resume_json`.
  - **Caveat:** `dashboard/lib/appSettings.ts:51` carries a comment marking its `JSON.stringify(n)::jsonb` write as **intended** (its read path relies on the current round-trip). A mechanical sweep must **not** blind-swap that site — it needs its own read-path-aware change.
- Nightly "no active subscription" log noise from a test account — unrelated observability cleanup.
- Option B (per-tenant server-side include preference) / any user-facing authed keyword control — deferred (pre-flight decision 2).

---

## Self-review (author's checklist against the spec)

- **Spec coverage:** §1 root cause (authed `include: []`) → Task 1. §1 secondary (feed/board parity) → Task 1 helper comment + Task 2 parity guard. §5/§6 anon keeps engineer → Task 1 (`serverBoardFilters("anon")`) + Task 2 anon guard. §7 tests (1) no-ILIKE, (2) regression rows-returned, (3) feed/board parity, (4) anon unchanged, (5) ui-contract/jsdom unchanged, (6) live shim → Tasks 2, 3, Stages 4-5. Q1-Q4 → Pre-flight decisions. Perf note (no index/limit change) → Pre-flight #4. Rollback → Rollback section. Non-goals → Non-goals section.
- **Placeholder scan:** none — every step has exact file:line, complete code, exact command, expected output. The one intentional unknown (Katie's full UUID) is flagged as data to obtain, not a code placeholder.
- **Type consistency:** `serverBoardFilters(audience: "authed" | "anon"): Filters` and `PUBLIC_BOARD_INCLUDE_KEYWORDS: string[]` are named identically everywhere they appear (config.ts, filters.ts, both test files, page.tsx). Naming chosen per review: `serverBoardFilters` + union arg disambiguates from the client-side `lib/rolefit/boardFilters.ts`. `buildJobsQuery` signature matches existing usage. `Filters` fixture `base` reused from the existing test file.
- **Verification realism (per review):** no absolute row counts asserted for the owner (relative growth only); Katie's expected **visible** count (~47-48) reflects her saved Remote filter + hidden reject, distinct from her ~55 server rows; diff/deploy compares against `origin/main` (local `main` is stale) and merges forward before pushing; `npm install` (Task 1 Step 0) precedes the first test run.
- **Double-encode scope change (2026-07-19):** Task 4 fixes `saveBoardFilters` to store a jsonb object (empirically verified: old `${JSON.stringify}::jsonb` → `'string'`, `tx.json` → `'object'`, incl. inside `sql.begin`), extracting `saveBoardFiltersWith` to make the real write testable against temp tables (withUserSql can't see them — house pattern). `parseBoardFilters` string-tolerance is kept + documented (anon cookie + legacy rows). Stage 5 deploys code first, then backfills prod (`(board_filters #>> '{}')::jsonb`) via Supabase MCP, then smokes; rollback needs no data undo. RED discriminator is `jsonb_typeof='object'` (the parseBoardFilters round-trip tolerates both forms, so it is a value-integrity guard, not the RED driver).
