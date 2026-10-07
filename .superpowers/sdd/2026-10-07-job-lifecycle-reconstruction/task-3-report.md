# Task 3 — Checkpoint A safety foundation

Dispatch BASE: `ecf4b980bb254349a30af30d2f625afddaf30ad5`.
Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
Branch: `feature/lifecycle-recovery`. Sole implementation author; Task 3 only.
The controller owns independent requirements and security/tenant/concurrency gates.
No Task 4 work, production activation, cloud/project API calls, paid calls, IAM,
infrastructure changes, push, merge, deployment or history rewriting occurred.

## Delivered contract

`2026-10-03-02-lifecycle-safety.sql` is an additive, reapplicable migration and is
mirrored byte-for-byte at the end of `schema.sql`. Real catalog comparison covers
both clean schema and frozen baseline plus ordered/reapplied migrations, now
including private function definitions/ACLs and private schema ACLs.

One transaction advisory gate (`0x4A4F424C494645`, decimal `20916294442894917`)
is installed as a BEFORE STATEMENT trigger for relevant INSERT/UPDATE/DELETE and
TRUNCATE paths. Row validation additionally takes the same namespaced Job keys
as Task 2. Python `enter_gate`/`lock_jobs` acquire the gate, sorted keys, then row
locks. Dashboard `acquireLifecycleGate`, `withJobProtection` and the explicit
`withUserMutation` wrapper preserve owner-scoped RLS. Read-only dashboard wrappers
retain their existing behavior. Mutating transactions require READ COMMITTED so
a snapshot taken before waiting for the gate cannot authorize stale retirement.
Lock/statement timeouts are 2s/5s. Administrative DDL is not an application bypass
contract; owned fixtures explicitly use DDL to test otherwise-unavailable stages.

Claims persist opaque owner tokens, monotonically increasing generations and
replay floors. Acquisition, renewal, cancellation, binding, settlement and crash
recovery enter the same gate. Lease decisions use `clock_timestamp()`, with a
maximum 180-second lease; caller workers remain responsible for renewing within
30 seconds and respecting their task-specific deadline/lease. Expiry never frees
a reservation. Reassignment/cancellation first fences the old generation, then
releases its reservations. Compact claim fence rows cannot be deleted/truncated.
Deferred checks revalidate the live token/generation/lease at commit, including
transactions that began with a valid claim but expired before committing.

Capacity checks use `pg_database_size(current_database())` plus **all** held
reservation bytes, including expired leases, under the single gate. The ceiling
is unchanged at **6000 MiB / 6,291,456,000 bytes**. There is no DELETE credit or
logical-byte subtraction. Row receipts charge changed string/JSON payloads,
including same-size replacements, with conservative 4x payload plus overhead
forecasts; shared public metadata admission also has row overhead. Private
no-payload protection metadata is supported without a capacity reservation, and
the transaction row bound still applies. Zero-growth maintenance remains possible
above the ceiling; it does not provide DELETE credit. Initial maintenance/control
singleton claims may be created there so a full database can still be maintained
or paused. Other new claim identities require physical headroom. At most 500
counted mutations can be admitted per transaction; this can be stricter than 500
Jobs when a writer changes multiple records per Job. Forecasts do not claim a
byte-perfect allocation/WAL guarantee. Settlement records measured database size;
future admissions stop when physical usage plus held forecasts exceeds the cap.
`critical` does not bypass this physical ceiling (outbox reserve budgets belong
to Task 10).

A reservation capability binds the real invoking SQL role, JWT subject, Job,
table scope, owner token/generation, backend PID and xid8 transaction. The GUC is
only an untrusted reservation locator. Forging it, moving to another backend or
transaction, changing user/Job/scope, or replaying terminal reservations fails.
Append-only receipts provide cumulative budgets without privileged user/Job DML.
Clients cannot update/delete receipts, and direct receipt INSERTs are rejected;
the guard includes roles inheriting authenticated permissions. Invoker triggers
compute receipt totals, and private trigger functions only inspect claim and
reservation state. Both private functions have `search_path=pg_catalog`, explicit
EXECUTE revocation from PUBLIC/anon/authenticated, and no privileged Job/user DML.
Catalog inspection and attempted calls prove the grants; original DML remains
subject to the invoker's RLS. Existing privileged feedback/matching functions
retain their existing behavior, adding only gate acquisition before their locks.

Source enumeration/member/checkpoint tables persist progress with recovery and
terminal indexes. Staging callbacks require the current source claim and reject
sequences at/below the source replay floor. Source generations, enumeration
sequence and replay floor cannot regress. Cleanup/retention workers are Task 4;
this task does not invent or run those workers.

## Staged controls, protection and owner queue

Legacy and collect retain the old writes. Only enforced activates row capacity,
version-ready protection and retirement checks. An approval/protected write must
reference its Job's version and have shared description payload or a snapshot;
a ready question demand also needs version-matched questions or its snapshot.
Retirement or replacement/version-switch of shared payload checks approvals,
corrections, packages, scores, edits, pending generation, and unexpired demand
leases across all users. Lean identity deletion and unsafe rollback to legacy
pruning are blocked after cutover. Legacy destructive prune explicitly rejects
enforced mode. There is no fabricated historical version/use backfill.

Demand clients have owner-scoped SELECT/DELETE and column-scoped INSERT of
`user_id,job_id,kind` only. They cannot write worker tokens, generations, leases,
ready status, or snapshots. A separate database-generated `protection_until`
default gives new pending requests a bounded 180-second protection lease; old
rows are not assigned invented historical leases. A live or expired-but-unfenced
service claim prevents demand deletion. Account erasure first fences related
claims/reservations, removes operational subject links/receipts, then uses the
existing user-row registry; another user's state remains intact. Account export
continues its explicit owner-scoped demand projection and excludes claim tokens.

`transition_control` uses a current control/singleton claim and activation-
generation CAS under the gate. The SQL history guard protects direct DML too.
Archive activation remains unavailable until future migrations establish real
writer/producer and approved-destination readiness. Enforced cutover and live
retirement also remain unavailable until compatible writer/backfill readiness.
No readiness is inferred from `export_enabled`, the mapper, or successful tests.
Archive-ever history is sticky. Already-active fixtures can pause producers or
export, but eventful public DML remains blocked without the later outbox contract;
GUCs and export-only pause do not disable that enforcement. Task 10 must add
matching-event/budget/ack behavior and its own activation proof; no outbox rows or
export behavior are claimed here.

Task 2's explicit mapper now calls the shared gate API and retains sorted Job
locks. It works in legacy/collect and refuses enforced or archive-ever state.
No special reservation or outbox exemption was introduced.

## Pre-install inventory and caller changes

`task-3-evidence/pre-install-inventory.txt` captured actual frozen-current FKs and
grants **before** installing the gate. `caller-inventory.txt` records the source
search. `post-install-inventory17.txt` records actual final gate triggers, FKs,
client table/column grants, private helper definitions/ACLs and default controls.
The catalog test checks both FK parents and children of covered tables, so adding
a new relevant child/root without a gate fails the inventory test.

Covered paths:

- Jobs and all seven existing Job-linked children: job_questions, job_reviews,
  review_corrections, application_packages, resume_scores, cover_letter_edits,
  generation_jobs; plus owner demands and operational receipts.
- Source accounts/listings/versions, companies, locations, brands, skills,
  company-brand/source evidence, Job-location/skill evidence and assertions.
- Claims/reservations/enumeration members/enumerations/checkpoints and controls.
- Profiles and matching_activity (actual profile cascade), account_deletions,
  company reviews/overrides, classification_jobs, usage_counters, subscriptions,
  review_requests/review_runs, invite codes/redemptions/allowances, plan_overrides,
  and feedback. The existing application has explicit user erasure inventories;
  user_id columns do not have auth.users FKs. No imaginary auth root is assumed.

Explicit pre-lock integrations found in the inventory:

- Legacy prune previously selected Job/review rows FOR UPDATE before a gate.
  It now enters the gate, selects IDs, takes sorted keys, then row locks/recheck.
- Legacy Job batch upserts take sorted keys before executemany. The mapper uses
  the same protocol. Reviewer persistence reacquires sorted keys per short chunk
  and after rollback; matching eligibility gates before its activity-row lock.
- Dashboard profile-setting FOR UPDATE paths, generation creation, account
  tombstone/erasure, and allowance reservation acquire the gate first. Erasure
  acquires it before the existing feedback advisory lock. SQL resume_matching
  and submit_feedback likewise enter it before their own row/advisory locks.
- Existing direct approval/package/correction/score/edit mutations are covered
  at the statement boundary, preserving original grants/RLS in legacy/collect.
  Stale versions/growth fail after enforced cutover; compatible writer rollout
  and readiness validation remain Tasks 7/8/13.

The final explicit new grants are: authenticated SELECT on safe persisted control
flags (with a SELECT policy), authenticated SELECT/INSERT on own append-only
receipts (trigger-only inserts), and the restricted owner demand grants above.
No client claim/reservation/staging writes or private-helper EXECUTE were granted.
No required existing shared read was revoked.

## Legacy network-boundary compatibility

Installing the mandatory gate revealed that lazy adapters and question backfill
previously fetched HTTP between writes within a company transaction. Task 3
therefore adds a local temporary-file spool with limits of **100,000 rows,
64 MiB encoded bytes and a cooperative 120-second elapsed check**. Public records
are spooled before gated writes; memory retains the bounded ID set, one record
and at most a 500-row admission chunk. The deadline is checked at record/fetch
boundaries and does not claim to preempt an upstream blocked HTTP call. Public
fetch/redirect/decompression hardening remains Task 9.

Partial/failed/overflow feeds are discarded before writes and never authorize
closure. Successful complete feeds are written in short <=500-row commits.
A later database failure may leave earlier committed chunks, while closure is
never performed for an incomplete source feed. Counts reflect committed chunks.
Question HTTP runs after committing its discovery read and before any question
write. Failed individual question fetches remain retryable. Reviewer candidate
and deletion-check read transactions are closed before model work. Daily cron
and source discovery scheduling are unchanged.

The former test requiring a DB flush before lazy HTTP enumeration finished was
updated to assert bounded `[2,2,1]` chunks **after** five rows were spooled, retaining
the no-loss/finite-memory purpose. Added tests cover partial feeds, row/byte/time
limits and actual idle connection state during adapter/question callbacks.

## Verification and chronology

All DB runs used the accepted harness, newly owned containers on random loopback
ports, scrubbed ambient credentials and synthetic fixtures. Neither shared setup
port 55432 nor unchanged destructive dashboard feedback fixtures was used.
No skipped DB test is counted as evidence. Logs retain failed attempts and their
actual results; filenames such as `green`/`final` are run labels, not assertions.

- `red17.txt`: 14 failed, 2 passed; absent schema/module contracts before implementation.
- `green-attempt17.txt`: 14 passed, 2 failed; missing authenticated control SELECT
  policy. Added explicit read policy without any control writes.
- `green2-17.txt`: 83 passed, 2 failed; negative-test error wording and the now-
  explicit grant inventory needed updating. `green3-17.txt` records the temporary
  frozenset fixture syntax error during that update.
- `red-reservation17.txt`: 2 failures exposed unfenced reservation release and an
  undersized repeated-write test forecast. Added reservation integrity guards
  and corrected the test's conservative byte allowance.
- `red-staging17.txt`, `red-erasure17.txt`, `red-version17.txt`, `red-demand17.txt`,
  `red-receipts17.txt`, `red-inherited-receipts17.txt`: missing staging fences,
  operational erasure, question/version guard, pending lease/worker-field
  separation and direct/inherited-role receipt protections, respectively.
- `green4-17.txt`: 118 passed, 1 old streaming assertion failed. After adapting
  the assertion and adding explicit network-boundary proofs, `green5-17.txt`
  passed 122 and `green6-17.txt` passed 125, no skips.
- `legacy-consumers17.txt`: 137 passed, no skips, covering reviewer run/DB,
  matching inactivity, question fetch, Job/question DB and location resolution.
- `final17.txt` / `final16.txt`: 288 passed each, no skips, **before** final demand
  permission hardening. Versions 17.11 / 16.15; durations 178.17s / 227.94s.
- `accepted17.txt` / `accepted16.txt`: 290 passed each, no skips, including narrowed
  demand permissions, **before** the final direct/inherited receipt guard and zero-growth maintenance correction.
- `final-guards17.txt` / `final-guards16.txt`: 91 passed each, no skips, after direct
  receipt guard, **before** its inherited-role extension.
- `handoff-guards17.txt` / `handoff-guards16.txt`: 92 passed each, zero skips, after
  inherited-role receipt enforcement. `red-maintenance17.txt` then exposed an
  overly broad physical check that blocked even zero-growth maintenance.
- **Final source state:** `handoff-final17.txt` / `handoff-final16.txt`: **93 passed,
  zero skipped on each major**, respectively **40.91s / 54.90s**. This includes
  real allocated growth plus held forecasts above the ceiling, successful
  zero-growth maintenance/bootstrap, and continued refusal of new reservation
  bytes after retirement (no DELETE credit).
- **Final dashboard schema:** `handoff-dashboard17.txt` / `handoff-dashboard16.txt`:
  **4 passed on each actual major**, zero skips, after the last SQL change.
- `dashboard-unit.txt`: 65 passed, covering account deletion/export, DB wrappers,
  allowance usage, profile settings and service-role allowlist. `typecheck.txt`,
  `lint.txt`, `ruff.txt`: TypeScript, affected ESLint and repository Ruff exit 0.
  `git diff --check` passes. No full application build is claimed.

Actual owned server versions: PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)** and
**16.15 (Debian 16.15-1.pgdg13+2)**. The broad 290-test lanes precede the last small
SQL receipt guard and zero-growth maintenance correction; final focused lanes recheck every affected safety, activation,
migration/catalog, identity compatibility and RLS test on both majors. There is
no claim of a new whole-repository suite at the final commit.

### Exact commands

All commands from the worktree with `/bin/bash`, `login:false`:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k 'reservation_cannot_release or repeated_writes' -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k staging -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k forget_subject -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k ready_questions -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k pending_owner -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k direct_authenticated_receipts -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k inherited_authenticated -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py -k over_budget -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py tests/test_prune.py tests/test_run.py tests/test_lifecycle_legacy_spool.py tests/test_reviewer_run.py tests/test_reviewer_db.py tests/test_matching_inactivity.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_db_job_questions.py tests/test_locations_resolution.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_review_corrections_schema.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py tests/test_prune.py tests/test_run.py tests/test_lifecycle_legacy_spool.py tests/test_reviewer_run.py tests/test_reviewer_db.py tests/test_matching_inactivity.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_db_job_questions.py tests/test_locations_resolution.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_review_corrections_schema.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_safety.py tests/test_lifecycle_activation.py tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_rls_isolation.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- npm --prefix dashboard test -- lib/jobLifecycle.db.test.ts
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- npm --prefix dashboard test -- lib/jobLifecycle.db.test.ts
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/inventory_probe.py
npm --prefix dashboard test -- lib/accountDeletion.test.ts lib/accountExport.test.ts lib/db.test.ts lib/usage.test.ts lib/profileSettings.test.ts lib/serviceRoleAllowlist.test.ts
npm --prefix dashboard run typecheck
(cd dashboard && ./node_modules/.bin/eslint lib/jobLifecycle.ts lib/jobLifecycle.db.test.ts lib/accountDeletion.ts lib/accountDeletion.test.ts lib/accountExport.ts lib/db.ts lib/generationJobs.ts lib/profileSettings.ts lib/usage.ts lib/usage.test.ts)
.venv/bin/ruff check .
git diff --check
```

Supabase security guidance and official RLS documentation were read; changelog
Markdown fetch was unsupported. Only local SQL/harness operations were used;
no linked-project advisor, cloud migration or external provider execution was
performed. The exact approved migration filename takes precedence over the skill's
CLI-generated filename convention. Verification-before-completion guidance was
used for fresh final checks. No author-selected reviewer or subagent was spawned.

## Remaining gates

Independent controller reviews of complete BASE..HEAD are still required. Task 3
provides contracts and tested fail-closed stages, not writer readiness or rollout
authorization. Tasks 4–13 retain their specified cleanup, scheduling, source,
hydration, feed, outbox/archive and final end-to-end rollout responsibilities.
No new provider or user approval is needed to continue those authorized local tasks
once both controller gates pass. Production enabling remains separately gated.
