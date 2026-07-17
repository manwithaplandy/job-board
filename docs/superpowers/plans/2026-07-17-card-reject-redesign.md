# Card Reject Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the job-card hover reject × (44px icon overlaying card text) with a chip-scale labeled "Reject" pill that reveals into a reserved slot in the chips row, and make the card affordance authed-only.

**Architecture:** The reject control stays a DOM sibling of the card `<button>` (interactive elements can't nest) and stays hover/focus-revealed, but becomes a shared `Button` with visible text, absolutely positioned bottom-right into a gutter the chips row reserves via CSS when the card is rejectable — so nothing is ever occluded. All reveal CSS consolidates into `board.css` (the `globals.css` #14 block, half of which is dead, is deleted). `RolefitBoard` additionally gates the card affordance on `isAuthed`.

**Tech Stack:** Next.js 16 / React 19.2, vitest 4 + @testing-library/react (jsdom), house CSS tokens (no Tailwind). Spec: `docs/superpowers/specs/2026-07-17-card-reject-redesign-design.md`.

## Global Constraints

- **UI contract (`lib/uiContract.ts`, enforced by `npm run test:ui-contract`):** no raw `<button>` outside `components/ui/` (use the shared `Button`); no glyph characters (`×`, `✕`, `✗`, `✓`, arrows) anywhere in app/components source — visible text labels or `Icon` only; colors via `var(--…)` tokens only, never hex/rgb; **no inline geometry styles in `JobCard.tsx`** (it has no geometry exemption — all width/height/padding/margin/radius live in `board.css`); CSS rules whose selector looks interactive (`:hover`/`:focus`, or name tokens `button|btn|cta|action|link|trigger|control`) must not declare `width|min-width|height|min-height` of 0–43px.
- **Git (repo CLAUDE.md):** never amend/rebase/force-push — always commit forward. Run commands from the repo root; dashboard commands from `dashboard/`.
- **Before every commit:** scan the staged test files for raw control bytes (`LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' <files>` must print nothing) — generated tests have shipped NUL bytes before.
- **Do not touch** `components/rolefit/VisualBoardState.tsx`, `components/ui/VisualStateFixture.tsx`, or anything in `tests/visual/` — the visual-regression contract string-matches those fixtures, and they deliberately do not mount `onReject` (fixture cards have no reject pill/gutter; that matches the anon board and keeps Playwright snapshots unchanged).
- **No behavior changes** to reject semantics: optimistic hide, 5s Undo toast, auto-advance, error rollback, `view === "all"` gating, and the `rejectJob`/`unrejectJob` server actions all stay exactly as they are.
- `JobList`'s `estimateSize: () => 116` stays as-is — the reserved slot adds ~2px to chip-bearing cards and `measureElement` absorbs it. No action needed; do not "fix" it.

---

### Task 1: Auth-gate the card reject affordance

**Files:**
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx:1344-1348` (the `onReject` prop passed to `JobList`)
- Test (create): `dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx`

**Interfaces:**
- Consumes: existing `RolefitBoardProps.isAuthed: boolean` (`RolefitBoard.tsx:56`), existing `handleRejectById`.
- Produces: the card-level reject control (accessible name `Reject <job title>`) renders **only** when `isAuthed && view === "all"`. Task 2 relies on that accessible name staying `Reject ${job.title}`.

Today `app/page.tsx` passes `rejectJob` in both the authed and anon branches, and `RolefitBoard.tsx:1348` gates the card × only on `view === "all"` — so the × renders for anonymous visitors, and clicking it optimistically hides the job then bounces them to `/login` (`rejectJob` → `requireUserId()` → `redirect("/login")`, `lib/auth.ts:13-17`). The detail-pane Reject is already `isAuthed`-gated (`JobDetail.tsx:449`); this task brings the card affordance in line.

- [ ] **Step 1: Write the failing test**

Create `dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx`. The harness copies `RolefitBoard.liveMatches.test.tsx`'s narrow-layout pattern: jsdom can't lay out the virtualizer (0-height pane mounts no rows), so `matchMedia.matches: true` forces the plain non-virtualized list; no `?job=` deep link, so the narrow layout shows the list pane.

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

// Card-level reject is a signed-in triage affordance. For anon visitors it must not
// render at all: clicking it would optimistically hide the job, then the server
// action's requireUserId would redirect the visitor to /login mid-Undo-toast.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const job: JobRow = {
  id: "job-1",
  title: "Staff Engineer",
  location: "Phoenix, AZ",
  location_canonicals: null,
  remote: true,
  first_seen_at: "2026-07-01T00:00:00.000Z",
  closed_at: null,
  company_name: "Acme",
  ats: "greenhouse",
  human_override: false,
  verdict: "approve",
  role_category: "engineering",
  seniority: "staff",
  work_arrangement: "remote",
  pay_min: 150000,
  pay_max: 200000,
  pay_currency: "USD",
  pay_period: "year",
  headcount: null,
  skills_score: 8,
  experience_score: 8,
  comp_score: 8,
  fit_score: 88,
  skill_gaps: [],
};

const baseProps: RolefitBoardProps = {
  jobs: [job],
  nowIso: "2026-07-17T00:00:00.000Z",
  isAuthed: true,
  initialFilters: DEFAULT_FILTERS,
  saveResume: vi.fn(async () => {}),
  rejectJob: vi.fn(async () => {}),
  unrejectJob: vi.fn(async () => {}),
  markApplied: vi.fn(async () => {}),
  unmarkApplied: vi.fn(async () => {}),
  hasProfile: true,
  viewerEmail: "u@x.com",
  resumeText: "resume text",
  currentProfileVersion: null,
  initialPackages: [],
  initialRejected: [],
  initialJobQuestions: {},
};

// Narrow layout: JobList renders the plain (non-virtualized) list, which jsdom can
// actually lay out (the virtualizer against a 0-height pane would mount no rows).
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  stubMatchMedia();
  // No ?job= deep link: with nothing selected, the narrow layout shows the list pane.
  window.history.replaceState({}, "", "/");
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RolefitBoard - card reject affordance gating", () => {
  test("authed board offers a per-card Reject control in the all view", () => {
    render(<RolefitBoard {...baseProps} />);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject Staff Engineer" })).toBeTruthy();
  });

  test("anon board renders the same card with no reject control", () => {
    render(<RolefitBoard {...baseProps} isAuthed={false} />);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reject Staff Engineer" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails the right way**

Run: `cd dashboard && npx vitest run components/rolefit/RolefitBoard.rejectAffordance.test.tsx`
Expected: the authed test PASSES (the affordance already exists as an IconButton with this aria-label); the anon test FAILS — `queryByRole` finds the reject button because nothing gates it on auth yet. If the *authed* test fails, stop and debug the harness (the narrow-layout stub or deep-link reset), not the board.

- [ ] **Step 3: Gate `onReject` on `isAuthed`**

In `dashboard/components/rolefit/RolefitBoard.tsx`, the `JobList` render site currently reads (lines ~1344-1348):

```tsx
              // The hover-× is a triage affordance — only the "all" view is the triage
              // queue. Withholding it in Applied/Rejected prevents rejecting an
              // already-applied job (leaving it applied+rejected) or re-rejecting a
              // rejected one; those views carry their own detail-pane actions instead.
              onReject={view === "all" ? handleRejectById : undefined}
```

Replace with:

```tsx
              // The card reject is a triage affordance — only the "all" view is the
              // triage queue. Withholding it in Applied/Rejected prevents rejecting an
              // already-applied job (leaving it applied+rejected) or re-rejecting a
              // rejected one; those views carry their own detail-pane actions instead.
              // Authed-only: for anon visitors rejectJob's requireUserId redirects to
              // /login mid-toast, so the control must not render at all (the
              // detail-pane Reject is already isAuthed-gated).
              onReject={isAuthed && view === "all" ? handleRejectById : undefined}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npx vitest run components/rolefit/RolefitBoard.rejectAffordance.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Control-byte scan + commit**

```bash
cd /Users/andrew/Scripts/job-board
LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx && echo "STOP: control bytes" || echo clean
git add dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx
git commit -m "fix(board): card reject affordance is authed-only"
```

---

### Task 2: Labeled "Reject" pill in a reserved chips-row slot

**Files:**
- Modify: `dashboard/components/rolefit/JobCard.tsx` (IconButton → Button, wrapper modifier class)
- Modify: `dashboard/components/rolefit/board.css:164-175` (pill styling + reveal, replaces the old absolute-center block)
- Modify: `dashboard/app/globals.css:343-351` (delete the #14 reveal block) and `~:368-370` (drop a stale comment reference)
- Test (extend): `dashboard/components/rolefit/JobCard.test.tsx`

**Interfaces:**
- Consumes: shared `Button` (`components/ui/Button.tsx` — `variant`, `size`, `aria-label` passthrough, `className` appended after variant classes); Task 1's gating (unchanged here).
- Produces: `JobCard` renders, when `onReject` is present: wrapper class `rf-job-card--rejectable` on `.rf-job-card`, and a `Button` with visible text `Reject`, accessible name `Reject ${job.title}`, className `rf-job-card__reject`. The class `rf-card-reject` disappears from the codebase entirely.

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/components/rolefit/JobCard.test.tsx` (and add `fireEvent` to the existing `@testing-library/react` import so it reads `import { cleanup, fireEvent, render, screen } from "@testing-library/react";`):

```tsx
describe("JobCard - reject affordance", () => {
  test("with onReject: labeled Reject pill, reserved-slot modifier, reject-not-select on click", () => {
    const onReject = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <JobCard job={makeJob({ fit_score: 82 })} selected={false} onSelect={onSelect} onReject={onReject} />,
    );
    // Reserved-slot modifier drives the chips-row gutter in board.css.
    expect(container.querySelector(".rf-job-card.rf-job-card--rejectable")).toBeTruthy();
    const reject = screen.getByRole("button", { name: "Reject Staff Engineer" });
    // Visible text label (not an icon-only control); accessible name keeps the job
    // title so screen readers hear which job each pill rejects (and the visible
    // "Reject" is contained in it - WCAG 2.5.3 label-in-name).
    expect(reject.textContent).toBe("Reject");
    expect(reject.querySelector("svg")).toBeNull();
    fireEvent.click(reject);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith("job-1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("without onReject: no reject control and no reserved-slot modifier", () => {
    const { container } = render(
      <JobCard job={makeJob({ fit_score: 82 })} selected={false} onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(container.querySelector(".rf-job-card--rejectable")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd dashboard && npx vitest run components/rolefit/JobCard.test.tsx`
Expected: the FIRST new test FAILS at the `.rf-job-card--rejectable` assertion (the modifier has never existed; were it reached, `textContent` would be `""` on the icon-only IconButton too). The SECOND new test already PASSES — it is the negative guard (no `onReject` → no control today either) and exists to hold that line after the redesign. 1 new fail + 1 new pass is the correct pre-implementation state, not a broken harness. The pre-existing tests still pass.

- [ ] **Step 3: Swap the IconButton for a labeled Button in JobCard**

In `dashboard/components/rolefit/JobCard.tsx`:

1. Replace the import `import { IconButton } from "@/components/ui/Action";` with `import { Button } from "@/components/ui/Button";`
2. Update the `onReject` prop comment (lines 26-27) to:

```tsx
  // Hover/focus-revealed "Reject" pill on the card (#14, redesigned 2026-07-17: labeled
  // pill in a slot the chips row reserves - see board.css). Absent -> not rendered.
  onReject?: (id: string) => void;
```

3. Replace the wrapper-class expression on line 52 so the rejectable modifier joins `--new`:

```tsx
  const wrapperClass = [
    "rf-job-card",
    isNew && "rf-job-card--new",
    onReject && "rf-job-card--rejectable",
  ].filter(Boolean).join(" ");
```

and change the wrapper div to `<div className={wrapperClass} data-selected={selected || undefined}>` (drop the old ternary).

4. Replace the `IconButton` block (lines 104-116) with:

```tsx
      {onReject && (
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Reject ${job.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onReject(job.id);
          }}
          className="rf-job-card__reject"
        >
          Reject
        </Button>
      )}
```

Note: the pill must stay a **sibling** of `.rf-job-card__button` (interactive elements can't nest inside the card `<button>`) — the structure above preserves that. No inline styles: `JobCard.tsx` has no geometry exemption in the UI contract; every visual property goes in `board.css` (next step).

5. Update the stale "hover-×" comment references the redesign obsoletes (one-phrase swaps, no behavior):
   - `dashboard/components/rolefit/JobList.tsx:32` (the `onReject` prop doc) and `:77` (the scroll-guard comment): replace the "hover-×" wording with "card Reject pill".
   - `dashboard/components/rolefit/RolefitBoard.tsx` — the focus-stranding comment block (~lines 738-757) and the `handleRejectById` comment (~line 789): same "hover-×" → "card Reject pill" swap.

- [ ] **Step 4: Run the JobCard tests to verify they pass**

Run: `cd dashboard && npx vitest run components/rolefit/JobCard.test.tsx components/rolefit/RolefitBoard.rejectAffordance.test.tsx`
Expected: all pass (the gating tests keep passing because the accessible name is unchanged).

- [ ] **Step 5: Rewrite the pill CSS + reserved slot in board.css**

In `dashboard/components/rolefit/board.css`, replace the entire old block (lines 164-175):

```css
.rf-job-card__reject {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  z-index: 1;
  transform: translateY(-50%);
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
}
.rf-job-card:hover > .rf-card-reject,
.rf-job-card:focus-within > .rf-card-reject { opacity: 1; pointer-events: auto; }
```

with:

```css
/* Hover/focus-revealed "Reject" pill (#14 redesign, spec 2026-07-17). Chip-scale and
   anchored bottom-right in a slot the chips row reserves (--rejectable rule below), so
   revealing it never covers card text, the score pill, or a chip. The hidden state keeps
   pointer-events:none so the invisible control can't catch taps on touch devices, which
   never :hover - the detail pane's full-size Reject is the touch path. The descendant
   selector out-specifies .rf-button--secondary regardless of stylesheet order; the
   :hover rule below likewise out-specifies the secondary variant's hover background.
   24px min-height is deliberate (WCAG 2.5.8 AA): a 44px halo here would recreate the
   invisible-reject-over-card-text mis-click hazard this redesign removes. AUDIT
   FRAGILITY: min-height:24px matches the undersized-target size regex; the audit stays
   green only because these selectors don't classify as interactive - do NOT rename the
   class to contain button/btn/cta/action/link/trigger/control, and do NOT move sizing
   into a :hover/:focus rule. */
.rf-job-card .rf-job-card__reject {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 1;
  min-height: 24px;
  padding-inline: var(--space-2);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-badge);
  color: var(--danger);
  background: var(--danger-bg);
  font-size: var(--font-size-small);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
}
.rf-job-card .rf-job-card__reject:hover:not(:disabled) {
  background: var(--danger-bg);
  border-color: var(--danger);
}
.rf-job-card:hover > .rf-job-card__reject,
.rf-job-card:focus-within > .rf-job-card__reject,
.rf-job-card .rf-job-card__reject:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
/* Reserved slot: chips never flow under the pill, and the band exists even on a
   zero-chip card (pay, arrangement, and category can all be absent) so the pill can't
   land on the meta line. Chip-bearing cards keep their height (chips are ~22px).
   Accepted cost: on touch layouts the authed all-view still reserves this gutter
   though the pill can't hover-reveal there (chips wrap slightly earlier); an
   @media (hover: hover) gate was rejected because it would also kill the
   focus-within reveal for keyboards attached to touch devices. */
.rf-job-card--rejectable .rf-job-card__chips {
  min-height: 24px;
  padding-right: 84px;
}
```

- [ ] **Step 6: Delete the globals.css #14 block and its stale comment reference**

In `dashboard/app/globals.css`, delete lines 343-351 entirely (the comment + 4 rules — the `.rf-card:hover`/`.rf-card:focus-within` pair has been dead since #14 shipped: `.rf-card` is the generic Panel and never contains a reject):

```css
/* Hover-revealed reject × on job cards (#14). Inline styles can't express a parent's
   :hover, so the reveal lives here; keyboard focus reveals it too. `pointer-events: none`
   on the hidden state keeps the invisible (opacity:0) × from being a tappable target on
   touch devices, which never :hover — without it a tap near the fit-score badge would
   reject the job instead of opening it. */
.rf-card-reject { opacity: 0; pointer-events: none; transition: opacity .12s; }
.rf-card:hover > .rf-card-reject,
.rf-card:focus-within > .rf-card-reject,
.rf-card-reject:focus-visible { opacity: 1; pointer-events: auto; }
```

Then in the ModelPicker/LocationPicker comment just below (~line 368-370), change `same rationale as\n   .rf-focusable / .rf-card-reject above` to `same rationale as\n   .rf-focusable above`.

- [ ] **Step 7: Verify `rf-card-reject` is gone from the codebase**

Run: `cd /Users/andrew/Scripts/job-board && grep -rn 'rf-card-reject' dashboard/ --include='*.tsx' --include='*.ts' --include='*.css'`
Expected: no output. Any hit is a missed reference — fix it before continuing.

- [ ] **Step 8: Run the contract audit and the full rolefit tests**

Run: `cd dashboard && npm run test:ui-contract && npx vitest run components/rolefit`
Expected: all pass. `test:ui-contract` proves the pill satisfies the static audit (shared primitive, no glyphs, tokens only, no inline geometry, no undersized interactive selector) and that the untouched visual fixtures still match the visual-regression contract.

- [ ] **Step 9: Control-byte scan + commit**

```bash
cd /Users/andrew/Scripts/job-board
LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' dashboard/components/rolefit/JobCard.test.tsx && echo "STOP: control bytes" || echo clean
git add dashboard/components/rolefit/JobCard.tsx dashboard/components/rolefit/JobCard.test.tsx dashboard/components/rolefit/board.css dashboard/app/globals.css dashboard/components/rolefit/JobList.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): labeled Reject pill in a reserved card slot replaces the overlapping hover icon"
```

---

### Task 3: Full-suite verification + live visual check

**Files:** none committed (verification only; the dev-auth shim below is temporary and MUST NOT be committed).

**Interfaces:**
- Consumes: Tasks 1-2 complete.
- Produces: green full suite + typecheck, and hover/keyboard screenshots (light + dark) confirming the pill reveals into empty space with zero occlusion.

- [ ] **Step 1: Full dashboard suite + typecheck**

Run: `cd dashboard && npm run test && npm run typecheck`
Expected: all green. (If running in a fresh worktree and unrelated parseProfile binary-fixture tests skip, that skip is expected — worktrees omit gitignored fixtures.)

- [ ] **Step 2: Live visual check via the dev-auth shim (main checkout, not a worktree)**

The authed board can't be reached by the Chrome extension on prod (no session cookie) and local login is dead, so use the documented dev shim. **All three edits are temporary.**

1. In `dashboard/.env.local` add: `DEV_USER_ID=9ae8b777-7c24-4290-8aad-bd2b10eff23b`
2. `dashboard/lib/auth.ts` — add as the FIRST line of `getUserId()`:
   `if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) return process.env.DEV_USER_ID; // TEMP DEV SHIM - never commit`
   and as the FIRST line of `getUserClaims()`:
   `if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) return { id: process.env.DEV_USER_ID, email: "andrewrmalvani@gmail.com" }; // TEMP DEV SHIM - never commit`
3. `dashboard/lib/supabase/middleware.ts` — add as the FIRST line of `updateSession()`:
   `if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) return NextResponse.next({ request }); // TEMP DEV SHIM - never commit`
4. `cd dashboard && PORT=3000 npm run dev`, confirm `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` prints 200.
5. With claude-in-chrome (new tab, http://localhost:3000): hover a job card — the Reject pill should fade in at bottom-right INSIDE the card with no text/score/chip underneath it; Tab to a card — the pill reveals on keyboard focus with the blue ring; toggle Dark via the header theme control and repeat the hover; check a card whose chips row is empty still shows the pill on its own band. Do NOT click the pill on a job you care about (it really rejects; Undo toast gives 5s).
6. **Revert the shim:**

```bash
cd /Users/andrew/Scripts/job-board
git checkout -- dashboard/lib/auth.ts dashboard/lib/supabase/middleware.ts
# remove the DEV_USER_ID line from dashboard/.env.local
git status   # MUST show no modifications to auth.ts / middleware.ts
```

- [ ] **Step 3: Confirm clean tree + report**

Run: `git status` — only intended commits from Tasks 1-2, no stray changes. Report the visual findings (screenshots or descriptions) to the user before any merge/push decision.
