# Phase 4 implementation report — profile and settings visual convergence

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `ce55302` (`refactor(profile): converge settings on design system`)

## Scope delivered

- Replaced every duplicated Profile detail-page heading block with the shared `PageHeader` while retaining the existing `BackLink`, title, description, route, metadata, authentication, redirect, and data-loading behavior.
- Rebuilt the Profile hub around shared `PageHeader`, `Card`, `Badge`, and `ButtonLink` contracts with one token-based readiness summary and consistent core-task cards.
- Converted all Profile form sections to a common card/rhythm contract and shared typography/control classes. Fields now inherit the design-system label, description, error, focus, control-height, textarea, and invalid-state treatment.
- Preserved `SectionFormShell` dirty tracking, pending edits, validation focus, linked error summaries, unsaved-navigation warning, Cancel baselines, save baselines, file handling, and status announcements while migrating its presentation to the shared error and action-bar contracts.
- Migrated Account sections to shared cards/actions, Appearance to the shared keyboard-operable `SegmentedControl`, and Danger Zone to shared `Card`, `TextField`, `ButtonLink`, and destructive `Button` components.
- Preserved data export ordering and URL, account deletion action/confirmation/pending/error behavior, billing navigation, theme persistence, résumé extraction/replacement/refusal/archive/review/reset/save behavior, AI settings, and all profile server actions.
- Replaced page-local geometry with semantic spacing, typography, width, radius, target, color, and elevation tokens. Added responsive single-column cards, full-width mobile actions/appearance controls, mobile-safe Danger Zone, responsive résumé metadata, and the existing single-control mobile Profile section selector.
- Removed inline presentation and raw product buttons from all Phase 4 scoped product components. No raw color literals, Unicode control glyphs, or bespoke SVG controls were added.

## TDD evidence

### RED

Added `dashboard/components/profile/ProfileDesignSystem.test.tsx` and ran:

```text
npm test -- components/profile/ProfileDesignSystem.test.tsx --run

Test Files  1 failed (1)
Tests       5 failed (5)
```

The failures reproduced the five intended convergence gaps: duplicated route headers, local/inline card and control presentation, fields/forms missing shared typography/control/error/action roles, Account/Appearance/Danger Zone missing shared primitives, and absent token-based responsive page rhythm.

### GREEN

Profile/design-system regression matrix:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- \
  app/profile components/profile components/account/DangerZone.test.tsx \
  components/theme/AppearanceToggle.test.tsx components/theme/ThemeProvider.test.tsx \
  components/shell/ProfileSectionNav.test.tsx components/ui --run

Test Files  19 passed (19)
Tests       102 passed (102)
```

Final profile behavior rerun after field-adapter refinements:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- \
  components/profile components/LocationPicker.test.tsx \
  components/ModelPicker.test.tsx app/profile --run

Test Files  12 passed (12)
Tests       81 passed (81)
```

## Required verification

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  168 passed | 2 skipped (170)
Tests       1244 passed | 6 skipped (1250)
```

- `npm run typecheck`: passed (including a final post-refinement run).
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings outside Phase 4.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed after network access was allowed for the configured Google font; all routes compiled and all eight static pages generated. The first sandboxed attempt failed only because `fonts.googleapis.com` was unavailable.
- `git diff --check`: passed.
- Scoped source audit: no inline `style`, raw product `<button>`, raw color literal, forbidden Unicode control glyph, or bespoke SVG control remains in `components/profile`, `DangerZone`, `AppearanceToggle`, or Profile route pages.

## Browser evidence

The current implementation is intentionally unpushed, so a local authenticated browser was required. The local Next.js development server started successfully at `http://localhost:3000`. Browser runtime initialization then returned `No browser is available`; the required troubleshooting discovery call returned `[]`. This worker therefore could not bind any in-app/extension browser, navigate the current working tree, or capture the required route matrix.

The independent reviewer/controller must complete the live gate against the committed/deployed Phase 4 range for:

- `/profile`
- `/profile/job-preferences`
- `/profile/resume`
- `/profile/application-details`
- `/profile/application-personalization`
- `/profile/advanced`
- `/profile/account`

Each route needs light/dark screenshots at 1440 and 390 CSS pixels, zero document-level overflow, single-control mobile Profile navigation, visual card/field/action alignment, focus/error/status states, and console-error checks. Interaction coverage should include dirty/cancel/save, a validation summary link/focus, résumé disclosure and recovery-safe upload behavior, appearance switching, export navigation semantics, and destructive confirmation without submitting deletion.

## Concern

The required live browser matrix is absent because browser discovery exposed no backend in this worker. All source, component, route, behavior, full-suite, typecheck, lint, production-build, and diff checks are green; live visual/interaction evidence remains the independent Phase 4 adversarial gate item.

---

## Adversarial review fix — canonical typography, disclosure, and card geometry

Implementation commit: `f4bdef4` (`fix(profile): resolve design system review findings`)

The independent reviewer reported 0 Critical, 2 Important, and 1 Minor issue. All three are resolved:

- Removed the broad `.profile-detail` descendant font-size override. Only native input, textarea, and select text receives the intentional 16px/iOS-safe body size; shared button sizes remain owned by `rf-button`/`rf-button--sm`, and descriptions/help remain owned by `--font-size-help` roles.
- Rebuilt the native voluntary-demographics disclosure as a documented styled composite: native `details`/`summary` semantics and keyboard behavior remain, while the summary now uses `rf-focusable`, an internal `Icon`, a suppressed UA marker, a 44px target, and a token-based rotating open-state affordance.
- Added `rf-card rf-card--lg` to every Profile form surface and removed the duplicate padding, border, radius, background, and elevation declarations from `.profile-form-section`. That class now owns layout only; shared Card owns geometry.

### Review-fix RED

Extended `ProfileDesignSystem.test.tsx` with canonical typography, shared Card ownership, and disclosure icon/focus/open-state contracts:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- \
  components/profile/ProfileDesignSystem.test.tsx --run

Test Files  1 failed (1)
Tests       3 failed | 4 passed (7)
```

The failures independently reproduced each reviewer finding.

### Review-fix GREEN and verification

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- \
  components/profile/ProfileDesignSystem.test.tsx \
  components/profile/ApplicationDetailsForm.test.tsx \
  components/profile/SettingsPrimitives.test.tsx \
  app/profile/profileRoutes.test.tsx --run

Test Files  4 passed (4)
Tests       53 passed (53)
```

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  168 passed | 2 skipped (170)
Tests       1246 passed | 6 skipped (1252)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings outside Phase 4.
- Production build with the configured database placeholder and Google-font network access: passed; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.
