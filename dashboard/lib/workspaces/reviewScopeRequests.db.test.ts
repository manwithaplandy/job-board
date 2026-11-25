// Migration 20 (redesign plan Task 1.9): the review_scope_requests table's grants,
// policies, constraints and one-active index, plus its account deletion. The reviewer
// code that claims and finishes requests is a later PR. Runs only under
// `npm run test:db`, in tools/lifecycle_test_db.py's owned throwaway Postgres.
// openTestDb loads schema.sql (which mirrors the migration) and then applies the
// migration file twice, so a non-idempotent statement fails here.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";
import { serviceSql } from "@/lib/db";

// deleteUserRowsTx is exercised for real below; its sibling steps' clients are not.
vi.mock("@/lib/stripe", () => ({ cancelSubscriptionIfPresent: vi.fn(), deleteCustomerIfPresent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

const MIGRATION = "../supabase/migrations/20261125093000_review_scope_requests.sql";
const STAMP = "2026-11-25T00:00:00Z";

type Tx = Parameters<Parameters<TestDb["asUser"]>[1]>[0];

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([MIGRATION]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

beforeEach(async () => {
  await db.sql`TRUNCATE review_scope_requests`;
  await db.sql`DELETE FROM account_deletions WHERE user_id IN (${USER_A}, ${USER_B})`;
});

/** Runs `fn` as the user and returns either the rows or the Postgres error code. */
async function attempt(
  id: string,
  fn: (tx: Tx) => Promise<unknown>,
  role?: "authenticated" | "anon",
): Promise<{ rows?: unknown[]; code?: string }> {
  return db.asUser(id, fn, role).then(
    (rows) => ({ rows: Array.from(rows as Iterable<unknown>) }),
    (e: { code?: string }) => ({ code: e.code }),
  );
}

/** Inserts a request as the owner connection (bypasses RLS). Returns its id. */
async function enqueueAsOwner(userId: string, jobIds: string[] = ["lever:x:1"], status = "pending") {
  const [row] = await db.sql`INSERT INTO review_scope_requests (user_id, job_ids, reason, status)
                             VALUES (${userId}, ${jobIds}, 'memo_change', ${status}) RETURNING id`;
  return row.id as string;
}

test("grants: authenticated may SELECT and INSERT only; anon has nothing", async () => {
  const rows = await db.sql`
    SELECT r.role, p.priv,
           has_table_privilege(r.role, 'public.review_scope_requests', p.priv) AS ok
    FROM (VALUES ('authenticated'), ('anon')) AS r(role),
         (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
    ORDER BY r.role, p.priv`;
  const granted = rows.filter((r) => r.ok).map((r) => `${r.role}:${r.priv}`);
  expect(granted).toEqual(["authenticated:INSERT", "authenticated:SELECT"]);
});

test("a user sees only their own requests", async () => {
  const a = await enqueueAsOwner(USER_A);
  const b = await enqueueAsOwner(USER_B);
  const asB = await attempt(USER_B, (tx) => tx`SELECT id, user_id FROM review_scope_requests`);
  expect(asB.rows).toEqual([{ id: b, user_id: USER_B }]);
  const asA = await attempt(USER_A, (tx) => tx`SELECT id FROM review_scope_requests`);
  expect(asA.rows).toEqual([{ id: a }]);
  const asAnon = await attempt(USER_A, (tx) => tx`SELECT id FROM review_scope_requests`, "anon");
  expect(asAnon.code).toBe("42501");
});

test("a user cannot update or delete a request, even their own", async () => {
  const a = await enqueueAsOwner(USER_A);
  const upd = await attempt(USER_A, (tx) => tx`UPDATE review_scope_requests SET status = 'done' WHERE id = ${a}`);
  expect(upd.code).toBe("42501");
  const del = await attempt(USER_A, (tx) => tx`DELETE FROM review_scope_requests WHERE id = ${a}`);
  expect(del.code).toBe("42501");
  expect((await db.sql`SELECT status FROM review_scope_requests WHERE id = ${a}`)[0].status).toBe("pending");
});

test("a user enqueues a fresh pending request of their own, and nothing else", async () => {
  const ok = await attempt(USER_A, (tx) => tx`
    INSERT INTO review_scope_requests (user_id, job_ids, reason) VALUES (${USER_A}, ${["lever:x:1", "lever:x:2"]}, 'memo_change')
    RETURNING status, claim_version, started_at, finished_at, notes`);
  expect(ok.rows).toEqual([{ status: "pending", claim_version: "0", started_at: null, finished_at: null, notes: null }]);
  await db.sql`UPDATE review_scope_requests SET status = 'done' WHERE user_id = ${USER_A}`;

  const refused: Array<[string, (tx: Tx) => Promise<unknown>]> = [
    ["another user's row", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids) VALUES (${USER_B}, ${["j"]})`],
    ["running", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, status) VALUES (${USER_A}, ${["j"]}, 'running')`],
    ["done", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, status) VALUES (${USER_A}, ${["j"]}, 'done')`],
    ["claimed", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, claim_version) VALUES (${USER_A}, ${["j"]}, 1)`],
    ["started", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, started_at) VALUES (${USER_A}, ${["j"]}, ${STAMP})`],
    ["finished", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, finished_at) VALUES (${USER_A}, ${["j"]}, ${STAMP})`],
    ["with notes", (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids, notes) VALUES (${USER_A}, ${["j"]}, 'faked')`],
  ];
  for (const [label, fn] of refused) expect((await attempt(USER_A, fn)).code, label).toBe("42501");
  expect((await db.sql`SELECT count(*)::int AS n FROM review_scope_requests`)[0].n).toBe(1);
});

test("one active (pending or running) request per user", async () => {
  await enqueueAsOwner(USER_A);
  const second = await attempt(USER_A, (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids) VALUES (${USER_A}, ${["j"]})`);
  expect(second.code).toBe("23505");
  await db.sql`UPDATE review_scope_requests SET status = 'running', claim_version = 1 WHERE user_id = ${USER_A}`;
  await expect(enqueueAsOwner(USER_A)).rejects.toMatchObject({ code: "23505" });
  // Another user is independent; a finished request frees the slot.
  await enqueueAsOwner(USER_B);
  await db.sql`UPDATE review_scope_requests SET status = 'failed', finished_at = now() WHERE user_id = ${USER_A}`;
  const again = await attempt(USER_A, (tx) => tx`INSERT INTO review_scope_requests (user_id, job_ids) VALUES (${USER_A}, ${["j"]}) RETURNING id`);
  expect(again.rows).toHaveLength(1);
});

test("job_ids holds 1 to 200 ids; reason, status and notes are checked", async () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => `lever:x:${i}`);
  await expect(enqueueAsOwner(USER_A, [])).rejects.toMatchObject({ code: "23514" });
  await expect(enqueueAsOwner(USER_A, many(201))).rejects.toMatchObject({ code: "23514" });
  await enqueueAsOwner(USER_A, many(200));
  await enqueueAsOwner(USER_B, many(1));
  await db.sql`TRUNCATE review_scope_requests`;
  await expect(db.sql`INSERT INTO review_scope_requests (user_id, job_ids, reason) VALUES (${USER_A}, ${["j"]}, 'other')`)
    .rejects.toMatchObject({ code: "23514" });
  await expect(enqueueAsOwner(USER_A, ["j"], "queued")).rejects.toMatchObject({ code: "23514" });
  await expect(db.sql`INSERT INTO review_scope_requests (user_id, job_ids, notes) VALUES (${USER_A}, ${["j"]}, ${"x".repeat(2001)})`)
    .rejects.toMatchObject({ code: "23514" });
});

test("a user cannot backdate a request; null job ids and a null reason are refused", async () => {
  const backdated = await attempt(USER_A, (tx) =>
    tx`INSERT INTO review_scope_requests (user_id, job_ids, requested_at) VALUES (${USER_A}, ${["j"]}, now() - interval '1 day') RETURNING id`,
  );
  expect(backdated.code).toBe("42501");
  await expect(db.sql`INSERT INTO review_scope_requests (user_id, job_ids) VALUES (${USER_A}, ${["j", null]})`)
    .rejects.toMatchObject({ code: "23514" });
  await expect(db.sql`INSERT INTO review_scope_requests (user_id, job_ids, reason) VALUES (${USER_A}, ${["j"]}, ${null})`)
    .rejects.toMatchObject({ code: "23502" });
  const [row] = await db.sql`INSERT INTO review_scope_requests (user_id, job_ids) VALUES (${USER_A}, ${["j"]}) RETURNING reason`;
  expect(row.reason).toBe("memo_change");
});

test("account deletion erases the caller's requests and keeps another user's", async () => {
  // Real deleteUserRowsTx (service role, lifecycle gate, USER_DELETE_TABLES order).
  vi.stubEnv("ACCOUNT_DELETION_HASH_SECRET", "test-only-key");
  const { deleteUserRowsTx } = await import("@/lib/accountDeletion");
  expect(USER_DELETE_TABLES as readonly string[]).toContain("review_scope_requests");
  await enqueueAsOwner(USER_A);
  await enqueueAsOwner(USER_B);
  await deleteUserRowsTx(USER_A, null);
  const counts = await db.sql`
    SELECT count(*) FILTER (WHERE user_id = ${USER_A})::int AS a, count(*) FILTER (WHERE user_id = ${USER_B})::int AS b
    FROM review_scope_requests`;
  expect(counts[0]).toEqual({ a: 0, b: 1 });
  vi.unstubAllEnvs();
});

test("the migration applies twice on top of schema.sql", async () => {
  // openTestDb already ran schema.sql and then the file twice; check the result once.
  const [table] = await db.sql`
    SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'review_scope_requests'`;
  expect(table.relrowsecurity).toBe(true);
  const policies = await db.sql`
    SELECT policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'review_scope_requests' ORDER BY policyname`;
  expect(policies.map((p) => [p.policyname, p.cmd])).toEqual([
    ["review_scope_requests_owner_insert", "INSERT"],
    ["review_scope_requests_owner_read", "SELECT"],
  ]);
  const indexes = await db.sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'review_scope_requests' ORDER BY indexname`;
  expect(indexes.map((i) => i.indexname)).toEqual([
    "one_active_review_scope_request", "review_scope_requests_pending_idx", "review_scope_requests_pkey",
  ]);
});
