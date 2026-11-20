import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "..");
const ci = readFileSync(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");

function job(workflow: string, id: string): string {
  const start = workflow.indexOf(`\n  ${id}:\n`);
  expect(start, `workflow job ${id}`).toBeGreaterThanOrEqual(0);
  const nextJob = /\n  [a-zA-Z0-9_-]+:\n/g;
  nextJob.lastIndex = start + id.length + 4;
  const next = nextJob.exec(workflow)?.index;
  return workflow.slice(start, next);
}

function stepNames(jobText: string): string[] {
  return [...jobText.matchAll(/^ {6}- name: (.+)$/gm)].map((m) => m[1]);
}

function step(jobText: string, name: string): string {
  const start = jobText.indexOf(`      - name: ${name}\n`);
  expect(start, `step ${name}`).toBeGreaterThanOrEqual(0);
  const next = jobText.indexOf("\n      - ", start + 1);
  return jobText.slice(start, next === -1 ? undefined : next);
}

const GATE_IF = "hashFiles('supabase/migrations/*_baseline.sql') != ''";

describe("Migrations job", () => {
  const migrations = job(ci, "migrations");

  test("runs on the pinned runner and CLI without secrets or environments", () => {
    expect(migrations).toContain("name: Migrations\n");
    expect(migrations).toContain("runs-on: ubuntu-24.04");
    expect(migrations).toContain("uses: supabase/setup-cli@v3");
    expect(migrations).toContain("version: 2.122.0");
    expect(migrations).toContain("fetch-depth: 0");
    expect(migrations).not.toContain("secrets.");
    expect(migrations).not.toContain("environment:");
    expect(migrations).not.toMatch(/supabase (link|db push|migration (repair|up))/);
  });

  test("runs its checks in order", () => {
    expect(stepNames(migrations)).toEqual([
      "Unit-test migration tooling",
      "Check PR scope",
      "Check migration file rules",
      "Lint changed migrations",
      "Classify destructive migrations",
      "Start local Supabase",
      "Replay migrations",
      "Schema-sync gate",
      "Schema-sync gate dormant",
      "Baseline equals prod snapshot",
      "Upload migration reports",
    ]);
  });

  test("checks scope on pull requests against the base branch", () => {
    const scope = step(migrations, "Check PR scope");
    expect(scope).toContain("if: github.event_name == 'pull_request'");
    expect(scope).toContain('python -m tools.migrations.pr_scope --base "origin/$BASE_REF"');
    expect(scope).toContain("BASE_REF: ${{ github.base_ref }}");
  });

  test("fails on non-destructive squawk findings and classifies the rest", () => {
    expect(step(migrations, "Lint changed migrations")).toContain(
      "python -m tools.migrations.squawk_gate squawk.json",
    );
    expect(step(migrations, "Classify destructive migrations")).toContain(
      "python -m tools.migrations.classify --squawk-json squawk.json",
    );
  });

  test("replays every migration on a local database", () => {
    expect(step(migrations, "Start local Supabase")).toContain("supabase db start");
    expect(step(migrations, "Replay migrations")).toContain("supabase db reset --local --no-seed");
  });

  test("keeps the schema-sync gate dormant until a baseline exists", () => {
    const gate = step(migrations, "Schema-sync gate");
    expect(gate).toContain(`if: ${GATE_IF}`);
    expect(gate).toContain("psql \"$LOCAL_DB_URL\" -v ON_ERROR_STOP=1 -q -f schema.sql");
    expect(gate).toContain("--ignore supabase/fingerprint-ignore.json");
    expect(gate).toContain("--skip-sections storage_policies,storage_buckets");
    const dormant = step(migrations, "Schema-sync gate dormant");
    expect(dormant).toContain("if: hashFiles('supabase/migrations/*_baseline.sql') == ''");
    expect(dormant).toContain("Schema-sync gate dormant: no baseline yet (activates in the cutover PR)");
    const snapshot = step(migrations, "Baseline equals prod snapshot");
    expect(snapshot).toContain(`if: ${GATE_IF}`);
    expect(snapshot).toContain("supabase/snapshots/prod-fingerprint-cutover.json");
  });
});

describe("Pipeline guard job", () => {
  const guard = job(ci, "pipeline-guard");

  test("only labels same-repository pull requests with a narrow token", () => {
    expect(guard).toContain("name: Pipeline guard\n");
    expect(guard).toContain(
      "if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
    );
    const permissions = guard.match(/\n {4}permissions:\n((?: {6}.+\n)+)/);
    expect(permissions?.[1]).toBe("      contents: read\n      pull-requests: write\n");
    expect(guard).not.toContain("secrets.");
    expect(guard).toContain("persist-credentials: false");
  });

  test("adds the pipeline and destructive labels and never removes one", () => {
    expect(step(guard, "Label pipeline change")).toContain("labels[]=pipeline-change");
    expect(step(guard, "Label pipeline change")).toContain(
      "if: steps.scope.outputs.pipeline_change == 'true'",
    );
    expect(step(guard, "Label destructive migration")).toContain("labels[]=destructive-migration");
    expect(step(guard, "Label destructive migration")).toContain(
      "if: steps.classify.outputs.destructive == 'true'",
    );
    expect(guard).not.toMatch(/remove-label|-X DELETE/);
  });
});

describe("existing CI jobs", () => {
  test("keep exactly two inert DATABASE_URL placeholders", () => {
    expect(ci.match(/^\s+DATABASE_URL:/gm)).toHaveLength(2);
  });

  test("leave the acceptance suite on schema.sql", () => {
    const python = job(ci, "python");
    expect(python).not.toContain("supabase");
    expect(python).toContain("tools/run_lifecycle_acceptance.py");
  });
});

const dbOps = readFileSync(path.join(repositoryRoot, ".github/workflows/db-ops.yml"), "utf8");
const rebaseline = readFileSync(
  path.join(repositoryRoot, ".github/workflows/cutover-rebaseline.yml"),
  "utf8",
);

function jobs(workflow: string): Record<string, string> {
  const body = workflow.slice(workflow.indexOf("\njobs:\n"));
  const ids = [...body.matchAll(/\n {2}([a-zA-Z0-9_-]+):\n/g)].map((m) => m[1]);
  return Object.fromEntries(ids.map((id) => [id, job(body, id)]));
}

function onBlock(workflow: string): string {
  const start = workflow.indexOf("\non:\n");
  const end = workflow.indexOf("\n\n", start + 1);
  return workflow.slice(start, end);
}

describe("production database workflows", () => {
  test("are manual only", () => {
    for (const workflow of [dbOps, rebaseline]) {
      const triggers = [...onBlock(workflow).matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
      expect(triggers).toEqual(["workflow_dispatch"]);
    }
  });

  test("scope Supabase secrets to jobs with an environment", () => {
    for (const workflow of [dbOps, rebaseline]) {
      for (const [id, text] of Object.entries(jobs(workflow))) {
        if (text.includes("secrets.SUPABASE_")) {
          expect(text, id).toMatch(/\n {4}environment: production-db(-destructive)?\n/);
        }
      }
      expect(workflow.slice(0, workflow.indexOf("\njobs:\n"))).not.toContain("secrets.");
    }
  });

  test("db-ops never writes", () => {
    for (const banned of [
      "db push",
      "migration repair",
      "migration up",
      "--update",
      "INSERT",
      "UPDATE",
      "DELETE",
      "CREATE",
      "DROP",
    ]) {
      expect(dbOps).not.toContain(banned);
    }
    expect(dbOps).toContain("environment: production-db\n");
    expect(dbOps).toContain("python -m tools.migrations.prod_dsn");
  });

  test("re-baseline writes only from the approval-gated job and defaults to a dry run", () => {
    const all = jobs(rebaseline);
    expect(Object.keys(all)).toEqual(["plan", "apply"]);
    expect(all.plan).toContain("environment: production-db\n");
    expect(all.plan).not.toMatch(/^\s*supabase migration repair|CREATE TABLE|psql/m);
    expect(all.apply).toContain("environment: production-db-destructive\n");
    expect(all.apply).toContain("if: inputs.dry_run == false");
    expect(all.apply).toContain("needs: plan");
    expect(rebaseline).toMatch(/dry_run:\n(?: {8}.+\n)*? {8}default: true\n/);
    expect(rebaseline).toContain("^[0-9a-f]{40}$");
    expect(all.apply).toContain(
      "CREATE TABLE supabase_migrations.schema_migrations_pre_cd AS TABLE supabase_migrations.schema_migrations;",
    );
    expect(all.apply).toContain("python -m tools.migrations.history check-synced history-after.txt");
    expect(all.apply).toContain(
      "python -m tools.migrations.fingerprint compare fingerprint-before.json fingerprint-after.json",
    );
  });
});
