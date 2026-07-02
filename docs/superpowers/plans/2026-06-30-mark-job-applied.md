# Mark Job Applied Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mark as applied" button next to Reject on the Rolefit board that records a submitted application in the DB, hides the job from the default board, exposes it under an "Applied" filter, and counts it in the analytics funnel.

**Architecture:** Reuse the existing `application_packages` table (`status`, `applied_at`) as the single source of truth. The mark action becomes an idempotent upsert so it works with or without a prepared package. Applied state is already loaded into the board's `packages` client state, so hiding/showing applied jobs is done client-side (mirroring the existing `rejectedIds` hide) — no changes to `buildJobsQuery`, `VERDICT_OPTIONS`, or `parseFilters`. Analytics adds one funnel count.

**Tech Stack:** Next.js (App Router, server actions), React (client components with inline styles), postgres.js (`sql` tagged template), Vitest.

## Global Constraints

- **Single source of truth:** applied state lives ONLY in `application_packages.status = 'applied'` (+ `applied_at`). The buried Prepare-panel button and the new action-row button both write it. Do NOT add an `applied` column to `job_reviews` or a new table.
- **No new migration.** This feature only reads/writes `application_packages`, which already exists (`migrations/2026-06-30-application-packages.sql`). That migration MUST be applied to the live Supabase DB before deploy (verify in Task 7).
- **No SQL/query-layer changes for filtering.** The board loads approve-only jobs and filters client-side; applied hide/show is client-side off `packages`. Do NOT touch `dashboard/lib/jobsQuery.ts`, `dashboard/lib/filters.ts`, or `dashboard/lib/config.ts` (`VERDICT_OPTIONS`).
- **Applied badge palette (reuse verbatim from `ApplicationPanel.tsx`):** text `#2f7d54`, background `#e3f1e9`, border `#cfe6d8`.
- **`job_reviews.verdict` is never touched** by these actions. Applied and rejected stay independent; the UI keeps them mutually exclusive (Reject and Mark-as-applied both render only when `!applied`).
- **Verification commands:** typecheck with `npx tsc --noEmit` (run from `dashboard/`); unit tests with `npm test`; full build with `npm run build`.
- **Test-harness reality:** Vitest runs `lib/**/*.test.ts` in a node env with a dummy `DATABASE_URL` — there is NO DB-backed or React-component test harness, and `app/actions/*` and `lib/metrics.ts` have no existing tests. Only pure functions in `lib/` are unit-testable. Server actions, metrics, and UI are verified by typecheck + build + the manual smoke in Task 7, matching how `rejectJob`/`getFunnel` are already verified in this repo.

---

## File Structure

- `dashboard/lib/rolefit/filter.ts` — add pure `filterByApplied` helper (the one unit-tested unit). Test: `dashboard/lib/rolefit/filter.test.ts`.
- `dashboard/app/actions/applications.ts` — `markApplicationApplied` becomes an upsert; add `unmarkApplicationApplied`.
- `dashboard/lib/metrics.ts` — `JobFunnel` gains `applied`; `getFunnel` counts applied packages.
- `dashboard/components/analytics/FunnelSection.tsx` — add the "Applied" funnel stage.
- `dashboard/components/rolefit/JobDetail.tsx` — action-row "Mark as applied" button + "Applied · you" badge + un-apply affordance.
- `dashboard/components/rolefit/FilterBar.tsx` — "Applied" view toggle.
- `dashboard/components/rolefit/RolefitBoard.tsx` + `dashboard/app/page.tsx` — integration (state, handlers, wiring the new action).

---

## Task 1: Pure `filterByApplied` helper (TDD)

The board hides applied jobs by default and shows only them in the Applied view. Extract this partition into a pure, testable helper. `RolefitBoard` (Task 6) consumes it.

**Files:**
- Modify: `dashboard/lib/rolefit/filter.ts`
- Test: `dashboard/lib/rolefit/filter.test.ts`

**Interfaces:**
- Produces: `filterByApplied(jobs: JobRow[], applied: ReadonlySet<string>, appliedView: boolean): JobRow[]` — when `appliedView` is false, returns jobs NOT in `applied`; when true, returns only jobs in `applied`.

- [ ] **Step 1: Write the failing test**

Add to the end of `dashboard/lib/rolefit/filter.test.ts` (the file already defines a `job()` factory). Also add `filterByApplied` to the existing import on line 2:

```ts
import { applyFilters, facetCounts, filterByApplied, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
```

```ts
describe("filterByApplied", () => {
  const jobs = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" })];

  test("default view hides applied jobs", () => {
    const out = filterByApplied(jobs, new Set(["b"]), false);
    expect(out.map((j) => j.id)).toEqual(["a", "c"]);
  });

  test("applied view shows only applied jobs", () => {
    const out = filterByApplied(jobs, new Set(["b"]), true);
    expect(out.map((j) => j.id)).toEqual(["b"]);
  });

  test("empty set: default shows all, applied view shows none", () => {
    expect(filterByApplied(jobs, new Set(), false).map((j) => j.id)).toEqual(["a", "b", "c"]);
    expect(filterByApplied(jobs, new Set(), true)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npm test -- filter.test.ts`
Expected: FAIL — `filterByApplied is not a function` (or an import/type error).

- [ ] **Step 3: Write minimal implementation**

Append to `dashboard/lib/rolefit/filter.ts`:

```ts
// Partition the board by application status. `applied` holds the ids of jobs the
// viewer has marked applied. The default board hides them (like a reject); the
// Applied view shows only them. Applied state lives in the loaded packages (client
// side), mirroring the rejectedIds hide in RolefitBoard — not the SQL query.
export function filterByApplied(
  jobs: JobRow[],
  applied: ReadonlySet<string>,
  appliedView: boolean,
): JobRow[] {
  return jobs.filter((j) => (appliedView ? applied.has(j.id) : !applied.has(j.id)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npm test -- filter.test.ts`
Expected: PASS (all three new tests + the existing ones).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/filter.ts dashboard/lib/rolefit/filter.test.ts
git commit -m "feat(board): add filterByApplied partition helper"
```

---

## Task 2: Upsert + un-mark server actions

Make marking applied work even when no package was prepared, and add the un-mark (undo) counterpart.

**Files:**
- Modify: `dashboard/app/actions/applications.ts:10-22`

**Interfaces:**
- Produces: `markApplicationApplied(jobId: string): Promise<void>` (now an upsert; signature unchanged, so `page.tsx` needs no import change).
- Produces: `unmarkApplicationApplied(jobId: string): Promise<void>` — reverts applied; deletes a content-less marker row, or reverts a real package to `status='prepared'`.

- [ ] **Step 1: Replace `markApplicationApplied` and add `unmarkApplicationApplied`**

In `dashboard/app/actions/applications.ts`, replace the current `markApplicationApplied` (the block from its leading comment on line 10 through its closing `}` on line 22) with:

```ts
// Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
// user never prepared a package (a content-less marker row); the Prepare-panel
// button hits the same path (its row already exists, so ON CONFLICT updates it).
// Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
export async function markApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO application_packages (user_id, job_id, status, applied_at)
    VALUES (${userId}::uuid, ${jobId}, 'applied', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      status     = 'applied',
      applied_at = COALESCE(application_packages.applied_at, now())
  `;
  revalidatePath("/");
}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
export async function unmarkApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    DELETE FROM application_packages
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
       AND resume_json IS NULL AND cover_letter_json IS NULL
       AND greenhouse_questions IS NULL AND prefilled_answers IS NULL
       AND answers_snapshot IS NULL
  `;
  await sql`
    UPDATE application_packages
       SET status = 'prepared', applied_at = NULL
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
  `;
  revalidatePath("/");
}
```

(The existing `import` of `sql`, `requireUserId`, and `revalidatePath` at the top of the file already covers both functions — no import changes.)

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (No unit test: server actions execute `sql` directly and the Vitest harness has no DB — verified by typecheck here and manual smoke in Task 7, as with the existing `rejectJob` action.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/actions/applications.ts
git commit -m "feat(applications): upsert markApplicationApplied + add unmark action"
```

---

## Task 3: Analytics funnel "Applied" stage

Add an Applied count to the job funnel.

**Files:**
- Modify: `dashboard/lib/metrics.ts:100-104` (interface) and `dashboard/lib/metrics.ts:125-154` (query + return)
- Modify: `dashboard/components/analytics/FunnelSection.tsx:46-56`

**Interfaces:**
- Consumes: `application_packages` rows with `status='applied'`.
- Produces: `JobFunnel.applied: number` (cumulative count of the user's applied packages).

- [ ] **Step 1: Add `applied` to the `JobFunnel` interface**

In `dashboard/lib/metrics.ts`, replace the `JobFunnel` interface (lines 100-104) with:

```ts
export interface JobFunnel {
  ever_seen: number; open: number; closed: number; reviewed: number;
  gate_rejected: number; approved: number; applied: number; denied: number;
  manual_rejected: number; unreviewed: number; errors: number;
}
```

- [ ] **Step 2: Query the applied count and include it in the return**

In `getFunnel`, add a query immediately after the `reviewAggRows` query (after its closing `` ` `` on line 134), keeping the sequential style (each `await sql` runs one at a time to avoid pool exhaustion):

```ts
  const appliedAggRows = await sql`
      SELECT count(*)::int AS applied
      FROM application_packages
      WHERE user_id = ${userId}::uuid AND status = 'applied'
    `;
```

Then, alongside the existing `const rv = ...` extraction (line 140), add:

```ts
  const ap = appliedAggRows[0] as unknown as { applied: number };
```

And replace the `jobs:` object in the return (lines 148-153) with:

```ts
    jobs: {
      ever_seen: j.ever_seen, open: j.open, closed: j.closed,
      reviewed: rv.reviewed, gate_rejected: rv.gate_rejected,
      approved: rv.approved, applied: ap.applied, denied: rv.denied,
      manual_rejected: rv.manual_rejected,
      unreviewed: stats.unreviewed, errors: stats.errors,
    },
```

- [ ] **Step 3: Render the Applied stage in the funnel**

In `dashboard/components/analytics/FunnelSection.tsx`, insert the Applied stage right after the "Approved" entry in `jobStages` (line 51):

```ts
    { label: "Approved", value: j.approved },
    { label: "Applied", value: j.applied },
    { label: "Denied", value: j.denied, tone: "bad" },
```

(Default tone "ok" = blue, reading as a positive substage of Approved.)

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (No metrics unit test exists in the harness; the count plumbs through the typed `JobFunnel`, and the value is verified in the Task 7 smoke.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/metrics.ts dashboard/components/analytics/FunnelSection.tsx
git commit -m "feat(analytics): add Applied stage to the job funnel"
```

---

## Task 4: JobDetail action-row button + Applied badge

Add the "Mark as applied" button next to Reject, the "Applied · you" badge, and an un-apply affordance. `JobDetail` already receives `pkg` and `onMarkApplied`; add one optional prop for un-apply.

**Files:**
- Modify: `dashboard/components/rolefit/JobDetail.tsx:54-98` (props), `:99` (derive `applied`), `:340-386` (action row)

**Interfaces:**
- Consumes (existing props): `pkg?: ApplicationPackage`, `onMarkApplied: (job: JobRow) => void`, `onReject?: (job: JobRow) => void`, `isAuthed`, `applyUrl`.
- Produces: new optional prop `onUnapply?: (job: JobRow) => void` (RolefitBoard passes it in Task 6).

- [ ] **Step 1: Add the `onUnapply` prop**

In `JobDetailProps` (interface), add after `onReject?: (job: JobRow) => void;` (line 75):

```ts
  onUnapply?: (job: JobRow) => void;
```

In the destructured parameter list, add after `onReject,` (line 97):

```ts
  onUnapply,
```

- [ ] **Step 2: Derive `applied`**

After `const hasReview = job.fit_score != null;` (line 99), add:

```ts
  const applied = pkg?.status === "applied";
```

- [ ] **Step 3: Rewrite the action row**

Replace the entire action-row block (lines 340-386, from the `{/* ── Action row ... ── */}` comment through the closing `)}`) with:

```tsx
      {/* ── Action row — Apply + operator controls (reviewed jobs only) ── */}
      {hasReview && (job.human_override || applied || (isAuthed && job.verdict === "approve") || applyUrl) && (
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
          {applied && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#2f7d54",
                background: "#e3f1e9",
                border: "1px solid #cfe6d8",
                borderRadius: "20px",
                padding: "4px 11px",
              }}
            >
              ✓ Applied · you
              {onUnapply && (
                <button
                  type="button"
                  onClick={() => onUnapply(job)}
                  style={{
                    fontWeight: 800,
                    fontSize: "11px",
                    color: "#2f7d54",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Undo
                </button>
              )}
            </span>
          )}
          {isAuthed && job.verdict === "approve" && !applied && (
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
          {isAuthed && job.verdict === "approve" && !applied && (
            <button
              type="button"
              onClick={() => onMarkApplied(job)}
              style={{
                fontWeight: 700,
                fontSize: "12.5px",
                color: "#2f7d54",
                background: "#fff",
                border: "1px solid #cfe6d8",
                borderRadius: "9px",
                padding: "7px 16px",
                cursor: "pointer",
              }}
            >
              Mark as applied
            </button>
          )}
          {applyUrl && <ApplyButton url={applyUrl} />}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (`onUnapply` is optional, so `RolefitBoard` not yet passing it stays green.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/JobDetail.tsx
git commit -m "feat(board): mark-as-applied button + applied badge in detail action row"
```

---

## Task 5: FilterBar "Applied" toggle

Add a toggle that switches the board between the default (active) view and the Applied view.

**Files:**
- Modify: `dashboard/components/rolefit/FilterBar.tsx:44-71` (props), `:433-435` (render)

**Interfaces:**
- Produces: optional props `appliedView?: boolean`, `appliedCount?: number`, `onToggleApplied?: () => void` (RolefitBoard passes them in Task 6).

- [ ] **Step 1: Add the props**

In `FilterBarProps`, add after `visibleCount: number;` (line 62):

```ts
  appliedView?: boolean;
  appliedCount?: number;
  onToggleApplied?: () => void;
```

In the destructured parameter list, add after `visibleCount,` (line 63):

```ts
  appliedView,
  appliedCount,
  onToggleApplied,
```

- [ ] **Step 2: Render the toggle**

Immediately after the "Remote segmented toggle" block's closing `</div>` (line 433) and before `<div style={{ flex: 1 }} />` (line 435), insert:

```tsx
      {/* Applied view toggle — switches the list to jobs marked applied */}
      {onToggleApplied && (
        <button
          onClick={onToggleApplied}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: appliedView ? "#2f7d54" : "#39424f",
            background: appliedView ? "#e3f1e9" : "#ffffff",
            border: `1px solid ${appliedView ? "#cfe6d8" : "#dfe3ea"}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Applied{appliedCount ? ` · ${appliedCount}` : ""}
        </button>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (New props optional; not-yet-wired parent stays green.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/rolefit/FilterBar.tsx
git commit -m "feat(board): add Applied view toggle to FilterBar"
```

---

## Task 6: Wire up RolefitBoard + page.tsx

Integrate everything: pass the un-mark action, generalize the Undo toast, make marking applied work without a package + optimistically hide it, add the Applied view state, and pass props to `FilterBar`/`JobDetail`.

**Files:**
- Modify: `dashboard/app/page.tsx:13-15,80` (import + pass `unmarkApplicationApplied`)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (props, imports, state, handlers, wiring)

**Interfaces:**
- Consumes: `filterByApplied` (Task 1), `markApplicationApplied` + `unmarkApplicationApplied` (Task 2), `JobDetail.onUnapply` (Task 4), `FilterBar.appliedView/appliedCount/onToggleApplied` (Task 5).

- [ ] **Step 1: page.tsx — import and pass the un-mark action**

In `dashboard/app/page.tsx`, update the applications import (lines 13-15) to include `unmarkApplicationApplied`:

```ts
import {
  markApplicationApplied, unmarkApplicationApplied,
  persistRegeneratedResume, persistRegeneratedCover,
} from "@/app/actions/applications";
```

And pass it as a prop after `markApplied={markApplicationApplied}` (line 80):

```tsx
      markApplied={markApplicationApplied}
      unmarkApplied={unmarkApplicationApplied}
```

- [ ] **Step 2: RolefitBoard — prop + import**

In `dashboard/components/rolefit/RolefitBoard.tsx`:

Add to `RolefitBoardProps` after `markApplied: (jobId: string) => Promise<void>;` (line 25):

```ts
  unmarkApplied: (jobId: string) => Promise<void>;
```

Add to the destructured params after `markApplied,` (line 48):

```ts
  unmarkApplied,
```

Update the filter import (line 8) to include `filterByApplied`:

```ts
import { applyFilters, filterByApplied, sortJobs } from "@/lib/rolefit/filter";
```

- [ ] **Step 3: RolefitBoard — Applied view state + generalized toast type**

Add after `const [profileOpen, setProfileOpen] = useState(false);` (line 69):

```ts
  const [appliedView, setAppliedView] = useState(false);
```

Replace the `toast` state declaration (line 73) with a discriminated union:

```ts
  const [toast, setToast] = useState<
    | { kind: "reject"; jobId: string; priorVerdict: string | null }
    | { kind: "apply"; jobId: string; prior: ApplicationPackage | undefined }
    | null
  >(null);
```

- [ ] **Step 4: RolefitBoard — applied set + visible partition**

Add just before the `visible` memo (line 171):

```ts
  const appliedSet = useMemo(
    () => new Set(jobs.filter((j) => packages[j.id]?.status === "applied").map((j) => j.id)),
    [jobs, packages],
  );
```

Replace the `visible` memo (lines 171-175) with:

```ts
  const visible = useMemo(
    () => filterByApplied(
      sortJobs(applyFilters(jobs, filterState), filterState.sort)
        .filter((j) => !rejectedIds.has(j.id)),
      appliedSet,
      appliedView,
    ),
    [jobs, filterState, rejectedIds, appliedSet, appliedView],
  );
```

- [ ] **Step 5: RolefitBoard — reject toast tag + generalized undo**

In `handleReject`, change the `setToast(...)` call (line 251) to tag the kind:

```ts
    setToast({ kind: "reject", jobId: job.id, priorVerdict });
```

Replace `handleUndo` (lines 256-267) with a kind-dispatching version:

```ts
  const handleUndo = useCallback(() => {
    if (!toast) return;
    if (toast.kind === "reject") {
      const { jobId, priorVerdict } = toast;
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      startReject(() => { void unrejectJob(jobId, priorVerdict); });
    } else {
      const { jobId, prior } = toast;
      setPackages((p) => {
        const next = { ...p };
        if (prior) next[jobId] = prior;
        else delete next[jobId];
        return next;
      });
      startApply(() => { void unmarkApplied(jobId); });
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [toast, unrejectJob, unmarkApplied]);
```

- [ ] **Step 6: RolefitBoard — rewrite `handleMarkApplied` + add `handleUnapply`**

Replace `handleMarkApplied` (lines 381-402, including its leading comment) with:

```ts
  // "Mark as applied" — works with OR without a prepared package. Optimistically
  // flips/creates the package to status='applied' (hiding the job from the default
  // board via appliedSet), shows an Undo toast (mirrors reject), and persists via the
  // upsert action. On failure, roll the optimistic change back and surface an error.
  const handleMarkApplied = useCallback((job: JobRow) => {
    const prior = packages[job.id];
    const appliedAt = new Date().toISOString();
    const optimistic: ApplicationPackage = prior
      ? { ...prior, status: "applied", appliedAt: prior.appliedAt ?? appliedAt }
      : {
          jobId: job.id,
          status: "applied",
          resume: null,
          coverLetter: null,
          answersSnapshot: null,
          greenhouseQuestions: null,
          prefilledAnswers: null,
          applyUrl: null,
          preparedAt: appliedAt,
          appliedAt,
        };
    setPackages((p) => ({ ...p, [job.id]: optimistic }));
    setSelectedId((prev) => (prev === job.id ? null : prev));
    startApply(() => {
      void markApplied(job.id).catch(() => {
        setPackages((p) => {
          const next = { ...p };
          if (prior) next[job.id] = prior;
          else delete next[job.id];
          return next;
        });
        showActionError("Couldn’t mark as applied. Please try again.");
      });
    });
    setToast({ kind: "apply", jobId: job.id, prior });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, [packages, markApplied, showActionError]);

  // Un-mark applied from the Applied view (no toast — immediate). Deletes a bare
  // marker; reverts a real prepared package to status='prepared'. Rolls back on error.
  const handleUnapply = useCallback((job: JobRow) => {
    const prior = packages[job.id];
    const hasContent = Boolean(
      prior && (prior.resume || prior.coverLetter || prior.answersSnapshot
        || prior.greenhouseQuestions || prior.prefilledAnswers),
    );
    setPackages((p) => {
      const next = { ...p };
      if (prior && hasContent) next[job.id] = { ...prior, status: "prepared", appliedAt: null };
      else delete next[job.id];
      return next;
    });
    startApply(() => {
      void unmarkApplied(job.id).catch(() => {
        if (prior) setPackages((p) => ({ ...p, [job.id]: prior }));
        showActionError("Couldn’t undo. Please try again.");
      });
    });
  }, [packages, unmarkApplied, showActionError]);
```

- [ ] **Step 7: RolefitBoard — pass props to FilterBar and JobDetail, fix toast label**

In the `<FilterBar ... />` element, add after `visibleCount={visible.length}` (line 457):

```tsx
        appliedView={appliedView}
        appliedCount={appliedSet.size}
        onToggleApplied={() => setAppliedView((v) => !v)}
```

In the `<JobDetail ... />` element, add after `onReject={handleReject}` (line 515):

```tsx
              onUnapply={handleUnapply}
```

In the toast render, replace the hardcoded label `<span>Rejected</span>` (line 555) with:

```tsx
          <span>{toast.kind === "apply" ? "Applied" : "Rejected"}</span>
```

- [ ] **Step 8: Typecheck and build**

Run: `cd dashboard && npx tsc --noEmit && npm run build`
Expected: typecheck clean; `next build` succeeds.

- [ ] **Step 9: Run the full unit-test suite**

Run: `cd dashboard && npm test`
Expected: PASS (the `filterByApplied` tests plus all pre-existing tests; nothing regressed).

- [ ] **Step 10: Commit**

```bash
git add dashboard/app/page.tsx dashboard/components/rolefit/RolefitBoard.tsx
git commit -m "feat(board): wire mark-applied — hide, undo toast, Applied view, un-apply"
```

---

## Task 7: Prerequisite check + manual smoke

No code — verify the DB prerequisite and exercise the feature end-to-end against a dev/preview DB.

- [ ] **Step 1: Confirm the `application_packages` migration is live**

The feature reads/writes `application_packages`. Confirm `migrations/2026-06-30-application-packages.sql` has been applied to the Supabase DB the dashboard connects to (e.g. check the table exists). If not, apply it BEFORE deploying — otherwise `getApplicationPackages` / the actions error.

- [ ] **Step 2: Smoke — one-click applied (no prepare)**

Sign in as the operator, open an approved job you have NOT prepared, click **Mark as applied** in the action row. Expected: the job leaves the default list, an "Applied · Undo" toast appears. Click **Undo** within 5s → the job returns.

- [ ] **Step 3: Smoke — persistence + Applied view + un-apply**

Mark a job applied again, let the toast expire, reload. Expected: it stays hidden from the default board. Toggle the **Applied** filter → the job appears with a "✓ Applied · you" badge. Click the badge's **Undo** → it disappears from the Applied view; reload and confirm it's back on the default board (its content-less marker row was deleted).

- [ ] **Step 4: Smoke — Prepare path still works + analytics**

Prepare a package for a different job, click **Mark as applied** inside the Application panel. Expected: it hides + toast, and (reloading and toggling Applied) still shows it — and un-applying it reverts to a still-prepared package (not deleted). Open `/analytics` → the **Applied** stage in the Jobs funnel reflects the applied count.

---

## Self-Review

**Spec coverage** (`docs/superpowers/specs/2026-06-30-mark-job-applied-design.md`):
- Button next to Reject, works without Prepare → Task 4 (button) + Task 2 (upsert) + Task 6 (handler no longer early-returns).
- Reuse `application_packages`, single source of truth, no migration → Task 2; both entry points call `markApplicationApplied`.
- Hide from default board + Applied filter → Task 1 (`filterByApplied`), Task 5 (toggle), Task 6 (wiring). *Refinement vs. spec §4:* implemented client-side off `packages`, NOT via `jobsQuery`/`VERDICT_OPTIONS`, because the board is approve-only + client-filtered and already loads all packages. Same user-facing behavior.
- Applied counted in analytics funnel → Task 3.
- Undo toast mirroring Reject + un-mark from Applied view → Task 6 (`handleUndo` apply branch, `handleMarkApplied` toast, `handleUnapply`) + Task 4 (badge Undo).
- Marker-row deletion on un-mark; real packages reverted to `prepared` → Task 2 (`unmarkApplicationApplied`), Task 6 (`handleUnapply` mirrors it client-side).
- Prerequisite: migration live → Task 7.

**Placeholder scan:** none — every code step shows complete code.

**Type consistency:** `filterByApplied(jobs, ReadonlySet<string>, boolean)` defined in Task 1, consumed identically in Task 6. `markApplicationApplied`/`unmarkApplicationApplied` signatures match between Task 2, `page.tsx` (Task 6 Step 1), and `RolefitBoardProps` (Task 6 Step 2). `ApplicationPackage` shape used in the optimistic object (Task 6 Step 6) matches `dashboard/lib/types.ts` (all fields present). `JobFunnel.applied` added in Task 3 Step 1 is populated in Step 2 and read in `FunnelSection` Step 3.
