# Visual CI Scope and Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public and authenticated visual gates run only their owned routes on the pinned canonical macOS baseline platform while keeping platform-independent dashboard checks on Ubuntu.

**Architecture:** Ordinary CI keeps the existing `dashboard` job name for platform-independent checks on Ubuntu and adds a dedicated `public-visual` job on `macos-14`. The deployment workflow also runs on `macos-14`, and `VISUAL_SCOPE=authenticated` filters its comparison to credentialed/onboarding routes after fresh setup. Documentation defines `macos-14` as the canonical screenshot platform and requires reviewed baseline updates from that platform.

**Tech Stack:** GitHub Actions YAML, Playwright, TypeScript, Vitest, npm scripts.

## Global Constraints

- Public routes belong only to the ordinary public visual job.
- Authenticated and onboarding routes belong only to the deployment workflow comparison.
- `macos-14` is the pinned canonical screenshot baseline platform.
- Credential-bearing runs and artifacts must contain no Playwright traces or authentication state.
- CI must never update screenshots automatically or loosen screenshot tolerances.
- Keep the existing ordinary `Dashboard tests` check name on Ubuntu to avoid changing its required-check identity.

---

### Task 1: Explicit authenticated Playwright scope

**Files:**
- Modify: `dashboard/tests/visual/auth-setup-contract.test.ts`
- Modify: `dashboard/tests/visual/ui-cohesion.spec.ts`
- Modify: `dashboard/package.json`

**Interfaces:**
- Consumes: `VISUAL_ROUTES[*].access` values `public` and `authenticated`.
- Produces: `VISUAL_SCOPE=authenticated` route selection for `test:visual:authenticated`.

- [x] **Step 1: Write failing contract tests**

Require `test:visual:authenticated` to set `VISUAL_SCOPE=authenticated`, and require the Playwright spec to skip public routes under that scope while retaining the existing public-only behavior.

- [x] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/auth-setup-contract.test.ts`

Expected: FAIL because the authenticated script currently has no scope and the spec only implements `PUBLIC_ONLY`.

- [x] **Step 3: Implement minimal scope selection**

Add `AUTHENTICATED_ONLY`, select state paths only when not public, make state-file preflight run only when authenticated routes are in scope, and skip each route when its access does not match an explicit scope. Set the authenticated npm script to `VISUAL_SCOPE=authenticated VISUAL_DISABLE_TRACE=1 playwright test --project=visual --no-deps`.

- [x] **Step 4: Run GREEN verification**

Run: `cd dashboard && npx vitest run tests/visual/auth-setup-contract.test.ts`

Expected: PASS.

---

### Task 2: Split ordinary dashboard and public visual jobs

**Files:**
- Modify: `dashboard/tests/visual/deployment-workflow-contract.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run test:visual:public`.
- Produces: Ubuntu `dashboard` job named `Dashboard tests` and macOS `public-visual` job named `Public visual`.

- [x] **Step 1: Write failing workflow contracts**

Require the dashboard job to stay on Ubuntu without Playwright steps; require a separate `public-visual` job on `macos-14` with inert environment values, Chromium installation, the public-only command, and trace-excluding failure artifacts.

- [x] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts`

Expected: FAIL because the current dashboard job is on macOS and owns the public visual steps.

- [x] **Step 3: Implement the workflow split**

Move only browser installation, public comparison, and public artifact upload to `public-visual`; duplicate the Node checkout/install setup and inert local environment required by the local Next server. Leave typecheck, lint, and Vitest in the existing Ubuntu dashboard job.

- [x] **Step 4: Run GREEN verification**

Run: `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts`

Expected: PASS.

---

### Task 3: Canonical deployment runner and baseline procedure

**Files:**
- Modify: `dashboard/tests/visual/deployment-workflow-contract.test.ts`
- Modify: `.github/workflows/authenticated-visual.yml`
- Modify: `docs/ui-contracts.md`

**Interfaces:**
- Consumes: `npm run test:visual:authenticated` and the `visual-test` protected environment.
- Produces: authenticated-only deployment comparisons on `macos-14` and a documented reviewed update procedure.

- [x] **Step 1: Write failing contracts**

Require deployment CI to run on `macos-14`, install Chromium without Linux dependency flags, and invoke the authenticated-only script. Require the UI contract documentation to name `macos-14` as canonical and state that baseline updates are generated there, inspected, and committed without tolerance changes.

- [x] **Step 2: Run RED verification**

Run: `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts`

Expected: FAIL because deployment CI runs on Ubuntu and the documentation has no canonical-platform rule.

- [x] **Step 3: Implement runner and documentation changes**

Pin the deployment job to `macos-14`, replace `playwright install --with-deps chromium` with `playwright install chromium`, and document the canonical platform and reviewed update procedure. Preserve trace exclusion, auth-state exclusion, cleanup, and the prohibition on automatic snapshot updates.

- [x] **Step 4: Run GREEN verification**

Run: `cd dashboard && npx vitest run tests/visual/deployment-workflow-contract.test.ts`

Expected: PASS.

---

### Task 4: Verification and commit

**Files:**
- Verify all modified files above.

**Interfaces:**
- Produces: evidence that contracts, TypeScript, YAML parsing, whitespace checks, and security boundaries remain valid.

- [x] **Step 1: Run focused tests**

Run: `cd dashboard && npx vitest run tests/visual/auth-setup-contract.test.ts tests/visual/deployment-workflow-contract.test.ts app/visual-regression-contract.test.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck and YAML parsing**

Run: `cd dashboard && npm run typecheck`

Run a repository-available YAML parser against both workflow files; if no parser dependency exists, use the system Ruby YAML parser with aliases enabled.

Expected: both commands exit 0.

- [x] **Step 3: Audit scopes and artifacts**

Search workflows and scripts to confirm public and authenticated commands have disjoint explicit scopes, both screenshot jobs use `macos-14`, no credential-bearing artifact includes traces/auth state, and no workflow contains `--update-snapshots`.

- [x] **Step 4: Check diff and commit**

Run: `git diff --check`

Expected: exit 0. Commit only the planned files with `fix(ci): separate visual regression scopes`.
