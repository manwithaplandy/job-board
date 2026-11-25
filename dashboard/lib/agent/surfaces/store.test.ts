import { beforeEach, describe, expect, test, vi } from "vitest";

// withUserSql is stubbed: each test queues the rows the next queries return, and every
// query's text and bound values are recorded.
const db = vi.hoisted(() => ({
  queue: [] as unknown[][],
  calls: [] as { text: string; values: unknown[] }[],
}));
const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
  db.calls.push({ text: strings.join("?"), values });
  return Promise.resolve(db.queue.shift() ?? []);
};
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
}));

import { emptyGathered } from "@/lib/agent/gathered";
import {
  failureCode,
  getSurface,
  markSurfaceFailed,
  saveSurface,
  setSurfaceFailure,
  type SaveSurfaceArgs,
} from "@/lib/agent/surfaces/store";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SURFACE = "11111111-1111-4111-8111-111111111111";
const THREAD = "22222222-2222-4222-8222-222222222222";
const created = new Date("2026-11-25T10:00:00Z");

const row = (extra: Record<string, unknown> = {}) => ({
  id: SURFACE,
  thread_id: THREAD,
  run_id: null,
  variant: "1",
  payload: { blocks: [] },
  fallback_payload: { blocks: [{ kind: "text" }] },
  gathered: { jobs: {} },
  outcome: "valid",
  failure: null,
  supersedes: null,
  rerender_of: null,
  model: "m",
  latency_ms: "1200",
  created_at: created,
  ...extra,
});

const args = (extra: Partial<SaveSurfaceArgs> = {}): SaveSurfaceArgs => ({
  threadId: THREAD,
  runId: null,
  variant: 1,
  payload: { blocks: [] },
  fallbackPayload: null,
  gathered: emptyGathered(),
  outcome: "valid",
  supersedes: null,
  rerenderOf: null,
  model: "m",
  latencyMs: 10,
  outputTokens: 5,
  ...extra,
});

beforeEach(() => {
  db.queue = [];
  db.calls = [];
});

describe("getSurface", () => {
  test("parses the envelope and the bigint columns", async () => {
    db.queue = [[row()]];
    expect(await getSurface(USER, SURFACE)).toEqual({
      id: SURFACE,
      threadId: THREAD,
      runId: null,
      variant: 1,
      payload: { blocks: [] },
      fallbackPayload: { blocks: [{ kind: "text" }] },
      gathered: { jobs: {} },
      outcome: "valid",
      failure: null,
      supersedes: null,
      rerenderOf: null,
      model: "m",
      latencyMs: 1200,
      createdAt: created.toISOString(),
    });
    expect(db.calls[0].values).toEqual([SURFACE, USER]);
  });

  test("getSurface returns null for an unknown variant or a payload that is not an object", async () => {
    for (const bad of [
      { variant: "4" },
      { variant: "x" },
      { payload: ["a"] },
      { payload: "a string" },
      { payload: null },
      { gathered: [1] },
      { fallback_payload: "x" },
      { outcome: "great" },
    ]) {
      db.queue = [[row(bad)]];
      expect(await getSurface(USER, SURFACE), JSON.stringify(bad)).toBeNull();
    }
  });

  test("an id that is not a uuid runs no query; a missing row is null", async () => {
    expect(await getSurface(USER, "nope")).toBeNull();
    expect(db.calls).toHaveLength(0);
    db.queue = [[]];
    expect(await getSurface(USER, SURFACE)).toBeNull();
  });
});

describe("markSurfaceFailed", () => {
  test("sets outcome fallback with a short code and returns the stored fallback", async () => {
    db.queue = [[], [{ fallback_payload: { blocks: [{ kind: "text" }] } }]];
    expect(await markSurfaceFailed(USER, SURFACE, "render_error")).toEqual({ blocks: [{ kind: "text" }] });
    expect(db.calls[0].text).toContain("agent_set_surface_outcome");
    expect(db.calls[0].values).toEqual([SURFACE, "render_error"]);
  });

  test("provider or stack text is never stored as the failure", async () => {
    db.queue = [[], [{ fallback_payload: null }]];
    const stack = `TypeError: x is undefined\n    at render (/var/task/app.js:1:1)${"x".repeat(500)}`;
    expect(await markSurfaceFailed(USER, SURFACE, stack)).toBeNull();
    expect(db.calls[0].values).toEqual([SURFACE, "unknown_failure"]);
    expect(failureCode("a".repeat(65))).toBe("unknown_failure");
    expect(failureCode("schema_invalid")).toBe("schema_invalid");
  });

  test("a fallback that is not an object reads as null", async () => {
    db.queue = [[], [{ fallback_payload: ["x"] }]];
    expect(await markSurfaceFailed(USER, SURFACE, "render_error")).toBeNull();
  });
});

describe("saveSurface", () => {
  test("calls the definer function with json text and clamps the model to 200 chars", async () => {
    db.queue = [[{ id: SURFACE }]];
    const model = "m".repeat(250);
    expect(await saveSurface(tx as never, args({ model, latencyMs: -3, outputTokens: 7.9 }))).toBe(SURFACE);
    const { text, values } = db.calls[0];
    expect(text).toContain("agent_save_surface");
    expect(values[3]).toBe(JSON.stringify({ blocks: [] }));
    expect(values[4]).toBeNull();
    expect(values[9]).toHaveLength(200);
    expect(values[10]).toBeNull(); // a negative latency is not stored
    expect(values[11]).toBe(7);
    // No argument carries a user id.
    expect(values).not.toContain(USER);
  });

  test("refuses a non-object payload or fallback and an unknown variant before any SQL", async () => {
    await expect(saveSurface(tx as never, args({ payload: ["x"] }))).rejects.toThrow(/payload/);
    await expect(saveSurface(tx as never, args({ fallbackPayload: "x" }))).rejects.toThrow(/fallback/);
    await expect(saveSurface(tx as never, args({ variant: 4 as never }))).rejects.toThrow(/variant/);
    expect(db.calls).toHaveLength(0);
  });
});

describe("setSurfaceFailure", () => {
  test("sets outcome fallback with a short code in the caller's transaction", async () => {
    await setSurfaceFailure(tx as never, SURFACE, "invalid_after_repair");
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain("agent_set_surface_outcome");
    expect(db.calls[0].text).toContain("'fallback'");
    expect(db.calls[0].values).toEqual([SURFACE, "invalid_after_repair"]);
  });

  test("error text is never stored as the failure; a bad id runs no query", async () => {
    await setSurfaceFailure(tx as never, SURFACE, "root.text: Too big: expected string to have <=400 characters");
    expect(db.calls[0].values).toEqual([SURFACE, "unknown_failure"]);
    await expect(setSurfaceFailure(tx as never, "nope", "x")).rejects.toThrow(/uuid/);
    expect(db.calls).toHaveLength(1);
  });
});
