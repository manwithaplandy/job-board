# Consistent navigation on admin pages

**Date:** 2026-07-04
**Status:** Approved design, pending implementation plan

## Problem

The `/admin/tenants` and `/admin/invites` pages are a navigation dead-end.
They render **only** the `AdminNav` sub-nav ("Tenants · Invites") — no Rolefit
logo, no link back to the board, and no account menu. Every other authed page
already shares a common header:

- **Board (`/`)** — full `Header` with the `AccountMenu`.
- **Off-board pages** (Analytics, Companies, Profile, Billing) — share
  `SlimHeader`: Rolefit logo linking to `/`, Analytics/Companies pills, and the
  same `AccountMenu`.

The admin pages are the sole outlier. Once you land on one (via the account
menu's admin-only "Admin" link), there is no UI affordance back to the main app.

## Goal

Bring the admin pages in line with the shared header the rest of the app already
uses, so navigation reads as one consistent surface. Specifically, each admin
page gains:

- a Rolefit logo that links back to the board (`/`),
- the shared account menu (Profile / Billing / Admin / Sign out),
- the existing "Tenants · Invites" nav demoted to a section sub-row beneath the
  header.

## Approach

Reuse the existing `SlimHeader` — do **not** introduce a new header or refactor
the existing ones. Each admin page renders, top to bottom:

```
<SlimHeader current="admin" />          ← logo→/, Analytics/Companies pills, account menu
<main>
  … <AdminNav active={…} /> …           ← unchanged content + section sub-nav
</main>
```

`AdminNav` is unchanged. With `SlimHeader` now above it, it reads as a
second-level nav beneath the header — the same visual relationship `SlimHeader`
already has to page content on the other off-board pages.

### Rejected alternatives

- **Just a back link** — add only a logo/"back to board" link into `AdminNav`.
  Smallest change, but admin would still lack the account menu and not visually
  match the other pages. Solves the dead-end but not the stated goal of
  consistency.
- **Unified header refactor** — fold the board `Header` + `SlimHeader` +
  `AdminNav` into one config-driven component used everywhere. Most consistent
  in code, but the largest blast radius across every page. More than this task
  needs (YAGNI).

## Component changes

1. **`components/rolefit/SlimHeader.tsx`**
   - Add `"admin"` to the `NavKey` union.
   - Admin is **not** added as a pill — the pill nav stays Analytics/Companies.
     Like Profile/Billing, admin is surfaced through the account menu, not the
     pill row.
   - Extend the account-menu pass-through so `current="admin"` flows to
     `AccountMenu` (currently only `"profile" | "billing"` pass through).

2. **`components/rolefit/AccountMenu.tsx`**
   - Widen the `current` prop union from `"profile" | "billing"` to include
     `"admin"`.
   - Set `aria-current="page"` on the existing Admin menu item when
     `current === "admin"`. This mirrors exactly how Profile/Billing are marked.
   - The Admin item already renders only for `isAdmin` viewers, and admin pages
     are admin-only, so the item is always present there.

3. **`app/admin/tenants/page.tsx`** and **`app/admin/invites/page.tsx`**
   - Return a fragment with `<SlimHeader current="admin" />` above the existing
     `<main>`. No change to the table/card content or the `isAdmin` gate.
   - Mirror the analytics/companies composition (`SlimHeader` as a sibling above
     the page content) so the page background (`#f4f6fa`) and scroll behavior
     stay consistent.

## Data flow / auth

`SlimHeader` is self-contained: it calls `getUserClaims()` itself and computes
`isAdmin` inline, so no new props need threading from the admin pages. On an
admin page the viewer is by definition an admin, so the account menu's Admin
link renders correctly.

This means a second `getUserClaims()` call on the page (the page gate does one,
`SlimHeader` does its own) — cheap local-JWT verification, and identical to how
every other off-board page already works.

The unadvertised-route convention is preserved: nothing points a **non-admin**
at `/admin/*`. The "Admin" link only renders for `isAdmin` viewers, and the
admin pages re-gate on `isAdmin` regardless — this is a discoverability
affordance, not access control.

## Edge cases

- **No active pill on admin pages** — intentional and correct. Admin is a
  separate section reached via the account menu, exactly like Profile/Billing,
  which also mark nothing in the pill nav.
- **Background / scroll** — the admin `pageStyle` background (`#f4f6fa`) already
  matches the off-board page background beneath `SlimHeader`'s white bar. Mirror
  the analytics/companies composition so there is no double-scroll.

## Testing

- **`components/rolefit/AccountMenu.test.tsx`** — add one test: with `isAdmin`
  and `current="admin"`, the Admin item carries `aria-current="page"`. Existing
  tests continue to pass.
- **Unaffected existing tests:**
  - `components/admin/AdminNav.test.tsx` — `AdminNav` is unchanged.
  - `app/admin/tenants/page.test.ts` and `app/admin/invites/page.test.ts` — the
    gate tests only *call* the async page function to assert notFound-vs-fetch
    control flow; they never render the returned JSX tree, so adding
    `<SlimHeader/>` as a child element neither executes it nor breaks them.
- **Visual verification** — load both admin pages via the local authed-page dev
  shim (admin-gated, so needs an admin `DEV_USER_ID`/claims) and confirm: the
  logo returns to the board, the account menu is present with Admin highlighted,
  and the Tenants·Invites sub-row is intact.

## Out of scope (YAGNI)

- No unified header refactor.
- No narrow-viewport / mobile collapse for admin (operator tool with
  horizontally-scrolling tables).
- No changes to the board `Header` or the other off-board pages.
