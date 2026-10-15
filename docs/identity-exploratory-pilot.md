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
2. Apply only `migrations/2026-10-15-15-identity-exploratory-pilot.sql` through the
   separately authorized migration path and verify the columns, constraint,
   uniqueness index and triggers. The existing worker fails closed against the
   new nullable `observed_at` until the updated worker is deployed. The updated
   worker requires the migration's predicate before any campaign can run.
3. Have an existing authorized execution path for the reviewer worker and a
   bounded operator authorization renewal/monitoring path. Do not create new
   credentials or persistent access. The worker never renews itself. A 30-minute
   campaign expiry does not lengthen the 45-second authorization window.
4. Obtain the existing required capacity inputs. The timestamp exception does
   **not** convert unknown resident-WAL bytes to zero, invent units or certify
   primary/volume identity. The current standalone metrics reader may still
   return `resident_wal_bytes=null`; resolve the byte conversion and scope with
   evidence before creating an authorization. Generation counters are not
   resident WAL. Do not bypass the retained threshold to make the test run.
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
