import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const baselinesWorkflowPath = path.join(
  repositoryRoot,
  ".github/workflows/visual-baselines.yml",
);
const workflowsDir = path.join(repositoryRoot, ".github/workflows");
const dashboardPackage = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { devDependencies: Record<string, string>; scripts: Record<string, string> };
const playwrightVersion = dashboardPackage.devDependencies["@playwright/test"];
const playwrightImage = `image: mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;
const authenticatedVisualDesignPath = path.join(
  repositoryRoot,
  "docs/superpowers/specs/2026-07-14-credential-authenticated-visual-ci-design.md",
);

function workflowStep(workflow: string, name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `workflow step ${name}`).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

function expectPinnedLinuxContainer(job: string) {
  expect(job).toContain("runs-on: ubuntu-24.04");
  expect(job).not.toContain("macos");
  expect(job).toContain(playwrightImage);
  expect(job).toContain("options: --user 1001 --ipc=host");
  expect(job).not.toContain("playwright install");
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
    const sandboxJob = workflowJob(ordinaryCi, "sandbox-enforcement");
    const authenticatedWorkflow = readFileSync(authenticatedWorkflowPath, "utf8");

    for (const job of [dashboardJob, publicVisualJob, sandboxJob]) {
      expect(job).toContain(
        "DATABASE_URL: postgresql://test:test@127.0.0.1:1/test",
      );
      expect(job).toContain(
        "NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:1",
      );
      expect(job).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY: test");
    }
    expect(ordinaryCi.match(/^\s+DATABASE_URL:/gm)).toHaveLength(3);
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

  test("pins Playwright exactly so the container image matches the package", () => {
    expect(playwrightVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("runs public visual baselines in the pinned Playwright Linux container and uploads diffs", () => {
    const publicVisualJob = workflowJob(ordinaryCi, "public-visual");
    const upload = workflowStep(ordinaryCi, "Upload public visual failure evidence");

    expect(publicVisualJob).toContain("name: Public visual");
    expectPinnedLinuxContainer(publicVisualJob);
    expect(publicVisualJob).toContain("run: npm run test:visual:public");
    expect(publicVisualJob).not.toContain("test:visual:authenticated");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("uses: actions/upload-artifact@v4");
    expect(upload).toContain("name: public-visual-results");
    expect(upload).toContain("dashboard/test-results/visual/**");
    expect(upload).toContain("!dashboard/test-results/visual/**/trace.zip");
  });
  test("runs the sandbox enforcement suite in the pinned Playwright Linux container and uploads per-case results on success too", () => {
    const sandboxJob = workflowJob(ordinaryCi, "sandbox-enforcement");
    const cases = workflowStep(ordinaryCi, "Upload sandbox per-case results");
    const evidence = workflowStep(ordinaryCi, "Upload sandbox failure evidence");

    expect(sandboxJob).toContain("name: Sandbox enforcement");
    expectPinnedLinuxContainer(sandboxJob);
    expect(sandboxJob).toContain("working-directory: dashboard");
    expect(sandboxJob).toContain("run: npm run test:sandbox");
    expect(sandboxJob).toContain('SANDBOX_HARNESS: "1"');
    expect(sandboxJob).toContain("timeout-minutes: 45");
    // The opt-in is for this job only.
    expect(ordinaryCi.match(/SANDBOX_HARNESS/g)).toHaveLength(1);
    expect(dashboardPackage.scripts["test:sandbox"]).toContain("playwright test --config playwright.sandbox.config.ts");
    expect(dashboardPackage.scripts["test:sandbox"]).toMatch(/^next build && /);
    expect(cases).toContain("if: always()");
    expect(cases).toContain("uses: actions/upload-artifact@v4");
    expect(cases).toContain("dashboard/test-results/sandbox/results/**");
    expect(cases).toContain("retention-days: 7");
    expect(evidence).toContain("if: failure()");
    expect(evidence).toContain("dashboard/test-results/sandbox/**");
    expect(evidence).toContain("retention-days: 7");
  });
  test("runs the render smoke in the sandbox job, with the replay page's opt-in only in its own config (plan Task 2.11)", () => {
    const sandboxJob = workflowJob(ordinaryCi, "sandbox-enforcement");
    const run = workflowStep(ordinaryCi, "Run render smoke");
    const upload = workflowStep(ordinaryCi, "Upload render smoke results and screenshots");
    expect(sandboxJob).toContain("- name: Run render smoke");
    expect(run).toContain("playwright test --config playwright.render-smoke.config.ts");
    expect(upload).toContain("uses: actions/upload-artifact@v4");
    expect(upload).toContain("dashboard/test-results/render-smoke/**");
    // The opt-in lives in the render smoke's web server, never in a workflow's env.
    expect(ordinaryCi).not.toContain("SURFACE_REPLAY");
    const config = readFileSync("playwright.render-smoke.config.ts", "utf8");
    expect(config).toContain('env: { SURFACE_REPLAY: "1" }');
    expect(dashboardPackage.scripts["test:render-smoke"]).toMatch(/^next build && .*playwright test --config playwright\.render-smoke\.config\.ts$/);
  });
  test("runs deployment visuals in the same pinned Playwright Linux container", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    expectPinnedLinuxContainer(workflowJob(workflow, "authenticated-visual"));
  });
  test("documents the canonical platform and reviewed baseline update procedure", () => {
    const docs = readFileSync(uiContractsPath, "utf8");

    expect(docs).toContain(
      "The canonical screenshot baseline platform is the pinned Playwright Linux container",
    );
    expect(docs).toContain(
      "Generate baseline updates with the `Visual baselines` workflow",
    );
    expect(docs).toContain("inspect every changed PNG");
    expect(docs).toContain("Never loosen screenshot tolerances");
    expect(docs).not.toContain("macos-14");
  });
  test("documents protected-preview bypass setup without URL credentials", () => {
    for (const path of [uiContractsPath, authenticatedVisualDesignPath]) {
      const docs = readFileSync(path, "utf8");

      expect(docs, path).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
      expect(docs, path).toContain("`x-vercel-protection-bypass`");
      expect(docs, path).toContain("`x-vercel-set-bypass-cookie: true`");
      expect(docs, path).toContain(
        "Never put the bypass secret in the preview URL",
      );
      expect(docs, path).toContain(
        "https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation",
      );
    }
  });

  test("is started only by Vercel preview dispatches", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const resolve = workflowJob(workflow, "resolve");
    expect(workflow).toMatch(
      /\non:\n {2}repository_dispatch:\n {4}types: \[vercel\.deployment\.success\]\n\npermissions:/,
    );
    expect(workflow).not.toContain("deployment_status");
    expect(workflow).not.toContain("github.event.deployment.");
    expect(resolve).toContain("if: github.event.client_payload.environment == 'preview'");
  });

  test("runs only for open same-repository pull requests by people", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const resolve = workflowJob(workflow, "resolve");
    const step = workflowStep(workflow, "Resolve target");
    expect(resolve).not.toContain("secrets.");
    expect(resolve).not.toContain("environment:");
    expect(step).toContain(
      "TARGET_SHA: ${{ github.event.client_payload.git.sha }}",
    );
    expect(step).toContain("^[0-9a-f]{40}$");
    expect(step).toContain('repos/$GITHUB_REPOSITORY/commits/$TARGET_SHA/pulls');
    expect(step).toContain('.head.repo.full_name == \\"$repo\\"');
    expect(step).toContain('.user.type != \\"Bot\\"');
    expect(workflowJob(workflow, "authenticated-visual")).toContain(
      "if: needs.resolve.outputs.run == 'true'",
    );
  });

  test("reports an Authenticated visual commit status", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const pending = workflowStep(workflow, "Post pending status");
    const report = workflowJob(workflow, "report");
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read\s*\n\s*\n/m);
    expect(pending).toContain("if: steps.target.outputs.run == 'true'");
    for (const block of [pending, report]) {
      expect(block).toContain("context='Authenticated visual'");
    }
    expect(report).toContain("if: always() &&");
    expect(report).toContain("needs.authenticated-visual.result");
    expect(report).not.toContain("secrets.");
  });
  test("checks out the exact deployment SHA in the protected environment", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    expect(workflow).toContain("authenticated-visual:");
    expect(workflow).toContain("name: visual-test");
    expect(workflow).toContain("ref: ${{ needs.resolve.outputs.sha }}");
  });
  test("uses visual-test secrets without creating a deployment record", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const job = workflowJob(workflow, "authenticated-visual");
    expect(job).toMatch(
      /environment:\s*\n\s+name: visual-test\s*\n\s+deployment: false/,
    );
    expect(job).not.toMatch(/^\s+url:/m);
  });

  test("validates the deployment URL before the credential-scoped setup step", () => {
    const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
    const validation = workflowStep(workflow, "Validate deployment URL");
    const validationIndex = workflow.indexOf("- name: Validate deployment URL");
    const checkoutIndex = workflow.indexOf("- uses: actions/checkout@v7");
    const setupNodeIndex = workflow.indexOf("- uses: actions/setup-node@v6");
    const installIndex = workflow.indexOf("- name: Install dependencies");
    const setup = workflowStep(workflow, "Create authenticated sessions");
    expect(checkoutIndex).toBeLessThan(validationIndex);
    expect(validationIndex).toBeLessThan(setupNodeIndex);
    expect(validationIndex).toBeLessThan(installIndex);
    expect(workflow.indexOf(validation)).toBeLessThan(workflow.indexOf(setup));
    expect(validation).toContain(
      "VISUAL_BASE_URL: ${{ needs.resolve.outputs.url }}",
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
    expect(validate("preview.vercel.app").status).toBe(0);
    for (const url of [
      "https://user:password@preview.vercel.app",
      "https://preview.vercel.app:8443",
      "http://preview.vercel.app",
      "https://preview.example.com",
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
    const preflight = workflowStep(workflow, "Require visual credentials");
    const names = [
      "VISUAL_AUTH_EMAIL",
      "VISUAL_AUTH_PASSWORD",
      "VISUAL_ONBOARDING_EMAIL",
      "VISUAL_ONBOARDING_PASSWORD",
      "VERCEL_AUTOMATION_BYPASS_SECRET",
    ];

    expect(validationIndex).toBeLessThan(preflightIndex);
    expect(preflightIndex).toBeLessThan(setupNodeIndex);
    expect(preflightIndex).toBeLessThan(installIndex);
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
            name === "VERCEL_AUTOMATION_BYPASS_SECRET" ? "false" : "true",
          ]),
        ),
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET is required",
    );
    expect(result.stderr).not.toContain("false");
  });

  test("scopes identity credentials to setup and the bypass secret to protected browser steps", () => {
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
      "VERCEL_AUTOMATION_BYPASS_SECRET",
    ];
    const setupVariables = [...setup.matchAll(/^\s{10}([A-Z_]+):/gm)].map(
      ([, variable]) => variable,
    );
    expect(setupVariables).toEqual(expectedSetupVariables);
    for (const variable of expectedSetupVariables.slice(1)) {
      expect(setup).toContain(`${variable}: \${{ secrets.${variable} }}`);
    }
    for (const variable of expectedSetupVariables.slice(1, -1)) {
      expect(workflow.split(`\${{ secrets.${variable} }}`)).toHaveLength(2);
      expect(comparison).not.toContain(variable);
    }
    expect(workflow.split("${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}"))
      .toHaveLength(3);
    expect(setup).toContain("run: npm run test:visual:auth-setup");
    expect(setup).toContain(
      "VISUAL_BASE_URL: ${{ steps.url.outputs.base_url }}",
    );
    expect(comparison).toContain(
      "VISUAL_BASE_URL: ${{ steps.url.outputs.base_url }}",
    );
    expect(comparison).toContain(
      "VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}",
    );
    expect(comparison).not.toContain("VISUAL_AUTH_EMAIL");
    expect(comparison).not.toContain("VISUAL_AUTH_PASSWORD");
    expect(comparison).not.toContain("VISUAL_ONBOARDING_EMAIL");
    expect(comparison).not.toContain("VISUAL_ONBOARDING_PASSWORD");
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
    expect(upload).toContain("dashboard/test-results/visual/**/*.png");
    expect(upload).not.toMatch(
      /^\s+dashboard\/test-results\/visual\/\*\*$/m,
    );
    expect(upload).toContain(
      "!dashboard/test-results/visual/**/trace.zip",
    );
    expect(upload).not.toContain("error-context.md");
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

describe("visual baselines workflow", () => {
  test("is the only workflow that updates snapshots", () => {
    const offenders = readdirSync(workflowsDir)
      .filter((name) => /\.ya?ml$/.test(name))
      .filter((name) =>
        readFileSync(path.join(workflowsDir, name), "utf8").includes(
          "--update-snapshots",
        ),
      );
    expect(offenders).toEqual(["visual-baselines.yml"]);
    expect(existsSync(baselinesWorkflowPath)).toBe(true);
  });

  test("is dispatched by hand, generates in the pinned container and never touches main", () => {
    const workflow = readFileSync(baselinesWorkflowPath, "utf8");
    expect(workflow).toContain("name: Visual baselines");
    expect(workflow).toMatch(/on:\s*\n\s+workflow_dispatch:/);
    const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
    expect(triggers.match(/^  [a-z_]+:/gm)).toEqual(["  workflow_dispatch:"]);
    expect(existsSync(path.join(repositoryRoot, ".github/visual-baseline-request.json"))).toBe(false);
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read/m);
    for (const id of ["generate-public", "generate-authenticated"]) {
      const job = workflowJob(workflow, id);
      expectPinnedLinuxContainer(job);
      expect(job).not.toContain("contents: write");
    }
    expect(workflowJob(workflow, "generate-public")).not.toContain("secrets.");
    expect(workflowJob(workflow, "generate-authenticated")).toMatch(
      /environment:\s*\n\s+name: visual-test\s*\n\s+deployment: false/,
    );
    const resolve = workflowStep(workflow, "Resolve request");
    expect(resolve).toContain('"$branch" = "main"');
    const commit = workflowJob(workflow, "commit");
    expect(commit).toContain("contents: write");
    expect(commit).not.toContain("container:");
    expect(commit).not.toContain("--force");
    expect(commit).not.toContain("secrets.");
    expect(commit).toContain("git push origin \"HEAD:refs/heads/$BRANCH\"");
  });

  test("ships a local script that uses the same pinned image", () => {
    const script = readFileSync(
      path.join(process.cwd(), "scripts/visual-baselines-docker.sh"),
      "utf8",
    );
    expect(script).toContain(
      `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
    );
    expect(script).toContain("npm run test:visual:update");
  });
});
