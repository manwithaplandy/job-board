import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("fresh visual authentication setup", () => {
  test("logs both identities in through the real form in isolated contexts", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup.match(/test\(/g)).toHaveLength(1);
    expect(setup).toContain("activeBrowser.newContext()");
    expect(setup).toContain('page.goto(`${baseURL}/login`)');
    expect(setup).toContain('getByLabel("Email", { exact: true })');
    expect(setup).toContain('getByLabel("Password", { exact: true })');
    expect(setup).toContain(
      'getByRole("button", { name: "Sign in", exact: true })',
    );
    expect(setup).toContain('page.getByRole("alert")');
    expect(setup).toContain('waitFor({ state: "visible" })');
    expect(setup).toContain("Promise.race([");
    expect(setup).toContain("await alert.innerText()");
    expect(setup).toContain("Visual authentication failed:");
    expect(setup).toContain("credentials.established");
    expect(setup).toContain("credentials.onboarding");
  });

  test("fails closed unless each identity reaches and renders its expected route", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup).toContain("page.waitForURL(expectedURL)");
    expect(setup).toContain(
      'expectedPath === "/profile" ? `${baseURL}/` : `${baseURL}/onboarding`',
    );
    expect(setup).toContain('await page.goto(`${baseURL}/profile`)');
    expect(setup).toContain(
      'page.getByRole("heading", { name: "Profile", exact: true })',
    );
    expect(setup).not.toContain("waitForTimeout");
    expect(setup).not.toMatch(/console\.(?:log|info|debug)/);
  });

  test("writes the exact disposable states and always closes each context", () => {
    const setup = read("tests/visual/auth.setup.ts");

    expect(setup).toContain("await mkdir(VISUAL_AUTH_DIR, { recursive: true })");
    expect(setup).toContain("ESTABLISHED_STATE_PATH");
    expect(setup).toContain("ONBOARDING_STATE_PATH");
    expect(setup).toContain("await context.storageState({ path: statePath })");
    expect(setup).toMatch(/try\s*\{[\s\S]*\}\s*finally\s*\{\s*await context\.close\(\);?\s*\}/);
  });

  test("defines setup and comparison projects without coupling public runs to setup", () => {
    const config = read("playwright.config.ts");

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
    expect(pkg.scripts["test:visual:auth-setup"]).toBe(
      "playwright test --project=auth-setup",
    );
    expect(pkg.scripts["test:visual:authenticated"]).toBe(
      "playwright test --project=visual --no-deps",
    );
    expect(pkg.scripts["test:visual:public"]).toBe(
      "VISUAL_SCOPE=public playwright test --project=visual --no-deps",
    );
    expect(pkg.scripts["test:visual:update"]).toBe(
      "VISUAL_SCOPE=public playwright test --project=visual --no-deps --update-snapshots",
    );
  });
});
