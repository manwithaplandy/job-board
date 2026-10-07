# Task 2 independent requirements and quality review

Spec: **PASS**

Quality: **APPROVED**

Reviewer: independent requirements/quality reviewer; not the implementation author.
Review date: 2026-10-07. Task 2 only; this verdict permits the controller to
proceed to Task 3 review/implementation, not activation or production mutation.

## Pinned scope and method

- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
- Branch: `feature/lifecycle-recovery`.
- BASE: `8d1e98424b08f076df736f962ec94f2bf5bd30b8`.
- HEAD: `b0fc09a0012b06bc6e16262b641a08a37ccc3ca1`.
- Read repository `AGENTS.md`, `CLAUDE.md`, and `dashboard/CLAUDE.md`.
  The root reference to `dashboard/AGENTS.md` points to an absent file; dashboard
  instructions are available in `dashboard/CLAUDE.md`.
- Reviewed the approved design, approved implementation plan, complete Task 2
  brief including global constraints and binding amendments, author report,
  complete pinned review package, changed implementation/tests, and evidence.
  Reviewed related legacy schema, migration harness, account deletion and
  owner-scoped database wrapper to assess compatibility.
- Independently verified the package's complete diff equals
  `git diff --unified=10 BASE HEAD`. The full range contains one forward commit
  and 32 changed files; no last-commit-only selection omitted an intermediate
  Task 2 change. Reviewed all product changes in that full range.
- Independently verified the appended lifecycle SQL matches migration definitions
  exactly, with only the migration's outer `BEGIN`/`COMMIT` omitted from schema.sql.
  Fresh `git diff --check BASE HEAD` exited 0.
- Read-only product/Git review. No cloud/production calls, shared setup database,
  implementation edits, Git mutations, test-suite reruns, or additional agents.
  No uncovered specific uncertainty required an independent database probe.

## Requirements assessment

| Requirement | Assessment and supporting implementation/test evidence |
| --- | --- |
| Additive ordered SQL, no whole-corpus DDL backfill | PASS. Migration 01 creates prerequisites and adds nullable columns; its only data inserts are singleton control and migration ledger. Explicit mapping owns bounded data work. `test_lifecycle_ddl_does_not_backfill_or_reset_legacy_rows` exercises legacy rows, rerun and ledger/control persistence. |
| Clean schema/migration parity and idempotence | PASS. SQL definitions mirror; real catalog parity covers columns, constraints, indexes, functions, triggers, grants and RLS, and repeat migration application. |
| Existing Company INT / Job TEXT identities and private FKs | PASS. Existing keys, timestamps and private FK definitions are not altered. Private version references are additive, nullable composite FKs. Actual legacy upsert and private writer statements are covered. |
| Source accounts/listings, compact versions and typed relations | PASS. UUID public identities, source coordinates, revision/hash/claim/lifecycle fields and focused indexes exist. Initial source mapping is explicit legacy association, not guessed employer consolidation. |
| Existing locations and empty dictionaries | PASS. `job_locations.location_id TEXT REFERENCES locations(raw)` reuses the existing table. Mapping invents no brand/skill facts; the empty dictionary and unknown valid-time cases are tested. |
| Reviewed identity assertions | PASS. Relation/status/evidence domains, concrete listing FKs, non-self relation and reviewed-public evidence for accepted assertions exist. Cycle/conflict validation and live assertion mutator belong to Task 7; no such writer is enabled by Task 2. |
| Early service-owned controls before safety/outbox enforcement | PASS. Versioned flags, safety/archive stages, sticky history, export flag and activation generation are installed now. Defaults are off/dry-run. `read_control` reads persisted state without environment/GUC fallback. Client write/execute attempts are denied. |
| Durable activation history and safe intermediate barrier | PASS. Migration lines 28–62 protect singleton history, prevent generation regression/history clearing, and refuse enforced/archive activation before later contracts exist. This is an invoker-only control guard, not a premature replacement for Task 3's gate/readiness API. |
| Bounded explicit legacy AND collect mapping | PASS. `identity.py:36` validates integer limits 1..500, takes the common global gate, sorted namespaced Job keys, then row/FK locks. Source-only boards are also bounded and counted, so zero means mapping complete. Enforced or archive-ever-activated mapping is refused at lines 50–55. |
| Restart/rollback idempotence | PASS. Persisted listing existence checkpoints committed work; rollback retries and fresh-connection restart are tested. Rerun does not reset mapped anchors, counters, source evidence or cache stamps. |
| Frozen local legacy anchor and elapsed UTC boundary | PASS. Mapping uses unchanged first_seen with `legacy_local_observation`; expiry is 720 elapsed hours. `choose_anchor` normalizes aware values, accepts nonfuture publication and otherwise uses local discovery. Exact 30-day boundary/future fallback and actual same-ID legacy upsert are tested. |
| No fabricated observation/version/use history | PASS. Source publication/last successful observation stay NULL, counters start zero, and versions are absent. Legacy closure is stored distinctly as legacy evidence. No successful-enumeration timestamps are inferred from last_seen or polling health. |
| Legacy cache migration capture | PASS. One persisted DB-clock activation is used for populated legacy caches, with migration provenance and no invented last-use time. Absent descriptions stay absent. Existing use/capture/observation evidence is not overwritten. |
| Version capture remains disabled | PASS. `identity.py:170` is deliberately write-disabled for both identical and changed metadata. Actual hash normalization/dedup/allocation is a later gated producer contract, not claimed by this task. |
| Early nullable snapshot/version prerequisites | PASS. Reviews, corrections, packages, generation, scores, edits and active demand have nullable version, description/question snapshot and capture fields before Task 3. Existing correction snapshot values are preserved. Composite FKs reject cross-Job versions; scalar question snapshots are rejected by constraints; ready demand requires a version. New enforcement is not imposed on flag-off legacy private writes. |
| RLS and no broader client grants | PASS. Every new table enables RLS and revokes PUBLIC/anon/authenticated privileges; the trigger helper explicitly revokes EXECUTE and has no SECURITY DEFINER. Real catalog checks, attempted calls/access and two-user private legacy behavior accompany the evidence. |
| Every intermediate flag-off legacy path | PASS for the single Task 2 commit in this pinned range. Tests exercise actual legacy upsert/pruner, direct unprotected Job delete, approval/correction/package/prepare-generation/scores/edits and account-erasure SQL. No lifecycle consumer is cut over in this task. |
| Necessary demand deletion/export inventories | PASS. Service-only demand is explicitly classified in systemic RLS and deletion inventories. The existing verified-user service deletion loop remains owner-filtered; owned-PG representative SQL retains another user's demand and shared Job. Export uses only the existing owner-scoped wrapper in a separate transaction and reports null plus an explicit unavailable marker, with no claim-token export or privileged bypass. |

## Findings

No blocking or nonblocking Task 2 defect identified. There are no prioritized
corrective findings or repro steps to send to the author for this pinned task.
The following are approved sequencing boundaries, not missing Task 2 features:

- `migrations/2026-10-03-01-lifecycle-core.sql:99` uses a provisional
  listing-to-Job cascade so pre-cutover legacy unprotected deletion still works.
  Existing private protected FKs are unchanged. Real mapped legacy-pruner tests
  preserve approved/corrected/package records and snapshots. Tasks 3/4 must
  prohibit Job identity deletion at cutover and atomically stop destructive
  legacy prune before identity-preserving maintenance. Mapping completion alone
  does not establish indefinite retention or recover previously deleted history.
- Task 3 owns all-writer BEFORE STATEMENT gate, transition/readiness API,
  claims/reservations and staged row enforcement; Task 2's mapper must not be used
  in enforced or sticky archive state without that later integration. Task 7 owns
  meaningful version admission; Tasks 8/10 own usable hydration/outbox contracts.
- `dashboard/lib/accountExport.ts:164` intentionally reports demand export
  unavailable under current service-only grants. Complete demand export requires
  later reviewed owner access; this task must not broaden privileges to hide it.
- Special destructive dashboard feedback/account-deletion database suites were
  not run and are not counted as passing. Their reserved-port/database-name
  guards require safe harness adaptation in later scope/Task 13. Representative
  owned-PG SQL and existing TS unit evidence have narrower meaning.

## Evidence accepted and its limits

These are inspected author-run artifacts, not fresh reviewer test executions:

| Artifact | Actual result |
| --- | --- |
| `task-2-evidence/red17.txt` | PostgreSQL 17.11: 10 failed / 19 passed; expected missing Task 2 schema/module prerequisites. |
| `task-2-evidence/red-legacy-prune17.txt` | Two real legacy mapping/cascade failures, subsequently fixed and covered. |
| `task-2-evidence/red-collect17.txt` | Two collect-stage refusals, subsequently fixed by the focused legacy/collect guard change. |
| `task-2-evidence/task2-final17.txt` | Final targeted source/test state: PostgreSQL 17.11, 93 passed, zero skipped, 32.88s. |
| `task-2-evidence/task2-final16.txt` | Final targeted source/test state: PostgreSQL 16.15, 93 passed, zero skipped, 45.57s. |
| `task-2-evidence/accepted-full17.txt` | PostgreSQL 17.11: 931 passed, zero skipped, 173.16s; **before final collect-stage adjustment**, not a final-SHA whole-suite claim. |
| `task-2-evidence/account-inventory-green.txt` | Three TS unit files, 36 tests passed. |
| `task-2-evidence/typecheck.txt`, `ruff.txt` | Recorded TypeScript typecheck and repository ruff success. |

Historical failed logs are accurately retained and explained: systemic demand
inventory failure, missing export marker, and omitted required profile_version
in the erasure fixture are repaired in the reviewed final state. File names such
as green/final are not used as proof independently of their actual result text.

This is requirements/quality approval of Task 2 prerequisites and compatibility.
It does not replace independent security review, later real concurrency tests,
final whole-branch acceptance or separately authorized production/configuration
gates. No Task 2 blocker remains in this review.
