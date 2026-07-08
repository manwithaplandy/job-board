# Generation Instructions: Save + Applied-Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit **Save** button that persists per-job generation instructions independently of generating (survives reload), plus an **applied-status** badge showing whether the shown résumé/cover letter reflects the instructions in the box.

**Architecture:** Two new nullable columns on `application_packages` (`resume_instructions_draft`, `cover_letter_instructions_draft`) hold the saved box, distinct from the existing `*_instructions` columns which already mean "the instructions the current artifact was generated with" (the applied reference). A server action persists the draft; generation clears it in lockstep inside `upsertApplicationPackage`. The UI derives two independent signals — **dirty** (box vs saved) drives Save; **applied** (box vs generated-with) drives the badge.

**Tech Stack:** Next.js 16 (App Router, server actions), postgres.js, Supabase Postgres, React 19, vitest 4 + @testing-library/react (jsdom).

## Global Constraints

- **Never rewrite existing commits.** Commit forward only — no amend/rebase/force-push (repo CLAUDE.md).
- **Migration-before-deploy gate:** apply the migration to Supabase BEFORE pushing migration-coupled code. Dashboard dev runs against the prod DB, so the columns must exist for local runtime too.
- **jsonb boundary rule** does not apply here (these are `TEXT` columns), but keep reads null-safe: `(row.col as string | null) ?? null`.
- **Instruction cap:** `INSTRUCTIONS_MAX_LENGTH = 4000` (from `lib/rolefit/generationInstructions.ts`). Over-cap is a caller error, never a silent truncate.
- **Empty string is a valid saved draft** — a cleared+saved box persists as `""`, NOT collapsed to `null`.
- **Styling:** reuse existing CSS token vars (`--accent`, `--success`, `--text-secondary`, `--border`, `--bg-surface`). No new colors, no Tailwind (repo is token-based inline styles).
- Test command: `npm test` (= `vitest run`) in `dashboard/`. Typecheck: `npm run typecheck` (= `tsc --noEmit`).

---

### Task 1: Migration + schema.sql — draft columns

**Files:**
- Create: `migrations/2026-07-08-instruction-drafts.sql`
- Modify: `schema.sql:284-285` (add two columns after the existing `*_instructions` columns)

**Interfaces:**
- Produces: columns `application_packages.resume_instructions_draft TEXT`, `application_packages.cover_letter_instructions_draft TEXT` (both nullable, no default).

- [ ] **Step 1: Write the migration file**

Create `migrations/2026-07-08-instruction-drafts.sql`:

```sql
-- Per-job "Generation instructions" SAVED DRAFT (rides the next generate; survives reload).
-- Distinct from resume_instructions / cover_letter_instructions, which record the
-- instructions the CURRENT artifact was generated with (the "applied" reference).
-- NULL draft => the box falls back to the generated-with value (existing rows unchanged).
ALTER TABLE application_packages
  ADD COLUMN resume_instructions_draft       TEXT,
  ADD COLUMN cover_letter_instructions_draft TEXT;
```

- [ ] **Step 2: Mirror into schema.sql**

In `schema.sql`, after line 285 (`cover_letter_instructions  TEXT, ...`), add:

```sql
  resume_instructions_draft        TEXT,   -- saved draft of the résumé instructions box (survives reload; NULL = mirror generated-with)
  cover_letter_instructions_draft  TEXT,   -- saved draft of the cover-letter instructions box
```

- [ ] **Step 3: Apply the migration to Supabase (prod DB — additive, safe)**

Use the Supabase MCP `apply_migration` tool with name `instruction_drafts` and the SQL from Step 1. Confirm the target project first with `list_projects` (the job-board prod project — see the deploy-topology memory). Additive nullable columns: no backfill, no lock risk.

- [ ] **Step 4: Verify the columns exist**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'application_packages'
  AND column_name IN ('resume_instructions_draft','cover_letter_instructions_draft')
ORDER BY column_name;
```

Expected: two rows — `cover_letter_instructions_draft`, `resume_instructions_draft`.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-07-08-instruction-drafts.sql schema.sql
git commit -m "feat(db): instruction-draft columns on application_packages"
```

---

### Task 2: queries.ts + types.ts — read/write plumbing

**Files:**
- Modify: `dashboard/lib/types.ts:209-210` (ApplicationPackage type)
- Modify: `dashboard/lib/queries.ts` — `toApplicationPackage` (~391-392), the two SELECT lists (`getApplicationPackage` ~421-424, `getApplicationPackages` ~442-445), `upsertApplicationPackage` (RETURNING ~570-573 and the ON CONFLICT SET block ~563-568), and add a new `upsertInstructionDraft` export.

**Interfaces:**
- Consumes: columns from Task 1.
- Produces:
  - `ApplicationPackage.resumeInstructionsDraft: string | null`, `ApplicationPackage.coverLetterInstructionsDraft: string | null`.
  - `upsertInstructionDraft(userId: string, jobId: string, leg: "resume" | "cover", value: string): Promise<void>` — writes ONLY that leg's draft column (creates a bare `prepared` row if none exists), leaving all artifact columns untouched.
  - `upsertApplicationPackage` now clears the matching draft column to `NULL` whenever a new artifact of that leg is written.

- [ ] **Step 1: Extend the ApplicationPackage type**

`dashboard/lib/types.ts`, in the `ApplicationPackage` interface right after `coverLetterInstructions: string | null;` (line 210), add:

```ts
  resumeInstructionsDraft: string | null;
  coverLetterInstructionsDraft: string | null;
```

- [ ] **Step 2: Map the columns in `toApplicationPackage`**

`dashboard/lib/queries.ts`, after line 392 (`coverLetterInstructions: (row.cover_letter_instructions as string | null) ?? null,`), add:

```ts
    resumeInstructionsDraft: (row.resume_instructions_draft as string | null) ?? null,
    coverLetterInstructionsDraft: (row.cover_letter_instructions_draft as string | null) ?? null,
```

- [ ] **Step 3: Add the columns to both SELECT lists**

In `getApplicationPackage` (~line 423) and `getApplicationPackages` (~line 444), the line reads:

```sql
             ap.resume_instructions, ap.cover_letter_instructions,
```

Change BOTH occurrences to:

```sql
             ap.resume_instructions, ap.cover_letter_instructions,
             ap.resume_instructions_draft, ap.cover_letter_instructions_draft,
```

- [ ] **Step 4: Clear the draft in lockstep inside `upsertApplicationPackage`**

In `upsertApplicationPackage`'s `ON CONFLICT ... DO UPDATE SET`, after the existing `cover_letter_instructions = CASE ... END,` block (ends ~line 568), add:

```sql
      -- A freshly written artifact supersedes any pending saved draft for that leg:
      -- clear it so the box now mirrors the generated-with value (reads "applied").
      resume_instructions_draft = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                       THEN NULL
                                       ELSE application_packages.resume_instructions_draft END,
      cover_letter_instructions_draft = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                             THEN NULL
                                             ELSE application_packages.cover_letter_instructions_draft END,
```

The INSERT column list is NOT changed — on a fresh insert both draft columns default to `NULL` (a new generate carries no pending draft). Also extend the `RETURNING` list (~line 572) from:

```sql
              resume_instructions, cover_letter_instructions,
```

to:

```sql
              resume_instructions, cover_letter_instructions,
              resume_instructions_draft, cover_letter_instructions_draft,
```

- [ ] **Step 5: Add the `upsertInstructionDraft` query**

`dashboard/lib/queries.ts`, immediately after the `upsertApplicationPackage` function (after line 577), add:

```ts
// Persist ONLY the saved DRAFT of one leg's generation-instructions box, independent of
// generating (Save button). Never touches resume_json/cover_letter_json/etc.; creates a
// bare 'prepared' row if none exists yet (benign — every pane is content-gated on
// resume/coverLetter, and the applied set is status='applied'-gated). Empty string is a
// valid saved value; the column is left as the caller passes it.
export async function upsertInstructionDraft(
  userId: string,
  jobId: string,
  leg: "resume" | "cover",
  value: string,
): Promise<void> {
  await withUserSql(userId, async (tx) => {
    if (leg === "resume") {
      await tx`
        INSERT INTO application_packages
          (user_id, job_id, resume_instructions_draft, status, prepared_at)
        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
        ON CONFLICT (user_id, job_id) DO UPDATE SET
          resume_instructions_draft = EXCLUDED.resume_instructions_draft
      `;
    } else {
      await tx`
        INSERT INTO application_packages
          (user_id, job_id, cover_letter_instructions_draft, status, prepared_at)
        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
        ON CONFLICT (user_id, job_id) DO UPDATE SET
          cover_letter_instructions_draft = EXCLUDED.cover_letter_instructions_draft
      `;
    }
  });
}
```

- [ ] **Step 6: Typecheck + run the existing suite (no regressions)**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: typecheck clean; all existing tests still PASS (this task adds no new tests — behavior is covered by Task 3's action test and Task 4's component test).

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts
git commit -m "feat(queries): read/write instruction-draft columns + lockstep clear on generate"
```

---

### Task 3: `saveGenerationInstructions` server action

**Files:**
- Create: `dashboard/app/actions/generationInstructions.ts`
- Test: `dashboard/lib/generationInstructions.action.test.ts` (colocated with the other `*.action.test.ts`)

**Interfaces:**
- Consumes: `upsertInstructionDraft` (Task 2), `INSTRUCTIONS_MAX_LENGTH` + (guard) from `lib/rolefit/generationInstructions.ts`.
- Produces: `saveGenerationInstructions(jobId: string, patch: { resumeInstructions?: string; coverLetterInstructions?: string }): Promise<{ ok: true }>`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/generationInstructions.action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const draftMock = vi.fn(async () => undefined);
vi.mock("@/lib/queries", () => ({
  upsertInstructionDraft: (...a: unknown[]) =>
    (draftMock as unknown as (...args: unknown[]) => unknown)(...a),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: vi.fn(async () => "u1") }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveGenerationInstructions } from "@/app/actions/generationInstructions";

beforeEach(() => draftMock.mockReset());

describe("saveGenerationInstructions", () => {
  it("writes only the résumé leg when only résumé instructions are given", async () => {
    const res = await saveGenerationInstructions("j1", { resumeInstructions: "  Focus infra  " });
    expect(res).toEqual({ ok: true });
    expect(draftMock).toHaveBeenCalledOnce();
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "resume", "Focus infra"); // trimmed
  });

  it("writes only the cover leg when only cover instructions are given", async () => {
    await saveGenerationInstructions("j1", { coverLetterInstructions: "Mention launch" });
    expect(draftMock).toHaveBeenCalledOnce();
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "cover", "Mention launch");
  });

  it("preserves an empty saved value as '' (does NOT collapse to null)", async () => {
    await saveGenerationInstructions("j1", { resumeInstructions: "   " });
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "resume", "");
  });

  it("rejects over-cap input and writes nothing", async () => {
    await expect(
      saveGenerationInstructions("j1", { resumeInstructions: "x".repeat(4001) }),
    ).rejects.toThrow(/too long/i);
    expect(draftMock).not.toHaveBeenCalled();
  });

  it("no-ops (no write) when the patch has neither leg", async () => {
    const res = await saveGenerationInstructions("j1", {});
    expect(res).toEqual({ ok: true });
    expect(draftMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npx vitest run lib/generationInstructions.action.test.ts`
Expected: FAIL — `Cannot find module '@/app/actions/generationInstructions'`.

- [ ] **Step 3: Implement the action**

Create `dashboard/app/actions/generationInstructions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { upsertInstructionDraft } from "@/lib/queries";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

// Persist the SAVED DRAFT of a per-job generation-instructions box, independent of
// generating (the Save button). Un-gated — plain text, no LLM cost, like cover-letter
// edits (app/actions/coverLetterEdits.ts). Each Save button is per-leg, so `patch`
// normally carries exactly one leg; both are supported for completeness.
//
// NOTE: unlike normalizeInstructions (which collapses blank -> null for GENERATION),
// a blank draft is stored as "" so a cleared+saved box persists as a real empty value
// and survives reload (reads "not applied" until regenerated).
export async function saveGenerationInstructions(
  jobId: string,
  patch: { resumeInstructions?: string; coverLetterInstructions?: string },
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no writing through a stale JWT for an erased account

  const guard = (raw: string, label: string): string => {
    if (raw.length > INSTRUCTIONS_MAX_LENGTH) {
      throw new Error(`${label} instructions too long (max ${INSTRUCTIONS_MAX_LENGTH} characters)`);
    }
    return raw.trim();
  };

  if (patch.resumeInstructions !== undefined) {
    await upsertInstructionDraft(userId, jobId, "resume", guard(patch.resumeInstructions, "résumé"));
  }
  if (patch.coverLetterInstructions !== undefined) {
    await upsertInstructionDraft(userId, jobId, "cover", guard(patch.coverLetterInstructions, "cover letter"));
  }

  revalidatePath("/");
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npx vitest run lib/generationInstructions.action.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/actions/generationInstructions.ts dashboard/lib/generationInstructions.action.test.ts
git commit -m "feat(actions): saveGenerationInstructions persists instruction drafts"
```

---

### Task 4: `GenerationInstructions.tsx` — Save button + applied badge

**Files:**
- Modify: `dashboard/components/rolefit/GenerationInstructions.tsx`
- Test: `dashboard/components/rolefit/GenerationInstructions.test.tsx` (extend)

**Interfaces:**
- Consumes: nothing new (pure props).
- Produces (new optional props on `GenerationInstructionsProps`):
  - `onSave?: () => Promise<void>` — absent ⇒ no Save button.
  - `dirty?: boolean` — box differs from the persisted saved value ⇒ Save enabled.
  - `appliedState?: "none" | "applied" | "pending"` — `"none"` (default) renders no badge.

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/components/rolefit/GenerationInstructions.test.tsx` (inside the `describe`):

```tsx
  test("Save button is disabled when not dirty and enabled when dirty", () => {
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={async () => {}} dirty={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect((screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <GenerationInstructions value="Focus more" onChange={() => {}} kind="résumé" onSave={async () => {}} dirty={true} />,
    );
    expect((screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("clicking Save invokes onSave and then shows a Saved confirmation", async () => {
    const onSave = vi.fn(async () => {});
    render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={onSave} dirty={true} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(await screen.findByText(/saved/i)).toBeTruthy();
  });

  test("renders no Save button when onSave is absent", () => {
    render(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" />);
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  test("applied badge reflects appliedState", () => {
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="applied" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect(screen.getByText(/applied to current résumé/i)).toBeTruthy();
    rerender(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="pending" />);
    expect(screen.getByText(/not yet applied/i)).toBeTruthy();
    rerender(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="none" />);
    expect(screen.queryByText(/applied/i)).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npx vitest run components/rolefit/GenerationInstructions.test.tsx`
Expected: FAIL — no Save button / no badge text found.

- [ ] **Step 3: Implement the component**

Replace `dashboard/components/rolefit/GenerationInstructions.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

export interface GenerationInstructionsProps {
  /** Current instructions text ("" = none). */
  value: string;
  onChange: (v: string) => void;
  /** Labels the placeholder + badge, e.g. "résumé" or "cover letter". */
  kind: string;
  /** Persist the box independently of generating. Absent ⇒ no Save button. */
  onSave?: () => Promise<void>;
  /** Box differs from the persisted saved value ⇒ Save enabled. */
  dirty?: boolean;
  /** Whether the shown artifact reflects the box. "none" ⇒ no badge (idle / no artifact). */
  appliedState?: "none" | "applied" | "pending";
}

// Per-job "Generation instructions" expander. The text rides the NEXT generate/regenerate;
// Save persists it independently (survives reload). The applied badge compares the box
// against the instructions the current artifact was generated with.
export function GenerationInstructions({
  value,
  onChange,
  kind,
  onSave,
  dirty = false,
  appliedState = "none",
}: GenerationInstructionsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave();
      setJustSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (v: string) => {
    if (justSaved) setJustSaved(false); // a fresh edit invalidates the "Saved" confirmation
    onChange(v);
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontWeight: 700, fontSize: "12px", color: "var(--text-secondary)",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "6px 11px", cursor: "pointer",
        }}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        Generation instructions
        {!open && value.trim() && (
          <span style={{ color: "var(--accent)", fontWeight: 800 }}>·</span>
        )}
      </button>
      {open && (
        <>
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={INSTRUCTIONS_MAX_LENGTH}
            rows={3}
            placeholder={`Optional — what the ${kind} should focus on or avoid. Applies on the next generate.`}
            style={{
              width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
              lineHeight: 1.5, border: "1px solid var(--border)", borderRadius: "9px",
              resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", minHeight: "26px" }}>
            {onSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                style={{
                  fontWeight: 700, fontSize: "12px",
                  color: "var(--text-on-accent)", background: "var(--accent)",
                  border: "none", borderRadius: "8px", padding: "6px 14px",
                  cursor: !dirty || saving ? "not-allowed" : "pointer",
                  opacity: !dirty || saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {onSave && justSaved && !dirty && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success)" }} aria-live="polite">
                ✓ Saved
              </span>
            )}
            {appliedState === "applied" && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginLeft: "auto" }}>
                ✓ Applied to current {kind}
              </span>
            )}
            {appliedState === "pending" && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)", marginLeft: "auto" }}>
                ● Not yet applied — Regenerate to apply
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npx vitest run components/rolefit/GenerationInstructions.test.tsx`
Expected: PASS (original 2 + 4 new tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/GenerationInstructions.tsx dashboard/components/rolefit/GenerationInstructions.test.tsx
git commit -m "feat(rolefit): Save button + applied-status badge on GenerationInstructions"
```

---

### Task 5: Wire Save + applied through the board and panels

**Files:**
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (seed maps, saved maps, save handlers, settle reset, prop pass-through)
- Modify: `dashboard/components/rolefit/JobDetail.tsx` (accept saved maps + save handlers; compute + forward dirty/appliedState per leg)
- Modify: `dashboard/components/rolefit/ApplicationPanel.tsx` (accept + forward the 6 new props; render cover-leg props)
- Modify: `dashboard/components/rolefit/ResumePanel.tsx` (accept + forward résumé-leg props to both GenerationInstructions render sites)

**Interfaces:**
- Consumes: `saveGenerationInstructions` (Task 3); `GenerationInstructions` props `onSave`/`dirty`/`appliedState` (Task 4); `ApplicationPackage.resumeInstructionsDraft`/`coverLetterInstructionsDraft` (Task 2).
- Produces: no exported API — internal prop threading.

- [ ] **Step 1: Seed the box + saved maps from draft ?? generated-with (RolefitBoard)**

In `RolefitBoard.tsx`, replace the two instruction-seed blocks (lines 231-239) with draft-preferring seeds, and add two `saved*` maps seeded identically:

```tsx
  // Per-job generation instructions. Box seeds from the saved DRAFT (persisted, survives
  // reload) and falls back to the generated-with value; typing rides the next generate.
  const seedInstr = (pick: (p: ApplicationPackage) => string | null): Record<string, string> => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) {
      const v = pick(p);
      if (v != null) m[p.jobId] = v; // "" is a valid saved value — keep it
    }
    return m;
  };
  const [resumeInstructions, setResumeInstructions] = useState<Record<string, string>>(() =>
    seedInstr((p) => p.resumeInstructionsDraft ?? p.resumeInstructions),
  );
  const [coverInstructions, setCoverInstructions] = useState<Record<string, string>>(() =>
    seedInstr((p) => p.coverLetterInstructionsDraft ?? p.coverLetterInstructions),
  );
  // The persisted value the box would reload to — drives Save "dirty" and the ✓ Saved state.
  const [savedResumeInstructions, setSavedResumeInstructions] = useState<Record<string, string>>(() =>
    seedInstr((p) => p.resumeInstructionsDraft ?? p.resumeInstructions),
  );
  const [savedCoverInstructions, setSavedCoverInstructions] = useState<Record<string, string>>(() =>
    seedInstr((p) => p.coverLetterInstructionsDraft ?? p.coverLetterInstructions),
  );
```

(Keep the existing `handleResumeInstructionsChange` / `handleCoverInstructionsChange` at 241-246 unchanged.)

- [ ] **Step 2: Add save handlers (RolefitBoard)**

Add the import at the top of `RolefitBoard.tsx` (near the other action imports):

```tsx
import { saveGenerationInstructions } from "@/app/actions/generationInstructions";
```

After `handleCoverInstructionsChange` (line 246), add:

```tsx
  const handleSaveResumeInstructions = useCallback(async (jobId: string) => {
    const value = (resumeInstructions[jobId] ?? "").trim();
    try {
      await saveGenerationInstructions(jobId, { resumeInstructions: value });
      setSavedResumeInstructions((m) => ({ ...m, [jobId]: value }));
    } catch (e) {
      showActionError(`Couldn't save instructions: ${(e as Error).message}`);
      throw e; // let GenerationInstructions skip its "✓ Saved" confirmation
    }
  }, [resumeInstructions, showActionError]);
  const handleSaveCoverInstructions = useCallback(async (jobId: string) => {
    const value = (coverInstructions[jobId] ?? "").trim();
    try {
      await saveGenerationInstructions(jobId, { coverLetterInstructions: value });
      setSavedCoverInstructions((m) => ({ ...m, [jobId]: value }));
    } catch (e) {
      showActionError(`Couldn't save instructions: ${(e as Error).message}`);
      throw e;
    }
  }, [coverInstructions, showActionError]);
```

- [ ] **Step 3: Reset saved maps on regenerate settle (RolefitBoard)**

In `applySettledReady` (starts ~line 943), right after `setPackages((p) => ({ ...p, [g.jobId]: pkg }));` (line 944), add:

```tsx
    // A fresh artifact cleared the draft server-side (upsert lockstep): re-baseline the
    // saved value to the new generated-with so Save reads "not dirty" and the box reads
    // "applied". "" stays "".
    setSavedResumeInstructions((m) => ({ ...m, [g.jobId]: pkg.resumeInstructionsDraft ?? pkg.resumeInstructions ?? "" }));
    setSavedCoverInstructions((m) => ({ ...m, [g.jobId]: pkg.coverLetterInstructionsDraft ?? pkg.coverLetterInstructions ?? "" }));
```

- [ ] **Step 4: Pass the saved maps + save handlers to JobDetail (RolefitBoard)**

At the `<JobDetail ... />` render, after the existing instruction props (lines 1271-1274) add:

```tsx
                    savedResumeInstructions={savedResumeInstructions}
                    savedCoverInstructions={savedCoverInstructions}
                    onSaveResumeInstructions={handleSaveResumeInstructions}
                    onSaveCoverInstructions={handleSaveCoverInstructions}
```

- [ ] **Step 5: JobDetail — accept the props and compute dirty/appliedState per leg**

In `JobDetail.tsx`, extend the props interface (after line 81, the `onCoverInstructionsChange` prop):

```tsx
  savedResumeInstructions: Record<string, string>;
  savedCoverInstructions: Record<string, string>;
  onSaveResumeInstructions: (jobId: string) => Promise<void>;
  onSaveCoverInstructions: (jobId: string) => Promise<void>;
```

Add them to the destructured params (after line 132):

```tsx
  savedResumeInstructions,
  savedCoverInstructions,
  onSaveResumeInstructions,
  onSaveCoverInstructions,
```

Pass the six values into `<ApplicationPanel>` (add after line 647). The expressions are
**inlined into the props** (no intermediate `const`s) so they're valid regardless of the
surrounding JSX context. `genState`, `coverState`, and `pkg` are already in JobDetail's
scope (see lines 629, 639, 656); the box maps come from the existing instruction props.
The `appliedState` string-literal ternary narrows correctly against the prop's
`"none" | "applied" | "pending"` type.

```tsx
            resumeInstructionsDirty={(resumeInstructions[job.id] ?? "").trim() !== (savedResumeInstructions[job.id] ?? "").trim()}
            resumeInstructionsApplied={
              genState !== "done" ? "none"
                : (resumeInstructions[job.id] ?? "").trim() === (pkg?.resumeInstructions ?? "").trim() ? "applied" : "pending"
            }
            onSaveResumeInstructions={() => onSaveResumeInstructions(job.id)}
            coverInstructionsDirty={(coverInstructions[job.id] ?? "").trim() !== (savedCoverInstructions[job.id] ?? "").trim()}
            coverInstructionsApplied={
              coverState !== "done" ? "none"
                : (coverInstructions[job.id] ?? "").trim() === (pkg?.coverLetterInstructions ?? "").trim() ? "applied" : "pending"
            }
            onSaveCoverInstructions={() => onSaveCoverInstructions(job.id)}
```

- [ ] **Step 6: ApplicationPanel — accept + forward the 6 props**

In `ApplicationPanel.tsx`, extend the props interface (after line 53, the `onCoverInstructionsChange` prop):

```tsx
  resumeInstructionsDirty: boolean;
  resumeInstructionsApplied: "none" | "applied" | "pending";
  onSaveResumeInstructions: () => Promise<void>;
  coverInstructionsDirty: boolean;
  coverInstructionsApplied: "none" | "applied" | "pending";
  onSaveCoverInstructions: () => Promise<void>;
```

Add to the destructured params (after line 99):

```tsx
  resumeInstructionsDirty,
  resumeInstructionsApplied,
  onSaveResumeInstructions,
  coverInstructionsDirty,
  coverInstructionsApplied,
  onSaveCoverInstructions,
```

Forward the résumé-leg props to `<ResumePanel>` — after line 387 (`onInstructionsChange={onResumeInstructionsChange}`):

```tsx
        onSaveInstructions={onSaveResumeInstructions}
        instructionsDirty={resumeInstructionsDirty}
        instructionsApplied={resumeInstructionsApplied}
```

Pass the cover-leg props to BOTH cover-letter `<GenerationInstructions>` render sites (lines 414 and 629). Change each from:

```tsx
              <GenerationInstructions value={coverInstructions} onChange={onCoverInstructionsChange} kind="cover letter" />
```

to:

```tsx
              <GenerationInstructions
                value={coverInstructions}
                onChange={onCoverInstructionsChange}
                kind="cover letter"
                onSave={onSaveCoverInstructions}
                dirty={coverInstructionsDirty}
                appliedState={coverInstructionsApplied}
              />
```

- [ ] **Step 7: ResumePanel — accept + forward to both GenerationInstructions render sites**

In `ResumePanel.tsx`, extend `ResumePanelProps` (after line 47, the `onInstructionsChange` prop):

```tsx
  onSaveInstructions: () => Promise<void>;
  instructionsDirty: boolean;
  instructionsApplied: "none" | "applied" | "pending";
```

Add to the destructured params (after line 67, `onInstructionsChange,`):

```tsx
  onSaveInstructions,
  instructionsDirty,
  instructionsApplied,
```

Update BOTH `<GenerationInstructions>` render sites (lines 175 and 388) from:

```tsx
            <GenerationInstructions value={instructions} onChange={onInstructionsChange} kind="résumé" />
```

to:

```tsx
            <GenerationInstructions
              value={instructions}
              onChange={onInstructionsChange}
              kind="résumé"
              onSave={onSaveInstructions}
              dirty={instructionsDirty}
              appliedState={instructionsApplied}
            />
```

- [ ] **Step 8: Typecheck + full test run**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: typecheck clean; all tests PASS. If any existing test constructs `<ResumePanel>` / `<ApplicationPanel>` / `<JobDetail>` directly, add the new required props (mirror `ApplicationPanel.edited.test.tsx`, which already supplies instruction props — supply `onSaveResumeInstructions={async () => {}}`, `resumeInstructionsDirty={false}`, `resumeInstructionsApplied="none"`, and the cover equivalents).

- [ ] **Step 9: Commit**

```bash
git add dashboard/components/rolefit/RolefitBoard.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/ApplicationPanel.tsx dashboard/components/rolefit/ResumePanel.tsx
git commit -m "feat(rolefit): wire instruction Save + applied-status through board and panels"
```

---

### Task 6: End-to-end verification (real app)

**Files:** none (verification only).

- [ ] **Step 1: Drive the flow locally against prod DB**

Follow the local authed-page dev-shim memory (`dashboard/.env.local` NEXT_PUBLIC_SUPABASE_* + `DEV_USER_ID`) to render the board authed. In the résumé panel of a job: (a) type instructions, confirm **Save** enables; (b) click Save → **✓ Saved**, badge shows **● Not yet applied** if a résumé already exists; (c) reload the page → the box still holds the saved text (persisted); (d) click **Regenerate**, wait for the completion toast → badge flips to **✓ Applied to current résumé** and Save is disabled. Repeat for the cover-letter leg.

Run: `cd dashboard && npm run dev` and drive via claude-in-chrome (invoke the claude-in-chrome skill first).
Expected: all four sub-steps behave as described; no console errors.

- [ ] **Step 2: Confirm persistence in the DB**

Via Supabase MCP `execute_sql`, after a Save-without-regenerate:

```sql
SELECT resume_instructions, resume_instructions_draft
FROM application_packages
WHERE job_id = '<the-job-id>' LIMIT 1;
```

Expected: `resume_instructions_draft` holds the saved text; `resume_instructions` still holds the older generated-with value (or NULL if never generated). After a regenerate, `resume_instructions_draft` is NULL and `resume_instructions` equals the new instructions.

---

## Deployment note

This plan's migration is applied in Task 1 Step 3 (additive, before any code lands). After all tasks pass and the branch is reviewed, push follows the normal push-to-main → Vercel auto-deploy (deploy-topology memory). No Railway/Python changes.

## Self-Review

- **Spec coverage:** Data model (Task 1–2), Save mechanism/action (Task 3), generate-clears-draft lockstep (Task 2 Step 4), UI Save+badge (Task 4), state semantics incl. empty-string + pre-generation via saved maps (Task 5 Steps 1–3), prop threading (Task 5 Steps 4–7), migration + apply-before-deploy (Task 1), tests (Tasks 3–4 + Task 5 Step 8), E2E (Task 6). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `appliedState: "none"|"applied"|"pending"`, `dirty: boolean`, `onSave: () => Promise<void>` used consistently across component (Task 4) and every wiring layer (Task 5). `upsertInstructionDraft(userId, jobId, leg, value)` and `saveGenerationInstructions(jobId, patch)` signatures match between definition (Tasks 2–3) and callers (Task 5). Draft field names `resumeInstructionsDraft`/`coverLetterInstructionsDraft` consistent from type (Task 2) through seeds/derivations (Task 5).
