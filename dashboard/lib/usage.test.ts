import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  plan: null as string | null,
  spendQueue: [] as number[], // successive monthlyGenerationSpend results
  unsafeCalls: [] as { text: string; params: unknown[] }[],
}));

vi.mock("@/lib/subscriptions", () => ({
  getViewerPlan: vi.fn(async () => state.plan),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    unsafe: (text: string, params: unknown[]) => {
      state.unsafeCalls.push({ text, params });
      if (/SELECT COALESCE\(SUM\(n\)/.test(text)) {
        const n = state.spendQueue.length ? state.spendQueue.shift()! : 0;
        return Promise.resolve([{ n }]);
      }
      return Promise.resolve([]);
    },
  };
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});

import {
  checkGenerationAllowance, chargeGenerations, monthlyGenerationSpend, chargeGeneration,
} from "@/lib/usage";

beforeEach(() => {
  state.plan = null;
  state.spendQueue.length = 0;
  state.unsafeCalls.length = 0;
});

describe("checkGenerationAllowance", () => {
  test("null plan → 402 subscribe", async () => {
    state.plan = null;
    const r = await checkGenerationAllowance("u", "e@x.com", ["resume"]);
    expect(r).toEqual({ ok: false, status: 402, error: expect.stringContaining("Subscribe") });
  });

  test("29/30 on Standard → allowed", async () => {
    state.plan = "standard";
    state.spendQueue = [29];
    const r = await checkGenerationAllowance("u", "e@x.com", ["resume"]);
    expect(r).toEqual({ ok: true, plan: "standard" });
  });

  test("30/30 on Standard → 429 naming used/limit and tier", async () => {
    state.plan = "standard";
    state.spendQueue = [30];
    const r = await checkGenerationAllowance("u", "e@x.com", ["resume"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.error).toContain("30/30");
      expect(r.error).toContain("Standard");
      expect(r.error).toContain("résumé");
    }
  });

  test("prepare dual-kind blocks if EITHER is exhausted", async () => {
    state.plan = "pro";
    state.spendQueue = [10, 100]; // resume ok (10/100), cover exhausted (100/100)
    const r = await checkGenerationAllowance("u", "e@x.com", ["resume", "cover"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.error).toContain("cover letter");
      expect(r.error).toContain("100/100");
      expect(r.error).toContain("Pro");
    }
  });

  test("pro allows premium-tier volumes", async () => {
    state.plan = "pro";
    state.spendQueue = [50, 50];
    const r = await checkGenerationAllowance("u", "e@x.com", ["resume", "cover"]);
    expect(r).toEqual({ ok: true, plan: "pro" });
  });
});

describe("SQL shape", () => {
  test("monthlyGenerationSpend sums over the current UTC month only", async () => {
    const tx = {
      unsafe: (text: string, params: unknown[]) => {
        state.unsafeCalls.push({ text, params });
        return Promise.resolve([{ n: 3 }]);
      },
    };
    const n = await monthlyGenerationSpend(tx as never, "u", "resume");
    expect(n).toBe(3);
    const call = state.unsafeCalls.at(-1)!;
    // Month-rollover correctness: last month's rows are excluded by the >= month-start
    // clause, keyed on the same UTC clock the reviewer uses.
    expect(call.text).toContain("date_trunc('month'");
    expect(call.text).toContain("AT TIME ZONE 'utc'");
    expect(call.params).toEqual(["u", "resume"]);
  });

  test("chargeGeneration upserts +1 on today's UTC row", async () => {
    const tx = {
      unsafe: (text: string, params: unknown[]) => {
        state.unsafeCalls.push({ text, params });
        return Promise.resolve([]);
      },
    };
    await chargeGeneration(tx as never, "u", "cover");
    const call = state.unsafeCalls.at(-1)!;
    expect(call.text).toContain("INSERT INTO usage_counters");
    expect(call.text).toContain("n = usage_counters.n + 1");
    expect(call.params).toEqual(["u", "cover"]);
  });

  test("chargeGenerations charges each kind once", async () => {
    await chargeGenerations("u", ["resume", "cover"]);
    const inserts = state.unsafeCalls.filter((c) => c.text.includes("INSERT INTO usage_counters"));
    expect(inserts).toHaveLength(2);
    expect(inserts.map((c) => c.params[1])).toEqual(["resume", "cover"]);
  });
});
