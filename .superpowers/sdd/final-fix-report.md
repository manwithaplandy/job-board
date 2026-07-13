# Final review integration fix report

## Scope

Implemented the approved cross-task fixes without schema changes or changes to profile/company version hash semantics:

- scoped profile writes now throw `AccountDeletedError` for tombstoned accounts before opening an RLS transaction;
- every focused action converts write failures to the safe `Changes were not saved` state, while résumé upload still guards before storage;
- blank/missing résumé text remains non-destructive;
- Application Details validates trimmed required name/email, email syntax, and non-empty HTTP(S) URLs before writing;
- section success is visible only while the form is clean;
- successful résumé saves clear the file input and establish the post-clear baseline while retaining submitted text;
- Job Preferences interpretation preview follows live location and guidance values and save/reset baselines;
- profile detail typography meets the approved 16px body/label, 14px help, 32px desktop h1, and 28px mobile h1 minimums; résumé upload status inherits the new surface size without imposing it on the board modal.

## RED evidence

Command:

`cd dashboard && npm test -- lib/profileSettings.test.ts app/actions/profileSettings.test.ts components/profile/ResumeSettingsForm.test.tsx components/profile/JobPreferencesForm.test.tsx components/profile/SettingsPrimitives.test.tsx`

Result: expected failure, 16 failed / 44 passed. The failures directly demonstrated the missing behavior: seven tombstone guards resolved instead of rejecting, six Application Details cases wrote instead of returning field errors, the preview remained tied to saved props, the file baseline/success behavior was absent, and CSS minimum assertions failed.

Files containing new/updated regression tests:

- `dashboard/lib/profileSettings.test.ts`
- `dashboard/app/actions/profileSettings.test.ts`
- `dashboard/components/profile/ResumeSettingsForm.test.tsx`
- `dashboard/components/profile/JobPreferencesForm.test.tsx`
- `dashboard/components/profile/SettingsPrimitives.test.tsx`

## GREEN evidence

Focused command:

`cd dashboard && npm test -- lib/profileSettings.test.ts lib/profileSettings.db.test.ts app/actions/profileSettings.test.ts components/profile/ApplicationDetailsForm.test.tsx components/profile/ResumeSettingsForm.test.tsx components/profile/JobPreferencesForm.test.tsx components/profile/SettingsPrimitives.test.tsx components/LocationPicker.test.tsx`

Result: 7 test files passed, 1 DB test file skipped by its existing environment gate; 65 tests passed, 1 skipped.

Typecheck:

`cd dashboard && npm run typecheck`

Result: passed with exit 0.

Lint:

`cd dashboard && npm run lint`

Result: exit 0 with 9 pre-existing warnings and no errors. Warnings remain in TrendCharts, JobList, configuration files, parseProfile, and theme.script.test; none are in changed files.

Full dashboard suite (run once as specified):

`cd dashboard && NODE_OPTIONS='--max-old-space-size=4096 --no-experimental-webstorage' npm test`

Result: 156 files passed, 2 skipped; 1198 tests passed, 6 skipped.

Production build:

`cd dashboard && DATABASE_URL='postgresql://test:test@localhost:5432/test' npm run build`

The sandboxed attempt failed solely because Next could not reach Google Fonts. The same build was rerun with approved network access and passed: compiled successfully, TypeScript completed, page data collected, 7/7 static pages generated, and all routes finalized.

## Implementation notes

- The scoped guard reuses the repository's `AccountDeletedError` rather than introducing a new error contract.
- Email validation is deterministic and intentionally modest; URL validation accepts only absolute HTTP(S) URLs.
- File controls are serialized from their actual `FileList`, and successful saves replace file baselines with an empty file entry. Non-file values use the submitted snapshot so edits made during an in-flight save remain dirty.
- `LocationPicker` gained an optional selection callback; existing consumers remain unchanged.
- The aggregate onboarding upsert and its deletion behavior were not modified.
- No migrations, dependencies, or schema changes were added.

## Concerns

- Lint continues to report 9 unrelated existing warnings (0 errors).
- The first production-build attempt was blocked by sandbox network access; the approved network-enabled rerun passed.
