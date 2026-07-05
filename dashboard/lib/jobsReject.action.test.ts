import { beforeEach, describe, expect, test, vi } from "vitest";

// Introspect the tagged-template SQL: capture the literal fragments (joined) and the
// bound values. requireUserId is a boundary; the userId it returns is what scopes every
// write, so we assert it is bound (never caller-supplied input). The SaaS cutover moved
// writes from a raw `sql` export to withUserSql(userId, tx => tx`...`) (RLS-scoped) and
// added assertNotDeleted(userId) at the top of both actions (stale-JWT resurrection
// guard) — so the mock now captures the tx handed to the withUserSql callback.
const calls: { text: string; values: unknown[] }[] = [];
const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), assertNotDeleted: vi.fn(), withUserSql: vi.fn() }));

const tx = (strings: readonly string[], ...values: unknown[]) => {
  calls.push({ text: strings.join("?"), values });
  return Promise.resolve([]);
};

vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));
vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));

import { rejectJob, unrejectJob } from "@/app/actions/jobs";

const USER = "9ae8b777-7c24-4290-8aad-bd2b10eff23b";

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue(USER);
  mocks.assertNotDeleted.mockResolvedValue(undefined);
  // Run the real callback against the capturing tx so SQL shape + tenant scoping are exercised.
  mocks.withUserSql.mockImplementation((_uid: string, fn: (t: typeof tx) => unknown) => fn(tx));
});

describe("rejectJob", () => {
  test("upserts a sticky human-override deny scoped to the authed user", async () => {
    await rejectJob("greenhouse:acme:1");
    expect(mocks.requireUserId).toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    const { text, values } = calls[0];
    expect(text).toContain("INSERT INTO job_reviews");
    expect(text).toContain("ON CONFLICT");
    expect(text).toContain("'deny'");
    expect(text).toContain("human_override = TRUE");
    // Exactly the authed user + the job id are bound — nothing caller-controlled
    // determines the user scope.
    expect(values).toEqual([USER, "greenhouse:acme:1"]);
  });

  test("scopes the transaction to the AUTHED user id (RLS context), not caller input", async () => {
    await rejectJob("greenhouse:acme:1");
    expect(mocks.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
  });

  test("asserts the account is not tombstoned BEFORE any SQL runs", async () => {
    await rejectJob("greenhouse:acme:1");
    expect(mocks.assertNotDeleted).toHaveBeenCalledWith(USER);
    const assertOrder = mocks.assertNotDeleted.mock.invocationCallOrder[0];
    const sqlOrder = mocks.withUserSql.mock.invocationCallOrder[0];
    expect(assertOrder).toBeLessThan(sqlOrder);
  });

  test("a tombstoned account cannot resurrect a reject via a stale JWT (no SQL)", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
    await expect(rejectJob("greenhouse:acme:1")).rejects.toThrow("account has been deleted");
    expect(mocks.withUserSql).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});

describe("unrejectJob", () => {
  test("is a non-destructive UPDATE guarded by human_override = TRUE", async () => {
    await unrejectJob("greenhouse:acme:1", "approve");
    const { text, values } = calls[0];
    expect(text).toContain("UPDATE job_reviews");
    // The safety contract: it must NEVER delete (that would drop stage1_decision)...
    expect(text.toLowerCase()).not.toContain("delete");
    // ...and must only touch rows THIS feature rejected.
    expect(text).toContain("human_override = TRUE");
    expect(values).toEqual(["approve", USER, "greenhouse:acme:1"]);
  });

  test("restore-to-unreviewed binds a null prior verdict", async () => {
    await unrejectJob("greenhouse:acme:1", null);
    expect(calls[0].values).toEqual([null, USER, "greenhouse:acme:1"]);
  });

  test("enforces auth before touching sql", async () => {
    mocks.requireUserId.mockRejectedValue(new Error("no session"));
    await expect(unrejectJob("j", null)).rejects.toThrow("no session");
    expect(calls).toHaveLength(0);
  });

  test("a tombstoned account cannot resurrect an unreject (no SQL)", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
    await expect(unrejectJob("j", "approve")).rejects.toThrow("account has been deleted");
    expect(mocks.withUserSql).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});
