# Job-card reject affordance redesign — design

**Date:** 2026-07-17
**Status:** Proposed (awaiting user approval)
**Problem:** The hover-revealed reject ×  on board job cards (#14, `e0caf70`) is a 44px
danger IconButton absolutely positioned over the card's right edge
(`board.css .rf-job-card__reject`). Live measurement on prod: it fully occludes the
rightmost ~39px of the "Company · Location" line (including its truncation ellipsis),
grazes the fit-score pill and the top of the rightmost chip, and sits click-through-proof
(z-index 1, pointer-events auto) on top of card text — so aiming at the right side of a
card to open it can reject it instead, with no confirmation. It is icon-only (no visible
label) and invisible at rest (zero discoverability).

## Goals

- No occlusion: the reject control must never cover card text, the score pill, or chips.
- Legible intent: a small, labeled red "Reject" control, matching the detail pane's
  labeled Reject button and the Rolefit design system.
- Keep the fast triage gesture: hover/keyboard-focus reveal on the "all" view only,
  one click to reject, 5s Undo toast, auto-advance — all unchanged.
- Fix the anon rough edge: today the card × renders for signed-out visitors and clicking
  it navigates them to /login mid-toast (server action `requireUserId` redirect). The
  card affordance becomes authed-only, like the detail-pane Reject already is.

## Non-goals

- No touch/mobile card-level reject (hover-reveal is unreachable on touch by design;
  the detail pane's 44px Reject button remains the touch path).
- No change to reject semantics (`rejectJob`/`unrejectJob` server actions, optimistic
  hide, undo, view gating) or to the Rejected/Applied views.
- No new visual-regression board state.

## Approaches considered

**A (chosen) — hover-revealed labeled "Reject" pill in a reserved chips-row slot.**
A chip-scale danger pill (visible text "Reject") anchored at the card's bottom-right,
vertically aligned with the chips row. The chips row reserves a right gutter when the
card is rejectable, so the pill fades into space no content ever occupies. Zero
occlusion, no layout shift on hover, minimal height change, keeps one-gesture triage.

**B — keep the icon ×, add a permanent right gutter.** Smallest diff (content
`padding-right: 48px` when rejectable), but every card permanently loses ~48px of
title/meta/chips width for a control that is invisible at rest, and the icon-only
discoverability problem remains. Rejected.

**C — always-visible "Reject" in a card footer strip.** Best discoverability and would
add a touch path, but adds ~26px to every card (~20% taller list), puts N always-red
buttons on the board (visual noise a triage queue doesn't want), requires
`estimateSize` retune and non-trivial virtualization churn. Rejected.

## Design (approach A)

### Control

- Shared `Button` primitive (UI contract forbids raw `<button>` outside
  `components/ui/`), `variant="secondary"`, visible child text `Reject`,
  `aria-label={"Reject " + job.title}` (visible text is contained in the accessible
  name → WCAG 2.5.3 satisfied; per-job label preserved for screen readers).
- Rendered exactly where the IconButton is today: a DOM **sibling** of
  `.rf-job-card__button` inside `.rf-job-card` (interactive elements cannot nest in the
  card button). `onClick` keeps `e.stopPropagation()` + `onReject(job.id)`.
- Restyled entirely in `board.css` (JobCard.tsx has no inline-geometry exemption) to a
  danger-tinted pill: `color: var(--danger); background: var(--danger-bg);
  border: 1px solid var(--danger-border); border-radius: var(--radius-badge);`
  compact geometry (`min-height: 24px; padding-inline: var(--space-2);
  font-size: var(--font-size-small)`). Tokens only — correct in light and dark
  automatically. Selector must outrank `.rf-button--secondary`
  (use `.rf-job-card .rf-job-card__reject` or double-class), since ui.css/board.css
  import order is not guaranteed.

### Placement + reserved slot (the no-overlap mechanism)

- `.rf-job-card__reject { position: absolute; right: var(--space-3);
  bottom: var(--space-3); z-index: 1; }` — bottom-right, sharing the chips row's band.
- `JobCard` adds a wrapper modifier `rf-job-card--rejectable` when `onReject` is
  present. CSS reserves the slot: `.rf-job-card--rejectable .rf-job-card__chips
  { padding-right: 84px; min-height: 24px; }`.
  - `padding-right` keeps chips from ever wrapping under the pill.
  - `min-height` guarantees the band exists even on a card with zero chips (pay,
    arrangement, and category can all be absent), so the pill never falls back onto
    the meta line. Cards with chips don't change height (chips are already ~22px);
    `JobList` `estimateSize: 116` stays valid and `measureElement` absorbs the ±2px.
  - Accepted cost: the narrow/touch layout still threads `onReject` on the authed
    "all" view, so those cards reserve the gutter even though the pill can't
    hover-reveal on touch (chips wrap slightly earlier; zero-chip cards gain ~24px).
    Gating with `@media (hover: hover)` was rejected — it would also disable the
    `:focus-within` reveal for keyboards attached to touch devices.

### Reveal

- Same states as today: hidden at rest (`opacity: 0; pointer-events: none` — the
  pointer-events guard keeps the invisible control from being a tap target on touch),
  revealed on `.rf-job-card:hover`, `.rf-job-card:focus-within`, and its own
  `:focus-visible`; 0.12s opacity fade (collapses under the global
  prefers-reduced-motion override).
- CSS consolidation: today the reveal is split across `globals.css:343-351` (base +
  focus-visible + a **dead** `.rf-card:hover` pair left over from the original #14 plan
  — `.rf-card` is the generic Panel, never contains a reject) and
  `board.css:174-175` (the live hover pair). Move everything into `board.css` as the
  single source and delete the `globals.css` block.

### Gating

- `RolefitBoard.tsx` list wiring becomes
  `onReject={isAuthed && view === "all" ? handleRejectById : undefined}`; anon boards
  render no card reject (matching the already-`isAuthed`-gated detail-pane Reject) and
  the anon click-→-/login bounce disappears. All other behavior (optimistic hide, Undo
  toast, auto-advance, error rollback) is untouched.

### Accessibility trade-off (explicit)

The pill's hit target is ~24×64px, meeting WCAG 2.5.8 (AA, 24px) but below the house
44px `--target-size`. This is deliberate: the control is a pointer/keyboard-only
redundant shortcut (touch cannot reveal it; the detail pane's 44px Reject is the
primary path), and restoring a 44px hit box via an invisible padding halo would
recreate exactly the mis-click-on-card-text hazard this redesign removes. The
`undersized-target` CSS audit does not flag this only because the pill's selectors
never classify as interactive (no element/name token, no `:hover`/`:focus` on the
sizing rule) — the 24px min-height itself does match the audit's size regex, so the
class must not be renamed to contain `button|btn|cta|action|link|trigger|control`
and sizing must stay out of pseudo-state rules (noted in the board.css comment).

## Error handling

Unchanged — reject failures roll back the optimistic hide and surface
"Couldn't save rejection — try again." via the existing `role="alert"` path; Undo
failures re-hide and surface the existing error. No new failure modes are introduced
(the anon failure mode is removed).

## Testing

- `JobCard.test.tsx` (extend; today the reject branch is never mounted in any test):
  with `onReject` — renders a button with accessible name `Reject <title>`, visible
  text `Reject`, wrapper has `rf-job-card--rejectable`; clicking it calls `onReject`
  once and never `onSelect`; without `onReject` — no reject button, no modifier class.
- `RolefitBoard` test: anon (`isAuthed={false}`) board renders no card-level
  `Reject <title>` button even in the "all" view; authed board does.
- Contracts: `npm run test:ui-contract` (static audit must stay green — shared
  primitive, no glyphs, tokens only, no inline geometry in JobCard.tsx) and the full
  dashboard vitest suite (visual fixtures don't mount `onReject`, so no snapshot churn).
- Live verification: dev-shim board (per memory technique), hover + keyboard-tab a
  card in light and dark, confirm no occlusion and the anon board shows no pill.
