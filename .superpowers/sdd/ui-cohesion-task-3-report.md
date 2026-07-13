# Phase 3 implementation report — critical native-control and icon regressions

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `e2cc8a5` (`fix(ui): remove native controls and glyph icons`)

## Scope delivered

- Replaced the browser-default résumé disclosure with the shared `Button` and internal disclosure icons while retaining `aria-expanded`, `aria-controls`, collapsed hidden-field submission, and reviewed-text behavior.
- Migrated résumé PDF selection to the Phase 1 `FileUpload` primitive while retaining extraction, replacement confirmation, archive submission, filename/status copy, save re-keying, and the recoverable reviewed-text source of truth.
- Migrated shared profile save/cancel actions to `Button` and `FormActions` without changing dirty-state, reset, pending, validation, or success behavior.
- Replaced Location and Model picker clear controls with accessible 44px `IconButton` actions while retaining bubbling hidden-field events and keyboard picker behavior.
- Replaced all six profile detail raw back links with the internal icon-backed `BackLink` while retaining `/profile` navigation and visible copy.
- Extended the internal SVG icon set for the existing product affordances: right/up arrows, copy, download, refresh, and star.
- Removed user-visible Unicode control glyphs from the affected board surfaces, including close, back, carets, edit, sparkle, success, warning, download, refresh, and CTA arrows. Existing actions and copy remain intact.
- Replaced the Profile modal close control and Job card rejection affordance with shared `IconButton`; the latter now meets the 44px target contract.
- Added aligned internal icons to résumé/cover generation, job-detail status and disclosure, filters, score checks, application status, review warnings, and billing CTAs.

## TDD evidence

### RED

Added `dashboard/components/ui/criticalControls.test.tsx` and ran:

```text
npm test -- components/ui/criticalControls.test.tsx

Test Files  1 failed (1)
Tests       3 failed (3)
```

The failures independently reproduced all three phase regressions:

1. résumé disclosure, SectionFormShell actions, and picker clears still used raw `<button>` elements and the résumé upload did not compose `FileUpload`;
2. all six profile routes still rendered the literal `← Back to profile` link;
3. board source still rendered forbidden Unicode control glyphs.

### GREEN

Focused component and behavior matrix:

```text
npm test -- components/ui/criticalControls.test.tsx components/ui/Icon.test.tsx components/ui/FormControls.test.tsx components/ui/Navigation.test.tsx components/profile/ResumeSettingsForm.test.tsx components/LocationPicker.test.tsx components/ModelPicker.test.tsx components/rolefit/GenerationInstructions.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/ProfileModal.test.tsx components/rolefit/JobCard.test.tsx components/rolefit/ApplicationPanel.test.tsx components/rolefit/CoverLetterEditor.test.tsx components/rolefit/ResumeScorePanel.test.tsx components/rolefit/ReviewNowPanel.test.tsx components/rolefit/RolefitBoard.test.tsx

Test Files  14 passed (14)
Tests       72 passed (72)
```

Profile route and résumé regression matrix:

```text
npm test -- app/profile/profileRoutes.test.tsx components/ui/criticalControls.test.tsx components/ui/Navigation.test.tsx components/profile/ResumeSettingsForm.test.tsx components/rolefit/ProfileModal.test.tsx

Test Files  5 passed (5)
Tests       54 passed (54)
```

The existing `GenerationInstructions` assertions were updated from the removed visual checkmark character to the unchanged visible status word `Saved`; behavior tests remain otherwise unchanged.

## Required verification

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  167 passed | 2 skipped (169)
Tests       1237 passed | 6 skipped (1243)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed after allowing the configured Google font fetch; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.
- Focused source audit found no raw `<button>` in `ResumeSettingsForm`, `SectionFormShell`, `LocationPicker`, or `ModelPicker`; no raw profile back link remains; no user-visible forbidden glyph remains in the scoped board/profile product code.

## Browser evidence

A local Next.js development server was successfully started for the résumé and job-detail walkthrough. The Browser runtime initialized, but URL selection returned `No browser is available`. Following the required recovery procedure, `agent.browsers.list()` returned `[]`. This worker therefore has no in-app or extension browser binding and cannot capture the required light/dark desktop/mobile screenshots or exercise the authenticated résumé/job-detail flows live.

The independent reviewer/controller must complete the browser gate against this commit, covering:

- `/profile/resume`: upload/filename, extraction, unsaved replacement refusal, disclosure expand/collapse, Cancel restore, Save, and archived résumé safety;
- job detail: mobile Back, full-description disclosure, filters, rejection, applied status, generation instruction status, modal close, and all replaced icons;
- light/dark at desktop and 390px, with icon alignment, focus treatment, and 44px close/clear/reject targets checked visually.

## Concern

The required live browser screenshots and interactions are unavailable in this worker because browser discovery returned no backends. Automated behavior, source contracts, typecheck, lint, build, and the full test suite are green; the independent browser reviewer remains the only Phase 3 gate item.

---

## Adversarial review fix — shared résumé copy icon

Implementation commit: `f5cc50f` (`fix(ui): use shared resume copy icon`)

The reviewer found one remaining bespoke 13px inline SVG in the generated résumé Copy action. The action now renders the shared `<Icon name="copy" size={16} />` inside the existing aligned button, preserving its `onCopy` handler, live `copyLabel` status, accessible name, spacing, and button geometry.

### Review-fix RED

The critical-control guard was extended to require the shared copy icon and reject bespoke SVG markup in `ResumePanel`:

```text
npm test -- components/ui/criticalControls.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)
```

The new assertion failed because `ResumePanel` did not contain `<Icon name="copy"` and still contained `<svg>`.

### Review-fix GREEN and audit

```text
npm test -- components/ui/criticalControls.test.tsx components/rolefit/ResumePanel.test.tsx components/rolefit/ApplicationPanel.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/JobCard.test.tsx components/rolefit/ProfileModal.test.tsx components/rolefit/GenerationInstructions.test.tsx

Test Files  6 passed (6)
Tests       33 passed (33)
```

The guard now audits every Phase 3 board control source for bespoke SVG icons. The only remaining scoped inline SVG is Job Detail's 88px two-circle fit-score data visualization; a dedicated assertion identifies and allows that non-control visualization. A second source audit found no user-visible forbidden Unicode control glyphs.

Required verification after the review fix:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  167 passed | 2 skipped (169)
Tests       1239 passed | 6 skipped (1245)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- Production build: passed; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.
