import { beforeEach, describe, expect, test, vi } from "vitest";

// Minor 1: every MUTATING server action calls assertNotDeleted at its top, so a
// tombstoned account's stale JWT (valid ≤1h post-erasure) cannot re-insert user-keyed
// rows. This proves the guard runs BEFORE the DB write for each entry point: when the
// guard throws, withUserSql is never reached; when it passes, the write proceeds.
const state = vi.hoisted(() => ({ deleted: false }));

vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "u1",
  getUserClaims: async () => ({ id: "u1", email: null }),
}));
vi.mock("@/lib/tombstone", () => ({
  assertNotDeleted: async (_userId: string) => {
    if (state.deleted) throw new Error("account has been deleted");
  },
}));

const withUserSql = vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) => {
  // Minimal tagged-template tx that records nothing — the action's SQL result is unused.
  const tx = (..._a: unknown[]) => Promise.resolve([]);
  return fn(tx);
});
vi.mock("@/lib/db", () => ({ withUserSql, serviceSql: (..._a: unknown[]) => Promise.resolve([]) }));
vi.mock("@/lib/queries", () => ({ bareMarkerPredicate: () => "TRUE" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/lib/openrouter", () => ({ getOpenRouterCredits: async () => 0 }));

const { markApplicationApplied, unmarkApplicationApplied } = await import("@/app/actions/applications");
const { rejectJob, unrejectJob } = await import("@/app/actions/jobs");
const { setCompanyOverride } = await import("@/app/actions/companies");

// Each mutating entry point, as a no-arg thunk.
const ACTIONS: [string, () => Promise<void>][] = [
  ["markApplicationApplied", () => markApplicationApplied("j1")],
  ["unmarkApplicationApplied", () => unmarkApplicationApplied("j1")],
  ["rejectJob", () => rejectJob("j1")],
  ["unrejectJob", () => unrejectJob("j1", "approve")],
  ["setCompanyOverride", () => setCompanyOverride(1, "include")],
];

beforeEach(() => {
  state.deleted = false;
  withUserSql.mockClear();
});

describe("mutating actions honor the tombstone guard", () => {
  test.each(ACTIONS)("%s refuses a tombstoned account and never writes", async (_name, run) => {
    state.deleted = true;
    await expect(run()).rejects.toThrow(/deleted/);
    expect(withUserSql).not.toHaveBeenCalled();
  });

  test.each(ACTIONS)("%s proceeds to the DB write for a live account", async (_name, run) => {
    state.deleted = false;
    await expect(run()).resolves.toBeUndefined();
    expect(withUserSql).toHaveBeenCalledTimes(1);
  });
});
