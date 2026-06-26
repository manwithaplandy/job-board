# Public Job Board + Profile Redirect + Location Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the job board publicly viewable (including the operator's AI verdicts), keep only the resume/instructions editor behind login, return to the board after saving a profile, and add a lightweight location filter.

**Architecture:** The dashboard is single-tenant by design (one operator). The board resolves a single **board-owner** user id from the `profiles` table and renders that user's `job_reviews` to everyone; auth state only changes the Header (Sign in vs. Profile/Sign out + operator telemetry) and access to `/profile`. `buildJobsQuery` gains a nullable-owner branch (no review join when there is no owner). The location filter is a plain `j.location ILIKE` clause that applies with or without an owner.

**Tech Stack:** Next.js 15.5.19 (App Router, Server Components/Actions), TypeScript, postgres.js (`sql`), @supabase/ssr (Auth + Storage), vitest.

## Global Constraints

- **Direct SQL for all app data, scoped by `user_id`**; Supabase client only for Auth + Storage.
- **postgres.js** binds JS strings as text — every `uuid` comparison needs a `::uuid` cast.
- **Single-tenant, no RLS/tenant-isolation hardening** — exactly one operator; "the board owner" is the single `profiles` row.
- **Tests:** vitest, runner `npm test` (= `vitest run`); the harness only includes `lib/**/*.test.ts` (`environment: node`). Pure-function modules (`paths`, `filters`, `jobsQuery`) are unit-tested; `app/` components/actions and DB-touching `queries.ts` functions are verified by `npx tsc --noEmit` + `npm run build` + manual E2E (no React/DB test harness exists — do not invent one).
- **Build** needs `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `dashboard/.env.local`. Type-check (`npx tsc --noEmit`) needs no env and is the fast gate for non-unit-tested tasks.
- **Redirect pattern:** server actions use `import { redirect } from "next/navigation"` then `redirect("/")` as the final statement (see `app/login/page.tsx:1,13`). `redirect()` throws `NEXT_REDIRECT`, so it must be last and outside try/catch.
- All work on a feature branch off `main` (not committed straight to `main`). Each commit message ends with the `Claude-Session:` trailer per repo convention.
- All commands below assume CWD `dashboard/` unless noted.

---

### Task 1: Redirect to the board after saving a profile

**Files:**
- Modify: `dashboard/app/profile/page.tsx` (the `saveProfile` server action)

**Interfaces:**
- Consumes: `redirect` from `next/navigation`.
- Produces: nothing other tasks depend on.

No unit test: this is a Server Action, outside the `lib/**` vitest harness. Verified by type-check + build + manual.

- [ ] **Step 1: Add the import**

At the top of `dashboard/app/profile/page.tsx`, add the import (keep the existing imports):

```typescript
import { redirect } from "next/navigation";
```

- [ ] **Step 2: Redirect at the end of `saveProfile`**

In `saveProfile`, after the existing final line `await upsertProfile(userId, { resumeText, instructions, resumeFilePath });`, append:

```typescript
  redirect("/");
```

The function tail now reads:

```typescript
  await upsertProfile(userId, { resumeText, instructions, resumeFilePath });
  redirect("/");
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat(profile): redirect to board after saving profile"
```

---

### Task 2: Make `/` a public route

**Files:**
- Modify: `dashboard/lib/paths.ts`
- Test: `dashboard/lib/paths.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isPublicPath("/") === true` (relied on by the middleware guard in `lib/supabase/middleware.ts`, unchanged).

- [ ] **Step 1: Update the failing test**

Replace the body of `dashboard/lib/paths.test.ts` with:

```typescript
import { describe, expect, test } from "vitest";
import { isPublicPath } from "@/lib/paths";

describe("isPublicPath", () => {
  test("home, login, and auth callback are public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });
  test("profile and other routes are private", () => {
    expect(isPublicPath("/profile")).toBe(false);
    expect(isPublicPath("/something")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/paths.test.ts`
Expected: FAIL — `isPublicPath("/")` returns `false` (currently only `/login` and `/auth` are public).

- [ ] **Step 3: Make `/` public**

In `dashboard/lib/paths.ts`, add `"/"` to the prefix list:

```typescript
const PUBLIC_PREFIXES = ["/", "/login", "/auth"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
```

Note: the matcher makes only the *exact* `/` public — `"/profile" === "/"` is false and `"/profile".startsWith("//")` is false — so `/profile` stays private.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/paths.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/paths.ts lib/paths.test.ts
git commit -m "feat(auth): make / a public route"
```

---

### Task 3: Nullable board-owner in the query layer

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts` (signature `userId: string | null`; null branch)
- Modify: `dashboard/lib/queries.ts` (add `getBoardOwnerId`; widen `getJobs` signature)
- Test: `dashboard/lib/jobsQuery.test.ts` (add null-owner cases)

**Interfaces:**
- Consumes: `Filters` from `@/lib/filters`; `sql` from `@/lib/db`.
- Produces:
  - `buildJobsQuery(f: Filters, userId: string | null): { text: string; values: unknown[] }`
  - `getBoardOwnerId(): Promise<string | null>`
  - `getJobs(f: Filters, userId: string | null): Promise<JobRow[]>`

- [ ] **Step 1: Add failing null-owner tests**

Append these tests inside the `describe("buildJobsQuery", …)` block in `dashboard/lib/jobsQuery.test.ts` (keep all existing tests — they cover the owner branch and must stay green):

```typescript
  test("null owner: no review join, columns, error clause, or user binding", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("job_reviews");
    expect(q.text).not.toContain("r.verdict");
    expect(q.text).not.toContain("r.error IS NULL");
    expect(q.text).toContain("j.closed_at IS NULL"); // plain status filter still applies
    expect(q.values).toEqual([]);
  });

  test("null owner: plain filters bind from $1", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, null);
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.values).toEqual([[1, 2]]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL — current `buildJobsQuery` always seeds `values=[userId]` and always emits the review join, so the null cases throw/mismatch.

- [ ] **Step 3: Rewrite `buildJobsQuery` with a nullable-owner branch**

Replace the entire contents of `dashboard/lib/jobsQuery.ts` with:

```typescript
import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(f: Filters, userId: string | null): SqlQuery {
  const values: unknown[] = [];
  const ph = () => `$${values.length + 1}`;
  const where: string[] = [];
  const hasReviews = userId !== null;

  // The review join binds the owner's user_id as $1, so seed it before any other value.
  if (hasReviews) values.push(userId);

  // --- review-scoped filters (only when an owner's reviews are joined) ---
  if (hasReviews) {
    if (f.verdict === "approve") where.push("r.verdict = 'approve'");
    else if (f.verdict === "deny") where.push("r.verdict = 'deny'");
    else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
    else if (f.verdict === "pending") where.push("r.job_id IS NULL");
    // "all" adds no verdict clause
    where.push("r.error IS NULL");
  }

  // --- plain job filters (apply with or without an owner) ---
  if (f.status === "open") where.push("j.closed_at IS NULL");
  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");

  if (f.companies.length) {
    where.push(`j.company_id = ANY(${ph()})`);
    values.push(f.companies);
  }
  for (const kw of f.include) {
    where.push(`j.title ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  for (const kw of f.exclude) {
    where.push(`j.title NOT ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  if (f.remoteOnly) where.push("j.remote IS TRUE");

  // --- review dimension filters (only on verdicts that carry review columns) ---
  if (hasReviews && (f.verdict === "approve" || f.verdict === "deny" || f.verdict === "all")) {
    const dimensions: [string, string][] = [
      [f.experience, "r.experience_match"],
      [f.industry, "r.industry"],
      [f.subcategory, "r.industry_subcategory"],
    ];
    for (const [value, col] of dimensions) {
      if (value) {
        where.push(`${col} = ${ph()}`);
        values.push(value);
      }
    }
  }

  const selectCols = [
    "j.id", "j.title", "j.url", "j.location", "j.remote",
    "j.first_seen_at", "j.closed_at", "c.name AS company_name", "c.ats",
  ];
  if (hasReviews) {
    selectCols.push(
      "r.verdict", "r.experience_match", "r.industry", "r.industry_subcategory",
      "r.confidence", "r.reasoning", "r.stage1_decision", "r.stage1_reason",
    );
  }
  const reviewJoin = hasReviews
    ? "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid"
    : "";

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    `SELECT ${selectCols.join(", ")}`,
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    reviewJoin,
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
```

- [ ] **Step 4: Run the full jobsQuery suite to verify it passes**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: PASS — all pre-existing owner-branch tests plus the 2 new null-owner tests.

- [ ] **Step 5: Add `getBoardOwnerId` and widen `getJobs` in `queries.ts`**

In `dashboard/lib/queries.ts`, change the `getJobs` signature to accept a nullable id (body unchanged otherwise):

```typescript
export async function getJobs(f: Filters, userId: string | null): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f, userId);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}
```

Add this new function (place it after `getJobs`):

```typescript
export async function getBoardOwnerId(): Promise<string | null> {
  // Single-tenant: the one operator whose verdicts the public board shows.
  const rows = await sql`SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`app/page.tsx` still passes a `string` to `getJobs`, which is assignable to `string | null`; `getBoardOwnerId` is exported and used in Task 4.)

- [ ] **Step 7: Commit**

```bash
git add lib/jobsQuery.ts lib/jobsQuery.test.ts lib/queries.ts
git commit -m "feat(jobs): support a nullable board owner in the jobs query"
```

---

### Task 4: Public board wiring (page + components)

**Files:**
- Modify: `dashboard/app/page.tsx`
- Modify: `dashboard/components/Header.tsx`
- Modify: `dashboard/components/FilterBar.tsx`
- Modify: `dashboard/components/JobsTable.tsx`

**Interfaces:**
- Consumes: `getUserId` (`lib/auth.ts`), `getBoardOwnerId`/`getJobs` (Task 3).
- Produces: `Header` gains `isAuthed: boolean`; `FilterBar` gains `showReviewFilters: boolean`; `JobsTable` gains `showMatch: boolean`.

No unit test (App Router page + React components are outside the `lib/**` harness). Verified by type-check + build + manual.

- [ ] **Step 1: Rewrite `app/page.tsx` to render publicly**

Replace the entire contents of `dashboard/app/page.tsx` with:

```typescript
import { parseFilters } from "@/lib/filters";
import {
  getBoardOwnerId, getCompanies, getJobs, getLatestPollRun,
  getLatestReviewRun, getReviewStats,
} from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { getUserId } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewerId, ownerId] = await Promise.all([getUserId(), getBoardOwnerId()]);
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun] = await Promise.all([
    getJobs(filters, ownerId),
    getCompanies(),
    getLatestPollRun(),
  ]);
  // Operator-only run telemetry; hidden from anonymous visitors.
  const [lastReview, reviewStats] = viewerId
    ? await Promise.all([getLatestReviewRun(), getReviewStats(viewerId)])
    : [null, null];

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} lastReview={lastReview}
        reviewStats={reviewStats} isAuthed={!!viewerId} />
      <FilterBar companies={companies} filters={filters} showReviewFilters={!!ownerId} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS}
        showMatch={!!ownerId} />
    </main>
  );
}
```

- [ ] **Step 2: Make the Header auth-aware**

In `dashboard/components/Header.tsx`, add `isAuthed` to the props type:

```typescript
export function Header({
  lastRun,
  health,
  lastReview,
  reviewStats,
  isAuthed,
}: {
  lastRun: PollRunRow | null;
  health: Health;
  lastReview: ReviewRunRow | null;
  reviewStats: ReviewStats | null;
  isAuthed: boolean;
}) {
```

Replace the trailing `Profile` link + sign-out `<form>` (the last two elements before `</div>`) with:

```typescript
        {isAuthed ? (
          <>
            <a href="/profile" className="text-blue-700 hover:underline">Profile</a>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-blue-700 hover:underline">Sign out</button>
            </form>
          </>
        ) : (
          <a href="/login" className="text-blue-700 hover:underline">Sign in</a>
        )}
```

The `lastReview`/`reviewStats` spans already render only when truthy, so they disappear for anonymous visitors (passed as `null`).

- [ ] **Step 3: Gate the review filters in `FilterBar`**

In `dashboard/components/FilterBar.tsx`, add `showReviewFilters` to the props type:

```typescript
export function FilterBar({
  companies,
  filters,
  showReviewFilters,
}: {
  companies: CompanyRow[];
  filters: Filters;
  showReviewFilters: boolean;
}) {
```

Wrap the four review `SelectFilter`s (Verdict, Experience, Industry, Subcategory) in a conditional. Replace that block with:

```typescript
      {showReviewFilters && (
        <>
          <SelectFilter label="Verdict" name="verdict" value={filters.verdict}
            options={VERDICT_OPTIONS} />

          <SelectFilter label="Experience" name="experience" value={filters.experience}
            options={EXPERIENCE_OPTIONS} includeAny />

          <SelectFilter label="Industry" name="industry" value={filters.industry}
            options={INDUSTRY_OPTIONS} includeAny />

          <SelectFilter label="Subcategory" name="subcategory" value={filters.subcategory}
            options={SUBCATEGORY_OPTIONS} includeAny />
        </>
      )}
```

- [ ] **Step 4: Gate the Match column in `JobsTable`**

In `dashboard/components/JobsTable.tsx`, add `showMatch` to the props type:

```typescript
export function JobsTable({
  jobs,
  nowIso,
  windowHours,
  showMatch,
}: {
  jobs: JobRow[];
  nowIso: string;
  windowHours: number;
  showMatch: boolean;
}) {
```

In the `<thead>`, make the Match header conditional — replace `<th className="px-6 py-2">Match</th>` with:

```typescript
          {showMatch && <th className="px-6 py-2">Match</th>}
```

In the `<tbody>` row, wrap the entire Match `<td>` (the `<td className="px-6 py-2 text-gray-600">` containing the `j.verdict ? … : …` expression) so it renders only when `showMatch`:

```typescript
            {showMatch && (
              <td className="px-6 py-2 text-gray-600">
                {j.verdict ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {j.verdict}
                      {j.experience_match ? ` · ${j.experience_match}` : ""}
                    </span>
                    {j.industry && (
                      <span className="text-xs text-gray-500">
                        {j.industry}{j.industry_subcategory ? ` / ${j.industry_subcategory}` : ""}
                      </span>
                    )}
                    {j.reasoning && (
                      <span className="text-xs text-gray-400" title={j.reasoning}>
                        {j.reasoning.length > 80 ? `${j.reasoning.slice(0, 80)}…` : j.reasoning}
                      </span>
                    )}
                  </span>
                ) : j.stage1_decision === "reject" ? (
                  <span className="text-xs text-gray-400" title={j.stage1_reason ?? ""}>gate-rejected</span>
                ) : (
                  <span className="text-xs text-gray-400">pending</span>
                )}
              </td>
            )}
```

- [ ] **Step 5: Type-check and verify existing unit tests still pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all existing unit tests PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds (requires `dashboard/.env.local`). The `/` route compiles as a dynamic server route.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/Header.tsx components/FilterBar.tsx components/JobsTable.tsx
git commit -m "feat(board): public job board, gate only the profile editor"
```

---

### Task 5: Location filter

**Files:**
- Modify: `dashboard/lib/filters.ts` (add `location` field + parsing)
- Test: `dashboard/lib/filters.test.ts` (location parse/default)
- Modify: `dashboard/lib/jobsQuery.ts` (location ILIKE clause)
- Test: `dashboard/lib/jobsQuery.test.ts` (location clause; update `base` fixture)
- Modify: `dashboard/components/FilterBar.tsx` (Location input)

**Interfaces:**
- Consumes: `Filters` (extended with `location: string`).
- Produces: `Filters.location: string` (default `""`); `?location=` query param; a `j.location ILIKE` clause in `buildJobsQuery` that applies in both owner and null-owner branches.

- [ ] **Step 1: Add failing filters test**

In `dashboard/lib/filters.test.ts`, update the "empty params → defaults" expectation to include `location: ""`, and add a parse test. The default-equality test's object becomes:

```typescript
    expect(parseFilters({}, D)).toEqual({
      companies: [],
      include: ["engineer"],
      exclude: [],
      remoteOnly: false,
      status: "open",
      verdict: "approve",
      experience: "",
      industry: "",
      subcategory: "",
      location: "",
    });
```

Add this test inside the `describe`:

```typescript
  test("parses location and suppresses default include", () => {
    const f = parseFilters({ location: "remote" }, D);
    expect(f.location).toBe("remote");
    expect(f.include).toEqual([]);
  });
```

- [ ] **Step 2: Run filters test to verify it fails**

Run: `npx vitest run lib/filters.test.ts`
Expected: FAIL — `parseFilters` does not yet return a `location` field.

- [ ] **Step 3: Add `location` to `filters.ts`**

In `dashboard/lib/filters.ts`:

Add the field to the `Filters` interface (after `subcategory`):

```typescript
  subcategory: string;
  location: string;
```

Add `"location"` to `FILTER_KEYS` (so a bare `?location=` suppresses default include keywords, matching `status`/`verdict`):

```typescript
const FILTER_KEYS = [
  "company", "include", "exclude", "remote", "status",
  "verdict", "experience", "industry", "subcategory", "location",
] as const;
```

Add the field to the returned object (after `subcategory`):

```typescript
    subcategory: first(params.subcategory) ?? "",
    location: first(params.location) ?? "",
```

- [ ] **Step 4: Run filters test to verify it passes**

Run: `npx vitest run lib/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Add failing jobsQuery location tests**

In `dashboard/lib/jobsQuery.test.ts`, first add `location: ""` to the shared `base` fixture (after `subcategory: ""`) so it satisfies the extended `Filters` type:

```typescript
  subcategory: "",
  location: "",
```

Then add these tests inside the `describe`:

```typescript
  test("location filter adds an ILIKE clause in the owner branch", () => {
    const q = buildJobsQuery({ ...base, location: "remote" }, UID);
    expect(q.text).toContain("j.location ILIKE $2");
    expect(q.values).toEqual([UID, "%remote%"]);
  });

  test("location filter applies without an owner, binding from $1", () => {
    const q = buildJobsQuery({ ...base, location: "berlin" }, null);
    expect(q.text).toContain("j.location ILIKE $1");
    expect(q.values).toEqual(["%berlin%"]);
  });
```

- [ ] **Step 6: Run jobsQuery tests to verify the new ones fail**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL on the two location tests (no `j.location ILIKE` clause yet); pre-existing tests still PASS.

- [ ] **Step 7: Add the location clause to `jobsQuery.ts`**

In `dashboard/lib/jobsQuery.ts`, in the plain-job-filters section, immediately after the `if (f.remoteOnly) where.push("j.remote IS TRUE");` line, add:

```typescript
  if (f.location) {
    where.push(`j.location ILIKE ${ph()}`);
    values.push(`%${f.location}%`);
  }
```

- [ ] **Step 8: Run the full jobsQuery suite to verify it passes**

Run: `npx vitest run lib/jobsQuery.test.ts`
Expected: PASS (all owner-branch, null-owner, and location tests).

- [ ] **Step 9: Add the Location input to `FilterBar`**

In `dashboard/components/FilterBar.tsx`, add a Location text input after the "Title excludes" `<label>` block (and before the Status `<label>`):

```typescript
      <label className="flex flex-col text-xs text-gray-600">
        Location
        <input
          name="location"
          defaultValue={filters.location}
          className="mt-1 rounded border px-2 py-1 text-sm"
          placeholder="remote, berlin"
        />
      </label>
```

- [ ] **Step 10: Type-check, full unit run, and build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all unit tests PASS; build succeeds.

- [ ] **Step 11: Commit**

```bash
git add lib/filters.ts lib/filters.test.ts lib/jobsQuery.ts lib/jobsQuery.test.ts components/FilterBar.tsx
git commit -m "feat(filters): add location filter to the job board"
```

---

## Final Verification

- [ ] **Full unit suite:** `cd dashboard && npm test` — all `lib/**` tests green.
- [ ] **Build:** `cd dashboard && npm run build` — succeeds with `dashboard/.env.local` set.
- [ ] **Manual E2E (deployed or `npm run dev`):**
  - Logged **out** at `/`: the board renders with the **Match** column and the Verdict/Experience/Industry/Subcategory filters (owner's verdicts are public); the **Location** and Title/Status/Remote/Companies filters work; the Header shows **Sign in**; the operator telemetry ("Reviews:", "N unreviewed") is absent.
  - Logged **out** visiting `/profile`: redirected to `/login`.
  - Before any profile exists (no board owner): the board still renders plain listings with the Match column and review filters hidden.
  - Logged **in**: same board; Header shows **Profile** + **Sign out** + telemetry; `/profile` loads; **saving a profile lands back on `/`**.
  - **Location filter:** `?location=remote` (or a city) narrows the table; the URL form input round-trips the value.
  - Optional: drive the deployed URL with the Chrome MCP to confirm the logged-out board renders and the `/profile` → `/login` bounce.

## Self-Review notes

- **Spec coverage:** profile redirect (Task 1), public board incl. verdicts (Tasks 2–4), profile editor stays gated (Task 2 `/profile` private + Task 4 Header), location filter (Task 5). All three requests covered.
- **Green at every commit:** Task 3 widens `getJobs` to `string | null` and adds an unused-until-Task-4 `getBoardOwnerId` — `app/page.tsx` still compiles (passes a `string`). Task 2 makes `/` public in middleware while `page.tsx` still calls `requireUserId()` until Task 4, so the intermediate state is safe (still gated), never broken.
- **Type consistency:** `Filters.location: string`; `buildJobsQuery(f, userId: string | null)`; `getJobs(f, userId: string | null)`; `getBoardOwnerId(): Promise<string | null>`; component props `isAuthed`/`showReviewFilters`/`showMatch` are all `boolean`. The shared `base`/default fixtures in both test files are updated to include `location: ""` in Task 5, the same task that adds the field — no fixture references the field before it exists.
- **Owner vs viewer:** the board uses `ownerId` for verdict data (public) and `viewerId` only for the Header/telemetry and `/profile` access; in single-tenant they coincide.
