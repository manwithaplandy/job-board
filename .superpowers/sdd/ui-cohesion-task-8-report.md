# Phase 8 implementation report — accessibility and responsive polish

## Status

`IMPLEMENTED_PENDING_ADVERSARIAL_BROWSER_GATE`

## Scope delivered

- Added `AccessibilityResponsive.contract.test.tsx` to cover live loading status, focus/pressed/disabled action states, 44px shared targets, reduced-motion behavior, board status/error announcements, shared actions, and overflow-safe shared structures.
- Added a polite live loading label to the shared `Button` while keeping the button disabled and `aria-busy` during async work.
- Completed pressed-state feedback for icon buttons and segmented controls; existing shared focus, hover, selected, disabled, and target-size contracts remain authoritative.
- Added a final app-wide `prefers-reduced-motion` override so legacy route-specific transitions and future decorative motion cannot bypass the user preference.
- Migrated the board review CTA, upgrade CTA, upsell CTA, and dismiss action to shared button primitives without changing endpoints, fetch/poll behavior, callbacks, or copy.
- Added polite progress/status announcements and assertive error announcements to review/upsell surfaces; decorative status dots are hidden from assistive technology.
- Added wrapping and shrink contracts for narrow review/upsell cards, shared page-header internals, alerts, long empty/error copy, and horizontally scrollable tabs.

## TDD evidence

### RED

The initial contract failed 5/5 tests for missing live loading status, incomplete action states, absent global reduced-motion coverage, unannounced board statuses/errors with undersized bespoke actions, and missing shared shrink/overflow contracts.

The follow-up narrow-screen contract then failed 1/5 because the review-status card could not wrap its CTA and text.

### GREEN

```text
NODE_OPTIONS=--localstorage-file=/tmp/rolefit-phase8-focused npm test -- \
  [16 focused accessibility/interaction files]

Test Files  16 passed (16)
Tests       96 passed (96)
```

The focused inventory includes shared action/navigation/system-state contracts, AppHeader and AccountMenu keyboard/current-state tests, profile field/error/disclosure tests, model/location combobox tests, analytics tooltip keyboard tests, appearance roving-radio tests, board workspace target/overflow contracts, and review-panel behavior.

## Required verification

```text
NODE_OPTIONS='--max-old-space-size=4096 --localstorage-file=/tmp/rolefit-phase8-full-confirm' \
  npm test -- --maxWorkers=1 --reporter=dot

Test Files  179 passed | 2 skipped (181)
Tests       1299 passed | 6 skipped (1305)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the unchanged 9 warnings.
- `DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder npm run build`: passed with approved font network access; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.

## Controller-owned browser acceptance

The root controller must still run the plan's authenticated/unauthenticated route measurements at 390, 768, 1024, and 1440 CSS pixels and keyboard-only representative workflows in both themes. Required checks include `scrollWidth === clientWidth`, visible focus order, current-navigation state, disclosure state, menu/combobox Escape and arrow behavior, disabled/loading transitions, status/error announcements, 44px standalone targets, reduced-motion emulation, and an empty console.

This implementation report does not claim the Phase 8 adversarial gate is clear.

---

## Adversarial review fixes — live-region boundaries and loading transitions

The independent code gate reported 0 Critical, 2 Important, and 1 Minor findings. The repair addresses the complete list without changing business behavior:

- The idle review card is no longer a live subtree. Remaining-budget and tier-gate text receive narrowly scoped polite status roles, the generic failure remains the sole assertive alert, and the review/billing actions stay outside those regions. The compact progress-only strip remains a status because it has no interactive descendants.
- The upsell container is no longer a live subtree. Only the dynamic notice message is announced; the billing and dismiss actions are siblings outside it.
- `Button` now keeps an empty, visually hidden polite status node mounted whenever a `loadingLabel` is supplied. The node is a sibling after the button, never a descendant of the disabled control, and receives the label only when loading begins. `aria-busy`, disabled state, and the loading accessible name remain on the button.
- The contract test now drives a real idle → click → loading transition. Rendered ReviewNowPanel and UpsellNotice tests verify role boundaries and accessible action names, including that the error alert has no status ancestor.

### Review-fix RED and GREEN

```text
RED:   3 failed files, 4 expected failures, 11 passed tests
GREEN: 4 passed files, 18 passed tests
```

```text
NODE_OPTIONS=--localstorage-file=/tmp/rolefit-phase8-review-focused-2 npm test -- \
  [17 focused accessibility/interaction files]

Test Files  17 passed (17)
Tests       98 passed (98)
```

```text
NODE_OPTIONS='--max-old-space-size=4096 --localstorage-file=/tmp/rolefit-phase8-review-full' \
  npm test -- --maxWorkers=1 --reporter=dot

Test Files  180 passed | 2 skipped (182)
Tests       1301 passed | 6 skipped (1307)
```

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the unchanged 9 warnings.
- `DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder npm run build`: passed with approved font network access; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.

The root controller must still provide the required browser matrix to the independent reviewer; this report does not claim the gate is clear.
