# Identity continuation calibration and global lean rollout proposal

Status after the October 13, 2026 calibration: implementation is merged and deployed; the additive campaign migration is applied and verified. The sole approved calibration finished within its fixed caps and is terminal; its reviewer opt-in has been cleared. The approved scope remains one campaign capped at 2000 additional job rows, 2000 newly mapped source accounts, one bounded turn and an absolute expiry no later than 30 minutes after execution starts. Normal polling stays paused.

## Verified release and migration

- [PR 20](https://github.com/manwithaplandy/job-board/pull/20) was merged by the owner at 21:40:08 UTC as `8a2a6e15da5246c17e60a444c8daaf7ce8b51f70`. Its tree matches reviewed head `cd4b36308c2a0d36fba52d0b3864f5a3a17e7df2`.
- [Main CI 38472326481](https://github.com/manwithaplandy/job-board/actions/runs/38472326481) passed all four jobs. The reviewed head's [authenticated visual run](https://github.com/manwithaplandy/job-board/actions/runs/38456196962) also passed: 68 authenticated tests and successful authentication-state cleanup.
- Railway reviewer, poller and discovery deployments, plus Vercel deployment, succeeded at the merged revision. Reviewer runtime logs confirm the supervisor starts normally with source work inactive. The five unrelated staged Railway settings were not applied.
- The owner applied only `migrations/2026-10-13-13-identity-campaign.sql`. Native read-only verification at 21:58:17 UTC confirmed the expected table, constraints, index, row-level security/access restrictions and zero campaigns. A later read-only check at 23:02 UTC again found the table, enabled RLS and zero campaigns.
- Both migration ledgers are present: `public.schema_migrations` records filename `2026-10-13-13-identity-campaign.sql` at `2026-10-13 21:55:06.279325+00`; `supabase_migrations.schema_migrations` records version `20261013215506`, name `identity_campaign`, with matching DDL.

**Do not reapply this migration.** The public filename ledger and Supabase migration history are separate records; merely executing SQL in an editor does not generally establish both. Both were independently verified for this release.

## Calibration outcome and remaining hold

The sole approved calibration ran at the merged revision and activation generation, reached its approved one-turn budget, and stopped in `budget_exhausted` with reason `approved turn budget reached`. Its committed checkpoints stayed inside the fixed row/account limits and absolute expiry. No additional campaign or retry turn was authorized or executed.

Cleanup cleared `IDENTITY_BACKFILL_CAMPAIGN` to an empty value (the entrypoint treats it as disabled), and a successful reviewer redeployment at the same revision replaced the opted-in deployment. The campaign claim is cancelled; its terminal counters remain stable. Normal source polling, hydration, maintenance, feed, retirement and export controls remain off; the unrelated staged settings remain untouched.

**Do not extend this calibration or begin a larger campaign.** Post-turn log inspection found lifecycle-gate contention: reviewer demand checks reached their existing lock timeout and reconnected, while archive checks deferred. The reviewer queue was empty, so this run does not establish request latency under load. Resource and storage measurements stayed within their limits, but that does not establish safe coexistence with reviewer work.

Before proposing continuation, shorten identity transactions enough to coexist with the existing two-second gate wait (for example, optimize repeated per-row database round trips and measure smaller batches). Preserve the shared gate, claim fencing and existing timeouts; do not mask contention by weakening them. Verify with concurrent reviewer work and live-like database latency, then obtain separate approval for any new fixed-budget campaign. Detailed operational measurements were reported separately rather than publishing service telemetry here.

The instructions below are the historical preparation/monitoring procedure for the completed calibration, retained for review. They are not authorization to repeat it. The migration is already applied and must not be reapplied.

## Proposed first calibration

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

Supervisor cadence: 60-second checks, one identity child at a time. Each turn: at most 20 batches of 100 rows, 240 seconds cooperative/300 seconds hard wall time, 240 CPU seconds, 384 MiB address space, niceness 10. A successful turn has at least a 60-second cooldown; abrupt death preserves a 300-second not-before timestamp. With one authorized turn, the next tick marks remaining work budget-exhausted without mapping. Expiry, fixed total row/account/turn caps and terminal state bound an abandoned opt-in.

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

The owner approved the merged deployment, this one additive migration and the capped calibration, including its reviewer opt-in/restart and cleanup. Migration application is complete; do not repeat it. Any authorization-system denial is a blocker to report, not permission to use another route.

Separate approval remains necessary for any longer campaign after measured calibration, recovery classification of ambiguous inactive sources, paired source/hydration activation, or restoration of a daily cron schedule. No retention, archive/export or production deletion is included.
