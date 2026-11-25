// Migration 20 (redesign plan Task 1.9): the review_scope_requests table's grants,
// policies, constraints and one-active index, plus its account deletion; then the
// dashboard side of the scoped re-review queue (lib/workspaces/reviewScope.ts and the
// memo's afterMemoChange) against the same real RLS. The reviewer's claim/finish code
// is tested in tests/test_review_scope_requests.py. Runs only under
// `npm run test:db`, in tools/lifecycle_test_db.py's owned throwaway Postgres.
// openTestDb loads schema.sql (which mirrors the migration) and then applies the
// migration file twice, so a non-idempotent statement fails here.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";
import { serviceSql } from "@/lib/db";
import { enqueueScopedReview, reviewScopeForMemoChange, SCOPE_MAX } from "@/lib/workspaces/reviewScope";
import { createMemoProposal, resolveMemoProposal, saveMemo } from "@/lib/workspaces/memo";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";

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
  await db.sql`DELETE FROM shortlist_items`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM search_memo_proposals`;
  await db.sql`DELETE FROM search_memo_versions`;
  await db.sql`DELETE FROM search_memos`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id LIKE 'lever:fixture-co:%'`;
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

// ── The dashboard side: reviewScope.ts and afterMemoChange ─────────────────────

const jid = (s: string | number) => `lever:fixture-co:${s}`;
const day = (d: number) => new Date(Date.UTC(2026, 10, 1 + d)).toISOString();

async function shortlist(user: string, job: string, state: string, updatedDay: number) {
  const reason = state === "skipped" ? "pay" : null;
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, reason_code, set_by, updated_at)
               VALUES (${user}, ${job}, ${state}, ${reason}, 'user', ${day(updatedDay)})`;
}

async function requestsOf(user: string) {
  return db.sql`SELECT job_ids, status, reason FROM review_scope_requests WHERE user_id = ${user} ORDER BY id`;
}

test("scope is shortlist minus skipped plus newest reviewed, capped at 200", async () => {
  // Shortlist: three live non-skipped rows, one skipped, one closed.
  for (const s of ["s1", "s2", "s3", "s4"]) await seedJob(db.sql, jid(s));
  await seedJob(db.sql, jid("s5"), { closed_at: STAMP });
  await shortlist(USER_A, jid("s1"), "shortlisted", 1);
  await shortlist(USER_A, jid("s2"), "later", 3);
  await shortlist(USER_A, jid("s3"), "suggested", 2);
  await shortlist(USER_A, jid("s4"), "skipped", 4);
  await shortlist(USER_A, jid("s5"), "shortlisted", 5);
  // Reviewed jobs n0..n59 (n59 newest), plus a denied, a closed and two shortlisted ones.
  for (let n = 0; n < 60; n++) {
    await seedJob(db.sql, jid(`n${n}`), { first_seen_at: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString() });
    await seedReview(db.sql, USER_A, jid(`n${n}`));
  }
  await seedJob(db.sql, jid("denied"), { first_seen_at: day(20) });
  await seedReview(db.sql, USER_A, jid("denied"), { verdict: "deny", fit_score: 10 });
  await seedJob(db.sql, jid("closed"), { first_seen_at: day(20), closed_at: STAMP });
  await seedReview(db.sql, USER_A, jid("closed"));
  await seedReview(db.sql, USER_A, jid("s1"));
  await seedReview(db.sql, USER_A, jid("s4"));
  // Another user's rows are invisible.
  await seedJob(db.sql, jid("b1"));
  await shortlist(USER_B, jid("b1"), "shortlisted", 9);
  await seedReview(db.sql, USER_B, jid("b1"));

  const newest = Array.from({ length: 50 }, (_, i) => jid(`n${59 - i}`));
  expect(await reviewScopeForMemoChange(USER_A)).toEqual([jid("s2"), jid("s3"), jid("s1"), ...newest]);
  expect(await reviewScopeForMemoChange(USER_B)).toEqual([jid("b1")]);

  // 205 shortlisted jobs: the scope stops at 200 and leaves no room for reviewed ones.
  await db.sql`INSERT INTO jobs (id, company_id, external_id, title, url)
               SELECT 'lever:fixture-co:cap-' || g, 1, 'cap-' || g, 'Role', 'https://example.test/cap/' || g
               FROM generate_series(1, 205) g`;
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, set_by, updated_at)
               SELECT ${USER_A}::uuid, id, 'shortlisted', 'user', ${day(27)}::timestamptz
               FROM jobs WHERE id LIKE 'lever:fixture-co:cap-%'`;
  const capped = await reviewScopeForMemoChange(USER_A);
  expect(capped).toHaveLength(SCOPE_MAX);
  expect(capped.every((id) => id.startsWith(jid("cap-")))).toBe(true);
});

test("enqueueScopedReview inserts as the user: queued, then already_active; an empty scope writes nothing", async () => {
  expect(await enqueueScopedReview(USER_A, [])).toBe("empty");
  expect(await requestsOf(USER_A)).toEqual([]);

  expect(await enqueueScopedReview(USER_A, [jid(1), jid(2), jid(1)])).toBe("queued");
  expect(await requestsOf(USER_A)).toEqual([{ job_ids: [jid(1), jid(2)], status: "pending", reason: "memo_change" }]);
  expect(await enqueueScopedReview(USER_A, [jid(3)])).toBe("already_active");
  expect(await requestsOf(USER_A)).toHaveLength(1);
  // Another user is independent; a finished request frees the slot.
  expect(await enqueueScopedReview(USER_B, [jid(3)])).toBe("queued");
  await db.sql`UPDATE review_scope_requests SET status = 'done', finished_at = now() WHERE user_id = ${USER_A}`;
  expect(await enqueueScopedReview(USER_A, [jid(4)])).toBe("queued");
  expect((await requestsOf(USER_A)).map((r) => r.status)).toEqual(["done", "pending"]);
});

test("approving a memo proposal enqueues exactly one scoped request", async () => {
  await seedProfile(db.sql, USER_A, { resume_text: "Résumé A" });
  await seedJob(db.sql, jid("liked"));
  await seedJob(db.sql, jid("reviewed"));
  await seedReview(db.sql, USER_A, jid("liked"));
  await seedReview(db.sql, USER_A, jid("reviewed"));
  await shortlist(USER_A, jid("liked"), "shortlisted", 1);

  const p = await createMemoProposal(USER_A, {
    proposedDoc: { ...emptyMemoDoc(), role: "Staff backend" }, rationale: "From chat", source: "interactive",
  });
  expect(await requestsOf(USER_A)).toEqual([]);
  expect(await resolveMemoProposal(USER_A, p.id, "approve")).toEqual({ version: 1 });
  expect(await requestsOf(USER_A)).toEqual([
    { job_ids: [jid("liked"), jid("reviewed")], status: "pending", reason: "memo_change" },
  ]);

  // Another change while that request is pending saves normally and adds no second one.
  expect(await saveMemo(USER_A, { ...emptyMemoDoc(), role: "Principal" }, "user")).toBe(2);
  expect(await requestsOf(USER_A)).toHaveLength(1);
});
