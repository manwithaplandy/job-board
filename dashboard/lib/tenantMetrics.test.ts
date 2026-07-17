import { describe, expect, test, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("@/lib/db", () => ({
  serviceSql: { unsafe: vi.fn(async () => rows.value) },
}));

const { getTenantMetrics, BLENDED_COST_PER_REVIEW_USD } = await import("@/lib/tenantMetrics");

describe("getTenantMetrics", () => {
  test("maps rows, resolves effective plan, and computes the 30d cost proxy", async () => {
    rows.value = [
      {
        user_id: "u1", email: "a@x.com",
        plan: "pro", status: "active", current_period_end: new Date("2099-01-01"),
        invited: false,
        reviews_today: 5, reviews_30d: 1000, resume_month: 3, cover_month: 1,
        last_run_at: new Date("2026-07-03"), last_run_errors: 2,
        active_requests: 1, failed_requests: 0, profile_updated_at: new Date("2026-07-01"),
      },
      {
        // comped invitee, no subscription → effective plan 'standard'
        user_id: "u2", email: "b@x.com",
        plan: null, status: null, current_period_end: null, invited: true,
        reviews_today: 0, reviews_30d: 0, resume_month: 0, cover_month: 0,
        last_run_at: null, last_run_errors: null,
        active_requests: 0, failed_requests: 2, profile_updated_at: null,
      },
    ];
    const out = await getTenantMetrics();
    expect(out).toHaveLength(2);
    expect(out[0].plan).toBe("pro");
    expect(out[0].estCost30dUsd).toBeCloseTo(1000 * BLENDED_COST_PER_REVIEW_USD, 10);
    expect(out[0].failedRequests).toBe(0);
    // comped invitee resolves to Standard even with no subscription row
    expect(out[1].plan).toBe("standard");
    expect(out[1].estCost30dUsd).toBe(0);
  });

  test("empty result is an empty array", async () => {
    rows.value = [];
    expect(await getTenantMetrics()).toEqual([]);
  });

  test("maps invites_remaining through (null = never initialized)", async () => {
    const base = {
      plan: null, status: null, current_period_end: null, invited: false,
      reviews_today: 0, reviews_30d: 0, resume_month: 0, cover_month: 0,
      last_run_at: null, last_run_errors: null,
      active_requests: 0, failed_requests: 0, profile_updated_at: null,
    };
    rows.value = [
      { ...base, user_id: "u-1", email: "a@x.com", invites_remaining: 1 },
      { ...base, user_id: "u-2", email: "b@x.com", invites_remaining: null },
    ];
    const metrics = await getTenantMetrics();
    expect(metrics[0].invitesRemaining).toBe(1);
    expect(metrics[1].invitesRemaining).toBeNull();
  });
});

// tenantMetrics uses the RLS-bypassing serviceSql, so it must be imported ONLY from the
// admin page (which gates on isAdmin). Any other importer is a cross-tenant-leak risk.
describe("import surface", () => {
  test("only app/admin/tenants/page.tsx imports @/lib/tenantMetrics", () => {
    const ROOT = path.resolve(__dirname, "..");
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules" || entry === ".next") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
          if (/from\s+["']@\/lib\/tenantMetrics["']/.test(readFileSync(full, "utf8"))) {
            importers.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, "app"));
    walk(path.join(ROOT, "lib"));
    expect(importers.sort()).toEqual(["app/admin/tenants/page.tsx"]);
  });
});
