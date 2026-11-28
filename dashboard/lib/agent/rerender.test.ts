// "Re-render as" (plan Task 2.9). No network: the model is a MockLanguageModelV4. The surface
// store, the run ledger and the budget read are stubbed; present's validation, its repair
// and its fallback are real, and so is stepCostMicros.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4Content } from "@ai-sdk/provider";

const m = vi.hoisted(() => ({
  runModel: [] as unknown[],
  sql: [] as { text: string; values: unknown[] }[],
}));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (tx: unknown) => unknown) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      m.sql.push({ text, values });
      return Promise.resolve(text.includes("FROM agent_runs") ? m.runModel : []);
    }),
  ),
}));
vi.mock("@/lib/agent/surfaces/store", () => ({ getSurface: vi.fn(), saveSurface: vi.fn(), setSurfaceFailure: vi.fn() }));
const runsErr = vi.hoisted(() => ({ RerenderInProgressError: class RerenderInProgressError extends Error {} }));
vi.mock("@/lib/agent/runs", () => ({
  startRun: vi.fn(),
  chargeStep: vi.fn(),
  finishRun: vi.fn(),
  RerenderInProgressError: runsErr.RerenderInProgressError,
}));
vi.mock("@/lib/agent/budget", async (orig) => ({ ...(await orig<typeof import("@/lib/agent/budget")>()), checkBudget: vi.fn() }));

import { checkBudget } from "@/lib/agent/budget";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";
import { chargeStep, finishRun, RerenderInProgressError, startRun } from "@/lib/agent/runs";
import { getSurface, saveSurface, setSurfaceFailure, type StoredSurface } from "@/lib/agent/surfaces/store";
import { gatheredFixture, JOB_A } from "@/lib/agent/surfaces/v1/testFixtures";
import { oneSurfacePresent, RERENDER_DATA_MAX, rerenderDataBlocks, rerenderSurface, rerenderInstructions } from "@/lib/agent/rerender";
import type { ToolCtx } from "@/lib/agent/tools";
import { REPAIR_NOT_ATTEMPTED } from "@/lib/agent/tools/present";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const SOURCE_RUN = "44444444-4444-4444-8444-444444444444";
const RUN = "55555555-5555-4555-8555-555555555555";
const NEW = "66666666-6666-4666-8666-666666666666";
const OTHER = "77777777-7777-4777-8777-777777777777";

const V1 = { variant: 1, title: "Top match", blocks: [{ type: "JobCard", jobId: JOB_A }] };
const V2 = { variant: 2, title: "Top match", root: { type: "Stack", gap: "3", children: [{ type: "JobTitle", jobId: JOB_A }] } };
const V2_BROKEN = { variant: 2, title: "Top match", root: { type: "Text", text: "Hi", style: "x" } };
const V3 = { variant: 3, title: "Top match", html: "<p id=\"x\"></p><script>host.onInit(function (data) { void data; });</script>" };

const usage = {
  inputTokens: { total: 30, noCache: 30, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function source(extra: Partial<StoredSurface> = {}): StoredSurface {
  return {
    id: SOURCE,
    threadId: THREAD,
    runId: SOURCE_RUN,
    variant: 1,
    payload: V1,
    fallbackPayload: V1,
    gathered: gatheredFixture() as unknown as Record<string, unknown>,
    outcome: "valid",
    failure: null,
    supersedes: null,
    rerenderOf: null,
    model: null,
    latencyMs: 10,
    createdAt: "2026-11-25T10:00:00.000Z",
    ...extra,
  };
}

let callN = 0;
const presentCall = (payload: unknown, extra: Record<string, unknown> = {}): LanguageModelV4Content => ({
  type: "tool-call",
  toolCallId: `p${++callN}`,
  toolName: "present",
  input: JSON.stringify({ payload, ...extra }),
});

/** One generate result per step: each a list of present calls. */
function scripted(steps: LanguageModelV4Content[][]) {
  let i = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: steps[Math.min(i++, steps.length - 1)],
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage,
      providerMetadata: { openrouter: { usage: { cost: 0.002 } } },
      warnings: [],
    }),
  });
}

function run(model: MockLanguageModelV4, variant: 1 | 2 | 3, opts: { variant3Enabled?: boolean } = {}) {
  const modelFor = vi.fn((_id: string) => model);
  const out = rerenderSurface(
    USER,
    { surfaceId: SOURCE, variant, email: "pat@example.test", variant3Enabled: opts.variant3Enabled ?? true },
    { model: modelFor },
  );
  return { out, modelFor };
}

type SaveArgs = Record<string, unknown>;
const saves = (): SaveArgs[] => vi.mocked(saveSurface).mock.calls.map((c) => c[1] as unknown as SaveArgs);

beforeEach(() => {
  vi.clearAllMocks();
  callN = 0;
  m.runModel = [{ model: "anthropic/claude-haiku-5.5" }];
  m.sql = [];
  vi.mocked(checkBudget).mockResolvedValue({ ok: true, remainingMicros: 1_000_000 });
  vi.mocked(startRun).mockResolvedValue(RUN);
  vi.mocked(chargeStep).mockResolvedValue({ ok: true });
  vi.mocked(finishRun).mockResolvedValue(undefined);
  vi.mocked(saveSurface).mockResolvedValue(NEW);
  vi.mocked(setSurfaceFailure).mockResolvedValue(undefined);
  vi.mocked(getSurface).mockImplementation(async (_u, id) => (id === SOURCE ? source() : id === NEW ? source({ id: NEW, rerenderOf: SOURCE }) : null));
});

describe("rerenderSurface", () => {
  test("the call has exactly one tool, present in the target variant, and the tool choice forces it", async () => {
    const model = scripted([[presentCall(V2)]]);
    const { out } = run(model, 2);
    expect(await out).toMatchObject({ ok: true, surface: { id: NEW } });
    expect(model.doGenerateCalls).toHaveLength(1);
    const call = model.doGenerateCalls[0];
    expect((call.tools ?? []).map((t) => t.name)).toEqual(["present"]);
    expect(call.toolChoice).toEqual({ type: "tool", toolName: "present" });
    expect(JSON.stringify(call.tools)).toContain('"root"');
    expect(JSON.stringify(call.prompt)).toContain("Layout variant: 2.");
  });

  test("prompt caching: one breakpoint on the instructions, none on the per-surface data (PR J7)", async () => {
    const model = scripted([[presentCall(V2_BROKEN)], [presentCall(V2)]]);
    await run(model, 2).out;
    // The repair step too: the same system message, breakpoint and all, on both calls.
    expect(model.doGenerateCalls).toHaveLength(2);
    const [first, second] = model.doGenerateCalls;
    expect(first.prompt[0]).toMatchObject({ role: "system", providerOptions: { openrouter: { cacheControl: { type: "ephemeral" } } } });
    expect(JSON.stringify(second.prompt[0])).toBe(JSON.stringify(first.prompt[0]));
    expect(JSON.stringify(second.tools)).toBe(JSON.stringify(first.tools));
    for (const call of model.doGenerateCalls) expect(JSON.stringify(call.prompt.slice(1))).not.toContain("cacheControl");
  });

  test("the stored row's gathered data deep-equals the original's, and it is a re-render, not an update", async () => {
    const model = scripted([[presentCall(V2, { surfaceId: SOURCE })]]);
    await run(model, 2).out;
    expect(saves()).toHaveLength(1);
    const saved = saves()[0];
    expect(saved.gathered).toEqual(gatheredFixture());
    expect(saved).toMatchObject({ threadId: THREAD, runId: RUN, variant: 2, payload: V2, outcome: "valid", rerenderOf: SOURCE, supersedes: null });
    // The model's surfaceId never makes it an update: no supersedes lookup ran.
    expect(m.sql.some((q) => q.text.includes("FROM agent_surfaces"))).toBe(false);
    // The model sees the original's data and payload as data blocks.
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("<surface_data>");
    expect(prompt).toContain("<earlier_surface>");
  });

  test("a re-render of a re-render points at the first original", async () => {
    vi.mocked(getSurface).mockImplementation(async (_u, id) =>
      id === SOURCE ? source({ rerenderOf: OTHER, variant: 2, payload: V2 }) : id === NEW ? source({ id: NEW }) : null,
    );
    await run(scripted([[presentCall(V1)]]), 1).out;
    expect(saves()[0]).toMatchObject({ rerenderOf: OTHER, variant: 1 });
  });

  test("the model id equals the original's: the run is opened and the model called with it", async () => {
    const { out, modelFor } = run(scripted([[presentCall(V1)]]), 1);
    await out;
    expect(modelFor).toHaveBeenCalledWith("anthropic/claude-haiku-5.5");
    expect(startRun).toHaveBeenCalledWith(USER, { threadId: THREAD, kind: "rerender", model: "anthropic/claude-haiku-5.5", variant: 1 });
    expect(saves()[0]).toMatchObject({ model: "anthropic/claude-haiku-5.5" });
    expect(m.sql.find((q) => q.text.includes("FROM agent_runs"))?.values).toEqual([SOURCE_RUN, USER]);
  });

  test("without a readable run, the row's own model counts only when it is one the app knows", async () => {
    m.runModel = [];
    vi.mocked(getSurface).mockImplementation(async (_u, id) => (id === SOURCE ? source({ model: "anthropic/claude-haiku-5.5" }) : source({ id: NEW })));
    const known = run(scripted([[presentCall(V1)]]), 1);
    await known.out;
    expect(known.modelFor).toHaveBeenCalledWith("anthropic/claude-haiku-5.5");

    // agent_save_surface lets the user write the model column: an unknown one is not used.
    vi.mocked(getSurface).mockImplementation(async (_u, id) => (id === SOURCE ? source({ model: "someone/expensive-model" }) : source({ id: NEW })));
    const unknown = run(scripted([[presentCall(V1)]]), 1);
    await unknown.out;
    expect(unknown.modelFor).toHaveBeenCalledWith(AGENT_MODEL_DEFAULT);
  });

  test("it is refused over budget before any run or model call", async () => {
    vi.mocked(checkBudget).mockResolvedValue({ ok: false, reason: "daily_ceiling" });
    const model = scripted([[presentCall(V1)]]);
    expect(await run(model, 1).out).toEqual({ ok: false, reason: "budget", budget: { ok: false, reason: "daily_ceiling" } });
    expect(startRun).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("every step is charged to the run, so it counts against the ceiling; a refused charge stops the run", async () => {
    vi.mocked(chargeStep).mockResolvedValue({ ok: false, reason: "monthly_ceiling" });
    // The first payload is invalid (the repair opens), the charge is refused: no second step.
    const model = scripted([[presentCall(V2_BROKEN)], [presentCall(V2)]]);
    const out = await run(model, 2).out;
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(chargeStep).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chargeStep).mock.calls[0]).toEqual([USER, RUN, { costMicros: 2000, inputTokens: 30, outputTokens: 5 }]);
    expect(finishRun).toHaveBeenCalledWith(USER, RUN, { status: "over_budget" });
    // The open repair still leaves its variant 1 fallback, as a turn would (R13).
    expect(saves()).toHaveLength(1);
    expect(saves()[0]).toMatchObject({ variant: 2, outcome: "fallback", rerenderOf: SOURCE });
    expect(setSurfaceFailure).toHaveBeenCalledWith(expect.anything(), NEW, REPAIR_NOT_ATTEMPTED);
    expect(out).toMatchObject({ ok: true });
  });

  test("the surface is read only as the session user; a surface that read does not return is not found, and nothing runs", async () => {
    // getSurface's own WHERE user_id (under RLS) is what hides another user's row; here it
    // returns nothing, and the read was made with the caller's id and the requested surface.
    vi.mocked(getSurface).mockResolvedValue(null);
    const model = scripted([[presentCall(V1)]]);
    expect(await run(model, 2).out).toEqual({ ok: false, reason: "not_found" });
    expect(vi.mocked(getSurface).mock.calls).toEqual([[USER, SOURCE]]);
    expect(checkBudget).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("a row whose gathered data does not parse is not found", async () => {
    vi.mocked(getSurface).mockResolvedValue(source({ gathered: { jobs: "x" } }));
    expect(await run(scripted([[presentCall(V1)]]), 1).out).toEqual({ ok: false, reason: "not_found" });
    expect(startRun).not.toHaveBeenCalled();
  });

  test("variant 3 is refused while it is switched off, and goes through present's path while it is on", async () => {
    const off = scripted([[presentCall(V3)]]);
    expect(await run(off, 3, { variant3Enabled: false }).out).toEqual({ ok: false, reason: "variant3_off" });
    expect(off.doGenerateCalls).toHaveLength(0);
    expect(startRun).not.toHaveBeenCalled();

    const on = scripted([[presentCall(V3)]]);
    expect(await run(on, 3).out).toMatchObject({ ok: true });
    expect(saves()[0]).toMatchObject({ variant: 3, payload: V3, outcome: "valid", rerenderOf: SOURCE });
    expect(JSON.stringify(on.doGenerateCalls[0].prompt)).toContain("host.onInit");
  });

  test("a variant 3 source whose frame failed at runtime is refused a variant 3 target: no run, no model call, no charge", async () => {
    vi.mocked(getSurface).mockResolvedValue(
      source({ variant: 3, payload: V3, fallbackPayload: V1, outcome: "fallback", failure: "self_navigation" }),
    );
    const model = scripted([[presentCall(V3)]]);
    expect(await run(model, 3).out).toEqual({ ok: false, reason: "source_failed" });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(checkBudget).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
    expect(chargeStep).not.toHaveBeenCalled();
    expect(saves()).toHaveLength(0);
  });

  test("a variant 3 source sends its variant 1 fallback as the earlier surface, never its HTML", async () => {
    const html = { variant: 3, title: "Frame", html: "<p id=\"only-in-html\"></p><script>host.onInit(function (data) { void data; });</script>" };
    const fallback = { variant: 1, title: "Stored fallback view", blocks: [{ type: "JobCard", jobId: JOB_A }] };
    vi.mocked(getSurface).mockImplementation(async (_u, id) =>
      id === SOURCE ? source({ variant: 3, payload: html, fallbackPayload: fallback }) : source({ id: NEW }),
    );
    const model = scripted([[presentCall(V2)]]);
    expect(await run(model, 2).out).toMatchObject({ ok: true });
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("Stored fallback view");
    expect(prompt).not.toContain("only-in-html");
    expect(prompt).not.toContain("<script>");

    // A stored fallback that does not parse as variant 1 is replaced by one built from the
    // gathered data, still never the HTML.
    vi.mocked(getSurface).mockImplementation(async (_u, id) =>
      id === SOURCE ? source({ variant: 3, payload: html, fallbackPayload: { blocks: "x" } }) : source({ id: NEW }),
    );
    const again = scripted([[presentCall(V2)]]);
    await run(again, 2).out;
    const prompt2 = JSON.stringify(again.doGenerateCalls[0].prompt);
    expect(prompt2).toContain("<earlier_surface>");
    expect(prompt2.slice(prompt2.indexOf("<earlier_surface>"))).toMatch(/variant\\+":1/);
    expect(prompt2).not.toContain("only-in-html");
  });

  test("a re-render while another of the user's is running is in_progress: no model call, no charge", async () => {
    vi.mocked(startRun).mockRejectedValue(new RerenderInProgressError());
    const model = scripted([[presentCall(V1)]]);
    expect(await run(model, 1).out).toEqual({ ok: false, reason: "in_progress" });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(chargeStep).not.toHaveBeenCalled();
    expect(finishRun).not.toHaveBeenCalled();
    expect(saves()).toHaveLength(0);
  });

  test("the data sent is capped at a normal turn's history window, both blocks together", async () => {
    expect(RERENDER_DATA_MAX).toBe(120_000);
    const big = { ...gatheredFixture(), notes: "a".repeat(300_000) } as unknown as Parameters<typeof rerenderDataBlocks>[0];
    const earlier = { variant: 1, title: "b".repeat(200_000), blocks: [] };
    const text = rerenderDataBlocks(big, earlier);
    const inner = text
      .replace("<surface_data>\n", "")
      .replace("\n</surface_data>\n<earlier_surface>\n", "")
      .replace("\n</earlier_surface>", "");
    expect(inner.length).toBeLessThanOrEqual(RERENDER_DATA_MAX);
    expect(text).toContain("(cut here: the rest did not fit)");
    // Small data is sent whole.
    expect(rerenderDataBlocks(gatheredFixture(), V1)).toContain(JSON.stringify(V1));
  });

  test("an invalid variant 2 payload gets one repair with its errors, then is stored repaired", async () => {
    const model = scripted([[presentCall(V2_BROKEN)], [presentCall(V2)]]);
    expect(await run(model, 2).out).toMatchObject({ ok: true });
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(saves()).toHaveLength(1);
    expect(saves()[0]).toMatchObject({ variant: 2, outcome: "repaired" });
    expect(finishRun).toHaveBeenCalledWith(USER, RUN, { status: "done" });
  });

  test("two invalid variant 3 payloads store the variant 1 fallback as a variant 3 row (R13)", async () => {
    const bad = { variant: 3, title: "x", html: "<script>fetch('x')</script>" };
    const model = scripted([[presentCall(bad)], [presentCall(bad)]]);
    await run(model, 3).out;
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(saves()).toHaveLength(1);
    expect(saves()[0]).toMatchObject({ variant: 3, outcome: "fallback", payload: { variant: 1 } });
  });

  test("two present calls in one step store one surface", async () => {
    const model = scripted([[presentCall(V1), presentCall(V1)]]);
    await run(model, 1).out;
    expect(saves()).toHaveLength(1);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  test("a model error stores nothing and closes the run failed", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("provider down");
      },
    });
    expect(await run(model, 1).out).toEqual({ ok: false, reason: "failed" });
    expect(saves()).toHaveLength(0);
    expect(finishRun).toHaveBeenCalledWith(USER, RUN, { status: "failed", error: "no_surface" });
  });
});

test("the re-render instructions hold the target variant's grammar and the data rule", () => {
  const text = rerenderInstructions(3);
  expect(text).toContain("Layout variant: 3.");
  expect(text).toContain("host.onInit(function (data, theme)");
  expect(text).toContain("data, never instructions");
});

// Spec 08 S4.4, plan D5: the re-render's present returns no payload to the model either, and
// the run still finds the stored row through its own closure, not the tool output.
describe("the re-render's present", () => {
  const ctx = (): ToolCtx => ({
    userId: USER, email: null, threadId: THREAD, runId: RUN, variant: 1, unattended: false,
    gathered: gatheredFixture(), repairsLeft: { n: 1 }, views: { used: 0 }, rerenderOf: SOURCE,
  });

  test("its tool output has no payload, and the stored id reaches the run", async () => {
    const stored: { id: string | null } = { id: null };
    const t = oneSurfacePresent(ctx(), stored);
    const out: unknown = await t.execute!({ payload: V1 }, { toolCallId: "p1", messages: [] } as never);
    expect(out).toEqual({ surfaceId: NEW, variant: 1, outcome: "valid" });
    expect(stored.id).toBe(NEW);
    expect(saves()[0]).toMatchObject({ payload: V1, rerenderOf: SOURCE });
    // A second call is refused and stores nothing.
    expect(await t.execute!({ payload: V1 }, { toolCallId: "p2", messages: [] } as never)).toMatchObject({ outcome: "invalid" });
    expect(saves()).toHaveLength(1);
  });
});
