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
import { assertNoUserIdInput } from "@/lib/agent/tools/assertNoUserIdInput";
import { presentTool, runPresent } from "@/lib/agent/tools/present";
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

  test("a variant 3 thread still falls back to the variant 1 surface (no grammar until Task 2.4)", async () => {
    const out = await runPresent(ctx({ variant: 3 }), { payload: { variant: 3, title: "x", html: "<p>x</p>" } });
    expect(out).toMatchObject({ variant: 1, outcome: "fallback", errors: ["variant 3 has no grammar yet"] });
    expect(saved()).toMatchObject({ variant: 1, outcome: "fallback" });
    expect(m.setSurfaceFailure).not.toHaveBeenCalled();
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
    // The JobComparison tuple is a draft 7 tuple: items as a list, no extra items.
    const blocks = (schema as { properties: { payload: { properties: { blocks: { items: { oneOf: unknown[] } } } } } })
      .properties.payload.properties.blocks.items.oneOf;
    const comparison = blocks.find((b) => JSON.stringify(b).includes('"const":"JobComparison"')) as {
      properties: { jobIds: { items: unknown; additionalItems: unknown } };
    };
    expect(Array.isArray(comparison.properties.jobIds.items)).toBe(true);
    expect(comparison.properties.jobIds.additionalItems).toBe(false);
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
});
