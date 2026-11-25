// dashboard/lib/testing/dbHarness.ts
//
// The real-database test lane (Task 0.4). Used only by `*.db.test.ts` files run with
// `npm run test:db` (vitest.db.config.ts), inside the owned throwaway Postgres that
// tools/lifecycle_test_db.py starts. It is destructive: it drops and recreates the
// `public` schema, so it refuses any DSN that is not that harness database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres, { type TransactionSql } from "postgres";

/** dashboard/ — migration paths are given relative to it ("../supabase/migrations/…"). */
const DASHBOARD_DIR = fileURLToPath(new URL("../../", import.meta.url));
const SCHEMA_SQL = path.resolve(DASHBOARD_DIR, "../schema.sql");

export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export type TestDb = {
  /** Owner connection: bypasses RLS. For setup, seeding and assertions. */
  sql: postgres.Sql;
  /** Runs `fn` in a transaction as `role` with the user's JWT claims, like withUserSql. */
  asUser<T>(id: string, fn: (tx: TransactionSql) => Promise<T>, role?: "authenticated" | "anon"): Promise<T>;
  close(): Promise<void>;
};

/**
 * The three guards of the owned lane (same as lib/jobLifecycle.flow.db.test.ts):
 * the launcher's opt-in flag, a 127.0.0.1 host and the harness database name.
 * Returns the DSN when it passes; throws "Refusing …" otherwise. Shared with
 * vitest.db.config.ts so library code under test can only reach this database.
 */
export function assertHarnessDsn(dsn: string | undefined): string {
  const refuse = (why: string): never => {
    throw new Error(`Refusing to use a test database: ${why}. Run through tools/lifecycle_test_db.py.`);
  };
  if (process.env.LIFECYCLE_REQUIRE_DB_TESTS !== "1") refuse("LIFECYCLE_REQUIRE_DB_TESTS is not 1");
  if (!dsn) return refuse("TEST_DATABASE_URL is not set");
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return refuse("the DSN does not parse");
  }
  if (url.hostname !== "127.0.0.1") refuse("the host is not 127.0.0.1");
  if (url.pathname !== "/poller_lifecycle_test") refuse("the database is not poller_lifecycle_test");
  return dsn;
}

/** Opens the harness database named by TEST_DATABASE_URL. See openTestDbFrom. */
export function openTestDb(migrations: string[]): Promise<TestDb> {
  return openTestDbFrom(process.env.TEST_DATABASE_URL, migrations);
}

/**
 * Refuses a DSN that fails the guards, drops and recreates `public`, loads
 * ../schema.sql, then applies each named migration file twice (the second run proves
 * it is idempotent). Each file runs as one simple-query batch: migrations under
 * supabase/migrations/ have no BEGIN/COMMIT and open with their two SET statements.
 */
export async function openTestDbFrom(dsn: string | undefined, migrations: string[]): Promise<TestDb> {
  const safeDsn = assertHarnessDsn(dsn);
  const sql = postgres(safeDsn, { max: 4, prepare: false, onnotice: () => {} });
  try {
    // One reserved connection: schema.sql carries its own transaction control, which
    // postgres.js refuses on a pooled connection.
    const conn = await sql.reserve();
    try {
      await conn.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public");
      await conn.unsafe(readFileSync(SCHEMA_SQL, "utf8"));
      for (const file of migrations) {
        const text = readFileSync(path.resolve(DASHBOARD_DIR, file), "utf8");
        await conn.unsafe(text);
        await conn.unsafe(text);
      }
    } finally {
      conn.release();
    }
  } catch (error) {
    await sql.end();
    throw error;
  }

  return {
    sql,
    async asUser<T>(id: string, fn: (tx: TransactionSql) => Promise<T>, role: "authenticated" | "anon" = "authenticated") {
      const claims = JSON.stringify({ sub: id, role });
      return (await sql.begin(async (tx) => {
        await tx`SELECT set_config('request.jwt.claims', ${claims}, true), set_config('role', ${role}, true)`;
        return fn(tx);
      })) as T;
    },
    close: () => sql.end(),
  };
}

type Row = Record<string, postgres.ParameterOrJSON<never>>;

const FIXTURE_COMPANY_ID = 1;

/** Inserts a catalog job (and its fixture company, once). Returns the row. */
export async function seedJob(sql: postgres.Sql, id: string, overrides: Row = {}) {
  await sql`INSERT INTO companies (id, name, ats, token)
            VALUES (${FIXTURE_COMPANY_ID}, 'Fixture Co', 'lever', 'fixture-co')
            ON CONFLICT (id) DO NOTHING`;
  const row: Row = {
    id,
    company_id: FIXTURE_COMPANY_ID,
    external_id: id,
    title: `Role ${id}`,
    url: `https://example.test/jobs/${encodeURIComponent(id)}`,
    ...overrides,
  };
  return (await sql`INSERT INTO jobs ${sql(row)} RETURNING *`)[0];
}

/** Inserts a review of `jobId` for `userId` (approved, scored). Returns the row. */
export async function seedReview(sql: postgres.Sql, userId: string, jobId: string, overrides: Row = {}) {
  const row: Row = {
    user_id: userId,
    job_id: jobId,
    profile_version: "v1",
    stage1_decision: "pass",
    verdict: "approve",
    fit_score: 80,
    ...overrides,
  };
  return (await sql`INSERT INTO job_reviews ${sql(row)} RETURNING *`)[0];
}

/** Inserts a profile for `userId`. Returns the row. */
export async function seedProfile(sql: postgres.Sql, userId: string, overrides: Row = {}) {
  const row: Row = { user_id: userId, profile_version: "v1", resume_text: "Fixture résumé", ...overrides };
  return (await sql`INSERT INTO profiles ${sql(row)} RETURNING *`)[0];
}
