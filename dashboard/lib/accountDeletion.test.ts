import { describe, expect, test, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  USER_DELETE_TABLES,
  USER_ANONYMIZE_TABLES,
  USER_EXCLUDED_TABLES,
  ALL_CLASSIFIED_TABLES,
} from "@/lib/userScopedTables";

// ── Shared mock state (hoisted so the vi.mock factories can see it) ───────────
const s = vi.hoisted(() => ({
  order: [] as string[],
  txSql: [] as string[],
  subRow: [{ stripe_subscription_id: "sub_1" as string | null, status: "active" as string | null }],
  authError: null as { status?: number; message?: string } | null,
  storageListError: false,
  stripeCalledWith: [] as (string | null)[],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    unsafe: vi.fn(async (sql: string) => {
      s.txSql.push(sql);
      return [] as unknown[];
    }),
  };
  const serviceSql = Object.assign(
    vi.fn(async () => s.subRow), // tagged-template SELECT of the subscription row
    {
      begin: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
        s.order.push("db");
        return cb(tx);
      }),
    },
  );
  return { serviceSql };
});

vi.mock("@/lib/stripe", () => ({
  cancelSubscriptionIfPresent: vi.fn(async (id: string | null | undefined) => {
    s.order.push("stripe");
    s.stripeCalledWith.push(id ?? null);
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: async () => {
          s.order.push("storage");
          if (s.storageListError) return { data: null, error: { message: "list failed" } };
          return { data: [], error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    auth: {
      admin: {
        deleteUser: async () => {
          s.order.push("auth");
          return { error: s.authError };
        },
      },
    },
  }),
}));

const {
  deleteAccount, deleteAuthUser, deleteStorageObjects, deleteUserRowsTx, hashEmail,
  cancelStripeForUser,
} = await import("@/lib/accountDeletion");
const { cancelSubscriptionIfPresent } = await import("@/lib/stripe");

beforeEach(() => {
  s.order = [];
  s.txSql = [];
  s.subRow = [{ stripe_subscription_id: "sub_1", status: "active" }];
  s.authError = null;
  s.storageListError = false;
  s.stripeCalledWith = [];
  vi.mocked(cancelSubscriptionIfPresent).mockClear();
});

// ── Schema drift guard (T3 acceptance) ────────────────────────────────────────
describe("user_id table drift guard", () => {
  test("every CREATE TABLE with a user_id column is classified (delete/anonymize/excluded)", () => {
    const schema = readFileSync(path.resolve(__dirname, "..", "..", "schema.sql"), "utf8");
    const tableRe = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
    const withUserId: string[] = [];
    for (const m of schema.matchAll(tableRe)) {
      const [, name, body] = m;
      if (/\buser_id\b/.test(body)) withUserId.push(name);
    }
    // Sanity: we actually found the known user tables (guards against a broken regex).
    expect(withUserId).toContain("profiles");
    expect(withUserId).toContain("review_runs");
    for (const t of withUserId) {
      expect(
        ALL_CLASSIFIED_TABLES.has(t),
        `${t} has a user_id column but is not in USER_DELETE_TABLES / USER_ANONYMIZE_TABLES / USER_EXCLUDED_TABLES`,
      ).toBe(true);
    }
  });

  test("classification lists are disjoint", () => {
    const del = new Set<string>(USER_DELETE_TABLES);
    for (const t of USER_ANONYMIZE_TABLES) expect(del.has(t)).toBe(false);
    for (const t of Object.keys(USER_EXCLUDED_TABLES)) expect(del.has(t)).toBe(false);
  });
});

// ── hashEmail ─────────────────────────────────────────────────────────────────
describe("hashEmail", () => {
  test("hashes lowercased email; never returns plaintext", () => {
    const h = hashEmail("Jane@Example.COM");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashEmail("jane@example.com"));
    expect(h).not.toContain("jane");
  });
  test("null/empty → null", () => {
    expect(hashEmail(null)).toBeNull();
    expect(hashEmail("  ")).toBeNull();
  });
});

// ── Ordered cascade ─────────────────────────────────────────────────────────
describe("deleteAccount ordering", () => {
  test("runs stripe → db → storage → auth in that exact order", async () => {
    await deleteAccount("user-a", "a@x.com");
    expect(s.order).toEqual(["stripe", "db", "storage", "auth"]);
  });
});

describe("deleteUserRowsTx", () => {
  test("deletes every user-scoped table, anonymizes review_runs, inserts the ledger idempotently", async () => {
    await deleteUserRowsTx("user-a", "a@x.com");
    const joined = s.txSql.join("\n");
    // Every delete-list table except invite_redemptions is deleted by user_id.
    for (const t of USER_DELETE_TABLES) {
      if (t === "invite_redemptions") continue;
      expect(joined).toMatch(new RegExp(`DELETE FROM ${t} WHERE user_id`));
    }
    // invite_redemptions deleted by user_id OR email.
    expect(joined).toMatch(/DELETE FROM invite_redemptions WHERE user_id = \$1::uuid OR/);
    // review_runs anonymized, not deleted.
    expect(joined).toMatch(/UPDATE review_runs SET user_id = NULL/);
    expect(joined).not.toMatch(/DELETE FROM review_runs/);
    // Ledger insert is idempotent.
    expect(joined).toMatch(/INSERT INTO account_deletions[\s\S]*ON CONFLICT \(user_id\) DO NOTHING/);
  });
});

// ── Stripe already-gone tolerance (T3 fix) ───────────────────────────────────
describe("cancelStripeForUser", () => {
  test("skips the Stripe API call when the mirror already says canceled", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", status: "canceled" }];
    await cancelStripeForUser("user-a");
    // The mirror keeps canceled subs (id intact) — we must NOT double-cancel.
    expect(cancelSubscriptionIfPresent).not.toHaveBeenCalled();
  });

  test("cancels when the subscription is still active", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", status: "active" }];
    await cancelStripeForUser("user-a");
    expect(s.stripeCalledWith).toEqual(["sub_1"]);
  });

  test("no subscription row → passes null (no-op)", async () => {
    s.subRow = [];
    await cancelStripeForUser("user-a");
    expect(s.stripeCalledWith).toEqual([null]);
  });
});

// ── Idempotency / already-gone tolerance ─────────────────────────────────────
describe("already-gone tolerance", () => {
  test("deleteAuthUser swallows a 404 (already deleted)", async () => {
    s.authError = { status: 404, message: "User not found" };
    await expect(deleteAuthUser("user-a")).resolves.toBeUndefined();
  });

  test("deleteAuthUser rethrows a non-404 error", async () => {
    s.authError = { status: 500, message: "internal" };
    await expect(deleteAuthUser("user-a")).rejects.toBeTruthy();
  });

  test("deleteStorageObjects tolerates a list error (nothing to remove)", async () => {
    s.storageListError = true;
    await expect(deleteStorageObjects("user-a")).resolves.toBeUndefined();
  });

  test("a retry converges: deleteAccount succeeds with no subscription + already-deleted auth user", async () => {
    s.subRow = [{ stripe_subscription_id: null, status: null }];
    s.authError = { status: 404, message: "not found" };
    await expect(deleteAccount("user-a", "a@x.com")).resolves.toBeUndefined();
    expect(s.order).toEqual(["stripe", "db", "storage", "auth"]);
  });
});
