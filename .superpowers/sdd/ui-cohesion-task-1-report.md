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
