// One call's worst case at list price (PR J7 fix round 1): the bound on a prompt's input
// tokens and the price the eval budget reserves before each call. Pure; runs in CI.
import { describe, expect, test } from "vitest";
import {
  HAIKU_SHORT_PROMPT_MAX_TOKENS,
  MODEL_MAX_OUTPUT_TOKENS,
  PROMPT_TOKEN_OVERHEAD,
  callCostMicros,
  inputTokenBound,
  worstCaseCallMicros,
} from "@/lib/agent/prices";

const HAIKU = "anthropic/claude-haiku-5.5";
const SONNET = "anthropic/claude-sonnet-5.5";

describe("inputTokenBound", () => {
  const prompt = [{ role: "user", content: [{ type: "text", text: "hi" }] }];

  test("is the UTF-8 size of the prompt's and tools' JSON plus the fixed overhead", () => {
    expect(inputTokenBound(prompt)).toBe(JSON.stringify([prompt, null]).length + PROMPT_TOKEN_OVERHEAD);
    const tools = [{ type: "function", name: "look", inputSchema: { type: "object" } }];
    expect(inputTokenBound(prompt, tools)).toBe(JSON.stringify([prompt, tools]).length + PROMPT_TOKEN_OVERHEAD);
    // Two bytes for each "é": bytes, not characters.
    const accented = [{ role: "user", content: [{ type: "text", text: "éé" }] }];
    expect(inputTokenBound(accented)).toBe(JSON.stringify([accented, null]).length + 2 + PROMPT_TOKEN_OVERHEAD);
  });

  test("counts raw bytes as their base64 length", () => {
    const bytes = [{ role: "user", content: [{ type: "file", mediaType: "image/png", data: { type: "data", data: new Uint8Array(30) } }] }];
    const empty = [{ role: "user", content: [{ type: "file", mediaType: "image/png", data: { type: "data", data: "" } }] }];
    expect(inputTokenBound(bytes)).toBe(inputTokenBound(empty) + 40);
  });

  test("is Infinity for a file it cannot size (a URL or a provider reference) or a prompt that does not serialize", () => {
    const url = [{ role: "user", content: [{ type: "file", mediaType: "application/pdf", data: { type: "url", url: new URL("https://example.com/a.pdf") } }] }];
    const ref = [{ role: "user", content: [{ type: "file", mediaType: "application/pdf", data: { type: "reference", reference: { openrouter: "file-1" } } }] }];
    expect(inputTokenBound(url)).toBe(Number.POSITIVE_INFINITY);
    expect(inputTokenBound(ref)).toBe(Number.POSITIVE_INFINITY);
    expect(inputTokenBound([{ role: "user", content: [{ type: "text", text: "x", extra: 1n }] }])).toBe(Number.POSITIVE_INFINITY);
    expect(inputTokenBound(undefined)).toBe(JSON.stringify([null, null]).length + PROMPT_TOKEN_OVERHEAD);
  });
});

describe("worstCaseCallMicros", () => {
  test("prices every input token as a cache write at the dearest tier that could apply, plus the whole output limit", () => {
    // Haiku 5.5 at a bound of exactly 100K: only the short tier applies.
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: HAIKU_SHORT_PROMPT_MAX_TOKENS, maxOutputTokens: 4_000 })).toBe(14_500);
    // One token more and the long tier could apply: its prices for every token.
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: 100_001, maxOutputTokens: 4_000 })).toBeCloseTo(72_500.625, 6);
    expect(worstCaseCallMicros(SONNET, { inputTokensBound: 10_000, maxOutputTokens: 1_000 })).toBe(35_000);
  });

  test("a call that names no output limit is bounded by the models' 128K maximum", () => {
    expect(MODEL_MAX_OUTPUT_TOKENS).toBe(128_000);
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: 1_000 })).toBe(64_125);
  });

  test("an unknown model takes the default (dearest) prices; an unbounded or malformed input is Infinity", () => {
    expect(worstCaseCallMicros("x/unknown", { inputTokensBound: 10_000, maxOutputTokens: 1_000 })).toBe(35_000);
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: Number.POSITIVE_INFINITY, maxOutputTokens: 1 })).toBe(Number.POSITIVE_INFINITY);
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: Number.NaN, maxOutputTokens: 1 })).toBe(Number.POSITIVE_INFINITY);
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: -1, maxOutputTokens: 1 })).toBe(Number.POSITIVE_INFINITY);
    expect(worstCaseCallMicros(HAIKU, { inputTokensBound: 1, maxOutputTokens: -1 })).toBe(Number.POSITIVE_INFINITY);
  });

  test("is never below what any call within its bounds costs at list price", () => {
    for (const model of [HAIKU, SONNET]) {
      for (const bound of [1_000, 99_999, 100_000, 100_001, 400_000]) {
        const worst = worstCaseCallMicros(model, { inputTokensBound: bound, maxOutputTokens: 4_000 });
        for (const input of [0, Math.floor(bound / 2), bound]) {
          for (const split of [
            {},
            { cacheWriteTokens: input },
            { cacheReadTokens: input },
            { cacheReadTokens: Math.floor(input / 2), cacheWriteTokens: Math.floor(input / 3) },
          ]) {
            for (const discountReads of [true, false]) {
              const actual = callCostMicros({ inputTokens: input, outputTokens: 4_000, ...split }, model, { discountReads });
              expect(actual, `${model} ${bound} ${input} ${JSON.stringify(split)}`).toBeLessThanOrEqual(worst + 1e-6);
            }
          }
        }
      }
    }
  });
});
