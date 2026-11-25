// The real-database vitest lane's own test (Task 0.4). Runs only under
// `npm run test:db`, inside tools/lifecycle_test_db.py's owned throwaway Postgres.
import { afterAll, beforeAll, expect, test } from "vitest";
import { openTestDb, openTestDbFrom, seedProfile, USER_A, type TestDb } from "./dbHarness";

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

test("asUser sets the claim the RLS helper reads", async () => {
  const id = await db.asUser(USER_A, async (tx) => (await tx`SELECT public.app_user_id() AS id`)[0].id);
  expect(id).toBe(USER_A);
});

test("anon role sees no profiles", async () => {
  await seedProfile(db.sql, USER_A);
  const own = await db.asUser(USER_A, (tx) => tx`SELECT user_id FROM profiles`);
  expect(own.map((r) => r.user_id)).toEqual([USER_A]);
  // anon has no grant on profiles: either the read is refused or it returns nothing.
  const anonCount = await db
    .asUser(USER_A, (tx) => tx`SELECT user_id FROM profiles`, "anon")
    .then((rows) => rows.length, () => 0);
  expect(anonCount).toBe(0);
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
