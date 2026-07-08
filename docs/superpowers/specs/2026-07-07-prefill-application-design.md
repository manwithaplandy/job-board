# Prefill application (Greenhouse) — design

**Date:** 2026-07-07
**Status:** Approved (brainstorming) — ready for implementation plan
**Branch:** `greenhouse-prefill-application`

## Problem

The application panel has a **"Prepare application"** button that, for any job, generates
a tailored résumé **and** a cover letter and (Greenhouse only) fetches the posting's
question schema and LLM-prefills it — then persists all of it as an
`application_packages` row.

Two problems:

1. **Unclear + cost-opaque.** "Prepare application" doesn't tell the user what it does or
   that it spends LLM budget on their behalf. It always generates a cover letter even
   though most postings never ask for one — a wasted, charged generation.
2. **Greenhouse question fetch happens per-user, on demand.** The posting's question
   schema is job-level data (identical for every user), but today it's re-fetched on every
   user's Prepare and stored per-package. It also can't be shown until the user prepares.

## Goals

- Replace the vague "Prepare application" button with an explicit, Greenhouse-only
  **"Prefill application"** action.
- Generate a cover letter **only when the posting actually asks for one** (detected from
  the real question schema), routed through the existing cover-letter pipeline.
- Move the Greenhouse question fetch to **poll time** (job-level, shared across users),
  and surface the question list on every Greenhouse job **before** any LLM spend.
- Use the **generated** tailored résumé (not the profile résumé) as the source for
  prefilled answers, so drafted answers match the résumé the user submits.

## Non-goals

- Question schemas for non-Greenhouse ATSes (Greenhouse-only, as today).
- Periodic re-fetch of question schemas (fetch once per job; the live form is the source
  of truth).
- Changing the cover letter's résumé input (it keeps using profile résumé text, matching
  the standalone cover-letter button).
- Dropping the now-unused columns in this change (deferred; see Cleanup).
- Any change to review/poll cadence beyond one extra per-new-job HTTP fetch.

## Key decisions

| # | Decision |
|---|----------|
| D1 | "Prefill application" is **Greenhouse-only**. Non-Greenhouse jobs show no such button; they keep the existing standalone résumé / cover-letter "Generate" buttons. |
| D2 | Prefill generates **résumé + prefilled answers**. A **cover letter is generated only if the posting's question schema asks for one** — narrow detection (canonical `cover_letter` field or `/cover letter/i` label), fired when that field is **present** (required or optional), not for free-form essay prompts. |
| D3 | Prefill uses the **generated** tailored résumé (serialized via `composeResumeText`), not the profile résumé text. Résumé → prefill is therefore **sequential**. |
| D4 | **Résumé-failure behavior (a1):** if résumé generation fails, prefill is **skipped**; the user retries and both regenerate together. The cover-letter leg (if requested) runs in parallel and can still succeed. |
| D5 | Greenhouse question schema is fetched at **poll time** and stored **job-level** (shared) in a new `job_questions` table. Prefilled answers stay **per-user** in `application_packages`. |
| D6 | Poller fetch predicate is **"any open Greenhouse job with no `job_questions` row"** (not strictly new jobs), so the existing backlog **rolling-backfills** over subsequent polls. |
| D7 | The "Application questions" panel renders on every Greenhouse job, **collapsed by default** into a one-line summary, expandable. Apply stays the top primary CTA. |
| D8 | `application_packages.answers_snapshot` and `.greenhouse_questions` become **vestigial** (code stops reading/writing them); columns are **left in place** for now. A drop migration is deferred (a column drop is a separate two-phase deploy). |

## Architecture

### 1. Poll-time question fetch (Python)

New table (global job data — no `user_id`):

```sql
CREATE TABLE job_questions (
  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,               -- GreenhouseQuestions shape (see below)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Access posture mirrors `jobs`/`companies` (service/poller writes, authenticated reads).
It is **not** user-scoped, so the user-scoped deny-all RLS checklist does **not** apply.

The poller (`job_discovery/`) gains a step that, for each open Greenhouse job **lacking a
`job_questions` row**, calls
`GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{external_id}?questions=true`
(one call per job, once), parses it, and inserts a row when a usable question set exists.

- **Parser:** a Python twin of `parseGreenhouseQuestions`
  (`dashboard/lib/rolefit/greenhouseQuestions.ts`), colocated with
  `job_discovery/adapters/greenhouse.py`. It emits the **same JSON shape** the dashboard
  already parses:
  `{ questions: [{ label, required, fields: [{ name, type, options: [{ value, label }] }] }] }`.
- **Parser-parity guard:** a shared JSON fixture (a real Greenhouse `?questions=true`
  payload) is asserted by both the TS test and the Python test to produce identical
  parsed output, so the two parsers cannot drift.
- **Politeness/cost:** the fetch reuses `job_discovery/http.py` (`get_json`) and its
  existing retry/timeout behavior. Because the predicate is "missing row," the backlog
  is fetched once and then only truly-new jobs incur a call — bounded and self-limiting.

### 2. Data flow

- **Questions:** read job-level from `job_questions` (left-join when loading the board /
  job detail). Shared across users.
- **Prefilled answers:** stay per-user in `application_packages.prefilled_answers`.
- The panel already consumes the two separately via
  `mergeGreenhouseQuestions(questions, answers)` (`greenhouseAnswers.ts`), so no merge
  logic changes — only the **source** of `questions` moves from the package to the job.
- `application_packages.greenhouse_questions` is no longer written or read.

### 3. Prefill application route

Repurpose the existing route (`dashboard/app/api/application/prepare/route.ts`). The
internal route path and `generation_jobs.kind = 'prepare'` are **kept as-is** to avoid a
CHECK-constraint migration (`kind IN ('resume','cover','prepare')`) and the dual-value
transition it would force on existing/in-flight rows; only user-facing copy changes.
**This must be documented in code:** add a short comment at the `generation_jobs.kind`
CHECK constraint (schema.sql) **and** at the route explaining *"user-facing label is
'Prefill application'; internal identifier kept as 'prepare' to avoid a kind-constraint
migration."* A later rename to `'prefill'` is optional and belongs in a standalone
follow-up, not this change.

Synchronous prologue (unchanged in spirit): auth, validation, config, profile/job load.
**Guard:** the route now returns 4xx for non-Greenhouse jobs (the button is Greenhouse-only,
but the API must enforce it too). It loads the job's `job_questions` row; if absent
(e.g. a brand-new job not yet backfilled), it fetches on demand via the existing
`fetchGreenhouseQuestions` (TS) and persists the result to `job_questions`, so Prefill
always works and the row is filled for the next viewer. If even the on-demand fetch yields
no usable schema, Prefill degrades to résumé-only (no answers, no cover).

**Charging (posting-driven):**
- Always reserve `resume`.
- Reserve `cover` **iff** the question schema contains a cover-letter ask.
- The prefill LLM call itself stays uncharged (as today).
- Any leg that fails is refunded (mirrors current per-leg refund + the outer catch).

**Background `after()` work:**

1. **Résumé leg:** `generateResume(...)` → on success, `composeResumeText(resume)` →
   `resumeTextForPrefill`.
   - Then, chained on success only, **prefill leg:** `generatePrefilledAnswers({ resumeText: resumeTextForPrefill, ... })`
     over the text questions **excluding** any cover-letter question.
   - Per **D4**, if the résumé leg fails, the prefill is skipped (no fallback to profile
     text), résumé is refunded, and the failure is surfaced for retry.
2. **Cover-letter leg (parallel, conditional):** only if a cover-letter ask is detected.
   `generateCoverLetter(...)` through the normal cover pipeline — persists
   `cover_letter_json` + `cover_letter_trace_id`, supersedes any prior edit, and feeds the
   cover-letter golden dataset. Uses profile résumé text (unchanged).
3. **Persist** via `upsertApplicationPackage`: résumé, prefilled answers, cover letter
   (when generated). **Not** written: `answers_snapshot`, `greenhouse_questions`.
4. Settle the tracking row (clean / partial / failed), mirroring today's semantics.

**Cover-letter detection — narrow, present-not-required** (on the raw `GreenhouseQuestions`,
before `toPrefillQuestions` strips file fields): a question is a cover-letter ask iff any
field's `name === "cover_letter"` **or** the question `label` matches `/cover\s*letter/i`.
Detection is deliberately **narrow** — free-form essay prompts ("Why do you want to work
here?", "Tell us about yourself") are **not** treated as cover-letter asks. Rationale:
`generateCoverLetter` writes a role-level letter, whereas the generic prefill answers the
*specific* question; routing an essay to the cover pipeline would ignore its actual prompt,
and multiple essays can't all map to one letter. Essay questions therefore stay in the
generic prefill.

Generation fires when a cover-letter field is **present** (required *or* optional), not only
when required — Greenhouse's standard `cover_letter` field is usually optional, so a
required-only rule would almost never fire. The collapsed questions panel flags "cover
letter requested," so the user sees the (charged) cover-letter leg coming before clicking
Prefill. Detected cover-letter questions are excluded from the generic prefill set (so they
are not double-answered) and instead drive the cover-letter leg. Greenhouse's cover-letter
field is usually `input_file`, which the generic prefill already skips — so today it
produces nothing; now it produces a real, downloadable cover letter to attach.

**Essay-answer quality (non-blocking enhancement):** if generic prefill answers for
long-form `textarea` questions read too thin, improve them in the **prefill prompt** — it
already receives each field's type, so it can write fuller answers for `textarea` fields —
rather than by widening cover-letter detection.

### 4. UI (`ApplicationPanel.tsx`, `RolefitBoard.tsx`)

- **Header button:**
  - Non-Greenhouse: **no** Prefill/Prepare button. (Résumé + cover remain as their own
    standalone "Generate" panels.)
  - Greenhouse: **"Prefill application"** (label + copy make the action and its cost
    explicit). Standalone résumé/cover buttons remain for one-off regeneration.
- **Apply** remains the top primary CTA, unchanged.
- **"Application questions" panel:** renders on every Greenhouse job from `job_questions`,
  **collapsed by default** to a one-line summary — e.g. *"7 questions · cover letter
  requested · Prefill to draft answers"* — expandable to the full list. After prefill,
  answers fill in inside; unanswered required questions still show "Needs your answer."
  The collapsed default keeps job info and Apply from being buried.
- The header subtitle ("Tailored résumé and cover letter — ready for X") is updated to
  reflect the posting-driven behavior.

### 5. Cleanup

- Stop writing `answers_snapshot` (fully dead) and `greenhouse_questions` (moved
  job-level) in `upsertApplicationPackage` and its callers.
- Remove `answersSnapshot` from the `handleUnapply` `hasContent` OR-check in
  `RolefitBoard.tsx` (it never contributed a distinct outcome).
- Keep `applicationAnswersFromProfile` — the **live** profile projection is still used to
  surface reusable answers and as the profile-answers input to prefill. Only the persisted
  **snapshot** goes away.
- Columns are left in the schema (vestigial); a drop migration is a separate later change.

## Data model changes

- **New:** `job_questions (job_id PK → jobs ON DELETE CASCADE, questions jsonb, fetched_at)`.
  Add to `schema.sql` + a migration. Global-access posture (no RLS user scoping).
- **Vestigial (unchanged this round):** `application_packages.answers_snapshot`,
  `application_packages.greenhouse_questions` — no longer written/read.

## Testing

- **Parser parity:** shared fixture → identical `GreenhouseQuestions` from the Python and
  TS parsers.
- **Backfill predicate:** poller fetches for an open Greenhouse job with no `job_questions`
  row; skips one that already has a row; ignores non-Greenhouse jobs.
- **Cover-letter detection:** file-type `cover_letter` field and `/cover letter/i` labels
  both route to the cover pipeline and are excluded from generic prefill; absence generates
  no cover letter and reserves no `cover` slot.
- **Prefill input:** asserts the **generated** résumé text (not profile text) is fed to
  `generatePrefilledAnswers`.
- **Résumé-failure (D4):** résumé leg fails → prefill skipped, résumé refunded; cover leg
  (if requested) still persists.
- **Conditional charging:** `resume` always reserved; `cover` reserved iff a cover-letter
  question exists; failed legs refunded.
- **Data flow:** panel reads questions from `job_questions` and answers from the package;
  `mergeGreenhouseQuestions` output unchanged.
- **UI:** questions panel collapsed by default; Prefill button present on Greenhouse and
  absent on non-Greenhouse; API rejects Prefill for non-Greenhouse jobs.

## Rollout / deploy ordering

1. Apply the `job_questions` migration to Supabase **before** shipping code that reads it
   (migration-coupled-code discipline).
2. Deploy the poller change (backfill predicate) — the backlog begins filling on the next
   poll(s). The on-demand fallback in the route covers jobs not yet backfilled.
3. Deploy the dashboard change (route repurpose + UI). No column drop; nothing destructive.
4. (Later, separate) optional cleanup migration to drop the vestigial columns, sequenced
   **after** this code is deployed and soaked.

## Open questions

None blocking. Optional future work: rename the internal `prepare` route/kind to `prefill`
(requires a CHECK-constraint migration + pending-row handling); one-time backfill script if
the rolling backfill is too slow to fill the inventory.
