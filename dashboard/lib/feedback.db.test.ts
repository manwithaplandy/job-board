import { readFileSync, existsSync } from "node:fs";
import postgres, { type TransactionSql } from "postgres";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";
// Deliberately isolated: this suite rebuilds ONLY this explicitly named local database.
const dsn = process.env.FEEDBACK_TEST_DATABASE_URL;
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
describe.skipIf(!dsn)("feedback database authorization and limits", () => {
  let sql: ReturnType<typeof postgres>;
  const asUser = <T>(id: string, fn: (tx: TransactionSql) => Promise<T>, role = "authenticated") => sql.begin(async tx => {
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({sub:id})}, true), set_config('role', ${role}, true)`;
    return fn(tx);
  });
  const send = (id: string, kind = "issue", message = "Something broke") => asUser(id, tx => tx`SELECT public.submit_feedback(${kind}, ${message})`);
  beforeAll(async () => {
    const url = new URL(dsn!);
    if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/feedback_test") throw new Error("Refusing destructive fixture outside local feedback_test");
    sql = postgres(dsn!, {max: 12, prepare:false, onnotice: () => {}});
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await sql.unsafe(readFileSync("../schema.sql", "utf8"));
    const migration = "../migrations/2026-10-02-feedback.sql";
    if (existsSync(migration)) {
      const connection = await sql.reserve();
      try { await connection.unsafe(readFileSync(migration, "utf8")); } finally { connection.release(); }
      const retry = await sql.reserve();
      try { await retry.unsafe(readFileSync(migration, "utf8")); } finally { retry.release(); }
    }
  });
  afterAll(async () => { await sql?.end(); });
  beforeEach(async () => { if ((await sql`SELECT to_regclass('public.feedback') AS name`)[0].name) await sql`TRUNCATE feedback`; await sql`TRUNCATE account_deletions`; });
  test("migration creates durable feedback storage", async () => { expect((await sql`SELECT to_regclass('public.feedback') AS name`)[0].name).toBe("feedback"); });
  test("serializes concurrent requests at five per rolling hour", async () => {
    const outcomes = await Promise.allSettled(Array.from({length: 12}, () => send(A)));
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(5);
    expect(outcomes.filter(x => x.status === "rejected")).toHaveLength(7);
    for (const outcome of outcomes) if (outcome.status === "rejected") expect(outcome.reason).toMatchObject({code: "P0001"});
    expect((await sql`SELECT count(*)::int AS n FROM feedback`)[0].n).toBe(5);
    await send(B);
    await sql`UPDATE feedback SET created_at = now() - interval '61 minutes' WHERE user_id = ${A}`;
    await send(A);
  });
  test("rejects stale transaction snapshots that could bypass the rate count", async () => {
    await expect(sql.begin("isolation level repeatable read", async tx => {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({sub:A})}, true), set_config('role', 'authenticated', true)`;
      await tx`SELECT submit_feedback('issue', 'stale snapshot')`;
    })).rejects.toMatchObject({code: "25000"});
  });
  test("derives owner, restricts reads, and denies direct mutation bypasses", async () => {
    await send(A); await send(B);
    const rows = await asUser(A, tx => tx`SELECT * FROM feedback`);
    expect(rows).toHaveLength(1); expect(rows[0].user_id).toBe(A);
    for (const query of ["INSERT INTO feedback (user_id, kind, message) VALUES ('" + B + "','issue','forged')", "DELETE FROM feedback", "UPDATE feedback SET created_at = now() - interval '2 hours'", "TRUNCATE feedback"]) await expect(asUser(A, tx => tx.unsafe(query))).rejects.toThrow();
  });
  test("rejects anonymous, invalid and tombstoned writes even through direct function calls", async () => {
    await expect(asUser(A, tx => tx`SELECT submit_feedback('issue','message')`, "anon")).rejects.toThrow();
    await expect(send("")).rejects.toThrow();
    await expect(asUser(A, tx => tx`SELECT * FROM feedback`, "anon")).rejects.toThrow();
    for (const [kind, message] of [["other", "text"], ["issue", " "], ["issue", "x".repeat(4001)]]) await expect(send(A, kind, message)).rejects.toThrow();
    await sql`INSERT INTO account_deletions(user_id,email_hash) VALUES (${A},'hash')`;
    await expect(send(A)).rejects.toThrow();
    expect((await sql`SELECT count(*)::int AS n FROM feedback`)[0].n).toBe(0);
  });
});
