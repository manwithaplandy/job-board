import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HostToFrameSchema, isFrameFailure, parseFrameMessage, type FrameAction } from "@/lib/agent/surfaces/v3/bridge";
import { frameIntent } from "@/lib/agent/actions/describe";
import { JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";

function action(raw: unknown): FrameAction {
  const m = parseFrameMessage(raw);
  if (m === null || m.type !== "action") throw new Error("not an action");
  return m;
}

/** What the server makes of an action message the host accepted. */
function intentOf(raw: unknown) {
  const m = action(raw);
  return frameIntent(m.name, m.args);
}

describe("parseFrameMessage", () => {
  test("accepts the eight kinds", () => {
    expect(parseFrameMessage({ type: "navigating" })).toEqual({ type: "navigating" });
    expect(parseFrameMessage({ type: "escape" })).toEqual({ type: "escape" });
    expect(parseFrameMessage({ type: "ready" })).toEqual({ type: "ready" });
    expect(parseFrameMessage({ type: "inited" })).toEqual({ type: "inited" });
    expect(parseFrameMessage({ type: "pong", n: 3 })).toEqual({ type: "pong", n: 3 });
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
      { type: "escape", x: 1 },
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
      { type: "inited", n: 1 },
      { type: "pong" },
      { type: "pong", n: -1 },
      { type: "pong", n: 1.5 },
      { type: "pong", n: "1" },
      { type: "pong", n: 1, extra: 1 },
      { type: "ping", n: 1 },
      { type: "navigating", url: "x" },
      { type: "navigating", via: "beforeunload" },
    ];
    for (const raw of bad) expect(parseFrameMessage(raw)).toBeNull();

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(parseFrameMessage({ type: "action", name: "open", args: cyclic })).toBeNull();
  });
});

describe("frameIntent", () => {
  test("an action message is not trusted: its args still go through ActionIntentSchema", () => {
    expect(intentOf(({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } }))).toEqual({
      name: "shortlist.set",
      jobId: JOB_A,
      state: "shortlisted",
    });
    expect(intentOf(({ type: "action", name: "compare", args: { jobIds: [JOB_A, JOB_B] } }))).toEqual({
      name: "compare",
      jobIds: [JOB_A, JOB_B],
    });
    // An unknown intent, an extra key, a bad enum value, a malformed job id.
    expect(intentOf(({ type: "action", name: "delete.everything", args: {} }))).toBeNull();
    expect(intentOf(({ type: "action", name: "open", args: { target: "shortlist", url: "x" } }))).toBeNull();
    expect(intentOf(({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "deleted" } }))).toBeNull();
    expect(intentOf(({ type: "action", name: "application.prepare", args: { jobId: "not a job" } }))).toBeNull();
    // args that are not a plain object.
    expect(intentOf(({ type: "action", name: "open", args: null }))).toBeNull();
    expect(intentOf(({ type: "action", name: "open", args: ["shortlist"] }))).toBeNull();
    expect(intentOf(({ type: "action", name: "open", args: "shortlist" }))).toBeNull();
  });

  test("the message's name wins over a name inside args", () => {
    expect(intentOf(({ type: "action", name: "open", args: { name: "memo.resolve", target: "shortlist" } }))).toEqual({
      name: "open",
      target: "shortlist",
    });
  });
});

describe("client safety", () => {
  test("bridge, document, kit and mount import nothing a browser bundle cannot hold", () => {
    const allowed = ["zod", "@/lib/agent/surfaces/v3/sha256", "@/lib/agent/surfaces/v3/kitTokens", "@/lib/agent/surfaces/v3/document"];
    for (const file of ["bridge.ts", "document.ts", "kit.ts", "kitTokens.ts", "sha256.ts", "mount.ts"]) {
      const source = readFileSync(join(__dirname, file), "utf8");
      const imports = [...source.matchAll(/^import (type )?[^;]*from "([^"]+)";/gm)].filter((m) => !m[1]).map((m) => m[2]);
      for (const spec of imports) {
        expect({ file, spec, ok: allowed.includes(spec) }).toEqual({ file, spec, ok: true });
      }
    }
  });

  test("failure codes are a closed list", () => {
    expect(isFrameFailure("no_handshake")).toBe(true);
    expect(isFrameFailure("self_navigation")).toBe(true);
    expect(isFrameFailure("anything_else")).toBe(false);
    expect(isFrameFailure(1)).toBe(false);
  });
});

describe("HostToFrameSchema", () => {
  test("is a strict init with a light or dark theme", () => {
    expect(HostToFrameSchema.safeParse({ type: "init", data: { jobs: {} }, theme: "dark" }).success).toBe(true);
    expect(HostToFrameSchema.safeParse({ type: "init", data: {}, theme: "blue" }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "init", data: {}, theme: "light", extra: 1 }).success).toBe(false);
  });

  test("or a strict ping with a whole number", () => {
    expect(HostToFrameSchema.safeParse({ type: "ping", n: 1 }).success).toBe(true);
    expect(HostToFrameSchema.safeParse({ type: "ping", n: 1.5 }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "ping" }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "ping", n: 1, extra: 1 }).success).toBe(false);
    // Task 2.8 (review M8): a theme change after init, light or dark only, strict.
    expect(HostToFrameSchema.safeParse({ type: "theme", theme: "dark" }).success).toBe(true);
    expect(HostToFrameSchema.safeParse({ type: "theme", theme: "light" }).success).toBe(true);
    expect(HostToFrameSchema.safeParse({ type: "theme", theme: "blue" }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "theme" }).success).toBe(false);
    expect(HostToFrameSchema.safeParse({ type: "theme", theme: "dark", data: {} }).success).toBe(false);
  });
});
