# Sign-up affordance + admin invite-code UI — design

- **Date:** 2026-07-04
- **Status:** Approved design, pre-implementation
- **Branch:** `worktree-dapper-pondering-muffin` (caught up to `origin/main` @ `344ff59`)

## Summary

Two small, independent UI features that surface auth/onboarding capability the
go-public cutover already built into the backend:

1. **Sign-up affordance for anonymous users.** The anon header shows one "Sign in"
   button that redirects to `/login`. Add a distinct primary **"Sign up"** button
   (→ `/signup`) beside a secondary **"Sign in"** link (→ `/login`) so the
   onboarding path is obvious.
2. **Admin-only invite-code UI.** Codes are minted by hand in SQL today. Add an
   admin-gated page (`/admin/invites`) to **generate** a code and **list** existing
   codes with their usage, backed by two new `lib/invites.ts` functions and one new
   server action.

Both are frontend-plus-thin-backend changes. **No database migration** — the
`invite_codes` table already has every column needed.

## Goals

- An anonymous visitor can reach the signup flow in one obvious click from the board.
- An admin can generate an invite code from the UI (no more hand-written SQL) and see
  at a glance how many uses each existing code has left and when it expires.
- Reuse existing patterns exactly: the `isAdmin` gate, the `serviceSql` invite
  plumbing, the `/admin/tenants` page shape, and the mock-based test style.

## Non-goals / out of scope

- **No new tiers, billing, or auth-provider changes.** Signup stays invite-gated
  (invite-only beta); this work does not make signup public.
- **No invite revoke / expire-existing / redemption drill-down.** (The "Full
  management" option was explicitly not chosen.)
- **No `created_by` audit column** on `invite_codes` (avoids a migration; the free-text
  `note` field captures intent).
- **No change to `redeemInvite` semantics** — redemption stays case-sensitive; generated
  codes are uppercase to match the existing `FOUNDER-01` seed.
- **No admin nav link in the public header** — matches the existing "the route's very
  existence is not advertised" convention for `/admin/*`.

## Background — what already exists

From the go-public cutover (`migrations/2026-07-03-multitenant-foundation.sql`,
`lib/invites.ts`, `app/signup/`, `app/admin/tenants/`):

- **`invite_codes` table:** `code` (PK TEXT), `note` (TEXT), `max_uses` (INT default 1),
  `uses` (INT default 0, `CHECK 0 <= uses <= max_uses`), `expires_at` (TIMESTAMPTZ,
  nullable), `created_at` (TIMESTAMPTZ default now()). RLS deny-all
  (`no_anon_access`); served only via the privileged direct pool.
- **`invite_redemptions` table:** `email` (PK), `code` (FK), `user_id`, `redeemed_at` —
  the trusted "this account was invited" marker.
- **`lib/invites.ts`** (on the `serviceRoleAllowlist`, uses `serviceSql`): today exports
  `redeemInvite`, `releaseInvite`, `isInvitedUser`, `linkInviteRedemption`. **No
  create/list function exists** — codes are inserted by hand
  (`INSERT INTO invite_codes (code, note, max_uses) VALUES (...)`).
- **Admin identity:** `isAdmin(claims)` from `lib/admin.ts`, driven by the
  comma-separated `ADMIN_EMAILS` env var. Canonical gate in
  `app/admin/tenants/page.tsx:70`: `if (!isAdmin(claims)) notFound();` (fail-closed:
  anon and non-admin both get a 404 before any data fetch). Server actions gate the
  same way — see `app/actions/companies.ts:50`.
- **Anon header today:** `components/rolefit/Header.tsx:216` renders one primary
  `<Button>` labeled "Sign in" wired to `onOpenProfile`;
  `RolefitBoard.tsx:942` makes that handler `window.location.href = "/login"` for anon
  (straight to login — **no modal**; the `ProfileModal` "Sign in to save your résumé"
  copy only renders for authed users and the job-detail panels).
- **Auth-page cross-links already exist:** `/login` shows "Create account" → `/signup`
  (`app/login/page.tsx:176`) and "Forgot password?"; `/signup` shows "Already have an
  account? Sign in" → `/login` (`app/signup/page.tsx:104`). **No change needed here.**
- **`Button` (`components/ui/Button.tsx`)** renders a hardcoded `<button>` — it cannot
  render as an anchor. Header nav items (`Analytics`, `Companies`) are plain styled
  `<a href>`.

## Feature 1 — Sign-up affordance for anon users

### The change

In `components/rolefit/Header.tsx`, split the anon branch of the header CTA into two
**styled `<a href>` anchors** (not `<Button>`, so we get real navigation and
open-in-new-tab semantics, consistent with the existing `Analytics`/`Companies`
anchors):

- **Sign in** → `<a href="/login">`, secondary/ghost styling (text-link, brand blue,
  no fill) — matches `Button variant="ghost"`/`secondary` tokens.
- **Sign up** → `<a href="/signup">`, primary styling (filled `#3b6fd4`, white text,
  the primary `Button` box-shadow) — the emphasized onboarding CTA.

Order: **Sign in** (secondary) then **Sign up** (primary), left→right, so the primary
CTA is the rightmost/most prominent element (matches the common GitHub-style pattern).

The authed branch is **unchanged**: the Résumé / "Set up profile" primary `<Button>`
(→ `onOpenProfile`) and the `AccountMenu` still render exactly as today.

### Follow-on cleanup

Because the header's anon branch no longer calls `onOpenProfile`, the anon path of
`RolefitBoard.tsx:942-947` becomes dead:

```ts
onOpenProfile={() => {
  if (isAuthed) setProfileOpen(true);
  else window.location.href = "/login";   // now unreachable from the header
}}
```

Simplify it to `onOpenProfile={() => setProfileOpen(true)}` (the handler is only
invoked from the authed branch now). Verify no other caller depends on the anon
redirect before removing it.

### Auth pages

No change — cross-links already exist (see Background). Optionally confirm the "Create
account" copy on `/login` reads clearly as a signup CTA; leave as-is if fine.

### Tests

- `components/rolefit/Header.test.tsx`: replace the existing
  `anon → 'Sign in' button and NO account menu` assertion with: anon renders a link to
  `/login` **and** a link to `/signup`, and still renders **no** `AccountMenu`. Authed
  cases unchanged.

## Feature 2 — Admin invite-code UI (generate + list)

### Backend — extend `lib/invites.ts`

`lib/invites.ts` is already on the `serviceRoleAllowlist` and uses `serviceSql` (the
RLS-bypassing pool) with the documented justification that `invite_codes` has no
authenticated RLS policy by design. The new functions inherit that justification.

- **`generateInviteCode(): string`** — internal helper. Produces an uppercase code in
  the format `RF-XXXX-XXXX`, where `X` is drawn (via `crypto.getRandomValues`) from a
  no-ambiguous-characters alphabet (`ABCDEFGHJKMNPQRSTVWXYZ23456789`, 30 chars — no
  I/L/O/U/0/1). ~30^8 ≈ 6.6e11 space → collisions are vanishingly rare.

- **`createInvite(opts): Promise<InviteCode>`** where
  `opts = { note?: string; maxUses?: number; expiresAt?: Date | null; code?: string }`.
  - Defaults: `maxUses = 1`, `expiresAt = null`, `note = null`, `code = auto-generated`.
  - Inserts into `invite_codes` via `serviceSql`, `RETURNING *`.
  - **Auto-gen collision:** retry generation up to N (e.g. 5) times on a unique-PK
    violation; throw a clear error if still colliding (effectively never).
  - **Custom-code collision:** a caller-supplied `code` that already exists returns a
    distinct, user-legible error (e.g. `"That code already exists."`) — surfaced by the
    action, not a raw PG error.
  - Returns the created row typed as `InviteCode`.

- **`listInvites(): Promise<InviteCode[]>`** — `SELECT code, note, max_uses, uses,
  expires_at, created_at FROM invite_codes ORDER BY created_at DESC`. (Usage is already
  the `uses` column; no join to `invite_redemptions` needed for the list view.)

- **`InviteCode` type** — colocated in `lib/invites.ts`:
  `{ code: string; note: string | null; maxUses: number; uses: number; expiresAt: Date | null; createdAt: Date }`.

### Server action — new `app/actions/invites.ts`

- **`createInviteAction(input): Promise<{ ok: true; code: string } | { ok: false; error: string }>`** (`"use server"`).
  - **Gate first, before any work:**
    `if (!isAdmin(await getUserClaims())) throw new Error("not authorized");`
    (mirrors `app/actions/companies.ts:50` — strangers get no legible detail).
  - Validate: `maxUses` is an integer in `1..1000`; `expiresAt` parses to a future
    timestamp or is null; custom `code` (if provided) matches an allowed charset/length.
  - On success return `{ ok: true, code }`; on a validation failure or custom-code
    collision return `{ ok: false, error }` with a legible message the form can display.
  - **Why a result union, not throw-for-validation:** Next.js redacts thrown
    server-action error messages in production, so a thrown validation message would
    reach the form as a generic error. The union mirrors the house `RedeemResult`
    pattern (`lib/invites.ts:30`). Only the unauthorized gate throws.

### Page — new `app/admin/invites/page.tsx`

Server component, mirrors `app/admin/tenants/page.tsx` structure and inline-style tokens
(`pageStyle`/`wrapStyle`/`cardStyle`/`thStyle`/`tdStyle`), `export const dynamic =
"force-dynamic"`, `metadata.title = "Invites · Admin"`.

- **Gate:** `const claims = await getUserClaims(); if (!isAdmin(claims)) notFound();`
  (identical fail-closed pattern; the route is never advertised).
- Fetch `const invites = await listInvites();` only after the gate passes.
- Render, top to bottom:
  1. **Admin sub-nav row** — a small `Tenants · Invites` link row shared by both
     `/admin/*` pages (see Navigation). The current page is styled as active.
  2. **Generate form** — a client component (`components/admin/InviteGenerator.tsx` or
     similar) with fields: **Note** (optional text), **Max uses** (number, default 1),
     **Expires** (optional date, default none), and a collapsed/secondary **custom code**
     field. On submit → `createInviteAction` → show the minted code prominently with a
     **Copy** button, then `router.refresh()` to update the list.
  3. **Existing-codes table** — columns **Code · Note · Uses (`2/5`) · Expires ·
     Created**, newest first, each row with a per-row copy button. Empty state: "No
     invite codes yet."

The page and table are server-rendered; the client footprint is two small leaves — the
`InviteGenerator` form and a shared `CopyButton` (the per-row copy button inside the
server-rendered table needs a client leaf). Codes are capability tokens shown only to
admins (page + action both gated), so listing them in plaintext is fine.

### Navigation

Add a minimal shared admin sub-nav (`Tenants · Invites`) rendered at the top of **both**
`/admin/tenants` and `/admin/invites`. Because it lives inside already-`isAdmin`-gated
pages, it advertises nothing to non-admins while letting an admin move between the two
consoles. Extract it as a tiny shared component (e.g. `app/admin/AdminNav.tsx` or
`components/admin/AdminNav.tsx`) to avoid duplication. No link is added to the public
header or `AccountMenu`.

### Tests (mock style, matching existing suites)

- **`lib/invites.test.ts`** (extend; reuse the existing `serviceSql` call-recording +
  staged-result mock): `createInvite` generates a well-formed `RF-XXXX-XXXX` code and
  issues the insert with the right values; respects `maxUses`/`expiresAt`; accepts a
  custom code; retries on a staged unique-violation then succeeds; surfaces a custom-code
  collision as an error. `listInvites` issues the ordered select and maps rows to
  `InviteCode`.
- **`app/actions/invites.test.ts`** (new; mirror `app/actions/tombstoneGuard.test.ts` /
  `companies` gating): a non-admin and an anon (`isAdmin` mocked false) both throw
  "not authorized" **before** any `createInvite`/DB call; an admin proceeds and returns
  the code; invalid `maxUses`/`expiresAt` throw before the insert.
- **`app/admin/invites/page.test.ts`** (new; mirror `app/admin/tenants/page.test.ts`):
  authed non-admin → `notFound()` before `listInvites`; `ADMIN_EMAILS` unset →
  `notFound()` even for a plausible email; anon (null claims) → `notFound()`; admin →
  proceeds to `listInvites`.
- **Component test** (jsdom, per the `dashboard-component-tests-jsdom` convention):
  the generator renders its fields and a submit control; assert on component state /
  rendered code, not on real network or DB.

## Data model

**Unchanged — no migration.** All fields used by `createInvite`/`listInvites`
(`code`, `note`, `max_uses`, `uses`, `expires_at`, `created_at`) already exist on
`invite_codes` (`migrations/2026-07-03-multitenant-foundation.sql`). This keeps the
deploy a pure code push (no migrate-before-deploy coordination).

## Security model

- **Two independent gates** on every privileged path: the `/admin/invites` **page**
  (`notFound()` for non-admins) and the `createInviteAction` **server action**
  (`throw "not authorized"`). Never rely on the page gate alone — the action is
  independently reachable.
- `createInvite`/`listInvites` run on `serviceSql` (RLS-bypass) and must only ever be
  called from the admin-gated action/page. They are not exposed to any anon/authenticated
  route.
- Input validation (`maxUses` bounds, `expiresAt` sanity, custom-code charset) runs in
  the action before touching the DB.
- Generated codes use a CSPRNG (`crypto.getRandomValues`), not `Math.random`.
- No secret material is logged; codes are shown only in the admin UI response.

## Deployment notes

- **No migration, no env change.** Assumes `ADMIN_EMAILS` is already set in the target
  environment (it gates the existing `/admin/tenants`), so the operator's account can
  reach `/admin/invites` immediately.
- Frontend + server-action change only → standard push-to-main Vercel auto-deploy
  (push to `main` auto-deploys the dashboard on Vercel); Railway/Python untouched.

## Deliberate omissions (YAGNI)

- No `created_by` column / audit trail (note field suffices; avoids a migration).
- No revoke / expire-existing-code / redemption drill-down (unchosen "Full management").
- No public-header or `AccountMenu` admin link (unadvertised-route convention).
- `redeemInvite` case-sensitivity unchanged (generated codes are uppercase to match).

## Resolved decisions

- Auto-gen code format: **`RF-XXXX-XXXX`**, no-ambiguous-char alphabet, CSPRNG.
- Admin navigation: **shared `Tenants · Invites` sub-nav** inside the gated `/admin/*`
  pages; no public nav link.
- Anon header: **two direct-link anchors** (Sign in secondary → `/login`, Sign up
  primary → `/signup`); no résumé-pitch modal (it never rendered for anon anyway).
