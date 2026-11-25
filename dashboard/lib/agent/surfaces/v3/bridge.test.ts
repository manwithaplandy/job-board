import { describe, expect, test } from "vitest";
import { frameIntent, HostToFrameSchema, parseFrameMessage, type FrameAction } from "@/lib/agent/surfaces/v3/bridge";
import { JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";

function action(raw: unknown): FrameAction {
  const m = parseFrameMessage(raw);
  if (m === null || m.type !== "action") throw new Error("not an action");
  return m;
}

describe("parseFrameMessage", () => {
  test("accepts the four kinds", () => {
    expect(parseFrameMessage({ type: "ready" })).toEqual({ type: "ready" });
    expect(parseFrameMessage({ type: "resize", height: 300 })).toEqual({ type: "resize", height: 300 });
    expect(parseFrameMessage({ type: "action", name: "open", args: { target: "shortlist" } })).toEqual({
      type: "action",
      name: "open",
      args: { target: "shortlist" },
    });
    expect(parseFrameMessage({ type: "error", message: "boom" })).toEqual({ type: "error", message: "boom" });
  });

  test("parseFrameMessage rejects unknown types, extra keys and oversized fields", () => {
    const bad: unknown[] = [
      null,
      "ready",
      42,
      [],
      {},
      { type: "init", data: {}, theme: "light" },
      { type: "navigate", url: "x" },
      { type: "ready", extra: 1 },
      { type: "resize", height: 300, width: 10 },
      { type: "resize", height: 20_001 },
      { type: "resize", height: -1 },
      { type: "resize", height: Number.NaN },
      { type: "resize", height: Number.POSITIVE_INFINITY },
      { type: "resize", height: "300" },
      { type: "action", name: "", args: {} },
      { type: "action", name: "x".repeat(65), args: {} },
      { type: "action", name: "open", args: { s: "x".repeat(4_001) } },
      { type: "action", name: "open", args: 1n },
      { type: "action", name: "open" },
      { type: "action", name: "open", args: {}, label: "Shortlist" },
      { type: "error", message: "x".repeat(501) },
      { type: "error" },
    ];
    for (const raw of bad) expect(parseFrameMessage(raw)).toBeNull();

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(parseFrameMessage({ type: "action", name: "open", args: cyclic })).toBeNull();
  });
});

describe("frameIntent", () => {
  test("an action message is not trusted: its args still go through ActionIntentSchema", () => {
    expect(frameIntent(action({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } }))).toEqual({
      name: "shortlist.set",
      jobId: JOB_A,
      state: "shortlisted",
    });
    expect(frameIntent(action({ type: "action", name: "compare", args: { jobIds: [JOB_A, JOB_B] } }))).toEqual({
      name: "compare",
      jobIds: [JOB_A, JOB_B],
    });
    // An unknown intent, an extra key, a bad enum value, a malformed job id.
    expect(frameIntent(action({ type: "action", name: "delete.everything", args: {} }))).toBeNull();
    expect(frameIntent(action({ type: "action", name: "open", args: { target: "shortlist", url: "x" } }))).toBeNull();
    expect(frameIntent(action({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "deleted" } }))).toBeNull();
    expect(frameIntent(action({ type: "action", name: "application.prepare", args: { jobId: "not a job" } }))).toBeNull();
    // args that are not a plain object.
    expect(frameIntent(action({ type: "action", name: "open", args: null }))).toBeNull();
    expect(frameIntent(action({ type: "action", name: "open", args: ["shortlist"] }))).toBeNull();
    expect(frameIntent(action({ type: "action", name: "open", args: "shortlist" }))).toBeNull();
  });

  test("the message's name wins over a name inside args", () => {
    expect(frameIntent(action({ type: "action", name: "open", args: { name: "memo.resolve", target: "shortlist" } }))).toEqual({
      name: "open",
      target: "shortlist",
    });
  });
});

describe("HostToFrameSchema", () => {
  test("is a strict init with a light or dark theme", () => {
    expect(HostToFrameSchema.safeParse({ type: "init", data: { jobs: {} }, theme: "dark" }).success).toBe(true);
    expect(HostToFrameSchema.safeParse({ type: "init", data: {}, theme: "blue" }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "init", data: {}, theme: "light", extra: 1 }).success).toBe(false);
  });
});
