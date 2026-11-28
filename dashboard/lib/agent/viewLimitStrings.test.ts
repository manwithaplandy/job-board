// Fix wave M11: the per-turn view cap is stated in three strings (the limit error, the present
// tool's description and the scenario rule). Each takes its number from
// AGENT_LIMITS.maxViewsPerTurn, so changing the cap changes what the model is told. This file
// loads the modules with a different cap and checks that every string follows it.
import { expect, test, vi } from "vitest";

vi.mock("@/lib/agent/config", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/agent/config")>();
  return { ...real, AGENT_LIMITS: { ...real.AGENT_LIMITS, maxViewsPerTurn: 5 } };
});
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn() }));
vi.mock("@/lib/agent/surfaces/store", () => ({ saveSurface: vi.fn(), setSurfaceFailure: vi.fn() }));

import { AGENT_LIMITS } from "@/lib/agent/config";
import { scenarioRules } from "@/lib/agent/context";
import { presentDescription, VIEW_LIMIT_ERROR } from "@/lib/agent/tools/present";

test("the cap here is the mocked one", () => {
  expect(AGENT_LIMITS.maxViewsPerTurn).toBe(5);
});

test("VIEW_LIMIT_ERROR states AGENT_LIMITS.maxViewsPerTurn", () => {
  expect(VIEW_LIMIT_ERROR).toBe("This turn already has 5 views. Finish the answer in text.");
});

test.each([1, 2, 3] as const)("variant %i: present's description states AGENT_LIMITS.maxViewsPerTurn twice", (variant) => {
  const d = presentDescription(variant);
  expect(d).toContain("You may show up to 5 views in one turn, each where it belongs in your answer.");
  expect(d).toContain("outcome limit means the turn has its 5 views: do not call present again.");
  expect(d).not.toMatch(/\b3 views\b/);
});

test("the scenario rule states AGENT_LIMITS.maxViewsPerTurn", () => {
  const text = scenarioRules({ unattended: false }).join("\n");
  expect(text).toContain("Use at most 5 views in a turn");
  expect(text).not.toContain("Use at most 3 views");
});
