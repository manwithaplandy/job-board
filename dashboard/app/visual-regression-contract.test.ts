import { describe, expect, test } from "vitest";
import { VISUAL_ROUTES } from "@/tests/visual/routes";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
  VISUAL_AUTH_DIR,
} from "@/tests/visual/auth";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function pages(directory = "app", output: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const entry = path.join(directory, name);
    if (statSync(entry).isDirectory()) pages(entry, output);
    else if (name === "page.tsx") output.push(entry);
  }
  return output;
}

describe("visual regression route inventory", () => {
  test("covers every route family and the required named state inventory", () => {
    const families = new Set(VISUAL_ROUTES.map((route) => route.family));
    expect([...families].sort()).toEqual([
      "admin", "analytics", "billing", "board", "companies", "entry", "legal", "onboarding", "profile", "system-states",
    ]);
    const statesFor = (family: string) => new Set(VISUAL_ROUTES.filter((route) => route.family === family).map((route) => route.state));
    for (const state of ["default", "selected", "filter-empty", "rejected", "applied", "loading", "error-retry", "generation", "application-package"]) expect(statesFor("board").has(state)).toBe(true);
    for (const state of ["default", "error", "disabled", "destructive"]) expect(statesFor("profile").has(state)).toBe(true);
    expect(statesFor("admin").has("empty")).toBe(true);
    expect(statesFor("companies").has("empty")).toBe(true);
    expect(statesFor("analytics").has("data-viz")).toBe(true);
  });

  test("documents route-specific shell and exact SVG provenance contracts", () => {
    expect(VISUAL_ROUTES.find((route) => route.id === "onboarding")?.shell).toBe("entry");
    expect(VISUAL_ROUTES.find((route) => route.id === "onboarding")?.authState).toBe("onboarding");
    expect(VISUAL_ROUTES.find((route) => route.id === "reset-password-update")?.authState).toBe("normal");
    expect(readFileSync("components/rolefit/JobDetail.tsx", "utf8")).toContain("data-fit-score-ring");
    expect(readFileSync("components/analytics/Chart.tsx", "utf8")).toContain('data-ui-visual="data-viz"');
  });

  test("renders deterministic board stories through production board components", () => {
    const fixture = readFileSync("components/rolefit/VisualBoardState.tsx", "utf8");
    expect(fixture).toContain('import { JobDetail');
    expect(fixture).toContain('import { JobList');
    for (const state of ["selected", "filter-empty", "rejected", "applied", "loading", "error-retry", "generation", "application-package"]) expect(fixture).toContain(`\"${state}\"`);
    const gallery = readFileSync("components/ui/VisualStateFixture.tsx", "utf8");
    expect(gallery).toContain("<VisualBoardState");
    expect(gallery).toContain("<HBarCard");
    expect(fixture).toContain('state === "selected" || state === "rejected"');
    expect(fixture).toContain("jobs={[JOB]}");
    expect(fixture).toContain("selectedId={JOB.id}");
    expect(fixture).toContain('view={state === "rejected" ? "rejected" : "all"}');
    expect(readFileSync("components/rolefit/JobList.tsx", "utf8")).toContain("<JobCard");
    expect(fixture).toContain('generating ? { [JOB.id]: "busy" }');
    expect(fixture).not.toContain('generating ? { [JOB.id]: "loading" }');
  });

  test("requires distinct disposable established-user and onboarding-user browser states", () => {
    const spec = readFileSync("tests/visual/ui-cohesion.spec.ts", "utf8");
    const authHelper = readFileSync("tests/visual/auth.ts", "utf8");
    expect(ESTABLISHED_STATE_PATH).not.toBe(ONBOARDING_STATE_PATH);
    expect(ESTABLISHED_STATE_PATH.startsWith(VISUAL_AUTH_DIR)).toBe(true);
    expect(ONBOARDING_STATE_PATH.startsWith(VISUAL_AUTH_DIR)).toBe(true);
    expect(authHelper).not.toContain("VISUAL_AUTH_STATE_JSON");
    expect(authHelper).not.toContain("VISUAL_ONBOARDING_AUTH_STATE_JSON");
    expect(spec).toContain('route.authState === "onboarding"');
  });

  test("ignores generated visual authentication state", () => {
    expect(readFileSync(".gitignore", "utf8")).toMatch(
      /^test-results\/visual-auth\/$/m,
    );
  });

  test("discovers visual contract tests without collecting Playwright files", () => {
    const vitestConfig = readFileSync("vitest.config.ts", "utf8");
    expect(vitestConfig).toContain('"tests/visual/**/*.test.ts"');
    expect(vitestConfig).not.toContain('"tests/visual/**/*.spec.ts"');
    expect(vitestConfig).not.toContain('"tests/visual/**/*.setup.ts"');
  });

  test("declares every real page route in the canonical visual inventory", () => {
    const declared = new Set(VISUAL_ROUTES.map((route) => route.path));
    const realPages = pages().filter((file) => file !== "app/ui-gallery/states/[state]/page.tsx").map((file) => {
      const segment = file.slice("app".length, -"/page.tsx".length);
      return segment || "/";
    });
    expect(realPages.filter((route) => !declared.has(route))).toEqual([]);
  });

  test("has stable unique snapshot ids and explicit access policy", () => {
    const ids = VISUAL_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(VISUAL_ROUTES.every((route) => route.path.startsWith("/"))).toBe(true);
    expect(VISUAL_ROUTES.filter((route) => route.access === "authenticated").length).toBeGreaterThanOrEqual(14);
  });
});
