import { describe, expect, test, beforeEach, vi } from "vitest";

// Mock the db `sql` tagged-template AND its `.begin` transaction helper. Each
// tagged call records {strings, values} and resolves the next staged result; a
// staged Error rejects (to model a unique-violation on the redemptions insert).
vi.mock("@/lib/db", () => {
  const calls: { strings: readonly string[]; values: unknown[] }[] = [];
  const queue: unknown[] = [];
  const sql = ((strings: readonly string[], ...values: unknown[]) => {
    calls.push({ strings, values });
    const next = queue.length ? queue.shift() : [];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as unknown as {
    (strings: readonly string[], ...values: unknown[]): Promise<unknown>;
    begin: (cb: (tx: unknown) => unknown) => Promise<unknown>;
    __calls: typeof calls;
    __queue: unknown[];
  };
  sql.begin = async (cb) => cb(sql);
  sql.__calls = calls;
  sql.__queue = queue;
  return { sql };
});

import { sql } from "@/lib/db";
import { redeemInvite, isInvitedUser } from "@/lib/invites";

const calls = (sql as unknown as { __calls: { strings: readonly string[]; values: unknown[] }[] }).__calls;
const queue = (sql as unknown as { __queue: unknown[] }).__queue;
const stage = (...rows: unknown[]) => queue.push(...rows);
const text = () => calls.map((c) => c.strings.join(" ")).join(" | ").toLowerCase();

beforeEach(() => {
  calls.length = 0;
  queue.length = 0;
});

describe("redeemInvite", () => {
  test("rejects an empty code without touching the DB", async () => {
    const r = await redeemInvite("   ", "a@b.com");
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("succeeds when the code UPDATE applies, then inserts the redemption", async () => {
    stage([{ code: "FOUNDER-01" }], []); // UPDATE returns a row, INSERT returns []
    const r = await redeemInvite("FOUNDER-01", "New@Example.com ");
    expect(r).toEqual({ ok: true });
    // The guard predicate lives in the UPDATE: uses < max_uses AND not-expired.
    expect(text()).toContain("uses < max_uses");
    expect(text()).toContain("expires_at");
    // Email is normalized (trim + lowercase) before it hits the redemption row.
    expect(calls.some((c) => c.values.includes("new@example.com"))).toBe(true);
  });

  test("fails (invalid/exhausted/expired) when the UPDATE matches no row", async () => {
    stage([]); // UPDATE returns nothing → the uses<max_uses / expiry guard blocked it
    const r = await redeemInvite("USED-UP", "a@b.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/invalid|expired|used/i);
    // No INSERT attempted after a failed UPDATE.
    expect(calls).toHaveLength(1);
  });

  test("reports already-redeemed on a duplicate-email unique violation", async () => {
    const dup = Object.assign(new Error("duplicate key"), { code: "23505" });
    stage([{ code: "C" }], dup); // UPDATE ok, INSERT violates the email PK
    const r = await redeemInvite("C", "a@b.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/already/i);
  });
});

describe("isInvitedUser", () => {
  test("true when a redemption row exists for the (normalized) email", async () => {
    stage([{ "?column?": 1 }]);
    expect(await isInvitedUser("Person@Example.com")).toBe(true);
    expect(text()).toContain("invite_redemptions");
    expect(calls[0].values).toContain("person@example.com");
  });

  test("false when no redemption row exists", async () => {
    stage([]);
    expect(await isInvitedUser("nobody@example.com")).toBe(false);
  });

  test("false for an empty email without querying", async () => {
    expect(await isInvitedUser("   ")).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
