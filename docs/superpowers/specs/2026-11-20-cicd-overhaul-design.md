# CI/CD overhaul: migrations CD and Linux visual tests

Status: agreed 2026-11-20 (decisions in section 10). Scope agreed with Andrew: one spec, done before
redesign phase 0 development starts.

## 1. Goal

"A merge = a deploy, completely." Code on `main` is the absolute source of truth for the
database schema as well as the app. After this work:

- Every PR dry-runs its pending migrations by actually executing them against a
  prod-shaped database in CI. No PR run ever holds production credentials.
- Merging to `main` applies pending migrations to production through one GitHub Actions
  job, then the app deploys. Nobody applies SQL by hand, and agents never connect to the
  production database to write.
- Migrations classified as destructive wait for Andrew's approval in GitHub before they
  run.
- Both Playwright visual jobs run on Linux in a pinned Playwright container, and the
  authenticated visual test runs on every PR with no manual approval.

Out of scope: the redesign itself, Supabase Branching for previews (section 9), data
backfills, Railway service topology.

## 2. What exists today (verified 2026-11-20)

### 2.1 Migrations

- 66 hand-written files in `migrations/`, named `YYYY-MM-DD[-NN]-slug.sql`, applied by hand
  in filename order. `schema.sql` (4,011 lines) is the hand-maintained canonical schema;
  Python tests build their database from `schema.sql`, not from the migrations.
- Two ledgers, neither authoritative:
  - `supabase_migrations.schema_migrations` (Supabase/MCP history): 65 rows whose versions are
    the timestamps when they were applied and whose names don't match repo filenames.
  - `public.schema_migrations` (repo convention since 2026-07-01): 48 filenames, maintained by
    hand, with known gaps (see `docs/runbooks/migration-ledger-state.md`).
- **Two repo migrations are not applied in production**:
  `2026-10-15-15-identity-exploratory-pilot.sql` and
  `2026-10-16-16-identity-pilot-wal-assumption.sql`. They are absent from both ledgers, and a
  catalog check shows none of their effects (no `exploratory_pilot` column, no
  `lifecycle_identity_pilot_scope` / `lifecycle_identity_wal_bound` functions, no
  `identity_wal_basis` / `identity_observation_basis` constraints, `resident_wal_bytes` still
  NOT NULL). `schema.sql` already includes them, and `job_discovery/lifecycle/identity_campaign.py`
  references `exploratory_pilot`.
- **Drift check, `public` schema.** `schema.sql` was loaded into a scratch Postgres and its
  catalog fingerprint (columns, constraints, indexes, functions, policies, triggers, views,
  RLS flags) was compared with prod's using read-only queries. Everything matches except:
  - the effects of the two unapplied migrations above;
  - two cosmetic constraint names on `profiles`: prod has `reasoning_effort_cover_valid` and
    `reasoning_effort_resume_valid`, while `schema.sql` produces
    `profiles_reasoning_effort_{cover,resume}_check`. The definitions are identical.
  - Not compared yet: grants/ACLs, function owners, `storage`/`auth` schema objects,
    extensions. The baseline step (section 4) closes this gap with a real dump.
- Production: Supabase Pro org, Postgres 17.6. Railway services auto-deploy on push to
  `main` (watch patterns per service). Vercel Hobby auto-deploys `main` to production and
  every other push to a Preview.
- **Vercel Preview uses the production database.** `DATABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` and the Supabase URL/anon key are single env entries targeting
  both Preview and Production. Every branch preview, agent branches included, runs with prod
  database credentials.

### 2.2 Visual CI

- `ci.yml` job `public-visual` and `authenticated-visual.yml` run on `macos-14` only because
  the 156 baselines in `dashboard/tests/visual/__screenshots__` were made there. The July plan
  pinned this and a contract test enforces it
  (`dashboard/tests/visual/deployment-workflow-contract.test.ts`, `docs/ui-contracts.md`).
- The authenticated job triggers on `deployment_status` from Vercel Preview and reads 5
  secrets from the `visual-test` environment. Andrew removed that environment's Required
  reviewers rule on 2026-11-20. The repo is public, so Actions minutes are free.
- `@playwright/test` is `^1.61.1` (lockfile 1.61.1). The snapshot template
  `{testDir}/__screenshots__/{arg}{ext}` has no `{platform}` token.

## 3. Migrations: target design

### 3.1 Layout and tooling

- Adopt the Supabase CLI layout: `supabase/config.toml` (Postgres major 17) and
  `supabase/migrations/<14-digit UTC timestamp>_<slug>.sql`, created with
  `supabase migration new`.
- Pin the CLI to an exact version (currently v2.122.0; v3 is in beta) through
  `supabase/setup-cli@v3` with an explicit `version:`. A later upgrade is its own PR.
- `supabase_migrations.schema_migrations` becomes the only ledger. `public.schema_migrations`
  is frozen: no new inserts. Dropping it is a later, destructive, approved migration.
- The old `migrations/` folder moves to `migrations/archive/` (read-only history, never
  executed). A CI check fails if a new file appears there.

### 3.2 Migration file rules

Enforced in CI:

1. Each file is forward-only and runs inside the transaction the CLI gives it. Use no
   `BEGIN`/`COMMIT` and no inserts into `public.schema_migrations`. `CREATE INDEX
   CONCURRENTLY` goes in a file of its own, marked `-- migration: non-transactional`.
2. Each file opens with `SET lock_timeout = '5s';` and a `statement_timeout`, so a lock on a
   busy table fails fast instead of stalling production.
3. **Expand before contract.** A migration must work with the app code that is currently
   deployed. Removing or renaming anything happens in a later PR, after the code that stops
   using it has shipped.
4. **Migration PRs stand alone.** A PR that adds a migration may change only
   `supabase/migrations/`, `schema.sql`, tests, and docs. App code that uses the new schema
   comes in the next PR. This keeps prod-database previews and the authenticated visual
   test truthful (see 3.6), and gives deploy order for free: schema first, then code. Agents
   split work this way automatically.
5. `schema.sql` stays the hand-readable canonical schema, comments included, and tests keep
   using it. A CI gate (3.3) fails if it diverges from what the migrations produce.

### 3.3 PR CI: real dry run, no prod credentials

New job `migrations` in `ci.yml` (ubuntu-24.04):

1. `supabase start` (or `supabase db start`, whichever is enough for roles, `auth` and
   `storage`) brings up a local Supabase Postgres 17.
2. `supabase db reset` replays every file in `supabase/migrations`: the baseline (section 4),
   then every migration after it. Because the baseline equals prod's schema, this executes
   the PR's new SQL against a prod-shaped database.
3. **Schema-sync gate:** load `schema.sql` into a second scratch database and compare catalog
   fingerprints, extending the query used for this spec to cover grants and owners. Any
   difference fails the job and names the objects.
4. **Pending-set report:** the job summary lists the migration files this PR adds relative
   to `main`. Those are what will run on merge, since `main`'s files are applied by CD.
5. **Lint:** squawk on changed migration files, configured for locking and timeout rules.
6. **Destructive classifier:** a small script flags a file if squawk reports `ban-drop-*`,
   `ban-truncate-cascade`, `changing-column-type`, `renaming-column` or `renaming-table`, or
   if it contains `DROP` of a table/column/schema/function in use, `TRUNCATE`, or
   `DELETE`/`UPDATE` without `WHERE`. An author can force the flag with
   `-- migration: destructive` but can never clear it. The job passes; it labels the PR
   `destructive-migration` and writes a marker the CD job reads.
7. The existing Python acceptance suite keeps running on `schema.sql`.

Data-dependent failures (a NOT NULL column added to a table with nulls, a unique index on
duplicate data) are not caught here, because the scratch database has no prod data. The
mitigation is rule 2 plus expand/contract. CD fails cleanly and atomically per file if one
of these slips through.

### 3.4 CD on merge to main

New workflow `deploy.yml`, `on: push: branches: [main]`, with
`concurrency: { group: production-deploy, cancel-in-progress: false }`:

1. Job `plan-migrations` (no secrets): computes the pending set and whether any pending file
   is classified destructive.
2. Job `migrate`, needs `plan-migrations`, only if something is pending:
   - Runs in GitHub environment `production-db`, or in `production-db-destructive` if any
     pending file is destructive. Both environments are restricted by deployment branch policy
     to `main`, so no PR-branch run can read their secrets. `production-db-destructive` has
     Andrew as Required reviewer (available because the repo is public). Whether GitHub lets
     him approve a run triggered by his own account's merge is checked when it's built.
   - `supabase link --project-ref fdhspmavadgucktetzoi`, then
     `supabase db push --yes --linked` (or `--remote` on CLI v3), over the IPv4 session pooler
     if the direct IPv6 host is unreachable from runners.
   - After a successful push, re-runs the read-only schema fingerprint against prod and
     fails loudly if prod differs from `schema.sql`.
   - Writes the applied versions to the job summary.
3. Job `deploy-dashboard`, needs `migrate` (success or skipped): production deploy of
   Vercel via `vercel deploy --prod` (project-scoped `VERCEL_TOKEN`), with Vercel's own git
   deploy for `main` turned off in `dashboard/vercel.json`
   (`"git": {"deploymentEnabled": {"main": false}}`). Previews stay on Vercel's git
   integration.
4. Railway services: turn on **Wait for CI** for `poller`, `discovery`, and `reviewer-worker`.
   Railway then holds each `main` deploy until every Actions workflow on that commit
   finishes, and skips the deploy if `deploy.yml` fails. That is why `deploy.yml` must
   never cancel queued runs.
5. A migration failure stops the app deploy. The history table records only files that
   succeeded, so the next merge resumes. The fix is always a new forward commit, never a
   hand repair.

The CD job never pushes to `main`. Its pending set comes from `supabase migration list
--linked`, so no state file needs committing.

### 3.5 Secrets and who holds them

| Secret | Where | Who adds it |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` (project-scoped PAT) | env `production-db` and `production-db-destructive` | Andrew |
| `SUPABASE_DB_PASSWORD` | same two environments | Andrew |
| `VERCEL_TOKEN` (scoped to job-board-dashboard), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | env `production-deploy` (main only) | Andrew |
| visual-test's 5 secrets | env `visual-test`, unchanged, plus a `main`-only branch policy | already there |

Nothing is committed. Agents never see these values.

**Agent access to prod.** Today the Supabase connector in these sessions can run
`apply_migration` and write SQL against prod. After cutover, agents should only read prod.
Recommendation: Andrew switches the Supabase connector to read-only mode, or the channel
gets a standing rule: reads only, never `apply_migration`. A stray MCP-applied migration
would also break `db push`, since prod history would contain a version the repo doesn't know.

**Honest limit.** Anyone who can merge to `main` can change `deploy.yml` itself. The
destructive gate and the branch policies stop accidents and PR-branch exfiltration, not a
merged change to the pipeline. A CI check labels any PR touching `.github/workflows/**`,
`supabase/config.toml` or the classifier as `pipeline-change`. By channel rule, agents stop
and ask Andrew before merging those.

### 3.6 Previews, visual tests and schema timing

Previews read the prod database, so a PR whose code needs a not-yet-applied column would
render errors in its preview and fail the authenticated visual test. Rule 4 (migration PRs
stand alone) avoids that: the migration merges and applies first, and the feature PR's
preview then sees the new schema. The alternative, Supabase Branching, is deferred (section 9).

## 4. One-time cutover (baseline)

Executed by the pipeline. Each step that writes to prod runs as a GitHub Actions job Andrew
approves. Nothing is done from an agent session.

1. **Decide on the two unapplied identity-pilot migrations** (open question 1).
2. **Dump** (read-only, `workflow_dispatch`, env `production-db`): `supabase db dump`
   (schema only by default; excludes Supabase-managed schemas) into an artifact. An agent
   commits it as `supabase/migrations/<ts>_baseline.sql` on a branch.
3. **Verify baseline** in CI: replay the baseline locally and compare the full fingerprint,
   now including grants, owners and storage policies, against prod (read-only) and against
   `schema.sql` minus the pilot changes. Fix `schema.sql` drift, including the two
   `profiles` constraint names, by editing `schema.sql`. The names in prod win.
4. **Re-baseline history** (prod metadata write, approved job):
   - copy `supabase_migrations.schema_migrations` to
     `supabase_migrations.schema_migrations_pre_cd` (keeps the 65-row history and its
     statements);
   - `supabase migration repair --status reverted` for the 65 old versions;
   - `supabase migration repair --status applied <baseline_ts>`.
   This runs no schema SQL. It only changes the history table, so prod's schema is untouched.
5. Merge the cutover PR. `deploy.yml` sees nothing pending, so this is a no-op deploy.
6. The pilot migrations, if kept, ship as the first real migration PR. That proves the whole
   path end to end. It touches constraints, so it is classified destructive and waits for
   Andrew's approval.
7. Update README, `docs/runbooks/migration-ledger-state.md` (final checkpoint, then frozen),
   the migration section of `AGENTS.md`/`CLAUDE.md`, and the redesign plan, whose three
   manual migration batches become ordinary migration PRs.

## 5. Visual tests on Linux

1. Pin `@playwright/test` to an exact version: the lockfile's 1.61.1, or upgrade to 1.64.1
   in the same PR. The container tag follows it.
2. `public-visual` and `authenticated-visual` run on `ubuntu-24.04` with
   `container: mcr.microsoft.com/playwright:v<version>-noble` (`--user 1001`, `--ipc=host`
   where needed), without `playwright install`.
3. **Authenticated trigger:** switch from `deployment_status` to
   `repository_dispatch: types: [vercel.deployment.success]`. Repository-dispatch workflows
   always run from `main`'s copy of the workflow, so a PR cannot edit the workflow that
   reads the secrets. The job filters on `environment == preview`, checks out
   `client_payload.git.sha`, skips forks and bots, and posts a commit status
   `Authenticated visual` on that SHA so it shows on the PR.
   Keep `deployment_status` running in parallel for one PR to confirm parity, then remove it.
4. Keep the `visual-test` environment for secret scoping, no reviewers, with a `main`-only
   deployment branch policy, which works because dispatch runs are on `main`.
5. **Regenerate baselines:** a `workflow_dispatch` job `visual-baselines` (public and
   authenticated scopes) runs `--update-snapshots` in the same container on a non-`main`
   branch and commits the PNGs to that branch for review in the PR diff. This replaces
   "generate on macos-14 and download". The guard that no ordinary CI workflow runs
   `--update-snapshots` stays. A local Docker script is documented for Andrew too.
6. A Playwright config guard refuses `--update-snapshots` when `process.platform !== 'linux'`,
   so a stray Mac run cannot overwrite Linux baselines.
7. Update the contract tests (`deployment-workflow-contract.test.ts`, `auth-setup-contract`
   if it pins the OS), `docs/ui-contracts.md`, and a superseding note on the two July visual
   CI docs. Remove the redesign plan's "Mac screenshot baselines" stop.
8. Required checks on `main`: `Public visual` and `Authenticated visual` become required,
   along with the new `Migrations` job.

## 6. Order of work

1. Visual on Linux (independent and low risk; unblocks the redesign plan's baseline stop).
2. Migrations tooling and PR CI (`supabase/`, archive move, lint, classifier, schema-sync).
3. Cutover (section 4), with Andrew's approvals.
4. `deploy.yml` with Vercel deploy and Railway Wait for CI.
5. First real migration through the pipeline (the pilot pair, if kept).

## 7. Steps only Andrew can do

- Add the secrets in 3.5 and create environments `production-db`,
  `production-db-destructive` (himself as reviewer), and `production-deploy`.
- Turn on Railway Wait for CI on the three services, or allow an agent to do it via the
  Railway connector.
- Approve the cutover's prod-writing jobs and every destructive migration.
- Optionally switch the Supabase connector to read-only.
- Mark the new checks as required in branch protection.

## 8. Success criteria

- A PR adding a broken migration fails `Migrations` before merge.
- Merging a safe migration PR applies it to prod with no human step, and prod's
  fingerprint then matches `schema.sql`.
- Merging a destructive one pauses until Andrew approves, and the app deploy waits behind it.
- A migration failure on `main` blocks the Vercel and Railway deploys for that commit.
- No PR-branch workflow can read a prod secret.
- Both visual suites pass on Linux, the authenticated one on every PR, with no approval.

## 9. Deferred: Supabase Branching for previews

The org is on Pro, so a per-PR preview database is possible (Micro compute from about
$0.013/hour per open branch). It would stop previews from running with prod credentials and
let a PR's preview include its own migrations. Costs: it needs seeded test accounts and
data, the visual baselines would be rebuilt against seed data, and it changes how previews
get env vars. Worth revisiting once the redesign has real data needs.

## 10. Decisions (Andrew, 2026-11-20: "Yes, all four")

1. The two unapplied identity-pilot migrations (2026-10-15-15, 2026-10-16-16) ship as the
   pipeline's first real migration PR, classified destructive, so they wait for Andrew's
   approval in the `production-db-destructive` environment. Agreement on direction is not
   approval to apply; the GitHub gate is.
2. Vercel's git deploy of `main` is turned off; production deploys from `deploy.yml` after
   `migrate` succeeds or is skipped.
3. Migration PRs stand alone (rule 3.2.4); Supabase Branching stays deferred.
4. The Supabase connector used by agent sessions is switched to read-only (Andrew's setting);
   the pipeline is the only writer to prod.
