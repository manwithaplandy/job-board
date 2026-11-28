// The agent's shared limits (PR 7, inline-UI spec S9.6): a variant 3 step may emit 8,000
// output tokens; variants 1 and 2 keep 4,000.
import { describe, expect, test } from "vitest";
import { AGENT_LIMITS, outputTokensFor } from "@/lib/agent/config";

describe("outputTokensFor", () => {
  test("variant 3 gets maxOutputTokensV3 (8000); variants 1 and 2 keep maxOutputTokens (4000)", () => {
    expect(AGENT_LIMITS.maxOutputTokensV3).toBe(8000);
    expect(AGENT_LIMITS.maxOutputTokens).toBe(4000);
    expect(outputTokensFor(1)).toBe(4000);
    expect(outputTokensFor(2)).toBe(4000);
    expect(outputTokensFor(3)).toBe(8000);
  });
});
