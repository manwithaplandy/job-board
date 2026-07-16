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

## Review fix: cleanup error observability

### Finding addressed

The résumé rollback path awaited `storage.remove([path])` but did not inspect a resolved
`{ error }` result. Supabase can report removal failure this way without rejecting, so
the action could silently leave an orphaned archival PDF after the profile update failed.

### RED

Added a regression where upload succeeds, `updateResumeSource` rejects with an internal
database error, and `remove` resolves with `{ error: new Error("storage host secret") }`.
The test requires both the cleanup error and original database error to be observed via
their safe-error contexts, while the returned state remains the generic original save
failure.

Ran:

```text
cd dashboard
NODE_OPTIONS=--no-experimental-webstorage npx vitest run app/actions/profileSettings.test.ts
```

Observed exit code 1:

```text
Test Files  1 failed (1)
Tests  1 failed | 11 passed (12)
expected console.error to be called with [profile.resume-cleanup]
Received only [profile.section-save] with the original DB error
```

### GREEN and implementation

The rollback now explicitly destructures the removal result and routes a resolved cleanup
error through `safeErrorMessage("profile.resume-cleanup", cleanupError)`. A rejected removal
promise uses the same observability path. In either case, cleanup failure does not replace
the original database failure returned through `failure(error)`, and neither internal error
is exposed to the user.

Also strengthened the invalid résumé tests to prove `createClient`, upload, and profile
update are not called, and changed the tombstone test to reject the guard and prove no
storage client, upload, or profile update occurs.

Ran the fresh verification chain:

```text
NODE_OPTIONS=--no-experimental-webstorage npx vitest run app/actions/profileSettings.test.ts
npx tsc --noEmit
npx eslint app/actions/profileSettings.ts app/actions/profileSettings.test.ts lib/profileSettingsState.ts
git diff --check
```

All commands exited 0. Focused result:

```text
Test Files  1 passed (1)
Tests  12 passed (12)
```
