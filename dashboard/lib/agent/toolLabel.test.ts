import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { emptyGathered } from "@/lib/agent/gathered";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import { toolActivityLabel, toolFailureLabel, toolProgressLabel } from "./toolLabel";

function ctx(extra: Partial<ToolCtx> = {}): ToolCtx {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "me@example.test",
    threadId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 }, views: { used: 0 },
    ...extra,
  };
}

describe("toolActivityLabel", () => {
  it("says what a known tool did in plain words", () => {
    expect(toolActivityLabel("get_profile_summary")).toBe("Read your profile");
    expect(toolActivityLabel("search_jobs")).toBe("Searched your reviewed jobs");
  });
  it("falls back to readable words for an unknown tool", () => {
    expect(toolActivityLabel("compare_offers")).toBe("Used compare offers");
    expect(toolActivityLabel("")).toBe("Used a tool");
  });
});

describe("toolProgressLabel and toolFailureLabel", () => {
  it("fall back to fixed words for an unknown tool", () => {
    expect(toolProgressLabel("compare_offers")).toBe("Working");
    expect(toolFailureLabel("compare_offers")).toBe("A step did not work");
  });
  it("say what a known tool is doing and what failed", () => {
    expect(toolProgressLabel("search_jobs")).toBe("Searching your reviewed jobs");
    expect(toolFailureLabel("search_jobs")).toBe("Could not search your reviewed jobs");
    expect(toolProgressLabel("present")).toBe("Building a view");
    expect(toolActivityLabel("present")).toBe("Built a view");
    expect(toolFailureLabel("present")).toBe("Could not build a view");
    expect(toolActivityLabel("ask_user")).toBe("Asked you a question");
  });
});

describe("every tool the agent can call has all three labels", () => {
  // The approval tools exist only with the secret; a test-only key, never a real secret.
  beforeEach(() => {
    vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "t".repeat(40));
    resetApprovalSecretWarning();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads the names from the tool set, so a new tool without labels fails", () => {
    const names = [...new Set([...Object.keys(buildTools(ctx())), ...Object.keys(buildTools(ctx({ unattended: true })))])];
    expect(names).toEqual(expect.arrayContaining(["search_jobs", "present", "ask_user", "set_resume"]));
    for (const name of names) {
      expect(toolActivityLabel(name), name).not.toBe(toolActivityLabel("no_such_tool"));
      expect(toolProgressLabel(name), name).not.toBe("Working");
      expect(toolFailureLabel(name), name).not.toBe("A step did not work");
    }
  });
});
