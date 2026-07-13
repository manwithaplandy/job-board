# Phase 1 implementation report — design tokens and foundational primitives

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `be20bed75f7dc23052bd442465f83cb832319a3a` (`feat(ui): establish cohesive design primitives`)

## Scope delivered

- Added shared typography, spacing, radius, target/control-height, content-width, elevation, and motion tokens in `dashboard/app/globals.css`, with light/dark token parity retained.
- Added `dashboard/components/ui/ui.css` and imported it through the global stylesheet.
- Extended `Button` with danger, size, loading, disabled, focus, and anchor (`ButtonLink`) contracts while retaining the legacy inline presentation needed by existing product consumers.
- Added internal 16/18/20-pixel SVG `Icon` contracts and accessible `IconButton` actions.
- Added labelled `TextField`, `TextArea`, `SelectField`, and `FileUpload` primitives with descriptions, errors, focus treatment, and accessible associations.
- Added `Card`, `Badge`, `Tabs`, `SegmentedControl`, `BackLink`, `PageHeader`, and `FormActions` contracts.
- Kept existing screen components unchanged; only the shared UI layer and global token import changed.

## TDD evidence

### RED

Command:

```text
npm test -- components/ui/Button.test.tsx components/ui/Action.test.tsx components/ui/FormControls.test.tsx components/ui/Navigation.test.tsx
```

Observed expected failure before production changes:

- 4 test files failed.
- `Action.test.tsx`, `FormControls.test.tsx`, and `Navigation.test.tsx` could not resolve the not-yet-created primitives.
- `Button.test.tsx` failed because `danger`/`lg` classes, loading behavior, and `ButtonLink` did not exist; React also reported that the old button forwarded unknown loading props.

### GREEN

The same focused command passed after the minimum implementation:

```text
Test Files  4 passed (4)
Tests       8 passed (8)
```

A representative regression run initially exposed three existing `ApplicationPanel` tests that inspect legacy inline CTA colors. `Button` was adjusted to preserve its prior inline style contract while also supplying the new shared classes. Final focused/regression verification:

```text
npm test -- components/ui/Button.test.tsx components/ui/Action.test.tsx components/ui/FormControls.test.tsx components/ui/Navigation.test.tsx app/globals.theme.test.ts components/rolefit/ApplicationPanel.test.tsx components/rolefit/JobDetail.test.tsx app/error.test.tsx

Test Files  8 passed (8)
Tests       26 passed (26)
```

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 9 existing warnings outside the Phase 1 files.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed; all routes compiled and static page generation completed.
- `git diff --check`: passed before commit.
- Full `npm test`: 1191 tests passed, 6 skipped, and 20 failed only in the four pre-existing localStorage-dependent suites (`ThemeProvider`, `AppearanceToggle`, `GenerationToastProvider`, and `theme.script`) because this Node runtime exposes `localStorage` as unavailable without `--localstorage-file`. The focused Phase 1 and regression suites are unaffected and green.

## Browser evidence

The local Next.js development server started successfully at `http://localhost:3000`. The required Codex in-app browser could not be selected: browser setup completed, but `agent.browsers.get("iab")` reported `Browser is not available: iab`, and the documented discovery check `agent.browsers.list()` returned an empty list. Consequently, no light/dark desktop/mobile screenshots could be captured in this worker. No alternative browser backend was used because the task explicitly required the in-app browser.

## Files

Modified:

- `dashboard/app/globals.css`
- `dashboard/components/ui/Button.tsx`
- `dashboard/components/ui/Panel.tsx`
- `dashboard/components/ui/Chip.tsx`

Created:

- `dashboard/components/ui/Icon.tsx`
- `dashboard/components/ui/Action.tsx`
- `dashboard/components/ui/FormControls.tsx`
- `dashboard/components/ui/Navigation.tsx`
- `dashboard/components/ui/ui.css`
- `dashboard/components/ui/Button.test.tsx`
- `dashboard/components/ui/Action.test.tsx`
- `dashboard/components/ui/FormControls.test.tsx`
- `dashboard/components/ui/Navigation.test.tsx`

## Concerns

1. Required browser screenshot evidence is absent because the in-app browser runtime exposed no available browser backend.
2. The full suite has 20 environment-only localStorage failures described above; all Phase 1 focused tests and selected legacy consumer regressions pass.
3. Lint retains nine pre-existing warnings outside this phase's files; there are no lint errors.

---

## Adversarial review fix — 2026-07-13

Implementation commit: `46c650554ddcb3642c21b06c1c1d63ffabd11ca8` (`fix(ui): satisfy phase 1 primitive review`)

### Findings resolved

- **I1 — inline button presentation:** removed default inline geometry/color styles from `Button`; token-backed CSS classes now own normal, hover, active, disabled, and loading presentation. Consumer `style` remains available only for intentional deltas. The legacy `ApplicationPanel` test now asserts semantic variant classes instead of inline color serialization.
- **I2 — disabled tabs:** disabled tab items render as non-link `<span aria-disabled="true">` content, with no `href` or tab stop, plus a distinct disabled visual state.
- **I3 — radiogroup keyboard model:** `SegmentedControl` now uses roving `tabIndex`, ArrowLeft/Right/Up/Down selection with wrapping, Home/End support, focus movement, and disabled-item skipping.
- **I4 — generated field ARIA:** all four field families merge consumer `aria-describedby` with generated description/error IDs. An `error` prop authoritatively sets `aria-invalid="true"`; consumer invalid state remains available when no rendered error exists.
- **I5 — missing foundation vocabulary:** completed primary, secondary, outline, ghost, destructive, and text-link variants; retained `danger` as an explicit alias to destructive. Added compact/small/medium/large size vocabulary, the 36px compact control token, and form/standard/workspace width tokens while retaining old width aliases for compatibility.
- **I6 — insufficient contract tests:** added behavior-focused tests for disabled navigation, radio keyboard operation and focus, loading ARIA precedence, ARIA merging across all controls, file-selection feedback, explicit gallery theming, and unauthenticated gallery access. Source assertions remain only as supplemental token/reduced-motion checks.
- **M1 — icon-button sizes:** small and medium now choose distinct 16px/18px icons and expose documented 36px/44px visual density while retaining a 44px outer interactive target.
- **M2 — reduced-motion spinner:** reduced-motion mode disables spinner animation and uses a static dotted loading indicator; textual and `aria-busy` state remain intact.
- **M3 — loading prop precedence:** loading semantics are applied after consumer props. `loadingLabel` wins over a consumer accessible label and `aria-busy` is always true while loading.

### Renderable review fixture

Added the public, statically generated `/ui-gallery` route. It renders every Phase 1 primitive, every action variant and size, disabled/loading states, all internal icons, field/error/upload states, cards and badge tones, tabs including a disabled destination, a keyboard-operable segmented control, back navigation, page headers, and form actions. The fixture has explicit “Use light theme” and “Use dark theme” buttons and responsive styles for desktop and 390px review. `/ui-gallery` is intentionally included in the public-path allowlist so a reviewer does not need an authenticated product session.

### Second RED evidence

Before the fixes, the focused run produced 8 failing tests plus one missing-gallery suite:

```text
npm test -- components/ui/Button.test.tsx components/ui/Action.test.tsx components/ui/FormControls.test.tsx components/ui/Navigation.test.tsx app/ui-gallery/page.test.tsx

Test Files  5 failed (5)
Tests       8 failed | 5 passed (13)
```

Failures reproduced inline presentation, loading ARIA override, identical icon-button sizes, overwritten generated ARIA, absent selected-file status, actionable disabled tabs, missing roving radio focus, incomplete tokens, and the missing gallery route. A separate `lib/paths.test.ts` RED run failed because `/ui-gallery` was not public. A final gallery-specific RED run also proved that explicit light and dark controls were not both present.

### Final GREEN and verification evidence

Focused primitive/gallery/consumer run:

```text
npm test -- components/ui/Button.test.tsx components/ui/Action.test.tsx components/ui/FormControls.test.tsx components/ui/Navigation.test.tsx app/ui-gallery/page.test.tsx lib/paths.test.ts components/rolefit/ApplicationPanel.test.tsx

Test Files  7 passed (7)
Tests       35 passed (35)
```

Required full suite:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  162 passed | 2 skipped (164)
Tests       1218 passed | 6 skipped (1224)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings outside Phase 1.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed; `/ui-gallery` was statically generated.
- `git diff --check`: passed before the implementation commit.

### Browser evidence and remaining concern

The local development server started successfully. A second in-app browser attempt still returned `Browser is not available: iab`; the runtime had previously reported an empty browser list. Per the browser-control contract, no unrelated browser backend was substituted. Live light/dark desktop/390px screenshots and computed-style measurements therefore remain for the independent reviewer, but the new public `/ui-gallery` route removes the prior authentication/consumer-coverage blocker and is ready for that review.
