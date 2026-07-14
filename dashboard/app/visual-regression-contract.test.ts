import { describe, expect, test } from "vitest";
import { VISUAL_ROUTES } from "@/tests/visual/routes";
import { readFileSync } from "node:fs";

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
    expect(readFileSync("components/rolefit/JobDetail.tsx", "utf8")).toContain("data-fit-score-ring");
    expect(readFileSync("components/analytics/Chart.tsx", "utf8")).toContain('data-ui-visual="data-viz"');
  });

  test("has stable unique snapshot ids and explicit access policy", () => {
    const ids = VISUAL_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(VISUAL_ROUTES.every((route) => route.path.startsWith("/"))).toBe(true);
    expect(VISUAL_ROUTES.filter((route) => route.access === "authenticated").length).toBeGreaterThanOrEqual(14);
  });
});
