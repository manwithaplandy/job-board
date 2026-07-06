# Enrich-on-select — standing grounding stage in the discovery cron

**Date:** 2026-07-05
**Branch:** worktree-jaunty-soaring-summit (adds to PR #7)
**Status:** Approved (design)

## Problem

Company enrichment (display_name/about grounding from free ATS-board metadata) shipped
as a **one-time operator backfill** (`company_discovery/enrich_backfill.py`). The
discovery cron (`company_discovery/run.py`) only *reads* the grounding columns
(`display_name/about/web_description`, fed to `client.review`) — it has **no step that
fetches or populates them**. Two consequences:

1. **New companies recur as unknown.** Every cron run ingests new candidates
   (`upsert_candidates`) and reviews them with zero grounding (bare ATS slug). The
   original ~50%-unknown problem returns for every newly-discovered company — the backfill
   drained the backlog but did not close the tap.
2. **Non-enriched companies are re-reviewed ungrounded.** The backfill was scoped
   unknowns-only, so every active/`include`, every `exclude`, and every dead-board unknown
   has no grounding. When `select_for_review` re-queues them (e.g. after the user's
   company-preferences hash changed to add "American companies only"), the model judges
   nationality from a bare slug like `3dayblindscorporate` — unreliable for exactly the
   companies that matter.

Root cause of the current whole-catalog re-review: the user edited `company_instructions`
(added "American companies only."), which changed `company_profile_version`
`280c9f…`→`2016ab…`; `select_for_review`'s `company_profile_version <> pv` clause then
marks every non-overridden company stale. That invalidation is correct (old verdicts
predate the rule) — the issue is only that the re-review runs ungrounded.

## Goal

Promote enrichment from a one-shot script to a **standing cron stage**, so grounding is a
durable pipeline capability: new companies and re-queued companies alike get grounded
before the LLM sees them, at the normal cron cadence — no manual full sweep required.

## Design

### Enrich-on-select stage

Add one stage inside `_review_user`, **between** `select_for_review` and `review_batch`:

- For each selected company with `enriched_at IS NULL`, call `plan_enrichment(ats, token)`
  (the backfill's existing per-row decision — reused verbatim) in a small
  `ThreadPoolExecutor(max_workers=5)` (fetchers are sync httpx; the poller shares the same
  egress IP, so keep concurrency small).
- On a non-empty result: persist via the existing UPDATE
  (`display_name = COALESCE(%s, display_name), about, about_source, enriched_at = now()`)
  **and** patch the in-memory candidate dict (`display_name/about`) so the review in this
  same run sees the grounding without a re-query.
- Companies that already have `enriched_at` set pass straight through, untouched.
- Failures/empties (dead board, unsupported ATS) skip silently (`plan_enrichment` never
  raises) — the company is reviewed ungrounded this run.

DB writes stay on the main thread (one psycopg connection is not thread-safe); only the
HTTP fetches run in the pool — same split the backfill already uses.

### Shared logic (single source of truth)

Extract the backfill's `plan_enrichment` + `EnrichUpdate` + the `_apply` UPDATE into a
shared home (e.g. keep them in `enrich_backfill.py` and import from the cron, or lift into
a small `company_discovery/enrich_apply.py`). Both the backfill and the cron MUST run
**identical** enrichment logic — no divergence.

### Behavior / edge cases

- **Dead-board retry policy:** leave `enriched_at` NULL on failure (matches the backfill).
  A dead-board company is reviewed ungrounded once, takes the current pv, and drops out of
  the backlog — *not* re-probed every run. Re-attempted only if the pv changes again. We
  accept the rare transient-outage miss (one ungrounded review).
- **No re-probe storm:** because a reviewed company carries the current pv and (if dead)
  `enriched_at IS NULL`, it is not re-selected next run (pv matches, no error,
  `enriched_at > reviewed_at` is false). Enrichment cost is O(companies-per-pv-change),
  not O(companies-per-run).
- **Throughput:** ≤`BATCH_CAP` (default 500) selected/run → ≤500 board GETs at 5 workers ≈
  2–3 min added per weekly run — negligible.

## Non-goals

- **No forced full reclassification** and **no snapshot table.** Per user decision: fix the
  cron, then let the normal weekly cron drain the pv-stale backlog grounded at 500/run.
  Actives are re-reviewed gradually by the cron, not by a manual sweep.
- **No migration** — all columns (`display_name/about/about_source/enriched_at/`
  `web_description/web_searched_at`) exist from the C0 migration (already applied to prod).
- **No frontend changes.**
- **SERP (C3) stays deferred** — `web_description`/`web_searched_at` remain unpopulated;
  this stage only does the free ATS-board / JD-probe grounding.

## Rollout

1. Ship the code on the branch (PR #7); merge + deploy (push-to-main auto-deploys Railway
   discovery service).
2. The normal cron drains the pv-stale backlog at `BATCH_CAP`/run, grounding each company
   as it is selected. New companies are grounded on first review.
3. **Known residue:** the ~1,239 companies re-screened ungrounded under the NEW pv during
   the partial rollout now carry the new pv, so they will *not* self-re-select. Optional
   later heal: a targeted enrich of `enriched_at IS NULL` rows among them sets `enriched_at`
   → trips `enriched_at > reviewed_at` → re-queues them for a grounded pass. Not required
   for correctness; noted for completeness.

## Testing

New unit test for the enrich-on-select stage (DB-backed via `requires_db`, fetchers
monkeypatched — no network):

- an `enriched_at IS NULL` selected company gets grounded: `display_name/about/`
  `about_source/enriched_at` persisted AND the in-memory candidate dict updated;
- an already-enriched company (`enriched_at` set) is left untouched (no re-fetch, no write);
- a dead-board company (fetcher raises / returns empty) is skipped: no write,
  `enriched_at` stays NULL, and it is still handed to review (ungrounded);
- shared-logic parity: the cron stage and the backfill produce the same UPDATE for the
  same input.

Full Python suite green (`python3 -m pytest`); DB tests need
`TEST_DATABASE_URL=…@localhost:55432/poller_test`.
