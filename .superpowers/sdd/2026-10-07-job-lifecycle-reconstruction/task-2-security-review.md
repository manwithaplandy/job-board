# Task 2 independent security / tenant / adversarial review

Verdict: **APPROVED** for the Task 2 intermediate, default-off scope.

Reviewed BASE `8d1e98424b08f076df736f962ec94f2bf5bd30b8` through HEAD
`b0fc09a0012b06bc6e16262b641a08a37ccc3ca1`. Reviewer did not author the
implementation. No blocking security, tenant-isolation, or adversarial compatibility
finding was identified. This approval does not authorize activation or deployment.

## Review basis and integrity

Read root AGENTS.md / CLAUDE.md, dashboard/CLAUDE.md, the approved recovered spec
and plan, complete task-2 brief (including global constraints and binding
amendments), author report, and complete pinned review package. Checked the
surrounding account-erasure action, privileged erasure loop and owner-scoped DB
wrapper. The referenced dashboard/AGENTS.md does not exist; dashboard/CLAUDE.md
supplies the applicable dashboard instructions.

Independent read-only checks established:

- Actual HEAD equals the pinned HEAD above.
- The package's complete diff exactly equals `git diff --no-ext-diff --unified=10
  BASE HEAD` (ignoring trailing final whitespace only).
- Migration contents, excluding transaction delimiters, exactly equal the
  lifecycle section appended to schema.sql.
- `git diff --check BASE HEAD` exits 0.

## Security and adversarial assessment

- **Controls and activation:** migration lines 4–62 default behavior flags off and
  retirement dry-run on. The singleton history trigger is invoker-only, fixes
  search_path to pg_catalog, performs no user/Job DML, rejects removal/truncation,
  generation regression and clearing sticky activation history. Enforced safety,
  any activated archive stage and export activation are rejected at this schema
  stage. `config.py:31` reads persisted state and fails if absent; it provides no
  environment or caller-GUC override. Readiness transitions remain Task 3/10 work.
- **Privileges and original actor:** migration lines 404–427 enable RLS and revoke
  all client privileges on all twelve new tables. Line 56 explicitly revokes the
  only new helper's EXECUTE from PUBLIC, anon and authenticated. No SECURITY
  DEFINER helper or privileged user-table mutation was introduced; therefore no
  new definer-identity substitution exists. Existing owner policies and wrappers
  remain unchanged. `test_lifecycle_identity.py:217,257,457` cover catalog ACLs,
  attempted table/helper calls, mapped legacy owner writes, foreign-owner denial
  and legacy cleanup. Later claim-helper original-JWT/owner-binding requirements
  must still receive their Task 3 independent review.
- **Private snapshots and FKs:** migration lines 290–403 install nullable
  prerequisites on reviews, corrections, packages, generation, scores, edits and
  demands. Composite version/Job FKs prevent cross-Job attachment; JSON question
  snapshots reject scalar shapes; ready demand requires a version. Existing
  snapshot columns are preserved with ADD COLUMN IF NOT EXISTS, and there is no
  corpus update fabricating historical versions or consumption. Existing private
  FK definitions and RLS policies were not weakened.
- **Legacy mapping and age:** `identity.py:36` validates integer limits 1–500,
  enters the shared advisory gate before sorted Job keys and relevant row/FK
  locks, maps only unmapped rows, and uses persisted listing existence as its
  restart checkpoint. Legacy/collect are allowed; enforced and sticky archive
  state fail before mapping writes. Original first_seen timestamps seed frozen
  local anchors; UTC expiry is 720 hours; counters remain zero and source
  observation/publication remain unknown. The first explicit mapping activation
  supplies cache-capture provenance without fabricated use. Source-only boards
  are also bounded. `capture_version` at line 170 is unconditionally write-disabled,
  so this task does not expose unfenced hash/version allocation.
- **Typed public identities:** source coordinates have typed FKs and unique
  ATS/board and listing/external keys; existing Job TEXT and company INT IDs remain.
  Job locations reference existing locations(raw), brands/skills receive no
  speculative data, nullable valid/observed times are not invented, and accepted
  identity assertions require reviewed public evidence. No automatic merge
  implementation is enabled.
- **Pre-cutover deletion compatibility:** the new source-listing-to-Job cascade
  at migration line 99 removes provisional public mapping with legacy deletion.
  This is the explicitly approved intermediate compatibility behavior. The actual
  legacy pruner regression preserves its protected approval/correction/package
  rows and snapshots. Identity-preserving deletion prohibition is not yet active;
  Tasks 3/4 must block Job identity DELETE at cutover and atomically stop the old
  destructive pruner before new maintenance is enabled.
- **Account erasure/export:** `userScopedTables.ts:37` extends the existing
  service erasure registry. The caller still derives target user from verified
  claims (`app/actions/account.ts:29`) and the existing parameterized deletion
  loop filters every demand deletion by that target (`accountDeletion.ts:122`).
  It adds no privileged importer or client grants. Owned-Postgres representative
  SQL verifies another user's demand and the shared Job survive. Export at
  `accountExport.ts:164` uses a separate withUserSql transaction with an explicit
  owner predicate, excludes claim tokens, and returns null plus a fixed generic
  error when inaccessible. Failure cannot poison other exported sections or
  masquerade as a complete empty demand export. The new systemic RLS inventory
  entry accurately declares service-only/no-policy access.

## Evidence and remaining boundaries

Inspected recorded final targeted lanes: PostgreSQL 17.11 and 16.15 each report
**93 passed, zero skipped** in task2-final17.txt / task2-final16.txt. The broad
17.11 log reports **931 passed, zero skipped** before the final focused collect
allowance; it is not represented as a broad run at final HEAD. Account export,
deletion and service-role allowlist unit evidence reports **36 passed**;
TypeScript typecheck and Ruff evidence pass. Earlier failing logs are correctly
identified as red/intermediate evidence and their fixes are visible in the diff.

No additional DB probe was needed: the inspected real-DB tests and code resolve
the Task 2 questions without duplicating covered runs. This review did not run
the reserved-port destructive Dashboard DB suites or count them as passing.
Task 13 must safely adapt those suites. Complete demand export awaits reviewed
owner access; no demand producer is enabled now. Task 3/10 claim/readiness/gate/
outbox integration and Task 3/4 deletion cutover remain mandatory future gates,
not defects in this approved intermediate task.

No product/Git mutation, cloud/provider/production/shared-port operation, paid
call, or additional agent was used. Only this independent review artifact was
created. No remaining Task 2 security blocker.
