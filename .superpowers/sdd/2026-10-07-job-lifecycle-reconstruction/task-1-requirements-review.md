# Task 1 independent requirements and code-quality review

Spec: **FAIL**. Task code quality: **CHANGES_REQUIRED**.

Reviewed reconstruction base `e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d` through pinned head `241ba32c1b5a815659c215b017b3d3afc304a6e0`, in `/workspace/job-board/.claude/worktrees/lifecycle-recovery` on 2026-10-07. Read the entire Task 1 brief, current implementer report, and full pinned review package. The package's complete diff matches `git diff --unified=10 BASE HEAD` byte-for-byte apart from trailing whitespace/newlines. Working HEAD matches the pin. The only preexisting working-tree modification was the controller's `progress.md`.

Scope was the harness, required CI entries, pytest safety hooks, migration helpers/parity tests, and frozen fixture. Historical reviews/results were not acceptance evidence. No product/source/test code or Git history was changed, no agents were spawned, and no production, cloud, provider, deployment, or paid calls were made. Review commands used `/bin/bash`, `login:false`. This report is the only repository change made by this reviewer.

## Findings

### [P2] Global default privileges are invisible to the parity comparison — tests/lifecycle_helpers.py:114

The `default_grants` query inner-joins `pg_namespace` and restricts it to `public`. PostgreSQL stores global default ACL entries with `defaclnamespace = 0`, so this query discards them. Global defaults affect newly created public objects as well as schema-scoped defaults. A migration can therefore broaden future authenticated/anon access while the purported complete grant comparison still succeeds.

A fresh, owned PostgreSQL 17.11 mutation probe bootstrapped current `schema.sql`, captured `schema_catalog()`, executed `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO authenticated`, and captured the catalog again. The catalogs compared equal, while a direct query confirmed one global default ACL row. This is a demonstrated false negative, not merely missing regression coverage. Include both global and public-scoped default ACLs, represent their scope deterministically without OIDs, and add a real mutation assertion that this grant changes the comparison. Keep grant-option/grantee/grantor information when normalizing ACLs.

Missing acceptance evidence: a real isolated-DB mutation test proving a global default privilege change is detected by `schema_catalog()` and migration parity on the required majors.

### [P2] Object ownership changes can evade effective security parity — tests/lifecycle_helpers.py:95

The function query compares the definition, security-definer mode, configuration, and raw ACL, but omits `proowner`; the table and schema queries likewise omit their owners. Ownership supplies implicit privileges and determines the identity executing a SECURITY DEFINER function. Raw NULL ACLs do not encode that owner identity.

The same fresh local probe created a table with a NULL ACL and a SECURITY DEFINER function with a NULL ACL, captured the catalog, changed both owners to a test-only `NOLOGIN` role, and captured it again. The catalogs compared equal although a direct `pg_get_userbyid(proowner)` query returned the new owner. A future additive migration can thus disagree with the clean canonical schema about a privileged helper's execution identity without this test failing. Compare stable role names for function, relation/sequence, and schema ownership, alongside effective privileges; add independent table and SECURITY DEFINER owner mutation tests.

Missing acceptance evidence: real isolated-DB mutation tests proving table and SECURITY DEFINER function owner changes are detected, including objects whose ACL is NULL, on the required majors.

These findings block the requested complete effective catalog comparison. They do not invalidate the recorded passing executions of the current narrower test suite.

## Requirements assessment

| Requirement | Assessment and evidence |
| --- | --- |
| Task 1 scope and additive-only work | PASS. The pinned change adds test tooling, fixtures, evidence/report, and bounded CI/conftest edits. Canonical `schema.sql`, existing migrations, application code, and dashboard files are unchanged. One forward implementation commit is present; no lifecycle business SQL is prematurely introduced. |
| Frozen pre-change schema and inventory | PASS. Read-only checks independently established byte-for-byte equality between the fixture and `BASE:schema.sql`, SHA-256 `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6`, and exact agreement between the 47-file JSON inventory and the base Git migration tree. There are zero new migration files at Task 1. |
| Explicit safe test DSN before DDL | PASS. URI validation requires a loopback host, explicit port/user/password, and `poller_test` or `poller_lifecycle_test`; query overrides, fragments, remote/provider/production targets, and ambiguous DSNs are rejected. Tests assert rejection before connection/DDL and non-disclosure of password strings. `pytest_sessionstart` validates before fixtures and removes ambient libpq defaults before collection. New helpers also inspect established connection host/address/database before helper DDL. |
| Missing DSN and ambient production fallback | PASS for the required runner. Its default path creates an owned container and never reads ambient `DATABASE_URL`; the explicit existing-service path reads only `TEST_DATABASE_URL`. Both child DB variables are set to the validated isolated target. Optional direct offline pytest skips are clearly identified as exploratory, not DB acceptance. |
| Child credentials/provider isolation | PASS. An environment allowlist excludes ambient production/model/tracing/proxy/AWS/libpq credentials. A nonfunctional OpenAI placeholder supports SDK constructors; AWS config/credential files are redirected to the null device and instance metadata is disabled. Existing tests retain their offline doubles. No dotenv fallback was found in the reviewed Python application/test paths. |
| Independent same-schema sessions and RLS | PASS. `open_sessions()` opens distinct connections to the same database/public schema. The real tests assert exactly two sessions, distinct backend PIDs, shared committed seeded rows, authenticated foreign-user count zero, valid-owner visibility, and denied anon profile access. The concurrent visibility test uses bounded threading Events, with no sleep-based race guesses. |
| Owned Docker lifecycle and bounded cleanup | PASS for Task 1's specified launch/failure/timeout paths. A generated password, cryptographically unique container name, fixed local socket, random loopback-only published port, bounded Docker/probe/readiness/child operations, and finally removal of only the named container and its anonymous volumes are implemented. A real failure/timeout test asserts container and volume inventories are unchanged. Cleanup failure fails the lane. |
| CI preserves PostgreSQL 16 and adds mandatory 17 | PASS. The existing postgres:16 service, port 55432, and poller_test database are preserved. Its Python suite uses the sanitized explicit-service runner. The added PostgreSQL 17 lane runs the same harness and Task 1 migration/RLS/concurrency tests with required no-skip mode. Runtime and collection-time skips make the required lane fail; negative subprocess tests prove both. |
| Real 17/16 verification, actual versions, zero DB skips | PASS for Task 1. Current tracked evidence records PostgreSQL 17.11 and 16.15, 70 passed/zero skipped per dedicated lane, and 899 passed/zero skipped per full Python lane. The report distinguishes current major-17 proof from the historical production 17.6 patch. Reported lint and diff checks passed. Covered tests were not rerun by this reviewer. |
| Current flag-off/legacy schema compatibility | PASS at Task 1. No new lifecycle flags/triggers/enforcement/schema are installed, and schema bytes remain unchanged. The current 899-test suites on both majors include existing legacy jobs/reviewer/RLS tests and the unchanged current baseline. New controls/staged enforcement and stale-writer behavior across future intermediate schemas remain obligations of later tasks. |
| Sequential future migrations and reruns | PASS for established selection/rerun mechanics. The test starts from the immutable pre-change fixture, selects every migration outside its frozen inventory in filename order, compares against clean current schema, reruns SQL, and checks ledger timestamps/filenames. Existing mirrored recorded migrations are actually executed twice. Ordered probe migrations and a real SQL failure test cover ordering, ledger conventions, and rollback. No new migration at Task 1 is misrepresented as having executed. |
| Complete effective catalog parity | FAIL. Current coverage includes columns/defaults/nullability/identity, constraints, indexes, RLS flags/policies, table/column ACLs, schema-scoped/default grants, functions/proconfig/security mode/ACLs, triggers, and sequence definitions; eight mutations validate several categories. Global default grants and ownership changes are nevertheless demonstrably invisible, as detailed above. |
| Task 13 final safety/archive/dashboard file-set integration | PENDING, correctly scoped. The report explicitly states later lifecycle safety/activation and archive files do not yet exist and that Task 13 must run the final binding command plus dashboard DB tests on 17. No placeholder tests, fabricated runs, or integration acceptance for that future file set are claimed. This is not an additional Task 1 failure. |

## Current acceptance evidence used

The current reconstruction's `task-1-report.md`, `task-1-evidence/verification.json`, `postgres17-task1.txt`, `postgres16-task1.txt`, `postgres17-full.txt`, `postgres16-full.txt`, and `red-chronology.json` were read through the pinned package. The RED chronology is implementer-recorded evidence, not an independently replayed history. Offline `530 passed, 369 skipped` evidence was excluded from DB acceptance.

The only new execution was a narrowly targeted false-negative probe absent from existing mutation tests. It used a fresh owned PostgreSQL 17 container through `tools/lifecycle_test_db.py`; each mutation was rolled back, and the runner's normal finally cleanup completed with exit zero. Its output was:

```text
Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
Global default privilege drift missed: True
Global default ACL rows: 1
Table/security-definer owner drift missed: True
Current function owner: review_owner
```

The probe script lives only at `/tmp/task1-catalog-review-probe.py`; it does not modify repository tests. No unchanged covered suite was rerun. Both catalog findings require forward fixes and refreshed affected verification before Task 1 acceptance. Task 13 integration, independent security review, and the controller's checkpoint remain outside this review's completion claim.
