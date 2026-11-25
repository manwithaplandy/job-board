// The real-database vitest lane's own test (Task 0.4). Runs only under
// `npm run test:db`, inside tools/lifecycle_test_db.py's owned throwaway Postgres.
import { afterAll, beforeAll, expect, test } from "vitest";
import { assertHarnessDsn, openTestDb, openTestDbFrom, seedProfile, USER_A, type TestDb } from "./dbHarness";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
});

test("refuses a non-local DSN", async () => {
  await expect(openTestDbFrom("postgresql://u:p@db.example.com:5432/postgres", [])).rejects.toThrow(/Refusing/);
});

// The remaining guard cases call the guard directly, so a guard that wrongly passed
// could never reach a database.
test("refuses a DSN with no port or with port 55432", () => {
  expect(() => assertHarnessDsn("postgresql://u:p@127.0.0.1/poller_lifecycle_test")).toThrow(/Refusing.*port/);
  expect(() => assertHarnessDsn("postgresql://u:p@127.0.0.1:55432/poller_lifecycle_test")).toThrow(/Refusing.*port/);
});

test("refuses a database other than poller_lifecycle_test", () => {
  expect(() => assertHarnessDsn("postgresql://u:p@127.0.0.1:5432/postgres")).toThrow(/Refusing.*database/);
});

test("refuses any DSN when LIFECYCLE_REQUIRE_DB_TESTS is not 1", () => {
  const dsn = process.env.TEST_DATABASE_URL;
  expect(assertHarnessDsn(dsn)).toBe(dsn); // the harness DSN passes with the flag set…
  const flag = process.env.LIFECYCLE_REQUIRE_DB_TESTS;
  try {
    delete process.env.LIFECYCLE_REQUIRE_DB_TESTS;
    expect(() => assertHarnessDsn(dsn)).toThrow(/Refusing.*LIFECYCLE_REQUIRE_DB_TESTS/); // …and fails without it
  } finally {
    process.env.LIFECYCLE_REQUIRE_DB_TESTS = flag;
  }
});

test("asUser sets the claim the RLS helper reads", async () => {
  const id = await db.asUser(USER_A, async (tx) => (await tx`SELECT public.app_user_id() AS id`)[0].id);
  expect(id).toBe(USER_A);
});

test("anon role sees no profiles", async () => {
  await seedProfile(db.sql, USER_A);
  const own = await db.asUser(USER_A, (tx) => tx`SELECT user_id FROM profiles`);
  expect(own.map((r) => r.user_id)).toEqual([USER_A]);
  // A row exists, so an empty result can only mean RLS hid it. Anything else must be
  // the permission refusal itself (42501), not some unrelated error.
  const anon = await db
    .asUser(USER_A, (tx) => tx`SELECT user_id FROM profiles`, "anon")
    .then(
      (rows) => ({ rows: Array.from(rows) }),
      (e: { code?: string }) => ({ code: e.code }),
    );
  expect([{ code: "42501" }, { rows: [] }]).toContainEqual(anon);
});

test("lib/db's own pool points at the harness database", async () => {
  const { withUserSql, serviceSql } = await import("@/lib/db");
  try {
    const rows = await withUserSql(USER_A, (tx) => tx`SELECT current_database() AS name`);
    expect(rows[0].name).toBe("poller_lifecycle_test");
  } finally {
    await serviceSql.end();
  }
});
