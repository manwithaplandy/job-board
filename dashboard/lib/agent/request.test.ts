import { describe, expect, test } from "vitest";
import { AgentRequestSchema, isViewMessageId, VIEW_MESSAGE_PREFIX, viewSourceError } from "@/lib/agent/request";

const THREAD = "11111111-1111-4111-8111-111111111111";
const SURFACE = "44444444-4444-4444-8444-444444444444";

// PR 6 Task 6.4 (spec 08 S10.4): a message sent from a view's ask.
describe("a message request from a view", () => {
  test("the schema accepts a view source and rejects an extra key in it or a bad surface id", () => {
    const base = { threadId: THREAD, kind: "message", id: "view-abc", text: "Compare the top two" };
    expect(AgentRequestSchema.safeParse({ ...base, source: { kind: "view", surfaceId: SURFACE } }).success).toBe(true);
    expect(AgentRequestSchema.safeParse(base).success).toBe(true);
    expect(AgentRequestSchema.safeParse({ ...base, source: { kind: "view", surfaceId: SURFACE, extra: 1 } }).success).toBe(false);
    expect(AgentRequestSchema.safeParse({ ...base, source: { kind: "view", surfaceId: "not-a-uuid" } }).success).toBe(false);
    expect(AgentRequestSchema.safeParse({ ...base, source: { kind: "page", surfaceId: SURFACE } }).success).toBe(false);
    expect(AgentRequestSchema.safeParse({ ...base, source: null }).success).toBe(false);
    // Only a message carries a source.
    expect(AgentRequestSchema.safeParse({ threadId: THREAD, kind: "retry", id: "view-abc", source: { kind: "view", surfaceId: SURFACE } }).success).toBe(false);
  });

  test("isViewMessageId reads the view- prefix", () => {
    expect(VIEW_MESSAGE_PREFIX).toBe("view-");
    expect(isViewMessageId("view-abc")).toBe(true);
    expect(isViewMessageId("u-abc")).toBe(false);
    expect(isViewMessageId("viewabc")).toBe(false);
    expect(isViewMessageId("xview-abc")).toBe(false);
  });

  test("viewSourceError returns each code, and null for a typed message and a correct view message", () => {
    const source = { kind: "view", surfaceId: SURFACE };
    expect(viewSourceError({ id: "view-abc", text: "Compare" })).toBe("view_id_without_source");
    expect(viewSourceError({ id: "u-abc", text: "Compare", source })).toBe("source_without_view_id");
    expect(viewSourceError({ id: "view-abc", text: "x".repeat(281), source })).toBe("view_text_too_long");
    expect(viewSourceError({ id: "u-abc", text: "x".repeat(281) })).toBeNull();
    expect(viewSourceError({ id: "view-abc", text: "x".repeat(280), source })).toBeNull();
    // Code points, not UTF-16 units: 280 emoji are 560 units and still fit.
    expect(viewSourceError({ id: "view-abc", text: "\u{1F600}".repeat(280), source })).toBeNull();
    expect(viewSourceError({ id: "view-abc", text: "\u{1F600}".repeat(281), source })).toBe("view_text_too_long");
    // Polish wave, M4: a view message's text must be exactly what normalizeAskText makes of it.
    for (const text of [" Compare", "Compare ", "Compare  the two", "Compare\nthe two", "Com\u200Bpare", "Compare\u202E", "Cafe\u0301", "Compare\u0007", "\u00AD"]) {
      expect({ text, error: viewSourceError({ id: "view-abc", text, source }) }).toEqual({ text, error: "view_text_not_normalized" });
    }
    expect(viewSourceError({ id: "view-abc", text: "Caf\u00E9 near me", source })).toBeNull();
    // A typed message keeps its text as typed: the check is for view messages only.
    expect(viewSourceError({ id: "u-abc", text: "Compare\n\nthe two " })).toBeNull();
  });
});
