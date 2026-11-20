# CI/CD Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A merge to `main` applies pending migrations to production through one approved
GitHub Actions path and then deploys the app; both visual suites run on Linux on every PR.

**Spec:** `docs/superpowers/specs/2026-11-20-cicd-overhaul-design.md` (agreed, section 10 decisions).

**Architecture:** Five PRs in the spec's order of work. Each is independently mergeable and
leaves `main` green and deployable. Python tooling lives in `tools/migrations/` with pure unit
tests; workflows are pinned by vitest contract tests that read the YAML (the repo's existing
pattern). Production is only ever touched by Actions jobs in `main`-only environments.

**Tech stack:** GitHub Actions, Supabase CLI v2.122.0 (`supabase/setup-cli@v3`), squawk,
Python 3.12 + psycopg, Playwright 1.64.1 in `mcr.microsoft.com/playwright:v1.64.1-noble`,
Vercel CLI, Railway Wait for CI.

## Rules for everyone executing this plan

- **Never rewrite commits** (`CLAUDE.md`): no amend, rebase, reset, force-push. Fix forward.
- **Agents never write to prod.** No `apply_migration`, no `execute_sql` writes, no
  `supabase db push`/`repair` from a session, no Vercel/Railway setting changes. Prod-writing
  steps exist only as Actions jobs Andrew approves. Read-only prod queries are not needed by
  this plan either; the pipeline produces every prod fact as an artifact.
- **Every PR in this plan is a `pipeline-change`.** Agents open the PR, get it green, then
  STOP. Andrew reviews and merges all five.
- Agent sandboxes have no Docker daemon. Anything needing Postgres, the Supabase stack or
  Playwright browsers is verified in CI, not locally. Pure unit tests run locally.
- Commit after each task. One branch and one PR per phase.

## Spec issues found

The plan stays consistent with the spec. These are the places where the spec is silent,
contradicts itself, or needs a choice; each lists how the plan resolves it.

1. **`plan-migrations` has "no secrets" (3.4.1) but the pending set "comes from
   `supabase migration list --linked`" (3.4 last paragraph).** Listing needs prod credentials,
   and the environment must be chosen before the job that holds them starts. Resolution:
   `plan-migrations` computes a secret-free *candidate* set (migration files added since the
   last successful `deploy.yml` run on `main`) and classifies it; `migrate` then gets the
   authoritative set from `migration list` and **fails closed** if it finds a destructive
   pending file while running in the non-reviewed environment.
2. **"Writes a marker the CD job reads" (3.3.6) has no storage location.** A PR job cannot
   commit. Resolution: the classifier is deterministic, so CD re-runs it from `main`'s copy.
   The PR label is informational only.
3. **`supabase db dump` excludes the `storage` schema**, but prod has RLS policies on
   `storage.objects` for the `resumes` bucket, and `schema.sql` deliberately omits them.
   Resolution: a second hand-written baseline file carries the storage policies; the storage
   section of the fingerprint is compared replay-vs-prod only, never against `schema.sql`.
4. **The schema-sync gate cannot be green between phases 2 and 5 as written.** No baseline
   exists in phase 2, and from phase 3 until phase 5 `schema.sql` contains the pilot pair
   that prod and the baseline lack. Resolution: the gate activates when a baseline file
   exists, and a committed expected-diff list (`supabase/schema-sync-expected-diff.json`)
   names the pilot objects until phase 5 empties it. Stale entries fail the gate.
5. **`workflow_dispatch` workflows must be on `main` before they can run**, but the cutover
   dump is needed to *build* the cutover PR, and Linux baselines are needed to make the
   visual PR green. Resolution: the read-only dump/fingerprint and the re-baseline workflows
   ship in phase 2; phase 1 bootstraps baselines through a temporary push trigger on the PR
   branch that a later commit removes before merge.
6. **A required `Authenticated visual` status never arrives for commits without a same-repo
   Vercel Preview** (Dependabot and other bot PRs, forks). Those PRs will sit blocked.
   Resolution kept to the spec (skip bots and forks); Andrew merges those by override, or
   decides later to post a "skipped" success for bots.
7. **`repository_dispatch` protects the workflow file, not the test code.** The job still
   checks out and runs the PR's `npm ci` and Playwright code with `visual-test` secrets, as
   today. The fork/bot skip is the only guard. Stated so nobody over-trusts it.
8. **The `main`-only branch policy on `visual-test` breaks the legacy `deployment_status`
   run and any baseline job dispatched from a branch.** Resolution: Andrew adds the policy
   only after the legacy trigger is removed (phase 2, Task 2.1), and the baseline workflow
   is always dispatched from `main` with the target branch as an input.
9. **Railway has four services, not three.** `railway.spend-alert.json` also watches
   `schema.sql` and auto-deploys. The spec lists three for Wait for CI. The STOP asks Andrew
   to decide on the fourth (recommended: turn it on too).
10. **`-- migration: non-transactional` assumes the CLI can run a file outside a
    transaction.** Unverified for v2.122.0. Task 2.9 tests it in CI; until it passes, the
    rule checker rejects `CONCURRENTLY` outright.
11. **Pushes made with `GITHUB_TOKEN` do not trigger workflows**, so a baseline commit made
    by `visual-baselines` has no CI run of its own. The next agent commit on the branch
    triggers CI; the plan always follows a baseline commit with one.
12. **Rule 3.2.4's allowed paths omit the expected-diff list and cutover snapshots.** The
    stand-alone check also allows `supabase/schema-sync-expected-diff.json` and
    `supabase/snapshots/**`.
13. **The "redesign plan" (4.7, 5.7) is not in this repo.** Its edits (three manual migration
    batches, the "Mac screenshot baselines" stop) are left to the main session.
14. **"Project-scoped `VERCEL_TOKEN`" (3.5):** Vercel access tokens are scoped to an account
    or team as far as I know, not to one project. Andrew should create it with the narrowest
    scope Vercel offers and an expiry.

## File map

| Path | Phase | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | 1, 2 | Linux `public-visual`; new `migrations` and `pipeline-guard` jobs |
| `.github/workflows/authenticated-visual.yml` | 1, 2 | `repository_dispatch` trigger, container, commit status |
| `.github/workflows/visual-baselines.yml` | 1 | `workflow_dispatch` baseline regeneration |
| `.github/workflows/db-ops.yml` | 2 | read-only `dump` and `fingerprint` of prod |
| `.github/workflows/cutover-rebaseline.yml` | 2 (deleted in 5) | one-time history re-baseline |
| `.github/workflows/deploy.yml` | 4 | plan, migrate, deploy dashboard |
| `dashboard/playwright.config.ts`, `dashboard/tests/visual/snapshot-platform-guard.ts` | 1 | refuse snapshot updates off Linux |
| `dashboard/scripts/visual-baselines-docker.sh` | 1 | local Docker baseline script for Andrew |
| `dashboard/tests/visual/deployment-workflow-contract.test.ts` | 1, 2 | visual workflow contracts |
| `dashboard/tests/ci/pipeline-workflow-contract.test.ts` | 2, 4 | migrations and deploy workflow contracts |
| `supabase/config.toml`, `.squawk.toml`, `requirements-ci.txt` | 2 | CLI config (PG 17), lint config, pinned CI tools |
| `tools/migrations/{fingerprint,classify,check_rules,pr_scope,pending}.py` | 2 | pipeline tooling |
| `tests/migration_tooling/test_*.py` | 2 | unit tests (no DB) |
| `migrations/archive/**` | 2 | the 66 old files, frozen |
| `supabase/migrations/<ts>_baseline.sql`, `<ts+1>_baseline_storage.sql` | 3 | baseline |
| `supabase/snapshots/prod-fingerprint-cutover.json`, `supabase/schema-sync-expected-diff.json`, `supabase/fingerprint-ignore.json` | 2, 3, 5 | gate inputs |
| `dashboard/vercel.json` | 4 | `git.deploymentEnabled.main = false` |
| `schema.sql`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/ui-contracts.md`, `docs/runbooks/migration-ledger-state.md`, `docs/runbooks/migrations-cd.md` | 1–5 | docs and schema fixes |

---

# Phase 1: Visual tests on Linux (PR 1)

Branch `cicd/1-visual-linux`. Decision: upgrade `@playwright/test` to exact `1.64.1` now,
because every baseline is regenerated in this PR anyway and a later upgrade would regenerate
them again.

### Task 1.1: Rewrite the contract tests for the Linux target (failing first)

**Files:** `dashboard/tests/visual/deployment-workflow-contract.test.ts`

- [ ] Replace the two macOS tests ("runs public visual baselines in a dedicated pinned macOS
  job…", "runs deployment visuals on the canonical macOS baseline platform") with tests that
  assert, for `public-visual` in `ci.yml` and `authenticated-visual` in
  `authenticated-visual.yml`:
  - `runs-on: ubuntu-24.04`; no `macos`; no `playwright install`.
  - `image: mcr.microsoft.com/playwright:v${version}-noble`, where `version` is read from
    `dashboard/package.json` `devDependencies["@playwright/test"]`, and that value matches
    `/^\d+\.\d+\.\d+$/` (exact pin, no caret).
  - `options: --user 1001 --ipc=host`.
- [ ] Replace the docs test: `docs/ui-contracts.md` must contain "The canonical screenshot
  baseline platform is the pinned Playwright Linux container" and "Generate baseline updates
  with the `Visual baselines` workflow", must still contain "inspect every changed PNG" and
  "Never loosen screenshot tolerances", and must not contain `macos-14`.
- [ ] Replace "accepts only successful Vercel Preview deployment status events" and the
  SHA/URL tests with the new trigger contract (Task 1.4 lists the exact strings).
- [ ] Add: `visual-baselines.yml` is the only workflow file containing `--update-snapshots`;
  its `on:` has `workflow_dispatch` (the bootstrap `push` trigger is asserted absent in
  Task 1.9, not here).
- [ ] Run `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts`.
  Expected: the new tests FAIL, the untouched ones pass.
- [ ] Commit: `test: pin visual workflows to the Playwright Linux container`.

### Task 1.2: Pin Playwright and add the snapshot-platform guard

**Files:** `dashboard/package.json`, `dashboard/package-lock.json`,
`dashboard/tests/visual/snapshot-platform-guard.ts`,
`dashboard/tests/visual/snapshot-platform-guard.test.ts`, `dashboard/playwright.config.ts`

- [ ] Write the failing test first:

```ts
import { describe, expect, test } from "vitest";
import { assertSnapshotUpdatePlatform } from "./snapshot-platform-guard";

describe("snapshot update platform guard", () => {
  test.each([["--update-snapshots"], ["-u"], ["--update-snapshots=all"]])(
    "refuses %s off Linux", (flag) => {
      expect(() => assertSnapshotUpdatePlatform(["playwright", "test", flag], "darwin"))
        .toThrow(/Linux/);
    });
  test("allows updates on Linux and ordinary runs anywhere", () => {
    expect(() => assertSnapshotUpdatePlatform(["test", "-u"], "linux")).not.toThrow();
    expect(() => assertSnapshotUpdatePlatform(["test"], "darwin")).not.toThrow();
  });
});
```

- [ ] Implement `assertSnapshotUpdatePlatform(argv: readonly string[], platform: string): void`
  (throws `Error("Visual baselines are Linux-only: run the Visual baselines workflow or
  scripts/visual-baselines-docker.sh")`). Call it at the top of `playwright.config.ts` with
  `process.argv, process.platform`.
- [ ] `cd dashboard && npm install --save-exact --save-dev @playwright/test@1.64.1`. Confirm
  `package.json` shows `"@playwright/test": "1.64.1"` and the lockfile resolves `playwright`
  and `playwright-core` to 1.64.1.
- [ ] Run `npx vitest run tests/visual/snapshot-platform-guard.test.ts` → PASS;
  `npm run typecheck` → clean.
- [ ] Commit.

### Task 1.3: Move `public-visual` to the container

**Files:** `.github/workflows/ci.yml`

- [ ] In job `public-visual`: `runs-on: ubuntu-24.04`; add

```yaml
    container:
      image: mcr.microsoft.com/playwright:v1.64.1-noble
      options: --user 1001 --ipc=host
```

  Delete the "Install visual regression browser" step. Keep `setup-node@v6` (node 22), the
  three inert env placeholders, and the failure-evidence upload unchanged.
- [ ] Run the contract test: the `public-visual` assertions pass.
- [ ] Commit. The job will be red in CI until Task 1.7 (no Linux baselines yet). Expected.

### Task 1.4: Switch the authenticated workflow to `repository_dispatch` (legacy trigger kept)

**Files:** `.github/workflows/authenticated-visual.yml`

- [ ] Triggers and permissions:

```yaml
on:
  repository_dispatch:
    types: [vercel.deployment.success]
  deployment_status:   # legacy parity; removed in plan Task 2.1

permissions:
  contents: read
  statuses: write
  pull-requests: read
```

- [ ] Job `authenticated-visual`: `runs-on: ubuntu-24.04`, same container block as 1.3,
  `environment: { name: visual-test, deployment: false }` unchanged. Job-level `if:` accepts
  either event:
  - dispatch: `github.event_name == 'repository_dispatch' && github.event.client_payload.environment == 'preview'`
  - legacy: the existing five `deployment_status` conditions, unchanged.
- [ ] Job-level `env` resolves the event once (no secrets):
  `TARGET_SHA: ${{ github.event.client_payload.git.sha || github.event.deployment.sha }}` and
  `VISUAL_BASE_URL: ${{ github.event.client_payload.url || github.event.deployment_status.environment_url }}`.
- [ ] New first step `Resolve target` (uses `GH_TOKEN: ${{ github.token }}`, no secrets):
  validates `TARGET_SHA` matches `^[0-9a-f]{40}$`; calls
  `gh api repos/$GITHUB_REPOSITORY/commits/$TARGET_SHA/pulls`; sets output `run=false` when
  no open PR has `head.repo.full_name == $GITHUB_REPOSITORY`, or when the PR author's
  `type` is `Bot`. Every later step gets `if: steps.target.outputs.run == 'true'` (cleanup
  keeps `always() &&`).
- [ ] Checkout uses `ref: ${{ env.TARGET_SHA }}`. "Validate deployment URL" keeps its script
  but first prepends `https://` when the payload URL has no scheme, and writes the normalised
  value to `$GITHUB_ENV`. It still runs before any install and still contains no `secrets.`.
- [ ] Add `Post pending status` (right after `Resolve target`) and `Post final status`
  (`if: always() && steps.target.outputs.run == 'true'`), both calling
  `gh api repos/$GITHUB_REPOSITORY/statuses/$TARGET_SHA -f context='Authenticated visual'
  -f state=<pending|success|failure> -f target_url=$RUN_URL`. Only for dispatch events
  (`github.event_name == 'repository_dispatch'`), so the legacy run does not double-post.
- [ ] Delete "Install visual regression browser". Leave the credential preflight, the secret
  scoping of the setup and comparison steps, the PNG-only upload and the cleanup step
  byte-for-byte, so the existing scoping tests keep passing.
- [ ] Update the contract test strings from Task 1.1 to match, then run it → PASS.
- [ ] Commit.

### Task 1.5: Add the `Visual baselines` workflow and local script

**Files:** `.github/workflows/visual-baselines.yml`,
`dashboard/scripts/visual-baselines-docker.sh`, `dashboard/package.json`

- [ ] Workflow: `name: Visual baselines`; inputs `branch` (required), `scope`
  (`public` | `authenticated`), `preview_url` (required for `authenticated`).
  `permissions: contents: write`. Same container. Steps:
  1. Fail if `inputs.branch` is `main` or does not exist.
  2. `actions/checkout@v7` with `ref: ${{ inputs.branch }}`.
  3. `npm ci`.
  4. public: `npm run test:visual:update`. authenticated: validate `preview_url` with the
     same script as Task 1.4, run `npm run test:visual:auth-setup`, then
     `npm run test:visual:authenticated -- --update-snapshots` with the same secret scoping
     as the comparison workflow; job uses `environment: visual-test` only for this scope.
  5. `always()` cleanup of the two auth state files.
  6. `git add dashboard/tests/visual/__screenshots__`; if nothing staged, exit 0; else commit
     as `github-actions[bot]` with message `Regenerate <scope> visual baselines (Linux)` and
     `git push origin HEAD:${{ inputs.branch }}` (never `--force`).
- [ ] **Bootstrap trigger (temporary, removed in Task 1.9):** also add

```yaml
  push:
    branches-ignore: [main]
    paths: [.github/visual-baseline-request.json]
```

  and a first step that, on `push`, reads `{ "scope": ..., "preview_url": ... }` from that
  file and uses `github.ref_name` as the branch.
- [ ] Do not add a new npm script for the authenticated update (the `auth-setup-contract`
  test pins the script table); the workflow passes `--update-snapshots` itself.
- [ ] `visual-baselines-docker.sh`: runs the same image with the repo mounted, `npm ci`,
  `npm run test:visual:update`. Mark executable.
- [ ] Run the contract tests → PASS. Commit.

### Task 1.6: Docs

**Files:** `docs/ui-contracts.md`,
`docs/superpowers/specs/2026-07-14-credential-authenticated-visual-ci-design.md`,
`docs/superpowers/plans/2026-07-14-credential-authenticated-visual-ci.md`,
`docs/superpowers/plans/2026-07-14-visual-ci-scope-portability.md`

- [ ] `ui-contracts.md`: replace the `macos-14` paragraph, the `deployment_status` paragraph
  (now `repository_dispatch` from `main`, commit status `Authenticated visual`), and the
  "first authenticated run… download the artifact" procedure (now: dispatch `Visual
  baselines` from `main` with the PR branch, review the PNG diff in the PR). Keep every
  string the bypass-secret contract test requires.
- [ ] Add a one-paragraph "Superseded 2026-11-20 by the CI/CD overhaul spec: platform is the
  Linux container, trigger is `repository_dispatch`" note at the top of the three July docs.
  Do not delete their content (the contract test reads the July spec).
- [ ] Contract tests → PASS. Commit.

### Task 1.7: Generate Linux baselines in Actions (bootstrap)

- [ ] `git rm -r dashboard/tests/visual/__screenshots__` (all 156 macOS PNGs). Commit.
- [ ] Add `.github/visual-baseline-request.json` with `{"scope":"public"}`. Commit and push.
  The bootstrap trigger runs `Visual baselines` on the PR branch and pushes a PNG commit.
- [ ] `git pull` (fast-forward). Confirm the commit contains only PNGs under
  `dashboard/tests/visual/__screenshots__`.
- [ ] Find the branch's Vercel Preview URL (PR deployment list). Edit the request file to
  `{"scope":"authenticated","preview_url":"https://<preview>.vercel.app"}`. Commit, push,
  wait, pull. Total PNG count should be 156 unless routes changed; explain any difference
  in the PR description.
- [ ] Fallback if the bootstrap trigger misbehaves: the failing `public-visual` and legacy
  authenticated runs upload the actual PNGs as failure artifacts; download them with
  `gh run download`, review, and commit them by hand.

### Task 1.8: STOP — Andrew reviews the baselines

- [ ] **STOP.** Andrew (or an agent he asks) inspects every regenerated PNG in the PR diff
  at both viewports and themes, as `docs/ui-contracts.md` requires. Font rendering changes
  from macOS to Linux are expected everywhere; layout changes are not.

### Task 1.9: Remove the bootstrap trigger and finish

- [ ] Delete `.github/visual-baseline-request.json` and the `push:` trigger plus its
  request-file step from `visual-baselines.yml`. Add contract assertions: the workflow's
  `on:` contains only `workflow_dispatch`; the request file does not exist.
- [ ] This commit triggers CI (the bot's PNG commits did not, see spec issue 11).
- [ ] Verify on the PR: `Public visual` green on `ubuntu-24.04`; the legacy
  `deployment_status` run green in the container; `Dashboard tests` green.
- [ ] Commit, then **STOP: Andrew merges PR 1** (pipeline-change).

### Phase 1: validated only after merge

- The `repository_dispatch` path runs from `main` only. It is first exercised by the next
  PR (phase 2). Task 2.1 checks parity before removing the legacy trigger.
- `Visual baselines` via `workflow_dispatch`: validate with a run against a scratch branch
  and scope `public`; expected result "nothing staged", exit 0, no commit.

**Risks:** container user 1001 cannot write the workspace or npm cache (fix: `HOME=/tmp`
env on the job); Linux font differences shift a masked region; the Vercel dispatch payload
shape differs from the documented one (`Resolve target` logs the payload keys, never values).
**Rollback:** revert the merge commit with a new commit; the macOS PNGs come back with it.

---

# Phase 2: Migrations tooling and PR CI (PR 2)

Branch `cicd/2-migrations-tooling`. No prod contact. The schema-sync gate is built and
unit-tested here but stays dormant until a baseline exists (phase 3).

### Task 2.1: Remove the legacy visual trigger after parity

**Files:** `.github/workflows/authenticated-visual.yml`, the visual contract test

- [ ] On this PR's first push, confirm both runs exist for the head SHA: the legacy
  `deployment_status` check and the commit status `Authenticated visual` posted by the
  dispatch run from `main`. Both green, same test count. Record both run URLs in the PR.
- [ ] If the dispatch run is missing or red, STOP and fix forward in this PR before going on.
- [ ] Delete the `deployment_status:` trigger, the legacy half of the job `if:`, and the
  `|| github.event.deployment…` fallbacks. Contract test: `on:` has only
  `repository_dispatch`; file does not contain `deployment_status`.
- [ ] Commit. (This edit takes effect for the workflow only after merge.)

### Task 2.2: Supabase layout and pinned CI tools

**Files:** `supabase/config.toml`, `supabase/migrations/.gitkeep`, `requirements-ci.txt`,
`.squawk.toml`, `.gitignore`

- [ ] `supabase/config.toml`: `project_id = "job-board"`, `[db] major_version = 17`. Nothing
  else beyond CLI defaults. Add `supabase/.temp/` and `supabase/.branches/` to `.gitignore`.
- [ ] `requirements-ci.txt`: `squawk-cli==<exact current release>` and `psycopg[binary]`
  pinned to the version in `requirements.txt`. Record the squawk version in the PR.
- [ ] `.squawk.toml`: `pg_version = "17.6"`, `assume_in_transaction = true`.
- [ ] Commit.

### Task 2.3: Archive the old migrations and freeze both ledgers' inputs

**Files:** `migrations/*.sql` → `migrations/archive/`, tests that read them,
`tests/migration_tooling/test_archive_frozen.py`

- [ ] `git mv migrations/*.sql migrations/archive/` (66 files; history preserved).
- [ ] Update path references: `tests/test_archive_retention_recovery.py:477`,
  `tests/test_archive_outbox.py:194-196`, `tests/test_lifecycle_migrations.py:39,57,175`,
  `tests/test_matching_inactivity.py:15`, `dashboard/lib/feedback.db.test.ts:21`,
  `dashboard/lib/jobLifecycleConsumers.db.test.ts:19`, and comment references in
  `schema.sql:843-848`, `dashboard/lib/generationJobs.ts:11`, `dashboard/lib/usage.ts:17`,
  `tests/test_resume_storage_policies.py:3`, `tests/test_rls_isolation.py:621`. Re-grep
  `grep -rn "migrations/20" --include=*.py --include=*.ts --include=*.sql --include=*.md .`
  and fix anything outside `docs/superpowers/` and `docs/runbooks/` history.
- [ ] Write `test_archive_frozen.py` (failing until the pins are filled in):
  - exactly 66 `*.sql` files in `migrations/archive/`, none directly in `migrations/`;
  - sha256 over sorted `name\0content` equals a pinned constant;
  - `schema.sql` contains exactly 18 `INSERT INTO schema_migrations` statements (today's
    count; this is the `public.schema_migrations` freeze);
  - no file under `supabase/migrations/` mentions `schema_migrations`.
- [ ] Run `python -m pytest tests/migration_tooling -q` → PASS. Run `ruff check .` → clean.
- [ ] Commit.

### Task 2.4: Migration file rules checker

**Files:** `tools/migrations/__init__.py`, `tools/migrations/check_rules.py`,
`tests/migration_tooling/test_check_rules.py`

- [ ] Tests first, one per rule, each with a passing and a failing SQL string:
  1. filename matches `^\d{14}_[a-z0-9_]+\.sql$`;
  2. first two non-comment statements are `SET lock_timeout = '<n>s'` with n ≤ 5 and
     `SET statement_timeout = ...` (any positive value);
  3. no top-level `BEGIN`, `START TRANSACTION`, `COMMIT`, `ROLLBACK` (dollar-quoted bodies
     and comments are stripped before matching, so `BEGIN` inside plpgsql is allowed);
  4. no `schema_migrations` reference;
  5. `CONCURRENTLY` is rejected outright (see Task 2.9 for the conditional relaxation);
  6. files named `*_baseline.sql` / `*_baseline_storage.sql` are exempt from rules 2–5.
- [ ] Implement `check_file(path) -> list[str]` and a CLI
  `python -m tools.migrations.check_rules <files…>` that prints `file: message` lines and
  exits 1 on any violation. Share one `strip_sql(text)` helper (comments, string literals,
  dollar-quoted bodies) with Task 2.5.
- [ ] `pytest tests/migration_tooling/test_check_rules.py -q` → PASS. Commit.

### Task 2.5: Destructive classifier

**Files:** `tools/migrations/classify.py`, `tests/migration_tooling/test_classify.py`

- [ ] Tests first. `classify(sql: str, squawk_rules: set[str]) -> list[str]` returns reasons;
  empty means not destructive. Cases:
  - squawk rule names starting `ban-drop-`, or equal to `ban-truncate-cascade`,
    `changing-column-type`, `renaming-column`, `renaming-table` → flagged;
  - regex on stripped SQL: `DROP (TABLE|SCHEMA|FUNCTION|VIEW|MATERIALIZED VIEW|TYPE)`,
    `ALTER TABLE … DROP COLUMN`, `TRUNCATE` as a statement, `DELETE FROM x;` and
    `UPDATE x SET …;` with no `WHERE` → flagged;
  - `-- migration: destructive` anywhere → flagged with reason `author-forced`;
  - **cannot clear:** a file with `DROP TABLE` plus `-- migration: safe` or
    `-- migration: not-destructive` is still flagged;
  - not flagged: `TG_OP='TRUNCATE'` and `BEFORE TRUNCATE ON` inside a function/trigger
    definition, `DROP … IF EXISTS` inside a dollar-quoted body, `UPDATE … WHERE`.
  - Regression fixture: the text of `migrations/archive/2026-10-15-15-identity-exploratory-pilot.sql`
    with squawk rules `{"ban-drop-not-null"}` → flagged.
- [ ] CLI: `python -m tools.migrations.classify --squawk-json <file> <sql files…>` writes
  `{"destructive": bool, "files": {name: [reasons]}}` to stdout. Exit code is always 0
  (the classifier reports, it does not fail the job).
- [ ] Tests PASS. Commit.

### Task 2.6: PR scope checks (stand-alone rule, immutability, ordering, pipeline label)

**Files:** `tools/migrations/pr_scope.py`, `tests/migration_tooling/test_pr_scope.py`

- [ ] Tests first for pure functions taking `git diff --name-status` rows:
  - `added_migrations(rows)`: files added under `supabase/migrations/`.
  - `standalone_violations(rows)`: if any migration is added, every changed path must match
    `supabase/migrations/**`, `supabase/snapshots/**`,
    `supabase/schema-sync-expected-diff.json`, `schema.sql`, `tests/**`,
    `dashboard/tests/**`, `dashboard/**/*.test.ts(x)`, `docs/**`, or `*.md`. Returns the
    offending paths.
  - `immutability_violations(rows)`: any `M`, `D` or `R` under `supabase/migrations/`, and
    any `A`/`M`/`D`/`R` under `migrations/` (the archive is frozen).
  - `ordering_violations(added, existing_on_main)`: an added version ≤ the highest version
    on `main` (would be skipped or refused by `db push`).
  - `is_pipeline_change(rows)`: any path under `.github/workflows/`, `supabase/config.toml`,
    `tools/migrations/**`, `.squawk.toml`.
- [ ] CLI `python -m tools.migrations.pr_scope --base origin/main` prints violations and a
  markdown pending-set report (for `$GITHUB_STEP_SUMMARY`), writes
  `pipeline_change=true|false` and `added=<json>` to `$GITHUB_OUTPUT`, exits 1 on violations.
- [ ] Tests PASS. Commit.

### Task 2.7: Catalog fingerprint and diff

**Files:** `tools/migrations/fingerprint.py`, `tools/migrations/fingerprint.sql`,
`supabase/fingerprint-ignore.json`, `tests/migration_tooling/test_fingerprint_diff.py`

- [ ] `fingerprint.sql`: one read-only query per section, each returning `(key, value)`
  rows for schema `public` unless stated: `columns` (type, nullability, default, generated,
  identity), `constraints` (`pg_get_constraintdef`, `convalidated`), `indexes` (`indexdef`),
  `functions` (identity args → md5 of `pg_get_functiondef`, `prosecdef`, `proconfig`),
  `triggers` (`pg_get_triggerdef`, enabled state), `views`, `policies` (cmd, roles, qual,
  with_check, permissive), `rls` (`relrowsecurity`, `relforcerowsecurity`), `sequences`,
  `types`, `owners` (tables, sequences, views, functions, schema), `grants` (`aclexplode`
  of relation, column, sequence, function and schema ACLs: grantee, privilege, grantable),
  `default_acl` (`pg_default_acl` for `public`), `extensions` (name and schema, no version),
  `storage_policies` (policies on `storage.objects`; empty if the schema is absent),
  `storage_buckets` (id, public, size limit, mime types).
- [ ] `fingerprint.py`:
  - `capture(dsn, read_only=True) -> dict` opens the connection with
    `options='-c default_transaction_read_only=on'` and never issues DDL or DML;
  - `diff(a, b, ignore, expected) -> Diff` where `ignore` is a list of
    `{section, key_regex, reason}` and `expected` is a list of `{section, key, side}`;
    returns unexpected differences **and** stale `expected` entries (listed but not
    actually different);
  - CLI: `capture --dsn-env VAR --out file.json`, and
    `compare a.json b.json [--ignore f] [--expected f] [--skip-sections storage_policies,storage_buckets]`
    printing `section: key: only-in-A | only-in-B | differs` and exiting 1 on any
    unexpected difference or stale entry.
- [ ] Unit tests (no DB) for `diff`: identical → clean; differing constraint name is named;
  ignore regex suppresses; expected entry suppresses; stale expected entry fails;
  `--skip-sections` works.
- [ ] `supabase/fingerprint-ignore.json` starts as `[]`. Every entry added later needs a
  reason string and is reviewed by Andrew.
- [ ] Tests PASS. Commit.

### Task 2.8: `migrations` and `pipeline-guard` jobs in `ci.yml`

**Files:** `dashboard/tests/ci/pipeline-workflow-contract.test.ts`, `.github/workflows/ci.yml`

- [ ] Contract test first (confirm `dashboard/vitest.config.*` includes `tests/ci/**`; if
  not, place the file under `tests/visual/`). Assert for job `migrations`:
  `name: Migrations`, `runs-on: ubuntu-24.04`, `supabase/setup-cli@v3` with
  `version: 2.122.0`, no `secrets.` anywhere in the job, no `environment:`, and the step
  names below in this order. Assert for `pipeline-guard`: its `permissions` are exactly
  `contents: read` and `pull-requests: write`, and no `secrets.` except `github.token`.
  Assert `ci.yml` still has exactly two `DATABASE_URL:` lines (existing test).
- [ ] Add job `migrations` (`actions/checkout@v7` with `fetch-depth: 0`):
  1. `Unit-test migration tooling`: `pip install -r requirements-ci.txt pytest` then
     `python -m pytest tests/migration_tooling -q`.
  2. `Check PR scope` (pull_request only): `python -m tools.migrations.pr_scope --base
     origin/${{ github.base_ref }} >> "$GITHUB_STEP_SUMMARY"`.
  3. `Check migration file rules`: `check_rules` over every non-archive migration file.
  4. `Lint changed migrations`: `squawk --reporter Json` over the added files → artifact
     file; a non-zero squawk exit fails the step only for rules not in the destructive set.
  5. `Classify destructive migrations`: `classify`; result into the job summary.
  6. `Start local Supabase`: `supabase db start`.
  7. `Replay migrations`: `supabase db reset --local --no-seed`. A broken migration fails here.
  8. `Schema-sync gate` (`if: hashFiles('supabase/migrations/*_baseline.sql') != ''`):
     capture fingerprint A from the replayed database; copy `supabase/config.toml` into a
     temp workdir with an empty `migrations/`, `supabase db reset --workdir <tmp>`,
     `psql -v ON_ERROR_STOP=1 -f schema.sql`, capture B; `compare A B --ignore
     supabase/fingerprint-ignore.json --expected supabase/schema-sync-expected-diff.json
     --skip-sections storage_policies,storage_buckets`.
  9. `Baseline equals prod snapshot` (same `if`): `supabase db reset --local --no-seed
     --version <last baseline version>`, capture, `compare` against
     `supabase/snapshots/prod-fingerprint-cutover.json` with the ignore list.
  When the gate is skipped, step 8 is replaced by a notice step that prints
  "Schema-sync gate dormant: no baseline yet (activates in the cutover PR)".
- [ ] Add job `pipeline-guard` (pull_request, same-repo only): runs `pr_scope`, and when
  `pipeline_change == 'true'` runs `gh label create pipeline-change --force` and
  `gh pr edit --add-label pipeline-change`. Same pattern adds `destructive-migration` from
  the classifier output. Labels are only ever added, never removed. Name: `Pipeline guard`.
- [ ] The existing `python` job is untouched (acceptance suite stays on `schema.sql`).
- [ ] Contract test PASS; push; confirm in CI: `Migrations` green with the dormant notice,
  `Pipeline guard` green and the PR carries `pipeline-change`.
- [ ] Commit.

### Task 2.9: Prove the CLI behaviours the spec assumes (CI-only experiments)

- [ ] On a throwaway branch off this PR (never merged), add three temporary migration files
  and read the `Migrations` job logs:
  1. a file with a syntax error in its last statement after a valid `CREATE TABLE` →
     expected: reset fails and the table does not exist (per-file atomicity);
  2. a `CREATE INDEX CONCURRENTLY` file → records whether v2.122.0 runs it;
  3. a file with `SET lock_timeout='5s'` followed by a statement → confirms `SET` is
     accepted in the CLI's execution mode.
- [ ] Record results in `docs/runbooks/migrations-cd.md` (Task 2.11). If experiment 2
  passes, relax rule 5 of Task 2.4 to "allowed only when the file's first line is
  `-- migration: non-transactional` and it holds exactly one statement besides the two
  `SET`s" with tests. If it fails, leave the rejection and note it as an open item.
- [ ] Delete the throwaway branch.

### Task 2.10: Read-only prod workflows and the re-baseline workflow

**Files:** `.github/workflows/db-ops.yml`, `.github/workflows/cutover-rebaseline.yml`,
contract test additions

- [ ] Contract test first: both files trigger only on `workflow_dispatch`; every job that
  uses `secrets.SUPABASE_` declares an `environment:`; `db-ops.yml` contains none of
  `db push`, `migration repair`, `migration up`, `--update`, `INSERT`, `UPDATE`, `DELETE`,
  `CREATE`, `DROP`; `cutover-rebaseline.yml` uses `environment: production-db-destructive`
  for its only writing job and defaults `dry_run` to `true`.
- [ ] `db-ops.yml`, input `op` = `dump` | `fingerprint`, `environment: production-db`:
  - both: `supabase link --project-ref fdhspmavadgucktetzoi` (env `SUPABASE_ACCESS_TOKEN`,
    `SUPABASE_DB_PASSWORD`);
  - `dump`: `supabase db dump --linked -f baseline.sql` (schema only, default schemas) and
    `supabase migration list --linked > history.txt`; upload both as artifact `prod-dump`;
  - `fingerprint`: build a DSN from the session pooler URL the CLI writes to
    `supabase/.temp/pooler-url` (IPv4, port 5432, user `postgres.fdhspmavadgucktetzoi`),
    with the password percent-encoded and passed via env only; run
    `fingerprint.py capture`; upload `prod-fingerprint.json`. Add `::add-mask::` for the DSN.
- [ ] `cutover-rebaseline.yml`, inputs `baseline_sha` (40 hex, the cutover PR head),
  `dry_run` (default `true`):
  - job `plan` (`production-db`, read-only): link; sparse-checkout `supabase/migrations`
    at `baseline_sha` into the workspace; read remote versions; assert remote count is 65
    and local files are exactly the two baseline files; print the exact `repair` commands;
  - job `apply` (`if: inputs.dry_run == false`, `needs: plan`,
    `environment: production-db-destructive`): in one psql transaction
    `CREATE TABLE supabase_migrations.schema_migrations_pre_cd AS TABLE
    supabase_migrations.schema_migrations;` (fails if it already exists, which makes the job
    non-repeatable by design); `supabase migration repair --status reverted <65 versions>`;
    `supabase migration repair --status applied <both baseline versions>`;
    `supabase migration list --linked` must show local == remote; then capture the prod
    fingerprint and compare with the artifact from before (schema must be unchanged).
- [ ] Contract tests PASS. Commit.

### Task 2.11: Docs for phase 2

**Files:** `docs/runbooks/migrations-cd.md` (new), `README.md` (Database bullet),
`AGENTS.md`, `CLAUDE.md`

- [ ] New runbook: file rules (3.2), how to add a migration (`supabase migration new`,
  header template, mirror into `schema.sql`, stand-alone PR), what each CI step means, the
  labels, Task 2.9 results. Mark the CD half "not live until phase 4".
- [ ] README Database bullet: old folder is `migrations/archive/` and frozen; new files go
  in `supabase/migrations/`; **until the cutover PR merges, do not add migrations at all**.
- [ ] `AGENTS.md` and `CLAUDE.md` (keep the two in sync): add a `## Migrations` section with
  the rules and "agents never apply SQL to production; the pipeline does".
- [ ] Commit. Verify the whole PR: `ruff check .`, `python -m pytest tests/migration_tooling -q`,
  `cd dashboard && npm test && npm run typecheck && npm run lint`, all CI jobs green.
- [ ] **STOP: Andrew merges PR 2** (pipeline-change).

### STOP after PR 2 merges — Andrew

1. **Visual environment:** add a deployment branch policy "Selected branches: `main`" to
   environment `visual-test` (safe now that the legacy trigger is gone).
2. **Create environment `production-db`:** branch policy `main` only, no reviewers. Secrets
   `SUPABASE_ACCESS_TOKEN` (PAT, narrowest scope available) and `SUPABASE_DB_PASSWORD`.
3. **Create environment `production-db-destructive`:** branch policy `main` only, Required
   reviewer = Andrew, **"Prevent self-review" unchecked** (his own merges trigger the runs).
   Same two secrets.
4. **Required checks on `main`:** add `Public visual`, `Authenticated visual`, `Migrations`.
5. **Switch the Supabase connector for agent sessions to read-only** (decision 10.4). Do it
   now: a stray MCP-applied migration between here and the cutover would invalidate the dump.

**Risks:** squawk or the local stack is slower or flakier than expected (the job is isolated;
it cannot break deploys); a path reference to `migrations/` was missed (caught by the Python
and dashboard suites). **Rollback:** revert the merge with a new commit; nothing in prod changed.

---

# Phase 3: Cutover (PR 3)

Branch `cicd/3-cutover`. This PR adds migration files, so it must obey the stand-alone rule:
only `supabase/migrations/**`, `supabase/snapshots/**`, the expected-diff list, `schema.sql`,
tests and docs. No workflow edits.

### Task 3.1: STOP — Andrew runs the read-only dump and fingerprint

- [ ] **STOP.** Andrew dispatches `db-ops` from `main` twice: `op=dump`, then
  `op=fingerprint` (or tells an agent to dispatch them; both are read-only and run in
  `production-db`). No approval prompt is expected.
- [ ] Agent downloads artifacts `prod-dump` and `prod-fingerprint` with `gh run download`
  into the scratchpad. Check: `history.txt` lists 65 remote versions; the dump contains no
  `INSERT`/`COPY` data and no `auth.`/`storage.` object definitions. If the remote count is
  not 65, STOP and report (something was applied since the spec).

### Task 3.2: Commit the baseline

**Files:** `supabase/migrations/<ts>_baseline.sql`, `supabase/migrations/<ts+1>_baseline_storage.sql`,
`supabase/snapshots/prod-fingerprint-cutover.json`

- [ ] `<ts>` = current UTC `date -u +%Y%m%d%H%M%S`. Commit the dump unedited as
  `<ts>_baseline.sql`. If replay later fails on a dump statement (for example an
  `ALTER … OWNER TO` a role the local stack lacks), fix it with the smallest possible edit
  and list each edit in the PR description; do not reformat.
- [ ] `<ts+1>_baseline_storage.sql`: the `storage.objects` policy statements from
  `migrations/archive/2026-07-04-resume-bucket-storage-policies.sql`, made to match the
  `storage_policies` section of the prod fingerprint exactly (names, commands, roles,
  `qual`, `with_check`). Include the `resumes` bucket row only if `storage_buckets` in the
  prod fingerprint shows it and the local stack does not create it.
- [ ] Commit `prod-fingerprint.json` as `supabase/snapshots/prod-fingerprint-cutover.json`.
  Check it for anything that should not be public before committing: it must hold catalog
  metadata only (object names, definitions, role names). No row data, no connection strings.

### Task 3.3: Fix `schema.sql` drift and write the expected-diff list

**Files:** `schema.sql`, `supabase/schema-sync-expected-diff.json`,
`supabase/fingerprint-ignore.json`

- [ ] `schema.sql:136-137`: name the two `profiles` checks as prod has them:

```sql
  reasoning_effort_resume TEXT CONSTRAINT reasoning_effort_resume_valid
    CHECK (reasoning_effort_resume IN ('low', 'medium', 'high')),
  reasoning_effort_cover  TEXT CONSTRAINT reasoning_effort_cover_valid
    CHECK (reasoning_effort_cover  IN ('low', 'medium', 'high')),
```

- [ ] Push and read the `Schema-sync gate` and `Baseline equals prod snapshot` output (both
  are now active because a baseline file exists). Sort every reported difference into
  exactly one bucket:
  1. **Pilot pair** (present in `schema.sql`, absent from prod): the `exploratory_pilot`
     column and its unique index, the five `lifecycle_identity_authorizations` columns from
     file 15 and three from file 16, constraints `identity_observation_basis` and
     `identity_wal_basis`, functions `lifecycle_identity_pilot_scope`,
     `lifecycle_identity_observation_current`, `lifecycle_identity_wal_bound`, the two pilot
     triggers, nullability of `observed_at` and `resident_wal_bytes`, the changed body of
     `lifecycle_identity_check_authorization`, and their grants/owners. These go into
     `supabase/schema-sync-expected-diff.json` with `"until": "phase-5 pilot migration"`.
  2. **Real `schema.sql` drift** (grants, owners, default privileges not yet compared):
     fix by editing `schema.sql`. Prod wins. Each fix is its own commit with the object named.
  3. **Environment noise** between the local stack and prod (for example a managed role that
     exists only in prod): add to `supabase/fingerprint-ignore.json` with a reason.
  Anything that fits none of the three: STOP and ask Andrew.
- [ ] The acceptance suite still loads `schema.sql` on plain Postgres 16/17; if a grant or
  owner fix references a role that does not exist there, guard it the way `schema.sql:671-680`
  guards `anon`/`authenticated`.
- [ ] Done when: `Migrations` green with both gates active; `Permitted acceptance
  PostgreSQL 16/17` green; the ignore list is short and every entry has a reason.

### Task 3.4: Cutover docs

**Files:** `docs/runbooks/migration-ledger-state.md`, `README.md`, `docs/runbooks/migrations-cd.md`

- [ ] Ledger runbook: append "Final checkpoint — 2026-11-20 cutover": 65 Supabase history
  rows preserved in `supabase_migrations.schema_migrations_pre_cd`; `public.schema_migrations`
  frozen at its current rows; the pilot pair unapplied and shipping as the first pipeline
  migration; then "**This runbook is frozen.**" Leave the fields that depend on Task 3.6
  (run URL, timestamps) as a clearly marked TODO line to be filled by a follow-up commit.
- [ ] README: replace the manual-apply paragraph with a pointer to `migrations-cd.md`.
- [ ] Commit.

### Task 3.5: STOP — Andrew reviews the cutover PR

- [ ] **STOP.** Andrew reviews: the baseline file list, the expected-diff list (pilot
  objects only), every ignore-list entry and every `schema.sql` drift fix. He does **not**
  merge yet.

### Task 3.6: STOP — Andrew runs and approves the history re-baseline

- [ ] **STOP.** Andrew dispatches `cutover-rebaseline` from `main` with
  `baseline_sha=<PR head SHA>` and `dry_run=true`. Agent reads the `plan` log: 65 versions to
  revert, two to mark applied, nothing else.
- [ ] **STOP.** Andrew dispatches again with `dry_run=false` and **approves the `apply` job**
  in `production-db-destructive`. This is the plan's first prod write. It changes only the
  history table.
- [ ] Verify from the job log: backup table created with 65 rows; `migration list` shows
  local == remote; post-run prod fingerprint identical to the pre-run artifact.
- [ ] If anything is pushed to the PR after this point, the `baseline_sha` is superseded:
  say so in the PR, and confirm the two baseline files are byte-identical at the new head
  (their versions are what prod now records). Never edit the baseline files after this step.
- [ ] Fill the TODO line in the ledger runbook with the run URL. Commit.

### Task 3.7: Merge

- [ ] **STOP: Andrew merges PR 3.** `deploy.yml` does not exist yet, so the merge deploys
  the app as today (Vercel and Railway git deploys). No schema SQL has run.

**Risks:** the dump does not replay on the local stack (fix in the PR, before any prod
write); the ignore list hides a real difference (Andrew reviews every entry); someone applies
SQL to prod between the dump and the re-baseline (the `plan` job's 65-row assertion and the
fingerprint comparison catch it; redo Task 3.1). **Rollback of the re-baseline:** a
dispatched job that restores `schema_migrations` from `schema_migrations_pre_cd`; write it
only if needed, and run it through `production-db-destructive`. The schema itself was never
touched, so the app is unaffected either way.

---

# Phase 4: `deploy.yml`, Vercel and Railway (PR 4)

Branch `cicd/4-deploy`.

### STOP before PR 4 merges — Andrew

Create environment **`production-deploy`**: branch policy `main` only, no reviewers. Secrets:
`VERCEL_TOKEN` (narrowest scope, with an expiry), `VERCEL_ORG_ID` =
`team_2w1ofxlgr52EIaZZXJaItBf6`, `VERCEL_PROJECT_ID` = `prj_7Z7btXKAhM80SgKkdw35K8UaOUtH`.

### Task 4.1: Candidate-set tool

**Files:** `tools/migrations/pending.py`, `tests/migration_tooling/test_pending.py`

- [ ] Tests first:
  - `candidates(all_files, added_since_last_success, baseline_versions)`: returns added
    files minus baselines; when `added_since_last_success is None` (no earlier successful
    run), returns every non-baseline file;
  - `parse_migration_list(text) -> (local_only, remote_only)` from
    `supabase migration list` output (use the `history.txt` artifact format from Task 3.1
    as the fixture);
  - `gate(local_only, remote_only, classification, reviewed_env: bool)` raises on any
    `remote_only` version ("prod history has a version the repo does not know") and raises
    when a `local_only` file is destructive and `reviewed_env` is false.
- [ ] Implement plus a CLI used by both jobs. Tests PASS. Commit.

### Task 4.2: Contract test for `deploy.yml` (failing first)

**Files:** `dashboard/tests/ci/pipeline-workflow-contract.test.ts`

- [ ] Assert:
  - `on.push.branches` is `[main]`; `workflow_dispatch` has inputs `dry_run` and
    `treat_as_destructive`; no `pull_request` trigger;
  - `concurrency` group `production-deploy` with `cancel-in-progress: false`;
  - job `plan-migrations` has no `environment:` and no `secrets.` reference;
  - job `migrate` has `needs: plan-migrations`, an `environment:` expression that can only
    yield `production-db` or `production-db-destructive`, and `secrets.SUPABASE_` appears
    in no other job;
  - job `deploy-dashboard` needs both jobs, uses `environment: production-deploy`, and its
    `if:` contains `needs.migrate.result == 'success' || needs.migrate.result == 'skipped'`;
  - the file never contains `git push`, `migration repair` or `db reset --linked`;
  - `dashboard/vercel.json` has `git.deploymentEnabled.main === false`;
  - `ci.yml` keeps `on: push` for `main` (Railway Wait for CI needs a push-triggered
    workflow) and never sets `cancel-in-progress: true` for `main`.
- [ ] Run → FAIL. Commit.

### Task 4.3: Write `deploy.yml`

**Files:** `.github/workflows/deploy.yml`

- [ ] Skeleton:

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      dry_run: { type: boolean, default: true }
      treat_as_destructive: { type: boolean, default: false }
permissions:
  contents: read
  actions: read
concurrency:
  group: production-deploy
  cancel-in-progress: false
jobs:
  plan-migrations:
    name: Plan migrations
    runs-on: ubuntu-24.04
    outputs: { has_candidates, destructive, candidates }
  migrate:
    name: Migrate
    needs: plan-migrations
    if: needs.plan-migrations.outputs.has_candidates == 'true'
    runs-on: ubuntu-24.04
    environment: ${{ needs.plan-migrations.outputs.destructive == 'true' && 'production-db-destructive' || 'production-db' }}
  deploy-dashboard:
    name: Deploy dashboard
    needs: [plan-migrations, migrate]
    if: ${{ !cancelled() && needs.plan-migrations.result == 'success' && (needs.migrate.result == 'success' || needs.migrate.result == 'skipped') }}
    runs-on: ubuntu-24.04
    environment: production-deploy
```

- [ ] `plan-migrations` steps: checkout (`fetch-depth: 0`); find the head SHA of the last
  successful `Deploy` run on `main` with `gh run list --workflow deploy.yml --branch main
  --status success --limit 1 --json headSha`; `git diff --name-only --diff-filter=A
  <sha>..HEAD -- supabase/migrations`; run squawk + `classify` on the candidates;
  `destructive` is true if any candidate is flagged or `inputs.treat_as_destructive`; write
  the table to the job summary.
- [ ] `migrate` steps: checkout; `supabase/setup-cli@v3` `version: 2.122.0`;
  `supabase link --project-ref fdhspmavadgucktetzoi`; `supabase migration list --linked` →
  `pending.py gate` (fail closed as in Task 4.1); if `inputs.dry_run`, run
  `supabase db push --linked --dry-run` and stop; else `supabase db push --linked --yes`;
  then start the local stack, load `schema.sql` exactly as the PR gate does, capture the
  prod fingerprint read-only over the session pooler, and `compare` prod vs `schema.sql`
  with the ignore and expected-diff lists; write applied versions to the summary.
  If the direct host is unreachable from the runner, the documented fallback is
  `--db-url` with the session-pooler URL built from `supabase/.temp/pooler-url`; note in
  the runbook that v3 renames `--linked`/`--db-url` to `--remote`.
- [ ] `deploy-dashboard` steps: checkout; setup-node 22; run from the repo root (the Vercel
  project's Root Directory is `dashboard/`), with `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID` in env: `npx vercel@<exact pinned version> pull --yes
  --environment=production`, `vercel build --prod`, and unless `inputs.dry_run`,
  `vercel deploy --prebuilt --prod`. Print the deployment URL to the summary.
- [ ] Contract test PASS. Commit.

### Task 4.4: Turn off Vercel's git deploy of `main`

**Files:** `dashboard/vercel.json`

- [ ] Add `"git": { "deploymentEnabled": { "main": false } }` next to `regions`. Previews
  stay on the git integration, so the `vercel.deployment.success` dispatch for previews is
  unaffected.
- [ ] Contract test PASS. Commit.

### Task 4.5: Docs

**Files:** `docs/runbooks/migrations-cd.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`

- [ ] Runbook: the deploy sequence; what a waiting `Migrate` job means and how Andrew
  approves it; failure handling ("the history table holds only files that succeeded; fix
  with a new forward migration, never a hand repair"); how to re-run with
  `workflow_dispatch`; the honest limit from spec 3.5; Railway Wait for CI behaviour.
- [ ] README Dashboard and Railway bullets: production deploys come from `Deploy`.
- [ ] `AGENTS.md`/`CLAUDE.md`: `pipeline-change` PRs need Andrew before merge.
- [ ] Commit. **STOP: Andrew merges PR 4** (pipeline-change), ideally at a quiet time.

### After PR 4 merges — validation and STOPs

Nothing in `deploy.yml` can be exercised before it is on `main`. The merge itself is the
first run, and it is a **no-op deploy by construction**: no earlier successful `Deploy` run
exists, the only migration files are baselines, so `has_candidates` is false, `Migrate` is
skipped, and `Deploy dashboard` ships the same app code that is already live.

- [ ] Watch the first run. Expected: `Plan migrations` green with an empty table, `Migrate`
  skipped, `Deploy dashboard` green, the production URL serves the merge SHA.
- [ ] If `Deploy dashboard` fails, production simply stays on the previous deployment
  (Vercel's git deploy for `main` is already off). Fix forward; do not re-enable by hand
  unless Andrew decides to (rollback below).
- [ ] **STOP.** Andrew dispatches `Deploy` with `dry_run=true`,
  `treat_as_destructive=false`. This exercises `Migrate`'s link, `migration list`, gate and
  `db push --dry-run` against prod without writing. Expected: "nothing pending". (If
  `Migrate` is skipped because there are no candidates, that is also a pass; the full path
  is proven in phase 5.)
- [ ] **STOP.** Andrew turns on **Wait for CI** in Railway for `poller`, `discovery` and
  `reviewer-worker`, and decides on `spend-alert` (recommended: on, see spec issue 9). Or
  he tells an agent to do it through the Railway connector.
- [ ] Validate Wait for CI with the next ordinary merge: Railway deployments show as
  waiting until `CI` and `Deploy` finish, then proceed.
- [ ] **STOP.** Andrew adds `Pipeline guard` to required checks if he wants it enforced.

**Risks:** Vercel CLI build differs from the git-integration build (env pulled by
`vercel pull` should match; compare the first deployment's build log); a destructive run
waiting for approval holds every later merge's deploy in the same concurrency group (by
design; Andrew approves or rejects promptly); Railway treats a waiting-for-approval run as
unfinished and holds deploys (intended), or as failed (check on first destructive run).
**Rollback:** a new commit that removes `git.deploymentEnabled` from `dashboard/vercel.json`
and disables the `deploy-dashboard` job restores Vercel git deploys; Andrew turns Wait for
CI off in Railway. Promote the previous Vercel deployment from the Vercel dashboard if the
app itself is bad.

---

# Phase 5: First real migration — the pilot pair (PR 5)

Branch `cicd/5-identity-pilot-migrations`. Stand-alone migration PR. Decision 10.1:
classified destructive; merging is not approval to apply, the GitHub environment gate is.

### Task 5.1: Port the two files

**Files:** `supabase/migrations/<ts1>_identity_exploratory_pilot.sql`,
`supabase/migrations/<ts2>_identity_pilot_wal_assumption.sql`

- [ ] Create with `supabase migration new identity_exploratory_pilot` and
  `… identity_pilot_wal_assumption` if the CLI is available; otherwise name them by hand
  with `date -u +%Y%m%d%H%M%S` (ts2 > ts1 > both baseline versions).
- [ ] Each file's body is the archived file
  (`migrations/archive/2026-10-15-15-identity-exploratory-pilot.sql`,
  `migrations/archive/2026-10-16-16-identity-pilot-wal-assumption.sql`) with exactly these
  changes: remove the top-level `BEGIN;` and `COMMIT;`; remove the
  `INSERT INTO schema_migrations…` line; add this header:

```sql
-- migration: destructive
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

  Keep `IF NOT EXISTS` / `DROP … IF EXISTS` as written. Do not touch the archive files.
- [ ] Local checks: `python -m tools.migrations.check_rules supabase/migrations/*identity*`
  → clean; `python -m tools.migrations.classify …` → both destructive with reasons
  including `author-forced`.
- [ ] Commit.

### Task 5.2: Empty the expected-diff list; schema.sql stays as is

**Files:** `supabase/schema-sync-expected-diff.json`

- [ ] Set the list to `[]`. `schema.sql` already contains both migrations, so it does not
  change. Do not add `INSERT INTO schema_migrations` lines anywhere (the freeze test pins 18).
- [ ] Push. Expected in CI: `Migrations` green; the schema-sync gate reports no differences
  with an empty expected list (this proves the ported files produce exactly what
  `schema.sql` describes); the pending-set report lists the two files; the PR gets the
  `destructive-migration` label; `Check PR scope` passes.
- [ ] If the gate reports a difference, the port is wrong or `schema.sql` mirrors the pilot
  inexactly. Fix the cause (prefer fixing `schema.sql` only if the archived migration is
  what was intended); never re-add an expected-diff entry to get green.
- [ ] Commit.

### Task 5.3: Negative test of the gate (throwaway)

- [ ] Open a draft PR from a throwaway branch with one migration whose SQL is broken
  (`ALTER TABLE no_such_table ADD COLUMN x int;`). Expected: `Migrations` fails at
  `Replay migrations`. Close the PR without merging and delete the branch. Record the run
  URL in PR 5 (spec success criterion 1).

### Task 5.4: Retire the one-time cutover workflow and finish docs

**Files:** `.github/workflows/cutover-rebaseline.yml` (delete), contract test,
`docs/runbooks/migrations-cd.md`, `docs/runbooks/migration-ledger-state.md`

- [ ] This would break the stand-alone rule (workflow change in a migration PR). Do it as a
  **separate small follow-up PR 5b** after PR 5 has deployed: delete
  `cutover-rebaseline.yml`, drop its contract assertions, remove "not live" wording from
  the runbook, and note in the ledger runbook that the pilot pair is applied (with the
  `Deploy` run URL). PR 5b is a `pipeline-change`; Andrew merges.

### Task 5.5: STOP — merge and approve

- [ ] **STOP: Andrew merges PR 5.**
- [ ] `Deploy` starts. Expected: `Plan migrations` lists two candidates, `destructive=true`;
  `Migrate` waits in `production-db-destructive`.
- [ ] **STOP: Andrew approves `Migrate` in GitHub.** Before approving he can read the two
  files in the run's summary. While it waits, the dashboard deploy and (with Wait for CI)
  the Railway deploys for this commit wait too.
- [ ] After approval, verify from the run: two versions applied; the post-push fingerprint
  step reports prod == `schema.sql` with an empty expected-diff list; `Deploy dashboard`
  green; Railway deploys released.
- [ ] If `Migrate` fails: nothing is half-applied within a file; a file that succeeded stays
  recorded. Do not repair by hand. Write a new forward migration PR.

### Success criteria check (spec section 8)

- [ ] Broken migration fails `Migrations` before merge — Task 5.3 run URL.
- [ ] Safe migration applies with no human step — proven by the first non-destructive
  migration after this plan; note it as an open verification in the runbook.
- [ ] Destructive migration pauses for Andrew, app deploy waits — Task 5.5.
- [ ] Migration failure blocks Vercel and Railway for that commit — by construction
  (`needs`, Wait for CI); observed only if a failure happens.
- [ ] No PR-branch workflow can read a prod secret — environments are `main`-only; the
  contract tests pin which jobs reference which secrets.
- [ ] Both visual suites pass on Linux on every PR with no approval — phases 1 and 2.

**Risks:** a pilot statement waits on a lock longer than 5s and the file fails (retry by
re-running the failed `Migrate` job, which is idempotent for these files); the constraint
checks scan `lifecycle_identity_authorizations` under an exclusive lock (the table is small).
**Rollback:** forward-only. The pilot migrations are additive apart from two dropped NOT
NULLs; a reverting migration would be a new destructive PR through the same gate.

---

## All STOPs for Andrew, in order

| # | When | What Andrew does |
| --- | --- | --- |
| 1 | PR 1, Task 1.8 | Review every regenerated Linux baseline PNG |
| 2 | PR 1 green | Merge PR 1 |
| 3 | PR 2 green | Merge PR 2 |
| 4 | After PR 2 | `visual-test` branch policy `main`; create `production-db` and `production-db-destructive` (reviewer = himself, self-review allowed) with both Supabase secrets; required checks `Public visual`, `Authenticated visual`, `Migrations`; switch the Supabase connector to read-only |
| 5 | PR 3, Task 3.1 | Dispatch `db-ops` `dump` and `fingerprint` (read-only) |
| 6 | PR 3, Task 3.5 | Review baseline, expected-diff list, ignore list, `schema.sql` fixes |
| 7 | PR 3, Task 3.6 | Dispatch `cutover-rebaseline` dry run, then real run, and approve `apply` (first prod write, history table only) |
| 8 | PR 3 | Merge PR 3 |
| 9 | Before PR 4 | Create `production-deploy` with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| 10 | PR 4 green | Merge PR 4; watch the first no-op deploy |
| 11 | After PR 4 | Dispatch `Deploy` with `dry_run=true`; turn on Railway Wait for CI (three services, decide on `spend-alert`); optionally require `Pipeline guard` |
| 12 | PR 5 green | Merge PR 5 |
| 13 | PR 5 deploy | Approve `Migrate` in `production-db-destructive` |
| 14 | After PR 5 | Merge follow-up PR 5b (deletes the one-time cutover workflow) |

From phase 4 on, Andrew also approves every later destructive migration and merges every
`pipeline-change` PR.
