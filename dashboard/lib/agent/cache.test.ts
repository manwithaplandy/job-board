// Prompt caching (PR J7, lib/agent/cache.ts): where the breakpoints go and the jsonb key
// order of tool results. Pure. The wire-level tests (the real OpenRouter provider) are in
// loop.test.ts, "prompt caching on the wire".
import { describe, expect, test } from "vitest";
import type { LanguageModelV4Prompt, SharedV4ProviderOptions } from "@ai-sdk/provider";
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
    // Fix round 1: counted as the provider sends them, that prompt carries 5 (system 1,
    // user 1, assistant 1, and the tool message's own option once per tool result: 2), so
    // the middleware sends it as it came, without adding any.
    expect(countCacheBreakpoints(params.prompt)).toBe(5);
    expect(countCacheBreakpoints(params.prompt)).toBeGreaterThan(MAX_CACHE_BREAKPOINTS);
    expect(params.prompt).toBe(p);
  });

  test("a call-level breakpoint counts too, so the middleware leaves room for it", async () => {
    const mw = cacheBreakpointMiddleware({ tail: true });
    const p = prompt();
    p[1].providerOptions = { ...BP };
    p[2].providerOptions = { ...BP };
    // System + tail + 2 already there = 4: fits on its own, but not with a call-level one.
    const fits = await mw.transformParams!({ type: "stream", params: { prompt: p } as never, model: {} as never });
    expect(countCacheBreakpoints(fits.prompt)).toBe(4);
    const call = { openrouter: { cacheControl: { type: "ephemeral" } } };
    const over = await mw.transformParams!({ type: "stream", params: { prompt: p, providerOptions: call } as never, model: {} as never });
    expect(over.prompt).toBe(p);
    expect(countCacheBreakpoints(p, call)).toBe(3);
  });
});

describe("countCacheBreakpoints counts as the provider sends (fix round 1)", () => {
  const cc = { type: "ephemeral" };

  test("every alias spelling counts; a null value does not", () => {
    const spellings: SharedV4ProviderOptions[] = [
      { openrouter: { cacheControl: cc } },
      { openrouter: { cache_control: cc } },
      { anthropic: { cacheControl: cc } },
      { anthropic: { cache_control: cc } },
    ];
    for (const providerOptions of spellings) {
      expect(countCacheBreakpoints([{ role: "system", content: "rules", providerOptions }]), JSON.stringify(providerOptions)).toBe(1);
    }
    expect(countCacheBreakpoints([{ role: "system", content: "rules", providerOptions: { openrouter: { cacheControl: null } } }])).toBe(0);
    // A null first spelling falls through to the next, as getCacheControl does.
    expect(countCacheBreakpoints([{ role: "system", content: "rules", providerOptions: { openrouter: { cacheControl: null }, anthropic: { cache_control: cc } } }])).toBe(1);
  });

  test("a tool message's own option counts once per tool result; approval responses never", () => {
    const p = prompt();
    p[3].providerOptions = { anthropic: { cacheControl: cc } };
    expect(countCacheBreakpoints([p[3]])).toBe(2);
    // A result's own option and the message's on the same result count once.
    const tool = p[3];
    if (tool.role !== "tool") throw new Error("expected a tool message");
    tool.content[0] = { ...tool.content[0], providerOptions: { openrouter: { cacheControl: cc } } } as (typeof tool.content)[0];
    expect(countCacheBreakpoints([tool])).toBe(2);
  });

  test("a user message's own option lands on its last text part unless that part has its own", () => {
    const two: LanguageModelV4Prompt = [
      {
        role: "user",
        providerOptions: { openrouter: { cacheControl: cc } },
        content: [
          { type: "text", text: "a", providerOptions: { openrouter: { cacheControl: cc } } },
          { type: "text", text: "b" },
        ],
      },
    ];
    expect(countCacheBreakpoints(two)).toBe(2);
    const own: LanguageModelV4Prompt = [
      {
        role: "user",
        providerOptions: { openrouter: { cacheControl: cc } },
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b", providerOptions: { openrouter: { cacheControl: cc } } },
        ],
      },
    ];
    expect(countCacheBreakpoints(own)).toBe(1);
    // One text part: the message's and the part's own option are one block.
    expect(countCacheBreakpoints([{ role: "user", providerOptions: { ...BP }, content: [{ type: "text", text: "a", providerOptions: { ...BP } }] }])).toBe(1);
  });
});

describe("countCacheBreakpoints against the real provider's request body (fix round 1)", () => {
  // The pinned @openrouter/ai-sdk-provider over a fetch that records the body: no network, no key.
  async function sentBreakpoints(p: LanguageModelV4Prompt, providerOptions?: Record<string, Record<string, unknown>>): Promise<number> {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    let body: Record<string, unknown> | null = null;
    const fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
    }) as typeof globalThis.fetch;
    const model = createOpenRouter({ apiKey: "test-key", compatibility: "strict", fetch }).chat("anthropic/claude-haiku-5.5");
    const { stream } = await model.doStream({ prompt: p, providerOptions: providerOptions as never });
    await stream.cancel();
    const sent = body as unknown as { cache_control?: unknown; messages: Array<Record<string, unknown>> };
    let n = sent.cache_control != null ? 1 : 0;
    for (const m of sent.messages) {
      if (m.cache_control != null) n += 1;
      if (Array.isArray(m.content)) for (const part of m.content as Array<Record<string, unknown>>) if (part.cache_control != null) n += 1;
    }
    return n;
  }

  test("the count matches what the provider sends, aliases, tool messages and a call-level option included", async () => {
    const cc = { type: "ephemeral" };
    const allMarked = prompt();
    for (const m of allMarked) m.providerOptions = { ...BP };
    const aliased = prompt();
    aliased[0].providerOptions = { anthropic: { cache_control: cc } };
    aliased[3].providerOptions = { openrouter: { cache_control: cc } };
    const cases: Array<[LanguageModelV4Prompt, Record<string, Record<string, unknown>> | undefined]> = [
      [prompt(), undefined],
      [withCacheBreakpoints(prompt(), { tail: true }), undefined],
      [withCacheBreakpoints(prompt(), { tail: false }), undefined],
      [allMarked, undefined],
      [aliased, undefined],
      [withCacheBreakpoints(prompt(), { tail: true }), { openrouter: { cacheControl: cc } }],
      [
        [
          {
            role: "user",
            providerOptions: { ...BP },
            content: [
              { type: "text", text: "a", providerOptions: { ...BP } },
              { type: "text", text: "b" },
            ],
          },
        ],
        undefined,
      ],
    ];
    for (const [p, call] of cases) {
      expect(countCacheBreakpoints(p, call as never), JSON.stringify(p).slice(0, 120)).toBe(await sentBreakpoints(p, call));
    }
    expect(await sentBreakpoints(allMarked)).toBe(5);
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

  test("a __proto__ key is kept as a key, in jsonb order, and sets no prototype (fix round 1)", () => {
    const value = JSON.parse('{"zz":1,"__proto__":{"polluted":true},"a":2}') as unknown;
    const out = canonicalJson(value) as Record<string, unknown>;
    expect(JSON.stringify(out)).toBe('{"a":2,"zz":1,"__proto__":{"polluted":true}}');
    expect(Object.hasOwn(out, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect((out as { polluted?: unknown }).polluted).toBeUndefined();
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test("a value JSON cannot represent comes back unchanged", () => {
    const big = { n: BigInt(1) };
    expect(canonicalJson(big)).toBe(big);
  });
});
