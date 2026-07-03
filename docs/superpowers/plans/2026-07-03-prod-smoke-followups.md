# Prod Smoke-Test Fast-Follow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a small, surgical, frontend-only round of fixes for six issues found in a live production UX smoke test of the Rolefit dashboard (analytics weekly chart, companies search, profile save-bar + model picker + résumé upload, board filter reflow, board "Unknown" pill).

**Architecture:** Each finding is an independent, reviewable task. Two HIGH correctness fixes first (analytics weekly, companies search), then MEDIUM polish (profile), then LOW cosmetics (board). All changes are client/server-component + pure-lib edits in `dashboard/`. No DB schema changes.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, recharts, postgres.js, vitest. Design system is **inline styles** via `dashboard/components/ui/*` primitives (`Button`, `Panel`, `Chip`). Tailwind is fully removed.

## Global Constraints

Copied verbatim from the task spec — every task implicitly includes these:

- **Inline styles only.** Do NOT introduce Tailwind classes. Match the existing "Rolefit" inline-style idiom (see `dashboard/components/rolefit/*`, `dashboard/app/profile/page.tsx`). Use `components/ui/{Button,Panel,Chip}` where a primitive exists (`Button variant primary|secondary|ghost size sm|md`).
- **Never `as`-cast a jsonb column.** jsonb reads go through a total parser returning a valid typed value or `null` (see `dashboard/CLAUDE.md`). Do not add new `as`-casts on jsonb.
- **Frontend-only. NO DB migrations.** If any task appears to need a migration, STOP and flag it — the current plan is designed so none is required.
- **Keep `tsc` clean and all existing vitest green.** Add tests for logic changes (required for Task 1).
- **Ships straight to production after implementation.** Bias toward low-risk, surgical changes.
- Verify commands run from `dashboard/`: `npm run test` (vitest), `npx tsc --noEmit` (typecheck), `npm run lint`.

---

## ⚠️ CRITICAL PRE-WORK: branch is behind prod (Task 0)

This worktree branch (`worktree-vivid-wishing-teapot`) is at commit `4516b5f`, which is **2 commits behind `origin/main`** (`30d73b5`). The gap matters because `origin/main` commit `30d73b5` is a **toolchain upgrade** and production runs the upgraded stack:

| Package     | This worktree (`4516b5f`) | `origin/main` = **prod** (`30d73b5`) |
|-------------|---------------------------|--------------------------------------|
| next        | 15.5.19                   | **16.2.10**                          |
| react       | 19.0.0                    | **19.2.7**                           |
| recharts    | ^2.15.4 (installed 2.15.4)| **^3.9.1**                           |
| typescript  | ^5                        | **^6.0.3**                           |
| vitest      | ^2.1.8                    | **^4.1.9**                           |

Finding 1 (analytics weekly) is almost certainly a **recharts 3 rendering regression** (see Task 1 evidence) that will NOT reproduce on this worktree's recharts 2. Building any of these fixes on the stale stack risks (a) not reproducing the bug, (b) `tsc`/vitest behaving differently under TS 6 / vitest 4, and (c) merge friction. **Do Task 0 first.**

### Task 0: Rebase the fix branch onto `origin/main`

**Files:** none (git + install only)

- [ ] **Step 1:** From the worktree root, fetch and rebase onto prod HEAD.

```bash
git fetch origin
git rebase origin/main   # brings in Next 16 / recharts 3 / TS 6 / vitest 4
```

- [ ] **Step 2:** Reinstall so `node_modules` matches the upgraded lockfile.

```bash
cd dashboard && npm install
```

- [ ] **Step 3:** Establish a green baseline on the real stack BEFORE any change.

```bash
cd dashboard && npx tsc --noEmit && npm run test
```
Expected: typecheck clean, all vitest suites pass. If anything is red here, it is pre-existing on `origin/main` — note it, do not fix it as part of these findings.

- [ ] **Step 4:** Commit nothing (rebase already advanced the branch). Proceed to Task 1.

---

### Task 1: HIGH — Analytics weekly chart renders the spike in the wrong week / empty

**Finding:** Daily+30d shows the ~115k "New jobs" spike ~6/26 (correct). Weekly+90d renders it ~a month early (reported "week of 5/25"); Weekly+30d renders the VOLUME charts completely empty.

**Files:**
- Investigate: `dashboard/lib/trend.ts` (`weekStart`, `fillDays`, `toWeekly`, `sliceWindow`), `dashboard/components/analytics/TrendCharts.tsx`, `dashboard/components/analytics/Chart.tsx` (`BarsCard`/`LinesCard` XAxis).
- Test (new/extend): `dashboard/lib/trend.test.ts`
- Likely fix: `dashboard/components/analytics/Chart.tsx` (recharts XAxis config) — confirm by reproduction (Step 4).

**‼️ Evidence gathered during planning — READ BEFORE CODING. The binning math in `lib/trend.ts` is CORRECT; do not rewrite it.**

The real production series was pulled (project `fdhspmavadgucktetzoi`, table `poll_runs`, last 90 days). The only history is 2026-06-24 → 2026-07-03, with the spike **114,505 new jobs on 2026-06-27 (Saturday)**. Running the actual `fillDays → toWeekly → sliceWindow` pipeline on this exact series (nowIso 2026-07-02 and 2026-07-03) produces:

- `weekStart("2026-06-27")` → `"2026-06-22"` (correct ISO-week Monday).
- Weekly buckets: `2026-06-22 : 114921` and `2026-06-29 : 9636` (all earlier weeks zero).
- **weekly+90d** keeps them; **weekly+30d keeps them too and is NOT empty**.
- Weekly total == daily total == **124557** (mass conserved).

So neither symptom is reproducible from the pure functions on the real data. What differs: **prod runs recharts 3; this worktree ran recharts 2.** After Task 0 the branch is on recharts 3. The defect is in the **chart/axis rendering layer**, most plausibly a recharts-3 category-XAxis regression: with a mostly-empty 13-bucket weekly axis, recharts auto-thins ticks so the tall spike bar sits under an earlier week's label (reads "a month early"), and/or the axis mis-scales so bars don't paint (reads "empty"). Confirm empirically in Step 4 — do not guess-patch `trend.ts`.

**Interfaces:**
- Consumes: `fillDays<T>(rows, days, nowISO, numericKeys) : T[]`, `toWeekly<T>(rows, sumKeys, lastKeys) : T[]`, `sliceWindow<T>(rows, days, nowISO) : T[]`, `weekStart(dayISO) : string` — all already exported from `@/lib/trend`.
- Produces: no new exports required; possibly new recharts XAxis props on `BarsCard`/`LinesCard`.

- [ ] **Step 1: Write regression tests that lock the (correct) binning.** Append to `dashboard/lib/trend.test.ts`:

```ts
describe("weekly binning conserves daily totals and places spikes correctly (real prod shape)", () => {
  // Reproduces the smoke-test production series: sparse history, one huge Saturday spike.
  const series: Point[] = [
    { day: "2026-06-24", new_jobs: 272 },
    { day: "2026-06-25", new_jobs: 2 },
    { day: "2026-06-26", new_jobs: 10 },
    { day: "2026-06-27", new_jobs: 114505 }, // Saturday spike
    { day: "2026-06-28", new_jobs: 132 },
    { day: "2026-06-29", new_jobs: 1765 },
    { day: "2026-06-30", new_jobs: 442 },
    { day: "2026-07-01", new_jobs: 2524 },
    { day: "2026-07-02", new_jobs: 2526 },
    { day: "2026-07-03", new_jobs: 2379 },
  ];
  const nowIso = "2026-07-03T09:00:00Z";
  const sum = (rows: Point[]) => rows.reduce((s, r) => s + (r.new_jobs as number), 0);

  test("the 2026-06-27 spike belongs to the ISO week starting 2026-06-22", () => {
    expect(weekStart("2026-06-27")).toBe("2026-06-22");
  });

  test("weekly totals equal daily totals over the same 90-day fill window", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    expect(sum(weekly)).toBe(sum(daily));
    expect(sum(weekly)).toBe(124557);
  });

  test("weekly + 30-day window is NOT empty and carries the spike in week 2026-06-22", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    const win30 = sliceWindow(weekly, 30, nowIso);
    expect(win30.find((w) => w.day === "2026-06-22")?.new_jobs).toBe(114921);
    expect(sum(win30)).toBe(124557);
  });

  test("weekly + 90-day window places the spike in 2026-06-22 (not weeks earlier)", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    const win90 = sliceWindow(weekly, 90, nowIso);
    const nonZero = win90.filter((w) => (w.new_jobs as number) > 0).map((w) => w.day);
    expect(nonZero).toEqual(["2026-06-22", "2026-06-29"]);
  });
});
```

(`weekStart`, `fillDays`, `toWeekly`, `sliceWindow`, `Point` are already imported at the top of the file.)

- [ ] **Step 2: Run the new tests.**

Run: `cd dashboard && npm run test -- trend`
Expected: **PASS** (they codify the already-correct behavior and guard against a future regression). If any FAIL, the binning genuinely broke under the rebase — stop and debug `trend.ts` before touching the chart.

- [ ] **Step 3: Commit the regression tests.**

```bash
git add dashboard/lib/trend.test.ts
git commit -m "test(analytics): lock weekly-binning totals + spike placement (prod smoke)"
```

- [ ] **Step 4: Reproduce the RENDER against recharts 3 (systematic debugging — do this before writing a fix).** Use superpowers:systematic-debugging. Render `TrendCharts` with the `series` from Step 1 (a throwaway story/route or a vitest + `@testing-library/react` render of `TrendCharts`) on the rebased (recharts 3) stack, toggle Weekly + 90d and Weekly + 30d, and observe: (a) does the spike bar sit under the `6/22` tick or an earlier one? (b) are the volume bars painted at all? Record the exact wrong behavior. If you have prod auth, alternatively confirm on the live `/analytics` page.

- [ ] **Step 5: Apply the minimal chart-layer fix indicated by Step 4.** Leading candidate (recharts-3 category-axis mislabel): make the weekly x-axis label every bucket so a tall bar can't be mislabeled by a thinned axis. In `dashboard/components/analytics/Chart.tsx`, on the `<XAxis>` inside `BarsCard` (and `LinesCard`), add explicit category typing + full ticks:

```tsx
<XAxis
  dataKey={xKey}
  type="category"
  interval={0}
  tick={AXIS}
  tickLine={false}
  axisLine={{ stroke: "#e7eaf0" }}
  tickFormatter={formatDateTick}
/>
```

If Step 4 instead shows bars not painting (axis mis-scale), fix per the observed recharts-3 cause (e.g. explicit `YAxis`/`XAxis` `type`, `scale`, or `allowDataOverflow`) rather than assuming. Keep the change confined to the chart component; do NOT alter `trend.ts` math. If Step 4 shows the current render is actually correct (i.e. the smoke test predated the recharts-3 deploy or was a misread), stop here: the regression tests are the deliverable — document the finding as "not reproducible; locked by tests" and skip Steps 6-7.

- [ ] **Step 6: Verify.** Re-render as in Step 4: the ~115k spike must appear under the `6/22` tick in both Weekly+90d and Weekly+30d, and Weekly+30d volume charts must show bars. Run `cd dashboard && npx tsc --noEmit && npm run test`.

- [ ] **Step 7: Commit.**

```bash
git add dashboard/components/analytics/Chart.tsx
git commit -m "fix(analytics): label every weekly bucket so the spike renders in the right week (recharts 3)"
```

---

### Task 2: HIGH — Companies page name filter only searches the first 200 of thousands of rows

**Finding:** `/companies` loads only 200 rows; the name filter is client-side over those 200, so real companies ("vanta", "zapier") return "No companies match your filter."

**Root cause + scope evidence (verified against prod DB):** `getCompanyReviews(userId, bucket, limit = 200)` (`dashboard/lib/queries.ts:523`) is called with no limit override and `ORDER BY c.name LIMIT 200`. `CompanyList` (`dashboard/components/companies/CompanyList.tsx:25`) filters those ≤200 rows in the browser. Real bucket sizes: **include 6,382**, **unknown 8,002**, **exclude 1,478**. "vanta"/"zapier" (v/z) sort far past the first 200 alphabetical names → never loaded → filter finds nothing. Loading all rows client-side is not viable (8k rows carry `reasoning` text + jsonb).

**Chosen minimal fix (the spec's preferred option a + b): push the name filter into the SERVER query so it searches ALL rows, via a URL `q` param, plus an honest "Showing first N of M" line.** `ILIKE` over a ≤8k-row table is sub-millisecond; **no index, no migration needed.**

**Files:**
- Modify: `dashboard/lib/queries.ts:523-548` (`getCompanyReviews` — add `search` arg)
- Modify: `dashboard/app/companies/page.tsx` (read `sp.q`, thread to query + list)
- Modify: `dashboard/components/companies/CompanyList.tsx` (URL-driven search input + honest count)
- Test: `dashboard/lib/queries.test.ts` (guard the SQL builds with a search term — mock-level) OR a focused unit test of the new arg's presence; if the existing suite has no DB harness for this fn, add a lightweight test asserting the exported signature accepts `search` and defaults preserve current behavior.

**Interfaces:**
- Produces: `getCompanyReviews(userId: string, bucket: "include"|"exclude"|"unknown", limit?: number, search?: string) : Promise<CompanyReviewRow[]>` — `search` optional, default `undefined` (unchanged behavior). Trims + lower-bounds handled by caller; empty/whitespace `search` must behave exactly as today.
- Consumes (page): `getCompanyVerdictCounts(userId)` (already returns `{ include, exclude, unknown }` unfiltered totals).

- [ ] **Step 1: Add the `search` parameter to the query.** In `dashboard/lib/queries.ts`, extend `getCompanyReviews`:

```ts
export async function getCompanyReviews(
  userId: string,
  bucket: "include" | "exclude" | "unknown",
  limit = 200,
  search?: string,
): Promise<CompanyReviewRow[]> {
  const term = (search ?? "").trim();
  const rows = await sql`
    SELECT c.id, c.name, c.ats, c.token, c.discovery_source, c.active,
           r.verdict, r.override_verdict, r.human_override,
           COALESCE(
             CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
             CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
           ) AS effective_verdict,
           r.confidence, r.reasoning, r.industry, r.industry_subcategory,
           r.tech_tags, r.red_flags
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
    WHERE c.discovery_source <> 'manual'
      AND COALESCE(
            CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
            CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
          ) = ${bucket}
      ${term ? sql`AND c.name ILIKE ${"%" + term + "%"}` : sql``}
    ORDER BY c.name
    LIMIT ${limit}
  `;
  return rows as unknown as CompanyReviewRow[];
}
```

Note: the `rows as unknown as CompanyReviewRow[]` cast is **pre-existing** (jsonb `red_flags`/`tech_tags`). It is out of scope for this finding; do not expand this task to add a codec. (Tracked separately.)

- [ ] **Step 2: Thread `q` through the page.** In `dashboard/app/companies/page.tsx`, after computing `bucket`, read the query and pass it down:

```tsx
const rawQ = sp.q;
const search = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "").trim();

const [companies, counts, state] = await Promise.all([
  getCompanyReviews(userId, bucket, 200, search),
  getCompanyVerdictCounts(userId),
  getDiscoveryState(userId),
]);
```

Pass `search` and `counts` into `<CompanyList … query={search} counts={counts} />` (counts is already passed). Add a `query` prop to the render.

- [ ] **Step 3: Make `CompanyList` URL-driven + add the honest count.** In `dashboard/components/companies/CompanyList.tsx`: (a) accept `query: string` prop (server-provided seed), (b) drive the input from local state initialized to `query`, debounce-navigating via `next/navigation`'s `useRouter().replace`, (c) drop the client-side `rows.filter`, (d) render the honest count. Concretely:

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// … existing imports …

export function CompanyList({
  included, excluded, unknown, counts, state, activeBucket, override, refresh, query,
}: {
  /* …existing… */ query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query);
  const rows = activeBucket === "include" ? included : activeBucket === "exclude" ? excluded : unknown;
  const bucketTotal = counts[activeBucket];

  // Debounced server search: navigate to ?bucket=…&q=… ~300ms after typing stops.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (text === query) return; // in sync with the URL already
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams({ bucket: activeBucket });
      if (text.trim()) params.set("q", text.trim());
      startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, query, activeBucket, router]);

  const q = query.trim();
  const truncated = rows.length >= 200; // hit the LIMIT
  // …
```

Tabs: the `<a href={`?bucket=${t.key}`}>` links should drop `q` (switching bucket clears the search — expected). Leave as-is (they already omit `q`).

Replace the empty/results block with an honest affordance:

```tsx
{rows.length === 0 ? (
  <div style={{ fontSize: "13px", color: "#6b7480", padding: "20px 0" }}>
    {q ? `No companies match “${q}”.` : "No companies here yet."}
  </div>
) : (
  <>
    <div style={{ fontSize: "12px", color: "#8a93a3", marginBottom: "10px" }}>
      {q
        ? `${rows.length}${truncated ? "+" : ""} ${rows.length === 1 ? "match" : "matches"} for “${q}”${truncated ? " — refine to narrow further" : ""}`
        : truncated
          ? `Showing first ${rows.length} of ${bucketTotal} — search by name to find any company`
          : `${rows.length} ${rows.length === 1 ? "company" : "companies"}`}
    </div>
    {rows.map((c) => <CompanyCard key={c.id} company={c} override={override} />)}
  </>
)}
```

Keep the input element (`aria-label`, `rf-focusable`, inline styles) but bind `value={text}` / `onChange={(e) => setText(e.target.value)}`; optionally show a subtle "searching…" when `pending`.

- [ ] **Step 4: Manual verification (no DB test harness for this fn).** Run the dashboard (note: a fresh worktree needs `NEXT_PUBLIC_SUPABASE_*` in `dashboard/.env.local` — see memory "Dashboard .env.local not in worktrees"). Load `/companies`, type "vanta" → the include bucket returns the Vanta rows (5 exist); type "zapier" → returns rows (3 exist); clear → shows "Showing first 200 of 6382 …". Confirm switching tabs clears the query.

- [ ] **Step 5: Typecheck + tests.**

Run: `cd dashboard && npx tsc --noEmit && npm run test`
Expected: clean + green (existing `queries.test.ts` unaffected; the new optional arg preserves defaults).

- [ ] **Step 6: Commit.**

```bash
git add dashboard/lib/queries.ts dashboard/app/companies/page.tsx dashboard/components/companies/CompanyList.tsx
git commit -m "fix(companies): server-side name search over all rows + honest first-N-of-M count"
```

---

### Task 3: MEDIUM — Profile sticky save bar has no dirty-state indication

**Finding:** After editing, the sticky bar still shows only "Save · Last saved … · version …" with no "unsaved changes" cue.

**Root cause:** `dashboard/components/ProfileFormShell.tsx` already computes dirtiness (`serializeForm(form) !== pristineRef.current`) but only inside the `beforeunload` handler — there's no reactive state, so nothing renders. Reuse the exact same `serializeForm` definition for a live indicator.

**Files:**
- Modify: `dashboard/components/ProfileFormShell.tsx`

**Interfaces:**
- Consumes: existing `serializeForm(form)`, `pristineRef`, `isPending` (from `useActionState`).
- Produces: no new exports.

- [ ] **Step 1: Add reactive dirty state.** In `ProfileFormShell`, after the existing refs:

```tsx
const [dirty, setDirty] = useState(false);

// Live dirty check. The form is uncontrolled and the model/location pickers write to
// HIDDEN inputs via setState (no bubbling native input event), so poll on a light interval
// in addition to onInput — same serializeForm() definition the beforeunload guard uses.
useEffect(() => {
  const id = setInterval(() => {
    const form = formRef.current;
    if (!form || pristineRef.current === null) return;
    setDirty(!isPending && serializeForm(form) !== pristineRef.current);
  }, 400);
  return () => clearInterval(id);
}, [isPending]);
```

Add `useState` to the React import.

- [ ] **Step 2: Give the form an immediate onInput backstop** (so typing feels instant; the interval covers picker hidden-inputs). On the `<form>`:

```tsx
<form
  ref={formRef}
  action={formAction}
  onInput={() => {
    const form = formRef.current;
    if (form && pristineRef.current !== null) setDirty(serializeForm(form) !== pristineRef.current);
  }}
  style={{ display: "flex", flexDirection: "column", gap: "20px" }}
>
```

- [ ] **Step 3: Render the cue in the sticky bar.** Replace `{lastSaved}` at the end of the sticky bar with a dirty-aware slot:

```tsx
{dirty && !isPending ? (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, color: "#b25a36" }}>
    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#e0a03a", flexShrink: 0 }} />
    Unsaved changes
  </span>
) : (
  lastSaved
)}
```

(Amber dot + "Unsaved changes" matches the Rolefit warn palette used elsewhere, e.g. `#f59e0b`/`#b25a36`. After a successful save the server action redirects and the component remounts fresh → `pristine` re-captured → not dirty.)

- [ ] **Step 4: Verify.** Run the dashboard, open `/profile`, edit a text field → "Unsaved changes" appears within ~0.4s; change a `ModelPicker` selection → cue also appears; Save → redirect, cue gone. Run `cd dashboard && npx tsc --noEmit && npm run test` (existing `ProfileModal.test.tsx` unaffected).

- [ ] **Step 5: Commit.**

```bash
git add dashboard/components/ProfileFormShell.tsx
git commit -m "fix(profile): show an Unsaved-changes cue in the sticky save bar"
```

---

### Task 4: MEDIUM — ModelPicker field looks unset; selection demoted to a chip

**Finding:** The "Résumé generation model" field shows placeholder `anthropic/claude-haiku-4.5` (looks unset) while the effective selection is a chip `deepseek/deepseek-v4-flash ×` below.

**Investigation result (which component + is it broken + why):**
- The field is rendered by the **shared** `dashboard/components/ModelPicker.tsx` (used for all 5 model fields via `dashboard/app/profile/page.tsx:439-458`). There is no separate/multi-value component — the earlier commit `6759792` ("show the ModelPicker selection as a filled value") touched THIS same file.
- It IS broken as described. The visible `<input>` uses `value={query}` (empty until the user types) with `placeholder={placeholder}` (the field's default model id). The actual selection lives only in `selected` and renders as a small pill below (`ModelPicker.tsx:110-144`). So a field with a saved non-default selection looks empty (grey placeholder) with the real value demoted to a chip.
- Commit `6759792` actually **introduced** this: it changed `placeholder={selected || placeholder}` → `placeholder={placeholder}` and moved the selection into the filled pill. Net effect for a field whose saved value ≠ its default: the input now always shows the default as grey placeholder text that reads like a value.
- **The finding's request to "make the placeholder reflect the real default (`deepseek/deepseek-v4-flash`)" is based on a misread and MUST NOT be done.** `deepseek/deepseek-v4-flash` is the user's saved selection (the chip) and is `DEFAULT_MODEL_ID` (the *review* models' default, `lib/openrouter.ts:10`). The résumé field's real default is `DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5"` (`lib/rolefit/resumeClient.ts:14`) — so the placeholder `anthropic/claude-haiku-4.5` is already truthful. Do not change `DEFAULT_RESUME_MODEL` (that is a backend model choice).

**Fix:** make the input show the selection as a **filled value** when idle, keep the chip as a search-time reminder + clear control, and make the empty-state placeholder unambiguous as a default. The hidden `<input name={name} value={selected}>` (line 83) already carries the submitted value, so changing the visible input's `value` is purely presentational and safe.

**Files:**
- Modify: `dashboard/components/ModelPicker.tsx`

- [ ] **Step 1: Show the selected value in the input when idle; clarify the placeholder.** Change the visible text input:

```tsx
placeholder={`Default: ${placeholder}`}
value={open ? query : selected}
```

(When a selection exists and the menu is closed, the field shows the model id in dark text — a filled value. When empty, "Default: anthropic/claude-haiku-4.5" reads clearly as a fallback, not a set value.)

- [ ] **Step 2: Reset the query when the menu closes** so a stale search term never lingers behind the idle value. In the root `onBlur` handler and the Escape branch of `onKeyDown`, add `setQuery("")` alongside `setOpen(false)`:

```tsx
onBlur={(e) => {
  if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }
}}
```
```tsx
} else if (e.key === "Escape") {
  if (open) {
    e.preventDefault();
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }
}
```

- [ ] **Step 3: Only show the chip while searching** (so the idle input isn't redundant with the chip, but the current selection stays visible during a search). Change the chip guard from `{selected && (` to:

```tsx
{selected && open && (
```

(Idle + selected → the input itself is the filled value; searching → chip reminds you of the current selection and offers "×" clear. The clear button still calls `setSelected("")`.)

- [ ] **Step 4: Verify.** Run the dashboard, open `/profile`: each model field with a saved value shows that value as dark filled text; empty fields show "Default: <id>"; focusing a field opens the list and shows the reminder chip; picking or clearing works; Save persists (hidden input unchanged). Run `cd dashboard && npx tsc --noEmit && npm run test`.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/components/ModelPicker.tsx
git commit -m "fix(profile): render the model selection as a filled value; clarify the default placeholder"
```

---

### Task 5: MEDIUM — Résumé PDF upload is a naked native file input

**Finding:** The résumé upload is a bare `<input type="file">` ("Choose File | No file chosen") — the only unmigrated control on `/profile`.

**Constraint:** Preserve the existing upload path exactly. The server action `saveProfile` reads `formData.get("resume_pdf")` (`dashboard/app/profile/page.tsx:94`) and the dirty-check reduces file inputs to `name:size`. So a real `<input type="file" name="resume_pdf" accept="application/pdf">` must remain in the form; only its presentation changes. `/profile` is a Server Component, so the interactive control needs a small client component.

**Files:**
- Create: `dashboard/components/ResumeUploadField.tsx` (client)
- Modify: `dashboard/app/profile/page.tsx:269-278` (swap the naked input for the new component)

**Interfaces:**
- Produces: `ResumeUploadField({ name, accept, existingFileLabel }: { name: string; accept: string; existingFileLabel?: string })` — renders a visually-hidden `<input type="file" name={name} accept={accept}>`, a `ui/Button` that opens it, and the chosen filename.

- [ ] **Step 1: Create the styled upload component.**

```tsx
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function ResumeUploadField({
  name, accept, existingFileLabel,
}: {
  name: string;
  accept: string;
  existingFileLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const shown = fileName ?? existingFileLabel ?? "No file chosen";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept={accept}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
        Upload PDF
      </Button>
      <span style={{ fontSize: "12.5px", color: fileName ? "#1f2430" : "#8a93a3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {shown}
      </span>
    </div>
  );
}
```

(Confirm `Button` supports `type`, `variant="secondary"`, `size="sm"`, and `onClick` — check `dashboard/components/ui/Button.tsx`; adjust the prop names to match its actual API if they differ. The visually-hidden style is the standard clip pattern; the input stays a real form field so `FormData` and the dirty-check are unchanged.)

- [ ] **Step 2: Swap it into the profile form.** In `dashboard/app/profile/page.tsx`, replace the naked `<input name="resume_pdf" type="file" … />` inside the "Résumé PDF" label with:

```tsx
<ResumeUploadField name="resume_pdf" accept="application/pdf" />
```

Add the import near the other component imports: `import { ResumeUploadField } from "@/components/ResumeUploadField";`

- [ ] **Step 3: Verify byte-drop in a REAL browser** (jsdom does not reliably carry file bytes — see memory "Dashboard jsdom component tests"). Run the dashboard, open `/profile`, click "Upload PDF", pick a PDF → filename shows; Save → the existing extract-and-store path runs (server action unchanged). Run `cd dashboard && npx tsc --noEmit && npm run test`.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/components/ResumeUploadField.tsx dashboard/app/profile/page.tsx
git commit -m "fix(profile): styled résumé PDF upload button (visually-hidden input, same handler)"
```

---

### Task 6: LOW — Board filter bar reflows when toggling Applied (Sort jumps rows)

**Finding:** Toggling the Applied chip changes `totalInView`, shrinking the "N of M roles" count, which shifts the wrap point and makes "Sort: Best match" jump between rows.

**Root cause:** In `dashboard/components/rolefit/FilterBar.tsx:666-676`, the count `{visibleCount} of {totalInView} roles` has `whiteSpace: nowrap` but no fixed width, so its footprint changes with the digit counts (e.g. `247 of 6382 roles` → `3 of 12 roles`), moving the wrap boundary of the `flexWrap: wrap` bar.

**Files:**
- Modify: `dashboard/components/rolefit/FilterBar.tsx:667-676`

- [ ] **Step 1: Reserve a fixed, right-aligned slot for the count.** Give the count container a `minWidth` sized for the widest realistic string and right-align it so its width is constant regardless of the numbers:

```tsx
<div
  style={{
    fontSize: "12.5px",
    color: "#6b7480",
    fontWeight: 700,
    whiteSpace: "nowrap",
    minWidth: "128px",
    textAlign: "right",
  }}
>
  {visibleCount} of {totalInView} roles
</div>
```

(128px comfortably fits `6382 of 6382 roles` at 12.5px/700. The existing `<div style={{ flex: 1 }} />` spacer keeps the count+Sort cluster right-aligned; a constant-width count means toggling Applied no longer changes total width, so Sort's wrap position is stable.)

- [ ] **Step 2: Verify.** Run the dashboard board, toggle Applied/Rejected repeatedly at a few viewport widths near the wrap threshold → "Sort: …" stays put. Run `cd dashboard && npx tsc --noEmit`.

- [ ] **Step 3: Commit.**

```bash
git add dashboard/components/rolefit/FilterBar.tsx
git commit -m "fix(board): reserve a fixed slot for the role count so Sort doesn't reflow"
```

---

### Task 7: LOW — Board shows a literal "Unknown" pill on some cards

**Finding:** Some job cards render a literal "Unknown" pill.

**Root cause:** In `dashboard/components/rolefit/JobCard.tsx:32-35`, `remoteLabel` is derived by capitalizing `job.work_arrangement`. `work_arrangement` is a taxonomy value that can be the literal string `"unknown"` (`lib/rolefit/taxonomy.ts:82`), so `remoteLabel` becomes `"Unknown"` and renders as a `<Chip>` (`JobCard.tsx:145`). The same value flows into `JobDetail.tsx:145`'s `metaLine`.

**Files:**
- Modify: `dashboard/components/rolefit/JobCard.tsx:32-36`
- Modify: `dashboard/components/rolefit/JobDetail.tsx:141-147` (consistency)

- [ ] **Step 1: Omit the arrangement chip when unknown/empty.** In `JobCard.tsx`:

```tsx
const rawArrangement = job.work_arrangement ?? (job.remote === true ? "remote" : null);
const remoteLabel = rawArrangement && rawArrangement !== "unknown"
  ? rawArrangement.charAt(0).toUpperCase() + rawArrangement.slice(1)
  : null;
```

(`{remoteLabel && <Chip>{remoteLabel}</Chip>}` already guards on truthiness, so `null` drops the pill.)

- [ ] **Step 2: Optional trailing-separator tidy.** The subtitle `companyLine = `${job.company_name} · ${job.location ?? ""}`` leaves a dangling " · " when `location` is null. Tidy it:

```tsx
const companyLine = [job.company_name, job.location].filter(Boolean).join(" · ");
```

- [ ] **Step 3: Same guard in the detail meta line.** In `JobDetail.tsx`, exclude an unknown arrangement:

```tsx
const arrangement = rawArrangement && rawArrangement !== "unknown"
  ? rawArrangement.charAt(0).toUpperCase() + rawArrangement.slice(1)
  : null;
```

(`metaLine`'s `.filter(Boolean)` already drops `null`.)

- [ ] **Step 4: Verify.** Run the board; cards with `work_arrangement = "unknown"` show no arrangement pill and no dangling separator; Remote/Hybrid/Onsite still render. Run `cd dashboard && npx tsc --noEmit && npm run test`.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/components/rolefit/JobCard.tsx dashboard/components/rolefit/JobDetail.tsx
git commit -m "fix(board): omit the Unknown work-arrangement pill on cards + detail"
```

---

## Deferred follow-ups (explicitly OUT of scope for this round)

- **Finding 7 — Companies bucket disagrees with verdict text; raw LLM chain-of-thought shown verbatim.** Re-bucketing + summarize-at-write-time are **backend Python** (`company_discovery`), not this frontend round. A tiny dashboard-only formatting guard (e.g. truncating/labelling raw `reasoning`) could be in scope, but it is non-trivial to do well without the backend summary, so **defer entirely** to a backend task.
- **Mobile / responsive verification** — not a code finding; no task.
- **Pre-existing `as`-cast on jsonb in `getCompanyReviews`** (`red_flags`/`tech_tags`) — noted in Task 2 Step 1; violates `dashboard/CLAUDE.md` but predates this work. Track as separate hardening (add a `companyReviewCodec`), not part of these findings.

---

## Self-Review notes

- **Spec coverage:** Findings 1, 2, 3, 4, 5, 6, 8 → Tasks 1, 2, 3, 4, 5, 6, 7. Finding 7 + mobile → Deferred. Task 0 added for the stack drift (recharts 3 / Next 16) that finding 1 depends on.
- **No migrations:** confirmed — Task 2's `ILIKE` runs on a ≤8k-row table with no index requirement.
- **Type consistency:** `getCompanyReviews` signature `(userId, bucket, limit?, search?)` is used identically in the page. `ResumeUploadField` props match its call site. `remoteLabel`/`arrangement` guards match their render guards.
- **Ordering:** HIGH correctness (Tasks 1-2) precede MEDIUM (3-5) and LOW (6-7), per the constraint.
- **Fallback note:** written with the superpowers:writing-plans skill structure.
