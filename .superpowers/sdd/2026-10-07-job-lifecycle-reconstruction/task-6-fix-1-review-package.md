# Full pinned review package

BASE: db73ad7365790419c4a1a82ec38ae21e4c7233c3

HEAD: 72329abf6d1cf9832fb72d7c30ed2f3c22081b14

## Commits

72329abf6d1cf9832fb72d7c30ed2f3c22081b14 fix: resume source reconciliation and preserve partial feed positives
3becce011c7b8cd2dde61d0fc9177ce54c82581a docs: record task six review recovery Library ID
966fc386f8c05a874da9be5bba1a0aa18a6f2e10 docs: preserve task six review and recovery rulings


## Files

 .../CHECKPOINTS.md                                 |    4 +
 .../controller-resume.md                           |   22 +
 .../progress.md                                    |   22 +
 .../task-10-author-dispatch.md                     |   13 +
 .../task-11-author-dispatch.md                     |   13 +
 .../task-12-author-dispatch.md                     |   11 +
 .../task-13-author-dispatch.md                     |    6 +
 .../task-6-evidence/commands.txt                   |   30 +
 .../task-6-evidence/fix1-all-families-16.txt       |    4 +
 .../task-6-evidence/fix1-completed-cleanup-16.txt  |    3 +
 .../task-6-evidence/fix1-completed-cleanup-17.txt  |    3 +
 .../task-6-evidence/fix1-final-17.txt              |    4 +
 .../task-6-evidence/fix1-focused-16.txt            |    4 +
 .../task-6-evidence/fix1-focused-17.txt            |    4 +
 .../task-6-evidence/fix1-green-17.txt              |    3 +
 .../task-6-evidence/fix1-other-families-17.txt     |    4 +
 .../task-6-evidence/fix1-other-families-red-17.txt |  178 ++
 .../task-6-evidence/fix1-red-17.txt                |  337 +++
 .../task-6-evidence/fix1-restart-red-17.txt        |  124 +
 .../task-6-evidence/fix1-ruff.txt                  |    1 +
 .../task-6-evidence/fix1-shared-helper-17.txt      |    3 +
 .../task-6-report.md                               |  171 ++
 .../task-6-requirements-review.md                  |  108 +
 .../task-6-review-package.md                       | 2793 ++++++++++++++++++++
 .../task-6-reviewer-dispatch.md                    |   13 +
 .../task-7-author-dispatch.md                      |    2 +
 .../task-8-author-dispatch.md                      |   10 +
 .../task-9-author-dispatch.md                      |    2 +
 job_discovery/adapters/ashby.py                    |    8 +-
 job_discovery/adapters/completeness.py             |   39 +
 job_discovery/adapters/greenhouse.py               |   17 +-
 job_discovery/adapters/lever.py                    |    8 +-
 job_discovery/adapters/smartrecruiters.py          |    4 +-
 job_discovery/adapters/workable.py                 |   28 +-
 job_discovery/adapters/workday.py                  |   36 +-
 job_discovery/lifecycle/reconcile.py               |  130 +-
 migrations/2026-10-03-02-source-reconciliation.sql |   57 +
 schema.sql                                         |   58 +
 tests/test_lifecycle_maintenance.py                |    9 +-
 tests/test_lifecycle_reconcile.py                  |  171 +-
 tests/test_source_completeness.py                  |   13 +-
 tests/test_workable.py                             |    5 +-
 42 files changed, 4377 insertions(+), 98 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
index d96258e..d15672f 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
@@ -44,10 +44,14 @@ Checkpoint03 LIMITEDDEVELOPMENT confirmed: fullhistorya38191e10c736949ef96f79aeb
 
 LATESTRELEASEAUTHORIZATION2026-10-07 14:27UTC Andrew:“Don’t keep deployment blocked, let’s just send it.” FinishALL13+permittedfinalreview THENpublish/mergecompletedupgrade/service-scopedexistingworkflowdeploy verifyexactlivecommit/E2E. RELEASE-AUTHORIZATION.md supersedesolddeployholdonlycompletedrelease; no unfinishedTask4deployment. Reducedreviewgapsremain/norefusalbypass. Permanentdeletion/newcredentialsIAM/securitysensitivesettingsothersafetyfloorstillapplicableconfirmation. PreserveunrelatedRailwaydiscoverystagedchanges. Authorlocalonlycontrollerfinalrelease; currentTask4Fix1continues.
 
 Task4 COMPLETEpermittedrequirements/qualityat e67d4f4b62c1e2f8ab096e76cd8638856b5124a8; finalFix2SpecPASS/QualityAPPROVED fullreportrootread. R4-1/R4-1a/R4-2resolved, no ordinaryopenfindings. Final101passedzero-skip EACHPG17.11/16.15 authoritativeaffectedlane; original111eachpredatesfixes (historicalmigrationevidence) notfinalfullrun. ReducedindependentsecuritygapsunchangedNOTsecurityapproved. Controllercompletehistorycheckpoint04bundle/Librarysave next thenfreshTask5 immediately. Latestcompleted-releaseauthorization preserved, no productionactions yet.
 
 Checkpoint04 CONFIRMEDcompletehistory8898b0f8596b71de4894971021868f70ed4bd815; Librarylibfile_16de2cb6d71881919e96eebc41a508f1 / file_00000000475481f49767317db27b4816 v0, xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-04.bundle. Task4productfinale67d4f4 +allapprovedrequirements/reviews/sanitizedevidence/releaseauthorization safelyoutsideexecutor. Permittedrequirements/qualityPASS/APPROVED; securityreviewgapsunchangednoapproval. FreshTask5author next BASEthisforwardIDledgercommit. Continueall13+permittedfinalreview+authorizedcompletedpublish/merge/service-scopeddeploy, applicableconfirmationexceptionsremain.
 
 Task5COMPLETEpermittedrequirements/quality ated9788105f98fd0d8f7438636d6e6c50ac3c919a; scopedFix1SpecPASS/QualityAPPROVEDfullreportrootread. SoleP2fallbackresolved. Freshfix4regressioncases+23focusedpass23deselected0skip; original84EACH17.11/16.15/resourcesremainhistoricala6131a0,no freshDBclaim. ReducedsecuritygapsunchangedNOTsecurityapproved. Nextcontrollercompletehistorycheckpoint05/Libraryconfirm thenfreshTask6 immediately, nointerimstop; all13/finalpermittedreview/authorizedcompletedreleasecontinue.
 
 Checkpoint05CONFIRMEDcompletehistoryd8d1288886afe061a82dc6486d2bda7c93ae5b0b; Librarylibfile_bc40068424d48191aa8278581ef961fd / file_00000000ee40820eb15e2d7c0d13e753 v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-05.bundle. ProductTask5finaled978810+allrequirements/reviews/sanitizedevidence/source safelyoutsideexecutor. Permittedrequirements/qualityPASS/APPROVED, nosecurityapproval. FreshTask6authorBASEthisforwardIDledgercommit; continueALL13/finalpermittedreview/authorizedcompletedrelease.
+
+- Task06 UNACCEPTED committed snapshot: db73ad7365790419c4a1a82ec38ae21e4c7233c3; completehistory Library `libfile_c5339347849c8191af7684fb28929cb2`, file `file_00000000900881f49f4cc05c29e6bc14`, v0+xattrs. Saved after disconnectcheck verified livecommands/worktree; excludes uncommitted Fix1/controllerwork. Accepted05 remains unchanged.
+
+LATEST RECOVERY SNAPSHOT (not acceptedTask06): controllerdocs/review/rulings forwardcommit966fc386f8c05a874da9be5bba1a0aa18a6f2e10 completehistorybundle VERIFIED, LibraryCONFIRMED libfile_2f2bdbbaf7e88191836cd13115144eb7 / file_00000000bd4481f4836ec4dd90f9006c v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-task06-review-snapshot.bundle contains sourceTask6db73ad7 + independentSpecFAIL/QualityCHANGES_REQUIREDreport/fullpackage + controllerhandoff/ownershipRuling + accepted1–5history. Excludes future/uncommittedFix1. Earlierdb73snapshotlibfile_c5339347849c8191af7684fb28929cb2 and accepted05libfile_bc40068424d48191aa8278581ef961fd unchanged. Commands/worktreeintact; reporteddisconnectNOTcurrentlyblocking. SameauthorFix1 ACTIVE, reviewedproductBASEdb73ad7 remains; no completedstage restarted. Continueall13/finalreview/authorizedcompletedrelease.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
index b335d3d..eb6d10b 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
@@ -84,10 +84,32 @@ Task5REDauthorreported13expectedmissinginterfaces/config/drain +2pre-existingrev
 
 Task5authorDONEa6131a02282174078e34ecdd28d967294a524a90 BASEee9cef28. Rootreadactual84passed0skip EACHPG17.11/16.15+clienttestresource logs4connpeak/0after (monitor1extra); memoryCPUexcludesDB/harness no prodcostclaims. Fullrecordedrangepackagegenerated/diffcheckpassed. Freshpermittedrequirements/qualityreviewer/root/recovery_task05_requirements_review Astra-high forkNONE ACTIVE source/processcorrectnessONLY noexcludedsecurityreview; completedreleaseauthorizationprovided. Nextreport→scopedfixesifneeded→Library05confirm→freshTask6 continueALL13+finalpermittedreview+authorizedcompletedrelease.
 
 Task5initialpermittedreview SpecFAIL/QualityCHANGES_REQUIRED oneP2reviewercompatibilityregression range(k) removesBASEk<=1singleloopfallback, offline -1/0 loopsHEAD0 BASE1; 1/3unchanged. Fullreport/evidencepreserved; restscopedrequirements/resourcefacts accepted noexcludedsecurityanalysis/safeguardblock. SameTask5author ACTIVEFix1/5 BASEa6131a02 narroweffectiveworker>=1restore/offlineregression/draincontractfocusedordinaryverification. NextDONEfullfixpackage→scopedrereview→Library05→freshTask6; continueALL13+permittedfinalreview+completedauthorizedrelease.
 
 Task5Fix1authorDONEed9788105f98fd0d8f7438636d6e6c50ac3c919a BASEa6131a02; one-lineeffectivek>=1restoreslegacyfallback/noDBprotocolchange. Rootreadactual4regressionpass+23focusedpass23deselected0skip; 84permajorresource lanes historicalatBASE notrerunclaimed. Fullforwardfixpackagegenerated/diffcheckpassed; SAMEindependentTask5reviewer ACTIVEscopedP2fallback+fiximportantordinaryscope. Nextcleangate→checkpoint05Libraryconfirmed/xattrs→freshTask6, all13/finalpermittedreview/authorizedcompletedreleasecontinue.
 
 Task5COMPLETEpermittedrequirements/quality ated9788105f98fd0d8f7438636d6e6c50ac3c919a; scopedFix1SpecPASS/QualityAPPROVEDfullreportrootread. SoleP2fallbackresolved. Freshfix4regressioncases+23focusedpass23deselected0skip; original84EACH17.11/16.15/resourcesremainhistoricala6131a0,no freshDBclaim. ReducedsecuritygapsunchangedNOTsecurityapproved. Nextcontrollercompletehistorycheckpoint05/Libraryconfirm thenfreshTask6 immediately, nointerimstop; all13/finalpermittedreview/authorizedcompletedreleasecontinue.
 
 Checkpoint05CONFIRMEDcompletehistoryd8d1288886afe061a82dc6486d2bda7c93ae5b0b; Librarylibfile_bc40068424d48191aa8278581ef961fd / file_00000000ee40820eb15e2d7c0d13e753 v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-05.bundle. ProductTask5finaled978810+allrequirements/reviews/sanitizedevidence/source safelyoutsideexecutor. Permittedrequirements/qualityPASS/APPROVED, nosecurityapproval. FreshTask6authorBASEthisforwardIDledgercommit; continueALL13/finalpermittedreview/authorizedcompletedrelease.
+
+Task6ACTIVEfreshsoleauthor/root/recovery_task06_implementer Astra-high forkNONE BASEec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409. Fullbrief/dispatch/amendment/releaseauthprovided; fullcorpusfairsourceenum all6ATS explicitcompleteness boundedpositive staging/closuretwo24hmises schedulingaboveguard/inactive independent/legacycompatibility ordinaryfixturesowned17/16. Necessaryworker/pollintegrationallowedrecordinventory. No excludedTask3securityreview/probes; amendedCheckpointB sourcecorrectness/permittedrequirementsquality ONLY. NextDONEfullrangepackage→freshpermittedreview/fix→Library06confirm→Task7; continueALL13/finalpermittedreview/authorizedcompletedrelease. Controlleronlydocs/reviews/artifacts no productfixes.
+
+Task6 Ruling: preserve existing physical/accounting interfaces; allow bounded above-guard read-only full-feed verification with truthful healthy-but-storage-blocked/reconciliation-deferred outcomes and no absence certification — lifecycle_validate_row charges changed source_accounts/source_listings/source_enumerations rows as growth, reserve_capacity refuses forecasts above 6000 MiB, and claim_work refuses a first source claim there. Do not weaken these interfaces or reproduce the refused review/probes. Keep flag-off PR16 closure above guard. Enforced durable operational/reconciliation progress remains an unresolved FUNCTIONAL/ROLLOUT issue for Task10/13 and final permitted review, not a fulfilled requirement or security approval — cost if wrong: repeated feed checks without durable health/cursor/closure progress above the ceiling; downstream integration rework and activation must remain gated on an explicit resolution. Ordinary tests must demonstrate actual feed attempt, healthy outcome distinct from source failure, no false absence, and fair permitted attempts. Any smallest ordinary no-growth contract repair must be reported concretely before change.
+
+Task6 author-reported intermediate ordinary evidence: PG17 source/run lane159passed; focused reservation-usage/request-time finite six-cycle fairness38passed; full selected compatibility lane still running, not final source acceptance. Inherited transport integration issue for Task9/13: all six adapters retain job_discovery.http; per-board budgets/no-retry/<=20s timeout do not by themselves establish global redirect<=3/all-address pinning/revalidation/wire+decompressed<=10MiB/fullfetch20s contract. Existing shared transport follows redirects. Carry as functional integration requirement, not a security-approved guarantee; author report must distinguish source completeness evidence from inherited transport limitations. No actual provider/network calls.
+
+Controller prepared Task10–12 author handoffs from full approved briefs (not dispatched): typed transactional outbox/exact deterministic seals; AWS SDK offline bounded exporter with fresh-worker+fresh-connection persisted recovery; pure bounded projection with terminal gaps/suppression. These carry original amendment/release authorization and distinguish ordinary new archive correctness from deliberately unreviewed Task3 mechanisms. Task6 reviewer handoff prepared; actual final HEAD/full package pending author DONE.
+
+Controller read actual Task6 broad owned compatibility outputs: PostgreSQL17.11 231passed/134.78s;16.15 231passed/167.87s, no skips. Author subsequently corrected ordinary read-only budget exhaustion partial-versus-failed logging and second-miss qualification to successful completion timestamps (enumeration starts still protect newer positives), adding read-only six-day rotation proof. Thus broad outputs precede final edits; focused current-source lanes pending. Final acceptance must use chronological report + fresh covering outputs, not call these broad runs final unchanged-source evidence.
+
+Task6 author DONEdb73ad7365790419c4a1a82ec38ae21e4c7233c3 BASEec588ac87. Controller read full report/exact commands/actual covering final43passed0skip EACH17.11/16.15; broad231each historical before narrow completion-time/logging refinements, honestly recorded. Full recorded-range review package generated and diffcheck passed. Fresh Task6 permitted requirements/sourcecorrectness+quality reviewer /root/recovery_task06_requirements_review Astra-high forkNONE ACTIVE. Known aboveguard durable reconciliation and inherited transport gaps included, not pre-waived or security-approved. Next verdict/scoped fixes→Library06 confirmation/xattrs→freshTask7; continueALL13/finalpermittedreview/authorizedcompletedrelease. Controller only documentation/artifacts, no product edits.
+
+Task6 independent permitted reviewer intermediate findings (final report pending): interrupted production deadline cancels claim with reconciliation unfinished and lacks resume selection; eager Greenhouse/Lever/Ashby parsing can discard valid earlier positives on a later identifiable item missing a nonidentity field (offline fixture evidence); completion+24h due timestamp versus fixed daily00UTCcron being assessed. ExpectedSpecFAIL/QualityCHANGES_REQUIRED, no excluded probes/covered test reruns. Await exact final report then sameauthor Fix1/5; do not advance Task7/checkpoint06 yet.
+
+Task6 initial permitted review SpecFAIL/QualityCHANGES_REQUIRED atdb73ad7, finalfullreportrootread. R6-1Important production deadline abandons completed-membership checkpoint tail/cancelsclaim with no scheduledresume; R6-2Important completion+24h due skips next daily00UTCcron (48hactual); R6-3Important eagerGreenhouse/Lever/Ashby parse loses good positives upon later malformeditem. Sameauthor/root/recovery_task06_implementer ACTIVEFix1/5 BASEdb73ad7, fullfindings/reportprovided, normalfreshworker+connectionentrypointresume, realdaily-slotfixtures/separate24hmissqualification, mixeditempositivepreservation, selectedaffectedordinary17/16. If immutablefence/handoffnormalpath conflicts, authorreportsconcretebeforechange. R6-4aboveguard durable progress andR6-5sharedtransport remain loadbearing downstreamFUNCTIONALBLOCKERS carriedTask8/10/13/finalreview, not waived/securityapproved. Minorclosed_jobs summaryalways0 deferredTask13integration; privatewriter/densecode minorrecorded. NoTask7/Library06 acceptance yet. NextFixDONEactualevidence→fullforwardfixpackage→sameindependentscopedrereview1–3+fixintroducedImportant; no whole-taskreview/securityprobe retry. Continueall13+permittedfinalreview+authorizedcompletedrelease.
+
+Task6 Ruling: authorize additive ordered SQL ownership-only handoff for complete-unreconciled enumeration to a currently validated newer SAME-SOURCE claim, preserving enumeration id/source/sequence/completed membership/start/completion times and checkpoint cursor, updating checkpoint generation atomically — existing lifecycle_staging_fence rejects any owner/generation change and therefore cannot satisfy required fresh-worker scheduledresume after terminalclaim; existing claim/lease/capacity/role/owner validation remains unchanged, no GUC/privilege bypass — cost if wrong: checkpoint/membership consistency regression requiring rework; ordinary handoff sourcecontract review/tests are required, no independent security approval implied. Author report concrete conflict/readschema confirmed; originalR6-1/2/3 Fix1 continues.
+
+Parent executor-disconnect check2026-10-07: actualcommands run successfully (exit0), expectedworktree/HEADdb73ad7/reports intact; no presentexecutorblock and no stage restarted. Tasks1–5accepteddevelopmentmilestones (Task3reducedreview/notfullysecurityapproved);Task6midFix1. Additional unaccepted committed Task6 completehistorybundle db73ad7365790419c4a1a82ec38ae21e4c7233c3 VERIFIED and LibraryCONFIRMED libfile_c5339347849c8191af7684fb28929cb2 / file_00000000900881f49f4cc05c29e6bc14 v0,xattrsappliedsameexec; /workspace/scratch/job-board-lifecycle-recovery-task06-unaccepted.bundle. This snapshot contains committedhistory only, not currentcontrolleruncommitteddocs orfutureFix1; NOTacceptedcheckpoint06. Acceptedcheckpoint05 libfile_bc40068424d48191aa8278581ef961fd unchanged. ControllerreportedexactIDs/workcontinues.
+
+LATEST RECOVERY SNAPSHOT (not acceptedTask06): controllerdocs/review/rulings forwardcommit966fc386f8c05a874da9be5bba1a0aa18a6f2e10 completehistorybundle VERIFIED, LibraryCONFIRMED libfile_2f2bdbbaf7e88191836cd13115144eb7 / file_00000000bd4481f4836ec4dd90f9006c v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-task06-review-snapshot.bundle contains sourceTask6db73ad7 + independentSpecFAIL/QualityCHANGES_REQUIREDreport/fullpackage + controllerhandoff/ownershipRuling + accepted1–5history. Excludes future/uncommittedFix1. Earlierdb73snapshotlibfile_c5339347849c8191af7684fb28929cb2 and accepted05libfile_bc40068424d48191aa8278581ef961fd unchanged. Commands/worktreeintact; reporteddisconnectNOTcurrentlyblocking. SameauthorFix1 ACTIVE, reviewedproductBASEdb73ad7 remains; no completedstage restarted. Continueall13/finalreview/authorizedcompletedrelease.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index dbb1ddc..8d0675d 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -134,10 +134,32 @@ Task5authorDONEa6131a02282174078e34ecdd28d967294a524a90 BASEee9cef28. Rootreadac
 
 Task5initialpermittedreview SpecFAIL/QualityCHANGES_REQUIRED oneP2reviewercompatibilityregression range(k) removesBASEk<=1singleloopfallback, offline -1/0 loopsHEAD0 BASE1; 1/3unchanged. Fullreport/evidencepreserved; restscopedrequirements/resourcefacts accepted noexcludedsecurityanalysis/safeguardblock. SameTask5author ACTIVEFix1/5 BASEa6131a02 narroweffectiveworker>=1restore/offlineregression/draincontractfocusedordinaryverification. NextDONEfullfixpackage→scopedrereview→Library05→freshTask6; continueALL13+permittedfinalreview+completedauthorizedrelease.
 
 Task13 finalverification/CI IMPORTANTTODO: existing CIpytest tests/ automaticallyincludesTask3 refusedprobereproduction suites; beforeanypublish/PR author13mustalignlocalANDCI permittedtestinventory/exclusionsunderamendment, not runexcludedworkthroughCI orclaimunrestrictedfullsecuritysuite. Preparedtask-13-author-dispatch.md records requirement; no controllerproductedit/no earlypush.
 
 Task5Fix1authorDONEed9788105f98fd0d8f7438636d6e6c50ac3c919a BASEa6131a02; one-lineeffectivek>=1restoreslegacyfallback/noDBprotocolchange. Rootreadactual4regressionpass+23focusedpass23deselected0skip; 84permajorresource lanes historicalatBASE notrerunclaimed. Fullforwardfixpackagegenerated/diffcheckpassed; SAMEindependentTask5reviewer ACTIVEscopedP2fallback+fiximportantordinaryscope. Nextcleangate→checkpoint05Libraryconfirmed/xattrs→freshTask6, all13/finalpermittedreview/authorizedcompletedreleasecontinue.
 
 Task5COMPLETEpermittedrequirements/quality ated9788105f98fd0d8f7438636d6e6c50ac3c919a; scopedFix1SpecPASS/QualityAPPROVEDfullreportrootread. SoleP2fallbackresolved. Freshfix4regressioncases+23focusedpass23deselected0skip; original84EACH17.11/16.15/resourcesremainhistoricala6131a0,no freshDBclaim. ReducedsecuritygapsunchangedNOTsecurityapproved. Nextcontrollercompletehistorycheckpoint05/Libraryconfirm thenfreshTask6 immediately, nointerimstop; all13/finalpermittedreview/authorizedcompletedreleasecontinue.
 
 Checkpoint05CONFIRMEDcompletehistoryd8d1288886afe061a82dc6486d2bda7c93ae5b0b; Librarylibfile_bc40068424d48191aa8278581ef961fd / file_00000000ee40820eb15e2d7c0d13e753 v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-05.bundle. ProductTask5finaled978810+allrequirements/reviews/sanitizedevidence/source safelyoutsideexecutor. Permittedrequirements/qualityPASS/APPROVED, nosecurityapproval. FreshTask6authorBASEthisforwardIDledgercommit; continueALL13/finalpermittedreview/authorizedcompletedrelease.
+
+Task6ACTIVEfreshsoleauthor/root/recovery_task06_implementer Astra-high forkNONE BASEec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409. Fullbrief/dispatch/amendment/releaseauthprovided; fullcorpusfairsourceenum all6ATS explicitcompleteness boundedpositive staging/closuretwo24hmises schedulingaboveguard/inactive independent/legacycompatibility ordinaryfixturesowned17/16. Necessaryworker/pollintegrationallowedrecordinventory. No excludedTask3securityreview/probes; amendedCheckpointB sourcecorrectness/permittedrequirementsquality ONLY. NextDONEfullrangepackage→freshpermittedreview/fix→Library06confirm→Task7; continueALL13/finalpermittedreview/authorizedcompletedrelease. Controlleronlydocs/reviews/artifacts no productfixes.
+
+Task6 Ruling: preserve existing physical/accounting interfaces; allow bounded above-guard read-only full-feed verification with truthful healthy-but-storage-blocked/reconciliation-deferred outcomes and no absence certification — lifecycle_validate_row charges changed source_accounts/source_listings/source_enumerations rows as growth, reserve_capacity refuses forecasts above 6000 MiB, and claim_work refuses a first source claim there. Do not weaken these interfaces or reproduce the refused review/probes. Keep flag-off PR16 closure above guard. Enforced durable operational/reconciliation progress remains an unresolved FUNCTIONAL/ROLLOUT issue for Task10/13 and final permitted review, not a fulfilled requirement or security approval — cost if wrong: repeated feed checks without durable health/cursor/closure progress above the ceiling; downstream integration rework and activation must remain gated on an explicit resolution. Ordinary tests must demonstrate actual feed attempt, healthy outcome distinct from source failure, no false absence, and fair permitted attempts. Any smallest ordinary no-growth contract repair must be reported concretely before change.
+
+Task6 author-reported intermediate ordinary evidence: PG17 source/run lane159passed; focused reservation-usage/request-time finite six-cycle fairness38passed; full selected compatibility lane still running, not final source acceptance. Inherited transport integration issue for Task9/13: all six adapters retain job_discovery.http; per-board budgets/no-retry/<=20s timeout do not by themselves establish global redirect<=3/all-address pinning/revalidation/wire+decompressed<=10MiB/fullfetch20s contract. Existing shared transport follows redirects. Carry as functional integration requirement, not a security-approved guarantee; author report must distinguish source completeness evidence from inherited transport limitations. No actual provider/network calls.
+
+Controller prepared Task10–12 author handoffs from full approved briefs (not dispatched): typed transactional outbox/exact deterministic seals; AWS SDK offline bounded exporter with fresh-worker+fresh-connection persisted recovery; pure bounded projection with terminal gaps/suppression. These carry original amendment/release authorization and distinguish ordinary new archive correctness from deliberately unreviewed Task3 mechanisms. Task6 reviewer handoff prepared; actual final HEAD/full package pending author DONE.
+
+Controller read actual Task6 broad owned compatibility outputs: PostgreSQL17.11 231passed/134.78s;16.15 231passed/167.87s, no skips. Author subsequently corrected ordinary read-only budget exhaustion partial-versus-failed logging and second-miss qualification to successful completion timestamps (enumeration starts still protect newer positives), adding read-only six-day rotation proof. Thus broad outputs precede final edits; focused current-source lanes pending. Final acceptance must use chronological report + fresh covering outputs, not call these broad runs final unchanged-source evidence.
+
+Task6 author DONEdb73ad7365790419c4a1a82ec38ae21e4c7233c3 BASEec588ac87. Controller read full report/exact commands/actual covering final43passed0skip EACH17.11/16.15; broad231each historical before narrow completion-time/logging refinements, honestly recorded. Full recorded-range review package generated and diffcheck passed. Fresh Task6 permitted requirements/sourcecorrectness+quality reviewer /root/recovery_task06_requirements_review Astra-high forkNONE ACTIVE. Known aboveguard durable reconciliation and inherited transport gaps included, not pre-waived or security-approved. Next verdict/scoped fixes→Library06 confirmation/xattrs→freshTask7; continueALL13/finalpermittedreview/authorizedcompletedrelease. Controller only documentation/artifacts, no product edits.
+
+Task6 independent permitted reviewer intermediate findings (final report pending): interrupted production deadline cancels claim with reconciliation unfinished and lacks resume selection; eager Greenhouse/Lever/Ashby parsing can discard valid earlier positives on a later identifiable item missing a nonidentity field (offline fixture evidence); completion+24h due timestamp versus fixed daily00UTCcron being assessed. ExpectedSpecFAIL/QualityCHANGES_REQUIRED, no excluded probes/covered test reruns. Await exact final report then sameauthor Fix1/5; do not advance Task7/checkpoint06 yet.
+
+Task6 initial permitted review SpecFAIL/QualityCHANGES_REQUIRED atdb73ad7, finalfullreportrootread. R6-1Important production deadline abandons completed-membership checkpoint tail/cancelsclaim with no scheduledresume; R6-2Important completion+24h due skips next daily00UTCcron (48hactual); R6-3Important eagerGreenhouse/Lever/Ashby parse loses good positives upon later malformeditem. Sameauthor/root/recovery_task06_implementer ACTIVEFix1/5 BASEdb73ad7, fullfindings/reportprovided, normalfreshworker+connectionentrypointresume, realdaily-slotfixtures/separate24hmissqualification, mixeditempositivepreservation, selectedaffectedordinary17/16. If immutablefence/handoffnormalpath conflicts, authorreportsconcretebeforechange. R6-4aboveguard durable progress andR6-5sharedtransport remain loadbearing downstreamFUNCTIONALBLOCKERS carriedTask8/10/13/finalreview, not waived/securityapproved. Minorclosed_jobs summaryalways0 deferredTask13integration; privatewriter/densecode minorrecorded. NoTask7/Library06 acceptance yet. NextFixDONEactualevidence→fullforwardfixpackage→sameindependentscopedrereview1–3+fixintroducedImportant; no whole-taskreview/securityprobe retry. Continueall13+permittedfinalreview+authorizedcompletedrelease.
+
+Task6 Ruling: authorize additive ordered SQL ownership-only handoff for complete-unreconciled enumeration to a currently validated newer SAME-SOURCE claim, preserving enumeration id/source/sequence/completed membership/start/completion times and checkpoint cursor, updating checkpoint generation atomically — existing lifecycle_staging_fence rejects any owner/generation change and therefore cannot satisfy required fresh-worker scheduledresume after terminalclaim; existing claim/lease/capacity/role/owner validation remains unchanged, no GUC/privilege bypass — cost if wrong: checkpoint/membership consistency regression requiring rework; ordinary handoff sourcecontract review/tests are required, no independent security approval implied. Author report concrete conflict/readschema confirmed; originalR6-1/2/3 Fix1 continues.
+
+Parent executor-disconnect check2026-10-07: actualcommands run successfully (exit0), expectedworktree/HEADdb73ad7/reports intact; no presentexecutorblock and no stage restarted. Tasks1–5accepteddevelopmentmilestones (Task3reducedreview/notfullysecurityapproved);Task6midFix1. Additional unaccepted committed Task6 completehistorybundle db73ad7365790419c4a1a82ec38ae21e4c7233c3 VERIFIED and LibraryCONFIRMED libfile_c5339347849c8191af7684fb28929cb2 / file_00000000900881f49f4cc05c29e6bc14 v0,xattrsappliedsameexec; /workspace/scratch/job-board-lifecycle-recovery-task06-unaccepted.bundle. This snapshot contains committedhistory only, not currentcontrolleruncommitteddocs orfutureFix1; NOTacceptedcheckpoint06. Acceptedcheckpoint05 libfile_bc40068424d48191aa8278581ef961fd unchanged. ControllerreportedexactIDs/workcontinues.
+
+LATEST RECOVERY SNAPSHOT (not acceptedTask06): controllerdocs/review/rulings forwardcommit966fc386f8c05a874da9be5bba1a0aa18a6f2e10 completehistorybundle VERIFIED, LibraryCONFIRMED libfile_2f2bdbbaf7e88191836cd13115144eb7 / file_00000000bd4481f4836ec4dd90f9006c v0,xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-task06-review-snapshot.bundle contains sourceTask6db73ad7 + independentSpecFAIL/QualityCHANGES_REQUIREDreport/fullpackage + controllerhandoff/ownershipRuling + accepted1–5history. Excludes future/uncommittedFix1. Earlierdb73snapshotlibfile_c5339347849c8191af7684fb28929cb2 and accepted05libfile_bc40068424d48191aa8278581ef961fd unchanged. Commands/worktreeintact; reporteddisconnectNOTcurrentlyblocking. SameauthorFix1 ACTIVE, reviewedproductBASEdb73ad7 remains; no completedstage restarted. Continueall13/finalreview/authorizedcompletedrelease.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-author-dispatch.md
new file mode 100644
index 0000000..0678626
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-author-dispatch.md
@@ -0,0 +1,13 @@
+# Task10 author dispatch preparation
+
+After Task9 accepted permitted review + confirmed Library checkpoint, fresh sole author receives actual BASE. Read task-10-brief.md first after amendments. Implement transactional typed public events, deterministic immutable seals and exact-ID acknowledgement using established control/claims/capacity interfaces. Connect meaningful public identity/reconcile mutations; no unchanged-poll event growth or invented historical baselines. Preserve private FKs and flag-off legacy behavior. Normal paired transaction, event ordering, immutable membership, deterministic codec and persisted exact acknowledgement behavior require ordinary functional evidence; deferred Task3 mechanism probes/security verdicts are not authorized substitutes. Record which activation/direct-DML checks remain unreviewed rather than imply a full CheckpointD security gate.
+
+Carry Task6 above-guard functional/rollout issue from progress.md: read-only healthy feed verification can continue, but changed source/staging rows are charged as growth and durable progress is blocked above6000MiB. Assess the concrete new-feature integration requirement and propose the smallest ordinary no-growth operational contract repair before changing established enforcement. Do not silently bypass guard or claim durable closure completed.
+
+Record exact version coverage, typed relation/endpoint identity and predecessor consistency; listing watermark cannot certify unknown versions. Serialize outside SQL transactions/locks, persist seal before external I/O, use exact committed IDs rather than sequence watermarks. Budget thresholds/critical reserve and retention are exact brief values. No exporter or live archive destination connection in this task; suppression markers seeded locally without object deletion.
+
+Read REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md before your full task brief. The brief is the single requirements source; recorded amendments supersede older review/deployment holds. No author subagents/reviewers. Controller dispatches independent permitted requirements/quality review after your pinned forward commit. Existing Task3 expiry/capacity/cross-user adversarial review/probe gaps remain deliberately unreviewed; never retry, split, disguise, reproduce or substitute reviewers/tools for refused work. Scope ordinary new-feature tests explicitly; do not run deferred suites through a broad pytest command. Functional requirements remain and defects must be reported, not called waived or security approved.
+
+Local-only implementation: flags default off, retirement dry-run, archive producer/export inactive pending approved destination/readiness. No production calls/writes, bucket/IAM mutations, permanent deletion, provider/model/paid calls, credential extraction, activation, push/merge/deploy or unrelated Railway changes. Completed-release authorization is for the controller after all13/permitted final review, preserving action-specific safety requirements. Use only owned random-loopback isolated DB harness, never shared 55432 or ad hoc destructive feedback fixtures. Select affected ordinary tests on actual PostgreSQL17 and16 when DB behavior changes, record exact commands/server versions/outputs/deselections; no duplicated already-covered testing absent new changes/concerns.
+
+Write task-N-report.md and sanitized task-N-evidence/ (replace N with task number), include RED/GREEN, exact final source SHA, integration inventory, actual tested/reviewed scopes, unresolved issues and rollout prerequisites. Forward-commit only own source/test/report/evidence, exclude controller files. Return DONE+SHA+one-line verification+concerns. Any safeguard: report exact error and stop affected work only, no bypass.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-author-dispatch.md
new file mode 100644
index 0000000..cbe0890
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-author-dispatch.md
@@ -0,0 +1,13 @@
+# Task11 author dispatch preparation
+
+After Task10 accepted permitted requirements/quality review + confirmed Library checkpoint, fresh sole author receives actual BASE. Read task-11-brief.md first after amendments. Use AWS SDK Python skill c1/aws-sdk-python-usage and exact referenced S3 guidance. Build bounded conditional immutable upload/stream verification and independent exporter child using persisted seal interfaces, explicit-timeout/retry client, closed streaming bodies, test fake credentials/IMDSdisabled and no ambient AWS access. Actual 412 ClientError and ambiguous-success reads must exercise the canonical conditional PutObject path; no DeleteObject or ETag-as-content-hash assumption.
+
+Use local owned PostgreSQL plus fake S3 for ordinary persisted crash recovery: discard/terminate both worker AND connection at boundaries and resume from fresh process/connection persisted rows. These new archive feature fault cases must not reproduce refused Task3 mechanism probes. Scope DB-clock fixture locally to archive eligibility (no production caller-time/GUC bypass); report if a concrete case overlaps blocked work before executing it. Preserve exact IDs/bodies/revisions/times, unknown availability and pending events. Operator-explicit expired replacement contract implemented/tested locally; no real production replacement authorization implied.
+
+Destination validation remains a concrete activation prerequisite: do not provision/read/upload actual bucket or invent approved destination. Dependency versions must be compatible and tested offline; no hidden credentials/logged signed URLs/body. Keep exporter disabled until approved configuration. This is permitted ordinary failure-correctness review, not full CheckpointE security approval.
+
+Read REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md before your full task brief. The brief is the single requirements source; recorded amendments supersede older review/deployment holds. No author subagents/reviewers. Controller dispatches independent permitted requirements/quality review after your pinned forward commit. Existing Task3 expiry/capacity/cross-user adversarial review/probe gaps remain deliberately unreviewed; never retry, split, disguise, reproduce or substitute reviewers/tools for refused work. Scope ordinary new-feature tests explicitly; do not run deferred suites through a broad pytest command. Functional requirements remain and defects must be reported, not called waived or security approved.
+
+Local-only implementation: flags default off, retirement dry-run, archive producer/export inactive pending approved destination/readiness. No production calls/writes, bucket/IAM mutations, permanent deletion, provider/model/paid calls, credential extraction, activation, push/merge/deploy or unrelated Railway changes. Completed-release authorization is for the controller after all13/permitted final review, preserving action-specific safety requirements. Use only owned random-loopback isolated DB harness, never shared 55432 or ad hoc destructive feedback fixtures. Select affected ordinary tests on actual PostgreSQL17 and16 when DB behavior changes, record exact commands/server versions/outputs/deselections; no duplicated already-covered testing absent new changes/concerns.
+
+Write task-N-report.md and sanitized task-N-evidence/ (replace N with task number), include RED/GREEN, exact final source SHA, integration inventory, actual tested/reviewed scopes, unresolved issues and rollout prerequisites. Forward-commit only own source/test/report/evidence, exclude controller files. Return DONE+SHA+one-line verification+concerns. Any safeguard: report exact error and stop affected work only, no bypass.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-author-dispatch.md
new file mode 100644
index 0000000..72bf484
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-author-dispatch.md
@@ -0,0 +1,11 @@
+# Task12 author dispatch preparation
+
+After Task11 accepted permitted review + confirmed Library checkpoint, fresh sole author receives actual BASE. Read task-12-brief.md first after amendments. Implement bounded optional pure admin projection with total schema interpretation, exact duplicate/conflict semantics, provenance, retention gaps and suppression precedence. Output isolated file/test projection only: no app DB restore, reviews, generation, notifications, paid calls or reopening current state. No graph product, automatic merge or storage engine.
+
+Exercise ordinary archive projection lifecycle correctness with synthetic sealed inputs: duplicate hashes, schema/revision gaps, terminal missing/expired prefixes, independent-fact allowlist and suppression/removal markers. No actual object deletion; only seed local authorized suppression fixture records. Keep expiry proof confined to this new archive replay feature rather than recreate refused Task3 lease enforcement probes. Coverage must remain explicitly incomplete where evidence is absent; do not invent lifespan history or bootstrap current PG as an implemented feature.
+
+Read REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md before your full task brief. The brief is the single requirements source; recorded amendments supersede older review/deployment holds. No author subagents/reviewers. Controller dispatches independent permitted requirements/quality review after your pinned forward commit. Existing Task3 expiry/capacity/cross-user adversarial review/probe gaps remain deliberately unreviewed; never retry, split, disguise, reproduce or substitute reviewers/tools for refused work. Scope ordinary new-feature tests explicitly; do not run deferred suites through a broad pytest command. Functional requirements remain and defects must be reported, not called waived or security approved.
+
+Local-only implementation: flags default off, retirement dry-run, archive producer/export inactive pending approved destination/readiness. No production calls/writes, bucket/IAM mutations, permanent deletion, provider/model/paid calls, credential extraction, activation, push/merge/deploy or unrelated Railway changes. Completed-release authorization is for the controller after all13/permitted final review, preserving action-specific safety requirements. Use only owned random-loopback isolated DB harness, never shared 55432 or ad hoc destructive feedback fixtures. Select affected ordinary tests on actual PostgreSQL17 and16 when DB behavior changes, record exact commands/server versions/outputs/deselections; no duplicated already-covered testing absent new changes/concerns.
+
+Write task-N-report.md and sanitized task-N-evidence/ (replace N with task number), include RED/GREEN, exact final source SHA, integration inventory, actual tested/reviewed scopes, unresolved issues and rollout prerequisites. Forward-commit only own source/test/report/evidence, exclude controller files. Return DONE+SHA+one-line verification+concerns. Any safeguard: report exact error and stop affected work only, no bypass.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
index 66066b1..6d085fa 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
@@ -41,10 +41,16 @@ deletion/newpersistentcredentials/IAM/securitysensitivesettings still need
 applicableconfirmation. No author productionwrites/release/cloud/provider/paid
 calls or unrelatedRailway edits. Preserve discovery pendingpatch; root
 release-preflight.md has verified IDs, update via readonly evidence if needed.
 
 Write task-13-report.md +sanitized task-13-evidence/ exactRED/GREENcommands/
 versions/testinventory/browserartefacts/runbook/rulings. Commit ownproduct/
 tests/report/evidence forward excludecontrollerfiles. Return DONE+SHA and
 stop for permitted task review, Library13checkpoint then freshfinalwholebranch
 permitted review/onecompletefixwave and scopedrereview. Any safeguard: exact
 error, stoponlyaffectedwork, continueindependentallowedwork, no bypass.
+
+Carry the Task6 above-guard functional/rollout conflict in progress.md: bounded read-only verification may proceed, but existing source/staging growth accounting blocks durable reconciliation above 6000 MiB. Do not claim this goal completed or security approved. Assess ordinary integration correctness, preserve flag-off legacy closure, and report a concrete minimal contract repair before changing established enforcement.
+
+Task6 inherited transport issue (progress.md): adapters use job_discovery.http with redirects. New per-board request/time budgets do not establish full publicfetch deadline20s, redirect<=3, each address/redirect revalidation/pinning and10MiB wire+decompressed cap. Inventory and implement the required normal bounded public transport integration within authorized scope; report any safeguard overlap concretely rather than bypassing it or declaring the contract proved.
+
+Task6 reviewer minor: verify_due_sources initializes closed_jobs=0 and never increments despite actual closure writes; run persists this zero. Complete reporting with actual committed close counts and no replay double-counting. R6-4/R6-5 remain Important functional integration blockers until actually resolved; see task-6-requirements-review.md.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
index dde24c9..7d05102 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
@@ -42,10 +42,40 @@ git diff --check
 
 git diff --cached --check
 
 Python 3.12.14; pytest 9.1.1; Ruff 0.15.20
 
 Owned server versions: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2); PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)
 
 Read-only cached origin/main: 73ce118205bfdbb56c18207acc0c1c4e3708c860. No network fetch or production access.
 
 Evidence sanitization: trailing whitespace removed; ephemeral fixture owner tokens redacted where present. No outcomes or test messages changed.
+
+Fix 1, reviewed product BASE db73ad7365790419c4a1a82ec38ae21e4c7233c3; controller-only intervening commits 966fc38 and 3becce0.
+
+fix1-red-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -k fix1 -q
+
+fix1-restart-red-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -k fix1_entrypoint -q
+
+fix1-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -k fix1 -q
+
+fix1-focused-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_run.py tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift -q
+
+fix1-focused-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_run.py tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift -q
+
+fix1-final-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_run.py tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift -q
+
+fix1-other-families-red-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -k 'fix1_workable or fix1_paged' -q
+
+fix1-other-families-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py -k 'fix1_workable or fix1_paged or not lifecycle_reconcile' -q
+
+fix1-all-families-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py -k 'fix1_workable or fix1_paged or fix1_single_response or not lifecycle_reconcile' -q
+
+fix1-shared-helper-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -k fix1_single_response -q
+
+fix1-completed-cleanup-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest 'tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-25-True]' 'tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-23-False]' -q
+
+fix1-completed-cleanup-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest 'tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-25-True]' 'tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-23-False]' -q
+
+fix1-ruff.txt: .venv/bin/python -m ruff check job_discovery/lifecycle/reconcile.py job_discovery/adapters tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_workable.py tests/test_lifecycle_maintenance.py --output-format concise
+
+git diff --check; git diff --cached --check (both final checks passed after evidence whitespace normalization)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-all-families-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-all-families-16.txt
new file mode 100644
index 0000000..2e70279
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-all-families-16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 75%]
+.......................                                                  [100%]
+95 passed, 23 deselected in 10.76s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-16.txt
new file mode 100644
index 0000000..abfb12d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+..                                                                       [100%]
+2 passed in 2.56s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-17.txt
new file mode 100644
index 0000000..f54e86f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-completed-cleanup-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..                                                                       [100%]
+2 passed in 3.56s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-final-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-final-17.txt
new file mode 100644
index 0000000..bbcac7f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-final-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 74%]
+.........................                                                [100%]
+97 passed in 182.94s (0:03:02)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-16.txt
new file mode 100644
index 0000000..38d3492
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 74%]
+.........................                                                [100%]
+97 passed in 182.58s (0:03:02)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-17.txt
new file mode 100644
index 0000000..7779d19
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-focused-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 74%]
+.........................                                                [100%]
+97 passed in 137.03s (0:02:17)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-green-17.txt
new file mode 100644
index 0000000..aaf07ba
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-green-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..........                                                               [100%]
+10 passed, 19 deselected in 31.40s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-17.txt
new file mode 100644
index 0000000..ba9b9ef
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 80%]
+.................                                                        [100%]
+89 passed, 29 deselected in 3.98s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-red-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-red-17.txt
new file mode 100644
index 0000000..58f96d4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-other-families-red-17.txt
@@ -0,0 +1,178 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFF                                                                    [100%]
+=================================== FAILURES ===================================
+____ test_fix1_workable_mixed_response_retains_good_positive[missing_title] ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32974 user=postgres database=poller_lifecycle_test) at 0x7fcd5fd7da90>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd5fd7de50>
+defect = 'missing_title'
+
+    @requires_db
+    @pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
+    def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
+        from job_discovery import http
+        setup_source(conn,3,'workable')
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'shortcode':'0','title':'Role'}
+        bad={'shortcode':'1'} if defect=='missing_title' else (good if defect=='duplicate' else {'title':'No ID'})
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[good,bad]})
+        r.verify_due_sources(conn,max_boards=1)
+        row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+        assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+        assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()['closed_at'] is None
+>       assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status']=='partial'
+E       AssertionError: assert 'complete' == 'partial'
+E
+E         - partial
+E         + complete
+
+tests/test_lifecycle_reconcile.py:546: AssertionError
+------------------------------ Captured log call -------------------------------
+WARNING  job_discovery:workable.py:104 workable: malformed job entry for fixture/1; keeping minimal posting: KeyError: 'title'
+______ test_fix1_workable_mixed_response_retains_good_positive[duplicate] ______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32974 user=postgres database=poller_lifecycle_test) at 0x7fcd5f9ffbf0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd5f9ff9b0>
+defect = 'duplicate'
+
+    @requires_db
+    @pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
+    def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
+        from job_discovery import http
+        setup_source(conn,3,'workable')
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'shortcode':'0','title':'Role'}
+        bad={'shortcode':'1'} if defect=='missing_title' else (good if defect=='duplicate' else {'title':'No ID'})
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[good,bad]})
+        r.verify_due_sources(conn,max_boards=1)
+        row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+>       assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+E       assert (0 == 1)
+
+tests/test_lifecycle_reconcile.py:544: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:347 source enumeration failed or interrupted: 84cef934-3a06-4c65-b07f-19041314c155
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 320, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/workable.py", line 98, in fetch_workable
+    validate_ids(payload["jobs"], "shortcode")
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 51, in validate_ids
+    raise ValueError(f"source listing has missing or duplicate {key}")
+ValueError: source listing has missing or duplicate shortcode
+_____ test_fix1_workable_mixed_response_retains_good_positive[missing_id] ______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32974 user=postgres database=poller_lifecycle_test) at 0x7fcd5f9ffb90>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd5f9ff2f0>
+defect = 'missing_id'
+
+    @requires_db
+    @pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
+    def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
+        from job_discovery import http
+        setup_source(conn,3,'workable')
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'shortcode':'0','title':'Role'}
+        bad={'shortcode':'1'} if defect=='missing_title' else (good if defect=='duplicate' else {'title':'No ID'})
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[good,bad]})
+        r.verify_due_sources(conn,max_boards=1)
+        row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+>       assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+E       assert (0 == 1)
+
+tests/test_lifecycle_reconcile.py:544: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:347 source enumeration failed or interrupted: 6e78e7be-b278-4c6b-8c69-afaa02797e51
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 320, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/workable.py", line 98, in fetch_workable
+    validate_ids(payload["jobs"], "shortcode")
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 51, in validate_ids
+    raise ValueError(f"source listing has missing or duplicate {key}")
+ValueError: source listing has missing or duplicate shortcode
+____ test_fix1_paged_mixed_nonobject_retains_good_positive[smartrecruiters] ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32974 user=postgres database=poller_lifecycle_test) at 0x7fcd5f107020>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd5f105e80>
+family = 'smartrecruiters'
+
+    @requires_db
+    @pytest.mark.parametrize('family',['smartrecruiters','workday'])
+    def test_fix1_paged_mixed_nonobject_retains_good_positive(conn,monkeypatch,family):
+        from job_discovery import http
+        setup_source(conn,3,family,'fixture:wd5:External' if family=='workday' else 'fixture')
+        if family=='smartrecruiters':
+            payload={'content':[{'id':'0','name':'Role'},None],'totalFound':2}
+        else:
+            payload={'jobPostings':[{'externalPath':'0','title':'Role'},None],'total':2}
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:payload)
+        monkeypatch.setattr(http,'post_json',lambda *a,**kw:payload)
+        r.verify_due_sources(conn,max_boards=1)
+        row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+>       assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+E       assert (0 == 1)
+
+tests/test_lifecycle_reconcile.py:563: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:347 source enumeration failed or interrupted: 96c39b51-0888-4f7c-b682-92daee18011d
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 322, in verify_due_sources
+    for posting in postings:
+                   ^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 35, in __next__
+    return next(self.postings)
+           ^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/smartrecruiters.py", line 106, in _fetch_smartrecruiters
+    raise ValueError('invalid listing item')
+ValueError: invalid listing item
+________ test_fix1_paged_mixed_nonobject_retains_good_positive[workday] ________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32974 user=postgres database=poller_lifecycle_test) at 0x7fcd5f1070b0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd5f106270>
+family = 'workday'
+
+    @requires_db
+    @pytest.mark.parametrize('family',['smartrecruiters','workday'])
+    def test_fix1_paged_mixed_nonobject_retains_good_positive(conn,monkeypatch,family):
+        from job_discovery import http
+        setup_source(conn,3,family,'fixture:wd5:External' if family=='workday' else 'fixture')
+        if family=='smartrecruiters':
+            payload={'content':[{'id':'0','name':'Role'},None],'totalFound':2}
+        else:
+            payload={'jobPostings':[{'externalPath':'0','title':'Role'},None],'total':2}
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:payload)
+        monkeypatch.setattr(http,'post_json',lambda *a,**kw:payload)
+        r.verify_due_sources(conn,max_boards=1)
+        row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+>       assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+E       assert (0 == 1)
+
+tests/test_lifecycle_reconcile.py:563: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:347 source enumeration failed or interrupted: 9cec8584-5f06-4d90-9b69-3e5da6f9ff89
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 322, in verify_due_sources
+    for posting in postings:
+                   ^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 35, in __next__
+    return next(self.postings)
+           ^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/workday.py", line 457, in _fetch_workday
+    yield from _page_walk(cxs, {}, first, seen, host=host, site=site, status=status)
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/workday.py", line 327, in _page_walk
+    path = item.get("externalPath")
+           ^^^^^^^^
+AttributeError: 'NoneType' object has no attribute 'get'
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_workable_mixed_response_retains_good_positive[missing_title]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_workable_mixed_response_retains_good_positive[duplicate]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_workable_mixed_response_retains_good_positive[missing_id]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_paged_mixed_nonobject_retains_good_positive[smartrecruiters]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_paged_mixed_nonobject_retains_good_positive[workday]
+5 failed, 29 deselected in 3.65s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-red-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-red-17.txt
new file mode 100644
index 0000000..440b490
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-red-17.txt
@@ -0,0 +1,337 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFFF                                                                 [100%]
+=================================== FAILURES ===================================
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-greenhouse] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a56ffb0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a56fc80>
+ats = 'greenhouse', defect = 'missing_title'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: ab0478f5-3c62-4042-8831-ffe2631c697c
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/greenhouse.py", line 36, in fetch_greenhouse
+    return SourceResult(iter(parse_greenhouse(data)), SourceStatus(fetch_details=fetch_details))
+                             ^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/greenhouse.py", line 16, in parse_greenhouse
+    title=j["title"],
+          ~^^^^^^^^^
+KeyError: 'title'
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-lever] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1621e0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a56e1e0>
+ats = 'lever', defect = 'missing_title'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: 0238da9f-9c35-4bc8-baf3-c46f0e2681a8
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/lever.py", line 40, in fetch_lever
+    return SourceResult(iter(parse_lever(data)), SourceStatus(fetch_details=fetch_details))
+                             ^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/lever.py", line 23, in parse_lever
+    title=j["text"],
+          ~^^^^^^^^
+KeyError: 'text'
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-ashby] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1639b0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a163680>
+ats = 'ashby', defect = 'missing_title'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: e420fad9-3e48-4114-a29e-9d793cf481a9
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/ashby.py", line 31, in fetch_ashby
+    return SourceResult(iter(parse_ashby(data)), SourceStatus(fetch_details=fetch_details))
+                             ^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/ashby.py", line 14, in parse_ashby
+    title=j["title"],
+          ~^^^^^^^^^
+KeyError: 'title'
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-greenhouse] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1ca510>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a1ca8a0>
+ats = 'greenhouse', defect = 'duplicate'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: 999a5c36-57b6-4c82-993e-c1c1cb3b36f5
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/greenhouse.py", line 32, in fetch_greenhouse
+    validate_ids(data["jobs"], "id")
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 51, in validate_ids
+    raise ValueError(f"source listing has missing or duplicate {key}")
+ValueError: source listing has missing or duplicate id
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-lever] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1cb770>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a1ca960>
+ats = 'lever', defect = 'duplicate'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: 367684c5-c68c-41c1-af97-b4e38ab66ac7
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/lever.py", line 39, in fetch_lever
+    validate_ids(data, "id")
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 51, in validate_ids
+    raise ValueError(f"source listing has missing or duplicate {key}")
+ValueError: source listing has missing or duplicate id
+_ test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-ashby] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1c8ce0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a1cbd40>
+ats = 'ashby', defect = 'duplicate'
+
+    @requires_db
+    @pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+    @pytest.mark.parametrize('defect',['missing_title','duplicate'])
+    def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+        from job_discovery import http
+        setup_source(conn,3,ats)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        conn.commit()
+        good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+              'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+        bad=dict(good,id='1')
+        bad.pop('title')
+        bad.pop('text')
+        items=[good,bad if defect=='missing_title' else good]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+        r.verify_due_sources(conn,max_boards=1)
+        rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+>       assert rows[0]['successful_sighting_count']==1
+E       assert 0 == 1
+
+tests/test_lifecycle_reconcile.py:418: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: 9f6d7b9f-f405-4566-abc1-3ea945b7cbf2
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/ashby.py", line 30, in fetch_ashby
+    validate_ids(data["jobs"], "id")
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 51, in validate_ids
+    raise ValueError(f"source listing has missing or duplicate {key}")
+ValueError: source listing has missing or duplicate id
+___ test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration[False] ___
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7a1ca780>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7a1c9340>
+failure_disabled = False
+
+    @requires_db
+    @pytest.mark.parametrize('failure_disabled',[False,True])
+    def test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration(conn,monkeypatch,failure_disabled):
+        from datetime import UTC,datetime
+        from job_discovery import http
+        setup_source(conn)
+        if failure_disabled:
+            conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
+        conn.commit()
+        slot=datetime(2026,10,1,tzinfo=UTC)
+        clock=[slot]
+        scheduled=SourceFixtureClock(conn,clock)
+        calls=[]
+        def feed(*a,**kw):
+            calls.append(clock[0])
+            clock[0]+=timedelta(seconds=20)
+            if failure_disabled:
+                raise ValueError('ordinary fixture unavailable source')
+            return []
+        monkeypatch.setattr(http,'get_json',feed)
+        for backoff in ([1,2,4,7] if failure_disabled else [1,1,1,1]):
+            before=len(calls)
+            r.verify_due_sources(scheduled,max_boards=1)
+            assert len(calls)==before+1
+            next_slot=slot+timedelta(days=backoff)
+            row=conn.execute('SELECT next_due_at FROM source_accounts').fetchone()
+>           assert row['next_due_at']==next_slot
+E           AssertionError: assert datetime.datetime(2026, 10, 2, 0, 0, 20, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')) == datetime.datetime(2026, 10, 2, 0, 0, tzinfo=datetime.timezone.utc)
+
+tests/test_lifecycle_reconcile.py:470: AssertionError
+___ test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration[True] ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32968 user=postgres database=poller_lifecycle_test) at 0x7f2b7955a930>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f2b7955aae0>
+failure_disabled = True
+
+    @requires_db
+    @pytest.mark.parametrize('failure_disabled',[False,True])
+    def test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration(conn,monkeypatch,failure_disabled):
+        from datetime import UTC,datetime
+        from job_discovery import http
+        setup_source(conn)
+        if failure_disabled:
+            conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
+        conn.commit()
+        slot=datetime(2026,10,1,tzinfo=UTC)
+        clock=[slot]
+        scheduled=SourceFixtureClock(conn,clock)
+        calls=[]
+        def feed(*a,**kw):
+            calls.append(clock[0])
+            clock[0]+=timedelta(seconds=20)
+            if failure_disabled:
+                raise ValueError('ordinary fixture unavailable source')
+            return []
+        monkeypatch.setattr(http,'get_json',feed)
+        for backoff in ([1,2,4,7] if failure_disabled else [1,1,1,1]):
+            before=len(calls)
+            r.verify_due_sources(scheduled,max_boards=1)
+            assert len(calls)==before+1
+            next_slot=slot+timedelta(days=backoff)
+            row=conn.execute('SELECT next_due_at FROM source_accounts').fetchone()
+>           assert row['next_due_at']==next_slot
+E           AssertionError: assert datetime.datetime(2026, 10, 2, 0, 0, 20, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')) == datetime.datetime(2026, 10, 2, 0, 0, tzinfo=datetime.timezone.utc)
+
+tests/test_lifecycle_reconcile.py:470: AssertionError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.reconcile:reconcile.py:311 source enumeration failed or interrupted: 590f8a78-2961-44a3-ac2c-1c718c3de4b9
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/reconcile.py", line 284, in verify_due_sources
+    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/lever.py", line 36, in fetch_lever
+    data = get_json(url)
+           ^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 88, in get_json
+    return _request('get_json',url,**kwargs)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/adapters/completeness.py", line 84, in _request
+    return getattr(http, method)(url, **kwargs)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_reconcile.py", line 461, in feed
+    raise ValueError('ordinary fixture unavailable source')
+ValueError: ordinary fixture unavailable source
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-greenhouse]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-lever]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[missing_title-ashby]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-greenhouse]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-lever]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item[duplicate-ashby]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration[False]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration[True]
+8 failed, 19 deselected in 5.09s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-restart-red-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-restart-red-17.txt
new file mode 100644
index 0000000..93f6d9a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-restart-red-17.txt
@@ -0,0 +1,124 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FF                                                                       [100%]
+=================================== FAILURES ===================================
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32969 user=postgres database=poller_lifecycle_test) at 0x7fbc898be540>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbc87fe91f0>
+interruption = 'deadline'
+
+    @requires_db
+    @pytest.mark.parametrize('interruption',['deadline','after_complete'])
+    def test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart(conn,monkeypatch,interruption):
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+        from job_discovery import http
+        source=setup_source(conn,205)
+        conn.commit()
+        calls=[]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:calls.append(1) or [{'id':'extra','text':'Role','hostedUrl':'https://example.test/job'}])
+        clock=[0.0]
+        monkeypatch.setattr(r,'monotonic',lambda:clock[0])
+        actual=r.reconcile_chunk
+        chunks=[]
+        def limited(worker,enum,limit=500):
+            if interruption=='after_complete' and not chunks:
+                chunks.append('interrupted')
+                raise KeyboardInterrupt('ordinary worker interruption after membership completion')
+            done=actual(worker,enum,limit)
+            chunks.append(done)
+            clock[0]+=2
+            return done
+        monkeypatch.setattr(r,'reconcile_chunk',limited)
+        saved=None
+        progress=[]
+        for turn in range(4):
+            with psycopg.connect(TEST_DSN,row_factory=dict_row) as worker:
+                if turn==0 and interruption=='after_complete':
+                    with pytest.raises(KeyboardInterrupt):
+                        r.verify_due_sources(worker,max_boards=1,seconds=1)
+                else:
+                    r.verify_due_sources(worker,max_boards=1,seconds=1)
+            # Every invocation has discarded its worker and connection; it receives
+            # no in-memory EnumerationRef/checkpoint from the preceding invocation.
+            conn.rollback()
+            enum=conn.execute('SELECT * FROM source_enumerations WHERE source_id=%s',(source['id'],)).fetchone()
+            identity=(enum['id'],enum['sequence'],enum['started_at'],enum['completed_at'])
+            if saved is None:
+                saved=identity
+            assert identity==saved
+            progress.append(conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'])
+            conn.commit()
+            if enum['reconciled_at']:
+                break
+>       assert progress==([100,200,205] if interruption=='deadline' else [0,100,200,205])
+E       assert [100, 100, 100, 100] == [100, 200, 205]
+E
+E         At index 1 diff: 100 != 200
+E         Left contains one more item: 100
+E         Use -v to get more diff
+
+tests/test_lifecycle_reconcile.py:522: AssertionError
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32969 user=postgres database=poller_lifecycle_test) at 0x7fbc877d9e20>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbc877d89e0>
+interruption = 'after_complete'
+
+    @requires_db
+    @pytest.mark.parametrize('interruption',['deadline','after_complete'])
+    def test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart(conn,monkeypatch,interruption):
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+        from job_discovery import http
+        source=setup_source(conn,205)
+        conn.commit()
+        calls=[]
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:calls.append(1) or [{'id':'extra','text':'Role','hostedUrl':'https://example.test/job'}])
+        clock=[0.0]
+        monkeypatch.setattr(r,'monotonic',lambda:clock[0])
+        actual=r.reconcile_chunk
+        chunks=[]
+        def limited(worker,enum,limit=500):
+            if interruption=='after_complete' and not chunks:
+                chunks.append('interrupted')
+                raise KeyboardInterrupt('ordinary worker interruption after membership completion')
+            done=actual(worker,enum,limit)
+            chunks.append(done)
+            clock[0]+=2
+            return done
+        monkeypatch.setattr(r,'reconcile_chunk',limited)
+        saved=None
+        progress=[]
+        for turn in range(4):
+            with psycopg.connect(TEST_DSN,row_factory=dict_row) as worker:
+                if turn==0 and interruption=='after_complete':
+                    with pytest.raises(KeyboardInterrupt):
+                        r.verify_due_sources(worker,max_boards=1,seconds=1)
+                else:
+                    r.verify_due_sources(worker,max_boards=1,seconds=1)
+            # Every invocation has discarded its worker and connection; it receives
+            # no in-memory EnumerationRef/checkpoint from the preceding invocation.
+            conn.rollback()
+            enum=conn.execute('SELECT * FROM source_enumerations WHERE source_id=%s',(source['id'],)).fetchone()
+            identity=(enum['id'],enum['sequence'],enum['started_at'],enum['completed_at'])
+            if saved is None:
+                saved=identity
+            assert identity==saved
+            progress.append(conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'])
+            conn.commit()
+            if enum['reconciled_at']:
+                break
+>       assert progress==([100,200,205] if interruption=='deadline' else [0,100,200,205])
+E       assert [0, 0, 0, 0] == [0, 100, 200, 205]
+E
+E         At index 1 diff: 0 != 100
+E         Use -v to get more diff
+
+tests/test_lifecycle_reconcile.py:522: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete]
+2 failed, 27 deselected in 4.76s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-shared-helper-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-shared-helper-17.txt
new file mode 100644
index 0000000..8817905
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fix1-shared-helper-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......                                                                   [100%]
+6 passed, 28 deselected in 5.97s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
index 35f0676..75d6d77 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
@@ -164,10 +164,181 @@ families and single-response identity/malformed/empty fixtures to the other four
 Ashby latest-publication/unlisted fixtures establish frozen age behavior, not a
 new source-publication history backfill.
 
 This is author implementation and ordinary functional evidence only. Independent
 source-correctness and requirements/quality review is pending controller action
 under amended Checkpoint B, followed by Library 06. Task 3 is **not fully
 security-approved**: independent expiry/capacity/cross-user/adversarial review
 gaps remain deliberately unreviewed. No refused probe was reconstructed or
 retried. No new safeguard rejection occurred. Controller owns final all-task
 release; this author stops after the Task 6 forward commit.
+
+## Fix 1 — R6-1, R6-2 and R6-3 ordinary functional corrections
+
+Reviewed product BASE: `db73ad7365790419c4a1a82ec38ae21e4c7233c3`.
+Read the entire independent `task-6-requirements-review.md`, whose verdict was
+**Spec FAIL / Quality CHANGES_REQUIRED**. R6-1, R6-2 and R6-3 are valid findings.
+Controller-only recovery commits `966fc38` and `3becce0` landed during this work;
+they do not change the reviewed product base. This author leaves controller
+ledgers, review reports and dispatches outside the fix commit.
+
+### R6-1: completed membership is now a scheduled resumable responsibility
+
+The existing staging trigger explicitly rejected any change of enumeration
+owner/generation. A new source claim necessarily has a newer generation after
+the old claim becomes terminal; therefore the old completed enumeration could
+not resume through that contract. Reported that exact conflict to the controller
+before touching SQL. The controller authorized the narrow ownership-only repair
+using the existing validated newer same-source claim, with no claim, lease,
+capacity, role/owner, GUC or privilege bypass.
+
+Added `2026-10-03-02-source-reconciliation.sql`, ordered after accepted safety and
+maintenance and before demand migration 03, with the same definitions appended
+to `schema.sql`. It adds a pending-reconciliation index and revises only the
+source staging contract. Enumeration ID/source/sequence remain immutable.
+Ownership handoff is permitted only for an unreconciled complete enumeration,
+with a newer currently validated same-source claim whose replay floor covers
+the former generation. Every other enumeration field must remain unchanged
+under JSONB equality: membership identity, start/completion times and cursor are retained.
+A completed status cannot revert to running, and membership INSERT/UPDATE is
+restricted to running enumerations. Existing fenced maintenance deletion remains
+unchanged. No new privileged helper or security-definer function was added.
+
+`resume_enumeration()` adopts that snapshot and changes the existing checkpoint
+generation in the same caller transaction. The scheduler selects complete pending
+reconciliation regardless of the next feed-verification slot; `verify_due_sources`
+loads it before considering a new enumeration and performs no feed HTTP for
+that resume. A committed nonterminal chunk may still release its claim on exit:
+the next worker reclaims the source and resumes the same sequence/cursor instead
+of counting the membership as a second successful observation. Claim-start order
+also includes reconciliation-only turns, without changing the truthful last
+feed-attempt or complete-success timestamps.
+
+Two actual-entrypoint fixtures reproduced the original defect, then passed after
+the fix. Each invocation discards its worker connection. For 205 listings and one
+committed chunk per invocation, deadline exit progresses **100 → 200 → 205** in
+three turns. Interruption after completed membership but before the first chunk
+progresses **0 → 100 → 200 → 205** in four turns. Both retain the enumeration
+ID/sequence/start/completion times, make exactly one HTTP feed call, and apply
+one miss per listing. Existing unsafe partial-feed restart-at-page-zero coverage
+continues to run. These are ordinary persisted source/caller tests, not a new
+independent review of claim/expiry/capacity mechanisms.
+
+### R6-2: source eligibility follows the authorized UTC cron slots
+
+`next_due_at` now uses midnight UTC of the actual attempt date plus the applicable
+1/2/4/7-day slot interval. Completion duration no longer shifts eligibility past
+the next authorized daily 00:00 UTC invocation. Successful absence qualification
+still compares the separate successful **completion timestamps** with 24 elapsed
+hours; changing scheduling did not relax that condition.
+
+Deterministic entrypoint fixtures advance only source scheduling/evidence clocks
+in a test-local connection wrapper; claim/lease clocks and validators stay real.
+Feeds take a nonzero 20 seconds, with a later 10-second duration. Healthy sources
+are invoked at consecutive daily slots; failure-disabled sources follow the
+1/2/4/7-day slots without extra-day slippage. The healthy second completion less
+than 24 elapsed hours after the first does not close the Job; a later qualifying
+completion does. No cron, supervisor schedule or new wake-up mechanism changed.
+
+### R6-3: identifiable positives survive unrelated response defects
+
+Greenhouse, Lever and Ashby now parse their already-received response items
+incrementally through `iter_identified_postings()`. Good IDs yield immediately.
+A repeated or unreadable identity marks the enumeration incomplete while other
+trustworthy IDs survive. Identifiable items with malformed/missing display fields
+yield minimal positives and mark the response incomplete; missing title/URL
+still prevents new legacy admission. Greenhouse reported-total disagreement also
+marks the response partial while preserving identifiable positives. Pure parser
+APIs and healthy Posting shapes remain compatible; legacy spool consumers still
+refuse absence for incomplete results.
+
+Six DB entrypoint fixtures cover all three families with a good item followed by
+a missing-title item or a duplicate. The good Job reopens and records exactly one
+sighting, while no listing receives absence evidence and the enumeration is
+partial. Existing malformed/duplicate fixture assertions now check retained
+identities and false completeness instead of requiring the whole response to
+throw before yielding. No raw detail payload persistence was introduced.
+
+### Fix 1 evidence and remaining scope
+
+All commands are appended to `task-6-evidence/commands.txt`; outputs prefixed
+`fix1-` preserve the chronology. Fresh owned random-port PostgreSQL 17/16 use the
+accepted harness, with no shared service, provider/API/paid/model calls. RED:
+**8 failed** for R6-2/R6-3, then **2 failed** for R6-1. Initial green on 17.11:
+**10 passed, 19 deliberately deselected**, zero skips. The focused compatibility
+lane includes reconciliation, source completeness, the three changed adapters,
+ordinary run integration and exactly two ordered-migration/catalog-idempotency
+checks. It does not rerun unrelated broad maintenance, supervisor or Task 3
+security lanes. Initial focused 17.11: **97 passed**, 137.03s. Final current-source
+lane results follow below. A final small correction initializes the resumed
+snapshot's known-complete verdict for truthful storage-deferred reporting; it
+never certifies new membership or changes the preserved successful timestamp.
+
+R6-4 (durable above-guard progress) and R6-5 (inherited bounded HTTP transport)
+remain **unresolved functional/rollout blockers**, carried to downstream integration;
+this fix does not waive them or establish full-spec acceptance. The minor
+`closed_jobs` summary undercount remains for Task 13. Task 3's independent
+expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed.
+No refused probe/review was reconstructed, no subagents were spawned, and no
+activation, deployment, publication, merge or infrastructure action occurred.
+Only ordinary source handoff requirements/correctness review is requested next.
+
+Final R6-1/R6-2/three-family R6-3 source: **97 passed on PostgreSQL 17.11**,
+182.94s (`fix1-final-17.txt`), and **97 passed on PostgreSQL 16.15**, 182.58s
+(`fix1-focused-16.txt`), zero skips. These runs include ordered migration/schema
+parity and repeat idempotency. They precede the following explicitly authorized
+adapter-only extension; the migration and run lanes were not rerun for it.
+
+### Authorized remaining-family positive-preservation extension
+
+While implementing R6-3, reported that Workable still validated the whole response
+before its existing per-job fallback, and that SmartRecruiters rejected a whole
+page containing a non-object while Workday collected page IDs via `item.get`
+before yielding. The controller explicitly authorized the analogous narrow
+all-family positive-preservation correction within Fix1. No broad parser rewrite
+or independent mechanism/security review was performed.
+
+Workable now uses the same per-item identity iterator with `shortcode`, retaining
+its existing account-qualified minimal-Posting fallback and diagnostic. Missing
+IDs and duplicates invalidate absence while good items survive; identifiable
+malformed display fields keep a minimal positive and mark the feed partial.
+SmartRecruiters skips non-object items with incomplete status instead of rejecting
+the page before any yields. Workday's page-ID coverage helper marks malformed or
+duplicate identities incomplete without throwing away valid peers; `_page_walk`
+and the first/subsequent `_crawl` partition pages consume it. Existing raw page
+counts, expected-total, cap/wrap, facet and conservative completeness behavior
+remain in place. No detail persistence or extra network call was added.
+
+Five additional DB regressions first failed: three Workable mixed-response cases
+(missing title, duplicate, missing ID) and one same-page good/non-object case for
+each paged family. After correction:
+
+- **89 passed, 29 deliberately deselected on 17.11**, 3.98s: affected remaining
+  adapters, source completeness and the five new DB cases.
+- **6 passed, 28 deliberately deselected on 17.11**, 5.97s: the three original
+  families' mixed-response DB cases after the shared helper extension.
+- **95 passed, 23 deliberately deselected on 16.15**, 10.76s: those scopes together.
+
+All were zero-skip runs. This chronology does not claim the earlier 97-test
+migration/run suite was repeated after the adapter-only extension.
+
+The new authorized completed-membership contract also exposed an old maintenance
+fixture that inserted `status='complete'` before populating membership. Reported
+this exact setup conflict; the controller authorized reordering that fixture
+only. It now inserts running membership and then records the same completed
+snapshot through the valid claim, retaining the original 23/25-hour cleanup
+assertions. Only its two affected completed-window cases ran: **2 passed on
+17.11**, 3.56s, and **2 passed on 16.15**, 2.56s, zero skips. No maintenance product
+code, timing, cap, claim/expiry guard or broad maintenance/security lane changed.
+
+Final Ruff and staged/working whitespace checks passed. Sanitized `fix1-*`
+evidence preserves all failures and outcomes; only trailing whitespace and
+explicit ephemeral fixture-token representations are normalized. No new
+safeguard rejection occurred. R6-1–R6-3 are author-fixed and tested, awaiting
+scoped independent re-review. R6-4/R6-5 and the deliberately unreviewed Task 3
+gaps remain as stated above; no full-spec or full-security approval is claimed.
+
+A transient executor failure occurred before staging: `Failed to create unified
+exec process: exec-server transport disconnected`. The normal same-environment
+read-only status check then succeeded with all files intact; staging resumed
+through the same interface. This was transport recovery, not an approval-review
+rejection or alternate-permission bypass.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-requirements-review.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-requirements-review.md
new file mode 100644
index 0000000..4aeed5d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-requirements-review.md
@@ -0,0 +1,108 @@
+# Task 6 independent requirements and code-quality review
+
+Date: 2026-10-07. Reviewer: recovery_task06_requirements_review.
+
+BASE: `ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409`
+HEAD: `db73ad7365790419c4a1a82ec38ae21e4c7233c3`
+
+**Spec: FAIL. Quality: CHANGES_REQUIRED.** No Critical findings. Five Important findings below; two are already documented integration limitations and three are additional ordinary functional gaps. Development-continuation authorization does not waive these functional requirements or establish release readiness.
+
+## Scope and evidence
+
+Read the reviewer dispatch, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, Task 6 brief/report, full recorded range package and evidence outputs. Inspected the changed product/test files and relevant existing caller/adapter interfaces. Actual worktree HEAD matched the pinned HEAD. Controller documentation changes already present in the worktree were left untouched.
+
+This is a fresh Task 6 requirements/source-correctness and code-quality review. It is not a replacement Task 3 security review. Expiry enforcement, capacity accounting, cross-user isolation and related refused adversarial review/probes remain deliberately unreviewed. No such probes were attempted. No subagents, network/provider/paid calls, production access, DB connections, source edits, commits, activation or deployment were used. No new safeguard rejection occurred.
+
+Author-selected tests were not rerun. Inspected recorded evidence reports:
+
+- PostgreSQL 17.11: broad affected suite 231 passed in 134.78s; PostgreSQL 16.15: 231 passed in 167.87s. These precede the final refinements.
+- Final qualifying-completion source/completeness lanes: 43 passed on 17.11 in 67.68s; 43 passed on 16.15 in 54.97s. Separate caller/rotation lane: 36 passed on 17.11 in 4.33s.
+- Earlier RED and failing integration outputs match the report's chronology (78/8, 132/5, 141/3 passed/failed), followed by 159 passed and 38 passed lanes. Successful recorded lanes show no skips. Commands, scopes, server versions, Python 3.12.14, pytest 9.1.1 and Ruff 0.15.20 are recorded in `task-6-evidence/commands.txt`.
+- These are inspected author results, not independently rerun DB verification. The broad compatibility lane is not represented as having run after all final source changes.
+- Fresh reviewer checks: pinned `git diff --check BASE HEAD` exited 0; two narrow in-memory diagnostics described below exited 0 and demonstrated uncovered ordinary functional problems. Both mocked all external interfaces and used no DB or network.
+
+## Important findings
+
+### R6-1 — Production deadline exit abandons the persisted reconciliation tail
+
+Location: `job_discovery/lifecycle/reconcile.py:320-338`; selection and new-enumeration path at `:51-57` and `:265-267`; checkpoint consumption at `:199-208`.
+
+After a complete feed, the caller commits a reconciliation chunk and exits its loop when the cycle deadline is reached, even when `done` is false. It then unconditionally cancels the claim. There is no production selection/resume path for that incomplete completed enumeration: the next due turn creates a new enumeration, whose checkpoint starts at the beginning. A restart after feed completion likewise has no caller path to load the old enumeration/checkpoint. The completed feed's successful timestamp and next-due timestamp have already advanced.
+
+This defeats the required persisted checkpoint recovery at the actual entrypoint. Repeated exhaustion can keep the same lexicographic tail from receiving absence reconciliation even while repeated feed verification succeeds. Starting mutable *pagination* afresh is appropriate; it does not justify abandoning reconciliation of already complete, immutable membership.
+
+Evidence: `tests/test_lifecycle_reconcile.py:118-135` directly calls `reconcile_chunk` with the same in-memory EnumerationRef on a new connection. It proves that helper can read a checkpoint; it does not exercise scheduled recovery. The reviewer ran the actual `verify_due_sources` with local doubles, an empty complete feed and a `reconcile_chunk` double that advanced monotonic time past the deadline and returned false. Output:
+
+```text
+caller trace: ['complete feed', 'checkpoint committed; done=False', 'cancelled claim']
+reported: {'ok': 1, 'failed': 0, 'new_jobs': 0, 'closed_jobs': 0}
+```
+
+Fix: make pending complete-enumeration reconciliation an explicit resumable scheduler responsibility, with a permitted fenced ownership handoff and persisted cursor. Do not mark that responsibility finished on budget exit. Add an ordinary entrypoint test that stops after a committed nonterminal chunk, discards the worker/connection, resumes through the production scheduler, and proves finite completion of the tail. Keep unsafe partial pagination restarting from page zero.
+
+### R6-2 — Completion-plus-24-hours scheduling skips the next daily cron
+
+Location: `job_discovery/lifecycle/reconcile.py:53` and `:180-187`; sole scheduled invocation at `job_discovery/run.py:120`. Binding cadence: design spec `:134-135`, daily one-shot cron `:176-179`.
+
+For enabled sources, `next_due_at` is completion time plus 24 hours. A board finishing at 00:00:20 UTC is therefore not eligible at the next day's 00:00:00 run. When it is the only board, `claim_due_source` returns None and the run exits; there is no later wake-up. It next verifies approximately 48 hours after the previous attempt. This can happen to healthy small boards without budget pressure, and failure-disabled day-based retries have the analogous extra-day slippage.
+
+The finite-six-turn test explicitly clears `next_due_at` between fixture cycles (`tests/test_lifecycle_reconcile.py:214`), so it does not establish daily scheduled eligibility. This is source/caller analysis, not a runtime cron test.
+
+Fix: align scheduling eligibility to the authorized UTC cron slots (or otherwise provide an authorized due-work invocation that meets the cadence), while keeping the separate **elapsed 24-hour successful-miss qualification** intact. Add ordinary deterministic tests spanning real daily invocation slots and nonzero feed duration. Do not relax the two-miss elapsed-time rule to fix scheduling.
+
+### R6-3 — Three adapters still lose trustworthy positives on later parse failure
+
+Location: `job_discovery/adapters/greenhouse.py:32-36`, `lever.py:39-40`, `ashby.py:30-31`; eager parsers at `greenhouse.py:7-24`, `lever.py:15-31`, `ashby.py:7-22`.
+
+These adapters construct an entire list before returning SourceResult. A valid first item followed by another identifiable item missing title/text raises before any item is exposed to staging. The first valid identity cannot refresh availability, clear misses or reopen its existing Job, although its source response was received successfully. Whole-list identity validation also prevents retaining good identities when a separate item makes absence unsafe. The lazy SourceResult wrapper does not make the enclosed eager parse lazy.
+
+Task 6's all-family trustworthy-positive requirement remains incomplete; this behavior is inherited parsing now used by the new reconciler, not a newly introduced parser regression. SmartRecruiters' streamed final-page behavior does not cover these families.
+
+Evidence: a fresh offline diagnostic patched each adapter's `get_json` to return two distinct IDs, `good` with all required fields and `bad` with a URL but no title/text; invoked the public adapter with `fetch_details=False`; collected yielded IDs. Exact output:
+
+```text
+job_discovery.adapters.greenhouse yielded= [] error= KeyError 'title'
+job_discovery.adapters.lever yielded= [] error= KeyError 'text'
+job_discovery.adapters.ashby yielded= [] error= KeyError 'title'
+```
+
+Fix: separate per-item positive identity acceptance from whole-enumeration absence certification. Yield/stage trustworthy identities despite unrelated malformed items; retain minimal identifiable postings where appropriate and make the enumeration incomplete when identity/completeness cannot be established. Add mixed-valid/malformed and mixed-valid/duplicate fixtures asserting committed good positives and zero absence certification.
+
+### R6-4 — Durable above-guard reconciliation remains unimplemented (known integration limitation)
+
+Location: `job_discovery/lifecycle/reconcile.py:35-42`, `:258-272`, `:300-306`, `:331-371`; `task-6-report.md` “Above-ceiling durable reconciliation is unresolved.”
+
+The prescribed storage-blocked fallback attempts feeds and logs health, but does not persist source health, positive observations, misses or closure reconciliation. Thus the required above-guard durable verification/reconciliation guarantee is absent. Read-only daily rotation proves a bounded attempt for a fixed registered due set; it does not prove durable closure progress or registration of the full corpus.
+
+This finding accepts the controller/author's recorded boundary that the existing claim/reservation/row-validation contracts block these writes. It does not independently re-review or probe capacity accounting. `tests/test_lifecycle_reconcile.py:236-247` changes the outer size-check result only; `:252-266` uses an ordinary claim interface double and verifies truthful logs/no absence. Neither is proof of real enforced above-guard durability.
+
+Fix/handoff: retain as an unresolved functional requirement for Task 10/13/final integration review, implementing an authorized bounded metadata reconciliation path compatible with existing safety contracts and ordinary end-to-end caller evidence. Do not weaken the guard or describe this limitation as waived. Preserve flag-off legacy closure above guard.
+
+### R6-5 — New source budgets inherit transport guarantees they cannot enforce (known integration limitation)
+
+Location: `job_discovery/adapters/completeness.py:74-84`, `job_discovery/http.py:20`, `:49-51`; source pulse and progression at `job_discovery/lifecycle/reconcile.py:278-298`.
+
+The wrapper limits attempts and supplies a timeout argument, but the inherited shared client transparently follows redirects and reads/parses the response without the specified three-redirect, address-revalidation and 10 MiB decompressed-body enforcement. A timeout argument and cooperative monotonic checks do not implement a strict 20-second whole-response deadline. Therefore the claimed board/cycle bounds and <=30-second progressing renewal schedule are conditional on transport and chunk duration; current evidence does not establish the binding end-to-end bounds.
+
+This is limited source/interface assessment of the documented functional gap, with no transport attack/probe, external lookup or blocked mechanism review. The author report already carries it to Task 9/13.
+
+Fix/handoff: implement the shared bounded transport contract and ordinary deterministic transport/caller verification in the designated task; demonstrate the source worker's renewal and elapsed limits with it. Keep the gap explicit until then.
+
+## Requirements supported by inspected implementation/evidence
+
+- All six public adapters expose SourceResult; completeness requires iterator exhaustion. Paged-family changed totals, caps, duplicate/page-wrap and final-page failures are conservative. Single-response endpoints have no fabricated pagination requirement. R6-3 qualifies positive preservation for those endpoints.
+- The reconciliation SQL uses two distinct enumeration sequences and successful completion timestamps at least 24 elapsed hours apart. Same-enumeration membership insertion/checkpoint replay is idempotent. Partial/failed status cannot supply absence; >20 prior-open empty is suspicious. Missing is ignored; unlisted is positive. Exact removed/expired observations are scoped to source/listing identity.
+- Listing sequences and observation timestamps protect newer positives from older absence. Existing job IDs, first_seen, frozen anchors/expiry fields and private FK targets are not rewritten by the new reconciliation path. This is Task 6 mutation review, not independent expiry or isolation enforcement approval.
+- Sightings and reconciliation use 100 identities per business batch; effects/checkpoint are committed together. Network entry follows commits, and the request pulse commits before HTTP. No new network-in-SQL path was identified. Strict wall-time/renewal bounds remain unverified as noted above.
+- Last-attempt ordering plus the recorded six-family fixture establishes finite source-turn fairness under repeated budget exhaustion for that fixed corpus; the test runs two six-turn cycles. It does not establish reconciliation-tail progress (R6-1), actual daily cadence (R6-2), or arbitrary changing-corpus throughput.
+- Failure-disabled sources use 1/2/4/7/7-day backoff arithmetic; deliberate and unknown exclusions are not selected. Source polling is independent of user matching; normal caller source-enabled routing occurs before legacy company ingestion, including the above-guard/no-user entry case.
+- Flag-off legacy ingestion, closure-above-guard, maintenance/supervisor and iterable consumers retain recorded compatibility coverage. Current Task 6 source-enabled mode is metadata-only; lean admission remains Task 7 and is not claimed complete here. Source, retirement and archive activation readiness is not granted by this review.
+
+## Minor notes and cannot-verify items
+
+- `verify_due_sources` initializes `closed_jobs=0` at `reconcile.py:250` and never increments it despite closure writes at `:228-229`; `run.py:121-123` persists that zero. The run summary therefore underreports actual closures. Carry actual committed close counts without double-counting checkpoint replay when completing the reporting interface.
+- Dense multi-statement SQL/control code and an import of private `_write` from `db.py:293` make the interface harder to maintain. Prefer a named shared writer interface during subsequent integration; this is not itself an approval blocker.
+- No independent current-HEAD DB rerun was performed, by dispatch instruction. In particular, no production restart/cron run, real transport boundary, large dynamic-corpus throughput or strict renewal/chunk wall-time guarantee was verified. The two reviewer diagnostics are local ordinary behavior evidence, not DB integration tests.
+- Task 3 independent expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed. Passing author results, this limited source review, or a future functional fix must not be represented as closing those gaps.
+
+Only this review report was added. Product files and controller ledgers were not modified. Author fixes and focused ordinary evidence are required for R6-1 through R6-3; R6-4 and R6-5 remain explicit downstream functional blockers until their designated integration work is complete.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-review-package.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-review-package.md
new file mode 100644
index 0000000..c991613
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-review-package.md
@@ -0,0 +1,2793 @@
+# Full pinned review package
+
+BASE: ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409
+
+HEAD: db73ad7365790419c4a1a82ec38ae21e4c7233c3
+
+## Commits
+
+db73ad7365790419c4a1a82ec38ae21e4c7233c3 feat: reconcile complete source evidence with fair fenced scheduling
+
+
+## Files
+
+ .../task-6-evidence/bounded-17.txt                 |   3 +
+ .../task-6-evidence/callers-17.txt                 |   3 +
+ .../task-6-evidence/commands.txt                   |  51 +++
+ .../task-6-evidence/final-16.txt                   |   6 +
+ .../task-6-evidence/final-17.txt                   |   6 +
+ .../task-6-evidence/final-source-16.txt            |   3 +
+ .../task-6-evidence/final-source-17.txt            |   3 +
+ .../task-6-evidence/first-green-17.txt             | 322 +++++++++++++++++
+ .../task-6-evidence/fourth-green-17.txt            |   5 +
+ .../task-6-evidence/qualifying-completion-16.txt   |   3 +
+ .../task-6-evidence/qualifying-completion-17.txt   |   3 +
+ .../task-6-evidence/red.txt                        |  16 +
+ .../task-6-evidence/ruff.txt                       |   1 +
+ .../task-6-evidence/second-green-17.txt            | 235 ++++++++++++
+ .../task-6-evidence/third-green-17.txt             | 122 +++++++
+ .../task-6-evidence/whitespace.txt                 |   0
+ .../task-6-report.md                               | 173 +++++++++
+ job_discovery/adapters/__init__.py                 |   8 +-
+ job_discovery/adapters/ashby.py                    |   8 +-
+ job_discovery/adapters/completeness.py             |  51 +++
+ job_discovery/adapters/greenhouse.py               |  10 +-
+ job_discovery/adapters/lever.py                    |   8 +-
+ job_discovery/adapters/smartrecruiters.py          |  23 +-
+ job_discovery/adapters/workable.py                 |  10 +-
+ job_discovery/adapters/workday.py                  |   8 +-
+ job_discovery/db.py                                |  33 ++
+ job_discovery/lifecycle/reconcile.py               | 371 +++++++++++++++++++
+ job_discovery/run.py                               |  17 +
+ tests/test_lifecycle_reconcile.py                  | 398 +++++++++++++++++++++
+ tests/test_maintenance_controlflow.py              |   1 +
+ tests/test_size_guard.py                           |   6 +
+ tests/test_smartrecruiters.py                      |  14 +-
+ tests/test_source_completeness.py                  |  79 ++++
+ tests/test_workable.py                             |   4 +-
+ 34 files changed, 1966 insertions(+), 38 deletions(-)
+
+
+## Complete diff
+
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt
+new file mode 100644
+index 0000000..6ffe217
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++......................................                                   [100%]
++38 passed in 38.90s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt
+new file mode 100644
+index 0000000..af26022
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++....................................                                     [100%]
++36 passed in 4.33s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
+new file mode 100644
+index 0000000..dde24c9
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
+@@ -0,0 +1,51 @@
++Working directory: /workspace/job-board/.claude/worktrees/lifecycle-recovery
++
++Shell: /bin/bash; login=false
++
++BASE: ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409
++
++No ambient DSNs used; harness provisions a distinct owned random-loopback-port container per call.
++
++
++
++red.txt: .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -q
++
++first-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py -q
++
++second-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
++
++third-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
++
++fourth-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
++
++bounded-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
++
++final-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_lifecycle_supervisor.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_service_order.py tests/test_run_question_fetch.py -q
++
++final-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_lifecycle_supervisor.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_service_order.py tests/test_run_question_fetch.py -q
++
++final-source-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
++
++final-source-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
++
++callers-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py::test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget tests/test_company_enrich.py -q
++
++qualifying-completion-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
++
++qualifying-completion-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
++
++
++
++ruff.txt: .venv/bin/python -m ruff check job_discovery tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_smartrecruiters.py tests/test_workable.py tests/test_size_guard.py tests/test_maintenance_controlflow.py --output-format concise
++
++git diff --check
++
++git diff --cached --check
++
++Python 3.12.14; pytest 9.1.1; Ruff 0.15.20
++
++Owned server versions: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2); PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)
++
++Read-only cached origin/main: 73ce118205bfdbb56c18207acc0c1c4e3708c860. No network fetch or production access.
++
++Evidence sanitization: trailing whitespace removed; ephemeral fixture owner tokens redacted where present. No outcomes or test messages changed.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt
+new file mode 100644
+index 0000000..358fb67
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt
+@@ -0,0 +1,6 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++........................................................................ [ 31%]
++........................................................................ [ 62%]
++........................................................................ [ 93%]
++...............                                                          [100%]
++231 passed in 167.87s (0:02:47)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt
+new file mode 100644
+index 0000000..34b989b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt
+@@ -0,0 +1,6 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++........................................................................ [ 31%]
++........................................................................ [ 62%]
++........................................................................ [ 93%]
++...............                                                          [100%]
++231 passed in 134.78s (0:02:14)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt
+new file mode 100644
+index 0000000..d25f7f9
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++...........................................                              [100%]
++43 passed in 64.90s (0:01:04)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt
+new file mode 100644
+index 0000000..8a5eabe
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++..........................................                               [100%]
++42 passed in 74.56s (0:01:14)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt
+new file mode 100644
+index 0000000..bd07409
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt
+@@ -0,0 +1,322 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++FFFFFF.................................FF............................... [ 83%]
++..............                                                           [100%]
++=================================== FAILURES ===================================
++____________ test_two_distinct_complete_misses_exact_24h_and_replay ____________
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777bbe3e00>
++
++    @requires_db
++    def test_two_distinct_complete_misses_exact_24h_and_replay(conn):
++>       source = setup_source(conn)
++                 ^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:48:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777bbe3e00>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++_ test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset __
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76c140>
++
++    @requires_db
++    def test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset(conn):
++>       source = setup_source(conn)
++                 ^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:69:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76c140>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++______________________ test_empty_threshold[20-complete] _______________________
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b7685c0>
++count = 20, expected = 'complete'
++
++    @requires_db
++    @pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
++    def test_empty_threshold(conn, count, expected):
++>       source = setup_source(conn, count)
++                 ^^^^^^^^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:90:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b7685c0>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++_______________________ test_empty_threshold[21-partial] _______________________
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76bbc0>
++count = 21, expected = 'partial'
++
++    @requires_db
++    @pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
++    def test_empty_threshold(conn, count, expected):
++>       source = setup_source(conn, count)
++                 ^^^^^^^^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:90:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76bbc0>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++________ test_unknown_or_missing_never_closes_and_partial_never_counts _________
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b768860>
++
++    @requires_db
++    def test_unknown_or_missing_never_closes_and_partial_never_counts(conn):
++>       source = setup_source(conn)
++                 ^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:99:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b768860>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++__________________ test_cancelled_enumeration_cannot_complete __________________
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b745070>
++
++    @requires_db
++    def test_cancelled_enumeration_cannot_complete(conn):
++>       source = setup_source(conn)
++                 ^^^^^^^^^^^^^^^^^^
++
++tests/test_lifecycle_reconcile.py:110:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_lifecycle_reconcile.py:21: in setup_source
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b745070>
++query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
++params = None, prepare = None, binary = False
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool = False,
++    ) -> Cursor[Row]:
++        """Execute a query and return a cursor to read its results."""
++        try:
++            cur = self.cursor()
++            if binary:
++                cur.format = BINARY
++
++            if isinstance(query, Template):
++                if params is not None:
++                    raise TypeError(
++                        "'execute()' with string template query doesn't support parameters"
++                    )
++                return cur.execute(query, prepare=prepare)
++            else:
++                return cur.execute(query, params, prepare=prepare)
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.RaiseException: control changes require a newer activation generation
++E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
++_______________________ test_missing_content_key_raises ________________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f777b7473e0>
++
++    def test_missing_content_key_raises(monkeypatch):
++        monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
++>       with pytest.raises(ValueError, match="missing 'content'"):
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       Failed: DID NOT RAISE ValueError
++
++tests/test_smartrecruiters.py:205: Failed
++__________ test_short_page_below_reported_total_is_not_authoritative ___________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f777b7281a0>
++
++    def test_short_page_below_reported_total_is_not_authoritative(monkeypatch):
++        monkeypatch.setattr(smartrecruiters, "get_json", lambda *a: {"totalFound": 50, "content": []})
++>       with pytest.raises(ValueError, match="incomplete"):
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       Failed: DID NOT RAISE ValueError
++
++tests/test_smartrecruiters.py:211: Failed
++=========================== short test summary info ============================
++FAILED tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay
++FAILED tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset
++FAILED tests/test_lifecycle_reconcile.py::test_empty_threshold[20-complete]
++FAILED tests/test_lifecycle_reconcile.py::test_empty_threshold[21-partial] - ...
++FAILED tests/test_lifecycle_reconcile.py::test_unknown_or_missing_never_closes_and_partial_never_counts
++FAILED tests/test_lifecycle_reconcile.py::test_cancelled_enumeration_cannot_complete
++FAILED tests/test_smartrecruiters.py::test_missing_content_key_raises - Faile...
++FAILED tests/test_smartrecruiters.py::test_short_page_below_reported_total_is_not_authoritative
++8 failed, 78 passed in 2.41s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt
+new file mode 100644
+index 0000000..d4388b5
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt
+@@ -0,0 +1,5 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++........................................................................ [ 45%]
++........................................................................ [ 90%]
++...............                                                          [100%]
++159 passed in 27.26s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt
+new file mode 100644
+index 0000000..125e00e
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++...........................................                              [100%]
++43 passed in 54.97s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt
+new file mode 100644
+index 0000000..5a2aa84
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++...........................................                              [100%]
++43 passed in 67.68s (0:01:07)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt
+new file mode 100644
+index 0000000..103f58b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt
+@@ -0,0 +1,16 @@
++
++==================================== ERRORS ====================================
++______________ ERROR collecting tests/test_lifecycle_reconcile.py ______________
++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_reconcile.py'.
++Hint: make sure your test modules/packages have valid Python names.
++Traceback:
++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
++    return _bootstrap._gcd_import(name[level:], package, level)
++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++tests/test_lifecycle_reconcile.py:8: in <module>
++    from job_discovery.lifecycle import reconcile as r
++E   ImportError: cannot import name 'reconcile' from 'job_discovery.lifecycle' (/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/__init__.py)
++=========================== short test summary info ============================
++ERROR tests/test_lifecycle_reconcile.py
++!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
++1 error in 0.14s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt
+new file mode 100644
+index 0000000..1f5f344
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt
+@@ -0,0 +1 @@
++All checks passed!
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt
+new file mode 100644
+index 0000000..f54c269
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt
+@@ -0,0 +1,235 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.......................................F................................ [ 52%]
++..................................................FF........FF...        [100%]
++=================================== FAILURES ===================================
++_______________________ test_missing_content_key_raises ________________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a954cb0>
++
++    def test_missing_content_key_raises(monkeypatch):
++        monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
++>       with pytest.raises(ValueError, match="missing 'content'"):
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       Failed: DID NOT RAISE ValueError
++
++tests/test_smartrecruiters.py:205: Failed
++________________ test_job_discovery_run_skips_when_over_ceiling ________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a6e26f0>
++
++    def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
++        conn = _GuardConn()
++        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
++        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
++        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
++        _forbid_poll_body(monkeypatch)
++        started = {"called": False}
++        monkeypatch.setattr(job_discovery_run.db, "start_run",
++                            lambda c: started.__setitem__("called", True) or 1)
++
++>       job_discovery_run.run()
++
++tests/test_size_guard.py:166:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_size_guard._GuardConn object at 0x7f784a6e3620>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
++
++job_discovery/lifecycle/config.py:31: TypeError
++------------------------------ Captured log call -------------------------------
++ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
++Traceback (most recent call last):
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
++    enter_gate(conn)
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
++    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
++    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
++KeyError: 'transaction_isolation'
++WARNING  job_discovery:run.py:103 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
++_______________ test_job_discovery_run_prunes_when_over_ceiling ________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a6e00e0>
++
++    def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
++        """prune_jobs must still run when the size guard short-circuits the poll.
++
++        Prune is the only mechanism that can shrink the DB; skipping it on the
++        over-ceiling path would stall recovery.
++        """
++        conn = _GuardConn()
++        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
++        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
++        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
++        _forbid_poll_body(monkeypatch)
++        started = {"called": False}
++        monkeypatch.setattr(job_discovery_run.db, "start_run",
++                            lambda c: started.__setitem__("called", True) or 1)
++
++        prune_calls = {"n": 0}
++
++        def fake_prune(c):
++            prune_calls["n"] += 1
++
++        import job_discovery.prune as prune_module
++        monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)
++
++>       job_discovery_run.run()
++
++tests/test_size_guard.py:200:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_size_guard._GuardConn object at 0x7f784a6e3050>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
++
++job_discovery/lifecycle/config.py:31: TypeError
++------------------------------ Captured log call -------------------------------
++ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
++Traceback (most recent call last):
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
++    enter_gate(conn)
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
++    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
++    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
++KeyError: 'transaction_isolation'
++WARNING  job_discovery:run.py:103 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
++_____ test_denied_reconnect_lock_aborts_before_all_optional_phases[False] ______
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a78dbe0>
++accounting_fails = False
++
++    @pytest.mark.parametrize('accounting_fails', [False, True])
++    def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
++        finished, closes = [], []
++        class Connection:
++            def __init__(self, locked, broken=False):
++                self.locked, self.broken = locked, broken
++            def execute(self, *args):
++                return Result({'locked':self.locked})
++            def commit(self):
++                pass
++            def rollback(self):
++                if self.broken:
++                    raise RuntimeError('broken rollback')
++            def close(self):
++                closes.append(self.locked)
++        connections = iter([Connection(True,True),Connection(False)])
++        monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
++        monkeypatch.setattr(run,'load_targets',lambda: [])
++        monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
++        monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
++        monkeypatch.setattr(run.db,'start_run',lambda c: 1)
++        monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
++        monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
++        def finish(*args, **kw):
++            finished.append(kw)
++            if accounting_fails:
++                raise RuntimeError('accounting unavailable')
++        monkeypatch.setattr(run.db,'finish_run',finish)
++        def source(token):
++            raise RuntimeError('source unavailable')
++        monkeypatch.setitem(run.ADAPTERS,'lever',source)
++        def forbidden(*args,**kwargs):
++            pytest.fail('aborted poll entered an optional phase')
++        monkeypatch.setattr(run,'_run_prune',forbidden)
++        monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
++        monkeypatch.setattr('reviewer.run.review_all',forbidden)
++>       assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
++               ^^^^^^^^^
++
++tests/test_maintenance_controlflow.py:137:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_maintenance_controlflow.test_denied_reconnect_lock_aborts_before_all_optional_phases.<locals>.Connection object at 0x7f784a84a9f0>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^
++E       AttributeError: 'Connection' object has no attribute 'cursor'
++
++job_discovery/lifecycle/config.py:31: AttributeError
++______ test_denied_reconnect_lock_aborts_before_all_optional_phases[True] ______
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a8494c0>
++accounting_fails = True
++
++    @pytest.mark.parametrize('accounting_fails', [False, True])
++    def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
++        finished, closes = [], []
++        class Connection:
++            def __init__(self, locked, broken=False):
++                self.locked, self.broken = locked, broken
++            def execute(self, *args):
++                return Result({'locked':self.locked})
++            def commit(self):
++                pass
++            def rollback(self):
++                if self.broken:
++                    raise RuntimeError('broken rollback')
++            def close(self):
++                closes.append(self.locked)
++        connections = iter([Connection(True,True),Connection(False)])
++        monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
++        monkeypatch.setattr(run,'load_targets',lambda: [])
++        monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
++        monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
++        monkeypatch.setattr(run.db,'start_run',lambda c: 1)
++        monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
++        monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
++        def finish(*args, **kw):
++            finished.append(kw)
++            if accounting_fails:
++                raise RuntimeError('accounting unavailable')
++        monkeypatch.setattr(run.db,'finish_run',finish)
++        def source(token):
++            raise RuntimeError('source unavailable')
++        monkeypatch.setitem(run.ADAPTERS,'lever',source)
++        def forbidden(*args,**kwargs):
++            pytest.fail('aborted poll entered an optional phase')
++        monkeypatch.setattr(run,'_run_prune',forbidden)
++        monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
++        monkeypatch.setattr('reviewer.run.review_all',forbidden)
++>       assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
++               ^^^^^^^^^
++
++tests/test_maintenance_controlflow.py:137:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_maintenance_controlflow.test_denied_reconnect_lock_aborts_before_all_optional_phases.<locals>.Connection object at 0x7f784a84a0f0>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^
++E       AttributeError: 'Connection' object has no attribute 'cursor'
++
++job_discovery/lifecycle/config.py:31: AttributeError
++=========================== short test summary info ============================
++FAILED tests/test_smartrecruiters.py::test_missing_content_key_raises - Faile...
++FAILED tests/test_size_guard.py::test_job_discovery_run_skips_when_over_ceiling
++FAILED tests/test_size_guard.py::test_job_discovery_run_prunes_when_over_ceiling
++FAILED tests/test_maintenance_controlflow.py::test_denied_reconnect_lock_aborts_before_all_optional_phases[False]
++FAILED tests/test_maintenance_controlflow.py::test_denied_reconnect_lock_aborts_before_all_optional_phases[True]
++5 failed, 132 passed in 19.37s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt
+new file mode 100644
+index 0000000..6e97511
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt
+@@ -0,0 +1,122 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++......F................................................................. [ 50%]
++.........................................................FF............. [100%]
++=================================== FAILURES ===================================
++_ test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence _
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32958 user=postgres database=poller_lifecycle_test) at 0x7fcd1ac5d010>
++
++    @requires_db
++    def test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence(conn):
++        import psycopg
++        from psycopg.rows import dict_row
++        from tests.conftest import TEST_DSN
++        source = setup_source(conn, 105)
++        enum = begin(conn,source)
++        r.complete_enumeration(conn,enum,SourceStatus())
++>       assert not r.reconcile_chunk(conn,enum,100)
++E       AssertionError: assert not True
++E        +  where True = <function reconcile_chunk at 0x7fcd1c563880>(<psycopg.Connection [INTRANS] (host=127.0.0.1 port=32958 user=postgres database=poller_lifecycle_test) at 0x7fcd1ac5d010>, EnumerationRef(id=UUID('d6fe9769-0383-42b8-bcbc-d8b402c4b795'), source_id=UUID('98459879-8db4-41b8-a278-5d6e2838393f')...generation=1, lease_until=datetime.datetime(2026, 10, 7, 15, 33, 51, 838743, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))), 100)
++E        +    where <function reconcile_chunk at 0x7fcd1c563880> = r.reconcile_chunk
++
++tests/test_lifecycle_reconcile.py:126: AssertionError
++________________ test_job_discovery_run_skips_when_over_ceiling ________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd1aa2c140>
++
++    def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
++        conn = _GuardConn()
++        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
++        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
++        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
++        _forbid_poll_body(monkeypatch)
++        started = {"called": False}
++        monkeypatch.setattr(job_discovery_run.db, "start_run",
++                            lambda c: started.__setitem__("called", True) or 1)
++
++>       job_discovery_run.run()
++
++tests/test_size_guard.py:166:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_size_guard._GuardConn object at 0x7fcd1aa2ec90>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
++
++job_discovery/lifecycle/config.py:31: TypeError
++------------------------------ Captured log call -------------------------------
++ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
++Traceback (most recent call last):
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
++    enter_gate(conn)
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
++    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
++    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
++KeyError: 'transaction_isolation'
++WARNING  job_discovery:run.py:104 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
++_______________ test_job_discovery_run_prunes_when_over_ceiling ________________
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd1aa2ff50>
++
++    def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
++        """prune_jobs must still run when the size guard short-circuits the poll.
++
++        Prune is the only mechanism that can shrink the DB; skipping it on the
++        over-ceiling path would stall recovery.
++        """
++        conn = _GuardConn()
++        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
++        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
++        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
++        _forbid_poll_body(monkeypatch)
++        started = {"called": False}
++        monkeypatch.setattr(job_discovery_run.db, "start_run",
++                            lambda c: started.__setitem__("called", True) or 1)
++
++        prune_calls = {"n": 0}
++
++        def fake_prune(c):
++            prune_calls["n"] += 1
++
++        import job_discovery.prune as prune_module
++        monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)
++
++>       job_discovery_run.run()
++
++tests/test_size_guard.py:200:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++job_discovery/run.py:111: in run
++    source_enabled = read_control(conn).source_enabled
++                     ^^^^^^^^^^^^^^^^^^
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++conn = <tests.test_size_guard._GuardConn object at 0x7fcd1aa2c500>
++
++    def read_control(conn) -> LifecycleControl:
++>       with conn.cursor(row_factory=dict_row) as cur:
++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
++
++job_discovery/lifecycle/config.py:31: TypeError
++------------------------------ Captured log call -------------------------------
++ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
++Traceback (most recent call last):
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
++    enter_gate(conn)
++  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
++    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
++    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
++KeyError: 'transaction_isolation'
++WARNING  job_discovery:run.py:104 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
++=========================== short test summary info ============================
++FAILED tests/test_lifecycle_reconcile.py::test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence
++FAILED tests/test_size_guard.py::test_job_discovery_run_skips_when_over_ceiling
++FAILED tests/test_size_guard.py::test_job_discovery_run_prunes_when_over_ceiling
++3 failed, 141 passed in 32.09s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/whitespace.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/whitespace.txt
+new file mode 100644
+index 0000000..e69de29
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
+new file mode 100644
+index 0000000..35f0676
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
+@@ -0,0 +1,173 @@
++# Task 6 — full-corpus source reconciliation
++
++Author BASE: `ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409`. Fresh sole author;
++no author subagents or reviewer substitutions. Read the review-scope amendment,
++release authorization, Task 6 brief/dispatch and repository instructions before
++implementation. Task 5's accepted interfaces were used without replaying its
++history. The cached upstream reference is recorded in the evidence; no remote
++fetch, production access, provider crawl, paid/model call, deployment, activation,
++merge, push, infrastructure/IAM or unrelated Railway change occurred.
++
++## Implemented
++
++All six adapters return `SourceResult`. Its `complete` property is false until
++iterator exhaustion and remains false after errors, caps or unsafe pagination.
++The four single-response public listing endpoints retain their established
++response shape and request behavior; SmartRecruiters now streams pages instead
++of losing earlier positives when a final page fails. Workday and SmartRecruiters
++reject changed totals as absence evidence. Existing Workday partition/cap/wrap
++handling remains conservative. `fetch_details=False` is accepted across all six;
++Greenhouse/Workable request listing-only bodies, and Workday/SmartRecruiters do
++not fetch per-job details. Legacy consumers still iterate the same Posting API.
++Tests that indexed previous eager lists now explicitly materialize iterators.
++
++`lifecycle/reconcile.py` supplies the five requested interfaces, plus bounded
++posting staging and scheduled orchestration. It consumes the existing canonical
++source/claim/staging/checkpoint schema and reservation interfaces; no migration,
++SQL safety function, trigger, capacity guard, or RLS change was made. Every new
++source write uses the established reservation/binding/settlement protocol even
++before enforced cutover. Global gate and sorted Job locks precede Job mutation.
++Network work starts after commits; request hooks renew and commit before HTTP.
++
++Membership and positive sightings commit in at most 100-identity batches, keeping
++multiple listing/member/Job effects under the 500-row business-write ceiling.
++Staging retains the source ID and a small evidence-kind object (or an empty
++object for an unadmitted ID); raw descriptions, questions and unused detail
++payloads are not persisted. Existing Job IDs, private FK targets, first_seen,
++frozen discovery anchors and expiration dates are retained. Positive observations
++reopen the existing Job and clear misses. Unlisted means positive availability;
++missing is unknown. Explicit removed/expired observations affect only the exact
++validated source/listing identity.
++
++Only complete successful enumerations supply misses. Two distinct successful
++misses whose **completion timestamps** are at least 24 elapsed UTC hours apart
++can close a listing; replay does not add a miss or sighting. The enumeration start
++cutoff and listing membership/direct-verification sequence prevent older absence
++from defeating a later positive. Empty with more than 20 prior open mapped jobs
++is partial/suspicious, regardless of repeated emptiness. Failed/partial sources
++retain previously committed positives but supply no absence.
++
++Source attempts, complete-success timestamps, outcome, failure streak,
++suspicious-empty streak and next-due times are separate from user matching.
++Enabled boards are due after 24 hours. Failure-disabled retries back off through
++1, 2, 4, 7, 7 days; a successful verification clears the streak without changing
++exclusion state. Deliberate exclusions remain excluded. New legacy companies are
++registered in bounded slices; inactive companies with unknown disable reasons
++remain unknown rather than being guessed back into service.
++
++The ordinary one-shot `run()` now branches on the persisted source flag before
++legacy company ingestion, regardless of the capacity/admission outcome. The
++source-enabled branch verifies the registered corpus and registers up to 100
++new source accounts per cycle. It does not consult active matching users. It is
++metadata-only pending Task 7 lean admission. With the flag off, existing legacy
++cache admission, closure-above-guard, reviewer and pruning behavior remain on
++the tested existing path. Source/retirement/archive flags remain at their defaults;
++retirement stays dry-run. Supervisor/maintenance timings were not modified.
++
++## Cursor, recovery and caller inventory
++
++- `source_accounts.last_attempt_at`, complete-success time and deterministic ID
++  order choose due sources. A large interrupted board moves behind untouched
++  sources. Per-board budgets are 50 listing requests, 60 seconds of cooperative
++  work, and 10,000 identities; a poll cycle is bounded to 100 boards/300 seconds
++  of cooperative work. Inherited HTTP caveats below qualify wall-clock bounds.
++- `source_enumerations`: immutable source/sequence/owner/generation; running,
++  complete, partial and failed states; database start/completion/reconciliation
++  times. Each interrupted mutable feed starts a fresh sequence at page zero.
++  Old committed positives survive; partial pages are never concatenated into a
++  supposedly complete membership snapshot.
++- `enumeration_members`: exact external-ID primary key makes same-enumeration
++  staging/sighting replay idempotent. No lifetime per-poll observation log added.
++- `reconciliation_checkpoints`: lexicographic last external ID, committed count,
++  generation and completion marker advance in the same transaction as effects.
++  A fresh connection with the same current claim resumes committed reconciliation.
++  A cancelled/reassigned feed must start a fresh enumeration; existing replay
++  floors and Task 4 cleanup retain their established responsibilities.
++- `source_accounts.reconciliation_cursor` mirrors chunk progress; the completed
++  enumeration marker is written only after the last chunk. Partial/failed runs
++  receive an empty completed reconciliation checkpoint without absence effects.
++- Production call sites are `run()` -> `verify_due_sources()` -> adapter ->
++  staging/completion/reconciliation; legacy `run()` -> `spool_feed()`; and
++  `company_discovery.enrich.enrich_from_jd()`'s existing iterable consumer. The latter
++  received an additional focused compatibility run. No source HTTP was added
++  to the DB-only maintenance worker or reviewer supervisor.
++
++Finite fixture bound: one huge source plus five small sources across all six ATS
++families, repeatedly exhausting request **or** time budgets, gives every source
++one turn in six fresh invocations, repeated for two cycles. The read-only storage
++fallback rotates first position by database UTC day; for a fixed six-source due
++set and one allowed turn, all six get an attempt within six fixture days without
++changing source rows. A local test-only expression substitution exercises these
++days; no production clock override exists. Worker-interruption fixtures verify
++100 committed positives survive and the next worker starts at offset zero.
++
++## Verification and chronology
++
++Exact commands and server/tool versions are in `task-6-evidence/commands.txt`.
++Every DB run used the accepted harness, newly owned loopback random-port
++containers and the allowlisted test environment, never shared port 55432.
++All successful lanes below had **zero skips**. All HTTP was replaced by local
++fixture functions; no public-company or provider call was used.
++
++- RED: missing reconciliation module produced the expected collection failure.
++- First integration attempt: 78 passed/8 failed (fixture control activation
++  generation and eager-to-lazy test expectations). Next: 132 passed/5 failed
++  (remaining eager expectation and legacy connection doubles needing explicit
++  source-off control). Next: 141 passed/3 failed (a checkpoint fixture accidentally
++  triggered the >20 suspicious-empty rule plus two remaining control doubles).
++- Corrected expanded lane: **159 passed** on PostgreSQL 17.11. Later reservation
++  and time-budget-focused lane: **38 passed** on 17.11.
++- Broad affected adapter/source/run/maintenance/supervisor/spool/service-order/
++  question compatibility suite: **231 passed on PostgreSQL 17.11**, 134.78s;
++  **231 passed on PostgreSQL 16.15**, 167.87s.
++- Final ordinary refinements after the broad run: read-only exhausted request
++  budgets report partial rather than failed; 24-hour qualification is based on
++  successful completion time rather than enumeration start; added a read-only
++  daily-rotation fixture. Narrow final source/completeness rechecks are recorded
++  in `qualifying-completion-17.txt`: **43 passed on 17.11**, 67.68s;
++  and `qualifying-completion-16.txt`: **43 passed on 16.15**, 54.97s. These
++  final runs cover the current product source. The broad compatibility results
++  above precede these two narrow refinements; no broad rerun is implied.
++- Additional caller/rotation run: **36 passed on 17.11**, 4.33s.
++- Ruff and working/staged whitespace checks are recorded separately. No new
++  independent approval is inferred from any passing author test.
++
++## Explicit limitations and downstream handoff
++
++**Above-ceiling durable reconciliation is unresolved.** Existing
++`claim_work()` rejects a first claim without headroom; `reserve_capacity()`
++rejects forecasts above 6000 MiB; the existing enforced `lifecycle_validate_row`
++charges changed source_accounts/source_listings/source_enumerations/staging rows
++as growth even for operational counters/closure metadata. Task 6 does not weaken
++those contracts. A bounded read-only full-feed attempt still runs, logs truthful
++healthy/partial/failed plus storage-blocked/reconciliation-deferred, and never
++certifies absence or calls a healthy source failed because persistence failed.
++It cannot promise durable above-guard health/positive/closure progress, and new
++unregistered accounts also require storage. The controller explicitly accepted
++this as a functional/rollout limitation for later Task 10/13 integration review.
++The six-day fallback fairness proof applies to a fixed registered due corpus.
++
++**The shared HTTP transport contract is inherited, not repaired here.** The new
++context applies no retries, a request-count budget, cooperative elapsed checks,
++and a request timeout capped at 20 seconds. Existing `job_discovery.http` still
++follows redirects and does not establish the global redirect/address revalidation,
++10 MiB decompressed-byte, or strict whole-response wall-clock guarantees. Thus
++cooperative budget tests are not proof of those transport guarantees. The
++controller carried this explicit limitation to Task 9/13.
++
++**Intermediate activation remains unsuitable.** Source-enabled polling defers
++payload/admission growth until Task 7; existing cache growth stays on the legacy
++flag-off path. Unknown legacy exclusion reasons remain excluded pending explicit
++classification. Adapters with single-response endpoints have no fictional
++multi-page fixture; pagination/final-page/cap fixtures apply to the two paged
++families and single-response identity/malformed/empty fixtures to the other four.
++Ashby latest-publication/unlisted fixtures establish frozen age behavior, not a
++new source-publication history backfill.
++
++This is author implementation and ordinary functional evidence only. Independent
++source-correctness and requirements/quality review is pending controller action
++under amended Checkpoint B, followed by Library 06. Task 3 is **not fully
++security-approved**: independent expiry/capacity/cross-user/adversarial review
++gaps remain deliberately unreviewed. No refused probe was reconstructed or
++retried. No new safeguard rejection occurred. Controller owns final all-task
++release; this author stops after the Task 6 forward commit.
+diff --git a/job_discovery/adapters/__init__.py b/job_discovery/adapters/__init__.py
+index 9eba8c8..240e2bb 100644
+--- a/job_discovery/adapters/__init__.py
++++ b/job_discovery/adapters/__init__.py
+@@ -1,19 +1,19 @@
+-from collections.abc import Callable, Iterable
++from collections.abc import Callable
+ 
+ from job_discovery.adapters.ashby import fetch_ashby
+ from job_discovery.adapters.greenhouse import fetch_greenhouse
+ from job_discovery.adapters.lever import fetch_lever
+ from job_discovery.adapters.smartrecruiters import fetch_smartrecruiters
+ from job_discovery.adapters.workable import fetch_workable
+ from job_discovery.adapters.workday import fetch_workday
+-from job_discovery.models import Posting
++from job_discovery.adapters.completeness import SourceResult
+ 
+-# Adapters return an Iterable (list or generator); run.py iterates with `for`.
+-ADAPTERS: dict[str, Callable[[str], Iterable[Posting]]] = {
++# Every adapter exposes completeness only after exhaustion.
++ADAPTERS: dict[str, Callable[..., SourceResult]] = {
+     "greenhouse": fetch_greenhouse,
+     "lever": fetch_lever,
+     "ashby": fetch_ashby,
+     "workable": fetch_workable,
+     "smartrecruiters": fetch_smartrecruiters,
+     "workday": fetch_workday,
+ }
+diff --git a/job_discovery/adapters/ashby.py b/job_discovery/adapters/ashby.py
+index e2d32e0..85d439d 100644
+--- a/job_discovery/adapters/ashby.py
++++ b/job_discovery/adapters/ashby.py
+@@ -1,12 +1,12 @@
+-from job_discovery.adapters.completeness import validate_ids
+-from job_discovery.http import get_json
++from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
++from job_discovery.adapters.completeness import get_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ 
+ def parse_ashby(data: dict) -> list[Posting]:
+     postings: list[Posting] = []
+     for j in data.get("jobs", []):
+         loc = j.get("location")
+         postings.append(
+             Posting(
+@@ -15,17 +15,17 @@ def parse_ashby(data: dict) -> list[Posting]:
+                 url=j.get("jobUrl") or j.get("applyUrl"),
+                 location=loc,
+                 department=j.get("department"),
+                 remote=detect_remote(loc, j.get("isRemote")),
+                 raw=j,
+             )
+         )
+     return postings
+ 
+ 
+-def fetch_ashby(token: str) -> list[Posting]:
++def fetch_ashby(token: str, *, fetch_details: bool = True) -> SourceResult:
+     url = f"https://api.ashbyhq.com/posting-api/job-board/{token}"
+     data = get_json(url)
+     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
+         raise ValueError("ashby response missing 'jobs' key")
+     validate_ids(data["jobs"], "id")
+-    return parse_ashby(data)
++    return SourceResult(iter(parse_ashby(data)), SourceStatus(fetch_details=fetch_details))
+diff --git a/job_discovery/adapters/completeness.py b/job_discovery/adapters/completeness.py
+index c5c5a98..a032de1 100644
+--- a/job_discovery/adapters/completeness.py
++++ b/job_discovery/adapters/completeness.py
+@@ -1,41 +1,92 @@
+ """Explicit completeness for sources that can return a bounded partial crawl."""
+ from collections.abc import Iterator
+ from dataclasses import dataclass
++from contextlib import contextmanager
++from contextvars import ContextVar
++from time import monotonic
+ 
+ from job_discovery.models import Posting
+ 
+ 
+ @dataclass
+ class SourceStatus:
+     complete: bool = True
+     fetch_details: bool = True
++    failed: bool = False
+ 
+ 
+ class SourceResult(Iterator[Posting]):
+     """Keep lazy ingestion while exposing completeness only after exhaustion."""
+ 
+     def __init__(self, postings: Iterator[Posting], status: SourceStatus):
+         self.postings = postings
+         self.status = status
+         self.exhausted = False
+ 
+     @property
+     def complete(self) -> bool:
+         return self.exhausted and self.status.complete
+ 
+     def __next__(self) -> Posting:
+         try:
++            budget = _budget.get()
++            if budget is not None and monotonic() >= budget[0]:
++                raise SourceBudgetExceeded('source time budget exhausted; incomplete')
+             return next(self.postings)
+         except StopIteration:
+             self.exhausted = True
+             raise
++        except Exception:
++            self.status.complete = False
++            self.status.failed = True
++            raise
+ 
+ 
+ def validate_ids(items: list, key: str) -> None:
+     """An unreadable or duplicate source ID makes absence unsafe to interpret."""
+     ids = set()
+     for item in items:
+         value = item.get(key) if isinstance(item, dict) else None
+         if value is None or str(value).strip() == "" or str(value) in ids:
+             raise ValueError(f"source listing has missing or duplicate {key}")
+         ids.add(str(value))
++
++
++# A board budget is scoped to this worker context; ordinary legacy calls retain
++# their retry policy. Checks run before every page, including pages with no new
++# identities (duplicate/facet walks cannot escape the request ceiling).
++class SourceBudgetExceeded(ValueError):
++    pass
++
++
++_budget = ContextVar('source_budget', default=None)
++
++
++@contextmanager
++def source_budget(seconds, requests, pulse=None):
++    token = _budget.set([monotonic()+seconds,requests,pulse])
++    try:
++        yield
++    finally:
++        _budget.reset(token)
++
++
++def _request(method, url, **kwargs):
++    from job_discovery import http
++    budget = _budget.get()
++    if budget is not None:
++        if budget[1] <= 0 or monotonic() >= budget[0]:
++            raise SourceBudgetExceeded('source request/time budget exhausted; incomplete')
++        budget[1] -= 1
++        if budget[2]:
++            budget[2]()
++        kwargs.update(retries=0,timeout=min(20,max(0.001,budget[0]-monotonic())))
++    return getattr(http, method)(url, **kwargs)
++
++
++def get_json(url, **kwargs):
++    return _request('get_json',url,**kwargs)
++
++
++def post_json(url, **kwargs):
++    return _request('post_json',url,**kwargs)
+diff --git a/job_discovery/adapters/greenhouse.py b/job_discovery/adapters/greenhouse.py
+index 509f9ed..404278e 100644
+--- a/job_discovery/adapters/greenhouse.py
++++ b/job_discovery/adapters/greenhouse.py
+@@ -1,12 +1,12 @@
+-from job_discovery.adapters.completeness import validate_ids
+-from job_discovery.http import get_json
++from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
++from job_discovery.adapters.completeness import get_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ 
+ def parse_greenhouse(data: dict) -> list[Posting]:
+     postings: list[Posting] = []
+     for j in data.get("jobs") or []:
+         loc = (j.get("location") or {}).get("name")
+         depts = j.get("departments") or []
+         dept = depts[0].get("name") if depts else None
+@@ -17,30 +17,30 @@ def parse_greenhouse(data: dict) -> list[Posting]:
+                 url=j["absolute_url"],
+                 location=loc,
+                 department=dept,
+                 remote=detect_remote(loc, None),
+                 raw=j,
+             )
+         )
+     return postings
+ 
+ 
+-def fetch_greenhouse(token: str) -> list[Posting]:
+-    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
++def fetch_greenhouse(token: str, *, fetch_details: bool = True) -> SourceResult:
++    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content={str(fetch_details).lower()}"
+     data = get_json(url)
+     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
+         raise ValueError("greenhouse response missing 'jobs' key")
+     validate_ids(data["jobs"], "id")
+     total = (data.get("meta") or {}).get("total")
+     if isinstance(total, int) and total != len(data["jobs"]):
+         raise ValueError("greenhouse incomplete listing below reported total")
+-    return parse_greenhouse(data)
++    return SourceResult(iter(parse_greenhouse(data)), SourceStatus(fetch_details=fetch_details))
+ 
+ 
+ def _as_string(v) -> str:
+     if isinstance(v, str):
+         return v
+     if isinstance(v, bool) or isinstance(v, (int, float)):
+         return str(v)
+     return ""
+ 
+ 
+diff --git a/job_discovery/adapters/lever.py b/job_discovery/adapters/lever.py
+index 1c1ae5f..e2f2704 100644
+--- a/job_discovery/adapters/lever.py
++++ b/job_discovery/adapters/lever.py
+@@ -1,12 +1,12 @@
+-from job_discovery.adapters.completeness import validate_ids
+-from job_discovery.http import get_json
++from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
++from job_discovery.adapters.completeness import get_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ 
+ def _explicit_remote(workplace_type: str | None) -> bool | None:
+     if workplace_type == "remote":
+         return True
+     if workplace_type in ("on-site", "hybrid"):
+         return False
+     return None
+@@ -24,17 +24,17 @@ def parse_lever(data: list) -> list[Posting]:
+                 url=j["hostedUrl"],
+                 location=loc,
+                 department=cats.get("team") or cats.get("department"),
+                 remote=detect_remote(loc, _explicit_remote(j.get("workplaceType"))),
+                 raw=j,
+             )
+         )
+     return postings
+ 
+ 
+-def fetch_lever(token: str) -> list[Posting]:
++def fetch_lever(token: str, *, fetch_details: bool = True) -> SourceResult:
+     url = f"https://api.lever.co/v0/postings/{token}?mode=json"
+     data = get_json(url)
+     if not isinstance(data, list):
+         raise ValueError(f"lever response expected a list, got {type(data).__name__}")
+     validate_ids(data, "id")
+-    return parse_lever(data)
++    return SourceResult(iter(parse_lever(data)), SourceStatus(fetch_details=fetch_details))
+diff --git a/job_discovery/adapters/smartrecruiters.py b/job_discovery/adapters/smartrecruiters.py
+index 5e9323d..94716c0 100644
+--- a/job_discovery/adapters/smartrecruiters.py
++++ b/job_discovery/adapters/smartrecruiters.py
+@@ -1,13 +1,13 @@
+ import logging
+ 
+-from job_discovery.http import get_json
++from job_discovery.adapters.completeness import SourceResult, SourceStatus, get_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ log = logging.getLogger("job_discovery")
+ 
+ # Postings are paged with offset/limit against `totalFound`; 100 is the API max.
+ # The full JD lives on the per-posting detail endpoint, not the listing.
+ _PAGE_LIMIT = 100
+ 
+ 
+@@ -78,58 +78,69 @@ def _minimal_posting(token: str, item: dict) -> Posting | None:
+     if not pid:
+         return None
+     return Posting(
+         external_id=str(pid),
+         title=item.get("name"),
+         url=f"https://jobs.smartrecruiters.com/{token}/{pid}",
+         raw=item,
+     )
+ 
+ 
+-def fetch_smartrecruiters(token: str, *, fetch_details: bool = True) -> list[Posting]:
++def fetch_smartrecruiters(token: str, *, fetch_details: bool = True) -> SourceResult:
++    status = SourceStatus(fetch_details=fetch_details)
++    return SourceResult(_fetch_smartrecruiters(token, status),status)
++
++
++def _fetch_smartrecruiters(token, status):
++    fetch_details = status.fetch_details
+     base = f"https://api.smartrecruiters.com/v1/companies/{token}/postings"
+-    postings: list[Posting] = []
+     offset = 0
+     seen = set()
+     expected_total = 0
++    previous_total = None
+     while True:
+         page = get_json(f"{base}?limit={_PAGE_LIMIT}&offset={offset}")
+         if not isinstance(page, dict) or not isinstance(page.get("content"), list):
+             raise ValueError("smartrecruiters response missing 'content' key")
+         content = page.get("content") or []
++        if any(not isinstance(item,dict) for item in content):
++            raise ValueError('invalid listing item')
+         total = page.get("totalFound")
++        if previous_total is not None and isinstance(total,int) and total != previous_total:
++            status.complete = False
++        if isinstance(total,int):
++            previous_total = total
+         if isinstance(total, int) and total > 0:
+             expected_total = max(expected_total, total)
+         for item in content:
+             pid = item.get("id")
+             if not pid or pid in seen:
+                 raise ValueError("smartrecruiters incomplete listing: missing or repeated id")
+             seen.add(pid)
+             if not fetch_details:
+-                postings.append(_minimal_posting(token, item))
++                yield _minimal_posting(token, item)
+                 continue
+             try:
+                 # Both the fetch and the parse live inside the try: a malformed
+                 # HTTP-200 detail body must not abort the whole company fetch.
+                 detail = get_json(f"{base}/{pid}")
+                 posting = parse_smartrecruiters_posting(detail)
+             except Exception as exc:  # detail unavailable/unparseable: keep, don't drop
+                 log.warning(
+                     "smartrecruiters: detail unavailable for %s/%s; keeping minimal posting: %s: %s",
+                     token, pid, type(exc).__name__, exc,
+                 )
+                 posting = _minimal_posting(token, item)
+             if posting is not None:
+-                postings.append(posting)
++                yield posting
+         # Page while a FULL page comes back and stop on a short/empty one. The
+         # `totalFound` count is only an *additional* stop signal when it is a
+         # positive number — a missing/null/zero total must NOT end paging, which
+         # previously truncated after page 1 and triggered false closures.
+         offset += _PAGE_LIMIT
+         total = page.get("totalFound")
+         full_page = len(content) == _PAGE_LIMIT
+         reached_total = isinstance(total, int) and total > 0 and offset >= total
+         if not full_page or reached_total:
+             if len(seen) < expected_total:
+                 raise ValueError("smartrecruiters incomplete listing below reported total")
+             break
+-    return postings
+diff --git a/job_discovery/adapters/workable.py b/job_discovery/adapters/workable.py
+index ddbacd2..ffb8c12 100644
+--- a/job_discovery/adapters/workable.py
++++ b/job_discovery/adapters/workable.py
+@@ -1,14 +1,14 @@
+-from job_discovery.adapters.completeness import validate_ids
++from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+ import logging
+ 
+-from job_discovery.http import get_json
++from job_discovery.adapters.completeness import get_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ log = logging.getLogger("job_discovery")
+ 
+ # Workable's PUBLIC, no-auth widget endpoint returns the FULL published job list
+ # for an account in a SINGLE GET, with the full HTML job description inline
+ # (the widget merges description + requirements + benefits into one `description`
+ # field). There is no pagination and no per-job detail call — `?details=true`
+ # returns everything:
+@@ -79,33 +79,33 @@ def _minimal_posting(account: str, job: dict) -> Posting | None:
+     if not shortcode:
+         return None
+     return Posting(
+         external_id=str(shortcode),
+         title=job.get("title"),
+         url=f"https://apply.workable.com/{account}/j/{shortcode}/",
+         raw=job,
+     )
+ 
+ 
+-def fetch_workable(token: str) -> list[Posting]:
++def fetch_workable(token: str, *, fetch_details: bool = True) -> SourceResult:
+     # ONE no-auth GET returns every published job with its full description
+     # inline. Parse each entry inside a try/except so a single malformed job
+     # entry yields a minimal posting instead of being dropped or crashing the
+     # whole company fetch (a dropped job would let run.py's close-detection
+     # falsely close a still-open posting).
+-    payload = get_json(_WIDGET_URL.format(account=token))
++    payload = get_json(_WIDGET_URL.format(account=token).replace("details=true", f"details={str(fetch_details).lower()}"))
+     if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
+         raise ValueError("workable response missing 'jobs' key")
+     validate_ids(payload["jobs"], "shortcode")
+     postings: list[Posting] = []
+     for job in payload.get("jobs") or []:
+         try:
+             posting = parse_workable_job(job, token)
+         except Exception as exc:  # malformed entry: keep a minimal posting, don't drop
+             log.warning(
+                 "workable: malformed job entry for %s/%s; keeping minimal posting: %s: %s",
+                 token, job.get("shortcode"), type(exc).__name__, exc,
+             )
+             posting = _minimal_posting(token, job)
+         if posting is not None:
+             postings.append(posting)
+-    return postings
++    return SourceResult(iter(postings), SourceStatus(fetch_details=fetch_details))
+diff --git a/job_discovery/adapters/workday.py b/job_discovery/adapters/workday.py
+index da24e47..1e37d9b 100644
+--- a/job_discovery/adapters/workday.py
++++ b/job_discovery/adapters/workday.py
+@@ -1,15 +1,15 @@
+ from job_discovery.adapters.completeness import SourceResult, SourceStatus
+ import logging
+ from collections.abc import Iterator
+ 
+-from job_discovery.http import get_json, post_json
++from job_discovery.adapters.completeness import get_json, post_json
+ from job_discovery.models import Posting
+ from job_discovery.normalize import detect_remote
+ 
+ log = logging.getLogger("job_discovery")
+ 
+ # Workday's cxs `/jobs` is a POST search paged with offset/limit; 20 is the page
+ # size the public career-site UI uses AND the hard ceiling — a `limit` above 20
+ # returns HTTP 400, so this is fixed, not just a default.
+ _PAGE_LIMIT = 20
+ 
+@@ -299,20 +299,22 @@ def _page_walk(
+     offset = 0
+     expected = first_page.get("total") or 0
+     received = 0
+     query_ids = set()
+     first_path: str | None = None
+     while True:
+         if not isinstance(page, dict) or not isinstance(page.get("jobPostings"), list):
+             raise ValueError("workday response missing 'jobPostings' list")
+         page_total = page.get("total")
+         if isinstance(page_total, int):
++            if page_total != expected:
++                status.complete = False
+             expected = max(expected, page_total)
+         items = page["jobPostings"]
+         if not items:
+             if received < expected:
+                 status.complete = False
+             break  # genuinely empty page -> end of results
+         # Wrap guard: past the 2000 hard cap Workday wraps back to page 1 rather
+         # than returning empty, so if a later page repeats page 1's first posting
+         # we've wrapped — stop BEFORE re-ingesting duplicates.
+         this_first = items[0].get("externalPath")
+@@ -377,24 +379,28 @@ def _crawl(
+         yield from _yield_items(first.get("jobPostings") or [], seen,
+                                 cxs=cxs, host=host, site=site, status=status)
+         expected = total
+         offset = _PAGE_LIMIT
+         while offset < total:
+             page = _post_jobs(cxs, applied_facets, offset)
+             if not isinstance(page, dict) or not isinstance(page.get("jobPostings"), list):
+                 raise ValueError("workday response missing 'jobPostings' key")
+             page_total = page.get("total")
+             if isinstance(page_total, int):
++                if page_total != expected:
++                    status.complete = False
+                 expected = max(expected, page_total)
+             items = page.get("jobPostings") or []
+             if not items:
+                 break
++            if any(i.get("externalPath") in partition_ids for i in items):
++                status.complete = False
+             partition_ids.update(i.get("externalPath") for i in items)
+             yield from _yield_items(items, seen, cxs=cxs, host=host, site=site, status=status)
+             offset += _PAGE_LIMIT
+         if len(partition_ids - {None}) < expected:
+             status.complete = False
+         return
+ 
+     subdivider = (
+         _choose_subdivider(first.get("facets"), set(applied_facets))
+         if depth < _MAX_FACET_DEPTH
+diff --git a/job_discovery/db.py b/job_discovery/db.py
+index 3a9f55e..7ec322e 100644
+--- a/job_discovery/db.py
++++ b/job_discovery/db.py
+@@ -272,10 +272,43 @@ def greenhouse_jobs_missing_questions(conn, company_id: int, *, limit: int | Non
+             """
+             SELECT j.external_id
+             FROM jobs j
+             LEFT JOIN job_questions q ON q.job_id = j.id
+             WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
+             ORDER BY j.external_id LIMIT %s
+             """,
+             (company_id, limit),
+         )
+         return [r["external_id"] for r in cur.fetchall()]
++
++
++def sync_source_accounts(conn, limit: int = 100) -> int:
++    """Register a bounded slice of the whole company corpus for verification.
++
++    Existing source exclusions are authoritative. An inactive legacy company
++    whose reason is unknown remains unknown; only the recorded failure threshold
++    supplies failure-disabled provenance. No user preferences participate.
++    Caller commits before enumeration/network work.
++    """
++    from job_discovery.lifecycle.claims import claim_work
++    from job_discovery.lifecycle.config import read_control
++    from job_discovery.lifecycle.reconcile import _write, StorageBlocked
++    if type(limit) is not int or not 1 <= limit <= 500:
++        raise ValueError('source registration limit must be 1..500')
++    enter_gate(conn)
++    if not read_control(conn).source_enabled:
++        return 0
++    companies = conn.execute("""SELECT c.* FROM companies c WHERE NOT EXISTS
++        (SELECT FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
++        ORDER BY c.id LIMIT %s""", (limit,)).fetchall()
++    if not companies:
++        return 0
++    claim = claim_work(conn,'source_catalog','singleton',180)
++    if claim is None:
++        raise StorageBlocked('source catalog registration deferred')
++    for co in companies:
++        exclusion = 'enabled' if co['active'] else ('failure_disabled' if co['poll_failures']>=POLL_FAILURE_DEACTIVATE else 'unknown')
++        with _write(conn,claim,'source_accounts'):
++            conn.execute("""INSERT INTO source_accounts(legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
++                VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(ats,public_board_ref) DO NOTHING""",
++                (co['id'],co['ats'],co['token'],co['active'],exclusion,co['poll_failures']))
++    return len(companies)
+diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
+new file mode 100644
+index 0000000..5af0b6e
+--- /dev/null
++++ b/job_discovery/lifecycle/reconcile.py
+@@ -0,0 +1,371 @@
++"""Full-corpus, bounded source evidence. Callers own short transactions.
++
++Enumeration pagination never resumes from an offset: interruptions retain positive
++receipts, then a fresh sequence starts at page zero. Only complete membership may
++supply absence. Public payload admission remains a separate caller responsibility.
++"""
++from contextlib import contextmanager
++from dataclasses import replace
++from datetime import datetime
++import logging
++from time import monotonic
++from uuid import UUID
++
++from psycopg.types.json import Jsonb
++
++from job_discovery.adapters.completeness import SourceStatus, SourceBudgetExceeded
++from .capacity import reserve_capacity, bind_reservation, settle_capacity
++from .claims import claim_work, validate_claim, renew_claim, cancel_claim
++from .config import read_control
++from .locks import enter_gate, lock_jobs
++from .types import ClaimRef, EnumerationRef, Observation
++
++log = logging.getLogger(__name__)
++CHUNK = 100  # Multiple row effects per identity stay below 500 per transaction.
++BOARD_SECONDS = 60
++BOARD_REQUESTS = 50
++BOARD_ROWS = 10000
++
++
++class StorageBlocked(RuntimeError):
++    pass
++
++
++@contextmanager
++def _write(conn, claim, scope, job_id=None, size=32768):
++    """Use the established reservation contract; never bypass enforced charging."""
++    reservation = reserve_capacity(conn, claim, size)
++    if reservation is None:
++        raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
++    bind_reservation(conn, reservation, job_id=job_id, scope=scope)
++    yield
++    settle_capacity(conn, reservation)
++
++
++def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
++    enter_gate(conn)
++    if not read_control(conn).source_enabled:
++        return None
++    # Last-attempt ordering is essential: an interrupted huge board goes behind
++    # untouched small boards even if neither has ever completed successfully.
++    source = conn.execute("""SELECT s.* FROM source_accounts s
++        WHERE exclusion_state IN ('enabled','failure_disabled')
++          AND (next_due_at IS NULL OR next_due_at<=clock_timestamp())
++          AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
++            AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
++        ORDER BY last_attempt_at NULLS FIRST,last_complete_success_at NULLS FIRST,id
++        LIMIT 1""").fetchone()
++    if not source:
++        return None
++    claim = claim_work(conn, 'source', str(source['id']), 180)
++    if claim is None:
++        raise StorageBlocked('source claim storage blocked; reconciliation deferred')
++    with _write(conn, claim, 'source_accounts'):
++        conn.execute("""UPDATE source_accounts SET last_attempt_at=clock_timestamp(),
++            last_outcome='attempting',claim_owner_token=%s,claim_generation=%s,
++            lease_until=%s WHERE id=%s""", (claim.owner_token,claim.generation,claim.lease_until,source['id']))
++    return source, claim
++
++
++def _check(conn, enum):
++    validate_claim(conn, enum.claim)
++    row = conn.execute("""SELECT e.* FROM source_enumerations e JOIN source_accounts s ON s.id=e.source_id
++      WHERE e.id=%s AND e.source_id=%s AND e.sequence=%s AND e.sequence>s.replay_floor
++       AND e.owner_token=%s AND e.generation=%s FOR UPDATE OF e""",
++      (enum.id,enum.source_id,enum.sequence,enum.claim.owner_token,enum.claim.generation)).fetchone()
++    if row is None:
++        raise RuntimeError('stale or fenced source enumeration')
++    return row
++
++
++def begin_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef:
++    validate_claim(conn, claim)
++    if not conn.execute("SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s AND generation=%s", (str(source_id),claim.owner_token,claim.generation)).fetchone():
++        raise RuntimeError('source claim mismatch')
++    with _write(conn, claim, 'source_accounts'):
++        row = conn.execute("""UPDATE source_accounts SET enumeration_sequence=enumeration_sequence+1
++            WHERE id=%s RETURNING enumeration_sequence""", (source_id,)).fetchone()
++    with _write(conn, claim, 'source_enumerations'):
++        enum = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status)
++            VALUES(%s,%s,%s,%s,'running') RETURNING id""",
++            (source_id,row['enumeration_sequence'],claim.owner_token,claim.generation)).fetchone()
++    return EnumerationRef(enum['id'],source_id,row['enumeration_sequence'],claim)
++
++
++def _positive(conn, enum, listing, kind, observed_at):
++    if kind not in {'seen','unlisted','removed','expired'}:
++        return  # Missing URLs or failed direct checks are unknown, never closure.
++    if enum.sequence < max(listing['last_membership_sequence'],listing['last_direct_verification_sequence']):
++        return
++    if listing['successful_last_observed_at'] and observed_at < listing['successful_last_observed_at']:
++        return
++    removed = kind in {'removed','expired'}
++    with _write(conn, enum.claim, 'source_listings', listing['job_id']):
++        conn.execute("""UPDATE source_listings SET successful_last_observed_at=%s,
++           successful_sighting_count=successful_sighting_count+%s,
++           last_membership_sequence=GREATEST(last_membership_sequence,%s),
++           last_direct_verification_sequence=CASE WHEN %s THEN %s ELSE last_direct_verification_sequence END,
++           source_availability=%s,consecutive_complete_misses=0,first_complete_miss_at=NULL
++           WHERE id=%s""", (observed_at,0 if removed else 1,enum.sequence,removed,enum.sequence,
++                           'closed' if removed else 'open',listing['id']))
++    with _write(conn, enum.claim, 'jobs', listing['job_id']):
++        conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
++                     (removed,observed_at,listing['job_id']))
++
++
++def commit_sightings(conn, enumeration: EnumerationRef, observations: list[Observation]) -> None:
++    if len(observations) > CHUNK:
++        raise ValueError(f'sighting chunk exceeds {CHUNK}')
++    enter_gate(conn)
++    listings = conn.execute("""SELECT * FROM source_listings WHERE source_account_id=%s
++        AND id=ANY(%s)""", (enumeration.source_id,[o.listing_id for o in observations])).fetchall()
++    lock_jobs(conn, [r['job_id'] for r in listings])
++    e = _check(conn, enumeration)
++    if e['status'] != 'running':
++        raise RuntimeError('enumeration is not running')
++    by_id = {r['id']:r for r in listings}
++    for o in observations:
++        if not isinstance(o.observed_at,datetime) or o.observed_at.tzinfo is None:
++            raise ValueError('observation requires aware database timestamp')
++        listing = by_id.get(o.listing_id)
++        if listing is None or listing['external_id'] != o.id:
++            raise ValueError('observation must match exact source listing')
++        if o.kind not in {'seen','unlisted','removed','expired'}:
++            continue
++        with _write(conn, enumeration.claim, 'enumeration_members'):
++            inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
++                VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING external_id""",
++                (enumeration.id,o.id,Jsonb({'kind':o.kind}))).fetchone()
++        if inserted:
++            _positive(conn, enumeration, listing, o.kind, o.observed_at)
++
++
++def stage_postings(conn, enum, postings):
++    """Retain IDs and tiny evidence only; no unused detail/raw payload persistence."""
++    if len(postings) > CHUNK:
++        raise ValueError('posting checkpoint too large')
++    ids = [p.external_id for p in postings]
++    enter_gate(conn)
++    listings = conn.execute('SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)', (enum.source_id,ids)).fetchall()
++    by_id = {row['external_id']:row for row in listings}
++    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++    observations = [Observation(p.external_id,by_id[p.external_id]['id'],
++                     'unlisted' if (p.raw or {}).get('isListed') is False else 'seen',now)
++                    for p in postings if p.external_id in by_id]
++    commit_sightings(conn,enum,observations)
++    # Unknown IDs participate in exact membership, but Task 7 owns lean admission.
++    for external_id in ids:
++        if len(external_id.encode()) > 2048:
++            raise ValueError('source identity exceeds bounded staging limit')
++        if external_id not in by_id:
++            with _write(conn,enum.claim,'enumeration_members'):
++                conn.execute("INSERT INTO enumeration_members VALUES(%s,%s,'{}') ON CONFLICT DO NOTHING", (enum.id,external_id))
++
++
++def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatus) -> None:
++    e = _check(conn,enumeration)
++    if e['status'] in {'complete','partial','failed'}:
++        return
++    if e['status'] != 'running':
++        raise RuntimeError('enumeration is not running')
++    empty = not conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s LIMIT 1', (enumeration.id,)).fetchone()
++    prior_open = conn.execute("""SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
++       WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
++    suspicious = empty and prior_open > 20
++    status = 'complete' if verdict.complete and not suspicious else ('failed' if verdict.failed else 'partial')
++    outcome = 'suspicious_empty' if suspicious else status
++    with _write(conn,enumeration.claim,'source_enumerations'):
++        conn.execute('UPDATE source_enumerations SET status=%s,completed_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=%s', (status,enumeration.id))
++    with _write(conn,enumeration.claim,'source_accounts'):
++        conn.execute("""UPDATE source_accounts SET last_outcome=%s,
++          last_complete_success_at=CASE WHEN %s='complete' THEN clock_timestamp() ELSE last_complete_success_at END,
++          failure_streak=CASE WHEN %s='complete' THEN 0 ELSE failure_streak+1 END,
++          suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
++          next_due_at=clock_timestamp()+interval '24 hours' *
++             CASE WHEN exclusion_state='failure_disabled' AND %s<>'complete'
++                  THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END
++          WHERE id=%s""", (outcome,status,status,suspicious,status,enumeration.source_id))
++
++
++def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool:
++    if type(limit) is not int or not 1 <= limit <= 500:
++        raise ValueError('reconciliation limit must be 1..500')
++    enter_gate(conn)
++    e = conn.execute('SELECT * FROM source_enumerations WHERE id=%s',(enumeration.id,)).fetchone()
++    if e is None:
++        raise RuntimeError('stale or fenced source enumeration')
++    if e['status'] not in {'complete','partial','failed'}:
++        raise RuntimeError('cannot reconcile unfinished enumeration')
++    checkpoint = conn.execute('SELECT * FROM reconciliation_checkpoints WHERE enumeration_id=%s', (enumeration.id,)).fetchone()
++    if checkpoint and checkpoint['completed_at']:
++        _check(conn,enumeration)
++        return True
++    cursor = checkpoint['last_external_id'] if checkpoint else None
++    rows = []
++    if e['status'] == 'complete':
++        rows = conn.execute("""SELECT l.* FROM source_listings l WHERE source_account_id=%s
++            AND (%s::text IS NULL OR external_id>%s) ORDER BY external_id LIMIT %s""",
++            (enumeration.source_id,cursor,cursor,min(limit,CHUNK))).fetchall()
++    lock_jobs(conn,[r['job_id'] for r in rows])
++    e = _check(conn,enumeration)
++    for row in rows:
++        if (row['last_membership_sequence'] >= enumeration.sequence
++            or row['last_direct_verification_sequence'] >= enumeration.sequence
++            or row['last_complete_miss_sequence'] >= enumeration.sequence
++            or (row['successful_last_observed_at'] and row['successful_last_observed_at'] >= e['started_at'])):
++            continue
++        if conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s AND external_id=%s', (enumeration.id,row['external_id'])).fetchone():
++            continue
++        with _write(conn,enumeration.claim,'source_listings',row['job_id']):
++            conn.execute("""UPDATE source_listings SET
++               consecutive_complete_misses=LEAST(2,consecutive_complete_misses+1),
++               first_complete_miss_at=COALESCE(first_complete_miss_at,%s),
++               last_complete_miss_sequence=%s,last_miss_enumeration_id=%s,
++               source_availability=CASE WHEN first_complete_miss_at IS NOT NULL
++                 AND %s>=first_complete_miss_at+interval '24 hours' THEN 'closed' ELSE source_availability END
++               WHERE id=%s""", (e['completed_at'],enumeration.sequence,enumeration.id,e['completed_at'],row['id']))
++        with _write(conn,enumeration.claim,'jobs',row['job_id']):
++            conn.execute("""UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s
++                AND EXISTS(SELECT FROM source_listings WHERE id=%s AND source_availability='closed')""", (e['completed_at'],row['job_id'],row['id']))
++    cursor = rows[-1]['external_id'] if rows else cursor
++    done = len(rows) < min(limit,CHUNK)
++    with _write(conn,enumeration.claim,'reconciliation_checkpoints'):
++        conn.execute("""INSERT INTO reconciliation_checkpoints(enumeration_id,generation,last_external_id,reconciled_count,completed_at)
++            VALUES(%s,%s,%s,%s,CASE WHEN %s THEN clock_timestamp() END)
++            ON CONFLICT(enumeration_id) DO UPDATE SET last_external_id=EXCLUDED.last_external_id,
++            reconciled_count=reconciliation_checkpoints.reconciled_count+EXCLUDED.reconciled_count,
++            completed_at=EXCLUDED.completed_at""", (enumeration.id,enumeration.claim.generation,cursor,len(rows),done))
++    with _write(conn,enumeration.claim,'source_accounts'):
++        conn.execute('UPDATE source_accounts SET reconciliation_cursor=%s WHERE id=%s', (cursor,enumeration.source_id))
++    if done:
++        with _write(conn,enumeration.claim,'source_enumerations'):
++            conn.execute('UPDATE source_enumerations SET reconciled_at=clock_timestamp() WHERE id=%s', (enumeration.id,))
++    return done
++
++
++def verify_due_sources(conn, *, max_boards=100, seconds=300):
++    """Scheduled verification precedes admission and ignores all user matching."""
++    from job_discovery.adapters import ADAPTERS
++    from job_discovery.adapters.completeness import source_budget
++    result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0}
++    deadline = monotonic()+seconds
++    for _ in range(max_boards):
++        if monotonic() >= deadline:
++            break
++        try:
++            pair = claim_due_source(conn)
++            conn.commit()
++        except StorageBlocked:
++            conn.rollback()
++            verify_storage_blocked(conn, max_boards=max_boards, deadline=deadline)
++            break
++        if pair is None:
++            break
++        source, claim = pair
++        try:
++            enum = begin_enumeration(conn,source['id'],claim)
++            conn.commit()
++        except StorageBlocked:
++            conn.rollback()
++            cancel_claim(conn,claim)
++            conn.commit()
++            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
++            break
++        chunk = []
++        verdict = SourceStatus(complete=False)
++        renewed = monotonic()
++        try:
++            def pulse():
++                # No SQL transaction spans network, and each bounded request
++                # starts with a renewed lease (including empty duplicate pages).
++                renew_claim(conn,claim)
++                conn.commit()
++            with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
++                postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
++                count = 0
++                for posting in postings:
++                    count += 1
++                    if count > BOARD_ROWS:
++                        break
++                    chunk.append(posting)
++                    if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
++                        stage_postings(conn,enum,chunk)
++                        conn.commit()
++                        chunk = []
++                        claim = renew_claim(conn,claim)
++                        conn.commit()
++                        enum = replace(enum,claim=claim)
++                        renewed = monotonic()
++                verdict = SourceStatus(complete=postings.complete)
++        except StorageBlocked:
++            conn.rollback()
++            log.warning("source evidence storage blocked; reconciliation deferred")
++            cancel_claim(conn,claim)
++            conn.commit()
++            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
++            break
++        except SourceBudgetExceeded:
++            verdict = SourceStatus(complete=False)
++            conn.rollback()
++        except Exception:
++            log.exception('source enumeration failed or interrupted: %s',source['id'])
++            verdict = SourceStatus(complete=False,failed=True)
++            conn.rollback()
++        try:
++            if chunk:
++                stage_postings(conn,enum,chunk)
++                conn.commit()
++            complete_enumeration(conn,enum,verdict)
++            conn.commit()
++            while True:
++                done = reconcile_chunk(conn,enum)
++                conn.commit()
++                if done or monotonic() >= deadline:
++                    break
++                claim = renew_claim(conn,claim)
++                conn.commit()
++                enum = replace(enum,claim=claim)
++            status = conn.execute('SELECT status FROM source_enumerations WHERE id=%s',(enum.id,)).fetchone()['status']
++            result['ok' if status == 'complete' else 'failed'] += 1
++            conn.commit()
++        except StorageBlocked:
++            conn.rollback()
++            health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
++            log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
++        finally:
++            conn.rollback()
++            cancel_claim(conn,claim)
++            conn.commit()
++    return result
++
++
++def verify_storage_blocked(conn, *, max_boards, deadline):
++    """Read-only fallback: healthy feeds are storage-deferred, never source-failed.
++
++    Existing enforced source metadata writes require physical reservations. Do
++    not weaken that contract: report health in logs until persistence can resume.
++    """
++    from job_discovery.adapters import ADAPTERS
++    from job_discovery.adapters.completeness import source_budget
++    sources = conn.execute("""WITH due AS (SELECT *,row_number() OVER(ORDER BY last_attempt_at NULLS FIRST,id)-1 AS position,
++         count(*) OVER() AS total FROM source_accounts
++         WHERE exclusion_state IN ('enabled','failure_disabled')
++         AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()))
++       SELECT * FROM due ORDER BY mod(position-mod(floor(extract(epoch FROM clock_timestamp())/86400)::bigint,total)+total,total)
++       LIMIT %s""", (max_boards,)).fetchall()
++    conn.commit()
++    for source in sources:
++        if monotonic() >= deadline:
++            break
++        try:
++            with source_budget(min(BOARD_SECONDS,deadline-monotonic()),BOARD_REQUESTS):
++                feed = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
++                for count, _ in enumerate(feed,1):
++                    if count >= BOARD_ROWS:
++                        break
++                health = 'healthy' if feed.complete else 'partial'
++        except SourceBudgetExceeded:
++            health = 'partial'
++        except Exception:
++            health = 'failed'
++        log.warning('source %s attempted: %s; storage-blocked, reconciliation-deferred',source['id'],health)
+diff --git a/job_discovery/run.py b/job_discovery/run.py
+index 9e97aef..8c2eee3 100644
+--- a/job_discovery/run.py
++++ b/job_discovery/run.py
+@@ -1,11 +1,12 @@
+ from contextlib import nullcontext
++from job_discovery.lifecycle.config import read_control
+ from job_discovery.lifecycle.maintenance import pre_admission_maintenance
+ from job_discovery.lifecycle.locks import enter_gate
+ from job_discovery.lifecycle.capacity import CEILING_BYTES
+ from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
+ import logging
+ 
+ from job_discovery import db
+ from job_discovery.adapters import ADAPTERS
+ from job_discovery.adapters.greenhouse import parse_greenhouse_questions
+ from job_discovery.http import get_json as _get_json
+@@ -99,20 +100,36 @@ def run(dsn: str | None = None) -> dict:
+         guard_note = None
+         if over:
+             guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
+                           else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
+             log.warning("%s; checking closures without ingestion or enrichment", guard_note)
+ 
+         run_id = db.start_run(conn)
+         if not over:
+             db.sync_seed(conn, targets)
+         conn.commit()
++        from job_discovery.lifecycle.reconcile import verify_due_sources, StorageBlocked
++        source_enabled = read_control(conn).source_enabled
++        conn.commit()
++        if source_enabled:
++            try:
++                db.sync_source_accounts(conn)
++                conn.commit()
++            except StorageBlocked:
++                conn.rollback()
++                log.warning('source catalog storage blocked; verifying registered corpus')
++            counts = verify_due_sources(conn)
++            db.finish_run(conn,run_id,companies_ok=counts['ok'],companies_failed=counts['failed'],
++                          new_jobs=counts['new_jobs'],closed_jobs=counts['closed_jobs'],
++                          notes='full-corpus source verification; payload admission deferred')
++            conn.commit()
++            return counts
+         companies = db.active_companies(conn)
+         conn.commit()  # No read transaction spans adapter HTTP.
+ 
+         ok = failed = new_jobs = closed_jobs = 0
+         aborted = False
+         failures: list[str] = []
+ 
+         for co in companies:
+             ats, token, company_id = co["ats"], co["token"], co["id"]
+             try:
+diff --git a/tests/test_lifecycle_reconcile.py b/tests/test_lifecycle_reconcile.py
+new file mode 100644
+index 0000000..9365395
+--- /dev/null
++++ b/tests/test_lifecycle_reconcile.py
+@@ -0,0 +1,398 @@
++"""Ordinary source evidence, pagination and persisted scheduling contracts."""
++from datetime import timedelta
++
++import pytest
++
++from tests.conftest import requires_db
++from job_discovery.lifecycle import reconcile as r
++from job_discovery.lifecycle.identity import migrate_identity_batch
++from job_discovery.lifecycle.claims import cancel_claim
++from job_discovery.adapters.completeness import SourceStatus
++from job_discovery.lifecycle.types import Observation
++
++
++def setup_source(conn, count=1, ats='lever', token='fixture'):
++    cid = conn.execute("INSERT INTO companies(name,ats,token) VALUES ('Fixture',%s,%s) RETURNING id", (ats, token)).fetchone()['id']
++    for i in range(count):
++        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES (%s,%s,%s,'Role','https://example.test/job')", (f'{ats}:{token}:{i}', cid, str(i)))
++    while migrate_identity_batch(conn):
++        pass
++    conn.execute('UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1 WHERE singleton')
++    conn.commit()
++    return conn.execute('SELECT * FROM source_accounts WHERE legacy_company_id=%s', (cid,)).fetchone()
++
++
++def begin(conn, source):
++    conn.execute('UPDATE source_accounts SET next_due_at=NULL WHERE id=%s', (source['id'],))
++    pair = r.claim_due_source(conn)
++    assert pair
++    co, claim = pair
++    enum = r.begin_enumeration(conn, co['id'], claim)
++    conn.commit()
++    return enum
++
++
++def finish(conn, enum, complete=True):
++    r.complete_enumeration(conn, enum, SourceStatus(complete=complete))
++    conn.commit()
++    while not r.reconcile_chunk(conn, enum):
++        conn.commit()
++    conn.commit()
++    cancel_claim(conn, enum.claim)
++    conn.commit()
++
++
++@requires_db
++def test_two_distinct_complete_misses_exact_24h_and_replay(conn):
++    source = setup_source(conn)
++    first = begin(conn, source)
++    finish(conn, first)
++    row = conn.execute('SELECT * FROM source_listings').fetchone()
++    assert row['consecutive_complete_misses'] == 1
++    assert row['source_availability'] != 'closed'
++    second = begin(conn, source)
++    # Fixture timestamps, not an application clock override.
++    r.complete_enumeration(conn, second, SourceStatus())
++    conn.execute("UPDATE source_enumerations SET completed_at=%s WHERE id=%s", (row['first_complete_miss_at']+timedelta(hours=24), second.id))
++    assert r.reconcile_chunk(conn, second)
++    assert r.reconcile_chunk(conn, second)
++    row = conn.execute('SELECT * FROM source_listings').fetchone()
++    assert row['consecutive_complete_misses'] == 2
++    assert row['source_availability'] == 'closed'
++    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at']
++    conn.commit()
++
++
++@requires_db
++def test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset(conn):
++    source = setup_source(conn)
++    before = conn.execute('SELECT * FROM source_listings').fetchone()
++    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()")
++    enum = begin(conn, source)
++    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++    sight = Observation('0', before['id'], 'unlisted', now)
++    r.commit_sightings(conn, enum, [sight])
++    conn.commit()
++    r.commit_sightings(conn, enum, [sight])
++    finish(conn, enum, False)
++    after = conn.execute('SELECT * FROM source_listings').fetchone()
++    assert after['successful_sighting_count'] == 1
++    assert after['source_availability'] == 'open'
++    assert after['discovery_anchor_at'] == before['discovery_anchor_at']
++    assert after['job_id'] == before['job_id']
++    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
++
++
++@requires_db
++@pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
++def test_empty_threshold(conn, count, expected):
++    source = setup_source(conn, count)
++    enum = begin(conn, source)
++    finish(conn, enum)
++    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status'] == expected
++    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == (expected == 'complete')
++
++
++@requires_db
++def test_unknown_or_missing_never_closes_and_partial_never_counts(conn):
++    source = setup_source(conn)
++    enum = begin(conn, source)
++    listing = conn.execute('SELECT * FROM source_listings').fetchone()
++    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++    r.commit_sightings(conn, enum, [Observation('0',listing['id'],'missing',now)])
++    finish(conn, enum, False)
++    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses'] == 0
++
++
++@requires_db
++def test_cancelled_enumeration_cannot_complete(conn):
++    source = setup_source(conn)
++    enum = begin(conn, source)
++    cancel_claim(conn, enum.claim)
++    conn.commit()
++    with pytest.raises(RuntimeError, match='fenced|stale'):
++        r.complete_enumeration(conn, enum, SourceStatus())
++    conn.rollback()
++
++
++@requires_db
++def test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence(conn):
++    import psycopg
++    from psycopg.rows import dict_row
++    from tests.conftest import TEST_DSN
++    source = setup_source(conn, 105)
++    enum = begin(conn,source)
++    from job_discovery.models import Posting
++    r.stage_postings(conn,enum,[Posting('extra','Role','u')])
++    r.complete_enumeration(conn,enum,SourceStatus())
++    assert not r.reconcile_chunk(conn,enum,100)
++    conn.commit()
++    # Fresh worker/connection reads the committed checkpoint without replaying
++    # the first 100 effects. Its existing lease remains bound to this run.
++    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
++        assert r.reconcile_chunk(fresh,enum,100)
++        fresh.commit()
++    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == 105
++    cancel_claim(conn,enum.claim)
++    conn.commit()
++    newer = begin(conn,source)
++    listing = conn.execute('SELECT * FROM source_listings ORDER BY external_id LIMIT 1').fetchone()
++    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++    r.commit_sightings(conn,newer,[Observation(listing['external_id'],listing['id'],'seen',now)])
++    # A completion can represent a feed started before a newer direct sighting.
++    conn.execute('UPDATE source_enumerations SET started_at=%s WHERE id=%s',(now-timedelta(hours=25),newer.id))
++    finish(conn,newer)
++    row = conn.execute('SELECT * FROM source_listings WHERE id=%s',(listing['id'],)).fetchone()
++    assert row['consecutive_complete_misses'] == 0
++    assert row['source_availability'] == 'open'
++
++
++@requires_db
++def test_less_than_24_hours_is_not_a_qualifying_second_miss(conn):
++    source = setup_source(conn)
++    first = begin(conn,source)
++    finish(conn,first)
++    miss = conn.execute('SELECT first_complete_miss_at FROM source_listings').fetchone()['first_complete_miss_at']
++    second = begin(conn,source)
++    r.complete_enumeration(conn,second,SourceStatus())
++    conn.execute('UPDATE source_enumerations SET completed_at=%s WHERE id=%s',(miss+timedelta(hours=24,microseconds=-1),second.id))
++    assert r.reconcile_chunk(conn,second)
++    conn.commit()
++    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
++
++
++@requires_db
++@pytest.mark.parametrize('budget_kind',['requests','time'])
++def test_scheduler_finite_six_cycle_bound_across_families_and_request_budget(conn,monkeypatch,budget_kind):
++    from job_discovery import http
++    from job_discovery.adapters import smartrecruiters
++    families = ['greenhouse','lever','ashby','workable','smartrecruiters','workday']
++    for family in families:
++        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
++    # Force the enormous source first; it exhausts every fresh request budget.
++    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()-interval '1 day' WHERE ats<>'smartrecruiters'")
++    conn.commit()
++    monkeypatch.setattr(r,'BOARD_REQUESTS',2)
++    clock=[0.0]
++    if budget_kind=='time':
++        from job_discovery.adapters import completeness
++        monkeypatch.setattr(r,'monotonic',lambda:clock[0])
++        monkeypatch.setattr(completeness,'monotonic',lambda:clock[0])
++        monkeypatch.setattr(r,'BOARD_SECONDS',1)
++    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
++    calls = []
++    def get(url,**kwargs):
++        assert conn.info.transaction_status.name == 'IDLE'
++        calls.append(url)
++        if 'smartrecruiters' in url:
++            if budget_kind=='time':
++                clock[0]+=2
++            offset = url.split('offset=')[-1]
++            return {'content':[{'id':offset,'name':'Role'}]}
++        if 'lever' in url:
++            return [{'id':'0','text':'Role','hostedUrl':'https://example.test/job'}]
++        if 'greenhouse' in url:
++            return {'jobs':[{'id':'0','title':'Role','absolute_url':'https://example.test/job'}]}
++        if 'ashby' in url:
++            return {'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':'2026-10-01T00:00:00Z'}]}
++        return {'jobs':[{'shortcode':'0','title':'Role'}]}
++    def post(url,**kwargs):
++        assert conn.info.transaction_status.name == 'IDLE'
++        calls.append(url)
++        return {'jobPostings':[{'externalPath':'0','title':'Role'}],'total':1}
++    monkeypatch.setattr(http,'get_json',get)
++    monkeypatch.setattr(http,'post_json',post)
++    for _ in range(6):
++        r.verify_due_sources(conn,max_boards=1)
++    rows = conn.execute('SELECT ats,last_attempt_at,last_outcome FROM source_accounts').fetchall()
++    assert all(row['last_attempt_at'] for row in rows)
++    assert sum(row['last_outcome']=='complete' for row in rows)==5
++    assert len(calls)==(7 if budget_kind=='requests' else 6)
++    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
++    # Another fixture day: huge source again exhausts; every small source still
++    # receives a turn within the same six fresh invocations.
++    conn.execute('UPDATE source_accounts SET next_due_at=NULL')
++    conn.commit()
++    for _ in range(6):
++        r.verify_due_sources(conn,max_boards=1)
++    assert conn.execute('SELECT min(enumeration_sequence) n FROM source_accounts').fetchone()['n']==2
++    assert len(calls)==(14 if budget_kind=='requests' else 12)
++
++
++@requires_db
++def test_failure_disabled_backoff_and_deliberate_exclusion(conn):
++    source = setup_source(conn)
++    conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
++    for days in [1,2,4,7,7]:
++        enum = begin(conn,source)
++        finish(conn,enum,False)
++        row = conn.execute('SELECT next_due_at-clock_timestamp() delay FROM source_accounts').fetchone()
++        assert timedelta(days=days,seconds=-5) < row['delay'] <= timedelta(days=days)
++    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate',next_due_at=NULL")
++    assert r.claim_due_source(conn) is None
++
++
++@requires_db
++def test_ordinary_poll_calls_full_corpus_path_above_guard_without_users(conn,monkeypatch):
++    import os
++    from job_discovery import run, http
++    source = setup_source(conn)
++    monkeypatch.setenv('DATABASE_URL',os.environ['TEST_DATABASE_URL'])
++    monkeypatch.setattr(run,'load_targets',lambda: [])
++    monkeypatch.setattr(run.db,'over_size_ceiling',lambda c:(True,6001,6000))
++    calls=[]
++    monkeypatch.setattr(http,'get_json',lambda url,**kw:calls.append(url) or [])
++    assert run.run()['ok']==1
++    assert len(calls)==1
++    assert conn.execute('SELECT last_complete_success_at FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()['last_complete_success_at']
++    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
++
++
++@requires_db
++def test_storage_blocked_attempt_is_truthful_and_does_not_certify_absence(conn,monkeypatch,caplog):
++    from job_discovery import http
++    setup_source(conn)
++    monkeypatch.setattr(r,'claim_work',lambda *args:None)  # Ordinary integration boundary double; no capacity probes.
++    calls=[]
++    def healthy(url,**kw):
++        assert conn.info.transaction_status.name=='IDLE'
++        calls.append(url)
++        return []
++    monkeypatch.setattr(http,'get_json',healthy)
++    result=r.verify_due_sources(conn,max_boards=1)
++    assert result['failed']==0 and len(calls)==1
++    assert 'healthy; storage-blocked, reconciliation-deferred' in caplog.text
++    assert conn.execute('SELECT count(*) n FROM source_enumerations').fetchone()['n']==0
++    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses']==0
++
++
++@requires_db
++def test_ashby_republication_and_unlisted_keep_frozen_age(conn,monkeypatch):
++    from job_discovery import http
++    setup_source(conn,1,'ashby')
++    before=conn.execute('SELECT * FROM source_listings').fetchone()
++    for published in ['2026-01-01T00:00:00Z','2026-10-06T00:00:00Z']:
++        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':published}]})
++        conn.execute('UPDATE source_accounts SET next_due_at=NULL')
++        conn.commit()
++        r.verify_due_sources(conn,max_boards=1)
++    after=conn.execute('SELECT * FROM source_listings').fetchone()
++    assert after['discovery_anchor_at']==before['discovery_anchor_at']
++    assert after['discovery_expires_at']==before['discovery_expires_at']
++    assert after['successful_sighting_count']==2
++    assert after['source_availability']=='open'
++    assert conn.execute('SELECT bool_and(public_metadata=\'{"kind":"unlisted"}\') ok FROM enumeration_members').fetchone()['ok']
++
++
++@requires_db
++def test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives(conn,monkeypatch):
++    import psycopg
++    from psycopg.rows import dict_row
++    from tests.conftest import TEST_DSN
++    from job_discovery import http
++    from job_discovery.lifecycle.types import ClaimRef
++    setup_source(conn,100,'smartrecruiters')
++    calls=[]
++    def interrupted(url,**kw):
++        calls.append(url)
++        if len(calls)>1:
++            raise KeyboardInterrupt('ordinary simulated worker interruption')
++        return {'content':[{'id':str(i),'name':'Role'} for i in range(100)],'totalFound':101}
++    monkeypatch.setattr(http,'get_json',interrupted)
++    with pytest.raises(KeyboardInterrupt):
++        r.verify_due_sources(conn,max_boards=1)
++    conn.rollback()
++    # Discard the caller connection; a new worker sees both membership and
++    # source attempt ordering, and restarts mutable pagination from page zero.
++    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
++        assert fresh.execute('SELECT count(*) n FROM enumeration_members').fetchone()['n']==100
++        assert fresh.execute('SELECT min(successful_sighting_count) n FROM source_listings').fetchone()['n']==1
++        claim=fresh.execute("SELECT * FROM lifecycle_claims WHERE kind='source'").fetchone()
++        cancel_claim(fresh,ClaimRef(claim['owner_token'],claim['generation'],claim['lease_until']))
++        fresh.commit()
++        requested=[]
++        def restarted(url,**kw):
++            requested.append(url)
++            return {'content':[{'id':'0','name':'Role'}],'totalFound':1}
++        monkeypatch.setattr(http,'get_json',restarted)
++        r.verify_due_sources(fresh,max_boards=1)
++        assert requested and 'offset=0' in requested[0]
++        assert fresh.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==2
++        assert fresh.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
++
++
++@requires_db
++def test_new_corpus_sources_registered_in_bounded_slices_without_reactivating_exclusions(conn):
++    from job_discovery import db
++    source=setup_source(conn)
++    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate'")
++    conn.execute("INSERT INTO companies(name,ats,token,active,poll_failures) VALUES ('Failed','lever','failed',false,%s),('Unknown','ashby','unknown',false,0),('New','greenhouse','new',true,0)", (db.POLL_FAILURE_DEACTIVATE,))
++    assert db.sync_source_accounts(conn,2)==2
++    conn.commit()
++    rows=conn.execute('SELECT public_board_ref,exclusion_state FROM source_accounts ORDER BY public_board_ref').fetchall()
++    assert {'public_board_ref':'fixture','exclusion_state':'deliberate'} in rows
++    assert {'public_board_ref':'failed','exclusion_state':'failure_disabled'} in rows
++    assert {'public_board_ref':'unknown','exclusion_state':'unknown'} in rows
++    assert conn.execute('SELECT legacy_company_id FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()
++
++
++@requires_db
++def test_explicit_removed_evidence_only_closes_exact_identity(conn):
++    source=setup_source(conn,2)
++    enum=begin(conn,source)
++    listing=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
++    now=conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++    r.commit_sightings(conn,enum,[Observation('0',listing['id'],'removed',now)])
++    finish(conn,enum,False)
++    rows=conn.execute('SELECT external_id,closed_at FROM jobs ORDER BY external_id').fetchall()
++    assert rows[0]['closed_at'] and rows[1]['closed_at'] is None
++
++
++@requires_db
++def test_storage_deferred_request_budget_is_partial_not_a_source_failure(conn,monkeypatch,caplog):
++    from job_discovery import http
++    from job_discovery.adapters import smartrecruiters
++    setup_source(conn,1,'smartrecruiters')
++    monkeypatch.setattr(r,'claim_work',lambda *a:None)
++    monkeypatch.setattr(r,'BOARD_REQUESTS',1)
++    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
++    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'content':[{'id':'0','name':'Role'}],'totalFound':2})
++    r.verify_due_sources(conn,max_boards=1)
++    assert 'partial; storage-blocked, reconciliation-deferred' in caplog.text
++    assert 'attempted: failed' not in caplog.text
++
++
++@requires_db
++def test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget(conn,monkeypatch,caplog):
++    from job_discovery import http
++    families=['greenhouse','lever','ashby','workable','smartrecruiters','workday']
++    for family in families:
++        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
++    before=conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()
++    conn.commit()
++    calls=[]
++    def get(url,**kw):
++        calls.append(url)
++        if 'lever' in url:
++            return []
++        return {'content':[],'totalFound':0} if 'smartrecruiters' in url else {'jobs':[]}
++    def post(url,**kw):
++        calls.append(url)
++        return {'jobPostings':[],'total':0}
++    monkeypatch.setattr(http,'get_json',get)
++    monkeypatch.setattr(http,'post_json',post)
++    class FixtureDay:
++        # Test-local replacement of this scheduler's UTC day expression only;
++        # no production clock override or claim/lease/capacity behavior changes.
++        def __init__(self,day):
++            self.day=day
++        def execute(self,query,params):
++            query=query.replace('floor(extract(epoch FROM clock_timestamp())/86400)::bigint','%s::bigint')
++            return conn.execute(query,(self.day,*params))
++        def commit(self):
++            conn.commit()
++    for day in range(6):
++        r.verify_storage_blocked(FixtureDay(day),max_boards=1,deadline=r.monotonic()+60)
++    assert len(calls)==6 and len(set(calls))==6
++    assert all(str(row['id']) in caplog.text for row in before)
++    assert conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()==before
+diff --git a/tests/test_maintenance_controlflow.py b/tests/test_maintenance_controlflow.py
+index 95f0a27..5af3c6b 100644
+--- a/tests/test_maintenance_controlflow.py
++++ b/tests/test_maintenance_controlflow.py
+@@ -109,20 +109,21 @@ def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, ac
+         def commit(self):
+             pass
+         def rollback(self):
+             if self.broken:
+                 raise RuntimeError('broken rollback')
+         def close(self):
+             closes.append(self.locked)
+     connections = iter([Connection(True,True),Connection(False)])
+     monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
+     monkeypatch.setattr(run,'load_targets',lambda: [])
++    monkeypatch.setattr(run,'read_control',lambda c: SimpleNamespace(source_enabled=False))
+     monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
+     monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
+     monkeypatch.setattr(run.db,'start_run',lambda c: 1)
+     monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
+     monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
+     def finish(*args, **kw):
+         finished.append(kw)
+         if accounting_fails:
+             raise RuntimeError('accounting unavailable')
+     monkeypatch.setattr(run.db,'finish_run',finish)
+diff --git a/tests/test_size_guard.py b/tests/test_size_guard.py
+index 93f9d52..9f37325 100644
+--- a/tests/test_size_guard.py
++++ b/tests/test_size_guard.py
+@@ -263,10 +263,16 @@ def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypa
+     counts = job_discovery_run.run()
+     with psycopg.connect(TEST_DSN, row_factory=dict_row) as check:
+         rows = check.execute("SELECT external_id, title, closed_at FROM jobs ORDER BY external_id").fetchall()
+     assert [r["external_id"] for r in rows] == ["live", "missing"]
+     assert rows[0]["title"] == "Eng"
+     assert (rows[0]["closed_at"] is None) == (source_result == "complete")
+     assert (rows[1]["closed_at"] is not None) == (source_result == "complete")
+     assert counts["new_jobs"] == 0
+     assert counts["closed_jobs"] == (1 if source_result == "complete" else 0)
+     assert counts["failed"] == (0 if source_result == "complete" else 1)
++
++
++@pytest.fixture(autouse=True)
++def legacy_source_control(monkeypatch):
++    from types import SimpleNamespace
++    monkeypatch.setattr(job_discovery_run, 'read_control', lambda c: SimpleNamespace(source_enabled=False))
+diff --git a/tests/test_smartrecruiters.py b/tests/test_smartrecruiters.py
+index dbf9ff2..6b9980b 100644
+--- a/tests/test_smartrecruiters.py
++++ b/tests/test_smartrecruiters.py
+@@ -89,21 +89,21 @@ def test_fetch_pages_by_offset_and_fetches_details(monkeypatch):
+     requested: list[str] = []
+ 
+     def fake_get_json(url):
+         requested.append(url)
+         if "/postings/" in url:  # detail call
+             return DETAILS[url.rsplit("/", 1)[1]]
+         page_index = 0 if "offset=0" in url else 1
+         return FIXTURE["list_pages"][page_index]
+ 
+     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
+-    postings = fetch_smartrecruiters("BoschGroup")
++    postings = list(fetch_smartrecruiters("BoschGroup"))
+ 
+     assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
+     assert requested[0] == (
+         "https://api.smartrecruiters.com/v1/companies/BoschGroup/postings"
+         "?limit=2&offset=0"
+     )
+     assert any("offset=2" in u for u in requested)  # second page was walked
+ 
+ 
+ def test_fetch_stops_on_short_last_page_with_positive_total(monkeypatch):
+@@ -113,21 +113,21 @@ def test_fetch_stops_on_short_last_page_with_positive_total(monkeypatch):
+     offsets: list[int] = []
+ 
+     def fake_get_json(url):
+         if "/postings/" in url:  # detail call
+             return DETAILS[url.rsplit("/", 1)[1]]
+         offset = int(url.split("offset=")[1])
+         offsets.append(offset)
+         return FIXTURE["list_pages"][0 if offset == 0 else 1]
+ 
+     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
+-    postings = fetch_smartrecruiters("BoschGroup")
++    postings = list(fetch_smartrecruiters("BoschGroup"))
+     assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
+     assert offsets == [0, 2]  # stopped after the short page; no wrap/extra fetch
+ 
+ 
+ def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
+     # A failed detail fetch must NOT drop the posting (dropping it would let
+     # run.py's close-detection falsely close a still-open job). A minimal posting
+     # is built from the listing item so the job stays in `seen`.
+     page = {"totalFound": 2, "content": [
+         {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
+@@ -140,41 +140,41 @@ def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
+         if "/postings/" in url:
+             pid = url.rsplit("/", 1)[1]
+             return {
+                 "id": pid,
+                 "name": "Facilities Soft Services Engineer",
+                 "postingUrl": f"https://jobs.smartrecruiters.com/BoschGroup/{pid}",
+             }
+         return page
+ 
+     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
+-    postings = fetch_smartrecruiters("BoschGroup")
++    postings = list(fetch_smartrecruiters("BoschGroup"))
+     assert [p.external_id for p in postings] == ["744000135080134", "BAD"]
+     bad = postings[1]
+     assert bad.title == "Broken Posting"  # carried over from the listing item
+     assert bad.url == "https://jobs.smartrecruiters.com/BoschGroup/BAD"  # token+id
+ 
+ 
+ def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
+     # A malformed HTTP-200 detail body (here: missing `id`, which the parser
+     # dereferences) must not abort the whole company fetch.
+     page = {"totalFound": 1, "content": [
+         {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
+     ]}
+ 
+     def fake_get_json(url):
+         if "/postings/" in url:
+             return {"name": "Facilities Soft Services Engineer"}  # no id key
+         return page
+ 
+     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
+-    postings = fetch_smartrecruiters("BoschGroup")
++    postings = list(fetch_smartrecruiters("BoschGroup"))
+     assert [p.external_id for p in postings] == ["744000135080134"]
+     assert postings[0].url == (
+         "https://jobs.smartrecruiters.com/BoschGroup/744000135080134"
+     )
+ 
+ 
+ def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
+     # When the listing omits `totalFound`, paging must continue while a full page
+     # comes back and stop on the short page — not truncate after page 1 (which
+     # would drop later postings and trigger false closures).
+@@ -187,34 +187,34 @@ def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
+ 
+     def fake_get_json(url):
+         if "/postings/" in url:  # detail call
+             pid = url.rsplit("/", 1)[1]
+             return {"id": pid, "name": f"Job {pid}",
+                     "postingUrl": f"https://jobs.smartrecruiters.com/acme/{pid}"}
+         offset = int(url.split("offset=")[1])
+         return pages[offset]
+ 
+     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
+-    postings = fetch_smartrecruiters("acme")
++    postings = list(fetch_smartrecruiters("acme"))
+     assert [p.external_id for p in postings] == ["1", "2", "3", "4", "5"]
+ 
+ 
+ # ── A3: missing top-level key ─────────────────────────────────────────────────
+ 
+ def test_missing_content_key_raises(monkeypatch):
+     monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
+     with pytest.raises(ValueError, match="missing 'content'"):
+-        fetch_smartrecruiters("BoschGroup")
++        list(fetch_smartrecruiters("BoschGroup"))
+ 
+ 
+ def test_short_page_below_reported_total_is_not_authoritative(monkeypatch):
+     monkeypatch.setattr(smartrecruiters, "get_json", lambda *a: {"totalFound": 50, "content": []})
+     with pytest.raises(ValueError, match="incomplete"):
+-        fetch_smartrecruiters("acme")
++        list(fetch_smartrecruiters("acme"))
+ 
+ 
+ def test_smartrecruiters_listing_only_never_fetches_details(monkeypatch):
+     def listing(url):
+         assert "/postings/" not in url
+         return {"totalFound": 1, "content": [{"id": "1", "name": "A"}]}
+     monkeypatch.setattr(smartrecruiters, "get_json", listing)
+     assert [p.external_id for p in fetch_smartrecruiters("acme", fetch_details=False)] == ["1"]
+diff --git a/tests/test_source_completeness.py b/tests/test_source_completeness.py
+index e659490..818cc11 100644
+--- a/tests/test_source_completeness.py
++++ b/tests/test_source_completeness.py
+@@ -16,10 +16,89 @@ def test_unidentifiable_entry_cannot_authorize_closure(monkeypatch, module, key,
+     monkeypatch.setattr(module, "get_json", lambda *a: {key: [{id_key: None, "title": "A", "absolute_url": "u"}]})
+     fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
+     with pytest.raises(ValueError):
+         fetch("a")
+ 
+ 
+ def test_greenhouse_reported_total_cannot_exceed_collection(monkeypatch):
+     monkeypatch.setattr(greenhouse, "get_json", lambda *a: {"jobs": [], "meta": {"total": 7}})
+     with pytest.raises(ValueError):
+         greenhouse.fetch_greenhouse("a")
++
++
++@pytest.mark.parametrize('name', ['greenhouse','lever','ashby','workable','smartrecruiters','workday'])
++def test_every_family_requires_exhaustion_for_empty_success(monkeypatch,name):
++    from job_discovery import http
++    from job_discovery.adapters import ADAPTERS
++    from job_discovery.adapters.completeness import SourceResult
++    bodies={'greenhouse':{'jobs':[]},'lever':[],'ashby':{'jobs':[]},
++            'workable':{'jobs':[]},'smartrecruiters':{'content':[],'totalFound':0},
++            'workday':{'jobPostings':[],'total':0}}
++    monkeypatch.setattr(http,'get_json',lambda *a,**kw:bodies[name])
++    monkeypatch.setattr(http,'post_json',lambda *a,**kw:bodies[name])
++    result=ADAPTERS[name]('fixture:wd5:External' if name=='workday' else 'fixture',fetch_details=False)
++    assert isinstance(result,SourceResult) and not result.complete
++    assert list(result)==[] and result.complete
++
++
++@pytest.mark.parametrize('name,key,id_key', [('greenhouse','jobs','id'),('lever',None,'id'),('ashby','jobs','id'),('workable','jobs','shortcode')])
++def test_single_response_duplicate_identity_never_complete(monkeypatch,name,key,id_key):
++    from job_discovery import http
++    from job_discovery.adapters import ADAPTERS
++    items=[{id_key:'same'},{id_key:'same'}]
++    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{key:items} if key else items)
++    with pytest.raises(ValueError,match='duplicate'):
++        list(ADAPTERS[name]('fixture'))
++
++
++@pytest.mark.parametrize('family',['smartrecruiters','workday'])
++def test_final_page_failure_preserves_yielded_positive_but_never_completes(monkeypatch,family):
++    from job_discovery import http
++    from job_discovery.adapters import ADAPTERS
++    module=smartrecruiters if family=='smartrecruiters' else workday
++    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
++    calls=[]
++    def page(*a,**kw):
++        calls.append(1)
++        if len(calls)>1:
++            raise ValueError('fixture final page failed')
++        return {'content':[{'id':'one','name':'Role'}],'totalFound':2} if family=='smartrecruiters' else {'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2}
++    monkeypatch.setattr(http,'get_json',page)
++    monkeypatch.setattr(http,'post_json',page)
++    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
++    assert next(feed).external_id=='one'
++    with pytest.raises(ValueError,match='final page'):
++        list(feed)
++    assert not feed.complete
++
++
++@pytest.mark.parametrize('family',['smartrecruiters','workday'])
++def test_changed_total_cannot_certify_absence(monkeypatch,family):
++    from job_discovery import http
++    from job_discovery.adapters import ADAPTERS
++    module=smartrecruiters if family=='smartrecruiters' else workday
++    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
++    if family=='smartrecruiters':
++        pages=iter([{'content':[{'id':'one','name':'Role'}],'totalFound':2},
++                    {'content':[{'id':'two','name':'Role'}],'totalFound':1}])
++    else:
++        pages=iter([{'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2},
++                    {'jobPostings':[],'total':0}])
++    monkeypatch.setattr(http,'get_json',lambda *a,**kw:next(pages))
++    monkeypatch.setattr(http,'post_json',lambda *a,**kw:next(pages))
++    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
++    list(feed)
++    assert not feed.complete
++
++
++def test_board_time_budget_checked_between_postings_without_another_request(monkeypatch):
++    from job_discovery.adapters import completeness as c
++    from job_discovery.models import Posting
++    clock=[0.0]
++    monkeypatch.setattr(c,'monotonic',lambda:clock[0])
++    with c.source_budget(10,2):
++        feed=c.SourceResult(iter([Posting('one','Role','u'),Posting('two','Role','u')]),c.SourceStatus())
++        next(feed)
++        clock[0]=10
++        with pytest.raises(c.SourceBudgetExceeded):
++            next(feed)
++        assert not feed.complete
+diff --git a/tests/test_workable.py b/tests/test_workable.py
+index 656a53f..382b71c 100644
+--- a/tests/test_workable.py
++++ b/tests/test_workable.py
+@@ -55,21 +55,21 @@ def test_extract_description_none_when_empty():
+ 
+ 
+ def test_fetch_is_a_single_widget_call_with_no_pagination(monkeypatch):
+     requested: list[str] = []
+ 
+     def fake_get_json(url):
+         requested.append(url)
+         return WIDGET
+ 
+     monkeypatch.setattr(workable, "get_json", fake_get_json)
+-    postings = fetch_workable("acme")
++    postings = list(fetch_workable("acme"))
+ 
+     assert [p.external_id for p in postings] == ["ENG123", "OPS456", "DS789"]
+     # exactly ONE call: the widget endpoint — no per-job detail fetch, no paging
+     assert requested == [WIDGET_URL]
+     assert postings[0].url == "https://apply.workable.com/acme/j/ENG123/"
+ 
+ 
+ def test_fetch_keeps_minimal_posting_when_job_malformed(monkeypatch):
+     # A malformed entry (here: missing `title`, which the parser dereferences)
+     # must not abort the company fetch nor be dropped — dropping it would let
+@@ -78,21 +78,21 @@ def test_fetch_keeps_minimal_posting_when_job_malformed(monkeypatch):
+     payload = {"name": "Acme", "jobs": [
+         {"shortcode": "ENG123", "title": "Good", "telecommuting": False,
+          "city": "SF", "department": "Eng", "description": "<p>x</p>"},
+         {"shortcode": "BAD"},  # no title -> parse raises -> minimal posting kept
+     ]}
+ 
+     def fake_get_json(url):
+         return payload
+ 
+     monkeypatch.setattr(workable, "get_json", fake_get_json)
+-    postings = fetch_workable("acme")
++    postings = list(fetch_workable("acme"))
+     assert [p.external_id for p in postings] == ["ENG123", "BAD"]
+     bad = postings[1]
+     assert bad.title is None  # no title available in the listing entry
+     assert bad.url == "https://apply.workable.com/acme/j/BAD/"  # token+shortcode
+ 
+ 
+ def test_fetch_rejects_entries_without_a_shortcode(monkeypatch):
+     # An entry with no stable ID makes the listing unsafe for closure detection.
+     payload = {"jobs": [
+         {"title": "No Shortcode", "telecommuting": True},  # no shortcode -> dropped
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-reviewer-dispatch.md
new file mode 100644
index 0000000..09dd7bc
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-reviewer-dispatch.md
@@ -0,0 +1,13 @@
+# Task6 independent permitted requirements/quality reviewer dispatch preparation
+
+Fresh independent reviewer after author DONE and FULL recorded BASE..HEAD package. BASE ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409; HEAD and package path must be filled from actual final commit. No source edits, commits, subagents or covered test reruns.
+
+Read REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, task-6-brief.md, task-6-report.md, FULL task-6-review-package.md and actual evidence outputs. This is new-task ordinary source correctness/requirements and code-quality review, NOT replacement security review. Do not retry/reproduce refused Task3 expiry/capacity/cross-user adversarial reviews/probes or use alternative tools to evade a safeguard. Report implemented/tested/independently reviewed/deliberately unreviewed scopes honestly. If safeguard appears report exact and stop affected work only.
+
+Review full six-family completion semantics, trustworthy positives across partial failures, two distinct complete successful misses >=24elapsedUTC, >20 prioropen suspicious empty, newer positive versus older absence, restart checkpoint cursor truth, <=500 commits, finite fairness proof under huge/small boards and repeated budget exhaustion, failure-disabled retry24h..7d versus deliberate exclusions, fullcorpus independently from user matches, and ordinary caller ordering aboveguard/noactiveusers. Preserve frozen age/identity/privateFKs and off-flag existing ingestion/PR16closure compatibility. Source-enabled metadata-only admission is intentionally integrated in Task7; assess inter-task interface correctness without claiming Task7 done. Claims source180/renew<=30, no network in SQL transactions, exact DB clocks and report inventories are binding functional requirements; examine new normal source behavior without reopening refused mechanism probes.
+
+Known unresolved FUNCTIONAL/ROLLOUT issue recorded in progress.md: existing lifecycle_validate_row charges changed source_accounts/source_listings/source_enumerations as growth, reserve_capacity and first source claim reject over6000MiB. Controller Task6 ruling preserves existing guard while implementing bounded read-only healthy feed attempt/storage-blocked/deferred reconciliation, no absence certification. Durable enforced above-guard reconciliation remains unfulfilled and must carry downstream Task10/13/finalreview; assess this limitation and any additional implementation gaps rather than infer a full guarantee. Flag-off legacy closure aboveguard must remain. Raise findings normally, do not assume limitation is a waived functional requirement or security approval.
+
+Do not rerun author-selected DB tests on same code. Inspect exact serverversions/commands/output and selected scopes; any narrowly necessary new ordinary diagnostic must address a concrete uncovered Task6 concern and avoid blocked work. Full repo pytest/adversarial suites forbidden. No production/network/provider/paid calls, live deletion/activation/deployment, shared55432 or destructive feedback tests.
+
+Write task-6-requirements-review.md in this plan workspace: pinned BASE/HEAD, Spec PASS/FAIL and Quality APPROVED/CHANGES_REQUIRED explicitly; exact Important/Critical findings with path/line/evidence and useful fixes; cannot-verify items; minor notes; aboveguard integration limitation; scope. Return brief verdict/report path and stop. Reviewer does not modify product or controller ledgers.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-author-dispatch.md
index 053182c..d7c0de7 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-author-dispatch.md
@@ -30,10 +30,12 @@ commands/versions/RED-GREEN, behavior, inventory and review limitations. Commit
 source/test/report/evidence forward, exclude controller artifacts. Return
 DONE+SHA and stop for independent permitted requirements/quality review and
 Library checkpoint before Task 8. Any safeguard: report exact error, no bypass,
 stop only affected work and continue independently permitted work.
 
 Release authorization is now recorded in RELEASE-AUTHORIZATION.md: completed
 upgrade may publish/merge/deploy after all tasks and permitted verification.
 Controller owns final release; your implementation task remains local-only.
 No permanent deletion, new credentials/IAM/security settings are implicitly
 authorized, and reduced independent-review gaps remain explicit.
+
+Carry the Task6 above-guard functional/rollout conflict in progress.md: bounded read-only verification may proceed, but existing source/staging growth accounting blocks durable reconciliation above 6000 MiB. Do not claim this goal completed or security approved. Assess ordinary integration correctness, preserve flag-off legacy closure, and report a concrete minimal contract repair before changing established enforcement.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-author-dispatch.md
index ab48915..b2aae55 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-8-author-dispatch.md
@@ -36,10 +36,20 @@ Write task-8-report.md and sanitized task-8-evidence/ (git add -f), exact
 RED/GREEN commands/versions/limits and changed caller inventory. Commit own
 source/tests/report/evidence forward, exclude controller artifacts. Return
 DONE+SHA, stop for fresh permitted requirements/quality review (amended
 Checkpoint C, not full independent security approval) then Librarycheckpoint.
 
 Release authorization is now recorded in RELEASE-AUTHORIZATION.md: completed
 upgrade may publish/merge/deploy after all tasks and permitted verification.
 Controller owns final release; your implementation task remains local-only.
 No permanent deletion, new credentials/IAM/security settings are implicitly
 authorized, and reduced independent-review gaps remain explicit.
+
+Task6 inherited HTTP integration gap: all six adapters retain job_discovery.http,
+which follows redirects and does not establish global full-fetch20s,
+redirect<=3/address revalidation-pinning or10MiB wire+decompressed limits.
+Demand's required bounded public transport should provide an explicit shared
+contract where appropriate; inventory affected source/detail callers and
+coordinate actual integration rather than implement a demand-only guarantee
+and leave source verification unbounded. Carry any residual gap to Task9/13.
+Normal bounded transport functionality is separate from the refused Task3
+mechanism review; report any safeguard overlap concretely before execution.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-author-dispatch.md
index 4c1633a..0341c82 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-author-dispatch.md
@@ -23,10 +23,12 @@ destructive feedback fixtures. Do not claim independent validation of excluded
 expiry-enforcement/capacity/cross-user security guarantees.
 
 Report task-9-report.md plus sanitized task-9-evidence/ (git add -f) with exact
 commands/results/browser evidence/consumer inventory and explicit review limits.
 Forwardcommit ownsource/tests/report/evidence, excludecontrollerfiles. Return
 DONE+SHA; controller independent permitted requirements/quality review and
 Library checkpoint precede Task10. Any safeguard: report exact error, stop
 only affected work, continue permitted work without bypass. No production,
 activation/deployment/merge/push/IAM/infrastructure/unrelated Railway actions
 by the author. Permanent-deletion/safety-floor actions need applicable approval.
+
+Task6 inherited transport issue (progress.md): adapters use job_discovery.http with redirects. New per-board request/time budgets do not establish full publicfetch deadline20s, redirect<=3, each address/redirect revalidation/pinning and10MiB wire+decompressed cap. Inventory and implement the required normal bounded public transport integration within authorized scope; report any safeguard overlap concretely rather than bypassing it or declaring the contract proved.
diff --git a/job_discovery/adapters/ashby.py b/job_discovery/adapters/ashby.py
index 85d439d..83a4f12 100644
--- a/job_discovery/adapters/ashby.py
+++ b/job_discovery/adapters/ashby.py
@@ -1,11 +1,11 @@
-from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, iter_identified_postings
 from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def parse_ashby(data: dict) -> list[Posting]:
     postings: list[Posting] = []
     for j in data.get("jobs", []):
         loc = j.get("location")
         postings.append(
@@ -20,12 +20,14 @@ def parse_ashby(data: dict) -> list[Posting]:
             )
         )
     return postings
 
 
 def fetch_ashby(token: str, *, fetch_details: bool = True) -> SourceResult:
     url = f"https://api.ashbyhq.com/posting-api/job-board/{token}"
     data = get_json(url)
     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
         raise ValueError("ashby response missing 'jobs' key")
-    validate_ids(data["jobs"], "id")
-    return SourceResult(iter(parse_ashby(data)), SourceStatus(fetch_details=fetch_details))
+    status = SourceStatus(fetch_details=fetch_details)
+    return SourceResult(iter_identified_postings(
+        data["jobs"], lambda item: parse_ashby({"jobs": [item]})[0], status,
+        title_key='title', url_keys=('jobUrl', 'applyUrl')), status)
diff --git a/job_discovery/adapters/completeness.py b/job_discovery/adapters/completeness.py
index a032de1..c553397 100644
--- a/job_discovery/adapters/completeness.py
+++ b/job_discovery/adapters/completeness.py
@@ -83,10 +83,49 @@ def _request(method, url, **kwargs):
         kwargs.update(retries=0,timeout=min(20,max(0.001,budget[0]-monotonic())))
     return getattr(http, method)(url, **kwargs)
 
 
 def get_json(url, **kwargs):
     return _request('get_json',url,**kwargs)
 
 
 def post_json(url, **kwargs):
     return _request('post_json',url,**kwargs)
+
+
+def iter_identified_postings(items, parse_one, status, *, title_key, url_keys,
+                             id_key="id", minimal_posting=None):
+    """Keep trustworthy identities even when the same response is incomplete.
+
+    Bad or repeated identities invalidate absence but do not erase other items.
+    An identifiable item with malformed display fields remains a minimal positive;
+    it cannot be admitted as a new Job until its required display fields exist.
+    """
+    seen = set()
+    for item in items:
+        external_id = item.get(id_key) if isinstance(item, dict) else None
+        if (not isinstance(external_id, (str, int)) or isinstance(external_id, bool)
+                or not str(external_id).strip()):
+            status.complete = False
+            continue
+        external_id = str(external_id)
+        if external_id in seen:
+            status.complete = False
+            continue
+        seen.add(external_id)
+        try:
+            posting = parse_one(item)
+            if not isinstance(posting.title, str) or not posting.title.strip():
+                raise ValueError('listing title is missing')
+            if not isinstance(posting.url, str) or not posting.url.strip():
+                raise ValueError('listing URL is missing')
+        except (KeyError, TypeError, AttributeError, ValueError, IndexError) as exc:
+            status.complete = False
+            title = item.get(title_key)
+            url = next((item.get(key) for key in url_keys
+                        if isinstance(item.get(key), str) and item[key].strip()), None)
+            posting = minimal_posting(item, exc) if minimal_posting else None
+            if posting is None:
+                posting = Posting(external_id=external_id,
+                                  title=title if isinstance(title, str) else None,
+                                  url=url, raw=item)
+        yield posting
diff --git a/job_discovery/adapters/greenhouse.py b/job_discovery/adapters/greenhouse.py
index 404278e..a8b094c 100644
--- a/job_discovery/adapters/greenhouse.py
+++ b/job_discovery/adapters/greenhouse.py
@@ -1,11 +1,11 @@
-from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, iter_identified_postings
 from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def parse_greenhouse(data: dict) -> list[Posting]:
     postings: list[Posting] = []
     for j in data.get("jobs") or []:
         loc = (j.get("location") or {}).get("name")
         depts = j.get("departments") or []
@@ -22,25 +22,30 @@ def parse_greenhouse(data: dict) -> list[Posting]:
             )
         )
     return postings
 
 
 def fetch_greenhouse(token: str, *, fetch_details: bool = True) -> SourceResult:
     url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content={str(fetch_details).lower()}"
     data = get_json(url)
     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
         raise ValueError("greenhouse response missing 'jobs' key")
-    validate_ids(data["jobs"], "id")
-    total = (data.get("meta") or {}).get("total")
-    if isinstance(total, int) and total != len(data["jobs"]):
-        raise ValueError("greenhouse incomplete listing below reported total")
-    return SourceResult(iter(parse_greenhouse(data)), SourceStatus(fetch_details=fetch_details))
+    status = SourceStatus(fetch_details=fetch_details)
+    meta = data.get("meta")
+    total = meta.get("total") if isinstance(meta, dict) else None
+    if meta is not None and not isinstance(meta, dict):
+        status.complete = False
+    if total is not None and (type(total) is not int or total != len(data["jobs"])):
+        status.complete = False
+    return SourceResult(iter_identified_postings(
+        data["jobs"], lambda item: parse_greenhouse({"jobs": [item]})[0], status,
+        title_key='title', url_keys=('absolute_url',)), status)
 
 
 def _as_string(v) -> str:
     if isinstance(v, str):
         return v
     if isinstance(v, bool) or isinstance(v, (int, float)):
         return str(v)
     return ""
 
 
diff --git a/job_discovery/adapters/lever.py b/job_discovery/adapters/lever.py
index e2f2704..1b92650 100644
--- a/job_discovery/adapters/lever.py
+++ b/job_discovery/adapters/lever.py
@@ -1,11 +1,11 @@
-from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, iter_identified_postings
 from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def _explicit_remote(workplace_type: str | None) -> bool | None:
     if workplace_type == "remote":
         return True
     if workplace_type in ("on-site", "hybrid"):
         return False
@@ -29,12 +29,14 @@ def parse_lever(data: list) -> list[Posting]:
             )
         )
     return postings
 
 
 def fetch_lever(token: str, *, fetch_details: bool = True) -> SourceResult:
     url = f"https://api.lever.co/v0/postings/{token}?mode=json"
     data = get_json(url)
     if not isinstance(data, list):
         raise ValueError(f"lever response expected a list, got {type(data).__name__}")
-    validate_ids(data, "id")
-    return SourceResult(iter(parse_lever(data)), SourceStatus(fetch_details=fetch_details))
+    status = SourceStatus(fetch_details=fetch_details)
+    return SourceResult(iter_identified_postings(
+        data, lambda item: parse_lever([item])[0], status,
+        title_key='text', url_keys=('hostedUrl',)), status)
diff --git a/job_discovery/adapters/smartrecruiters.py b/job_discovery/adapters/smartrecruiters.py
index 94716c0..f509708 100644
--- a/job_discovery/adapters/smartrecruiters.py
+++ b/job_discovery/adapters/smartrecruiters.py
@@ -96,29 +96,31 @@ def _fetch_smartrecruiters(token, status):
     offset = 0
     seen = set()
     expected_total = 0
     previous_total = None
     while True:
         page = get_json(f"{base}?limit={_PAGE_LIMIT}&offset={offset}")
         if not isinstance(page, dict) or not isinstance(page.get("content"), list):
             raise ValueError("smartrecruiters response missing 'content' key")
         content = page.get("content") or []
         if any(not isinstance(item,dict) for item in content):
-            raise ValueError('invalid listing item')
+            status.complete = False
         total = page.get("totalFound")
         if previous_total is not None and isinstance(total,int) and total != previous_total:
             status.complete = False
         if isinstance(total,int):
             previous_total = total
         if isinstance(total, int) and total > 0:
             expected_total = max(expected_total, total)
         for item in content:
+            if not isinstance(item, dict):
+                continue
             pid = item.get("id")
             if not pid or pid in seen:
                 raise ValueError("smartrecruiters incomplete listing: missing or repeated id")
             seen.add(pid)
             if not fetch_details:
                 yield _minimal_posting(token, item)
                 continue
             try:
                 # Both the fetch and the parse live inside the try: a malformed
                 # HTTP-200 detail body must not abort the whole company fetch.
diff --git a/job_discovery/adapters/workable.py b/job_discovery/adapters/workable.py
index ffb8c12..05e3c15 100644
--- a/job_discovery/adapters/workable.py
+++ b/job_discovery/adapters/workable.py
@@ -1,11 +1,11 @@
-from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, iter_identified_postings
 import logging
 
 from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 log = logging.getLogger("job_discovery")
 
 # Workable's PUBLIC, no-auth widget endpoint returns the FULL published job list
 # for an account in a SINGLE GET, with the full HTML job description inline
@@ -88,24 +88,22 @@ def _minimal_posting(account: str, job: dict) -> Posting | None:
 
 def fetch_workable(token: str, *, fetch_details: bool = True) -> SourceResult:
     # ONE no-auth GET returns every published job with its full description
     # inline. Parse each entry inside a try/except so a single malformed job
     # entry yields a minimal posting instead of being dropped or crashing the
     # whole company fetch (a dropped job would let run.py's close-detection
     # falsely close a still-open posting).
     payload = get_json(_WIDGET_URL.format(account=token).replace("details=true", f"details={str(fetch_details).lower()}"))
     if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
         raise ValueError("workable response missing 'jobs' key")
-    validate_ids(payload["jobs"], "shortcode")
-    postings: list[Posting] = []
-    for job in payload.get("jobs") or []:
-        try:
-            posting = parse_workable_job(job, token)
-        except Exception as exc:  # malformed entry: keep a minimal posting, don't drop
-            log.warning(
-                "workable: malformed job entry for %s/%s; keeping minimal posting: %s: %s",
-                token, job.get("shortcode"), type(exc).__name__, exc,
-            )
-            posting = _minimal_posting(token, job)
-        if posting is not None:
-            postings.append(posting)
-    return SourceResult(iter(postings), SourceStatus(fetch_details=fetch_details))
+    status = SourceStatus(fetch_details=fetch_details)
+
+    def minimal(job, exc):
+        log.warning(
+            "workable: malformed job entry for %s/%s; keeping minimal posting: %s: %s",
+            token, job.get("shortcode"), type(exc).__name__, exc,
+        )
+        return _minimal_posting(token, job)
+
+    return SourceResult(iter_identified_postings(
+        payload["jobs"], lambda job: parse_workable_job(job, token), status,
+        id_key="shortcode", title_key="title", url_keys=(), minimal_posting=minimal), status)
diff --git a/job_discovery/adapters/workday.py b/job_discovery/adapters/workday.py
index 1e37d9b..252ab33 100644
--- a/job_discovery/adapters/workday.py
+++ b/job_discovery/adapters/workday.py
@@ -229,38 +229,51 @@ def _choose_subdivider(
         if not counts:
             continue
         max_count = max(counts)
         if max_count >= _HARD_CAP:
             continue  # a value still over the cap -> useless as a splitter
         if best is None or max_count < best[0]:
             best = (max_count, param, values)
     return None if best is None else (best[1], best[2])
 
 
+
+def _page_ids(items, status):
+    """Validate a page's identity coverage without discarding good items."""
+    ids = set()
+    for item in items:
+        path = item.get("externalPath") if isinstance(item, dict) else None
+        if not isinstance(path, str) or not path or path in ids:
+            status.complete = False
+            continue
+        ids.add(path)
+    return ids
+
+
 def _yield_items(
     items: list, seen: set[str], *, cxs: str, host: str, site: str, status: SourceStatus
 ) -> Iterator[Posting]:
     """Fetch+parse each listing item and yield new Postings (dedup by externalPath).
 
     This is the per-page work shared by the unfaceted walk and the faceted crawl:
     skip items already seen (facet overlap / wrap), fetch the detail and parse
     inside a try (a malformed HTTP-200 body must not abort the tenant), and fall
     back to a minimal posting when the detail is unavailable so the job is not
     dropped from run.py's seen-set.
 
     Memory note: `seen` is a set of path strings (O(n) memory), NOT a dict of
     full Posting objects; callers receive each Posting via yield and may discard
     it before the next one is fetched, keeping peak posting memory at O(1).
     """
     for item in items:
-        external_path = item.get("externalPath")
-        if not external_path:
+        external_path = item.get("externalPath") if isinstance(item, dict) else None
+        if not isinstance(external_path, str) or not external_path:
             status.complete = False
             continue
         if external_path in seen:
             continue  # missing id, or already ingested via another facet/page
         seen.add(external_path)
         if not status.fetch_details:
             yield _minimal_posting(item, host=host, site=site)
             continue
         try:
             # externalPath already begins with `/job/...`, so it appends directly
@@ -310,31 +323,30 @@ def _page_walk(
                 status.complete = False
             expected = max(expected, page_total)
         items = page["jobPostings"]
         if not items:
             if received < expected:
                 status.complete = False
             break  # genuinely empty page -> end of results
         # Wrap guard: past the 2000 hard cap Workday wraps back to page 1 rather
         # than returning empty, so if a later page repeats page 1's first posting
         # we've wrapped — stop BEFORE re-ingesting duplicates.
-        this_first = items[0].get("externalPath")
+        this_first = items[0].get("externalPath") if isinstance(items[0], dict) else None
         if offset == 0:
             first_path = this_first
         elif this_first is not None and this_first == first_path:
             status.complete = False
             break
-        for item in items:
-            path = item.get("externalPath")
-            if path in query_ids:
-                status.complete = False
-            query_ids.add(path)
+        page_ids = _page_ids(items, status)
+        if query_ids & page_ids:
+            status.complete = False
+        query_ids.update(page_ids)
         received += len(items)
         yield from _yield_items(items, seen, cxs=cxs, host=host, site=site, status=status)
         offset += _PAGE_LIMIT
         if offset >= _HARD_CAP:
             status.complete = False
             break  # hard cap: never page a single query past the 2000 ceiling
         if len(items) < _PAGE_LIMIT:
             if received < expected:
                 status.complete = False
             break  # short page -> end of results
@@ -367,41 +379,41 @@ def _crawl(
     if not isinstance(first, dict) or not isinstance(first.get("jobPostings"), list):
         raise ValueError("workday response missing 'jobPostings' key")
     total = first.get("total") or 0
     # Total-flap fallback: total=0 but the page has items → Workday is reporting a
     # stale/flapped total. Use the wrap-guarded _page_walk (which never relies on
     # `total` as a stop signal) to keep paging until the genuine end of results.
     if not total and first.get("jobPostings"):
         yield from _page_walk(cxs, applied_facets, first, seen, host=host, site=site, status=status)
         return
     if total < _HARD_CAP:
-        partition_ids = set()
-        partition_ids.update(i.get("externalPath") for i in first["jobPostings"])
+        partition_ids = _page_ids(first["jobPostings"], status)
         yield from _yield_items(first.get("jobPostings") or [], seen,
                                 cxs=cxs, host=host, site=site, status=status)
         expected = total
         offset = _PAGE_LIMIT
         while offset < total:
             page = _post_jobs(cxs, applied_facets, offset)
             if not isinstance(page, dict) or not isinstance(page.get("jobPostings"), list):
                 raise ValueError("workday response missing 'jobPostings' key")
             page_total = page.get("total")
             if isinstance(page_total, int):
                 if page_total != expected:
                     status.complete = False
                 expected = max(expected, page_total)
             items = page.get("jobPostings") or []
             if not items:
                 break
-            if any(i.get("externalPath") in partition_ids for i in items):
+            page_ids = _page_ids(items, status)
+            if partition_ids & page_ids:
                 status.complete = False
-            partition_ids.update(i.get("externalPath") for i in items)
+            partition_ids.update(page_ids)
             yield from _yield_items(items, seen, cxs=cxs, host=host, site=site, status=status)
             offset += _PAGE_LIMIT
         if len(partition_ids - {None}) < expected:
             status.complete = False
         return
 
     subdivider = (
         _choose_subdivider(first.get("facets"), set(applied_facets))
         if depth < _MAX_FACET_DEPTH
         else None
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
index 5af0b6e..2c5c420 100644
--- a/job_discovery/lifecycle/reconcile.py
+++ b/job_discovery/lifecycle/reconcile.py
@@ -39,38 +39,46 @@ def _write(conn, claim, scope, job_id=None, size=32768):
         raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
     bind_reservation(conn, reservation, job_id=job_id, scope=scope)
     yield
     settle_capacity(conn, reservation)
 
 
 def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
     enter_gate(conn)
     if not read_control(conn).source_enabled:
         return None
-    # Last-attempt ordering is essential: an interrupted huge board goes behind
-    # untouched small boards even if neither has ever completed successfully.
+    # Order by the last claimed work turn, including reconciliation-only turns.
+    # The persisted lease start prevents a huge pending tail starving other
+    # sources while last_attempt_at continues to mean an actual feed attempt.
     source = conn.execute("""SELECT s.* FROM source_accounts s
         WHERE exclusion_state IN ('enabled','failure_disabled')
-          AND (next_due_at IS NULL OR next_due_at<=clock_timestamp())
+          AND ((next_due_at IS NULL OR next_due_at<=clock_timestamp()) OR EXISTS
+            (SELECT FROM source_enumerations e WHERE e.source_id=s.id AND e.status='complete'
+             AND e.reconciled_at IS NULL AND e.sequence>s.replay_floor))
           AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
             AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
-        ORDER BY last_attempt_at NULLS FIRST,last_complete_success_at NULLS FIRST,id
+        ORDER BY GREATEST(last_attempt_at,lease_until-interval '180 seconds') NULLS FIRST,
+                 last_complete_success_at NULLS FIRST,id
         LIMIT 1""").fetchone()
     if not source:
         return None
     claim = claim_work(conn, 'source', str(source['id']), 180)
     if claim is None:
         raise StorageBlocked('source claim storage blocked; reconciliation deferred')
+    pending = conn.execute('''SELECT 1 FROM source_enumerations WHERE source_id=%s
+        AND status='complete' AND reconciled_at IS NULL AND sequence>%s LIMIT 1''',
+        (source['id'],source['replay_floor'])).fetchone() is not None
     with _write(conn, claim, 'source_accounts'):
-        conn.execute("""UPDATE source_accounts SET last_attempt_at=clock_timestamp(),
-            last_outcome='attempting',claim_owner_token=%s,claim_generation=%s,
-            lease_until=%s WHERE id=%s""", (claim.owner_token,claim.generation,claim.lease_until,source['id']))
+        conn.execute("""UPDATE source_accounts SET last_attempt_at=CASE WHEN %s THEN last_attempt_at ELSE clock_timestamp() END,
+            last_outcome=CASE WHEN %s THEN last_outcome ELSE 'attempting' END,
+            claim_owner_token=%s,claim_generation=%s,lease_until=%s WHERE id=%s""",
+            (pending,pending,claim.owner_token,claim.generation,claim.lease_until,source['id']))
     return source, claim
 
 
 def _check(conn, enum):
     validate_claim(conn, enum.claim)
     row = conn.execute("""SELECT e.* FROM source_enumerations e JOIN source_accounts s ON s.id=e.source_id
       WHERE e.id=%s AND e.source_id=%s AND e.sequence=%s AND e.sequence>s.replay_floor
        AND e.owner_token=%s AND e.generation=%s FOR UPDATE OF e""",
       (enum.id,enum.source_id,enum.sequence,enum.claim.owner_token,enum.claim.generation)).fetchone()
     if row is None:
@@ -85,20 +93,44 @@ def begin_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef:
     with _write(conn, claim, 'source_accounts'):
         row = conn.execute("""UPDATE source_accounts SET enumeration_sequence=enumeration_sequence+1
             WHERE id=%s RETURNING enumeration_sequence""", (source_id,)).fetchone()
     with _write(conn, claim, 'source_enumerations'):
         enum = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status)
             VALUES(%s,%s,%s,%s,'running') RETURNING id""",
             (source_id,row['enumeration_sequence'],claim.owner_token,claim.generation)).fetchone()
     return EnumerationRef(enum['id'],source_id,row['enumeration_sequence'],claim)
 
 
+
+def resume_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef | None:
+    """Adopt immutable complete membership and its checkpoint in one commit.
+
+    claim_work already fenced the prior generation. The staging trigger permits
+    only an ownership-only change to a complete, unreconciled same-source run.
+    Neither its sequence nor its successful-evidence timestamps advance.
+    """
+    validate_claim(conn, claim)
+    row = conn.execute("""SELECT e.* FROM source_enumerations e JOIN source_accounts s ON s.id=e.source_id
+        WHERE e.source_id=%s AND e.status='complete' AND e.reconciled_at IS NULL
+          AND e.sequence>s.replay_floor ORDER BY e.sequence LIMIT 1 FOR UPDATE OF e""",
+        (source_id,)).fetchone()
+    if row is None:
+        return None
+    with _write(conn, claim, 'source_enumerations'):
+        conn.execute('UPDATE source_enumerations SET owner_token=%s,generation=%s WHERE id=%s',
+                     (claim.owner_token,claim.generation,row['id']))
+    with _write(conn, claim, 'reconciliation_checkpoints'):
+        conn.execute('UPDATE reconciliation_checkpoints SET generation=%s WHERE enumeration_id=%s',
+                     (claim.generation,row['id']))
+    return EnumerationRef(row['id'],source_id,row['sequence'],claim)
+
+
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
@@ -174,23 +206,23 @@ def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatu
     suspicious = empty and prior_open > 20
     status = 'complete' if verdict.complete and not suspicious else ('failed' if verdict.failed else 'partial')
     outcome = 'suspicious_empty' if suspicious else status
     with _write(conn,enumeration.claim,'source_enumerations'):
         conn.execute('UPDATE source_enumerations SET status=%s,completed_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=%s', (status,enumeration.id))
     with _write(conn,enumeration.claim,'source_accounts'):
         conn.execute("""UPDATE source_accounts SET last_outcome=%s,
           last_complete_success_at=CASE WHEN %s='complete' THEN clock_timestamp() ELSE last_complete_success_at END,
           failure_streak=CASE WHEN %s='complete' THEN 0 ELSE failure_streak+1 END,
           suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
-          next_due_at=clock_timestamp()+interval '24 hours' *
+          next_due_at=(date_trunc('day',last_attempt_at AT TIME ZONE 'UTC')+interval '24 hours' *
              CASE WHEN exclusion_state='failure_disabled' AND %s<>'complete'
-                  THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END
+                  THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC'
           WHERE id=%s""", (outcome,status,status,suspicious,status,enumeration.source_id))
 
 
 def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool:
     if type(limit) is not int or not 1 <= limit <= 500:
         raise ValueError('reconciliation limit must be 1..500')
     enter_gate(conn)
     e = conn.execute('SELECT * FROM source_enumerations WHERE id=%s',(enumeration.id,)).fetchone()
     if e is None:
         raise RuntimeError('stale or fenced source enumeration')
@@ -256,68 +288,72 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
             pair = claim_due_source(conn)
             conn.commit()
         except StorageBlocked:
             conn.rollback()
             verify_storage_blocked(conn, max_boards=max_boards, deadline=deadline)
             break
         if pair is None:
             break
         source, claim = pair
         try:
-            enum = begin_enumeration(conn,source['id'],claim)
+            enum = resume_enumeration(conn,source['id'],claim)
+            resuming = enum is not None
+            if not resuming:
+                enum = begin_enumeration(conn,source['id'],claim)
             conn.commit()
         except StorageBlocked:
             conn.rollback()
             cancel_claim(conn,claim)
             conn.commit()
             verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
             break
         chunk = []
-        verdict = SourceStatus(complete=False)
+        verdict = SourceStatus(complete=resuming)
         renewed = monotonic()
-        try:
-            def pulse():
-                # No SQL transaction spans network, and each bounded request
-                # starts with a renewed lease (including empty duplicate pages).
-                renew_claim(conn,claim)
+        if not resuming:
+            try:
+                def pulse():
+                    # No SQL transaction spans network, and each bounded request
+                    # starts with a renewed lease (including empty duplicate pages).
+                    renew_claim(conn,claim)
+                    conn.commit()
+                with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
+                    postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+                    count = 0
+                    for posting in postings:
+                        count += 1
+                        if count > BOARD_ROWS:
+                            break
+                        chunk.append(posting)
+                        if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
+                            stage_postings(conn,enum,chunk)
+                            conn.commit()
+                            chunk = []
+                            claim = renew_claim(conn,claim)
+                            conn.commit()
+                            enum = replace(enum,claim=claim)
+                            renewed = monotonic()
+                    verdict = SourceStatus(complete=postings.complete)
+            except StorageBlocked:
+                conn.rollback()
+                log.warning("source evidence storage blocked; reconciliation deferred")
+                cancel_claim(conn,claim)
                 conn.commit()
-            with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
-                postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
-                count = 0
-                for posting in postings:
-                    count += 1
-                    if count > BOARD_ROWS:
-                        break
-                    chunk.append(posting)
-                    if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
-                        stage_postings(conn,enum,chunk)
-                        conn.commit()
-                        chunk = []
-                        claim = renew_claim(conn,claim)
-                        conn.commit()
-                        enum = replace(enum,claim=claim)
-                        renewed = monotonic()
-                verdict = SourceStatus(complete=postings.complete)
-        except StorageBlocked:
-            conn.rollback()
-            log.warning("source evidence storage blocked; reconciliation deferred")
-            cancel_claim(conn,claim)
-            conn.commit()
-            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
-            break
-        except SourceBudgetExceeded:
-            verdict = SourceStatus(complete=False)
-            conn.rollback()
-        except Exception:
-            log.exception('source enumeration failed or interrupted: %s',source['id'])
-            verdict = SourceStatus(complete=False,failed=True)
-            conn.rollback()
+                verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
+                break
+            except SourceBudgetExceeded:
+                verdict = SourceStatus(complete=False)
+                conn.rollback()
+            except Exception:
+                log.exception('source enumeration failed or interrupted: %s',source['id'])
+                verdict = SourceStatus(complete=False,failed=True)
+                conn.rollback()
         try:
             if chunk:
                 stage_postings(conn,enum,chunk)
                 conn.commit()
             complete_enumeration(conn,enum,verdict)
             conn.commit()
             while True:
                 done = reconcile_chunk(conn,enum)
                 conn.commit()
                 if done or monotonic() >= deadline:
diff --git a/migrations/2026-10-03-02-source-reconciliation.sql b/migrations/2026-10-03-02-source-reconciliation.sql
new file mode 100644
index 0000000..8028617
--- /dev/null
+++ b/migrations/2026-10-03-02-source-reconciliation.sql
@@ -0,0 +1,57 @@
+-- Completed source membership can resume under the existing newer same-source
+-- claim. No claim, lease, capacity, role or owner validator is relaxed.
+CREATE INDEX IF NOT EXISTS idx_enumerations_pending_reconciliation
+ ON source_enumerations(source_id,sequence)
+ WHERE status='complete' AND reconciled_at IS NULL;
+CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE e public.source_enumerations; c public.lifecycle_claims; floor bigint;
+BEGIN
+ IF TG_TABLE_NAME='source_accounts' THEN
+  IF NEW.replay_floor<OLD.replay_floor OR NEW.enumeration_sequence<OLD.enumeration_sequence OR NEW.claim_generation<OLD.claim_generation THEN
+   RAISE EXCEPTION 'source generation and replay floor are monotonic'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN e:=NEW;
+ ELSE SELECT * INTO STRICT e FROM public.source_enumerations WHERE id=NEW.enumeration_id;
+ END IF;
+ SELECT replay_floor INTO STRICT floor FROM public.source_accounts WHERE id=e.source_id;
+ IF e.sequence<=floor THEN RAISE EXCEPTION 'enumeration sequence rejected by replay floor'; END IF;
+ SELECT * INTO c FROM public.lifecycle_claims WHERE kind='source' AND work_id=e.source_id::text
+ AND owner_token=e.owner_token AND generation=e.generation AND generation>replay_floor
+ AND state='active' AND lease_until>clock_timestamp() AND invoking_role=current_user
+ AND subject_id IS NOT DISTINCT FROM public.app_user_id();
+ IF NOT FOUND THEN RAISE EXCEPTION 'stale, foreign or fenced enumeration claim'; END IF;
+ IF TG_TABLE_NAME='enumeration_members' AND e.status<>'running' THEN
+  RAISE EXCEPTION 'completed or terminal membership cannot change';
+ END IF;
+ IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
+  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN
+  IF TG_OP='UPDATE' THEN
+   IF NEW.id<>OLD.id OR NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence THEN
+    RAISE EXCEPTION 'enumeration identity is immutable';
+   END IF;
+   IF OLD.status='complete' AND NEW.status<>'complete' THEN
+    RAISE EXCEPTION 'completed enumeration status is immutable';
+   END IF;
+   IF NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation THEN
+    -- The current same-source claim was validated above. A takeover fences its
+    -- old generation first; only ownership may change on an unfinished complete
+    -- snapshot. Completion/evidence identity and cursor are never reconstructed.
+    IF OLD.status<>'complete' OR OLD.reconciled_at IS NOT NULL
+       OR NEW.generation<=OLD.generation OR c.replay_floor<OLD.generation
+       OR (to_jsonb(NEW)-'owner_token'-'generation') IS DISTINCT FROM
+          (to_jsonb(OLD)-'owner_token'-'generation') THEN
+     RAISE EXCEPTION 'only completed pending reconciliation permits ownership handoff';
+    END IF;
+   END IF;
+  END IF;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
+ VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-source-reconciliation.sql') ON CONFLICT DO NOTHING;
diff --git a/schema.sql b/schema.sql
index 557c11a..8462574 100644
--- a/schema.sql
+++ b/schema.sql
@@ -2089,10 +2089,68 @@ BEGIN
   IF TG_OP='UPDATE' AND (NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence OR NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation) THEN
    RAISE EXCEPTION 'enumeration identity is immutable';
   END IF;
  END IF;
  INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
  VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-maintenance.sql') ON CONFLICT DO NOTHING;
+
+-- Completed source membership can resume under the existing newer same-source
+-- claim. No claim, lease, capacity, role or owner validator is relaxed.
+CREATE INDEX IF NOT EXISTS idx_enumerations_pending_reconciliation
+ ON source_enumerations(source_id,sequence)
+ WHERE status='complete' AND reconciled_at IS NULL;
+CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE e public.source_enumerations; c public.lifecycle_claims; floor bigint;
+BEGIN
+ IF TG_TABLE_NAME='source_accounts' THEN
+  IF NEW.replay_floor<OLD.replay_floor OR NEW.enumeration_sequence<OLD.enumeration_sequence OR NEW.claim_generation<OLD.claim_generation THEN
+   RAISE EXCEPTION 'source generation and replay floor are monotonic'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN e:=NEW;
+ ELSE SELECT * INTO STRICT e FROM public.source_enumerations WHERE id=NEW.enumeration_id;
+ END IF;
+ SELECT replay_floor INTO STRICT floor FROM public.source_accounts WHERE id=e.source_id;
+ IF e.sequence<=floor THEN RAISE EXCEPTION 'enumeration sequence rejected by replay floor'; END IF;
+ SELECT * INTO c FROM public.lifecycle_claims WHERE kind='source' AND work_id=e.source_id::text
+ AND owner_token=e.owner_token AND generation=e.generation AND generation>replay_floor
+ AND state='active' AND lease_until>clock_timestamp() AND invoking_role=current_user
+ AND subject_id IS NOT DISTINCT FROM public.app_user_id();
+ IF NOT FOUND THEN RAISE EXCEPTION 'stale, foreign or fenced enumeration claim'; END IF;
+ IF TG_TABLE_NAME='enumeration_members' AND e.status<>'running' THEN
+  RAISE EXCEPTION 'completed or terminal membership cannot change';
+ END IF;
+ IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
+  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN
+  IF TG_OP='UPDATE' THEN
+   IF NEW.id<>OLD.id OR NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence THEN
+    RAISE EXCEPTION 'enumeration identity is immutable';
+   END IF;
+   IF OLD.status='complete' AND NEW.status<>'complete' THEN
+    RAISE EXCEPTION 'completed enumeration status is immutable';
+   END IF;
+   IF NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation THEN
+    -- The current same-source claim was validated above. A takeover fences its
+    -- old generation first; only ownership may change on an unfinished complete
+    -- snapshot. Completion/evidence identity and cursor are never reconstructed.
+    IF OLD.status<>'complete' OR OLD.reconciled_at IS NOT NULL
+       OR NEW.generation<=OLD.generation OR c.replay_floor<OLD.generation
+       OR (to_jsonb(NEW)-'owner_token'-'generation') IS DISTINCT FROM
+          (to_jsonb(OLD)-'owner_token'-'generation') THEN
+     RAISE EXCEPTION 'only completed pending reconciliation permits ownership handoff';
+    END IF;
+   END IF;
+  END IF;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
+ VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-source-reconciliation.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_lifecycle_maintenance.py b/tests/test_lifecycle_maintenance.py
index 3b7eede..ddd999c 100644
--- a/tests/test_lifecycle_maintenance.py
+++ b/tests/test_lifecycle_maintenance.py
@@ -139,25 +139,32 @@ def test_persisted_work_excludes_payload_retirement(conn, kind):
     assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
     assert conn.execute('SELECT description FROM jobs').fetchone()['description'] == 'jd'
 
 
 def enumeration(conn, *, completed=False, hours=169, members=4):
     from job_discovery.lifecycle.claims import claim_work
     source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref,enumeration_sequence) VALUES('lever','cleanup',1) RETURNING id").fetchone()['id']
     c = claim_work(conn, 'source', str(source), 180)
     eid = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status,started_at,reconciled_at)
       VALUES(%s,1,%s,%s,%s,clock_timestamp()-make_interval(hours=>%s),CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END) RETURNING id""",
-      (source, c.owner_token, c.generation, 'complete' if completed else 'running', hours, completed, hours)).fetchone()['id']
+      (source, c.owner_token, c.generation, 'running', hours, False, hours)).fetchone()['id']
     conn.commit()
     for start in range(1, members+1, 500):
         conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
         conn.commit()
+    if completed:
+        # Membership is immutable once completion is certified. Seed the same
+        # snapshot in production order: running members, then completion.
+        conn.execute("""UPDATE source_enumerations SET status='complete',
+            completed_at=clock_timestamp()-make_interval(hours=>%s),
+            reconciled_at=clock_timestamp()-make_interval(hours=>%s) WHERE id=%s""",
+            (hours, hours, eid))
     conn.execute("INSERT INTO reconciliation_checkpoints(enumeration_id,generation,reconciled_count,completed_at) VALUES(%s,%s,23,CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END)", (eid, c.generation, completed, hours))
     conn.commit()
     return source, eid, c
 
 
 @requires_db
 @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
 def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
     m = module()
     source, eid, old = enumeration(conn, completed=completed, hours=hours)
diff --git a/tests/test_lifecycle_reconcile.py b/tests/test_lifecycle_reconcile.py
index 9365395..fc716e3 100644
--- a/tests/test_lifecycle_reconcile.py
+++ b/tests/test_lifecycle_reconcile.py
@@ -219,22 +219,22 @@ def test_scheduler_finite_six_cycle_bound_across_families_and_request_budget(con
     assert len(calls)==(14 if budget_kind=='requests' else 12)
 
 
 @requires_db
 def test_failure_disabled_backoff_and_deliberate_exclusion(conn):
     source = setup_source(conn)
     conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
     for days in [1,2,4,7,7]:
         enum = begin(conn,source)
         finish(conn,enum,False)
-        row = conn.execute('SELECT next_due_at-clock_timestamp() delay FROM source_accounts').fetchone()
-        assert timedelta(days=days,seconds=-5) < row['delay'] <= timedelta(days=days)
+        row = conn.execute('SELECT next_due_at,last_attempt_at FROM source_accounts').fetchone()
+        assert row['next_due_at']==row['last_attempt_at'].replace(hour=0,minute=0,second=0,microsecond=0)+timedelta(days=days)
     conn.execute("UPDATE source_accounts SET exclusion_state='deliberate',next_due_at=NULL")
     assert r.claim_due_source(conn) is None
 
 
 @requires_db
 def test_ordinary_poll_calls_full_corpus_path_above_guard_without_users(conn,monkeypatch):
     import os
     from job_discovery import run, http
     source = setup_source(conn)
     monkeypatch.setenv('DATABASE_URL',os.environ['TEST_DATABASE_URL'])
@@ -389,10 +389,177 @@ def test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget(co
         def execute(self,query,params):
             query=query.replace('floor(extract(epoch FROM clock_timestamp())/86400)::bigint','%s::bigint')
             return conn.execute(query,(self.day,*params))
         def commit(self):
             conn.commit()
     for day in range(6):
         r.verify_storage_blocked(FixtureDay(day),max_boards=1,deadline=r.monotonic()+60)
     assert len(calls)==6 and len(set(calls))==6
     assert all(str(row['id']) in caplog.text for row in before)
     assert conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()==before
+
+
+@requires_db
+@pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
+@pytest.mark.parametrize('defect',['missing_title','duplicate'])
+def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
+    from job_discovery import http
+    setup_source(conn,3,ats)
+    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+    conn.commit()
+    good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
+          'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
+    bad=dict(good,id='1')
+    bad.pop('title')
+    bad.pop('text')
+    items=[good,bad if defect=='missing_title' else good]
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
+    r.verify_due_sources(conn,max_boards=1)
+    rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
+    assert rows[0]['successful_sighting_count']==1
+    assert rows[0]['source_availability']=='open'
+    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()['closed_at'] is None
+    assert all(row['consecutive_complete_misses']==0 for row in rows)
+    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status']=='partial'
+
+
+class SourceFixtureClock:
+    """Advance only source scheduling/evidence time, never claim or lease time."""
+    def __init__(self,conn,clock):
+        self.conn,self.clock=conn,clock
+    def __getattr__(self,name):
+        return getattr(self.conn,name)
+    def execute(self,query,params=None):
+        from psycopg import sql
+        # Test-only replacement in precisely the source operations under test.
+        if isinstance(query,str):
+            if ('UPDATE source_accounts SET last_attempt_at=' in query
+                or 'UPDATE source_accounts SET last_outcome=' in query
+                or 'UPDATE source_enumerations SET status=' in query
+                or 'SELECT s.* FROM source_accounts s' in query):
+                literal=sql.Literal(self.clock[0]).as_string(self.conn)+'::timestamptz'
+                query=query.replace('clock_timestamp()',literal)
+        return self.conn.execute(query,params)
+
+
+@requires_db
+@pytest.mark.parametrize('failure_disabled',[False,True])
+def test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration(conn,monkeypatch,failure_disabled):
+    from datetime import UTC,datetime
+    from job_discovery import http
+    setup_source(conn)
+    if failure_disabled:
+        conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
+    conn.commit()
+    slot=datetime(2026,10,1,tzinfo=UTC)
+    clock=[slot]
+    scheduled=SourceFixtureClock(conn,clock)
+    calls=[]
+    def feed(*a,**kw):
+        calls.append(clock[0])
+        clock[0]+=timedelta(seconds=10 if len(calls)==2 else 20)
+        if failure_disabled:
+            raise ValueError('ordinary fixture unavailable source')
+        return []
+    monkeypatch.setattr(http,'get_json',feed)
+    for backoff in ([1,2,4,7] if failure_disabled else [1,1,1,1]):
+        before=len(calls)
+        r.verify_due_sources(scheduled,max_boards=1)
+        assert len(calls)==before+1
+        next_slot=slot+timedelta(days=backoff)
+        row=conn.execute('SELECT next_due_at FROM source_accounts').fetchone()
+        assert row['next_due_at']==next_slot
+        if not failure_disabled and len(calls)==2:
+            assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
+        if not failure_disabled and len(calls)==3:
+            assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is not None
+        conn.commit()
+        slot=next_slot
+        clock[0]=slot
+    # Scheduling slots do not relax the separate 24-hour successful evidence rule.
+
+
+@requires_db
+@pytest.mark.parametrize('interruption',['deadline','after_complete'])
+def test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart(conn,monkeypatch,interruption):
+    import psycopg
+    from psycopg.rows import dict_row
+    from tests.conftest import TEST_DSN
+    from job_discovery import http
+    source=setup_source(conn,205)
+    conn.commit()
+    calls=[]
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:calls.append(1) or [{'id':'extra','text':'Role','hostedUrl':'https://example.test/job'}])
+    clock=[0.0]
+    monkeypatch.setattr(r,'monotonic',lambda:clock[0])
+    actual=r.reconcile_chunk
+    chunks=[]
+    def limited(worker,enum,limit=500):
+        if interruption=='after_complete' and not chunks:
+            chunks.append('interrupted')
+            raise KeyboardInterrupt('ordinary worker interruption after membership completion')
+        done=actual(worker,enum,limit)
+        chunks.append(done)
+        clock[0]+=2
+        return done
+    monkeypatch.setattr(r,'reconcile_chunk',limited)
+    saved=None
+    progress=[]
+    for turn in range(4):
+        with psycopg.connect(TEST_DSN,row_factory=dict_row) as worker:
+            if turn==0 and interruption=='after_complete':
+                with pytest.raises(KeyboardInterrupt):
+                    r.verify_due_sources(worker,max_boards=1,seconds=1)
+            else:
+                r.verify_due_sources(worker,max_boards=1,seconds=1)
+        # Every invocation has discarded its worker and connection; it receives
+        # no in-memory EnumerationRef/checkpoint from the preceding invocation.
+        conn.rollback()
+        enum=conn.execute('SELECT * FROM source_enumerations WHERE source_id=%s',(source['id'],)).fetchone()
+        identity=(enum['id'],enum['sequence'],enum['started_at'],enum['completed_at'])
+        if saved is None:
+            saved=identity
+        assert identity==saved
+        progress.append(conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'])
+        conn.commit()
+        if enum['reconciled_at']:
+            break
+    assert progress==([100,200,205] if interruption=='deadline' else [0,100,200,205])
+    assert len(calls)==1
+    assert conn.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==1
+    assert conn.execute('SELECT min(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
+
+
+@requires_db
+@pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
+def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
+    from job_discovery import http
+    setup_source(conn,3,'workable')
+    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+    conn.commit()
+    good={'shortcode':'0','title':'Role'}
+    bad={'shortcode':'1'} if defect=='missing_title' else (good if defect=='duplicate' else {'title':'No ID'})
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[good,bad]})
+    r.verify_due_sources(conn,max_boards=1)
+    row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+    assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()['closed_at'] is None
+    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status']=='partial'
+    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
+
+
+@requires_db
+@pytest.mark.parametrize('family',['smartrecruiters','workday'])
+def test_fix1_paged_mixed_nonobject_retains_good_positive(conn,monkeypatch,family):
+    from job_discovery import http
+    setup_source(conn,3,family,'fixture:wd5:External' if family=='workday' else 'fixture')
+    if family=='smartrecruiters':
+        payload={'content':[{'id':'0','name':'Role'},None],'totalFound':2}
+    else:
+        payload={'jobPostings':[{'externalPath':'0','title':'Role'},None],'total':2}
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:payload)
+    monkeypatch.setattr(http,'post_json',lambda *a,**kw:payload)
+    r.verify_due_sources(conn,max_boards=1)
+    row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+    assert row['successful_sighting_count']==1 and row['source_availability']=='open'
+    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status'] in {'partial','failed'}
+    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
diff --git a/tests/test_source_completeness.py b/tests/test_source_completeness.py
index 818cc11..4d345ec 100644
--- a/tests/test_source_completeness.py
+++ b/tests/test_source_completeness.py
@@ -8,28 +8,28 @@ def test_null_collection_is_not_empty_source(monkeypatch, module, key):
     monkeypatch.setattr(module, "post_json" if module is workday else "get_json", lambda *a, **k: {key: None})
     fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
     with pytest.raises(ValueError):
         list(fetch("a:wd5:External" if module is workday else "a"))
 
 
 @pytest.mark.parametrize("module,key,id_key", [(greenhouse,"jobs","id"), (ashby,"jobs","id"), (workable,"jobs","shortcode")])
 def test_unidentifiable_entry_cannot_authorize_closure(monkeypatch, module, key, id_key):
     monkeypatch.setattr(module, "get_json", lambda *a: {key: [{id_key: None, "title": "A", "absolute_url": "u"}]})
     fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
-    with pytest.raises(ValueError):
-        fetch("a")
+    result=fetch("a")
+    assert list(result)==[] and not result.complete
 
 
 def test_greenhouse_reported_total_cannot_exceed_collection(monkeypatch):
     monkeypatch.setattr(greenhouse, "get_json", lambda *a: {"jobs": [], "meta": {"total": 7}})
-    with pytest.raises(ValueError):
-        greenhouse.fetch_greenhouse("a")
+    result=greenhouse.fetch_greenhouse("a")
+    assert list(result)==[] and not result.complete
 
 
 @pytest.mark.parametrize('name', ['greenhouse','lever','ashby','workable','smartrecruiters','workday'])
 def test_every_family_requires_exhaustion_for_empty_success(monkeypatch,name):
     from job_discovery import http
     from job_discovery.adapters import ADAPTERS
     from job_discovery.adapters.completeness import SourceResult
     bodies={'greenhouse':{'jobs':[]},'lever':[],'ashby':{'jobs':[]},
             'workable':{'jobs':[]},'smartrecruiters':{'content':[],'totalFound':0},
             'workday':{'jobPostings':[],'total':0}}
@@ -39,22 +39,23 @@ def test_every_family_requires_exhaustion_for_empty_success(monkeypatch,name):
     assert isinstance(result,SourceResult) and not result.complete
     assert list(result)==[] and result.complete
 
 
 @pytest.mark.parametrize('name,key,id_key', [('greenhouse','jobs','id'),('lever',None,'id'),('ashby','jobs','id'),('workable','jobs','shortcode')])
 def test_single_response_duplicate_identity_never_complete(monkeypatch,name,key,id_key):
     from job_discovery import http
     from job_discovery.adapters import ADAPTERS
     items=[{id_key:'same'},{id_key:'same'}]
     monkeypatch.setattr(http,'get_json',lambda *a,**kw:{key:items} if key else items)
-    with pytest.raises(ValueError,match='duplicate'):
-        list(ADAPTERS[name]('fixture'))
+    result=ADAPTERS[name]('fixture')
+    assert [p.external_id for p in result]==['same']
+    assert not result.complete
 
 
 @pytest.mark.parametrize('family',['smartrecruiters','workday'])
 def test_final_page_failure_preserves_yielded_positive_but_never_completes(monkeypatch,family):
     from job_discovery import http
     from job_discovery.adapters import ADAPTERS
     module=smartrecruiters if family=='smartrecruiters' else workday
     monkeypatch.setattr(module,'_PAGE_LIMIT',1)
     calls=[]
     def page(*a,**kw):
diff --git a/tests/test_workable.py b/tests/test_workable.py
index 382b71c..c0e0ee5 100644
--- a/tests/test_workable.py
+++ b/tests/test_workable.py
@@ -97,20 +97,21 @@ def test_fetch_rejects_entries_without_a_shortcode(monkeypatch):
     payload = {"jobs": [
         {"title": "No Shortcode", "telecommuting": True},  # no shortcode -> dropped
         {"shortcode": "OK", "title": "OK", "telecommuting": False,
          "city": "NYC", "department": "Eng", "description": "<p>x</p>"},
     ]}
 
     def fake_get_json(url):
         return payload
 
     monkeypatch.setattr(workable, "get_json", fake_get_json)
-    with pytest.raises(ValueError, match="shortcode"):
-        fetch_workable("acme")
+    result=fetch_workable("acme")
+    assert [p.external_id for p in result]==["OK"]
+    assert not result.complete
 
 
 # ── A3: missing top-level key ─────────────────────────────────────────────────
 
 def test_missing_jobs_key_raises(monkeypatch):
     monkeypatch.setattr(workable, "get_json", lambda url: {"error": "gone"})
     with pytest.raises(ValueError, match="missing 'jobs'"):
         fetch_workable("acme")
