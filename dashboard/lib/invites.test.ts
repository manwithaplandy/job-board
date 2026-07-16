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
  return { serviceSql: sql, withUserSql: async (_uid: string, cb: (tx: unknown) => unknown) => cb(sql) };
});

import { serviceSql as sql } from "@/lib/db";
import {
  redeemInvite,
  isInvitedUser,
  createInvite,
  generateInviteCode,
  InviteCodeExistsError,
  listInvites,
  createUserInvite,
  releaseUserInvite,
  getInviteAllowance,
  setInviteAllowance,
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
    // The snake_case row comes back mapped to the camelCase InviteCode shape. The
    // admin-mint RETURNING doesn't project the attribution columns, so toInviteCode
    // `?? null`-fills createdBy/recipientEmail/creatorEmail.
    expect(created).toEqual({
      code: "RF-AAAA-AAAA",
      note: null,
      maxUses: 1,
      uses: 0,
      expiresAt: null,
      createdAt: new Date("2026-07-04T00:00:00Z"),
      createdBy: null,
      recipientEmail: null,
      creatorEmail: null,
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
    expect(text()).toContain("order by ic.created_at desc"); // aliased for the profiles join
    expect(out).toEqual([
      {
        code: "RF-CCCC-DDDD",
        note: null,
        maxUses: 1,
        uses: 0,
        expiresAt: null,
        createdAt: new Date("2026-07-04T12:00:00Z"),
        createdBy: null,
        recipientEmail: null,
        creatorEmail: null,
      },
      {
        code: "FOUNDER-01",
        note: "seed",
        maxUses: 1,
        uses: 1,
        expiresAt: null,
        createdAt: new Date("2026-07-03T12:00:00Z"),
        createdBy: null,
        recipientEmail: null,
        creatorEmail: null,
      },
    ]);
  });

  test("returns [] when no codes exist", async () => {
    stage([]);
    expect(await listInvites()).toEqual([]);
  });
});

describe("createUserInvite", () => {
  test("lazy-inits the allowance, decrements atomically, mints an attributed 30-day code", async () => {
    stage(
      [],                       // INSERT … ON CONFLICT DO NOTHING (lazy-init)
      [{ remaining: 2 }],       // UPDATE … remaining - 1 … RETURNING
      [{ code: "RF-AAAA-2222", note: null, max_uses: 1, uses: 0,
         expires_at: new Date("2026-08-12"), created_at: new Date() }],
    );
    const r = await createUserInvite("u-1", { defaultAllowance: 3, recipientEmail: "friend@x.com" });
    expect(r.ok).toBe(true);
    const t = text();
    // The atomic-spend guard is in the SQL, not JS.
    expect(t).toContain("remaining > 0");
    expect(t).toContain("on conflict (user_id) do nothing");
    // Attribution + bounded lifetime ride on the insert.
    expect(t).toContain("created_by");
    expect(t).toContain("recipient_email");
    expect(t).toContain("make_interval");
    expect(calls.some((c) => c.values.includes("friend@x.com"))).toBe(true);
  });

  test("zero-row decrement → exhausted, and NO code insert happens", async () => {
    stage([], []); // lazy-init, then UPDATE matches nothing
    const r = await createUserInvite("u-1", { defaultAllowance: 3 });
    expect(r).toEqual({ ok: false, reason: "exhausted" });
    expect(text()).not.toContain("insert into invite_codes");
  });

  test("a 23505 code collision retries with a fresh code (allowance untouched by rollback)", async () => {
    const dup = Object.assign(new Error("dup"), { code: "23505" });
    stage(
      [], [{ remaining: 2 }], dup,                       // attempt 1: insert collides → tx rolls back
      [], [{ remaining: 2 }],                            // attempt 2 succeeds
      [{ code: "RF-BBBB-3333", note: null, max_uses: 1, uses: 0, expires_at: null, created_at: new Date() }],
    );
    const r = await createUserInvite("u-1", { defaultAllowance: 3 });
    expect(r.ok).toBe(true);
  });
});

describe("releaseUserInvite", () => {
  test("deletes an UNUSED own code and refunds the allowance", async () => {
    stage([{ code: "RF-AAAA-2222" }], []); // DELETE returned a row → UPDATE refund
    await releaseUserInvite("RF-AAAA-2222", "u-1");
    const t = text();
    expect(t).toContain("uses = 0");            // only an unredeemed code is refundable
    expect(t).toContain("created_by");          // only the minter's own code
    expect(t).toContain("remaining = remaining + 1");
  });
  test("a redeemed/foreign code deletes nothing and refunds nothing", async () => {
    stage([]); // DELETE matched no rows
    await releaseUserInvite("RF-AAAA-2222", "u-2");
    expect(text()).not.toContain("remaining = remaining + 1");
  });
});

describe("getInviteAllowance", () => {
  test("existing row wins", async () => {
    stage([{ remaining: 1, granted: 3 }]);
    expect(await getInviteAllowance("u-1", 5)).toEqual({ remaining: 1, granted: 3 });
  });
  test("no row → the configured default, WITHOUT creating a row", async () => {
    stage([]);
    expect(await getInviteAllowance("u-1", 5)).toEqual({ remaining: 5, granted: 5 });
    expect(text()).not.toContain("insert");
  });
});

describe("setInviteAllowance", () => {
  test("upserts remaining; granted only seeds on first insert", async () => {
    stage([]);
    await setInviteAllowance("u-1", 7);
    const t = text();
    expect(t).toContain("on conflict (user_id) do update");
    expect(t).toContain("remaining = excluded.remaining");
    // granted is NOT overwritten on update (audit value keeps the initial grant).
    expect(t).not.toContain("granted = excluded.granted");
  });
});

describe("listInvites attribution", () => {
  test("selects created_by/recipient_email and joins the creator's profile email", async () => {
    stage([]);
    await listInvites();
    const t = text();
    expect(t).toContain("created_by");
    expect(t).toContain("recipient_email");
    expect(t).toContain("left join profiles");
  });
});
