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
owned container and that container's anonymous volumes. Child failure and
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

## Current verification

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
commit adding this report and is returned in the implementer handoff; retrieve
it with `git log -1 --format=%H -- .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md`.
Independent spec/security/code review and Library checkpoint are pending the
controller's fresh review. Stop before Task 2.
