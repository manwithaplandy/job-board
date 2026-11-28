import { describe, expect, test } from "vitest";
import { VISUAL_ROUTES } from "@/tests/visual/routes";
import { AGENT_PAGE_FIXTURE_STATES } from "@/components/agent/agentPageFixtureStates";
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
      "admin", "agent", "analytics", "billing", "board", "companies", "entry", "feedback", "legal", "onboarding", "profile", "system-states", "workspaces",
    ]);
    const statesFor = (family: string) => new Set(VISUAL_ROUTES.filter((route) => route.family === family).map((route) => route.state));
    for (const state of ["default", "selected", "filter-empty", "rejected", "applied", "loading", "error-retry", "generation", "application-package"]) expect(statesFor("board").has(state)).toBe(true);
    for (const state of ["default", "error", "disabled", "destructive"]) expect(statesFor("profile").has(state)).toBe(true);
    expect(statesFor("admin").has("empty")).toBe(true);
    expect(statesFor("companies").has("empty")).toBe(true);
    expect(statesFor("analytics").has("data-viz")).toBe(true);
    for (const state of ["default", "empty", "budget", "disabled", "blocks-jobs", "blocks-prep", "tree-sample"]) expect(statesFor("agent").has(state)).toBe(true);
    for (const state of ["page-empty", "page-conversation", "page-surface", "page-failed", "page-blocks", "page-layout", "page-code", "page-view-building", "page-view-updated", "page-view-degraded", "page-views-multi"]) expect(statesFor("agent").has(state)).toBe(true);
    for (const state of ["default", "applications", "looking-for", "documents", "empty", "agent-marker", "memo-diff"]) expect(statesFor("workspaces").has(state)).toBe(true);
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
    expect(gallery).toContain("<AgentChat");
    expect(gallery).toContain("<AgentBlocksJobsFixture");
    expect(gallery).toContain("<AgentBlocksPrepFixture");
    expect(readFileSync("components/agent/blocks/AgentBlocksFixture.tsx", "utf8")).toContain("<BlockList");
    expect(gallery).toContain("<AgentTreeFixture");
    expect(readFileSync("components/agent/tree/AgentTreeFixture.tsx", "utf8")).toContain("<TreeRenderer");
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

  test("asserts admin routes are denied to the non-admin visual identity instead of screenshotting them", () => {
    // The established fixture is deliberately NOT in ADMIN_EMAILS (a CI secret must not
    // hold operator powers over prod tenants); admin visuals come from the admin fixture.
    const adminRoutes = VISUAL_ROUTES.filter((route) => route.path.startsWith("/admin"));
    expect(adminRoutes.length).toBeGreaterThan(0);
    for (const route of adminRoutes) {
      expect(route.access).toBe("authenticated");
      expect(route.adminOnly).toBe(true);
    }
    expect(VISUAL_ROUTES.filter((route) => route.adminOnly).every((route) => route.path.startsWith("/admin"))).toBe(true);
    const spec = readFileSync("tests/visual/ui-cohesion.spec.ts", "utf8");
    expect(spec).toContain("route.adminOnly");
    expect(spec).toMatch(/response\?\.status\(\)[^\n]*\)\.toBe\(404\)/);
  });

  test("declares live-data regions explicitly for routes rendered from the production database", () => {
    const live = VISUAL_ROUTES.filter((route) => route.live);
    expect(live.map((route) => route.id).sort()).toEqual(["analytics-default", "applications-default", "board-default", "companies-default", "documents-default", "looking-for-default", "shortlist-default"]);
    for (const route of live) {
      expect(route.access).toBe("authenticated");
      expect(route.live!.hide.length + route.live!.mask.length).toBeGreaterThan(0);
    }
    const spec = readFileSync("tests/visual/ui-cohesion.spec.ts", "utf8");
    expect(spec).toContain("route.live");
    // Full page for every route but the expanded agent views (spec 08 S6.1: fixed to the
    // viewport, page scrolling off), which are the only viewport-only routes.
    expect(spec).toContain("fullPage: !route.viewportOnly");
    expect(VISUAL_ROUTES.filter((route) => route.viewportOnly).map((route) => route.id).sort()).toEqual([
      "agent-page-code-expanded-fixture",
      "agent-page-view-expanded-fixture",
    ]);
  });

  test("skips test-driver routes in the screenshot matrix, so they need no baseline", () => {
    const harnesses = VISUAL_ROUTES.filter((route) => route.harness);
    expect(harnesses.map((route) => route.id)).toEqual(["agent-sandbox-harness", "agent-sandbox-harness-baseline-csp", "agent-surface-replay"]);
    for (const route of harnesses) {
      expect(route.access).toBe("public");
      expect(route.path.startsWith("/ui-gallery/")).toBe(true);
      expect(statSync(route.harness!).isFile()).toBe(true);
    }
    const spec = readFileSync("tests/visual/ui-cohesion.spec.ts", "utf8");
    expect(spec).toContain("test.skip(Boolean(route.harness)");
  });

  test("screenshots every agent page fixture state, and the inline-view states at the extra agent widths", () => {
    // Every gallery state AgentPageFixture renders is a public, screenshotted fixture route.
    const paths = new Set(VISUAL_ROUTES.filter((route) => route.access === "public" && !route.harness).map((route) => route.path));
    expect(AGENT_PAGE_FIXTURE_STATES.filter((state) => !paths.has(`/ui-gallery/states/${state}`))).toEqual([]);
    // The extra widths live in their own spec, picked up by the visual project (testMatch
    // /\.spec\.ts/) and so by test:visual:update; its snapshot names use -w<width>-, never
    // ui-cohesion's -desktop-/-mobile-.
    const spec = readFileSync("tests/visual/agent-page-widths.spec.ts", "utf8");
    // Spec 08 S12 and plan D10: one column at every width, from a phone to past the 1440px wrap.
    expect(spec).toContain("const WIDTHS = [375, 768, 1024, 1280, 1440, 2000] as const;");
    for (const state of [
      "agent-page-conversation",
      "agent-page-surface",
      "agent-page-failed",
      "agent-page-view-building",
      "agent-page-view-updated",
      "agent-page-view-degraded",
      "agent-page-steps-working",
      "agent-page-steps-done",
      "agent-page-steps-open",
      // PR 3 (spec 08 S6, S14.2): an expanded blocks view and an expanded code view.
      "agent-page-view-expanded",
      "agent-page-code-expanded",
      // PR 4 (spec 08 S4.4): one reply with two views between its paragraphs.
      "agent-page-views-multi",
    ]) expect(spec).toContain(`"${state}"`);
    // The surface column is gone (spec 08 S4.1): the spec asserts it is absent, never shown.
    expect(spec).not.toContain("SPLIT_FROM");
    expect(spec).toContain("-w${width}-${theme}.png");
    expect(spec).toContain("assertRuntimeContracts(page)");
    expect(spec).toContain("test.skip(AUTHENTICATED_ONLY");
    expect(spec).not.toContain("page.route(");
    expect(readFileSync("tests/visual/ui-cohesion.spec.ts", "utf8")).toContain('from "./runtime-contracts"');
    expect(readFileSync("playwright.config.ts", "utf8")).toContain("testMatch: /\\.spec\\.ts/");
  });

  test("has stable unique snapshot ids and explicit access policy", () => {
    const ids = VISUAL_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(VISUAL_ROUTES.every((route) => route.path.startsWith("/"))).toBe(true);
    expect(VISUAL_ROUTES.filter((route) => route.access === "authenticated").length).toBeGreaterThanOrEqual(14);
  });
});
