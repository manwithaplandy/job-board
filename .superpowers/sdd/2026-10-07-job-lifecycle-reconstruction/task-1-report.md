# Reconstructed Task 1: isolated migration and concurrency harness

This report covers the current reconstruction only. Historical implementations,
tests and reviews are not evidence for this work. The implementation began on
`feature/lifecycle-recovery` at clean base
`e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d` in
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`.

## Scope and safety

Added `tools/lifecycle_test_db.py`, `tests/lifecycle_helpers.py`,
`tests/test_lifecycle_test_db.py`, `tests/test_lifecycle_migrations.py`, and the
frozen pre-change schema and migration inventory under `tests/fixtures/lifecycle/`.
Updated only the database safety/mandatory-skip hooks in `tests/conftest.py` and
the required database entries in `.github/workflows/ci.yml`.

The default runner creates a fresh `postgres:17` or `postgres:16` container on
the explicitly selected local Docker socket, with a generated password and a
random port published only on `127.0.0.1`. It never falls back to ambient
`DATABASE_URL` or reuses the existing local port 55432 service. Readiness is
bounded to 60 seconds, individual probes to 5 seconds, Docker creation to 180
seconds and child execution to 1,800 seconds. A `finally` removes only its unique
owned container and that container's anonymous volumes. Fix Round 1 below
adds invocation-marker verification and immutable-ID cleanup for failure paths.
Child failure and
timeout are exercised with real Docker, alongside unchanged-container and
unchanged-volume assertions.

Both child database variables point to the same isolated DSN. The child
environment uses an allowlist, removing ambient production/provider/model,
tracing, proxy and AWS credentials. It supplies a nonfunctional OpenAI test
placeholder, disables AWS instance metadata and redirects AWS credential/config
files to the null device; existing SDK tests use their offline doubles. The
existing CI PostgreSQL 16 service and port/database configuration are preserved
through `--existing-service`, which accepts only explicit `TEST_DATABASE_URL`,
sanitizes the child environment and performs no service cleanup. A new required
PostgreSQL 17 migration/RLS/concurrency job uses the owned Docker runner. Required
pytest lanes fail for skipped tests, including collection-time module skips.

DSN validation occurs before connections/helper DDL and before any pytest
fixture, including older fixtures with direct `DROP SCHEMA`. It permits only
`localhost`, `127.0.0.1`, or `::1`, an explicit port and credentials, and database
`poller_test` or `poller_lifecycle_test`. It rejects provider/production hosts,
remote/private/wildcard hosts, other databases, missing credentials/port,
multi-host targets, keyword DSNs, query overrides (`host`, `hostaddr`, `service`,
`options`), fragments and malformed targets. Errors omit credentials. Direct
pytest entry also clears ambient libpq `PG*` defaults before collection so
`PGHOSTADDR` and service files cannot override an otherwise safe URI. Helpers
recheck the established host, resolved loopback address and test database before
DDL. Tests prove rejection before connection/DDL, including a Supabase project
host and unsafe direct pytest startup.

Independent connections share the same database/public schema and committed
seeded rows; two distinct backend PIDs are asserted. Authenticated foreign-user
reads return zero rows, valid owner reads work and anon access is denied.
The concurrent visibility proof coordinates writer/reader using Events with
bounded waits; it does not guess races with sleeps.

No lifecycle business schema, lifecycle flags, migrations 1–4, production/cloud
writes, provider/paid calls, deployment, merge, push or activation were introduced.
`schema.sql` and dashboard files remain unchanged. Controller `progress.md`
edits are excluded from the implementation commit. No agents/reviewers were
spawned; independent review and Library checkpoint remain controller-owned.

## Frozen baseline and migration parity

Frozen file: `tests/fixtures/lifecycle/schema-before-lifecycle.sql`, copied
byte-for-byte from this reconstruction's pre-change canonical schema.

SHA-256: `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6`.

The adjacent JSON records the base SHA, immutable schema hash and all 47 existing
migration filenames. The test pins the frozen hash and retains the existing
`app_user_id()` search path. Future migration parity always starts with this
fixture, selects all migrations absent from the frozen inventory in filename
order, applies them, and compares against clean current `schema.sql`.

Catalog comparison includes tables, columns/types/defaults/nullability/identity,
constraints, indexes, RLS enabled/forced state and policy predicates, table and
column ACLs, schema/default grants, functions including definitions/security
mode/ACLs/**proconfig**, triggers, and sequence definitions. Eight real mutations
prove the comparison detects column, constraint, index, table grant, column grant,
function search-path, RLS-enable and RLS-policy drift. Existing recorded mirrored
migrations are actually re-executed twice rather than skipped by a ledger check;
catalog and `schema_migrations` filename/timestamp entries remain unchanged.
Ordered fixture migrations prove shared rows and filename recording; a real SQL
failure proves rollback and no ledger entry. Every helper validates its target.

At Task 1 there are zero new lifecycle migrations, intentionally. Baseline plus
future-migration selection and complete clean-schema parity are established now;
later tasks supply their additive SQL and matching canonical schema definitions.

## Tests-first chronology

All commands used `/bin/bash` with `login:false` and the ignored local `.venv`
dependency symlink. No old review/test results are reported as current proof.

1. Wrote the harness/session safety tests before implementation.
   `python -m pytest tests/test_lifecycle_test_db.py -q` failed with
   **31 failed, 4 skipped in 0.25s**, asserting the isolated harness was absent.
2. Wrote frozen-schema/parity tests before helper/fixture implementation.
   `python -m pytest tests/test_lifecycle_migrations.py -q` failed with
   **1 failed, 12 skipped in 0.05s**, asserting the pre-change fixture was absent.
3. Implemented the runner/helpers/fixture and safety hooks. One intermediate run
   exposed a test import-location error (`open_sessions` belongs to
   `tests/lifecycle_helpers.py`); corrected the test. An initial real launch
   exposed libpq treating `service=''` as a service lookup; replaced readiness
   with a driver probe in the sanitized child environment. That failed launch
   was cleaned up and is not acceptance evidence.
4. Added direct-entry libpq-override and existing-CI-entry regressions before
   implementing their behavior. On owned PostgreSQL 17, the filtered run failed
   with **2 failed, 37 deselected in 0.50s**: ambient PG defaults survived direct
   pytest entry and the explicit CI entry was absent. Implemented both paths.
5. Added anonymous-volume cleanup proof before changing cleanup. Real child
   failure and timeout then failed with **1 failed, 38 deselected in 12.28s**:
   containers were removed but their two anonymous volumes remained. Added
   `--volumes` to exact-container removal; the same proof passed with
   **1 passed, 38 deselected in 11.08s**.
6. Added a collection-skip regression before extending the mandatory-skip hook.
   A module skip plus a passing test incorrectly returned success; the outer run
   failed with **1 failed, 1 passed, 38 deselected in 0.93s**. The hook now handles
   both collection and runtime skip reports; final lanes include both cases.

During local development, 11 anonymous test volumes from the earlier cleanup
implementation were removed only after recorded Docker event metadata proved
every observed mount belonged to our uniquely named, labeled owned test
containers and a fresh per-volume check proved none remained mounted. Cleanup
used those exact volume IDs, with no prune and no unrelated/shared deletion.
The current runner cleans its own volumes in `finally`.

## Initial verification at 241ba32 (before Fix Round 1)

Shell setup for the commands below:

```bash
export PATH="$PWD/.venv/bin:$PATH"
```

| Actual command | Actual result |
| --- | --- |
| `python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_test_db.py tests/test_rls_isolation.py -q` | PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2); **70 passed, zero skipped**, fresh final run 21.83s |
| Same command with `--postgres-major 16` | PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2); **70 passed, zero skipped**, 26.68s |
| `python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest -q` | PostgreSQL **17.11**; **899 passed, zero skipped**, 92.45s |
| `python tools/lifecycle_test_db.py --postgres-major 16 -- python -m pytest -q` | PostgreSQL **16.15**; **899 passed, zero skipped**, 121.14s |
| `python -m pytest -q` without a test DSN | **530 passed, 369 expected database skips**, 11.29s; exploratory offline baseline, **not integration acceptance** |
| `.venv/bin/ruff check .` | Passed |
| `git diff --check` | Passed |

The full suite contains the controller's original 846 tests plus 53 new Task 1
tests. The dedicated lane contains 34 non-DB checks and 36 actual DB checks;
all tests execute in required mode. Required-lane negative subprocess probes
deliberately return a failing exit status for unsafe/missing DSNs and skipped
required tests; their outer tests assert those failures and pass.

Sanitized current output and RED chronology are tracked in `task-1-evidence/`.
No environment secrets or database data/dumps are included.

## Limits and handoff

The actual Docker servers are 17.11 and 16.15; this establishes current major-17
parity plus major-16 compatibility, not a claim of testing the historical 17.6
production patch version. Docker/local socket is required; unavailable Docker,
server-major mismatch, readiness timeout or failed cleanup fails closed.

The multi-task binding command naming lifecycle safety/activation and archive
files is not runnable at Task 1 because those later-task files do not exist yet.
This task's real migration/RLS/concurrency harness tests are mandatory on both
majors. No placeholder tests or fabricated skips were added for future work.
Task 13 must run that final prescribed file set and dashboard DB tests on 17.

All commits are forward-only; no amend/reset/rebase is used. Final SHA is the
latest implementation commit returned in the implementer handoff; retrieve
it with `git log -1 --format=%H -- .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md`.
Independent spec/security/code review and Library checkpoint are pending the
controller's fresh review. Stop before Task 2.

## Fix Round 1 — four reviewed blockers

Fix base: `241ba32c1b5a815659c215b017b3d3afc304a6e0`. Read both fresh pinned
reviews in full before changing code. Their unique in-scope findings were:

- Security: **[P2] Failed creation can remove a container this invocation never owned**.
- Security: **[P2] Command timeout does not bound descendants or their owned resources**.
- Both reviews: **[P2] Catalog parity omits global default privileges** /
  **Global default privileges are invisible to the parity comparison**.
- Requirements: **[P2] Object ownership changes can evade effective security parity**.

### Tests-first failure evidence

Added regressions before fixes and ran on owned PostgreSQL 17.11:

```bash
python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
  tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
  -k 'creation_cleanup or sigterm_ignoring or outer_timeout or global_default or inherited_global or implicit_owner' -q
```

Result: **11 failed, 53 deselected in 9.91s**, exit 1. The failures reproduced:
unowned conflict cleanup; immutable-ID requirements for ambiguous/successful
creation; a real SIGTERM-ignoring descendant remaining alive; nested container
cleanup bypass; invisible global defaults; unnoticed inherited global defaults
during bootstrap; and NULL-ACL owner changes for a table, sequence, SECURITY
DEFINER function, and public schema. Negative Docker-boundary doubles performed
no actual Docker mutation. Real RED timeout probes adopted/reaped only their
acknowledged descendant PIDs and removed only their acknowledged nested container
IDs, so the regression runs did not leave resources behind.

After the initial fixes this same 11-test selection passed in 10.76s. A stronger
nested timeout case then installed SIGTERM-ignore in the nested command. It
reproduced a timing defect before correction:

```bash
python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
  tests/test_lifecycle_test_db.py -k outer_timeout -q
```

Result: **1 failed, 44 deselected in 18.58s**, exit 1. Equal outer/inner grace
windows allowed the outer forced termination to interrupt the nested runner's
container `finally`. Shortening signal-interrupted nested child grace fixed the
case. A further real, stopped-container name-conflict proof was added to verify
the Docker-boundary negative probe against actual Docker. The real conflict,
forced descendant and stronger nested timeout selection passed **3 tests,
43 deselected in 16.08s**.

### Resulting behavior

Each creation includes an invocation-specific owner marker. The runner retains
the immutable container ID returned by successful `docker run`. Cleanup inspects
only ID and marker, never the container environment/password, and removes by
immutable ID only after the marker matches this invocation. Failed or timed-out
creation can recover its own container by name only when the marker proves
ownership; an unrelated conflicting name is preserved. A missing/unverifiable
failed-create target is never deleted. Real conflicting-container and ordinary
failure/timeout tests verify cleanup remains scoped to owned resources.

Commands now run in their own session/process group. Timeout sends SIGTERM to
that group, allows a bounded 10-second grace, then uses SIGKILL for remaining
live members and bounded forced-exit checks. The direct child is reaped; real
descendant tests temporarily adopt/reap their own child PIDs. Linux `/proc`
membership/state checks exclude already-dead zombies. Normal command completion
also cleans any surviving members of its group. SIGTERM/SIGINT handlers unwind
nested harness cleanup instead of bypassing `finally`, and restore caller
handlers afterward. A signal-interrupted nested runner limits its child's grace
to one second, reserving the outer grace window for its own container cleanup.
The real nested proof uses a SIGTERM-ignoring command and asserts both its
container and process disappear. Forced cleanup failure fails the lane.

Catalog defaults now include both `defaclnamespace=0` global scope and
public-specific scope, with stable role names, object type, scope and full ACL
text retaining grantee/grantor/grant-option information. Bootstrap refuses any
inherited global defaults before `DROP SCHEMA`, because global defaults survive
that drop and could contaminate both comparison builds. The real migration
probe changes only a global default grant and must change parity; its cleanup
restores defaults before subsequent fixtures.

Relation/sequence, function and public schema owners are compared as stable
role names, alongside existing ACL comparisons. Independent real DB probes
assert ACLs are NULL before and after each owner change and prove table,
sequence, SECURITY DEFINER function and schema ownership changes affect parity.
The frozen schema bytes/hash and 47-file inventory remain unchanged.

### Fresh covering verification

```bash
python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
  tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
  tests/test_rls_isolation.py -q
# Same command with --postgres-major 16.
```

| Fresh lane | Result |
| --- | --- |
| Owned PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2) | **82 passed, zero skipped**, 39.85s, exit 0 |
| Owned PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2) | **82 passed, zero skipped**, 46.68s, exit 0 |
| `ruff check .` | Passed |
| `git diff --check` | Passed |

This fix refreshes all affected harness/migration/RLS tests on both required
majors. The initial 899-test full-suite results remain prior initial-commit
evidence, not a claim that the full suite was rerun after these fixes. No broader
baseline repeat was needed: the focused lane covers the changed process/resource
paths and catalog comparison plus existing RLS compatibility, and exposes no
unresolved failure. Fix output/chronology is tracked in `task-1-evidence/`.

Only Task 1 tooling, its tests, this report and sanitized evidence are changed.
No fixture/schema/application/CI change, broad Docker cleanup, cloud/provider
call, or commit rewrite is made in this fix. Controller progress, review package
and review artifacts are excluded from the forward commit. Fresh independent
scoped rereview and Library checkpoint remain controller-owned and pending.

## Fix Round 2: nested cancellation and prior-harness collision

Forward fix base: `a288a9ad290d45d557953c9133bc61482d571f08`. This round
addresses only the two residual original security findings in
`task-1-fix-1-security-rereview.md`: “Outer cancellation can interrupt an inner
timeout cleanup” and “A prior harness name collision also collides with its
marker.” The reviewed global-default and NULL-ACL owner parity fixes are
unchanged, as are the frozen schema, migration inventory, application and CI.
The final forward commit SHA is returned with completion; this report and
evidence are included in that commit.

### Tests-first chronology and phase diagnosis

Before changing the runner, added the review's failed-creation/prior-harness
marker reproduction, a real nested process reproduction, and a real collision
between two invocations of this harness. The nested process probe acknowledges
entry into the inner runner's actual timeout cleanup before outer cancellation;
the worker ignores SIGTERM, and a second real SIGTERM is delivered while the
first handler is returning. It requires that the worker be terminated and
reaped. Cleanup behavior is not mocked. The collision proof creates a real
owned database through the first harness, forces the second harness to request
the same name, and verifies that the first immutable ID survives.

```bash
PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
  python -m pytest tests/test_lifecycle_test_db.py \
  -k 'prior_harness_name or during_inner_timeout or two_real_harness' -q
```

On PostgreSQL **17.11**, RED was **3 failed, 46 deselected in 5.15s**, exit 1.
The failures proved prior marker acceptance, a surviving inner worker, and
deletion of the prior real harness container. The RED probes removed/reaped
only their exact acknowledged IDs/PIDs and left no owned resource behind.
After the runner fixes, the same selection was **3 passed, 46 deselected in
10.30s**, exit 0.

The first covering PostgreSQL 17 run then produced **1 failed, 84 passed,
zero skipped in 56.21s**, exit 1. The existing ordinary nested timeout test
never created `nested.json` or printed the nested database version: its
eight-second outer deadline expired before the nested command acknowledged
startup. Read-only Docker events showed that nested container started at
05:49:01.621 UTC and was destroyed at 05:49:04.786 UTC. These timestamps alone
do not measure individual readiness probes.

A separate real phase observation kept the same eight-second outer deadline:

```bash
PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
  python /tmp/lifecycle-task1-fix2-phase-probe.py
```

It measured Docker creation at **4.777s** and successful database readiness at
**6.943s** after nested creation began. The command started in that probe,
outer return was 124, and exact owned cleanup completed at 9.413s. Combined
with the missing readiness/command acknowledgement in the failed run, this
established that the old fixed deadline could target startup rather than the
intended command-cleanup phase. Sanitized phase rows and the exact diagnostic
script are preserved in `task-1-evidence/fix-round2-phase-probe.json` and
`fix-round2-phase-probe.py.txt`; no Docker arguments, environment or credentials
were recorded.

The ordinary nested regression now acknowledges the actual running child with
an Event before invoking real outer cancellation. Its observation wrapper has
a bounded wait and always runs actual cleanup before asserting phase success.
The production execution/readiness/grace constants are unchanged. A separate
real Docker regression acknowledges the owned immutable ID after creation and
port publication, then cancels before readiness or command execution; it
asserts the command never started and the container disappeared. Thus both
startup cancellation and cancellation of the running SIGTERM-ignoring child
retain explicit coverage.

### Resulting behavior

An independent 192-bit random invocation marker replaces the marker derived
from the generated container name. A failed name collision cannot authorize
cleanup of a prior invocation, including another invocation of this harness.
Successful and ambiguous creation still require the same exact marker and
immutable-ID checks before removal.

Process-group cleanup temporarily defers SIGTERM/SIGINT, including repeated
signals, until termination and reaping finish. Cancellation during an existing
timeout cleanup shortens the remaining grace to immediate escalation, then
propagates after bounded cleanup. This closes the sibling-exception-handler
gap without restarting the grace window. Owned container cleanup also defers
handler exceptions until its bounded cleanup completes and restores the
caller's handlers. The real repeated-signal test proves the worker disappears
before the outer runner returns.

### Fresh covering verification

```bash
PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
  python -m pytest tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
  tests/test_rls_isolation.py -q
# Same command with --postgres-major 16.
PATH="$PWD/.venv/bin:$PATH" ruff check .
git diff --check
sha256sum tests/fixtures/lifecycle/schema-before-lifecycle.sql
```

| Fresh lane | Result |
| --- | --- |
| Owned PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2) | **86 passed, zero skipped**, 53.97s, exit 0 |
| Owned PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2) | **86 passed, zero skipped**, 63.40s, exit 0 |
| `ruff check .` | Passed |
| `git diff --check` | Passed |
| Frozen schema SHA-256 | Unchanged: `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6` |

These affected lanes include the complete migration/catalog parity and RLS
compatibility checks. Initial full-suite results and Fix Round 1 results above
remain evidence for their respective earlier commits; the full suite was not
repeated for this scoped fix. There is no outstanding failure in either fresh
lane. Only Task 1 runner/tests, this report and sanitized evidence are included;
controller progress and review artifacts remain excluded. No shared Docker
cleanup, production/cloud/provider calls, schema changes or history rewrite
occurred. Fresh independent scoped security review and the verified checkpoint
remain controller-owned before Task 2.
