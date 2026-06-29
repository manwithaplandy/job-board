# Manual Job Rejection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the authenticated operator reject an AI-approved job from the Rolefit board, producing a row identical in effect to an AI `deny` (removed from the board, JD purged on the next poll, never re-reviewed), marked as human-initiated, with an in-session Undo.

**Architecture:** A reject writes the operator's `job_reviews` row to `verdict='deny', human_override=TRUE` — an **in-place verdict flip** so every existing consumer keyed on `verdict='deny'` (board query, `prune.py` Rule A, `select_candidates`) behaves correctly with no change. A new `human_override` column distinguishes manual rejects from AI denials and makes them sticky against the AI reviewer's upsert. Two thin server actions (`rejectJob`/`unrejectJob`) mirror the existing untested `companies.ts` override action; the board removes the job optimistically and shows an Undo toast.

**Tech Stack:** Postgres (psycopg / `postgres` JS driver), Python 3.11 reviewer/poller, Next.js App Router (React server components + `"use server"` actions), Vitest for pure-function tests, pytest for DB integration tests.

## Global Constraints

- **In-place flip, not the company layered model.** A reject sets `verdict='deny', human_override=TRUE` directly. Do NOT add an `override_verdict` column or switch any consumer to a computed `effective_verdict`. (Companies do that because they override both directions; jobs only reject.)
- **`human_override` is the only new column:** `human_override BOOLEAN NOT NULL DEFAULT FALSE` on `job_reviews`. No other schema change.
- **Reject is final.** No restorable/JD-retaining path. The only undo is the ephemeral toast (a non-destructive `UPDATE`).
- **Reject scope = approved jobs only.** The detail-pane button renders only when `isAuthed && job.verdict === 'approve'`.
- **`unrejectJob` is UPDATE-only**, guarded by `AND human_override = TRUE`; it never `DELETE`s.
- **Single-tenant:** actions use `requireUserId()` exactly like `companies.ts` (viewer = board owner = operator). Both actions `revalidatePath("/")`.
- **The AI reviewer never writes `human_override`** (`_REVIEW_COLUMNS` unchanged) and never modifies a row where `human_override IS TRUE`.
- **Testing convention (factual, matches this codebase):** server actions (`app/actions/*.ts`) and rolefit React components have **no** automated tests here — `companies.ts` and every `components/rolefit/*` file are verified by `tsc`/`build` + manual smoke, not Vitest. Behavioral DB correctness is covered by pytest integration tests; query-string construction by the Vitest `lib/*.test.ts` suite. Match that split; do not stand up new RTL/action-mocking infrastructure.
- **Python tests:** run with `python3 -m pytest` (no `.venv`). DB tests are marked `@requires_db` and need `TEST_DATABASE_URL` (e.g. `postgresql://…@localhost:55432/poller_test`); the `conn` fixture rebuilds the schema from `schema.sql` per test.
- **Dashboard tests/checks:** run from `dashboard/` — `npm test` (Vitest), `npx tsc --noEmit` (typecheck), `npm run build`.

---

### Task 1: Add `human_override` column to `job_reviews` (schema + migration)

**Files:**
- Modify: `schema.sql` (the `CREATE TABLE job_reviews` block, around line 60-95)
- Create: `migrations/2026-06-28-job-human-override.sql`
- Test: `tests/test_schema.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `job_reviews.human_override BOOLEAN NOT NULL DEFAULT FALSE` — relied on by Tasks 2, 3, 4, 5.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_schema.py`:

```python
@requires_db
def test_job_reviews_has_human_override_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'job_reviews' "
            "AND column_name = 'human_override'"
        )
        row = cur.fetchone()
    assert row is not None, "job_reviews.human_override must exist"
    assert row["data_type"] == "boolean"
    assert row["is_nullable"] == "NO"
    assert "false" in row["column_default"].lower()


@requires_db
def test_human_override_defaults_false(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('HO','lever','ho') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:ho:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict) "
            "VALUES (gen_random_uuid(), 'lever:ho:1', 'v', 'approve')"
        )
        cur.execute("SELECT human_override FROM job_reviews WHERE job_id = 'lever:ho:1'")
        assert cur.fetchone()["human_override"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_schema.py::test_job_reviews_has_human_override_column tests/test_schema.py::test_human_override_defaults_false -v`
Expected: FAIL — `human_override` column does not exist (first test: `row is None`; second: `UndefinedColumn`).

- [ ] **Step 3: Add the column to `schema.sql`**

In `schema.sql`, in the `CREATE TABLE job_reviews (...)` block, add the column. Place it right after the `verdict` line (line 66) so the human marker sits next to the verdict it overrides:

```sql
  verdict              TEXT CHECK (verdict IN ('approve','deny')),
  human_override       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = operator set this verdict by hand
```

- [ ] **Step 4: Create the production migration**

Create `migrations/2026-06-28-job-human-override.sql`:

```sql
-- Manual job rejection: mark job_reviews rows the operator denied by hand.
-- A constant DEFAULT adds no table rewrite (instant on existing rows, PG 11+).
ALTER TABLE job_reviews
  ADD COLUMN IF NOT EXISTS human_override BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python3 -m pytest tests/test_schema.py -v`
Expected: PASS (the two new tests plus all existing schema tests).

- [ ] **Step 6: Commit**

```bash
git add schema.sql migrations/2026-06-28-job-human-override.sql tests/test_schema.py
git commit -m "feat(schema): add job_reviews.human_override for manual rejection"
```

---

### Task 2: Make the AI reviewer's upsert sticky against `human_override`

**Files:**
- Modify: `reviewer/db.py` (the `_UPSERT_REVIEW_SQL` constant, lines 17-23)
- Test: `tests/test_reviewer_db.py`

**Interfaces:**
- Consumes: `job_reviews.human_override` (Task 1).
- Produces: `upsert_review(conn, row)` now leaves any row with `human_override IS TRUE` unmodified. No signature change.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_reviewer_db.py` (it already imports `rdb`, `_seed_job`, `USER`):

```python
@requires_db
def test_upsert_review_does_not_clobber_human_override(conn):
    """A manually-rejected row (human_override=TRUE) must survive a later AI upsert."""
    job_id = _seed_job(conn)
    # AI first approves it
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "fit_score": 80,
    })
    # Operator rejects by hand (what rejectJob does): flip to deny + human_override
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE job_reviews SET verdict='deny', human_override=TRUE WHERE job_id=%s",
            (job_id,),
        )
    conn.commit()
    # AI tries to re-write the same row back to approve
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v2",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "changed my mind", "fit_score": 95,
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT verdict, human_override, reasoning, fit_score FROM job_reviews WHERE job_id=%s",
            (job_id,),
        )
        row = cur.fetchone()
    # The human reject stands; the AI's attempted overwrite was suppressed.
    assert row["verdict"] == "deny"
    assert row["human_override"] is True
    assert row["reasoning"] == "ok"
    assert row["fit_score"] == 80
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_reviewer_db.py::test_upsert_review_does_not_clobber_human_override -v`
Expected: FAIL — without the guard the upsert overwrites the row, so `verdict == "approve"` and the assertion on `"deny"` fails.

- [ ] **Step 3: Add the conflict guard to `_UPSERT_REVIEW_SQL`**

In `reviewer/db.py`, the constant currently reads:

```python
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO job_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, job_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'job_id'))}"
    ", reviewed_at = now()"
)
```

Append a `WHERE` clause to the `DO UPDATE` so it skips human-overridden rows (insert path is unaffected; a fresh row has the default `human_override = FALSE`):

```python
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO job_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, job_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'job_id'))}"
    ", reviewed_at = now()\n"
    # Human overrides are sticky: never let the AI reviewer overwrite a row the
    # operator denied by hand. (A denied job is also excluded from select_candidates,
    # so this only matters for a job rejected mid-review-run.)
    "    WHERE job_reviews.human_override IS NOT TRUE"
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest tests/test_reviewer_db.py -v`
Expected: PASS — the new test passes and all existing reviewer-db tests (which use `human_override = FALSE` rows) still pass.

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): keep human_override rows sticky against AI upsert"
```

---

### Task 3: Surface `human_override` in the jobs query and `JobRow`

**Files:**
- Modify: `dashboard/lib/jobsQuery.ts` (the `selectCols` push for the owner branch, lines 82-91)
- Modify: `dashboard/lib/types.ts` (the `JobRow` interface, after the `verdict` field around line 15)
- Test: `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: `job_reviews.human_override` (Task 1).
- Produces: `JobRow.human_override: boolean`; `buildJobsQuery` selects `r.human_override` in the owner branch. Relied on by Tasks 5 & 6.

- [ ] **Step 1: Write the failing test**

Add to `dashboard/lib/jobsQuery.test.ts` inside the `describe("buildJobsQuery", …)` block:

```ts
  test("selects r.human_override when an owner is present", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.human_override");
  });

  test("human_override absent without an owner", () => {
    expect(buildJobsQuery(base, null).text).not.toContain("r.human_override");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dashboard/`): `npm test -- jobsQuery`
Expected: FAIL — the owner-branch test fails because `r.human_override` is not in the query yet.

- [ ] **Step 3: Add `r.human_override` to the query**

In `dashboard/lib/jobsQuery.ts`, inside the `if (hasReviews) { selectCols.push(…) }` block (lines 82-91), append `"r.human_override"` to the pushed list. Put it next to `"r.verdict"` for readability:

```ts
  if (hasReviews) {
    selectCols.push(
      "r.verdict", "r.human_override", "r.experience_match", "r.industry", "r.industry_subcategory",
      "r.confidence", "r.reasoning", "r.stage1_decision", "r.stage1_reason",
      "r.role_category", "r.seniority", "r.work_arrangement", "r.about",
      "r.pay_min", "r.pay_max", "r.pay_currency", "r.pay_period", "r.headcount",
      "r.skills_score", "r.experience_score", "r.comp_score", "r.fit_score",
      "r.red_flags", "r.skill_gaps", "r.benefits", "r.requirements",
    );
  }
```

- [ ] **Step 4: Add the field to `JobRow`**

In `dashboard/lib/types.ts`, in the `JobRow` interface, add the field directly under `verdict` (line 15):

```ts
  verdict: string | null;
  human_override: boolean;  // TRUE when the operator manually rejected this job
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run (from `dashboard/`):
`npm test -- jobsQuery && npx tsc --noEmit`
Expected: PASS — both new tests pass; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/types.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat(dashboard): surface job_reviews.human_override on JobRow"
```

---

### Task 4: `rejectJob` / `unrejectJob` server actions

**Files:**
- Create: `dashboard/app/actions/jobs.ts`

**Interfaces:**
- Consumes: `job_reviews.human_override` (Task 1); `requireUserId` from `@/lib/auth`; `sql` from `@/lib/db`; `revalidatePath` from `next/cache` — exactly the imports `app/actions/companies.ts` uses.
- Produces:
  - `rejectJob(jobId: string): Promise<void>`
  - `unrejectJob(jobId: string, priorVerdict: string | null): Promise<void>`
  Both relied on by Task 6.

> **Testing note (per Global Constraints):** server actions have no Vitest coverage in this codebase (`companies.ts` has none; Vitest can't reach Supabase auth + postgres without infrastructure that doesn't exist here). The SQL's behavioral correctness is covered by the pytest tests in Tasks 1-2 (`human_override` default, stickiness) and the existing cascade test. This task's gate is `tsc` + `lint` + `build`; behavior is verified in Task 6's manual smoke.

- [ ] **Step 1: Create the actions file**

Create `dashboard/app/actions/jobs.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

// Manual reject. Mirrors an AI deny: flips the operator's review row to
// verdict='deny' and marks it human_override so it is distinguishable and sticky
// (the AI reviewer won't overwrite it; prune.py Rule A nulls the JD next poll;
// select_candidates never re-reviews a deny). Inserts a minimal row if the job
// was never reviewed. profile_version='' matches the company-override convention.
export async function rejectJob(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO job_reviews
      (user_id, job_id, profile_version, verdict, human_override, reviewed_at)
    VALUES (${userId}::uuid, ${jobId}, '', 'deny', TRUE, now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = 'deny', human_override = TRUE, reviewed_at = now()
  `;
  revalidatePath("/");
}

// Undo (in-session). Non-destructive restore of the prior verdict, guarded by
// human_override = TRUE so it only ever touches a row this feature rejected.
// Never DELETEs — undoing a reject of a gate-rejected row keeps its
// stage1_decision intact. Effective only until the next poll runs prune.
export async function unrejectJob(
  jobId: string,
  priorVerdict: string | null,
): Promise<void> {
  const userId = await requireUserId();
  await sql`
    UPDATE job_reviews
       SET verdict = ${priorVerdict}, human_override = FALSE, reviewed_at = now()
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND human_override = TRUE
  `;
  revalidatePath("/");
}
```

- [ ] **Step 2: Typecheck, lint, and build**

Run (from `dashboard/`):
`npx tsc --noEmit && npm run build`
Expected: PASS — no type errors; the build compiles the new server action (Next.js validates `"use server"` export signatures: both exports are async functions returning `Promise<void>`, which is valid).

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/actions/jobs.ts
git commit -m "feat(dashboard): rejectJob / unrejectJob server actions"
```

---

### Task 5: Detail-pane Reject button + "rejected · you" badge

**Files:**
- Modify: `dashboard/components/rolefit/JobDetail.tsx` (props interface + a new action row after the header block, around line 273)

**Interfaces:**
- Consumes: `JobRow.human_override`, `JobRow.verdict` (Task 3); `isAuthed` (already a prop).
- Produces: `JobDetailProps.onReject?: (job: JobRow) => void` — supplied by Task 6. Declared **optional** so this task typechecks and builds green on its own (the button calls it guarded); Task 6 supplies the real handler.

> **Testing note:** rolefit components have no automated tests in this codebase. Gate: `tsc` + `build`; visual behavior verified in Task 6's smoke.

- [ ] **Step 1: Add `onReject` to the props interface**

In `dashboard/components/rolefit/JobDetail.tsx`, add to `JobDetailProps` (after `onOpenProfile: () => void;`, line 31). It is optional so this task builds green before Task 6 wires the handler:

```ts
  onReject?: (job: JobRow) => void;
```

And destructure it in the component signature (add `onReject,` to the `{ … }` param list, near line 44):

```ts
  onOpenProfile,
  onReject,
}: JobDetailProps) {
```

- [ ] **Step 2: Render the action row**

In `JobDetail.tsx`, immediately after the header flex block closes (the `</div>` that ends the logo/title/fit-ring row, around line 273) and **before** the `{/* ── NOT YET REVIEWED branch ── */}` comment, insert a right-aligned action row. It shows the Reject button only for an approved job the operator can act on, and a "rejected · you" badge when the row was manually denied (visible in the Denied view):

```tsx
      {/* ── Operator action row ── */}
      {(job.human_override || (isAuthed && job.verdict === "approve")) && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
            marginTop: "16px",
          }}
        >
          {job.human_override && (
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#a05f5f",
                background: "#f8eded",
                border: "1px solid #ecd6d6",
                borderRadius: "20px",
                padding: "4px 11px",
              }}
            >
              Rejected · you
            </span>
          )}
          {isAuthed && job.verdict === "approve" && (
            <button
              type="button"
              onClick={() => onReject?.(job)}
              style={{
                fontWeight: 700,
                fontSize: "12.5px",
                color: "#a05f5f",
                background: "#fff",
                border: "1px solid #e2c9c9",
                borderRadius: "9px",
                padding: "7px 16px",
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 3: Typecheck and build**

Run (from `dashboard/`):
`npx tsc --noEmit && npm run build`
Expected: PASS — `onReject` is optional and called guarded (`onReject?.(job)`), so the component is self-contained and builds green. Task 6 supplies the real handler.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/JobDetail.tsx
git commit -m "feat(dashboard): detail-pane Reject button + human-override badge"
```

---

### Task 6: Board wiring — optimistic removal, Undo toast, page props

**Files:**
- Modify: `dashboard/app/page.tsx` (import the actions; pass them to `RolefitBoard`)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (props, optimistic state, reject handler, toast, list filter, pass `onReject` to `JobDetail`)

**Interfaces:**
- Consumes: `rejectJob`, `unrejectJob` (Task 4); `JobDetailProps.onReject` (Task 5); `JobRow.verdict` (Task 3).
- Produces: end-to-end reject UX. Final task.

> **Testing note:** gate is `tsc` + `build` + the manual smoke in Step 6. The full Vitest + Python suites must also pass (regression check).

- [ ] **Step 1: Pass the actions in from the page**

In `dashboard/app/page.tsx`, add the import near the other action import (`saveProfileResume`, line 8):

```ts
import { rejectJob, unrejectJob } from "@/app/actions/jobs";
```

And pass them into the `<RolefitBoard … />` element (after `saveResume={saveProfileResume}`, line 50):

```tsx
      saveResume={saveProfileResume}
      rejectJob={rejectJob}
      unrejectJob={unrejectJob}
```

- [ ] **Step 2: Extend `RolefitBoardProps` and destructure**

In `dashboard/components/rolefit/RolefitBoard.tsx`, add to `RolefitBoardProps` (after `saveResume: (fd: FormData) => Promise<void>;`, line 21):

```ts
  rejectJob: (jobId: string) => Promise<void>;
  unrejectJob: (jobId: string, priorVerdict: string | null) => Promise<void>;
```

And destructure them in the component param list (after `saveResume,`, line 31):

```ts
  saveResume,
  rejectJob,
  unrejectJob,
```

- [ ] **Step 3: Add optimistic state, transition, and toast state**

In `RolefitBoard.tsx`, add `useTransition` to the React import (line 3):

```ts
import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
```

Then, with the other UI state (near `const [selectedId, setSelectedId] = useState<string | null>(null);`, line 47), add:

```ts
  // Manual-rejection state: optimistically hidden ids + the pending Undo toast.
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ jobId: string; priorVerdict: string | null } | null>(null);
  const [, startReject] = useTransition();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Extend the existing unmount cleanup effect (lines 61-63) to also clear the toast timer:

```ts
  // Cleanup timers on unmount
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
```

- [ ] **Step 4: Add the reject / undo handlers and filter the visible list**

In `RolefitBoard.tsx`, add the handlers near `handleSelect` (after line 130):

```ts
  const handleReject = useCallback((job: JobRow) => {
    const priorVerdict = job.verdict;
    setRejectedIds((prev) => new Set(prev).add(job.id));
    setSelectedId((prev) => (prev === job.id ? null : prev));
    startReject(() => { void rejectJob(job.id); });
    setToast({ jobId: job.id, priorVerdict });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, [rejectJob]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    const { jobId, priorVerdict } = toast;
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    startReject(() => { void unrejectJob(jobId, priorVerdict); });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [toast, unrejectJob]);
```

Filter the optimistically-rejected ids out of the visible list. Change the `visible` memo (lines 81-84) to drop rejected ids and add `rejectedIds` to its deps:

```ts
  const visible = useMemo(
    () => sortJobs(applyFilters(jobs, filterState), filterState.sort)
      .filter((j) => !rejectedIds.has(j.id)),
    [jobs, filterState, rejectedIds],
  );
```

- [ ] **Step 5: Pass `onReject` to `JobDetail` and render the toast**

In `RolefitBoard.tsx`, pass the handler into `<JobDetail …/>` (in the `selectedJob ? (…)` block, after `onOpenProfile={() => setProfileOpen(true)}`, line 255):

```tsx
              onOpenProfile={() => setProfileOpen(true)}
              onReject={handleReject}
```

Then add the toast as the last child inside the outermost container `<div>`, immediately before the `<ProfileModal …/>` element (line 275):

```tsx
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            background: "#1b2330",
            color: "#fff",
            borderRadius: "12px",
            padding: "11px 18px",
            boxShadow: "0 8px 22px rgba(20,28,40,.22)",
            fontSize: "13.5px",
            fontWeight: 600,
            zIndex: 50,
          }}
        >
          <span>Rejected</span>
          <button
            type="button"
            onClick={handleUndo}
            style={{
              fontWeight: 800,
              fontSize: "13px",
              color: "#9ec1ff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Undo
          </button>
        </div>
      )}
```

- [ ] **Step 6: Typecheck, build, full test suites, and manual smoke**

Run (from `dashboard/`):
`npx tsc --noEmit && npm run build && npm test`
Expected: PASS — `onReject` is now supplied so the Task-5 type error is resolved; build succeeds; all Vitest tests pass.

Run (from repo root): `python3 -m pytest -v`
Expected: PASS — full Python suite green (DB tests require `TEST_DATABASE_URL`).

Manual smoke (against a dev/preview DB with the migration applied, logged in as the operator):
1. On the default board, open an approved job → a **Reject** button shows in the detail header.
2. Click **Reject** → the job disappears from the list, the detail clears, a bottom **"Rejected · Undo"** toast appears.
3. Click **Undo** within 5 s → the job reappears in the list.
4. Reject again, let the toast lapse, refresh the page → the job stays gone (server now serves it as `deny`).
5. Switch the verdict filter to **Denied** → the rejected job shows a **"Rejected · you"** badge and no Reject button.
6. (DB) Confirm `SELECT verdict, human_override FROM job_reviews WHERE job_id = '<id>'` → `deny, true`; after the next poll, `SELECT description FROM jobs WHERE id = '<id>'` → `NULL`.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/page.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(dashboard): wire manual reject with optimistic removal + undo toast"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- Schema `human_override` + migration → **Task 1**.
- Reviewer upsert stickiness → **Task 2**.
- `rejectJob` / `unrejectJob` actions → **Task 4**.
- Surface `human_override` (query + `JobRow`) → **Task 3**.
- Detail-pane Reject button + badge (`isAuthed && verdict==='approve'`) → **Task 5**.
- Board optimistic removal + Undo toast + page props → **Task 6**.
- "Removed from board / purged / never re-reviewed come free from `verdict='deny'`" → relies on existing `jobsQuery` default `r.verdict='approve'`, `prune.py` Rule A, `select_candidates` — unchanged by design; the manual smoke (Task 6 Step 6, items 4 & 6) verifies removal + purge end to end.
- Testing split (pytest DB + Vitest query; actions/components via build + smoke) → encoded in Global Constraints and each task's testing note.
- Rollout ordering (migration before/with deploy) → spec's rollout section; the migration artifact is Task 1.

**Placeholder scan:** no TBD/TODO; every code and test step contains complete content.

**Type consistency:** `rejectJob(jobId: string)` and `unrejectJob(jobId: string, priorVerdict: string | null)` are defined identically in Tasks 4 and 6; `JobRow.human_override: boolean` (Task 3) is read in Tasks 5 & 6; `onReject?: (job: JobRow) => void` is declared optional in Task 5 (so Task 5 builds green) and supplied in Task 6. Every task ends with a passing gate — no task is left red for a later one to fix.
