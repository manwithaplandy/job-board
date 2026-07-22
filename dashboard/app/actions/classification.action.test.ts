import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Gate + behavior contract for the admin classification actions:
//  1. launchClassificationJob / cancelClassificationJob re-gate on isAdmin FIRST —
//     BEFORE any validation or SQL — so they're safe even though they're independently
//     reachable regardless of the page gate (mirrors app/actions/companies.ts).
//  2. launch validates model ∈ CLASSIFICATION_MODELS and cap ∈ [1, 50000], stamps a
//     server-computed est_cost (live pricing → fallback → null), and inserts on
//     serviceSql.
//  3. cancel flips status='canceled' only for a pending/running job.
//
// isAdmin is left REAL (pure ADMIN_EMAILS check) — the gate under test. serviceSql is
// captured so we can assert the bound values without a DB.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  revalidatePath: vi.fn(),
  getStructuredModels: vi.fn(),
  countTargets: vi.fn(),
  serviceCalls: [] as { text: string; values: unknown[] }[],
}));

vi.mock("@/lib/auth", () => ({ getUserClaims: mocks.getUserClaims }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/openrouter", () => ({ getStructuredModels: mocks.getStructuredModels }));
// countTargets clamps est_cost to the realistic ceiling min(cap, live targets); mock it
// so the count basis is deterministic without a DB. Default is far above every test cap
// so the existing est_cost assertions exercise the un-clamped (count === cap) path.
vi.mock("@/lib/classificationJobs", () => ({ countTargets: mocks.countTargets }));
vi.mock("@/lib/db", () => ({
  serviceSql: (strings: readonly string[], ...values: unknown[]) => {
    mocks.serviceCalls.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  },
}));

import { launchClassificationJob, cancelClassificationJob } from "@/app/actions/classification";

const insertCall = () => mocks.serviceCalls.find((c) => c.text.includes("INSERT INTO classification_jobs"));
const updateCall = () => mocks.serviceCalls.find((c) => c.text.includes("UPDATE classification_jobs"));

beforeEach(() => {
  mocks.serviceCalls.length = 0;
  vi.clearAllMocks();
  mocks.getStructuredModels.mockResolvedValue([]); // empty catalog → fallback pricing path
  mocks.countTargets.mockResolvedValue({ unclassified: 1_000_000, unknownRepass: 1_000_000 });
  vi.stubEnv("ADMIN_EMAILS", "op@x.com");
});
afterEach(() => vi.unstubAllEnvs());

const admin = () => mocks.getUserClaims.mockResolvedValue({ id: "u1", email: "op@x.com" });

describe("launchClassificationJob — admin gate", () => {
  test("a signed-in NON-admin is rejected before any validation or SQL", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: "u1", email: "rando@x.com" });
    await expect(
      launchClassificationJob({ model: "google/gemini-3.5-flash-lite", cap: 100, mode: "unclassified", useSerp: false }),
    ).rejects.toThrow("not authorized");
    expect(mocks.serviceCalls).toHaveLength(0);
    expect(mocks.getStructuredModels).not.toHaveBeenCalled();
  });

  test("an anonymous caller (null claims) is rejected", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    await expect(
      launchClassificationJob({ model: "google/gemini-3.5-flash-lite", cap: 100, mode: "unclassified", useSerp: false }),
    ).rejects.toThrow("not authorized");
    expect(mocks.serviceCalls).toHaveLength(0);
  });

  test("blank ADMIN_EMAILS fails closed", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    mocks.getUserClaims.mockResolvedValue({ id: "u1", email: "op@x.com" });
    await expect(
      launchClassificationJob({ model: "google/gemini-3.5-flash-lite", cap: 100, mode: "unclassified", useSerp: false }),
    ).rejects.toThrow("not authorized");
    expect(mocks.serviceCalls).toHaveLength(0);
  });
});

describe("launchClassificationJob — validation + insert", () => {
  test("admin + valid input inserts with the bound config and a fallback-priced est_cost", async () => {
    admin();
    const res = await launchClassificationJob({
      model: "google/gemini-3.5-flash-lite", cap: 1000, mode: "unclassified", useSerp: false,
    });
    expect(res).toEqual({ ok: true });
    const ins = insertCall();
    expect(ins).toBeTruthy();
    expect(ins!.values).toContain("google/gemini-3.5-flash-lite");
    expect(ins!.values).toContain(1000);
    expect(ins!.values).toContain("unclassified");
    expect(ins!.values).toContain(false);
    // est_cost is the last bound value: 1000*(1300*0.30e-6 + 300*2.5e-6) ≈ $1.14.
    const est = ins!.values[ins!.values.length - 1] as number;
    expect(est).toBeCloseTo(1.14, 5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/classification");
  });

  test("SERP raises the stamped est_cost (≈ $2.41 for 1000)", async () => {
    admin();
    await launchClassificationJob({
      model: "google/gemini-3.5-flash-lite", cap: 1000, mode: "unclassified", useSerp: true,
    });
    const est = insertCall()!.values.at(-1) as number;
    expect(est).toBeCloseTo(2.41, 5);
    expect(insertCall()!.values).toContain(true);
  });

  test("a model with neither live nor fallback pricing stamps est_cost = null", async () => {
    admin();
    await launchClassificationJob({
      model: "deepseek/deepseek-v4-flash", cap: 500, mode: "unknown_repass", useSerp: false,
    });
    const ins = insertCall()!;
    expect(ins.values.at(-1)).toBeNull();
    expect(ins.values).toContain("unknown_repass");
  });

  test("live catalog pricing overrides the fallback table", async () => {
    admin();
    mocks.getStructuredModels.mockResolvedValue([
      { id: "google/gemini-3.5-flash-lite", name: "Flash Lite", pricing: { prompt: "0.000001", completion: "0.000001" } },
    ]);
    await launchClassificationJob({
      model: "google/gemini-3.5-flash-lite", cap: 1000, mode: "unclassified", useSerp: false,
    });
    // 1000 * (1300*1e-6 + 300*1e-6) = 1000 * 1.6e-3 = $1.60 (not the $1.14 fallback).
    const est = insertCall()!.values.at(-1) as number;
    expect(est).toBeCloseTo(1.6, 5);
  });

  test("est_cost is clamped to the live target count when the cap exceeds it", async () => {
    admin();
    // 200 unclassified targets but the operator typed a 50000 cap: the run can't exceed
    // the target count, so est_cost is priced for 200 — NOT the raw cap.
    mocks.countTargets.mockResolvedValue({ unclassified: 200, unknownRepass: 5 });
    await launchClassificationJob({
      model: "google/gemini-3.5-flash-lite", cap: 50_000, mode: "unclassified", useSerp: false,
    });
    const ins = insertCall()!;
    const perCompany = 1300 * 0.3e-6 + 300 * 2.5e-6; // ≈ $0.00114
    expect(ins.values.at(-1) as number).toBeCloseTo(200 * perCompany, 6);
    // company_cap stays the raw cap the operator typed (only est_cost is clamped).
    expect(ins.values).toContain(50_000);
  });

  test("unknown_repass mode clamps est_cost by the unknownRepass target count", async () => {
    admin();
    mocks.countTargets.mockResolvedValue({ unclassified: 10_000, unknownRepass: 3 });
    await launchClassificationJob({
      model: "google/gemini-3.5-flash-lite", cap: 500, mode: "unknown_repass", useSerp: false,
    });
    const ins = insertCall()!;
    const perCompany = 1300 * 0.3e-6 + 300 * 2.5e-6;
    expect(ins.values.at(-1) as number).toBeCloseTo(3 * perCompany, 6);
    expect(ins.values).toContain(500); // raw cap stored
    expect(ins.values).toContain("unknown_repass");
  });

  test("rejects an unknown model without touching the DB", async () => {
    admin();
    const res = await launchClassificationJob({
      model: "evil/model", cap: 100, mode: "unclassified", useSerp: false,
    });
    expect(res.ok).toBe(false);
    expect(mocks.serviceCalls).toHaveLength(0);
  });

  test("rejects a cap below 1 and above 50000", async () => {
    admin();
    for (const cap of [0, -5, 50_001, 1.5]) {
      const res = await launchClassificationJob({
        model: "google/gemini-3.5-flash-lite", cap, mode: "unclassified", useSerp: false,
      });
      expect(res.ok).toBe(false);
    }
    expect(mocks.serviceCalls).toHaveLength(0);
  });

  test("accepts the boundary caps 1 and 50000", async () => {
    admin();
    await launchClassificationJob({ model: "google/gemini-3.5-flash-lite", cap: 1, mode: "unclassified", useSerp: false });
    await launchClassificationJob({ model: "google/gemini-3.5-flash-lite", cap: 50_000, mode: "unclassified", useSerp: false });
    expect(mocks.serviceCalls.filter((c) => c.text.includes("INSERT INTO classification_jobs"))).toHaveLength(2);
  });
});

describe("cancelClassificationJob", () => {
  test("admin cancels only pending/running jobs, bound by id", async () => {
    admin();
    await cancelClassificationJob(42);
    const upd = updateCall();
    expect(upd).toBeTruthy();
    expect(upd!.text).toContain("status = 'canceled'");
    expect(upd!.text).toContain("status IN ('pending', 'running')");
    expect(upd!.values).toContain(42);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/classification");
  });

  test("a NON-admin cannot cancel (no SQL)", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: "u1", email: "rando@x.com" });
    await expect(cancelClassificationJob(42)).rejects.toThrow("not authorized");
    expect(mocks.serviceCalls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
