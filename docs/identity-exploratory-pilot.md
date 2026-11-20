# One exploratory identity pilot

This change implements the owner-approved single bounded test using retrieval
timestamps while source measurement freshness is unknown. It does not enable
normal polling, hydration, any unrelated stage, or the full backfill.

## Scope and timing

A new campaign must explicitly set `exploratory_pilot=true`. The database permits
only one such campaign, including terminal campaigns. Its record cannot be deleted
or truncated; its identity, revision, generation, boundaries and creation time
cannot change. Limits cannot increase, progress cannot decrease, and terminal
campaigns cannot restart. A failed attempt that has created the pilot record
consumes this exception; do not replace it automatically.

The database enforces at most 2,000 job rows, 2,000 newly mapped accounts, exactly
one allowed turn, and expiry no later than 30 minutes after campaign creation.
The existing worker may finish earlier. These are ceilings, not promises that
both budgets will be consumed. Prepare the actual campaign only when ready to
start; setup time does not extend expiry.

Ordinary authorizations keep `observation_basis='measurement'` and the existing
upstream `observed_at` requirement. The pilot alone may instead use
`observation_basis='retrieval_unknown'`:

- `observed_at` **must be NULL**. Never copy retrieval time into it.
- `disk_fetched_at` and `wal_fetched_at` are local UTC receipt times from the
  metrics reader, not measurement timestamps. Both must be no older than 90
  seconds and not in the future on the database clock, including at commit.
- Preserve any actual source timestamps separately in `disk_source_observed_at`
  and `wal_source_observed_at`. Missing timestamps remain NULL. These fields do
  not certify measurement freshness and are not used to make it appear known.
- This explicit basis accepts unknown upstream age only for the bounded pilot.
  It does not change the reader's general `operationally_eligible` result.

The same SQL predicate is used by worker admission and the deferred commit gate.
Authorizations still expire within 45 seconds and require the same campaign,
revision, activation generation, project and source. Existing volume/capacity
fields, >1 GiB and >20% free-space thresholds, <4 GiB resident-WAL threshold,
allocation/growth guards, claim fencing, transaction deadlines and concurrency
controls remain in place. Retrieval timestamps do not prove that cached data are
current or that a value is accurate; unknown age alone does not prove inaccuracy.

## Release and input prerequisites

This migration creates neither a campaign nor an authorization and changes no
production control. Before a production test:

1. Review and merge this worker/schema change through the normal process, then
   verify the exact successful reviewer deployment. Do not mistake a skipped
   documentation-only deployment or an unmerged PR for deployed worker code.
2. Apply `migrations/2026-10-15-15-identity-exploratory-pilot.sql`, then
   `migrations/2026-10-16-16-identity-pilot-wal-assumption.sql`, through the
   separately authorized migration path and verify the columns, constraint,
   uniqueness index and triggers. The existing worker fails closed against the
   new nullable `observed_at` until the updated worker is deployed. The updated
   worker requires the migration's predicate before any campaign can run.
3. Have an existing authorized execution path for the reviewer worker and a
   bounded operator authorization renewal/monitoring path. Do not create new
   credentials or persistent access. The worker never renews itself. A 30-minute
   campaign expiry does not lengthen the 45-second authorization window.
4. Obtain fresh retrievals of the required capacity inputs and check the primary
   identifier and `/data` volume evidence. For this pilot, the owner explicitly
   approved assuming MiB for the metric labeled MB on 2026-10-16. Use the separate
   assumption fields below; never fill unknown verified bytes with zero or label
   the estimate as verified. Generated WAL counters are not resident WAL.
5. Recheck that no pilot already exists, no other campaign is running, all
   unrelated lifecycle stages remain paused, and the approved limits, revision,
   generation and high-water boundaries are recorded for exactly this campaign.

Unrelated staged Railway configuration must not be included in an activation or
cleanup operation. Nothing here authorizes accepting an entire pending patch.

## Execution and cleanup

Only after prerequisites are satisfied, use one bounded campaign and the existing
reviewer opt-in/execution path. Maintain short-lived authorization using fresh
retrievals with truthful timing fields, while monitoring the retained capacity,
growth and reviewer/coexistence limits. Stop on failed requests, ambiguous/missing
capacity inputs, errors, expired authorization, adverse resource/latency changes,
or the fixed budgets. Do not renew the campaign expiry or allow a second turn.

After the turn or any stop, revoke its authorization and remove its opt-in using
the existing authorized controls. Verify terminal state, durable counters,
released/cancelled claim, no remaining authorization, and paused unrelated stages.
Retain the pilot campaign as the durable single-use receipt; cleanup must not
reset this exception. If execution never begins, report that fact explicitly.

## Local verification

Use the repository's owned PostgreSQL acceptance harness and committed selection
(`tools/run_lifecycle_acceptance.py`), not unrestricted test discovery. Tests use
synthetic metrics; no production PAT or database is needed. Cover both the normal
measured path and the pilot path, including stale/future receipt times, expiry,
capacity failures, forbidden scope expansion, one-use retention and deferred
commit rejection. Rehearse this migration on the previous schema as well as the
fresh consolidated schema before applying it to production.

## Approved MiB assumption for this pilot

The owner approved treating the `pg_wal_size_mb` resident-WAL gauge as MiB for the
single exploratory pilot. This is an explicit unit assumption, not verification
of the deployed exporter query. The bound describes the reported number under
that assumption; it does not prove actual usage or measurement freshness.

For verified observations, `wal_basis='verified_bytes'` remains the default,
`resident_wal_bytes` is required, and `wal_native_mb` must be NULL. Existing rows
retain that basis and their original numeric values when migrating.

For an assumed observation, set `wal_basis='assumed_mib'`, set
`resident_wal_bytes=NULL`, and supply `wal_native_mb` using the original decimal
metric text as a numeric parameter. Do not first convert through a binary float.
The database generates `wal_assumed_mib_upper_bytes=ceil(wal_native_mb*1048576)`;
callers cannot supply or reduce that generated value. For example, the illustrative
native value `1.0000001` yields 1,048,577 bytes, rounding upward rather than down.

Negative, nonfinite, missing, overflowing and physically inconsistent inputs are
rejected. The generated bound must fit within capacity minus available space.
Worker admission and the deferred commit gate use the same selection function:
only a campaign with the retained `exploratory_pilot` marker can use assumed MiB.
Ordinary campaigns still require verified bytes. The selected value must remain
strictly below 4 GiB; even a raw value just below 4096 MiB is rejected if upward
rounding reaches the threshold. Neither timing mode bypasses these checks.

This change leaves the general metrics reader's `operationally_eligible` gate
false. It does not invent sample timestamps, create authorization, renew a
campaign, change primary/volume checks, or permit a second pilot. Preserve the
native gauge, its receipt time and its explicit assumption basis in the ledger.
The existing 45-second authorization, 90-second receipt, 30-minute campaign,
2,000-job/account, one-turn, resource, concurrency and commit-time limits remain.
