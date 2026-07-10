# Profile UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic Profile form with a task-based settings hub and focused, independently saved settings pages for everyday job seekers.

**Architecture:** `/profile` becomes a read-only hub backed by pure readiness derivation. Focused subroutes use shared settings primitives and section-scoped server actions. Column-scoped profile update services land first so no subroute can overwrite fields it does not own; the existing aggregate upsert remains creation-only until the legacy page action is removed.

**Tech Stack:** Next.js 16 App Router, React 19 server/client components, TypeScript 6, postgres.js transactions with RLS, Supabase Storage, Vitest 4, Testing Library, plain CSS with existing Rolefit theme tokens.

## Global Constraints

- The primary audience is everyday job seekers; Job Preferences has slightly greater priority than application preparation.
- Core setup must be completable without visiting Advanced AI Settings.
- `/profile` is a read-only hub with no editable fields, raw model identifiers, résumé textarea, or destructive action.
- Preserve `profile_version = sha256((resume_text ?? "") + "\0" + (instructions ?? ""))` exactly.
- Preserve `company_profile_version = sha256(company_instructions ?? "")` exactly.
- Locations, application details, generation defaults, model choices, and reasoning effort must not change either version.
- `resume_text` remains canonical; uploaded PDFs remain archival only.
- JSONB reads continue through total parsers; never cast database JSONB directly to an application type.
- Resume upload flows must call `assertNotDeleted` before any storage write.
- No database migration is required. `axe-core` is the only new development dependency and is used only for automated accessibility checks.
- Do not imply that target role, seniority, work style, employment type, or salary preferences are persisted; those require a separately approved data-model change.
- Interactive targets are at least 44×44 CSS pixels; paired fields collapse at or below 720px; no horizontal scroll at 320px.
- Normal text contrast is at least 4.5:1 and UI/focus contrast is at least 3:1 in light and dark themes.

---

## File map

### Data and actions

- Create `dashboard/lib/profileSettings.ts`: typed section payloads and column-scoped transactional updates.
- Create `dashboard/lib/profileSettings.test.ts`: tombstone and transaction-boundary unit tests.
- Create `dashboard/lib/profileSettings.db.test.ts`: optional real-Postgres column-preservation/version tests.
- Create `dashboard/lib/profileReadiness.ts`: pure hub status/summary derivation.
- Create `dashboard/lib/profileReadiness.test.ts`: readiness and summary tests.
- Create `dashboard/lib/profileSettingsState.ts`: serializable shared action-state contract and initial value.
- Create `dashboard/app/actions/profileSettings.ts`: section-scoped server actions.
- Create `dashboard/app/actions/profileSettings.test.ts`: action parsing, validation, entitlement, upload, and failure tests.
- Modify `dashboard/app/actions/profile.ts`: route the board modal through `updateResumeSource`.
- Modify `dashboard/lib/profileResume.action.test.ts`: assert the scoped résumé service contract.

### Shared settings UI

- Modify `dashboard/package.json` and `dashboard/package-lock.json`: add the test-only `axe-core` dependency.
- Create `dashboard/app/profile/profile-settings.css`: responsive hub/detail/form styles.
- Create `dashboard/app/profile/layout.tsx`: authenticated shared profile frame and slim header.
- Create `dashboard/components/profile/SettingsNav.tsx`: profile-section navigation.
- Create `dashboard/components/profile/SettingsSectionCard.tsx`: hub card.
- Create `dashboard/components/profile/SectionFormShell.tsx`: local dirty/save/error/success behavior.
- Create `dashboard/components/profile/Field.tsx`: label, description, and field error semantics.
- Create `dashboard/components/profile/SettingsPrimitives.test.tsx`: shared component behavior.

### Hub and detail routes

- Replace `dashboard/app/profile/page.tsx`: read-only Profile hub.
- Create `dashboard/components/profile/ProfileHub.tsx` and test.
- Create `dashboard/app/profile/application-details/page.tsx`.
- Create `dashboard/components/profile/ApplicationDetailsForm.tsx` and test.
- Create `dashboard/app/profile/job-preferences/page.tsx`.
- Create `dashboard/components/profile/JobPreferencesForm.tsx` and test.
- Create `dashboard/app/profile/application-personalization/page.tsx`.
- Create `dashboard/components/profile/ApplicationPersonalizationForm.tsx` and test.
- Create `dashboard/app/profile/advanced/page.tsx`.
- Create `dashboard/components/profile/AdvancedAiForm.tsx` and test.
- Create `dashboard/app/profile/resume/page.tsx`.
- Create `dashboard/components/profile/ResumeSettingsForm.tsx` and test.
- Create `dashboard/app/profile/account/page.tsx`.
- Create `dashboard/components/profile/AccountSettings.tsx` and test.

### Existing controls and final coverage

- Modify `dashboard/components/LocationPicker.tsx` and add `dashboard/components/LocationPicker.test.tsx`.
- Modify `dashboard/components/ModelPicker.tsx` and add `dashboard/components/ModelPicker.test.tsx`.
- Modify `dashboard/components/rolefit/ResumeUploadField.tsx` and its consuming tests.
- Delete `dashboard/components/ProfileFormShell.tsx` after every route uses `SectionFormShell`.
- Create `dashboard/app/profile/profileRoutes.test.tsx`: route-level semantics and primary-navigation coverage.

---

### Task 1: Add column-scoped profile update services

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/package-lock.json`
- Create: `dashboard/lib/profileSettings.ts`
- Create: `dashboard/lib/profileSettings.test.ts`
- Create: `dashboard/lib/profileSettings.db.test.ts`
- Modify: `dashboard/lib/queries.upsertProfile.test.ts`

**Interfaces:**
- Consumes: `withUserSql`, `profileVersion`, `companyProfileVersion`, `isAccountDeleted`, `ApplicationAnswers`.
- Produces: `updateResumeSource`, atomic `updateJobPreferences`, `updateReviewPreferences`, `updateDiscoveryPreferences`, `updateApplicationDetails`, `updateGenerationDefaults`, `updateModelPreferences` plus executor-taking `*With` variants for integration tests.

- [ ] **Step 1: Write unit tests that require scoped update entry points and the tombstone guard**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(async (_userId: string, _fn: (tx: unknown) => Promise<unknown>) => undefined),
  isAccountDeleted: vi.fn(async () => false),
}));

vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: mocks.isAccountDeleted }));

const settings = await import("@/lib/profileSettings");

describe("profile settings write boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  test("a tombstoned account performs no transaction", async () => {
    mocks.isAccountDeleted.mockResolvedValueOnce(true);
    await settings.updateDiscoveryPreferences("u1", {
      preferredLocations: ["Remote"], companyInstructions: null,
    });
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });

  test.each([
    ["updateResumeSource", { resumeText: "r", resumeFilePath: null }],
    ["updateReviewPreferences", { instructions: "backend" }],
    ["updateJobPreferences", { preferredLocations: ["Remote"], instructions: "backend", companyInstructions: null }],
    ["updateDiscoveryPreferences", { preferredLocations: ["Remote"], companyInstructions: null }],
    ["updateApplicationDetails", {
      full_name: null, email: null, phone: null, location: null, links: {},
      work_authorized: null, needs_sponsorship: null, eeo_gender: null,
      eeo_race: null, eeo_veteran: null, eeo_disability: null,
      screening_answers: {},
    }],
    ["updateGenerationDefaults", {
      resumeGenerationInstructions: null, coverLetterGenerationInstructions: null,
    }],
    ["updateModelPreferences", {
      modelStage2: null, modelResume: null, modelCompany: null, modelCover: null,
      reasoningEffortResume: null, reasoningEffortCover: null,
    }],
  ] as const)("%s uses one RLS transaction", async (name, input) => {
    await (settings[name] as (u: string, d: typeof input) => Promise<void>)("u1", input);
    expect(mocks.withUserSql).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the unit test and confirm it fails because the module is missing**

Run: `cd dashboard && npx vitest run lib/profileSettings.test.ts`

Expected: FAIL with `Failed to resolve import "@/lib/profileSettings"`.

- [ ] **Step 3: Implement typed, column-scoped transactional writes**

Create `dashboard/lib/profileSettings.ts` with these public payloads and functions. The executor-taking functions are the authoritative SQL; wrappers provide the deletion guard and RLS transaction.

```ts
import type { TransactionSql } from "postgres";
import { withUserSql } from "@/lib/db";
import { isAccountDeleted } from "@/lib/tombstone";
import { profileVersion } from "@/lib/profileVersion";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import type { ApplicationAnswers } from "@/lib/types";

export interface ResumeSourceInput {
  resumeText: string | null;
  resumeFilePath: string | null;
}
export interface DiscoveryPreferencesInput {
  preferredLocations: string[];
  companyInstructions: string | null;
}
export interface JobPreferencesInput extends DiscoveryPreferencesInput {
  instructions: string | null;
}
export interface GenerationDefaultsInput {
  resumeGenerationInstructions: string | null;
  coverLetterGenerationInstructions: string | null;
}
export interface ModelPreferencesInput {
  modelStage2: string | null;
  modelResume: string | null;
  modelCompany: string | null;
  modelCover: string | null;
  reasoningEffortResume: string | null;
  reasoningEffortCover: string | null;
}

export async function updateResumeSourceWith(
  tx: TransactionSql, userId: string, input: ResumeSourceInput,
): Promise<void> {
  const rows = await tx`SELECT instructions FROM profiles
    WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const instructions = (rows[0] as { instructions: string | null } | undefined)?.instructions ?? null;
  await tx`UPDATE profiles SET
    resume_text = ${input.resumeText},
    resume_file_path = ${input.resumeFilePath},
    profile_version = ${profileVersion(input.resumeText, instructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateReviewPreferencesWith(
  tx: TransactionSql, userId: string, instructions: string | null,
): Promise<void> {
  const rows = await tx`SELECT resume_text FROM profiles
    WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const resumeText = (rows[0] as { resume_text: string | null } | undefined)?.resume_text ?? null;
  await tx`UPDATE profiles SET
    instructions = ${instructions},
    profile_version = ${profileVersion(resumeText, instructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateDiscoveryPreferencesWith(
  tx: TransactionSql, userId: string, input: DiscoveryPreferencesInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    preferred_locations = ${input.preferredLocations},
    company_instructions = ${input.companyInstructions},
    company_profile_version = ${companyProfileVersion(input.companyInstructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateApplicationDetailsWith(
  tx: TransactionSql, userId: string, input: ApplicationAnswers,
): Promise<void> {
  await tx`UPDATE profiles SET
    full_name = ${input.full_name}, email = ${input.email}, phone = ${input.phone},
    location = ${input.location}, links = ${JSON.stringify(input.links)}::jsonb,
    work_authorized = ${input.work_authorized}, needs_sponsorship = ${input.needs_sponsorship},
    eeo_gender = ${input.eeo_gender}, eeo_race = ${input.eeo_race},
    eeo_veteran = ${input.eeo_veteran}, eeo_disability = ${input.eeo_disability},
    screening_answers = ${JSON.stringify(input.screening_answers)}::jsonb,
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateGenerationDefaultsWith(
  tx: TransactionSql, userId: string, input: GenerationDefaultsInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    resume_generation_instructions = ${input.resumeGenerationInstructions},
    cover_letter_generation_instructions = ${input.coverLetterGenerationInstructions},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateModelPreferencesWith(
  tx: TransactionSql, userId: string, input: ModelPreferencesInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    model_stage1 = NULL, model_stage2 = ${input.modelStage2},
    model_resume = ${input.modelResume}, model_company = ${input.modelCompany},
    model_cover = ${input.modelCover},
    reasoning_effort_resume = ${input.reasoningEffortResume},
    reasoning_effort_cover = ${input.reasoningEffortCover},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

async function guarded(
  userId: string,
  write: (tx: TransactionSql) => Promise<void>,
): Promise<void> {
  if (await isAccountDeleted(userId)) return;
  await withUserSql(userId, write);
}

export const updateResumeSource = (u: string, d: ResumeSourceInput) =>
  guarded(u, (tx) => updateResumeSourceWith(tx, u, d));
export const updateReviewPreferences = (u: string, d: { instructions: string | null }) =>
  guarded(u, (tx) => updateReviewPreferencesWith(tx, u, d.instructions));
export const updateDiscoveryPreferences = (u: string, d: DiscoveryPreferencesInput) =>
  guarded(u, (tx) => updateDiscoveryPreferencesWith(tx, u, d));
export const updateJobPreferences = (u: string, d: JobPreferencesInput) =>
  guarded(u, async (tx) => {
    await updateReviewPreferencesWith(tx, u, d.instructions);
    await updateDiscoveryPreferencesWith(tx, u, d);
  });
export const updateApplicationDetails = (u: string, d: ApplicationAnswers) =>
  guarded(u, (tx) => updateApplicationDetailsWith(tx, u, d));
export const updateGenerationDefaults = (u: string, d: GenerationDefaultsInput) =>
  guarded(u, (tx) => updateGenerationDefaultsWith(tx, u, d));
export const updateModelPreferences = (u: string, d: ModelPreferencesInput) =>
  guarded(u, (tx) => updateModelPreferencesWith(tx, u, d));
```

- [ ] **Step 4: Add a real-Postgres preservation/version regression test**

Create `dashboard/lib/profileSettings.db.test.ts`, gated by `TEST_DATABASE_URL`, following `queries.locationScoping.db.test.ts`. Create a temporary `profiles` table with every column referenced above, seed one row, call `updateApplicationDetailsWith`, `updateDiscoveryPreferencesWith`, `updateReviewPreferencesWith`, and `updateResumeSourceWith`, then assert:

```ts
expect(row.preferred_locations).toEqual(["Remote"]);
expect(row.full_name).toBe("Jane Doe");
expect(row.resume_text).toBe("new résumé");
expect(row.instructions).toBe("backend only");
expect(row.profile_version).toBe(profileVersion("new résumé", "backend only"));
expect(row.company_profile_version).toBe(companyProfileVersion("avoid defense"));
expect(row.model_resume).toBe("keep-me");
```

The test must invoke the executor-taking functions directly inside `sql.begin`, so it exercises real SQL without depending on authenticated-role grants for temporary tables.

- [ ] **Step 5: Run scoped service tests**

Run: `cd dashboard && npx vitest run lib/profileSettings.test.ts lib/profileSettings.db.test.ts lib/queries.upsertProfile.test.ts`

Expected: PASS; the database suite reports skipped when `TEST_DATABASE_URL` is unset.

- [ ] **Step 6: Commit the scoped write boundary**

```bash
git add dashboard/lib/profileSettings.ts dashboard/lib/profileSettings.test.ts dashboard/lib/profileSettings.db.test.ts dashboard/lib/queries.upsertProfile.test.ts
git commit -m "refactor(profile): add section-scoped update services"
```

---

### Task 2: Move the board résumé modal to the scoped service

**Files:**
- Modify: `dashboard/app/actions/profile.ts`
- Modify: `dashboard/lib/profileResume.action.test.ts`

**Interfaces:**
- Consumes: `updateResumeSource(userId, { resumeText, resumeFilePath })` from Task 1.
- Produces: the unchanged `saveProfileResume(formData): Promise<void>` public action used by the board modal.

- [ ] **Step 1: Change the action test to require the scoped service and forbid aggregate writes**

Replace the `getProfile`/`upsertProfile` mocks with:

```ts
const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(async () => "u1"),
  getProfile: vi.fn(),
  updateResumeSource: vi.fn(async () => {}),
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  assertNotDeleted: vi.fn(async () => {}),
}));

vi.mock("@/lib/profileSettings", () => ({
  updateResumeSource: mocks.updateResumeSource,
}));
```

Change assertions to:

```ts
expect(mocks.updateResumeSource).toHaveBeenCalledWith("u1", {
  resumeText: "BRAND NEW PASTED TEXT",
  resumeFilePath: "u1/old.pdf",
});
```

- [ ] **Step 2: Run the action test and verify it fails against the aggregate writer**

Run: `cd dashboard && npx vitest run lib/profileResume.action.test.ts`

Expected: FAIL because `saveProfileResume` still calls `upsertProfile`.

- [ ] **Step 3: Replace the aggregate write with the scoped update**

Keep the existing `getProfile` read only to preserve blank-text and archived-path behavior, keep `assertNotDeleted` before storage, and replace the final `upsertProfile` payload with:

```ts
await updateResumeSource(userId, { resumeText, resumeFilePath });
revalidatePath("/");
revalidatePath("/profile");
revalidatePath("/profile/resume");
```

Remove the `upsertProfile` import and retain `getProfile`.

- [ ] **Step 4: Run action and profile-version tests**

Run: `cd dashboard && npx vitest run lib/profileResume.action.test.ts lib/profileVersion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the board-modal migration**

```bash
git add dashboard/app/actions/profile.ts dashboard/lib/profileResume.action.test.ts
git commit -m "refactor(profile): scope board resume saves"
```

---

### Task 3: Add shared section actions and validation contracts

**Files:**
- Create: `dashboard/lib/profileSettingsState.ts`
- Create: `dashboard/app/actions/profileSettings.ts`
- Create: `dashboard/app/actions/profileSettings.test.ts`

**Interfaces:**
- Consumes: scoped update functions from Task 1, existing auth, entitlement, normalization, location, storage, and safe-error helpers.
- Produces: `SectionSaveState`, `INITIAL_SECTION_SAVE_STATE`, `saveApplicationDetails`, `saveJobPreferences`, `saveApplicationPersonalization`, `saveAdvancedAiSettings`, `saveResumeSettings`.

- [ ] **Step 1: Write action tests for success and field-addressable validation**

Use hoisted mocks for auth, profile reads, structured models, plan, Supabase storage, and every scoped service. Cover these exact cases:

```ts
expect(await saveJobPreferences(INITIAL_SECTION_SAVE_STATE, form({
  preferred_locations: "[]",
}))).toEqual({
  status: "error",
  message: "Check the highlighted fields.",
  fieldErrors: { preferred_locations: "Pick at least one location." },
});

expect(await saveApplicationPersonalization(INITIAL_SECTION_SAVE_STATE, form({
  resume_generation_instructions: "x".repeat(4001),
}))).toMatchObject({
  status: "error",
  fieldErrors: { resume_generation_instructions: expect.stringContaining("max 4000") },
});

expect(await saveApplicationDetails(INITIAL_SECTION_SAVE_STATE, form({
  full_name: " Jane Doe ", email: " jane@example.com ",
}))).toMatchObject({ status: "success" });

expect(mocks.updateApplicationDetails).toHaveBeenCalledWith("u1", expect.objectContaining({
  full_name: "Jane Doe", email: "jane@example.com",
}));
```

Also test invalid model IDs, Standard-plan premium choices, reasoning effort, invalid résumé MIME/size, `assertNotDeleted` before upload, upload cleanup after update failure, and generic safe errors.

- [ ] **Step 2: Run action tests and confirm the module is missing**

Run: `cd dashboard && npx vitest run app/actions/profileSettings.test.ts`

Expected: FAIL with a missing-module error.

- [ ] **Step 3: Implement the common state in a runtime-pure module and add private action helpers**

Create `dashboard/lib/profileSettingsState.ts`:

```ts
export type SectionSaveState =
  | { status: "idle" }
  | { status: "success"; savedAt: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

export const INITIAL_SECTION_SAVE_STATE: SectionSaveState = { status: "idle" };
```

Start `dashboard/app/actions/profileSettings.ts` with `"use server";`, import the state type, and keep all runtime exports in this file async server actions. Add these unexported helpers:

```ts
"use server";

import type { SectionSaveState } from "@/lib/profileSettingsState";

const text = (fd: FormData, key: string): string | null =>
  String(fd.get(key) ?? "").trim() || null;
const triState = (fd: FormData, key: string): boolean | null => {
  const value = String(fd.get(key) ?? "");
  return value === "yes" ? true : value === "no" ? false : null;
};
const success = (): SectionSaveState => ({
  status: "success", savedAt: new Date().toISOString(),
});
const invalid = (fieldErrors: Record<string, string>): SectionSaveState => ({
  status: "error", message: "Check the highlighted fields.", fieldErrors,
});
```

- [ ] **Step 4: Implement the four non-upload actions**

Each action authenticates, parses only its owned fields, returns field errors before writing, calls one scoped service, revalidates `/profile` and its detail route, and returns `success()`.

`saveJobPreferences` maps all fields into one atomic service call:

```ts
const preferredLocations = parsePreferredLocations(String(fd.get("preferred_locations") ?? ""));
if (!preferredLocations.length) return invalid({ preferred_locations: "Pick at least one location." });
await updateJobPreferences(userId, {
  preferredLocations,
  instructions: text(fd, "instructions"),
  companyInstructions: text(fd, "company_instructions"),
});
```

`saveApplicationDetails` builds an `ApplicationAnswers` object from the existing field names and calls `updateApplicationDetails`.

`saveApplicationPersonalization` calls `normalizeInstructions` for both instruction fields, maps each failure to its own key, then calls `updateGenerationDefaults`.

`saveAdvancedAiSettings` repeats the existing catalog, plan, Stage 2 entitlement, and reasoning-effort validation from the legacy page action, then calls `updateModelPreferences`.

Wrap each action in `try/catch` and return:

```ts
return {
  status: "error",
  message: safeErrorMessage("profile.section-save", error, "Changes were not saved. Please try again."),
  fieldErrors: {},
};
```

- [ ] **Step 5: Implement the résumé action with cleanup**

`saveResumeSettings` must:

1. `requireUserId()`.
2. `assertNotDeleted(userId)` before storage.
3. Read the existing profile to preserve text/path when omitted.
4. Reject non-PDF files and files over 5 MiB with `resume_pdf` field errors.
5. Upload archival bytes when present.
6. Call `updateResumeSource` with reviewed text and final path.
7. On update failure after a new upload, call `storage.from("resumes").remove([path])` before returning the safe error.
8. Revalidate `/`, `/profile`, and `/profile/resume`.

Use `const MAX_RESUME_BYTES = 5 * 1024 * 1024` and accept `application/pdf` or a `.pdf` file name.

- [ ] **Step 6: Run action tests**

Run: `cd dashboard && npx vitest run app/actions/profileSettings.test.ts lib/profileResume.action.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit section actions**

```bash
git add dashboard/lib/profileSettingsState.ts dashboard/app/actions/profileSettings.ts dashboard/app/actions/profileSettings.test.ts
git commit -m "feat(profile): add focused settings actions"
```

---

### Task 4: Build responsive, accessible shared settings primitives

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/package-lock.json`
- Create: `dashboard/app/profile/profile-settings.css`
- Create: `dashboard/app/profile/layout.tsx`
- Create: `dashboard/components/profile/SettingsNav.tsx`
- Create: `dashboard/components/profile/SettingsSectionCard.tsx`
- Create: `dashboard/components/profile/SectionFormShell.tsx`
- Create: `dashboard/components/profile/Field.tsx`
- Create: `dashboard/components/profile/SettingsPrimitives.test.tsx`

**Interfaces:**
- Consumes: `SectionSaveState` and `INITIAL_SECTION_SAVE_STATE` from `lib/profileSettingsState.ts`, `SlimHeader`, Rolefit theme tokens.
- Produces: reusable hub/detail layout and local form behavior for Tasks 5–10.

- [ ] **Step 1: Add the accessibility test dependency**

Run: `cd dashboard && npm install --save-dev axe-core`

Expected: `package.json` and `package-lock.json` add `axe-core` under development dependencies; no production dependency changes.

- [ ] **Step 2: Write component tests for semantics, dirty state, errors, success, navigation protection, and serious accessibility violations**

```tsx
// @vitest-environment jsdom
import axe from "axe-core";

const { container } = render(
  <SectionFormShell action={action} submitLabel="Save preferences">
    <Field id="instructions" name="instructions" label="Priorities" description="Used for matching">
      <textarea defaultValue="" />
    </Field>
  </SectionFormShell>,
);
expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled();
fireEvent.input(screen.getByLabelText("Priorities"), { target: { value: "backend" } });
expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();

const results = await axe.run(container);
expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
```

Add tests that a returned field error creates a linked summary and `aria-invalid`, success announces `Changes saved`, Cancel restores initial uncontrolled values through `form.reset()`, and a dirty internal-link click invokes `window.confirm`.

- [ ] **Step 3: Run tests and verify missing components fail**

Run: `cd dashboard && npx vitest run components/profile/SettingsPrimitives.test.tsx`

Expected: FAIL with missing component imports.

- [ ] **Step 4: Implement `SectionFormShell` with event-driven dirtiness**

Use `useActionState`, one pristine `FormData` serialization snapshot, `onInput` and `onChange`, and a document-level same-origin anchor click guard. Do not poll. On success, update the pristine snapshot, clear dirty state, and expose a polite live status. On validation failure, focus the first field ID named by `fieldErrors`.

The component contract is:

```ts
export interface SectionFormShellProps {
  action: (state: SectionSaveState, formData: FormData) => Promise<SectionSaveState>;
  submitLabel: string;
  children: ReactNode;
}
```

Provide a context value:

```ts
interface SectionFormContextValue {
  fieldErrors: Record<string, string>;
}
```

The action row contains Cancel, Save, and status; Save is disabled while pristine or pending. Add a `beforeunload` handler and same-origin anchor click handler only while dirty.

- [ ] **Step 5: Implement `Field`, `SettingsNav`, and hub primitives**

`Field` accepts `id`, `name`, `label`, optional `description`, optional `required`, and exactly one React element. Clone the control with:

```ts
{
  id,
  name,
  required,
  "aria-invalid": Boolean(error) || undefined,
  "aria-describedby": [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean).join(" ") || undefined,
}
```

`SettingsSectionCard` accepts:

```ts
interface SettingsSectionCardProps {
  title: string;
  status: string;
  summary: string;
  explanation: string;
  href: string;
  actionLabel: string;
  priority?: "primary" | "normal";
}
```

Use semantic `article`, heading, text status, and Next `Link`.

`SettingsNav` uses a labelled `<nav>` and these exact destinations:

```ts
const PROFILE_LINKS = [
  ["Profile", "/profile"],
  ["Job preferences", "/profile/job-preferences"],
  ["Résumé & experience", "/profile/resume"],
  ["Application details", "/profile/application-details"],
  ["Application personalization", "/profile/application-personalization"],
  ["Advanced", "/profile/advanced"],
  ["Account", "/profile/account"],
] as const;
```

Mark the active link with `aria-current="page"`; allow wrapping instead of horizontal scrolling.

- [ ] **Step 6: Add shared layout and CSS**

`profile/layout.tsx` authenticates with `requireUserId`, renders `<SlimHeader current="profile" />`, `SettingsNav`, and wraps children in `.profile-settings-page`. Import `profile-settings.css` once from this layout.

CSS must define `.profile-hub` at 1120px max, `.profile-detail` at 760px max, a two-column `.settings-card-grid`, `.field-grid`, `.section-actions`, and semantic focus/error/success states. Include:

```css
@media (max-width: 720px) {
  .settings-card-grid, .field-grid { grid-template-columns: 1fr; }
  .profile-settings-page { padding: 24px 16px calc(32px + env(safe-area-inset-bottom)); }
  .section-actions { align-items: stretch; }
  .section-actions button { min-height: 44px; }
}
```

Do not hardcode light-only colors; use existing tokens exclusively.

- [ ] **Step 7: Run shared UI tests and typecheck**

Run: `cd dashboard && npx vitest run components/profile/SettingsPrimitives.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit shared settings UI**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/app/profile/layout.tsx dashboard/app/profile/profile-settings.css dashboard/components/profile
git commit -m "feat(profile): add shared settings UI"
```

---

### Task 5: Replace `/profile` with the read-only task hub

**Files:**
- Create: `dashboard/lib/profileReadiness.ts`
- Create: `dashboard/lib/profileReadiness.test.ts`
- Create: `dashboard/components/profile/ProfileHub.tsx`
- Create: `dashboard/components/profile/ProfileHub.test.tsx`
- Replace: `dashboard/app/profile/page.tsx`

**Interfaces:**
- Consumes: `ProfileRow`, `SettingsSectionCard`, `getProfile`.
- Produces: `deriveProfileReadiness(profile): ProfileReadiness` and the `/profile` hub.

- [ ] **Step 1: Write readiness derivation tests**

Define and test this exact interface:

```ts
export interface ReadinessCard {
  status: "Ready" | "Needs attention" | "Optional";
  summary: string;
}
export interface ProfileReadiness {
  readyCount: number;
  totalCore: 3;
  overall: "Ready to find matching jobs" | "Finish setting up your profile";
  jobPreferences: ReadinessCard;
  resume: ReadinessCard;
  applicationDetails: ReadinessCard;
  personalization: ReadinessCard;
}
```

Rules:

- Job Preferences is ready when `preferred_locations.length > 0`.
- Résumé is ready when trimmed `resume_text` exists.
- Application Details is ready when both `full_name` and `email` exist; otherwise summarize how many of those two essentials are missing.
- Personalization is always Optional; summarize whether any writing preference exists.
- Overall is ready when preferences and résumé are ready; application details affect `readyCount` but do not block matching readiness.

- [ ] **Step 2: Run readiness tests and verify missing implementation**

Run: `cd dashboard && npx vitest run lib/profileReadiness.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement readiness as a pure function**

Use only persisted fields. Summaries must be deterministic and concise:

```ts
jobPreferences.summary = `${count} ${count === 1 ? "location" : "locations"}${profile.instructions ? " · Matching guidance added" : ""}`;
resume.summary = profile.resume_text ? `Résumé updated ${formatProfileDate(profile.updated_at)}` : "Add a résumé to improve matching";
applicationDetails.summary = missing === 0 ? "Name and email ready" : `${missing} essential ${missing === 1 ? "answer" : "answers"} missing`;
personalization.summary = hasPersonalization ? "Writing preferences added" : "Use Rolefit defaults";
```

Keep `formatProfileDate` locale-independent in tests by returning `YYYY-MM-DD`; the UI may format the ISO date through `<time>`.

- [ ] **Step 4: Write and implement the hub component test**

Assert one `h1`, four primary task articles in approved order, no form, no textbox, no model text, no Delete Account control, and secondary links for Appearance/Plan/Advanced/Account.

`ProfileHub` accepts `{ readiness: ProfileReadiness }` and renders the approved heading, readiness progress text (`3 of 3 core sections ready`, not an AI score), card grid, and secondary navigation.

- [ ] **Step 5: Replace the legacy page with a thin server route**

```tsx
export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");
  return <ProfileHub readiness={deriveProfileReadiness(profile)} />;
}
```

Remove all model catalog, location list, plan, upload, full-row action, appearance, and danger-zone work from this route.

- [ ] **Step 6: Run hub tests and typecheck**

Run: `cd dashboard && npx vitest run lib/profileReadiness.test.ts components/profile/ProfileHub.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the hub**

```bash
git add dashboard/lib/profileReadiness.ts dashboard/lib/profileReadiness.test.ts dashboard/components/profile/ProfileHub.tsx dashboard/components/profile/ProfileHub.test.tsx dashboard/app/profile/page.tsx
git commit -m "feat(profile): replace form with task hub"
```

---

### Task 6: Add Application Details as the first focused route

**Files:**
- Create: `dashboard/app/profile/application-details/page.tsx`
- Create: `dashboard/components/profile/ApplicationDetailsForm.tsx`
- Create: `dashboard/components/profile/ApplicationDetailsForm.test.tsx`

**Interfaces:**
- Consumes: `saveApplicationDetails`, `ProfileRow`, `SectionFormShell`, `Field`.
- Produces: the complete Application Details route.

- [ ] **Step 1: Write the form semantics test**

Render a fixture and assert sections named Contact information, Links, Work eligibility, Common screening answers, and Voluntary demographic information. Assert the demographic section uses a native `<details>` closed by default and includes “These answers are optional and are not used to rank jobs.” Assert `email`, `tel`, and `url` input types and autocomplete values.

- [ ] **Step 2: Run the test and verify the form is missing**

Run: `cd dashboard && npx vitest run components/profile/ApplicationDetailsForm.test.tsx`

Expected: FAIL with missing component.

- [ ] **Step 3: Implement the form with all existing fields**

Use `SectionFormShell action={saveApplicationDetails}` and these exact groups/field names:

```tsx
<section aria-labelledby="contact-heading">
  <h2 id="contact-heading">Contact information</h2>
  <div className="field-grid">
    <Field id="full_name" name="full_name" label="Full name" required><input autoComplete="name" /></Field>
    <Field id="location" name="location" label="Home location"><input autoComplete="address-level2" /></Field>
    <Field id="email" name="email" label="Email" required><input type="email" autoComplete="email" /></Field>
    <Field id="phone" name="phone" label="Phone"><input type="tel" autoComplete="tel" /></Field>
  </div>
</section>
```

Render `link_linkedin`, `link_github`, and `link_portfolio` as URL fields; `work_authorized` and `needs_sponsorship` as tri-state selects; `screen_notice_period`, `screen_salary_expectation`, and `screen_relocation` as text inputs; and all four `eeo_*` fields inside the optional disclosure. Use current `ProfileRow` values as defaults.

- [ ] **Step 4: Add the server route**

Read only `getProfile(userId)`, redirect missing profiles to onboarding, and render a detail header plus `ApplicationDetailsForm`. Do not load locations, model catalog, or viewer plan.

- [ ] **Step 5: Run action, form, and type tests**

Run: `cd dashboard && npx vitest run components/profile/ApplicationDetailsForm.test.tsx app/actions/profileSettings.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Application Details**

```bash
git add dashboard/app/profile/application-details dashboard/components/profile/ApplicationDetailsForm.tsx dashboard/components/profile/ApplicationDetailsForm.test.tsx
git commit -m "feat(profile): add application details settings"
```

---

### Task 7: Add Job Preferences and repair the location combobox

**Files:**
- Create: `dashboard/app/profile/job-preferences/page.tsx`
- Create: `dashboard/components/profile/JobPreferencesForm.tsx`
- Create: `dashboard/components/profile/JobPreferencesForm.test.tsx`
- Modify: `dashboard/components/LocationPicker.tsx`
- Create: `dashboard/components/LocationPicker.test.tsx`

**Interfaces:**
- Consumes: `saveJobPreferences`, cached distinct locations, `LocationPicker`, current `instructions` and `company_instructions` fields.
- Produces: the primary Job Preferences route and a valid, event-emitting combobox.

- [ ] **Step 1: Write location-picker regression tests**

Test that:

- `aria-expanded="true"` while the popup is open even with zero results;
- zero results exposes a status containing `No matching locations`;
- options are not buttons nested inside `role="option"`;
- removing a chip has an accessible name and a 44px class;
- changing the selection dispatches a bubbling `input` event from the hidden field so `SectionFormShell` becomes dirty.

- [ ] **Step 2: Run the picker test and confirm current failures**

Run: `cd dashboard && npx vitest run components/LocationPicker.test.tsx`

Expected: FAIL on expanded state, empty status, nested option/button, and input-event assertions.

- [ ] **Step 3: Repair `LocationPicker` without changing its stored JSON contract**

Keep the hidden `name` field and JSON array value. Add a hidden-input ref and dispatch:

```ts
hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
```

after user-driven add/remove operations, not on initial mount. Render each result as one interactive `li role="option"` with `onMouseDown`/`onKeyDown`, or implement the active-descendant pattern; do not place a button inside it. Set `aria-expanded={open}`. Render a live empty/result-count status. Give chip-removal buttons class `location-chip-remove` and label `Remove ${location}`.

- [ ] **Step 4: Write the Job Preferences form test**

Assert one `h1` supplied by the route and form sections named Where you want to work, Priorities and deal-breakers, Companies and industries, and Rolefit will. Assert that no target-role, seniority, work-style, employment-type, or salary control is rendered in this release because no persistence exists for them.

- [ ] **Step 5: Implement Job Preferences with existing persisted inputs only**

Use:

```tsx
<LocationPicker name="preferred_locations" options={locations}
  defaultValue={profile.preferred_locations} />
<Field id="instructions" name="instructions"
  label="Must-haves and deal-breakers"
  description="Describe the work to prioritize and roles or skills to avoid.">
  <textarea rows={5} defaultValue={profile.instructions ?? ""} />
</Field>
<Field id="company_instructions" name="company_instructions"
  label="Companies and industries"
  description="Describe companies or industries to prioritize or skip.">
  <textarea rows={5} defaultValue={profile.company_instructions ?? ""} />
</Field>
```

Render a deterministic preview using saved/default form values on first render. Do not claim live semantic parsing; copy should be `Rolefit will use your locations and written guidance when reviewing jobs.` until structured preference parsing exists.

- [ ] **Step 6: Add the route with the existing 10-minute location cache**

Move `cachedDistinctLocations` out of the old page into `job-preferences/page.tsx`, read profile and locations in parallel, and render `JobPreferencesForm`.

- [ ] **Step 7: Run preference, location, scoping, and version tests**

Run: `cd dashboard && npx vitest run components/LocationPicker.test.tsx components/profile/JobPreferencesForm.test.tsx lib/preferredLocations.test.ts lib/profileVersion.test.ts lib/companyProfileVersion.test.ts lib/queries.locationScoping.db.test.ts`

Expected: PASS; real-DB suite may skip.

- [ ] **Step 8: Commit Job Preferences**

```bash
git add dashboard/app/profile/job-preferences dashboard/components/profile/JobPreferencesForm.tsx dashboard/components/profile/JobPreferencesForm.test.tsx dashboard/components/LocationPicker.tsx dashboard/components/LocationPicker.test.tsx
git commit -m "feat(profile): add job preferences settings"
```

---

### Task 8: Add Application Personalization and Advanced AI Settings

**Files:**
- Create: `dashboard/app/profile/application-personalization/page.tsx`
- Create: `dashboard/components/profile/ApplicationPersonalizationForm.tsx`
- Create: `dashboard/components/profile/ApplicationPersonalizationForm.test.tsx`
- Create: `dashboard/app/profile/advanced/page.tsx`
- Create: `dashboard/components/profile/AdvancedAiForm.tsx`
- Create: `dashboard/components/profile/AdvancedAiForm.test.tsx`
- Modify: `dashboard/components/ModelPicker.tsx`
- Create: `dashboard/components/ModelPicker.test.tsx`

**Interfaces:**
- Consumes: personalization/advanced actions, model catalog, viewer plan, current pickers and reasoning select.
- Produces: ordinary writing preferences separated from technical model controls.

- [ ] **Step 1: Write personalization tests**

Assert two fields labelled `Résumé writing preferences` and `Cover letter writing preferences`; help text states that defaults apply to every generated document and per-job instructions layer on top. Assert no model selector, model ID, Stage, gate, or reasoning text appears.

- [ ] **Step 2: Implement personalization form and route**

Use two `Field`-wrapped textareas with existing database field names and `SectionFormShell action={saveApplicationPersonalization}`. The route reads only the profile.

- [ ] **Step 3: Write ModelPicker accessibility/dirty-event tests and Advanced AI form tests**

Mirror the LocationPicker assertions: correct expanded state with zero results, live empty status, no nested interactive option, hidden-input `input` event after selection. Advanced form tests assert every current model/reasoning control exists, the first-stage control is read-only text, and user-facing copy does not use `cheap gate`.

- [ ] **Step 4: Repair `ModelPicker` and implement Advanced AI Settings**

Apply the same valid combobox and hidden-input event pattern as LocationPicker. `AdvancedAiForm` renders:

- read-only `Stage 1 — title and company check`, described as `Always uses the Rolefit default`;
- Stage 2 full-description review model;
- résumé model and reasoning effort;
- cover-letter model and reasoning effort;
- company review model.

Use plan-aware labels such as `Available on Pro`; do not label models as cheap/premium quality. The route loads profile, structured models, viewer plan, and passes `isPro`.

- [ ] **Step 5: Run personalization, model, entitlement, and generation tests**

Run: `cd dashboard && npx vitest run components/profile/ApplicationPersonalizationForm.test.tsx components/profile/AdvancedAiForm.test.tsx components/ModelPicker.test.tsx components/ReasoningEffortSelect.test.tsx lib/entitlements.test.ts lib/rolefit/generationInstructions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit personalization and advanced settings**

```bash
git add dashboard/app/profile/application-personalization dashboard/app/profile/advanced dashboard/components/profile/ApplicationPersonalizationForm.tsx dashboard/components/profile/ApplicationPersonalizationForm.test.tsx dashboard/components/profile/AdvancedAiForm.tsx dashboard/components/profile/AdvancedAiForm.test.tsx dashboard/components/ModelPicker.tsx dashboard/components/ModelPicker.test.tsx
git commit -m "feat(profile): separate writing and AI settings"
```

---

### Task 9: Add Résumé & Experience and harden upload accessibility

**Files:**
- Create: `dashboard/app/profile/resume/page.tsx`
- Create: `dashboard/components/profile/ResumeSettingsForm.tsx`
- Create: `dashboard/components/profile/ResumeSettingsForm.test.tsx`
- Modify: `dashboard/components/rolefit/ResumeUploadField.tsx`
- Modify: `dashboard/components/rolefit/ProfileModal.test.tsx`

**Interfaces:**
- Consumes: `saveResumeSettings`, `ResumeUploadField`, scoped résumé service.
- Produces: settings and board flows sharing canonical résumé persistence.

- [ ] **Step 1: Write résumé settings behavior tests**

Test the default summary state, upload/replace action, collapsed review editor, extraction live status, and overwrite confirmation. Use a profile fixture with `resume_file_path`, `resume_text`, and `updated_at`.

Required assertions:

```ts
expect(screen.getByText(/reviewed résumé text powers matching/i)).toBeTruthy();
expect(screen.queryByRole("textbox", { name: /reviewed résumé text/i })).toBeNull();
fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
expect(screen.getByRole("textbox", { name: /reviewed résumé text/i })).toBeTruthy();
expect(screen.getByRole("status")).toBeTruthy();
```

- [ ] **Step 2: Run résumé UI tests and confirm missing behavior**

Run: `cd dashboard && npx vitest run components/profile/ResumeSettingsForm.test.tsx components/rolefit/ProfileModal.test.tsx`

Expected: FAIL because the settings form is missing and upload status is not live.

- [ ] **Step 3: Refactor `ResumeUploadField` to an explicit accessible control**

Remove interactive content nested inside an implicit outer label. Give the file input an explicit label/`aria-label`, keep the styled trigger as a button that calls `inputRef.current?.click()`, and render extraction text in:

```tsx
<p role="status" aria-live="polite">{status}</p>
```

Expose `onExtracted(markdown: string)` and `hasUnsavedText: boolean` props. If extraction would replace unsaved text, call `window.confirm("Replace your unsaved résumé edits with the extracted PDF text?")` before invoking `onExtracted`.

- [ ] **Step 4: Implement `ResumeSettingsForm`**

The form renders a summary card with archive path basename and `<time>`, an upload/replace control, a disclosure button, and a conditionally mounted textarea named `resume_text`. Store extracted text in client state so the editor and hidden submitted value stay in sync. Use `SectionFormShell action={saveResumeSettings}` and include the file input named `resume_pdf`.

Do not present archived PDF as a generation source. Copy must say: `Rolefit uses the reviewed text below for matching and application writing. The PDF is kept only as an archive.`

- [ ] **Step 5: Add the résumé route**

Read only profile data, redirect missing profiles to onboarding, and render the detail page. Do not load models, plan, or locations.

- [ ] **Step 6: Run résumé unit/action/storage tests**

Run: `cd dashboard && npx vitest run components/profile/ResumeSettingsForm.test.tsx components/rolefit/ProfileModal.test.tsx app/actions/profileSettings.test.ts lib/profileResume.action.test.ts lib/resumeStorage.test.ts lib/profileVersion.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Résumé & Experience**

```bash
git add dashboard/app/profile/resume dashboard/components/profile/ResumeSettingsForm.tsx dashboard/components/profile/ResumeSettingsForm.test.tsx dashboard/components/rolefit/ResumeUploadField.tsx dashboard/components/rolefit/ProfileModal.test.tsx
git commit -m "feat(profile): add resume experience settings"
```

---

### Task 10: Add Account & App and remove legacy profile editing

**Files:**
- Create: `dashboard/app/profile/account/page.tsx`
- Create: `dashboard/components/profile/AccountSettings.tsx`
- Create: `dashboard/components/profile/AccountSettings.test.tsx`
- Delete: `dashboard/components/ProfileFormShell.tsx`
- Modify: `dashboard/components/theme/AppearanceToggle.tsx`
- Modify: `dashboard/components/theme/AppearanceToggle.test.tsx`

**Interfaces:**
- Consumes: `AppearanceToggle`, `DangerZone`, billing route.
- Produces: isolated account/app destination; removes the final legacy global-form component.

- [ ] **Step 1: Write Account & App semantics tests**

Assert sections in this order: Plan & billing, Appearance, Data & privacy. Assert the Delete Account control appears only inside a labelled danger section at the bottom. Assert no career field or AI control appears.

- [ ] **Step 2: Add a focus-versus-selection test to AppearanceToggle**

Test that the selected option uses `aria-checked`, while keyboard focus receives the shared `rf-focusable` focus style/class rather than reusing the selection ring.

- [ ] **Step 3: Implement Account & App and adjust appearance styling**

`AccountSettings` renders a billing link, the device-local appearance explanation/toggle, a data/privacy explanation, and `DangerZone`. The route uses the shared profile layout and reads no profile row unless `DangerZone` requires it.

Change AppearanceToggle so selected visual state uses `var(--accent-bg)`/`var(--accent-border)` and focus uses the global focus treatment, keeping those states distinguishable.

- [ ] **Step 4: Delete `ProfileFormShell` and prove it has no consumers**

Run: `rg -n "ProfileFormShell" dashboard`

Expected before deletion: only the component file itself. Delete it, then rerun and expect no matches.

- [ ] **Step 5: Run account/theme tests and typecheck**

Run: `cd dashboard && npx vitest run components/profile/AccountSettings.test.tsx components/theme/AppearanceToggle.test.tsx lib/theme.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit account isolation and legacy removal**

```bash
git add dashboard/app/profile/account dashboard/components/profile/AccountSettings.tsx dashboard/components/profile/AccountSettings.test.tsx dashboard/components/theme/AppearanceToggle.tsx dashboard/components/theme/AppearanceToggle.test.tsx dashboard/components/ProfileFormShell.tsx
git commit -m "feat(profile): isolate account settings"
```

---

### Task 11: Add route-level accessibility coverage and complete verification

**Files:**
- Create: `dashboard/app/profile/profileRoutes.test.tsx`
- Modify: `dashboard/docs` only if an existing developer-facing test guide already lists authenticated route checks; otherwise no documentation file change.

**Interfaces:**
- Consumes: all routes/components from Tasks 4–10.
- Produces: regression coverage and verified completion evidence.

- [ ] **Step 1: Write route-composition regression tests**

Mock auth/data dependencies and test the thin server routes or their top-level page components. Assert:

- each route has exactly one `h1`;
- heading order does not skip levels;
- hub card order is Job Preferences, Résumé & Experience, Application Details, Application Personalization;
- core pages do not contain model IDs;
- Advanced contains model controls;
- Account alone contains deletion;
- all detail routes link back to `/profile`;
- no detail route renders the old global `Save` label; each has a scoped label.

- [ ] **Step 2: Run the route tests and repair only concrete failures**

Run: `cd dashboard && npx vitest run app/profile/profileRoutes.test.tsx`

Expected: PASS after correcting any heading, label, or navigation mismatch exposed by the test.

- [ ] **Step 3: Run the complete automated dashboard suite**

Run: `cd dashboard && npm test`

Expected: all unit/component suites PASS; database-gated suites SKIP when `TEST_DATABASE_URL` is unset.

- [ ] **Step 4: Run static verification**

Run: `cd dashboard && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0 with no TypeScript, ESLint, or Next build errors.

- [ ] **Step 5: Run targeted real-Postgres tests when a test DSN is available**

Run: `cd dashboard && TEST_DATABASE_URL="$TEST_DATABASE_URL" npx vitest run lib/profileSettings.db.test.ts lib/queries.locationScoping.db.test.ts`

Expected: PASS, demonstrating field preservation, exact version semantics, and location scoping on real SQL.

- [ ] **Step 6: Perform manual responsive and accessibility verification**

Start the authenticated dashboard and verify hub plus every detail route at 320, 375, 768, 1024, and 1440px in light and dark themes. At each width:

- no horizontal scroll;
- field pairs collapse by 720px;
- sticky actions do not cover the final control and respect safe-area padding;
- all actions are reachable by keyboard;
- visible focus is distinct from selection;
- upload, save success, and errors are announced;
- 200% zoom remains usable;
- ordinary setup never requires Advanced AI Settings.

Record any defect as a failing automated test before fixing it.

- [ ] **Step 7: Commit final regression coverage**

```bash
git add dashboard/app/profile/profileRoutes.test.tsx
git commit -m "test(profile): cover settings overhaul flows"
```

---

## Final review checklist

- [ ] `git diff --check` reports no whitespace errors.
- [ ] `rg -n "cheap gate|version [0-9a-f]{8}|Advanced settings — résumé" dashboard/app/profile dashboard/components/profile` returns no user-facing legacy copy.
- [ ] `rg -n "upsertProfile" dashboard/app/profile dashboard/app/actions/profile.ts` returns no settings/edit writer.
- [ ] `rg -n "ProfileFormShell" dashboard` returns no matches.
- [ ] Saving one section never submits fields owned by another section.
- [ ] The board résumé modal and résumé settings route both call `updateResumeSource`.
- [ ] The hub does not fetch models, plan, or distinct locations.
- [ ] No new schema fields or production dependencies were added; `axe-core` is the only new development dependency.
