/** Ordinary owned-DB feature flow only; not an independent mechanism review. */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import postgres from "postgres";
import {beforeAll,afterAll,expect,test} from "vitest";
import {requestJobPayload,consumeJobVersion} from "./jobLifecycle";

const dsn=process.env.TEST_DATABASE_URL;
if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
const address=new URL(dsn);
if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
process.env.DATABASE_URL=dsn;
const sql=postgres(dsn,{max:2,prepare:false,onnotice:()=>{}});
const user="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let db:typeof import("./db");
let generation:typeof import("./generationJobs");
let version:string;
beforeAll(async()=>{
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await sql.unsafe(readFileSync(resolve(process.cwd(),"../schema.sql"),"utf8"));
  await sql`INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')`;
  await sql`INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('job',1,'1','Role','https://example.test/job')`;
  const source=await sql`INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id`;
  const listing=await sql`INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at)
    VALUES(${source[0].id},'1','job',now(),now(),'local_observation',now()+interval '30 days') RETURNING id`;
  const versions=await sql`INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
    VALUES('job',${listing[0].id},1,${'a'.repeat(64)},'{}',now()) RETURNING id`;
  version=versions[0].id;
  await sql`UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1`;
  db=await import("./db");
  generation=await import("./generationJobs");
});
afterAll(async()=>{await db?.serviceSql.end();await sql.end();});

test("owner demand coalesces, ready pins a durable input, generation copies it and consumption follows success",async()=>{
  const first=await requestJobPayload(user,"job","generation");
  expect(first.status).toBe("pending");
  expect((await requestJobPayload(user,"job","generation")).id).toBe(first.id);
  // Worker completion fixture: service is the shared hydration writer.
  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Exact input',
    questions_snapshot='{"questions":[]}',snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${first.id}`;
  const payload=await requestJobPayload(user,"job","generation");
  expect(payload.status).toBe("ready");
  const tracked=await generation.createGenerationJob(user,"job","resume",payload);
  expect(tracked.created).toBe(true);
  const rows=await sql`SELECT job_version_id,description_snapshot FROM generation_jobs WHERE id=${tracked.job.id}`;
  expect(rows[0]).toMatchObject({job_version_id:version,description_snapshot:"Exact input"});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${first.id}`)[0].consumed_at).toBeNull();
  await db.withUserSql(user,tx=>consumeJobVersion(tx,"job",version,"generation"));
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${first.id}`)[0].consumed_at).toBeInstanceOf(Date);
  await sql`UPDATE jobs SET description='New shared content' WHERE id='job'`;
  expect((await sql`SELECT description_snapshot FROM generation_jobs WHERE id=${tracked.job.id}`)[0].description_snapshot).toBe("Exact input");
});

test("flag-off missing Greenhouse questions queues service work and accepts its exact ready snapshot",async()=>{
  await sql`UPDATE lifecycle_control SET hydration_enabled=false,activation_generation=activation_generation+1`;
  await sql`UPDATE companies SET ats='greenhouse' WHERE id=1`;
  const pending=await requestJobPayload(user,"job","prepare");
  expect(pending.status).toBe("pending");
  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Legacy compatible input',
    questions_snapshot='{"questions":[]}',snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${pending.id}`;
  const ready=await requestJobPayload(user,"job","prepare");
  expect(ready.status).toBe("ready");
  if(ready.status!=="ready") throw new Error("ready expected");
  expect(ready.versionId).toBe(version);
  expect(ready.questions).toEqual({questions:[]});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${pending.id}`)[0].consumed_at).toBeNull();
});

test("package persistence copies pinned input and records consumption with the artifact",async()=>{
  const payload=await requestJobPayload(user,"job","generation");
  expect(payload.status).toBe("ready");
  const {upsertApplicationPackage}=await import("./queries");
  await upsertApplicationPackage(user,"job",{resume:null,coverLetter:null,prefilledAnswers:[],applyUrl:null,payload});
  const rows=await sql`SELECT job_version_id,description_snapshot,prefilled_answers FROM application_packages WHERE user_id=${user} AND job_id='job'`;
  expect(rows[0]).toMatchObject({job_version_id:version,description_snapshot:"Exact input",prefilled_answers:[]});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${payload.id}`)[0].consumed_at).toBeInstanceOf(Date);
});

test("new payload wrapper preserves authenticated invoking role in an ordinary enforced write",async()=>{
  // Local fixture selects the installed writer contract; no control transition is claimed.
  await sql.begin(async tx=>{
    await tx`ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history`;
    await tx`UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=activation_generation+1`;
    await tx`ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history`;
  });
  await db.withUserPayloadMutation(user,"job","job_reviews",async tx=>{
    const role=await tx`SELECT current_user actor`;
    expect(role[0].actor).toBe("authenticated");
    await tx`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot)
      VALUES(${user},'job','v','approve',${version},'Exact input')`;
  });
  expect((await sql`SELECT description_snapshot FROM job_reviews WHERE user_id=${user}`)[0].description_snapshot).toBe("Exact input");
});
