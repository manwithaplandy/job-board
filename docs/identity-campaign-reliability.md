# Identity continuation reliability (draft, not deployed)

This change addresses the production-sized local finding that a full gap scan repeatedly exhausted the 1.25-second shared-gate transaction budget. It also makes continued mapping depend on fresh external operator authorization and physical capacity observations. It does not approve or start a production campaign.

## Completion protocol and consistency

Mapping uses the existing 100-row batches, 20-batch turns, 240-second cooperative / 300-second process limits, finite budgets, pinned revision/generation/high-water marks and 60-second cooldown. The shared transaction budget remains 1.25 seconds.

When mapping reaches the end, the worker commits the short batch and releases the gate. A read-only statement checks the *entire* pinned jobs/companies corpus and reads its mutation generation in the same PostgreSQL MVCC statement snapshot. The read has a separate 10-second statement timeout, clipped to the remaining turn time, and takes neither the shared gate nor a campaign row lock. It has no mapping side effects.

Before recording completion, the worker reacquires the gate and campaign row, rechecks controls, revision, boundaries, authorization and claim ownership, and compares the current mutation generation with the scanned generation. Every INSERT/UPDATE/DELETE/TRUNCATE statement on jobs, companies, source_listings and source_accounts transactionally advances that generation under the same gate. Rollback also rolls back the generation increment. Existing statement gates run first and retain their lock timeouts. Authorization and campaign operator writes also acquire the gate before row/FK locks.

An unchanged generation makes the scan valid at the completion commit: relevant writers cannot slip between validation and commit. A changed generation yields without completion; a subsequent finite turn repeats the whole snapshot. A detected gap stops the campaign for review. Changes even outside the pinned bounds conservatively invalidate the result; constant writers can therefore delay completion until the finite turn/expiry limit stops work. This is not a resumable partial scan, and it does not discard behind-cursor gaps.

## Default-deny authorization and capacity

All campaign progress, including small campaigns, requires a row in `lifecycle_identity_authorizations`. The migration creates no such row. Existing campaigns without one stop before mapping. The worker never creates or renews authorization.

Required input binds to campaign ID, exact source revision, activation generation, project `fdhspmavadgucktetzoi`, and the identified primary database volume. It contains the actual observation timestamp, provisioned capacity, available bytes, and resident WAL bytes. The accepted source is `supabase_metrics`; an operator must verify the measurement's provenance and volume identity rather than relabel another counter.

- Authorization: database-clock issue time, no future dates, expiry at most 45 seconds later. Renew around every 15 seconds only while monitoring remains healthy and approved.
- Observation: no future dates and strictly less than 90 seconds old. Use the oldest measurement timestamp if combining series. Never refresh this timestamp merely because an old observation was read again.
- Available capacity: strictly greater than both 1 GiB and 20% of the observed volume.
- Resident WAL: strictly below 4 GiB; this is a stop policy, not a claim that `max_wal_size` caps resident WAL.
- Allocated database growth: below 1,280 MiB from the campaign's existing `before_bytes` baseline, alongside the original allocation-plus-reservation guard.

These are conservative code limits for review, not evidence of production headroom. All numeric inputs must be present and consistent (WAL cannot exceed observed used space). Missing/expired/wrong-scope/unsafe input stops progress. Checks run before and after mapping; a deferred database constraint additionally checks authorization/capacity freshness when a progress or completion update commits. A failure rolls back that checkpoint. Previously committed mappings remain valid.

A 15-second polling target is still not a hard 15-second stop promise. Loss of renewal stops progress when the existing authorization expires (at most 45 seconds after issue); stale observations stop it within their 90-second validity even if a broken monitor keeps renewing. Deferred checks prevent a checkpoint committing on expired evidence. Network/client stalls may delay process cleanup; the existing process hard limit and database statement/lock limits still apply. No independent process or monitoring service is installed by this PR.

## Supplying telemetry with existing access

The connected Supabase tools currently provide SQL and metadata, but **no Metrics API scrape action**. The SQL tool forbids server filesystem reads/enumeration, so this task did not use `pg_ls_waldir`. Railway's connected OAuth reader exposes variable names only: the reviewer has `DATABASE_URL`, but no Supabase API-key variable. Its disk metrics measure the application service, not the Supabase volume. No key was retrieved, created or rotated.

The documented existing-account route is the project's HTTPS Metrics API:

`https://fdhspmavadgucktetzoi.supabase.co/customer/v1/privileged/metrics`

An owner/operator who already has the project's existing authorized secret API key in their existing secret manager can read it with the documented HTTP Basic Auth from an existing workstation or collector; no paid infrastructure or new key is required *if that existing access is available*. Do not paste the key into source, a chat, command logs, or this ledger. Supabase's guide recommends a 60-second scrape. Its official dashboard uses `node_filesystem_size_bytes` and `node_filesystem_avail_bytes`, selected for the same project, primary instance, device and actual PostgreSQL data mount (for example `/data`, only after verifying this project's mount). Do not sum duplicate series or substitute root/app-container disk.

**Unresolved prerequisite:** this session has not demonstrated access to that endpoint, verified the actual primary-volume labels, or identified a current *resident WAL* series. The official dashboard JSON does not establish one. WAL generation counters, replication lag, `max_wal_size`, and daily disk-distribution charts are not substitutes. The owner must provide an existing authorized exporter/provider metric that measures resident WAL and its real observation time. If the endpoint does not expose it and no existing authorized measurement exists, the campaign remains blocked; this PR does not create a credential or deploy a collector to fill that gap.

Once all measurements and their freshness are verified, an explicitly authorized operator/monitor can use the existing database connection or connected SQL action to supply the private ledger. The following is a **parameterized contract for later approved operation**, not a production instruction executed in this task:

```sql
INSERT INTO lifecycle_identity_authorizations
(campaign_id,source_revision,activation_generation,authorized_at,valid_until,
 observed_at,project_ref,source,volume,capacity_bytes,free_bytes,resident_wal_bytes)
VALUES
(:campaign_id,:approved_revision,:approved_generation,clock_timestamp(),
 clock_timestamp()+interval '40 seconds',:actual_oldest_observed_at,
 'fdhspmavadgucktetzoi','supabase_metrics',:verified_primary_volume,
 :capacity_bytes,:available_bytes,:resident_wal_bytes)
ON CONFLICT(campaign_id) DO UPDATE SET
 source_revision=excluded.source_revision,
 activation_generation=excluded.activation_generation,
 authorized_at=excluded.authorized_at,valid_until=excluded.valid_until,
 observed_at=excluded.observed_at,project_ref=excluded.project_ref,
 source=excluded.source,volume=excluded.volume,capacity_bytes=excluded.capacity_bytes,
 free_bytes=excluded.free_bytes,resident_wal_bytes=excluded.resident_wal_bytes;
```

Renewing the row neither enables the worker environment nor changes campaign state. On any failed scrape, ambiguous volume, missing resident-WAL measurement, stale sample, unhealthy monitoring, or withdrawal of approval, stop renewing. After a stop, an operator must review and separately authorize any resumption; the worker never self-reactivates.

References (checked 2026-10-14):
- https://supabase.com/docs/guides/observability/metrics/vendor-agnostic
- https://github.com/supabase/supabase-grafana/blob/main/grafana/dashboard.json
- https://supabase.com/docs/guides/platform/database-size

## Migration and release prerequisites

`migrations/2026-10-14-14-identity-reliability.sql` is additive and mirrored in `schema.sql`. It adds two private RLS-enabled tables, generation triggers, operator gate triggers and deferred authorization enforcement. It creates no campaign, changes no lifecycle flag, and performs no identity backfill. The singleton generation is metadata, not a corpus rewrite. Existing transaction gates remain mandatory; disabling triggers or privileged direct edits to the private generation are outside the supported operating contract.

Apply/rehearse the migration before enabling this code for a campaign, after separate approval. Verify both database ledgers and catalog parity, then deploy the reviewed exact revision only after separate approval. Keep campaign opt-in disabled throughout. Older worker code must not be used to run a campaign after this migration: its progress commits will lack required authorization. Rolling back code alone does not remove the default-deny commit guard. Do not drop the guard to resume old behavior.

Migration, deployment, operational telemetry access, a verified monitor/renewal path, approved finite campaign bounds and campaign activation are all separate prerequisites. None has been performed here. PR #23 remains independent and untouched. The deliberately excluded security/adversarial checks were not run; ordinary independent review is not a substitute for that separate approval.

## Reproduction

Use the owned runner; it sanitizes ambient credentials and removes its loopback Docker database afterward:

```bash
python tools/lifecycle_test_db.py --postgres-major 17 -- python tools/run_lifecycle_acceptance.py
python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest -q -s tests/test_identity_scale.py
```

The scale file explicitly exercises 40,000 mappings with three loaded reviewer consumers and actual archive gate checks, plus a synthetic 835,466-job / 29,412-company completion transition. Models/HTTP are mocked/blocked. Only fixture preload bypasses triggers; tested operations use all normal triggers. Owned cooldown timestamps are advanced to increase load, and synthetic operator observations are renewed between turns. This is not a real-time telemetry test or a 14-hour storage simulation. Per-operation injected delays include timeout SQL and commits. Client gate windows include acquisition waiting and are not exact server lock-hold measurements.


## Verification record

- Before implementation, the two new behavioral regressions failed as expected: missing authorization still allowed mapping, and completion held the shared gate. See `evidence/identity-reliability/red.log`.
- Ordinary acceptance: 490 passed on PostgreSQL 17.11 in 177.79s; 490 passed on PostgreSQL 16 in 213.81s. Two additional ordinary cases (deleted mapping during scan and campaign growth cap) were subsequently added. The final focused reliability suite passed 23 tests in 19.50s, including both additions. Exact-head PR CI runs the expanded 492-test ordinary selection on both PostgreSQL versions, plus existing dashboard and public visual checks.
- Independent ordinary review of code commit `dd0119a09ddd1689681c085155172fad9602db4a` found no remaining critical/important issues. It identified and verified fixes for commit-time authorization expiry, mutation-trigger ordering before timeout installation, and campaign/auth cascade lock inversion. Reviewer did not execute separate external scans or excluded tests.
- The loaded soak permits at most 30 finite turns for 40,000 mappings. Its first iteration assumed exactly 20 productive turns; a legitimate transaction-budget yield left 39,200 rows after 20 turns, with 200 successful reviewer requests and zero reviewer errors. The assertion was corrected to allow bounded retries, without enlarging any worker budget or timeout. The final soak and production-sized results are recorded in PR #24's verification record together with the exact-head CI URL.
- Evidence logs are whitespace-normalized; result counts and failure messages are unchanged. The CLI migration scaffolder was unavailable in this environment (initial npm cache path failure, then CLI startup failure); the additive migration follows the repository's existing filename/ledger convention and was verified by ordinary catalog parity and reapplication tests.
