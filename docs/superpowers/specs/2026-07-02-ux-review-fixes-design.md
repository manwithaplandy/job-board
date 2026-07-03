# Rolefit UX review fixes — design

**Date:** 2026-07-02
**Status:** Approved, ready for planning

## Summary

Act on the full UX/UI review of the Rolefit dashboard: **28 findings (P0–P3)** plus the
**design-system consolidation** cross-cutting theme. All work lands on a single branch
(this worktree), implemented in **four phases**, each phase implemented → reviewed →
iterated to merge-ready via a multi-agent workflow. After all four phases, one final
full-branch review pass, then merge to `main` + deploy once.

The source review (28 findings with `file:line` anchors, per-page deep-dives, and
cross-cutting themes) is the input to this spec. This document organizes those findings
into an actionable, phased plan and records the resolved either/or decisions.

## Motivation

The board is a strong daily-driver, but the review surfaced one functionally broken page
(Companies bucket tabs), a set of workflow-acceleration gaps (dead-end triage loop, no
keyboard navigation, inverted detail-pane order), a handful of accessibility regressions
(removed input focus outlines, low-contrast small text), and pervasive styling drift (two
styling systems, three button implementations, `ui/*` primitives that exist but are mostly
bypassed). Fixing these makes the single daily user materially faster and the codebase
consistent.

## Locked decisions

- **Scope:** all 28 findings **+** full design-system consolidation (cross-cutting theme #1).
- **Delivery:** one branch (`worktree-vivid-wishing-teapot`). Phases are **review/iteration
  units, not deploy units** — everything merges together at the end.
- **Styling direction:** standardize on the **existing inline-style `ui/*` primitives**
  (`Button`, `Panel`, `Chip` — all already exist in `dashboard/components/ui/`). Migrate
  hand-rolled inline styles onto the primitives, convert the two Tailwind-class stragglers
  (`ModelPicker`, `LocationPicker`), and then **remove Tailwind entirely** — the codebase
  ends on a single styling system.
- **Keyboard scheme:** navigation + search only. No destructive/action keys.
- **New CTAs written during any phase use `ui/Button`/`ui/Panel`/`ui/Chip` from the start**,
  so the Phase 4 consolidation sweep stays small.
- **Cleanup is in scope (boy-scout rule).** Within any file a phase touches, opportunistic
  cleanup is expected — remove dead code and unused imports, delete stale comments, collapse
  near-miss token drift (the 9/10/11px radii, near-miss grays) onto the primitives' values.
  The goal is to leave the codebase cleaner and avoid tech debt. The bound: cleanup stays
  within touched files/modules; no wholesale rewrite of unrelated subsystems.

## Phase plan

All paths relative to `dashboard/`. Phase ordering puts consolidation **last** so it sweeps
up every button/panel/pill added by earlier phases.

### Phase 1 — P0 + quick wins

Small, mostly independent, low regression. Unbreaks the Companies page.

| # | Sev | Area | Fix | Anchor |
|---|-----|------|-----|--------|
| 1 | P0 | Companies | Bucket tabs become `<a href="?bucket=…">` links (server refetch, shareable URLs); active tab seeded from the `?bucket=` param instead of a local `useState`. | `app/companies/page.tsx:56-58`, `components/companies/CompanyList.tsx:21-47` |
| 4 | P1 | Board detail | Reorder: **Review → Requirements → Application** (evaluation before generation actions). | `components/rolefit/JobDetail.tsx:499` (Application), `:527` (Review), `:552` (Requirements) |
| 6 | P1 | Global a11y | Restore a visible `:focus-visible` treatment (border `#3b6fd4` + subtle ring) on inputs that had `outline:none` with no replacement. | `components/rolefit/Header.tsx:125`, `app/login/page.tsx:95`,`:121`, `app/profile/page.tsx:193`, `components/rolefit/ProfileModal.tsx:305` |
| 12 | P2 | Board | Branch the empty state on `jobs.length === 0` (pre-filter): pipeline message + Analytics link, not "No roles match your filters". | `components/rolefit/JobList.tsx:117-126` |
| 13 | P2 | Board | Scope the "N of M" counter denominator to the active view's pool (or show "3 applied" / "5 rejected"). | `components/rolefit/FilterBar.tsx:659`, `components/rolefit/RolefitBoard.tsx:797` |
| 17 | P3 | Board header | Drop the raw enum text next to the status dot (keep dot + tooltip); make/kill the "N unreviewed" affordance so it isn't a fake link. | `components/rolefit/Header.tsx:155-165` |
| 18 | P3 | Board | Add `role="status"` to the Undo toast container (error toast already has `role="alert"`). | `components/rolefit/RolefitBoard.tsx:935-951` |
| 19 | P3 | Global a11y | Darken `#9aa3b0` (~2.7:1) to ~`#7a8494` for small text meant to be read (form hints, facet counts, timestamps). | `app/profile/page.tsx:179-184`, `components/rolefit/FilterBar.tsx:346`, `components/analytics/HealthCards.tsx:49` |
| 20 | P3 | Board card | Omit the work-arrangement chip when arrangement is unknown (currently renders a lone "—"). | `components/rolefit/JobCard.tsx:30-33`,`:142` |
| 21 | P3 | Login | Add `autoComplete="email"` / `current-password`. | `app/login/page.tsx:86-98`,`:111-124` |
| 22 | P3 | Global | Per-page `metadata.title` ("Analytics · Rolefit", etc.). | `app/layout.tsx:10-13` |

### Phase 2 — Board interaction

Cohesive behavioral review. #2/#3/#5 share one "move selection" primitive — extract that
into a pure, testable helper.

| # | Sev | Area | Fix | Anchor |
|---|-----|------|-----|--------|
| 2 | P1 | Board | After reject/mark-applied, **auto-select the next job in `visible`** (fall back to previous/none); keep the Undo toast. | `components/rolefit/RolefitBoard.tsx:417`,`:698` |
| 3 | P1 | Board | **Keyboard triage (navigation + search only):** `j`/`↓` next, `k`/`↑` prev, `Enter` open, `Esc` close/clear, `/` focus search. **No `r`/`a` action keys.** Suppress while an input/menu/modal is focused. | `components/rolefit/RolefitBoard.tsx:199-207` (only listener), `components/rolefit/JobList.tsx` |
| 5 | P1 | Board | On deep-link seed AND keyboard nav, call `virtualizer.scrollToIndex(i)` so the selected card is visible. | `components/rolefit/RolefitBoard.tsx:252-258`, `components/rolefit/JobList.tsx:55-61` |
| 8 | P2 | Board (mobile) | `handleSelect`: `if (isNarrow) window.scrollTo(0,0)` so the detail pane opens at the top on narrow screens. | `components/rolefit/RolefitBoard.tsx:409-412`,`:840-845` |
| 9 | P2 | Board | Extend the search haystack to include **location** (min.) and align the placeholder to what is actually searched. | `components/rolefit/Header.tsx:120`, `lib/rolefit/filter.ts:35` |
| 10 | P2 | Board detail | Make **Prepare primary until `prepared`**, then flip emphasis to Apply. | `components/rolefit/ApplicationPanel.tsx:276-286` (Prepare), `:287-311` (Apply) |
| 14 | P2 | Board card | **Keep** a hover-revealed reject `×` (positioned sibling, not nested in the card `<button>`) — preserves one-gesture rejection given no keyboard action keys. | `components/rolefit/JobCard.tsx:43-63` |
| 25 | P3 | Board (mobile) | Initialize `useIsNarrow` from `window.matchMedia` in the state initializer (SSR-guarded) to avoid the desktop→mobile first-paint snap. | `components/rolefit/RolefitBoard.tsx:58-68` |
| 26 | P3 | Board detail | Map correction-editor enum tokens ("step_down" → "Step down") to labels at render. | `components/rolefit/ReviewPanel.tsx:164-172`, `lib/rolefit/taxonomy` |
| 27 | P3 | Board detail | Keep the Application-panel "Mark as applied"; reduce the duplicate header action row to Reject + status chips. | `components/rolefit/JobDetail.tsx:451-468`, `components/rolefit/ApplicationPanel.tsx:255-275` |

### Phase 3 — Off-board pages

Per-page review of Profile / Companies / Analytics.

| # | Sev | Area | Fix | Anchor |
|---|-----|------|-----|--------|
| 7 | P2 | Global shell | Extract a **slim shared header** (logo → board + Analytics/Companies/Profile links) into the layout so every off-board page has nav + identity. | `components/rolefit/Header.tsx:168-184`, `components/analytics/PipelineDashboard.tsx:28`, `app/companies/page.tsx:63`, `app/profile/page.tsx:248` |
| 11 | P2 | Profile modal | Restrict the upload to **`.pdf`** (match the profile page) and fix the "PDF, DOC or TXT" copy. NOT building .docx/.txt extraction — server only does PDF text extraction. | `components/rolefit/ProfileModal.tsx:361-363`,`:381`, `app/profile/page.tsx:89-101` |
| 15 | P2 | Companies | Add a within-bucket **name filter** and a sort control (e.g. newest reviewed first); virtualize if needed. | `components/companies/CompanyList.tsx:49-51` |
| 16 | P2 | Profile page | **Sticky save bar** (button + last-saved/version line moved into it) and a dirty guard on "← Back" (`beforeunload` + in-app confirm). | `components/ProfileFormShell.tsx:28-48`, `app/profile/page.tsx:248` |
| 23 | P3 | Profile modal | Route "Advanced settings →" through the same dirty-check that Cancel/Escape/backdrop get. | `components/rolefit/ProfileModal.tsx:402-413`,`:88-95` |
| 24 | P3 | Analytics | `tickFormatter` ISO dates → `M/D`; lay the four VOLUME charts (and small breakdown charts) in a 2-col grid at ≥900px. | `components/analytics/Chart.tsx:35`, `components/analytics/TrendCharts.tsx:106-136` |
| 28 | P3 | Profile page | Render the `ModelPicker` selection as a filled value/chip in the input (mirror `LocationPicker`), so pickers don't all look unset. | `components/ModelPicker.tsx:30`,`:37-45` |

### Phase 4 — Design-system consolidation (theme #1)

Isolated refactor review; final normalization sweep. No behavior change — visual parity is
the acceptance bar.

- Migrate hand-rolled CTAs → **`ui/Button`**: `JobDetail.tsx:379-468` action row, `JobList.tsx:21-31`
  pills, `JobDetail.tsx:544` retry, `ReviewPanel.tsx:192-199` correction editor, `app/error.tsx:41-57`.
- Migrate hand-rolled panels → **`ui/Panel`**: `ResumePanel.tsx:76-81`, `ApplicationPanel.tsx:374-379`,
  `ReviewPanel.tsx:122-128` (and the near-miss radius/gray variants).
- Migrate recurring pill patterns → **`ui/Chip`**: "Rejected · you", "✓ Applied", the Greenhouse badge.
- Convert **`ModelPicker`** and **`LocationPicker`** off Tailwind classes onto the inline-style
  primitives for uniformity.
- **Remove Tailwind entirely** (nothing depends on it once the two components above are converted):
  - Delete the three `@tailwind base/components/utilities` directives from `app/globals.css:1-3`;
    **preserve the rest of that file** (box-sizing reset, body font, `rf-spin` keyframe,
    `rf-scroll` scrollbar styles, the `@media (max-width:760px)` rule).
  - Drop the `tailwindcss` plugin from `postcss.config.mjs` (**keep `autoprefixer`** — it is
    independent of Tailwind).
  - Delete `tailwind.config.ts` and remove `tailwindcss` from `package.json` devDependencies
    (keep `postcss`/`autoprefixer`).
  - **Risk to watch:** dropping the Tailwind `base` layer (preflight) removes its default
    resets. The app already ships its own reset and styles everything with inline styles, so
    impact should be minimal, but the Phase 4 review + preview click-through must check for
    preflight-provided defaults leaking through (default `button` border, heading/list
    margins). `next build` must pass.

## Resolved either/or decisions

Recorded here so the plan writer does not re-derive them:

1. **Companies tabs (#1):** links with `?bucket=` (server refetch), not client-only fetch of all
   three buckets. Simpler and matches the existing server-fetch design.
2. **Search (#9):** extend the haystack (add location); do not merely fix the placeholder.
3. **Upload (#11):** restrict to PDF + fix copy; do not add non-PDF extraction (YAGNI).
4. **Card quick-action (#14):** keep the hover `×` — it is the fast-reject path now that there
   are no keyboard action keys, and a deliberate hover-click carries no accidental-keypress risk.
5. **Consolidation direction:** standardize on the inline-style `ui/*` primitives (they already
   exist, tokens copied verbatim from canonical CTAs), not a Tailwind rewrite.

## Execution model

- **Single branch:** `worktree-vivid-wishing-teapot` (this worktree).
- **Per phase:** one `Workflow` run that (a) **implements** the phase's findings, fanned out by
  file/finding; (b) **reviews** adversarially with distinct lenses (correctness, a11y,
  visual-parity); (c) **iterates** until the review is clean / merge-ready. The main session
  reports back to the user between phases.
- **After Phase 4:** one **final full-branch review** over the whole diff, then a **Vercel preview
  deploy** to click-test the load-bearing flows (Companies bucket tabs, keyboard navigation, the
  reject/apply → auto-advance triage loop), then **merge to `main` + single deploy**.

## Testing & verification

- Dashboard uses **vitest**. Behavior-changing fixes get unit tests:
  - Companies bucket routing (#1) — param → fetched bucket mapping.
  - Search haystack (#9) — location now matches; placeholder claims match reality.
  - Counter denominator (#13) — per-view pool.
  - Empty-state branching (#12) — zero-data vs zero-match.
  - Selection-advance + keyboard nav (#2/#3/#5) — extract the "next/prev visible index" logic
    into a pure reducer/helper and unit-test it (out of the React component).
- **Consolidation (Phase 4)** has no behavior change: acceptance is visual parity, leaning on the
  primitives being token-identical (already verbatim) plus agent visual-diff review and the
  preview click-through.
- **Worktree caveat:** `.env.local` is not present in this worktree, so `npm run dev` 500s here.
  Live verification happens on the **Vercel preview deploy**, not a local dev server in the worktree.

## Out of scope

- Non-PDF résumé extraction (.doc/.docx/.txt) — finding #11 is fixed by restricting to PDF.
- Keyboard **action** keys (`r`/`a`) — navigation + search only, by decision.

Note: general cleanup is explicitly **in** scope (see the boy-scout-rule decision above);
only wholesale rewrites of subsystems unrelated to a listed finding stay out.
