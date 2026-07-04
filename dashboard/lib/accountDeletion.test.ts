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
  subRow: [
    {
      stripe_subscription_id: "sub_1" as string | null,
      stripe_customer_id: "cus_1" as string | null,
      status: "active" as string | null,
    },
  ],
  authError: null as { status?: number; message?: string } | null,
  storageListError: false,
  storageRemoveError: false,
  storageObjects: [] as string[],
  removedPaths: [] as string[],
  listOffsets: [] as number[],
  stripeCalledWith: [] as (string | null)[],
  stripeCustomerDeletedWith: [] as (string | null)[],
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
  deleteCustomerIfPresent: vi.fn(async (id: string | null | undefined) => {
    s.stripeCustomerDeletedWith.push(id ?? null);
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: async (_prefix: string, opts?: { limit?: number; offset?: number }) => {
          const offset = opts?.offset ?? 0;
          const limit = opts?.limit ?? 100;
          if (offset === 0) s.order.push("storage"); // once per sweep, not once per page
          s.listOffsets.push(offset);
          if (s.storageListError) return { data: null, error: { message: "list failed" } };
          const page = s.storageObjects.slice(offset, offset + limit).map((name) => ({ name }));
          return { data: page, error: null };
        },
        remove: async (paths: string[]) => {
          s.removedPaths.push(...paths);
          if (s.storageRemoveError) return { error: { message: "remove failed" } };
          return { error: null };
        },
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
const { cancelSubscriptionIfPresent, deleteCustomerIfPresent } = await import("@/lib/stripe");
const { sanitizeUploadFilename, resumeObjectPath } = await import("@/lib/resumeStorage");

beforeEach(() => {
  s.order = [];
  s.txSql = [];
  s.subRow = [{ stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", status: "active" }];
  s.authError = null;
  s.storageListError = false;
  s.storageRemoveError = false;
  s.storageObjects = [];
  s.removedPaths = [];
  s.listOffsets = [];
  s.stripeCalledWith = [];
  s.stripeCustomerDeletedWith = [];
  vi.mocked(cancelSubscriptionIfPresent).mockClear();
  vi.mocked(deleteCustomerIfPresent).mockClear();
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
  test("skips the cancel API call when the mirror already says canceled", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", status: "canceled" }];
    await cancelStripeForUser("user-a");
    // The mirror keeps canceled subs (id intact) — we must NOT double-cancel.
    expect(cancelSubscriptionIfPresent).not.toHaveBeenCalled();
    // …but the PII customer is NOT gone just because the sub is canceled — delete it.
    expect(s.stripeCustomerDeletedWith).toEqual(["cus_1"]);
  });

  test("cancels when the subscription is still active", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", status: "active" }];
    await cancelStripeForUser("user-a");
    expect(s.stripeCalledWith).toEqual(["sub_1"]);
  });

  test("M-STRIPE-CUSTOMER: deletes the Stripe customer (erases email/name PII)", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", status: "active" }];
    await cancelStripeForUser("user-a");
    // Deleting the customer happens BEFORE step 2 destroys the only id→customer mapping.
    expect(s.stripeCustomerDeletedWith).toEqual(["cus_1"]);
  });

  test("no subscription row → passes null to both (no-op)", async () => {
    s.subRow = [];
    await cancelStripeForUser("user-a");
    expect(s.stripeCalledWith).toEqual([null]);
    expect(s.stripeCustomerDeletedWith).toEqual([null]);
  });

  test("a canceled sub with no customer id → still a clean no-op", async () => {
    s.subRow = [{ stripe_subscription_id: "sub_1", stripe_customer_id: null, status: "canceled" }];
    await cancelStripeForUser("user-a");
    expect(cancelSubscriptionIfPresent).not.toHaveBeenCalled();
    expect(s.stripeCustomerDeletedWith).toEqual([null]);
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

  test("a retry converges: deleteAccount succeeds with no subscription + already-deleted auth user", async () => {
    s.subRow = [{ stripe_subscription_id: null, stripe_customer_id: null, status: null }];
    s.authError = { status: 404, message: "not found" };
    await expect(deleteAccount("user-a", "a@x.com")).resolves.toBeUndefined();
    expect(s.order).toEqual(["stripe", "db", "storage", "auth"]);
  });
});

// ── Fail-closed résumé sweep (M-STORAGE-DELETE) ──────────────────────────────
describe("deleteStorageObjects", () => {
  test("removes every listed object under {userId}/", async () => {
    s.storageObjects = ["123-a.pdf", "456-b.pdf"];
    await deleteStorageObjects("user-a");
    expect(s.removedPaths).toEqual(["user-a/123-a.pdf", "user-a/456-b.pdf"]);
  });

  test("empty bucket → no remove call (already gone)", async () => {
    s.storageObjects = [];
    await deleteStorageObjects("user-a");
    expect(s.removedPaths).toEqual([]);
  });

  test("THROWS on a list error — must not report success while PDFs may survive", async () => {
    s.storageListError = true;
    await expect(deleteStorageObjects("user-a")).rejects.toThrow(/storage list failed/);
  });

  test("THROWS on a remove error so the idempotent cascade retries", async () => {
    s.storageObjects = ["123-a.pdf"];
    s.storageRemoveError = true;
    await expect(deleteStorageObjects("user-a")).rejects.toThrow(/storage remove failed/);
  });

  test("a remove failure fails the whole cascade (no false 'deleted')", async () => {
    s.storageObjects = ["123-a.pdf"];
    s.storageRemoveError = true;
    await expect(deleteAccount("user-a", "a@x.com")).rejects.toThrow(/storage remove failed/);
    // Order proves it threw AT storage — auth (step 4) never ran.
    expect(s.order).toEqual(["stripe", "db", "storage"]);
  });

  test("paginates the list — enumerates every page, not just the first 100", async () => {
    s.storageObjects = Array.from({ length: 250 }, (_, i) => `f${i}.pdf`);
    await deleteStorageObjects("user-a");
    expect(s.removedPaths).toHaveLength(250);
    // offset 200 returns 50 (< page size) → last page, loop stops without a 4th request
    expect(s.listOffsets).toEqual([0, 100, 200]);
  });
});

// ── Filename hardening (M-STORAGE-DELETE evasion) ────────────────────────────
describe("sanitizeUploadFilename", () => {
  test("strips a '/' so a crafted name can't nest an object past the sweep", () => {
    expect(sanitizeUploadFilename("a/b/evil.pdf")).toBe("evil.pdf");
    expect(sanitizeUploadFilename("a\\b\\evil.pdf")).toBe("evil.pdf");
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    for (const out of ["a/b.pdf", "x\\y.pdf", "../z"].map(sanitizeUploadFilename)) {
      expect(out).not.toMatch(/[/\\]/);
    }
  });

  test("keeps an ordinary filename and never yields an empty key", () => {
    expect(sanitizeUploadFilename("resume.pdf")).toBe("resume.pdf");
    expect(sanitizeUploadFilename("/")).toBe("resume.pdf");
    expect(sanitizeUploadFilename("")).toBe("resume.pdf");
  });

  test("resumeObjectPath yields a flat, sweep-enumerable key", () => {
    const p = resumeObjectPath("user-a", "sub/dir/cv.pdf");
    expect(p).toMatch(/^user-a\/\d+-cv\.pdf$/);
    // exactly one '/' separating the userId prefix from the flat object name
    expect(p.split("/")).toHaveLength(2);
  });
});
