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
