# Complete scoped correction product entrypoint

FixBASE: 6cb16037aa667d11ea673e2d6d4b876df9b9f4b1
Reviewed HEAD: 799cb7c44a594f2bbe6fe8f804fcff8d2c9506f0
Product/DB source: 1cb3ab03e7194d61563f52b5802ccb14b52d7272
Final default test source: a1f766ed446e2946b03326c134f80730a2ed1727
Author report/evidence: a8c41165da7386d2ae6d3dc962c3caf5bbf7c502

This entrypoint contains every non-plan product/config/test/runbook correction diff block verbatim. It does not replace the full pinned raw package. Read the complete original final-requirements-review.md, completed final-fix1-report.md, all39 rulings-current.md lines/reasons/costs, final-fix1-controller-integrity.json, final-fix1-evidence/final-lanes.json, actual results/log summaries/source and selection audits alongside this diff. All original79 selectors/exclusions remain; 2 approved ordinary additions. No whole-branch rereview, tests or omitted Task3 probes. Scope originalsF1–F7/M1–M3 plus correction-introduced Important/Critical ONLY. Raw repetitive telemetry remains available; report honestly what was read.

Full raw package: final-fix1-review-package.md
Raw SHA256: 24eb2286ba6094e8e813343a1803ab948ff0e82a52a43f5712f0ef71d7129bb5
Raw bytes/lines: 5217546/70537

## All correction product paths

- dashboard/app/actions/applications.ts
- dashboard/app/actions/tombstoneGuard.test.ts
- dashboard/app/api/jobs/[id]/route.test.ts
- dashboard/app/api/jobs/[id]/route.ts
- dashboard/components/analytics/FunnelSection.tsx
- dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
- dashboard/lib/db.ts
- dashboard/lib/jobLifecycle.flow.db.test.ts
- docs/runbooks/job-lifecycle-outbox.md
- job_discovery/adapters/completeness.py
- job_discovery/lifecycle/demand.py
- job_discovery/lifecycle/followup.py
- job_discovery/lifecycle/identity.py
- job_discovery/lifecycle/maintenance.py
- job_discovery/lifecycle/operational.py
- job_discovery/lifecycle/reconcile.py
- job_discovery/lifecycle/version_retention.py
- migrations/2026-10-08-10-lifecycle-composition.sql
- reviewer/db.py
- reviewer/run.py
- schema.sql
- tests/test_lifecycle_demand.py
- tests/test_lifecycle_final_fix1.py
- tests/test_lifecycle_maintenance.py
- tools/lifecycle_test_selection.json

## Complete product correction diff

diff --git a/dashboard/app/actions/applications.ts b/dashboard/app/actions/applications.ts
index c8c1dde..56882b6 100644
--- a/dashboard/app/actions/applications.ts
+++ b/dashboard/app/actions/applications.ts
@@ -1,38 +1,45 @@
 "use server";
 
-import { requestJobPayload, readPrivateSnapshot } from "@/lib/jobLifecycle";
+import { requestJobPayload, consumeJobVersion } from "@/lib/jobLifecycle";
 
 import { requireUserId } from "@/lib/auth";
 import { withUserSql, withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 import { bareMarkerPredicate } from "@/lib/queries";
 
 // Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
 // user never prepared a package (a content-less marker row); the Prepare-panel
 // button hits the same path (its row already exists, so ON CONFLICT updates it).
 // Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
 export async function markApplicationApplied(jobId: string): Promise<void> {
   const userId = await requireUserId();
   await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
-  const payload = await requestJobPayload(userId, jobId, "prepare");
-  if (payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
+  const existing = await withUserSql(userId, tx => tx`SELECT 1 FROM application_packages WHERE user_id=${userId}::uuid AND job_id=${jobId}`);
+  const payload = existing.length ? null : await requestJobPayload(userId, jobId, "description");
+  if (payload?.status === "pending" || payload?.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
   await withUserPayloadMutation(userId, jobId, "application_packages", async (tx) => {
-    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
-    return tx`
-    INSERT INTO application_packages (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, status, applied_at)
-    VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
-      ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, 'applied', now())
-    ON CONFLICT (user_id, job_id) DO UPDATE SET
-      status     = 'applied',
-      applied_at = COALESCE(application_packages.applied_at, now())
-  `;
+    // A status transition never recaptures or relabels a retained artifact.
+    const updated = await tx`UPDATE application_packages SET status='applied',
+      applied_at=COALESCE(applied_at,now()) WHERE user_id=${userId}::uuid AND job_id=${jobId} RETURNING job_id`;
+    if (updated.length) return;
+    if (!payload) throw new Error("Application changed; retry marking it applied.");
+    const captured = payload.status === "ready"
+      ? await tx`SELECT snapshot_captured_at FROM job_payload_demands WHERE id=${payload.id}::uuid AND user_id=${userId}::uuid`
+      : [];
+    await tx`
+      INSERT INTO application_packages (user_id,job_id,job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,status,applied_at)
+      VALUES (${userId}::uuid,${jobId},${payload.status === "ready" ? payload.versionId : null}::uuid,
+        ${payload.status === "ready" ? payload.description : null},
+        ${payload.status === "ready" && payload.questions ? JSON.stringify(payload.questions) : null}::text::jsonb,
+        ${captured[0]?.snapshot_captured_at ?? null},'applied',now())`;
+    if (payload.status === "ready") await consumeJobVersion(tx,jobId,payload.versionId,payload.kind,payload.id,payload);
   });
 }
 
 // Undo "mark applied". A content-less marker row (created by the one-click path) is
 // deleted so no phantom "prepared" package lingers; a real prepared package is
 // reverted to status='prepared' (applied_at cleared) with its content preserved.
 // The apply_url IS NULL guard is future-proof: if a write path for apply_url-only
 // rows is ever added, this won't accidentally delete them.
 export async function unmarkApplicationApplied(jobId: string): Promise<void> {
   const userId = await requireUserId();
diff --git a/dashboard/app/actions/tombstoneGuard.test.ts b/dashboard/app/actions/tombstoneGuard.test.ts
index 85ce19c..b94f0d4 100644
--- a/dashboard/app/actions/tombstoneGuard.test.ts
+++ b/dashboard/app/actions/tombstoneGuard.test.ts
@@ -52,13 +52,14 @@ beforeEach(() => {
 describe("mutating actions honor the tombstone guard", () => {
   test.each(ACTIONS)("%s refuses a tombstoned account and never writes", async (_name, run) => {
     state.deleted = true;
     await expect(run()).rejects.toThrow(/deleted/);
     expect(withUserSql).not.toHaveBeenCalled();
   });
 
   test.each(ACTIONS)("%s proceeds to the DB write for a live account", async (_name, run) => {
     state.deleted = false;
     await expect(run()).resolves.toBeUndefined();
-    expect(withUserSql).toHaveBeenCalledTimes(1);
+    // Mark-applied reads retained input before its status mutation.
+    expect(withUserSql).toHaveBeenCalledTimes(_name === "markApplicationApplied" ? 2 : 1);
   });
 });
diff --git a/dashboard/app/api/jobs/[id]/route.test.ts b/dashboard/app/api/jobs/[id]/route.test.ts
index 787134f..06802f0 100644
--- a/dashboard/app/api/jobs/[id]/route.test.ts
+++ b/dashboard/app/api/jobs/[id]/route.test.ts
@@ -1,13 +1,15 @@
+vi.mock("@/lib/db", () => ({withUserMutation: async (_u: string, fn: (tx: unknown) => Promise<unknown>) => fn({})}));
 vi.mock("@/lib/jobLifecycle", async (importOriginal) => ({
   ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
   requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+  consumeJobVersion: vi.fn(async () => {}),
 }));
 import { beforeEach, describe, expect, test, vi } from "vitest";
 
 // The DB read is the only boundary; the JOB_ID_RE gate runs for real so we actually test
 // the injection/abuse shield. The SaaS cutover made this route VIEWER-SCOPED: it resolves
 // getUserId() and passes it into getJobReviewDetail(id, viewerId), and flips Cache-Control
 // from a shared-CDN `public` cache to `private, no-store` (a tenant-leak guard).
 const mocks = vi.hoisted(() => ({
   getJobReviewDetail: vi.fn(), getJobQuestion: vi.fn(), getUserId: vi.fn(),
 }));
diff --git a/dashboard/app/api/jobs/[id]/route.ts b/dashboard/app/api/jobs/[id]/route.ts
index 73ef7a2..3a5a60a 100644
--- a/dashboard/app/api/jobs/[id]/route.ts
+++ b/dashboard/app/api/jobs/[id]/route.ts
@@ -1,11 +1,12 @@
-import { parseJobLifecycle, requestJobPayload, type DemandResult } from "@/lib/jobLifecycle";
+import { withUserMutation } from "@/lib/db";
+import { parseJobLifecycle, requestJobPayload, consumeJobVersion, type DemandResult } from "@/lib/jobLifecycle";
 import { getJobReviewDetail, getJobQuestion } from "@/lib/queries";
 import { getUserId } from "@/lib/auth";
 import { JOB_ID_RE } from "@/lib/jobIdValidator";
 
 export const dynamic = "force-dynamic";
 
 const EMPTY = {
   reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
   description: null, url: null,
   experience_match: null, industry: null, industry_subcategory: null,
@@ -36,15 +37,20 @@ export async function GET(
   ]);
   // The body is viewer-scoped (their own review). It MUST NOT be cached in a shared
   // CDN cache — a `public` cache would leak one tenant's review to another. Keep it
   // private and uncached.
   const lifecycle=parseJobLifecycle(detail?.lifecycle);
   const payload: DemandResult | null = viewerId && detail
     ? lifecycle?.sourceAvailability === "closed"
       ? {status:"deferred",id:null,reason:"Source closed. Your saved review and application history remains available."}
       : await requestJobPayload(viewerId,id,"description")
     : null;
+  // Authenticated ready payload delivery is the concrete detail-use boundary.
+  // Pending/status-only helper reads do not stamp consumption.
+  if (viewerId && payload?.status === "ready") {
+    await withUserMutation(viewerId, tx => consumeJobVersion(tx,id,payload.versionId,payload.kind,payload.id,payload));
+  }
   return Response.json({ ...(detail ?? EMPTY), questions,
     ...(payload?.status === "ready" ? {currentDescription:payload.description,currentQuestions:payload.questions} : {}), ...(payload && payload.status !== "legacy" ? {payload} : {}) }, {
     headers: { "Cache-Control": "private, no-store" },
   });
 }
diff --git a/dashboard/components/analytics/FunnelSection.tsx b/dashboard/components/analytics/FunnelSection.tsx
index 5a07fb7..2554e3b 100644
--- a/dashboard/components/analytics/FunnelSection.tsx
+++ b/dashboard/components/analytics/FunnelSection.tsx
@@ -158,24 +158,23 @@ export function FunnelSection({ funnel }: { funnel: FunnelCounts }) {
         </Panel>
 
         <Panel title="Jobs — Job Discovery → reviewer">
           <SubHead>Pipeline stages</SubHead>
           {jobStages.map((s) => <Row key={s.label} spec={s} barMax={jobStageMax} />)}
           <SubHead>Outcomes of review (share of reviewed)</SubHead>
           {jobOutcomes.map((s) => <Row key={s.label} spec={s} barMax={jobOutcomeMax} />)}
           <Row
             spec={{
               label: "Applied", value: j.applied, tone: "good",
-              pctBase: j.approved, pctSuffix: "of approved",
               info: { term: GLOSSARY.applied.label, gloss: GLOSSARY.applied.gloss },
             }}
-            barMax={Math.max(1, j.approved)}
+            barMax={Math.max(1, j.applied)}
           />
           <SubHead>Queue</SubHead>
           <Row
             spec={{
               label: "Not yet reviewed", value: j.unreviewed, tone: "muted",
               pctBase: j.open, pctSuffix: "of discovery",
               info: { term: GLOSSARY.unreviewed.label, gloss: GLOSSARY.unreviewed.gloss },
             }}
             barMax={Math.max(1, j.open)}
           />
diff --git a/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx b/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
index fd2dc5b..fec6fd7 100644
--- a/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
+++ b/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
@@ -113,12 +113,13 @@ describe("analytics content width", () => {
 });
 
 test('discovery totals do not claim employer openness and distinguish retained applied history', async () => {
   const {FunnelSection}=await import('./FunnelSection');
   const funnel={companies:{tracked:1,active:1,discovery_sourced:1,reviewed:1,include:1,exclude:0,unknown:0,backlog:0},jobs:{ever_seen:4,open:2,closed:1,reviewed:2,gate_rejected:0,approved:1,applied:3,denied:0,manual_rejected:0,unreviewed:0,errors:0}};
   render(<FunnelSection funnel={funnel}/>);
   expect(screen.getByText('In discovery')).toBeTruthy();
   expect(screen.getAllByText('100% of discovery')).toHaveLength(1);
   expect(screen.getAllByText('0.0% of discovery')).toHaveLength(1);
   expect(screen.queryByText(/of open/)).toBeNull();
+  expect(screen.queryByText(/of approved/)).toBeNull();
   expect(screen.getByText(/Applied totals include retained history/)).toBeTruthy();
 });
diff --git a/dashboard/lib/db.ts b/dashboard/lib/db.ts
index dc1b8ef..cc75d5c 100644
--- a/dashboard/lib/db.ts
+++ b/dashboard/lib/db.ts
@@ -112,63 +112,97 @@ export type PayloadScope = "job_reviews" | "review_corrections" | "application_p
 
 /** Service capability setup only; all application DML runs as authenticated.
  * One exact job/scope/backend/transaction reservation, checked by existing guards.
  * The callback must do database work only. Caller supplies a verified auth user ID.
  */
 export async function withUserPayloadMutation<T>(
   userId: string, jobId: string, scope: PayloadScope,
   fn: (tx: TransactionSql) => Promise<T>,
 ): Promise<T> {
   if (!userId || !jobId) throw new Error("Owner and job required");
-  return (await serviceSql.begin(async (tx) => {
+  let completedClaim: {workId:string;ownerToken:string;generation:number} | null = null;
+  const result = (await serviceSql.begin(async (tx) => {
     await acquireLifecycleGate(tx);
     await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'lifecycle:job:' + jobId}, 0))`;
     const controls = await tx`SELECT safety_stage FROM lifecycle_control WHERE singleton`;
     let reservation: string | null = null;
     if (controls[0]?.safety_stage === "enforced") {
       // Worst case includes a 10 MiB input snapshot and generated output; the
       // trigger measures actual writes and refuses any underestimate.
       const bytes = 96 * 1024 * 1024;
       const claim = await tx`INSERT INTO lifecycle_claims(kind,work_id,owner_token,lease_until,invoking_role)
         VALUES ('dashboard',gen_random_uuid()::text,gen_random_uuid()::text,
           clock_timestamp()+interval '180 seconds',current_user)
         RETURNING work_id,owner_token,generation`;
       const row = claim[0];
       if (!row) throw new Error("Payload claim unavailable");
+      completedClaim = {workId:row.work_id,ownerToken:row.owner_token,generation:row.generation};
       const reservations = await tx`INSERT INTO capacity_reservations
         (claim_kind,claim_id,owner_token,generation,bytes,backend_pid,transaction_id,job_id,scope,subject_id,invoking_role)
         VALUES ('dashboard',${row.work_id},${row.owner_token},${row.generation},${bytes},
           pg_backend_pid(),pg_current_xact_id(),${jobId},${scope},${userId}::uuid,'authenticated') RETURNING id`;
       reservation = typeof reservations[0]?.id === "string" ? reservations[0].id : null;
       if (!reservation) throw new Error("Payload reservation unavailable");
       await tx`SELECT set_config('lifecycle.reservation',${reservation},true)`;
     }
     await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),
       set_config('role','authenticated',true)`;
     const result = await fn(tx);
     if (reservation) {
       // Restore only to settle service-owned capability metadata, never user DML.
       await tx`SELECT set_config('role','none',true),set_config('request.jwt.claims','',true)`;
       await tx`UPDATE capacity_reservations SET state='settled',terminal_at=clock_timestamp(),
         measured_database_bytes=pg_database_size(current_database()) WHERE id=${reservation}::uuid`;
     }
     return result;
   })) as T;
+  // The original transaction (including deferred checks) has committed. A
+  // failure here leaves durable work for bounded maintenance finalization.
+  if (completedClaim) {
+    const claim: {workId:string;ownerToken:string;generation:number} = completedClaim;
+    try {
+    await serviceSql.begin(async tx => {
+      await acquireLifecycleGate(tx);
+      await tx`UPDATE lifecycle_claims SET replay_floor=generation,generation=generation+1,
+        state='cancelled',terminal_at=clock_timestamp()
+        WHERE kind='dashboard' AND work_id=${claim.workId} AND owner_token=${claim.ownerToken}
+          AND generation=${claim.generation} AND state='active' AND invoking_role=current_user
+          AND subject_id IS NOT DISTINCT FROM app_user_id()
+          AND NOT EXISTS(SELECT FROM capacity_reservations WHERE claim_kind='dashboard'
+            AND claim_id=${claim.workId} AND state='held')`;
+    });
+    } catch (error) {
+      // Do not report a committed private artifact as failed (or refund its
+      // generation). Maintenance retries only the settled completion metadata.
+      console.warn("Payload completion metadata deferred",error instanceof Error ? error.name : "unknown");
+    }
+  }
+  return result;
 }
 
 /** Read the existing sticky compatibility control, then enqueue/read as owner.
  * Mirrors lifecycle.config.legacy_description_capture_allowed; no shared DML.
  */
-export async function withUserDemandSql<T>(
-  userId:string, fn:(tx:TransactionSql,legacyAllowed:boolean)=>Promise<T>,
-):Promise<T> {
+export async function withUserDemandSql(
+  userId:string, fn:(tx:TransactionSql,legacyAllowed:boolean)=>Promise<import("./jobLifecycle").DemandResult>,
+):Promise<import("./jobLifecycle").DemandResult> {
   if(!userId) throw new Error("Owner required");
   return (await serviceSql.begin(async tx=>{
     await acquireLifecycleGate(tx);
     const rows=await tx`SELECT NOT (c.source_enabled OR c.hydration_enabled OR c.maintenance_enabled
       OR c.safety_stage='enforced' OR c.archive_ever_activated OR m.cutover_at IS NOT NULL) AS legacy_allowed
       FROM lifecycle_control c CROSS JOIN lifecycle_maintenance_state m WHERE c.singleton AND m.singleton`;
     const legacyAllowed=rows[0]?.legacy_allowed===true;
     await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),set_config('role','authenticated',true)`;
-    return fn(tx,legacyAllowed);
-  })) as T;
+    const result = await fn(tx,legacyAllowed);
+    if (result.status === "ready") {
+      await tx`SELECT set_config('role','none',true),set_config('request.jwt.claims','',true)`;
+      const pinned = await tx`UPDATE job_payload_demands SET protection_until=clock_timestamp()+interval '180 seconds'
+        WHERE id=${result.id}::uuid AND user_id=${userId}::uuid AND status='ready'
+          AND job_version_id=${result.versionId}::uuid AND kind=${result.kind}
+          AND description_snapshot=${result.description}
+          AND questions_snapshot IS NOT DISTINCT FROM ${result.questions ? JSON.stringify(result.questions) : null}::text::jsonb RETURNING id`;
+      if (pinned.length !== 1) throw new Error("Ready input changed; retry the request");
+    }
+    return result;
+  })) as import("./jobLifecycle").DemandResult;
 }
diff --git a/dashboard/lib/jobLifecycle.flow.db.test.ts b/dashboard/lib/jobLifecycle.flow.db.test.ts
index 9f6e434..a3b427a 100644
--- a/dashboard/lib/jobLifecycle.flow.db.test.ts
+++ b/dashboard/lib/jobLifecycle.flow.db.test.ts
@@ -1,17 +1,19 @@
 /** Ordinary owned-DB feature flow only; not an independent mechanism review. */
 import {readFileSync} from "node:fs";
 import {execFileSync} from "node:child_process";
 import {resolve} from "node:path";
 import postgres from "postgres";
-import {beforeAll,afterAll,expect,test} from "vitest";
+import {beforeAll,afterAll,expect,test,vi} from "vitest";
 import {requestJobPayload,consumeJobVersion} from "./jobLifecycle";
+const session=vi.hoisted(()=>({user:"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" as string|null}));
+vi.mock("@/lib/auth",()=>({requireUserId:async()=>session.user,getUserId:async()=>session.user}));
 
 const dsn=process.env.TEST_DATABASE_URL;
 const python=process.env.LIFECYCLE_TEST_PYTHON;
 if(!python) throw new Error("Owned acceptance runner Python required");
 if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
 const address=new URL(dsn);
 if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
 process.env.DATABASE_URL=dsn;
 const sql=postgres(dsn,{max:1,prepare:false,onnotice:()=>{}});
 const user="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
@@ -196,25 +198,125 @@ with psycopg.connect(os.environ["TEST_DATABASE_URL"], row_factory=dict_row) as c
   expect(saved).toMatchObject({job_version_id:ready.versionId,description_snapshot:"First artifact JD",status:"applied",resume_instructions:"Saved résumé instruction",cover_letter_instructions_draft:"Keep cover draft"});
   expect(saved.applied_at).toEqual(draft.applied_at);
   expect(saved.resume_json).toEqual(resume);
   const displayed=await getApplicationPackage(owner,jobId);
   expect(displayed?.descriptionSnapshot).toBe("First artifact JD");
   expect(displayed?.questionsSnapshot).toEqual({questions:[]});
   expect(saved.snapshot_captured_at).toBeInstanceOf(Date);
   expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${ready.id}`)[0].consumed_at).toBeInstanceOf(Date);
 });
 
+test("actual non-Greenhouse worker supports applied status and ready detail exact use",async()=>{
+  const jobId="lever:final:delivery",owner=session.user!;
+  await sql`UPDATE companies SET ats='lever' WHERE id=1`;
+  await sql`INSERT INTO jobs(id,company_id,external_id,title,url) VALUES(${jobId},1,'delivery','Role','https://example.test/job')`;
+  const source=(await sql`SELECT id FROM source_accounts LIMIT 1`)[0].id;
+  await sql`INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at)
+    VALUES(${source},'delivery',${jobId},now(),now(),'local_observation',now()+interval '30 days')`;
+  const first=await requestJobPayload(owner,jobId,"description");
+  expect(first.status).toBe("pending");
+  execFileSync(python!,["-c",`
+import os, psycopg
+from psycopg.rows import dict_row
+from job_discovery.lifecycle.demand import hydrate_demand
+from job_discovery.lifecycle.types import DemandRef
+with psycopg.connect(os.environ["TEST_DATABASE_URL"],row_factory=dict_row) as c:
+    r=c.execute("SELECT * FROM job_payload_demands WHERE job_id='lever:final:delivery'").fetchone()
+    c.commit()
+    assert hydrate_demand(c,DemandRef(r['id'],r['job_id'],r['kind'],None,r['status']),lambda _: {'description':'Delivered JD'})=='ready'
+`],{cwd:resolve(process.cwd(),".."),env:process.env,timeout:20000});
+  const ready=await requestJobPayload(owner,jobId,"description");
+  if(ready.status!=="ready") throw new Error("ready expected");
+  const other=(await sql`INSERT INTO job_payload_demands(user_id,job_id,kind,status,job_version_id,description_snapshot,snapshot_captured_at,settled_at)
+    VALUES(${owner},${jobId},'generation','ready',${ready.versionId},'Other JD',clock_timestamp(),clock_timestamp()) RETURNING id`)[0].id;
+  const {GET}=await import("@/app/api/jobs/[id]/route");
+  const response=await GET(new Request(`http://local/api/jobs/${jobId}`),{params:Promise.resolve({id:jobId})});
+  expect((await response.json()).currentDescription).toBe("Delivered JD");
+  const consumed=(await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${ready.id}`)[0].consumed_at;
+  expect(consumed).toBeInstanceOf(Date);
+  await requestJobPayload(owner,jobId,"description"); // Status/helper read is not delivery.
+  session.user=null;
+  await GET(new Request(`http://local/api/jobs/${jobId}`),{params:Promise.resolve({id:jobId})});
+  session.user=owner;
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${ready.id}`)[0].consumed_at).toEqual(consumed);
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${other}`)[0].consumed_at).toBeNull();
+  execFileSync(python!,["-c",`
+import os, psycopg
+from psycopg.rows import dict_row
+from job_discovery.lifecycle.demand import apply_consumptions
+with psycopg.connect(os.environ['TEST_DATABASE_URL'],row_factory=dict_row) as c: apply_consumptions(c)
+`],{cwd:resolve(process.cwd(),".."),env:process.env,timeout:20000});
+  expect((await sql`SELECT description_last_used_at FROM jobs WHERE id=${jobId}`)[0].description_last_used_at).toEqual(consumed);
+  const {markApplicationApplied,unmarkApplicationApplied}=await import("@/app/actions/applications");
+  await markApplicationApplied(jobId);
+  const saved=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${jobId}`)[0];
+  expect(saved).toMatchObject({status:"applied",description_snapshot:"Delivered JD",questions_snapshot:null,job_version_id:ready.versionId});
+  await markApplicationApplied(jobId);
+  expect((await sql`SELECT applied_at FROM application_packages WHERE user_id=${owner} AND job_id=${jobId}`)[0].applied_at).toEqual(saved.applied_at);
+  await unmarkApplicationApplied(jobId);
+  expect(await sql`SELECT 1 FROM application_packages WHERE user_id=${owner} AND job_id=${jobId}`).toHaveLength(0);
+
+});
+
+test.each([true,false])("applied status preserves existing known=%s résumé without questions or recapture",async known=>{
+  const owner=session.user!,jobId=known?"lever:final:known":"lever:final:legacy";
+  await sql`INSERT INTO jobs(id,company_id,external_id,title,url) VALUES(${jobId},1,${jobId},'Role','https://example.test/job')`;
+  // The known package uses the existing Job's exact version; legacy remains honestly nullable.
+  const actualJob=known?"job":jobId;
+  await sql`INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot,resume_json)
+    VALUES(${owner},${actualJob},${known?version:null},${known?"Saved JD":null},'{"retained":"resume"}')`;
+  const before=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${actualJob}`)[0];
+  const {markApplicationApplied,unmarkApplicationApplied}=await import("@/app/actions/applications");
+  await sql.begin(async tx=>{
+    await tx`ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history`;
+    await tx`UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=activation_generation+1`;
+    await tx`ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history`;
+  });
+  try {
+  await markApplicationApplied(actualJob);
+  const after=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${actualJob}`)[0];
+  expect(after.status).toBe("applied");
+  for(const key of ['resume_json','cover_letter_json','prefilled_answers','job_version_id','description_snapshot','questions_snapshot','snapshot_captured_at']) expect(after[key]).toEqual(before[key]);
+  expect(await sql`SELECT 1 FROM job_payload_demands WHERE user_id=${owner} AND job_id=${actualJob}`).toHaveLength(0);
+  await markApplicationApplied(actualJob);
+  expect((await sql`SELECT applied_at FROM application_packages WHERE user_id=${owner} AND job_id=${actualJob}`)[0].applied_at).toEqual(after.applied_at);
+  await unmarkApplicationApplied(actualJob);
+  const undone=(await sql`SELECT * FROM application_packages WHERE user_id=${owner} AND job_id=${actualJob}`)[0];
+  expect(undone.status).toBe("prepared");
+  expect(undone.applied_at).toBeNull();
+  for(const key of ["resume_json","job_version_id","description_snapshot","questions_snapshot"]) expect(undone[key]).toEqual(before[key]);
+  } finally {
+    await sql.begin(async tx=>{
+      await tx`ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history`;
+      await tx`UPDATE lifecycle_control SET safety_stage='legacy',activation_generation=activation_generation+1`;
+      await tx`ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history`;
+    });
+  }
+});
+
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
+  expect((await sql`SELECT count(*)::int n FROM lifecycle_claims WHERE kind='dashboard' AND state='active'`)[0].n).toBe(0);
+  execFileSync(python!,["-c",`
+import os, psycopg
+from psycopg.rows import dict_row
+from job_discovery.lifecycle.maintenance import _terminal_batch
+with psycopg.connect(os.environ['TEST_DATABASE_URL'],row_factory=dict_row) as c:
+    class Cutoff:
+        def execute(self,q,p=None): return c.execute(q.replace("clock_timestamp()-interval '168 hours'","clock_timestamp()+interval '1 hour'"),p)
+    assert _terminal_batch(Cutoff(),100,3)>0
+    c.commit()
+`],{cwd:resolve(process.cwd(),".."),env:process.env,timeout:20000});
+  expect(await sql`SELECT 1 FROM capacity_reservations WHERE claim_kind='dashboard'`).toHaveLength(0);
 });
diff --git a/docs/runbooks/job-lifecycle-outbox.md b/docs/runbooks/job-lifecycle-outbox.md
index 2a34aad..5354828 100644
--- a/docs/runbooks/job-lifecycle-outbox.md
+++ b/docs/runbooks/job-lifecycle-outbox.md
@@ -11,47 +11,47 @@ This is a release procedure, not authorization to execute it. All controls remai
 5. Before enforcement or live retirement, service operators must evaluate the actual deployed components below, then explicitly record contract_version1, the same full40-character source_revision, validated_at and nonempty notes in service-only `lifecycle_writer_readiness`. Required keys are source_metadata, company_writers, location_writers, demand_snapshots, dashboard_snapshots, reviewer_snapshots, account_cascade, legacy_consumers, archive_producers and operational_preallocation. These are assertions by the operator, not automatic runtime discoveries. No component self-attests. Quiesce incompatible writers throughout mapping certification and transition. Run `readiness.verify_backfill_batch(conn, revision, limit<=500)` with one commit per call until true. It verifies existing listing/source mapping and capture/use timestamps, not payload contents or actual deployed code. A changed control generation/revision restarts the scan; recertify before each protected transition. Completion has the old control generation and matching source revision. The transition API retains the existing owner-bound control claim and CAS. Identity/source/maintenance/hydration prerequisites must be on. Missing mapping/attestation leaves readiness blocked; local seeded attestations do not approve production.
 6. Archive is a separate gate. Validate the approved destination/account/region/prefix/private access/encryption/policy and persist the existing destination evidence only after authorization. Quiesce ordinary public writers; certify compatible producers and mapping; enter producer-active/export-off through the existing control transition. Produce a bounded current-state `baseline_batch` page (at most 100 rows) and commit, using existing claims/reservations. Recertify mapping for the new generation, then separately authorize export with all destination/writer prerequisites intact. Export enablement does **not** assert corpus completeness. Interleave further bounded baseline commits with the normal exporter and exact event-ID acknowledgement; drain before the fixed ordinary backlog budget prevents another page. Small batches follow the existing five-minute flush threshold; do not enlarge budgets, discard pending history or bypass export controls. Keep ordinary public writers quiesced while this protocol visits all 13 aggregate types; baselines record current state, never invented previous history. Before ending quiescence/cutover, require `lifecycle_private.archive_baseline_ready()` to report no current row missing a head, finish delivery of every baseline event and verify no pending baseline events/batches remain. Persist that completion evidence with the deployed source and control generation. The head-existence predicate is a completion/reporting check, not an export prerequisite; it reads the corpus and can hit the existing statement limit. A timeout means completion is unverified and cutover remains blocked. Missing destination/mapping/writer readiness still blocks export activation; incomplete baseline leaves rollout incomplete while correctly sealed pages can drain.
 7. Observe successful exact-ID acknowledgement, backlog and actual resource headroom before separately authorizing archived public version/edge retirement or live payload retirement. Raw-content archive stays disabled; its90-day option requires separate approval. Public event horizon is730 days from persisted seal. Pending expired batches remain pending and blocked until separately authorized replacement preserving IDs, hashes and original times.
 
 ## Runtime and writer inventory
 
 | Runtime path | Current integration and readiness evidence needed |
 | --- | --- |
 | `job_discovery.run` | Daily one-shot; pre-admission maintenance; source-enabled uses existing due scheduler; flag-off retains legacy paths. Actual persisted run closed_jobs now counts successful normal/fallback closure commits. |
 | `lifecycle.source_worker` | Independent bounded supervisor child using the same maintenance and due scheduler/operational path. Both it and the daily caller pass the actual admission decision: blocked maintenance defers new metadata/version admission while exact membership and existing-source progress continue. Daily blocked runs also defer novel source catalog registration. No new transport, claim or capacity mechanism. |
-| `lifecycle.metadata`, `versions`, `reconcile` | Metadata/version/listing observations and availability updates use paired public writes; unchanged polls keep compact markers rather than historical events. |
+| `lifecycle.identity.admit_metadata`, `capture_version`, `reconcile` | Metadata/version/listing observations and availability updates use paired public writes; unchanged polls keep compact markers rather than historical events. |
 | `job_discovery.db.sync_seed`, `company_discovery.db.upsert_candidates`, `worker.ingest_candidates`, `weekly_ingest` | Existing paired company/source writers,100-row ingestion boundaries and committed progress. Verify all deployed entrypoints are these versions. Legacy unpaired archive writers fail closed. |
 | `company_discovery.enrich_apply`, `jobs_db.apply_classification`, `name_backfill.apply_name` | Accepted paired public mutations; model/external work remains outside transactions. |
 | `job_discovery.locations` | `_insert`, `_insert_unmappable`, `correct_location` pair canonical public changes; resolver bounded100-row commits. `stamp_jobs` changes cache references, not public facts. |
 | Brands/skills/relations/assertions | Typed projections, baseline and paired APIs exist for all supported tables. No invented populated skill dictionary or speculative brand/identity merge. Any new producer needs an evaluated attestation. |
-| Operational verification | Existing preallocated source/listing state and critical event slots. Provision below guard before readiness; missing/exhausted rows defer. Initial per-listing slots16; global critical slots12,500 are finite and not automatically recycled. |
+| Operational verification | Existing preallocated source/listing state and critical event slots. Provision below guard before readiness; missing/exhausted rows defer. Initial global critical-slot increment: 16 per provision batch (not per listing); global critical slots: 12,500 are finite and not automatically recycled. |
 | Reviewer | Lifecycle feed filters before candidate hydration; actual consumed version/snapshots follow successful matching. `backfill_floors` takes gate/sorted jobs for private metadata updates; it is an administrative whole-selection transaction, not a measured bounded ingestion path. Quiesce it during cutover and evaluate before subsequent use. |
 | Dashboard private writes | `withUserPayloadMutation`, demand wrappers, `jobLifecycle`, `generationJobs`, `queries` and corrections/resumeScores/coverLetterEdits/applications/jobs actions preserve snapshots/receipts. Known package inputs remain authoritative. |
 | Dashboard consumers | `jobsQuery`, board server loaders, detail/history/application/calibration consumers distinguish source, discovery and payload. Count and rows use matching semantics. Public120-second ISR was removed for per-request expiry; load/cost impact is unmeasured. |
 | Legacy private packages | Cached legacy use and known-input résumé-first preparation are supported. Unknown-input package with missing questions terminal-defers to protect old artifact lineage. Full-package recapture/recovery is not implemented; preserve old artifacts and surface this availability limitation. |
 | Legacy shared readers | `legacy_description_capture_allowed` and permanent maintenance cutover prevent restoration of unconditional refill/prune. Old tools bypassing current wrappers are incompatible after cutover and must remain stopped. |
 | Account deletion | `accountDeletion.deleteUserRowsTx`: service transaction, lifecycle gate, subject tombstone, feedback lock, explicit userScopedTables deletion. Profile cascade/matching activity roots retain their gate. Many user IDs lack auth FK and depend on this explicit inventory. No account erasure or cross-user adversarial validation was rerun in Task13. |
 | Archive export/replay | Existing export child ticks60s/deadline120s/lease180s; maintenance never writes S3. Task12 reader is optional pure offline logic, with no runtime archive loader/caller or trusted current-time/comprehensive suppression adapter supplied by this rollout. |
 
 Public projection inventory is exactly jobs, source_accounts, source_listings, job_versions, companies, locations, brands, skills, company_brands, company_sources, job_locations, job_skills and identity_assertions. Company polling health/private cache fields do not create shared public events. Private approvals, corrections, application packages, resume_scores, cover_letter_edits, generation_jobs, demand receipts and review state remain PostgreSQL owner-scoped; the seven original Job-linked child relationships must never be erased by identity retirement. Current APIs do not depend on archive availability.
 
 ## Grants and control combinations
 
 Existing lifecycle controls, claims, reservations, readiness, outbox, destination and archive state are service-owned with RLS and no client write grants. Existing owner-scoped demands/snapshots retain their narrow grants and policies; migration03 grants authenticated consumption-time update without shared cache writes. Private helpers retain explicit PUBLIC/anon/authenticated EXECUTE revocation. Migration09 adds no client grants or SECURITY DEFINER bypass. This is a source inventory, not independent role/JWT/helper security certification; that omitted review remains absent.
 
 | State | Permitted operation / rollback |
 | --- | --- |
 | Fresh/off/never-activated | Legacy compatibility remains. Installations do not retire cache or upload. |
 | Collect + individual feature flags | Evaluate mapping and ordinary source/demand/feed behavior. Retirement remains dry-run until enforced readiness. |
 | Enforced + dry-run | No claim that old unreserved writers remain compatible; deploy current wrappers and stop incompatible tools. |
 | Retirement live | Requires enforced stage and complete readiness. Disabling retirement pauses it; it never deletes lean Job identity or protected snapshots. |
-| Producer active + export off | Paired writes remain subject to logical backlog limits. Pending events retained. Baseline is built before enabling export. |
+| Producer active + export off | Paired writes remain subject to logical backlog limits. Pending events retained. A bounded first baseline page is built before enabling export; subsequent pages interleave export and exact acknowledgement. |
 | Export pause | Producers stay paired and stop at applicable backpressure. No pending/event/seal deletion. |
 | Producer paused after any activation | Eventful changes remain blocked; archive history cannot reset to never-activated. Revalidate runtime/destination, recertify and resume through claim/CAS. |
 | Rollback | Pause affected features/workers, retain schema/identity/private work/outbox/history. Never restore old prune/refill consumers, fabricate timestamps or clear permanent activation history. |
 
 No runbook procedure changes grants, disables constraints, overrides database clocks/GUCs, rewrites claims or supplies physical credit for deletion.
 
 ## Health, lag and capacity
 
 Use existing persisted state/logs: last successful sweep and retired rows/bytes; physical `pg_database_size/1024^2` and guard status; separately observed live/dead/reusable space; source last attempt/complete verification/due age/failure streak/exclusion and persisted cursor; committed closure counts; demand pending/deferred/status/version; outbox forecast bytes, live_bytes, rows and oldest age; seal/upload/verification/exact ack/error; retention-blocked and suppression/replay gap status. Two scheduled guard-active sweeps require operator action through existing logs/admin status; no notification infrastructure is introduced.
 
@@ -63,10 +63,49 @@ The6000MiB guard measures allocated database size, not logical payload sums. Adm
 
 Outbox thresholds: warn64MiB/50,000 events/15min; ordinary pause112MiB/87,500; hard128MiB/100,000, with16MiB AND12,500 critical slots reserved. Current accepted accounting also reserves `6*C+128,000` logical processing bytes per canonical event C. Consequently byte escrow can bind long before slot count: prior accepted fixtures estimate506–865 ordinary events or61 two-event closures, not12,500 guaranteed closure operations. Inspect actual event sizes and drain rate. Exact acknowledgement releases logical reservations; allocation may remain. Pending events/seals never TTL-delete; terminal large shells expire after seven days while replay/fence/suppression/auth history survives. Current plus<=10 superseded public versions/listing within30 days is permitted only after safe archival and protection checks.
 
 ## Local evidence and limitations
 
 Task13 evidence is under `.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-evidence/`, with the report beside it. The committed `tools/lifecycle_test_selection.json` is the positive local/CI selection. Run Python and the two ordinary dashboard DB files through `tools/lifecycle_test_db.py --postgres-major 17` and16, using `tools/run_lifecycle_acceptance.py [dashboard]`. Default Vitest excludes all DB fixtures. Never use a shared55432 target or broaden discovery to the deliberately excluded mechanism/security suites.
 
 The six-family fixture retained12 Job identities and six private snapshots, retired five unprotected descriptions totaling80 logical bytes, and measured1,744 Job row bytes with28,448,435 allocated database bytes. One archive fixture produced6,340 canonical/922 gzip/2,671 manifest bytes. These tiny synthetic ratios are illustrative, not population forecasts. Extrapolate only from an authorized representative sample using independent identity/row-index, cache-size/expiry/protection, meaningful event rate, escrow and retention dimensions. Do not infer savings for already deleted history. The combined offline sample measured four processes (real maintenance/fake-S3 export, inert stalled reviewer, source disabled), not active production model/source throughput. See exact phase metrics; no cost neutrality or provisioning promise follows.
 
 Deliberately absent are the Task3 independent expiry-enforcement, physical-capacity, cross-user and related adversarial review/probes. Selected functional successes, service attestations and catalog parity do not supply those guarantees. Preserve that gap through final review and release decisions. Unknown legacy full recapture, actual runtime compatibility, sustained source coverage, physical runway, production17.6/TLS, archive destination/IAM/retention and cost/load remain explicit gates or functional limitations.
+
+
+Final composition migration `2026-10-08-10-lifecycle-composition.sql` adds compact
+service-only demand observation and suspicious-empty follow-up fields. Neither the
+private demand UUID nor follow-up bookkeeping enters public archive/anonymous
+projections. After two suspicious-empty turns, schedule at most three deterministic
+existing-open exact-coordinate checks per source per 24 hours, sharing the original
+board request/time budget. Logs and `followup_status` request migration review;
+failed/malformed/missing details remain unknown and do not close postings. These
+diagnostics do not infer migration links or reactivate excluded boards.
+
+With retirement explicitly enabled and dry-run disabled, prospective replacement
+can compact at most 12 archived version/edge row effects per admitted posting;
+25-posting admission remains within 500 row effects. Maintenance independently
+retires eligible superseded versions/edges, including the oldest at current plus
+ten. Exact version/hash and current edge-head acknowledgement are required; any
+private/cache reference, missing proof or pending event retains the needed row.
+Replacement establishes its current public location edge before compacting the
+superseded edge. Compact archive coverage/heads remain; no false relation-removal
+event or physical space credit is produced.
+
+Temporary terminal demand bodies/receipts become eligible seven days after the
+latest settlement or actual consumption, after application of consumption receipts
+and expiry of a short handoff pin. Durable private snapshots and active generation
+remain protected. Actual review batches renew exact input pins every 30 seconds;
+ready-input handoff pins last 180 seconds. Detail use means successful authenticated
+ready payload delivery (which may be delivered but not seen), using its exact
+receipt/input tuple. Queue/status-only helper reads do not count as use. When an
+origin receipt is gone, retained package input uses the existing genuine new
+private-copy capture; historical provenance is not reconstructed.
+
+Demand and dashboard producers finalize only after their result transactions and
+optional cache writes have committed/rolled back. Maintenance performs bounded
+committed-only completion for transaction-specific public writers, review writers,
+dashboard leftovers and terminal demand recovery; unresolved held reservations
+remain. Demand recovery waits the original final-write window before finalizing.
+Seven-day detail cleanup retains compact claim generations/replay floors. None of
+these local functional changes supplies the deliberately omitted Task3 assurance,
+production activation, live destination proof, or physical-reclamation evidence.
diff --git a/job_discovery/adapters/completeness.py b/job_discovery/adapters/completeness.py
index 2617c01..009930c 100644
--- a/job_discovery/adapters/completeness.py
+++ b/job_discovery/adapters/completeness.py
@@ -57,23 +57,24 @@ def validate_ids(items: list, key: str) -> None:
 # identities (duplicate/facet walks cannot escape the request ceiling).
 class SourceBudgetExceeded(ValueError):
     pass
 
 
 _budget = ContextVar('source_budget', default=None)
 
 
 @contextmanager
 def source_budget(seconds, requests, pulse=None):
-    token = _budget.set([monotonic()+seconds,requests,pulse])
+    budget = [monotonic()+seconds,requests,pulse]
+    token = _budget.set(budget)
     try:
-        yield
+        yield budget
     finally:
         _budget.reset(token)
 
 
 def _request(method, url, **kwargs):
     from job_discovery import http
     budget = _budget.get()
     if budget is not None:
         if budget[1] <= 0 or monotonic() >= budget[0]:
             raise SourceBudgetExceeded('source request/time budget exhausted; incomplete')
diff --git a/job_discovery/lifecycle/demand.py b/job_discovery/lifecycle/demand.py
index 40e129e..fbdb556 100644
--- a/job_discovery/lifecycle/demand.py
+++ b/job_discovery/lifecycle/demand.py
@@ -1,24 +1,23 @@
 """Service hydration. Network occurs only between committed, fenced transactions."""
 
-import hashlib
 import re
 from uuid import UUID
 
 from psycopg.types.json import Jsonb
 
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import get_json
 from job_discovery.jd import extract_description
 from job_discovery.adapters.greenhouse import parse_greenhouse_questions
-from .claims import claim_work, renew_claim, validate_claim
+from .claims import claim_work, renew_claim, validate_claim, cancel_claim
 from .config import read_control, legacy_description_capture_allowed
-from .identity import capture_version
+from .identity import capture_version, description_hash
 from .locks import lock_jobs
 from .reconcile import _write, StorageBlocked
 from .types import DemandRef
 
 KINDS = {"description", "questions", "review", "prepare", "generation"}
 _COORDINATE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
 
 
 def parse_payload(value):
     if not isinstance(value, dict):
@@ -109,36 +108,37 @@ def request_demand(conn, job_id: str, user_id: str, kind: str) -> DemandRef:
         raise ValueError("invalid demand kind")
     lock_jobs(conn, [job_id])
     ready = conn.execute(
         """SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s
         AND status='ready' AND job_version_id IS NOT NULL AND description_snapshot IS NOT NULL
         AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-CASE WHEN kind IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
         ORDER BY settled_at DESC LIMIT 1""",
         (UUID(user_id), job_id, kind),
     ).fetchone()
     if ready:
+        conn.execute("UPDATE job_payload_demands SET protection_until=clock_timestamp()+interval '180 seconds' WHERE id=%s", (ready["id"],))
         return DemandRef(ready["id"], job_id, kind, None, "ready")
     row = conn.execute(
         """INSERT INTO job_payload_demands(user_id,job_id,kind)
         VALUES(%s,%s,%s) ON CONFLICT(user_id,job_id,kind) WHERE status IN ('pending','running') DO NOTHING
         RETURNING *""",
         (UUID(user_id), job_id, kind),
     ).fetchone()
     if row is None:
         row = conn.execute(
             "SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s AND status IN ('pending','running')",
             (UUID(user_id), job_id, kind),
         ).fetchone()
     return DemandRef(row["id"], job_id, kind, None, row["status"])
 
 
-def _finish(conn, demand, claim, status, version=None, payload=None):
+def _finish(conn, demand, claim, status, version=None, payload=None, *, finalize=True):
     validate_claim(conn, claim)
     payload = payload or {}
     size = 8192 + 8 * len(str(payload).encode())
     with _write(conn, claim, "job_payload_demands", demand.job_id, size=size):
         row = conn.execute(
             """UPDATE job_payload_demands SET status=%s,job_version_id=%s,
             description_snapshot=%s,questions_snapshot=%s,snapshot_captured_at=CASE WHEN %s='ready' THEN clock_timestamp() ELSE NULL END,
             settled_at=clock_timestamp()
             WHERE id=%s AND status='running' AND claim_owner_token=%s AND claim_generation=%s
             RETURNING id""",
@@ -151,23 +151,43 @@ def _finish(conn, demand, claim, status, version=None, payload=None):
                 else None,
                 status,
                 demand.id,
                 claim.owner_token,
                 claim.generation,
             ),
         ).fetchone()
         if row is None:
             raise RuntimeError("demand completion superseded")
     conn.commit()
+    if finalize:
+        cancel_claim(conn, claim)
+        conn.commit()
     return status
 
 
+def _record_live_verification(conn, demand, claim, listing_id):
+    # The exact running demand and the compact terminal claim floor provide the
+    # durable deduplication identity; ready reuse/private copies never call here.
+    with _write(conn, claim, "source_listings", demand.job_id):
+        conn.execute("""UPDATE source_listings SET
+          successful_last_observed_at=clock_timestamp(),
+          successful_sighting_count=successful_sighting_count+1,
+          last_demand_verification_id=%s,last_observation_kind='demand',
+          source_availability='open',consecutive_complete_misses=0,first_complete_miss_at=NULL
+          WHERE id=%s AND last_demand_verification_id IS DISTINCT FROM %s""",
+          (demand.id,listing_id,demand.id))
+    # Reconciliation may have closed this exact Job while the live request was
+    # in flight. The newer successful observation restores its current status.
+    with _write(conn, claim, "jobs", demand.job_id):
+        conn.execute("UPDATE jobs SET closed_at=NULL WHERE id=%s", (demand.job_id,))
+
+
 def _hydrate_demand(conn, demand: DemandRef, fetch=fetch_payload) -> str:
     """Return pending/ready/deferred; ready is a committed exact-version snapshot.
 
     Does not overwrite shared payload: protected shared caches remain intact in
     this rollout. The consumer reads its durable demand snapshot instead.
     """
     lock_jobs(conn, [demand.job_id])
     row = conn.execute(
         "SELECT * FROM job_payload_demands WHERE id=%s AND job_id=%s",
         (demand.id, demand.job_id),
@@ -279,61 +299,63 @@ def _hydrate_demand(conn, demand: DemandRef, fetch=fetch_payload) -> str:
         current_package = conn.execute(
             """SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,
             resume_json,cover_letter_json,prefilled_answers FROM application_packages WHERE user_id=%s AND job_id=%s""",
             (row["user_id"], demand.job_id),
         ).fetchone()
         if current_package != saved_package or payload["questions"] is None:
             return _finish(conn, demand, claim, "deferred")
         # First question acquisition preserves the original private JD/version.
         # The demand's capture timestamp records this new Q capture; the package
         # and its original JD capture timestamp are not changed by hydration.
+        _record_live_verification(conn, demand, claim, coordinates["listing_id"])
         payload["description"] = saved_package["description_snapshot"]
         return _finish(
             conn, demand, claim, "ready", saved_package["job_version_id"], payload
         )
     metadata = dict(
         coordinates["public_metadata"]
         or {"title": coordinates["title"], "url": coordinates["url"]}
     )
-    metadata["description_hash"] = hashlib.sha256(
-        " ".join(payload["description"].split()).encode()
-    ).hexdigest()
+    metadata["description_hash"] = description_hash(payload["description"])
     version = capture_version(
         conn,
         coordinates["listing_id"],
         metadata,
         conn.execute("SELECT clock_timestamp() now").fetchone()["now"],
         claim,
     )
     if version is None:
         return _finish(conn, demand, claim, "deferred")
-    result = _finish(conn, demand, claim, "ready", version, payload)
+    _record_live_verification(conn, demand, claim, coordinates["listing_id"])
+    result = _finish(conn, demand, claim, "ready", version, payload, finalize=False)
     # Demand completion is durable first. An empty shared cache may be filled by
     # this explicit demand; existing/protected content is never replaced.
     try:
         lock_jobs(conn, [demand.job_id])
         with _write(
             conn,
             claim,
             "jobs",
             demand.job_id,
             size=8192 + 8 * len(payload["description"].encode()),
         ):
             conn.execute(
                 """UPDATE jobs SET description=%s,description_version_id=%s,
                 description_captured_at=clock_timestamp(),description_capture_provenance='demand',description_pruned=false
                 WHERE id=%s AND description IS NULL""",
                 (payload["description"], version, demand.job_id),
             )
         conn.commit()
     except Exception:
         conn.rollback()  # private ready snapshot remains authoritative
+    cancel_claim(conn, claim)
+    conn.commit()
     return result
 
 
 def hydrate_demand(conn, demand: DemandRef, fetch=None) -> str:
     try:
         return _hydrate_demand(conn, demand, fetch or fetch_payload)
     except RuntimeError:
         conn.rollback()
         return "deferred"
 
@@ -388,34 +410,34 @@ def process_pending(conn, limit=1):
             conn.rollback()
     return len(rows)
 
 
 def apply_consumptions(conn, limit=100):
     """Service applies only committed owner consumption receipts, never views."""
     from .locks import enter_gate
 
     enter_gate(conn)
     rows = conn.execute(
-        """SELECT id,job_id,job_version_id,kind,consumed_at FROM job_payload_demands
+        """SELECT id,job_id,job_version_id,kind,questions_snapshot,consumed_at FROM job_payload_demands
         WHERE consumed_at IS NOT NULL AND (consumption_applied_at IS NULL OR consumed_at>consumption_applied_at)
         ORDER BY consumed_at,id LIMIT %s""",
         (limit,),
     ).fetchall()
     lock_jobs(conn, [r["job_id"] for r in rows])
     for row in rows:
         conn.execute(
             """UPDATE jobs SET description_last_used_at=GREATEST(description_last_used_at,%s)
             WHERE id=%s AND description_version_id=%s""",
             (row["consumed_at"], row["job_id"], row["job_version_id"]),
         )
-        if row["kind"] in {"questions", "prepare"}:
+        if row["kind"] in {"description", "questions", "prepare"} and row["questions_snapshot"] is not None:
             conn.execute(
                 """UPDATE job_questions SET last_used_at=GREATEST(last_used_at,%s)
-                WHERE job_id=%s AND job_version_id=%s""",
-                (row["consumed_at"], row["job_id"], row["job_version_id"]),
+                WHERE job_id=%s AND job_version_id=%s AND questions=%s""",
+                (row["consumed_at"], row["job_id"], row["job_version_id"], Jsonb(row["questions_snapshot"])),
             )
         conn.execute(
             "UPDATE job_payload_demands SET consumption_applied_at=%s WHERE id=%s",
             (row["consumed_at"], row["id"]),
         )
     conn.commit()
     return len(rows)
diff --git a/job_discovery/lifecycle/followup.py b/job_discovery/lifecycle/followup.py
new file mode 100644
index 0000000..a93d8ef
--- /dev/null
+++ b/job_discovery/lifecycle/followup.py
@@ -0,0 +1,76 @@
+"""Finite suspicious-empty diagnostics using stored public coordinates only."""
+import logging
+from contextlib import contextmanager
+from time import monotonic
+
+from .reconcile import _write
+
+log = logging.getLogger(__name__)
+
+
+@contextmanager
+def _change(conn, source_id, claim, operational):
+    if operational:
+        from .operational import _receipt
+        _receipt(conn, source_id, claim)
+        yield
+    else:
+        with _write(conn, claim, "source_accounts"):
+            yield
+
+
+def schedule(conn, source_id, claim, *, operational=False):
+    with _change(conn, source_id, claim, operational):
+        conn.execute("""UPDATE source_accounts SET followup_due_at=clock_timestamp(),followup_status='pending'
+          WHERE id=%s AND suspicious_empty_streak>=2 AND followup_due_at IS NULL
+          AND (last_followup_at IS NULL OR last_followup_at<=clock_timestamp()-interval '24 hours')""", (source_id,))
+
+
+def run(conn, source, claim, budget, *, operational=False):
+    """Consume at most three remaining requests and the SAME board time budget.
+
+    Persist the attempt before HTTP: interrupted/retried turns do not append
+    queue rows or repeat a sample inside 24 hours. Live/unknown responses provide
+    migration diagnostics; neither supplies inferred absence or mass closure.
+    """
+    from .demand import fetch_payload
+    from .claims import renew_claim
+    from job_discovery.adapters.completeness import source_budget
+
+    if budget is None or budget[1] <= 0 or monotonic() >= budget[0]:
+        return
+    due = conn.execute("SELECT 1 FROM source_accounts WHERE id=%s AND followup_due_at<=clock_timestamp()", (source["id"],)).fetchone()
+    if not due:
+        conn.commit()
+        return
+    rows = conn.execute("""SELECT l.external_id FROM source_listings l JOIN jobs j ON j.id=l.job_id
+      WHERE l.source_account_id=%s AND j.closed_at IS NULL ORDER BY l.external_id LIMIT %s""",
+      (source["id"],min(3,budget[1]))).fetchall()
+    with _change(conn, source["id"], claim, operational):
+        conn.execute("""UPDATE source_accounts SET followup_due_at=NULL,last_followup_at=clock_timestamp(),
+          followup_status='running' WHERE id=%s""", (source["id"],))
+    conn.commit()
+    log.warning("source %s action needed: repeated suspicious empty; migration review; representative exact checks=%s",
+                source["id"],len(rows))
+    live = 0
+    def pulse():
+        if operational:
+            from .operational import _receipt
+            _receipt(conn,source["id"],claim)
+        else:
+            renew_claim(conn,claim)
+        conn.commit()
+    with source_budget(max(0,budget[0]-monotonic()), min(3,budget[1]), pulse):
+        for row in rows:
+            if monotonic() >= budget[0]:
+                break
+            try:
+                payload = fetch_payload({"ats":source["ats"],"public_board_ref":source["public_board_ref"],"external_id":row["external_id"]})
+                live += payload is not None
+            except Exception:
+                # HTTP failure, missing URL, or malformed input is unknown.
+                pass
+    with _change(conn, source["id"], claim, operational):
+        conn.execute("UPDATE source_accounts SET followup_status='migration_review' WHERE id=%s", (source["id"],))
+    conn.commit()
+    log.warning("source %s migration review remains required: representative live=%s; no absence inferred",source["id"],live)
diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
index 0c805d0..fd36aae 100644
--- a/job_discovery/lifecycle/identity.py
+++ b/job_discovery/lifecycle/identity.py
@@ -182,20 +182,24 @@ def _map_company_source(cur, company_id, source_id, ats, board_ref):
 
 
 def _text(value):
     return (
         " ".join(unicodedata.normalize("NFC", value).split())
         if isinstance(value, str)
         else None
     )
 
 
+def description_hash(value: str) -> str:
+    return hashlib.sha256(_text(value).encode()).hexdigest()
+
+
 def _public_ref(value):
     if not isinstance(value, str) or len(value.encode()) > 2048:
         raise ValueError("bounded public evidence URL required")
     try:
         url = urlsplit(value)
         if (
             url.scheme not in {"http", "https"}
             or not url.hostname
             or url.username
             or url.password
@@ -232,21 +236,21 @@ def posting_metadata(
         if value:
             metadata[field] = value
     if type(posting.remote) is bool:
         metadata["remote"] = posting.remote
     try:
         body = extract_description(ats, posting.raw or {})
     except (TypeError, ValueError, AttributeError, KeyError):
         body = None
     body = _text(body)
     if body:
-        metadata["description_hash"] = hashlib.sha256(body.encode()).hexdigest()
+        metadata["description_hash"] = description_hash(body)
     if len(json.dumps(metadata, ensure_ascii=False).encode()) > 6144:
         return None
     return metadata
 
 
 def _source_publication(ats, raw, now):
     # Ashby documents last publication, not original requisition creation.
     # Unknown source fields and invalid/future/naive values remain unknown.
     if ats != "ashby" or not isinstance(raw, dict):
         return None
@@ -255,30 +259,22 @@ def _source_publication(ats, raw, now):
         return None
     try:
         value = datetime.fromisoformat(value.replace("Z", "+00:00"))
     except ValueError:
         return None
     anchor, provenance = choose_anchor(value, now, now)
     return anchor if provenance == "source_published" else None
 
 
 def _version_room(conn, listing):
-    # Retain evidence until maintenance can retire exact archived, unreferenced
-    # versions. Private references may continue to prevent retirement.
-    # A changed version would supersede the current row too, so include its age.
-    row = conn.execute(
-        """SELECT count(*) n,
-        bool_or(recorded_at<clock_timestamp()-interval '30 days') old
-        FROM job_versions WHERE source_listing_id=%s""",
-        (listing["id"],),
-    ).fetchone()
-    return row["n"] < 11 and not row["old"]
+    from .version_retention import replacement_plan
+    return replacement_plan(conn, listing) is not None
 
 
 def capture_version(
     conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
 ) -> UUID | None:
     """Capture one meaningful public revision, or pause at the retention bound.
 
     The caller owns the transaction. Shared _write pairs meaningful public
     projections with the transactional outbox whenever the producer is active.
     """
@@ -316,21 +312,23 @@ def capture_version(
     listing = conn.execute(
         "SELECT * FROM source_listings WHERE id=%s", (listing_id,)
     ).fetchone()
     if listing is None:
         raise ValueError("unknown source listing")
     lock_jobs(conn, [listing["job_id"]])
     validate_claim(conn, claim)
     digest = hashlib.sha256(encoded).hexdigest()
     if digest == listing["content_hash"]:
         return listing["current_version_id"]
-    if not _version_room(conn, listing):
+    from .version_retention import replacement_plan, compact_versions
+    retire = replacement_plan(conn, listing)
+    if retire is None:
         return None
     revision = listing["current_revision"] + 1
     with _write(conn, claim, "job_versions", listing["job_id"], size=65536):
         version = conn.execute(
             """INSERT INTO job_versions
             (job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
             VALUES(%s,%s,%s,%s,%s,%s) RETURNING id""",
             (
                 listing["job_id"],
                 listing_id,
@@ -351,20 +349,21 @@ def capture_version(
     if (
         location
         and conn.execute("SELECT 1 FROM locations WHERE raw=%s", (location,)).fetchone()
     ):
         with _write(conn, claim, "job_locations"):
             conn.execute(
                 """INSERT INTO job_locations(job_version_id,location_id,evidence_kind,
                 public_evidence_ref,observed_at,status) VALUES(%s,%s,'structured_source',%s,%s,'accepted')""",
                 (version, location, normalized["url"], observed_at),
             )
+    compact_versions(conn, [row["id"] for row in retire])
     return version
 
 
 # At most five metadata row effects per posting (one known location edge;
 # listing creation and a later publication update are mutually exclusive).
 # Source staging adds at most three more: 25 * 8 = 200, below the 500-row cap.
 ADMISSION_CHUNK_SIZE = 25
 
 
 def admit_metadata(
diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
index 51f6a8a..d04f7ca 100644
--- a/job_discovery/lifecycle/maintenance.py
+++ b/job_discovery/lifecycle/maintenance.py
@@ -24,21 +24,22 @@ RENEW_SECONDS = 30
 
 _UNPROTECTED = """
 NOT EXISTS(SELECT FROM job_reviews WHERE job_id=j.id AND verdict='approve')
 AND NOT EXISTS(SELECT FROM review_corrections WHERE job_id=j.id)
 AND NOT EXISTS(SELECT FROM application_packages WHERE job_id=j.id)
 AND NOT EXISTS(SELECT FROM resume_scores WHERE job_id=j.id)
 AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_id=j.id)
 AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_id=j.id AND status IN ('pending','running'))
 AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_id=j.id AND
  (status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp()
-  OR description_snapshot IS NOT NULL OR questions_snapshot IS NOT NULL))
+  OR protection_until>clock_timestamp()
+  OR consumed_at IS NOT NULL AND (consumption_applied_at IS NULL OR consumption_applied_at<consumed_at)))
 """
 _DESCRIPTION_DUE = """j.description IS NOT NULL AND
  COALESCE(j.description_last_used_at,j.description_captured_at)<=clock_timestamp()-interval '720 hours'"""
 _QUESTIONS_DUE = """q.questions IS NOT NULL AND q.questions<>'null'::jsonb AND
  COALESCE(q.last_used_at,q.captured_at)<=clock_timestamp()-interval '168 hours'"""
 
 
 
 class _PhaseEnded(Exception):
     """No more statements may start in this transaction's time window."""
@@ -171,53 +172,40 @@ def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
                 size += row['question_bytes']
             retired += 1
         visited += 1
         if not complete:
             break  # Resume this Job; an already-cleared field is simply absent.
         completed_cursor = job_id
     return max(visited, retired), retired, size, candidates, completed_cursor
 
 
 def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
-    # Exact version/hash coverage is required; a listing watermark cannot certify unknown versions.
-    # FK references are deliberately retained, including terminal private work.
-    rows = conn.execute('''SELECT v.id,v.job_id,octet_length(v.public_metadata::text) AS bytes
+    from .version_retention import ELIGIBLE, COST, BYTES, compact_versions
+    rows = conn.execute(f'''SELECT v.id,v.job_id,({BYTES}) AS bytes,({COST}) AS cost
       FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
-      WHERE v.id IS DISTINCT FROM s.current_version_id AND EXISTS(SELECT FROM public_archive_version_coverage c WHERE c.version_id=v.id
-        AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash)
+      WHERE v.id IS DISTINCT FROM s.current_version_id AND {ELIGIBLE}
       AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
         (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
-         AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=10)
-      AND NOT EXISTS(SELECT FROM jobs WHERE description_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM job_questions WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM job_reviews WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM review_corrections WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM application_packages WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM resume_scores WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM job_locations WHERE job_version_id=v.id)
-      AND NOT EXISTS(SELECT FROM job_skills WHERE job_version_id=v.id)
-      ORDER BY v.recorded_at,v.id LIMIT %s''', (limit,)).fetchall()
+         AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=9)
+      ORDER BY v.recorded_at,v.id LIMIT %s''', (min(limit,100),)).fetchall()
     selected = []
-    size = 0
+    size = effects = 0
     for row in rows:
-        if size + row['bytes'] <= byte_limit:
+        if size+row['bytes']<=byte_limit and effects+row['cost']<=min(limit,400):
             selected.append(row)
             size += row['bytes']
+            effects += row['cost']
     acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in selected]))
     selected = [r for r in selected if r['job_id'] in acquired]
-    size = sum(r['bytes'] for r in selected)
-    if not dry_run and selected:
-        conn.execute('DELETE FROM job_versions WHERE id=ANY(%s)', ([r['id'] for r in selected],))
-    return len(rows), 0 if dry_run else len(selected), 0 if dry_run else size
+    if not dry_run:
+        compact_versions(conn,[r['id'] for r in selected])
+    return sum(r['cost'] for r in selected), 0 if dry_run else len(selected), 0 if dry_run else sum(r['bytes'] for r in selected)
 
 
 def _staging_batch(conn, limit):
     # Select just one enumeration: a huge member set is drained over bounded
     # commits. Its compact source/claim floors are advanced BEFORE any deletion.
     row = conn.execute('''SELECT e.*,p.reason FROM source_enumerations e
       LEFT JOIN lifecycle_staging_cleanup p ON p.enumeration_id=e.id
       WHERE p.enumeration_id IS NOT NULL OR
        (e.status='complete' AND e.reconciled_at<=clock_timestamp()-interval '24 hours'
         AND EXISTS(SELECT FROM reconciliation_checkpoints c WHERE c.enumeration_id=e.id
@@ -254,35 +242,65 @@ def _staging_batch(conn, limit):
     # No cascading unbounded deletion: consume checkpoint/marker/parent one at a
     # time when the remaining run budget allows all three.
     if limit < 3:
         return 0
     n = conn.execute('DELETE FROM reconciliation_checkpoints WHERE enumeration_id=%s', (row['id'],)).rowcount
     n += conn.execute('DELETE FROM lifecycle_staging_cleanup WHERE enumeration_id=%s', (row['id'],)).rowcount
     n += conn.execute('DELETE FROM source_enumerations WHERE id=%s', (row['id'],)).rowcount
     return n
 
 
+def finalize_completed_producers(conn, limit=100):
+    """Complete only committed settled producer work, retaining compact floors.
+
+    Public-writer identities are transaction-specific. Dashboard and terminal
+    demand recovery covers interruption after the durable result and before its
+    normal finalization. Held accounting is never silently released here.
+    """
+    enter_gate(conn)
+    rows = conn.execute("""SELECT c.* FROM lifecycle_claims c WHERE state='active'
+      AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id()
+      AND (kind IN ('public_writer','dashboard','review_write') OR kind='demand' AND EXISTS(
+        SELECT FROM job_payload_demands d WHERE d.id::text=c.work_id
+          AND d.status IN ('ready','deferred','failed','cancelled')
+          AND d.settled_at<=clock_timestamp()-interval '180 seconds'))
+      AND EXISTS(SELECT FROM capacity_reservations r WHERE r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation)
+      AND NOT EXISTS(SELECT FROM capacity_reservations r WHERE r.claim_kind=c.kind AND r.claim_id=c.work_id
+        AND (r.state='held' OR r.transaction_id=pg_current_xact_id()))
+      ORDER BY c.kind,c.work_id LIMIT %s""", (min(limit,100),)).fetchall()
+    for row in rows:
+        cancel_claim(conn, ClaimRef(row['owner_token'],row['generation'],row['lease_until']))
+    return len(rows)
+
+
 def _terminal_batch(conn, limit, phase):
     if phase == 3:
+        finalized = finalize_completed_producers(conn, min(limit,100))
+        if finalized:
+            return finalized
         # Settled callbacks also need a retained generation fence before removing
         # the row. A current generation is left intact, however old its timestamp.
         return conn.execute('''DELETE FROM capacity_reservations WHERE id IN
           (SELECT r.id FROM capacity_reservations r JOIN lifecycle_claims c
            ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE r.state<>'held'
            AND r.terminal_at<=clock_timestamp()-interval '168 hours'
            AND c.replay_floor>=r.generation AND c.generation>r.generation
            ORDER BY r.terminal_at,r.id LIMIT %s)''', (limit,)).rowcount
     if phase == 4:
         rows = conn.execute('''SELECT d.id,d.job_id FROM job_payload_demands d
           WHERE d.status IN ('ready','deferred','failed','cancelled')
-          AND d.description_snapshot IS NULL AND d.questions_snapshot IS NULL
-          AND d.settled_at<=clock_timestamp()-interval '168 hours'
+          AND GREATEST(d.settled_at,d.consumed_at)<=clock_timestamp()-interval '168 hours'
+          AND (d.protection_until IS NULL OR d.protection_until<=clock_timestamp())
+          AND (d.consumed_at IS NULL OR d.consumption_applied_at>=d.consumed_at)
+          AND NOT EXISTS(SELECT FROM generation_jobs g WHERE g.user_id=d.user_id AND g.job_id=d.job_id AND g.status IN ('pending','running'))
+          AND NOT EXISTS(SELECT FROM job_payload_demands active WHERE active.user_id=d.user_id AND active.job_id=d.job_id
+            AND active.status IN ('pending','running') AND COALESCE(active.lease_until,active.protection_until)>clock_timestamp())
           AND NOT EXISTS(SELECT FROM lifecycle_claims c WHERE c.kind='demand' AND c.work_id=d.id::text
             AND (c.state='active' OR c.generation<=d.claim_generation OR c.replay_floor<GREATEST(d.claim_generation,1)))
           ORDER BY d.settled_at,d.id LIMIT %s''', (limit,)).fetchall()
         acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in rows]))
         rows = [r for r in rows if r['job_id'] in acquired]
         return conn.execute('DELETE FROM job_payload_demands WHERE id=ANY(%s)', ([r['id'] for r in rows],)).rowcount if rows else 0
     return conn.execute('''DELETE FROM lifecycle_write_checks WHERE id IN
       (SELECT id FROM lifecycle_write_checks WHERE created_at<=clock_timestamp()-interval '168 hours'
        ORDER BY created_at,id LIMIT %s)''', (limit,)).rowcount
 
diff --git a/job_discovery/lifecycle/operational.py b/job_discovery/lifecycle/operational.py
index 1d4904e..1213132 100644
--- a/job_discovery/lifecycle/operational.py
+++ b/job_discovery/lifecycle/operational.py
@@ -246,20 +246,22 @@ def complete(conn, source_id, sequence, claim, *, successful, failed=False):
        THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC' WHERE id=%s""",
         (
             "suspicious_empty" if suspicious else status,
             status == "complete",
             status == "complete",
             suspicious,
             status == "complete",
             source_id,
         ),
     )
+    from .followup import schedule
+    schedule(conn,source_id,claim,operational=True)
     return status
 
 
 def reconcile(conn, source_id, sequence, claim, *, limit=100):
     """Public bool API; callers still own the transaction."""
     return _reconcile(conn, source_id, sequence, claim, limit=limit)[0]
 
 
 def _reconcile(conn, source_id, sequence, claim, *, limit=100) -> tuple[bool, int]:
     if type(limit) is not int or not 1 <= limit <= 100:
@@ -350,33 +352,34 @@ def run_due(conn, *, max_boards, deadline, source_id=None):
             claim = claim_work(conn, "source", str(source["id"]), 180)
             if claim is None:
                 conn.rollback()
                 continue
             sequence, resuming = start(conn, source["id"], claim)
             conn.commit()
             if not resuming:
                 success = False
                 failed = False
                 pending = []
+                board_budget = None
                 try:
 
                     def pulse():
                         _receipt(conn, source["id"], claim)
                         conn.execute(
                             "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE owner_token=%s AND generation=%s",
                             (claim.owner_token, claim.generation),
                         )
                         conn.commit()
 
                     with source_budget(
                         min(60, max(0, deadline - monotonic())), 50, pulse
-                    ):
+                    ) as board_budget:
                         feed = ADAPTERS[source["ats"]](
                             source["public_board_ref"], fetch_details=False
                         )
                         for count, posting in enumerate(feed, 1):
                             if count > 10000:
                                 break
                             pending.append(
                                 (
                                     posting.external_id,
                                     "unlisted"
@@ -406,20 +409,22 @@ def run_due(conn, *, max_boards, deadline, source_id=None):
                     conn.commit()
                 status = complete(
                     conn,
                     source["id"],
                     sequence,
                     claim,
                     successful=success,
                     failed=failed,
                 )
                 conn.commit()
+                from .followup import run as run_followup
+                run_followup(conn,source,claim,board_budget,operational=True)
                 if status != "complete":
                     continue
             while monotonic() < deadline:
                 done, closed = _reconcile(conn, source["id"], sequence, claim)
                 conn.commit()
                 progress["closed_jobs"] += closed
                 if done:
                     progress["complete"] += 1
                     break
         except Exception as error:
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
index 57f31e1..b5e48ea 100644
--- a/job_discovery/lifecycle/reconcile.py
+++ b/job_discovery/lifecycle/reconcile.py
@@ -129,21 +129,21 @@ def resume_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef
 def _positive(conn, enum, listing, kind, observed_at):
     if kind not in {'seen','unlisted','removed','expired'}:
         return  # Missing URLs or failed direct checks are unknown, never closure.
     if enum.sequence < max(listing['last_membership_sequence'],listing['last_direct_verification_sequence']):
         return
     if listing['successful_last_observed_at'] and observed_at < listing['successful_last_observed_at']:
         return
     removed = kind in {'removed','expired'}
     with _write(conn, enum.claim, 'source_listings', listing['job_id']):
         conn.execute("""UPDATE source_listings SET successful_last_observed_at=%s,
-           successful_sighting_count=successful_sighting_count+%s,
+           successful_sighting_count=successful_sighting_count+%s,last_observation_kind='enumeration',
            last_membership_sequence=GREATEST(last_membership_sequence,%s),
            last_direct_verification_sequence=CASE WHEN %s THEN %s ELSE last_direct_verification_sequence END,
            source_availability=%s,consecutive_complete_misses=0,first_complete_miss_at=NULL
            WHERE id=%s""", (observed_at,0 if removed else 1,enum.sequence,removed,enum.sequence,
                            'closed' if removed else 'open',listing['id']))
     with _write(conn, enum.claim, 'jobs', listing['job_id']):
         conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
                      (removed,observed_at,listing['job_id']))
 
 
@@ -226,20 +226,23 @@ def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatu
     with _write(conn,enumeration.claim,'source_accounts'):
         conn.execute("""UPDATE source_accounts SET last_outcome=%s,
           last_complete_success_at=CASE WHEN %s='complete' THEN clock_timestamp() ELSE last_complete_success_at END,
           failure_streak=CASE WHEN %s='complete' THEN 0 ELSE failure_streak+1 END,
           suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
           next_due_at=(date_trunc('day',last_attempt_at AT TIME ZONE 'UTC')+interval '24 hours' *
              CASE WHEN exclusion_state='failure_disabled' AND %s<>'complete'
                   THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC'
           WHERE id=%s""", (outcome,status,status,suspicious,status,enumeration.source_id))
 
+    from .followup import schedule
+    schedule(conn,enumeration.source_id,enumeration.claim)
+
 
 def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool:
     """Preserve the public caller-owned transaction and bool completion API."""
     return _reconcile_chunk(conn, enumeration, limit)[0]
 
 
 def _reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> tuple[bool, int]:
     if type(limit) is not int or not 1 <= limit <= 500:
         raise ValueError('reconciliation limit must be 1..500')
     enter_gate(conn)
@@ -325,28 +328,29 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300, admission_allowed=T
         except StorageBlocked:
             result["storage_deferred"] += 1
             conn.rollback()
             cancel_claim(conn,claim)
             conn.commit()
             result["closed_jobs"] += verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline,source_id=source["id"])["closed_jobs"]
             break
         chunk = []
         verdict = SourceStatus(complete=resuming)
         renewed = monotonic()
+        board_budget = None
         if not resuming:
             try:
                 def pulse():
                     # No SQL transaction spans network, and each bounded request
                     # starts with a renewed lease (including empty duplicate pages).
                     renew_claim(conn,claim)
                     conn.commit()
-                with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
+                with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse) as board_budget:
                     postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
                     count = 0
                     for posting in postings:
                         count += 1
                         if count > BOARD_ROWS:
                             break
                         chunk.append(posting)
                         if len(chunk) >= ADMISSION_CHUNK_SIZE or monotonic()-renewed >= 20:
                             admitted = stage_postings(conn,enum,chunk,admission_allowed=admission_allowed)
                             conn.commit()
@@ -373,20 +377,22 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300, admission_allowed=T
                 verdict = SourceStatus(complete=False,failed=True)
                 conn.rollback()
         storage_deferred = False
         try:
             if chunk:
                 admitted = stage_postings(conn,enum,chunk,admission_allowed=admission_allowed)
                 conn.commit()
                 result['new_jobs'] += admitted
             complete_enumeration(conn,enum,verdict)
             conn.commit()
+            from .followup import run as run_followup
+            run_followup(conn,source,claim,board_budget)
             while True:
                 done, closed = _reconcile_chunk(conn,enum)
                 conn.commit()
                 result["closed_jobs"] += closed
                 if done or monotonic() >= deadline:
                     break
                 claim = renew_claim(conn,claim)
                 conn.commit()
                 enum = replace(enum,claim=claim)
             status = conn.execute('SELECT status FROM source_enumerations WHERE id=%s',(enum.id,)).fetchone()['status']
diff --git a/job_discovery/lifecycle/version_retention.py b/job_discovery/lifecycle/version_retention.py
new file mode 100644
index 0000000..dd9e11c
--- /dev/null
+++ b/job_discovery/lifecycle/version_retention.py
@@ -0,0 +1,61 @@
+"""Exact-proof local public-history compaction; never semantic edge removal."""
+from .config import read_control
+
+# At most 12 extra row effects/posting: 25*(8+12) <= 500.
+REPLACEMENT_RETIRE_ROWS = 12
+REFERENCES = ("jobs", "job_questions", "job_reviews", "review_corrections",
+              "application_packages", "resume_scores", "cover_letter_edits",
+              "generation_jobs", "job_payload_demands")
+UNREFERENCED = " AND ".join(
+    f"NOT EXISTS(SELECT FROM {table} WHERE {'description_version_id' if table == 'jobs' else 'job_version_id'}=v.id)"
+    for table in REFERENCES
+)
+ELIGIBLE = f"""EXISTS(SELECT FROM public_archive_version_coverage c
+ WHERE c.version_id=v.id AND c.source_listing_id=v.source_listing_id
+ AND c.version_revision=v.revision AND c.content_hash=v.content_hash)
+ AND NOT EXISTS(SELECT FROM public_pending_events WHERE aggregate_type='job_versions' AND aggregate_id=v.id::text)
+ AND {UNREFERENCED}
+ AND NOT EXISTS(SELECT FROM job_locations e WHERE e.job_version_id=v.id
+   AND NOT lifecycle_private.edge_compaction_ready('job_locations',e.id,v.id))
+ AND NOT EXISTS(SELECT FROM job_skills e WHERE e.job_version_id=v.id
+   AND NOT lifecycle_private.edge_compaction_ready('job_skills',e.id,v.id))"""
+COST = """1+(SELECT count(*) FROM job_locations WHERE job_version_id=v.id)
+ +(SELECT count(*) FROM job_skills WHERE job_version_id=v.id)"""
+BYTES = """octet_length(v.public_metadata::text)
+ +COALESCE((SELECT sum(octet_length(to_jsonb(e)::text)) FROM job_locations e WHERE job_version_id=v.id),0)
+ +COALESCE((SELECT sum(octet_length(to_jsonb(e)::text)) FROM job_skills e WHERE job_version_id=v.id),0)"""
+
+
+def replacement_plan(conn, listing):
+    rows = conn.execute(f"""SELECT v.id,v.revision,
+      v.recorded_at<=clock_timestamp()-interval '30 days' AS old,
+      ({ELIGIBLE}) AS eligible,({COST}) AS cost,({BYTES}) AS bytes
+      FROM job_versions v WHERE source_listing_id=%s ORDER BY revision LIMIT 12""", (listing["id"],)).fetchall()
+    if len(rows) > 11:
+        return None  # Maintenance drains inherited oversized histories first.
+    retire = [r for r in rows if r["old"]]
+    for row in rows:
+        if len(rows)-len(retire) < 11:
+            break
+        if row not in retire and row["eligible"]:
+            retire.append(row)
+    if not retire:
+        return [] if len(rows)<11 else None
+    ctl = read_control(conn)
+    if (ctl.safety_stage != "enforced" or not ctl.retirement_enabled or ctl.retirement_dry_run
+        or len(rows)-len(retire)>=11
+        or any(not row["eligible"] for row in retire)
+        or sum(row["cost"] for row in retire) > REPLACEMENT_RETIRE_ROWS
+        or sum(row["bytes"] for row in retire) > 64*1024**2):
+        return None
+    return retire
+
+
+def compact_versions(conn, ids):
+    if not ids:
+        return
+    # Caller has already moved the current pointer (replacement), or selected
+    # only superseded rows (maintenance), under the common gate + Job lock.
+    conn.execute("DELETE FROM job_locations WHERE job_version_id=ANY(%s)", (ids,))
+    conn.execute("DELETE FROM job_skills WHERE job_version_id=ANY(%s)", (ids,))
+    conn.execute("DELETE FROM job_versions WHERE id=ANY(%s)", (ids,))
diff --git a/migrations/2026-10-08-10-lifecycle-composition.sql b/migrations/2026-10-08-10-lifecycle-composition.sql
new file mode 100644
index 0000000..a4e4f9b
--- /dev/null
+++ b/migrations/2026-10-08-10-lifecycle-composition.sql
@@ -0,0 +1,212 @@
+-- Final functional composition: additive compact observation/follow-up state and
+-- exact archived edge storage retirement. Existing enforcement is unchanged.
+BEGIN;
+ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_demand_verification_id uuid;
+ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_observation_kind text
+ CHECK(last_observation_kind IN ('enumeration','demand','followup'));
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_due_at timestamptz;
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_status text
+ CHECK(followup_status IN ('pending','running','migration_review'));
+CREATE OR REPLACE FUNCTION lifecycle_private.edge_compaction_ready(t text, edge_id uuid, version_id uuid) RETURNS boolean
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT t IN ('job_locations','job_skills')
+ AND EXISTS(SELECT FROM public.public_archive_heads h JOIN public.public_archive_coverage c
+  ON c.aggregate_type=h.aggregate_type AND c.aggregate_id=h.aggregate_id AND c.revision=h.revision
+  JOIN public.public_archive_batch_markers m ON m.batch_id=c.batch_id
+  WHERE h.aggregate_type=t AND h.aggregate_id=edge_id::text)
+ AND NOT EXISTS(SELECT FROM public.public_pending_events WHERE aggregate_type=t AND aggregate_id=edge_id::text)
+ AND EXISTS(SELECT FROM public.job_versions v JOIN public.public_archive_version_coverage c
+  ON c.version_id=v.id AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash
+  WHERE v.id=$3)
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.edge_compaction_ready(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer; raw jsonb; oldraw jsonb; observed timestamptz; provenance_value text;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ -- Exact acknowledged local edge compaction retains the public history/head.
+ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('job_locations','job_skills') AND
+  lifecycle_private.edge_compaction_ready(TG_TABLE_NAME,(o->>'id')::uuid,(o->>'job_version_id')::uuid)
+  AND NOT EXISTS(SELECT FROM public.source_listings WHERE current_version_id=(o->>'job_version_id')::uuid)
+ THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+ IF sid IS NOT NULL THEN
+  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+ ELSE
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ END IF;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ raw:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ oldraw:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ observed:=NULLIF(raw->>'observed_at','')::timestamptz;
+ IF TG_TABLE_NAME='jobs' THEN
+  IF k='closed' THEN observed:=(raw->>'closed_at')::timestamptz;
+  ELSIF raw->>'last_seen_at' IS DISTINCT FROM oldraw->>'last_seen_at' THEN
+   observed:=(raw->>'last_seen_at')::timestamptz;
+  ELSIF k='reopened' THEN observed:=(SELECT successful_last_observed_at FROM public.source_listings WHERE job_id=aid ORDER BY successful_last_observed_at DESC NULLS LAST LIMIT 1);
+  END IF;
+ ELSIF TG_TABLE_NAME='source_listings' THEN
+  IF raw->>'successful_last_observed_at' IS DISTINCT FROM oldraw->>'successful_last_observed_at' THEN
+   observed:=(raw->>'successful_last_observed_at')::timestamptz;
+  ELSIF raw->>'content_changed_at' IS DISTINCT FROM oldraw->>'content_changed_at' THEN
+   observed:=(raw->>'content_changed_at')::timestamptz;
+  ELSIF k='closed' AND sid IS NOT NULL THEN
+   observed:=(SELECT completed_at FROM public.lifecycle_operational_sources WHERE source_id=sid);
+  ELSIF k='closed' THEN observed:=(SELECT completed_at FROM public.source_enumerations WHERE id=(raw->>'last_miss_enumeration_id')::uuid);
+  END IF;
+ END IF;
+ provenance_value:=CASE WHEN observed IS NOT NULL THEN 'source_observation' WHEN k='baseline' THEN 'current_baseline' ELSE 'database_change' END;
+ IF sid IS NOT NULL THEN
+  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp(),observed_at=observed,provenance=provenance_value
+   WHERE slot=slot_id;
+  RETURN NULL;
+ END IF;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body,observed_at,provenance)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o),observed,provenance_value);
+ RETURN NULL;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid; fields text[];
+BEGIN
+ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak','followup_due_at','last_followup_at','followup_status'];
+ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+ ELSIF t='jobs' THEN
+  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+  fields:=ARRAY['closed_at'];
+ ELSE RETURN false;
+ END IF;
+ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN true;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+ END IF;
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ -- Existing legacy artifacts can change status without fabricated input provenance.
+ -- All input, artifact, owner and identity columns must remain exactly unchanged.
+ IF TG_TABLE_NAME='application_packages' AND TG_OP='UPDATE'
+  AND n-ARRAY['status','applied_at','updated_at'] IS NOT DISTINCT FROM o-ARRAY['status','applied_at','updated_at']
+ THEN protection:=false; END IF;
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-08-10-lifecycle-composition.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/reviewer/db.py b/reviewer/db.py
index 54d2fbc..c1c4314 100644
--- a/reviewer/db.py
+++ b/reviewer/db.py
@@ -530,10 +530,34 @@ def attach_demand_snapshots(conn, candidates, user_id):
     if not read_control(conn).hydration_enabled:
         return candidates if legacy_description_capture_allowed(conn) else []
     result = []
     for candidate in candidates:
         row = conn.execute("""SELECT id AS demand_id,job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at
             FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind='review' AND status='ready'
             ORDER BY settled_at DESC LIMIT 1""", (_uuid(user_id),candidate['id'])).fetchone()
         if row and row['job_version_id'] and row['description_snapshot']:
             result.append({**candidate, **row, 'description': row['description_snapshot']})
     return result
+
+
+def pin_review_inputs(conn, user_id, candidates):
+    """Renew only the exact attached review input, without recording use."""
+    from job_discovery.lifecycle.locks import lock_jobs
+    from psycopg.types.json import Jsonb
+    pinned = sorted((c for c in candidates if c.get('demand_id')), key=lambda c: c['id'])
+    try:
+        for start in range(0,len(pinned),100):
+            chunk = pinned[start:start+100]
+            lock_jobs(conn,[c['id'] for c in chunk])
+            for row in chunk:
+                updated = conn.execute("""UPDATE job_payload_demands SET protection_until=clock_timestamp()+interval '180 seconds'
+                  WHERE id=%s AND user_id=%s AND job_id=%s AND kind='review' AND status='ready'
+                  AND job_version_id=%s AND description_snapshot=%s
+                  AND questions_snapshot IS NOT DISTINCT FROM %s RETURNING id""",
+                  (row['demand_id'],_uuid(user_id),row['id'],row['job_version_id'],row['description_snapshot'],
+                   Jsonb(row['questions_snapshot']) if row.get('questions_snapshot') is not None else None)).fetchone()
+                if not updated:
+                    raise RuntimeError('Review input unavailable; retry hydration')
+            conn.commit()
+    except Exception:
+        conn.rollback()
+        raise
diff --git a/reviewer/run.py b/reviewer/run.py
index 4da1c1c..b3dee00 100644
--- a/reviewer/run.py
+++ b/reviewer/run.py
@@ -207,20 +207,49 @@ async def _traced_review(candidate: dict, inner, *, user_id: str | None = None,
 
 async def review_one(candidate: dict, profile_block: str, client,
                      *, user_id: str | None = None, run_id=None) -> ReviewResult:
     return await _traced_review(
         candidate,
         lambda: _review_one_inner(candidate, profile_block, client),
         user_id=user_id, run_id=run_id,
     )
 
 
+INPUT_PIN_RENEW_SECONDS = 30
+
+
+async def review_with_input_pins(conn, user_id, candidates, operation):
+    """Keep exact temporary input alive for the full actual consumer lifetime.
+
+    Synchronous DB callbacks share the event loop and never overlap connection
+    use. Every pin transaction commits before awaiting provider work.
+    """
+    if not any(c.get('demand_id') for c in candidates):
+        return await operation()
+    db.pin_review_inputs(conn,user_id,candidates)
+    async def renew():
+        while True:
+            await asyncio.sleep(INPUT_PIN_RENEW_SECONDS)
+            db.pin_review_inputs(conn,user_id,candidates)
+    consumer = asyncio.create_task(operation())
+    heartbeat = asyncio.create_task(renew())
+    try:
+        done, _ = await asyncio.wait((consumer,heartbeat),return_when=asyncio.FIRST_COMPLETED)
+        if heartbeat in done:
+            await heartbeat  # Renewal failure stops further provider work.
+        return await consumer
+    finally:
+        heartbeat.cancel()
+        consumer.cancel()
+        await asyncio.gather(heartbeat,consumer,return_exceptions=True)
+
+
 async def review_batch(candidates: list[dict], profile_block: str, client,
                        concurrency: int, *, user_id: str | None = None,
                        run_id=None,
                        deleted_check: Callable[[], bool] | None = None,
                        on_results: Callable[[list[ReviewResult]], None] | None = None,
                        ) -> tuple[list[ReviewResult], bool]:
     """Gate candidates through batched stage-1 calls, streaming each chunk's results.
 
     Per-chunk pipeline: each STAGE1_BATCH_SIZE-sized chunk is stage-1 screened, then its
     own passers run stage 2, then the chunk's terminal results are emitted — BEFORE the
@@ -546,28 +575,28 @@ def _review_user(conn, profile: dict, ent: dict | None = None,
             # end of run). Per-chunk commits do NOT release the session advisory lock — only
             # unlock_user_review does (M-TOCTOU).
             conn.commit()
 
         conn.commit()  # Candidate/usage reads must not span model work.
         def deleted_check():
             deleted = db.user_deleted(conn, user_id)
             conn.commit()
             return deleted
 
-        _, halted = asyncio.run(review_batch(
+        _, halted = asyncio.run(review_with_input_pins(conn,user_id,candidates,lambda: review_batch(
             candidates, profile_block, client, config.CONCURRENCY,
             user_id=user_id, run_id=run_id,
             # Cheap per-chunk poll so a mid-run deletion stops issuing LLM calls instead
             # of grinding all ≤cap jobs whose writes the tombstone guard then discards.
             deleted_check=deleted_check,
             on_results=_persist_chunk,
-        ))
+        )))
 
         # M-RESURRECT-2 (final note): the account can be erased mid-run. The per-chunk
         # guard already skips writes; here we set the run note. The deletion note REPLACES
         # any overflow note and is checked BEFORE the credits-halt note so a
         # deletion-aborted run (which also sets halt) isn't mislabeled "out of credits".
         # Cheap EXISTS; the run row still closes below.
         if db.user_deleted(conn, user_id):
             notes = "account deleted mid-run; skipped writes"
             log.info("account %s deleted mid-run; skipping writes", user_id)
             return
diff --git a/schema.sql b/schema.sql
index e947224..fda3bf6 100644
--- a/schema.sql
+++ b/schema.sql
@@ -3422,10 +3422,223 @@ BEGIN
    RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
  END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC,anon,authenticated;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-07-09-lifecycle-readiness.sql') ON CONFLICT DO NOTHING;
 COMMIT;
 
 -- Accepted Task10 definitions above are already mirrored; record both fix migrations.
 INSERT INTO schema_migrations(filename) VALUES ('2026-10-03-05-public-outbox-fix1.sql'),('2026-10-03-06-public-outbox-fix2.sql') ON CONFLICT DO NOTHING;
+
+-- Final functional composition: additive compact observation/follow-up state and
+-- exact archived edge storage retirement. Existing enforcement is unchanged.
+BEGIN;
+ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_demand_verification_id uuid;
+ALTER TABLE source_listings ADD COLUMN IF NOT EXISTS last_observation_kind text
+ CHECK(last_observation_kind IN ('enumeration','demand','followup'));
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_due_at timestamptz;
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;
+ALTER TABLE source_accounts ADD COLUMN IF NOT EXISTS followup_status text
+ CHECK(followup_status IN ('pending','running','migration_review'));
+CREATE OR REPLACE FUNCTION lifecycle_private.edge_compaction_ready(t text, edge_id uuid, version_id uuid) RETURNS boolean
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT t IN ('job_locations','job_skills')
+ AND EXISTS(SELECT FROM public.public_archive_heads h JOIN public.public_archive_coverage c
+  ON c.aggregate_type=h.aggregate_type AND c.aggregate_id=h.aggregate_id AND c.revision=h.revision
+  JOIN public.public_archive_batch_markers m ON m.batch_id=c.batch_id
+  WHERE h.aggregate_type=t AND h.aggregate_id=edge_id::text)
+ AND NOT EXISTS(SELECT FROM public.public_pending_events WHERE aggregate_type=t AND aggregate_id=edge_id::text)
+ AND EXISTS(SELECT FROM public.job_versions v JOIN public.public_archive_version_coverage c
+  ON c.version_id=v.id AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash
+  WHERE v.id=$3)
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.edge_compaction_ready(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer; raw jsonb; oldraw jsonb; observed timestamptz; provenance_value text;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ -- Exact acknowledged local edge compaction retains the public history/head.
+ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('job_locations','job_skills') AND
+  lifecycle_private.edge_compaction_ready(TG_TABLE_NAME,(o->>'id')::uuid,(o->>'job_version_id')::uuid)
+  AND NOT EXISTS(SELECT FROM public.source_listings WHERE current_version_id=(o->>'job_version_id')::uuid)
+ THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+ IF sid IS NOT NULL THEN
+  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+ ELSE
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ END IF;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ raw:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ oldraw:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ observed:=NULLIF(raw->>'observed_at','')::timestamptz;
+ IF TG_TABLE_NAME='jobs' THEN
+  IF k='closed' THEN observed:=(raw->>'closed_at')::timestamptz;
+  ELSIF raw->>'last_seen_at' IS DISTINCT FROM oldraw->>'last_seen_at' THEN
+   observed:=(raw->>'last_seen_at')::timestamptz;
+  ELSIF k='reopened' THEN observed:=(SELECT successful_last_observed_at FROM public.source_listings WHERE job_id=aid ORDER BY successful_last_observed_at DESC NULLS LAST LIMIT 1);
+  END IF;
+ ELSIF TG_TABLE_NAME='source_listings' THEN
+  IF raw->>'successful_last_observed_at' IS DISTINCT FROM oldraw->>'successful_last_observed_at' THEN
+   observed:=(raw->>'successful_last_observed_at')::timestamptz;
+  ELSIF raw->>'content_changed_at' IS DISTINCT FROM oldraw->>'content_changed_at' THEN
+   observed:=(raw->>'content_changed_at')::timestamptz;
+  ELSIF k='closed' AND sid IS NOT NULL THEN
+   observed:=(SELECT completed_at FROM public.lifecycle_operational_sources WHERE source_id=sid);
+  ELSIF k='closed' THEN observed:=(SELECT completed_at FROM public.source_enumerations WHERE id=(raw->>'last_miss_enumeration_id')::uuid);
+  END IF;
+ END IF;
+ provenance_value:=CASE WHEN observed IS NOT NULL THEN 'source_observation' WHEN k='baseline' THEN 'current_baseline' ELSE 'database_change' END;
+ IF sid IS NOT NULL THEN
+  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp(),observed_at=observed,provenance=provenance_value
+   WHERE slot=slot_id;
+  RETURN NULL;
+ END IF;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body,observed_at,provenance)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o),observed,provenance_value);
+ RETURN NULL;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid; fields text[];
+BEGIN
+ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak','followup_due_at','last_followup_at','followup_status'];
+ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+ ELSIF t='jobs' THEN
+  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+  fields:=ARRAY['closed_at'];
+ ELSE RETURN false;
+ END IF;
+ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN true;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+ END IF;
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ -- Existing legacy artifacts can change status without fabricated input provenance.
+ -- All input, artifact, owner and identity columns must remain exactly unchanged.
+ IF TG_TABLE_NAME='application_packages' AND TG_OP='UPDATE'
+  AND n-ARRAY['status','applied_at','updated_at'] IS NOT DISTINCT FROM o-ARRAY['status','applied_at','updated_at']
+ THEN protection:=false; END IF;
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-08-10-lifecycle-composition.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/tests/test_lifecycle_demand.py b/tests/test_lifecycle_demand.py
index f06a006..57be826 100644
--- a/tests/test_lifecycle_demand.py
+++ b/tests/test_lifecycle_demand.py
@@ -522,31 +522,27 @@ def test_retained_package_creates_a_new_private_copy_without_network_or_old_hist
         """INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,resume_json)
         VALUES(%s,%s,%s,%s,'{"questions":[]}',%s,'{"name":"Retained"}')""",
         (
             owner,
             job,
             source["job_version_id"],
             source["description_snapshot"],
             source["snapshot_captured_at"],
         ),
     )
-    from job_discovery.lifecycle.claims import cancel_claim
-    from job_discovery.lifecycle.types import ClaimRef
-
-    cancel_claim(
-        conn,
-        ClaimRef(
-            source["claim_owner_token"],
-            source["claim_generation"],
-            source["lease_until"],
-        ),
-    )
+    completed = conn.execute(
+        "SELECT state,generation,replay_floor FROM lifecycle_claims WHERE kind='demand' AND work_id=%s",
+        (str(original.id),),
+    ).fetchone()
+    assert completed["state"] == "cancelled"
+    assert completed["generation"] > source["claim_generation"]
+    assert completed["replay_floor"] >= source["claim_generation"]
     conn.execute("DELETE FROM job_payload_demands WHERE id=%s", (original.id,))
     conn.commit()
     copy = request_demand(conn, job, owner, "generation")
     conn.commit()
     assert copy.id != original.id
 
     def no_network(_):
         raise AssertionError("retained private input needs no source fetch")
 
     assert hydrate_demand(conn, copy, no_network) == "ready"
diff --git a/tests/test_lifecycle_final_fix1.py b/tests/test_lifecycle_final_fix1.py
new file mode 100644
index 0000000..a0016a7
--- /dev/null
+++ b/tests/test_lifecycle_final_fix1.py
@@ -0,0 +1,329 @@
+"""Final ordinary composition regressions. No omitted mechanism probes."""
+from time import monotonic
+from uuid import uuid4
+
+import pytest
+
+from tests.conftest import requires_db
+from tests.test_lifecycle_reconcile import setup_source, begin
+from tests.test_lifecycle_admission import admit
+from tests.archive_helpers import activate_fixture
+from tests.test_archive_batches import verified
+from job_discovery.models import Posting
+from job_discovery.lifecycle import demand, maintenance, reconcile, operational
+from job_discovery.lifecycle.claims import claim_work, cancel_claim
+from job_discovery.archive import batches
+from job_discovery.archive.types import BatchLimits
+
+
+def retirement_fixture(conn):
+    conn.execute("ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history")
+    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced',retirement_enabled=true,retirement_dry_run=false,activation_generation=activation_generation+1")
+    conn.execute("ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history")
+    conn.commit()
+
+
+def acknowledge(conn):
+    claim = claim_work(conn, "archive", str(uuid4()), 180)
+    conn.commit()
+    while conn.execute("SELECT 1 FROM public_pending_events LIMIT 1").fetchone():
+        ref = batches.claim_batch(conn, BatchLimits(), claim)
+        conn.commit()
+        seal = batches.seal_batch(ref)
+        batches.persist_seal(conn, seal)
+        conn.commit()
+        batches.ack_batch(conn, verified(seal), claim)
+        conn.commit()
+    cancel_claim(conn, claim)
+    conn.commit()
+
+
+def posting(title="Role", location=None, body="JD"):
+    return Posting("0", title, "https://example.test/job", location=location,
+                   raw={"descriptionPlain": body})
+
+
+@requires_db
+@pytest.mark.parametrize("case", ["old_current", "count", "old_location"])
+def test_archived_admission_resumes_at_prospective_bound(conn, case):
+    source = setup_source(conn)
+    if case == "old_location":
+        conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES('London',ARRAY['London'],'[]','manual')")
+    activate_fixture(conn)
+    _, claim = admit(conn, source, [posting(location="London" if case == "old_location" else None)])
+    if case == "count":
+        for i in range(2, 12):
+            admit(conn, source, [posting(title=f"Role {i}")], claim)
+    else:
+        conn.execute("UPDATE job_versions SET recorded_at=clock_timestamp()-interval '31 days'")
+        conn.commit()
+    acknowledge(conn)
+    old = conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"]
+    retirement_fixture(conn)
+    admit(conn, source, [posting(title="Changed", location="London" if case == "old_location" else None)], claim)
+    current = conn.execute("SELECT current_version_id,current_revision FROM source_listings").fetchone()
+    assert current["current_version_id"] != old
+    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Changed"
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] <= 11
+    assert not conn.execute("SELECT 1 FROM job_versions v JOIN source_listings l ON l.id=v.source_listing_id WHERE v.id<>l.current_version_id AND v.recorded_at<clock_timestamp()-interval '30 days'").fetchone()
+    if case == "old_location":
+        assert conn.execute("SELECT location_id FROM job_locations WHERE job_version_id=%s",(current["current_version_id"],)).fetchone()["location_id"] == "London"
+        assert conn.execute("SELECT count(*) n FROM public_archive_coverage WHERE aggregate_type='job_locations'").fetchone()["n"] == 1
+    assert not conn.execute("SELECT 1 FROM public_pending_events WHERE aggregate_type IN ('job_versions','job_locations','job_skills') AND kind='removed'").fetchone()
+
+
+@requires_db
+@pytest.mark.parametrize("protected", [False, True])
+def test_unarchived_or_private_versions_still_pause(conn, protected):
+    source = setup_source(conn)
+    activate_fixture(conn)
+    _, claim = admit(conn, source, [posting()])
+    old = conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"]
+    conn.execute("UPDATE job_versions SET recorded_at=clock_timestamp()-interval '31 days'")
+    if protected:
+        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot) VALUES(%s,'lever:fixture:0',%s,'Saved JD')", (uuid4(), old))
+    conn.commit()
+    if protected:
+        acknowledge(conn)
+    retirement_fixture(conn)
+    admit(conn, source, [posting(title="Changed")], claim)
+    assert conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"] == old
+    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Role"
+
+
+@requires_db
+@pytest.mark.parametrize("close_during_fetch", [False,True])
+def test_live_demand_records_one_positive_and_defeats_older_absence(conn, close_during_fetch):
+    source = setup_source(conn)
+    conn.execute("UPDATE source_listings SET consecutive_complete_misses=1,first_complete_miss_at=clock_timestamp()-interval '25 hours'")
+    older = begin(conn, source)
+    before = conn.execute("SELECT * FROM source_listings").fetchone()
+    request = demand.request_demand(conn, before["job_id"], str(uuid4()), "description")
+    conn.commit()
+    def fetch(_):
+        assert conn.info.transaction_status.name == "IDLE"
+        if close_during_fetch:
+            reconcile.complete_enumeration(conn, older, reconcile.SourceStatus(complete=True))
+            reconcile.reconcile_chunk(conn, older)
+            conn.commit()
+            assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is not None
+            conn.commit()
+        return {"description":"Live JD"}
+    assert demand.hydrate_demand(conn, request, fetch) == "ready"
+    after = conn.execute("SELECT * FROM source_listings").fetchone()
+    assert after["successful_sighting_count"] == before["successful_sighting_count"] + 1
+    assert after["last_demand_verification_id"] == request.id
+    assert after["last_observation_kind"] == "demand"
+    assert after["consecutive_complete_misses"] == 0
+    assert after["discovery_anchor_at"] == before["discovery_anchor_at"]
+    assert demand.hydrate_demand(conn, request, lambda _: pytest.fail("ready reuse fetched")) == "ready"
+    if not close_during_fetch:
+        reconcile.complete_enumeration(conn, older, reconcile.SourceStatus(complete=True))
+        reconcile.reconcile_chunk(conn, older)
+        conn.commit()
+    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
+    assert conn.execute("SELECT successful_sighting_count FROM source_listings").fetchone()["successful_sighting_count"] == after["successful_sighting_count"]
+
+
+@requires_db
+def test_poll_and_live_demand_share_unicode_hash(conn):
+    source = setup_source(conn)
+    admit(conn, source, [posting(body="Cafe\u0301   team")])
+    before = conn.execute("SELECT current_version_id FROM source_listings").fetchone()
+    request = demand.request_demand(conn, "lever:fixture:0", str(uuid4()), "description")
+    conn.commit()
+    assert demand.hydrate_demand(conn, request, lambda _: {"description": "Cafe\u0301 team"}) == "ready"
+    assert conn.execute("SELECT current_version_id FROM source_listings").fetchone() == before
+
+
+@requires_db
+def test_detail_capture_and_bookkeeping_retire_without_erasing_saved_inputs(conn):
+    setup_source(conn, count=3)
+    requests = []
+    for i in range(3):
+        request = demand.request_demand(conn, f"lever:fixture:{i}", str(uuid4()), "description")
+        conn.commit()
+        assert demand.hydrate_demand(conn, request, lambda _: {"description": "Live JD"}) == "ready"
+        requests.append(request)
+    assert conn.execute("SELECT count(*) n FROM lifecycle_claims WHERE kind='demand' AND state='active'").fetchone()["n"] == 0
+    conn.execute("UPDATE job_payload_demands SET settled_at=clock_timestamp()-interval '8 days',snapshot_captured_at=clock_timestamp()-interval '31 days',protection_until=clock_timestamp()-interval '1 hour'")
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+    conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at) SELECT user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at FROM job_payload_demands WHERE id=%s", (requests[1].id,))
+    conn.execute("INSERT INTO generation_jobs(user_id,job_id,kind,job_version_id,description_snapshot,snapshot_captured_at) SELECT user_id,job_id,'resume',job_version_id,description_snapshot,snapshot_captured_at FROM job_payload_demands WHERE id=%s", (requests[2].id,))
+    conn.commit()
+    assert maintenance._terminal_batch(conn, 100, 4) == 2
+    conn.commit()
+    assert maintenance._payload_batch(conn, None, 100, False)[1] == 1
+    conn.commit()
+    assert conn.execute("SELECT description FROM jobs WHERE id='lever:fixture:0'").fetchone()["description"] is None
+    assert conn.execute("SELECT description_snapshot FROM application_packages").fetchone()["description_snapshot"] == "Live JD"
+    assert conn.execute("SELECT description_snapshot FROM job_payload_demands WHERE id=%s", (requests[2].id,)).fetchone()["description_snapshot"] == "Live JD"
+    next_request = demand.request_demand(conn, "lever:fixture:0", str(uuid4()), "description")
+    conn.commit()
+    assert next_request.id != requests[0].id
+    assert demand.hydrate_demand(conn, next_request, lambda _: {"description": "Fresh JD"}) == "ready"
+
+
+@requires_db
+def test_actual_public_writer_reaches_terminal_cleanup(conn):
+    from job_discovery.db import sync_seed
+    activate_fixture(conn)
+    sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "fixture"}])
+    conn.commit()
+    maintenance.finalize_completed_producers(conn, 100)
+    conn.commit()
+    row = conn.execute("SELECT * FROM lifecycle_claims WHERE kind='public_writer'").fetchone()
+    assert row["state"] == "cancelled" and row["generation"] > row["replay_floor"] >= 1
+    # Move only the maintenance retention cutoff, never old mechanism clocks.
+    class TerminalCutoff:
+        def execute(self, query, params=None):
+            return conn.execute(query.replace("clock_timestamp()-interval '168 hours'", "clock_timestamp()+interval '1 hour'"), params)
+    assert maintenance._terminal_batch(TerminalCutoff(), 100, 3) > 0
+    conn.commit()
+    assert conn.execute("SELECT count(*) n FROM capacity_reservations WHERE claim_kind='public_writer'").fetchone()["n"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize("copy_private", [False,True])
+def test_failed_fetch_and_private_copy_are_not_source_observations(conn,copy_private):
+    setup_source(conn)
+    user = str(uuid4())
+    first = demand.request_demand(conn,"lever:fixture:0",user,"description")
+    conn.commit()
+    assert demand.hydrate_demand(conn,first,lambda _: {"description":"Original JD"}) == "ready"
+    before = conn.execute("SELECT successful_sighting_count,successful_last_observed_at FROM source_listings").fetchone()
+    if copy_private:
+        conn.execute("""INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at,resume_json)
+          SELECT user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at,'{}' FROM job_payload_demands WHERE id=%s""",(first.id,))
+        conn.execute("DELETE FROM job_payload_demands WHERE id=%s",(first.id,))
+    request = demand.request_demand(conn,"lever:fixture:0",user,"generation")
+    conn.commit()
+    def fetch(_):
+        if copy_private:
+            pytest.fail("private copy fetched a source")
+        return None
+    assert demand.hydrate_demand(conn,request,fetch) == ("ready" if copy_private else "deferred")
+    assert conn.execute("SELECT successful_sighting_count,successful_last_observed_at FROM source_listings").fetchone() == before
+
+
+@requires_db
+def test_delivered_detail_questions_apply_use_to_matching_capture_only(conn):
+    from psycopg.types.json import Jsonb
+    setup_source(conn,ats="greenhouse")
+    request = demand.request_demand(conn,"greenhouse:fixture:0",str(uuid4()),"description")
+    conn.commit()
+    questions = {"questions":[]}
+    assert demand.hydrate_demand(conn,request,lambda _: {"description":"Detail JD","questions":questions}) == "ready"
+    row = conn.execute("SELECT * FROM job_payload_demands WHERE id=%s",(request.id,)).fetchone()
+    conn.execute("INSERT INTO job_questions(job_id,job_version_id,questions,captured_at) VALUES(%s,%s,%s,clock_timestamp())",(request.job_id,row['job_version_id'],Jsonb(questions)))
+    conn.execute("UPDATE job_payload_demands SET consumed_at=clock_timestamp() WHERE id=%s",(request.id,))
+    conn.commit()
+    demand.apply_consumptions(conn)
+    assert conn.execute("SELECT last_used_at FROM job_questions").fetchone()["last_used_at"] == conn.execute("SELECT consumed_at FROM job_payload_demands WHERE id=%s",(request.id,)).fetchone()["consumed_at"]
+    before = conn.execute("SELECT last_used_at FROM job_questions").fetchone()["last_used_at"]
+    conn.execute("UPDATE job_questions SET questions=%s",(Jsonb({"questions":[{"label":"New question"}]}),))
+    conn.execute("UPDATE job_payload_demands SET consumed_at=clock_timestamp() WHERE id=%s",(request.id,))
+    conn.commit()
+    demand.apply_consumptions(conn)
+    assert conn.execute("SELECT last_used_at FROM job_questions").fetchone()["last_used_at"] == before
+
+
+@requires_db
+@pytest.mark.parametrize("lane", ["normal", "operational"])
+@pytest.mark.parametrize("response", ["unknown", "failed", "live"])
+def test_suspicious_empty_scheduler_has_finite_followup(conn, monkeypatch, caplog, lane, response):
+    from job_discovery.adapters.completeness import SourceResult
+    source = setup_source(conn, count=21)
+    calls = []
+    monkeypatch.setitem(__import__("job_discovery.adapters", fromlist=["ADAPTERS"]).ADAPTERS, "lever", lambda *a, **kw: SourceResult(iter([]), reconcile.SourceStatus()))
+    def exact_response(url, **kwargs):
+        assert conn.info.transaction_status.name == "IDLE"
+        calls.append(url)
+        if response == "failed":
+            raise ValueError("offline request failed")
+        if response == "live":
+            return {"id":url.rsplit('/',1)[-1].split('?')[0],"descriptionPlain":"Still live"}
+        return None
+    monkeypatch.setattr("job_discovery.http.get_json", exact_response)
+    if lane == "operational":
+        claim = claim_work(conn, "source", str(source["id"]), 180)
+        operational.provision(conn, source["id"], claim)
+        conn.commit()
+        cancel_claim(conn, claim)
+        conn.commit()
+    for _ in range(3):
+        conn.execute("UPDATE source_accounts SET next_due_at=NULL")
+        conn.commit()
+        if lane == "normal":
+            reconcile.verify_due_sources(conn, max_boards=1, admission_allowed=False)
+        else:
+            operational.run_due(conn, max_boards=1, deadline=monotonic()+60)
+    assert len(calls) == 3
+    assert len(set(calls)) == 3
+    assert conn.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NULL").fetchone()["n"] == 21
+    assert conn.execute("SELECT followup_status FROM source_accounts").fetchone()["followup_status"] == "migration_review"
+    assert "migration review" in caplog.text
+
+
+@requires_db
+def test_completion_recovery_retains_unfinished_accounting(conn):
+    from job_discovery.lifecycle.capacity import reserve_capacity
+    claim = claim_work(conn,"public_writer","unfinished-local-fixture",180)
+    reservation = reserve_capacity(conn,claim,8192)
+    conn.commit()
+    assert maintenance.finalize_completed_producers(conn,100) == 0
+    conn.commit()
+    assert conn.execute("SELECT state FROM capacity_reservations WHERE id=%s",(reservation.id,)).fetchone()["state"] == "held"
+    assert conn.execute("SELECT state FROM lifecycle_claims WHERE owner_token=%s",(claim.owner_token,)).fetchone()["state"] == "active"
+
+
+@requires_db
+def test_actual_async_review_retains_exact_input_during_consumer(conn, monkeypatch):
+    import asyncio
+    import reviewer.run as run
+    import reviewer.db as review_db
+    from tests.test_reviewer_run import StubClient
+    setup_source(conn)
+    user = str(uuid4())
+    request = demand.request_demand(conn, "lever:fixture:0", user, "review")
+    conn.commit()
+    assert demand.hydrate_demand(conn,request,lambda _: {"description":"Review JD"}) == "ready"
+    conn.execute("UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1")
+    conn.execute("UPDATE job_payload_demands SET settled_at=clock_timestamp()-interval '8 days',protection_until=clock_timestamp()-interval '1 hour'")
+    candidates = review_db.attach_demand_snapshots(conn,[{"id":"lever:fixture:0","title":"Role","company_name":"Fixture"}],user)
+    conn.commit()
+    class Consumer(StubClient):
+        async def stage2(self, **kwargs):
+            before = conn.execute("SELECT protection_until FROM job_payload_demands WHERE id=%s",(request.id,)).fetchone()["protection_until"]
+            conn.commit()
+            await asyncio.sleep(0.05)
+            assert conn.info.transaction_status.name == "IDLE"
+            after = conn.execute("SELECT protection_until FROM job_payload_demands WHERE id=%s",(request.id,)).fetchone()["protection_until"]
+            assert after > before
+            assert maintenance._terminal_batch(conn,100,4) == 0
+            conn.commit()
+            return await super().stage2(**kwargs)
+    monkeypatch.setattr(run,"INPUT_PIN_RENEW_SECONDS",0.01,raising=False)
+    def persist(results):
+        for result in results:
+            review_db.upsert_review(conn,result.as_row(user_id=user,profile_version="v1"))
+        conn.commit()
+    results, halted = asyncio.run(run.review_with_input_pins(conn,user,candidates,lambda: run.review_batch(candidates,"",Consumer(),1,on_results=persist)))
+    assert not halted and results[0].verdict == "approve"
+    assert conn.execute("SELECT description_snapshot FROM job_reviews").fetchone()["description_snapshot"] == "Review JD"
+    demand.apply_consumptions(conn)
+    assert maintenance.finalize_completed_producers(conn,100) >= 1
+    conn.commit()
+    completed = conn.execute("SELECT * FROM lifecycle_claims WHERE kind='review_write'").fetchone()
+    assert completed['state'] == 'cancelled' and completed['generation'] > completed['replay_floor'] >= 1
+    conn.execute("UPDATE job_payload_demands SET protection_until=clock_timestamp()-interval '1 hour'")
+    conn.commit()
+    class LaterRetention:
+        def execute(self, query, params=None):
+            return conn.execute(query.replace("clock_timestamp()-interval '168 hours'","clock_timestamp()+interval '1 hour'"),params)
+    assert maintenance._terminal_batch(LaterRetention(),100,4) == 1
+    conn.commit()
+    assert maintenance._terminal_batch(LaterRetention(),100,3) >= 1
+    conn.commit()
+    assert not conn.execute("SELECT 1 FROM capacity_reservations WHERE claim_kind='review_write'").fetchone()
+    assert conn.execute("SELECT description_snapshot FROM job_reviews").fetchone()["description_snapshot"] == "Review JD"
diff --git a/tests/test_lifecycle_maintenance.py b/tests/test_lifecycle_maintenance.py
index ddd999c..96ce0a8 100644
--- a/tests/test_lifecycle_maintenance.py
+++ b/tests/test_lifecycle_maintenance.py
@@ -287,41 +287,40 @@ def test_deleted_reservation_detail_requires_persisted_claim_floor(conn):
     conn.commit()
     # Terminal timestamps are immutable; verify recent fenced details remain.
     assert m._terminal_batch(conn,2000,3) == 0
     conn.commit()
     assert conn.execute('SELECT state FROM capacity_reservations WHERE id=%s',(reservation.id,)).fetchone()['state'] == 'fenced'
     assert conn.execute("SELECT replay_floor FROM lifecycle_claims WHERE kind='test-retention'").fetchone()['replay_floor'] == c.generation
 
 
 @requires_db
 def test_only_safely_archived_unreferenced_superseded_versions_retire(conn):
-    from job_discovery.lifecycle.identity import migrate_identity_batch
+    from tests.test_lifecycle_reconcile import setup_source
+    from tests.test_lifecycle_admission import admit
+    from tests.test_lifecycle_final_fix1 import acknowledge, posting, retirement_fixture
+    from tests.archive_helpers import activate_fixture
     from job_discovery.lifecycle.locks import enter_gate
-    m = module()
-    cid = _company(conn,'versions')
-    jid = _job(conn,cid,'1')
-    migrate_identity_batch(conn)
-    listing = conn.execute('SELECT id FROM source_listings WHERE job_id=%s',(jid,)).fetchone()['id']
-    for revision in range(1,16):
-        conn.execute("""INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
-          VALUES(%s,%s,%s,repeat('a',64),'{}',clock_timestamp(),clock_timestamp()-make_interval(hours=>%s))""",
-          (jid,listing,revision,745 if revision in (5,6) else 1))
-    conn.execute('UPDATE jobs SET description_version_id=(SELECT id FROM job_versions WHERE revision=1)')
-    conn.execute('UPDATE source_listings SET current_revision=15,archived_revision=5,current_version_id=(SELECT id FROM job_versions WHERE revision=15)')
-    conn.commit()
+    source = setup_source(conn)
+    activate_fixture(conn)
+    _, claim = admit(conn,source,[posting()])
+    for i in range(2,12):
+        admit(conn,source,[posting(title=f"Role {i}")],claim)
+    acknowledge(conn)
+    retirement_fixture(conn)
     enter_gate(conn)
-    n,retired,_ = m._version_batch(conn,2000,False)
+    n, retired, _ = module()._version_batch(conn,100,False)
     conn.commit()
-    assert n == retired == 4  # 2/3/4 exceed ten superseded; 5 is >30d.
-    remaining = [r['revision'] for r in conn.execute('SELECT revision FROM job_versions ORDER BY revision')]
-    assert remaining == [1,*range(6,16)]  # 1 referenced, 6 unarchived, 15 current.
-    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid
+    assert n == retired == 1
+    assert [r['revision'] for r in conn.execute('SELECT revision FROM job_versions ORDER BY revision')] == list(range(2,12))
+    admit(conn,source,[posting(title="Next revision")],claim)
+    assert conn.execute('SELECT current_revision FROM source_listings').fetchone()['current_revision'] == 12
+    assert conn.execute('SELECT count(*) n FROM job_versions').fetchone()['n'] == 11
 
 
 @requires_db
 def test_terminal_retention_deletes_only_fenced_details_and_preserves_held(conn):
     from job_discovery.lifecycle.claims import claim_work, cancel_claim
     from job_discovery.lifecycle.capacity import reserve_capacity
     m = module()
     settled = claim_work(conn,'retention','terminal',180)
     first = reserve_capacity(conn,settled,10)
     reserve_capacity(conn,settled,10)
diff --git a/tools/lifecycle_test_selection.json b/tools/lifecycle_test_selection.json
index aeeb4d7..16d3c5a 100644
--- a/tools/lifecycle_test_selection.json
+++ b/tools/lifecycle_test_selection.json
@@ -72,21 +72,23 @@
     "tests/test_review_corrections_schema.py",
     "tests/test_reclassify.py",
     "tests/test_langfuse_contract.py",
     "tests/test_prefs_backfill.py",
     "tests/test_run_question_fetch.py",
     "tests/test_review_defaults.py",
     "tests/test_name_backfill.py",
     "tests/test_company_schema.py::test_company_discovery_schema",
     "tests/test_locations_schema.py::test_locations_table_shape",
     "tests/test_locations_schema.py::test_locations_source_check",
-    "tests/test_locations_schema.py::test_jobs_location_canonicals_column"
+    "tests/test_locations_schema.py::test_jobs_location_canonicals_column",
+    "tests/test_lifecycle_final_fix1.py",
+    "tests/test_lifecycle_maintenance.py::test_only_safely_archived_unreferenced_superseded_versions_retire"
   ],
   "dashboard_owned": [
     "lib/jobLifecycle.flow.db.test.ts",
     "lib/jobLifecycleConsumers.db.test.ts"
   ],
   "excluded_security": [
     "tests/test_lifecycle_safety.py",
     "tests/test_lifecycle_activation.py",
     "tests/test_lifecycle_review_security.py",
     "tests/test_rls_isolation.py",
