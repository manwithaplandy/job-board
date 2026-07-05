# Admin Navigation Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `/admin/tenants` and `/admin/invites` pages the same shared header as every other authed page — a Rolefit logo linking back to the board, the shared account menu, and the "Tenants · Invites" nav demoted to a sub-row.

**Architecture:** Reuse the existing `SlimHeader` component (already used by Analytics/Companies/Profile/Billing). Widen the `AccountMenu` `current` prop to recognize an `"admin"` section so the account menu's Admin item is marked active, add `"admin"` to `SlimHeader`'s `NavKey`, and render `<SlimHeader current="admin" />` above the existing `<main>` on both admin pages. No new components, no header refactor.

**Tech Stack:** Next.js (App Router, force-dynamic server components), React 19, TypeScript, inline-style tokens (no Tailwind), Vitest 4 + @testing-library/react (jsdom) for component tests. All commands run from the `dashboard/` directory.

## Global Constraints

- **Frontend-only.** No migrations, no new dependencies, no changes to the board `Header` or the other off-board pages.
- **Unadvertised-route convention.** Nothing points a *non-admin* at `/admin/*`. The account menu's "Admin" item renders only for `isAdmin` viewers, and the admin pages re-gate on `isAdmin` regardless — this work is a discoverability affordance, not access control. Do not add admin to any public/anon surface.
- **Admin is surfaced via the account menu, not a pill.** `SlimHeader`'s pill nav stays exactly Analytics/Companies. Admin is marked in the account menu, the same way Profile/Billing are (neither appears as a pill).
- **Sign out stays the last account-menu item** (preserves the keyboard-wrap contract: ArrowDown at end → first).
- **Match existing conventions.** Inline-style tokens like the surrounding code; no Tailwind; hand-rolled, no new libraries.

---

### Task 1: `AccountMenu` recognizes an `"admin"` current section

Widen the account menu so a caller can mark the Admin item as the current page, mirroring how `"billing"`/`"profile"` already work.

**Files:**
- Modify: `dashboard/components/rolefit/AccountMenu.tsx` (the `current` prop type at line 13; the Admin `<a>` menuitem at lines 255–266)
- Test: `dashboard/components/rolefit/AccountMenu.test.tsx` (add one test alongside the existing `current='billing'` test at lines 66–71)

**Interfaces:**
- Consumes: nothing new (self-contained component change).
- Produces: `AccountMenuProps.current` widened to `"profile" | "billing" | "admin"`. When `current === "admin"` and `isAdmin` is true, the Admin menuitem carries `aria-current="page"`. Task 2 relies on this widened union to pass `current="admin"` through `SlimHeader`.

- [ ] **Step 1: Write the failing test**

Add this test to `dashboard/components/rolefit/AccountMenu.test.tsx`, immediately after the `current='billing'` test (after line 71, inside the `describe("AccountMenu — open contents", …)` block):

```tsx
  test("current='admin' marks the Admin item aria-current=page", () => {
    renderMenu({ isAdmin: true, current: "admin" });
    openWithClick();
    expect(screen.getByRole("menuitem", { name: "Admin" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npx vitest run components/rolefit/AccountMenu.test.tsx`
Expected: the new test FAILS. Because `current` does not yet accept `"admin"`, this fails at type-check/compile time (TS2322 on the `current: "admin"` literal in `renderMenu`) or, if it compiles, the assertion fails because the Admin item has no `aria-current`. Either way it is red.

- [ ] **Step 3: Widen the `current` prop type**

In `dashboard/components/rolefit/AccountMenu.tsx`, change the `current` field of `AccountMenuProps` (line 13):

```tsx
  // SlimHeader passes the current page so the matching item carries aria-current="page"
  // (/profile, /billing, and /admin/* no longer rely on a filled nav pill).
  current?: "profile" | "billing" | "admin";
```

- [ ] **Step 4: Mark the Admin item when current is "admin"**

In the same file, in the `isAdmin && (...)` Admin block (currently lines 255–266), add an `aria-current` attribute to the `<a>` so it reads:

```tsx
          {isAdmin && (
            <a
              role="menuitem"
              tabIndex={-1}
              href="/admin/tenants"
              aria-current={current === "admin" ? "page" : undefined}
              className="rf-picker-option"
              style={itemStyle}
              onClick={close}
            >
              Admin
            </a>
          )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd dashboard && npx vitest run components/rolefit/AccountMenu.test.tsx`
Expected: PASS — the new `current='admin'` test plus all pre-existing AccountMenu tests are green.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/rolefit/AccountMenu.tsx dashboard/components/rolefit/AccountMenu.test.tsx
git commit -m "feat(nav): AccountMenu recognizes an 'admin' current section"
```

---

### Task 2: Admin pages render the shared `SlimHeader`

Add `"admin"` to `SlimHeader`'s section type, pass it through to the account menu, and render `<SlimHeader current="admin" />` above `<main>` on both admin pages.

**Files:**
- Modify: `dashboard/components/rolefit/SlimHeader.tsx` (the `NavKey` type at line 16; the `AccountMenu` `current` pass-through at line 103)
- Modify: `dashboard/app/admin/tenants/page.tsx` (add the import; wrap the return in a fragment with `SlimHeader`)
- Modify: `dashboard/app/admin/invites/page.tsx` (same)
- Test (existing, must stay green): `dashboard/app/admin/tenants/page.test.ts`, `dashboard/app/admin/invites/page.test.ts`, `dashboard/components/admin/AdminNav.test.tsx`

**Interfaces:**
- Consumes: from Task 1, `AccountMenu`'s `current` prop now accepts `"admin"`.
- Produces: `SlimHeader`'s `NavKey` union includes `"admin"`; `<SlimHeader current="admin" />` renders the shared header (logo → `/`, Analytics/Companies pills, account menu with Admin marked) with no active pill.

- [ ] **Step 1: Add `"admin"` to `SlimHeader`'s `NavKey` and thread it to the account menu**

In `dashboard/components/rolefit/SlimHeader.tsx`, extend the `NavKey` type (line 16):

```tsx
type NavKey = "analytics" | "companies" | "profile" | "billing" | "admin";
```

Then extend the `AccountMenu` `current` pass-through (line 103) so `"admin"` flows through (Profile/Billing/Admin are the account-menu-marked sections; Analytics/Companies are pills and must stay `undefined` here):

```tsx
      <AccountMenu
        email={claims?.email ?? null}
        isAdmin={isAdmin(claims)}
        current={current === "profile" || current === "billing" || current === "admin" ? current : undefined}
      />
```

Note: `"admin"` is deliberately NOT added to the `NAV` pill array (lines 18–21). On admin pages no pill is active — admin is reached and marked via the account menu, exactly like Profile/Billing.

- [ ] **Step 2: Render `SlimHeader` on the Tenants page**

In `dashboard/app/admin/tenants/page.tsx`, add the import next to the other component imports (after line 7, `import { AdminNav } …`):

```tsx
import { SlimHeader } from "@/components/rolefit/SlimHeader";
```

Then wrap the returned JSX (currently `return (<main style={pageStyle}> … </main>);`) in a fragment with the header above `<main>`. The `<main>`, `<div style={wrapStyle}>`, `<AdminNav active="tenants" />`, and card content are unchanged — only the outer wrapper changes:

```tsx
  return (
    <>
      <SlimHeader current="admin" />
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="tenants" />
          {/* …existing card / table content, unchanged… */}
        </div>
      </main>
    </>
  );
```

- [ ] **Step 3: Render `SlimHeader` on the Invites page**

In `dashboard/app/admin/invites/page.tsx`, add the same import next to the other component imports (after line 8, `import { CopyButton } …`):

```tsx
import { SlimHeader } from "@/components/rolefit/SlimHeader";
```

Then wrap the returned JSX in the same fragment (the `<main>`, wrap `<div>`, `<AdminNav active="invites" />`, generator card, and table card are unchanged):

```tsx
  return (
    <>
      <SlimHeader current="admin" />
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="invites" />
          {/* …existing generator + table cards, unchanged… */}
        </div>
      </main>
    </>
  );
```

Leave each page's `pageStyle` (`minHeight: "100vh"`, `background: "#f4f6fa"`) as-is — this matches how the other off-board pages render beneath `SlimHeader`'s white bar.

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npm run typecheck`
Expected: PASS with no errors. This proves the widened `NavKey`/`current` unions accept `"admin"` and both admin pages compile with the new `SlimHeader` element.

- [ ] **Step 5: Run the affected + existing tests to verify they still pass**

Run: `cd dashboard && npx vitest run app/admin/tenants/page.test.ts app/admin/invites/page.test.ts components/admin/AdminNav.test.tsx components/rolefit/AccountMenu.test.tsx`
Expected: PASS. The admin `page.test.ts` gate tests only *call* the async page function to assert notFound-vs-fetch control flow; they never render the returned JSX tree, so the added `<SlimHeader/>` element neither executes nor affects them. `AdminNav` and `AccountMenu` are unchanged from Task 1's green state.

- [ ] **Step 6: Visually verify both admin pages via the local dev auth shim**

Because the admin pages are `isAdmin`-gated, run the dashboard locally with the dev auth shim set to an admin `DEV_USER_ID` whose email is in `ADMIN_EMAILS` (see the "Local authed-page dev shim" memory), then load each page in the browser and confirm:

- `/admin/tenants` and `/admin/invites` both show the `SlimHeader`: Rolefit logo (clicking it returns to the board `/`), the Analytics/Companies pills (neither marked active), and the account-menu avatar on the right.
- Opening the account menu shows the **Admin** item marked as the current page (`aria-current="page"` → active styling), with Sign out still last.
- The "Tenants · Invites" `AdminNav` sub-row still renders beneath the header with the correct section active, and the tables render as before.
- No double-scroll / layout regression versus the other off-board pages.

Prefer the `verify` skill to drive this end-to-end. If a local admin session cannot be stood up in this environment, record that the visual step is deferred to a manual check by the user and do not claim it as passed.

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/rolefit/SlimHeader.tsx dashboard/app/admin/tenants/page.tsx dashboard/app/admin/invites/page.tsx
git commit -m "feat(nav): render shared SlimHeader on the admin pages"
```

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Reuse `SlimHeader` (not a refactor) → Task 2 architecture.
- `SlimHeader` `NavKey` gains `"admin"`, not a pill → Task 2, Step 1 (with the explicit "not in NAV array" note).
- `AccountMenu` `current` gains `"admin"` + `aria-current` on Admin → Task 1.
- Both admin pages render `SlimHeader` above `<main>` → Task 2, Steps 2–3.
- Data flow / auth (SlimHeader self-contained, second `getUserClaims`, unadvertised-route convention) → Global Constraints + Task 2 (no new props threaded).
- Edge cases (no active pill; background/scroll) → Task 2, Steps 1 & 3 notes.
- Testing (new AccountMenu test; AdminNav + admin gate tests unaffected; visual via dev shim) → Task 1 Steps 1–5, Task 2 Steps 5–6.
- Out of scope (no header refactor, no board/off-board changes, no mobile collapse) → Global Constraints.

**2. Placeholder scan** — no TBD/TODO/"handle edge cases"/"similar to Task N". The one `{/* …unchanged… */}` marker is an explicit "leave existing content as-is" instruction identifying untouched regions, not omitted new code — all new code is shown in full.

**3. Type consistency** — `current`'s union is `"profile" | "billing" | "admin"` in both the `AccountMenu` prop (Task 1) and the `SlimHeader` pass-through (Task 2). `NavKey` includes `"admin"`. `current="admin"` (the string the pages pass) matches the union member. `isAdmin` is the existing boolean prop, unchanged. Consistent throughout.
