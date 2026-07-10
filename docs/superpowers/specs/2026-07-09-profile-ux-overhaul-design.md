# Profile UX Overhaul Design

**Date:** 2026-07-09

**Status:** Approved design

## Objective

Replace the monolithic Profile form with a task-based settings hub that helps everyday job seekers answer two questions:

1. Does Rolefit understand which jobs I want?
2. Does Rolefit have enough information to produce strong applications?

The first question has slightly greater visual and navigational priority. Technical AI controls remain available to power users but do not appear in the core setup path.

## Context and evidence

The current profile route grew from 232 lines in commit `f5624d3` to 572 lines. It now combines six distinct user jobs in one full-row form and one global save action:

- résumé upload, extraction, and source-text editing;
- job-review focus and avoidance instructions;
- locations and company-discovery preferences;
- reusable application answers and voluntary EEO data;
- résumé and cover-letter writing instructions;
- review/generation models and reasoning effort;
- billing navigation, appearance, and account deletion.

The implementation in `dashboard/app/profile/page.tsx` mirrors database and AI concepts instead of the user's tasks. The opening description calls the page “Advanced settings” even though it contains essential setup. Important matching controls are distributed among résumé, location, instruction, and company fields. Model stages and reasoning effort receive the same visual weight as a user's name and preferred locations.

The page is also difficult to scan and maintain:

- Most internal group labels are styled `div` elements rather than semantic headings or fieldsets.
- A fixed 640px surface contains a long, visually flat sequence of fields and nested muted cards.
- The 22px title, 13px field text, and 11.5px help text make a high-cognitive-load form feel like a dense administration screen.
- Fixed two-column inline grids cannot collapse through normal responsive CSS.
- The sticky save row is not designed for narrow viewports or safe-area insets.
- Help and error content are not consistently associated with fields.
- Location/model listboxes contain buttons inside `role="option"`, and upload progress is not announced as live status.
- The UI exposes an internal profile-version hash in “Last saved.”

The global save boundary creates a product and data-safety problem. Validation in one area can prevent an unrelated edit from saving, errors appear far from their fields, and the aggregate `upsertProfile` contract requires each writer to preserve fields it does not own. Concurrent or stale full-row writes can revert unrelated profile changes.

## Product principles

1. **Organize around user intentions.** Navigation and labels describe job-search tasks, not tables, AI stages, or implementation details.
2. **Show what Rolefit understands.** The hub summarizes saved inputs and exposes concrete missing information. It does not invent an opaque confidence score.
3. **Prioritize matching.** Job Preferences appears first and carries the strongest readiness signal.
4. **Keep application readiness visible.** Résumé, application details, and writing preferences remain first-class destinations.
5. **Hide complexity until requested.** Model IDs, review stages, and reasoning effort live only under Advanced AI Settings.
6. **One task, one save boundary.** A user never risks losing or blocking unrelated changes.
7. **Explain consequences.** Matching-related settings say how and when the board will update.
8. **Preserve nuanced legacy input.** Existing free-text preferences remain visible during any transition toward more structured fields.

## Information architecture

### `/profile`: Profile hub

`/profile` becomes a read-only overview rather than an editable form. It contains:

- A header explaining that Profile controls matching and application preparation.
- A readiness summary based only on explicit required/recommended fields.
- Four primary task cards in this order:
  1. Job Preferences
  2. Résumé & Experience
  3. Application Details
  4. Application Personalization
- Secondary links for Appearance, Plan & Billing, Advanced AI Settings, and Account.

Each primary card contains:

- a status expressed in text, such as `Ready`, `2 items missing`, or `Optional`;
- a maximum two-line summary of current saved information;
- one explicit action such as `Review preferences`, `Review résumé`, or `Finish details`;
- a short sentence explaining what Rolefit does with the information.

The hub contains no editable fields, raw model identifiers, résumé textarea, or destructive action.

### `/profile/job-preferences`: Job Preferences

This is the primary destination and answers “What jobs do you want?”

Sections:

1. **Your target**
   - Target roles
   - Seniority
   - Skills the user wants to use
   - Employment type
2. **Where you want to work**
   - Preferred locations
   - Work style: remote, hybrid, or on-site
3. **Priorities and deal-breakers**
   - Must-haves
   - Roles or skills to avoid
4. **Companies and industries**
   - Preferred and excluded companies, industries, stages, or categories
5. **Interpretation preview**
   - A deterministic, plain-language summary beginning “Rolefit will prioritize…” and, when applicable, “Rolefit will avoid…”

The first implementation may preserve current free-text storage for must-haves, deal-breakers, and company guidance. Introducing structured target roles, seniority, work style, employment type, or compensation requires a separate schema/product decision; the UI must not imply those values are persisted until that data model exists.

Preferred locations remain required because they bound review cost and scope board/metrics queries. If matching changes enqueue or await review, the success state explains when updated matches will appear.

### `/profile/resume`: Résumé & Experience

This destination answers “What experience should Rolefit use?”

The default state shows:

- whether a résumé exists;
- the archived file name when available;
- last-updated time in user-facing language;
- a concise explanation that reviewed résumé text powers matching and application writing.

Actions:

- Upload or replace PDF.
- Review extracted text.
- Edit reviewed text.
- Save résumé.

The large text editor appears only after the user chooses to review/edit. PDF extraction fills the editor but does not silently finalize it. If unsaved hand-edited text would be replaced, the interface requests confirmation. Extraction progress, success, and failure use accessible live status. The PDF remains archival; `resume_text` remains canonical.

The board résumé modal and this page use the same résumé-specific service and validation rules.

### `/profile/application-details`: Application Details

This destination answers “What answers can Rolefit reuse when I apply?”

Sections:

1. Contact information: full name, location, email, phone.
2. Links: LinkedIn, GitHub, portfolio/website.
3. Work eligibility: authorization and sponsorship.
4. Common screening answers: notice period, salary expectation, relocation.
5. Voluntary demographic information: gender, race/ethnicity, veteran status, disability status.

The demographic section is collapsed by default, explicitly optional, and explains that these answers are not used to rank jobs. Its long-term use of free-text fields should be reviewed against the constrained choices used by target application systems. Fields use appropriate `email`, `tel`, and `url` types and autocomplete tokens.

### `/profile/application-personalization`: Application Personalization

This destination answers “How should Rolefit write for me?”

Rename the current generation-instruction concepts:

- `Résumé generation` becomes `Résumé writing preferences`.
- `Cover letter generation` becomes `Cover letter writing preferences`.

The page explains that these defaults apply to every generated document and that per-job instructions on the board layer on top. Examples focus on output goals such as length, tone, emphasis, and use of metrics. Model and reasoning controls do not appear here.

### `/profile/advanced`: Advanced AI Settings

This destination is visually and navigationally subordinate. It contains:

- full job-description review model;
- résumé generation model and reasoning effort;
- cover-letter generation model and reasoning effort;
- company review model;
- a read-only explanation of the always-on first-stage gate.

Default labels avoid “cheap” as a user-facing quality category. Plan entitlements remain visible, save-time validation remains authoritative, and generation-time clamping remains the fallback after a downgrade.

### `/profile/account`: Account & App

This destination contains:

- plan and billing link;
- appearance preference;
- data/privacy actions;
- account deletion in an isolated danger section at the bottom.

Appearance remains device-local and does not share a database save action. Account deletion never appears next to career or AI controls.

## Navigation and layout

A shared `dashboard/app/profile/layout.tsx` should own authentication, `SlimHeader`, common settings navigation, content width, and responsive structure.

Desktop hub:

- 1040–1120px maximum content width;
- concise header and readiness summary;
- two-column primary-card grid.

Mobile hub:

- one-column cards;
- at least 16px page gutters;
- no horizontal scrolling at 320px.

Detail pages:

- back link or breadcrumb to Profile;
- 32–36px desktop `h1`, 28px minimum mobile `h1`;
- one explanatory sentence and optional semantic status;
- one primary surface divided by whitespace, headings, and fieldsets rather than nested cards;
- 16px body and label text, 14px help text;
- two columns only for naturally paired fields, collapsing below 720px;
- 44px minimum interactive targets.

Hanken Grotesk and the existing theme tokens remain. The visual refresh uses stronger hierarchy, less nested gray chrome, and one restrained Rolefit-blue accent. Selected, focused, error, success, and disabled states remain distinct in both themes.

## Form behavior

Each detail page owns one or more tightly related section forms. A reusable `SectionFormShell` provides:

- dirty-state tracking without interval polling;
- Save disabled while pristine or pending;
- a scoped Cancel/Reset action;
- inline success status that resets the pristine snapshot;
- field errors plus a linked error summary;
- focus on the first invalid field;
- `aria-invalid` and `aria-describedby` wiring;
- an unsaved-navigation warning for browser and in-app navigation;
- a responsive action bar with `env(safe-area-inset-bottom)` support.

Successful settings saves remain on the page and announce `Changes saved`. A redirect occurs only for an explicit, validated internal `return_to` workflow. Server failures state that changes were not saved and preserve all entered values.

Upload progress uses polite live status; validation and failure use appropriate alert semantics. Comboboxes use one valid ARIA combobox/listbox pattern, accurately expose expanded and empty states, announce results, and contain no nested interactive elements inside options.

## Persistence and service boundaries

Splitting the routes must not create more full-row writers. Introduce column-scoped services before routing each section to its own page:

- `updateResumeSource(userId, { resumeText, resumeFilePath })`
- `updateReviewPreferences(userId, { instructions })`
- `updateDiscoveryPreferences(userId, { preferredLocations, companyInstructions })`
- `updateApplicationDetails(userId, applicationDetails)`
- `updateGenerationDefaults(userId, generationDefaults)`
- `updateModelPreferences(userId, modelPreferences)`

These functions issue updates only for fields they own. They do not read a row and feed unrelated fields back into an aggregate upsert.

Version rules remain exact:

- Changes to résumé text or reviewer instructions recompute `profile_version` using the existing SHA-256 contract over `resume + NUL + instructions`.
- Changes to company guidance recompute `company_profile_version` using its existing contract.
- Locations, application details, generation defaults, models, and reasoning effort do not affect either version unless a separately approved product change alters those semantics.

Keep aggregate creation only for onboarding until it can be renamed or constrained as creation-only. JSONB reads for links and screening answers continue through total parsers. Résumé upload actions call `assertNotDeleted` before storage writes, not merely before the database update.

## Data flow

### Hub read

1. Authenticate the viewer.
2. Read the profile once.
3. Derive explicit completeness/status summaries from persisted values.
4. Render links and summaries without loading the model catalog or distinct-location list.

### Section save

1. Authenticate and perform tombstone/entitlement checks appropriate to the section.
2. Parse and validate only the submitted section.
3. Return field-addressable validation errors without writing.
4. Execute a column-scoped update.
5. Recompute only the required version hash.
6. Return saved values/status to the mounted page.
7. Refresh the hub summary through normal server revalidation.

### Résumé upload

1. Validate type and size in the client and extraction endpoint.
2. Extract text into a reviewable draft.
3. Preserve or confirm replacement of existing edited text.
4. On save, assert the account is not deleted before uploading archival bytes.
5. Persist archival path and reviewed text through the résumé service.
6. Recompute `profile_version`.

## Error and edge-case policy

- Preserve existing nuanced free text when structured fields are introduced; never silently discard or reinterpret it.
- Show warnings for contradictory preferences rather than silently choosing one.
- Treat onboarding completion and matching readiness as different states.
- Preserve saved locations that temporarily have zero open jobs; explain whether new custom locations can be added.
- Version or clearly label results produced from older preferences when a review is queued or running.
- A plan downgrade must not make ordinary profile sections unsaveable; Advanced AI Settings shows the effective fallback.
- Extraction failures, image-only PDFs, oversized files, duplicate names, and partial extraction receive explicit recovery paths.
- If archival upload succeeds but the profile update fails, clean up or clearly reconcile the orphaned upload.
- Sensitive demographic data requires consistent export and deletion behavior.
- The first release supports one unified target profile. Named multi-track preference profiles are out of scope.

## Component boundaries

Shared components should follow existing repository conventions while replacing profile-specific inline-style duplication:

- `SettingsLayout`: shared page frame and responsive navigation.
- `SettingsHub`: composes readiness summary and task cards.
- `SettingsSectionCard`: status, summary, explanation, and action.
- `SectionFormShell`: dirty, pending, success, error, and navigation behavior.
- `FormSection`: semantic heading/fieldset composition.
- `Field`: label, description, control, and error association.
- `StickyActions`: responsive Save/Cancel/status region.
- `ResumeSourceForm`
- `JobPreferencesForm`
- `ApplicationDetailsForm`
- `GenerationDefaultsForm`
- `ModelPreferencesForm`

Reuse and improve `ResumeUploadField`, `LocationPicker`, `ModelPicker`, `ReasoningEffortSelect`, `AppearanceToggle`, and `DangerZone` rather than creating duplicate versions.

## Delivery phases

### Phase 0: Characterize existing behavior

Add tests for:

- required locations;
- safe `return_to`, including protocol-relative and backslash forms;
- model-catalog validation;
- Stage 2 and reasoning-effort entitlements;
- tri-state parsing;
- generation-instruction normalization;
- upload and tombstone failure behavior;
- exact profile/company version inputs;
- JSONB total parsing;
- dirty, file, hidden-picker, pending, and failed-save behavior.

### Phase 1: Introduce scoped services

- Add typed section inputs and column-scoped queries.
- Route the board résumé modal through the résumé service.
- Add concurrency tests proving that saving one section cannot revert another.
- Preserve tombstone checks before storage and fail-closed database behavior.

### Phase 2: Establish the shared settings system

- Add shared layout, card, field, section, and action components.
- Extract current page groups behind those boundaries without changing persisted behavior.
- Add semantic, responsive, keyboard, and accessibility coverage.

### Phase 3: Launch the hub and Application Details

- Convert `/profile` to the read-only hub.
- Move Application Details first because it has no catalog/location dependency and does not affect version hashes.
- Preserve existing navigation and valid return-to behavior.

### Phase 4: Move Job Preferences

- Move required locations, reviewer guidance, and company guidance.
- Verify board/metrics location scoping, review invalidation, company invalidation, and cached location options.
- Add the deterministic interpretation preview.

### Phase 5: Move personalization and advanced settings

- Move standing résumé and cover-letter guidance to Application Personalization.
- Move all model/reasoning controls to Advanced AI Settings.
- Verify Standard and Pro rendering, save validation, default models, and downgrade clamping.

### Phase 6: Move Résumé & Experience

- Unify the page and board modal on the scoped résumé service.
- Exercise upload, extraction, editing, archival storage, profile-version invalidation, stale-result behavior, and text-based generation end to end.

### Phase 7: Move Account and remove legacy editing

- Move appearance, billing, privacy, and deletion.
- Remove the aggregate edit action only after all writers use scoped services.
- Restrict or rename `upsertProfile` so it communicates its creation/onboarding contract.

## Testing strategy

Unit tests:

- completeness/status derivation;
- section parsers and field-error mapping;
- scoped query payloads;
- exact version-hash semantics;
- preference-preview formatting;
- entitlement behavior;
- safe internal redirects.

Component tests:

- semantic headings and fieldsets;
- label/description/error association;
- dirty, reset, pending, success, and failure states;
- upload announcements and overwrite confirmation;
- combobox keyboard behavior and empty states;
- responsive class behavior and action-bar composition.

Integration tests:

- concurrent section saves do not revert unrelated fields;
- location saves affect the correct board and metrics queries;
- reviewer/company guidance invalidates only the correct version;
- JSONB application details round-trip through total parsers;
- Standard/Pro choices enforce the same save-time rules as today.

End-to-end tests:

- complete core setup without entering Advanced AI Settings;
- edit preferences and observe the correct saved summary/update expectation;
- upload, extract, review, edit, and save a résumé;
- edit the résumé from the board and observe the same data on the settings page;
- recover from section validation, server, extraction, and upload failures;
- exercise keyboard-only navigation, 200% zoom, light/dark themes, and mobile widths.

## Acceptance criteria

- The hub presents four primary task destinations and contains no editable field, model identifier, raw résumé editor, or destructive action.
- A user can complete matching and application setup without visiting Advanced AI Settings.
- Job Preferences has the highest visual priority and presents a deterministic summary of Rolefit's interpretation.
- Every detail page has exactly one `h1`; logical groups use ordered headings and/or fieldset/legend semantics.
- Every control has a programmatic name; descriptions and errors are connected through `aria-describedby`; invalid fields expose `aria-invalid`.
- Save, upload, and extraction status are announced; focus moves to the first invalid field after failed validation.
- Save is disabled while pristine and pending, and successful saves reset the dirty snapshot without requiring a redirect.
- All interactive targets are at least 44×44 CSS pixels.
- No horizontal scrolling occurs at 320, 375, 768, 1024, or 1440px; paired fields collapse at or below 720px.
- Sticky actions do not obscure content, wrap at 320px, and support mobile safe-area insets.
- Normal text meets 4.5:1 contrast; UI boundaries, focus indicators, and large text meet 3:1 in both themes.
- Keyboard-only operation, 200% zoom, light mode, and dark mode pass manual verification.
- Automated accessibility tests report zero critical or serious issues on the hub and every detail page.
- Concurrent section saves cannot revert unrelated profile fields.
- Résumé/reviewer changes preserve exact `profile_version` behavior; company guidance preserves exact `company_profile_version` behavior.
- The board modal and Résumé & Experience page share one résumé-specific write service.

## Out of scope

- Named profiles for multiple simultaneous career tracks.
- Replacing the current matching algorithm.
- Changing model providers or entitlement tiers.
- Using an AI-generated confidence score for readiness.
- Redesigning the board, analytics, companies, billing, or onboarding beyond navigation/copy required to integrate the new Profile structure.
