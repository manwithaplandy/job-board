// The steps row's pure half (spec 08 sections 7.1 and 7.2): which tool parts are steps,
// how they group, and the row's words. No React.
import { describe, expect, test } from "vitest";
import type { UIMessage } from "ai";
import { currentStepLabel, formatElapsed, STEPS_PENDING_LABEL, stepsHeadline, summarizeSteps, type StepSummary } from "./steps";
import { toolActivityLabel, toolFailureLabel, toolProgressLabel } from "./toolLabel";

type Part = UIMessage["parts"][number];
let n = 0;

// Parts as the stream and the store hand them over: plain objects. The one cast is the
// fixture's own claim that it builds a message part; the helper under test parses it.
function tool(name: string, state: string, output?: unknown): Part {
  n += 1;
  const part: Record<string, unknown> = { type: `tool-${name}`, toolCallId: `call-${n}`, state, input: {} };
  if (output !== undefined) part.output = output;
  if (state === "output-error") part.errorText = "boom";
  if (state.startsWith("approval-") || state === "output-denied") part.approval = { id: `ap-${n}`, approved: state === "output-denied" ? false : undefined };
  return part as Part;
}
const done = (name: string) => tool(name, "output-available", { ok: true });
const five = (name: string) => Array.from({ length: 5 }, () => done(name));
const present = (outcome: string) => tool("present", "output-available", { surfaceId: "11111111-1111-4111-8111-111111111111", variant: 1, outcome });
const text = (t: string): Part => ({ type: "text", text: t });
const empty: StepSummary = { groups: [], failures: [], declined: [], total: 0, failed: 0 };

describe("summarizeSteps", () => {
  test("groups by tool in first-occurrence order with counts", () => {
    const s = summarizeSteps([...five("search_jobs"), done("get_job"), text("Here")]);
    expect(s.groups.map((g) => [g.label, g.count])).toEqual([
      ["Searched your reviewed jobs", 5],
      ["Read a job posting", 1],
    ]);
    expect(s.total).toBe(6);
    expect(s.failed).toBe(0);
  });

  test("interleaved calls still group under their first occurrence", () => {
    const s = summarizeSteps([done("search_jobs"), done("get_job"), done("search_jobs")]);
    expect(s.groups.map((g) => [g.key, g.count])).toEqual([
      ["search_jobs", 2],
      ["get_job", 1],
    ]);
  });

  test("present outcomes", () => {
    const s = summarizeSteps([present("invalid"), present("repaired"), present("fallback"), present("limit")]);
    expect(s.groups.map((g) => g.label)).toEqual([
      "Reworked a view that did not pass checks",
      "Built a view",
      "Showed a simpler view instead",
    ]);
    expect(s.total).toBe(3);
  });

  test("valid and repaired views share one group; a present still running counts as building", () => {
    const s = summarizeSteps([present("valid"), present("repaired"), tool("present", "input-streaming")]);
    expect(s.groups).toEqual([{ key: "present:Built a view", label: "Built a view", count: 3, running: true }]);
  });

  test("a present output that does not parse is still a built view, not a crash", () => {
    const s = summarizeSteps([tool("present", "output-available", "not an object")]);
    expect(s.groups.map((g) => [g.label, g.running])).toEqual([["Built a view", false]]);
  });

  test("ask_user and waiting approvals are not steps; denied and failed are", () => {
    const s = summarizeSteps([
      tool("ask_user", "output-available"),
      tool("set_resume", "approval-requested"),
      tool("set_resume", "approval-responded"),
      tool("set_resume", "output-denied"),
      tool("get_job", "output-error"),
    ]);
    expect(s.groups).toEqual([]);
    expect(s.declined).toEqual(["You declined: updated your résumé"]);
    expect(s.declined[0].startsWith("You declined: ")).toBe(true);
    expect(s.failures).toEqual([toolFailureLabel("get_job")]);
    expect(s.total).toBe(2);
    expect(s.failed).toBe(1);
  });

  test("a group is running while one of its calls has no output", () => {
    const s = summarizeSteps([done("search_jobs"), tool("search_jobs", "input-available")]);
    expect(s.groups).toEqual([{ key: "search_jobs", label: toolActivityLabel("search_jobs"), count: 2, running: true }]);
  });

  test("text, reasoning and step parts are not steps", () => {
    expect(summarizeSteps([{ type: "step-start" }, text("Hi"), { type: "reasoning", text: "hm" }])).toEqual(empty);
  });
});

describe("stepsHeadline", () => {
  test("headlines", () => {
    expect(stepsHeadline({ ...empty, total: 8 }, "done")).toBe("Worked through 8 steps");
    expect(stepsHeadline({ ...empty, total: 1 }, "done")).toBe("Worked through 1 step");
    expect(stepsHeadline({ ...empty, total: 8, failed: 2 }, "done")).toBe("Worked through 8 steps, 2 did not work");
    expect(stepsHeadline({ ...empty, total: 3 }, "stopped")).toBe("Stopped after 3 steps");
    expect(stepsHeadline({ ...empty, total: 1 }, "stopped")).toBe("Stopped after 1 step");
    // A reload mid-turn: not done, not stopped, whatever the count (polish M8).
    expect(stepsHeadline({ ...empty, total: 3 }, "pending")).toBe(STEPS_PENDING_LABEL);
    expect(stepsHeadline(empty, "pending")).toBe("Still working. Reload to see the reply.");
  });
});

describe("currentStepLabel", () => {
  test("current label", () => {
    expect(currentStepLabel([])).toBe("Thinking");
    expect(currentStepLabel([tool("get_job", "input-available")])).toBe(toolProgressLabel("get_job"));
    expect(currentStepLabel([tool("present", "input-streaming")])).toBe("Building a view");
    expect(currentStepLabel([done("get_job"), text("So")])).toBe("Writing the answer");
  });

  test("the newest running call wins; finished calls and a new step read as thinking", () => {
    expect(currentStepLabel([tool("search_jobs", "input-available"), tool("get_job", "input-available")])).toBe(toolProgressLabel("get_job"));
    expect(currentStepLabel([done("get_job")])).toBe("Thinking");
    expect(currentStepLabel([done("get_job"), text("So"), { type: "step-start" }])).toBe("Thinking");
    expect(currentStepLabel([done("get_job"), text("  ")])).toBe("Thinking");
  });

  test("a call waiting for approval is not the current step", () => {
    expect(currentStepLabel([tool("set_resume", "approval-requested")])).toBe("Thinking");
  });
});

test("formatElapsed", () => {
  expect([0, 65_000, 760_000].map(formatElapsed)).toEqual(["0:00", "1:05", "12:40"]);
  expect([999, -5, Number.NaN].map(formatElapsed)).toEqual(["0:00", "0:00", "0:00"]);
});
