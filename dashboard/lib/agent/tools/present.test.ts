// The present tool (plan Task 1.17): a valid variant 1 payload is stored as is; an
// invalid one is stored as the deterministic fallback with outcome fallback; surfaceId
// supersedes only one of the caller's own surfaces in the thread. saveSurface and the
// database are fakes; validation and the fallback are real.
import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  saveSurface: vi.fn(async () => "99999999-9999-4999-8999-999999999999"),
  setSurfaceFailure: vi.fn(async () => undefined),
  ownSurfaces: new Set<string>(),
  queries: [] as unknown[][],
}));
vi.mock("@/lib/agent/surfaces/store", () => ({ saveSurface: m.saveSurface, setSurfaceFailure: m.setSurfaceFailure }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (tx: unknown) => unknown) =>
    fn((_s: TemplateStringsArray, ...values: unknown[]) => {
      m.queries.push(values);
      const id = String(values[0]);
      return Promise.resolve(m.ownSurfaces.has(id) ? [{ id }] : []);
    }),
  ),
}));

import type { ToolCtx } from "@/lib/agent/tools";
import { buildTools } from "@/lib/agent/tools";
import { assertNoUserIdInput } from "@/lib/agent/tools/assertNoUserIdInput";
import { finishPendingRepair, presentTool, REPAIR_NOT_ATTEMPTED, runPresent } from "@/lib/agent/tools/present";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { gatheredFixture, JOB_A } from "@/lib/agent/surfaces/v1/testFixtures";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "22222222-2222-4222-8222-222222222222";
const OLD = "33333333-3333-4333-8333-333333333333";
const NEW = "99999999-9999-4999-8999-999999999999";

function ctx(extra: Partial<ToolCtx> = {}): ToolCtx {
  return {
    userId: USER, email: "me@example.test", threadId: THREAD, runId: RUN, variant: 1, unattended: false,
    gathered: gatheredFixture(), repairsLeft: { n: 1 }, ...extra,
  };
}

type SaveArgs = Record<string, unknown>;
const saved = (): SaveArgs => (m.saveSurface.mock.calls.at(-1) as unknown as [unknown, SaveArgs])[1];

beforeEach(() => {
  vi.clearAllMocks();
  m.ownSurfaces = new Set();
  m.queries = [];
});

describe("present", () => {
  test("a valid variant 1 payload is stored as is, with the turn's gathered data and the fallback beside it", async () => {
    const c = ctx();
    const payload = { variant: 1, title: "Top match", blocks: [{ type: "JobCard", jobId: JOB_A }] };
    expect(await runPresent(c, { payload })).toEqual({ surfaceId: NEW, variant: 1, outcome: "valid", payload });
    expect(saved()).toMatchObject({
      threadId: THREAD, runId: RUN, variant: 1, payload, outcome: "valid", supersedes: null, rerenderOf: null,
      gathered: c.gathered, fallbackPayload: fallbackSurface(c.gathered, "Top match"), model: null,
    });
    expect(m.queries).toEqual([]);
  });

  test("an invalid variant 1 payload is stored as the fallback with outcome fallback", async () => {
    const c = ctx();
    const payload = { variant: 1, title: "Picks", blocks: [{ type: "Html", html: "<b>x</b>" }, { type: "JobCard", jobId: "x:y:404" }] };
    const out = await runPresent(c, { payload });
    const expected = fallbackSurface(c.gathered, "Picks");
    expect(out).toMatchObject({ surfaceId: NEW, variant: 1, outcome: "fallback", payload: expected });
    expect(out.errors?.length).toBeGreaterThan(0);
    expect(out.errors?.length).toBeLessThanOrEqual(10);
    expect(saved()).toMatchObject({ payload: expected, fallbackPayload: expected, outcome: "fallback" });
    // Not even an object: still the fallback, never a thrown error.
    expect(await runPresent(c, { payload: "just text" })).toMatchObject({ outcome: "fallback", payload: fallbackSurface(c.gathered) });
  });

  test("present with surfaceId stores a new row that supersedes the old one", async () => {
    m.ownSurfaces.add(OLD);
    const payload = { variant: 1, blocks: [{ type: "JobCard", jobId: JOB_A }] };
    expect(await runPresent(ctx(), { surfaceId: OLD, payload })).toMatchObject({ surfaceId: NEW, outcome: "valid" });
    expect(saved()).toMatchObject({ supersedes: OLD });
    expect(m.queries).toEqual([[OLD, USER, THREAD]]);
    // An id that is not one of the caller's surfaces in this thread, or not a uuid, is ignored.
    await runPresent(ctx(), { surfaceId: "44444444-4444-4444-8444-444444444444", payload });
    expect(saved()).toMatchObject({ supersedes: null });
    await runPresent(ctx(), { surfaceId: "not-a-uuid", payload });
    expect(saved()).toMatchObject({ supersedes: null });
    expect(m.queries).toHaveLength(2);
  });

  test("a surface needs a thread", async () => {
    await expect(runPresent(ctx({ threadId: null, variant: 2 }), { payload: {} })).rejects.toThrow(/thread/);
    await expect(runPresent(ctx({ threadId: null }), { payload: {} })).rejects.toThrow(/thread/);
    expect(m.saveSurface).not.toHaveBeenCalled();
  });

  test("the tool's own validation lets any object through to execute", async () => {
    const t = presentTool(ctx());
    expect(typeof t.execute).toBe("function");
    const schema = t.inputSchema as unknown as { validate?: (v: unknown) => Promise<{ success: boolean }> | { success: boolean } };
    expect(schema.validate).toBeDefined();
    expect((await schema.validate!({ payload: { variant: 9 } })).success).toBe(true);
    expect((await schema.validate!("text")).success).toBe(false);
    await expect(assertNoUserIdInput({ present: t })).resolves.toBeUndefined();
  });

  test("the tool tells the model what to do with an invalid outcome", () => {
    expect(presentTool(ctx()).description).toMatch(/outcome is invalid/);
  });

  test("L1: the input schema is draft 7, with no prefixItems and no other $schema", async () => {
    const t = presentTool(ctx());
    const schema = await (t.inputSchema as unknown as { jsonSchema: unknown | PromiseLike<unknown> }).jsonSchema;
    const text = JSON.stringify(schema);
    expect(text).not.toContain("prefixItems");
    const dialects = [...text.matchAll(/"\$schema":"([^"]*)"/g)].map((x) => x[1]);
    for (const d of dialects) expect(d).toBe("http://json-schema.org/draft-07/schema#");
    // The JobComparison tuple is a fixed-length array of two job ids: valid in draft 7 and
    // in draft 2020-12, which Anthropic checks every tool schema against.
    const blocks = (schema as { properties: { payload: { properties: { blocks: { items: { oneOf: unknown[] } } } } } })
      .properties.payload.properties.blocks.items.oneOf;
    const comparison = blocks.find((b) => JSON.stringify(b).includes('"const":"JobComparison"')) as {
      properties: { jobIds: { items: unknown; additionalItems?: unknown; minItems: number; maxItems: number } };
    };
    expect(Array.isArray(comparison.properties.jobIds.items)).toBe(false);
    expect(comparison.properties.jobIds.additionalItems).toBeUndefined();
    expect(comparison.properties.jobIds).toMatchObject({ type: "array", minItems: 2, maxItems: 2 });
  });

  // Anthropic refused the whole call with "tools.21.custom.input_schema: JSON schema is
  // invalid. It must match JSON Schema draft 2020-12" while present sent draft 7 tuples.
  test.each([1, 2, 3] as const)("variant %i: no tool schema uses a draft 7 tuple (list items or additionalItems)", async (variant) => {
    const tools = buildTools(ctx({ variant }));
    const offenders: string[] = [];
    const visit = (node: unknown, path: string): void => {
      if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}/${i}`));
      if (node === null || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.items) || "additionalItems" in o) offenders.push(path);
      for (const [k, v] of Object.entries(o)) visit(v, `${path}/${k}`);
    };
    for (const [name, t] of Object.entries(tools)) {
      visit(await (t.inputSchema as unknown as { jsonSchema: unknown | PromiseLike<unknown> }).jsonSchema, name);
    }
    expect(Object.keys(tools)).toContain("present");
    expect(offenders).toEqual([]);
  });
});

// The variant switcher (plan Task 2.8): the present tool's grammar is the turn's variant.
describe("present's schema per variant", () => {
  async function schemaOf(variant: 1 | 2 | 3) {
    const t = presentTool(ctx({ variant }));
    return {
      description: t.description ?? "",
      schema: (await (t.inputSchema as unknown as { jsonSchema: unknown | PromiseLike<unknown> }).jsonSchema) as {
        properties: { payload: { properties: Record<string, unknown> } };
        definitions?: Record<string, unknown>;
      },
    };
  }

  test("each variant's present tool has its own schema and description, and building one leaves another unchanged", async () => {
    // The tool is built from ctx.variant. That the loop reads the variant once per turn is
    // lib/agent/loop.test.ts ("the thread's variant").
    const one = await schemaOf(1);
    const two = await schemaOf(2);
    const three = await schemaOf(3);
    expect(Object.keys(one.schema.properties.payload.properties).sort()).toEqual(["blocks", "title", "variant"]);
    expect(Object.keys(two.schema.properties.payload.properties).sort()).toEqual(["root", "title", "variant"]);
    expect(Object.keys(three.schema.properties.payload.properties).sort()).toEqual(["html", "title", "variant"]);
    expect(JSON.stringify((await schemaOf(1)).schema)).toBe(JSON.stringify(one.schema));
    expect(one.description).toMatch(/blocks from the fixed catalog/);
    expect(two.description).toMatch(/tree of layout/);
    expect(three.description).toMatch(/sandboxed frame/);
    for (const d of [one, two, three]) expect(d.description).toMatch(/outcome is invalid/);
  });

  test("the recursive variant 2 schema's references resolve at the tool schema's root", async () => {
    const { schema } = await schemaOf(2);
    const text = JSON.stringify(schema);
    const refs = [...text.matchAll(/"\$ref":"#\/definitions\/([^"]+)"/g)].map((x) => x[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(schema.definitions?.[ref], ref).toBeDefined();
    expect(JSON.stringify(schema.properties.payload)).not.toContain('"definitions"');
    expect(text).not.toContain('"$schema"');
    expect(text).not.toContain("prefixItems");
  });
});

// Variant 2 (plan Task 2.3): one repair attempt with the errors fed back, then the
// variant 1 fallback (spec 7.1 "On failure").
describe("present, variant 2", () => {
  const tree = (title = "Side by side") => ({
    variant: 2,
    title,
    root: { type: "Stack", gap: "2", children: [{ type: "JobTitle", jobId: JOB_A }, { type: "FitScore", jobId: JOB_A }] },
  });
  const broken = { variant: 2, root: { type: "Stack", gap: "2", children: [{ type: "JobTitle", jobId: "x:y:404" }, { type: "Html", html: "x" }] } };

  test("first invalid payload returns the errors to the model and stores nothing", async () => {
    const c = ctx({ variant: 2 });
    const out = await runPresent(c, { payload: broken });
    expect(out).toEqual({ variant: 2, outcome: "invalid", errors: expect.any(Array) });
    expect(out.errors?.length).toBeGreaterThan(0);
    expect(out.errors?.length).toBeLessThanOrEqual(10);
    for (const e of out.errors ?? []) expect(e.length).toBeLessThan(200);
    expect("surfaceId" in out).toBe(false);
    expect(c.repairsLeft.n).toBe(0);
    expect(m.saveSurface).not.toHaveBeenCalled();
    expect(m.setSurfaceFailure).not.toHaveBeenCalled();
    expect(m.queries).toEqual([]);
    // A variant 1 payload in a variant 2 thread is invalid too, with the reason spelled out.
    const v1 = await runPresent(ctx({ variant: 2 }), { payload: { variant: 1, blocks: [{ type: "JobCard", jobId: JOB_A }] } });
    expect(v1).toMatchObject({ outcome: "invalid" });
    expect(v1.errors).toContain('payload: Unrecognized key: "blocks"');
  });

  test("a valid second payload is stored with outcome repaired", async () => {
    const c = ctx({ variant: 2 });
    await runPresent(c, { payload: broken });
    const payload = tree();
    expect(await runPresent(c, { payload })).toEqual({ surfaceId: NEW, variant: 2, outcome: "repaired", payload });
    expect(m.saveSurface).toHaveBeenCalledTimes(1);
    expect(saved()).toMatchObject({
      threadId: THREAD, runId: RUN, variant: 2, payload, outcome: "repaired", gathered: c.gathered,
      fallbackPayload: fallbackSurface(c.gathered, "Side by side"), supersedes: null, rerenderOf: null,
    });
    expect(m.setSurfaceFailure).not.toHaveBeenCalled();
    // The repair is spent: a later surface in the same turn is plain valid.
    expect(await runPresent(c, { payload: tree("Again") })).toMatchObject({ outcome: "valid" });
  });

  test("a second invalid payload stores the variant 1 fallback with outcome fallback", async () => {
    const c = ctx({ variant: 2 });
    await runPresent(c, { payload: broken });
    const out = await runPresent(c, { payload: { ...broken, title: "Matches" } });
    const expected = fallbackSurface(c.gathered, "Matches");
    expect(out).toMatchObject({ surfaceId: NEW, variant: 2, outcome: "fallback", payload: expected });
    expect(out.errors?.length).toBeGreaterThan(0);
    expect(saved()).toMatchObject({ variant: 2, payload: expected, fallbackPayload: expected, outcome: "fallback" });
    // The reason is recorded as a short code in the same transaction (errors go to the model).
    expect(m.setSurfaceFailure).toHaveBeenCalledTimes(1);
    expect((m.setSurfaceFailure.mock.calls[0] as unknown[]).slice(1)).toEqual([NEW, "invalid_after_repair"]);
    // M1: the very transaction saveSurface got.
    expect((m.setSurfaceFailure.mock.calls[0] as unknown[])[0]).toBe((m.saveSurface.mock.calls[0] as unknown[])[0]);
    expect(c.repairsLeft.attempt?.open).toBe(false);
    // With no repair left from the start, the first invalid payload falls back at once.
    vi.clearAllMocks();
    const none = await runPresent(ctx({ variant: 2, repairsLeft: { n: 0 } }), { payload: broken });
    expect(none).toMatchObject({ outcome: "fallback", payload: fallbackSurface(c.gathered) });
    expect(m.saveSurface).toHaveBeenCalledTimes(1);
  });

  test("a valid first payload stores fallback_payload alongside", async () => {
    const c = ctx({ variant: 2 });
    const payload = tree();
    expect(await runPresent(c, { payload })).toEqual({ surfaceId: NEW, variant: 2, outcome: "valid", payload });
    expect(saved()).toMatchObject({ variant: 2, payload, outcome: "valid", fallbackPayload: fallbackSurface(c.gathered, "Side by side") });
    expect(c.repairsLeft.n).toBe(1);
    expect(m.setSurfaceFailure).not.toHaveBeenCalled();
  });

  test("surfaceId supersedes one of the caller's own surfaces in variant 2 too", async () => {
    m.ownSurfaces.add(OLD);
    await runPresent(ctx({ variant: 2 }), { surfaceId: OLD, payload: tree() });
    expect(saved()).toMatchObject({ supersedes: OLD, variant: 2 });
  });

  test("I1: the repair state lives on the turn's context, one per turn", async () => {
    const turnA = ctx({ variant: 2 });
    const turnB = ctx({ variant: 2 });
    await runPresent(turnA, { payload: { ...broken, title: "Matches" }, surfaceId: OLD });
    expect(turnA.repairsLeft).toEqual({ n: 0, attempt: { step: null, open: true, title: "Matches", surfaceId: OLD, started: expect.any(Number) } });
    // Another turn's context is untouched: its first valid payload is plain valid.
    expect(await runPresent(turnB, { payload: tree() })).toMatchObject({ outcome: "valid" });
    expect(turnB.repairsLeft).toEqual({ n: 1 });
  });

  test("I1: a turn that ends with the repair open stores the fallback once, coded repair_not_attempted", async () => {
    m.ownSurfaces.add(OLD);
    const c = ctx({ variant: 2 });
    await runPresent(c, { surfaceId: OLD, payload: { ...broken, title: "Matches" } });
    expect(m.saveSurface).not.toHaveBeenCalled();
    expect(await finishPendingRepair(c)).toBe(NEW);
    const expected = fallbackSurface(c.gathered, "Matches");
    expect(saved()).toMatchObject({
      threadId: THREAD, runId: RUN, variant: 2, payload: expected, fallbackPayload: expected, outcome: "fallback",
      gathered: c.gathered, supersedes: OLD,
    });
    expect(m.setSurfaceFailure.mock.calls).toEqual([[(m.saveSurface.mock.calls[0] as unknown[])[0], NEW, REPAIR_NOT_ATTEMPTED]]);
    // Once only.
    expect(await finishPendingRepair(c)).toBeNull();
    expect(m.saveSurface).toHaveBeenCalledTimes(1);
  });

  test("I1: nothing is owed at the end after a repair, a fallback, a valid surface or no present at all", async () => {
    const repaired = ctx({ variant: 2 });
    await runPresent(repaired, { payload: broken });
    await runPresent(repaired, { payload: tree() });
    const fellBack = ctx({ variant: 2 });
    await runPresent(fellBack, { payload: broken });
    await runPresent(fellBack, { payload: broken });
    const valid = ctx({ variant: 2 });
    await runPresent(valid, { payload: tree() });
    vi.clearAllMocks();
    for (const c of [repaired, fellBack, valid, ctx({ variant: 2 }), ctx({ variant: 1 })]) {
      expect(await finishPendingRepair(c)).toBeNull();
    }
    expect(m.saveSurface).not.toHaveBeenCalled();
  });

  test("M2: calls from the step that spent the repair are one attempt", async () => {
    const step1 = { messages: [{}, {}] };
    const step2 = { messages: [{}, {}, {}, {}] };
    // Two invalid payloads in one step: both get invalid, nothing is stored.
    const c = ctx({ variant: 2 });
    const [a, b] = await Promise.all([runPresent(c, { payload: broken }, step1), runPresent(c, { payload: broken }, step1)]);
    expect(a).toMatchObject({ outcome: "invalid" });
    expect(b).toMatchObject({ outcome: "invalid" });
    expect(m.saveSurface).not.toHaveBeenCalled();
    expect(c.repairsLeft).toMatchObject({ n: 0, attempt: { step: 2, open: true } });
    // The next step's payload is the repair.
    expect(await runPresent(c, { payload: tree() }, step2)).toMatchObject({ outcome: "repaired" });
    // Invalid then valid in one step: the valid one was not a repair, and it settles the attempt.
    const d = ctx({ variant: 2 });
    await runPresent(d, { payload: broken }, step1);
    expect(await runPresent(d, { payload: tree() }, step1)).toMatchObject({ outcome: "valid" });
    expect(await runPresent(d, { payload: broken }, step1)).toMatchObject({ outcome: "invalid" });
    expect(await finishPendingRepair(d)).toBeNull();
    // An invalid payload in a later step is the failed repair: the fallback is stored.
    const e = ctx({ variant: 2 });
    await runPresent(e, { payload: broken }, step1);
    expect(await runPresent(e, { payload: broken }, step2)).toMatchObject({ outcome: "fallback" });
    expect((m.setSurfaceFailure.mock.calls.at(-1) as unknown[])[2]).toBe("invalid_after_repair");
  });
});

// Variant 3 (plan Task 2.4, R13): the schema and static checks are its gate, through the
// same one-repair path as variant 2; a fallback is stored as a variant 3 row with the
// variant 1 fallback in payload and fallback_payload and the failure code in the same
// transaction.
describe("present, variant 3", () => {
  const doc = (title = "Top picks") => ({ variant: 3, title, html: "<h1>Picks</h1><script>host.onInit(function () {});</script>" });
  const hostile = { variant: 3, title: "Picks", html: '<form></form><script>fetch("x")</script>' };

  test("a valid document is stored as a variant 3 row with the variant 1 fallback beside it", async () => {
    const c = ctx({ variant: 3 });
    const payload = doc();
    expect(await runPresent(c, { payload })).toEqual({ surfaceId: NEW, variant: 3, outcome: "valid", payload });
    expect(saved()).toMatchObject({
      variant: 3, payload, outcome: "valid", gathered: c.gathered, fallbackPayload: fallbackSurface(c.gathered, "Top picks"),
    });
    expect(m.setSurfaceFailure).not.toHaveBeenCalled();
  });

  test("a document that fails its static checks gets one repair with the errors, then a stored fallback", async () => {
    const c = ctx({ variant: 3 });
    const first = await runPresent(c, { payload: hostile });
    expect(first).toMatchObject({ variant: 3, outcome: "invalid" });
    expect(first.errors).toEqual(expect.arrayContaining(["html: <form> is not allowed", "html: fetch is not allowed"]));
    expect(m.saveSurface).not.toHaveBeenCalled();
    const out = await runPresent(c, { payload: hostile });
    const expected = fallbackSurface(c.gathered, "Picks");
    expect(out).toMatchObject({ surfaceId: NEW, variant: 3, outcome: "fallback", payload: expected });
    expect(saved()).toMatchObject({ variant: 3, payload: expected, fallbackPayload: expected, outcome: "fallback" });
    expect(m.setSurfaceFailure.mock.calls).toEqual([[(m.saveSurface.mock.calls[0] as unknown[])[0], NEW, "invalid_after_repair"]]);
  });

  test("a valid document after the repair is stored with outcome repaired", async () => {
    const c = ctx({ variant: 3 });
    await runPresent(c, { payload: hostile });
    const payload = doc("Fixed");
    expect(await runPresent(c, { payload })).toEqual({ surfaceId: NEW, variant: 3, outcome: "repaired", payload });
    expect(saved()).toMatchObject({ variant: 3, outcome: "repaired", payload });
  });

  test("a variant 3 turn that ends with the repair open stores a variant 3 fallback row", async () => {
    const c = ctx({ variant: 3 });
    await runPresent(c, { payload: hostile });
    expect(await finishPendingRepair(c)).toBe(NEW);
    expect(saved()).toMatchObject({ variant: 3, outcome: "fallback", payload: fallbackSurface(c.gathered, "Picks") });
    expect((m.setSurfaceFailure.mock.calls[0] as unknown[])[2]).toBe(REPAIR_NOT_ATTEMPTED);
  });

  test("a variant 2 tree or a variant 1 payload in a variant 3 thread is invalid", async () => {
    const out = await runPresent(ctx({ variant: 3 }), { payload: { variant: 1, blocks: [{ type: "JobCard", jobId: JOB_A }] } });
    expect(out).toMatchObject({ variant: 3, outcome: "invalid" });
  });
});
