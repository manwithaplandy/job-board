# Task 8 Report: Application Personalization and Advanced AI Settings

## Status

Implemented and verified.

## Changes

- Added Application Personalization route and form with separate résumé and cover-letter writing defaults.
- Kept personalization copy free of model, stage, gate, and reasoning terminology.
- Added Advanced AI Settings route and plan-aware form for all existing model and reasoning controls.
- Presented Stage 1 as read-only Rolefit-default behavior and removed user-facing internal gate terminology.
- Repaired ModelPicker combobox expansion, empty-result live status, option semantics, hidden-input dirty events, and server-error ARIA wiring.
- Corrected advanced settings revalidation to `/profile/advanced`.

## Verification

- Focused tests: 6 files, 43 tests passed.
- Typecheck: passed (`tsc --noEmit`).
- Lint: passed with 0 errors and 9 pre-existing warnings in unrelated files.
- Full dashboard suite: 152 files passed, 2 skipped; 1,130 tests passed, 6 skipped.
- Full suite used `NODE_OPTIONS='--max-old-space-size=4096 --no-experimental-webstorage'` because Node 26's experimental global web storage shadows jsdom localStorage.

## Concerns

- None specific to this change.

## Review Follow-up: Clear Model Dirty Event

- RED: Added a regression test starting from `openai/example`; clearing emptied the hidden field but failed because the form received 0 input events instead of 1.
- GREEN: Routed option selection and clearing through a shared `commitSelection` helper. The hidden field now receives the new value and dispatches exactly one bubbling input event for either user action, with no event on mount.
- Focused follow-up tests: ModelPicker, AdvancedAiForm, and shared settings primitives — 3 files, 17 tests passed.
