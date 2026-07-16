import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("fresh visual authentication setup", () => {
  test("disables the Next development indicator in visual screenshots", () => {
    const nextConfig = read("next.config.mjs");

    expect(nextConfig).toContain("devIndicators: false");
  });

  test("logs both identities in through the real form in isolated contexts", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup.match(/test\(/g)).toHaveLength(1);
    expect(setup).toContain("activeBrowser.newContext({");
    expect(setup).toContain('page!.goto(`${baseURL}/login`,');
    expect(setup).toContain('getByLabel("Email", { exact: true })');
    expect(setup).toContain('getByLabel("Password", { exact: true })');
    expect(setup).toMatch(
      /getByRole\("button",\s*\{\s*name: "Sign in",\s*exact: true,?\s*\}\)/,
    );
    expect(setup).toContain('page.getByRole("alert")');
    expect(setup).toContain('waitFor({ state: "visible", timeout: 0 })');
    expect(setup).toContain("Promise.race([");
    expect(setup).not.toContain("alert.innerText()");
    expect(setup).toContain("formatVisualAuthDiagnostic");
    expect(setup).toContain("credentials.established");
    expect(setup).toContain("credentials.onboarding");
  });

  test("sends Vercel protection bypass headers in every protected preview context", () => {
    const config = read("playwright.config.ts");
    const setup = read("tests/visual/auth.setup.ts");

    expect(config).toContain("readVercelProtectionBypassHeaders");
    expect(config).toContain("extraHTTPHeaders: protectionBypassHeaders");
    expect(config).toContain('credentialBearing ? "github"');
    expect(setup).toContain("readVercelProtectionBypassHeaders(process.env)");
    expect(setup).toMatch(
      /activeBrowser\.newContext\(\{\s*extraHTTPHeaders: protectionBypassHeaders,?\s*\}\)/,
    );
    for (const source of [config, setup]) {
      expect(source).not.toContain("x-vercel-protection-bypass=");
      expect(source).not.toContain("searchParams");
    }
  });

  test("fails closed unless each identity reaches and renders its expected route", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup).toContain(".waitForURL(expectedURL, {");
    expect(setup).toContain(
      'expectedPath === "/profile" ? `${baseURL}/` : `${baseURL}/onboarding`',
    );
    expect(setup).toContain('page!.goto(`${baseURL}/profile`,');
    expect(setup).toMatch(
      /page!\.getByRole\("heading",\s*\{\s*name: "Profile",\s*exact: true,?\s*\}\)/,
    );
    expect(setup).not.toContain("waitForTimeout");
    expect(setup).not.toMatch(/console\.(?:log|info|debug)/);
  });

  test("uses bounded phases and starts outcome observation before submission", () => {
    const setup = read("tests/visual/auth.setup.ts");
    const outcomeIndex = setup.indexOf("const outcomePromise = waitForAuthenticationOutcome");
    const clickIndex = setup.indexOf('.click({ timeout: ACTION_TIMEOUT_MS, noWaitAfter: true })');

    expect(setup).toContain("test.setTimeout(TEST_TIMEOUT_MS)");
    expect(setup).toContain("const ACTION_TIMEOUT_MS = 10_000");
    expect(setup).toContain("const AUTH_OUTCOME_TIMEOUT_MS = 20_000");
    expect(setup).toContain("timeout: NAVIGATION_TIMEOUT_MS");
    expect(setup).toContain("waitUntil: \"domcontentloaded\"");
    expect(outcomeIndex).toBeGreaterThanOrEqual(0);
    expect(clickIndex).toBeGreaterThan(outcomeIndex);
  });

  test("reports safe network phases and preserves primary failures during cleanup", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup).toContain('page.on("response"');
    expect(setup).toContain('page.on("requestfailed"');
    expect(setup).toContain("response.request().method()");
    expect(setup).toContain("response.status()");
    expect(setup).toContain("new URL(response.url()).pathname");
    expect(setup).toContain("formatVisualAuthDiagnostic");
    expect(setup).toContain("let primaryError: unknown");
    expect(setup).toContain("primaryError = error");
    expect(setup).toMatch(
      /try\s*\{\s*await context\.close\(\);?\s*\}\s*catch\s*\{\s*if\s*\(!primaryError\)/,
    );
    expect(setup).not.toMatch(/console\.(?:log|info|debug)/);
    expect(setup).not.toContain("allHeaders");
    expect(setup).not.toContain("postData");
    expect(setup).not.toContain("cookie");
  });

  test("writes the exact disposable states and always closes each context", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup).toContain("await mkdir(VISUAL_AUTH_DIR, { recursive: true })");
    expect(setup).toContain("ESTABLISHED_STATE_PATH");
    expect(setup).toContain("ONBOARDING_STATE_PATH");
    expect(setup).toContain("context.storageState({ path: statePath })");
    expect(setup).toMatch(
      /finally\s*\{\s*try\s*\{\s*await context\.close\(\);?\s*\}/,
    );
  });

  test("defines setup and comparison projects without coupling public runs to setup", () => {
    const config = read("playwright.config.ts");

    expect(config).toContain("baseURL,");
    expect(config).toContain("process.env.VISUAL_BASE_URL ? undefined");
    expect(config).toContain('url: `${baseURL}/privacy`');
    expect(config).toContain('name: "auth-setup"');
    expect(config).toMatch(/testMatch:\s*\/auth\\\.setup\\\.ts\//);
    expect(config).toMatch(
      /name: "auth-setup",[\s\S]*use:\s*\{[\s\S]*trace: "off",[\s\S]*screenshot: "off",[\s\S]*video: "off",?[\s\S]*\}/,
    );
    expect(config).toContain('name: "visual"');
    expect(config).toMatch(/testMatch:\s*\/\\\.spec\\\.ts\//);
    expect(config).toMatch(/testIgnore:\s*\/auth\\\.setup\\\.ts\//);
    expect(config).toContain('dependencies: publicOnly ? [] : ["auth-setup"]');
  });

  test("uses file-backed state fail-closed and keeps setup credentials out of comparison", () => {
    const spec = read("tests/visual/ui-cohesion.spec.ts");
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(spec).toContain("ESTABLISHED_STATE_PATH");
    expect(spec).toContain("ONBOARDING_STATE_PATH");
    expect(spec).toContain("test.beforeAll(() => {");
    expect(spec).toContain("existsSync(ESTABLISHED_STATE_PATH)");
    expect(spec).toContain("existsSync(ONBOARDING_STATE_PATH)");
    expect(spec.indexOf("test.beforeAll(() => {")).toBeLessThan(
      spec.indexOf("existsSync(ESTABLISHED_STATE_PATH)"),
    );
    expect(spec).not.toContain("VISUAL_AUTH_STATE_JSON");
    expect(spec).not.toContain("VISUAL_ONBOARDING_AUTH_STATE_JSON");
    expect(pkg.scripts["test:visual"]).toBe(
      "VISUAL_DISABLE_TRACE=1 PLAYWRIGHT_NO_COPY_PROMPT=1 playwright test",
    );
    expect(pkg.scripts["test:visual:auth-setup"]).toBe(
      "PLAYWRIGHT_NO_COPY_PROMPT=1 playwright test --project=auth-setup",
    );
    expect(pkg.scripts["test:visual:authenticated"]).toBe(
      "VISUAL_SCOPE=authenticated VISUAL_DISABLE_TRACE=1 playwright test --project=visual --no-deps",
    );
    expect(pkg.scripts["test:visual:public"]).toBe(
      "VISUAL_SCOPE=public playwright test --project=visual --no-deps",
    );
    expect(pkg.scripts["test:visual:update"]).toBe(
      "VISUAL_SCOPE=public playwright test --project=visual --no-deps --update-snapshots",
    );
  });

  test("selects disjoint public and authenticated route subsets", () => {
    const spec = read("tests/visual/ui-cohesion.spec.ts");

    expect(spec).toContain(
      'const AUTHENTICATED_ONLY = process.env.VISUAL_SCOPE === "authenticated"',
    );
    expect(spec).toContain(
      'route.access === "authenticated" && PUBLIC_ONLY',
    );
    expect(spec).toContain(
      'route.access === "public" && AUTHENTICATED_ONLY',
    );
    expect(spec).toContain("Explicit public-only screenshot subset.");
    expect(spec).toContain("Explicit authenticated-only screenshot subset.");
  });

  test("disables traces for credential-bearing runs but retains public failure traces", () => {
    const config = read("playwright.config.ts");
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(config).toContain(
      'const disableTrace = process.env.VISUAL_DISABLE_TRACE === "1"',
    );
    expect(config).toMatch(
      /name: "visual",[\s\S]*use:\s*\{[\s\S]*trace: disableTrace \? "off" : "retain-on-failure"/,
    );
    expect(config).toMatch(
      /name: "visual",[\s\S]*use:\s*\{[\s\S]*video: "off"/,
    );
    expect(config).toMatch(
      /name: "auth-setup",[\s\S]*trace: "off",[\s\S]*screenshot: "off",[\s\S]*video: "off"/,
    );
    expect(pkg.scripts["test:visual"]).toContain("VISUAL_DISABLE_TRACE=1");
    expect(pkg.scripts["test:visual:authenticated"]).toContain(
      "VISUAL_DISABLE_TRACE=1",
    );
    expect(pkg.scripts["test:visual:public"]).not.toContain(
      "VISUAL_DISABLE_TRACE",
    );
    expect(pkg.scripts["test:visual:update"]).not.toContain(
      "VISUAL_DISABLE_TRACE",
    );
  });
});
