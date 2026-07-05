import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake postgres client whose `begin` runs the callback with a tagged-template
// `tx` that records every query it receives, so we can assert the set_config
// preamble runs before the callback's own queries and rolls back on throw.
type Recorded = { strings: readonly string[]; values: unknown[] };

const mocks = vi.hoisted(() => {
  const recorded: Recorded[] = [];
  const makeTx = () => {
    const tx = (strings: readonly string[], ...values: unknown[]) => {
      recorded.push({ strings, values });
      return Promise.resolve([]);
    };
    return tx;
  };
  const client = {
    begin: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx())),
  };
  return { recorded, postgres: vi.fn(() => client), client };
});

vi.mock("postgres", () => ({ default: mocks.postgres }));

async function importDb() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  return import("@/lib/db");
}

describe("database client configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recorded.length = 0;
  });

  test("serviceSql uses Supabase pooler-safe settings with fail-fast timeouts", async () => {
    const mod = await importDb();
    expect(mod.serviceSql).toBe(mocks.client);
    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgresql://test:test@localhost:5432/test",
      expect.objectContaining({
        prepare: false,
        max: 3,
        idle_timeout: 20,
        connect_timeout: 5,
        max_lifetime: 300,
        connection: expect.objectContaining({
          application_name: "job-board-dashboard",
          statement_timeout: 15000,
          lock_timeout: 5000,
          idle_in_transaction_session_timeout: 15000,
        }),
      }),
    );
  });
});

describe("withUserSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recorded.length = 0;
  });

  test("runs the set_config preamble (authenticated + claims) before callback queries", async () => {
    const mod = await importDb();
    const result = await mod.withUserSql("user-123", async (tx) => {
      await tx`SELECT 1`;
      return "ok";
    });
    expect(result).toBe("ok");
    // First recorded query is the set_config preamble; the callback's SELECT follows.
    const preamble = mocks.recorded[0];
    expect(preamble.strings.join("")).toContain("set_config('request.jwt.claims'");
    expect(preamble.strings.join("")).toContain("set_config('role', 'authenticated'");
    // The userId is a BOUND parameter (JSON string), never concatenated into SQL.
    expect(preamble.values).toEqual([JSON.stringify({ sub: "user-123", role: "authenticated" })]);
    expect(mocks.recorded[1].strings.join("")).toContain("SELECT 1");
  });

  test("throws on a falsy userId rather than running privileged", async () => {
    const mod = await importDb();
    await expect(mod.withUserSql("", async () => "nope")).rejects.toThrow(/non-empty userId/);
    expect(mocks.client.begin).not.toHaveBeenCalled();
  });

  test("propagates a callback throw (postgres.js rolls back)", async () => {
    const mod = await importDb();
    await expect(
      mod.withUserSql("u", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

describe("withAnonSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recorded.length = 0;
  });

  test("sets the anon role with empty claims before callback queries", async () => {
    const mod = await importDb();
    await mod.withAnonSql(async (tx) => {
      await tx`SELECT 2`;
      return null;
    });
    const preamble = mocks.recorded[0];
    expect(preamble.strings.join("")).toContain("set_config('role', 'anon'");
    expect(preamble.values).toEqual([]); // empty-string claim is a SQL literal, not a param
    expect(mocks.recorded[1].strings.join("")).toContain("SELECT 2");
  });
});
