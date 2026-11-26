// Prompt caching (PR J7, lib/agent/cache.ts): where the breakpoints go and the jsonb key
// order of tool results. Pure. The wire-level tests (the real OpenRouter provider) are in
// loop.test.ts, "prompt caching on the wire".
import { describe, expect, test } from "vitest";
import type { LanguageModelV4Prompt } from "@ai-sdk/provider";
import {
  CACHE_BREAKPOINT,
  MAX_CACHE_BREAKPOINTS,
  cacheBreakpointMiddleware,
  canonicalJson,
  countCacheBreakpoints,
  jsonbKeyOrder,
  withCacheBreakpoints,
} from "@/lib/agent/cache";

const BP = CACHE_BREAKPOINT;

function prompt(): LanguageModelV4Prompt {
  return [
    { role: "system", content: "rules" },
    { role: "user", content: [{ type: "text", text: "hi" }] },
    { role: "assistant", content: [{ type: "tool-call", toolCallId: "c1", toolName: "a", input: {} }, { type: "tool-call", toolCallId: "c2", toolName: "b", input: {} }] },
    {
      role: "tool",
      content: [
        { type: "tool-result", toolCallId: "c1", toolName: "a", output: { type: "json", value: { zeta: 1, ab: { yy: 2, b: 3 } } } },
        { type: "tool-result", toolCallId: "c2", toolName: "b", output: { type: "text", value: "plain" } },
        { type: "tool-approval-response", approvalId: "x", approved: true },
      ],
    },
  ];
}

describe("withCacheBreakpoints", () => {
  test("marks the system message and the last tool result, nothing else", () => {
    const out = withCacheBreakpoints(prompt(), { tail: true });
    expect(out[0].providerOptions).toEqual(BP);
    const tool = out[3];
    if (tool.role !== "tool") throw new Error("expected a tool message");
    // The approval response is not a content block: the last tool result carries it.
    expect(tool.content.map((p) => p.providerOptions ?? null)).toEqual([null, BP, null]);
    // Never on the tool message itself: the provider would copy it onto every result.
    expect(tool.providerOptions).toBeUndefined();
    expect(countCacheBreakpoints(out)).toBe(2);
  });

  test("without tail only the system message is marked", () => {
    const out = withCacheBreakpoints(prompt(), { tail: false });
    expect(countCacheBreakpoints(out)).toBe(1);
    expect(out[0].providerOptions).toEqual(BP);
  });

  test("a call ending with a user message marks that message's last part", () => {
    const p: LanguageModelV4Prompt = [
      { role: "system", content: "rules" },
      { role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] },
    ];
    const out = withCacheBreakpoints(p, { tail: true });
    const user = out[1];
    if (user.role !== "user") throw new Error("expected a user message");
    expect(user.content.map((part) => part.providerOptions ?? null)).toEqual([null, BP]);
  });

  test("an assistant message last is passed over for the user or tool message before it", () => {
    const p: LanguageModelV4Prompt = [
      { role: "system", content: "rules" },
      { role: "user", content: [{ type: "text", text: "a" }] },
      { role: "assistant", content: [{ type: "text", text: "b" }] },
    ];
    const out = withCacheBreakpoints(p, { tail: true });
    expect(out[2]).toEqual(p[2]);
    const user = out[1];
    if (user.role !== "user") throw new Error("expected a user message");
    expect(user.content[0].providerOptions).toEqual(BP);
  });

  test("never mutates the prompt it is given, and keeps other provider options", () => {
    const p = prompt();
    p[0].providerOptions = { openrouter: { other: true }, anthropic: { x: 1 } };
    const before = JSON.stringify(p);
    const out = withCacheBreakpoints(p, { tail: true });
    expect(JSON.stringify(p)).toBe(before);
    expect(out[0].providerOptions).toEqual({ openrouter: { other: true, ...BP.openrouter }, anthropic: { x: 1 } });
  });

  test("JSON tool results are written in jsonb key order; text results are left alone", () => {
    const out = withCacheBreakpoints(prompt(), { tail: false });
    const tool = out[3];
    if (tool.role !== "tool") throw new Error("expected a tool message");
    const [json, text] = tool.content;
    if (json.type !== "tool-result" || text.type !== "tool-result") throw new Error("expected tool results");
    expect(JSON.stringify(json.output)).toBe('{"type":"json","value":{"ab":{"b":3,"yy":2},"zeta":1}}');
    expect(text.output).toEqual({ type: "text", value: "plain" });
  });

  test("the middleware never sends more breakpoints than Anthropic takes", async () => {
    // A prompt that already carries breakpoints of its own (nothing in the app does this).
    const p = prompt();
    for (const m of p) m.providerOptions = { ...BP };
    const mw = cacheBreakpointMiddleware({ tail: true });
    const params = await mw.transformParams!({ type: "stream", params: { prompt: p } as never, model: {} as never });
    expect(countCacheBreakpoints(params.prompt)).toBe(MAX_CACHE_BREAKPOINTS);
    expect(params.prompt).toBe(p);
  });
});

describe("jsonb key order", () => {
  test("shorter keys first, then bytewise, as Postgres stores jsonb objects", () => {
    expect(["bb", "a", "ab", "B", "ccc", "é"].sort(jsonbKeyOrder)).toEqual(["B", "a", "ab", "bb", "é", "ccc"]);
  });

  test("canonicalJson is what JSON.stringify sends, reordered: toJSON applied, undefined dropped", () => {
    const value = { when: new Date("2026-11-26T00:00:00.000Z"), gone: undefined, list: [{ b: 1, a: 2 }], n: Number.NaN };
    expect(JSON.stringify(canonicalJson(value))).toBe('{"n":null,"list":[{"a":2,"b":1}],"when":"2026-11-26T00:00:00.000Z"}');
    expect(canonicalJson("text")).toBe("text");
    expect(canonicalJson(undefined)).toBeUndefined();
  });

  test("a value JSON cannot represent comes back unchanged", () => {
    const big = { n: BigInt(1) };
    expect(canonicalJson(big)).toBe(big);
  });
});
