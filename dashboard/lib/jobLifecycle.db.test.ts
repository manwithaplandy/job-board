import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { beforeAll, afterAll, expect, test } from "vitest";
import { acquireLifecycleGate, withJobProtection, parseLifecycleStage, parsePayloadDemand } from "./jobLifecycle";

// The owned Python harness validates credentials/environment and provisions a
// random loopback listener. Refuse shared setup port and every nonlocal target.
const dsn = process.env.TEST_DATABASE_URL;
if (!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS !== "1") throw new Error("Owned lifecycle harness is required");
const parsed = new URL(dsn);
if (parsed.hostname !== "127.0.0.1" || !parsed.port || parsed.port === "55432" || parsed.pathname !== "/poller_lifecycle_test") throw new Error("Unsafe lifecycle database target");
const sql = postgres(dsn, { max: 3, prepare: false, onnotice: () => {} });
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
beforeAll(async () => {
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await sql.unsafe(readFileSync(resolve(process.cwd(), "../schema.sql"), "utf8"));
  await sql`INSERT INTO companies(id,name,ats,token) VALUES (1,'Test','lever','test')`;
  await sql`INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES ('job',1,'j','Engineer','u','public JD')`;
});
afterAll(async () => { await sql.end(); });

test("parsers reject malformed boundary values", () => {
  for (const v of [null, {}, "unknown", 1]) expect(parseLifecycleStage(v)).toBeNull();
  expect(parseLifecycleStage("collect")).toBe("collect");
  expect(parsePayloadDemand('{"id":"fake"}')).toBeNull();
  expect(parsePayloadDemand({id:"d",job_id:"job",kind:"prepare",status:"pending"})).toEqual({id:"d",jobId:"job",kind:"prepare",status:"pending"});
});
test("flag-off helper preserves owner RLS and legacy prepare/generation", async () => {
  await sql.begin(async tx => {
    await tx`SELECT set_config('role','authenticated',true),set_config('request.jwt.claims',${JSON.stringify({sub:A,role:"authenticated"})},true)`;
    await withJobProtection(tx,"job",null,async () => {
      await tx`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (${A},'job','v','approve')`;
      await tx`INSERT INTO application_packages(user_id,job_id) VALUES (${A},'job')`;
      await tx`INSERT INTO generation_jobs(user_id,job_id,kind) VALUES (${A},'job','prepare')`;
      await tx`INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (${A},'job','description')`;
    });
  });
  await expect(sql.begin(async tx => {
    await tx`SELECT set_config('role','authenticated',true),set_config('request.jwt.claims',${JSON.stringify({sub:A,role:"authenticated"})},true)`;
    await withJobProtection(tx,"job",null,async () => tx`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (${B},'job','v','approve')`);
  })).rejects.toThrow();
});
test("another backend cannot pass the same global gate", async () => {
  let release!: () => void;
  let acquired!: () => void;
  const entered=new Promise<void>(r=>{acquired=r;});
  const done=new Promise<void>(r=>{release=r;});
  const first=sql.begin(async tx=>{await acquireLifecycleGate(tx);acquired();await done;});
  await entered;
  const second=await sql.begin(async tx=>tx`SELECT pg_try_advisory_xact_lock(20916294442894917) AS locked`);
  expect(second[0].locked).toBe(false);
  release();await first;
});
test("actual database is PostgreSQL 16 or 17 and helpers are private",async()=>{
  const version=await sql`SHOW server_version`;
  expect(String(version[0].server_version)).toMatch(/^(16|17)\./);
  const grants=await sql`SELECT has_function_privilege('authenticated','lifecycle_private.validate_write()','EXECUTE') AS allowed`;
  expect(grants[0].allowed).toBe(false);
});
