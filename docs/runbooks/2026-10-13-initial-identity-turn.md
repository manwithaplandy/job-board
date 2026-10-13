# Initial lifecycle identity turn

This release operation uses the reviewer's existing GitHub `main` autodeploy.
It does not reconnect a source or apply the environment's unrelated staged patch.
Only `railway.reviewer-worker.json` is changed among service configurations.
The script and tests live outside the poller/discovery watch patterns.

## Proven preflight

Commit `77c4a5879ff6b1fee9bb98b505ba2c52f231fdce` deployed as Railway reviewer
`e81c954b-c9f8-4023-aa1b-bc4dee6cae0e`. The predeploy log reported
`lifecycle-release-readonly-v1`, `transaction_read_only=on`, legacy generation 0,
zero source accounts/listings and 3,749,596,307 allocated bytes. Reviewer startup
succeeded; poller and discovery builds were skipped by their watch patterns.

## Bounded write operation

`python -m tools.lifecycle_release --first-backfill` only admits the production
reviewer on `main`, with a valid deployment revision reported in logs. Verify
that deployment revision against the reviewed release commit, not an older
deployment. The source-controlled hook has a 300-second Railway timeout.

Under the existing lifecycle transaction gate, require pristine legacy generation
0, no mapping activation timestamp, no source accounts/listings, all feature
flags off, retirement dry-run on and archive never activated. Require allocated
storage below 5,800 MiB before the first transition and before each batch.

The existing control claim/CAS enables only collect-stage identity mapping.
After that commit, all repeated invocations refuse to run. Mapping uses the
existing mapper for at most 20 separately committed batches of at most 100 legacy
jobs (or source-only accounts), not 100 total SQL writes. No batch starts at or
after 240 seconds; a batch already running can continue until the outer timeout.

Failure rolls back only the current transaction. Earlier committed batches and
the initial collect transition remain. Never rerun this operation to resume:
inspect committed progress and prepare a separately reviewed bounded continuation.
No original migrations, deletion, archive export, source/feed/maintenance or
hydration activation is performed by this operation.

## Cleanup and verification

After the deployment terminates, record its revision, marker, committed batch
counts and runtime; read back controls, mapping counts and database size.
Remove both `preDeployCommand` and `preDeployTimeoutSeconds` from the reviewer
configuration and restore the exact baseline deployment-config test. Push that
cleanup as a new commit. Verify the cleanup deployment succeeds and the live
service has no predeploy hook or timeout. Preserve all five unrelated discovery
staged changes and the poller's deliberate leap-day schedule.

Mapping a bounded initial slice does not establish whole-corpus readiness.
Do not activate later stages or invent readiness attestations from this result.
