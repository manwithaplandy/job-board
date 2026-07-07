# Editable Cover Letters → Golden Evals (+ Per-Job Generation Instructions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user edit a generated cover letter (persisted overlay, displayed/downloaded over the original), capture admin edits as golden references in a `cover-letter-golden` LangFuse dataset, add a reference-based judge + replay/calibrate script, and add per-job "Generation instructions" boxes for résumé + cover-letter generation.

**Architecture:** A `cover_letter_edits` overlay table keyed `(user_id, job_id)` (never mutates `application_packages`), mirroring the shipped `resume_scores` plumbing (DB-first write, best-effort admin-gated golden push, trace-id join, snapshot) crossed with the `review_corrections` flavor (human edit = the golden `expected_output`). `generateCoverLetter` starts returning `{ letter, traceId }` (mirroring `generateResume`), routes persist `cover_letter_trace_id` + per-job instructions, and a new offline script replays generation over the dataset and judges each output against its golden reference.

**Tech Stack:** Next.js 16 App Router (dashboard/), postgres.js via `withUserSql`, LangFuse `@langfuse/client` + `@langfuse/tracing`, OpenRouter structured outputs, vitest 4 (node + per-file jsdom), pytest (RLS), Node 22 `--experimental-strip-types` scripts.

**Source spec:** `docs/superpowers/specs/2026-07-07-editable-cover-letter-evals-design.md` (approved). Read it before starting a task if anything here seems ambiguous.

## Global Constraints

- **Git:** never `git commit --amend`, rebase, reset, or force-push — commit forward only (repo CLAUDE.md). Work stays on branch `editable-cover-letter-evals`. Do not push; do not touch `main`.
- **Migration-before-code (rollout):** the Supabase migration must be applied before the migration-coupled code deploys. In-repo, Task 1 (migration) lands first so every later task can assume the columns exist.
- **jsonb boundary:** never `as`-cast a jsonb column; every jsonb read goes through a total parser (dashboard/CLAUDE.md). `cover_letter_json` reads use `parseTailoredCoverLetter` (dashboard/lib/rolefit/packageCodec.ts).
- **Scripts keep `.ts` value-import extensions** (e.g. `import { serviceSql } from "../lib/db.ts"`). Do NOT "clean up" the extensions — `tsconfig.json` has `allowImportingTsExtensions` and Node strip-types requires them.
- **The calibrate script needs the `@/`-alias loader**: run with `node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings --import ./scripts/alias-loader.mjs …` (loader like `scripts/gen-resume.ts`, NOT the plain style of `calibrate-resume-judge.ts`) — the `--run` path imports the generation chain, which uses `@/` imports throughout. Env must come from the CLI flag or shell, not `process.loadEnvFile()` (lib/db.ts throws at import time when `DATABASE_URL` is unset).
- **vitest 4 has no `environmentMatchGlobs`:** component tests opt into jsdom with a `// @vitest-environment jsdom` docblock as the FIRST line of the file. jsdom can't assert file-input bytes — assert state, not bytes (not applicable here, but the convention holds).
- **Control-byte scan before every commit:** `LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' <staged files>` must return nothing (generated tests have previously embedded raw NUL/control bytes).
- **Working directories:** vitest/tsc commands run from `/Users/andrew/Scripts/job-board/dashboard`; `git add`/`git commit` blocks use repo-root-relative paths — run them from `/Users/andrew/Scripts/job-board`.
- **Test commands:**
  - Dashboard: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run <file>` (full: `npx vitest run`), typecheck `npx tsc --noEmit`.
  - RLS/DB: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_rls_isolation.py -q` (needs the local Postgres on 55432; without `TEST_DATABASE_URL` the DB tests skip — a skip is NOT a pass for Task 1).
- **Copy style:** UI copy matches the existing Rolefit voice (sentence case, em-dashes, no exclamation marks). Inline `style={{ … }}` with `var(--…)` tokens — this codebase does not use Tailwind.

## Spec-vs-code discrepancies (verified 2026-07-07 — the plan below already incorporates the fixes)

1. **The spec's migration RLS is stale.** It creates only the deny-all `no_anon_access` policy, "matching resume_scores". That matched the *original* `migrations/2026-07-02-resume-scores.sql`, but `resume_scores` has since gained `owner_access` (`migrations/2026-07-03-rls-tenant-isolation.sql:99-101`) and authenticated CRUD grants (`migrations/2026-07-04-cost-cap-hardening.sql:76`). All dashboard reads/writes run through `withUserSql` (`dashboard/lib/db.ts:69` — drops into the `authenticated` role), so a deny-all-only `cover_letter_edits` would reject every save/read, and both live drift-guards (`EXPECTED_RLS` at `tests/test_rls_isolation.py:382` and `EXPECTED_GRANTS` at `:481`) would fail. The migration in Task 1 mirrors the current pattern for a new user table: `migrations/2026-07-05-generation-jobs.sql` (deny-all + `owner_access` + `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`).
2. **The spec omits `schema.sql`.** `tests/conftest.py:11` loads the root `schema.sql` into the test DB, and `dashboard/lib/accountDeletion.test.ts:121` parses `schema.sql` to enforce the user-table classification. The migration must be mirrored into `schema.sql` in the same commit or every DB-backed guard fails.
3. **`calibrate-resume-judge.ts` is currently broken as a template for DB access:** it does `import { sql } from "../lib/db.ts"` (`dashboard/scripts/calibrate-resume-judge.ts:7`), but `lib/db.ts` renamed that export to `serviceSql` in the go-public merge (e711cbd). `scripts/` is excluded from `tsc` (`dashboard/tsconfig.json` `exclude`), so nothing caught it. The new script imports `{ serviceSql }` (Task 16). **The résumé script is fixed by Task 17** — added at the user's request as an independent, pre-existing bug fix (not otherwise part of this feature; no dependency on the other tasks).
4. **Company name in the golden input:** `saveResumeScore` uses bare `c.name`, but the generation queries (`getJobForCoverLetter`, `queries.ts:298`) use `COALESCE(c.display_name, c.name)`. The golden input must replay generation faithfully, so this plan uses the COALESCE form.
5. Everything else the spec cites was verified accurate: `generateCoverLetter` returns a bare `TailoredCoverLetter` today (`coverLetterClient.ts:22`), `profile.instructions` feeds cover generation at `app/api/cover-letter/route.ts:83`, the prepare route's cover leg at `route.ts:156` and prefill at `route.ts:117`, the `resume_trace_id` CASE guard at `lib/queries.ts:496-498`, the export compile-time assertion at `lib/accountExport.ts:50-55`.

## File structure

**New files**

| File | Responsibility |
|---|---|
| `migrations/2026-07-07-cover-letter-edits.sql` | overlay table + 3 `application_packages` columns + RLS/grants |
| `dashboard/lib/rolefit/coverLetterScore.ts` (+`.test.ts`) | runtime-pure: dataset name, judge weights, `coverLetterOverall`, golden-item builder |
| `dashboard/lib/coverLetterGoldenDataset.ts` (+`.test.ts`) | LangFuse dataset upsert (no-op without keys) |
| `dashboard/lib/rolefit/coverLetterJudgeRubric.ts` | reference-based judge prompt + score-name constants + variable substitution |
| `dashboard/lib/rolefit/generationInstructions.ts` (+`.test.ts`) | shared request-body instruction normalizer (cap 4000, blank→null) |
| `dashboard/app/actions/coverLetterEdits.ts` (+ `dashboard/lib/coverLetterEdits.action.test.ts`) | `saveCoverLetterEdit` / `deleteCoverLetterEdit` server actions |
| `dashboard/components/rolefit/CoverLetterEditor.tsx` (+`.test.tsx`) | textarea editor + save/cancel/reset, calls the actions |
| `dashboard/components/rolefit/GenerationInstructions.tsx` (+`.test.tsx`) | collapsible per-job instructions textarea |
| `dashboard/components/rolefit/ApplicationPanel.edited.test.tsx` | jsdom proof that an edit renders over the structured letter |
| `dashboard/lib/queries.coverLetterEdits.test.ts` | SQL-shape guard for the new join/columns + `toApplicationPackage` mapping |
| `dashboard/scripts/calibrate-cover-letter-judge.ts` | `--sync` reconcile + `--run` replay-and-judge report |

**Modified files**

| File | Change |
|---|---|
| `schema.sql` | mirror the migration (table, columns, policies, grant) |
| `tests/test_rls_isolation.py` | seeds, `_OWNER_TABLES`, `EXPECTED_RLS`, `EXPECTED_GRANTS` |
| `dashboard/lib/userScopedTables.ts` | `cover_letter_edits` → `USER_DELETE_TABLES` |
| `dashboard/lib/accountExport.ts` (+ its test fixtures) | export key + query |
| `dashboard/lib/rolefit/coverLetterClient.ts` (+ 2 test files) | return `{ letter, traceId }` |
| `dashboard/lib/rolefit/resumeSchema.ts` / `resumeClient.ts` (+ tests) | résumé prompt/client gain `instructions` |
| `dashboard/lib/queries.ts` | upsert new fields + supersede; reads join `cover_letter_edits`; `toApplicationPackage` maps new fields |
| `dashboard/lib/types.ts` | `ApplicationPackage` gains 3 fields |
| `dashboard/app/api/cover-letter/route.ts`, `app/api/resume/route.ts`, `app/api/application/prepare/route.ts` (+ tests) | trace-id capture, body instructions, drop `profile.instructions` from generation |
| `dashboard/components/rolefit/ApplicationPanel.tsx`, `ResumePanel.tsx`, `JobDetail.tsx`, `RolefitBoard.tsx` | edited-letter display + editor wiring + instruction boxes |
| `dashboard/scripts/calibrate-resume-judge.ts` | Task 17: fix pre-existing broken `sql`→`serviceSql` import (independent of this feature) |

## Task graph (spec workstreams → tasks)

```
WS5 (DB+drift guards):  Task 1  ──────────────────────────────┐
WS1 (trace capture):    Task 2 → Task 3 → Task 5, 7           │  Tasks 5,6,7 also carry the
WS4 (instructions core):Task 4 ─┴────────→ Task 6             │  instructions plumbing so no
WS3 (eval harness):     Task 8 → Task 9 ──────→ Task 16       │  two tasks fight over a route
WS2 (edit overlay):     Task 10 → Task 11 → Task 12 → Task 13 │
WS4 (instructions UI):  Task 14 → Task 15 (after 13 — shares ApplicationPanel/JobDetail/RolefitBoard)
Standalone:             Task 17 (fix calibrate-resume-judge.ts — pre-existing bug, no deps, run any time)
Final:                  Task 18 (full sweep)
```

Dependencies stated per task. If workstreams are handed to parallel subagents: WS2 (Tasks 10–13) and WS4-UI (Tasks 14–15) both modify `ApplicationPanel.tsx`/`JobDetail.tsx`/`RolefitBoard.tsx` — run Task 15 after Task 13 (or give both to one agent). Everything else is file-disjoint after Tasks 1–7.

---

### Task 1: `cover_letter_edits` table + `application_packages` columns (migration, schema.sql, drift-guard trio)

**Files:**
- Create: `migrations/2026-07-07-cover-letter-edits.sql`
- Modify: `schema.sql` (application_packages CREATE TABLE ~line 262; new table after `idx_resume_scores_user` ~line 297; RLS block ~line 456; owner-policy block ~line 536; grant list ~line 576)
- Modify: `tests/test_rls_isolation.py` (seed ~line 58, `_OWNER_TABLES` ~line 72, delete checks ~lines 107/142, `EXPECTED_RLS` ~line 389, `EXPECTED_GRANTS` ~line 492)
- Modify: `dashboard/lib/userScopedTables.ts:16-29`, `dashboard/lib/accountExport.ts` (interface ~line 32, `collectUserRows` ~lines 86-123), `dashboard/lib/accountExport.test.ts` (fixtures + `pick`)
- Test: `tests/test_rls_isolation.py`, `dashboard/lib/accountDeletion.test.ts`, `dashboard/lib/accountExport.test.ts`

**Interfaces:**
- Consumes: `public.app_user_id()` (already in schema), `jobs(id)` FK.
- Produces: table `cover_letter_edits(user_id UUID, job_id TEXT, edited_text TEXT NOT NULL, original_text TEXT, cover_letter_trace_id TEXT, model TEXT, comment TEXT, superseded_at TIMESTAMPTZ, edited_at TIMESTAMPTZ, PK (user_id, job_id))`; columns `application_packages.cover_letter_trace_id TEXT`, `resume_instructions TEXT`, `cover_letter_instructions TEXT`. Later tasks write/read these exact names.

- [ ] **Step 1: Declare the new table in the pytest contracts (failing test first)**

In `tests/test_rls_isolation.py`:

In `_seed_two_users` (directly after the `resume_scores` INSERT at line 58-62) add:

```python
            cur.execute(
                "INSERT INTO cover_letter_edits (user_id, job_id, edited_text) "
                "VALUES (%s, 'lever:acme:1', 'Dear Hiring Manager, (edited)')",
                (uid,),
            )
```

In `_OWNER_TABLES` (line 72) add after the `resume_scores` entry:

```python
    ("cover_letter_edits", "user_id = %s"),
```

In `test_update_delete_of_other_tenant_rows_affects_zero` (after the `resume_scores` DELETE at line 107-108) add:

```python
            cur.execute("DELETE FROM cover_letter_edits WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
```

In `test_owner_full_crud_on_own_rows_succeeds` (after line 142-143) add:

```python
            cur.execute("DELETE FROM cover_letter_edits WHERE user_id = %s AND job_id = 'lever:acme:1'", (A,))
            assert cur.rowcount == 1
```

In `EXPECTED_RLS` (after `"resume_scores": _OWNER_ALL,` at line 389) add:

```python
    # Cover-letter edit overlay (2026-07-07-cover-letter-edits): owner CRUD; the
    # dashboard's saveCoverLetterEdit/deleteCoverLetterEdit actions are the only writers.
    "cover_letter_edits": _OWNER_ALL,
```

In `EXPECTED_GRANTS` (after the `resume_scores` line at 492) add:

```python
    "cover_letter_edits":   (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
```

- [ ] **Step 2: Run the RLS suite to verify it fails**

Run: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_rls_isolation.py -q`
Expected: FAIL — `psycopg.errors.UndefinedTable: relation "cover_letter_edits" does not exist` (the seed insert). If everything SKIPS instead, the DB env is missing — fix that before proceeding.

- [ ] **Step 3: Write the migration**

Create `migrations/2026-07-07-cover-letter-edits.sql`:

```sql
-- Editable cover letters → golden evals + per-job generation instructions
-- (docs/superpowers/specs/2026-07-07-editable-cover-letter-evals-design.md).
--
-- cover_letter_edits is an OVERLAY: it never mutates application_packages. Keyed
-- (user_id, job_id) — one edit per letter per operator; re-editing overwrites
-- (last-write-wins). The edited text is BOTH the product-facing persisted letter
-- AND the golden expected_output. superseded_at is stamped when a NEWER cover
-- letter is generated (NULL = the edit is current and displays over the original).
BEGIN;

CREATE TABLE IF NOT EXISTS cover_letter_edits (
  user_id               UUID NOT NULL,
  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  edited_text           TEXT NOT NULL,        -- human-edited plain-text letter
  original_text         TEXT,                 -- composed text of the model letter at edit time (eval "before")
  cover_letter_trace_id TEXT,                 -- join key to the generation's LangFuse trace
  model                 TEXT,                 -- model that generated the original
  comment               TEXT,                 -- optional operator note
  superseded_at         TIMESTAMPTZ,          -- set when a NEWER cover letter is generated; NULL = current
  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_user ON cover_letter_edits (user_id);
-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_job ON cover_letter_edits (job_id);

-- Symmetric to resume_trace_id: trace id captured at generation so a golden item can
-- reference the generation trace even after the letter is regenerated.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_trace_id TEXT;

-- Per-job generation instructions (sole generation-instruction source;
-- profile.instructions is reviewer-only). NULL/empty = no extra instructions.
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS resume_instructions       TEXT;
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS cover_letter_instructions TEXT;

-- RLS + grants: deny-all + owner_access + owner-scoped CRUD grant — the post-go-public
-- pattern for a new user_id table (mirrors 2026-07-05-generation-jobs.sql). NOTE: the
-- design spec said deny-all only, "matching resume_scores" — stale: resume_scores has
-- since gained owner_access (2026-07-03-rls-tenant-isolation) + authenticated grants
-- (2026-07-04-cost-cap-hardening), and all dashboard access runs through withUserSql
-- (authenticated role), so deny-all alone would block the feature.
ALTER TABLE cover_letter_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON cover_letter_edits;
CREATE POLICY no_anon_access ON cover_letter_edits FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_access ON cover_letter_edits;
CREATE POLICY owner_access ON cover_letter_edits FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON cover_letter_edits TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-07-cover-letter-edits.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 4: Mirror the migration into `schema.sql`**

Four edits, each placed beside its `resume_scores`/`generation_jobs` sibling:

(a) In the `application_packages` CREATE TABLE (line ~262), after `resume_trace_id      TEXT,` add:

```sql
  cover_letter_trace_id TEXT,
  resume_instructions        TEXT,   -- per-job "Generation instructions" (résumé leg)
  cover_letter_instructions  TEXT,   -- per-job "Generation instructions" (cover-letter leg)
```

(b) After `CREATE INDEX idx_resume_scores_user …` (line ~297) add:

```sql
-- Cover-letter edit overlay (see migrations/2026-07-07-cover-letter-edits.sql).
CREATE TABLE cover_letter_edits (
  user_id               UUID NOT NULL,
  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  edited_text           TEXT NOT NULL,
  original_text         TEXT,
  cover_letter_trace_id TEXT,
  model                 TEXT,
  comment               TEXT,
  superseded_at         TIMESTAMPTZ,
  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_cover_letter_edits_user ON cover_letter_edits (user_id);
CREATE INDEX idx_cover_letter_edits_job ON cover_letter_edits (job_id);
```

(c) In the deny-all RLS block (beside `ALTER TABLE resume_scores ENABLE …`, line ~455) add:

```sql
ALTER TABLE cover_letter_edits   ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON cover_letter_edits   FOR ALL USING (false) WITH CHECK (false);
```

(d) In the owner-policy block (beside `CREATE POLICY owner_access ON resume_scores …`, line ~536) add:

```sql
CREATE POLICY owner_access ON cover_letter_edits FOR ALL TO authenticated
  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
```

and extend the existing owner-CRUD grant statement (line ~576) to:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON
  job_reviews, review_corrections, company_reviews, application_packages, resume_scores,
  cover_letter_edits
  TO authenticated;
```

- [ ] **Step 5: Run the RLS suite to verify it passes**

Run: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest tests/test_rls_isolation.py -q`
Expected: PASS (all previously-passing tests still green, new declarations satisfied).

- [ ] **Step 6: Verify migration idempotency against a scratch DB**

```bash
psql "postgresql://postgres:postgres@localhost:55432/poller_test" -f migrations/2026-07-07-cover-letter-edits.sql
psql "postgresql://postgres:postgres@localhost:55432/poller_test" -f migrations/2026-07-07-cover-letter-edits.sql
```
Expected: both runs succeed (second is a no-op) — IF NOT EXISTS / DROP POLICY IF EXISTS make it re-runnable. (The pytest conftest wipes this DB per test run, so no cleanup needed.)

- [ ] **Step 7: Classify the table in the TS drift guards (failing test first)**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/accountDeletion.test.ts`
Expected: FAIL — `cover_letter_edits has a user_id column but is not in USER_DELETE_TABLES / USER_ANONYMIZE_TABLES / USER_EXCLUDED_TABLES` (the guard parses `schema.sql`).

Then in `dashboard/lib/userScopedTables.ts` add to `USER_DELETE_TABLES` (after `"resume_scores",`):

```ts
  // Cover-letter edit overlay (owner data; the golden push is a separate LangFuse copy).
  "cover_letter_edits",
```

In `dashboard/lib/accountExport.ts`:
- Add to the `AccountExport` interface (after `resume_scores: unknown[];`): `cover_letter_edits: unknown[];`
- In `collectUserRows`, add `coverLetterEdits,` to the destructuring array (after `resumeScores,`), add this query to the `Promise.all` list (after the `resume_scores` SELECT):

```ts
      tx`SELECT * FROM cover_letter_edits WHERE user_id = ${userId}::uuid`,
```

- and add to the returned object (after `resume_scores: …`): `cover_letter_edits: coverLetterEdits as unknown[],`

(The compile-time `_ExportCoversEveryTable` assertion at `accountExport.ts:50-55` is what forces this — if you skip it, `npx tsc --noEmit` fails.)

In `dashboard/lib/accountExport.test.ts`: add `cover_letter_edits: []` to each of the three per-user fixture objects in `DB` (`user-a` may carry a row, e.g. `[{ user_id: "user-a", job_id: "j1", edited_text: "edited" }]`), and add to the `pick` dispatcher (beside the `resume_scores` line):

```ts
    if (/FROM cover_letter_edits/.test(sql)) return rows.cover_letter_edits ?? [];
```

If the test also asserts an explicit key list anywhere, add `cover_letter_edits` there — run the test and let any remaining failure name the spot.

- [ ] **Step 8: Run the TS guards to verify they pass**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/accountDeletion.test.ts lib/accountExport.test.ts && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 9: Commit**

```bash
cd /Users/andrew/Scripts/job-board
LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' migrations/2026-07-07-cover-letter-edits.sql schema.sql tests/test_rls_isolation.py dashboard/lib/userScopedTables.ts dashboard/lib/accountExport.ts dashboard/lib/accountExport.test.ts || true  # expect no output
git add migrations/2026-07-07-cover-letter-edits.sql schema.sql tests/test_rls_isolation.py dashboard/lib/userScopedTables.ts dashboard/lib/accountExport.ts dashboard/lib/accountExport.test.ts
git commit -m "feat(cover-letter): cover_letter_edits overlay table + instructions/trace columns, wired through every drift guard"
```

---

### Task 2: `generateCoverLetter` returns `{ letter, traceId }`

**Files:**
- Modify: `dashboard/lib/rolefit/coverLetterClient.ts:14-65`
- Test: `dashboard/lib/rolefit/coverLetterClient.test.ts`, `dashboard/lib/rolefit/coverLetterClient.tracing.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `generateCoverLetter(args): Promise<{ letter: TailoredCoverLetter; traceId: string | null }>` — `traceId` is `span.traceId` when tracing is on, else `null`. Tasks 5, 7, 16 consume this exact shape. Mirrors `generateResume` (`resumeClient.ts:25`).

- [ ] **Step 1: Update the tracing-ON test to the new shape (failing first)**

In `dashboard/lib/rolefit/coverLetterClient.tracing.test.ts`, the mock span already has `traceId: "t"` (line 9). Change the assertions in the existing test:

```ts
    const out = await generateCoverLetter({ ...args, fetchImpl: f });

    // New return shape: the parsed letter plus the parent span's trace id.
    expect(out.letter.greeting).toBe("Dear Hiring Manager,");
    expect(out.letter.paragraphs).toEqual(LETTER.paragraphs);
    expect(out.traceId).toBe("t");
```

(keep the span-input/output and `propagateAttributes` assertions unchanged).

In `dashboard/lib/rolefit/coverLetterClient.test.ts` (the tracing-OFF suite), only the first test ("posts model + messages + response_format and returns parsed letter", lines 29-40) reads fields off the result; the rest are `rejects.toThrow()` and stay untouched. Change lines 32-33 to:

```ts
    expect(out.letter.greeting).toBe("Dear Hiring Manager,");
    expect(out.letter.paragraphs).toHaveLength(2);
    expect(out.traceId).toBeNull(); // tracing is off in this suite
```

- [ ] **Step 2: Run to verify both fail**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/rolefit/coverLetterClient.test.ts lib/rolefit/coverLetterClient.tracing.test.ts`
Expected: FAIL — `out.letter` is undefined (function still returns the bare letter).

- [ ] **Step 3: Change the return shape**

In `dashboard/lib/rolefit/coverLetterClient.ts` change the signature and the two return paths (mirror `generateResume`, `resumeClient.ts:56-82`):

```ts
export async function generateCoverLetter(args: {
  resumeText: string;
  candidateName: string | null;
  instructions: string | null;
  job: CoverLetterJob;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ letter: TailoredCoverLetter; traceId: string | null }> {
```

Tracing-off path (line 56):

```ts
  if (!tracingEnabled()) return { letter: await runGeneration(), traceId: null };
```

Tracing-on path (inside `propagateAttributes`):

```ts
    return propagateAttributes({ metadata: { generated_at: new Date().toISOString() } }, async () => {
      const letter = await runGeneration();
      span.update({ output: composeCoverLetterText(letter) });
      return { letter, traceId: span.traceId };
    });
```

- [ ] **Step 4: Run to verify green (routes will now be broken — expected until Tasks 5/7)**

Run: `npx vitest run lib/rolefit/coverLetterClient.test.ts lib/rolefit/coverLetterClient.tracing.test.ts`
Expected: PASS. (`npx tsc --noEmit` will FAIL at the two route call sites — that is the WS1 hand-off point; do NOT commit a "fix" that silently discards the letter. If this task is committed standalone, the tree typechecks again after Task 5+7; if executing sequentially, it's fine to commit here — the route tests still pass because they mock `generateCoverLetter`.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/coverLetterClient.ts dashboard/lib/rolefit/coverLetterClient.test.ts dashboard/lib/rolefit/coverLetterClient.tracing.test.ts
git commit -m "feat(cover-letter): generateCoverLetter returns { letter, traceId } (mirrors generateResume)"
```

---

### Task 3: `upsertApplicationPackage` — new columns + supersede-on-regenerate

**Files:**
- Modify: `dashboard/lib/queries.ts:458-509`
- Test: `dashboard/lib/queries.upsertApplicationPackage.test.ts`

**Interfaces:**
- Consumes: Task 1 columns.
- Produces: `upsertApplicationPackage(userId, jobId, data)` where `data` gains `coverLetterTraceId?: string | null; resumeInstructions?: string | null; coverLetterInstructions?: string | null`. Writing a non-null `coverLetter` also stamps `cover_letter_edits.superseded_at`. Tasks 5, 6, 7 pass the new fields.

- [ ] **Step 1: Extend the SQL-shape test (failing first)**

Append to `dashboard/lib/queries.upsertApplicationPackage.test.ts` (same `captured`/`upsertSql` scaffolding; note `captured` records EVERY statement, so the supersede UPDATE lands as its own entry):

```ts
describe("cover-letter fields track the cover-letter write (CASE on cover_letter_json)", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  const allNull = {
    resume: null, coverLetter: null, answersSnapshot: null,
    greenhouseQuestions: null, prefilledAnswers: null, applyUrl: null,
  } as const;

  test("cover_letter_trace_id and cover_letter_instructions refresh only with a new letter", async () => {
    await upsertApplicationPackage("u", "j", { ...allNull });
    const sql = upsertSql();
    expect(sql).toContain(
      "cover_letter_trace_id = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL THEN EXCLUDED.cover_letter_trace_id ELSE application_packages.cover_letter_trace_id END",
    );
    expect(sql).toContain(
      "cover_letter_instructions = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL THEN EXCLUDED.cover_letter_instructions ELSE application_packages.cover_letter_instructions END",
    );
    expect(sql).toContain(
      "resume_instructions = CASE WHEN EXCLUDED.resume_json IS NOT NULL THEN EXCLUDED.resume_instructions ELSE application_packages.resume_instructions END",
    );
  });

  test("a new cover letter supersedes any current edit; a resume-only write does not", async () => {
    await upsertApplicationPackage("u", "j", {
      ...allNull,
      coverLetter: { greeting: "Dear", paragraphs: ["p"], closing: "Sincerely,", signature: "A" },
    });
    const supersede = captured.map(norm).find((s) => s.includes("UPDATE cover_letter_edits"));
    expect(supersede).toBeDefined();
    expect(supersede).toContain("SET superseded_at = now()");
    expect(supersede).toContain("superseded_at IS NULL");

    captured.length = 0;
    await upsertApplicationPackage("u", "j", { ...allNull });
    expect(captured.map(norm).find((s) => s.includes("UPDATE cover_letter_edits"))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/queries.upsertApplicationPackage.test.ts`
Expected: FAIL — the emitted SQL lacks the new CASE clauses and no supersede UPDATE is issued.

- [ ] **Step 3: Implement**

In `dashboard/lib/queries.ts` `upsertApplicationPackage`:

Extend the `data` type:

```ts
    applyUrl: string | null;
    resumeTraceId?: string | null;
    coverLetterTraceId?: string | null;
    profileVersion?: string | null;
    resumeInstructions?: string | null;
    coverLetterInstructions?: string | null;
```

Inside the `withUserSql` callback, BEFORE the INSERT add:

```ts
  // Regenerating the letter cleanly replaces the user's edit in their view: stamp the
  // current edit superseded (the row + its already-pushed golden item persist; re-saving
  // an edit resets superseded_at to NULL — see app/actions/coverLetterEdits.ts).
  if (data.coverLetter != null) {
    await tx`
      UPDATE cover_letter_edits SET superseded_at = now()
      WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND superseded_at IS NULL
    `;
  }
```

Extend the INSERT column list / VALUES / ON CONFLICT / RETURNING:

```sql
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json, answers_snapshot,
       greenhouse_questions, prefilled_answers, apply_url, resume_trace_id,
       cover_letter_trace_id, resume_instructions, cover_letter_instructions,
       profile_version, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.answersSnapshot)}::jsonb, ${j(data.greenhouseQuestions)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
            ${data.coverLetterTraceId ?? null}, ${data.resumeInstructions ?? null},
            ${data.coverLetterInstructions ?? null},
            ${data.profileVersion ?? null}, 'prepared', now())
```

and in the `ON CONFLICT … DO UPDATE SET` block, after the existing `resume_trace_id`/`profile_version` CASE clauses add (same comment style — these describe their artifact, so they move in lockstep with it):

```sql
      cover_letter_trace_id = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                   THEN EXCLUDED.cover_letter_trace_id
                                   ELSE application_packages.cover_letter_trace_id END,
      resume_instructions = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                 THEN EXCLUDED.resume_instructions
                                 ELSE application_packages.resume_instructions END,
      cover_letter_instructions = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                       THEN EXCLUDED.cover_letter_instructions
                                       ELSE application_packages.cover_letter_instructions END,
```

Extend RETURNING with `resume_instructions, cover_letter_instructions` (the edited-text join column is read-path-only, Task 10 — `toApplicationPackage` must tolerate its absence).

- [ ] **Step 4: Run to verify green**

Run: `npx vitest run lib/queries.upsertApplicationPackage.test.ts && npx tsc --noEmit`
Expected: PASS (tsc still red only at the route `generateCoverLetter` call sites if Task 2 landed first — acceptable, fixed in Tasks 5/7).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/queries.ts dashboard/lib/queries.upsertApplicationPackage.test.ts
git commit -m "feat(cover-letter): upsert persists cover trace id + per-job instructions, supersedes edits on regenerate"
```

---

### Task 4: Instructions plumbing core — shared normalizer + résumé prompt/client

**Files:**
- Create: `dashboard/lib/rolefit/generationInstructions.ts`, `dashboard/lib/rolefit/generationInstructions.test.ts`
- Modify: `dashboard/lib/rolefit/resumeSchema.ts:107-171` (`buildResumePrompt`), `dashboard/lib/rolefit/resumeClient.ts:19-30` (`generateResume`)
- Test: `dashboard/lib/rolefit/resumeSchema.test.ts`, `dashboard/lib/rolefit/resumeClient.test.ts` (extend)

**Interfaces:**
- Produces:
  - `normalizeInstructions(raw: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string }` and `INSTRUCTIONS_MAX_LENGTH = 4000` — used by Tasks 5/6/7.
  - `buildResumePrompt(args)` gains `instructions?: string | null`; `generateResume(args)` gains `instructions?: string | null` and threads it through. Tasks 6/7 pass it.

- [ ] **Step 1: Write the normalizer test**

Create `dashboard/lib/rolefit/generationInstructions.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { normalizeInstructions, INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

describe("normalizeInstructions", () => {
  test("non-string and blank inputs collapse to null", () => {
    expect(normalizeInstructions(undefined, "résumé")).toEqual({ ok: true, value: null });
    expect(normalizeInstructions(42, "résumé")).toEqual({ ok: true, value: null });
    expect(normalizeInstructions("   \n ", "résumé")).toEqual({ ok: true, value: null });
  });

  test("trims and passes real text through", () => {
    expect(normalizeInstructions("  focus on Python \n", "résumé")).toEqual({ ok: true, value: "focus on Python" });
  });

  test("rejects over-cap input instead of truncating", () => {
    const res = normalizeInstructions("x".repeat(INSTRUCTIONS_MAX_LENGTH + 1), "cover letter");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("cover letter");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/rolefit/generationInstructions.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the normalizer**

Create `dashboard/lib/rolefit/generationInstructions.ts`:

```ts
// Per-job generation-instruction normalization shared by the three generate routes
// (/api/resume, /api/cover-letter, /api/application/prepare). Instructions are
// OPTIONAL free text from the per-job UI box: any non-string or blank input
// collapses to null; over-cap input is a caller error (400), never a silent truncate.
// RUNTIME-PURE — safe for client, server, and CLI.
export const INSTRUCTIONS_MAX_LENGTH = 4000;

export type NormalizedInstructions =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function normalizeInstructions(raw: unknown, label: string): NormalizedInstructions {
  if (typeof raw !== "string") return { ok: true, value: null };
  if (raw.length > INSTRUCTIONS_MAX_LENGTH) {
    return { ok: false, error: `${label} instructions too long (max ${INSTRUCTIONS_MAX_LENGTH} characters)` };
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}
```

- [ ] **Step 4: Run to verify green** — `npx vitest run lib/rolefit/generationInstructions.test.ts` → PASS.

- [ ] **Step 5: Write the failing résumé-prompt tests**

Append to `dashboard/lib/rolefit/resumeSchema.test.ts` (its fixture is the module-level `const PROFILE: ParsedProfile` at line 6):

```ts
describe("buildResumePrompt — per-job instructions", () => {
  test("an instructions arg renders a CANDIDATE FOCUS / AVOID block in the user prompt", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "Alex Morgan — Senior Engineer, React/TS",
      job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
      instructions: "Emphasize the ML platform work; avoid frontend framing.",
    });
    expect(user).toContain("CANDIDATE FOCUS / AVOID");
    expect(user).toContain("Emphasize the ML platform work; avoid frontend framing.");
  });

  test("no instructions → no block (prompt unchanged)", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "x",
      job: { title: "T", company: "C", description: null },
    });
    expect(user).not.toContain("CANDIDATE FOCUS / AVOID");
  });
});
```

And inside the `describe("generateResume", …)` block of `dashboard/lib/rolefit/resumeClient.test.ts` (its fixtures: `TAILORED`, `RESUME_TEXT`, `fakeFetch`, and the shared `args` object) add:

```ts
  test("threads per-job instructions into the user prompt", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(TAILORED) } }] });
    await generateResume({ ...args, fetchImpl: f, instructions: "Lead with Kubernetes" });
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.messages[1].content).toContain("CANDIDATE FOCUS / AVOID");
    expect(body.messages[1].content).toContain("Lead with Kubernetes");
  });
```

- [ ] **Step 6: Run to verify they fail** — `npx vitest run lib/rolefit/resumeSchema.test.ts lib/rolefit/resumeClient.test.ts` → FAIL (unknown `instructions` property / missing block).

- [ ] **Step 7: Implement**

In `dashboard/lib/rolefit/resumeSchema.ts` `buildResumePrompt` args add:

```ts
  /**
   * Optional per-job "Generation instructions" from the dashboard box (never
   * profile.instructions — that is reviewer-only). Rendered as a CANDIDATE
   * FOCUS / AVOID block; it steers selection and emphasis and never licenses
   * fabrication (the ground rules still bind).
   */
  instructions?: string | null;
```

and inside the function, before the `user` concatenation:

```ts
  const focusBlock = args.instructions
    ? `CANDIDATE FOCUS / AVOID (from the candidate — honor it within the ground rules; it never licenses adding unsupported skills or experience):\n${args.instructions}\n\n`
    : "";
```

then insert `focusBlock` into the `user` template between the job-description block and the candidate background:

```ts
  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n\n` +
    `<job_description>\n…(unchanged)…\n</job_description>\n\n` +
    focusBlock +
    `CANDIDATE BACKGROUND (full text — use as context for skills, domain, and tenure):\n${args.resumeText}\n\n` +
    …(rest unchanged)…
```

In `dashboard/lib/rolefit/resumeClient.ts` `generateResume` args add `instructions?: string | null;` and thread it:

```ts
  const { system, user } = buildResumePrompt({
    profile, resumeText: args.resumeText, job: args.job, tenureYears,
    instructions: args.instructions ?? null,
  });
```

- [ ] **Step 8: Run to verify green** — `npx vitest run lib/rolefit/resumeSchema.test.ts lib/rolefit/resumeClient.test.ts lib/rolefit/resumeClient.tracing.test.ts && npx tsc --noEmit` → PASS (tsc caveat from Task 2 aside).

- [ ] **Step 9: Commit**

```bash
git add dashboard/lib/rolefit/generationInstructions.ts dashboard/lib/rolefit/generationInstructions.test.ts dashboard/lib/rolefit/resumeSchema.ts dashboard/lib/rolefit/resumeSchema.test.ts dashboard/lib/rolefit/resumeClient.ts dashboard/lib/rolefit/resumeClient.test.ts
git commit -m "feat(resume): per-job instructions block in the résumé prompt + shared request normalizer"
```

---

### Task 5: `/api/cover-letter` — trace id, body instructions, drop `profile.instructions`

**Files:**
- Modify: `dashboard/app/api/cover-letter/route.ts` (body parse ~line 28; `run()` ~lines 78-106)
- Test: `dashboard/app/api/cover-letter/route.test.ts`

**Interfaces:**
- Consumes: Task 2 `{ letter, traceId }`, Task 3 upsert fields, Task 4 `normalizeInstructions`.
- Produces: request body `{ jobId: string; instructions?: string }`; 400 on over-cap instructions; persists `coverLetterTraceId` + `coverLetterInstructions`. The board (Task 15) sends this body.

- [ ] **Step 1: Update the route test (failing first)**

In `dashboard/app/api/cover-letter/route.test.ts`:

(a) Make the generator mock return the new shape and prove reviewer instructions never leak into generation. In `beforeEach` (line ~79-86) set:

```ts
  mocks.getProfile.mockResolvedValue({
    resume_text: "resume", full_name: "Ada",
    instructions: "REVIEWER-ONLY — must never reach generation", model_cover: null,
  });
  mocks.generateCoverLetter.mockResolvedValue({ letter: LETTER, traceId: "cl-tr-1" });
```

(b) In the existing "202 …" test, extend the background assertions:

```ts
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.coverLetter).toBe(LETTER);
    expect(pkg.coverLetterTraceId).toBe("cl-tr-1");
    expect(pkg.coverLetterInstructions).toBeNull();
```

(c) Add a new describe:

```ts
describe("POST /api/cover-letter — per-job instructions", () => {
  test("body instructions thread into generation and persist; profile.instructions never does", async () => {
    await POST(req({ jobId: "job-1", instructions: "  Mention the SRE rotation.  " }));
    await flushBackground();
    const arg = mocks.generateCoverLetter.mock.calls[0][0];
    expect(arg.instructions).toBe("Mention the SRE rotation.");
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.coverLetterInstructions).toBe("Mention the SRE rotation.");
  });

  test("no body instructions → generation gets null (NOT the reviewer-only profile.instructions)", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBeNull();
  });

  test("over-cap instructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", instructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failures** — `npx vitest run app/api/cover-letter/route.test.ts` → FAIL (upsert receives the `{letter,…}` object as `coverLetter`; instructions come from the profile; no 400).

- [ ] **Step 3: Implement the route changes**

In `dashboard/app/api/cover-letter/route.ts`:

Add the import: `import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";`

Body parse (line ~28):

```ts
  const { jobId, instructions: rawInstructions } =
    (await req.json().catch(() => ({}))) as { jobId?: string; instructions?: unknown };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  // Per-job generation instructions ride the generate request (the sole instruction
  // source — profile.instructions is reviewer-only and no longer reaches generation).
  const norm = normalizeInstructions(rawInstructions, "cover letter");
  if (!norm.ok) return Response.json({ error: norm.error }, { status: 400 });
  const instructions = norm.value;
```

In `run()` (lines ~80-106):

```ts
      const { letter, traceId } = await generateCoverLetter({
        resumeText: profile.resume_text!,
        candidateName: profile.full_name ?? null,
        instructions,
        job: { …unchanged… },
        model: profile.model_cover ?? DEFAULT_COVER_MODEL,
        apiKey,
      });
      await upsertApplicationPackage(userId, jobId, {
        resume: null,
        coverLetter: letter,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        coverLetterTraceId: traceId,
        coverLetterInstructions: instructions,
        // No résumé generated here … (existing comment + profileVersion: null unchanged)
        profileVersion: null,
      });
```

- [ ] **Step 4: Run to verify green** — `npx vitest run app/api/cover-letter/route.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/cover-letter/route.ts dashboard/app/api/cover-letter/route.test.ts
git commit -m "feat(cover-letter): route captures traceId, threads per-job instructions, drops reviewer-only profile.instructions"
```

---

### Task 6: `/api/resume` — body instructions → prompt + persistence

**Files:**
- Modify: `dashboard/app/api/resume/route.ts` (body parse ~line 29; `run()` ~lines 82-102)
- Test: `dashboard/app/api/resume/route.test.ts`

**Interfaces:**
- Consumes: Task 3 `resumeInstructions`, Task 4 `normalizeInstructions` + `generateResume` `instructions?`.
- Produces: request body `{ jobId: string; instructions?: string }`; persists `resumeInstructions`.

- [ ] **Step 1: Extend the route test (failing first)** — add to `dashboard/app/api/resume/route.test.ts` (same mock scaffolding as the cover-letter test; `mocks.generateResume` already resolves `{ resume, checks, traceId }`):

```ts
describe("POST /api/resume — per-job instructions", () => {
  test("body instructions thread into generateResume and persist", async () => {
    await POST(req({ jobId: "job-1", instructions: " Focus on infra. " }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBe("Focus on infra.");
    expect(mocks.upsertApplicationPackage.mock.calls[0][2].resumeInstructions).toBe("Focus on infra.");
  });

  test("absent instructions → null through to generation and persistence", async () => {
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBeNull();
    expect(mocks.upsertApplicationPackage.mock.calls[0][2].resumeInstructions).toBeNull();
  });

  test("over-cap instructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", instructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});
```

(Adapt `req`/`flushBackground` helper names to the file's own — they mirror the cover-letter test.)

- [ ] **Step 2: Run to verify it fails** — `npx vitest run app/api/resume/route.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `dashboard/app/api/resume/route.ts`: same body-parse block as Task 5 Step 3 (label `"résumé"`), then:

```ts
      const { resume, traceId } = await generateResume({
        resumeText,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
        instructions,
      });

      await upsertApplicationPackage(userId, jobId, {
        resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
        resumeInstructions: instructions,
        profileVersion: profile.profile_version,
      });
```

- [ ] **Step 4: Run to verify green** — `npx vitest run app/api/resume/route.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/resume/route.ts dashboard/app/api/resume/route.test.ts
git commit -m "feat(resume): route accepts + persists per-job generation instructions"
```

---

### Task 7: `/api/application/prepare` — cover trace id, both instruction kinds, instruction-less prefill

**Files:**
- Modify: `dashboard/app/api/application/prepare/route.ts` (body ~line 41; prefill ~line 115-123; legs ~lines 137-190)
- Test: `dashboard/app/api/application/prepare/route.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 4.
- Produces: request body `{ jobId: string; resumeInstructions?: string; coverLetterInstructions?: string }`; persists `resumeTraceId`, `coverLetterTraceId`, `resumeInstructions`, `coverLetterInstructions`; `generatePrefilledAnswers` gets `instructions: null`.

- [ ] **Step 1: Update the prepare route test (failing first)**

In `dashboard/app/api/application/prepare/route.test.ts`:
- Change the `generateCoverLetter` mock resolution to `{ letter: <the existing letter fixture>, traceId: "cl-tr-9" }` wherever it resolves a bare letter.
- Set the profile mock's `instructions` to `"REVIEWER-ONLY"` so a leak is detectable.
- Add:

```ts
describe("POST /api/application/prepare — instructions + cover trace id", () => {
  test("both instruction kinds thread to their legs and persist; prefill gets none", async () => {
    await POST(req({ jobId: "job-1", resumeInstructions: "R focus", coverLetterInstructions: "C focus" }));
    await flushBackground();
    expect(mocks.generateResume.mock.calls[0][0].instructions).toBe("R focus");
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBe("C focus");
    const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
    expect(pkg.resumeInstructions).toBe("R focus");
    expect(pkg.coverLetterInstructions).toBe("C focus");
    expect(pkg.coverLetterTraceId).toBe("cl-tr-9");
  });

  test("prefill is instruction-less even with profile.instructions set (Greenhouse leg)", async () => {
    // Use the file's existing Greenhouse fixtures (ats: "greenhouse" + question fetch mocks).
    await POST(req({ jobId: "job-1" }));
    await flushBackground();
    if (mocks.generatePrefilledAnswers.mock.calls.length > 0) {
      expect(mocks.generatePrefilledAnswers.mock.calls[0][0].instructions).toBeNull();
    }
    expect(mocks.generateCoverLetter.mock.calls[0][0].instructions).toBeNull();
  });

  test("over-cap resumeInstructions → 400 before the gate", async () => {
    const res = await POST(req({ jobId: "job-1", resumeInstructions: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
  });
});
```

(Adapt to the file's fixture names; if its default job mock is not Greenhouse, run the prefill assertion inside the file's existing Greenhouse-path test instead.)

- [ ] **Step 2: Run to verify failures** — `npx vitest run app/api/application/prepare/route.test.ts` → FAIL.

- [ ] **Step 3: Implement**

In `dashboard/app/api/application/prepare/route.ts`:

Import `normalizeInstructions`. Body parse (line ~41):

```ts
  const { jobId, resumeInstructions: rawResumeInstr, coverLetterInstructions: rawCoverInstr } =
    (await req.json().catch(() => ({}))) as {
      jobId?: string; resumeInstructions?: unknown; coverLetterInstructions?: unknown;
    };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  const resumeNorm = normalizeInstructions(rawResumeInstr, "résumé");
  if (!resumeNorm.ok) return Response.json({ error: resumeNorm.error }, { status: 400 });
  const coverNorm = normalizeInstructions(rawCoverInstr, "cover letter");
  if (!coverNorm.ok) return Response.json({ error: coverNorm.error }, { status: 400 });
  const resumeInstructions = resumeNorm.value;
  const coverLetterInstructions = coverNorm.value;
```

Prefill leg (line ~115): replace `instructions: profile.instructions ?? null,` with

```ts
        // Prefill is instruction-less: profile.instructions is reviewer-only, and the
        // per-job boxes deliberately don't cover the prefill leg (spec non-goal).
        instructions: null,
```

Résumé leg (line ~144): add `instructions: resumeInstructions,` to the `generateResume` args.

Cover leg (line ~153): convert to a trace-capturing IIFE exactly like the résumé leg above it:

```ts
      // cover-letter leg — the `cover-letter` parent span lives in generateCoverLetter;
      // capture its trace id for the cover_letter_edits golden join. Returns the letter
      // so coverResult.value stays a TailoredCoverLetter. On failure this leg throws
      // before reading traceId, so coverLetterTraceId stays null (mirrors the résumé leg).
      (async () => {
        const { letter, traceId } = await generateCoverLetter({
          resumeText,
          candidateName: profile.full_name ?? null,
          instructions: coverLetterInstructions,
          job: {
            title: job.title,
            company: job.company_name,
            description: job.description,
            about: job.about,
            requirements: job.requirements,
            skillGaps: job.skill_gaps,
            redFlags: job.red_flags,
          },
          model: profile.model_cover ?? DEFAULT_COVER_MODEL,
          apiKey,
        });
        coverLetterTraceId = traceId;
        return letter;
      })(),
```

with `let coverLetterTraceId: string | null = null;` declared beside `let resumeTraceId` (line ~136).

Upsert (line ~181): add `coverLetterTraceId, resumeInstructions, coverLetterInstructions,` beside `resumeTraceId`.

- [ ] **Step 4: Run to verify green** — `npx vitest run app/api/application/prepare/route.test.ts && npx tsc --noEmit` → PASS / clean (all Task-2 call sites are now updated).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/application/prepare/route.ts dashboard/app/api/application/prepare/route.test.ts
git commit -m "feat(prepare): cover-letter trace id + per-leg instructions; prefill no longer misuses profile.instructions"
```

---

### Task 8: `lib/rolefit/coverLetterScore.ts` — weights, overall, golden-item builder

**Files:**
- Create: `dashboard/lib/rolefit/coverLetterScore.ts`
- Test: `dashboard/lib/rolefit/coverLetterScore.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 9, 11, 16):
  - `COVER_LETTER_GOLDEN_DATASET_NAME = "cover-letter-golden"`
  - `GROUNDING_WEIGHT = 0.5`, `FIDELITY_WEIGHT = 0.3`, `JD_RELEVANCE_WEIGHT = 0.2`
  - `coverLetterOverall(grounding: number, fidelity: number, jdRelevance: number): number`
  - `interface CoverLetterGoldenJob { title; company; description; about; requirements: {text,met}[]; skillGaps: string[]; redFlags: string[] }`
  - `interface CoverLetterGoldenInput { background: string | null; candidateName: string | null; instructions: string | null; job: CoverLetterGoldenJob; model: string | null }`
  - `interface CoverLetterGoldenItem { id; datasetName; input: CoverLetterGoldenInput; expectedOutput; metadata }`
  - `buildCoverLetterGoldenItem({ userId, jobId, input, editedText, comment, traceId, model, originalText, editedAt }): CoverLetterGoldenItem`

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/rolefit/coverLetterScore.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  COVER_LETTER_GOLDEN_DATASET_NAME,
  coverLetterOverall,
  buildCoverLetterGoldenItem,
  type CoverLetterGoldenInput,
} from "@/lib/rolefit/coverLetterScore";

const INPUT: CoverLetterGoldenInput = {
  background: "Alex Morgan, React engineer",
  candidateName: "Alex Morgan",
  instructions: "Mention the design-system work",
  job: {
    title: "Frontend Engineer", company: "Cobalt", description: "Build apps.",
    about: "Devtools.", requirements: [{ text: "React", met: true }],
    skillGaps: ["rust"], redFlags: ["hours"],
  },
  model: "test/model",
};

describe("coverLetterOverall", () => {
  test("weights grounding 0.5 / fidelity 0.3 / jd_relevance 0.2, one decimal", () => {
    expect(coverLetterOverall(5, 4, 3)).toBe(4.3); // 2.5 + 1.2 + 0.6
    expect(coverLetterOverall(1, 1, 1)).toBe(1);
    expect(coverLetterOverall(3, 4, 5)).toBe(3.7); // 1.5 + 1.2 + 1.0
  });
});

describe("buildCoverLetterGoldenItem", () => {
  test("id, dataset, expectedOutput = the edited letter, metadata carries the trace join", () => {
    const item = buildCoverLetterGoldenItem({
      userId: "u1", jobId: "j1", input: INPUT,
      editedText: "Dear Hiring Manager,\n\nEdited body.\n\nSincerely,\nAlex Morgan\n",
      comment: "tightened paragraph 2", traceId: "tr-9", model: "test/model",
      originalText: "Dear Hiring Manager,\n\nOriginal body.\n\nSincerely,\nAlex Morgan\n",
      editedAt: "2026-07-07T00:00:00.000Z",
    });
    expect(item.id).toBe("u1:j1");
    expect(item.datasetName).toBe(COVER_LETTER_GOLDEN_DATASET_NAME);
    expect(item.input).toEqual(INPUT);
    expect(item.expectedOutput).toEqual({
      cover_letter: "Dear Hiring Manager,\n\nEdited body.\n\nSincerely,\nAlex Morgan\n",
      comment: "tightened paragraph 2",
    });
    expect(item.metadata).toEqual({
      cover_letter_trace_id: "tr-9",
      model: "test/model",
      original_text: "Dear Hiring Manager,\n\nOriginal body.\n\nSincerely,\nAlex Morgan\n",
      edited_at: "2026-07-07T00:00:00.000Z",
      source: "dashboard",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/rolefit/coverLetterScore.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `dashboard/lib/rolefit/coverLetterScore.ts`:

```ts
// Cover-letter golden-dataset types + builders. Mirrors lib/rolefit/resumeScore.ts
// (the resume-golden equivalent), with the review_corrections flavor: the human EDIT
// is the golden expected_output. Runtime-pure — no DB or LangFuse imports.

export const COVER_LETTER_GOLDEN_DATASET_NAME = "cover-letter-golden";

// grounding 0.5 / fidelity 0.3 / jd_relevance 0.2 — fabrication stays the dominant
// failure; fidelity (closeness to the human-edited ideal) is the new comparative
// signal. Tunable constants; the judge itself never computes the overall.
export const GROUNDING_WEIGHT = 0.5;
export const FIDELITY_WEIGHT = 0.3;
export const JD_RELEVANCE_WEIGHT = 0.2;

/** Weighted overall (1–5), rounded to one decimal. */
export function coverLetterOverall(grounding: number, fidelity: number, jdRelevance: number): number {
  return (
    Math.round(
      (GROUNDING_WEIGHT * grounding + FIDELITY_WEIGHT * fidelity + JD_RELEVANCE_WEIGHT * jdRelevance) * 10,
    ) / 10
  );
}

/** The per-job review context generateCoverLetter needs (shape of CoverLetterJob). */
export interface CoverLetterGoldenJob {
  title: string;
  company: string;
  description: string | null;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skillGaps: string[];
  redFlags: string[];
}

/** Full generation context needed to REPLAY generateCoverLetter for this item. */
export interface CoverLetterGoldenInput {
  background: string | null;      // profiles.resume_text
  candidateName: string | null;   // profiles.full_name
  instructions: string | null;    // per-job cover_letter_instructions
  job: CoverLetterGoldenJob;
  model: string | null;           // profiles.model_cover
}

export interface CoverLetterGoldenItem {
  id: string;
  datasetName: string;
  input: CoverLetterGoldenInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildCoverLetterGoldenItem(args: {
  userId: string;
  jobId: string;
  input: CoverLetterGoldenInput;
  editedText: string;
  comment: string | null;
  traceId: string | null;
  model: string | null;
  originalText: string | null;
  editedAt: string;
}): CoverLetterGoldenItem {
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: COVER_LETTER_GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput: { cover_letter: args.editedText, comment: args.comment },
    metadata: {
      cover_letter_trace_id: args.traceId,
      model: args.model,
      original_text: args.originalText,
      edited_at: args.editedAt,
      source: "dashboard",
    },
  };
}
```

- [ ] **Step 4: Run to verify green** — `npx vitest run lib/rolefit/coverLetterScore.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/coverLetterScore.ts dashboard/lib/rolefit/coverLetterScore.test.ts
git commit -m "feat(evals): cover-letter golden types, judge weights, and item builder"
```

---

### Task 9: `lib/coverLetterGoldenDataset.ts` — LangFuse upsert

**Files:**
- Create: `dashboard/lib/coverLetterGoldenDataset.ts`
- Test: `dashboard/lib/coverLetterGoldenDataset.test.ts`

**Interfaces:**
- Consumes: Task 8 `CoverLetterGoldenItem`; `getClient` from `dashboard/lib/langfuseClient.ts`.
- Produces: `upsertCoverLetterGoldenItem(item: CoverLetterGoldenItem): Promise<void>` — no-op without LangFuse keys; ensures the dataset exists; upserts by `id`. Consumed by Tasks 11 and 16.

- [ ] **Step 1: Write the failing test** — create `dashboard/lib/coverLetterGoldenDataset.test.ts` (mirror `resumeGoldenDataset.test.ts` exactly):

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertCoverLetterGoldenItem } from "./coverLetterGoldenDataset";
import type { CoverLetterGoldenItem } from "./rolefit/coverLetterScore";

const ITEM: CoverLetterGoldenItem = {
  id: "u1:j1", datasetName: "cover-letter-golden",
  input: {
    background: "b", candidateName: "A", instructions: null,
    job: { title: "Eng", company: "Acme", description: "d", about: null, requirements: [], skillGaps: [], redFlags: [] },
    model: "m",
  },
  expectedOutput: { cover_letter: "Dear…", comment: null },
  metadata: { cover_letter_trace_id: "tr1", model: "m", original_text: null, edited_at: "2026-07-07T00:00:00Z", source: "dashboard" },
};

describe("upsertCoverLetterGoldenItem", () => {
  const saved = { pub: process.env.LANGFUSE_PUBLIC_KEY, sec: process.env.LANGFUSE_SECRET_KEY };
  beforeEach(() => { delete process.env.LANGFUSE_PUBLIC_KEY; delete process.env.LANGFUSE_SECRET_KEY; });
  afterEach(() => { process.env.LANGFUSE_PUBLIC_KEY = saved.pub; process.env.LANGFUSE_SECRET_KEY = saved.sec; });

  it("is a no-op (resolves) when LangFuse keys are absent", async () => {
    await expect(upsertCoverLetterGoldenItem(ITEM)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/coverLetterGoldenDataset.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — create `dashboard/lib/coverLetterGoldenDataset.ts`:

```ts
import type { CoverLetterGoldenItem } from "@/lib/rolefit/coverLetterScore";
import { getClient } from "./langfuseClient.ts";

// Upsert one cover-letter-golden dataset item. No-op when keys are absent (local/dev).
// Same id re-upserts (LangFuse upserts on `id`), so re-editing updates in place.
// Mirrors lib/resumeGoldenDataset.ts.
export async function upsertCoverLetterGoldenItem(item: CoverLetterGoldenItem): Promise<void> {
  const c = getClient();
  if (c === null) return;
  // Ensure the dataset exists (idempotent; ignore "already exists").
  try {
    await c.api.datasets.create({ name: item.datasetName });
  } catch {
    /* dataset already exists */
  }
  await c.api.datasetItems.create({
    datasetName: item.datasetName,
    id: item.id,
    input: item.input,
    expectedOutput: item.expectedOutput,
    metadata: item.metadata,
  });
}
```

(The `./langfuseClient.ts` extension import is intentional — matches `resumeGoldenDataset.ts:2`.)

- [ ] **Step 4: Run to verify green** — `npx vitest run lib/coverLetterGoldenDataset.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/coverLetterGoldenDataset.ts dashboard/lib/coverLetterGoldenDataset.test.ts
git commit -m "feat(evals): cover-letter-golden LangFuse dataset upsert (no-op without keys)"
```

---

### Task 10: Read path — join `cover_letter_edits`, map instructions + edited text

**Files:**
- Modify: `dashboard/lib/types.ts:197-212` (`ApplicationPackage`), `dashboard/lib/queries.ts:373-397` (`toApplicationPackage`), `:415-446` (`getApplicationPackage`, `getApplicationPackages`)
- Create: `dashboard/lib/queries.coverLetterEdits.test.ts`

**Interfaces:**
- Consumes: Task 1 columns/table.
- Produces: `ApplicationPackage` gains `resumeInstructions: string | null; coverLetterInstructions: string | null; coverLetterEditedText: string | null` (edited text only when a NON-superseded edit exists; `null` on the upsert-RETURNING path, which has no join). Tasks 13/15 consume these.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/queries.coverLetterEdits.test.ts` (modeled on `queries.upsertApplicationPackage.test.ts` — captured-SQL mock):

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

// Read-path guard: the package reads LEFT JOIN the viewer's CURRENT (non-superseded)
// cover_letter_edits row, and toApplicationPackage maps the new columns. SQL-shape
// assertions (the dashboard mocks the DB); runtime behavior of the join predicate is
// covered by the RLS suite's real-Postgres seeds.
const { captured } = vi.hoisted(() => ({ captured: [] as string[] }));
vi.mock("@/lib/db", () => {
  const tx = (strings: TemplateStringsArray, ..._vals: unknown[]) => {
    captured.push(strings.join(" ? "));
    return Promise.resolve([
      {
        job_id: "ashby:vetcove:6b80fa7d", status: "prepared",
        resume_json: null, cover_letter_json: null, answers_snapshot: null,
        greenhouse_questions: null, prefilled_answers: null, apply_url: null,
        profile_version: null, resume_instructions: "R focus",
        cover_letter_instructions: "C focus",
        cover_letter_edited_text: "Dear Hiring Manager,\n\nEdited.\n",
        prepared_at: new Date("2026-07-07T00:00:00.000Z"), applied_at: null,
      },
    ]);
  };
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});

import { getApplicationPackage, getApplicationPackages, toApplicationPackage } from "@/lib/queries";

const norm = (s: string): string => s.replace(/\s+/g, " ");

beforeEach(() => { captured.length = 0; });

describe("package reads join the current cover-letter edit", () => {
  test("getApplicationPackage: LEFT JOIN with superseded_at IS NULL + new columns; row maps through", async () => {
    const pkg = await getApplicationPackage("u", "j");
    const sql = norm(captured[0]);
    expect(sql).toContain("LEFT JOIN cover_letter_edits");
    expect(sql).toContain("superseded_at IS NULL");
    expect(sql).toContain("resume_instructions");
    expect(sql).toContain("cover_letter_instructions");
    expect(pkg?.coverLetterEditedText).toBe("Dear Hiring Manager,\n\nEdited.\n");
    expect(pkg?.resumeInstructions).toBe("R focus");
    expect(pkg?.coverLetterInstructions).toBe("C focus");
  });

  test("getApplicationPackages carries the same join", async () => {
    await getApplicationPackages("u");
    const sql = norm(captured[0]);
    expect(sql).toContain("LEFT JOIN cover_letter_edits");
    expect(sql).toContain("superseded_at IS NULL");
  });
});

describe("toApplicationPackage", () => {
  test("missing edit/instruction columns (upsert RETURNING path) map to null", () => {
    const pkg = toApplicationPackage({
      job_id: "j", status: "prepared", resume_json: null, cover_letter_json: null,
      answers_snapshot: null, greenhouse_questions: null, prefilled_answers: null,
      apply_url: null, profile_version: null, prepared_at: new Date(), applied_at: null,
    });
    expect(pkg.coverLetterEditedText).toBeNull();
    expect(pkg.resumeInstructions).toBeNull();
    expect(pkg.coverLetterInstructions).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/queries.coverLetterEdits.test.ts` → FAIL.

- [ ] **Step 3: Implement**

In `dashboard/lib/types.ts` `ApplicationPackage`, after `profileVersion`:

```ts
  // Per-job "Generation instructions" persisted with the last generate request (seed
  // for the UI boxes; null = none).
  resumeInstructions: string | null;
  coverLetterInstructions: string | null;
  // The viewer's CURRENT (non-superseded) human edit of the cover letter, joined from
  // cover_letter_edits. Displays/downloads over the structured original; null = no
  // current edit (never generated, never edited, or superseded by a regeneration).
  coverLetterEditedText: string | null;
```

In `dashboard/lib/queries.ts` `toApplicationPackage`, after the `profileVersion` mapping:

```ts
    resumeInstructions: (row.resume_instructions as string | null) ?? null,
    coverLetterInstructions: (row.cover_letter_instructions as string | null) ?? null,
    // Joined column — absent (undefined) on the upsert RETURNING path, which has no join.
    coverLetterEditedText: (row.cover_letter_edited_text as string | null) ?? null,
```

Rewrite both reads to qualify columns and join (the current queries use bare column names off one table):

```ts
export async function getApplicationPackage(
  userId: string,
  jobId: string,
): Promise<ApplicationPackage | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT ap.job_id, ap.status, ap.resume_json, ap.cover_letter_json, ap.answers_snapshot,
             ap.greenhouse_questions, ap.prefilled_answers, ap.apply_url, ap.profile_version,
             ap.resume_instructions, ap.cover_letter_instructions,
             ap.prepared_at, ap.applied_at,
             e.edited_text AS cover_letter_edited_text
      FROM application_packages ap
      LEFT JOIN cover_letter_edits e
        ON e.user_id = ap.user_id AND e.job_id = ap.job_id AND e.superseded_at IS NULL
      WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
    `;
    return rows.length > 0
      ? toApplicationPackage(rows[0] as unknown as Record<string, unknown>)
      : null;
  });
}
```

and the same SELECT/JOIN in `getApplicationPackages` (WHERE only on `ap.user_id`).

- [ ] **Step 4: Run the read-path suites**

Run: `npx vitest run lib/queries.coverLetterEdits.test.ts lib/queries.applicationPackages.test.ts lib/queries.test.ts && npx tsc --noEmit`
Expected: the new test PASSES. If `queries.applicationPackages.test.ts` (or another suite) asserts the OLD select shape or constructs `ApplicationPackage` literals, update those fixtures to include the three new fields (`null` values) — mechanical, the type error names each spot.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/queries.ts dashboard/lib/queries.coverLetterEdits.test.ts $(git diff --name-only -- dashboard/lib | grep test || true)
git commit -m "feat(cover-letter): package reads join the current edit + expose per-job instructions"
```

---

### Task 11: Server actions — `saveCoverLetterEdit` / `deleteCoverLetterEdit`

**Files:**
- Create: `dashboard/app/actions/coverLetterEdits.ts`
- Test: `dashboard/lib/coverLetterEdits.action.test.ts`

**Interfaces:**
- Consumes: Tasks 8, 9; `requireUserId`/`getUserClaims` (`@/lib/auth`), `isAdmin` (`@/lib/admin`), `withUserSql` (`@/lib/db`), `assertNotDeleted` (`@/lib/tombstone`), `parseTailoredCoverLetter` (`@/lib/rolefit/packageCodec`), `composeCoverLetterText` (`@/lib/rolefit/coverLetterText`).
- Produces: `saveCoverLetterEdit(jobId: string, editedText: string, comment?: string | null): Promise<{ ok: true; langfuseSynced: boolean }>` and `deleteCoverLetterEdit(jobId: string): Promise<{ ok: true }>`. Task 12's editor calls both.

- [ ] **Step 1: Write the failing action test**

Create `dashboard/lib/coverLetterEdits.action.test.ts` (mock scaffolding copied from `lib/resumeScore.action.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const admin = vi.hoisted(() => ({ isAdmin: true }));

const sqlMock = vi.fn();
vi.mock("@/lib/db", () => {
  const tx = Object.assign((...a: unknown[]) => sqlMock(...a), { json: (v: unknown) => v });
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});
vi.mock("@/lib/auth", () => ({
  requireUserId: vi.fn(async () => "u1"),
  getUserClaims: vi.fn(async () => ({ id: "u1", email: "a@x.com" })),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => admin.isAdmin }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const upsertMock = vi.fn(async () => undefined);
vi.mock("@/lib/coverLetterGoldenDataset", () => ({
  upsertCoverLetterGoldenItem: (...a: unknown[]) => (upsertMock as unknown as (...args: unknown[]) => unknown)(...a),
}));

import { saveCoverLetterEdit, deleteCoverLetterEdit } from "@/app/actions/coverLetterEdits";

const LETTER_JSON = {
  greeting: "Dear Hiring Manager,", paragraphs: ["Original body."],
  closing: "Sincerely,", signature: "Ada",
};
const SRC_ROW = {
  cover_letter_json: LETTER_JSON, cover_letter_trace_id: "tr-1",
  cover_letter_instructions: "C focus", title: "Eng", company_name: "Acme",
  description: "jd", about: "about", requirements: [{ text: "5y", met: true }],
  skill_gaps: ["rust"], red_flags: [], resume_text: "bg", full_name: "Ada",
  model_cover: "m-cover",
};

beforeEach(() => {
  sqlMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
  admin.isAdmin = true;
});

describe("saveCoverLetterEdit", () => {
  it("rejects empty / whitespace-only text", async () => {
    await expect(saveCoverLetterEdit("j1", "   \n ")).rejects.toThrow(/empty/i);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects over-cap text", async () => {
    await expect(saveCoverLetterEdit("j1", "x".repeat(20_001))).rejects.toThrow(/too long/i);
  });

  it("throws when no package exists for the job", async () => {
    sqlMock.mockResolvedValueOnce([]); // SELECT → none
    await expect(saveCoverLetterEdit("j1", "Edited.")).rejects.toThrow(/no cover letter/i);
  });

  it("persists the edit and pushes the golden item (admin): expectedOutput = the edit", async () => {
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined); // SELECT, then upsert
    const res = await saveCoverLetterEdit("j1", "Dear Hiring Manager,\n\nEdited body.", "note");
    expect(res).toEqual({ ok: true, langfuseSynced: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    const item = (upsertMock.mock.calls[0] as unknown[])[0] as {
      id: string; expectedOutput: Record<string, unknown>;
      input: { instructions: string | null; job: { company: string } };
      metadata: Record<string, unknown>;
    };
    expect(item.id).toBe("u1:j1");
    expect(item.expectedOutput.cover_letter).toBe("Dear Hiring Manager,\n\nEdited body.");
    expect(item.input.instructions).toBe("C focus");
    expect(item.input.job.company).toBe("Acme");
    expect(item.metadata.cover_letter_trace_id).toBe("tr-1");
    // original_text is the COMPOSED text of the stored structured letter.
    expect(item.metadata.original_text).toContain("Original body.");
  });

  it("returns langfuseSynced=false when the push throws (DB already committed)", async () => {
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined);
    upsertMock.mockRejectedValueOnce(new Error("langfuse down"));
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(res).toEqual({ ok: true, langfuseSynced: false });
  });

  it("a NON-admin persists the row but never pushes to the shared dataset", async () => {
    admin.isAdmin = false;
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined);
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(sqlMock).toHaveBeenCalledTimes(2); // SELECT + INSERT still ran
    expect(upsertMock).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, langfuseSynced: true });
  });

  it("a malformed stored letter yields original_text=null but the edit still saves", async () => {
    sqlMock.mockResolvedValueOnce([{ ...SRC_ROW, cover_letter_json: "not-an-object" }]).mockResolvedValueOnce(undefined);
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(res.ok).toBe(true);
    const item = (upsertMock.mock.calls[0] as unknown[])[0] as { metadata: Record<string, unknown> };
    expect(item.metadata.original_text).toBeNull();
  });
});

describe("deleteCoverLetterEdit", () => {
  it("issues the owner-scoped DELETE and resolves", async () => {
    sqlMock.mockResolvedValueOnce(undefined);
    await expect(deleteCoverLetterEdit("j1")).resolves.toEqual({ ok: true });
    expect(sqlMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run lib/coverLetterEdits.action.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `dashboard/app/actions/coverLetterEdits.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { withUserSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import {
  buildCoverLetterGoldenItem,
  type CoverLetterGoldenInput,
} from "@/lib/rolefit/coverLetterScore";
import { upsertCoverLetterGoldenItem } from "@/lib/coverLetterGoldenDataset";

const EDITED_TEXT_MAX_LENGTH = 20_000;

// Persist a human EDIT of the generated cover letter (overlay; never mutates
// application_packages) and — for ADMINS only — push it to the SHARED LangFuse
// cover-letter-golden dataset as the expected_output. DB commits first, so a LangFuse
// failure never loses the edit — it returns langfuseSynced=false and is reconciled by
// `scripts/calibrate-cover-letter-judge.ts --sync`. Structured exactly like
// saveResumeScore (app/actions/resumeScores.ts), incl. the tenant eval-poisoning gate:
// the shared dataset only ever receives admin-authored edits; a normal user's edit
// still persists and overlays THEIR OWN board.
export async function saveCoverLetterEdit(
  jobId: string,
  editedText: string,
  comment: string | null = null,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's edit via a stale JWT
  const text = editedText.trim();
  if (!text) throw new Error("edited cover letter must not be empty");
  if (text.length > EDITED_TEXT_MAX_LENGTH) {
    throw new Error(`edited cover letter too long (max ${EDITED_TEXT_MAX_LENGTH} characters)`);
  }

  const editedAt = new Date().toISOString();
  // Read the full replay context + persist the edit under the viewer's RLS context in
  // one transaction. Returns the source row for the (post-commit) LangFuse push.
  const src = await withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT ap.cover_letter_json, ap.cover_letter_trace_id, ap.cover_letter_instructions,
             j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
             r.about,
             COALESCE(r.requirements, '[]'::jsonb) AS requirements,
             COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
             COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
             p.resume_text, p.full_name, p.model_cover
      FROM application_packages ap
      JOIN jobs j       ON j.id = ap.job_id
      JOIN companies c  ON c.id = j.company_id
      LEFT JOIN job_reviews r ON r.job_id = ap.job_id AND r.user_id = ${userId}::uuid
      LEFT JOIN profiles p    ON p.user_id = ${userId}::uuid
      WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
    `;
    const s = rows[0] as
      | {
          cover_letter_json: unknown; cover_letter_trace_id: string | null;
          cover_letter_instructions: string | null;
          title: string; company_name: string; description: string | null;
          about: string | null; requirements: { text: string; met: boolean }[];
          skill_gaps: string[]; red_flags: string[];
          resume_text: string | null; full_name: string | null; model_cover: string | null;
        }
      | undefined;
    if (!s) throw new Error(`no cover letter generated for job ${jobId}`);

    // The eval "before": composed text of the stored structured letter. A malformed
    // jsonb (total parser returns null) degrades to null, never a crash.
    const parsed = parseTailoredCoverLetter(s.cover_letter_json);
    const originalText = parsed ? composeCoverLetterText(parsed) : null;

    // Re-saving overwrites (last-write-wins) and REVIVES a superseded edit
    // (superseded_at back to NULL) — the fresh edit is current again.
    await tx`
      INSERT INTO cover_letter_edits
        (user_id, job_id, edited_text, original_text, cover_letter_trace_id,
         model, comment, superseded_at, edited_at)
      VALUES (${userId}::uuid, ${jobId}, ${text}, ${originalText}, ${s.cover_letter_trace_id},
              ${s.model_cover}, ${comment}, NULL, now())
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        edited_text = EXCLUDED.edited_text, original_text = EXCLUDED.original_text,
        cover_letter_trace_id = EXCLUDED.cover_letter_trace_id, model = EXCLUDED.model,
        comment = EXCLUDED.comment, superseded_at = NULL, edited_at = now()
    `;
    return { ...s, originalText };
  });

  // Admin-only push to the shared golden dataset. Non-admins: DB row persisted above,
  // nothing to reconcile → langfuseSynced stays true.
  let langfuseSynced = true;
  if (isAdmin(await getUserClaims())) {
    try {
      const input: CoverLetterGoldenInput = {
        background: src.resume_text,
        candidateName: src.full_name,
        instructions: src.cover_letter_instructions,
        job: {
          title: src.title, company: src.company_name, description: src.description,
          about: src.about, requirements: src.requirements,
          skillGaps: src.skill_gaps, redFlags: src.red_flags,
        },
        model: src.model_cover,
      };
      await upsertCoverLetterGoldenItem(
        buildCoverLetterGoldenItem({
          userId, jobId, input, editedText: text, comment,
          traceId: src.cover_letter_trace_id, model: src.model_cover,
          originalText: src.originalText, editedAt,
        }),
      );
    } catch (e) {
      console.error("cover-letter-golden dataset upsert failed", e);
      langfuseSynced = false;
    }
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}

// "Reset to generated": drop the local overlay row so display reverts to the
// structured original. The LangFuse golden item is deliberately left intact — it
// remains a valid historical (job context → ideal letter) capture.
export async function deleteCoverLetterEdit(jobId: string): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await withUserSql(userId, (tx) => tx`
    DELETE FROM cover_letter_edits WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
  `);
  revalidatePath("/");
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify green** — `npx vitest run lib/coverLetterEdits.action.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/actions/coverLetterEdits.ts dashboard/lib/coverLetterEdits.action.test.ts
git commit -m "feat(cover-letter): save/delete edit actions with admin-gated golden push"
```

---

### Task 12: `CoverLetterEditor` component

**Files:**
- Create: `dashboard/components/rolefit/CoverLetterEditor.tsx`
- Test: `dashboard/components/rolefit/CoverLetterEditor.test.tsx`

**Interfaces:**
- Consumes: Task 11 actions.
- Produces:

```ts
export interface CoverLetterEditorProps {
  job: JobRow;
  /** Current display text: the live edit when one exists, else the composed original. */
  letterText: string;
  /** True when a current (non-superseded) edit overlays the generated letter. */
  hasEdit: boolean;
  isAuthed: boolean;
  onSaved: (jobId: string, editedText: string) => void;
  onReset: (jobId: string) => void;
}
export function CoverLetterEditor(props: CoverLetterEditorProps): JSX.Element | null
```

Task 13 renders it inside `ApplicationPanel`'s cover Done view.

- [ ] **Step 1: Write the failing jsdom test**

Create `dashboard/components/rolefit/CoverLetterEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const actions = vi.hoisted(() => ({
  saveCoverLetterEdit: vi.fn(async () => ({ ok: true as const, langfuseSynced: true })),
  deleteCoverLetterEdit: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/app/actions/coverLetterEdits", () => actions);

import { CoverLetterEditor } from "@/components/rolefit/CoverLetterEditor";
import type { JobRow } from "@/lib/types";

const job = { id: "job-1", company_name: "Acme", title: "Eng" } as unknown as JobRow;

beforeEach(() => {
  actions.saveCoverLetterEdit.mockClear();
  actions.deleteCoverLetterEdit.mockClear();
});

describe("CoverLetterEditor", () => {
  test("renders nothing for anon", () => {
    const { container } = render(
      <CoverLetterEditor job={job} letterText="Dear…" hasEdit={false} isAuthed={false}
        onSaved={() => {}} onReset={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("edit → save calls the action with the new text and fires onSaved", async () => {
    const onSaved = vi.fn();
    render(
      <CoverLetterEditor job={job} letterText="Dear Hiring Manager,\n\nOriginal." hasEdit={false}
        isAuthed onSaved={onSaved} onReset={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit letter/i }));
    const ta = screen.getByLabelText(/edited cover letter/i);
    fireEvent.change(ta, { target: { value: "Dear Hiring Manager,\n\nEdited." } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    await waitFor(() =>
      expect(actions.saveCoverLetterEdit).toHaveBeenCalledWith("job-1", "Dear Hiring Manager,\n\nEdited.", null),
    );
    expect(onSaved).toHaveBeenCalledWith("job-1", "Dear Hiring Manager,\n\nEdited.");
    expect(screen.getByText(/edit saved/i)).toBeDefined();
  });

  test("failed LangFuse sync still saves, shows the reconcile note", async () => {
    actions.saveCoverLetterEdit.mockResolvedValueOnce({ ok: true, langfuseSynced: false });
    render(
      <CoverLetterEditor job={job} letterText="Dear…" hasEdit={false} isAuthed
        onSaved={() => {}} onReset={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit letter/i }));
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    await waitFor(() => expect(screen.getByText(/will reconcile/i)).toBeDefined());
  });

  test("'Reset to generated' shows only with an edit, calls delete + onReset", async () => {
    const onReset = vi.fn();
    render(
      <CoverLetterEditor job={job} letterText="Edited text" hasEdit isAuthed
        onSaved={() => {}} onReset={onReset} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reset to generated/i }));
    await waitFor(() => expect(actions.deleteCoverLetterEdit).toHaveBeenCalledWith("job-1"));
    expect(onReset).toHaveBeenCalledWith("job-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/rolefit/CoverLetterEditor.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `dashboard/components/rolefit/CoverLetterEditor.tsx` (styling mirrors `ResumeScorePanel.tsx` — inline styles, `var(--…)` tokens):

```tsx
"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import { saveCoverLetterEdit, deleteCoverLetterEdit } from "@/app/actions/coverLetterEdits";

export interface CoverLetterEditorProps {
  job: JobRow;
  /** Current display text: the live edit when one exists, else the composed original. */
  letterText: string;
  /** True when a current (non-superseded) edit overlays the generated letter. */
  hasEdit: boolean;
  isAuthed: boolean;
  onSaved: (jobId: string, editedText: string) => void;
  onReset: (jobId: string) => void;
}

// Plain-text single-window editor for the generated cover letter (spec: we never
// reconstruct the structured TailoredCoverLetter from edited text). Mirrors
// ResumeScorePanel's save/UI conventions: DB-first server action, sync status note.
export function CoverLetterEditor({ job, letterText, hasEdit, isAuthed, onSaved, onReset }: CoverLetterEditorProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(letterText);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(null);

  if (!isAuthed) return null;

  const onSave = async () => {
    setBusy(true); setStatus(null);
    try {
      const res = await saveCoverLetterEdit(job.id, text, comment.trim() || null);
      setStatus({
        ok: res.langfuseSynced,
        text: res.langfuseSynced ? "Edit saved." : "Saved. LangFuse sync failed — will reconcile.",
      });
      onSaved(job.id, text.trim());
      setOpen(false);
    } catch {
      setStatus({ ok: false, text: "Save failed — try again." });
    } finally {
      setBusy(false);
    }
  };

  const onResetClick = async () => {
    setBusy(true); setStatus(null);
    try {
      await deleteCoverLetterEdit(job.id);
      onReset(job.id);
      setOpen(false);
    } catch {
      setStatus({ ok: false, text: "Reset failed — try again." });
    } finally {
      setBusy(false);
    }
  };

  const secondaryBtn: React.CSSProperties = {
    fontWeight: 700, fontSize: "12.5px", color: "var(--text-secondary)",
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "9px", padding: "8px 13px", cursor: "pointer",
  };

  return (
    <div style={{ marginTop: "13px", borderTop: "1px dashed var(--border)", paddingTop: "13px" }}>
      {!open ? (
        <div style={{ display: "flex", gap: "9px", alignItems: "center" }}>
          <button type="button" onClick={() => { setText(letterText); setOpen(true); }} style={secondaryBtn}>
            ✎ Edit letter
          </button>
          {hasEdit && (
            <button type="button" onClick={onResetClick} disabled={busy} style={secondaryBtn}>
              Reset to generated
            </button>
          )}
          {status && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "var(--success)" : "var(--danger)" }}>
              {status.text}
            </span>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--text-primary)" }}>
            Edit cover letter
          </div>
          <textarea
            aria-label="Edited cover letter"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            maxLength={20000}
            style={{
              width: "100%", marginTop: "9px", padding: "10px 12px", fontSize: "13px",
              lineHeight: 1.6, border: "1px solid var(--border)", borderRadius: "9px",
              resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          <input
            aria-label="Edit comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why this edit? (optional — travels with the golden item)"
            style={{
              width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
              border: "1px solid var(--border)", borderRadius: "9px", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "9px", marginTop: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onSave}
              disabled={busy || !text.trim()}
              style={{
                fontWeight: 700, fontSize: "13px", color: "var(--text-on-accent)",
                background: busy || !text.trim() ? "var(--accent-border)" : "var(--accent)",
                border: "none", borderRadius: "9px", padding: "9px 16px",
                cursor: busy || !text.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Saving…" : "Save edit"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setStatus(null); }} style={secondaryBtn}>
              Cancel
            </button>
            {status && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "var(--success)" : "var(--danger)" }}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify green** — `npx vitest run components/rolefit/CoverLetterEditor.test.tsx && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/CoverLetterEditor.tsx dashboard/components/rolefit/CoverLetterEditor.test.tsx
git commit -m "feat(cover-letter): plain-text editor component with save / reset-to-generated"
```

---

### Task 13: Wire the edit into `ApplicationPanel` / `JobDetail` / `RolefitBoard`

**Files:**
- Modify: `dashboard/components/rolefit/ApplicationPanel.tsx` (props ~line 32-68; cover Done view ~lines 463-555; `handleCoverDownload` ~lines 133-162), `dashboard/components/rolefit/JobDetail.tsx` (props ~line 60-99; `<ApplicationPanel …>` ~line 604), `dashboard/components/rolefit/RolefitBoard.tsx` (state init ~line 172-205; `applySettledReady` ~line 898; `<JobDetail …>` ~line 1203)
- Create: `dashboard/components/rolefit/ApplicationPanel.edited.test.tsx`

**Interfaces:**
- Consumes: Task 10 `ApplicationPackage.coverLetterEditedText`, Task 12 `CoverLetterEditor`.
- Produces (props threaded top-down):
  - `ApplicationPanelProps` gains `coverEditedText: string | null; onCoverEditSaved: (jobId: string, text: string) => void; onCoverEditReset: (jobId: string) => void;`
  - `JobDetailProps` gains `coverEdited: Record<string, string>; onCoverEditSaved: (jobId: string, text: string) => void; onCoverEditReset: (jobId: string) => void;`
  - `RolefitBoard` owns `coverEdited: Record<string, string>` state.

- [ ] **Step 1: Write the failing panel test**

Create `dashboard/components/rolefit/ApplicationPanel.edited.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/coverLetterEdits", () => ({
  saveCoverLetterEdit: vi.fn(async () => ({ ok: true, langfuseSynced: true })),
  deleteCoverLetterEdit: vi.fn(async () => ({ ok: true })),
}));

import { ApplicationPanel } from "@/components/rolefit/ApplicationPanel";
import type { JobRow } from "@/lib/types";

const job = { id: "job-1", company_name: "Acme", title: "Eng", ats: "lever", url: "https://x" } as unknown as JobRow;
const LETTER = {
  greeting: "Dear Hiring Manager,", paragraphs: ["Original model paragraph."],
  closing: "Sincerely,", signature: "Ada",
};

function renderPanel(coverEditedText: string | null) {
  return render(
    <ApplicationPanel
      job={job} isAuthed
      resumeState={undefined} resumeData={undefined} resumeStale={false}
      onGenerateResume={() => {}} onRegenerateResume={() => {}} onCopyResume={() => {}}
      resumeCopyLabel="Copy" usingSample={false} onOpenProfile={() => {}}
      coverState="done" coverData={LETTER}
      onGenerateCover={() => {}} onRegenerateCover={() => {}}
      onPrepare={() => {}}
      greenhouseQuestions={null} prefilledAnswers={null}
      status="prepared" appliedAt={null} onMarkApplied={() => {}}
      coverEditedText={coverEditedText}
      onCoverEditSaved={() => {}} onCoverEditReset={() => {}}
    />,
  );
}

describe("ApplicationPanel — edited cover letter display", () => {
  test("a current edit renders over the structured letter with an Edited chip", () => {
    renderPanel("Dear Hiring Manager,\n\nHuman-edited paragraph.\n\nSincerely,\nAda");
    expect(screen.getByText(/human-edited paragraph/i)).toBeDefined();
    expect(screen.getByText(/^Edited$/)).toBeDefined();
    expect(screen.queryByText(/original model paragraph/i)).toBeNull();
  });

  test("no edit → the structured letter renders, no chip", () => {
    renderPanel(null);
    expect(screen.getByText(/original model paragraph/i)).toBeDefined();
    expect(screen.queryByText(/^Edited$/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/rolefit/ApplicationPanel.edited.test.tsx` → FAIL (unknown props / no edited render).

- [ ] **Step 3: Implement `ApplicationPanel`**

(a) Props — add to `ApplicationPanelProps` and destructure:

```ts
  // Human edit overlay (Phase: editable cover letters). Non-null = a CURRENT
  // (non-superseded) edit that displays/downloads over the structured original.
  coverEditedText: string | null;
  onCoverEditSaved: (jobId: string, text: string) => void;
  onCoverEditReset: (jobId: string) => void;
```

(b) Imports: `import { CoverLetterEditor } from "./CoverLetterEditor";`

(c) `handleCoverDownload` — edited text takes over both the PDF body and the .txt fallback:

```ts
  const handleCoverDownload = async () => {
    if (!coverData && !coverEditedText) return;
    const fname = `Cover Letter - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
    const text = coverEditedText ?? composeCoverLetterText(coverData!);
    await downloadPdf(
      fname,
      (doc) => {
        const W: number = doc.internal.pageSize.getWidth();
        const M = 56;
        let y = 72;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(31, 36, 48);
        const wrap = (txt: string): string[] => doc.splitTextToSize(txt, W - 2 * M);
        const writeBlock = (txt: string) => {
          wrap(txt).forEach((l: string) => {
            if (y > 720) { doc.addPage(); y = 72; }
            doc.text(l, M, y);
            y += 16;
          });
        };
        if (coverEditedText) {
          // Edited letters are plain text: render line-by-line, blank lines as spacing.
          coverEditedText.split("\n").forEach((line) => {
            if (line.trim() === "") { y += 10; return; }
            writeBlock(line);
          });
        } else {
          writeBlock(coverData!.greeting);
          y += 8;
          coverData!.paragraphs.forEach((p) => { writeBlock(p); y += 10; });
          writeBlock(coverData!.closing);
          writeBlock(coverData!.signature);
        }
      },
      text,
    );
  };
```

(d) Cover Done view (`{coverDone && coverData && (…)}`): after the "Cover letter ready" header row, add the chip and swap the letter body:

```tsx
              {coverEditedText && (
                <Chip
                  color="var(--accent)"
                  bg="var(--accent-bg)"
                  border="var(--accent-border)"
                  style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "3px 8px" }}
                >
                  Edited
                </Chip>
              )}
```

```tsx
            {coverEditedText ? (
              <div
                style={{
                  marginTop: "12px", background: "var(--bg-surface)",
                  border: "1px solid var(--border)", borderRadius: "12px",
                  padding: "15px 16px", maxHeight: "260px", overflowY: "auto",
                  fontSize: "13px", lineHeight: 1.62, color: "var(--text-primary)",
                  fontWeight: 500, whiteSpace: "pre-wrap",
                }}
              >
                {coverEditedText}
              </div>
            ) : (
              /* …the existing structured greeting/paragraphs/closing/signature block, unchanged… */
            )}
```

(e) Copy button uses the display text: `onClick={() => flashCopied("cover", coverEditedText ?? composeCoverLetterText(coverData))}`.

(f) Editor at the bottom of the Done view (after the buttons row):

```tsx
            <CoverLetterEditor
              job={job}
              letterText={coverEditedText ?? composeCoverLetterText(coverData)}
              hasEdit={Boolean(coverEditedText)}
              isAuthed={isAuthed}
              onSaved={onCoverEditSaved}
              onReset={onCoverEditReset}
            />
```

- [ ] **Step 4: Thread through `JobDetail`**

Add to `JobDetailProps` + destructure: `coverEdited: Record<string, string>; onCoverEditSaved: (jobId: string, text: string) => void; onCoverEditReset: (jobId: string) => void;` and to the `<ApplicationPanel …>` invocation (line ~604):

```tsx
            coverEditedText={coverEdited[job.id] ?? null}
            onCoverEditSaved={onCoverEditSaved}
            onCoverEditReset={onCoverEditReset}
```

- [ ] **Step 5: Own the state in `RolefitBoard`**

Beside the `coverData` init (line ~200):

```ts
  // Human cover-letter edits (current/non-superseded only) — display + download override.
  const [coverEdited, setCoverEdited] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) if (p.coverLetterEditedText) m[p.jobId] = p.coverLetterEditedText;
    return m;
  });
  const handleCoverEditSaved = useCallback((jobId: string, text: string) => {
    setCoverEdited((m) => ({ ...m, [jobId]: text }));
  }, []);
  const handleCoverEditReset = useCallback((jobId: string) => {
    setCoverEdited((m) => {
      if (!(jobId in m)) return m;
      const { [jobId]: _gone, ...rest } = m;
      return rest;
    });
  }, []);
```

In `applySettledReady` (line ~898), after `setPackages(…)` add:

```ts
    // A regenerate supersedes the edit server-side; mirror it here so the fresh letter
    // replaces the stale edit in the pane without a reload.
    setCoverEdited((m) => {
      if (pkg.coverLetterEditedText) return { ...m, [g.jobId]: pkg.coverLetterEditedText };
      if (m[g.jobId]) {
        const { [g.jobId]: _gone, ...rest } = m;
        return rest;
      }
      return m;
    });
```

And pass to `<JobDetail …>` (line ~1203):

```tsx
                    coverEdited={coverEdited}
                    onCoverEditSaved={handleCoverEditSaved}
                    onCoverEditReset={handleCoverEditReset}
```

- [ ] **Step 6: Run to verify green** — `npx vitest run components/rolefit/ApplicationPanel.edited.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/RolefitBoard.test.tsx && npx tsc --noEmit` → PASS. If `JobDetail.test.tsx`/`RolefitBoard.test.tsx` construct props or `ApplicationPackage` fixtures, add the new fields (`coverEdited: {}` / `coverLetterEditedText: null` etc.) — the type errors name each spot.

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/rolefit/ApplicationPanel.tsx dashboard/components/rolefit/ApplicationPanel.edited.test.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/RolefitBoard.tsx $(git diff --name-only -- dashboard/components | grep test || true)
git commit -m "feat(cover-letter): edited letter displays/downloads over the original with editor + board wiring"
```

---

### Task 14: `GenerationInstructions` component

**Files:**
- Create: `dashboard/components/rolefit/GenerationInstructions.tsx`
- Test: `dashboard/components/rolefit/GenerationInstructions.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface GenerationInstructionsProps {
  /** Current instructions text ("" = none). */
  value: string;
  onChange: (v: string) => void;
  /** Labels the placeholder, e.g. "résumé" or "cover letter". */
  kind: string;
}
export function GenerationInstructions(props: GenerationInstructionsProps): JSX.Element
```

Task 15 renders it in `ResumePanel` + `ApplicationPanel`.

- [ ] **Step 1: Write the failing jsdom test**

Create `dashboard/components/rolefit/GenerationInstructions.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerationInstructions } from "@/components/rolefit/GenerationInstructions";

describe("GenerationInstructions", () => {
  test("collapsed by default; expanding reveals the textarea with the seeded value", () => {
    render(<GenerationInstructions value="Focus on infra" onChange={() => {}} kind="résumé" />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Focus on infra");
  });

  test("stays collapsed until toggled; typing propagates onChange", () => {
    const onChange = vi.fn();
    render(<GenerationInstructions value="" onChange={onChange} kind="cover letter" />);
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mention the launch" } });
    expect(onChange).toHaveBeenCalledWith("Mention the launch");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/rolefit/GenerationInstructions.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

Create `dashboard/components/rolefit/GenerationInstructions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

export interface GenerationInstructionsProps {
  /** Current instructions text ("" = none). */
  value: string;
  onChange: (v: string) => void;
  /** Labels the placeholder, e.g. "résumé" or "cover letter". */
  kind: string;
}

// Per-job "Generation instructions" expander. Defaults collapsed and empty; the text
// rides the NEXT generate/regenerate request (the route persists it alongside the
// artifact — typing without generating is deliberately ephemeral local state).
export function GenerationInstructions({ value, onChange, kind }: GenerationInstructionsProps) {
  const [open, setOpen] = useState(false);
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
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={INSTRUCTIONS_MAX_LENGTH}
          rows={3}
          placeholder={`Optional — what the ${kind} should focus on or avoid. Applies on the next generate.`}
          style={{
            width: "100%", marginTop: "8px", padding: "8px 10px", fontSize: "12.5px",
            lineHeight: 1.5, border: "1px solid var(--border)", borderRadius: "9px",
            resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify green** — `npx vitest run components/rolefit/GenerationInstructions.test.tsx && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/GenerationInstructions.tsx dashboard/components/rolefit/GenerationInstructions.test.tsx
git commit -m "feat(instructions): collapsible per-job generation-instructions box"
```

---

### Task 15: Wire instruction boxes + request bodies (ResumePanel / ApplicationPanel / JobDetail / RolefitBoard)

**Depends on Task 13 (shares the same three wiring files).**

**Files:**
- Modify: `dashboard/components/rolefit/ResumePanel.tsx` (props ~line 28-47; idle block ~line 131-174; done block ~line 231-383), `dashboard/components/rolefit/ApplicationPanel.tsx` (props; cover idle ~line 352-376; cover done; ResumePanel pass-through ~line 332), `dashboard/components/rolefit/JobDetail.tsx` (props + `<ApplicationPanel …>`), `dashboard/components/rolefit/RolefitBoard.tsx` (state; `handleGenerate` ~line 770-806; `handleGenerateCover` ~line 809-841; `handlePrepare` ~line 848-892; `<JobDetail …>`)

**Interfaces:**
- Consumes: Tasks 5/6/7 request bodies, Task 10 seeds, Task 14 component.
- Produces:
  - `ResumePanelProps` gains `instructions: string; onInstructionsChange: (v: string) => void;`
  - `ApplicationPanelProps` gains `resumeInstructions: string; onResumeInstructionsChange: (v: string) => void; coverInstructions: string; onCoverInstructionsChange: (v: string) => void;`
  - `JobDetailProps` gains `resumeInstructions: Record<string, string>; coverInstructions: Record<string, string>; onResumeInstructionsChange: (jobId: string, v: string) => void; onCoverInstructionsChange: (jobId: string, v: string) => void;`

- [ ] **Step 1: Extend the panel test (failing first)**

Append to `dashboard/components/rolefit/ApplicationPanel.edited.test.tsx` (extend `renderPanel` with the four new props, passing `resumeInstructions=""`, `coverInstructions="Persisted focus"` and spies):

```tsx
describe("ApplicationPanel — cover generation instructions", () => {
  test("expander seeds from the persisted value and propagates edits", () => {
    const onCoverInstructionsChange = vi.fn();
    renderPanel(null, { coverInstructions: "Persisted focus", onCoverInstructionsChange });
    // Two expanders render (résumé + cover); the cover one is inside the cover panel.
    const toggles = screen.getAllByRole("button", { name: /generation instructions/i });
    fireEvent.click(toggles[toggles.length - 1]);
    const ta = screen.getByPlaceholderText(/cover letter should focus on/i) as HTMLTextAreaElement;
    expect(ta.value).toBe("Persisted focus");
    fireEvent.change(ta, { target: { value: "New focus" } });
    expect(onCoverInstructionsChange).toHaveBeenCalledWith("New focus");
  });
});
```

(Refactor `renderPanel(coverEditedText, overrides?)` to accept prop overrides; default the new props to `""`/no-ops.)

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/rolefit/ApplicationPanel.edited.test.tsx` → FAIL (unknown props).

- [ ] **Step 3: Implement the panels**

`ResumePanel.tsx`: add props `instructions: string; onInstructionsChange: (v: string) => void;`, import `GenerationInstructions`, and render `<GenerationInstructions value={instructions} onChange={onInstructionsChange} kind="résumé" />`:
- in the authed idle block, directly under the description `<div style={{ flex: 1 }}>…</div>` content (inside it, after the `usingSample` note), and
- in the Done block, directly after the Download/Copy/Regenerate buttons row (before `<ResumeScorePanel …>`).

`ApplicationPanel.tsx`: add the four props; forward the résumé pair to `<ResumePanel instructions={resumeInstructions} onInstructionsChange={onResumeInstructionsChange} …>`; render `<GenerationInstructions value={coverInstructions} onChange={onCoverInstructionsChange} kind="cover letter" />` in the cover idle block (inside the `flex: 1` description div) and in the cover Done block (after the buttons row, before `<CoverLetterEditor …>`).

`JobDetail.tsx`: add the map-shaped props; pass per-job values down:

```tsx
            resumeInstructions={resumeInstructions[job.id] ?? ""}
            onResumeInstructionsChange={(v) => onResumeInstructionsChange(job.id, v)}
            coverInstructions={coverInstructions[job.id] ?? ""}
            onCoverInstructionsChange={(v) => onCoverInstructionsChange(job.id, v)}
```

- [ ] **Step 4: Implement the board state + request bodies**

`RolefitBoard.tsx` — state seeded from the persisted per-job values:

```ts
  // Per-job generation instructions. Seeded from the persisted package value; typing
  // is local state that rides the NEXT generate request (the route persists it).
  const [resumeInstructions, setResumeInstructions] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) if (p.resumeInstructions) m[p.jobId] = p.resumeInstructions;
    return m;
  });
  const [coverInstructions, setCoverInstructions] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialPackages) if (p.coverLetterInstructions) m[p.jobId] = p.coverLetterInstructions;
    return m;
  });
  const handleResumeInstructionsChange = useCallback((jobId: string, v: string) => {
    setResumeInstructions((m) => ({ ...m, [jobId]: v }));
  }, []);
  const handleCoverInstructionsChange = useCallback((jobId: string, v: string) => {
    setCoverInstructions((m) => ({ ...m, [jobId]: v }));
  }, []);
```

Request bodies — in `handleGenerate` change the fetch body to:

```ts
        body: JSON.stringify({ jobId: job.id, instructions: resumeInstructions[job.id]?.trim() || undefined }),
```

(and add `resumeInstructions` to that `useCallback`'s dependency array). In `handleGenerateCover`:

```ts
        body: JSON.stringify({ jobId: job.id, instructions: coverInstructions[job.id]?.trim() || undefined }),
```

(dep: `coverInstructions`). In `handlePrepare`:

```ts
        body: JSON.stringify({
          jobId: job.id,
          resumeInstructions: resumeInstructions[job.id]?.trim() || undefined,
          coverLetterInstructions: coverInstructions[job.id]?.trim() || undefined,
        }),
```

(deps: both maps). Pass the four new props to `<JobDetail …>`.

- [ ] **Step 5: Run to verify green** — `npx vitest run components/ && npx tsc --noEmit` → PASS (fix any fixture-shaped type errors in existing component tests the same way as Task 13 Step 6).

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/rolefit/ResumePanel.tsx dashboard/components/rolefit/ApplicationPanel.tsx dashboard/components/rolefit/ApplicationPanel.edited.test.tsx dashboard/components/rolefit/JobDetail.tsx dashboard/components/rolefit/RolefitBoard.tsx $(git diff --name-only -- dashboard/components | grep test || true)
git commit -m "feat(instructions): per-job instruction boxes ride generate/regenerate/prepare requests"
```

---

### Task 16: Judge rubric + `calibrate-cover-letter-judge.ts`

**Files:**
- Create: `dashboard/lib/rolefit/coverLetterJudgeRubric.ts`, `dashboard/scripts/calibrate-cover-letter-judge.ts`

**Interfaces:**
- Consumes: Task 2 `generateCoverLetter`, Task 8 constants/`coverLetterOverall`/`buildCoverLetterGoldenItem`, Task 9 `upsertCoverLetterGoldenItem`, `callOpenRouterStructured` (`@/lib/rolefit/openrouterClient`), `composeCoverLetterText`, `serviceSql` (`../lib/db.ts` — NOT `sql`, see discrepancy 3), `resolveLangfuseHost`.
- Produces: `COVER_LETTER_JUDGE_RUBRIC`, `renderCoverLetterJudgePrompt(vars)`, score-name constants `"grounding" | "jd_relevance" | "fidelity"`; the runnable script.

- [ ] **Step 1: Write the rubric**

Create `dashboard/lib/rolefit/coverLetterJudgeRubric.ts`:

```ts
// SOURCE OF TRUTH for the cover-letter LLM-judge rubric. Unlike the résumé judge
// (resumeJudgeRubric.ts — reference-free, runs on live traces via the LangFuse
// managed evaluator), this judge is REFERENCE-BASED: it needs {{golden_letter}}
// (the human-edited ideal), so it runs ONLY from dataset runs / the offline script
// (scripts/calibrate-cover-letter-judge.ts) — never on live traces.
// Three dimensions, 1–5. Overall (0.5*grounding + 0.3*fidelity + 0.2*jd_relevance)
// is computed in code (lib/rolefit/coverLetterScore.ts::coverLetterOverall), NOT by
// the judge.

export const COVER_LETTER_JUDGE_GROUNDING_SCORE_NAME = "grounding";
export const COVER_LETTER_JUDGE_JD_RELEVANCE_SCORE_NAME = "jd_relevance";
export const COVER_LETTER_JUDGE_FIDELITY_SCORE_NAME = "fidelity";

export const COVER_LETTER_JUDGE_RUBRIC = `You are a strict cover-letter-quality judge. You are given the candidate's real background (their source résumé), a target job, a GENERATED cover letter to score, and a GOLDEN cover letter (a human-edited ideal for this exact job). Score the GENERATED LETTER on THREE dimensions, each an integer 1–5. Return ONLY JSON: {"grounding": <1-5>, "jd_relevance": <1-5>, "fidelity": <1-5>}.

CANDIDATE BACKGROUND (source of truth — the candidate's real résumé):
{{candidate_background}}

TARGET JOB:
Title: {{job_title}} at {{company}}
Description: {{job_description}}

GOLDEN LETTER (human-edited ideal — the reference):
{{golden_letter}}

GENERATED LETTER (to be scored):
{{cover_letter}}

DIMENSION 1 — grounding (truthfulness): Every factual claim in the GENERATED LETTER — an employer, title, date, degree, certification, metric, technology, project, domain, or "requirement met" — must be traceable to the CANDIDATE BACKGROUND. Enthusiasm and motivation need no evidence; facts do. Treat a claim that is more specific, senior, or impressive than the background supports as fabrication. 5 = every factual claim supported; 1 = clear fabrication. When uncertain, lean lower — fabrication is the worst failure.

DIMENSION 2 — jd_relevance (targeting): The letter connects the candidate's genuinely-relevant experience to THIS role and company — the strongest matching material leads, terminology is mirrored only where genuinely matched, and there is no generic boilerplate that could open any application. 5 = sharply targeted; 1 = interchangeable with any job.

DIMENSION 3 — fidelity (closeness to the ideal): How close the GENERATED LETTER lands to the GOLDEN LETTER's content choices, emphasis, structure, and tone. Judge substance, not wording: covering the same experiences and angles with different phrasing scores high; leading with material the human edit removed, missing what it added, or striking a clearly different tone scores low. 5 = a reader would accept either interchangeably; 1 = misses what the human edit was correcting.

Return only the JSON object.`;

/** Substitute the rubric variables for an offline (script) judge call. */
export function renderCoverLetterJudgePrompt(vars: {
  candidateBackground: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  coverLetter: string;
  goldenLetter: string;
}): string {
  return COVER_LETTER_JUDGE_RUBRIC
    .replaceAll("{{candidate_background}}", vars.candidateBackground)
    .replaceAll("{{job_title}}", vars.jobTitle)
    .replaceAll("{{company}}", vars.company)
    .replaceAll("{{job_description}}", vars.jobDescription)
    .replaceAll("{{golden_letter}}", vars.goldenLetter)
    .replaceAll("{{cover_letter}}", vars.coverLetter);
}
```

- [ ] **Step 2: Write the script**

Create `dashboard/scripts/calibrate-cover-letter-judge.ts`:

```ts
// Cover-letter judge: golden-dataset backfill + offline replay-and-judge report.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings \
//     --import ./scripts/alias-loader.mjs scripts/calibrate-cover-letter-judge.ts --sync
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings \
//     --import ./scripts/alias-loader.mjs scripts/calibrate-cover-letter-judge.ts \
//     [--model M] [--judge-model J] [--limit N]
//
// Env comes from the CLI flag, NOT process.loadEnvFile(): lib/db.ts THROWS at import
// time when DATABASE_URL is unset, and ESM imports hoist above any script body code —
// a body-level loadEnvFile (the gen-resume.ts pattern) would run too late here.
//
// --sync   reconcile cover_letter_edits → cover-letter-golden (re-push rows whose
//          on-save push failed). Syncs ALL rows regardless of superseded_at — a
//          superseded edit is still a valid (job context → ideal letter) pair.
// --run    (default) pull the dataset, REPLAY generateCoverLetter(input) per item,
//          judge each fresh letter against its golden reference (reference-based
//          rubric, run locally — NOT a LangFuse managed evaluator), print a report.
//          Recording a LangFuse dataset run is a deliberate follow-up (spec:
//          "optionally"); the report is the deliverable here.
//
// RUNNABILITY: --run imports the live generation chain, whose modules use `@/`
// imports throughout — hence the alias-loader --import (mirrors scripts/gen-resume.ts;
// calibrate-resume-judge.ts never touches the chain so it skips the loader). Do NOT
// "clean up" the .ts value-import extensions. Requires LANGFUSE_* + OPENROUTER_API_KEY
// + DATABASE_URL (.env.local or shell env).
import { LangfuseClient } from "@langfuse/client";
import { resolveLangfuseHost } from "../lib/langfuseHost.ts";
// serviceSql, not `sql` — lib/db.ts renamed the export in the go-public merge; the
// résumé calibrate script predates that. Scripts run operator-side with the direct
// connection, same trust level as calibrate-resume-judge.ts.
import { serviceSql } from "../lib/db.ts";
import { generateCoverLetter } from "../lib/rolefit/coverLetterClient.ts";
import { callOpenRouterStructured } from "../lib/rolefit/openrouterClient.ts";
import { composeCoverLetterText } from "../lib/rolefit/coverLetterText.ts";
import {
  COVER_LETTER_GOLDEN_DATASET_NAME,
  buildCoverLetterGoldenItem,
  coverLetterOverall,
  type CoverLetterGoldenInput,
} from "../lib/rolefit/coverLetterScore.ts";
import { upsertCoverLetterGoldenItem } from "../lib/coverLetterGoldenDataset.ts";
import { renderCoverLetterJudgePrompt } from "../lib/rolefit/coverLetterJudgeRubric.ts";

// OpenRouter slug for the judge (the résumé judge is also Sonnet — resumeJudgeRubric.ts).
const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-5";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface EditRow {
  user_id: string; job_id: string; edited_text: string; original_text: string | null;
  cover_letter_trace_id: string | null; model: string | null; comment: string | null;
  edited_at: string; cover_letter_instructions: string | null;
  title: string; company_name: string; description: string | null;
  about: string | null; requirements: { text: string; met: boolean }[];
  skill_gaps: string[]; red_flags: string[];
  resume_text: string | null; full_name: string | null; model_cover: string | null;
}

async function loadEdits(): Promise<EditRow[]> {
  return (await serviceSql`
    SELECT e.user_id, e.job_id, e.edited_text, e.original_text, e.cover_letter_trace_id,
           e.model, e.comment, e.edited_at::text AS edited_at,
           ap.cover_letter_instructions,
           j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
           r.about,
           COALESCE(r.requirements, '[]'::jsonb) AS requirements,
           COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
           COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
           p.resume_text, p.full_name, p.model_cover
    FROM cover_letter_edits e
    JOIN jobs j       ON j.id = e.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN application_packages ap ON ap.user_id = e.user_id AND ap.job_id = e.job_id
    LEFT JOIN job_reviews r ON r.job_id = e.job_id AND r.user_id = e.user_id
    LEFT JOIN profiles p    ON p.user_id = e.user_id
    ORDER BY e.edited_at DESC
  `) as unknown as EditRow[];
}

function rowToInput(r: EditRow): CoverLetterGoldenInput {
  return {
    background: r.resume_text,
    candidateName: r.full_name,
    instructions: r.cover_letter_instructions,
    job: {
      title: r.title, company: r.company_name, description: r.description,
      about: r.about, requirements: r.requirements,
      skillGaps: r.skill_gaps, redFlags: r.red_flags,
    },
    model: r.model_cover,
  };
}

async function sync(): Promise<void> {
  const rows = await loadEdits();
  let n = 0;
  for (const r of rows) {
    await upsertCoverLetterGoldenItem(
      buildCoverLetterGoldenItem({
        userId: r.user_id, jobId: r.job_id, input: rowToInput(r),
        editedText: r.edited_text, comment: r.comment,
        traceId: r.cover_letter_trace_id, model: r.model,
        originalText: r.original_text, editedAt: r.edited_at,
      }),
    );
    n++;
  }
  console.log(`synced ${n} cover_letter_edits → ${COVER_LETTER_GOLDEN_DATASET_NAME}`);
}

function langfuse(): LangfuseClient {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    throw new Error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY required");
  }
  return new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: resolveLangfuseHost(),
  });
}

const JUDGE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "cover_letter_judge_scores",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["grounding", "jd_relevance", "fidelity"],
      properties: {
        grounding: { type: "integer", minimum: 1, maximum: 5 },
        jd_relevance: { type: "integer", minimum: 1, maximum: 5 },
        fidelity: { type: "integer", minimum: 1, maximum: 5 },
      },
    },
  },
} as const;

interface JudgeScores { grounding: number; jd_relevance: number; fidelity: number }

async function judge(args: {
  input: CoverLetterGoldenInput; generated: string; golden: string;
  judgeModel: string; apiKey: string;
}): Promise<JudgeScores> {
  const prompt = renderCoverLetterJudgePrompt({
    candidateBackground: args.input.background ?? "(none)",
    jobTitle: args.input.job.title,
    company: args.input.job.company,
    jobDescription: args.input.job.description ?? "(none)",
    coverLetter: args.generated,
    goldenLetter: args.golden,
  });
  return callOpenRouterStructured<JudgeScores>({
    generationName: "cover-letter-judge",
    label: "cover-letter judge",
    model: args.judgeModel,
    apiKey: args.apiKey,
    system: "You are a strict, consistent evaluation judge. Return only the requested JSON.",
    user: prompt,
    responseFormat: JUDGE_SCHEMA,
    maxTokens: 2000,
    parse: (raw) => {
      const s = raw as JudgeScores;
      for (const k of ["grounding", "jd_relevance", "fidelity"] as const) {
        if (typeof s[k] !== "number" || s[k] < 1 || s[k] > 5) {
          throw new Error(`judge returned bad ${k}: ${String(s[k])}`);
        }
      }
      return s;
    },
  });
}

// Dataset item shape as stored by upsertCoverLetterGoldenItem. The list accessor
// mirrors calibrate-resume-judge.ts's "verify SDK shape" hedge: if the client's
// pagination shape differs, adjust the accessor — the concept (page through items
// of one dataset) holds.
interface DatasetItem {
  id: string;
  input: CoverLetterGoldenInput;
  expectedOutput: { cover_letter: string; comment: string | null };
}

async function loadDatasetItems(c: LangfuseClient, limit: number): Promise<DatasetItem[]> {
  const out: DatasetItem[] = [];
  let page = 1;
  while (out.length < limit) {
    const res = (await c.api.datasetItems.list({
      datasetName: COVER_LETTER_GOLDEN_DATASET_NAME, page, limit: 50,
    })) as unknown as { data?: DatasetItem[]; meta?: { totalPages?: number } };
    const batch = res.data ?? [];
    out.push(...batch);
    if (batch.length === 0 || (res.meta?.totalPages !== undefined && page >= res.meta.totalPages)) break;
    page++;
  }
  return out.slice(0, limit);
}

async function run(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY required for --run");
  const judgeModel = argValue("--judge-model") ?? DEFAULT_JUDGE_MODEL;
  const modelOverride = argValue("--model");
  const limit = Number(argValue("--limit") ?? 50);

  const items = await loadDatasetItems(langfuse(), limit);
  if (items.length === 0) {
    console.log(`no items in ${COVER_LETTER_GOLDEN_DATASET_NAME} — run --sync (or save an admin edit) first`);
    return;
  }

  const agg = { grounding: 0, jd_relevance: 0, fidelity: 0, overall: 0, n: 0 };
  const lines: string[] = [];
  for (const item of items) {
    const input = item.input;
    if (!input?.background || !input.job?.title) {
      console.warn(`skipping ${item.id}: incomplete replay input`);
      continue;
    }
    const model = modelOverride ?? input.model ?? "anthropic/claude-haiku-4.5";
    const { letter } = await generateCoverLetter({
      resumeText: input.background,
      candidateName: input.candidateName,
      instructions: input.instructions,
      job: input.job,
      model,
      apiKey,
    });
    const generated = composeCoverLetterText(letter);
    const s = await judge({ input, generated, golden: item.expectedOutput.cover_letter, judgeModel, apiKey });
    const overall = coverLetterOverall(s.grounding, s.fidelity, s.jd_relevance);
    agg.grounding += s.grounding; agg.jd_relevance += s.jd_relevance;
    agg.fidelity += s.fidelity; agg.overall += overall; agg.n++;
    lines.push(
      `${item.id}  grounding=${s.grounding} fidelity=${s.fidelity} jd=${s.jd_relevance} overall=${overall} (gen model=${model})`,
    );
  }

  console.log(`=== cover-letter replay eval (judge: ${judgeModel}, n=${agg.n}) ===`);
  for (const l of lines) console.log("  " + l);
  if (agg.n > 0) {
    console.log(
      `means: grounding=${(agg.grounding / agg.n).toFixed(2)} fidelity=${(agg.fidelity / agg.n).toFixed(2)} ` +
      `jd_relevance=${(agg.jd_relevance / agg.n).toFixed(2)} overall=${(agg.overall / agg.n).toFixed(2)}`,
    );
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--sync")) await sync();
  else await run();
  await serviceSql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Verify the script loads and fails cleanly without env**

Run (from `dashboard/`, with a scrubbed env so nothing real is touched):

```bash
cd /Users/andrew/Scripts/job-board/dashboard
env -u LANGFUSE_PUBLIC_KEY -u LANGFUSE_SECRET_KEY -u OPENROUTER_API_KEY DATABASE_URL="postgresql://x:x@localhost:1/x" \
  node --experimental-strip-types --no-warnings --import ./scripts/alias-loader.mjs scripts/calibrate-cover-letter-judge.ts --run 2>&1 | head -5
```
Expected: the module graph LOADS (no `ERR_MODULE_NOT_FOUND` / syntax errors) and it exits with the clean `OPENROUTER_API_KEY required for --run` (or `LANGFUSE_… required`) error. That proves the alias loader + import chain; a real `--run` is an operator step post-deploy (needs prod env + dataset items).

Also run `npx vitest run lib/rolefit/coverLetterScore.test.ts lib/coverLetterGoldenDataset.test.ts` (still green) and `npx tsc --noEmit` (scripts/ is excluded from tsc, but the new `lib/rolefit/coverLetterJudgeRubric.ts` is covered).

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/rolefit/coverLetterJudgeRubric.ts dashboard/scripts/calibrate-cover-letter-judge.ts
git commit -m "feat(evals): reference-based cover-letter judge rubric + replay/sync calibrate script"
```

---

### Task 17: Fix the pre-existing `calibrate-resume-judge.ts` runtime break (`sql` → `serviceSql`)

**Context:** Independent, pre-existing bug (discrepancy #3), unrelated to the cover-letter
feature but folded in at the user's request. `dashboard/scripts/calibrate-resume-judge.ts:7`
imports `{ sql }` from `../lib/db.ts`, but that export was renamed `serviceSql` in the
go-public merge (e711cbd). `scripts/` is `tsc`-excluded (`dashboard/tsconfig.json`), so
nothing flagged it; the script fails at ESM link time on every invocation. No dependency
on any other task — can run any time.

**Files:** `dashboard/scripts/calibrate-resume-judge.ts` (modify only).

- [ ] **Step 1 (RED): reproduce the break.** From `dashboard/`:

```bash
cd /Users/andrew/Scripts/job-board/dashboard && node --experimental-strip-types --env-file-if-exists=.env.local scripts/calibrate-resume-judge.ts --sync 2>&1 | head -5
```
Expected (RED): the run fails citing the missing export — `does not provide an export named 'sql'`. This is an ESM link error that fires at module instantiation, *before* evaluation, so it reproduces with no DB/LangFuse env present.

- [ ] **Step 2: fix the import + usage.**
  - Line 7: `import { sql } from "../lib/db.ts";` → `import { serviceSql } from "../lib/db.ts";`
  - Line 22: `return (await sql\`` → `return (await serviceSql\`` (the only usage). Confirm none remain: `grep -nE "\bsql\b" scripts/calibrate-resume-judge.ts` returns nothing (only `serviceSql`).
  - Header comment (the two `node …` run-command lines): add `--env-file-if-exists=.env.local` to each, matching the new cover-letter script. `lib/db.ts` throws at *import* if `DATABASE_URL` is unset, and ESM import hoisting runs `db.ts` before any in-body loader — so env must be supplied via the node flag, not `process.loadEnvFile()`.

- [ ] **Step 3 (GREEN): the export error is gone.** Re-run the Step 1 command. Expected: output no longer contains `does not provide an export named 'sql'`. It now either runs to completion (if `.env.local` carries `DATABASE_URL` + `LANGFUSE_*`) or fails on a missing-env / connection error — either outcome proves the link break is fixed. A full end-to-end run needs prod-ish `DATABASE_URL` + `LANGFUSE_*` and is not required to pass in a bare worktree.

- [ ] **Step 4: control-byte scan + commit.**

```bash
cd /Users/andrew/Scripts/job-board && LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' dashboard/scripts/calibrate-resume-judge.ts || echo CLEAN
git add dashboard/scripts/calibrate-resume-judge.ts
git commit -m "fix(evals): calibrate-resume-judge.ts uses serviceSql (broken sql import since go-public)"
```

---

### Task 18: Full verification sweep

**Files:** none new (fixes only if something is red).

- [ ] **Step 1: Dashboard suite + typecheck + lint**

```bash
cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run && npx tsc --noEmit && npx eslint .
```
Expected: all green. Fix regressions in place (each fix gets its own commit — no amending).

- [ ] **Step 2: Python suite**

```bash
cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest -q
```
Expected: pass (DB-backed tests run, not skip; the `skipIf`-gated binary parseProfile fixture test may skip in a worktree — that one skip is expected).

- [ ] **Step 3: Control-byte scan over everything this branch touched**

```bash
cd /Users/andrew/Scripts/job-board && LC_ALL=C grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]' $(git diff --name-only main...HEAD -- '*.ts' '*.tsx' '*.py' '*.sql' '*.md') || echo CLEAN
```
Expected: `CLEAN`. Also `git diff --stat main...HEAD` must show no unexpected `Bin` files.

- [ ] **Step 4: Commit any sweep fixes**

```bash
git add -A && git commit -m "test(cover-letter): full-suite verification fixes"   # only if there were fixes
```

---

## Rollout (operator steps — NOT part of this branch's implementation)

Per the deploy topology (`migration-before-code`):

1. Apply `migrations/2026-07-07-cover-letter-edits.sql` to Supabase (prod) FIRST — the deployed routes read the new columns immediately.
2. Merge/push the branch to `main` → Vercel auto-deploys the dashboard. Railway/Python services need nothing (no reviewer changes).
3. Post-deploy smoke: generate a cover letter on prod (confirms `cover_letter_trace_id` + instructions persist), save an admin edit (confirms the golden push — check the `cover-letter-golden` dataset on us.cloud.langfuse.com), regenerate (confirms the edit is superseded in the pane).
4. Offline eval, operator-run from `dashboard/` with prod env: `--sync` then `--run` (see Task 16 header). LangFuse dataset-run recording and any managed-evaluator UI setup are deliberate follow-ups, mirroring how the résumé eval shipped.
