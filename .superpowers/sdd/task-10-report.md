# Task 10 report — Account & App isolation

## Status

Implemented the isolated `/profile/account` destination and removed the unused legacy global profile form shell.

## TDD evidence

- Added `AccountSettings.test.tsx` before the component existed. The first focused run failed because `./AccountSettings` could not be resolved.
- Added the appearance focus-versus-selection assertion before changing `AppearanceToggle`; the new assertion required the selected accent treatment and shared `rf-focusable` class.
- After implementation, corrected one test-only DOM locator (`container.firstElementChild?.lastElementChild`) and reran green.

## Implementation

- Added the Account & App route without a profile-row read.
- Added account sections in exact order: Plan & billing, Appearance, Data & privacy.
- Kept `DangerZone` at the bottom in a labelled region; the existing component preserves export-before-delete ordering.
- Changed selected appearance state to `var(--accent-bg)` / `var(--accent-border)` and keyboard focus to `rf-focusable`.
- Deleted `ProfileFormShell.tsx` and updated its final stale comment reference; `rg -n "ProfileFormShell" dashboard` returns no matches.

## Verification

All commands ran from `dashboard` with `NODE_OPTIONS='--max-old-space-size=4096 --no-experimental-webstorage'` where applicable.

- Focused tests: `npx vitest run components/profile/AccountSettings.test.tsx components/theme/AppearanceToggle.test.tsx lib/theme.test.ts` — 3 files, 12 tests passed.
- Typecheck: `npm run typecheck` — passed.
- Lint: `npm run lint` — passed with 9 pre-existing warnings and 0 errors.
- Full suite (single run): `npm test` — 154 files passed, 2 skipped; 1,143 tests passed, 6 skipped.
- `git diff --check` — passed.

## Concerns

None specific to this change. The repository-wide lint warnings remain unchanged and are outside Task 10 scope.
