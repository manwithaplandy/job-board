# Non-engineer users see an empty board — solution spec (2026-07-19)

Status: **spec only** (no implementation here). Feeds directly into a
`superpowers:writing-plans` implementation plan. All `file:line` refs verified against
worktree `abundant-rolling-yao` on `main`.

**This branch ships two in-scope fixes**, both frontend/data with no migration file:
- **Fix A — board scoping** (§4–§5): drop the single-tenant-era engineer title prefilter on
  the authed board. This is what restores the empty board; it is the primary fix.
- **Fix B — `board_filters` write-path double-encoding** (§6): `saveBoardFilters` writes a
  double-encoded jsonb **string scalar** for every user; correct the write to store a jsonb
  **object**, keep the read parser's string-tolerance, and backfill existing rows. Pulled
  into this branch by Andrew (2026-07-19); it surfaced while diagnosing Fix A.

House rules that constrain both fixes:
- **Never rewrite commits** — reconcile forward with new commits.
- **Migrations before migration-coupled code** (deploy-topology) — neither fix needs a
  migration. Fix B's backfill is a **one-off prod-repair SQL run *after* the code deploys**
  (matching the `package-jsonb-hardening` precedent), because the old write re-pollutes on
  every save.
- **Dashboard jsonb**: no `as`-casts on jsonb reads; hand-rolled total parsers (dashboard
  `CLAUDE.md` "never `as`-cast a jsonb column" is the governing convention for Fix B). Fix A
  adds/changes no jsonb column; Fix B changes only the write side plus a data backfill — no
  new codec, and `parseBoardFilters` stays as-is.
- Main enforces UI-cohesion contracts (`npm run test:ui-contract` in `dashboard/`).

---

## 1. Problem statement

**User-visible symptom.** A non-engineer tenant (program/ops/data professional Katie,
`katiemalvani@gmail.com`, user `92b27148`) opens the board and sees **zero jobs**, even
though the reviewer has approved **55 open matches** for her. The board's **Source**
dropdown is also empty. She reports having *previously* seen roles appear briefly, then
vanish. The account owner (an engineer) sees a full board from the identical code path,
which is what has masked the bug since go-public.

**Root-cause chain (primary).** The board's server query hard-codes a title keyword
prefilter that predates multi-tenancy:

1. `dashboard/lib/config.ts:5` — `export const DEFAULT_INCLUDE_KEYWORDS: string[] = ["engineer"];`
   (introduced `67d5f03`, 2026-06-23, single-tenant era; the account owner is an engineer,
   so it was correct then and invisible since).
2. `dashboard/app/page.tsx:32` — `const filters = parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS });`
   builds **one** `filters` object used by **both** the authed branch (`getJobs(filters, viewerId, viewerLocations)`,
   `page.tsx:41`) and the anon branch (`getJobs(filters, null, [])`, `page.tsx:103`).
3. Because server-side filters are now all client-side, `page.tsx:31` passes `{}` to
   `parseFilters`, so `hasAnyFilter` is always `false` (`filters.ts:37`) and `include`
   always resolves to the default `["engineer"]` (`filters.ts:49`). There is no way for a
   viewer to override it.
4. `dashboard/lib/jobsQuery.ts:60-63` turns each include keyword into
   `j.title ILIKE '%engineer%'` in the board WHERE clause.
5. Net: **every** authed board is silently restricted to engineer-*titled* postings. Katie's
   55 approved matches carry no engineer title → `0` rows. The owner's approved set — under
   the same location pre-filter (his `preferred_locations=["Remote"]`) — is predominantly
   engineer-titled, so the `ILIKE` still leaves him a full board. Same query, opposite
   outcome — the perfect discriminator.

**Root-cause chain (secondary — explains "roles appeared, then vanished").** The live
review feed and the authoritative board query disagree on the include predicate:

- `getReviewFeed` (`dashboard/lib/queries.ts:104-135`) builds its `Filters` with
  `include: []` (`queries.ts:121-125`) — **no** title filter.
- During a review run, `ReviewNowPanel` polls the feed and forwards each batch of newly
  approved matches via `onNewMatches` (`ReviewNowPanel.tsx:87`); the board merges them into
  `boardJobs` (`RolefitBoard.tsx:531-535`). Katie's non-engineer approvals stream onto the
  board here.
- When the run settles (`status === "done"`), `ReviewNowPanel` fires `onSettled`
  (`ReviewNowPanel.tsx:132-137`), which the board wires to `router.refresh()`
  (`RolefitBoard.tsx:1319` — `onSettled={() => router.refresh()}`). That re-runs the server
  render → the authoritative board query **with** the engineer filter → every non-engineer
  row she just saw disappears.

The **empty Source facet is downstream**, not a separate bug: facet options are computed
client-side from the rows the server returned — `facetCounts(boardJobs)`
(`RolefitBoard.tsx:544` → `lib/rolefit/filter.ts:74-91`, sources at `:88`). Zero rows in →
zero facet options out. Fixing the row count fixes the facet.

---

## 2. Evidence summary (verified `file:line`)

| Claim | Location |
|---|---|
| Default include keyword is `["engineer"]` | `dashboard/lib/config.ts:5` |
| Sole consumer of the constant is the board loader | `dashboard/app/page.tsx:8,32` (grep: no other reference) |
| One `filters` object shared by authed + anon | `dashboard/app/page.tsx:32,41,103` |
| `params` is always `{}` → include always defaults | `dashboard/app/page.tsx:31`; `dashboard/lib/filters.ts:37,49` |
| Include keyword → `j.title ILIKE '%kw%'` | `dashboard/lib/jobsQuery.ts:60-63` |
| Authed query already curates by the viewer's own reviews (`verdict='approve'`) + location | `dashboard/lib/jobsQuery.ts:31-50,79-86,140-145` |
| Live feed uses `include: []` (disagrees with board) | `dashboard/lib/queries.ts:104-135`, filter at `:121-125` |
| Feed matches merged, then settle-time `router.refresh()` re-queries | `RolefitBoard.tsx:531-535,1319`; `ReviewNowPanel.tsx:87,132-137` |
| Board LIMIT is 500 | `dashboard/lib/jobsQuery.ts:156` |
| No include/exclude control in the client FilterBar | `FilterBar.tsx` controls = search/cats/locs/sources/remote/minFit/payMin/sort only |
| `board_filters` (BoardFilterState) has no include/exclude field | `dashboard/lib/rolefit/boardFilters.ts:3-12`; `lib/rolefit/filter.ts:3-12` |
| `getRejectedJobs` also uses `include: []` | `dashboard/lib/queries.ts:84-89` (parity note) |

The client `search` box is **not** an equivalent of the include filter: it is a free-text
substring match over title+company+location+role_category+skill_gaps applied *client-side*
(`filter.ts:41-43`), and it can only narrow the rows the server already returned — it cannot
recover rows the server dropped.

---

## 3. Ruled-out causes (one line each)

- **reviewer-worker health** — healthy, on current `main`; her 55 approvals exist in the DB.
- **07-17 location-dedupe predicate** — her `preferred_locations=["Remote"]`; the 55 rows survive both the old and new location predicate.
- **subscription / tier gating** — she has a Pro `plan_override` + invite redemption; the nightly "no active subscription" skip belongs to a different test account.
- **closed-job attrition** — `0` of her 55 approved jobs are closed, so `j.closed_at IS NULL` is not the cause.

---

## 4. Design options (Fix A — board scoping)

The fix must decide **who** the title-keyword prefilter should apply to, given that the
reviewer already curates each authed tenant's board to their own approved roles, while the
anon/public board has no per-user reviews and may legitimately want editorial curation.

### Option A — Drop the default include for authed viewers; keep it (deliberately) for anon (RECOMMENDED)

Authed branch runs with `include: []`; anon branch keeps `include: DEFAULT_INCLUDE_KEYWORDS`.

- **Steelman.** The authed board is *already* curated by the reviewer (`verdict='approve'`
  join on the viewer's own `job_reviews`) plus the location pre-filter. A title-keyword
  prefilter on top is redundant curation that only ever *removes* correctly-approved
  matches. Removing it fixes the bug at its root and, for free, makes the authed board and
  `getReviewFeed` agree (both `include: []`), which eliminates the secondary
  "appeared-then-vanished" symptom without touching the feed at all. The anon/public board
  genuinely has no reviewer curation, so keeping the engineer keyword there is a real
  content-curation choice — and scoping the constant to anon-only makes that choice explicit
  rather than accidental.
- **Trade-offs.** No user-facing include/exclude control for authed users (accepted:
  reviewer curation + client `search` cover the need). The owner's own board grows by
  roughly **+70 non-engineer rows** (all approved, not just engineer-titled; absolute counts
  drift daily as jobs close) — the correct multi-tenant behavior, but a visible change for
  the owner.
- **Cost.** No migration, no new UI, no `board_filters` schema change, no new jsonb parser.

### Option B — Per-profile include-keyword preference (empty default) + optional UI control

Store an include-keyword list per profile (new column or an added `board_filters` field),
defaulting to empty; existing users get a full board; the owner can opt back into `engineer`.

- **Steelman.** Most flexible; lets any tenant curate their own board server-side.
- **Trade-offs.** Speculative — there is no evidence a tenant wants a server-side *title*
  keyword filter distinct from the existing client `search`. It needs a migration or a
  `board_filters` schema + parser change (`boardFilters.ts`), **and** the feed
  (`getReviewFeed`) and rejected query (`getRejectedJobs`) would each have to read the same
  preference to stay consistent — more plumbing and three more places to keep in lockstep.
  `board_filters` is *client* filter state applied client-side (`applyFilters`); the server
  query never reads it, so it is not a drop-in home without new server plumbing. YAGNI for
  the immediate outage. Also does nothing for anon (no profile row).

### Option C — Move include/exclude filtering client-side into FilterBar

Server returns all approved rows (authed) / all open rows (anon, up to LIMIT 500); a new
FilterBar control applies include/exclude client-side like the other facets.

- **Steelman.** Unifies filtering in one client layer; symmetric with cats/locs/sources.
- **Trade-offs.** For authed this is just deletion with extra UI ceremony — there is nothing
  to "move," the reviewer already curated. For **anon** it is a regression risk: the public
  SQL would return the 500 most-recent open jobs regardless of title, and preserving
  "public board shows engineering roles" would depend on a client-seeded default filter —
  so older engineering postings beyond the 500-row cap that a server `ILIKE` would have
  surfaced could silently drop from the public board. Most work, worst anon story.

---

## 5. Recommendation (Fix A)

**Adopt Option A.** Scope the title-keyword prefilter to the anon/public board only; the
authed board runs with `include: []`.

Rationale, in priority order:
1. **Fixes the outage at the root** with the smallest surface area — non-engineer tenants
   immediately see their full approved set.
2. **Achieves feed/board predicate parity for free** — the authed board and `getReviewFeed`
   both become `include: []`, so streamed matches survive the settle-time `router.refresh()`.
   The secondary symptom disappears with no change to the feed.
3. **Respects existing per-tenant curation** — the reviewer's `verdict='approve'` join is
   the multi-tenant source of truth; a title prefilter on top is redundant and actively wrong.
4. **Preserves public-board curation deliberately** — anon keeps the engineer default, and
   the change is recorded as an explicit product decision, not an accident.
5. **Cheapest and safest** — no migration, no new UI, no schema or parser change; aligns with
   YAGNI and leaves Option B available later if a real per-tenant server-side filter need emerges.

Implementation shape (for the plan, not prescriptive): give the authed and anon branches
**different** filter objects — authed `parseFilters({}, { include: [] })`, anon
`parseFilters({}, { include: DEFAULT_INCLUDE_KEYWORDS })` — rather than one shared object at
`page.tsx:32`. Strongly consider renaming/relocating the constant (e.g.
`PUBLIC_BOARD_INCLUDE_KEYWORDS`) with a comment stating it applies to the anon board **only**,
so a future edit can't silently re-apply it to authed viewers (see Open Question 3).

---

## 6. Second in-scope fix (Fix B) — `board_filters` write-path double-encoding

**Problem.** `profiles.board_filters` stores a double-encoded jsonb **string scalar** for
**every** user, not the jsonb **object** the schema intends. Verified in prod: both Katie's
and the owner's rows report `jsonb_typeof(board_filters) = 'string'`. The board still works
today only because the read parser tolerates it (see below), so this is latent data-integrity
debt — one parser change away from silently dropping every user's saved filters.

**Root cause (verified `file:line`).** The write pre-stringifies the value and then serializes
it again for the jsonb parameter:

- `dashboard/lib/queries.ts:332` — `SET board_filters = ${JSON.stringify(filters)}::jsonb`
  inside `saveBoardFilters` (`queries.ts:323-335`). The value is already a JSON string before
  it reaches the jsonb parameter, so a jsonb string scalar (not an object) lands in the column.
- The callers pass **real objects**, so the double-encode is unambiguously at the write, not
  the caller: the authed API route parses the body to an object first
  (`app/api/board-filters/route.ts:22` `parseBoardFilters(body)`, then `:25`
  `saveBoardFilters(userId, filters)`), and the login-time adoption path parses the raw
  cookie string to an object first (`app/login/page.tsx:27`
  `saveBoardFilters(data.user.id, parseBoardFilters(raw))`).
- The read "works" only because `parseBoardFilters` (`lib/rolefit/boardFilters.ts:28-33`)
  unwraps one string level (`JSON.parse`-ing a string input before validating).

**Fix.** Pass the object to postgres **once** — drop the manual `JSON.stringify` in
`saveBoardFilters` and let the driver serialize the object for the jsonb column, either via
postgres.js's json helper (`tx.json(filters)`) or a bare object parameter. **The real-Postgres
red test (below) decides which variant is proven correct** — do not assume; write the failing
`jsonb_typeof = 'object'` assertion first, then land the variant that turns it green.

**Keep `parseBoardFilters`' string-tolerance permanently — with a comment saying why.** Do
**not** remove the `JSON.parse`-if-string branch when fixing the write. It is load-bearing:
1. **Anon cookie path.** The anon board persists filters as a cookie *string* —
   `app/api/board-filters/route.ts:28` stores `serializeBoardFilters(filters)` (a
   `JSON.stringify`, `boardFilters.ts:49-51`), and `app/login/page.tsx:24,27` replays that raw
   cookie string back through `parseBoardFilters`. A string input is legitimate here forever.
2. **Legacy rows.** Until the backfill lands (and as defense-in-depth after), old double-encoded
   rows must still read correctly.
   Add a one-line comment at the string branch stating both reasons, so a future cleanup does
   not "simplify" it away and reintroduce the anon-path break.

**Backfill (one-off idempotent prod SQL, run *after* the code deploys).** The old code
re-pollutes on every save, so the backfill must be the **last** step, after Vercel has the
write fix live:

```sql
-- Precheck (must pass before running the UPDATE):
--   (a) every string row's inner text parses as a JSON object, and
--   (b) no row is nested more than one string level.
SELECT count(*)                                   AS string_rows,
       count(*) FILTER (WHERE jsonb_typeof((board_filters #>> '{}')::jsonb) <> 'object') AS non_object_inner,
       count(*) FILTER (WHERE jsonb_typeof((board_filters #>> '{}')::jsonb) = 'string')  AS still_stringy
FROM profiles
WHERE jsonb_typeof(board_filters) = 'string';
-- Expect: non_object_inner = 0 AND still_stringy = 0 before proceeding.

-- Repair (idempotent — only touches string rows; content is preserved):
UPDATE profiles
SET board_filters = (board_filters #>> '{}')::jsonb
WHERE jsonb_typeof(board_filters) = 'string';

-- Postcheck: expect 0 rows.
SELECT count(*) FROM profiles WHERE jsonb_typeof(board_filters) = 'string';
```

`#>> '{}'` extracts the string scalar as text; re-casting to jsonb yields the intended object.
Content survives the unwrap (Katie's `remote:"remote"` is preserved). **No migration file** —
this matches the repo's one-off prod-repair precedent (`package-jsonb-hardening`, where a
malformed jsonb row was repaired directly in prod rather than via a migration).

**User-visible impact: none.** Fix B is correctness/hygiene. Because the read parser already
unwraps the string, saved filters are already being applied today (this is *why* Katie's board
is trimmed to ~48/55 by her `remote:"remote"`). Fix B does not change what any user sees — it
makes the stored shape honest and removes the latent parser-fragility. Fix A is the change that
restores rows.

---

## 7. Exact intended behavior after the fixes

- **Authed board.** `getJobs` runs with `include: []`. The query returns the viewer's
  `verdict='approve'`, `closed_at IS NULL`, location-matching jobs, ordered by
  `first_seen_at DESC`, capped at `LIMIT 500` — with **no** `j.title ILIKE` clause. Katie
  sees her 55 approved matches; the owner sees his full approved set (all approved, not just
  engineer-titled) — roughly +70 additional non-engineer rows.
- **Katie's saved client filter.** Her persisted `board_filters` carries `remote: "remote"`
  — a client-side FilterBar preference applied in `applyFilters` (`filter.ts:53`), not part
  of the server query. It trims the restored board to ~48 of the 55 rows until she flips
  **Remote → All**. This is her own saved preference, not the bug: the fix restores the full
  board; the client filter narrows it exactly as she last set it.
- **Anon/public board.** Unchanged. `include: ["engineer"]` still emits
  `j.title ILIKE '%engineer%'`; the public board stays curated to engineering roles.
- **Live feed.** Unchanged in code (already `include: []`), but now **consistent** with the
  authed board, so matches streamed during a run remain visible after the settle-time
  `router.refresh()`.
- **Source facet.** No code change. Because the authed board now returns the full approved
  set, `facetCounts(boardJobs)` populates Source (and category/location) options from real
  rows — Katie's non-engineer ATS sources appear.
- **`board_filters` storage (Fix B).** After the write fix and backfill, every
  `profiles.board_filters` value is a jsonb **object** (`jsonb_typeof = 'object'`), and a
  saved filter set round-trips losslessly — `parseBoardFilters(stored)` deep-equals what was
  saved. Existing content (e.g. Katie's `remote:"remote"`) is preserved. No user-visible
  change; the anon cookie path still stores/reads a single-encoded string (§6).

**Perf note (widening the authed query).** The authed result is bounded *before* the title
filter by `verdict='approve'` + the viewer's own review join + the location pre-filter, then
`LIMIT 500`. Removing the title `ILIKE` only widens *within* that already-curated set (the
owner's post-fix board is comfortably under the 500 cap). A `title ILIKE '%...%'` cannot use
a btree index anyway, so dropping it is strictly cheaper, not costlier. No index or LIMIT
change needed.

---

## 8. Test / verification strategy

Deterministic tests (no DB) first, then live confirmation. Items 1–6 cover Fix A; items 7–9
cover Fix B.

1. **`buildJobsQuery` unit** — with `include: []` the emitted SQL contains **no**
   `j.title ILIKE` clause and no stray bind value for it; with `include: ["engineer"]` it
   does. Guards both the anon path (stays curated) and the authed path (unfiltered).
2. **Regression for the core bug** — a non-engineer authed user with approved matches sees
   rows. Concretely: build the authed filter object the way `page.tsx` will after the fix and
   assert `buildJobsQuery(authedFilters, userId, locs)` yields SQL with no title predicate;
   if the DB harness is available (`TEST_DATABASE_URL`), add a real-DB scoping test in the
   style of `reviewStatsWith`'s test that seeds a non-engineer-titled approved job and
   asserts it is returned.
3. **Feed/board predicate parity** — assert the authed board's `Filters` and
   `getReviewFeed`'s `Filters` agree on `include` (both `[]`) — and, ideally, on
   `exclude`/`status`/`verdict` where they should — so the "appeared then vanished" symptom
   cannot regress. (`getRejectedJobs` already uses `include: []`; note it in the assertion set.)
4. **Anon unchanged** — `parseFilters` for the anon branch still yields `include: ["engineer"]`.
5. **UI-cohesion / jsdom** — Option A changes no UI, so `npm run test:ui-contract` and the
   existing jsdom component tests must pass unchanged; run them to confirm no regression.
6. **Live verification** (for the implementer; per the `verify` skill and the
   `local-authed-page-dev-shim` memory) — render Katie's board (user `92b27148`) via the
   dev auth shim + `DEV_USER_ID` against the prod DB and confirm ~55 rows plus a populated
   Source facet; alternatively drive prod via claude-in-chrome with her session. Confirm the
   owner's board still renders (now including his non-engineer approvals) and the anon board
   still shows engineering roles.
7. **Fix B red test (real Postgres, `TEST_DATABASE_URL` harness)** — write the failing
   assertion first: call `saveBoardFilters(userId, someFilters)`, then
   `SELECT jsonb_typeof(board_filters)` and expect `'object'` (fails today with `'string'`).
   This test both proves the bug and selects the correct write variant (`tx.json` vs bare
   object) — land whichever turns it green.
8. **Fix B round-trip** — after `saveBoardFilters`, read the row and assert
   `parseBoardFilters(stored)` deep-equals the input `BoardFilterState` (content preserved,
   no shape drift). The dashboard `CLAUDE.md` "never `as`-cast a jsonb column / one parser for
   read + write" rule is the governing convention.
9. **Anon-path regression guard** — assert `parseBoardFilters` still accepts a single-encoded
   cookie *string* (round-trip `parseBoardFilters(serializeBoardFilters(f))` deep-equals `f`),
   so the write fix + any parser comment can't regress the anon cookie path.
10. **Backfill verification (manual prod SQL)** — run the §6 precheck (inner text is a JSON
    object, no >1-level nesting) before the `UPDATE`, and the postcheck (`0` string rows) after.
    Run it only after the write fix is deployed.

---

## 9. Non-goals / follow-ups

- **`board_filters` `CHECK (jsonb_typeof(board_filters) = 'object')` constraint** — the
  belt-and-suspenders guard that would make a future double-encode impossible at the DB level.
  Explicitly **deferred**: it needs a migration (and can only be added after the backfill
  proves 0 string rows remain). Out of scope for this branch; file as a follow-up once Fix B
  has shipped and the column is clean.
- **Nightly "no active subscription" log noise** from test account
  `test_established_user@andrewmalvani.com` — unrelated observability cleanup.
- **Option B (per-tenant server-side include preference)** — deferred unless a concrete need
  for a server-side *title* filter distinct from the client `search` emerges.

---

## 10. Open questions for Andrew

1. **Anon/public board content** — keep the engineer-only curation, or broaden/relabel it
   (e.g. a "featured" set)? Recommendation: **keep** for now; it is a product/marketing call,
   not a correctness one.
2. **Authed include/exclude control** — do you want *any* user-facing server-side keyword
   control on the authed board (Option B), or are reviewer curation + the client `search` box
   sufficient? Recommendation: **sufficient; defer B.**
3. **Constant rename/relocate** — rename `DEFAULT_INCLUDE_KEYWORDS` →
   `PUBLIC_BOARD_INCLUDE_KEYWORDS` (anon-only, documented) to prevent a future re-application
   to authed viewers? Recommendation: **yes, cheap clarity.**
4. **Owner's board growth** — the owner's board will grow by ~+70 non-engineer rows (all
   approved, not just engineer-titled; absolute counts drift daily as jobs close). Confirm
   that is the desired multi-tenant behavior. Recommendation: **yes** — it is the correct
   outcome; flagged only because it is a visible change for the owner.
5. **Fix B follow-up constraint** — after Fix B ships and the backfill leaves the column clean,
   do you want the deferred `CHECK (jsonb_typeof(board_filters) = 'object')` guard added as a
   follow-up migration (makes a future regression impossible), or is the read parser +
   round-trip test sufficient? Recommendation: **add it later** — cheap permanent insurance,
   but genuinely out of scope for this branch (needs a migration, gated on a clean column).
