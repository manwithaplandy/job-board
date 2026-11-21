# Migrations pipeline

Schema changes ship as SQL files in `supabase/migrations/`. Every pull request replays
them on a throwaway local database. **Applying them to production on merge is not live yet**
(it arrives with the deploy workflow in phase 4 of the
[CI/CD overhaul plan](../superpowers/plans/2026-11-20-cicd-overhaul.md)). Until the cutover
PR merges, do not add migrations at all.

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
6. `<version>_baseline.sql` and `<version>_baseline_storage.sql` (exactly these names: the cutover
   baseline) are exempt from 2 to 5 and from squawk. They are a dump of production.

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
- `destructive-migration`: the PR adds a migration the classifier flags. On merge it will
  wait for approval on the `production-db-destructive` environment.

## Production workflows

Both are manual (`workflow_dispatch`) and use GitHub environments that hold the Supabase
secret. Agents never apply SQL to production; the pipeline does.

**Credential.** The only production credential is `SUPABASE_DB_URL`, a secret on the
`production-db` and `production-db-destructive` environments. It is the **Session pooler**
string from the Supabase dashboard's **Connect** button (IPv4, port 5432, user
`postgres.fdhspmavadgucktetzoi`) with the database password filled in. There is no Supabase
access token: every CLI call takes `--db-url "$PROD_DSN"` instead of `supabase link`, and
`psql` and the fingerprint tool use the same DSN. `tools/migrations/prod_dsn.py` builds
`$PROD_DSN` from the secret: it refuses any other host, port, user or database, percent-encodes
the password (pasted raw or already encoded), adds `sslmode=require`, masks the DSN and the
password in the log, and passes the DSN only to the command it wraps. A contract test fails
if any workflow mentions `SUPABASE_ACCESS_TOKEN`, `supabase link` or `--linked`, or hands
the secret to a command without `prod_dsn`. To rotate it, reset the database password in
Supabase and paste the new string into both environments.

- `Database operations (read-only)` (`db-ops.yml`), environment `production-db`:
  `dump` uploads a schema-only dump and the migration history; `fingerprint` uploads a
  catalog fingerprint. It connects through the session pooler (port 5432) with
  `SUPABASE_DB_URL`.
- `Cutover history re-baseline` (`cutover-rebaseline.yml`): run once during the cutover.
  The `plan` job is read-only and prints the repair commands. The `apply` job runs only with
  `dry_run` off, waits for approval on `production-db-destructive`, backs up the history
  table (so it cannot run twice), repairs the history to the two baseline versions, checks
  local and remote history match, and proves the schema fingerprint did not change.

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
