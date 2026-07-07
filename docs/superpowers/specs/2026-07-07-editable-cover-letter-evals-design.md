# Editable cover letters → golden evals, + per-job generation instructions

**Date:** 2026-07-07
**Status:** Design — awaiting review

## Summary

Let a user edit a generated cover letter in the dashboard, persist that edit, and
capture it as a **golden reference** for offline evals of cover-letter generation.
Add a reference-based LLM judge + a replay/calibrate script so we can measure how
close freshly-generated letters land to the human-edited ideal. Fold in a related
sub-feature: a per-job **"Generation instructions"** box for both the résumé and the
cover letter.

The work closely mirrors two already-shipped features — the résumé-generation eval
(`resume_scores` + `resume-golden` LangFuse dataset + `calibrate-resume-judge.ts`)
and the reviewer-correction overlay (`review_corrections`). It reuses their patterns
rather than inventing new ones.

## Goals

1. A user can edit their generated cover letter (plain-text, single window) and the
   edit persists and displays/downloads over the original.
2. An admin's edit is pushed to a shared `cover-letter-golden` LangFuse dataset
   (`expected_output` = the edited letter) for offline evals.
3. Capture `cover_letter_trace_id` at generation (parallel to `resume_trace_id`) so a
   golden item joins to its generation trace.
4. A **reference-based** LLM judge (grounding + jd_relevance + fidelity-to-ideal) and a
   `calibrate-cover-letter-judge.ts` script that replays generation over the dataset
   and scores each output against its golden reference.
5. A per-job **"Generation instructions"** box (defaults empty) for the résumé and the
   cover letter, threaded into the respective generation prompts.

## Non-goals

- No LangFuse-managed evaluator UI configuration in this task (mirrors the résumé
  eval, whose managed-judge UI setup shipped as a separate manual step). The judge
  here runs from the offline script.
- No per-job instructions box for the Greenhouse **prefill** leg (prefill simply stops
  misusing `profile.instructions`; it becomes instruction-less). Could be added later.
- No change to the reviewer pipeline's use of `profile.instructions`.
- The edited cover letter is stored/rendered/downloaded as **plain text**; we do not
  reconstruct the structured `TailoredCoverLetter` from edited text.
- No change to the existing `resume-golden` dataset input shape. The résumé eval does
  not replay generation (`calibrate-resume-judge.ts` only syncs + calibrates from DB
  scores), so the new `resume_instructions` need not be captured in the résumé golden.
  Capturing it there is a follow-up if a résumé `--run` (generation replay) is ever built.

## Background: the two patterns we mirror

- **`resume_scores`** (`migrations/2026-07-02-resume-scores.sql`,
  `app/actions/resumeScores.ts`, `lib/rolefit/resumeScore.ts`,
  `lib/resumeGoldenDataset.ts`, `components/rolefit/ResumeScorePanel.tsx`,
  `scripts/calibrate-resume-judge.ts`): an **overlay** table keyed `(user_id, job_id)`
  that never mutates `application_packages`; DB write commits first, then a **best-effort,
  admin-gated** push to a shared LangFuse dataset; `resume_trace_id` joins the human
  golden to the judge's trace; a snapshot column pins exactly what was scored.
- **`review_corrections`** (`migrations/2026-06-30-review-corrections.sql`): a human
  **edits/corrects** model output; the correction is COALESCE'd over the model value
  for display everywhere; `expected_output` = the corrected "ideal".

This feature is the `review_corrections` flavor (edit → ideal) with the
`resume_scores` plumbing (overlay + snapshot + admin-gated golden push + trace join).

## Correction incorporated: `profile.instructions` is reviewer-only

`profile.instructions` exists to tell the **job reviewer** which jobs are relevant. It
must **not** drive generation. Today it is (mis)used in two generation paths:

- `app/api/cover-letter/route.ts` and `app/api/application/prepare/route.ts` pass
  `instructions: profile.instructions ?? null` into `generateCoverLetter`.
- `prepare/route.ts:117` passes it into `generatePrefilledAnswers`.

**Change:** remove `profile.instructions` from every generation call. Generation
instructions come solely from the new per-job boxes (résumé, cover). Prefill becomes
instruction-less. The reviewer's use of `profile.instructions` is untouched.

---

## Data model

New migration `migrations/2026-07-07-cover-letter-edits.sql` (applied to Supabase
**before** the code deploys, per the repo's migration-before-code rule):

```sql
BEGIN;

-- Cover-letter edit overlay. Never mutates application_packages. Keyed (user_id, job_id)
-- — one edit per letter per operator; re-editing overwrites (last-write-wins). The
-- edited text is BOTH the product-facing persisted letter AND the golden expected_output.
CREATE TABLE IF NOT EXISTS cover_letter_edits (
  user_id               UUID NOT NULL,
  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  edited_text           TEXT NOT NULL,                        -- human-edited plain-text letter
  original_text         TEXT,                                 -- composed text of the model letter at edit time (eval "before")
  cover_letter_trace_id TEXT,                                 -- join key to the generation's LangFuse trace
  model                 TEXT,                                 -- model that generated the original
  comment               TEXT,                                 -- optional operator note
  superseded_at         TIMESTAMPTZ,                          -- set when a NEWER cover letter is generated; NULL = current
  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_user ON cover_letter_edits (user_id);

-- Symmetric to resume_trace_id: trace id captured at generation so a golden item can
-- reference the judge's trace even after the letter is regenerated.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_trace_id TEXT;

-- Per-job generation instructions (sole generation-instruction source; profile.instructions
-- is reviewer-only). NULL/empty = no extra instructions.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS resume_instructions        TEXT;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_instructions  TEXT;

-- Deny-all RLS (access via the service-role DIRECT connection only), matching resume_scores.
ALTER TABLE cover_letter_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON cover_letter_edits;
CREATE POLICY no_anon_access ON cover_letter_edits FOR ALL USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-07-cover-letter-edits.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

### Superseding semantics (regenerate behavior)

When a new `cover_letter_json` is written, the existing edit row is stamped
`superseded_at = now()` (using the same `EXCLUDED.cover_letter_json IS NOT NULL` guard
already applied to `resume_trace_id` in `upsertApplicationPackage`). Effect:

- **Display**: the edited text renders only while `superseded_at IS NULL`. A regenerate
  therefore cleanly overwrites the user's edit with the fresh letter from their view.
- **Durability**: the row and its already-pushed golden item **persist**. Re-saving an
  edit sets `superseded_at = NULL` and refreshes `edited_text`/`original_text`.
- **`--sync`** reconciles all rows regardless of `superseded_at` (a superseded edit is
  still a valid `(job context → ideal letter)` training pair).

---

## Trace-id capture (parallels the shipped résumé span work)

- `lib/rolefit/coverLetterClient.ts`: `generateCoverLetter` returns
  **`{ letter, traceId }`** instead of a bare `TailoredCoverLetter`
  (`traceId = span.traceId` when tracing on, else `null`). Mirrors `generateResume`'s
  `{ resume, checks, traceId }`.
- `app/api/cover-letter/route.ts` and the prepare route's cover leg read `traceId` and
  pass `coverLetterTraceId` into `upsertApplicationPackage`.
- `lib/queries.ts` `upsertApplicationPackage`: accept `coverLetterTraceId?`,
  `resumeInstructions?`, `coverLetterInstructions?`; write `cover_letter_trace_id`,
  `resume_instructions`, `cover_letter_instructions`. The trace id and instructions use
  the same "only overwrite when the corresponding artifact was (re)written" CASE guard
  as `resume_trace_id`. On writing a new `cover_letter_json`, also
  `UPDATE cover_letter_edits SET superseded_at = now() WHERE user_id=? AND job_id=? AND superseded_at IS NULL`.

---

## Per-job "Generation instructions" (résumé + cover)

### Storage & flow

- Columns `application_packages.resume_instructions`, `cover_letter_instructions`
  (above). Instructions persist **as part of the generate request** — the box's text is
  sent in the POST body, and the route persists it alongside the generated artifact. On
  reload the board seeds each box from the persisted value. (Typing without generating
  is ephemeral local state — a deliberate simplification; no separate save path.)

### Prompt threading

- **Cover letter** (`lib/rolefit/coverLetterSchema.ts` `buildCoverLetterPrompt`): already
  has an `instructions` slot ("CANDIDATE FOCUS / AVOID"). Feed it from the per-job box
  (was `profile.instructions`).
- **Résumé** (`lib/rolefit/resumeSchema.ts` `buildResumePrompt`, `resumeClient.ts`
  `generateResume`): **new** — add an optional `instructions` arg + a "CANDIDATE FOCUS /
  AVOID" block in the prompt (the résumé never used instructions before). `generateResume`
  gains `instructions?: string | null`.
- **Prefill** (`prepare/route.ts` `generatePrefilledAnswers`): remove
  `profile.instructions`; pass nothing.

### API

`/api/resume`, `/api/cover-letter`, and `/api/application/prepare` accept an optional
`instructions` string in the request body (résumé + cover each their own; the prepare
route accepts both `resumeInstructions` and `coverLetterInstructions`). Validate to a
sane length cap (e.g. 4k) and treat empty/whitespace as null.

### UI

A **"Generation instructions"** expander next to each Generate/Regenerate control
(résumé in `ResumePanel`, cover in `ApplicationPanel`), a textarea defaulting empty,
seeded from the persisted per-job value. Its text rides the existing generate/regenerate
request.

---

## Save action + golden push

New `app/actions/coverLetterEdits.ts`, structured exactly like `saveResumeScore`:

```
saveCoverLetterEdit(jobId, editedText, comment?): { ok: true; langfuseSynced: boolean }
```

1. `requireUserId` + `assertNotDeleted`. Validate `editedText` non-empty, length-capped
   (~20k).
2. In one `withUserSql` tx: read `application_packages.cover_letter_json`,
   `cover_letter_trace_id`, `cover_letter_instructions`; the job context
   (title/company/description/about/requirements/skill_gaps/red_flags); profile
   `resume_text`, `full_name`, `model_cover`. Compute
   `original_text = composeCoverLetterText(parseTailoredCoverLetter(cover_letter_json) ?? …)`.
   **Upsert** the `cover_letter_edits` row (`edited_text`, `original_text`,
   `cover_letter_trace_id`, `model`, `comment`, `superseded_at = NULL`, `edited_at = now()`).
   Return the source row for the golden build.
3. **Admin only** (`isAdmin(await getUserClaims())`): build + push the golden item
   (best-effort; `langfuseSynced` flag). Non-admins persist the DB row only.
4. `revalidatePath("/")`.

Also `deleteCoverLetterEdit(jobId)` (the "Reset to generated" control): delete the
overlay row so display reverts to the structured original. The golden item in LangFuse
is left intact (a valid historical capture).

---

## Product UI (cover-letter editor)

In `components/rolefit/ApplicationPanel.tsx` (+ board wiring in `RolefitBoard.tsx`):

- The board loads `coverLetterEditedText` (and its `superseded_at` state → effectively
  "is there a *current* edit") per job: LEFT JOIN `cover_letter_edits` in
  `getApplicationPackages` / `getApplicationPackage`, mapped in `toApplicationPackage`,
  seeding a `coverEdited: Record<jobId, string>` map (only non-superseded edits seed it).
- **Done view**: when a current edit exists, render `edited_text` as pre-wrap text with
  an "Edited" chip; **Download PDF** and **Copy** use the edited text (the existing
  wrapped-text PDF fallback path + `composeCoverLetterText`-shaped string). No edit →
  current structured render.
- **"Edit" button** → a single `<textarea>` prefilled with the current letter text
  (edited, or `composeCoverLetterText(original)`), an optional comment input, and
  Save/Cancel wired to `saveCoverLetterEdit`. **"Reset to generated"** → `deleteCoverLetterEdit`.
- Admin sees the golden-sync status (synced / "will reconcile"), mirroring
  `ResumeScorePanel`.

---

## Eval harness

### `lib/rolefit/coverLetterScore.ts` (runtime-pure — mirrors `resumeScore.ts`)

- `COVER_LETTER_GOLDEN_DATASET_NAME = "cover-letter-golden"`.
- Weights: `GROUNDING_WEIGHT = 0.5`, `FIDELITY_WEIGHT = 0.3`, `JD_RELEVANCE_WEIGHT = 0.2`
  (fabrication still dominant; fidelity is the new comparative signal — tunable).
- `coverLetterOverall(grounding, fidelity, jdRelevance)` → weighted, 1-decimal.
- `CoverLetterGoldenInput`: full generation context needed to replay
  `generateCoverLetter` — `background` (resume_text), `candidateName`, `instructions`
  (the per-job `cover_letter_instructions`), `job` `{title, company, description, about,
  requirements, skillGaps, redFlags}`, `model`.
- `buildCoverLetterGoldenItem({ userId, jobId, input, editedText, comment, traceId,
  model, originalText, editedAt })`:
  - `id = "${userId}:${jobId}"`
  - `expectedOutput = { cover_letter: editedText, comment }`
  - `metadata = { cover_letter_trace_id: traceId, model, original_text: originalText,
    edited_at: editedAt, source: "dashboard" }`

### `lib/coverLetterGoldenDataset.ts` (mirrors `resumeGoldenDataset.ts`)

`upsertCoverLetterGoldenItem(item)`: no-op without LangFuse keys; ensures the dataset
exists; upserts by `id`.

### `lib/rolefit/coverLetterJudgeRubric.ts` (mirrors `resumeJudgeRubric.ts`)

A **reference-based** judge prompt with variables `{{candidate_background}}`,
`{{job_title}}`, `{{company}}`, `{{job_description}}`, `{{cover_letter}}` (the generated
candidate), `{{golden_letter}}` (the human-edited ideal). Output score names EXACTLY
`grounding`, `jd_relevance`, `fidelity` (1–5 each). Exported score-name constants for
the script. Because it needs the reference, this judge is **dataset-run only, not live
traces** (an intentional difference from the reference-free résumé judge).

### `scripts/calibrate-cover-letter-judge.ts`

- `--sync`: reconcile `cover_letter_edits` → `cover-letter-golden` (re-push rows whose
  on-save push failed), mirroring `calibrate-resume-judge.ts --sync`.
- `--run` (default): pull the dataset; for each item **replay `generateCoverLetter(input)`
  → compose text → call the judge LLM with the golden reference → collect grounding /
  jd_relevance / fidelity → aggregate + print a report**, optionally recording a LangFuse
  dataset run with the scores.
- **Runnability**: because `--run` replays live generation, it needs the `@/`-alias
  loader used by `scripts/gen-resume.ts` (NOT the plain relative-import style of
  `calibrate-resume-judge.ts`, which never touches the generation chain). Requires
  `LANGFUSE_*` + `OPENROUTER_API_KEY` + `DATABASE_URL`. Keep `.ts` value imports as-is
  (see the résumé-eval gotcha) — do not "clean up" the extensions.

---

## Cross-cutting: drift guards

A new `user_id` table (`cover_letter_edits`) trips the account-lifecycle drift guards.
Exact edits:

- **`lib/userScopedTables.ts`**: add `cover_letter_edits` to `USER_DELETE_TABLES` (owner
  data, hard-deleted on account erase; not anonymized).
- **`lib/accountExport.ts`**: add the `cover_letter_edits: unknown[]` key to
  `AccountExport`, and a `SELECT * FROM cover_letter_edits WHERE user_id = …` in
  `collectUserRows` (the compile-time `_ExportCoversEveryTable` assertion enforces the
  key exists).
- **`tests/test_rls_isolation.py`**: add `cover_letter_edits` to `_OWNER_TABLES` and the
  insert/delete seed blocks (owner-CRUD, deny-all anon), matching `resume_scores`.

---

## Testing

Mirror the résumé suites:

- `lib/rolefit/coverLetterScore.test.ts` — `coverLetterOverall` + `buildCoverLetterGoldenItem`
  shape.
- `lib/coverLetterGoldenDataset.test.ts` — upsert no-op without keys; upsert payload shape.
- `lib/coverLetterEdits.action.test.ts` — persists for all users; golden push **admin-only**
  (non-admin skips push, `langfuseSynced` stays true); superseded reset on save;
  `deleteCoverLetterEdit` removes the row.
- `lib/rolefit/coverLetterClient` tracing test — `generateCoverLetter` returns `traceId`
  (extend the existing tracing-on test).
- `app/api/cover-letter/route.test.ts` + `app/api/application/prepare/route.test.ts` —
  updated for the new return shape, `cover_letter_trace_id` persistence, and the
  instructions plumbing (no `profile.instructions` in generation).
- `app/api/resume/route.test.ts` — résumé instructions plumbing.
- `lib/queries.upsertApplicationPackage.test.ts` — `cover_letter_trace_id`,
  `resume_instructions`, `cover_letter_instructions` writes + supersede-on-regenerate.
- A jsdom component test for the editor (edit → `saveCoverLetterEdit` called; edited text
  displays over the original; "Reset to generated" calls delete) — follows the jsdom
  gotchas noted for component tests.

---

## File inventory

**New**
- `migrations/2026-07-07-cover-letter-edits.sql`
- `dashboard/lib/rolefit/coverLetterScore.ts` (+ test)
- `dashboard/lib/coverLetterGoldenDataset.ts` (+ test)
- `dashboard/lib/rolefit/coverLetterJudgeRubric.ts`
- `dashboard/app/actions/coverLetterEdits.ts` (+ test)
- `dashboard/scripts/calibrate-cover-letter-judge.ts`
- editor UI (in `ApplicationPanel.tsx`, or a small `CoverLetterEditor.tsx` + jsdom test)

**Modified**
- `dashboard/lib/rolefit/coverLetterClient.ts` — return `{ letter, traceId }`; instructions arg from per-job box
- `dashboard/lib/rolefit/coverLetterSchema.ts` — `buildCoverLetterPrompt` unchanged shape, fed by per-job box
- `dashboard/lib/rolefit/resumeClient.ts` — `generateResume` gains `instructions?`
- `dashboard/lib/rolefit/resumeSchema.ts` — `buildResumePrompt` gains an instructions block
- `dashboard/app/api/cover-letter/route.ts` — capture traceId, persist `cover_letter_trace_id` + `cover_letter_instructions`; drop `profile.instructions`
- `dashboard/app/api/resume/route.ts` — accept + persist `resume_instructions`; thread instructions
- `dashboard/app/api/application/prepare/route.ts` — cover leg traceId + instructions; résumé leg instructions; prefill drops `profile.instructions`
- `dashboard/lib/queries.ts` — `upsertApplicationPackage` (+ new fields + supersede update); `getApplicationPackage(s)` join `cover_letter_edits`; `toApplicationPackage` maps edited text
- `dashboard/components/rolefit/ApplicationPanel.tsx` — editor + edited-over-original display + cover instructions box
- `dashboard/components/rolefit/ResumePanel.tsx` — résumé instructions box
- `dashboard/components/rolefit/RolefitBoard.tsx` — `coverEdited` state, save/reset wiring, instructions state
- `dashboard/lib/userScopedTables.ts`, `dashboard/lib/accountExport.ts`, `tests/test_rls_isolation.py`

---

## Parallelizable workstreams (subagent delegation)

1. **Trace capture** — `generateCoverLetter → {letter, traceId}`; routes; `upsertApplicationPackage` fields + supersede update. (Foundation; others depend on the return-shape change.)
2. **Edit overlay + product display** — migration table, `saveCoverLetterEdit` / `deleteCoverLetterEdit`, ApplicationPanel/board display + superseded logic.
3. **Eval harness** — `coverLetterScore.ts`, `coverLetterGoldenDataset.ts`, `coverLetterJudgeRubric.ts`, `calibrate-cover-letter-judge.ts`.
4. **Per-job generation instructions** — résumé + cover UI boxes, API bodies, prompt threading, persistence; remove `profile.instructions` from all generation legs.
5. **Drift guards + migration wiring + cross-suite tests** — `userScopedTables.ts`, `accountExport.ts`, `test_rls_isolation.py`, plus the shared migration file.

Workstream 1 lands first (it changes `generateCoverLetter`'s return shape, which 2 and
3 build on). 2/3/4/5 can then proceed in parallel.

## Rollout

Per the repo's deploy topology: **apply the migration to Supabase before pushing the
migration-coupled code** (the new columns/table must exist when the deployed routes read
them). Then push to `main`; Vercel auto-deploys. The offline judge/`--run` is operator-run
locally with `LANGFUSE_*` + `OPENROUTER_API_KEY` + `DATABASE_URL`.

## Open / assumed decisions (veto in review)

- Per-job instructions are the **sole** generation-instruction source; `profile.instructions`
  removed from cover + prefill generation (reviewer-only henceforth). Résumé newly honors a
  per-job instructions block.
- Judge weights **grounding 0.5 / fidelity 0.3 / jd_relevance 0.2** (tunable constant).
- Instructions persisted as two `application_packages` columns; ephemeral until a generate
  request carries them.
- "Reset to generated" deletes the local overlay row but leaves the LangFuse golden item.
- No per-job instructions box for prefill (it just stops misusing `profile.instructions`).
