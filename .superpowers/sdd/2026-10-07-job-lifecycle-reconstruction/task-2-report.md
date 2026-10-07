# Task 2 — additive lifecycle identities and prerequisites

Author scope: Task 2 only, reconstruction from the approved recovered documents.
Dispatch BASE: `8d1e98424b08f076df736f962ec94f2bf5bd30b8`.
Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
Branch: `feature/lifecycle-recovery`. Sole implementation author; independent
requirements/security reviews belong to the controller after this handoff.

## Delivered behavior

- Ordered additive migration `2026-10-03-01-lifecycle-core.sql` and identical
  lifecycle definitions appended to `schema.sql`. No corpus UPDATE in the DDL.
  Frozen-baseline-plus-migrations versus clean-schema catalog parity includes
  tables, columns, constraints, indexes, RLS, grants, functions and triggers.
- Service-owned singleton controls with versioned flags, legacy/collect/enforced
  safety stages, durable archive activation history, archive stages, export flag
  and activation generation. All behavior flags default false, retirement dry-run
  defaults true. `read_control` has no environment/GUC override or missing-row
  default. The invoker-only control-history guard denies deletion/truncation,
  generation regression and history reset. It blocks enforced/archive activation
  until later reviewed migrations install their contracts. It is not the Task 3
  global DML gate or transition API.
- UUID source accounts/listings/versions, brands/skills, typed company-brand,
  company-source, job-location and job-skill relationships, reviewed identity
  assertions. Existing company INT and Job TEXT IDs/private FKs stay intact.
  `job_locations.location_id` references existing `locations(raw TEXT)`; no new
  canonical-location resolver or speculative brand/skill evidence.
- `migrate_identity_batch(conn, limit=500)` explicitly maps at most 500 Jobs per
  transaction in legacy or collect stage, followed by bounded remaining
  source-only boards. Enforced or ever-activated archive states fail closed until
  later reservation/claim/outbox integration exists. Its return count
  includes source-only identities when a batch has no remaining Jobs. Zero means
  no pending legacy identity mapping. Callers own commit/rollback and must start
  their short transaction with this helper. It enters the shared advisory gate
  (`0x4A4F424C494645`), acquires sorted `hashtextextended('lifecycle:job:' || id,0)`
  keys, then row/FK locks. Task 3 must reuse these namespaces.
- Persisted listing existence is the restart checkpoint. Rollback/reconnect/retry
  and migration reapplication do not duplicate records or reset frozen age.
  Legacy discovery anchors use original `first_seen_at` with explicitly local
  legacy provenance. Expiry uses 720 elapsed hours. Source publication and actual
  observation fields remain NULL, counters start at zero. Historical closures
  are retained as legacy evidence, not invented complete-source observations.
- One database-clock migration activation time is recorded by the first explicit
  mapping batch, not by schema installation. Existing populated caches receive
  that capture timestamp/provenance; absent descriptions remain NULL. No last-use
  timestamp is fabricated, and existing capture/use or observation evidence is
  not overwritten. Legacy timestamps and private records remain unchanged.
- `choose_anchor` uses aware trustworthy nonfuture publication or local discovery,
  normalizes UTC and rejects naive discovery/now inputs. `capture_version` is an
  intentionally write-disabled reserved interface: identical AND changed content
  return None. Task 2 does not claim real hash dedup/version allocation, readiness,
  capacity fencing or outbox pairing; those depend on Tasks 3/7/10.
- Nullable version/snapshot prerequisites exist on reviews, corrections, packages,
  generation, scores, edits and the early service-only demand queue. Composite FKs
  reject cross-Job version references; question snapshots reject scalar JSON;
  ready demands require a version. Existing legacy snapshots are not replaced or
  relabeled. Shared cache version references also enforce Job identity.
- Every new table has RLS and explicit revocation from PUBLIC/anon/authenticated.
  No client grants or SECURITY DEFINER function were added. Catalog and attempted
  client access/helper-call tests accompany real two-user legacy/private checks.

## Staged legacy compatibility

New listing-to-Job mapping FK uses ON DELETE CASCADE so existing legacy prune and
service DELETE can still remove pre-cutover unprotected Jobs after mapping. This
is a provisional mapping while the legacy path remains active, not a claim that
indefinite lean-identity retention is already enabled. Tests run the actual legacy
pruner on mapped rows and retain approved/corrected/package records and snapshots.
No existing private FK was weakened. No version producer is enabled.

Tasks 3/4 must reject identity DELETE at the reviewed cutover and atomically stop
legacy destructive prune before enabling identity-preserving maintenance. They
must not enable retention merely because Task 2 mapping has completed. The Task 2
activation barrier prevents premature enforced/archive activation. Earlier
unprotected deletions cannot be reconstructed; this implementation does not claim
to recover that history.

## Necessary compatibility files beyond the initial Task 2 list

The early `job_payload_demands` prerequisite stores user_id, so existing systemic
RLS and dashboard deletion/export inventories correctly failed when it first
appeared. Fixed those contracts minimally:

- `tests/test_rls_isolation.py`: explicitly declares the current service-only,
  no-policy demand contract. The existing catalog inventory remains strict.
- `dashboard/lib/userScopedTables.ts`: demands join the existing erasure registry.
  The existing `accountDeletion.ts` service transaction already performs each
  DELETE with the verified target user parameter. No new privileged importer or
  authenticated DELETE grant. Real owned-PG SQL tests use that actual registry,
  retain another user's demand and retain the shared mapped Job.
- `dashboard/lib/accountExport.ts` and its test: demand projection uses only the
  existing owner-scoped wrapper in its own transaction, excluding claim tokens.
  Since Task 2 grants no client read, export explicitly returns
  `job_payload_demands: null` and a generic `job_payload_demands_error`. Other export
  data remains available. It never claims an inaccessible table is empty, leaks
  raw permission/connection details or uses a privileged export bypass. Later
  reviewed owner access is required for complete demand export.

## Verification chronology

All database commands use `tools/lifecycle_test_db.py` and newly owned Docker
containers on random loopback ports. No shared setup service/port 55432 was used.
The harness strips ambient provider/DB credentials; all application data is
synthetic. Evidence filenames containing `green` or `final` are historical run
labels, not success assertions; their actual outcomes are listed here.

1. `red17.txt`: PostgreSQL 17.11; new missing module/schema contracts failed as
   intended: **10 failed, 19 passed**, no skips.
2. `green17-attempt1.txt`: first implementation **29 passed**, no skips.
3. `red-legacy-prune17.txt`: mapped legacy DELETE FK restriction and missing typed
   company-source evidence: **2 failed, 12 passed**, no skips. Fixed with the staged
   mapping cascade and explicit legacy association mapping, never private FK edits.
4. `green17.txt` / `green16.txt`: **87 passed, 1 failed**, no skips, on 17.11/16.15:
   existing systemic RLS guard correctly identified undeclared demand inventory.
5. `red-account-inventory.txt`: existing account table classification and new honest
   unavailable-export contract: **2 failed, 33 passed**. Minimal inventory/export
   fixes followed.
6. `final16.txt`: **88 passed, 1 failed**, no skips: new erasure fixture omitted the
   pre-existing required profiles.profile_version value. Corrected the fixture;
   no production behavior change was needed.
7. `final16-fixed-fixture.txt`: **89 passed**, zero skipped on PostgreSQL 16.15.
8. Strengthened mapped-row evidence before the final collect-stage adjustment: `accepted17.txt`, `accepted16.txt`.
   **89 passed, zero skipped** on each server. Actual versions:
   PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)** and PostgreSQL
   **16.15 (Debian 16.15-1.pgdg13+2)**. Durations: 30.53s / 37.58s.
9. `account-inventory-green.txt`: **36 passed** in the account deletion/export and
   service-role allowlist Vitest files. `typecheck.txt`: TypeScript exit 0.
   `ruff.txt`: repository-wide `ruff check .` exit 0. `git diff --check` passed.
10. `full17.txt` started before the erasure fixture correction: **930 passed,
    1 failed, zero skipped** (203.29s). The sole failure was
    `test_service_account_erasure_inventory_deletes_only_target_demands`, the
    omitted profile_version fixture value described above. After fixing it, both
    targeted lanes pass. The complete rerun, justified by that observed fixture
    failure, is recorded in `accepted-full17.txt`: **931 passed, zero skipped**
    on PostgreSQL 17.11 in 173.16s. This is explicitly **before** the final focused
    collect-stage guard adjustment below, not a claim about a full run at final SHA.
11. Controller staging clarification: explicit mapping must support legacy AND
    collect, while refusing enforced or sticky archive state. After the full run
    finished, focused `red-collect17.txt` proved the overly restrictive collect
    guard: **2 failed, 3 passed, 14 deselected**. Changed only the mapper stage
    allowance and focused tests; no new claim/capacity bypass or consumer enable.
    Final complete targeted 17/16 lanes are in `task2-final17.txt` and
    `task2-final16.txt`: **93 passed, zero skipped on each server**,
    PostgreSQL 17.11 / 16.15, respectively 32.88s / 45.57s. Both harness
    commands exited 0, and owned containers were cleaned up. This is the final
    source/test state verified for Task 2. No third broad suite was needed for
    the focused guard allowance; Task 13 retains the final whole-branch lanes.

### Exact verification commands

From the worktree, `/bin/bash`, `login:false`:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_identity.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_rls_isolation.py tests/test_prune.py tests/test_review_corrections_schema.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_rls_isolation.py tests/test_prune.py tests/test_review_corrections_schema.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_identity.py -k 'collect_mapping or mapping_refuses or control_history' -q
npm --prefix dashboard test -- lib/accountDeletion.test.ts lib/accountExport.test.ts
npm --prefix dashboard test -- lib/accountDeletion.test.ts lib/accountExport.test.ts lib/serviceRoleAllowlist.test.ts
npm --prefix dashboard run typecheck
.venv/bin/ruff check .
git diff --check
```

Each stdout/stderr log is in sibling `task-2-evidence/`; trailing whitespace was
normalized for Git hygiene without changing results. Reruns use the identical
commands shown above. Actual server versions are recorded by the harness header.

## Boundaries and remaining gates

- Task 2 only. No Task 3 implementation, subagents, independent author-self-review
  substitute, production mutation, activation, migration application to Supabase,
  provider API/paid calls, infrastructure/IAM changes, push/merge or deployment.
  No Railway files were changed.
- The mapper has no capacity reservation/claim protocol yet. Legacy/collect
  mapping is explicit and bounded; enforced or archive-active/ever-activated
  mapping is refused. Task 3 must integrate the later safety protocol.
- Version allocation/normalization, all-writer gate/fencing/readiness/capacity,
  automatic maintenance, hydration, feed consumers and outbox/export are future
  tasks. Task 2 nullable columns intentionally do not enforce new requirements on
  flag-off legacy private writes.
- Demand export remains explicitly unavailable until reviewed owner access exists.
  The queue has no application producer in this task.
- Did not run the special dashboard feedback/account-deletion DB suites whose
  destructive fixture guards target reserved port 55432/specific database names.
  They require safe harness adaptation in later scope. No skipped DB test is
  counted as acceptance here. Current account proof is owned-PG representative SQL
  plus existing nondestructive TS unit/inventory/type checks.
- Supabase/Postgres security guidance was read; official RLS docs confirmed the
  separate RLS/grant requirements. The web changelog Markdown fetch was unsupported.
  Supabase CLI was absent; the approved task's exact ordered migration filename
  takes precedence over the skill's CLI-generated naming workflow. Real PostgreSQL
  catalog/role tests were used locally; no linked-project advisor/API was called.
- Controller must independently review the complete dispatch BASE..HEAD diff for
  requirements and security before Task 3 begins. The final commit SHA is provided
  in the author handoff; no history rewriting was performed.

## Final author handoff

Implementation and evidence are committed together using the prescribed forward
commit message. The full immutable SHA is in the handoff response. Only Task 2
source/tests/migration/schema/report/evidence were staged; controller ledger,
dispatch and independent-review artifacts were excluded. No outstanding Task 2
test failure remains; independent review and later rollout gates remain required.
