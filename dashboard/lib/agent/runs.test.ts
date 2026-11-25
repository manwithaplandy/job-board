// chargeStep's retry on a lock or statement timeout (PR C batch 2 review M1), with the
// database stubbed. The real transaction is covered by runs.db.test.ts.
import { beforeEach, describe, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ begin: vi.fn() }));
vi.mock("@/lib/db", () => ({ serviceSql: Object.assign(vi.fn(), { begin: db.begin }) }));
vi.mock("@/lib/appSettings", () => ({
  loadAppSettings: vi.fn(async () => ({ agentDailyCeilingMicros: 1_000_000, agentMonthlyCeilingMicros: 10_000_000 })),
}));
vi.mock("@/lib/jobLifecycle", () => ({ acquireLifecycleGate: vi.fn(async () => {}) }));

import { chargeStep } from "@/lib/agent/runs";

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
