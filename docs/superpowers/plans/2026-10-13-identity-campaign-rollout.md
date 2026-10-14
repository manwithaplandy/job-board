# Identity continuation calibration and global lean rollout proposal

Status after the October 14, 2026 repeat calibration: the gate-duration fix and release documentation are merged. The separately approved repeat completed its one turn and is terminal. Its reviewer opt-in is cleared and cleanup is verified. Each calibration was capped at 2000 additional job rows, 2000 newly mapped source accounts, one turn and a fixed expiry within 30 minutes. Neither completion authorizes another pilot or broader mapping. Normal polling stays paused.

## Verified release and migration

- [PR 20](https://github.com/manwithaplandy/job-board/pull/20) was merged by the owner at 21:40:08 UTC as `8a2a6e15da5246c17e60a444c8daaf7ce8b51f70`. Its tree matches reviewed head `cd4b36308c2a0d36fba52d0b3864f5a3a17e7df2`.
- [Main CI 38472326481](https://github.com/manwithaplandy/job-board/actions/runs/38472326481) passed all four jobs. The reviewed head's [authenticated visual run](https://github.com/manwithaplandy/job-board/actions/runs/38456196962) also passed: 68 authenticated tests and successful authentication-state cleanup.
- Railway reviewer, poller and discovery deployments, plus Vercel deployment, succeeded at the merged revision. Reviewer runtime logs confirm the supervisor starts normally with source work inactive. The five unrelated staged Railway settings were not applied.
- The owner applied only `migrations/2026-10-13-13-identity-campaign.sql`. Native read-only verification at 21:58:17 UTC confirmed the expected table, constraints, index, row-level security/access restrictions and zero campaigns. A later read-only check at 23:02 UTC again found the table, enabled RLS and zero campaigns.
- Both migration ledgers are present: `public.schema_migrations` records filename `2026-10-13-13-identity-campaign.sql` at `2026-10-13 21:55:06.279325+00`; `supabase_migrations.schema_migrations` records version `20261013215506`, name `identity_campaign`, with matching DDL.

**Do not reapply this migration.** The public filename ledger and Supabase migration history are separate records; merely executing SQL in an editor does not generally establish both. Both were independently verified for this release.

## October 13 calibration and gate-duration fix

The first Railway calibration reached its one-turn budget and stopped in `budget_exhausted`. Cleanup cleared the reviewer opt-in, cancelled the claim and left terminal counters stable. Post-turn logs nevertheless showed reviewer lock-timeout reconnects and archive deferrals. The empty reviewer queue did not establish request latency under load.

[PR 22](https://github.com/manwithaplandy/job-board/pull/22) replaced repeated per-row mapping queries with bounded set-based statements and applied a 1.25-second transaction window across setup, mapping, finalization and cleanup. Sorted locks, exact-ID scope, existing exclusions/evidence, capture predicates, fixed elapsed expiry, atomic checkpoints and claim fences are preserved. The deadline is not a hard wall-clock guarantee against stalled clients or network connections.

Independent ordinary review covered exact head `5b7d5a4052ffc97fca209540770ecdb15ae11ca6`. [Exact-head CI](https://github.com/manwithaplandy/job-board/actions/runs/38495088166) passed: PostgreSQL 16/17 each 469 Python and 16 owned dashboard tests, dashboard 1717 passed/2 skipped, public visual 100 passed/68 authenticated cases omitted by scope. Concurrent real reviewer/archive regressions failed with lock timeouts on the baseline and passed with the fix. Slow-SQL regressions preserved committed checkpoints when setup, mapping or cleanup exhausted the window. Deliberately excluded security/adversarial checks were not run.

## October 14 separately approved repeat

The owner approved merging PRs 22 and 21, deployment and exactly one repeat with the same caps, including reviewer restart and cleanup. PR 22 merged as `0e11b2217862f6bac19f54f024a9a9ab85c2c3f3`, whose tree matches its reviewed head. PR 21 then merged as `c2ec584b05c7b42811b2d788327fb0432269a4ef`; only documentation differs from the code merge. The opted-in reviewer and Vercel production deployment used this final revision. The poller deployed the code merge and retained its paused cron; discovery's watch rules skipped these unrelated changes.

[Final-main CI](https://github.com/manwithaplandy/job-board/actions/runs/38496530222) passed on attempt 2. The first attempt's dashboard tests passed but its build failed resolving a Google-font module in Turbopack; the failed ordinary job passed on retry. The earlier code-merge run also had a font-resolution startup failure in public visual. No application code was changed for these retries.

The repeat reached 2000 additional mapped jobs and 76 new source accounts within its sole turn, then stopped in `budget_exhausted` with reason `approved turn budget reached`. Its expiry was never extended. No reviewer reconnects or archive lock-timeout deferrals appeared in the monitored window. The reviewer queue remained empty; archive checks bracketed the short mapping turn rather than proving simultaneous archive load. Sampled gate observations did not show waiting sessions, but sparse samples do not establish a maximum lock duration. This is evidence of improvement for the bounded run, not a loaded-service latency guarantee or full-corpus throughput projection.

Cleanup set `IDENTITY_BACKFILL_CAMPAIGN` to an empty value, which disables the entrypoint, and replaced the opted-in deployment with a successful deployment at the same revision. Startup and subsequent logs show no identity child. The claim is cancelled and terminal counters remained stable after cleanup. Normal polling stayed paused with no new poll runs or source enumerations. Source, hydration, maintenance, feed, retirement and export stayed off; retirement remains dry-run and archive never activated. The five unrelated staged discovery settings were unchanged. No migrations were reapplied.

Allocated database growth and generated-WAL deltas, SQL-derived timing and coarse service resource samples were recorded separately. `pg_database_size` does not measure physical free space or resident WAL; the WAL counter is cluster-wide and can include concurrent/background activity. Minute-level resource samples can miss a short turn's peak. No new load test or external scan was performed.

**Do not repeat this pilot or expand mapping without new approval.** Any proposed continuation needs fresh capacity and readiness evidence, an exact revision, finite limits and monitoring/stop conditions. The procedures below are retained as a historical preparation reference; they are not authorization to run again. The migration is already applied and must not be reapplied.

## Historical calibration preparation

Use the existing production reviewer service and database credentials. The reviewed main revision is deployed with `IDENTITY_BACKFILL_CAMPAIGN` absent, and the new additive migration is already applied. Verify those states; do not reapply this or any original lifecycle migration. Preserve all five unrelated staged discovery settings; do not accept their deployment patch.

Prepare exactly one paused campaign, pinned to that full deployed 40-character SHA and the then-current collect activation generation (last observed: 1). Capture `max(jobs.id)` and `max(companies.id)` in the preparation transaction. Approve at most 2000 additional job rows, 2000 total newly mapped accounts, one worker turn and a 30-minute absolute expiry from the approved start. Accounts created by job batches consume the account budget. A one-turn calibration may stop before account-only work; it does not claim corpus completion.

Suggested preparation SQL below creates paused data only and is a proposal, not an instruction to run without approval. Replace the SHA and expiry with reviewed concrete values. If the control-state precondition returns no row, stop and review; never loosen it. Check actual service volume/WAL headroom, current allocation/reservations and unmapped counts before preparing it.

```sql
INSERT INTO lifecycle_identity_campaigns
  (source_revision, activation_generation, expires_at,
   max_job_rows, max_company_rows, max_turns, job_high_water, company_high_water)
SELECT '<reviewed deployed 40-character SHA>', activation_generation,
       '<approved absolute UTC expiry>'::timestamptz,
       2000, 2000, 1, (SELECT max(id) FROM jobs),
       COALESCE((SELECT max(id) FROM companies), 0)
FROM lifecycle_control
WHERE singleton AND safety_stage='collect' AND identity_enabled
  AND identity_migration_activated_at IS NOT NULL
  AND NOT (source_enabled OR hydration_enabled OR maintenance_enabled OR feed_enabled
           OR retirement_enabled OR archive_ever_activated OR export_enabled)
  AND retirement_dry_run AND archive_stage='never_activated'
RETURNING id, state, source_revision, activation_generation, expires_at,
          max_job_rows, max_company_rows, max_turns, job_high_water, company_high_water;
```

The final activation approval must name the returned campaign UUID, exact revision, generation, expiry, budgets and both boundaries. Only then set that campaign running and set reviewer `IDENTITY_BACKFILL_CAMPAIGN` to its UUID using a reviewed configuration change. Both are required; the worker never creates, starts, unpauses or enlarges its campaign. No new service or credentials are needed. This environment opt-in may require a reviewer deployment/restart; include that explicitly in the later approval.

## Cadence, measurement and stops

Supervisor cadence: 60-second checks, one identity child at a time. Each turn: at most 20 batches of 100 rows, a 1.25-second transaction window including guards and commit, 240 seconds cooperative/300 seconds hard wall time, 240 CPU seconds, 384 MiB address space, niceness 10. A successful turn has at least a 60-second cooldown; abrupt death preserves a 300-second not-before timestamp. With one authorized turn, the next tick marks remaining work budget-exhausted without mapping. Expiry, fixed total row/account/turn caps and terminal state bound an abandoned opt-in.

Record before/after allocated database bytes, held reservations, total service volume usage/WAL, source-listing/account/link relation sizes, mapped job/account counters, elapsed wall/CPU time, reviewer queue/latency and the ledger's heartbeat/state/stop_reason. The last pilot measured 2000 jobs in 47 seconds with 2441216 allocated-byte growth; do not extrapolate this as a guarantee. The initial worker allowance is conservative and must be recalibrated on the deployed code.

Stop the campaign (set paused, or remove opt-in and drain the child) if reviewer latency/queue materially worsens, volume free space approaches the independently approved margin, growth exceeds the approved estimate, control/revision/generation differs, expiry/budgets are reached, or any error occurs. Pausing is checked before every batch; an already executing transaction can finish. The worker itself refuses a batch unless allocated bytes + held reservations + 32 MiB < 5800 MiB, and rolls back/stops if the post-batch sum reaches 5800 MiB. Rollback cannot reclaim already allocated pages; this is not a physical volume guarantee. A time-window yield retains the prior checkpoint for a later permitted turn. A lost owner cannot mutate a successor's campaign. Do not automatically unpause or increase budgets after a stop.

After calibration, remove opt-in when no further work is approved. Any full continuation needs a new concrete approval: fresh unmapped counts, fixed row/account/turn budgets, exact revision/generation/high-water marks, absolute expiry, measured projected database AND volume usage, monitoring responsibility and an explicit stopping margin. Use resumable scheduled turns instead of hundreds of deployment hooks. No automatic full-corpus budget is proposed here.

## Source policy and coordinated activation

Inactive legacy companies remain unknown regardless of failure counter. The 2746 threshold-exceeding inactive companies in the read-only audit have ambiguous disable provenance; recovering any of them requires separately reviewed evidence. Existing deliberate/unknown states are never converted, and trusted failure-disabled states retain normal backoff. Coverage remains all known eligible source accounts, independent of current user activity or preferences; no demand-based source gating is added.

Before restarting source work, separately verify full mapping/cache provenance and all ten existing writer contracts at the exact deployed revision and applicable generation, including operational preallocation. Keep the existing global readiness verifier and certificate; campaign completion does not replace them. Catch up companies/jobs created beyond campaign boundaries through separately approved bounded work. Do not manufacture attestations or relax enforced/archive prerequisites.

Source/hydration activation is one coordinated decision. A source-only transition suppresses hydration for matching even when a legacy cached body exists. Preferred sequence after readiness: take the existing control singleton claim, use the existing generation-CAS transition to enable `source_enabled` and `hydration_enabled` in one transaction, commit while the claim remains valid, then cancel the claim in a separate transaction. An approved hydration-first/source-last sequence is also valid. Keep collect stage, feed/maintenance/retirement/export off, retirement dry run and archive never activated unless separately authorized. Enforced-stage or generation changes require their existing readiness procedure; do not treat prior evidence as valid automatically.

Source enablement immediately starts global source work through the existing reviewer child even while the scheduled poller remains paused. Treat it as the operational start. Initially leave the cron paused so only the bounded source child runs; approve restoring an exact daily UTC cron separately after observing throughput, request rates, failures, reviewer latency and capacity. Source child checks occur every 60 seconds, with 100 boards/300-second turns and per-source 60-second/50-request/10000-row bounds. Individual attempted sources persist their next UTC daily slot before HTTP; failure-disabled sources retain 1/2/4/7-day backoff. A due backlog can keep consecutive turns busy, so cadence does not guarantee idle time.

Eligible matching retains activity, entitlement/comp, location/company and budget checks before demand hydration and model review. Ordinary source enumeration and identity mapping perform no model inference. Local functional verification covers paired flags, filtered metadata-only demand hydration and exact-version review snapshots; this does not authorize a new global review run.

## Authorization boundaries

The owner approved the original deployment, one additive migration and original capped calibration, then separately approved PRs 22/21 and one capped repeat with reviewer opt-in/restart and cleanup. Both calibrations are complete; neither authorizes another pilot. Migration application is complete; do not repeat it. Any authorization-system denial is a blocker to report, not permission to use another route.

Separate approval remains necessary for any longer campaign after measured calibration, recovery classification of ambiguous inactive sources, paired source/hydration activation, or restoration of a daily cron schedule. No retention, archive/export or production deletion is included.
