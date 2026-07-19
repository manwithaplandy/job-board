# Pay range filter — design

**Date:** 2026-07-19
**Status:** Proposed (awaiting user approval)
**Problem:** The board's **Pay** filter is a single lower-bound with five discrete radio
stops — Any / $120k+ / $150k+ / $180k+ / $220k+ (`FilterBar.tsx` `PAY_DEFS`), stored as one
`payMin: number` (in $k). Users cannot express an upper bound (e.g. "$80k–$120k") — only a
floor. This redesign turns Pay into a **two-handle range slider** where the max handle can be
dragged to the far end to mean **"+"** (no upper limit), so a user can pick a range
(`80–120k`) *or* just a lower bound (`100k+`).

## Goals

- Two-handle slider for the Pay filter: a lower bound, an upper bound, and an unbounded-top
  ("+") state reachable by dragging the max handle to the end.
- Editable numeric fields mirroring the handles (drag *or* type), because a slider alone is
  imprecise for salary and native inputs carry keyboard/screen-reader support for free.
- Preserve continuity: `$100k+` (min set, max "+") behaves exactly like today's `$100k+`
  stop, and existing persisted filters (`payMin`-only cookies/DB rows) keep working.
- Give users control over the large tail of jobs that don't disclose pay: hide them by
  default (as today), but offer an in-dropdown **"Include jobs without listed pay"** toggle.
- Match the meticulous accessibility of the existing filter bar (labeled controls, keyboard
  operation, Escape/outside-click close, focus return).

## Non-goals

- No DB migration. `profiles.board_filters` is a jsonb column; the shape change is absorbed
  by the total parser (`parseBoardFilters`). No Python/Railway/reviewer-worker changes.
- No currency normalization. The filter compares raw numeric pay against $k thresholds
  (USD-centric), exactly as today — a pre-existing simplification, out of scope here.
- No hourly→annual conversion. Non-annual pay is treated as "no listed annual band" (governed
  by the include-toggle), not extrapolated to a yearly figure.
- No change to the Sort-by-pay behavior (still orders by `pay_max`), nor to any other filter
  (Category / Location / Source / Match / Remote).
- No server-side (SQL) pay filtering. Pay filtering stays entirely client-side in
  `applyFilters` over the already-loaded job pool.

## Approaches considered

**Control shape (chosen: slider + editable min/max fields).** A two-handle slider with two
small numeric fields beneath it. Drag or type; clearing the max field (or dragging it to the
end) means "+". Most precise and the most keyboard/screen-reader friendly. Rejected
alternatives: *slider + single live text readout* (cleanest but drag-only entry, weaker a11y);
*slider + legacy preset chips* (fast common picks but most UI crammed into a small dropdown).

**Match semantics (chosen: band overlaps range).** A job is kept if its pay band intersects
the selected window. Rejected: *band fully inside range* (hides a `$100–140k` job for an
`$80–120k` pick — too aggressive) and *top-of-band in range* (max-only, closest to today but
still drops open-topped "From $X" jobs). Overlap is the standard, and it makes `$100k+`
identical to today's `$100k+` — a clean continuity property.

**No-disclosed-pay jobs (chosen: hide by default + opt-in toggle).** Default to hiding
undisclosed-pay jobs while a pay filter is active (matches today), with an
"Include jobs without listed pay" checkbox to flip it. Rejected: *always hide* (loses the many
good roles that simply don't post pay, with no escape hatch) and *always show* (the filter
then silently lets undisclosed pay through, surprising users who set a floor).

## Design

### 1. The control (Pay dropdown contents)

The **Pay** trigger pill stays exactly where it is in the filter strip; only the dropdown body
changes from a radio list to:

```
Pay ▾
  ●━━━━━━━━●───────────○          two-handle slider, $0 … $400k+
  ┌────────┐      ┌────────┐
  │ $80k   │  –   │ $120k  │      editable min / max fields
  └────────┘      └────────┘
  ☐ Include jobs without listed pay
```

- **Domain:** `PAY_FLOOR = 0`, `PAY_CEIL = 400` ($k), `PAY_STEP = 10` ($k) — 41 stops.
  Shared constants (see §4) so the slider and the parser agree on bounds.
- **Unbounded top ("+"):** the max handle's rightmost stop (`PAY_CEIL`) means *no upper
  limit*. Stored as `payMax = null`. The max field then displays `+` (empty/placeholder).
- **No-floor:** min handle at `0` means no lower bound (`payMin = 0`).
- **Fields:** lenient parse — `120`, `120k`, `$120k`, `120000` all resolve to $120k; the max
  field additionally accepts empty / `+` / `any` → unbounded. On blur, values are clamped to
  `[0, 400]`, snapped to the step, and normalized so `min ≤ max` (or max stays null).
- **"Include jobs without listed pay"** checkbox, default **off**.

### 2. Filter state (`lib/rolefit/filter.ts` — `BoardFilterState`)

Replace the single `payMin: number` with three flat fields (flat keeps the existing
"serialize the whole object" persistence and mirrors every other filter field):

```ts
payMin: number;                 // $k, 0 = no floor
payMax: number | null;          // $k, null = "+" / unbounded top
payIncludeUndisclosed: boolean; // default false
```

`DEFAULT_FILTERS` gains `payMin: 0, payMax: null, payIncludeUndisclosed: false`.

### 3. Match logic (`applyFilters`) — band overlaps range

The pay block is rewritten. Let the **selected window** be
`[payMin·1000, payMax === null ? +∞ : payMax·1000]`. The filter is **inactive** when
`payMin === 0 && payMax === null` (full unbounded span) — in that case no pay pruning happens
and the include-toggle is irrelevant.

When active, for each job:

- **Determine the job's annual band.** A job contributes a band only if `pay_period === "year"`
  and it discloses at least one of `pay_min` / `pay_max`. The band is
  `[pay_min ?? 0, pay_max ?? +∞]` (so "Up to $X" → `[0, X]`, "From $X" → `[X, +∞]`).
- **No usable annual band** (hourly, or both pay bounds null): keep the job **iff**
  `payIncludeUndisclosed` is true; otherwise drop it.
- **Has an annual band:** keep the job **iff** the band overlaps the window —
  `jobLo ≤ winHi && winLo ≤ jobHi`. A job disclosing pay *outside* the window is dropped
  regardless of the include-toggle (the toggle only governs no-band jobs).

Continuity check — `payMin > 0, payMax = null` (a pure lower bound): window `[payMin·1000, ∞]`,
overlap reduces to `payMin·1000 ≤ jobHi`. For a closed-band job (`jobHi = pay_max`) that is
`pay_max ≥ payMin·1000` — **identical to today's rule**. It additionally now keeps open-topped
"From $X" jobs (`jobHi = ∞`), which today's `pay_max`-only rule wrongly dropped — an intended
correctness improvement.

Helper functions colocated here: `payRangeActive(st)` and the per-job predicate. Sort-by-pay
is untouched.

### 4. Shared bounds constants

`PAY_FLOOR = 0`, `PAY_CEIL = 400`, `PAY_STEP = 10` exported from `lib/rolefit/filter.ts` and
imported by both `PayRangeSlider` and `parseBoardFilters`, so the slider's reachable values and
the parser's clamp range can never drift.

### 5. Persistence & backward-compat (`lib/rolefit/boardFilters.ts`)

`parseBoardFilters` is the single boundary that rehydrates cookie/DB filter state (jsonb read
*and* the POST body in `/api/board-filters/route.ts`). Extend it, keeping it a total parser:

- `payMin`: non-negative number, clamped to `[PAY_FLOOR, PAY_CEIL]`, else `0`.
- `payMax`: a new `numOrNull`-style parse — a finite non-negative number clamped to
  `[PAY_FLOOR, PAY_CEIL]`, or `null` when **absent, non-numeric, or explicitly null**. Then
  normalized: if `payMax !== null && payMax < payMin`, set `payMax = null` (drop an incoherent
  ceiling rather than invert the range).
- `payIncludeUndisclosed`: boolean, default `false`.

**Backward-compat:** old records have `payMin` only. `payMax` absent → `null` (unbounded top),
`payIncludeUndisclosed` absent → `false`. So a stored "$150k+" rehydrates to
`{payMin: 150, payMax: null, includeUndisclosed: false}` = "$150k+", unchanged.

`serializeBoardFilters` is unchanged (whole-object `JSON.stringify`; `payMax: null` serializes
fine). No migration — old and new shapes coexist and every read passes through the parser.

### 6. Components & wiring

**`PayRangeSlider` (new, `components/rolefit/PayRangeSlider.tsx`).** Self-contained,
unit-testable dual-thumb control:

- Two overlaid native `<input type="range" min=0 max=400 step=10>` (min-thumb, max-thumb) with
  the usual pointer-events/z-index layering so both thumbs are draggable, plus a styled fill
  `<div>` for the selected band. Native inputs give arrow-key operation for free.
- Each range input carries `aria-label` ("Minimum pay" / "Maximum pay") and `aria-valuetext`
  (`"$80k"` / `"No limit"` for the unbounded max). The two numeric fields are labeled.
- **Draft vs committed (performance):** the slider keeps ephemeral *draft* thumb state and
  updates the live label/fields on the range input's `input` event, but only calls
  `onChange(committedMin, committedMax)` on the `change` event (thumb release) and on field
  blur. This prevents re-filtering ~6k rows on every pointer-move, mirroring the deferred
  search. Thumbs are clamped so `min ≤ max`; max at `PAY_CEIL` emits `payMax = null`.

**`FilterMenu` gains `variant?: "listbox" | "dialog"` (`components/rolefit/FilterBar.tsx`).**
Today `FilterMenu` hard-codes listbox semantics (roving focus among `role="option"` children),
which don't fit a slider. The `"dialog"` variant:

- trigger `aria-haspopup="dialog"`; popup `role="dialog"` + `aria-label`;
- on open, focus the first focusable control in the popup (the min field) instead of a
  selected option; **no** roving-focus keydown handler — native Tab order moves among the
  slider/fields/checkbox;
- Escape closes and returns focus to the trigger; Tab past the last control closes the menu
  (parity with the listbox's Tab-out close);
- unchanged: `data-menuroot` wrapper drives the board's outside-click close and the `/`
  search-shortcut guard; the "selection unmounts focused option → refocus trigger" effect
  no-ops here (a dialog doesn't close on internal changes).

All other filters keep the default `"listbox"` variant — no behavior change.

**Pay popover body (in `FilterBar`).** The Pay `FilterMenu` (now `variant="dialog"`) renders
`<PayRangeSlider>` plus the "Include jobs without listed pay" checkbox row. Badge and active
state:

- `fmtPayRange(payMin, payMax)` → `"$80–120k"` (both set) / `"$100k+"` (min only) /
  `"Up to $120k"` (max only) / `null` (inactive → no badge). Colocated with `fmtPay` in
  `lib/rolefit/fit.ts` (both are pay formatting).
- Pill highlighted (`activeBtn`) when `payMin > 0 || payMax !== null`.

**`FilterBarProps`.** Replace `payMin: number` + `onSetPayMin` with `payMin`, `payMax`,
`payIncludeUndisclosed`, `onSetPayRange(min, max)`, `onTogglePayUndisclosed()`.

**`RolefitBoard.tsx`.** Replace the `payMin` state with `payMin` / `payMax` /
`payIncludeUndisclosed` (seeded from `initialFilters`). Include all three in the `filterState`
memo (persistence + `applyFilters` pick them up automatically). `clearFilters` resets all three
to defaults. Handlers: `handleSetPayRange` and `handleTogglePayUndisclosed` update state but —
unlike the radio handlers — **do not** close the menu (the user keeps adjusting; the popover
closes on Escape / outside-click / Tab-out).

## Error handling

No new failure surfaces. Field parsing is total (unparseable input snaps back to the last valid
clamped value on blur; it never throws or persists a bad shape). Persistence stays best-effort:
`/api/board-filters` already swallows save failures, and `parseBoardFilters` yields safe values
for any malformed stored/POSTed body. A `payMax < payMin` inversion is normalized away in the
parser and clamped in the slider, so an incoherent range can't reach `applyFilters`.

## Testing

- **`lib/rolefit/filter.test.ts`** — the overlap matrix (fully-inside / overlapping-top /
  overlapping-bottom / no-overlap, both bounds and lower-bound-only windows); undisclosed and
  hourly jobs hidden by default and shown when `payIncludeUndisclosed`; a disclosed
  out-of-window job stays hidden even with the toggle on; `$100k+` equals the legacy result;
  open-topped "From $X" now matches. Inactive state (`0` / `null`) filters nothing.
- **`lib/rolefit/boardFilters.test.ts`** — legacy `payMin`-only rehydration →
  `{payMin, payMax: null, includeUndisclosed: false}`; clamping to `[0,400]`; `payMax: null`
  round-trips; `payMax < payMin` normalized to `null`; boolean coercion + default; malformed
  body → defaults.
- **`lib/rolefit/fit.test.ts`** (or a small new suite) — `fmtPayRange` for all four label
  cases.
- **Component (jsdom)** — `PayRangeSlider`/`FilterBar`/`RolefitBoard`: dragging (firing
  `input`/`change` on the range inputs) and typing in fields updates the pill badge; the
  checkbox toggles `payIncludeUndisclosed`; `clearFilters` resets the control. Mind the known
  jsdom gotchas (range-input event dispatch; assert on state/DOM not layout).
- **Contracts** — `npm run test:ui-contract` must stay green (shared UI primitives, no raw
  interactive elements outside `components/ui/` where the contract requires it, tokens only),
  plus the full dashboard vitest suite.
- **Live verification** — dev-shim board (per memory technique) in light and dark: drag both
  handles, drive the max handle to "+", type into the fields, toggle the checkbox, confirm the
  board re-filters on release and the badge/label match; keyboard-only operation (Tab to Pay,
  arrow the thumbs, Escape to close).

## Rollout

Frontend-only branch. No migration, no backend deploy. Merge to `main` → Vercel auto-deploys.
