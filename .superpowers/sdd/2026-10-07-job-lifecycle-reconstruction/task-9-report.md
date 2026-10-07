# Task 9 — discovery, availability and retained history

Local implementation complete, pending the controller's fresh independent permitted
requirements/quality review. No production changes or activation. Source pin:
`ba00e50153f948ebe8726db1a445e201ebce5901`; author base:
`5a319253169cd03e1821e7c3d02df82249e6ce8b`. Report/evidence-only follow-up does not
change product source. Task8 interfaces reused from source
`eaef2fb43199771d3d18a3ed876cc62fb240a6ac` and report
`98c1fde4a160ee99ba664d69e73a9cc885fea2f4`.

## Result and interfaces

Discovery uses the frozen listing expiry, exactly anchor + 720 elapsed UTC hours.
At expiry the default feed excludes a listing; `older=1` explicitly includes
expired confirmed-open listings. Unknown availability, proven closure, discovery
expiry and payload retirement/unavailability are separate states. Original
`first_seen_at` remains readable as Discovered and supplies existing newest sort;
no employer posting-age or expiry-as-closure claim. Payload absence never closes
an open source. Multiple mappings use any eligible source for membership, with a
stable representative listing for display.

`dashboard/lib/jobLifecycle.ts` reexports `parseJobLifecycle` and
`discoveryPredicate` from client-safe `jobLifecycleState.ts`. That split prevents
a client component from bundling demand/DB imports. Total bounded parsers handle
legacy scalar/double-encoded JSON, validate enum/boolean/array fields and require
zoned dates with a coherent 720-hour interval. Actual detail HTTP responses use
the validated parser, including benefits, requirements, red flags and questions.

Dashboard discovery rows/counts, reviewer candidates, review-pool statistics,
locations and analytics discovery pools reuse the shared SQL predicate. Closed
filters/counts use the separate source-closure helper. Actual dashboard page and
reviewer total/rows are each one statement, sharing membership/snapshot/expiry
boundary; ties use original first-seen then job ID. Reviewer retains its existing
location/company/verdict and hydration-dependent pruned-payload gates and has no
automatic older-live option. Analytics labels distinguish current discovery from
retained private review/application aggregates and legacy observed closure durations.

Private approved/corrected/prepared/applied history has a separate owner-scoped
query/count/page, independent of discovery expiry, closure, review errors and
profile location/company gates. History cards open their actual detail. Saved
JD/Q/version and exact actual demand receipts remain authoritative; current
hydrated detail stays separate. NULL historical questions retain orphan answers
and explicitly say the historical schema is unavailable. No retrofit to current
questions. Proven-closed detail queues no new current hydration demand. Genuine
historical generated artifacts with unknown original inputs still terminal-defer;
full atomic recapture remains UNIMPLEMENTED. Existing contentless instruction or
application markers can establish first actual input under Task8's contract.

The public board now renders per request instead of its former 120-second ISR
cache, so a cached response cannot span expiry. This increases anonymous DB
traffic; production throughput/per-row cost is unmeasured. `page`/`historyPage`
independently page at 500 rows. Server total/pagination are separate from
page-local client facets/search/N-of-M; those local counts share their loaded
view pool and are not full-corpus facet/search claims. Saved filter JSON cannot
silently activate older-live. Existing editorial audience curation is retained.

## Narrow public projection ruling

An additive migration and identical `schema.sql` suffix provide:

- `public.lifecycle_job_state(text) -> nullable jsonb`: feed/source display
  booleans, source availability, frozen anchor/expiry, payload availability.
- `public.lifecycle_discovery_visible(text,timestamptz,boolean) -> boolean`.
- `public.lifecycle_source_closed(text,timestamptz) -> boolean`.

They are fixed schema-qualified SELECTs, STABLE SECURITY DEFINER with fixed
`pg_catalog, public` search path, PUBLIC EXECUTE revoked and anon/authenticated
EXECUTE granted. No dynamic SQL, DML, bypass switch or user/private/claim/capacity/
credential projection. Underlying lifecycle table grants and existing anon/owner
wrappers remain unchanged; board reads never switch to serviceSql. The parent
explicitly authorized this narrow local interface because lifecycle state stays
service-only. It is a new derived public read capability and adds per-row read
work; ordinary role/query results below do not establish independent security or
load approval. No production helper/grant installation was performed.

Unmapped public rows return NULL state and honestly fall back to legacy closed_at;
no anchor/status is invented. Mapping/readiness is a rollout prerequisite. Flags
off preserve that legacy path except proven all-source closure stays excluded on
rollback. Rollback changes no frozen dates, payload content or closure proof.
Existing flags remain off; retirement stays dry-run and archive inactive.

## Commands, results and evidence

All shell commands used `/bin/bash`, login disabled. Commands below ran in the
worktree; the TS command ran from `dashboard`. Evidence is in
[task-9-evidence](task-9-evidence/), with full intermediate failure chronology in
[chronology.md](task-9-evidence/chronology.md). Overlapping runs are not summed.
Final checks assessed the working source committed at the source pin; the last
reviewer-only change was followed by affected reviewer checks on both majors.

```sh
./node_modules/.bin/vitest run lib/jobLifecycleConsumers.test.ts lib/jobsQuery.test.ts lib/filters.test.ts lib/rolefit/boardFilters.test.ts lib/rolefit/filter.test.ts lib/queries.jobDetail.test.ts lib/queries.reviewFeed.test.ts components/rolefit/RolefitBoard.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/JobCard.test.tsx 'app/api/jobs/[id]/route.test.ts' components/analytics/SecondarySurfaceFixes.test.tsx app/ui-contract.test.ts
```

`task9-selected-release.txt`: **193 passed /13 files, no skips**, exit0. The
history-opening jsdom case prints its ordinary unimplemented window.scrollTo
notice. Coverage includes exact elapsed UTC/DST boundary, explicit older-live,
unknown/closed/expired/retired distinctions, total JSON, count/query/paging,
private history/detail access and actual analytic captions/UI source contracts.

From repo, each MAJOR substitution was a separate owned random loopback harness:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
```

`task9-db17-complete.txt`, `task9-db16-complete.txt`: **6 passed each**, no skips,
actual servers **17.11 Debian17.11-1.pgdg13+2 /16.15 Debian16.15-1.pgdg13+2**.
They install the additive migration twice against pre-Task9 schema, verify schema
suffix parity, and execute actual anon/owner wrappers: flag-off/unmapped,
current/older membership, total/page agreement, approved/corrected/prepared/
applied history, profile-discovery0/history4, distinct closed filter and rollback
preserving dates/retired payload/closure. No shared55432 service or unrelated DB
suite was used. Fixture reset affects only its harness-owned test DB.

`task9-reviewer17-release.txt`, `task9-reviewer16-release.txt`: **9 passed,
30 deselected each**, exit0, same actual server versions. Selection is explicitly
candidate/stale/feed_flags, not the broad existing reviewer suite. Initial shared
predicate RED showed flag-off expired candidates incorrectly excluded. Final
one-statement regression RED recorded two real candidate reads; GREEN records one
read and actual unchanged DTO/count. This is ordinary feed feature coverage,
not omitted independent expiry-enforcement/capacity/security mechanism assurance.

```sh
# dashboard cwd
npm run typecheck
npm run lint
# repo cwd
.venv/bin/ruff check reviewer/db.py tests/test_reviewer_lifecycle_feed.py
git diff --check
```

`task9-typecheck-source.txt`: exit0. `task9-lint-release.txt`: exit0, **0 errors,
9 inherited warnings** (TrendCharts dependencies, existing TanStack Virtual
compiler warning, config exports, parseProfile expressions, theme test directive).
`task9-ruff-final.txt`: All checks passed. `task9-diff-final.txt`: product working
diff check exit0. The later staged check flagged terminal-output whitespace in
literal evidence copies; report follow-up normalizes only copied text whitespace,
preserving all result/failure text and leaving original /tmp logs intact.

```sh
node .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs
```

`task9-browser-release.txt` and `browser/result.json`: **9 assertions passed**,
installed **Chromium151.0.7922.173**, desktop1280x800/mobile390x844, zero page
errors/blocked external requests. Actual RolefitBoard and descendant components;
only server props/actions/navigation/API are fake. Owned random loopback target,
external requests aborted. Actual default feed, unchecked older-live toggle,
opt-in older card, expiry/retired labels, selected detail and current-description
disclosure verified. Screenshots: `browser/default.png`, `older-detail.png`,
`mobile-detail.png`. This is not Next SSR/real auth/provider/pipeline verification.
Normal Playwright Chromium installation failed HTTP403 `Domain forbidden` at
cdn.playwright.dev; no alternate-host bypass. Local installed Chromium supplied
the successful browser. Bundle first exposed DB transitive imports; corrected
client module boundary, then browser passed. Intermediate harness errors retained.

Broader requested dashboard non-DB command, from dashboard:

```sh
npm test -- --exclude '**/*.db.test.ts'
```

First `task9-dashboard-full.txt`:1706 passed/4 failed/2 skipped,217 files. Second
`task9-dashboard-final.txt`:1708 passed/4 failed/2 skipped,217 files. The first
included the new UI contract failure; the second began while the new UTC parser
case was RED. Both Task9 failures were fixed and are in final scoped GREEN; the
broad suite is **not claimed green**. Three inherited fixture failures remain:
two live-action cases in `app/actions/tombstoneGuard.test.ts` whose mocks omit
Task8 demand/mutation DB exports; workflow contract expects2 DATABASE_URL entries
while BASE CI has3. Those files unchanged; carried to Task13. Two genuine skips
are existing missing binary-PDF fixtures in fileToResumeMarkdown and parseProfile
(named in chronology). Narrow `-t` attempts printed Vitest skipped for **name-
filtered** cases (UI2 passed/9 filtered; detail2 passed/15 filtered); do not treat
those as genuine skip declarations. Wrong-cwd attempts, one concurrent UI audit
timeout, DB fixture constraint failures, intermediate source RED and fixes are
retained explicitly. No invented full matrix or whole-suite success.

## Inventory, upstream and remaining limits

Actual before/after:
`rg -n 'first_seen|last_seen|closed_at|description_pruned' reviewer dashboard job_discovery`.
Outputs `task9-consumers.txt`/`task9-consumers-final.txt`; every returned production
module and test/demo group is accounted in
[consumer/rollback runbook](../../../docs/runbooks/2026-10-07-lifecycle-consumers.md).
Safe coexistence retains Task8 source/demand/private interfaces. Rollback uses a
compatible consumer, preserves anchors/closure/snapshots and never resets dates,
refills retired caches, reopens proven sources or resumes destructive legacy prune.

Read-only local upstream cache `refs/remotes/origin/main`:
`73ce118205bfdbb56c18207acc0c1c4e3708c860`. Local `git log` from approved main
reference `114cce96cb244546864a6bddc5476b5630bc024a` showed no newer delta. This is
cached ancestry evidence, **not fresh remote/network proof**; Task13 owns that.
One exec-server create-process call disconnected; immediate ordinary read retry
recovered the same environment. No executor replacement/reinitialization or
completed-stage restart. No current concrete tooling blocker.

R6-5 resolved Task8 shared public transport reused unchanged, no duplicate
integration/probes. R6-4 durable closure/health progress above physical guard is
mandatory Task10/13 work, untouched/unwaived here. Existing unknown-artifact full
recapture remains unimplemented; mapping completeness, public projection/per-row
cost, dynamic board traffic and live-provider compatibility/load are unresolved
release limits. The deliberately omitted Task3 independent expiry-enforcement,
capacity-accounting, cross-user/adversarial security review/probes remain absent.
No broad old pytest/safety tests, reserved destructive feedback fixtures,
production migration/writes/grants, flag enabling, IAM/S3 provisioning, real
provider/model/auth calls, push/PR/merge/deployment or paid model calls occurred.
This handoff is Task9 implementation evidence; it is not all13/final release or
independent security acceptance.

## Current phase pointer

Task9 Fix1 source `6bd1099b4338cd154e8f1360db1e87fbe6fc2dae` addresses the two
Important findings from the fresh review of this original report. The current
authoritative author phase is [task-9-fix1-report.md](task-9-fix1-report.md), with
actual affected-component/browser verification, React checklist and retained
limits. Original source/evidence above remain historical; neither report itself
asserts independent acceptance or completed release.
