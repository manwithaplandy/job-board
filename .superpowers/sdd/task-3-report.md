# Task 3 report: shared section actions and validation contracts

## Outcome

Added a runtime-pure, serializable `SectionSaveState` contract and five focused server actions for the upcoming profile settings sections. The server-action module exports async functions only; the runtime state constant remains in `lib/profileSettingsState.ts`.

## TDD evidence

### RED

After creating `app/actions/profileSettings.test.ts`, ran:

```text
cd dashboard
NODE_OPTIONS=--no-experimental-webstorage npx vitest run app/actions/profileSettings.test.ts
```

Observed exit code 1 with the expected missing-module failure:

```text
Error: Cannot find package '@/lib/profileSettingsState'
Test Files  1 failed (1)
```

No production Task 3 files existed at this point.

### GREEN

After implementing the state and actions, ran:

```text
NODE_OPTIONS=--no-experimental-webstorage npx vitest run app/actions/profileSettings.test.ts lib/profileResume.action.test.ts
```

Observed exit code 0:

```text
Test Files  2 passed (2)
Tests  14 passed (14)
```

The final fresh focused run produced the same 2/2 files and 14/14 tests passing.

## Implemented contracts

- `SectionSaveState` discriminates idle, success (ISO `savedAt`), and field-addressable error states.
- `saveApplicationDetails` owns and normalizes reusable application-answer fields and writes through `updateApplicationDetails`.
- `saveJobPreferences` requires at least one parsed preferred location and makes one atomic `updateJobPreferences` call containing all three owned preferences.
- `saveApplicationPersonalization` independently normalizes résumé and cover-letter instructions and maps length failures to their corresponding fields.
- `saveAdvancedAiSettings` validates every model against the structured catalog, enforces Stage 2 plan entitlement, validates both reasoning-effort fields, and writes through `updateModelPreferences`.
- `saveResumeSettings` authenticates and checks the account tombstone before storage, preserves omitted résumé text/path, validates PDF type and the 5 MiB cap, archives uploaded bytes, and removes a successfully uploaded object if the scoped profile update fails.
- Each action returns a generic safe error for unexpected failures and revalidates `/profile` plus its owned detail route; résumé changes additionally revalidate `/`.

## Test coverage added

- Empty preferred locations and atomic successful job-preferences write.
- Oversized personalization instructions addressed to the correct field.
- Trimmed successful application-details write, including links and tri-state values.
- Invalid model IDs, Standard-plan premium Stage 2 selection, invalid reasoning values, and Pro-only reasoning selections.
- Invalid résumé MIME, oversize résumé, tombstone-before-upload ordering, and upload cleanup after profile update failure.
- Generic safe-error behavior that does not expose internal exception text.

## Verification evidence

Fresh final checks:

```text
npx tsc --noEmit
npx eslint app/actions/profileSettings.ts app/actions/profileSettings.test.ts lib/profileSettingsState.ts
NODE_OPTIONS=--no-experimental-webstorage npx vitest run app/actions/profileSettings.test.ts lib/profileResume.action.test.ts
git diff --check
```

All exited 0. Focused tests: 14 passed.

Full suite (run once after implementation):

```text
NODE_OPTIONS=--no-experimental-webstorage npm test
Test Files  143 passed | 2 skipped (145)
Tests  1098 passed | 6 skipped (1104)
```

## Self-review

- Confirmed no non-async runtime export exists in the `"use server"` module.
- Confirmed validation returns before scoped writes.
- Confirmed Job Preferences uses only the atomic `updateJobPreferences` service.
- Confirmed the deletion guard precedes the profile read and upload.
- Tightened cleanup with an `uploadSucceeded` flag so a failed upload is not treated as a newly archived object.
- Confirmed unexpected errors use `safeErrorMessage("profile.section-save", ...)` with the specified fallback.
- `git diff --check` reports no whitespace errors.

## Concerns

None.
