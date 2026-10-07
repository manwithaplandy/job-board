# Full pinned review package

BASE: 0df584068c98cce161f354a50a7ad75ec01a0484

HEAD: 4d48602947b84983acc54738bd21e45a52862725

## Commits

4d48602947b84983acc54738bd21e45a52862725 feat: hydrate demanded job versions before review and preparation
7f49ff86182417cd543335fd24f9113c030d5c07 docs: record task eight caller contract ruling and verification scope


## Files

 .../controller-resume.md                           |  12 +
 .../progress.md                                    |  12 +
 .../task-8-evidence/chronology.md                  |  60 ++++
 .../task-8-evidence/dashboard-affected-final.txt   |   8 +
 .../task-8-evidence/dashboard-db16-final.txt       |  11 +
 .../task-8-evidence/dashboard-db17-final.txt       |  11 +
 .../task-8-evidence/dashboard-db17.txt             |  10 +
 .../task-8-evidence/dashboard-selected.txt         |   8 +
 .../task-8-evidence/demand16-final.txt             |   3 +
 .../task-8-evidence/demand17-final.txt             |   3 +
 .../task-8-evidence/lint-final.txt                 |   1 +
 .../task-8-evidence/python16-green.txt             |   5 +
 .../task-8-evidence/python17-green.txt             |   5 +
 .../task-8-evidence/python17.txt                   |  32 ++
 .../task-8-evidence/red.txt                        |  16 +
 .../task-8-evidence/transport-final.txt            |   2 +
 .../task-8-evidence/tsc-final.txt                  |   0
 .../task-8-report.md                               | 171 +++++++++
 .../task-9-reviewer-dispatch.md                    |   9 +
 dashboard/app/actions/applications.ts              |  18 +-
 dashboard/app/actions/corrections.ts               |  21 +-
 dashboard/app/actions/coverLetterEdits.ts          |  14 +-
 dashboard/app/actions/jobs.ts                      |  22 +-
 dashboard/app/actions/resumeScores.ts              |  14 +-
 .../app/api/application/prepare/route.test.ts      |  30 +-
 dashboard/app/api/application/prepare/route.ts     |  35 +-
 dashboard/app/api/cover-letter/route.test.ts       |   6 +-
 dashboard/app/api/cover-letter/route.ts            |  15 +-
 dashboard/app/api/jobs/[id]/route.test.ts          |   4 +
 dashboard/app/api/jobs/[id]/route.ts               |   5 +-
 dashboard/app/api/resume/route.test.ts             |   6 +-
 dashboard/app/api/resume/route.ts                  |  15 +-
 dashboard/app/api/review/request/route.ts          |   3 +-
 dashboard/components/rolefit/RolefitBoard.test.tsx |   6 +
 dashboard/components/rolefit/RolefitBoard.tsx      |  24 +-
 dashboard/lib/applicationActions.test.ts           |   6 +
 dashboard/lib/corrections.action.test.ts           |   8 +-
 dashboard/lib/coverLetterEdits.action.test.ts      |   8 +-
 dashboard/lib/db.ts                                |  66 ++++
 dashboard/lib/generationJobs.ts                    |  32 +-
 dashboard/lib/jobLifecycle.flow.db.test.ts         |  94 +++++
 dashboard/lib/jobLifecycle.test.ts                 |  14 +
 dashboard/lib/jobLifecycle.ts                      | 108 ++++++
 dashboard/lib/jobPayloadNotice.ts                  |   9 +
 dashboard/lib/jobsReject.action.test.ts            |  11 +-
 dashboard/lib/queries.ts                           |  66 ++--
 .../lib/queries.upsertApplicationPackage.test.ts   |   3 +-
 dashboard/lib/resumeScore.action.test.ts           |   8 +-
 dashboard/lib/reviewRequests.test.ts               |   4 +-
 dashboard/lib/reviewRequests.ts                    |  16 +-
 job_discovery/adapters/greenhouse.py               |   2 +-
 job_discovery/http.py                              |  33 +-
 job_discovery/lifecycle/demand.py                  | 368 ++++++++++++++++++++
 job_discovery/lifecycle/identity.py                |   9 +-
 job_discovery/public_fetch.py                      | 269 +++++++++++++++
 migrations/2026-10-03-03-lifecycle-snapshots.sql   |  44 +++
 reviewer/db.py                                     |  40 ++-
 reviewer/run.py                                    |  17 +
 reviewer/worker.py                                 |   2 +
 schema.sql                                         |  43 +++
 tests/test_http.py                                 |   4 +-
 tests/test_lifecycle_demand.py                     | 384 +++++++++++++++++++++
 tests/test_public_fetch.py                         | 205 +++++++++++
 tests/test_reviewer_run.py                         |   8 +-
 64 files changed, 2347 insertions(+), 151 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
index 21601ca..41d97f9 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
@@ -172,10 +172,22 @@ Task7 author confirmed no test command running at resumed status check. Latest s
 
 Task7Fix1 resumed concrete progress: author confirmed two current owned DB sessions99539(PG17)/9452(PG16), each launched once. Inner pytest selection: test_lifecycle_legacy_consumer.py, test_lifecycle_admission.py, test_run.py, test_run_question_fetch.py, test_db_jobs.py, test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age; -q --tb=short. No outcome yet; authorreported Ruff/gitdiffcheck passed and report append underway. No capacity/transport error or duplicate accepted stage; results pending before scoped review.
 
 Task7 Fix1 DONE1f05ae5d9b9d2e80369cfdfcfa57b86e2151898b, FixBASE1f897475023a50fa029def5a5e9e016ded794a8b. Root read appended report and actual covering72pass/1fail EACH17.11/16.15 logs, unchangedfailedbulk-onlysequential1pass9.36/13.38s,45prepare/resume and lint/whitespace evidence. All13compatibilitycases passed bothmajor; no all-green73combined claim, timing cause only hypothesis. Full FixBASE..HEAD package generated and SAME original reviewer /root/recovery_task07_requirements_review dispatched scoped R7-1+fix-introducedImportant/Critical; no whole-task loops or refusedmechanismprobes. Rootdocs0654c2a preserved, authorexcludedcontrollerdirtyfiles. Task7 remains unaccepted until scoped verdict/Library07. Capacity diagnosis exactnone received byauthor; resumedworkcompletedwithoutduplicatingstages. ContinueTask8aftergate, all13/finalpermittedreview/authorizedcompletedrelease.
 
 Task 7: complete (commits8f9a195e8bed49e0002d7b152b1d4b8983d96f04..1f05ae5d9b9d2e80369cfdfcfa57b86e2151898b, permitted requirements/quality review clean after Fix1). Task7 fix round1/5: R7-1 ADDRESSED,0open; same independent reviewer ScopedSpecPASS/QualityAPPROVED, no fix-introducedImportant/Critical. Root read full scoped report/pins/evidence. Existing bulk combined-run72pass1fail EACH remains documented timing/reproducibility limitation for Task13; unchangedfailedcase sequentialpasses do not prove a throughput guarantee or all-green73suite. No full security/activation/release approval inferred. Task6 conditional/fullSpecFAILR6-4/R6-5 and deliberateTask3reviewgaps unchanged.
 
 Checkpoint07 planned complete-history commit below includes finalTask7source1f05ae5+originalFAIL/scopedPASS reports/full packages/sanitized evidence/authorreport/controllercapacitydiagnosis. Confirm Library/xattrs before freshTask8 actualforwardIDledgerBASE. Task8 uses prepared dispatch/brief, earlyTask2snapshot prerequisites and mandatoryR6-5shared source/detail transport; Task10/13stillmandatoryR6-4ordinaryno-growthcontract resolution. Continueall13/permittedwholebranchreview/authorizedcompletedrelease, no interimrollout.
 
 Checkpoint07CONFIRMED: completehistory763e7f808123b1be58d69689234836516f8c9bf0 bundle VERIFIED Librarylibfile_c2e12ac583008191b1c0a27b9ed753ed / file_00000000161c81f589ebda170732e328 v0,xattrsappliedsameexec; /workspace/scratch/job-board-lifecycle-recovery-checkpoint-07.bundle. ContainsTask7finalsource1f05ae5/scopedreviewPASS/APPROVED/fullhistory/evidence/originalfinding/ruling/capacitydiagnosis. Accepteddevelopment1–5and7, conditional6/fullSpecFAILR6-4/R6-5, deliberateTask3securityreviewgapsunchanged. Latestpre-recoveryunfinishedlibfile_cb0da7f0f29481919cb9374533e9c125 preservedbutnowhistorical. Rootcommandshealthy; originalauthorno capacity/transporterror; no duplicatedstage. FreshTask8 startsactualforwardIDledgerBASE next, mandatorysharedtransportR6-5; all13/finalpermittedreview/authorizedcompletedreleasecontinue.
+
+Task8 ACTIVE freshsoleauthor/root/recovery_task08_implementer Astra-high forkNONE exactBASE0df584068c98cce161f354a50a7ad75ec01a0484. Preparedfullbrief/authorhandoff/amendment/releaseauth supplied, currentTask7temporarylegacycompatibility/stickycutover and mandatoryR6-5sharedtransport explicitlycarried. ExistingTask2nullableprivateprereq→Task8migration03readiness; actualreviewer/prepare/generationhydration and versionuse paths required; normalofflinefeature/owned17/16tests only, no refusedmechanismreview/probes or prod/network/paid/activation/releaseactions. Task6R6-4mandatoryTask10/13 preserved, nodefaultguardchanges. Rootdocs-only; freshindependentreviewafterauthorDONE/fullBASE..HEADpackage, checkpoint08LibrarybeforeTask9. ContinueALL13/finalpermittedreview/authorizedcompletedrelease, no intermediateapprovalquestions/stage duplication.
+
+Task8 author ordinary interface inspection reported conflicts BEFORE any enforcement change: authenticated private snapshots lack existing reservation acquisition path while enforced snapshotgrowth requires it; existing protected/active demands block changed sharedJD/version, including hydration's own demand. Root requested exactfiles/functions/helpers/grants/callerphase and minimal service-owned orchestration using existing claims/reservations, no authenticatedhelper grants/newprivilegeduserDML/guardweaken or refusedcapacity/securityprobes. Immutable demand snapshots with retainedprotectedsharedpayload may be valid, but failclosed missingcapability is an honest readiness blocker, NOTfulfilled Task8/releasefunctionalcontract. Investigate shortservice hydrationcompletion/snapshot-first workflow; rootRuling pending concretecontract. Continue independent allowedtransport/candidate/UIparsing while resolving; no userapproval/deploymentpremature.
+
+Task8 concrete contract response: enforced private snapshot/generated-body writes require existing samebackend/sameTX/job/scope/subject reservation; authenticated callback cannot directlymintclaims/reservations. Demandowner enqueue already allowed and hydration can fill immutable demandsnapshot withservice _write while retainingprotectedsharedpayload. Author proposednewauthenticatedsecurity-definer reservation-onlyhelper; root keeps newgrant hold because existingserver service bootstrap may suffice. Read-only interface inspection: dashboard/lib/db.ts already owns serviceSql and existing capacity.bind_reservation has explicit invoking_role/subject_id; reservationbranch validates intendedoriginalactor and claimsubjectbinding.
+
+Task8 provisional Ruling: use narrowly typed service-owned claim/reservation acquisition/binding INSIDE existing allowlisted db module and samebackendTX before originalauthenticated privateDML, avoiding newSQLauthenticatedgrants/privilegeduserJobDML — why: preservesexisting servicecapability contract and authenticatedRLS callers withoutweakening guards — costifwrong: actualclaimidentity/transaction/receipt mismatch requires scopedfunctionalrework; no independent mechanism/securityassurance claimed. Authormustinspectexactfit/reportmismatchbeforeanycontractchange, preserveoriginalrole/JWT/DBtime/gate/sortedkeys/conservativeforecast/settlement. No genericarbitrarypublicSQLhelper, no safeguardreview/proberetry. Hydration own-demand protection conflict resolvesimmutable demand snapshots/retainedprotectedsharedcache; functionalconsumerflowstillrequired, failclosedreadinessalone notfulfillment.
+
+Task8 author confirms provisionalbootstrapfit with existing reservation_integrity: serviceclaim binds one reservation_subject_id; reservation invoking_role=authenticated/subject=verifieduser; originalcallbackprivateDML remainsauthenticated; typedwithUserPayloadMutation inside existingallowlisted db module, service-roleclaim/reservationDMLonly, existinggate/sortedjoblock/sameTXsettlement. Nohelpergrants/rowguardchanges. Ruling confirmed: proceed existingservicecapabilitybootstrap + originalauthenticatedprivateDML — why: satisfiesnormalnewconsumerwritecontractwithoutnewprivilegeduserDML/authenticatedgrants — costifwrong: callertransaction/receiptreworkunderexistingguards, ordinaryfeaturecoverageandpermittedreviewrequired, NOTindependentmechanismvalidation. Hydrationdurableexactversiondemandsnapshotretainsprotectedsharedcache. Migration03validatesexistingTask2prereqs/recordsreadiness; ownerconsumptionreceipttimestampssupportserviceactualuseapplication, no inventeduse. Authorimplementation/tests underway; no acceptanceclaim.
+
+Task8 authorreported initialRED missingdemandmodule collectionfailure saved task-8-evidence/red.txt BEFOREimplementation. CurrentselectedownedPG17 newordinarydemandflows+existingreviewer run/worker/db+newofflinepublicfetch+existingHTTP; PG16after, TSparser/targetedroutes/ordinaryownerDB tests planned, no Task3mechanismsuites/probes. Sharedhttp._client delegatesboundedsubprocesstransport for allsix source adapters/directdetail consumers; exactreadonlyWorkdayPOSTallowlist, perhopDNS/publicaddress+numericpin/TLShostname, noforwardcredentials,3redirects/10MiBwire+expanded,parent20sDNStoJSON deadline. Actualinventory/report/evidence stillpending; no guaranteedcontractclaimbeforeverification/review. Existingtests stage1withoutJD/automatichttpxredirect assumptions requiremeaningfulnewcontract expectations, not coveragewaivers.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index 8cb71e4..c7b58b6 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -222,10 +222,22 @@ Task7 author confirmed no test command running at resumed status check. Latest s
 
 Task7Fix1 resumed concrete progress: author confirmed two current owned DB sessions99539(PG17)/9452(PG16), each launched once. Inner pytest selection: test_lifecycle_legacy_consumer.py, test_lifecycle_admission.py, test_run.py, test_run_question_fetch.py, test_db_jobs.py, test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age; -q --tb=short. No outcome yet; authorreported Ruff/gitdiffcheck passed and report append underway. No capacity/transport error or duplicate accepted stage; results pending before scoped review.
 
 Task7 Fix1 DONE1f05ae5d9b9d2e80369cfdfcfa57b86e2151898b, FixBASE1f897475023a50fa029def5a5e9e016ded794a8b. Root read appended report and actual covering72pass/1fail EACH17.11/16.15 logs, unchangedfailedbulk-onlysequential1pass9.36/13.38s,45prepare/resume and lint/whitespace evidence. All13compatibilitycases passed bothmajor; no all-green73combined claim, timing cause only hypothesis. Full FixBASE..HEAD package generated and SAME original reviewer /root/recovery_task07_requirements_review dispatched scoped R7-1+fix-introducedImportant/Critical; no whole-task loops or refusedmechanismprobes. Rootdocs0654c2a preserved, authorexcludedcontrollerdirtyfiles. Task7 remains unaccepted until scoped verdict/Library07. Capacity diagnosis exactnone received byauthor; resumedworkcompletedwithoutduplicatingstages. ContinueTask8aftergate, all13/finalpermittedreview/authorizedcompletedrelease.
 
 Task 7: complete (commits8f9a195e8bed49e0002d7b152b1d4b8983d96f04..1f05ae5d9b9d2e80369cfdfcfa57b86e2151898b, permitted requirements/quality review clean after Fix1). Task7 fix round1/5: R7-1 ADDRESSED,0open; same independent reviewer ScopedSpecPASS/QualityAPPROVED, no fix-introducedImportant/Critical. Root read full scoped report/pins/evidence. Existing bulk combined-run72pass1fail EACH remains documented timing/reproducibility limitation for Task13; unchangedfailedcase sequentialpasses do not prove a throughput guarantee or all-green73suite. No full security/activation/release approval inferred. Task6 conditional/fullSpecFAILR6-4/R6-5 and deliberateTask3reviewgaps unchanged.
 
 Checkpoint07 planned complete-history commit below includes finalTask7source1f05ae5+originalFAIL/scopedPASS reports/full packages/sanitized evidence/authorreport/controllercapacitydiagnosis. Confirm Library/xattrs before freshTask8 actualforwardIDledgerBASE. Task8 uses prepared dispatch/brief, earlyTask2snapshot prerequisites and mandatoryR6-5shared source/detail transport; Task10/13stillmandatoryR6-4ordinaryno-growthcontract resolution. Continueall13/permittedwholebranchreview/authorizedcompletedrelease, no interimrollout.
 
 Checkpoint07CONFIRMED: completehistory763e7f808123b1be58d69689234836516f8c9bf0 bundle VERIFIED Librarylibfile_c2e12ac583008191b1c0a27b9ed753ed / file_00000000161c81f589ebda170732e328 v0,xattrsappliedsameexec; /workspace/scratch/job-board-lifecycle-recovery-checkpoint-07.bundle. ContainsTask7finalsource1f05ae5/scopedreviewPASS/APPROVED/fullhistory/evidence/originalfinding/ruling/capacitydiagnosis. Accepteddevelopment1–5and7, conditional6/fullSpecFAILR6-4/R6-5, deliberateTask3securityreviewgapsunchanged. Latestpre-recoveryunfinishedlibfile_cb0da7f0f29481919cb9374533e9c125 preservedbutnowhistorical. Rootcommandshealthy; originalauthorno capacity/transporterror; no duplicatedstage. FreshTask8 startsactualforwardIDledgerBASE next, mandatorysharedtransportR6-5; all13/finalpermittedreview/authorizedcompletedreleasecontinue.
+
+Task8 ACTIVE freshsoleauthor/root/recovery_task08_implementer Astra-high forkNONE exactBASE0df584068c98cce161f354a50a7ad75ec01a0484. Preparedfullbrief/authorhandoff/amendment/releaseauth supplied, currentTask7temporarylegacycompatibility/stickycutover and mandatoryR6-5sharedtransport explicitlycarried. ExistingTask2nullableprivateprereq→Task8migration03readiness; actualreviewer/prepare/generationhydration and versionuse paths required; normalofflinefeature/owned17/16tests only, no refusedmechanismreview/probes or prod/network/paid/activation/releaseactions. Task6R6-4mandatoryTask10/13 preserved, nodefaultguardchanges. Rootdocs-only; freshindependentreviewafterauthorDONE/fullBASE..HEADpackage, checkpoint08LibrarybeforeTask9. ContinueALL13/finalpermittedreview/authorizedcompletedrelease, no intermediateapprovalquestions/stage duplication.
+
+Task8 author ordinary interface inspection reported conflicts BEFORE any enforcement change: authenticated private snapshots lack existing reservation acquisition path while enforced snapshotgrowth requires it; existing protected/active demands block changed sharedJD/version, including hydration's own demand. Root requested exactfiles/functions/helpers/grants/callerphase and minimal service-owned orchestration using existing claims/reservations, no authenticatedhelper grants/newprivilegeduserDML/guardweaken or refusedcapacity/securityprobes. Immutable demand snapshots with retainedprotectedsharedpayload may be valid, but failclosed missingcapability is an honest readiness blocker, NOTfulfilled Task8/releasefunctionalcontract. Investigate shortservice hydrationcompletion/snapshot-first workflow; rootRuling pending concretecontract. Continue independent allowedtransport/candidate/UIparsing while resolving; no userapproval/deploymentpremature.
+
+Task8 concrete contract response: enforced private snapshot/generated-body writes require existing samebackend/sameTX/job/scope/subject reservation; authenticated callback cannot directlymintclaims/reservations. Demandowner enqueue already allowed and hydration can fill immutable demandsnapshot withservice _write while retainingprotectedsharedpayload. Author proposednewauthenticatedsecurity-definer reservation-onlyhelper; root keeps newgrant hold because existingserver service bootstrap may suffice. Read-only interface inspection: dashboard/lib/db.ts already owns serviceSql and existing capacity.bind_reservation has explicit invoking_role/subject_id; reservationbranch validates intendedoriginalactor and claimsubjectbinding.
+
+Task8 provisional Ruling: use narrowly typed service-owned claim/reservation acquisition/binding INSIDE existing allowlisted db module and samebackendTX before originalauthenticated privateDML, avoiding newSQLauthenticatedgrants/privilegeduserJobDML — why: preservesexisting servicecapability contract and authenticatedRLS callers withoutweakening guards — costifwrong: actualclaimidentity/transaction/receipt mismatch requires scopedfunctionalrework; no independent mechanism/securityassurance claimed. Authormustinspectexactfit/reportmismatchbeforeanycontractchange, preserveoriginalrole/JWT/DBtime/gate/sortedkeys/conservativeforecast/settlement. No genericarbitrarypublicSQLhelper, no safeguardreview/proberetry. Hydration own-demand protection conflict resolvesimmutable demand snapshots/retainedprotectedsharedcache; functionalconsumerflowstillrequired, failclosedreadinessalone notfulfillment.
+
+Task8 author confirms provisionalbootstrapfit with existing reservation_integrity: serviceclaim binds one reservation_subject_id; reservation invoking_role=authenticated/subject=verifieduser; originalcallbackprivateDML remainsauthenticated; typedwithUserPayloadMutation inside existingallowlisted db module, service-roleclaim/reservationDMLonly, existinggate/sortedjoblock/sameTXsettlement. Nohelpergrants/rowguardchanges. Ruling confirmed: proceed existingservicecapabilitybootstrap + originalauthenticatedprivateDML — why: satisfiesnormalnewconsumerwritecontractwithoutnewprivilegeduserDML/authenticatedgrants — costifwrong: callertransaction/receiptreworkunderexistingguards, ordinaryfeaturecoverageandpermittedreviewrequired, NOTindependentmechanismvalidation. Hydrationdurableexactversiondemandsnapshotretainsprotectedsharedcache. Migration03validatesexistingTask2prereqs/recordsreadiness; ownerconsumptionreceipttimestampssupportserviceactualuseapplication, no inventeduse. Authorimplementation/tests underway; no acceptanceclaim.
+
+Task8 authorreported initialRED missingdemandmodule collectionfailure saved task-8-evidence/red.txt BEFOREimplementation. CurrentselectedownedPG17 newordinarydemandflows+existingreviewer run/worker/db+newofflinepublicfetch+existingHTTP; PG16after, TSparser/targetedroutes/ordinaryownerDB tests planned, no Task3mechanismsuites/probes. Sharedhttp._client delegatesboundedsubprocesstransport for allsix source adapters/directdetail consumers; exactreadonlyWorkdayPOSTallowlist, perhopDNS/publicaddress+numericpin/TLShostname, noforwardcredentials,3redirects/10MiBwire+expanded,parent20sDNStoJSON deadline. Actualinventory/report/evidence stillpending; no guaranteedcontractclaimbeforeverification/review. Existingtests stage1withoutJD/automatichttpxredirect assumptions requiremeaningfulnewcontract expectations, not coveragewaivers.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/chronology.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/chronology.md
new file mode 100644
index 0000000..44f7e93
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/chronology.md
@@ -0,0 +1,60 @@
+# Task8 local verification chronology
+
+These are exact recorded outcome summaries from tool output, not reconstructed full logs.
+Some initial dashboard output files were overwritten while iterating; their outcomes
+are retained here explicitly. Only final complete passing outputs support GREEN.
+
+1. `python -m pytest tests/test_lifecycle_demand.py -q`: collection failed with
+   `ModuleNotFoundError: No module named 'job_discovery.lifecycle.demand'`.
+   Original full output retained as red.txt.
+2. First isolated PG17 demand run: server 17.11, 1 failed / 4 passed. Deferred
+   demand bound Jsonb(None), rejected by `job_payload_demands_questions_shape`.
+   Fixed by binding SQL NULL for absent public schema.
+3. First selected PG17 Python lane: 2 failed / 132 passed, 29.16s. Original output
+   retained as python17.txt. Missing JD test still expected stage1='pass'; an overly
+   broad expectation edit had also changed the valid-JD stage2 error test to expect
+   no stage1 result. Corrected only those expectations: no-JD => no stage1; valid-JD
+   stage2 error => preserve stage1='pass'.
+4. First dashboard owned PG17 flow lane: setup failed with
+   `UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1`; 2 tests skipped,
+   742ms. Cause: migration BEGIN/COMMIT copied into fresh schema.sql. Removed only
+   fresh-schema wrappers; migration retains its transaction. No guard changes.
+5. Next dashboard PG17 lane: 1 passed / 1 failed, 816ms. Enforced owner reservation
+   flow passed. Generation snapshot insert failed `generation_jobs_questions_shape`.
+   Fixed JSON text binding (`::text::jsonb`) and SQL NULL for absent schema.
+6. Dashboard PG17 flow then passed 2/2, 1.29s. Server 17.11. No skipped tests.
+7. First targeted routes/parser lane: 4 failed / 80 passed, 2.06s. Three detail
+   responses gained unwanted legacy/null metadata; kept legacy response shape.
+   Prepare fallback test expected browser-side question fetch; changed expectation
+   to protective pending with zero fetch/charge/provider calls.
+8. Targeted routes/parser lane then passed 84/84, 1.35s.
+9. Additional older-live fixture initially tried editing an immutable frozen
+   listing expiry; replaced with a job originally discovered 31 days earlier,
+   mapped through the normal identity mapper. This is fixture construction, not
+   a change to enforcement.
+10. Broader selected Python runs passed 214 on PostgreSQL 17.11 (40.39s), then
+    215 on PostgreSQL 16.15 (66.51s), with the newly added legacy worker case.
+    Full outputs remain python17-green.txt and python16-green.txt. These precede
+    the final legacy missing-listing mapping correction and are not a final-source
+    broad matrix claim.
+11. The controller identified an ordinary default-off legacy prepare sequencing
+    gap. Service processing now accepts explicit pre-cutover owner demands. The
+    final fixture starts with actual db.upsert_jobs and no source listing; the
+    targeted existing mapper supplies identity without moving global cursors.
+    Final affected demand+identity runs passed 30 each on PostgreSQL 17.11
+    (12.84s) and 16.15 (20.35s); full outputs retained.
+12. Dashboard selected actions/routes/parsers/UI lane passed 135 in 13 files
+    (6.56s). This preceded the final package JSON binding correction. The final
+    affected package/instruction/parser lane passed 13 in 3 files (1.02s), and
+    TypeScript noEmit exited 0 (empty success output retained).
+13. Offline transport initially passed 17 tests, then 18 (0.33s) after adding
+    non-JSON HTTP error-status handling. Final 18-test output retained. Earlier
+    passing final-named output was overwritten; this is the final test count.
+14. Dashboard DB lane passed 3 tests per major after legacy readiness work.
+    After adding actual package persistence/JSON/consumption coverage, final
+    outputs passed 4 each on PostgreSQL 17.11 (1.66s) and 16.15 (1.43s).
+    The final-named three-test outputs were overwritten by these four-test runs.
+    Original historical two-test PG17 success remains dashboard-db17.txt.
+
+No production/provider/network calls were used. Missing independent Task3 reviews
+remain deliberately unperformed. These tests are ordinary new feature contracts.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-affected-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-affected-final.txt
new file mode 100644
index 0000000..3e254c8
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-affected-final.txt
@@ -0,0 +1,8 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+
+ Test Files  3 passed (3)
+      Tests  13 passed (13)
+   Start at  18:21:48
+   Duration  1.02s (transform 453ms, setup 0ms, import 900ms, tests 60ms, environment 1ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db16-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db16-final.txt
new file mode 100644
index 0000000..3d52702
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db16-final.txt
@@ -0,0 +1,11 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.flow.db.test.ts (4 tests) 1077ms
+   ✓ package persistence copies pinned input and records consumption with the artifact  318ms
+
+ Test Files  1 passed (1)
+      Tests  4 passed (4)
+   Start at  18:21:49
+   Duration  1.43s (transform 298ms, setup 0ms, import 157ms, tests 1.08s, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17-final.txt
new file mode 100644
index 0000000..0dfe0c0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17-final.txt
@@ -0,0 +1,11 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.flow.db.test.ts (4 tests) 916ms
+   ✓ package persistence copies pinned input and records consumption with the artifact  328ms
+
+ Test Files  1 passed (1)
+      Tests  4 passed (4)
+   Start at  18:19:45
+   Duration  1.66s (transform 352ms, setup 0ms, import 223ms, tests 916ms, environment 1ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17.txt
new file mode 100644
index 0000000..9a598a9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-db17.txt
@@ -0,0 +1,10 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycle.flow.db.test.ts (2 tests) 592ms
+
+ Test Files  1 passed (1)
+      Tests  2 passed (2)
+   Start at  17:59:19
+   Duration  1.29s (transform 198ms, setup 0ms, import 276ms, tests 592ms, environment 3ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-selected.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-selected.txt
new file mode 100644
index 0000000..f226b7a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/dashboard-selected.txt
@@ -0,0 +1,8 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+
+ Test Files  13 passed (13)
+      Tests  135 passed (135)
+   Start at  18:16:56
+   Duration  6.56s (transform 2.36s, setup 0ms, import 4.17s, tests 2.88s, environment 1.31s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand16-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand16-final.txt
new file mode 100644
index 0000000..ed26b0d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand16-final.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+..............................                                           [100%]
+30 passed in 20.35s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand17-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand17-final.txt
new file mode 100644
index 0000000..b670d65
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/demand17-final.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..............................                                           [100%]
+30 passed in 12.84s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/lint-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/lint-final.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/lint-final.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python16-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python16-green.txt
new file mode 100644
index 0000000..b25151c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python16-green.txt
@@ -0,0 +1,5 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 33%]
+........................................................................ [ 66%]
+.......................................................................  [100%]
+215 passed in 66.51s (0:01:06)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17-green.txt
new file mode 100644
index 0000000..d5910cf
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17-green.txt
@@ -0,0 +1,5 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 33%]
+........................................................................ [ 67%]
+......................................................................   [100%]
+214 passed in 40.39s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17.txt
new file mode 100644
index 0000000..7f305df
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/python17.txt
@@ -0,0 +1,32 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................F.......F......................................... [ 53%]
+..............................................................           [100%]
+=================================== FAILURES ===================================
+________________ test_missing_jd_skips_stage2_and_writes_no_row ________________
+
+    def test_missing_jd_skips_stage2_and_writes_no_row():
+        """When stage-1 passes but description is NULL/empty, stage-2 must NOT run."""
+        client = StubClient()
+        res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
+        # stage1 passed (SRE is not a forklift operator), but JD is None
+>       assert res.stage1_decision == "pass"
+E       AssertionError: assert None == 'pass'
+E        +  where None = ReviewResult(job_id='lever:acme:SRE', job_version_id=None, description_snapshot=None, questions_snapshot=None, snapsho...one, experience_score=None, comp_score=None, fit_score=None, red_flags=[], skill_gaps=[], benefits=[], requirements=[]).stage1_decision
+
+tests/test_reviewer_run.py:62: AssertionError
+___________________ test_stage2_error_isolated_keeps_stage1 ____________________
+
+    def test_stage2_error_isolated_keeps_stage1():
+        client = StubClient()
+        res = asyncio.run(review_one(_cand("BOOM2"), "P", client))
+>       assert res.stage1_decision is None
+E       AssertionError: assert 'pass' is None
+E        +  where 'pass' = ReviewResult(job_id='lever:acme:BOOM2', job_version_id=None, description_snapshot=None, questions_snapshot=None, snaps...one, experience_score=None, comp_score=None, fit_score=None, red_flags=[], skill_gaps=[], benefits=[], requirements=[]).stage1_decision
+
+tests/test_reviewer_run.py:128: AssertionError
+------------------------------ Captured log call -------------------------------
+WARNING  reviewer:run.py:153 review failed for lever:acme:BOOM2: RuntimeError: stage2 down
+=========================== short test summary info ============================
+FAILED tests/test_reviewer_run.py::test_missing_jd_skips_stage2_and_writes_no_row
+FAILED tests/test_reviewer_run.py::test_stage2_error_isolated_keeps_stage1 - ...
+2 failed, 132 passed in 29.16s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/red.txt
new file mode 100644
index 0000000..fe2636a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/red.txt
@@ -0,0 +1,16 @@
+
+==================================== ERRORS ====================================
+_______________ ERROR collecting tests/test_lifecycle_demand.py ________________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_demand.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_demand.py:6: in <module>
+    from job_discovery.lifecycle.demand import parse_payload, fetch_payload, request_demand, hydrate_demand
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.demand'
+=========================== short test summary info ============================
+ERROR tests/test_lifecycle_demand.py
+!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
+1 error in 0.27s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/transport-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/transport-final.txt
new file mode 100644
index 0000000..563d146
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/transport-final.txt
@@ -0,0 +1,2 @@
+..................                                                       [100%]
+18 passed in 0.33s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/tsc-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-evidence/tsc-final.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-report.md
new file mode 100644
index 0000000..74bbe3c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-report.md
@@ -0,0 +1,171 @@
+# Task 8 author report
+
+Implemented demand hydration and immutable private inputs. Author verification is
+complete; fresh permitted requirements/quality review and Library08 are pending.
+This is not independent security approval or approval to activate the rollout.
+
+Baseline: `0df584068c98cce161f354a50a7ad75ec01a0484`. The controller's intervening
+documentation commit `7f49ff8` is preserved. No history was rewritten. Controller
+progress/resume/checkpoint edits are excluded from the product commit.
+
+## Result and ordinary caller contracts
+
+* `job_discovery/lifecycle/demand.py` coalesces explicit demands, obtains a fenced
+  180-second claim, commits before public fetch, renews after the bounded fetch,
+  checks the source version again, reserves growth, and commits an exact public
+  version with the owner's description/question snapshot before returning ready.
+  Empty/failing/malformed descriptions defer. Existing shared payload is retained;
+  a separate completion transaction can fill an empty shared description only.
+* `reviewer/run.py` selects deterministic eligible candidates before hydration and
+  model calls. Missing descriptions skip both model stages. `reviewer/db.py`
+  attaches durable review inputs and persists their version/snapshots with results;
+  valid-JD stage2 failures still preserve the existing stage1/error-isolation
+  behavior. `reviewer/worker.py` processes queued hydration on the existing loop.
+* `dashboard/lib/jobLifecycle.ts` owns total demand/request/context parsing,
+  owner demand enqueue/read, private input selection and consumption receipts.
+  `lib/db.ts` performs service-owned capability bootstrap on the same transaction,
+  then changes to the authenticated role for private writes. Only claim/reservation
+  metadata is written with service capability; no authenticated helper grant or
+  privileged user/job DML was introduced. Existing guards remain authoritative.
+  The bootstrap uses a conservative 96 MiB forecast and may reject early near the
+  physical ceiling. It settles on the same backend and transaction.
+* Prepare, resume and cover-letter routes require ready input before credit/provider
+  work. Pending/deferred returns 202 without charging or invoking providers.
+  `generationJobs.ts` pins generation input; `queries.ts` pins package input,
+  preserves it across subsequent output updates and records consumption in the
+  successful artifact transaction. Package JSON binds explicitly as text→jsonb.
+  Instruction drafts also require a ready or compatible cached legacy input.
+* Application approval, unreject, corrections, scores and cover-letter edits use
+  the same scoped private mutation wrapper and preserve their relevant snapshots.
+  Job detail requests explicit owner hydration but never stamp mere reads as use.
+  Review-request row parsing is total. `RolefitBoard` handles protective 202 status
+  by restoring a retryable state and showing the pending notice; its lightweight
+  parser does not import server database code into the client.
+* Successful consumers write exact-version receipts. Service receipt application
+  stamps shared description/question use only when its version matches. Captures,
+  discovery sightings, reads and pending requests do not invent use. Demand reuse
+  uses description 30-day/question 7-day captured-or-consumed freshness. Existing
+  package regeneration remains pinned to its immutable original input.
+
+## Default-off producer through consumer compatibility
+
+Cached legacy workflows remain available under the existing
+`legacy_description_capture_allowed` policy. An explicit owner prepare request
+with a legacy JD but missing Greenhouse questions queues service work even when
+hydration is off, provided sticky cutover has not occurred. The service worker
+uses the same policy; this is explicit demand, not passive cache refill.
+
+The final Python integration fixture starts with the actual `db.upsert_jobs`
+producer, verifies no listing and no question cache exist, queues prepare, runs
+`process_pending`, and observes exact stored-coordinate fetch outside any DB
+transaction followed by a durable ready version/schema. To make this ordinary
+path work, `identity.migrate_identity_batch` accepts an optional bounded exact
+`job_ids` subset, using the existing mapper/provenance. Default behavior is
+unchanged; the subset does not advance/reset the global backfill cursor or mark
+identity readiness complete. Sticky cutover with hydration disabled stays paused.
+No new activation flag, passive fallback, unsafe prune restoration or guard
+relaxation was added. The dashboard DB fixture separately exercises owner queue
+and ready consumption; its service-completion step is synthetic, whereas the
+Python fixture executes the actual worker orchestration.
+
+## Shared transport and source/detail inventory
+
+`job_discovery.http` now routes real requests through `public_fetch.py` for all
+callers. The bounded subprocess includes DNS, socket/TLS, headers, wire body,
+decompression and JSON parsing in its deadline; the retry facade shares an overall
+20-second budget. Connections pin validated public addresses, verify the peer,
+retain original-host TLS verification, manually follow at most three redirects
+with fresh address validation, strip URL credentials and send no inherited
+cookies/auth/proxy credentials. Wire and expanded bodies are capped at 10 MiB;
+unexpected content types/encodings or malformed payloads fail closed. Parsing is
+performed in the bounded child; its local result envelope is not network pickle.
+
+| Caller | Shared request path / allowed operation |
+| --- | --- |
+| Greenhouse adapter | completeness→http GET board enumeration |
+| Lever adapter | completeness→http GET board enumeration |
+| Ashby adapter | completeness→http GET board feed |
+| Workable adapter | completeness→http GET widget feed |
+| SmartRecruiters adapter | completeness→http GET pages and supported details |
+| Workday adapter | completeness→http allowlisted readonly CXS search POST and detail GET |
+| Legacy Greenhouse question spool via `run.py` | injected shared get_json; existing compatibility controls retained |
+| `company_discovery/enrich.py` | shared JSON and bounded text GET |
+| Demand Greenhouse / Lever / SmartRecruiters | exact stored board + external ID detail GET |
+| Demand Workday | validated stored tenant/datacenter/site + exact `/job/…` detail GET |
+| Demand Ashby / Workable | one current bounded feed, at most 10,000 entries, unique exact ID match |
+
+Demand never fetches an application URL or submits an application/form. The
+browser-side prepare question fallback was removed. The inherited R6-5 transport
+gap is addressed at the shared transport, not only for demand. No live provider
+endpoint was exercised; offline doubles establish the selected behavior. Source
+worker scheduling/durable above-guard progress R6-4 remains Tasks 10/13 work.
+
+## SQL and rollout state
+
+Migration03 validates Task2's existing snapshot columns and constraints; it does
+not first-create those prerequisites. It adds consumption receipts with an invoker
+stamp trigger and a service-only installed-writer readiness record. `validated_at`
+remains NULL pending release verification. Matching fresh-schema definitions have
+no embedded transaction wrapper. Production control defaults remain off,
+retirement dry-run and archive inactive. No production migration, provider/model
+request, activation, S3/IAM work, deployment, publishing, merge or push occurred.
+
+## Verification and chronology
+
+Evidence files are in `task-8-evidence/`. `chronology.md` retains initial failures,
+including which early logs were overwritten and are represented only by exact
+outcome summaries. `red.txt` retains the original missing-module RED output;
+`python17.txt` retains the initial 132-pass/2-fail output. Initial failed outputs
+are not labelled successful verification.
+
+All commands below ran from this worktree using the ignored existing environment
+and `/bin/bash` without login startup. Harness databases were owned, disposable,
+random-port instances, never shared port 55432.
+
+1. Initial RED: `.venv/bin/python -m pytest tests/test_lifecycle_demand.py -q` →
+   collection failed because the demand module did not yet exist.
+2. Earlier broad Python command, on PostgreSQL **17.11** then **16.15**:
+   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py tests/test_public_fetch.py tests/test_http.py tests/test_reviewer_run.py tests/test_reviewer_worker.py tests/test_reviewer_db.py tests/test_greenhouse_questions.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_workday.py tests/test_smartrecruiters.py -q`
+   → **214 passed** on 17 / **215 passed** on 16. These are earlier revision
+   results, before the final legacy mapper/package corrections; the additional
+   legacy worker test accounts for the count difference. They are not represented
+   as a full broad rerun of final source.
+3. Final affected Python command, both majors:
+   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py tests/test_lifecycle_identity.py -q`
+   → **30 passed** on 17.11 and **30 passed** on 16.15. Includes all 11 demand
+   tests, actual legacy upsert→mapping→worker flow and the existing mapper cases.
+4. Final offline transport: `.venv/bin/python -m pytest tests/test_public_fetch.py tests/test_http.py -q`
+   → **18 passed**. Normal bounded transport tests include redirects, address
+   validation/pinning configuration, deadline process boundary, size/type limits,
+   readonly POST selection and error-status handling; no live network was used.
+5. Dashboard selected lane (run within dashboard):
+   `./node_modules/.bin/vitest run lib/jobLifecycle.test.ts lib/reviewRequests.test.ts lib/queries.upsertApplicationPackage.test.ts lib/applicationActions.test.ts lib/corrections.action.test.ts lib/coverLetterEdits.action.test.ts lib/jobsReject.action.test.ts lib/resumeScore.action.test.ts app/api/application/prepare/route.test.ts app/api/cover-letter/route.test.ts app/api/resume/route.test.ts 'app/api/jobs/[id]/route.test.ts' components/rolefit/RolefitBoard.test.tsx`
+   → **135 passed / 13 files** before the final package-binding correction.
+6. Final affected dashboard command:
+   `./node_modules/.bin/vitest run lib/queries.upsertApplicationPackage.test.ts lib/generationInstructions.action.test.ts lib/jobLifecycle.test.ts`
+   → **13 passed / 3 files**. Final `./node_modules/.bin/tsc --noEmit` exited 0.
+7. Final actual dashboard owner DB command, both majors:
+   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycle.flow.db.test.ts'`
+   → **4 passed** each on 17.11 and 16.15. Covers owner coalescing/generation
+   snapshot/receipt, flag-off question demand readiness, actual package snapshot
+   and JSON persistence with receipt, and an ordinary authenticated write using
+   service capability bootstrap. The last fixture selects enforced state locally;
+   it does not claim to validate production activation transitions. Existing row
+   and reservation guards remain installed and unchanged.
+8. Changed Python lint and `git diff --check` passed. Only one TSX component was
+   edited, so the multiple-component React skill trigger did not apply.
+
+Selected final DB runs contain no skipped tests. This is not a whole-repository
+zero-skip/full-matrix claim. Tests cover ordinary new feature contracts, not the
+refused independent expiry/capacity/cross-user/adversarial mechanism review.
+
+## Remaining limits and handoff
+
+Independent Task3 expiry enforcement, capacity accounting, cross-user isolation
+and related adversarial review remain deliberately unperformed under the review
+scope amendment. No replacement probes/reviewer were introduced. The controller
+owns fresh permitted Task8 review, Library08 and subsequent tasks. Archive-active
+event pairing, R6-4 above-guard progress, completed readiness/backfill and final
+release checks remain later tasks; this commit does not activate them. Transport
+verification uses offline fixtures and owned DBs only. Private snapshots and
+protected shared content are retained conservatively in this rollout.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-reviewer-dispatch.md
new file mode 100644
index 0000000..58a703b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-reviewer-dispatch.md
@@ -0,0 +1,9 @@
+# Task9 permitted independent requirements / code-quality review preparation
+
+Fresh reviewer only after sole-author DONE and full recorded BASE..HEAD review package. Pin exact commits. Read REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, task-9-brief.md verbatim, task-9-report.md and actual evidence/full diff. Do not change product/commit/delegate or rerun covered author tests. No production/network/paid/provider calls, shared55432 or destructive feedback fixtures.
+
+Review ordinary new discovery predicate/consumer semantics and UI correctness. This is not a replacement refused Task3 expiry-enforcement/capacity-accounting/cross-user/adversarial review. Do not retry/reproduce/disguise/split that review or probes. Independent gaps remain explicit even if normal feature tests pass. Inspect exact elapsed UTC30d anchor behavior, explicit older-live option, availability unknown versus proven closed versus feed-expired/retired, protected private-history independence, counts/rows/pagination agreement and automatic reviewer filtering. Total parsers must safely handle malformed/double-encoded legacy boundary JSON; no zod/unvalidated casts. Check actual rg consumer inventory/runbook against changed timestamp/cache/query/render callers and safe coexistence behind flags, preserving immutable legacy anchors and no passive refill rollback.
+
+Use actual Task8 handoff/evidence for demand/transport; do not assume a demand-only wrapper solves mandatory R6-5 across source/detail callers. R6-4 above-guard durability is required downstream and not waived. Author tests/browser must use owned local DB/offline fake data, never production auth or paid calls. Distinguish static implementation, executed selected tests, browser evidence, independently reviewed and deliberately unreviewed guarantees. Inspect relevant React review evidence when triggered. No full security or deployment approval inferred.
+
+New narrowly necessary local ordinary diagnostic only for a concrete uncovered new-task concern, avoiding refused areas; otherwise use author evidence. Write task-9-requirements-review.md with pinned range, SpecPASS/FAIL, QualityAPPROVED/CHANGES_REQUIRED, Important/Critical exact paths/lines/evidence and narrow fixes, cannot-verify items/minors and scope/limits. Return short verdict/report path, then stop.
diff --git a/dashboard/app/actions/applications.ts b/dashboard/app/actions/applications.ts
index 7109b11..c8c1dde 100644
--- a/dashboard/app/actions/applications.ts
+++ b/dashboard/app/actions/applications.ts
@@ -1,31 +1,39 @@
 "use server";
 
+import { requestJobPayload, readPrivateSnapshot } from "@/lib/jobLifecycle";
+
 import { requireUserId } from "@/lib/auth";
-import { withUserSql } from "@/lib/db";
+import { withUserSql, withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 import { bareMarkerPredicate } from "@/lib/queries";
 
 // Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
 // user never prepared a package (a content-less marker row); the Prepare-panel
 // button hits the same path (its row already exists, so ON CONFLICT updates it).
 // Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
 export async function markApplicationApplied(jobId: string): Promise<void> {
   const userId = await requireUserId();
   await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
-  await withUserSql(userId, (tx) => tx`
-    INSERT INTO application_packages (user_id, job_id, status, applied_at)
-    VALUES (${userId}::uuid, ${jobId}, 'applied', now())
+  const payload = await requestJobPayload(userId, jobId, "prepare");
+  if (payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
+  await withUserPayloadMutation(userId, jobId, "application_packages", async (tx) => {
+    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
+    return tx`
+    INSERT INTO application_packages (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, status, applied_at)
+    VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
+      ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, 'applied', now())
     ON CONFLICT (user_id, job_id) DO UPDATE SET
       status     = 'applied',
       applied_at = COALESCE(application_packages.applied_at, now())
-  `);
+  `;
+  });
 }
 
 // Undo "mark applied". A content-less marker row (created by the one-click path) is
 // deleted so no phantom "prepared" package lingers; a real prepared package is
 // reverted to status='prepared' (applied_at cleared) with its content preserved.
 // The apply_url IS NULL guard is future-proof: if a write path for apply_url-only
 // rows is ever added, this won't accidentally delete them.
 export async function unmarkApplicationApplied(jobId: string): Promise<void> {
   const userId = await requireUserId();
   await assertNotDeleted(userId);
diff --git a/dashboard/app/actions/corrections.ts b/dashboard/app/actions/corrections.ts
index fd58878..f77d196 100644
--- a/dashboard/app/actions/corrections.ts
+++ b/dashboard/app/actions/corrections.ts
@@ -1,15 +1,17 @@
 "use server";
 
+import { readPrivateSnapshot, parseRequestBody } from "@/lib/jobLifecycle";
+
 import { requireUserId, getUserClaims } from "@/lib/auth";
 import { isAdmin } from "@/lib/admin";
-import { withUserSql } from "@/lib/db";
+import { withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 import { formToCorrection, buildDatasetItem } from "@/lib/rolefit/correction";
 import type { CorrectionForm } from "@/lib/rolefit/correction";
 import { upsertDatasetItem } from "@/lib/langfuseDataset";
 
 // Persist a human correction (overlay; never mutates job_reviews) and — for ADMINS only
 // — push it to the SHARED LangFuse reviewer-golden dataset. DB commits first, so a
 // LangFuse failure never loses the correction — it returns langfuseSynced=false and is
 // reconciled by `python -m reviewer.experiments sync`.
 //
@@ -21,21 +23,22 @@ export async function saveReviewCorrection(
   jobId: string,
   form: CorrectionForm,
 ): Promise<{ ok: true; langfuseSynced: boolean }> {
   const userId = await requireUserId();
   await assertNotDeleted(userId); // no resurrecting an erased account's correction via a stale JWT
   const row = formToCorrection(form);
 
   // Read inputs + persist the correction under the viewer's RLS context, in one
   // transaction. Returns the source row for the (post-commit) LangFuse sync.
   const correctedAt = new Date().toISOString(); // used for LangFuse dataset item only
-  const src = await withUserSql(userId, async (tx) => {
+  const src = await withUserPayloadMutation(userId, jobId, "review_corrections", async (tx) => {
+    const snapshot = await readPrivateSnapshot(tx, jobId, "job_reviews");
     // Model snapshot + dataset input, one round-trip.
     const inputRows = await tx`
       SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.location, c.ats, j.description,
              p.resume_text, p.instructions,
              to_jsonb(r.*) AS model_snapshot
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
       LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
       WHERE j.id = ${jobId}
@@ -50,52 +53,56 @@ export async function saveReviewCorrection(
       | undefined;
     if (!s) throw new Error(`job ${jobId} not found`);
 
     await tx`
       INSERT INTO review_corrections (
         user_id, job_id, verdict, experience_match, industry, industry_subcategory,
         confidence, role_category, seniority, work_arrangement,
         skills_score, experience_score, comp_score, fit_score,
         reasoning, about, pay_min, pay_max, pay_currency, pay_period, headcount,
         red_flags, skill_gaps, benefits, requirements, model_snapshot, note, corrected_at,
-        description_snapshot, resume_text_snapshot, instructions_snapshot
+        job_version_id, questions_snapshot, snapshot_captured_at, description_snapshot, resume_text_snapshot, instructions_snapshot
       ) VALUES (
         ${userId}::uuid, ${jobId}, ${row.verdict}, ${row.experience_match},
         ${row.industry}, ${row.industry_subcategory}, ${row.confidence},
         ${row.role_category}, ${row.seniority}, ${row.work_arrangement},
         ${row.skills_score}, ${row.experience_score}, ${row.comp_score}, ${row.fit_score},
         ${row.reasoning}, ${row.about}, ${row.pay_min}, ${row.pay_max},
         ${row.pay_currency}, ${row.pay_period}, ${row.headcount},
         ${tx.json(row.red_flags)}, ${tx.json(row.skill_gaps)},
         ${tx.json(row.benefits)}, ${tx.json(row.requirements)},
-        ${tx.json((s.model_snapshot ?? {}) as Parameters<typeof tx.json>[0])}, ${form.note}, now(),
-        ${s.description}, ${s.resume_text}, ${s.instructions}
+        ${JSON.stringify(parseRequestBody(s.model_snapshot))}::text::jsonb, ${form.note}, now(),
+        ${snapshot?.versionId ?? null}::uuid, ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb,
+        ${snapshot?.capturedAt ?? null}, ${snapshot?.description ?? s.description}, ${s.resume_text}, ${s.instructions}
       )
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         verdict = EXCLUDED.verdict, experience_match = EXCLUDED.experience_match,
         industry = EXCLUDED.industry, industry_subcategory = EXCLUDED.industry_subcategory,
         confidence = EXCLUDED.confidence, role_category = EXCLUDED.role_category,
         seniority = EXCLUDED.seniority, work_arrangement = EXCLUDED.work_arrangement,
         skills_score = EXCLUDED.skills_score, experience_score = EXCLUDED.experience_score,
         comp_score = EXCLUDED.comp_score, fit_score = EXCLUDED.fit_score,
         reasoning = EXCLUDED.reasoning, about = EXCLUDED.about,
         pay_min = EXCLUDED.pay_min, pay_max = EXCLUDED.pay_max,
         pay_currency = EXCLUDED.pay_currency, pay_period = EXCLUDED.pay_period,
         headcount = EXCLUDED.headcount, red_flags = EXCLUDED.red_flags,
         skill_gaps = EXCLUDED.skill_gaps, benefits = EXCLUDED.benefits,
         requirements = EXCLUDED.requirements, model_snapshot = EXCLUDED.model_snapshot,
         note = EXCLUDED.note, corrected_at = now(),
-        description_snapshot = EXCLUDED.description_snapshot,
+        description_snapshot = COALESCE(review_corrections.description_snapshot, EXCLUDED.description_snapshot),
+        job_version_id = COALESCE(review_corrections.job_version_id, EXCLUDED.job_version_id),
+        questions_snapshot = COALESCE(review_corrections.questions_snapshot, EXCLUDED.questions_snapshot),
+        snapshot_captured_at = COALESCE(review_corrections.snapshot_captured_at, EXCLUDED.snapshot_captured_at),
         resume_text_snapshot = EXCLUDED.resume_text_snapshot,
         instructions_snapshot = EXCLUDED.instructions_snapshot
     `;
-    return s;
+    return { ...s, description: snapshot?.description ?? s.description };
   });
 
   // Admin-only push to the shared golden dataset (minor 8). Non-admins: DB row persisted
   // above, nothing to reconcile → langfuseSynced stays true.
   let langfuseSynced = true;
   if (isAdmin(await getUserClaims())) {
     try {
       await upsertDatasetItem(
         buildDatasetItem({
           userId, jobId,
diff --git a/dashboard/app/actions/coverLetterEdits.ts b/dashboard/app/actions/coverLetterEdits.ts
index 4afba62..f5fd432 100644
--- a/dashboard/app/actions/coverLetterEdits.ts
+++ b/dashboard/app/actions/coverLetterEdits.ts
@@ -1,15 +1,17 @@
 "use server";
 
+import { readPrivateSnapshot } from "@/lib/jobLifecycle";
+
 import { revalidatePath } from "next/cache";
 import { requireUserId } from "@/lib/auth";
-import { withUserSql } from "@/lib/db";
+import { withUserSql, withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";
 import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
 import {
   buildCoverLetterGoldenItem,
   type CoverLetterGoldenInput,
 } from "@/lib/rolefit/coverLetterScore";
 import { upsertCoverLetterGoldenItem } from "@/lib/coverLetterGoldenDataset";
 
 const EDITED_TEXT_MAX_LENGTH = 20_000;
@@ -31,21 +33,22 @@ export async function saveCoverLetterEdit(
   await assertNotDeleted(userId); // no resurrecting an erased account's edit via a stale JWT
   const text = editedText.trim();
   if (!text) throw new Error("edited cover letter must not be empty");
   if (text.length > EDITED_TEXT_MAX_LENGTH) {
     throw new Error(`edited cover letter too long (max ${EDITED_TEXT_MAX_LENGTH} characters)`);
   }
 
   const editedAt = new Date().toISOString();
   // Read the full replay context + persist the edit under the viewer's RLS context in
   // one transaction. Returns the source row for the (post-commit) LangFuse push.
-  const src = await withUserSql(userId, async (tx) => {
+  const src = await withUserPayloadMutation(userId, jobId, "cover_letter_edits", async (tx) => {
+    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
     const rows = await tx`
       SELECT ap.cover_letter_json, ap.cover_letter_trace_id, ap.cover_letter_instructions,
              j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
              r.about,
              COALESCE(r.requirements, '[]'::jsonb) AS requirements,
              COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
              COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
              p.resume_text, p.full_name, p.model_cover
       FROM application_packages ap
       JOIN jobs j       ON j.id = ap.job_id
@@ -68,30 +71,31 @@ export async function saveCoverLetterEdit(
 
     // The eval "before": composed text of the stored structured letter. A malformed
     // jsonb (total parser returns null) degrades to null, never a crash.
     const parsed = parseTailoredCoverLetter(s.cover_letter_json);
     const originalText = parsed ? composeCoverLetterText(parsed) : null;
 
     // Re-saving overwrites (last-write-wins) and REVIVES a superseded edit
     // (superseded_at back to NULL) — the fresh edit is current again.
     await tx`
       INSERT INTO cover_letter_edits
-        (user_id, job_id, edited_text, original_text, cover_letter_trace_id,
+        (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, edited_text, original_text, cover_letter_trace_id,
          model, comment, superseded_at, edited_at)
-      VALUES (${userId}::uuid, ${jobId}, ${text}, ${originalText}, ${s.cover_letter_trace_id},
+      VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
+        ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${text}, ${originalText}, ${s.cover_letter_trace_id},
               ${s.model_cover}, ${comment}, NULL, now())
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         edited_text = EXCLUDED.edited_text, original_text = EXCLUDED.original_text,
         cover_letter_trace_id = EXCLUDED.cover_letter_trace_id, model = EXCLUDED.model,
         comment = EXCLUDED.comment, superseded_at = NULL, edited_at = now()
     `;
-    return { ...s, originalText };
+    return { ...s, description: snapshot?.description ?? s.description, originalText };
   });
 
   // Push this edit to the shared golden dataset as the expected_output. Best-effort:
   // the DB row is already committed above, so a LangFuse failure only flips
   // langfuseSynced=false (reconciled later by the --sync script) — never lost.
   let langfuseSynced = true;
   try {
     const input: CoverLetterGoldenInput = {
       background: src.resume_text,
       candidateName: src.full_name,
diff --git a/dashboard/app/actions/jobs.ts b/dashboard/app/actions/jobs.ts
index 0dcba9b..9145719 100644
--- a/dashboard/app/actions/jobs.ts
+++ b/dashboard/app/actions/jobs.ts
@@ -1,14 +1,16 @@
 "use server";
 
+import { requestJobPayload, readPrivateSnapshot } from "@/lib/jobLifecycle";
+
 import { requireUserId } from "@/lib/auth";
-import { withUserSql } from "@/lib/db";
+import { withUserSql, withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 
 // Manual reject. Mirrors an AI deny: flips the operator's review row to
 // verdict='deny' and marks it human_override so it is distinguishable and sticky
 // (the AI reviewer won't overwrite it; shared descriptions remain intact).
 // Inserts a minimal row if the job
 // was never reviewed. profile_version='' matches the company-override convention.
 export async function rejectJob(jobId: string): Promise<void> {
   const userId = await requireUserId();
   await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
@@ -24,16 +26,26 @@ export async function rejectJob(jobId: string): Promise<void> {
 // Undo (in-session). Non-destructive restore of the prior verdict, guarded by
 // human_override = TRUE so it only ever touches a row this feature rejected.
 // Never DELETEs — undoing a reject of a gate-rejected row keeps its
 // stage1_decision intact. Shared job descriptions are not affected by rejection.
 export async function unrejectJob(
   jobId: string,
   priorVerdict: string | null,
 ): Promise<void> {
   const userId = await requireUserId();
   await assertNotDeleted(userId);
-  await withUserSql(userId, (tx) => tx`
+  if (priorVerdict === "approve") {
+    const payload=await requestJobPayload(userId,jobId,"review");
+    if(payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
+  }
+  await withUserPayloadMutation(userId,jobId,"job_reviews",async tx => {
+    const snapshot=await readPrivateSnapshot(tx,jobId,"job_reviews");
+    await tx`
     UPDATE job_reviews
-       SET verdict = ${priorVerdict}, human_override = FALSE, reviewed_at = now()
-     WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND human_override = TRUE
-  `);
+       SET verdict=${priorVerdict},human_override=FALSE,reviewed_at=now(),
+           job_version_id=COALESCE(job_version_id,${snapshot?.versionId ?? null}::uuid),
+           description_snapshot=COALESCE(description_snapshot,${snapshot?.description ?? null}),
+           questions_snapshot=COALESCE(questions_snapshot,${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb),
+           snapshot_captured_at=COALESCE(snapshot_captured_at,${snapshot?.capturedAt ?? null})
+     WHERE user_id=${userId}::uuid AND job_id=${jobId} AND human_override = TRUE`;
+  });
 }
diff --git a/dashboard/app/actions/resumeScores.ts b/dashboard/app/actions/resumeScores.ts
index 7d2ab86..b6b649e 100644
--- a/dashboard/app/actions/resumeScores.ts
+++ b/dashboard/app/actions/resumeScores.ts
@@ -1,16 +1,18 @@
 "use server";
 
+import { readPrivateSnapshot } from "@/lib/jobLifecycle";
+
 import { revalidatePath } from "next/cache";
 import { requireUserId, getUserClaims } from "@/lib/auth";
 import { isAdmin } from "@/lib/admin";
-import { withUserSql } from "@/lib/db";
+import { withUserPayloadMutation } from "@/lib/db";
 import { assertNotDeleted } from "@/lib/tombstone";
 import { formToScoreRow, buildResumeGoldenItem, type ResumeScoreForm } from "@/lib/rolefit/resumeScore";
 import { upsertResumeGoldenItem } from "@/lib/resumeGoldenDataset";
 import { parseTailoredResume } from "@/lib/rolefit/packageCodec";
 
 // Persist a human résumé score (grounding + JD-relevance, 1–5) and — for ADMINS only —
 // push it to the SHARED LangFuse `resume-golden` dataset. DB commits first, so a LangFuse
 // failure never loses the score — it returns langfuseSynced=false and is reconciled by
 // `node scripts/calibrate-resume-judge.ts --sync`.
 //
@@ -21,21 +23,22 @@ export async function saveResumeScore(
   jobId: string,
   form: ResumeScoreForm,
 ): Promise<{ ok: true; langfuseSynced: boolean }> {
   const userId = await requireUserId();
   await assertNotDeleted(userId); // no resurrecting an erased account's score via a stale JWT
   const row = formToScoreRow(form);
 
   const scoredAt = new Date().toISOString();
   // Snapshot the exact résumé scored + persist, under the viewer's RLS context in
   // one transaction. Returns the source row for the (post-commit) LangFuse sync.
-  const src = await withUserSql(userId, async (tx) => {
+  const src = await withUserPayloadMutation(userId, jobId, "resume_scores", async (tx) => {
+    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
     const rows = await tx`
       SELECT ap.resume_json, ap.resume_trace_id,
              j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
              p.resume_text, p.model_resume
       FROM application_packages ap
       JOIN jobs j       ON j.id = ap.job_id
       JOIN companies c  ON c.id = j.company_id
       LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
       WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
     `;
@@ -43,33 +46,34 @@ export async function saveResumeScore(
       | {
           resume_json: unknown; resume_trace_id: string | null;
           title: string; company_name: string; description: string | null;
           resume_text: string | null; model_resume: string | null;
         }
       | undefined;
     if (!s) throw new Error(`no résumé generated for job ${jobId}`);
 
     await tx`
       INSERT INTO resume_scores (
-        user_id, job_id, grounding, jd_relevance, comment,
+        user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, grounding, jd_relevance, comment,
         resume_trace_id, resume_snapshot, model, scored_at
       ) VALUES (
-        ${userId}::uuid, ${jobId}, ${row.grounding}, ${row.jd_relevance}, ${row.comment},
+        ${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
+        ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${row.grounding}, ${row.jd_relevance}, ${row.comment},
         ${s.resume_trace_id}, ${JSON.stringify(parseTailoredResume(s.resume_json) ?? {})}::jsonb, ${s.model_resume}, now()
       )
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         grounding = EXCLUDED.grounding, jd_relevance = EXCLUDED.jd_relevance,
         comment = EXCLUDED.comment, resume_trace_id = EXCLUDED.resume_trace_id,
         resume_snapshot = EXCLUDED.resume_snapshot, model = EXCLUDED.model,
         scored_at = now()
     `;
-    return s;
+    return { ...s, description: snapshot?.description ?? s.description };
   });
 
   // Admin-only push to the shared golden dataset (minor 8). Non-admins: DB row persisted
   // above, nothing to reconcile → langfuseSynced stays true.
   let langfuseSynced = true;
   if (isAdmin(await getUserClaims())) {
     try {
       await upsertResumeGoldenItem(
         buildResumeGoldenItem({
           userId, jobId,
diff --git a/dashboard/app/api/application/prepare/route.test.ts b/dashboard/app/api/application/prepare/route.test.ts
index 81728e7..f636115 100644
--- a/dashboard/app/api/application/prepare/route.test.ts
+++ b/dashboard/app/api/application/prepare/route.test.ts
@@ -1,10 +1,14 @@
+vi.mock("@/lib/jobLifecycle", async (importOriginal) => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 
 // Route-level test for /api/application/prepare under the "Prefill application" contract
 // (the user-facing label; kind stays 'prepare' internally). The route is GREENHOUSE-ONLY
 // (a non-Greenhouse job 400s before charging), loads the posting's question schema from
 // job_questions (falling back to an on-demand fetch), and reserves CONDITIONALLY: always
 // résumé, plus cover ONLY when the posting asks for a cover letter. In the background it
 // runs the résumé leg → (chained on success) a bounded prefill fed the GENERATED résumé,
@@ -211,32 +215,27 @@ describe("POST /api/application/prepare — Greenhouse guard + conditional reser
     expect(args.job.description).toBe(description);
     const { buildResumePrompt } = await import("@/lib/rolefit/resumeSchema");
     const prompt = buildResumePrompt({
       ...args,
       profile: { name: "Fixture", contact: "", educationEntries: [], certifications: [], experience: [] },
     });
     expect(prompt.user).toContain(description);
     expect(prompt.user).not.toContain("(none provided)");
   });
 
-  test("on-demand fetch fallback when no stored job_questions row", async () => {
+  test("missing question schema defers with no fetch, charge, or provider calls", async () => {
     mocks.getJobQuestion.mockResolvedValue(null);
-    mocks.fetchGreenhouseQuestions.mockResolvedValue(TEXT_Q);
-    const res = await POST(req({ jobId: "job-1" }));
+    const res = await POST(req({jobId:"job-1"}));
     expect(res.status).toBe(202);
-    // Passes the token/id plus an 8s-bounded fetchImpl (the synchronous-prologue fetch
-    // must not stall the click on a hung Greenhouse API).
-    expect(mocks.fetchGreenhouseQuestions).toHaveBeenCalledWith(
-      expect.objectContaining({ token: "tok", externalId: "ext-1", fetchImpl: expect.any(Function) }),
-    );
-    // No cover-letter question in the fetched schema → résumé-only reserve.
-    expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
+    expect(mocks.fetchGreenhouseQuestions).not.toHaveBeenCalled();
+    expect(mocks.reserveGenerations).not.toHaveBeenCalled();
+    expect(mocks.generateResume).not.toHaveBeenCalled();
   });
 });
 
 describe("POST /api/application/prepare — validation ladder (never charge an unchargeable request)", () => {
   test("401 anon", async () => {
     mocks.getUserClaims.mockResolvedValue(null);
     expect((await POST(req())).status).toBe(401);
     expect(mocks.reserveGenerations).not.toHaveBeenCalled();
   });
   test("400 missing jobId", async () => {
@@ -478,10 +477,21 @@ describe("POST /api/application/prepare — profile-level generation instruction
       model_resume: null, model_cover: null, profile_version: "pv-9",
       resume_generation_instructions: "RESUME-GEN-SENTINEL",
       cover_letter_generation_instructions: "COVER-GEN-SENTINEL",
     });
     await POST(req({ jobId: "job-1" }));
     await flushBackground();
     expect(mocks.generateResume.mock.calls[0][0].profileInstructions).toBe("RESUME-GEN-SENTINEL");
     expect(mocks.generateCoverLetter.mock.calls[0][0].profileInstructions).toBe("COVER-GEN-SENTINEL");
   });
 });
+
+test("pending service hydration returns without allowance or provider work", async()=>{
+  const {requestJobPayload}=await import("@/lib/jobLifecycle");
+  vi.mocked(requestJobPayload).mockResolvedValueOnce({status:"pending",id:"demand"});
+  const response=await POST(req({jobId:"job-1"}));
+  expect(response.status).toBe(202);
+  expect((await response.json()).payload.status).toBe("pending");
+  expect(mocks.reserveGenerations).not.toHaveBeenCalled();
+  expect(mocks.generateResume).not.toHaveBeenCalled();
+  expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
+});
diff --git a/dashboard/app/api/application/prepare/route.ts b/dashboard/app/api/application/prepare/route.ts
index b59d17a..3bee12a 100644
--- a/dashboard/app/api/application/prepare/route.ts
+++ b/dashboard/app/api/application/prepare/route.ts
@@ -1,23 +1,23 @@
+import { requestJobPayload, parseRequestBody } from "@/lib/jobLifecycle";
 import { after } from "next/server";
 import { propagateAttributes } from "@langfuse/tracing";
 import { getUserClaims } from "@/lib/auth";
 import { getProfile, getJobForPackage, getJobQuestion, upsertApplicationPackage } from "@/lib/queries";
 import { gateRejectionBody } from "@/lib/gateRejection";
 import { reserveGenerations, refundGenerations, type GenerationKind } from "@/lib/usage";
 import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
 import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
 import { applyUrl } from "@/lib/rolefit/applyUrl";
 import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
 import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
 import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
-import { fetchGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "@/lib/rolefit/coverLetterQuestion";
 import { toPrefillQuestions, type PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
 import { composeResumeText } from "@/lib/rolefit/resumeText";
 import { getResumeSource } from "@/lib/rolefit/resumeSource";
 import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
 import { getStructuredModels } from "@/lib/openrouter";
 import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
 import { tracingEnabled, ensureTracingStarted, flushLangfuseTraces } from "@/lib/observability";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
@@ -55,64 +55,56 @@ const PREFILL_TIMEOUT_MS = 45_000;
 // résumé still persists). The cover leg runs in parallel, ONLY when the posting asks
 // for a cover letter (it's the only leg besides résumé that reserves allowance). The
 // row settles 'ready' when the legs settle — with a user-safe partial note if a WANTED
 // leg failed — and 'failed' only when nothing new persisted.
 export async function POST(req: Request) {
   const claims = await getUserClaims();
   if (!claims) return Response.json({ error: "sign in to prefill an application" }, { status: 401 });
   const userId = claims.id;
 
   const { jobId, resumeInstructions: rawResumeInstr, coverLetterInstructions: rawCoverInstr } =
-    (await req.json().catch(() => ({}))) as {
-      jobId?: string; resumeInstructions?: unknown; coverLetterInstructions?: unknown;
-    };
-  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
+    parseRequestBody(await req.json().catch(() => null));
+  if (typeof jobId !== "string" || !jobId) return Response.json({ error: "jobId required" }, { status: 400 });
   // Per-job instruction boxes → each leg's own instructions. Over-cap is a caller
   // error (400) rejected BEFORE the gate so a bad request never charges allowance.
   const resumeNorm = normalizeInstructions(rawResumeInstr, "résumé");
   if (!resumeNorm.ok) return Response.json({ error: resumeNorm.error }, { status: 400 });
   const coverNorm = normalizeInstructions(rawCoverInstr, "cover letter");
   if (!coverNorm.ok) return Response.json({ error: coverNorm.error }, { status: 400 });
   const resumeInstructions = resumeNorm.value;
   const coverLetterInstructions = coverNorm.value;
 
   const profile = await getProfile(userId);
   if (!profile?.resume_text) {
     return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
   }
   const job = await getJobForPackage(jobId, userId);
   if (!job) return Response.json({ error: "job not found" }, { status: 404 });
   if (job.ats !== "greenhouse") {
     return Response.json({ error: "Prefill is available for Greenhouse postings only" }, { status: 400 });
   }
 
+  const payload = await requestJobPayload(userId, jobId, "prepare");
+  if (payload.status === "pending" || payload.status === "deferred") {
+    return Response.json({ payload, message: "Job details are being prepared. Try again shortly." }, {status:202});
+  }
+  if (payload.status === "ready") job.description = payload.description;
+  if (!job.description?.trim()) return Response.json({payload:{status:"deferred"}, message:"Job description unavailable."}, {status:202});
+
   const apiKey = process.env.OPENROUTER_API_KEY;
   if (!apiKey) return Response.json({ error: "application prefill not configured" }, { status: 500 });
 
   const resumeModel = profile.model_resume ?? DEFAULT_RESUME_MODEL;
   const coverModel = profile.model_cover ?? DEFAULT_COVER_MODEL;
 
-  // Poll-time question schema (shared). Fall back to an on-demand fetch for a brand-new
-  // job not yet backfilled — used IN-MEMORY ONLY; the poller persists it later (this
-  // route has shared_read access via getJobQuestion and never writes job_questions).
-  let questions = await getJobQuestion(userId, jobId);
-  if (questions == null) {
-    // On-demand fallback runs in the SYNCHRONOUS prologue (before the 202), so a slow/hung
-    // Greenhouse API would stall the user's click for minutes. Bound it to 8s via an
-    // AbortSignal on fetchImpl → on timeout fetchGreenhouseQuestions swallows the abort and
-    // returns null, degrading to a résumé-only reserve exactly as designed.
-    questions = await fetchGreenhouseQuestions({
-      token: job.company_token,
-      externalId: job.external_id,
-      fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
-    });
-  }
+  const questions = payload.status === "ready" ? payload.questions : await getJobQuestion(userId, jobId);
+  if (questions === null) return Response.json({payload:{status:"pending"}, message:"Application questions are being prepared."}, {status:202});
   const wantsCover = hasCoverLetterQuestion(questions);
 
   // Always charge résumé; charge cover ONLY when the posting asks for one. reserveGenerations
   // is ATOMIC (avoids check-then-charge TOCTOU) and all-or-nothing across the kinds; a
   // rejected leg is REFUNDED below so it never burns allowance. After the 404/400/422/500
   // validation so we never charge a request that can't generate. No plan → 402, exhausted → 429.
   const kinds: GenerationKind[] = wantsCover ? ["resume", "cover"] : ["resume"];
   // The catalog is fetched CONCURRENTLY with the gate; getStructuredModels is 1h-cached
   // and returns [] (fail-open) on failure, so it adds no new rejection path even on the
   // reject path.
@@ -131,21 +123,21 @@ export async function POST(req: Request) {
   );
   const coverReasoning = resolveReasoningSetting(
     gate.plan, profile.reasoning_effort_cover, coverModel, catalog,
   );
 
   // Pending tracking row — created AFTER the reserve, so a pending row always
   // corresponds to charged slots. A concurrent duplicate converges on the existing
   // pending row: refund THIS request's extra reservations and 202 idempotently.
   let tracked;
   try {
-    tracked = await createGenerationJob(userId, jobId, "prepare");
+    tracked = await createGenerationJob(userId, jobId, "prepare", payload);
   } catch (e) {
     await refundGenerations(userId, kinds);
     console.error("application prepare tracking failed", {
       userId, jobId, error: e instanceof Error ? e.message : String(e),
     });
     return Response.json({ error: "Prefill couldn’t start — try again." }, { status: 502 });
   }
   const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
   if (!tracked.created) {
     await refundGenerations(userId, kinds);
@@ -246,20 +238,21 @@ export async function POST(req: Request) {
 
     const resume: TailoredResume | null = resumeResult.status === "fulfilled" ? resumeResult.value.resume : null;
     const prefilledAnswers: PrefilledAnswer[] | null =
       resumeResult.status === "fulfilled" ? resumeResult.value.prefilled : null;
     const coverLetter: TailoredCoverLetter | null = coverResult.status === "fulfilled" ? coverResult.value : null;
 
     if (resumeResult.status === "rejected") console.error("resume generation failed", resumeResult.reason);
     if (wantsCover && coverResult.status === "rejected") console.error("cover letter generation failed", coverResult.reason);
 
     await upsertApplicationPackage(userId, jobId, {
+      payload,
       resume,
       coverLetter,
       prefilledAnswers,
       applyUrl: applyUrl(job.ats, job.url),
       resumeTraceId,
       coverLetterTraceId,
       resumeInstructions,
       coverLetterInstructions,
       profileVersion: profile.profile_version,
     });
diff --git a/dashboard/app/api/cover-letter/route.test.ts b/dashboard/app/api/cover-letter/route.test.ts
index fdff771..abf5d43 100644
--- a/dashboard/app/api/cover-letter/route.test.ts
+++ b/dashboard/app/api/cover-letter/route.test.ts
@@ -1,10 +1,14 @@
+vi.mock("@/lib/jobLifecycle", async (importOriginal) => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
 
 // Same async-generation drift as /api/resume: auth/validation/gate stay synchronous
 // (402/429 pass-through unchanged), then a 'pending' generation_jobs row + 202; the
 // LLM work runs in a captured after() callback that tests drain explicitly. The
 // cover-specific contract (profileVersion:null, review-context forwarding) is unchanged.
 const mocks = vi.hoisted(() => ({
   getUserClaims: vi.fn(),
   getProfile: vi.fn(),
   getJobForCoverLetter: vi.fn(),
@@ -159,21 +163,21 @@ describe("POST /api/cover-letter — subscription/allowance gate (synchronous, b
 
 describe("POST /api/cover-letter — cover-specific contract", () => {
   test("202 with the tracked pending generation; reserves the cover kind; persists cover-only with profileVersion:null in the background", async () => {
     const res = await POST(req({ jobId: "job-1" }));
     expect(res.status).toBe(202);
     const body = await res.json();
     expect(body.generation).toMatchObject({
       id: GEN_ROW.id, kind: "cover", status: "pending", jobTitle: "Eng", company: "Acme",
     });
     expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["cover"]);
-    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "cover");
+    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "cover", {status:"legacy",id:null});
 
     await flushBackground();
     const pkg = mocks.upsertApplicationPackage.mock.calls[0][2];
     expect(pkg.coverLetter).toBe(LETTER);
     expect(pkg.coverLetterTraceId).toBe("cl-tr-1");
     expect(pkg.coverLetterInstructions).toBeNull();
     expect(pkg.resume).toBeNull();
     // A cover-only regen must NOT stamp or clear the stored résumé's profile_version
     // (ON CONFLICT preserves it).
     expect(pkg.profileVersion).toBeNull();
diff --git a/dashboard/app/api/cover-letter/route.ts b/dashboard/app/api/cover-letter/route.ts
index d8d384f..30d6dc7 100644
--- a/dashboard/app/api/cover-letter/route.ts
+++ b/dashboard/app/api/cover-letter/route.ts
@@ -1,10 +1,11 @@
+import { requestJobPayload, parseRequestBody } from "@/lib/jobLifecycle";
 import { after } from "next/server";
 import { propagateAttributes } from "@langfuse/tracing";
 import { getUserClaims } from "@/lib/auth";
 import { getProfile, getJobForCoverLetter, upsertApplicationPackage } from "@/lib/queries";
 import { gateRejectionBody } from "@/lib/gateRejection";
 import { reserveGenerations, refundGenerations } from "@/lib/usage";
 import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
 import { generationFailureMessage } from "@/lib/rolefit/generationFailureMessage";
 import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
 import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
@@ -22,34 +23,41 @@ export const maxDuration = 300;
 // stay synchronous (a fetch() POST wants a clean 401 JSON, not requireUserId's
 // redirect to /login), then a 'pending' generation_jobs row is recorded and the
 // route returns 202. The LLM work, persist, and status write run in `after()`;
 // the client polls GET /api/generations and toasts completion.
 export async function POST(req: Request) {
   const claims = await getUserClaims();
   if (!claims) return Response.json({ error: "sign in to generate a cover letter" }, { status: 401 });
   const userId = claims.id;
 
   const { jobId, instructions: rawInstructions } =
-    (await req.json().catch(() => ({}))) as { jobId?: string; instructions?: unknown };
-  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
+    parseRequestBody(await req.json().catch(() => null));
+  if (typeof jobId !== "string" || !jobId) return Response.json({ error: "jobId required" }, { status: 400 });
   // Per-job generation instructions ride the generate request (the sole instruction
   // source — profile.instructions is reviewer-only and no longer reaches generation).
   const norm = normalizeInstructions(rawInstructions, "cover letter");
   if (!norm.ok) return Response.json({ error: norm.error }, { status: 400 });
   const instructions = norm.value;
 
   const [profile, job] = await Promise.all([getProfile(userId), getJobForCoverLetter(jobId, userId)]);
   if (!profile?.resume_text) {
     return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
   }
   if (!job) return Response.json({ error: "job not found" }, { status: 404 });
 
+  const payload = await requestJobPayload(userId, jobId, "generation");
+  if (payload.status === "pending" || payload.status === "deferred") {
+    return Response.json({ payload, message: "Job details are being prepared. Try again shortly." }, {status:202});
+  }
+  if (payload.status === "ready") job.description = payload.description;
+  if (!job.description?.trim()) return Response.json({payload:{status:"deferred"}, message:"Job description unavailable."}, {status:202});
+
   const apiKey = process.env.OPENROUTER_API_KEY;
   if (!apiKey) return Response.json({ error: "cover letter generation not configured" }, { status: 500 });
 
   const model = profile.model_cover ?? DEFAULT_COVER_MODEL;
 
   // Tier gate: no plan → 402, exhausted → 429. reserveGenerations ATOMICALLY charges the
   // slot up front (avoids check-then-charge TOCTOU); the background catch refunds on
   // failure so a failed generation never burns allowance. After the 404/422/500
   // validation so we never charge a request that can't generate. The catalog is fetched
   // CONCURRENTLY with the gate; getStructuredModels is 1h-cached and returns [] (fail-open)
@@ -66,21 +74,21 @@ export async function POST(req: Request) {
   const reasoningEffort = resolveReasoningSetting(
     gate.plan, profile.reasoning_effort_cover, model, catalog,
   );
 
   // Pending tracking row — created AFTER the reserve, so a pending row always
   // corresponds to a charged slot. A concurrent duplicate converges on the
   // existing pending row: refund THIS request's extra reservation and 202
   // idempotently without starting a second background generation.
   let tracked;
   try {
-    tracked = await createGenerationJob(userId, jobId, "cover");
+    tracked = await createGenerationJob(userId, jobId, "cover", payload);
   } catch (e) {
     await refundGenerations(userId, ["cover"]);
     console.error("cover letter generation tracking failed", {
       userId, jobId, error: e instanceof Error ? e.message : String(e),
     });
     return Response.json({ error: "Generation couldn’t start — try again." }, { status: 502 });
   }
   const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
   if (!tracked.created) {
     await refundGenerations(userId, ["cover"]);
@@ -112,20 +120,21 @@ export async function POST(req: Request) {
           about: job.about,
           requirements: job.requirements,
           skillGaps: job.skill_gaps,
           redFlags: job.red_flags,
         },
         model,
         reasoningEffort,
         apiKey,
       });
       await upsertApplicationPackage(userId, jobId, {
+      payload,
         resume: null,
         coverLetter: letter,
         prefilledAnswers: null,
         applyUrl: null,
         coverLetterTraceId: traceId,
         coverLetterInstructions: instructions,
         // No résumé generated here, so no résumé provenance to record. upsert's
         // ON CONFLICT preserves the stored résumé + its profile_version untouched.
         profileVersion: null,
       });
diff --git a/dashboard/app/api/jobs/[id]/route.test.ts b/dashboard/app/api/jobs/[id]/route.test.ts
index 8203cda..d74e16b 100644
--- a/dashboard/app/api/jobs/[id]/route.test.ts
+++ b/dashboard/app/api/jobs/[id]/route.test.ts
@@ -1,10 +1,14 @@
+vi.mock("@/lib/jobLifecycle", async (importOriginal) => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { beforeEach, describe, expect, test, vi } from "vitest";
 
 // The DB read is the only boundary; the JOB_ID_RE gate runs for real so we actually test
 // the injection/abuse shield. The SaaS cutover made this route VIEWER-SCOPED: it resolves
 // getUserId() and passes it into getJobReviewDetail(id, viewerId), and flips Cache-Control
 // from a shared-CDN `public` cache to `private, no-store` (a tenant-leak guard).
 const mocks = vi.hoisted(() => ({
   getJobReviewDetail: vi.fn(), getJobQuestion: vi.fn(), getUserId: vi.fn(),
 }));
 vi.mock("@/lib/queries", () => ({
diff --git a/dashboard/app/api/jobs/[id]/route.ts b/dashboard/app/api/jobs/[id]/route.ts
index 805a752..3fc4b38 100644
--- a/dashboard/app/api/jobs/[id]/route.ts
+++ b/dashboard/app/api/jobs/[id]/route.ts
@@ -1,10 +1,11 @@
+import { requestJobPayload } from "@/lib/jobLifecycle";
 import { getJobReviewDetail, getJobQuestion } from "@/lib/queries";
 import { getUserId } from "@/lib/auth";
 import { JOB_ID_RE } from "@/lib/jobIdValidator";
 
 export const dynamic = "force-dynamic";
 
 const EMPTY = {
   reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
   description: null, url: null,
   experience_match: null, industry: null, industry_subcategory: null,
@@ -29,14 +30,16 @@ export async function GET(
   // anon viewer gets null, exactly as the old eager board passed {} for anon. getJobQuestion
   // is keyed on job_id alone (shared_read RLS), so it resolves even for a job the viewer
   // rejected — the eager path included rejected ids for the same reason.
   const [detail, questions] = await Promise.all([
     getJobReviewDetail(id, viewerId),
     viewerId ? getJobQuestion(viewerId, id) : Promise.resolve(null),
   ]);
   // The body is viewer-scoped (their own review). It MUST NOT be cached in a shared
   // CDN cache — a `public` cache would leak one tenant's review to another. Keep it
   // private and uncached.
-  return Response.json({ ...(detail ?? EMPTY), questions }, {
+  const payload = viewerId && detail ? await requestJobPayload(viewerId, id, "description") : null;
+  return Response.json({ ...(detail ?? EMPTY), questions,
+    ...(payload?.status === "ready" ? {description:payload.description,questions:payload.questions ?? questions} : {}), ...(payload && payload.status !== "legacy" ? {payload} : {}) }, {
     headers: { "Cache-Control": "private, no-store" },
   });
 }
diff --git a/dashboard/app/api/resume/route.test.ts b/dashboard/app/api/resume/route.test.ts
index 17d6884..dabad9f 100644
--- a/dashboard/app/api/resume/route.test.ts
+++ b/dashboard/app/api/resume/route.test.ts
@@ -1,10 +1,14 @@
+vi.mock("@/lib/jobLifecycle", async (importOriginal) => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
 import type { ProfileRow } from "@/lib/types";
 
 // Async-generation contract: the route does auth/validation/config/gate
 // SYNCHRONOUSLY (so 401/400/422/404/500/402/429 still reach the caller), records
 // a 'pending' generation_jobs row, and returns 202. The LLM work + persist +
 // status write run in `after()` — mocked here so tests trigger the background
 // callback deterministically. reserveGenerations(userId, email, ["resume"]) still
 // charges the slot UP FRONT and a failed background generation refunds it.
 const mocks = vi.hoisted(() => ({
@@ -171,21 +175,21 @@ describe("POST /api/resume — 202 accept + background completion", () => {
   test("202 immediately with the tracked pending generation (title/company for the toast)", async () => {
     const res = await POST(req({ jobId: "job-1" }));
     expect(res.status).toBe(202);
     const body = await res.json();
     expect(body.generation).toMatchObject({
       id: GEN_ROW.id, jobId: "job-1", kind: "resume", status: "pending",
       jobTitle: "Eng", company: "Acme",
     });
     // Charged exactly once, for THIS user+email, BEFORE the row was tracked.
     expect(mocks.reserveGenerations).toHaveBeenCalledWith(USER, EMAIL, ["resume"]);
-    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "resume");
+    expect(mocks.createGenerationJob).toHaveBeenCalledWith(USER, "job-1", "resume", {status:"legacy",id:null});
     // Nothing generated yet — the LLM work lives in the captured after() callback.
     expect(mocks.generateResume).not.toHaveBeenCalled();
     expect(mocks.afterCallbacks).toHaveLength(1);
   });
 
   test("background success: generates from resume_text, persists stamped package, settles ready, keeps the slot", async () => {
     await POST(req({ jobId: "job-1" }));
     await flushBackground();
     // The REAL getResumeSource fed the generator the profile's resume_text.
     expect(mocks.generateResume.mock.calls[0][0].resumeText).toBe("resume text");
diff --git a/dashboard/app/api/resume/route.ts b/dashboard/app/api/resume/route.ts
index ab91e0a..c1a115c 100644
--- a/dashboard/app/api/resume/route.ts
+++ b/dashboard/app/api/resume/route.ts
@@ -1,10 +1,11 @@
+import { requestJobPayload, parseRequestBody } from "@/lib/jobLifecycle";
 import { after } from "next/server";
 import { propagateAttributes } from "@langfuse/tracing";
 import { getUserClaims } from "@/lib/auth";
 import { getProfile, getJobForResume, upsertApplicationPackage } from "@/lib/queries";
 import { gateRejectionBody } from "@/lib/gateRejection";
 import { reserveGenerations, refundGenerations } from "@/lib/usage";
 import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
 import { generationFailureMessage } from "@/lib/rolefit/generationFailureMessage";
 import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
 import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
@@ -23,34 +24,41 @@ export const maxDuration = 300;
 // validation, config, and the allowance gate — stays synchronous (401/400/422/
 // 404/500/402/429 exactly as before), then the route records a 'pending'
 // generation_jobs row and returns 202. The LLM work, persist, and status write
 // run in `after()`; the client polls GET /api/generations and toasts completion.
 export async function POST(req: Request) {
   const claims = await getUserClaims();
   if (!claims) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });
   const userId = claims.id;
 
   const { jobId, instructions: rawInstructions } =
-    (await req.json().catch(() => ({}))) as { jobId?: string; instructions?: unknown };
-  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
+    parseRequestBody(await req.json().catch(() => null));
+  if (typeof jobId !== "string" || !jobId) return Response.json({ error: "jobId required" }, { status: 400 });
   // Per-job generation instructions ride the generate request (the sole instruction
   // source — profile.instructions is reviewer-only and no longer reaches generation).
   const norm = normalizeInstructions(rawInstructions, "résumé");
   if (!norm.ok) return Response.json({ error: norm.error }, { status: 400 });
   const instructions = norm.value;
 
   const [profile, job] = await Promise.all([getProfile(userId), getJobForResume(jobId, userId)]);
   if (!profile?.resume_text) {
     return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
   }
   if (!job) return Response.json({ error: "job not found" }, { status: 404 });
 
+  const payload = await requestJobPayload(userId, jobId, "generation");
+  if (payload.status === "pending" || payload.status === "deferred") {
+    return Response.json({ payload, message: "Job details are being prepared. Try again shortly." }, {status:202});
+  }
+  if (payload.status === "ready") job.description = payload.description;
+  if (!job.description?.trim()) return Response.json({payload:{status:"deferred"}, message:"Job description unavailable."}, {status:202});
+
   const apiKey = process.env.OPENROUTER_API_KEY;
   if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });
 
   const { resumeText } = getResumeSource(profile);
 
   const model = profile.model_resume ?? DEFAULT_RESUME_MODEL;
 
   // Tier gate: no plan → 402, monthly allowance exhausted → 429. reserveGenerations
   // ATOMICALLY charges the slot up front (avoids the check-then-charge TOCTOU); the
   // background catch below REFUNDS on a failed generation so a failure never burns
@@ -70,21 +78,21 @@ export async function POST(req: Request) {
   const reasoningEffort = resolveReasoningSetting(
     gate.plan, profile.reasoning_effort_resume, model, catalog,
   );
 
   // Pending tracking row — created AFTER the reserve, so a pending row always
   // corresponds to a charged slot. A concurrent duplicate converges on the
   // existing pending row: refund THIS request's extra reservation and 202
   // idempotently without starting a second background generation.
   let tracked;
   try {
-    tracked = await createGenerationJob(userId, jobId, "resume");
+    tracked = await createGenerationJob(userId, jobId, "resume", payload);
   } catch (e) {
     await refundGenerations(userId, ["resume"]);
     console.error("resume generation tracking failed", {
       userId, jobId, error: e instanceof Error ? e.message : String(e),
     });
     return Response.json({ error: "Generation couldn’t start — try again." }, { status: 502 });
   }
   const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
   if (!tracked.created) {
     await refundGenerations(userId, ["resume"]);
@@ -110,20 +118,21 @@ export async function POST(req: Request) {
         resumeText,
         job: { title: job.title, company: job.company_name, description: job.description },
         model,
         reasoningEffort,
         apiKey,
         instructions,
         profileInstructions: profile.resume_generation_instructions,
       });
 
       await upsertApplicationPackage(userId, jobId, {
+      payload,
         resume,
         coverLetter: null,
         prefilledAnswers: null,
         applyUrl: null,
         resumeTraceId: traceId,
         resumeInstructions: instructions,
         profileVersion: profile.profile_version,
       });
       // The slot was reserved (charged) up front; a success keeps it.
       await settle({ status: "ready" });
diff --git a/dashboard/app/api/review/request/route.ts b/dashboard/app/api/review/request/route.ts
index 00eec6c..f16b593 100644
--- a/dashboard/app/api/review/request/route.ts
+++ b/dashboard/app/api/review/request/route.ts
@@ -2,21 +2,22 @@ import { getUserClaims } from "@/lib/auth";
 import { getViewerPlan } from "@/lib/subscriptions";
 import {
   resumeMatching, getMatchingPaused, getLatestReviewRequest, remainingDailyBudget, reviewsChargedToday,
 } from "@/lib/reviewRequests";
 import { getReviewFeed } from "@/lib/queries";
 
 export const dynamic = "force-dynamic";
 
 // On-demand "review my board now" (spec F core). Authed only — NOT in PUBLIC_PREFIXES.
 // The reviewer worker (reviewer/worker.py) consumes the enqueued row and runs the
-// SAME _review_user path, so the cap + location filter (T8) bound it for free.
+// SAME _review_user path: entitlement/location/company filters precede demand
+// hydration, and only durable description versions reach either model stage.
 
 // POST → enqueue (idempotent). 402 if no plan, 409 if the daily budget is spent.
 export async function POST() {
   const claims = await getUserClaims();
   if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
   const userId = claims.id;
 
   // Rejections carry a machine-readable `code` (and the plan, once known) so the client
   // can key its /billing upsell CTA off structured fields, mirroring lib/usage.ts's
   // AllowanceGateRejection shape.
diff --git a/dashboard/components/rolefit/RolefitBoard.test.tsx b/dashboard/components/rolefit/RolefitBoard.test.tsx
index d2b62ae..1c99713 100644
--- a/dashboard/components/rolefit/RolefitBoard.test.tsx
+++ b/dashboard/components/rolefit/RolefitBoard.test.tsx
@@ -163,10 +163,16 @@ describe("pay range filter wiring", () => {
     );
     // Load-bearing: the FilterBar result-count is layout-independent (unlike the virtualized
     // JobList, which renders no card rows in jsdom, and the auto-selected detail pane). It
     // reads `visibleCount of totalInView roles` where visibleCount is the count AFTER the pay
     // filter — so "1 of 2" proves the payMin:100 filter actually dropped the 60–80k job.
     expect(container.querySelector(".rf-board-result-count")?.textContent).toBe("1 of 2 roles");
     // Pay trigger reflects the active lower bound.
     expect(screen.getByRole("button", { name: /Pay.*\$100k\+/ })).toBeTruthy();
   });
 });
+
+test("hydration pending clears generation busy state and keeps retry available",async()=>{
+  await renderAndPrepare(202,{payload:{status:"pending",id:"d"},message:"Job details are being prepared. Try again shortly."});
+  expect(await screen.findByText("Job details are being prepared. Try again shortly.")).toBeTruthy();
+  expect(await screen.findByRole("button",{name:/Prefill application/})).toBeTruthy();
+});
diff --git a/dashboard/components/rolefit/RolefitBoard.tsx b/dashboard/components/rolefit/RolefitBoard.tsx
index e8442ae..28effac 100644
--- a/dashboard/components/rolefit/RolefitBoard.tsx
+++ b/dashboard/components/rolefit/RolefitBoard.tsx
@@ -1,12 +1,13 @@
 "use client";
 
+import { jobPayloadNotice } from "@/lib/jobPayloadNotice";
 import { useState, useEffect, useMemo, useRef, useCallback, useTransition, useDeferredValue, useSyncExternalStore } from "react";
 import { useRouter } from "next/navigation";
 import type { ApplicationPackage, JobRow, JobReviewDetail, OperatorSignals } from "@/lib/types";
 import { ReviewNowPanel } from "@/components/rolefit/ReviewNowPanel";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 import type { BoardFilterState } from "@/lib/rolefit/filter";
 import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
 import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import { applyFilters, facetCounts, filterByView, mergeRejectedPool, sortJobs } from "@/lib/rolefit/filter";
@@ -1024,20 +1025,26 @@ export function RolefitBoard({
     setGen((g) => ({ ...g, [job.id]: "busy" }));
     try {
       const res = await fetch("/api/resume", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ jobId: job.id, instructions: resumeInstructions[job.id]?.trim() || undefined }),
       });
       if (res.status === 202) {
         // Accepted: hand tracking to the provider (immediate pending + prompt poll).
         const body: unknown = await res.json().catch(() => null);
+        const notice=jobPayloadNotice(body);
+        if(notice) {
+          setGen(g=>({...g,[job.id]:hadResume ? "done" : "idle"}));
+          showActionError(notice);
+          return;
+        }
         const generation = parseGenerationJob((body as { generation?: unknown } | null)?.generation);
         if (generation && tracker) tracker.notifyStarted(generation);
         else tracker?.refresh();
         return;
       }
       const body = await res.json().catch(() => ({}));
       // Tier gate (402 subscribe / 429 monthly allowance): nothing was generated, so
       // the pane returns to its prior state and the upsell pill carries the message
       // + /billing CTA instead of the generic error path.
       const gate = tierGateNotice(res.status, body);
@@ -1046,56 +1053,62 @@ export function RolefitBoard({
         setGen((g) => ({ ...g, [job.id]: hadResume ? "done" : "idle" }));
         return;
       }
       throw new Error((body as { error?: string }).error ?? "failed");
     } catch (e) {
       setGen((g) => ({ ...g, [job.id]: "error" }));
       setGenError((m) => ({ ...m, [job.id]: (e as Error).message }));
     } finally {
       endRequest(job.id);
     }
-  }, [beginRequest, endRequest, genData, resumeInstructions, showUpsell, tracker]);
+  }, [beginRequest, endRequest, genData, resumeInstructions, showActionError, showUpsell, tracker]);
 
   // Cover-letter generation — mirrors handleGenerate against /api/cover-letter (D7).
   const handleGenerateCover = useCallback(async (job: JobRow) => {
     if (!beginRequest(job.id)) return;
     const hadCover = Boolean(coverData[job.id]);
     setCoverGen((g) => ({ ...g, [job.id]: "busy" }));
     try {
       const res = await fetch("/api/cover-letter", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ jobId: job.id, instructions: coverInstructions[job.id]?.trim() || undefined }),
       });
       if (res.status === 202) {
         const body: unknown = await res.json().catch(() => null);
+        const notice=jobPayloadNotice(body);
+        if(notice) {
+          setCoverGen(g=>({...g,[job.id]:hadCover ? "done" : "idle"}));
+          showActionError(notice);
+          return;
+        }
         const generation = parseGenerationJob((body as { generation?: unknown } | null)?.generation);
         if (generation && tracker) tracker.notifyStarted(generation);
         else tracker?.refresh();
         return;
       }
       const body = await res.json().catch(() => ({}));
       // Tier gate: same treatment as handleGenerate — upsell pill, prior pane state.
       const gate = tierGateNotice(res.status, body);
       if (gate) {
         showUpsell(gate);
         setCoverGen((g) => ({ ...g, [job.id]: hadCover ? "done" : "idle" }));
         return;
       }
       throw new Error((body as { error?: string }).error ?? "failed");
     } catch (e) {
       setCoverGen((g) => ({ ...g, [job.id]: "error" }));
       setCoverError((m) => ({ ...m, [job.id]: (e as Error).message }));
     } finally {
       endRequest(job.id);
     }
-  }, [beginRequest, endRequest, coverData, coverInstructions, showUpsell, tracker]);
+  }, [beginRequest, endRequest, coverData, coverInstructions, showActionError, showUpsell, tracker]);
 
   // "Prefill application" — build + PERSIST the package server-side. Async accept
   // contract like handleGenerate: the route reserves BOTH kinds synchronously, 202s
   // with ONE kind='prepare' row, and the legs run in the background. The settled
   // feed lands the package (deriving per-leg pane states from its contents).
   const handlePrepare = useCallback(async (job: JobRow) => {
     if (!beginRequest(job.id)) return;
     // Snapshot whether we already have successful content to fall back to, so a failed
     // re-prepare doesn't blank out the still-valid résumé/cover the user can see.
     const hadResume = Boolean(genData[job.id]);
@@ -1107,20 +1120,27 @@ export function RolefitBoard({
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           jobId: job.id,
           resumeInstructions: resumeInstructions[job.id]?.trim() || undefined,
           coverLetterInstructions: coverInstructions[job.id]?.trim() || undefined,
         }),
       });
       if (res.status === 202) {
         const body: unknown = await res.json().catch(() => null);
+        const notice=jobPayloadNotice(body);
+        if(notice) {
+          setGen(g=>({...g,[job.id]:hadResume ? "done" : "idle"}));
+          setCoverGen(g=>({...g,[job.id]:hadCover ? "done" : "idle"}));
+          showActionError(notice);
+          return;
+        }
         const generation = parseGenerationJob((body as { generation?: unknown } | null)?.generation);
         if (generation && tracker) tracker.notifyStarted(generation);
         else tracker?.refresh();
         return;
       }
       const body = await res.json().catch(() => ({}));
       // Tier gate (reserves BOTH kinds, so either allowance can trip it): revert both
       // panes to their prior state and let the upsell pill carry the /billing CTA.
       const gate = tierGateNotice(res.status, body);
       if (gate) {
diff --git a/dashboard/lib/applicationActions.test.ts b/dashboard/lib/applicationActions.test.ts
index 24a6573..ab3e992 100644
--- a/dashboard/lib/applicationActions.test.ts
+++ b/dashboard/lib/applicationActions.test.ts
@@ -1,10 +1,15 @@
+vi.mock("@/lib/jobLifecycle", async importOriginal => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  readPrivateSnapshot: vi.fn(async () => null),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { beforeEach, describe, expect, test, vi } from "vitest";
 
 // These actions changed shape during the board-perf + apply-assist work:
 //  - /api/resume and /api/cover-letter now persist regenerated content server-side,
 //    so the client-side persistRegeneratedResume/Cover actions were removed.
 //  - revalidatePath was dropped from the fine-grained optimistic actions (the client
 //    updates optimistically and the board is force-dynamic), so mark/unmark no longer
 //    trigger a full-page server re-render.
 // This test guards the surviving behavior and the removal.
 
@@ -21,20 +26,21 @@ vi.mock("next/cache", () => ({
 vi.mock("@/lib/auth", () => ({
   requireUserId: mocks.requireUserId,
 }));
 
 vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
 
 vi.mock("@/lib/db", () => ({
   // withUserSql drops into a transaction; the mock invokes the callback with the
   // recording `sql` fn so the actions' tx queries are captured.
   withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(mocks.sql),
+  withUserPayloadMutation: (_u:string,_j:string,_s:string,fn:(t:unknown)=>unknown)=>fn(mocks.sql),
 }));
 
 vi.mock("@/lib/queries", () => ({
   bareMarkerPredicate: () => "",
 }));
 
 describe("application package server actions", () => {
   beforeEach(() => {
     vi.clearAllMocks();
   });
diff --git a/dashboard/lib/corrections.action.test.ts b/dashboard/lib/corrections.action.test.ts
index 8257c3f..513b6aa 100644
--- a/dashboard/lib/corrections.action.test.ts
+++ b/dashboard/lib/corrections.action.test.ts
@@ -1,10 +1,15 @@
+vi.mock("@/lib/jobLifecycle", async importOriginal => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  readPrivateSnapshot: vi.fn(async () => null),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { describe, it, expect, vi, beforeEach } from "vitest";
 
 const admin = vi.hoisted(() => ({ isAdmin: true }));
 const upsertDatasetItem = vi.hoisted(() => vi.fn(async () => {}));
 
 const calls: { strings: readonly string[]; values: unknown[] }[] = [];
 const rows = [{ title: "Eng", company_name: "Acme", location: null, ats: "greenhouse",
                description: "jd text", resume_text: "my resume", instructions: null,
                model_snapshot: {} }];
 
@@ -12,21 +17,22 @@ vi.mock("@/lib/db", () => {
   // The recording tx: the first call (SELECT inputs) resolves to `rows`; the INSERT's
   // result is ignored by the action, so returning `rows` again is harmless. `.json`
   // is used to bind jsonb columns.
   const tx = Object.assign(
     (strings: readonly string[], ...values: unknown[]) => {
       calls.push({ strings, values });
       return Promise.resolve(rows);
     },
     { json: (v: unknown) => v },
   );
-  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
+  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
+    withUserPayloadMutation: (_u: string, _j: string, _s: string, fn: (t:unknown)=>unknown)=>fn(tx) };
 });
 vi.mock("@/lib/auth", () => ({
   requireUserId: async () => "user-uuid",
   getUserClaims: async () => ({ id: "user-uuid", email: "a@x.com" }),
 }));
 vi.mock("@/lib/admin", () => ({ isAdmin: () => admin.isAdmin }));
 vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
 vi.mock("@/lib/langfuseDataset", () => ({ upsertDatasetItem }));
 
 import { saveReviewCorrection } from "@/app/actions/corrections";
diff --git a/dashboard/lib/coverLetterEdits.action.test.ts b/dashboard/lib/coverLetterEdits.action.test.ts
index 1df3bb9..257e804 100644
--- a/dashboard/lib/coverLetterEdits.action.test.ts
+++ b/dashboard/lib/coverLetterEdits.action.test.ts
@@ -1,16 +1,22 @@
+vi.mock("@/lib/jobLifecycle", async importOriginal => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  readPrivateSnapshot: vi.fn(async () => null),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { describe, it, expect, vi, beforeEach } from "vitest";
 
 const sqlMock = vi.fn();
 vi.mock("@/lib/db", () => {
   const tx = Object.assign((...a: unknown[]) => sqlMock(...a), { json: (v: unknown) => v });
-  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
+  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
+    withUserPayloadMutation: (_u: string, _j: string, _s: string, fn: (t:unknown)=>unknown)=>fn(tx) };
 });
 vi.mock("@/lib/auth", () => ({
   requireUserId: vi.fn(async () => "u1"),
 }));
 vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
 vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
 const upsertMock = vi.fn(async () => undefined);
 vi.mock("@/lib/coverLetterGoldenDataset", () => ({
   upsertCoverLetterGoldenItem: (...a: unknown[]) => (upsertMock as unknown as (...args: unknown[]) => unknown)(...a),
 }));
diff --git a/dashboard/lib/db.ts b/dashboard/lib/db.ts
index bc14cfb..dc1b8ef 100644
--- a/dashboard/lib/db.ts
+++ b/dashboard/lib/db.ts
@@ -99,10 +99,76 @@ export async function withAnonSql<T>(
   })) as T;
 }
 
 /** Explicit mutating wrapper; read-only transactions retain their existing path. */
 export async function withUserMutation<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
   return withUserSql(userId, async (tx) => {
     await acquireLifecycleGate(tx);
     return fn(tx);
   });
 }
+
+export type PayloadScope = "job_reviews" | "review_corrections" | "application_packages" |
+  "generation_jobs" | "resume_scores" | "cover_letter_edits";
+
+/** Service capability setup only; all application DML runs as authenticated.
+ * One exact job/scope/backend/transaction reservation, checked by existing guards.
+ * The callback must do database work only. Caller supplies a verified auth user ID.
+ */
+export async function withUserPayloadMutation<T>(
+  userId: string, jobId: string, scope: PayloadScope,
+  fn: (tx: TransactionSql) => Promise<T>,
+): Promise<T> {
+  if (!userId || !jobId) throw new Error("Owner and job required");
+  return (await serviceSql.begin(async (tx) => {
+    await acquireLifecycleGate(tx);
+    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'lifecycle:job:' + jobId}, 0))`;
+    const controls = await tx`SELECT safety_stage FROM lifecycle_control WHERE singleton`;
+    let reservation: string | null = null;
+    if (controls[0]?.safety_stage === "enforced") {
+      // Worst case includes a 10 MiB input snapshot and generated output; the
+      // trigger measures actual writes and refuses any underestimate.
+      const bytes = 96 * 1024 * 1024;
+      const claim = await tx`INSERT INTO lifecycle_claims(kind,work_id,owner_token,lease_until,invoking_role)
+        VALUES ('dashboard',gen_random_uuid()::text,gen_random_uuid()::text,
+          clock_timestamp()+interval '180 seconds',current_user)
+        RETURNING work_id,owner_token,generation`;
+      const row = claim[0];
+      if (!row) throw new Error("Payload claim unavailable");
+      const reservations = await tx`INSERT INTO capacity_reservations
+        (claim_kind,claim_id,owner_token,generation,bytes,backend_pid,transaction_id,job_id,scope,subject_id,invoking_role)
+        VALUES ('dashboard',${row.work_id},${row.owner_token},${row.generation},${bytes},
+          pg_backend_pid(),pg_current_xact_id(),${jobId},${scope},${userId}::uuid,'authenticated') RETURNING id`;
+      reservation = typeof reservations[0]?.id === "string" ? reservations[0].id : null;
+      if (!reservation) throw new Error("Payload reservation unavailable");
+      await tx`SELECT set_config('lifecycle.reservation',${reservation},true)`;
+    }
+    await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),
+      set_config('role','authenticated',true)`;
+    const result = await fn(tx);
+    if (reservation) {
+      // Restore only to settle service-owned capability metadata, never user DML.
+      await tx`SELECT set_config('role','none',true),set_config('request.jwt.claims','',true)`;
+      await tx`UPDATE capacity_reservations SET state='settled',terminal_at=clock_timestamp(),
+        measured_database_bytes=pg_database_size(current_database()) WHERE id=${reservation}::uuid`;
+    }
+    return result;
+  })) as T;
+}
+
+/** Read the existing sticky compatibility control, then enqueue/read as owner.
+ * Mirrors lifecycle.config.legacy_description_capture_allowed; no shared DML.
+ */
+export async function withUserDemandSql<T>(
+  userId:string, fn:(tx:TransactionSql,legacyAllowed:boolean)=>Promise<T>,
+):Promise<T> {
+  if(!userId) throw new Error("Owner required");
+  return (await serviceSql.begin(async tx=>{
+    await acquireLifecycleGate(tx);
+    const rows=await tx`SELECT NOT (c.source_enabled OR c.hydration_enabled OR c.maintenance_enabled
+      OR c.safety_stage='enforced' OR c.archive_ever_activated OR m.cutover_at IS NOT NULL) AS legacy_allowed
+      FROM lifecycle_control c CROSS JOIN lifecycle_maintenance_state m WHERE c.singleton AND m.singleton`;
+    const legacyAllowed=rows[0]?.legacy_allowed===true;
+    await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({sub:userId,role:"authenticated"})},true),set_config('role','authenticated',true)`;
+    return fn(tx,legacyAllowed);
+  })) as T;
+}
diff --git a/dashboard/lib/generationJobs.ts b/dashboard/lib/generationJobs.ts
index c55af69..bd4f2d9 100644
--- a/dashboard/lib/generationJobs.ts
+++ b/dashboard/lib/generationJobs.ts
@@ -1,12 +1,13 @@
+import type { DemandResult } from "@/lib/jobLifecycle";
 import { acquireLifecycleGate } from "@/lib/jobLifecycle";
-import { withUserSql } from "@/lib/db";
+import { withUserSql, withUserPayloadMutation } from "@/lib/db";
 import {
   parseGenerationJob,
   type GenerationJobKind,
   type GenerationJobView,
 } from "@/lib/generationJobCodec";
 
 // Data layer for generation_jobs (async background generation tracking — see
 // migrations/2026-07-05-generation-jobs.sql). Lifecycle:
 //   1. a generate route RESERVES allowance, then createGenerationJob() → 'pending'
 //      and returns 202;
@@ -40,36 +41,39 @@ export type CreatedGenerationJob = {
 
 /**
  * Insert the 'pending' tracking row for an accepted generation. The partial
  * unique index (one pending per user/job/kind) makes concurrent double-submits
  * converge: the loser gets `created: false` plus the winner's row.
  */
 export async function createGenerationJob(
   userId: string,
   jobId: string,
   kind: GenerationJobKind,
+  payload?: DemandResult,
 ): Promise<CreatedGenerationJob> {
-  return withUserSql(userId, async (tx) => {
+  return withUserPayloadMutation(userId, jobId, "generation_jobs", async (tx) => {
     await acquireLifecycleGate(tx);
     // Housekeeping: settled rows are only useful within RECENT_WINDOW; prune the
     // viewer's stale ones here (write path) so the table never needs a cron.
     await tx`
       DELETE FROM generation_jobs
       WHERE user_id = ${userId}::uuid AND status <> 'pending'
         AND updated_at < now() - interval '1 day'
     `;
     const inserted = await tx.unsafe(
-      `INSERT INTO generation_jobs (user_id, job_id, kind)
-       VALUES ($1::uuid, $2, $3)
+      `INSERT INTO generation_jobs (user_id, job_id, kind, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at)
+       VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::text::jsonb, CASE WHEN $4::uuid IS NOT NULL THEN clock_timestamp() END)
        ON CONFLICT (user_id, job_id, kind) WHERE status = 'pending' DO NOTHING
        RETURNING ${SELECT_COLS}`,
-      [userId, jobId, kind],
+      [userId, jobId, kind, payload?.status === "ready" ? payload.versionId : null,
+        payload?.status === "ready" ? payload.description : null,
+        payload?.status === "ready" && payload.questions ? JSON.stringify(payload.questions) : null],
     );
     if (inserted.length > 0) {
       const job = parseGenerationJob(inserted[0]);
       if (!job) throw new Error("generation job row failed to parse after insert");
       return { created: true, job };
     }
     // Conflict: an identical pending row exists — hand it back so the route can
     // 202 idempotently. (If it settled in the microseconds since the conflict,
     // fail loud; the route refunds and reports.)
     const existing = await tx.unsafe(
@@ -87,48 +91,48 @@ export async function createGenerationJob(
  * Settle a pending row to its terminal status. `error` must already be the
  * USER-SAFE message (the routes map raw failures before calling). The
  * status='pending' guard makes settling idempotent — a row the staleness sweep
  * already failed is never flipped back.
  */
 export async function settleGenerationJob(
   userId: string,
   id: string,
   outcome: { status: "ready" | "failed"; error?: string | null },
 ): Promise<void> {
-  await withUserSql(userId, (tx) => tx`
+  const rows = await withUserSql(userId, tx => tx`SELECT job_id FROM generation_jobs WHERE id=${id}::uuid AND user_id=${userId}::uuid`);
+  const jobId = rows[0]?.job_id;
+  if (typeof jobId !== "string") return;
+  await withUserPayloadMutation(userId, jobId, "generation_jobs", (tx) => tx`
     UPDATE generation_jobs
     SET status = ${outcome.status}, error = ${outcome.error ?? null}, updated_at = now()
     WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'pending'
   `);
 }
 
 /**
  * The poll payload: every pending row plus rows settled within RECENT_WINDOW,
  * joined with jobs/companies for toast copy. Also sweeps pending rows that
  * outlived any possible invocation (maxDuration is 300s; 10 minutes means the
  * instance died) to 'failed', so a vaporized background run can't leave the
  * client polling forever. The sweep deliberately does NOT refund allowance:
  * refunds are the background catch's job, and rows are user-writable under RLS,
  * so a sweep-triggered refund would let a hand-inserted backdated row mint free
  * allowance. An instance death therefore burns the slot — exactly as it did in
  * the old blocking model, where a killed invocation never reached its refund.
  */
 export async function listGenerationActivity(userId: string): Promise<GenerationJobView[]> {
+  const expired = await withUserSql(userId, tx => tx`SELECT id FROM generation_jobs
+    WHERE user_id=${userId}::uuid AND status='pending' AND created_at<now()-interval '10 minutes' LIMIT 50`);
+  for (const row of expired) if (typeof row.id === "string") {
+    await settleGenerationJob(userId,row.id,{status:"failed",error:"Generation timed out — please try again."});
+  }
   return withUserSql(userId, async (tx) => {
-    await tx.unsafe(
-      `UPDATE generation_jobs
-       SET status = 'failed', error = 'Generation timed out — please try again.',
-           updated_at = now()
-       WHERE user_id = $1::uuid AND status = 'pending'
-         AND created_at < now() - interval '${RECENT_WINDOW}'`,
-      [userId],
-    );
     const rows = await tx.unsafe(
       `SELECT g.id, g.job_id, g.kind, g.status, g.error, g.created_at, g.updated_at,
               j.title AS job_title, COALESCE(c.display_name, c.name) AS company
        FROM generation_jobs g
        LEFT JOIN jobs j ON j.id = g.job_id
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE g.user_id = $1::uuid
          AND (g.status = 'pending' OR g.updated_at > now() - interval '${RECENT_WINDOW}')
        ORDER BY g.created_at`,
       [userId],
diff --git a/dashboard/lib/jobLifecycle.flow.db.test.ts b/dashboard/lib/jobLifecycle.flow.db.test.ts
new file mode 100644
index 0000000..9ba5aa0
--- /dev/null
+++ b/dashboard/lib/jobLifecycle.flow.db.test.ts
@@ -0,0 +1,94 @@
+/** Ordinary owned-DB feature flow only; not an independent mechanism review. */
+import {readFileSync} from "node:fs";
+import {resolve} from "node:path";
+import postgres from "postgres";
+import {beforeAll,afterAll,expect,test} from "vitest";
+import {requestJobPayload,consumeJobVersion} from "./jobLifecycle";
+
+const dsn=process.env.TEST_DATABASE_URL;
+if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
+const address=new URL(dsn);
+if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
+process.env.DATABASE_URL=dsn;
+const sql=postgres(dsn,{max:2,prepare:false,onnotice:()=>{}});
+const user="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
+let db:typeof import("./db");
+let generation:typeof import("./generationJobs");
+let version:string;
+beforeAll(async()=>{
+  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
+  await sql.unsafe(readFileSync(resolve(process.cwd(),"../schema.sql"),"utf8"));
+  await sql`INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')`;
+  await sql`INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('job',1,'1','Role','https://example.test/job')`;
+  const source=await sql`INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id`;
+  const listing=await sql`INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at)
+    VALUES(${source[0].id},'1','job',now(),now(),'local_observation',now()+interval '30 days') RETURNING id`;
+  const versions=await sql`INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
+    VALUES('job',${listing[0].id},1,${'a'.repeat(64)},'{}',now()) RETURNING id`;
+  version=versions[0].id;
+  await sql`UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1`;
+  db=await import("./db");
+  generation=await import("./generationJobs");
+});
+afterAll(async()=>{await db?.serviceSql.end();await sql.end();});
+
+test("owner demand coalesces, ready pins a durable input, generation copies it and consumption follows success",async()=>{
+  const first=await requestJobPayload(user,"job","generation");
+  expect(first.status).toBe("pending");
+  expect((await requestJobPayload(user,"job","generation")).id).toBe(first.id);
+  // Worker completion fixture: service is the shared hydration writer.
+  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Exact input',
+    questions_snapshot='{"questions":[]}',snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${first.id}`;
+  const payload=await requestJobPayload(user,"job","generation");
+  expect(payload.status).toBe("ready");
+  const tracked=await generation.createGenerationJob(user,"job","resume",payload);
+  expect(tracked.created).toBe(true);
+  const rows=await sql`SELECT job_version_id,description_snapshot FROM generation_jobs WHERE id=${tracked.job.id}`;
+  expect(rows[0]).toMatchObject({job_version_id:version,description_snapshot:"Exact input"});
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${first.id}`)[0].consumed_at).toBeNull();
+  await db.withUserSql(user,tx=>consumeJobVersion(tx,"job",version,"generation"));
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${first.id}`)[0].consumed_at).toBeInstanceOf(Date);
+  await sql`UPDATE jobs SET description='New shared content' WHERE id='job'`;
+  expect((await sql`SELECT description_snapshot FROM generation_jobs WHERE id=${tracked.job.id}`)[0].description_snapshot).toBe("Exact input");
+});
+
+test("flag-off missing Greenhouse questions queues service work and accepts its exact ready snapshot",async()=>{
+  await sql`UPDATE lifecycle_control SET hydration_enabled=false,activation_generation=activation_generation+1`;
+  await sql`UPDATE companies SET ats='greenhouse' WHERE id=1`;
+  const pending=await requestJobPayload(user,"job","prepare");
+  expect(pending.status).toBe("pending");
+  await sql`UPDATE job_payload_demands SET status='ready',job_version_id=${version},description_snapshot='Legacy compatible input',
+    questions_snapshot='{"questions":[]}',snapshot_captured_at=clock_timestamp(),settled_at=clock_timestamp() WHERE id=${pending.id}`;
+  const ready=await requestJobPayload(user,"job","prepare");
+  expect(ready.status).toBe("ready");
+  if(ready.status!=="ready") throw new Error("ready expected");
+  expect(ready.versionId).toBe(version);
+  expect(ready.questions).toEqual({questions:[]});
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${pending.id}`)[0].consumed_at).toBeNull();
+});
+
+test("package persistence copies pinned input and records consumption with the artifact",async()=>{
+  const payload=await requestJobPayload(user,"job","generation");
+  expect(payload.status).toBe("ready");
+  const {upsertApplicationPackage}=await import("./queries");
+  await upsertApplicationPackage(user,"job",{resume:null,coverLetter:null,prefilledAnswers:[],applyUrl:null,payload});
+  const rows=await sql`SELECT job_version_id,description_snapshot,prefilled_answers FROM application_packages WHERE user_id=${user} AND job_id='job'`;
+  expect(rows[0]).toMatchObject({job_version_id:version,description_snapshot:"Exact input",prefilled_answers:[]});
+  expect((await sql`SELECT consumed_at FROM job_payload_demands WHERE id=${payload.id}`)[0].consumed_at).toBeInstanceOf(Date);
+});
+
+test("new payload wrapper preserves authenticated invoking role in an ordinary enforced write",async()=>{
+  // Local fixture selects the installed writer contract; no control transition is claimed.
+  await sql.begin(async tx=>{
+    await tx`ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history`;
+    await tx`UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=activation_generation+1`;
+    await tx`ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history`;
+  });
+  await db.withUserPayloadMutation(user,"job","job_reviews",async tx=>{
+    const role=await tx`SELECT current_user actor`;
+    expect(role[0].actor).toBe("authenticated");
+    await tx`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot)
+      VALUES(${user},'job','v','approve',${version},'Exact input')`;
+  });
+  expect((await sql`SELECT description_snapshot FROM job_reviews WHERE user_id=${user}`)[0].description_snapshot).toBe("Exact input");
+});
diff --git a/dashboard/lib/jobLifecycle.test.ts b/dashboard/lib/jobLifecycle.test.ts
new file mode 100644
index 0000000..3446d96
--- /dev/null
+++ b/dashboard/lib/jobLifecycle.test.ts
@@ -0,0 +1,14 @@
+import {expect,test} from "vitest";
+import {parseDemandResult,parseRequestBody} from "./jobLifecycle";
+
+test("ready requires the exact durable version and usable snapshot",()=>{
+  const row={id:"d",job_id:"j",kind:"prepare",status:"ready"};
+  for(const value of [null,[],1,"{}",row,{...row,job_version_id:"v"},{...row,job_version_id:"v",description_snapshot:3}]) expect(parseDemandResult(value)).toBeNull();
+  expect(parseDemandResult({...row,job_version_id:"v",description_snapshot:"JD",questions_snapshot:"bad"})).toEqual({status:"ready",id:"d",versionId:"v",description:"JD",questions:null});
+});
+test("pending and deferred are honest; malformed request bodies are total",()=>{
+  expect(parseDemandResult({id:"d",job_id:"j",kind:"prepare",status:"running"})).toEqual({status:"pending",id:"d"});
+  expect(parseDemandResult({id:"d",job_id:"j",kind:"prepare",status:"failed"})).toEqual({status:"deferred",id:"d"});
+  for(const value of [null,[],1,"{}",true]) expect(parseRequestBody(value)).toEqual({});
+  expect(parseRequestBody({jobId:3})).toEqual({jobId:3});
+});
diff --git a/dashboard/lib/jobLifecycle.ts b/dashboard/lib/jobLifecycle.ts
index dba4f45..ed8381f 100644
--- a/dashboard/lib/jobLifecycle.ts
+++ b/dashboard/lib/jobLifecycle.ts
@@ -35,10 +35,118 @@ export interface PayloadDemand {
 export function parsePayloadDemand(value: unknown): PayloadDemand | null {
   if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
   if (!("id" in value) || typeof value.id !== "string" ||
       !("job_id" in value) || typeof value.job_id !== "string" ||
       !("kind" in value) || typeof value.kind !== "string" ||
       !["description", "questions", "review", "prepare", "generation"].includes(value.kind) ||
       !("status" in value) || typeof value.status !== "string" ||
       !["pending", "running", "ready", "deferred", "failed", "cancelled"].includes(value.status)) return null;
   return { id: value.id, jobId: value.job_id, kind: value.kind, status: value.status };
 }
+
+export type DemandKind = "description" | "questions" | "review" | "prepare" | "generation";
+export type DemandResult = { status: "legacy" | "pending" | "deferred"; id: string | null } |
+  { status: "ready"; id: string; versionId: string; description: string; kind?: DemandKind; questions: ReturnType<typeof parseGreenhouseQuestions> };
+import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
+
+export function parseDemandResult(value: unknown): DemandResult | null {
+  const basic = parsePayloadDemand(value);
+  if (!basic || typeof value !== "object" || value === null) return null;
+  if (basic.status !== "ready") return {status: basic.status === "deferred" || basic.status === "failed" || basic.status === "cancelled" ? "deferred" : "pending", id:basic.id};
+  if (!("job_version_id" in value) || typeof value.job_version_id !== "string" ||
+      !("description_snapshot" in value) || typeof value.description_snapshot !== "string" || !value.description_snapshot.trim()) return null;
+  return {status:"ready",id:basic.id,versionId:value.job_version_id,description:value.description_snapshot,
+    questions:parseGreenhouseQuestions("questions_snapshot" in value ? value.questions_snapshot : null)};
+}
+
+export function parseRequestBody(value: unknown): Record<string, unknown> {
+  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
+  return Object.fromEntries(Object.entries(value));
+}
+
+export async function requestJobPayload(userId: string, jobId: string, kind: DemandKind): Promise<DemandResult> {
+  const {withUserDemandSql} = await import("@/lib/db");
+  return withUserDemandSql(userId, async (tx,legacyAllowed) => {
+    // Regenerating one leg of an existing package must use its immutable input,
+    // otherwise a single package could silently mix two description versions.
+    if (kind === "prepare" || kind === "generation") {
+      const existing = await tx`SELECT d.* FROM application_packages p JOIN job_payload_demands d
+        ON d.user_id=p.user_id AND d.job_id=p.job_id AND d.job_version_id=p.job_version_id
+        WHERE p.user_id=${userId}::uuid AND p.job_id=${jobId} AND d.status='ready'
+        ORDER BY d.settled_at DESC LIMIT 1`;
+      const pinned = parseDemandResult(existing[0]);
+      if (pinned?.status === "ready") {
+        const storedKind = parsePayloadDemand(existing[0])?.kind;
+        return {...pinned,kind: storedKind === "prepare" ? "prepare" : storedKind === "generation" ? "generation" : kind};
+      }
+    }
+    const rows = await tx`SELECT * FROM job_payload_demands WHERE user_id=${userId}::uuid AND job_id=${jobId}
+      AND kind=${kind} AND status='ready' AND job_version_id IS NOT NULL
+      AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-
+        CASE WHEN ${kind} IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
+      ORDER BY settled_at DESC LIMIT 1`;
+    const ready = parseDemandResult(rows[0]);
+    if (ready?.status === "ready") return {...ready,kind};
+    if (legacyAllowed) {
+      const cached=await tx`SELECT j.description,c.ats,q.questions FROM jobs j JOIN companies c ON c.id=j.company_id
+        LEFT JOIN job_questions q ON q.job_id=j.id WHERE j.id=${jobId}`;
+      const row=cached[0];
+      if (typeof row?.description === "string" && row.description.trim() &&
+        (!(kind === "questions" || kind === "prepare") || row.ats !== "greenhouse" || parseGreenhouseQuestions(row.questions))) {
+        return {status:"legacy",id:null};
+      }
+    }
+    await tx`INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES(${userId}::uuid,${jobId},${kind})
+      ON CONFLICT(user_id,job_id,kind) WHERE status IN ('pending','running') DO NOTHING`;
+    const pending = await tx`SELECT * FROM job_payload_demands WHERE user_id=${userId}::uuid AND job_id=${jobId}
+      AND kind=${kind} AND status IN ('pending','running') LIMIT 1`;
+    const result = parseDemandResult(pending[0]);
+    if (!result) throw new Error("Demand could not be persisted");
+    return result;
+  });
+}
+
+/** Call after successful private writes in their same owner transaction. */
+export async function consumeJobVersion(tx: TransactionSql, jobId: string, versionId: string, kind: DemandKind): Promise<void> {
+  const rows = await tx`UPDATE job_payload_demands SET consumed_at=clock_timestamp()
+    WHERE user_id=app_user_id() AND job_id=${jobId} AND job_version_id=${versionId}::uuid
+      AND kind=${kind} AND status='ready' AND NULLIF(btrim(description_snapshot),'') IS NOT NULL RETURNING id`;
+  if (!rows.length) throw new Error("Exact durable demand version required");
+}
+
+export async function readJobSnapshot(tx: TransactionSql, jobId: string) {
+  const rows = await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at
+    FROM job_payload_demands WHERE user_id=app_user_id() AND job_id=${jobId} AND status='ready'
+    ORDER BY settled_at DESC LIMIT 1`;
+  const row = rows[0];
+  return row && typeof row.job_version_id === "string" && typeof row.description_snapshot === "string"
+    ? {versionId:row.job_version_id,description:row.description_snapshot,
+       questions:parseGreenhouseQuestions(row.questions_snapshot),capturedAt:row.snapshot_captured_at}
+    : null;
+}
+
+export async function readPrivateSnapshot(tx: TransactionSql, jobId: string, source: "application_packages" | "job_reviews") {
+  const rows = source === "application_packages"
+    ? await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at FROM application_packages WHERE user_id=app_user_id() AND job_id=${jobId}`
+    : await tx`SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at FROM job_reviews WHERE user_id=app_user_id() AND job_id=${jobId}`;
+  const row = rows[0];
+  if (row && typeof row.job_version_id === "string" && typeof row.description_snapshot === "string") {
+    return {versionId:row.job_version_id,description:row.description_snapshot,questions:parseGreenhouseQuestions(row.questions_snapshot),capturedAt:row.snapshot_captured_at};
+  }
+  return readJobSnapshot(tx, jobId);
+}
+
+/** Total parser shared by generation context reads, including malformed jsonb. */
+export function parseGenerationContext(value: unknown) {
+  const row = parseRequestBody(value);
+  if (typeof row.title !== "string" || typeof row.company_name !== "string") return null;
+  const text = (v:unknown) => typeof v === "string" ? v : null;
+  const strings = (v:unknown) => Array.isArray(v) ? v.filter((x):x is string => typeof x === "string") : [];
+  const requirements: {text:string;met:boolean}[] = [];
+  if (Array.isArray(row.requirements)) for (const raw of row.requirements) {
+    const item = parseRequestBody(raw);
+    if (typeof item.text === "string" && typeof item.met === "boolean") requirements.push({text:item.text,met:item.met});
+  }
+  return {title:row.title,company_name:row.company_name,description:text(row.description),about:text(row.about),
+    url:text(row.url) ?? "", external_id:text(row.external_id) ?? "", ats:text(row.ats) ?? "", company_token:text(row.company_token) ?? "",
+    requirements,skill_gaps:strings(row.skill_gaps),red_flags:strings(row.red_flags)};
+}
diff --git a/dashboard/lib/jobPayloadNotice.ts b/dashboard/lib/jobPayloadNotice.ts
new file mode 100644
index 0000000..e47b7b9
--- /dev/null
+++ b/dashboard/lib/jobPayloadNotice.ts
@@ -0,0 +1,9 @@
+/** A hydration acknowledgement is distinct from a started generation. */
+export function jobPayloadNotice(value:unknown):string|null {
+  if(typeof value!=="object" || value===null || !("payload" in value)) return null;
+  const payload=value.payload;
+  if(typeof payload!=="object" || payload===null || !("status" in payload) ||
+    (payload.status!=="pending" && payload.status!=="deferred")) return null;
+  return "message" in value && typeof value.message==="string" && value.message.length<=300
+    ? value.message : "Job details are being prepared. Try again shortly.";
+}
diff --git a/dashboard/lib/jobsReject.action.test.ts b/dashboard/lib/jobsReject.action.test.ts
index 51495fc..34fc812 100644
--- a/dashboard/lib/jobsReject.action.test.ts
+++ b/dashboard/lib/jobsReject.action.test.ts
@@ -1,29 +1,34 @@
+vi.mock("@/lib/jobLifecycle", async importOriginal => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  readPrivateSnapshot: vi.fn(async () => null),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { beforeEach, describe, expect, test, vi } from "vitest";
 
 // Introspect the tagged-template SQL: capture the literal fragments (joined) and the
 // bound values. requireUserId is a boundary; the userId it returns is what scopes every
 // write, so we assert it is bound (never caller-supplied input). The SaaS cutover moved
 // writes from a raw `sql` export to withUserSql(userId, tx => tx`...`) (RLS-scoped) and
 // added assertNotDeleted(userId) at the top of both actions (stale-JWT resurrection
 // guard) — so the mock now captures the tx handed to the withUserSql callback.
 const calls: { text: string; values: unknown[] }[] = [];
 const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), assertNotDeleted: vi.fn(), withUserSql: vi.fn() }));
 
 const tx = (strings: readonly string[], ...values: unknown[]) => {
   calls.push({ text: strings.join("?"), values });
   return Promise.resolve([]);
 };
 
 vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId }));
 vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));
-vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));
+vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql, withUserPayloadMutation: (u:string,_j:string,_s:string,fn:unknown)=>mocks.withUserSql(u,fn) }));
 
 import { rejectJob, unrejectJob } from "@/app/actions/jobs";
 
 const USER = "9ae8b777-7c24-4290-8aad-bd2b10eff23b";
 
 beforeEach(() => {
   calls.length = 0;
   vi.clearAllMocks();
   mocks.requireUserId.mockResolvedValue(USER);
   mocks.assertNotDeleted.mockResolvedValue(undefined);
@@ -69,26 +74,26 @@ describe("rejectJob", () => {
 
 describe("unrejectJob", () => {
   test("is a non-destructive UPDATE guarded by human_override = TRUE", async () => {
     await unrejectJob("greenhouse:acme:1", "approve");
     const { text, values } = calls[0];
     expect(text).toContain("UPDATE job_reviews");
     // The safety contract: it must NEVER delete (that would drop stage1_decision)...
     expect(text.toLowerCase()).not.toContain("delete");
     // ...and must only touch rows THIS feature rejected.
     expect(text).toContain("human_override = TRUE");
-    expect(values).toEqual(["approve", USER, "greenhouse:acme:1"]);
+    expect(values).toEqual(["approve", null, null, null, null, USER, "greenhouse:acme:1"]);
   });
 
   test("restore-to-unreviewed binds a null prior verdict", async () => {
     await unrejectJob("greenhouse:acme:1", null);
-    expect(calls[0].values).toEqual([null, USER, "greenhouse:acme:1"]);
+    expect(calls[0].values).toEqual([null, null, null, null, null, USER, "greenhouse:acme:1"]);
   });
 
   test("enforces auth before touching sql", async () => {
     mocks.requireUserId.mockRejectedValue(new Error("no session"));
     await expect(unrejectJob("j", null)).rejects.toThrow("no session");
     expect(calls).toHaveLength(0);
   });
 
   test("a tombstoned account cannot resurrect an unreject (no SQL)", async () => {
     mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
diff --git a/dashboard/lib/queries.ts b/dashboard/lib/queries.ts
index 4096cf3..41021e2 100644
--- a/dashboard/lib/queries.ts
+++ b/dashboard/lib/queries.ts
@@ -1,11 +1,12 @@
-import { withUserSql, withAnonSql } from "@/lib/db";
+import { consumeJobVersion, parseGenerationContext, requestJobPayload, readPrivateSnapshot, type DemandResult } from "@/lib/jobLifecycle";
+import { withUserPayloadMutation, withUserSql, withAnonSql } from "@/lib/db";
 import type { Sql, TransactionSql } from "postgres";
 import { unstable_cache } from "next/cache";
 import { buildJobsQuery } from "@/lib/jobsQuery";
 import type { Filters } from "@/lib/filters";
 import type { ApplicationPackage, CompanyRow, CompanyBrowseRow, DiscoveryStateRow, ReviewedJobRow, JobReviewDetail, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
 import { toCompanyBrowseRow } from "@/lib/companies/browseCodec";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
@@ -193,21 +194,21 @@ export async function getJobReviewDetail(
   // every review field is null and only the job-only fields are populated). Fetched
   // lazily on job-open so the board list stays lean.
   const run = async (tx: TransactionSql): Promise<JobReviewDetail | null> => {
     const rows = await tx`
       SELECT
         COALESCE(rc.reasoning, r.reasoning) AS reasoning,
         COALESCE(rc.about, r.about) AS about,
         COALESCE(rc.red_flags, r.red_flags) AS red_flags,
         COALESCE(rc.benefits, r.benefits) AS benefits,
         COALESCE(rc.requirements, r.requirements) AS requirements,
-        j.description, j.url,
+        COALESCE(rc.description_snapshot,r.description_snapshot,j.description) AS description, j.url,
         COALESCE(rc.experience_match, r.experience_match) AS experience_match,
         COALESCE(rc.industry, r.industry) AS industry,
         COALESCE(rc.industry_subcategory, r.industry_subcategory) AS industry_subcategory,
         COALESCE(rc.confidence, r.confidence) AS confidence,
         rc.note,
         (rc.job_id IS NOT NULL) AS corrected
       FROM jobs j
       LEFT JOIN job_reviews r
         ON r.job_id = j.id AND r.user_id = ${userId}::uuid
       LEFT JOIN review_corrections rc
@@ -409,21 +410,21 @@ export async function saveBoardFilters(
 export async function getJobForResume(
   jobId: string,
   userId: string,
 ): Promise<{ title: string; company_name: string; description: string | null } | null> {
   return withUserSql(userId, async (tx) => {
     const rows = await tx`
       SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.description
       FROM jobs j JOIN companies c ON c.id = j.company_id
       WHERE j.id = ${jobId}
     `;
-    return (rows[0] as unknown as { title: string; company_name: string; description: string | null }) ?? null;
+    return parseGenerationContext(rows[0]);
   });
 }
 
 // Mirrors getJobForResume but joins the viewer's job_reviews so the cover-letter
 // prompt can lean on the rich per-job review context (about / requirements /
 // skill_gaps / red_flags). Missing review → empty arrays / null about.
 export async function getJobForCoverLetter(
   jobId: string,
   userId: string,
 ): Promise<{
@@ -440,29 +441,21 @@ export async function getJobForCoverLetter(
       SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
              r.about,
              COALESCE(r.requirements, '[]'::jsonb) AS requirements,
              COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
              COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
       WHERE j.id = ${jobId}
     `;
-    return (rows[0] as unknown as {
-      title: string;
-      company_name: string;
-      description: string | null;
-      about: string | null;
-      requirements: { text: string; met: boolean }[];
-      skill_gaps: string[];
-      red_flags: string[];
-    }) ?? null;
+    return parseGenerationContext(rows[0]);
   });
 }
 
 // Everything the "Prepare application" builder needs in one round-trip: the
 // résumé/cover-letter context (superset of getJobForCoverLetter) PLUS the ats,
 // company board token, and external_id required to construct the Greenhouse
 // question fetch, and the raw url for the apply link.
 export async function getJobForPackage(
   jobId: string,
   userId: string,
@@ -485,33 +478,21 @@ export async function getJobForPackage(
              c.ats, c.token AS company_token,
              r.about,
              COALESCE(r.requirements, '[]'::jsonb) AS requirements,
              COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
              COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
       WHERE j.id = ${jobId}
     `;
-    return (rows[0] as unknown as {
-      title: string;
-      company_name: string;
-      description: string | null;
-      url: string;
-      external_id: string;
-      ats: string;
-      company_token: string;
-      about: string | null;
-      requirements: { text: string; met: boolean }[];
-      skill_gaps: string[];
-      red_flags: string[];
-    }) ?? null;
+    return parseGenerationContext(rows[0]);
   });
 }
 
 // postgres.js returns jsonb columns as parsed JS values (a jsonb string scalar comes
 // back as a STRING) and timestamptz as Date. Every jsonb column is run through a total
 // parser: a malformed payload becomes null (the UI degrades to "not generated") and is
 // logged with the jobId, instead of a bad shape reaching React and crashing the board.
 export function toApplicationPackage(row: Record<string, unknown>): ApplicationPackage {
   const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
   const jobId = row.job_id as string;
@@ -626,56 +607,65 @@ export async function getJobQuestion(
 // Preserve-on-NULL: each generation route sends ONLY the artifact it produced and
 // NULL for the rest. A NULL means "I didn't regenerate this", not "clear it" — so the
 // ON CONFLICT clause COALESCEs to the stored value rather than overwriting with NULL.
 // Without this, generating a cover letter alone nulled a persisted résumé (and
 // regenerating a résumé nulled a persisted cover letter). A full "Prepare" still
 // replaces everything because it sends non-NULL values for every column it owns.
 export async function upsertApplicationPackage(
   userId: string,
   jobId: string,
   data: {
+    payload?: DemandResult;
     resume: TailoredResume | null;
     coverLetter: TailoredCoverLetter | null;
     prefilledAnswers: PrefilledAnswer[] | null;
     applyUrl: string | null;
     resumeTraceId?: string | null;
     coverLetterTraceId?: string | null;
     profileVersion?: string | null;
     resumeInstructions?: string | null;
     coverLetterInstructions?: string | null;
   },
 ): Promise<ApplicationPackage> {
   // Bind jsonb as text + ::jsonb (mirrors upsertProfile); NULL stays SQL NULL.
   const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
-  return withUserSql(userId, async (tx) => {
+  return withUserPayloadMutation(userId, jobId, "application_packages", async (tx) => {
   // Regenerating the letter cleanly replaces the user's edit in their view: stamp the
   // current edit superseded (the row + its already-pushed golden item persist; re-saving
   // an edit resets superseded_at to NULL — see app/actions/coverLetterEdits.ts).
   if (data.coverLetter != null) {
     await tx`
       UPDATE cover_letter_edits SET superseded_at = now()
       WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND superseded_at IS NULL
     `;
   }
   const rows = await tx`
     INSERT INTO application_packages
-      (user_id, job_id, resume_json, cover_letter_json,
+      (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, resume_json, cover_letter_json,
        prefilled_answers, apply_url, resume_trace_id,
        cover_letter_trace_id, resume_instructions, cover_letter_instructions,
        profile_version, status, prepared_at)
     VALUES (${userId}::uuid, ${jobId},
-            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
-            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
+            ${data.payload?.status === "ready" ? data.payload.versionId : null}::uuid,
+            ${data.payload?.status === "ready" ? data.payload.description : null},
+            ${data.payload?.status === "ready" && data.payload.questions ? JSON.stringify(data.payload.questions) : null}::text::jsonb,
+            CASE WHEN ${data.payload?.status === "ready"} THEN clock_timestamp() END,
+            ${j(data.resume)}::text::jsonb, ${j(data.coverLetter)}::text::jsonb,
+            ${j(data.prefilledAnswers)}::text::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
             ${data.coverLetterTraceId ?? null}, ${data.resumeInstructions ?? null},
             ${data.coverLetterInstructions ?? null},
             ${data.profileVersion ?? null}, 'prepared', now())
     ON CONFLICT (user_id, job_id) DO UPDATE SET
+      job_version_id = COALESCE(application_packages.job_version_id, EXCLUDED.job_version_id),
+      description_snapshot = COALESCE(application_packages.description_snapshot, EXCLUDED.description_snapshot),
+      questions_snapshot = COALESCE(application_packages.questions_snapshot, EXCLUDED.questions_snapshot),
+      snapshot_captured_at = COALESCE(application_packages.snapshot_captured_at, EXCLUDED.snapshot_captured_at),
       resume_json          = COALESCE(EXCLUDED.resume_json, application_packages.resume_json),
       cover_letter_json    = COALESCE(EXCLUDED.cover_letter_json, application_packages.cover_letter_json),
       prefilled_answers    = COALESCE(EXCLUDED.prefilled_answers, application_packages.prefilled_answers),
       apply_url            = COALESCE(EXCLUDED.apply_url, application_packages.apply_url),
       -- resume_trace_id and profile_version describe the résumé specifically, so they
       -- move in lockstep with resume_json: refreshed only when a new résumé is written,
       -- preserved (alongside the preserved résumé) otherwise. This keeps the résumé's
       -- "Outdated — regenerate" badge honest when only a cover letter is generated.
       resume_trace_id      = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                   THEN EXCLUDED.resume_trace_id
@@ -703,49 +693,57 @@ export async function upsertApplicationPackage(
       cover_letter_instructions_draft = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                              THEN NULL
                                              ELSE application_packages.cover_letter_instructions_draft END,
       prepared_at          = now()
     RETURNING job_id, status, resume_json, cover_letter_json,
               prefilled_answers, apply_url, profile_version,
               resume_instructions, cover_letter_instructions,
               resume_instructions_draft, cover_letter_instructions_draft,
               prepared_at, applied_at
   `;
+  if (data.payload?.status === "ready" && (data.resume || data.coverLetter || data.prefilledAnswers)) {
+    await consumeJobVersion(tx, jobId, data.payload.versionId, data.payload.kind ?? "generation");
+  }
   return toApplicationPackage(rows[0] as unknown as Record<string, unknown>);
   });
 }
 
 // Persist ONLY the saved DRAFT of one leg's generation-instructions box, independent of
 // generating (Save button). Never touches resume_json/cover_letter_json/etc.; creates a
 // bare 'prepared' row if none exists yet (benign — every pane is content-gated on
 // resume/coverLetter, and the applied set is status='applied'-gated). Empty string is a
 // valid saved value; the column is left as the caller passes it.
 export async function upsertInstructionDraft(
   userId: string,
   jobId: string,
   leg: "resume" | "cover",
   value: string,
 ): Promise<void> {
-  await withUserSql(userId, async (tx) => {
+  const payload=await requestJobPayload(userId,jobId,"generation");
+  if(payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
+  await withUserPayloadMutation(userId,jobId,"application_packages",async tx => {
+    const snapshot=await readPrivateSnapshot(tx,jobId,"application_packages");
     if (leg === "resume") {
       await tx`
         INSERT INTO application_packages
-          (user_id, job_id, resume_instructions_draft, status, prepared_at)
-        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
+          (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, resume_instructions_draft, status, prepared_at)
+        VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
+          ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${value}, 'prepared', now())
         ON CONFLICT (user_id, job_id) DO UPDATE SET
           resume_instructions_draft = EXCLUDED.resume_instructions_draft
       `;
     } else {
       await tx`
         INSERT INTO application_packages
-          (user_id, job_id, cover_letter_instructions_draft, status, prepared_at)
-        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
+          (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, cover_letter_instructions_draft, status, prepared_at)
+        VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
+          ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${value}, 'prepared', now())
         ON CONFLICT (user_id, job_id) DO UPDATE SET
           cover_letter_instructions_draft = EXCLUDED.cover_letter_instructions_draft
       `;
     }
   });
 }
 
 export async function upsertProfile(
   userId: string,
   data: {
diff --git a/dashboard/lib/queries.upsertApplicationPackage.test.ts b/dashboard/lib/queries.upsertApplicationPackage.test.ts
index 2d49388..82b5db8 100644
--- a/dashboard/lib/queries.upsertApplicationPackage.test.ts
+++ b/dashboard/lib/queries.upsertApplicationPackage.test.ts
@@ -22,21 +22,22 @@ vi.mock("@/lib/db", () => {
         resume_json: null,
         cover_letter_json: null,
         prefilled_answers: null,
         apply_url: null,
         profile_version: null,
         prepared_at: new Date("2026-07-02T20:40:54.000Z"),
         applied_at: null,
       },
     ]);
   };
-  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
+  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
+    withUserPayloadMutation: (_u: string, _j: string, _s: string, fn: (t:unknown)=>unknown)=>fn(tx) };
 });
 
 import { upsertApplicationPackage } from "@/lib/queries";
 
 const norm = (s: string): string => s.replace(/\s+/g, " ");
 
 const upsertSql = (): string => {
   const stmt = captured.find((s) => s.includes("INSERT INTO application_packages"));
   if (!stmt) throw new Error("upsert INSERT not captured");
   return norm(stmt);
diff --git a/dashboard/lib/resumeScore.action.test.ts b/dashboard/lib/resumeScore.action.test.ts
index e5e0f94..6aa790d 100644
--- a/dashboard/lib/resumeScore.action.test.ts
+++ b/dashboard/lib/resumeScore.action.test.ts
@@ -1,18 +1,24 @@
+vi.mock("@/lib/jobLifecycle", async importOriginal => ({
+  ...await importOriginal<typeof import("@/lib/jobLifecycle")>(),
+  readPrivateSnapshot: vi.fn(async () => null),
+  requestJobPayload: vi.fn(async () => ({status:"legacy",id:null})),
+}));
 import { describe, it, expect, vi, beforeEach } from "vitest";
 
 const admin = vi.hoisted(() => ({ isAdmin: true }));
 
 const sqlMock = vi.fn();
 vi.mock("@/lib/db", () => {
   const tx = Object.assign((...a: unknown[]) => sqlMock(...a), { json: (v: unknown) => v });
-  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
+  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
+    withUserPayloadMutation: (_u: string, _j: string, _s: string, fn: (t:unknown)=>unknown)=>fn(tx) };
 });
 vi.mock("@/lib/auth", () => ({
   requireUserId: vi.fn(async () => "u1"),
   getUserClaims: vi.fn(async () => ({ id: "u1", email: "a@x.com" })),
 }));
 vi.mock("@/lib/admin", () => ({ isAdmin: () => admin.isAdmin }));
 vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
 vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
 const upsertMock = vi.fn(async () => undefined);
 vi.mock("@/lib/resumeGoldenDataset", () => ({ upsertResumeGoldenItem: (...a: unknown[]) => (upsertMock as unknown as (...args: unknown[]) => unknown)(...a) }));
diff --git a/dashboard/lib/reviewRequests.test.ts b/dashboard/lib/reviewRequests.test.ts
index dcb20ce..7702545 100644
--- a/dashboard/lib/reviewRequests.test.ts
+++ b/dashboard/lib/reviewRequests.test.ts
@@ -40,31 +40,31 @@ describe("enqueueReviewRequest", () => {
   test("inserts a pending row and reports existing=false", async () => {
     state.rowQueue.push([{ status: "pending" }]);
     const r = await enqueueReviewRequest("u");
     expect(r).toEqual({ status: "pending", existing: false });
     expect(state.calls[0].text).toContain("INSERT INTO review_requests");
   });
 
   test("maps the partial-unique 23505 to idempotent success (existing active request)", async () => {
     state.throwOnInsert = true;
     // After the failed INSERT, the active-request lookup returns a running row.
-    state.rowQueue.push([{ status: "running" }]);
+    state.rowQueue.push([{ id:1,user_id:"u",requested_at:"2026-10-07T00:00:00Z",status: "running" }]);
     const r = await enqueueReviewRequest("u");
     expect(r).toEqual({ status: "running", existing: true });
     // The active-request SELECT ran after the aborted insert.
     expect(state.calls.some((c) => c.text.includes("status IN ('pending','running')"))).toBe(true);
   });
 });
 
 describe("getLatestReviewRequest", () => {
   test("returns the newest row or null", async () => {
-    state.rowQueue.push([{ id: 5, status: "done" }]);
+    state.rowQueue.push([{ id: 5,user_id:"u",requested_at:"2026-10-07T00:00:00Z",status: "done" }]);
     expect(await getLatestReviewRequest("u")).toMatchObject({ id: 5, status: "done" });
     expect(await getLatestReviewRequest("u")).toBeNull(); // empty queue → []
   });
 });
 
 describe("remainingDailyBudget", () => {
   test("null plan → 0 without touching the DB", async () => {
     expect(await remainingDailyBudget("u", null)).toBe(0);
     expect(state.calls).toHaveLength(0);
   });
diff --git a/dashboard/lib/reviewRequests.ts b/dashboard/lib/reviewRequests.ts
index b556d1d..592784c 100644
--- a/dashboard/lib/reviewRequests.ts
+++ b/dashboard/lib/reviewRequests.ts
@@ -1,10 +1,11 @@
+import { parseRequestBody } from "@/lib/jobLifecycle";
 import { withUserSql } from "@/lib/db";
 import { CHEAP_MODEL, resolveStage2Model, dailyReviewCap, type Plan } from "@/lib/entitlements";
 import { loadTierConfig } from "@/lib/tierConfig";
 
 // Per-tier DEFAULT stage-2 model, used when a user hasn't picked one
 // (profiles.model_stage2 IS NULL). MIRRORS reviewer/config.py default_stage2_model: the
 // reviewer applies the SAME fallback before gating, so the cap computed here matches the
 // cap the reviewer enforces. Env-overridable per tier; the compiled fallbacks below MUST
 // equal reviewer/config.py _COMPILED_DEFAULT_STAGE2_MODEL. Set the env vars identically on
 // the dashboard AND reviewer services, or the displayed and enforced caps can diverge.
@@ -36,41 +37,52 @@ export type ReviewRequestStatus = "pending" | "running" | "done" | "failed";
 export interface ReviewRequestRow {
   id: number;
   user_id: string;
   status: ReviewRequestStatus;
   requested_at: string;
   started_at: string | null;
   finished_at: string | null;
   notes: string | null;
 }
 
+export function parseReviewRequest(value: unknown): ReviewRequestRow | null {
+  const row = parseRequestBody(value);
+  const status=row.status;
+  if (status!=="pending" && status!=="running" && status!=="done" && status!=="failed") return null;
+  const id=typeof row.id === "number" ? row.id : typeof row.id === "string" ? Number(row.id) : NaN;
+  const date=(v:unknown):string|null=>v instanceof Date && Number.isFinite(v.getTime()) ? v.toISOString() : typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
+  const requested=date(row.requested_at);
+  if(!Number.isSafeInteger(id) || typeof row.user_id!=="string" || !requested) return null;
+  return {id,user_id:row.user_id,status,requested_at:requested,started_at:date(row.started_at),finished_at:date(row.finished_at),notes:typeof row.notes === "string" ? row.notes : null};
+}
+
 /** Newest request for the user (any status), or null. */
 export async function getLatestReviewRequest(userId: string): Promise<ReviewRequestRow | null> {
   return withUserSql(userId, async (tx) => {
     const rows = await tx`
       SELECT id, user_id, status, requested_at, started_at, finished_at, notes
       FROM review_requests WHERE user_id = ${userId}::uuid
       ORDER BY requested_at DESC LIMIT 1
     `;
-    return (rows[0] as unknown as ReviewRequestRow) ?? null;
+    return parseReviewRequest(rows[0]);
   });
 }
 
 async function getActiveReviewRequest(userId: string): Promise<ReviewRequestRow | null> {
   return withUserSql(userId, async (tx) => {
     const rows = await tx`
       SELECT id, user_id, status, requested_at, started_at, finished_at, notes
       FROM review_requests
       WHERE user_id = ${userId}::uuid AND status IN ('pending','running')
       ORDER BY requested_at DESC LIMIT 1
     `;
-    return (rows[0] as unknown as ReviewRequestRow) ?? null;
+    return parseReviewRequest(rows[0]);
   });
 }
 
 /**
  * Enqueue a pending request. Idempotent: if the user already has an active
  * (pending|running) request, the partial-unique-index violation (23505) is treated
  * as success and the existing active request is returned. The failed INSERT aborts
  * its transaction, so the existing-request read runs in a fresh one.
  */
 export async function enqueueReviewRequest(
diff --git a/job_discovery/adapters/greenhouse.py b/job_discovery/adapters/greenhouse.py
index a8b094c..31ceac9 100644
--- a/job_discovery/adapters/greenhouse.py
+++ b/job_discovery/adapters/greenhouse.py
@@ -67,21 +67,21 @@ def _parse_fields(fields) -> list[dict]:
     if not isinstance(fields, list):
         return []
     out = []
     for f in fields:
         if not isinstance(f, dict):
             continue
         name = _as_string(f.get("name"))
         type_ = _as_string(f.get("type"))
         if not name and not type_:           # drop a field only when BOTH are empty
             continue
-        out.append({"name": name, "type": type_, "options": _parse_options(f.get("values"))})
+        out.append({"name": name, "type": type_, "options": _parse_options(f.get("values", f.get("options")))})
     return out
 
 
 def parse_greenhouse_questions(data) -> dict | None:
     """Mirror of dashboard/lib/rolefit/greenhouseQuestions.ts::parseGreenhouseQuestions.
     Returns {"questions": [...]} or None. Pure and total — keep edge cases identical
     to the TS parser so the two sides of the jsonb boundary can't drift."""
     if not isinstance(data, dict):
         return None
     raw = data.get("questions")
diff --git a/job_discovery/http.py b/job_discovery/http.py
index c6c74f6..b5d5382 100644
--- a/job_discovery/http.py
+++ b/job_discovery/http.py
@@ -1,30 +1,34 @@
 import random
 import time
 from typing import Any
 
 import httpx
+from job_discovery import public_fetch
 
 DEFAULT_TIMEOUT = 10.0
 _TIMEOUT = DEFAULT_TIMEOUT
 _HEADERS = {"User-Agent": "job-board/0.1"}
 
 # Default retry count (number of re-attempts after the first failure); total
 # attempts = _ATTEMPTS = retries + 1. Backoff table: one entry per inter-attempt
 # sleep before the last attempt; length == retries.
 _DEFAULT_RETRIES = 2
 _DEFAULT_BACKOFF = 0.5
 
-# Shared client: connection pool is reused across all requests in one process.
-# Avoids the per-call TCP handshake overhead of the previous httpx.get() calls.
-# follow_redirects=True handles 301/302 transparently.
-_client = httpx.Client(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True)
+# Shared facade: each real public fetch gets a bounded disposable transport.
+class _PublicClient:
+    follow_redirects = False
+    request = staticmethod(public_fetch.request)
+
+
+_client = _PublicClient()
 
 
 def _sleep_backoff(attempt: int, backoff: float) -> None:
     """Exponential back-off with a small random jitter (avoids thundering herd)."""
     time.sleep(backoff * (2 ** attempt) + random.uniform(0, 0.25))
 
 
 def _request(
     method: str,
     url: str,
@@ -35,42 +39,57 @@ def _request(
     **kw: Any,
 ) -> Any:
     """Send an HTTP request with retry/back-off, using the shared client.
 
     Retry policy:
       - 429 (rate-limited): respect the Retry-After header, then retry.
       - 5xx (server error): exponential back-off + jitter, then retry.
       - Non-429 4xx (client error): retrying cannot help; raise immediately.
       - Network errors / JSON decode errors: exponential back-off + jitter.
     """
+    deadline = time.monotonic() + public_fetch.MAX_SECONDS
     attempts = retries + 1
     last_exc: Exception | None = None
     for attempt in range(attempts):
         try:
-            resp = _client.request(method, url, **kw)
+            remaining = deadline - time.monotonic()
+            if remaining <= 0:
+                raise httpx.TimeoutException("public fetch deadline exceeded")
+            kw["timeout"] = min(float(kw.get("timeout", remaining)), remaining)
+            resp = _client.request(method, url, parse_json=parse is None, **kw)
             resp.raise_for_status()
-            return parse(resp) if parse is not None else resp.json()
+            result = parse(resp) if parse is not None else (resp.extensions["public_json"] if "public_json" in getattr(resp,"extensions",{}) else resp.json())
+            if time.monotonic() >= deadline:
+                raise httpx.TimeoutException("public parse deadline exceeded")
+            return result
         except httpx.HTTPStatusError as e:
             last_exc = e
             code = e.response.status_code
             if code == 429 and attempt < attempts - 1:
                 delay = float(e.response.headers.get("Retry-After") or
                               backoff * (2 ** attempt))
-                time.sleep(delay + random.uniform(0, 0.25))
+                delay = delay + random.uniform(0, 0.25)
+                if delay >= deadline - time.monotonic():
+                    raise httpx.TimeoutException("retry exceeds public fetch deadline")
+                time.sleep(delay)
                 continue
             if 400 <= code < 500:
                 raise  # non-429 4xx: retrying cannot help
             if attempt < attempts - 1:
+                if backoff * (2 ** attempt) + 0.25 >= deadline - time.monotonic():
+                    raise httpx.TimeoutException("retry exceeds public fetch deadline")
                 _sleep_backoff(attempt, backoff)  # 5xx: back off and retry
         except (httpx.HTTPError, ValueError) as e:
             last_exc = e
             if attempt < attempts - 1:
+                if backoff * (2 ** attempt) + 0.25 >= deadline - time.monotonic():
+                    raise httpx.TimeoutException("retry exceeds public fetch deadline")
                 _sleep_backoff(attempt, backoff)
     assert last_exc is not None
     raise last_exc
 
 
 def get_json(
     url: str,
     *,
     retries: int = _DEFAULT_RETRIES,
     backoff: float = _DEFAULT_BACKOFF,
diff --git a/job_discovery/lifecycle/demand.py b/job_discovery/lifecycle/demand.py
new file mode 100644
index 0000000..431ab37
--- /dev/null
+++ b/job_discovery/lifecycle/demand.py
@@ -0,0 +1,368 @@
+"""Service hydration. Network occurs only between committed, fenced transactions."""
+
+import hashlib
+import re
+from uuid import UUID
+
+from psycopg.types.json import Jsonb
+
+from job_discovery.http import get_json
+from job_discovery.jd import extract_description
+from job_discovery.adapters.greenhouse import parse_greenhouse_questions
+from .claims import claim_work, renew_claim, validate_claim
+from .config import read_control, legacy_description_capture_allowed
+from .identity import capture_version
+from .locks import lock_jobs
+from .reconcile import _write, StorageBlocked
+from .types import DemandRef
+
+KINDS = {"description", "questions", "review", "prepare", "generation"}
+_COORDINATE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
+
+
+def parse_payload(value):
+    if not isinstance(value, dict):
+        return None
+    description = value.get("description")
+    if (
+        not isinstance(description, str)
+        or not description.strip()
+        or len(description.encode()) > 10 * 1024**2
+    ):
+        return None
+    return {
+        "description": description.strip(),
+        "questions": parse_greenhouse_questions(value.get("questions")),
+    }
+
+
+def fetch_payload(coordinates):
+    """Only stored ATS coordinates, exact detail GET or one bounded current feed.
+
+    Unknown/malformed provider shapes defer. Never follow a job's application URL.
+    """
+    ats = coordinates.get("ats")
+    board = coordinates.get("public_board_ref")
+    external = coordinates.get("external_id")
+    if not isinstance(board, str) or not isinstance(external, str):
+        return None
+    if ats == "workday":
+        parts = board.split(":")
+        if len(parts) != 3 or not all(_COORDINATE.fullmatch(p) for p in parts):
+            return None
+        tenant, datacenter, site = parts
+        if (
+            not re.fullmatch(r"wd\d+", datacenter)
+            or not re.fullmatch(r"/job/[A-Za-z0-9_/-]{1,1000}", external)
+            or ".." in external
+        ):
+            return None
+        url = f"https://{tenant}.{datacenter}.myworkdayjobs.com/wday/cxs/{tenant}/{site}{external}"
+    else:
+        if not _COORDINATE.fullmatch(board) or not _COORDINATE.fullmatch(external):
+            return None
+        urls = {
+            "greenhouse": f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{external}?questions=true",
+            "lever": f"https://api.lever.co/v0/postings/{board}/{external}?mode=json",
+            "smartrecruiters": f"https://api.smartrecruiters.com/v1/companies/{board}/postings/{external}",
+            "ashby": f"https://api.ashbyhq.com/posting-api/job-board/{board}",
+            "workable": f"https://apply.workable.com/api/v1/widget/accounts/{board}?details=true",
+        }
+        url = urls.get(ats)
+        if url is None:
+            return None
+    data = get_json(url)
+    if ats in {"ashby", "workable"}:
+        items = data.get("jobs") if isinstance(data, dict) else None
+        if not isinstance(items, list) or len(items) > 10000:
+            return None
+        key = "shortcode" if ats == "workable" else "id"
+        matching = [
+            item
+            for item in items
+            if isinstance(item, dict) and str(item.get(key)) == external
+        ]
+        if len(matching) != 1:
+            return None
+        data = matching[0]
+    if not isinstance(data, dict):
+        return None
+    # The exact endpoint is authoritative, and any supplied identity must agree.
+    if (
+        ats in {"greenhouse", "lever", "smartrecruiters"}
+        and str(data.get("id", external)) != external
+    ):
+        return None
+    try:
+        return parse_payload(
+            {
+                "description": extract_description(ats, data),
+                "questions": data if ats == "greenhouse" else None,
+            }
+        )
+    except (ValueError, TypeError, AttributeError, KeyError):
+        return None
+
+
+def request_demand(conn, job_id: str, user_id: str, kind: str) -> DemandRef:
+    if kind not in KINDS:
+        raise ValueError("invalid demand kind")
+    lock_jobs(conn, [job_id])
+    ready = conn.execute(
+        """SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s
+        AND status='ready' AND job_version_id IS NOT NULL AND description_snapshot IS NOT NULL
+        AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-CASE WHEN kind IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
+        ORDER BY settled_at DESC LIMIT 1""",
+        (UUID(user_id), job_id, kind),
+    ).fetchone()
+    if ready:
+        return DemandRef(ready["id"], job_id, kind, None, "ready")
+    row = conn.execute(
+        """INSERT INTO job_payload_demands(user_id,job_id,kind)
+        VALUES(%s,%s,%s) ON CONFLICT(user_id,job_id,kind) WHERE status IN ('pending','running') DO NOTHING
+        RETURNING *""",
+        (UUID(user_id), job_id, kind),
+    ).fetchone()
+    if row is None:
+        row = conn.execute(
+            "SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s AND status IN ('pending','running')",
+            (UUID(user_id), job_id, kind),
+        ).fetchone()
+    return DemandRef(row["id"], job_id, kind, None, row["status"])
+
+
+def _finish(conn, demand, claim, status, version=None, payload=None):
+    validate_claim(conn, claim)
+    payload = payload or {}
+    size = 8192 + 8 * len(str(payload).encode())
+    with _write(conn, claim, "job_payload_demands", demand.job_id, size=size):
+        row = conn.execute(
+            """UPDATE job_payload_demands SET status=%s,job_version_id=%s,
+            description_snapshot=%s,questions_snapshot=%s,snapshot_captured_at=CASE WHEN %s='ready' THEN clock_timestamp() ELSE NULL END,
+            settled_at=clock_timestamp()
+            WHERE id=%s AND status='running' AND claim_owner_token=%s AND claim_generation=%s
+            RETURNING id""",
+            (
+                status,
+                version,
+                payload.get("description"),
+                Jsonb(payload["questions"])
+                if payload.get("questions") is not None
+                else None,
+                status,
+                demand.id,
+                claim.owner_token,
+                claim.generation,
+            ),
+        ).fetchone()
+        if row is None:
+            raise RuntimeError("demand completion superseded")
+    conn.commit()
+    return status
+
+
+def _hydrate_demand(conn, demand: DemandRef, fetch=fetch_payload) -> str:
+    """Return pending/ready/deferred; ready is a committed exact-version snapshot.
+
+    Does not overwrite shared payload: protected shared caches remain intact in
+    this rollout. The consumer reads its durable demand snapshot instead.
+    """
+    lock_jobs(conn, [demand.job_id])
+    row = conn.execute(
+        "SELECT * FROM job_payload_demands WHERE id=%s AND job_id=%s",
+        (demand.id, demand.job_id),
+    ).fetchone()
+    if not row or row["status"] in {"cancelled", "failed"}:
+        conn.commit()
+        return "deferred"
+    if (
+        row["status"] == "ready"
+        and row["job_version_id"]
+        and row["description_snapshot"]
+    ):
+        conn.commit()
+        return "ready"
+    if row["status"] == "deferred":
+        conn.commit()
+        return "deferred"
+    claim = claim_work(conn, "demand", str(demand.id), 180)
+    if claim is None:
+        conn.commit()
+        return "pending"
+    if (
+        legacy_description_capture_allowed(conn)
+        and not conn.execute(
+            "SELECT 1 FROM source_listings WHERE job_id=%s", (demand.job_id,)
+        ).fetchone()
+    ):
+        from .identity import migrate_identity_batch
+
+        with _write(conn, claim, "source_listings", demand.job_id, size=65536):
+            migrate_identity_batch(conn, limit=1, job_ids=[demand.job_id])
+    coordinates = conn.execute(
+        """SELECT s.ats,s.public_board_ref,l.external_id,l.id listing_id,l.current_version_id,
+        j.title,j.url,j.description,j.description_version_id,
+        v.public_metadata FROM jobs j JOIN source_listings l ON l.job_id=j.id
+        JOIN source_accounts s ON s.id=l.source_account_id
+        LEFT JOIN job_versions v ON v.id=l.current_version_id WHERE j.id=%s
+        AND j.closed_at IS NULL ORDER BY l.id LIMIT 1""",
+        (demand.job_id,),
+    ).fetchone()
+    with _write(conn, claim, "job_payload_demands", demand.job_id):
+        conn.execute(
+            """UPDATE job_payload_demands SET status='running',claim_owner_token=%s,
+            claim_generation=%s,lease_until=%s WHERE id=%s""",
+            (claim.owner_token, claim.generation, claim.lease_until, demand.id),
+        )
+    conn.commit()
+    if not coordinates:
+        return _finish(conn, demand, claim, "deferred")
+    try:
+        payload = parse_payload(fetch(dict(coordinates)))
+    except Exception:
+        payload = None
+    lock_jobs(conn, [demand.job_id])
+    claim = renew_claim(
+        conn, claim
+    )  # fetch is bounded to 20 seconds, below renew interval
+    current = conn.execute(
+        "SELECT current_version_id FROM source_listings WHERE id=%s",
+        (coordinates["listing_id"],),
+    ).fetchone()
+    if (
+        not current
+        or current["current_version_id"] != coordinates["current_version_id"]
+    ):
+        return _finish(conn, demand, claim, "deferred")
+    if payload is None or (
+        demand.kind in {"questions", "prepare"}
+        and coordinates["ats"] == "greenhouse"
+        and payload["questions"] is None
+    ):
+        return _finish(conn, demand, claim, "deferred")
+    metadata = dict(
+        coordinates["public_metadata"]
+        or {"title": coordinates["title"], "url": coordinates["url"]}
+    )
+    metadata["description_hash"] = hashlib.sha256(
+        " ".join(payload["description"].split()).encode()
+    ).hexdigest()
+    version = capture_version(
+        conn,
+        coordinates["listing_id"],
+        metadata,
+        conn.execute("SELECT clock_timestamp() now").fetchone()["now"],
+        claim,
+    )
+    if version is None:
+        return _finish(conn, demand, claim, "deferred")
+    result = _finish(conn, demand, claim, "ready", version, payload)
+    # Demand completion is durable first. An empty shared cache may be filled by
+    # this explicit demand; existing/protected content is never replaced.
+    try:
+        lock_jobs(conn, [demand.job_id])
+        with _write(
+            conn,
+            claim,
+            "jobs",
+            demand.job_id,
+            size=8192 + 8 * len(payload["description"].encode()),
+        ):
+            conn.execute(
+                """UPDATE jobs SET description=%s,description_version_id=%s,
+                description_captured_at=clock_timestamp(),description_capture_provenance='demand',description_pruned=false
+                WHERE id=%s AND description IS NULL""",
+                (payload["description"], version, demand.job_id),
+            )
+        conn.commit()
+    except Exception:
+        conn.rollback()  # private ready snapshot remains authoritative
+    return result
+
+
+def hydrate_demand(conn, demand: DemandRef, fetch=fetch_payload) -> str:
+    try:
+        return _hydrate_demand(conn, demand, fetch)
+    except RuntimeError:
+        conn.rollback()
+        return "deferred"
+
+
+def hydrate_candidates(conn, job_ids: list[str], user_id: str) -> list[str]:
+    """Called only after deterministic entitlement/location/company filtering."""
+    enabled = read_control(conn).hydration_enabled
+    conn.commit()
+    if not enabled:
+        return [
+            row["id"]
+            for row in conn.execute(
+                "SELECT id FROM jobs WHERE id=ANY(%s) AND NULLIF(btrim(description),'') IS NOT NULL",
+                (job_ids,),
+            )
+        ]
+    ready = []
+    for job_id in job_ids:
+        demand = request_demand(conn, job_id, user_id, "review")
+        conn.commit()
+        try:
+            if hydrate_demand(conn, demand) == "ready":
+                ready.append(job_id)
+        except (RuntimeError, StorageBlocked):
+            conn.rollback()
+    return ready
+
+
+def process_pending(conn, limit=1):
+    if not read_control(
+        conn
+    ).hydration_enabled and not legacy_description_capture_allowed(conn):
+        conn.commit()
+        return 0
+    apply_consumptions(conn)
+    rows = conn.execute(
+        """SELECT * FROM job_payload_demands WHERE status='pending'
+        OR (status='running' AND lease_until<=clock_timestamp()) ORDER BY created_at,id LIMIT %s""",
+        (limit,),
+    ).fetchall()
+    conn.commit()
+    for row in rows:
+        try:
+            hydrate_demand(
+                conn,
+                DemandRef(row["id"], row["job_id"], row["kind"], None, row["status"]),
+            )
+        except Exception:
+            conn.rollback()
+    return len(rows)
+
+
+def apply_consumptions(conn, limit=100):
+    """Service applies only committed owner consumption receipts, never views."""
+    from .locks import enter_gate
+
+    enter_gate(conn)
+    rows = conn.execute(
+        """SELECT id,job_id,job_version_id,kind,consumed_at FROM job_payload_demands
+        WHERE consumed_at IS NOT NULL AND (consumption_applied_at IS NULL OR consumed_at>consumption_applied_at)
+        ORDER BY consumed_at,id LIMIT %s""",
+        (limit,),
+    ).fetchall()
+    lock_jobs(conn, [r["job_id"] for r in rows])
+    for row in rows:
+        conn.execute(
+            """UPDATE jobs SET description_last_used_at=GREATEST(description_last_used_at,%s)
+            WHERE id=%s AND description_version_id=%s""",
+            (row["consumed_at"], row["job_id"], row["job_version_id"]),
+        )
+        if row["kind"] in {"questions", "prepare"}:
+            conn.execute(
+                """UPDATE job_questions SET last_used_at=GREATEST(last_used_at,%s)
+                WHERE job_id=%s AND job_version_id=%s""",
+                (row["consumed_at"], row["job_id"], row["job_version_id"]),
+            )
+        conn.execute(
+            "UPDATE job_payload_demands SET consumption_applied_at=%s WHERE id=%s",
+            (row["consumed_at"], row["id"]),
+        )
+    conn.commit()
+    return len(rows)
diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
index 51b1b61..ccb4fde 100644
--- a/job_discovery/lifecycle/identity.py
+++ b/job_discovery/lifecycle/identity.py
@@ -36,47 +36,50 @@ def choose_anchor(
     if (
         isinstance(published_at, datetime)
         and published_at.tzinfo is not None
         and published_at.utcoffset() is not None
         and published_at <= now
     ):
         return published_at.astimezone(UTC), "source_published"
     return discovered_at.astimezone(UTC), "local_observation"
 
 
-def migrate_identity_batch(conn, limit: int = 500) -> int:
+def migrate_identity_batch(conn, limit: int = 500, *, job_ids: list[str] | None = None) -> int:
     """Map <=500 legacy jobs (or remaining empty source accounts) atomically.
 
     The stable listing existence is the checkpoint. A rolled back batch has no
     checkpoint; a committed batch cannot reset its anchor or cache capture. The
     migration activation clock is set once by the first explicit batch, not DDL.
     Inactive boards preserve their old status without guessing why disabled.
     Legacy/collect mapping enters the common gate and sorted job locks. Enforced
     and ever-activated archive states remain rejected; this mapper has no
     admission or outbox bypass.
     """
     if type(limit) is not int or not 1 <= limit <= 500:
         raise ValueError("identity batch limit must be an integer between 1 and 500")
+    if job_ids is not None and (not isinstance(job_ids,list) or len(job_ids)>500 or any(not isinstance(j,str) for j in job_ids)):
+        raise ValueError("identity job filter must contain at most 500 job IDs")
     with conn.cursor(row_factory=dict_row) as cur:
         enter_gate(conn)
         control = read_control(conn)
         if (
             control.safety_stage not in {"legacy", "collect"}
             or control.archive_ever_activated
         ):
             raise RuntimeError("legacy mapping requires pre-cutover control state")
         cur.execute(
             """SELECT j.*, c.ats, c.token, c.active, c.poll_failures
             FROM jobs j JOIN companies c ON c.id=j.company_id
             WHERE NOT EXISTS (SELECT 1 FROM source_listings l WHERE l.job_id=j.id)
+              AND (%s::text[] IS NULL OR j.id=ANY(%s::text[]))
             ORDER BY j.id LIMIT %s""",
-            (limit,),
+            (job_ids,job_ids,limit),
         )
         rows = cur.fetchall()
         # Reserve sorted namespaced Job keys before taking any Job/FK locks.
         # Global BEFORE STATEMENT triggers cover direct callers as well.
         for job in rows:
             cur.execute(
                 "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                 ("lifecycle:job:" + job["id"],),
             )
         cur.execute("""UPDATE lifecycle_control
@@ -133,21 +136,21 @@ def migrate_identity_batch(conn, limit: int = 500) -> int:
                 WHERE id=%s AND description IS NOT NULL AND description_captured_at IS NULL
                   AND description_last_used_at IS NULL""",
                 (activation, job["id"]),
             )
             cur.execute(
                 """UPDATE job_questions SET captured_at=%s,
                 capture_provenance='migration_activation'
                 WHERE job_id=%s AND captured_at IS NULL AND last_used_at IS NULL""",
                 (activation, job["id"]),
             )
-        if rows:
+        if rows or job_ids is not None:
             return len(rows)
         # Source-only boards also need a stable coordinate. Count these only in
         # batches with no jobs so a zero return means the whole mapping is done.
         cur.execute(
             """INSERT INTO source_accounts
             (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
             SELECT c.id,c.ats,c.token,c.active,CASE WHEN c.active THEN 'enabled' ELSE 'unknown' END,c.poll_failures
             FROM companies c WHERE NOT EXISTS
               (SELECT 1 FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
             ORDER BY c.id LIMIT %s ON CONFLICT (ats,public_board_ref) DO NOTHING
diff --git a/job_discovery/public_fetch.py b/job_discovery/public_fetch.py
new file mode 100644
index 0000000..8aea2ed
--- /dev/null
+++ b/job_discovery/public_fetch.py
@@ -0,0 +1,269 @@
+"""Bounded public read transport. No ambient proxy, credentials or cookie jar.
+
+A disposable subprocess owns DNS, socket, headers, decompression and JSON parsing.
+Its parent deadline can terminate even a stuck resolver. Each hop connects to the
+validated numeric address while TLS checks the original hostname.
+"""
+
+import pickle
+import http.client
+import ipaddress
+import json
+import re
+import socket
+import ssl
+import subprocess
+import sys
+import time
+import zlib
+from urllib.parse import urljoin, urlsplit, urlunsplit
+
+MAX_BYTES = 10 * 1024 * 1024
+MAX_SECONDS = 20.0
+MAX_REDIRECTS = 3
+
+
+def public_address(host, port):
+    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
+    if not addresses:
+        raise ValueError("public host has no addresses")
+    for _, _, _, _, address in addresses:
+        ip = ipaddress.ip_address(address[0])
+        if not ip.is_global or ip.is_multicast:
+            raise ValueError("public fetch requires globally routable addresses")
+    return addresses[0][4][0]
+
+
+def clean_url(url):
+    parsed = urlsplit(url)
+    if parsed.scheme not in {"http", "https"} or not parsed.hostname or len(url) > 4096:
+        raise ValueError("invalid public URL")
+    port = parsed.port or (443 if parsed.scheme == "https" else 80)
+    if port not in {80, 443}:
+        raise ValueError("public URL port is unsupported")
+    host = parsed.hostname.encode("idna").decode("ascii")
+    authority = f"[{host}]" if ":" in host else host
+    if parsed.port:
+        authority += f":{port}"
+    return (
+        urlunsplit((parsed.scheme, authority, parsed.path or "/", parsed.query, "")),
+        host,
+        port,
+    )
+
+
+class PinnedConnection(http.client.HTTPConnection):
+    def __init__(self, host, port, address, secure, timeout):
+        super().__init__(host, port, timeout=timeout)
+        self.address, self.secure = address, secure
+
+    def connect(self):
+        # Numeric address avoids a second hostname lookup / DNS rebinding window.
+        family = socket.AF_INET6 if ":" in self.address else socket.AF_INET
+        sock = socket.socket(family, socket.SOCK_STREAM)
+        try:
+            sock.settimeout(self.timeout)
+            sock.connect((self.address, self.port))
+            peer = ipaddress.ip_address(sock.getpeername()[0])
+            if (
+                str(peer) != str(ipaddress.ip_address(self.address))
+                or not peer.is_global
+            ):
+                raise ValueError("public peer address changed")
+            self.sock = (
+                ssl.create_default_context().wrap_socket(
+                    sock, server_hostname=self.host
+                )
+                if self.secure
+                else sock
+            )
+        except BaseException:
+            sock.close()
+            raise
+
+
+def fetch_local(
+    method,
+    url,
+    payload,
+    seconds,
+    parse_json=True,
+    *,
+    resolve=public_address,
+    connection=PinnedConnection,
+):
+    deadline = time.monotonic() + min(seconds, MAX_SECONDS)
+
+    def remaining():
+        value = deadline - time.monotonic()
+        if value <= 0:
+            raise TimeoutError("public fetch deadline exceeded")
+        return value
+
+    if method not in {"GET", "POST"}:
+        raise ValueError("public transport supports readonly requests only")
+    body = None if payload is None else json.dumps(payload, allow_nan=False).encode()
+    if body is not None and len(body) > 65536:
+        raise ValueError("readonly search body exceeds limit")
+    for hop in range(MAX_REDIRECTS + 1):
+        url, host, port = clean_url(url)
+        # POST is exclusively Workday's documented public readonly search.
+        path = urlsplit(url).path
+        if method == "POST" and (
+            not re.fullmatch(r"[a-zA-Z0-9_-]+\.wd[0-9]+\.myworkdayjobs\.com", host)
+            or not re.fullmatch(r"/wday/cxs/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/jobs", path)
+        ):
+            raise ValueError("POST is not an approved readonly search")
+        if method == "POST" and (
+            not isinstance(payload, dict)
+            or set(payload) - {"appliedFacets", "limit", "offset", "searchText"}
+        ):
+            raise ValueError("invalid readonly search parameters")
+        address = resolve(host, port)
+        conn = connection(host, port, address, url.startswith("https:"), remaining())
+        try:
+            headers = {
+                "User-Agent": "job-board/0.1",
+                "Accept-Encoding": "gzip, deflate",
+                "Accept": "application/json, text/html, text/plain",
+            }
+            if body is not None:
+                headers["Content-Type"] = "application/json"
+            parts = urlsplit(url)
+            conn.request(
+                method,
+                parts.path + ("?" + parts.query if parts.query else ""),
+                body=body,
+                headers=headers,
+            )
+            response = conn.getresponse()
+            remaining()
+            if response.status in {301, 302, 303, 307, 308}:
+                if hop == MAX_REDIRECTS:
+                    raise ValueError("public redirect limit exceeded")
+                location = response.getheader("Location")
+                if not location:
+                    raise ValueError("redirect missing location")
+                if method == "POST":
+                    # Never forward search data to a redirected endpoint.
+                    raise ValueError("readonly POST redirects are unsupported")
+                url = urljoin(url, location)
+                continue
+            if response.status >= 400:
+                return {
+                    "status": response.status,
+                    "headers": {"retry-after": response.getheader("Retry-After") or ""},
+                    "body": b"",
+                    "parsed": None,
+                    "parse_json": parse_json,
+                }
+            media = (
+                (response.getheader("Content-Type") or "").split(";")[0].strip().lower()
+            )
+            if (
+                media
+                and media
+                not in {"application/json", "text/json", "text/html", "text/plain"}
+                and not media.endswith("+json")
+            ):
+                raise ValueError("unsupported public response media type")
+            encoding = (response.getheader("Content-Encoding") or "identity").lower()
+            if encoding not in {"identity", "gzip", "deflate"}:
+                raise ValueError("unsupported public content encoding")
+            decoder = (
+                None
+                if encoding == "identity"
+                else zlib.decompressobj(31 if encoding == "gzip" else zlib.MAX_WBITS)
+            )
+            chunks, wire, expanded = [], 0, 0
+            while True:
+                if conn.sock is not None:
+                    conn.sock.settimeout(remaining())
+                chunk = response.read(65536)
+                remaining()
+                if not chunk:
+                    break
+                wire += len(chunk)
+                if wire > MAX_BYTES:
+                    raise ValueError("public wire body exceeds 10 MiB")
+                chunk = (
+                    decoder.decompress(chunk, MAX_BYTES - expanded + 1)
+                    if decoder
+                    else chunk
+                )
+                expanded += len(chunk)
+                if expanded > MAX_BYTES or (decoder and decoder.unconsumed_tail):
+                    raise ValueError("public expanded body exceeds 10 MiB")
+                chunks.append(chunk)
+            if decoder and (not decoder.eof or decoder.unused_data):
+                raise ValueError("invalid or concatenated compressed body")
+            data = b"".join(chunks)
+            # Validate JSON within the subprocess's hard deadline as well.
+            parsed = json.loads(data) if parse_json else None
+            remaining()
+            return {
+                "status": response.status,
+                "headers": {
+                    "content-type": media,
+                    "retry-after": response.getheader("Retry-After") or "",
+                },
+                "body": data,
+                "parsed": parsed,
+                "parse_json": parse_json,
+            }
+        finally:
+            conn.close()
+    raise ValueError("public redirect limit exceeded")
+
+
+def request(method, url, *, timeout=20.0, json=None, parse_json=True):
+    import httpx
+
+    seconds = min(float(timeout), MAX_SECONDS)
+    started = time.monotonic()
+    try:
+        result = subprocess.run(
+            [sys.executable, "-m", "job_discovery.public_fetch"],
+            input=__import__("json")
+            .dumps(
+                {
+                    "method": method,
+                    "url": url,
+                    "payload": json,
+                    "seconds": seconds,
+                    "parse_json": parse_json,
+                }
+            )
+            .encode(),
+            capture_output=True,
+            timeout=seconds,
+            check=False,
+        )
+    except subprocess.TimeoutExpired as exc:
+        raise httpx.TimeoutException("public fetch deadline exceeded") from exc
+    if result.returncode:
+        raise httpx.RequestError(
+            "public fetch rejected or failed: "
+            + result.stdout[:200].decode(errors="replace")
+        )
+    # Only our child serializes this envelope; network bytes are never unpickled.
+    data = pickle.loads(result.stdout)
+    body = data["body"]
+    if time.monotonic() - started >= seconds:
+        raise httpx.TimeoutException("public fetch deadline exceeded")
+    return httpx.Response(
+        data["status"],
+        headers=data["headers"],
+        content=body,
+        request=httpx.Request(method, url),
+        extensions={"public_json": data["parsed"]} if parse_json else {},
+    )
+
+
+if __name__ == "__main__":
+    try:
+        args = json.load(sys.stdin)
+        sys.stdout.buffer.write(pickle.dumps(fetch_local(**args), protocol=5))
+    except Exception as exc:
+        print(type(exc).__name__ + ": " + str(exc)[:160])
+        sys.exit(1)
diff --git a/migrations/2026-10-03-03-lifecycle-snapshots.sql b/migrations/2026-10-03-03-lifecycle-snapshots.sql
new file mode 100644
index 0000000..112456a
--- /dev/null
+++ b/migrations/2026-10-03-03-lifecycle-snapshots.sql
@@ -0,0 +1,44 @@
+-- Task8 consumes prerequisite snapshot columns from migration01. No activation.
+BEGIN;
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['job_reviews','review_corrections','application_packages','generation_jobs','resume_scores','cover_letter_edits','job_payload_demands'] LOOP
+  IF (SELECT count(*) FROM pg_attribute WHERE attrelid=('public.'||t)::regclass
+    AND attname IN ('job_version_id','description_snapshot','questions_snapshot','snapshot_captured_at') AND NOT attisdropped) <> 4 THEN
+   RAISE EXCEPTION 'Task2 snapshot prerequisites missing for %',t;
+  END IF;
+  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_version_job_fk');
+  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_questions_shape');
+ END LOOP;
+END $$;
+-- Owner records consumption in the same transaction as successful private work;
+-- service workers apply corresponding shared-cache use stamps asynchronously.
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumption_applied_at timestamptz;
+GRANT UPDATE(consumed_at) ON job_payload_demands TO authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_stamp_consumption() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
+  IF OLD.status<>'ready' OR OLD.job_version_id IS NULL OR NULLIF(btrim(OLD.description_snapshot),'') IS NULL THEN
+   RAISE EXCEPTION 'consumption requires durable ready snapshot';
+  END IF;
+  NEW.consumed_at:=clock_timestamp();
+ END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_stamp_consumption() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS lifecycle_consumption_stamp ON job_payload_demands;
+CREATE TRIGGER lifecycle_consumption_stamp BEFORE UPDATE OF consumed_at ON job_payload_demands
+FOR EACH ROW EXECUTE FUNCTION lifecycle_stamp_consumption();
+CREATE TABLE IF NOT EXISTS lifecycle_writer_readiness (
+ writer text PRIMARY KEY, contract_version integer NOT NULL,
+ installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ validated_at timestamptz, notes text NOT NULL
+);
+REVOKE ALL ON lifecycle_writer_readiness FROM PUBLIC,anon,authenticated;
+ALTER TABLE lifecycle_writer_readiness ENABLE ROW LEVEL SECURITY;
+INSERT INTO lifecycle_writer_readiness(writer,contract_version,notes)
+VALUES ('demand_snapshots',1,'Prerequisite columns present; runtime writers require release verification. No activation granted.')
+ON CONFLICT(writer) DO NOTHING;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-03-lifecycle-snapshots.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/reviewer/db.py b/reviewer/db.py
index 6d2cbcf..af984d1 100644
--- a/reviewer/db.py
+++ b/reviewer/db.py
@@ -3,25 +3,26 @@ import uuid
 
 from psycopg.types.json import Json
 
 from reviewer import entitlements as _entitlements
 
 _REVIEW_COLUMNS = (
     "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
     "verdict", "experience_match", "industry", "industry_subcategory",
     "confidence", "reasoning", "model_stage1", "model_stage2", "error",
     "role_category", "seniority", "work_arrangement", "about",
+    "job_version_id", "description_snapshot", "questions_snapshot", "snapshot_captured_at",
     "pay_min", "pay_max", "pay_currency", "pay_period", "headcount",
     "skills_score", "experience_score", "comp_score", "fit_score",
     "red_flags", "skill_gaps", "benefits", "requirements",
 )
-_JSONB_COLUMNS = ("red_flags", "skill_gaps", "benefits", "requirements")
+_JSONB_COLUMNS = ("red_flags", "skill_gaps", "benefits", "requirements", "questions_snapshot")
 
 # Built once from the fixed column tuple (the row values are bound per call).
 # The WHERE guard makes a hand-set verdict sticky: once the operator denies a
 # job by hand (verdict='deny', human_override=TRUE), the AI's upsert is a no-op
 # and can never overwrite it.
 _UPSERT_REVIEW_SQL = (
     f"INSERT INTO job_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
     f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
     "ON CONFLICT (user_id, job_id) DO UPDATE SET\n"
     f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'job_id'))}"
@@ -258,20 +259,22 @@ def select_candidates(
     # 'Remote' (spec 2026-07-16: remote no longer bypasses the filter).
     prefs = preferred_locations or []
     exc = exclusions or {"industries": [], "countries": [], "sizes": [],
                          "red_flag_categories": []}
     _where = """
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
         LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
         LEFT JOIN company_overrides co ON co.company_id = c.id AND co.user_id = %(uid)s
         WHERE j.closed_at IS NULL
+          AND NOT EXISTS(SELECT FROM source_listings sl WHERE sl.job_id=j.id
+            AND sl.discovery_expires_at<=clock_timestamp())
           -- Deterministic company gate (pre-LLM). A per-user override wins both
           -- ways; otherwise a company is excluded when ANY of its classified
           -- facets is in the user's exclusion list. COALESCE(..., 'unknown')
           -- makes an unclassified NULL facet match a literal 'unknown' exclusion.
           AND (
             co.verdict = 'include'
             OR (
               COALESCE(co.verdict, '') <> 'exclude'
               AND NOT (COALESCE(c.industry, 'unknown') = ANY(%(exc_ind)s::text[]))
               AND NOT (COALESCE(c.size, 'unknown') = ANY(%(exc_size)s::text[]))
@@ -319,36 +322,49 @@ def select_candidates(
         rows = cur.fetchall()
     return rows, total
 
 
 
 def upsert_review(conn, row: dict) -> None:
     # Normalize to the full column set so callers may omit new keys; wrap JSONB.
     full = {c: row.get(c) for c in _REVIEW_COLUMNS}
     full["user_id"] = _uuid(full["user_id"])
     for c in _JSONB_COLUMNS:
-        full[c] = Json(full[c] if full[c] is not None else [])
-    with conn.cursor() as cur:
-        cur.execute(_UPSERT_REVIEW_SQL, full)
+        full[c] = None if c == "questions_snapshot" and full[c] is None else Json(full[c] if full[c] is not None else [])
+    if row.get('job_version_id'):
+        from job_discovery.lifecycle.claims import claim_work
+        from job_discovery.lifecycle.reconcile import _write
+        claim = claim_work(conn, 'review_write', str(uuid.uuid4()), 180)
+        if claim is None:
+            raise RuntimeError('review write capacity unavailable')
+        with _write(conn, claim, 'job_reviews', row['job_id'], size=8192+8*len(str(row).encode())):
+            conn.execute(_UPSERT_REVIEW_SQL, full)
+        if row.get('verdict') and not row.get('error'):
+            conn.execute("""UPDATE job_payload_demands SET consumed_at=clock_timestamp()
+                WHERE user_id=%s AND job_id=%s AND job_version_id=%s AND kind='review' AND status='ready'""",
+                (full['user_id'],row['job_id'],row['job_version_id']))
+    else:
+        with conn.cursor() as cur:
+            cur.execute(_UPSERT_REVIEW_SQL, full)
 
 
 def recent_stage2_reviews(conn, limit: int) -> list[dict]:
     """Return up to `limit` recent stage-2 reviews joined with job and profile data.
 
     Only rows that completed stage 2 (verdict IS NOT NULL, stage1_decision = 'pass')
     are included.  Results are ordered newest-first so the freshest golden examples
     are used when seeding a dataset.
     """
     with conn.cursor() as cur:
         cur.execute(
             """
-            SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.location, c.ats, j.description,
+            SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.location, c.ats, COALESCE(r.description_snapshot,j.description) AS description,
                    p.resume_text, p.instructions, r.verdict
             FROM job_reviews r
             JOIN jobs j ON j.id = r.job_id
             JOIN companies c ON c.id = j.company_id
             JOIN profiles p ON p.user_id = r.user_id
             WHERE r.verdict IS NOT NULL
               AND r.stage1_decision = 'pass'
             ORDER BY r.reviewed_at DESC
             LIMIT %s
             """,
@@ -494,10 +510,24 @@ def golden_corrections(conn) -> list[dict]:
                    rc.skills_score, rc.experience_score, rc.comp_score,
                    rc.note, rc.corrected_at
             FROM review_corrections rc
             JOIN jobs j ON j.id = rc.job_id
             JOIN companies c ON c.id = j.company_id
             JOIN profiles p ON p.user_id = rc.user_id
             ORDER BY rc.corrected_at DESC
             """
         )
         return cur.fetchall()
+
+
+def attach_demand_snapshots(conn, candidates, user_id):
+    from job_discovery.lifecycle.config import read_control
+    if not read_control(conn).hydration_enabled:
+        return candidates
+    result = []
+    for candidate in candidates:
+        row = conn.execute("""SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at
+            FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind='review' AND status='ready'
+            ORDER BY settled_at DESC LIMIT 1""", (_uuid(user_id),candidate['id'])).fetchone()
+        if row and row['job_version_id'] and row['description_snapshot']:
+            result.append({**candidate, **row, 'description': row['description_snapshot']})
+    return result
diff --git a/reviewer/run.py b/reviewer/run.py
index ec8cb45..efcbf6c 100644
--- a/reviewer/run.py
+++ b/reviewer/run.py
@@ -41,20 +41,24 @@ def _persist_rows(conn, rows: list[dict], chunk_size: int = 20) -> None:
             continue
         if (i + 1) % chunk_size == 0:
             conn.commit()
             needs_gate = True
     conn.commit()  # final commit for the tail
 
 
 @dataclass
 class ReviewResult:
     job_id: str
+    job_version_id: object = None
+    description_snapshot: str | None = None
+    questions_snapshot: object = None
+    snapshot_captured_at: object = None
     stage1_decision: str | None = None
     stage1_reason: str | None = None
     verdict: str | None = None
     experience_match: str | None = None
     industry: str | None = None
     industry_subcategory: str | None = None
     confidence: str | None = None
     reasoning: str | None = None
     model_stage1: str | None = None
     model_stage2: str | None = None
@@ -145,20 +149,22 @@ async def _stage2_inner(candidate: dict, profile_block: str, client,
     except Exception as exc:  # per-job isolation (spec §3)
         if _is_out_of_credits(exc):
             raise OutOfCreditsError(str(exc)) from exc
         res.error = f"{type(exc).__name__}: {exc}"
         log.warning("review failed for %s: %s", candidate["id"], res.error)
     return res
 
 
 async def _review_one_inner(candidate: dict, profile_block: str, client) -> ReviewResult:
     res = ReviewResult(job_id=candidate["id"])
+    if not isinstance(candidate.get("description"), str) or not candidate["description"].strip():
+        return res
     try:
         s1 = await client.stage1(
             profile_block=profile_block, title=candidate["title"],
             company=candidate["company_name"], location=candidate.get("location"),
         )
         res.model_stage1 = client.model_stage1
         res.stage1_decision = s1.decision
         res.stage1_reason = s1.reason
     except OutOfCreditsError:
         raise
@@ -239,20 +245,21 @@ async def review_batch(candidates: list[dict], profile_block: str, client,
     Halt semantics: a spend-block in chunk k breaks the loop — chunks 0..k-1 are fully emitted,
     chunk k emits only its terminal results (completed stage-2 + rejects + errors), and
     chunks k+1.. are never stage-1'd (no rows, retryable).
 
     deleted_check, when supplied, is a cheap predicate polled ONCE per stage-1 chunk (and
     once before each chunk's stage-2 fan-out) — not once per row. If it returns True the
     user was deleted mid-run, so the batch halts early: no further LLM calls are issued
     and remaining jobs stay retryable (no rows). The caller re-checks the tombstone at its
     write boundary and skips all writes.
     """
+    candidates = [c for c in candidates if isinstance(c.get("description"), str) and c["description"].strip()]
     halt = asyncio.Event()
     results: list[ReviewResult] = []
     # ONE semaphore per run, shared across chunks: chunks serialize, but peak in-flight
     # stage-2 LLM calls stay bounded by `concurrency` exactly as the non-streamed shape.
     sem = asyncio.Semaphore(concurrency)
 
     async def _run_stage2(candidate: dict, res: ReviewResult) -> ReviewResult | None:
         if halt.is_set():
             return None  # skipped: stay retryable (no row written)
         async with sem:
@@ -265,20 +272,25 @@ async def review_batch(candidates: list[dict], profile_block: str, client,
                     user_id=user_id, run_id=run_id,
                 )
             except OutOfCreditsError:
                 halt.set()
                 return None
 
     def _emit(chunk_results: list[ReviewResult]) -> None:
         # Accumulate then hand THIS chunk's terminal results to the caller. The extend
         # keeps `results` == concat(emitted chunks); the callback fires only for a
         # non-empty chunk so an all-deferred/halted chunk emits nothing.
+        by_id = {c['id']: c for c in candidates}
+        for result in chunk_results:
+            source = by_id[result.job_id]
+            for snapshot_field in ('job_version_id','description_snapshot','questions_snapshot','snapshot_captured_at'):
+                setattr(result, snapshot_field, source.get(snapshot_field))
         results.extend(chunk_results)
         if on_results is not None and chunk_results:
             on_results(chunk_results)
 
     for start in range(0, len(candidates), config.STAGE1_BATCH_SIZE):
         if halt.is_set():
             break
         if deleted_check is not None and deleted_check():
             log.info("user deleted mid-run; aborting stage-1 gate before further LLM calls")
             halt.set()
@@ -446,20 +458,25 @@ def _review_user(conn, profile: dict, ent: dict | None = None,
 
         # Deterministic company exclusion gate (pre-LLM): the user's structured
         # company_exclusions (facets) + per-user company_overrides, applied inside
         # select_candidates so facet/override-excluded companies never cost an LLM call.
         exclusions = db.parse_company_exclusions(profile.get("company_exclusions"))
         candidates, total = db.select_candidates(
             conn, user_id, pv, remaining,
             preferred_locations=profile.get("preferred_locations"),
             exclusions=exclusions,
         )
+        from job_discovery.lifecycle.demand import hydrate_candidates
+        ready_ids = set(hydrate_candidates(conn, [c["id"] for c in candidates], user_id))
+        candidates = [c for c in candidates if c["id"] in ready_ids]
+        candidates = db.attach_demand_snapshots(conn, candidates, user_id)
+        conn.commit()
         overflow = total - len(candidates)
         if overflow > 0:
             notes = f"overflow: {overflow} job(s) deferred to next run"
             log.info("review overflow: %s job(s) over remaining budget %s, deferred",
                      overflow, remaining)
 
         profile_block = build_profile_block(
             profile["resume_text"], profile["instructions"],
             company_instructions=profile.get("company_instructions"),
         )
diff --git a/reviewer/worker.py b/reviewer/worker.py
index 6b6f490..7e78e40 100644
--- a/reviewer/worker.py
+++ b/reviewer/worker.py
@@ -61,20 +61,22 @@ class _Stop:
         if self.deadline is None:
             self.deadline = time.monotonic() + DRAIN_SECONDS
         self.stop = True
 
 
 def process_one(conn) -> bool:
     """Recover stale claims, then claim + process one pending request. Returns True if
     a request was handled (caller should poll again immediately), False if the queue
     was empty (caller should sleep). Per-request isolation: any failure is recorded on
     the request row and never propagates out of this function."""
+    from job_discovery.lifecycle.demand import process_pending
+    process_pending(conn)
     recovered = db.recover_stale_review_requests(
         conn, STALE_MINUTES, exclude_ids=_in_flight_snapshot()
     )
     if recovered:
         log.warning("recovered %s stale 'running' request(s)", recovered)
     conn.commit()
 
     claimed = db.claim_next_review_request(conn)
     conn.commit()
     if not claimed:
diff --git a/schema.sql b/schema.sql
index 8462574..1091d3d 100644
--- a/schema.sql
+++ b/schema.sql
@@ -2147,10 +2147,53 @@ BEGIN
     END IF;
    END IF;
   END IF;
  END IF;
  INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
  VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-source-reconciliation.sql') ON CONFLICT DO NOTHING;
+
+-- Task8 consumes prerequisite snapshot columns from migration01. No activation.
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['job_reviews','review_corrections','application_packages','generation_jobs','resume_scores','cover_letter_edits','job_payload_demands'] LOOP
+  IF (SELECT count(*) FROM pg_attribute WHERE attrelid=('public.'||t)::regclass
+    AND attname IN ('job_version_id','description_snapshot','questions_snapshot','snapshot_captured_at') AND NOT attisdropped) <> 4 THEN
+   RAISE EXCEPTION 'Task2 snapshot prerequisites missing for %',t;
+  END IF;
+  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_version_job_fk');
+  EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_questions_shape');
+ END LOOP;
+END $$;
+-- Owner records consumption in the same transaction as successful private work;
+-- service workers apply corresponding shared-cache use stamps asynchronously.
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS consumption_applied_at timestamptz;
+GRANT UPDATE(consumed_at) ON job_payload_demands TO authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_stamp_consumption() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
+  IF OLD.status<>'ready' OR OLD.job_version_id IS NULL OR NULLIF(btrim(OLD.description_snapshot),'') IS NULL THEN
+   RAISE EXCEPTION 'consumption requires durable ready snapshot';
+  END IF;
+  NEW.consumed_at:=clock_timestamp();
+ END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_stamp_consumption() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS lifecycle_consumption_stamp ON job_payload_demands;
+CREATE TRIGGER lifecycle_consumption_stamp BEFORE UPDATE OF consumed_at ON job_payload_demands
+FOR EACH ROW EXECUTE FUNCTION lifecycle_stamp_consumption();
+CREATE TABLE IF NOT EXISTS lifecycle_writer_readiness (
+ writer text PRIMARY KEY, contract_version integer NOT NULL,
+ installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ validated_at timestamptz, notes text NOT NULL
+);
+REVOKE ALL ON lifecycle_writer_readiness FROM PUBLIC,anon,authenticated;
+ALTER TABLE lifecycle_writer_readiness ENABLE ROW LEVEL SECURITY;
+INSERT INTO lifecycle_writer_readiness(writer,contract_version,notes)
+VALUES ('demand_snapshots',1,'Prerequisite columns present; runtime writers require release verification. No activation granted.')
+ON CONFLICT(writer) DO NOTHING;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-03-lifecycle-snapshots.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_http.py b/tests/test_http.py
index b056fc5..0f5d7c8 100644
--- a/tests/test_http.py
+++ b/tests/test_http.py
@@ -110,34 +110,34 @@ def test_client_is_reused(monkeypatch):
     monkeypatch.setattr(http_mod._client, "request", fake_request)
     get_json("https://a")
     get_json("https://b")
     # Both calls used the same client (same id).
     assert len(clients_used) == 2
     assert clients_used[0] == clients_used[1]
 
 
 def test_redirects_followed(monkeypatch):
     """The shared client must follow redirects (follow_redirects=True is configured)."""
-    assert http_mod._client.follow_redirects is True
+    assert http_mod._client.follow_redirects is False  # bounded transport owns each hop
     # Functional test: a 301 followed by a 200 resolves to the final payload.
     calls = {"n": 0}
 
     def fake_request(method, url, **kw):
         calls["n"] += 1
         # httpx.Client with follow_redirects=True handles redirects internally;
         # from the caller's perspective this always returns the final response.
         return _Resp({"redirected": True})
 
     monkeypatch.setattr(http_mod._client, "request", fake_request)
     assert get_json("https://x") == {"redirected": True}
     # The client's follow_redirects flag is set (not just the test being trivial).
-    assert http_mod._client.follow_redirects is True
+    assert http_mod._client.follow_redirects is False  # bounded transport owns each hop
 
 
 def test_get_text_returns_body(monkeypatch):
     monkeypatch.setattr(http_mod._client, "request",
                         lambda method, url, **kw: _Resp(None, text="<title>X</title>"))
     assert get_text("https://x") == "<title>X</title>"
 
 
 def test_get_text_retries_then_succeeds(monkeypatch):
     calls = {"n": 0}
diff --git a/tests/test_lifecycle_demand.py b/tests/test_lifecycle_demand.py
new file mode 100644
index 0000000..6f9c8fd
--- /dev/null
+++ b/tests/test_lifecycle_demand.py
@@ -0,0 +1,384 @@
+"""Ordinary demand hydration contracts; not an independent mechanism review."""
+
+import asyncio
+from uuid import uuid4
+from unittest.mock import AsyncMock
+
+from job_discovery.lifecycle.demand import (
+    parse_payload,
+    fetch_payload,
+    request_demand,
+    hydrate_demand,
+)
+from reviewer.run import review_batch, review_one
+from tests.conftest import requires_db
+from tests.test_lifecycle_reconcile import setup_source
+
+
+def test_total_payload_parser():
+    for raw in [None, [], "x", {"description": 3}, {"description": " "}]:
+        assert parse_payload(raw) is None
+    assert parse_payload({"description": " JD ", "questions": False}) == {
+        "description": "JD",
+        "questions": None,
+    }
+
+
+def test_missing_description_has_zero_model_calls():
+    client = AsyncMock()
+    candidate = {
+        "id": "x",
+        "title": "Role",
+        "company_name": "Acme",
+        "description": None,
+    }
+    assert asyncio.run(review_one(candidate, "", client)).verdict is None
+    assert asyncio.run(review_batch([candidate], "", client, 1)) == ([], False)
+    assert client.mock_calls == []
+
+
+def test_exact_stored_coordinates_and_total_detail(monkeypatch):
+    calls = []
+
+    def fetch(url):
+        calls.append(url)
+        return {"id": 123, "content": "<p>JD</p>", "questions": []}
+
+    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", fetch)
+    assert (
+        fetch_payload(
+            {"ats": "greenhouse", "public_board_ref": "acme", "external_id": "123"}
+        )["description"]
+        == "JD"
+    )
+    assert calls == [
+        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/123?questions=true"
+    ]
+    for bad in ["../acme", "https://evil.test", "acme?x=1"]:
+        assert (
+            fetch_payload(
+                {"ats": "greenhouse", "public_board_ref": bad, "external_id": "123"}
+            )
+            is None
+        )
+
+
+@requires_db
+def test_demand_ready_is_durable_and_fetch_is_outside_transaction(conn):
+    setup_source(conn)
+    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
+    user = str(uuid4())
+    demand = request_demand(conn, job, user, "review")
+    conn.commit()
+    assert request_demand(conn, job, user, "review").id == demand.id
+    conn.commit()
+
+    def fetch(coordinates):
+        assert conn.info.transaction_status.name == "IDLE"
+        return {"description": "Demand JD", "questions": {"questions": []}}
+
+    assert hydrate_demand(conn, demand, fetch) == "ready"
+    row = conn.execute(
+        "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
+    ).fetchone()
+    assert row["job_version_id"] is not None
+    assert row["description_snapshot"] == "Demand JD"
+    assert (
+        conn.execute(
+            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
+        ).fetchone()["description_last_used_at"]
+        is None
+    )
+    assert (
+        hydrate_demand(
+            conn,
+            demand,
+            lambda _: (_ for _ in ()).throw(AssertionError("must reuse durable ready")),
+        )
+        == "ready"
+    )
+
+
+@requires_db
+def test_failed_fetch_defers_without_version(conn):
+    setup_source(conn)
+    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
+    demand = request_demand(conn, job, str(uuid4()), "prepare")
+    conn.commit()
+
+    def failure(_):
+        raise ValueError("offline fetch unavailable")
+
+    assert hydrate_demand(conn, demand, failure) == "deferred"
+    row = conn.execute(
+        "SELECT status,job_version_id FROM job_payload_demands WHERE id=%s",
+        (demand.id,),
+    ).fetchone()
+    assert row == {"status": "deferred", "job_version_id": None}
+
+
+@requires_db
+def test_direct_older_live_demand_and_immutable_snapshot(conn):
+    from job_discovery.lifecycle.identity import migrate_identity_batch
+
+    cid = conn.execute(
+        "INSERT INTO companies(name,ats,token) VALUES ('Old','lever','old') RETURNING id"
+    ).fetchone()["id"]
+    job = "lever:old:1"
+    conn.execute(
+        "INSERT INTO jobs(id,company_id,external_id,title,url,first_seen_at) VALUES(%s,%s,'1','Old live','https://example.test/job',clock_timestamp()-interval '31 days')",
+        (job, cid),
+    )
+    migrate_identity_batch(conn)
+    demand = request_demand(conn, job, str(uuid4()), "description")
+    conn.commit()
+    assert (
+        hydrate_demand(conn, demand, lambda _: {"description": "Original JD"})
+        == "ready"
+    )
+    before = conn.execute(
+        "SELECT job_version_id,description_snapshot FROM job_payload_demands WHERE id=%s",
+        (demand.id,),
+    ).fetchone()
+    conn.execute(
+        "UPDATE jobs SET description='A later source description' WHERE id=%s", (job,)
+    )
+    conn.commit()
+    assert (
+        conn.execute(
+            "SELECT job_version_id,description_snapshot FROM job_payload_demands WHERE id=%s",
+            (demand.id,),
+        ).fetchone()
+        == before
+    )
+
+
+@requires_db
+def test_source_change_during_fetch_defers_stale_completion(conn):
+    from job_discovery.lifecycle.claims import claim_work
+    from job_discovery.lifecycle.identity import capture_version
+
+    setup_source(conn)
+    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
+    demand = request_demand(conn, job, str(uuid4()), "description")
+    conn.commit()
+
+    def fetch(coordinates):
+        claim = claim_work(conn, "source_update", str(uuid4()), 180)
+        capture_version(
+            conn,
+            coordinates["listing_id"],
+            {"title": "New title", "url": "https://example.test/job"},
+            conn.execute("SELECT clock_timestamp() n").fetchone()["n"],
+            claim,
+        )
+        conn.commit()
+        return {"description": "stale input"}
+
+    assert hydrate_demand(conn, demand, fetch) == "deferred"
+    assert (
+        conn.execute(
+            "SELECT description_snapshot FROM job_payload_demands WHERE id=%s",
+            (demand.id,),
+        ).fetchone()["description_snapshot"]
+        is None
+    )
+
+
+@requires_db
+def test_consumption_stamps_only_successful_exact_payload(conn):
+    from job_discovery.lifecycle.demand import apply_consumptions
+
+    setup_source(conn)
+    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
+    demand = request_demand(conn, job, str(uuid4()), "description")
+    conn.commit()
+    assert hydrate_demand(conn, demand, lambda _: {"description": "JD"}) == "ready"
+    assert apply_consumptions(conn) == 0
+    assert (
+        conn.execute(
+            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
+        ).fetchone()["description_last_used_at"]
+        is None
+    )
+    conn.execute(
+        "UPDATE job_payload_demands SET consumed_at=clock_timestamp() WHERE id=%s",
+        (demand.id,),
+    )
+    conn.commit()
+    assert apply_consumptions(conn) == 1
+    assert (
+        conn.execute(
+            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
+        ).fetchone()["description_last_used_at"]
+        is not None
+    )
+
+
+@requires_db
+def test_cancelled_own_demand_does_not_get_late_snapshot(conn):
+    from job_discovery.lifecycle.claims import cancel_claim
+    from job_discovery.lifecycle.types import ClaimRef
+
+    setup_source(conn)
+    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
+    demand = request_demand(conn, job, str(uuid4()), "description")
+    conn.commit()
+
+    def fetch(_):
+        row = conn.execute(
+            "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
+        ).fetchone()
+        cancel_claim(
+            conn,
+            ClaimRef(
+                row["claim_owner_token"], row["claim_generation"], row["lease_until"]
+            ),
+        )
+        conn.execute(
+            "UPDATE job_payload_demands SET status='cancelled' WHERE id=%s",
+            (demand.id,),
+        )
+        conn.commit()
+        return {"description": "late"}
+
+    assert hydrate_demand(conn, demand, fetch) == "deferred"
+    assert conn.execute(
+        "SELECT status,description_snapshot FROM job_payload_demands WHERE id=%s",
+        (demand.id,),
+    ).fetchone() == {"status": "cancelled", "description_snapshot": None}
+
+
+@requires_db
+def test_filtered_candidates_hydrate_before_review_and_persist_exact_input(
+    conn, monkeypatch
+):
+    from job_discovery.lifecycle.demand import hydrate_candidates
+    from reviewer import db
+    from tests.test_reviewer_run import StubClient
+
+    setup_source(conn, count=2)
+    jobs = [r["id"] for r in conn.execute("SELECT id FROM jobs ORDER BY id")]
+    conn.execute("UPDATE jobs SET location='Elsewhere',remote=false")
+    conn.execute(
+        "UPDATE jobs SET location='Remote',remote=true WHERE id=%s", (jobs[0],)
+    )
+    conn.execute(
+        "UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1"
+    )
+    conn.commit()
+    user = str(uuid4())
+    candidates, total = db.select_candidates(
+        conn, user, "profile", 10, preferred_locations=["Remote"]
+    )
+    assert total == 1 and candidates[0]["id"] == jobs[0]
+    fetched = []
+
+    def get(url):
+        fetched.append(url)
+        return {"id": "0", "descriptionPlain": "Actual JD"}
+
+    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", get)
+    assert hydrate_candidates(conn, [r["id"] for r in candidates], user) == [jobs[0]]
+    assert len(fetched) == 1 and fetched[0].endswith("/0?mode=json")
+    candidates = db.attach_demand_snapshots(conn, candidates, user)
+    conn.commit()
+    client = StubClient()
+    results, halted = asyncio.run(review_batch(candidates, "profile", client, 1))
+    assert not halted and client.stage2_calls == ["Actual JD"]
+    db.upsert_review(conn, results[0].as_row(user_id=user, profile_version="profile"))
+    conn.commit()
+    row = conn.execute(
+        "SELECT job_version_id,description_snapshot FROM job_reviews WHERE user_id=%s",
+        (user,),
+    ).fetchone()
+    assert row["job_version_id"] == candidates[0]["job_version_id"]
+    assert row["description_snapshot"] == "Actual JD"
+    assert (
+        conn.execute(
+            "SELECT consumed_at FROM job_payload_demands WHERE user_id=%s", (user,)
+        ).fetchone()["consumed_at"]
+        is not None
+    )
+
+
+@requires_db
+def test_flag_off_prepare_missing_questions_worker_reaches_durable_ready(
+    conn, monkeypatch
+):
+    from job_discovery import db as job_db
+    from job_discovery.models import Posting
+    from job_discovery.lifecycle.demand import process_pending
+
+    cid = conn.execute(
+        "INSERT INTO companies(name,ats,token) VALUES('Legacy','greenhouse','legacy') RETURNING id"
+    ).fetchone()["id"]
+    job = "greenhouse:legacy:1"
+    job_db.upsert_jobs(
+        conn,
+        cid,
+        "greenhouse",
+        "legacy",
+        [
+            Posting(
+                "1", "Role", "https://example.test/job", raw={"content": "Legacy JD"}
+            )
+        ],
+    )
+    conn.commit()
+    assert (
+        conn.execute("SELECT * FROM source_listings WHERE job_id=%s", (job,)).fetchone()
+        is None
+    )
+    assert (
+        conn.execute("SELECT hydration_enabled FROM lifecycle_control").fetchone()[
+            "hydration_enabled"
+        ]
+        is False
+    )
+    assert (
+        conn.execute("SELECT * FROM job_questions WHERE job_id=%s", (job,)).fetchone()
+        is None
+    )
+    demand = request_demand(conn, job, str(uuid4()), "prepare")
+    conn.commit()
+    fetched = []
+
+    def get(url):
+        assert conn.info.transaction_status.name == "IDLE"
+        fetched.append(url)
+        return {
+            "id": 1,
+            "content": "Complete JD",
+            "questions": [
+                {"label": "Name", "fields": [{"name": "name", "type": "input_text"}]}
+            ],
+        }
+
+    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", get)
+    assert process_pending(conn) == 1
+    assert fetched == [
+        "https://boards-api.greenhouse.io/v1/boards/legacy/jobs/1?questions=true"
+    ]
+    row = conn.execute(
+        "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
+    ).fetchone()
+    assert row["status"] == "ready" and row["job_version_id"] is not None
+    assert (
+        conn.execute("SELECT * FROM source_listings WHERE job_id=%s", (job,)).fetchone()
+        is not None
+    )
+    assert (
+        row["description_snapshot"] == "Complete JD"
+        and row["questions_snapshot"]["questions"][0]["label"] == "Name"
+    )
+    assert row["consumed_at"] is None
+    # Sticky cutover never restores the compatibility worker when flags are off.
+    conn.execute(
+        "UPDATE lifecycle_maintenance_state SET cutover_at=clock_timestamp() WHERE singleton"
+    )
+    conn.commit()
+    request_demand(conn, job, str(uuid4()), "prepare")
+    conn.commit()
+    assert process_pending(conn) == 0
+    assert len(fetched) == 1
diff --git a/tests/test_public_fetch.py b/tests/test_public_fetch.py
new file mode 100644
index 0000000..e3a4a02
--- /dev/null
+++ b/tests/test_public_fetch.py
@@ -0,0 +1,205 @@
+"""Offline normal bounded public-transport behavior, no live network."""
+
+import gzip
+import io
+import subprocess
+
+import httpx
+import pytest
+
+from job_discovery import public_fetch as p
+
+
+class Response:
+    def __init__(self, body=b"{}", status=200, headers=None):
+        self.status = status
+        self.headers = headers or {"Content-Type": "application/json"}
+        self.body = io.BytesIO(body)
+
+    def getheader(self, key):
+        return self.headers.get(key)
+
+    def read(self, size):
+        return self.body.read(size)
+
+
+def transport(responses):
+    calls = []
+
+    class Connection:
+        sock = None
+
+        def __init__(self, host, port, address, secure, timeout):
+            calls.append({"host": host, "address": address, "timeout": timeout})
+
+        def request(self, method, path, body=None, headers=None):
+            calls[-1].update(method=method, path=path, headers=headers, body=body)
+
+        def getresponse(self):
+            return responses.pop(0)
+
+        def close(self):
+            pass
+
+    return Connection, calls
+
+
+def test_redirect_revalidates_and_strips_credentials():
+    connection, calls = transport(
+        [
+            Response(
+                status=302, headers={"Location": "https://user:secret@next.example/job"}
+            ),
+            Response(),
+        ]
+    )
+    resolved = []
+
+    def resolve(host, port):
+        resolved.append(host)
+        return "8.8.8.8"
+
+    p.fetch_local(
+        "GET",
+        "https://user:secret@first.example/job",
+        None,
+        20,
+        resolve=resolve,
+        connection=connection,
+    )
+    assert resolved == ["first.example", "next.example"]
+    assert all(call["address"] == "8.8.8.8" for call in calls)
+    assert all(
+        not {"Authorization", "Cookie", "Proxy-Authorization"} & call["headers"].keys()
+        for call in calls
+    )
+
+
+def test_redirect_private_resolution_is_rejected(monkeypatch):
+    def addresses(host, port, **_):
+        return [
+            (
+                2,
+                1,
+                6,
+                "",
+                ("127.0.0.1" if host == "private.example" else "8.8.8.8", port),
+            )
+        ]
+
+    monkeypatch.setattr(p.socket, "getaddrinfo", addresses)
+    conn, calls = transport(
+        [Response(status=302, headers={"Location": "http://private.example/x"})]
+    )
+    with pytest.raises(ValueError, match="globally routable"):
+        p.fetch_local(
+            "GET",
+            "https://public.example/x",
+            None,
+            20,
+            resolve=p.public_address,
+            connection=conn,
+        )
+    assert len(calls) == 1
+
+
+def test_redirect_limit_and_rebinding_validation(monkeypatch):
+    conn, calls = transport(
+        [Response(status=302, headers={"Location": "/again"}) for _ in range(4)]
+    )
+    with pytest.raises(ValueError, match="redirect limit"):
+        p.fetch_local(
+            "GET",
+            "https://example.test/",
+            None,
+            20,
+            resolve=lambda *_: "8.8.8.8",
+            connection=conn,
+        )
+    assert len(calls) == 4
+    answers = iter(["8.8.8.8", "127.0.0.1"])
+    monkeypatch.setattr(
+        p.socket,
+        "getaddrinfo",
+        lambda host, port, **_: [(2, 1, 6, "", (next(answers), port))],
+    )
+    conn, calls = transport([Response(status=302, headers={"Location": "/again"})])
+    with pytest.raises(ValueError, match="globally routable"):
+        p.fetch_local(
+            "GET",
+            "https://same.example/",
+            None,
+            20,
+            resolve=p.public_address,
+            connection=conn,
+        )
+    assert len(calls) == 1
+
+
+@pytest.mark.parametrize(
+    "body,headers",
+    [
+        (b"x" * (p.MAX_BYTES + 1), {"Content-Type": "text/plain"}),
+        (
+            gzip.compress(b"x" * (p.MAX_BYTES + 1)),
+            {"Content-Type": "text/plain", "Content-Encoding": "gzip"},
+        ),
+        (b"{}", {"Content-Type": "application/octet-stream"}),
+    ],
+)
+def test_body_and_type_limits(body, headers):
+    conn, _ = transport([Response(body, headers=headers)])
+    with pytest.raises(ValueError):
+        p.fetch_local(
+            "GET",
+            "https://example.test/",
+            None,
+            20,
+            resolve=lambda *_: "8.8.8.8",
+            connection=conn,
+        )
+
+
+def test_hard_deadline_includes_resolver_and_parsing(monkeypatch):
+    def timeout(*args, **kwargs):
+        assert kwargs["timeout"] == 20
+        raise subprocess.TimeoutExpired(args[0], 20)
+
+    monkeypatch.setattr(p.subprocess, "run", timeout)
+    with pytest.raises(httpx.TimeoutException):
+        p.request("GET", "https://example.test", timeout=60)
+
+
+def test_only_readonly_workday_search_post():
+    conn, calls = transport([Response()])
+    p.fetch_local(
+        "POST",
+        "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/site/jobs",
+        {"limit": 20},
+        20,
+        resolve=lambda *_: "8.8.8.8",
+        connection=conn,
+    )
+    assert calls[0]["method"] == "POST"
+    with pytest.raises(ValueError, match="approved readonly"):
+        p.fetch_local(
+            "POST",
+            "https://apply.example/jobs",
+            {},
+            20,
+            resolve=lambda *_: "8.8.8.8",
+            connection=conn,
+        )
+
+
+def test_http_error_status_does_not_require_a_json_error_body():
+    conn, _ = transport([Response(b"<html>not found</html>", status=404)])
+    response = p.fetch_local(
+        "GET",
+        "https://example.test/",
+        None,
+        20,
+        resolve=lambda *_: "8.8.8.8",
+        connection=conn,
+    )
+    assert response["status"] == 404 and response["body"] == b""
diff --git a/tests/test_reviewer_run.py b/tests/test_reviewer_run.py
index daf326e..9c1b8c7 100644
--- a/tests/test_reviewer_run.py
+++ b/tests/test_reviewer_run.py
@@ -48,25 +48,25 @@ class StubClient:
 
 
 def _cand(title, ats="lever", description="jd", **extra):
     # **extra lets a test add candidate keys the SELECT now carries (e.g. remote);
     # omitting `remote` leaves the key absent so the defensive `.get` path is exercised.
     return {"id": f"lever:acme:{title}", "title": title, "location": "Remote",
             "ats": ats, "company_name": "Acme", "description": description, **extra}
 
 
 def test_missing_jd_skips_stage2_and_writes_no_row():
-    """When stage-1 passes but description is NULL/empty, stage-2 must NOT run."""
+    """A missing description defers before either model stage."""
     client = StubClient()
     res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
-    # stage1 passed (SRE is not a forklift operator), but JD is None
-    assert res.stage1_decision == "pass"
+    # No provider is called without the description.
+    assert res.stage1_decision is None
     # stage2 must NOT run — no verdict, no row
     assert res.verdict is None
     assert client.stage2_calls == []
     assert res.error is None  # not an error; deferred
 
 
 def test_gate_reject_skips_stage2():
     client = StubClient()
     res = asyncio.run(review_one(_cand("Forklift Operator"), "P", client))
     assert res.stage1_decision == "reject"
@@ -103,21 +103,21 @@ def test_stage2_floors_seniority_from_title_ladder_word():
     the write-time floor recovers it (plan J2)."""
     client = StubClient()
     res = asyncio.run(review_one(_cand("Senior SRE"), "P", client))
     assert res.seniority == "senior"
 
 
 def test_pass_with_missing_jd_defers_stage2():
     """When stage-1 passes but JD is absent, stage-2 is deferred (not run with a placeholder)."""
     client = StubClient()
     res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
-    assert res.stage1_decision == "pass"
+    assert res.stage1_decision is None
     assert res.verdict is None   # deferred — no fabricated score
     assert client.stage2_calls == []  # stage2 must NOT be called
 
 
 def test_stage1_error_isolated():
     client = StubClient()
     res = asyncio.run(review_one(_cand("BOOM1"), "P", client))
     assert res.error is not None and "stage1 down" in res.error
     assert res.stage1_decision is None
 
