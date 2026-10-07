# Full pinned review package

BASE: a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9

HEAD: c91efc60b12cfa599c8c6d409a117fd23c02e6ad

## Commits

c91efc60b12cfa599c8c6d409a117fd23c02e6ad docs: record Task11 renewed approval correction and focused verification
4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4 fix: permit renewed explicit archive recovery approvals
8b6638c8d14a707c2a6110cba3c36244e76c2586 Record Task11 permitted review and focused authorization lifecycle fix


## Files

 .../CHECKPOINTS.md                                 |    2 +
 .../CURRENT.md                                     |   13 +
 .../controller-resume.md                           |   13 +
 .../final-review-carry-forward.md                  |    5 +
 .../progress.md                                    |   17 +
 .../rulings-current.md                             |    6 +
 .../task-11-evidence/fix1/base.txt                 |    1 +
 .../fix1/candidate-source-hashes.json              |    7 +
 .../task-11-evidence/fix1/collected.txt            |    4 +
 .../task-11-evidence/fix1/commands.md              |   33 +
 .../task-11-evidence/fix1/final-source-hashes.json |    7 +
 .../task-11-evidence/fix1/green-pg16.exit          |    1 +
 .../task-11-evidence/fix1/green-pg16.txt           |    3 +
 .../task-11-evidence/fix1/green-pg17.exit          |    1 +
 .../task-11-evidence/fix1/green-pg17.txt           |    3 +
 .../task-11-evidence/fix1/inventory.md             |    8 +
 .../task-11-evidence/fix1/raw-red-sha256.txt       |    1 +
 .../task-11-evidence/fix1/red-pg17.exit            |    1 +
 .../task-11-evidence/fix1/red-pg17.raw.txt.gz      |  Bin 0 -> 1689 bytes
 .../task-11-evidence/fix1/red-pg17.txt             |  101 +
 .../task-11-evidence/fix1/red-source-hashes.json   |    6 +
 .../task-11-evidence/fix1/ruff.txt                 |    1 +
 .../task-11-evidence/fix1/source-commit.txt        |    1 +
 .../task-11-evidence/fix1/versions.json            |    7 +
 .../task-11-fix1-dispatch.md                       |   11 +
 .../task-11-fix1-report.md                         |   41 +
 .../task-11-report.md                              |    8 +
 .../task-11-requirements-review.md                 |   81 +
 .../task-11-review-package.md                      | 5204 ++++++++++++++++++++
 .../task-11-reviewer-dispatch.md                   |    9 +
 .../task-13-author-dispatch.md                     |    4 +
 ...-10-03-08-archive-recovery-approval-history.sql |    8 +
 schema.sql                                         |   11 +
 tests/test_archive_recovery_authorization.py       |  160 +
 34 files changed, 5779 insertions(+)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
index 35e6499..eb4364a 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CHECKPOINTS.md
@@ -103,10 +103,12 @@ Checkpoint09 CONFIRMED Librarylibfile_6843e0ce183c8191a275f204e747c78d /file_000
 
 Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
 
 ## Task10 Fix1 source/evidence recovery — 2026-10-07 22:28 UTC
 
 Repeated environment-disconnect notifications were followed by successful command access in the SAME worktree; SAME author resumed unfinished report handoff. Source HEAD01408f0fce8743a98a55726cc9da50f808955443; final66/66 PG17.11/16.15 and Ruff evidence preserved. Complete-history verified Git bundle: Library libfile_64fa98d06e008191957b705dfe9a82c0, file_0000000038ec820d91c7c78bf075fc96 v0. Separate sanitized Fix1 evidence ZIP: Library libfile_d0e4b384a2148191952bb0e1ef4dc81e, file_00000000522882309fc214b3582ba680 v0. Xattrs applied after confirmed uploads. Both UNACCEPTED: report/evidence final commit and SAME scoped independent review remain pending. Evidence copy taken while author prepared report; not claimed an atomic final checkpoint. No duplicate writer, source edits, test reruns, production writes or deployment.
 
 Task10 Fix1 reviewedUNACCEPTED recovery CONFIRMED Librarylibfile_8e68919c12888191874ecd9e9fb6989a /file_00000000905481f7bd204947b9309349 v0; verified complete-history ae0b73fa69db4d4eab85d099f7169448f724f81e bundle /workspace/scratch/job-board-lifecycle-recovery-task10-fix1-reviewed-unaccepted.bundle; xattrs sameexec. Includes finalFix1 source/report/evidence/fullscopedreview/completeFix2dispatch; excludes in-progressFix2. SAMEoriginalauthor Fix2 active; latestACCEPTED09 unchanged.
 
 Checkpoint10 CONFIRMED: accepted permitted original+Fix1+Fix2 requirements/code-quality complete-historya4581b9132a74a51c3887a5bd7e3998b1ee60e7b. Verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-10.bundle, Librarylibfile_89343da4b35481919cac321d4d0554fb /file_0000000056188230aceed1e61193405d v0; xattrsappliedSAMEexec. No fullsecurity/activation/releaseclaim. FreshsoleTask11Astra/high/forkNONE nextfromactualforwardHEAD; fullbrief/preparedauthor-dispatch plusaccepted10interfaces andbindingamendments.
+
+Task11 early UNACCEPTED NON-ATOMIC dirty recovery CONFIRMED Librarylibfile_4cefdf536dc48191a427cdd399424c6c /file_00000000daa88230bea14f29a193622e v0, /workspace/scratch/job-board-task11-in-progress-recovery.tar.gz. VerifiedfullhistoryBASE58180c0bundle +workingtreepatch +listednewS3/offlinetests +earlyinventory/REDoutputs; authoractive/copiedfilesmaypartial, notfullfinalTask11oracceptedcheckpoint; laternewfilesnotimplicitlycovered. No env/credentials/DBdump/dependencies/prodpayload included; xattrssameexec.22:58disconnectnotice followednormalcommands/SAMEauthorpending_init resumed successfully; depsboto3 1.42.74/botocore1.42.97 installed, absentexporter REDcollection retained, no transportblocker. Accepted10Library89343da4 unchanged; continueexisting11/all13/finalreview/release.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
index bae010a..fdec899 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
@@ -66,10 +66,23 @@ Task10 Fix1 reviewedUNACCEPTED recovery CONFIRMED Librarylibfile_8e68919c1288819
 
 Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
 
 Task10 Fix2 final affected archive/actualcaller evidence rootREAD:37passed EACH ownedPG17.11(52.06s)/16.15(58.49s), exits0, Ruffpass; previous candidate63-case phase retained separately after new JSONreceiptserializationbound correction. Finalescrow6*C+128000bytes/event, representationbytesseparate, nophysical interfacechange. Fixtureordinaryeventcapacity506–865/reservedcriticalcapacity78–125EVENTS; actualclosure emits jobs+source_listings (~274306combinedlogicalbytesPG17), approximately61suchfixtureclosures withinreserved16MiB(ordinaryforecastat112MiB) beforeothercosts. Conservativebyteforecast binds longbeforenominalcountthresholds; notproductionthroughput/storageguarantee. Authorreport/sourcepinpending thenSAMEscopedreview F1-1..3; acceptance10notyet. Rootdoesnotstage whileauthorGitactive.
 
 Task10 SAMEauthorFix2 DONE/STOP: source872a9844f59d3ed4db483ff13fe40c0e02bff09b/report-evidence51d1000e6954b3e7bff56652718c8d90084b216a. Root FULLreport/chronology/actualcandidate63EACH17.11/16.15→finalaffected37EACH(52.06s/58.49s)/exit0/RuffpassREAD; all12sourceSHA256match/migrations04/05/06parity.64uniquefinal-supportedcases acrossincrementalphasesNOTsingle64command. CompleteFixBASE095fec8..51d1000package generated; SAMEoriginalreviewer resumedONLYF1-1..3+fixintroducedImportant/Critical. Exact128000+6Cescrowcapacitycosts/61fixturetwo-eventclosures explicit; physical/production/securityassurance unchanged. No source delta afterverification; latestaccepted09unchanged; acceptance10pendingSAMEscopedverdict thencheckpoint/fresh11.
 
 Task10: fix round2/5 (F1-1/F1-2/F1-3 closed,0open;095fec8..51d1000; source872a9844). Task10: complete (commits6075983bd63dced95ec94dc61b9b112a79f4564d..51d1000e6954b3e7bff56652718c8d90084b216a, original+SAMEscoped permitted requirements/code-quality review clean). FULLFix2review rootREAD SpecPASS/QualityAPPROVED/noImportantCritical,12hashes/full13890linediff/parityverified; no reviewer runtimeprobes/reruns. Seedpressure nowcontinuesactualdailysourceverification/durablerunaccounting; locationsdraincommitted100-rowchunks/incompletestatustruthful; ordinary/critical eventadmission reserves6*C+128000logicalprocessingbytes, materializesclaim/seal/ackinsideit. Actualbytesseparate/physicalinterfacesunchanged. Effectivefixture506–865ordinaryevents and61actualtwo-eventclosureswithinreserved16MiB, finite12500slotboundNOTequivalentrunway. Rootcorrectedambiguousfrom112MiBwording; allcosts/omittedTask3expiry/capacity/crossuser/adversarialassurance/privateinputlegacygap/sourcecoverage/MVCCreadinesshonest. Completehistoryaccepted10Librarycheckpoint next→freshsole11immediately; all11–13/finalreview/authorizedcompletedreleasecontinue.
 
 Checkpoint10 CONFIRMED: accepted permitted original+Fix1+Fix2 requirements/code-quality complete-historya4581b9132a74a51c3887a5bd7e3998b1ee60e7b. Verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-10.bundle, Librarylibfile_89343da4b35481919cac321d4d0554fb /file_0000000056188230aceed1e61193405d v0; xattrsappliedSAMEexec. No fullsecurity/activation/releaseclaim. FreshsoleTask11Astra/high/forkNONE nextfromactualforwardHEAD; fullbrief/preparedauthor-dispatch plusaccepted10interfaces andbindingamendments.
+
+Task11 ACTIVE freshsole /root/recovery_task11_implementer, Astra/high/forkNONE, BASE58180c0b4b85860d33813509abe7d3054648816f. Fulltask11brief/preparedauthor-dispatch/bindingamendments+accepted10interfaces handedoff, AWS SDKPython/S3skillreadrequired. Localowned17/16+fakeS3 persistedfreshworkerANDconnection crashmatrix, explicitauthorizedexpiredreplacement, boundedconditionalupload/read-close/seal/exactack/periodicterminalcleanup. No realbucket/config/activation/credentials/IAM/provider/paid/prod/release; no omittedTask3probes/substitutes. RootdocsunstagedwhileauthorGitactive. AfterDONEfullreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirements/qualityreview→sameauthor/scopedfixloopifneeded→accepted11Librarycheckpoint→fresh12. All11–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
+
+Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
+
+Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
+
+Task11 early UNACCEPTED NON-ATOMIC dirty recovery CONFIRMED Librarylibfile_4cefdf536dc48191a427cdd399424c6c /file_00000000daa88230bea14f29a193622e v0, /workspace/scratch/job-board-task11-in-progress-recovery.tar.gz. VerifiedfullhistoryBASE58180c0bundle +workingtreepatch +listednewS3/offlinetests +earlyinventory/REDoutputs; authoractive/copiedfilesmaypartial, notfullfinalTask11oracceptedcheckpoint; laternewfilesnotimplicitlycovered. No env/credentials/DBdump/dependencies/prodpayload included; xattrssameexec.22:58disconnectnotice followednormalcommands/SAMEauthorpending_init resumed successfully; depsboto3 1.42.74/botocore1.42.97 installed, absentexporter REDcollection retained, no transportblocker. Accepted10Library89343da4 unchanged; continueexisting11/all13/finalreview/release.
+
+Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
+
+Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
+Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
index dbab813..712eb6c 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
@@ -324,10 +324,23 @@ Task10 Fix1 reviewedUNACCEPTED recovery CONFIRMED Librarylibfile_8e68919c1288819
 
 Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
 
 Task10 Fix2 final affected archive/actualcaller evidence rootREAD:37passed EACH ownedPG17.11(52.06s)/16.15(58.49s), exits0, Ruffpass; previous candidate63-case phase retained separately after new JSONreceiptserializationbound correction. Finalescrow6*C+128000bytes/event, representationbytesseparate, nophysical interfacechange. Fixtureordinaryeventcapacity506–865/reservedcriticalcapacity78–125EVENTS; actualclosure emits jobs+source_listings (~274306combinedlogicalbytesPG17), approximately61suchfixtureclosures withinreserved16MiB(ordinaryforecastat112MiB) beforeothercosts. Conservativebyteforecast binds longbeforenominalcountthresholds; notproductionthroughput/storageguarantee. Authorreport/sourcepinpending thenSAMEscopedreview F1-1..3; acceptance10notyet. Rootdoesnotstage whileauthorGitactive.
 
 Task10 SAMEauthorFix2 DONE/STOP: source872a9844f59d3ed4db483ff13fe40c0e02bff09b/report-evidence51d1000e6954b3e7bff56652718c8d90084b216a. Root FULLreport/chronology/actualcandidate63EACH17.11/16.15→finalaffected37EACH(52.06s/58.49s)/exit0/RuffpassREAD; all12sourceSHA256match/migrations04/05/06parity.64uniquefinal-supportedcases acrossincrementalphasesNOTsingle64command. CompleteFixBASE095fec8..51d1000package generated; SAMEoriginalreviewer resumedONLYF1-1..3+fixintroducedImportant/Critical. Exact128000+6Cescrowcapacitycosts/61fixturetwo-eventclosures explicit; physical/production/securityassurance unchanged. No source delta afterverification; latestaccepted09unchanged; acceptance10pendingSAMEscopedverdict thencheckpoint/fresh11.
 
 Task10: fix round2/5 (F1-1/F1-2/F1-3 closed,0open;095fec8..51d1000; source872a9844). Task10: complete (commits6075983bd63dced95ec94dc61b9b112a79f4564d..51d1000e6954b3e7bff56652718c8d90084b216a, original+SAMEscoped permitted requirements/code-quality review clean). FULLFix2review rootREAD SpecPASS/QualityAPPROVED/noImportantCritical,12hashes/full13890linediff/parityverified; no reviewer runtimeprobes/reruns. Seedpressure nowcontinuesactualdailysourceverification/durablerunaccounting; locationsdraincommitted100-rowchunks/incompletestatustruthful; ordinary/critical eventadmission reserves6*C+128000logicalprocessingbytes, materializesclaim/seal/ackinsideit. Actualbytesseparate/physicalinterfacesunchanged. Effectivefixture506–865ordinaryevents and61actualtwo-eventclosureswithinreserved16MiB, finite12500slotboundNOTequivalentrunway. Rootcorrectedambiguousfrom112MiBwording; allcosts/omittedTask3expiry/capacity/crossuser/adversarialassurance/privateinputlegacygap/sourcecoverage/MVCCreadinesshonest. Completehistoryaccepted10Librarycheckpoint next→freshsole11immediately; all11–13/finalreview/authorizedcompletedreleasecontinue.
 
 Checkpoint10 CONFIRMED: accepted permitted original+Fix1+Fix2 requirements/code-quality complete-historya4581b9132a74a51c3887a5bd7e3998b1ee60e7b. Verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-10.bundle, Librarylibfile_89343da4b35481919cac321d4d0554fb /file_0000000056188230aceed1e61193405d v0; xattrsappliedSAMEexec. No fullsecurity/activation/releaseclaim. FreshsoleTask11Astra/high/forkNONE nextfromactualforwardHEAD; fullbrief/preparedauthor-dispatch plusaccepted10interfaces andbindingamendments.
+
+Task11 ACTIVE freshsole /root/recovery_task11_implementer, Astra/high/forkNONE, BASE58180c0b4b85860d33813509abe7d3054648816f. Fulltask11brief/preparedauthor-dispatch/bindingamendments+accepted10interfaces handedoff, AWS SDKPython/S3skillreadrequired. Localowned17/16+fakeS3 persistedfreshworkerANDconnection crashmatrix, explicitauthorizedexpiredreplacement, boundedconditionalupload/read-close/seal/exactack/periodicterminalcleanup. No realbucket/config/activation/credentials/IAM/provider/paid/prod/release; no omittedTask3probes/substitutes. RootdocsunstagedwhileauthorGitactive. AfterDONEfullreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirements/qualityreview→sameauthor/scopedfixloopifneeded→accepted11Librarycheckpoint→fresh12. All11–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
+
+Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
+
+Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
+
+Task11 early UNACCEPTED NON-ATOMIC dirty recovery CONFIRMED Librarylibfile_4cefdf536dc48191a427cdd399424c6c /file_00000000daa88230bea14f29a193622e v0, /workspace/scratch/job-board-task11-in-progress-recovery.tar.gz. VerifiedfullhistoryBASE58180c0bundle +workingtreepatch +listednewS3/offlinetests +earlyinventory/REDoutputs; authoractive/copiedfilesmaypartial, notfullfinalTask11oracceptedcheckpoint; laternewfilesnotimplicitlycovered. No env/credentials/DBdump/dependencies/prodpayload included; xattrssameexec.22:58disconnectnotice followednormalcommands/SAMEauthorpending_init resumed successfully; depsboto3 1.42.74/botocore1.42.97 installed, absentexporter REDcollection retained, no transportblocker. Accepted10Library89343da4 unchanged; continueexisting11/all13/finalreview/release.
+
+Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
+
+Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
+Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md
index 05f352d..dfc16a1 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-review-carry-forward.md
@@ -10,10 +10,15 @@ Task9 accepted permitted original+Fix1 review. History displays only selected se
 
 Archive destination/configuration/security-sensitive activation remains separate action gate. No bucket/IAM/credential provisioning or permanentdata/object deletion automatically authorized. Flags/defaultoff/dryrun/exportinactive must be truthful at release unless exact approved configuration permits. Independent security gaps never imply assurance from tests. Final physical allocated/reusableunknown/TLS/production17.6/live24hcoverage/performance/cost readiness honest.
 
 Railway service-scoped existingGitmain autodeploy; preserve unrelateddiscovery5stagedchanges, NEVER environmentwideaccept. Redeployoldbuild notnewSHAverification; sourceconnectlive impactsallenvironments, notsafeimplicitfallback. ExactnewgitSHA/Vercelproductionaliases/Railwayaffectedservices/permittedE2E before successfulreleaseclaim. Remote maina8c4b82d readonlyconfirmed during10; ghGraphQLForbidden read recorded. Finalremote recheck needed.
 
 AllRulinglines pluscosts must survive final deliverable/recovery. Root docs/coordination only, soleauthors product/test/fixes. No historyrewrite or worktreeartifactdeletion before recoverable finalhistory/materials preserved.
 
 Task10 scoped Fix1 found three remaining Important issues, all sent SAMEauthor Fix2: logical batch/seal copies may spendcritical-onlyreserve/self-blockprocessing; locationcaller onlyone100-rowchunk; pairedseeddeferral aborts actual dailyverification/firstrollbacklosesrunrow. No acceptance10yet. New recorded Ruling allows conservative event-admission lifecycle escrow for membership/batch/seal/ack, actualretainedbytesseparate, existing112/128MiB/eventslotceilings andphysical interfaces unchanged. Mustinspect finalaccepted10source/report/SAMEscopedreview; verify actual top-levelcaller continuations and smalllogicalprocessing evidence. Per-eventescrow reduceslogicalbacklogcapacity; no physical/throughput/securityguarantee. PreserveexhaustiveRuling/costartifact beforeworkspacecleanup.
 
 Task10 now accepted after SAMEFix2 SpecPASS/QualityAPPROVED; full source872a9844/report51d1000/reviewtask-10-fix2-requirements-review.md. AllthreeFix2Importantclosed. Conservativeforecast6*C+128000 means actualfixture506–865ordinaryevents/61two-eventclosureswithinreserved16MiB, NOT12500closurepromise. Physicalclaim/seal/ack canstilldefer; noMVCC/securityassurance. Genuineactualdailyseedverificationcontinuation and100-rowlocationchunkcompletion/incompletestatuscovered. Fullarchive activation/config/baseline/finite-slotrunway/cleanuporchestration remain downstreamprerequisites. Historicalmigrationduplicationminorremainsvisible.
+
+Task13 sourcecoverage concrete carry: root read runtime references afterTask11. verify_due_sources(conn,max_boards=100,seconds=300) has exactlyone actualcaller job_discovery/run.py:179. Poller remainsdaily00UTC; reviewer supervisor has reviewer/maintenance/archive children, no periodic sourceverifier. Thus the healthy normalpath processes atmost100selectedboards/day (resumedtailscanconsume turns); ifenabledcorpus exceeds100, that runtimecannotgiveeveryboard24hverification. Operationalfallback behavior maydiffer and noactualproductionenabledsourcecount was queried. Task13 actualwritercaller/scheduler inventory mustresolve this concrete integration limit with bounded scheduling preservingdaily discovery/independentmaintenance/claims/guard, or surfacealoadbearinggap rather than callsmallmanualfixturefairness a24hcoverageproof. No redundantproductionaggregates/wholecrawl/securityprobes authorizedbythisnote; useparentcountifneeded.
+
+Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
+Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index 3cd8ec0..63046c5 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -378,10 +378,27 @@ Task10 Fix1 reviewedUNACCEPTED recovery CONFIRMED Librarylibfile_8e68919c1288819
 
 Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
 
 Task10 Fix2 final affected archive/actualcaller evidence rootREAD:37passed EACH ownedPG17.11(52.06s)/16.15(58.49s), exits0, Ruffpass; previous candidate63-case phase retained separately after new JSONreceiptserializationbound correction. Finalescrow6*C+128000bytes/event, representationbytesseparate, nophysical interfacechange. Fixtureordinaryeventcapacity506–865/reservedcriticalcapacity78–125EVENTS; actualclosure emits jobs+source_listings (~274306combinedlogicalbytesPG17), approximately61suchfixtureclosures withinreserved16MiB(ordinaryforecastat112MiB) beforeothercosts. Conservativebyteforecast binds longbeforenominalcountthresholds; notproductionthroughput/storageguarantee. Authorreport/sourcepinpending thenSAMEscopedreview F1-1..3; acceptance10notyet. Rootdoesnotstage whileauthorGitactive.
 
 Task10 SAMEauthorFix2 DONE/STOP: source872a9844f59d3ed4db483ff13fe40c0e02bff09b/report-evidence51d1000e6954b3e7bff56652718c8d90084b216a. Root FULLreport/chronology/actualcandidate63EACH17.11/16.15→finalaffected37EACH(52.06s/58.49s)/exit0/RuffpassREAD; all12sourceSHA256match/migrations04/05/06parity.64uniquefinal-supportedcases acrossincrementalphasesNOTsingle64command. CompleteFixBASE095fec8..51d1000package generated; SAMEoriginalreviewer resumedONLYF1-1..3+fixintroducedImportant/Critical. Exact128000+6Cescrowcapacitycosts/61fixturetwo-eventclosures explicit; physical/production/securityassurance unchanged. No source delta afterverification; latestaccepted09unchanged; acceptance10pendingSAMEscopedverdict thencheckpoint/fresh11.
 
 Task10: fix round2/5 (F1-1/F1-2/F1-3 closed,0open;095fec8..51d1000; source872a9844). Task10: complete (commits6075983bd63dced95ec94dc61b9b112a79f4564d..51d1000e6954b3e7bff56652718c8d90084b216a, original+SAMEscoped permitted requirements/code-quality review clean). FULLFix2review rootREAD SpecPASS/QualityAPPROVED/noImportantCritical,12hashes/full13890linediff/parityverified; no reviewer runtimeprobes/reruns. Seedpressure nowcontinuesactualdailysourceverification/durablerunaccounting; locationsdraincommitted100-rowchunks/incompletestatustruthful; ordinary/critical eventadmission reserves6*C+128000logicalprocessingbytes, materializesclaim/seal/ackinsideit. Actualbytesseparate/physicalinterfacesunchanged. Effectivefixture506–865ordinaryevents and61actualtwo-eventclosureswithinreserved16MiB, finite12500slotboundNOTequivalentrunway. Rootcorrectedambiguousfrom112MiBwording; allcosts/omittedTask3expiry/capacity/crossuser/adversarialassurance/privateinputlegacygap/sourcecoverage/MVCCreadinesshonest. Completehistoryaccepted10Librarycheckpoint next→freshsole11immediately; all11–13/finalreview/authorizedcompletedreleasecontinue.
 
 Checkpoint10 CONFIRMED: accepted permitted original+Fix1+Fix2 requirements/code-quality complete-historya4581b9132a74a51c3887a5bd7e3998b1ee60e7b. Verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-10.bundle, Librarylibfile_89343da4b35481919cac321d4d0554fb /file_0000000056188230aceed1e61193405d v0; xattrsappliedSAMEexec. No fullsecurity/activation/releaseclaim. FreshsoleTask11Astra/high/forkNONE nextfromactualforwardHEAD; fullbrief/preparedauthor-dispatch plusaccepted10interfaces andbindingamendments.
+
+Task11 ACTIVE freshsole /root/recovery_task11_implementer, Astra/high/forkNONE, BASE58180c0b4b85860d33813509abe7d3054648816f. Fulltask11brief/preparedauthor-dispatch/bindingamendments+accepted10interfaces handedoff, AWS SDKPython/S3skillreadrequired. Localowned17/16+fakeS3 persistedfreshworkerANDconnection crashmatrix, explicitauthorizedexpiredreplacement, boundedconditionalupload/read-close/seal/exactack/periodicterminalcleanup. No realbucket/config/activation/credentials/IAM/provider/paid/prod/release; no omittedTask3probes/substitutes. RootdocsunstagedwhileauthorGitactive. AfterDONEfullreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirements/qualityreview→sameauthor/scopedfixloopifneeded→accepted11Librarycheckpoint→fresh12. All11–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
+
+Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
+
+Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
+
+Transient environmentstarting notice immediately replacedbyusablecontext; normalexec HEAD58180c0/status succeeded, SAMETask11dirtysource intact. No replacementwriter/worktree/testrestart. Accepted10 Library89343da4 remainsrecoveryroute.
+
+Task11 early UNACCEPTED NON-ATOMIC dirty recovery CONFIRMED Librarylibfile_4cefdf536dc48191a427cdd399424c6c /file_00000000daa88230bea14f29a193622e v0, /workspace/scratch/job-board-task11-in-progress-recovery.tar.gz. VerifiedfullhistoryBASE58180c0bundle +workingtreepatch +listednewS3/offlinetests +earlyinventory/REDoutputs; authoractive/copiedfilesmaypartial, notfullfinalTask11oracceptedcheckpoint; laternewfilesnotimplicitlycovered. No env/credentials/DBdump/dependencies/prodpayload included; xattrssameexec.22:58disconnectnotice followednormalcommands/SAMEauthorpending_init resumed successfully; depsboto3 1.42.74/botocore1.42.97 installed, absentexporter REDcollection retained, no transportblocker. Accepted10Library89343da4 unchanged; continueexisting11/all13/finalreview/release.
+
+Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
+
+Task13 sourcecoverage concrete carry: root read runtime references afterTask11. verify_due_sources(conn,max_boards=100,seconds=300) has exactlyone actualcaller job_discovery/run.py:179. Poller remainsdaily00UTC; reviewer supervisor has reviewer/maintenance/archive children, no periodic sourceverifier. Thus the healthy normalpath processes atmost100selectedboards/day (resumedtailscanconsume turns); ifenabledcorpus exceeds100, that runtimecannotgiveeveryboard24hverification. Operationalfallback behavior maydiffer and noactualproductionenabledsourcecount was queried. Task13 actualwritercaller/scheduler inventory mustresolve this concrete integration limit with bounded scheduling preservingdaily discovery/independentmaintenance/claims/guard, or surfacealoadbearinggap rather than callsmallmanualfixturefairness a24hcoverageproof. No redundantproductionaggregates/wholecrawl/securityprobes authorizedbythisnote; useparentcountifneeded.
+
+Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
+Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
index cb05f6f..26c90e0 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
@@ -56,10 +56,16 @@ Task8Fix1 legacyunknownpackage+missingQ conflict: onebundlecannottruthfullyassig
 
 [progress.md:303]
 
 Task9 Ruling: narrow additive read-only public lifecycle projection/predicate helper for role-scoped board queries — why: withAnonSql/withUserSql preserved while source_listings/control remain service-only; ordinary public feed needs derived lifecycle display/predicate fields — cost if wrong: excessive operational metadata exposure or per-row query cost; require minimal fixed schema-qualified SELECT/safe search_path, no dynamicSQL/private data/control internals/DML/bypass/underlyingtablegrants/serviceSql board escape. Expose only publicJobidentity+necessary deriveddiscovery/source/payloadfields/derivedflagbehavior. Preserve flagoffanon/missingmappinghonesty, additiveSQL/schema parity and ordinary realrole querycoverage. Local reviewableimplementation only, NOTproductiongrant/activation/independentsecurityapproval; no omittedmechanism/adversarialprobes. Author reported dashboard/AGENTS absent, reads dashboard/CLAUDE instead. Task9active; rootnoGitstage duringauthorwork.
 
 [progress.md:349]
 
 Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
 
 Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
+
+Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
+
+Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
+
+Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/base.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/base.txt
new file mode 100644
index 0000000..a085a32
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/base.txt
@@ -0,0 +1 @@
+8b6638c8d14a707c2a6110cba3c36244e76c2586
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/candidate-source-hashes.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/candidate-source-hashes.json
new file mode 100644
index 0000000..81deb61
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/candidate-source-hashes.json
@@ -0,0 +1,7 @@
+{
+  "schema.sql": "9d3e87fad26d19730b54ae03469d8c0ead621b60415a80049615bd28b02e5036",
+  "migrations/2026-10-03-07-archive-export.sql": "f9b341f5a71421197d08c994d01b661648dfd006d824df08484bee78bcc56a93",
+  "migrations/2026-10-03-08-archive-recovery-approval-history.sql": "8c366f44c1ee6c7b55584752a80eb669d4ccb9123d6ff02c00cdeed527d30e15",
+  "job_discovery/archive/recovery.py": "bbfafaf28950a3ee6351613a069c3b363b18a903ac9033c8e011d979b741a7ba",
+  "tests/test_archive_recovery_authorization.py": "3838a66324d444d7e103e0c19abf48c59299087843a0a3cc7eef0db9573b653e"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/collected.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/collected.txt
new file mode 100644
index 0000000..070b799
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/collected.txt
@@ -0,0 +1,4 @@
+tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires
+tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations
+
+2 tests collected in 0.20s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/commands.md
new file mode 100644
index 0000000..eed2e0b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/commands.md
@@ -0,0 +1,33 @@
+# R11-1 Fix1 exact commands and phases
+
+Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; `/bin/bash`, login:false. Reviewed FixBASE `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`; actual start HEAD `8b6638c` includes controller documentation only. Source correction `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`.
+
+Read full task-11-fix1-dispatch.md and task-11-requirements-review.md before changes. Read receiving-code-review skill and checked the finding against migration07/recovery.py. inventory.md predates executions. No helper agents or additional review were requested.
+
+## RED before migration08
+
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires -q
+```
+
+Result: PostgreSQL17.11,1 failed in0.83s,exit1. Failure is the second explicit grant's `UniqueViolation` on `public_archive_recovery_authorizations_batch_id_key`, after expired-grant rejection/no-mutation assertions passed. red-source-hashes.json captures the exact pre-fix schema, historical migration07, unchanged recovery API and new regression test. red-pg17.raw.txt.gz retains exact stdout/stderr bytes (deterministic gzip); raw-red-sha256.txt hashes the uncompressed original. red-pg17.txt differs only by removed trailing line whitespace for readable repository evidence.
+
+## GREEN after migration08, unchanged final sources
+
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
+```
+
+Results: PostgreSQL17.11,2 passed in1.94s,exit0; PostgreSQL16.15,2 passed in2.46s,exit0. No skips/deselections. Each command selects exactly the new ordinary approval-lifecycle regression plus the controller-approved existing catalog-parity node. No other historical migration node, transport/supervisor/deferred suite or security probe ran. Each harness owns its separately generated random-loopback database/container, using cached images.
+
+```
+.venv/bin/python -m ruff format tests/test_archive_recovery_authorization.py
+.venv/bin/python -m ruff check tests/test_archive_recovery_authorization.py
+.venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations --collect-only -q
+git diff --cached --check
+```
+
+Ruff passes (ruff.txt), collected.txt lists the2 nodes, source staged whitespace check passes. Candidate and final source hash maps are identical. Migration08 occurs verbatim in schema.sql. Byte comparisons against FixBASE confirm historical migration07 and runtime recovery.py are unchanged. Final test content is identical to RED test content; only migration08/schema changed between RED and GREEN. versions.json records Python3.12.14, psycopg3.3.6, pytest9.1.1, Ruff0.15.20 and cached image IDs.
+
+No source changed after the GREEN runs. Reporting did not rerun completed tests. No safeguard or execution failure occurred beyond the intended RED unique-constraint failure.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/final-source-hashes.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/final-source-hashes.json
new file mode 100644
index 0000000..81deb61
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/final-source-hashes.json
@@ -0,0 +1,7 @@
+{
+  "schema.sql": "9d3e87fad26d19730b54ae03469d8c0ead621b60415a80049615bd28b02e5036",
+  "migrations/2026-10-03-07-archive-export.sql": "f9b341f5a71421197d08c994d01b661648dfd006d824df08484bee78bcc56a93",
+  "migrations/2026-10-03-08-archive-recovery-approval-history.sql": "8c366f44c1ee6c7b55584752a80eb669d4ccb9123d6ff02c00cdeed527d30e15",
+  "job_discovery/archive/recovery.py": "bbfafaf28950a3ee6351613a069c3b363b18a903ac9033c8e011d979b741a7ba",
+  "tests/test_archive_recovery_authorization.py": "3838a66324d444d7e103e0c19abf48c59299087843a0a3cc7eef0db9573b653e"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.txt
new file mode 100644
index 0000000..dc3dd22
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+..                                                                       [100%]
+2 passed in 2.46s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.txt
new file mode 100644
index 0000000..df67299
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/green-pg17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..                                                                       [100%]
+2 passed in 1.94s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/inventory.md
new file mode 100644
index 0000000..ec5cab0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/inventory.md
@@ -0,0 +1,8 @@
+# R11-1 focused Fix1 execution inventory — before execution
+
+Scope: ordinary lifecycle of the NEW archive operator authorization only. On an owned random-loopback PostgreSQL fixture, create a retained expired archive batch and an already-expired unused explicit operator approval. Assert old approval rejection makes no mutation. Persist a new separately granted approval for the same batch. Roll back replacement, verify both approval histories and original membership survive, then retry from a fresh database connection. Assert exact event IDs/canonical bytes/revisions/occurrence-observation-recorded times, only new approval consumed, old approval unchanged, one committed supersession and old batch fence retained. A repeated replacement callback must leave the committed outcome unchanged.
+
+RED: only tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires on owned PG17 before migration08.
+GREEN: that same node and ONLY tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations on owned PG17 and16 after migration08. The existing exact catalog node is controller-approved for additive migration parity/reapplication. No sibling migration tests, prior transport/supervisor/crash suite reruns, old Task3 expiry/physical/cross-user/activation/security/adversarial probes or substitutions. No provider/production/S3 calls, configuration/credentials/IAM changes or release actions. Cached owned harness only; never shared55432. Shell /bin/bash login:false.
+
+R11-2 is not part of the correction: its named bomb case only rejects an oversized declared compressed object through bounded_read and does not exercise exporter decompression. Superseded-shell aging and combined production-runtime sizing remain downstream limits.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/raw-red-sha256.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/raw-red-sha256.txt
new file mode 100644
index 0000000..360d70a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/raw-red-sha256.txt
@@ -0,0 +1 @@
+f343f74a0c27c6e70b385ea5587efc477684cbad6a9a74a3d460ef22c77c6d20
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.raw.txt.gz
new file mode 100644
index 0000000..5c120d4
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.txt
new file mode 100644
index 0000000..029529c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-pg17.txt
@@ -0,0 +1,101 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+__________ test_fresh_explicit_approval_after_unused_approval_expires __________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33094 user=postgres database=poller_lifecycle_test) at 0x7f9711fc09b0>
+
+    @requires_db
+    def test_fresh_explicit_approval_after_unused_approval_expires(conn):
+        batch, _ = setup_batch(conn)
+        claim = claim_work(conn, "archive-export", "singleton", 180)
+        ref = recover_batch(conn, batch.batch_id, claim)
+        conn.commit()
+        seal = seal_batch(ref)
+        persist_seal(conn, seal)
+        conn.commit()
+        original_pending = pending(conn)
+        set_archive_clock(conn, ref.eligible_until + timedelta(seconds=1))
+        expired_id, fresh_id = uuid4(), uuid4()
+        # Seed an already-expired historical approval; ordinary authorization time
+        # remains the real DB clock, separate from the archive-horizon fixture clock.
+        conn.execute(
+            """INSERT INTO public_archive_recovery_authorizations(
+            authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,approved_at,expires_at)
+            SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
+            'original explicit approval',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'
+            FROM public_archive_batches WHERE batch_id=%s""",
+            (expired_id, ref.batch_id),
+        )
+        conn.commit()
+        old_history = approval_rows(conn, ref.batch_id)[expired_id]
+        with pytest.raises(ArchiveBlocked, match="authorization"), conn.transaction():
+            replace_expired_batch(
+                conn, ref.batch_id, claim, RecoveryAuthorization(expired_id)
+            )
+        assert approval_rows(conn, ref.batch_id) == {expired_id: old_history}
+        assert pending(conn) == original_pending
+        assert (
+            conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
+                "n"
+            ]
+            == 0
+        )
+        assert (
+            conn.execute(
+                "SELECT state FROM public_archive_batches WHERE batch_id=%s",
+                (ref.batch_id,),
+            ).fetchone()["state"]
+            == "sealed"
+        )
+        conn.commit()
+
+        # A distinct operator grant is required: no mutation/extension of old approval.
+>       conn.execute(
+            """INSERT INTO public_archive_recovery_authorizations(
+            authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
+            SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
+            'new separately granted explicit approval',clock_timestamp()+interval '1 hour'
+            FROM public_archive_batches WHERE batch_id=%s""",
+            (fresh_id, ref.batch_id),
+        )
+
+tests/test_archive_recovery_authorization.py:77:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33094 user=postgres database=poller_lifecycle_test) at 0x7f9711fc09b0>
+query = "INSERT INTO public_archive_recovery_authorizations(\n        authorization_id,batch_id,event_ids_sha256,manifest_hash... granted explicit approval',clock_timestamp()+interval '1 hour'\n        FROM public_archive_batches WHERE batch_id=%s"
+params = (UUID('b5847f7e-0ef9-4ecc-a13c-19ae341b0cb1'), UUID('7ee5d5b4-9d6d-4bc3-9d8e-7c97c37df46c'))
+prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.UniqueViolation: duplicate key value violates unique constraint "public_archive_recovery_authorizations_batch_id_key"
+E           DETAIL:  Key (batch_id)=(7ee5d5b4-9d6d-4bc3-9d8e-7c97c37df46c) already exists.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UniqueViolation
+=========================== short test summary info ============================
+FAILED tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires
+1 failed in 0.83s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-source-hashes.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-source-hashes.json
new file mode 100644
index 0000000..534dc38
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/red-source-hashes.json
@@ -0,0 +1,6 @@
+{
+  "schema.sql": "067c9aef1c494e986af3efdf323ef8cb4ebaf29827522b12f674b8534b835328",
+  "migrations/2026-10-03-07-archive-export.sql": "f9b341f5a71421197d08c994d01b661648dfd006d824df08484bee78bcc56a93",
+  "job_discovery/archive/recovery.py": "bbfafaf28950a3ee6351613a069c3b363b18a903ac9033c8e011d979b741a7ba",
+  "tests/test_archive_recovery_authorization.py": "3838a66324d444d7e103e0c19abf48c59299087843a0a3cc7eef0db9573b653e"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/source-commit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/source-commit.txt
new file mode 100644
index 0000000..d947a12
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/source-commit.txt
@@ -0,0 +1 @@
+4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/versions.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/versions.json
new file mode 100644
index 0000000..f3dfc7c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/fix1/versions.json
@@ -0,0 +1,7 @@
+{
+  "python": "3.12.14",
+  "psycopg": "3.3.6",
+  "pytest": "9.1.1",
+  "ruff": "0.15.20",
+  "images": "postgres:16 275447c94b11\npostgres:17 327daa8fae71"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-dispatch.md
new file mode 100644
index 0000000..693128e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-dispatch.md
@@ -0,0 +1,11 @@
+# Task11 SAME author ONE Fix1 correction
+
+Read FULL task-11-requirements-review.md. R11-1, its narrow correction and ordinary evidence requirement are the sole Important correction list verbatim. Previous reviewed FixBASE is `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`, source `7411eb34187bf2b7956472c186670660611e2f26`; intervening root controller documentation must remain untouched. SAME author only, no helpers/subagents/reviewers. Original brief/spec, recorded archive-only recovery/catalog parity rulings and binding review-scope/release amendments remain.
+
+Support a separately granted fresh explicit recovery authorization after an old unused authorization expires. Preserve the old approval history, exact pending event identity/bytes/revisions/timestamps, one committed supersession and its retained fences. Worker must never authorize itself or silently extend old approval. Choose the smallest additive archive-only schema/API change; preserve historical migration07 and append a new mirrored migration if needed. No old claim/role/physical/gate enforcement changes or substitute review/probes.
+
+Inventory before running the focused owned17/16 affected recovery cases: old expired approval rejected without mutation; new explicit approval accepted for the same retained expired batch; rollback/retry retains old record and consumes only the new approval; exact atomic replacement and one committed supersession. Include the previously approved exact clean-schema/additive catalog-parity node after schema changes. Do not rerun completed transport/supervisor cases without a concrete affected delta; no broad suite, other migration/security/activation/cross-user/expiry/physical/adversarial nodes, shared55432, provider/network/production/S3/config/IAM/credential/release actions. This concerns the new recovery authorization lifecycle only, not omitted Task3 expiry review. Shell /bin/bash login:false.
+
+R11-2 is a recorded nonblocking deferred Minor evidence-label issue for final triage, not an expansion of this Important fix list. Keep its actual limited claim honest. Source-supported superseded-shell aging coverage and combined-runtime sizing remain downstream integration limits; do not imply this correction completed them.
+
+Append full Fix1 section to task-11-report.md, optionally task-11-fix1-report.md, sanitized task-11-evidence/fix1/ inventory/commands/outputs/hash/version/phase evidence. Forward commit OWN source/tests/report/evidence only, root docs unstaged; return DONE plus exact source/report pins, actual verification/limits and STOP Git. Root FULL report/evidence read then complete FixBASE..finalHEAD package to SAME reviewer scoped R11-1 and fix-introduced Important/Critical only. Flags off/retirement dry-run/archive inactive/no production approval implied. Any safeguard exact error/stop affected/no bypass.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-report.md
new file mode 100644
index 0000000..b58fe4f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-fix1-report.md
@@ -0,0 +1,41 @@
+# Task11 Fix1 — R11-1 renewed explicit recovery authorization
+
+Status: focused correction implemented and locally verified. Same reviewer reassessment of R11-1 and fix-introduced Important/Critical issues remains pending. This report does not supersede the reduced security-review scope or claim acceptance/readiness.
+
+Reviewed FixBASE: `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`, original source `7411eb34187bf2b7956472c186670660611e2f26`. Actual starting HEAD `8b6638c` also contains controller review/dispatch documentation. Fix1 source: **`4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`**. Only three owned source/test files changed; root documentation remains unstaged.
+
+## Finding and narrow correction
+
+R11-1 correctly identified that migration07 made batch_id unconditionally unique in the authorization table. An expired unused immutable approval could neither be consumed nor changed/deleted, while inserting a fresh explicit approval for the retained batch failed uniqueness. This ordinary deferral sequence stranded pending recovery.
+
+New additive `migrations/2026-10-03-08-archive-recovery-approval-history.sql` drops only `public_archive_recovery_authorizations_batch_id_key`. It adds partial unique index `idx_public_archive_recovery_one_consumption` on batch_id **where consumed_at IS NOT NULL**. Thus separately granted explicit approval rows can coexist with old unused approval history, while at most one approval can be committed as consumed for the old batch. The established immutable supersession old_batch_id primary key and terminal batch state continue to retain one committed replacement/fence.
+
+The8-line migration is mirrored verbatim in schema.sql with its ledger entry. Historical migration07 and runtime recovery.py are byte-identical to FixBASE. No trigger, claim, role, gate, physical accounting, reservation or transport implementation changed. No API expansion was needed: the existing API still requires the caller's exact separately persisted approval ID, validates its current real DB-time window and expected manifest/event membership, and atomically consumes it with replacement. The worker cannot create a grant, extend an old grant or erase history/fences. Old expired approvals stay rejected and unchanged.
+
+This permits multiple explicit unconsumed operator grants; the consumed-only unique index and existing fenced state prevent more than one committed replacement. Each extra approval remains durable history and therefore needs storage/operational sizing. The migration adds an index; it does not promise zero rollout cost, physical reuse or admission headroom. No live migration or approval was performed.
+
+## Evidence and exact scope
+
+`task-11-evidence/fix1/inventory.md` was written before execution. Full commands, raw/readable RED output, GREEN output/exit files, collection inventory, versions and RED/candidate/final hashes are present in that directory.
+
+| Phase | Owned server | Actual result |
+| --- | --- | --- |
+| New approval-lifecycle regression before migration08 | PostgreSQL17.11 |1 failed,0.83s,exit1|
+| Same regression plus exact approved catalog-parity node | PostgreSQL17.11 |2 passed,1.94s,exit0|
+| Same regression plus exact approved catalog-parity node | PostgreSQL16.15 |2 passed,2.46s,exit0|
+
+RED reproduced the precise defect: `UniqueViolation: duplicate key value violates unique constraint "public_archive_recovery_authorizations_batch_id_key"` when inserting the newly granted approval. The preceding old-approval rejection and unchanged-history/pending assertions passed. This is an intentional ordinary regression failure, not a platform safeguard rejection or an omitted Task3 mechanism test.
+
+The regression seeds a retained expired batch and an already-expired unused operator approval in the owned fixture. Archive eligibility uses the existing fixture-only archive_clock replacement; authorization windows continue to use the real database clock. It verifies old approval rejection without changing its row, pending canonical bytes/times/revisions, old sealed state or supersession count. A separately inserted new approval succeeds after migration08. A replacement transaction intentionally rolls back; both approval rows, original batch count and exact pending data survive, and no supersession commits. Retrying through a fresh connection consumes only the new approval and retains the old row byte-for-field. Replacement IDs differ while event IDs, canonical bodies/hashes, revisions and occurrence/observation/recorded timestamps stay identical. The new730-day window and prior batch reference are asserted. One retained supersession holds the old owner/generation/manifest fence. A repeated replacement callback is rejected and leaves the authorization rows, pending membership and sole fence unchanged. No S3 upload or acknowledgement is needed for this narrow approval-lifecycle regression; pending data intentionally remains pending after replacement.
+
+The separately authorized catalog node bootstraps the owned frozen schema, applies all additive migrations in order, compares the catalog to clean schema, reapplies and checks unchanged catalog/ledger. Only that exact existing migration node ran. Both final two-node commands have zero skips/deselections. No completed transport/supervisor/crash suites were rerun.
+
+Python3.12.14, psycopg3.3.6, pytest9.1.1 and Ruff0.15.20 are recorded; cached images17 `327daa8fae71`,16 `275447c94b11`. PostgreSQL17.11 supplies major-version parity, not historical production17.6;16.15 supplies compatibility. Ruff and staged whitespace checks pass. RED and GREEN used the identical new test file. Candidate/final hashes match and no source changed during or after GREEN verification. Exact raw RED output is retained in deterministic gzip; its readable copy normalizes trailing whitespace only.
+
+## Remaining limits and handoff
+
+R11-2 remains a deferred nonblocking Minor finding. The preexisting case named “bomb” exercises declared compressed-length rejection/closed-body behavior through bounded_read with a two-byte limit; it does **not** exercise exporter decompression or establish a new bomb-test result. Fix1 does not change that test or repeat transport checks. The existing source's exact-byte comparison and bounded decompression behavior remain source claims under the earlier review.
+
+Superseded-shell aging still lacks a dedicated recorded Task11 fixture; combined reviewer/maintenance/archive production resource sizing remains a downstream integration prerequisite. The earlier single import measurement is not a production load/cost claim. Real approved destination/credentials/private-encrypted-policy-retention validation and live provider access remain unperformed. Physical admission can still defer archive operations; retained approval/quarantine/supersession history needs sizing; no cleanup supplies physical delete credit.
+
+Flags remain off, retirement dry-run, destination empty, archive inactive/readiness unvalidated. No production/provider/network/S3/configuration/IAM/credential/security-setting or release action, permanent data deletion, push/PR/merge/deploy, helper/subagent or independent review occurred. Omitted Task3 expiry/physical/cross-user/adversarial probes remain omitted; no security approval is inferred. No safeguard rejection occurred. Controller owns the same-reviewer reassessment, checkpoint and remaining all13/final release work.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md
index fc682a2..7396643 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md
@@ -43,10 +43,18 @@ Initial transport tests failed collection with2 ModuleNotFoundError errors befor
 
 Changed product files: archive s3/export/recovery modules, accepted batches' archive-clock and superseded-owner checks, independent reviewer archive entrypoint/supervisor, additive migration/schema, and matching pinned boto3/botocore dependencies. Changed tests: three new archive files and existing ordinary supervisor expectations/cases. No dashboard/pricing/model setting changed. Upstream main `a8c4b82d95b35c0259600c19c1506faae807c3fc` was read and is already an ancestor of the base.
 
 All controls remain default off, retirement dry-run, destination table empty, archive inactive and readiness unvalidated. Real approved destination/private/encrypted/policy verification, credentials and rollout remain separate controller prerequisites; SDK doubles are not evidence of a real bucket's policy or retention. Transport currently requests SSE-S3 AES256; an approved destination must permit that contract. No production/provider/model/feed call, real S3 write/read, IAM/credential/security-setting change, permanent deletion, push/PR/merge/deploy or activation occurred. No author subagents were used.
 
 The accepted6*C+128000 logical processing escrow, finite critical slots and actual physical reservations are preserved. Physical admission can still defer claim/seal/ack/replacement/quarantine; terminal cleanup does not promise physical reuse. Quarantine or supersession/authorization marker accumulation requires operational sizing; markers are intentionally retained. A quarantine could not be persisted if physical admission is unavailable, in which case pending work stays blocked and retries can recur. Corrupt payloads are never automatically repaired or silently reset.
 
 Task3 expiry/physical-capacity/cross-user/adversarial security probes and substituted reviews remain deliberately omitted. No old security/activation suite ran; the single approved migration catalog node supplies schema parity only. No security approval is inferred. Independent permitted Task11 requirements/quality review and all remaining tasks/final release verification belong to the controller. No platform safeguard rejection occurred; the read-only uv cache path error was resolved using the already permitted /tmp cache, not an escalation.
 
 Documentation-only correction: raw failed pytest traces contained trailing spaces. The final evidence normalizes only line-end whitespace; exact raw outputs remain in the original report commit `d128ce8aef7fb7efea18592acba02f013e32991b`. No source or test result changed, and no test rerun was needed. Final staged documentation whitespace check passes.
+
+## Focused Fix1 after permitted review — R11-1
+
+The original permitted review reported one Important defect: an expired unused immutable approval's unconditional batch_id uniqueness prevented a fresh explicit operator grant. Fix1 source `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4` adds only mirrored migration08, schema/ledger text and a focused regression. Migration08 replaces unconditional batch uniqueness with a partial unique index for consumed approvals, preserving expired history while permitting separately granted fresh approvals and one committed consumption/supersession. Migration07 and runtime recovery/claim/role/physical/gate code are unchanged. Worker self-authorization, silent extension and fence clearing remain unavailable.
+
+Full [Fix1 report](task-11-fix1-report.md) and `task-11-evidence/fix1/` record the inventory, exact commands/hashes/versions, intended RED (PG17,1 failed in0.83s at the original unique constraint) and GREEN: the new approval-lifecycle regression plus only the approved catalog-parity node passed on17.11 (2 passed,1.94s) and16.15 (2 passed,2.46s), both exit0 with no skips/deselections. The regression covers expired rejection/no mutation, new explicit approval, rollback/fresh-connection retry, unchanged exact pending IDs/bytes/revisions/times, only new approval consumed, old history preserved and a single retained supersession. No completed transport/supervisor suite reran. Ruff/whitespace pass; sources remained unchanged throughout GREEN verification. Same-reviewer reassessment is pending, not inferred from these passes.
+
+R11-2 remains deferred Minor: the preexisting named bomb test proves only declared compressed-size rejection/body closure through bounded_read, not exporter decompression. Superseded-shell aging evidence and combined production-runtime sizing remain downstream limits. Additional explicit grants retain more history and the added index has rollout/storage cost; no physical-capacity promise follows. Default-off/destination/unreviewed-security limits above remain unchanged. No platform safeguard rejection or production/cloud/release action occurred.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-requirements-review.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-requirements-review.md
new file mode 100644
index 0000000..5fc4586
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-requirements-review.md
@@ -0,0 +1,81 @@
+# Task 11 independent permitted requirements and code-quality review
+
+Status: DONE / STOP. Requirements verdict: **FAIL — one Important ordinary recovery defect**. Code-quality verdict: **CHANGES REQUIRED**. No Critical findings. One additional Minor test-evidence finding is recorded below. Neither verdict is a security verdict or a production/destination readiness decision.
+
+## Exact reviewed identity and scope
+
+- BASE: `58180c0b4b85860d33813509abe7d3054648816f`.
+- Final source: `7411eb34187bf2b7956472c186670660611e2f26`.
+- Original report/evidence: `d128ce8aef7fb7efea18592acba02f013e32991b`.
+- Reviewed report/evidence HEAD: `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9` (documentation-only whitespace normalization after the source commit).
+- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+
+Read the Task 11 reviewer dispatch first, repository AGENTS.md, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, full task-11-brief.md, full 52-line task-11-report.md, relevant archive/binding specification, Task 11 controller rulings in progress.md and rulings-current.md, and every line of the 5,204-line task-11-review-package.md. Independently compared its complete diff with `git diff --no-ext-diff --unified=10 BASE HEAD`: exact match. Independently compared all 14 current source/test/dependency SHA-256 values with both recorded inventories: all match; candidate/final inventories match. Migration 07 text occurs verbatim in schema.sql. HEAD remained the pinned SHA. Controller-owned documentation changes were present and were not edited.
+
+Reviewed the NEW conditional SDK transport, bounded content/destination validation, exact seal/manifest/membership contract, ordinary persisted failure recovery, scheduled independent child/deadline/drain, terminal cleanup integration, and explicit archive-only expired replacement protocol. Read the accepted batches/codec/type interfaces only as needed to establish the new call contracts. Task 10's processing escrow, critical slots and physical deferral behavior remain accepted interfaces. This review does not certify their mechanisms.
+
+No helpers/subagents, tests or test collections, database sessions/probes, network/provider calls, production/configuration/credential access, source/test edits, Git staging/commits, activation or release actions were performed. Only read-only source/evidence/hash/diff inspection and this review document were produced. No safeguard rejection occurred.
+
+## Findings
+
+### R11-1 — Important: an unused expired recovery authorization permanently strands its batch
+
+Locations: `migrations/2026-10-03-07-archive-export.sql:26`–`51` (also mirrored in schema.sql); `job_discovery/archive/recovery.py:42`–`55`.
+
+The new authorization table makes `batch_id` unconditionally UNIQUE. The new consumption trigger forbids deleting the row and forbids changing its immutable fields, including `approved_at` and `expires_at`; its only allowed update consumes a currently valid authorization. Meanwhile `replace_expired_batch` correctly rejects an authorization whose `expires_at` has passed.
+
+An ordinary operational sequence therefore has no supported recovery: an operator grants explicit authorization; recovery remains deferred or interrupted until that authorization expires unused; the operator later grants fresh explicit authorization for the same retained pending batch. The old authorization cannot be consumed, renewed or removed, and inserting a new authorization fails the unique batch constraint. Pending events and membership remain safe, but the required explicitly authorized replacement is permanently unavailable without an out-of-protocol schema/trigger intervention. Physical deferral is already an acknowledged normal outcome, so a time-limited authorization can expire without any malformed input or attack.
+
+Required narrow correction: support a fresh, separately granted explicit authorization after a prior unused one expires, preserving prior authorization history and single committed supersession. Do not let the worker authorize itself, silently extend old approval, clear retained fences, or alter existing claim/role/capacity interfaces. The sole author/controller should choose the smallest archive-only schema/API adjustment. This finding concerns the new operator authorization lifecycle, not Task 3's omitted independent expiry-enforcement review.
+
+Required ordinary evidence: a retained expired archive batch with an unused authorization already expired in the owned fixture; old authorization rejected without mutation; a newly persisted explicit authorization for that same batch accepted; atomic replacement preserves exact IDs/bytes/revisions/times and consumes only the new authorization while retaining the old record. Verify rollback/retry and exactly one committed supersession using the affected new recovery path. Run the focused affected owned PG17/16 nodes and the already authorized exact catalog-parity node if schema changes. Existing completed crash/transport/supervisor cases do not need rerunning absent a concrete affected change. No omitted Task 3 suite/probe or production authorization is requested.
+
+### R11-2 — Minor: the case named “bomb” does not test the exporter’s compressed-content/decompression handling
+
+Location: `tests/test_archive_export.py:173`–`222`, especially lines 183 and 219.
+
+The case creates gzip bytes that would expand beyond 8 MiB, but then calls `bounded_read` directly with a **two-byte compressed limit**. The declared compressed length is already greater than two, so the case exits at ContentLength validation without reading or decompressing the object and without invoking `put_verify_batch`. It proves closure on an oversize declared object, duplicating the oversize case; it is not evidence for the named exporter bomb scenario.
+
+The source itself has relevant protection: exact expected compressed-byte comparison precedes decompression, accepted canonical serialization is capped, and the gzip read requests at most MAX_EXPANDED+1. No exploitable decompression failure is established here. Correct the evidence label, or add a focused offline transport case presenting an oversized-expansion gzip body through the real `put_verify_batch` path with ordinary compressed limits, asserting fail-closed rejection/closed stream/no VerifiedBatch and honestly naming whether rejection occurs before decompression. Do not weaken the exact-byte check just to reach a test branch. This is a narrow evidence-quality issue, not a request to repeat covered tests or run adversarial/security probes.
+
+## Requirements and implementation assessment
+
+**Conditional transport and integrity:** The production adapter uses the pinned boto3/botocore client, a fixed Destination value, region equality, expected bucket owner, service-only prefix/key shape, conditional `IfNoneMatch='*'`, SHA-256 and SSE-S3 AES256. Its real ClientError handler treats only HTTP 412 as existing-object recovery; read timeout and closed-connection ambiguity proceed to bounded exact reads. Other provider errors propagate. No HEAD-then-overwrite, ETag checksum assumption, delete/list/bucket/IAM mutation or signed-URL interface is introduced. SDK construction and I/O follow commit. The adapter reuses one SDK client for its turn and explicitly sets connect/read timeouts 3/5 seconds, standard total attempts 2, pool 2 and configured-endpoint override suppression.
+
+**Exact bytes and manifests:** `put_verify_batch` validates the public envelope and schema before I/O and reconstructs the whole seal. The accepted `seal_batch` interface explicitly compares event IDs from canonical envelopes with ordered membership; deterministic JSONL/gzip and the complete manifest bind IDs/digest, counts, hashes, aggregate ranges, prefix, keys, serializer, seal/eligibility times and prior batch reference. Both remote objects must match exact intended bytes. Data Get is chunked, checks declared/read bounds and optional provider checksum, and closes acquired bodies in finally. Caps are 16 MiB compressed, 8 MiB expanded and 1 MiB manifest. Returned version IDs go into receipts, leaving sealed manifest bytes unchanged. R11-2 limits the recorded bomb-test claim.
+
+**Persisted ordinary failure recovery:** `export_once` acquires an owned connection and the existing singleton claim, resumes persisted eligible non-quarantined batches, serializes outside a transaction, persists the immutable seal before upload, checks DB-time archive eligibility before transport and relies on the accepted exact acknowledgement recheck. Data-only upload and ambiguous success preserve the original keys/bytes. Integrity ValueErrors can persist a minimal quarantine marker subject to existing physical admission. Failure cleanup rolls back, cancels the claim and closes the connection. Claims/old security mechanisms are consumed as interfaces, not independently re-certified.
+
+**Explicit replacement:** The new API requires an explicit matching unused currently valid authorization, expected event-ID digest and original manifest hash. It checks exact pending bytes/count and suppression, reserves through existing admission, inserts a new opaque seal/window with prior ID, consumes authorization, stores a permanent old-owner/generation supersession marker, marks the old batch superseded, and transfers only batch_id for identical members in one transaction. Old callbacks are rejected; no old S3 objects are removed; event history timestamps stay intact. The happy path and rollback are supported by source and recorded tests. R11-1 prevents approval of the complete ordinary recovery lifecycle.
+
+**Schedule and terminal state:** The supervisor adds a separate archive child at startup/every 60 seconds, a 120-second process deadline, checks no slower than five seconds, and a shared 30-second SIGTERM drain. Maintenance keeps its startup/900-second schedule and 90-second deadline. Child scheduling is independent of archive network calls. Cleanup is invoked after activation even during export pause and shares a maximum 2,000-row budget with accepted terminal compaction, including eligible empty superseded shells. Pending items/events/seals are not TTL-deleted; coverage, acknowledgement and supersession fences/authorization history remain. The recorded cleanup fixture directly covers ordinary acknowledged terminal retirement; it does not separately exercise superseded-shell aging. No physical reuse claim is inferred.
+
+**Default-off/compatibility:** The additive migration adds no approved destination row or activation. New validation flags default false; an incomplete/unvalidated destination cannot build the ordinary real export path. Recorded flag-off fixtures make no SDK calls. The new worker lives in the existing reviewer runtime; discovery's one-shot command and daily cron configuration are unchanged by this diff. Dependency versions match requirements.txt/pyproject.toml. No dashboard/model/pricing changes occur.
+
+## Actual evidence read, without reruns
+
+The full package contains exact commands, phase inventory, collected node list, actual stdout, four final exit files, version inventory and candidate/final hash maps; all were read. The two final feature commands use `.venv/bin/python tools/lifecycle_test_db.py --postgres-major {17,16} -- .venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q`. The separate parity commands select **only** `tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations` on each major.
+
+| Recorded execution | Actual server | Result |
+| --- | --- | --- |
+| Four-file final feature selection | PostgreSQL 17.11 | 61 passed, 21.87 s, exit 0 |
+| Four-file final feature selection | PostgreSQL 16.15 | 61 passed, 26.42 s, exit 0 |
+| Exact catalog-parity node | PostgreSQL 17.11 | 1 passed, 0.84 s, exit 0 |
+| Exact catalog-parity node | PostgreSQL 16.15 | 1 passed, 1.37 s, exit 0 |
+
+These are 62 unique cases per major over two commands, not a 62-case single run. Final feature selections have no skipped/deselected cases. PG17.11 is major-version parity, not the historical production 17.6 patch version; PG16.15 is compatibility. Versions recorded: Python 3.12.14, psycopg 3.3.6, pytest 9.1.1, Ruff 0.15.20, boto3 1.42.74, botocore 1.42.97; cached image IDs 17 `327daa8fae71`, 16 `275447c94b11`. Final Ruff output is “All checks passed!”; author commands record successful source/staged whitespace checks.
+
+The actual seven-phase persisted matrix covers seal, data, manifest, ambiguous upload/read interruption, verify, uncommitted ack and committed ack. Each failing export invocation is discarded, its owned connection closes, and a new invocation/client with a different connection resumes persisted rows. Assertions cover same seal ID/time/window, exact membership and pending IDs, unchanged object bytes and rejection of old acknowledgements. These are **discarded invocations with cleanup**, not seven OS SIGKILL or actual broken-socket experiments. That meets the binding “terminate/discard worker AND database connection” scope without inventing stronger process-failure evidence. Separate supervisor cases use real children/signals; the archive scheduling/deadline-specific cases use the deterministic child model. The replacement fixture verifies before moving only the owned archive clock across the horizon, rejects ack without cleanup, rejects absent authorization, stops expired-key retries, performs explicit replacement rollback and commit, and resumes replacement data/ack rollback failures through fresh invocations. It does not cover R11-1's expired unused authorization followed by renewed approval.
+
+Earlier failed outputs remain distinct: RED collection had two absent-module errors before s3.py; no RED hash snapshot exists. Initial DB fixtures failed because of claim-cancel ordering, then an absent observed_at view field; corrections are documented, followed by ten passing development cases. Expanded supervisor checks caught stale two-child expectations. Final 61-case evidence uses the corrected three-child code. Historical Ruff had 88 formatting findings; final evidence is clean. Four failed trace files later had only trailing whitespace normalized; their raw bytes remain pinned in the original report commit. No final source hash is attributed to the RED phase.
+
+## Costs, prerequisites and deliberate limits
+
+- Accepted Task 10 logical processing escrow remains `6*C+128000` per event, with finite critical slots; this is conservative logical runway, not physical capacity or an unbounded-outage promise. Existing physical admission can still defer claim/seal/ack/replacement/quarantine. Deletion/compaction supplies no inferred physical credit. Existing role/gate/claim/physical-capacity implementations were not inspected as substitute security targets.
+- The archive adds periodic process/import and connection work, object Put/Get traffic and retained recovery/quarantine metadata. The recorded single offline import measurement is wall 0.358868 s, CPU 0.358884 s, peak RSS 38,212 KiB. The failed `/usr/bin/time` invocation is honestly retained. This does **not** measure combined reviewer/maintenance/archive runtime CPU, memory, database connections or provider costs. The binding combined-runtime measurement remains a controller/final integration prerequisite; no cost neutrality or production sizing approval follows.
+- Real destination/account/region/privacy/encryption/policy/retention validation, appropriately scoped credentials, and approved live read/write validation remain unperformed. AES256 must fit the eventual approved destination contract. Fake credentials, disabled IMDS and SDK doubles are offline request-contract evidence only. Old partial objects and all object versions require the separately authorized retention/removal policy; the exporter has no delete capability.
+- Quarantine and supersession/authorization history require operational sizing. If quarantine cannot be persisted through existing physical admission, pending work stays blocked and attempts can recur. Superseded-shell source logic is reviewed, while its seven-day cleanup branch lacks a dedicated recorded Task 11 fixture. These limitations must stay visible in final integration reporting.
+- Task 3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes remain deliberately omitted under REVIEW-SCOPE-AMENDMENT. No security approval, bypass, replacement mechanism review or instruction to run those suites is implied. The exact catalog node establishes catalog parity only.
+- RELEASE-AUTHORIZATION permits controller-led release of the completed upgrade after all 13 tasks and final permitted review; this review performs no release action and does not restore the superseded blanket development/release hold. Task 11 acceptance requires resolving R11-1; controller owns author fixes, forward documentation/checkpoints and final integration/release decisions.
+
+DONE. Requirements FAIL; code quality CHANGES REQUIRED; one Important and one Minor finding, no Critical findings. STOP.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-review-package.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-review-package.md
new file mode 100644
index 0000000..3eabeaa
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-review-package.md
@@ -0,0 +1,5204 @@
+# Full pinned review package
+
+BASE: 58180c0b4b85860d33813509abe7d3054648816f
+
+HEAD: a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9
+
+## Commits
+
+a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9 docs: normalize Task11 evidence whitespace without changing results
+d128ce8aef7fb7efea18592acba02f013e32991b docs: record Task11 exporter recovery verification and limits
+7411eb34187bf2b7956472c186670660611e2f26 feat: export verified immutable public event batches to S3
+
+
+## Files
+
+ .../task-11-evidence/candidate-source-hashes.json  |  16 +
+ .../task-11-evidence/commands.md                   |  50 ++
+ .../task-11-evidence/db17-development.txt          | 246 ++++++
+ .../task-11-evidence/db17-development2.txt         |   3 +
+ .../task-11-evidence/db17-expanded.txt             |  32 +
+ .../task-11-evidence/db17-initial.txt              | 774 +++++++++++++++++
+ .../task-11-evidence/final-collected.txt           |  63 ++
+ .../task-11-evidence/final-source-hashes.json      |  16 +
+ .../task-11-evidence/green-offline-initial.txt     |   2 +
+ .../import-resources-tool-error.txt                |   1 +
+ .../task-11-evidence/import-resources.txt          |   6 +
+ .../task-11-evidence/inventory.md                  |   9 +
+ .../offline-supervisor-development.txt             |  26 +
+ .../task-11-evidence/pg16-final.exit               |   1 +
+ .../task-11-evidence/pg16-final.txt                |   3 +
+ .../task-11-evidence/pg16-migration-parity.exit    |   1 +
+ .../task-11-evidence/pg16-migration-parity.txt     |   3 +
+ .../task-11-evidence/pg17-final.exit               |   1 +
+ .../task-11-evidence/pg17-final.txt                |   3 +
+ .../task-11-evidence/pg17-migration-parity.exit    |   1 +
+ .../task-11-evidence/pg17-migration-parity.txt     |   3 +
+ .../task-11-evidence/red-offline.txt               |  29 +
+ .../task-11-evidence/ruff-final.txt                |   1 +
+ .../task-11-evidence/ruff-initial.txt              | 941 +++++++++++++++++++++
+ .../task-11-evidence/source-commit.txt             |   1 +
+ .../task-11-evidence/versions.json                 |  10 +
+ .../task-11-report.md                              |  52 ++
+ job_discovery/archive/batches.py                   |  17 +-
+ job_discovery/archive/export.py                    | 157 ++++
+ job_discovery/archive/recovery.py                  | 120 +++
+ job_discovery/archive/s3.py                        | 262 ++++++
+ migrations/2026-10-03-07-archive-export.sql        | 135 +++
+ pyproject.toml                                     |   2 +
+ requirements.txt                                   |   2 +
+ reviewer/archive_worker.py                         |  39 +
+ reviewer/supervisor.py                             |  81 +-
+ schema.sql                                         | 138 +++
+ tests/test_archive_export.py                       | 283 +++++++
+ tests/test_archive_privacy.py                      |  66 ++
+ tests/test_archive_retention_recovery.py           | 490 +++++++++++
+ tests/test_lifecycle_supervisor.py                 | 301 +++++--
+ 41 files changed, 4276 insertions(+), 111 deletions(-)
+
+
+## Complete diff
+
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/candidate-source-hashes.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/candidate-source-hashes.json
+new file mode 100644
+index 0000000..95c4d82
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/candidate-source-hashes.json
+@@ -0,0 +1,16 @@
++{
++  "job_discovery/archive/batches.py": "ec3b17f1cf76526ff22adcaf21648719ac6901479785e4cd4162a8d69dfd45d6",
++  "job_discovery/archive/s3.py": "24fa2a2fd6ea996208fb60c8ded22fed701f6c2c7862657235aa62431a295233",
++  "job_discovery/archive/export.py": "682506a6c506dd41aaa46dd1f01c60b569cb9f56b7676bafb3e6db7e30bc5a40",
++  "job_discovery/archive/recovery.py": "bbfafaf28950a3ee6351613a069c3b363b18a903ac9033c8e011d979b741a7ba",
++  "reviewer/archive_worker.py": "4c156013dfeece9edf6151c03d57309481712aa70009627bf8bf8ae1e21d1039",
++  "reviewer/supervisor.py": "53cfbc8f1f057853ab4e8da5eab74288358264d09d2ada6322a8bf0c3ee93e2e",
++  "tests/test_archive_export.py": "14271076b8925aea89368269f8e41883f9ab4df109cfd17925f1ef912f1ea536",
++  "tests/test_archive_privacy.py": "3fc8c7a19848c79522d21371ad49698fd19dc0bfb9fd4dca2ba175992aa8634f",
++  "tests/test_archive_retention_recovery.py": "0473744386ad567bf502c82554637ffd590d21544ec56294badc216f24295153",
++  "tests/test_lifecycle_supervisor.py": "adc9075feacd5e330f6bfc2d9d8730746e1138f42474c55b5ff95fc280c1d2ab",
++  "schema.sql": "067c9aef1c494e986af3efdf323ef8cb4ebaf29827522b12f674b8534b835328",
++  "migrations/2026-10-03-07-archive-export.sql": "f9b341f5a71421197d08c994d01b661648dfd006d824df08484bee78bcc56a93",
++  "requirements.txt": "4f77cc1deae8079f457f9ea5ff2e24286cb969177544d41e68f8ed9a34190c2a",
++  "pyproject.toml": "e7396bb84fdd2f4bb67e3dbcd7a4576e1350e1573c6409de323125b3efe90459"
++}
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/commands.md
+new file mode 100644
+index 0000000..da1000b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/commands.md
+@@ -0,0 +1,50 @@
++# Task11 commands and phase record
++
++Working directory for every command: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; shell `/bin/bash`, `login:false`. Only owned random-loopback cached PostgreSQL containers were used. `.venv/bin/python` is Python3.12.14. No broad pytest command occurred.
++
++## Preparation
++
++- Read repository AGENTS, REVIEW-SCOPE-AMENDMENT, RELEASE-AUTHORIZATION, task-11-brief, task-11-author-dispatch, task-10-fix2-report, relevant binding spec archive sections and accepted interfaces.
++- Read AWS SDK Python skill, references/s3.md and references/configuration.md. Read verification-before-completion skill for final evidence gate.
++- `git ls-remote origin refs/heads/main` -> `a8c4b82d95b35c0259600c19c1506faae807c3fc`.
++- `git merge-base --is-ancestor a8c4b82 HEAD` -> exit0. Reviewed that upstream merge's pricing/review-model delta; no affected setting changed.
++- `uv pip install --python .venv/bin/python 'boto3==1.42.74'` initially failed because the default `/home/agent/.cache/uv` is read-only. `uv --cache-dir /tmp/lifecycle-task11-uv pip install --python .venv/bin/python 'boto3==1.42.74'` succeeded within allowed paths. Pinned installed compatible botocore1.42.97 too. No credentials read.
++
++## Development phases
++
++`python` in each command below means `.venv/bin/python`, exactly as run. Every database command prefixed `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 --` and the inner executable was also `.venv/bin/python`.
++
++1. `python -m pytest tests/test_archive_export.py tests/test_archive_privacy.py -q` -> red-offline.txt; exit2; two collection errors: absent job_discovery.archive.s3. These tests were created before transport. No initial source hash snapshot was captured; final source snapshots below are exact and are not attributed to RED.
++2. Same command -> green-offline-initial.txt; exit0;13 passed.
++3. `python -m pytest tests/test_archive_retention_recovery.py -q` under PG17 -> db17-initial.txt; exit1;10 failures from fixture cancelling a claim in its write transaction. Corrected fixture to commit first; existing guard unchanged.
++4. Same DB command -> db17-development.txt; exit1;1 passed/9 failures because the pending view does not expose observed_at. Corrected snapshot assertion to read observed_at from the authoritative immutable canonical envelope.
++5. Same DB command -> db17-development2.txt; exit0;10 passed,8.43s.
++6. `python -m pytest tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q -k 'not worker_flag_off and not worker_scheduled and not worker_contended and not worker_failure and not real_maintenance_sigterm'` -> offline-supervisor-development.txt; exit1;40 passed/1 failed/5 deselected. Existing supervisor shutdown assertion still expected two children.
++7. `python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q` under PG17 -> db17-expanded.txt; exit1;58 passed/1 failed,21.04s. A second existing shutdown timestamp assertion still expected two children; corrected it to three. All archive cases in that phase passed.
++8. Initial Ruff output (ruff-initial.txt) reported style violations before Ruff formatting. Formatting completed; final Ruff is clean. No implementation logic depends on lint fixes.
++
++## Final commands, unchanged source hashes
++
++```
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
++.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
++```
++
++Outputs: pg17-final.txt, pg16-final.txt, pg17-migration-parity.txt, pg16-migration-parity.txt. Their .exit files each contain0. The selected four files collect61 cases (final-collected.txt); the separately authorized migration node adds one per major. No skips/deselections in these final executions. No other migration-file node ran.
++
++```
++.venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py --collect-only -q
++.venv/bin/python -m ruff check job_discovery/archive/s3.py job_discovery/archive/export.py job_discovery/archive/recovery.py reviewer/archive_worker.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_archive_retention_recovery.py reviewer/supervisor.py tests/test_lifecycle_supervisor.py job_discovery/archive/batches.py
++git diff --check
++git diff --cached --check
++```
++
++Ruff output is ruff-final.txt. All checks exit0. A Python hashlib comparison checked all14 owned source/test/dependency files against candidate-source-hashes.json after all final runs; final-source-hashes.json is identical. Migration07 text occurs verbatim in schema.sql. No source changed during final verification.
++
++`/usr/bin/time` was unavailable (import-resources-tool-error.txt). A Python process then measured one offline `import reviewer.archive_worker` with time.monotonic/process_time and resource.getrusage(RUSAGE_SELF): import-resources.txt. This is import overhead only, not production total runtime load or cost evidence.
++
++## Documentation-only handoff correction
++
++The documentation staged whitespace check reported trailing spaces in raw pytest failure traces. Source checks above were clean. A forward documentation-only commit strips line-end whitespace from offline-supervisor-development.txt, db17-expanded.txt, db17-initial.txt, db17-development.txt. Original byte-for-byte output remains in report commit `d128ce8aef7fb7efea18592acba02f013e32991b`; failure text, counts and chronology are unchanged. No source changed and no tests were rerun for this formatting cleanup. Final staged documentation whitespace check passes.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development.txt
+new file mode 100644
+index 0000000..cf0107c
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development.txt
+@@ -0,0 +1,246 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++FFFFFFFF.F                                                               [100%]
++=================================== FAILURES ===================================
++_____ test_fresh_worker_connection_recovers_each_persisted_boundary[seal] ______
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70da3d40b0>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d95b8c50>
++phase = 'seal'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b0950>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++_____ test_fresh_worker_connection_recovers_each_persisted_boundary[data] ______
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d9415490>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d9415820>
++phase = 'data'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b1d90>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++___ test_fresh_worker_connection_recovers_each_persisted_boundary[manifest] ____
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d94168a0>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d9414a10>
++phase = 'manifest'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b22d0>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++____ test_fresh_worker_connection_recovers_each_persisted_boundary[verify] _____
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d94152b0>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d9414e00>
++phase = 'verify'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b2a50>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++_ test_fresh_worker_connection_recovers_each_persisted_boundary[ack-rollback] __
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d9417b30>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d9415cd0>
++phase = 'ack-rollback'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b0950>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++__ test_fresh_worker_connection_recovers_each_persisted_boundary[ack-commit] ___
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d9417890>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f70d9414200>
++phase = 'ack-commit'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++        batch,refs=setup_batch(conn)
++>       original_pending=pending(conn)
++                         ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:52:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b1010>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++______ test_verify_ack_crosses_archive_horizon_then_explicit_replacement _______
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b8740>
++
++    def test_verify_ack_crosses_archive_horizon_then_explicit_replacement(conn):
++        batch,refs=setup_batch(conn)
++        claim=claim_work(conn,'archive-export','singleton',180)
++        ref=recover_batch(conn,batch.batch_id,claim);conn.commit()
++        seal=seal_batch(ref);persist_seal(conn,seal);conn.commit()
++        sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++        verified=put_verify_batch(seal,client)
++>       original=pending(conn)
++                 ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:117:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b3b90>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++________________ test_corrupt_manifest_keeps_persisted_pending _________________
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d9479820>
++
++    def test_corrupt_manifest_keeps_persisted_pending(conn):
++        batch,_=setup_batch(conn)
++        seal=seal_batch(batch);sdk=FakeS3();sdk.objects[seal.manifest_key]=b'corrupt'
++>       before=pending(conn)
++               ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:157:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d95b3d10>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++_______ test_periodic_cleanup_is_bounded_and_retains_pending_and_markers _______
++
++conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d947b680>
++
++    def test_periodic_cleanup_is_bounded_and_retains_pending_and_markers(conn):
++        batch,_=setup_batch(conn)
++        worker.export_once(TEST_DSN,ArchiveClient(destination(),FakeS3()))
++>       before=pending(conn)
++               ^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:177:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:41: in pending
++    result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++
++.0 = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=33087 user=postgres database=poller_lifecycle_test) at 0x7f70d9448b90>
++
++>   result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],r['observed_at'],r['recorded_at'],r['revision'])
++                                                                             ^^^^^^^^^^^^^^^^
++        for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++E   KeyError: 'observed_at'
++
++tests/test_archive_retention_recovery.py:41: KeyError
++=========================== short test summary info ============================
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[seal]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[data]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[manifest]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[verify]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-rollback]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-commit]
++FAILED tests/test_archive_retention_recovery.py::test_verify_ack_crosses_archive_horizon_then_explicit_replacement
++FAILED tests/test_archive_retention_recovery.py::test_corrupt_manifest_keeps_persisted_pending
++FAILED tests/test_archive_retention_recovery.py::test_periodic_cleanup_is_bounded_and_retains_pending_and_markers
++9 failed, 1 passed in 6.39s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development2.txt
+new file mode 100644
+index 0000000..0e7aba1
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-development2.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++..........                                                               [100%]
++10 passed in 8.43s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-expanded.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-expanded.txt
+new file mode 100644
+index 0000000..ca0763e
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-expanded.txt
+@@ -0,0 +1,32 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.........................................F.................              [100%]
++=================================== FAILURES ===================================
++_______ test_shutdown_has_one_global_30_second_drain_and_no_new_children _______
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f20ffdd3ef0>
++
++    def test_shutdown_has_one_global_30_second_drain_and_no_new_children(monkeypatch):
++        s = supervisor()
++        clock = Clock()
++        monkeypatch.setattr(
++            s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++        )
++        children = []
++
++        def spawn(name):
++            child = Child(clock, ignores_term=True)
++            children.append(child)
++            return child
++
++        assert s.supervise(Stop(clock, 10), spawn, clock) == 0
++        assert len(children) == 3
++>       assert [c.terminated for c in children] == [10, 10]
++E       assert [10.0, 10.0, 10.0] == [10, 10]
++E
++E         Left contains one more item: 10.0
++E         Use -v to get more diff
++
++tests/test_lifecycle_supervisor.py:147: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_lifecycle_supervisor.py::test_shutdown_has_one_global_30_second_drain_and_no_new_children
++1 failed, 58 passed in 21.04s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-initial.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-initial.txt
+new file mode 100644
+index 0000000..90a69d3
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/db17-initial.txt
+@@ -0,0 +1,774 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++FFFFFFFFFF                                                               [100%]
++=================================== FAILURES ===================================
++_____ test_fresh_worker_connection_recovers_each_persisted_boundary[seal] ______
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a6270>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ada73f50>
++phase = 'seal'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a6270>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++_____ test_fresh_worker_connection_recovers_each_persisted_boundary[data] ______
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a4260>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ad8a4cb0>
++phase = 'data'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a4260>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++___ test_fresh_worker_connection_recovers_each_persisted_boundary[manifest] ____
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a5760>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ad8a51f0>
++phase = 'manifest'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a5760>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++____ test_fresh_worker_connection_recovers_each_persisted_boundary[verify] _____
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad705190>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ad7078c0>
++phase = 'verify'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad705190>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++_ test_fresh_worker_connection_recovers_each_persisted_boundary[ack-rollback] __
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad706990>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ad7074d0>
++phase = 'ack-rollback'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad706990>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++__ test_fresh_worker_connection_recovers_each_persisted_boundary[ack-commit] ___
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad706540>
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f88ad706b10>
++phase = 'ack-commit'
++
++    @pytest.mark.parametrize('phase',['seal','data','manifest','verify','ack-rollback','ack-commit'])
++    def test_fresh_worker_connection_recovers_each_persisted_boundary(conn,monkeypatch,phase):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:50:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad706540>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++______ test_verify_ack_crosses_archive_horizon_then_explicit_replacement _______
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad704b60>
++
++    def test_verify_ack_crosses_archive_horizon_then_explicit_replacement(conn):
++>       batch,refs=setup_batch(conn)
++                   ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:110:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad704b60>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++________________ test_corrupt_manifest_keeps_persisted_pending _________________
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad704950>
++
++    def test_corrupt_manifest_keeps_persisted_pending(conn):
++>       batch,_=setup_batch(conn)
++                ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:154:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad704950>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++__________ test_flag_off_and_unvalidated_destination_never_touch_sdk ___________
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a5790>
++
++    def test_flag_off_and_unvalidated_destination_never_touch_sdk(conn):
++        sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++        assert worker.export_once(TEST_DSN,client) is None
++>       setup_batch(conn)
++
++tests/test_archive_retention_recovery.py:167:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad8a5790>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++_______ test_periodic_cleanup_is_bounded_and_retains_pending_and_markers _______
++
++conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad765af0>
++
++    def test_periodic_cleanup_is_bounded_and_retains_pending_and_markers(conn):
++>       batch,_=setup_batch(conn)
++                ^^^^^^^^^^^^^^^^^
++
++tests/test_archive_retention_recovery.py:174:
++_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
++tests/test_archive_retention_recovery.py:35: in setup_batch
++    conn.commit()
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
++self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33086 user=postgres database=poller_lifecycle_test) at 0x7f88ad765af0>
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
++E               psycopg.errors.RaiseException: stale or foreign lifecycle claim
++E               CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 33 at RAISE
++
++.venv/lib/python3.12/site-packages/psycopg/_connection_base.py:487: RaiseException
++=========================== short test summary info ============================
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[seal]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[data]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[manifest]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[verify]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-rollback]
++FAILED tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-commit]
++FAILED tests/test_archive_retention_recovery.py::test_verify_ack_crosses_archive_horizon_then_explicit_replacement
++FAILED tests/test_archive_retention_recovery.py::test_corrupt_manifest_keeps_persisted_pending
++FAILED tests/test_archive_retention_recovery.py::test_flag_off_and_unvalidated_destination_never_touch_sdk
++FAILED tests/test_archive_retention_recovery.py::test_periodic_cleanup_is_bounded_and_retains_pending_and_markers
++10 failed in 5.76s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-collected.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-collected.txt
+new file mode 100644
+index 0000000..09f1a0c
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-collected.txt
+@@ -0,0 +1,63 @@
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[seal]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[data]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[manifest]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ambiguous]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[verify]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-rollback]
++tests/test_archive_retention_recovery.py::test_fresh_worker_connection_recovers_each_persisted_boundary[ack-commit]
++tests/test_archive_retention_recovery.py::test_verify_ack_crosses_archive_horizon_then_explicit_replacement[data]
++tests/test_archive_retention_recovery.py::test_verify_ack_crosses_archive_horizon_then_explicit_replacement[ack-rollback]
++tests/test_archive_retention_recovery.py::test_corrupt_manifest_keeps_persisted_pending
++tests/test_archive_retention_recovery.py::test_flag_off_and_unvalidated_destination_never_touch_sdk
++tests/test_archive_retention_recovery.py::test_periodic_cleanup_is_bounded_and_retains_pending_and_markers
++tests/test_archive_retention_recovery.py::test_quarantine_allows_unaffected_preclaimed_aggregate
++tests/test_archive_retention_recovery.py::test_new_small_batch_waits_then_flushes_without_network_transaction
++tests/test_archive_retention_recovery.py::test_task11_additive_migration_reapplies_without_catalog_drift
++tests/test_archive_export.py::test_conditional_exact_retry[new]
++tests/test_archive_export.py::test_conditional_exact_retry[existing]
++tests/test_archive_export.py::test_conditional_exact_retry[data-only]
++tests/test_archive_export.py::test_conditional_exact_retry[ambiguous]
++tests/test_archive_export.py::test_corrupt_existing_fails_closed[data]
++tests/test_archive_export.py::test_corrupt_existing_fails_closed[manifest]
++tests/test_archive_export.py::test_sdk_stubber_request_contract
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[oversize]
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[lying-length]
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[checksum]
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[read-error]
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[deadline]
++tests/test_archive_export.py::test_bounded_body_closed_for_all_read_failures[bomb]
++tests/test_archive_export.py::test_complete_seal_contract_before_upload[canonical_hash-0000000000000000000000000000000000000000000000000000000000000000]
++tests/test_archive_export.py::test_complete_seal_contract_before_upload[manifest_hash-0000000000000000000000000000000000000000000000000000000000000000]
++tests/test_archive_export.py::test_complete_seal_contract_before_upload[event_count-999]
++tests/test_archive_export.py::test_complete_seal_contract_before_upload[manifest_data-{}]
++tests/test_archive_export.py::test_non_412_errors_propagate_without_read
++tests/test_archive_export.py::test_explicit_sdk_configuration
++tests/test_archive_privacy.py::test_private_field_and_path_rejected_before_io
++tests/test_archive_privacy.py::test_invalid_service_prefix[../public]
++tests/test_archive_privacy.py::test_invalid_service_prefix[public//events]
++tests/test_archive_privacy.py::test_invalid_service_prefix[https://bucket]
++tests/test_archive_privacy.py::test_invalid_service_prefix[public?x=y]
++tests/test_archive_privacy.py::test_region_and_prefix_must_match
++tests/test_archive_privacy.py::test_worker_diagnostics_never_log_provider_body_or_url
++tests/test_lifecycle_supervisor.py::test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps
++tests/test_lifecycle_supervisor.py::test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts
++tests/test_lifecycle_supervisor.py::test_shutdown_has_one_global_30_second_drain_and_no_new_children
++tests/test_lifecycle_supervisor.py::test_spawn_failure_returns_nonzero_and_drains_started_sibling
++tests/test_lifecycle_supervisor.py::test_already_stopped_starts_nothing
++tests/test_lifecycle_supervisor.py::test_deployment_only_changes_reviewer_command
++tests/test_lifecycle_supervisor.py::test_real_children_deadline_and_terminated_external_cron
++tests/test_lifecycle_supervisor.py::test_worker_flag_off_closes_owned_connection
++tests/test_lifecycle_supervisor.py::test_worker_scheduled_sweep_and_normal_restart_generations
++tests/test_lifecycle_supervisor.py::test_worker_contended_claim_is_blocked_then_recovers_after_release
++tests/test_lifecycle_supervisor.py::test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs
++tests/test_lifecycle_supervisor.py::test_approved_timing_constants
++tests/test_lifecycle_supervisor.py::test_reviewer_drain_returns_when_review_is_stalled
++tests/test_lifecycle_supervisor.py::test_real_reviewer_sigterm_bounds_stalled_request[1]
++tests/test_lifecycle_supervisor.py::test_real_reviewer_sigterm_bounds_stalled_request[3]
++tests/test_lifecycle_supervisor.py::test_main_signal_stops_children_and_restart_runs_startup_again
++tests/test_lifecycle_supervisor.py::test_shutdown_does_not_extend_maintenance_90_second_deadline
++tests/test_lifecycle_supervisor.py::test_real_maintenance_sigterm_releases_connection_and_next_worker_recovers
++tests/test_lifecycle_supervisor.py::test_archive_ticks_and_deadline_are_independent
++tests/test_lifecycle_supervisor.py::test_archive_successful_children_run_every_sixty_seconds
++
++61 tests collected in 0.27s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-source-hashes.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-source-hashes.json
+new file mode 100644
+index 0000000..95c4d82
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/final-source-hashes.json
+@@ -0,0 +1,16 @@
++{
++  "job_discovery/archive/batches.py": "ec3b17f1cf76526ff22adcaf21648719ac6901479785e4cd4162a8d69dfd45d6",
++  "job_discovery/archive/s3.py": "24fa2a2fd6ea996208fb60c8ded22fed701f6c2c7862657235aa62431a295233",
++  "job_discovery/archive/export.py": "682506a6c506dd41aaa46dd1f01c60b569cb9f56b7676bafb3e6db7e30bc5a40",
++  "job_discovery/archive/recovery.py": "bbfafaf28950a3ee6351613a069c3b363b18a903ac9033c8e011d979b741a7ba",
++  "reviewer/archive_worker.py": "4c156013dfeece9edf6151c03d57309481712aa70009627bf8bf8ae1e21d1039",
++  "reviewer/supervisor.py": "53cfbc8f1f057853ab4e8da5eab74288358264d09d2ada6322a8bf0c3ee93e2e",
++  "tests/test_archive_export.py": "14271076b8925aea89368269f8e41883f9ab4df109cfd17925f1ef912f1ea536",
++  "tests/test_archive_privacy.py": "3fc8c7a19848c79522d21371ad49698fd19dc0bfb9fd4dca2ba175992aa8634f",
++  "tests/test_archive_retention_recovery.py": "0473744386ad567bf502c82554637ffd590d21544ec56294badc216f24295153",
++  "tests/test_lifecycle_supervisor.py": "adc9075feacd5e330f6bfc2d9d8730746e1138f42474c55b5ff95fc280c1d2ab",
++  "schema.sql": "067c9aef1c494e986af3efdf323ef8cb4ebaf29827522b12f674b8534b835328",
++  "migrations/2026-10-03-07-archive-export.sql": "f9b341f5a71421197d08c994d01b661648dfd006d824df08484bee78bcc56a93",
++  "requirements.txt": "4f77cc1deae8079f457f9ea5ff2e24286cb969177544d41e68f8ed9a34190c2a",
++  "pyproject.toml": "e7396bb84fdd2f4bb67e3dbcd7a4576e1350e1573c6409de323125b3efe90459"
++}
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/green-offline-initial.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/green-offline-initial.txt
+new file mode 100644
+index 0000000..1953bc2
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/green-offline-initial.txt
+@@ -0,0 +1,2 @@
++.............                                                            [100%]
++13 passed in 0.47s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources-tool-error.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources-tool-error.txt
+new file mode 100644
+index 0000000..527af18
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources-tool-error.txt
+@@ -0,0 +1 @@
++/bin/bash: line 3: /usr/bin/time: No such file or directory
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources.txt
+new file mode 100644
+index 0000000..d97017f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/import-resources.txt
+@@ -0,0 +1,6 @@
++{
++  "scope": "single offline archive_worker import, no worker run or network",
++  "wall_seconds": 0.35886838199803606,
++  "cpu_seconds": 0.35888361300000005,
++  "peak_rss_kib": 38212
++}
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/inventory.md
+new file mode 100644
+index 0000000..78c82ce
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/inventory.md
+@@ -0,0 +1,9 @@
++# Permitted execution inventory (recorded before execution)
++Only Task11 ordinary feature correctness: offline conditional S3 PUT/Get request shape with fake credentials and IMDS disabled; actual botocore 412 and ambiguous timeout, exact immutable retry bytes, bounded closed reads/checksums/decompression, public schema and service prefix/region validation. No bucket access/mutation or provider call.
++Owned random-loopback PostgreSQL17 and16: new exporter flag-off and flush behavior, persisted crash boundaries at claim/seal/data/manifest/verify/ack with discarded worker AND connection, pending retention and exact acknowledgement, explicit archive-eligibility-only test clock fixture, explicit persisted authorized replacement identity and old batch callback rejection, bounded seven-day terminal cleanup with durable markers. Ordinary supervisor exporter scheduling/deadline/drain and existing supervisor regression tests. No Task3 expiry/physical capacity/cross-user/security/activation/adversarial suites or probes; no broad pytest.
++
++Additional concrete cases before expanded execution: persisted ambiguous-success upload interrupted during its bounded read; atomic replacement rollback leaves unused authorization and exact old membership; replacement data-upload and ack-rollback crashes resume fresh worker/connection; a corrupt manifest is durably quarantined while a healthy preclaimed aggregate continues; new event flush waits until the 5-minute archive clock threshold; SDK exceptions log class only. Local clock changes affect only the service-private archive_clock() SQL function in the owned DB, not leases/capacity/roles.
++
++Migration integration verification is restricted to the exact new Task11 migration's reapplication/catalog consistency against clean schema; no old migration suite, mechanism checks, activation/RLS role calls or adversarial probes. Full branch historical migration parity remains Task13/controller work.
++
++Controller additionally authorized the single existing node tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations: owned frozen-schema bootstrap, ordered additive migrations and static catalog equality/reapplication. Run only this node on each owned major; exclude every sibling test. This supplies schema parity, not mechanism/security assurance.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/offline-supervisor-development.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/offline-supervisor-development.txt
+new file mode 100644
+index 0000000..5d2a5c9
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/offline-supervisor-development.txt
+@@ -0,0 +1,26 @@
++............................F............                                [100%]
++=================================== FAILURES ===================================
++_______ test_shutdown_has_one_global_30_second_drain_and_no_new_children _______
++
++monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f833deb0830>
++
++    def test_shutdown_has_one_global_30_second_drain_and_no_new_children(monkeypatch):
++        s = supervisor()
++        clock = Clock()
++        monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
++        children = []
++
++        def spawn(name):
++            child = Child(clock, ignores_term=True)
++            children.append(child)
++            return child
++
++        assert s.supervise(Stop(clock, 10), spawn, clock) == 0
++>       assert len(children) == 2
++E       assert 3 == 2
++E        +  where 3 = len([<tests.test_lifecycle_supervisor.Child object at 0x7f833deb06b0>, <tests.test_lifecycle_supervisor.Child object at 0x7f833d39fbf0>, <tests.test_lifecycle_supervisor.Child object at 0x7f833d39e060>])
++
++tests/test_lifecycle_supervisor.py:127: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_lifecycle_supervisor.py::test_shutdown_has_one_global_30_second_drain_and_no_new_children
++1 failed, 40 passed, 5 deselected in 4.46s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.txt
+new file mode 100644
+index 0000000..becbb7c
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-final.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++.............................................................            [100%]
++61 passed in 26.42s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.txt
+new file mode 100644
+index 0000000..3873271
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg16-migration-parity.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
++.                                                                        [100%]
++1 passed in 1.37s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.txt
+new file mode 100644
+index 0000000..8225c39
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-final.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.............................................................            [100%]
++61 passed in 21.87s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.txt
+new file mode 100644
+index 0000000..3eba801
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/pg17-migration-parity.txt
+@@ -0,0 +1,3 @@
++Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
++.                                                                        [100%]
++1 passed in 0.84s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/red-offline.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/red-offline.txt
+new file mode 100644
+index 0000000..73247d0
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/red-offline.txt
+@@ -0,0 +1,29 @@
++
++==================================== ERRORS ====================================
++________________ ERROR collecting tests/test_archive_export.py _________________
++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_export.py'.
++Hint: make sure your test modules/packages have valid Python names.
++Traceback:
++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
++    return _bootstrap._gcd_import(name[level:], package, level)
++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++tests/test_archive_export.py:7: in <module>
++    from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
++E   ModuleNotFoundError: No module named 'job_discovery.archive.s3'
++________________ ERROR collecting tests/test_archive_privacy.py ________________
++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_privacy.py'.
++Hint: make sure your test modules/packages have valid Python names.
++Traceback:
++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
++    return _bootstrap._gcd_import(name[level:], package, level)
++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++tests/test_archive_privacy.py:4: in <module>
++    from tests.test_archive_export import sealed, destination, FakeS3
++tests/test_archive_export.py:7: in <module>
++    from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
++E   ModuleNotFoundError: No module named 'job_discovery.archive.s3'
++=========================== short test summary info ============================
++ERROR tests/test_archive_export.py
++ERROR tests/test_archive_privacy.py
++!!!!!!!!!!!!!!!!!!! Interrupted: 2 errors during collection !!!!!!!!!!!!!!!!!!!!
++2 errors in 0.26s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-final.txt
+new file mode 100644
+index 0000000..1f5f344
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-final.txt
+@@ -0,0 +1 @@
++All checks passed!
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-initial.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-initial.txt
+new file mode 100644
+index 0000000..3dfd9cf
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/ruff-initial.txt
+@@ -0,0 +1,941 @@
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/export.py:23:15
++   |
++21 |         WHERE singleton AND validated_at<=clock_timestamp() AND private_validated AND encryption_validated
++22 |         AND policy_validated AND length(validation_evidence)>0''').fetchone()
++23 |     if not row: raise ArchiveBlocked('archive destination validation required')
++   |               ^
++24 |     try:
++25 |         return Destination(**row)
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> job_discovery/archive/export.py:49:26
++   |
++47 |         control=read_control(conn)
++48 |         if not control.archive_ever_activated:
++49 |             conn.commit(); return None
++   |                          ^
++50 |         claim=claim_work(conn,'archive-export','singleton',LEASE_SECONDS)
++51 |         conn.commit()
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/export.py:52:25
++   |
++50 |         claim=claim_work(conn,'archive-export','singleton',LEASE_SECONDS)
++51 |         conn.commit()
++52 |         if claim is None: return None
++   |                         ^
++53 |         # Scheduled even during export pause; never visits pending payloads.
++54 |         cleanup_terminal(conn,claim)
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> job_discovery/archive/export.py:59:26
++   |
++57 |         control=read_control(conn)
++58 |         if not control.export_enabled:
++59 |             conn.commit(); return None
++   |                          ^
++60 |         destination=read_destination(conn)
++61 |         if client is not None and client.destination!=destination:
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/export.py:64:19
++   |
++62 | …         raise ArchiveBlocked('archive client differs from validated destination')
++63 | …     expired=conn.execute("SELECT 1 FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until<=lifecycle_pri…
++64 | …     if expired: log.warning('archive retention action needed; pending events retained')
++   |                 ^
++65 | …     row=conn.execute("SELECT batch_id FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until>lifecycle_p…
++66 | …     if row:
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/export.py:77:23
++   |
++75 | …         ref=claim_batch(conn,limits,claim) if ready['n']>=limits.max_events or ready['bytes']>=limits.max_expanded_bytes or ready['a…
++76 | …     conn.commit()
++77 | …     if ref is None: return None
++   |                     ^
++78 | …     seal=seal_batch(ref)
++79 | …     persist_seal(conn,seal)
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/export.py:85:26
++   |
++83 |         renew_claim(conn,claim,LEASE_SECONDS)
++84 |         conn.commit()
++85 |         if client is None: client=ArchiveClient.from_destination(destination)
++   |                          ^
++86 |         verified=put_verify_batch(seal,client)
++87 |         result=ack_batch(conn,verified,claim)
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/recovery.py:42:27
++   |
++40 |     _processing_capacity(tx,ref.event_bytes)
++41 |     reservation=reserve_capacity(tx,claim,65536+sum(map(len,ref.event_bytes))*4)
++42 |     if reservation is None: raise ArchiveBlocked('physical replacement capacity unavailable')
++   |                           ^
++43 |     bind_reservation(tx,reservation,job_id=None,scope='public_archive_batches')
++44 |     new_id=uuid4()
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> job_discovery/archive/s3.py:91:22
++   |
++89 |             if type(size) is not int or not 0 <= size <= limit:
++90 |                 raise ValueError('archive object exceeds declared bound')
++91 |             chunks=[]; total=0
++   |                      ^
++92 |             while True:
++93 |                 if time.monotonic() >= deadline:
++   |
++
++E701 Multiple statements on one line (colon)
++  --> job_discovery/archive/s3.py:96:29
++   |
++94 |                     raise TimeoutError('archive verification deadline')
++95 |                 chunk=body.read(min(65536,limit-total+1))
++96 |                 if not chunk: break
++   |                             ^
++97 |                 total+=len(chunk)
++98 |                 if total>limit: raise ValueError('archive object exceeds read bound')
++   |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:98:31
++    |
++ 96 |                 if not chunk: break
++ 97 |                 total+=len(chunk)
++ 98 |                 if total>limit: raise ValueError('archive object exceeds read bound')
++    |                               ^
++ 99 |                 chunks.append(chunk)
++100 |             data=b''.join(chunks)
++    |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:101:31
++    |
++ 99 |                 chunks.append(chunk)
++100 |             data=b''.join(chunks)
++101 |             if len(data)!=size: raise ValueError('archive object length differs')
++    |                               ^
++102 |             digest=hashlib.sha256(data).digest()
++103 |             checksum=response.get('ChecksumSHA256')
++    |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:131:52
++    |
++129 |         for key in ('occurred_at','observed_at','recorded_at'):
++130 |             value=event[key]
++131 |             if value is None and key=='observed_at': continue
++    |                                                    ^
++132 |             if not isinstance(value,str) or datetime.fromisoformat(value).tzinfo is None:
++133 |                 raise ValueError('invalid public event time')
++    |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:136:38
++    |
++134 |         validate_change(PublicChange(AggregateType(event['aggregate_type']),event['aggregate_id'],
++135 |             ChangeKind(event['kind']),event['body'],datetime.fromisoformat(event['occurred_at'])))
++136 |         if canonical_json(event)!=raw: raise ValueError('noncanonical public event')
++    |                                      ^
++    |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:152:34
++    |
++150 |     archive_client.conditional_put(seal.data_key,seal.compressed_data)
++151 |     data,data_receipt=archive_client.bounded_read(seal.data_key,min(MAX_COMPRESSED,seal.compressed_bytes),deadline)
++152 |     if data!=seal.compressed_data: raise ValueError('archive data differs')
++    |                                  ^
++153 |     with gzip.GzipFile(fileobj=io.BytesIO(data),mode='rb') as stream:
++154 |         expanded=stream.read(MAX_EXPANDED+1)
++    |
++
++E701 Multiple statements on one line (colon)
++   --> job_discovery/archive/s3.py:159:36
++    |
++157 |     archive_client.conditional_put(seal.manifest_key,seal.manifest_data)
++158 |     manifest,manifest_receipt=archive_client.bounded_read(seal.manifest_key,min(MAX_MANIFEST,seal.manifest_bytes),deadline)
++159 |     if manifest!=seal.manifest_data: raise ValueError('archive manifest differs')
++    |                                    ^
++160 |     return VerifiedBatch(seal,data_receipt,manifest_receipt)
++    |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:40:26
++   |
++38 | class FakeS3:
++39 |     def __init__(self):
++40 |         self.objects = {}; self.calls = []; self.bodies = []; self.ambiguous = False
++   |                          ^
++41 |         self.meta = type('Meta', (), {'region_name':'us-east-1'})()
++42 |     def put_object(self, **kwargs):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:40:43
++   |
++38 | class FakeS3:
++39 |     def __init__(self):
++40 |         self.objects = {}; self.calls = []; self.bodies = []; self.ambiguous = False
++   |                                           ^
++41 |         self.meta = type('Meta', (), {'region_name':'us-east-1'})()
++42 |     def put_object(self, **kwargs):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:40:61
++   |
++38 | class FakeS3:
++39 |     def __init__(self):
++40 |         self.objects = {}; self.calls = []; self.bodies = []; self.ambiguous = False
++   |                                                             ^
++41 |         self.meta = type('Meta', (), {'region_name':'us-east-1'})()
++42 |     def put_object(self, **kwargs):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:58:45
++   |
++56 |         if key not in self.objects:
++57 |             raise ClientError({'Error':{'Code':'NoSuchKey'},'ResponseMetadata':{'HTTPStatusCode':404}}, 'GetObject')
++58 |         body = io.BytesIO(self.objects[key]); self.bodies.append(body)
++   |                                             ^
++59 |         return {'Body':body,'ContentLength':len(self.objects[key]),'VersionId':'offline-version'}
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:64:20
++   |
++62 | @pytest.mark.parametrize('mode', ['new','existing','data-only','ambiguous'])
++63 | def test_conditional_exact_retry(mode):
++64 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(), sdk)
++   |                    ^
++65 |     if mode in {'existing','data-only'}: sdk.objects[seal.data_key] = seal.compressed_data
++66 |     if mode == 'existing': sdk.objects[seal.manifest_key] = seal.manifest_data
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:64:36
++   |
++62 | @pytest.mark.parametrize('mode', ['new','existing','data-only','ambiguous'])
++63 | def test_conditional_exact_retry(mode):
++64 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(), sdk)
++   |                                    ^
++65 |     if mode in {'existing','data-only'}: sdk.objects[seal.data_key] = seal.compressed_data
++66 |     if mode == 'existing': sdk.objects[seal.manifest_key] = seal.manifest_data
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_export.py:65:40
++   |
++63 | def test_conditional_exact_retry(mode):
++64 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(), sdk)
++65 |     if mode in {'existing','data-only'}: sdk.objects[seal.data_key] = seal.compressed_data
++   |                                        ^
++66 |     if mode == 'existing': sdk.objects[seal.manifest_key] = seal.manifest_data
++67 |     sdk.ambiguous = mode == 'ambiguous'
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_export.py:66:26
++   |
++64 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(), sdk)
++65 |     if mode in {'existing','data-only'}: sdk.objects[seal.data_key] = seal.compressed_data
++66 |     if mode == 'existing': sdk.objects[seal.manifest_key] = seal.manifest_data
++   |                          ^
++67 |     sdk.ambiguous = mode == 'ambiguous'
++68 |     verified = put_verify_batch(seal, client)
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:77:20
++   |
++75 | @pytest.mark.parametrize('which', ['data','manifest'])
++76 | def test_corrupt_existing_fails_closed(which):
++77 |     seal = sealed(); sdk = FakeS3()
++   |                    ^
++78 |     sdk.objects[getattr(seal, which+'_key')] = b'corrupt'
++79 |     with pytest.raises(ValueError): put_verify_batch(seal, ArchiveClient(destination(),sdk))
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_export.py:79:35
++   |
++77 |     seal = sealed(); sdk = FakeS3()
++78 |     sdk.objects[getattr(seal, which+'_key')] = b'corrupt'
++79 |     with pytest.raises(ValueError): put_verify_batch(seal, ArchiveClient(destination(),sdk))
++   |                                   ^
++80 |     assert all(b.closed for b in sdk.bodies)
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_export.py:87:47
++   |
++85 |     from botocore.stub import Stubber
++86 |     sdk = boto3.client('s3', region_name='us-east-1', aws_access_key_id='fake', aws_secret_access_key='fake')
++87 |     client = ArchiveClient(destination(), sdk); seal = sealed()
++   |                                               ^
++88 |     with Stubber(sdk) as stub:
++89 |         for key, data in [(seal.data_key,seal.compressed_data),(seal.manifest_key,seal.manifest_data)]:
++   |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_export.py:102:18
++    |
++100 |     import gzip
++101 |     import time
++102 |     seal=sealed();sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |                  ^
++103 |     raw=gzip.compress(b'x'*(8*1024**2+1)) if case=='bomb' else b'abc'
++104 |     class Body(io.BytesIO):
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_export.py:102:31
++    |
++100 |     import gzip
++101 |     import time
++102 |     seal=sealed();sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |                               ^
++103 |     raw=gzip.compress(b'x'*(8*1024**2+1)) if case=='bomb' else b'abc'
++104 |     class Body(io.BytesIO):
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:107:34
++    |
++105 |         def read(self,n=-1):
++106 |             assert n>0
++107 |             if case=='read-error':raise OSError('offline read failure')
++    |                                  ^
++108 |             return super().read(n)
++109 |     body=Body(raw)
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:111:24
++    |
++109 |     body=Body(raw)
++110 |     response={'Body':body,'ContentLength':len(raw)}
++111 |     if case=='oversize':response['ContentLength']=17*1024**2
++    |                        ^
++112 |     if case=='lying-length':response['ContentLength']=1
++113 |     if case=='checksum':response['ChecksumSHA256']='incorrect'
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:112:28
++    |
++110 |     response={'Body':body,'ContentLength':len(raw)}
++111 |     if case=='oversize':response['ContentLength']=17*1024**2
++112 |     if case=='lying-length':response['ContentLength']=1
++    |                            ^
++113 |     if case=='checksum':response['ChecksumSHA256']='incorrect'
++114 |     def get(**kw):return response
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:113:24
++    |
++111 |     if case=='oversize':response['ContentLength']=17*1024**2
++112 |     if case=='lying-length':response['ContentLength']=1
++113 |     if case=='checksum':response['ChecksumSHA256']='incorrect'
++    |                        ^
++114 |     def get(**kw):return response
++115 |     sdk.get_object=get
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:121:45
++    |
++119 |         from unittest.mock import patch
++120 |         with patch('job_discovery.archive.s3.time.monotonic',side_effect=lambda:next(calls)):
++121 |             with pytest.raises(TimeoutError):client.bounded_read(seal.data_key,10,1)
++    |                                             ^
++122 |     else:
++123 |         with pytest.raises((ValueError,OSError)):
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:132:35
++    |
++130 |     from dataclasses import replace
++131 |     sdk=FakeS3()
++132 |     with pytest.raises(ValueError):put_verify_batch(replace(sealed(),**{field:value}),ArchiveClient(destination(),sdk))
++    |                                   ^
++133 |     assert not sdk.calls
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_export.py:137:17
++    |
++136 | def test_non_412_errors_propagate_without_read():
++137 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |                 ^
++138 |     def denied(**kw):raise ClientError({'Error':{'Code':'AccessDenied'},'ResponseMetadata':{'HTTPStatusCode':403}},'PutObject')
++139 |     sdk.put_object=denied
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_export.py:140:36
++    |
++138 |     def denied(**kw):raise ClientError({'Error':{'Code':'AccessDenied'},'ResponseMetadata':{'HTTPStatusCode':403}},'PutObject')
++139 |     sdk.put_object=denied
++140 |     with pytest.raises(ClientError):put_verify_batch(sealed(),client)
++    |                                    ^
++141 |     assert not sdk.bodies
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_export.py:148:64
++    |
++146 |     captured={}
++147 |     class Session:
++148 |         def client(self,*args,**kwargs):captured.update(kwargs);return FakeS3()
++    |                                                                ^
++149 |     monkeypatch.setattr(module.boto3.session,'Session',lambda **kw:Session())
++150 |     ArchiveClient.from_destination(destination())
++    |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_privacy.py:12:20
++   |
++11 | def test_private_field_and_path_rejected_before_io(caplog):
++12 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(),sdk)
++   |                    ^
++13 |     event = json.loads(seal.batch.event_bytes[0]); event['body']['private_notes'] = 'private-sentinel'
++14 |     bad = seal_batch(replace(seal.batch,event_bytes=(canonical_json(event),)))
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_privacy.py:12:36
++   |
++11 | def test_private_field_and_path_rejected_before_io(caplog):
++12 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(),sdk)
++   |                                    ^
++13 |     event = json.loads(seal.batch.event_bytes[0]); event['body']['private_notes'] = 'private-sentinel'
++14 |     bad = seal_batch(replace(seal.batch,event_bytes=(canonical_json(event),)))
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_privacy.py:13:50
++   |
++11 | def test_private_field_and_path_rejected_before_io(caplog):
++12 |     seal = sealed(); sdk = FakeS3(); client = ArchiveClient(destination(),sdk)
++13 |     event = json.loads(seal.batch.event_bytes[0]); event['body']['private_notes'] = 'private-sentinel'
++   |                                                  ^
++14 |     bad = seal_batch(replace(seal.batch,event_bytes=(canonical_json(event),)))
++15 |     with pytest.raises(ValueError): put_verify_batch(bad,client)
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_privacy.py:15:35
++   |
++13 |     event = json.loads(seal.batch.event_bytes[0]); event['body']['private_notes'] = 'private-sentinel'
++14 |     bad = seal_batch(replace(seal.batch,event_bytes=(canonical_json(event),)))
++15 |     with pytest.raises(ValueError): put_verify_batch(bad,client)
++   |                                   ^
++16 |     with pytest.raises(ValueError): put_verify_batch(replace(seal,data_key='../private'),client)
++17 |     assert not sdk.calls
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_privacy.py:16:35
++   |
++14 |     bad = seal_batch(replace(seal.batch,event_bytes=(canonical_json(event),)))
++15 |     with pytest.raises(ValueError): put_verify_batch(bad,client)
++16 |     with pytest.raises(ValueError): put_verify_batch(replace(seal,data_key='../private'),client)
++   |                                   ^
++17 |     assert not sdk.calls
++18 |     assert 'private-sentinel' not in caplog.text
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_privacy.py:23:35
++   |
++21 | @pytest.mark.parametrize('prefix', ['../public','public//events','https://bucket','public?x=y'])
++22 | def test_invalid_service_prefix(prefix):
++23 |     with pytest.raises(ValueError): Destination('fixture-bucket','us-east-1',prefix,'123456789012')
++   |                                   ^
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_privacy.py:27:17
++   |
++26 | def test_region_and_prefix_must_match():
++27 |     sdk=FakeS3(); sdk.meta.region_name='eu-west-1'
++   |                 ^
++28 |     with pytest.raises(ValueError): ArchiveClient(destination(),sdk)
++29 |     with pytest.raises(ValueError): put_verify_batch(sealed(),ArchiveClient(replace(destination(),object_prefix='other'),FakeS3()))
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_privacy.py:28:35
++   |
++26 | def test_region_and_prefix_must_match():
++27 |     sdk=FakeS3(); sdk.meta.region_name='eu-west-1'
++28 |     with pytest.raises(ValueError): ArchiveClient(destination(),sdk)
++   |                                   ^
++29 |     with pytest.raises(ValueError): put_verify_batch(sealed(),ArchiveClient(replace(destination(),object_prefix='other'),FakeS3()))
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_privacy.py:29:35
++   |
++27 |     sdk=FakeS3(); sdk.meta.region_name='eu-west-1'
++28 |     with pytest.raises(ValueError): ArchiveClient(destination(),sdk)
++29 |     with pytest.raises(ValueError): put_verify_batch(sealed(),ArchiveClient(replace(destination(),object_prefix='other'),FakeS3()))
++   |                                   ^
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:44:18
++   |
++42 |     result=tuple((r['event_id'],bytes(r['canonical_event']),r['occurred_at'],json.loads(bytes(r['canonical_event']))['observed_at'],r[…
++43 |         for r in conn.execute('SELECT * FROM public_pending_events ORDER BY event_id'))
++44 |     conn.commit();return result
++   |                  ^
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:47:27
++   |
++47 | class Crash(BaseException): pass
++   |                           ^
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:54:17
++   |
++52 |     batch,refs=setup_batch(conn)
++53 |     original_pending=pending(conn)
++54 |     sdk=FakeS3(); client=ArchiveClient(destination(),sdk)
++   |                 ^
++55 |     opened=[]; original_connect=db.connect
++56 |     def connect(dsn):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:55:14
++   |
++53 |     original_pending=pending(conn)
++54 |     sdk=FakeS3(); client=ArchiveClient(destination(),sdk)
++55 |     opened=[]; original_connect=db.connect
++   |              ^
++56 |     def connect(dsn):
++57 |         fresh=original_connect(dsn);opened.append(fresh);return fresh
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:57:36
++   |
++55 |     opened=[]; original_connect=db.connect
++56 |     def connect(dsn):
++57 |         fresh=original_connect(dsn);opened.append(fresh);return fresh
++   |                                    ^
++58 |     monkeypatch.setattr(worker.db,'connect',connect)
++59 |     original_seal=worker.persist_seal;original_verify=worker.put_verify_batch;original_ack=worker.ack_batch
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:57:57
++   |
++55 |     opened=[]; original_connect=db.connect
++56 |     def connect(dsn):
++57 |         fresh=original_connect(dsn);opened.append(fresh);return fresh
++   |                                                         ^
++58 |     monkeypatch.setattr(worker.db,'connect',connect)
++59 |     original_seal=worker.persist_seal;original_verify=worker.put_verify_batch;original_ack=worker.ack_batch
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:59:38
++   |
++57 |         fresh=original_connect(dsn);opened.append(fresh);return fresh
++58 |     monkeypatch.setattr(worker.db,'connect',connect)
++59 |     original_seal=worker.persist_seal;original_verify=worker.put_verify_batch;original_ack=worker.ack_batch
++   |                                      ^
++60 |     if phase=='seal':
++61 |         def crash_seal(c,s):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:59:78
++   |
++57 |         fresh=original_connect(dsn);opened.append(fresh);return fresh
++58 |     monkeypatch.setattr(worker.db,'connect',connect)
++59 |     original_seal=worker.persist_seal;original_verify=worker.put_verify_batch;original_ack=worker.ack_batch
++   |                                                                              ^
++60 |     if phase=='seal':
++61 |         def crash_seal(c,s):
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:62:31
++   |
++60 |     if phase=='seal':
++61 |         def crash_seal(c,s):
++62 |             original_seal(c,s);c.commit();raise Crash()
++   |                               ^
++63 |         monkeypatch.setattr(worker,'persist_seal',crash_seal)
++64 |     elif phase in {'data','manifest'}:
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:62:42
++   |
++60 |     if phase=='seal':
++61 |         def crash_seal(c,s):
++62 |             original_seal(c,s);c.commit();raise Crash()
++   |                                          ^
++63 |         monkeypatch.setattr(worker,'persist_seal',crash_seal)
++64 |     elif phase in {'data','manifest'}:
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:68:86
++   |
++66 |         def crash_put(**kw):
++67 |             original_put(**kw)
++68 |             if kw['Key'].endswith('.jsonl.gz' if phase=='data' else '.manifest.json'): raise Crash()
++   |                                                                                      ^
++69 |         monkeypatch.setattr(sdk,'put_object',crash_put)
++70 |     elif phase=='verify':
++   |
++
++E702 Multiple statements on one line (semicolon)
++  --> tests/test_archive_retention_recovery.py:71:52
++   |
++69 |         monkeypatch.setattr(sdk,'put_object',crash_put)
++70 |     elif phase=='verify':
++71 |         def crash_verify(s,c): original_verify(s,c);raise Crash()
++   |                                                    ^
++72 |         monkeypatch.setattr(worker,'put_verify_batch',crash_verify)
++73 |     else:
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:76:35
++   |
++74 |         def crash_ack(c,v,cl):
++75 |             original_ack(c,v,cl)
++76 |             if phase=='ack-commit':c.commit()
++   |                                   ^
++77 |             raise Crash()
++78 |         monkeypatch.setattr(worker,'ack_batch',crash_ack)
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:79:30
++   |
++77 |             raise Crash()
++78 |         monkeypatch.setattr(worker,'ack_batch',crash_ack)
++79 |     with pytest.raises(Crash):worker.export_once(TEST_DSN,client)
++   |                              ^
++80 |     assert len(opened)==1 and opened[0].closed
++81 |     state=conn.execute('SELECT * FROM public_archive_batches WHERE batch_id=%s',(batch.batch_id,)).fetchone()
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:85:27
++   |
++83 |     old_claim=replace(batch.claim,owner_token=state['owner_token'],generation=state['generation'])
++84 |     before_retry=dict(sdk.objects)
++85 |     if phase!='ack-commit':assert pending(conn)==original_pending
++   |                           ^
++86 |     # Discard the first worker/client AND connection; immutable object storage persists.
++87 |     monkeypatch.setattr(worker,'persist_seal',original_seal)
++   |
++
++E701 Multiple statements on one line (colon)
++  --> tests/test_archive_retention_recovery.py:94:27
++   |
++92 |     result=worker.export_once(TEST_DSN,fresh_client)
++93 |     assert len(opened)==2 and opened[1].closed and opened[0] is not opened[1]
++94 |     if phase!='ack-commit':assert result.exact_event_ids==batch.ordered_event_ids
++   |                           ^
++95 |     assert all(sdk.objects[k]==v for k,v in before_retry.items())
++96 |     assert {r[0] for r in pending(conn)}=={r.event_id for r in refs}-set(batch.ordered_event_ids)
++   |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:114:49
++    |
++112 |     batch,refs=setup_batch(conn)
++113 |     claim=claim_work(conn,'archive-export','singleton',180)
++114 |     ref=recover_batch(conn,batch.batch_id,claim);conn.commit()
++    |                                                 ^
++115 |     seal=seal_batch(ref);persist_seal(conn,seal);conn.commit()
++116 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:115:25
++    |
++113 |     claim=claim_work(conn,'archive-export','singleton',180)
++114 |     ref=recover_batch(conn,batch.batch_id,claim);conn.commit()
++115 |     seal=seal_batch(ref);persist_seal(conn,seal);conn.commit()
++    |                         ^
++116 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++117 |     verified=put_verify_batch(seal,client)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:115:49
++    |
++113 |     claim=claim_work(conn,'archive-export','singleton',180)
++114 |     ref=recover_batch(conn,batch.batch_id,claim);conn.commit()
++115 |     seal=seal_batch(ref);persist_seal(conn,seal);conn.commit()
++    |                                                 ^
++116 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++117 |     verified=put_verify_batch(seal,client)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:116:17
++    |
++114 |     ref=recover_batch(conn,batch.batch_id,claim);conn.commit()
++115 |     seal=seal_batch(ref);persist_seal(conn,seal);conn.commit()
++116 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |                 ^
++117 |     verified=put_verify_batch(seal,client)
++118 |     original=pending(conn)
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_retention_recovery.py:120:74
++    |
++118 |     original=pending(conn)
++119 |     set_archive_clock(conn,ref.eligible_until+timedelta(seconds=1))
++120 |     with pytest.raises(ArchiveBlocked,match='expired'),conn.transaction():ack_batch(conn,verified,claim)
++    |                                                                          ^
++121 |     with pytest.raises(ArchiveBlocked,match='authorization'),conn.transaction():
++122 |         replace_expired_batch(conn,ref.batch_id,claim,RecoveryAuthorization(uuid4()))
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:124:29
++    |
++122 |         replace_expired_batch(conn,ref.batch_id,claim,RecoveryAuthorization(uuid4()))
++123 |     assert pending(conn)==original
++124 |     cancel_claim(conn,claim);conn.commit()
++    |                             ^
++125 |     before=len(sdk.calls)
++126 |     assert worker.export_once(TEST_DSN,ArchiveClient(destination(),sdk)) is None
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:143:38
++    |
++141 |         assert replacement.sealed_at>ref.eligible_until
++142 |         assert replacement.eligible_until-replacement.sealed_at==timedelta(days=730)
++143 |         cancel_claim(fresh,new_claim);fresh.commit()
++    |                                      ^
++144 |     finally:fresh.close()
++145 |     assert pending(conn)==original
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_retention_recovery.py:144:12
++    |
++142 |         assert replacement.eligible_until-replacement.sealed_at==timedelta(days=730)
++143 |         cancel_claim(fresh,new_claim);fresh.commit()
++144 |     finally:fresh.close()
++    |            ^
++145 |     assert pending(conn)==original
++146 |     with pytest.raises((ArchiveBlocked,RuntimeError)),conn.transaction():ack_batch(conn,verified,claim)
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_retention_recovery.py:146:73
++    |
++144 |     finally:fresh.close()
++145 |     assert pending(conn)==original
++146 |     with pytest.raises((ArchiveBlocked,RuntimeError)),conn.transaction():ack_batch(conn,verified,claim)
++    |                                                                         ^
++147 |     assert worker.export_once(TEST_DSN,ArchiveClient(destination(),sdk)).exact_event_ids==ref.ordered_event_ids
++148 |     assert sdk.objects[seal.data_key]==seal.compressed_data
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:157:27
++    |
++155 | def test_corrupt_manifest_keeps_persisted_pending(conn):
++156 |     batch,_=setup_batch(conn)
++157 |     seal=seal_batch(batch);sdk=FakeS3();sdk.objects[seal.manifest_key]=b'corrupt'
++    |                           ^
++158 |     before=pending(conn)
++159 |     with pytest.raises(ValueError):worker.export_once(TEST_DSN,ArchiveClient(destination(),sdk))
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:157:40
++    |
++155 | def test_corrupt_manifest_keeps_persisted_pending(conn):
++156 |     batch,_=setup_batch(conn)
++157 |     seal=seal_batch(batch);sdk=FakeS3();sdk.objects[seal.manifest_key]=b'corrupt'
++    |                                        ^
++158 |     before=pending(conn)
++159 |     with pytest.raises(ValueError):worker.export_once(TEST_DSN,ArchiveClient(destination(),sdk))
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_retention_recovery.py:159:35
++    |
++157 |     seal=seal_batch(batch);sdk=FakeS3();sdk.objects[seal.manifest_key]=b'corrupt'
++158 |     before=pending(conn)
++159 |     with pytest.raises(ValueError):worker.export_once(TEST_DSN,ArchiveClient(destination(),sdk))
++    |                                   ^
++160 |     assert pending(conn)==before
++161 |     calls=len(sdk.calls)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:170:17
++    |
++169 | def test_flag_off_and_unvalidated_destination_never_touch_sdk(conn):
++170 |     sdk=FakeS3();client=ArchiveClient(destination(),sdk)
++    |                 ^
++171 |     assert worker.export_once(TEST_DSN,client) is None
++172 |     setup_batch(conn)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:173:82
++    |
++171 |     assert worker.export_once(TEST_DSN,client) is None
++172 |     setup_batch(conn)
++173 |     conn.execute('UPDATE public_archive_destination SET private_validated=false');conn.commit()
++    |                                                                                  ^
++174 |     with pytest.raises(ArchiveBlocked,match='validation'):worker.export_once(TEST_DSN,client)
++175 |     assert not sdk.calls
++    |
++
++E701 Multiple statements on one line (colon)
++   --> tests/test_archive_retention_recovery.py:174:58
++    |
++172 |     setup_batch(conn)
++173 |     conn.execute('UPDATE public_archive_destination SET private_validated=false');conn.commit()
++174 |     with pytest.raises(ArchiveBlocked,match='validation'):worker.export_once(TEST_DSN,client)
++    |                                                          ^
++175 |     assert not sdk.calls
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:184:94
++    |
++182 |     conn.execute('ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable')
++183 |     conn.execute("UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'")
++184 |     conn.execute('ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable');conn.commit()
++    |                                                                                              ^
++185 |     claim=claim_work(conn,'archive-export','cleanup-fixture',180);conn.commit()
++186 |     for _ in range(4):
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:185:66
++    |
++183 |     conn.execute("UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'")
++184 |     conn.execute('ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable');conn.commit()
++185 |     claim=claim_work(conn,'archive-export','cleanup-fixture',180);conn.commit()
++    |                                                                  ^
++186 |     for _ in range(4):
++187 |         assert worker.cleanup_terminal(conn,claim,limit=1)==1;conn.commit()
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:187:62
++    |
++185 |     claim=claim_work(conn,'archive-export','cleanup-fixture',180);conn.commit()
++186 |     for _ in range(4):
++187 |         assert worker.cleanup_terminal(conn,claim,limit=1)==1;conn.commit()
++    |                                                              ^
++188 |     assert worker.cleanup_terminal(conn,claim,limit=1)==0;conn.commit()
++189 |     assert pending(conn)==before
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_archive_retention_recovery.py:188:58
++    |
++186 |     for _ in range(4):
++187 |         assert worker.cleanup_terminal(conn,claim,limit=1)==1;conn.commit()
++188 |     assert worker.cleanup_terminal(conn,claim,limit=1)==0;conn.commit()
++    |                                                          ^
++189 |     assert pending(conn)==before
++190 |     assert conn.execute('SELECT count(*) n FROM public_archive_coverage').fetchone()['n']==2
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:414:19
++    |
++413 | def test_archive_ticks_and_deadline_are_independent(monkeypatch):
++414 |     s=supervisor();clock=Clock();children=[]
++    |                   ^
++415 |     monkeypatch.setattr(s.time,'sleep',lambda delay:setattr(clock,'now',clock.now+delay))
++416 |     def spawn(name):
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:414:33
++    |
++413 | def test_archive_ticks_and_deadline_are_independent(monkeypatch):
++414 |     s=supervisor();clock=Clock();children=[]
++    |                                 ^
++415 |     monkeypatch.setattr(s.time,'sleep',lambda delay:setattr(clock,'now',clock.now+delay))
++416 |     def spawn(name):
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:418:38
++    |
++416 |     def spawn(name):
++417 |         child=Child(clock,duration=1 if name=='maintenance' else None,ignores_term=True)
++418 |         children.append((name,child));return child
++    |                                      ^
++419 |     assert s.supervise(Stop(clock,190),spawn,clock)==0
++420 |     archive=[c for name,c in children if name=='archive']
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:428:19
++    |
++427 | def test_archive_successful_children_run_every_sixty_seconds():
++428 |     s=supervisor();clock=Clock();children=[]
++    |                   ^
++429 |     def spawn(name):
++430 |         child=Child(clock,duration=1 if name in {'archive','maintenance'} else None)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:428:33
++    |
++427 | def test_archive_successful_children_run_every_sixty_seconds():
++428 |     s=supervisor();clock=Clock();children=[]
++    |                                 ^
++429 |     def spawn(name):
++430 |         child=Child(clock,duration=1 if name in {'archive','maintenance'} else None)
++    |
++
++E702 Multiple statements on one line (semicolon)
++   --> tests/test_lifecycle_supervisor.py:431:38
++    |
++429 |     def spawn(name):
++430 |         child=Child(clock,duration=1 if name in {'archive','maintenance'} else None)
++431 |         children.append((name,child));return child
++    |                                      ^
++432 |     assert s.supervise(Stop(clock,185),spawn,clock)==0
++433 |     assert [c.started for name,c in children if name=='archive']==[0,60,120,180]
++    |
++
++Found 88 errors.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/source-commit.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/source-commit.txt
+new file mode 100644
+index 0000000..447863b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/source-commit.txt
+@@ -0,0 +1 @@
++7411eb34187bf2b7956472c186670660611e2f26
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/versions.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/versions.json
+new file mode 100644
+index 0000000..6688135
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-evidence/versions.json
+@@ -0,0 +1,10 @@
++{
++  "python": "3.12.14",
++  "boto3": "1.42.74",
++  "botocore": "1.42.97",
++  "psycopg": "3.3.6",
++  "pytest": "9.1.1",
++  "ruff": "0.15.20",
++  "base": "58180c0b4b85860d33813509abe7d3054648816f",
++  "images": "postgres:16 275447c94b11\npostgres:17 327daa8fae71"
++}
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md
+new file mode 100644
+index 0000000..fc682a2
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-report.md
+@@ -0,0 +1,52 @@
++# Task11 author report — bounded immutable archive exporter
++
++Status: implemented and locally verified; independent permitted requirements/code-quality review is pending controller dispatch. This is not security approval or destination readiness. Work started from `58180c0b4b85860d33813509abe7d3054648816f`, preserving accepted Task10 source872a9844/report51d1000 and its checkpoint. Source commit: 7411eb34187bf2b7956472c186670660611e2f26.
++
++## Implemented contract
++
++- `job_discovery/archive/s3.py`: fixed validated destination (bucket/region/prefix/expected owner), reusable boto3 client, explicit3s connect/5s read timeouts, standard2-attempt policy, connection pool2, ignored ambient endpoint overrides. Conditional PutObject uses `IfNoneMatch='*'`, SHA256 and SSE-S3; no DeleteObject, HEAD, ACL, list, provisioning or signed URL interface. Real botocore412 and ambiguous read-timeout/closed-connection responses resolve only through bounded exact reads. The complete immutable manifest is reconstructed and compared, including prefix/date/opaque ID/content hash, ordered event digest, counts, revision ranges, serializer and retention window. Returned version IDs appear only in receipts. Reads enforce declared length, bounded chunks, optional provider checksum, exact content hash/bytes and always close bodies; decompression is bounded8MiB. Limits remain16MiB compressed/8MiB expanded/1MiB manifest. Public schema/lineage/timestamp validation occurs before I/O; payload bytes never enter diagnostics.
++- `export.py` and `reviewer/archive_worker.py`: export_once uses a fresh owned connection, established180-second singleton lease, persisted selection/seal/recovery/exact-ack, DB-time eligibility before transport and again at ack. Serialization and all SDK construction/I/O occur after commit. Never-activated and export-disabled paths do no S3 work. New small batches wait for the5-minute age condition, or2000events/8MiB. Expired pending seals are skipped, retained and report action needed; there is no automatic replacement or expired-key retry. Integrity-invalid batches receive a minimal durable quarantine marker when physical admission permits; unaffected aggregates can continue. Provider errors preserve pending state. Finally closes the connection and cancels the claim after rollback. Network exceptions log only their class, never provider messages/body/URLs.
++- `reviewer/supervisor.py`: independent archive child starts at startup and ticks60s; maximum process lifetime120s, checks at most5s, shared30-second SIGTERM drain. Maintenance remains independent at startup/every900s with90-second deadline. Existing daily discovery cron, review defaults, pricing and model settings remain unchanged.
++- Periodic cleanup calls accepted terminal compaction every archive turn after activation, including export pause. A shared cap of2000 rows includes old superseded shells; unacknowledged events/items/seals never TTL-delete. Seven-day terminal payload/receipt/shell retirement retains exact coverage, ack markers, supersession fences and authorization records. No physical deletion credit or reclamation claim is introduced.
++- `recovery.py` exposes `RecoveryAuthorization` and `replace_expired_batch`; export.py re-exports that operator API. It consumes an existing matching, unexpired, unused service-only authorization row, including expected exact event-ID digest and original manifest hash. The worker never writes an authorization. Under existing gate/claim/physical admission, replacement atomically creates a fresh opaque batch with current archive seal/window, consumes authorization, records a permanent old-owner/generation fence, marks old batch superseded and transfers identical items. Event IDs, canonical bytes/hashes, revisions and occurrence/observation/recorded times stay unchanged. Suppressed or missing pending membership cannot be replaced. Old callbacks cannot recover or ack the superseded batch; old objects remain untouched.
++
++## Additive migration and approved interface extension
++
++`2026-10-03-07-archive-export.sql`, mirrored verbatim in schema.sql, adds nullable destination coordinates plus false privacy/encryption/policy validation flags and evidence. It inserts no destination row, approval or activation. Existing fixture-only prefixes cannot create real clients without complete validated configuration.
++
++The controller explicitly ruled that Task11 may extend archive-only state/immutability to satisfy replacement: state `superseded`, immutable `public_archive_supersessions`, one-use `public_archive_recovery_authorizations`, and an exact batch_id-only membership transfer guarded by consumed authorization/marker, new claimed prior-batch identity and matching pending bytes. Generic item/seal mutation remains forbidden. Superseded and acked states cannot change. Pending deletion requires the established exact ack contract; superseded shell retirement requires its durable marker and7days. Existing Task3 role, claim, gate, physical accounting and reservation implementations were not changed or re-reviewed. Migration reruns preserve catalog parity.
++
++`lifecycle_private.archive_clock()` has no arguments or production setter and delegates directly to database clock_timestamp(). Only archive sealing/eligibility uses it. Owned tests replace its SQL definition with a fixed timestamp to cross the730-day archive horizon without changing claims, capacity, caller GUCs or event history; full clean schema restores its ordinary definition. Recovery authorization validity and claim leases use the ordinary database clock.
++
++## Actual verification
++
++Final source/test/dependency hashes for14 files were captured before final runs and verified unchanged afterward. Full sanitized outputs, exact commands, phase inventory, exit codes, collected node list, versions and hashes reside in `task-11-evidence/`. No source changed during final runs or after source commit.
++
++| Final permitted selection | PostgreSQL17.11 | PostgreSQL16.15 |
++| --- | --- | --- |
++| New export/privacy/recovery plus entire ordinary supervisor file |61 passed,21.87s,exit0|61 passed,26.42s,exit0|
++| Exact controller-approved clean-vs-ordered-additive catalog parity node |1 passed,0.84s,exit0|1 passed,1.37s,exit0|
++
++This is62 unique cases per major across two commands, not one62-case run. Neither final command skipped or deselected tests. PG17.11 is major-version parity, not historical production17.6. PG16.15 is compatibility. Python3.12.14, psycopg3.3.6, pytest9.1.1, Ruff0.15.20, boto31.42.74 and botocore1.42.97 are recorded. Cached image IDs:17 `327daa8fae71`,16 `275447c94b11`.
++
++Persisted crash matrix runs the actual export_once function with fake S3 and fresh connections: after persisted seal, data upload, manifest upload, ambiguous-success upload/read interruption, verification, uncommitted ack and committed ack. Every failed invocation is discarded and its connection closed, then a fresh client/worker invocation and different connection resume from persisted rows. Exact seal ID/time/window, member IDs, byte-for-byte object retry and remaining pending IDs are asserted. These are discarded invocations, not seven separate OS SIGKILL experiments. Supervisor tests additionally exercise real child processes/signals and bounded shutdown.
++
++Archive horizon tests verify first, advance only the archive fixture clock across eligible_until, fail ack without pending cleanup, fail nonexistent authorization, stop expired-key retries, then persist explicit fixture operator authorization. A rolled-back transfer leaves authorization unused; committed replacement preserves all bytes/IDs/times, uses a new seal/window and fences old callbacks. Replacement data-upload and ack-rollback crashes resume through fresh invocations/connections. Corrupt-manifest quarantine retains pending rows and allows an unaffected preclaimed aggregate to complete. Cleanup tests use a one-row cap across multiple committed calls and retain markers/pending events. Small-batch flushing asserts the real DB age query is initially false, then substitutes only its scalar result in a connection wrapper to exercise the flush branch; it does not wait five wall-clock minutes or modify production clocks. SDK PUT asserts the connection is idle. Offline Stubber validates the installed SDK request shape and actual412 ClientError handling; fake credentials and disabled IMDS prevent ambient AWS use.
++
++Ruff and whitespace checks pass. An offline import measurement reports wall0.359s,CPU0.359s,peak RSS38212KiB. This measures one archive-worker import only; production combined reviewer/maintenance/archive CPU, memory, connection load and provider costs remain unmeasured. `/usr/bin/time` was absent; that diagnostic is retained, followed by the successful standard-library measurement.
++
++## RED and development history
++
++Initial transport tests failed collection with2 ModuleNotFoundError errors before s3.py existed (exit2), then13 passed after implementation. No RED source-hash snapshot was captured; final hashes are not misattributed to that earlier phase. The initial PG17 fixture cancelled a claim in its own write transaction and hit the existing `stale or foreign lifecycle claim` commit check; a commit before cancellation fixed the fixture. The next phase used an absent pending-view observed_at column; the assertion now reads canonical event bytes. Subsequent10-case PG17 development passed. Expanded offline/supervisor and DB phases each caught remaining assertions expecting two children instead of three; final assertions reflect the new independent exporter. The expanded DB phase was58 passed/1 failed before correction. All earlier failed outputs remain preserved, not relabeled as successful final evidence.
++
++## Integration inventory and limits
++
++Changed product files: archive s3/export/recovery modules, accepted batches' archive-clock and superseded-owner checks, independent reviewer archive entrypoint/supervisor, additive migration/schema, and matching pinned boto3/botocore dependencies. Changed tests: three new archive files and existing ordinary supervisor expectations/cases. No dashboard/pricing/model setting changed. Upstream main `a8c4b82d95b35c0259600c19c1506faae807c3fc` was read and is already an ancestor of the base.
++
++All controls remain default off, retirement dry-run, destination table empty, archive inactive and readiness unvalidated. Real approved destination/private/encrypted/policy verification, credentials and rollout remain separate controller prerequisites; SDK doubles are not evidence of a real bucket's policy or retention. Transport currently requests SSE-S3 AES256; an approved destination must permit that contract. No production/provider/model/feed call, real S3 write/read, IAM/credential/security-setting change, permanent deletion, push/PR/merge/deploy or activation occurred. No author subagents were used.
++
++The accepted6*C+128000 logical processing escrow, finite critical slots and actual physical reservations are preserved. Physical admission can still defer claim/seal/ack/replacement/quarantine; terminal cleanup does not promise physical reuse. Quarantine or supersession/authorization marker accumulation requires operational sizing; markers are intentionally retained. A quarantine could not be persisted if physical admission is unavailable, in which case pending work stays blocked and retries can recur. Corrupt payloads are never automatically repaired or silently reset.
++
++Task3 expiry/physical-capacity/cross-user/adversarial security probes and substituted reviews remain deliberately omitted. No old security/activation suite ran; the single approved migration catalog node supplies schema parity only. No security approval is inferred. Independent permitted Task11 requirements/quality review and all remaining tasks/final release verification belong to the controller. No platform safeguard rejection occurred; the read-only uv cache path error was resolved using the already permitted /tmp cache, not an escalation.
++
++Documentation-only correction: raw failed pytest traces contained trailing spaces. The final evidence normalizes only line-end whitespace; exact raw outputs remain in the original report commit `d128ce8aef7fb7efea18592acba02f013e32991b`. No source or test result changed, and no test rerun was needed. Final staged documentation whitespace check passes.
+diff --git a/job_discovery/archive/batches.py b/job_discovery/archive/batches.py
+index 4ca6c20..336f816 100644
+--- a/job_discovery/archive/batches.py
++++ b/job_discovery/archive/batches.py
+@@ -184,21 +184,21 @@ def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
+     if not destination:
+         raise ArchiveBlocked("archive destination prefix not validated")
+     _processing_capacity(tx, [bytes(r["canonical_event"]) for r in selected])
+     reservation = reserve_capacity(tx, claim, total * 4 + 65536)
+     if reservation is None:
+         raise ArchiveBlocked("physical batch capacity unavailable")
+     bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+     batch_id = uuid4()
+     row = tx.execute(
+         """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date)
+-      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date FROM (SELECT clock_timestamp() t) clock RETURNING *""",
++      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date FROM (SELECT lifecycle_private.archive_clock() t) clock RETURNING *""",
+         (
+             batch_id,
+             claim.owner_token,
+             claim.generation,
+             len(selected),
+             total,
+             destination["object_prefix"],
+         ),
+     ).fetchone()
+     for position, event in enumerate(selected):
+@@ -257,41 +257,46 @@ def seal_batch(batch_ref: BatchRef, serializer_version: int = 1) -> SealedBatch:
+         compressed,
+         manifest,
+     )
+ 
+ 
+ def _owned(tx, batch_id, claim):
+     validate_claim(tx, claim)
+     row = tx.execute(
+         "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+     ).fetchone()
+-    if not row or (row["owner_token"], row["generation"]) != (
+-        claim.owner_token,
+-        claim.generation,
++    if (
++        not row
++        or row["state"] == "superseded"
++        or (row["owner_token"], row["generation"])
++        != (
++            claim.owner_token,
++            claim.generation,
++        )
+     ):
+         raise ArchiveBlocked("stale batch owner")
+     if not tx.execute(
+-        "SELECT clock_timestamp()<%s eligible", (row["eligible_until"],)
++        "SELECT lifecycle_private.archive_clock()<%s eligible", (row["eligible_until"],)
+     ).fetchone()["eligible"]:
+         raise ArchiveBlocked(
+             "archive seal expired; explicit replacement authorization required"
+         )
+     return row
+ 
+ 
+ def recover_batch(tx, batch_id, claim) -> BatchRef:
+     """Fence an expired/cancelled prior worker, preserving exact membership and seal."""
+     validate_claim(tx, claim)
+     row = tx.execute(
+         "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+     ).fetchone()
+-    if not row or row["state"] == "acked":
++    if not row or row["state"] in {"acked", "superseded"}:
+         raise ArchiveBlocked("batch unavailable")
+     if (row["owner_token"], row["generation"]) != (claim.owner_token, claim.generation):
+         if tx.execute(
+             "SELECT 1 FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND state='active' AND lease_until>clock_timestamp()",
+             (row["owner_token"], row["generation"]),
+         ).fetchone():
+             raise ArchiveBlocked("batch still owned")
+         tx.execute(
+             "UPDATE public_archive_batches SET owner_token=%s,generation=%s WHERE batch_id=%s",
+             (claim.owner_token, claim.generation, batch_id),
+diff --git a/job_discovery/archive/export.py b/job_discovery/archive/export.py
+new file mode 100644
+index 0000000..e2d1bda
+--- /dev/null
++++ b/job_discovery/archive/export.py
+@@ -0,0 +1,157 @@
++"""One bounded export turn: short persisted transactions, network only after commit."""
++
++import logging
++from job_discovery import db
++from job_discovery.lifecycle.claims import (
++    claim_work,
++    cancel_claim,
++    renew_claim,
++    validate_claim,
++)
++from job_discovery.lifecycle.capacity import (
++    reserve_capacity,
++    bind_reservation,
++    settle_capacity,
++)
++from job_discovery.lifecycle.config import read_control
++from job_discovery.lifecycle.locks import enter_gate
++from .batches import (
++    claim_batch,
++    recover_batch,
++    seal_batch,
++    persist_seal,
++    ack_batch,
++    compact_terminal_batches,
++    _owned,
++)
++from .types import BatchLimits, AckResult
++from .s3 import ArchiveClient, Destination, put_verify_batch
++from .outbox import ArchiveBlocked
++from .recovery import (
++    RecoveryAuthorization as RecoveryAuthorization,
++    replace_expired_batch as replace_expired_batch,
++)
++
++log = logging.getLogger(__name__)
++LEASE_SECONDS = 180
++CLEANUP_LIMIT = 2000
++
++
++def read_destination(conn) -> Destination:
++    row = conn.execute("""SELECT bucket,region,object_prefix,expected_owner FROM public_archive_destination
++        WHERE singleton AND validated_at<=clock_timestamp() AND private_validated AND encryption_validated
++        AND policy_validated AND length(validation_evidence)>0""").fetchone()
++    if not row:
++        raise ArchiveBlocked("archive destination validation required")
++    try:
++        return Destination(**row)
++    except (TypeError, ValueError):
++        raise ArchiveBlocked("archive destination configuration incomplete") from None
++
++
++def cleanup_terminal(conn, claim, limit=CLEANUP_LIMIT):
++    """One shared 2000-row budget; supersession/coverage markers are indefinite."""
++    count = compact_terminal_batches(conn, claim, limit=limit)
++    rows = conn.execute(
++        """DELETE FROM public_archive_batches b WHERE b.batch_id IN
++        (SELECT b.batch_id FROM public_archive_batches b JOIN public_archive_supersessions s ON s.old_batch_id=b.batch_id
++        WHERE b.state='superseded' AND s.replaced_at<=clock_timestamp()-interval '7 days'
++        AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=b.batch_id)
++        AND NOT EXISTS(SELECT FROM public_archive_receipts r WHERE r.batch_id=b.batch_id)
++        ORDER BY s.replaced_at,b.batch_id LIMIT %s) RETURNING b.batch_id""",
++        (limit - count,),
++    ).fetchall()
++    return count + len(rows)
++
++
++def export_once(
++    dsn: str | None, client: ArchiveClient | None = None
++) -> AckResult | None:
++    conn = claim = ref = None
++    try:
++        conn = db.connect(dsn)
++        enter_gate(conn)
++        control = read_control(conn)
++        if not control.archive_ever_activated:
++            conn.commit()
++            return None
++        claim = claim_work(conn, "archive-export", "singleton", LEASE_SECONDS)
++        conn.commit()
++        if claim is None:
++            return None
++        # Scheduled even during export pause; never visits pending payloads.
++        cleanup_terminal(conn, claim)
++        conn.commit()
++        enter_gate(conn)
++        control = read_control(conn)
++        if not control.export_enabled:
++            conn.commit()
++            return None
++        destination = read_destination(conn)
++        if client is not None and client.destination != destination:
++            raise ArchiveBlocked("archive client differs from validated destination")
++        expired = conn.execute(
++            "SELECT 1 FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until<=lifecycle_private.archive_clock() LIMIT 1"
++        ).fetchone()
++        if expired:
++            log.warning("archive retention action needed; pending events retained")
++        row = conn.execute(
++            "SELECT batch_id FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until>lifecycle_private.archive_clock() AND NOT EXISTS(SELECT FROM public_archive_quarantine q WHERE q.batch_id=public_archive_batches.batch_id) ORDER BY sealed_at,batch_id LIMIT 1"
++        ).fetchone()
++        if row:
++            ref = recover_batch(conn, row["batch_id"], claim)
++        else:
++            limits = BatchLimits()
++            ready = conn.execute("""SELECT count(*) n,COALESCE(sum(octet_length(canonical_event)+1),0) bytes,
++                min(recorded_at)<=clock_timestamp()-interval '5 minutes' aged FROM
++                (SELECT canonical_event,recorded_at FROM public_pending_events e WHERE NOT EXISTS(
++                 SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
++                 ORDER BY recorded_at,event_id LIMIT 2000) pending""").fetchone()
++            ref = (
++                claim_batch(conn, limits, claim)
++                if ready["n"] >= limits.max_events
++                or ready["bytes"] >= limits.max_expanded_bytes
++                or ready["aged"]
++                else None
++            )
++        conn.commit()
++        if ref is None:
++            return None
++        seal = seal_batch(ref)
++        persist_seal(conn, seal)
++        conn.commit()
++        # DB-time eligibility immediately before verification; final ack rechecks it.
++        _owned(conn, seal.batch_id, claim)
++        renew_claim(conn, claim, LEASE_SECONDS)
++        conn.commit()
++        if client is None:
++            client = ArchiveClient.from_destination(destination)
++        verified = put_verify_batch(seal, client)
++        result = ack_batch(conn, verified, claim)
++        conn.commit()
++        return result
++    except ValueError:
++        if conn is not None and claim is not None and ref is not None:
++            conn.rollback()
++            validate_claim(conn, claim)
++            reservation = reserve_capacity(conn, claim, 8192)
++            if reservation is not None:
++                bind_reservation(
++                    conn, reservation, job_id=None, scope="public_archive_batches"
++                )
++                conn.execute(
++                    "INSERT INTO public_archive_quarantine(batch_id,diagnostic_code) VALUES(%s,'invalid_archive') ON CONFLICT DO NOTHING",
++                    (ref.batch_id,),
++                )
++                settle_capacity(conn, reservation)
++            conn.commit()
++        raise
++    finally:
++        if conn is not None:
++            try:
++                conn.rollback()
++                if claim is not None:
++                    cancel_claim(conn, claim)
++                    conn.commit()
++            finally:
++                conn.close()
+diff --git a/job_discovery/archive/recovery.py b/job_discovery/archive/recovery.py
+new file mode 100644
+index 0000000..dfb25d3
+--- /dev/null
++++ b/job_discovery/archive/recovery.py
+@@ -0,0 +1,120 @@
++"""Explicit operator-authorized archive recovery. The worker never grants authorization."""
++
++from dataclasses import dataclass
++from uuid import UUID, uuid4
++from .batches import _ref, _hash, _processing_capacity
++from .codec import canonical_json
++from .outbox import ArchiveBlocked
++from .types import BatchRef
++from job_discovery.lifecycle.claims import validate_claim
++from job_discovery.lifecycle.capacity import (
++    reserve_capacity,
++    bind_reservation,
++    settle_capacity,
++)
++
++
++@dataclass(frozen=True)
++class RecoveryAuthorization:
++    authorization_id: UUID
++
++
++def replace_expired_batch(
++    tx, batch_id: UUID, claim, authorization: RecoveryAuthorization
++) -> BatchRef:
++    validate_claim(tx, claim)
++    if not isinstance(authorization, RecoveryAuthorization):
++        raise ArchiveBlocked("explicit archive recovery authorization required")
++    old = tx.execute(
++        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
++    ).fetchone()
++    if (
++        not old
++        or old["state"] not in {"claimed", "sealed"}
++        or tx.execute(
++            "SELECT lifecycle_private.archive_clock()<%s eligible",
++            (old["eligible_until"],),
++        ).fetchone()["eligible"]
++    ):
++        raise ArchiveBlocked("batch is not eligible for expired replacement")
++    ref = _ref(tx, old, claim)
++    digest = _hash(canonical_json([str(e) for e in ref.ordered_event_ids]))
++    auth = tx.execute(
++        """SELECT * FROM public_archive_recovery_authorizations
++        WHERE authorization_id=%s AND batch_id=%s AND consumed_at IS NULL
++        AND approved_at<=clock_timestamp() AND expires_at>clock_timestamp() FOR UPDATE""",
++        (authorization.authorization_id, batch_id),
++    ).fetchone()
++    if (
++        not auth
++        or auth["event_ids_sha256"] != digest
++        or auth["manifest_hash"] != old["manifest_hash"]
++    ):
++        raise ArchiveBlocked(
++            "explicit matching archive recovery authorization required"
++        )
++    pending = tx.execute(
++        """SELECT count(*) n FROM public_archive_items i JOIN public_pending_events e USING(event_id)
++        WHERE i.batch_id=%s AND i.canonical_event=e.canonical_event""",
++        (batch_id,),
++    ).fetchone()["n"]
++    if pending != len(ref.ordered_event_ids) or pending != old["event_count"]:
++        raise ArchiveBlocked("replacement exact pending membership differs")
++    if tx.execute(
++        """SELECT 1 FROM public_archive_items i JOIN public_archive_suppressions s USING(aggregate_type,aggregate_id)
++        WHERE i.batch_id=%s LIMIT 1""",
++        (batch_id,),
++    ).fetchone():
++        raise ArchiveBlocked("replacement contains suppressed aggregate")
++    _processing_capacity(tx, ref.event_bytes)
++    reservation = reserve_capacity(
++        tx, claim, 65536 + sum(map(len, ref.event_bytes)) * 4
++    )
++    if reservation is None:
++        raise ArchiveBlocked("physical replacement capacity unavailable")
++    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
++    new_id = uuid4()
++    row = tx.execute(
++        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,
++        eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date,prior_batch_id)
++        SELECT %s,%s,%s,%s,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date,%s
++        FROM (SELECT lifecycle_private.archive_clock() t) clock RETURNING *""",
++        (
++            new_id,
++            claim.owner_token,
++            claim.generation,
++            ref.serializer_version,
++            old["event_count"],
++            old["expanded_bytes"],
++            ref.object_prefix,
++            batch_id,
++        ),
++    ).fetchone()
++    tx.execute(
++        """UPDATE public_archive_recovery_authorizations SET consumed_at=clock_timestamp(),replacement_batch_id=%s
++        WHERE authorization_id=%s""",
++        (new_id, authorization.authorization_id),
++    )
++    tx.execute(
++        """INSERT INTO public_archive_supersessions(old_batch_id,new_batch_id,authorization_id,owner_token,generation,event_ids_sha256,manifest_hash)
++        VALUES(%s,%s,%s,%s,%s,%s,%s)""",
++        (
++            batch_id,
++            new_id,
++            authorization.authorization_id,
++            old["owner_token"],
++            old["generation"],
++            digest,
++            old["manifest_hash"],
++        ),
++    )
++    tx.execute(
++        "UPDATE public_archive_batches SET state='superseded' WHERE batch_id=%s",
++        (batch_id,),
++    )
++    tx.execute(
++        "UPDATE public_archive_items SET batch_id=%s WHERE batch_id=%s",
++        (new_id, batch_id),
++    )
++    settle_capacity(tx, reservation)
++    return _ref(tx, row, claim)
+diff --git a/job_discovery/archive/s3.py b/job_discovery/archive/s3.py
+new file mode 100644
+index 0000000..bf11c01
+--- /dev/null
++++ b/job_discovery/archive/s3.py
+@@ -0,0 +1,262 @@
++"""Bounded immutable S3 transport. Destination comes only from validated service state."""
++
++import base64
++from dataclasses import dataclass
++from datetime import datetime
++import gzip
++import hashlib
++import io
++import json
++import re
++import time
++
++import boto3
++from botocore.config import Config
++from botocore.exceptions import ClientError, ConnectionClosedError, ReadTimeoutError
++
++from .batches import seal_batch
++from .codec import MAX_COMPRESSED, MAX_EXPANDED, MAX_MANIFEST, canonical_json
++from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
++from .types import SealedBatch, VerificationReceipt, VerifiedBatch
++
++
++@dataclass(frozen=True)
++class Destination:
++    bucket: str
++    region: str
++    object_prefix: str
++    expected_owner: str
++
++    def __post_init__(self):
++        if not (
++            isinstance(self.bucket, str)
++            and re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", self.bucket)
++            and ".." not in self.bucket
++            and not re.fullmatch(r"[0-9.]+", self.bucket)
++            and isinstance(self.region, str)
++            and re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-\d", self.region)
++            and isinstance(self.object_prefix, str)
++            and len(self.object_prefix) <= 256
++            and re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", self.object_prefix)
++            and isinstance(self.expected_owner, str)
++            and re.fullmatch(r"\d{12}", self.expected_owner)
++        ):
++            raise ValueError("invalid service archive destination")
++
++
++class ArchiveClient:
++    """No list/delete/head/provisioning interface. Reuse one explicitly configured client."""
++
++    def __init__(self, destination: Destination, sdk):
++        if (
++            not isinstance(destination, Destination)
++            or sdk.meta.region_name != destination.region
++        ):
++            raise ValueError("archive client region differs from validated destination")
++        self.destination, self._sdk = destination, sdk
++
++    @classmethod
++    def from_destination(cls, destination: Destination):
++        sdk = boto3.session.Session(region_name=destination.region).client(
++            "s3",
++            region_name=destination.region,
++            config=Config(
++                connect_timeout=3,
++                read_timeout=5,
++                max_pool_connections=2,
++                retries={"total_max_attempts": 2, "mode": "standard"},
++                signature_version="s3v4",
++                ignore_configured_endpoint_urls=True,
++                s3={"addressing_style": "virtual"},
++            ),
++        )
++        return cls(destination, sdk)
++
++    def _key(self, key):
++        pattern = (
++            re.escape(self.destination.object_prefix)
++            + r"/ingestion_date=\d{4}-\d{2}-\d{2}/[0-9a-f-]{36}-[0-9a-f]{64}\.(?:jsonl\.gz|manifest\.json)"
++        )
++        if not isinstance(key, str) or not re.fullmatch(pattern, key):
++            raise ValueError("object key differs from service archive namespace")
++
++    def put_parameters(self, key, data):
++        self._key(key)
++        return dict(
++            Bucket=self.destination.bucket,
++            Key=key,
++            Body=data,
++            IfNoneMatch="*",
++            ExpectedBucketOwner=self.destination.expected_owner,
++            ChecksumSHA256=base64.b64encode(hashlib.sha256(data).digest()).decode(),
++            ContentType="application/gzip"
++            if key.endswith(".gz")
++            else "application/json",
++            ServerSideEncryption="AES256",
++        )
++
++    def conditional_put(self, key, data):
++        try:
++            self._sdk.put_object(**self.put_parameters(key, data))
++        except ClientError as exc:
++            # S3 has no modelled PreconditionFailed exception. Only a real 412
++            # means immutable-existing recovery; authorization and 409 errors propagate.
++            if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
++                raise
++        except (ReadTimeoutError, ConnectionClosedError):
++            # Ambiguous upload is resolved only by an exact bounded read below.
++            pass
++
++    def bounded_read(self, key, limit, deadline):
++        self._key(key)
++        if time.monotonic() >= deadline:
++            raise TimeoutError("archive verification deadline")
++        response = self._sdk.get_object(
++            Bucket=self.destination.bucket,
++            Key=key,
++            ExpectedBucketOwner=self.destination.expected_owner,
++            ChecksumMode="ENABLED",
++        )
++        body = response["Body"]
++        try:
++            size = response.get("ContentLength")
++            if type(size) is not int or not 0 <= size <= limit:
++                raise ValueError("archive object exceeds declared bound")
++            chunks = []
++            total = 0
++            while True:
++                if time.monotonic() >= deadline:
++                    raise TimeoutError("archive verification deadline")
++                chunk = body.read(min(65536, limit - total + 1))
++                if not chunk:
++                    break
++                total += len(chunk)
++                if total > limit:
++                    raise ValueError("archive object exceeds read bound")
++                chunks.append(chunk)
++            data = b"".join(chunks)
++            if len(data) != size:
++                raise ValueError("archive object length differs")
++            digest = hashlib.sha256(data).digest()
++            checksum = response.get("ChecksumSHA256")
++            if checksum is not None and checksum != base64.b64encode(digest).decode():
++                raise ValueError("archive object checksum differs")
++            version = response.get("VersionId")
++            if version is not None and (
++                not isinstance(version, str) or not 1 <= len(version) <= 1024
++            ):
++                raise ValueError("invalid archive version receipt")
++            return data, VerificationReceipt(
++                key,
++                digest.hex(),
++                len(data),
++                canonical_json({"verified": "sha256", "version_id": version}).decode(),
++            )
++        finally:
++            body.close()
++
++
++def _validate_events(seal):
++    fields = {
++        "event_id",
++        "aggregate_type",
++        "aggregate_id",
++        "revision",
++        "predecessor_id",
++        "kind",
++        "body",
++        "occurred_at",
++        "observed_at",
++        "recorded_at",
++        "provenance",
++        "schema_version",
++    }
++    for raw in seal.batch.event_bytes:
++        event = json.loads(raw)
++        if (
++            not isinstance(event, dict)
++            or set(event) != fields
++            or type(event["schema_version"]) is not int
++            or event["schema_version"] != 1
++        ):
++            raise ValueError("invalid public event envelope")
++        if type(event["revision"]) is not int or event["revision"] < 1:
++            raise ValueError("invalid public event revision")
++        if event["event_id"] != str(
++            event_id(event["aggregate_type"], event["aggregate_id"], event["revision"])
++        ):
++            raise ValueError("invalid public event identity")
++        previous = (
++            str(
++                event_id(
++                    event["aggregate_type"],
++                    event["aggregate_id"],
++                    event["revision"] - 1,
++                )
++            )
++            if event["revision"] > 1
++            else None
++        )
++        if event["predecessor_id"] != previous or event["provenance"] not in {
++            "current_baseline",
++            "database_change",
++            "source_observation",
++        }:
++            raise ValueError("invalid public event lineage")
++        for key in ("occurred_at", "observed_at", "recorded_at"):
++            value = event[key]
++            if value is None and key == "observed_at":
++                continue
++            if (
++                not isinstance(value, str)
++                or datetime.fromisoformat(value).tzinfo is None
++            ):
++                raise ValueError("invalid public event time")
++        validate_change(
++            PublicChange(
++                AggregateType(event["aggregate_type"]),
++                event["aggregate_id"],
++                ChangeKind(event["kind"]),
++                event["body"],
++                datetime.fromisoformat(event["occurred_at"]),
++            )
++        )
++        if canonical_json(event) != raw:
++            raise ValueError("noncanonical public event")
++
++
++def put_verify_batch(
++    sealed_batch: SealedBatch, archive_client: ArchiveClient
++) -> VerifiedBatch:
++    seal = sealed_batch
++    if seal.batch.object_prefix != archive_client.destination.object_prefix:
++        raise ValueError("seal prefix differs from validated destination")
++    _validate_events(seal)
++    # Reconstruct the complete immutable manifest, key, count and digest contract.
++    if seal_batch(seal.batch) != seal:
++        raise ValueError("immutable seal differs")
++    if (
++        not 1 <= seal.event_count <= 2000
++        or seal.compressed_bytes > MAX_COMPRESSED
++        or seal.expanded_bytes > MAX_EXPANDED
++        or seal.manifest_bytes > MAX_MANIFEST
++    ):
++        raise ValueError("seal exceeds verification bounds")
++    deadline = time.monotonic() + 100
++    archive_client.conditional_put(seal.data_key, seal.compressed_data)
++    data, data_receipt = archive_client.bounded_read(
++        seal.data_key, min(MAX_COMPRESSED, seal.compressed_bytes), deadline
++    )
++    if data != seal.compressed_data:
++        raise ValueError("archive data differs")
++    with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as stream:
++        expanded = stream.read(MAX_EXPANDED + 1)
++    if len(expanded) > MAX_EXPANDED or expanded != seal.canonical_data:
++        raise ValueError("archive expanded data differs")
++    archive_client.conditional_put(seal.manifest_key, seal.manifest_data)
++    manifest, manifest_receipt = archive_client.bounded_read(
++        seal.manifest_key, min(MAX_MANIFEST, seal.manifest_bytes), deadline
++    )
++    if manifest != seal.manifest_data:
++        raise ValueError("archive manifest differs")
++    return VerifiedBatch(seal, data_receipt, manifest_receipt)
+diff --git a/migrations/2026-10-03-07-archive-export.sql b/migrations/2026-10-03-07-archive-export.sql
+new file mode 100644
+index 0000000..c91fddf
+--- /dev/null
++++ b/migrations/2026-10-03-07-archive-export.sql
+@@ -0,0 +1,135 @@
++-- Task11: archive-only explicit replacement and validated transport configuration.
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_clock() RETURNS timestamptz
++LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$;
++REVOKE ALL ON FUNCTION lifecycle_private.archive_clock() FROM PUBLIC,anon,authenticated;
++-- Empty destination and false validation flags keep transport inactive.
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS bucket text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS region text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS expected_owner text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS private_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS encryption_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS policy_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS validation_evidence text;
++ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_state_check;
++ALTER TABLE public_archive_batches ADD CONSTRAINT public_archive_batches_state_check CHECK(state IN ('claimed','sealed','acked','superseded'));
++-- A never-uploaded claimed batch can also require authorized replacement.
++DO $$ DECLARE c record; BEGIN
++ FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public_archive_batches'::regclass
++ AND contype='c' AND pg_get_constraintdef(oid) LIKE '%data_key IS NOT NULL%' LOOP
++  EXECUTE format('ALTER TABLE public_archive_batches DROP CONSTRAINT %I',c.conname);
++ END LOOP;
++END $$;
++ALTER TABLE public_archive_batches ADD CONSTRAINT archive_sealed_fields CHECK(
++ state IN ('claimed','superseded') OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
++ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
++ AND manifest_bytes BETWEEN 1 AND 1048576));
++CREATE TABLE IF NOT EXISTS public_archive_recovery_authorizations (
++ authorization_id uuid PRIMARY KEY, batch_id uuid NOT NULL UNIQUE,
++ event_ids_sha256 text NOT NULL, manifest_hash text,
++ approved_by text NOT NULL CHECK(length(approved_by) BETWEEN 1 AND 256),
++ reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1024),
++ approved_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
++ consumed_at timestamptz, replacement_batch_id uuid UNIQUE,
++ CHECK(expires_at>approved_at), CHECK((consumed_at IS NULL)=(replacement_batch_id IS NULL))
++);
++CREATE TABLE IF NOT EXISTS public_archive_supersessions (
++ old_batch_id uuid PRIMARY KEY, new_batch_id uuid NOT NULL UNIQUE,
++ authorization_id uuid NOT NULL UNIQUE REFERENCES public_archive_recovery_authorizations(authorization_id),
++ owner_token text NOT NULL,generation bigint NOT NULL,event_ids_sha256 text NOT NULL,
++ manifest_hash text,replaced_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++CREATE OR REPLACE FUNCTION lifecycle_private.consume_archive_authorization() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'archive authorization cannot be deleted or truncated'; END IF;
++ IF OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL OR NEW.replacement_batch_id IS NULL
++ OR (to_jsonb(NEW)-ARRAY['consumed_at','replacement_batch_id']) IS DISTINCT FROM
++    (to_jsonb(OLD)-ARRAY['consumed_at','replacement_batch_id'])
++ OR OLD.approved_at>clock_timestamp() OR OLD.expires_at<=clock_timestamp()
++ OR NOT EXISTS(SELECT FROM public.public_archive_batches b WHERE b.batch_id=NEW.replacement_batch_id
++  AND b.prior_batch_id=OLD.batch_id AND b.state='claimed') THEN
++  RAISE EXCEPTION 'invalid archive authorization consumption'; END IF;
++ RETURN NEW;
++END $$;
++REVOKE ALL ON FUNCTION lifecycle_private.consume_archive_authorization() FROM PUBLIC,anon,authenticated;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
++  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
++   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ IF TG_TABLE_NAME='public_archive_batches' THEN
++  IF TG_OP='DELETE' AND OLD.state='superseded' AND EXISTS(
++   SELECT FROM public.public_archive_supersessions s WHERE s.old_batch_id=OLD.batch_id
++   AND s.replaced_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ END IF;
++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
++  IF (to_jsonb(NEW)-'batch_id')=(to_jsonb(OLD)-'batch_id') AND EXISTS(
++   SELECT FROM public.public_archive_supersessions s
++   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
++   JOIN public.public_archive_batches b ON b.batch_id=s.new_batch_id
++   WHERE s.old_batch_id=OLD.batch_id AND s.new_batch_id=NEW.batch_id
++    AND a.replacement_batch_id=s.new_batch_id AND a.consumed_at IS NOT NULL
++    AND b.state='claimed' AND b.prior_batch_id=OLD.batch_id
++    AND EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.event_id
++      AND e.canonical_event=NEW.canonical_event)) THEN RETURN NEW; END IF;
++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
++  RAISE EXCEPTION 'immutable pending membership';
++ END IF;
++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
++  IF OLD.state IN ('acked','superseded') AND NEW IS DISTINCT FROM OLD THEN
++   RAISE EXCEPTION 'terminal archive state immutable'; END IF;
++  IF NEW.state='superseded' AND OLD.state<>'superseded' AND NOT EXISTS(
++   SELECT FROM public.public_archive_supersessions s
++   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
++   WHERE s.old_batch_id=OLD.batch_id AND a.replacement_batch_id=s.new_batch_id
++    AND a.consumed_at IS NOT NULL AND OLD.eligible_until<=lifecycle_private.archive_clock()) THEN
++   RAISE EXCEPTION 'explicit consumed archive replacement authorization required'; END IF;
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
++
++DO $$ DECLARE t text; BEGIN
++ FOREACH t IN ARRAY ARRAY['public_archive_recovery_authorizations','public_archive_supersessions'] LOOP
++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
++ END LOOP;
++END $$;
++DROP TRIGGER IF EXISTS archive_immutable ON public_archive_supersessions;
++CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_supersessions FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_supersessions;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_supersessions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_authorization_consume ON public_archive_recovery_authorizations;
++CREATE TRIGGER archive_authorization_consume BEFORE UPDATE OR DELETE ON public_archive_recovery_authorizations FOR EACH ROW EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_recovery_authorizations;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_recovery_authorizations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();
++
++-- Payload/config integrity failures are durable operator work, never dropped events.
++CREATE TABLE IF NOT EXISTS public_archive_quarantine (
++ batch_id uuid PRIMARY KEY, diagnostic_code text NOT NULL CHECK(diagnostic_code='invalid_archive'),
++ quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++ALTER TABLE public_archive_quarantine ENABLE ROW LEVEL SECURITY;
++REVOKE ALL ON public_archive_quarantine FROM PUBLIC,anon,authenticated;
++DROP TRIGGER IF EXISTS lifecycle_gate ON public_archive_quarantine;
++CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public_archive_quarantine
++ FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate();
+diff --git a/pyproject.toml b/pyproject.toml
+index 140358a..ef3e1bc 100644
+--- a/pyproject.toml
++++ b/pyproject.toml
+@@ -1,17 +1,19 @@
+ [project]
+ name = "job-board-poller"
+ version = "0.1.0"
+ description = "Remote job tracker"
+ requires-python = ">=3.12"
+ dependencies = [
+     "httpx>=0.27",
++    "boto3==1.42.74",
++    "botocore==1.42.97",
+     "requests>=2.31",
+     "psycopg[binary]>=3.2",
+     "openai>=1.50.0",
+     "geonamescache>=3.0",
+     "langfuse>=3",
+ ]
+ 
+ [project.optional-dependencies]
+ dev = ["pytest>=8.0", "ruff==0.15.20"]
+ 
+diff --git a/requirements.txt b/requirements.txt
+index e6dc0f2..4532a8d 100644
+--- a/requirements.txt
++++ b/requirements.txt
+@@ -1,9 +1,11 @@
+ # Runtime dependencies for the Railway deploy (Nixpacks installs from this,
+ # which avoids building the local project as a wheel). Kept in sync
+ # with [project.dependencies] in pyproject.toml (used for local dev/tests).
+ httpx>=0.27
+ requests>=2.31
+ psycopg[binary]>=3.2
+ openai>=1.50.0
+ geonamescache>=3.0
+ langfuse>=3
++boto3==1.42.74
++botocore==1.42.97
+diff --git a/reviewer/archive_worker.py b/reviewer/archive_worker.py
+new file mode 100644
+index 0000000..53d3e2a
+--- /dev/null
++++ b/reviewer/archive_worker.py
+@@ -0,0 +1,39 @@
++"""Independent one-shot archive worker; supervisor enforces the 120-second deadline."""
++
++import logging
++import signal
++import sys
++from job_discovery.archive.export import export_once
++
++log = logging.getLogger(__name__)
++
++
++def main():
++    logging.basicConfig(
++        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
++    )
++
++    def terminate(signum, _frame):
++        signal.signal(signal.SIGTERM, signal.SIG_IGN)
++        signal.signal(signal.SIGINT, signal.SIG_IGN)
++        raise SystemExit(128 + signum)
++
++    signal.signal(signal.SIGTERM, terminate)
++    signal.signal(signal.SIGINT, terminate)
++    try:
++        result = export_once(None)
++    except Exception as exc:
++        # Provider exceptions may contain URL, credentials or payload. Log only type.
++        log.warning(
++            "archive export deferred; pending events retained (%s)", type(exc).__name__
++        )
++        return 1
++    log.info(
++        "archive export completed: acknowledged=%s",
++        len(result.exact_event_ids) if result else 0,
++    )
++    return 0
++
++
++if __name__ == "__main__":
++    sys.exit(main())
+diff --git a/reviewer/supervisor.py b/reviewer/supervisor.py
+index 93b9295..9aae3ff 100644
+--- a/reviewer/supervisor.py
++++ b/reviewer/supervisor.py
+@@ -1,131 +1,166 @@
+ """Independent reviewer and bounded, scheduled maintenance child processes.
+ 
+-No database connections, discovery scheduling or archive registration live here.
++No database connections or network writes live here.
+ The maintenance child owns its existing database lease and transactions.
+ """
++
+ import logging
+ import signal
+ import subprocess
+ import sys
+ import threading
+ import time
+ from dataclasses import dataclass
+ from typing import Callable
+ 
+ log = logging.getLogger(__name__)
+ CHECK_SECONDS = 5
+ MAINTENANCE_INTERVAL_SECONDS = 15 * 60
+ MAINTENANCE_DEADLINE_SECONDS = 90
+ DRAIN_SECONDS = 30
++ARCHIVE_INTERVAL_SECONDS = 60
++ARCHIVE_DEADLINE_SECONDS = 120
+ 
+ 
+ @dataclass
+ class Child:
+     process: subprocess.Popen
+     started: float
+     killed: bool = False
+ 
+ 
+ def spawn_child(name: str) -> subprocess.Popen:
+-    modules = {'reviewer': 'reviewer.worker', 'maintenance': 'job_discovery.lifecycle.worker'}
++    modules = {
++        "reviewer": "reviewer.worker",
++        "maintenance": "job_discovery.lifecycle.worker",
++        "archive": "reviewer.archive_worker",
++    }
+     # Inherit stdout/stderr: no pipe can fill and stall a child or the supervisor.
+-    return subprocess.Popen([sys.executable, '-m', modules[name]])
++    return subprocess.Popen([sys.executable, "-m", modules[name]])
+ 
+ 
+ def _signal(child: Child, *, kill: bool = False) -> None:
+     try:
+         if kill:
+             child.process.kill()
+             child.killed = True
+         else:
+             child.process.terminate()
+     except ProcessLookupError:
+         pass
+ 
+ 
+ def _drain(children: dict[str, Child], clock: Callable) -> bool:
+     # One global deadline, independent of child count. Never an unbounded wait.
+     deadline = clock() + DRAIN_SECONDS
+     for child in children.values():
+         if child.process.poll() is None:
+             _signal(child)
+-    while any(c.process.poll() is None for c in children.values()) and clock() < deadline:
++    while (
++        any(c.process.poll() is None for c in children.values()) and clock() < deadline
++    ):
+         wake = min(deadline, clock() + CHECK_SECONDS)
+-        maintenance = children.get('maintenance')
+-        if maintenance is not None and maintenance.process.poll() is None and not maintenance.killed:
+-            expires = maintenance.started + MAINTENANCE_DEADLINE_SECONDS
+-            if clock() >= expires:
+-                _signal(maintenance, kill=True)
+-            else:
+-                wake = min(wake, expires)
++        for name, seconds in [
++            ("maintenance", MAINTENANCE_DEADLINE_SECONDS),
++            ("archive", ARCHIVE_DEADLINE_SECONDS),
++        ]:
++            child = children.get(name)
++            if child is not None and child.process.poll() is None and not child.killed:
++                expires = child.started + seconds
++                if clock() >= expires:
++                    _signal(child, kill=True)
++                else:
++                    wake = min(wake, expires)
+         time.sleep(max(0, wake - clock()))
+     for child in children.values():
+         if child.process.poll() is None:
+             _signal(child, kill=True)
+     # Signals are sent by the 30-second deadline. Allow one further shared
+     # second only to reap kernel exits, never to continue cooperative work.
+     reap_deadline = clock() + 1
+     reaped = True
+     for child in children.values():
+         try:
+             child.process.wait(timeout=max(0, reap_deadline - clock()))
+         except subprocess.TimeoutExpired:
+-            log.error('child did not exit after kill')
++            log.error("child did not exit after kill")
+             reaped = False
+     return reaped
+ 
+ 
+ def supervise(stop: threading.Event, spawn: Callable, clock: Callable) -> int:
+     children: dict[str, Child] = {}
+     next_maintenance = clock()
++    next_archive = clock()
+     failed = False
+     try:
+         while not stop.is_set():
+             now = clock()
+             for name, child in list(children.items()):
+                 code = child.process.poll()
+                 if code is not None:
+-                    log.info('%s child exited status=%s', name, code)
++                    log.info("%s child exited status=%s", name, code)
+                     del children[name]
+-                elif name == 'maintenance' and not child.killed and now >= child.started + MAINTENANCE_DEADLINE_SECONDS:
+-                    log.warning('maintenance process deadline reached')
++                elif (
++                    name in {"maintenance", "archive"}
++                    and not child.killed
++                    and now
++                    >= child.started
++                    + (
++                        MAINTENANCE_DEADLINE_SECONDS
++                        if name == "maintenance"
++                        else ARCHIVE_DEADLINE_SECONDS
++                    )
++                ):
++                    log.warning("%s process deadline reached", name)
+                     # At 90 seconds no further cooperative grace is permitted.
+                     # The next claim acquisition uses the existing DB-time fence.
+                     _signal(child, kill=True)
+             if stop.is_set():
+                 break
+-            if 'reviewer' not in children:
+-                children['reviewer'] = Child(spawn('reviewer'), clock())
++            if "reviewer" not in children:
++                children["reviewer"] = Child(spawn("reviewer"), clock())
+             if stop.is_set():
+                 break
+-            if now >= next_maintenance and 'maintenance' not in children:
++            if now >= next_maintenance and "maintenance" not in children:
+                 started = clock()
+-                children['maintenance'] = Child(spawn('maintenance'), started)
++                children["maintenance"] = Child(spawn("maintenance"), started)
+                 # Skip missed ticks rather than burst-replaying them after delay.
+                 next_maintenance = started + MAINTENANCE_INTERVAL_SECONDS
++            if not stop.is_set() and now >= next_archive and "archive" not in children:
++                started = clock()
++                children["archive"] = Child(spawn("archive"), started)
++                next_archive = started + ARCHIVE_INTERVAL_SECONDS
+             wake = clock() + CHECK_SECONDS
+-            child = children.get('maintenance')
++            child = children.get("maintenance")
+             if child is not None and not child.killed:
+                 wake = min(wake, child.started + MAINTENANCE_DEADLINE_SECONDS)
++            archive = children.get("archive")
++            if archive is not None and not archive.killed:
++                wake = min(wake, archive.started + ARCHIVE_DEADLINE_SECONDS)
++            if next_archive > clock():
++                wake = min(wake, next_archive)
+             if next_maintenance > clock():
+                 wake = min(wake, next_maintenance)
+             stop.wait(max(0.001, wake - clock()))
+     except Exception:
+-        log.exception('supervisor failed; draining children before service restart')
++        log.exception("supervisor failed; draining children before service restart")
+         failed = True
+     finally:
+         if not _drain(children, clock):
+             failed = True
+     return int(failed)
+ 
+ 
+ def main() -> int:
+-    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
++    logging.basicConfig(
++        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
++    )
+     stop = threading.Event()
+     for sig in (signal.SIGTERM, signal.SIGINT):
+         signal.signal(sig, lambda *_: stop.set())
+     return supervise(stop, spawn_child, time.monotonic)
+ 
+ 
+-if __name__ == '__main__':
++if __name__ == "__main__":
+     sys.exit(main())
+diff --git a/schema.sql b/schema.sql
+index 94aa493..248005f 100644
+--- a/schema.sql
++++ b/schema.sql
+@@ -3187,10 +3187,148 @@ BEGIN
+    RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+   IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+     AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+     AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+     AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+   SELECT count(*),lifecycle_private.archive_budget_bytes() INTO total_count,total_bytes FROM public.public_pending_events;
+   IF total_count+1>100000 OR total_bytes+2*octet_length(NEW.canonical_event)+lifecycle_private.archive_processing_charge(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+  END IF;
+  RETURN NEW;
+ END $$;
++
++-- Task11: archive-only explicit replacement and validated transport configuration.
++CREATE OR REPLACE FUNCTION lifecycle_private.archive_clock() RETURNS timestamptz
++LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$;
++REVOKE ALL ON FUNCTION lifecycle_private.archive_clock() FROM PUBLIC,anon,authenticated;
++-- Empty destination and false validation flags keep transport inactive.
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS bucket text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS region text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS expected_owner text;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS private_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS encryption_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS policy_validated boolean NOT NULL DEFAULT false;
++ALTER TABLE public_archive_destination ADD COLUMN IF NOT EXISTS validation_evidence text;
++ALTER TABLE public_archive_batches DROP CONSTRAINT IF EXISTS public_archive_batches_state_check;
++ALTER TABLE public_archive_batches ADD CONSTRAINT public_archive_batches_state_check CHECK(state IN ('claimed','sealed','acked','superseded'));
++-- A never-uploaded claimed batch can also require authorized replacement.
++DO $$ DECLARE c record; BEGIN
++ FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public_archive_batches'::regclass
++ AND contype='c' AND pg_get_constraintdef(oid) LIKE '%data_key IS NOT NULL%' LOOP
++  EXECUTE format('ALTER TABLE public_archive_batches DROP CONSTRAINT %I',c.conname);
++ END LOOP;
++END $$;
++ALTER TABLE public_archive_batches ADD CONSTRAINT archive_sealed_fields CHECK(
++ state IN ('claimed','superseded') OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
++ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
++ AND manifest_bytes BETWEEN 1 AND 1048576));
++CREATE TABLE IF NOT EXISTS public_archive_recovery_authorizations (
++ authorization_id uuid PRIMARY KEY, batch_id uuid NOT NULL UNIQUE,
++ event_ids_sha256 text NOT NULL, manifest_hash text,
++ approved_by text NOT NULL CHECK(length(approved_by) BETWEEN 1 AND 256),
++ reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1024),
++ approved_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
++ consumed_at timestamptz, replacement_batch_id uuid UNIQUE,
++ CHECK(expires_at>approved_at), CHECK((consumed_at IS NULL)=(replacement_batch_id IS NULL))
++);
++CREATE TABLE IF NOT EXISTS public_archive_supersessions (
++ old_batch_id uuid PRIMARY KEY, new_batch_id uuid NOT NULL UNIQUE,
++ authorization_id uuid NOT NULL UNIQUE REFERENCES public_archive_recovery_authorizations(authorization_id),
++ owner_token text NOT NULL,generation bigint NOT NULL,event_ids_sha256 text NOT NULL,
++ manifest_hash text,replaced_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++CREATE OR REPLACE FUNCTION lifecycle_private.consume_archive_authorization() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'archive authorization cannot be deleted or truncated'; END IF;
++ IF OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL OR NEW.replacement_batch_id IS NULL
++ OR (to_jsonb(NEW)-ARRAY['consumed_at','replacement_batch_id']) IS DISTINCT FROM
++    (to_jsonb(OLD)-ARRAY['consumed_at','replacement_batch_id'])
++ OR OLD.approved_at>clock_timestamp() OR OLD.expires_at<=clock_timestamp()
++ OR NOT EXISTS(SELECT FROM public.public_archive_batches b WHERE b.batch_id=NEW.replacement_batch_id
++  AND b.prior_batch_id=OLD.batch_id AND b.state='claimed') THEN
++  RAISE EXCEPTION 'invalid archive authorization consumption'; END IF;
++ RETURN NEW;
++END $$;
++REVOKE ALL ON FUNCTION lifecycle_private.consume_archive_authorization() FROM PUBLIC,anon,authenticated;
++CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
++LANGUAGE plpgsql SET search_path=pg_catalog AS $$
++BEGIN
++ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
++ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_archive_items','public_archive_receipts','public_archive_batches') AND EXISTS(
++  SELECT FROM public.public_archive_batch_markers m WHERE m.batch_id=(to_jsonb(OLD)->>'batch_id')::uuid
++   AND m.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ IF TG_TABLE_NAME='public_archive_batches' THEN
++  IF TG_OP='DELETE' AND OLD.state='superseded' AND EXISTS(
++   SELECT FROM public.public_archive_supersessions s WHERE s.old_batch_id=OLD.batch_id
++   AND s.replaced_at<=clock_timestamp()-interval '7 days') THEN RETURN OLD; END IF;
++ END IF;
++ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
++  IF (to_jsonb(NEW)-'batch_id')=(to_jsonb(OLD)-'batch_id') AND EXISTS(
++   SELECT FROM public.public_archive_supersessions s
++   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
++   JOIN public.public_archive_batches b ON b.batch_id=s.new_batch_id
++   WHERE s.old_batch_id=OLD.batch_id AND s.new_batch_id=NEW.batch_id
++    AND a.replacement_batch_id=s.new_batch_id AND a.consumed_at IS NOT NULL
++    AND b.state='claimed' AND b.prior_batch_id=OLD.batch_id
++    AND EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.event_id
++      AND e.canonical_event=NEW.canonical_event)) THEN RETURN NEW; END IF;
++  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
++   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
++   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
++  RAISE EXCEPTION 'immutable pending membership';
++ END IF;
++ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
++  IF OLD.state IN ('acked','superseded') AND NEW IS DISTINCT FROM OLD THEN
++   RAISE EXCEPTION 'terminal archive state immutable'; END IF;
++  IF NEW.state='superseded' AND OLD.state<>'superseded' AND NOT EXISTS(
++   SELECT FROM public.public_archive_supersessions s
++   JOIN public.public_archive_recovery_authorizations a ON a.authorization_id=s.authorization_id
++   WHERE s.old_batch_id=OLD.batch_id AND a.replacement_batch_id=s.new_batch_id
++    AND a.consumed_at IS NOT NULL AND OLD.eligible_until<=lifecycle_private.archive_clock()) THEN
++   RAISE EXCEPTION 'explicit consumed archive replacement authorization required'; END IF;
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
++
++DO $$ DECLARE t text; BEGIN
++ FOREACH t IN ARRAY ARRAY['public_archive_recovery_authorizations','public_archive_supersessions'] LOOP
++  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
++  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
++  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
++  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
++ END LOOP;
++END $$;
++DROP TRIGGER IF EXISTS archive_immutable ON public_archive_supersessions;
++CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public_archive_supersessions FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_supersessions;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_supersessions FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row();
++DROP TRIGGER IF EXISTS archive_authorization_consume ON public_archive_recovery_authorizations;
++CREATE TRIGGER archive_authorization_consume BEFORE UPDATE OR DELETE ON public_archive_recovery_authorizations FOR EACH ROW EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();
++DROP TRIGGER IF EXISTS archive_no_truncate ON public_archive_recovery_authorizations;
++CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public_archive_recovery_authorizations FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.consume_archive_authorization();
++
++-- Payload/config integrity failures are durable operator work, never dropped events.
++CREATE TABLE IF NOT EXISTS public_archive_quarantine (
++ batch_id uuid PRIMARY KEY, diagnostic_code text NOT NULL CHECK(diagnostic_code='invalid_archive'),
++ quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp()
++);
++ALTER TABLE public_archive_quarantine ENABLE ROW LEVEL SECURITY;
++REVOKE ALL ON public_archive_quarantine FROM PUBLIC,anon,authenticated;
++DROP TRIGGER IF EXISTS lifecycle_gate ON public_archive_quarantine;
++CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public_archive_quarantine
++ FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate();
++
++INSERT INTO schema_migrations(filename) VALUES('2026-10-03-07-archive-export.sql') ON CONFLICT DO NOTHING;
+diff --git a/tests/test_archive_export.py b/tests/test_archive_export.py
+new file mode 100644
+index 0000000..4f77f43
+--- /dev/null
++++ b/tests/test_archive_export.py
+@@ -0,0 +1,283 @@
++"""Task11 offline request/integrity contracts. No provider calls."""
++
++import io
++from datetime import UTC, datetime, timedelta
++from uuid import uuid4
++import pytest
++from botocore.exceptions import ClientError, ReadTimeoutError
++from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
++from job_discovery.archive.batches import seal_batch
++from job_discovery.archive.codec import canonical_json
++from job_discovery.archive.types import BatchRef
++from job_discovery.lifecycle.types import ClaimRef
++from job_discovery.archive.schema import event_id
++
++
++@pytest.fixture(autouse=True)
++def offline_aws(monkeypatch):
++    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
++    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "offline-fake")
++    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "offline-fake")
++
++
++def destination():
++    return Destination("fixture-bucket", "us-east-1", "fixture/public", "123456789012")
++
++
++def sealed():
++    now = datetime.now(UTC)
++    aid = str(uuid4())
++    eid = event_id("brands", aid, 1)
++    event = dict(
++        event_id=str(eid),
++        aggregate_type="brands",
++        aggregate_id=aid,
++        revision=1,
++        predecessor_id=None,
++        kind="baseline",
++        body={"id": aid, "name": "Public"},
++        occurred_at=now.isoformat(),
++        observed_at=None,
++        recorded_at=now.isoformat(),
++        provenance="current_baseline",
++        schema_version=1,
++    )
++    return seal_batch(
++        BatchRef(
++            uuid4(),
++            ClaimRef("fixture", 1, now + timedelta(seconds=180)),
++            (eid,),
++            1,
++            now,
++            now + timedelta(days=730),
++            (canonical_json(event),),
++            object_prefix="fixture/public",
++        )
++    )
++
++
++class FakeS3:
++    def __init__(self):
++        self.objects = {}
++        self.calls = []
++        self.bodies = []
++        self.ambiguous = False
++        self.meta = type("Meta", (), {"region_name": "us-east-1"})()
++
++    def put_object(self, **kwargs):
++        self.calls.append(("put", kwargs))
++        assert kwargs["IfNoneMatch"] == "*"
++        key = kwargs["Key"]
++        if key in self.objects:
++            raise ClientError(
++                {
++                    "Error": {"Code": "PreconditionFailed"},
++                    "ResponseMetadata": {"HTTPStatusCode": 412},
++                },
++                "PutObject",
++            )
++        self.objects[key] = kwargs["Body"]
++        if self.ambiguous:
++            self.ambiguous = False
++            raise ReadTimeoutError(endpoint_url="https://offline.invalid")
++        return {}
++
++    def get_object(self, **kwargs):
++        self.calls.append(("get", kwargs))
++        key = kwargs["Key"]
++        if key not in self.objects:
++            raise ClientError(
++                {
++                    "Error": {"Code": "NoSuchKey"},
++                    "ResponseMetadata": {"HTTPStatusCode": 404},
++                },
++                "GetObject",
++            )
++        body = io.BytesIO(self.objects[key])
++        self.bodies.append(body)
++        return {
++            "Body": body,
++            "ContentLength": len(self.objects[key]),
++            "VersionId": "offline-version",
++        }
++
++
++@pytest.mark.parametrize("mode", ["new", "existing", "data-only", "ambiguous"])
++def test_conditional_exact_retry(mode):
++    seal = sealed()
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    if mode in {"existing", "data-only"}:
++        sdk.objects[seal.data_key] = seal.compressed_data
++    if mode == "existing":
++        sdk.objects[seal.manifest_key] = seal.manifest_data
++    sdk.ambiguous = mode == "ambiguous"
++    verified = put_verify_batch(seal, client)
++    assert verified.seal == seal
++    assert sdk.objects == {
++        seal.data_key: seal.compressed_data,
++        seal.manifest_key: seal.manifest_data,
++    }
++    assert all(b.closed for b in sdk.bodies)
++    assert "offline-version" in verified.data_receipt.receipt
++
++
++@pytest.mark.parametrize("which", ["data", "manifest"])
++def test_corrupt_existing_fails_closed(which):
++    seal = sealed()
++    sdk = FakeS3()
++    sdk.objects[getattr(seal, which + "_key")] = b"corrupt"
++    with pytest.raises(ValueError):
++        put_verify_batch(seal, ArchiveClient(destination(), sdk))
++    assert all(b.closed for b in sdk.bodies)
++
++
++def test_sdk_stubber_request_contract():
++    import boto3
++    from botocore.stub import Stubber
++
++    sdk = boto3.client(
++        "s3",
++        region_name="us-east-1",
++        aws_access_key_id="fake",
++        aws_secret_access_key="fake",
++    )
++    client = ArchiveClient(destination(), sdk)
++    seal = sealed()
++    with Stubber(sdk) as stub:
++        for key, data in [
++            (seal.data_key, seal.compressed_data),
++            (seal.manifest_key, seal.manifest_data),
++        ]:
++            params = client.put_parameters(key, data)
++            stub.add_client_error(
++                "put_object",
++                service_error_code="PreconditionFailed",
++                http_status_code=412,
++                expected_params=params,
++            )
++            stub.add_response(
++                "get_object",
++                {"Body": io.BytesIO(data), "ContentLength": len(data)},
++                {
++                    "Bucket": "fixture-bucket",
++                    "Key": key,
++                    "ExpectedBucketOwner": "123456789012",
++                    "ChecksumMode": "ENABLED",
++                },
++            )
++        assert put_verify_batch(seal, client).seal == seal
++        stub.assert_no_pending_responses()
++
++
++@pytest.mark.parametrize(
++    "case", ["oversize", "lying-length", "checksum", "read-error", "deadline", "bomb"]
++)
++def test_bounded_body_closed_for_all_read_failures(case):
++    import gzip
++    import time
++
++    seal = sealed()
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    raw = gzip.compress(b"x" * (8 * 1024**2 + 1)) if case == "bomb" else b"abc"
++
++    class Body(io.BytesIO):
++        def read(self, n=-1):
++            assert n > 0
++            if case == "read-error":
++                raise OSError("offline read failure")
++            return super().read(n)
++
++    body = Body(raw)
++    response = {"Body": body, "ContentLength": len(raw)}
++    if case == "oversize":
++        response["ContentLength"] = 17 * 1024**2
++    if case == "lying-length":
++        response["ContentLength"] = 1
++    if case == "checksum":
++        response["ChecksumSHA256"] = "incorrect"
++
++    def get(**kw):
++        return response
++
++    sdk.get_object = get
++    if case == "deadline":
++        # Expiry after Get guarantees that an acquired stream is still closed.
++        calls = iter([0, 2])
++        from unittest.mock import patch
++
++        with patch(
++            "job_discovery.archive.s3.time.monotonic", side_effect=lambda: next(calls)
++        ):
++            with pytest.raises(TimeoutError):
++                client.bounded_read(seal.data_key, 10, 1)
++    else:
++        with pytest.raises((ValueError, OSError)):
++            client.bounded_read(
++                seal.data_key,
++                2 if case in {"lying-length", "bomb"} else 16 * 1024**2,
++                time.monotonic() + 10,
++            )
++    assert body.closed
++
++
++@pytest.mark.parametrize(
++    "field,value",
++    [
++        ("canonical_hash", "0" * 64),
++        ("manifest_hash", "0" * 64),
++        ("event_count", 999),
++        ("manifest_data", b"{}"),
++    ],
++)
++def test_complete_seal_contract_before_upload(field, value):
++    from dataclasses import replace
++
++    sdk = FakeS3()
++    with pytest.raises(ValueError):
++        put_verify_batch(
++            replace(sealed(), **{field: value}), ArchiveClient(destination(), sdk)
++        )
++    assert not sdk.calls
++
++
++def test_non_412_errors_propagate_without_read():
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++
++    def denied(**kw):
++        raise ClientError(
++            {
++                "Error": {"Code": "AccessDenied"},
++                "ResponseMetadata": {"HTTPStatusCode": 403},
++            },
++            "PutObject",
++        )
++
++    sdk.put_object = denied
++    with pytest.raises(ClientError):
++        put_verify_batch(sealed(), client)
++    assert not sdk.bodies
++
++
++def test_explicit_sdk_configuration(monkeypatch):
++    import job_discovery.archive.s3 as module
++
++    captured = {}
++
++    class Session:
++        def client(self, *args, **kwargs):
++            captured.update(kwargs)
++            return FakeS3()
++
++    monkeypatch.setattr(module.boto3.session, "Session", lambda **kw: Session())
++    ArchiveClient.from_destination(destination())
++    cfg = captured["config"]
++    assert (cfg.connect_timeout, cfg.read_timeout, cfg.max_pool_connections) == (
++        3,
++        5,
++        2,
++    )
++    assert cfg.retries == {"total_max_attempts": 2, "mode": "standard"}
++    assert not hasattr(ArchiveClient, "delete_object")
+diff --git a/tests/test_archive_privacy.py b/tests/test_archive_privacy.py
+new file mode 100644
+index 0000000..5095beb
+--- /dev/null
++++ b/tests/test_archive_privacy.py
+@@ -0,0 +1,66 @@
++"""New archive public payload/configuration correctness, no role/security probes."""
++
++from dataclasses import replace
++import pytest
++from tests.test_archive_export import sealed, destination, FakeS3
++from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
++from job_discovery.archive.batches import seal_batch
++from job_discovery.archive.codec import canonical_json
++import json
++
++
++def test_private_field_and_path_rejected_before_io(caplog):
++    seal = sealed()
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    event = json.loads(seal.batch.event_bytes[0])
++    event["body"]["private_notes"] = "private-sentinel"
++    bad = seal_batch(replace(seal.batch, event_bytes=(canonical_json(event),)))
++    with pytest.raises(ValueError):
++        put_verify_batch(bad, client)
++    with pytest.raises(ValueError):
++        put_verify_batch(replace(seal, data_key="../private"), client)
++    assert not sdk.calls
++    assert "private-sentinel" not in caplog.text
++
++
++@pytest.mark.parametrize(
++    "prefix", ["../public", "public//events", "https://bucket", "public?x=y"]
++)
++def test_invalid_service_prefix(prefix):
++    with pytest.raises(ValueError):
++        Destination("fixture-bucket", "us-east-1", prefix, "123456789012")
++
++
++def test_region_and_prefix_must_match():
++    sdk = FakeS3()
++    sdk.meta.region_name = "eu-west-1"
++    with pytest.raises(ValueError):
++        ArchiveClient(destination(), sdk)
++    with pytest.raises(ValueError):
++        put_verify_batch(
++            sealed(),
++            ArchiveClient(replace(destination(), object_prefix="other"), FakeS3()),
++        )
++
++
++def test_worker_diagnostics_never_log_provider_body_or_url(monkeypatch, caplog):
++    import reviewer.archive_worker as worker
++    from botocore.exceptions import ClientError
++
++    def fail(_):
++        raise ClientError(
++            {
++                "Error": {
++                    "Code": "AccessDenied",
++                    "Message": "private-sentinel https://signed.invalid?secret=sentinel",
++                }
++            },
++            "PutObject",
++        )
++
++    monkeypatch.setattr(worker, "export_once", fail)
++    monkeypatch.setattr(worker.signal, "signal", lambda *_: None)
++    assert worker.main() == 1
++    assert "ClientError" in caplog.text
++    assert "sentinel" not in caplog.text and "https://" not in caplog.text
+diff --git a/tests/test_archive_retention_recovery.py b/tests/test_archive_retention_recovery.py
+new file mode 100644
+index 0000000..30e99a6
+--- /dev/null
++++ b/tests/test_archive_retention_recovery.py
+@@ -0,0 +1,490 @@
++"""Persisted Task11 ordinary crash recovery; isolated DB and fake S3 only.
++
++Archive-clock substitution below exists only in the disposable test database.
++It never changes lifecycle claim time, capacity, roles, production GUCs or controls.
++"""
++
++import json
++from dataclasses import replace
++from datetime import timedelta
++from uuid import uuid4
++import pytest
++from psycopg import sql
++from job_discovery import db
++from job_discovery.archive import export as worker
++from job_discovery.archive.batches import (
++    claim_batch,
++    seal_batch,
++    persist_seal,
++    ack_batch,
++    recover_batch,
++)
++from job_discovery.archive.types import BatchLimits
++from job_discovery.archive.recovery import RecoveryAuthorization, replace_expired_batch
++from job_discovery.archive.s3 import ArchiveClient, put_verify_batch
++from job_discovery.archive.outbox import ArchiveBlocked
++from job_discovery.lifecycle.claims import claim_work, cancel_claim
++from tests.archive_helpers import seeded_events
++from tests.conftest import TEST_DSN, requires_db
++from tests.test_archive_export import FakeS3, destination
++
++pytestmark = requires_db
++
++
++def setup_batch(conn, n=3):
++    claim, refs = seeded_events(conn, n)
++    conn.execute(
++        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
++    )
++    conn.execute(
++        "UPDATE lifecycle_control SET export_enabled=true,activation_generation=activation_generation+1"
++    )
++    conn.execute(
++        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
++    )
++    conn.execute("""UPDATE public_archive_destination SET bucket='fixture-bucket',region='us-east-1',expected_owner='123456789012',
++        private_validated=true,encryption_validated=true,policy_validated=true,validation_evidence='offline fixture only'""")
++    batch = claim_batch(conn, BatchLimits(max_events=2), claim)
++    conn.commit()
++    cancel_claim(conn, claim)
++    conn.commit()
++    return batch, refs
++
++
++def pending(conn):
++    result = tuple(
++        (
++            r["event_id"],
++            bytes(r["canonical_event"]),
++            r["occurred_at"],
++            json.loads(bytes(r["canonical_event"]))["observed_at"],
++            r["recorded_at"],
++            r["revision"],
++        )
++        for r in conn.execute("SELECT * FROM public_pending_events ORDER BY event_id")
++    )
++    conn.commit()
++    return result
++
++
++class Crash(BaseException):
++    pass
++
++
++@pytest.mark.parametrize(
++    "phase",
++    ["seal", "data", "manifest", "ambiguous", "verify", "ack-rollback", "ack-commit"],
++)
++def test_fresh_worker_connection_recovers_each_persisted_boundary(
++    conn, monkeypatch, phase
++):
++    batch, refs = setup_batch(conn)
++    original_pending = pending(conn)
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    opened = []
++    original_connect = db.connect
++
++    def connect(dsn):
++        fresh = original_connect(dsn)
++        opened.append(fresh)
++        return fresh
++
++    monkeypatch.setattr(worker.db, "connect", connect)
++    original_seal = worker.persist_seal
++    original_verify = worker.put_verify_batch
++    original_ack = worker.ack_batch
++    if phase == "seal":
++
++        def crash_seal(c, s):
++            original_seal(c, s)
++            c.commit()
++            raise Crash()
++
++        monkeypatch.setattr(worker, "persist_seal", crash_seal)
++    elif phase in {"data", "manifest"}:
++        original_put = sdk.put_object
++
++        def crash_put(**kw):
++            original_put(**kw)
++            if kw["Key"].endswith(".jsonl.gz" if phase == "data" else ".manifest.json"):
++                raise Crash()
++
++        monkeypatch.setattr(sdk, "put_object", crash_put)
++    elif phase == "ambiguous":
++        sdk.ambiguous = True
++
++        def crash_read(**kwargs):
++            raise Crash()
++
++        monkeypatch.setattr(sdk, "get_object", crash_read)
++    elif phase == "verify":
++
++        def crash_verify(s, c):
++            original_verify(s, c)
++            raise Crash()
++
++        monkeypatch.setattr(worker, "put_verify_batch", crash_verify)
++    else:
++
++        def crash_ack(c, v, cl):
++            original_ack(c, v, cl)
++            if phase == "ack-commit":
++                c.commit()
++            raise Crash()
++
++        monkeypatch.setattr(worker, "ack_batch", crash_ack)
++    with pytest.raises(Crash):
++        worker.export_once(TEST_DSN, client)
++    assert len(opened) == 1 and opened[0].closed
++    state = conn.execute(
++        "SELECT * FROM public_archive_batches WHERE batch_id=%s", (batch.batch_id,)
++    ).fetchone()
++    conn.commit()
++    old_claim = replace(
++        batch.claim, owner_token=state["owner_token"], generation=state["generation"]
++    )
++    before_retry = dict(sdk.objects)
++    if phase != "ack-commit":
++        assert pending(conn) == original_pending
++    # Discard the first worker/client AND connection; immutable object storage persists.
++    monkeypatch.setattr(worker, "persist_seal", original_seal)
++    monkeypatch.setattr(worker, "put_verify_batch", original_verify)
++    monkeypatch.setattr(worker, "ack_batch", original_ack)
++    monkeypatch.setattr(sdk, "put_object", FakeS3.put_object.__get__(sdk))
++    monkeypatch.setattr(sdk, "get_object", FakeS3.get_object.__get__(sdk))
++    fresh_client = ArchiveClient(destination(), sdk)
++    result = worker.export_once(TEST_DSN, fresh_client)
++    assert len(opened) == 2 and opened[1].closed and opened[0] is not opened[1]
++    if phase != "ack-commit":
++        assert result.exact_event_ids == batch.ordered_event_ids
++    assert all(sdk.objects[k] == v for k, v in before_retry.items())
++    assert {r[0] for r in pending(conn)} == {r.event_id for r in refs} - set(
++        batch.ordered_event_ids
++    )
++    row = conn.execute(
++        "SELECT * FROM public_archive_batches WHERE batch_id=%s", (batch.batch_id,)
++    ).fetchone()
++    assert (
++        row["state"] == "acked"
++        and row["sealed_at"] == batch.sealed_at
++        and row["eligible_until"] == batch.eligible_until
++    )
++    conn.commit()
++    with pytest.raises((RuntimeError, ArchiveBlocked)), conn.transaction():
++        ack_batch(
++            conn,
++            put_verify_batch(seal_batch(replace(batch, claim=old_claim)), fresh_client),
++            old_claim,
++        )
++
++
++def set_archive_clock(conn, instant):
++    # Dedicated archive eligibility clock only. No user setting or production setter.
++    conn.execute(
++        sql.SQL(
++            "CREATE OR REPLACE FUNCTION lifecycle_private.archive_clock() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS {}"
++        ).format(
++            sql.Literal(
++                "SELECT " + sql.Literal(instant).as_string(conn) + "::timestamptz"
++            )
++        )
++    )
++    conn.commit()
++
++
++@pytest.mark.parametrize("replacement_crash", ["data", "ack-rollback"])
++def test_verify_ack_crosses_archive_horizon_then_explicit_replacement(
++    conn, monkeypatch, replacement_crash
++):
++    batch, refs = setup_batch(conn)
++    claim = claim_work(conn, "archive-export", "singleton", 180)
++    ref = recover_batch(conn, batch.batch_id, claim)
++    conn.commit()
++    seal = seal_batch(ref)
++    persist_seal(conn, seal)
++    conn.commit()
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    verified = put_verify_batch(seal, client)
++    original = pending(conn)
++    set_archive_clock(conn, ref.eligible_until + timedelta(seconds=1))
++    with pytest.raises(ArchiveBlocked, match="expired"), conn.transaction():
++        ack_batch(conn, verified, claim)
++    with pytest.raises(ArchiveBlocked, match="authorization"), conn.transaction():
++        replace_expired_batch(conn, ref.batch_id, claim, RecoveryAuthorization(uuid4()))
++    assert pending(conn) == original
++    cancel_claim(conn, claim)
++    conn.commit()
++    before = len(sdk.calls)
++    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
++    assert len(sdk.calls) == before and pending(conn) == original
++    authorization = uuid4()
++    conn.execute(
++        """INSERT INTO public_archive_recovery_authorizations(authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
++        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator','explicit offline recovery',clock_timestamp()+interval '1 hour'
++        FROM public_archive_batches WHERE batch_id=%s""",
++        (authorization, ref.batch_id),
++    )
++    conn.commit()
++    fresh = db.connect(TEST_DSN)
++    try:
++        new_claim = claim_work(fresh, "archive-export", "singleton", 180)
++        fresh.commit()
++        with pytest.raises(Crash), fresh.transaction():
++            replace_expired_batch(
++                fresh, ref.batch_id, new_claim, RecoveryAuthorization(authorization)
++            )
++            raise Crash()
++        assert (
++            fresh.execute(
++                "SELECT consumed_at FROM public_archive_recovery_authorizations WHERE authorization_id=%s",
++                (authorization,),
++            ).fetchone()["consumed_at"]
++            is None
++        )
++        fresh.commit()
++        replacement = replace_expired_batch(
++            fresh, ref.batch_id, new_claim, RecoveryAuthorization(authorization)
++        )
++        fresh.commit()
++        assert replacement.ordered_event_ids == ref.ordered_event_ids
++        assert replacement.event_bytes == ref.event_bytes
++        assert (
++            replacement.prior_batch_id == ref.batch_id
++            and replacement.batch_id != ref.batch_id
++        )
++        assert replacement.sealed_at > ref.eligible_until
++        assert replacement.eligible_until - replacement.sealed_at == timedelta(days=730)
++        cancel_claim(fresh, new_claim)
++        fresh.commit()
++    finally:
++        fresh.close()
++    assert pending(conn) == original
++    with pytest.raises((ArchiveBlocked, RuntimeError)), conn.transaction():
++        ack_batch(conn, verified, claim)
++    original_put = sdk.put_object
++    original_ack = worker.ack_batch
++    if replacement_crash == "data":
++
++        def crash_put(**kwargs):
++            original_put(**kwargs)
++            raise Crash()
++
++        monkeypatch.setattr(sdk, "put_object", crash_put)
++    else:
++
++        def crash_ack(connection, verified, owner):
++            original_ack(connection, verified, owner)
++            raise Crash()
++
++        monkeypatch.setattr(worker, "ack_batch", crash_ack)
++    with pytest.raises(Crash):
++        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
++    assert pending(conn) == original
++    monkeypatch.setattr(sdk, "put_object", original_put)
++    monkeypatch.setattr(worker, "ack_batch", original_ack)
++    assert (
++        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)).exact_event_ids
++        == ref.ordered_event_ids
++    )
++    assert sdk.objects[seal.data_key] == seal.compressed_data
++    assert (
++        conn.execute(
++            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
++            (ref.batch_id,),
++        ).fetchone()["state"]
++        == "superseded"
++    )
++    assert (
++        conn.execute(
++            "SELECT replacement_batch_id FROM public_archive_recovery_authorizations WHERE authorization_id=%s",
++            (authorization,),
++        ).fetchone()["replacement_batch_id"]
++        == replacement.batch_id
++    )
++    conn.commit()
++    assert {r[0] for r in pending(conn)} == {r.event_id for r in refs} - set(
++        ref.ordered_event_ids
++    )
++
++
++def test_corrupt_manifest_keeps_persisted_pending(conn):
++    batch, _ = setup_batch(conn)
++    seal = seal_batch(batch)
++    sdk = FakeS3()
++    sdk.objects[seal.manifest_key] = b"corrupt"
++    before = pending(conn)
++    with pytest.raises(ValueError):
++        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
++    assert pending(conn) == before
++    calls = len(sdk.calls)
++    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
++    assert len(sdk.calls) == calls and pending(conn) == before
++    assert (
++        conn.execute(
++            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
++            (batch.batch_id,),
++        ).fetchone()["state"]
++        == "sealed"
++    )
++    assert (
++        conn.execute(
++            "SELECT diagnostic_code FROM public_archive_quarantine"
++        ).fetchone()["diagnostic_code"]
++        == "invalid_archive"
++    )
++    conn.commit()
++
++
++def test_flag_off_and_unvalidated_destination_never_touch_sdk(conn):
++    sdk = FakeS3()
++    client = ArchiveClient(destination(), sdk)
++    assert worker.export_once(TEST_DSN, client) is None
++    setup_batch(conn)
++    conn.execute("UPDATE public_archive_destination SET private_validated=false")
++    conn.commit()
++    with pytest.raises(ArchiveBlocked, match="validation"):
++        worker.export_once(TEST_DSN, client)
++    assert not sdk.calls
++
++
++def test_periodic_cleanup_is_bounded_and_retains_pending_and_markers(conn):
++    batch, _ = setup_batch(conn)
++    worker.export_once(TEST_DSN, ArchiveClient(destination(), FakeS3()))
++    before = pending(conn)
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
++    claim = claim_work(conn, "archive-export", "cleanup-fixture", 180)
++    conn.commit()
++    for _ in range(4):
++        assert worker.cleanup_terminal(conn, claim, limit=1) == 1
++        conn.commit()
++    assert worker.cleanup_terminal(conn, claim, limit=1) == 0
++    conn.commit()
++    assert pending(conn) == before
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_coverage").fetchone()["n"]
++        == 2
++    )
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_batch_markers").fetchone()[
++            "n"
++        ]
++        == 1
++    )
++    assert (
++        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
++        == 0
++    )
++
++
++def test_quarantine_allows_unaffected_preclaimed_aggregate(conn):
++    batch, refs = setup_batch(conn)
++    claim = claim_work(conn, "archive", "healthy-fixture", 180)
++    healthy = claim_batch(conn, BatchLimits(), claim)
++    conn.commit()
++    cancel_claim(conn, claim)
++    conn.commit()
++    sdk = FakeS3()
++    sdk.objects[seal_batch(batch).manifest_key] = b"corrupt"
++    with pytest.raises(ValueError):
++        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
++    result = worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
++    assert result.exact_event_ids == healthy.ordered_event_ids
++    assert {row[0] for row in pending(conn)} == set(batch.ordered_event_ids)
++
++
++def test_new_small_batch_waits_then_flushes_without_network_transaction(
++    conn, monkeypatch
++):
++    # Setup enables only the owned fixture, then put newly seeded events through
++    # the real worker's unassigned-batch path. The scalar aggregate query's aged
++    # result is injected locally, without modifying any persisted event or clock.
++    seeded_events(conn, 1)
++    conn.execute(
++        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
++    )
++    conn.execute(
++        "UPDATE lifecycle_control SET export_enabled=true,activation_generation=activation_generation+1"
++    )
++    conn.execute(
++        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
++    )
++    conn.execute("""UPDATE public_archive_destination SET bucket='fixture-bucket',region='us-east-1',expected_owner='123456789012',
++        private_validated=true,encryption_validated=true,policy_validated=true,validation_evidence='offline fixture only'""")
++    conn.commit()
++    sdk = FakeS3()
++    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
++    assert not sdk.calls
++    original_connect = db.connect
++    opened = []
++
++    class Connection:
++        def __init__(self, inner):
++            self.inner = inner
++
++        def __getattr__(self, name):
++            return getattr(self.inner, name)
++
++        def execute(self, query, params=None):
++            cursor = self.inner.execute(query, params)
++            if isinstance(query, str) and "min(recorded_at)" in query:
++                row = cursor.fetchone()
++                assert row["n"] == 1 and row["aged"] is False
++
++                class Result:
++                    def fetchone(self):
++                        return dict(row, aged=True)
++
++                return Result()
++            return cursor
++
++    def connect(dsn):
++        fresh = Connection(original_connect(dsn))
++        opened.append(fresh)
++        return fresh
++
++    monkeypatch.setattr(worker.db, "connect", connect)
++    from psycopg.pq import TransactionStatus
++
++    original_put = sdk.put_object
++
++    def put(**kwargs):
++        assert opened[-1].info.transaction_status == TransactionStatus.IDLE
++        return original_put(**kwargs)
++
++    sdk.put_object = put
++    result = worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
++    assert len(result.exact_event_ids) == 1 and opened[-1].closed
++    assert not pending(conn)
++
++
++def test_task11_additive_migration_reapplies_without_catalog_drift(conn):
++    from pathlib import Path
++    from tests.lifecycle_helpers import schema_catalog
++
++    before = schema_catalog(conn)
++    conn.commit()
++    migration = Path("migrations/2026-10-03-07-archive-export.sql").read_text()
++    conn.execute(migration)
++    conn.commit()
++    assert schema_catalog(conn) == before
++    conn.commit()
++    assert not conn.execute("SELECT * FROM public_archive_destination").fetchall()
++    control = conn.execute(
++        "SELECT archive_ever_activated,export_enabled,archive_stage FROM lifecycle_control"
++    ).fetchone()
++    assert control == dict(
++        archive_ever_activated=False,
++        export_enabled=False,
++        archive_stage="never_activated",
++    )
+diff --git a/tests/test_lifecycle_supervisor.py b/tests/test_lifecycle_supervisor.py
+index f3c1095..e19bd72 100644
+--- a/tests/test_lifecycle_supervisor.py
++++ b/tests/test_lifecycle_supervisor.py
+@@ -1,30 +1,31 @@
+ """Ordinary process/worker tests; no excluded lifecycle security probes."""
++
+ import importlib
+ import json
+ from pathlib import Path
+ import subprocess
+ import sys
+ import threading
+ import time
+ 
+ import pytest
+ 
+ from tests.conftest import TEST_DSN, requires_db
+ 
+ 
+ def supervisor():
+-    return importlib.import_module('reviewer.supervisor')
++    return importlib.import_module("reviewer.supervisor")
+ 
+ 
+ def maintenance_worker():
+-    return importlib.import_module('job_discovery.lifecycle.worker')
++    return importlib.import_module("job_discovery.lifecycle.worker")
+ 
+ 
+ class Clock:
+     now = 0.0
+ 
+     def __call__(self):
+         return self.now
+ 
+ 
+ class Stop:
+@@ -45,366 +46,502 @@ class Stop:
+ class Child:
+     def __init__(self, clock, duration=None, code=0, ignores_term=False):
+         self.clock = clock
+         self.started = clock()
+         self.duration, self.code = duration, code
+         self.returncode = None
+         self.ignores_term = ignores_term
+         self.terminated = self.killed = None
+ 
+     def poll(self):
+-        if self.returncode is None and self.duration is not None and self.clock() >= self.started + self.duration:
++        if (
++            self.returncode is None
++            and self.duration is not None
++            and self.clock() >= self.started + self.duration
++        ):
+             self.returncode = self.code
+         return self.returncode
+ 
+     def terminate(self):
+         self.terminated = self.clock()
+         if not self.ignores_term:
+             self.returncode = -15
+ 
+     def kill(self):
+         self.killed = self.clock()
+         self.returncode = -9
+ 
+     def wait(self, timeout=None):
+-        assert timeout is not None and timeout <= 1, 'no unbounded child join'
++        assert timeout is not None and timeout <= 1, "no unbounded child join"
+         assert self.poll() is not None
+         return self.returncode
+ 
+ 
+ def test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps():
+     s = supervisor()
+     clock = Clock()
+     stop = Stop(clock, 1805)
+     children = []
+ 
+     def spawn(name):
+-        child = Child(clock, duration=1 if name == 'maintenance' else None)
++        child = Child(clock, duration=1 if name == "maintenance" else None)
+         children.append((name, child))
+         return child
+ 
+     assert s.supervise(stop, spawn, clock) == 0
+-    assert [c.started for name, c in children if name == 'maintenance'] == [0, 900, 1800]
+-    assert len([1 for name, _ in children if name == 'reviewer']) == 1
++    assert [c.started for name, c in children if name == "maintenance"] == [
++        0,
++        900,
++        1800,
++    ]
++    assert len([1 for name, _ in children if name == "reviewer"]) == 1
+     assert max(stop.waits) <= 5
+ 
+ 
+-def test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts(monkeypatch):
++def test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts(
++    monkeypatch,
++):
+     s = supervisor()
+     clock = Clock()
+-    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
++    monkeypatch.setattr(
++        s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++    )
+     stop = Stop(clock, 1810)
+     children = []
+ 
+     def spawn(name):
+         prior = sum(n == name for n, _ in children)
+-        child = Child(clock, duration=1 if prior == 0 and name == 'reviewer' else None,
+-                      code=1, ignores_term=True)
+-        if name == 'maintenance' and prior == 1:
++        child = Child(
++            clock,
++            duration=1 if prior == 0 and name == "reviewer" else None,
++            code=1,
++            ignores_term=True,
++        )
++        if name == "maintenance" and prior == 1:
+             child.duration = 1  # crash second maintenance attempt
+         children.append((name, child))
+         return child
+ 
+     assert s.supervise(stop, spawn, clock) == 0
+-    maint = [c for n, c in children if n == 'maintenance']
++    maint = [c for n, c in children if n == "maintenance"]
+     assert [c.started for c in maint] == [0, 900, 1800]
+     assert maint[0].killed == 90
+-    assert [c.started for n, c in children if n == 'reviewer'] == [0, 5]
++    assert [c.started for n, c in children if n == "reviewer"] == [0, 5]
+     assert clock() <= 1840
+ 
+ 
+ def test_shutdown_has_one_global_30_second_drain_and_no_new_children(monkeypatch):
+     s = supervisor()
+     clock = Clock()
+-    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
++    monkeypatch.setattr(
++        s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++    )
+     children = []
+ 
+     def spawn(name):
+         child = Child(clock, ignores_term=True)
+         children.append(child)
+         return child
+ 
+     assert s.supervise(Stop(clock, 10), spawn, clock) == 0
+-    assert len(children) == 2
+-    assert [c.terminated for c in children] == [10, 10]
+-    assert [c.killed for c in children] == [40, 40]
++    assert len(children) == 3
++    assert [c.terminated for c in children] == [10, 10, 10]
++    assert [c.killed for c in children] == [40, 40, 40]
+     assert clock() == 40
+ 
+ 
+ def test_spawn_failure_returns_nonzero_and_drains_started_sibling(monkeypatch):
+     s = supervisor()
+     clock = Clock()
+-    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
++    monkeypatch.setattr(
++        s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++    )
+     reviewer = Child(clock, ignores_term=True)
+ 
+     def spawn(name):
+-        if name == 'maintenance':
+-            raise OSError('cannot spawn')
++        if name == "maintenance":
++            raise OSError("cannot spawn")
+         return reviewer
+ 
+     assert s.supervise(Stop(clock, 9999), spawn, clock) == 1
+     assert reviewer.killed == 30
+ 
+ 
+ def test_already_stopped_starts_nothing():
+     s = supervisor()
+     assert s.supervise(Stop(Clock(), 0), lambda name: pytest.fail(name), Clock()) == 0
+ 
+ 
+ def test_deployment_only_changes_reviewer_command():
+-    cfg = json.loads(Path('railway.reviewer-worker.json').read_text())['deploy']
+-    assert cfg == {'startCommand': 'python -m reviewer.supervisor',
+-                   'restartPolicyType': 'ON_FAILURE', 'restartPolicyMaxRetries': 100}
+-    assert json.loads(Path('railway.json').read_text())['deploy'] == {'startCommand': 'python -m job_discovery'}
++    cfg = json.loads(Path("railway.reviewer-worker.json").read_text())["deploy"]
++    assert cfg == {
++        "startCommand": "python -m reviewer.supervisor",
++        "restartPolicyType": "ON_FAILURE",
++        "restartPolicyMaxRetries": 100,
++    }
++    assert json.loads(Path("railway.json").read_text())["deploy"] == {
++        "startCommand": "python -m job_discovery"
++    }
+     # Cron is configured outside railway.json; the command remains one-shot.
+-    assert 'supervisor' not in Path('job_discovery/__main__.py').read_text()
++    assert "supervisor" not in Path("job_discovery/__main__.py").read_text()
+ 
+ 
+ def test_real_children_deadline_and_terminated_external_cron(monkeypatch):
+     s = supervisor()
+-    monkeypatch.setattr(s, 'CHECK_SECONDS', 0.02)
+-    monkeypatch.setattr(s, 'MAINTENANCE_INTERVAL_SECONDS', 0.30)
+-    monkeypatch.setattr(s, 'MAINTENANCE_DEADLINE_SECONDS', 0.12)
+-    monkeypatch.setattr(s, 'DRAIN_SECONDS', 0.08)
++    monkeypatch.setattr(s, "CHECK_SECONDS", 0.02)
++    monkeypatch.setattr(s, "MAINTENANCE_INTERVAL_SECONDS", 0.30)
++    monkeypatch.setattr(s, "MAINTENANCE_DEADLINE_SECONDS", 0.12)
++    monkeypatch.setattr(s, "DRAIN_SECONDS", 0.08)
+     stop = threading.Event()
+     children = []
+-    cron = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
++    cron = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
+     timer = threading.Timer(0.75, stop.set)
+ 
+     def spawn(name):
+-        p = subprocess.Popen([sys.executable, '-c',
+-            'import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)'])
++        p = subprocess.Popen(
++            [
++                sys.executable,
++                "-c",
++                "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)",
++            ]
++        )
+         children.append((name, p))
+         return p
+ 
+     began = time.monotonic()
+     try:
+         cron.terminate()
+         cron.wait(timeout=2)
+         timer.start()
+         assert s.supervise(stop, spawn, time.monotonic) == 0
+         assert time.monotonic() - began < 3
+-        assert sum(n == 'maintenance' for n, _ in children) >= 2
++        assert sum(n == "maintenance" for n, _ in children) >= 2
+         assert all(p.poll() is not None for _, p in children)
+     finally:
+         timer.cancel()
+         for p in [cron, *(p for _, p in children)]:
+             if p.poll() is None:
+                 p.kill()
+             p.wait(timeout=2)
+ 
+ 
+ @requires_db
+ def test_worker_flag_off_closes_owned_connection(conn, monkeypatch):
+     w = maintenance_worker()
+     from job_discovery import db
++
+     opened = []
+     original = db.connect
+ 
+     def connect(dsn):
+         fresh = original(dsn)
+         opened.append(fresh)
+         return fresh
+ 
+-    monkeypatch.setattr(w.db, 'connect', connect)
++    monkeypatch.setattr(w.db, "connect", connect)
+     assert not w.run_maintenance_once(TEST_DSN).blocked
+     assert len(opened) == 1 and opened[0].closed
+-    assert conn.execute("SELECT count(*) AS n FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['n'] == 0
++    assert (
++        conn.execute(
++            "SELECT count(*) AS n FROM lifecycle_claims WHERE kind='maintenance'"
++        ).fetchone()["n"]
++        == 0
++    )
+ 
+ 
+ @requires_db
+ def test_worker_scheduled_sweep_and_normal_restart_generations(conn):
+     w = maintenance_worker()
+-    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
++    conn.execute(
++        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
++    )
+     conn.commit()
+     generations = []
+     for _ in range(2):
+         assert not w.run_maintenance_once(TEST_DSN).blocked
+-        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
+-        assert row['state'] == 'cancelled' and row['replay_floor'] == row['generation'] - 1
+-        generations.append(row['generation'])
+-        assert conn.execute('SELECT last_success_at FROM lifecycle_maintenance_state').fetchone()['last_success_at'] is not None
++        row = conn.execute(
++            "SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'"
++        ).fetchone()
++        assert (
++            row["state"] == "cancelled" and row["replay_floor"] == row["generation"] - 1
++        )
++        generations.append(row["generation"])
++        assert (
++            conn.execute(
++                "SELECT last_success_at FROM lifecycle_maintenance_state"
++            ).fetchone()["last_success_at"]
++            is not None
++        )
+         conn.commit()
+     assert generations[1] > generations[0]
+ 
+ 
+ @requires_db
+ def test_worker_contended_claim_is_blocked_then_recovers_after_release(conn):
+     w = maintenance_worker()
+     from job_discovery.lifecycle.claims import claim_work, cancel_claim
+-    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
+-    claim = claim_work(conn, 'maintenance', 'singleton', 120)
++
++    conn.execute(
++        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
++    )
++    claim = claim_work(conn, "maintenance", "singleton", 120)
+     conn.commit()
+     assert w.run_maintenance_once(TEST_DSN).blocked
+     cancel_claim(conn, claim)
+     conn.commit()
+     assert not w.run_maintenance_once(TEST_DSN).blocked
+ 
+ 
+ @requires_db
+-def test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs(conn, monkeypatch):
++def test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs(
++    conn, monkeypatch
++):
+     w = maintenance_worker()
+-    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
++    conn.execute(
++        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
++    )
+     conn.commit()
+     original = w.sweep
+ 
+     def fail(connection, claim, **kwargs):
+-        assert kwargs['scheduled'] is True
+-        connection.execute('UPDATE lifecycle_maintenance_state SET eligible_rows=999')
+-        raise RuntimeError('ordinary worker failure')
++        assert kwargs["scheduled"] is True
++        connection.execute("UPDATE lifecycle_maintenance_state SET eligible_rows=999")
++        raise RuntimeError("ordinary worker failure")
+ 
+-    monkeypatch.setattr(w, 'sweep', fail)
++    monkeypatch.setattr(w, "sweep", fail)
+     assert w.run_maintenance_once(TEST_DSN).blocked
+-    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
+-    assert conn.execute("SELECT state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['state'] == 'cancelled'
++    assert (
++        conn.execute(
++            "SELECT eligible_rows FROM lifecycle_maintenance_state"
++        ).fetchone()["eligible_rows"]
++        == 0
++    )
++    assert (
++        conn.execute(
++            "SELECT state FROM lifecycle_claims WHERE kind='maintenance'"
++        ).fetchone()["state"]
++        == "cancelled"
++    )
+     conn.commit()
+-    monkeypatch.setattr(w, 'sweep', original)
++    monkeypatch.setattr(w, "sweep", original)
+     assert not w.run_maintenance_once(TEST_DSN).blocked
+ 
+ 
+ def test_approved_timing_constants():
+     s = supervisor()
+     from job_discovery.lifecycle import maintenance as m
+-    assert (s.CHECK_SECONDS, s.MAINTENANCE_INTERVAL_SECONDS, s.MAINTENANCE_DEADLINE_SECONDS, s.DRAIN_SECONDS) == (5, 900, 90, 30)
++
++    assert (
++        s.CHECK_SECONDS,
++        s.MAINTENANCE_INTERVAL_SECONDS,
++        s.MAINTENANCE_DEADLINE_SECONDS,
++        s.DRAIN_SECONDS,
++    ) == (5, 900, 90, 30)
+     assert (m.LEASE_SECONDS, m.RENEW_SECONDS, m.DEADLINE_SECONDS) == (120, 30, 90)
+ 
+ 
+ def test_reviewer_drain_returns_when_review_is_stalled(monkeypatch):
+     from reviewer import worker
++
+     stop = worker._Stop()
+     release = threading.Event()
+     thread = threading.Thread(target=release.wait, daemon=True)
+     thread.start()
+     clock = Clock()
+-    monkeypatch.setattr(worker.time, 'monotonic', clock)
+-    monkeypatch.setattr(worker, 'DRAIN_SECONDS', 0.01)
++    monkeypatch.setattr(worker.time, "monotonic", clock)
++    monkeypatch.setattr(worker, "DRAIN_SECONDS", 0.01)
+     stop.request()
+     original_join = thread.join
+ 
+     def join(timeout=None):
+         assert timeout is not None and timeout <= 1
+         clock.now += timeout
+ 
+-    monkeypatch.setattr(thread, 'join', join)
++    monkeypatch.setattr(thread, "join", join)
+     try:
+         assert worker._drain_threads([thread], stop, threading.Event()) is False
+         assert clock.now <= 1.01
+     finally:
+         release.set()
+         original_join(timeout=2)
+ 
+ 
+-@pytest.mark.parametrize('parallelism', [1, 3])
++@pytest.mark.parametrize("parallelism", [1, 3])
+ def test_real_reviewer_sigterm_bounds_stalled_request(parallelism, tmp_path):
+-    marker = tmp_path / 'ready'
+-    code = '''
++    marker = tmp_path / "ready"
++    code = """
+ import pathlib, sys, time
+ from reviewer import worker
+ worker.DRAIN_SECONDS = 0.1
+ worker.config.REVIEW_WORKER_PARALLELISM = int(sys.argv[2])
+ worker.config.has_api_key = lambda: True
+ class Conn:
+     def close(self): pass
+ worker.jdb.connect = Conn
+ def stalled(conn):
+     pathlib.Path(sys.argv[1]).touch()
+     time.sleep(60)
+ worker.process_one = stalled
+ worker.main()
+-'''
+-    process = subprocess.Popen([sys.executable, '-c', code, str(marker), str(parallelism)])
++"""
++    process = subprocess.Popen(
++        [sys.executable, "-c", code, str(marker), str(parallelism)]
++    )
+     try:
+         deadline = time.monotonic() + 5
+-        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
++        while (
++            not marker.exists()
++            and process.poll() is None
++            and time.monotonic() < deadline
++        ):
+             time.sleep(0.01)
+         assert marker.exists()
+         process.terminate()
+         assert process.wait(timeout=3) == 0
+     finally:
+         if process.poll() is None:
+             process.kill()
+         process.wait(timeout=2)
+ 
+ 
+ def test_main_signal_stops_children_and_restart_runs_startup_again(tmp_path):
+-    marker = tmp_path / 'children'
+-    code = '''
++    marker = tmp_path / "children"
++    code = """
+ import pathlib, subprocess, sys
+ from reviewer import supervisor as s
+ s.CHECK_SECONDS = 0.02
+ s.DRAIN_SECONDS = 0.1
+ def spawn(name):
+     child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
+     with pathlib.Path(sys.argv[1]).open('a') as f:
+         f.write(name + ':' + str(child.pid) + '\\n')
+     return child
+ s.spawn_child = spawn
+ sys.exit(s.main())
+-'''
++"""
+     for cycle in (1, 2):
+-        process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
++        process = subprocess.Popen([sys.executable, "-c", code, str(marker)])
+         try:
+             deadline = time.monotonic() + 5
+             while time.monotonic() < deadline:
+                 lines = marker.read_text().splitlines() if marker.exists() else []
+-                if len(lines) == cycle * 2:
++                if len(lines) == cycle * 3:
+                     break
+                 time.sleep(0.01)
+-            assert len(lines) == cycle * 2
++            assert len(lines) == cycle * 3
+             process.terminate()
+             assert process.wait(timeout=3) == 0
+-            assert [line.split(':')[0] for line in lines[-2:]] == ['reviewer', 'maintenance']
+-            assert all(not Path('/proc', line.split(':')[1]).exists() for line in lines[-2:])
++            assert [line.split(":")[0] for line in lines[-3:]] == [
++                "reviewer",
++                "maintenance",
++                "archive",
++            ]
++            assert all(
++                not Path("/proc", line.split(":")[1]).exists() for line in lines[-3:]
++            )
+         finally:
+             if process.poll() is None:
+                 process.kill()
+             process.wait(timeout=2)
+ 
+ 
+ def test_shutdown_does_not_extend_maintenance_90_second_deadline(monkeypatch):
+     s = supervisor()
+     clock = Clock()
+-    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
++    monkeypatch.setattr(
++        s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++    )
+     children = {}
+ 
+     def spawn(name):
+         children[name] = Child(clock, ignores_term=True)
+         return children[name]
+ 
+     assert s.supervise(Stop(clock, 85), spawn, clock) == 0
+-    assert children['maintenance'].killed == 90
+-    assert children['reviewer'].killed == 115
++    assert children["maintenance"].killed == 90
++    assert children["reviewer"].killed == 115
+ 
+ 
+ @requires_db
+-def test_real_maintenance_sigterm_releases_connection_and_next_worker_recovers(conn, tmp_path):
++def test_real_maintenance_sigterm_releases_connection_and_next_worker_recovers(
++    conn, tmp_path
++):
+     w = maintenance_worker()
+-    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
++    conn.execute(
++        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
++    )
+     conn.commit()
+-    marker = tmp_path / 'maintenance-claimed'
+-    code = '''
++    marker = tmp_path / "maintenance-claimed"
++    code = """
+ import pathlib, sys, time
+ from job_discovery.lifecycle import worker
+ 
+ def paused_sweep(conn, claim, **kwargs):
+     pathlib.Path(sys.argv[1]).write_text(str(claim.generation))
+     time.sleep(60)
+ worker.sweep = paused_sweep
+ sys.exit(worker.main())
+-'''
+-    process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
++"""
++    process = subprocess.Popen([sys.executable, "-c", code, str(marker)])
+     try:
+         deadline = time.monotonic() + 5
+-        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
++        while (
++            not marker.exists()
++            and process.poll() is None
++            and time.monotonic() < deadline
++        ):
+             time.sleep(0.01)
+         assert marker.exists()
+         generation = int(marker.read_text())
+         process.terminate()
+         assert process.wait(timeout=3) == 143
+-        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
+-        assert row == {'generation': generation + 1, 'replay_floor': generation, 'state': 'cancelled'}
++        row = conn.execute(
++            "SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'"
++        ).fetchone()
++        assert row == {
++            "generation": generation + 1,
++            "replay_floor": generation,
++            "state": "cancelled",
++        }
+         conn.commit()
+         assert not w.run_maintenance_once(TEST_DSN).blocked
+     finally:
+         if process.poll() is None:
+             process.kill()
+         process.wait(timeout=2)
++
++
++def test_archive_ticks_and_deadline_are_independent(monkeypatch):
++    s = supervisor()
++    clock = Clock()
++    children = []
++    monkeypatch.setattr(
++        s.time, "sleep", lambda delay: setattr(clock, "now", clock.now + delay)
++    )
++
++    def spawn(name):
++        child = Child(
++            clock, duration=1 if name == "maintenance" else None, ignores_term=True
++        )
++        children.append((name, child))
++        return child
++
++    assert s.supervise(Stop(clock, 190), spawn, clock) == 0
++    archive = [c for name, c in children if name == "archive"]
++    assert archive[0].started == 0 and archive[0].killed == 120
++    assert archive[1].started <= 125
++    assert [c.started for name, c in children if name == "maintenance"] == [0]
++    assert (s.ARCHIVE_INTERVAL_SECONDS, s.ARCHIVE_DEADLINE_SECONDS) == (60, 120)
++
++
++def test_archive_successful_children_run_every_sixty_seconds():
++    s = supervisor()
++    clock = Clock()
++    children = []
++
++    def spawn(name):
++        child = Child(clock, duration=1 if name in {"archive", "maintenance"} else None)
++        children.append((name, child))
++        return child
++
++    assert s.supervise(Stop(clock, 185), spawn, clock) == 0
++    assert [c.started for name, c in children if name == "archive"] == [0, 60, 120, 180]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-reviewer-dispatch.md
new file mode 100644
index 0000000..db8efc1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-11-reviewer-dispatch.md
@@ -0,0 +1,9 @@
+# Task11 permitted independent requirements/code-quality review
+
+Dispatch a fresh reviewer after author DONE/STOP and controller FULL report/actual evidence read. Task11 BASE is `58180c0b4b85860d33813509abe7d3054648816f`; pin actual final source and report/evidence HEAD in the complete task-11-review-package.md. Inputs are task-11-brief.md, full task-11-report.md, package, relevant binding specification and review-scope/release amendments. Assess Task11 only; final whole-branch review occurs after all13.
+
+Both requirements and code-quality verdicts required. Inspect actual SDK conditional immutable PutObject path, 412/ambiguous-success recovery, bounded closeable streaming verification, fixed approved destination interface, exact deterministic manifest/event membership, persisted crash boundaries with fresh worker AND connection, acknowledgement prerequisites, explicit-authorized expired replacement preserving exact identity/times/fences, and independent periodic child scheduling/deadline/shutdown/terminal compaction. Read exact recorded commands, versions, source hashes and actual outputs; no author-covered reruns. Verify implementation/default-off versus production readiness claims remain distinct. Actual bucket access/validation/configuration is not inferred from offline fixtures.
+
+Scope is ordinary NEW archive transport/persisted failure correctness and SDK contracts, including its bounded content/destination validation. This does not authorize reproducing or substituting the omitted Task3 independent expiry enforcement, physical-capacity accounting, cross-user isolation or related adversarial reviews/probes. Do not inspect those mechanisms as a replacement security reviewer, run their suites, or infer their assurance. Local archive-horizon fixtures concern the new seal protocol only; old physical/claim interfaces remain interfaces, not independently certified mechanisms.
+
+Read-only source/evidence review only: no source/test edits, staging/commits, helpers/subagents, tests rerun, network/provider/production/S3/bucket/IAM/config/credential/release actions. Write task-11-requirements-review.md with exact pins, every concrete finding and narrow ordinary evidence needed, both verdicts, implemented/tested/reviewed/deliberately-unreviewed scopes, remaining costs/prerequisites. Return DONE plus verdicts and STOP. Controller handles forward documentation, fixes via sole author, checkpointing and completed release after all13/final review.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
index b3c001a..952401e 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
@@ -72,10 +72,14 @@ mechanism-review probes.
 
 Task9 integration test carry-forward (read actual final9report/chronology): broader nondb dashboard run discovered inherited fixture drift. tombstoneGuard markApplicationApplied/unrejectJob live-account mocks omit Task8 withUserDemandSql; deployment-workflow-contract expects 2 DATABASE_URL entries while Task1 ci.yml has 3. BASE git-show evidence reported; author9 leaves unrelated files unchanged. Under13 actual ordinary caller/CI test inventory, repair valid fixture expectations/mock interfaces without weakening assertions or reproducing omitted Task3 mechanism/adversarial probes; select required tests based on actual contents. Keep original failing evidence and explicit2skipped distinction; no unrestricted all-green/security claim.
 
 Task9 public-board freshness cost carry:120sISR removed for exactexpiry/per-requestreads, author explicitly unmeasured load/throughput. Final runbook/readiness must identify this tradeoff and keep cost-neutrality unproven; no invented production benchmarks or costs, no unrelated optimization/testing unless concrete evidence warrants. Reviewer count/rows unified sameSELECT after ordinary expiry-boundary selfcheck; inspect final9report/evidence/pins.
 
 Task9 independent review carried default/owned Vitest lane-selection gap: newConsumers.db strict owned-env import guard plus BOTH BASEjobLifecycle.db/flow.db suites already included bydefaultvitest/plainnpmCIwithoutownedvars. Authorbroadsuiteexcluded.db is notproofplainCIgreen. Task13mustexplicitordinarydefaultvsownedDBselection+17/16permittedfixtures, preserveALLstrictowned-targetguards; neverpointfixtureDDL atsharedDSN orexecuteomittedprobes viaCI. MinorFunnelSection suffixofopen vs discovery denominator mustconsistent ifnothandledTask9fix. Task9 ownReactchecklist wasabsentinitialreport; assessactualphasefixrecord, no borrowedTask8assurance.
 
 Task9 fresh-review CI nuance: Consumers.db import requires owned TEST_DATABASE_URL/LIFECYCLE_REQUIRE_DB_TESTS=1 while plain default npmCI includes all*.test.ts. BASE Task8 jobLifecycle.db/flow.db already have same strictguards: inherited lane-selection rootcause, notpreviouslygreenCI/newthirdTask9functionalblocker. Under13 aligndefaultunit exclusions andexplicitowned17/16DBlanes using actualpermittedcontents; preserveguards/neverpointownedresetfixtureatsharedDSN. Task9review report also carries analyticsFunnel 'of open' vsdiscovery denominatorcopy and missing explicitauthorReactchecklist; readfinalFix1report for disposition.
 
 Task10 operational/outbox integration carry (read final10report+independentreview before acting): additive bounded preallocated operational lane intended to resolveR6-4; missing/insufficient slots musttruthfullydefer, no newidentity/payloadaboveguard, ordinarygrowthguardunchanged. Smallownedfixturezeroallocationdelta notproduction/sustainedMVCCguarantee; report slotprovisioning/exhaustion/criticaleventexactack andlogical-vs-physicalmetrics. All publictables triggerprojection contract includes jobs/source_accounts/source_listings/job_versions/companies/locations/brands/skills/edges/identityassertions. Author10 currentinventory says legacy db/companydiscoverydirect writers intentionally failclosed whenactivearchiveeventful; activation readiness blocked. Task13actualwritercallerreadiness MUSTaccount each legitimate runtimewriter/mode, neverclaim activationcompatiblemerelybecauselegacynegativepathfails. Noarchiveactivation/userpermission/infrastructure implied. Exact version-ID/listing/revision/hash coverage replaces listingwatermark; inspectfinalacceptedinterfaces.
+
+Task13 sourcecoverage concrete carry: root read runtime references afterTask11. verify_due_sources(conn,max_boards=100,seconds=300) has exactlyone actualcaller job_discovery/run.py:179. Poller remainsdaily00UTC; reviewer supervisor has reviewer/maintenance/archive children, no periodic sourceverifier. Thus the healthy normalpath processes atmost100selectedboards/day (resumedtailscanconsume turns); ifenabledcorpus exceeds100, that runtimecannotgiveeveryboard24hverification. Operationalfallback behavior maydiffer and noactualproductionenabledsourcecount was queried. Task13 actualwritercaller/scheduler inventory mustresolve this concrete integration limit with bounded scheduling preservingdaily discovery/independentmaintenance/claims/guard, or surfacealoadbearinggap rather than callsmallmanualfixturefairness a24hcoverageproof. No redundantproductionaggregates/wholecrawl/securityprobes authorizedbythisnote; useparentcountifneeded.
+
+Task11finalintegration carry: readfinalaccepted11report/reviewbeforeacting. Ordinarycombinedruntime overhead measurement remainsrequired; importonly0.359s/38212KiBRSS notcombinedcost. Superseded-shellseven-dayboundedcleanup lacksdedicatedfixture; pendingdata/markers/authhistorymustsurvive. MinorR11-2bombfixturedoesContentLength rejectionattwo-bytecompressedlimit, notrealexportpath; fixhonestlabel orordinaryfocusedfixture withoutweakening exact-bytecheck. No oldomittedprobes/substitutes.
diff --git a/migrations/2026-10-03-08-archive-recovery-approval-history.sql b/migrations/2026-10-03-08-archive-recovery-approval-history.sql
new file mode 100644
index 0000000..f8dbf4b
--- /dev/null
+++ b/migrations/2026-10-03-08-archive-recovery-approval-history.sql
@@ -0,0 +1,8 @@
+-- R11-1: permit a new explicit approval without changing expired approval history.
+-- The worker still consumes only a current operator grant; it never creates one.
+ALTER TABLE public_archive_recovery_authorizations
+ DROP CONSTRAINT IF EXISTS public_archive_recovery_authorizations_batch_id_key;
+-- Retain at most one committed consumption per old batch, in addition to the
+-- existing immutable one-old-batch supersession marker and terminal batch fence.
+CREATE UNIQUE INDEX IF NOT EXISTS idx_public_archive_recovery_one_consumption
+ ON public_archive_recovery_authorizations(batch_id) WHERE consumed_at IS NOT NULL;
diff --git a/schema.sql b/schema.sql
index 248005f..359d7f6 100644
--- a/schema.sql
+++ b/schema.sql
@@ -3325,10 +3325,21 @@ CREATE TABLE IF NOT EXISTS public_archive_quarantine (
  batch_id uuid PRIMARY KEY, diagnostic_code text NOT NULL CHECK(diagnostic_code='invalid_archive'),
  quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp()
 );
 ALTER TABLE public_archive_quarantine ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON public_archive_quarantine FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS lifecycle_gate ON public_archive_quarantine;
 CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public_archive_quarantine
  FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate();
 
 INSERT INTO schema_migrations(filename) VALUES('2026-10-03-07-archive-export.sql') ON CONFLICT DO NOTHING;
+
+-- R11-1: permit a new explicit approval without changing expired approval history.
+-- The worker still consumes only a current operator grant; it never creates one.
+ALTER TABLE public_archive_recovery_authorizations
+ DROP CONSTRAINT IF EXISTS public_archive_recovery_authorizations_batch_id_key;
+-- Retain at most one committed consumption per old batch, in addition to the
+-- existing immutable one-old-batch supersession marker and terminal batch fence.
+CREATE UNIQUE INDEX IF NOT EXISTS idx_public_archive_recovery_one_consumption
+ ON public_archive_recovery_authorizations(batch_id) WHERE consumed_at IS NOT NULL;
+
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-08-archive-recovery-approval-history.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_archive_recovery_authorization.py b/tests/test_archive_recovery_authorization.py
new file mode 100644
index 0000000..9bf0dd8
--- /dev/null
+++ b/tests/test_archive_recovery_authorization.py
@@ -0,0 +1,160 @@
+"""R11-1: fresh operator approval after an unused approval expires, owned DB only."""
+
+from datetime import timedelta
+from uuid import uuid4
+
+import pytest
+
+from job_discovery import db
+from job_discovery.archive.batches import persist_seal, recover_batch, seal_batch
+from job_discovery.archive.outbox import ArchiveBlocked
+from job_discovery.archive.recovery import RecoveryAuthorization, replace_expired_batch
+from job_discovery.lifecycle.claims import cancel_claim, claim_work
+from tests.conftest import TEST_DSN, requires_db
+from tests.test_archive_retention_recovery import (
+    Crash,
+    pending,
+    set_archive_clock,
+    setup_batch,
+)
+
+
+def approval_rows(conn, batch_id):
+    rows = conn.execute(
+        "SELECT * FROM public_archive_recovery_authorizations WHERE batch_id=%s ORDER BY authorization_id",
+        (batch_id,),
+    ).fetchall()
+    conn.commit()
+    return {row["authorization_id"]: row for row in rows}
+
+
+@requires_db
+def test_fresh_explicit_approval_after_unused_approval_expires(conn):
+    batch, _ = setup_batch(conn)
+    claim = claim_work(conn, "archive-export", "singleton", 180)
+    ref = recover_batch(conn, batch.batch_id, claim)
+    conn.commit()
+    seal = seal_batch(ref)
+    persist_seal(conn, seal)
+    conn.commit()
+    original_pending = pending(conn)
+    set_archive_clock(conn, ref.eligible_until + timedelta(seconds=1))
+    expired_id, fresh_id = uuid4(), uuid4()
+    # Seed an already-expired historical approval; ordinary authorization time
+    # remains the real DB clock, separate from the archive-horizon fixture clock.
+    conn.execute(
+        """INSERT INTO public_archive_recovery_authorizations(
+        authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,approved_at,expires_at)
+        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
+        'original explicit approval',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'
+        FROM public_archive_batches WHERE batch_id=%s""",
+        (expired_id, ref.batch_id),
+    )
+    conn.commit()
+    old_history = approval_rows(conn, ref.batch_id)[expired_id]
+    with pytest.raises(ArchiveBlocked, match="authorization"), conn.transaction():
+        replace_expired_batch(
+            conn, ref.batch_id, claim, RecoveryAuthorization(expired_id)
+        )
+    assert approval_rows(conn, ref.batch_id) == {expired_id: old_history}
+    assert pending(conn) == original_pending
+    assert (
+        conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
+            "n"
+        ]
+        == 0
+    )
+    assert (
+        conn.execute(
+            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
+            (ref.batch_id,),
+        ).fetchone()["state"]
+        == "sealed"
+    )
+    conn.commit()
+
+    # A distinct operator grant is required: no mutation/extension of old approval.
+    conn.execute(
+        """INSERT INTO public_archive_recovery_authorizations(
+        authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
+        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
+        'new separately granted explicit approval',clock_timestamp()+interval '1 hour'
+        FROM public_archive_batches WHERE batch_id=%s""",
+        (fresh_id, ref.batch_id),
+    )
+    conn.commit()
+    before_transfer = approval_rows(conn, ref.batch_id)
+    assert before_transfer[expired_id] == old_history
+    with pytest.raises(Crash), conn.transaction():
+        replace_expired_batch(
+            conn, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
+        )
+        raise Crash()
+    assert approval_rows(conn, ref.batch_id) == before_transfer
+    assert pending(conn) == original_pending
+    assert (
+        conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
+            "n"
+        ]
+        == 0
+    )
+    assert (
+        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
+        == 1
+    )
+    conn.commit()
+
+    retry = db.connect(TEST_DSN)
+    try:
+        replacement = replace_expired_batch(
+            retry, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
+        )
+        retry.commit()
+    finally:
+        retry.close()
+    assert retry.closed
+    assert replacement.ordered_event_ids == ref.ordered_event_ids
+    assert replacement.event_bytes == ref.event_bytes
+    assert replacement.prior_batch_id == ref.batch_id
+    assert replacement.batch_id != ref.batch_id
+    assert replacement.sealed_at > ref.eligible_until
+    assert replacement.eligible_until - replacement.sealed_at == timedelta(days=730)
+    assert pending(conn) == original_pending
+    after = approval_rows(conn, ref.batch_id)
+    assert after[expired_id] == old_history
+    assert after[fresh_id]["consumed_at"] is not None
+    assert after[fresh_id]["replacement_batch_id"] == replacement.batch_id
+    assert {
+        k: v
+        for k, v in after[fresh_id].items()
+        if k not in {"consumed_at", "replacement_batch_id"}
+    } == {
+        k: v
+        for k, v in before_transfer[fresh_id].items()
+        if k not in {"consumed_at", "replacement_batch_id"}
+    }
+    fence = conn.execute("SELECT * FROM public_archive_supersessions").fetchall()
+    assert len(fence) == 1
+    assert (
+        fence[0]["old_batch_id"],
+        fence[0]["new_batch_id"],
+        fence[0]["authorization_id"],
+    ) == (ref.batch_id, replacement.batch_id, fresh_id)
+    assert (
+        fence[0]["owner_token"],
+        fence[0]["generation"],
+        fence[0]["manifest_hash"],
+    ) == (claim.owner_token, claim.generation, seal.manifest_hash)
+    conn.commit()
+    with pytest.raises(ArchiveBlocked, match="not eligible"), conn.transaction():
+        replace_expired_batch(
+            conn, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
+        )
+    assert approval_rows(conn, ref.batch_id) == after
+    assert pending(conn) == original_pending
+    assert (
+        conn.execute("SELECT * FROM public_archive_supersessions").fetchall() == fence
+    )
+    conn.commit()
+    cancel_claim(conn, claim)
+    conn.commit()
