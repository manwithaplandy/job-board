# Task 1 independent safety/security and code-quality review

Verdict: **CHANGES_REQUIRED**

Reviewed base `e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d` through pinned head
`241ba32c1b5a815659c215b017b3d3afc304a6e0`. Read the task brief first, then the
implementation report and entire pinned review package. Verified that the
package's complete diff exactly equals `git diff --unified=10 BASE HEAD`, and
that current HEAD is the pinned head. The frozen SQL is byte-identical to base
`schema.sql`; its SHA-256 and all 47 migration inventory entries match the base.
No historical implementation or review results were used.

## Findings

### [P2] Failed creation can remove a container this invocation never owned

Location: `tools/lifecycle_test_db.py:162` (creation at lines 118–126).

The `finally` block unconditionally executes `docker rm --force --volumes NAME`,
including when `docker run` failed because NAME already existed. The returned
container ID is discarded, the label is never checked, and there is no creation
ownership check before removal. Consequently the failed-create branch can force
remove the conflicting container and its anonymous volumes, contrary to the
explicit cleanup-only-owned-resources requirement.

Offline reproduction replaced only `_docker` and the generated name. The fake
`run` raised `CalledProcessError(125)` for a name conflict; the runner returned 2
and still issued:

```text
['rm', '--force', '--volumes', 'poller-lifecycle-test-synthetic-existing-name']
```

The 96-bit random suffix makes accidental collision extremely unlikely; this is
a failure-path ownership defect, not evidence that a collision happened in the
recorded runs. Use the immutable ID returned on successful creation and verify
an invocation-specific ownership marker for any ambiguous failed/timed-out
creation before removing anything. A failed creation with an unrelated existing
name must never remove that object. Add a negative ownership regression.

### [P2] Command timeout does not bound descendants or their owned resources

Location: `tools/lifecycle_test_db.py:103` (also the nested runner exercised by
`tests/test_lifecycle_test_db.py:264`).

`subprocess.run(..., timeout=...)` kills and waits for the direct child on timeout;
it does not terminate descendants. A test command that launches a worker can
therefore return 124 with that worker still running. This matters in the existing
suite, which launches nested harnesses/containers: forcibly killing pytest can
also bypass a nested harness's `finally`, while the outer cleanup knows only the
outer container name. The current timeout test uses a single waiting process,
so it does not exercise this failure mode.

A narrowly scoped offline probe ran a synthetic Python child that forked one
waiting descendant, with the command deadline reduced to 0.5 seconds and an
unused synthetic loopback DSN. It performed no DB connection. Output:

```text
runner_returncode 124
owned_descendant_still_alive_after_timeout True
synthetic_descendant_cleaned_and_reaped True
```

The probe adopted, killed, and reaped its own descendant before returning.
Run commands in an owned process group/session, implement a bounded graceful
termination and forced termination path for the tree, and ensure nested
harness/container cleanup remains possible when the outer command expires.
Add a descendant timeout regression; killing the direct child alone is
insufficient.

### [P2] Catalog parity omits global default privileges

Location: `tests/lifecycle_helpers.py:115`.

The `default_grants` query inner-joins `pg_namespace` and requires
`nspname='public'`. Global default ACL entries have `defaclnamespace=0`, so this
query excludes them entirely. Such defaults also govern objects subsequently
created in public. For example, a migration containing only
`ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon` changes future
helper access without changing any existing function ACL; every captured
catalog section can remain equal and parity passes. The eight mutation tests
do not cover default privileges.

Include global defaults as well as public-specific defaults, retaining the
granting role, object type, and scope in the comparison, and add a real mutation
regression. Ensure bootstrap/rehearsal comparison does not inherit unnoticed
global defaults from an earlier run; dropping public does not remove global
default ACLs. This finding follows directly from the query's scope; no database
mutation was performed during review.

## Covered controls and evidence

- URI validation requires an explicit allowlisted loopback host, port, username,
  password, and test database; libpq parses the URI again, and query overrides,
  fragments, keyword/multi-host DSNs, and remote hosts are rejected. Required
  pytest startup clears ambient `PG*` defaults before collection/fixtures.
  Helpers recheck established host, host address, and database before their DDL.
- The child environment replaces both database variables and uses an allowlist
  for inherited variables. Model/tracing/provider/AWS environment credentials
  are excluded; OpenAI gets a nonfunctional placeholder, AWS metadata is disabled,
  and AWS config/shared-credential paths point to the null device. This is an
  environment guard, not a filesystem or arbitrary-command sandbox.
- Docker commands explicitly choose the local Unix socket and remove ambient
  Docker context/host variables. Normal provisioning publishes a random port
  only on `127.0.0.1`, generates a password, verifies the server major, bounds
  readiness/probes and command execution, and removes the normal owned container
  and anonymous volumes. The findings concern exceptional ownership and process
  cleanup paths.
- CI preserves PostgreSQL 16 and adds PostgreSQL 17. Required mode fails on
  missing/unsafe DSNs and both runtime and collection skips. Recorded current
  evidence shows 70 passing Task 1 tests and 899 passing full Python tests on
  each of PostgreSQL 17.11 and 16.15, with zero skips. These recorded covered
  tests were not rerun.
- The two-session proof asserts exactly two connections and distinct backend
  PIDs, shared committed rows, authenticated foreign-owner count zero, valid
  owner reads, and anon denial. The concurrent visibility proof uses Events
  with bounded waits. Existing RLS tests additionally cover foreign writes.
- Current catalog queries capture table/column grants, RLS flags and predicates,
  constraints/indexes, trigger definitions, helper definitions, security mode,
  function ACLs and `proconfig`; the global-default-ACL omission above remains.
- No later lifecycle business schema is expected or required for this review.

Review ran read-only product/Git inspection and two synthetic offline probes.
No Docker command was actually executed by the probes, no PostgreSQL server was
contacted, no shared port-55432 resources were modified, and no provider/cloud
calls or secret reads occurred. Only this review report was written. The three
findings are the remaining approval blockers.
