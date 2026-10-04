import { readFileSync } from "node:fs";
import postgres from "postgres";
import { beforeAll, afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({ cancelSubscriptionIfPresent: vi.fn(), deleteCustomerIfPresent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
const dsn = process.env.ACCOUNT_DELETION_TEST_DATABASE_URL;
const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe.skipIf(!dsn)("account deletion racing feedback — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;
  let serviceSql: ReturnType<typeof postgres>;
  let deleteUserRowsTx: typeof import("./accountDeletion").deleteUserRowsTx;
  let writeTombstone: typeof import("./accountDeletion").writeTombstone;
  beforeAll(async () => {
    const url = new URL(dsn!);
    if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/account_deletion_feedback_test") throw new Error("Refusing destructive fixture outside local account_deletion_feedback_test");
    sql = postgres(dsn!, { max: 4, prepare: false, onnotice: () => {} });
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await sql.unsafe(readFileSync("../schema.sql", "utf8"));
    vi.stubEnv("DATABASE_URL", dsn!);
    vi.stubEnv("ACCOUNT_DELETION_HASH_SECRET", "test-only-key");
    ({ serviceSql } = await import("./db"));
    ({ deleteUserRowsTx, writeTombstone } = await import("./accountDeletion"));
  });
  beforeEach(async () => { await sql`TRUNCATE feedback, account_deletions`; });
  afterAll(async () => { await serviceSql?.end(); await sql?.end(); vi.unstubAllEnvs(); });

  test("erases an in-flight submission that commits after the deletion sweep starts", async () => {
    let release!: () => void;
    let inserted!: () => void;
    const mayCommit = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { inserted = resolve; });
    const feedback = sql.begin(async tx => {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({sub: USER})}, true), set_config('role', 'authenticated', true)`;
      await tx`SELECT public.submit_feedback('issue', 'Personal feedback to erase')`;
      inserted();
      await mayCommit;
    });
    await ready;
    await writeTombstone(USER, null);
    let completed = false;
    const deletion = deleteUserRowsTx(USER, null).finally(() => { completed = true; });
    try {
      // Synchronize on actual database wait state, not an assumed scheduling delay.
      for (let attempt = 0; attempt < 200 && !completed; attempt++) {
        const waiting = await sql`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
          AND application_name = 'job-board-dashboard' AND wait_event = 'advisory'`;
        if (waiting.length) break;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    } finally { release(); }
    await Promise.all([feedback, deletion]);
    expect((await sql`SELECT count(*)::int AS n FROM feedback WHERE user_id = ${USER}`)[0].n).toBe(0);
  });

  test("rejects a submission when erasure commits before it obtains the feedback lock", async () => {
    await writeTombstone(USER, null);
    await deleteUserRowsTx(USER, null);
    await expect(sql.begin(async tx => {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({sub: USER})}, true), set_config('role', 'authenticated', true)`;
      await tx`SELECT public.submit_feedback('issue', 'Must not resurrect personal data')`;
    })).rejects.toMatchObject({ code: "42501" });
    expect((await sql`SELECT count(*)::int AS n FROM feedback WHERE user_id = ${USER}`)[0].n).toBe(0);
  });
});
