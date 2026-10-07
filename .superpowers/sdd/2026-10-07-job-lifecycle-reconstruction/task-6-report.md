# Task 6 — full-corpus source reconciliation

Author BASE: `ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409`. Fresh sole author;
no author subagents or reviewer substitutions. Read the review-scope amendment,
release authorization, Task 6 brief/dispatch and repository instructions before
implementation. Task 5's accepted interfaces were used without replaying its
history. The cached upstream reference is recorded in the evidence; no remote
fetch, production access, provider crawl, paid/model call, deployment, activation,
merge, push, infrastructure/IAM or unrelated Railway change occurred.

## Implemented

All six adapters return `SourceResult`. Its `complete` property is false until
iterator exhaustion and remains false after errors, caps or unsafe pagination.
The four single-response public listing endpoints retain their established
response shape and request behavior; SmartRecruiters now streams pages instead
of losing earlier positives when a final page fails. Workday and SmartRecruiters
reject changed totals as absence evidence. Existing Workday partition/cap/wrap
handling remains conservative. `fetch_details=False` is accepted across all six;
Greenhouse/Workable request listing-only bodies, and Workday/SmartRecruiters do
not fetch per-job details. Legacy consumers still iterate the same Posting API.
Tests that indexed previous eager lists now explicitly materialize iterators.

`lifecycle/reconcile.py` supplies the five requested interfaces, plus bounded
posting staging and scheduled orchestration. It consumes the existing canonical
source/claim/staging/checkpoint schema and reservation interfaces; no migration,
SQL safety function, trigger, capacity guard, or RLS change was made. Every new
source write uses the established reservation/binding/settlement protocol even
before enforced cutover. Global gate and sorted Job locks precede Job mutation.
Network work starts after commits; request hooks renew and commit before HTTP.

Membership and positive sightings commit in at most 100-identity batches, keeping
multiple listing/member/Job effects under the 500-row business-write ceiling.
Staging retains the source ID and a small evidence-kind object (or an empty
object for an unadmitted ID); raw descriptions, questions and unused detail
payloads are not persisted. Existing Job IDs, private FK targets, first_seen,
frozen discovery anchors and expiration dates are retained. Positive observations
reopen the existing Job and clear misses. Unlisted means positive availability;
missing is unknown. Explicit removed/expired observations affect only the exact
validated source/listing identity.

Only complete successful enumerations supply misses. Two distinct successful
misses whose **completion timestamps** are at least 24 elapsed UTC hours apart
can close a listing; replay does not add a miss or sighting. The enumeration start
cutoff and listing membership/direct-verification sequence prevent older absence
from defeating a later positive. Empty with more than 20 prior open mapped jobs
is partial/suspicious, regardless of repeated emptiness. Failed/partial sources
retain previously committed positives but supply no absence.

Source attempts, complete-success timestamps, outcome, failure streak,
suspicious-empty streak and next-due times are separate from user matching.
Enabled boards are due after 24 hours. Failure-disabled retries back off through
1, 2, 4, 7, 7 days; a successful verification clears the streak without changing
exclusion state. Deliberate exclusions remain excluded. New legacy companies are
registered in bounded slices; inactive companies with unknown disable reasons
remain unknown rather than being guessed back into service.

The ordinary one-shot `run()` now branches on the persisted source flag before
legacy company ingestion, regardless of the capacity/admission outcome. The
source-enabled branch verifies the registered corpus and registers up to 100
new source accounts per cycle. It does not consult active matching users. It is
metadata-only pending Task 7 lean admission. With the flag off, existing legacy
cache admission, closure-above-guard, reviewer and pruning behavior remain on
the tested existing path. Source/retirement/archive flags remain at their defaults;
retirement stays dry-run. Supervisor/maintenance timings were not modified.

## Cursor, recovery and caller inventory

- `source_accounts.last_attempt_at`, complete-success time and deterministic ID
  order choose due sources. A large interrupted board moves behind untouched
  sources. Per-board budgets are 50 listing requests, 60 seconds of cooperative
  work, and 10,000 identities; a poll cycle is bounded to 100 boards/300 seconds
  of cooperative work. Inherited HTTP caveats below qualify wall-clock bounds.
- `source_enumerations`: immutable source/sequence/owner/generation; running,
  complete, partial and failed states; database start/completion/reconciliation
  times. Each interrupted mutable feed starts a fresh sequence at page zero.
  Old committed positives survive; partial pages are never concatenated into a
  supposedly complete membership snapshot.
- `enumeration_members`: exact external-ID primary key makes same-enumeration
  staging/sighting replay idempotent. No lifetime per-poll observation log added.
- `reconciliation_checkpoints`: lexicographic last external ID, committed count,
  generation and completion marker advance in the same transaction as effects.
  A fresh connection with the same current claim resumes committed reconciliation.
  A cancelled/reassigned feed must start a fresh enumeration; existing replay
  floors and Task 4 cleanup retain their established responsibilities.
- `source_accounts.reconciliation_cursor` mirrors chunk progress; the completed
  enumeration marker is written only after the last chunk. Partial/failed runs
  receive an empty completed reconciliation checkpoint without absence effects.
- Production call sites are `run()` -> `verify_due_sources()` -> adapter ->
  staging/completion/reconciliation; legacy `run()` -> `spool_feed()`; and
  `company_discovery.enrich.enrich_from_jd()`'s existing iterable consumer. The latter
  received an additional focused compatibility run. No source HTTP was added
  to the DB-only maintenance worker or reviewer supervisor.

Finite fixture bound: one huge source plus five small sources across all six ATS
families, repeatedly exhausting request **or** time budgets, gives every source
one turn in six fresh invocations, repeated for two cycles. The read-only storage
fallback rotates first position by database UTC day; for a fixed six-source due
set and one allowed turn, all six get an attempt within six fixture days without
changing source rows. A local test-only expression substitution exercises these
days; no production clock override exists. Worker-interruption fixtures verify
100 committed positives survive and the next worker starts at offset zero.

## Verification and chronology

Exact commands and server/tool versions are in `task-6-evidence/commands.txt`.
Every DB run used the accepted harness, newly owned loopback random-port
containers and the allowlisted test environment, never shared port 55432.
All successful lanes below had **zero skips**. All HTTP was replaced by local
fixture functions; no public-company or provider call was used.

- RED: missing reconciliation module produced the expected collection failure.
- First integration attempt: 78 passed/8 failed (fixture control activation
  generation and eager-to-lazy test expectations). Next: 132 passed/5 failed
  (remaining eager expectation and legacy connection doubles needing explicit
  source-off control). Next: 141 passed/3 failed (a checkpoint fixture accidentally
  triggered the >20 suspicious-empty rule plus two remaining control doubles).
- Corrected expanded lane: **159 passed** on PostgreSQL 17.11. Later reservation
  and time-budget-focused lane: **38 passed** on 17.11.
- Broad affected adapter/source/run/maintenance/supervisor/spool/service-order/
  question compatibility suite: **231 passed on PostgreSQL 17.11**, 134.78s;
  **231 passed on PostgreSQL 16.15**, 167.87s.
- Final ordinary refinements after the broad run: read-only exhausted request
  budgets report partial rather than failed; 24-hour qualification is based on
  successful completion time rather than enumeration start; added a read-only
  daily-rotation fixture. Narrow final source/completeness rechecks are recorded
  in `qualifying-completion-17.txt`: **43 passed on 17.11**, 67.68s;
  and `qualifying-completion-16.txt`: **43 passed on 16.15**, 54.97s. These
  final runs cover the current product source. The broad compatibility results
  above precede these two narrow refinements; no broad rerun is implied.
- Additional caller/rotation run: **36 passed on 17.11**, 4.33s.
- Ruff and working/staged whitespace checks are recorded separately. No new
  independent approval is inferred from any passing author test.

## Explicit limitations and downstream handoff

**Above-ceiling durable reconciliation is unresolved.** Existing
`claim_work()` rejects a first claim without headroom; `reserve_capacity()`
rejects forecasts above 6000 MiB; the existing enforced `lifecycle_validate_row`
charges changed source_accounts/source_listings/source_enumerations/staging rows
as growth even for operational counters/closure metadata. Task 6 does not weaken
those contracts. A bounded read-only full-feed attempt still runs, logs truthful
healthy/partial/failed plus storage-blocked/reconciliation-deferred, and never
certifies absence or calls a healthy source failed because persistence failed.
It cannot promise durable above-guard health/positive/closure progress, and new
unregistered accounts also require storage. The controller explicitly accepted
this as a functional/rollout limitation for later Task 10/13 integration review.
The six-day fallback fairness proof applies to a fixed registered due corpus.

**The shared HTTP transport contract is inherited, not repaired here.** The new
context applies no retries, a request-count budget, cooperative elapsed checks,
and a request timeout capped at 20 seconds. Existing `job_discovery.http` still
follows redirects and does not establish the global redirect/address revalidation,
10 MiB decompressed-byte, or strict whole-response wall-clock guarantees. Thus
cooperative budget tests are not proof of those transport guarantees. The
controller carried this explicit limitation to Task 9/13.

**Intermediate activation remains unsuitable.** Source-enabled polling defers
payload/admission growth until Task 7; existing cache growth stays on the legacy
flag-off path. Unknown legacy exclusion reasons remain excluded pending explicit
classification. Adapters with single-response endpoints have no fictional
multi-page fixture; pagination/final-page/cap fixtures apply to the two paged
families and single-response identity/malformed/empty fixtures to the other four.
Ashby latest-publication/unlisted fixtures establish frozen age behavior, not a
new source-publication history backfill.

This is author implementation and ordinary functional evidence only. Independent
source-correctness and requirements/quality review is pending controller action
under amended Checkpoint B, followed by Library 06. Task 3 is **not fully
security-approved**: independent expiry/capacity/cross-user/adversarial review
gaps remain deliberately unreviewed. No refused probe was reconstructed or
retried. No new safeguard rejection occurred. Controller owns final all-task
release; this author stops after the Task 6 forward commit.

## Fix 1 — R6-1, R6-2 and R6-3 ordinary functional corrections

Reviewed product BASE: `db73ad7365790419c4a1a82ec38ae21e4c7233c3`.
Read the entire independent `task-6-requirements-review.md`, whose verdict was
**Spec FAIL / Quality CHANGES_REQUIRED**. R6-1, R6-2 and R6-3 are valid findings.
Controller-only recovery commits `966fc38` and `3becce0` landed during this work;
they do not change the reviewed product base. This author leaves controller
ledgers, review reports and dispatches outside the fix commit.

### R6-1: completed membership is now a scheduled resumable responsibility

The existing staging trigger explicitly rejected any change of enumeration
owner/generation. A new source claim necessarily has a newer generation after
the old claim becomes terminal; therefore the old completed enumeration could
not resume through that contract. Reported that exact conflict to the controller
before touching SQL. The controller authorized the narrow ownership-only repair
using the existing validated newer same-source claim, with no claim, lease,
capacity, role/owner, GUC or privilege bypass.

Added `2026-10-03-02-source-reconciliation.sql`, ordered after accepted safety and
maintenance and before demand migration 03, with the same definitions appended
to `schema.sql`. It adds a pending-reconciliation index and revises only the
source staging contract. Enumeration ID/source/sequence remain immutable.
Ownership handoff is permitted only for an unreconciled complete enumeration,
with a newer currently validated same-source claim whose replay floor covers
the former generation. Every other enumeration field must remain unchanged
under JSONB equality: membership identity, start/completion times and cursor are retained.
A completed status cannot revert to running, and membership INSERT/UPDATE is
restricted to running enumerations. Existing fenced maintenance deletion remains
unchanged. No new privileged helper or security-definer function was added.

`resume_enumeration()` adopts that snapshot and changes the existing checkpoint
generation in the same caller transaction. The scheduler selects complete pending
reconciliation regardless of the next feed-verification slot; `verify_due_sources`
loads it before considering a new enumeration and performs no feed HTTP for
that resume. A committed nonterminal chunk may still release its claim on exit:
the next worker reclaims the source and resumes the same sequence/cursor instead
of counting the membership as a second successful observation. Claim-start order
also includes reconciliation-only turns, without changing the truthful last
feed-attempt or complete-success timestamps.

Two actual-entrypoint fixtures reproduced the original defect, then passed after
the fix. Each invocation discards its worker connection. For 205 listings and one
committed chunk per invocation, deadline exit progresses **100 → 200 → 205** in
three turns. Interruption after completed membership but before the first chunk
progresses **0 → 100 → 200 → 205** in four turns. Both retain the enumeration
ID/sequence/start/completion times, make exactly one HTTP feed call, and apply
one miss per listing. Existing unsafe partial-feed restart-at-page-zero coverage
continues to run. These are ordinary persisted source/caller tests, not a new
independent review of claim/expiry/capacity mechanisms.

### R6-2: source eligibility follows the authorized UTC cron slots

`next_due_at` now uses midnight UTC of the actual attempt date plus the applicable
1/2/4/7-day slot interval. Completion duration no longer shifts eligibility past
the next authorized daily 00:00 UTC invocation. Successful absence qualification
still compares the separate successful **completion timestamps** with 24 elapsed
hours; changing scheduling did not relax that condition.

Deterministic entrypoint fixtures advance only source scheduling/evidence clocks
in a test-local connection wrapper; claim/lease clocks and validators stay real.
Feeds take a nonzero 20 seconds, with a later 10-second duration. Healthy sources
are invoked at consecutive daily slots; failure-disabled sources follow the
1/2/4/7-day slots without extra-day slippage. The healthy second completion less
than 24 elapsed hours after the first does not close the Job; a later qualifying
completion does. No cron, supervisor schedule or new wake-up mechanism changed.

### R6-3: identifiable positives survive unrelated response defects

Greenhouse, Lever and Ashby now parse their already-received response items
incrementally through `iter_identified_postings()`. Good IDs yield immediately.
A repeated or unreadable identity marks the enumeration incomplete while other
trustworthy IDs survive. Identifiable items with malformed/missing display fields
yield minimal positives and mark the response incomplete; missing title/URL
still prevents new legacy admission. Greenhouse reported-total disagreement also
marks the response partial while preserving identifiable positives. Pure parser
APIs and healthy Posting shapes remain compatible; legacy spool consumers still
refuse absence for incomplete results.

Six DB entrypoint fixtures cover all three families with a good item followed by
a missing-title item or a duplicate. The good Job reopens and records exactly one
sighting, while no listing receives absence evidence and the enumeration is
partial. Existing malformed/duplicate fixture assertions now check retained
identities and false completeness instead of requiring the whole response to
throw before yielding. No raw detail payload persistence was introduced.

### Fix 1 evidence and remaining scope

All commands are appended to `task-6-evidence/commands.txt`; outputs prefixed
`fix1-` preserve the chronology. Fresh owned random-port PostgreSQL 17/16 use the
accepted harness, with no shared service, provider/API/paid/model calls. RED:
**8 failed** for R6-2/R6-3, then **2 failed** for R6-1. Initial green on 17.11:
**10 passed, 19 deliberately deselected**, zero skips. The focused compatibility
lane includes reconciliation, source completeness, the three changed adapters,
ordinary run integration and exactly two ordered-migration/catalog-idempotency
checks. It does not rerun unrelated broad maintenance, supervisor or Task 3
security lanes. Initial focused 17.11: **97 passed**, 137.03s. Final current-source
lane results follow below. A final small correction initializes the resumed
snapshot's known-complete verdict for truthful storage-deferred reporting; it
never certifies new membership or changes the preserved successful timestamp.

R6-4 (durable above-guard progress) and R6-5 (inherited bounded HTTP transport)
remain **unresolved functional/rollout blockers**, carried to downstream integration;
this fix does not waive them or establish full-spec acceptance. The minor
`closed_jobs` summary undercount remains for Task 13. Task 3's independent
expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed.
No refused probe/review was reconstructed, no subagents were spawned, and no
activation, deployment, publication, merge or infrastructure action occurred.
Only ordinary source handoff requirements/correctness review is requested next.

Final R6-1/R6-2/three-family R6-3 source: **97 passed on PostgreSQL 17.11**,
182.94s (`fix1-final-17.txt`), and **97 passed on PostgreSQL 16.15**, 182.58s
(`fix1-focused-16.txt`), zero skips. These runs include ordered migration/schema
parity and repeat idempotency. They precede the following explicitly authorized
adapter-only extension; the migration and run lanes were not rerun for it.

### Authorized remaining-family positive-preservation extension

While implementing R6-3, reported that Workable still validated the whole response
before its existing per-job fallback, and that SmartRecruiters rejected a whole
page containing a non-object while Workday collected page IDs via `item.get`
before yielding. The controller explicitly authorized the analogous narrow
all-family positive-preservation correction within Fix1. No broad parser rewrite
or independent mechanism/security review was performed.

Workable now uses the same per-item identity iterator with `shortcode`, retaining
its existing account-qualified minimal-Posting fallback and diagnostic. Missing
IDs and duplicates invalidate absence while good items survive; identifiable
malformed display fields keep a minimal positive and mark the feed partial.
SmartRecruiters skips non-object items with incomplete status instead of rejecting
the page before any yields. Workday's page-ID coverage helper marks malformed or
duplicate identities incomplete without throwing away valid peers; `_page_walk`
and the first/subsequent `_crawl` partition pages consume it. Existing raw page
counts, expected-total, cap/wrap, facet and conservative completeness behavior
remain in place. No detail persistence or extra network call was added.

Five additional DB regressions first failed: three Workable mixed-response cases
(missing title, duplicate, missing ID) and one same-page good/non-object case for
each paged family. After correction:

- **89 passed, 29 deliberately deselected on 17.11**, 3.98s: affected remaining
  adapters, source completeness and the five new DB cases.
- **6 passed, 28 deliberately deselected on 17.11**, 5.97s: the three original
  families' mixed-response DB cases after the shared helper extension.
- **95 passed, 23 deliberately deselected on 16.15**, 10.76s: those scopes together.

All were zero-skip runs. This chronology does not claim the earlier 97-test
migration/run suite was repeated after the adapter-only extension.

The new authorized completed-membership contract also exposed an old maintenance
fixture that inserted `status='complete'` before populating membership. Reported
this exact setup conflict; the controller authorized reordering that fixture
only. It now inserts running membership and then records the same completed
snapshot through the valid claim, retaining the original 23/25-hour cleanup
assertions. Only its two affected completed-window cases ran: **2 passed on
17.11**, 3.56s, and **2 passed on 16.15**, 2.56s, zero skips. No maintenance product
code, timing, cap, claim/expiry guard or broad maintenance/security lane changed.

Final Ruff and staged/working whitespace checks passed. Sanitized `fix1-*`
evidence preserves all failures and outcomes; only trailing whitespace and
explicit ephemeral fixture-token representations are normalized. No new
safeguard rejection occurred. R6-1–R6-3 are author-fixed and tested, awaiting
scoped independent re-review. R6-4/R6-5 and the deliberately unreviewed Task 3
gaps remain as stated above; no full-spec or full-security approval is claimed.

A transient executor failure occurred before staging: `Failed to create unified
exec process: exec-server transport disconnected`. The normal same-environment
read-only status check then succeeded with all files intact; staging resumed
through the same interface. This was transport recovery, not an approval-review
rejection or alternate-permission bypass.
