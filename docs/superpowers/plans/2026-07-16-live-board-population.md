# Live Board Population Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a review request runs, newly approved jobs stream onto the board within ~4s of being scored, popping in with a highlight — instead of appearing in one batch when the whole run settles.

**Architecture:** The board's existing status poll (`ReviewNowPanel` → `GET /api/review/request`) gains a server-issued `reviewed_at` cursor. The endpoint additionally returns the viewer's approved `job_reviews` rows newer than the cursor, in the exact lean `JobRow` shape the board renders (reusing `buildJobsQuery` under `withUserSql`/RLS). `RolefitBoard` merges those rows as a client overlay (props win on id collision); the settle-time `router.refresh()` remains the authoritative reconcile. Delivery is at-least-once (10s SQL overlap + client dedupe-by-id); anything missed self-heals at settle.

**Tech Stack:** Next.js 16 App Router (dashboard/), postgres.js via `withUserSql` (RLS), vitest 4 (+ jsdom for `.test.tsx`), plain CSS in `app/globals.css` (design-system CSS variables, no Tailwind).

**Spec:** `docs/superpowers/specs/2026-07-16-live-board-population-design.md`

## Global Constraints

- **Never rewrite existing commits** (repo CLAUDE.md). No `--amend`, no rebase, no reset of pushed/seen commits. Fix forward with new commits.
- **No migrations, no Python changes.** `job_reviews.reviewed_at` already exists (schema.sql:150) and the worker already bumps it on upsert (reviewer/db.py:27). Everything in this plan lives in `dashboard/`.
- **Never `as`-cast a value that crossed a process/storage boundary** (dashboard/CLAUDE.md). Delta rows go through the existing `toJobRow` mapper server-side.
- All commands below run from `dashboard/` inside the worktree: `cd /Users/andrew/Scripts/job-board/.claude/worktrees/lexical-puzzling-deer/dashboard`. If `node_modules` is missing (fresh worktree), run `npm install` first.
- Single test file: `npm test -- <path>`. Full suite: `npm test`. Both from `dashboard/`.
- UI code style: inline styles + CSS variables (`var(--token)`), pseudo-state/animation CSS in `app/globals.css`. Match surrounding comment density and idiom.
- Cursor param name is `since`; response fields are `cursor` and `newMatches`; SQL overlap is `interval '10 seconds'`; running-poll cadence is `4_000` ms; highlight lifetime is `2_600` ms. Use these exact values everywhere.
- Do not embed raw control bytes in test string literals (use `\xNN` escapes if ever needed).

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/jobsQuery.ts` | modify | `buildJobsQuery` gains `opts.reviewedSince` predicate |
| `lib/jobsQuery.test.ts` | modify | builder tests for the new option |
| `lib/queries.ts` | modify | new `getReviewFeed(userId, since)` → `{ cursor, newMatches }` |
| `lib/queries.reviewFeed.test.ts` | create | unit tests for `getReviewFeed` (mocked `withUserSql`) |
| `app/api/review/request/route.ts` | modify | GET accepts `?since=`, returns `cursor` + `newMatches` |
| `app/api/review/request/route.test.ts` | modify | route tests for cursor behavior |
| `components/rolefit/ReviewNowPanel.tsx` | modify | cursor threading, `onNewMatches` prop, 4s cadence while running |
| `components/rolefit/ReviewNowPanel.test.tsx` | modify | cursor/cadence/forwarding tests |
| `components/rolefit/JobCard.tsx` | modify | `isNew` prop → `rf-job-card--new` class |
| `components/rolefit/JobCard.test.tsx` | modify | class presence tests |
| `components/rolefit/JobList.tsx` | modify | thread `freshIds` down to cards |
| `app/globals.css` | modify | pop-in + arrival-glow keyframes |
| `components/rolefit/RolefitBoard.tsx` | modify | `liveMatches` overlay, `freshIds`, wiring |
| `components/rolefit/RolefitBoard.liveMatches.test.tsx` | create | board-level integration tests (through the real panel) |

Work on the existing branch `live-board-population` (the spec is already committed there).

---

### Task 1: `buildJobsQuery` gains a `reviewedSince` option

**Files:**
- Modify: `lib/jobsQuery.ts`
- Test: `lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildJobsQuery(f, userId, viewerLocations, opts)` where `opts` is now `{ humanOverrideOnly?: boolean; reviewedSince?: string }`. When `reviewedSince` is set (an ISO timestamp string), the WHERE clause gains `r.reviewed_at > $N::timestamptz - interval '10 seconds'` with the timestamp bound as a parameter. Calling with `reviewedSince` and `userId === null` throws. Task 2 depends on this exact behavior.

- [ ] **Step 1: Write the failing tests**

Append to the `describe("buildJobsQuery", ...)` block in `lib/jobsQuery.test.ts`:

```ts
  test("reviewedSince adds an overlapped reviewed_at predicate bound as a parameter", () => {
    const q = buildJobsQuery(base, UID, [], { reviewedSince: "2026-07-16T00:00:00.000Z" });
    expect(q.text).toContain(
      "r.reviewed_at > $2::timestamptz - interval '10 seconds'",
    );
    expect(q.values).toEqual([UID, "2026-07-16T00:00:00.000Z"]);
  });

  test("reviewedSince composes with viewer locations (placeholders stay aligned)", () => {
    const q = buildJobsQuery(base, UID, ["Phoenix, AZ"], {
      reviewedSince: "2026-07-16T00:00:00.000Z",
    });
    // reviewedSince is pushed in the review-scoped block ($2); locations follow ($3).
    expect(q.text).toContain("r.reviewed_at > $2::timestamptz - interval '10 seconds'");
    expect(q.text).toContain("(j.remote IS TRUE OR j.location = ANY($3))");
    expect(q.values).toEqual([UID, "2026-07-16T00:00:00.000Z", ["Phoenix, AZ"]]);
  });

  test("reviewedSince without a viewer is a programmer error", () => {
    expect(() =>
      buildJobsQuery(base, null, [], { reviewedSince: "2026-07-16T00:00:00.000Z" }),
    ).toThrow(/reviewedSince requires a viewer/);
  });

  test("no reviewedSince → no reviewed_at clause", () => {
    expect(buildJobsQuery(base, UID).text).not.toContain("reviewed_at");
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- lib/jobsQuery.test.ts`
Expected: the 3 new assertions FAIL (`reviewedSince` unknown / predicate absent); all pre-existing tests PASS.

- [ ] **Step 3: Implement the option**

In `lib/jobsQuery.ts`, change the signature's `opts` parameter:

```ts
  opts: { humanOverrideOnly?: boolean; reviewedSince?: string } = {},
```

Then extend the review-scoped filter block. The current end of that block is:

```ts
    // Rejected-view recovery (getRejectedJobs): restrict to the operator's deliberate
    // rejects so AI denies — the bulk of deny rows — don't flood the view.
    if (opts.humanOverrideOnly) where.push("r.human_override IS TRUE");
  }
```

Replace with:

```ts
    // Rejected-view recovery (getRejectedJobs): restrict to the operator's deliberate
    // rejects so AI denies — the bulk of deny rows — don't flood the view.
    if (opts.humanOverrideOnly) where.push("r.human_override IS TRUE");
    // Live-population delta (getReviewFeed): only reviews newer than the client's
    // cursor. The 10s overlap re-sends rows near the boundary — the client dedupes by
    // id, so delivery is at-least-once rather than gapped (in-flight upserts whose
    // reviewed_at predates the cursor snapshot would otherwise be lost).
    if (opts.reviewedSince) {
      where.push(`r.reviewed_at > ${ph()}::timestamptz - interval '10 seconds'`);
      values.push(opts.reviewedSince);
    }
  }
```

And directly after the `const hasReviews = userId !== null;` line at the top, add the guard:

```ts
  // reviewedSince filters the viewer's review join — meaningless without a viewer.
  if (opts.reviewedSince && !hasReviews) {
    throw new Error("buildJobsQuery: reviewedSince requires a viewer (userId)");
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/jobsQuery.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add lib/jobsQuery.ts lib/jobsQuery.test.ts
git commit -m "feat(board): buildJobsQuery reviewedSince option for the live-population delta"
```

---

### Task 2: `getReviewFeed` query function

**Files:**
- Modify: `lib/queries.ts`
- Test (create): `lib/queries.reviewFeed.test.ts`

**Interfaces:**
- Consumes: `buildJobsQuery(f, userId, viewerLocations, { reviewedSince })` from Task 1; existing `withUserSql`, `toJobRow`, `Filters`.
- Produces: `getReviewFeed(userId: string, since: string | null): Promise<{ cursor: string; newMatches: ReviewedJobRow[] }>` exported from `@/lib/queries`. `cursor` is the DB's `now()` as an ISO string. `since === null` → `newMatches: []` with no delta query. Task 3 calls exactly this.

- [ ] **Step 1: Write the failing tests**

Create `lib/queries.reviewFeed.test.ts` (mocked-executor style, mirroring `lib/reviewRequests.test.ts`):

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

// Minimal withUserSql stand-in: the template-tag executor answers from a queue;
// tx.unsafe records the built delta query (text + params) and answers from the same
// queue. Mirrors lib/reviewRequests.test.ts.
const state = vi.hoisted(() => ({
  calls: [] as { text: string; values: unknown[] }[],
  unsafeCalls: [] as { text: string; params: unknown[] }[],
  rowQueue: [] as unknown[][],
}));

function tx(strings: readonly string[], ...values: unknown[]) {
  state.calls.push({ text: strings.join(" "), values });
  return Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);
}
tx.unsafe = (text: string, params: unknown[]) => {
  state.unsafeCalls.push({ text, params });
  return Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);
};

vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
  withAnonSql: (fn: (t: unknown) => unknown) => fn(tx),
}));

import { getReviewFeed } from "@/lib/queries";

beforeEach(() => {
  state.calls.length = 0;
  state.unsafeCalls.length = 0;
  state.rowQueue.length = 0;
});

const CURSOR_DATE = new Date("2026-07-16T12:00:00.000Z");

describe("getReviewFeed", () => {
  test("since=null only establishes the cursor — no delta query runs", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);
    const feed = await getReviewFeed("u1", null);
    expect(feed).toEqual({ cursor: "2026-07-16T12:00:00.000Z", newMatches: [] });
    expect(state.unsafeCalls).toHaveLength(0);
  });

  test("with since: runs the approve-verdict delta scoped to the viewer's locations", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);                 // SELECT now()
    state.rowQueue.push([{ preferred_locations: ["Phoenix, AZ"] }]); // profile locations
    state.rowQueue.push([
      {
        id: "greenhouse:acme:1", title: "Staff Engineer", location: "Phoenix, AZ",
        remote: true, first_seen_at: new Date("2026-07-01T00:00:00.000Z"),
        closed_at: null, company_name: "Acme", ats: "greenhouse",
        verdict: "approve", human_override: false, corrected: false,
        role_category: "engineering", seniority: "staff", work_arrangement: "remote",
        pay_min: 150000, pay_max: 200000, pay_currency: "USD", pay_period: "year",
        headcount: null, skills_score: 8, experience_score: 8, comp_score: 8,
        fit_score: 88, skill_gaps: [],
      },
    ]);
    const feed = await getReviewFeed("u1", "2026-07-16T11:59:00.000Z");
    expect(feed.cursor).toBe("2026-07-16T12:00:00.000Z");
    expect(feed.newMatches).toHaveLength(1);
    // toJobRow normalized the timestamp; the row is board-shaped.
    expect(feed.newMatches[0]).toMatchObject({
      id: "greenhouse:acme:1",
      first_seen_at: "2026-07-01T00:00:00.000Z",
      fit_score: 88,
    });
    // The delta query carries the cursor predicate, approve verdict, and locations.
    expect(state.unsafeCalls).toHaveLength(1);
    const { text, params } = state.unsafeCalls[0];
    expect(text).toContain("::timestamptz - interval '10 seconds'");
    expect(text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
    expect(params).toEqual(["u1", "2026-07-16T11:59:00.000Z", ["Phoenix, AZ"]]);
  });

  test("profile-less viewer (no locations row) still queries with empty locations", async () => {
    state.rowQueue.push([{ cursor: CURSOR_DATE }]);
    state.rowQueue.push([]); // no profiles row
    state.rowQueue.push([]);
    const feed = await getReviewFeed("u1", "2026-07-16T11:59:00.000Z");
    expect(feed.newMatches).toEqual([]);
    expect(state.unsafeCalls[0].params).toEqual(["u1", "2026-07-16T11:59:00.000Z"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/queries.reviewFeed.test.ts`
Expected: FAIL — `getReviewFeed` is not exported.

- [ ] **Step 3: Implement `getReviewFeed`**

In `lib/queries.ts`, add after the `getRejectedJobs` function (it reuses the same `Filters`-literal pattern):

```ts
// Live board population (spec 2026-07-16): the viewer's approved matches reviewed
// after `since`, in the exact lean JobRow shape the board list renders, plus a fresh
// server-issued cursor. The cursor is captured BEFORE the delta query so a row
// committing between the two statements is returned now AND on the next tick — the
// 10s overlap in buildJobsQuery plus the client's dedupe-by-id make delivery
// at-least-once, never gapped. since=null (the client's first poll) only establishes
// the cursor. The stream is cosmetic-best-effort: the settle-time router.refresh()
// re-runs the authoritative board query, so a missed tick can't persist wrong state.
export async function getReviewFeed(
  userId: string,
  since: string | null,
): Promise<{ cursor: string; newMatches: ReviewedJobRow[] }> {
  return withUserSql(userId, async (tx) => {
    const crow = await tx`SELECT now() AS cursor`;
    const raw = (crow[0] as { cursor: Date | string }).cursor;
    const cursor = raw instanceof Date ? raw.toISOString() : String(raw);
    if (!since) return { cursor, newMatches: [] };
    // Same location pre-filter as the server-rendered board (app/page.tsx passes the
    // viewer's preferred_locations into getJobs) — resolved here so the route stays
    // one call.
    const prow = await tx`
      SELECT preferred_locations FROM profiles WHERE user_id = ${userId}::uuid
    `;
    const viewerLocations =
      (prow[0] as { preferred_locations: string[] } | undefined)?.preferred_locations ?? [];
    const f: Filters = {
      companies: [], include: [], exclude: [], remoteOnly: false,
      status: "open", verdict: "approve",
      experience: "", industry: "", subcategory: "", location: "",
    };
    const { text, values } = buildJobsQuery(f, userId, viewerLocations, {
      reviewedSince: since,
    });
    const rows = await tx.unsafe(text, values as never[]);
    return {
      cursor,
      newMatches: (rows as unknown as Record<string, unknown>[]).map(toJobRow),
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/queries.reviewFeed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the neighboring query suites (regression)**

Run: `npm test -- lib/queries.test.ts lib/jobsQuery.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts lib/queries.reviewFeed.test.ts
git commit -m "feat(board): getReviewFeed — cursor + approved-match delta for live population"
```

---

### Task 3: `GET /api/review/request` accepts `?since=` and returns `cursor` + `newMatches`

**Files:**
- Modify: `app/api/review/request/route.ts`
- Test: `app/api/review/request/route.test.ts`

**Interfaces:**
- Consumes: `getReviewFeed(userId, since)` from Task 2.
- Produces: `GET` now takes the standard `Request` argument. Response body gains `cursor: string` (always) and `newMatches: JobRow[]` (empty array unless a valid `since` was sent and new approvals exist). An unparseable `since` is treated as absent. `POST` is unchanged. Task 4's client polls this shape.

- [ ] **Step 1: Update/extend the tests (they will fail first)**

In `app/api/review/request/route.test.ts`:

(a) Add the queries mock next to the existing hoisted mocks:

```ts
const q = vi.hoisted(() => ({ getReviewFeed: vi.fn() }));
vi.mock("@/lib/queries", () => q);
```

(b) In `beforeEach`, add:

```ts
  q.getReviewFeed.mockReset();
  q.getReviewFeed.mockResolvedValue({ cursor: "2026-07-16T12:00:00.000Z", newMatches: [] });
```

(c) `GET` now takes a `Request`. Update the two existing `GET` calls:

```ts
const res = await GET(new Request("http://test/api/review/request"));
```

(d) The strict-equality body test gains the new fields — update its expectation to:

```ts
    expect(body).toEqual({
      status: "running", remaining: 7, plan: "standard", reviewedToday: 3,
      cursor: "2026-07-16T12:00:00.000Z", newMatches: [],
    });
```

(e) Append these tests to the `describe("GET /api/review/request", ...)` block:

```ts
  test("no since param → feed called with null (cursor-establishing poll)", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue("standard");
    rr.getLatestReviewRequest.mockResolvedValue({ status: "running" });
    rr.remainingDailyBudget.mockResolvedValue(7);
    rr.reviewsChargedToday.mockResolvedValue(3);
    await GET(new Request("http://test/api/review/request"));
    expect(q.getReviewFeed).toHaveBeenCalledWith("u1", null);
  });

  test("valid since is forwarded and newMatches pass through", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue("standard");
    rr.getLatestReviewRequest.mockResolvedValue({ status: "running" });
    rr.remainingDailyBudget.mockResolvedValue(7);
    rr.reviewsChargedToday.mockResolvedValue(3);
    q.getReviewFeed.mockResolvedValue({
      cursor: "2026-07-16T12:00:05.000Z",
      newMatches: [{ id: "greenhouse:acme:1" }],
    });
    const since = encodeURIComponent("2026-07-16T12:00:00.000Z");
    const res = await GET(new Request(`http://test/api/review/request?since=${since}`));
    expect(q.getReviewFeed).toHaveBeenCalledWith("u1", "2026-07-16T12:00:00.000Z");
    const body = await res.json();
    expect(body.cursor).toBe("2026-07-16T12:00:05.000Z");
    expect(body.newMatches).toEqual([{ id: "greenhouse:acme:1" }]);
  });

  test("unparseable since is treated as absent (cursor re-established, no delta)", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue("standard");
    rr.getLatestReviewRequest.mockResolvedValue({ status: "running" });
    rr.remainingDailyBudget.mockResolvedValue(7);
    rr.reviewsChargedToday.mockResolvedValue(3);
    await GET(new Request("http://test/api/review/request?since=not-a-date"));
    expect(q.getReviewFeed).toHaveBeenCalledWith("u1", null);
  });
```

- [ ] **Step 2: Run tests to verify the new/updated ones fail**

Run: `npm test -- app/api/review/request/route.test.ts`
Expected: FAIL — `GET` ignores its argument / body lacks `cursor`/`newMatches`.

- [ ] **Step 3: Implement the route change**

In `app/api/review/request/route.ts`:

(a) Add the import:

```ts
import { getReviewFeed } from "@/lib/queries";
```

(b) Replace the whole `GET` function with:

```ts
// GET → latest request status + remaining budget (client polls this while active).
// With ?since=<cursor>: also the viewer's approved matches reviewed after the cursor
// (live board population) plus a fresh server-issued cursor — the client echoes it
// back, so no client clock is ever trusted. `since` values are only ever cursors this
// endpoint issued; anything unparseable is treated as absent (cursor re-established,
// no delta) — safe because the settle-time board refresh reconciles authoritatively.
export async function GET(request: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const userId = claims.id;

  const sinceRaw = new URL(request.url).searchParams.get("since");
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : null;

  const plan = await getViewerPlan(userId, claims.email);
  const [latest, remaining, reviewedToday, feed] = await Promise.all([
    getLatestReviewRequest(userId),
    remainingDailyBudget(userId, plan),
    reviewsChargedToday(userId),
    getReviewFeed(userId, since),
  ]);
  return Response.json(
    // reviewedToday = the first-run progress figure ("N roles scored so far").
    {
      status: latest?.status ?? null, remaining, plan, reviewedToday,
      cursor: feed.cursor, newMatches: feed.newMatches,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/review/request/route.test.ts`
Expected: PASS (all, including the updated pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add app/api/review/request/route.ts app/api/review/request/route.test.ts
git commit -m "feat(board): review-request GET returns cursor + newMatches for ?since= polls"
```

---

### Task 4: `ReviewNowPanel` — cursor threading, `onNewMatches`, 4s cadence while running

**Files:**
- Modify: `components/rolefit/ReviewNowPanel.tsx`
- Test: `components/rolefit/ReviewNowPanel.test.tsx`

**Interfaces:**
- Consumes: the Task 3 response shape (`cursor`, `newMatches`).
- Produces: new optional prop `onNewMatches?: (rows: JobRow[]) => void` on `ReviewNowPanelProps` (`JobRow` from `@/lib/types`). Called only with non-empty arrays. The panel polls every **4s while `running`**, 10s while `pending`. `onSettled` semantics unchanged. Task 6 passes a stable (useCallback) handler — the panel may list `onNewMatches` in its `poll` deps.

- [ ] **Step 1: Write the failing tests**

In `components/rolefit/ReviewNowPanel.test.tsx`:

(a) Extend the shared fetch mock to record URLs. Replace the `beforeEach` body's fetch assignment with:

```ts
  fetchUrls = [];
  global.fetch = vi.fn(async (url: unknown) => {
    fetchUrls.push(String(url));
    return { ok: true, json: async () => nextResponse };
  }) as unknown as typeof fetch;
```

and declare next to `nextResponse`:

```ts
let fetchUrls: string[] = [];
```

(b) Add a `JobRow` fixture at top level (import the type):

```ts
import type { JobRow } from "@/lib/types";

const matchRow: JobRow = {
  id: "greenhouse:acme:1",
  title: "Staff Engineer",
  location: "Phoenix, AZ",
  remote: true,
  first_seen_at: "2026-07-01T00:00:00.000Z",
  closed_at: null,
  company_name: "Acme",
  ats: "greenhouse",
  human_override: false,
  verdict: "approve",
  role_category: "engineering",
  seniority: "staff",
  work_arrangement: "remote",
  pay_min: 150000,
  pay_max: 200000,
  pay_currency: "USD",
  pay_period: "year",
  headcount: null,
  skills_score: 8,
  experience_score: 8,
  comp_score: 8,
  fit_score: 88,
  skill_gaps: [],
};
```

(c) Add a new describe block:

```tsx
describe("ReviewNowPanel — live-population cursor poll", () => {
  test("first poll carries no since; the server cursor threads into the next poll", async () => {
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0);
    expect(fetchUrls[0]).toBe("/api/review/request");

    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [] };
    await flush(4_000);
    expect(fetchUrls[1]).toBe("/api/review/request?since=C1");
  });

  test("forwards non-empty newMatches to onNewMatches; empty ticks stay silent", async () => {
    const onNewMatches = vi.fn();
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} onNewMatches={onNewMatches} />);
    await flush(0);
    expect(onNewMatches).not.toHaveBeenCalled();

    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [matchRow] };
    await flush(4_000);
    expect(onNewMatches).toHaveBeenCalledTimes(1);
    expect(onNewMatches).toHaveBeenCalledWith([matchRow]);
  });

  test("polls every 4s while running, but keeps 10s while pending", async () => {
    nextResponse = { status: "pending", cursor: "C1" };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0);           // initial poll
    expect(fetchUrls).toHaveLength(1);
    await flush(4_000);       // pending: 4s is NOT enough
    expect(fetchUrls).toHaveLength(1);
    nextResponse = { status: "running", cursor: "C2" };
    await flush(6_000);       // pending tick fires at 10s → status flips to running
    expect(fetchUrls).toHaveLength(2);
    await flush(4_000);       // running: 4s cadence
    expect(fetchUrls).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- components/rolefit/ReviewNowPanel.test.tsx`
Expected: new describe FAILS (no `since` param, no `onNewMatches` prop, 10s cadence); all pre-existing tests PASS (the existing `flush(10_000)` calls comfortably cover a 4s timer).

- [ ] **Step 3: Implement the panel changes**

In `components/rolefit/ReviewNowPanel.tsx`:

(a) Add the type import:

```ts
import type { JobRow } from "@/lib/types";
```

(b) Extend the props interface:

```ts
export interface ReviewNowPanelProps {
  // The board has zero jobs but unreviewed roles are waiting — show the full
  // "being built" CTA when no request is active.
  firstRun?: boolean;
  // Called once when an active request settles as 'done' — the board refreshes so the
  // new matches render (replacing the old reload-on-next-visit behavior).
  onSettled?: () => void;
  // Live population: called with each poll's newly approved matches (never empty) so
  // the board can merge them in while the run is still going. Pass a STABLE callback —
  // it participates in the poll closure's deps.
  onNewMatches?: (rows: JobRow[]) => void;
}
```

and destructure it: `export function ReviewNowPanel({ firstRun = false, onSettled, onNewMatches }: ReviewNowPanelProps) {`

(c) Add the cursor ref next to `timerRef`:

```ts
  // Server-issued reviewed_at cursor (GET's `cursor` field), echoed back as ?since= on
  // the next poll. Server clock only — the client never contributes a timestamp.
  const cursorRef = useRef<string | null>(null);
```

(d) Replace the `poll` callback with:

```ts
  const poll = useCallback(async () => {
    try {
      const url = cursorRef.current
        ? `/api/review/request?since=${encodeURIComponent(cursorRef.current)}`
        : "/api/review/request";
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        status?: Status; remaining?: number; reviewedToday?: number;
        cursor?: string; newMatches?: JobRow[];
      };
      setStatus(data.status ?? null);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (typeof data.reviewedToday === "number") setReviewedToday(data.reviewedToday);
      if (typeof data.cursor === "string") cursorRef.current = data.cursor;
      if (data.newMatches && data.newMatches.length > 0) onNewMatches?.(data.newMatches);
    } catch {
      /* transient — the next poll or a manual retry recovers; the cursor is unchanged,
         so the 10s overlap + settle-refresh make the skipped tick harmless */
    }
  }, [onNewMatches]);
```

(e) In the polling effect, change the interval line and its comment:

```ts
  // Poll WHILE a request is active — every 4s while running (matches arrive in
  // concurrency-5 bursts, so this is effectively per-burst live), 10s while queued
  // (nothing to stream yet). Stops when it settles.
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    wasActiveRef.current = true;
    timerRef.current = setTimeout(() => void poll(), status === "running" ? 4_000 : 10_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, status, poll]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- components/rolefit/ReviewNowPanel.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add components/rolefit/ReviewNowPanel.tsx components/rolefit/ReviewNowPanel.test.tsx
git commit -m "feat(board): ReviewNowPanel threads the review-feed cursor and emits onNewMatches"
```

---

### Task 5: `JobCard`/`JobList` arrival highlight + CSS

**Files:**
- Modify: `components/rolefit/JobCard.tsx`
- Modify: `components/rolefit/JobList.tsx`
- Modify: `app/globals.css`
- Test: `components/rolefit/JobCard.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure UI).
- Produces: `JobCardProps` gains `isNew?: boolean` (adds class `rf-job-card--new` to the card root). `JobListProps` gains `freshIds?: Set<string>`, threaded through both the virtualized and plain lists as `isNew={freshIds?.has(job.id) ?? false}`. Task 6 passes `freshIds`.

- [ ] **Step 1: Write the failing tests**

Append to `components/rolefit/JobCard.test.tsx` (reuse the file's existing `JobRow` fixture if one exists at top level; otherwise add this one inside the new describe):

```tsx
describe("JobCard — live-arrival highlight", () => {
  const popJob: JobRow = {
    id: "greenhouse:acme:1",
    title: "Staff Engineer",
    location: "Phoenix, AZ",
    remote: true,
    first_seen_at: "2026-07-01T00:00:00.000Z",
    closed_at: null,
    company_name: "Acme",
    ats: "greenhouse",
    human_override: false,
    verdict: "approve",
    role_category: "engineering",
    seniority: "staff",
    work_arrangement: "remote",
    pay_min: 150000,
    pay_max: 200000,
    pay_currency: "USD",
    pay_period: "year",
    headcount: null,
    skills_score: 8,
    experience_score: 8,
    comp_score: 8,
    fit_score: 88,
    skill_gaps: [],
  };

  test("isNew adds the arrival class to the card root", () => {
    const { container } = render(
      <JobCard job={popJob} selected={false} onSelect={() => {}} isNew />,
    );
    expect(container.querySelector(".rf-job-card.rf-job-card--new")).toBeTruthy();
  });

  test("without isNew the arrival class is absent", () => {
    const { container } = render(
      <JobCard job={popJob} selected={false} onSelect={() => {}} />,
    );
    expect(container.querySelector(".rf-job-card")).toBeTruthy();
    expect(container.querySelector(".rf-job-card--new")).toBeNull();
  });
});
```

(Match the file's existing imports — it already imports `render`/`JobCard`; add `JobRow` type import if not present.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- components/rolefit/JobCard.test.tsx`
Expected: new tests FAIL (unknown `isNew` prop / class absent); pre-existing PASS.

- [ ] **Step 3: Implement**

(a) `components/rolefit/JobCard.tsx` — extend props and the root div:

```ts
export interface JobCardProps {
  job: JobRow;
  selected: boolean;
  onSelect: (id: string) => void;
  // Hover/focus-revealed reject × on the card (#14). Absent → no × is rendered.
  onReject?: (id: string) => void;
  // Live population: TRUE for ~2.6s after this row streamed in mid-review — plays the
  // pop-in + arrival-glow entrance (app/globals.css .rf-job-card--new).
  isNew?: boolean;
}

export const JobCard = React.memo(function JobCard({ job, selected, onSelect, onReject, isNew }: JobCardProps) {
```

and change the root element:

```tsx
    <div className={isNew ? "rf-job-card rf-job-card--new" : "rf-job-card"} data-selected={selected || undefined}>
```

(b) `components/rolefit/JobList.tsx` — add to `JobListProps`:

```ts
  // Live population: ids that streamed in within the last ~2.6s — each matching card
  // renders with the arrival entrance (JobCard isNew).
  freshIds?: Set<string>;
```

Thread it: add `freshIds` to the `JobList` destructure, to `VirtualJobList`'s props (both the param destructure and its inline props type — `freshIds?: Set<string>;`), and pass it at both call sites. Both `JobCard` usages gain:

```tsx
  isNew={freshIds?.has(job.id) ?? false}
```

(c) `app/globals.css` — add after the `.rf-card-reject` rules block:

```css
/* Live board population (spec 2026-07-16): a match streamed in mid-review pops in and
   its surface glows before decaying to the resting inline background. from-only
   keyframes animate toward each card's own computed style, and a CSS animation
   outranks the button's inline background while it plays — no inline coordination
   needed. Both animations collapse under the global prefers-reduced-motion override
   below (motion gone, a sub-frame of glow — effectively appear-in-place). */
@keyframes rf-card-pop-in {
  from { opacity: 0; transform: translateY(6px); }
}
@keyframes rf-card-arrival-glow {
  from { background: var(--accent-bg); }
}
.rf-job-card--new { animation: rf-card-pop-in .35s ease-out; }
.rf-job-card--new .rf-job-card__button { animation: rf-card-arrival-glow 2.5s ease-out; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- components/rolefit/JobCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/rolefit/JobCard.tsx components/rolefit/JobList.tsx app/globals.css components/rolefit/JobCard.test.tsx
git commit -m "feat(board): arrival pop-in highlight for live-streamed job cards"
```

---

### Task 6: `RolefitBoard` — live-matches overlay and wiring

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx`
- Test (create): `components/rolefit/RolefitBoard.liveMatches.test.tsx`

**Interfaces:**
- Consumes: `ReviewNowPanel`'s `onNewMatches` (Task 4); `JobList`'s `freshIds` (Task 5).
- Produces: user-visible behavior — approved matches merge into the board mid-run, respect the active client filters/sort, pop in highlighted, and are superseded by server props on id collision. No new exports.

- [ ] **Step 1: Write the failing integration tests**

Create `components/rolefit/RolefitBoard.liveMatches.test.tsx`. It drives the REAL panel poll with fake timers. Key jsdom choice: stub `matchMedia` to `matches: true` (narrow layout) so `JobList` renders the plain, non-virtualized list (the virtualizer would render nothing against a 0-height jsdom scroll pane).

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

// Live board population (spec 2026-07-16), integration-tested through the REAL
// ReviewNowPanel poll: fetch answers with newMatches, and the board must merge,
// highlight, dedupe-against-props, and expire the highlight.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function makeJob(id: string, title: string): JobRow {
  return {
    id, title,
    location: "Phoenix, AZ", remote: true,
    first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
    company_name: "Acme", ats: "greenhouse", human_override: false,
    verdict: "approve", role_category: "engineering", seniority: "staff",
    work_arrangement: "remote", pay_min: 150000, pay_max: 200000,
    pay_currency: "USD", pay_period: "year", headcount: null,
    skills_score: 8, experience_score: 8, comp_score: 8, fit_score: 88,
    skill_gaps: [],
  };
}

const baseProps: RolefitBoardProps = {
  jobs: [],
  nowIso: "2026-07-16T00:00:00.000Z",
  isAuthed: true,
  initialFilters: DEFAULT_FILTERS,
  saveResume: vi.fn(async () => {}),
  rejectJob: vi.fn(async () => {}),
  unrejectJob: vi.fn(async () => {}),
  markApplied: vi.fn(async () => {}),
  unmarkApplied: vi.fn(async () => {}),
  // unreviewed > 0 mounts the ReviewNowPanel — the poll under test.
  operator: { health: "ok", unreviewed: 5, reviewed: 0 },
  hasProfile: true,
  viewerEmail: "u@x.com",
  resumeText: "resume text",
  currentProfileVersion: null,
  initialPackages: [],
  initialRejected: [],
  initialJobQuestions: {},
};

// Narrow layout: JobList renders the plain (non-virtualized) list, which jsdom can
// actually lay out (the virtualizer against a 0-height pane would mount no rows).
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// The panel's polls answer from this mutable response (same pattern as
// ReviewNowPanel.test.tsx); non-review fetches answer benignly.
let nextResponse: Record<string, unknown> = { status: null };

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubMatchMedia();
  window.history.replaceState({}, "", "/");
  nextResponse = { status: null };
  global.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.startsWith("/api/review/request")) {
      return { ok: true, status: 200, json: async () => nextResponse };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  }) as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe("RolefitBoard — live population", () => {
  test("streamed matches appear mid-run with the arrival highlight, then it expires", async () => {
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} />);
    await flush(0); // initial poll — establishes the cursor
    expect(screen.queryByText("Staff Engineer")).toBeNull();

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "Staff Engineer")],
    };
    await flush(4_000); // running-cadence poll delivers the match
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(document.querySelector(".rf-job-card--new")).toBeTruthy();

    // Quiet next tick so the arrival isn't re-flagged; highlight expires at 2.6s.
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C3", newMatches: [] };
    await flush(2_600);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(document.querySelector(".rf-job-card--new")).toBeNull();
  });

  test("props win: a streamed row whose id is already in props never duplicates or overrides", async () => {
    const propsJob = makeJob("greenhouse:acme:1", "Staff Engineer");
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} jobs={[propsJob]} />);
    await flush(0);

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "STALE TITLE — MUST NOT RENDER")],
    };
    await flush(4_000);
    expect(screen.getAllByText("Staff Engineer")).toHaveLength(1);
    expect(screen.queryByText("STALE TITLE — MUST NOT RENDER")).toBeNull();
  });

  test("multiple ticks accumulate distinct matches", async () => {
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} />);
    await flush(0);

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "Staff Engineer")],
    };
    await flush(4_000);
    nextResponse = {
      status: "running", reviewedToday: 2, cursor: "C3",
      newMatches: [makeJob("greenhouse:acme:2", "Platform Engineer")],
    };
    await flush(4_000);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByText("Platform Engineer")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- components/rolefit/RolefitBoard.liveMatches.test.tsx`
Expected: FAIL — streamed matches never render (`onNewMatches` unwired).

- [ ] **Step 3: Implement the overlay in `RolefitBoard.tsx`**

(a) **State + handler.** After the `corrections` state declaration (`const [corrections, setCorrections] = useState<Record<string, Partial<JobRow>>>({});`), add:

```ts
  // Live-population overlay (spec 2026-07-16): matches streamed in by ReviewNowPanel's
  // cursor poll while a review runs. Props win — boardJobs drops any entry whose id is
  // already in `jobs`, so the settle-time router.refresh() naturally supersedes the
  // overlay (entries are retained until unmount; render-time dedupe is the prune, kept
  // out of an effect so no setState-on-props-change cascade).
  const [liveMatches, setLiveMatches] = useState<Record<string, JobRow>>({});
  // Ids that arrived within the last ~2.6s — drives the card's pop-in highlight.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const freshTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timers = freshTimersRef.current;
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);
  const handleNewMatches = useCallback((rows: JobRow[]) => {
    setLiveMatches((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = r;
      return next;
    });
    const ids = rows.map((r) => r.id);
    setFreshIds((prev) => new Set([...prev, ...ids]));
    const timer = setTimeout(() => {
      freshTimersRef.current.delete(timer);
      setFreshIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, 2_600);
    freshTimersRef.current.add(timer);
  }, []);
```

(b) **`boardJobs` memo.** Immediately before the `appliedSet` memo, add:

```ts
  // The board's working list: server rows plus live-streamed arrivals not yet in props.
  const boardJobs = useMemo(() => {
    const ids = new Set(jobs.map((j) => j.id));
    const extras = Object.values(liveMatches).filter((m) => !ids.has(m.id));
    return extras.length ? [...jobs, ...extras] : jobs;
  }, [jobs, liveMatches]);
```

(c) **Swap `jobs` → `boardJobs` in the downstream pipeline** (each with its dep array):

- `appliedSet`: `boardJobs.filter(...)`, deps `[boardJobs, packages]`
- `facets`: `facetCounts(boardJobs)`, deps `[boardJobs]`
- `rejectedPool`: `mergeRejectedPool(boardJobs, initialRejected)`, deps `[boardJobs, initialRejected]`
- `visible`: `applyFilters(view === "rejected" ? rejectedPool : boardJobs, filterState)`, deps `[boardJobs, rejectedPool, filterState, rejectedIds, appliedSet, view]`
- `totalInView`: `filterByView(view === "rejected" ? rejectedPool : boardJobs, ...)`, deps `[boardJobs, rejectedPool, view, rejectedIds, appliedSet]`

Leave every other `jobs` usage alone (e.g. server-sourced things that must not see overlay rows).

(d) **Wire the panel and the list.** Change the panel mount to:

```tsx
      {isAuthed && (operator?.unreviewed ?? 0) > 0 && (
        <ReviewNowPanel
          firstRun={boardJobs.length === 0}
          onSettled={() => router.refresh()}
          onNewMatches={handleNewMatches}
        />
      )}
```

And in the `<JobList ...>` props, change `hasUnfilteredJobs={jobs.length > 0}` to `hasUnfilteredJobs={boardJobs.length > 0}` and add:

```tsx
              freshIds={freshIds}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npm test -- components/rolefit/RolefitBoard.liveMatches.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the neighboring component suites (regression)**

Run: `npm test -- components/rolefit/RolefitBoard.test.tsx components/rolefit/JobList.tsx components/rolefit/ReviewNowPanel.test.tsx components/rolefit/JobCard.test.tsx`
Expected: PASS. (If `JobList.tsx` isn't a test file, vitest skips it — the important ones are the three test suites.)

- [ ] **Step 6: Commit**

```bash
git add components/rolefit/RolefitBoard.tsx components/rolefit/RolefitBoard.liveMatches.test.tsx
git commit -m "feat(board): merge live-streamed review matches into the board with pop-in highlight"
```

---

### Task 7: Full verification

**Files:** none new — verification only.

- [ ] **Step 1: Full dashboard test suite**

Run (from `dashboard/`): `npm test`
Expected: PASS. Note: `parseProfile`'s binary-fixture test skips in a worktree — that skip is expected (memory: worktree-tests-and-fixtures).

- [ ] **Step 2: Lint + types + production build**

Run: `npx next lint 2>/dev/null || npm run lint` then `npm run build`
Expected: no lint errors in touched files; build succeeds. (Use whichever lint script `package.json` defines; if none, the build's type-check is the gate.)

- [ ] **Step 3: Contract/UI suites**

Run: `npm run test:ui-contract`
Expected: PASS (main enforces UI cohesion contracts; this must be green before merge).

- [ ] **Step 4: Live smoke (manual, real browser)**

Follow the dev-shim harness (memory: local-authed-page-dev-shim): run the dashboard locally with the auth shim + `DEV_USER_ID`, open the board for a user with an enqueue-able review (or enqueue via the "Review my board now" CTA), and confirm:
- matches appear within ~4s of being scored, with the pop-in + glow;
- the highlight decays (~2.5s) to the normal card surface, in **both** light and dark themes;
- on settle, the board refreshes and nothing duplicates or vanishes;
- with `prefers-reduced-motion: reduce` (macOS: System Settings → Accessibility → Display → Reduce motion), arrivals appear without motion.

If a live review can't be driven locally, the fallback is manually inserting a `job_reviews` row (approve verdict, `reviewed_at = now()`) for the dev user while the panel shows an active request — the poll must pick it up.

- [ ] **Step 5: Commit any verification fixes, then finish the branch**

Any fixes discovered here get their own commits (never amend). Then use superpowers:finishing-a-development-branch to merge/PR `live-board-population`.

---

## Self-review notes (already applied)

- Spec coverage: cursor semantics (server-issued, overlap, at-least-once) → Tasks 1–3; panel cadence + `onNewMatches` → Task 4; pop-in + reduced motion → Task 5; overlay merge, props-win dedupe, filter/sort integration, panel wiring → Task 6; testing + live smoke → Tasks 1–7. The spec's "prune, don't clear" is realized as render-time dedupe with retained overlay entries (bounded by run size) — functionally identical, avoids a setState-in-effect lint violation (see 2808430).
- Type consistency: `onNewMatches(rows: JobRow[])` (Task 4 produce = Task 6 consume); `freshIds?: Set<string>` / `isNew?: boolean` (Task 5 produce = Task 6 consume); `getReviewFeed(userId, since)` (Task 2 produce = Task 3 consume); `reviewedSince` option (Task 1 produce = Task 2 consume).
- The `visible`/`totalInView` swap keeps `rejectedPool` (already rebuilt from `boardJobs`) as the rejected-view source, so overlay rows can't leak into the Rejected view as phantom rejects.
