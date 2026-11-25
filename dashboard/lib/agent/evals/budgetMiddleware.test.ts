// The live eval's budgeted model (gate A17) on a mock provider: a refused call never
// reaches the provider, usage is read from the finish part or the generate result, and
// a call whose usage cannot be read trips the run. Runs in CI; no network.
import { describe, expect, test } from "vitest";
import { generateText, isStepCount, simulateReadableStream, streamText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { z } from "zod";
import { CAP_DEFAULTS, CapExceededError, RunBudget, type EvalCaps } from "@/lib/agent/evals/budget";
import { budgetMiddleware, budgetedModel } from "@/lib/agent/evals/budgetMiddleware";

const usage = (input: number | undefined, output: number | undefined) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});
const billed = (cost: number) => ({ openrouter: { usage: { cost } } });

function reply(text: string, u = usage(1000, 20), meta: unknown = billed(0.001)): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: u, providerMetadata: meta as never },
  ];
}

function toolCall(id: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: id, toolName: "look", input: "{}" },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: usage(1000, 20), providerMetadata: billed(0.001) },
  ];
}

/** A mock provider that streams `steps` in order and records every call it receives. */
function mockModel(steps: LanguageModelV4StreamPart[][]) {
  const calls: LanguageModelV4CallOptions[] = [];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      calls.push(options);
      const chunks = steps[calls.length - 1] ?? reply("extra");
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
  return { model, calls };
}

const budgetWith = (over: Partial<EvalCaps> = {}) => new RunBudget({ ...CAP_DEFAULTS, ...over });

async function drain(stream: ReadableStream<unknown>): Promise<unknown[]> {
  const parts: unknown[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return parts;
    parts.push(value);
  }
}

const callOptions: LanguageModelV4CallOptions = { prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };

describe("budgetMiddleware", () => {
  test("records each call's tokens and reported cost from its finish part", async () => {
    const budget = budgetWith();
    const { model } = mockModel([reply("one", usage(1200, 30), billed(0.004)), reply("two", usage(1500, 40), billed(0.005))]);
    const wrapped = budgetedModel(model, budget);
    for (const prompt of ["a", "b"]) {
      budget.startTurn();
      const result = streamText({ model: wrapped, prompt });
      await result.consumeStream();
    }
    expect(budget.tripped).toBeNull();
    expect(budget.totals).toMatchObject({ steps: 2, inputTokens: 2700, outputTokens: 70 });
    expect(budget.totals.costUsd).toBeCloseTo(0.009, 9);
    expect(budget.usdEnforcement).toBe("enforced");
  });

  test("a refused call never reaches the provider", async () => {
    const budget = budgetWith();
    budget.trip("max_tokens", "test");
    const { model, calls } = mockModel([reply("never")]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    await expect(wrapped.doStream(callOptions)).rejects.toBeInstanceOf(CapExceededError);
    expect(calls).toEqual([]);
  });

  test("the step cap stops a tool loop before the call past it, and the run stays tripped", async () => {
    const budget = budgetWith({ maxSteps: 2 });
    const { model, calls } = mockModel([toolCall("c1"), toolCall("c2"), reply("never")]);
    const errors: unknown[] = [];
    budget.startTurn();
    const result = streamText({
      model: budgetedModel(model, budget),
      prompt: "go",
      tools: { look: tool({ inputSchema: z.object({}), execute: async () => "ok" }) },
      stopWhen: isStepCount(8),
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    await result.consumeStream();
    expect(calls).toHaveLength(2);
    expect(budget.tripped?.cap).toBe("max_steps");
    expect(errors.some((e) => e instanceof CapExceededError)).toBe(true);
  });

  test("a stream that ends without a finish part trips usage_unknown", async () => {
    const budget = budgetWith();
    const noFinish = reply("cut").filter((p) => p.type !== "finish");
    const { model } = mockModel([noFinish]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    const { stream } = await wrapped.doStream(callOptions);
    await drain(stream);
    expect(budget.tripped?.cap).toBe("usage_unknown");
  });

  test("a stream cancelled before its finish part trips usage_unknown at the end of the turn", async () => {
    const budget = budgetWith();
    const { model } = mockModel([reply("cut")]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    budget.startTurn();
    const { stream } = await wrapped.doStream(callOptions);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(() => budget.endTurn()).toThrow(CapExceededError);
    expect(budget.tripped?.cap).toBe("usage_unknown");
  });

  test("a finish part without token totals trips usage_unknown", async () => {
    const budget = budgetWith();
    const { model } = mockModel([reply("x", usage(undefined, 5))]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    await drain((await wrapped.doStream(callOptions)).stream);
    expect(budget.tripped?.cap).toBe("usage_unknown");
  });

  test("a provider error before the stream trips usage_unknown", async () => {
    const budget = budgetWith();
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("provider down");
      },
    });
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    await expect(wrapped.doStream(callOptions)).rejects.toThrow("provider down");
    expect(budget.tripped?.cap).toBe("usage_unknown");
  });

  test("without a reported cost the run goes on under the token cap alone", async () => {
    const budget = budgetWith();
    const { model } = mockModel([reply("x", usage(100, 5), { openrouter: { usage: {} } })]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    await drain((await wrapped.doStream(callOptions)).stream);
    expect(budget.tripped).toBeNull();
    expect(budget.usdEnforcement).toBe("not_enforced");
  });

  test("every call carries the budget's signal, so a trip aborts a call in flight", async () => {
    const budget = budgetWith();
    const { model, calls } = mockModel([reply("x")]);
    const wrapped = wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
    const own = new AbortController();
    const { stream } = await wrapped.doStream({ ...callOptions, abortSignal: own.signal });
    const seen = calls[0]?.abortSignal;
    expect(seen?.aborted).toBe(false);
    budget.trip("max_minutes", "test");
    expect(seen?.aborted).toBe(true);
    await drain(stream);
  });

  test("generate calls are checked and recorded too", async () => {
    const budget = budgetWith();
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "summary" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: usage(800, 50),
        providerMetadata: billed(0.002),
        warnings: [],
      }),
    });
    await generateText({ model: budgetedModel(model, budget), prompt: "sum up" });
    expect(budget.totals).toMatchObject({ steps: 1, inputTokens: 800, outputTokens: 50 });
    expect(budget.totals.costUsd).toBeCloseTo(0.002, 9);
  });

  test("a model given only by id is refused", () => {
    expect(() => budgetedModel("anthropic/claude-sonnet-5.5", budgetWith())).toThrow("model instance");
  });
});
