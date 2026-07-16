# Phase 2 implementation report — shared authenticated app shell and navigation

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `5569558` (`feat(ui): unify authenticated app shell`)

## Scope delivered

- Added `AppShell`, `AppHeader`, and `ProfileSectionNav` with token-backed responsive CSS.
- Consolidated the board `Header` and off-board `SlimHeader` on the same brand, header geometry, primary navigation, active-route treatment, and account affordance.
- Preserved the board search field, operator health signal, unreviewed count, résumé/profile action, anonymous sign-in/sign-up actions, and `/` keyboard-focus ref through explicit shell slots.
- Added Board, Analytics, and Companies to the keyboard-operable account menu so primary navigation remains available when the desktop navigation collapses.
- Increased the account-menu trigger to the standard 44px target.
- Migrated Analytics, Companies, Billing, Profile, Admin Invites, and Admin Tenants to `AppShell`; the board root now carries the same shell contract while retaining its full-height workspace behavior.
- Replaced the board header's hand-authored search/edit glyphs with the internal SVG icon system.
- Replaced the seven-link mobile profile tab wrap with exactly one labelled section selector while retaining the desktop profile links and `aria-current` state.
- Added responsive breakpoints that collapse primary navigation and low-priority board status content before the 1024/768 widths, then move board search to its own row at 390px.

## TDD evidence

### RED

Before production components existed:

```text
npm test -- components/shell/AppHeader.test.tsx components/shell/ProfileSectionNav.test.tsx components/shell/AppShell.test.tsx

Test Files  3 failed (3)
Tests       no tests
```

All three suites failed at import resolution because `AppHeader`, `ProfileSectionNav`, and `AppShell` did not exist. The tests specify shared route links and active state, account access, the desktop-navigation collapse contract, board-specific slots, exactly one compact profile selector, selector navigation, and a bounded shell/content structure.

### GREEN

Focused shell and affected-consumer run:

```text
npm test -- components/shell/AppHeader.test.tsx components/shell/ProfileSectionNav.test.tsx components/shell/AppShell.test.tsx components/rolefit/Header.test.tsx components/rolefit/AccountMenu.test.tsx components/profile/SettingsPrimitives.test.tsx components/rolefit/RolefitBoard.test.tsx app/globals.theme.test.ts

Test Files  8 passed (8)
Tests       46 passed (46)
```

Required full suite:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  165 passed | 2 skipped (167)
Tests       1224 passed | 6 skipped (1230)
```

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings outside Phase 2.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed after allowing network access for the configured Google font; route collection and all eight static generations completed.
- Two sandboxed build attempts failed only because `next/font` could not reach `fonts.googleapis.com`; the identical build passed when network access was available.
- `git diff --check`: passed before commit.

## Browser evidence

Live browser screenshots could not be captured in this implementer worker. The required browser-control skill is present, but its required Node browser-control tool is not exposed to this worker; invoking the command-line module is not a supported substitute. The controller has an authenticated local/preview browser session and the independent reviewer must perform the required live review there.

Browser matrix still required at the adversarial gate:

- Board, Profile, Analytics, Companies, Billing, Admin Tenants, and Admin Invites.
- 1440px and 390px; light and dark themes.
- Structural overflow measurements at 390, 768, 1024, and 1440px.
- Keyboard walkthrough of primary navigation, account-menu open/move/Escape/Tab behavior, and mobile profile selector navigation.

## Concerns for adversarial review

1. Browser evidence and measured viewport overflow evidence remain outstanding for the independent reviewer.
2. The account popup intentionally includes the primary Board/Analytics/Companies destinations at desktop widths as well as mobile widths. This provides one consistent popup and avoids JavaScript viewport branching; the reviewer should assess whether the duplication is aesthetically acceptable.
3. Off-board route bodies retain their existing page-local styling until their planned convergence phases. This phase changes their shell/header only.

---

## Adversarial review fixes — 2026-07-13

Implementation commit: `00d13dc` (`fix(ui): satisfy phase 2 shell review`)

### Findings resolved

- **I1 — collapsed active route:** added a dedicated `AppNavMenu` whose route contract represents Board, Analytics, Companies, Profile, Billing, and Admin. Every item receives `aria-current="page"` from the shared `AppRoute`, and parameterized tests cover all six states.
- **I2 — desktop duplication:** primary navigation and the responsive navigation menu now use distinct markup and affordances. CSS shows the desktop links above 1100px and the menu trigger at/below 1100px; no viewport JavaScript determines markup. `AccountMenu` is account-only at every width and no longer accepts or renders primary navigation.
- **I3 — profile selector primitive:** the single mobile profile selector now composes Phase 1 `SelectField`, including `rf-control`, `rf-select`, `rf-focusable`, `rf-select-wrap`, and the internal SVG chevron. Product-local select geometry was removed.
- **M1 — responsive contract evidence:** the test now pins the mutually exclusive desktop/mobile display rules at the 1100px breakpoint rather than merely checking for a class, while live browser measurement remains part of the external gate.
- **M2 — board shell exception:** documented the board's intentional composite exception beside its root: the virtualized viewport-height workspace must own the flex/overflow boundary rather than nest `AppShell`'s content wrapper. A contract test pins both this marker and off-board `AppShell` composition.
- **M3 — stale account docs:** updated the public contract comment and tests to specify that account and responsive primary navigation are separate affordances.
- Added keyboard coverage for ArrowDown entry, movement, End, Escape close, and trigger-focus restoration in the responsive navigation.

### Review-fix RED evidence

Before the fixes:

```text
npm test -- components/shell/AppHeader.test.tsx components/shell/ProfileSectionNav.test.tsx components/shell/AppShell.contract.test.ts

Test Files  2 failed (2)
Tests       8 failed | 3 passed (11)
```

Six route-state tests and the distinct responsive-menu test failed because `Open navigation` did not exist. The profile test failed because its combobox had none of the Phase 1 select/focus/icon contracts. The original `.ts` contract filename was then corrected to the repository's collected `.test.tsx` convention so the board exception assertion runs in the suite.

### Review-fix GREEN evidence

Focused shell, route-contract, and affected-consumer run:

```text
npm test -- components/shell/AppHeader.test.tsx components/shell/ProfileSectionNav.test.tsx components/shell/AppShell.test.tsx components/shell/AppShell.contract.test.tsx components/rolefit/Header.test.tsx components/rolefit/AccountMenu.test.tsx components/profile/SettingsPrimitives.test.tsx components/rolefit/RolefitBoard.test.tsx app/globals.theme.test.ts

Test Files  9 passed (9)
Tests       55 passed (55)
```

Required full suite:

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  166 passed | 2 skipped (168)
Tests       1233 passed | 6 skipped (1239)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- `env DATABASE_URL=postgresql://test:test@localhost:5432/test npm run build`: passed with Google font network access; every route compiled and static generation completed.
- `git diff --check`: passed before commit.

Live light/dark desktop/mobile screenshots and route-level overflow measurements remain for the independent reviewer/controller because this worker still lacks a browser binding.

---

## Second adversarial review fix — responsive information hierarchy

Implementation commit: `fc3bbea` (`fix(ui): separate primary and account navigation`)

The re-review correctly identified that the responsive `AppNavMenu` still repeated Profile, Billing, and Admin beside the account affordance. The ownership contract is now exact at every width:

- Desktop primary navigation and responsive `AppNavMenu` both contain only Board, Analytics, and Companies.
- `AccountMenu` alone contains Profile, Billing, Admin when authorized, and Sign out.
- `aria-current="page"` remains available for Board/Analytics/Companies in the primary menu and for Profile/Billing/Admin in the account menu.

### RED

```text
npm test -- components/shell/AppHeader.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 9 passed (10)
```

The new ownership test expected the responsive primary destinations to equal `[Board, Analytics, Companies]`, but received `[Board, Analytics, Companies, Profile, Billing]`, reproducing the reviewer finding. The test also records each menu's destinations and asserts their intersection is empty.

### GREEN and verification

```text
npm test -- components/shell/AppHeader.test.tsx components/rolefit/AccountMenu.test.tsx components/rolefit/Header.test.tsx components/shell/AppShell.contract.test.tsx components/shell/ProfileSectionNav.test.tsx

Test Files  5 passed (5)
Tests       36 passed (36)
```

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  166 passed | 2 skipped (168)
Tests       1233 passed | 6 skipped (1239)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- Production build with the configured database placeholder and Google font network access: passed.
- `git diff --check`: passed.

---

## Live-browser cascade fix — mobile profile navigation

Implementation commit: `f38bd87` (`fix(ui): hide desktop profile nav on mobile`)

Live 390px review exposed a cascade collision: `profile-settings.css` is route-loaded after the shared shell CSS, and its `.settings-nav { display: flex }` declaration had equal specificity to `.profile-section-nav__desktop { display: none }`. Both the seven desktop links and the mobile selector therefore appeared.

The mobile shell rule now uses `.profile-section-nav .profile-section-nav__desktop`, deliberately giving it two class selectors so it outranks the later legacy one-class rule regardless of stylesheet order. Desktop behavior is unchanged: at 1440px the desktop links use `display: flex` and `.profile-section-nav__mobile` remains `display: none`. At 390px the desktop nav is hidden and the single Phase 1 `SelectField` remains visible.

### RED

```text
npm test -- components/shell/ProfileSectionNav.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 2 passed (3)
```

The regression test records the later `.settings-nav { display: flex }` declaration and requires a mobile hide selector with greater class specificity. It failed against the original equal-specificity rule.

### GREEN and verification

```text
npm test -- components/shell/ProfileSectionNav.test.tsx components/profile/SettingsPrimitives.test.tsx components/shell/AppHeader.test.tsx

Test Files  3 passed (3)
Tests       25 passed (25)
```

```text
NODE_OPTIONS=--no-experimental-webstorage npm test -- --run

Test Files  166 passed | 2 skipped (168)
Tests       1234 passed | 6 skipped (1240)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- Production build passed with configured Google font network access.
- `git diff --check`: passed.
