# Credential-based Authenticated Visual CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create fresh established-user and onboarding Playwright sessions from protected test-account credentials for every successful Vercel Preview deployment, then run the authenticated visual matrix against that exact deployment.

**Architecture:** Keep pull-request CI limited to code checks and the auth-independent visual matrix. A separate `deployment_status` workflow validates a Vercel Preview URL, authenticates two isolated Playwright contexts, saves disposable states under `test-results/visual-auth`, and runs the exact deployed SHA's authenticated project without exposing credentials to the comparison step.

**Tech Stack:** GitHub Actions, Vercel deployment status events, Playwright 1.61, Next.js 16, Supabase password authentication through the real `/login` form, Vitest contract tests.

## Global Constraints

- Test the exact successful Vercel Preview deployment identified by `github.event.deployment.sha` and `github.event.deployment_status.environment_url`.
- Use dedicated synthetic, non-admin, non-billing test identities only.
- Store credentials in the protected GitHub Environment `visual-test` as `VISUAL_AUTH_EMAIL`, `VISUAL_AUTH_PASSWORD`, `VISUAL_ONBOARDING_EMAIL`, and `VISUAL_ONBOARDING_PASSWORD`.
- Never log, commit, or upload credentials, cookies, or generated storage states.
- Never give GitHub Actions `DATABASE_URL`, a Supabase service-role key, or production infrastructure credentials.
- Public visual CI must remain runnable without authenticated credentials.
- Missing credentials, invalid deployment URLs, wrong fixture identities, missing baselines, and visual mismatches fail closed.
- Screenshot updates are manual review artifacts; CI never runs `--update-snapshots`.

---

### Task 1: Authentication configuration contract

**Files:**
- Create: `dashboard/tests/visual/auth.ts`
- Create: `dashboard/tests/visual/auth.test.ts`
- Modify: `dashboard/app/visual-regression-contract.test.ts`
- Modify: `dashboard/.gitignore`

**Interfaces:**
- Produces: `VISUAL_AUTH_DIR`, `ESTABLISHED_STATE_PATH`, `ONBOARDING_STATE_PATH` string constants.
- Produces: `readVisualCredentials(env): { established: { email; password }; onboarding: { email; password } }`.
- Produces: `validateVisualBaseUrl(raw): string` returning an HTTPS `*.vercel.app` URL without a trailing slash.
- Consumes: only explicit environment objects; helpers never read or print secret values in error messages.

- [ ] **Step 1: Write failing unit and contract tests**

Add tests that require all four credential names, assert an error identifies only a missing variable, reject non-HTTPS/non-Vercel URLs, normalize a valid preview URL, require two distinct state paths under `test-results/visual-auth`, require that directory in `.gitignore`, and reject any remaining CI reference to `VISUAL_AUTH_STATE_JSON` or `VISUAL_ONBOARDING_AUTH_STATE_JSON`.

```ts
expect(() => readVisualCredentials({})).toThrow("VISUAL_AUTH_EMAIL is required");
expect(() => validateVisualBaseUrl("http://example.com")).toThrow("HTTPS Vercel Preview URL");
expect(validateVisualBaseUrl("https://example.vercel.app/")).toBe("https://example.vercel.app");
expect(ESTABLISHED_STATE_PATH).not.toBe(ONBOARDING_STATE_PATH);
```

- [ ] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/auth.test.ts app/visual-regression-contract.test.ts`  
Expected: FAIL because `auth.ts`, ignore coverage, and the credential-based CI contract do not exist.

- [ ] **Step 3: Implement the minimal helper**

Use `node:path` to place `established.json` and `onboarding.json` beneath `test-results/visual-auth`. Validate credentials in fixed name order, return only the values after all are present, and never interpolate a value into an error. Validate URLs with `new URL`, `protocol === "https:"`, and `hostname.endsWith(".vercel.app")`.

```ts
import path from "node:path";

export const VISUAL_AUTH_DIR = path.resolve(process.cwd(), "test-results/visual-auth");
export const ESTABLISHED_STATE_PATH = path.join(VISUAL_AUTH_DIR, "established.json");
export const ONBOARDING_STATE_PATH = path.join(VISUAL_AUTH_DIR, "onboarding.json");

type Env = Record<string, string | undefined>;

export function readVisualCredentials(env: Env) {
  const names = [
    "VISUAL_AUTH_EMAIL",
    "VISUAL_AUTH_PASSWORD",
    "VISUAL_ONBOARDING_EMAIL",
    "VISUAL_ONBOARDING_PASSWORD",
  ] as const;
  for (const name of names) if (!env[name]) throw new Error(`${name} is required`);
  return {
    established: { email: env.VISUAL_AUTH_EMAIL!, password: env.VISUAL_AUTH_PASSWORD! },
    onboarding: { email: env.VISUAL_ONBOARDING_EMAIL!, password: env.VISUAL_ONBOARDING_PASSWORD! },
  };
}

export function validateVisualBaseUrl(raw: string | undefined) {
  if (!raw) throw new Error("VISUAL_BASE_URL is required");
  const url = new URL(raw);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app")) {
    throw new Error("VISUAL_BASE_URL must be an HTTPS Vercel Preview URL");
  }
  return url.origin;
}
```

- [ ] **Step 4: Run GREEN verification**

Run: `cd dashboard && npx vitest run tests/visual/auth.test.ts app/visual-regression-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/tests/visual/auth.ts dashboard/tests/visual/auth.test.ts dashboard/app/visual-regression-contract.test.ts dashboard/.gitignore
git commit -m "test(ci): define visual credential contract"
```

---

### Task 2: Fresh Playwright authentication projects

**Files:**
- Create: `dashboard/tests/visual/auth.setup.ts`
- Create: `dashboard/tests/visual/auth-setup-contract.test.ts`
- Modify: `dashboard/playwright.config.ts`
- Modify: `dashboard/tests/visual/ui-cohesion.spec.ts`
- Modify: `dashboard/package.json`

**Interfaces:**
- Consumes: Task 1 credential reader, URL validator, and state paths.
- Produces: Playwright project `auth-setup` matching only `auth.setup.ts`.
- Produces: Playwright project `visual` ignoring `auth.setup.ts` and depending on `auth-setup` outside public scope.
- Produces scripts `test:visual:auth-setup` and `test:visual:authenticated`.

- [ ] **Step 1: Write failing structural tests**

Require an isolated-context login setup that fills the real `Email` and `Password` fields, submits `Sign in`, rejects `/login` errors, asserts the established identity can render `/profile`, asserts the second identity lands on `/onboarding`, writes the two exact state paths, and closes both contexts in `finally`. Require public scope to use `--project=visual --no-deps` and authenticated comparison to use the same project with `--no-deps` after setup.

- [ ] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/auth-setup-contract.test.ts app/visual-regression-contract.test.ts`  
Expected: FAIL because the setup project and file-backed state selection do not exist.

- [ ] **Step 3: Implement the authentication setup**

Create the auth directory with `mkdir({ recursive: true })`. For each identity, create a separate browser context, navigate to `${baseURL}/login`, fill by exact label, submit by exact role/name, wait for navigation, assert the expected route, save `context.storageState({ path })`, and close the context in `finally`. Do not print page HTML, credentials, cookies, or state contents.

```ts
import { mkdir } from "node:fs/promises";
import { expect, test, type Browser } from "@playwright/test";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
  readVisualCredentials,
  validateVisualBaseUrl,
  VISUAL_AUTH_DIR,
} from "./auth";

test("creates isolated established and onboarding sessions", async ({ browser }) => {
  const baseURL = validateVisualBaseUrl(process.env.VISUAL_BASE_URL);
  const credentials = readVisualCredentials(process.env);
  await mkdir(VISUAL_AUTH_DIR, { recursive: true });

  async function signIn(
    activeBrowser: Browser,
    identity: { email: string; password: string },
    statePath: string,
    expectedPath: "/profile" | "/onboarding",
  ) {
    const context = await activeBrowser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/login`);
      await page.getByLabel("Email", { exact: true }).fill(identity.email);
      await page.getByLabel("Password", { exact: true }).fill(identity.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      if (expectedPath === "/profile") {
        await page.waitForURL(`${baseURL}/`);
        await page.goto(`${baseURL}/profile`);
        await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
      } else {
        await page.waitForURL(`${baseURL}/onboarding`);
      }
      await context.storageState({ path: statePath });
    } finally {
      await context.close();
    }
  }

  await signIn(browser, credentials.established, ESTABLISHED_STATE_PATH, "/profile");
  await signIn(browser, credentials.onboarding, ONBOARDING_STATE_PATH, "/onboarding");
});
```

Configure projects equivalent to:

```ts
projects: [
  { name: "auth-setup", testMatch: /auth\.setup\.ts/ },
  {
    name: "visual",
    testIgnore: /auth\.setup\.ts/,
    dependencies: publicOnly ? [] : ["auth-setup"],
  },
]
```

Update the visual spec so public scope uses `undefined` storage state and authenticated scope selects `ESTABLISHED_STATE_PATH` or `ONBOARDING_STATE_PATH`. It must fail if either generated file is missing.

Package scripts must be exactly scoped so the comparison step cannot rerun setup with credentials:

```json
{
  "test:visual:auth-setup": "playwright test --project=auth-setup",
  "test:visual:authenticated": "playwright test --project=visual --no-deps",
  "test:visual:public": "VISUAL_SCOPE=public playwright test --project=visual --no-deps"
}
```

- [ ] **Step 4: Run GREEN verification**

Run: `cd dashboard && npx vitest run tests/visual/auth-setup-contract.test.ts app/visual-regression-contract.test.ts`  
Expected: PASS.

Run: `cd dashboard && npm run test:visual:public -- --reporter=dot`  
Expected: 96 public/deterministic cases pass and authenticated cases skip explicitly without credentials.

- [ ] **Step 5: Commit**

```bash
git add dashboard/tests/visual/auth.setup.ts dashboard/tests/visual/auth-setup-contract.test.ts dashboard/playwright.config.ts dashboard/tests/visual/ui-cohesion.spec.ts dashboard/package.json
git commit -m "feat(ci): create fresh visual auth sessions"
```

---

### Task 3: Deployment-triggered protected workflow and documentation

**Files:**
- Create: `.github/workflows/authenticated-visual.yml`
- Create: `dashboard/tests/visual/deployment-workflow-contract.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/ui-contracts.md`
- Modify: `.superpowers/sdd/ui-cohesion-task-9-report.md`

**Interfaces:**
- Consumes: Task 2 scripts and generated state paths.
- Produces: protected GitHub Environment job `authenticated-visual` triggered by successful Vercel Preview `deployment_status`.
- Produces: failure artifact `authenticated-visual-results` containing `dashboard/test-results/visual/**` only.

- [ ] **Step 1: Write failing workflow tests**

Read both workflow files as text and require:

- ordinary CI contains the public visual gate and none of the two obsolete state secrets;
- deployment workflow triggers on `deployment_status`, guards the Vercel bot creator, success, Preview, HTTPS, and `.vercel.app`;
- checkout uses `github.event.deployment.sha`;
- job uses environment `visual-test`;
- setup step receives exactly the four credential secrets and `VISUAL_BASE_URL`;
- comparison step receives only `VISUAL_BASE_URL` and uses `--no-deps`;
- artifact upload runs on failure and cannot include `test-results/visual-auth`;
- cleanup runs with `if: always()` and removes both generated JSON paths.

- [ ] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts app/visual-regression-contract.test.ts`  
Expected: FAIL because the deployment workflow does not exist and ordinary CI still requires state JSON.

- [ ] **Step 3: Implement workflow and docs**

The workflow checks out the deployment SHA, installs Node dependencies and Chromium, validates the URL before credential use, runs `npm run test:visual:auth-setup` with the four secrets scoped to that step, runs `npm run test:visual:authenticated` with only the base URL, uploads `dashboard/test-results/visual/**` on failure, and removes generated state files under `always()`.

```yaml
name: Authenticated visual

on:
  deployment_status:

permissions:
  contents: read

jobs:
  authenticated-visual:
    if: >-
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.creator.login == 'vercel[bot]' &&
      github.event.deployment.environment == 'Preview' &&
      startsWith(github.event.deployment_status.environment_url, 'https://') &&
      contains(github.event.deployment_status.environment_url, '.vercel.app')
    runs-on: ubuntu-latest
    environment:
      name: visual-test
      url: ${{ github.event.deployment_status.environment_url }}
    defaults:
      run:
        working-directory: dashboard
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.deployment.sha }}
      - uses: actions/setup-node@v6
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: dashboard/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Create authenticated sessions
        env:
          VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}
          VISUAL_AUTH_EMAIL: ${{ secrets.VISUAL_AUTH_EMAIL }}
          VISUAL_AUTH_PASSWORD: ${{ secrets.VISUAL_AUTH_PASSWORD }}
          VISUAL_ONBOARDING_EMAIL: ${{ secrets.VISUAL_ONBOARDING_EMAIL }}
          VISUAL_ONBOARDING_PASSWORD: ${{ secrets.VISUAL_ONBOARDING_PASSWORD }}
        run: npm run test:visual:auth-setup
      - name: Compare authenticated visuals
        env:
          VISUAL_BASE_URL: ${{ github.event.deployment_status.environment_url }}
        run: npm run test:visual:authenticated
      - name: Upload visual failure evidence
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: authenticated-visual-results
          path: dashboard/test-results/visual/**
          if-no-files-found: ignore
          retention-days: 7
      - name: Remove authenticated state
        if: always()
        run: node -e 'const fs=require("node:fs");for(const p of ["test-results/visual-auth/established.json","test-results/visual-auth/onboarding.json"])fs.rmSync(p,{force:true})'
```

Update documentation to describe the four credential secrets, protected environment, exact deployment event, local command, initial missing-baseline artifact process, and removal of obsolete state secrets.

- [ ] **Step 4: Run GREEN and full verification**

Run:

```bash
cd dashboard
npx vitest run tests/visual/auth.test.ts tests/visual/auth-setup-contract.test.ts tests/visual/deployment-workflow-contract.test.ts app/visual-regression-contract.test.ts
npm test
npm run typecheck
npm run lint
VISUAL_BASE_URL=http://127.0.0.1:3000 npm run test:visual:public -- --reporter=dot
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/job_board npm run build
```

Expected: focused and full tests pass, typecheck passes, lint has zero errors, public visual comparison has zero diffs, and production build exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/authenticated-visual.yml .github/workflows/ci.yml dashboard/tests/visual/deployment-workflow-contract.test.ts docs/ui-contracts.md
git add -u .superpowers/sdd/ui-cohesion-task-9-report.md
git commit -m "ci: authenticate visual tests per deployment"
```

---

### Task 4: Protected environment, first run, and authenticated baselines

**Files:**
- Modify after visual review: `dashboard/tests/visual/__screenshots__/*-desktop-{light,dark}.png`
- Modify after visual review: `dashboard/tests/visual/__screenshots__/*-mobile-{light,dark}.png`

**Interfaces:**
- Consumes: four credential values supplied directly to GitHub Environment secrets, never chat or repository files.
- Produces: reviewed authenticated screenshot baselines and a green `Authenticated visual` deployment check.

- [ ] **Step 1: Create the protected environment**

Create GitHub Environment `visual-test`, configure required reviewers for non-default branches, and add the four credential secrets. Confirm secret names only; never read values back.

- [ ] **Step 2: Push and trigger Vercel Preview deployment**

Push the implementation commits to `codex/profile-ux-overhaul`. Confirm the deployment workflow resolves the exact environment URL and SHA.

- [ ] **Step 3: Collect first-run actual screenshots**

If authenticated baselines are missing, download `authenticated-visual-results`, verify it contains no `visual-auth` directory or JSON state, and inspect every authenticated actual PNG. Copy only approved actual images into `dashboard/tests/visual/__screenshots__` using the spec's expected names.

- [ ] **Step 4: Adversarial browser and code review**

Review established routes and onboarding at 390x844 and 1440x1000 in light/dark. Check overflow, 44x44 targets, themed controls, shell count, SVG provenance, console output, and screenshot fidelity. Return all Critical/Important findings to the implementer and repeat until 0 Critical/0 Important.

- [ ] **Step 5: Commit baselines and rerun**

```bash
git add dashboard/tests/visual/__screenshots__
git commit -m "test(ui): add authenticated deployment baselines"
git push origin codex/profile-ux-overhaul
```

Expected: Vercel, ordinary dashboard CI, Python CI, public visual, and authenticated deployment visual checks all pass.
