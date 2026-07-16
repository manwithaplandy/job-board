# Visual Test Without Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the protected `visual-test` GitHub environment for authenticated Playwright secrets and approval while preventing GitHub from creating misleading deployment records.

**Architecture:** Configure the existing authenticated visual job to use its GitHub environment without a deployment object. Preserve the Vercel `deployment_status` trigger and every test/security step; remove only the environment URL that has no meaning without a deployment record.

**Tech Stack:** GitHub Actions YAML, Vitest workflow contract tests, Playwright visual CI.

## Global Constraints

- Keep the environment name exactly `visual-test` so its five existing secrets remain scoped correctly.
- Set `deployment: false` and remove `environment.url`.
- Preserve required-reviewer and wait-timer compatibility; `visual-test` has zero custom GitHub App deployment-protection rules.
- Do not move credentials to repository secrets or weaken authenticated-test security controls.
- Do not change the Vercel `deployment_status` trigger, identity checks, visual commands, artifacts, or cleanup.
- Full timeline behavior can only be proven after the workflow definition reaches the default branch.

---

### Task 1: Use the protected environment without a deployment record

**Files:**
- Modify: `.github/workflows/authenticated-visual.yml`
- Modify: `dashboard/tests/visual/deployment-workflow-contract.test.ts`

**Interfaces:**
- Consumes: GitHub environment `visual-test`, its secrets/protection rules, and the successful Vercel Preview `deployment_status` payload.
- Produces: An authenticated visual job that remains environment-gated but creates no GitHub Deployment object.

- [ ] **Step 1: Write the failing workflow contract test**

Add a focused test that requires this exact environment block behavior:

```ts
test("uses visual-test secrets without creating a deployment record", () => {
  const workflow = readFileSync(authenticatedWorkflowPath, "utf8");
  const job = workflowJob(workflow, "authenticated-visual");
  expect(job).toMatch(
    /environment:\s*\n\s+name: visual-test\s*\n\s+deployment: false/,
  );
  expect(job).not.toMatch(/^\s+url:/m);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `dashboard`:

```bash
npx vitest run tests/visual/deployment-workflow-contract.test.ts
```

Expected: FAIL because the workflow still contains `url:` and lacks `deployment: false`.

- [ ] **Step 3: Apply the minimal workflow change**

Change only the job environment block to:

```yaml
environment:
  name: visual-test
  deployment: false
```

- [ ] **Step 4: Verify GREEN and workflow integrity**

Run from `dashboard`:

```bash
npx vitest run tests/visual/deployment-workflow-contract.test.ts
npx tsc --noEmit
```

Parse the workflow YAML with the repository's available YAML parser, and run `git diff --check`. Expected: all commands exit 0.

- [ ] **Step 5: Commit and publish through the existing PR branch**

Commit only the workflow, its contract test, and this approved plan. Push the detached commit to `origin/codex/profile-ux-overhaul`, then confirm ordinary CI and the Vercel Preview deployment still run. Record that absence of future `visual-test` deployment entries requires the workflow file to be merged to the default branch.
