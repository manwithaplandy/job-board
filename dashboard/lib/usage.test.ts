import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  plan: null as string | null,
  spendQueue: [] as number[], // successive monthlyGenerationSpend results
  unsafeCalls: [] as { text: string; params: unknown[]; via?: "service" }[],
}));

vi.mock("@/lib/subscriptions", () => ({
  getViewerPlan: vi.fn(async () => state.plan),
}));

vi.mock("@/lib/db", () => {
  // Every write/read in the reserve path runs on the service role: reads (SUM) return
  // the next queued spend, everything else (advisory lock, INSERT, refund UPDATE) → [].
  const exec = (text: string, params: unknown[]) => {
    state.unsafeCalls.push({ text, params, via: "service" });
    if (/SELECT COALESCE\(SUM\(n\)/.test(text)) {
      const n = state.spendQueue.length ? state.spendQueue.shift()! : 0;
      return Promise.resolve([{ n }]);
    }
    return Promise.resolve([]);
  };
  const tx = { unsafe: exec };
  // reserveGenerations runs inside serviceSql.begin (one transaction); refundGenerations
  // calls serviceSql.unsafe directly. tierConfig's withAnonSql is intentionally absent —
  // loadTierConfig degrades to the compiled ENTITLEMENTS defaults, which these caps use.
  return {
    serviceSql: { unsafe: exec, begin: async (cb: (t: typeof tx) => unknown) => cb(tx) },
  };
});

import {
  reserveGenerations, refundGenerations, monthlyGenerationSpend, chargeGeneration,
} from "@/lib/usage";

beforeEach(() => {
  state.plan = null;
  state.spendQueue.length = 0;
  state.unsafeCalls.length = 0;
});

const inserts = () => state.unsafeCalls.filter((c) => c.text.includes("INSERT INTO usage_counters"));
const locks = () => state.unsafeCalls.filter((c) => /pg_advisory_xact_lock/.test(c.text));

describe("reserveGenerations (atomic reserve, minor 4)", () => {
  test("null plan → 402 subscribe, nothing charged", async () => {
    state.plan = null;
    const r = await reserveGenerations("u", "e@x.com", ["resume"]);
    expect(r).toEqual({
      ok: false,
      status: 402,
      code: "subscription_required",
      error: expect.stringContaining("Subscribe"),
    });
    expect(inserts()).toHaveLength(0);
  });

  test("29/30 on Standard → allowed and the slot is charged", async () => {
    state.plan = "standard";
    state.spendQueue = [29];
    const r = await reserveGenerations("u", "e@x.com", ["resume"]);
    expect(r).toEqual({ ok: true, plan: "standard" });
    expect(inserts()).toHaveLength(1); // reserved up front
  });

  test("30/30 on Standard → 429 naming used/limit and tier, and NOTHING charged", async () => {
    state.plan = "standard";
    state.spendQueue = [30];
    const r = await reserveGenerations("u", "e@x.com", ["resume"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      // Structured fields the client's /billing upsell keys off (lib/rolefit/tierGate.ts).
      expect(r.code).toBe("allowance_exhausted");
      if (r.status === 429) expect(r.plan).toBe("standard");
      expect(r.error).toContain("30/30");
      expect(r.error).toContain("Standard");
      expect(r.error).toContain("résumé");
    }
    // The atomicity guarantee: an exhausted reserve charges NO slot.
    expect(inserts()).toHaveLength(0);
  });

  test("dual-kind is all-or-nothing: EITHER exhausted → 429 and NEITHER charged", async () => {
    state.plan = "pro";
    state.spendQueue = [10, 100]; // resume ok (10/100), cover exhausted (100/100)
    const r = await reserveGenerations("u", "e@x.com", ["resume", "cover"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.error).toContain("cover letter");
      expect(r.error).toContain("100/100");
      expect(r.error).toContain("Pro");
    }
    expect(inserts()).toHaveLength(0); // resume was NOT charged despite being under limit
  });

  test("pro under both caps → charges BOTH kinds", async () => {
    state.plan = "pro";
    state.spendQueue = [50, 50];
    const r = await reserveGenerations("u", "e@x.com", ["resume", "cover"]);
    expect(r).toEqual({ ok: true, plan: "pro" });
    expect(inserts().map((c) => c.params[1])).toEqual(["resume", "cover"]);
  });

  test("takes a per-(user,kind) advisory lock (hashtextextended, 64-bit) before checking", async () => {
    state.plan = "standard";
    state.spendQueue = [0];
    await reserveGenerations("u", "e@x.com", ["resume"]);
    const l = locks();
    expect(l).toHaveLength(1);
    expect(l[0].text).toContain("hashtextextended");
    expect(l[0].params).toEqual(["usage:u:resume"]);
  });

  test("reserve reads + charges on the SERVICE role (B-COST — never the user's role)", async () => {
    state.plan = "standard";
    state.spendQueue = [0];
    await reserveGenerations("u", "e@x.com", ["resume"]);
    expect(state.unsafeCalls.every((c) => c.via === "service")).toBe(true);
  });
});

describe("refundGenerations", () => {
  test("decrements today's UTC row per kind, floored at 0", async () => {
    await refundGenerations("u", ["resume", "cover"]);
    const updates = state.unsafeCalls.filter((c) => c.text.includes("UPDATE usage_counters"));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.text).toContain("GREATEST(n - 1, 0)");
      expect(u.text).toContain("(now() AT TIME ZONE 'utc')::date");
    }
    expect(updates.map((c) => c.params[1])).toEqual(["resume", "cover"]);
  });
});

describe("SQL shape (helpers)", () => {
  test("monthlyGenerationSpend sums over the current UTC month only", async () => {
    const localCalls: { text: string; params: unknown[] }[] = [];
    const tx = {
      unsafe: (text: string, params: unknown[]) => {
        localCalls.push({ text, params });
        return Promise.resolve([{ n: 3 }]);
      },
    };
    const n = await monthlyGenerationSpend(tx as never, "u", "resume");
    expect(n).toBe(3);
    const call = localCalls.at(-1)!;
    expect(call.text).toContain("date_trunc('month'");
    expect(call.text).toContain("AT TIME ZONE 'utc'");
    expect(call.params).toEqual(["u", "resume"]);
  });

  test("chargeGeneration upserts +1 on today's UTC row", async () => {
    const localCalls: { text: string; params: unknown[] }[] = [];
    const tx = {
      unsafe: (text: string, params: unknown[]) => {
        localCalls.push({ text, params });
        return Promise.resolve([]);
      },
    };
    await chargeGeneration(tx as never, "u", "cover");
    const call = localCalls.at(-1)!;
    expect(call.text).toContain("INSERT INTO usage_counters");
    expect(call.text).toContain("n = usage_counters.n + 1");
    expect(call.params).toEqual(["u", "cover"]);
  });
});
