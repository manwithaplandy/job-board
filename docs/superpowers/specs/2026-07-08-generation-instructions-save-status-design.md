# Generation instructions: Save button + applied-status indicator

**Date:** 2026-07-08
**Status:** Approved design → implementation plan

## Problem

The per-job "Generation instructions" box (`GenerationInstructions.tsx`) already feeds
the **next** generate/regenerate: the box text rides the request body
(`RolefitBoard.tsx:820,858,902`) and the route persists it. So editing instructions and
hitting **Regenerate** already uses the new text — that part works today.

Two gaps remain:

1. **No feedback.** Typing gives no positive signal. The code comment even calls the box
   "deliberately ephemeral local state" — it is only persisted as a *side-effect of
   generating*. If you type instructions and don't regenerate, a full page reload loses
   them.
2. **No applied indicator.** Nothing tells the user whether the currently-shown
   résumé/cover reflects the instructions in the box.

## Goal

- **Save** button that persists the box **independent of generating** (survives reload).
- **Applied-status** indicator: does the shown artifact reflect the box's instructions?

Target flow (résumé leg, mirrored for cover letter):

```
edit box → [Save] → "✓ Saved"   (persisted, survives reload)
                    "● Not yet applied — Regenerate to apply"
        → Regenerate → "✓ Applied to current résumé"
```

## Key architectural fact

`application_packages.resume_instructions` / `cover_letter_instructions` are stamped **in
lockstep with the artifact** (`queries.ts:563-568`) — they already mean *"the instructions
the current artifact was generated with."* That is exactly the **applied** reference: the
badge compares the box against this column.

A **Save** must NOT write these columns (that would destroy the generated-with reference
and the badge would always read "applied"). Save therefore writes a **separate draft
field**.

## Data model — Approach A (columns on `application_packages`)

Chosen over a separate table: additive, no new-`user_id`-table checklist (RLS trio,
GRANTs, export, deletion are inherited because the columns live on the already-covered
`application_packages` table). Draft-only rows (Save before ever generating) are benign —
verified: every pane seeds from `p.resume`/`p.coverLetter` (content-gated) and the applied
set is `status==='applied'`-gated, so a draft-only `prepared` row surfaces nowhere.

Add two nullable columns:

| column | meaning |
|---|---|
| `resume_instructions` (existing) | **generated-with** reference (applied comparison). Unchanged. |
| `resume_instructions_draft` (new) | **saved box** (survives reload). `NULL` ⇒ box falls back to generated-with. |
| `cover_letter_instructions` (existing) | generated-with reference. Unchanged. |
| `cover_letter_instructions_draft` (new) | saved box. |

`NULL` draft ⇒ existing rows behave exactly as today; **no backfill**.

## State semantics

Let `B` = box (local), `D` = draft column, `G` = generated-with column.

- **Seed on load:** `B = D ?? G ?? ""` (prefer the saved draft).
- **Saved / dirty:** persisted value the box would reload to = `D ?? G`.
  Save is **disabled** when `B.trim() === (D ?? G ?? "").trim()` (nothing new).
- **Applied:** only meaningful once the artifact exists (`gen === "done"`).
  `applied = B.trim() === (G ?? "").trim()`.

Both signals are **derived from `packages[jobId]`** (already board state) — no new state
map. On Save success, optimistically set `packages[jobId].resumeInstructionsDraft = B` so
both signals recompute.

## Generate path stays honest (no route changes)

On generate/regenerate/prepare, the fresh artifact must reset the draft to `NULL` (box now
mirrors the fresh `G` → "applied"). This is done **inside `upsertApplicationPackage`
SQL**, in lockstep with the artifact — so the three routes (`resume`, `cover-letter`,
`application/prepare`) need **no change**:

```sql
resume_instructions_draft = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                 THEN NULL
                                 ELSE application_packages.resume_instructions_draft END,
cover_letter_instructions_draft = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                       THEN NULL
                                       ELSE application_packages.cover_letter_instructions_draft END,
```

On INSERT the draft columns are `NULL` (a fresh generate carries no pending draft). The
existing `resume_instructions`/`cover_letter_instructions` lockstep CASE is unchanged.

## Save mechanism

New server action `app/actions/generationInstructions.ts` mirroring `coverLetterEdits.ts`:

```ts
export async function saveGenerationInstructions(
  jobId: string,
  patch: { resumeInstructions?: string; coverLetterInstructions?: string },
): Promise<{ ok: true }>
```

- `requireUserId()` → `assertNotDeleted(userId)` → `withUserSql` → `revalidatePath("/")`.
- Normalises each provided field with the existing `normalizeInstructions` (same
  `INSTRUCTIONS_MAX_LENGTH` cap the box enforces); an empty string is a valid saved value
  ("no instructions" is a legitimate pending state).
- Un-gated (no LLM cost), like cover-letter edits.
- Calls a new query `upsertInstructionDraft` that writes **only** the draft column(s),
  leaving `resume_json`/`cover_letter_json`/etc. untouched (creating a bare `prepared` row
  if none exists):

```sql
INSERT INTO application_packages (user_id, job_id, resume_instructions_draft, status, prepared_at)
VALUES (${userId}::uuid, ${jobId}, ${draft}, 'prepared', now())
ON CONFLICT (user_id, job_id) DO UPDATE SET
  resume_instructions_draft = EXCLUDED.resume_instructions_draft
-- (cover-letter leg: same shape against cover_letter_instructions_draft)
```

The action patches only the leg(s) present in `patch` (résumé Save and cover Save are
independent buttons), so the query is built per-leg.

## queries.ts changes

- `ApplicationPackage` type (`types.ts`): add `resumeInstructionsDraft: string | null`,
  `coverLetterInstructionsDraft: string | null`.
- `toApplicationPackage`: map `row.resume_instructions_draft`, `row.cover_letter_instructions_draft`.
- Add the two columns to every SELECT/RETURNING list: `getApplicationPackage`,
  `getApplicationPackages`, and `upsertApplicationPackage`'s `RETURNING`.
- `upsertApplicationPackage`: add the two draft-clearing CASE lines above (INSERT columns
  default to `NULL`).
- New `upsertInstructionDraft(userId, jobId, leg, value)` query for the Save action.

## UI

### `GenerationInstructions.tsx` (shared by résumé + cover letter)

New props (all optional so existing tests/usages degrade gracefully):

```ts
onSave?: () => Promise<void>;   // absent ⇒ no Save button (e.g. anon/sample)
dirty?: boolean;                // B !== saved ⇒ Save enabled
appliedState?: "none" | "applied" | "pending";  // "none" until artifact exists
```

Inside the expanded panel, below the textarea:
- **Save button** — disabled when `!dirty`; shows a spinner while `onSave()` awaits; on
  success flips to transient **"✓ Saved"** held in component-local state and cleared on the
  next `onChange`. (Save failure surfaces via the board's existing `showActionError` toast;
  button re-enables.)
- **Applied badge** — copy is parameterised by the existing `kind` prop
  (`"résumé"` / `"cover letter"`): `appliedState==="applied"` → muted
  `"✓ Applied to current {kind}"`; `"pending"` → accent
  `"● Not yet applied — Regenerate to apply"`; `"none"` → nothing (idle: the existing
  placeholder "Applies on the next generate" already covers it).

Styling reuses the existing token vars (`--accent`, `--success`, `--text-secondary`,
`--border`) — matches the Rolefit design system, no new colors.

### Prop threading

`RolefitBoard` (owns the derivations) → `JobDetail` → `ResumePanel` / `ApplicationPanel`,
following the existing `instructions` / `onInstructionsChange` path
(`RolefitBoard.tsx:1271-1274`, `ResumePanel.tsx:175,388`, `ApplicationPanel.tsx:386,414,629`).

In `RolefitBoard`:
- Seed `resumeInstructions` / `coverInstructions` maps from `D ?? G` (was `G` only).
- Derive `dirty` and `appliedState` per job/leg from `packages[jobId]` + local box + `gen`/`coverGen`.
- `handleSaveResumeInstructions(jobId)` / `handleSaveCoverInstructions(jobId)`: call the
  action, on success optimistically set `packages[jobId].*InstructionsDraft = box`.
- `applySettledReady` already refreshes `packages[jobId]` from the reloaded package (draft
  now `NULL`, `G` = fresh instructions) → both signals recompute correctly after regenerate.

## Migration

`migrations/2026-07-08-instruction-drafts.sql`:

```sql
ALTER TABLE application_packages
  ADD COLUMN resume_instructions_draft       TEXT,
  ADD COLUMN cover_letter_instructions_draft TEXT;
```

Mirror the two columns into `schema.sql` (after the existing `*_instructions` columns).
**Apply to Supabase before pushing** the migration-coupled code (migration-before-deploy
gate).

## Tests

- `GenerationInstructions.test.tsx`: Save disabled when `!dirty`; enabled when dirty;
  `onSave` invoked on click; "✓ Saved" after resolve; badge renders the correct copy for
  each `appliedState`.
- `generationInstructions.action.test.ts` (mirror `coverLetterEdits.action.test.ts`):
  résumé-only patch writes `resume_instructions_draft` and leaves `cover_letter_instructions_draft`
  untouched; over-cap value rejected/normalised; draft-only row created when no package exists;
  a subsequent generate clears the draft (upsert lockstep).
- Existing `queries` / route tests: confirm the new columns round-trip and that generate
  nulls the draft.

## Non-goals

- No change to how instructions feed generation (already correct).
- No auto-save/debounce — Save is explicit (matches the chosen design).
- No new table; no separate drafts overlay.
