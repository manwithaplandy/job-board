// Migration 18 (redesign plan Task 1.1): the ten workspace tables' grants, policies,
// constraints, lifecycle triggers and backfill. Runs only under `npm run test:db`, in
// tools/lifecycle_test_db.py's owned throwaway Postgres. openTestDb loads schema.sql
// (which mirrors the migration) and then applies the migration file twice, so a
// non-idempotent statement fails here.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";

const MIGRATION = "../supabase/migrations/20261125070000_agent_workspaces.sql";
const MIGRATION_TEXT = readFileSync(fileURLToPath(new URL(`../../${MIGRATION}`, import.meta.url)), "utf8");
const TABLES = [
  "shortlist_items", "applications", "application_events", "documents", "search_memos",
  "search_memo_versions", "search_memo_proposals", "analytics_tiles", "analytics_tile_versions", "resume_versions",
] as const;
const GATED = ["shortlist_items", "applications", "application_events"] as const;
const JOB_1 = "lever:fixture-co:ws-1";
const JOB_2 = "lever:fixture-co:ws-2";
const APP_A = "11111111-1111-4111-8111-111111111111";
const DOC_A = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_A = "33333333-3333-4333-8333-333333333333";

type Tx = Parameters<Parameters<TestDb["asUser"]>[1]>[0];

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([MIGRATION]);
  await seedJob(db.sql, JOB_1);
  await seedJob(db.sql, JOB_2);
});
afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.sql`TRUNCATE shortlist_items, application_events, applications, documents, search_memos,
               search_memo_versions, search_memo_proposals, analytics_tiles, analytics_tile_versions,
               resume_versions, application_packages`;
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, set_by) VALUES (${USER_A}, ${JOB_1}, 'shortlisted', 'user')`;
  await db.sql`INSERT INTO applications (id, user_id, job_id, stage) VALUES (${APP_A}, ${USER_A}, ${JOB_1}, 'applied')`;
  await db.sql`INSERT INTO application_events (user_id, application_id, kind, to_stage, actor)
               VALUES (${USER_A}, ${APP_A}, 'stage', 'applied', 'user')`;
  await db.sql`INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extraction)
               VALUES (${DOC_A}, ${USER_A}, 'resume', 'cv.pdf', 'application/pdf', 1024,
                       ${`${USER_A}/doc-${DOC_A}-cv.pdf`}, 'ok')`;
  await db.sql`INSERT INTO search_memos (user_id, version, doc) VALUES (${USER_A}, 1, ${db.sql.json({ other: "memo" })})`;
  await db.sql`INSERT INTO search_memo_versions (user_id, version, doc, changed_by)
               VALUES (${USER_A}, 1, ${db.sql.json({ other: "memo" })}, 'user')`;
  await db.sql`INSERT INTO search_memo_proposals (id, user_id, base_version, proposed_doc, source)
               VALUES (${PROPOSAL_A}, ${USER_A}, 1, ${db.sql.json({ other: "proposed" })}, 'interactive')`;
  await db.sql`INSERT INTO analytics_tiles (user_id, version, layout) VALUES (${USER_A}, 1, ${db.sql.json({ tiles: [] })})`;
  await db.sql`INSERT INTO analytics_tile_versions (user_id, version, layout, changed_by)
               VALUES (${USER_A}, 1, ${db.sql.json({ tiles: [] })}, 'agent')`;
  await db.sql`INSERT INTO resume_versions (user_id, version, resume_text, source) VALUES (${USER_A}, 1, 'older', 'upload')`;
});

/** Runs `fn` as the user and returns either the rows or the Postgres error code. */
async function attempt(id: string, fn: (tx: Tx) => Promise<unknown>, role?: "authenticated" | "anon") {
  return db.asUser(id, fn, role).then(
    (rows) => ({ rows: Array.from(rows as Iterable<unknown>) }),
    (e: { code?: string }) => ({ code: e.code }),
  );
}

/** Runs the migration file once more on its own connection, as the pipeline would. */
async function applyMigration() {
  const conn = await db.sql.reserve();
  try {
    await conn.unsafe(MIGRATION_TEXT);
  } finally {
    conn.release();
  }
}

test("each of the ten tables hides user A's rows from user B", async () => {
  for (const table of TABLES) {
    const own = await db.asUser(USER_A, (tx) => tx`SELECT user_id FROM ${tx(table)}`);
    expect(own.length, table).toBeGreaterThan(0);
    const other = await db.asUser(USER_B, (tx) => tx`SELECT user_id FROM ${tx(table)}`);
    expect(Array.from(other), table).toEqual([]);
    // On the tables B may delete from at all, a delete as B cannot reach A's rows.
    if (["shortlist_items", "applications", "documents", "search_memos", "analytics_tiles"].includes(table)) {
      expect(await attempt(USER_B, (tx) => tx`DELETE FROM ${tx(table)} RETURNING user_id`), table).toEqual({ rows: [] });
    }
  }
});

test("anon has no privilege on any of the ten tables", async () => {
  for (const table of TABLES) {
    const privileges = await db.sql`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = ${table}`;
    expect(Array.from(privileges), table).toEqual([]);
    const columns = await db.sql`
      SELECT privilege_type FROM information_schema.column_privileges
      WHERE grantee = 'anon' AND table_schema = 'public' AND table_name = ${table}`;
    expect(Array.from(columns), table).toEqual([]);
    expect(await attempt(USER_A, (tx) => tx`SELECT 1 FROM ${tx(table)}`, "anon"), table).toEqual({ code: "42501" });
  }
});

test("authenticated holds exactly the planned table privileges", async () => {
  const crud = ["DELETE", "INSERT", "SELECT", "UPDATE"];
  const expected: Record<(typeof TABLES)[number], string[]> = {
    shortlist_items: crud,
    applications: crud,
    application_events: ["INSERT", "SELECT"],
    documents: ["DELETE", "INSERT", "SELECT"],
    search_memos: crud,
    search_memo_versions: ["INSERT", "SELECT"],
    // UPDATE on search_memo_proposals is column-level only (status, resolved_at).
    search_memo_proposals: ["INSERT", "SELECT"],
    analytics_tiles: crud,
    analytics_tile_versions: ["INSERT", "SELECT"],
    resume_versions: ["INSERT", "SELECT"],
  };
  for (const table of TABLES) {
    const rows = await db.sql`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'authenticated' AND table_schema = 'public' AND table_name = ${table}
      ORDER BY privilege_type`;
    expect(rows.map((r) => r.privilege_type), table).toEqual(expected[table]);
  }
  const columnUpdates = await db.sql`
    SELECT table_name, column_name FROM information_schema.column_privileges
    WHERE grantee = 'authenticated' AND table_schema = 'public' AND privilege_type = 'UPDATE'
      AND table_name = 'search_memo_proposals'
    ORDER BY column_name`;
  expect(columnUpdates.map((r) => r.column_name)).toEqual(["resolved_at", "status"]);
  // The identity sequence is not usable directly.
  const seq = await db.sql`
    SELECT has_sequence_privilege('authenticated', 'public.application_events_id_seq', 'USAGE') AS usage`;
  expect(seq[0].usage).toBe(false);
});

test("shortlist_items, applications and application_events carry the lifecycle_pre_dml trigger", async () => {
  const rows = await db.sql`
    SELECT c.relname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'lifecycle_pre_dml' AND c.relname = ANY(${GATED as unknown as string[]})
    ORDER BY c.relname`;
  expect(rows.map((r) => r.relname)).toEqual([...GATED].sort());
  for (const r of rows) {
    expect(r.def).toContain("BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE");
    expect(r.def).toContain("FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_gate()");
  }
  // The other seven tables have no foreign key to a gated table, so no trigger.
  const others = await db.sql`
    SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'lifecycle_pre_dml'
      AND c.relname = ANY(${TABLES.filter((t) => !(GATED as readonly string[]).includes(t))})`;
  expect(Array.from(others)).toEqual([]);
});

test("a skipped shortlist row without a reason_code is rejected", async () => {
  await expect(
    db.sql`INSERT INTO shortlist_items (user_id, job_id, state, set_by) VALUES (${USER_A}, ${JOB_2}, 'skipped', 'agent')`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "shortlist_items_skip_has_reason" });
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, reason_code, set_by)
               VALUES (${USER_A}, ${JOB_2}, 'skipped', 'pay', 'agent')`;
  await expect(
    db.sql`UPDATE shortlist_items SET reason_code = NULL WHERE user_id = ${USER_A} AND job_id = ${JOB_2}`,
  ).rejects.toMatchObject({ code: "23514" });
});

test("stage closed requires closed_reason and other stages forbid it", async () => {
  await expect(
    db.sql`INSERT INTO applications (user_id, job_id, stage) VALUES (${USER_A}, ${JOB_2}, 'closed')`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "applications_closed_has_reason" });
  await expect(
    db.sql`INSERT INTO applications (user_id, job_id, stage, closed_reason)
           VALUES (${USER_A}, ${JOB_2}, 'interviewing', 'rejected')`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "applications_closed_has_reason" });
  await db.sql`INSERT INTO applications (user_id, job_id, stage, closed_reason) VALUES (${USER_A}, ${JOB_2}, 'closed', 'withdrawn')`;
});

test("a user cannot UPDATE proposed_doc on a proposal, only status and resolved_at", async () => {
  expect(
    await attempt(USER_A, (tx) => tx`UPDATE search_memo_proposals SET proposed_doc = '{"other":"forged"}'::jsonb`),
  ).toEqual({ code: "42501" });
  expect(await attempt(USER_A, (tx) => tx`UPDATE search_memo_proposals SET base_version = 0`)).toEqual({ code: "42501" });
  expect(
    await attempt(USER_A, (tx) => tx`UPDATE search_memo_proposals SET status = 'approved', resolved_at = now() RETURNING id`),
  ).toEqual({ rows: [{ id: PROPOSAL_A }] });
  // Another user's proposal is invisible to the update.
  expect(await attempt(USER_B, (tx) => tx`UPDATE search_memo_proposals SET status = 'declined' RETURNING id`)).toEqual({
    rows: [],
  });
  expect(await attempt(USER_A, (tx) => tx`DELETE FROM search_memo_proposals`)).toEqual({ code: "42501" });
});

test("an application event must name one of the caller's own applications", async () => {
  // B's event pointing at A's application passes the foreign key but not the policy.
  expect(
    await attempt(USER_B, (tx) => tx`INSERT INTO application_events (user_id, application_id, kind, note, actor)
                                     VALUES (${USER_B}, ${APP_A}, 'note', 'hijack', 'user')`),
  ).toEqual({ code: "42501" });
  expect(
    await attempt(USER_A, (tx) => tx`INSERT INTO application_events (user_id, application_id, kind, note, actor)
                                     VALUES (${USER_A}, ${APP_A}, 'note', 'Called the recruiter', 'user') RETURNING kind`),
  ).toEqual({ rows: [{ kind: "note" }] });
  // A stage event needs to_stage; a note event needs its note.
  await expect(
    db.sql`INSERT INTO application_events (user_id, application_id, kind, actor) VALUES (${USER_A}, ${APP_A}, 'stage', 'user')`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "application_events_shape" });
});

test("a document row can only point at the owner's own doc-<id>- object", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  const insert = (path: string) => (tx: Tx) =>
    tx`INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extraction)
       VALUES (${id}, ${USER_A}, 'other', 'notes.txt', 'text/plain', 10, ${path}, 'ok') RETURNING id`;
  for (const path of [
    `${USER_B}/doc-${id}-notes.txt`, // another user's folder
    `${USER_A}/doc-${DOC_A}-notes.txt`, // another document's name
    `${USER_A}/doc-${id}-a/../../${USER_B}/x`, // a nested path
    `${USER_A}/resume.pdf`, // not a document object
  ]) {
    expect(await attempt(USER_A, insert(path)), path).toEqual({ code: "23514" });
  }
  expect(await attempt(USER_A, insert(`${USER_A}/doc-${id}-notes.txt`))).toEqual({ rows: [{ id }] });
  // No UPDATE grant, so a stored path cannot be repointed.
  expect(await attempt(USER_A, (tx) => tx`UPDATE documents SET filename = 'x'`)).toEqual({ code: "42501" });
});

test("backfill creates one applied application per applied package and is idempotent", async () => {
  await db.sql`TRUNCATE application_events, applications`;
  const appliedAt = "2026-11-01T10:00:00Z";
  await db.sql`INSERT INTO application_packages (user_id, job_id, status, applied_at) VALUES
    (${USER_A}, ${JOB_1}, 'applied', ${appliedAt}),
    (${USER_A}, ${JOB_2}, 'prepared', NULL),
    (${USER_B}, ${JOB_1}, 'applied', ${appliedAt}),
    (${USER_B}, ${JOB_2}, 'applied', ${appliedAt})`;
  // B already tracks JOB_2 further along: the backfill must leave it alone.
  await db.sql`INSERT INTO applications (user_id, job_id, stage) VALUES (${USER_B}, ${JOB_2}, 'interviewing')`;

  await applyMigration();
  const apps = await db.sql`SELECT user_id, job_id, stage, created_at FROM applications ORDER BY user_id, job_id`;
  expect(apps.map((r) => [r.user_id, r.job_id, r.stage])).toEqual([
    [USER_A, JOB_1, "applied"],
    [USER_B, JOB_1, "applied"],
    [USER_B, JOB_2, "interviewing"],
  ]);
  expect(new Date(apps[0].created_at).toISOString()).toBe("2026-11-01T10:00:00.000Z");
  const events = await db.sql`
    SELECT e.user_id, a.job_id, e.kind, e.from_stage, e.to_stage, e.actor
    FROM application_events e JOIN applications a ON a.id = e.application_id ORDER BY e.user_id, a.job_id`;
  expect(Array.from(events)).toEqual([
    { user_id: USER_A, job_id: JOB_1, kind: "stage", from_stage: null, to_stage: "applied", actor: "user" },
    { user_id: USER_B, job_id: JOB_1, kind: "stage", from_stage: null, to_stage: "applied", actor: "user" },
  ]);

  await applyMigration();
  expect((await db.sql`SELECT count(*)::int AS n FROM applications`)[0].n).toBe(3);
  expect((await db.sql`SELECT count(*)::int AS n FROM application_events`)[0].n).toBe(2);
});

test("the migration applies twice", async () => {
  // openTestDb already ran schema.sql and then the file twice; check the result once.
  const rows = await db.sql`
    SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES as unknown as string[]}) ORDER BY c.relname`;
  expect(Array.from(rows)).toEqual([...TABLES].sort().map((relname) => ({ relname, relrowsecurity: true })));
  const policies = await db.sql`
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${TABLES as unknown as string[]}) ORDER BY tablename`;
  expect(policies.map((p) => [p.tablename, p.policyname])).toEqual(
    [...TABLES].sort().map((t) => [t, `${t}_owner`]),
  );
  // And a third run on top of seeded data is still clean.
  await applyMigration();
});
