# Rolefit UX Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 28 findings from the Rolefit UX review plus the design-system consolidation (adopt the inline-style `ui/*` primitives everywhere and remove Tailwind), leaving the board faster to triage, the Companies page functional, accessibility gaps closed, and the codebase on one styling system.

**Architecture:** Four phases on a single branch, merged together at the end. Testable logic is extracted into pure `lib/rolefit/*.ts` modules and unit-tested with vitest; component/visual changes are verified by typecheck + `next build` + a Vercel preview click-through. New CTAs use `ui/Button`/`ui/Panel`/`ui/Chip` from the start so the Phase 4 sweep stays small.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript, inline-style design tokens + `components/ui/*` primitives, `@tanstack/react-virtual`, Recharts, vitest (node env). Spec: `docs/superpowers/specs/2026-07-02-ux-review-fixes-design.md`.

## Global Constraints

- **Single branch** `worktree-vivid-wishing-teapot`. No per-phase deploys; everything merges once at the end after a final full-branch review + preview verify.
- **Styling target:** the inline-style primitives in `dashboard/components/ui/` (`Button`, `Panel`, `Chip`). Any NEW button/panel/pill written in any phase uses these, not hand-rolled inline styles.
- **Keyboard scheme:** navigation + search only — `j`/`↓` next, `k`/`↑` prev, `Enter` open, `Esc` close/clear, `/` focus search. **No `r`/`a` (or any) action keys.**
- **Boy-scout cleanup is in scope** within any file a task touches: remove dead code/unused imports, delete stale comments, collapse near-miss token drift onto the primitives' values. Bound: stay within touched files/modules; no rewrite of unrelated subsystems.
- **Tests run node-only:** vitest `include` is `lib/**/*.test.ts`. Do NOT add React-rendering tests — there is no jsdom/RTL setup. Test pure logic in `lib/`; verify UI via build + preview.
- **jsonb boundary rule** (from `dashboard/CLAUDE.md`): never `as`-cast a jsonb column; go through a total parser. (No task here should need one, but honor it if a change touches a jsonb read.)
- **All paths are relative to `dashboard/`** unless stated otherwise.
- **Commands:** run a single test file with `npx vitest run <path>`; typecheck with `npx tsc --noEmit`; build with `npm run build`. Commit after each task.

---

## Task 0: Establish a green baseline

**Files:** none (verification only)

- [ ] **Step 1: Confirm the worktree branch and clean tree**

Run: `git branch --show-current && git status --porcelain`
Expected: `worktree-vivid-wishing-teapot`, and only the committed spec/plan present (no stray edits).

- [ ] **Step 2: Run the existing test suite green**

Run: `cd dashboard && npx vitest run`
Expected: all suites pass. Record the pass count; later tasks must not regress it.

- [ ] **Step 3: Confirm a clean build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. If it fails for env reasons unrelated to code (missing NEXT_PUBLIC_SUPABASE_* — see the "Dashboard .env.local not in worktrees" memory), note that build verification for UI tasks will happen on the preview deploy instead, and rely on `npx tsc --noEmit` locally.

---

# Phase 1 — P0 + quick wins

Small, mostly independent, low regression. Unbreaks Companies.

## Task 1.1: Fix the Companies bucket tabs (P0, finding #1)

The page fetches only the URL's `?bucket=` and zeroes the other two buckets (`app/companies/page.tsx:56-58`), but `CompanyList` flips a local `useState` that never navigates (`components/companies/CompanyList.tsx:21`,`:37`), so Excluded/Unknown always show "No companies here yet." Fix: tabs become links that set `?bucket=` (server refetch); the active tab is derived from the data the server sent, not local state.

**Files:**
- Modify: `app/companies/page.tsx` (pass the active bucket down)
- Modify: `components/companies/CompanyList.tsx` (tabs → `<a href>`, drop `useState`)

**Interfaces:**
- Produces: `CompanyList` gains a required prop `activeBucket: "include" | "exclude" | "unknown"`.

- [ ] **Step 1: Pass the active bucket into `CompanyList`**

In `app/companies/page.tsx`, the `bucket` value is already computed (`:42-44`). Add it as a prop on the existing `<CompanyList .../>` element (`:73-77`):

```tsx
<CompanyList
  included={included} excluded={excluded} unknown={unknown}
  counts={counts} state={state} activeBucket={bucket}
  override={setCompanyOverride} refresh={refreshCompanyDiscoveryStatus}
/>
```

- [ ] **Step 2: Convert the tabs to links and remove local tab state**

In `components/companies/CompanyList.tsx`, delete the `useState`/`import { useState }` and `const rows = ...` selection, deriving `rows` from `activeBucket`; render each tab as an `<a href="?bucket=…">`. Replace the component body's tab list + rows:

```tsx
"use client";

import type { CompanyReviewRow, DiscoveryStateRow } from "@/lib/types";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreditBanner } from "@/components/companies/CreditBanner";

type Bucket = "include" | "exclude" | "unknown";

export function CompanyList({
  included, excluded, unknown, counts, state, activeBucket, override, refresh,
}: {
  included: CompanyReviewRow[];
  excluded: CompanyReviewRow[];
  unknown: CompanyReviewRow[];
  counts: { include: number; exclude: number; unknown: number };
  state: DiscoveryStateRow;
  activeBucket: Bucket;
  override: (companyId: number, verdict: "include" | "exclude") => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const rows = activeBucket === "include" ? included : activeBucket === "exclude" ? excluded : unknown;
  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "include", label: "Included", n: counts.include },
    { key: "exclude", label: "Excluded", n: counts.exclude },
    { key: "unknown", label: "Unknown", n: counts.unknown },
  ];

  return (
    <div>
      <CreditBanner state={state} refresh={refresh} />
      <div style={{ display: "inline-flex", background: "#eef1f5", borderRadius: "10px",
        padding: "3px", marginBottom: "16px" }}>
        {tabs.map((t) => {
          const active = activeBucket === t.key;
          return (
            <a key={t.key} href={`?bucket=${t.key}`} style={{
              textDecoration: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              padding: "8px 16px", borderRadius: "8px",
              background: active ? "#fff" : "transparent",
              color: active ? "#1f2430" : "#6b7480",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}>
              {t.label} <span style={{ color: "#9aa3b0" }}>{t.n}</span>
            </a>
          );
        })}
      </div>
      {rows.length === 0
        ? <div style={{ fontSize: "13px", color: "#9aa3b0", padding: "20px 0" }}>No companies here yet.</div>
        : rows.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors (the new required prop is supplied by the page).

- [ ] **Step 4: Verify on preview (deferred)**

Note for the phase's preview pass: `/companies`, `?bucket=exclude`, `?bucket=unknown` each render their own non-empty bucket; the active tab is highlighted; links are shareable.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/companies/page.tsx dashboard/components/companies/CompanyList.tsx
git commit -m "fix(companies): make bucket tabs server-routed links so Excluded/Unknown render"
```

## Task 1.2: Reorder the job-detail pane — Review before Application (finding #4)

`JobDetail.tsx` renders `ApplicationPanel` (`:499`) above `ReviewPanel` (`:527`) and Requirements (`:552`). The evaluation you read to *decide* should come first.

**Files:**
- Modify: `components/rolefit/JobDetail.tsx` (reorder the three JSX blocks to Review → Requirements → Application)

- [ ] **Step 1: Read the three blocks and their guards**

Read `components/rolefit/JobDetail.tsx:490-560` to capture the exact JSX for the Application block (~`:499`), the Review block (~`:527`), and the Requirements block (~`:552`), including any conditional wrappers and the loading skeleton around `:530-536`.

- [ ] **Step 2: Reorder to Review → Requirements → Application**

Move the Application block so it renders after Requirements. Preserve every prop, guard, and the skeleton/error states verbatim — this is a pure reordering, no prop changes. After the move, the detail-fetch skeleton naturally sits with the Application block at the bottom (per the spec).

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/JobDetail.tsx
git commit -m "feat(board): order job detail Review -> Requirements -> Application to match the decide-then-apply flow"
```

## Task 1.3: Restore visible focus indicators on inputs (a11y, finding #6)

Five inputs set `outline: none` with no replacement, hiding keyboard position. Add a visible `:focus-visible` treatment consistent with `LocationPicker`'s `focus:border-[#3b6fd4]`.

**Files:**
- Modify: `components/rolefit/Header.tsx:125` (board search)
- Modify: `app/login/page.tsx:95`,`:121` (email, password)
- Modify: `app/profile/page.tsx:193` (profile inputs)
- Modify: `components/rolefit/ProfileModal.tsx:305` (modal textarea)

**Approach:** inline styles can't express `:focus-visible`, so add `onFocus`/`onBlur` handlers that toggle a focused border/ring, OR add a shared CSS class in `app/globals.css` and apply it. Prefer the CSS class — it is DRY, keyboard-only via `:focus-visible`, and one place to tune.

- [ ] **Step 1: Add a focus-visible utility class to `app/globals.css`**

Append to `app/globals.css`:

```css
/* Visible keyboard focus for inline-styled inputs (replaces removed outlines). */
.rf-focusable:focus-visible {
  outline: none;
  border-color: #3b6fd4;
  box-shadow: 0 0 0 3px rgba(59,111,212,.18);
}
```

- [ ] **Step 2: Apply `className="rf-focusable"` to each of the five inputs**

For each file/line above, add `className="rf-focusable"` to the `<input>`/`<textarea>`. Keep existing inline styles; the class only adds focus-state rules. If an element already has a `className`, append with a space. Remove now-redundant `outline: none` from the inline `style` where present (the class handles it), honoring the boy-scout rule.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify on preview (deferred)**

Tab into each input; a blue border + ring appears on keyboard focus (and not on mouse click, per `:focus-visible`).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/globals.css dashboard/components/rolefit/Header.tsx dashboard/app/login/page.tsx dashboard/app/profile/page.tsx dashboard/components/rolefit/ProfileModal.tsx
git commit -m "fix(a11y): restore visible keyboard focus on board search, login, profile, and modal inputs"
```

## Task 1.4: Distinguish zero-data from zero-match on the board (finding #12)

`JobList` always shows "No roles match your filters" + Clear filters in the `view === "all"` empty branch (`:117-126`), even when the board has zero jobs at all. `JobList` only receives the filtered array, so it needs to know whether any jobs exist pre-filter.

**Files:**
- Modify: `components/rolefit/JobList.tsx` (new prop + branch)
- Modify: `components/rolefit/RolefitBoard.tsx` (pass the pre-filter count)

**Interfaces:**
- Produces: `JobListProps` gains `hasUnfilteredJobs: boolean` — true when the board has ≥1 job before the search/facet filters (i.e. the "all" pool is non-empty).

- [ ] **Step 1: Add the prop and branch in `JobList.tsx`**

In `JobListProps` add `hasUnfilteredJobs: boolean;`. In the `view === "all"` empty branch (`:117-126`), branch on it:

```tsx
if (!hasUnfilteredJobs) {
  return (
    <div style={{ padding: "60px 30px", textAlign: "center", color: "#6b7480" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#5b6472" }}>
        No roles yet
      </div>
      <div style={{ fontSize: "13px", marginTop: "6px" }}>
        The poller runs every couple of hours. Check{" "}
        <a href="/analytics" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
          pipeline health
        </a>{" "}
        if this persists.
      </div>
    </div>
  );
}
// else: existing "No roles match your filters" + Clear filters
```

- [ ] **Step 2: Thread the prop from `RolefitBoard.tsx`**

Find where `RolefitBoard` renders `<JobList .../>` and pass `hasUnfilteredJobs={...}`. The correct source is the count of jobs in the "all" pool BEFORE search/facet filtering (after the applied/rejected view partition is fine — the message is about "no roles at all"). Read the board's filter pipeline (the `visible` derivation around the counter at `:797`) to pick the pre-filter array; use `boardJobs.length > 0` where `boardJobs` is the unfiltered approve pool.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/JobList.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "fix(board): show a pipeline-empty message when there are no roles at all, not 'no match'"
```

## Task 1.5: Scope the counter denominator to the active view (finding #13)

`FilterBar.tsx:659` renders `{visibleCount} of {jobs.length}` where `jobs.length` is the all-jobs total, so the Rejected/Applied views read "3 of 412".

**Files:**
- Modify: `components/rolefit/FilterBar.tsx:659`
- Modify: `components/rolefit/RolefitBoard.tsx:797` (pass the view-scoped denominator)

- [ ] **Step 1: Read the counter and its inputs**

Read `components/rolefit/FilterBar.tsx:650-665` and the `RolefitBoard.tsx:790-800` region to see how `visibleCount`/`jobs.length` reach the counter and what the active view is.

- [ ] **Step 2: Pass a view-scoped total**

Replace the denominator with the size of the active view's pool: `all` → the unfiltered approve pool; `applied` → applied count; `rejected` → the rejected pool. Pass that as the counter's total (rename the prop to something like `totalInView` if it clarifies). In the applied/rejected views, alternatively render "{n} applied" / "{n} rejected" per the spec — pick the pool-denominator form for minimal surface.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/FilterBar.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "fix(board): scope the 'N of M' counter denominator to the active view"
```

## Task 1.6: Board a11y + card polish batch (findings #18, #20, #17)

Three tiny, independent board tweaks grouped into one review.

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx:935-951` (undo toast)
- Modify: `components/rolefit/JobCard.tsx:30-33`,`:142` (unknown-arrangement chip)
- Modify: `components/rolefit/Header.tsx:155-165` (operator signal text)

- [ ] **Step 1: #18 — add `role="status"` to the Undo toast**

On the Undo toast container (`RolefitBoard.tsx:935-951`), add `role="status"` (the error toast already uses `role="alert"`). No visual change.

- [ ] **Step 2: #20 — omit the arrangement chip when unknown**

In `JobCard.tsx`, only render the arrangement chip when known. Replace `:142` and simplify the label (`:30-33`):

```tsx
const rawArrangement = job.work_arrangement ?? (job.remote === true ? "remote" : null);
const remoteLabel = rawArrangement
  ? rawArrangement.charAt(0).toUpperCase() + rawArrangement.slice(1)
  : null;
// ...
{payLabel && <Chip>{payLabel}</Chip>}
{remoteLabel && <Chip>{remoteLabel}</Chip>}
{job.role_category && <Chip>{job.role_category}</Chip>}
```

- [ ] **Step 3: #17 — clean up the header operator signal**

In `Header.tsx:155-165`, drop the raw enum text (`ok`/`warn`/`stale`) rendered beside the status dot (keep the dot + its `title` tooltip). If "N unreviewed" is plain non-interactive text styled to look clickable, either make it a link to `/analytics` or render it as plain muted text — pick the link for usefulness.

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobCard.tsx dashboard/components/rolefit/Header.tsx
git commit -m "fix(board): toast role=status, drop lone '—' arrangement chip, clean header signal"
```

## Task 1.7: Darken low-contrast small text (a11y, finding #19)

`#9aa3b0` (~2.7:1 on white) is used for small text meant to be read. Darken to `#7a8494` (~4.5:1) for those; leave purely decorative marks.

**Files:**
- Modify: `app/profile/page.tsx:179-184` (form hints)
- Modify: `components/rolefit/FilterBar.tsx:346` (facet counts)
- Modify: `components/analytics/HealthCards.tsx:49` (timestamps)

- [ ] **Step 1: Replace `#9aa3b0` with `#7a8494` at the three sites**

At each anchor, change the `color: "#9aa3b0"` on readable small text to `#7a8494`. Do NOT blanket-replace every `#9aa3b0` in the file — only the readable-text instances at these anchors (and any obvious sibling of the same purpose). Leave the CompanyList tab-count gray as-is unless it is the same readable-count pattern (use judgment; the facet counts in FilterBar are the target).

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/profile/page.tsx dashboard/components/rolefit/FilterBar.tsx dashboard/components/analytics/HealthCards.tsx
git commit -m "fix(a11y): darken small readable text from #9aa3b0 to #7a8494 for AA contrast"
```

## Task 1.8: Global quick fixes — login autoComplete + per-page titles (findings #21, #22)

**Files:**
- Modify: `app/login/page.tsx:86-98`,`:111-124`
- Modify: `app/layout.tsx:10-13` (root title) + add `metadata` to `app/analytics/page.tsx`, `app/companies/page.tsx`, `app/profile/page.tsx`

- [ ] **Step 1: #21 — add autoComplete on the login inputs**

Add `autoComplete="email"` to the email input and `autoComplete="current-password"` to the password input.

- [ ] **Step 2: #22 — per-page titles**

Keep the root default title in `app/layout.tsx` (`metadata.title` = "Rolefit"). Add an exported `metadata` to each other page so tabs are distinguishable:

```tsx
// app/analytics/page.tsx (and companies/profile analogously)
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Analytics · Rolefit" };
```

Use "Companies · Rolefit" and "Profile · Rolefit" for the other two. (These are server components, so an exported `metadata` const works; if a page is a client component, use a `title` in a co-located `layout.tsx` or a small metadata export in the server wrapper — check each file's `"use client"` directive first.)

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/login/page.tsx dashboard/app/layout.tsx dashboard/app/analytics/page.tsx dashboard/app/companies/page.tsx dashboard/app/profile/page.tsx
git commit -m "fix: login autoComplete + per-page browser titles"
```

---

# Phase 2 — Board interaction

The triage-speed work. Tasks 2.1–2.4 share one pure "move selection" helper.

## Task 2.1: Extract a pure selection helper (foundation for #2, #3, #5)

The board needs, in a testable place, the logic for "index of a selected id", "next/prev visible index", and "which id to select after removing the current one". Put it in a new `lib/rolefit/selection.ts` and unit-test it (the board wiring in later tasks is verified on preview).

**Files:**
- Create: `lib/rolefit/selection.ts`
- Test: `lib/rolefit/selection.test.ts`

**Interfaces:**
- Produces:
  - `indexOfId(ids: string[], id: string | null): number` — index or `-1`.
  - `stepSelection(ids: string[], current: string | null, dir: 1 | -1): string | null` — next/prev id, clamped at the ends; if `current` is null/absent, returns the first (dir 1) or last (dir -1) id, or null for an empty list.
  - `selectionAfterRemoval(ids: string[], removedId: string): string | null` — the id to select after `removedId` leaves the visible list: the item that took its slot (same index in the new list), else the new last item, else null. `ids` is the visible order BEFORE removal.

- [ ] **Step 1: Write the failing test**

Create `lib/rolefit/selection.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { indexOfId, stepSelection, selectionAfterRemoval } from "@/lib/rolefit/selection";

describe("indexOfId", () => {
  test("returns index or -1", () => {
    expect(indexOfId(["a", "b", "c"], "b")).toBe(1);
    expect(indexOfId(["a", "b"], "z")).toBe(-1);
    expect(indexOfId(["a"], null)).toBe(-1);
  });
});

describe("stepSelection", () => {
  const ids = ["a", "b", "c"];
  test("moves forward and backward", () => {
    expect(stepSelection(ids, "a", 1)).toBe("b");
    expect(stepSelection(ids, "b", -1)).toBe("a");
  });
  test("clamps at the ends", () => {
    expect(stepSelection(ids, "c", 1)).toBe("c");
    expect(stepSelection(ids, "a", -1)).toBe("a");
  });
  test("null current seeds first (fwd) or last (back)", () => {
    expect(stepSelection(ids, null, 1)).toBe("a");
    expect(stepSelection(ids, null, -1)).toBe("c");
  });
  test("absent current is treated like null", () => {
    expect(stepSelection(ids, "gone", 1)).toBe("a");
  });
  test("empty list yields null", () => {
    expect(stepSelection([], null, 1)).toBeNull();
  });
});

describe("selectionAfterRemoval", () => {
  test("selects the item that took the slot", () => {
    expect(selectionAfterRemoval(["a", "b", "c"], "b")).toBe("c");
  });
  test("removing the last selects the new last", () => {
    expect(selectionAfterRemoval(["a", "b", "c"], "c")).toBe("b");
  });
  test("removing the only item yields null", () => {
    expect(selectionAfterRemoval(["a"], "a")).toBeNull();
  });
  test("removing an absent id yields null", () => {
    expect(selectionAfterRemoval(["a", "b"], "z")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/selection.test.ts`
Expected: FAIL — cannot resolve `@/lib/rolefit/selection`.

- [ ] **Step 3: Implement `lib/rolefit/selection.ts`**

```ts
// Pure selection math for the board's keyboard nav (#3), scroll-into-view (#5), and
// auto-advance after reject/apply (#2). Kept out of the React component so it is unit-
// testable (vitest is node-only). `ids` is always the CURRENT visible order.

export function indexOfId(ids: string[], id: string | null): number {
  if (id == null) return -1;
  return ids.indexOf(id);
}

export function stepSelection(ids: string[], current: string | null, dir: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = indexOfId(ids, current);
  if (i === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  const next = Math.min(ids.length - 1, Math.max(0, i + dir));
  return ids[next];
}

// `ids` is the visible order BEFORE removal. After `removedId` leaves, prefer the item
// that slides into its index; else the new last item; else null.
export function selectionAfterRemoval(ids: string[], removedId: string): string | null {
  const i = ids.indexOf(removedId);
  if (i === -1) return null;
  const remaining = ids.filter((id) => id !== removedId);
  if (remaining.length === 0) return null;
  return remaining[Math.min(i, remaining.length - 1)];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/rolefit/selection.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/selection.ts dashboard/lib/rolefit/selection.test.ts
git commit -m "feat(board): pure selection helper (index/step/after-removal) with tests"
```

## Task 2.2: Auto-advance selection after reject / mark-applied (finding #2)

`handleReject` (`RolefitBoard.tsx:417`) and `handleMarkApplied` (`:698`) both null the selection, dumping the user on "Select a role". Use `selectionAfterRemoval` against the CURRENT visible list to advance instead.

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx` (import helper; both handlers)

**Interfaces:**
- Consumes: `selectionAfterRemoval` from Task 2.1.

- [ ] **Step 1: Read both handlers and the visible-list derivation**

Read `RolefitBoard.tsx:405-470` (reject) and `:690-710` (mark-applied), plus wherever the visible/sorted id list is computed (near the counter, `:790-800`). Identify the array of currently-visible job ids in render order.

- [ ] **Step 2: Advance instead of clearing**

In each handler, where it currently does `setSelectedId(prev => prev === job.id ? null : prev)`, compute the next selection from the visible ids as they are BEFORE the item is hidden:

```ts
import { selectionAfterRemoval } from "@/lib/rolefit/selection";
// ...inside the handler, `visibleIds` = ids in current render order:
setSelectedId((prev) => (prev === job.id ? selectionAfterRemoval(visibleIds, job.id) : prev));
```

Keep the optimistic update + Undo toast unchanged. If `visibleIds` isn't already in scope in the handler, derive it from the same memo the render uses (do not recompute filters ad hoc — reuse the existing `visible` array).

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify on preview (deferred)**

Rejecting/marking-applied the selected job selects the next visible job; rejecting the last selects the new last; rejecting the only visible job clears to the placeholder.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): auto-advance to the next role after reject/mark-applied"
```

## Task 2.3: Keyboard navigation + search focus + scroll-into-view (findings #3, #5)

Add board-level key handling (nav + search only) and make selection scroll the virtualized list to the selected card (also fixes the deep-link case).

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx` (keydown listener, selection→scroll)
- Modify: `components/rolefit/JobList.tsx` (expose a way to scroll to an index)

**Interfaces:**
- Consumes: `stepSelection`, `indexOfId` from Task 2.1.
- Produces: `JobList` accepts `scrollToId?: string | null` — when it changes, the virtualizer scrolls that id into view (no-op in the non-virtualized narrow list; the page scroll is handled separately by Task 2.6).

- [ ] **Step 1: Add scroll-to-id to the virtualized list**

In `JobList.tsx`'s `VirtualJobList`, accept `scrollToId` and, in an effect, scroll to its index when it changes:

```tsx
// props: add scrollToId?: string | null
useEffect(() => {
  if (scrollToId == null) return;
  const i = jobs.findIndex((j) => j.id === scrollToId);
  if (i >= 0) virtualizer.scrollToIndex(i, { align: "auto" });
}, [scrollToId, jobs, virtualizer]);
```

Thread `scrollToId` from `JobList`'s props into `VirtualJobList`. Add `scrollToId?: string | null` to `JobListProps`.

- [ ] **Step 2: Add the board keydown listener**

In `RolefitBoard.tsx`, add a `useEffect` document `keydown` listener (near the existing outside-click listener at `:199-207`). Guard against typing contexts and open menus/modals:

```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (e.key === "/" && !typing) { e.preventDefault(); searchInputRef.current?.focus(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    // suppress while a modal/menu is open — reuse existing open-state flags:
    if (isModalOpen || openMenu) return;
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSelectedId((id) => stepSelection(visibleIds, id, 1)); }
    else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSelectedId((id) => stepSelection(visibleIds, id, -1)); }
    else if (e.key === "Escape") { setSelectedId(null); }
  }
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [visibleIds, isModalOpen, openMenu]);
```

Adapt the exact guard flag names (`isModalOpen`, `openMenu`, `searchInputRef`) to what the board actually exposes — read the file to find the profile-modal open state, the filter-menu open state, and add a `ref` to the search input (thread a `ref` prop into `Header`'s search input if one doesn't exist). `Enter` opening the detail is already covered because selection auto-opens the detail pane; do not add a separate Enter handler unless selection does not open detail on narrow — in that case, `Enter` should behave like a card click.

- [ ] **Step 3: Feed the selected id to `JobList` as `scrollToId`**

Pass `scrollToId={selectedId}` to `<JobList/>` so keyboard moves (and the deep-link seed) scroll the card into view.

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify on preview (deferred)**

`j`/`k`/arrows move the highlight and keep the card visible; `/` focuses search; `Esc` clears; typing in search is unaffected; shortcuts are inert while the profile modal or a filter menu is open.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobList.tsx
git commit -m "feat(board): keyboard nav (j/k, arrows, /, Esc) with scroll-into-view"
```

## Task 2.4: Scroll the deep-linked selection into view on mount (finding #5)

The mount-seed effect (`RolefitBoard.tsx:252-258`) sets `selectedId` from `?job=` but never scrolls to it. With Task 2.3 feeding `scrollToId={selectedId}`, this largely resolves; verify the seed fires the scroll after the list mounts.

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx:252-258` (only if the seed needs a nudge)

- [ ] **Step 1: Confirm the seed path scrolls**

Read `:252-258`. Because `scrollToId={selectedId}` is now passed (Task 2.3) and the virtualizer's effect keys on `scrollToId` + `jobs`, the seeded id scrolls in once `jobs` is populated. If the seed sets `selectedId` before `jobs` exists, the effect's `jobs` dependency re-runs it — confirm by reading. If a race remains (selected id set, but list already settled and `scrollToId` unchanged), set `scrollToId` via a dedicated state that is also re-applied on first `jobs` arrival.

- [ ] **Step 2: Typecheck + commit (only if code changed)**

Run: `cd dashboard && npx tsc --noEmit`

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "fix(board): scroll the deep-linked ?job= selection into view on mount"
```

If no change was needed, note that in the task log and skip the commit.

## Task 2.5: Extend board search to include location + honest placeholder (finding #9)

**Files:**
- Modify: `lib/rolefit/filter.ts:35` (haystack)
- Modify: `components/rolefit/Header.tsx:120` (placeholder)
- Test: `lib/rolefit/filter.test.ts` (add a case)

- [ ] **Step 1: Write the failing test**

Add to `lib/rolefit/filter.test.ts` inside `describe("applyFilters", ...)`:

```ts
test("search matches location", () => {
  const jobs = [
    job({ id: "a", title: "Engineer", company_name: "Acme", location: "Berlin, DE", role_category: null, skill_gaps: [] }),
    job({ id: "b", title: "Engineer", company_name: "Acme", location: "Remote (US)", role_category: null, skill_gaps: [] }),
  ];
  expect(applyFilters(jobs, { ...ST, search: "berlin" }).map((j) => j.id)).toEqual(["a"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/filter.test.ts`
Expected: FAIL — "berlin" not in the haystack, both filtered out → `[]`.

- [ ] **Step 3: Add location to the haystack**

In `lib/rolefit/filter.ts:35`:

```ts
const hay = `${j.title} ${j.company_name} ${j.location ?? ""} ${j.role_category ?? ""} ${(j.skill_gaps ?? []).join(" ")}`.toLowerCase();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/rolefit/filter.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Align the placeholder**

In `Header.tsx:120`, set the placeholder to reflect what is searched, e.g. `Search roles, companies, locations…` (title, company, location, category, skill gaps are all searched now).

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/filter.test.ts dashboard/components/rolefit/Header.tsx
git commit -m "feat(board): search matches location; placeholder matches the haystack"
```

## Task 2.6: Mobile — reset scroll on select + fix first-paint flash (findings #8, #25)

**Files:**
- Modify: `components/rolefit/RolefitBoard.tsx:409-412` (handleSelect) and `:58-68` (useIsNarrow init)

- [ ] **Step 1: #8 — reset window scroll on narrow select**

In `handleSelect` (`:409-412`), after the existing `detailRef` scroll reset, add: when `isNarrow`, also `window.scrollTo(0, 0)` so the detail opens at the top on the single-pane layout.

- [ ] **Step 2: #25 — initialize `useIsNarrow` from matchMedia**

At `:58-68`, initialize the state from `window.matchMedia("(max-width: 760px)").matches` inside the `useState` initializer, SSR-guarded (`typeof window !== "undefined"`), so mobile's first client paint doesn't render the desktop layout then snap. Keep the existing resize listener.

```ts
const [isNarrow, setIsNarrow] = useState(() =>
  typeof window !== "undefined" ? window.matchMedia("(max-width: 760px)").matches : false,
);
```

- [ ] **Step 3: Typecheck + preview note**

Run: `cd dashboard && npx tsc --noEmit`
Preview: on a narrow viewport, opening a job scrolls to the top; no desktop→mobile snap on first load.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "fix(board/mobile): reset scroll on select; seed isNarrow from matchMedia"
```

## Task 2.7: Prepare/Apply button hierarchy (finding #10)

Until a job is `prepared`, Prepare should be the primary CTA and the external Apply secondary; after prepared, flip.

**Files:**
- Modify: `components/rolefit/ApplicationPanel.tsx:276-311`

- [ ] **Step 1: Read the two buttons and the `prepared` flag**

Read `ApplicationPanel.tsx:250-315` to find the `prepared` state and the Prepare (`:276-286`) and Apply (`:287-311`) buttons.

- [ ] **Step 2: Swap emphasis based on `prepared`**

When not `prepared`: Prepare uses the primary treatment (blue + shadow), Apply uses secondary (outline). When `prepared`: Apply primary, Prepare secondary/hidden. Prefer expressing both via `ui/Button` `variant` (`primary`/`secondary`) now — this pre-satisfies the Phase 4 sweep for this file. If Apply is an `<a>`, style it to match `Button`'s primary/secondary tokens (or wrap with `Button`'s styles) rather than hand-rolling new values.

- [ ] **Step 3: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: unprepared job shows Prepare as the prominent CTA; after Prepare completes, Apply becomes prominent.

```bash
git add dashboard/components/rolefit/ApplicationPanel.tsx
git commit -m "feat(board): make Prepare the primary CTA until the application is prepared"
```

## Task 2.8: Hover-reveal reject × on the job card (finding #14)

Preserve one-gesture rejection (no keyboard action keys). The card root is a `<button>`, so the × must be a sibling, not nested.

**Files:**
- Modify: `components/rolefit/JobCard.tsx` (wrap card + × in a relative container; new `onReject` prop)
- Modify: `components/rolefit/JobList.tsx` (thread `onReject`)
- Modify: `components/rolefit/RolefitBoard.tsx` (pass the existing reject handler)

**Interfaces:**
- Produces: `JobCardProps` gains `onReject?: (id: string) => void`; `JobListProps` gains `onReject?: (id: string) => void`.

- [ ] **Step 1: Restructure the card root**

In `JobCard.tsx`, wrap the existing `<button>` (the card) and a new reject `<button>` in a `<div style={{ position: "relative" }}>`. The reject button is absolutely positioned top-right, `opacity: 0` by default, revealed on container hover/focus-within. Example:

```tsx
return (
  <div
    style={{ position: "relative" }}
    onMouseEnter={/* optional: set a hover state, or use CSS */ undefined}
  >
    <button /* existing card button, unchanged */>{/* ... */}</button>
    {onReject && (
      <button
        type="button"
        aria-label={`Reject ${job.title}`}
        onClick={(e) => { e.stopPropagation(); onReject(job.id); }}
        className="rf-card-reject"
        style={{
          position: "absolute", top: "10px", right: "18px", zIndex: 1,
          width: "22px", height: "22px", borderRadius: "6px", border: "none",
          background: "rgba(20,28,40,.06)", color: "#5b6472", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
        }}
      >×</button>
    )}
  </div>
);
```

Add to `app/globals.css` a hover/focus reveal (inline styles can't do `:hover` of a parent):

```css
.rf-card-reject { opacity: 0; transition: opacity .12s; }
:where(div):hover > .rf-card-reject, .rf-card-reject:focus-visible { opacity: 1; }
```

Refine the selector to the card container (e.g. give the wrapper `className="rf-card"` and use `.rf-card:hover > .rf-card-reject`).

- [ ] **Step 2: Thread `onReject` through `JobList` to both list variants**

Add `onReject?: (id: string) => void` to `JobListProps`; pass it to every `<JobCard/>` (virtualized and plain).

- [ ] **Step 3: Wire the board's reject handler**

In `RolefitBoard.tsx`, pass the existing reject action as `onReject` to `<JobList/>`. Rejecting from the card must go through the same optimistic-update + Undo-toast + auto-advance path as Task 2.2 (call the same handler, keyed by id — look up the job by id if the handler needs the row).

- [ ] **Step 4: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: hovering a card reveals a reject ×; clicking it rejects (with Undo) without opening the detail; keyboard-focusing it reveals it too.

```bash
git add dashboard/components/rolefit/JobCard.tsx dashboard/components/rolefit/JobList.tsx dashboard/components/rolefit/RolefitBoard.tsx dashboard/app/globals.css
git commit -m "feat(board): hover-reveal reject × on job cards"
```

## Task 2.9: Human-readable correction enum labels (finding #26)

The correction editor renders raw tokens ("step_down", "far_reach"). Map to labels at render.

**Files:**
- Modify: `components/rolefit/ReviewPanel.tsx:164-172`
- Reference: `lib/rolefit/taxonomy` (existing token source)

- [ ] **Step 1: Find or add a token→label map**

Read `lib/rolefit/taxonomy*` and `lib/rolefit/correction*` to see if a label map exists. If one does, use it. If not, add a small `EXPERIENCE_MATCH_LABELS`/relevant map next to the taxonomy tokens (colocated with the enum), e.g. `{ step_down: "Step down", far_reach: "Far reach", ... }`, covering every token the select renders.

- [ ] **Step 2: Render labels in the select**

In `ReviewPanel.tsx:164-172`, render `LABELS[token] ?? token` as the option text; keep the token as the option `value` so the persisted correction is unchanged.

- [ ] **Step 3: Typecheck + commit**

Run: `cd dashboard && npx tsc --noEmit`

```bash
git add dashboard/components/rolefit/ReviewPanel.tsx dashboard/lib/rolefit/*taxonomy*
git commit -m "fix(board): show human-readable labels in the correction editor selects"
```

## Task 2.10: De-duplicate "Mark as applied" (finding #27)

Once prepared, "Mark as applied" appears in both the detail header action row (`JobDetail.tsx:451-468`) and the Application panel header (`ApplicationPanel.tsx:255-275`). Keep the panel one.

**Files:**
- Modify: `components/rolefit/JobDetail.tsx:451-468` (reduce the header row to Reject + status chips)

- [ ] **Step 1: Remove the header-row "Mark as applied"**

Read `JobDetail.tsx:451-468` and remove the duplicate "Mark as applied" affordance there, leaving Reject + status chips. Confirm the Application-panel one (`ApplicationPanel.tsx:255-275`) remains and still drives `handleMarkApplied`.

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: a prepared job shows exactly one "Mark as applied", next to Apply in the Application panel.

```bash
git add dashboard/components/rolefit/JobDetail.tsx
git commit -m "fix(board): keep a single 'Mark as applied' (Application panel), trim the header duplicate"
```

---

# Phase 3 — Off-board pages

## Task 3.1: Shared slim header across pages (finding #7)

Off-board pages only offer "← Back". Give every page a slim shared header (logo → board + Analytics/Companies/Profile links).

**Files:**
- Create: `components/rolefit/SlimHeader.tsx` (a lightweight nav; reuse the link set from `Header.tsx:168-184`)
- Modify: `app/analytics/page.tsx`, `app/companies/page.tsx`, `app/profile/page.tsx` (render it in place of / above the bare "← Back")

**Interfaces:**
- Produces: `SlimHeader` — a server-safe component (no client state) rendering the logo (link to `/`) + nav links to `/analytics`, `/companies`, `/profile`. Accepts `current?: "analytics" | "companies" | "profile"` to mark the active link.

- [ ] **Step 1: Extract the nav link set**

Read `Header.tsx:168-184` for the existing Analytics/Companies links + styling. Create `SlimHeader.tsx` reusing those tokens (logo + the three links), no board-specific state. Mark `current` with the active styling.

- [ ] **Step 2: Render it on the three pages**

Replace the bare "← Back to board" anchors on Analytics/Companies/Profile with `<SlimHeader current="…" />` (keep a back affordance if desired, but the shared nav supersedes it). For `PipelineDashboard.tsx:28`, the nav belongs on the page wrapper, not inside the dashboard body — put `SlimHeader` in `app/analytics/page.tsx` above `<PipelineDashboard/>`.

- [ ] **Step 3: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: every off-board page shows the shared nav; the active page is marked; Companies→Analytics is one click.

```bash
git add dashboard/components/rolefit/SlimHeader.tsx dashboard/app/analytics/page.tsx dashboard/app/companies/page.tsx dashboard/app/profile/page.tsx
git commit -m "feat(nav): shared slim header on Analytics/Companies/Profile"
```

## Task 3.2: Restrict profile-modal upload to PDF + fix copy (finding #11)

The modal advertises "PDF, DOC or TXT" and accepts `.doc/.docx/.txt`, but the server uploads everything as `application/pdf` and runs PDF extraction (`app/profile/page.tsx:89-101`), so non-PDF silently saves garbage.

**Files:**
- Modify: `components/rolefit/ProfileModal.tsx:361-363`,`:381`

- [ ] **Step 1: Restrict the accept + fix the copy**

In `ProfileModal.tsx`, set the file input `accept=".pdf,application/pdf"` and change the helper copy from "PDF, DOC or TXT — up to 5MB" to "PDF — up to 5MB" (match the profile page's PDF-only behavior). Do NOT add non-PDF extraction (out of scope).

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: the modal's file picker only offers PDFs; copy says PDF only.

```bash
git add dashboard/components/rolefit/ProfileModal.tsx
git commit -m "fix(profile): restrict résumé upload to PDF and correct the file-type copy"
```

## Task 3.3: Within-bucket search/sort on Companies (finding #15)

**Files:**
- Modify: `components/companies/CompanyList.tsx:49-51` (add a name filter input; optional sort)

- [ ] **Step 1: Add a client-side name filter**

`CompanyList` is a client component. Add a small controlled text input above the list that filters `rows` by company name (case-insensitive substring). Keep it minimal — one input, no debounce needed for a single-user list. Optionally add a sort select (e.g. newest reviewed first) if the row carries a reviewed/updated timestamp; skip sort if no such field exists (check `CompanyReviewRow`).

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: typing narrows the visible companies within the active bucket.

```bash
git add dashboard/components/companies/CompanyList.tsx
git commit -m "feat(companies): within-bucket name filter"
```

## Task 3.4: Sticky save bar + dirty guard on the profile page (finding #16)

One long single-column form with Save at the very bottom and no unsaved-changes guard.

**Files:**
- Modify: `components/ProfileFormShell.tsx:28-48` (sticky save bar; move last-saved/version into it)
- Modify: `app/profile/page.tsx:248` (dirty guard on "← Back" / navigation)

- [ ] **Step 1: Make the save bar sticky**

In `ProfileFormShell.tsx`, wrap the Save button (and the existing "Last saved … · version abc123" line) in a bottom-sticky bar (`position: sticky; bottom: 0`) with a solid background + top border so it's reachable from anywhere in the form.

- [ ] **Step 2: Add a dirty guard**

Track dirtiness in the shell (the form already tracks field state — reuse it, or compare serialized initial vs current). Add a `beforeunload` handler when dirty, and gate the in-app "← Back" (`app/profile/page.tsx:248`) behind a confirm when dirty. Reuse the modal's dirty-confirm pattern (`ProfileModal.tsx:88-95`) for consistency.

- [ ] **Step 3: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: Save is always visible; leaving with unsaved edits prompts a confirm; last-saved shows in the bar.

```bash
git add dashboard/components/ProfileFormShell.tsx dashboard/app/profile/page.tsx
git commit -m "feat(profile): sticky save bar + unsaved-changes guard"
```

## Task 3.5: Dirty-check the modal "Advanced settings →" link (finding #23)

"Advanced settings →" (`ProfileModal.tsx:402-413`) navigates away without the dirty check that Cancel/Escape/backdrop get (`:88-95`).

**Files:**
- Modify: `components/rolefit/ProfileModal.tsx:402-413`

- [ ] **Step 1: Route the link through the dirty-close path**

Change the Advanced-settings link to run the same `handleClose`/confirm-when-dirty logic before navigating (e.g. onClick → if dirty, confirm; then navigate to `/profile`). Reuse the existing dirty flag at `:88-95`.

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: editing then clicking "Advanced settings →" prompts before discarding.

```bash
git add dashboard/components/rolefit/ProfileModal.tsx
git commit -m "fix(profile): dirty-check the modal 'Advanced settings' navigation"
```

## Task 3.6: Analytics — readable date ticks + 2-col chart grid (finding #24)

Raw ISO ticks crowd the axes and 13 full-width charts stack into a long scroll.

**Files:**
- Modify: `components/analytics/Chart.tsx:35` (tickFormatter)
- Modify: `components/analytics/TrendCharts.tsx:106-136` (grid layout)

- [ ] **Step 1: Format x-axis date ticks as M/D**

In `Chart.tsx`, add a `tickFormatter` on the x-axis that renders ISO dates as `M/D` (e.g. `2026-06-05` → `6/5`). Guard non-date categories (only format when the tick parses as a date).

- [ ] **Step 2: Lay volume charts in a 2-col grid at ≥900px**

In `TrendCharts.tsx`, wrap the four VOLUME charts (and small breakdown-style charts) in a responsive grid mirroring `BreakdownsSection`'s `repeat(auto-fit, minmax(320px, 1fr))` so they sit two-up on wide screens and stack on narrow.

- [ ] **Step 3: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: x-axis shows `M/D`; volume charts are two-up on desktop.

```bash
git add dashboard/components/analytics/Chart.tsx dashboard/components/analytics/TrendCharts.tsx
git commit -m "fix(analytics): M/D date ticks + 2-col chart grid on wide screens"
```

## Task 3.7: Show the ModelPicker selection as a filled value (finding #28)

Each `ModelPicker` shows the selection only as placeholder + a small "selected: …" line, so pickers look unset. Mirror `LocationPicker`'s filled chip.

**Files:**
- Modify: `components/ModelPicker.tsx:30`,`:37-45`

- [ ] **Step 1: Render the current selection in the input**

In `ModelPicker.tsx`, render the selected model as a filled value/chip inside the control (as `LocationPicker` does with its chips), instead of relying on placeholder text. Keep the underlying selected value/prop unchanged.

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: each ModelPicker clearly shows its current model at a glance.

```bash
git add dashboard/components/ModelPicker.tsx
git commit -m "fix(profile): show the ModelPicker selection as a filled value"
```

---

# Phase 4 — Design-system consolidation + Tailwind removal

No behavior change — visual parity is the acceptance bar. Do this LAST so it sweeps up buttons/panels/pills added by Phases 1–3.

## Task 4.1: Migrate hand-rolled buttons → `ui/Button`

**Files:**
- Modify: `components/rolefit/JobDetail.tsx:379-468` (action row), `components/rolefit/JobList.tsx:21-31` (pill buttons), `components/rolefit/JobDetail.tsx:544` (retry), `components/rolefit/ReviewPanel.tsx:192-199` (correction editor), `app/error.tsx:41-57`

- [ ] **Step 1: Inventory current button styles vs `Button` variants**

Read `components/ui/Button.tsx` (variants `primary`/`secondary`/`ghost`, sizes `sm`/`md`) and each target. For each hand-rolled button, pick the matching variant/size; pass residual deltas via `style` (Button merges `style` last).

- [ ] **Step 2: Replace each hand-rolled button**

Swap each `<button style={{…}}>` for `<Button variant=… size=… onClick=… disabled=…>`. Preserve disabled/pending logic and labels exactly. For the `JobList` pill buttons, either use `Button` `ghost`/`secondary` or, if the pill look is distinct enough, keep a single shared `pillBtnStyle` (already defined) — but prefer `Button`. Convert `app/error.tsx:41-57`'s hand-rolled primary to `Button variant="primary"`.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/JobList.tsx dashboard/components/rolefit/ReviewPanel.tsx dashboard/app/error.tsx
git commit -m "refactor(ui): route hand-rolled CTAs through ui/Button"
```

## Task 4.2: Migrate hand-rolled panels → `ui/Panel`

**Files:**
- Modify: `components/rolefit/ResumePanel.tsx:76-81`, `components/rolefit/ApplicationPanel.tsx:374-379`, `components/rolefit/ReviewPanel.tsx:122-128` (and near-miss radius/gray variants in those files)

- [ ] **Step 1: Replace the `border/radius/padding` blocks with `<Panel>`**

`Panel` is `1px solid #e3e7ee / radius 16px / padding 19px 20px`. Replace each hand-rolled block matching (or near-missing) those tokens with `<Panel style={…}>` for any residual delta. Collapse near-miss radii (9/10/11/16px) and near-miss grays onto Panel's values per the boy-scout rule, unless a specific value is load-bearing (verify visually).

- [ ] **Step 2: Typecheck + commit**

Run: `cd dashboard && npx tsc --noEmit`

```bash
git add dashboard/components/rolefit/ResumePanel.tsx dashboard/components/rolefit/ApplicationPanel.tsx dashboard/components/rolefit/ReviewPanel.tsx
git commit -m "refactor(ui): route hand-rolled panels through ui/Panel"
```

## Task 4.3: Migrate recurring pills → `ui/Chip`

**Files:**
- Modify: the "Rejected · you", "✓ Applied", and Greenhouse-badge pill sites (grep for their inline styles across `components/rolefit/*`)

- [ ] **Step 1: Find the pill sites**

Run: `cd dashboard && grep -rn "Rejected\|Applied\|Greenhouse" components/rolefit | grep -i "background\|border" || true` and inspect each to locate hand-rolled pills not already using `Chip`.

- [ ] **Step 2: Replace with `<Chip>`**

`Chip` accepts `color`/`bg`/`border` props. Replace each hand-rolled pill with `<Chip color=… bg=… border=…>` preserving its colors. Reuse `Chip`'s default for neutral pills.

- [ ] **Step 3: Typecheck + commit**

Run: `cd dashboard && npx tsc --noEmit`

```bash
git add dashboard/components/rolefit
git commit -m "refactor(ui): route status pills through ui/Chip"
```

## Task 4.4: Convert `ModelPicker`/`LocationPicker` off Tailwind classes

These two are the only Tailwind-class users. Convert their `className` utilities to inline styles matching the surrounding design tokens (and, where they render buttons/inputs, to the `ui/*` primitives).

**Files:**
- Modify: `components/ModelPicker.tsx`, `components/LocationPicker.tsx`

- [ ] **Step 1: Replace Tailwind classes with inline styles / primitives**

Read both files; translate each Tailwind utility className (e.g. `flex`, `px-`, `rounded`, `border`, `focus:border-[#3b6fd4]`) into equivalent inline styles or `ui/*` usage. Preserve the `focus:border-[#3b6fd4]` behavior via the `rf-focusable` class from Task 1.3. Confirm no other `className` Tailwind utilities remain: `grep -rlnE 'className="[^"]*\b(flex|grid|px-|py-|text-|bg-|rounded|border|gap-|items-|justify-)' app components` returns nothing.

- [ ] **Step 2: Typecheck + preview note + commit**

Run: `cd dashboard && npx tsc --noEmit`
Preview: both pickers look identical to before.

```bash
git add dashboard/components/ModelPicker.tsx dashboard/components/LocationPicker.tsx
git commit -m "refactor(ui): convert ModelPicker/LocationPicker off Tailwind classes"
```

## Task 4.5: Remove Tailwind entirely

Once Task 4.4 lands, nothing uses Tailwind.

**Files:**
- Modify: `app/globals.css:1-3` (delete `@tailwind` directives, keep the rest)
- Modify: `postcss.config.mjs` (drop the `tailwindcss` plugin; keep `autoprefixer`)
- Delete: `tailwind.config.ts`
- Modify: `package.json` (remove `tailwindcss` from devDependencies)

- [ ] **Step 1: Strip the `@tailwind` directives**

Delete the three `@tailwind base/components/utilities` lines from `app/globals.css:1-3`. **Preserve everything else in that file** (box-sizing reset, body font, `rf-spin`, `.rf-scroll` scrollbar styles, the 760px media rule, and the `rf-focusable`/`rf-card-reject` rules added earlier).

- [ ] **Step 2: Drop the plugin and config**

Set `postcss.config.mjs` to:

```js
export default { plugins: { autoprefixer: {} } };
```

Delete `tailwind.config.ts`. Remove `"tailwindcss": "..."` from `package.json` devDependencies (keep `postcss` and `autoprefixer`). Run `npm install` to update the lockfile.

- [ ] **Step 3: Build and watch for preflight regressions**

Run: `cd dashboard && npm run build` (or, if env-blocked locally, defer to the preview deploy).
Expected: build passes. **Watch for preflight-removal regressions** — the Tailwind `base` layer previously reset default `button` borders, heading/list margins, etc. The app ships its own reset and inline-styles everything, so impact should be nil, but the Phase-4 review + preview must check headings, lists, and default buttons for newly-visible browser defaults. If any appear, add the specific reset rule to `app/globals.css` (do not re-add Tailwind).

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/globals.css dashboard/postcss.config.mjs dashboard/package.json dashboard/package-lock.json
git rm dashboard/tailwind.config.ts
git commit -m "chore(ui): remove Tailwind — app is fully on inline-style ui/* primitives"
```

---

## Task 5: Final full-branch review, preview verify, and merge

**Files:** none (integration)

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `cd dashboard && npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green. (Build may need the preview if env-blocked locally.)

- [ ] **Step 2: Full-branch review**

Run a review over the whole branch diff vs `main` (e.g. `/code-review` at high effort, or a review workflow). Address findings before merge.

- [ ] **Step 3: Vercel preview deploy + click-through**

Deploy a preview (`vercel` from the worktree root, per the "Dashboard perf + worktree deploy" memory — preview, not `--prod`). Click-test the load-bearing flows:
  - Companies: Included/Excluded/Unknown tabs each render their bucket; deep links work.
  - Board: `j`/`k`/arrows navigate with scroll-into-view; `/` focuses search; `Esc` clears; reject/mark-applied auto-advance; hover-× rejects; deep-link `?job=` scrolls into view.
  - Detail order is Review → Requirements → Application; Prepare/Apply emphasis flips on prepare.
  - a11y: keyboard focus visible on all inputs.
  - Consistency: buttons/panels/pills look unchanged after the migration; no Tailwind-preflight regressions (headings, lists, default buttons).

- [ ] **Step 4: Merge + deploy**

On approval, merge the branch to `main` (which auto-deploys per the deploy topology). Confirm the production deploy is healthy.

---

## Self-review notes (author checklist — completed)

- **Spec coverage:** all 28 findings mapped to tasks — Phase 1: #1(T1.1), #4(T1.2), #6(T1.3), #12(T1.4), #13(T1.5), #17/#18/#20(T1.6), #19(T1.7), #21/#22(T1.8); Phase 2: #2(T2.2), #3/#5(T2.3/T2.4), #9(T2.5), #8/#25(T2.6), #10(T2.7), #14(T2.8), #26(T2.9), #27(T2.10); Phase 3: #7(T3.1), #11(T3.2), #15(T3.3), #16(T3.4), #23(T3.5), #24(T3.6), #28(T3.7); Phase 4: consolidation + Tailwind removal(T4.1–4.5). Boy-scout cleanup folded into each task.
- **Type consistency:** `stepSelection`/`selectionAfterRemoval`/`indexOfId` (T2.1) are consumed by exact name in T2.2/T2.3; `JobList` prop additions (`hasUnfilteredJobs`, `scrollToId`, `onReject`) and `CompanyList` `activeBucket` are defined where introduced and consumed by their callers.
- **Testing altitude:** unit tests only where the env supports them (`lib/**/*.test.ts`, node); UI verified by typecheck + build + preview, matching the repo's real capability (no jsdom/RTL).
