import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "..");
const ordinaryCi = readFileSync(
  path.join(repositoryRoot, ".github/workflows/ci.yml"),
  "utf8",
);
const authenticatedWorkflowPath = path.join(
  repositoryRoot,
  ".github/workflows/authenticated-visual.yml",
);
const uiContractsPath = path.join(repositoryRoot, "docs/ui-contracts.md");

function workflowStep(workflow: string, name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `workflow step ${name}`).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

function workflowJob(workflow: string, id: string): string {
  const start = workflow.indexOf(`  ${id}:`);
  expect(start, `workflow job ${id}`).toBeGreaterThanOrEqual(0);
  const nextJob = /\n  [a-zA-Z0-9_-]+:\n/g;
  nextJob.lastIndex = start + `  ${id}:`.length;
  const next = nextJob.exec(workflow)?.index;
  return workflow.slice(start, next);
}

describe("deployment-triggered authenticated visual workflow", () => {
  test("keeps ordinary CI public and independent of obsolete browser state secrets", () => {
    expect(ordinaryCi).toContain("npm run test:visual:public");
    expect(ordinaryCi).not.toContain("VISUAL_AUTH_STATE_JSON");
    expect(ordinaryCi).not.toContain("VISUAL_ONBOARDING_AUTH_STATE_JSON");
    expect(ordinaryCi).not.toContain("npm run test:visual:authenticated");
    expect(ordinaryCi).not.toContain("npm run test:visual\n");
  });

  test("uses only inert local infrastructure placeholders in ordinary dashboard CI", () => {
    const dashboardJob = workflowJob(ordinaryCi, "dashboard");
    const publicVisualJob = workflowJob(ordinaryCi, "public-visual");
    const authenticatedWorkflow = readFileSync(authenticatedWorkflowPath, "utf8");

    for (const job of [dashboardJob, publicVisualJob]) {
      expect(job).toContain(
        "DATABASE_URL: postgresql://test:test@127.0.0.1:1/test",
      );
      expect(job).toContain(
        "NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:1",
      );
      expect(job).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY: test");
    }
    expect(ordinaryCi.match(/^\s+DATABASE_URL:/gm)).toHaveLength(2);
    for (const variable of [
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]) {
      expect(authenticatedWorkflow).not.toContain(variable);
    }
  });

  test("keeps platform-independent dashboard checks on Ubuntu", () => {
    const dashboardJob = workflowJob(ordinaryCi, "dashboard");

    expect(dashboardJob).toContain("name: Dashboard tests");
    expect(dashboardJob).toContain("runs-on: ubuntu-latest");
    expect(dashboardJob).toContain("run: npm run typecheck");
    expect(dashboardJob).toContain("run: npm run lint");
    expect(dashboardJob).toContain("run: npm test");
    expect(dashboardJob).not.toContain("playwright install");
    expect(dashboardJob).not.toContain("test:visual");
  });

  test("runs public visual baselines in a dedicated pinned macOS job and uploads diffs", () => {
    const publicVisualJob = workflowJob(ordinaryCi, "public-visual");
    const upload = workflowStep(ordinaryCi, "Upload public visual failure evidence");

    expect(publicVisualJob).toContain("name: Public visual");
    expect(publicVisualJob).toContain("runs-on: macos-14");
    expect(publicVisualJob).not.toContain("runs-on: macos-latest");
    expect(publicVisualJob).toContain("run: npx playwright install chromium");
    expect(publicVisualJob).not.toContain("playwright install --with-deps");
    expect(publicVisualJob).toContain("run: npm run test:visual:public");
    expect(publicVisualJob).not.toContain("test:visual:authenticated");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("uses: actions/upload-artifact@v4");
    expect(upload).toContain("name: public-visual-results");
    expect(upload).toContain("dashboard/test-results/visual/**");
    expect(upload).toContain("!dashboard/test-results/visual/**/trace.zip");
  });

  test("runs deployment visuals on the canonical macOS baseline platform", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const job = workflowJob(workflow, "authenticated-visual");

    expect(job).toContain("runs-on: macos-14");
    expect(job).not.toContain("runs-on: macos-latest");
    expect(job).toContain("run: npx playwright install chromium");
    expect(job).not.toContain("playwright install --with-deps");
  });

  test("documents the canonical platform and reviewed baseline update procedure", () => {
    const docs = readFileSync(uiContractsPath, "utf8");

    expect(docs).toContain(
      "The canonical screenshot baseline platform is GitHub Actions `macos-14`.",
    );
    expect(docs).toContain("Generate baseline updates on `macos-14`");
    expect(docs).toContain("inspect every changed PNG");
    expect(docs).toContain("Never loosen screenshot tolerances");
  });

  test("accepts only successful Vercel Preview deployment status events", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    expect(workflow).toMatch(/on:\s*\n\s+deployment_status:/);
    expect(workflow).toContain("github.event.deployment_status.state == 'success'");
    expect(workflow).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
    expect(workflow).toContain("github.event.deployment.environment == 'Preview'");
    expect(workflow).toContain(
      "startsWith(github.event.deployment_status.environment_url, 'https://')",
    );
    expect(workflow).toContain(
      "contains(github.event.deployment_status.environment_url, '.vercel.app')",
    );
  });

  test("checks out the exact deployment SHA in the protected environment", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    expect(workflow).toContain("authenticated-visual:");
    expect(workflow).toContain("name: visual-test");
    expect(workflow).toContain("ref: ${{ github.event.deployment.sha }}");
  });

  test("validates the deployment URL before the credential-scoped setup step", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const validation = workflowStep(workflow, "Validate deployment URL");
    const validationIndex = workflow.indexOf("- name: Validate deployment URL");
    const checkoutIndex = workflow.indexOf("- uses: actions/checkout@v7");
    const setupNodeIndex = workflow.indexOf("- uses: actions/setup-node@v6");
    const installIndex = workflow.indexOf("- name: Install dependencies");
    const browserIndex = workflow.indexOf(
      "- name: Install visual regression browser",
    );
    const setup = workflowStep(workflow, "Create authenticated sessions");
    expect(checkoutIndex).toBeLessThan(validationIndex);
    expect(validationIndex).toBeLessThan(setupNodeIndex);
    expect(validationIndex).toBeLessThan(installIndex);
    expect(validationIndex).toBeLessThan(browserIndex);
    expect(workflow.indexOf(validation)).toBeLessThan(workflow.indexOf(setup));
    expect(validation).toContain(
      "VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}",
    );
    expect(validation).not.toContain("secrets.");
  });

  test("rejects credentialed and non-default-port deployment URLs", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const validation = workflowStep(workflow, "Validate deployment URL");
    const script = validation.match(/node -e '([^']+)'/)?.[1];
    expect(script).toBeDefined();

    const validate = (url: string) =>
      spawnSync(process.execPath, ["-e", script!], {
        env: { ...process.env, VISUAL_BASE_URL: url },
        encoding: "utf8",
      });

    expect(validate("https://preview.vercel.app").status).toBe(0);
    for (const url of [
      "https://user:password@preview.vercel.app",
      "https://preview.vercel.app:8443",
    ]) {
      const result = validate(url);
      expect(result.status, url).not.toBe(0);
      expect(result.stderr).not.toContain(url);
    }
  });

  test("checks credential presence with booleans before installing dependencies", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const validationIndex = workflow.indexOf("- name: Validate deployment URL");
    const preflightIndex = workflow.indexOf("- name: Require visual credentials");
    const setupNodeIndex = workflow.indexOf("- uses: actions/setup-node@v6");
    const installIndex = workflow.indexOf("- name: Install dependencies");
    const browserIndex = workflow.indexOf(
      "- name: Install visual regression browser",
    );
    const preflight = workflowStep(workflow, "Require visual credentials");
    const names = [
      "VISUAL_AUTH_EMAIL",
      "VISUAL_AUTH_PASSWORD",
      "VISUAL_ONBOARDING_EMAIL",
      "VISUAL_ONBOARDING_PASSWORD",
    ];

    expect(validationIndex).toBeLessThan(preflightIndex);
    expect(preflightIndex).toBeLessThan(setupNodeIndex);
    expect(preflightIndex).toBeLessThan(installIndex);
    expect(preflightIndex).toBeLessThan(browserIndex);
    for (const name of names) {
      expect(preflight).toContain(`HAS_${name}: \${{ secrets.${name} != '' }}`);
      expect(preflight).toContain(`"${name}"`);
      expect(preflight).not.toContain(`\${{ secrets.${name} }}`);
    }
    expect(preflight).not.toMatch(/process\.env\[[^\]]+\]\)/);

    const script = preflight.match(/node -e '([^']+)'/)?.[1];
    expect(script).toBeDefined();
    const result = spawnSync(process.execPath, ["-e", script!], {
      env: {
        ...process.env,
        ...Object.fromEntries(
          names.map((name) => [
            `HAS_${name}`,
            name === "VISUAL_AUTH_PASSWORD" ? "false" : "true",
          ]),
        ),
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("VISUAL_AUTH_PASSWORD is required");
    expect(result.stderr).not.toContain("false");
  });

  test("scopes all four credentials to setup and none to comparison", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const setup = workflowStep(workflow, "Create authenticated sessions");
    const comparison = workflowStep(workflow, "Compare authenticated visuals");
    const expectedSetupVariables = [
      "VISUAL_BASE_URL",
      "VISUAL_AUTH_EMAIL",
      "VISUAL_AUTH_PASSWORD",
      "VISUAL_ONBOARDING_EMAIL",
      "VISUAL_ONBOARDING_PASSWORD",
    ];
    const setupVariables = [...setup.matchAll(/^\s{10}([A-Z_]+):/gm)].map(
      ([, variable]) => variable,
    );
    expect(setupVariables).toEqual(expectedSetupVariables);
    for (const variable of expectedSetupVariables.slice(1)) {
      expect(setup).toContain(`${variable}: \${{ secrets.${variable} }}`);
      expect(workflow.split(`\${{ secrets.${variable} }}`)).toHaveLength(2);
    }
    expect(setup).toContain("run: npm run test:visual:auth-setup");
    expect(comparison).toContain(
      "VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}",
    );
    expect(comparison).not.toContain("secrets.");
    expect(comparison).toContain("run: npm run test:visual:authenticated");
    expect(packageJson.scripts["test:visual:authenticated"]).toContain(
      "VISUAL_DISABLE_TRACE=1",
    );
    expect(packageJson.scripts["test:visual:authenticated"]).toContain(
      "VISUAL_SCOPE=authenticated",
    );
    expect(packageJson.scripts["test:visual:authenticated"]).toContain("--no-deps");
    expect(comparison).not.toContain("--update-snapshots");
  });

  test("uploads only visual failure evidence and never authentication state", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const upload = workflowStep(workflow, "Upload visual failure evidence");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("name: authenticated-visual-results");
    expect(upload).toContain("dashboard/test-results/visual/**");
    expect(upload).toContain(
      "!dashboard/test-results/visual/**/trace.zip",
    );
    expect(upload).not.toContain("test-results/visual-auth");
  });

  test("always removes the exact two generated authentication states", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const cleanup = workflowStep(workflow, "Remove authenticated state");
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain("test-results/visual-auth/established.json");
    expect(cleanup).toContain("test-results/visual-auth/onboarding.json");
  });

  test("never updates visual snapshots automatically", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    expect(workflow).not.toContain("--update-snapshots");
  });
});
