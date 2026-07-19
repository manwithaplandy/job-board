# Pay Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the board's single-lower-bound "Pay" dropdown with a two-handle range slider (lower bound, upper bound, and an unbounded-top "+" state), plus an "Include jobs without listed pay" toggle.

**Architecture:** The pay filter is entirely client-side. `BoardFilterState` gains `payMax: number | null` (null = "+") and `payIncludeUndisclosed: boolean` alongside the existing `payMin`. `applyFilters` switches from a `pay_max`-only threshold to band-overlaps-window semantics. A new `PayRangeSlider` composite (native dual `<input type=range>` + numeric fields + checkbox) lives in the Pay dropdown, which becomes a `variant="dialog"` `FilterMenu`. State persists through the existing jsonb/cookie path; `parseBoardFilters` absorbs the shape change (no migration) and keeps old `payMin`-only records working.

**Tech Stack:** Next.js 16 / React 19.2 / TypeScript 6, vitest 4 (+ jsdom via `// @vitest-environment jsdom` docblock, `@testing-library/react`), CSS design-token system in `dashboard/app/globals.css` + `components/rolefit/board.css`.

## Global Constraints

- **UI contract (`dashboard/lib/uiContract.ts`, enforced by `npm run test:ui-contract`):**
  - `raw-control`: raw `<button>/<input>/<select>/<textarea>` outside `components/ui/` are forbidden unless the node **or an ancestor** carries `data-ui-contract-composite="<reason>"`. The `PayRangeSlider` root div carries this marker so its native inputs are allowed.
  - `inline-geometry`: numeric geometry (width/height/padding/margin/gap/borderRadius/…) in a `style={{}}` prop is forbidden in new components. Put geometry in `board.css`. For the data-driven track fill, pass **CSS custom properties** via `style` (property names outside the geometry set are not flagged).
  - `raw-theme-value`: no hex/`rgb()`/named colors in TSX or CSS — use `var(--token)` only.
  - `unicode-control-icon`: no glyphs like `× ✓ ▾`. Use `<Icon>`. The en-dash `–` in labels is allowed (not in the control-icon set).
- **jsdom tests** opt in with a top-of-file `// @vitest-environment jsdom` docblock (vitest 4 removed `environmentMatchGlobs`).
- **jsonb boundary:** `parseBoardFilters` stays a **total parser** (never an `as` cast) — it validates both the storage read and the POST body.
- **No DB migration; frontend-only.** `board_filters` is jsonb; the parser handles old and new shapes.
- **Git:** never amend/rebase/force-push. Reconcile forward with a new commit (`CLAUDE.md`).
- **Shared bounds constants** `PAY_FLOOR=0 / PAY_CEIL=400 / PAY_STEP=10` (in `lib/rolefit/filter.ts`) are the single source used by both the slider and the parser.
- Run vitest from `dashboard/`: `npm test` (full suite) and `npm run test:ui-contract`.

---

## File Structure

- `dashboard/lib/rolefit/filter.ts` — **Modify.** `BoardFilterState`/`DEFAULT_FILTERS` gain `payMax`, `payIncludeUndisclosed`; add `PAY_FLOOR/PAY_CEIL/PAY_STEP`, `payRangeActive`, `fmtPayRange`, and the new overlap pay predicate; rewrite the pay block in `applyFilters`.
- `dashboard/lib/rolefit/filter.test.ts` — **Modify.** Update the shared `ST` literal; add pay-range + `fmtPayRange` tests.
- `dashboard/lib/rolefit/boardFilters.ts` — **Modify.** Parse/clamp/normalize the two new fields; keep total + backward-compatible.
- `dashboard/lib/rolefit/boardFilters.test.ts` — **Modify.** Fix the exact-object expectation; add clamp/legacy/inversion/boolean tests.
- `dashboard/components/rolefit/PayRangeSlider.tsx` — **Create.** The dual-thumb composite (slider + numeric fields + include checkbox).
- `dashboard/components/rolefit/PayRangeSlider.test.tsx` — **Create.** jsdom unit tests for the component.
- `dashboard/components/rolefit/board.css` — **Modify.** `.rf-pay*` styles.
- `dashboard/components/rolefit/FilterBar.tsx` — **Modify.** `FilterMenu` gains `variant`; the Pay block renders `PayRangeSlider`; props/badge/active-state updated; `PAY_DEFS` removed.
- `dashboard/components/rolefit/RolefitBoard.tsx` — **Modify.** New pay state + deferred values + memo + `clearFilters` + handlers + `FilterBar` props.
- `dashboard/components/rolefit/RolefitBoard.test.tsx` — **Modify.** One integration assertion (range filters the list + pill badge).

---

## Task 1: Core filter state, overlap logic, and range formatter

Adds the two new state fields, the shared bounds constants, the overlap predicate, and the badge formatter. The **old radio UI keeps working** (it only sets `payMin`; `payMax` stays `null`, which is behaviourally identical to today). Every construction site of `BoardFilterState` is updated so the tree compiles.

**Files:**
- Modify: `dashboard/lib/rolefit/filter.ts`
- Modify: `dashboard/lib/rolefit/boardFilters.ts`
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx`
- Test: `dashboard/lib/rolefit/filter.test.ts`, `dashboard/lib/rolefit/boardFilters.test.ts`

**Interfaces:**
- Produces (consumed by later tasks):
  - `BoardFilterState` gains `payMin: number; payMax: number | null; payIncludeUndisclosed: boolean`.
  - `export const PAY_FLOOR = 0`, `PAY_CEIL = 400`, `PAY_STEP = 10` (all `$k`).
  - `export function payRangeActive(st: BoardFilterState): boolean`.
  - `export function fmtPayRange(payMin: number, payMax: number | null): string | null`.

- [ ] **Step 1: Write the failing tests (filter.ts)**

In `dashboard/lib/rolefit/filter.test.ts`, update the shared state literal (line 17) to include the new fields:

```ts
const ST: BoardFilterState = { search: "", cats: [], locs: [], sources: [], remote: "all", minFit: 0, payMin: 0, payMax: null, payIncludeUndisclosed: false, sort: "match" };
```

Delete the old `test("payMin excludes undisclosed and hourly", ...)` block (lines 39–46) and add, at the end of the `describe("applyFilters", ...)` block's sibling scope (after the `applyFilters` describe closes, near the top of the file's describes), these two new `describe` blocks. Also add `fmtPayRange` to the import on line 2.

```ts
// line 2 becomes:
import { applyFilters, facetCounts, filterByApplied, filterByView, fmtPayRange, mergeRejectedPool, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
```

```ts
describe("pay range filter", () => {
  const band = (id: string, min: number | null, max: number | null, period = "year") =>
    job({ id, pay_min: min, pay_max: max, pay_period: period });

  test("inactive (0 / null) keeps everything, including undisclosed", () => {
    const jobs = [
      band("a", 100000, 140000),
      band("b", null, null, "year"),
      job({ id: "c", pay_min: null, pay_max: null, pay_period: null }),
    ];
    expect(applyFilters(jobs, ST).map((j) => j.id)).toEqual(["a", "b", "c"]);
  });

  test("band overlaps window: keeps inside, straddling top, and straddling bottom", () => {
    const jobs = [
      band("inside", 90000, 110000),
      band("straddle-top", 100000, 140000),
      band("straddle-bottom", 60000, 85000),
      band("above", 130000, 160000),
      band("below", 50000, 70000),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["inside", "straddle-top", "straddle-bottom"]);
  });

  test("lower-bound-only ($100k+) matches today's max>=threshold rule", () => {
    const jobs = [band("meets", 120000, 160000), band("under", 60000, 90000)];
    const out = applyFilters(jobs, { ...ST, payMin: 100, payMax: null });
    expect(out.map((j) => j.id)).toEqual(["meets"]);
  });

  test("open-topped 'From $X' job now matches a lower bound", () => {
    const jobs = [band("from150", 150000, null)];
    const out = applyFilters(jobs, { ...ST, payMin: 100, payMax: null });
    expect(out.map((j) => j.id)).toEqual(["from150"]);
  });

  test("upper-bound-only (Up to $120k) drops bands whose floor exceeds the ceiling", () => {
    const jobs = [band("uptoOk", null, 100000), band("floorTooHigh", 130000, 160000)];
    const out = applyFilters(jobs, { ...ST, payMin: 0, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["uptoOk"]);
  });

  test("undisclosed and hourly hidden by default when active", () => {
    const jobs = [
      band("annual", 100000, 140000),
      job({ id: "none", pay_min: null, pay_max: null, pay_period: null }),
      band("hourly", 50, 90, "hour"),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["annual"]);
  });

  test("includeUndisclosed shows no-band jobs but still drops disclosed out-of-range", () => {
    const jobs = [
      band("annualOut", 40000, 60000),
      job({ id: "none", pay_min: null, pay_max: null, pay_period: null }),
      band("hourly", 50, 90, "hour"),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120, payIncludeUndisclosed: true });
    expect(out.map((j) => j.id)).toEqual(["none", "hourly"]);
  });
});

describe("fmtPayRange", () => {
  test("inactive → null", () => expect(fmtPayRange(0, null)).toBeNull());
  test("lower bound only → $Xk+", () => expect(fmtPayRange(100, null)).toBe("$100k+"));
  test("upper bound only → Up to $Yk", () => expect(fmtPayRange(0, 120)).toBe("Up to $120k"));
  test("both bounds → en-dash range", () => expect(fmtPayRange(80, 120)).toBe("$80–120k"));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- filter.test.ts`
Expected: FAIL — `fmtPayRange` is not exported; the pay-range tests fail because `applyFilters` still uses the old `payMin`-only rule and `BoardFilterState` lacks `payMax`/`payIncludeUndisclosed` (type errors).

- [ ] **Step 3: Update `filter.ts` — type, defaults, constants, predicate, formatter**

In `dashboard/lib/rolefit/filter.ts`, replace the `BoardFilterState` interface and `DEFAULT_FILTERS` (lines 3–23) with:

```ts
export interface BoardFilterState {
  search: string;
  cats: string[];
  locs: string[];
  sources: string[];
  remote: "all" | "remote" | "hybrid" | "onsite";
  minFit: number;
  payMin: number;              // $k, 0 = no floor
  payMax: number | null;       // $k, null = "+" (no upper limit)
  payIncludeUndisclosed: boolean;
  sort: "match" | "pay" | "newest" | "az";
}

export const DEFAULT_FILTERS: BoardFilterState = {
  search: "",
  cats: [],
  locs: [],
  sources: [],
  remote: "all",
  minFit: 0,
  payMin: 0,
  payMax: null,
  payIncludeUndisclosed: false,
  sort: "match",
};

// $k bounds for the Pay range slider — shared with the filter-state parser so the slider's
// reachable values and the parser's clamp window can never drift.
export const PAY_FLOOR = 0;
export const PAY_CEIL = 400;
export const PAY_STEP = 10;

// The pay filter does something only once a bound is narrowed from the full unbounded span.
export function payRangeActive(st: BoardFilterState): boolean {
  return st.payMin > 0 || st.payMax !== null;
}

// The Pay pill's badge label for the current range; null when the filter is inactive.
export function fmtPayRange(payMin: number, payMax: number | null): string | null {
  if (payMin <= 0 && payMax == null) return null;
  if (payMax == null) return `$${payMin}k+`;
  if (payMin <= 0) return `Up to $${payMax}k`;
  return `$${payMin}–${payMax}k`;
}
```

Then, immediately above `applyFilters`, add the per-job predicate:

```ts
// Keep a job under the pay range filter. Window = [payMin, payMax] in $k (payMax null =
// unbounded top). A job contributes an annual band [pay_min ?? 0, pay_max ?? ∞] only when it
// discloses annual pay; jobs without one (hourly, or no pay listed) pass only when the user
// opted to include undisclosed pay. Band-overlaps-window: the two intervals intersect.
function passesPayRange(j: JobRow, st: BoardFilterState): boolean {
  if (!payRangeActive(st)) return true;
  const hasBand = j.pay_period === "year" && (j.pay_min != null || j.pay_max != null);
  if (!hasBand) return st.payIncludeUndisclosed;
  const winLo = st.payMin * 1000;
  const winHi = st.payMax == null ? Infinity : st.payMax * 1000;
  const jobLo = j.pay_min ?? 0;
  const jobHi = j.pay_max ?? Infinity;
  return jobLo <= winHi && winLo <= jobHi;
}
```

Finally, in `applyFilters`, replace the old pay block (currently lines 55–57):

```ts
    if (st.payMin) {
      if (j.pay_period !== "year" || j.pay_max == null || j.pay_max < st.payMin * 1000) return false;
    }
```

with:

```ts
    if (!passesPayRange(j, st)) return false;
```

- [ ] **Step 4: Update `boardFilters.ts` — parse the new fields (required for compile)**

Adding required fields to `BoardFilterState` forces the parser's return object to include them. In `dashboard/lib/rolefit/boardFilters.ts`, change the import on lines 1–2 and add two helpers after `nonNegNum` (line 22):

```ts
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { DEFAULT_FILTERS, PAY_CEIL, PAY_FLOOR } from "@/lib/rolefit/filter";
```

```ts
// Pay floor in $k: any finite non-negative number, clamped to the slider ceiling.
function payFloor(v: unknown): number {
  return Math.min(nonNegNum(v), PAY_CEIL);
}

// Pay ceiling in $k: a finite number in [PAY_FLOOR, PAY_CEIL], or null for "no upper limit"
// (absent, non-numeric, or an incoherent value below the resolved floor).
function payCeiling(v: unknown, floor: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < PAY_FLOOR) return null;
  const clamped = Math.min(Math.max(v, PAY_FLOOR), PAY_CEIL);
  return clamped < floor ? null : clamped;
}
```

Then replace the `parseBoardFilters` return (lines 34–46) so it computes `payMin` first and emits the three pay fields:

```ts
  const o = obj as Record<string, unknown>;
  const payMin = payFloor(o.payMin);
  return {
    search: typeof o.search === "string" ? o.search.slice(0, MAX_SEARCH) : DEFAULT_FILTERS.search,
    cats: strList(o.cats),
    locs: strList(o.locs),
    sources: strList(o.sources),
    remote: REMOTE.has(o.remote as BoardFilterState["remote"])
      ? (o.remote as BoardFilterState["remote"]) : DEFAULT_FILTERS.remote,
    minFit: nonNegNum(o.minFit),
    payMin,
    payMax: payCeiling(o.payMax, payMin),
    payIncludeUndisclosed: o.payIncludeUndisclosed === true,
    sort: SORT.has(o.sort as BoardFilterState["sort"])
      ? (o.sort as BoardFilterState["sort"]) : DEFAULT_FILTERS.sort,
  };
```

(`defaults()` on line 25 spreads `DEFAULT_FILTERS`, so it already carries the new fields.)

- [ ] **Step 5: Update `boardFilters.test.ts`**

In `dashboard/lib/rolefit/boardFilters.test.ts`, update the exact-object expectation in `test("parses a valid JSON string", ...)` (lines 17–20) to include the new fields:

```ts
    expect(f).toEqual({
      search: "eng", cats: ["Backend"], locs: ["Berlin"], sources: [],
      remote: "remote", minFit: 75, payMin: 150, payMax: null, payIncludeUndisclosed: false, sort: "pay",
    });
```

Add these tests inside the `describe("parseBoardFilters", ...)` block:

```ts
  test("legacy payMin-only record → unbounded top, undisclosed hidden", () => {
    expect(parseBoardFilters({ payMin: 150 })).toMatchObject({
      payMin: 150, payMax: null, payIncludeUndisclosed: false,
    });
  });

  test("payMax round-trips and clamps to the ceiling", () => {
    expect(parseBoardFilters({ payMin: 80, payMax: 120 })).toMatchObject({ payMin: 80, payMax: 120 });
    expect(parseBoardFilters({ payMax: 999 }).payMax).toBe(400);
  });

  test("payMin clamps to the ceiling", () => {
    expect(parseBoardFilters({ payMin: 999 }).payMin).toBe(400);
  });

  test("a ceiling below the floor is dropped to unbounded", () => {
    expect(parseBoardFilters({ payMin: 150, payMax: 100 })).toMatchObject({ payMin: 150, payMax: null });
  });

  test("non-numeric or non-finite payMax → null", () => {
    expect(parseBoardFilters({ payMax: "120" }).payMax).toBeNull();
    expect(parseBoardFilters({ payMax: Infinity }).payMax).toBeNull();
  });

  test("payIncludeUndisclosed coerces to a strict boolean", () => {
    expect(parseBoardFilters({ payIncludeUndisclosed: true }).payIncludeUndisclosed).toBe(true);
    expect(parseBoardFilters({ payIncludeUndisclosed: "yes" }).payIncludeUndisclosed).toBe(false);
    expect(parseBoardFilters({}).payIncludeUndisclosed).toBe(false);
  });
```

- [ ] **Step 6: Update `RolefitBoard.tsx` — plumb new state (old UI still drives it)**

In `dashboard/components/rolefit/RolefitBoard.tsx`:

After the `payMin` state (line 164), add:

```ts
  const [payMax, setPayMax] = useState<BoardFilterState["payMax"]>(initialFilters.payMax);
  const [payIncludeUndisclosed, setPayIncludeUndisclosed] = useState(initialFilters.payIncludeUndisclosed);
  const deferredPayMin = useDeferredValue(payMin);
  const deferredPayMax = useDeferredValue(payMax);
```

Replace the `filterState` memo (lines 445–448) with:

```ts
  const filterState: BoardFilterState = useMemo(
    () => ({ search: deferredSearch, cats, locs, sources, remote, minFit, payMin: deferredPayMin, payMax: deferredPayMax, payIncludeUndisclosed, sort }),
    [deferredSearch, cats, locs, sources, remote, minFit, deferredPayMin, deferredPayMax, payIncludeUndisclosed, sort],
  );
```

In `clearFilters` (lines 701–709), replace `setPayMin(0);` with:

```ts
    setPayMin(0);
    setPayMax(null);
    setPayIncludeUndisclosed(false);
```

(Leave `handleSetPayMin` and the `<FilterBar>` props untouched in this task — the old radio still works; `payMax`/`payIncludeUndisclosed` stay at defaults, so `applyFilters` behaves exactly as before.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- filter.test.ts boardFilters.test.ts`
Expected: PASS (all pay-range, `fmtPayRange`, and parser tests green).

- [ ] **Step 8: Typecheck the touched wiring compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors (the `RolefitBoard` memo, `FilterBar` props, and every `DEFAULT_FILTERS` spread still typecheck).

- [ ] **Step 9: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/filter.test.ts dashboard/lib/rolefit/boardFilters.ts dashboard/lib/rolefit/boardFilters.test.ts dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): pay range filter state + band-overlap logic"
```

---

## Task 2: `PayRangeSlider` component + styles

A self-contained composite: two overlaid native range inputs, two numeric fields, and the include-undisclosed checkbox. Committed to the parent via `onChange`; the parent re-renders (the board defers the heavy re-filter — Task 3), so continuous `onChange` is smooth without a manual commit-on-release dance.

**Files:**
- Create: `dashboard/components/rolefit/PayRangeSlider.tsx`
- Modify: `dashboard/components/rolefit/board.css`
- Test: `dashboard/components/rolefit/PayRangeSlider.test.tsx`

**Interfaces:**
- Consumes: `PAY_CEIL`, `PAY_FLOOR`, `PAY_STEP`, `fmtPayRange` from `@/lib/rolefit/filter` (Task 1).
- Produces:
  ```ts
  export interface PayRangeSliderProps {
    min: number;                 // $k, 0 = no floor
    max: number | null;          // $k, null = "+"
    includeUndisclosed: boolean;
    onChange: (min: number, max: number | null) => void;
    onToggleUndisclosed: (next: boolean) => void;
  }
  export function PayRangeSlider(props: PayRangeSliderProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `dashboard/components/rolefit/PayRangeSlider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PayRangeSlider } from "./PayRangeSlider";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof PayRangeSlider>> = {}) {
  const onChange = vi.fn();
  const onToggleUndisclosed = vi.fn();
  render(
    <PayRangeSlider
      min={0}
      max={null}
      includeUndisclosed={false}
      onChange={onChange}
      onToggleUndisclosed={onToggleUndisclosed}
      {...overrides}
    />,
  );
  return { onChange, onToggleUndisclosed };
}

describe("PayRangeSlider", () => {
  test("renders both range handles and the include toggle", () => {
    setup();
    expect(screen.getByLabelText("Minimum pay")).toBeTruthy();
    expect(screen.getByLabelText("Maximum pay")).toBeTruthy();
    expect(screen.getByLabelText("Include jobs without listed pay")).toBeTruthy();
  });

  test("dragging the min handle emits the new floor, top stays unbounded", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Minimum pay"), { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("dragging the max handle below the ceiling emits a numeric ceiling", () => {
    const { onChange } = setup({ min: 80 });
    fireEvent.change(screen.getByLabelText("Maximum pay"), { target: { value: "120" } });
    expect(onChange).toHaveBeenLastCalledWith(80, 120);
  });

  test("max handle at the ceiling emits null (the '+' state)", () => {
    const { onChange } = setup({ min: 80, max: 200 });
    fireEvent.change(screen.getByLabelText("Maximum pay"), { target: { value: "400" } });
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("min handle cannot cross above the max handle", () => {
    const { onChange } = setup({ min: 80, max: 120 });
    fireEvent.change(screen.getByLabelText("Minimum pay"), { target: { value: "300" } });
    expect(onChange).toHaveBeenLastCalledWith(120, 120);
  });

  test("typing into the max field and blurring commits it", () => {
    const { onChange } = setup({ min: 80 });
    const field = screen.getByLabelText("Maximum pay, in thousands");
    fireEvent.change(field, { target: { value: "150k" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith(80, 150);
  });

  test("clearing the max field means unbounded (+)", () => {
    const { onChange } = setup({ min: 80, max: 150 });
    const field = screen.getByLabelText("Maximum pay, in thousands");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("toggling the checkbox reports the new state", () => {
    const { onToggleUndisclosed } = setup();
    fireEvent.click(screen.getByLabelText("Include jobs without listed pay"));
    expect(onToggleUndisclosed).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npm test -- PayRangeSlider.test.tsx`
Expected: FAIL — `Cannot find module './PayRangeSlider'`.

- [ ] **Step 3: Create `PayRangeSlider.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { PAY_CEIL, PAY_FLOOR, PAY_STEP, fmtPayRange } from "@/lib/rolefit/filter";

// Snap an arbitrary $k value onto the slider grid and clamp it to the reachable range.
function snap(n: number): number {
  return Math.min(PAY_CEIL, Math.max(PAY_FLOOR, Math.round(n / PAY_STEP) * PAY_STEP));
}

// Parse a typed pay value into $k. Accepts "120", "120k", "$120k", "120000".
// Empty / "+" / "any" → null (meaningful for the max field: unbounded).
function parsePayInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (s === "" || s === "+" || s === "any") return null;
  const hasK = s.endsWith("k");
  const value = parseFloat(hasK ? s.slice(0, -1) : s);
  if (!Number.isFinite(value)) return null;
  const k = hasK ? value : value >= 1000 ? value / 1000 : value;
  return snap(k);
}

// Percentage position of a $k value along the track.
function pct(k: number): number {
  return ((k - PAY_FLOOR) / (PAY_CEIL - PAY_FLOOR)) * 100;
}

export interface PayRangeSliderProps {
  min: number;
  max: number | null;
  includeUndisclosed: boolean;
  onChange: (min: number, max: number | null) => void;
  onToggleUndisclosed: (next: boolean) => void;
}

export function PayRangeSlider({ min, max, includeUndisclosed, onChange, onToggleUndisclosed }: PayRangeSliderProps) {
  // Draft thumb positions in $k. draftMax === PAY_CEIL represents the unbounded "+" state.
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max ?? PAY_CEIL);
  // Editable text mirrors of the two fields, resynced when committed props change.
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");

  useEffect(() => { setDraftMin(min); }, [min]);
  useEffect(() => { setDraftMax(max ?? PAY_CEIL); }, [max]);
  useEffect(() => { setMinText(min > 0 ? `$${min}k` : ""); }, [min]);
  useEffect(() => { setMaxText(max == null ? "" : `$${max}k`); }, [max]);

  const emit = (lo: number, hiPos: number) => onChange(lo, hiPos >= PAY_CEIL ? null : hiPos);

  const onMinRange = (v: number) => { const lo = Math.min(v, draftMax); setDraftMin(lo); emit(lo, draftMax); };
  const onMaxRange = (v: number) => { const hi = Math.max(v, draftMin); setDraftMax(hi); emit(draftMin, hi); };

  const commitMinText = () => {
    const parsed = parsePayInput(minText);
    const lo = Math.min(parsed ?? PAY_FLOOR, draftMax);
    setDraftMin(lo); emit(lo, draftMax);
  };
  const commitMaxText = () => {
    const parsed = parsePayInput(maxText);
    const hi = parsed == null ? PAY_CEIL : Math.max(parsed, draftMin);
    setDraftMax(hi); emit(draftMin, hi);
  };
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
  };

  const topOpen = draftMax >= PAY_CEIL;
  const summary = fmtPayRange(draftMin, topOpen ? null : draftMax) ?? "Any pay";
  const fillStyle = {
    "--rf-pay-fill-start": `${pct(draftMin)}%`,
    "--rf-pay-fill-end": `${pct(draftMax)}%`,
  } as CSSProperties;

  return (
    <div
      className="rf-pay"
      data-ui-contract-composite="Pay range slider: native range + number inputs keep keyboard/AT support; geometry lives in board.css"
    >
      <div className="rf-pay__summary" aria-live="polite">{summary}</div>

      <div className="rf-pay__slider">
        <div className="rf-pay__track" />
        <div className="rf-pay__fill" data-ui-contract-geometry="track fill is data-driven from the selected range" style={fillStyle} />
        <input
          type="range"
          className="rf-pay__range rf-focusable"
          aria-label="Minimum pay"
          aria-valuetext={draftMin > 0 ? `$${draftMin}k` : "No minimum"}
          min={PAY_FLOOR}
          max={PAY_CEIL}
          step={PAY_STEP}
          value={draftMin}
          onChange={(e) => onMinRange(Number(e.currentTarget.value))}
        />
        <input
          type="range"
          className="rf-pay__range rf-focusable"
          aria-label="Maximum pay"
          aria-valuetext={topOpen ? "No maximum" : `$${draftMax}k`}
          min={PAY_FLOOR}
          max={PAY_CEIL}
          step={PAY_STEP}
          value={draftMax}
          onChange={(e) => onMaxRange(Number(e.currentTarget.value))}
        />
      </div>

      <div className="rf-pay__fields">
        <input
          type="text"
          inputMode="numeric"
          className="rf-pay__field rf-focusable"
          aria-label="Minimum pay, in thousands"
          placeholder="$0"
          value={minText}
          onChange={(e) => setMinText(e.currentTarget.value)}
          onBlur={commitMinText}
          onKeyDown={(e) => onFieldKeyDown(e, commitMinText)}
        />
        <span className="rf-pay__dash" aria-hidden="true">–</span>
        <input
          type="text"
          inputMode="numeric"
          className="rf-pay__field rf-focusable"
          aria-label="Maximum pay, in thousands"
          placeholder="+"
          value={maxText}
          onChange={(e) => setMaxText(e.currentTarget.value)}
          onBlur={commitMaxText}
          onKeyDown={(e) => onFieldKeyDown(e, commitMaxText)}
        />
      </div>

      <label className="rf-pay__toggle">
        <input
          type="checkbox"
          className="rf-pay__checkbox rf-focusable"
          checked={includeUndisclosed}
          onChange={(e) => onToggleUndisclosed(e.currentTarget.checked)}
        />
        <span>Include jobs without listed pay</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Add styles to `board.css`**

Append to `dashboard/components/rolefit/board.css` (tokens only; class-name selectors avoid the `undersized-target` audit's interactive-selector regex):

```css
/* Pay range slider (Pay filter dropdown body). Two native range inputs overlay a shared
   track; only their thumbs take pointer events so both handles stay draggable. Track-click
   thumb-jumping is intentionally unsupported — the numeric fields and arrow keys cover
   precise entry. */
.rf-pay { display: flex; flex-direction: column; gap: var(--space-3); }
.rf-pay__summary { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.rf-pay__slider { position: relative; height: 28px; }
.rf-pay__track {
  position: absolute; left: 0; right: 0; top: 50%; height: 4px;
  transform: translateY(-50%); background: var(--border-strong); border-radius: 999px;
}
.rf-pay__fill {
  position: absolute; top: 50%; height: 4px; transform: translateY(-50%);
  left: var(--rf-pay-fill-start, 0%); right: calc(100% - var(--rf-pay-fill-end, 100%));
  background: var(--accent); border-radius: 999px;
}
.rf-pay__range {
  position: absolute; left: 0; right: 0; top: 0; width: 100%; height: 100%;
  margin: 0; background: transparent; pointer-events: none;
  -webkit-appearance: none; appearance: none;
}
.rf-pay__range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; pointer-events: auto;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg-surface); border: 2px solid var(--accent); cursor: pointer;
}
.rf-pay__range::-moz-range-thumb {
  pointer-events: auto; width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg-surface); border: 2px solid var(--accent); cursor: pointer;
}
.rf-pay__fields { display: flex; align-items: center; gap: var(--space-2); }
.rf-pay__field {
  flex: 1 1 0; min-width: 0; height: 34px; padding: 0 var(--space-2);
  font-size: 13px; color: var(--text-primary);
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
}
.rf-pay__dash { color: var(--text-secondary); }
.rf-pay__toggle {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: 13px; color: var(--text-primary); cursor: pointer;
}
.rf-pay__checkbox { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd dashboard && npm test -- PayRangeSlider.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/rolefit/PayRangeSlider.tsx dashboard/components/rolefit/PayRangeSlider.test.tsx dashboard/components/rolefit/board.css
git commit -m "feat(board): PayRangeSlider dual-thumb control + styles"
```

---

## Task 3: Wire the slider into the board (FilterMenu dialog + FilterBar + RolefitBoard)

Swaps the Pay radio for the slider. Because `FilterBarProps` and `RolefitBoard`'s `<FilterBar>` call must change together to compile, they ship in one task. Ends green.

**Files:**
- Modify: `dashboard/components/rolefit/FilterBar.tsx`
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx`
- Test: `dashboard/components/rolefit/RolefitBoard.test.tsx`

**Interfaces:**
- Consumes: `PayRangeSlider` (Task 2); `fmtPayRange` (Task 1).
- Produces: `FilterMenu` supports `variant?: "listbox" | "dialog"`; `FilterBarProps` replaces `payMin` + `onSetPayMin` with `payMin`, `payMax`, `payIncludeUndisclosed`, `onSetPayRange`, `onTogglePayUndisclosed`.

- [ ] **Step 1: Write the failing integration test**

In `dashboard/components/rolefit/RolefitBoard.test.tsx`, add (a second job that pays too little, and an assertion that a persisted range filters the list and the pill shows the badge):

```tsx
describe("pay range filter wiring", () => {
  const lowPay: JobRow = { ...job, id: "job-2", title: "Junior Engineer", pay_min: 60000, pay_max: 80000 };

  test("a persisted range hides out-of-range jobs and labels the Pay pill", () => {
    stubMatchMedia();
    mockFetch({ status: 200, body: {} }); // benign: no generation is driven here
    render(
      <RolefitBoard
        {...baseProps}
        jobs={[job, lowPay]}
        initialFilters={{ ...DEFAULT_FILTERS, payMin: 100, payMax: null }}
      />,
    );
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.queryByText("Junior Engineer")).toBeNull();
    // Pay trigger reflects the active lower bound.
    expect(screen.getByRole("button", { name: /Pay.*\$100k\+/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npm test -- RolefitBoard.test.tsx`
Expected: FAIL — the Pay pill still reads "Pay" with no `$100k+` badge (old radio), and `queryByText("Junior Engineer")` may be present depending on the old rule.

- [ ] **Step 3: Add the `dialog` variant to `FilterMenu`**

In `dashboard/components/rolefit/FilterBar.tsx`, replace the entire `FilterMenu` function (lines 63–179) with this version (adds `variant`, a `rootRef`, dialog focus/keydown/blur handling; listbox behaviour is unchanged when `variant` is omitted):

```tsx
function FilterMenu({
  name,
  open,
  onToggle,
  trigger,
  triggerStyle,
  ariaLabel,
  multiselect = false,
  variant = "listbox",
  listboxStyle,
  align = "start",
  mobileAlign = align,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: (name: string) => void;
  trigger: ReactNode;
  triggerStyle: CSSProperties;
  ariaLabel: string;
  multiselect?: boolean;
  variant?: "listbox" | "dialog";
  listboxStyle: CSSProperties;
  align?: "start" | "end";
  mobileAlign?: "start" | "end";
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDialog = variant === "dialog";

  // On open, move focus to the selected option (listbox) or the first focusable (dialog).
  useEffect(() => {
    if (!open) return;
    if (isDialog) {
      listRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus();
      return;
    }
    const opts = optionEls(listRef.current);
    const sel = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
    opts[sel >= 0 ? sel : 0]?.focus();
  }, [open, isDialog]);

  // Radio-style listbox close returns focus to the trigger when the focused option unmounts.
  const prevOpen = useRef(open);
  useEffect(() => {
    const wasOpen = prevOpen.current;
    prevOpen.current = open;
    if (wasOpen && !open && document.activeElement === document.body) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const opts = optionEls(listRef.current);
    if (opts.length === 0) return;
    const cur = opts.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); opts[(cur + 1 + opts.length) % opts.length]?.focus(); break;
      case "ArrowUp": e.preventDefault(); opts[(cur - 1 + opts.length) % opts.length]?.focus(); break;
      case "Home": e.preventDefault(); opts[0]?.focus(); break;
      case "End": e.preventDefault(); opts[opts.length - 1]?.focus(); break;
      case "Escape": e.preventDefault(); onToggle(name); triggerRef.current?.focus(); break;
      case "Tab": onToggle(name); break;
    }
  };

  // Dialog popover: Escape closes + refocuses the trigger; Tab moves natively among the
  // inner controls. Closing on Tab-out is handled by onDialogBlur below.
  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onToggle(name); triggerRef.current?.focus(); }
  };
  // Close when focus lands on a focusable element outside this menu (e.g. Tab past the last
  // control, or clicking another trigger). A null relatedTarget (clicking the track or other
  // non-focusable chrome) is left to the board's document-level outside-click handler, so
  // clicking inside the popover never closes it.
  const onDialogBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !rootRef.current?.contains(next)) onToggle(name);
  };

  return (
    <div ref={rootRef} data-menuroot="" data-align={align} data-mobile-align={mobileAlign} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onToggle(name)}
        aria-haspopup={isDialog ? "dialog" : "listbox"}
        aria-expanded={open}
        className="rf-board-filter-trigger rf-focusable"
        onKeyDown={(e) => {
          if (!isDialog && !open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            onToggle(name);
          }
        }}
        style={triggerStyle}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          role={isDialog ? "dialog" : "listbox"}
          aria-label={ariaLabel}
          aria-multiselectable={!isDialog && multiselect ? true : undefined}
          onKeyDown={isDialog ? onDialogKeyDown : onListKeyDown}
          onBlur={isDialog ? onDialogBlur : undefined}
          style={listboxStyle}
        >
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the Pay block + props + badge in `FilterBar`**

In `dashboard/components/rolefit/FilterBar.tsx`:

Add imports near the top (after line 8):

```tsx
import { fmtPayRange } from "@/lib/rolefit/filter";
import { PayRangeSlider } from "@/components/rolefit/PayRangeSlider";
```

Delete the `PAY_DEFS` constant (lines 11–17).

In `FilterBarProps` (interface starting line 181), replace `payMin: number;` (line 192) with:

```tsx
  payMin: number;
  payMax: number | null;
  payIncludeUndisclosed: boolean;
```

and replace `onSetPayMin: (v: number) => void;` (line 206) with:

```tsx
  onSetPayRange: (min: number, max: number | null) => void;
  onTogglePayUndisclosed: (next: boolean) => void;
```

In the `FilterBar` function destructuring, replace `payMin,` and `onSetPayMin,` with the corresponding fields:

```tsx
  payMin,
  payMax,
  payIncludeUndisclosed,
```
```tsx
  onSetPayRange,
  onTogglePayUndisclosed,
```

Replace the active-state line `const pb = activeBtn(payMin > 0);` (line 244) with:

```tsx
  const pb = activeBtn(payMin > 0 || payMax !== null);
```

Replace the badge line `const payBadge = payMin > 0 ? ...` (line 250) with:

```tsx
  const payLabel = fmtPayRange(payMin, payMax);
  const payBadge = payLabel ? ` · ${payLabel}` : "";
```

Replace the entire Pay `FilterMenu` block (the `{/* Pay */}` block, lines 368–411) with:

```tsx
      {/* Pay */}
      <FilterMenu
        name="pay"
        variant="dialog"
        open={openMenu === "pay"}
        onToggle={onToggleMenu}
        ariaLabel="Filter by pay range"
        trigger={<>Pay{payBadge}{caret}</>}
        triggerStyle={triggerStyle(pb.bg, pb.border)}
        align="start"
        mobileAlign="end"
        listboxStyle={{ ...dropdownBase, width: "268px" }}
      >
        <PayRangeSlider
          min={payMin}
          max={payMax}
          includeUndisclosed={payIncludeUndisclosed}
          onChange={onSetPayRange}
          onToggleUndisclosed={onTogglePayUndisclosed}
        />
      </FilterMenu>
```

- [ ] **Step 5: Update `RolefitBoard` handlers + `<FilterBar>` props**

In `dashboard/components/rolefit/RolefitBoard.tsx`:

Replace `handleSetPayMin` (lines 712–715) with:

```tsx
  // The pay dialog stays open while the user adjusts it (unlike the radio menus).
  const handleSetPayRange = (nextMin: number, nextMax: number | null) => {
    setPayMin(nextMin);
    setPayMax(nextMax);
  };
  const handleTogglePayUndisclosed = (next: boolean) => {
    setPayIncludeUndisclosed(next);
  };
```

In the `<FilterBar>` element, replace the `payMin={payMin}` / `onSetPayMin={handleSetPayMin}` props (lines 1293 and 1307) so the block reads:

```tsx
        payMin={payMin}
        payMax={payMax}
        payIncludeUndisclosed={payIncludeUndisclosed}
```
```tsx
        onSetPayRange={handleSetPayRange}
        onTogglePayUndisclosed={handleTogglePayUndisclosed}
```

- [ ] **Step 6: Run the integration test to verify it passes**

Run: `cd dashboard && npm test -- RolefitBoard.test.tsx`
Expected: PASS (new `pay range filter wiring` test green; existing board tests unaffected).

- [ ] **Step 7: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors (`onSetPayMin` fully removed; the new props line up on both sides).

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/rolefit/FilterBar.tsx dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/RolefitBoard.test.tsx
git commit -m "feat(board): swap Pay radio for the range-slider dialog"
```

---

## Task 4: Full verification

Runs the whole suite, the UI-contract audit, the typechecker, and a live visual smoke.

**Files:** none (verification only).

- [ ] **Step 1: Full dashboard test suite**

Run: `cd dashboard && npm test`
Expected: PASS (no regressions in the ~full suite, including `queries.boardFilters`, `board-filters` route, and the RolefitBoard suites that spread `DEFAULT_FILTERS`).

- [ ] **Step 2: UI-contract audit**

Run: `cd dashboard && npm run test:ui-contract`
Expected: PASS. If a `raw-control` violation appears for `PayRangeSlider`, confirm the root `<div className="rf-pay" data-ui-contract-composite="...">` marker is present and wraps every native input. If `inline-geometry` appears for the fill div, confirm it uses CSS custom properties (`--rf-pay-fill-*`) plus the `data-ui-contract-geometry` marker — not raw `width`/`left`.

- [ ] **Step 3: Typecheck + lint**

Run: `cd dashboard && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Live visual smoke (dev-shim board, light + dark)**

Bring up the authed board locally (dev auth shim + `DEV_USER_ID` over the prod DB, per the team's local-authed-page technique; the worktree needs the `NEXT_PUBLIC_SUPABASE_*` values from the main checkout's `.env.local`). Drive the browser (claude-in-chrome) and verify, in both light and dark:
  - Opening the **Pay** pill shows the slider, two fields, and the checkbox.
  - Dragging each handle updates the summary/fields live and the board re-filters when it settles; dragging the max handle to the far right shows `+` and the pill reads `$Nk+`.
  - Typing `150` into the max field and blurring reformats to `$150k` and filters; clearing it returns to `+`.
  - Ticking **Include jobs without listed pay** brings undisclosed-pay jobs back while a range is active.
  - Keyboard: Tab to the Pay pill, Enter/Arrow to open, arrow the thumbs, Escape closes and returns focus to the pill.
  - **Clear filters** resets the Pay pill to unlabelled.

- [ ] **Step 5: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "test(board): verify pay range filter end-to-end"
```

---

## Self-Review

**Spec coverage:**
- §1 control (slider + editable fields + "+" + include toggle) → Task 2 (`PayRangeSlider`) + Task 3 (dropdown wiring).
- §2 state (`payMin`/`payMax`/`payIncludeUndisclosed`) → Task 1.
- §3 band-overlaps-window + undisclosed/hourly toggle + `$100k+` continuity + open-topped fix → Task 1 (`passesPayRange` + tests).
- §4 shared bounds constants → Task 1 (`PAY_FLOOR/PAY_CEIL/PAY_STEP`).
- §5 persistence + backward-compat (legacy `payMin`-only, clamp, inversion→null, boolean) → Task 1 (`parseBoardFilters` + tests).
- §6 components (`PayRangeSlider`, `FilterMenu variant="dialog"`, badge/active, deferred re-filter for perf) → Tasks 2 & 3.
- Testing + UI-contract + live smoke → all tasks + Task 4.
- **Refinement vs spec:** the spec described "commit on release"; this plan uses continuous `onChange` + `useDeferredValue` on the board's pay values (mirroring the existing deferred search) for the same "no jank while dragging" outcome — more idiomatic in React, where a range input's `onChange` fires continuously. Same user-visible behaviour. `fmtPayRange` lives in `filter.ts` (with the filter state it formats) rather than `fit.ts` — a small colocation refinement that keeps its tests in `filter.test.ts`.

**Placeholder scan:** none — every code step carries full content.

**Type consistency:** `onSetPayRange(min, max)` / `onTogglePayUndisclosed(next)` / `PayRangeSliderProps` / `payRangeActive` / `fmtPayRange` / `PAY_FLOOR|PAY_CEIL|PAY_STEP` names match across Tasks 1→3. `payMax` is `number | null` everywhere. `handleSetPayMin`/`onSetPayMin`/`PAY_DEFS` are fully removed (not left dangling).
