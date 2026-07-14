import { describe, expect, test } from "vitest";
import { VISUAL_ROUTES } from "@/tests/visual/routes";

describe("visual regression route inventory", () => {
  test("covers every route family and both default and exceptional states", () => {
    const families = new Set(VISUAL_ROUTES.map((route) => route.family));
    expect([...families].sort()).toEqual([
      "admin", "analytics", "billing", "board", "companies", "entry", "legal", "onboarding", "profile", "system-states",
    ]);
    expect(VISUAL_ROUTES.some((route) => route.id.includes("error"))).toBe(true);
    expect(VISUAL_ROUTES.some((route) => route.id.includes("gallery"))).toBe(true);
  });

  test("has stable unique snapshot ids and explicit access policy", () => {
    const ids = VISUAL_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(VISUAL_ROUTES.every((route) => route.path.startsWith("/"))).toBe(true);
    expect(VISUAL_ROUTES.filter((route) => route.access === "authenticated").length).toBeGreaterThanOrEqual(14);
  });
});
