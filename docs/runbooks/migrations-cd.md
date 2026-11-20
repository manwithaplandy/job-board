# Migrations pipeline

Schema changes ship as SQL files in `supabase/migrations/`. Every pull request replays
them on a throwaway local database, and every merge to `main` applies the pending ones to
production through the `Deploy` workflow before the dashboard ships (see
[Deploy on merge](#deploy-on-merge)). Until the cutover PR merges, do not add migrations at
all.

The hand-applied history lives in `migrations/archive/`. It is frozen: a checksum test
fails if any file there changes, and no new file may be added.

## Adding a migration

1. `supabase migration new <lower_snake_slug>` creates
   `supabase/migrations/<14-digit version>_<slug>.sql`. Never rename or reuse a version.
2. Start the file with the two timeouts, then the change:

   ```sql
   SET lock_timeout = '5s';
   SET statement_timeout = '60s';

   ALTER TABLE public.widget ADD COLUMN note text;
   ```

3. Mirror the change into `schema.sql`, which the Python acceptance suite still loads.
4. Open a PR that contains only the migration, `schema.sql`, tests and docs. Ship the code
   that uses the new schema in a later PR. Vercel previews read the production database, so
   code that needs a new column cannot be previewed before the column exists.

## File rules

`tools/migrations/check_rules.py` enforces these on every file in `supabase/migrations/`:

1. The name is `<14-digit version>_<lower_snake_slug>.sql`.
2. The first statement is `SET lock_timeout = '<n>s'` with n at most 5 (or the same in ms).
   The second is `SET statement_timeout` with a positive value.
3. No top-level `BEGIN`, `START TRANSACTION`, `COMMIT`, `ROLLBACK` or `ABORT`. The Supabase
   CLI runs each file in its own transaction.
4. No reference to `schema_migrations`. The CLI keeps the migration history.
5. `CONCURRENTLY` only in a file whose first line is `-- migration: non-transactional` and
   that holds the two `SET`s and exactly one statement. Use `IF NOT EXISTS` there (squawk
   asks for it), because such a file is not atomic and may need a rerun.
6. `*_baseline.sql` and `*_baseline_storage.sql` (the cutover baseline) are exempt from 2 to 5.

A merged migration is never edited, renamed or deleted. Fix it forward with a new file.

## What the PR checks mean

The `Migrations` job in `.github/workflows/ci.yml` uses no secrets and never touches
production.

| Step | Fails when |
| --- | --- |
| Unit-test migration tooling | a tool in `tools/migrations/` is broken |
| Check PR scope | a PR adds a migration next to other code, edits a merged migration or the archive, or adds a version older than the newest one on `main` |
| Check migration file rules | a file breaks a rule above |
| Lint changed migrations | squawk finds anything other than a destructive change (drops, renames, type changes, `TRUNCATE ... CASCADE`); destructive changes are allowed here and gated at deploy |
| Classify destructive migrations | never; it writes the classification to the job summary |
| Start local Supabase, Replay migrations | a migration does not apply cleanly from scratch |
| Schema-sync gate | the replayed schema differs from `schema.sql` beyond `supabase/fingerprint-ignore.json` and `supabase/schema-sync-expected-diff.json` (dormant until the baseline exists) |
| Baseline equals prod snapshot | the baseline files no longer rebuild the schema captured from production at cutover (dormant until the baseline exists) |

A file counts as destructive when squawk or `tools/migrations/classify.py` finds a drop,
a column type change, a rename, a `TRUNCATE`, or a `DELETE`/`UPDATE` without `WHERE`. An
author can force the flag with a `-- migration: destructive` comment; nothing can clear it.

## Labels

The `Pipeline guard` job only adds labels, never removes them:

- `pipeline-change`: the PR edits `.github/workflows/`, `supabase/config.toml`,
  `tools/migrations/`, `.squawk.toml` or `requirements-ci.txt`.
- `destructive-migration`: the PR adds a migration the classifier flags. On merge, the
  `Migrate` job waits for approval on the `production-db-destructive` environment.

## Production workflows

Both are manual (`workflow_dispatch`) and use GitHub environments that hold the Supabase
secrets. Agents never apply SQL to production; the pipeline does.

- `Database operations (read-only)` (`db-ops.yml`), environment `production-db`:
  `dump` uploads a schema-only dump and the migration history; `fingerprint` uploads a
  catalog fingerprint. It connects through the session pooler (port 5432) with a read-only
  session.
- `Cutover history re-baseline` (`cutover-rebaseline.yml`): run once during the cutover.
  The `plan` job is read-only and prints the repair commands. The `apply` job runs only with
  `dry_run` off, waits for approval on `production-db-destructive`, backs up the history
  table (so it cannot run twice), repairs the history to the two baseline versions, checks
  local and remote history match, and proves the schema fingerprint did not change.

## Deploy on merge

`Deploy` (`.github/workflows/deploy.yml`) runs on every push to `main` and by hand. Runs
queue in one `production-deploy` group and never cancel each other.

1. **Plan migrations** (no secrets). Lists migration files added since the last successful
   `Deploy` run on `main` (all non-baseline files if there is none), lints them with squawk
   and classifies them. Any destructive candidate, or `treat_as_destructive` on a manual run,
   picks the approval-gated environment for the next job.
2. **Migrate**, in `production-db`, or in `production-db-destructive` when step 1 found
   something destructive. Skipped when nothing was added, except on a manual run. It links
   the project, reads `supabase migration list`, and fails closed when production's history
   has a version the repository does not know, or when a destructive file is pending outside
   the approval-gated environment. Then it runs `supabase db push`, checks the history is in
   sync, and compares a production fingerprint with `schema.sql`.
3. **Deploy dashboard**, in `production-deploy`, only after Migrate succeeded or was skipped.
   It builds with the Vercel CLI from the repository root and deploys to production. Vercel's
   git integration no longer deploys `main` (`dashboard/vercel.json`); previews still come
   from it.

**A waiting `Migrate` job** means a destructive migration is pending. Andrew reviews the
plan summary and the PR, then approves or rejects the job on the run page. Every later merge
waits behind it in the same group, so decide promptly.

**When Migrate fails**, nothing after the failing file was applied: each file is atomic, and
the history table holds only files that succeeded. Fix forward with a new migration. Never
repair the history by hand. The dashboard stays on its previous deployment.

**Re-running:** dispatch `Deploy` from `main`. `dry_run` (the default for manual runs) links,
lists, gates and runs `db push --dry-run`, and builds the dashboard without deploying.

**Railway** services (`poller`, `discovery`, `reviewer-worker`, `spend-alert`) use Wait for
CI, so a merge's Railway deploys wait until `CI` and `Deploy` finish. A run waiting for
approval holds them too.

**Honest limit:** migrations and the dashboard deploy in sequence, but the Railway services
and the dashboard do not switch over at the same instant. Keep migrations backward
compatible with the code that is running (add first, remove in a later PR).

## Supabase CLI behaviour (v2.122.0)

Checked on 2026-11-20 with `supabase migration up --db-url` against a local Postgres 16,
which uses the same apply code as `db reset`, `db push` and the deploy workflow:

1. A file whose last statement fails leaves nothing behind: the earlier `CREATE TABLE` in
   the same file was rolled back and the version was not recorded. Each file is atomic.
2. `CREATE INDEX CONCURRENTLY` runs, alone or after the two `SET`s. That is why rule 5
   allows it in a non-transactional file.
3. `SET lock_timeout` and `SET statement_timeout` are accepted, and they do not carry over
   to the next file: a 100 ms timeout set in one file did not stop a 500 ms sleep in the next.

Open item: confirm the same behaviour inside the Docker-based local stack the first time a
real migration runs through the `Migrations` job.
