import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postgres: vi.fn(() => "sql-client"),
}));

vi.mock("postgres", () => ({
  default: mocks.postgres,
}));

describe("database client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  test("uses Supabase pooler-safe settings with fail-fast timeouts", async () => {
    const mod = await import("@/lib/db");

    expect(mod.sql).toBe("sql-client");
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
