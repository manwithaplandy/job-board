# Board Filter Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a visitor's board filters across visits — cookie-backed for anonymous users, `profiles.board_filters`-backed for logged-in users — with no flash of default filters on load.

**Architecture:** A single `POST /api/board-filters` endpoint validates incoming filters and persists them by auth state (DB for authed, HttpOnly cookie for anon). `app/page.tsx` reads the right source server-side and passes a fully-resolved `initialFilters` into `RolefitBoard`, which initializes its state from it and POSTs (debounced) on change. Login adopts any anonymous cookie filters into the account.

**Tech Stack:** Next.js 15.5 (App Router, Server Components, route handlers), React 19, TypeScript, Postgres via `postgres.js` (`@/lib/db`), Supabase auth, Vitest (node env).

## Global Constraints

- **Filter saves MUST NOT modify `profiles.updated_at`.** `getBoardOwnerId()` resolves the single-tenant board owner via `SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1`; bumping `updated_at` would let an authed viewer hijack the board owner.
- **Filter saves MUST be UPDATE-only (never INSERT).** `profiles.profile_version` is `NOT NULL` with no default; an authed user with no profile row simply doesn't get DB-persisted filters (accepted).
- **`parseBoardFilters` gates every read and every write.** Stale/malformed cookie or DB data must never crash SSR or be persisted unvalidated.
- **Persistence is best-effort.** Save failures are logged server-side and never block filtering or surface to the user.
- **Tests live under `dashboard/lib/**/*.test.ts`** (vitest `include` glob) and run in the `node` environment — no jsdom. React components and route handlers are verified by `tsc` + manual browser/curl, not unit tests.
- **npm commands run from `dashboard/`.** Migrations live at repo-root `migrations/`.
- **Every commit message ends with:** `Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c`

---

### Task 1: Add `board_filters` column (migration + schema + type)

**Files:**
- Create: `migrations/2026-06-29-board-filters.sql`
- Modify: `dashboard/schema.sql` (profiles table, after `model_company`)
- Modify: `dashboard/lib/types.ts:71-85` (`ProfileRow`)

**Interfaces:**
- Consumes: nothing.
- Produces: `profiles.board_filters JSONB` (nullable); `ProfileRow.board_filters: BoardFilterState | null`.

- [ ] **Step 1: Create the migration file**

`migrations/2026-06-29-board-filters.sql`:
```sql
-- Incremental migration for the live Supabase DB (schema.sql holds the full schema).
-- Per-user remembered board filter state (search, categories, locations, remote,
-- min fit, min pay, sort). NULL = no saved filters (board shows defaults).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS board_filters JSONB;
```

- [ ] **Step 2: Mirror the column into `schema.sql`**

In `dashboard/schema.sql`, add the column to the `profiles` table immediately after the `model_company` line:
```sql
  model_company           TEXT,
  board_filters    JSONB,                     -- remembered board filter state; NULL = defaults
  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
```

- [ ] **Step 3: Add the field to `ProfileRow`**

In `dashboard/lib/types.ts`, add to the `ProfileRow` interface after `model_company`:
```ts
  model_company: string | null;
  board_filters: import("@/lib/rolefit/filter").BoardFilterState | null;
  profile_version: string;
```

- [ ] **Step 4: Typecheck**

Run (from `dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-06-29-board-filters.sql dashboard/schema.sql dashboard/lib/types.ts
git commit -m "feat(db): add profiles.board_filters column for remembered filters

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

> **Deploy note (not a local step):** the migration must be applied to the live Supabase DB before/with the deploy of this branch (per deploy topology). Task 8 applies it to the DB used for manual verification.

---

### Task 2: `DEFAULT_FILTERS` + `parseBoardFilters` (pure, TDD)

**Files:**
- Modify: `dashboard/lib/rolefit/filter.ts:3-11` (add `DEFAULT_FILTERS` after the interface)
- Create: `dashboard/lib/rolefit/boardFilters.ts`
- Test: `dashboard/lib/rolefit/boardFilters.test.ts`

**Interfaces:**
- Consumes: `BoardFilterState` (from `filter.ts`).
- Produces:
  - `DEFAULT_FILTERS: BoardFilterState` (in `filter.ts`)
  - `parseBoardFilters(raw: unknown): BoardFilterState`
  - `serializeBoardFilters(f: BoardFilterState): string`

- [ ] **Step 1: Add `DEFAULT_FILTERS` to `filter.ts`**

In `dashboard/lib/rolefit/filter.ts`, directly after the `BoardFilterState` interface (line 11):
```ts
export const DEFAULT_FILTERS: BoardFilterState = {
  search: "",
  cats: [],
  locs: [],
  remote: "all",
  minFit: 0,
  payMin: 0,
  sort: "match",
};
```

- [ ] **Step 2: Write the failing test**

`dashboard/lib/rolefit/boardFilters.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { parseBoardFilters, serializeBoardFilters } from "@/lib/rolefit/boardFilters";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

describe("parseBoardFilters", () => {
  test("null/undefined/garbage/non-object → all defaults", () => {
    expect(parseBoardFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters(undefined)).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters("not json")).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters(42)).toEqual(DEFAULT_FILTERS);
  });

  test("parses a valid JSON string", () => {
    const f = parseBoardFilters(
      '{"search":"eng","cats":["Backend"],"locs":["Berlin"],"remote":"remote","minFit":75,"payMin":150,"sort":"pay"}',
    );
    expect(f).toEqual({
      search: "eng", cats: ["Backend"], locs: ["Berlin"],
      remote: "remote", minFit: 75, payMin: 150, sort: "pay",
    });
  });

  test("parses a plain object and falls back per-field for missing keys", () => {
    expect(parseBoardFilters({ search: "x" })).toEqual({ ...DEFAULT_FILTERS, search: "x" });
  });

  test("invalid enum values fall back to defaults", () => {
    expect(parseBoardFilters({ remote: "moon", sort: "weird" })).toMatchObject({
      remote: "all", sort: "match",
    });
  });

  test("negative, non-finite, or wrong-typed numbers → 0", () => {
    expect(parseBoardFilters({ minFit: -5, payMin: Infinity })).toMatchObject({ minFit: 0, payMin: 0 });
    expect(parseBoardFilters({ minFit: "75" })).toMatchObject({ minFit: 0 });
  });

  test("array fields drop non-strings and cap at 50 entries", () => {
    expect(parseBoardFilters({ cats: ["a", 5, null, "b"] }).cats).toEqual(["a", "b"]);
    const many = Array.from({ length: 80 }, (_, i) => `c${i}`);
    expect(parseBoardFilters({ cats: many }).cats).toHaveLength(50);
  });

  test("non-array cats/locs → []", () => {
    expect(parseBoardFilters({ cats: "Backend" }).cats).toEqual([]);
  });

  test("over-long search is truncated to 200 chars", () => {
    expect(parseBoardFilters({ search: "x".repeat(500) }).search).toHaveLength(200);
  });

  test("serialize → parse round-trips", () => {
    const f = { ...DEFAULT_FILTERS, search: "hi", cats: ["X"], remote: "hybrid" as const };
    expect(parseBoardFilters(serializeBoardFilters(f))).toEqual(f);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `dashboard/`): `npx vitest run lib/rolefit/boardFilters.test.ts`
Expected: FAIL — cannot resolve `@/lib/rolefit/boardFilters`.

- [ ] **Step 4: Implement `boardFilters.ts`**

`dashboard/lib/rolefit/boardFilters.ts`:
```ts
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

const REMOTE = new Set<BoardFilterState["remote"]>(["all", "remote", "hybrid", "onsite"]);
const SORT = new Set<BoardFilterState["sort"]>(["match", "pay", "newest", "az"]);
const MAX_SEARCH = 200;
const MAX_ITEMS = 50;
const MAX_ITEM_LEN = 120;

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.length <= MAX_ITEM_LEN) out.push(x);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

function nonNegNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function defaults(): BoardFilterState {
  return { ...DEFAULT_FILTERS, cats: [], locs: [] };
}

export function parseBoardFilters(raw: unknown): BoardFilterState {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return defaults(); }
  }
  if (obj == null || typeof obj !== "object") return defaults();
  const o = obj as Record<string, unknown>;
  return {
    search: typeof o.search === "string" ? o.search.slice(0, MAX_SEARCH) : DEFAULT_FILTERS.search,
    cats: strList(o.cats),
    locs: strList(o.locs),
    remote: REMOTE.has(o.remote as BoardFilterState["remote"])
      ? (o.remote as BoardFilterState["remote"]) : DEFAULT_FILTERS.remote,
    minFit: nonNegNum(o.minFit),
    payMin: nonNegNum(o.payMin),
    sort: SORT.has(o.sort as BoardFilterState["sort"])
      ? (o.sort as BoardFilterState["sort"]) : DEFAULT_FILTERS.sort,
  };
}

export function serializeBoardFilters(f: BoardFilterState): string {
  return JSON.stringify(f);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `dashboard/`): `npx vitest run lib/rolefit/boardFilters.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (was 131, now 140 — 9 new).

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/boardFilters.ts dashboard/lib/rolefit/boardFilters.test.ts
git commit -m "feat(filters): add DEFAULT_FILTERS and parseBoardFilters validator

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 3: `saveBoardFilters` query (TDD — guards the safety constraints)

**Files:**
- Modify: `dashboard/lib/queries.ts` (add import + function after `getProfile`, ~line 84)
- Test: `dashboard/lib/queries.boardFilters.test.ts`

**Interfaces:**
- Consumes: `sql` (`@/lib/db`), `BoardFilterState` (`@/lib/rolefit/filter`).
- Produces: `saveBoardFilters(userId: string, filters: BoardFilterState): Promise<void>`.

- [ ] **Step 1: Add the import**

At the top of `dashboard/lib/queries.ts`, add a new import:
```ts
import type { BoardFilterState } from "@/lib/rolefit/filter";
```

- [ ] **Step 2: Write the failing test**

This locks in the two safety constraints (UPDATE-only, never `updated_at`/`INSERT`) by mocking `sql`
to capture the query text and bound values — no DB needed.

`dashboard/lib/queries.boardFilters.test.ts`:
```ts
import { describe, expect, test, vi, beforeEach } from "vitest";

// Capture every tagged-template call made through the db `sql` helper.
const { calls } = vi.hoisted(() => ({
  calls: [] as { strings: readonly string[]; values: unknown[] }[],
}));
vi.mock("@/lib/db", () => ({
  sql: (strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    return Promise.resolve([]);
  },
}));

import { saveBoardFilters } from "@/lib/queries";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

beforeEach(() => {
  calls.length = 0;
});

describe("saveBoardFilters", () => {
  test("issues a bare UPDATE — never touches updated_at, never INSERTs", async () => {
    await saveBoardFilters("11111111-1111-1111-1111-111111111111", {
      ...DEFAULT_FILTERS,
      sort: "pay",
    });
    expect(calls).toHaveLength(1);
    const text = calls[0].strings.join("?");
    expect(text).toMatch(/UPDATE\s+profiles/i);
    expect(text).toMatch(/board_filters/);
    expect(text).not.toMatch(/updated_at/i);
    expect(text).not.toMatch(/INSERT/i);
  });

  test("binds the serialized filters and the user id", async () => {
    const filters = { ...DEFAULT_FILTERS, sort: "pay" as const };
    await saveBoardFilters("22222222-2222-2222-2222-222222222222", filters);
    expect(calls[0].values[0]).toBe(JSON.stringify(filters));
    expect(calls[0].values[1]).toBe("22222222-2222-2222-2222-222222222222");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `dashboard/`): `npx vitest run lib/queries.boardFilters.test.ts`
Expected: FAIL — `saveBoardFilters` is not exported.

- [ ] **Step 4: Add the function**

After `getProfile` (around line 84) in `dashboard/lib/queries.ts`:
```ts
export async function saveBoardFilters(
  userId: string,
  filters: BoardFilterState,
): Promise<void> {
  // UPDATE-only and intentionally does NOT touch updated_at: getBoardOwnerId()
  // resolves the single-tenant board owner by most-recent updated_at, and
  // profile_version is NOT NULL with no default — so we must not INSERT a row
  // or bump updated_at when persisting a viewer's filters.
  await sql`
    UPDATE profiles
    SET board_filters = ${JSON.stringify(filters)}::jsonb
    WHERE user_id = ${userId}::uuid
  `;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `dashboard/`): `npx vitest run lib/queries.boardFilters.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (now 142 — 2 new).

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/queries.boardFilters.test.ts
git commit -m "feat(queries): add saveBoardFilters (UPDATE-only, no updated_at)

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 4: `POST /api/board-filters` route handler

**Files:**
- Create: `dashboard/app/api/board-filters/route.ts`

**Interfaces:**
- Consumes: `getUserId` (`@/lib/auth`), `saveBoardFilters` (`@/lib/queries`), `parseBoardFilters` (`@/lib/rolefit/boardFilters`), `cookies` (`next/headers`).
- Produces: `POST` handler at `/api/board-filters`. Authed → writes `profiles.board_filters`; anon → sets HttpOnly `board_filters` cookie. Always returns `200`.

- [ ] **Step 1: Create the route handler**

`dashboard/app/api/board-filters/route.ts`:
```ts
import { cookies } from "next/headers";
import { getUserId } from "@/lib/auth";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters, serializeBoardFilters } from "@/lib/rolefit/boardFilters";

const COOKIE = "board_filters";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Malformed body → parseBoardFilters yields defaults.
  }
  const filters = parseBoardFilters(body);

  try {
    const userId = await getUserId();
    if (userId) {
      await saveBoardFilters(userId, filters);
    } else {
      const store = await cookies();
      store.set(COOKIE, serializeBoardFilters(filters), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE,
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    // Best-effort: never block filtering on a persistence failure.
    console.error("board-filters save failed", e);
    return Response.json({ ok: false }, { status: 200 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run (from `dashboard/`): `npx tsc --noEmit`
Expected: no errors.

> Behavioral verification (curl) is in Task 8, once a dev server with env is running.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/board-filters/route.ts
git commit -m "feat(api): add POST /api/board-filters (DB for authed, cookie for anon)

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 5: Server-side initial read + `initialFilters` prop

**Files:**
- Modify: `dashboard/app/page.tsx:29-63`
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx:15-47` (props + state init)

**Interfaces:**
- Consumes: `parseBoardFilters` (`@/lib/rolefit/boardFilters`), `cookies` (`next/headers`), `BoardFilterState` (`@/lib/rolefit/filter`).
- Produces: `RolefitBoard` accepts `initialFilters: BoardFilterState` and seeds its 7 filter `useState`s from it.

- [ ] **Step 1: Compute `initialFilters` in `page.tsx`**

In `dashboard/app/page.tsx`:

Add imports near the top:
```ts
import { cookies } from "next/headers";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import type { BoardFilterState } from "@/lib/rolefit/filter";
```

Replace the `let operator…; if (viewerId) { … }` block (lines 29-48) with:
```ts
  let operator: OperatorSignals | undefined;
  let hasProfile = false;
  let resumeText = "";
  let initialFilters: BoardFilterState;
  if (viewerId) {
    const [pollRun, reviewStats, profile] = await Promise.all([
      getLatestPollRun(),
      getReviewStats(viewerId),
      getProfile(viewerId),
    ]);
    operator = {
      health: computeHealth(
        pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
        new Date(),
        STALE_HEALTH_HOURS,
      ),
      unreviewed: reviewStats.unreviewed,
    };
    hasProfile = profile != null; // a saved profile row exists
    resumeText = profile?.resume_text ?? "";
    initialFilters = parseBoardFilters(profile?.board_filters);
  } else {
    const store = await cookies();
    initialFilters = parseBoardFilters(store.get("board_filters")?.value);
  }
```

- [ ] **Step 2: Pass the prop**

In the `<RolefitBoard … />` JSX in `page.tsx`, add the prop (e.g. after `isAuthed`):
```tsx
      isAuthed={!!viewerId}
      initialFilters={initialFilters}
```

- [ ] **Step 3: Accept the prop and seed state in `RolefitBoard.tsx`**

Add to `RolefitBoardProps` (after `isAuthed: boolean;`):
```ts
  isAuthed: boolean;
  initialFilters: BoardFilterState;
```

Destructure it in the component signature (after `isAuthed,`):
```ts
  isAuthed,
  initialFilters,
```

Replace the hardcoded filter-state initializers (lines 41-47) with:
```ts
  // Filter state — seeded from persisted filters (cookie/DB) resolved on the server.
  const [search, setSearch] = useState(initialFilters.search);
  const [cats, setCats] = useState<string[]>(initialFilters.cats);
  const [locs, setLocs] = useState<string[]>(initialFilters.locs);
  const [remote, setRemote] = useState<BoardFilterState["remote"]>(initialFilters.remote);
  const [minFit, setMinFit] = useState(initialFilters.minFit);
  const [payMin, setPayMin] = useState(initialFilters.payMin);
  const [sort, setSort] = useState<BoardFilterState["sort"]>(initialFilters.sort);
```

(`BoardFilterState` is already imported at line 6.)

- [ ] **Step 4: Typecheck + full suite**

Run (from `dashboard/`): `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/page.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): seed filters from server-resolved initialFilters (no flash)

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 6: Debounced persist-on-change effect

**Files:**
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (add an effect near the existing effects, after the `filterState` memo at lines 87-90)

**Interfaces:**
- Consumes: the existing `filterState` memo (`BoardFilterState`).
- Produces: a debounced `fetch("/api/board-filters", …)` on filter change. No new exports.

- [ ] **Step 1: Add the persistence effect**

In `dashboard/components/rolefit/RolefitBoard.tsx`, immediately after the `filterState` `useMemo` (line 90), add:
```ts
  // Persist filter changes (debounced) so they survive navigation/visits.
  // Skips the initial mount so the just-loaded initialFilters aren't re-saved.
  // Best-effort: failures are swallowed and never block filtering.
  const firstFilterSave = useRef(true);
  useEffect(() => {
    if (firstFilterSave.current) {
      firstFilterSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetch("/api/board-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterState),
        keepalive: true,
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [filterState]);
```

(`useEffect`, `useRef`, `useMemo` are already imported at line 3.)

- [ ] **Step 2: Typecheck**

Run (from `dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): persist filter changes via debounced POST

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 7: Adopt anonymous cookie filters into the account on login

**Files:**
- Modify: `dashboard/app/login/page.tsx:6-14` (`signIn` server action)

**Interfaces:**
- Consumes: `saveBoardFilters` (`@/lib/queries`), `parseBoardFilters` (`@/lib/rolefit/boardFilters`), `cookies` (`next/headers`).
- Produces: on successful login, any `board_filters` cookie is written to the user's profile and the cookie is cleared.

- [ ] **Step 1: Add imports**

At the top of `dashboard/app/login/page.tsx`:
```ts
import { cookies } from "next/headers";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
```

- [ ] **Step 2: Adopt the cookie in `signIn`**

Replace the `signIn` action body (lines 6-14) with:
```ts
async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  // Adopt anonymous cookie filters into the account (best-effort, UPDATE-only).
  const store = await cookies();
  const raw = store.get("board_filters")?.value;
  if (raw && data.user) {
    try {
      await saveBoardFilters(data.user.id, parseBoardFilters(raw));
    } catch (e) {
      console.error("filter adoption failed", e);
    }
    store.delete("board_filters");
  }

  redirect("/");
}
```

(`redirect` throws, so the adoption block runs only on a successful sign-in and is reached before `redirect("/")`. Keep `redirect` calls OUTSIDE the try so `NEXT_REDIRECT` propagates.)

- [ ] **Step 3: Typecheck + full suite**

Run (from `dashboard/`): `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/login/page.tsx
git commit -m "feat(login): adopt anonymous cookie filters into account on sign-in

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

### Task 8: End-to-end verification + build

**Files:** none (verification only).

**Prerequisites:**
- A working dev env: this worktree needs `dashboard/.env.local` (a fresh worktree lacks it; the dev server 500s without `NEXT_PUBLIC_SUPABASE_*`). Copy it from the primary checkout: `cp /Users/andrew/Scripts/job-board/dashboard/.env.local dashboard/.env.local` (or set the vars another way). The `DATABASE_URL` in that env must point at a DB where the Task 1 migration has been applied.
- Apply the migration to that DB (if not already): run the contents of `migrations/2026-06-29-board-filters.sql` against it (psql, or the Supabase MCP `apply_migration`).

- [ ] **Step 1: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds (this also type-checks the whole app).

- [ ] **Step 2: Start the dev server**

Run (from `dashboard/`): `npm run dev` (leave running in another shell). Confirm the board loads at `http://localhost:3000/` without a 500.

- [ ] **Step 3: Anonymous cookie write (curl)**

```bash
curl -i -X POST http://localhost:3000/api/board-filters \
  -H 'Content-Type: application/json' \
  -d '{"sort":"pay","minFit":75,"remote":"remote"}'
```
Expected: `HTTP/1.1 200`, body `{"ok":true}`, and a response header
`Set-Cookie: board_filters=...; Max-Age=15552000; Path=/; HttpOnly; SameSite=Lax`.

- [ ] **Step 4: Anonymous read reflects the cookie (browser)**

In a logged-out browser: open the board, change filters (e.g. set Sort = Pay, Min fit = 75, a search term), then reload the page. Expected: the filters you set are still applied after reload (no flash of defaults — they're correct on first paint).

- [ ] **Step 5: Authenticated round-trip (browser)**

Sign in. Change filters, reload. Expected: filters persist. Verify in the DB that they landed on the profile and `updated_at` did NOT change:
```sql
SELECT board_filters, updated_at FROM profiles WHERE user_id = '<your-user-id>';
```
(Confirm `updated_at` is unchanged after a filter save — the board-owner-hijack guard.)

- [ ] **Step 6: Login adoption (browser)**

Log out. While anonymous, set distinctive filters (e.g. Sort = A–Z, search = "zzz"). Then sign in. Expected: the just-set anonymous filters are now on your account, and the `board_filters` cookie is gone (check devtools → Application → Cookies).

- [ ] **Step 7: Full suite (final gate)**

Run (from `dashboard/`): `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit (if any verification-driven fixes were made)**

```bash
git add -A
git commit -m "test(board): verify filter persistence end-to-end

Claude-Session: https://claude.ai/code/session_01K599zYf8qLJyPWvbDD5o2c"
```

---

## Notes for the implementer

- **What is unit-tested vs. manually verified:** vitest is configured with `include: ["lib/**/*.test.ts"]` and `environment: "node"` (no jsdom). The two highest-risk pieces are fully unit-tested under `lib/`: filter validation (`parseBoardFilters`, Task 2) and the persistence query's safety constraints (`saveBoardFilters`, Task 3). The remaining pieces — the route handler, `page.tsx`, the React effect, and login adoption — live under `app/`/components (outside the vitest glob, and the effect/UI needs a DOM), so they are thin wiring verified by `tsc`, `npm run build`, and the Task 8 manual browser/curl checks. This is a deliberate divergence from the spec's broader test wishlist (route-handler and adoption unit tests), justified by the existing test harness; do not add jsdom/testing-library or widen the vitest glob for this work (out of scope).
- **postgres.js jsonb binding:** `${JSON.stringify(filters)}::jsonb` binds a text parameter and casts it. Do not pass the raw object expecting auto-serialization.
- **Cookie is persistent (180 days), not session-scoped** — a deliberate product choice so filters survive browser restarts.
