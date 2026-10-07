# Task 1 Fix Round 1 requirements and code-quality rereview

Spec: **PASS**. Quality: **APPROVED**.

No Critical/Important findings remain within this scoped rereview. Both catalog findings from `task-1-requirements-review.md` are resolved.

Reviewed base `241ba32c1b5a815659c215b017b3d3afc304a6e0` through head `a288a9ad290d45d557953c9133bc61482d571f08` in `/workspace/job-board/.claude/worktrees/lifecycle-recovery` on 2026-10-07. Read the full pinned `task-1-fix-1-review-package.md`, original requirements review, Task 1 brief, and appended implementer report. Independently checked that the package's complete diff matches `git diff --unified=10 BASE HEAD` apart from trailing whitespace/newlines and that working HEAD matches the pin.

Scope was resolution of my two original catalog findings and Critical/Important regressions introduced by the fixes. This was not a new whole-task audit. Previously accepted unchanged Task 1 requirements carry forward; later-task requirements remain pending.

## Resolution assessment

| Original finding | Resolution and supporting evidence |
| --- | --- |
| Global default privileges invisible to parity | Resolved. `tests/lifecycle_helpers.py:119` now includes `defaclnamespace=0` as well as public-scoped defaults through a LEFT JOIN. Entries contain stable owning role name, scope, object type, and full ACL text preserving grantee/grantor/grant-option information. `test_global_default_grant_migration_changes_catalog_parity` executes a real global default grant through `apply_migrations()` and requires the catalog to change with a global entry present. Its finally block restores the grant. Bootstrap also rejects inherited global default ACLs before any DROP, and a separate real regression confirms the original jobs relation survives this rejection. |
| Ownership changes invisible to effective security parity | Resolved. `tests/lifecycle_helpers.py:66`, `:101`, and `:116` compare relation/sequence, function, and public-schema owners using `pg_get_userbyid`. This supplies stable role names without tying comparison to OIDs. The parameterized real DB regression independently changes ownership of a table, sequence, SECURITY DEFINER function, and public schema; each asserts the relevant ACL remains NULL before and after the mutation and that the catalog changes. This directly covers the original false-negative mechanism. |

The new pre-DROP global-default guard is appropriately conservative for the clean isolated baseline and does not mutate inherited defaults or shared targets. Existing ACL comparisons and function definitions/proconfig/security mode remain present. The fixes do not alter the frozen schema/inventory, canonical schema, application code, CI configuration, or RLS policies.

## Introduced-regression review

The same pinned fix includes the other reviewer's ownership and process-timeout corrections. Inspected their changes for blocking regressions without reopening unchanged harness requirements:

- Container cleanup now verifies the invocation marker, validates immutable container identity, and deletes by that ID. Failed/ambiguous creation with an unrelated or unverifiable name cannot become a deletion target. Boundary regressions and a real stopped-container conflict test cover this scope.
- Child commands start in their own session/process group. Timeout and interrupted-command paths send bounded TERM/KILL cleanup to that group, reap the direct child, and verify no live group member remains. The Linux `/proc` implementation matches the selected Linux execution/CI environment. Signal handlers restore the caller's previous handlers. The shortened grace on signal interruption gives a nested runner time to execute its owned-container finally cleanup.
- Real regressions cover a SIGTERM-ignoring descendant and an outer timeout around a nested harness with a SIGTERM-ignoring command. Test cleanup uses only its acknowledged descendant PIDs/container IDs. No broad process or Docker cleanup was introduced.

No Critical/Important regression was identified in these changed paths.

## Verification accepted

Used the fresh author evidence in `task-1-evidence/fix-round1-postgres17.txt`, `fix-round1-postgres16.txt`, `fix-round1-red-chronology.json`, updated `verification.json`, and the Fix Round 1 report. Both required affected lanes run `tests/test_lifecycle_test_db.py`, `tests/test_lifecycle_migrations.py`, and `tests/test_rls_isolation.py` through the owned harness:

| Server actually recorded | Result |
| --- | --- |
| PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) | 82 passed, zero skipped, exit 0, 39.85s |
| PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) | 82 passed, zero skipped, exit 0, 46.68s |

The report also records passing Ruff and diff checks. It correctly labels the initial 899-test full-suite results as evidence for the initial commit and explicitly states the full suite was not rerun after this fix. The fresh affected lanes cover the changed catalog, process/resource cleanup, and existing RLS behavior; there is no need to repeat their unchanged executions for this rereview. No additional tests or database mutation probes were run by this reviewer.

No evidence is missing for resolution of my two original findings. This scoped PASS does not fabricate acceptance for Task 13's future safety/archive file set or dashboard DB tests; those remain pending as recorded in the Task 1 report. The controller's independent security rereview and checkpoint remain its own acceptance steps.

All reviewer shell commands used `/bin/bash`, `login:false`. No code/tests, product/source files, Git history, production/shared databases, cloud/provider resources, or external communications were changed. No agents were spawned. This review artifact is the only new repository file written by this reviewer during the rereview.
