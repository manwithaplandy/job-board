/** Owned, offline ordinary consumer coverage; no adversarial mechanism probes. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildJobsQuery, buildJobsCountQuery } from "./jobsQuery";
import { serverBoardFilters } from "./filters";
import { parseJobLifecycle } from "./jobLifecycle";
const dsn=process.env.TEST_DATABASE_URL;
if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
const address=new URL(dsn);
if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
process.env.DATABASE_URL=dsn;
const sql=postgres(dsn,{max:1,prepare:false,onnotice:()=>{}});
const owner="11111111-1111-1111-1111-111111111111";
let db: typeof import("./db");
beforeAll(async()=>{
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const migration=readFileSync(resolve(process.cwd(),"../migrations/2026-10-07-04-lifecycle-feed.sql"),"utf8");
  const schema=readFileSync(resolve(process.cwd(),"../schema.sql"),"utf8");
  expect(schema).toContain(migration);
  await sql.unsafe(schema);
  await sql.unsafe(migration);
  await sql.unsafe(migration);
  await sql`INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')`;
  await sql`INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES
    ('fresh',1,'fresh','Engineer','https://example.test/fresh','JD'),
    ('older',1,'older','Engineer','https://example.test/older',NULL),
    ('unknown',1,'unknown','Engineer','https://example.test/unknown',NULL),
    ('closed',1,'closed','Engineer','https://example.test/closed',NULL),
    ('unmapped',1,'unmapped','Engineer','https://example.test/unmapped',NULL)`;
  const source=await sql`INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id`;
  await sql`INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
    discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,source_availability,payload_retired_at)
    SELECT ${source[0].id},id,id,now()-age,now()-age,'local_observation',now()-age+interval '720 hours',availability,retired
    FROM (VALUES ('fresh',interval '719 hours','open',NULL::timestamptz),
                 ('older',interval '721 hours','open',now()),
                 ('unknown',interval '721 hours','unknown',NULL),
                 ('closed',interval '1 hour','closed',NULL)) AS fixture(id,age,availability,retired)`;
  await sql`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(${owner},'older','v1','approve')`;
  await sql`INSERT INTO review_corrections(user_id,job_id,verdict) VALUES(${owner},'closed','approve')`;
  await sql`INSERT INTO application_packages(user_id,job_id,status,applied_at) VALUES(${owner},'unknown','prepared',NULL),(${owner},'unmapped','applied',now())`;
  db=await import('./db');
});
afterAll(async()=>{await db?.serviceSql.end();await sql.end();});
async function rows(older=false,offset=0,limit=500,history=false) {
  const f={...serverBoardFilters(history?'authed':'anon'),includeOlderLive:older};
  const query=buildJobsQuery(f,history?owner:null,[],{limit,offset,historyOnly:history});
  return history?db.withUserSql(owner,tx=>tx.unsafe(query.text,query.values as never[])):db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
}
test('flag-off anonymous legacy path and unmapped fallback stay readable',async()=>{
  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','older','unknown','unmapped']);
  expect((await rows()).find(r=>r.id==='unmapped')?.lifecycle).toBeNull();
});
test('source/expiry/payload remain independent, count matches concatenated page boundaries',async()=>{
  await sql`UPDATE lifecycle_control SET feed_enabled=true,source_enabled=true,activation_generation=activation_generation+1`;
  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','unmapped']);
  const all=await rows(true);
  expect(all.map(r=>r.id).sort()).toEqual(['fresh','older','unmapped']);
  const page1=await rows(true,0,2),page2=await rows(true,2,2);
  expect([...page1,...page2].map(r=>r.id)).toEqual(all.map(r=>r.id));
  const query=buildJobsCountQuery({...serverBoardFilters('anon'),includeOlderLive:true},null);
  const count=await db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
  expect(count[0].total).toBe(all.length);
  expect(parseJobLifecycle(all.find(r=>r.id==='older')?.lifecycle)).toMatchObject({sourceAvailability:'open',payloadAvailability:'retired'});
});
test('approved/corrected/prepared/applied history is independent of discovery and owner profile gates',async()=>{
  expect((await rows(false,0,500,true)).map(r=>r.id).sort()).toEqual(['closed','older','unknown','unmapped']);
  const query=buildJobsCountQuery(serverBoardFilters('authed'),owner,[],{historyOnly:true});
  const count=await db.withUserSql(owner,tx=>tx.unsafe(query.text,query.values as never[]));
  expect(count[0].total).toBe(4);
});
test('flag rollback changes no frozen dates, retired payload or proven closure',async()=>{
  const before=await sql`SELECT id,discovery_anchor_at,discovery_expires_at,source_availability,payload_retired_at FROM source_listings ORDER BY id`;
  await sql`UPDATE lifecycle_control SET feed_enabled=false,source_enabled=false,activation_generation=activation_generation+1`;
  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','older','unknown','unmapped']);
  const after=await sql`SELECT id,discovery_anchor_at,discovery_expires_at,source_availability,payload_retired_at FROM source_listings ORDER BY id`;
  expect(after).toEqual(before);
  expect((await sql`SELECT description FROM jobs WHERE id='older'`)[0].description).toBeNull();
});

test('actual server paging DTO keeps private history independent of discovery location preferences',async()=>{
  const {getJobsPage}=await import('./queries');
  await sql`UPDATE lifecycle_control SET feed_enabled=true,source_enabled=true,activation_generation=activation_generation+1`;
  const publicPage=await getJobsPage(serverBoardFilters('anon'),null);
  expect(publicPage.total).toBe(2);
  expect(publicPage.rows.map(r=>r.id).sort()).toEqual(['fresh','unmapped']);
  await sql`INSERT INTO profiles(user_id,profile_version,preferred_locations) VALUES(${owner},'v1',ARRAY['Tokyo'])`;
  const discovery=await getJobsPage(serverBoardFilters('authed'),owner);
  expect(discovery.total).toBe(0);
  const history=await getJobsPage(serverBoardFilters('authed'),owner,0,true);
  expect(history.total).toBe(4);
  expect(history.rows.map(r=>r.id).sort()).toEqual(['closed','older','unknown','unmapped']);
});

test('source closed query labels closure without including merely expired jobs',async()=>{
  const query=buildJobsQuery({...serverBoardFilters('anon'),status:'closed'},null);
  const result=await db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
  expect(result.map(r=>r.id)).toEqual(['closed']);
});
