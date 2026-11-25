// Migration 17 (redesign plan Task 0.5): the agent core tables' grants, policies and
// constraints. Runs only under `npm run test:db`, in tools/lifecycle_test_db.py's
// owned throwaway Postgres. openTestDb loads schema.sql (which mirrors the migration)
// and then applies the migration file twice, so a non-idempotent statement fails here.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";

const MIGRATION = "../supabase/migrations/20261125040000_agent_core.sql";
const TABLES = ["agent_threads", "agent_messages", "agent_runs", "agent_settings"] as const;
const THREAD_A = "11111111-1111-4111-8111-111111111111";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([MIGRATION]);
});
afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  // agent_surfaces (migration 19, in schema.sql) references agent_threads.
  await db.sql`TRUNCATE agent_runs, agent_messages, agent_settings, agent_surfaces, agent_threads`;
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD_A}, ${USER_A})`;
  await db.sql`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status)
               VALUES (${THREAD_A}, 'm1', ${USER_A}, 'user', ${db.sql.json([{ type: "text", text: "hi" }])}, 'complete')`;
  await db.sql`INSERT INTO agent_runs (user_id, thread_id, kind, status)
               VALUES (${USER_A}, ${THREAD_A}, 'interactive', 'done')`;
  await db.sql`INSERT INTO agent_settings (user_id) VALUES (${USER_A})`;
});

/** Runs `fn` as the user and returns either the rows or the Postgres error code. */
async function attempt(id: string, fn: Parameters<TestDb["asUser"]>[1], role?: "authenticated" | "anon") {
  return db.asUser(id, fn, role).then(
    (rows) => ({ rows: Array.from(rows as Iterable<unknown>) }),
    (e: { code?: string }) => ({ code: e.code }),
  );
}

test("user B cannot read user A's threads, messages, runs or settings", async () => {
  for (const table of TABLES) {
    const own = await db.asUser(USER_A, (tx) => tx`SELECT user_id FROM ${tx(table)}`);
    expect(own.length, table).toBeGreaterThan(0);
    const other = await db.asUser(USER_B, (tx) => tx`SELECT user_id FROM ${tx(table)}`);
    expect(Array.from(other), table).toEqual([]);
  }
});

test("authenticated cannot write agent_runs or agent_messages directly", async () => {
  const writes = [
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) =>
      tx`INSERT INTO agent_runs (user_id, thread_id, kind, status) VALUES (${USER_A}, ${THREAD_A}, 'interactive', 'pending')`,
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) => tx`UPDATE agent_runs SET cost_micros = 0`,
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) => tx`DELETE FROM agent_runs`,
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) =>
      tx`INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status)
         VALUES (${THREAD_A}, 'm2', ${USER_A}, 'assistant', '[]'::jsonb, 'complete')`,
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) => tx`UPDATE agent_messages SET status = 'failed'`,
    (tx: Parameters<Parameters<TestDb["asUser"]>[1]>[0]) => tx`DELETE FROM agent_messages`,
  ];
  for (const write of writes) {
    expect(await attempt(USER_A, write)).toEqual({ code: "42501" });
  }
});

test("the owner can write their own threads and settings, not another user's", async () => {
  expect(await attempt(USER_A, (tx) => tx`UPDATE agent_threads SET title = 'Renamed' RETURNING id`)).toEqual({
    rows: [{ id: THREAD_A }],
  });
  expect(await attempt(USER_B, (tx) => tx`UPDATE agent_threads SET title = 'Hijack' RETURNING id`)).toEqual({ rows: [] });
  // RLS WITH CHECK refuses a row owned by someone else.
  expect(await attempt(USER_B, (tx) => tx`INSERT INTO agent_threads (user_id) VALUES (${USER_A})`)).toEqual({
    code: "42501",
  });
  // agent_settings has no DELETE grant.
  expect(await attempt(USER_A, (tx) => tx`DELETE FROM agent_settings`)).toEqual({ code: "42501" });
});

test("anon has no privilege on any of the four tables", async () => {
  for (const table of TABLES) {
    const privileges = await db.sql`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = ${table}`;
    expect(Array.from(privileges), table).toEqual([]);
    expect(await attempt(USER_A, (tx) => tx`SELECT 1 FROM ${tx(table)}`, "anon"), table).toEqual({ code: "42501" });
  }
});

test("no agent_ function can write the run ledger, message history or spend", async () => {
  // Migration 17 added no function. Migration 19 (in schema.sql since) added the four
  // audited writers for surfaces and actions; none of them may reach agent_runs,
  // agent_messages or usage_counters, whose only writer is the service role.
  const rows = await db.sql`
    SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'agent\\_%' ORDER BY p.proname`;
  expect(rows.map((r) => r.proname)).toEqual([
    "agent_log_action", "agent_mark_action_undone", "agent_save_surface", "agent_set_surface_outcome",
  ]);
  for (const r of rows) expect(r.prosrc, r.proname).not.toMatch(/agent_runs|agent_messages|usage_counters/);
});

test("an interactive run without a thread violates the CHECK; a vision run without one is accepted", async () => {
  for (const status of ["pending", "running"]) {
    await expect(
      db.sql`INSERT INTO agent_runs (user_id, kind, status) VALUES (${USER_A}, 'interactive', ${status})`,
    ).rejects.toMatchObject({ code: "23514", constraint_name: "agent_runs_interactive_has_thread" });
  }
  const rows = await db.sql`INSERT INTO agent_runs (user_id, kind, status) VALUES (${USER_A}, 'vision', 'done') RETURNING id`;
  expect(rows.length).toBe(1);
});

test("two running interactive runs on one thread violate agent_runs_one_live_turn", async () => {
  await db.sql`INSERT INTO agent_runs (user_id, thread_id, kind, status) VALUES (${USER_A}, ${THREAD_A}, 'interactive', 'running')`;
  await expect(
    db.sql`INSERT INTO agent_runs (user_id, thread_id, kind, status) VALUES (${USER_A}, ${THREAD_A}, 'interactive', 'running')`,
  ).rejects.toMatchObject({ code: "23505", constraint_name: "agent_runs_one_live_turn" });
  // A background run on the same thread is not a live turn.
  await db.sql`INSERT INTO agent_runs (user_id, thread_id, kind, status) VALUES (${USER_A}, ${THREAD_A}, 'background', 'running')`;
});

test("a thread with a live interactive turn cannot be deleted", async () => {
  await db.sql`INSERT INTO agent_runs (user_id, thread_id, kind, status) VALUES (${USER_A}, ${THREAD_A}, 'interactive', 'running')`;
  await expect(db.sql`DELETE FROM agent_threads WHERE id = ${THREAD_A}`).rejects.toMatchObject({ code: "23514" });
});

test("agent_runs.error holds a short code only", async () => {
  await expect(
    db.sql`INSERT INTO agent_runs (user_id, kind, status, error) VALUES (${USER_A}, 'eval', 'failed', ${"x".repeat(65)})`,
  ).rejects.toMatchObject({ code: "23514" });
});

test("deleting a thread removes its messages and detaches its finished runs", async () => {
  // The seeded interactive run is done, so the CHECK lets its thread go.
  await db.sql`DELETE FROM agent_threads WHERE id = ${THREAD_A}`;
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_messages`)[0].n).toBe(0);
  const runs = await db.sql`SELECT thread_id FROM agent_runs`;
  expect(Array.from(runs)).toEqual([{ thread_id: null }]);
});

test("the migration applies twice on top of schema.sql", async () => {
  // openTestDb already ran schema.sql and then the file twice; check the result once.
  const rows = await db.sql`
    SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES as unknown as string[]}) ORDER BY c.relname`;
  expect(Array.from(rows)).toEqual([...TABLES].sort().map((relname) => ({ relname, relrowsecurity: true })));
});
