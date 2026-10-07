# Task 3 Checkpoint A — independent security / tenant / concurrency review

**Verdict: CHANGES_REQUIRED.** Three P1 findings and one P2 finding remain.

Reviewed BASE `ecf4b980bb254349a30af30d2f625afddaf30ad5` through HEAD
`6538fc70a8dc5d49d3a0812f18542730c49c381b` on `feature/lifecycle-recovery`.
This reviewer did not author implementation, delegate review, alter source, or
make Git changes. The only new worktree files are this report and its probe
artifacts. Existing controller progress changes were left untouched.

## Findings

### S1 — P1: authenticated callers can consume commit checks before lease expiry

Location: `migrations/2026-10-03-02-lifecycle-safety.sql:176-178`, with validation
at lines 141-170; identical definitions in `schema.sql`.

`z_validate_commit` is `DEFERRABLE INITIALLY DEFERRED`. An authenticated caller
can run `SET CONSTRAINTS ALL IMMEDIATE` while the lease is valid. That executes
already queued checks and makes subsequent receipt checks run at statement end.
The transaction can then outlive the claim and commit without any remaining
commit-time lease validation. No DDL, helper EXECUTE, forged identity, or service
claim-table write is needed for this bypass.

Fresh owned PostgreSQL 17.11 reproduction used a legitimate service-issued,
owner/job/scope/backend/transaction-bound reservation and a two-second claim;
after switching to the intended authenticated owner it set constraints immediate,
inserted an approval snapshot, waited 2.1 seconds, and committed successfully:

```text
expired_reserved_growth_committed True
committed_reviews 1
```

The deliberate wait is confined to the adversarial probe; the production clock
was not replaced. The existing expiry test changes the claim expiry with default
constraint timing, so it does not cover this legal caller operation.

Required correction: preserve an unavoidable final lease/generation check for
the supported direct-DML contract, including callers that change constraint
timing before or after receipt insertion. Do not weaken the approved
"expired claim cannot commit" guarantee into statement-time validation. Add
real authenticated and inherited-role regressions that naturally cross expiry
and verify the whole write rolls back on both supported PostgreSQL majors.

### S2 — P1: installing the global gate makes existing company HTTP paths block all lifecycle writers

Introduced at `migrations/2026-10-03-02-lifecycle-safety.sql:104-116` by gating
`companies`, `company_reviews`, and `classification_jobs`. Unadapted consumers:
`company_discovery/enrich_apply.py:83-98`,
`company_discovery/worker.py:197-209` and `315-332`, and the streaming backfill
pattern in `company_discovery/name_backfill.py:70-87`.

`enrich_selected` writes each completed enrichment and then waits for other HTTP
futures without committing. The first UPDATE now takes the transaction-wide
global gate. Every remaining slow board fetch therefore holds up Job writes,
private protections, account erasure, capacity/claims, and maintenance. This
regression applies immediately in the default legacy stage. The weekly ingest
path holds the gate from `upsert_candidates` before its first enrichment fetch;
the SERP loop likewise writes one result before issuing the next HTTP request
and provider-throttle sleep. A statement timeout does not bound idle Python
network time between SQL statements.

A fresh owned PostgreSQL 17.11 probe substituted two local network callbacks
into the real `enrich_selected` path. The second callback waited for the first
database write, then used another connection to attempt the exact gate:

```text
gate_available_during_second_network_callback False
writer_transaction_during_network_callback INTRANS
enriched_count 2
```

Required correction: extend the caller inventory to `company_discovery` and
separate all HTTP/model/sleep stages from database transactions and gate
ownership, preserving bounded writes and existing progress/rollback semantics.
Cover weekly ingest, enrichment, SERP grounding, classification/review read
transactions, and applicable streaming backfills using offline callbacks that
assert both an idle writer connection and successful gate acquisition by an
independent connection. This is required compatibility work from adding the
gate, not a request to implement a future lifecycle feature.

### S3 — P1: numeric JSON payloads bypass reservations and the physical guard

Location: `migrations/2026-10-03-02-lifecycle-safety.sql:243-257`, with the
physical check conditional on `NEW.bytes > 0` at line 151.

The generic payload classifier charges nonempty objects/arrays and strings but
ignores JSON numbers. Existing private JSONB payload columns accept numeric
scalars. An authenticated owner can therefore grow a package payload arbitrarily
within PostgreSQL's numeric limits without a capacity reservation. The receipt
records zero growth, so the physical-capacity check is skipped as well. Total
parsers on reads do not prevent the database storage allocation.

Fresh owned PostgreSQL 17.11 reproduction seeded a version-ready owned package,
enabled enforcement with the established test-only fixture, then executed as
its authenticated owner with no reservation:

```sql
UPDATE application_packages
SET resume_json = repeat('9', 100000)::jsonb
WHERE user_id = '<owner>';
COMMIT;
```

Observed:

```text
unreserved_numeric_payload {'kind': 'number', 'digits': 100000}
receipt_charge {'bytes': Decimal('0'), 'count': 1}
reservations 0
```

Required correction: account for every accepted JSON representation in payload
columns, or reject invalid shapes at an appropriate compatible boundary before
they allocate unreserved payload. Preserve flag-off compatibility and the
intentional no-growth protection exception. Add regressions for scalar JSON
numbers across the private JSON payload fields, normal objects/arrays, repeated
rewrites, and refusal of positive payload growth above the physical guard.

### S4 — P2: account erasure fences a different user's held reservation when a claim is shared

Location: `migrations/2026-10-03-02-lifecycle-safety.sql:461-468` and
`job_discovery/lifecycle/capacity.py:44-59`.

The binding API permits one service payload claim to issue held reservations
for users A and B. Erasing A fences the whole claim because A has a reservation
on it; the following UPDATE fences every held reservation on that claim,
including B's. There is no enforced single-subject-per-claim restriction.

The owned PostgreSQL 17.11 probe used the public claim/reserve/bind APIs for two
owners of the same shared Job, committed the bindings, and called
`lifecycle_forget_subject(A)`:

```text
other_user_reservation_after_erasure {'state': 'fenced', 'subject_id': UUID('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')}
shared_job_count 1
```

This is collateral cancellation of another user's operational capability; the
probe does **not** show deletion of B's committed private history or the shared
Job. The existing erasure test gives A and B different claims and misses this
allowed configuration. The committed held bindings model outstanding/crashed
capabilities, which the erasure contract also handles.

Required correction: enforce an ownership model that prevents a user erasure
from cancelling unrelated users' claims/reservations. If a capacity claim must
be exclusive to one subject, reject mixed-subject binding rather than silently
allowing it. Add the shared-claim/mixed-owner negative case and retain tests that
the erased user's stale callbacks fail and another user's history/Job survives.

## Scope and evidence assessed

The recovered approved design/implementation plan, complete Task 3 brief with
global constraints and binding amendments, author report, and full pinned review
package were the review basis. The package covers all 78 BASE..HEAD changed
files. The safety migration is an exact suffix of `schema.sql`.

The supplied final catalog records 42 FKs and 43 BEFORE STATEMENT gate tables,
covering both relevant FK parents and children, all seven Job children, typed
public relations, staging, operational state, and account roots/siblings.
Explicit FOR UPDATE/advisory callers in dashboard profile settings, usage,
generation, erasure, reviewer matching, legacy prune, and identity mapping were
checked for acquisition order. The company-consumer omission is S2 above.

The two private SECURITY DEFINER helpers have fixed `search_path=pg_catalog`
and only owner EXECUTE in the recorded ACLs. They read claim/reservation state
without privileged Job/user DML. Tests include actual anon/authenticated helper
call denial, original-statement RLS, forged reservation locators, wrong owner,
Job, scope, backend and transaction, direct receipt insertion, and inherited
authenticated permissions. The final receipt-insert privilege check uses actual
claim-table privilege rather than relying only on a role-name comparison.

Controls remain legacy/off/dry-run/never-activated. Ordinary legacy and collect
writes remain supported, enforced/archive readiness is deliberately unavailable,
archive-ever state is sticky, and active/paused fixture eventful writes fail
closed. No later outbox/export/readiness behavior is counted as missing Task 3
implementation. Capacity tests cover all held debt, expired reservations,
fencing-before-release, no DELETE credit, a real physical-over-cap fixture, and
zero-growth maintenance; S1 and S3 expose additional gaps. Version/snapshot and
cross-user protection tests cover approvals, corrections, packages, scores,
edits, generation and demand leases; demand grants exclude worker fields.
The bounded legacy feed/question spool keeps adapter HTTP outside transactions
and fails partial/overflow feeds without closure. Its changed commit timing is
documented and tested; S2 remains outside that repaired path.

Final author evidence is accurately scoped: 93 passing / zero skipped tests on
each PostgreSQL 17.11 and 16.15 after final receipt/inheritance/zero-growth
hardening; final dashboard DB 4 passing on each; 65 dashboard unit tests plus
TypeScript, affected ESLint, and Ruff success. The 290-test broad lanes preceded
the final small hardening changes and are not presented as final-head broad
runs. These results do not cover the four independent reproductions above.

## Independent probe artifacts and remaining gate

Scripts and captured observations are in `task-3-security-evidence/`:
`task3_security_probe.py`, `task3_network_probe.py`,
`task3_numeric_payload_probe.py`, `task3_erasure_probe.py`, and
`probe-results.txt`. Each script ran once through a fresh owned harness:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_security_probe.py
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_network_probe.py
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_numeric_payload_probe.py
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_erasure_probe.py
```

The durable script copies are byte-identical to the executed `/tmp` scripts.
All four launchers exited 0 and reported PostgreSQL 17.11. These are successful
bug reproductions, not passing security assertions. No existing suite was
needlessly rerun. No cloud/provider/production/paid calls, shared port 55432,
or shared/destructive dashboard feedback fixtures were used. The network probe
uses local doubles only; each harness cleaned its owned container.

Checkpoint A remains blocked on S1–S4, regression evidence, and independent
re-review of the forward fix commits. There is no environmental or authorization
blocker to the already authorized local corrections.
