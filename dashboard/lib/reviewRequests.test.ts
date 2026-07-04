import { beforeEach, describe, expect, test, vi } from "vitest";

// Records queries and lets each test stage rows / throw a 23505. The tx executor is
// what withUserSql hands the callback.
const state = vi.hoisted(() => ({
  calls: [] as { text: string; values: unknown[] }[],
  rowQueue: [] as unknown[][],
  throwOnInsert: false,
}));

function tx(strings: readonly string[], ...values: unknown[]) {
  const text = strings.join(" ");
  state.calls.push({ text, values });
  if (state.throwOnInsert && /INSERT INTO review_requests/.test(text)) {
    const err = new Error("duplicate") as Error & { code: string };
    err.code = "23505";
    return Promise.reject(err);
  }
  return Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);
}
tx.unsafe = (_text: string, _params: unknown[]) =>
  Promise.resolve(state.rowQueue.length ? state.rowQueue.shift() : []);

vi.mock("@/lib/db", () => ({
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
}));

import {
  enqueueReviewRequest, getLatestReviewRequest, remainingDailyBudget, reviewsChargedToday,
} from "@/lib/reviewRequests";

beforeEach(() => {
  state.calls.length = 0;
  state.rowQueue.length = 0;
  state.throwOnInsert = false;
});

describe("enqueueReviewRequest", () => {
  test("inserts a pending row and reports existing=false", async () => {
    state.rowQueue.push([{ status: "pending" }]);
    const r = await enqueueReviewRequest("u");
    expect(r).toEqual({ status: "pending", existing: false });
    expect(state.calls[0].text).toContain("INSERT INTO review_requests");
  });

  test("maps the partial-unique 23505 to idempotent success (existing active request)", async () => {
    state.throwOnInsert = true;
    // After the failed INSERT, the active-request lookup returns a running row.
    state.rowQueue.push([{ status: "running" }]);
    const r = await enqueueReviewRequest("u");
    expect(r).toEqual({ status: "running", existing: true });
    // The active-request SELECT ran after the aborted insert.
    expect(state.calls.some((c) => c.text.includes("status IN ('pending','running')"))).toBe(true);
  });
});

describe("getLatestReviewRequest", () => {
  test("returns the newest row or null", async () => {
    state.rowQueue.push([{ id: 5, status: "done" }]);
    expect(await getLatestReviewRequest("u")).toMatchObject({ id: 5, status: "done" });
    expect(await getLatestReviewRequest("u")).toBeNull(); // empty queue → []
  });
});

describe("remainingDailyBudget", () => {
  test("null plan → 0 without touching the DB", async () => {
    expect(await remainingDailyBudget("u", null)).toBe(0);
    expect(state.calls).toHaveLength(0);
  });

  test("cap minus today's review spend, floored at 0", async () => {
    // profile row (no override, cheap stage-2) then today's spend = 380.
    state.rowQueue.push([{ model_stage2: null, daily_review_cap: null }]);
    tx.unsafe = () => Promise.resolve([{ n: 380 }]);
    // standard cheap cap = 400 → 400 - 380 = 20
    expect(await remainingDailyBudget("u", "standard")).toBe(20);
  });

  test("honors a per-profile daily_review_cap override", async () => {
    state.rowQueue.push([{ model_stage2: null, daily_review_cap: 50 }]);
    tx.unsafe = () => Promise.resolve([{ n: 10 }]);
    expect(await remainingDailyBudget("u", "pro")).toBe(40);
  });

  test("spent beyond cap floors at 0", async () => {
    state.rowQueue.push([{ model_stage2: null, daily_review_cap: null }]);
    tx.unsafe = () => Promise.resolve([{ n: 999 }]);
    expect(await remainingDailyBudget("u", "standard")).toBe(0);
  });
});

describe("reviewsChargedToday", () => {
  test("returns today's review usage count (progress figure)", async () => {
    tx.unsafe = () => Promise.resolve([{ n: 42 }]);
    expect(await reviewsChargedToday("u")).toBe(42);
  });
  test("no counter row → 0", async () => {
    tx.unsafe = () => Promise.resolve([]);
    expect(await reviewsChargedToday("u")).toBe(0);
  });
});
