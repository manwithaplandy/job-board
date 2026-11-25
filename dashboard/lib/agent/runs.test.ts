// chargeStep's retry on a lock or statement timeout (PR C batch 2 review M1), with the
// database stubbed. The real transaction is covered by runs.db.test.ts.
import { beforeEach, describe, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ begin: vi.fn() }));
vi.mock("@/lib/db", () => ({ serviceSql: Object.assign(vi.fn(), { begin: db.begin }) }));
vi.mock("@/lib/appSettings", () => ({
  loadAppSettings: vi.fn(async () => ({ agentDailyCeilingMicros: 1_000_000, agentMonthlyCeilingMicros: 10_000_000 })),
}));
vi.mock("@/lib/jobLifecycle", () => ({ acquireLifecycleGate: vi.fn(async () => {}) }));

import { chargeStep, RerenderInProgressError, startRun } from "@/lib/agent/runs";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN = "11111111-1111-4111-8111-111111111111";
const step = { costMicros: 100, inputTokens: 1, outputTokens: 1 };

function pgError(code: string): Error {
  return Object.assign(new Error(`pg ${code}`), { code });
}

beforeEach(() => {
  db.begin.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("chargeStep retry", () => {
  test.each(["55P03", "57014"])("retries once after SQLSTATE %s and then succeeds", async (code) => {
    db.begin.mockRejectedValueOnce(pgError(code)).mockResolvedValueOnce({ day_micros: 100, month_micros: 100 });
    expect(await chargeStep(USER, RUN, step)).toEqual({ ok: true });
    expect(db.begin).toHaveBeenCalledTimes(2);
  });

  test("a second timeout is thrown", async () => {
    db.begin.mockRejectedValueOnce(pgError("55P03")).mockRejectedValueOnce(pgError("57014"));
    await expect(chargeStep(USER, RUN, step)).rejects.toMatchObject({ code: "57014" });
    expect(db.begin).toHaveBeenCalledTimes(2);
  });

  test("any other error is thrown without a retry", async () => {
    db.begin.mockRejectedValueOnce(pgError("23505"));
    await expect(chargeStep(USER, RUN, step)).rejects.toMatchObject({ code: "23505" });
    expect(db.begin).toHaveBeenCalledTimes(1);
  });
});

// One re-render in flight per user (PR J4 review M1). The transaction is stubbed: each
// statement's text is recorded, and the live-rerender read returns `live`. The real
// locking is runs.db.test.ts.
describe("startRun for a re-render", () => {
  const THREAD = "22222222-2222-4222-8222-222222222222";
  const rerender = { threadId: THREAD, kind: "rerender" as const, model: "m", variant: 2 as const };

  function stubTx(live: unknown[]) {
    const statements: string[] = [];
    db.begin.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn((strings: TemplateStringsArray) => {
        const text = strings.join("?").replace(/\s+/g, " ").trim();
        statements.push(text);
        if (text.startsWith("SELECT 1 FROM agent_threads")) return Promise.resolve([{ "?column?": 1 }]);
        if (text.startsWith("SELECT 1 FROM agent_runs")) return Promise.resolve(live);
        if (text.startsWith("INSERT INTO agent_runs")) return Promise.resolve([{ id: RUN }]);
        return Promise.resolve([]);
      }),
    );
    return statements;
  }

  test("a re-render still running for the user refuses a second one before any insert", async () => {
    const statements = stubTx([{ "?column?": 1 }]);
    await expect(startRun(USER, rerender)).rejects.toBeInstanceOf(RerenderInProgressError);
    const lock = statements.findIndex((s) => s.includes("pg_advisory_xact_lock"));
    const stale = statements.findIndex((s) => s.includes("'stale_rerender'"));
    const read = statements.findIndex((s) => s.startsWith("SELECT 1 FROM agent_runs"));
    expect(lock).toBeGreaterThan(statements.findIndex((s) => s.includes("FOR UPDATE")));
    expect(stale).toBeGreaterThan(lock);
    expect(read).toBeGreaterThan(stale);
    expect(statements[read]).toContain("kind = 'rerender' AND status = 'running'");
    expect(statements.some((s) => s.startsWith("INSERT INTO agent_runs"))).toBe(false);
  });

  test("with none running, the re-render run is opened", async () => {
    stubTx([]);
    expect(await startRun(USER, rerender)).toBe(RUN);
  });

  test("an interactive turn takes no re-render lock", async () => {
    const statements = stubTx([{ "?column?": 1 }]);
    expect(await startRun(USER, { ...rerender, kind: "interactive" })).toBe(RUN);
    expect(statements.some((s) => s.includes("pg_advisory_xact_lock"))).toBe(false);
  });
});
