# Phase 7 implementation report — entry and system states

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `ad6cd42` (`refactor(ui): unify entry and system states`)

## Scope delivered

- Added shared `EntryShell`, `ReadingShell`, `Alert`, `EmptyState`, `LoadingState`, and `ErrorState` components backed by the existing `Card`, `PageHeader`, action, form, token, focus, and reduced-motion contracts.
- Migrated login, signup, reset-password, password-update, onboarding, privacy, terms, and the app error boundary away from page-local geometry. All auth server actions, redirects, URLs, account-enumeration protection, anonymous-filter adoption, session gates, and support/error privacy behavior are unchanged.
- Migrated onboarding fields and actions to `TextArea`, `FormActions`, `Alert`, and the shared upload/picker components while preserving action-state validation and the `completeOnboarding` server action.
- Standardized representative exceptional states: job-list and company-list empty states, job-detail loading/fetch-error states, and the detail render error boundary.
- Added responsive mobile layouts for entry cards, reading surfaces, alerts, actions, and exceptional states. All colors resolve through existing semantic theme tokens.

## TDD evidence

### RED

The initial focused run failed 13 of 14 source/behavior contracts and could not resolve the intentionally absent `SystemStates` module. Failures covered duplicated inline geometry across nine entry surfaces, absent entry/form/status primitives, absent board/secondary state consumers, and absent responsive CSS.

```text
Test Files  2 failed (2)
Tests       13 failed | 1 passed (14)
```

The auth/routing preservation test passed during RED, establishing that presentation work must retain the existing sign-in, sign-up, reset, update-password, and onboarding flows.

### GREEN

```text
npm test -- components/ui/SystemStates.test.tsx \
  app/EntryAndSystemStates.test.tsx \
  components/OnboardingForm.test.tsx \
  app/error.test.tsx \
  components/rolefit/DetailErrorBoundary.test.tsx \
  components/rolefit/JobDetail.test.tsx

Test Files  6 passed (6)
Tests       32 passed (32)
```

## Required verification

```text
NODE_OPTIONS=--localstorage-file=/tmp/rolefit-phase7-localstorage-final \
  npm test -- --maxWorkers=1

Test Files  174 passed | 2 skipped (176)
Tests       1282 passed | 6 skipped (1288)
```

- The first parallel full-suite run found one real regression in the pre-existing reduced-motion selector; splitting the button and loading-indicator declarations restored its contract. Theme/toast failures in the default Node 26 environment were caused by unavailable `localStorage`; the standard backing-file workaround plus one worker avoids cross-worker storage races and passed cleanly.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and the same 9 pre-existing warnings.
- `DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder npm run build`: passed with approved font network access; all routes compiled and all eight static pages generated.
- `git diff --check`: passed.

## Authenticated/unauthenticated browser matrix

Browser work remains controller-owned. Use a separate unauthenticated context for public routes and the existing authenticated context for protected routes.

| Context | Route/state | Required assertions |
| --- | --- | --- |
| Unauthenticated | `/login`, default/error/deleted | shared Rolefit card and fields; danger/success alerts; create/reset/legal/support links; sign-in still reaches `/` |
| Unauthenticated | `/signup`, default/error/sent | invite helper and consent copy; error alert; confirmation status; sign-up action and sign-in/legal/support links unchanged |
| Unauthenticated | `/reset-password`, default/sent | email field and neutral anti-enumeration confirmation; reset link returns to login |
| Unauthenticated | `/reset-password/update` without recovery session | existing redirect to login with the reset-link instruction |
| Authenticated recovery session | `/reset-password/update`, default/error | password requirements, safe error alert, pending action, successful redirect to `/` |
| Authenticated new account | `/onboarding` | wide responsive entry card; résumé upload/extraction, text, locations, instructions, field/form alerts, pending submit; completion reaches the board |
| Authenticated existing profile | `/onboarding` | existing redirect to `/` |
| Either | `/privacy`, `/terms` | readable shared long-form card, working inline links/support, no content or processor/billing statement changes |
| Either | app error boundary | no raw error message; digest reference only; Retry performs refresh plus reset; support mail subject contains digest |
| Authenticated | board/company empty, job loading/fetch/render errors | shared state hierarchy, specific next action where applicable, no layout shift or document overflow |

Capture light/dark screenshots at 1440 and 390 CSS pixels, verify `scrollWidth === clientWidth`, keyboard focus order, 44px standalone actions, and an empty console for every applicable row.

## Concern

Live browser screenshots and interaction measurements are intentionally controller-owned. Code contracts, focused/full tests, typecheck, lint, production build, and diff validation are green; an independent adversarial code-and-browser reviewer must clear the phase before Phase 8.
