# Migration ledger state and verification

These are read-only production checkpoints, not authorization to run or repair SQL.
The initial checkpoint was verified on 2026-10-10 at 20:03–20:05 UTC against Supabase project
`fdhspmavadgucktetzoi`, using `list_migrations` and read-only `execute_sql` queries.
Repository source inspected at `16345d10d0e0910766ce0c7a8c81776f08feb778`.
Neither ledger, schema, nor production configuration was changed.

## Pre-existing classification gap — October 10 (historical)

| Evidence | Verified state |
| --- | --- |
| Repository migration | `migrations/2026-08-23-classification-all-mode.sql` |
| Supabase history (`supabase_migrations.schema_migrations`) | Version `20260824012132`, name `classification_all_selection_mode`, present |
| Application filename ledger (`public.schema_migrations`) | `2026-08-23-classification-all-mode.sql`, absent |
| Actual constraint on `public.classification_jobs` | `classification_jobs_selection_mode_check`, validated; permits `unclassified`, `unknown_repass`, and `all` |

These ledgers record different identifiers and are not automatically synchronized.
The repository ledger was introduced by
`migrations/2026-07-01-schema-migrations-and-fk-drift.sql` as a manually maintained
filename/`applied_at` table. The classification migration contains `BEGIN`/`COMMIT`
and replaces the selection-mode check constraint, but contains **no insert into
`public.schema_migrations`**. Applying those SQL bytes can therefore leave a
Supabase history record without the corresponding application filename record.
This explains how the observed states can coexist; the historical execution route
and exact SQL bytes submitted at that time were not reconstructed in this audit.

The actual validated constraint matches the migration's intended schema effect.
Absence from `public.schema_migrations` alone does not establish that the migration
was never applied and does not justify rerunning it. This is a pre-existing ledger
gap, left untouched by the October 10 documentation audit.

The migration permits whole-corpus classification mode; it does not itself launch
a classification run or modify company classifications. In the inspected worker,
`company_discovery/jobs_db.py` includes `all` in `_BEFORE_BOUND_MODES` and
`select_targets` uses the supplied run-start bound to avoid selecting companies
already classified during that run. This source inspection is not verification
of the deployed worker revision or successful historical classification runs.

## Lifecycle release checkpoint — October 10 (historical)

At that checkpoint, both ledgers contained **zero of the 13 lifecycle release migrations**
listed in [the additive rollout sequence](job-lifecycle-outbox.md#additive-rollout-sequence).
Supabase history ends with the October 2 matching/activity and feedback entries;
the application ledger also contains their filenames. Read-only catalog checks
find `public.lifecycle_control`, `public.source_accounts`, and
`public.source_listings` absent. The release is therefore not verified as applied
or complete at this checkpoint. This finding is separate from the older
classification ledger gap and must be refreshed if another operator executes SQL.
This audit did not retry the previously failing migration tool, merge, deploy,
enable controls, run backfills, or activate retirement/archive operations.

## Lifecycle release checkpoint — October 13

Fresh read-only verification at 00:45–00:48 UTC on 2026-10-13 confirms **all 13
lifecycle release migrations in both ledgers**, applied on October 12 between
23:18:25 and 23:49:37 UTC. They must not be reapplied. This supersedes the October
10 migration-status checkpoint without rewriting its historical evidence.

Schema installation is not operational rollout completion. The control row still
has safety stage `legacy`, generation 0 and all feature flags off; retirement is
disabled/dry-run and archive remains never-activated/export-off. Source account
and listing mapping counts are both zero. The only writer readiness row is the
migration-created `demand_snapshots` placeholder, with no `validated_at` or
`source_revision`. Backfill and deployed-writer verification remain required
before the applicable staged activation gates. No deletion or archive activation
follows from the ledger entries.

A separate fresh check at 00:49–00:50 UTC finds the August classification filename
now present in `public.schema_migrations`, with `applied_at` recorded as
`2026-08-24 01:21:32+00`. The Supabase history entry and validated three-mode
constraint still match. This release executor did not insert or modify that row;
the actor, reconciliation time and supporting historical provenance were not
verified. Preserve the October 10 gap as historical evidence and do not infer a
rerun or an independently verified original application time from the new row.

## Audit procedure and next steps

Use an authorized service connection for these read-only queries:

```sql
SELECT now() AS checked_at, version, name
FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT now() AS checked_at, filename, applied_at
FROM public.schema_migrations ORDER BY filename;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.classification_jobs'::regclass
  AND conname = 'classification_jobs_selection_mode_check';

SELECT to_regclass('public.lifecycle_control') AS lifecycle_control,
       to_regclass('public.source_accounts') AS source_accounts,
       to_regclass('public.source_listings') AS source_listings;
```

Compare history names/versions to repository files and inspect the relevant schema
effects; do not assume a one-to-one filename match or use a single ledger as the
sole replay decision. Supabase's [migration documentation](https://supabase.com/docs/guides/deployment/database-migrations)
describes its own history tracking; the application filename ledger is a repository
convention.

Do not repair the historically missing filename again: the October 13 check finds
it present. Any separate reconciliation review should establish provenance and matching effects, then
decide whether a metadata-only reconciliation is appropriate, including how to
represent the historical application time without inventing it. Do not rerun the
classification DDL merely to create a filename record, and do not modify either
ledger as part of a read-only audit. For any later release execution, freshly
verify both ledgers and actual effects against the reviewed migration packet,
retain existing production safeguards, and verify each successful application
before proceeding.
