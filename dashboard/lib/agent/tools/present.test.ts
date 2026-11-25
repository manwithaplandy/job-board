// The present tool (plan Task 1.17): a valid variant 1 payload is stored as is; an
// invalid one is stored as the deterministic fallback with outcome fallback; surfaceId
// supersedes only one of the caller's own surfaces in the thread. saveSurface and the
// database are fakes; validation and the fallback are real.
import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  saveSurface: vi.fn(async () => "99999999-9999-4999-8999-999999999999"),
  ownSurfaces: new Set<string>(),
  queries: [] as unknown[][],
}));
vi.mock("@/lib/agent/surfaces/store", () => ({ saveSurface: m.saveSurface }));
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

  test("a variant 2 thread falls back to the variant 1 surface", async () => {
    const out = await runPresent(ctx({ variant: 2 }), { payload: { variant: 1, blocks: [{ type: "JobCard", jobId: JOB_A }] } });
    expect(out).toMatchObject({ variant: 1, outcome: "fallback", errors: ["variant 2 has no grammar yet"] });
    expect(saved()).toMatchObject({ variant: 1, outcome: "fallback" });
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
});
