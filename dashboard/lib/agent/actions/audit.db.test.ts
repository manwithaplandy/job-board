// Migration 19 (redesign plan Task 1.2): agent_surfaces, agent_actions and the four
// SECURITY DEFINER functions that are their only writers. Runs only under
// `npm run test:db`, in tools/lifecycle_test_db.py's owned throwaway Postgres.
// openTestDb loads schema.sql (which mirrors both migrations 18 and 19) and then
// applies this migration file twice, so a non-idempotent statement fails here.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { openTestDb, seedJob, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { listRecentActions, logAction as libLogAction } from "@/lib/agent/actions/audit";
import { getSurface, markSurfaceFailed, saveSurface as libSaveSurface } from "@/lib/agent/surfaces/store";

// deleteUserRowsTx is exercised for real below; its sibling steps' clients are not.
vi.mock("@/lib/stripe", () => ({ cancelSubscriptionIfPresent: vi.fn(), deleteCustomerIfPresent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

const MIGRATION = "../supabase/migrations/20261125070100_agent_audit.sql";
const TABLES = ["agent_surfaces", "agent_actions"] as const;
const FUNCTIONS = [
  "agent_log_action(uuid,uuid,text,text,jsonb,jsonb,jsonb)",
  "agent_mark_action_undone(bigint)",
  "agent_save_surface(uuid,uuid,bigint,jsonb,jsonb,jsonb,text,uuid,uuid,text,bigint,bigint)",
  "agent_set_surface_outcome(uuid,text,text)",
] as const;
const THREAD_A = "11111111-1111-4111-8111-111111111111";
const THREAD_B = "22222222-2222-4222-8222-222222222222";
const RUN = "33333333-3333-4333-8333-333333333333";

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
  await db.sql`TRUNCATE agent_actions, agent_surfaces, agent_threads CASCADE`;
  await db.sql`DELETE FROM account_deletions WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD_A}, ${USER_A}), (${THREAD_B}, ${USER_B})`;
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

const logAction = (
  tx: Tx,
  a: { thread?: string | null; actor?: string; kind?: string; target?: unknown; before?: unknown; after?: unknown } = {},
) => tx`SELECT public.agent_log_action(
  ${RUN}::uuid, ${a.thread === undefined ? THREAD_A : a.thread}::uuid, ${a.actor ?? "agent"}, ${a.kind ?? "shortlist.set"},
  ${tx.json((a.target ?? { jobId: "lever:x:1" }) as never)},
  ${tx.json((a.before ?? null) as never)}, ${tx.json((a.after ?? { state: "shortlisted" }) as never)}
) AS id`;

const saveSurface = (
  tx: Tx,
  a: { thread?: string; payload?: unknown; fallback?: unknown; gathered?: unknown; outcome?: string } = {},
) => tx`SELECT public.agent_save_surface(
  ${a.thread ?? THREAD_A}::uuid, ${RUN}::uuid, ${1}::bigint, ${tx.json((a.payload ?? { blocks: [] }) as never)},
  ${a.fallback === undefined ? null : tx.json(a.fallback as never)}::jsonb, ${tx.json((a.gathered ?? { jobs: [] }) as never)},
  ${a.outcome ?? "valid"}, ${null}::uuid, ${null}::uuid, ${"model-x"}, ${1200}::bigint, ${300}::bigint
) AS id`;

test("a user cannot insert or update agent_actions or agent_surfaces directly", async () => {
  const [{ id: actionId }] = await db.asUser(USER_A, (tx) => logAction(tx));
  const [{ id: surfaceId }] = await db.asUser(USER_A, (tx) => saveSurface(tx));
  expect(actionId).toBeTruthy();
  expect(surfaceId).toBeTruthy();
  const writes = [
    (tx: Tx) => tx`INSERT INTO agent_actions (user_id, actor, kind, target_key)
                   VALUES (${USER_A}, 'agent', 'shortlist.set', '{}'::jsonb)`,
    (tx: Tx) => tx`UPDATE agent_actions SET undone_at = NULL`,
    (tx: Tx) => tx`UPDATE agent_actions SET after = '{}'::jsonb`,
    (tx: Tx) => tx`DELETE FROM agent_actions`,
    (tx: Tx) => tx`INSERT INTO agent_surfaces (user_id, thread_id, variant, payload, gathered, outcome)
                   VALUES (${USER_A}, ${THREAD_A}, 1, '{}'::jsonb, '{}'::jsonb, 'valid')`,
    (tx: Tx) => tx`UPDATE agent_surfaces SET outcome = 'repaired'`,
    (tx: Tx) => tx`DELETE FROM agent_surfaces`,
    (tx: Tx) => tx`SELECT nextval('public.agent_actions_id_seq')`,
  ];
  for (const write of writes) expect(await attempt(USER_A, write)).toEqual({ code: "42501" });
});

test("agent_log_action stamps the caller, never a supplied user", async () => {
  // No argument can carry a user id.
  const args = await db.sql`
    SELECT p.proargnames FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'agent\\_%'`;
  for (const r of args) for (const name of r.proargnames as string[]) expect(name).not.toMatch(/user/);

  const [{ id }] = await db.asUser(USER_B, (tx) => logAction(tx, { thread: THREAD_B, target: { userId: USER_A } }));
  const rows = await db.sql`SELECT user_id, run_id, thread_id, actor, kind, undone_at FROM agent_actions WHERE id = ${id}`;
  expect(Array.from(rows)).toEqual([
    { user_id: USER_B, run_id: RUN, thread_id: THREAD_B, actor: "agent", kind: "shortlist.set", undone_at: null },
  ]);
  // The row is B's alone to read.
  expect((await db.asUser(USER_A, (tx) => tx`SELECT id FROM agent_actions`)).length).toBe(0);
  expect((await db.asUser(USER_B, (tx) => tx`SELECT id FROM agent_actions`)).length).toBe(1);
  // A thread must be the caller's own; a missing thread is allowed (unattended runs).
  expect(await attempt(USER_B, (tx) => logAction(tx, { thread: THREAD_A }))).toEqual({ code: "42501" });
  expect((await attempt(USER_B, (tx) => logAction(tx, { thread: null }))).rows).toHaveLength(1);
});

test("agent_log_action validates kind and actor by the table CHECKs and caps its jsonb", async () => {
  expect(await attempt(USER_A, (tx) => logAction(tx, { kind: "document.delete" }))).toEqual({ code: "23514" });
  expect(await attempt(USER_A, (tx) => logAction(tx, { actor: "system" }))).toEqual({ code: "23514" });
  expect(await attempt(USER_A, (tx) => logAction(tx, { before: { text: "x".repeat(262_144) } }))).toEqual({
    code: "54000",
  });
  for (const kind of ["shortlist.set", "application.set_stage", "application.add_note", "analytics.set_tiles",
    "document.update_draft", "profile.set_resume"]) {
    expect((await attempt(USER_A, (tx) => logAction(tx, { kind }))).rows, kind).toHaveLength(1);
  }
});

test("agent_mark_action_undone returns false the second time", async () => {
  const [{ id }] = await db.asUser(USER_A, (tx) => logAction(tx));
  const undo = (user: string) => db.asUser(user, (tx) => tx`SELECT public.agent_mark_action_undone(${id}::bigint) AS ok`);
  // Another user's call neither succeeds nor marks it.
  expect((await undo(USER_B))[0].ok).toBe(false);
  expect((await db.sql`SELECT undone_at FROM agent_actions WHERE id = ${id}`)[0].undone_at).toBeNull();
  expect((await undo(USER_A))[0].ok).toBe(true);
  const first = (await db.sql`SELECT undone_at FROM agent_actions WHERE id = ${id}`)[0].undone_at;
  expect(first).not.toBeNull();
  expect((await undo(USER_A))[0].ok).toBe(false);
  expect((await db.sql`SELECT undone_at FROM agent_actions WHERE id = ${id}`)[0].undone_at).toEqual(first);
});

test("agent_save_surface stamps the caller on the caller's own thread", async () => {
  const [{ id }] = await db.asUser(USER_A, (tx) => saveSurface(tx, { fallback: { blocks: [{ kind: "text" }] } }));
  const rows = await db.sql`
    SELECT user_id, thread_id, run_id, variant::int AS variant, outcome, model, latency_ms::int AS latency_ms,
           output_tokens::int AS output_tokens, fallback_payload
    FROM agent_surfaces WHERE id = ${id}`;
  expect(Array.from(rows)).toEqual([{
    user_id: USER_A, thread_id: THREAD_A, run_id: RUN, variant: 1, outcome: "valid", model: "model-x",
    latency_ms: 1200, output_tokens: 300, fallback_payload: { blocks: [{ kind: "text" }] },
  }]);
  // B cannot save onto A's thread, nor read A's surface.
  expect(await attempt(USER_B, (tx) => saveSurface(tx, { thread: THREAD_A }))).toEqual({ code: "42501" });
  expect((await db.asUser(USER_B, (tx) => tx`SELECT id FROM agent_surfaces`)).length).toBe(0);
  // Unknown outcome, non-object payload.
  expect(await attempt(USER_A, (tx) => saveSurface(tx, { outcome: "great" }))).toEqual({ code: "23514" });
  expect(await attempt(USER_A, (tx) => saveSurface(tx, { payload: ["not", "an", "object"] }))).toEqual({ code: "23514" });
});

test("agent_save_surface rejects a payload over 256 kB", async () => {
  // 256 kB of JSON text is the limit; the wrapper adds a few bytes beyond the string.
  const over = { html: "x".repeat(262_144) };
  expect(await attempt(USER_A, (tx) => saveSurface(tx, { payload: over }))).toEqual({ code: "54000" });
  expect(await attempt(USER_A, (tx) => saveSurface(tx, { fallback: over }))).toEqual({ code: "54000" });
  const under = { html: "x".repeat(262_000) };
  expect((await attempt(USER_A, (tx) => saveSurface(tx, { payload: under }))).rows).toHaveLength(1);
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_surfaces`)[0].n).toBe(1);
});

test("agent_set_surface_outcome changes the caller's rows only", async () => {
  const [{ id }] = await db.asUser(USER_A, (tx) => saveSurface(tx));
  const setOutcome = (user: string, outcome: string, failure: string | null) =>
    attempt(user, (tx) => tx`SELECT public.agent_set_surface_outcome(${id}::uuid, ${outcome}, ${failure})`);
  await setOutcome(USER_B, "fallback", "forged");
  expect(Array.from(await db.sql`SELECT outcome, failure FROM agent_surfaces WHERE id = ${id}`)).toEqual([
    { outcome: "valid", failure: null },
  ]);
  await setOutcome(USER_A, "fallback", "render_error");
  expect(Array.from(await db.sql`SELECT outcome, failure FROM agent_surfaces WHERE id = ${id}`)).toEqual([
    { outcome: "fallback", failure: "render_error" },
  ]);
  expect(await setOutcome(USER_A, "exploded", null)).toEqual({ code: "23514" });
});

test("a deleted account cannot log actions or save surfaces", async () => {
  await db.sql`INSERT INTO account_deletions (user_id) VALUES (${USER_A})`;
  expect(await attempt(USER_A, (tx) => logAction(tx))).toEqual({ code: "42501" });
  expect(await attempt(USER_A, (tx) => saveSurface(tx))).toEqual({ code: "42501" });
});

test("the four functions are SECURITY DEFINER with an empty search_path, executable by authenticated only", async () => {
  for (const signature of FUNCTIONS) {
    const [row] = await db.sql`
      SELECT p.prosecdef, p.proconfig,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0) AS public_grant
      FROM pg_proc p WHERE p.oid = ${`public.${signature}`}::regprocedure`;
    expect(row, signature).toEqual({
      prosecdef: true, proconfig: ['search_path=""'], auth: true, anon: false, public_grant: false,
    });
  }
  expect(
    await attempt(USER_A, (tx) => tx`SELECT public.agent_mark_action_undone(${1}::bigint)`, "anon"),
  ).toEqual({ code: "42501" });
  // Without a signed-in user the functions refuse.
  expect(
    await db.sql.begin(async (tx) => {
      await tx`SELECT set_config('role', 'authenticated', true)`;
      return tx`SELECT public.agent_mark_action_undone(${1}::bigint)`;
    }).catch((e: { code?: string }) => e.code),
  ).toBe("42501");
});

test("anon has no privilege on either table and the owner policy is read-only", async () => {
  for (const table of TABLES) {
    const privileges = await db.sql`
      SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE grantee IN ('anon', 'authenticated') AND table_schema = 'public' AND table_name = ${table}
      ORDER BY grantee, privilege_type`;
    expect(Array.from(privileges), table).toEqual([{ grantee: "authenticated", privilege_type: "SELECT" }]);
    expect(await attempt(USER_A, (tx) => tx`SELECT 1 FROM ${tx(table)}`, "anon"), table).toEqual({ code: "42501" });
  }
  const policies = await db.sql`
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${TABLES as unknown as string[]}) ORDER BY tablename`;
  expect(Array.from(policies)).toEqual([
    { tablename: "agent_actions", policyname: "agent_actions_owner_read", cmd: "SELECT" },
    { tablename: "agent_surfaces", policyname: "agent_surfaces_owner_read", cmd: "SELECT" },
  ]);
});

test("deleting a thread removes its surfaces and keeps its audit rows", async () => {
  await db.asUser(USER_A, (tx) => saveSurface(tx));
  await db.asUser(USER_A, (tx) => logAction(tx));
  await db.sql`DELETE FROM agent_threads WHERE id = ${THREAD_A}`;
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_surfaces`)[0].n).toBe(0);
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_actions`)[0].n).toBe(1);
});

test("account deletion erases the caller's rows from all twelve phase 1 tables and keeps another user's", async () => {
  // Real deleteUserRowsTx (service role, lifecycle gate, USER_DELETE_TABLES order)
  // against the real schema: migrations 18 and 19 are both in schema.sql here.
  vi.stubEnv("ACCOUNT_DELETION_HASH_SECRET", "test-only-key");
  const { deleteUserRowsTx } = await import("@/lib/accountDeletion");
  const job = "lever:fixture-co:audit-delete";
  await db.sql`DELETE FROM jobs WHERE id = ${job}`;
  await seedJob(db.sql, job);
  const phase1 = [
    "shortlist_items", "applications", "application_events", "documents", "search_memos", "search_memo_versions",
    "search_memo_proposals", "analytics_tiles", "analytics_tile_versions", "resume_versions",
    "agent_surfaces", "agent_actions",
  ];
  for (const user of [USER_A, USER_B]) {
    const thread = user === USER_A ? THREAD_A : THREAD_B;
    const app = user === USER_A ? "44444444-4444-4444-8444-444444444444" : "55555555-5555-4555-8555-555555555555";
    const doc = user === USER_A ? "66666666-6666-4666-8666-666666666666" : "77777777-7777-4777-8777-777777777777";
    await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, set_by) VALUES (${user}, ${job}, 'later', 'user')`;
    await db.sql`INSERT INTO applications (id, user_id, job_id, stage) VALUES (${app}, ${user}, ${job}, 'applied')`;
    await db.sql`INSERT INTO application_events (user_id, application_id, kind, to_stage, actor)
                 VALUES (${user}, ${app}, 'stage', 'applied', 'user')`;
    await db.sql`INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extraction)
                 VALUES (${doc}, ${user}, 'other', 'a.txt', 'text/plain', 1, ${`${user}/doc-${doc}-a.txt`}, 'ok')`;
    await db.sql`INSERT INTO search_memos (user_id, version, doc) VALUES (${user}, 1, '{}'::jsonb)`;
    await db.sql`INSERT INTO search_memo_versions (user_id, version, doc, changed_by) VALUES (${user}, 1, '{}'::jsonb, 'user')`;
    await db.sql`INSERT INTO search_memo_proposals (user_id, base_version, proposed_doc, source)
                 VALUES (${user}, 1, '{}'::jsonb, 'background')`;
    await db.sql`INSERT INTO analytics_tiles (user_id, version, layout) VALUES (${user}, 1, '{}'::jsonb)`;
    await db.sql`INSERT INTO analytics_tile_versions (user_id, version, layout, changed_by) VALUES (${user}, 1, '{}'::jsonb, 'user')`;
    await db.sql`INSERT INTO resume_versions (user_id, version, resume_text, source) VALUES (${user}, 1, 'old', 'restore')`;
    await db.asUser(user, (tx) => saveSurface(tx, { thread }));
    await db.asUser(user, (tx) => logAction(tx, { thread }));
  }
  for (const t of phase1) expect(USER_DELETE_TABLES as readonly string[]).toContain(t);

  await deleteUserRowsTx(USER_A, null);

  for (const table of phase1) {
    const counts = await db.sql`
      SELECT count(*) FILTER (WHERE user_id = ${USER_A})::int AS a, count(*) FILTER (WHERE user_id = ${USER_B})::int AS b
      FROM ${db.sql(table)}`;
    expect(counts[0], table).toEqual({ a: 0, b: 1 });
  }
  vi.unstubAllEnvs();
});

test("the migration applies twice on top of schema.sql", async () => {
  // openTestDb already ran schema.sql and then the file twice; check the result once.
  const rows = await db.sql`
    SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES as unknown as string[]}) ORDER BY c.relname`;
  expect(Array.from(rows)).toEqual([...TABLES].sort().map((relname) => ({ relname, relrowsecurity: true })));
  const fns = await db.sql`
    SELECT p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'agent\\_%' ORDER BY 1`;
  expect(fns.map((r) => r.sig.replace(/\s+/g, ""))).toEqual([...FUNCTIONS].sort());
});

// The libraries (Task 1.2) against the real definer functions.
const ctxFor = (userId: string, threadId: string) => ({
  userId, email: null, threadId, runId: RUN, variant: 1 as const, unattended: false,
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 }, fromView: false,
});

test("logAction and listRecentActions round-trip through agent_log_action, bigint ids parsed", async () => {
  const id = await db.asUser(USER_A, (tx) => libLogAction(tx, {
    ctx: ctxFor(USER_A, THREAD_A), actor: "agent", kind: "shortlist.set",
    targetKey: { jobId: "lever:x:1" }, before: null, after: { state: "later", note: "a \"quoted\" string" },
  }));
  expect(typeof id).toBe("number");
  const [row] = await db.sql`SELECT before, after, jsonb_typeof(after) AS t FROM agent_actions WHERE id = ${id}`;
  // json text is stored as a jsonb object, not a double-encoded string; a null before is SQL NULL.
  expect(row).toEqual({ before: null, after: { state: "later", note: "a \"quoted\" string" }, t: "object" });
  const listed = await listRecentActions(USER_A);
  expect(listed).toEqual([expect.objectContaining({ id, kind: "shortlist.set", actor: "agent", undoneAt: null })]);
  expect(await listRecentActions(USER_B)).toEqual([]);
});

test("saveSurface, getSurface and markSurfaceFailed round-trip; failure is a short code", async () => {
  const id = await db.asUser(USER_A, (tx) => libSaveSurface(tx, {
    threadId: THREAD_A, runId: RUN, variant: 2, payload: { tree: {} }, fallbackPayload: { blocks: [] },
    gathered: emptyGathered(), outcome: "valid", supersedes: null, rerenderOf: null, model: "m".repeat(300),
    latencyMs: 900, outputTokens: 12,
  }));
  const surface = await getSurface(USER_A, id);
  expect(surface).toMatchObject({ id, threadId: THREAD_A, variant: 2, outcome: "valid", latencyMs: 900 });
  expect(surface?.model).toHaveLength(200);
  expect(await getSurface(USER_B, id)).toBeNull();
  expect(await markSurfaceFailed(USER_B, id, "render_error")).toBeNull();
  expect(await markSurfaceFailed(USER_A, id, `Error: boom\n at x ${"y".repeat(400)}`)).toEqual({ blocks: [] });
  expect(await getSurface(USER_A, id)).toMatchObject({ outcome: "fallback", failure: "unknown_failure" });
});
