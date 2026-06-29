# Board filter persistence + résumé-generation config — design

Date: 2026-06-29
Branch: `feat/board-filter-persistence` (worktree off `main`)

This spec covers two reported issues. **Issue 1 is config-only and already resolved**; it is documented here for completeness. **Issue 2 (filter persistence) is the implementation work** this plan delivers.

---

## Issue 1 — "Generate résumé" → "not configured" (resolved, no code)

### Root cause
`dashboard/app/api/resume/route.ts:25-26` reads `process.env.OPENROUTER_API_KEY` and returns
`{ error: "résumé generation not configured" }` (HTTP 500) when it is unset. The key was missing in
the Vercel **Production** environment.

### Resolution
The user set `OPENROUTER_API_KEY` in Vercel Production (same key the reviewer backend uses). Env-var
changes only take effect on a fresh build, so a redeploy applies it. No code change.

### Security note (verified, no action required)
The key is **not** exposed to the browser or interceptable client-side:
- It is a server-only env var (no `NEXT_PUBLIC_` prefix), so Next.js never inlines it into client JS.
- It is referenced only in server code (`app/api/resume/route.ts`, `lib/openrouter.ts`); `resumeClient.ts`
  has no `"use client"` and is imported only by the server route.
- The browser→server request carries only `{ jobId }` + session cookie; the response carries only the
  résumé JSON. The key rides solely on the server→OpenRouter leg (HTTPS, server-to-server).
- Langfuse tracing propagates only `userId` and `sessionId` (the jobId) — never the key.

### Out of scope (noted, not chosen)
`route.ts:47` returns the raw upstream error `message` to the client. It cannot contain the key, but it
can surface internal error text. A future tidy-up could return a generic user-facing message and keep the
detail in server logs. Not part of this plan.

---

## Issue 2 — Board filters are not remembered

### Problem
Board filters live entirely in `RolefitBoard.tsx` React state (`search`, `cats`, `locs`, `remote`,
`minFit`, `payMin`, `sort`) and reset to defaults on every load. The user wants filters to persist:
**cookie-backed for anonymous visitors, account-backed for logged-in users.**

### Chosen approach (Approach A): single write endpoint + server-side initial read
- One route handler `POST /api/board-filters` is the single write path. It validates the incoming
  filters, then persists by auth state: authed → `profiles.board_filters`; anonymous → a `board_filters`
  cookie.
- `app/page.tsx` (a server component) reads the correct source server-side and passes a fully-resolved
  `initialFilters` into `RolefitBoard`, so there is **no flash of default filters** on load.
- `RolefitBoard` initializes its filter state from `initialFilters` and a debounced effect POSTs changes
  back to the endpoint.

Rejected alternatives: **B** (client-set cookie via `document.cookie` + a separate server action for
authed) — two code paths, non-HttpOnly cookie. **C** (URL query params as source of truth) — shareable
but churns the URL on every tweak; over-scoped for "remember my filters."

### Data model
New nullable column on `profiles`:

```sql
-- migrations/2026-06-29-board-filters.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS board_filters JSONB;
```

- `NULL` = no saved filters → defaults apply.
- Mirror the column into `dashboard/schema.sql` (profiles table, after `model_company`).
- Add `board_filters` to the `ProfileRow` type (`dashboard/lib/types.ts`); typed loosely (`unknown` or
  `BoardFilterState | null`) and always run through `parseBoardFilters` on read.
- Per deploy topology: **apply this migration to the live Supabase DB before/with the deploy** of the
  coupled code.

### Two hard safety constraints (from existing code)
1. **Filter saves must never modify `profiles.updated_at`.** `getBoardOwnerId()` resolves the
   single-tenant board owner as `SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1`. Touching
   `updated_at` on a filter save would let any authed viewer hijack whose verdicts the board shows.
2. **Filter saves must be UPDATE-only, never INSERT.** `profiles.profile_version` is `NOT NULL` with no
   default; an INSERT-on-conflict path for filters would either violate the constraint or create a phantom
   profile row that could become the board owner. So `saveBoardFilters` is a bare `UPDATE … WHERE user_id`.

### Components

**1. `dashboard/lib/rolefit/filter.ts` — defaults constant**
```ts
export const DEFAULT_FILTERS: BoardFilterState = {
  search: "", cats: [], locs: [], remote: "all", minFit: 0, payMin: 0, sort: "match",
};
```
(Matches the current hardcoded `useState` defaults in `RolefitBoard.tsx`.)

**2. `dashboard/lib/rolefit/boardFilters.ts` — validation (new module)**
```ts
export function parseBoardFilters(raw: unknown): BoardFilterState
```
- Accepts a JSON string or a parsed object; never throws; returns a complete `BoardFilterState`,
  falling back to `DEFAULT_FILTERS` per field.
- Per-field validation: `search` → string capped (~200 chars); `cats`/`locs` → arrays of strings,
  capped count (~50) and per-entry length; `remote` → must be one of `all|remote|hybrid|onsite`;
  `sort` → one of `match|pay|newest|az`; `minFit`/`payMin` → finite numbers clamped to `>= 0` (invalid →
  0).
- Used on **every** read (cookie + DB) and before **every** write, so stale/malformed data can never
  crash SSR or poison storage.

**3. `dashboard/lib/queries.ts` — persistence helper**
```ts
export async function saveBoardFilters(userId: string, filters: BoardFilterState): Promise<void>
```
- `UPDATE profiles SET board_filters = ${json}::jsonb WHERE user_id = ${userId}::uuid` — **no
  `updated_at`, no INSERT** (constraints above).
- Reads use the existing `getProfile(userId)` (`SELECT *`), which already returns `board_filters` once the
  column exists; no new read query needed.
- Edge case: an authed user with **no profile row** → the UPDATE is a no-op, so their filters don't
  persist server-side until a profile exists (e.g., after saving a résumé). Acceptable on this
  single-tenant board (authed = operator who has a profile). Documented, not worked around with
  dual-storage.

**4. `dashboard/app/api/board-filters/route.ts` — single write endpoint (new)**
- `POST`: parse body → `parseBoardFilters` → safe `BoardFilterState`.
- `const userId = await getUserId()`.
  - Authed → `await saveBoardFilters(userId, filters)`.
  - Anon → set cookie `board_filters` = `JSON.stringify(filters)` via `next/headers` `cookies()`:
    `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = 180 days (`15552000`).
- Best-effort: wrap persistence in try/catch; on failure log server-side and still return `200`
  (`{ ok: false }`) so a persistence error never blocks filtering.
- CSRF: impact of a forged request is limited to overwriting the victim's own board filters (no
  destructive action, no data exfiltration) — accepted as low-risk; no CSRF token added.

**5. `dashboard/app/page.tsx` — server-side initial read**
- Authed branch (already fetches `getProfile(viewerId)`): `initialFilters =
  parseBoardFilters(profile?.board_filters)`.
- Anon branch: read the `board_filters` cookie via `await cookies()`; `initialFilters =
  parseBoardFilters(cookie?.value)`.
- Pass `initialFilters` to `RolefitBoard`.

**6. `dashboard/components/rolefit/RolefitBoard.tsx` — init + debounced save**
- Add prop `initialFilters: BoardFilterState`; initialize the 7 `useState` from its fields instead of
  hardcoded literals.
- Add a debounced effect (≈400 ms) watching the existing `filterState` memo: after the first mount
  (guarded by a ref so the just-loaded state isn't re-saved), POST `filterState` to `/api/board-filters`.
  Clear the debounce timer on change/unmount.
- The existing `clearFilters` resets state, so the same effect persists the cleared state automatically —
  "clear" also clears the store. No separate wiring needed.

**7. `dashboard/app/login/page.tsx` — login adoption ("adopt cookie into account")**
- In the `signIn` server action, after a successful `signInWithPassword` and before `redirect("/")`:
  read the `board_filters` cookie; if present, resolve the new user id (from the sign-in result /
  `getUser()`), `await saveBoardFilters(userId, parseBoardFilters(cookie))`, then **clear the cookie**
  (`Max-Age=0`).
- Best-effort and UPDATE-only (constraints above): if the user has no profile row, adoption is a no-op;
  the cookie is cleared regardless. Documented limitation.

### Cookie semantics
Persistent cookie (`Max-Age` 180 days), **not** a literal session cookie. The report said "session
cookie," but a true session cookie dies on browser close; a persistent cookie is what makes filters
"stay with you" across visits. Flagged for the user; trivially switchable to session-scoped (omit
`Max-Age`) if preferred.

### Error handling
Persistence is best-effort end-to-end: save failures are logged server-side and never surfaced to the
user or block filtering; malformed stored data (cookie or DB) falls back to `DEFAULT_FILTERS` per field
via `parseBoardFilters`.

### Testing
- `boardFilters.test.ts` (`parseBoardFilters`): valid full object; partial object (missing → defaults);
  malformed JSON string → defaults; out-of-range `minFit`/`payMin` → 0; invalid enum → default;
  oversized arrays → capped; non-string array entries → filtered; `null`/`undefined` → all defaults.
- Route handler `POST /api/board-filters`: authed → `saveBoardFilters` called with parsed filters, no
  cookie set; anon → cookie set with serialized filters, DB not touched (mock `getUserId`).
- `saveBoardFilters`: asserts the query is a bare `UPDATE` that does **not** reference `updated_at` and
  does **not** INSERT. (DB-touching integration tests need `TEST_DATABASE_URL` per project test setup;
  query-shape assertion is the minimum.)
- Login adoption: cookie present → `saveBoardFilters` called and cookie cleared; cookie absent → no-op.

### Out of scope
- Cross-device sync for anonymous users (cookie is per-browser by definition).
- Shareable/bookmarkable filtered URLs (Approach C).
- The résumé error-message tidy-up from Issue 1.
