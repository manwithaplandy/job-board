/** Ordinary owned-DB feature flow only; not an independent mechanism review. */
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
import postgres from "postgres";
import {beforeAll,afterAll,expect,test} from "vitest";
import {requestJobPayload,consumeJobVersion} from "./jobLifecycle";

const dsn=process.env.TEST_DATABASE_URL;
const python=process.env.LIFECYCLE_TEST_PYTHON;
if(!python) throw new Error("Owned acceptance runner Python required");
if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
const address=new URL(dsn);
if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
process.env.DATABASE_URL=dsn;
const sql=postgres(dsn,{max:1,prepare:false,onnotice:()=>{}});
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
  if (payload.status !== "ready") throw new Error("ready expected");
  const tracked=await generation.createGenerationJob(user,"job","resume",payload);
  expect(tracked.created).toBe(true);
  const rows=await sql`SELECT job_version_id,description_snapshot FROM generation_jobs WHERE id=${tracked.job.id}`;
  expect(rows[0]).toMatchObject({job_version_id:version,description_snapshot:"Exact input"});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${first.id}`)[0].consumed_at).toBeNull();
  await db.withUserSql(user,tx=>consumeJobVersion(tx,"job",version,"generation",payload.id,payload));
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

test("résumé-first preparation queues missing Q, pins the saved tuple, and consumes its exact receipt", async () => {
  const owner = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  await sql`UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1`;
  const first = await requestJobPayload(owner,"job","generation");
  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Saved résumé JD',
    questions_snapshot=NULL,snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${first.id}`;
  const input = await requestJobPayload(owner,"job","generation");
  if (input.status !== "ready") throw new Error("generation ready expected");
  const {upsertApplicationPackage} = await import("./queries");
  const resume = {name:"Fixture",contact:"",headline:"",summary:"",skills:[],experience:[],education:[],certifications:[]};
  await upsertApplicationPackage(owner,"job",{resume,coverLetter:null,prefilledAnswers:null,applyUrl:null,payload:input});
  const before = (await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id='job'`)[0];
  const pending = await requestJobPayload(owner,"job","prepare");
  expect(pending.status).toBe("pending");
  expect(pending.id).not.toBe(input.id);
  // Real service orchestration is covered by Python; this boundary supplies its committed result.
  const q1 = {questions:[{label:"First Q",required:false,fields:[]}]};
  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Saved résumé JD',
    questions_snapshot=${JSON.stringify(q1)}::text::jsonb,snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${pending.id}`;
  const prepared = await requestJobPayload(owner,"job","prepare");
  if (prepared.status !== "ready") throw new Error("prepare ready expected");
  expect(prepared.id).toBe(pending.id);
  expect(prepared.kind).toBe("prepare");
  await upsertApplicationPackage(owner,"job",{resume,coverLetter:null,prefilledAnswers:[],applyUrl:null,payload:prepared});
  const saved = (await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id='job'`)[0];
  expect(saved.description_snapshot).toBe(before.description_snapshot);
  expect(saved.snapshot_captured_at).toEqual(before.snapshot_captured_at);
  expect(saved.questions_snapshot).toEqual(q1);
  const later = await sql`INSERT INTO job_payload_demands(user_id,job_id,kind,status,job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,settled_at)
    VALUES(${owner},'job','description','ready',${version},'Saved résumé JD','{"questions":[{"label":"Later Q","required":false,"fields":[]}]}',clock_timestamp(),clock_timestamp()) RETURNING id`;
  const pinned = await requestJobPayload(owner,"job","generation");
  if (pinned.status !== "ready") throw new Error("saved input ready expected");
  expect(pinned.questions).toEqual(q1);
  expect(pinned.kind).toBe("prepare"); // Preserve actual source kind, do not relabel.
  expect(pinned.id).toBe(prepared.id);
  await upsertApplicationPackage(owner,"job",{resume,coverLetter:null,prefilledAnswers:null,applyUrl:null,payload:pinned});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${later[0].id}`)[0].consumed_at).toBeNull();
  const mismatch = {...pinned,questions:{questions:[{label:"Wrong Q",required:false,fields:[]}]}};
  await expect(upsertApplicationPackage(owner,"job",{resume:null,coverLetter:null,prefilledAnswers:[],applyUrl:null,payload:mismatch})).rejects.toThrow(/Package input changed/);
  await expect(db.withUserSql(owner,tx=>consumeJobVersion(tx,"job",version,pinned.kind,pinned.id,mismatch))).rejects.toThrow(/Exact durable demand receipt/);
  expect((await sql`SELECT questions_snapshot FROM application_packages WHERE user_id=${owner} AND job_id='job'`)[0].questions_snapshot).toEqual(q1);
  // Retention fixture: no original exact receipt survives. Queue a genuine new
  // owned capture, never use the remaining same-version/different-Q demand.
  await sql`DELETE FROM job_payload_demands WHERE id IN (${input.id}::uuid,${prepared.id}::uuid)`;
  const copying = await requestJobPayload(owner,"job","generation");
  expect(copying.status).toBe("pending");
  expect(copying.id).not.toBe(prepared.id);
  await sql`UPDATE job_payload_demands d SET status='ready',job_version_id=p.job_version_id,
    description_snapshot=p.description_snapshot,questions_snapshot=p.questions_snapshot,
    snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp()
    FROM application_packages p WHERE d.id=${copying.id}::uuid AND p.user_id=d.user_id AND p.job_id=d.job_id`;
  const copied = await requestJobPayload(owner,"job","generation");
  if(copied.status !== "ready") throw new Error("copied input expected");
  expect(copied.id).toBe(copying.id);
  await upsertApplicationPackage(owner,"job",{resume,coverLetter:null,prefilledAnswers:null,applyUrl:null,payload:copied});
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${copied.id}`)[0].consumed_at).toBeInstanceOf(Date);
  expect((await sql`SELECT snapshot_captured_at FROM application_packages WHERE user_id=${owner} AND job_id='job'`)[0].snapshot_captured_at).toEqual(before.snapshot_captured_at);
});

test("calibration SQL reads saved score/edit JD and explicitly falls back for legacy NULL", async () => {
  await sql`INSERT INTO resume_scores(user_id,job_id,grounding,jd_relevance,description_snapshot)
    VALUES(${user},'job',4,4,'Score input JD')`;
  await sql`INSERT INTO cover_letter_edits(user_id,job_id,edited_text,description_snapshot)
    VALUES(${user},'job','Edited letter','Edit input JD')`;
  for (const [script, expected, table] of [
    ["calibrate-resume-judge.ts", "Score input JD", "resume_scores"],
    ["calibrate-cover-letter-judge.ts", "Edit input JD", "cover_letter_edits"],
  ]) {
    // Execute only the static reader SQL. Never import/run sync or provider code.
    const source = readFileSync(resolve(process.cwd(), "scripts", script), "utf8");
    const query = source.match(/return \(await serviceSql`([\s\S]*?)`\)/)?.[1];
    if (!query) throw new Error("Static calibration reader missing");
    expect((await sql.unsafe(query))[0].description).toBe(expected);
    await sql.unsafe(`UPDATE ${table} SET description_snapshot=NULL WHERE job_id='job'`);
    expect((await sql.unsafe(query))[0].description).toBe("New shared content");
  }
});

test("instruction-only and application marker rows acquire their genuine first input and output", async () => {
  const owner="cccccccc-cccc-cccc-cccc-cccccccccccc";
  const jobId="greenhouse:first:1";
  await sql`INSERT INTO companies(id,name,ats,token) VALUES(2,'First','greenhouse','first')`;
  await sql`INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES(${jobId},2,'1','First role','https://example.test/first','Cached legacy JD')`;
  await sql`UPDATE lifecycle_control SET hydration_enabled=false,activation_generation=activation_generation+1`;
  const {upsertInstructionDraft,upsertApplicationPackage,getApplicationPackage}=await import("./queries");
  await upsertInstructionDraft(owner,jobId,"resume","Saved résumé instruction");
  await upsertInstructionDraft(owner,jobId,"cover","Keep cover draft");
  await sql`UPDATE application_packages SET status='applied',applied_at=clock_timestamp() WHERE user_id=${owner} AND job_id=${jobId}`;
  const draft=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${jobId}`)[0];
  expect(draft.resume_json).toBeNull();
  expect(draft.job_version_id).toBeNull();
  const pending=await requestJobPayload(owner,jobId,"prepare");
  expect(pending.status).toBe("pending");
  // Execute the actual Python service worker against this same owned database.
  // Only its public fetch boundary is replaced, with an outside-TX assertion.
  execFileSync(python, ["-c", `
import os, psycopg
from psycopg.rows import dict_row
from job_discovery.lifecycle import demand
with psycopg.connect(os.environ["TEST_DATABASE_URL"], row_factory=dict_row) as conn:
    def fetch(coordinates):
        assert conn.info.transaction_status.name == "IDLE"
        assert coordinates["ats"] == "greenhouse"
        return {"description":"First artifact JD", "questions":{"questions":[]}}
    demand.fetch_payload = fetch
    assert demand.process_pending(conn) == 1
`], {cwd:resolve(process.cwd(),".."),env:process.env,timeout:20000});
  const ready=await requestJobPayload(owner,jobId,"prepare");
  if(ready.status!=="ready") throw new Error("first input ready expected");
  const resume={name:"First",contact:"",headline:"",summary:"",skills:[],experience:[],education:[],certifications:[]};
  await upsertApplicationPackage(owner,jobId,{resume,coverLetter:null,prefilledAnswers:[],applyUrl:null,payload:ready,resumeInstructions:"Saved résumé instruction"});
  const saved=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${jobId}`)[0];
  expect(saved).toMatchObject({job_version_id:ready.versionId,description_snapshot:"First artifact JD",status:"applied",resume_instructions:"Saved résumé instruction",cover_letter_instructions_draft:"Keep cover draft"});
  expect(saved.applied_at).toEqual(draft.applied_at);
  expect(saved.resume_json).toEqual(resume);
  const displayed=await getApplicationPackage(owner,jobId);
  expect(displayed?.descriptionSnapshot).toBe("First artifact JD");
  expect(displayed?.questionsSnapshot).toEqual({questions:[]});
  expect(saved.snapshot_captured_at).toBeInstanceOf(Date);
  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${ready.id}`)[0].consumed_at).toBeInstanceOf(Date);
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
