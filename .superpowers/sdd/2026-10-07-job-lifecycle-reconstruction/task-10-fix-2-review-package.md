# Full pinned review package

BASE: 095fec89132bec361c6b1733d1fd97ff5018a6ed

HEAD: 51d1000e6954b3e7bff56652718c8d90084b216a

## Commits

51d1000e6954b3e7bff56652718c8d90084b216a Document Task10 Fix2 processing escrow and caller verification
872a9844f59d3ed4db483ff13fe40c0e02bff09b Reserve archive processing room and continue deferred daily work
ae0b73fa69db4d4eab85d099f7169448f724f81e Record Task10 scoped Fix1 review and complete Fix2 handoff


## Files

 .../CHECKPOINTS.md                                 |     6 +
 .../CURRENT.md                                     |     8 +
 .../controller-resume.md                           |     8 +
 .../progress.md                                    |     8 +
 .../task-10-evidence/fix2/candidate-selection.json |    26 +
 .../task-10-evidence/fix2/candidate-selection.txt  |    65 +
 .../fix2/candidate-source-files.sha256             |    12 +
 .../task-10-evidence/fix2/candidate16.command.txt  |     1 +
 .../task-10-evidence/fix2/candidate16.exit.txt     |     1 +
 .../task-10-evidence/fix2/candidate16.txt          |     5 +
 .../task-10-evidence/fix2/candidate17.command.txt  |     1 +
 .../task-10-evidence/fix2/candidate17.exit.txt     |     1 +
 .../task-10-evidence/fix2/candidate17.txt          |     5 +
 .../task-10-evidence/fix2/commands.md              |    17 +
 .../task-10-evidence/fix2/development17.txt        |     3 +
 .../task-10-evidence/fix2/development17b.txt       |     3 +
 .../task-10-evidence/fix2/final16.command.txt      |     1 +
 .../task-10-evidence/fix2/final16.exit.txt         |     1 +
 .../task-10-evidence/fix2/final16.txt              |     7 +
 .../task-10-evidence/fix2/final17.command.txt      |     1 +
 .../task-10-evidence/fix2/final17.exit.txt         |     1 +
 .../task-10-evidence/fix2/final17.txt              |     7 +
 .../task-10-evidence/fix2/format-final.txt         |     1 +
 .../task-10-evidence/fix2/format.txt               |     1 +
 .../task-10-evidence/fix2/image-pins.txt           |     2 +
 .../task-10-evidence/fix2/inventory.md             |    13 +
 .../task-10-evidence/fix2/lint-development.txt     |     1 +
 .../task-10-evidence/fix2/lint-final.txt           |     1 +
 .../task-10-evidence/fix2/migration-parity.txt     |     1 +
 .../task-10-evidence/fix2/receipt-red17.txt        |    94 +
 .../task-10-evidence/fix2/red-seed17.txt           |   119 +
 .../task-10-evidence/fix2/red17.txt                |   298 +
 .../task-10-evidence/fix2/selection.json           |    12 +
 .../task-10-evidence/fix2/selection.txt            |    39 +
 .../task-10-evidence/fix2/source-commit.txt        |     1 +
 .../task-10-evidence/fix2/source-files.sha256      |    12 +
 .../task-10-evidence/fix2/versions.json            |     6 +
 .../task-10-fix-1-review-package.md                | 10613 +++++++++++++++++++
 .../task-10-fix1-requirements-review.md            |   115 +
 .../task-10-fix1-reviewer-dispatch.md              |     9 +
 .../task-10-fix2-dispatch.md                       |    13 +
 .../task-10-fix2-report.md                         |   101 +
 .../task-10-report.md                              |     9 +
 job_discovery/archive/batches.py                   |    56 +-
 job_discovery/archive/outbox.py                    |     6 +-
 job_discovery/lifecycle/operational.py             |    10 +-
 job_discovery/location_backfill.py                 |    15 +-
 job_discovery/locations.py                         |   152 +-
 job_discovery/run.py                               |   231 +-
 migrations/2026-10-03-06-public-outbox-fix2.sql    |    86 +
 schema.sql                                         |    87 +
 tests/test_archive_fix1.py                         |    25 +-
 tests/test_archive_fix2.py                         |   378 +
 tests/test_archive_outbox.py                       |     1 +
 tests/test_locations_resolution.py                 |    79 +-
 55 files changed, 12641 insertions(+), 134 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
index 2349e49..1977bc6 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
@@ -93,10 +93,16 @@ Task8 availability limit remains: genuine generated legacy artifacts with unknow
 Accepted checkpoint08 CONFIRMED Library libfile_2567d781e730819194ac1dac76140fcc / file_00000000456881f590fdf2d0d6c11100 v0, xattrs sameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-08.bundle verified completehistory09efd561c37a678ebae884db7bea20452f813a35; includesTask8source/allphases/scopedfinalPASS/evidence/limits. This is permitted review acceptance, NOTsecurity/activation/fullreleaseapproval. FreshTask9 next immediately after this forward-ID ledgercommit. Preserve all prior accepted stages/conditional6/explicit availability/securitygaps.
 
 Task9 actual tool incident: exec_command rejected CreateProcess with exec-server transport disconnected. SAME author normal pwd retry recovered immediately; rootordinarycommands healthy; no executor replacement/reinitialization/acceptedstage restart, no security/modelcapacity confusion. Current authorreported165selectedTSGREEN +2newactualHTTPdetailparser/historyopenGREEN(15deselected) +8reviewercandidates/30deselected ownedPG17; finalbrowser/typecheck/nondb dashboard selection/DB16/report remainpending. Rootnotclaimingfinalmatrix.
 Unaccepted Task9 recovery snapshot CONFIRMED Library libfile_72177da69a0c8191b33a590ff2873bab / file_00000000632881f88efd77dd23582ade v0,xattrs sameexec. /workspace/scratch/job-board-task09-unaccepted-recovery.tar.gz 17,599,904bytes/34members: verifiedfullhistory5a319253169cd03e1821e7c3d02df82249e6ce8b, unfinishedtrackedHEADpatch,4newownedsource/tests/migrationpaths, sanitizedcopiedcurrentTask9logs andSTATUS. Snapshot takenwhileauthoractive NOTatomic/accepted; somecopieddashboard-full/tsc2logs stillinprogress, originals/tmp retained and finalseparatefilenamesexpected. Excludesenv/deps/credentials/liveDBdump. LatestACCEPTED08 remainslibfile_2567d781e730819194ac1dac76140fcc. ExecutioncontinuesTask9sameagent/env; no guard/prod/reviewgapchange. RootnoGitstagewhileauthoractive.
 
 Reviewed-UNACCEPTED Task9 complete-history bundle CONFIRMED Library libfile_54f0e25258ac8191a455d47def475737 / file_000000001cb4820caf2bde591ab94686 v0, xattrs SAMEexec. /workspace/scratch/job-board-lifecycle-recovery-task09-reviewed-unaccepted.bundle verified allhistory25e4a2ece862816299dd0bdc5c6b2666f48e6e5b; includes initialTask9source/report/final evidence/browser/runbook/full freshFAILreport/controllerCURRENT. Excludes uncommittedFix1/currentrootledger; NOTaccepted09. Latest accepted08libfile_2567d781e730819194ac1dac76140fcc unchanged. SameFix1authoractive; no executor recovery/capacity/security retry. Root ledger append initially failed Python quoting before any edit, corrected normally.
 
 Task9 complete (BASE5a319253..source6bd1099b/reportfd0422fb; original+scoped permitted requirements/code-quality approved). Same reviewer Fix1 SpecPASS/QualityAPPROVED; FULL report root read, R9-1/R9-2 ADDRESSED/no new Important/Critical, Funnel and actual React checklist addressed. Root read actual logs/screenshots/pins; exact wholephase evidence and failures retained. Task13 owned/default lane+3fixtures+2PDFskips, dynamic public/mutation query cost unmeasured, Task8 unknown-input recapture unimplemented, R6-4 mandatory10/13, omitted Task3 security review gaps remain. No production/activation/security approval. Accepted09 fullhistory Library checkpoint next, then fresh10 immediately.
 
 Checkpoint09 CONFIRMED Librarylibfile_6843e0ce183c8191a275f204e747c78d /file_000000003638821090268ef9b20fce0a v0/xattrs SAMEexec; verified completehistory4785080388b945e8408a3fedb0b4eb86e89a03be /workspace/scratch/job-board-lifecycle-recovery-checkpoint-09.bundle. Accepted permitted review, no security/fullrelease claim. Next freshsoleTask10 Astra/high forkNONE actualforwardBASE; minimal R6-4 operational contract report REQUIRED before anyguardchange.
+
+Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
+
+## Task10 Fix1 source/evidence recovery — 2026-10-07 22:28 UTC
+
+Repeated environment-disconnect notifications were followed by successful command access in the SAME worktree; SAME author resumed unfinished report handoff. Source HEAD01408f0fce8743a98a55726cc9da50f808955443; final66/66 PG17.11/16.15 and Ruff evidence preserved. Complete-history verified Git bundle: Library libfile_64fa98d06e008191957b705dfe9a82c0, file_0000000038ec820d91c7c78bf075fc96 v0. Separate sanitized Fix1 evidence ZIP: Library libfile_d0e4b384a2148191952bb0e1ef4dc81e, file_00000000522882309fc214b3582ba680 v0. Xattrs applied after confirmed uploads. Both UNACCEPTED: report/evidence final commit and SAME scoped independent review remain pending. Evidence copy taken while author prepared report; not claimed an atomic final checkpoint. No duplicate writer, source edits, test reruns, production writes or deployment.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
index 7da3eef..9c87fb4 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
@@ -46,10 +46,18 @@ Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evi
 
 Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
 
 Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
 
 Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
 
 Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
 
 Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+
+Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
+
+Task10 SAMEauthorFix1 confirmedexecutorusable/full7findings+dispatch/spec8READ/no currentboundaryblocker. Scoped7newcaseRED underway; SourceListingcountersauthoritative/opsequencecursoronly, sharedStorageBlockedoutcome, currentpublicwritersboundedtransactionadapter; additiveFix1migrationnewlogicalforecast/separateobserved-recorded/serviceownedtestprefix+exactmanifest/compactmarkersfullterminalcataloguecleanup. No productionconfig/calls/oldphysicalmechanismprobes. All7 ONEpass, no replacement/duplicatestage. RootdocsunstagedwhileauthorGitactive; same-scopedreviewafterDONE.
+
+Task10 SAME author Fix1 DONE/STOP22:28 UTC: source01408f0fce8743a98a55726cc9da50f808955443; full report/evidence095fec89132bec361c6b1733d1fd97ff5018a6ed. Root read FULL Fix1 report and actual final evidence: one66-case selection EACH PG17.11/16.15, Ruffpass; no source delta/retests during handoff. Complete FixBASEe3f889421fa1ad30206e128cb292b101bc3a58e0..095fec89132bec361c6b1733d1fd97ff5018a6ed package generated. SAME original /root/recovery_task10_requirements_review resumed ONE scoped R10-1..7 plus fix-introduced Important/Critical only, no whole-task rerun/covered tests/omitted probes. Latest accepted09 unchanged; Task10 acceptance pending verdict. Repeated disconnect notices followed by normal command access, SAME author resumed report; no duplicate writer/reimplementation/blocker. Additional UNACCEPTED source/evidence recovery Library64fa98d0/d0e4b384 recorded CHECKPOINTS. All11–13/finalreview/authorized completed release remain.
+
+Task10: fix round1/5 (R10-1/5/6/7 closed; R10-2 partial and R10-3/4 caller residuals; FixBASEe3f8894..095fec8). FULL scoped review rootREAD SpecFAIL/QualityCHANGES_REQUIRED, THREEImportant/noCritical: F1-1ordinary membership/seal consumes critical reserve and no guaranteed logical processingroom; F1-2actual location caller executes onlyone100-rowchunk; F1-3newpairedseedpressure aborts actualdailyrun before sourceverification, firstfailedchunk also rollsbackrunrow. SAMEreviewerDONE/STOP; no tests/probes/sourcechanges. ONEcomplete Fix2 SAMEauthor forFULL3findings+review narrowordinaryevidence; actualpreviousreviewedFixBASE095fec89132bec361c6b1733d1fd97ff5018a6ed/source01408f0. No acceptance10/Task11/release yet; all13/completedauthorizedrelease remains active.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
index aa94b37..2d38412 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
@@ -304,10 +304,18 @@ Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evi
 
 Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
 
 Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
 
 Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
 
 Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
 
 Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+
+Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
+
+Task10 SAMEauthorFix1 confirmedexecutorusable/full7findings+dispatch/spec8READ/no currentboundaryblocker. Scoped7newcaseRED underway; SourceListingcountersauthoritative/opsequencecursoronly, sharedStorageBlockedoutcome, currentpublicwritersboundedtransactionadapter; additiveFix1migrationnewlogicalforecast/separateobserved-recorded/serviceownedtestprefix+exactmanifest/compactmarkersfullterminalcataloguecleanup. No productionconfig/calls/oldphysicalmechanismprobes. All7 ONEpass, no replacement/duplicatestage. RootdocsunstagedwhileauthorGitactive; same-scopedreviewafterDONE.
+
+Task10 SAME author Fix1 DONE/STOP22:28 UTC: source01408f0fce8743a98a55726cc9da50f808955443; full report/evidence095fec89132bec361c6b1733d1fd97ff5018a6ed. Root read FULL Fix1 report and actual final evidence: one66-case selection EACH PG17.11/16.15, Ruffpass; no source delta/retests during handoff. Complete FixBASEe3f889421fa1ad30206e128cb292b101bc3a58e0..095fec89132bec361c6b1733d1fd97ff5018a6ed package generated. SAME original /root/recovery_task10_requirements_review resumed ONE scoped R10-1..7 plus fix-introduced Important/Critical only, no whole-task rerun/covered tests/omitted probes. Latest accepted09 unchanged; Task10 acceptance pending verdict. Repeated disconnect notices followed by normal command access, SAME author resumed report; no duplicate writer/reimplementation/blocker. Additional UNACCEPTED source/evidence recovery Library64fa98d0/d0e4b384 recorded CHECKPOINTS. All11–13/finalreview/authorized completed release remain.
+
+Task10: fix round1/5 (R10-1/5/6/7 closed; R10-2 partial and R10-3/4 caller residuals; FixBASEe3f8894..095fec8). FULL scoped review rootREAD SpecFAIL/QualityCHANGES_REQUIRED, THREEImportant/noCritical: F1-1ordinary membership/seal consumes critical reserve and no guaranteed logical processingroom; F1-2actual location caller executes onlyone100-rowchunk; F1-3newpairedseedpressure aborts actualdailyrun before sourceverification, firstfailedchunk also rollsbackrunrow. SAMEreviewerDONE/STOP; no tests/probes/sourcechanges. ONEcomplete Fix2 SAMEauthor forFULL3findings+review narrowordinaryevidence; actualpreviousreviewedFixBASE095fec89132bec361c6b1733d1fd97ff5018a6ed/source01408f0. No acceptance10/Task11/release yet; all13/completedauthorizedrelease remains active.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index 1fb8121..0d4dac9 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -358,10 +358,18 @@ Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evi
 
 Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
 
 Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
 
 Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
 
 Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
 
 Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+
+Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
+
+Task10 SAMEauthorFix1 confirmedexecutorusable/full7findings+dispatch/spec8READ/no currentboundaryblocker. Scoped7newcaseRED underway; SourceListingcountersauthoritative/opsequencecursoronly, sharedStorageBlockedoutcome, currentpublicwritersboundedtransactionadapter; additiveFix1migrationnewlogicalforecast/separateobserved-recorded/serviceownedtestprefix+exactmanifest/compactmarkersfullterminalcataloguecleanup. No productionconfig/calls/oldphysicalmechanismprobes. All7 ONEpass, no replacement/duplicatestage. RootdocsunstagedwhileauthorGitactive; same-scopedreviewafterDONE.
+
+Task10 SAME author Fix1 DONE/STOP22:28 UTC: source01408f0fce8743a98a55726cc9da50f808955443; full report/evidence095fec89132bec361c6b1733d1fd97ff5018a6ed. Root read FULL Fix1 report and actual final evidence: one66-case selection EACH PG17.11/16.15, Ruffpass; no source delta/retests during handoff. Complete FixBASEe3f889421fa1ad30206e128cb292b101bc3a58e0..095fec89132bec361c6b1733d1fd97ff5018a6ed package generated. SAME original /root/recovery_task10_requirements_review resumed ONE scoped R10-1..7 plus fix-introduced Important/Critical only, no whole-task rerun/covered tests/omitted probes. Latest accepted09 unchanged; Task10 acceptance pending verdict. Repeated disconnect notices followed by normal command access, SAME author resumed report; no duplicate writer/reimplementation/blocker. Additional UNACCEPTED source/evidence recovery Library64fa98d0/d0e4b384 recorded CHECKPOINTS. All11–13/finalreview/authorized completed release remain.
+
+Task10: fix round1/5 (R10-1/5/6/7 closed; R10-2 partial and R10-3/4 caller residuals; FixBASEe3f8894..095fec8). FULL scoped review rootREAD SpecFAIL/QualityCHANGES_REQUIRED, THREEImportant/noCritical: F1-1ordinary membership/seal consumes critical reserve and no guaranteed logical processingroom; F1-2actual location caller executes onlyone100-rowchunk; F1-3newpairedseedpressure aborts actualdailyrun before sourceverification, firstfailedchunk also rollsbackrunrow. SAMEreviewerDONE/STOP; no tests/probes/sourcechanges. ONEcomplete Fix2 SAMEauthor forFULL3findings+review narrowordinaryevidence; actualpreviousreviewedFixBASE095fec89132bec361c6b1733d1fd97ff5018a6ed/source01408f0. No acceptance10/Task11/release yet; all13/completedauthorizedrelease remains active.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.json
new file mode 100644
index 0000000..6138e04
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.json
@@ -0,0 +1,26 @@
+[
+  "tests/test_archive_fix2.py",
+  "tests/test_archive_codec.py",
+  "tests/test_archive_outbox.py",
+  "tests/test_archive_batches.py",
+  "tests/test_locations_resolution.py",
+  "tests/test_run.py::test_run_isolates_failures_and_records",
+  "tests/test_db_runs.py::test_start_then_finish_run",
+  "tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack",
+  "tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically",
+  "tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast",
+  "tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair",
+  "tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time",
+  "tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest",
+  "tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue",
+  "tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers",
+  "tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off",
+  "tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated",
+  "tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate",
+  "tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch",
+  "tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal",
+  "tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer",
+  "tests/test_archive_fix1.py::test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress",
+  "tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation",
+  "tests/test_archive_fix1.py::test_fix1_key_day_is_utc_even_for_an_offset_ref"
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.txt
new file mode 100644
index 0000000..fa0856a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-selection.txt
@@ -0,0 +1,65 @@
+tests/test_archive_fix2.py::test_processing_room_is_committed_before_claim_or_seal
+tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[False]
+tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[True]
+tests/test_archive_fix2.py::test_later_stamp_failure_preserves_progress_and_reports_incomplete
+tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[1]
+tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[2]
+tests/test_archive_fix2.py::test_scaled_ordinary_and_critical_boundaries_keep_exact_drain_room
+tests/test_archive_fix2.py::test_default_selection_shrinks_to_manifest_workspace_and_drains
+tests/test_archive_fix2.py::test_large_valid_event_and_unicode_receipts_fit_singleton_escrow
+tests/test_archive_fix2.py::test_active_location_pass_stamps_all_rows_without_cache_events
+tests/test_archive_codec.py::test_canonical_utf8_sorted_jsonl_and_zero_time_gzip
+tests/test_archive_codec.py::test_total_public_schema_rejects_private_or_oversize_data
+tests/test_archive_codec.py::test_schema_enforces_complete_relation_endpoints_and_version_identity
+tests/test_archive_codec.py::test_body_is_bounded_and_gzip_single_event_boundary
+tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
+tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
+tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
+tests/test_archive_outbox.py::test_budget_boundaries_and_critical_reserve
+tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+tests/test_archive_outbox.py::test_listing_watermark_does_not_certify_unknown_version
+tests/test_archive_outbox.py::test_migration_reapplication_preserves_flags_and_existing_events
+tests/test_archive_outbox.py::test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup
+tests/test_archive_batches.py::test_batch_limits_are_bounded
+tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
+tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
+tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+tests/test_archive_batches.py::test_later_lower_sequence_commit_remains_pending
+tests/test_archive_batches.py::test_seven_day_terminal_compaction_preserves_exact_markers
+tests/test_archive_batches.py::test_batch_claim_excludes_own_uncommitted_public_events
+tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps
+tests/test_locations_resolution.py::test_multi_location_stamps_array
+tests/test_locations_resolution.py::test_llm_pass_validates_against_gazetteer
+tests/test_locations_resolution.py::test_llm_empty_answer_becomes_unmappable
+tests/test_locations_resolution.py::test_llm_failure_leaves_raw_unmapped_and_does_not_raise
+tests/test_locations_resolution.py::test_unanswered_index_left_unmapped
+tests/test_locations_resolution.py::test_manual_correction_propagates_on_restamp
+tests/test_locations_resolution.py::test_llm_all_hallucinations_become_unmappable
+tests/test_locations_resolution.py::test_multi_batch_llm_pass
+tests/test_locations_resolution.py::test_already_mapped_raws_not_reprocessed
+tests/test_run.py::test_run_isolates_failures_and_records
+tests/test_db_runs.py::test_start_then_finish_run
+tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
+tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically
+tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
+tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair
+tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time
+tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest
+tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue
+tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
+tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off
+tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated
+tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate
+tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch
+tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal
+tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer
+tests/test_archive_fix1.py::test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress
+tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation[seed]
+tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation[enrichment]
+tests/test_archive_fix1.py::test_fix1_key_day_is_utc_even_for_an_offset_ref
+
+63 tests collected in 0.59s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-source-files.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-source-files.sha256
new file mode 100644
index 0000000..1e7b907
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate-source-files.sha256
@@ -0,0 +1,12 @@
+9923e28b16731e3cedd35f9e93d5126bb3ab014ad9bafb29bc38d22b6572f354  job_discovery/archive/batches.py
+e363416ff798a6e22ef86ea86100661ed67a5eac3b4cb9dc57cfa025e1fdb401  job_discovery/archive/outbox.py
+2247c3b38e731da2b8c98237a3632fad3978788c3ac5ff4e544f4cdd99263fa3  job_discovery/lifecycle/operational.py
+f37e5e27ee9e789253d16f850d669b224b4390e33d328254350b0e86def0a27c  job_discovery/locations.py
+cdbdd802e8e37e1712d0119523d56fde53d7117a4dc592614b65a696c8b1e498  job_discovery/location_backfill.py
+2d985312c790f2942ef02712e7fe4a93b07414c04ad7a335d083f74fe21ffa1e  job_discovery/run.py
+a99263a1c1e06fa372eed65c36add7f140922276a26defafb4453bc1152bbf33  migrations/2026-10-03-06-public-outbox-fix2.sql
+f6c3f0460c739ae4958e8977d959e7029f86d52a3cd28ecfed5a6c9079ae1274  schema.sql
+3195b7302d16e2c5af575f83b1ecc38147d52005e386c66c61bf4aad69c9c70c  tests/test_archive_fix2.py
+fd247d711fbc9a2490570a35645e4d292b6b05cd5f35dd18d31bca42b7639eef  tests/test_archive_fix1.py
+c78e3046370e21219503b3727b014235412b089474c6ef5eda5285a9e120b9a7  tests/test_archive_outbox.py
+6823e9a0e9619dcc5f4b2dd07950605357b7d72e404de3b2d1ab2459ceb7580c  tests/test_locations_resolution.py
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.command.txt
new file mode 100644
index 0000000..007e9a3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.command.txt
@@ -0,0 +1 @@
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_fix2.py tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_locations_resolution.py tests/test_run.py::test_run_isolates_failures_and_records tests/test_db_runs.py::test_start_then_finish_run tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer tests/test_archive_fix1.py::test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation tests/test_archive_fix1.py::test_fix1_key_day_is_utc_even_for_an_offset_ref -q -s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.exit.txt
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.exit.txt
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.txt
new file mode 100644
index 0000000..6e8f087
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate16.txt
@@ -0,0 +1,5 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+logical escrow sample {"body_bytes": 65, "canonical_bytes": 422, "escrow": 97764, "ordinary_event_cost": 102964, "critical_slot_cost": 100786, "ordinary_byte_capacity": 1140, "critical_reserved_capacity": 166}
+........logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 145722, "ordinary_event_cost": 198880, "critical_slot_cost": 180716, "ordinary_byte_capacity": 590, "critical_reserved_capacity": 92}
+.......................................................
+63 passed in 110.64s (0:01:50)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.command.txt
new file mode 100644
index 0000000..c727d0b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.command.txt
@@ -0,0 +1 @@
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix2.py tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_locations_resolution.py tests/test_run.py::test_run_isolates_failures_and_records tests/test_db_runs.py::test_start_then_finish_run tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer tests/test_archive_fix1.py::test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation tests/test_archive_fix1.py::test_fix1_key_day_is_utc_even_for_an_offset_ref -q -s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.exit.txt
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.exit.txt
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.txt
new file mode 100644
index 0000000..169fedf
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/candidate17.txt
@@ -0,0 +1,5 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+logical escrow sample {"body_bytes": 65, "canonical_bytes": 422, "escrow": 97764, "ordinary_event_cost": 102964, "critical_slot_cost": 100786, "ordinary_byte_capacity": 1140, "critical_reserved_capacity": 166}
+........logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 145722, "ordinary_event_cost": 198880, "critical_slot_cost": 180716, "ordinary_byte_capacity": 590, "critical_reserved_capacity": 92}
+.......................................................
+63 passed in 102.57s (0:01:42)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/commands.md
new file mode 100644
index 0000000..da817a5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/commands.md
@@ -0,0 +1,17 @@
+# Fix2 actual command chronology
+
+All shell tools used `/bin/bash`, `login:false`, cwd `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. No subagents/helpers or independent reviews were launched. Source base is reviewed01408f0/report095fec8, preserving controller ae0b73f and later controller documents unstaged.
+
+1. Wrote/inventoried six new regression cases before implementation. Ran `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix2.py -q`, output `red17.txt`:6 failed. Four failures reproduced logical workspace/location defects; two daily fixture failures were setup errors because `conn.info.dsn` omits the disposable harness password. No credential was printed or guessed.
+2. Corrected only the two daily fixtures to use the harness-provided validated TEST_DSN, then ran `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification -q`, output `red-seed17.txt`:2 failed with the intended uncaught ArchiveBlocked at first/later seed chunks. This is local fixture setup correction, not a production auth/approval bypass.
+3. Implemented all three corrections. Same six-case full-file command yielded `development17.txt`:6 passed. This phase does not include later extended cases.
+4. Added/inventoried scaled logical ordinary/critical drain, conservative manifest chunk selection and valid Unicode event/receipts. Ran `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix2.py tests/test_locations_resolution.py -q`, output `development17b.txt`:19 passed (nine new cases and10 existing offline location cases).
+5. Added/inventoried active101-row dictionary-only event fixture, final sample arithmetic and selected affected regressions. Ruff format/check affected files (`format.txt`, `lint-final.txt`). Collected the exact `selection.json` argv with `--collect-only -q`:63 cases in `selection.txt`. `git diff --check` passed with no output. Migration parity04/05/06 and the12 source/test SHA256s were recorded before final execution.
+6. Initial63-case candidate17 and16 commands are reproduced verbatim in `candidate17.command.txt` and `candidate16.command.txt` (originally named final before the later bound correction); each ran through the owned lifecycle harness from cached images on independently allocated random loopback ports. A Python subprocess wrapper saved stdout/stderr to the corresponding `final*.txt` and numeric status to `final*.exit.txt`, without changing arguments. Both majors used exactly the same candidate source and63-case selection. Later steps distinguish the final affected verification from this candidate phase.
+
+No broad pytest, shared55432, omitted physical-capacity/expiry/cross-user/security/activation/adversarial suite or renamed substitute was run. Scaled limits in one test lower only the new Python logical-budget ceilings; the SQL ceilings and established physical reservation interfaces are unchanged. No real feed/provider/LLM/archive transport ran. Samples are ordinary small fixtures, not physical load or production throughput measurements.
+
+7. Both initial63-case runs passed:17.11 in102.57s and16.15 in110.64s. They are retained as `candidate17.*`/`candidate16.*`, with their original `candidate-selection.*` and `candidate-source-files.sha256`. A subsequent source-level bound check found valid JSON-escaped receipts could exceed65,536 logical ack bytes. Added the existing receipt fixture's `json-escaped` parameter and ran only its two cases on owned17: `receipt-red17.txt` reports1 passed/1 failed. Actual serialized receipt bytes were25,130; `2*25,130+16,384=66,644` exceeded the old65,536 allowance. The failure is a new ordinary serialization bound, not an excluded mechanism probe.
+8. Increased logical ack workspace to98,304 and per-event escrow to6*C+128,000. Physical reservation calls did not change. Final format/lint and migration parity passed. Re-pinned12 final source/test hashes and collected the meaningful affected37-case selection. Final37 includes all11 Fix2 cases,10 outbox,9 batch,2 critical operational and5 relevant Fix1 budget/manifest/critical/retirement cases. Both final commands use that exact selection. Unchanged location/legacy caller cases retain the passed candidate evidence; no false claim of a single final64-case run is made. Across candidate and affected-final selections there are64 unique supported cases per major, with overlaps not counted twice.
+
+9. Final37 results:17.11 passed37 in52.06s;16.15 passed37 in58.49s, exits0/no skips. All12 final hashes still matched before forward source commit872a9844f59d3ed4db483ff13fe40c0e02bff09b. Final report/evidence prepared afterward with no product edits or duplicated tests. Only owned source/test files were staged for that commit; controller documents remained unstaged.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17.txt
new file mode 100644
index 0000000..8354eb3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......                                                                   [100%]
+6 passed in 30.46s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17b.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17b.txt
new file mode 100644
index 0000000..d6244b0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/development17b.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...................                                                      [100%]
+19 passed in 41.34s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.command.txt
new file mode 100644
index 0000000..858228a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.command.txt
@@ -0,0 +1 @@
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_fix2.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated -q -s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.exit.txt
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.exit.txt
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.txt
new file mode 100644
index 0000000..88ee646
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final16.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+logical escrow sample {"body_bytes": 65, "canonical_bytes": 422, "escrow": 130532, "ordinary_event_cost": 135732, "critical_slot_cost": 133554, "ordinary_byte_capacity": 865, "critical_reserved_capacity": 125}
+........logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 178490, "ordinary_event_cost": 231648, "critical_slot_cost": 213484, "ordinary_byte_capacity": 506, "critical_reserved_capacity": 78}
+.logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 178490, "ordinary_event_cost": 231648, "critical_slot_cost": 213484, "ordinary_byte_capacity": 506, "critical_reserved_capacity": 78}
+.........................actual critical closure costs [{"aggregate_type": "jobs", "body_bytes": 217, "canonical_bytes": 601, "escrow": 131606, "lifecycle_bytes": 135290}, {"aggregate_type": "source_listings", "body_bytes": 575, "canonical_bytes": 981, "escrow": 133886, "lifecycle_bytes": 139046}]
+...
+37 passed in 58.49s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.command.txt
new file mode 100644
index 0000000..d320091
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.command.txt
@@ -0,0 +1 @@
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix2.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated -q -s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.exit.txt
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.exit.txt
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.txt
new file mode 100644
index 0000000..d33abda
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/final17.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+logical escrow sample {"body_bytes": 65, "canonical_bytes": 422, "escrow": 130532, "ordinary_event_cost": 135732, "critical_slot_cost": 133554, "ordinary_byte_capacity": 865, "critical_reserved_capacity": 125}
+........logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 178490, "ordinary_event_cost": 231648, "critical_slot_cost": 213484, "ordinary_byte_capacity": 506, "critical_reserved_capacity": 78}
+.logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 178490, "ordinary_event_cost": 231648, "critical_slot_cost": 213484, "ordinary_byte_capacity": 506, "critical_reserved_capacity": 78}
+.........................actual critical closure costs [{"aggregate_type": "jobs", "body_bytes": 217, "canonical_bytes": 601, "escrow": 131606, "lifecycle_bytes": 135290}, {"aggregate_type": "source_listings", "body_bytes": 572, "canonical_bytes": 978, "escrow": 133868, "lifecycle_bytes": 139016}]
+...
+37 passed in 52.06s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format-final.txt
new file mode 100644
index 0000000..50ecf59
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format-final.txt
@@ -0,0 +1 @@
+2 files reformatted, 1 file left unchanged
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format.txt
new file mode 100644
index 0000000..597a698
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/format.txt
@@ -0,0 +1 @@
+8 files reformatted, 2 files left unchanged
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/image-pins.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/image-pins.txt
new file mode 100644
index 0000000..7279923
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/image-pins.txt
@@ -0,0 +1,2 @@
+postgres:17 sha256:327daa8fae7178d61f93142f146b098467b345e10997b9eb79f63bd58e5c8f3c ["postgres@sha256:ae69c452f483507a6b99fb654cf93aad7fe156ffd2c56247707eef4e36d3c12b"]
+postgres:16 sha256:275447c94b11b151decd1f29877965301d5a77032037c46de93d990f739f00a9 ["postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65"]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/inventory.md
new file mode 100644
index 0000000..606f520
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/inventory.md
@@ -0,0 +1,13 @@
+Before RED execution: tests/test_archive_fix2.py only, six ordinary cases. Logical processing-room reservation before claim/seal, actual location resolver initial/correction passes over101jobs, later-stamp archive exception with committed progress/resume, actual daily run seed deferral at first/later chunks with durable run row/existing offline-feed verification. PG17 owned random loopback only. No physical-pressure, expiry, cross-user, activation/security or adversarial mechanisms are selected or substituted. Provider calls are stubbed/offline; same code writes paired public records in small owned fixtures. Skill broad-suite guidance is superseded by explicit binding permitted-test scope.
+
+Before extended execution: add one small scaled logical-boundary fixture (actual ordinary mutation/pair at its scaled Python admission ceiling, materialize ordinary claim/seal without spending critical allowance, admit a real closure at scaled hard boundary, exact-ack both without unverified deletion) and one130-small-event manifest selection/drain fixture (no physical pressure). SQL/physical ceilings unchanged; scale only new Python logical-policy thresholds downward in the fixture. Update two old Fix1 health expectations to distinguish live representations from committed escrow, and migration reapplication to include forward06. Selected location unanswered fixture expectation adds explicit incomplete/deferred status.
+
+Before final selection: add one valid near-body-limit event with maximum-length UTF-8 fake verification receipts to exercise singleton seal/ack escrow bounds; still one small public row and no transport. Read full tests/test_locations_resolution.py (11 offline cases): rule/multiple-location resolution, fake LLM validated/empty/failure/unanswered/hallucination, manual correction,41-row batched fake LLM and already-mapped behavior. Its full ordinary file is affected and permitted. No actual LLM/network. Backfill entrypoint now returns/logs complete versus incomplete resolver status; daily caller logs incomplete resolution explicitly.
+
+Final additions before execution: active-archive101-job location pass proves only dictionary facts emit, all derived caches finish; print logical escrow arithmetic from the ordinary two-brand fixture and one large UTF-8 event (sizes/capacities only, no production extrapolation). Final affected scope: all10 new Fix2 cases; ordinary codec/outbox/batch files; only active critical-slot ack/insufficient-slot operational cases; selected relevant Fix1 budget/manifest/time/retirement/current-writer cases; full11-case offline location resolution file; existing flags-off daily isolates-failure/run-accounting test and db_runs persistence case. No source-lane counter/fairness suites, company-provider tests, physical/security/activation suites or broad whole-project run. Exact final node selection is recorded next before execution.
+
+Authoritative final collection:63 cases. This is10 Fix2 cases,4 codec,10 outbox,9 batch,10 (not11) location-resolution cases,2 selected daily/run-row cases,2 selected critical operational cases and16 selected Fix1 parameterized cases. Earlier location11 estimate was corrected by exact collection. `selection.txt` lists all63 and `selection.json` supplies actual argv. Final hashes were recorded after formatting and before running either major; no source changes during final runs.
+
+Post-candidate source-bound correction: both63-case candidate runs passed, then a source arithmetic check identified up-to-six-byte JSON escaping for valid2048-character receipts. Add a second representation to the existing singleton receipt test (escaped control character; small normal serialization fixture, no role/security/physical probe). Execute the two receipt parameter cases against the old allowance for RED, then increase only the logical ack workspace98,304 and total escrow6*C+128,000. Final affected selection will cover this new bound plus outbox/batches/critical processing and the full new Fix2 file; unchanged caller results remain in candidate outputs rather than falsely claiming one final64-case run.
+
+Final authoritative affected collection is37 cases after the escaped-receipt parameter:11 Fix2,10 outbox,9 batch,2 operational critical-slot,5 selected Fix1. `selection.txt` and exact command files are authoritative. All12 final source/test hashes remained unchanged through verification and source commit.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-development.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-development.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-development.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-final.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/lint-final.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/migration-parity.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/migration-parity.txt
new file mode 100644
index 0000000..8550d8a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/migration-parity.txt
@@ -0,0 +1 @@
+Task10 migrations04,05,06 each appear verbatim in schema.sql. Physical row enforcement/role/claim functions unchanged by06.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/receipt-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/receipt-red17.txt
new file mode 100644
index 0000000..530c0a7
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/receipt-red17.txt
@@ -0,0 +1,94 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.F                                                                       [100%]
+=================================== FAILURES ===================================
+_ test_large_valid_event_and_unicode_receipts_fit_singleton_escrow[json-escaped] _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33083 user=postgres database=poller_lifecycle_test) at 0x7fd77af6fa40>
+receipt_character = '\x01'
+
+    @requires_db
+    @pytest.mark.parametrize("receipt_character",["😀", "\x01"],ids=["unicode","json-escaped"])
+    def test_large_valid_event_and_unicode_receipts_fit_singleton_escrow(conn,receipt_character):
+        from dataclasses import replace
+        from job_discovery.lifecycle.claims import claim_work
+    
+        conn.execute("INSERT INTO brands(name) VALUES(%s)", ("😀" * 2000,))
+        conn.commit()
+        activate_fixture(conn)
+        claim = claim_work(conn, "archive", "large-singleton", 180)
+        outbox.baseline_batch(conn, "brands", claim)
+        conn.commit()
+        before = outbox.outbox_health(conn)["bytes"]
+        sample = conn.execute(
+            "SELECT octet_length(body::text) body_bytes,octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow FROM public_outbox LIMIT 1"
+        ).fetchone()
+        ordinary_cost = (
+            4 * sample["body_bytes"]
+            + 2 * sample["canonical_bytes"]
+            + 4096
+            + sample["escrow"]
+        )
+        critical_cost = (
+            2 * sample["body_bytes"]
+            + 2 * sample["canonical_bytes"]
+            + 2048
+            + sample["escrow"]
+        )
+        print(
+            "logical escrow sample",
+            json.dumps(
+                dict(
+                    sample,
+                    ordinary_event_cost=ordinary_cost,
+                    critical_slot_cost=critical_cost,
+                    ordinary_byte_capacity=outbox.ORDINARY_BYTES // ordinary_cost,
+                    critical_reserved_capacity=outbox.CRITICAL_BYTES // critical_cost,
+                )
+            ),
+        )
+        ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
+        conn.commit()
+        seal = batches.seal_batch(ref)
+        batches.persist_seal(conn, seal)
+        conn.commit()
+        receipts = verified(seal)
+        receipts = replace(
+            receipts,
+            data_receipt=replace(receipts.data_receipt, receipt=receipt_character * 2048),
+            manifest_receipt=replace(receipts.manifest_receipt, receipt=receipt_character * 2048),
+        )
+        assert outbox.outbox_health(conn)["bytes"] == before
+>       batches.ack_batch(conn, receipts, claim)
+
+tests/test_archive_fix2.py:358: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/archive/batches.py:451: in ack_batch
+    _processing_capacity(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+tx = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33083 user=postgres database=poller_lifecycle_test) at 0x7fd77af6fa40>
+event_bytes = (b'{"aggregate_id":"098ece25-a097-44b9-b3cf-c6adaf8ddcac","aggregate_type":"brands","body":{"id":"098ece25-a097-44b9-b...ll,"provenance":"current_baseline","recorded_at":"2026-10-07T22:43:04.531987+00:00","revision":1,"schema_version":1}',)
+manifest_bytes = 1142, receipt_bytes = 25130
+
+    def _processing_capacity(tx, event_bytes, *, manifest_bytes=None, receipt_bytes=None):
+        """Spend only the selected immutable events' admission-time escrow.
+    
+        The bound admits singleton batches, so max_events=1 always makes logical
+        progress. Larger batches share the same bounded header/seal/ack allowance.
+        Physical reservations remain separate and may still defer any phase.
+        """
+        count = len(event_bytes)
+        canonical_bytes = sum(len(value) for value in event_bytes)
+        manifest_bound = 8192 * count + 2 * canonical_bytes
+        if manifest_bytes is not None and manifest_bytes > manifest_bound:
+            raise ArchiveBlocked("manifest exceeds reserved processing workspace")
+        if receipt_bytes is not None and 2 * receipt_bytes + 16384 * count > 65536 * count:
+>           raise ArchiveBlocked("acknowledgement exceeds reserved processing workspace")
+E           job_discovery.archive.outbox.ArchiveBlocked: acknowledgement exceeds reserved processing workspace
+
+job_discovery/archive/batches.py:37: ArchiveBlocked
+----------------------------- Captured stdout call -----------------------------
+logical escrow sample {"body_bytes": 8058, "canonical_bytes": 8415, "escrow": 145722, "ordinary_event_cost": 198880, "critical_slot_cost": 180716, "ordinary_byte_capacity": 590, "critical_reserved_capacity": 92}
+=========================== short test summary info ============================
+FAILED tests/test_archive_fix2.py::test_large_valid_event_and_unicode_receipts_fit_singleton_escrow[json-escaped]
+1 failed, 1 passed in 1.21s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red-seed17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red-seed17.txt
new file mode 100644
index 0000000..f9e4811
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red-seed17.txt
@@ -0,0 +1,119 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FF                                                                       [100%]
+=================================== FAILURES ===================================
+_____ test_daily_seed_deferral_preserves_run_and_existing_verification[1] ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33078 user=postgres database=poller_lifecycle_test) at 0x7f4b7596f680>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f4b7596e360>
+failed_chunk = 1
+
+    @requires_db
+    @pytest.mark.parametrize('failed_chunk',[1,2])
+    def test_daily_seed_deferral_preserves_run_and_existing_verification(conn,monkeypatch,failed_chunk):
+        from tests.test_lifecycle_reconcile import setup_source
+        from job_discovery.adapters import ADAPTERS
+        from job_discovery.adapters.completeness import SourceResult,SourceStatus
+        from job_discovery.models import Posting
+        runner=importlib.import_module('job_discovery.run')
+        source=setup_source(conn)
+        conn.commit()
+        activate_fixture(conn)
+        monkeypatch.setattr(runner,'pre_admission_maintenance',lambda dsn:SimpleNamespace(blocked=False))
+        monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(TEST_DSN,row_factory=dict_row))
+        targets=[dict(name=f'Seed {i}',ats='lever',token=f'seed-{i}') for i in range(101)]
+        monkeypatch.setattr(runner,'load_targets',lambda:targets)
+        original=runner.db.sync_seed
+        calls=[]
+        def blocked(c,chunk):
+            original(c,chunk)
+            calls.append(1)
+            if len(calls)==failed_chunk:
+                raise outbox.ArchiveBlocked('offline seed chunk deferral')
+        monkeypatch.setattr(runner.db,'sync_seed',blocked)
+        # Keep the test on seed pressure and verification of the existing corpus.
+        monkeypatch.setattr(runner.db,'sync_source_accounts',lambda c:0)
+        feeds=[]
+        def feed(token,**kwargs):
+            feeds.append(token)
+            return SourceResult(iter([Posting('0','Role','https://example.test/job')]),SourceStatus())
+        monkeypatch.setitem(ADAPTERS,'lever',feed)
+>       result=runner.run()
+               ^^^^^^^^^^^^
+
+tests/test_archive_fix2.py:109: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/run.py:109: in run
+    db.sync_seed(conn, targets[start:start+100])
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+c = <psycopg.Connection [BAD] at 0x7f4b751dae40>
+chunk = [{'name': 'Seed 0', 'ats': 'lever', 'token': 'seed-0'}, {'name': 'Seed 1', 'ats': 'lever', 'token': 'seed-1'}, {'name'...3'}, {'name': 'Seed 4', 'ats': 'lever', 'token': 'seed-4'}, {'name': 'Seed 5', 'ats': 'lever', 'token': 'seed-5'}, ...]
+
+    def blocked(c,chunk):
+        original(c,chunk)
+        calls.append(1)
+        if len(calls)==failed_chunk:
+>           raise outbox.ArchiveBlocked('offline seed chunk deferral')
+E           job_discovery.archive.outbox.ArchiveBlocked: offline seed chunk deferral
+
+tests/test_archive_fix2.py:100: ArchiveBlocked
+_____ test_daily_seed_deferral_preserves_run_and_existing_verification[2] ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33078 user=postgres database=poller_lifecycle_test) at 0x7f4b74d0f110>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f4b74d0fce0>
+failed_chunk = 2
+
+    @requires_db
+    @pytest.mark.parametrize('failed_chunk',[1,2])
+    def test_daily_seed_deferral_preserves_run_and_existing_verification(conn,monkeypatch,failed_chunk):
+        from tests.test_lifecycle_reconcile import setup_source
+        from job_discovery.adapters import ADAPTERS
+        from job_discovery.adapters.completeness import SourceResult,SourceStatus
+        from job_discovery.models import Posting
+        runner=importlib.import_module('job_discovery.run')
+        source=setup_source(conn)
+        conn.commit()
+        activate_fixture(conn)
+        monkeypatch.setattr(runner,'pre_admission_maintenance',lambda dsn:SimpleNamespace(blocked=False))
+        monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(TEST_DSN,row_factory=dict_row))
+        targets=[dict(name=f'Seed {i}',ats='lever',token=f'seed-{i}') for i in range(101)]
+        monkeypatch.setattr(runner,'load_targets',lambda:targets)
+        original=runner.db.sync_seed
+        calls=[]
+        def blocked(c,chunk):
+            original(c,chunk)
+            calls.append(1)
+            if len(calls)==failed_chunk:
+                raise outbox.ArchiveBlocked('offline seed chunk deferral')
+        monkeypatch.setattr(runner.db,'sync_seed',blocked)
+        # Keep the test on seed pressure and verification of the existing corpus.
+        monkeypatch.setattr(runner.db,'sync_source_accounts',lambda c:0)
+        feeds=[]
+        def feed(token,**kwargs):
+            feeds.append(token)
+            return SourceResult(iter([Posting('0','Role','https://example.test/job')]),SourceStatus())
+        monkeypatch.setitem(ADAPTERS,'lever',feed)
+>       result=runner.run()
+               ^^^^^^^^^^^^
+
+tests/test_archive_fix2.py:109: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/run.py:109: in run
+    db.sync_seed(conn, targets[start:start+100])
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+c = <psycopg.Connection [BAD] at 0x7f4b74d46060>
+chunk = [{'name': 'Seed 100', 'ats': 'lever', 'token': 'seed-100'}]
+
+    def blocked(c,chunk):
+        original(c,chunk)
+        calls.append(1)
+        if len(calls)==failed_chunk:
+>           raise outbox.ArchiveBlocked('offline seed chunk deferral')
+E           job_discovery.archive.outbox.ArchiveBlocked: offline seed chunk deferral
+
+tests/test_archive_fix2.py:100: ArchiveBlocked
+=========================== short test summary info ============================
+FAILED tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[1]
+FAILED tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[2]
+2 failed in 6.82s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red17.txt
new file mode 100644
index 0000000..2ce1b3d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/red17.txt
@@ -0,0 +1,298 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFF                                                                   [100%]
+=================================== FAILURES ===================================
+____________ test_processing_room_is_committed_before_claim_or_seal ____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c6296e690>
+
+    @requires_db
+    def test_processing_room_is_committed_before_claim_or_seal(conn):
+        claim,_=seeded_events(conn,2)
+        admitted=outbox.outbox_health(conn)
+        ref=batches.claim_batch(conn,BatchLimits(max_events=1),claim)
+        conn.commit()
+        claimed=outbox.outbox_health(conn)
+>       assert claimed['bytes']==admitted['bytes']
+E       assert 20460 == 10400
+
+tests/test_archive_fix2.py:22: AssertionError
+_____ test_actual_location_resolution_finishes_all_committed_chunks[False] _____
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c629405c0>
+correction = False
+
+    @requires_db
+    @pytest.mark.parametrize('correction',[False,True])
+    def test_actual_location_resolution_finishes_all_committed_chunks(conn,correction):
+        from tests.test_locations_resolution import FakeParseClient
+        location_jobs(conn)
+        if correction:
+            locations.resolve_new_locations(conn,parse_client=FakeParseClient())
+            conn.execute("UPDATE locations SET canonicals=ARRAY['Austin, MN'],source='manual'")
+            conn.commit()
+        result=locations.resolve_new_locations(conn,parse_client=FakeParseClient())
+>       assert result['stamped']==101
+E       assert 100 == 101
+
+tests/test_archive_fix2.py:52: AssertionError
+_____ test_actual_location_resolution_finishes_all_committed_chunks[True] ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c5de209e0>
+correction = True
+
+    @requires_db
+    @pytest.mark.parametrize('correction',[False,True])
+    def test_actual_location_resolution_finishes_all_committed_chunks(conn,correction):
+        from tests.test_locations_resolution import FakeParseClient
+        location_jobs(conn)
+        if correction:
+            locations.resolve_new_locations(conn,parse_client=FakeParseClient())
+            conn.execute("UPDATE locations SET canonicals=ARRAY['Austin, MN'],source='manual'")
+            conn.commit()
+        result=locations.resolve_new_locations(conn,parse_client=FakeParseClient())
+>       assert result['stamped']==101
+E       assert 100 == 101
+
+tests/test_archive_fix2.py:52: AssertionError
+______ test_later_stamp_failure_preserves_progress_and_reports_incomplete ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c5dc7f0b0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1c5dc7e750>
+
+    @requires_db
+    def test_later_stamp_failure_preserves_progress_and_reports_incomplete(conn,monkeypatch):
+        from tests.test_locations_resolution import FakeParseClient
+        location_jobs(conn)
+        original=locations.stamp_jobs
+        calls=[]
+        def interrupted(c):
+            calls.append(1)
+            result=original(c)
+            if len(calls)==2:
+                raise outbox.ArchiveBlocked('offline later chunk deferral')
+            return result
+        monkeypatch.setattr(locations,'stamp_jobs',interrupted)
+        result=locations.resolve_new_locations(conn,parse_client=FakeParseClient())
+>       assert result['stamped']==100 and not result['complete'] and result['storage_deferred']
+                                              ^^^^^^^^^^^^^^^^^^
+E       KeyError: 'complete'
+
+tests/test_archive_fix2.py:72: KeyError
+_____ test_daily_seed_deferral_preserves_run_and_existing_verification[1] ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c5de22360>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1c5de23fe0>
+failed_chunk = 1
+
+    @requires_db
+    @pytest.mark.parametrize('failed_chunk',[1,2])
+    def test_daily_seed_deferral_preserves_run_and_existing_verification(conn,monkeypatch,failed_chunk):
+        from tests.test_lifecycle_reconcile import setup_source
+        from job_discovery.lifecycle import reconcile
+        from job_discovery.adapters import ADAPTERS
+        from job_discovery.adapters.completeness import SourceResult,SourceStatus
+        from job_discovery.models import Posting
+        runner=importlib.import_module('job_discovery.run')
+        source=setup_source(conn)
+        conn.commit()
+        activate_fixture(conn)
+        monkeypatch.setattr(runner,'pre_admission_maintenance',lambda dsn:SimpleNamespace(blocked=False))
+        monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(conn.info.dsn,row_factory=dict_row))
+        targets=[dict(name=f'Seed {i}',ats='lever',token=f'seed-{i}') for i in range(101)]
+        monkeypatch.setattr(runner,'load_targets',lambda:targets)
+        original=runner.db.sync_seed
+        calls=[]
+        def blocked(c,chunk):
+            original(c,chunk)
+            calls.append(1)
+            if len(calls)==failed_chunk:
+                raise outbox.ArchiveBlocked('offline seed chunk deferral')
+        monkeypatch.setattr(runner.db,'sync_seed',blocked)
+        # Keep the test on seed pressure and verification of the existing corpus.
+        monkeypatch.setattr(runner.db,'sync_source_accounts',lambda c:0)
+        feeds=[]
+        def feed(token,**kwargs):
+            feeds.append(token)
+            return SourceResult(iter([Posting('0','Role','https://example.test/job')]),SourceStatus())
+        monkeypatch.setitem(ADAPTERS,'lever',feed)
+>       result=runner.run()
+               ^^^^^^^^^^^^
+
+tests/test_archive_fix2.py:110: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/run.py:82: in run
+    conn = db.connect(dsn)
+           ^^^^^^^^^^^^^^^
+tests/test_archive_fix2.py:92: in <lambda>
+    monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(conn.info.dsn,row_factory=dict_row))
+                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+cls = <class 'psycopg.Connection'>
+conninfo = 'user=postgres dbname=poller_lifecycle_test host=127.0.0.1 hostaddr=127.0.0.1 port=33077 sslcertmode=allow'
+autocommit = False, prepare_threshold = 5, context = None
+row_factory = <function dict_row at 0x7f1c642e1300>, cursor_factory = None
+kwargs = {}
+
+    @classmethod
+    def connect(
+        cls,
+        conninfo: str = "",
+        *,
+        autocommit: bool = False,
+        prepare_threshold: int | None = 5,
+        context: AdaptContext | None = None,
+        row_factory: RowFactory[Row] | None = None,
+        cursor_factory: type[Cursor[Row]] | None = None,
+        **kwargs: ConnParam,
+    ) -> Self:
+        """
+        Connect to a database server and return a new `Connection` instance.
+        """
+    
+        params = cls._get_connection_params(conninfo, **kwargs)
+        timeout = timeout_from_conninfo(params)
+        rv = None
+        attempts = conninfo_attempts(params)
+        conn_errors: list[tuple[e.Error, str]] = []
+        for attempt in attempts:
+            tdescr = (attempt.get("host"), attempt.get("port"), attempt.get("hostaddr"))
+            descr = "host: %r, port: %r, hostaddr: %r" % tdescr
+            logger.debug("connection attempt: %s", descr)
+            try:
+                conninfo = make_conninfo("", **attempt)
+                gen = cls._connect_gen(conninfo)
+                rv = waiting.wait_conn(gen, interval=_WAIT_INTERVAL, timeout=timeout)
+            except e._WaitTimeout:
+                tex = e.ConnectionTimeout("connection timeout expired")
+                logger.debug("connection failed: %s: %s", descr, str(tex))
+                conn_errors.append((tex, descr))
+            except e.Error as ex:
+                logger.debug("connection failed: %s: %s", descr, str(ex))
+                conn_errors.append((ex, descr))
+            except e._NO_TRACEBACK as ex:
+                raise ex.with_traceback(None)
+            else:
+                logger.debug("connection succeeded: %s", descr)
+                break
+    
+        if not rv:
+            last_ex = conn_errors[-1][0]
+            if len(conn_errors) == 1:
+>               raise last_ex.with_traceback(None)
+E               psycopg.OperationalError: connection failed: connection to server at "127.0.0.1", port 33077 failed: fe_sendauth: no password supplied
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:126: OperationalError
+_____ test_daily_seed_deferral_preserves_run_and_existing_verification[2] ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33077 user=postgres database=poller_lifecycle_test) at 0x7f1c5afda030>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1c5afdb230>
+failed_chunk = 2
+
+    @requires_db
+    @pytest.mark.parametrize('failed_chunk',[1,2])
+    def test_daily_seed_deferral_preserves_run_and_existing_verification(conn,monkeypatch,failed_chunk):
+        from tests.test_lifecycle_reconcile import setup_source
+        from job_discovery.lifecycle import reconcile
+        from job_discovery.adapters import ADAPTERS
+        from job_discovery.adapters.completeness import SourceResult,SourceStatus
+        from job_discovery.models import Posting
+        runner=importlib.import_module('job_discovery.run')
+        source=setup_source(conn)
+        conn.commit()
+        activate_fixture(conn)
+        monkeypatch.setattr(runner,'pre_admission_maintenance',lambda dsn:SimpleNamespace(blocked=False))
+        monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(conn.info.dsn,row_factory=dict_row))
+        targets=[dict(name=f'Seed {i}',ats='lever',token=f'seed-{i}') for i in range(101)]
+        monkeypatch.setattr(runner,'load_targets',lambda:targets)
+        original=runner.db.sync_seed
+        calls=[]
+        def blocked(c,chunk):
+            original(c,chunk)
+            calls.append(1)
+            if len(calls)==failed_chunk:
+                raise outbox.ArchiveBlocked('offline seed chunk deferral')
+        monkeypatch.setattr(runner.db,'sync_seed',blocked)
+        # Keep the test on seed pressure and verification of the existing corpus.
+        monkeypatch.setattr(runner.db,'sync_source_accounts',lambda c:0)
+        feeds=[]
+        def feed(token,**kwargs):
+            feeds.append(token)
+            return SourceResult(iter([Posting('0','Role','https://example.test/job')]),SourceStatus())
+        monkeypatch.setitem(ADAPTERS,'lever',feed)
+>       result=runner.run()
+               ^^^^^^^^^^^^
+
+tests/test_archive_fix2.py:110: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/run.py:82: in run
+    conn = db.connect(dsn)
+           ^^^^^^^^^^^^^^^
+tests/test_archive_fix2.py:92: in <lambda>
+    monkeypatch.setattr(runner.db,'connect',lambda dsn:psycopg.connect(conn.info.dsn,row_factory=dict_row))
+                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+cls = <class 'psycopg.Connection'>
+conninfo = 'user=postgres dbname=poller_lifecycle_test host=127.0.0.1 hostaddr=127.0.0.1 port=33077 sslcertmode=allow'
+autocommit = False, prepare_threshold = 5, context = None
+row_factory = <function dict_row at 0x7f1c642e1300>, cursor_factory = None
+kwargs = {}
+
+    @classmethod
+    def connect(
+        cls,
+        conninfo: str = "",
+        *,
+        autocommit: bool = False,
+        prepare_threshold: int | None = 5,
+        context: AdaptContext | None = None,
+        row_factory: RowFactory[Row] | None = None,
+        cursor_factory: type[Cursor[Row]] | None = None,
+        **kwargs: ConnParam,
+    ) -> Self:
+        """
+        Connect to a database server and return a new `Connection` instance.
+        """
+    
+        params = cls._get_connection_params(conninfo, **kwargs)
+        timeout = timeout_from_conninfo(params)
+        rv = None
+        attempts = conninfo_attempts(params)
+        conn_errors: list[tuple[e.Error, str]] = []
+        for attempt in attempts:
+            tdescr = (attempt.get("host"), attempt.get("port"), attempt.get("hostaddr"))
+            descr = "host: %r, port: %r, hostaddr: %r" % tdescr
+            logger.debug("connection attempt: %s", descr)
+            try:
+                conninfo = make_conninfo("", **attempt)
+                gen = cls._connect_gen(conninfo)
+                rv = waiting.wait_conn(gen, interval=_WAIT_INTERVAL, timeout=timeout)
+            except e._WaitTimeout:
+                tex = e.ConnectionTimeout("connection timeout expired")
+                logger.debug("connection failed: %s: %s", descr, str(tex))
+                conn_errors.append((tex, descr))
+            except e.Error as ex:
+                logger.debug("connection failed: %s: %s", descr, str(ex))
+                conn_errors.append((ex, descr))
+            except e._NO_TRACEBACK as ex:
+                raise ex.with_traceback(None)
+            else:
+                logger.debug("connection succeeded: %s", descr)
+                break
+    
+        if not rv:
+            last_ex = conn_errors[-1][0]
+            if len(conn_errors) == 1:
+>               raise last_ex.with_traceback(None)
+E               psycopg.OperationalError: connection failed: connection to server at "127.0.0.1", port 33077 failed: fe_sendauth: no password supplied
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:126: OperationalError
+=========================== short test summary info ============================
+FAILED tests/test_archive_fix2.py::test_processing_room_is_committed_before_claim_or_seal
+FAILED tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[False]
+FAILED tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[True]
+FAILED tests/test_archive_fix2.py::test_later_stamp_failure_preserves_progress_and_reports_incomplete
+FAILED tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[1]
+FAILED tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[2]
+6 failed in 9.72s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.json
new file mode 100644
index 0000000..0aa073f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.json
@@ -0,0 +1,12 @@
+[
+  "tests/test_archive_fix2.py",
+  "tests/test_archive_outbox.py",
+  "tests/test_archive_batches.py",
+  "tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack",
+  "tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically",
+  "tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast",
+  "tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate",
+  "tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal",
+  "tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch",
+  "tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated"
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.txt
new file mode 100644
index 0000000..669d103
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/selection.txt
@@ -0,0 +1,39 @@
+tests/test_archive_fix2.py::test_processing_room_is_committed_before_claim_or_seal
+tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[False]
+tests/test_archive_fix2.py::test_actual_location_resolution_finishes_all_committed_chunks[True]
+tests/test_archive_fix2.py::test_later_stamp_failure_preserves_progress_and_reports_incomplete
+tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[1]
+tests/test_archive_fix2.py::test_daily_seed_deferral_preserves_run_and_existing_verification[2]
+tests/test_archive_fix2.py::test_scaled_ordinary_and_critical_boundaries_keep_exact_drain_room
+tests/test_archive_fix2.py::test_default_selection_shrinks_to_manifest_workspace_and_drains
+tests/test_archive_fix2.py::test_large_valid_event_and_unicode_receipts_fit_singleton_escrow[unicode]
+tests/test_archive_fix2.py::test_large_valid_event_and_unicode_receipts_fit_singleton_escrow[json-escaped]
+tests/test_archive_fix2.py::test_active_location_pass_stamps_all_rows_without_cache_events
+tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
+tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
+tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
+tests/test_archive_outbox.py::test_budget_boundaries_and_critical_reserve
+tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+tests/test_archive_outbox.py::test_listing_watermark_does_not_certify_unknown_version
+tests/test_archive_outbox.py::test_migration_reapplication_preserves_flags_and_existing_events
+tests/test_archive_outbox.py::test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup
+tests/test_archive_batches.py::test_batch_limits_are_bounded
+tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
+tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
+tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+tests/test_archive_batches.py::test_later_lower_sequence_commit_remains_pending
+tests/test_archive_batches.py::test_seven_day_terminal_compaction_preserves_exact_markers
+tests/test_archive_batches.py::test_batch_claim_excludes_own_uncommitted_public_events
+tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
+tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically
+tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
+tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate
+tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal
+tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch
+tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated
+
+37 tests collected in 0.21s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-commit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-commit.txt
new file mode 100644
index 0000000..9afc4b6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-commit.txt
@@ -0,0 +1 @@
+872a9844f59d3ed4db483ff13fe40c0e02bff09b
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-files.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-files.sha256
new file mode 100644
index 0000000..bc414d8
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/source-files.sha256
@@ -0,0 +1,12 @@
+c250287a0f5178d16502fe22c1c444f5b758c2efe2760ae46d8709606bc7c0df  job_discovery/archive/batches.py
+e363416ff798a6e22ef86ea86100661ed67a5eac3b4cb9dc57cfa025e1fdb401  job_discovery/archive/outbox.py
+2247c3b38e731da2b8c98237a3632fad3978788c3ac5ff4e544f4cdd99263fa3  job_discovery/lifecycle/operational.py
+f37e5e27ee9e789253d16f850d669b224b4390e33d328254350b0e86def0a27c  job_discovery/locations.py
+cdbdd802e8e37e1712d0119523d56fde53d7117a4dc592614b65a696c8b1e498  job_discovery/location_backfill.py
+2d985312c790f2942ef02712e7fe4a93b07414c04ad7a335d083f74fe21ffa1e  job_discovery/run.py
+73c0656a7738365c73b75fafa7cdc9e54cb3efc959b081400b181a3b8b76f513  migrations/2026-10-03-06-public-outbox-fix2.sql
+2c1ef5e326f639b3ad4308e3218d1aa6debf3a3cbed9dfacefa58f9b5f2ac910  schema.sql
+370efae641e4107343c91c4d313e612f57af678791a3fccb0815529f02550c74  tests/test_archive_fix2.py
+06ffcaacac76af0c90191b30430384bfeffb522b756bad03860bb380520e5d68  tests/test_archive_fix1.py
+c78e3046370e21219503b3727b014235412b089474c6ef5eda5285a9e120b9a7  tests/test_archive_outbox.py
+6823e9a0e9619dcc5f4b2dd07950605357b7d72e404de3b2d1ab2459ceb7580c  tests/test_locations_resolution.py
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/versions.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/versions.json
new file mode 100644
index 0000000..9aa0357
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix2/versions.json
@@ -0,0 +1,6 @@
+{
+  "python": "3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]",
+  "psycopg": "3.3.6",
+  "pytest": "9.1.1",
+  "ruff": "0.15.20"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix-1-review-package.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix-1-review-package.md
new file mode 100644
index 0000000..57435f5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix-1-review-package.md
@@ -0,0 +1,10613 @@
+# Full pinned review package
+
+BASE: e3f889421fa1ad30206e128cb292b101bc3a58e0
+
+HEAD: 095fec89132bec361c6b1733d1fd97ff5018a6ed
+
+## Commits
+
+095fec89132bec361c6b1733d1fd97ff5018a6ed Document Task10 Fix1 corrections and scoped verification
+01408f0fce8743a98a55726cc9da50f808955443 Complete Task10 public archive and operational integration fixes
+0f0a759d009a042821465e0ac2c0dc4dece9501b docs: record full task 10 review and one correction scope
+4b02bdbd917e524b523ad4a404fb6608406fc5c5 docs: pin task 10 operational contract and permitted review
+
+
+## Files
+
+ .../CURRENT.md                                     |   16 +
+ .../controller-resume.md                           |   24 +
+ .../final-review-carry-forward.md                  |   15 +
+ .../progress.md                                    |   24 +
+ .../release-preflight.md                           |    4 +
+ .../rulings-current.md                             |   63 +
+ .../task-10-evidence/fix1/commands.md              |   21 +
+ .../task-10-evidence/fix1/development17.txt        |   12 +
+ .../task-10-evidence/fix1/development17b.txt       |   58 +
+ .../task-10-evidence/fix1/development17c.txt       |  822 +++
+ .../task-10-evidence/fix1/development17d.txt       |    3 +
+ .../task-10-evidence/fix1/final-selection.json     |   17 +
+ .../task-10-evidence/fix1/final16.command.txt      |    1 +
+ .../task-10-evidence/fix1/final16.exit.txt         |    1 +
+ .../task-10-evidence/fix1/final16.txt              |    4 +
+ .../task-10-evidence/fix1/final17.command.txt      |    1 +
+ .../task-10-evidence/fix1/final17.exit.txt         |    1 +
+ .../task-10-evidence/fix1/final17.txt              |    4 +
+ .../task-10-evidence/fix1/format-final.txt         |    1 +
+ .../task-10-evidence/fix1/format-final2.txt        |    1 +
+ .../task-10-evidence/fix1/format.txt               |    1 +
+ .../task-10-evidence/fix1/image-pins.txt           |    4 +
+ .../task-10-evidence/fix1/inventory.md             |   11 +
+ .../task-10-evidence/fix1/lint-development.txt     |    1 +
+ .../task-10-evidence/fix1/lint-final.txt           |    1 +
+ .../task-10-evidence/fix1/lint-initial.txt         |   12 +
+ .../task-10-evidence/fix1/migration-parity.txt     |    1 +
+ .../task-10-evidence/fix1/red17.txt                |  190 +
+ .../task-10-evidence/fix1/selection-final.txt      |   68 +
+ .../task-10-evidence/fix1/selection.txt            |   58 +
+ .../task-10-evidence/fix1/selection17.txt          |   74 +
+ .../task-10-evidence/fix1/source-commit.txt        |    1 +
+ .../task-10-evidence/fix1/source-files.sha256      |   25 +
+ .../task-10-evidence/fix1/source-files.txt         |   25 +
+ .../task-10-evidence/fix1/versions.json            |    6 +
+ .../task-10-fix1-dispatch.md                       |   11 +
+ .../task-10-fix1-report.md                         |  159 +
+ .../task-10-operational-ruling.md                  |    3 +
+ .../task-10-report.md                              |    8 +
+ .../task-10-requirements-review.md                 |  167 +
+ .../task-10-review-package.md                      | 5286 ++++++++++++++++++++
+ .../task-10-reviewer-dispatch.md                   |    5 +
+ .../task-13-author-dispatch.md                     |    2 +
+ company_discovery/db.py                            |   15 +-
+ company_discovery/enrich_apply.py                  |    4 +-
+ company_discovery/jobs_db.py                       |    4 +-
+ company_discovery/name_backfill.py                 |   13 +-
+ company_discovery/run.py                           |    3 +-
+ company_discovery/worker.py                        |    7 +-
+ job_discovery/archive/batches.py                   |  244 +-
+ job_discovery/archive/outbox.py                    |   27 +-
+ job_discovery/archive/schema.py                    |    4 +-
+ job_discovery/archive/types.py                     |    1 +
+ job_discovery/archive/writers.py                   |   53 +
+ job_discovery/db.py                                |   35 +-
+ job_discovery/lifecycle/errors.py                  |    3 +
+ job_discovery/lifecycle/identity.py                |   12 +-
+ job_discovery/lifecycle/operational.py             |   39 +-
+ job_discovery/lifecycle/reconcile.py               |   24 +-
+ job_discovery/locations.py                         |   36 +-
+ job_discovery/run.py                               |    4 +-
+ migrations/2026-10-03-05-public-outbox-fix1.sql    |  228 +
+ schema.sql                                         |  229 +
+ tests/archive_helpers.py                           |    3 +
+ tests/test_archive_batches.py                      |   20 +-
+ tests/test_archive_fix1.py                         |  645 +++
+ tests/test_archive_outbox.py                       |    1 +
+ tests/test_lifecycle_operational.py                |   19 +-
+ 68 files changed, 8726 insertions(+), 159 deletions(-)
+
+
+## Complete diff
+
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
+index 5435452..7da3eef 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
+@@ -30,10 +30,26 @@ Latest committed UNACCEPTED Task9 reviewed complete-history snapshot: Library li
+ 
+ Parent continuation: root retains controller; no separate accessibleownerthread confirmed. ExistingTask9author resumedexistingFix1; await/integrate ratherthaninterimfinal. Latestcommittedreviewed-unacceptedrecovery Librarylibfile_ba5612b39fe88191946530bc1d280999 /file_00000000b2c081f6925b5dc14927155c v0 through08922f4, dirtyFix1excluded. Accepted08unchanged.
+ 
+ Task9 same-author Fix1 finalphase:60affectedTS8files/tsc0/lint0errors9inheritedwarnings/fakebrowser17assertions authorreported; no DB/Python/transportdelta or reruns. Report/sourcepinpreparing; SAMEscopedreviewpending, no acceptance09. Ownershipconfirmedoriginalauthorunderthiscontroller; no otherownerthreadneeded.
+ 
+ Task9 Fix1 author DONE/STOP: source6bd1099b4338cd154e8f1360db1e87fbe6fc2dae/reportfd0422fb8e5dab1ee006d87dcb992bcb13c4e9e2. Root read full report/actual outputs and prepared-status screenshot:60affectedTS8files/tsc0/lint0errors9warnings/17fakebrowserassertions, retained concurrent59pass1timeout then identical uncrowded60pass; no DB/Python/backend/transport delta/reruns. Full FixBASE7d9216d6..fd0422fb package generated. SAME original /root/recovery_task09_requirements_review resumed ONLY R9-1/R9-2 +fix-introduced Important/Critical, scope amendments preserved. No acceptance09 yet.
+ 
+ Task9 complete (BASE5a319253..source6bd1099b/reportfd0422fb; original+scoped permitted requirements/code-quality approved). Same reviewer Fix1 SpecPASS/QualityAPPROVED; FULL report root read, R9-1/R9-2 ADDRESSED/no new Important/Critical, Funnel and actual React checklist addressed. Root read actual logs/screenshots/pins; exact wholephase evidence and failures retained. Task13 owned/default lane+3fixtures+2PDFskips, dynamic public/mutation query cost unmeasured, Task8 unknown-input recapture unimplemented, R6-4 mandatory10/13, omitted Task3 security review gaps remain. No production/activation/security approval. Accepted09 fullhistory Library checkpoint next, then fresh10 immediately.
+ 
+ Checkpoint09 CONFIRMED Librarylibfile_6843e0ce183c8191a275f204e747c78d /file_000000003638821090268ef9b20fce0a v0/xattrs SAMEexec; verified completehistory4785080388b945e8408a3fedb0b4eb86e89a03be /workspace/scratch/job-board-lifecycle-recovery-checkpoint-09.bundle. Accepted permitted review, no security/fullrelease claim. Next freshsoleTask10 Astra/high forkNONE actualforwardBASE; minimal R6-4 operational contract report REQUIRED before anyguardchange.
++
++Task10 ACTIVE freshsoleauthor /root/recovery_task10_implementer Astra/high forkNONE BASE6075983bd63dced95ec94dc61b9b112a79f4564d. Exactbrief/dispatch/amendments+R6-4 proposal-before-contractchange supplied. Own typedoutbox/seal/exactack newfeature ordinarycoverage, no Task3 probe/security substitution. Localonly/authornosubagents/rootdocs-only/noGitstagewhileauthoractive. Accepted09 Library6843e0ce confirmed; all10–13/finalreview/completedauthorizedrelease remain.
++
++Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
++
++Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evidencee3f889421fa1ad30206e128cb292b101bc3a58e0. FULLreport/commands/inventory/actual36selectedEACH17.11/16.15→7opsEACH→9batchEACH finalchanges/rootread;37uniquepermajoracrossphasesNOTonefinal37command. Lintpass/versionsactual, allfailures retained; noDBskip/securityproof. FullBASE6075983..e3f8894 packagegenerated, freshpermitted /root/recovery_task10_requirements_review Astra/highforkNONE ACTIVE. Importantphysicalcontractlimits: fixedcriticalslots1..12500/provision16default/0..100explicit,24576paddingbytes each (all307200000bytesbeforeoverhead), body<=8192/event<=12288; logicalpreallocationNOTphysicalcredit; seal/ackordinarygrowthguard maydeferaboveceiling, slotsnotautomaticallyrecycled, missingbaseline/slotsclosurerollback. Smallfixture0allocated/table/indexdelta NOTsustained/actualabove6000measurement; no refusedTask3probes. Writer/destination/baseline/operationalcoverage readiness and exporter/replay/compactperiodic orchestration pending11–13. Task10reviewnotaccepteduntilverdict; all13/finalreview/completedauthorizedreleasecontinue.
++
++Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
++
++Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
++
++Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
++
++Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
++
++Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+index e9d6006..aa94b37 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+@@ -280,10 +280,34 @@ Reviewed-UNACCEPTED Task9 complete-history bundle CONFIRMED Library libfile_54f0
+ Task9 freshfinalreview SpecFAIL/QualityCHANGES_REQUIRED TWOImportant R9-1 displayedhistorymergesindependentdiscoverypage→repeats/1000rowsfor500serverpage; R9-2 packageonlyunscoredhistory hidesApplicationPanel/applied/preparationstatus behindfit_scoregate. RootreadFULLreport, no acceptance09. SAMEoriginalauthorFix1/5 completebothfindings; FixBASE7d9216d6c3a2a0ad8f28350e0f7992afbb725410. Preserveindependentlypagedhistory/displayvsdetaillookup and immutableprivateJD/Q/version/exactreceipts/generationreadiness, no recapturefeature. ApplyReactskill/checklistwhenfixingcomponents; scopedactualUI/pagination/unscoredsavedcontentcoverage, no unchangedDB/transport/broadtestrepeat.
+ Task9 minor(deferred): analyticsFunnel 'of open' denominatorcopy shouldbe'of discovery'; permittedwithinrelatedcopyfix. NewConsumers.db owned-envcollectionguard sharesINHERITEDlane-selectiondefect withBASEtwoTask8DBsuites; plainnpmCI notverifiedgreen, mandatoryTask13explicitdefault/ownedlaneinventory/stricttargets. No newTask9thirdfunctionalblocker/securityclaim. Task9authorReactchecklistnotdocumented;Fix1mustapplyactualskill/report. Freshrevieweronlypurelocalhistoryhelperdiagnostic, no coveredreruns/probes. Fullreport task-9-requirements-review.md authoritativefindings.
+ 
+ Parent renewed explicit controller continuation after interim audit handoff: continue9–13/finalreview/authorizedcompletedrelease, coordinate EXISTINGauthor notduplicate. Collaboration now shows /root/recovery_task09_implementer pending_init; followup_task resumes its EXISTING ONEFix1, preserves3dirtytests/completeTWO R9findings/fullFixBASE7d9216d6. No confirmed separate accessiblecontrollerthread; root retainscoordination, earlierpause notcompletion. Latestaccepted08Library2567; latestcommittedreviewedUNACCEPTEDfullhistoryLibrary ba5612b39fe88191946530bc1d280999 through08922f4 (xattrs appliedsameexec), counterpart earlier54f0e252...through25e4a2e alsoinCURRENT; neitherincludesdirtyFix1. No executorreplacement/completedstage/testduplication or prohibitedreviewretry. Awaitexistingauthorphase/result, SAMEscopedreviewthenLibrary09, freshauthors10–13. RootnoGitstagewhileauthoractive.
+ 
+ ExistingTask9Fix1authorconfirmedactiveunderthiscontroller; preserves3dirtytests/no duplicatework. R9-1/R9-2+Funnelcopy GREENauthorreported60tests8affectedcomponent/UIcontractfiles;tsc0/lint0errors9inheritedwarnings. NarrowinstalledChromiumfakebrowser17assertions includesdisjointhistory/appliedpools+actualunscoredprepared/appliedartifacts/answers/status;no externalrequests/errors.5initialREDfailures+duplicate-description/fixturetype/captionformat attemptsretained. ActualReactchecklist/report/sourcepinpreparation ongoing; no DB/Python/transportchanges/reruns/blocker. No Task9acceptanceuntilrootactualevidence/fullFixBASErange/SAMEreviewerscopedgate/Library09. RootnoGitstagewhileauthoractive.
+ 
+ Task9 Fix1 author DONE/STOP: source6bd1099b4338cd154e8f1360db1e87fbe6fc2dae/reportfd0422fb8e5dab1ee006d87dcb992bcb13c4e9e2. Root read full report/actual outputs and prepared-status screenshot:60affectedTS8files/tsc0/lint0errors9warnings/17fakebrowserassertions, retained concurrent59pass1timeout then identical uncrowded60pass; no DB/Python/backend/transport delta/reruns. Full FixBASE7d9216d6..fd0422fb package generated. SAME original /root/recovery_task09_requirements_review resumed ONLY R9-1/R9-2 +fix-introduced Important/Critical, scope amendments preserved. No acceptance09 yet.
+ 
+ Task9 complete (BASE5a319253..source6bd1099b/reportfd0422fb; original+scoped permitted requirements/code-quality approved). Same reviewer Fix1 SpecPASS/QualityAPPROVED; FULL report root read, R9-1/R9-2 ADDRESSED/no new Important/Critical, Funnel and actual React checklist addressed. Root read actual logs/screenshots/pins; exact wholephase evidence and failures retained. Task13 owned/default lane+3fixtures+2PDFskips, dynamic public/mutation query cost unmeasured, Task8 unknown-input recapture unimplemented, R6-4 mandatory10/13, omitted Task3 security review gaps remain. No production/activation/security approval. Accepted09 fullhistory Library checkpoint next, then fresh10 immediately.
++
++Task10 ACTIVE freshsoleauthor /root/recovery_task10_implementer Astra/high forkNONE BASE6075983bd63dced95ec94dc61b9b112a79f4564d. Exactbrief/dispatch/amendments+R6-4 proposal-before-contractchange supplied. Own typedoutbox/seal/exactack newfeature ordinarycoverage, no Task3 probe/security substitution. Localonly/authornosubagents/rootdocs-only/noGitstagewhileauthoractive. Accepted09 Library6843e0ce confirmed; all10–13/finalreview/completedauthorizedrelease remain.
++
++Release readonly remote recheck duringTask10: git ls-remote origin refs/heads/main confirmed a8c4b82d95b35c0259600c19c1506faae807c3fc (matches preserved sourcebaseline); gh repo view GraphQL returned HTTPForbidden, exit1. No write/publish attempted. ExistingGitremote remains readable; finalremote exactSHA recheck required. Do not infer GitHub API write capability from shellauth.
++
++Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
++
++Connected GitHub app harmless get_repo succeeded isErrorfalse for manwithaplandy/job-board/id1278568393: main/public/notarchived; permissions push+admin/maintain/pull true, mergecommit/squash allowed, auto_mergefalse. No write occurred. Existing explicit completedrelease authorization remains; connector capabilities/read success resolve later PR/merge route despite shellGraphQLForbidden, notproofanywriteexecuted. Neverrebase/rewriteexistinghistory. Actual permittedCIinventory must land13 beforepublication.
++
++Task10 inprogress authorreported first ownedPG17 ordinaryoutbox15tests9pass6fail, genericOLDrecordfieldaccess acrossheterogeneous tables; JSONprojectionrepair+sameaffectedrerun underway. Implemented snapshotrequirements/deferredpairing/mutatorflush/deterministiccodec/exactmembership+seals/receiptack/exactversioncoverage. Operationalpreallocatedreceiptsisolated fromoldvalidate_claim insertcontract, commonordinary+criticalpendingview planned; no accepted10/greenfinal claim. AuthorACTIVE/rootnoGitstage; no omitted suites/probes.
++
++Task10 ordinary inprogress PG17.11 expanded20pass/12.69s actualoutputrootread; authorreported preallocatedsource/listing/receipts, partialpositivesfreshconnection, completedcursorresume,2successfulmisses>=24hclosure, activearchivecriticalslots→sameexactbatchack. Smallworkflow pgallocated29890227/table+toast1097728/index1605632 unchanged inactualresourceoutput; NOTgeneralMVCC/aboveguardproduction/securityguarantee. Slots notautomaticallyrecycled/missingbaseline-eventcapacityclosure rollsback, read-onlyfallback replaced. Refinements/versioncoverage/idempotency/two-sessionlatecommit/manifest/terminalcompaction+PG16/affectedlegacyintegration pending; no final10acceptance.
++
++Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evidencee3f889421fa1ad30206e128cb292b101bc3a58e0. FULLreport/commands/inventory/actual36selectedEACH17.11/16.15→7opsEACH→9batchEACH finalchanges/rootread;37uniquepermajoracrossphasesNOTonefinal37command. Lintpass/versionsactual, allfailures retained; noDBskip/securityproof. FullBASE6075983..e3f8894 packagegenerated, freshpermitted /root/recovery_task10_requirements_review Astra/highforkNONE ACTIVE. Importantphysicalcontractlimits: fixedcriticalslots1..12500/provision16default/0..100explicit,24576paddingbytes each (all307200000bytesbeforeoverhead), body<=8192/event<=12288; logicalpreallocationNOTphysicalcredit; seal/ackordinarygrowthguard maydeferaboveceiling, slotsnotautomaticallyrecycled, missingbaseline/slotsclosurerollback. Smallfixture0allocated/table/indexdelta NOTsustained/actualabove6000measurement; no refusedTask3probes. Writer/destination/baseline/operationalcoverage readiness and exporter/replay/compactperiodic orchestration pending11–13. Task10reviewnotaccepteduntilverdict; all13/finalreview/completedauthorizedreleasecontinue.
++
++Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
++
++Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
++
++Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
++
++Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
++
++Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md
+new file mode 100644
+index 0000000..ee93778
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md
+@@ -0,0 +1,15 @@
++# Final permitted whole-branch review carry-forward
++
++All13 tasks before final review and completed-release authorization. Single fresh most-capable final reviewer; complete BASEa8c4b82d..actualHEAD raw package plus exact reports/ledger. Review BOTH requirements/code quality, all parked/minor/Ruling decisions and costs. No independent Task3 expiry-enforcement/capacity/cross-user/adversarial review/probe reproduction or substitution; actual permitted CI contents must be verified before any publication. One complete correction dispatch and one scoped rereview, then explicit adjudication of residuals. No silently parked loadbearing gaps.
++
++Task6 R6-4 durable source-health/closure progress above guard mandatory, not fulfilled by HTTP-only verification; Task10 operational contract ruling precedes changes. Exact complete-feed certification and fixed-slot exhaustion/deferred reporting must be supported by ordinary evidence. Physical6000MiB guard/allheldforecasts/newidentity-growth still binding; bounded operational logical reserve is not guaranteed zero MVCC allocation or DELETEcredit. R6-5 shared public transport integrated Task8 with ordinary offline/source evidence only, no duplicate mechanism review. Task6 actualclosed_jobs summary correction remains13.
++
++Task7 admission bulk70/50 concurrent failure retained; unchanged sequential test passed17/16, load causation unproven. Task8 true unknown-input generated historical artifacts retain terminal deferral, full atomic recapture unimplemented, preserved artifacts/cachedlegacy/knownJD résumé-first usability and exact actual private inputs/receipts remain explicit. No fake historical provenance or universal availability claim.
++
++Task9 accepted permitted original+Fix1 review. History displays only selected serverpage; applied subset/page-local counts honest, successful mutations refresh bounded serverqueries. Unscored prepared/applied retained content/status readable, generation stays reviewgated. Final60affectedTS/17browser/tsc/lint0errors9inheritedwarnings, concurrent59pass1timeout retained then unchanged uncrowded60pass. Earlier193TS/6queriesEACH17.11/16.15/9reviewerEACH+30deselected are phase-specific; not sum across phases/unrestricted fullsuite. Original broad1706/1708pass4fail2PDFskips nevergreen; newfailures fixedselected, inherited2tombstone mocks+workflowDSNcount and owned/defaultVitestlane gap carried13. TwoFunnel captions and actualReactchecklist addressedFix1. Browserfakeboundary actualcomponents only, no NextSSR/auth/provider/livepipelineproof. Public120sISR removed→per-requestreads, extra mutationrefreshload/cost unmeasured; no cost-neutrality claim.
++
++Archive destination/configuration/security-sensitive activation remains separate action gate. No bucket/IAM/credential provisioning or permanentdata/object deletion automatically authorized. Flags/defaultoff/dryrun/exportinactive must be truthful at release unless exact approved configuration permits. Independent security gaps never imply assurance from tests. Final physical allocated/reusableunknown/TLS/production17.6/live24hcoverage/performance/cost readiness honest.
++
++Railway service-scoped existingGitmain autodeploy; preserve unrelateddiscovery5stagedchanges, NEVER environmentwideaccept. Redeployoldbuild notnewSHAverification; sourceconnectlive impactsallenvironments, notsafeimplicitfallback. ExactnewgitSHA/Vercelproductionaliases/Railwayaffectedservices/permittedE2E before successfulreleaseclaim. Remote maina8c4b82d readonlyconfirmed during10; ghGraphQLForbidden read recorded. Finalremote recheck needed.
++
++AllRulinglines pluscosts must survive final deliverable/recovery. Root docs/coordination only, soleauthors product/test/fixes. No historyrewrite or worktreeartifactdeletion before recoverable finalhistory/materials preserved.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+index 7cadf39..1fb8121 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+@@ -334,10 +334,34 @@ Task9 minor(deferred): analyticsFunnel 'of open' denominatorcopy shouldbe'of dis
+ 
+ Parent renewed explicit controller continuation after interim audit handoff: continue9–13/finalreview/authorizedcompletedrelease, coordinate EXISTINGauthor notduplicate. Collaboration now shows /root/recovery_task09_implementer pending_init; followup_task resumes its EXISTING ONEFix1, preserves3dirtytests/completeTWO R9findings/fullFixBASE7d9216d6. No confirmed separate accessiblecontrollerthread; root retainscoordination, earlierpause notcompletion. Latestaccepted08Library2567; latestcommittedreviewedUNACCEPTEDfullhistoryLibrary ba5612b39fe88191946530bc1d280999 through08922f4 (xattrs appliedsameexec), counterpart earlier54f0e252...through25e4a2e alsoinCURRENT; neitherincludesdirtyFix1. No executorreplacement/completedstage/testduplication or prohibitedreviewretry. Awaitexistingauthorphase/result, SAMEscopedreviewthenLibrary09, freshauthors10–13. RootnoGitstagewhileauthoractive.
+ 
+ ExistingTask9Fix1authorconfirmedactiveunderthiscontroller; preserves3dirtytests/no duplicatework. R9-1/R9-2+Funnelcopy GREENauthorreported60tests8affectedcomponent/UIcontractfiles;tsc0/lint0errors9inheritedwarnings. NarrowinstalledChromiumfakebrowser17assertions includesdisjointhistory/appliedpools+actualunscoredprepared/appliedartifacts/answers/status;no externalrequests/errors.5initialREDfailures+duplicate-description/fixturetype/captionformat attemptsretained. ActualReactchecklist/report/sourcepinpreparation ongoing; no DB/Python/transportchanges/reruns/blocker. No Task9acceptanceuntilrootactualevidence/fullFixBASErange/SAMEreviewerscopedgate/Library09. RootnoGitstagewhileauthoractive.
+ 
+ Task9 Fix1 author DONE/STOP: source6bd1099b4338cd154e8f1360db1e87fbe6fc2dae/reportfd0422fb8e5dab1ee006d87dcb992bcb13c4e9e2. Root read full report/actual outputs and prepared-status screenshot:60affectedTS8files/tsc0/lint0errors9warnings/17fakebrowserassertions, retained concurrent59pass1timeout then identical uncrowded60pass; no DB/Python/backend/transport delta/reruns. Full FixBASE7d9216d6..fd0422fb package generated. SAME original /root/recovery_task09_requirements_review resumed ONLY R9-1/R9-2 +fix-introduced Important/Critical, scope amendments preserved. No acceptance09 yet.
+ 
+ Task9 complete (BASE5a319253..source6bd1099b/reportfd0422fb; original+scoped permitted requirements/code-quality approved). Same reviewer Fix1 SpecPASS/QualityAPPROVED; FULL report root read, R9-1/R9-2 ADDRESSED/no new Important/Critical, Funnel and actual React checklist addressed. Root read actual logs/screenshots/pins; exact wholephase evidence and failures retained. Task13 owned/default lane+3fixtures+2PDFskips, dynamic public/mutation query cost unmeasured, Task8 unknown-input recapture unimplemented, R6-4 mandatory10/13, omitted Task3 security review gaps remain. No production/activation/security approval. Accepted09 fullhistory Library checkpoint next, then fresh10 immediately.
+ 
+ Checkpoint09 CONFIRMED Librarylibfile_6843e0ce183c8191a275f204e747c78d /file_000000003638821090268ef9b20fce0a v0/xattrs SAMEexec; verified completehistory4785080388b945e8408a3fedb0b4eb86e89a03be /workspace/scratch/job-board-lifecycle-recovery-checkpoint-09.bundle. Accepted permitted review, no security/fullrelease claim. Next freshsoleTask10 Astra/high forkNONE actualforwardBASE; minimal R6-4 operational contract report REQUIRED before anyguardchange.
++
++Task10 ACTIVE freshsoleauthor /root/recovery_task10_implementer Astra/high forkNONE BASE6075983bd63dced95ec94dc61b9b112a79f4564d. Exactbrief/dispatch/amendments+R6-4 proposal-before-contractchange supplied. Own typedoutbox/seal/exactack newfeature ordinarycoverage, no Task3 probe/security substitution. Localonly/authornosubagents/rootdocs-only/noGitstagewhileauthoractive. Accepted09 Library6843e0ce confirmed; all10–13/finalreview/completedauthorizedrelease remain.
++
++Release readonly remote recheck duringTask10: git ls-remote origin refs/heads/main confirmed a8c4b82d95b35c0259600c19c1506faae807c3fc (matches preserved sourcebaseline); gh repo view GraphQL returned HTTPForbidden, exit1. No write/publish attempted. ExistingGitremote remains readable; finalremote exactSHA recheck required. Do not infer GitHub API write capability from shellauth.
++
++Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
++
++Task10 inprogress authorreported first ownedPG17 ordinaryoutbox15tests9pass6fail, genericOLDrecordfieldaccess acrossheterogeneous tables; JSONprojectionrepair+sameaffectedrerun underway. Implemented snapshotrequirements/deferredpairing/mutatorflush/deterministiccodec/exactmembership+seals/receiptack/exactversioncoverage. Operationalpreallocatedreceiptsisolated fromoldvalidate_claim insertcontract, commonordinary+criticalpendingview planned; no accepted10/greenfinal claim. AuthorACTIVE/rootnoGitstage; no omitted suites/probes.
++
++Task10 ordinary inprogress PG17.11 expanded20pass/12.69s actualoutputrootread; authorreported preallocatedsource/listing/receipts, partialpositivesfreshconnection, completedcursorresume,2successfulmisses>=24hclosure, activearchivecriticalslots→sameexactbatchack. Smallworkflow pgallocated29890227/table+toast1097728/index1605632 unchanged inactualresourceoutput; NOTgeneralMVCC/aboveguardproduction/securityguarantee. Slots notautomaticallyrecycled/missingbaseline-eventcapacityclosure rollsback, read-onlyfallback replaced. Refinements/versioncoverage/idempotency/two-sessionlatecommit/manifest/terminalcompaction+PG16/affectedlegacyintegration pending; no final10acceptance.
++
++Task10 authorcurrentinventory14publictableprojections; lifecycle_write pairsnewidentity/reconcile/catalogmutations, unchangedmetadata/privatecacheuse noevents. Legacydb/companydiscoveryeventfuldirectwriters remainfailclosedarchiveactive; readinessexplicitblocked, Task13mustaccountactualruntimewriter/mode compatibility. ExactversionID/listing/revision/hashcoverage replaceswatermark.30PG17phasepass actualrootread, finalpairedpins/legacyflow stillpending.
++
++Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evidencee3f889421fa1ad30206e128cb292b101bc3a58e0. FULLreport/commands/inventory/actual36selectedEACH17.11/16.15→7opsEACH→9batchEACH finalchanges/rootread;37uniquepermajoracrossphasesNOTonefinal37command. Lintpass/versionsactual, allfailures retained; noDBskip/securityproof. FullBASE6075983..e3f8894 packagegenerated, freshpermitted /root/recovery_task10_requirements_review Astra/highforkNONE ACTIVE. Importantphysicalcontractlimits: fixedcriticalslots1..12500/provision16default/0..100explicit,24576paddingbytes each (all307200000bytesbeforeoverhead), body<=8192/event<=12288; logicalpreallocationNOTphysicalcredit; seal/ackordinarygrowthguard maydeferaboveceiling, slotsnotautomaticallyrecycled, missingbaseline/slotsclosurerollback. Smallfixture0allocated/table/indexdelta NOTsustained/actualabove6000measurement; no refusedTask3probes. Writer/destination/baseline/operationalcoverage readiness and exporter/replay/compactperiodic orchestration pending11–13. Task10reviewnotaccepteduntilverdict; all13/finalreview/completedauthorizedreleasecontinue.
++
++Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
++
++Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
++
++Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
++
++Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
++
++Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
+index c6a0721..16dc219 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
+@@ -51,10 +51,14 @@ were made. Vercel deployments-cicd skill read; existing Git workflow preferred.
+ 
+ Vercel current production deployment resolved read-only: dpl_ARhsncvQVGE4ykLerrdcj6gZVd4B,
+ READY/production, metadata githubCommitSha a8c4b82d95b35c0259600c19c1506faae807c3fc
+ (matches reconstruction base). URL job-board-dashboard-blesz20rv-andrews-projects-ecc12687.vercel.app.
+ Domains include jobs.andrewmalvani.com and job-board-dashboard-mu.vercel.app.
+ get_deployment(withGitRepoInfo=true) returned commit via meta; gitSource was absent,
+ so no assertion about a gitSource field. This is baseline state only; recheck
+ new exact commit and deployed domains after completed release.
+ 
+ Additional read-only release preflight: Railway whoami succeeded for BOTH configured links, exposing only sanitized actorID; both resolve same actor f9a98432-9fa9-4a45-96e0-384633f9667d and priorlistprojects showed same intendedproject. They are duplicate connections to the same account, not evidenceof distinctaccount ambiguity; futurewrites stillverifyexacttarget/link. No profileemail/name/credentialsprinted/saved. Currenttooldeclaration connect_service_source: livechange ALWAYSappliesallsourcenvironments; environmentIdonlyvalidstaged; commitShapin stopsbranchfollowinguntilreconnectedwithoutpin. Therefore not a safe implicitproduction-only deployfallback; preserve existingGitmainautodeploy workflow and unrelateddiscoverystagedpatch, no live sourcechange/no broadaccept. Redeployreusesoldbuild anddoesnotproveexactnewcommit. No writesperformed.
++
++Release readonly remote recheck duringTask10: git ls-remote origin refs/heads/main confirmed a8c4b82d95b35c0259600c19c1506faae807c3fc (matches preserved sourcebaseline); gh repo view GraphQL returned HTTPForbidden, exit1. No write/publish attempted. ExistingGitremote remains readable; finalremote exactSHA recheck required. Do not infer GitHub API write capability from shellauth.
++
++Connected GitHub app harmless get_repo succeeded isErrorfalse for manwithaplandy/job-board/id1278568393: main/public/notarchived; permissions push+admin/maintain/pull true, mergecommit/squash allowed, auto_mergefalse. No write occurred. Existing explicit completedrelease authorization remains; connector capabilities/read success resolve later PR/merge route despite shellGraphQLForbidden, notproofanywriteexecuted. Neverrebase/rewriteexistinghistory. Actual permittedCIinventory must land13 beforepublication.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
+new file mode 100644
+index 0000000..7ca28ca
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
+@@ -0,0 +1,63 @@
++# Controller rulings — current working inventory
++
++Draft for final deliverable; refresh after later tasks/final review. Original source lines retained with provenance and stated costs; no new policy authorization.
++
++[progress.md:109]
++
++Task4 Ruling: permit narrow nested-IF SQL correctness repair in existing lifecycle_staging_fence — ordinary enumeration_members INSERT fixture raises UndefinedColumn because combined table-name/generation expression dereferences nonexistent NEW.generation; nest generationcomparisononlyinside reconciliation_checkpointsbranch, preservingcomparison/fencepolicy — costs if wrong: staging workflow regression requiringrework, no securityapproval implied. This is authorizedordinaryfeaturecorrectness under amendment, not refused expiry/capacity/cross-userreview. Authoradd normalmemberINSERT+matchingcheckpointcases17/16; noadversarialprobes/fencedisabling.
++
++[progress.md:147]
++
++Task6 Ruling: preserve existing physical/accounting interfaces; allow bounded above-guard read-only full-feed verification with truthful healthy-but-storage-blocked/reconciliation-deferred outcomes and no absence certification — lifecycle_validate_row charges changed source_accounts/source_listings/source_enumerations rows as growth, reserve_capacity refuses forecasts above 6000 MiB, and claim_work refuses a first source claim there. Do not weaken these interfaces or reproduce the refused review/probes. Keep flag-off PR16 closure above guard. Enforced durable operational/reconciliation progress remains an unresolved FUNCTIONAL/ROLLOUT issue for Task10/13 and final permitted review, not a fulfilled requirement or security approval — cost if wrong: repeated feed checks without durable health/cursor/closure progress above the ceiling; downstream integration rework and activation must remain gated on an explicit resolution. Ordinary tests must demonstrate actual feed attempt, healthy outcome distinct from source failure, no false absence, and fair permitted attempts. Any smallest ordinary no-growth contract repair must be reported concretely before change.
++
++[progress.md:161]
++
++Task6 Ruling: authorize additive ordered SQL ownership-only handoff for complete-unreconciled enumeration to a currently validated newer SAME-SOURCE claim, preserving enumeration id/source/sequence/completed membership/start/completion times and checkpoint cursor, updating checkpoint generation atomically — existing lifecycle_staging_fence rejects any owner/generation change and therefore cannot satisfy required fresh-worker scheduledresume after terminalclaim; existing claim/lease/capacity/role/owner validation remains unchanged, no GUC/privilege bypass — cost if wrong: checkpoint/membership consistency regression requiring rework; ordinary handoff sourcecontract review/tests are required, no independent security approval implied. Author report concrete conflict/readschema confirmed; originalR6-1/2/3 Fix1 continues.
++
++[progress.md:171]
++
++Task6 Fix1 Ruling: extend R6-3 ordinary positive-preservation repair narrowly to Workable's whole-response validate_ids (author identified same lost-good-positive behavior outside initial three named adapters) — all-six trustworthy-positive requirement remains binding; preserve existing minimal/detail fallback and incomplete certification for duplicate/missing-ID feeds, add focused Workable/completeness17/16 after change without repeating unaffected broad lanes — cost if wrong: Workable parser/legacycompatibility regression requiring scoped rework. Any analogous paged same-page loss must be reported concretely before further expansion. InitialFix1expanded17lane97passed includes source/run/threeadapters+orderedmigrationcatalog/idempotency; laterchangedsourceevidence must remain chronological and accurately scoped. No securitymechanismreview/probes or productioncalls.
++
++[progress.md:173]
++
++Task6 Fix1 Ruling: authorize analogous narrow mixed-page positive preservation in SmartRecruiters (wholepage any(non-dict) raise beforeyield) and Workday (_page_walk item.get prepass/firstpagepartition_ids dereference beforeyield) — latermalformednon-object cannotdiscard priortrustworthy samepageidentities; preserve rawpagination/counts and existingdup/wrap/changed-total conservativecertification, incomplete/failedoutcome and nofalseabsence — cost if wrong: pagedsource cursor/count regression requiring scopedrework; ordinary mixedvalid/non-object fixtures and selectedaffectedpaged/completeness17/16 required, no unaffectedmigration/run reruns or broaderrewrite. OriginalR6-3 allsixfunctionalpositivepreservation scope; not refusedadversarialreview/probes. All threeauthorreportedconcretebranches recorded beforeauthor expansion.
++
++[progress.md:183]
++
++Task6 Ruling: checkpoint and advance the independently reviewed source/recovery portion as a CONDITIONAL DEVELOPMENT milestone, scheduling the still-required sharedtransport integration inTask8/9 and aboveguard durable operational contract inTask10/13 — those existing sharedinterfaces are explicit plan sequencing conflicts, while Task7leanadmission can use reviewed belowguard sourceidentity/completeness without assuming those guarantees; preserve R6-4/R6-5 as loadbearing FINAL INTEGRATION BLOCKERS and never claim fullTask6spec/release acceptance before resolution — cost if wrong: downstream admission/cutover integration rework; release/activation readiness cannot claim the missing guarantees. This transfers unresolvedrequirements transparently, not waives them or evades review; finalwholebranchreview must verify concrete resolution or report remaining blockers. OriginalTask3securityreviewgapsremain deliberatelyunreviewed underAndrewamendment.
++
++[progress.md:211]
++
++Task7 Fix1/5 Ruling: preserve pre-cutover legacy description/detail capture through established service-owned controls and durable sticky cutover, with write-time recheck under the existing gate; new source admission stays lean. No new flags, guard relaxation or privilege bypass. Cost if wrong: legacy reviews stall or passive payload growth resumes after cutover, requiring scoped compatibility rework. Same original author /root/recovery_task07_implementer ACTIVE; full original finding supplied; product FixBASE1f897475023a50fa029def5a5e9e016ded794a8b, intervening controller-only HEADb50555ff302cee6a64e45ff795de180dcc3af159. Require real new legacy Job through actual reviewer/provider double plus relevant prepare/generate coverage, selected affected owned17/16 lanes, no unaffected eight-minute source rerun or refused Task3 probes. Same original reviewer receives scoped R7-1 and fix-introduced Important/Critical review after DONE.
++
++[progress.md:239]
++
++Task8 provisional Ruling: use narrowly typed service-owned claim/reservation acquisition/binding INSIDE existing allowlisted db module and samebackendTX before originalauthenticated privateDML, avoiding newSQLauthenticatedgrants/privilegeduserJobDML — why: preservesexisting servicecapability contract and authenticatedRLS callers withoutweakening guards — costifwrong: actualclaimidentity/transaction/receipt mismatch requires scopedfunctionalrework; no independent mechanism/securityassurance claimed. Authormustinspectexactfit/reportmismatchbeforeanycontractchange, preserveoriginalrole/JWT/DBtime/gate/sortedkeys/conservativeforecast/settlement. No genericarbitrarypublicSQLhelper, no safeguardreview/proberetry. Hydration own-demand protection conflict resolvesimmutable demand snapshots/retainedprotectedsharedcache; functionalconsumerflowstillrequired, failclosedreadinessalone notfulfillment.
++
++[progress.md:249]
++
++Task8 confirmedconcretelegacygap: requestJobPayload returnslegacy immediatelywithhydrationflagfalse; missingGHquestions preparethenpendinghasnoqueuedwork. Ruling: explicitowner demand usesexistinglegacy-compatible pre-cutoverserviceprocessing evenwithhydrationflagoff, cachedlegacyflowremainsusable — why: consumerproducersequencing withgenuinerequesteddemand, notpassivefill/newactivationflag/shareduserDML — costifwrong: defaultoffconsumerworkerreadiness mismatch requiring scopedrework. Afterdurablestickycutover+disabledhydration honestpaused/pending; no unsafelegacyfallback. Require actualworkerorchestration flagoffmissingquestions→queuedserviceprocessing→durablesnapshot→preparereadiness pluszerocharge/providerwhilepending, affected17/16+narrowprepareafterfix only. PreserveHTTPoutsidegate/claims/reservations/genuineuse; no guardchange/prodactivation/refusedmechanismprobe. AuthorimplementingpreDONEcorrection, no acceptanceclaim.
++
++[progress.md:257]
++
++Task8 authorconfirmedlegacyproducer→mappergap: db.upsert_jobs createsJobwithoutSourceListing; migrate_identity_batch hasno runtimecaller. Ruling: existingservicemapper may acceptboundedexactjob_ids for explicitprecutoverdemands — why: actualproducerconsumeridentitybridgewithpreservedIDs/provenance, noparallelfalsemapping — costifwrong: mappercursor/provenanceregression requiring scopedrework. Defaultmapperunchanged/<=500/sortedjoblocks/globalgate, targetedcallmustnotadvance/resetglobalcursor ormarkfullreadinesscompletefromsubset, bypassunrelatedglobalcursorforexactmissingrequestedJob. Preserveactivationcaptureprovenance/lastuseNULLuntilconsume; nolegacyshortcutpoststickycutover. Actuallegacydb.upsert_jobs→assertnolisting→ownerrequest→serviceworker maps+durablesnapshotfixture17/16 anddirectaffectedmappercase required; no fulloldsecuritysuite. AuthorpreDONEfix underway; no newgrant/guard/prodaction.
++
++[progress.md:271]
++
++Task8Fix1 authorreportedconcretepackagecontract: oneprivatenullableJD/version/Qbundle,publicversionomitsQidentity,nopersistedsourcedemandID. MissingQfirstacquisition canuseexistingCOALESCEwithoutguard/schema/grantchange; noprivateimmutabletriggerblocksNULL→firstQ. Ruling: no newpersistedpackage-demandID required ifsavedfullinputbundleauthoritative andexactactualownedsourceID/kind/tuplecarriedthroughconsumption — why: smallestfitexistingstoragewithhonestfirstQacquisitionpreservingknownJD/version — costifwrong: output/input/receiptlineage mismatchrequiresscopedrework. Subsequentregenerationcannotreselectnewestd.* merelysameversionorrelabelfetchedkind; persistence locks/rechecksfullknowninputs, permitsonlyNULL→firstQ, rejects mismatchatomically; receipt updatesexactID/user/job/version/actualkind/actualinputtupleONLYconsumedrow. PreserveoriginalJDcapturetime+actualnewQprovenance/no claimQpreviouslyusedbyresume; unknownlegacyartifactsremainNULL/independentsnapshotunlessdeliberatelyregeneratedfromknowninputs. Ifoldoriginreceiptgone reportconcreterecoverycontract, neverinventidentity orstampotherrow. Requiredordinaryresume-firstpending→Qworker→ready/output +sameversiondifferentQ/exactreceipt fixtures, no mechanismprobes.
++
++[progress.md:275]
++
++Task8Fix1 exactoriginreceiptretention recovery Ruling: explicitservicecapture fromexact retainedownedpackage isvalid whenoriginreceiptgone — why: newreal durablecopyID/time withknownsavedinput, notreconstructionofoldhistory — costifwrong: capsule/sourceprovenanceambiguityrequiresscopedrework. Preserveoriginalpackagecapturetime/tuple, newcapturetimehonestprivatecopy,no sourceverification/sighting/reopen/anchor/publicversionrewrite,useonlyafteractualconsumer; existingserviceclaims/reservations/ownerverification, explicitcopyprovenance. MissingQfetchoutsideTX preservesknownJD/version+firstQ. Requiredretainedpackage/noorigin-demand→newcopy→exactreceiptfixture.
++
++[progress.md:277]
++
++Task8Fix1 legacyunknownpackage+missingQ conflict: onebundlecannottruthfullyassignnewsource toretainedoldoutputlegs; existingpreparepartialsuccesspreservesoldcover. Ruling: preserveunknownprovenance/existingartifacts; explicitterminaldeferred acceptedasR8-1alternative insteadfalsepending/retrofit — why: nohistoricalexactinputandpartialnewgenerationmixeslegs — costifwrong: legacypreparationavailabilitylimitrequiresfullrecaptureworkflowrework. Messageactionable/honest, existingartifactsavailable, identifyfullinputrecaptureprerequisite; no nonexistentworkingbutton/promise. Authormustcheckexistingexplicitfullregenerate trulyreplacesALLmateriallegs successatomicallybeforeclaimingavailable recovery. Ifnot, reportrecaptureunimplemented/functionalavailabilitylimitandpreserveddata; no newguard/grant/resetfeaturetoburygap. Requiredunknownlegacyterminal/noenqueue/provider/charge +cachedlegacyusable fixtures. Finalpermittedreviewmustseeactualavailabilitylimit/recoverypath, no blanketfullfunctionalityclaim/automaticwaiver. Known-JD résumé-firstfullqueuedflow remainsmandatory.
++
++[progress.md:303]
++
++Task9 Ruling: narrow additive read-only public lifecycle projection/predicate helper for role-scoped board queries — why: withAnonSql/withUserSql preserved while source_listings/control remain service-only; ordinary public feed needs derived lifecycle display/predicate fields — cost if wrong: excessive operational metadata exposure or per-row query cost; require minimal fixed schema-qualified SELECT/safe search_path, no dynamicSQL/private data/control internals/DML/bypass/underlyingtablegrants/serviceSql board escape. Expose only publicJobidentity+necessary deriveddiscovery/source/payloadfields/derivedflagbehavior. Preserve flagoffanon/missingmappinghonesty, additiveSQL/schema parity and ordinary realrole querycoverage. Local reviewableimplementation only, NOTproductiongrant/activation/independentsecurityapproval; no omittedmechanism/adversarialprobes. Author reported dashboard/AGENTS absent, reads dashboard/CLAUDE instead. Task9active; rootnoGitstage duringauthorwork.
++
++[progress.md:349]
++
++Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/commands.md
+new file mode 100644
+index 0000000..d55614d
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/commands.md
+@@ -0,0 +1,21 @@
++# Actual Fix1 command chronology
++
++All shell execution used `/bin/bash`, `login:false`, worktree `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. The owned harness created random loopback PG containers from existing local images and cleaned up only its own containers. No shared 55432, provider/production connection, credentials, activation, external object write, or excluded Task3 probe.
++
++The seven initial regression tests were written and inventoried before running them against the reviewed Task10 behavior. Command: `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix1.py -q`, redirected to `red17.txt`: **7 failed**, each matching its corresponding Important finding. This was the pre-fix RED evidence, not a passing phase.
++
++The same scoped file command produced these development logs as source/tests evolved:
++
++- `development17.txt`: collection error, missing pytest import after initial lint removed the then-unused import; restored before running expanded cases.
++- `development17b.txt`: 15 passed, 1 failed; fixture classification_source='fixture' violated existing allowed values; corrected to 'job'.
++- `selection17.txt`: the 56-case then-current affected selection (exact original node list in `selection.txt`) gave 55 passed, 1 failed; fixture size='small' violated existing size values; corrected to '11-50'.
++- `development17c.txt`: 1 passed, 19 setup errors. New PL/pgSQL comparison with unparenthesized CASE was invalid; replaced with an explicit oldraw JSON value. Complete failure output retained.
++- `development17d.txt`: 21 passed on PG17.11. Subsequent ordinary pair-failure and UTC-day tests and persisted schema/date validation are covered by the final runs, not retroactively credited to this phase.
++
++Development source snapshots were evolving and are not final source pins. The final source SHA256 inventory is `source-files.sha256`, captured after final formatting and before either final run, and checked again before the source commit. No source edits occurred during final verification. Final exact test argv are `final17.command.txt` and `final16.command.txt`; `final-selection.json` and `selection-final.txt` contain the complete enumerated selection. Harness/server versions and actual results are in `final17.txt`/`final16.txt`; exit codes in the adjacent `.exit.txt` files.
++
++Final lint command:
++```
++.venv/bin/ruff check job_discovery/archive job_discovery/lifecycle/errors.py job_discovery/lifecycle/operational.py job_discovery/lifecycle/reconcile.py job_discovery/lifecycle/identity.py company_discovery/db.py company_discovery/enrich_apply.py company_discovery/jobs_db.py company_discovery/name_backfill.py company_discovery/run.py company_discovery/worker.py job_discovery/db.py job_discovery/locations.py job_discovery/run.py tests/test_archive_fix1.py tests/test_archive_batches.py tests/test_archive_outbox.py tests/test_lifecycle_operational.py tests/archive_helpers.py
++```
++`lint-final.txt` records all checks passed. Initial lint output (one import-placement error, three unused imports fixed) and formatting outputs are retained. Migration parity checked that each complete Task10 migration appears verbatim in schema.sql. `git diff --check` completed with no output. `versions.json` records the local runtime versions; image pins below are harmless local Docker inspect output.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17.txt
+new file mode 100644
+index 0000000..9fb8ae7
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17.txt
+@@ -0,0 +1,12 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++
++==================================== ERRORS ====================================
++_________________ ERROR collecting tests/test_archive_fix1.py __________________
++tests/test_archive_fix1.py:152: in <module>
++    @pytest.mark.parametrize('boundary',['chunk','final_reconcile'])
++     ^^^^^^
++E   NameError: name 'pytest' is not defined
++=========================== short test summary info ============================
++ERROR tests/test_archive_fix1.py - NameError: name 'pytest' is not defined
++!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
++1 error in 0.38s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17b.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17b.txt
+new file mode 100644
+index 0000000..bc7580f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17b.txt
+@@ -0,0 +1,58 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++...........F....                                                         [100%]
++=================================== FAILURES ===================================
++_______ test_fix1_current_candidate_classification_name_location_writers _______
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33071 user=postgres database=poller_lifecycle_test) at 0x7f4de372cce0>
++
++    @requires_db
++    def test_fix1_current_candidate_classification_name_location_writers(conn):
++        from types import SimpleNamespace
++        from company_discovery.dataset import Candidate
++        from company_discovery.db import upsert_candidates
++        from company_discovery.jobs_db import apply_classification
++        from company_discovery.name_backfill import apply_name
++        from job_discovery.locations import _insert_unmappable,correct_location
++        activate_fixture(conn)
++        upsert_candidates(conn,[Candidate('Fixture','lever','fixture')])
++        conn.commit()
++        cid=conn.execute('SELECT id FROM companies').fetchone()['id']
++        apply_name(conn,cid,'Public Name')
++>       apply_classification(conn,cid,SimpleNamespace(industry='software',industry_subcategory='infrastructure',size='small',hq_country='US',tech_tags=[],red_flags=[],confidence='high'),model='offline',source='fixture')
++
++tests/test_archive_fix1.py:193: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++company_discovery/jobs_db.py:170: in apply_classification
++    cur.execute(
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [INERROR] (host=127.0.0.1 port=33071 user=postgres database=poller_lifecycle_test) at 0x7f4de2b4c710>
++query = '\n            UPDATE companies SET\n              industry = %s, industry_subcategory = %s, size = %s, hq_country = %... classified_at = now(), classification_model = %s, classification_source = %s\n            WHERE id = %s\n            '
++params = ('software', 'infrastructure', 'small', 'US', Json([]), Json([]), ...)
++prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.CheckViolation: new row for relation "companies" violates check constraint "companies_classification_source_check"
++E           DETAIL:  Failing row contains (1, Fixture, lever, fixture, t, dataset, 2026-10-07 21:50:50.040423+00, Public Name, null, null, null, null, null, software, infrastructure, small, US, [], [], high, 2026-10-07 21:50:50.161456+00, offline, fixture, 0).
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: CheckViolation
++=========================== short test summary info ============================
++FAILED tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
++1 failed, 15 passed in 9.47s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17c.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17c.txt
+new file mode 100644
+index 0000000..e93ccc0
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17c.txt
+@@ -0,0 +1,822 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++EE.EEEEEEEEEEEEEEEEE                                                     [100%]
++==================================== ERRORS ====================================
++_ ERROR at setup of test_fix1_operational_miss_normal_positive_operational_miss _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715df10>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_____ ERROR at setup of test_fix1_membership_and_seal_add_to_live_forecast _____
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715e690>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_______ ERROR at setup of test_fix1_actual_seed_and_company_writer_pair ________
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715de50>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_baseline_has_recorded_and_unknown_observed_time __
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715dfd0>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++________ ERROR at setup of test_fix1_seal_layout_and_complete_manifest _________
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f050>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f7d0>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_____ ERROR at setup of test_fix1_normal_miss_then_operational_miss_closes _____
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715fb90>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_normal_positive_before_operational_resume_invalidates_absence _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715ff50>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[chunk] _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f710>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[final_reconcile] _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f950>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_current_candidate_classification_name_location_writers _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715d910>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++__________ ERROR at setup of test_fix1_writer_rollback_and_flags_off ___________
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715e8d0>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_observation_time_distinct_from_database_recording _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f6d24590>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++______ ERROR at setup of test_fix1_all_manifest_identity_fields_validated ______
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f6d24a10>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_logical_small_row_forecasts_and_warning_predicate _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f7d0>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_retirement_preserves_version_coverage_and_pending_batch _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715e5d0>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_critical_observation_and_recording_survive_seal __
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715f050>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f715fc50>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++_ ERROR at setup of test_fix1_version_mutator_preserves_its_explicit_observation _
++
++    @pytest.fixture
++    def conn():
++        assert TEST_DSN, "TEST_DATABASE_URL required"
++        validate_test_dsn(TEST_DSN)
++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
++        try:
++            with connection.cursor() as cur:
++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
++>               cur.execute(SCHEMA_SQL)
++
++tests/conftest.py:119: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [BAD] at 0x7fa7f6d24710>
++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...UNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();\n'
++params = None, prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.SyntaxError: syntax error at end of input
++E           LINE 2964: ...seen_at' IS DISTINCT FROM CASE WHEN TG_OP='INSERT' THEN NULL...
++E                                                                           ^
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
++=========================== short test summary info ============================
++ERROR tests/test_archive_fix1.py::test_fix1_operational_miss_normal_positive_operational_miss
++ERROR tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
++ERROR tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair
++ERROR tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time
++ERROR tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest
++ERROR tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue
++ERROR tests/test_archive_fix1.py::test_fix1_normal_miss_then_operational_miss_closes
++ERROR tests/test_archive_fix1.py::test_fix1_normal_positive_before_operational_resume_invalidates_absence
++ERROR tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[chunk]
++ERROR tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[final_reconcile]
++ERROR tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
++ERROR tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off - p...
++ERROR tests/test_archive_fix1.py::test_fix1_observation_time_distinct_from_database_recording
++ERROR tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated
++ERROR tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate
++ERROR tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch
++ERROR tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal
++ERROR tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer
++ERROR tests/test_archive_fix1.py::test_fix1_version_mutator_preserves_its_explicit_observation
++1 passed, 19 errors in 7.85s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17d.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17d.txt
+new file mode 100644
+index 0000000..e7731e0
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/development17d.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.....................                                                    [100%]
++21 passed in 23.39s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final-selection.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final-selection.json
+new file mode 100644
+index 0000000..6954398
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final-selection.json
+@@ -0,0 +1,17 @@
++[
++  "tests/test_archive_codec.py",
++  "tests/test_archive_outbox.py",
++  "tests/test_archive_batches.py",
++  "tests/test_lifecycle_operational.py",
++  "tests/test_archive_fix1.py",
++  "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
++  "tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay",
++  "tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset",
++  "tests/test_lifecycle_reconcile.py::test_empty_threshold",
++  "tests/test_lifecycle_relations.py",
++  "tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle",
++  "tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps",
++  "tests/test_locations_resolution.py::test_manual_correction_propagates_on_restamp",
++  "tests/test_classification_jobs_db.py::test_apply_classification_stamps_all_columns",
++  "tests/test_classification_jobs_db.py::test_apply_classification_empty_lists_persist_as_json"
++]
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.command.txt
+new file mode 100644
+index 0000000..9fd73f3
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.command.txt
+@@ -0,0 +1 @@
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/test_archive_fix1.py tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset tests/test_lifecycle_reconcile.py::test_empty_threshold tests/test_lifecycle_relations.py tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps tests/test_locations_resolution.py::test_manual_correction_propagates_on_restamp tests/test_classification_jobs_db.py::test_apply_classification_stamps_all_columns tests/test_classification_jobs_db.py::test_apply_classification_empty_lists_persist_as_json -q -s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.exit.txt
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.exit.txt
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.txt
+new file mode 100644
+index 0000000..bfa5f08
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final16.txt
+@@ -0,0 +1,4 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++.......................ordinary operational resource evidence {"after": {"allocated": 41032727, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "before": {"allocated": 41032727, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
++...........................................
++66 passed in 120.18s (0:02:00)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.command.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.command.txt
+new file mode 100644
+index 0000000..75ecbd1
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.command.txt
+@@ -0,0 +1 @@
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/test_archive_fix1.py tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset tests/test_lifecycle_reconcile.py::test_empty_threshold tests/test_lifecycle_relations.py tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps tests/test_locations_resolution.py::test_manual_correction_propagates_on_restamp tests/test_classification_jobs_db.py::test_apply_classification_stamps_all_columns tests/test_classification_jobs_db.py::test_apply_classification_empty_lists_persist_as_json -q -s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.exit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.exit.txt
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.exit.txt
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.txt
+new file mode 100644
+index 0000000..25fd561
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/final17.txt
+@@ -0,0 +1,4 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.......................ordinary operational resource evidence {"after": {"allocated": 40711859, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "before": {"allocated": 40711859, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
++...........................................
++66 passed in 110.76s (0:01:50)
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final.txt
+new file mode 100644
+index 0000000..cb185d9
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final.txt
+@@ -0,0 +1 @@
++2 files reformatted
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final2.txt
+new file mode 100644
+index 0000000..cb185d9
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format-final2.txt
+@@ -0,0 +1 @@
++2 files reformatted
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format.txt
+new file mode 100644
+index 0000000..11560e8
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/format.txt
+@@ -0,0 +1 @@
++9 files reformatted, 3 files left unchanged
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/image-pins.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/image-pins.txt
+new file mode 100644
+index 0000000..d861d77
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/image-pins.txt
+@@ -0,0 +1,4 @@
++postgres:17 image sha256:327daa8fae7178d61f93142f146b098467b345e10997b9eb79f63bd58e5c8f3c
++RepoDigest postgres@sha256:ae69c452f483507a6b99fb654cf93aad7fe156ffd2c56247707eef4e36d3c12b
++postgres:16 image sha256:275447c94b11b151decd1f29877965301d5a77032037c46de93d990f739f00a9
++RepoDigest postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/inventory.md
+new file mode 100644
+index 0000000..133cd70
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/inventory.md
+@@ -0,0 +1,11 @@
++Before RED execution: tests/test_archive_fix1.py only. Seven ordinary new contracts: operational/normal lane positive resets shared misses; membership/seal increases new logical live archive forecast; ArchiveBlocked is a storage-deferred outcome; actual offline seed/enrichment writer pairing; honest baseline observed/recorded UTC fields; deterministic seal-day/hash-key/manifest schema; acknowledged-only terminal receipts/catalogue retirement preserving coverage. Small owned random-loopback PG17. No omitted Task3 physical accounting, expiry, isolation, GUC/role/adversarial probes; no provider/network calls. Additional scoped fixtures will be inventoried before GREEN selection.
++
++Expanded inventory before development PG17 run: tests/test_archive_fix1.py now adds normal→operational miss closure, true positive before resumed cursor, actual source entrypoint archive exception at chunk and final reconcile boundaries (offline adapter only), current seed/candidate/enrichment/classification/name/location/manual correction transactions, rollback/flags-off, explicit observation/recording time, all immutable manifest identities, small-row logical charge arithmetic/warning/membership forecast. These are ordinary new-feature tests, no old Task3 capacity/security/enforcement suite or substitute. Development selection is this file only; source mocks are at archive exception boundaries, not physical guard.
++
++Final candidate inventory additions: bounded acknowledged-terminal retirement with exact version coverage and an untouched pending batch; critical operational events retain distinct observed/DB-recorded UTC times through seal/recovery; no configured destination and unsupported post-cutover legacy job writer report deferred before DML. Full affected selection includes previous Task10 codec/outbox/batches/operational files (38 ordinary cases after marker expectation updates) and only previously approved admission actual-source entrypoint, reconcile two-miss/partial-positive/empty-threshold node IDs, and relations file. Final test node list will be recorded with collection before execution; no mechanism/security/activation/old capacity files are selected.
++
++Additional timestamp case before execution: actual capture_version supplied an explicit earlier aware observation; both version and listing projection events retain it while DB recorded time differs. Current test selection collects 57 tests after this addition (37 original + 20 Fix1 ordinary cases). Affected source temporal derivation was tightened after the failed 56-case development run; that run is not a final source pin.
++
++Before final runs, one actual weekly-entrypoint fixture adds bounded 100+1 candidate chunks with an archive deferral on the second chunk; it proves first-chunk rows/events/accounting commit together and the failed run remains retryable. No network/provider is reached. Additional affected legacy continuity nodes, read in full before selection: tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle (offline 55-row enrichment checkpoint), tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps and ::test_manual_correction_propagates_on_restamp (offline rule/manual dictionary cache), tests/test_classification_jobs_db.py::test_apply_classification_stamps_all_columns and ::test_apply_classification_empty_lists_persist_as_json (flags-off persistence only). These five are selected individually, not their other suites. Derived location cache stamping now uses bounded scoped reservations and still emits no meaningful public event for the cache itself.
++
++Final evidence additions before execution: paired-event admission failure injected after actual seed/enrichment row mutation proves rollback preserves both old company and revision/event count (two parameter cases). Offset-aware seal reference (+14:00) proves the key and manifest use UTC ingestion day. Persisted schema/date identity is checked when reconstructing the immutable BatchRef. Full final selection is 66 tests: 37 original Task10 selection, 24 new Fix1 cases, five affected flags-off/current-caller regressions. Collection output is the authoritative exact count/node inventory.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-development.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-development.txt
+new file mode 100644
+index 0000000..1f5f344
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-development.txt
+@@ -0,0 +1 @@
++All checks passed!
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-final.txt
+new file mode 100644
+index 0000000..1f5f344
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-final.txt
+@@ -0,0 +1 @@
++All checks passed!
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-initial.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-initial.txt
+new file mode 100644
+index 0000000..95fc14f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/lint-initial.txt
+@@ -0,0 +1,12 @@
++E402 Module level import not at top of file
++  --> company_discovery/jobs_db.py:16:1
++   |
++14 | """
++15 |
++16 | from psycopg.types.json import Json
++   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++17 |
++18 | # Predicate (on alias `c`, the companies table) selecting classification targets per mode.
++   |
++
++Found 4 errors (3 fixed, 1 remaining).
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/migration-parity.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/migration-parity.txt
+new file mode 100644
+index 0000000..29f7239
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/migration-parity.txt
+@@ -0,0 +1 @@
++Both full Task10 migrations appear verbatim in schema.sql. Original 04 remains unchanged; 05 contains the Fix1 overrides once each.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/red17.txt
+new file mode 100644
+index 0000000..c737779
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/red17.txt
+@@ -0,0 +1,190 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++FFFFFFF                                                                  [100%]
++=================================== FAILURES ===================================
++_________ test_fix1_operational_miss_normal_positive_operational_miss __________
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff1689c3b90>
++
++    @requires_db
++    def test_fix1_operational_miss_normal_positive_operational_miss(conn):
++        from job_discovery.lifecycle.types import EnumerationRef
++        source,claim=setup(conn,count=1)
++        missed(conn,source,claim)
++        # Persist old absence evidence; subsequent true positive must invalidate it.
++        conn.execute("UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'")
++        conn.commit()
++        enum=reconcile.begin_enumeration(conn,source['id'],claim)
++        listing=conn.execute('SELECT * FROM source_listings').fetchone()
++        observed=conn.execute('SELECT clock_timestamp() t').fetchone()['t']
++        reconcile._positive(conn,enum,listing,'seen',observed)
++        conn.commit()
++        missed(conn,source,claim)
++        row=conn.execute('SELECT * FROM source_listings').fetchone()
++>       assert row['consecutive_complete_misses']==1
++E       assert 2 == 1
++
++tests/test_archive_fix1.py:39: AssertionError
++______________ test_fix1_membership_and_seal_add_to_live_forecast ______________
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff1689c68a0>
++
++    @requires_db
++    def test_fix1_membership_and_seal_add_to_live_forecast(conn):
++        claim,_=seeded_events(conn,2)
++        before=outbox.outbox_health(conn)['bytes']
++        ref=batches.claim_batch(conn,BatchLimits(),claim)
++        conn.commit()
++        after=outbox.outbox_health(conn)['bytes']
++        conn.commit()
++>       assert after>before
++E       assert 644 > 644
++
++tests/test_archive_fix1.py:51: AssertionError
++________________ test_fix1_archive_pressure_is_storage_deferred ________________
++
++    def test_fix1_archive_pressure_is_storage_deferred():
++>       assert issubclass(outbox.ArchiveBlocked,reconcile.StorageBlocked)
++E       AssertionError: assert False
++E        +  where False = issubclass(<class 'job_discovery.archive.outbox.ArchiveBlocked'>, <class 'job_discovery.lifecycle.reconcile.StorageBlocked'>)
++E        +    where <class 'job_discovery.archive.outbox.ArchiveBlocked'> = outbox.ArchiveBlocked
++E        +    and   <class 'job_discovery.lifecycle.reconcile.StorageBlocked'> = reconcile.StorageBlocked
++
++tests/test_archive_fix1.py:59: AssertionError
++________________ test_fix1_actual_seed_and_company_writer_pair _________________
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff168950b90>
++
++    @requires_db
++    def test_fix1_actual_seed_and_company_writer_pair(conn):
++        from job_discovery.db import sync_seed
++        from company_discovery.enrich_apply import apply_enrichment,EnrichUpdate
++        activate_fixture(conn)
++        sync_seed(conn,[{'name':'Seed','ats':'lever','token':'fixture'}])
++>       conn.commit()
++
++tests/test_archive_fix1.py:68: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++.venv/lib/python3.12/site-packages/psycopg/connection.py:309: in commit
++    self.wait(self._commit_gen())
++.venv/lib/python3.12/site-packages/psycopg/connection.py:495: in wait
++    return waiting.wait(
++psycopg_binary/_psycopg/waiting.pyx:255: in psycopg_binary._psycopg.wait_c
++    ???
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:592: in _commit_gen
++    yield from self._exec_command(b"COMMIT")
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff168950b90>
++command = b'COMMIT', result_format = <Format.TEXT: 0>
++
++    def _exec_command(
++        self, command: QueryNoTemplate, result_format: pq.Format = TEXT
++    ) -> PQGen[PGresult | None]:
++        """
++        Generator to send a command and receive the result to the backend.
++    
++        Only used to implement internal commands such as "commit", with eventual
++        arguments bound client-side. The cursor can do more complex stuff.
++        """
++        self._check_connection_ok()
++    
++        if isinstance(command, str):
++            command = command.encode(self.pgconn._encoding)
++        elif isinstance(command, Composable):
++            command = command.as_bytes(self)
++    
++        if self._pipeline:
++            cmd = partial(
++                self.pgconn.send_query_params,
++                command,
++                None,
++                result_format=result_format,
++            )
++            self._pipeline.command_queue.append(cmd)
++            self._pipeline.result_queue.append(None)
++            return None
++    
++        # Unless needed, use the simple query protocol, e.g. to interact with
++        # pgbouncer. In pipeline mode we always use the advanced query protocol
++        # instead, see #350
++        if result_format == TEXT:
++            self.pgconn.send_query(command)
++        else:
++            self.pgconn.send_query_params(command, None, result_format=result_format)
++    
++        results: list[PGresult] = (yield from generators.execute(self.pgconn))
++        if len(results) != 1:
++            raise e.InternalError(
++                f"received {len(results)} results from command {command.decode()!r}"
++            )
++    
++        result = results[0]
++        if result.status != COMMAND_OK and result.status != TUPLES_OK:
++            if result.status == FATAL_ERROR:
++>               raise e.error_from_result(result, encoding=self.pgconn._encoding)
++E               psycopg.errors.RaiseException: public change requires exact transactional outbox event
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_public_pair() line 6 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++__________ test_fix1_baseline_has_recorded_and_unknown_observed_time ___________
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff1689c55e0>
++
++    @requires_db
++    def test_fix1_baseline_has_recorded_and_unknown_observed_time(conn):
++        claim,_=seeded_events(conn,1)
++        event=json.loads(bytes(conn.execute('SELECT canonical_event FROM public_outbox').fetchone()['canonical_event']))
++>       assert event['observed_at'] is None
++               ^^^^^^^^^^^^^^^^^^^^
++E       KeyError: 'observed_at'
++
++tests/test_archive_fix1.py:79: KeyError
++_________________ test_fix1_seal_layout_and_complete_manifest __________________
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff168939430>
++
++    @requires_db
++    def test_fix1_seal_layout_and_complete_manifest(conn):
++        claim,_=seeded_events(conn,1)
++        ref=batches.claim_batch(conn,BatchLimits(),claim)
++        conn.commit()
++        seal=batches.seal_batch(ref)
++        manifest=json.loads(seal.manifest_data)
++>       assert f'ingestion_date={ref.sealed_at.date().isoformat()}/' in seal.data_key
++E       AssertionError: assert 'ingestion_date=2026-10-07/' in 'public/v1/7577a9bc-b0c3-4992-9762-36d785ea1a81/events.jsonl.gz'
++E        +  where 'public/v1/7577a9bc-b0c3-4992-9762-36d785ea1a81/events.jsonl.gz' = SealedBatch(batch=BatchRef(batch_id=UUID('7577a9bc-b0c3-4992-9762-36d785ea1a81'), claim=ClaimRef(owner_token='wp9FB8el...fc284a8d2390a47ece3c9af49d3a01c5b773e7dd', event_count=1, expanded_bytes=323, compressed_bytes=230, manifest_bytes=658).data_key
++
++tests/test_archive_fix1.py:91: AssertionError
++________ test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue ________
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33069 user=postgres database=poller_lifecycle_test) at 0x7ff168df1eb0>
++
++    @requires_db
++    def test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue(conn):
++        claim,refs=seeded_events(conn,1)
++        ref=batches.claim_batch(conn,BatchLimits(),claim)
++        conn.commit()
++        seal=batches.seal_batch(ref)
++        batches.persist_seal(conn,seal)
++        conn.commit()
++        batches.ack_batch(conn,verified(seal),claim)
++        conn.commit()
++        conn.execute('ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable')
++        conn.execute("UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'")
++        conn.execute('ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable')
++        conn.commit()
++        batches.compact_terminal_batches(conn,claim)
++        conn.commit()
++>       assert conn.execute('SELECT count(*) n FROM public_archive_receipts').fetchone()['n']==0
++E       assert 1 == 0
++
++tests/test_archive_fix1.py:112: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_archive_fix1.py::test_fix1_operational_miss_normal_positive_operational_miss
++FAILED tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
++FAILED tests/test_archive_fix1.py::test_fix1_archive_pressure_is_storage_deferred
++FAILED tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair
++FAILED tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time
++FAILED tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest
++FAILED tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue
++7 failed in 3.00s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection-final.txt
+new file mode 100644
+index 0000000..eecea13
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection-final.txt
+@@ -0,0 +1,68 @@
++tests/test_archive_codec.py::test_canonical_utf8_sorted_jsonl_and_zero_time_gzip
++tests/test_archive_codec.py::test_total_public_schema_rejects_private_or_oversize_data
++tests/test_archive_codec.py::test_schema_enforces_complete_relation_endpoints_and_version_identity
++tests/test_archive_codec.py::test_body_is_bounded_and_gzip_single_event_boundary
++tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
++tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
++tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
++tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
++tests/test_archive_outbox.py::test_budget_boundaries_and_critical_reserve
++tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
++tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
++tests/test_archive_outbox.py::test_listing_watermark_does_not_certify_unknown_version
++tests/test_archive_outbox.py::test_migration_reapplication_preserves_flags_and_existing_events
++tests/test_archive_outbox.py::test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup
++tests/test_archive_batches.py::test_batch_limits_are_bounded
++tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
++tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
++tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
++tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
++tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
++tests/test_archive_batches.py::test_later_lower_sequence_commit_remains_pending
++tests/test_archive_batches.py::test_seven_day_terminal_compaction_preserves_exact_markers
++tests/test_archive_batches.py::test_batch_claim_excludes_own_uncommitted_public_events
++tests/test_lifecycle_operational.py::test_preallocated_health_membership_and_two_complete_misses
++tests/test_lifecycle_operational.py::test_partial_positive_survives_restart_and_never_certifies_absence
++tests/test_lifecycle_operational.py::test_complete_checkpoint_resumes_with_fresh_connection
++tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
++tests/test_lifecycle_operational.py::test_missing_preallocation_reports_deferred
++tests/test_lifecycle_operational.py::test_operational_entrypoint_uses_preallocated_rows_and_offline_full_feed
++tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically
++tests/test_archive_fix1.py::test_fix1_operational_miss_normal_positive_operational_miss
++tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
++tests/test_archive_fix1.py::test_fix1_archive_pressure_is_storage_deferred
++tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair
++tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time
++tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest
++tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue
++tests/test_archive_fix1.py::test_fix1_normal_miss_then_operational_miss_closes
++tests/test_archive_fix1.py::test_fix1_normal_positive_before_operational_resume_invalidates_absence
++tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[chunk]
++tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[final_reconcile]
++tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
++tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off
++tests/test_archive_fix1.py::test_fix1_observation_time_distinct_from_database_recording
++tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated
++tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate
++tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch
++tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal
++tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer
++tests/test_archive_fix1.py::test_fix1_version_mutator_preserves_its_explicit_observation
++tests/test_archive_fix1.py::test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress
++tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation[seed]
++tests/test_archive_fix1.py::test_fix1_current_writer_pair_failure_rolls_back_mutation[enrichment]
++tests/test_archive_fix1.py::test_fix1_key_day_is_utc_even_for_an_offset_ref
++tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings
++tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay
++tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset
++tests/test_lifecycle_reconcile.py::test_empty_threshold[20-complete]
++tests/test_lifecycle_reconcile.py::test_empty_threshold[21-partial]
++tests/test_lifecycle_relations.py::test_typed_location_has_unknown_validity_and_no_invented_skills
++tests/test_lifecycle_relations.py::test_identity_assertions_require_review_and_reject_conflicts_cycles
++tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle
++tests/test_locations_resolution.py::test_rule_pass_inserts_and_stamps
++tests/test_locations_resolution.py::test_manual_correction_propagates_on_restamp
++tests/test_classification_jobs_db.py::test_apply_classification_stamps_all_columns
++tests/test_classification_jobs_db.py::test_apply_classification_empty_lists_persist_as_json
++
++66 tests collected in 0.45s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection.txt
+new file mode 100644
+index 0000000..f92631f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection.txt
+@@ -0,0 +1,58 @@
++tests/test_archive_codec.py::test_canonical_utf8_sorted_jsonl_and_zero_time_gzip
++tests/test_archive_codec.py::test_total_public_schema_rejects_private_or_oversize_data
++tests/test_archive_codec.py::test_schema_enforces_complete_relation_endpoints_and_version_identity
++tests/test_archive_codec.py::test_body_is_bounded_and_gzip_single_event_boundary
++tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
++tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
++tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
++tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
++tests/test_archive_outbox.py::test_budget_boundaries_and_critical_reserve
++tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
++tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
++tests/test_archive_outbox.py::test_listing_watermark_does_not_certify_unknown_version
++tests/test_archive_outbox.py::test_migration_reapplication_preserves_flags_and_existing_events
++tests/test_archive_outbox.py::test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup
++tests/test_archive_batches.py::test_batch_limits_are_bounded
++tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
++tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
++tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
++tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
++tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
++tests/test_archive_batches.py::test_later_lower_sequence_commit_remains_pending
++tests/test_archive_batches.py::test_seven_day_terminal_compaction_preserves_exact_markers
++tests/test_archive_batches.py::test_batch_claim_excludes_own_uncommitted_public_events
++tests/test_lifecycle_operational.py::test_preallocated_health_membership_and_two_complete_misses
++tests/test_lifecycle_operational.py::test_partial_positive_survives_restart_and_never_certifies_absence
++tests/test_lifecycle_operational.py::test_complete_checkpoint_resumes_with_fresh_connection
++tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
++tests/test_lifecycle_operational.py::test_missing_preallocation_reports_deferred
++tests/test_lifecycle_operational.py::test_operational_entrypoint_uses_preallocated_rows_and_offline_full_feed
++tests/test_lifecycle_operational.py::test_insufficient_critical_slots_defers_closure_atomically
++tests/test_archive_fix1.py::test_fix1_operational_miss_normal_positive_operational_miss
++tests/test_archive_fix1.py::test_fix1_membership_and_seal_add_to_live_forecast
++tests/test_archive_fix1.py::test_fix1_archive_pressure_is_storage_deferred
++tests/test_archive_fix1.py::test_fix1_actual_seed_and_company_writer_pair
++tests/test_archive_fix1.py::test_fix1_baseline_has_recorded_and_unknown_observed_time
++tests/test_archive_fix1.py::test_fix1_seal_layout_and_complete_manifest
++tests/test_archive_fix1.py::test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue
++tests/test_archive_fix1.py::test_fix1_normal_miss_then_operational_miss_closes
++tests/test_archive_fix1.py::test_fix1_normal_positive_before_operational_resume_invalidates_absence
++tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[chunk]
++tests/test_archive_fix1.py::test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health[final_reconcile]
++tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
++tests/test_archive_fix1.py::test_fix1_writer_rollback_and_flags_off
++tests/test_archive_fix1.py::test_fix1_observation_time_distinct_from_database_recording
++tests/test_archive_fix1.py::test_fix1_all_manifest_identity_fields_validated
++tests/test_archive_fix1.py::test_fix1_logical_small_row_forecasts_and_warning_predicate
++tests/test_archive_fix1.py::test_fix1_retirement_preserves_version_coverage_and_pending_batch
++tests/test_archive_fix1.py::test_fix1_critical_observation_and_recording_survive_seal
++tests/test_archive_fix1.py::test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer
++tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings
++tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay
++tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset
++tests/test_lifecycle_reconcile.py::test_empty_threshold[20-complete]
++tests/test_lifecycle_reconcile.py::test_empty_threshold[21-partial]
++tests/test_lifecycle_relations.py::test_typed_location_has_unknown_validity_and_no_invented_skills
++tests/test_lifecycle_relations.py::test_identity_assertions_require_review_and_reject_conflicts_cycles
++
++56 tests collected in 0.22s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection17.txt
+new file mode 100644
+index 0000000..efc27b6
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/selection17.txt
+@@ -0,0 +1,74 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.......................ordinary operational resource evidence {"after": {"allocated": 40711859, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "before": {"allocated": 40711859, "index_bytes": 1622016, "table_toast_bytes": 1114112}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
++..................F..............
++=================================== FAILURES ===================================
++_______ test_fix1_current_candidate_classification_name_location_writers _______
++
++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33072 user=postgres database=poller_lifecycle_test) at 0x7feddbb7ea20>
++
++    @requires_db
++    def test_fix1_current_candidate_classification_name_location_writers(conn):
++        from types import SimpleNamespace
++        from company_discovery.dataset import Candidate
++        from company_discovery.db import upsert_candidates
++        from company_discovery.jobs_db import apply_classification
++        from company_discovery.name_backfill import apply_name
++        from job_discovery.locations import _insert_unmappable, correct_location
++    
++        activate_fixture(conn)
++        upsert_candidates(conn, [Candidate("Fixture", "lever", "fixture")])
++        conn.commit()
++        cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
++        apply_name(conn, cid, "Public Name")
++>       apply_classification(
++            conn,
++            cid,
++            SimpleNamespace(
++                industry="software",
++                industry_subcategory="infrastructure",
++                size="small",
++                hq_country="US",
++                tech_tags=[],
++                red_flags=[],
++                confidence="high",
++            ),
++            model="offline",
++            source="job",
++        )
++
++tests/test_archive_fix1.py:256: 
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++company_discovery/jobs_db.py:170: in apply_classification
++    cur.execute(
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
++
++self = <psycopg.Cursor [closed] [INERROR] (host=127.0.0.1 port=33072 user=postgres database=poller_lifecycle_test) at 0x7feddc383290>
++query = '\n            UPDATE companies SET\n              industry = %s, industry_subcategory = %s, size = %s, hq_country = %... classified_at = now(), classification_model = %s, classification_source = %s\n            WHERE id = %s\n            '
++params = ('software', 'infrastructure', 'small', 'US', Json([]), Json([]), ...)
++prepare = None, binary = None
++
++    def execute(
++        self,
++        query: Query,
++        params: Params | None = None,
++        *,
++        prepare: bool | None = None,
++        binary: bool | None = None,
++    ) -> Self:
++        """
++        Execute a query or command to the database.
++        """
++        try:
++            with self._conn.lock:
++                self._conn.wait(
++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
++                )
++        except e._NO_TRACEBACK as ex:
++>           raise ex.with_traceback(None)
++E           psycopg.errors.CheckViolation: new row for relation "companies" violates check constraint "companies_size_check"
++E           DETAIL:  Failing row contains (1, Fixture, lever, fixture, t, dataset, 2026-10-07 21:53:07.257093+00, Public Name, null, null, null, null, null, software, infrastructure, small, US, [], [], high, 2026-10-07 21:53:07.556741+00, offline, job, 0).
++
++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: CheckViolation
++=========================== short test summary info ============================
++FAILED tests/test_archive_fix1.py::test_fix1_current_candidate_classification_name_location_writers
++1 failed, 55 passed in 43.12s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-commit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-commit.txt
+new file mode 100644
+index 0000000..5ef5144
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-commit.txt
+@@ -0,0 +1 @@
++01408f0fce8743a98a55726cc9da50f808955443
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.sha256
+new file mode 100644
+index 0000000..64bfada
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.sha256
+@@ -0,0 +1,25 @@
++6cdb981ac96696dcd13325f6aca2cfa14c6a7661871d5892f7d7781c888219ef  company_discovery/db.py
++b40a2e71cbf7977758d6ee68a41642321e494a45e0b99f013e0ded273a1268ef  company_discovery/enrich_apply.py
++17be445faa18eceb696988902ca42d965a243e8e79847e1fc6a3293d6ef6ff4c  company_discovery/jobs_db.py
++013dad91647fbcc0093d8b054388a1ca727e7e7bebd37641c93ef0c1d06ed184  company_discovery/name_backfill.py
++70b9db090b723128b8e13c6abb36a72e5de768d7d3cd10919b0f7feb8d0847f3  company_discovery/run.py
++a685e7fa744cff3e85cd0657b0ef32c8808fb8b9db50b1376a6741aff92e6ead  company_discovery/worker.py
++5bc880b648d7ed13caa48be0132a77bfff03bc0b331d9c1dd71ff1a540289851  job_discovery/archive/batches.py
++8a162bcc4269721c17e26a1bd518622ac282cbc03a464a49bf2ec94edec29bc0  job_discovery/archive/outbox.py
++3503c17adcb6b37e06287acbc3c0ef36ceee627726fa9d6e9e343d1e0b55624c  job_discovery/archive/schema.py
++40569097a8a9d2ad12228a46e8e95cacdfce81b1782dc5dca34f1437e834d277  job_discovery/archive/types.py
++e98408402ec8a9b679afcc265248b0d4fd78bdfc96953124c46eb3a69a7a0266  job_discovery/archive/writers.py
++6c6bc9ddc78f7561dc5450eef5e1aae0e4021e2a4d86a9e0bb443dd4f021fe02  job_discovery/db.py
++3930d8aefe5ae8790f81c13c4aa5e15d6121a5775125b153e6b97101f9c4ec78  job_discovery/lifecycle/errors.py
++a9c9fe06fe09643a368c7bbd6a1711e3487e0b7123ab1aa9ea108019e34d90bd  job_discovery/lifecycle/identity.py
++ce7ab568448e466a3b5dabdf609d9211baf17b296b4d65c7ef3ff0685451d5c1  job_discovery/lifecycle/operational.py
++0887ad5fe380238126a77a02e0e967f682159dab6f936302388275c498ee9acc  job_discovery/lifecycle/reconcile.py
++3b49fc2c6afa806a4d6f4196d2df3008c61545beb4934d72f5f45c2530ac4ea1  job_discovery/locations.py
++0ce29dc1e3fd2a52625de74699228b8f597a7860b8b67ebab012708ebbec888e  job_discovery/run.py
++1b9acd2cc6df49d43dcc2dcd3d3bb666c4f7895abffd148d7afc920cbdaeae9d  migrations/2026-10-03-05-public-outbox-fix1.sql
++de250f120df7cf4617571b5fae477ad04e7cd3145c49b042059c69e460cf8e04  schema.sql
++c3407f27e2c00a90ead21489920957b4ca3a38a47659328c6eb1fae6b49a3c4e  tests/archive_helpers.py
++b2ad984621b40b4969e4dd3c80d5f1a8add0d60eb287e3ce2df08b5f172b70eb  tests/test_archive_batches.py
++5acd92ed0ac9efeec60862a9107506d5c1c087420aa9a77f91f628313a3b4e12  tests/test_archive_fix1.py
++fecdca9321abdd90157f7889d1acbde02ce4ff2a6f963b932fd992ead983f1b6  tests/test_archive_outbox.py
++f54ef1453ee2b2e3db2f6a5d05ac01ce67ddb85fb225f84ce2071cf03ac5ac60  tests/test_lifecycle_operational.py
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.txt
+new file mode 100644
+index 0000000..1cb6884
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/source-files.txt
+@@ -0,0 +1,25 @@
++company_discovery/db.py
++company_discovery/enrich_apply.py
++company_discovery/jobs_db.py
++company_discovery/name_backfill.py
++company_discovery/run.py
++company_discovery/worker.py
++job_discovery/archive/batches.py
++job_discovery/archive/outbox.py
++job_discovery/archive/schema.py
++job_discovery/archive/types.py
++job_discovery/archive/writers.py
++job_discovery/db.py
++job_discovery/lifecycle/errors.py
++job_discovery/lifecycle/identity.py
++job_discovery/lifecycle/operational.py
++job_discovery/lifecycle/reconcile.py
++job_discovery/locations.py
++job_discovery/run.py
++migrations/2026-10-03-05-public-outbox-fix1.sql
++schema.sql
++tests/archive_helpers.py
++tests/test_archive_batches.py
++tests/test_archive_fix1.py
++tests/test_archive_outbox.py
++tests/test_lifecycle_operational.py
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/versions.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/versions.json
+new file mode 100644
+index 0000000..9aa0357
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/fix1/versions.json
+@@ -0,0 +1,6 @@
++{
++  "python": "3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]",
++  "psycopg": "3.3.6",
++  "pytest": "9.1.1",
++  "ruff": "0.15.20"
++}
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-dispatch.md
+new file mode 100644
+index 0000000..63ccf02
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-dispatch.md
+@@ -0,0 +1,11 @@
++# Task10 same-author ONE Fix1 dispatch
++
++Read FULL task-10-requirements-review.md; ALL SEVEN Important findings R10-1..7 and narrow fixes/evidence are the correction list verbatim. FixBASE previous reviewed e3f889421fa1ad30206e128cb292b101bc3a58e0/source293e413. Intervening controllerdocs4b02bdb preserved; no rewrite. Original task-10-brief.md/binding spec and review/release amendments, operational ruling remain. No parallel author/helpers/subagents/reviewers.
++
++Finish this one complete correction pass: common authoritative positive/miss evidence across normal/operational lanes; new logical archive live-byte/membership/seal/row-index forecast contract ONLY (do not recreate oldphysicalcapacity review/probes); ArchiveBlocked truthfulrollback/deferred path fromactualentrypoint; concrete supported current publicwriters paired in boundedexistingtransactions or explicit actualruntimegating for legitimatelyunsupportedpaths; observed/DBrecorded UTC/provenance honestbaselines; configuredtrustedprefix/UTCingestionday/compressedSHA layout+complete immutablemanifestfields; boundedacknowledged-only fullterminalreceipt/cataloguecompaction withcompactexactmarkers/versioncoverage andpendingpreserved.
++
++Spec section8 source lines472–552 and590–634 carry exact omitted details; read those relevant sections rather than wholeplan. The Task10 briefing points to binding spec; no architectureamendment replacing these contracts. Noactivation/destinationconfiguration/infrastructure/prodchanges. Callerinventory must distinguish actualcompatiblewriters frommerelyrejectedstaleones. Do not bypass guards/grants/role/claims or generic privilegedDML.
++
++New ordinary lane-switch, logicalforecast, offline orchestrationexception, actual seed/company/location, codec/manifest/time, acknowledgedterminal fixtures REQUIRED as fullreviewdescribes. Explicit permitted testcontents inventory BEFORE execution; affected37testselection plus newtests onownedrandomloopback17/16 asjustified bychanges; don't rerun oldomittedmechanism/adversarial/safety/activation/crossusersuites or wholepytest. Tests/provider/network alloffline; no shared55432. Preservefailedattempts/actualcommands/serverversions/sourcephasepins, no cumulativeunique-count fiction. All execshell /bin/bash login:false.
++
++Append completeFix1section to task-10-report.md and optionally task-10-fix1-report.md; sanitizedtask-10-evidence/fix1/ actualcommandsoutputs/chronology/sourcehashes. Selfreviewall7andcarrylimits; minorobservations recorddisposition without unrelatedscopeexpansion. Forwardcommit only ownproduct/tests/report/evidence, controllerdocs remainunstaged. ReturnDONE+source/reportSHA+actualtestsummary+concerns andSTOPGit. Controller reads FULLreport/evidence→fullFixBASE..HEAD package→SAMEscopedreviewer original7+fixintroducedImportant/Critical only. No independentsecurityassurance, no productionorpaid/provider/credential/IAM/permanentdelete/activation/publish/merge/deploy, no newwriter. Any safeguard exacterror/stopaffected/no bypass.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-report.md
+new file mode 100644
+index 0000000..93acba6
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-report.md
+@@ -0,0 +1,159 @@
++# Task 10 Fix1 author report
++
++Author implementation and scoped verification are complete. All seven Important findings R10-1 through R10-7 have corresponding source corrections and ordinary regression evidence. This is the same author's one complete correction pass, ready for the controller's same independent permitted reviewer. It is not a reviewer verdict, activation authorization, physical-capacity guarantee or security approval.
++
++## Pins, authority and scope
++
++- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; branch `feature/lifecycle-recovery`.
++- Original reconstruction base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
++- Original Task10 source: `293e413dc452a4e9b230dcef87e23d11fa2798ed`; reviewed package/FixBASE: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
++- Parent/controller-only changes through `0f0a759d009a042821465e0ac2c0dc4dece9501b` were preserved.
++- Fix1 product/test source: **`01408f0fce8743a98a55726cc9da50f808955443`**. This commit changes 25 owned product/test/schema files. No product edits followed the final 66-test runs or this source commit.
++- The following report/evidence-only commit contains this report, the appended original-report pointer and `task-10-evidence/fix1/`. Its exact SHA is supplied in the author handoff; a self-referential commit hash is not invented inside this file.
++
++Read the full original requirements review and Fix1 dispatch, the binding brief/specification sections, review-scope amendment, release authorization and recorded operational ruling. The original seven Important findings are retained verbatim in `task-10-requirements-review.md`; no controller review text was edited or staged by this author. The amendment permits continued development with explicitly omitted Task3 review/probes. It does not remove Task10 functional requirements.
++
++This report supersedes the earlier author report's incomplete claims about independent operational miss counters, canonical-only archive byte accounting, legacy/current writer readiness, occurrence-only envelope time, fixed `public/v1` object keys and forever-retained full receipts/catalogue. Earlier reports and failed evidence remain preserved as history.
++
++## R10-1: common absence evidence across normal and operational work
++
++Both lanes now use `source_listings.consecutive_complete_misses` and `first_complete_miss_at` as the authoritative absence history. Operational reconciliation updates these existing fields directly. Its per-listing `miss_sequence`, positive sequence and source cursor retain bounded idempotence; the old preallocated mirror miss columns remain schema history but no longer control closure or overwrite the authoritative counters. A positive normal sighting clears the same history the next operational miss reads.
++
++The existing full-success requirement, two distinct misses at least 24 hours apart, partial-positive preservation and completed cursor protocol remain. No new identity or payload is admitted through operational reconciliation, and the approved receipt/field allowlist and original physical growth admission remain unchanged.
++
++New ordinary tests cover operational miss → normal positive → operational miss remaining open, normal miss → operational miss closing after the fixture's sufficient interval, and a positive recorded before resumed operational reconciliation invalidating older absence evidence. Existing operational restart/completion and normal miss/reopen cases also pass. This resolves the functional handoff defect without claiming broad scheduling, race or physical-pressure assurance.
++
++## R10-2: one logical live archive forecast
++
++The additive Fix1 migration defines `lifecycle_private.archive_row_charge` and `archive_live_bytes`. The forecast is the sum of each retained live representation, not merely pending canonical bytes:
++
++| Representation | Logical byte charge |
++| --- | --- |
++| Each pending change requirement | `2 * JSON body bytes + 2048` |
++| Each ordinary outbox row | `2 * (JSON body bytes + canonical event bytes) + 2048` |
++| Each allocated/pending critical slot | Same body/canonical charge plus 2048 |
++| Each unacknowledged batch membership row | `2 * canonical event bytes + 1024` |
++| Each unacknowledged batch | 8192; sealed state adds `4096 + 2 * manifest_bytes` |
++
++The multipliers and fixed terms are conservative logical row/index/seal forecasts. They are not measured PostgreSQL allocation, free-space credit or a substitute for the existing positive physical reservation contract. Free preallocation padding and compact acknowledged historical markers are not live pending archive payload; their physical cost still exists and is not subtracted from the physical database-size guard.
++
++Health and warnings read this same SQL total. Ordinary event admission adds the new outbox representation; the already-persisted requirement is already included. Critical flush adds the new canonical representation to the already-counted allocated slot. Both Python and SQL event checks use this charge, preserving ordinary 112 MiB/87,500 versus hard 128 MiB/100,000 and the 16 MiB/12,500 critical reserve dimensions. Warning thresholds remain 64 MiB, 50,000 events or 15 minutes. Batch claim forecasts the membership copies and batch row before writing them; seal persistence forecasts its additional seal state. These checks run inside the existing gated service transaction. Physical claim/seal/ack reservations remain additional requirements.
++
++Small-row tests calculate the exact expected logical total, show membership and then seal persistence increase it, exercise the warning predicate, check ordinary/critical boundary arithmetic using that charge, and show a bounded membership forecast can defer without inserting a batch. There was no large-load or old Task3 physical accounting/enforcement probe.
++
++## R10-3: archive pressure reaches durable storage deferral
++
++`StorageBlocked` now lives in `lifecycle/errors.py`; `ArchiveBlocked` derives from it. The actual source orchestration catches archive admission pressure at the chunk and final reconciliation boundaries. It rolls back the rejected mutation, records `storage_deferred`, cancels the current ordinary claim, and gives the preallocated lane a turn. It does not retry the rejected ordinary chunk as a source failure or claim a closure committed when it did not.
++
++Fallback carries the affected source ID. That source remains eligible for the operational turn even when a normal completion already advanced `next_due_at`; otherwise final-reconciliation pressure could hide it until the following schedule. Other existing due/resumable operational sources retain their normal selection behavior. Missing readiness/slots still returns a deferred result.
++
++Two new offline-feed tests invoke `verify_due_sources`, inject the new archive exception at the actual chunk and final-reconciliation boundaries, assert one rejected call, zero source failures, explicit storage-deferred accounting and durable healthy operational completion. The injection concerns the new archive outcome, not an emulated or bypassed physical guard.
++
++## R10-4: current supported writer inventory
++
++`archive/writers.py:public_write` provides a narrow allowlisted service wrapper for companies, locations and derived Job cache stamping. It enters the existing gate, uses one server transaction-identified claim per transaction and the established `_write` reservation/flush contract, then leaves commit ownership to the current caller. It adds no client grants, generic privileged DML or operational bypass. Flags-off/unenforced callers retain their existing write behavior.
++
++| Actual area/caller | Final integration and boundary |
++| --- | --- |
++| Seed companies, `job_discovery.db.sync_seed` | Each public mutation uses `public_write`; scheduled seed entrypoint commits chunks of 100. |
++| Dataset candidates, `company_discovery.db.upsert_candidates` | Paired writes; current scheduled discovery and weekly worker use `ingest_candidates` with chunks of 100. |
++| Weekly ingestion progress, `company_discovery.worker._weekly_ingest` | The chunk's cumulative progress/owner note commits with its companies and events. A later failed chunk preserves committed progress and remains retryable. |
++| Company enrichment, `enrich_apply.apply_enrichment` | Paired public facts in the caller's existing bounded enrichment transaction. |
++| Company classification, `jobs_db.apply_classification` | Paired classification facts in existing worker chunk transactions. |
++| Name backfill, `name_backfill.apply_name` and `main` | Extracted persistence helper is paired; the actual main loop uses it and retains existing bounded fetched-result commits. |
++| Location rule/LLM dictionary insertion | `_insert` and `_insert_unmappable` pair changes; rule work commits every 100 raws, existing LLM batches retain their bounded boundaries. |
++| Manual location correction | `correct_location` is the supported paired service helper. Raw ad hoc SQL is not silently certified as a supported active writer. |
++| Derived location cache stamping | Sorted affected Job chunks use scoped reservations; changing only `location_canonicals` creates no meaningful public event. |
++| Lifecycle metadata/version/listing admission, source account registration, observations and closure | Existing `_write` integration remains paired; the newly shared exception routes pressure correctly. |
++| Version-location edges and identity assertions | Existing `capture_version` / `set_identity_assertion` shared transactions remain paired. |
++| Brands, skills and other typed relation aggregates | Projections, typed producer and bounded baseline exist. There is no new production creator for unimplemented relation workflows; arbitrary direct writers are not declared ready. |
++| Initial legacy identity mapping | Explicitly pre-cutover only. Existing guard rejects enforced or ever-archive-activated mapping. |
++| Legacy public Job ingestion/closure/poll writer entrypoints | `_legacy_public_writer` explicitly rejects them after archive cutover before DML and directs callers to lifecycle source admission. They remain supported with flags off. |
++| Private reviews, operational/cache-only company fields | They do not produce public projection changes. No private isolation/security assurance follows from these no-event fixtures. |
++
++The tests exercise real seed, candidate, enrichment, classification, name and location persistence, plus an actual weekly entrypoint with 100+1 candidates and a second-chunk archive deferral. Pair-failure tests inject failure after actual seed/enrichment mutation and prove caller rollback preserves the old state and event/revision counts. Five individually selected existing flags-off/current-caller regressions cover weekly enrichment checkpoint retry, rule/manual location continuity and classification field/empty-list persistence. All providers/feeds are offline fixtures; no paid or network calls are made.
++
++This inventory is narrower and more concrete than saying every public writer is ready. Destination validation, full baseline and deployment orchestration still must ensure only these supported active paths run; unspecified external/ad hoc writers remain unsupported.
++
++## R10-5: explicit observation and database recording time
++
++Canonical events now contain aware UTC `observed_at` (nullable), DB-generated `recorded_at`, and sanitized provenance `source_observation`, `current_baseline` or `database_change`. The earlier `occurred_at` field remains for internal compatibility; it no longer stands in for the two required concepts. Exact transaction pairing and critical-slot envelope validation bind the persisted time/provenance fields.
++
++Current baseline scans explicitly record an unknown observation with `observed_at=null` and `current_baseline`; they do not infer historic source times. A current mutator with actual supplied observation evidence retains it, including version/typed relation observations, changed listing sighting/content time, direct Job closure or source completion evidence. A change without such evidence records an unknown observation and `database_change` rather than borrowing an unrelated old timestamp. First-seen actual mutations may carry real supplied evidence even when their first aggregate revision is baseline-kind. `capture_version` preserves the explicit observation through version/listing updates.
++
++New fixtures deliberately separate observed and recorded times for baseline, ordinary listing/version mutation and critical operational closure. Critical bytes survive claim, seal, persistence and recovery exactly. Recorded time remains a database clock; no application-configurable production clock or old expiry mechanism test was added.
++
++## R10-6: service prefix, UTC partition and complete manifest identity
++
++The additive migration creates a service-owned `public_archive_destination` contract with a syntactically bounded prefix and validation timestamp. It deliberately inserts **no production row**. Claiming pending events without a validated row defers. The prefix `fixture/public` exists only in owned test fixtures; it is not a chosen production destination or evidence that an external destination has been validated. The later rollout owns actual destination checks and approved configuration.
++
++Batch claim persists prefix, schema version and UTC ingestion date alongside the original DB seal timestamp/730-day horizon. The key is:
++
++`<validated-prefix>/ingestion_date=YYYY-MM-DD/<opaque-batch-UUID>-<compressed-SHA256>.jsonl.gz`
++
++The adjacent manifest uses the same stem and `.manifest.json`. Public aggregate/event IDs are not path components. The date is always the UTC seal day, including an offset-aware reference tested at +14:00.
++
++The canonical manifest includes schema and serializer versions, batch UUID, configured prefix, ingestion day, ordered exact event IDs, SHA256 of the canonical ordered-ID array, sorted per-aggregate first/last revision ranges, seal/horizon timestamps, prior-batch reference, both object keys, canonical/compressed hashes, count and expanded/compressed sizes. Digest/ranges are persisted with the seal; schema/date are checked while reconstructing the persisted BatchRef. `persist_seal` compares the complete canonical expected manifest, including identity fields previously omitted. Small tests alter each declared identity field, assert rejection, then persist/recover the unchanged deterministic seal.
++
++Predecessor selection now uses an in-memory selected-ID set and one bounded coverage query instead of a linear selected scan and one coverage query per event. No throughput/lock-time guarantee is claimed. Compression remains outside the SQL transaction. Expired replacement/prior-chain creation is still Task11 work, not an implied authorization in this Task10 API.
++
++This is a pre-activation schema correction. Existing released archive objects in the old envelope/key format were not migrated or rewritten; no such production objects were produced by this task. Supporting an already-active older deployment would require a separate explicit migration/readiness assessment, not silently treating the old format as this contract.
++
++## R10-7: acknowledged terminal retirement with compact durable evidence
++
++Acknowledgement now persists `public_archive_batch_markers` in the same transaction as exact coverage, full verification receipts, pending-event removal and terminal state. The compact marker contains batch UUID, owner/generation fence, event-ID digest, manifest hash and acknowledged DB time. Exact aggregate/revision/event coverage and exact version UUID/listing/revision/hash coverage reference this durable marker rather than requiring an eternal full batch catalogue.
++
++After seven days, `compact_terminal_batches` performs at most 2,000 combined row operations per call: clear terminal critical payload bytes, delete acknowledged item payload/catalogue rows, delete full verification receipts once item retirement permits, then delete the full terminal batch row after children are gone. The marker and exact/version coverage remain. Partial cleanup is resumable; pending/unverified batches and events have no TTL and are untouched. Slot identities/fences remain terminal and are never reset to free. Callbacks against a retired batch cannot fabricate a new pending seal; exact coverage still supplies predecessor/version evidence.
++
++Tests show full receipts/items/batches are retired, compact markers survive, exact version coverage survives, and an unrelated pending batch remains intact. Existing exact acknowledgement/rollback/late-commit cases still pass. The callable cleanup is ready for later periodic orchestration; Task10 does not activate an exporter or cleanup scheduler. Deleting these rows grants no physical allocation credit.
++
++## Actual execution and retained failure history
++
++The final source is verified by one complete **66-test selection per PostgreSQL major**, not a cumulative count assembled from development reruns. Selection comprises 37 original permitted Task10 cases, 24 new Fix1 cases and five individually selected affected caller regressions. `selection-final.txt` and `final-selection.json` enumerate every node, and `inventory.md` records contents before execution. Exact full commands are in `final17.command.txt` and `final16.command.txt`; both adjacent exit files are 0.
++
++| Final owned run | Actual result |
++| --- | --- |
++| PostgreSQL 17.11, Debian 17.11-1.pgdg13+2 | 66 passed, 110.76 seconds; no skipped DB cases |
++| PostgreSQL 16.15, Debian 16.15-1.pgdg13+2 | 66 passed, 120.18 seconds; no skipped DB cases |
++| Final Ruff affected-source check | All checks passed |
++| Migration/schema parity | Both complete Task10 migrations occur verbatim in schema.sql |
++| Whitespace check | `git diff --check` clean before source commit |
++
++Python 3.12.14, psycopg 3.3.6, pytest 9.1.1, Ruff 0.15.20. `versions.json` and `image-pins.txt` preserve exact runtime/local image pins. PG17.11 is major-version parity evidence, not an execution on historical production17.6; PG16.15 is compatibility evidence. `source-files.sha256` pins the tested product/test contents; `source-commit.txt` pins the source commit. No source changed after the final runs.
++
++Raw failures are preserved, not relabeled as successful:
++
++- Initial `red17.txt`: all seven original new regressions failed against reviewed behavior.
++- `development17.txt`: collection failed because the expanded file lacked its now-needed pytest import.
++- `development17b.txt`: 15 passed/1 failed due to a fixture classification source outside existing allowed values.
++- `selection17.txt`: 55 passed/1 failed due to a fixture company size outside existing allowed values.
++- `development17c.txt`: 1 passed/19 setup errors from an invalid PL/pgSQL CASE comparison; the corrected explicit old-row value is covered by the final runs.
++- `development17d.txt`: 21 passed before the last ordinary regression additions; it is not the final source claim.
++- Initial lint/import errors and formatting outputs remain included. `commands.md` records chronology and corrections.
++
++All shell commands used `/bin/bash`, `login:false`. Owned harnesses used random loopback ports and only their own disposable PG17/16 containers from cached images. No shared 55432 or reserved destructive fixture was used. Test logs contain only fixture targets and sanitized public data; no production credentials or provider payloads were recorded.
++
++## Resource observations, minor dispositions and carry-forward limits
++
++The ordinary two-enumeration/closure fixture measured the following; it did not fill a database to the guard:
++
++| Major | Allocated bytes before/after | Table + TOAST before/after | Index bytes before/after |
++| --- | --- | --- | --- |
++| 17 | 40,711,859 / 40,711,859 | 1,114,112 / 1,114,112 | 1,622,016 / 1,622,016 |
++| 16 | 41,032,727 / 41,032,727 | 1,114,112 / 1,114,112 | 1,622,016 / 1,622,016 |
++
++All printed deltas are zero for these small owned fixtures only. They do not establish production headroom, above-6000-MiB execution, repeated MVCC page reuse, large-board fairness or a physical allocation bound. The preallocation counts/costs from the operational ruling still apply: one source state/receipt, one mark per known listing, default16 critical slots per provisioning turn, max12,500 slots, 24,576 external padding bytes per free slot. Full-pool padding is 307,200,000 bytes before other row/index overhead; default bounded provisioning forecast remains 7,798,784 bytes. The finite critical pool never recycles automatically, even after acknowledgement.
++
++Minor review dispositions: selected predecessor lookup was made set-based with one bounded coverage query; runtime warning behavior now has a direct small-row assertion; nested public metadata type logic was simplified. Historical Task10 migration04 was preserved rather than rewriting its earlier repeated definitions. Migration05 supplies each Fix1 override once and schema.sql contains both exact migrations. This preserves forward history and leaves the historical duplication visible for reviewers.
++
++Concrete remaining limits and downstream work:
++
++1. Production flags remain off, retirement dry-run and archive inactive. This source adds an empty configuration contract, not a production prefix/destination decision. Actual destination/producer readiness, complete bounded baseline and complete operational preallocation remain activation prerequisites. Existing activation guard remains closed; active tests are fixture-only state seeds.
++2. Task11 still owns transport/export loop, periodic flush/cleanup scheduling, persisted fake-S3 crash matrix and explicitly authorized expired replacement. Task12 owns replay. No archive provider was connected or paid call made.
++3. Missing claim/listing/receipt/baseline slots and exhausted critical capacity cause truthful operational deferral. Batch claim/seal/ack still require ordinary physical capacity and can defer. The logical archive reserve is not a physical exception or delete credit.
++4. Full receipt/catalogue retention now ends after acknowledged seven-day retirement; compact exact/fence/version markers intentionally survive. Their ongoing physical footprint still needs later operational sizing. No unlimited physical-growth guarantee is claimed.
++5. Current supported callers are inventoried above; unimplemented relation creators and arbitrary external/direct writers have not been certified. Legacy initial mapping remains a pre-cutover prerequisite, and legacy public Job mutators are explicitly gated after archive cutover.
++6. Deliberately omitted Task3 expiry enforcement, physical-capacity accounting, cross-user isolation and adversarial review/probes remain omitted. No broad `pytest tests/`, safety/activation/security suite, renamed equivalent or substitute reviewer was used. The original logical and physical guard contract was not weakened. These ordinary functional tests and source fixes confer no new security assurance.
++7. Same independent permitted review of original R10-1..7 plus any fix-introduced Important/Critical issue remains the controller's next step. The author's completion does not preempt that verdict or authorize release.
++
++No safeguard rejection occurred in this correction pass. A transient tool/transport interruption was followed by successful same-executor checks; no replacement writer, environment or duplicate source implementation was introduced. There is no remaining ordinary selected test failure or source handoff blocker. Author work is local-only; no push, PR, merge, deployment, activation, IAM/credential change, external archive write or production deletion occurred.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-operational-ruling.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-operational-ruling.md
+new file mode 100644
+index 0000000..362a954
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-operational-ruling.md
+@@ -0,0 +1,3 @@
++# Task10 R6-4 ordinary operational contract ruling
++
++Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
+index 64b2f20..9ddee79 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
+@@ -78,10 +78,18 @@ No broad pytest tests/ run, no test_lifecycle_safety.py, test_lifecycle_activati
+ ## Remaining integration and release concerns
+ 
+ 1. Task11 transport/export loop, persisted fake-S3 crash matrix, authorized expired replacement and Task12 replay remain downstream work. No external archive destination, exporter or live archive was connected.
+ 2. All production defaults remain off; retirement remains dry-run. Destination validation, compatible writer inventory/readiness, complete bounded baseline and operational preallocation must precede activation. Stale legacy eventful writers intentionally fail closed when active. Existing activation guard still rejects enabling; fixtures seed active state only in owned test databases.
+ 3. Finite critical slots do not refill automatically even after acknowledgement. This preserves exact history/fences but creates an operational runway limit. Fresh lifecycle receipt/event/marker infrastructure above the guard cannot be assumed available; batching/seal/ack use ordinary capacity and may defer if there is no physical headroom. Reuse requires a separately correct exact-ack/fence/marker design, not ad hoc slot reset.
+ 4. Physical MVCC allocation is unknown beyond the measured ordinary fixtures. This task neither lowers the6000MiB ceiling nor awards physical credit for DELETE/compaction. R6-4 has a concrete durable bounded implementation and ordinary DB evidence; it has no independent physical/security assurance. Missing slots/readiness/backlog remains truthful deferral.
+ 5. Archive terminal compaction is implemented/tested as a bounded callable helper; its periodic exporter/maintenance integration belongs to the later orchestration task. Unverified state is retained if orchestration is inactive.
+ 6. Existing deliberately omitted Task3 expiry-enforcement/capacity-accounting/cross-user/adversarial review gaps remain. No refused work was retried or substituted, no new security approval is claimed, and independent permitted Task10 review has not yet happened.
+ 
+ No safeguard rejection occurred in this author session. No remaining ordinary selected test failure. Author work is local-only and ready for the controller's fresh permitted review.
++
++## Fix1 completion — source 01408f0fce8743a98a55726cc9da50f808955443
++
++The same author completed the single correction pass for all seven Important findings R10-1..7. The full authoritative correction report is [task-10-fix1-report.md](task-10-fix1-report.md), with original failure history, exact final commands, source hashes, versions and scope in [task-10-evidence/fix1/commands.md](task-10-evidence/fix1/commands.md) and [inventory.md](task-10-evidence/fix1/inventory.md).
++
++That report supersedes this earlier report's independent operational miss counters, canonical-only byte budget, incomplete current-writer readiness, occurrence-only envelope time, old fixed object layout and forever-full receipt/catalogue retention. It documents the shared authoritative listing history, logical accounting of all live representations, actual archive-pressure fallback, paired bounded current writers, explicit observed/DB-recorded provenance, validated service prefix/UTC/hash manifest contract, and bounded acknowledged-only retirement retaining compact exact/fence/version markers.
++
++Final Fix1 source/test commit: `01408f0fce8743a98a55726cc9da50f808955443`. Actual final verification: 66 passed on PostgreSQL17.11 and 66 passed on PostgreSQL16.15, Ruff passed, both migrations/schema text parity verified. All historical failed outputs remain preserved. No source changed after those runs; no covered checks were duplicated during report handoff. Production configuration remains absent, flags off, archive inactive and retirement dry-run. Finite operational slots, physical MVCC uncertainty, unvalidated destination/readiness and omitted Task3 assurance remain explicit in the full Fix1 report. Controller same-reviewer assessment remains pending; no independent approval or release is claimed by this author.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-requirements-review.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-requirements-review.md
+new file mode 100644
+index 0000000..d2d386b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-requirements-review.md
+@@ -0,0 +1,167 @@
++# Task 10 independent permitted requirements and code-quality review
++
++**DONE. Spec: FAIL. Quality: CHANGES_REQUIRED.**
++
++This verdict concerns Task 10 functional requirements and ordinary code quality. It is not a security verdict, physical-capacity guarantee, activation approval, exporter connection approval, or release decision. No Critical finding is assigned. Seven Important findings below prevent Task 10 requirements approval at this source pin.
++
++## Source and authority
++
++- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
++- Reviewed base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
++- Reviewed package head: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
++- Product implementation: `293e413dc452a4e9b230dcef87e23d11fa2798ed`.
++- During review the controller advanced checkout HEAD to `4b02bdbd917e524b523ad4a404fb6608406fc5c5`. Read-only comparison showed only controller documentation changes after the package head. All 18 entries in `task-10-evidence/source-files.sha256` still matched. This report remains pinned to the supplied product source, not an expanded moving-source review.
++
++Read the exact Task 10 brief first, the review-scope amendment and release authorization, the full author report, reviewer dispatch and operational ruling. Examined the recorded 40-file full review package, confirmed its full diff exactly equals the pinned `git diff --unified=10`, and read the new product implementation and tests directly. Read the relevant archive and provenance requirements in `docs/superpowers/specs/2026-10-03-job-lifecycle-design.md`, plus adjacent existing callers needed to assess the new integration. The source-contract requirements below are not overridden by the development review-scope amendment.
++
++The operational ruling was read before assessing the new lane: preallocation may support bounded durable existing-source work; missing readiness/slots may defer; no physical credit follows from deletion or logical reuse; the original growth guard must remain unchanged. These terms were used in this review. No substitute reviewer, helper, subagent, network/provider call, DB test run, product edit, Git mutation, migration, activation or release action was performed.
++
++## Important findings
++
++### R10-1 — Operational misses survive an intervening normal positive sighting
++
++**Important; functional correctness.** Primary location: `job_discovery/lifecycle/operational.py:277`. Related locations: `operational.py:262`, `operational.py:270`, `operational.py:283`, and `job_discovery/lifecycle/reconcile.py:140`.
++
++The operational lane increments `lifecycle_operational_listings.miss_count` and preserves its `first_miss_at`, then overwrites the corresponding `source_listings` miss fields from that separate state. Normal `_positive` resets only the `source_listings` counters. Its successful sighting does not clear the operational history. The operational skip condition only recognizes a positive at or after the *current* operational enumeration's start.
++
++A normal sequence is sufficient to cause a wrong closure: an operational enumeration records one miss; a later normal enumeration sees the listing and clears the normal miss counters; a subsequent operational enumeration misses it. If the old operational first miss is at least 24 hours old, the last step closes the Job using an absence interval interrupted by a known positive. The inverse transition can also lose accumulated miss progress because the operational copy need not reflect normal-lane misses. This contradicts the consecutive complete-miss behavior and the single lifecycle truth requirement in design lines 468–472.
++
++**Narrow fix:** make one persisted set of absence counters authoritative across both lanes. Keep separate operational sequence/cursor fields only where needed for bounded idempotence; ensure a normal positive invalidates all earlier absence evidence before a later operational miss is evaluated. Preserve the approved field restrictions and physical admission contract.
++
++**Evidence needed:** add ordinary small-DB lane-switch fixtures for operational miss → normal positive → operational miss (must remain open), normal miss → operational miss, and a positive before a resumed reconciliation. Current seven operational tests stay entirely within the operational evidence model and do not establish this integration. I did not execute these scenarios or any excluded mechanism probe.
++
++### R10-2 — The new archive byte budget counts only canonical event bytes
++
++**Important; Task 10 logical archive-budget conformance.** Primary location: `job_discovery/archive/outbox.py:34`. Related locations: `archive/batches.py:87`, `migrations/2026-10-03-04-public-outbox.sql:396`, and the same migration at line 573.
++
++All warning/pause/hard byte calculations sum `octet_length(canonical_event)` only from `public_pending_events`. The new implementation also stores event bodies in requirements/outbox rows and copies canonical event bytes into `public_archive_items` when claiming a batch; those live membership bytes and seal/row/index forecasts are absent from the logical pressure calculation. Claiming/sealing does not check the archive live-byte budget for its additional representation.
++
++Consequently, equal pending event sets report equal archive pressure before and after membership copies have been persisted, although their live archive footprint differs. A collection of pending claimed batches can contain roughly another canonical-data copy without moving the reported byte threshold. The design explicitly includes live pending/sealed event **and membership** bytes plus row/seal/index-overhead forecasts (design lines 595–604). The existing 6000 MiB reservation calls are a separate constraint and do not implement this 64/112/128 MiB contract.
++
++**Narrow fix:** define a conservative logical live-archive charge covering each retained representation and use it consistently in health, event admission, critical-slot admission, batch claim and seal transitions under the existing gate. Preserve the ordinary/critical event-count limits and both reserve dimensions. Do not change or purport to validate the old physical accounting mechanism.
++
++**Evidence needed:** bounded arithmetic/small-row tests showing that added pending membership/seal state changes the forecast and that ordinary/critical thresholds use the same forecast. The existing threshold test verifies arithmetic on caller-supplied canonical sizes only. This finding is source-level review of the *new archive budget*; no physical-capacity, large-load, or omitted Task 3 accounting probe was performed or requested.
++
++### R10-3 — Archive pressure does not enter the durable storage-deferred path
++
++**Important; orchestration correctness.** Primary location: `job_discovery/lifecycle/reconcile.py:43`. Related locations: `archive/outbox.py:23`, `archive/outbox.py:92`, `reconcile.py:351`, `reconcile.py:361`, `reconcile.py:366`, and `reconcile.py:383`.
++
++The newly inserted flush can raise `ArchiveBlocked` on ordinary outbox pressure or unavailable event storage. It is a separate `RuntimeError`, not the `StorageBlocked` type caught by source orchestration. During `stage_postings`, the exception therefore enters the generic source-failure handler. The still-populated chunk is then retried outside that handler, where only `StorageBlocked` is caught, allowing `ArchiveBlocked` to escape the entire source run. A failure during the final chunk or reconciliation also bypasses the existing storage-deferred handler.
++
++This matters at the intended ordinary pause boundary: a changed metadata record can stop the source run instead of routing existing-ID verification through the preallocated lane that can still use available critical closure slots. It can also log a storage/archive condition as a source enumeration failure. Directly calling `verify_storage_blocked` in the new test does not cover reaching it from the real source entrypoint when event admission is blocked.
++
++**Narrow fix:** give archive pressure a deliberate orchestration outcome and route it through the bounded deferred/fallback path after rolling back the failed mutation. Preserve distinctions between source/feed failure, unavailable archive readiness, and exhausted critical storage. Do not retry the same rejected admission chunk as ordinary source work or claim a closure committed when it did not.
++
++**Evidence needed:** ordinary offline-feed orchestration tests that inject the new archive-pressure exception at a chunk and final reconciliation boundary, assert rollback and truthful deferred accounting, and show eligible preallocated verification still gets its turn. This does not require a physical guard or excluded activation suite.
++
++### R10-4 — Current meaningful public writers are still incompatible with active production
++
++**Important; Task 10 integration/readiness.** Primary location: `job_discovery/lifecycle/reconcile.py:43` (the only shared producer integration added). Concrete uncovered callers: `job_discovery/db.py:64`, `company_discovery/db.py:50`, `company_discovery/enrich_apply.py:60`, `company_discovery/jobs_db.py:170`, `company_discovery/name_backfill.py:67`, and `job_discovery/locations.py:51`.
++
++The new `_write` integration pairs the lifecycle writers that already use it. It does not pair seed/company ingestion, meaningful company enrichment/classification, name backfill, or location creation/correction entrypoints. For example, `job_discovery/run.py:108` still calls `sync_seed` and commits before taking the source-enabled branch at line 113. A new seed or changed seed name produces a company projection requirement but no matching event, so the current source-enabled application path will fail at commit if the archive is activated. Company workers likewise remain live entrypoints, rather than solely obsolete legacy Job pollers.
++
++The trigger correctly rejecting an unpaired stale writer is useful and expected. It does not fulfill Task 10's separate instruction to connect all meaningful public mutators or provide a compatible deployed writer set. The author candidly lists old company/Job readiness as incomplete; this report does not treat that admission as evidence the integration is finished. Location backfill is also relevant even though the source-enabled poll path currently returns before legacy location resolution.
++
++**Narrow fix:** finish a caller-level inventory and route supported current writers through the shared claim/reservation/event contract in their existing bounded transactions. Explicitly retire or gate any deliberately unsupported entrypoint before it can be declared ready. Keep flags-off compatibility and reject truly stale direct DML. Do not enable destination/producer controls as part of this fix.
++
++**Evidence needed:** offline ordinary active-producer fixtures for the actual supported seed/company/location entrypoints, their rollback when pairing fails, and no event for operational-only updates. The existing flags-off service statements and active lifecycle admission fixture do not cover these writers. Full activation security tests remain excluded; compatible-writer source integration is within this review's permitted scope.
++
++### R10-5 — Exported events omit the required recorded/observed time distinction
++
++**Important; immutable public-history contract.** Primary location: `job_discovery/archive/outbox.py:54`. Related locations: `migrations/2026-10-03-04-public-outbox.sql:13`, migration line 24, migration line 549, `archive/batches.py:375`, and `lifecycle/reconcile.py:132`.
++
++The canonical envelope exports only `occurred_at`. For normal trigger requirements that field defaults to the DB mutation clock; the row's separate `recorded_at` is never included in canonical event bytes. Original observation time passed through public mutators is not systematically carried into this envelope. Some bodies happen to contain an observation/closure timestamp; others do not, so they cannot supply the specified common temporal contract.
++
++After exact acknowledgement removes the outbox row, an archive consumer cannot recover its original DB-recorded time from the retained event. This conflicts with the explicit observed/recorded UTC envelope fields and preservation of both on authorized recovery (design lines 499–501 and 586–591). A persisted seal time is a batch time, not the missing per-event timestamp.
++
++**Narrow fix:** persist and serialize separate, explicit observed and DB-recorded times, with clear baseline semantics and the real mutator observation where available. Bind them through pairing and critical-slot serialization without inventing legacy observation history. Finalize this versioned contract before any downstream immutable objects are produced.
++
++**Evidence needed:** deterministic codec and paired-event fixtures with deliberately distinct source-observation and DB-recorded times, including a baseline and critical event; retain those exact bytes across claim/seal/recovery. No new timing-enforcement or expiry-mechanism probe is needed.
++
++### R10-6 — The sealed key/manifest contract differs from the approved archive layout
++
++**Important; specification conformance before exporter integration.** Primary location: `job_discovery/archive/batches.py:113`. Related locations: `batches.py:116`, `batches.py:223`, and `migrations/2026-10-03-04-public-outbox.sql:28`.
++
++The implementation seals `public/v1/<batch UUID>/events.jsonl.gz` and `manifest.json`. The approved design requires a validated configured prefix with a seal-day `ingestion_date=YYYY-MM-DD` partition and an opaque batch ID plus compressed SHA in the data filename (design lines 545–551). No ruling supplied for this task replaces that layout. The manifest also lacks the explicit event-ID digest and per-aggregate revision ranges required at lines 546 and 560–562; raw ordered IDs and a hash of the whole manifest provide useful binding but are a different schema.
++
++These are concrete contract differences, not evidence of an object collision or corrupt upload. They become costly to change once Task 11 starts uploading immutable seals and Task 12 consumes them.
++
++**Narrow fix:** align the sealed relative-key layout and manifest fields with the approved contract, keeping any approved destination prefix service-owned and event IDs out of path construction. Alternatively obtain an explicit architecture amendment before declaring this specification satisfied; no such amendment is present in the reviewed inputs. Persist/validate every identity field the manifest declares, including batch ID, serializer/schema version and prior-batch reference.
++
++**Evidence needed:** small deterministic fixtures asserting the complete manifest schema, UTC seal-day partition, content-hash filename and persisted identity agreement. Existing gzip determinism and three immutable-column checks do not establish this layout.
++
++### R10-7 — Seven-day terminal compaction keeps full receipts/catalogue indefinitely
++
++**Important; bounded archive state.** Primary location: `job_discovery/archive/batches.py:398`. Related locations: `migrations/2026-10-03-04-public-outbox.sql:49`, migration line 154, and migration line 170.
++
++The cleanup helper empties acknowledged item canonical bytes and critical-slot bodies. It never compacts or expires `public_archive_receipts`; complete data/manifest receipt JSON, all batch seal fields and per-item rows remain indefinitely. The generic immutability trigger rejects receipt updates/deletes, so merely scheduling this helper later cannot supply the omitted cleanup phase.
++
++Preserving compact exact-ID/replay/fence evidence is required. Keeping full terminal receipt payloads forever is not the specified seven-day terminal retention: design lines 625–628 explicitly expire acknowledgement receipts after compact markers are safe and reject an indefinite duplicate PG catalogue. The author's report accurately says receipt/seal references survive, but the current representation retains full receipts as well as references.
++
++**Narrow fix:** define the minimum durable replay/fence/coverage markers and a bounded acknowledged-only transition that removes or compacts full terminal receipts/catalogue payloads after seven days. Preserve pending and unverified state without TTL/cascade deletion. Make exact-ack cleanup/replay semantics depend on the retained marker representation rather than requiring the forever-full receipt row.
++
++**Evidence needed:** extend the existing ordinary acknowledged-terminal-age fixture to show full receipts are retired/compacted, required markers and version coverage remain, and pending batches are untouched. This is new Task 10 terminal-state retention, not an independent review of omitted Task 3 claim-expiry mechanisms.
++
++## What the implementation and evidence do establish
++
++- Additive archive tables, explicit version coverage and package registration are present. A read-only exact-text check confirms the full Task 10 migration is contained verbatim in `schema.sql`.
++- Public projection allowlists cover all 13 declared aggregate types. Private applicant/raw description/question fields are not included by those projections. Python contracts include the requested EventRef, BatchRef, SealedBatch, VerifiedBatch, AckResult and ProjectionResult shapes, with additional persisted-clock/event-byte data to permit pure serialization.
++- The paired producer path uses per-aggregate revision heads, deterministic UUIDv5 event/predecessor identities, exact current-transaction requirements and deferred pairing. Meaningless cache-use/source-attempt updates do not create projection changes. Pure closure/reopen classification avoids spending the critical reserve on a combined public-metadata change.
++- Batch selection uses exact visible event IDs, excludes its own uncommitted events, persists ordered membership, and blocks a later aggregate batch until prior membership is acknowledged. Selection and deletion do not use a sequence watermark. The lower-sequence test uses actual separate DB sessions and a fixture sequence allocation/reset; it establishes exact-ID behavior, not broad concurrency or security assurance.
++- Canonical JSONL and gzip are deterministic for a fixed ordered input. Compression is a connection-free operation. Persisted seal/membership fields and receipt comparisons support the ordinary exact acknowledgement workflow; acknowledgements delete exact ordinary event IDs or mark exact critical slots acknowledged in the same transaction.
++- Exact version coverage includes version UUID, listing UUID, revision and content hash. Maintenance no longer treats `source_listings.archived_revision` alone as proof a particular version is archived. This is a substantive correction; source review and the selected fixture support it.
++- The operational lane is real durable code, not the former HTTP-only fallback. It has bounded provisioning, persisted source/listing/checkpoint state, bounded receipts, existing claim reuse, chunked positive evidence, full-completion checks, explicit missing-preallocation deferral and finite critical-event retention. Current functional defects are listed separately above.
++
++## Caller inventory and limits
++
++| Public area | Actual integration at this pin | Review conclusion |
++| --- | --- | --- |
++| Job metadata admission, source listing/version changes | `identity.admit_metadata` / `capture_version` → `_write` | Paired ordinary path present; affected active fixture covers jobs/listings/versions |
++| Positive/direct observation and complete misses | `reconcile._positive` / `reconcile_chunk` → `_write` | Pairing present; archive-pressure routing and operational evidence handoff require fixes |
++| Source account registration | `job_discovery.db.sync_source_accounts` → `_write` | Paired path present; operational-only source fields excluded from public projection |
++| Identity assertion changes / version-location edges | `identity.set_identity_assertion` / `capture_version` → `_write` | Shared integration present; existing selected relation tests are not comprehensive active-archive coverage |
++| Existing source verification while ordinary storage unavailable | `verify_storage_blocked` → `operational.run_due` | Durable bounded lane present, subject to readiness/finite slots and R10-1/R10-3 |
++| Companies: seed, discovery, enrichment, classification, name backfill | Existing direct writers | Unpaired meaningful writes are rejected when active; current writer readiness incomplete (R10-4) |
++| Locations: resolver/backfill/manual correction path | Existing direct SQL writers | Projection/rejection present; supported caller pairing incomplete (R10-4) |
++| Brand/skill/company-brand/company-source/job-skill relations | Projection triggers and generic producer/baseline API; company-source mapping also exists in identity backfill | No complete production writer inventory/readiness evidence. Brands exercise generic fixtures; this does not certify every endpoint |
++| Initial identity migration/backfill | Existing migration utility, not newly paired | Must remain a pre-activation prerequisite or gain an explicitly supported active path; do not infer readiness from generic triggers |
++| Private/cache-use/operational-only fields | Public projection unchanged | Ordinary no-event behavior supported in the selected fixture; no private isolation/security verdict |
++
++## Actual tested, reviewed and deliberately unreviewed scopes
++
++**Test execution in this reviewer session:** none. Author-covered tests were not rerun. No new DB probes were run.
++
++**Author evidence read:** full `task-10-report.md`, command chronology, test contents inventory, runtime/image versions, final lint output, source hash list and the actual final test output files. Historical failures were inspected as failure evidence (initial missing-module RED; heterogeneous OLD-record field/type errors; operational PL/pgSQL CASE syntax failure), not reclassified as passing results. The final results supersede those failed attempts for the selected cases.
++
++| Recorded run | PostgreSQL 17 evidence | PostgreSQL 16 evidence |
++| --- | --- | --- |
++| Complete affected selection | 17.11, 36 passed, 28.30 s | 16.15, 36 passed, 35.55 s |
++| Subsequent affected operational file | 17.11, 7 passed, 4.90 s | 16.15, 7 passed, 6.18 s |
++| Subsequent affected batch file | 17.11, 9 passed, 5.93 s | 16.15, 9 passed, 7.37 s |
++
++These are 37 unique selected tests per major at final state through the recorded incremental runs, not one final 37-test command. Outputs show no skipped DB tests. PostgreSQL 17.11 is major-version parity evidence, not an execution on historical production 17.6. PostgreSQL 16.15 supplies compatibility evidence. Recorded Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and ruff 0.15.20 were read; final lint reports all checks passed. I independently checked hashes and schema text equality, not lint or runtime tests.
++
++The operational resource fixture records unchanged allocated DB/table+TOAST/index sizes: on the final operational 17 run, allocated 12,236,467 bytes before/after; on 16, 12,295,191 bytes; table+TOAST 1,097,728 and indexes 1,605,632 on both. All printed deltas are zero. The real operational entrypoint fixture separately asserts fixed row counts for its preallocated state/receipt/slots and legacy write-check table. This is useful evidence for those small owned fixtures only. It does not show production headroom, above-6000-MiB behavior, indefinite MVCC page reuse, large-board fairness, or physical credit from compaction.
++
++**Independently reviewed here:** new Task 10 public schema/projection and paired-caller code, exact membership/serialization/receipt/ack code, exact version coverage, new operational workflow, ordinary readiness/error paths, selected test contents and recorded evidence. Findings are source-derived; absent cases are labeled as requested future evidence rather than executions I performed.
++
++**Deliberately unreviewed:** the refused independent Task 3 expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial review/probes; broad original-helper/GUC/role attacks; existing `test_lifecycle_safety.py`, `test_lifecycle_activation.py`, `test_lifecycle_review_security.py` and equivalent substituted probes. No attempt was made to reproduce or disguise them. Reading the new allowlist/receipt integration and unchanged activation guard call contract supplies no independent mechanism/security assurance. The existing amendment permits development with those gaps documented. No new safeguard rejection occurred in this reviewer session.
++
++## Minor quality observations
++
++- `migrations/2026-10-03-04-public-outbox.sql:93` and `:509` define successive versions of the same projection function; `:184` and `:417` similarly duplicate the large row-validation definition. The final definition wins, but duplicate large definitions in a single new additive migration and schema append make maintenance/review unnecessarily difficult. Consolidating within this not-yet-released new migration should preserve migration/schema equality and prior-task behavior.
++- `archive/batches.py:65` linearly scans selected predecessors and issues individual coverage lookups, up to the 2,000-event batch bound. Keep a selected-ID set and consider a bounded bulk coverage read to reduce time under the gate; no throughput or lock-time guarantee was established by the small fixtures.
++- Warning threshold behavior itself is not directly asserted by `test_budget_boundaries_and_critical_reserve`; that test covers numeric admission boundaries. The report should avoid implying equivalent runtime warning/SQL-boundary coverage.
++- The public validator's nested metadata type conditional at `archive/schema.py:220` is difficult to read. A straightforward named predicate would make future schema changes less error-prone. This is not a finding that valid current metadata necessarily fails.
++
++## R6-4 and remaining prerequisites
++
++The operational proposal/ruling is implemented as a bounded logical protocol, with one source state and receipt, one mark per known listing and up to 12,500 global critical slots. Default provisioning forecasts 7,798,784 bytes for 100 listings, 16 slots and three additional units; each free slot has 24,576 external-storage padding bytes. All slots total 307,200,000 padding bytes before other overhead. These are concrete costs, not evidence those bytes become reusable physical headroom.
++
++Claims/receipts/full listing coverage must already exist when growth admission stops. Each new listing admitted after provisioning needs later provisioning before that source is fully operational-ready. Active-archive closure also needs existing baseline heads and enough free critical slots. Missing prerequisites cause deferral; that is allowed by the ruling and cannot be represented as successful verification/closure. Slots never recycle at this pin, even after exact acknowledgement: finite runway is an explicit operational limit. Batch claim/seal/ack still need ordinary positive reservations and can also defer. The original growth-guard API and thresholds were not weakened by the reviewed Python change, and physical MVCC behavior remains unknown outside the small fixture observations. This is not full R6-4 approval while R10-1 and R10-3 remain.
++
++Before Task 10 may be called specification-complete, resolve the Important findings and provide the narrow ordinary evidence identified above. Keep the caller inventory concrete and the completed/untested/unreviewed distinctions in the revised report. Re-pin any forward product correction and review only its affected permitted scope; do not retry excluded work.
++
++Task 11 still owns transport, periodic 60-second/oldest-flush orchestration, bounded verification, the persisted fake-S3 crash matrix and explicitly authorized expired replacement; Task 12 owns replay; later orchestration must actually schedule terminal cleanup. Those downstream tasks are not claimed complete here. Destination validation, supported producer inventory/readiness, bounded baseline completion and operational preallocation remain actual activation prerequisites. The current guard still rejects activation and the tests seed isolated active state directly; they do not prove a production activation path. All defaults remain off and retirement dry-run. Release authorization is for the completed upgrade under the controller's workflow, not authority for this reviewer to activate or release an unfinished Task 10.
++
++**Final disposition: Spec FAIL; Quality CHANGES_REQUIRED. Reviewer DONE and STOP.**
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-review-package.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-review-package.md
+new file mode 100644
+index 0000000..bd72087
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-review-package.md
+@@ -0,0 +1,5286 @@
++# Full pinned review package
++
++BASE: 6075983bd63dced95ec94dc61b9b112a79f4564d
++
++HEAD: e3f889421fa1ad30206e128cb292b101bc3a58e0
++
++## Commits
++
++e3f889421fa1ad30206e128cb292b101bc3a58e0 docs: record Task 10 ordinary verification and operational limits
++293e413dc452a4e9b230dcef87e23d11fa2798ed feat: record bounded public events with exact batch acknowledgement
++
++
++## Files
++
++ .../task-10-evidence/affected-attempt17.txt        |   4 +
++ .../task-10-evidence/commands.md                   |  35 ++
++ .../task-10-evidence/final-attempt17.txt           |   4 +
++ .../task-10-evidence/final-batches16.txt           |   3 +
++ .../task-10-evidence/final-batches17.txt           |   3 +
++ .../task-10-evidence/final-operational16.txt       |   4 +
++ .../task-10-evidence/final-operational17.txt       |   4 +
++ .../task-10-evidence/final-pinned16.txt            |   4 +
++ .../task-10-evidence/final-pinned17.txt            |   4 +
++ .../task-10-evidence/final16.txt                   |   4 +
++ .../task-10-evidence/final17.txt                   |   4 +
++ .../task-10-evidence/green-attempt17.txt           | 268 ++++++++
++ .../task-10-evidence/green-attempt2-17.txt         |   3 +
++ .../task-10-evidence/lint-attempt.txt              |  14 +
++ .../task-10-evidence/lint-final.txt                |   1 +
++ .../task-10-evidence/operational-attempt17.txt     | 693 +++++++++++++++++++++
++ .../task-10-evidence/operational-attempt2-17.txt   |   4 +
++ .../task-10-evidence/red.txt                       |  38 ++
++ .../task-10-evidence/source-files.sha256           |  18 +
++ .../task-10-evidence/test-inventory.md             |  21 +
++ .../task-10-evidence/versions.txt                  |   6 +
++ .../task-10-report.md                              |  87 +++
++ job_discovery/archive/__init__.py                  |   1 +
++ job_discovery/archive/batches.py                   | 417 +++++++++++++
++ job_discovery/archive/codec.py                     |  37 ++
++ job_discovery/archive/outbox.py                    | 188 ++++++
++ job_discovery/archive/schema.py                    | 259 ++++++++
++ job_discovery/archive/types.py                     | 110 ++++
++ job_discovery/lifecycle/identity.py                |   8 +-
++ job_discovery/lifecycle/maintenance.py             |   5 +-
++ job_discovery/lifecycle/operational.py             | 424 +++++++++++++
++ job_discovery/lifecycle/reconcile.py               |  38 +-
++ migrations/2026-10-03-04-public-outbox.sql         | 622 ++++++++++++++++++
++ pyproject.toml                                     |   2 +-
++ schema.sql                                         | 623 ++++++++++++++++++
++ tests/archive_helpers.py                           |  29 +
++ tests/test_archive_batches.py                      | 242 +++++++
++ tests/test_archive_codec.py                        |  84 +++
++ tests/test_archive_outbox.py                       | 249 ++++++++
++ tests/test_lifecycle_operational.py                | 294 +++++++++
++ 40 files changed, 4822 insertions(+), 36 deletions(-)
++
++
++## Complete diff
++
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt
++new file mode 100644
++index 0000000..b59d87a
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++..................ordinary operational resource evidence {"after": {"allocated": 34789043, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 34789043, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++............
+++30 passed in 24.85s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md
++new file mode 100644
++index 0000000..777ed21
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md
++@@ -0,0 +1,35 @@
+++# Exact verification commands and chronology
+++
+++All shell invocations: `/bin/bash`, `login:false`. Working directory: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. Every database run used `tools/lifecycle_test_db.py` with its owned, random loopback PostgreSQL container and sanitized child environment; no existing-service/shared 55432 option.
+++
+++Initial RED:
+++```
+++.venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py -q
+++```
+++Actual output: `red.txt`, three collection errors for missing archive modules. No DB tests executed in this RED collection.
+++
+++Final complete affected selection, run once for each MAJOR=17 and16:
+++```
+++.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset tests/test_lifecycle_reconcile.py::test_empty_threshold tests/test_lifecycle_relations.py -q -s
+++```
+++Actual outputs: `final-pinned17.txt`, `final-pinned16.txt`:36passed each, no skips/deselections. Previous intermediate run outputs are retained under descriptive attempt/final names; latest pinned runs supersede them.
+++
+++Subsequent UTC-midnight scheduler alignment changed only operational.py and its existing assertion; rerun the affected file only on both majors:
+++```
+++.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_operational.py -q -s
+++```
+++Actual outputs: `final-operational17.txt`, `final-operational16.txt`:7passed each, no skips/deselections.
+++
+++Subsequent committed-membership correction excluded the selector's own uncommitted ordinary/critical events; added one batch test and reran the affected file only on both majors:
+++```
+++.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_batches.py -q
+++```
+++Actual outputs: `final-batches17.txt`, `final-batches16.txt`. Identity.py's last change only updates two stale explanatory comments about the now-implemented outbox and exact version retention.
+++
+++Lint:
+++```
+++.venv/bin/ruff check job_discovery/archive job_discovery/lifecycle/operational.py tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/archive_helpers.py
+++```
+++`lint-final.txt`: All checks passed. `git diff --check` completed with no output.
+++
+++`versions.txt` records Python, psycopg, pytest, ruff and locally cached Docker image IDs/repository digests. Harness outputs record actual server versions. No network pulls, provider/model calls or production actions were performed.
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt
++new file mode 100644
++index 0000000..abfaa94
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++......................ordinary operational resource evidence {"after": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++..............
+++36 passed in 26.01s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt
++new file mode 100644
++index 0000000..4c8857d
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt
++@@ -0,0 +1,3 @@
+++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+++.........                                                                [100%]
+++9 passed in 7.37s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt
++new file mode 100644
++index 0000000..e723ac1
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt
++@@ -0,0 +1,3 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++.........                                                                [100%]
+++9 passed in 5.93s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt
++new file mode 100644
++index 0000000..bb6d21a
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+++ordinary operational resource evidence {"after": {"allocated": 12295191, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 12295191, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++.......
+++7 passed in 6.18s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt
++new file mode 100644
++index 0000000..ef56852
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++ordinary operational resource evidence {"after": {"allocated": 12236467, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 12236467, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++.......
+++7 passed in 4.90s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt
++new file mode 100644
++index 0000000..9d94278
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+++......................ordinary operational resource evidence {"after": {"allocated": 38362135, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 38362135, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++..............
+++36 passed in 35.55s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt
++new file mode 100644
++index 0000000..11ee2a7
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++......................ordinary operational resource evidence {"after": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++..............
+++36 passed in 28.30s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt
++new file mode 100644
++index 0000000..56e2626
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+++......................ordinary operational resource evidence {"after": {"allocated": 38419479, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 38419479, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++..............
+++36 passed in 37.22s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt
++new file mode 100644
++index 0000000..c4918a6
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++......................ordinary operational resource evidence {"after": {"allocated": 37992115, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37992115, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++..............
+++36 passed in 31.30s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt
++new file mode 100644
++index 0000000..1209794
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt
++@@ -0,0 +1,268 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++....F..FF.F.F.F                                                          [100%]
+++=================================== FAILURES ===================================
+++_________ test_direct_mutation_requires_pair_and_revision_predecessor __________
+++
+++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff74436fdd0>
+++
+++    @requires_db
+++    def test_direct_mutation_requires_pair_and_revision_predecessor(conn):
+++        from tests.archive_helpers import seeded_events
+++        from job_discovery.archive.schema import event_id
+++        claim,refs=seeded_events(conn,1)
+++>       with pytest.raises(Exception,match='requires exact transactional'), conn.transaction():
+++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++E       AssertionError: Regex pattern did not match.
+++E         Expected regex: 'requires exact transactional'
+++E         Actual message: 'record "old" has no field "content_hash"\nCONTEXT:  SQL expression "TG_TABLE_NAME=\'job_versions\' AND TG_OP=\'DELETE\' AND EXISTS(\n  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash\n   AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)"\nPL/pgSQL function lifecycle_private.require_public_change() line 10 at IF'
+++
+++tests/test_archive_outbox.py:34: AssertionError
+++______________ test_pending_events_have_no_ttl_or_cascade_cleanup ______________
+++
+++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b7d10>
+++
+++    @requires_db
+++    def test_pending_events_have_no_ttl_or_cascade_cleanup(conn):
+++        from tests.archive_helpers import seeded_events
+++        seeded_events(conn)
+++>       with pytest.raises(Exception,match='immutable pending'),conn.transaction():
+++             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++E       AssertionError: Regex pattern did not match.
+++E         Expected regex: 'immutable pending'
+++E         Actual message: 'record "old" has no field "id"\nCONTEXT:  SQL expression "TG_TABLE_NAME=\'public_change_requirements\' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=OLD.id)\n   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)\n     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision)"\nPL/pgSQL function lifecycle_private.preserve_archive_row() line 16 at IF'
+++
+++tests/test_archive_outbox.py:79: AssertionError
+++__________ test_identity_and_reconcile_mutators_pair_transactionally ___________
+++
+++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6720>
+++
+++    @requires_db
+++    def test_identity_and_reconcile_mutators_pair_transactionally(conn):
+++        from tests.test_lifecycle_reconcile import setup_source
+++        from tests.archive_helpers import activate_fixture
+++        from tests.test_lifecycle_admission import admit
+++        from job_discovery.models import Posting
+++        from job_discovery.lifecycle import reconcile
+++        from job_discovery.lifecycle.types import Observation
+++        source=setup_source(conn)
+++        conn.commit()
+++        activate_fixture(conn)
+++>       _,claim=admit(conn,source,[Posting('0','Updated','https://example.test/job',raw={'descriptionPlain':'Public content'})])
+++                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++
+++tests/test_archive_outbox.py:95: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++tests/test_lifecycle_admission.py:18: in admit
+++    count = identity.admit_metadata(conn, source["id"], postings, claim, reservation)
+++            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++job_discovery/lifecycle/identity.py:466: in admit_metadata
+++    row = conn.execute(
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6720>
+++query = 'INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote)\n                VALUES(%s,%s,%s,%s,...itle,EXCLUDED.url,EXCLUDED.location,EXCLUDED.department,EXCLUDED.remote)\n                RETURNING (xmax=0) AS is_new'
+++params = ('lever:fixture:0', 1, '0', 'Updated', 'https://example.test/job', None, ...)
+++prepare = None, binary = False
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool = False,
+++    ) -> Cursor[Row]:
+++        """Execute a query and return a cursor to read its results."""
+++        try:
+++            cur = self.cursor()
+++            if binary:
+++                cur.format = BINARY
+++    
+++            if isinstance(query, Template):
+++                if params is not None:
+++                    raise TypeError(
+++                        "'execute()' with string template query doesn't support parameters"
+++                    )
+++                return cur.execute(query, prepare=prepare)
+++            else:
+++                return cur.execute(query, params, prepare=prepare)
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.UndefinedFunction: operator does not exist: uuid = text
+++E           LINE 2: ...blic_archive_version_coverage c WHERE c.version_id=OLD.id AN...
+++E                                                                        ^
+++E           HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
+++E           QUERY:  TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++E             SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash
+++E              AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)
+++E           CONTEXT:  PL/pgSQL function lifecycle_private.require_public_change() line 10 at IF
+++
+++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedFunction
+++_______________ test_persisted_exact_partial_membership_and_ack ________________
+++
+++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff744366ed0>
+++
+++    @requires_db
+++    def test_persisted_exact_partial_membership_and_ack(conn):
+++        claim,refs=seeded_events(conn)
+++        batch=claim_batch(conn,BatchLimits(max_events=2),claim)
+++        conn.commit()
+++        seal=seal_batch(batch,1)
+++        assert seal==seal_batch(batch,1)
+++        persist_seal(conn,seal)
+++        conn.commit()
+++>       result=ack_batch(conn,verified(seal),claim)
+++               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++
+++tests/test_archive_batches.py:34: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++job_discovery/archive/batches.py:165: in ack_batch
+++    tx.execute('DELETE FROM public_change_requirements WHERE id=ANY(%s)',([r['requirement_id'] for r in reqs],))
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff744366ed0>
+++query = 'DELETE FROM public_change_requirements WHERE id=ANY(%s)'
+++params = ([1, 2],), prepare = None, binary = False
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool = False,
+++    ) -> Cursor[Row]:
+++        """Execute a query and return a cursor to read its results."""
+++        try:
+++            cur = self.cursor()
+++            if binary:
+++                cur.format = BINARY
+++    
+++            if isinstance(query, Template):
+++                if params is not None:
+++                    raise TypeError(
+++                        "'execute()' with string template query doesn't support parameters"
+++                    )
+++                return cur.execute(query, prepare=prepare)
+++            else:
+++                return cur.execute(query, params, prepare=prepare)
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.UndefinedColumn: record "old" has no field "event_id"
+++E           CONTEXT:  SQL expression "TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+++E               JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id)"
+++E           PL/pgSQL function lifecycle_private.preserve_archive_row() line 14 at IF
+++
+++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+++_____________ test_ack_rollback_retains_every_exact_pending_event ______________
+++
+++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443688f0>
+++
+++    @requires_db
+++    def test_ack_rollback_retains_every_exact_pending_event(conn):
+++        claim,refs=seeded_events(conn)
+++        batch=claim_batch(conn,BatchLimits(),claim)
+++        conn.commit()
+++        seal=seal_batch(batch)
+++        persist_seal(conn,seal)
+++        conn.commit()
+++        with pytest.raises(RuntimeError),conn.transaction():
+++>           ack_batch(conn,verified(seal),claim)
+++
+++tests/test_archive_batches.py:65: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++job_discovery/archive/batches.py:165: in ack_batch
+++    tx.execute('DELETE FROM public_change_requirements WHERE id=ANY(%s)',([r['requirement_id'] for r in reqs],))
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443688f0>
+++query = 'DELETE FROM public_change_requirements WHERE id=ANY(%s)'
+++params = ([1, 2, 3],), prepare = None, binary = False
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool = False,
+++    ) -> Cursor[Row]:
+++        """Execute a query and return a cursor to read its results."""
+++        try:
+++            cur = self.cursor()
+++            if binary:
+++                cur.format = BINARY
+++    
+++            if isinstance(query, Template):
+++                if params is not None:
+++                    raise TypeError(
+++                        "'execute()' with string template query doesn't support parameters"
+++                    )
+++                return cur.execute(query, prepare=prepare)
+++            else:
+++                return cur.execute(query, params, prepare=prepare)
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.UndefinedColumn: record "old" has no field "event_id"
+++E           CONTEXT:  SQL expression "TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+++E               JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id)"
+++E           PL/pgSQL function lifecycle_private.preserve_archive_row() line 14 at IF
+++
+++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+++______________ test_per_aggregate_ordering_survives_small_batches ______________
+++
+++conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6c90>
+++
+++    @requires_db
+++    def test_per_aggregate_ordering_survives_small_batches(conn):
+++        from job_discovery.archive.outbox import flush_public_changes
+++        claim,_=seeded_events(conn,1)
+++        for i in range(2):
+++>           conn.execute('UPDATE brands SET name=%s',(f'Changed {i}',))
+++
+++tests/test_archive_batches.py:94: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6c90>
+++query = 'UPDATE brands SET name=%s', params = ('Changed 0',), prepare = None
+++binary = False
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool = False,
+++    ) -> Cursor[Row]:
+++        """Execute a query and return a cursor to read its results."""
+++        try:
+++            cur = self.cursor()
+++            if binary:
+++                cur.format = BINARY
+++    
+++            if isinstance(query, Template):
+++                if params is not None:
+++                    raise TypeError(
+++                        "'execute()' with string template query doesn't support parameters"
+++                    )
+++                return cur.execute(query, prepare=prepare)
+++            else:
+++                return cur.execute(query, params, prepare=prepare)
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.UndefinedColumn: record "old" has no field "content_hash"
+++E           CONTEXT:  SQL expression "TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++E             SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash
+++E              AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)"
+++E           PL/pgSQL function lifecycle_private.require_public_change() line 10 at IF
+++
+++.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+++=========================== short test summary info ============================
+++FAILED tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+++FAILED tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+++FAILED tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+++FAILED tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+++FAILED tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+++FAILED tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+++6 failed, 9 passed in 4.99s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt
++new file mode 100644
++index 0000000..b0d8362
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt
++@@ -0,0 +1,3 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++...............                                                          [100%]
+++15 passed in 7.43s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt
++new file mode 100644
++index 0000000..2c2fffe
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt
++@@ -0,0 +1,14 @@
+++F841 Local variable `source` is assigned to but never used
+++  --> tests/test_archive_outbox.py:49:5
+++   |
+++47 |     from tests.test_lifecycle_reconcile import setup_source
+++48 |     from tests.archive_helpers import activate_fixture
+++49 |     source=setup_source(conn)
+++   |     ^^^^^^
+++50 |     conn.commit()
+++51 |     activate_fixture(conn)
+++   |
+++help: Remove assignment to unused variable `source`
+++
+++Found 8 errors (7 fixed, 1 remaining).
+++No fixes available (1 hidden fix can be enabled with the `--unsafe-fixes` option).
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt
++new file mode 100644
++index 0000000..1f5f344
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt
++@@ -0,0 +1 @@
+++All checks passed!
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt
++new file mode 100644
++index 0000000..c163f9e
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt
++@@ -0,0 +1,693 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++..EEEE.EE.EEEEEEEEEE
+++==================================== ERRORS ====================================
+++__________ ERROR at setup of test_flag_off_legacy_write_has_no_event ___________
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82090>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++________ ERROR at setup of test_bounded_current_baseline_pairs_rollback ________
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82750>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_ ERROR at setup of test_direct_mutation_requires_pair_and_revision_predecessor _
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82a50>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_____ ERROR at setup of test_unchanged_poll_and_private_cache_do_not_emit ______
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b831d0>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_____ ERROR at setup of test_pending_events_have_no_ttl_or_cascade_cleanup _____
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82f90>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_ ERROR at setup of test_identity_and_reconcile_mutators_pair_transactionally __
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82690>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++______ ERROR at setup of test_persisted_exact_partial_membership_and_ack _______
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82990>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++________ ERROR at setup of test_seal_membership_and_clock_are_immutable ________
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83590>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++____ ERROR at setup of test_ack_rollback_retains_every_exact_pending_event _____
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83a10>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_ ERROR at setup of test_exact_receipts_and_suppressed_membership_fail_closed __
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201760110>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_____ ERROR at setup of test_per_aggregate_ordering_survives_small_batches _____
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b837d0>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_ ERROR at setup of test_preallocated_health_membership_and_two_complete_misses _
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82c90>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++_ ERROR at setup of test_partial_positive_survives_restart_and_never_certifies_absence _
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82990>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++___ ERROR at setup of test_complete_checkpoint_resumes_with_fresh_connection ___
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82d50>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++________ ERROR at setup of test_active_archive_critical_slots_exact_ack ________
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83110>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++________ ERROR at setup of test_missing_preallocation_reports_deferred _________
+++
+++    @pytest.fixture
+++    def conn():
+++        assert TEST_DSN, "TEST_DATABASE_URL required"
+++        validate_test_dsn(TEST_DSN)
+++        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+++        try:
+++            with connection.cursor() as cur:
+++                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+++>               cur.execute(SCHEMA_SQL)
+++
+++tests/conftest.py:119: 
+++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+++
+++self = <psycopg.Cursor [closed] [BAD] at 0x7f2201760950>
+++query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
+++params = None, prepare = None, binary = None
+++
+++    def execute(
+++        self,
+++        query: Query,
+++        params: Params | None = None,
+++        *,
+++        prepare: bool | None = None,
+++        binary: bool | None = None,
+++    ) -> Self:
+++        """
+++        Execute a query or command to the database.
+++        """
+++        try:
+++            with self._conn.lock:
+++                self._conn.wait(
+++                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+++                )
+++        except e._NO_TRACEBACK as ex:
+++>           raise ex.with_traceback(None)
+++E           psycopg.errors.SyntaxError: syntax error at end of input
+++E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+++E                                                          ^
+++
+++.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+++=========================== short test summary info ============================
+++ERROR tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
+++ERROR tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
+++ERROR tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+++ERROR tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
+++ERROR tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+++ERROR tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+++ERROR tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+++ERROR tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
+++ERROR tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+++ERROR tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
+++ERROR tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+++ERROR tests/test_lifecycle_operational.py::test_preallocated_health_membership_and_two_complete_misses
+++ERROR tests/test_lifecycle_operational.py::test_partial_positive_survives_restart_and_never_certifies_absence
+++ERROR tests/test_lifecycle_operational.py::test_complete_checkpoint_resumes_with_fresh_connection
+++ERROR tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
+++ERROR tests/test_lifecycle_operational.py::test_missing_preallocation_reports_deferred
+++4 passed, 16 errors in 7.37s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt
++new file mode 100644
++index 0000000..ef5b0df
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt
++@@ -0,0 +1,4 @@
+++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+++...............ordinary operational resource evidence {"after": {"allocated": 29890227, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 29890227, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+++.....
+++20 passed in 12.69s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt
++new file mode 100644
++index 0000000..7b2a419
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt
++@@ -0,0 +1,38 @@
+++
+++==================================== ERRORS ====================================
+++_________________ ERROR collecting tests/test_archive_codec.py _________________
+++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_codec.py'.
+++Hint: make sure your test modules/packages have valid Python names.
+++Traceback:
+++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+++    return _bootstrap._gcd_import(name[level:], package, level)
+++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++tests/test_archive_codec.py:6: in <module>
+++    from job_discovery.archive.schema import PublicChange, AggregateType, ChangeKind, validate_change
+++E   ModuleNotFoundError: No module named 'job_discovery.archive.schema'
+++________________ ERROR collecting tests/test_archive_outbox.py _________________
+++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_outbox.py'.
+++Hint: make sure your test modules/packages have valid Python names.
+++Traceback:
+++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+++    return _bootstrap._gcd_import(name[level:], package, level)
+++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++tests/test_archive_outbox.py:3: in <module>
+++    from job_discovery.archive import outbox
+++E   ImportError: cannot import name 'outbox' from 'job_discovery.archive' (unknown location)
+++________________ ERROR collecting tests/test_archive_batches.py ________________
+++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_batches.py'.
+++Hint: make sure your test modules/packages have valid Python names.
+++Traceback:
+++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+++    return _bootstrap._gcd_import(name[level:], package, level)
+++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+++tests/test_archive_batches.py:2: in <module>
+++    from job_discovery.archive.batches import claim_batch, seal_batch, persist_seal, ack_batch
+++E   ModuleNotFoundError: No module named 'job_discovery.archive.batches'
+++=========================== short test summary info ============================
+++ERROR tests/test_archive_codec.py
+++ERROR tests/test_archive_outbox.py
+++ERROR tests/test_archive_batches.py
+++!!!!!!!!!!!!!!!!!!! Interrupted: 3 errors during collection !!!!!!!!!!!!!!!!!!!!
+++3 errors in 0.23s
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256
++new file mode 100644
++index 0000000..47bd93d
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256
++@@ -0,0 +1,18 @@
+++a0e169d541fe1c7732c2f7c13544d0f23e369664191b2ec2ff83f6a5f1f2872f job_discovery/archive/__init__.py
+++10be82ea8393812bf0048f216d5a2329dd249c2d16ac073bf69a4fa69926e294 job_discovery/archive/batches.py
+++4c9075ec074c2b8896a8c575ee61f4cf1401bfb0e0335dc9e69ad0218403230b job_discovery/archive/codec.py
+++1ec0a902d53330f3241e32273408692713df40128c8d6fb03f145fae57f8dfe7 job_discovery/archive/outbox.py
+++a8bfb5903bc6df65981af50bf8275d114a66584ec5efd682aa594fa4c99d5d64 job_discovery/archive/schema.py
+++259210b47e6b0e2d00f1f0ca807e8842f3933b68db49e6e9021c5af1ed007f43 job_discovery/archive/types.py
+++387ad730da43e5f4d6b55de3d1edb9b37f671b3c3e3fb265000a76514fbedc6b job_discovery/lifecycle/identity.py
+++2b4c0cd3a6633bfd7e9c421c5bfca8f33618e7582ce9ee44a06503a49b5f1b25 job_discovery/lifecycle/maintenance.py
+++1f4cc35e7b7ed814c12a099af906028e79a79014ddfb07f28544f4aae24928c6 job_discovery/lifecycle/operational.py
+++24a76d559bcdbc69b0c54346a545e81e700712c5e5ea6e60c4ca237ff41db24d job_discovery/lifecycle/reconcile.py
+++b31aa721636069d8095a378324c80efd6a1cd398a397cd72637c34f6979ce22b migrations/2026-10-03-04-public-outbox.sql
+++2ccf9a6310b2320109ed6f712647ee34e83eadf905bfd5a12540482dc2656d54 pyproject.toml
+++702c4d465c7205de26c82c3974ca55abbbdc0673fa6ae64e54d9ada06cc57be4 schema.sql
+++6282ea5b8e8a3da8afb4eb75a9478a1d8324dd65bb3661dce33b25eb15454e5a tests/archive_helpers.py
+++b7cc5c581f7c96822036866d91de612eb5d8a0179a1751e5138adcfb32c19dba tests/test_archive_batches.py
+++a03a9326e9d3231df37a7a94e94cd8c9bcc7c438785205a3bf50e901ad569913 tests/test_archive_codec.py
+++18f14ead314c3ec014b4bb811c47e88868d8654f91693006705973f4d38cff60 tests/test_archive_outbox.py
+++990a7fb2451f192302faff3cb186dca605869e0e3df374bb172c38820935e414 tests/test_lifecycle_operational.py
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md
++new file mode 100644
++index 0000000..1c6c210
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md
++@@ -0,0 +1,21 @@
+++# Explicit affected test contents inventory before database runs
+++
+++Only tests/test_archive_codec.py, tests/test_archive_outbox.py, tests/test_archive_batches.py are selected initially. New ordinary contracts: UTF8 canonical JSONL, reproducible gzip, total public schema, exact endpoint ID; flags-off legacy brands write; baseline rollback; paired brand update/predecessor and ordinary missing-pair commit failure; unchanged polling/private cache timestamps; pure numeric outbox budget thresholds (no physical/capacity fixture probes); pending retention; metadata admission+closure event integration; exact partial batch acknowledgement; immutable seal/membership; ack transaction rollback; offline receipt/suppression matching; contiguous per-aggregate batching. All DB fixtures are owned random-loopback harness databases. Isolated control state fixture permits ordinary producer behavior only and supplies no activation/readiness/security assurance.
+++
+++No tests/test_lifecycle_safety.py, test_lifecycle_activation.py, test_lifecycle_review_security.py, cross-user/expiry/capacity/adversarial suites selected. No broad tests/ invocation. Initial RED selected these three new files and failed collection on missing archive modules (3 errors). No database tests executed in that RED collection.
+++
+++Added tests/test_lifecycle_operational.py before execution: provisioned existing-source health/exact known membership/two successful misses at >=24h; new ID not admitted; PostgreSQL allocated/table+toast/index deltas printed; partial positive commit survives fresh DB connection without absence; complete checkpoint resumes via fresh connection; active archive closure consumes fixed critical exact events subsequently exact-acked; missing preallocation returns deferred. Uses real owned DB with ordinary physical size; does NOT simulate/exceed physical guard or rerun existing capacity/expiry/isolation/adversarial probes. Fixture completion timestamp adjustment establishes ordinary 24h evidence interval only.
+++
+++Final selected additions before runs: exact archived version coverage (listing watermark alone yields no retirement candidates; exact version event ack does); migration reapplication retains existing event IDs; two-session allocated-lower-sequence later commit remains pending after exact ack. Existing affected tests selected by exact node IDs: test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings (offline SourceResult normal admission); test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay; ::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset; ::test_empty_threshold (20/21); tests/test_lifecycle_relations.py (two ordinary typed location/assertion evidence tests). Contents inspected before selection; no omitted mechanism suite is indirectly collected/executed. Existing helper imports do not select their test functions.
+++
+++Additional final ordinary tests before final runs: explicit flags-off legacy Job upsert + approval + application prepare + generation + same-owner account cleanup statements (service statements, no cross-user/role probe); complete typed relation endpoints/private unknown-field rejection; event body/count size limits; seven-day acknowledged-only byte compaction preserving exact coverage markers. Local terminal-age fixture does not change production clock/claim enforcement. Seal and acknowledgement now reserve physical growth through the unchanged ordinary capacity API; no physical guard simulation/test was added.
+++
+++Operational final additions before final runs: real verify_storage_blocked entrypoint with offline full feed persists successful health and complete membership while counts of preallocated operational state, receipt, event slots and legacy write-check rows stay constant; insufficient preallocated critical slots rolls back closure atomically. These are ordinary new lane slot/readiness contracts, with the unchanged physical guard running against a small actual owned database; no physical/cross-user/claim-expiry attack fixture or omitted Task3 probe.
+++
+++Final compatibility refinement: restrict nested private operational helper invocation to the three public service mutation tables before private-helper lookup. The legacy statement test additionally updates its own single already-seeded job_review using the ordinary authenticated owner wrapper; this verifies the new trigger dispatch does not break existing flag-off owner updates. It does not create a second user, attempt unauthorized calls, or exercise omitted Task3 mechanisms.
+++
+++Final critical-slot retention check extends active-archive exact-ack test with acknowledged-only seven-day byte compaction. Slots retain UUIDs, revisions, timestamps and terminal state forever; they never become free again. Combined item/slot compaction obeys the same <=2000 operation limit. The closure-kind projection now reserves critical budget only for pure closed_at/source_availability changes; simultaneous other public metadata changes remain ordinary upserts.
+++
+++Operational scheduling assertion added to the existing two-miss integration fixture: next_due_at is the next UTC day boundary (or established failure-disabled day multiplier), matching the existing one-shot 00:00 UTC cron and avoiding elapsed-feed-duration drift. This is ordinary scheduler integration, not a database expiry probe.
+++
+++Final exact-commit check: test_batch_claim_excludes_own_uncommitted_public_events verifies that same-connection uncommitted events cannot enter claimed membership. The selector excludes both ordinary requirement transaction IDs and critical slot transaction IDs equal to its current transaction; after commit the same event becomes eligible. This adds one ordinary batch test; final incremental batch-file runs are recorded separately from the previous 36-test broad affected selection.
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt
++new file mode 100644
++index 0000000..c609661
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt
++@@ -0,0 +1,6 @@
+++3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
+++psycopg 3.3.6
+++pytest 9.1.1
+++ruff 0.15.20
+++sha256:327daa8fae7178d61f93142f146b098467b345e10997b9eb79f63bd58e5c8f3c ["postgres@sha256:ae69c452f483507a6b99fb654cf93aad7fe156ffd2c56247707eef4e36d3c12b"]
+++sha256:275447c94b11b151decd1f29877965301d5a77032037c46de93d990f739f00a9 ["postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65"]
++diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
++new file mode 100644
++index 0000000..64b2f20
++--- /dev/null
+++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
++@@ -0,0 +1,87 @@
+++# Task 10 implementation report
+++
+++Status: DONE for local author implementation and permitted ordinary verification. Independent permitted requirements/code-quality review is pending controller dispatch. This is not a security approval, archive activation, exporter connection, or release decision.
+++
+++Source commit: `293e413dc452a4e9b230dcef87e23d11fa2798ed`.
+++Base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
+++Branch/worktree: `feature/lifecycle-recovery`, `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+++The controller supplied the approved base and prior-task pins. Locally cached `origin/main` was `73ce118205bfdbb56c18207acc0c1c4e3708c860`; the author did not contact a remote or independently refresh upstream. Existing pricing and Pro stage-2 GPT6-Luna/16000 configuration was not changed.
+++
+++## Binding scope
+++
+++Read task-10-brief.md, task-10-author-dispatch.md, repository AGENTS.md, REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md. Read the controller's full task-10-operational-ruling.md before operational guard changes. No whole-plan read, subagents, helper agents, reviewer substitution, production/provider/model/network calls, IAM/credential changes, permanent production deletion, push, PR, merge or deploy.
+++
+++The author made only forward local commits and staged exact owned paths. Controller CURRENT/progress/resume/release/task13 documents were left unstaged. Root handles independent permitted review and eventual complete-upgrade release.
+++
+++## Implemented public outbox
+++
+++Added additive migration `2026-10-03-04-public-outbox.sql` and identical appended schema definitions, the archive package, package registration and tests.
+++
+++* Typed `PublicChange`, aggregate/change enums, total validation, bounded body (8192 bytes), explicit required relation endpoints, public field allowlists and version identity/hash fields. Raw description/question content and private applicant fields are absent. UUID namespace `fb2201d3-79ac-5801-923c-471b7823cb15` deterministically produces aggregate-kind/ID/revision event IDs and predecessor IDs.
+++* After-row public projections create exact current-transaction requirements and monotonically ordered aggregate revisions. Deferred pairing requires the event's exact aggregate, revision, kind, body and occurred_at. Rollback removes state and event together. The old unconditional archive-placeholder rejection was replaced; established ordinary capacity/protection logic is otherwise retained. Paused producers reject eventful public changes; non-eventful private/cache-use and unchanged polling updates do not emit events.
+++* Projection coverage: jobs, source_accounts, source_listings, job_versions, companies, locations, brands, skills, company_brands, company_sources, job_locations, job_skills, identity_assertions. Source operational attempt/lease/counter timestamps are not public facts. Source exclusion identity, listing availability/version/anchor, exact version metadata, and typed relation endpoints are public facts.
+++* `_write` now flushes matching projections in the same transaction, connecting existing metadata admission, version capture/location edges, assertions, source catalog registration, positive/direct observations and complete-miss closure. `identity.py` explanatory comments reflect this shared integration. New source/listing/job rows retain their existing IDs and private FKs.
+++* Bounded baseline snapshots current existing rows only, max100 per call; missing heads are the durable checkpoint. They do not fabricate historic observations or public versions. Production destination/producer readiness remains unvalidated and activation guards remain closed.
+++* Ordinary budget112MiB/87500, critical hard budget128MiB/100000, reserving16MiB AND12500 slots; warning64MiB/50000/15minutes. Critical classification requires a pure closure/reopen field change; simultaneous other metadata changes remain ordinary. No per-unchanged-poll event growth. New budget SQL checks and API forecast use the same existing gate/capacity interfaces.
+++* No pending event/batch cascade or TTL cleanup. Service-only tables have RLS and client privileges revoked; no new client grants or privileged user/job-DML helper was introduced. This is implementation description, not independent security assurance.
+++
+++Legacy direct writers remain compatible with flags off. Once archive-active, an eventful stale/direct writer without the paired contract fails closed. Old company/legacy Job writer entrypoints were not silently granted producer compatibility; their deployment readiness remains an activation prerequisite.
+++
+++## Exact batches, deterministic seals and acknowledgement
+++
+++`claim_batch(tx, limits, claim)` selects only committed, unassigned exact event IDs, excluding its own transaction's ordinary and critical-slot events. No sequence watermark determines membership/deletion. Earlier per-aggregate revisions must be in the same ordered batch or already covered; unacknowledged prior aggregate batches block later revisions. Maximum2000 events/8MiB expanded. Claiming is eager; no caller must wait five minutes. Task11 still owns the scheduled exporter tick/oldest-flush orchestration.
+++
+++The caller commits the claim before invoking pure `seal_batch(batch_ref, serializer_version=1)`. BatchRef includes immutable event-byte snapshots and persisted DB seal clock/horizon in addition to the specified identity/claim/membership/version fields. SealedBatch exposes batch identity/claim/membership/version properties, fixed object keys, persisted seal time and730-day eligible_until, SHA256 canonical/compressed/manifest digests and all counts/byte sizes. VerifiedBatch binds that seal to exact data and manifest receipts. ProjectionResult is defined for later replay integration; no replay executor is implemented here.
+++
+++Canonical UTF-8 sorted JSONL and deterministic gzip use mtime0 and no filename. Compression/serialization has no DB connection and runs outside SQL locks/transactions. `persist_seal` validates bytes, digests, membership, manifest identity, keys and sizes before writing immutable seal columns. `recover_batch` can adopt persisted work only after the prior owner is no longer active; its original membership and seal time survive. Expired seals fail closed and require future explicit authorized replacement; no replacement authorization or transport is invented in Task10.
+++
+++`ack_batch` requires a current claim/fence, exact persisted seal and membership, unsuppressed aggregate membership, both matching verification receipts, and DB time strictly before eligible_until. It persists receipt/coverage and deletes ONLY exact ordinary IDs (or terminally marks exact critical slots) in the same transaction. Late-committing lower sequence events remain pending. Rollback preserves pending membership/receipts together. Seal/ack growth uses the ordinary physical reservation API, so missing physical headroom defers it.
+++
+++`public_archive_version_coverage` binds version UUID + listing UUID + version revision + content hash + event/batch. Maintenance's version eligibility now requires that exact coverage; a listing archived_revision watermark cannot certify unknown versions. No unknown or privately referenced version is silently retired.
+++
+++`compact_terminal_batches` compacts only verified, acknowledged bytes after7days, max2000 combined item/critical-slot operations. Exact IDs/revisions, receipt/seal references, suppression and coverage/fence markers survive. Pending state never ages out. This helper is ready for Task11/13 scheduled orchestration; no exporter/maintenance archive scheduling activation is added here. A compacted terminal byte history cannot be reconstituted through a fake pending replay.
+++
+++## R6-4 operational closure and health contract
+++
+++Concrete prior issue: claim_due_source→fresh claim/_write(source_accounts)→new source enumeration/membership/checkpoint rows reserved growth, and every source/listing update was charged as growth. The old fallback fetched/logged feeds without durable closure/health. A zero-byte reservation would not solve staging, receipt or archive event storage. The controller approved an additive preallocated lane; ordinary growth admission/6000MiB/all-held forecasts were not weakened.
+++
+++New `lifecycle/operational.py` and tables provide:
+++
+++* One `lifecycle_operational_sources` row per source: sequence, terminal/running status, started/completed/last-turn clocks, fixed UUID cursor, completion bit and membership count.
+++* One `lifecycle_operational_listings` row per existing listing: fixed source/listing IDs, positive sequence/time/kind, distinct miss sequence/count bounded0..2 and first-miss time.
+++* One reusable `lifecycle_operational_receipts` row per source with backend/transaction, actual invoking role/subject, current owner/generation and <=500 counted row effects. Receipt updates defer current claim/DB-time validation to standalone commit. No caller GUC enables this lane; it does not insert the old lifecycle_write_checks per operation.
+++* Existing source claim rows are reused. Fresh missing claims, operational rows, incomplete known-listing coverage or missing archive baseline produce explicit deferral. The same gate precedes sorted Job keys before affected Job/listing locks; source-only progress is gated. Each bounded operational transaction renews the existing claim; network requests follow committed transactions.
+++* Global fixed critical-event slots, integer IDs1..12500, with free→allocated→pending→acked transitions. Default provisioning adds16 slots per ordinary source turn; explicit provisioning allows0..100 per chunk. Slots are never automatically recycled. Above-guard closure/reopen in an archive-active fixture retains exact body/UUID/revision/predecessor/time in these slots and uses the same pending-event view/batching/ack. Missing slots or baseline rolls back closure; it cannot report success while dropping its event.
+++
+++Below-guard `provision` uses the unchanged positive capacity API; at most100 listings and100 slots per call. Default forecast is65536*(100+16+3)=7798784 bytes, including existing ordinary claims/reservations. Each free critical slot carries24576 external-storage padding bytes (16 slots=393216 bytes; all12500=307200000 bytes before row/index overhead). A populated slot bounds body<=8192 and canonical event<=12288 bytes plus fixed metadata, and drops padding. These are logical/preallocation bounds, not physical credit or a promise of MVCC page reuse.
+++
+++The operational reader streams existing IDs only; new IDs are not admitted or stored. Positive evidence commits in <=100-item chunks and survives partial feeds/restart. Only full successful, unsuspicious completion can supply absence. Empty feeds with >20 prior open jobs remain suspicious. Reconciliation uses per-listing sequence marks, two distinct successful misses>=24h apart, and durable cursor commits. An interrupted running feed restarts a new sequence; a complete unreconciled checkpoint resumes. No payload is hydrated, no identity is inserted. Successful/partial/failed health and next-due scheduling persist; the latter retains the established UTC day-boundary rule. Per-source last-turn ordering prevents resumed tails always retaining the oldest selection key, but large-board operational fairness is not independently load-proven here.
+++
+++`verify_storage_blocked` now invokes this durable lane. Ordinary source turns proactively provision bounded state before regular staging. Full initial coverage of large/existing corpora requires repeated bounded provisioning BEFORE the guard binds; missing readiness yields a deferred result. No actual database was filled past6000MiB for this task, and no omitted Task3 physical-capacity/expiry/isolation probes were run.
+++
+++## Verification evidence and limits
+++
+++See `task-10-evidence/test-inventory.md` for explicit test contents recorded before each selection, `commands.md` for actual commands/chronology, `versions.txt` for exact runtime/image pins, and `source-files.sha256` for final owned source/test hashes.
+++
+++Initial RED:3 collection errors from missing archive modules. Intermediate PostgreSQL failures are retained: heterogeneous-trigger OLD field access, then a PL/pgSQL CASE syntax mistake, were corrected before GREEN. No failed result is presented as a pass.
+++
+++Complete affected selection:36 passed on actual PostgreSQL17.11 and36 passed on16.15, no skipped DB tests (`final-pinned17.txt`, `final-pinned16.txt`). After the final UTC-midnight scheduler adjustment, only the affected operational file was rerun:7 passed on each major (`final-operational17.txt`, `final-operational16.txt`). After the own-uncommitted-membership correction/additional test, only the affected batch file was rerun:9 passed on each major (`final-batches17.txt`, `final-batches16.txt`). Together these cover37 unique selected tests per major at the final state; there is no claim that a single final command executed all37. Identity's subsequent edits are comments only.
+++
+++The selected tests cover paired rollback/direct unpaired commit rejection, revision/predecessor consistency, second-session lower-sequence late commit, exact partial membership, contiguous aggregate ordering, unchanged polling, pure outbox threshold arithmetic, canonical gzip/JSON, typed relation endpoints, exact version coverage, immutable seal/membership, receipt/suppression checks, transaction rollback at ack, terminal compaction, idempotent migration reapplication, active metadata/closure integration, flags-off legacy upsert/approval/prepare/generation/same-owner cleanup, a normal single-owner authenticated update, source misses/reopen/empty threshold, and the operational lane including durable restart/cursor/critical slots.
+++
+++The owned small operational fixture measured allocated database bytes, table+TOAST bytes and index bytes before/after two successful enumerations/closure. Final operational17: allocated12236467 before/after; table+TOAST1097728 and indexes1605632 before/after. Operational16: allocated12295191 before/after; same table/index values. All three deltas were0 in those fixtures. The real operational entrypoint separately proved constant counts of operational state/receipt/critical slot and legacy write-check rows. These limited observations are NOT a general physical-growth or production headroom guarantee.
+++
+++Python3.12.14, psycopg3.3.6, pytest9.1.1, ruff0.15.20. PostgreSQL17 proves major-version parity;17.11 is not a claim of having run historical production17.6. PostgreSQL16 evidence is compatibility evidence. Lint passed and git diff --check was clean.
+++
+++No broad pytest tests/ run, no test_lifecycle_safety.py, test_lifecycle_activation.py, test_lifecycle_review_security.py or deferred cross-user/expiry/capacity/adversarial suites. Tests that import old setup helpers do not select their test functions. Numeric outbox threshold unit tests are not a claim of having loaded100000 events or proved the old physical accounting mechanism.
+++
+++## Remaining integration and release concerns
+++
+++1. Task11 transport/export loop, persisted fake-S3 crash matrix, authorized expired replacement and Task12 replay remain downstream work. No external archive destination, exporter or live archive was connected.
+++2. All production defaults remain off; retirement remains dry-run. Destination validation, compatible writer inventory/readiness, complete bounded baseline and operational preallocation must precede activation. Stale legacy eventful writers intentionally fail closed when active. Existing activation guard still rejects enabling; fixtures seed active state only in owned test databases.
+++3. Finite critical slots do not refill automatically even after acknowledgement. This preserves exact history/fences but creates an operational runway limit. Fresh lifecycle receipt/event/marker infrastructure above the guard cannot be assumed available; batching/seal/ack use ordinary capacity and may defer if there is no physical headroom. Reuse requires a separately correct exact-ack/fence/marker design, not ad hoc slot reset.
+++4. Physical MVCC allocation is unknown beyond the measured ordinary fixtures. This task neither lowers the6000MiB ceiling nor awards physical credit for DELETE/compaction. R6-4 has a concrete durable bounded implementation and ordinary DB evidence; it has no independent physical/security assurance. Missing slots/readiness/backlog remains truthful deferral.
+++5. Archive terminal compaction is implemented/tested as a bounded callable helper; its periodic exporter/maintenance integration belongs to the later orchestration task. Unverified state is retained if orchestration is inactive.
+++6. Existing deliberately omitted Task3 expiry-enforcement/capacity-accounting/cross-user/adversarial review gaps remain. No refused work was retried or substituted, no new security approval is claimed, and independent permitted Task10 review has not yet happened.
+++
+++No safeguard rejection occurred in this author session. No remaining ordinary selected test failure. Author work is local-only and ready for the controller's fresh permitted review.
++diff --git a/job_discovery/archive/__init__.py b/job_discovery/archive/__init__.py
++new file mode 100644
++index 0000000..8ee8417
++--- /dev/null
+++++ b/job_discovery/archive/__init__.py
++@@ -0,0 +1 @@
+++"""Transactional public metadata archive; activation and transport are separate gates."""
++diff --git a/job_discovery/archive/batches.py b/job_discovery/archive/batches.py
++new file mode 100644
++index 0000000..856a292
++--- /dev/null
+++++ b/job_discovery/archive/batches.py
++@@ -0,0 +1,417 @@
+++"""Persist exact committed membership; serialize without a connection or transaction."""
+++
+++from dataclasses import asdict, replace
+++from datetime import UTC
+++import hashlib
+++import json
+++from uuid import uuid4
+++from psycopg.types.json import Jsonb
+++from job_discovery.lifecycle.claims import validate_claim
+++from job_discovery.lifecycle.capacity import (
+++    reserve_capacity,
+++    bind_reservation,
+++    settle_capacity,
+++)
+++from .codec import canonical_json, encode_events, MAX_MANIFEST
+++from .outbox import ArchiveBlocked
+++from .types import BatchRef, BatchLimits, SealedBatch, VerifiedBatch, AckResult
+++
+++
+++def _hash(value):
+++    return hashlib.sha256(value).hexdigest()
+++
+++
+++def _ref(tx, row, claim):
+++    items = tx.execute(
+++        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
+++        (row["batch_id"],),
+++    ).fetchall()
+++    return BatchRef(
+++        row["batch_id"],
+++        claim,
+++        tuple(i["event_id"] for i in items),
+++        row["serializer_version"],
+++        row["sealed_at"],
+++        row["eligible_until"],
+++        tuple(bytes(i["canonical_event"]) for i in items),
+++        row["prior_batch_id"],
+++    )
+++
+++
+++def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
+++    if not isinstance(limits, BatchLimits):
+++        raise ValueError("BatchLimits required")
+++    validate_claim(tx, claim)
+++    # No watermark: only committed, unassigned exact IDs visible under the gate.
+++    rows = tx.execute(
+++        """SELECT e.* FROM public_pending_events e
+++      WHERE NOT EXISTS(SELECT FROM public_change_requirements r WHERE r.id=e.requirement_id AND r.transaction_id=pg_current_xact_id())
+++      AND NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.event_id=e.event_id AND s.transaction_id=pg_current_xact_id())
+++      AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
+++      AND NOT EXISTS(SELECT FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+++        WHERE i.aggregate_type=e.aggregate_type AND i.aggregate_id=e.aggregate_id AND b.state<>'acked')
+++      ORDER BY e.recorded_at,e.aggregate_type,e.aggregate_id,e.revision,e.event_id LIMIT %s""",
+++        (limits.max_events,),
+++    ).fetchall()
+++    selected = []
+++    total = 0
+++    for row in rows:
+++        size = len(row["canonical_event"]) + 1
+++        if total + size > limits.max_expanded_bytes:
+++            break
+++        # A prior pending predecessor must be included earlier in this same batch.
+++        if (
+++            row["revision"] > 1
+++            and not any(r["event_id"] == row["predecessor_id"] for r in selected)
+++            and not tx.execute(
+++                "SELECT 1 FROM public_archive_coverage WHERE event_id=%s",
+++                (row["predecessor_id"],),
+++            ).fetchone()
+++        ):
+++            continue
+++        selected.append(row)
+++        total += size
+++    if not selected:
+++        return None
+++    reservation = reserve_capacity(tx, claim, total * 4 + 65536)
+++    if reservation is None:
+++        raise ArchiveBlocked("physical batch capacity unavailable")
+++    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+++    batch_id = uuid4()
+++    row = tx.execute(
+++        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes)
+++      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s FROM (SELECT clock_timestamp() t) clock RETURNING *""",
+++        (batch_id, claim.owner_token, claim.generation, len(selected), total),
+++    ).fetchone()
+++    for position, event in enumerate(selected):
+++        tx.execute(
+++            """INSERT INTO public_archive_items(batch_id,position,event_id,aggregate_type,aggregate_id,revision,canonical_event)
+++         VALUES(%s,%s,%s,%s,%s,%s,%s)""",
+++            (
+++                batch_id,
+++                position,
+++                event["event_id"],
+++                event["aggregate_type"],
+++                event["aggregate_id"],
+++                event["revision"],
+++                event["canonical_event"],
+++            ),
+++        )
+++    settle_capacity(tx, reservation)
+++    return _ref(tx, row, claim)
+++
+++
+++def seal_batch(batch_ref: BatchRef, serializer_version: int = 1) -> SealedBatch:
+++    if serializer_version != 1 or batch_ref.serializer_version != 1:
+++        raise ValueError("unsupported serializer version")
+++    events = [json.loads(value) for value in batch_ref.event_bytes]
+++    if tuple(e["event_id"] for e in events) != tuple(
+++        str(e) for e in batch_ref.ordered_event_ids
+++    ):
+++        raise ValueError("membership differs from event bytes")
+++    canonical, compressed = encode_events(events)
+++    prefix = f"public/v1/{batch_ref.batch_id}"
+++    data_key = f"{prefix}/events.jsonl.gz"
+++    manifest_key = f"{prefix}/manifest.json"
+++    manifest = canonical_json(
+++        dict(
+++            schema_version=1,
+++            serializer_version=1,
+++            batch_id=str(batch_ref.batch_id),
+++            ordered_event_ids=[str(e) for e in batch_ref.ordered_event_ids],
+++            sealed_at=batch_ref.sealed_at.astimezone(UTC).isoformat(),
+++            eligible_until=batch_ref.eligible_until.astimezone(UTC).isoformat(),
+++            prior_batch_id=str(batch_ref.prior_batch_id)
+++            if batch_ref.prior_batch_id
+++            else None,
+++            data_key=data_key,
+++            manifest_key=manifest_key,
+++            canonical_hash=_hash(canonical),
+++            compressed_hash=_hash(compressed),
+++            event_count=len(events),
+++            expanded_bytes=len(canonical),
+++            compressed_bytes=len(compressed),
+++        )
+++    )
+++    if len(manifest) > MAX_MANIFEST:
+++        raise ValueError("manifest exceeds 1MiB")
+++    return SealedBatch(
+++        batch_ref,
+++        data_key,
+++        manifest_key,
+++        _hash(canonical),
+++        _hash(compressed),
+++        _hash(manifest),
+++        len(events),
+++        len(canonical),
+++        len(compressed),
+++        len(manifest),
+++        canonical,
+++        compressed,
+++        manifest,
+++    )
+++
+++
+++def _owned(tx, batch_id, claim):
+++    validate_claim(tx, claim)
+++    row = tx.execute(
+++        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+++    ).fetchone()
+++    if not row or (row["owner_token"], row["generation"]) != (
+++        claim.owner_token,
+++        claim.generation,
+++    ):
+++        raise ArchiveBlocked("stale batch owner")
+++    if not tx.execute(
+++        "SELECT clock_timestamp()<%s eligible", (row["eligible_until"],)
+++    ).fetchone()["eligible"]:
+++        raise ArchiveBlocked(
+++            "archive seal expired; explicit replacement authorization required"
+++        )
+++    return row
+++
+++
+++def recover_batch(tx, batch_id, claim) -> BatchRef:
+++    """Fence an expired/cancelled prior worker, preserving exact membership and seal."""
+++    validate_claim(tx, claim)
+++    row = tx.execute(
+++        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+++    ).fetchone()
+++    if not row or row["state"] == "acked":
+++        raise ArchiveBlocked("batch unavailable")
+++    if (row["owner_token"], row["generation"]) != (claim.owner_token, claim.generation):
+++        if tx.execute(
+++            "SELECT 1 FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND state='active' AND lease_until>clock_timestamp()",
+++            (row["owner_token"], row["generation"]),
+++        ).fetchone():
+++            raise ArchiveBlocked("batch still owned")
+++        tx.execute(
+++            "UPDATE public_archive_batches SET owner_token=%s,generation=%s WHERE batch_id=%s",
+++            (claim.owner_token, claim.generation, batch_id),
+++        )
+++    _owned(tx, batch_id, claim)
+++    return _ref(tx, row, claim)
+++
+++
+++def persist_seal(tx, seal: SealedBatch) -> None:
+++    row = _owned(tx, seal.batch.batch_id, seal.batch.claim)
+++    ref = _ref(tx, row, seal.batch.claim)
+++    if ref != seal.batch:
+++        raise ArchiveBlocked("persisted membership differs from seal")
+++    # Validate already-serialized bytes and hashes; never compress under the gate.
+++    if seal.canonical_data != b"".join(e + b"\n" for e in ref.event_bytes) or any(
+++        _hash(data) != digest
+++        for data, digest in [
+++            (seal.canonical_data, seal.canonical_hash),
+++            (seal.compressed_data, seal.compressed_hash),
+++            (seal.manifest_data, seal.manifest_hash),
+++        ]
+++    ):
+++        raise ValueError("seal bytes or hashes differ")
+++    if (
+++        seal.event_count,
+++        seal.expanded_bytes,
+++        seal.compressed_bytes,
+++        seal.manifest_bytes,
+++    ) != (
+++        len(ref.ordered_event_ids),
+++        len(seal.canonical_data),
+++        len(seal.compressed_data),
+++        len(seal.manifest_data),
+++    ):
+++        raise ValueError("seal counts or sizes differ")
+++    prefix = f"public/v1/{ref.batch_id}"
+++    if (seal.data_key, seal.manifest_key) != (
+++        f"{prefix}/events.jsonl.gz",
+++        f"{prefix}/manifest.json",
+++    ):
+++        raise ValueError("seal object keys differ")
+++    manifest = json.loads(seal.manifest_data)
+++    for key in (
+++        "data_key",
+++        "manifest_key",
+++        "canonical_hash",
+++        "compressed_hash",
+++        "event_count",
+++        "expanded_bytes",
+++        "compressed_bytes",
+++    ):
+++        if manifest.get(key) != getattr(seal, key):
+++            raise ValueError("manifest differs from seal")
+++    if (
+++        manifest.get("ordered_event_ids") != [str(e) for e in ref.ordered_event_ids]
+++        or manifest.get("sealed_at") != ref.sealed_at.astimezone(UTC).isoformat()
+++        or manifest.get("eligible_until")
+++        != ref.eligible_until.astimezone(UTC).isoformat()
+++    ):
+++        raise ValueError("manifest identity or horizon differs")
+++    values = {
+++        k: getattr(seal, k)
+++        for k in (
+++            "data_key",
+++            "manifest_key",
+++            "canonical_hash",
+++            "compressed_hash",
+++            "manifest_hash",
+++            "event_count",
+++            "expanded_bytes",
+++            "compressed_bytes",
+++            "manifest_bytes",
+++        )
+++    }
+++    if row["state"] != "claimed":
+++        if any(row[k] != v for k, v in values.items()):
+++            raise ArchiveBlocked("immutable seal differs")
+++        return
+++    reservation = reserve_capacity(tx, seal.batch.claim, 65536)
+++    if reservation is None:
+++        raise ArchiveBlocked("physical seal capacity unavailable")
+++    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+++    tx.execute(
+++        """UPDATE public_archive_batches SET state='sealed',data_key=%(data_key)s,manifest_key=%(manifest_key)s,
+++      canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
+++      compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
+++        dict(values, batch_id=ref.batch_id),
+++    )
+++
+++    settle_capacity(tx, reservation)
+++
+++
+++def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
+++    if not isinstance(verified_batch, VerifiedBatch):
+++        raise ValueError("VerifiedBatch required")
+++    seal = verified_batch.seal
+++    row = _owned(tx, seal.batch.batch_id, claim)
+++    current = _ref(tx, row, claim)
+++    if replace(seal.batch, claim=claim) != current:
+++        raise ArchiveBlocked("ack membership differs")
+++    for key in (
+++        "data_key",
+++        "manifest_key",
+++        "canonical_hash",
+++        "compressed_hash",
+++        "manifest_hash",
+++        "event_count",
+++        "expanded_bytes",
+++        "compressed_bytes",
+++        "manifest_bytes",
+++    ):
+++        if row[key] != getattr(seal, key):
+++            raise ArchiveBlocked("ack seal differs")
+++    if row["state"] not in {"sealed", "acked"}:
+++        raise ArchiveBlocked("batch is not sealed")
+++    for receipt, key, digest, size in [
+++        (
+++            verified_batch.data_receipt,
+++            seal.data_key,
+++            seal.compressed_hash,
+++            seal.compressed_bytes,
+++        ),
+++        (
+++            verified_batch.manifest_receipt,
+++            seal.manifest_key,
+++            seal.manifest_hash,
+++            seal.manifest_bytes,
+++        ),
+++    ]:
+++        if (
+++            (receipt.key, receipt.sha256, receipt.byte_count) != (key, digest, size)
+++            or not isinstance(receipt.receipt, str)
+++            or not 1 <= len(receipt.receipt) <= 2048
+++        ):
+++            raise ValueError("exact data and manifest verification receipts required")
+++    if tx.execute(
+++        """SELECT 1 FROM public_archive_items i JOIN public_archive_suppressions s USING(aggregate_type,aggregate_id)
+++        WHERE i.batch_id=%s LIMIT 1""",
+++        (current.batch_id,),
+++    ).fetchone():
+++        raise ArchiveBlocked("batch contains suppressed aggregate")
+++    items = tx.execute(
+++        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
+++        (current.batch_id,),
+++    ).fetchall()
+++    markers = tuple(
+++        (i["aggregate_type"], i["aggregate_id"], i["revision"]) for i in items
+++    )
+++    if row["state"] == "acked":
+++        return AckResult(current.ordered_event_ids, markers)
+++    reservation = reserve_capacity(tx, claim, 65536 + len(items) * 16384)
+++    if reservation is None:
+++        raise ArchiveBlocked("physical exact acknowledgement capacity unavailable")
+++    bind_reservation(tx, reservation, job_id=None, scope="public_archive_coverage")
+++    tx.execute(
+++        "INSERT INTO public_archive_receipts(batch_id,data_receipt,manifest_receipt) VALUES(%s,%s,%s)",
+++        (
+++            current.batch_id,
+++            Jsonb(asdict(verified_batch.data_receipt)),
+++            Jsonb(asdict(verified_batch.manifest_receipt)),
+++        ),
+++    )
+++    for item in items:
+++        tx.execute(
+++            "INSERT INTO public_archive_coverage(aggregate_type,aggregate_id,revision,event_id,batch_id) VALUES(%s,%s,%s,%s,%s)",
+++            (
+++                item["aggregate_type"],
+++                item["aggregate_id"],
+++                item["revision"],
+++                item["event_id"],
+++                current.batch_id,
+++            ),
+++        )
+++        if item["aggregate_type"] == "job_versions":
+++            body = json.loads(bytes(item["canonical_event"]))["body"]
+++            tx.execute(
+++                """INSERT INTO public_archive_version_coverage(version_id,source_listing_id,version_revision,content_hash,event_id,batch_id)
+++             VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
+++                (
+++                    body["id"],
+++                    body["source_listing_id"],
+++                    body["revision"],
+++                    body["content_hash"],
+++                    item["event_id"],
+++                    current.batch_id,
+++                ),
+++            )
+++    # Exact IDs only, even when a lower sequence commits after selection.
+++    reqs = tx.execute(
+++        "DELETE FROM public_outbox WHERE event_id=ANY(%s) RETURNING requirement_id",
+++        (list(current.ordered_event_ids),),
+++    ).fetchall()
+++    slots = tx.execute(
+++        "UPDATE public_critical_event_slots SET state='acked' WHERE state='pending' AND event_id=ANY(%s) RETURNING event_id",
+++        (list(current.ordered_event_ids),),
+++    ).fetchall()
+++    if len(reqs) + len(slots) != len(items):
+++        raise ArchiveBlocked("exact pending acknowledgement membership missing")
+++    tx.execute(
+++        "DELETE FROM public_change_requirements WHERE id=ANY(%s)",
+++        ([r["requirement_id"] for r in reqs],),
+++    )
+++    tx.execute(
+++        "UPDATE public_archive_batches SET state='acked',acked_at=clock_timestamp() WHERE batch_id=%s",
+++        (current.batch_id,),
+++    )
+++    settle_capacity(tx, reservation)
+++    return AckResult(current.ordered_event_ids, markers)
+++
+++
+++def compact_terminal_batches(tx, claim, *, limit=2000) -> int:
+++    """Seven-day terminal byte compaction retains exact IDs, receipts and fences."""
+++    if type(limit) is not int or not 1 <= limit <= 2000:
+++        raise ValueError("terminal compaction limit must be 1..2000")
+++    validate_claim(tx, claim)
+++    rows = tx.execute(
+++        """UPDATE public_archive_items SET canonical_event=''::bytea WHERE (batch_id,position) IN
+++      (SELECT i.batch_id,i.position FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+++       WHERE b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days' AND octet_length(i.canonical_event)>0
+++       ORDER BY b.acked_at,i.position LIMIT %s) RETURNING event_id""",
+++        (limit,),
+++    ).fetchall()
+++    slots = tx.execute(
+++        """UPDATE public_critical_event_slots SET body='{}'::jsonb,canonical_event=''::bytea WHERE slot IN
+++      (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
+++       JOIN public_archive_batches b USING(batch_id) WHERE s.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days'
+++       AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
+++        (limit - len(rows),),
+++    ).fetchall()
+++    return len(rows) + len(slots)
++diff --git a/job_discovery/archive/codec.py b/job_discovery/archive/codec.py
++new file mode 100644
++index 0000000..9c5a972
++--- /dev/null
+++++ b/job_discovery/archive/codec.py
++@@ -0,0 +1,37 @@
+++"""Version 1 canonical UTF-8 JSONL and reproducible gzip, without external I/O."""
+++
+++import gzip
+++import io
+++import json
+++
+++MAX_EXPANDED = 8 * 1024**2
+++MAX_COMPRESSED = 16 * 1024**2
+++MAX_MANIFEST = 1024**2
+++
+++
+++def canonical_json(value) -> bytes:
+++    return json.dumps(
+++        value,
+++        ensure_ascii=False,
+++        sort_keys=True,
+++        separators=(",", ":"),
+++        allow_nan=False,
+++    ).encode("utf-8")
+++
+++
+++def encode_events(events) -> tuple[bytes, bytes]:
+++    chunks = []
+++    total = 0
+++    for event in events:
+++        chunk = canonical_json(event) + b"\n"
+++        total += len(chunk)
+++        if len(chunks) >= 2000 or total > MAX_EXPANDED:
+++            raise ValueError("batch exceeds 2000 events or 8MiB expanded")
+++        chunks.append(chunk)
+++    data = b"".join(chunks)
+++    output = io.BytesIO()
+++    with gzip.GzipFile(
+++        filename="", fileobj=output, mode="wb", mtime=0, compresslevel=9
+++    ) as stream:
+++        stream.write(data)
+++    return data, output.getvalue()
++diff --git a/job_discovery/archive/outbox.py b/job_discovery/archive/outbox.py
++new file mode 100644
++index 0000000..c2fefba
++--- /dev/null
+++++ b/job_discovery/archive/outbox.py
++@@ -0,0 +1,188 @@
+++"""Public transaction pairing; no transport, credentials, or activation side effects."""
+++
+++from datetime import UTC
+++from psycopg import sql
+++from psycopg.types.json import Jsonb
+++from job_discovery.lifecycle.claims import validate_claim
+++from job_discovery.lifecycle.config import read_control
+++from job_discovery.lifecycle.capacity import (
+++    reserve_capacity,
+++    bind_reservation,
+++    settle_capacity,
+++)
+++from .codec import canonical_json
+++from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
+++from .types import EventRef
+++
+++WARNING_BYTES, WARNING_EVENTS, WARNING_AGE = 64 * 1024**2, 50000, 900
+++ORDINARY_BYTES, ORDINARY_EVENTS = 112 * 1024**2, 87500
+++HARD_BYTES, HARD_EVENTS = 128 * 1024**2, 100000
+++CRITICAL_BYTES, CRITICAL_EVENTS = 16 * 1024**2, 12500
+++
+++
+++class ArchiveBlocked(RuntimeError):
+++    pass
+++
+++
+++def budget_allows(count: int, size: int, next_size: int, critical: bool) -> bool:
+++    return count + 1 <= (
+++        HARD_EVENTS if critical else ORDINARY_EVENTS
+++    ) and size + next_size <= (HARD_BYTES if critical else ORDINARY_BYTES)
+++
+++
+++def outbox_health(conn) -> dict:
+++    row = conn.execute("""SELECT count(*) events,COALESCE(sum(octet_length(canonical_event)),0) bytes,
+++      COALESCE(extract(epoch FROM clock_timestamp()-min(recorded_at)),0) age_seconds FROM public_pending_events""").fetchone()
+++    row["warning"] = (
+++        row["events"] >= WARNING_EVENTS
+++        or row["bytes"] >= WARNING_BYTES
+++        or row["age_seconds"] >= WARNING_AGE
+++    )
+++    row["ordinary_paused"] = (
+++        row["events"] >= ORDINARY_EVENTS or row["bytes"] >= ORDINARY_BYTES
+++    )
+++    return row
+++
+++
+++def _envelope(row):
+++    eid = event_id(row["aggregate_type"], row["aggregate_id"], row["revision"])
+++    previous = (
+++        event_id(row["aggregate_type"], row["aggregate_id"], row["revision"] - 1)
+++        if row["revision"] > 1
+++        else None
+++    )
+++    return dict(
+++        event_id=str(eid),
+++        aggregate_type=row["aggregate_type"],
+++        aggregate_id=row["aggregate_id"],
+++        revision=row["revision"],
+++        predecessor_id=str(previous) if previous else None,
+++        kind=row["kind"],
+++        body=row["body"],
+++        occurred_at=row["occurred_at"].astimezone(UTC).isoformat(),
+++        schema_version=1,
+++    )
+++
+++
+++def record_public_change(tx, change: PublicChange, claim) -> EventRef:
+++    validate_change(change)
+++    validate_claim(tx, claim)
+++    ctl = read_control(tx)
+++    if ctl.archive_stage != "active":
+++        raise ArchiveBlocked("archive producer inactive or paused")
+++    row = tx.execute(
+++        """SELECT r.* FROM public_change_requirements r
+++      WHERE transaction_id=pg_current_xact_id() AND aggregate_type=%s AND aggregate_id=%s
+++       AND kind=%s AND body=%s AND occurred_at=%s
+++       AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY revision LIMIT 1""",
+++        (
+++            change.aggregate_type,
+++            change.aggregate_id,
+++            change.kind,
+++            Jsonb(change.body),
+++            change.occurred_at,
+++        ),
+++    ).fetchone()
+++    if not row:
+++        raise ValueError("no exact unpaired public mutation in this transaction")
+++    envelope = _envelope(row)
+++    encoded = canonical_json(envelope)
+++    health = outbox_health(tx)
+++    critical = change.kind in {ChangeKind.CLOSED, ChangeKind.REOPENED}
+++    if not budget_allows(health["events"], health["bytes"], len(encoded), critical):
+++        raise ArchiveBlocked("public outbox budget exhausted; mutation must roll back")
+++    reservation = reserve_capacity(
+++        tx, claim, max(65536, len(encoded) * 16 + 32768), critical=critical
+++    )
+++    if reservation is None:
+++        raise ArchiveBlocked(
+++            "physical archive capacity unavailable; mutation must roll back"
+++        )
+++    bind_reservation(tx, reservation, job_id=None, scope="public_outbox")
+++    tx.execute(
+++        """INSERT INTO public_outbox(event_id,requirement_id,aggregate_type,aggregate_id,revision,
+++       predecessor_id,kind,body,occurred_at,canonical_event,body_bytes)
+++       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
+++        (
+++            envelope["event_id"],
+++            row["id"],
+++            change.aggregate_type,
+++            change.aggregate_id,
+++            row["revision"],
+++            envelope["predecessor_id"],
+++            change.kind,
+++            Jsonb(change.body),
+++            change.occurred_at,
+++            encoded,
+++            len(canonical_json(change.body)),
+++        ),
+++    )
+++    settle_capacity(tx, reservation)
+++    return EventRef(
+++        event_id(change.aggregate_type, change.aggregate_id, row["revision"]),
+++        change.aggregate_type,
+++        change.aggregate_id,
+++        row["revision"],
+++    )
+++
+++
+++def flush_public_changes(tx, claim) -> tuple[EventRef, ...]:
+++    if not read_control(tx).archive_ever_activated:
+++        return ()
+++    rows = tx.execute("""SELECT r.* FROM public_change_requirements r WHERE transaction_id=pg_current_xact_id()
+++      AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY r.id""").fetchall()
+++    return tuple(
+++        record_public_change(
+++            tx,
+++            PublicChange(
+++                AggregateType(r["aggregate_type"]),
+++                r["aggregate_id"],
+++                ChangeKind(r["kind"]),
+++                r["body"],
+++                r["occurred_at"],
+++            ),
+++            claim,
+++        )
+++        for r in rows
+++    )
+++
+++
+++def baseline_batch(
+++    tx, aggregate_type: str, claim, *, limit: int = 100
+++) -> tuple[EventRef, ...]:
+++    """Snapshot current rows only; persisted head existence is the bounded checkpoint."""
+++    table = AggregateType(aggregate_type)
+++    if type(limit) is not int or not 1 <= limit <= 100:
+++        raise ValueError("baseline limit must be 1..100")
+++    validate_claim(tx, claim)
+++    if read_control(tx).archive_stage != "active":
+++        raise ArchiveBlocked("baseline requires validated active producer")
+++    identity = "raw" if table == AggregateType.LOCATION else "id"
+++    rows = tx.execute(
+++        sql.SQL("""SELECT t.{identity}::text aid,lifecycle_private.public_projection(%s,to_jsonb(t)) body
+++       FROM {table} t WHERE NOT EXISTS(SELECT FROM public_archive_heads h WHERE h.aggregate_type=%s
+++       AND h.aggregate_id=t.{identity}::text) ORDER BY t.{identity} LIMIT %s""").format(
+++            identity=sql.Identifier(identity), table=sql.Identifier(table)
+++        ),
+++        (table, table, limit),
+++    ).fetchall()
+++    for row in rows:
+++        tx.execute(
+++            "INSERT INTO public_archive_heads VALUES(%s,%s,1)", (table, row["aid"])
+++        )
+++        tx.execute(
+++            """INSERT INTO public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+++          VALUES(%s,%s,1,'baseline',%s)""",
+++            (table, row["aid"], Jsonb(row["body"])),
+++        )
+++    return flush_public_changes(tx, claim)
+++
+++
+++def event_rows(tx, event_ids):
+++    rows = tx.execute(
+++        "SELECT * FROM public_outbox WHERE event_id=ANY(%s)", (list(event_ids),)
+++    ).fetchall()
+++    by_id = {r["event_id"]: r for r in rows}
+++    if set(by_id) != set(event_ids):
+++        raise ArchiveBlocked("exact pending membership missing")
+++    return [by_id[eid] for eid in event_ids]
++diff --git a/job_discovery/archive/schema.py b/job_discovery/archive/schema.py
++new file mode 100644
++index 0000000..e8a40a9
++--- /dev/null
+++++ b/job_discovery/archive/schema.py
++@@ -0,0 +1,259 @@
+++"""Total typed public-change validator. Raw content and private fields are absent."""
+++
+++from dataclasses import dataclass
+++from datetime import datetime
+++from enum import StrEnum
+++from uuid import UUID, uuid5
+++from urllib.parse import urlsplit
+++from .codec import canonical_json
+++
+++EVENT_NAMESPACE = UUID("fb2201d3-79ac-5801-923c-471b7823cb15")
+++
+++
+++class AggregateType(StrEnum):
+++    JOB = "jobs"
+++    SOURCE = "source_accounts"
+++    LISTING = "source_listings"
+++    VERSION = "job_versions"
+++    COMPANY = "companies"
+++    LOCATION = "locations"
+++    BRAND = "brands"
+++    SKILL = "skills"
+++    COMPANY_BRAND = "company_brands"
+++    COMPANY_SOURCE = "company_sources"
+++    JOB_LOCATION = "job_locations"
+++    JOB_SKILL = "job_skills"
+++    IDENTITY = "identity_assertions"
+++
+++
+++class ChangeKind(StrEnum):
+++    BASELINE = "baseline"
+++    UPSERT = "upsert"
+++    CLOSED = "closed"
+++    REOPENED = "reopened"
+++    REMOVED = "removed"
+++
+++
+++# SQL owns the persisted projections; this boundary rejects unknown fields/types.
+++FIELDS = {
+++    "jobs": "id company_id external_id title url location department remote closed_at",
+++    "source_accounts": "id legacy_company_id ats public_board_ref public_url exclusion_state",
+++    "source_listings": "id source_account_id external_id job_id current_version_id current_revision original_discovered_at source_published_at source_published_provenance discovery_anchor_at discovery_anchor_provenance discovery_expires_at source_availability suspected_id_reuse",
+++    "job_versions": "id job_id source_listing_id revision content_hash public_metadata observed_at",
+++    "companies": "id name ats token display_name industry industry_subcategory size hq_country",
+++    "locations": "raw canonicals components source",
+++    "brands": "id name",
+++    "skills": "id canonical_name",
+++}
+++RELATION_FIELDS = "id evidence_kind public_evidence_ref observed_at valid_from valid_to status confidence revision"
+++for _kind, _ends in {
+++    "company_brands": "company_id brand_id",
+++    "company_sources": "company_id source_account_id",
+++    "job_locations": "job_version_id location_id",
+++    "job_skills": "job_version_id skill_id",
+++    "identity_assertions": "left_listing_id right_listing_id relation reviewed_at",
+++}.items():
+++    FIELDS[_kind] = RELATION_FIELDS + " " + _ends
+++UUID_FIELDS = {
+++    "source_account_id",
+++    "current_version_id",
+++    "source_listing_id",
+++    "job_version_id",
+++    "brand_id",
+++    "skill_id",
+++    "left_listing_id",
+++    "right_listing_id",
+++}
+++INT_FIELDS = {"company_id", "legacy_company_id", "revision", "current_revision"}
+++
+++
+++@dataclass(frozen=True)
+++class PublicChange:
+++    aggregate_type: AggregateType
+++    aggregate_id: str
+++    kind: ChangeKind
+++    body: dict
+++    occurred_at: datetime
+++
+++
+++def event_id(kind: str, aggregate_id: str, revision: int) -> UUID:
+++    return uuid5(
+++        EVENT_NAMESPACE, canonical_json([str(kind), aggregate_id, revision]).decode()
+++    )
+++
+++
+++def validate_change(value) -> PublicChange:
+++    if not isinstance(value, PublicChange):
+++        raise ValueError("PublicChange required")
+++    if not isinstance(value.aggregate_type, AggregateType) or not isinstance(
+++        value.kind, ChangeKind
+++    ):
+++        raise ValueError("typed aggregate and change enums required")
+++    if (
+++        not isinstance(value.aggregate_id, str)
+++        or not value.aggregate_id
+++        or len(value.aggregate_id.encode()) > 2048
+++    ):
+++        raise ValueError("bounded aggregate ID required")
+++    if (
+++        not isinstance(value.occurred_at, datetime)
+++        or value.occurred_at.tzinfo is None
+++        or value.occurred_at.utcoffset() is None
+++    ):
+++        raise ValueError("aware public observation time required")
+++    body = value.body
+++    if not isinstance(body, dict) or set(body) - set(
+++        FIELDS[value.aggregate_type].split()
+++    ):
+++        raise ValueError("unknown public fields")
+++    identity = "raw" if value.aggregate_type == AggregateType.LOCATION else "id"
+++    if str(body.get(identity)) != value.aggregate_id:
+++        raise ValueError("aggregate endpoint identity mismatch")
+++    required = {
+++        "jobs": {"id", "company_id", "external_id", "title", "url"},
+++        "source_accounts": {"id", "ats", "public_board_ref"},
+++        "source_listings": {
+++            "id",
+++            "source_account_id",
+++            "external_id",
+++            "job_id",
+++            "current_revision",
+++            "discovery_anchor_at",
+++            "discovery_expires_at",
+++        },
+++        "job_versions": {
+++            "id",
+++            "job_id",
+++            "source_listing_id",
+++            "revision",
+++            "content_hash",
+++            "public_metadata",
+++            "observed_at",
+++        },
+++        "companies": {"id", "name", "ats", "token"},
+++        "locations": {"raw", "canonicals", "components", "source"},
+++        "brands": {"id", "name"},
+++        "skills": {"id", "canonical_name"},
+++        "company_brands": {
+++            "id",
+++            "company_id",
+++            "brand_id",
+++            "revision",
+++            "status",
+++            "evidence_kind",
+++            "public_evidence_ref",
+++        },
+++        "company_sources": {
+++            "id",
+++            "company_id",
+++            "source_account_id",
+++            "revision",
+++            "status",
+++            "evidence_kind",
+++            "public_evidence_ref",
+++        },
+++        "job_locations": {
+++            "id",
+++            "job_version_id",
+++            "location_id",
+++            "revision",
+++            "status",
+++            "evidence_kind",
+++            "public_evidence_ref",
+++        },
+++        "job_skills": {
+++            "id",
+++            "job_version_id",
+++            "skill_id",
+++            "revision",
+++            "status",
+++            "evidence_kind",
+++            "public_evidence_ref",
+++        },
+++        "identity_assertions": {
+++            "id",
+++            "left_listing_id",
+++            "right_listing_id",
+++            "relation",
+++            "revision",
+++            "status",
+++            "evidence_kind",
+++            "public_evidence_ref",
+++        },
+++    }[value.aggregate_type]
+++    if not required <= set(body) or any(body[k] is None for k in required):
+++        raise ValueError("required typed public endpoint fields missing")
+++    try:
+++        for key, item in body.items():
+++            if item is None:
+++                continue
+++            if (
+++                key in UUID_FIELDS
+++                or key == "id"
+++                and value.aggregate_type
+++                not in {AggregateType.JOB, AggregateType.COMPANY}
+++            ):
+++                if not isinstance(item, str):
+++                    raise ValueError("UUID string required")
+++                UUID(item)
+++            elif (
+++                key in INT_FIELDS
+++                or key == "id"
+++                and value.aggregate_type == AggregateType.COMPANY
+++            ):
+++                if type(item) is not int or item < 0:
+++                    raise ValueError("nonnegative integer required")
+++            elif key in {"remote", "suspected_id_reuse"}:
+++                if type(item) is not bool:
+++                    raise ValueError("boolean required")
+++            elif key == "public_metadata":
+++                if not isinstance(item, dict) or set(item) - {
+++                    "title",
+++                    "url",
+++                    "location",
+++                    "department",
+++                    "remote",
+++                    "description_hash",
+++                }:
+++                    raise ValueError("invalid version metadata")
+++                for k, v in item.items():
+++                    if type(v) is not bool if k == "remote" else not isinstance(v, str):
+++                        raise ValueError("invalid metadata value")
+++            elif key in {"canonicals", "components"}:
+++                if not isinstance(item, (list, dict)):
+++                    raise ValueError("structured location field required")
+++            elif key == "confidence":
+++                if type(item) not in {int, float} or not 0 <= item <= 1:
+++                    raise ValueError("confidence outside 0..1")
+++            elif not isinstance(item, str):
+++                raise ValueError("public string required")
+++            if isinstance(item, str) and (
+++                key.endswith("_at") or key in {"valid_from", "valid_to"}
+++            ):
+++                parsed = datetime.fromisoformat(item.replace("Z", "+00:00"))
+++                if parsed.tzinfo is None:
+++                    raise ValueError("aware public timestamp required")
+++            if key in {"url", "public_url", "public_evidence_ref"} and item is not None:
+++                # Legacy mapping evidence is an explicit typed board coordinate.
+++                if (
+++                    key == "public_evidence_ref"
+++                    and body.get("evidence_kind") == "legacy_mapping"
+++                ):
+++                    continue
+++                parsed = urlsplit(item)
+++                if (
+++                    parsed.scheme not in {"http", "https"}
+++                    or not parsed.hostname
+++                    or parsed.username
+++                    or parsed.password
+++                ):
+++                    raise ValueError("public URL required")
+++            if key == "content_hash" and (
+++                len(item) != 64 or any(c not in "0123456789abcdef" for c in item)
+++            ):
+++                raise ValueError("content hash requires sha256 hex")
+++        if len(canonical_json(body)) > 8192:
+++            raise ValueError("public event body exceeds 8KiB")
+++    except (TypeError, OverflowError) as exc:
+++        raise ValueError("invalid public body") from exc
+++    return value
++diff --git a/job_discovery/archive/types.py b/job_discovery/archive/types.py
++new file mode 100644
++index 0000000..878930e
++--- /dev/null
+++++ b/job_discovery/archive/types.py
++@@ -0,0 +1,110 @@
+++"""Immutable service contracts shared by producer, offline codec and later exporter."""
+++
+++from dataclasses import dataclass, field
+++from datetime import datetime
+++from uuid import UUID
+++from job_discovery.lifecycle.types import ClaimRef
+++
+++
+++@dataclass(frozen=True)
+++class EventRef:
+++    event_id: UUID
+++    aggregate_type: str
+++    aggregate_id: str
+++    revision: int
+++
+++
+++@dataclass(frozen=True)
+++class BatchLimits:
+++    max_events: int = 2000
+++    max_expanded_bytes: int = 8 * 1024**2
+++    flush_after_seconds: int = 300
+++
+++    def __post_init__(self):
+++        for value, maximum in [
+++            (self.max_events, 2000),
+++            (self.max_expanded_bytes, 8 * 1024**2),
+++            (self.flush_after_seconds, 300),
+++        ]:
+++            if type(value) is not int or not 1 <= value <= maximum:
+++                raise ValueError("batch limits exceed approved bounds")
+++
+++
+++@dataclass(frozen=True)
+++class BatchRef:
+++    batch_id: UUID
+++    claim: ClaimRef
+++    ordered_event_ids: tuple[UUID, ...]
+++    serializer_version: int
+++    sealed_at: datetime
+++    eligible_until: datetime
+++    event_bytes: tuple[bytes, ...] = field(repr=False)
+++    prior_batch_id: UUID | None = None
+++
+++
+++@dataclass(frozen=True)
+++class SealedBatch:
+++    batch: BatchRef
+++    data_key: str
+++    manifest_key: str
+++    canonical_hash: str
+++    compressed_hash: str
+++    manifest_hash: str
+++    event_count: int
+++    expanded_bytes: int
+++    compressed_bytes: int
+++    manifest_bytes: int
+++    canonical_data: bytes = field(repr=False)
+++    compressed_data: bytes = field(repr=False)
+++    manifest_data: bytes = field(repr=False)
+++
+++    @property
+++    def batch_id(self):
+++        return self.batch.batch_id
+++
+++    @property
+++    def claim(self):
+++        return self.batch.claim
+++
+++    @property
+++    def ordered_event_ids(self):
+++        return self.batch.ordered_event_ids
+++
+++    @property
+++    def serializer_version(self):
+++        return self.batch.serializer_version
+++
+++    @property
+++    def sealed_at(self):
+++        return self.batch.sealed_at
+++
+++    @property
+++    def eligible_until(self):
+++        return self.batch.eligible_until
+++
+++
+++@dataclass(frozen=True)
+++class VerificationReceipt:
+++    key: str
+++    sha256: str
+++    byte_count: int
+++    receipt: str
+++
+++
+++@dataclass(frozen=True)
+++class VerifiedBatch:
+++    seal: SealedBatch
+++    data_receipt: VerificationReceipt
+++    manifest_receipt: VerificationReceipt
+++
+++
+++@dataclass(frozen=True)
+++class AckResult:
+++    exact_event_ids: tuple[UUID, ...]
+++    archived_revision_markers: tuple[tuple[str, str, int], ...]
+++
+++
+++@dataclass(frozen=True)
+++class ProjectionResult:
+++    applied_event_ids: tuple[UUID, ...]
+++    ignored_event_ids: tuple[UUID, ...]
++diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
++index ccb4fde..92cfa19 100644
++--- a/job_discovery/lifecycle/identity.py
+++++ b/job_discovery/lifecycle/identity.py
++@@ -255,39 +255,39 @@ def _source_publication(ats, raw, now):
++         return None
++     try:
++         value = datetime.fromisoformat(value.replace("Z", "+00:00"))
++     except ValueError:
++         return None
++     anchor, provenance = choose_anchor(value, now, now)
++     return anchor if provenance == "source_published" else None
++ 
++ 
++ def _version_room(conn, listing):
++-    # No archive producer exists yet. Retain all evidence and pause rather than
++-    # delete to satisfy a cap, including archived rows still referenced privately.
+++    # Retain evidence until maintenance can retire exact archived, unreferenced
+++    # versions. Private references may continue to prevent retirement.
++     # A changed version would supersede the current row too, so include its age.
++     row = conn.execute(
++         """SELECT count(*) n,
++         bool_or(recorded_at<clock_timestamp()-interval '30 days') old
++         FROM job_versions WHERE source_listing_id=%s""",
++         (listing["id"],),
++     ).fetchone()
++     return row["n"] < 11 and not row["old"]
++ 
++ 
++ def capture_version(
++     conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
++ ) -> UUID | None:
++     """Capture one meaningful public revision, or pause at the retention bound.
++ 
++-    The caller owns the transaction. Archive activation still fails closed in
++-    database triggers until Task 10 pairs every eventful write with its outbox.
+++    The caller owns the transaction. Shared _write pairs meaningful public
+++    projections with the transactional outbox whenever the producer is active.
++     """
++     from .reconcile import _write
++ 
++     allowed = {"title", "url", "location", "department", "remote", "description_hash"}
++     if not isinstance(metadata, dict) or set(metadata) - allowed:
++         raise ValueError("only typed public metadata is accepted")
++     if not isinstance(observed_at, datetime) or observed_at.tzinfo is None:
++         raise ValueError("aware observation timestamp required")
++     normalized = {}
++     for key, value in metadata.items():
++diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
++index 1234b4c..51f6a8a 100644
++--- a/job_discovery/lifecycle/maintenance.py
+++++ b/job_discovery/lifecycle/maintenance.py
++@@ -171,25 +171,26 @@ def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
++                 size += row['question_bytes']
++             retired += 1
++         visited += 1
++         if not complete:
++             break  # Resume this Job; an already-cleared field is simply absent.
++         completed_cursor = job_id
++     return max(visited, retired), retired, size, candidates, completed_cursor
++ 
++ 
++ def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
++-    # A public version may be removed only once its listing revision is archived.
+++    # Exact version/hash coverage is required; a listing watermark cannot certify unknown versions.
++     # FK references are deliberately retained, including terminal private work.
++     rows = conn.execute('''SELECT v.id,v.job_id,octet_length(v.public_metadata::text) AS bytes
++       FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
++-      WHERE v.id IS DISTINCT FROM s.current_version_id AND v.revision<=s.archived_revision
+++      WHERE v.id IS DISTINCT FROM s.current_version_id AND EXISTS(SELECT FROM public_archive_version_coverage c WHERE c.version_id=v.id
+++        AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash)
++       AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
++         (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
++          AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=10)
++       AND NOT EXISTS(SELECT FROM jobs WHERE description_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM job_questions WHERE job_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM job_reviews WHERE job_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM review_corrections WHERE job_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM application_packages WHERE job_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM resume_scores WHERE job_version_id=v.id)
++       AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_version_id=v.id)
++diff --git a/job_discovery/lifecycle/operational.py b/job_discovery/lifecycle/operational.py
++new file mode 100644
++index 0000000..d01dc47
++--- /dev/null
+++++ b/job_discovery/lifecycle/operational.py
++@@ -0,0 +1,424 @@
+++"""Bounded preallocated verification lane; physical MVCC reuse is not guaranteed.
+++
+++Provision only with ordinary positive capacity reservations. Above the guard,
+++reuse existing source claims, listing marks, a per-source transaction receipt and
+++fixed critical event slots. New identities and payloads are never admitted here.
+++"""
+++
+++from time import monotonic
+++import logging
+++import psycopg
+++
+++from .claims import claim_work, cancel_claim
+++from .capacity import reserve_capacity, bind_reservation, settle_capacity
+++from .locks import enter_gate, lock_jobs
+++
+++log = logging.getLogger(__name__)
+++
+++
+++class OperationalDeferred(RuntimeError):
+++    pass
+++
+++
+++def provision(conn, source_id, claim, *, limit=100, critical_slots=16):
+++    if (
+++        type(limit) is not int
+++        or not 1 <= limit <= 100
+++        or type(critical_slots) is not int
+++        or not 0 <= critical_slots <= 100
+++    ):
+++        raise ValueError("preallocation chunk is limited to 100 listings/slots")
+++    reservation = reserve_capacity(conn, claim, 65536 * (limit + critical_slots + 3))
+++    if reservation is None:
+++        return False
+++    bind_reservation(
+++        conn, reservation, job_id=None, scope="lifecycle_operational_sources"
+++    )
+++    conn.execute(
+++        "INSERT INTO lifecycle_operational_sources(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
+++        (source_id,),
+++    )
+++    conn.execute(
+++        "INSERT INTO lifecycle_operational_receipts(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
+++        (source_id,),
+++    )
+++    conn.execute(
+++        """INSERT INTO lifecycle_operational_listings(listing_id,source_id)
+++      SELECT id,source_account_id FROM source_listings l WHERE source_account_id=%s
+++      AND NOT EXISTS(SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id)
+++      ORDER BY id LIMIT %s ON CONFLICT DO NOTHING""",
+++        (source_id, limit),
+++    )
+++    # Slots are global. Never recycle pending/acked history or infer delete credit.
+++    conn.execute(
+++        """INSERT INTO public_critical_event_slots(slot)
+++      SELECT n FROM generate_series(1,12500) n WHERE NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.slot=n)
+++      ORDER BY n LIMIT %s""",
+++        (critical_slots,),
+++    )
+++    settle_capacity(conn, reservation)
+++    return True
+++
+++
+++def _receipt(conn, source_id, claim):
+++    enter_gate(conn)
+++    if conn.execute(
+++        "SELECT 1 FROM lifecycle_operational_receipts WHERE transaction_id=pg_current_xact_id() AND backend_pid=pg_backend_pid() AND source_id<>%s",
+++        (source_id,),
+++    ).fetchone():
+++        raise OperationalDeferred(
+++            "one source operational receipt per transaction required"
+++        )
+++    valid = conn.execute(
+++        """SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s
+++       AND generation=%s AND generation>replay_floor AND state='active' AND lease_until>clock_timestamp()
+++       AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() FOR UPDATE""",
+++        (str(source_id), claim.owner_token, claim.generation),
+++    ).fetchone()
+++    if not valid:
+++        raise OperationalDeferred("existing source claim unavailable or fenced")
+++    conn.execute(
+++        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE kind='source' AND work_id=%s",
+++        (str(source_id),),
+++    )
+++    row = conn.execute(
+++        """UPDATE lifecycle_operational_receipts SET backend_pid=pg_backend_pid(),transaction_id=pg_current_xact_id(),
+++      owner_token=%s,generation=%s,invoking_role=current_user,subject_id=app_user_id(),row_count=CASE WHEN transaction_id=pg_current_xact_id() THEN row_count ELSE 0 END WHERE source_id=%s RETURNING source_id""",
+++        (claim.owner_token, claim.generation, source_id),
+++    ).fetchone()
+++    if not row:
+++        raise OperationalDeferred("source receipt not preallocated")
+++
+++
+++def start(conn, source_id, claim):
+++    _receipt(conn, source_id, claim)
+++    if conn.execute(
+++        """SELECT 1 FROM source_listings l WHERE source_account_id=%s AND NOT EXISTS(
+++       SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id) LIMIT 1""",
+++        (source_id,),
+++    ).fetchone():
+++        raise OperationalDeferred("full existing membership not preallocated")
+++    old = conn.execute(
+++        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s FOR UPDATE",
+++        (source_id,),
+++    ).fetchone()
+++    if old is None:
+++        raise OperationalDeferred("source operational state not preallocated")
+++    conn.execute(
+++        "UPDATE lifecycle_operational_sources SET last_turn_at=clock_timestamp() WHERE source_id=%s",
+++        (source_id,),
+++    )
+++    if old["status"] == "complete" and not old["reconciled"]:
+++        return old["sequence"], True
+++    row = conn.execute(
+++        """UPDATE lifecycle_operational_sources SET sequence=sequence+1,status='running',started_at=clock_timestamp(),
+++       completed_at=NULL,cursor=NULL,reconciled=false,members_seen=0 WHERE source_id=%s RETURNING sequence""",
+++        (source_id,),
+++    ).fetchone()
+++    conn.execute(
+++        "UPDATE source_accounts SET last_attempt_at=clock_timestamp(),last_outcome='attempting' WHERE id=%s",
+++        (source_id,),
+++    )
+++    return row["sequence"], False
+++
+++
+++def _state(conn, source_id, sequence):
+++    row = conn.execute(
+++        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s AND sequence=%s",
+++        (source_id, sequence),
+++    ).fetchone()
+++    if not row:
+++        raise OperationalDeferred("operational sequence replaced")
+++    return row
+++
+++
+++def _flush(conn):
+++    from job_discovery.archive.outbox import budget_allows, outbox_health, _envelope
+++    from job_discovery.archive.codec import canonical_json
+++    from job_discovery.archive.schema import (
+++        PublicChange,
+++        AggregateType,
+++        ChangeKind,
+++        validate_change,
+++    )
+++
+++    rows = conn.execute(
+++        "SELECT * FROM public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated' ORDER BY slot"
+++    ).fetchall()
+++    for row in rows:
+++        validate_change(
+++            PublicChange(
+++                AggregateType(row["aggregate_type"]),
+++                row["aggregate_id"],
+++                ChangeKind(row["kind"]),
+++                row["body"],
+++                row["occurred_at"],
+++            )
+++        )
+++        envelope = _envelope(row)
+++        encoded = canonical_json(envelope)
+++        health = outbox_health(conn)
+++        if not budget_allows(health["events"], health["bytes"], len(encoded), True):
+++            raise OperationalDeferred("critical outbox budget exhausted")
+++        conn.execute(
+++            """UPDATE public_critical_event_slots SET state='pending',event_id=%s,predecessor_id=%s,
+++          canonical_event=%s,padding=''::bytea WHERE slot=%s""",
+++            (envelope["event_id"], envelope["predecessor_id"], encoded, row["slot"]),
+++        )
+++
+++
+++def sightings(conn, source_id, sequence, claim, observations):
+++    if len(observations) > 100:
+++        raise ValueError("operational sighting chunk exceeds 100")
+++    enter_gate(conn)
+++    if _state(conn, source_id, sequence)["status"] != "running":
+++        raise OperationalDeferred("operational enumeration not running")
+++    rows = conn.execute(
+++        """SELECT l.*,p.seen_sequence FROM source_listings l JOIN lifecycle_operational_listings p ON p.listing_id=l.id
+++      WHERE l.source_account_id=%s AND l.external_id=ANY(%s)""",
+++        (source_id, [o[0] for o in observations]),
+++    ).fetchall()
+++    lock_jobs(conn, [r["job_id"] for r in rows])
+++    _receipt(conn, source_id, claim)
+++    by_id = {r["external_id"]: r for r in rows}
+++    for external_id, kind in observations:
+++        if kind not in {"seen", "unlisted", "removed", "expired"}:
+++            continue
+++        row = by_id.get(external_id)
+++        if not row or row["seen_sequence"] >= sequence:
+++            continue
+++        conn.execute(
+++            """UPDATE lifecycle_operational_listings SET seen_sequence=%s,seen_at=clock_timestamp(),seen_kind=%s,
+++          miss_count=0,first_miss_at=NULL WHERE listing_id=%s""",
+++            (sequence, kind, row["id"]),
+++        )
+++        removed = kind in {"removed", "expired"}
+++        conn.execute(
+++            """UPDATE source_listings SET successful_last_observed_at=clock_timestamp(),
+++          successful_sighting_count=successful_sighting_count+%s,source_availability=CASE WHEN %s THEN 'closed'
+++          WHEN source_availability='closed' THEN 'open' ELSE source_availability END,
+++          consecutive_complete_misses=0,first_complete_miss_at=NULL WHERE id=%s""",
+++            (0 if removed else 1, removed, row["id"]),
+++        )
+++        conn.execute(
+++            "UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,clock_timestamp()) ELSE NULL END WHERE id=%s",
+++            (removed, row["job_id"]),
+++        )
+++        _flush(conn)
+++        row["seen_sequence"] = sequence
+++    conn.execute(
+++        "UPDATE lifecycle_operational_sources SET members_seen=members_seen+%s WHERE source_id=%s",
+++        (len(observations), source_id),
+++    )
+++
+++
+++def complete(conn, source_id, sequence, claim, *, successful, failed=False):
+++    _receipt(conn, source_id, claim)
+++    state = _state(conn, source_id, sequence)
+++    if state["status"] != "running":
+++        raise OperationalDeferred("operational enumeration already terminal")
+++    open_count = conn.execute(
+++        """SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
+++      WHERE l.source_account_id=%s AND j.closed_at IS NULL""",
+++        (source_id,),
+++    ).fetchone()["n"]
+++    suspicious = state["members_seen"] == 0 and open_count > 20
+++    status = (
+++        "complete"
+++        if successful and not suspicious
+++        else ("failed" if failed else "partial")
+++    )
+++    conn.execute(
+++        """UPDATE lifecycle_operational_sources SET status=%s,completed_at=clock_timestamp(),reconciled=%s WHERE source_id=%s""",
+++        (status, status != "complete", source_id),
+++    )
+++    conn.execute(
+++        """UPDATE source_accounts SET last_outcome=%s,last_complete_success_at=CASE WHEN %s THEN clock_timestamp() ELSE last_complete_success_at END,
+++      failure_streak=CASE WHEN %s THEN 0 ELSE failure_streak+1 END,suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
+++      next_due_at=(date_trunc('day',last_attempt_at AT TIME ZONE 'UTC')+interval '24 hours' * CASE WHEN exclusion_state='failure_disabled' AND NOT %s
+++       THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC' WHERE id=%s""",
+++        (
+++            "suspicious_empty" if suspicious else status,
+++            status == "complete",
+++            status == "complete",
+++            suspicious,
+++            status == "complete",
+++            source_id,
+++        ),
+++    )
+++    return status
+++
+++
+++def reconcile(conn, source_id, sequence, claim, *, limit=100):
+++    if type(limit) is not int or not 1 <= limit <= 100:
+++        raise ValueError("operational reconcile chunk exceeds 100")
+++    enter_gate(conn)
+++    state = _state(conn, source_id, sequence)
+++    if state["status"] != "complete":
+++        return True
+++    if state["reconciled"]:
+++        return True
+++    rows = conn.execute(
+++        """SELECT p.*,l.job_id,l.successful_last_observed_at FROM lifecycle_operational_listings p
+++       JOIN source_listings l ON l.id=p.listing_id WHERE p.source_id=%s
+++       AND (%s::uuid IS NULL OR p.listing_id>%s) ORDER BY p.listing_id LIMIT %s""",
+++        (source_id, state["cursor"], state["cursor"], limit),
+++    ).fetchall()
+++    lock_jobs(conn, [r["job_id"] for r in rows])
+++    _receipt(conn, source_id, claim)
+++    for row in rows:
+++        if (
+++            row["seen_sequence"] >= sequence
+++            or row["miss_sequence"] >= sequence
+++            or row["successful_last_observed_at"]
+++            and row["successful_last_observed_at"] >= state["started_at"]
+++        ):
+++            continue
+++        result = conn.execute(
+++            """UPDATE lifecycle_operational_listings SET miss_sequence=%s,miss_count=LEAST(2,miss_count+1),
+++           first_miss_at=COALESCE(first_miss_at,%s) WHERE listing_id=%s
+++           RETURNING miss_count>=2 AND %s>=first_miss_at+interval '24 hours' closed,miss_count,first_miss_at""",
+++            (sequence, state["completed_at"], row["listing_id"], state["completed_at"]),
+++        ).fetchone()
+++        conn.execute(
+++            """UPDATE source_listings SET consecutive_complete_misses=%s,first_complete_miss_at=%s,
+++          source_availability=CASE WHEN %s THEN 'closed' ELSE source_availability END WHERE id=%s""",
+++            (
+++                result["miss_count"],
+++                result["first_miss_at"],
+++                result["closed"],
+++                row["listing_id"],
+++            ),
+++        )
+++        if result["closed"]:
+++            conn.execute(
+++                "UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s",
+++                (state["completed_at"], row["job_id"]),
+++            )
+++        _flush(conn)
+++    done = len(rows) < limit
+++    conn.execute(
+++        "UPDATE lifecycle_operational_sources SET cursor=%s,reconciled=%s WHERE source_id=%s",
+++        (rows[-1]["listing_id"] if rows else state["cursor"], done, source_id),
+++    )
+++    return done
+++
+++
+++def run_due(conn, *, max_boards, deadline):
+++    """Stream complete existing-ID membership; every commit is independently fenced."""
+++    from job_discovery.adapters import ADAPTERS
+++    from job_discovery.adapters.completeness import source_budget, SourceBudgetExceeded
+++
+++    sources = conn.execute(
+++        """SELECT s.* FROM source_accounts s JOIN lifecycle_operational_sources p ON p.source_id=s.id
+++      WHERE s.exclusion_state IN ('enabled','failure_disabled') AND (s.next_due_at IS NULL OR s.next_due_at<=clock_timestamp()
+++       OR p.status='complete' AND NOT p.reconciled)
+++      ORDER BY GREATEST(s.last_attempt_at,p.last_turn_at) NULLS FIRST,s.id LIMIT %s""",
+++        (max_boards,),
+++    ).fetchall()
+++    conn.commit()
+++    missing = conn.execute(
+++        "SELECT count(*) n FROM source_accounts s WHERE exclusion_state IN ('enabled','failure_disabled') AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()) AND NOT EXISTS(SELECT FROM lifecycle_operational_sources p WHERE p.source_id=s.id)"
+++    ).fetchone()["n"]
+++    conn.commit()
+++    progress = {"complete": 0, "deferred": missing}
+++    for source in sources:
+++        if monotonic() >= deadline:
+++            break
+++        claim = None
+++        try:
+++            # This lane can only reuse a claim row provisioned by ordinary admission.
+++            enter_gate(conn)
+++            if not conn.execute(
+++                "SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s",
+++                (str(source["id"]),),
+++            ).fetchone():
+++                raise OperationalDeferred("source claim not preallocated")
+++            claim = claim_work(conn, "source", str(source["id"]), 180)
+++            if claim is None:
+++                conn.rollback()
+++                continue
+++            sequence, resuming = start(conn, source["id"], claim)
+++            conn.commit()
+++            if not resuming:
+++                success = False
+++                failed = False
+++                pending = []
+++                try:
+++
+++                    def pulse():
+++                        _receipt(conn, source["id"], claim)
+++                        conn.execute(
+++                            "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE owner_token=%s AND generation=%s",
+++                            (claim.owner_token, claim.generation),
+++                        )
+++                        conn.commit()
+++
+++                    with source_budget(
+++                        min(60, max(0, deadline - monotonic())), 50, pulse
+++                    ):
+++                        feed = ADAPTERS[source["ats"]](
+++                            source["public_board_ref"], fetch_details=False
+++                        )
+++                        for count, posting in enumerate(feed, 1):
+++                            if count > 10000:
+++                                break
+++                            pending.append(
+++                                (
+++                                    posting.external_id,
+++                                    "unlisted"
+++                                    if (posting.raw or {}).get("isListed") is False
+++                                    else "seen",
+++                                )
+++                            )
+++                            if len(pending) >= 100:
+++                                sightings(conn, source["id"], sequence, claim, pending)
+++                                conn.commit()
+++                                pending = []
+++                        else:
+++                            success = feed.complete
+++                except OperationalDeferred:
+++                    raise
+++                except psycopg.Error as exc:
+++                    raise OperationalDeferred(
+++                        "operational storage transaction deferred"
+++                    ) from exc
+++                except SourceBudgetExceeded:
+++                    conn.rollback()
+++                except Exception:
+++                    conn.rollback()
+++                    failed = True
+++                if pending:
+++                    sightings(conn, source["id"], sequence, claim, pending)
+++                    conn.commit()
+++                status = complete(
+++                    conn,
+++                    source["id"],
+++                    sequence,
+++                    claim,
+++                    successful=success,
+++                    failed=failed,
+++                )
+++                conn.commit()
+++                if status != "complete":
+++                    continue
+++            while monotonic() < deadline:
+++                done = reconcile(conn, source["id"], sequence, claim)
+++                conn.commit()
+++                if done:
+++                    progress["complete"] += 1
+++                    break
+++        except Exception as error:
+++            conn.rollback()
+++            log.warning(
+++                "source %s operational progress storage-deferred (%s)",
+++                source["id"],
+++                type(error).__name__,
+++            )
+++            progress["deferred"] += 1
+++        finally:
+++            if claim:
+++                conn.rollback()
+++                cancel_claim(conn, claim)
+++                conn.commit()
+++    return progress
++diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
++index 64789a2..402bf07 100644
++--- a/job_discovery/lifecycle/reconcile.py
+++++ b/job_discovery/lifecycle/reconcile.py
++@@ -33,20 +33,22 @@ class StorageBlocked(RuntimeError):
++ 
++ 
++ @contextmanager
++ def _write(conn, claim, scope, job_id=None, size=32768):
++     """Use the established reservation contract; never bypass enforced charging."""
++     reservation = reserve_capacity(conn, claim, size)
++     if reservation is None:
++         raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
++     bind_reservation(conn, reservation, job_id=job_id, scope=scope)
++     yield
+++    from job_discovery.archive.outbox import flush_public_changes
+++    flush_public_changes(conn, claim)
++     settle_capacity(conn, reservation)
++ 
++ 
++ def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
++     enter_gate(conn)
++     if not read_control(conn).source_enabled:
++         return None
++     # Order by the last claimed work turn, including reconciliation-only turns.
++     # The persisted lease start prevents a huge pending tail starving other
++     # sources while last_attempt_at continues to mean an actual feed attempt.
++@@ -58,20 +60,22 @@ def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
++           AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
++             AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
++         ORDER BY GREATEST(last_attempt_at,lease_until-interval '180 seconds') NULLS FIRST,
++                  last_complete_success_at NULLS FIRST,id
++         LIMIT 1""").fetchone()
++     if not source:
++         return None
++     claim = claim_work(conn, 'source', str(source['id']), 180)
++     if claim is None:
++         raise StorageBlocked('source claim storage blocked; reconciliation deferred')
+++    from .operational import provision
+++    provision(conn,source['id'],claim)
++     pending = conn.execute('''SELECT 1 FROM source_enumerations WHERE source_id=%s
++         AND status='complete' AND reconciled_at IS NULL AND sequence>%s LIMIT 1''',
++         (source['id'],source['replay_floor'])).fetchone() is not None
++     with _write(conn, claim, 'source_accounts'):
++         conn.execute("""UPDATE source_accounts SET last_attempt_at=CASE WHEN %s THEN last_attempt_at ELSE clock_timestamp() END,
++             last_outcome=CASE WHEN %s THEN last_outcome ELSE 'attempting' END,
++             claim_owner_token=%s,claim_generation=%s,lease_until=%s WHERE id=%s""",
++             (pending,pending,claim.owner_token,claim.generation,claim.lease_until,source['id']))
++     return source, claim
++ 
++@@ -381,39 +385,15 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
++             health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
++             log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
++         finally:
++             conn.rollback()
++             cancel_claim(conn,claim)
++             conn.commit()
++     return result
++ 
++ 
++ def verify_storage_blocked(conn, *, max_boards, deadline):
++-    """Read-only fallback: healthy feeds are storage-deferred, never source-failed.
++-
++-    Existing enforced source metadata writes require physical reservations. Do
++-    not weaken that contract: report health in logs until persistence can resume.
++-    """
++-    from job_discovery.adapters import ADAPTERS
++-    from job_discovery.adapters.completeness import source_budget
++-    sources = conn.execute("""WITH due AS (SELECT *,row_number() OVER(ORDER BY last_attempt_at NULLS FIRST,id)-1 AS position,
++-         count(*) OVER() AS total FROM source_accounts
++-         WHERE exclusion_state IN ('enabled','failure_disabled')
++-         AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()))
++-       SELECT * FROM due ORDER BY mod(position-mod(floor(extract(epoch FROM clock_timestamp())/86400)::bigint,total)+total,total)
++-       LIMIT %s""", (max_boards,)).fetchall()
++-    conn.commit()
++-    for source in sources:
++-        if monotonic() >= deadline:
++-            break
++-        try:
++-            with source_budget(min(BOARD_SECONDS,deadline-monotonic()),BOARD_REQUESTS):
++-                feed = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
++-                for count, _ in enumerate(feed,1):
++-                    if count >= BOARD_ROWS:
++-                        break
++-                health = 'healthy' if feed.complete else 'partial'
++-        except SourceBudgetExceeded:
++-            health = 'partial'
++-        except Exception:
++-            health = 'failed'
++-        log.warning('source %s attempted: %s; storage-blocked, reconciliation-deferred',source['id'],health)
+++    """Persist bounded existing-source evidence through the preallocated lane."""
+++    from .operational import run_due
+++    progress = run_due(conn,max_boards=max_boards,deadline=deadline)
+++    log.warning('source operational verification: %s; missing slots/readiness remain storage-deferred',progress)
+++    return progress
++diff --git a/migrations/2026-10-03-04-public-outbox.sql b/migrations/2026-10-03-04-public-outbox.sql
++new file mode 100644
++index 0000000..050e898
++--- /dev/null
+++++ b/migrations/2026-10-03-04-public-outbox.sql
++@@ -0,0 +1,622 @@
+++-- Task10: transactional public projections, exact membership and durable receipts.
+++-- Defaults and destination/readiness guards remain unchanged: no activation here.
+++CREATE TABLE IF NOT EXISTS public_archive_heads (
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+++ PRIMARY KEY(aggregate_type,aggregate_id)
+++);
+++CREATE TABLE IF NOT EXISTS public_change_requirements (
+++ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+++ transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL,
+++ kind text NOT NULL CHECK(kind IN ('baseline','upsert','closed','reopened','removed')),
+++ body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8192),
+++ occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ UNIQUE(aggregate_type,aggregate_id,revision)
+++);
+++CREATE TABLE IF NOT EXISTS public_outbox (
+++ event_id uuid PRIMARY KEY,
+++ requirement_id bigint NOT NULL UNIQUE REFERENCES public_change_requirements(id),
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+++ predecessor_id uuid, kind text NOT NULL,
+++ body jsonb NOT NULL, occurred_at timestamptz NOT NULL,
+++ canonical_event bytea NOT NULL CHECK(octet_length(canonical_event)<=12288),
+++ body_bytes integer NOT NULL CHECK(body_bytes BETWEEN 1 AND 8192),
+++ recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ UNIQUE(aggregate_type,aggregate_id,revision)
+++);
+++CREATE INDEX IF NOT EXISTS idx_public_outbox_pending ON public_outbox(recorded_at,event_id);
+++CREATE TABLE IF NOT EXISTS public_archive_batches (
+++ batch_id uuid PRIMARY KEY, owner_token text NOT NULL,generation bigint NOT NULL,
+++ serializer_version integer NOT NULL CHECK(serializer_version=1),
+++ state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','sealed','acked')),
+++ sealed_at timestamptz NOT NULL,eligible_until timestamptz NOT NULL,
+++ prior_batch_id uuid REFERENCES public_archive_batches(batch_id),
+++ data_key text,manifest_key text,canonical_hash text,compressed_hash text,manifest_hash text,
+++ event_count integer NOT NULL CHECK(event_count BETWEEN 1 AND 2000),
+++ expanded_bytes integer NOT NULL CHECK(expanded_bytes BETWEEN 1 AND 8388608),
+++ compressed_bytes integer,manifest_bytes integer,acked_at timestamptz,
+++ CHECK(eligible_until=sealed_at+interval '17520 hours'),
+++ CHECK(state='claimed' OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
+++ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
+++ AND manifest_bytes BETWEEN 1 AND 1048576))
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_items (
+++ batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),position integer NOT NULL,
+++ event_id uuid NOT NULL UNIQUE,aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+++ canonical_event bytea NOT NULL,
+++ PRIMARY KEY(batch_id,position),CHECK(position BETWEEN 0 AND 1999)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_receipts (
+++ batch_id uuid PRIMARY KEY REFERENCES public_archive_batches(batch_id),
+++ data_receipt jsonb NOT NULL,manifest_receipt jsonb NOT NULL,
+++ verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_coverage (
+++ aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+++ event_id uuid NOT NULL UNIQUE,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+++ archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ PRIMARY KEY(aggregate_type,aggregate_id,revision)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_suppressions (
+++ aggregate_type text NOT NULL,aggregate_id text NOT NULL,suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ reason text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_version_coverage (
+++ version_id uuid PRIMARY KEY,source_listing_id uuid NOT NULL,version_revision bigint NOT NULL,
+++ content_hash text NOT NULL,event_id uuid NOT NULL,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+++ archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
+++);
+++CREATE OR REPLACE FUNCTION lifecycle_private.public_projection(t text,n jsonb) RETURNS jsonb
+++LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
+++DECLARE fields text[]; result jsonb;
+++BEGIN
+++ CASE t
+++ WHEN 'jobs' THEN fields:=ARRAY['id','company_id','external_id','title','url','location','department','remote','closed_at'];
+++ WHEN 'source_accounts' THEN fields:=ARRAY['id','legacy_company_id','ats','public_board_ref','public_url','exclusion_state'];
+++ WHEN 'source_listings' THEN fields:=ARRAY['id','source_account_id','external_id','job_id','current_version_id','current_revision','original_discovered_at','source_published_at','source_published_provenance','discovery_anchor_at','discovery_anchor_provenance','discovery_expires_at','source_availability','suspected_id_reuse'];
+++ WHEN 'job_versions' THEN fields:=ARRAY['id','job_id','source_listing_id','revision','content_hash','public_metadata','observed_at'];
+++ WHEN 'companies' THEN fields:=ARRAY['id','name','ats','token','display_name','industry','industry_subcategory','size','hq_country'];
+++ WHEN 'locations' THEN fields:=ARRAY['raw','canonicals','components','source'];
+++ WHEN 'brands' THEN fields:=ARRAY['id','name'];
+++ WHEN 'skills' THEN fields:=ARRAY['id','canonical_name'];
+++ WHEN 'company_brands' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','brand_id'];
+++ WHEN 'company_sources' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','source_account_id'];
+++ WHEN 'job_locations' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','location_id'];
+++ WHEN 'job_skills' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','skill_id'];
+++ WHEN 'identity_assertions' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','left_listing_id','right_listing_id','relation','reviewed_at'];
+++ ELSE RETURN NULL;
+++ END CASE;
+++ SELECT jsonb_object_agg(key,value) INTO result FROM jsonb_each(n) WHERE key=ANY(fields);
+++ RETURN result;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.public_projection(text,jsonb) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text;
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+++ -- Safe local version retirement does not assert disappearance of public facts.
+++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+++  ELSE 'upsert' END;
+++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.require_public_change() FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
+++  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
+++  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at) THEN
+++  RAISE EXCEPTION 'public change requires exact transactional outbox event';
+++ END IF;
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_public_pair() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS public_pair ON public_change_requirements;
+++CREATE CONSTRAINT TRIGGER public_pair AFTER INSERT ON public_change_requirements DEFERRABLE INITIALLY DEFERRED
+++FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_public_pair();
+++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
+++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
+++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
+++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
+++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
+++  RAISE EXCEPTION 'immutable pending membership';
+++ END IF;
+++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
+++  IF (to_jsonb(NEW)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
+++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
+++   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
+++  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
+++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
+++  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
+++  RETURN NEW;
+++ END IF;
+++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
+++  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
+++  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
+++   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
+++     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
+++ END IF;
+++ RAISE EXCEPTION 'immutable pending event or archive history';
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.preserve_archive_row() FROM PUBLIC,anon,authenticated;
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['public_archive_heads','public_change_requirements','public_outbox','public_archive_batches','public_archive_items','public_archive_receipts','public_archive_coverage','public_archive_suppressions','public_archive_version_coverage'] LOOP
+++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+++  IF t<>'public_archive_heads' THEN
+++   EXECUTE format('DROP TRIGGER IF EXISTS archive_immutable ON public.%I',t);
+++   EXECUTE format('CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+++  END IF;
+++  EXECUTE format('DROP TRIGGER IF EXISTS archive_no_truncate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+++ END LOOP;
+++ FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
+++  EXECUTE format('DROP TRIGGER IF EXISTS archive_public_change ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER archive_public_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.require_public_change()',t);
+++ END LOOP;
+++END $$;
+++REVOKE ALL ON SEQUENCE public_change_requirements_id_seq FROM PUBLIC,anon,authenticated;
+++
+++CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+++SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+++ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+++ rid uuid; json_keys text[];
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+++ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+++ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+++ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+++ IF ctl.safety_stage<>'enforced' THEN
+++  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+++  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+++   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+++   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+++  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+++   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+++   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+++  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+++ END IF;
+++ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+++ owner_id:=(n->>'user_id')::uuid;
+++ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+++  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+++ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+++ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+++ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+++ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+++ IF protection THEN
+++  vid:=n->>'job_version_id';
+++  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+++    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+++   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+++ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+++ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+++  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+++  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+++    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+++   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+++ END IF;
+++ -- Payload fields are charged on every rewrite, including same-size replacements;
+++ -- a prior DELETE or shrink never supplies physical allocation credit.
+++ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+++  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+++  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+++  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+++   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+++   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+++  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+++   oldpayload:=o->>k;
+++   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+++     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+++       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+++       OR jsonb_typeof(n->k)='string' AND
+++       (octet_length(payload)>256 OR (k NOT IN (
+++        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+++        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+++        'description_capture_provenance','capture_provenance','description_version_id',
+++        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+++   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+++  END LOOP;
+++  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+++ ELSE
+++  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+++ END IF;
+++ IF growth>0 THEN
+++  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+++  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+++ END IF;
+++ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+++ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+++ RETURN NEW;
+++END $$;
+++
+++REVOKE ALL ON FUNCTION lifecycle_validate_row() FROM PUBLIC,anon,authenticated;
+++INSERT INTO schema_migrations(filename) VALUES('2026-10-03-04-public-outbox.sql') ON CONFLICT DO NOTHING;
+++-- R6-4: provision below the physical guard, then reuse only fixed operational rows.
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_sources (
+++ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+++ sequence bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'idle'
+++ CHECK(status IN ('idle','running','complete','partial','failed')),
+++ started_at timestamptz,completed_at timestamptz,last_turn_at timestamptz,cursor uuid,reconciled boolean NOT NULL DEFAULT true,
+++ members_seen bigint NOT NULL DEFAULT 0
+++);
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_listings (
+++ listing_id uuid PRIMARY KEY REFERENCES source_listings(id),source_id uuid NOT NULL REFERENCES source_accounts(id),
+++ seen_sequence bigint NOT NULL DEFAULT 0,seen_at timestamptz,seen_kind text,
+++ miss_sequence bigint NOT NULL DEFAULT 0,miss_count integer NOT NULL DEFAULT 0 CHECK(miss_count BETWEEN 0 AND 2),
+++ first_miss_at timestamptz,
+++ CHECK(seen_kind IS NULL OR seen_kind IN ('seen','unlisted','removed','expired'))
+++);
+++CREATE INDEX IF NOT EXISTS operational_listing_source ON lifecycle_operational_listings(source_id,listing_id);
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_receipts (
+++ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+++ backend_pid integer,transaction_id xid8,owner_token text,generation bigint,invoking_role name,subject_id uuid,
+++ row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 500)
+++);
+++CREATE TABLE IF NOT EXISTS public_critical_event_slots (
+++ slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 12500),
+++ state text NOT NULL DEFAULT 'free' CHECK(state IN ('free','allocated','pending','acked')),
+++ transaction_id xid8,source_id uuid,aggregate_type text,aggregate_id text,revision bigint,
+++ event_id uuid UNIQUE,predecessor_id uuid,kind text,body jsonb,occurred_at timestamptz,
+++ canonical_event bytea,recorded_at timestamptz,
+++ padding bytea NOT NULL DEFAULT decode(repeat('00',24576),'hex'),
+++ CHECK(body IS NULL OR octet_length(body::text)<=8192),
+++ CHECK(canonical_event IS NULL OR octet_length(canonical_event)<=12288),
+++ CHECK(state='free' OR (aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL AND revision IS NOT NULL)),
+++ CHECK(state NOT IN ('pending','acked') OR (event_id IS NOT NULL AND canonical_event IS NOT NULL))
+++);
+++ALTER TABLE public_critical_event_slots ALTER COLUMN padding SET STORAGE EXTERNAL;
+++CREATE OR REPLACE VIEW public_pending_events AS
+++ SELECT event_id,requirement_id,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+++ canonical_event,body_bytes,recorded_at FROM public_outbox
+++ UNION ALL
+++ SELECT event_id,NULL::bigint,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+++ canonical_event,octet_length(body::text),recorded_at FROM public_critical_event_slots WHERE state='pending';
+++REVOKE ALL ON public_pending_events FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.operational_receipt_valid(sid uuid) RETURNS boolean
+++LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+++ SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
+++ ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
+++ WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
+++ AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
+++ AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
+++ AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
+++$$;
+++REVOKE ALL ON FUNCTION lifecycle_private.operational_receipt_valid(uuid) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE sid uuid; fields text[];
+++BEGIN
+++ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+++  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak'];
+++ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+++  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+++ ELSIF t='jobs' THEN
+++  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+++    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+++  fields:=ARRAY['closed_at'];
+++ ELSE RETURN false;
+++ END IF;
+++ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+++ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+++ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+++ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+++  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+++ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+++ RETURN true;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_receipt() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+++  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
+++ IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
+++ IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
+++  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_receipt() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS operational_commit_receipt ON lifecycle_operational_receipts;
+++CREATE CONSTRAINT TRIGGER operational_commit_receipt AFTER UPDATE ON lifecycle_operational_receipts
+++DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_receipt();
+++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+++BEGIN
+++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+++ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+++ IF OLD.state='free' AND NEW.state='allocated' THEN
+++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+++ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+++   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+++      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+++   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+++ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+++  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+++   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+++   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+++ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+++  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+++  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batches b USING(batch_id)
+++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id AND b.state='acked'
+++    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+++ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+++ IF NEW.state='pending' THEN
+++  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+++  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+++    OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+++    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+++    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+++   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+++  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+++    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+++  SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO total_count,total_bytes FROM public.public_pending_events;
+++  IF total_count+1>100000 OR total_bytes+octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+++ END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.preserve_operational_slot() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS critical_slot_integrity ON public_critical_event_slots;
+++CREATE TRIGGER critical_slot_integrity BEFORE UPDATE OR DELETE ON public_critical_event_slots
+++FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+++DROP TRIGGER IF EXISTS critical_slot_no_truncate ON public_critical_event_slots;
+++CREATE TRIGGER critical_slot_no_truncate BEFORE TRUNCATE ON public_critical_event_slots
+++FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings','lifecycle_operational_receipts','public_critical_event_slots'] LOOP
+++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+++ END LOOP;
+++END $$;
+++
+++CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+++SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+++ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+++ rid uuid; json_keys text[];
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+++ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+++ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+++ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+++ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+++  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+++ END IF;
+++ IF ctl.safety_stage<>'enforced' THEN
+++  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+++  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+++   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+++   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+++  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+++   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+++   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+++  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+++ END IF;
+++ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+++ owner_id:=(n->>'user_id')::uuid;
+++ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+++  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+++ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+++ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+++ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+++ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+++ IF protection THEN
+++  vid:=n->>'job_version_id';
+++  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+++    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+++   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+++ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+++ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+++  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+++  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+++    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+++   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+++ END IF;
+++ -- Payload fields are charged on every rewrite, including same-size replacements;
+++ -- a prior DELETE or shrink never supplies physical allocation credit.
+++ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+++  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+++  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+++  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+++   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+++   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+++  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+++   oldpayload:=o->>k;
+++   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+++     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+++       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+++       OR jsonb_typeof(n->k)='string' AND
+++       (octet_length(payload)>256 OR (k NOT IN (
+++        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+++        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+++        'description_capture_provenance','capture_provenance','description_version_id',
+++        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+++   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+++  END LOOP;
+++  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+++ ELSE
+++  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+++ END IF;
+++ IF growth>0 THEN
+++  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+++  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+++ END IF;
+++ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+++ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+++ RETURN NEW;
+++END $$;
+++
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer;
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+++ -- Safe local version retirement does not assert disappearance of public facts.
+++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+++ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+++  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+++ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+++  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+++ IF sid IS NOT NULL THEN
+++  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+++ ELSE
+++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+++ END IF;
+++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+++  ELSE 'upsert' END;
+++ IF sid IS NOT NULL THEN
+++  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+++  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+++  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+++  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+++   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp()
+++   WHERE slot=slot_id;
+++  RETURN NULL;
+++ END IF;
+++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+++ RETURN NULL;
+++END $$;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+++BEGIN
+++ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+++ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at)
+++ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at) THEN
+++  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+++ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+++ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+++  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+++  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+++ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+++ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+++ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+++ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+++ OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+++  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+++ SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO usage_count,usage_bytes FROM public.public_pending_events;
+++ critical:=NEW.kind IN ('closed','reopened');
+++ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+++ OR usage_bytes+octet_length(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+++  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_outbox_insert() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS a_outbox_contract ON public_outbox;
+++CREATE TRIGGER a_outbox_contract BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_outbox_insert();
+++DROP TRIGGER IF EXISTS lifecycle_validate ON public_outbox;
+++CREATE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_archive_item() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE b public.public_archive_batches;
+++BEGIN
+++ SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
+++ IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
+++  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
+++  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
+++  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_archive_item() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS archive_item_insert ON public_archive_items;
+++CREATE TRIGGER archive_item_insert BEFORE INSERT ON public_archive_items FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_archive_item();
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_state() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE sid uuid;
+++BEGIN
+++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'preallocated operational identity cannot be deleted or truncated'; END IF;
+++ sid:=NEW.source_id;
+++ IF sid<>OLD.source_id OR NOT lifecycle_private.operational_receipt_valid(sid) THEN
+++  RAISE EXCEPTION 'operational update requires same-source current receipt'; END IF;
+++ IF TG_TABLE_NAME='lifecycle_operational_listings' AND to_jsonb(NEW)->>'listing_id' IS DISTINCT FROM to_jsonb(OLD)->>'listing_id' THEN
+++  RAISE EXCEPTION 'operational listing identity immutable'; END IF;
+++ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
+++  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+++ END LOOP;
+++END $$;
++diff --git a/pyproject.toml b/pyproject.toml
++index bd8b760..140358a 100644
++--- a/pyproject.toml
+++++ b/pyproject.toml
++@@ -19,15 +19,15 @@ dev = ["pytest>=8.0", "ruff==0.15.20"]
++ testpaths = ["tests"]
++ markers = [
++     "integration: tests that require TEST_DATABASE_URL (a throwaway Postgres)",
++ ]
++ 
++ [build-system]
++ requires = ["setuptools>=68"]
++ build-backend = "setuptools.build_meta"
++ 
++ [tool.setuptools]
++-packages = ["job_discovery", "job_discovery.adapters", "job_discovery.lifecycle", "reviewer", "company_discovery", "observability"]
+++packages = ["job_discovery", "job_discovery.adapters", "job_discovery.lifecycle", "job_discovery.archive", "reviewer", "company_discovery", "observability"]
++ 
++ [tool.ruff.lint.per-file-ignores]
++ # Tests intentionally import after module-level env/stub setup.
++ "tests/*" = ["E402"]
++diff --git a/schema.sql b/schema.sql
++index e84bbc0..bb27b29 100644
++--- a/schema.sql
+++++ b/schema.sql
++@@ -2248,10 +2248,633 @@ RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalo
++       THEN p_legacy_closed_at IS NOT NULL
++     WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
++     WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
++     ELSE false END
++   FROM public.lifecycle_control ctl WHERE ctl.singleton
++ $$;
++ REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
++ GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
++ INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
++ COMMIT;
+++
+++-- Task10: transactional public projections, exact membership and durable receipts.
+++-- Defaults and destination/readiness guards remain unchanged: no activation here.
+++CREATE TABLE IF NOT EXISTS public_archive_heads (
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+++ PRIMARY KEY(aggregate_type,aggregate_id)
+++);
+++CREATE TABLE IF NOT EXISTS public_change_requirements (
+++ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+++ transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL,
+++ kind text NOT NULL CHECK(kind IN ('baseline','upsert','closed','reopened','removed')),
+++ body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8192),
+++ occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ UNIQUE(aggregate_type,aggregate_id,revision)
+++);
+++CREATE TABLE IF NOT EXISTS public_outbox (
+++ event_id uuid PRIMARY KEY,
+++ requirement_id bigint NOT NULL UNIQUE REFERENCES public_change_requirements(id),
+++ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+++ predecessor_id uuid, kind text NOT NULL,
+++ body jsonb NOT NULL, occurred_at timestamptz NOT NULL,
+++ canonical_event bytea NOT NULL CHECK(octet_length(canonical_event)<=12288),
+++ body_bytes integer NOT NULL CHECK(body_bytes BETWEEN 1 AND 8192),
+++ recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ UNIQUE(aggregate_type,aggregate_id,revision)
+++);
+++CREATE INDEX IF NOT EXISTS idx_public_outbox_pending ON public_outbox(recorded_at,event_id);
+++CREATE TABLE IF NOT EXISTS public_archive_batches (
+++ batch_id uuid PRIMARY KEY, owner_token text NOT NULL,generation bigint NOT NULL,
+++ serializer_version integer NOT NULL CHECK(serializer_version=1),
+++ state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','sealed','acked')),
+++ sealed_at timestamptz NOT NULL,eligible_until timestamptz NOT NULL,
+++ prior_batch_id uuid REFERENCES public_archive_batches(batch_id),
+++ data_key text,manifest_key text,canonical_hash text,compressed_hash text,manifest_hash text,
+++ event_count integer NOT NULL CHECK(event_count BETWEEN 1 AND 2000),
+++ expanded_bytes integer NOT NULL CHECK(expanded_bytes BETWEEN 1 AND 8388608),
+++ compressed_bytes integer,manifest_bytes integer,acked_at timestamptz,
+++ CHECK(eligible_until=sealed_at+interval '17520 hours'),
+++ CHECK(state='claimed' OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
+++ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
+++ AND manifest_bytes BETWEEN 1 AND 1048576))
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_items (
+++ batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),position integer NOT NULL,
+++ event_id uuid NOT NULL UNIQUE,aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+++ canonical_event bytea NOT NULL,
+++ PRIMARY KEY(batch_id,position),CHECK(position BETWEEN 0 AND 1999)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_receipts (
+++ batch_id uuid PRIMARY KEY REFERENCES public_archive_batches(batch_id),
+++ data_receipt jsonb NOT NULL,manifest_receipt jsonb NOT NULL,
+++ verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_coverage (
+++ aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+++ event_id uuid NOT NULL UNIQUE,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+++ archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ PRIMARY KEY(aggregate_type,aggregate_id,revision)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_suppressions (
+++ aggregate_type text NOT NULL,aggregate_id text NOT NULL,suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+++ reason text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id)
+++);
+++CREATE TABLE IF NOT EXISTS public_archive_version_coverage (
+++ version_id uuid PRIMARY KEY,source_listing_id uuid NOT NULL,version_revision bigint NOT NULL,
+++ content_hash text NOT NULL,event_id uuid NOT NULL,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+++ archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
+++);
+++CREATE OR REPLACE FUNCTION lifecycle_private.public_projection(t text,n jsonb) RETURNS jsonb
+++LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
+++DECLARE fields text[]; result jsonb;
+++BEGIN
+++ CASE t
+++ WHEN 'jobs' THEN fields:=ARRAY['id','company_id','external_id','title','url','location','department','remote','closed_at'];
+++ WHEN 'source_accounts' THEN fields:=ARRAY['id','legacy_company_id','ats','public_board_ref','public_url','exclusion_state'];
+++ WHEN 'source_listings' THEN fields:=ARRAY['id','source_account_id','external_id','job_id','current_version_id','current_revision','original_discovered_at','source_published_at','source_published_provenance','discovery_anchor_at','discovery_anchor_provenance','discovery_expires_at','source_availability','suspected_id_reuse'];
+++ WHEN 'job_versions' THEN fields:=ARRAY['id','job_id','source_listing_id','revision','content_hash','public_metadata','observed_at'];
+++ WHEN 'companies' THEN fields:=ARRAY['id','name','ats','token','display_name','industry','industry_subcategory','size','hq_country'];
+++ WHEN 'locations' THEN fields:=ARRAY['raw','canonicals','components','source'];
+++ WHEN 'brands' THEN fields:=ARRAY['id','name'];
+++ WHEN 'skills' THEN fields:=ARRAY['id','canonical_name'];
+++ WHEN 'company_brands' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','brand_id'];
+++ WHEN 'company_sources' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','source_account_id'];
+++ WHEN 'job_locations' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','location_id'];
+++ WHEN 'job_skills' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','skill_id'];
+++ WHEN 'identity_assertions' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','left_listing_id','right_listing_id','relation','reviewed_at'];
+++ ELSE RETURN NULL;
+++ END CASE;
+++ SELECT jsonb_object_agg(key,value) INTO result FROM jsonb_each(n) WHERE key=ANY(fields);
+++ RETURN result;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.public_projection(text,jsonb) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text;
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+++ -- Safe local version retirement does not assert disappearance of public facts.
+++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+++  ELSE 'upsert' END;
+++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.require_public_change() FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
+++  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
+++  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at) THEN
+++  RAISE EXCEPTION 'public change requires exact transactional outbox event';
+++ END IF;
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_public_pair() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS public_pair ON public_change_requirements;
+++CREATE CONSTRAINT TRIGGER public_pair AFTER INSERT ON public_change_requirements DEFERRABLE INITIALLY DEFERRED
+++FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_public_pair();
+++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
+++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
+++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
+++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
+++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
+++  RAISE EXCEPTION 'immutable pending membership';
+++ END IF;
+++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
+++  IF (to_jsonb(NEW)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
+++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
+++   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
+++  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
+++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
+++  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
+++  RETURN NEW;
+++ END IF;
+++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
+++  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
+++  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
+++   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
+++     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
+++ END IF;
+++ RAISE EXCEPTION 'immutable pending event or archive history';
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.preserve_archive_row() FROM PUBLIC,anon,authenticated;
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['public_archive_heads','public_change_requirements','public_outbox','public_archive_batches','public_archive_items','public_archive_receipts','public_archive_coverage','public_archive_suppressions','public_archive_version_coverage'] LOOP
+++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+++  IF t<>'public_archive_heads' THEN
+++   EXECUTE format('DROP TRIGGER IF EXISTS archive_immutable ON public.%I',t);
+++   EXECUTE format('CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+++  END IF;
+++  EXECUTE format('DROP TRIGGER IF EXISTS archive_no_truncate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+++ END LOOP;
+++ FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
+++  EXECUTE format('DROP TRIGGER IF EXISTS archive_public_change ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER archive_public_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.require_public_change()',t);
+++ END LOOP;
+++END $$;
+++REVOKE ALL ON SEQUENCE public_change_requirements_id_seq FROM PUBLIC,anon,authenticated;
+++
+++CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+++SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+++ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+++ rid uuid; json_keys text[];
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+++ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+++ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+++ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+++ IF ctl.safety_stage<>'enforced' THEN
+++  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+++  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+++   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+++   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+++  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+++   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+++   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+++  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+++ END IF;
+++ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+++ owner_id:=(n->>'user_id')::uuid;
+++ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+++  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+++ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+++ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+++ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+++ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+++ IF protection THEN
+++  vid:=n->>'job_version_id';
+++  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+++    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+++   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+++ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+++ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+++  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+++  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+++    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+++   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+++ END IF;
+++ -- Payload fields are charged on every rewrite, including same-size replacements;
+++ -- a prior DELETE or shrink never supplies physical allocation credit.
+++ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+++  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+++  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+++  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+++   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+++   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+++  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+++   oldpayload:=o->>k;
+++   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+++     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+++       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+++       OR jsonb_typeof(n->k)='string' AND
+++       (octet_length(payload)>256 OR (k NOT IN (
+++        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+++        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+++        'description_capture_provenance','capture_provenance','description_version_id',
+++        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+++   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+++  END LOOP;
+++  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+++ ELSE
+++  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+++ END IF;
+++ IF growth>0 THEN
+++  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+++  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+++ END IF;
+++ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+++ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+++ RETURN NEW;
+++END $$;
+++
+++REVOKE ALL ON FUNCTION lifecycle_validate_row() FROM PUBLIC,anon,authenticated;
+++INSERT INTO schema_migrations(filename) VALUES('2026-10-03-04-public-outbox.sql') ON CONFLICT DO NOTHING;
+++-- R6-4: provision below the physical guard, then reuse only fixed operational rows.
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_sources (
+++ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+++ sequence bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'idle'
+++ CHECK(status IN ('idle','running','complete','partial','failed')),
+++ started_at timestamptz,completed_at timestamptz,last_turn_at timestamptz,cursor uuid,reconciled boolean NOT NULL DEFAULT true,
+++ members_seen bigint NOT NULL DEFAULT 0
+++);
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_listings (
+++ listing_id uuid PRIMARY KEY REFERENCES source_listings(id),source_id uuid NOT NULL REFERENCES source_accounts(id),
+++ seen_sequence bigint NOT NULL DEFAULT 0,seen_at timestamptz,seen_kind text,
+++ miss_sequence bigint NOT NULL DEFAULT 0,miss_count integer NOT NULL DEFAULT 0 CHECK(miss_count BETWEEN 0 AND 2),
+++ first_miss_at timestamptz,
+++ CHECK(seen_kind IS NULL OR seen_kind IN ('seen','unlisted','removed','expired'))
+++);
+++CREATE INDEX IF NOT EXISTS operational_listing_source ON lifecycle_operational_listings(source_id,listing_id);
+++CREATE TABLE IF NOT EXISTS lifecycle_operational_receipts (
+++ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+++ backend_pid integer,transaction_id xid8,owner_token text,generation bigint,invoking_role name,subject_id uuid,
+++ row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 500)
+++);
+++CREATE TABLE IF NOT EXISTS public_critical_event_slots (
+++ slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 12500),
+++ state text NOT NULL DEFAULT 'free' CHECK(state IN ('free','allocated','pending','acked')),
+++ transaction_id xid8,source_id uuid,aggregate_type text,aggregate_id text,revision bigint,
+++ event_id uuid UNIQUE,predecessor_id uuid,kind text,body jsonb,occurred_at timestamptz,
+++ canonical_event bytea,recorded_at timestamptz,
+++ padding bytea NOT NULL DEFAULT decode(repeat('00',24576),'hex'),
+++ CHECK(body IS NULL OR octet_length(body::text)<=8192),
+++ CHECK(canonical_event IS NULL OR octet_length(canonical_event)<=12288),
+++ CHECK(state='free' OR (aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL AND revision IS NOT NULL)),
+++ CHECK(state NOT IN ('pending','acked') OR (event_id IS NOT NULL AND canonical_event IS NOT NULL))
+++);
+++ALTER TABLE public_critical_event_slots ALTER COLUMN padding SET STORAGE EXTERNAL;
+++CREATE OR REPLACE VIEW public_pending_events AS
+++ SELECT event_id,requirement_id,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+++ canonical_event,body_bytes,recorded_at FROM public_outbox
+++ UNION ALL
+++ SELECT event_id,NULL::bigint,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+++ canonical_event,octet_length(body::text),recorded_at FROM public_critical_event_slots WHERE state='pending';
+++REVOKE ALL ON public_pending_events FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.operational_receipt_valid(sid uuid) RETURNS boolean
+++LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+++ SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
+++ ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
+++ WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
+++ AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
+++ AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
+++ AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
+++$$;
+++REVOKE ALL ON FUNCTION lifecycle_private.operational_receipt_valid(uuid) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE sid uuid; fields text[];
+++BEGIN
+++ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+++  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak'];
+++ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+++  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+++ ELSIF t='jobs' THEN
+++  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+++    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+++  fields:=ARRAY['closed_at'];
+++ ELSE RETURN false;
+++ END IF;
+++ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+++ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+++ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+++ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+++  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+++ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+++ RETURN true;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_receipt() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++BEGIN
+++ IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+++  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
+++ IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
+++ IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
+++  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
+++ RETURN NULL;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_receipt() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS operational_commit_receipt ON lifecycle_operational_receipts;
+++CREATE CONSTRAINT TRIGGER operational_commit_receipt AFTER UPDATE ON lifecycle_operational_receipts
+++DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_receipt();
+++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+++BEGIN
+++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+++ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+++ IF OLD.state='free' AND NEW.state='allocated' THEN
+++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+++ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+++   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+++      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+++   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+++ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+++  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+++   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+++   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+++ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+++  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+++  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batches b USING(batch_id)
+++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id AND b.state='acked'
+++    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+++ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+++ IF NEW.state='pending' THEN
+++  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+++  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+++    OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+++    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+++    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+++   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+++  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+++    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+++  SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO total_count,total_bytes FROM public.public_pending_events;
+++  IF total_count+1>100000 OR total_bytes+octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+++ END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.preserve_operational_slot() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS critical_slot_integrity ON public_critical_event_slots;
+++CREATE TRIGGER critical_slot_integrity BEFORE UPDATE OR DELETE ON public_critical_event_slots
+++FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+++DROP TRIGGER IF EXISTS critical_slot_no_truncate ON public_critical_event_slots;
+++CREATE TRIGGER critical_slot_no_truncate BEFORE TRUNCATE ON public_critical_event_slots
+++FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings','lifecycle_operational_receipts','public_critical_event_slots'] LOOP
+++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+++ END LOOP;
+++END $$;
+++
+++CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+++SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+++ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+++ rid uuid; json_keys text[];
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+++ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+++ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+++ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+++ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+++  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+++ END IF;
+++ IF ctl.safety_stage<>'enforced' THEN
+++  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+++  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+++ END IF;
+++ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+++   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+++   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+++  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+++   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+++   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+++   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+++  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+++ END IF;
+++ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+++ owner_id:=(n->>'user_id')::uuid;
+++ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+++  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+++ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+++ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+++ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+++ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+++ IF protection THEN
+++  vid:=n->>'job_version_id';
+++  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+++    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+++   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+++ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+++ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+++  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+++ END IF;
+++ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+++  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+++    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+++   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+++ END IF;
+++ -- Payload fields are charged on every rewrite, including same-size replacements;
+++ -- a prior DELETE or shrink never supplies physical allocation credit.
+++ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+++  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+++  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+++  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+++   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+++   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+++  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+++   oldpayload:=o->>k;
+++   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+++     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+++       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+++       OR jsonb_typeof(n->k)='string' AND
+++       (octet_length(payload)>256 OR (k NOT IN (
+++        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+++        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+++        'description_capture_provenance','capture_provenance','description_version_id',
+++        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+++   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+++  END LOOP;
+++  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+++ ELSE
+++  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+++ END IF;
+++ IF growth>0 THEN
+++  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+++  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+++ END IF;
+++ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+++ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+++ RETURN NEW;
+++END $$;
+++
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer;
+++BEGIN
+++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+++ -- Safe local version retirement does not assert disappearance of public facts.
+++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+++ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+++  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+++ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+++  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+++ IF sid IS NOT NULL THEN
+++  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+++ ELSE
+++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+++ END IF;
+++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+++  ELSE 'upsert' END;
+++ IF sid IS NOT NULL THEN
+++  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+++  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+++  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+++  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+++   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp()
+++   WHERE slot=slot_id;
+++  RETURN NULL;
+++ END IF;
+++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+++ RETURN NULL;
+++END $$;
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+++BEGIN
+++ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+++ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at)
+++ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at) THEN
+++  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+++ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+++ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+++  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+++  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+++ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+++ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+++ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+++ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+++ OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+++  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+++ SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO usage_count,usage_bytes FROM public.public_pending_events;
+++ critical:=NEW.kind IN ('closed','reopened');
+++ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+++ OR usage_bytes+octet_length(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+++  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_outbox_insert() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS a_outbox_contract ON public_outbox;
+++CREATE TRIGGER a_outbox_contract BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_outbox_insert();
+++DROP TRIGGER IF EXISTS lifecycle_validate ON public_outbox;
+++CREATE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_archive_item() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE b public.public_archive_batches;
+++BEGIN
+++ SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
+++ IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
+++  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
+++  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
+++  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_archive_item() FROM PUBLIC,anon,authenticated;
+++DROP TRIGGER IF EXISTS archive_item_insert ON public_archive_items;
+++CREATE TRIGGER archive_item_insert BEFORE INSERT ON public_archive_items FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_archive_item();
+++
+++CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_state() RETURNS trigger
+++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+++DECLARE sid uuid;
+++BEGIN
+++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'preallocated operational identity cannot be deleted or truncated'; END IF;
+++ sid:=NEW.source_id;
+++ IF sid<>OLD.source_id OR NOT lifecycle_private.operational_receipt_valid(sid) THEN
+++  RAISE EXCEPTION 'operational update requires same-source current receipt'; END IF;
+++ IF TG_TABLE_NAME='lifecycle_operational_listings' AND to_jsonb(NEW)->>'listing_id' IS DISTINCT FROM to_jsonb(OLD)->>'listing_id' THEN
+++  RAISE EXCEPTION 'operational listing identity immutable'; END IF;
+++ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+++ RETURN NEW;
+++END $$;
+++REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
+++DO $$ DECLARE t text; BEGIN
+++ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
+++  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+++  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
+++  EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+++ END LOOP;
+++END $$;
++diff --git a/tests/archive_helpers.py b/tests/archive_helpers.py
++new file mode 100644
++index 0000000..c8e97f3
++--- /dev/null
+++++ b/tests/archive_helpers.py
++@@ -0,0 +1,29 @@
+++"""Owned-database only fixtures for ordinary Task10 producer behavior."""
+++
+++from job_discovery.lifecycle.claims import claim_work
+++from job_discovery.archive.outbox import baseline_batch
+++
+++
+++def activate_fixture(conn):
+++    # Fixture-only state seed: production activation remains deliberately unavailable.
+++    conn.execute(
+++        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+++    )
+++    conn.execute(
+++        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=activation_generation+1"
+++    )
+++    conn.execute(
+++        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+++    )
+++    conn.commit()
+++
+++
+++def seeded_events(conn, n=3):
+++    for i in range(n):
+++        conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {i}",))
+++    conn.commit()
+++    activate_fixture(conn)
+++    claim = claim_work(conn, "archive", "fixture", 180)
+++    refs = baseline_batch(conn, "brands", claim)
+++    conn.commit()
+++    return claim, refs
++diff --git a/tests/test_archive_batches.py b/tests/test_archive_batches.py
++new file mode 100644
++index 0000000..e3bc0b5
++--- /dev/null
+++++ b/tests/test_archive_batches.py
++@@ -0,0 +1,242 @@
+++"""Task10 persisted exact membership and acknowledgement with offline receipts."""
+++
+++from job_discovery.archive.batches import (
+++    claim_batch,
+++    seal_batch,
+++    persist_seal,
+++    ack_batch,
+++)
+++from job_discovery.archive.types import BatchLimits
+++
+++
+++def test_batch_limits_are_bounded():
+++    import pytest
+++
+++    with pytest.raises(ValueError):
+++        BatchLimits(max_events=2001)
+++    with pytest.raises(ValueError):
+++        BatchLimits(max_expanded_bytes=8 * 1024**2 + 1)
+++
+++
+++from dataclasses import replace
+++import pytest
+++from tests.conftest import requires_db
+++from tests.archive_helpers import seeded_events
+++from job_discovery.archive.types import VerifiedBatch, VerificationReceipt
+++
+++
+++def verified(seal):
+++    return VerifiedBatch(
+++        seal,
+++        VerificationReceipt(
+++            seal.data_key, seal.compressed_hash, seal.compressed_bytes, "offline-data"
+++        ),
+++        VerificationReceipt(
+++            seal.manifest_key,
+++            seal.manifest_hash,
+++            seal.manifest_bytes,
+++            "offline-manifest",
+++        ),
+++    )
+++
+++
+++@requires_db
+++def test_persisted_exact_partial_membership_and_ack(conn):
+++    claim, refs = seeded_events(conn)
+++    batch = claim_batch(conn, BatchLimits(max_events=2), claim)
+++    conn.commit()
+++    seal = seal_batch(batch, 1)
+++    assert seal == seal_batch(batch, 1)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    result = ack_batch(conn, verified(seal), claim)
+++    conn.commit()
+++    assert result.exact_event_ids == batch.ordered_event_ids
+++    pending = {
+++        r["event_id"] for r in conn.execute("SELECT event_id FROM public_outbox")
+++    }
+++    assert pending == {r.event_id for r in refs} - set(batch.ordered_event_ids)
+++    assert ack_batch(conn, verified(seal), claim) == result
+++    conn.commit()
+++
+++
+++@requires_db
+++def test_seal_membership_and_clock_are_immutable(conn):
+++    claim, _ = seeded_events(conn)
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    for statement in [
+++        "UPDATE public_archive_batches SET sealed_at=sealed_at+interval '1 second',eligible_until=eligible_until+interval '1 second'",
+++        "UPDATE public_archive_items SET position=position+10",
+++        "UPDATE public_archive_batches SET manifest_hash='different'",
+++    ]:
+++        with pytest.raises(Exception, match="immutable"), conn.transaction():
+++            conn.execute(statement)
+++
+++
+++@requires_db
+++def test_ack_rollback_retains_every_exact_pending_event(conn):
+++    claim, refs = seeded_events(conn)
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    with pytest.raises(RuntimeError), conn.transaction():
+++        ack_batch(conn, verified(seal), claim)
+++        raise RuntimeError("crash before commit")
+++    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == len(
+++        refs
+++    )
+++    assert (
+++        conn.execute("SELECT count(*) n FROM public_archive_receipts").fetchone()["n"]
+++        == 0
+++    )
+++
+++
+++@requires_db
+++def test_exact_receipts_and_suppressed_membership_fail_closed(conn):
+++    claim, refs = seeded_events(conn)
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    bad = replace(
+++        verified(seal),
+++        data_receipt=VerificationReceipt(
+++            seal.data_key, "bad", seal.compressed_bytes, "offline"
+++        ),
+++    )
+++    with pytest.raises(ValueError, match="exact data"), conn.transaction():
+++        ack_batch(conn, bad, claim)
+++    conn.execute(
+++        "INSERT INTO public_archive_suppressions(aggregate_type,aggregate_id,reason) VALUES('brands',%s,'local fixture')",
+++        (refs[0].aggregate_id,),
+++    )
+++    conn.commit()
+++    with pytest.raises(Exception, match="suppressed"), conn.transaction():
+++        ack_batch(conn, verified(seal), claim)
+++    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3
+++
+++
+++@requires_db
+++def test_per_aggregate_ordering_survives_small_batches(conn):
+++    from job_discovery.archive.outbox import flush_public_changes
+++
+++    claim, _ = seeded_events(conn, 1)
+++    for i in range(2):
+++        conn.execute("UPDATE brands SET name=%s", (f"Changed {i}",))
+++        flush_public_changes(conn, claim)
+++        conn.commit()
+++    first = claim_batch(conn, BatchLimits(max_events=1), claim)
+++    conn.commit()
+++    assert claim_batch(conn, BatchLimits(), claim) is None
+++    conn.commit()
+++    seal = seal_batch(first)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    ack_batch(conn, verified(seal), claim)
+++    conn.commit()
+++    rest = claim_batch(conn, BatchLimits(), claim)
+++    assert len(rest.ordered_event_ids) == 2
+++    conn.commit()
+++
+++
+++@requires_db
+++def test_later_lower_sequence_commit_remains_pending(conn):
+++    from tests.lifecycle_helpers import open_sessions
+++    from tests.conftest import TEST_DSN
+++    from job_discovery.archive.outbox import flush_public_changes
+++    from job_discovery.lifecycle.claims import claim_work
+++
+++    claim, _ = seeded_events(conn, 1)
+++    # Allocate sequence before the gate: sequence allocation never certifies commit membership.
+++    other = open_sessions(TEST_DSN, 1)[0]
+++    try:
+++        lower = other.execute(
+++            "SELECT nextval('public_change_requirements_id_seq') n"
+++        ).fetchone()["n"]
+++        other.commit()
+++        conn.execute("UPDATE brands SET name='Before batch'")
+++        flush_public_changes(conn, claim)
+++        conn.commit()
+++        batch = claim_batch(conn, BatchLimits(), claim)
+++        conn.commit()
+++        late_claim = claim_work(other, "archive", "late", 180)
+++        other.execute(
+++            "SELECT setval('public_change_requirements_id_seq',%s,false)", (lower,)
+++        )
+++        other.execute("INSERT INTO brands(name) VALUES('Late commit')")
+++        # The real newly committed requirement has the earlier reserved sequence.
+++        req = other.execute(
+++            "SELECT id FROM public_change_requirements WHERE transaction_id=pg_current_xact_id()"
+++        ).fetchone()["id"]
+++        assert lower == req
+++        # Actual pending sequence is independent of its event UUID; no production sequence watermark is used.
+++        late = flush_public_changes(other, late_claim)
+++        other.commit()
+++        seal = seal_batch(batch)
+++        persist_seal(conn, seal)
+++        conn.commit()
+++        ack_batch(conn, verified(seal), claim)
+++        conn.commit()
+++        assert {
+++            r["event_id"]
+++            for r in conn.execute("SELECT event_id FROM public_pending_events")
+++        } == {r.event_id for r in late}
+++    finally:
+++        other.close()
+++
+++
+++@requires_db
+++def test_seven_day_terminal_compaction_preserves_exact_markers(conn):
+++    from job_discovery.archive.batches import compact_terminal_batches
+++
+++    claim, refs = seeded_events(conn, 1)
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    ack_batch(conn, verified(seal), claim)
+++    conn.commit()
+++    assert compact_terminal_batches(conn, claim) == 0
+++    conn.commit()
+++    # Isolated terminal-age fixture; no production time setting or bypass exists.
+++    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+++    conn.execute(
+++        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+++    )
+++    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
+++    conn.commit()
+++    assert compact_terminal_batches(conn, claim) == 1
+++    conn.commit()
+++    assert (
+++        conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
+++            "event_id"
+++        ]
+++        == refs[0].event_id
+++    )
+++    assert (
+++        conn.execute("SELECT canonical_event FROM public_archive_items").fetchone()[
+++            "canonical_event"
+++        ]
+++        == b""
+++    )
+++
+++
+++@requires_db
+++def test_batch_claim_excludes_own_uncommitted_public_events(conn):
+++    from job_discovery.archive.outbox import flush_public_changes
+++
+++    claim, _ = seeded_events(conn, 0)
+++    conn.execute("INSERT INTO brands(name) VALUES('Uncommitted')")
+++    flush_public_changes(conn, claim)
+++    assert claim_batch(conn, BatchLimits(), claim) is None
+++    conn.commit()
+++    assert len(claim_batch(conn, BatchLimits(), claim).ordered_event_ids) == 1
+++    conn.commit()
++diff --git a/tests/test_archive_codec.py b/tests/test_archive_codec.py
++new file mode 100644
++index 0000000..a72f917
++--- /dev/null
+++++ b/tests/test_archive_codec.py
++@@ -0,0 +1,84 @@
+++"""Ordinary deterministic public serialization; no infrastructure or security probes."""
+++
+++from datetime import UTC, datetime
+++from uuid import uuid4
+++import gzip
+++import pytest
+++from job_discovery.archive.schema import (
+++    PublicChange,
+++    AggregateType,
+++    ChangeKind,
+++    validate_change,
+++)
+++from job_discovery.archive.codec import canonical_json, encode_events
+++
+++
+++def test_canonical_utf8_sorted_jsonl_and_zero_time_gzip():
+++    rows = [{"z": "é", "a": 1}, {"b": True}]
+++    a = encode_events(rows)
+++    assert a == encode_events(rows)
+++    assert a[0] == b'{"a":1,"z":"\xc3\xa9"}\n{"b":true}\n'
+++    assert gzip.decompress(a[1]) == a[0]
+++    assert a[1][4:8] == b"\0\0\0\0"
+++
+++
+++def test_total_public_schema_rejects_private_or_oversize_data():
+++    change = PublicChange(
+++        AggregateType.BRAND,
+++        str(uuid4()),
+++        ChangeKind.BASELINE,
+++        {"id": str(uuid4()), "name": "Brand"},
+++        datetime.now(UTC),
+++    )
+++    # Exact aggregate endpoint identity is part of validation.
+++    with pytest.raises(ValueError):
+++        validate_change(change)
+++    for value in [None, [], {}, "bad", True]:
+++        with pytest.raises(ValueError):
+++            validate_change(value)
+++    with pytest.raises(ValueError):
+++        canonical_json({"a": float("nan")})
+++
+++
+++def test_schema_enforces_complete_relation_endpoints_and_version_identity():
+++    from dataclasses import replace
+++
+++    eid = str(uuid4())
+++    change = PublicChange(
+++        AggregateType.JOB_SKILL,
+++        eid,
+++        ChangeKind.UPSERT,
+++        {
+++            "id": eid,
+++            "job_version_id": str(uuid4()),
+++            "skill_id": str(uuid4()),
+++            "revision": 1,
+++            "status": "accepted",
+++            "evidence_kind": "structured_source",
+++            "public_evidence_ref": "https://example.test/job",
+++        },
+++        datetime.now(UTC),
+++    )
+++    assert validate_change(change) == change
+++    for body in [
+++        dict(change.body, job_version_id="job-string"),
+++        {k: v for k, v in change.body.items() if k != "skill_id"},
+++        dict(change.body, private_notes="private"),
+++    ]:
+++        with pytest.raises(ValueError):
+++            validate_change(replace(change, body=body))
+++
+++
+++def test_body_is_bounded_and_gzip_single_event_boundary():
+++    eid = str(uuid4())
+++    change = PublicChange(
+++        AggregateType.BRAND,
+++        eid,
+++        ChangeKind.BASELINE,
+++        {"id": eid, "name": "x" * 8192},
+++        datetime.now(UTC),
+++    )
+++    with pytest.raises(ValueError, match="8KiB"):
+++        validate_change(change)
+++    with pytest.raises(ValueError, match="2000"):
+++        encode_events([{}] * 2001)
++diff --git a/tests/test_archive_outbox.py b/tests/test_archive_outbox.py
++new file mode 100644
++index 0000000..e36bf91
++--- /dev/null
+++++ b/tests/test_archive_outbox.py
++@@ -0,0 +1,249 @@
+++"""Task10 ordinary paired-transaction behavior, intentionally no deferred Task3 probes."""
+++
+++import pytest
+++from job_discovery.archive import outbox
+++from job_discovery.lifecycle.claims import claim_work
+++from tests.conftest import requires_db
+++
+++
+++@requires_db
+++def test_flag_off_legacy_write_has_no_event(conn):
+++    conn.execute("INSERT INTO brands(name) VALUES('Legacy')")
+++    conn.commit()
+++    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0
+++
+++
+++@requires_db
+++def test_bounded_current_baseline_pairs_rollback(conn):
+++    conn.execute("INSERT INTO brands(name) VALUES('Brand')")
+++    from tests.archive_helpers import activate_fixture
+++
+++    conn.commit()
+++    activate_fixture(conn)
+++    claim = claim_work(conn, "archive", "baseline", 180)
+++    conn.commit()
+++    with pytest.raises(RuntimeError), conn.transaction():
+++        outbox.baseline_batch(conn, "brands", claim, limit=1)
+++        raise RuntimeError("discard work")
+++    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0
+++
+++
+++@requires_db
+++def test_direct_mutation_requires_pair_and_revision_predecessor(conn):
+++    from tests.archive_helpers import seeded_events
+++    from job_discovery.archive.schema import event_id
+++
+++    claim, refs = seeded_events(conn, 1)
+++    with (
+++        pytest.raises(Exception, match="requires exact transactional"),
+++        conn.transaction(),
+++    ):
+++        conn.execute("UPDATE brands SET name='Unpaired'")
+++    assert conn.execute("SELECT name FROM brands").fetchone()["name"] == "Brand 0"
+++    conn.execute("UPDATE brands SET name='Paired'")
+++    pair = outbox.flush_public_changes(conn, claim)
+++    conn.commit()
+++    event = conn.execute(
+++        "SELECT * FROM public_outbox WHERE event_id=%s", (pair[0].event_id,)
+++    ).fetchone()
+++    assert event["revision"] == 2 and event["predecessor_id"] == refs[0].event_id
+++    assert event["event_id"] == event_id("brands", refs[0].aggregate_id, 2)
+++
+++
+++@requires_db
+++def test_unchanged_poll_and_private_cache_do_not_emit(conn):
+++    from tests.test_lifecycle_reconcile import setup_source
+++    from tests.archive_helpers import activate_fixture
+++
+++    setup_source(conn)
+++    conn.commit()
+++    activate_fixture(conn)
+++    claim = claim_work(conn, "archive", "unchanged", 180)
+++    outbox.baseline_batch(conn, "jobs", claim)
+++    conn.commit()
+++    before = outbox.outbox_health(conn)["events"]
+++    conn.execute(
+++        "UPDATE jobs SET last_seen_at=clock_timestamp(),description_last_used_at=clock_timestamp()"
+++    )
+++    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()")
+++    assert outbox.flush_public_changes(conn, claim) == ()
+++    conn.commit()
+++    assert outbox.outbox_health(conn)["events"] == before
+++
+++
+++def test_budget_boundaries_and_critical_reserve():
+++    assert outbox.budget_allows(87499, 0, 1, False)
+++    assert not outbox.budget_allows(87500, 0, 1, False)
+++    assert outbox.budget_allows(87500, 112 * 1024**2, 1, True)
+++    assert outbox.budget_allows(99999, 128 * 1024**2 - 1, 1, True)
+++    assert not outbox.budget_allows(100000, 0, 1, True)
+++    assert not outbox.budget_allows(0, 112 * 1024**2, 1, False)
+++    assert not outbox.budget_allows(0, 128 * 1024**2, 1, True)
+++    assert outbox.HARD_EVENTS - outbox.ORDINARY_EVENTS == 12500
+++    assert outbox.HARD_BYTES - outbox.ORDINARY_BYTES == 16 * 1024**2
+++
+++
+++@requires_db
+++def test_pending_events_have_no_ttl_or_cascade_cleanup(conn):
+++    from tests.archive_helpers import seeded_events
+++
+++    seeded_events(conn)
+++    with pytest.raises(Exception, match="immutable pending"), conn.transaction():
+++        conn.execute("DELETE FROM public_outbox")
+++    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3
+++
+++
+++@requires_db
+++def test_identity_and_reconcile_mutators_pair_transactionally(conn):
+++    from tests.test_lifecycle_reconcile import setup_source
+++    from tests.archive_helpers import activate_fixture
+++    from tests.test_lifecycle_admission import admit
+++    from job_discovery.models import Posting
+++    from job_discovery.lifecycle import reconcile
+++    from job_discovery.lifecycle.types import Observation
+++
+++    source = setup_source(conn)
+++    conn.commit()
+++    activate_fixture(conn)
+++    _, claim = admit(
+++        conn,
+++        source,
+++        [
+++            Posting(
+++                "0",
+++                "Updated",
+++                "https://example.test/job",
+++                raw={"descriptionPlain": "Public content"},
+++            )
+++        ],
+++    )
+++    enum = reconcile.begin_enumeration(conn, source["id"], claim)
+++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
+++    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
+++    reconcile.commit_sightings(
+++        conn, enum, [Observation("0", listing["id"], "removed", now)]
+++    )
+++    conn.commit()
+++    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"]
+++    assert (
+++        conn.execute(
+++            "SELECT count(*) n FROM public_outbox WHERE kind='closed'"
+++        ).fetchone()["n"]
+++        >= 1
+++    )
+++    types = {
+++        r["aggregate_type"]
+++        for r in conn.execute("SELECT aggregate_type FROM public_outbox")
+++    }
+++    assert {"jobs", "job_versions", "source_listings"} <= types
+++
+++
+++@requires_db
+++def test_listing_watermark_does_not_certify_unknown_version(conn):
+++    from tests.test_lifecycle_reconcile import setup_source
+++    from tests.archive_helpers import activate_fixture
+++    from job_discovery.lifecycle.maintenance import _version_batch
+++    from job_discovery.archive.batches import (
+++        claim_batch,
+++        seal_batch,
+++        persist_seal,
+++        ack_batch,
+++    )
+++    from job_discovery.archive.types import BatchLimits
+++    from tests.test_archive_batches import verified
+++
+++    setup_source(conn)
+++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
+++    versions = []
+++    for revision in (1, 2):
+++        versions.append(
+++            conn.execute(
+++                """INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
+++          VALUES(%s,%s,%s,%s,'{"title":"Role","url":"https://example.test/job"}',clock_timestamp(),clock_timestamp()-interval '31 days') RETURNING id""",
+++                (listing["job_id"], listing["id"], revision, str(revision) * 64),
+++            ).fetchone()["id"]
+++        )
+++    conn.execute(
+++        "UPDATE source_listings SET current_version_id=%s,current_revision=2,archived_revision=2",
+++        (versions[1],),
+++    )
+++    conn.commit()
+++    assert _version_batch(conn, 100, True)[0] == 0
+++    conn.commit()
+++    activate_fixture(conn)
+++    claim = claim_work(conn, "archive", "versions", 180)
+++    outbox.baseline_batch(conn, "job_versions", claim)
+++    conn.commit()
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    ack_batch(conn, verified(seal), claim)
+++    conn.commit()
+++    assert _version_batch(conn, 100, True)[0] == 1
+++    conn.commit()
+++
+++
+++@requires_db
+++def test_migration_reapplication_preserves_flags_and_existing_events(conn):
+++    from pathlib import Path
+++    from tests.archive_helpers import seeded_events
+++
+++    claim, refs = seeded_events(conn, 1)
+++    conn.execute(Path("migrations/2026-10-03-04-public-outbox.sql").read_text())
+++    conn.commit()
+++    assert {
+++        r["event_id"]
+++        for r in conn.execute("SELECT event_id FROM public_pending_events")
+++    } == {r.event_id for r in refs}
+++
+++
+++@requires_db
+++def test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup(conn):
+++    from uuid import uuid4
+++
+++    owner = uuid4()
+++    company = conn.execute(
+++        "INSERT INTO companies(name,ats,token) VALUES('Legacy','lever','legacy') RETURNING id"
+++    ).fetchone()["id"]
+++    conn.execute(
+++        "INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES('legacy-job',%s,'1','Role','https://example.test/job','Legacy body')",
+++        (company,),
+++    )
+++    conn.execute(
+++        "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('legacy-job',%s,'1','Updated','https://example.test/job') ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title",
+++        (company,),
+++    )
+++    conn.execute(
+++        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,'legacy-job','legacy','approve')",
+++        (owner,),
+++    )
+++    conn.execute(
+++        "INSERT INTO application_packages(user_id,job_id,answers_snapshot) VALUES(%s,'legacy-job','{}')",
+++        (owner,),
+++    )
+++    conn.execute(
+++        "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,'legacy-job','prepare'),(%s,'legacy-job','resume')",
+++        (owner, owner),
+++    )
+++    conn.commit()
+++    assert (
+++        conn.execute("SELECT count(*) n FROM public_pending_events").fetchone()["n"]
+++        == 0
+++    )
+++    from tests.conftest import as_user
+++
+++    with as_user(conn, owner):
+++        conn.execute(
+++            "UPDATE job_reviews SET human_override=true WHERE user_id=%s AND job_id='legacy-job'",
+++            (owner,),
+++        )
+++    conn.execute("DELETE FROM generation_jobs WHERE user_id=%s", (owner,))
+++    conn.execute("DELETE FROM application_packages WHERE user_id=%s", (owner,))
+++    conn.execute("DELETE FROM job_reviews WHERE user_id=%s", (owner,))
+++    conn.commit()
+++    assert (
+++        conn.execute("SELECT title FROM jobs WHERE id='legacy-job'").fetchone()["title"]
+++        == "Updated"
+++    )
++diff --git a/tests/test_lifecycle_operational.py b/tests/test_lifecycle_operational.py
++new file mode 100644
++index 0000000..9d99335
++--- /dev/null
+++++ b/tests/test_lifecycle_operational.py
++@@ -0,0 +1,294 @@
+++"""Ordinary preallocated lane integration; no physical guard or omitted mechanism probes."""
+++
+++import json
+++from datetime import timedelta
+++import pytest
+++from tests.conftest import requires_db
+++from tests.test_lifecycle_reconcile import setup_source
+++from job_discovery.lifecycle import operational as op
+++from job_discovery.lifecycle.claims import claim_work
+++
+++
+++def setup(conn, count=2, slots=16):
+++    source = setup_source(conn, count=count)
+++    claim = claim_work(conn, "source", str(source["id"]), 180)
+++    assert op.provision(conn, source["id"], claim, critical_slots=slots)
+++    conn.commit()
+++    return source, claim
+++
+++
+++def stats(conn):
+++    row = conn.execute("""SELECT pg_database_size(current_database()) allocated,
+++      sum(pg_table_size(oid)) table_toast_bytes,sum(pg_indexes_size(oid)) index_bytes
+++      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' """).fetchone()
+++    return {k: int(v) for k, v in row.items()}
+++
+++
+++@requires_db
+++def test_preallocated_health_membership_and_two_complete_misses(conn):
+++    source, claim = setup(conn)
+++    before = stats(conn)
+++    source_id = source["id"]
+++    first, _ = op.start(conn, source_id, claim)
+++    conn.commit()
+++    op.sightings(
+++        conn, source_id, first, claim, [("0", "seen"), ("new-not-admitted", "seen")]
+++    )
+++    conn.commit()
+++    op.complete(conn, source_id, first, claim, successful=True)
+++    conn.commit()
+++    timing = conn.execute(
+++        "SELECT last_attempt_at,next_due_at FROM source_accounts WHERE id=%s",
+++        (source_id,),
+++    ).fetchone()
+++    assert timing["next_due_at"] == timing["last_attempt_at"].replace(
+++        hour=0, minute=0, second=0, microsecond=0
+++    ) + timedelta(days=1)
+++    assert op.reconcile(conn, source_id, first, claim)
+++    conn.commit()
+++    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 2
+++    assert (
+++        conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
+++            "closed_at"
+++        ]
+++        is None
+++    )
+++    second, _ = op.start(conn, source_id, claim)
+++    conn.commit()
+++    op.sightings(conn, source_id, second, claim, [("0", "seen")])
+++    op.complete(conn, source_id, second, claim, successful=True)
+++    # Local fixture evidence interval; production clock is never configurable.
+++    conn.execute(
+++        "UPDATE lifecycle_operational_sources SET completed_at=completed_at+interval '24 hours' WHERE source_id=%s",
+++        (source_id,),
+++    )
+++    conn.commit()
+++    assert op.reconcile(conn, source_id, second, claim)
+++    conn.commit()
+++    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
+++        "closed_at"
+++    ]
+++    assert (
+++        conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()[
+++            "closed_at"
+++        ]
+++        is None
+++    )
+++    after = stats(conn)
+++    print(
+++        "ordinary operational resource evidence",
+++        json.dumps(
+++            {
+++                "before": before,
+++                "after": after,
+++                "delta": {k: after[k] - before[k] for k in before},
+++            },
+++            sort_keys=True,
+++        ),
+++    )
+++
+++
+++@requires_db
+++def test_partial_positive_survives_restart_and_never_certifies_absence(conn):
+++    from tests.lifecycle_helpers import open_sessions
+++    from tests.conftest import TEST_DSN
+++
+++    source, claim = setup(conn)
+++    source_id = source["id"]
+++    sequence, _ = op.start(conn, source_id, claim)
+++    conn.commit()
+++    op.sightings(conn, source_id, sequence, claim, [("0", "seen")])
+++    conn.commit()
+++    fresh = open_sessions(TEST_DSN, 1)[0]
+++    try:
+++        op.complete(fresh, source_id, sequence, claim, successful=False, failed=True)
+++        fresh.commit()
+++        assert op.reconcile(fresh, source_id, sequence, claim)
+++        fresh.commit()
+++        row = fresh.execute(
+++            "SELECT * FROM lifecycle_operational_listings WHERE seen_sequence=%s",
+++            (sequence,),
+++        ).fetchone()
+++        assert row["seen_at"] and row["miss_count"] == 0
+++        assert (
+++            fresh.execute(
+++                "SELECT max(miss_count) n FROM lifecycle_operational_listings"
+++            ).fetchone()["n"]
+++            == 0
+++        )
+++        next_sequence, resuming = op.start(fresh, source_id, claim)
+++        assert next_sequence > sequence and not resuming
+++        fresh.commit()
+++    finally:
+++        fresh.close()
+++
+++
+++@requires_db
+++def test_complete_checkpoint_resumes_with_fresh_connection(conn):
+++    from tests.lifecycle_helpers import open_sessions
+++    from tests.conftest import TEST_DSN
+++
+++    source, claim = setup(conn, count=3)
+++    sequence, _ = op.start(conn, source["id"], claim)
+++    conn.commit()
+++    op.complete(conn, source["id"], sequence, claim, successful=True)
+++    conn.commit()
+++    assert not op.reconcile(conn, source["id"], sequence, claim, limit=1)
+++    conn.commit()
+++    fresh = open_sessions(TEST_DSN, 1)[0]
+++    try:
+++        assert op.start(fresh, source["id"], claim) == (sequence, True)
+++        fresh.commit()
+++        assert op.reconcile(fresh, source["id"], sequence, claim)
+++        fresh.commit()
+++        assert (
+++            fresh.execute(
+++                "SELECT sum(miss_count) n FROM lifecycle_operational_listings"
+++            ).fetchone()["n"]
+++            == 3
+++        )
+++    finally:
+++        fresh.close()
+++
+++
+++@requires_db
+++def test_active_archive_critical_slots_exact_ack(conn):
+++    from tests.archive_helpers import activate_fixture
+++    from job_discovery.archive.outbox import baseline_batch
+++    from job_discovery.archive.batches import (
+++        claim_batch,
+++        seal_batch,
+++        persist_seal,
+++        ack_batch,
+++    )
+++    from job_discovery.archive.types import BatchLimits
+++    from tests.test_archive_batches import verified
+++
+++    source, claim = setup(conn, count=1)
+++    activate_fixture(conn)
+++    for kind in ["jobs", "source_listings"]:
+++        baseline_batch(conn, kind, claim)
+++    conn.commit()
+++    sequence, _ = op.start(conn, source["id"], claim)
+++    conn.commit()
+++    op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
+++    conn.commit()
+++    ids = {
+++        r["event_id"]
+++        for r in conn.execute(
+++            "SELECT event_id FROM public_critical_event_slots WHERE state='pending'"
+++        )
+++    }
+++    assert len(ids) == 2
+++    batch = claim_batch(conn, BatchLimits(), claim)
+++    conn.commit()
+++    seal = seal_batch(batch)
+++    persist_seal(conn, seal)
+++    conn.commit()
+++    result = ack_batch(conn, verified(seal), claim)
+++    conn.commit()
+++    assert ids <= set(result.exact_event_ids)
+++    assert (
+++        conn.execute(
+++            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked'"
+++        ).fetchone()["n"]
+++        == 2
+++    )
+++
+++    from job_discovery.archive.batches import compact_terminal_batches
+++
+++    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+++    conn.execute(
+++        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+++    )
+++    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
+++    conn.commit()
+++    assert compact_terminal_batches(conn, claim) == len(batch.ordered_event_ids) + 2
+++    conn.commit()
+++    assert (
+++        conn.execute(
+++            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked' AND canonical_event=''::bytea"
+++        ).fetchone()["n"]
+++        == 2
+++    )
+++
+++
+++@requires_db
+++def test_missing_preallocation_reports_deferred(conn):
+++    source = setup_source(conn)
+++    claim = claim_work(conn, "source", str(source["id"]), 180)
+++    conn.commit()
+++    with (
+++        pytest.raises(op.OperationalDeferred, match="not preallocated"),
+++        conn.transaction(),
+++    ):
+++        op.start(conn, source["id"], claim)
+++
+++
+++@requires_db
+++def test_operational_entrypoint_uses_preallocated_rows_and_offline_full_feed(
+++    conn, monkeypatch
+++):
+++    from time import monotonic
+++    from job_discovery.adapters import ADAPTERS
+++    from job_discovery.adapters.completeness import SourceResult, SourceStatus
+++    from job_discovery.models import Posting
+++    from job_discovery.lifecycle.claims import cancel_claim
+++    from job_discovery.lifecycle.reconcile import verify_storage_blocked
+++
+++    source, claim = setup(conn, count=2)
+++    cancel_claim(conn, claim)
+++    conn.commit()
+++    tables = [
+++        "lifecycle_operational_sources",
+++        "lifecycle_operational_listings",
+++        "lifecycle_operational_receipts",
+++        "public_critical_event_slots",
+++        "lifecycle_write_checks",
+++    ]
+++    # Constant known table identifiers; service integration fixture only.
+++    before = {
+++        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
+++    }
+++    conn.commit()
+++
+++    def feed(*args, **kwargs):
+++        assert conn.info.transaction_status.name == "IDLE"
+++        return SourceResult(
+++            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
+++        )
+++
+++    monkeypatch.setitem(ADAPTERS, "lever", feed)
+++    result = verify_storage_blocked(conn, max_boards=1, deadline=monotonic() + 60)
+++    assert result == {"complete": 1, "deferred": 0}
+++    after = {
+++        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
+++    }
+++    assert after == before
+++    assert conn.execute(
+++        "SELECT last_complete_success_at FROM source_accounts WHERE id=%s",
+++        (source["id"],),
+++    ).fetchone()["last_complete_success_at"]
+++
+++
+++@requires_db
+++def test_insufficient_critical_slots_defers_closure_atomically(conn):
+++    from tests.archive_helpers import activate_fixture
+++    from job_discovery.archive.outbox import baseline_batch
+++
+++    source, claim = setup(conn, count=1, slots=1)
+++    activate_fixture(conn)
+++    for kind in ["jobs", "source_listings"]:
+++        baseline_batch(conn, kind, claim)
+++    conn.commit()
+++    sequence, _ = op.start(conn, source["id"], claim)
+++    conn.commit()
+++    with pytest.raises(Exception, match="slots exhausted"), conn.transaction():
+++        op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
+++    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
+++    assert (
+++        conn.execute(
+++            "SELECT count(*) n FROM public_critical_event_slots WHERE state='pending'"
+++        ).fetchone()["n"]
+++        == 0
+++    )
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-reviewer-dispatch.md
+new file mode 100644
+index 0000000..2fde593
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-reviewer-dispatch.md
+@@ -0,0 +1,5 @@
++# Task10 permitted reviewer preparation
++
++After author DONE+STOP and controller FULL report/actual evidence read, resolve actual HEAD and generate FULL recorded BASE6075983bd63dced95ec94dc61b9b112a79f4564d..HEAD review package. Fresh Astra/high forkNONE reviewer receives exact brief, report, package and binding REVIEW-SCOPE-AMENDMENT.md/RELEASE-AUTHORIZATION.md. Requirements AND code quality verdicts required. Ordinary typed public event/seal/exact member ack/replay coverage and actual meaningful mutation integration reviewed; no Task3 expiry/capacity/cross-user/adversarial mechanism reviews/probes reproduced or substitutes. Do not rerun author covered tests.
++
++R6-4 durable above-guard health/closure progress remains functional requirement; source author proposal/controller ruling must be read before assessing its exact integration. If unresolved, report loadbearing gap rather than imply full Task6 spec. No guard weakening or independent security verdict. Local read-only source/evidence plus full report only; no source edits/subagents/Git mutation/network/provider/production/release actions. Review invalid destination/readiness stays gated, exact version markers cannot be replaced by watermarks, all public mutators must be inventoried. Record implemented/tested/reviewed/deliberately-unreviewed scopes. Controller owns release after all13/finalreview.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
+index 438765d..b3c001a 100644
+--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
+@@ -70,10 +70,12 @@ the gap. Cached legacy and known-input résumé-first preparation must remain
+ usable. These are ordinary consumer/lineage requirements, not the refused Task3
+ mechanism-review probes.
+ 
+ Task9 integration test carry-forward (read actual final9report/chronology): broader nondb dashboard run discovered inherited fixture drift. tombstoneGuard markApplicationApplied/unrejectJob live-account mocks omit Task8 withUserDemandSql; deployment-workflow-contract expects 2 DATABASE_URL entries while Task1 ci.yml has 3. BASE git-show evidence reported; author9 leaves unrelated files unchanged. Under13 actual ordinary caller/CI test inventory, repair valid fixture expectations/mock interfaces without weakening assertions or reproducing omitted Task3 mechanism/adversarial probes; select required tests based on actual contents. Keep original failing evidence and explicit2skipped distinction; no unrestricted all-green/security claim.
+ 
+ Task9 public-board freshness cost carry:120sISR removed for exactexpiry/per-requestreads, author explicitly unmeasured load/throughput. Final runbook/readiness must identify this tradeoff and keep cost-neutrality unproven; no invented production benchmarks or costs, no unrelated optimization/testing unless concrete evidence warrants. Reviewer count/rows unified sameSELECT after ordinary expiry-boundary selfcheck; inspect final9report/evidence/pins.
+ 
+ Task9 independent review carried default/owned Vitest lane-selection gap: newConsumers.db strict owned-env import guard plus BOTH BASEjobLifecycle.db/flow.db suites already included bydefaultvitest/plainnpmCIwithoutownedvars. Authorbroadsuiteexcluded.db is notproofplainCIgreen. Task13mustexplicitordinarydefaultvsownedDBselection+17/16permittedfixtures, preserveALLstrictowned-targetguards; neverpointfixtureDDL atsharedDSN orexecuteomittedprobes viaCI. MinorFunnelSection suffixofopen vs discovery denominator mustconsistent ifnothandledTask9fix. Task9 ownReactchecklist wasabsentinitialreport; assessactualphasefixrecord, no borrowedTask8assurance.
+ 
+ Task9 fresh-review CI nuance: Consumers.db import requires owned TEST_DATABASE_URL/LIFECYCLE_REQUIRE_DB_TESTS=1 while plain default npmCI includes all*.test.ts. BASE Task8 jobLifecycle.db/flow.db already have same strictguards: inherited lane-selection rootcause, notpreviouslygreenCI/newthirdTask9functionalblocker. Under13 aligndefaultunit exclusions andexplicitowned17/16DBlanes using actualpermittedcontents; preserveguards/neverpointownedresetfixtureatsharedDSN. Task9review report also carries analyticsFunnel 'of open' vsdiscovery denominatorcopy and missing explicitauthorReactchecklist; readfinalFix1report for disposition.
++
++Task10 operational/outbox integration carry (read final10report+independentreview before acting): additive bounded preallocated operational lane intended to resolveR6-4; missing/insufficient slots musttruthfullydefer, no newidentity/payloadaboveguard, ordinarygrowthguardunchanged. Smallownedfixturezeroallocationdelta notproduction/sustainedMVCCguarantee; report slotprovisioning/exhaustion/criticaleventexactack andlogical-vs-physicalmetrics. All publictables triggerprojection contract includes jobs/source_accounts/source_listings/job_versions/companies/locations/brands/skills/edges/identityassertions. Author10 currentinventory says legacy db/companydiscoverydirect writers intentionally failclosed whenactivearchiveeventful; activation readiness blocked. Task13actualwritercallerreadiness MUSTaccount each legitimate runtimewriter/mode, neverclaim activationcompatiblemerelybecauselegacynegativepathfails. Noarchiveactivation/userpermission/infrastructure implied. Exact version-ID/listing/revision/hash coverage replaces listingwatermark; inspectfinalacceptedinterfaces.
+diff --git a/company_discovery/db.py b/company_discovery/db.py
+index d2ad0a6..e82bda3 100644
+--- a/company_discovery/db.py
++++ b/company_discovery/db.py
+@@ -1,10 +1,11 @@
++from job_discovery.archive.writers import public_write
+ # company_discovery/db.py
+ import uuid
+ 
+ from psycopg.types.json import Json
+ 
+ from company_discovery.dataset import Candidate
+ 
+ _REVIEW_COLUMNS = (
+     "user_id", "company_id", "company_profile_version", "verdict", "confidence",
+     "reasoning", "industry", "industry_subcategory", "tech_tags", "red_flags",
+@@ -39,30 +40,30 @@ def upsert_candidates(conn, candidates: list[Candidate]) -> int:
+     """Ingest dataset candidates as ACTIVE companies (poll them immediately).
+ 
+     `active` is operational — board health, not preference: a newly-ingested board
+     starts active and is polled right away; the poller (job_discovery.db.record_poll_result)
+     deactivates it only after repeated board-fetch failures. Per-user preference is
+     enforced downstream via company_exclusions / company_overrides, never via `active`.
+     """
+     inserted = 0
+     with conn.cursor() as cur:
+         for c in candidates:
+-            cur.execute(
+-                "INSERT INTO companies (name, ats, token, active, discovery_source) "
+-                "VALUES (%s, %s, %s, TRUE, 'dataset') "
+-                "ON CONFLICT (ats, token) DO NOTHING",
+-                (c.name, c.ats, c.token),
+-            )
++            with public_write(conn, 'companies'):
++                cur.execute(
++                    "INSERT INTO companies (name, ats, token, active, discovery_source) "
++                    "VALUES (%s, %s, %s, TRUE, 'dataset') "
++                    "ON CONFLICT (ats, token) DO NOTHING",
++                    (c.name, c.ats, c.token),
++                )
+             inserted += cur.rowcount
+     return inserted
+ 
+-
+ def select_for_review(conn, user_id: str, company_profile_version: str,
+                       limit: int) -> list[dict]:
+     with conn.cursor() as cur:
+         cur.execute(
+             """
+             SELECT c.id, c.name, c.ats, c.token,
+                    c.display_name, c.about, c.web_description, c.enriched_at
+             FROM companies c
+             LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = %(uid)s
+             WHERE c.discovery_source NOT IN ('seed', 'manual')
+diff --git a/company_discovery/enrich_apply.py b/company_discovery/enrich_apply.py
+index fe51afd..bfa4aa6 100644
+--- a/company_discovery/enrich_apply.py
++++ b/company_discovery/enrich_apply.py
+@@ -1,15 +1,17 @@
+ """Shared company-enrichment logic: the per-row board-fetch decision
+ (plan_enrichment) and its persistence (apply_enrichment). Used by BOTH the
+ one-time backfill (enrich_backfill.py) and the standing cron stage
+ (enrich_selected, called from company_discovery/run.py). Keeping it here means the
+ backfill and the cron ground companies through byte-identical logic."""
++from job_discovery.archive.writers import public_write
++
+ import logging
+ from concurrent.futures import ThreadPoolExecutor, as_completed
+ from typing import NamedTuple
+ 
+ from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd
+ 
+ log = logging.getLogger("company_discovery.enrich")
+ 
+ # Board fetches share the poller's egress IP; keep concurrency small.
+ MAX_WORKERS = 5
+@@ -49,21 +51,21 @@ def plan_enrichment(ats: str, token: str) -> EnrichUpdate | None:
+                     ats, token, type(exc).__name__, exc)
+         return None
+     if display_name is None and about is None:
+         return None
+     return EnrichUpdate(display_name, about, source)
+ 
+ 
+ def apply_enrichment(conn, company_id, plan: EnrichUpdate) -> None:
+     """Persist one enrichment. Main-thread only — one psycopg connection must not
+     be shared across threads."""
+-    with conn.cursor() as cur:
++    with public_write(conn, 'companies'), conn.cursor() as cur:
+         cur.execute(_UPDATE_SQL,
+                     (plan.display_name, plan.about, plan.about_source, company_id))
+ 
+ 
+ def fetch_batches(rows, fetch, *, max_workers=MAX_WORKERS):
+     """Finish every HTTP future in a bounded batch before exposing DB work.
+ 
+     Callers close their read/write transaction before iterating and commit each
+     returned batch before requesting another. At most 50 results/futures exist;
+     a failed fetch remains a None result so successful peers still persist.
+diff --git a/company_discovery/jobs_db.py b/company_discovery/jobs_db.py
+index 24bc8df..1ee1beb 100644
+--- a/company_discovery/jobs_db.py
++++ b/company_discovery/jobs_db.py
+@@ -1,24 +1,26 @@
++
+ # company_discovery/jobs_db.py
+ """classification_jobs queue + target selection + classification persistence.
+ 
+ The admin-launched `classification_jobs` queue is drained by the always-on worker
+ (company_discovery/worker.py). Every function here takes an open psycopg connection
+ (dict_row) and never commits — the worker owns transaction boundaries so a chunk of
+ classifications + its progress bump land atomically.
+ 
+ `select_targets`'s ordering/predicates MUST stay in lockstep with the dashboard's
+ target-count SQL (dashboard/lib/classificationJobs.ts) — spend hits maximum board
+ impact first: companies with the most open jobs, then newest first_seen_at.
+ """
+ 
+ from psycopg.types.json import Json
++from job_discovery.archive.writers import public_write
+ 
+ # Predicate (on alias `c`, the companies table) selecting classification targets per mode.
+ _TARGET_MODES = {
+     "unclassified": "c.classified_at IS NULL",
+     "unknown_repass": (
+         "c.classified_at IS NOT NULL AND ("
+         "COALESCE(c.size, 'unknown') = 'unknown'"
+         " OR COALESCE(c.hq_country, 'unknown') = 'unknown'"
+         " OR COALESCE(c.industry, 'unknown') = 'unknown'"
+         " OR c.classification_confidence = 'low')"
+@@ -157,21 +159,21 @@ def select_targets(conn, mode: str, limit: int, *, before=None) -> list[dict]:
+             LIMIT %(lim)s
+             """,
+             params,
+         )
+         return cur.fetchall()
+ 
+ 
+ def apply_classification(conn, company_id: int, res, *, model: str, source: str) -> None:
+     """Stamp the global classification facts onto a company row. `res` is a
+     CompanyClassificationResult (Task 3). classified_at is set to now()."""
+-    with conn.cursor() as cur:
++    with public_write(conn, 'companies'), conn.cursor() as cur:
+         cur.execute(
+             """
+             UPDATE companies SET
+               industry = %s, industry_subcategory = %s, size = %s, hq_country = %s,
+               tech_tags = %s, red_flags = %s, classification_confidence = %s,
+               classified_at = now(), classification_model = %s, classification_source = %s
+             WHERE id = %s
+             """,
+             (res.industry, res.industry_subcategory, res.size, res.hq_country,
+              Json(res.tech_tags), Json([f.model_dump() for f in res.red_flags]),
+diff --git a/company_discovery/name_backfill.py b/company_discovery/name_backfill.py
+index 0b35a15..b495d6b 100644
+--- a/company_discovery/name_backfill.py
++++ b/company_discovery/name_backfill.py
+@@ -10,20 +10,22 @@ when they are next selected for review.
+ 
+ Writes display_name ONLY — never about / about_source / enriched_at. Stamping
+ enriched_at here would re-queue every already-reviewed company for an LLM
+ re-screen (select_for_review re-selects on enriched_at > reviewed_at): cost and
+ verdict churn this backfill must not cause. The display_name IS NULL guard (in
+ both the scope query and the UPDATE) makes reruns idempotent; a dead board
+ writes nothing, so a rerun retries it.
+ 
+ ROLLOUT ARTIFACT — the operator runs it once at rollout; safe to rerun.
+ """
++from job_discovery.archive.writers import public_write
++
+ import logging
+ 
+ from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, fetch_board_name
+ from company_discovery.enrich_apply import fetch_batches
+ 
+ log = logging.getLogger("name_backfill")
+ 
+ _SCOPE_SQL = ("SELECT id, ats, token FROM companies "
+               "WHERE active AND display_name IS NULL")
+ _UPDATE_SQL = ("UPDATE companies SET display_name = %s "
+@@ -38,41 +40,46 @@ def fetch_name(ats: str, token: str) -> str | None:
+         if ats in JD_PROBE_ATS:
+             return fetch_board_name(ats, token)
+         if ats in ENRICHERS:
+             return ENRICHERS[ats](token)[0]
+     except Exception as exc:
+         log.warning("name fetch %s/%s failed (%s: %s); skipping",
+                     ats, token, type(exc).__name__, exc)
+     return None
+ 
+ 
++def apply_name(conn,company_id,name):
++    """Persist a fetched public name in the caller's bounded transaction."""
++    with public_write(conn,'companies'),conn.cursor() as cur:
++        cur.execute(_UPDATE_SQL,(name,company_id))
++        return cur.rowcount
++
++
+ def main() -> None:
+     logging.basicConfig(level=logging.INFO,
+                         format="%(asctime)s %(levelname)s %(name)s %(message)s")
+     from job_discovery import db as job_discovery_db  # shared connection factory
+     conn = job_discovery_db.connect()
+     try:
+         with conn.cursor() as cur:
+             cur.execute(_SCOPE_SQL)
+             rows = cur.fetchall()
+         log.info("backfill scope: %s active companies without display_name", len(rows))
+         updated = 0
+         conn.commit()  # Close the selection read before HTTP starts.
+         for results in fetch_batches(rows, fetch_name):
+             batch_updated = 0
+             try:
+                 for row, name in results:
+                     if name is None:
+                         continue
+-                    with conn.cursor() as cur:
+-                        cur.execute(_UPDATE_SQL, (name, row["id"]))
+-                        batch_updated += cur.rowcount
++                    batch_updated += apply_name(conn,row["id"],name)
+                 conn.commit()
+             except BaseException:
+                 conn.rollback()
+                 raise
+             updated += batch_updated
+             log.info("named %s companies so far", updated)
+         log.info("backfill complete: named %s of %s companies", updated, len(rows))
+     finally:
+         conn.close()
+ 
+diff --git a/company_discovery/run.py b/company_discovery/run.py
+index 348fdd1..3ea6ca1 100644
+--- a/company_discovery/run.py
++++ b/company_discovery/run.py
+@@ -1,10 +1,11 @@
++from job_discovery.archive.writers import ingest_candidates
+ # company_discovery/run.py
+ import asyncio
+ import logging
+ 
+ from company_discovery import config, dataset, db
+ from company_discovery.enrich_apply import enrich_selected
+ from company_discovery.llm import CompanyReviewClient, OutOfCreditsError, build_company_block
+ from company_discovery.profile import compute_company_profile_version
+ from observability import tracing
+ 
+@@ -143,21 +144,21 @@ def run(conn=None) -> None:
+             return
+         over, size_mb, ceiling_mb = job_discovery_db.over_size_ceiling(conn)
+         if over:
+             log.error(
+                 "DB at %.0f MB >= ceiling %.0f MB; skipping company discovery so it does not "
+                 "activate more companies near the disk limit", size_mb, ceiling_mb,
+             )
+             return
+         if tracing.tracing_enabled():
+             log.info("langfuse tracing on; sample_rate=%s", tracing.sample_rate())
+-        ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
++        ingested = ingest_candidates(conn, dataset.load_candidates(config.dataset_dir()))
+         conn.commit()
+         log.info("ingested %s new candidate companies", ingested)
+         profiles = db.load_company_profiles(conn)
+         if not profiles:
+             log.info("no profiles with company_instructions; skipping review")
+             return
+         for profile in profiles:
+             _review_user(conn, profile)
+     finally:
+         conn.rollback()  # Close any early-return read before network tracing flush.
+diff --git a/company_discovery/worker.py b/company_discovery/worker.py
+index 6228d96..0c0ce57 100644
+--- a/company_discovery/worker.py
++++ b/company_discovery/worker.py
+@@ -1,18 +1,20 @@
+ """Always-on classification worker. LLM spend happens ONLY inside an admin-launched
+ classification_jobs row — the weekly tick below is LLM-free (dataset ingest + HTTP
+ enrichment). Mirrors reviewer/worker.py: claim -> process -> commit; belt-and-braces
+ per-job isolation; SIGTERM-aware sleep.
+ 
+ Run as: `python -m company_discovery`. Railway service config in railway.discovery.json
+ (always-on, no cron). Backend job -> keeps the service role (direct connection).
+ """
++from job_discovery.archive.writers import ingest_candidates
++
+ import asyncio
+ import json
+ import logging
+ import os
+ import signal
+ import sys
+ import time
+ from datetime import datetime, timedelta, timezone
+ 
+ from company_discovery import config, dataset, db, jobs_db, serp
+@@ -350,21 +352,24 @@ def _maybe_ingest(conn) -> None:
+             return
+         _fail_weekly_run(conn, run["id"], "interrupted")
+     last = conn.execute(
+         "SELECT max(started_at) AS last FROM discovery_runs WHERE status='completed'"
+     ).fetchone()["last"]
+     if last is not None and datetime.now(timezone.utc) - last < INGEST_EVERY:
+         conn.commit()
+         return
+     run_id = db.start_discovery_run(conn)
+     try:
+-        ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
++        def ingest_progress(ingested):
++            conn.execute("UPDATE discovery_runs SET ingested=%s,notes=%s WHERE id=%s",
++              (ingested,_weekly_progress_note(0,owner),run_id))
++        ingested = ingest_candidates(conn, dataset.load_candidates(config.dataset_dir()),record_progress=ingest_progress)
+         pending = conn.execute(
+             "SELECT id, ats, token, enriched_at FROM companies "
+             "WHERE enriched_at IS NULL ORDER BY first_seen_at DESC LIMIT %(cap)s",
+             {"cap": config.BATCH_CAP},
+         ).fetchall()
+         conn.execute(
+             "UPDATE discovery_runs SET ingested=%s,reviewed=0,included=0,excluded=0, "
+             "unknown=0,errors=0,backlog=%s,notes=%s WHERE id=%s",
+             (ingested, len(pending), _weekly_progress_note(0, owner), run_id),
+         )
+diff --git a/job_discovery/archive/batches.py b/job_discovery/archive/batches.py
+index 856a292..40546e3 100644
+--- a/job_discovery/archive/batches.py
++++ b/job_discovery/archive/batches.py
+@@ -6,89 +6,180 @@ import hashlib
+ import json
+ from uuid import uuid4
+ from psycopg.types.json import Jsonb
+ from job_discovery.lifecycle.claims import validate_claim
+ from job_discovery.lifecycle.capacity import (
+     reserve_capacity,
+     bind_reservation,
+     settle_capacity,
+ )
+ from .codec import canonical_json, encode_events, MAX_MANIFEST
+-from .outbox import ArchiveBlocked
++from .outbox import ArchiveBlocked, outbox_health, HARD_BYTES
+ from .types import BatchRef, BatchLimits, SealedBatch, VerifiedBatch, AckResult
+ 
+ 
+ def _hash(value):
+     return hashlib.sha256(value).hexdigest()
+ 
+ 
++def _live_capacity(tx, additional):
++    if outbox_health(tx)["bytes"] + additional > HARD_BYTES:
++        raise ArchiveBlocked("archive live forecast exhausted; batch deferred")
++
++
++def _keys(ref, compressed_hash):
++    import re
++
++    if (
++        not ref.object_prefix
++        or not re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", ref.object_prefix)
++        or len(ref.object_prefix) > 256
++    ):
++        raise ValueError("validated service object prefix required")
++    stem = f"{ref.object_prefix}/ingestion_date={ref.sealed_at.astimezone(UTC).date().isoformat()}/{ref.batch_id}-{compressed_hash}"
++    return stem + ".jsonl.gz", stem + ".manifest.json"
++
++
++def _manifest(
++    ref,
++    data_key,
++    manifest_key,
++    canonical_hash,
++    compressed_hash,
++    expanded_bytes,
++    compressed_bytes,
++):
++    ids = [str(e) for e in ref.ordered_event_ids]
++    ranges = {}
++    for raw in ref.event_bytes:
++        e = json.loads(raw)
++        key = (e["aggregate_type"], e["aggregate_id"])
++        revisions = ranges.setdefault(key, [])
++        revisions.append(e["revision"])
++    return dict(
++        schema_version=1,
++        serializer_version=ref.serializer_version,
++        batch_id=str(ref.batch_id),
++        object_prefix=ref.object_prefix,
++        ingestion_date=ref.sealed_at.astimezone(UTC).date().isoformat(),
++        ordered_event_ids=ids,
++        event_ids_sha256=_hash(canonical_json(ids)),
++        aggregate_revision_ranges=[
++            dict(
++                aggregate_type=t,
++                aggregate_id=i,
++                first_revision=min(v),
++                last_revision=max(v),
++            )
++            for (t, i), v in sorted(ranges.items())
++        ],
++        sealed_at=ref.sealed_at.astimezone(UTC).isoformat(),
++        eligible_until=ref.eligible_until.astimezone(UTC).isoformat(),
++        prior_batch_id=str(ref.prior_batch_id) if ref.prior_batch_id else None,
++        data_key=data_key,
++        manifest_key=manifest_key,
++        canonical_hash=canonical_hash,
++        compressed_hash=compressed_hash,
++        event_count=len(ids),
++        expanded_bytes=expanded_bytes,
++        compressed_bytes=compressed_bytes,
++    )
++
++
+ def _ref(tx, row, claim):
++    if (
++        row["schema_version"] != 1
++        or row["ingestion_date"] != row["sealed_at"].astimezone(UTC).date()
++    ):
++        raise ArchiveBlocked("persisted schema or UTC ingestion identity differs")
+     items = tx.execute(
+         "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
+         (row["batch_id"],),
+     ).fetchall()
+     return BatchRef(
+         row["batch_id"],
+         claim,
+         tuple(i["event_id"] for i in items),
+         row["serializer_version"],
+         row["sealed_at"],
+         row["eligible_until"],
+         tuple(bytes(i["canonical_event"]) for i in items),
+         row["prior_batch_id"],
++        row["object_prefix"],
+     )
+ 
+ 
+ def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
+     if not isinstance(limits, BatchLimits):
+         raise ValueError("BatchLimits required")
+     validate_claim(tx, claim)
+     # No watermark: only committed, unassigned exact IDs visible under the gate.
+     rows = tx.execute(
+         """SELECT e.* FROM public_pending_events e
+       WHERE NOT EXISTS(SELECT FROM public_change_requirements r WHERE r.id=e.requirement_id AND r.transaction_id=pg_current_xact_id())
+       AND NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.event_id=e.event_id AND s.transaction_id=pg_current_xact_id())
+       AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
+       AND NOT EXISTS(SELECT FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+         WHERE i.aggregate_type=e.aggregate_type AND i.aggregate_id=e.aggregate_id AND b.state<>'acked')
+       ORDER BY e.recorded_at,e.aggregate_type,e.aggregate_id,e.revision,e.event_id LIMIT %s""",
+         (limits.max_events,),
+     ).fetchall()
+     selected = []
++    selected_ids = set()
++    covered = {
++        r["event_id"]
++        for r in tx.execute(
++            "SELECT event_id FROM public_archive_coverage WHERE event_id=ANY(%s)",
++            ([r["predecessor_id"] for r in rows if r["predecessor_id"]],),
++        ).fetchall()
++    }
+     total = 0
+     for row in rows:
+         size = len(row["canonical_event"]) + 1
+         if total + size > limits.max_expanded_bytes:
+             break
+         # A prior pending predecessor must be included earlier in this same batch.
+         if (
+             row["revision"] > 1
+-            and not any(r["event_id"] == row["predecessor_id"] for r in selected)
+-            and not tx.execute(
+-                "SELECT 1 FROM public_archive_coverage WHERE event_id=%s",
+-                (row["predecessor_id"],),
+-            ).fetchone()
++            and row["predecessor_id"] not in selected_ids
++            and row["predecessor_id"] not in covered
+         ):
+             continue
+         selected.append(row)
++        selected_ids.add(row["event_id"])
+         total += size
+     if not selected:
+         return None
++    destination = tx.execute(
++        "SELECT object_prefix FROM public_archive_destination WHERE singleton AND validated_at<=clock_timestamp()"
++    ).fetchone()
++    if not destination:
++        raise ArchiveBlocked("archive destination prefix not validated")
++    _live_capacity(
++        tx, 8192 + sum(2 * len(r["canonical_event"]) + 1024 for r in selected)
++    )
+     reservation = reserve_capacity(tx, claim, total * 4 + 65536)
+     if reservation is None:
+         raise ArchiveBlocked("physical batch capacity unavailable")
+     bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+     batch_id = uuid4()
+     row = tx.execute(
+-        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes)
+-      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s FROM (SELECT clock_timestamp() t) clock RETURNING *""",
+-        (batch_id, claim.owner_token, claim.generation, len(selected), total),
++        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date)
++      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date FROM (SELECT clock_timestamp() t) clock RETURNING *""",
++        (
++            batch_id,
++            claim.owner_token,
++            claim.generation,
++            len(selected),
++            total,
++            destination["object_prefix"],
++        ),
+     ).fetchone()
+     for position, event in enumerate(selected):
+         tx.execute(
+             """INSERT INTO public_archive_items(batch_id,position,event_id,aggregate_type,aggregate_id,revision,canonical_event)
+          VALUES(%s,%s,%s,%s,%s,%s,%s)""",
+             (
+                 batch_id,
+                 position,
+                 event["event_id"],
+                 event["aggregate_type"],
+@@ -103,41 +194,30 @@ def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
+ 
+ def seal_batch(batch_ref: BatchRef, serializer_version: int = 1) -> SealedBatch:
+     if serializer_version != 1 or batch_ref.serializer_version != 1:
+         raise ValueError("unsupported serializer version")
+     events = [json.loads(value) for value in batch_ref.event_bytes]
+     if tuple(e["event_id"] for e in events) != tuple(
+         str(e) for e in batch_ref.ordered_event_ids
+     ):
+         raise ValueError("membership differs from event bytes")
+     canonical, compressed = encode_events(events)
+-    prefix = f"public/v1/{batch_ref.batch_id}"
+-    data_key = f"{prefix}/events.jsonl.gz"
+-    manifest_key = f"{prefix}/manifest.json"
++    data_key, manifest_key = _keys(batch_ref, _hash(compressed))
+     manifest = canonical_json(
+-        dict(
+-            schema_version=1,
+-            serializer_version=1,
+-            batch_id=str(batch_ref.batch_id),
+-            ordered_event_ids=[str(e) for e in batch_ref.ordered_event_ids],
+-            sealed_at=batch_ref.sealed_at.astimezone(UTC).isoformat(),
+-            eligible_until=batch_ref.eligible_until.astimezone(UTC).isoformat(),
+-            prior_batch_id=str(batch_ref.prior_batch_id)
+-            if batch_ref.prior_batch_id
+-            else None,
+-            data_key=data_key,
+-            manifest_key=manifest_key,
+-            canonical_hash=_hash(canonical),
+-            compressed_hash=_hash(compressed),
+-            event_count=len(events),
+-            expanded_bytes=len(canonical),
+-            compressed_bytes=len(compressed),
++        _manifest(
++            batch_ref,
++            data_key,
++            manifest_key,
++            _hash(canonical),
++            _hash(compressed),
++            len(canonical),
++            len(compressed),
+         )
+     )
+     if len(manifest) > MAX_MANIFEST:
+         raise ValueError("manifest exceeds 1MiB")
+     return SealedBatch(
+         batch_ref,
+         data_key,
+         manifest_key,
+         _hash(canonical),
+         _hash(compressed),
+@@ -213,72 +293,71 @@ def persist_seal(tx, seal: SealedBatch) -> None:
+         seal.expanded_bytes,
+         seal.compressed_bytes,
+         seal.manifest_bytes,
+     ) != (
+         len(ref.ordered_event_ids),
+         len(seal.canonical_data),
+         len(seal.compressed_data),
+         len(seal.manifest_data),
+     ):
+         raise ValueError("seal counts or sizes differ")
+-    prefix = f"public/v1/{ref.batch_id}"
+-    if (seal.data_key, seal.manifest_key) != (
+-        f"{prefix}/events.jsonl.gz",
+-        f"{prefix}/manifest.json",
+-    ):
++    if (seal.data_key, seal.manifest_key) != _keys(ref, seal.compressed_hash):
+         raise ValueError("seal object keys differ")
+-    manifest = json.loads(seal.manifest_data)
+-    for key in (
+-        "data_key",
+-        "manifest_key",
+-        "canonical_hash",
+-        "compressed_hash",
+-        "event_count",
+-        "expanded_bytes",
+-        "compressed_bytes",
+-    ):
+-        if manifest.get(key) != getattr(seal, key):
+-            raise ValueError("manifest differs from seal")
+-    if (
+-        manifest.get("ordered_event_ids") != [str(e) for e in ref.ordered_event_ids]
+-        or manifest.get("sealed_at") != ref.sealed_at.astimezone(UTC).isoformat()
+-        or manifest.get("eligible_until")
+-        != ref.eligible_until.astimezone(UTC).isoformat()
+-    ):
+-        raise ValueError("manifest identity or horizon differs")
++    manifest = _manifest(
++        ref,
++        seal.data_key,
++        seal.manifest_key,
++        seal.canonical_hash,
++        seal.compressed_hash,
++        seal.expanded_bytes,
++        seal.compressed_bytes,
++    )
++    if seal.manifest_data != canonical_json(manifest):
++        raise ValueError("complete manifest differs from immutable batch identity")
+     values = {
+         k: getattr(seal, k)
+         for k in (
+             "data_key",
+             "manifest_key",
+             "canonical_hash",
+             "compressed_hash",
+             "manifest_hash",
+             "event_count",
+             "expanded_bytes",
+             "compressed_bytes",
+             "manifest_bytes",
+         )
+     }
++    values.update(
++        event_ids_sha256=manifest["event_ids_sha256"],
++        aggregate_revision_ranges=manifest["aggregate_revision_ranges"],
++    )
+     if row["state"] != "claimed":
+         if any(row[k] != v for k, v in values.items()):
+             raise ArchiveBlocked("immutable seal differs")
+         return
+-    reservation = reserve_capacity(tx, seal.batch.claim, 65536)
++    _live_capacity(tx, 4096 + 2 * seal.manifest_bytes)
++    reservation = reserve_capacity(
++        tx, seal.batch.claim, 65536 + seal.manifest_bytes * 4
++    )
+     if reservation is None:
+         raise ArchiveBlocked("physical seal capacity unavailable")
+     bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+     tx.execute(
+-        """UPDATE public_archive_batches SET state='sealed',data_key=%(data_key)s,manifest_key=%(manifest_key)s,
++        """UPDATE public_archive_batches SET state='sealed',event_ids_sha256=%(event_ids_sha256)s,aggregate_revision_ranges=%(aggregate_revision_ranges)s,data_key=%(data_key)s,manifest_key=%(manifest_key)s,
+       canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
+       compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
+-        dict(values, batch_id=ref.batch_id),
++        dict(
++            values,
++            aggregate_revision_ranges=Jsonb(values["aggregate_revision_ranges"]),
++            batch_id=ref.batch_id,
++        ),
+     )
+ 
+     settle_capacity(tx, reservation)
+ 
+ 
+ def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
+     if not isinstance(verified_batch, VerifiedBatch):
+         raise ValueError("VerifiedBatch required")
+     seal = verified_batch.seal
+     row = _owned(tx, seal.batch.batch_id, claim)
+@@ -340,20 +419,31 @@ def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
+         raise ArchiveBlocked("physical exact acknowledgement capacity unavailable")
+     bind_reservation(tx, reservation, job_id=None, scope="public_archive_coverage")
+     tx.execute(
+         "INSERT INTO public_archive_receipts(batch_id,data_receipt,manifest_receipt) VALUES(%s,%s,%s)",
+         (
+             current.batch_id,
+             Jsonb(asdict(verified_batch.data_receipt)),
+             Jsonb(asdict(verified_batch.manifest_receipt)),
+         ),
+     )
++    tx.execute(
++        """INSERT INTO public_archive_batch_markers(batch_id,owner_token,generation,event_ids_sha256,manifest_hash)
++      VALUES(%s,%s,%s,%s,%s)""",
++        (
++            current.batch_id,
++            claim.owner_token,
++            claim.generation,
++            row["event_ids_sha256"],
++            row["manifest_hash"],
++        ),
++    )
+     for item in items:
+         tx.execute(
+             "INSERT INTO public_archive_coverage(aggregate_type,aggregate_id,revision,event_id,batch_id) VALUES(%s,%s,%s,%s,%s)",
+             (
+                 item["aggregate_type"],
+                 item["aggregate_id"],
+                 item["revision"],
+                 item["event_id"],
+                 current.batch_id,
+             ),
+@@ -389,29 +479,45 @@ def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
+     )
+     tx.execute(
+         "UPDATE public_archive_batches SET state='acked',acked_at=clock_timestamp() WHERE batch_id=%s",
+         (current.batch_id,),
+     )
+     settle_capacity(tx, reservation)
+     return AckResult(current.ordered_event_ids, markers)
+ 
+ 
+ def compact_terminal_batches(tx, claim, *, limit=2000) -> int:
+-    """Seven-day terminal byte compaction retains exact IDs, receipts and fences."""
++    """Bounded seven-day retirement; compact exact coverage and fences survive."""
+     if type(limit) is not int or not 1 <= limit <= 2000:
+         raise ValueError("terminal compaction limit must be 1..2000")
+     validate_claim(tx, claim)
+-    rows = tx.execute(
+-        """UPDATE public_archive_items SET canonical_event=''::bytea WHERE (batch_id,position) IN
+-      (SELECT i.batch_id,i.position FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+-       WHERE b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days' AND octet_length(i.canonical_event)>0
+-       ORDER BY b.acked_at,i.position LIMIT %s) RETURNING event_id""",
+-        (limit,),
+-    ).fetchall()
+     slots = tx.execute(
+         """UPDATE public_critical_event_slots SET body='{}'::jsonb,canonical_event=''::bytea WHERE slot IN
+-      (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
+-       JOIN public_archive_batches b USING(batch_id) WHERE s.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days'
+-       AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
+-        (limit - len(rows),),
++     (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
++      JOIN public_archive_batch_markers m USING(batch_id) WHERE s.state='acked' AND m.acked_at<=clock_timestamp()-interval '7 days'
++      AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
++        (limit,),
+     ).fetchall()
+-    return len(rows) + len(slots)
++    count = len(slots)
++    for table, key, extra in [
++        ("public_archive_items", "event_id", ""),
++        (
++            "public_archive_receipts",
++            "batch_id",
++            "AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=t.batch_id)",
++        ),
++        (
++            "public_archive_batches",
++            "batch_id",
++            "AND t.state='acked' AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=t.batch_id) AND NOT EXISTS(SELECT FROM public_archive_receipts r WHERE r.batch_id=t.batch_id)",
++        ),
++    ]:
++        # Identifiers are the fixed service allowlist above, never external input.
++        rows = tx.execute(
++            f"""DELETE FROM {table} WHERE {key} IN
++          (SELECT t.{key} FROM {table} t JOIN public_archive_batch_markers m USING(batch_id)
++           WHERE m.acked_at<=clock_timestamp()-interval '7 days' {extra}
++           ORDER BY m.acked_at,t.{key} LIMIT %s) RETURNING {key}""",
++            (limit - count,),
++        ).fetchall()
++        count += len(rows)
++    return count
+diff --git a/job_discovery/archive/outbox.py b/job_discovery/archive/outbox.py
+index c2fefba..f0858e6 100644
+--- a/job_discovery/archive/outbox.py
++++ b/job_discovery/archive/outbox.py
+@@ -1,44 +1,45 @@
+ """Public transaction pairing; no transport, credentials, or activation side effects."""
+ 
+ from datetime import UTC
++from job_discovery.lifecycle.errors import StorageBlocked
+ from psycopg import sql
+ from psycopg.types.json import Jsonb
+ from job_discovery.lifecycle.claims import validate_claim
+ from job_discovery.lifecycle.config import read_control
+ from job_discovery.lifecycle.capacity import (
+     reserve_capacity,
+     bind_reservation,
+     settle_capacity,
+ )
+ from .codec import canonical_json
+ from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
+ from .types import EventRef
+ 
+ WARNING_BYTES, WARNING_EVENTS, WARNING_AGE = 64 * 1024**2, 50000, 900
+ ORDINARY_BYTES, ORDINARY_EVENTS = 112 * 1024**2, 87500
+ HARD_BYTES, HARD_EVENTS = 128 * 1024**2, 100000
+ CRITICAL_BYTES, CRITICAL_EVENTS = 16 * 1024**2, 12500
+ 
+ 
+-class ArchiveBlocked(RuntimeError):
++class ArchiveBlocked(StorageBlocked):
+     pass
+ 
+ 
+ def budget_allows(count: int, size: int, next_size: int, critical: bool) -> bool:
+     return count + 1 <= (
+         HARD_EVENTS if critical else ORDINARY_EVENTS
+     ) and size + next_size <= (HARD_BYTES if critical else ORDINARY_BYTES)
+ 
+ 
+ def outbox_health(conn) -> dict:
+-    row = conn.execute("""SELECT count(*) events,COALESCE(sum(octet_length(canonical_event)),0) bytes,
++    row = conn.execute("""SELECT count(*) events,lifecycle_private.archive_live_bytes() bytes,
+       COALESCE(extract(epoch FROM clock_timestamp()-min(recorded_at)),0) age_seconds FROM public_pending_events""").fetchone()
+     row["warning"] = (
+         row["events"] >= WARNING_EVENTS
+         or row["bytes"] >= WARNING_BYTES
+         or row["age_seconds"] >= WARNING_AGE
+     )
+     row["ordinary_paused"] = (
+         row["events"] >= ORDINARY_EVENTS or row["bytes"] >= ORDINARY_BYTES
+     )
+     return row
+@@ -53,20 +54,25 @@ def _envelope(row):
+     )
+     return dict(
+         event_id=str(eid),
+         aggregate_type=row["aggregate_type"],
+         aggregate_id=row["aggregate_id"],
+         revision=row["revision"],
+         predecessor_id=str(previous) if previous else None,
+         kind=row["kind"],
+         body=row["body"],
+         occurred_at=row["occurred_at"].astimezone(UTC).isoformat(),
++        observed_at=row["observed_at"].astimezone(UTC).isoformat()
++        if row["observed_at"]
++        else None,
++        recorded_at=row["recorded_at"].astimezone(UTC).isoformat(),
++        provenance=row["provenance"],
+         schema_version=1,
+     )
+ 
+ 
+ def record_public_change(tx, change: PublicChange, claim) -> EventRef:
+     validate_change(change)
+     validate_claim(tx, claim)
+     ctl = read_control(tx)
+     if ctl.archive_stage != "active":
+         raise ArchiveBlocked("archive producer inactive or paused")
+@@ -82,46 +88,57 @@ def record_public_change(tx, change: PublicChange, claim) -> EventRef:
+             Jsonb(change.body),
+             change.occurred_at,
+         ),
+     ).fetchone()
+     if not row:
+         raise ValueError("no exact unpaired public mutation in this transaction")
+     envelope = _envelope(row)
+     encoded = canonical_json(envelope)
+     health = outbox_health(tx)
+     critical = change.kind in {ChangeKind.CLOSED, ChangeKind.REOPENED}
+-    if not budget_allows(health["events"], health["bytes"], len(encoded), critical):
++    if not budget_allows(
++        health["events"],
++        health["bytes"],
++        tx.execute(
++            "SELECT lifecycle_private.archive_row_charge(%s,%s,2048) n",
++            (Jsonb(change.body), encoded),
++        ).fetchone()["n"],
++        critical,
++    ):
+         raise ArchiveBlocked("public outbox budget exhausted; mutation must roll back")
+     reservation = reserve_capacity(
+         tx, claim, max(65536, len(encoded) * 16 + 32768), critical=critical
+     )
+     if reservation is None:
+         raise ArchiveBlocked(
+             "physical archive capacity unavailable; mutation must roll back"
+         )
+     bind_reservation(tx, reservation, job_id=None, scope="public_outbox")
+     tx.execute(
+         """INSERT INTO public_outbox(event_id,requirement_id,aggregate_type,aggregate_id,revision,
+-       predecessor_id,kind,body,occurred_at,canonical_event,body_bytes)
+-       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
++       predecessor_id,kind,body,occurred_at,canonical_event,body_bytes,observed_at,recorded_at,provenance)
++       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
+         (
+             envelope["event_id"],
+             row["id"],
+             change.aggregate_type,
+             change.aggregate_id,
+             row["revision"],
+             envelope["predecessor_id"],
+             change.kind,
+             Jsonb(change.body),
+             change.occurred_at,
+             encoded,
+             len(canonical_json(change.body)),
++            row["observed_at"],
++            row["recorded_at"],
++            row["provenance"],
+         ),
+     )
+     settle_capacity(tx, reservation)
+     return EventRef(
+         event_id(change.aggregate_type, change.aggregate_id, row["revision"]),
+         change.aggregate_type,
+         change.aggregate_id,
+         row["revision"],
+     )
+ 
+diff --git a/job_discovery/archive/schema.py b/job_discovery/archive/schema.py
+index e8a40a9..54090dc 100644
+--- a/job_discovery/archive/schema.py
++++ b/job_discovery/archive/schema.py
+@@ -210,21 +210,23 @@ def validate_change(value) -> PublicChange:
+                 if not isinstance(item, dict) or set(item) - {
+                     "title",
+                     "url",
+                     "location",
+                     "department",
+                     "remote",
+                     "description_hash",
+                 }:
+                     raise ValueError("invalid version metadata")
+                 for k, v in item.items():
+-                    if type(v) is not bool if k == "remote" else not isinstance(v, str):
++                    if (k == "remote" and type(v) is not bool) or (
++                        k != "remote" and not isinstance(v, str)
++                    ):
+                         raise ValueError("invalid metadata value")
+             elif key in {"canonicals", "components"}:
+                 if not isinstance(item, (list, dict)):
+                     raise ValueError("structured location field required")
+             elif key == "confidence":
+                 if type(item) not in {int, float} or not 0 <= item <= 1:
+                     raise ValueError("confidence outside 0..1")
+             elif not isinstance(item, str):
+                 raise ValueError("public string required")
+             if isinstance(item, str) and (
+diff --git a/job_discovery/archive/types.py b/job_discovery/archive/types.py
+index 878930e..29dd468 100644
+--- a/job_discovery/archive/types.py
++++ b/job_discovery/archive/types.py
+@@ -33,20 +33,21 @@ class BatchLimits:
+ @dataclass(frozen=True)
+ class BatchRef:
+     batch_id: UUID
+     claim: ClaimRef
+     ordered_event_ids: tuple[UUID, ...]
+     serializer_version: int
+     sealed_at: datetime
+     eligible_until: datetime
+     event_bytes: tuple[bytes, ...] = field(repr=False)
+     prior_batch_id: UUID | None = None
++    object_prefix: str | None = None
+ 
+ 
+ @dataclass(frozen=True)
+ class SealedBatch:
+     batch: BatchRef
+     data_key: str
+     manifest_key: str
+     canonical_hash: str
+     compressed_hash: str
+     manifest_hash: str
+diff --git a/job_discovery/archive/writers.py b/job_discovery/archive/writers.py
+new file mode 100644
+index 0000000..8f88a17
+--- /dev/null
++++ b/job_discovery/archive/writers.py
+@@ -0,0 +1,53 @@
++"""Current service writers use one claim per bounded transaction; callers commit."""
++
++from contextlib import contextmanager
++from job_discovery.lifecycle.claims import claim_work
++from job_discovery.lifecycle.config import read_control
++from job_discovery.lifecycle.locks import enter_gate
++from job_discovery.lifecycle.types import ClaimRef
++from job_discovery.lifecycle.errors import StorageBlocked
++
++
++@contextmanager
++def public_write(conn, scope, *, job_id=None, forecast=262144):
++    if scope not in {"companies", "locations", "jobs"}:
++        raise ValueError("unsupported public writer scope")
++    enter_gate(conn)
++    control = read_control(conn)
++    if not control.archive_ever_activated and control.safety_stage != "enforced":
++        yield
++        return
++    # The server-assigned transaction identity cannot be reused by another writer.
++    identity = conn.execute(
++        "SELECT pg_backend_pid()::text||':'||pg_current_xact_id()::text id"
++    ).fetchone()["id"]
++    existing = conn.execute(
++        "SELECT * FROM lifecycle_claims WHERE kind='public_writer' AND work_id=%s",
++        (identity,),
++    ).fetchone()
++    claim = (
++        ClaimRef(
++            existing["owner_token"], existing["generation"], existing["lease_until"]
++        )
++        if existing
++        else claim_work(conn, "public_writer", identity, 180)
++    )
++    if claim is None:
++        raise StorageBlocked("public writer claim storage unavailable")
++    from job_discovery.lifecycle.reconcile import _write
++
++    with _write(conn, claim, scope, job_id=job_id, size=forecast):
++        yield
++
++
++def ingest_candidates(conn, candidates, *, record_progress=None):
++    """Explicit bounded ingest boundary shared by the scheduled/weekly callers."""
++    from company_discovery.db import upsert_candidates
++
++    inserted = 0
++    for start in range(0, len(candidates), 100):
++        inserted += upsert_candidates(conn, candidates[start : start + 100])
++        if record_progress is not None:
++            record_progress(inserted)
++        conn.commit()
++    return inserted
+diff --git a/job_discovery/db.py b/job_discovery/db.py
+index 68297dc..70fef6f 100644
+--- a/job_discovery/db.py
++++ b/job_discovery/db.py
+@@ -1,10 +1,11 @@
++from job_discovery.archive.writers import public_write
+ from job_discovery.lifecycle.locks import enter_gate, lock_jobs
+ import json
+ import os
+ 
+ import psycopg
+ from psycopg.rows import dict_row
+ 
+ from job_discovery.models import Posting
+ from job_discovery.jd import extract_description
+ from job_discovery.lifecycle.config import legacy_description_capture_allowed
+@@ -52,31 +53,31 @@ def over_size_ceiling(conn) -> tuple[bool, float, float]:
+     ceiling = db_size_ceiling_mb()
+     size = database_size_mb(conn)
+     return size >= ceiling, size, ceiling
+ 
+ 
+ def sync_seed(conn, targets: list[dict]) -> None:
+     """Upsert targets.json as the always-included seed. Owns ONLY seed rows —
+     company discovery owns `active` for everything else, so this never deactivates."""
+     with conn.cursor() as cur:
+         for t in targets:
+-            cur.execute(
+-                """
+-                INSERT INTO companies (name, ats, token, active, discovery_source)
+-                VALUES (%(name)s, %(ats)s, %(token)s, TRUE, 'seed')
+-                ON CONFLICT (ats, token)
+-                DO UPDATE SET name = EXCLUDED.name, active = TRUE,
+-                             discovery_source = 'seed'
+-                """,
+-                t,
+-            )
+-
++            with public_write(conn, 'companies'):
++                cur.execute(
++                    """
++                    INSERT INTO companies (name, ats, token, active, discovery_source)
++                    VALUES (%(name)s, %(ats)s, %(token)s, TRUE, 'seed')
++                    ON CONFLICT (ats, token)
++                    DO UPDATE SET name = EXCLUDED.name, active = TRUE,
++                                 discovery_source = 'seed'
++                    """,
++                    t,
++                )
+ 
+ def active_companies(conn) -> list[dict]:
+     with conn.cursor() as cur:
+         cur.execute(
+             "SELECT id, name, ats, token FROM companies WHERE active ORDER BY id"
+         )
+         return cur.fetchall()
+ 
+ 
+ POLL_FAILURE_DEACTIVATE = 5  # consecutive failed board fetches before a non-seed company stops being polled
+@@ -131,32 +132,42 @@ _UPSERT_SQL = """
+ 
+ 
+ def _posting_row(ats: str, token: str, company_id: int, p: Posting, *,
+                  capture_description: bool = False) -> tuple:
+     job_id = f"{ats}:{token}:{p.external_id}"
+     description = extract_description(ats, p.raw) if capture_description else None
+     return (job_id, company_id, p.external_id, p.title, p.url,
+             p.location, p.department, p.remote, description)
+ 
+ 
++def _legacy_public_writer(conn):
++    """Legacy public ingestion is unavailable after archive cutover."""
++    from job_discovery.lifecycle.config import read_control
++    from job_discovery.lifecycle.errors import StorageBlocked
++    enter_gate(conn)
++    if read_control(conn).archive_ever_activated:
++        raise StorageBlocked("legacy public job writer disabled; use lifecycle source admission")
++
++
+ def upsert_jobs(
+     conn, company_id: int, ats: str, token: str, postings: list[Posting]
+ ) -> int:
+     """Batch-upsert a list of postings using psycopg3 pipelined executemany.
+ 
+     Returns the count of rows that were newly inserted (is_new=TRUE). A conditional
+     DO UPDATE skips no-op rows entirely (returns no RETURNING row for those), so a
+     skipped update is counted as not new. Note: last_seen_at does not advance for
+     unchanged rows.
+     """
+     if not postings:
+         return 0
++    _legacy_public_writer(conn)
+     capture_description = legacy_description_capture_allowed(conn)
+     rows = [_posting_row(ats, token, company_id, p, capture_description=capture_description) for p in postings
+             if p.metadata_complete and isinstance(p.title,str) and p.title.strip()
+             and isinstance(p.url,str) and p.url.strip()]
+     if not rows:
+         return 0
+     new = 0
+     lock_jobs(conn, [row[0] for row in rows])
+     with conn.cursor() as cur:
+         cur.executemany(_UPSERT_SQL, rows, returning=True)
+@@ -194,31 +205,33 @@ def _lock_company_jobs(conn, company_id, external_ids):
+     rows = conn.execute(
+         "SELECT id FROM jobs WHERE company_id=%s AND external_id=ANY(%s)",
+         (company_id, sorted(external_ids)),
+     ).fetchall()
+     lock_jobs(conn, [r["id"] for r in rows])
+ 
+ 
+ def reopen_jobs(conn, company_id: int, external_ids: set[str]) -> None:
+     """A listing can reopen existing jobs during maintenance without ingestion."""
+     if external_ids:
++        _legacy_public_writer(conn)
+         _lock_company_jobs(conn, company_id, external_ids)
+         conn.execute(
+             "UPDATE jobs SET closed_at = NULL WHERE company_id = %s "
+             "AND closed_at IS NOT NULL AND external_id = ANY(%s)",
+             (company_id, list(external_ids)),
+         )
+ 
+ 
+ def close_jobs(conn, company_id: int, external_ids: set[str]) -> int:
+     if not external_ids:
+         return 0
++    _legacy_public_writer(conn)
+     _lock_company_jobs(conn, company_id, external_ids)
+     with conn.cursor() as cur:
+         cur.execute(
+             "UPDATE jobs SET closed_at = now() "
+             "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
+             (company_id, list(external_ids)),
+         )
+         return cur.rowcount
+ 
+ 
+diff --git a/job_discovery/lifecycle/errors.py b/job_discovery/lifecycle/errors.py
+new file mode 100644
+index 0000000..973ccdb
+--- /dev/null
++++ b/job_discovery/lifecycle/errors.py
+@@ -0,0 +1,3 @@
++"""Storage pressure is a deferred workflow outcome, not a failed public feed."""
++class StorageBlocked(RuntimeError):
++    pass
+diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
+index 92cfa19..0c805d0 100644
+--- a/job_discovery/lifecycle/identity.py
++++ b/job_discovery/lifecycle/identity.py
+@@ -457,63 +457,65 @@ def admit_metadata(
+             json.dumps(
+                 metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False
+             ).encode()
+         ).hexdigest()
+         if listing and (
+             listing["content_hash"] == digest or not _version_room(conn, listing)
+         ):
+             continue
+         with _write(conn, claim, "jobs", job_id, size=65536):
+             row = conn.execute(
+-                """INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote)
+-                VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET
++                """INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote,last_seen_at)
++                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET
+                 title=EXCLUDED.title,url=EXCLUDED.url,location=EXCLUDED.location,
+-                department=EXCLUDED.department,remote=EXCLUDED.remote
++                department=EXCLUDED.department,remote=EXCLUDED.remote,last_seen_at=EXCLUDED.last_seen_at
+                 WHERE (jobs.title,jobs.url,jobs.location,jobs.department,jobs.remote)
+                   IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.url,EXCLUDED.location,EXCLUDED.department,EXCLUDED.remote)
+                 RETURNING (xmax=0) AS is_new""",
+                 (
+                     job_id,
+                     source["legacy_company_id"],
+                     posting.external_id,
+                     metadata["title"],
+                     metadata["url"],
+                     metadata.get("location"),
+                     metadata.get("department"),
+                     metadata.get("remote"),
++                    now,
+                 ),
+             ).fetchone()
+             admitted += bool(row and row["is_new"])
+         if not listing:
+             discovered = job["first_seen_at"] if job else now
+             anchor, provenance = choose_anchor(
+                 None if job else published, discovered, now
+             )
+             if job:
+                 provenance = "legacy_local_observation"
+             with _write(conn, claim, "source_listings", job_id):
+                 listing = conn.execute(
+                     """INSERT INTO source_listings(source_account_id,external_id,job_id,
+                     original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,
+-                    source_published_at,source_published_provenance,legacy_closed_at)
+-                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
++                    source_published_at,source_published_provenance,legacy_closed_at,successful_last_observed_at)
++                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
+                     (
+                         source_id,
+                         posting.external_id,
+                         job_id,
+                         discovered,
+                         anchor,
+                         provenance,
+                         anchor + timedelta(days=30),
+                         published,
+                         "ashby.publishedAt" if published else None,
+                         job["closed_at"] if job else None,
++                        now,
+                     ),
+                 ).fetchone()
+         capture_version(conn, listing["id"], metadata, now, claim)
+     settle_capacity(conn, reservation)
+     return admitted
+ 
+ 
+ def set_identity_assertion(conn, assertion: dict, claim: ClaimRef) -> UUID:
+     """Record reviewed public evidence without merging Jobs or private history.
+ 
+diff --git a/job_discovery/lifecycle/operational.py b/job_discovery/lifecycle/operational.py
+index d01dc47..15473ed 100644
+--- a/job_discovery/lifecycle/operational.py
++++ b/job_discovery/lifecycle/operational.py
+@@ -151,21 +151,21 @@ def _flush(conn):
+                 AggregateType(row["aggregate_type"]),
+                 row["aggregate_id"],
+                 ChangeKind(row["kind"]),
+                 row["body"],
+                 row["occurred_at"],
+             )
+         )
+         envelope = _envelope(row)
+         encoded = canonical_json(envelope)
+         health = outbox_health(conn)
+-        if not budget_allows(health["events"], health["bytes"], len(encoded), True):
++        if not budget_allows(health["events"], health["bytes"], 2 * len(encoded), True):
+             raise OperationalDeferred("critical outbox budget exhausted")
+         conn.execute(
+             """UPDATE public_critical_event_slots SET state='pending',event_id=%s,predecessor_id=%s,
+           canonical_event=%s,padding=''::bytea WHERE slot=%s""",
+             (envelope["event_id"], envelope["predecessor_id"], encoded, row["slot"]),
+         )
+ 
+ 
+ def sightings(conn, source_id, sequence, claim, observations):
+     if len(observations) > 100:
+@@ -181,22 +181,21 @@ def sightings(conn, source_id, sequence, claim, observations):
+     lock_jobs(conn, [r["job_id"] for r in rows])
+     _receipt(conn, source_id, claim)
+     by_id = {r["external_id"]: r for r in rows}
+     for external_id, kind in observations:
+         if kind not in {"seen", "unlisted", "removed", "expired"}:
+             continue
+         row = by_id.get(external_id)
+         if not row or row["seen_sequence"] >= sequence:
+             continue
+         conn.execute(
+-            """UPDATE lifecycle_operational_listings SET seen_sequence=%s,seen_at=clock_timestamp(),seen_kind=%s,
+-          miss_count=0,first_miss_at=NULL WHERE listing_id=%s""",
++            """UPDATE lifecycle_operational_listings SET seen_sequence=%s,seen_at=clock_timestamp(),seen_kind=%s WHERE listing_id=%s""",
+             (sequence, kind, row["id"]),
+         )
+         removed = kind in {"removed", "expired"}
+         conn.execute(
+             """UPDATE source_listings SET successful_last_observed_at=clock_timestamp(),
+           successful_sighting_count=successful_sighting_count+%s,source_availability=CASE WHEN %s THEN 'closed'
+           WHEN source_availability='closed' THEN 'open' ELSE source_availability END,
+           consecutive_complete_misses=0,first_complete_miss_at=NULL WHERE id=%s""",
+             (0 if removed else 1, removed, row["id"]),
+         )
+@@ -267,61 +266,61 @@ def reconcile(conn, source_id, sequence, claim, *, limit=100):
+     lock_jobs(conn, [r["job_id"] for r in rows])
+     _receipt(conn, source_id, claim)
+     for row in rows:
+         if (
+             row["seen_sequence"] >= sequence
+             or row["miss_sequence"] >= sequence
+             or row["successful_last_observed_at"]
+             and row["successful_last_observed_at"] >= state["started_at"]
+         ):
+             continue
+-        result = conn.execute(
+-            """UPDATE lifecycle_operational_listings SET miss_sequence=%s,miss_count=LEAST(2,miss_count+1),
+-           first_miss_at=COALESCE(first_miss_at,%s) WHERE listing_id=%s
+-           RETURNING miss_count>=2 AND %s>=first_miss_at+interval '24 hours' closed,miss_count,first_miss_at""",
+-            (sequence, state["completed_at"], row["listing_id"], state["completed_at"]),
+-        ).fetchone()
++        # SourceListing owns absence evidence in both lanes. Operational state
++        # retains only sequence/cursor idempotence, never another miss history.
+         conn.execute(
+-            """UPDATE source_listings SET consecutive_complete_misses=%s,first_complete_miss_at=%s,
+-          source_availability=CASE WHEN %s THEN 'closed' ELSE source_availability END WHERE id=%s""",
+-            (
+-                result["miss_count"],
+-                result["first_miss_at"],
+-                result["closed"],
+-                row["listing_id"],
+-            ),
++            "UPDATE lifecycle_operational_listings SET miss_sequence=%s WHERE listing_id=%s",
++            (sequence, row["listing_id"]),
+         )
++        result = conn.execute(
++            """UPDATE source_listings SET consecutive_complete_misses=LEAST(2,consecutive_complete_misses+1),
++          first_complete_miss_at=COALESCE(first_complete_miss_at,%s),
++          source_availability=CASE WHEN consecutive_complete_misses>=1 AND %s>=first_complete_miss_at+interval '24 hours'
++            THEN 'closed' ELSE source_availability END WHERE id=%s RETURNING source_availability='closed' closed""",
++            (state["completed_at"], state["completed_at"], row["listing_id"]),
++        ).fetchone()
+         if result["closed"]:
+             conn.execute(
+                 "UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s",
+                 (state["completed_at"], row["job_id"]),
+             )
+         _flush(conn)
+     done = len(rows) < limit
+     conn.execute(
+         "UPDATE lifecycle_operational_sources SET cursor=%s,reconciled=%s WHERE source_id=%s",
+         (rows[-1]["listing_id"] if rows else state["cursor"], done, source_id),
+     )
+     return done
+ 
+ 
+-def run_due(conn, *, max_boards, deadline):
++def run_due(conn, *, max_boards, deadline, source_id=None):
+     """Stream complete existing-ID membership; every commit is independently fenced."""
+     from job_discovery.adapters import ADAPTERS
+     from job_discovery.adapters.completeness import source_budget, SourceBudgetExceeded
+ 
+     sources = conn.execute(
+         """SELECT s.* FROM source_accounts s JOIN lifecycle_operational_sources p ON p.source_id=s.id
+       WHERE s.exclusion_state IN ('enabled','failure_disabled') AND (s.next_due_at IS NULL OR s.next_due_at<=clock_timestamp()
+-       OR p.status='complete' AND NOT p.reconciled)
++       OR p.status='complete' AND NOT p.reconciled OR s.id=%s)
+       ORDER BY GREATEST(s.last_attempt_at,p.last_turn_at) NULLS FIRST,s.id LIMIT %s""",
+-        (max_boards,),
++        (
++            source_id,
++            max_boards,
++        ),
+     ).fetchall()
+     conn.commit()
+     missing = conn.execute(
+         "SELECT count(*) n FROM source_accounts s WHERE exclusion_state IN ('enabled','failure_disabled') AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()) AND NOT EXISTS(SELECT FROM lifecycle_operational_sources p WHERE p.source_id=s.id)"
+     ).fetchone()["n"]
+     conn.commit()
+     progress = {"complete": 0, "deferred": missing}
+     for source in sources:
+         if monotonic() >= deadline:
+             break
+diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
+index 402bf07..5dda532 100644
+--- a/job_discovery/lifecycle/reconcile.py
++++ b/job_discovery/lifecycle/reconcile.py
+@@ -10,35 +10,32 @@ from datetime import datetime
+ import logging
+ from time import monotonic
+ from uuid import UUID
+ 
+ from psycopg.types.json import Jsonb
+ 
+ from job_discovery.adapters.completeness import SourceStatus, SourceBudgetExceeded
+ from .capacity import reserve_capacity, bind_reservation, settle_capacity
+ from .claims import claim_work, validate_claim, renew_claim, cancel_claim
+ from .config import read_control
++from .errors import StorageBlocked
+ from .identity import ADMISSION_CHUNK_SIZE
+ from .locks import enter_gate, lock_jobs
+ from .types import ClaimRef, EnumerationRef, Observation
+ 
+ log = logging.getLogger(__name__)
+ CHUNK = 100  # Multiple row effects per identity stay below 500 per transaction.
+ BOARD_SECONDS = 60
+ BOARD_REQUESTS = 50
+ BOARD_ROWS = 10000
+ 
+ 
+-class StorageBlocked(RuntimeError):
+-    pass
+-
+-
+ @contextmanager
+ def _write(conn, claim, scope, job_id=None, size=32768):
+     """Use the established reservation contract; never bypass enforced charging."""
+     reservation = reserve_capacity(conn, claim, size)
+     if reservation is None:
+         raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
+     bind_reservation(conn, reservation, job_id=job_id, scope=scope)
+     yield
+     from job_discovery.archive.outbox import flush_public_changes
+     flush_public_changes(conn, claim)
+@@ -286,46 +283,48 @@ def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool
+     if done:
+         with _write(conn,enumeration.claim,'source_enumerations'):
+             conn.execute('UPDATE source_enumerations SET reconciled_at=clock_timestamp() WHERE id=%s', (enumeration.id,))
+     return done
+ 
+ 
+ def verify_due_sources(conn, *, max_boards=100, seconds=300):
+     """Scheduled verification precedes admission and ignores all user matching."""
+     from job_discovery.adapters import ADAPTERS
+     from job_discovery.adapters.completeness import source_budget
+-    result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0}
++    result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0,'storage_deferred':0}
+     deadline = monotonic()+seconds
+     for _ in range(max_boards):
+         if monotonic() >= deadline:
+             break
+         try:
+             pair = claim_due_source(conn)
+             conn.commit()
+         except StorageBlocked:
++            result["storage_deferred"] += 1
+             conn.rollback()
+             verify_storage_blocked(conn, max_boards=max_boards, deadline=deadline)
+             break
+         if pair is None:
+             break
+         source, claim = pair
+         try:
+             enum = resume_enumeration(conn,source['id'],claim)
+             resuming = enum is not None
+             if not resuming:
+                 enum = begin_enumeration(conn,source['id'],claim)
+             conn.commit()
+         except StorageBlocked:
++            result["storage_deferred"] += 1
+             conn.rollback()
+             cancel_claim(conn,claim)
+             conn.commit()
+-            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
++            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline,source_id=source["id"])
+             break
+         chunk = []
+         verdict = SourceStatus(complete=resuming)
+         renewed = monotonic()
+         if not resuming:
+             try:
+                 def pulse():
+                     # No SQL transaction spans network, and each bounded request
+                     # starts with a renewed lease (including empty duplicate pages).
+                     renew_claim(conn,claim)
+@@ -342,58 +341,65 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
+                             admitted = stage_postings(conn,enum,chunk)
+                             conn.commit()
+                             result['new_jobs'] += admitted
+                             chunk = []
+                             claim = renew_claim(conn,claim)
+                             conn.commit()
+                             enum = replace(enum,claim=claim)
+                             renewed = monotonic()
+                     verdict = SourceStatus(complete=postings.complete)
+             except StorageBlocked:
++                result["storage_deferred"] += 1
+                 conn.rollback()
+                 log.warning("source evidence storage blocked; reconciliation deferred")
+                 cancel_claim(conn,claim)
+                 conn.commit()
+-                verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
++                verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline,source_id=source["id"])
+                 break
+             except SourceBudgetExceeded:
+                 verdict = SourceStatus(complete=False)
+                 conn.rollback()
+             except Exception:
+                 log.exception('source enumeration failed or interrupted: %s',source['id'])
+                 verdict = SourceStatus(complete=False,failed=True)
+                 conn.rollback()
++        storage_deferred = False
+         try:
+             if chunk:
+                 admitted = stage_postings(conn,enum,chunk)
+                 conn.commit()
+                 result['new_jobs'] += admitted
+             complete_enumeration(conn,enum,verdict)
+             conn.commit()
+             while True:
+                 done = reconcile_chunk(conn,enum)
+                 conn.commit()
+                 if done or monotonic() >= deadline:
+                     break
+                 claim = renew_claim(conn,claim)
+                 conn.commit()
+                 enum = replace(enum,claim=claim)
+             status = conn.execute('SELECT status FROM source_enumerations WHERE id=%s',(enum.id,)).fetchone()['status']
+             result['ok' if status == 'complete' else 'failed'] += 1
+             conn.commit()
+         except StorageBlocked:
++            result["storage_deferred"] += 1
+             conn.rollback()
++            storage_deferred = True
+             health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
+             log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
+         finally:
+             conn.rollback()
+             cancel_claim(conn,claim)
+             conn.commit()
++        if storage_deferred:
++            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline,source_id=source["id"])
++            break
+     return result
+ 
+ 
+-def verify_storage_blocked(conn, *, max_boards, deadline):
++def verify_storage_blocked(conn, *, max_boards, deadline, source_id=None):
+     """Persist bounded existing-source evidence through the preallocated lane."""
+     from .operational import run_due
+-    progress = run_due(conn,max_boards=max_boards,deadline=deadline)
++    progress = run_due(conn,max_boards=max_boards,deadline=deadline,source_id=source_id)
+     log.warning('source operational verification: %s; missing slots/readiness remain storage-deferred',progress)
+     return progress
+diff --git a/job_discovery/locations.py b/job_discovery/locations.py
+index ff7af43..a5236d1 100644
+--- a/job_discovery/locations.py
++++ b/job_discovery/locations.py
+@@ -1,20 +1,22 @@
+ """Raw-location resolution + nightly re-stamp.
+ 
+ locations is the permanent raw->canonicals cache. Rule pass first (gazetteer),
+ then a batched LLM pass for the leftovers (each element validated back through
+ the gazetteer), then a set-based re-stamp of jobs.location_canonicals. The
+ re-stamp runs every call, so a manual correction to a locations row propagates
+ on the next poll. LLM/API failure leaves those raws unmapped (retried next
+ run) — resolution must never fail the poll.
+ Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
+ """
++from job_discovery.archive.writers import public_write
++
+ import asyncio
+ import json
+ import logging
+ 
+ from job_discovery.lifecycle.locks import enter_gate, lock_jobs
+ from job_discovery.gazetteer import Resolved, resolve_fields, resolve_location
+ 
+ log = logging.getLogger("job_discovery.locations")
+ 
+ _NEW_RAWS_SQL = """
+@@ -26,54 +28,56 @@ _NEW_RAWS_SQL = """
+ 
+ # ON CONFLICT DO NOTHING: a concurrent run (or rerun after a partial commit)
+ # may have inserted the row already; first write wins, corrections go via
+ # source='manual' UPDATEs.
+ _INSERT_SQL = """
+     INSERT INTO locations (raw, canonicals, components, source)
+     VALUES (%s, %s, %s::jsonb, %s)
+     ON CONFLICT (raw) DO NOTHING
+ """
+ 
+-_STAMP_SQL = """
+-    UPDATE jobs SET location_canonicals = l.canonicals
+-    FROM locations l
+-    WHERE jobs.location = l.raw
+-      AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
+-"""
+ 
+ 
+ def _component(r: Resolved) -> dict:
+     return {"canonical": r.canonical, "kind": r.kind, "geonameid": r.geonameid,
+             "country_code": r.country_code, "admin1_code": r.admin1_code}
+ 
+ 
+ def _insert(conn, raw: str, resolved: list[Resolved], source: str) -> None:
+-    with conn.cursor() as cur:
++    with public_write(conn, 'locations'), conn.cursor() as cur:
+         cur.execute(_INSERT_SQL, (raw, [r.canonical for r in resolved],
+                                   json.dumps([_component(r) for r in resolved]), source))
+ 
+ 
+ def _insert_unmappable(conn, raw: str) -> None:
+     components = [{"canonical": raw, "kind": "unmappable", "geonameid": None,
+                    "country_code": None, "admin1_code": None}]
+-    with conn.cursor() as cur:
++    with public_write(conn, 'locations'), conn.cursor() as cur:
+         cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))
+ 
+ 
++def correct_location(conn,raw: str,resolved: list[Resolved]) -> None:
++    """Service manual correction; caller commits the paired public change."""
++    with public_write(conn,'locations'):
++        conn.execute("UPDATE locations SET canonicals=%s,components=%s::jsonb,source='manual' WHERE raw=%s",
++          ([r.canonical for r in resolved],json.dumps([_component(r) for r in resolved]),raw))
++
++
+ def stamp_jobs(conn) -> int:
+-    """Set-based re-stamp; returns rows updated. Cheap when nothing changed."""
++    """Restamp at most 100 derived cache rows in the caller's transaction."""
+     enter_gate(conn)
+-    rows = conn.execute("SELECT j.id FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals").fetchall()
+-    lock_jobs(conn, [r["id"] for r in rows])
+-    with conn.cursor() as cur:
+-        cur.execute(_STAMP_SQL)
+-        return cur.rowcount
++    rows=conn.execute("SELECT j.id,l.canonicals FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals ORDER BY j.id LIMIT 100").fetchall()
++    lock_jobs(conn,[r['id'] for r in rows])
++    for row in rows:
++        with public_write(conn,'jobs',job_id=row['id']):
++            conn.execute('UPDATE jobs SET location_canonicals=%s WHERE id=%s',(row['canonicals'],row['id']))
++    return len(rows)
+ 
+ 
+ def _validated(places) -> list[Resolved]:
+     out: list[Resolved] = []
+     for p in places:
+         r = resolve_fields(p.city, p.state, p.country, p.remote)
+         if r is not None and r not in out:
+             out.append(r)
+     return out
+ 
+@@ -116,21 +120,23 @@ def resolve_new_locations(conn, parse_client=None) -> dict:
+     name_backfill). An LLM element that fails gazetteer validation is dropped;
+     a raw whose answered elements ALL fail (or that the model answers []) is
+     stored unmappable; a raw the model doesn't answer, or any LLM/API error,
+     leaves the raw absent so a later run retries it.
+     """
+     with conn.cursor() as cur:
+         cur.execute(_NEW_RAWS_SQL)
+         raws = [r["raw"] for r in cur.fetchall()]
+     counts = {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}
+     leftovers: list[str] = []
+-    for raw in raws:
++    for index, raw in enumerate(raws):
++        if index and index % 100 == 0:
++            conn.commit()
+         resolved = resolve_location(raw)
+         if resolved:
+             _insert(conn, raw, resolved, "rule")
+             counts["rule"] += 1
+         else:
+             leftovers.append(raw)
+     conn.commit()
+ 
+     if leftovers:
+         try:
+diff --git a/job_discovery/run.py b/job_discovery/run.py
+index 67ca2d6..8ee08a2 100644
+--- a/job_discovery/run.py
++++ b/job_discovery/run.py
+@@ -98,21 +98,23 @@ def run(dsn: str | None = None) -> dict:
+             over, size_mb, ceiling_mb = True, 0, 6000
+         over = over or maintenance.blocked
+         guard_note = None
+         if over:
+             guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
+                           else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
+             log.warning("%s; checking closures without ingestion or enrichment", guard_note)
+ 
+         run_id = db.start_run(conn)
+         if not over:
+-            db.sync_seed(conn, targets)
++            for start in range(0,len(targets),100):
++                db.sync_seed(conn, targets[start:start+100])
++                conn.commit()
+         conn.commit()
+         from job_discovery.lifecycle.reconcile import verify_due_sources, StorageBlocked
+         source_enabled = read_control(conn).source_enabled
+         conn.commit()
+         if source_enabled:
+             try:
+                 db.sync_source_accounts(conn)
+                 conn.commit()
+             except StorageBlocked:
+                 conn.rollback()
+diff --git a/migrations/2026-10-03-05-public-outbox-fix1.sql b/migrations/2026-10-03-05-public-outbox-fix1.sql
+new file mode 100644
+index 0000000..61f4fbc
+--- /dev/null
++++ b/migrations/2026-10-03-05-public-outbox-fix1.sql
+@@ -0,0 +1,228 @@
++-- Task10 Fix1. Additive archive contract; physical admission/enforcement unchanged.
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
++ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
++ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'database_change';
++CREATE TABLE IF NOT EXISTS public_archive_destination (
++ singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
++ object_prefix text NOT NULL CHECK(length(object_prefix) BETWEEN 1 AND 256 AND object_prefix ~ '^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$'),
++ validated_at timestamptz NOT NULL
++);
++-- No destination row is created. Provisioning/validation belongs to the later rollout.
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS object_prefix text;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS event_ids_sha256 text;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS aggregate_revision_ranges jsonb;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1);
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS ingestion_date date;
++CREATE TABLE IF NOT EXISTS public_archive_batch_markers (
++ batch_id uuid PRIMARY KEY, owner_token text NOT NULL, generation bigint NOT NULL,
++ event_ids_sha256 text NOT NULL, manifest_hash text NOT NULL, acked_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++INSERT INTO public_archive_batch_markers(batch_id,owner_token,generation,event_ids_sha256,manifest_hash,acked_at)
++ SELECT batch_id,owner_token,generation,COALESCE(event_ids_sha256,'legacy-exact-coverage'),manifest_hash,acked_at
++ FROM public_archive_batches WHERE state='acked' ON CONFLICT DO NOTHING;
++ALTER TABLE public_archive_coverage DROP CONSTRAINT IF EXISTS public_archive_coverage_batch_id_fkey;
++ALTER TABLE public_archive_coverage ADD CONSTRAINT public_archive_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
++ALTER TABLE public_archive_version_coverage DROP CONSTRAINT IF EXISTS public_archive_version_coverage_batch_id_fkey;
++ALTER TABLE public_archive_version_coverage ADD CONSTRAINT public_archive_version_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
++-- A prior batch remains identifiable by the compact durable marker after retirement.
++ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_prior_batch_id_fkey;
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_row_charge(body jsonb, canonical bytea, overhead integer) RETURNS bigint
++LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
++ SELECT 2::bigint*(COALESCE(octet_length(body::text),0)+COALESCE(octet_length(canonical),0))+overhead
++$$;
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_live_bytes() RETURNS bigint
++LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
++ SELECT
++ COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_outbox),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(NULL,i.canonical_event,1024)) FROM public.public_archive_items i JOIN public.public_archive_batches b USING(batch_id) WHERE b.state<>'acked'),0)
++ +COALESCE((SELECT sum(8192+CASE WHEN state='sealed' THEN 4096+2::bigint*manifest_bytes ELSE 0 END) FROM public.public_archive_batches WHERE state<>'acked'),0)
++$$;
++REVOKE ALL ON FUNCTION lifecycle_private.archive_row_charge(jsonb,bytea,integer),lifecycle_private.archive_live_bytes() FROM PUBLIC,anon,authenticated;
++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer; raw jsonb; oldraw jsonb; observed timestamptz; provenance_value text;
++BEGIN
++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
++ -- Safe local version retirement does not assert disappearance of public facts.
++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
++ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
++  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
++ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
++  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
++ IF sid IS NOT NULL THEN
++  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
++ ELSE
++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
++ END IF;
++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
++  ELSE 'upsert' END;
++ raw:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
++ oldraw:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
++ observed:=NULLIF(raw->>'observed_at','')::timestamptz;
++ IF TG_TABLE_NAME='jobs' THEN
++  IF k='closed' THEN observed:=(raw->>'closed_at')::timestamptz;
++  ELSIF raw->>'last_seen_at' IS DISTINCT FROM oldraw->>'last_seen_at' THEN
++   observed:=(raw->>'last_seen_at')::timestamptz;
++  ELSIF k='reopened' THEN observed:=(SELECT successful_last_observed_at FROM public.source_listings WHERE job_id=aid ORDER BY successful_last_observed_at DESC NULLS LAST LIMIT 1);
++  END IF;
++ ELSIF TG_TABLE_NAME='source_listings' THEN
++  IF raw->>'successful_last_observed_at' IS DISTINCT FROM oldraw->>'successful_last_observed_at' THEN
++   observed:=(raw->>'successful_last_observed_at')::timestamptz;
++  ELSIF raw->>'content_changed_at' IS DISTINCT FROM oldraw->>'content_changed_at' THEN
++   observed:=(raw->>'content_changed_at')::timestamptz;
++  ELSIF k='closed' AND sid IS NOT NULL THEN
++   observed:=(SELECT completed_at FROM public.lifecycle_operational_sources WHERE source_id=sid);
++  ELSIF k='closed' THEN observed:=(SELECT completed_at FROM public.source_enumerations WHERE id=(raw->>'last_miss_enumeration_id')::uuid);
++  END IF;
++ END IF;
++ provenance_value:=CASE WHEN observed IS NOT NULL THEN 'source_observation' WHEN k='baseline' THEN 'current_baseline' ELSE 'database_change' END;
++ IF sid IS NOT NULL THEN
++  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
++  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
++  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
++  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
++   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp(),observed_at=observed,provenance=provenance_value
++   WHERE slot=slot_id;
++  RETURN NULL;
++ END IF;
++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body,observed_at,provenance)
++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o),observed,provenance_value);
++ RETURN NULL;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
++  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
++  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at AND e.observed_at IS NOT DISTINCT FROM NEW.observed_at AND e.recorded_at=NEW.recorded_at AND e.provenance=NEW.provenance) THEN
++  RAISE EXCEPTION 'public change requires exact transactional outbox event';
++ END IF;
++ RETURN NULL;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
++BEGIN
++ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
++ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at,r.observed_at,r.recorded_at,r.provenance)
++ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at,NEW.observed_at,NEW.recorded_at,NEW.provenance) THEN
++  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
++ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
++ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
++  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
++  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
++ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
++ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
++ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
++ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
++ OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
++  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
++ SELECT count(*),lifecycle_private.archive_live_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
++ critical:=NEW.kind IN ('closed','reopened');
++ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
++ OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
++  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
++ RETURN NEW;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
++BEGIN
++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
++ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
++ IF OLD.state='free' AND NEW.state='allocated' THEN
++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
++ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
++   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
++      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
++   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
++ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
++  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
++   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
++   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
++ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
++  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
++  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batch_markers b USING(batch_id) WHERE c.event_id=OLD.event_id
++    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
++ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
++ IF NEW.state='pending' THEN
++  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
++  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
++    OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
++    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
++    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
++   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
++  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
++    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
++  SELECT count(*),lifecycle_private.archive_live_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
++  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
++ END IF;
++ RETURN NEW;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
++  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
++   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
++  RAISE EXCEPTION 'immutable pending membership';
++ END IF;
++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
++  IF (to_jsonb(NEW)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
++   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
++  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
++  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
++  RETURN NEW;
++ END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
++  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
++  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
++   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
++     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
++ END IF;
++ RAISE EXCEPTION 'immutable pending event or archive history';
++END $$;
++DO $$ DECLARE t text; BEGIN
++ FOREACH t IN ARRAY ARRAY['public_archive_destination','public_archive_batch_markers'] LOOP
++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
++ END LOOP;
++END $$;
++DROP TRIGGER IF EXISTS archive_immutable ON public_archive_batch_markers;
++CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_batch_markers FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_batch_markers;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
+diff --git a/schema.sql b/schema.sql
+index bb27b29..9a8e77a 100644
+--- a/schema.sql
++++ b/schema.sql
+@@ -2871,10 +2871,239 @@ BEGIN
+ END $$;
+ REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
+ DO $$ DECLARE t text; BEGIN
+  FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
+   EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
+   EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+   EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
+   EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+  END LOOP;
+ END $$;
++
++-- Task10 Fix1. Additive archive contract; physical admission/enforcement unchanged.
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
++ALTER TABLE public_change_requirements ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
++ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_outbox ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'current_baseline';
++ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS observed_at timestamptz;
++ALTER TABLE public_critical_event_slots ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'database_change';
++CREATE TABLE IF NOT EXISTS public_archive_destination (
++ singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
++ object_prefix text NOT NULL CHECK(length(object_prefix) BETWEEN 1 AND 256 AND object_prefix ~ '^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$'),
++ validated_at timestamptz NOT NULL
++);
++-- No destination row is created. Provisioning/validation belongs to the later rollout.
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS object_prefix text;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS event_ids_sha256 text;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS aggregate_revision_ranges jsonb;
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1);
++ALTER TABLE public_archive_batches ADD COLUMN IF NOT EXISTS ingestion_date date;
++CREATE TABLE IF NOT EXISTS public_archive_batch_markers (
++ batch_id uuid PRIMARY KEY, owner_token text NOT NULL, generation bigint NOT NULL,
++ event_ids_sha256 text NOT NULL, manifest_hash text NOT NULL, acked_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++INSERT INTO public_archive_batch_markers(batch_id,owner_token,generation,event_ids_sha256,manifest_hash,acked_at)
++ SELECT batch_id,owner_token,generation,COALESCE(event_ids_sha256,'legacy-exact-coverage'),manifest_hash,acked_at
++ FROM public_archive_batches WHERE state='acked' ON CONFLICT DO NOTHING;
++ALTER TABLE public_archive_coverage DROP CONSTRAINT IF EXISTS public_archive_coverage_batch_id_fkey;
++ALTER TABLE public_archive_coverage ADD CONSTRAINT public_archive_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
++ALTER TABLE public_archive_version_coverage DROP CONSTRAINT IF EXISTS public_archive_version_coverage_batch_id_fkey;
++ALTER TABLE public_archive_version_coverage ADD CONSTRAINT public_archive_version_coverage_batch_id_fkey FOREIGN KEY(batch_id) REFERENCES public_archive_batch_markers(batch_id);
++-- A prior batch remains identifiable by the compact durable marker after retirement.
++ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_prior_batch_id_fkey;
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_row_charge(body jsonb, canonical bytea, overhead integer) RETURNS bigint
++LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
++ SELECT 2::bigint*(COALESCE(octet_length(body::text),0)+COALESCE(octet_length(canonical),0))+overhead
++$$;
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_live_bytes() RETURNS bigint
++LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
++ SELECT
++ COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_outbox),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)) FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
++ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(NULL,i.canonical_event,1024)) FROM public.public_archive_items i JOIN public.public_archive_batches b USING(batch_id) WHERE b.state<>'acked'),0)
++ +COALESCE((SELECT sum(8192+CASE WHEN state='sealed' THEN 4096+2::bigint*manifest_bytes ELSE 0 END) FROM public.public_archive_batches WHERE state<>'acked'),0)
++$$;
++REVOKE ALL ON FUNCTION lifecycle_private.archive_row_charge(jsonb,bytea,integer),lifecycle_private.archive_live_bytes() FROM PUBLIC,anon,authenticated;
++CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer; raw jsonb; oldraw jsonb; observed timestamptz; provenance_value text;
++BEGIN
++ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
++ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
++ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
++ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
++ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
++ -- Safe local version retirement does not assert disappearance of public facts.
++ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
++  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
++   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
++ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
++ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
++ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
++  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
++ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
++  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
++ IF sid IS NOT NULL THEN
++  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
++ ELSE
++ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
++ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
++ END IF;
++ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
++  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
++  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
++  ELSE 'upsert' END;
++ raw:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
++ oldraw:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
++ observed:=NULLIF(raw->>'observed_at','')::timestamptz;
++ IF TG_TABLE_NAME='jobs' THEN
++  IF k='closed' THEN observed:=(raw->>'closed_at')::timestamptz;
++  ELSIF raw->>'last_seen_at' IS DISTINCT FROM oldraw->>'last_seen_at' THEN
++   observed:=(raw->>'last_seen_at')::timestamptz;
++  ELSIF k='reopened' THEN observed:=(SELECT successful_last_observed_at FROM public.source_listings WHERE job_id=aid ORDER BY successful_last_observed_at DESC NULLS LAST LIMIT 1);
++  END IF;
++ ELSIF TG_TABLE_NAME='source_listings' THEN
++  IF raw->>'successful_last_observed_at' IS DISTINCT FROM oldraw->>'successful_last_observed_at' THEN
++   observed:=(raw->>'successful_last_observed_at')::timestamptz;
++  ELSIF raw->>'content_changed_at' IS DISTINCT FROM oldraw->>'content_changed_at' THEN
++   observed:=(raw->>'content_changed_at')::timestamptz;
++  ELSIF k='closed' AND sid IS NOT NULL THEN
++   observed:=(SELECT completed_at FROM public.lifecycle_operational_sources WHERE source_id=sid);
++  ELSIF k='closed' THEN observed:=(SELECT completed_at FROM public.source_enumerations WHERE id=(raw->>'last_miss_enumeration_id')::uuid);
++  END IF;
++ END IF;
++ provenance_value:=CASE WHEN observed IS NOT NULL THEN 'source_observation' WHEN k='baseline' THEN 'current_baseline' ELSE 'database_change' END;
++ IF sid IS NOT NULL THEN
++  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
++  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
++  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
++  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
++   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp(),observed_at=observed,provenance=provenance_value
++   WHERE slot=slot_id;
++  RETURN NULL;
++ END IF;
++ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body,observed_at,provenance)
++ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o),observed,provenance_value);
++ RETURN NULL;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
++  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
++  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at AND e.observed_at IS NOT DISTINCT FROM NEW.observed_at AND e.recorded_at=NEW.recorded_at AND e.provenance=NEW.provenance) THEN
++  RAISE EXCEPTION 'public change requires exact transactional outbox event';
++ END IF;
++ RETURN NULL;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
++BEGIN
++ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
++ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at,r.observed_at,r.recorded_at,r.provenance)
++ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at,NEW.observed_at,NEW.recorded_at,NEW.provenance) THEN
++  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
++ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
++ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
++  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
++   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
++  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
++ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
++ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
++ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
++ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
++ OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
++  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
++ SELECT count(*),lifecycle_private.archive_live_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
++ critical:=NEW.kind IN ('closed','reopened');
++ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
++ OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
++  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
++ RETURN NEW;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
++BEGIN
++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
++ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
++ IF OLD.state='free' AND NEW.state='allocated' THEN
++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
++ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
++  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
++   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
++      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
++   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
++ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
++  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
++   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
++   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
++ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
++  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
++  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batch_markers b USING(batch_id) WHERE c.event_id=OLD.event_id
++    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
++ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
++ IF NEW.state='pending' THEN
++  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
++  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
++    OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
++    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
++    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
++   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
++  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
++    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
++    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
++  SELECT count(*),lifecycle_private.archive_live_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
++  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
++ END IF;
++ RETURN NEW;
++END $$;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
++  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
++   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
++  RAISE EXCEPTION 'immutable pending membership';
++ END IF;
++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
++  IF (to_jsonb(NEW)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','event_ids_sha256','aggregate_revision_ranges','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
++   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
++  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
++    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
++  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
++  RETURN NEW;
++ END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
++  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
++    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
++  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
++   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
++     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
++ END IF;
++ RAISE EXCEPTION 'immutable pending event or archive history';
++END $$;
++DO $$ DECLARE t text; BEGIN
++ FOREACH t IN ARRAY ARRAY['public_archive_destination','public_archive_batch_markers'] LOOP
++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
++ END LOOP;
++END $$;
++DROP TRIGGER IF EXISTS archive_immutable ON public_archive_batch_markers;
++CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_batch_markers FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_batch_markers;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
+diff --git a/tests/archive_helpers.py b/tests/archive_helpers.py
+index c8e97f3..2b9180a 100644
+--- a/tests/archive_helpers.py
++++ b/tests/archive_helpers.py
+@@ -8,20 +8,23 @@ def activate_fixture(conn):
+     # Fixture-only state seed: production activation remains deliberately unavailable.
+     conn.execute(
+         "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+     )
+     conn.execute(
+         "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=activation_generation+1"
+     )
+     conn.execute(
+         "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+     )
++    conn.execute(
++        "INSERT INTO public_archive_destination(singleton,object_prefix,validated_at) VALUES(true,'fixture/public',clock_timestamp()) ON CONFLICT DO NOTHING"
++    )
+     conn.commit()
+ 
+ 
+ def seeded_events(conn, n=3):
+     for i in range(n):
+         conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {i}",))
+     conn.commit()
+     activate_fixture(conn)
+     claim = claim_work(conn, "archive", "fixture", 180)
+     refs = baseline_batch(conn, "brands", claim)
+diff --git a/tests/test_archive_batches.py b/tests/test_archive_batches.py
+index e3bc0b5..2b05c1a 100644
+--- a/tests/test_archive_batches.py
++++ b/tests/test_archive_batches.py
+@@ -205,34 +205,46 @@ def test_seven_day_terminal_compaction_preserves_exact_markers(conn):
+     ack_batch(conn, verified(seal), claim)
+     conn.commit()
+     assert compact_terminal_batches(conn, claim) == 0
+     conn.commit()
+     # Isolated terminal-age fixture; no production time setting or bypass exists.
+     conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+     conn.execute(
+         "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+     )
+     conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
++    )
++    conn.execute(
++        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
++    )
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
++    )
+     conn.commit()
+-    assert compact_terminal_batches(conn, claim) == 1
++    assert compact_terminal_batches(conn, claim) == 3
+     conn.commit()
+     assert (
+         conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
+             "event_id"
+         ]
+         == refs[0].event_id
+     )
+     assert (
+-        conn.execute("SELECT canonical_event FROM public_archive_items").fetchone()[
+-            "canonical_event"
++        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
++    )
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_batch_markers").fetchone()[
++            "n"
+         ]
+-        == b""
++        == 1
+     )
+ 
+ 
+ @requires_db
+ def test_batch_claim_excludes_own_uncommitted_public_events(conn):
+     from job_discovery.archive.outbox import flush_public_changes
+ 
+     claim, _ = seeded_events(conn, 0)
+     conn.execute("INSERT INTO brands(name) VALUES('Uncommitted')")
+     flush_public_changes(conn, claim)
+diff --git a/tests/test_archive_fix1.py b/tests/test_archive_fix1.py
+new file mode 100644
+index 0000000..4e0ac24
+--- /dev/null
++++ b/tests/test_archive_fix1.py
+@@ -0,0 +1,645 @@
++"""Seven scoped Task10 corrections; ordinary small DB/offline source contracts only."""
++
++import json
++import pytest
++from tests.conftest import requires_db
++from tests.archive_helpers import seeded_events, activate_fixture
++from tests.test_lifecycle_operational import setup
++from job_discovery.lifecycle import operational as op, reconcile
++from job_discovery.archive import outbox, batches
++from job_discovery.archive.types import BatchLimits
++from tests.test_archive_batches import verified
++
++
++def missed(conn, source, claim):
++    sequence, _ = op.start(conn, source["id"], claim)
++    conn.commit()
++    op.complete(conn, source["id"], sequence, claim, successful=True)
++    conn.commit()
++    op.reconcile(conn, source["id"], sequence, claim)
++    conn.commit()
++    return sequence
++
++
++@requires_db
++def test_fix1_operational_miss_normal_positive_operational_miss(conn):
++    source, claim = setup(conn, count=1)
++    missed(conn, source, claim)
++    # Persist old absence evidence; subsequent true positive must invalidate it.
++    conn.execute(
++        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
++    )
++    conn.commit()
++    enum = reconcile.begin_enumeration(conn, source["id"], claim)
++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
++    observed = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
++    reconcile._positive(conn, enum, listing, "seen", observed)
++    conn.commit()
++    missed(conn, source, claim)
++    row = conn.execute("SELECT * FROM source_listings").fetchone()
++    assert row["consecutive_complete_misses"] == 1
++    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
++
++
++@requires_db
++def test_fix1_membership_and_seal_add_to_live_forecast(conn):
++    claim, _ = seeded_events(conn, 2)
++    before = outbox.outbox_health(conn)["bytes"]
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    after = outbox.outbox_health(conn)["bytes"]
++    conn.commit()
++    assert after > before
++    seal = batches.seal_batch(ref)
++    batches.persist_seal(conn, seal)
++    conn.commit()
++    assert outbox.outbox_health(conn)["bytes"] > after
++
++
++def test_fix1_archive_pressure_is_storage_deferred():
++    assert issubclass(outbox.ArchiveBlocked, reconcile.StorageBlocked)
++
++
++@requires_db
++def test_fix1_actual_seed_and_company_writer_pair(conn):
++    from job_discovery.db import sync_seed
++    from company_discovery.enrich_apply import apply_enrichment, EnrichUpdate
++
++    activate_fixture(conn)
++    sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "fixture"}])
++    conn.commit()
++    company = conn.execute("SELECT id FROM companies").fetchone()["id"]
++    apply_enrichment(
++        conn, company, EnrichUpdate("Public Name", "Public about", "ats_board")
++    )
++    conn.commit()
++    assert (
++        conn.execute(
++            "SELECT count(*) n FROM public_outbox WHERE aggregate_type='companies'"
++        ).fetchone()["n"]
++        == 2
++    )
++
++
++@requires_db
++def test_fix1_baseline_has_recorded_and_unknown_observed_time(conn):
++    claim, _ = seeded_events(conn, 1)
++    event = json.loads(
++        bytes(
++            conn.execute("SELECT canonical_event FROM public_outbox").fetchone()[
++                "canonical_event"
++            ]
++        )
++    )
++    assert event["observed_at"] is None
++    assert event["recorded_at"]
++    assert event["provenance"] == "current_baseline"
++
++
++@requires_db
++def test_fix1_seal_layout_and_complete_manifest(conn):
++    claim, _ = seeded_events(conn, 1)
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    seal = batches.seal_batch(ref)
++    manifest = json.loads(seal.manifest_data)
++    assert f"ingestion_date={ref.sealed_at.date().isoformat()}/" in seal.data_key
++    assert seal.data_key.endswith(f"{ref.batch_id}-{seal.compressed_hash}.jsonl.gz")
++    assert manifest["event_ids_sha256"] and manifest["aggregate_revision_ranges"]
++
++
++@requires_db
++def test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue(conn):
++    claim, refs = seeded_events(conn, 1)
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    seal = batches.seal_batch(ref)
++    batches.persist_seal(conn, seal)
++    conn.commit()
++    batches.ack_batch(conn, verified(seal), claim)
++    conn.commit()
++    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
++    conn.execute(
++        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
++    )
++    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
++    )
++    conn.execute(
++        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
++    )
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
++    )
++    conn.commit()
++    batches.compact_terminal_batches(conn, claim)
++    conn.commit()
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_receipts").fetchone()["n"]
++        == 0
++    )
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
++    )
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
++        == 0
++    )
++    assert (
++        conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
++            "event_id"
++        ]
++        == refs[0].event_id
++    )
++
++
++@requires_db
++def test_fix1_normal_miss_then_operational_miss_closes(conn):
++    from tests.test_lifecycle_reconcile import setup_source, begin, finish
++    from job_discovery.lifecycle.claims import claim_work
++
++    source = setup_source(conn)
++    enum = begin(conn, source)
++    finish(conn, enum)
++    conn.execute(
++        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
++    )
++    claim = claim_work(conn, "source", str(source["id"]), 180)
++    conn.commit()
++    missed(conn, source, claim)
++    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"]
++
++
++@requires_db
++def test_fix1_normal_positive_before_operational_resume_invalidates_absence(conn):
++    source, claim = setup(conn, count=1)
++    missed(conn, source, claim)
++    conn.execute(
++        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
++    )
++    conn.commit()
++    seq, _ = op.start(conn, source["id"], claim)
++    op.complete(conn, source["id"], seq, claim, successful=True)
++    conn.commit()
++    enum = reconcile.begin_enumeration(conn, source["id"], claim)
++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
++    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
++    reconcile._positive(conn, enum, listing, "seen", now)
++    conn.commit()
++    assert op.reconcile(conn, source["id"], seq, claim)
++    conn.commit()
++    assert (
++        conn.execute(
++            "SELECT consecutive_complete_misses FROM source_listings"
++        ).fetchone()["consecutive_complete_misses"]
++        == 0
++    )
++    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
++
++
++@requires_db
++@pytest.mark.parametrize("boundary", ["chunk", "final_reconcile"])
++def test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health(
++    conn, monkeypatch, boundary
++):
++    from tests.test_lifecycle_reconcile import setup_source
++    from job_discovery.models import Posting
++    from job_discovery.adapters import ADAPTERS
++    from job_discovery.adapters.completeness import SourceResult, SourceStatus
++
++    source = setup_source(conn)
++
++    def feed(*args, **kwargs):
++        return SourceResult(
++            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
++        )
++
++    monkeypatch.setitem(ADAPTERS, "lever", feed)
++    calls = []
++
++    def blocked(*args, **kwargs):
++        calls.append(1)
++        raise outbox.ArchiveBlocked("ordinary fixture logical archive pressure")
++
++    if boundary == "chunk":
++        monkeypatch.setattr(reconcile, "ADMISSION_CHUNK_SIZE", 1)
++        monkeypatch.setattr(reconcile, "stage_postings", blocked)
++    else:
++        monkeypatch.setattr(reconcile, "reconcile_chunk", blocked)
++    result = reconcile.verify_due_sources(conn, max_boards=1, seconds=60)
++    assert calls == [1]
++    assert result["failed"] == 0 and result["storage_deferred"] == 1
++    health = conn.execute(
++        "SELECT * FROM source_accounts WHERE id=%s", (source["id"],)
++    ).fetchone()
++    assert health["last_complete_success_at"] and health["failure_streak"] == 0
++    assert conn.execute(
++        "SELECT reconciled FROM lifecycle_operational_sources"
++    ).fetchone()["reconciled"]
++
++
++@requires_db
++def test_fix1_current_candidate_classification_name_location_writers(conn):
++    from types import SimpleNamespace
++    from company_discovery.dataset import Candidate
++    from company_discovery.db import upsert_candidates
++    from company_discovery.jobs_db import apply_classification
++    from company_discovery.name_backfill import apply_name
++    from job_discovery.locations import _insert_unmappable, correct_location
++
++    activate_fixture(conn)
++    upsert_candidates(conn, [Candidate("Fixture", "lever", "fixture")])
++    conn.commit()
++    cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
++    apply_name(conn, cid, "Public Name")
++    apply_classification(
++        conn,
++        cid,
++        SimpleNamespace(
++            industry="software",
++            industry_subcategory="infrastructure",
++            size="11-50",
++            hq_country="US",
++            tech_tags=[],
++            red_flags=[],
++            confidence="high",
++        ),
++        model="offline",
++        source="job",
++    )
++    conn.commit()
++    _insert_unmappable(conn, "Fixture raw")
++    conn.commit()
++    correct_location(conn, "Fixture raw", [])
++    conn.commit()
++    events = conn.execute(
++        "SELECT aggregate_type,revision FROM public_outbox ORDER BY aggregate_type,revision"
++    ).fetchall()
++    assert [(e["aggregate_type"], e["revision"]) for e in events] == [
++        ("companies", 1),
++        ("companies", 2),
++        ("companies", 3),
++        ("locations", 1),
++        ("locations", 2),
++    ]
++    before = len(events)
++    # Private worker status/cache-only changes retain no public event.
++    conn.execute(
++        "UPDATE companies SET classified_at=clock_timestamp(),web_description='operational cache'"
++    )
++    conn.commit()
++    assert outbox.outbox_health(conn)["events"] == before
++
++
++@requires_db
++def test_fix1_writer_rollback_and_flags_off(conn):
++    from job_discovery.db import sync_seed
++
++    sync_seed(conn, [dict(name="Flags off", ats="lever", token="flags")])
++    conn.commit()
++    assert outbox.outbox_health(conn)["events"] == 0
++    activate_fixture(conn)
++    sync_seed(conn, [dict(name="Rollback", ats="lever", token="rollback")])
++    conn.rollback()
++    assert (
++        conn.execute(
++            "SELECT count(*) n FROM companies WHERE token='rollback'"
++        ).fetchone()["n"]
++        == 0
++    )
++    assert outbox.outbox_health(conn)["events"] == 0
++
++
++@requires_db
++def test_fix1_observation_time_distinct_from_database_recording(conn):
++    from tests.test_lifecycle_reconcile import setup_source
++    from job_discovery.lifecycle.claims import claim_work
++    from datetime import UTC, datetime
++
++    setup_source(conn)
++    conn.commit()
++    activate_fixture(conn)
++    claim = claim_work(conn, "archive", "time", 180)
++    outbox.baseline_batch(conn, "source_listings", claim)
++    conn.commit()
++    observed = datetime(2026, 1, 2, 3, 4, tzinfo=UTC)
++    conn.execute(
++        "UPDATE source_listings SET successful_last_observed_at=%s,source_availability='open'",
++        (observed,),
++    )
++    outbox.flush_public_changes(conn, claim)
++    conn.commit()
++    event = json.loads(
++        bytes(
++            conn.execute(
++                "SELECT canonical_event FROM public_outbox ORDER BY revision DESC LIMIT 1"
++            ).fetchone()["canonical_event"]
++        )
++    )
++    assert event["observed_at"] == observed.isoformat()
++    assert event["recorded_at"] != event["observed_at"]
++    assert event["provenance"] == "source_observation"
++
++
++@requires_db
++def test_fix1_all_manifest_identity_fields_validated(conn):
++    from dataclasses import replace
++    import hashlib
++    from job_discovery.archive.codec import canonical_json
++
++    claim, _ = seeded_events(conn, 1)
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    seal = batches.seal_batch(ref)
++    for field, value in [
++        ("batch_id", "wrong"),
++        ("schema_version", 2),
++        ("serializer_version", 2),
++        ("prior_batch_id", "wrong"),
++        ("event_ids_sha256", "wrong"),
++        ("aggregate_revision_ranges", []),
++    ]:
++        manifest = json.loads(seal.manifest_data)
++        manifest[field] = value
++        data = canonical_json(manifest)
++        with pytest.raises(ValueError, match="manifest"):
++            batches.persist_seal(
++                conn,
++                replace(
++                    seal,
++                    manifest_data=data,
++                    manifest_hash=hashlib.sha256(data).hexdigest(),
++                    manifest_bytes=len(data),
++                ),
++            )
++        conn.rollback()
++    batches.persist_seal(conn, seal)
++    conn.commit()
++    assert batches.seal_batch(batches.recover_batch(conn, ref.batch_id, claim)) == seal
++
++
++@requires_db
++def test_fix1_logical_small_row_forecasts_and_warning_predicate(conn, monkeypatch):
++    claim, _ = seeded_events(conn, 1)
++    row = conn.execute("SELECT * FROM public_outbox").fetchone()
++    body_size = conn.execute(
++        "SELECT octet_length(body::text) n FROM public_outbox"
++    ).fetchone()["n"]
++    expected = 4 * body_size + 2 * len(row["canonical_event"]) + 4096
++    assert outbox.outbox_health(conn)["bytes"] == expected
++    charge = conn.execute(
++        "SELECT lifecycle_private.archive_row_charge(body,canonical_event,2048) n FROM public_outbox"
++    ).fetchone()["n"]
++    for critical, ceiling in [
++        (False, outbox.ORDINARY_BYTES),
++        (True, outbox.HARD_BYTES),
++    ]:
++        assert outbox.budget_allows(1, ceiling - charge, charge, critical)
++        assert not outbox.budget_allows(1, ceiling - charge + 1, charge, critical)
++    monkeypatch.setattr(outbox, "WARNING_BYTES", expected)
++    assert outbox.outbox_health(conn)["warning"]
++    # Test the new logical admission arithmetic using small rows, no physical pressure.
++    monkeypatch.setattr(batches, "HARD_BYTES", expected + 8192)
++    with pytest.raises(outbox.ArchiveBlocked, match="live forecast"):
++        batches.claim_batch(conn, BatchLimits(), claim)
++    conn.rollback()
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
++    )
++
++
++@requires_db
++def test_fix1_retirement_preserves_version_coverage_and_pending_batch(conn):
++    from tests.test_lifecycle_reconcile import setup_source
++    from job_discovery.lifecycle.claims import claim_work
++    from uuid import uuid4
++
++    setup_source(conn)
++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
++    version = uuid4()
++    conn.execute(
++        """INSERT INTO job_versions(id,job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
++      VALUES(%s,%s,%s,1,%s,'{"title":"Role","url":"https://example.test/job"}',clock_timestamp())""",
++        (version, listing["job_id"], listing["id"], "f" * 64),
++    )
++    conn.commit()
++    activate_fixture(conn)
++    claim = claim_work(conn, "archive", "terminal-versions", 180)
++    outbox.baseline_batch(conn, "job_versions", claim)
++    conn.commit()
++    old = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    seal = batches.seal_batch(old)
++    batches.persist_seal(conn, seal)
++    conn.commit()
++    batches.ack_batch(conn, verified(seal), claim)
++    conn.commit()
++    conn.execute("INSERT INTO brands(name) VALUES('Still pending')")
++    outbox.flush_public_changes(conn, claim)
++    conn.commit()
++    pending = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
++    )
++    conn.execute(
++        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
++    )
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
++    )
++    conn.commit()
++    # Bounded continuation, including partial removal, retains exact coverage.
++    for _ in range(3):
++        assert batches.compact_terminal_batches(conn, claim, limit=1) == 1
++        conn.commit()
++    assert (
++        conn.execute(
++            "SELECT version_id FROM public_archive_version_coverage"
++        ).fetchone()["version_id"]
++        == version
++    )
++    assert (
++        conn.execute("SELECT batch_id FROM public_archive_batches").fetchone()[
++            "batch_id"
++        ]
++        == pending.batch_id
++    )
++    assert (
++        conn.execute("SELECT event_id FROM public_outbox").fetchone()["event_id"]
++        == pending.ordered_event_ids[0]
++    )
++    assert batches.compact_terminal_batches(conn, claim) == 0
++
++
++@requires_db
++def test_fix1_critical_observation_and_recording_survive_seal(conn):
++    from job_discovery.archive.outbox import baseline_batch
++
++    source, claim = setup(conn, count=1)
++    activate_fixture(conn)
++    for kind in ("jobs", "source_listings"):
++        baseline_batch(conn, kind, claim)
++    conn.commit()
++    seq, _ = op.start(conn, source["id"], claim)
++    conn.commit()
++    op.sightings(conn, source["id"], seq, claim, [("0", "removed")])
++    conn.commit()
++    slots = conn.execute(
++        "SELECT * FROM public_critical_event_slots WHERE state='pending'"
++    ).fetchall()
++    assert len(slots) == 2
++    for slot in slots:
++        event = json.loads(bytes(slot["canonical_event"]))
++        assert event["observed_at"] and event["provenance"] == "source_observation"
++        assert event["recorded_at"] != event["observed_at"]
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    seal = batches.seal_batch(ref)
++    batches.persist_seal(conn, seal)
++    conn.commit()
++    assert batches.seal_batch(batches.recover_batch(conn, ref.batch_id, claim)) == seal
++
++
++@requires_db
++def test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer(conn):
++    from job_discovery.db import upsert_jobs
++    from job_discovery.models import Posting
++
++    claim, _ = seeded_events(conn, 1)
++    conn.execute("DELETE FROM public_archive_destination")
++    conn.commit()
++    with pytest.raises(outbox.ArchiveBlocked, match="prefix not validated"):
++        batches.claim_batch(conn, BatchLimits(), claim)
++    conn.rollback()
++    with pytest.raises(
++        reconcile.StorageBlocked, match="legacy public job writer disabled"
++    ):
++        upsert_jobs(
++            conn,
++            1,
++            "lever",
++            "fixture",
++            [Posting("0", "Role", "https://example.test/job")],
++        )
++    conn.rollback()
++
++
++@requires_db
++def test_fix1_version_mutator_preserves_its_explicit_observation(conn):
++    from datetime import UTC, datetime
++    from job_discovery.lifecycle.identity import capture_version
++
++    source, claim = setup(conn, count=1)
++    activate_fixture(conn)
++    listing = conn.execute("SELECT * FROM source_listings").fetchone()
++    observed = datetime(2026, 1, 2, 3, 4, tzinfo=UTC)
++    capture_version(
++        conn,
++        listing["id"],
++        {"title": "Observed role", "url": "https://example.test/job"},
++        observed,
++        claim,
++    )
++    conn.commit()
++    events = [
++        json.loads(bytes(r["canonical_event"]))
++        for r in conn.execute(
++            "SELECT canonical_event FROM public_outbox WHERE aggregate_type IN ('job_versions','source_listings')"
++        )
++    ]
++    assert len(events) == 2
++    assert all(
++        e["observed_at"] == observed.isoformat()
++        and e["recorded_at"] != e["observed_at"]
++        and e["provenance"] == "source_observation"
++        for e in events
++    )
++
++
++@requires_db
++def test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress(conn, monkeypatch):
++    from company_discovery import db, worker
++    from company_discovery.dataset import Candidate
++
++    activate_fixture(conn)
++    monkeypatch.setattr(
++        worker.dataset,
++        "load_candidates",
++        lambda _: [
++            Candidate(f"Company {i}", "lever", f"fixture-{i}") for i in range(101)
++        ],
++    )
++    actual = db.upsert_candidates
++    calls = []
++
++    def fail_second(c, rows):
++        calls.append(len(rows))
++        if len(calls) == 2:
++            raise outbox.ArchiveBlocked("ordinary fixture archive deferral")
++        return actual(c, rows)
++
++    monkeypatch.setattr(db, "upsert_candidates", fail_second)
++    with pytest.raises(outbox.ArchiveBlocked):
++        worker._maybe_ingest(conn)
++    conn.rollback()
++    assert calls == [100, 1]
++    assert conn.execute("SELECT count(*) n FROM companies").fetchone()["n"] == 100
++    assert outbox.outbox_health(conn)["events"] == 100
++    row = conn.execute("SELECT status,ingested,notes FROM discovery_runs").fetchone()
++    assert (
++        row["status"] == "error"
++        and row["ingested"] == 100
++        and row["notes"].startswith("weekly ingest tick")
++    )
++
++
++@requires_db
++@pytest.mark.parametrize("writer", ["seed", "enrichment"])
++def test_fix1_current_writer_pair_failure_rolls_back_mutation(
++    conn, monkeypatch, writer
++):
++    from job_discovery.db import sync_seed
++    from company_discovery.enrich_apply import apply_enrichment, EnrichUpdate
++
++    activate_fixture(conn)
++    sync_seed(conn, [dict(name="Original", ats="lever", token="paired")])
++    conn.commit()
++    cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
++    conn.commit()
++
++    def blocked(*args, **kwargs):
++        raise outbox.ArchiveBlocked("ordinary fixture pairing admission deferred")
++
++    monkeypatch.setattr(outbox, "record_public_change", blocked)
++    with pytest.raises(outbox.ArchiveBlocked):
++        if writer == "seed":
++            sync_seed(conn, [dict(name="Uncommitted", ats="lever", token="paired")])
++        else:
++            apply_enrichment(
++                conn, cid, EnrichUpdate("Uncommitted", "Public about", "ats_board")
++            )
++    conn.rollback()
++    row = conn.execute("SELECT name,display_name FROM companies").fetchone()
++    assert row == dict(name="Original", display_name=None)
++    assert outbox.outbox_health(conn)["events"] == 1
++    assert (
++        conn.execute("SELECT revision FROM public_archive_heads").fetchone()["revision"]
++        == 1
++    )
++
++
++@requires_db
++def test_fix1_key_day_is_utc_even_for_an_offset_ref(conn):
++    from dataclasses import replace
++    from datetime import datetime, timedelta, timezone
++
++    claim, _ = seeded_events(conn, 1)
++    ref = batches.claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    offset = datetime(2026, 1, 2, 1, tzinfo=timezone(timedelta(hours=14)))
++    seal = batches.seal_batch(
++        replace(ref, sealed_at=offset, eligible_until=offset + timedelta(days=730))
++    )
++    assert "/ingestion_date=2026-01-01/" in seal.data_key
+diff --git a/tests/test_archive_outbox.py b/tests/test_archive_outbox.py
+index e36bf91..49712f3 100644
+--- a/tests/test_archive_outbox.py
++++ b/tests/test_archive_outbox.py
+@@ -185,20 +185,21 @@ def test_listing_watermark_does_not_certify_unknown_version(conn):
+     conn.commit()
+ 
+ 
+ @requires_db
+ def test_migration_reapplication_preserves_flags_and_existing_events(conn):
+     from pathlib import Path
+     from tests.archive_helpers import seeded_events
+ 
+     claim, refs = seeded_events(conn, 1)
+     conn.execute(Path("migrations/2026-10-03-04-public-outbox.sql").read_text())
++    conn.execute(Path("migrations/2026-10-03-05-public-outbox-fix1.sql").read_text())
+     conn.commit()
+     assert {
+         r["event_id"]
+         for r in conn.execute("SELECT event_id FROM public_pending_events")
+     } == {r.event_id for r in refs}
+ 
+ 
+ @requires_db
+ def test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup(conn):
+     from uuid import uuid4
+diff --git a/tests/test_lifecycle_operational.py b/tests/test_lifecycle_operational.py
+index 9d99335..5ac9b3b 100644
+--- a/tests/test_lifecycle_operational.py
++++ b/tests/test_lifecycle_operational.py
+@@ -99,27 +99,27 @@ def test_partial_positive_survives_restart_and_never_certifies_absence(conn):
+     conn.commit()
+     op.sightings(conn, source_id, sequence, claim, [("0", "seen")])
+     conn.commit()
+     fresh = open_sessions(TEST_DSN, 1)[0]
+     try:
+         op.complete(fresh, source_id, sequence, claim, successful=False, failed=True)
+         fresh.commit()
+         assert op.reconcile(fresh, source_id, sequence, claim)
+         fresh.commit()
+         row = fresh.execute(
+-            "SELECT * FROM lifecycle_operational_listings WHERE seen_sequence=%s",
++            "SELECT p.*,l.consecutive_complete_misses FROM lifecycle_operational_listings p JOIN source_listings l ON l.id=p.listing_id WHERE seen_sequence=%s",
+             (sequence,),
+         ).fetchone()
+-        assert row["seen_at"] and row["miss_count"] == 0
++        assert row["seen_at"] and row["consecutive_complete_misses"] == 0
+         assert (
+             fresh.execute(
+-                "SELECT max(miss_count) n FROM lifecycle_operational_listings"
++                "SELECT max(consecutive_complete_misses) n FROM source_listings"
+             ).fetchone()["n"]
+             == 0
+         )
+         next_sequence, resuming = op.start(fresh, source_id, claim)
+         assert next_sequence > sequence and not resuming
+         fresh.commit()
+     finally:
+         fresh.close()
+ 
+ 
+@@ -136,21 +136,21 @@ def test_complete_checkpoint_resumes_with_fresh_connection(conn):
+     assert not op.reconcile(conn, source["id"], sequence, claim, limit=1)
+     conn.commit()
+     fresh = open_sessions(TEST_DSN, 1)[0]
+     try:
+         assert op.start(fresh, source["id"], claim) == (sequence, True)
+         fresh.commit()
+         assert op.reconcile(fresh, source["id"], sequence, claim)
+         fresh.commit()
+         assert (
+             fresh.execute(
+-                "SELECT sum(miss_count) n FROM lifecycle_operational_listings"
++                "SELECT sum(consecutive_complete_misses) n FROM source_listings"
+             ).fetchone()["n"]
+             == 3
+         )
+     finally:
+         fresh.close()
+ 
+ 
+ @requires_db
+ def test_active_archive_critical_slots_exact_ack(conn):
+     from tests.archive_helpers import activate_fixture
+@@ -195,22 +195,31 @@ def test_active_archive_critical_slots_exact_ack(conn):
+         == 2
+     )
+ 
+     from job_discovery.archive.batches import compact_terminal_batches
+ 
+     conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+     conn.execute(
+         "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+     )
+     conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
++    )
++    conn.execute(
++        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
++    )
++    conn.execute(
++        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
++    )
+     conn.commit()
+-    assert compact_terminal_batches(conn, claim) == len(batch.ordered_event_ids) + 2
++    assert compact_terminal_batches(conn, claim) == len(batch.ordered_event_ids) + 4
+     conn.commit()
+     assert (
+         conn.execute(
+             "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked' AND canonical_event=''::bytea"
+         ).fetchone()["n"]
+         == 2
+     )
+ 
+ 
+ @requires_db
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-requirements-review.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-requirements-review.md
new file mode 100644
index 0000000..80c9768
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-requirements-review.md
@@ -0,0 +1,115 @@
+# Task 10 Fix1 — same-reviewer scoped requirements and code-quality review
+
+**DONE. Requirements / Spec: FAIL. Quality: CHANGES_REQUIRED.**
+
+Fix1 corrects substantial parts of all seven original findings. Three Important residual/fix-introduced functional issues remain. No Critical finding is assigned. This report is the same original reviewer's one scoped rereview; it is not a whole-task rerun, a security approval, an activation decision or a release decision.
+
+## Exact pins and review scope
+
+- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+- Original Task10 base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
+- Original reviewed head / FixBASE: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
+- Fix1 product/test source: `01408f0fce8743a98a55726cc9da50f808955443`.
+- Fix1 full report/evidence head: `095fec89132bec361c6b1733d1fd97ff5018a6ed`.
+- Observed checkout HEAD during the final read-only integrity check: `095fec89132bec361c6b1733d1fd97ff5018a6ed`.
+
+Read `task-10-fix1-reviewer-dispatch.md` first, the complete Fix1 author report, the original requirements review, the binding review-scope/release amendments, and the operational ruling. Examined the complete pinned Fix1 review package and the actual affected source/test files. The package includes controller documents and the historical original review package; these historical inclusions do not expand this rereview's product scope. A full text comparison confirms its recorded diff equals `git diff --unified=10` for the exact FixBASE/head. All 25 Fix1 source hash entries match. Both Task10 migrations, 04 and 05, occur verbatim in `schema.sql`.
+
+Scope is original R10-1 through R10-7 and Important/Critical defects introduced by their corrections only. Earlier unrelated/minor observations are carried without expanding review. No tests, DB probes, migrations, product edits, staging/commits, subagents, network/provider calls, activation or release actions were performed by this reviewer. Only this review report was written.
+
+## Disposition of each original finding
+
+| Original finding | Scoped disposition | Source/evidence assessment |
+| --- | --- | --- |
+| **R10-1: independent operational absence history** | **CLOSED** | `lifecycle/operational.py:276` now uses `source_listings.consecutive_complete_misses` and `first_complete_miss_at`; the operational row retains only miss-sequence idempotence. Normal positives clear that same authoritative history. Three new ordinary lane-switch/resume cases cover the reported sequences. This closes the stale counter defect, not broad concurrency/fairness assurance. |
+| **R10-2: canonical-only live-byte accounting** | **PARTIALLY FIXED; OPEN** | Migration05 `archive_live_bytes` includes requirements, outbox/critical rows, membership and seals; Python/SQL producer checks and health use it. The original omitted-representation problem is corrected. However, batch claim/seal additions use only the hard ceiling and can consume the closure-only reserve or strand admitted work without logical processing room. See F1-1. |
+| **R10-3: ArchiveBlocked misses storage-deferred orchestration** | **DIRECT SOURCE-LOOP DEFECT FIXED; INTEGRATION OPEN** | `ArchiveBlocked` now subclasses the shared `StorageBlocked`; chunk and final-reconciliation handlers roll back, count deferral and call the operational lane. The affected source can remain eligible even after normal completion moved its due date. The two recorded offline actual-source-loop cases support this correction. The newly paired seed phase at the containing daily entrypoint remains uncaught and can stop verification before that corrected loop is reached. See F1-3. |
+| **R10-4: unsupported current public writers** | **PAIRING/INVENTORY FIXED; FIX REGRESSIONS OPEN** | Seed, candidate, enrichment, classification, name and location helpers now use `archive.writers.public_write`; scheduled candidate/seed ingestion is chunked, and weekly progress shares the mutation transaction. Legacy public Job writers have an explicit post-cutover rejection. The inventory no longer certifies unspecified creators/ad hoc SQL. Remaining issues are the new 100-row restamp truncation (F1-2) and daily seed-pressure integration (F1-3). |
+| **R10-5: missing observed/recorded distinction** | **CLOSED** | Canonical envelopes now carry nullable aware observation time, DB-recorded time and explicit provenance; the migration binds these fields in ordinary/critical pair checks. Baseline scans retain unknown observation, while version/listing and critical observation fixtures carry supplied evidence distinctly from recording time. No legacy observation history is invented by the baseline API. |
+| **R10-6: sealed key/manifest mismatch** | **CLOSED** | `archive/batches.py:29` derives service-prefix/UTC-day/batch-ID/compressed-hash keys. `_manifest` includes exact-ID digest, aggregate revision ranges and full batch/schema/serializer/prior identity. `persist_seal` compares the complete expected canonical manifest. Prefix/date/schema are persisted; no production destination row is created. Recorded identity-rejection, deterministic recovery and +14:00 UTC-partition cases support the fix. |
+| **R10-7: permanent full terminal receipts/catalogue** | **CLOSED** | Ack creates compact batch markers with coverage referencing them. `compact_terminal_batches` retires aged acknowledged slot payloads/items/full receipts/batches in a shared ≤2,000-row operation budget; exact/version/fence markers remain. Recorded limit=1 continuation and unrelated-pending-batch fixtures support bounded acknowledged-only cleanup. Scheduling remains downstream. |
+
+“Closed” means the original ordinary requirement defect is addressed within this scoped source/evidence review. It supplies no omitted mechanism/security approval and does not certify downstream transport/replay work.
+
+## Remaining Important findings — complete Fix1 fix list
+
+### F1-1 — Ordinary batch processing can spend the critical reserve and exhaust its own processing room
+
+**Important. Original R10-2 remains open.** Exact primary location: `job_discovery/archive/batches.py:24`. Call sites: `batches.py:157` (membership/batch addition) and `batches.py:338` (seal addition). Producer-side comparison: `job_discovery/archive/outbox.py:95`; logical representations: `migrations/2026-10-03-05-public-outbox-fix1.sql:37`.
+
+The new logical forecast correctly counts more than canonical event bytes. But `_live_capacity` admits every batch claim and seal against `HARD_BYTES`, regardless of whether its selected events are ordinary. For example, an ordinary pending set at 110 MiB can claim an ordinary batch whose additional membership/batch charge is 4 MiB: 114 MiB passes the 128 MiB check although 2 MiB of the closure/reopen-only reserve has now been spent by ordinary work. The added representation is explicitly part of the live archive budget; it cannot be excluded from the reserve requirement after being counted for other purposes. The approved contract reserves the final 16 MiB **and** 12,500 event slots for critical closure/reopen transitions.
+
+There is also no logical room reserved at event admission for the future membership and seal representations. Critical events may be admitted close enough to 128 MiB that no batch can be claimed, or already-claimed work can lose the room needed to persist its seal. Pending events cannot be acknowledged until those stages succeed, and pending data cannot be deleted to free the budget. This can leave a healthy exporter unable to drain a backlog solely because of the new logical accounting, independently of physical headroom. The default selector also attempts its full chosen membership charge rather than shrinking it to available processing room.
+
+The new small-row test checks that added membership is counted and that an over-budget claim defers. It does not show that ordinary processing preserves critical reserve or that admitted pending work retains a bounded path through seal/ack. Transparent deferral is necessary, but does not make this reserve consumption or self-blocking logical workflow conformant.
+
+**Narrow correction:** make the logical accounting cover an event's bounded processing lifecycle while preserving the critical-only byte reserve. Account for future membership/seal workspace before admitting work, or provide another explicit bounded accounting design that prevents ordinary copies from spending critical allowance and guarantees processing room for admitted pending work. Charge only within the unchanged total logical ceiling and unchanged physical reservation contract. Merely changing the batch check from 128 to 112 MiB would leave ordinary admission able to fill all ordinary space before membership can be created, so that alone is insufficient. If selecting smaller batches is part of the solution, ensure repeated selection makes progress and reserves its subsequent seal charge.
+
+**Ordinary evidence needed:** small/scaled logical-budget fixtures showing (1) an ordinary claim/seal cannot reduce the reserved critical allowance; (2) a permitted critical transition still fits its reserved logical space; and (3) pending events admitted near the relevant logical boundary can be claimed, sealed and acknowledged without deleting unverified data or exceeding the hard limit. These are arithmetic/new archive-state tests, not physical-capacity, MVCC, adversarial or omitted Task3 mechanism probes. None was run in this review.
+
+### F1-2 — Location restamping silently stops after the first 100 Jobs
+
+**Important. Introduced by the R10-4 writer batching correction.** Exact primary location: `job_discovery/locations.py:68`. Containing caller: `locations.py:151`.
+
+`stamp_jobs` was changed from a full set-based update to `ORDER BY j.id LIMIT 100`, which is an appropriate per-transaction bound only if the caller continues. `resolve_new_locations` still invokes it exactly once, commits, logs counts and returns. The actual daily/location-backfill caller therefore leaves all remaining mismatched Jobs untouched while presenting the pass as completed. This affects flags-off callers too.
+
+For a rule resolution or manual correction affecting 101 Jobs, only the first 100 get their canonical locations during that invocation. A correction affecting thousands can take many daily runs, with the review/filtering phase consuming stale canonical locations in the meantime. This is a regression from the existing documented next-poll correction propagation. The report's “sorted affected Job chunks” description is incomplete: the current code processes one chunk, with no continuation.
+
+The two selected location regressions use small fixtures and do not exercise more than one stamping chunk. The active location test verifies dictionary event pairing, not completion of all dependent Job cache rows.
+
+**Narrow correction:** retain the ≤100-row transaction helper but have the real resolution/backfill workflow iterate and commit bounded chunks until its intended pass is complete, accumulating the actual committed count. If a deadline or storage deferral interrupts it, expose an explicit incomplete/deferred outcome and retain committed progress rather than reporting full completion. Preserve sorted Job locking, paired location facts and no public event for derived-cache-only stamping.
+
+**Ordinary evidence needed:** invoke `resolve_new_locations` with at least 101 affected Jobs (both initial resolution and correction can share a compact fixture design), confirm all intended rows are eventually stamped in bounded committed chunks, and verify a later-chunk failure preserves earlier committed progress and reports incomplete work. No network/model call or physical guard experiment is necessary.
+
+### F1-3 — Seed archive pressure aborts the daily entrypoint before source verification
+
+**Important. Residual R10-3/R10-4 integration gap exposed by the newly paired seed writer.** Exact primary location: `job_discovery/run.py:108`. Related locations: `run.py:112`, `run.py:115`, `job_discovery/db.py:63`, and `job_discovery/archive/writers.py:40`.
+
+The daily runner starts its poll-run row and executes the newly paired `sync_seed` chunks before reading `source_enabled` or entering source verification. There is no `StorageBlocked`/`ArchiveBlocked` handler around those chunks. The outer runner block has only `finally: conn.close()`. A new seed or a changed seed name while ordinary archive admission is paused therefore raises from the seed flush and exits the complete daily run before any existing-source health/closure work gets a turn. The later handler around `sync_source_accounts` cannot catch an earlier seed exception.
+
+This is the real entrypoint boundary, beyond the two new tests that invoke `verify_due_sources` directly. The new individual seed pair-failure tests correctly prove rollback, but not that a rejected ingestion phase permits existing-source verification to continue. With a persistent changed seed and no immediately drained backlog, the same startup failure can repeat on subsequent scheduled runs while critical reserve or operational slots are still available.
+
+There is an accounting detail to preserve when fixing this: the first seed chunk currently shares the initial uncommitted `poll_runs` insertion, while successful later chunks may already have committed. Simply rolling back the first failed chunk and proceeding with the old `run_id` can leave no durable run row to finalize.
+
+**Narrow correction:** handle seed storage/archive deferral at the containing daily entrypoint. Roll back only the failed chunk, stop further ordinary seed admission for that turn, retain earlier committed seed/event chunks, record a truthful storage-deferred outcome, and continue existing-source verification through the supported normal/operational orchestration. Ensure run accounting exists durably after the first-chunk rollback case and reflects the deferral; do not count rolled-back seed mutations as committed. Do not skip required source verification or bypass paired event admission.
+
+**Ordinary evidence needed:** offline actual `job_discovery.run.run` fixtures injecting the new archive-pressure outcome at the first seed chunk and a later chunk, proving rejected mutation/event rollback, preservation of already committed chunks, durable run accounting, and that existing-source verification still executes. Keep the test at this new integration boundary; no large-load, activation-security or old capacity-mechanism test is requested.
+
+## Evidence actually read and verification performed
+
+**Reviewer execution:** no tests rerun and no new tests/probes executed. Read-only checks performed were exact source hash verification, full pinned diff/package comparison, schema/migration text equality, line/caller inspection and HEAD lookup. This is source-derived review supported by author-recorded execution, not a claim that the reviewer reproduced runtime behavior.
+
+Read the complete `task-10-fix1-report.md`, original review, scoped dispatch and amendments/ruling; the affected product diff; the full new `tests/test_archive_fix1.py`; changed original test expectations and helper; exact selection JSON/collected node list; command chronology; both final command files, output files and zero exit files; runtime versions and final lint result. The package preserves the RED/development failures and author explains their chronology; they are not counted as passes. The original report's errors are not silently erased by this review.
+
+| Final author evidence | Actual result |
+| --- | --- |
+| Owned PostgreSQL 17.11 | **66 passed**, 110.76 seconds; exit 0; no skips shown |
+| Owned PostgreSQL 16.15 | **66 passed**, 120.18 seconds; exit 0; no skips shown |
+| Final Ruff affected-source evidence | All checks passed |
+| Reviewer source integrity | All 25 Fix1 hash entries matched |
+| Reviewer schema parity | Entire migrations 04 and 05 present verbatim in `schema.sql` |
+| Reviewer package integrity | Complete recorded FixBASE→head diff matched pinned Git diff |
+
+The 66-case selection is 37 original permitted cases, 24 new Fix1 cases and five selected caller regressions. Unlike the earlier incremental original-task evidence, this is one complete final selection on each major. Actual versions are Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and Ruff 0.15.20. PostgreSQL 17.11 supports major-version parity; it is not a run on historical production 17.6. PostgreSQL 16.15 supplies compatibility evidence.
+
+The final small operational fixture printed zero allocated/table+TOAST/index deltas: PG17 allocated 40,711,859 bytes before/after; PG16 41,032,727; table+TOAST 1,114,112 and indexes 1,622,016 on both. These are measurements of those fixtures only. They do not show production headroom, operation beyond 6000 MiB, repeated MVCC reuse, unlimited physical growth avoidance, large-board fairness or physical credit after cleanup.
+
+The recorded selected tests establish useful narrow behavior: authoritative lane-switch absence counters, actual-source-loop pressure classification, real public writer pairing and rollback, bounded weekly committed progress, explicit temporal provenance, UTC key layout and complete manifest identity, and acknowledged-only terminal retirement with exact coverage/pending preservation. They do not cover the three remaining source-derived scenarios above.
+
+## Scope distinctions, minor carry-forward and remaining prerequisites
+
+**Implemented and ordinarily reviewed here:** the Fix1 changes for shared absence evidence; expanded logical archive forecasts; new exception hierarchy and source-loop deferral; current writer wrapper/caller changes; observed/recorded/provenance persistence; service-prefix/UTC/hash key/manifest contract; and marker-backed terminal retirement. The remaining defects are limited to those changes' reserve/liveness and actual caller behavior.
+
+**Deliberately unreviewed:** refused Task3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes, including renamed/split/substituted equivalents. No security/activation/helper attack suite was rerun or reproduced. New logical archive accounting and normal lane-switch correctness were inspected as explicitly authorized original findings; neither supplies a physical/security mechanism verdict. The unchanged old physical reservation calls were treated as interfaces, not independently certified. No new safeguard rejection occurred in this reviewer session.
+
+Earlier minor observations remain subordinate to the scoped Important review. The predecessor set/bulk coverage lookup, directly asserted warning predicate and clearer metadata type predicate address three earlier readability/efficiency/evidence comments. Historical duplicate migration04 definitions remain preserved; migration05 adds forward overrides and schema parity holds. No claim of throughput, deadline or lock-time proof is made, and no unrelated cleanup is required for this verdict.
+
+The R6-4 lane remains a concrete bounded durable implementation. Its single source/receipt rows, per-known-listing marks and finite 12,500 critical slots must be provisioned before storage admission stops. Default provisioning remains 100 listings/16 slots with a 7,798,784-byte forecast; each free slot has 24,576 padding bytes, or 307,200,000 bytes for a full pool before overhead. Those logical preallocations do not guarantee physical UPDATE reuse. Slots remain terminal after exact acknowledgement; no automatic recycling is implied. Missing existing claim/listing/receipt coverage or active-archive baseline, exhausted slots and unavailable physical capacity still cause explicit deferral. Batch/seal/ack physical reservations remain necessary. F1-1 additionally requires fixing the new logical processing-room policy.
+
+Production defaults remain off, retirement dry-run and archive inactive. The new destination table is empty in production by design; owned fixtures insert only `fixture/public`. Actual destination validation, approved configuration, compatible supported writer deployment, complete bounded baselines and operational preallocation remain prerequisites. The author explicitly treats this as a pre-activation contract correction; the evidence does not establish migration of an already-active older archive format. Supporting such an active older deployment would need separate scoped planning rather than an implied compatibility claim.
+
+Task11 still owns transport/export loop, periodic flush/terminal scheduling, persisted fake-S3 crash cases and separately authorized expired replacement. Task12 owns replay. Compact markers deliberately outlive full terminal receipts/catalogue and require later operational sizing. The existing amendment permits development with omitted independent review gaps; the later release authorization remains for the controller's completed-upgrade workflow, not permission to accept these remaining Important findings or release from this reviewer.
+
+The author should address F1-1, F1-2 and F1-3 together as the complete remaining scoped fix list, retain truthful evidence/limits, and provide forward source/report pins. No previously covered test rerun or omitted probe was performed by this reviewer. No further review surface was added beyond the original findings and their fixes.
+
+**Final disposition: Requirements / Spec FAIL; Quality CHANGES_REQUIRED. Same reviewer DONE and STOP.**
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-reviewer-dispatch.md
new file mode 100644
index 0000000..35e1602
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix1-reviewer-dispatch.md
@@ -0,0 +1,9 @@
+# Task10 same-reviewer scoped Fix1 review
+
+Resume the SAME original Task10 requirements/code-quality reviewer after author DONE/STOP and controller full report/evidence read. Review the complete pinned FixBASE `e3f889421fa1ad30206e128cb292b101bc3a58e0` through the actual final report/evidence HEAD in `task-10-fix-1-review-package.md`; source commit `01408f0fce8743a98a55726cc9da50f808955443` is not alone the final handoff. Read the complete Fix1 report, original `task-10-requirements-review.md`, operational ruling, and binding review-scope/release amendments.
+
+Scope: original R10-1 through R10-7 and Important/Critical defects introduced by their fixes only. Check authoritative absence evidence across operational/normal lanes; conservative logical archive charges; actual orchestration handling of ArchiveBlocked; supported current public writer pairing and truthful legacy gating; observed/recorded UTC/provenance; trusted prefix/date/hash keys and complete immutable manifests; acknowledged-only terminal compaction retaining exact compact coverage/fences. Record each original finding disposition and requirements/code-quality verdicts. Carry earlier minor observations to final review without unrelated expansion.
+
+Read-only local source and existing actual evidence; do not edit product/source/tests, stage/commit, spawn helpers, run network/provider/production/release actions, or rerun already covered tests. This is not a whole-task rerun or a replacement independent security review. Do not retry, disguise, reproduce, split, or substitute the deliberately omitted Task3 expiry/physical-capacity/cross-user/adversarial reviews or probes. New logical archive accounting and ordinary lane-switch correctness may be assessed within the seven findings; no general MVCC, zero-growth, production-above-guard, or full-security assurance follows from the small fixture evidence.
+
+Write `task-10-fix1-requirements-review.md` with exact reviewed pins, implemented/tested/reviewed/deliberately-unreviewed scope and residual limitations. Return DONE plus PASS/FAIL and APPROVED/CHANGES_REQUIRED. Controller owns documentation commit and release only after all13/final review.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-dispatch.md
new file mode 100644
index 0000000..21db1c6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-dispatch.md
@@ -0,0 +1,13 @@
+# Task10 SAME author Fix2 — one complete remaining correction pass
+
+Read FULL `task-10-fix1-requirements-review.md`. Its F1-1, F1-2 and F1-3 findings, narrow corrections and ordinary evidence requirements are the complete remaining fix list verbatim. FixBASE is previous reviewed report/evidence HEAD `095fec89132bec361c6b1733d1fd97ff5018a6ed`; previous source `01408f0fce8743a98a55726cc9da50f808955443`. Controller documentation commits above it must remain untouched. Original brief/spec, operational ruling, review-scope and release amendments bind. SAME author; no helpers/subagents/reviewers/replacement implementation.
+
+F1-1 requires a coherent bounded logical processing lifecycle: ordinary membership/seal work preserves the critical-only allowance, and admitted ordinary/critical pending work has bounded claim/seal/ack processing room without unverified deletion. Read the review's complete arithmetic examples and liveness warning; changing HARD to ORDINARY alone is insufficient. Keep unchanged total logical limits and the old physical reservation contract. Record a controller-needed ambiguity before any change to established physical/role/claim enforcement. Small scaled logical accounting/processing fixtures only; no omitted physical-capacity, expiry, cross-user, adversarial probes or substitutes.
+
+F1-2 requires actual location resolution/backfill continuation through bounded committed stamping chunks, truthful committed totals, and explicit incomplete/deferred status on interruption. Preserve sorted Job locks, public dictionary pairing and no event for cache-only stamping. Offline actual caller fixtures at least101 affected rows, including correction and later-chunk failure preserving progress.
+
+F1-3 requires actual daily `job_discovery.run.run` seed deferral handling: failed chunk rolls back; earlier committed seed/events remain; durable poll-run accounting survives first-chunk failure; existing-source verification continues. Do not bypass paired event admission or misclassify rolled-back seed work. First and later chunk offline actual-entrypoint regressions required.
+
+Write an explicit permitted test-content inventory BEFORE executing. Select new cases plus affected ordinary tests on owned random-loopback PG17/16; no broad pytest, shared55432, deferred security/activation/physical mechanism suites or production/provider/network calls. Only rerun previously covered selections when this source delta affects them; retain exact commands, versions, outputs, RED/failures, phase pins and scope. `/bin/bash`, login:false.
+
+Append complete Fix2 section to task-10-report.md and write full task-10-fix2-report.md plus sanitized task-10-evidence/fix2/. Forward commit only owned source/tests/report/evidence; root docs unstaged. Return DONE plus source/report pins, one-line actual verification, concerns and STOP Git. Controller FULL report/evidence read then complete FixBASE..finalHEAD package and SAME reviewer scoped F1-1..3 plus fix-introduced Important/Critical only. Production flags off/dry-run/archive inactive; no activation, destination/IAM/credentials, permanent deletion, publish/merge/deploy or safeguard bypass. Report exact rejection and stop only affected work if encountered.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-report.md
new file mode 100644
index 0000000..0d7019a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-fix2-report.md
@@ -0,0 +1,101 @@
+# Task10 Fix2 author report
+
+The same author completed the three remaining corrections F1-1, F1-2 and F1-3 together. The implementation is ready for the controller's same independent reviewer, scoped to those findings and fix-introduced Important/Critical issues. This report does not supply a reviewer verdict, security assurance, activation permission or release approval.
+
+## Scope and pins
+
+Worktree `/workspace/job-board/.claude/worktrees/lifecycle-recovery`, branch `feature/lifecycle-recovery`. FixBASE is reviewed report/evidence `095fec89132bec361c6b1733d1fd97ff5018a6ed`, source `01408f0fce8743a98a55726cc9da50f808955443`. Controller commit `ae0b73f` and later controller documents were preserved. Original reconstruction base remains `6075983bd63dced95ec94dc61b9b112a79f4564d`.
+
+Final Fix2 source/test commit: **872a9844f59d3ed4db483ff13fe40c0e02bff09b**. The subsequent report/evidence-only commit is supplied exactly in the author handoff. No product source changed after the final affected verification.
+
+Read the full Fix2 dispatch and full same-reviewer Fix1 review. Their three findings/narrow corrections are the complete correction list. Binding original brief/specification, operational ruling, review-scope and release amendments remain in force. The controller confirmed the logical event-admission escrow design and its receipt-bound correction before completion. No existing physical/role/claim enforcement was changed. No helper, replacement author, subagent or independent reviewer was launched.
+
+The receiving-code-review and test-driven-development skills guided source verification and ordinary RED/GREEN tests. Their broad-suite guidance did not override the explicit authorized test boundaries. Exact contents were inventoried before each selection; no omitted Task3 probe was rerun, renamed or substituted.
+
+## F1-1: admission reserves a bounded processing lifecycle
+
+The previous Fix1 implementation counted actual pending representations but charged membership and seal creation as new growth against the hard ceiling. That could spend critical-only space on ordinary copies or admit pending work with no room to process it. Fix2 reserves future logical processing space when each event is admitted. Claim, seal and acknowledgement materialize their bounded representations inside that event's reservation; they do not require a new share of the ordinary/critical logical allowance.
+
+`archive_budget_bytes` is now the committed lifecycle forecast: current requirements, ordinary outbox rows and allocated/pending critical-slot base representations, plus processing escrow for each pending event. `outbox_health['bytes']` and warning/pause/admission use that forecast. `outbox_health['live_bytes']` separately reports the previous actual-retained-representation forecast, including current memberships and seals. Neither value is physical PostgreSQL allocation. All original 112/128MiB,87,500/100,000 event limits and the16MiB/12,500 reserve dimensions remain unchanged. Ordinary admission including its entire future workspace must fit112MiB; critical closure/reopen admission including its entire workspace must fit128MiB.
+
+For an immutable canonical event of `C` bytes, processing escrow is **`6*C + 128,000` bytes**. The conservative singleton decomposition is:
+
+| Phase/representation | Reserved logical charge per event |
+| --- | --- |
+| Membership copy and row/index forecast | `2*C + 1,024` |
+| Standalone batch metadata | `8,192` |
+| Seal metadata and manifest | `4,096 + 2*(8,192 + 2*C)` |
+| Exact-ack receipt, coverage and compact-marker workspace | `98,304` |
+| Total | `6*C + 128,000` |
+
+The existing pending representation charges remain: each requirement `2*body_bytes+2,048`, ordinary outbox `2*(body_bytes+C)+2,048`, and allocated/pending critical row `2*(body_bytes+C)+2,048`. A pending ordinary event therefore commits `4*body_bytes+2*C+4,096` plus escrow. A preallocated critical event has no separate requirement copy, so it commits `2*body_bytes+2*C+2,048` plus escrow. During critical allocation the body is already counted; flush adds canonical bytes and the processing escrow. Python and SQL ordinary/critical event admission use the same SQL charge functions under the existing gate.
+
+The reservation is derived from exact immutable pending event bytes, so it survives recovery without mutable release counters. It remains charged while pending even after claim/seal. Other arrivals cannot take it. Exact acknowledgement removes only its verified pending IDs and releases their logical reservation; unverified data is never deleted to make processing room. Terminal full records retain their separate seven-day policy and physical footprint; compact markers persist.
+
+`_processing_capacity` checks a selected batch against the sum of its events' escrow at claim, seal and ack. Membership costs `2*sum(C)+1,024*N`; a manifest bound of `8,192*N+2*sum(C)` covers fixed identity/key/time fields plus ordered IDs/ranges; batch/seal headers are shared. For `N>=1`, the grouped worst-case charge is no greater than the sum of singleton escrows. A valid singleton therefore has a logical path through all phases independently of remaining admission capacity. The selector also conservatively stops before its expanded-data or1MiB manifest bound, rather than choosing a batch that cannot be sealed. Smaller committed batches repeatedly drain the130-event fixture. The configured maximum remains2,000 events/8MiB; the conservative manifest bound may select fewer.
+
+The98,304 ack allowance is a new conservative logical forecast, **not a measurement or reuse of the old physical reservation**. It checks `2*serialized_receipt_bytes + 16,384*N` against that allowance, with the fixed term covering exact coverage/marker row/index forecasts. Each of two accepted receipt strings is at most2,048 characters; JSON escaping can require six bytes per character, and bounded keys/hashes/metadata add further bytes. The initial65,536 allowance failed an ordinary accepted escaped-string fixture: serialized receipts totaled25,130 bytes, giving66,644 after doubling and16,384 coverage allowance. The corrected98,304 allows this representation with margin. Maximum-length UTF-8 and escaped-string fixtures both pass. The old physical `reserve_capacity` calls and forecasts for batch/seal/ack are unchanged and may independently defer work.
+
+### Effective backlog and critical runway
+
+The conservative per-event reservation materially reduces how many pending events fit. Byte ceilings bind long before the nominal50,000 warning/87,500 ordinary/100,000 hard event counts. The12,500 preallocated critical slots are an identity/event-count bound, not a promise of12,500 closure events in16MiB. A closure can emit more than one event, reducing closure count further.
+
+| Actual final fixture | Body / canonical bytes | Processing escrow | Whole ordinary event or critical-slot charge | Calculated logical capacity |
+| --- | --- | --- | --- | --- |
+| Small brand baseline, both majors | 65 /422 | 130,532 | Ordinary135,732 | 865 equal events in112MiB |
+| Large valid UTF-8 baseline, both majors | 8,058 /8,415 | 178,490 | Ordinary231,648 | 506 equal events in112MiB |
+| Actual critical Job closure, both majors | 217 /601 | 131,606 | Critical135,290 | 124 equal events in16MiB |
+| Actual critical listing closure, PG17 | 572 /978 | 133,868 | Critical139,016 | 120 equal events in16MiB |
+| Actual critical listing closure, PG16 | 575 /981 | 133,886 | Critical139,046 | 120 equal events in16MiB |
+
+That fixture closes one Job through two public events. Their combined charge is274,306 bytes on17 and274,336 on16, so an otherwise free16MiB critical allowance fits61 such two-event closures. The slight listing-size difference follows serialized fixture timestamps. Logs also print a same-sized hypothetical critical-slot charge for each ordinary baseline example; brands themselves are not critical transitions. The table above uses actual closure events for the operational runway calculation.
+
+These are calculations from actual small fixture event sizes, not production throughput, savings, physical reuse or headroom promises. They assume an otherwise available logical budget and equal-sized events; real mixes, outstanding ordinary/critical work and source facts change the available runway. Conservative singleton charging intentionally trades throughput/runway for a provable bounded logical processing path. Optimizing that reservation is not part of this correction and must not silently weaken the critical reserve.
+
+The ordinary scaled-boundary fixture lowers only Python's new logical policy limits: an actual public mutation is admitted exactly at its scaled ordinary ceiling; ordinary claim/seal keep committed budget unchanged; another ordinary mutation rolls back; a pure closure fits exactly at the scaled hard ceiling; both events claim/seal/exact-ack without unverified deletion. SQL and physical ceilings are unchanged. Critical operational slot pairing/ack and the real event-byte accounting are also in the affected final selection. No database was loaded to a physical guard or nominal count limit.
+
+## F1-2: the real location pass continues and reports interruption
+
+`stamp_jobs` remains a sorted-lock, at-most100-row transaction helper. `resolve_new_locations` now loops it, committing every chunk and incrementing `stamped` only after a successful commit. It finishes all mismatches in the intended pass. Rule dictionary work also counts only committed100-raw chunks; fake/real LLM persistence retains its existing batch commit accounting. Public dictionary inserts/corrections remain paired; derived cache-only Job updates emit no public fact event.
+
+The returned result retains the existing committed counters and adds `complete` and `storage_deferred`. A later stamping/storage failure rolls back only that chunk, preserves earlier committed totals, and returns incomplete. Other ordinary exceptions also log and return incomplete. Remaining unresolved raw mappings or cache mismatches keep `complete=false`. A later invocation selects the remaining mismatches and resumes. No unsupported deadline or unlimited physical reuse is claimed.
+
+The actual backfill entrypoint now returns this result and logs complete versus incomplete honestly. The daily caller explicitly logs incomplete location results rather than labeling the location phase complete. Existing caller interfaces still receive the original numeric count keys.
+
+New tests call the real resolver with101 jobs for initial resolution and manual correction; both finish the entire pass. A later-chunk injected storage exception preserves100 committed rows, rolls back the101st, reports incomplete/deferred, then a resumed pass commits the remaining row. An active-archive101-row pass produces exactly the dictionary baseline event and no derived-cache events. The ten existing location-resolution tests cover offline rule, fake LLM, unanswered/error, manual correction and multibatch continuity. No real LLM or HTTP call runs.
+
+## F1-3: seed deferral no longer aborts existing-source verification
+
+The daily `job_discovery.run.run` now commits its poll-run row before beginning seed chunks. Each at-most100-target seed chunk still uses exact paired public mutation transactions. `StorageBlocked` (including `ArchiveBlocked`) rolls back only the failed chunk, stops further seed admission for that turn and durably records a seed-storage-deferred note. Earlier committed companies/events remain. The durable run ID is valid even when the first seed chunk fails.
+
+Existing-source verification still executes through the established normal/operational orchestration. Returned counts add `seed_storage_deferred`, `seed_targets_committed` and the seed deferral to `storage_deferred`; the committed target count means successfully processed seed targets, not a claim that every target was newly inserted. Final poll-run notes preserve the deferral. In legacy mode seed deferral stops ordinary payload admission while retaining the existing verification-only loop. No paired admission bypass or false source failure is introduced.
+
+Two actual daily-entrypoint tests inject archive deferral after paired mutation in the first and later seed chunk. They establish rejected company/event rollback, zero versus100 committed target progress, a durable finalized poll-run row/note, and a healthy existing source's actual offline feed verification. New-source catalog expansion is stubbed in these fixtures to isolate the specified seed/existing-corpus boundary; verification itself is real orchestration. An existing flags-off daily failure-isolation/run-accounting test and run-row persistence test pass in the broader candidate selection.
+
+## Actual verification and failure history
+
+Evidence resides in `task-10-evidence/fix2/`: full commands, content inventories, exact collected node lists, source hashes, server/runtime/image pins, output and exit files. Final12-file source hashes were recorded after formatting and before final affected execution. No source changed during either final run.
+
+| Recorded phase | PostgreSQL17.11 | PostgreSQL16.15 |
+| --- | --- | --- |
+| Candidate63-case selection, before receipt-bound correction | 63 passed,102.57s,exit0 | 63 passed,110.64s,exit0 |
+| Final37 affected cases after correction | 37 passed,52.06s,exit0 | 37 passed,58.49s,exit0 |
+
+No skipped DB tests appear. Final Ruff reports all checks passed; source hashes remained unchanged through both final runs and were checked again immediately before source commit. The source commit contains12 owned product/schema/test files. No covered tests were rerun during report handoff.
+
+The broader candidate selection was63 cases on each major. After the receipt-bound correction, only the meaningful37-case affected selection was rerun on each major. It includes all11 final Fix2 cases,10 outbox cases,9 batch cases,2 critical operational cases and5 relevant Fix1 budget/manifest/critical/retirement cases. The unchanged caller/codec cases retain their candidate evidence. Together these support64 unique cases per major at final state; there was no single final64-case command. Overlapping tests are not counted as extra coverage.
+
+Initial RED is preserved: four of the six initial failures directly reproduced logical workspace and location defects; two were local test setup errors because connection info intentionally omits the disposable password. Switching the fixtures to the harness-provided validated TEST_DSN produced the intended two uncaught seed ArchiveBlocked failures. No credential was exposed or guessed. The six-case post-fix development run passed; the expanded19-case development run passed. The later receipt representation RED was1 passed/1 failed before the logical bound increase. These outputs remain intact and are not relabeled as passes.
+
+Both final and candidate harnesses use owned random-loopback PG17/16 databases and cached images. No shared55432, broad whole-suite run, omitted mechanism/security/activation/cross-user/physical/expiry/adversarial test or substituted probe was executed. Existing reviewed source helpers are interfaces, not freshly certified mechanisms. PostgreSQL17.11 supplies major-version parity, not a claim of running historical production17.6;16.15 supplies compatibility. Python3.12.14, psycopg3.3.6, pytest9.1.1 and Ruff0.15.20 are recorded. Migration04/05/06 text appears verbatim in schema.sql; final Ruff and whitespace checks pass.
+
+## Remaining limits and handoff
+
+1. Production defaults remain off, retirement dry-run and archive inactive. No destination row, provider connection, activation, IAM/credential change, production deletion, push/PR/merge/deployment or release action occurred. Actual destination/readiness and compatible rollout remain pending.
+2. Full baseline and operational claim/receipt/listing/critical-slot preallocation must precede reliance on the bounded lane. Missing readiness or exhausted finite slots defers truthfully. Slots never recycle automatically; the logical closure runway is substantially smaller than the slot count because of byte escrow.
+3. This correction guarantees a bounded **logical** processing path for admitted valid events within the service protocol. Physical admission can still prevent claim/seal/ack. Physical MVCC growth/reuse remains unknown; no logical reservation or terminal cleanup supplies physical delete credit. No new physical measurements were needed or run in Fix2.
+4. The additive pre-activation migration changes the admission forecast for all pending events. This task does not certify upgrading an already-active older archive with a near-full backlog, nor rewrite existing external objects. Such a rollout would need separate readiness assessment.
+5. Task11 still owns transport, periodic flush/cleanup scheduling, persisted fake-S3 crash cases and authorized expired replacement; Task12 owns replay. Compact markers still require operational sizing. No downstream completion is claimed here.
+6. Original deliberately omitted Task3 physical-capacity/expiry/cross-user/adversarial assurance remains omitted. No new security approval is claimed. The controller's same-reviewer assessment of F1-1..3 and fix-introduced Important/Critical issues remains pending.
+
+No safeguard rejection occurred. The local missing-password fixture error and ordinary serialization-bound failure are preserved with their exact causes; neither triggered a bypass or production access. Controller documents remain unstaged by the author. Local author implementation/report work is complete and will STOP Git after the handoff pins.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
index 9ddee79..6fb212f 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
@@ -86,10 +86,19 @@ No broad pytest tests/ run, no test_lifecycle_safety.py, test_lifecycle_activati
 
 No safeguard rejection occurred in this author session. No remaining ordinary selected test failure. Author work is local-only and ready for the controller's fresh permitted review.
 
 ## Fix1 completion — source 01408f0fce8743a98a55726cc9da50f808955443
 
 The same author completed the single correction pass for all seven Important findings R10-1..7. The full authoritative correction report is [task-10-fix1-report.md](task-10-fix1-report.md), with original failure history, exact final commands, source hashes, versions and scope in [task-10-evidence/fix1/commands.md](task-10-evidence/fix1/commands.md) and [inventory.md](task-10-evidence/fix1/inventory.md).
 
 That report supersedes this earlier report's independent operational miss counters, canonical-only byte budget, incomplete current-writer readiness, occurrence-only envelope time, old fixed object layout and forever-full receipt/catalogue retention. It documents the shared authoritative listing history, logical accounting of all live representations, actual archive-pressure fallback, paired bounded current writers, explicit observed/DB-recorded provenance, validated service prefix/UTC/hash manifest contract, and bounded acknowledged-only retirement retaining compact exact/fence/version markers.
 
 Final Fix1 source/test commit: `01408f0fce8743a98a55726cc9da50f808955443`. Actual final verification: 66 passed on PostgreSQL17.11 and 66 passed on PostgreSQL16.15, Ruff passed, both migrations/schema text parity verified. All historical failed outputs remain preserved. No source changed after those runs; no covered checks were duplicated during report handoff. Production configuration remains absent, flags off, archive inactive and retirement dry-run. Finite operational slots, physical MVCC uncertainty, unvalidated destination/readiness and omitted Task3 assurance remain explicit in the full Fix1 report. Controller same-reviewer assessment remains pending; no independent approval or release is claimed by this author.
+
+
+## Fix2 completion — source872a9844f59d3ed4db483ff13fe40c0e02bff09b
+
+The same author completed the three remaining findings F1-1,F1-2,F1-3. Full correction report: [task-10-fix2-report.md](task-10-fix2-report.md); exact chronology and inventories: [task-10-evidence/fix2/commands.md](task-10-evidence/fix2/commands.md) and [inventory.md](task-10-evidence/fix2/inventory.md).
+
+Source/test commit `872a9844f59d3ed4db483ff13fe40c0e02bff09b` reserves the complete bounded logical processing lifecycle before event admission (`6*C+128,000` processing bytes per event in addition to base pending representations), preserving ordinary/critical reserve and exact drain room. The actual location resolver now commits all bounded stamping chunks and reports incomplete/deferred work. Daily seed deferral preserves committed companies/events and durable poll accounting, then continues existing-source verification.
+
+Both owned candidate selections passed63 cases on PostgreSQL17.11/16.15. A subsequent valid receipt-serialization bound correction is preserved with its RED and followed by37 affected final passes on each major; this is64 unique supported cases through the incremental final state, not one final64-case run. Ruff and schema/migration parity passed. Byte escrow binds long before nominal event counts: measured two-event closures cost about274KB, implying61 such closures in an otherwise empty16MiB critical allowance. The full report records actual sizes, conservative runway tradeoffs, preserved failures and remaining limits. Physical admission remains unchanged; no physical/security assurance, destination configuration, activation, exporter or release is claimed. Same-reviewer approval remains pending. No source edits or test reruns followed final verification.
diff --git a/job_discovery/archive/batches.py b/job_discovery/archive/batches.py
index 40546e3..4ca6c20 100644
--- a/job_discovery/archive/batches.py
+++ b/job_discovery/archive/batches.py
@@ -6,31 +6,56 @@ import hashlib
 import json
 from uuid import uuid4
 from psycopg.types.json import Jsonb
 from job_discovery.lifecycle.claims import validate_claim
 from job_discovery.lifecycle.capacity import (
     reserve_capacity,
     bind_reservation,
     settle_capacity,
 )
 from .codec import canonical_json, encode_events, MAX_MANIFEST
-from .outbox import ArchiveBlocked, outbox_health, HARD_BYTES
+from .outbox import ArchiveBlocked
 from .types import BatchRef, BatchLimits, SealedBatch, VerifiedBatch, AckResult
 
 
 def _hash(value):
     return hashlib.sha256(value).hexdigest()
 
 
-def _live_capacity(tx, additional):
-    if outbox_health(tx)["bytes"] + additional > HARD_BYTES:
-        raise ArchiveBlocked("archive live forecast exhausted; batch deferred")
+def _processing_capacity(tx, event_bytes, *, manifest_bytes=None, receipt_bytes=None):
+    """Spend only the selected immutable events' admission-time escrow.
+
+    The bound admits singleton batches, so max_events=1 always makes logical
+    progress. Larger batches share the same bounded header/seal/ack allowance.
+    Physical reservations remain separate and may still defer any phase.
+    """
+    count = len(event_bytes)
+    canonical_bytes = sum(len(value) for value in event_bytes)
+    manifest_bound = 8192 * count + 2 * canonical_bytes
+    if manifest_bytes is not None and manifest_bytes > manifest_bound:
+        raise ArchiveBlocked("manifest exceeds reserved processing workspace")
+    if receipt_bytes is not None and 2 * receipt_bytes + 16384 * count > 98304 * count:
+        raise ArchiveBlocked("acknowledgement exceeds reserved processing workspace")
+    reserved = tx.execute(
+        "SELECT sum(lifecycle_private.archive_processing_charge(value)) n FROM unnest(%s::bytea[]) value",
+        (list(event_bytes),),
+    ).fetchone()["n"]
+    required = (
+        2 * canonical_bytes
+        + 1024 * count
+        + 8192
+        + 4096
+        + 2 * (manifest_bytes if manifest_bytes is not None else manifest_bound)
+        + 98304 * count
+    )
+    if required > reserved:
+        raise ArchiveBlocked("batch exceeds reserved processing workspace")
 
 
 def _keys(ref, compressed_hash):
     import re
 
     if (
         not ref.object_prefix
         or not re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", ref.object_prefix)
         or len(ref.object_prefix) > 256
     ):
@@ -130,40 +155,42 @@ def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
         for r in tx.execute(
             "SELECT event_id FROM public_archive_coverage WHERE event_id=ANY(%s)",
             ([r["predecessor_id"] for r in rows if r["predecessor_id"]],),
         ).fetchall()
     }
     total = 0
     for row in rows:
         size = len(row["canonical_event"]) + 1
         if total + size > limits.max_expanded_bytes:
             break
+        # Reserve a manifest bound before selection too. This conservative bound
+        # fits even singleton processing and avoids selecting an unsealable batch.
+        if 8192 * (len(selected) + 1) + 2 * (total + size) > MAX_MANIFEST:
+            break
         # A prior pending predecessor must be included earlier in this same batch.
         if (
             row["revision"] > 1
             and row["predecessor_id"] not in selected_ids
             and row["predecessor_id"] not in covered
         ):
             continue
         selected.append(row)
         selected_ids.add(row["event_id"])
         total += size
     if not selected:
         return None
     destination = tx.execute(
         "SELECT object_prefix FROM public_archive_destination WHERE singleton AND validated_at<=clock_timestamp()"
     ).fetchone()
     if not destination:
         raise ArchiveBlocked("archive destination prefix not validated")
-    _live_capacity(
-        tx, 8192 + sum(2 * len(r["canonical_event"]) + 1024 for r in selected)
-    )
+    _processing_capacity(tx, [bytes(r["canonical_event"]) for r in selected])
     reservation = reserve_capacity(tx, claim, total * 4 + 65536)
     if reservation is None:
         raise ArchiveBlocked("physical batch capacity unavailable")
     bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
     batch_id = uuid4()
     row = tx.execute(
         """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date)
       SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date FROM (SELECT clock_timestamp() t) clock RETURNING *""",
         (
             batch_id,
@@ -328,21 +355,21 @@ def persist_seal(tx, seal: SealedBatch) -> None:
         )
     }
     values.update(
         event_ids_sha256=manifest["event_ids_sha256"],
         aggregate_revision_ranges=manifest["aggregate_revision_ranges"],
     )
     if row["state"] != "claimed":
         if any(row[k] != v for k, v in values.items()):
             raise ArchiveBlocked("immutable seal differs")
         return
-    _live_capacity(tx, 4096 + 2 * seal.manifest_bytes)
+    _processing_capacity(tx, ref.event_bytes, manifest_bytes=seal.manifest_bytes)
     reservation = reserve_capacity(
         tx, seal.batch.claim, 65536 + seal.manifest_bytes * 4
     )
     if reservation is None:
         raise ArchiveBlocked("physical seal capacity unavailable")
     bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
     tx.execute(
         """UPDATE public_archive_batches SET state='sealed',event_ids_sha256=%(event_ids_sha256)s,aggregate_revision_ranges=%(aggregate_revision_ranges)s,data_key=%(data_key)s,manifest_key=%(manifest_key)s,
       canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
       compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
@@ -407,20 +434,33 @@ def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
         raise ArchiveBlocked("batch contains suppressed aggregate")
     items = tx.execute(
         "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
         (current.batch_id,),
     ).fetchall()
     markers = tuple(
         (i["aggregate_type"], i["aggregate_id"], i["revision"]) for i in items
     )
     if row["state"] == "acked":
         return AckResult(current.ordered_event_ids, markers)
+    receipt_bytes = tx.execute(
+        "SELECT octet_length(%s::jsonb::text)+octet_length(%s::jsonb::text) n",
+        (
+            Jsonb(asdict(verified_batch.data_receipt)),
+            Jsonb(asdict(verified_batch.manifest_receipt)),
+        ),
+    ).fetchone()["n"]
+    _processing_capacity(
+        tx,
+        current.event_bytes,
+        manifest_bytes=seal.manifest_bytes,
+        receipt_bytes=receipt_bytes,
+    )
     reservation = reserve_capacity(tx, claim, 65536 + len(items) * 16384)
     if reservation is None:
         raise ArchiveBlocked("physical exact acknowledgement capacity unavailable")
     bind_reservation(tx, reservation, job_id=None, scope="public_archive_coverage")
     tx.execute(
         "INSERT INTO public_archive_receipts(batch_id,data_receipt,manifest_receipt) VALUES(%s,%s,%s)",
         (
             current.batch_id,
             Jsonb(asdict(verified_batch.data_receipt)),
             Jsonb(asdict(verified_batch.manifest_receipt)),
diff --git a/job_discovery/archive/outbox.py b/job_discovery/archive/outbox.py
index f0858e6..2361675 100644
--- a/job_discovery/archive/outbox.py
+++ b/job_discovery/archive/outbox.py
@@ -25,21 +25,21 @@ class ArchiveBlocked(StorageBlocked):
     pass
 
 
 def budget_allows(count: int, size: int, next_size: int, critical: bool) -> bool:
     return count + 1 <= (
         HARD_EVENTS if critical else ORDINARY_EVENTS
     ) and size + next_size <= (HARD_BYTES if critical else ORDINARY_BYTES)
 
 
 def outbox_health(conn) -> dict:
-    row = conn.execute("""SELECT count(*) events,lifecycle_private.archive_live_bytes() bytes,
+    row = conn.execute("""SELECT count(*) events,lifecycle_private.archive_budget_bytes() bytes,lifecycle_private.archive_live_bytes() live_bytes,
       COALESCE(extract(epoch FROM clock_timestamp()-min(recorded_at)),0) age_seconds FROM public_pending_events""").fetchone()
     row["warning"] = (
         row["events"] >= WARNING_EVENTS
         or row["bytes"] >= WARNING_BYTES
         or row["age_seconds"] >= WARNING_AGE
     )
     row["ordinary_paused"] = (
         row["events"] >= ORDINARY_EVENTS or row["bytes"] >= ORDINARY_BYTES
     )
     return row
@@ -92,22 +92,22 @@ def record_public_change(tx, change: PublicChange, claim) -> EventRef:
     if not row:
         raise ValueError("no exact unpaired public mutation in this transaction")
     envelope = _envelope(row)
     encoded = canonical_json(envelope)
     health = outbox_health(tx)
     critical = change.kind in {ChangeKind.CLOSED, ChangeKind.REOPENED}
     if not budget_allows(
         health["events"],
         health["bytes"],
         tx.execute(
-            "SELECT lifecycle_private.archive_row_charge(%s,%s,2048) n",
-            (Jsonb(change.body), encoded),
+            "SELECT lifecycle_private.archive_row_charge(%s,%s,2048)+lifecycle_private.archive_processing_charge(%s) n",
+            (Jsonb(change.body), encoded, encoded),
         ).fetchone()["n"],
         critical,
     ):
         raise ArchiveBlocked("public outbox budget exhausted; mutation must roll back")
     reservation = reserve_capacity(
         tx, claim, max(65536, len(encoded) * 16 + 32768), critical=critical
     )
     if reservation is None:
         raise ArchiveBlocked(
             "physical archive capacity unavailable; mutation must roll back"
diff --git a/job_discovery/lifecycle/operational.py b/job_discovery/lifecycle/operational.py
index 15473ed..ebd1442 100644
--- a/job_discovery/lifecycle/operational.py
+++ b/job_discovery/lifecycle/operational.py
@@ -151,21 +151,29 @@ def _flush(conn):
                 AggregateType(row["aggregate_type"]),
                 row["aggregate_id"],
                 ChangeKind(row["kind"]),
                 row["body"],
                 row["occurred_at"],
             )
         )
         envelope = _envelope(row)
         encoded = canonical_json(envelope)
         health = outbox_health(conn)
-        if not budget_allows(health["events"], health["bytes"], 2 * len(encoded), True):
+        if not budget_allows(
+            health["events"],
+            health["bytes"],
+            2 * len(encoded)
+            + conn.execute(
+                "SELECT lifecycle_private.archive_processing_charge(%s) n", (encoded,)
+            ).fetchone()["n"],
+            True,
+        ):
             raise OperationalDeferred("critical outbox budget exhausted")
         conn.execute(
             """UPDATE public_critical_event_slots SET state='pending',event_id=%s,predecessor_id=%s,
           canonical_event=%s,padding=''::bytea WHERE slot=%s""",
             (envelope["event_id"], envelope["predecessor_id"], encoded, row["slot"]),
         )
 
 
 def sightings(conn, source_id, sequence, claim, observations):
     if len(observations) > 100:
diff --git a/job_discovery/location_backfill.py b/job_discovery/location_backfill.py
index f67900b..375e104 100644
--- a/job_discovery/location_backfill.py
+++ b/job_discovery/location_backfill.py
@@ -4,29 +4,36 @@ stamp jobs.location_canonicals.
 Run against a database:  DATABASE_URL=... OPENROUTER_API_KEY=... python -m job_discovery.location_backfill
 
 This is exactly the nightly resolution step (locations.resolve_new_locations)
 run outside a poll: the scope query already targets "raws with no locations
 row", so a rerun only touches what the previous run missed (e.g. after an LLM
 outage). Safe to rerun; commits per batch, so an interrupt loses nothing.
 
 ROLLOUT ARTIFACT — run once at rollout, BEFORE deploying the dashboard/reviewer
 predicate cutover and BEFORE prefs_backfill (which needs the mapping rows).
 """
+
 import logging
 
 from job_discovery import db
 from job_discovery.locations import resolve_new_locations
 
 
-def main() -> None:
-    logging.basicConfig(level=logging.INFO,
-                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
+def main() -> dict:
+    logging.basicConfig(
+        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
+    )
     conn = db.connect()
     try:
         counts = resolve_new_locations(conn)
-        logging.getLogger("location_backfill").info("backfill complete: %s", counts)
+        logging.getLogger("location_backfill").info(
+            "backfill %s: %s",
+            "complete" if counts["complete"] else "incomplete",
+            counts,
+        )
+        return counts
     finally:
         conn.close()
 
 
 if __name__ == "__main__":
     main()
diff --git a/job_discovery/locations.py b/job_discovery/locations.py
index a5236d1..a3092dc 100644
--- a/job_discovery/locations.py
+++ b/job_discovery/locations.py
@@ -1,27 +1,29 @@
 """Raw-location resolution + nightly re-stamp.
 
 locations is the permanent raw->canonicals cache. Rule pass first (gazetteer),
 then a batched LLM pass for the leftovers (each element validated back through
 the gazetteer), then a set-based re-stamp of jobs.location_canonicals. The
 re-stamp runs every call, so a manual correction to a locations row propagates
 on the next poll. LLM/API failure leaves those raws unmapped (retried next
 run) — resolution must never fail the poll.
 Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
 """
+
 from job_discovery.archive.writers import public_write
 
 import asyncio
 import json
 import logging
 
 from job_discovery.lifecycle.locks import enter_gate, lock_jobs
+from job_discovery.lifecycle.errors import StorageBlocked
 from job_discovery.gazetteer import Resolved, resolve_fields, resolve_location
 
 log = logging.getLogger("job_discovery.locations")
 
 _NEW_RAWS_SQL = """
     SELECT DISTINCT j.location AS raw
     FROM jobs j
     LEFT JOIN locations l ON l.raw = j.location
     WHERE j.location IS NOT NULL AND j.location <> '' AND l.raw IS NULL
 """
@@ -29,54 +31,83 @@ _NEW_RAWS_SQL = """
 # ON CONFLICT DO NOTHING: a concurrent run (or rerun after a partial commit)
 # may have inserted the row already; first write wins, corrections go via
 # source='manual' UPDATEs.
 _INSERT_SQL = """
     INSERT INTO locations (raw, canonicals, components, source)
     VALUES (%s, %s, %s::jsonb, %s)
     ON CONFLICT (raw) DO NOTHING
 """
 
 
-
 def _component(r: Resolved) -> dict:
-    return {"canonical": r.canonical, "kind": r.kind, "geonameid": r.geonameid,
-            "country_code": r.country_code, "admin1_code": r.admin1_code}
+    return {
+        "canonical": r.canonical,
+        "kind": r.kind,
+        "geonameid": r.geonameid,
+        "country_code": r.country_code,
+        "admin1_code": r.admin1_code,
+    }
 
 
 def _insert(conn, raw: str, resolved: list[Resolved], source: str) -> None:
-    with public_write(conn, 'locations'), conn.cursor() as cur:
-        cur.execute(_INSERT_SQL, (raw, [r.canonical for r in resolved],
-                                  json.dumps([_component(r) for r in resolved]), source))
+    with public_write(conn, "locations"), conn.cursor() as cur:
+        cur.execute(
+            _INSERT_SQL,
+            (
+                raw,
+                [r.canonical for r in resolved],
+                json.dumps([_component(r) for r in resolved]),
+                source,
+            ),
+        )
 
 
 def _insert_unmappable(conn, raw: str) -> None:
-    components = [{"canonical": raw, "kind": "unmappable", "geonameid": None,
-                   "country_code": None, "admin1_code": None}]
-    with public_write(conn, 'locations'), conn.cursor() as cur:
+    components = [
+        {
+            "canonical": raw,
+            "kind": "unmappable",
+            "geonameid": None,
+            "country_code": None,
+            "admin1_code": None,
+        }
+    ]
+    with public_write(conn, "locations"), conn.cursor() as cur:
         cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))
 
 
-def correct_location(conn,raw: str,resolved: list[Resolved]) -> None:
+def correct_location(conn, raw: str, resolved: list[Resolved]) -> None:
     """Service manual correction; caller commits the paired public change."""
-    with public_write(conn,'locations'):
-        conn.execute("UPDATE locations SET canonicals=%s,components=%s::jsonb,source='manual' WHERE raw=%s",
-          ([r.canonical for r in resolved],json.dumps([_component(r) for r in resolved]),raw))
+    with public_write(conn, "locations"):
+        conn.execute(
+            "UPDATE locations SET canonicals=%s,components=%s::jsonb,source='manual' WHERE raw=%s",
+            (
+                [r.canonical for r in resolved],
+                json.dumps([_component(r) for r in resolved]),
+                raw,
+            ),
+        )
 
 
 def stamp_jobs(conn) -> int:
     """Restamp at most 100 derived cache rows in the caller's transaction."""
     enter_gate(conn)
-    rows=conn.execute("SELECT j.id,l.canonicals FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals ORDER BY j.id LIMIT 100").fetchall()
-    lock_jobs(conn,[r['id'] for r in rows])
+    rows = conn.execute(
+        "SELECT j.id,l.canonicals FROM jobs j JOIN locations l ON j.location=l.raw WHERE j.location_canonicals IS DISTINCT FROM l.canonicals ORDER BY j.id LIMIT 100"
+    ).fetchall()
+    lock_jobs(conn, [r["id"] for r in rows])
     for row in rows:
-        with public_write(conn,'jobs',job_id=row['id']):
-            conn.execute('UPDATE jobs SET location_canonicals=%s WHERE id=%s',(row['canonicals'],row['id']))
+        with public_write(conn, "jobs", job_id=row["id"]):
+            conn.execute(
+                "UPDATE jobs SET location_canonicals=%s WHERE id=%s",
+                (row["canonicals"], row["id"]),
+            )
     return len(rows)
 
 
 def _validated(places) -> list[Resolved]:
     out: list[Resolved] = []
     for p in places:
         r = resolve_fields(p.city, p.state, p.country, p.remote)
         if r is not None and r not in out:
             out.append(r)
     return out
@@ -86,70 +117,117 @@ async def _llm_pass(conn, client, leftovers: list[str], counts: dict) -> None:
     """Batch the leftovers through the LLM under ONE event loop.
 
     A single asyncio.run wraps this coroutine so the client's httpx pool stays
     bound to one loop across every batch (per-batch asyncio.run would close the
     loop and break the pool on the next call). Batch-local counters fold into
     `counts` only AFTER that batch's commit, so a mid-batch throw can't inflate
     the returned counts past what was actually committed. Blocking the loop on
     the sync conn.commit() between batches is fine in this cron context.
     """
     from job_discovery.location_llm import BATCH_SIZE
+
     for start in range(0, len(leftovers), BATCH_SIZE):
-        batch = leftovers[start:start + BATCH_SIZE]
+        batch = leftovers[start : start + BATCH_SIZE]
         answers = await client.parse_batch(batch)
         batch_counts = {"llm": 0, "unmappable": 0}
         for i, raw in enumerate(batch):
             if i not in answers:
                 continue  # unanswered -> retry on a later run
             resolved = _validated(answers[i])
             if resolved:
                 _insert(conn, raw, resolved, "llm")
                 batch_counts["llm"] += 1
             else:
                 _insert_unmappable(conn, raw)
                 batch_counts["unmappable"] += 1
         conn.commit()
         counts["llm"] += batch_counts["llm"]
         counts["unmappable"] += batch_counts["unmappable"]
 
 
 def resolve_new_locations(conn, parse_client=None) -> dict:
     """Resolve every raw jobs.location that has no locations row, then re-stamp.
 
-    Returns counts {'rule','llm','unmappable','stamped'}. Commits after the
-    rule pass and after each LLM batch (durable and resumable, like
+    Returns committed counts plus complete/storage_deferred status. Commits after
+    each <=100-row rule/stamp chunk and each LLM batch (durable and resumable, like
     name_backfill). An LLM element that fails gazetteer validation is dropped;
     a raw whose answered elements ALL fail (or that the model answers []) is
     stored unmappable; a raw the model doesn't answer, or any LLM/API error,
     leaves the raw absent so a later run retries it.
     """
     with conn.cursor() as cur:
         cur.execute(_NEW_RAWS_SQL)
         raws = [r["raw"] for r in cur.fetchall()]
-    counts = {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}
+    counts = {
+        "rule": 0,
+        "llm": 0,
+        "unmappable": 0,
+        "stamped": 0,
+        "complete": False,
+        "storage_deferred": False,
+    }
     leftovers: list[str] = []
-    for index, raw in enumerate(raws):
-        if index and index % 100 == 0:
+    try:
+        for start in range(0, len(raws), 100):
+            rule_count = 0
+            for raw in raws[start : start + 100]:
+                resolved = resolve_location(raw)
+                if resolved:
+                    _insert(conn, raw, resolved, "rule")
+                    rule_count += 1
+                else:
+                    leftovers.append(raw)
             conn.commit()
-        resolved = resolve_location(raw)
-        if resolved:
-            _insert(conn, raw, resolved, "rule")
-            counts["rule"] += 1
-        else:
-            leftovers.append(raw)
-    conn.commit()
-
-    if leftovers:
+            counts["rule"] += rule_count
+        conn.commit()  # Empty rule passes must also release their read transaction.
+    except StorageBlocked:
+        conn.rollback()
+        counts["storage_deferred"] = True
+        log.warning(
+            "location rule persistence storage deferred; committed progress retained"
+        )
+    except Exception:
+        conn.rollback()
+        log.exception("location rule persistence failed; committed progress retained")
+        return counts
+
+    if leftovers and not counts["storage_deferred"]:
         try:
             from job_discovery.location_llm import LocationParseClient
+
             client = parse_client or LocationParseClient()
             asyncio.run(_llm_pass(conn, client, leftovers, counts))
+        except StorageBlocked:
+            conn.rollback()
+            counts["storage_deferred"] = True
+            log.warning(
+                "location LLM persistence storage deferred; committed progress retained"
+            )
         except Exception:
             conn.rollback()
-            log.exception("location LLM pass failed; %s unresolved raws retry next run",
-                          len(leftovers) - counts["llm"] - counts["unmappable"])
+            log.exception("location LLM pass failed; unresolved raws retry next run")
 
-    counts["stamped"] = stamp_jobs(conn)
+    try:
+        while True:
+            stamped = stamp_jobs(conn)
+            conn.commit()
+            counts["stamped"] += stamped
+            if stamped < 100:
+                break
+    except StorageBlocked:
+        conn.rollback()
+        counts["storage_deferred"] = True
+        log.warning("location stamping storage deferred; committed chunks retained")
+        return counts
+    except Exception:
+        conn.rollback()
+        log.exception("location stamping failed; committed chunks retained")
+        return counts
+    remaining = conn.execute("""SELECT EXISTS(SELECT FROM jobs j LEFT JOIN locations l ON l.raw=j.location
+        WHERE j.location IS NOT NULL AND j.location<>'' AND
+        (l.raw IS NULL OR j.location_canonicals IS DISTINCT FROM l.canonicals)) pending""").fetchone()[
+        "pending"
+    ]
     conn.commit()
-    log.info("locations: rule=%(rule)s llm=%(llm)s unmappable=%(unmappable)s "
-             "stamped=%(stamped)s", counts)
+    counts["complete"] = not remaining and not counts["storage_deferred"]
+    log.info("locations: %s", counts)
     return counts
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 8ee08a2..4bf0732 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -1,76 +1,109 @@
-from job_discovery.lifecycle.config import read_control, legacy_description_capture_allowed
+from job_discovery.lifecycle.config import (
+    read_control,
+    legacy_description_capture_allowed,
+)
 from job_discovery.lifecycle.maintenance import pre_admission_maintenance
 from job_discovery.lifecycle.locks import enter_gate
 from job_discovery.lifecycle.capacity import CEILING_BYTES
+from job_discovery.lifecycle.errors import StorageBlocked
 from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
 import logging
 
 from job_discovery import db
 from job_discovery.adapters import ADAPTERS
 from job_discovery.adapters.greenhouse import parse_greenhouse_questions
 from job_discovery.http import get_json as _get_json
 from job_discovery.targets import load_targets
 
 log = logging.getLogger("job_discovery")
 
 
-def backfill_greenhouse_questions(conn, company_id, token, *, get_json=None, log=log) -> int:
+def backfill_greenhouse_questions(
+    conn, company_id, token, *, get_json=None, log=log
+) -> int:
     """Fetch + persist the question schema for this Greenhouse company's open jobs that
     lack a job_questions row (rolling backfill). One HTTP call per missing job, each
     wrapped so a single failure never aborts the company. Returns the count persisted."""
-    with spool_questions(conn, company_id, token, get_json or _get_json,
-                         parse_greenhouse_questions, db.greenhouse_jobs_missing_questions,
-                         log=log) as questions:
+    with spool_questions(
+        conn,
+        company_id,
+        token,
+        get_json or _get_json,
+        parse_greenhouse_questions,
+        db.greenhouse_jobs_missing_questions,
+        log=log,
+    ) as questions:
         fetched = 0
         for external_id, data in questions:
-            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
+            db.insert_job_questions(
+                conn, f"greenhouse:{token}:{external_id}", data, overwrite=False
+            )
             fetched += 1
             if fetched % UPSERT_CHUNK_SIZE == 0:
                 conn.commit()
         conn.commit()
         return fetched
 
+
 # Upsert postings in fixed-size chunks. The workday adapter yields lazily to keep
 # peak memory bounded (A10); buffering a whole tenant into one list before a single
 # upsert would defeat that, so we flush every UPSERT_CHUNK_SIZE postings. At most
 # one chunk (plus its detail payloads) is resident at a time.
 UPSERT_CHUNK_SIZE = 500
 
 
 def _run_prune(conn) -> None:
     try:
         from job_discovery.prune import prune_jobs
+
         prune_jobs(conn)
     except Exception:
         conn.rollback()
         log.exception("prune phase failed; poll results unaffected")
 
 
 def _admit_chunk(conn, company_id, ats, token, chunk):
     """Measure again under the gate before each bounded admission transaction."""
     try:
         enter_gate(conn)
         over, _, _ = db.over_size_ceiling(conn)
-        held = conn.execute("SELECT COALESCE(sum(bytes),0) AS bytes FROM capacity_reservations WHERE state='held'").fetchone()['bytes']
+        held = conn.execute(
+            "SELECT COALESCE(sum(bytes),0) AS bytes FROM capacity_reservations WHERE state='held'"
+        ).fetchone()["bytes"]
         # Conservative local forecast includes payload expansion/index/WAL room.
         # Enforced compatible writers still require their Task 3 reservations.
         capture_description = legacy_description_capture_allowed(conn)
-        forecast = sum(16384 + 4 * sum(len(str(value).encode('utf-8')) for value in db._posting_row(ats, token, company_id, p, capture_description=capture_description) if value is not None) for p in chunk)
-        allocated = conn.execute('SELECT pg_database_size(current_database()) AS bytes').fetchone()['bytes']
+        forecast = sum(
+            16384
+            + 4
+            * sum(
+                len(str(value).encode("utf-8"))
+                for value in db._posting_row(
+                    ats, token, company_id, p, capture_description=capture_description
+                )
+                if value is not None
+            )
+            for p in chunk
+        )
+        allocated = conn.execute(
+            "SELECT pg_database_size(current_database()) AS bytes"
+        ).fetchone()["bytes"]
         if over or allocated + held + forecast >= CEILING_BYTES:
-            log.warning('admission paused at chunk boundary; source verification continues')
+            log.warning(
+                "admission paused at chunk boundary; source verification continues"
+            )
             conn.commit()
             return 0, True
     except Exception:
         conn.rollback()
-        log.exception('admission capacity measurement failed; verification only')
+        log.exception("admission capacity measurement failed; verification only")
         return 0, True
     admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
     conn.commit()
     return admitted, False
 
 
 def run(dsn: str | None = None) -> dict:
     """Execute one poll cycle.
 
     Returns a counts dict with keys ``ok``, ``failed``, ``new_jobs``,
@@ -92,100 +125,154 @@ def run(dsn: str | None = None) -> dict:
 
         try:
             over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
         except Exception:
             conn.rollback()
             log.exception("capacity check failed; verification only")
             over, size_mb, ceiling_mb = True, 0, 6000
         over = over or maintenance.blocked
         guard_note = None
         if over:
-            guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
-                          else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
-            log.warning("%s; checking closures without ingestion or enrichment", guard_note)
+            guard_note = (
+                "maintenance only: safety maintenance blocked admission"
+                if maintenance.blocked
+                else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB"
+            )
+            log.warning(
+                "%s; checking closures without ingestion or enrichment", guard_note
+            )
 
         run_id = db.start_run(conn)
+        conn.commit()  # Accounting survives rollback of the first seed chunk.
+        seed_deferred = False
+        seed_committed = 0
         if not over:
-            for start in range(0,len(targets),100):
-                db.sync_seed(conn, targets[start:start+100])
-                conn.commit()
-        conn.commit()
-        from job_discovery.lifecycle.reconcile import verify_due_sources, StorageBlocked
+            for start in range(0, len(targets), 100):
+                try:
+                    chunk = targets[start : start + 100]
+                    db.sync_seed(conn, chunk)
+                    conn.commit()
+                    seed_committed += len(chunk)
+                except StorageBlocked:
+                    conn.rollback()
+                    seed_deferred = True
+                    guard_note = f"seed storage deferred; {seed_committed} seed targets committed; existing-source verification continues"
+                    conn.execute(
+                        "UPDATE poll_runs SET notes=%s WHERE id=%s",
+                        (guard_note, run_id),
+                    )
+                    conn.commit()
+                    log.warning(guard_note)
+                    break
+        from job_discovery.lifecycle.reconcile import verify_due_sources
+
         source_enabled = read_control(conn).source_enabled
         conn.commit()
         if source_enabled:
             try:
                 db.sync_source_accounts(conn)
                 conn.commit()
             except StorageBlocked:
                 conn.rollback()
-                log.warning('source catalog storage blocked; verifying registered corpus')
+                log.warning(
+                    "source catalog storage blocked; verifying registered corpus"
+                )
             counts = verify_due_sources(conn)
-            db.finish_run(conn,run_id,companies_ok=counts['ok'],companies_failed=counts['failed'],
-                          new_jobs=counts['new_jobs'],closed_jobs=counts['closed_jobs'],
-                          notes='full-corpus source verification and lean metadata admission')
+            counts["seed_storage_deferred"] = seed_deferred
+            counts["seed_targets_committed"] = seed_committed
+            counts["storage_deferred"] = counts.get("storage_deferred", 0) + int(
+                seed_deferred
+            )
+            db.finish_run(
+                conn,
+                run_id,
+                companies_ok=counts["ok"],
+                companies_failed=counts["failed"],
+                new_jobs=counts["new_jobs"],
+                closed_jobs=counts["closed_jobs"],
+                notes="; ".join(
+                    ([guard_note] if guard_note else [])
+                    + ["full-corpus source verification and lean metadata admission"]
+                ),
+            )
             conn.commit()
             return counts
+        # In legacy mode a seed deferral also stops ordinary payload admission;
+        # existing source close/reopen verification remains in the legacy loop.
+        over = over or seed_deferred
         companies = db.active_companies(conn)
         conn.commit()  # No read transaction spans adapter HTTP.
 
         ok = failed = new_jobs = closed_jobs = 0
         aborted = False
         failures: list[str] = []
 
         for co in companies:
             ats, token, company_id = co["ats"], co["token"], co["id"]
             try:
                 company_closed = 0
-                capture_description = not over and legacy_description_capture_allowed(conn)
+                capture_description = not over and legacy_description_capture_allowed(
+                    conn
+                )
                 conn.commit()  # No gate/read transaction spans legacy detail HTTP.
-                postings = (ADAPTERS[ats](token, fetch_details=capture_description)
-                            if ats in {"workday", "smartrecruiters"}
-                            else ADAPTERS[ats](token))
+                postings = (
+                    ADAPTERS[ats](token, fetch_details=capture_description)
+                    if ats in {"workday", "smartrecruiters"}
+                    else ADAPTERS[ats](token)
+                )
                 admissible_ids = set()
-                with spool_feed(postings, admissible_ids=admissible_ids) as (buffered, seen):
+                with spool_feed(postings, admissible_ids=admissible_ids) as (
+                    buffered,
+                    seen,
+                ):
                     chunk: list = []
                     for p in buffered:
                         if over or not p.metadata_complete or not p.url or not p.title:
                             continue
                         chunk.append(p)
                         if len(chunk) >= UPSERT_CHUNK_SIZE:
-                            admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
+                            admitted, over = _admit_chunk(
+                                conn, company_id, ats, token, chunk
+                            )
                             new_jobs += admitted
                             chunk = []
                     if chunk:
-                        admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
+                        admitted, over = _admit_chunk(
+                            conn, company_id, ats, token, chunk
+                        )
                         new_jobs += admitted
                     conn.commit()
                 if over:
                     db.reopen_jobs(conn, company_id, seen)
                 open_ids = db.get_open_external_ids(conn, company_id)
                 if not seen and len(open_ids) > 20:
                     log.error(
                         "%s returned zero postings but has %d open jobs; skipping close-detection",
-                        co["name"], len(open_ids),
+                        co["name"],
+                        len(open_ids),
                     )
                 else:
                     company_closed += db.close_jobs(
                         conn, company_id, db.compute_newly_closed(open_ids, seen)
                     )
                 # Healthy poll: clear any accrued failure streak in the same tx.
                 db.record_poll_result(conn, company_id, ok=True)
                 conn.commit()
                 closed_jobs += company_closed
                 ok += 1
             except Exception as exc:  # per-company isolation (incl. dead boards)
                 try:
                     conn.rollback()
                 except Exception:
-                    log.exception("rollback failed for %s; attempting reconnect",
-                                  co["name"])
+                    log.exception(
+                        "rollback failed for %s; attempting reconnect", co["name"]
+                    )
                     # The old connection is unusable. Close it first — that releases
                     # its session advisory lock and frees the socket — so we don't
                     # leak the connection (and its lock) when we open a fresh one.
                     try:
                         conn.close()
                     except Exception:
                         log.exception("closing the broken connection failed")
                     try:
                         maintenance = pre_admission_maintenance(dsn)
                         conn = db.connect(dsn)
@@ -212,72 +299,120 @@ def run(dsn: str | None = None) -> dict:
                 # Track the failure so a persistently dead board is eventually
                 # deactivated. The company's poll work was rolled back, so this
                 # write needs its own commit; isolate it so a hiccup here never
                 # aborts the whole run.
                 try:
                     deactivated = db.record_poll_result(conn, company_id, ok=False)
                     conn.commit()
                     if deactivated:
                         log.warning(
                             "deactivating dead board %s (%s:%s) after %d consecutive failures",
-                            co["name"], ats, token, db.POLL_FAILURE_DEACTIVATE)
+                            co["name"],
+                            ats,
+                            token,
+                            db.POLL_FAILURE_DEACTIVATE,
+                        )
                 except Exception:
                     try:
                         conn.rollback()
                     except Exception:
-                        log.exception("rollback after failure-record error failed for %s",
-                                      co["name"])
+                        log.exception(
+                            "rollback after failure-record error failed for %s",
+                            co["name"],
+                        )
                     log.exception("recording poll failure for %s failed", co["name"])
 
         if aborted:
             # Reconnect/lock acquisition failed: accounting is best effort, and
             # this invocation must never enter any optional post-poll phase.
             try:
                 db.finish_run(
-                    conn, run_id, companies_ok=ok, companies_failed=failed,
-                    new_jobs=new_jobs, closed_jobs=closed_jobs,
-                    notes="; ".join(["poll aborted after reconnect failure", *failures]),
+                    conn,
+                    run_id,
+                    companies_ok=ok,
+                    companies_failed=failed,
+                    new_jobs=new_jobs,
+                    closed_jobs=closed_jobs,
+                    notes="; ".join(
+                        ["poll aborted after reconnect failure", *failures]
+                    ),
                 )
                 conn.commit()
             except Exception:
                 log.exception("could not finalize aborted poll accounting")
-            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
+            return {
+                "ok": ok,
+                "failed": failed,
+                "new_jobs": new_jobs,
+                "closed_jobs": closed_jobs,
+                "seed_storage_deferred": seed_deferred,
+                "seed_targets_committed": seed_committed,
+                "storage_deferred": int(seed_deferred),
+            }
 
         db.finish_run(
-            conn, run_id,
-            companies_ok=ok, companies_failed=failed,
-            new_jobs=new_jobs, closed_jobs=closed_jobs,
+            conn,
+            run_id,
+            companies_ok=ok,
+            companies_failed=failed,
+            new_jobs=new_jobs,
+            closed_jobs=closed_jobs,
             notes="; ".join(([guard_note] if guard_note else []) + failures) or None,
         )
         conn.commit()
-        log.info("run complete: ok=%s failed=%s new=%s closed=%s",
-                 ok, failed, new_jobs, closed_jobs)
+        log.info(
+            "run complete: ok=%s failed=%s new=%s closed=%s",
+            ok,
+            failed,
+            new_jobs,
+            closed_jobs,
+        )
 
         if over:
             _run_prune(conn)
-            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
+            return {
+                "ok": ok,
+                "failed": failed,
+                "new_jobs": new_jobs,
+                "closed_jobs": closed_jobs,
+                "seed_storage_deferred": seed_deferred,
+                "seed_targets_committed": seed_committed,
+                "storage_deferred": int(seed_deferred),
+            }
 
         # Location canonicalization: resolve any raw location strings first
         # seen this poll, then re-stamp jobs.location_canonicals (also
         # propagates manual corrections). Runs before the review phase so
         # tonight's reviews filter on fresh canonicals. Failure is isolated —
         # unresolved raws just retry tomorrow.
         try:
             from job_discovery.locations import resolve_new_locations
-            resolve_new_locations(conn)
+
+            location_counts = resolve_new_locations(conn)
             conn.commit()
+            if location_counts and not location_counts.get("complete", True):
+                log.warning("location resolution incomplete: %s", location_counts)
         except Exception:
             conn.rollback()
             log.exception("location resolution failed; poll results unaffected")
 
         try:
             from reviewer.run import review_all
+
             review_all(conn)
         except Exception:
             conn.rollback()
             log.exception("review phase failed; poll results unaffected")
 
         _run_prune(conn)
     finally:
         conn.close()
 
-    return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
+    return {
+        "ok": ok,
+        "failed": failed,
+        "new_jobs": new_jobs,
+        "closed_jobs": closed_jobs,
+        "seed_storage_deferred": seed_deferred,
+        "seed_targets_committed": seed_committed,
+        "storage_deferred": int(seed_deferred),
+    }
diff --git a/migrations/2026-10-03-06-public-outbox-fix2.sql b/migrations/2026-10-03-06-public-outbox-fix2.sql
new file mode 100644
index 0000000..2a95a1d
--- /dev/null
+++ b/migrations/2026-10-03-06-public-outbox-fix2.sql
@@ -0,0 +1,86 @@
+-- Task10 Fix2: logical processing escrow, no physical/role/claim enforcement change.
+-- C is the immutable canonical event size. Each event can drain as a singleton:
+-- membership 2C+1024; batch 8192; seal 4096+2*(8192+2C);
+-- exact ack receipts/coverage/marker workspace 98304. Total 6C+128000.
+CREATE OR REPLACE FUNCTION lifecycle_private.archive_processing_charge(canonical bytea) RETURNS bigint
+LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
+ SELECT 6::bigint*COALESCE(octet_length(canonical),0)+128000
+$$;
+-- Total committed lifecycle forecast: base pending representations plus escrow.
+-- Membership/seal copies consume escrow, never fresh ordinary/critical allowance.
+CREATE OR REPLACE FUNCTION lifecycle_private.archive_budget_bytes() RETURNS bigint
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT
+ COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
+ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
+   +lifecycle_private.archive_processing_charge(canonical_event)) FROM public.public_outbox),0)
+ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
+   +CASE WHEN state='pending' THEN lifecycle_private.archive_processing_charge(canonical_event) ELSE 0 END)
+   FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.archive_processing_charge(bytea),lifecycle_private.archive_budget_bytes() FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+BEGIN
+ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at,r.observed_at,r.recorded_at,r.provenance)
+ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at,NEW.observed_at,NEW.recorded_at,NEW.provenance) THEN
+  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+ OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+ SELECT count(*),lifecycle_private.archive_budget_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
+ critical:=NEW.kind IN ('closed','reopened');
+ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+ OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+ RETURN NEW;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+ IF OLD.state='free' AND NEW.state='allocated' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batch_markers b USING(batch_id) WHERE c.event_id=OLD.event_id
+    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+ IF NEW.state='pending' THEN
+  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+    OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+  SELECT count(*),lifecycle_private.archive_budget_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
+  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+ END IF;
+ RETURN NEW;
+END $$;
diff --git a/schema.sql b/schema.sql
index 9a8e77a..94aa493 100644
--- a/schema.sql
+++ b/schema.sql
@@ -3100,10 +3100,97 @@ DO $$ DECLARE t text; BEGIN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
   EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
  END LOOP;
 END $$;
 DROP TRIGGER IF EXISTS archive_immutable ON public_archive_batch_markers;
 CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_batch_markers FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
 DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_batch_markers;
 CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_batch_markers FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
+
+-- Task10 Fix2: logical processing escrow, no physical/role/claim enforcement change.
+-- C is the immutable canonical event size. Each event can drain as a singleton:
+-- membership 2C+1024; batch 8192; seal 4096+2*(8192+2C);
+-- exact ack receipts/coverage/marker workspace 98304. Total 6C+128000.
+CREATE OR REPLACE FUNCTION lifecycle_private.archive_processing_charge(canonical bytea) RETURNS bigint
+LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
+ SELECT 6::bigint*COALESCE(octet_length(canonical),0)+128000
+$$;
+-- Total committed lifecycle forecast: base pending representations plus escrow.
+-- Membership/seal copies consume escrow, never fresh ordinary/critical allowance.
+CREATE OR REPLACE FUNCTION lifecycle_private.archive_budget_bytes() RETURNS bigint
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT
+ COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,NULL,2048)) FROM public.public_change_requirements),0)
+ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
+   +lifecycle_private.archive_processing_charge(canonical_event)) FROM public.public_outbox),0)
+ +COALESCE((SELECT sum(lifecycle_private.archive_row_charge(body,canonical_event,2048)
+   +CASE WHEN state='pending' THEN lifecycle_private.archive_processing_charge(canonical_event) ELSE 0 END)
+   FROM public.public_critical_event_slots WHERE state IN ('allocated','pending')),0)
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.archive_processing_charge(bytea),lifecycle_private.archive_budget_bytes() FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+BEGIN
+ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at,r.observed_at,r.recorded_at,r.provenance)
+ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at,NEW.observed_at,NEW.recorded_at,NEW.provenance) THEN
+  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+ OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+ SELECT count(*),lifecycle_private.archive_budget_bytes() INTO usage_count,usage_bytes FROM public.public_pending_events;
+ critical:=NEW.kind IN ('closed','reopened');
+ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+ OR usage_bytes+lifecycle_private.archive_row_charge(NEW.body,NEW.canonical_event,2048)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+ RETURN NEW;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+ IF OLD.state='free' AND NEW.state='allocated' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batch_markers b USING(batch_id) WHERE c.event_id=OLD.event_id
+    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+ IF NEW.state='pending' THEN
+  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+    OR (envelope->>'observed_at')::timestamptz IS DISTINCT FROM NEW.observed_at OR (envelope->>'recorded_at')::timestamptz IS DISTINCT FROM NEW.recorded_at OR envelope->>'provenance' IS DISTINCT FROM NEW.provenance OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+  SELECT count(*),lifecycle_private.archive_budget_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
+  IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+ END IF;
+ RETURN NEW;
+END $$;
diff --git a/tests/test_archive_fix1.py b/tests/test_archive_fix1.py
index 4e0ac24..0213436 100644
--- a/tests/test_archive_fix1.py
+++ b/tests/test_archive_fix1.py
@@ -37,30 +37,30 @@ def test_fix1_operational_miss_normal_positive_operational_miss(conn):
     conn.commit()
     missed(conn, source, claim)
     row = conn.execute("SELECT * FROM source_listings").fetchone()
     assert row["consecutive_complete_misses"] == 1
     assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
 
 
 @requires_db
 def test_fix1_membership_and_seal_add_to_live_forecast(conn):
     claim, _ = seeded_events(conn, 2)
-    before = outbox.outbox_health(conn)["bytes"]
+    before = outbox.outbox_health(conn)["live_bytes"]
     ref = batches.claim_batch(conn, BatchLimits(), claim)
     conn.commit()
-    after = outbox.outbox_health(conn)["bytes"]
+    after = outbox.outbox_health(conn)["live_bytes"]
     conn.commit()
     assert after > before
     seal = batches.seal_batch(ref)
     batches.persist_seal(conn, seal)
     conn.commit()
-    assert outbox.outbox_health(conn)["bytes"] > after
+    assert outbox.outbox_health(conn)["live_bytes"] > after
 
 
 def test_fix1_archive_pressure_is_storage_deferred():
     assert issubclass(outbox.ArchiveBlocked, reconcile.StorageBlocked)
 
 
 @requires_db
 def test_fix1_actual_seed_and_company_writer_pair(conn):
     from job_discovery.db import sync_seed
     from company_discovery.enrich_apply import apply_enrichment, EnrichUpdate
@@ -380,40 +380,36 @@ def test_fix1_all_manifest_identity_fields_validated(conn):
 
 
 @requires_db
 def test_fix1_logical_small_row_forecasts_and_warning_predicate(conn, monkeypatch):
     claim, _ = seeded_events(conn, 1)
     row = conn.execute("SELECT * FROM public_outbox").fetchone()
     body_size = conn.execute(
         "SELECT octet_length(body::text) n FROM public_outbox"
     ).fetchone()["n"]
     expected = 4 * body_size + 2 * len(row["canonical_event"]) + 4096
-    assert outbox.outbox_health(conn)["bytes"] == expected
+    assert outbox.outbox_health(conn)["live_bytes"] == expected
+    assert outbox.outbox_health(conn)["bytes"] > expected
     charge = conn.execute(
         "SELECT lifecycle_private.archive_row_charge(body,canonical_event,2048) n FROM public_outbox"
     ).fetchone()["n"]
     for critical, ceiling in [
         (False, outbox.ORDINARY_BYTES),
         (True, outbox.HARD_BYTES),
     ]:
         assert outbox.budget_allows(1, ceiling - charge, charge, critical)
         assert not outbox.budget_allows(1, ceiling - charge + 1, charge, critical)
     monkeypatch.setattr(outbox, "WARNING_BYTES", expected)
     assert outbox.outbox_health(conn)["warning"]
-    # Test the new logical admission arithmetic using small rows, no physical pressure.
-    monkeypatch.setattr(batches, "HARD_BYTES", expected + 8192)
-    with pytest.raises(outbox.ArchiveBlocked, match="live forecast"):
-        batches.claim_batch(conn, BatchLimits(), claim)
-    conn.rollback()
-    assert (
-        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
-    )
+    # The admitted event's escrow now guarantees logical processing room.
+    batch = batches.claim_batch(conn, BatchLimits(), claim)
+    assert batch is not None
 
 
 @requires_db
 def test_fix1_retirement_preserves_version_coverage_and_pending_batch(conn):
     from tests.test_lifecycle_reconcile import setup_source
     from job_discovery.lifecycle.claims import claim_work
     from uuid import uuid4
 
     setup_source(conn)
     listing = conn.execute("SELECT * FROM source_listings").fetchone()
@@ -483,20 +479,25 @@ def test_fix1_critical_observation_and_recording_survive_seal(conn):
         baseline_batch(conn, kind, claim)
     conn.commit()
     seq, _ = op.start(conn, source["id"], claim)
     conn.commit()
     op.sightings(conn, source["id"], seq, claim, [("0", "removed")])
     conn.commit()
     slots = conn.execute(
         "SELECT * FROM public_critical_event_slots WHERE state='pending'"
     ).fetchall()
     assert len(slots) == 2
+    samples = conn.execute("""SELECT aggregate_type,octet_length(body::text) body_bytes,
+      octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow,
+      lifecycle_private.archive_row_charge(body,canonical_event,2048)+lifecycle_private.archive_processing_charge(canonical_event) lifecycle_bytes
+      FROM public_critical_event_slots WHERE state='pending' ORDER BY aggregate_type""").fetchall()
+    print("actual critical closure costs", json.dumps(samples))
     for slot in slots:
         event = json.loads(bytes(slot["canonical_event"]))
         assert event["observed_at"] and event["provenance"] == "source_observation"
         assert event["recorded_at"] != event["observed_at"]
     ref = batches.claim_batch(conn, BatchLimits(), claim)
     conn.commit()
     seal = batches.seal_batch(ref)
     batches.persist_seal(conn, seal)
     conn.commit()
     assert batches.seal_batch(batches.recover_batch(conn, ref.batch_id, claim)) == seal
diff --git a/tests/test_archive_fix2.py b/tests/test_archive_fix2.py
new file mode 100644
index 0000000..301b270
--- /dev/null
+++ b/tests/test_archive_fix2.py
@@ -0,0 +1,378 @@
+"""Fix2 ordinary logical lifecycle and offline actual-caller regressions only."""
+
+from types import SimpleNamespace
+import importlib
+import json
+import pytest
+import psycopg
+from psycopg.rows import dict_row
+from tests.conftest import requires_db, TEST_DSN
+from tests.archive_helpers import seeded_events, activate_fixture
+from tests.test_archive_batches import verified
+from job_discovery.archive import outbox, batches
+from job_discovery.archive.types import BatchLimits
+from job_discovery import locations
+
+
+@requires_db
+def test_processing_room_is_committed_before_claim_or_seal(conn):
+    claim, _ = seeded_events(conn, 2)
+    admitted = outbox.outbox_health(conn)
+    sample = conn.execute(
+        "SELECT octet_length(body::text) body_bytes,octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow FROM public_outbox LIMIT 1"
+    ).fetchone()
+    ordinary_cost = (
+        4 * sample["body_bytes"]
+        + 2 * sample["canonical_bytes"]
+        + 4096
+        + sample["escrow"]
+    )
+    critical_cost = (
+        2 * sample["body_bytes"]
+        + 2 * sample["canonical_bytes"]
+        + 2048
+        + sample["escrow"]
+    )
+    print(
+        "logical escrow sample",
+        json.dumps(
+            dict(
+                sample,
+                ordinary_event_cost=ordinary_cost,
+                critical_slot_cost=critical_cost,
+                ordinary_byte_capacity=outbox.ORDINARY_BYTES // ordinary_cost,
+                critical_reserved_capacity=outbox.CRITICAL_BYTES // critical_cost,
+            )
+        ),
+    )
+    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
+    conn.commit()
+    claimed = outbox.outbox_health(conn)
+    assert claimed["bytes"] == admitted["bytes"]
+    assert claimed["live_bytes"] > admitted["live_bytes"]
+    seal = batches.seal_batch(ref)
+    batches.persist_seal(conn, seal)
+    conn.commit()
+    sealed = outbox.outbox_health(conn)
+    assert sealed["bytes"] == admitted["bytes"]
+    assert sealed["live_bytes"] > claimed["live_bytes"]
+    batches.ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] < admitted["bytes"]
+
+
+def location_jobs(conn):
+    company = conn.execute(
+        "INSERT INTO companies(name,ats,token) VALUES('Fixture','lever','fixture') RETURNING id"
+    ).fetchone()["id"]
+    for n in range(101):
+        conn.execute(
+            "INSERT INTO jobs(id,company_id,external_id,title,url,location) VALUES(%s,%s,%s,'Role','https://example.test','Austin Texas')",
+            (f"job-{n:03}", company, str(n)),
+        )
+    conn.commit()
+
+
+@requires_db
+@pytest.mark.parametrize("correction", [False, True])
+def test_actual_location_resolution_finishes_all_committed_chunks(conn, correction):
+    from tests.test_locations_resolution import FakeParseClient
+
+    location_jobs(conn)
+    if correction:
+        locations.resolve_new_locations(conn, parse_client=FakeParseClient())
+        conn.execute(
+            "UPDATE locations SET canonicals=ARRAY['Austin, MN'],source='manual'"
+        )
+        conn.commit()
+    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
+    assert result["stamped"] == 101
+    assert result["complete"] and not result["storage_deferred"]
+    expected = "Austin, MN" if correction else "Austin, TX"
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM jobs WHERE location_canonicals=ARRAY[%s]",
+            (expected,),
+        ).fetchone()["n"]
+        == 101
+    )
+
+
+@requires_db
+def test_later_stamp_failure_preserves_progress_and_reports_incomplete(
+    conn, monkeypatch
+):
+    from tests.test_locations_resolution import FakeParseClient
+
+    location_jobs(conn)
+    original = locations.stamp_jobs
+    calls = []
+
+    def interrupted(c):
+        calls.append(1)
+        result = original(c)
+        if len(calls) == 2:
+            raise outbox.ArchiveBlocked("offline later chunk deferral")
+        return result
+
+    monkeypatch.setattr(locations, "stamp_jobs", interrupted)
+    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
+    assert (
+        result["stamped"] == 100
+        and not result["complete"]
+        and result["storage_deferred"]
+    )
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM jobs WHERE location_canonicals IS NOT NULL"
+        ).fetchone()["n"]
+        == 100
+    )
+    monkeypatch.setattr(locations, "stamp_jobs", original)
+    resumed = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
+    assert resumed["stamped"] == 1 and resumed["complete"]
+
+
+@requires_db
+@pytest.mark.parametrize("failed_chunk", [1, 2])
+def test_daily_seed_deferral_preserves_run_and_existing_verification(
+    conn, monkeypatch, failed_chunk
+):
+    from tests.test_lifecycle_reconcile import setup_source
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import SourceResult, SourceStatus
+    from job_discovery.models import Posting
+
+    runner = importlib.import_module("job_discovery.run")
+    source = setup_source(conn)
+    conn.commit()
+    activate_fixture(conn)
+    monkeypatch.setattr(
+        runner, "pre_admission_maintenance", lambda dsn: SimpleNamespace(blocked=False)
+    )
+    monkeypatch.setattr(
+        runner.db,
+        "connect",
+        lambda dsn: psycopg.connect(TEST_DSN, row_factory=dict_row),
+    )
+    targets = [
+        dict(name=f"Seed {i}", ats="lever", token=f"seed-{i}") for i in range(101)
+    ]
+    monkeypatch.setattr(runner, "load_targets", lambda: targets)
+    original = runner.db.sync_seed
+    calls = []
+
+    def blocked(c, chunk):
+        original(c, chunk)
+        calls.append(1)
+        if len(calls) == failed_chunk:
+            raise outbox.ArchiveBlocked("offline seed chunk deferral")
+
+    monkeypatch.setattr(runner.db, "sync_seed", blocked)
+    # Keep the test on seed pressure and verification of the existing corpus.
+    monkeypatch.setattr(runner.db, "sync_source_accounts", lambda c: 0)
+    feeds = []
+
+    def feed(token, **kwargs):
+        feeds.append(token)
+        return SourceResult(
+            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
+        )
+
+    monkeypatch.setitem(ADAPTERS, "lever", feed)
+    result = runner.run()
+    assert result["seed_storage_deferred"] and result["storage_deferred"] >= 1
+    assert result["seed_targets_committed"] == (failed_chunk - 1) * 100
+    assert feeds == [source["public_board_ref"]]
+    assert result["ok"] == 1 and result["failed"] == 0
+    run = conn.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1").fetchone()
+    assert run["finished_at"] and "seed storage deferred" in run["notes"]
+    count = conn.execute(
+        "SELECT count(*) n FROM companies WHERE token LIKE 'seed-%%'"
+    ).fetchone()["n"]
+    assert count == (failed_chunk - 1) * 100
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM public_outbox WHERE aggregate_type='companies'"
+        ).fetchone()["n"]
+        == count
+    )
+    assert conn.execute(
+        "SELECT last_complete_success_at FROM source_accounts WHERE id=%s",
+        (source["id"],),
+    ).fetchone()["last_complete_success_at"]
+
+
+def event_charge(conn, row):
+    from job_discovery.archive.codec import canonical_json
+    from psycopg.types.json import Jsonb
+
+    encoded = canonical_json(outbox._envelope(row))
+    return conn.execute(
+        "SELECT lifecycle_private.archive_row_charge(%s,%s,2048)+lifecycle_private.archive_processing_charge(%s) n",
+        (Jsonb(row["body"]), encoded, encoded),
+    ).fetchone()["n"]
+
+
+@requires_db
+def test_scaled_ordinary_and_critical_boundaries_keep_exact_drain_room(
+    conn, monkeypatch
+):
+    from tests.test_lifecycle_reconcile import setup_source
+    from job_discovery.lifecycle.claims import claim_work
+
+    setup_source(conn)
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "escrow", 180)
+    # Real public mutation and exact requirement; scale only Python's new logical
+    # policy below the unchanged SQL/physical ceilings. No database load pressure.
+    conn.execute("UPDATE jobs SET title='Observed role'")
+    req = conn.execute("SELECT * FROM public_change_requirements").fetchone()
+    ordinary = outbox.outbox_health(conn)["bytes"] + event_charge(conn, req)
+    monkeypatch.setattr(outbox, "ORDINARY_BYTES", ordinary)
+    outbox.flush_public_changes(conn, claim)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] == ordinary
+    conn.commit()
+    with pytest.raises(outbox.ArchiveBlocked), conn.transaction():
+        conn.execute("INSERT INTO brands(name) VALUES('No ordinary room')")
+        outbox.flush_public_changes(conn, claim)
+    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
+    conn.commit()
+    seal = batches.seal_batch(ref)
+    batches.persist_seal(conn, seal)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] == ordinary
+    # A pure closure can use critical allowance without losing its future drain room.
+    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()")
+    req = conn.execute(
+        "SELECT r.* FROM public_change_requirements r WHERE NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id)"
+    ).fetchone()
+    hard = outbox.outbox_health(conn)["bytes"] + event_charge(conn, req)
+    assert hard > ordinary
+    monkeypatch.setattr(outbox, "HARD_BYTES", hard)
+    outbox.flush_public_changes(conn, claim)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] == hard
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 2
+    batches.ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
+    conn.commit()
+    seal = batches.seal_batch(ref)
+    batches.persist_seal(conn, seal)
+    conn.commit()
+    health = outbox.outbox_health(conn)
+    assert health["live_bytes"] <= health["bytes"] <= hard
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 1
+    batches.ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] == 0
+    assert (
+        conn.execute("SELECT count(*) n FROM public_archive_coverage").fetchone()["n"]
+        == 2
+    )
+
+
+@requires_db
+def test_default_selection_shrinks_to_manifest_workspace_and_drains(conn):
+    from job_discovery.lifecycle.claims import claim_work
+
+    for n in range(130):
+        conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {n}",))
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "many-small", 180)
+    outbox.baseline_batch(conn, "brands", claim, limit=100)
+    conn.commit()
+    outbox.baseline_batch(conn, "brands", claim, limit=100)
+    conn.commit()
+    admitted = outbox.outbox_health(conn)["bytes"]
+    counts = []
+    while ref := batches.claim_batch(conn, BatchLimits(), claim):
+        conn.commit()
+        counts.append(len(ref.ordered_event_ids))
+        seal = batches.seal_batch(ref)
+        batches.persist_seal(conn, seal)
+        conn.commit()
+        assert outbox.outbox_health(conn)["bytes"] <= admitted
+        batches.ack_batch(conn, verified(seal), claim)
+        conn.commit()
+    assert len(counts) > 1 and sum(counts) == 130
+    assert outbox.outbox_health(conn)["bytes"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "receipt_character", ["😀", "\x01"], ids=["unicode", "json-escaped"]
+)
+def test_large_valid_event_and_unicode_receipts_fit_singleton_escrow(
+    conn, receipt_character
+):
+    from dataclasses import replace
+    from job_discovery.lifecycle.claims import claim_work
+
+    conn.execute("INSERT INTO brands(name) VALUES(%s)", ("😀" * 2000,))
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "large-singleton", 180)
+    outbox.baseline_batch(conn, "brands", claim)
+    conn.commit()
+    before = outbox.outbox_health(conn)["bytes"]
+    sample = conn.execute(
+        "SELECT octet_length(body::text) body_bytes,octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow FROM public_outbox LIMIT 1"
+    ).fetchone()
+    ordinary_cost = (
+        4 * sample["body_bytes"]
+        + 2 * sample["canonical_bytes"]
+        + 4096
+        + sample["escrow"]
+    )
+    critical_cost = (
+        2 * sample["body_bytes"]
+        + 2 * sample["canonical_bytes"]
+        + 2048
+        + sample["escrow"]
+    )
+    print(
+        "logical escrow sample",
+        json.dumps(
+            dict(
+                sample,
+                ordinary_event_cost=ordinary_cost,
+                critical_slot_cost=critical_cost,
+                ordinary_byte_capacity=outbox.ORDINARY_BYTES // ordinary_cost,
+                critical_reserved_capacity=outbox.CRITICAL_BYTES // critical_cost,
+            )
+        ),
+    )
+    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
+    conn.commit()
+    seal = batches.seal_batch(ref)
+    batches.persist_seal(conn, seal)
+    conn.commit()
+    receipts = verified(seal)
+    receipts = replace(
+        receipts,
+        data_receipt=replace(receipts.data_receipt, receipt=receipt_character * 2048),
+        manifest_receipt=replace(
+            receipts.manifest_receipt, receipt=receipt_character * 2048
+        ),
+    )
+    assert outbox.outbox_health(conn)["bytes"] == before
+    batches.ack_batch(conn, receipts, claim)
+    conn.commit()
+    assert outbox.outbox_health(conn)["bytes"] == 0
+
+
+@requires_db
+def test_active_location_pass_stamps_all_rows_without_cache_events(conn):
+    from tests.test_locations_resolution import FakeParseClient
+
+    location_jobs(conn)
+    activate_fixture(conn)
+    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
+    assert result["complete"] and result["stamped"] == 101
+    events = conn.execute("SELECT aggregate_type,kind FROM public_outbox").fetchall()
+    assert events == [dict(aggregate_type="locations", kind="baseline")]
diff --git a/tests/test_archive_outbox.py b/tests/test_archive_outbox.py
index 49712f3..018a24e 100644
--- a/tests/test_archive_outbox.py
+++ b/tests/test_archive_outbox.py
@@ -186,20 +186,21 @@ def test_listing_watermark_does_not_certify_unknown_version(conn):
 
 
 @requires_db
 def test_migration_reapplication_preserves_flags_and_existing_events(conn):
     from pathlib import Path
     from tests.archive_helpers import seeded_events
 
     claim, refs = seeded_events(conn, 1)
     conn.execute(Path("migrations/2026-10-03-04-public-outbox.sql").read_text())
     conn.execute(Path("migrations/2026-10-03-05-public-outbox-fix1.sql").read_text())
+    conn.execute(Path("migrations/2026-10-03-06-public-outbox-fix2.sql").read_text())
     conn.commit()
     assert {
         r["event_id"]
         for r in conn.execute("SELECT event_id FROM public_pending_events")
     } == {r.event_id for r in refs}
 
 
 @requires_db
 def test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup(conn):
     from uuid import uuid4
diff --git a/tests/test_locations_resolution.py b/tests/test_locations_resolution.py
index e1cf8e5..3f2fb65 100644
--- a/tests/test_locations_resolution.py
+++ b/tests/test_locations_resolution.py
@@ -3,150 +3,187 @@ from job_discovery.location_llm import ParsedLocation
 from job_discovery.locations import resolve_new_locations, stamp_jobs
 from job_discovery.models import Posting
 from tests.conftest import requires_db
 
 
 def _seed_job(conn, ext, location):
     poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
     with conn.cursor() as cur:
         cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
         cid = cur.fetchone()["id"]
-    poller_db.upsert_job(conn, cid, "lever", "acme",
-                         Posting(external_id=ext, title="Eng", url="https://x",
-                                 location=location))
+    poller_db.upsert_job(
+        conn,
+        cid,
+        "lever",
+        "acme",
+        Posting(external_id=ext, title="Eng", url="https://x", location=location),
+    )
     conn.commit()
     return f"lever:acme:{ext}"
 
 
 def _canonicals(conn, job_id):
     with conn.cursor() as cur:
         cur.execute("SELECT location_canonicals FROM jobs WHERE id = %s", (job_id,))
         return cur.fetchone()["location_canonicals"]
 
 
 class FakeParseClient:
     """mapping: raw -> list[ParsedLocation]; raws absent from mapping get no answer."""
+
     def __init__(self, mapping=None, boom=False):
         self.mapping = mapping or {}
         self.boom = boom
         self.calls = 0
 
     async def parse_batch(self, raws):
         self.calls += 1
         if self.boom:
             raise RuntimeError("llm down")
-        return {i: self.mapping[raw] for i, raw in enumerate(raws) if raw in self.mapping}
+        return {
+            i: self.mapping[raw] for i, raw in enumerate(raws) if raw in self.mapping
+        }
 
 
 @requires_db
 def test_rule_pass_inserts_and_stamps(conn):
     jid = _seed_job(conn, "1", "Austin Texas")
     counts = resolve_new_locations(conn, parse_client=FakeParseClient())
     assert counts["rule"] == 1 and counts["stamped"] == 1
     assert _canonicals(conn, jid) == ["Austin, TX"]
     with conn.cursor() as cur:
-        cur.execute("SELECT canonicals, source FROM locations WHERE raw = 'Austin Texas'")
+        cur.execute(
+            "SELECT canonicals, source FROM locations WHERE raw = 'Austin Texas'"
+        )
         row = cur.fetchone()
     assert row["canonicals"] == ["Austin, TX"] and row["source"] == "rule"
 
 
 @requires_db
 def test_multi_location_stamps_array(conn):
     jid = _seed_job(conn, "1", "NYC or Remote")
     resolve_new_locations(conn, parse_client=FakeParseClient())
     assert _canonicals(conn, jid) == ["New York City, NY", "Remote"]
 
 
 @requires_db
 def test_llm_pass_validates_against_gazetteer(conn):
     jid = _seed_job(conn, "1", "Greater Boston Area")
-    fake = FakeParseClient({"Greater Boston Area": [
-        ParsedLocation(city="Boston", state="MA", country="US"),
-        ParsedLocation(city="Atlantisville", country="US"),  # hallucination -> dropped
-    ]})
+    fake = FakeParseClient(
+        {
+            "Greater Boston Area": [
+                ParsedLocation(city="Boston", state="MA", country="US"),
+                ParsedLocation(
+                    city="Atlantisville", country="US"
+                ),  # hallucination -> dropped
+            ]
+        }
+    )
     counts = resolve_new_locations(conn, parse_client=fake)
     assert counts["llm"] == 1
     assert _canonicals(conn, jid) == ["Boston, MA"]
     with conn.cursor() as cur:
         cur.execute("SELECT source FROM locations WHERE raw = 'Greater Boston Area'")
         assert cur.fetchone()["source"] == "llm"
 
 
 @requires_db
 def test_llm_empty_answer_becomes_unmappable(conn):
     jid = _seed_job(conn, "1", "Multiple Locations")
     fake = FakeParseClient({"Multiple Locations": []})
     counts = resolve_new_locations(conn, parse_client=fake)
     assert counts["unmappable"] == 1
     assert _canonicals(conn, jid) == ["Multiple Locations"]
     with conn.cursor() as cur:
-        cur.execute("SELECT canonicals, components FROM locations WHERE raw = 'Multiple Locations'")
+        cur.execute(
+            "SELECT canonicals, components FROM locations WHERE raw = 'Multiple Locations'"
+        )
         row = cur.fetchone()
     assert row["canonicals"] == ["Multiple Locations"]
     assert row["components"][0]["kind"] == "unmappable"
 
 
 @requires_db
 def test_llm_failure_leaves_raw_unmapped_and_does_not_raise(conn):
     jid = _seed_job(conn, "1", "Greater Boston Area")
     counts = resolve_new_locations(conn, parse_client=FakeParseClient(boom=True))
     assert counts["llm"] == 0 and counts["unmappable"] == 0
     assert _canonicals(conn, jid) is None  # COALESCE fallback keeps it matchable by raw
     with conn.cursor() as cur:
-        cur.execute("SELECT count(*) AS n FROM locations WHERE raw = 'Greater Boston Area'")
+        cur.execute(
+            "SELECT count(*) AS n FROM locations WHERE raw = 'Greater Boston Area'"
+        )
         assert cur.fetchone()["n"] == 0  # absent -> retried next run
 
 
 @requires_db
 def test_unanswered_index_left_unmapped(conn):
     _seed_job(conn, "1", "Greater Boston Area")
     fake = FakeParseClient(mapping={})  # answers nothing, but doesn't raise
     counts = resolve_new_locations(conn, parse_client=fake)
-    assert counts == {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}
+    assert counts == {
+        "rule": 0,
+        "llm": 0,
+        "unmappable": 0,
+        "stamped": 0,
+        "complete": False,
+        "storage_deferred": False,
+    }
 
 
 @requires_db
 def test_manual_correction_propagates_on_restamp(conn):
     jid = _seed_job(conn, "1", "Austin Texas")
     resolve_new_locations(conn, parse_client=FakeParseClient())
     with conn.cursor() as cur:
-        cur.execute("UPDATE locations SET canonicals = %s, source = 'manual' "
-                    "WHERE raw = 'Austin Texas'", (["Austin, MN"],))
+        cur.execute(
+            "UPDATE locations SET canonicals = %s, source = 'manual' "
+            "WHERE raw = 'Austin Texas'",
+            (["Austin, MN"],),
+        )
     conn.commit()
     assert stamp_jobs(conn) == 1
     conn.commit()
     assert _canonicals(conn, jid) == ["Austin, MN"]
 
 
 @requires_db
 def test_llm_all_hallucinations_become_unmappable(conn):
     jid = _seed_job(conn, "1", "Atlantis District")
-    fake = FakeParseClient({"Atlantis District": [
-        ParsedLocation(city="Atlantisville", country="US"),
-        ParsedLocation(city="Fooville", country="Canada"),
-    ]})
+    fake = FakeParseClient(
+        {
+            "Atlantis District": [
+                ParsedLocation(city="Atlantisville", country="US"),
+                ParsedLocation(city="Fooville", country="Canada"),
+            ]
+        }
+    )
     counts = resolve_new_locations(conn, parse_client=fake)
     assert counts["unmappable"] == 1 and counts["llm"] == 0
     assert _canonicals(conn, jid) == ["Atlantis District"]
 
 
 @requires_db
 def test_multi_batch_llm_pass(conn):
     poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
     with conn.cursor() as cur:
         cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
         cid = cur.fetchone()["id"]
     raws = [f"Obscureville Sector {i}" for i in range(41)]  # BATCH_SIZE=40 -> 2 batches
     for i, raw in enumerate(raws):
-        poller_db.upsert_job(conn, cid, "lever", "acme",
-                             Posting(external_id=str(i), title="Eng", url="https://x",
-                                     location=raw))
+        poller_db.upsert_job(
+            conn,
+            cid,
+            "lever",
+            "acme",
+            Posting(external_id=str(i), title="Eng", url="https://x", location=raw),
+        )
     conn.commit()
     fake = FakeParseClient({raw: [] for raw in raws})  # every answer: no real place
     counts = resolve_new_locations(conn, parse_client=fake)
     assert fake.calls == 2  # two batches, one event loop
     assert counts["unmappable"] == 41 and counts["stamped"] == 41
 
 
 @requires_db
 def test_already_mapped_raws_not_reprocessed(conn):
     _seed_job(conn, "1", "Austin Texas")
