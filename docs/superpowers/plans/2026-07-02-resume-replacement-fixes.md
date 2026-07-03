# Résumé-Replacement Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pasting new résumé text actually replace a previously-uploaded PDF (so generation uses the new text), refresh the board after a résumé save, stop the profile modal from silently dropping pasted text on a tab switch, and visibly flag tailored résumés that were generated from an older profile.

**Architecture:** The root cause is that a résumé-text paste writes `profiles.resume_text` but never clears `profiles.resume_file_path`, so `getResumeSource` keeps downloading the old PDF and `parseProfile` prefers the PDF-derived profile over the text. We fix this with a small pure helper (`resolveResumeFilePath`) that both profile-save paths call to drop the stale PDF on a genuine text replacement, add a `revalidatePath("/")` so the board reflects the save, keep both modal inputs mounted, and stamp each `application_packages` row with the `profile_version` it was generated from so the UI can badge stale tailored résumés.

**Tech Stack:** Next.js 15 (App Router, Server Components + Server Actions), React 19, TypeScript, Supabase (Postgres via `postgres.js` tagged templates + Storage), Vitest (node environment, `lib/**/*.test.ts` only).

## Global Constraints

- **Test collection:** Vitest `include` is `lib/**/*.test.ts` ONLY (see `vitest.config.ts`). Every unit test in this plan lives under `dashboard/lib/`, even when it tests code in `app/`. There is NO DOM/jsdom environment — React components are verified by typecheck + manual run, not unit tests.
- **jsonb boundary rule (dashboard/CLAUDE.md):** Never `as`-cast a jsonb column into a shape. `profile_version` is a plain `TEXT` scalar (like `apply_url`), so a `row.profile_version as string | null` scalar cast is allowed; do NOT route it through a jsonb total parser.
- **profile_version definition:** `sha256((resume_text ?? "") + "\0" + (instructions ?? ""))`, computed by `lib/profileVersion.ts` and stored on `profiles.profile_version` at save time. Reuse the stored `profiles.profile_version` — do NOT recompute it in the routes.
- **Migrations before code (memory: deploy-topology):** The `application_packages.profile_version` column must be applied to the live Supabase DB BEFORE the query code that SELECTs it is deployed. Push-to-main auto-deploys.
- **Typecheck command:** `cd dashboard && npx tsc --noEmit`
- **Test command:** `cd dashboard && npx vitest run <path>` (single file) or `npx vitest run` (all).
- All shell commands below assume the repo root `/Users/andrew/Scripts/job-board` unless a `cd` is shown.

## File Structure

Created:
- `dashboard/lib/resumeFilePath.ts` — pure `resolveResumeFilePath` helper (Fix 1 logic).
- `dashboard/lib/resumeFilePath.test.ts` — unit tests for the helper.
- `dashboard/lib/profileResume.action.test.ts` — action-level test that `saveProfileResume` wires the helper + revalidates.
- `migrations/2026-07-02-application-packages-profile-version.sql` — adds the `profile_version` column.

Modified:
- `dashboard/app/actions/profile.ts` — `saveProfileResume` uses the helper + `revalidatePath("/")` (Fix 1 + Fix 2).
- `dashboard/app/profile/page.tsx` — `saveProfile` uses the helper (Fix 1).
- `dashboard/components/rolefit/ProfileModal.tsx` — both tab inputs stay mounted (Fix 3).
- `dashboard/schema.sql` — add `profile_version` to `application_packages` for parity (Fix 4).
- `dashboard/lib/types.ts` — `ApplicationPackage.profileVersion` (Fix 4).
- `dashboard/lib/queries.ts` — `upsertApplicationPackage` writes it, `getApplicationPackages` selects it, `toApplicationPackage` maps it (Fix 4).
- `dashboard/lib/queries.applicationPackages.test.ts` — cover the new mapping (Fix 4).
- `dashboard/app/api/resume/route.ts`, `dashboard/app/api/cover-letter/route.ts`, `dashboard/app/api/application/prepare/route.ts` — stamp `profileVersion: profile.profile_version` (Fix 4).
- `dashboard/app/page.tsx`, `dashboard/components/rolefit/RolefitBoard.tsx`, `dashboard/components/rolefit/JobDetail.tsx`, `dashboard/components/rolefit/ApplicationPanel.tsx`, `dashboard/components/rolefit/ResumePanel.tsx` — thread `currentProfileVersion` and render the stale badge (Fix 4).

---

### Task 1: `resolveResumeFilePath` pure helper (Fix 1 core logic)

**Files:**
- Create: `dashboard/lib/resumeFilePath.ts`
- Test: `dashboard/lib/resumeFilePath.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export function resolveResumeFilePath(args: {
    submittedText: string;          // trimmed resume_text from the form ("" if absent)
    existingText: string | null;    // profiles.resume_text before this save
    existingPath: string | null;    // profiles.resume_file_path before this save
    freshUploadPath: string | null; // storage path of a PDF uploaded in THIS submit, else null
  }): string | null
  ```
  Rules: a fresh upload always wins; else a non-empty `submittedText` that differs from `existingText` clears the path (returns `null`); else the existing path is preserved.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/resumeFilePath.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { resolveResumeFilePath } from "@/lib/resumeFilePath";

describe("resolveResumeFilePath", () => {
  test("a fresh upload always wins, even when the text also changed", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "brand new pasted text",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: "u1/new.pdf",
      }),
    ).toBe("u1/new.pdf");
  });

  test("pasted text that differs from the stored text drops the stale PDF", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "brand new pasted text",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBeNull();
  });

  test("unchanged text keeps the existing PDF (e.g. re-saving the prefilled modal)", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "same text",
        existingText: "same text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBe("u1/old.pdf");
  });

  test("empty submitted text keeps the existing PDF (empty file input must not wipe it)", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "",
        existingText: "old extracted text",
        existingPath: "u1/old.pdf",
        freshUploadPath: null,
      }),
    ).toBe("u1/old.pdf");
  });

  test("first-ever paste with no prior PDF stays null", () => {
    expect(
      resolveResumeFilePath({
        submittedText: "my first resume",
        existingText: null,
        existingPath: null,
        freshUploadPath: null,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/resumeFilePath.test.ts`
Expected: FAIL — cannot resolve `@/lib/resumeFilePath` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `dashboard/lib/resumeFilePath.ts`:

```ts
// Resolves which uploaded-PDF path a profile save should keep.
//
// A fresh upload always wins. Otherwise a non-empty pasted résumé that differs
// from the stored text is a deliberate replacement, so the old PDF is dropped
// (returns null) — this is what stops résumé generation from re-downloading and
// parsing a stale upload after the user pastes new text (getResumeSource only
// fetches the PDF while resume_file_path is set, and parseProfile prefers the
// PDF-derived profile over the text). An unchanged or empty submission keeps the
// existing path so an empty file input never wipes a prior upload.
export function resolveResumeFilePath(args: {
  submittedText: string;
  existingText: string | null;
  existingPath: string | null;
  freshUploadPath: string | null;
}): string | null {
  if (args.freshUploadPath) return args.freshUploadPath;
  if (args.submittedText && args.submittedText !== (args.existingText ?? "")) {
    return null;
  }
  return args.existingPath;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/resumeFilePath.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/resumeFilePath.ts dashboard/lib/resumeFilePath.test.ts
git commit -m "feat(rolefit): resolveResumeFilePath helper — drop stale PDF on résumé-text replacement"
```

---

### Task 2: Wire the helper into both save paths + revalidate (Fix 1 wiring + Fix 2)

**Files:**
- Modify: `dashboard/app/actions/profile.ts:10-55`
- Modify: `dashboard/app/profile/page.tsx:43-135`
- Test: `dashboard/lib/profileResume.action.test.ts`

**Interfaces:**
- Consumes: `resolveResumeFilePath` (Task 1); `revalidatePath` from `next/cache`.
- Produces: no new exported symbols. `saveProfileResume(formData)` now passes a possibly-`null` `resumeFilePath` to `upsertProfile` and calls `revalidatePath("/")` after the write.

- [ ] **Step 1: Write the failing action test**

Create `dashboard/lib/profileResume.action.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(async () => "u1"),
  getProfile: vi.fn(),
  upsertProfile: vi.fn(async () => {}),
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  extractPdfText: vi.fn(async () => ""),
}));

vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  upsertProfile: mocks.upsertProfile,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/pdf", () => ({ extractPdfText: mocks.extractPdfText }));

const existingProfile = {
  resume_text: "OLD EXTRACTED TEXT",
  resume_file_path: "u1/old.pdf",
  instructions: null,
};

const fd = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("saveProfileResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue(existingProfile);
  });

  test("pasting new text (no file) clears resume_file_path and revalidates", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "BRAND NEW PASTED TEXT" }));

    expect(mocks.upsertProfile).toHaveBeenCalledTimes(1);
    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeText).toBe("BRAND NEW PASTED TEXT");
    expect(arg.resumeFilePath).toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  test("re-saving unchanged text preserves the uploaded PDF path", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "OLD EXTRACTED TEXT" }));

    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeFilePath).toBe("u1/old.pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/profileResume.action.test.ts`
Expected: FAIL — `resumeFilePath` is `"u1/old.pdf"` (not `null`) in the first test, and `revalidatePath` was not called (current code preserves the path and never revalidates).

- [ ] **Step 3: Update `saveProfileResume` in `dashboard/app/actions/profile.ts`**

Replace the import block (lines 3-6):

```ts
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
```

with:

```ts
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
import { resolveResumeFilePath } from "@/lib/resumeFilePath";
```

Replace lines 14-28:

```ts
  let resumeText = String(formData.get("resume_text") ?? "").trim() || existing?.resume_text || null;
  let resumeFilePath = existing?.resume_file_path ?? null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted;
  }
```

with:

```ts
  const submittedText = String(formData.get("resume_text") ?? "").trim();
  let resumeText = submittedText || existing?.resume_text || null;
  let freshUploadPath: string | null = null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    freshUploadPath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted;
  }

  // Replacing the pasted text (with no fresh upload this submit) drops the stale
  // PDF so generation stops parsing it instead of the new text.
  const resumeFilePath = resolveResumeFilePath({
    submittedText,
    existingText: existing?.resume_text ?? null,
    existingPath: existing?.resume_file_path ?? null,
    freshUploadPath,
  });
```

Then add the revalidate as the final statement of the function, immediately after the `await upsertProfile(userId, { ... });` call (after line 54's closing `});`):

```ts
  revalidatePath("/");
```

- [ ] **Step 4: Update `saveProfile` in `dashboard/app/profile/page.tsx`**

Add the import after line 9 (`import { extractPdfText } from "@/lib/pdf";`):

```ts
import { resolveResumeFilePath } from "@/lib/resumeFilePath";
```

Replace lines 52-56:

```ts
    let resumeText = (String(formData.get("resume_text") ?? "")).trim() || existing?.resume_text || null;
    // Preserve the previously-uploaded PDF: a file input is empty on every save
    // that doesn't re-pick the file, so defaulting to null here would wipe the
    // stored path. Only a fresh upload below replaces it.
    let resumeFilePath: string | null = existing?.resume_file_path ?? null;
```

with:

```ts
    const submittedText = (String(formData.get("resume_text") ?? "")).trim();
    let resumeText = submittedText || existing?.resume_text || null;
    // Which uploaded PDF (if any) survives this save is decided after the upload
    // branch below by resolveResumeFilePath: an empty/unchanged text keeps the
    // stored PDF, a genuine text replacement drops it, a fresh upload wins.
    let freshUploadPath: string | null = null;
```

Replace lines 89-101 (the file-upload block):

```ts
    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = `${userId}/${Date.now()}-${file.name}`;
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) return { error: `resume upload failed: ${error.message}` };
      resumeFilePath = path;
      const extracted = await extractPdfText(bytes);
      if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
    }
```

with:

```ts
    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = `${userId}/${Date.now()}-${file.name}`;
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) return { error: `resume upload failed: ${error.message}` };
      freshUploadPath = path;
      const extracted = await extractPdfText(bytes);
      if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
    }
    const resumeFilePath = resolveResumeFilePath({
      submittedText,
      existingText: existing?.resume_text ?? null,
      existingPath: existing?.resume_file_path ?? null,
      freshUploadPath,
    });
```

Note: `saveProfile` already `redirect(returnTo)`s (usually `/`) on success, which re-renders the board — no `revalidatePath` needed here.

- [ ] **Step 5: Run the action test + typecheck**

Run: `cd dashboard && npx vitest run lib/profileResume.action.test.ts && npx tsc --noEmit`
Expected: test PASS (2 passed); tsc prints nothing (exit 0).

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/actions/profile.ts dashboard/app/profile/page.tsx dashboard/lib/profileResume.action.test.ts
git commit -m "fix(rolefit): pasting résumé text drops the stale PDF and refreshes the board"
```

---

### Task 3: Keep both profile-modal inputs mounted (Fix 3)

**Files:**
- Modify: `dashboard/components/rolefit/ProfileModal.tsx:286-389`

**Interfaces:**
- Consumes: nothing new (uses existing `pasteActive` boolean).
- Produces: no API change. Both the paste `<textarea name="resume_text">` and the upload `<input name="resume_pdf">` stay in the DOM regardless of the active tab, so switching tabs before Save no longer unmounts (and drops) the typed text.

- [ ] **Step 1: Replace the conditional Paste block with an always-mounted, visibility-toggled wrapper**

In `dashboard/components/rolefit/ProfileModal.tsx`, replace the opening of the Paste block (lines 286-288):

```tsx
              {/* Paste tab */}
              {pasteActive && (
                <>
```

with:

```tsx
              {/* Paste tab — kept mounted so switching to Upload never drops typed text */}
              <div style={{ display: pasteActive ? "block" : "none" }}>
```

and replace the closing of the Paste block (lines 321-322):

```tsx
                </>
              )}
```

with:

```tsx
              </div>
```

- [ ] **Step 2: Replace the conditional Upload block with an always-mounted, visibility-toggled wrapper**

Replace the opening of the Upload block (lines 324-326):

```tsx
              {/* Upload tab */}
              {!pasteActive && (
                <>
```

with:

```tsx
              {/* Upload tab — kept mounted alongside Paste */}
              <div style={{ display: pasteActive ? "none" : "block" }}>
```

and replace the closing of the Upload block (lines 388-389):

```tsx
                </>
              )}
```

with:

```tsx
              </div>
```

Note: the inner content of both blocks is unchanged. A `display:none` subtree still submits its form values (only `disabled` inputs are excluded), and the focus trap already filters on `el.offsetParent !== null`, so hidden inputs are correctly skipped while tabbing.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Manual verification**

Run: `cd dashboard && npm run dev` (needs `NEXT_PUBLIC_SUPABASE_*` in `dashboard/.env.local`; see memory `dashboard-env-local-not-in-worktrees`). On the board, open the profile modal → Paste tab → type text → switch to Upload tab → switch back to Paste. Confirm the typed text is still present. Then paste text and click Save while on the Upload tab; confirm the save persists the pasted text (the textarea is still in the DOM).

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/ProfileModal.tsx
git commit -m "fix(rolefit): keep both profile-modal tabs mounted so a tab switch can't drop pasted text"
```

---

### Task 4: Persist `profile_version` on application packages (Fix 4, data layer)

**Files:**
- Create: `migrations/2026-07-02-application-packages-profile-version.sql`
- Modify: `dashboard/schema.sql:251-268`
- Modify: `dashboard/lib/types.ts:197-208`
- Modify: `dashboard/lib/queries.ts:331-354` (`toApplicationPackage`), `:370-378` (`getApplicationPackages`), `:383-420` (`upsertApplicationPackage`)
- Test: `dashboard/lib/queries.applicationPackages.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ApplicationPackage` gains `profileVersion: string | null`.
  - `upsertApplicationPackage(userId, jobId, data)` — `data` gains optional `profileVersion?: string | null` (persisted to the new column; NULL when omitted).
  - `toApplicationPackage(row)` reads `row.profile_version` into `profileVersion`.
  - `getApplicationPackages` SELECTs `profile_version`.

- [ ] **Step 1: Write the failing mapping test**

In `dashboard/lib/queries.applicationPackages.test.ts`, add `profile_version: null` to the `baseRow` defaults (so existing tests still describe every column) and append a new test. First, in `baseRow`, add the line after `applied_at: null,` (line 33):

```ts
    profile_version: null,
```

Then add this test inside the `describe("toApplicationPackage", ...)` block:

```ts
  test("maps profile_version scalar (null and populated)", () => {
    expect(toApplicationPackage(baseRow({})).profileVersion).toBeNull();
    expect(
      toApplicationPackage(baseRow({ profile_version: "abc123" })).profileVersion,
    ).toBe("abc123");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/queries.applicationPackages.test.ts`
Expected: FAIL — `pkg.profileVersion` is `undefined` (the field does not exist on the returned object yet).

- [ ] **Step 3: Add the field to the `ApplicationPackage` type**

In `dashboard/lib/types.ts`, in `export interface ApplicationPackage` (lines 197-208), add after `applyUrl: string | null;`:

```ts
  // sha256(resume_text + '\0' + instructions) at generation time; null for rows
  // written before this column existed. Compared to the live profile_version to
  // flag a tailored résumé as stale.
  profileVersion: string | null;
```

- [ ] **Step 4: Map the column in `toApplicationPackage`**

In `dashboard/lib/queries.ts`, in the object returned by `toApplicationPackage` (lines 342-353), add after the `applyUrl:` line (line 350):

```ts
    profileVersion: (row.profile_version as string | null) ?? null,
```

(`profile_version` is a `TEXT` scalar, not jsonb — a direct scalar cast is correct here, matching `apply_url` on the line above.)

- [ ] **Step 5: SELECT the column in `getApplicationPackages`**

In `dashboard/lib/queries.ts`, replace the SELECT column list in `getApplicationPackages` (lines 372-373):

```ts
    SELECT job_id, status, resume_json, cover_letter_json, answers_snapshot,
           greenhouse_questions, prefilled_answers, apply_url, prepared_at, applied_at
```

with:

```ts
    SELECT job_id, status, resume_json, cover_letter_json, answers_snapshot,
           greenhouse_questions, prefilled_answers, apply_url, profile_version,
           prepared_at, applied_at
```

- [ ] **Step 6: Write and RETURN the column in `upsertApplicationPackage`**

In `dashboard/lib/queries.ts`, add the field to the `data` parameter type (after `resumeTraceId?: string | null;` at line 393):

```ts
    profileVersion?: string | null;
```

Replace the INSERT/VALUES/ON CONFLICT/RETURNING body (lines 398-418):

```ts
  const rows = await sql`
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json, answers_snapshot,
       greenhouse_questions, prefilled_answers, apply_url, resume_trace_id, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.answersSnapshot)}::jsonb, ${j(data.greenhouseQuestions)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
            'prepared', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      resume_json          = EXCLUDED.resume_json,
      cover_letter_json    = EXCLUDED.cover_letter_json,
      answers_snapshot     = EXCLUDED.answers_snapshot,
      greenhouse_questions = EXCLUDED.greenhouse_questions,
      prefilled_answers    = EXCLUDED.prefilled_answers,
      apply_url            = EXCLUDED.apply_url,
      resume_trace_id      = EXCLUDED.resume_trace_id,
      prepared_at          = now()
    RETURNING job_id, status, resume_json, cover_letter_json, answers_snapshot,
              greenhouse_questions, prefilled_answers, apply_url, prepared_at, applied_at
  `;
```

with:

```ts
  const rows = await sql`
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json, answers_snapshot,
       greenhouse_questions, prefilled_answers, apply_url, resume_trace_id,
       profile_version, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.answersSnapshot)}::jsonb, ${j(data.greenhouseQuestions)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
            ${data.profileVersion ?? null}, 'prepared', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      resume_json          = EXCLUDED.resume_json,
      cover_letter_json    = EXCLUDED.cover_letter_json,
      answers_snapshot     = EXCLUDED.answers_snapshot,
      greenhouse_questions = EXCLUDED.greenhouse_questions,
      prefilled_answers    = EXCLUDED.prefilled_answers,
      apply_url            = EXCLUDED.apply_url,
      resume_trace_id      = EXCLUDED.resume_trace_id,
      profile_version      = EXCLUDED.profile_version,
      prepared_at          = now()
    RETURNING job_id, status, resume_json, cover_letter_json, answers_snapshot,
              greenhouse_questions, prefilled_answers, apply_url, profile_version,
              prepared_at, applied_at
  `;
```

- [ ] **Step 7: Add the column to `dashboard/schema.sql` (full-schema parity)**

In `dashboard/schema.sql`, in `CREATE TABLE application_packages` (lines 251-268), add after the `resume_trace_id      TEXT,` line (line 261):

```sql
  profile_version      TEXT,                  -- profiles.profile_version at generation time (NULL = pre-column row)
```

- [ ] **Step 8: Create the incremental migration**

Create `migrations/2026-07-02-application-packages-profile-version.sql`:

```sql
-- Stamp each application_packages row with the profiles.profile_version it was
-- generated from, so the board can flag a tailored résumé as stale after the
-- user changes their résumé/instructions. Nullable + no backfill: rows written
-- before this column stay NULL and are treated as "provenance unknown" (never
-- badged). Additive and non-breaking — safe to apply before deploying the code
-- that SELECTs it.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS profile_version TEXT;
```

- [ ] **Step 9: Run the test + typecheck**

Run: `cd dashboard && npx vitest run lib/queries.applicationPackages.test.ts && npx tsc --noEmit`
Expected: test PASS (all prior tests + the new mapping test); tsc exit 0.

- [ ] **Step 10: Apply the migration to the live Supabase DB**

Apply `migrations/2026-07-02-application-packages-profile-version.sql` to the project (via the Supabase MCP `apply_migration`, or `psql` against the project connection string). This MUST happen before Task 5/Task 6 code is deployed (memory: `deploy-topology`). Verify the column exists:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'application_packages' AND column_name = 'profile_version';
```

Expected: one row (`profile_version`).

- [ ] **Step 11: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/lib/queries.applicationPackages.test.ts dashboard/schema.sql migrations/2026-07-02-application-packages-profile-version.sql
git commit -m "feat(rolefit): persist profile_version on application_packages"
```

---

### Task 5: Stamp `profile_version` from the generation routes (Fix 4, write path)

**Files:**
- Modify: `dashboard/app/api/resume/route.ts:71-79`
- Modify: `dashboard/app/api/cover-letter/route.ts:46-53`
- Modify: `dashboard/app/api/application/prepare/route.ts:148-156`

**Interfaces:**
- Consumes: `upsertApplicationPackage` `data.profileVersion` (Task 4); `profile.profile_version` (already loaded via `getProfile` in each route — `SELECT *` includes it, and `ProfileRow.profile_version` is a non-null `string`).
- Produces: every package these routes write carries the profile version current at generation time.

- [ ] **Step 1: Stamp in `app/api/resume/route.ts`**

Replace the `upsertApplicationPackage` call (lines 71-79):

```ts
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: result.resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
      });
```

with:

```ts
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: result.resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
        profileVersion: profile.profile_version,
      });
```

- [ ] **Step 2: Stamp in `app/api/cover-letter/route.ts`**

Replace the `upsertApplicationPackage` call (lines 46-53):

```ts
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: null,
        coverLetter: letter,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
      });
```

with:

```ts
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: null,
        coverLetter: letter,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        profileVersion: profile.profile_version,
      });
```

- [ ] **Step 3: Stamp in `app/api/application/prepare/route.ts`**

Replace the `upsertApplicationPackage` call (lines 148-156):

```ts
    const pkg = await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      answersSnapshot: answers,
      greenhouseQuestions: gh.greenhouseQuestions,
      prefilledAnswers: gh.prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
      resumeTraceId,
    });
```

with:

```ts
    const pkg = await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      answersSnapshot: answers,
      greenhouseQuestions: gh.greenhouseQuestions,
      prefilledAnswers: gh.prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
      resumeTraceId,
      profileVersion: profile.profile_version,
    });
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/resume/route.ts dashboard/app/api/cover-letter/route.ts dashboard/app/api/application/prepare/route.ts
git commit -m "feat(rolefit): stamp generated packages with the current profile_version"
```

---

### Task 6: Surface a "résumé outdated" badge for stale packages (Fix 4, UI)

**Files:**
- Modify: `dashboard/app/page.tsx:76-94` (authed) and `:99-117` (anon)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (props ~35-55, a derived helper near the other `useCallback`s, and the `<JobDetail>` render at ~870-899)
- Modify: `dashboard/components/rolefit/JobDetail.tsx:72-120` (props) and `:499-525` (`<ApplicationPanel>` render)
- Modify: `dashboard/components/rolefit/ApplicationPanel.tsx:37-97` (props) and `:355-370` (`<ResumePanel>` render)
- Modify: `dashboard/components/rolefit/ResumePanel.tsx:27-59` (props) and `:233-256` (Done header)

**Interfaces:**
- Consumes: `ApplicationPackage.profileVersion` (Task 4); `profiles.profile_version` (loaded in `page.tsx`).
- Produces: a single boolean `resumeStale` threaded `page → RolefitBoard → JobDetail → ApplicationPanel → ResumePanel`. Staleness = a résumé is currently shown AND its package's `profileVersion` is non-null AND differs from the live `currentProfileVersion`. New props: `RolefitBoardProps.currentProfileVersion: string | null`, `JobDetailProps.resumeStale: boolean`, `ApplicationPanelProps.resumeStale: boolean`, `ResumePanelProps.stale?: boolean`.

- [ ] **Step 1: Pass `currentProfileVersion` from `page.tsx`**

In `dashboard/app/page.tsx`, in the authed `<RolefitBoard>` (after `resumeText={resumeText}` at line 90), add:

```tsx
        currentProfileVersion={profile?.profile_version ?? null}
```

In the anon `<RolefitBoard>` (after `resumeText=""` at line 113), add:

```tsx
        currentProfileVersion={null}
```

- [ ] **Step 2: Accept the prop in `RolefitBoard` and compute staleness**

In `dashboard/components/rolefit/RolefitBoard.tsx`, add to `RolefitBoardProps` (after `resumeText: string;` at line 48):

```ts
  // Live profiles.profile_version — a package whose stored profileVersion differs
  // was generated from an older résumé/instructions and is flagged stale. null for
  // anon or a profile-less viewer (never stale).
  currentProfileVersion: string | null;
```

Add `currentProfileVersion` to the destructured props (after `resumeText,` at line 83):

```ts
  currentProfileVersion,
```

Add a derived helper alongside the other `useCallback`s (e.g. immediately before `handleGenerate` at line 543):

```ts
  // A shown résumé is stale when its package was generated from a different
  // profile_version than the live one. Regenerating (handleGenerate) writes the
  // fresh version into `packages`, which clears the flag. Rows with a null stored
  // version (pre-column) are treated as provenance-unknown and never flagged.
  const isResumeStale = useCallback(
    (jobId: string): boolean => {
      const p = packages[jobId];
      return Boolean(
        genData[jobId] &&
          p?.profileVersion &&
          currentProfileVersion &&
          p.profileVersion !== currentProfileVersion,
      );
    },
    [packages, genData, currentProfileVersion],
  );
```

In the `<JobDetail ... />` render, add after `pkg={packages[selectedJobWithDetail.id]}` (line 889):

```tsx
                    resumeStale={isResumeStale(selectedJobWithDetail.id)}
```

- [ ] **Step 3: Thread through `JobDetail`**

In `dashboard/components/rolefit/JobDetail.tsx`, add to the props interface (after `pkg?: ApplicationPackage;` at line 79):

```ts
  // True when the shown tailored résumé was generated from an older profile_version.
  resumeStale: boolean;
```

Add `resumeStale` to the destructured props (after `pkg,` at line 110):

```ts
  resumeStale,
```

In the `<ApplicationPanel ... />` render, add after `resumeError={genErrorMsg}` (line 504):

```tsx
            resumeStale={resumeStale}
```

- [ ] **Step 4: Thread through `ApplicationPanel`**

In `dashboard/components/rolefit/ApplicationPanel.tsx`, add to `ApplicationPanelProps` (after `resumeError?: string;` at line 43):

```ts
  resumeStale: boolean;
```

Add `resumeStale` to the destructured props (after `resumeError,` at line 76):

```ts
  resumeStale,
```

In the `<ResumePanel ... />` render, add after `error={resumeError}` (line 361):

```tsx
        stale={resumeStale}
```

- [ ] **Step 5: Render the badge in `ResumePanel`**

In `dashboard/components/rolefit/ResumePanel.tsx`, add to `ResumePanelProps` (after `error?: string;` at line 33):

```ts
  /** True when the shown résumé was generated from an older profile version. */
  stale?: boolean;
```

Add `stale` to the destructured props (after `error,` at line 51):

```ts
  stale,
```

In the Done header, replace lines 253-255:

```tsx
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
              Résumé ready — tailored to {job.company_name}
            </div>
```

with:

```tsx
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
              Résumé ready — tailored to {job.company_name}
            </div>
            {stale && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9a6b1e",
                  background: "#fdf3e0",
                  border: "1px solid #f3dfb5",
                  borderRadius: "6px",
                  padding: "3px 8px",
                }}
              >
                Outdated — regenerate
              </span>
            )}
```

- [ ] **Step 6: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 7: Manual verification**

Run: `cd dashboard && npm run dev`. With a signed-in profile that has at least one already-generated tailored résumé: open the profile modal, paste different résumé text, Save (board refreshes via Task 2). Open the job with the prior résumé — the Done header shows the amber "Outdated — regenerate" pill. Click Regenerate; after it completes the pill disappears (the new package carries the live `profile_version`).

- [ ] **Step 8: Commit**

```bash
git add dashboard/app/page.tsx dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/ApplicationPanel.tsx dashboard/components/rolefit/ResumePanel.tsx
git commit -m "feat(rolefit): badge tailored résumés generated from an older profile version"
```

---

## Notes / Out of scope

- **Pre-existing latent bug (NOT fixed here):** `upsertApplicationPackage` unconditionally sets `resume_json = EXCLUDED.resume_json` on conflict, and `/api/cover-letter` passes `resume: null`. So generating a cover letter *separately* (not via Prepare) nulls a previously-persisted résumé in the DB; on the next load the board won't re-seed it. This also means a stale résumé can briefly read as "fresh" after a standalone cover-letter generation restamps `profile_version`. It predates this work and is orthogonal to résumé replacement — flag it to the user as a follow-up rather than expanding this plan.
- **No backfill for `profile_version`:** existing package rows keep `profile_version = NULL` and are intentionally never badged (provenance unknown). They become versioned the next time they're regenerated/prepared.
- After merging, update the memory note `unapply-gate-applyurl-coordination` neighborhood only if the un-apply column set changes — it does not here (`profile_version` is not part of `BARE_MARKER_PREDICATE`; a bare "applied" marker legitimately has a null résumé and null version).

## Self-Review

- **Spec coverage:** Fix 1 → Tasks 1-2 (helper + both save paths). Fix 2 → Task 2 (`revalidatePath("/")`; `saveProfile` already redirects). Fix 3 → Task 3 (both inputs mounted). Fix 4 → Tasks 4-6 (column+queries, route stamping, UI badge). All four covered.
- **Placeholder scan:** every code step shows complete code or an exact find/replace pair; no TBD/"handle edge cases"/"similar to".
- **Type consistency:** `resolveResumeFilePath` args identical in Tasks 1 & 2; `profileVersion` (camel, TS) vs `profile_version` (snake, SQL/row) used consistently; `ApplicationPackage.profileVersion` defined in Task 4 and consumed in Task 6; new prop names (`currentProfileVersion`, `resumeStale`, `stale`) match across the five UI files.
