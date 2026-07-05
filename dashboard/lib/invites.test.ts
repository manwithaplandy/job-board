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
  return { serviceSql: sql };
});

import { serviceSql as sql } from "@/lib/db";
import {
  redeemInvite,
  isInvitedUser,
  createInvite,
  generateInviteCode,
  InviteCodeExistsError,
  listInvites,
} from "@/lib/invites";

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

// ── Admin invite minting (Feature 2) ────────────────────────────────────────

const CODE_FORMAT = /^RF-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

// A staged invite_codes row exactly as postgres.js returns it: snake_case.
const inviteRow = (over: Record<string, unknown> = {}) => ({
  code: "RF-AAAA-AAAA",
  note: null,
  max_uses: 1,
  uses: 0,
  expires_at: null,
  created_at: new Date("2026-07-04T00:00:00Z"),
  ...over,
});

describe("generateInviteCode", () => {
  test("produces RF-XXXX-XXXX from the no-ambiguity alphabet, every time", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).toMatch(CODE_FORMAT);
    }
  });

  test("does not repeat across a small sample (CSPRNG sanity)", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(seen.size).toBe(100);
  });
});

describe("createInvite", () => {
  test("auto-generates a well-formed code and inserts with defaults (max_uses=1, no expiry, no note)", async () => {
    stage([inviteRow()]);
    const created = await createInvite();
    expect(calls).toHaveLength(1);
    expect(text()).toContain("insert into invite_codes");
    expect(text()).toContain("returning");
    // Bound values, in template order: [code, note, maxUses, expiresAt].
    expect(calls[0].values[0]).toMatch(CODE_FORMAT);
    expect(calls[0].values[1]).toBeNull();
    expect(calls[0].values[2]).toBe(1);
    expect(calls[0].values[3]).toBeNull();
    // The snake_case row comes back mapped to the camelCase InviteCode shape.
    expect(created).toEqual({
      code: "RF-AAAA-AAAA",
      note: null,
      maxUses: 1,
      uses: 0,
      expiresAt: null,
      createdAt: new Date("2026-07-04T00:00:00Z"),
    });
  });

  test("respects note, maxUses, expiresAt, and a caller-supplied code", async () => {
    const expires = new Date("2026-08-01T00:00:00Z");
    stage([
      inviteRow({ code: "TEAM-2026", note: "for the team", max_uses: 5, expires_at: expires }),
    ]);
    const created = await createInvite({
      note: "for the team",
      maxUses: 5,
      expiresAt: expires,
      code: "TEAM-2026",
    });
    expect(calls[0].values).toEqual(["TEAM-2026", "for the team", 5, expires]);
    expect(created.code).toBe("TEAM-2026");
    expect(created.maxUses).toBe(5);
    expect(created.expiresAt).toEqual(expires);
  });

  test("retries auto-generation on a unique-PK collision with a FRESH code, then succeeds", async () => {
    const dup = Object.assign(new Error("duplicate key"), { code: "23505" });
    stage(dup, [inviteRow({ code: "RF-BBBB-BBBB" })]);
    const created = await createInvite();
    expect(calls).toHaveLength(2);
    expect(calls[0].values[0]).not.toBe(calls[1].values[0]); // regenerated, not re-tried
    expect(created.code).toBe("RF-BBBB-BBBB");
  });

  test("gives up after 5 colliding auto-generation attempts", async () => {
    const dup = () => Object.assign(new Error("duplicate key"), { code: "23505" });
    stage(dup(), dup(), dup(), dup(), dup());
    await expect(createInvite()).rejects.toThrow(/unique invite code/i);
    expect(calls).toHaveLength(5);
  });

  test("a custom-code collision throws InviteCodeExistsError without retrying", async () => {
    stage(Object.assign(new Error("duplicate key"), { code: "23505" }));
    await expect(createInvite({ code: "FOUNDER-01" })).rejects.toBeInstanceOf(
      InviteCodeExistsError,
    );
    expect(calls).toHaveLength(1);
  });

  test("a non-collision DB error propagates untouched (no silent retry)", async () => {
    stage(Object.assign(new Error("boom"), { code: "57014" }));
    await expect(createInvite()).rejects.toThrow("boom");
    expect(calls).toHaveLength(1);
  });
});

describe("listInvites", () => {
  test("selects all codes newest-first and maps snake_case rows to InviteCode", async () => {
    stage([
      inviteRow({ code: "RF-CCCC-DDDD", created_at: new Date("2026-07-04T12:00:00Z") }),
      inviteRow({
        code: "FOUNDER-01",
        note: "seed",
        uses: 1,
        created_at: new Date("2026-07-03T12:00:00Z"),
      }),
    ]);
    const out = await listInvites();
    expect(calls).toHaveLength(1);
    expect(text()).toContain("from invite_codes");
    expect(text()).toContain("order by created_at desc");
    expect(out).toEqual([
      {
        code: "RF-CCCC-DDDD",
        note: null,
        maxUses: 1,
        uses: 0,
        expiresAt: null,
        createdAt: new Date("2026-07-04T12:00:00Z"),
      },
      {
        code: "FOUNDER-01",
        note: "seed",
        maxUses: 1,
        uses: 1,
        expiresAt: null,
        createdAt: new Date("2026-07-03T12:00:00Z"),
      },
    ]);
  });

  test("returns [] when no codes exist", async () => {
    stage([]);
    expect(await listInvites()).toEqual([]);
  });
});
