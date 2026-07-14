import { readFileSync } from "node:fs";
import path from "node:path";
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

function workflowStep(workflow: string, name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `workflow step ${name}`).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

describe("deployment-triggered authenticated visual workflow", () => {
  test("keeps ordinary CI public and independent of obsolete browser state secrets", () => {
    expect(ordinaryCi).toContain("npm run test:visual:public");
    expect(ordinaryCi).not.toContain("VISUAL_AUTH_STATE_JSON");
    expect(ordinaryCi).not.toContain("VISUAL_ONBOARDING_AUTH_STATE_JSON");
    expect(ordinaryCi).not.toContain("npm run test:visual:authenticated");
    expect(ordinaryCi).not.toContain("npm run test:visual\n");
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
    const setup = workflowStep(workflow, "Create authenticated sessions");
    expect(workflow.indexOf(validation)).toBeLessThan(workflow.indexOf(setup));
    expect(validation).toContain(
      "VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}",
    );
    expect(validation).not.toContain("secrets.");
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
    }
    expect(setup).toContain("run: npm run test:visual:auth-setup");
    expect(comparison).toContain(
      "VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}",
    );
    expect(comparison).not.toContain("secrets.");
    expect(comparison).toContain("run: npm run test:visual:authenticated");
    expect(packageJson.scripts["test:visual:authenticated"]).toContain("--no-deps");
    expect(comparison).not.toContain("--update-snapshots");
  });

  test("uploads only visual failure evidence and never authentication state", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const upload = workflowStep(workflow, "Upload visual failure evidence");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("name: authenticated-visual-results");
    expect(upload).toContain("path: dashboard/test-results/visual/**");
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
