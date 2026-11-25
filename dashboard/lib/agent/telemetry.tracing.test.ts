// Agent tracing (plan Task 0.12), end to end inside the process: a real
// NodeTracerProvider with the repo's LangfuseSpanProcessor, exporting to an in-memory
// exporter instead of Langfuse. The model is a MockLanguageModelV4 (no network). The
// read tools are real; only their data sources are stubbed, and the profile row carries
// EEO columns so the test can prove none of them reaches a span.
import { afterAll, describe, expect, test, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { InMemorySpanExporter, NodeTracerProvider, type ReadableSpan } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const h = vi.hoisted(() => ({
  enabled: false,
  startCalls: 0,
  start: null as null | (() => Promise<void>),
  flushes: 0,
  afterTasks: [] as Promise<unknown>[],
}));

vi.mock("@/lib/observability", () => ({
  tracingEnabled: () => h.enabled,
  ensureTracingStarted: async () => {
    h.startCalls += 1;
    await h.start?.();
  },
  flushLangfuseTraces: async () => {
    h.flushes += 1;
  },
}));
vi.mock("next/server", () => ({
  after: (task: Promise<unknown> | (() => unknown)) => {
    h.afterTasks.push(typeof task === "function" ? Promise.resolve().then(task) : task);
  },
}));
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), serviceSql: vi.fn() }));
vi.mock("@/lib/agent/threads", () => ({ loadMessages: vi.fn(async () => []) }));
vi.mock("@/lib/agent/runs", () => ({
  TurnInProgressError: class extends Error {},
  startRun: vi.fn(async () => "11111111-1111-4111-8111-111111111111"),
  chargeStep: vi.fn(async () => ({ ok: true })),
  finishRun: vi.fn(async () => {}),
  saveMessages: vi.fn(async () => {}),
}));
vi.mock("@/lib/catalogClock", () => ({
  catalogNow: vi.fn(async () => ({ now: new Date("2026-11-25T00:00:00Z"), frozen: false })),
  ageDays: () => 0,
}));
vi.mock("@/lib/queries", () => ({
  getJobReviewDetail: vi.fn(),
  getProfile: vi.fn(async () => ({
    full_name: "Pat Example",
    resume_text: "Pat Example\nExperience\n2020 - 2024\nAcme\nEngineer",
    preferred_locations: ["Remote"],
    work_authorized: true,
    needs_sponsorship: false,
    eeo_gender: "eeo-gender-value",
    eeo_race: "eeo-race-value",
    eeo_veteran: "eeo-veteran-value",
    eeo_disability: "eeo-disability-value",
  })),
}));

import { finishRun } from "@/lib/agent/runs";
import type { AgentThread } from "@/lib/agent/threads";
import { streamAgentTurn } from "@/lib/agent/loop";

const exporter = new InMemorySpanExporter();
let provider: NodeTracerProvider | null = null;
h.start = async () => {
  if (provider) return;
  provider = new NodeTracerProvider({
    spanProcessors: [
      new LangfuseSpanProcessor({
        exporter,
        exportMode: "immediate",
        publicKey: "pk-test",
        secretKey: "sk-test",
        baseUrl: "http://127.0.0.1:1",
      }),
    ],
  });
  provider.register();
};

afterAll(async () => {
  await provider?.shutdown();
});

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODEL_ID = "anthropic/claude-sonnet-5.5";
const thread: AgentThread = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "New conversation",
  variant: 2,
  summary: null,
  createdAt: "2026-11-25T00:00:00.000Z",
  updatedAt: "2026-11-25T00:00:00.000Z",
};

const usage = {
  inputTokens: { total: 31, noCache: 31, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 7, text: 7, reasoning: undefined },
};

function model() {
  const steps: LanguageModelV4StreamPart[][] = [
    [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: "call-1", toolName: "get_profile_summary", input: "{}" },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
    ],
    [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "t1" },
      ...["You ", "have ", "4 ", "years."].map((delta): LanguageModelV4StreamPart => ({ type: "text-delta", id: "t1", delta })),
      { type: "text-end", id: "t1" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
    ],
  ];
  let i = 0;
  return new MockLanguageModelV4({
    provider: "openrouter",
    modelId: MODEL_ID,
    doStream: async () => ({ stream: simulateReadableStream({ chunks: steps[i++], chunkDelayInMs: 5 }) }),
  });
}

/** One turn, read by a client that disconnects after the first chunk. */
async function turn(): Promise<ReadableSpan[]> {
  exporter.reset();
  h.afterTasks.length = 0;
  const res = await streamAgentTurn({
    userId: USER,
    email: null,
    thread,
    input: { kind: "message", id: "m-1", text: "How many years have I worked?", documentIds: [] },
    model: model(),
  });
  const reader = res.body!.getReader();
  await reader.read();
  await reader.cancel();
  await Promise.all(h.afterTasks);
  await provider?.forceFlush();
  return exporter.getFinishedSpans();
}

const attrs = (s: ReadableSpan) => s.attributes;
const everyAttribute = (spans: ReadableSpan[]) => spans.flatMap((s) => Object.entries(attrs(s)));

describe("agent tracing", () => {
  // This test must stay first in the file: the telemetry registry is process-global and
  // a later test registers into it, so the "nothing registered" assertion holds only
  // while it runs before them (vitest runs a file's tests in order unless shuffled).
  test("with tracing disabled the turn runs and nothing is registered", async () => {
    h.enabled = false;
    const spans = await turn();
    expect(spans).toHaveLength(0);
    expect(h.startCalls).toBe(0);
    expect(globalThis.AI_SDK_TELEMETRY_INTEGRATIONS ?? []).toHaveLength(0);
    expect(finishRun).toHaveBeenLastCalledWith(USER, expect.any(String), { status: "done" });
  });

  test("a turn produces a generation span carrying the model id and token counts", async () => {
    h.enabled = true;
    const spans = await turn();
    const generations = spans.filter((s) => attrs(s)["gen_ai.request.model"] === MODEL_ID && "gen_ai.usage.input_tokens" in attrs(s));
    expect(generations.length).toBeGreaterThanOrEqual(2);
    expect(generations[0].attributes["gen_ai.usage.input_tokens"]).toBe(31);
    expect(generations[0].attributes["gen_ai.usage.output_tokens"]).toBe(7);
    // Registered once, however many turns run.
    expect(globalThis.AI_SDK_TELEMETRY_INTEGRATIONS ?? []).toHaveLength(1);
    expect(h.flushes).toBeGreaterThan(0);
  });

  test("spans carry the variant tag and the thread as session id", async () => {
    h.enabled = true;
    const spans = await turn();
    expect(spans.length).toBeGreaterThan(0);
    // Every span, including those that end after the client disconnected and the
    // handler returned (consumeStream drives the rest of the turn).
    for (const s of spans) {
      expect(attrs(s)["session.id"]).toBe(thread.id);
      expect(attrs(s)["langfuse.trace.tags"]).toEqual(["agent", "variant-2", "interactive"]);
      expect(attrs(s)["langfuse.trace.metadata.variant"]).toBe("2");
    }
    expect(spans.map((s) => attrs(s)["gen_ai.response.finish_reasons"]).flat()).toContain("stop");
  });

  test("tool inputs and outputs are recorded, and no span attribute contains an eeo_ key", async () => {
    h.enabled = true;
    const spans = await turn();
    const toolSpan = spans.find((s) => attrs(s)["gen_ai.tool.name"] === "get_profile_summary");
    expect(toolSpan).toBeDefined();
    expect(toolSpan!.attributes["gen_ai.tool.call.arguments"]).toBe("{}");
    expect(String(toolSpan!.attributes["gen_ai.tool.call.result"])).toContain("Pat Example");
    expect(String(toolSpan!.attributes["gen_ai.tool.call.result"])).toContain('"yearsOfExperience":4');
    const all = everyAttribute(spans);
    expect(all.length).toBeGreaterThan(0);
    for (const [key, value] of all) {
      expect(key.toLowerCase()).not.toContain("eeo");
      expect(JSON.stringify(value).toLowerCase()).not.toContain("eeo");
    }
  });
});
