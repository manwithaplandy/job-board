// The live eval's model, wrapped so every call is checked against the run's caps (gate
// A17, lib/agent/evals/budget.ts). Before a call: RunBudget.beforeStep refuses it once a
// cap would be or has been passed, and the call never reaches the provider. After it:
// the usage from its finish part (stream) or result (generate) is recorded, and a call
// whose usage cannot be read (an error before or during the call, a stream that ends
// without a finish part) trips the run as usage_unknown instead of counting as zero.
// Every call also carries the budget's abort signal, so a trip (the wall clock) stops a
// call in flight.
//
// PR J7 fix round 1: before a call, its worst-case list price (prices.ts
// worstCaseCallMicros: the prompt's serialized size as an upper bound on its input tokens,
// at the dearest tier that could apply, written to the cache, plus its whole output limit)
// is the dollar reserve beforeStep holds it to, so a run never starts a call that could
// take it past its dollar cap.
//
// The harness (harness.ts) is its one user; the route never sees it.
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { readStepUsage, type RunBudget } from "@/lib/agent/evals/budget";
import { inputTokenBound, worstCaseCallMicros } from "@/lib/agent/prices";

/** The worst-case dollars of one call of `modelId` with these params (Infinity when the prompt cannot be bounded). */
export function callWorstCaseUsd(modelId: string, params: { prompt: unknown; tools?: unknown; maxOutputTokens?: number }): number {
  return worstCaseCallMicros(modelId, { inputTokensBound: inputTokenBound(params.prompt, params.tools), maxOutputTokens: params.maxOutputTokens }) / 1_000_000;
}

export function budgetMiddleware(budget: RunBudget): LanguageModelMiddleware {
  const before = (modelId: string, params: { prompt: unknown; tools?: unknown; maxOutputTokens?: number }) =>
    budget.beforeStep({ maxOutputTokens: params.maxOutputTokens, worstCaseUsd: callWorstCaseUsd(modelId, params) });
  return {
    // The call's own signal and the budget's: whichever aborts first stops the call.
    transformParams: async ({ params }) => ({
      ...params,
      abortSignal: params.abortSignal ? AbortSignal.any([params.abortSignal, budget.signal]) : budget.signal,
    }),
    wrapGenerate: async ({ doGenerate, params, model }) => {
      before(model.modelId, params);
      let result: Awaited<ReturnType<typeof doGenerate>>;
      try {
        result = await doGenerate();
      } catch (error) {
        budget.recordStep(null);
        throw error;
      }
      budget.recordStep(readStepUsage(result.usage, result.providerMetadata));
      return result;
    },
    wrapStream: async ({ doStream, params, model }) => {
      before(model.modelId, params);
      let result: Awaited<ReturnType<typeof doStream>>;
      try {
        result = await doStream();
      } catch (error) {
        budget.recordStep(null);
        throw error;
      }
      let settled = false;
      const settle = (usage: ReturnType<typeof readStepUsage>) => {
        if (settled) return;
        settled = true;
        budget.recordStep(usage);
      };
      type Part = Awaited<ReturnType<typeof doStream>>["stream"] extends ReadableStream<infer P> ? P : never;
      const stream = result.stream.pipeThrough(
        new TransformStream<Part, Part>({
          transform(part, controller) {
            if (part.type === "finish") settle(readStepUsage(part.usage, part.providerMetadata));
            controller.enqueue(part);
          },
          // Ended without a finish part: the usage is unknown. A stream cancelled or
          // errored before its finish part never settles; RunBudget then counts the call
          // as in flight, and the next beforeStep or endTurn trips usage_unknown.
          flush() {
            settle(null);
          },
        }),
      );
      return { ...result, stream };
    },
  };
}

/** `model` with every call checked against `budget`. A model given only by id is refused. */
export function budgetedModel(model: LanguageModel, budget: RunBudget): LanguageModel {
  if (typeof model === "string") throw new Error("eval: the budgeted model needs a model instance, not an id");
  return wrapLanguageModel({ model, middleware: budgetMiddleware(budget) });
}
