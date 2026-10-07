# Full pinned review package

BASE: 5ac3beebffcc2d37eb506610015e40ce5f3c7b99

HEAD: cc553e934e7caa50876b57bd4d370bce7dca53b7

## Commits

cc553e934e7caa50876b57bd4d370bce7dca53b7 docs: record Task12 coverage and membership fix evidence
ecba747343369c26041ef5655ed56b044d7098a0 fix: enforce replay coverage and bound membership before traversal
7291e2b89b9eeda9b45d963324fe9989df627fbb Record Task12 coverage and membership findings with scoped Fix1 dispatch
80f61fdb7ae8972778429c96ff5c7b0d5083e8a3 Record Task12 replay interface ruling and permitted review dispatch


## Files

 .../CURRENT.md                                     |   97 +-
 .../controller-resume.md                           |    8 +
 .../progress.md                                    |    8 +
 .../rulings-current.md                             |    2 +
 .../task-12-fix1-dispatch.md                       |    9 +
 .../task-12-fix1-evidence/collection.txt           |   22 +
 .../task-12-fix1-evidence/commands.md              |   28 +
 .../task-12-fix1-evidence/final-before.sha256      |    8 +
 .../final-hash-verification.txt                    |    8 +
 .../task-12-fix1-evidence/green.exit               |    1 +
 .../task-12-fix1-evidence/green.raw.txt.gz         |  Bin 0 -> 52 bytes
 .../task-12-fix1-evidence/green.txt                |    2 +
 .../task-12-fix1-evidence/inventory.md             |    5 +
 .../task-12-fix1-evidence/red.exit                 |    1 +
 .../task-12-fix1-evidence/red.raw.txt.gz           |  Bin 0 -> 463 bytes
 .../task-12-fix1-evidence/red.txt                  |   16 +
 .../task-12-fix1-evidence/red2.exit                |    1 +
 .../task-12-fix1-evidence/red2.raw.txt.gz          |  Bin 0 -> 2447 bytes
 .../task-12-fix1-evidence/red2.txt                 |  273 ++++
 .../task-12-fix1-evidence/ruff.txt                 |    1 +
 .../task-12-fix1-evidence/versions.txt             |    5 +
 .../task-12-fix1-report.md                         |   47 +
 .../task-12-requirements-review.md                 |   77 +
 .../task-12-review-package.md                      | 1546 ++++++++++++++++++++
 .../task-12-reviewer-dispatch.md                   |    9 +
 .../task-13-author-dispatch.md                     |    2 +
 .../task-13-reviewer-dispatch.md                   |    9 +
 job_discovery/archive/replay.py                    |   32 +-
 tests/test_archive_replay_fix1.py                  |  148 ++
 29 files changed, 2277 insertions(+), 88 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
index 3c27930..0157b04 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/CURRENT.md
@@ -1,96 +1,31 @@
-# Current controller checkpoint — 2026-10-07
+# Current controller checkpoint — 2026-10-07 23:34 UTC
 
-Continue the approved all13 plan, final permitted review and completed authorized release. Do not end at an interim checkpoint. Controller edits documentation only; sole authors own product/tests. Do not stage controller files while an author is committing.
+Continue all13 approved tasks, permitted whole-branch review, completed authorized release and exact live verification. No interim final. Controller edits documentation only; sole authors own product/tests. Do not stage controller files while author Git is active. Full history is in progress.md/controller-resume.md/rulings-current.md.
 
-## Accepted checkpoint
+## Accepted state
 
-Task8 accepted permitted requirements/code-quality review after two correction rounds. Source eaef2fb43199771d3d18a3ed876cc62fb240a6ac; report pin98c1fde4a160ee99ba664d69e73a9cc885fea2f4; complete-history checkpoint09efd561c37a678ebae884db7bea20452f813a35. Library libfile_2567d781e730819194ac1dac76140fcc / file_00000000456881f590fdf2d0d6c11100 v0. Forward-ID ledger/Task9 BASE5a319253169cd03e1821e7c3d02df82249e6ce8b.
+Tasks1–11 development checkpoints preserved. Task3 deliberately lacks independent expiry/capacity/cross-user/related adversarial security review/probes under Andrew amendment; never retry/reproduce/disguise/substitute those omitted scopes, including through CI. Task6 conditional integration carries must be resolved or honestly reported at13/final. Existing ordinary functional requirements remain.
 
-Tasks1–5 and7 accepted; Task6 remains conditional: R6-4 above-guard durable closure/health progress mandatory10/13. Task8 addressed shared transport R6-5 in ordinary source/offline scope only. Task3 independent expiry/capacity/cross-user/adversarial review/probes deliberately omitted and NEVER retried/substituted. Not a full security verdict.
+Task11 accepted source4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4, reportc91efc60b12cfa599c8c6d409a117fd23c02e6ad, same scoped review PASS/APPROVED. Checkpoint7c43e19e490827d6593434d55ae7cb77c975d050, /workspace/scratch/job-board-lifecycle-recovery-checkpoint-11.bundle verified full history, Librarylibfile_c221028586448191a44b35e1b8baee42/file_000000009b2481f59baf69d0d16d7c10 v0 with xattrs applied same exec. Forward ID ledger/currentTask12 BASE0f87454e965f3ef8d06b18ce93d23ea621d53b6f. Actual initial61 tests each17.11/16.15 plus separate catalog1 each; Fix1 focused2 each. Not unrestricted security/production approval.
 
-## Active work
+## Active Task12
 
-Fresh sole Task9 author /root/recovery_task09_implementer, gpt6.1-sol/high/forkNONE, local-only. Task9 sourceba00e501/report-evidence7d9216d6 DONE/authorSTOP. Fresh/root/recovery_task09_requirements_review Astra/high/forkNONE completed SpecFAIL/QualityCHANGES_REQUIRED: R9-1 paginatedhistory mergesdiscoveryrows; R9-2unscoredsavedpackageshideApplicationPanel/status. RootreadFULLverdict; ONEFix1sameauthor ACTIVE, same-scopedreview after. FullBASE..7d9216d6 packagegenerated; rootreadreport/actualfinaloutputs/screenshots. Latest reported193TS/13files; fake installedChromium desktop/mobile9assertions;6query/history DB fixtures each17.11/16.15;8reviewer tests/30deselected each, then oneSELECT/snapshot count consistency correction passed9reviewer/30deselected EACH17/16 (prior two-read RED retained). Initial author phase DONE; EXISTINGsameauthor Fix1 resumed by followup_task after parent renewedcontinuation. Preserve3dirtycomponenttests; no duplicateauthor. Final typecheck0/lint0 with9 inheritedwarnings. Rootread FULL finalreport/chronology/actual193TS/6DBEACH/9reviewerEACH/browser9result and screenshots; finalreview FAIL report read; two-finding Fix1 correction required before SAMEreviewer scopedrereview.
+Fresh sole author /root/recovery_task12_implementer Astra/high/forkNONE running same worktree /workspace/job-board/.claude/worktrees/lifecycle-recovery, feature/lifecycle-recovery. BASE above. task-12-brief.md is requirements, task-12-author-dispatch.md binding scope. Pure bounded admin public archive projection only, synthetic sealed/file/test inputs. No DB restore, current-state reopening, real S3/provider/paid/production/object-delete/activation/release actions. RED missing replay module and initial36 ordinary offline cases reported; not accepted final evidence yet.
 
-Task9's broader nondb dashboard run1706passed/4failed/2skipped/217files: one new UIcontract issue fixed; three inheritedfixtures carried13 (tombstoneGuard two missing withUserDemandSql mocks; workflow test expects2 DSNs vs BASEci3). Do not claim unrestricted all-green. Publicboard120sISR→per-request exactexpiry; load/costunmeasured. Explicit UTC parser and client/server import boundary corrected after fakebrowserbuild. Minimal fixed READ-ONLY public lifecycle projection/predicate ruling inprogress: existing anon/owner wrappers stay scoped; no underlyingtable grants/private data/control internals/DML/bypass/serviceSql boardescape. New additive migration2026-10-07-04-lifecycle-feed.sql +schema parity.
+Task12 Ruling: permit compatible defaulted ProjectionResult metadata appended after the existing applied_event_ids/ignored_event_ids and replay-local typed sealed-input/policy/limits; preserve actual permanent whole-aggregate suppression across all revisions/timestamps, with any trusted snapshot epoch serving provenance only — why: Task12 requires projection facts/coverage/gaps/errors and bounded policy absent from accepted interfaces, while persisted suppression has no epoch and exporter already rejects the entire scope. No DB or accepted seal/codec change. Cost if wrong: constructor compatibility or projection metadata requires local rework; permanent suppression can conservatively omit all historical facts, and a provenance epoch supplies no event-level authorization or restoration permission.
 
-## Recovery/tooling facts
+After author DONE/STOP: full report/actual evidence/source hashes, complete BASE..HEAD package via controller-review-package.py, fresh permitted requirements/code-quality reviewer using task-12-reviewer-dispatch.md. Fixes same author and same reviewer scoped original/fix-introduced Important/Critical only; no unaffected reruns. Accepted12 doc commit → verified git bundle --all → Library upload/xattrs SAME exec → confirmed ID forward ledger → fresh sole13 immediately.
 
-OneTask9 exec-server transport disconnect immediately recovered on normal same-env pwd; roothealthy. NOexecutorreplacement/stagerestart/modelcapacityfailure. Before any future executor recovery, preserve latest source/evidence. Unfinished non-atomic Task9 snapshot CONFIRMED Library libfile_72177da69a0c8191b33a590ff2873bab / file_00000000632881f88efd77dd23582ade v0; /workspace/scratch/job-board-task09-unaccepted-recovery.tar.gz includes verifiedfullhistoryBASE, dirtyHEADpatch,4newpaths,currentlogs/STATUS. Some copied logs were inprogress; later finalfiles required. This is NOT accepted09.
+## Next and release
 
-Playwright install returned HTTP403 Domainforbidden cdn.playwright.dev; authorstopped thatroute/no alternativehost. Existing /usr/bin/chromium151.0.7922.173 used loopbackfakebrowser, no externalrequests/auth/providercalls. Distinct from earlier Task3 security refusal and transport/capacity errors.
+Task13 author-dispatch.md/final-review-carry-forward.md contain concrete carries: permitted local AND CI test inventory before any push; inherited TS mocks/workflow expectations; default-vs-owned Vitest guards; actual committed closed_jobs count; complete writer/consumer/cascade/readiness inventory; actual runtime source-verification100/day vs24h coverage; operational slots/outbox small runway; true legacy unknown-input recapture availability gap; combined supervisor resources; archive superseded-shell7day fixture; MinorR11-2 honest decompression fixture claim; flags/default-off/dryrun/destination prerequisites. Inspect accepted reports before fixing already-resolved matters.
 
-## Next steps and limits
+After13 acceptance fresh most-capable permitted whole-branch reviewer, ONE complete fix wave, ONE scoped rereview and explicit adjudication. Preserve every Ruling/cost exhaustively in final artifacts/final message before cleaning only this plan workspace. Completed release authorized by Andrew14:27; no extra deployment block based solely on omitted independent review. Activation, permanent deletion, persistent credentials/IAM/security-sensitive changes still require applicable action authorization. Publish/merge/deploy through existing workflow; preserve5 unrelated staged Railway discovery changes, never environment-wide accept. Exact new live SHA, Vercel aliases, affected Railway services and permitted E2E must be verified. release-preflight.md has verified read-only IDs; upstream main last a8c4b82d95b35c0259600c19c1506faae807c3fc. No release mutation yet.
 
-Task9 DONE→read actual evidence/screenshots→FULLBASE..HEAD package→fresh permitted requirements/quality review; fix1–3 sameauthor/scopedsamereviewer only; clean gate→complete-historybundle/verify→Librarycreate+xattrs SAMEexec→ID ledger→fresh10. All10–13 plus fresh finalwholebranch review still pending; no unfinisheddeployment. Task10 requires concrete minimal ordinary R6-4 contract BEFORE guard/enforcement change. Task11 read AWS SDK Python/S3 skill; ownedDB+fakeS3 freshworker/conn crash boundaries, no realbucket/IAM activation. Task13 align BOTH local/automaticCI actual permitted test contents before anypublication, never execute omittedprobes viaCI.
+## Recovery/tool discipline
 
-Task8 genuine unknown historical generated artifacts retain terminal deferral; atomic fullrecaptureUNIMPLEMENTED, artifacts preserved. Contentless drafts now obtain genuine firstinput/output. Exact immutablepackage JD/Q/version and actual receipt IDs/kinds mustremain. NULL historicalQ wording minor carried9/13/final. Allphysical/TLS/production17.6/live24hcoverage/cost-neutrality readiness gaps honest. No new production deletion/security settings/credentials/IAM actions implied. Andrew14:27 completedreleaseholdremoved; preserve unrelated Railwaydiscovery5stagedchanges and no broad environmentaccept. All exactrelease IDs/preflight/rulings in release-preflight.md/progress.md; sourcecode/all13 first.
+Shell /bin/bash login:false. Owned random-loopback PostgreSQL17.11/16.15 only; no shared55432. Environment disconnect may leave same agent pending_init: confirm worktree/commands then resume SAME author, never duplicate implementation. Current accepted11 complete-history Library bundle is recovery source; current12 dirty source is not yet bundled. Commentary at most one concise line between tool calls, at least every60s; bounded waits45s. No callable cloud-thread send tool; platform notifies parent when actual final finishes.
 
-Latest committed UNACCEPTED Task9 reviewed complete-history snapshot: Library libfile_54f0e25258ac8191a455d47def475737 / file_000000001cb4820caf2bde591ab94686 v0, through25e4a2ece862816299dd0bdc5c6b2666f48e6e5b. Excludes activeFix1dirtywork. Accepted08unchanged.
+Task12 authorDONE/STOP sourcea6dd9193076dad21017bf53b49965c7df168452d, report5ac3beebffcc2d37eb506610015e40ce5f3c7b99. Root read fullreport, actualRED/serializer/DSTfailures/final48pass1.11s no skips, inventory/versions/Ruff; all8recordedhashesverifiedmatching. FullBASE0f87454..5ac3beeb package1546lines. Fresh permitted /root/recovery_task12_requirements_review Astra/high/forkNONE ACTIVE, readonly/no testsrerun/no oldomittedmechanism review/probes. Not accepted yet; trustedcurrenttime/completesuppression snapshots/cooperativedeadline/bootstrapabsence remain explicit. Nextsameauthor/scopedfixifneeded→Library12→fresh13; all13/finalreview/completedreleasecontinue.
 
-Parent continuation: root retains controller; no separate accessibleownerthread confirmed. ExistingTask9author resumedexistingFix1; await/integrate ratherthaninterimfinal. Latestcommittedreviewed-unacceptedrecovery Librarylibfile_ba5612b39fe88191946530bc1d280999 /file_00000000b2c081f6925b5dc14927155c v0 through08922f4, dirtyFix1excluded. Accepted08unchanged.
-
-Task9 same-author Fix1 finalphase:60affectedTS8files/tsc0/lint0errors9inheritedwarnings/fakebrowser17assertions authorreported; no DB/Python/transportdelta or reruns. Report/sourcepinpreparing; SAMEscopedreviewpending, no acceptance09. Ownershipconfirmedoriginalauthorunderthiscontroller; no otherownerthreadneeded.
-
-Task9 Fix1 author DONE/STOP: source6bd1099b4338cd154e8f1360db1e87fbe6fc2dae/reportfd0422fb8e5dab1ee006d87dcb992bcb13c4e9e2. Root read full report/actual outputs and prepared-status screenshot:60affectedTS8files/tsc0/lint0errors9warnings/17fakebrowserassertions, retained concurrent59pass1timeout then identical uncrowded60pass; no DB/Python/backend/transport delta/reruns. Full FixBASE7d9216d6..fd0422fb package generated. SAME original /root/recovery_task09_requirements_review resumed ONLY R9-1/R9-2 +fix-introduced Important/Critical, scope amendments preserved. No acceptance09 yet.
-
-Task9 complete (BASE5a319253..source6bd1099b/reportfd0422fb; original+scoped permitted requirements/code-quality approved). Same reviewer Fix1 SpecPASS/QualityAPPROVED; FULL report root read, R9-1/R9-2 ADDRESSED/no new Important/Critical, Funnel and actual React checklist addressed. Root read actual logs/screenshots/pins; exact wholephase evidence and failures retained. Task13 owned/default lane+3fixtures+2PDFskips, dynamic public/mutation query cost unmeasured, Task8 unknown-input recapture unimplemented, R6-4 mandatory10/13, omitted Task3 security review gaps remain. No production/activation/security approval. Accepted09 fullhistory Library checkpoint next, then fresh10 immediately.
-
-Checkpoint09 CONFIRMED Librarylibfile_6843e0ce183c8191a275f204e747c78d /file_000000003638821090268ef9b20fce0a v0/xattrs SAMEexec; verified completehistory4785080388b945e8408a3fedb0b4eb86e89a03be /workspace/scratch/job-board-lifecycle-recovery-checkpoint-09.bundle. Accepted permitted review, no security/fullrelease claim. Next freshsoleTask10 Astra/high forkNONE actualforwardBASE; minimal R6-4 operational contract report REQUIRED before anyguardchange.
-
-Task10 ACTIVE freshsoleauthor /root/recovery_task10_implementer Astra/high forkNONE BASE6075983bd63dced95ec94dc61b9b112a79f4564d. Exactbrief/dispatch/amendments+R6-4 proposal-before-contractchange supplied. Own typedoutbox/seal/exactack newfeature ordinarycoverage, no Task3 probe/security substitution. Localonly/authornosubagents/rootdocs-only/noGitstagewhileauthoractive. Accepted09 Library6843e0ce confirmed; all10–13/finalreview/completedauthorizedrelease remain.
-
-Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
-
-Task10 authorDONE/STOP source293e413dc452a4e9b230dcef87e23d11fa2798ed/report-evidencee3f889421fa1ad30206e128cb292b101bc3a58e0. FULLreport/commands/inventory/actual36selectedEACH17.11/16.15→7opsEACH→9batchEACH finalchanges/rootread;37uniquepermajoracrossphasesNOTonefinal37command. Lintpass/versionsactual, allfailures retained; noDBskip/securityproof. FullBASE6075983..e3f8894 packagegenerated, freshpermitted /root/recovery_task10_requirements_review Astra/highforkNONE ACTIVE. Importantphysicalcontractlimits: fixedcriticalslots1..12500/provision16default/0..100explicit,24576paddingbytes each (all307200000bytesbeforeoverhead), body<=8192/event<=12288; logicalpreallocationNOTphysicalcredit; seal/ackordinarygrowthguard maydeferaboveceiling, slotsnotautomaticallyrecycled, missingbaseline/slotsclosurerollback. Smallfixture0allocated/table/indexdelta NOTsustained/actualabove6000measurement; no refusedTask3probes. Writer/destination/baseline/operationalcoverage readiness and exporter/replay/compactperiodic orchestration pending11–13. Task10reviewnotaccepteduntilverdict; all13/finalreview/completedauthorizedreleasecontinue.
-
-Task10 freshreview INPROGRESS preliminary Important R6-4 integration concern fromsourceinspection: operationalmiss_count/first_miss_at separate from normalreconcile._positive resettingonlysource_listings; normalpositive betweenoperationalmissruns mayreuseobsoleteabsence/closeafteronenewmiss. Await FULLreviewfindings/verdict before ONEsameauthor correctiondispatch, no rootproductedit/duplicatereview/test/probe. No acceptance10 yet.
-
-Parent continuation source_thread01a11847-5d1a-7409-8aef-81db7f748013 confirmedTask9checkpoint/currentTask10 and requestedremainingstages/permittedreviews/authorizeddeployment/liveverification, existingauthor/worktreenoduplicate, significantacceptedcheckpoints/exactblockers/finalverifiedresult. ContinueexistingTask10freshreview+sameauthorfixloop, no intermediatefinal; documentedlimits/bundlespreserved.
-
-Task10 freshreviewpreliminaryadditionalfindings: newlogicalarchivepressure counts canonicaleventbytes only, omitting pendingmembership/seal/row/indexforecasts explicitlyspec8; legitimate sync_seed/companyenrichment/classification/location entrypoints unpaired whileactivationgated. Review explicitlynewfeaturecontractNOToldphysicalcapacityreview/probes. Reviewerverified18ownedsourceSHA256entries/migration-schemaexactparity; controllerHEAD4b02bdb docsonly/originalsourcepin293e413unchanged. Await FULLreport beforeONEcompleteFix1sameauthor.
-
-Parent01a11847 environment-disconnectednotice check: existingexecutor normalexec pwd/git/status/filechecks exit0 immediately, sameworktree intactHEAD4b02bdbd917e524b523ad4a404fb6608406fc5c5/only3controllerdocsdirty. Task10 reviewer ACTIVE; originalauthorDONE availableforSAMEFix1 pendingFULLreview. No observedroottransportblock/executorreplacement/writerduplication/stagerestart/securityretry. Continueexistingwork; accepted09 Library6843e0ce recoveryvalid.
-
-Task10 FULLfreshindependentreview rootREAD: SpecFAIL/QualityCHANGES_REQUIRED, SEVENImportant/noCritical. R10-1separatelanemissevidenceobsoleteafterpositive;R10-2newlogicalarchivebudgetmissingmembership/seal/row/indexforecasts;R10-3ArchiveBlockednotStorageBlockedrouting;R10-4currentsupportedseed/company/enrich/classify/name/locationwritersunpaired;R10-5observed/recordedtimeenvelope;R10-6approvedingestionday/digestkey+manifestidentity/ranges/digest;R10-7terminalfullreceipt/catalogueindefinite. Originalfindingsverbatimfullreport retained; ONEcompleteFix1sameoriginalauthor next, scopedSAMEreviewerafteractualaffectedfinalevidence. MinorSQLduplicatefn/selectioncomplexity/warningcoverage/nestedvalidator recordedfinaltriage; no source/securityprobe rerunsbyreviewer. FullR6-4 NOTacceptedwhile1/3open; no accepted10/release. Environmenthealthy sameworktree, no replacement.
-
-Task10 reviewedUNACCEPTEDrecovery CONFIRMED Librarylibfile_afca2a4987488191a150ede0402f44e6 /file_000000008fa88230abff5b1894b3d276 v0/xattrs SAMEexec, verifiedfullhistory0f0a759d009a042821465e0ac2c0dc4dece9501b /workspace/scratch/job-board-lifecycle-recovery-task10-reviewed-unaccepted.bundle. SAMEoriginal/root/recovery_task10_implementer resumedONEFix1 forALL7 fullfindings+dispatch; FixBASEe3f8894, controllerdocs0f0a759preserved. LatestACCEPTED09 unchanged Library6843e0ce. No executorblock/writerreplacement; all13/finalreview/authorizedcompletedreleasecontinue.
-
-Task10 SAMEauthorFix1 confirmedexecutorusable/full7findings+dispatch/spec8READ/no currentboundaryblocker. Scoped7newcaseRED underway; SourceListingcountersauthoritative/opsequencecursoronly, sharedStorageBlockedoutcome, currentpublicwritersboundedtransactionadapter; additiveFix1migrationnewlogicalforecast/separateobserved-recorded/serviceownedtestprefix+exactmanifest/compactmarkersfullterminalcataloguecleanup. No productionconfig/calls/oldphysicalmechanismprobes. All7 ONEpass, no replacement/duplicatestage. RootdocsunstagedwhileauthorGitactive; same-scopedreviewafterDONE.
-
-Task10 SAME author Fix1 DONE/STOP22:28 UTC: source01408f0fce8743a98a55726cc9da50f808955443; full report/evidence095fec89132bec361c6b1733d1fd97ff5018a6ed. Root read FULL Fix1 report and actual final evidence: one66-case selection EACH PG17.11/16.15, Ruffpass; no source delta/retests during handoff. Complete FixBASEe3f889421fa1ad30206e128cb292b101bc3a58e0..095fec89132bec361c6b1733d1fd97ff5018a6ed package generated. SAME original /root/recovery_task10_requirements_review resumed ONE scoped R10-1..7 plus fix-introduced Important/Critical only, no whole-task rerun/covered tests/omitted probes. Latest accepted09 unchanged; Task10 acceptance pending verdict. Repeated disconnect notices followed by normal command access, SAME author resumed report; no duplicate writer/reimplementation/blocker. Additional UNACCEPTED source/evidence recovery Library64fa98d0/d0e4b384 recorded CHECKPOINTS. All11–13/finalreview/authorized completed release remain.
-
-Task10: fix round1/5 (R10-1/5/6/7 closed; R10-2 partial and R10-3/4 caller residuals; FixBASEe3f8894..095fec8). FULL scoped review rootREAD SpecFAIL/QualityCHANGES_REQUIRED, THREEImportant/noCritical: F1-1ordinary membership/seal consumes critical reserve and no guaranteed logical processingroom; F1-2actual location caller executes onlyone100-rowchunk; F1-3newpairedseedpressure aborts actualdailyrun before sourceverification, firstfailedchunk also rollsbackrunrow. SAMEreviewerDONE/STOP; no tests/probes/sourcechanges. ONEcomplete Fix2 SAMEauthor forFULL3findings+review narrowordinaryevidence; actualpreviousreviewedFixBASE095fec89132bec361c6b1733d1fd97ff5018a6ed/source01408f0. No acceptance10/Task11/release yet; all13/completedauthorizedrelease remains active.
-
-Task10 Fix1 reviewedUNACCEPTED recovery CONFIRMED Librarylibfile_8e68919c12888191874ecd9e9fb6989a /file_00000000905481f7bd204947b9309349 v0; verified complete-history ae0b73fa69db4d4eab85d099f7169448f724f81e bundle /workspace/scratch/job-board-lifecycle-recovery-task10-fix1-reviewed-unaccepted.bundle; xattrs sameexec. Includes finalFix1 source/report/evidence/fullscopedreview/completeFix2dispatch; excludes in-progressFix2. SAMEoriginalauthor Fix2 active; latestACCEPTED09 unchanged.
-
-Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
-
-Task10 Fix2 final affected archive/actualcaller evidence rootREAD:37passed EACH ownedPG17.11(52.06s)/16.15(58.49s), exits0, Ruffpass; previous candidate63-case phase retained separately after new JSONreceiptserializationbound correction. Finalescrow6*C+128000bytes/event, representationbytesseparate, nophysical interfacechange. Fixtureordinaryeventcapacity506–865/reservedcriticalcapacity78–125EVENTS; actualclosure emits jobs+source_listings (~274306combinedlogicalbytesPG17), approximately61suchfixtureclosures withinreserved16MiB(ordinaryforecastat112MiB) beforeothercosts. Conservativebyteforecast binds longbeforenominalcountthresholds; notproductionthroughput/storageguarantee. Authorreport/sourcepinpending thenSAMEscopedreview F1-1..3; acceptance10notyet. Rootdoesnotstage whileauthorGitactive.
-
-Task10 SAMEauthorFix2 DONE/STOP: source872a9844f59d3ed4db483ff13fe40c0e02bff09b/report-evidence51d1000e6954b3e7bff56652718c8d90084b216a. Root FULLreport/chronology/actualcandidate63EACH17.11/16.15→finalaffected37EACH(52.06s/58.49s)/exit0/RuffpassREAD; all12sourceSHA256match/migrations04/05/06parity.64uniquefinal-supportedcases acrossincrementalphasesNOTsingle64command. CompleteFixBASE095fec8..51d1000package generated; SAMEoriginalreviewer resumedONLYF1-1..3+fixintroducedImportant/Critical. Exact128000+6Cescrowcapacitycosts/61fixturetwo-eventclosures explicit; physical/production/securityassurance unchanged. No source delta afterverification; latestaccepted09unchanged; acceptance10pendingSAMEscopedverdict thencheckpoint/fresh11.
-
-Task10: fix round2/5 (F1-1/F1-2/F1-3 closed,0open;095fec8..51d1000; source872a9844). Task10: complete (commits6075983bd63dced95ec94dc61b9b112a79f4564d..51d1000e6954b3e7bff56652718c8d90084b216a, original+SAMEscoped permitted requirements/code-quality review clean). FULLFix2review rootREAD SpecPASS/QualityAPPROVED/noImportantCritical,12hashes/full13890linediff/parityverified; no reviewer runtimeprobes/reruns. Seedpressure nowcontinuesactualdailysourceverification/durablerunaccounting; locationsdraincommitted100-rowchunks/incompletestatustruthful; ordinary/critical eventadmission reserves6*C+128000logicalprocessingbytes, materializesclaim/seal/ackinsideit. Actualbytesseparate/physicalinterfacesunchanged. Effectivefixture506–865ordinaryevents and61actualtwo-eventclosureswithinreserved16MiB, finite12500slotboundNOTequivalentrunway. Rootcorrectedambiguousfrom112MiBwording; allcosts/omittedTask3expiry/capacity/crossuser/adversarialassurance/privateinputlegacygap/sourcecoverage/MVCCreadinesshonest. Completehistoryaccepted10Librarycheckpoint next→freshsole11immediately; all11–13/finalreview/authorizedcompletedreleasecontinue.
-
-Checkpoint10 CONFIRMED: accepted permitted original+Fix1+Fix2 requirements/code-quality complete-historya4581b9132a74a51c3887a5bd7e3998b1ee60e7b. Verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-10.bundle, Librarylibfile_89343da4b35481919cac321d4d0554fb /file_0000000056188230aceed1e61193405d v0; xattrsappliedSAMEexec. No fullsecurity/activation/releaseclaim. FreshsoleTask11Astra/high/forkNONE nextfromactualforwardHEAD; fullbrief/preparedauthor-dispatch plusaccepted10interfaces andbindingamendments.
-
-Task11 ACTIVE freshsole /root/recovery_task11_implementer, Astra/high/forkNONE, BASE58180c0b4b85860d33813509abe7d3054648816f. Fulltask11brief/preparedauthor-dispatch/bindingamendments+accepted10interfaces handedoff, AWS SDKPython/S3skillreadrequired. Localowned17/16+fakeS3 persistedfreshworkerANDconnection crashmatrix, explicitauthorizedexpiredreplacement, boundedconditionalupload/read-close/seal/exactack/periodicterminalcleanup. No realbucket/config/activation/credentials/IAM/provider/paid/prod/release; no omittedTask3probes/substitutes. RootdocsunstagedwhileauthorGitactive. AfterDONEfullreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirements/qualityreview→sameauthor/scopedfixloopifneeded→accepted11Librarycheckpoint→fresh12. All11–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
-
-Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
-
-Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
-
-Task11 early UNACCEPTED NON-ATOMIC dirty recovery CONFIRMED Librarylibfile_4cefdf536dc48191a427cdd399424c6c /file_00000000daa88230bea14f29a193622e v0, /workspace/scratch/job-board-task11-in-progress-recovery.tar.gz. VerifiedfullhistoryBASE58180c0bundle +workingtreepatch +listednewS3/offlinetests +earlyinventory/REDoutputs; authoractive/copiedfilesmaypartial, notfullfinalTask11oracceptedcheckpoint; laternewfilesnotimplicitlycovered. No env/credentials/DBdump/dependencies/prodpayload included; xattrssameexec.22:58disconnectnotice followednormalcommands/SAMEauthorpending_init resumed successfully; depsboto3 1.42.74/botocore1.42.97 installed, absentexporter REDcollection retained, no transportblocker. Accepted10Library89343da4 unchanged; continueexisting11/all13/finalreview/release.
-
-Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
-
-Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
-Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
-
-Task11 reviewedUNACCEPTED recoveryCONFIRMED Librarylibfile_d3efadd574f081919ce97b7e1b36d5c2 /file_000000006f9882308f0478cd58a857d2 v0; verifiedcompletehistory8b6638c8d14a707c2a6110cba3c36244e76c2586 /workspace/scratch/job-board-lifecycle-recovery-task11-reviewed-unaccepted.bundle; xattrsSAMEexec. Includes7411eb3/a4c4693source/report/evidence/FULLreview/ONEFix1dispatch andcontrollerRulings/carries; activeFix1dirtyworkexcluded. SAMEoriginalauthor Fix1 active R11-1; latestACCEPTED10Library89343da4 unchanged. No source/security-probe/releaserootactions; continueall13/finalreview/completedauthorizedrelease.
-
-Task11 SAMEauthorFix1 DONE/STOP source4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4/reportc91efc60b12cfa599c8c6d409a117fd23c02e6ad. Root FULLreport/commands/inventory/actual2focusedEACH17.11(1.94s)/16.15(2.46s)/exit0/Ruffpass/fivehashesmatchREAD. Newmirrored08 dropsunconditionalbatchapprovalunique andaddsconsumed-onlypartialunique;07/runtimerecovery/oldclaimsrolescapacityunchanged. CompleteFixBASEa4c4693..c91efc6packagegenerated; SAMEoriginalreviewer resumedONLYR11-1+fixintroducedImportant/Critical, no whole-taskrerun/coveredtests/omittedprobes. Expiredapprovalhistory retained/newexplicitapproval/rollbackfreshconnectionretry/exactbytes-and-times/oneconsumption-and-supersession ordinaryfixturepassed. MinorR11-2/combinedresources/supersededcleanupcoverage/readiness/physical/securitylimits remain. No acceptance11 yet; latestaccepted10Library89343da4; all13/finalreview/authorizedcompletedreleasecontinue.
-
-Task11: fix round1/5 (R11-1closed,0Important/Criticalopen;a4c4693..c91efc6/source4ff6d706). Task11: complete (commits58180c0b4b85860d33813509abe7d3054648816f..c91efc60b12cfa599c8c6d409a117fd23c02e6ad, permittedoriginal+SAMEscopedrequirements/code-qualityreviewclean). Root FULLFix1reviewREAD SpecPASS/QualityAPPROVED/fivehashes/full6116linediff/parityconfirmed, no reviewer runtimeprobes/reruns. Original61featureEACH17/16+1catalogEACH thenFix1newapprovalcase+catalog2EACH areincrementalphasecounts, notunrestricted/fullsinglematrix; oldruntimeunchanged. New08consumed-onlyapprovalunique preservesexpiredhistory/freshoperatorapproval/exactpendingidentity/onecommittedfence; workernevergrantsapprovals. MinorR11-2/correctlimitedbombfixtureclaim/combinedruntime/superseded-shellagingcoverage/readiness/physical/omittedsecuritylimits carry13/final. Actualsource4ff6d706/reportc91efc6; accepted11completehistoryLibrarycheckpointnext→freshsole12immediately. All12–13/finalreview/completedauthorizedrelease remain; no interimfinal/activation/productionsecurityapproval.
-
-Checkpoint11 CONFIRMED acceptedpermittedcompletehistory7c43e19e490827d6593434d55ae7cb77c975d050, verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-11.bundle, Librarylibfile_c221028586448191a44b35e1b8baee42 /file_000000009b2481f59baf69d0d16d7c10 v0/xattrsSAMEexec. Fullsource/report/evidence/initial+scopedreview/Rulings/costs preserved; no fullsecurity/activation/releaseclaim. NextfreshsoleTask12Astra/high/forkNONE actualforwardBASE, readtask12brief/preparedauthor-dispatch/bindingamendments/acceptedinterfaces, pureboundedadminprojectiononly.
+Task12 initialpermittedreview CHANGES_REQUIRED/CHANGES_REQUIRED, twoImportantR12-1 presentbaselineoverridescoveragefloor andR12-2 unboundedmembershipcardinalitybeforetypewalk/sealbuilder. RootFULLreportread; noCritical/Minor. SameauthorFix1/5 dispatch prepared, exactnarrowordinaryfixtures/nohugeinputs/nooldprobes/nofullrerun. SAMEreviewer scopedoriginalfindings+fixintroducedImportantCritical only afterDONE. Source/report remain unaccepted; continue all13/finalreview/release.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
index 3c21a2b..12ef2b1 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/controller-resume.md
@@ -345,10 +345,18 @@ Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema
 Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
 Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
 
 Task11 reviewedUNACCEPTED recoveryCONFIRMED Librarylibfile_d3efadd574f081919ce97b7e1b36d5c2 /file_000000006f9882308f0478cd58a857d2 v0; verifiedcompletehistory8b6638c8d14a707c2a6110cba3c36244e76c2586 /workspace/scratch/job-board-lifecycle-recovery-task11-reviewed-unaccepted.bundle; xattrsSAMEexec. Includes7411eb3/a4c4693source/report/evidence/FULLreview/ONEFix1dispatch andcontrollerRulings/carries; activeFix1dirtyworkexcluded. SAMEoriginalauthor Fix1 active R11-1; latestACCEPTED10Library89343da4 unchanged. No source/security-probe/releaserootactions; continueall13/finalreview/completedauthorizedrelease.
 
 Task11 SAMEauthorFix1 DONE/STOP source4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4/reportc91efc60b12cfa599c8c6d409a117fd23c02e6ad. Root FULLreport/commands/inventory/actual2focusedEACH17.11(1.94s)/16.15(2.46s)/exit0/Ruffpass/fivehashesmatchREAD. Newmirrored08 dropsunconditionalbatchapprovalunique andaddsconsumed-onlypartialunique;07/runtimerecovery/oldclaimsrolescapacityunchanged. CompleteFixBASEa4c4693..c91efc6packagegenerated; SAMEoriginalreviewer resumedONLYR11-1+fixintroducedImportant/Critical, no whole-taskrerun/coveredtests/omittedprobes. Expiredapprovalhistory retained/newexplicitapproval/rollbackfreshconnectionretry/exactbytes-and-times/oneconsumption-and-supersession ordinaryfixturepassed. MinorR11-2/combinedresources/supersededcleanupcoverage/readiness/physical/securitylimits remain. No acceptance11 yet; latestaccepted10Library89343da4; all13/finalreview/authorizedcompletedreleasecontinue.
 
 Task11: fix round1/5 (R11-1closed,0Important/Criticalopen;a4c4693..c91efc6/source4ff6d706). Task11: complete (commits58180c0b4b85860d33813509abe7d3054648816f..c91efc60b12cfa599c8c6d409a117fd23c02e6ad, permittedoriginal+SAMEscopedrequirements/code-qualityreviewclean). Root FULLFix1reviewREAD SpecPASS/QualityAPPROVED/fivehashes/full6116linediff/parityconfirmed, no reviewer runtimeprobes/reruns. Original61featureEACH17/16+1catalogEACH thenFix1newapprovalcase+catalog2EACH areincrementalphasecounts, notunrestricted/fullsinglematrix; oldruntimeunchanged. New08consumed-onlyapprovalunique preservesexpiredhistory/freshoperatorapproval/exactpendingidentity/onecommittedfence; workernevergrantsapprovals. MinorR11-2/correctlimitedbombfixtureclaim/combinedruntime/superseded-shellagingcoverage/readiness/physical/omittedsecuritylimits carry13/final. Actualsource4ff6d706/reportc91efc6; accepted11completehistoryLibrarycheckpointnext→freshsole12immediately. All12–13/finalreview/completedauthorizedrelease remain; no interimfinal/activation/productionsecurityapproval.
 
 Checkpoint11 CONFIRMED acceptedpermittedcompletehistory7c43e19e490827d6593434d55ae7cb77c975d050, verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-11.bundle, Librarylibfile_c221028586448191a44b35e1b8baee42 /file_000000009b2481f59baf69d0d16d7c10 v0/xattrsSAMEexec. Fullsource/report/evidence/initial+scopedreview/Rulings/costs preserved; no fullsecurity/activation/releaseclaim. NextfreshsoleTask12Astra/high/forkNONE actualforwardBASE, readtask12brief/preparedauthor-dispatch/bindingamendments/acceptedinterfaces, pureboundedadminprojectiononly.
+
+Task12 ACTIVE freshsole /root/recovery_task12_implementer Astra/high/forkNONE, BASE0f87454e965f3ef8d06b18ce93d23ea621d53b6f. Fulltask12brief/preparedauthor-dispatch/bindingamendments/acceptedarchiveinterfaces handedoff; pureboundedadminfile/testprojection, exactdup/conflict/provenance/retentiongaps/independentfactallowlist/suppressionepochprecedence, noappDBrestore/realS3/provider/paid/notifications/productionwrites/objectdeletion/activation/release. Exactpermittedtestinventorybeforeexecution; no oldomittedmechanismprobes/substitutes/broadpytest/shared55432. RootdocsunstagedwhileauthorGitactive. AfterDONEFULLreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirementsqualityreview→sameauthor/scopedfixloopifneeded→Libraryaccepted12→fresh13. All12–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
+
+Task12 Ruling: permit compatible defaulted ProjectionResult metadata appended after the existing applied_event_ids/ignored_event_ids and replay-local typed sealed-input/policy/limits; preserve actual permanent whole-aggregate suppression across all revisions/timestamps, with any trusted snapshot epoch serving provenance only — why: Task12 requires projection facts/coverage/gaps/errors and bounded policy absent from accepted interfaces, while persisted suppression has no epoch and exporter already rejects the entire scope. No DB or accepted seal/codec change. Cost if wrong: constructor compatibility or projection metadata requires local rework; permanent suppression can conservatively omit all historical facts, and a provenance epoch supplies no event-level authorization or restoration permission.
+
+Task12 authorDONE/STOP sourcea6dd9193076dad21017bf53b49965c7df168452d, report5ac3beebffcc2d37eb506610015e40ce5f3c7b99. Root read fullreport, actualRED/serializer/DSTfailures/final48pass1.11s no skips, inventory/versions/Ruff; all8recordedhashesverifiedmatching. FullBASE0f87454..5ac3beeb package1546lines. Fresh permitted /root/recovery_task12_requirements_review Astra/high/forkNONE ACTIVE, readonly/no testsrerun/no oldomittedmechanism review/probes. Not accepted yet; trustedcurrenttime/completesuppression snapshots/cooperativedeadline/bootstrapabsence remain explicit. Nextsameauthor/scopedfixifneeded→Library12→fresh13; all13/finalreview/completedreleasecontinue.
+
+Task12 initialpermittedreview CHANGES_REQUIRED/CHANGES_REQUIRED, twoImportantR12-1 presentbaselineoverridescoveragefloor andR12-2 unboundedmembershipcardinalitybeforetypewalk/sealbuilder. RootFULLreportread; noCritical/Minor. SameauthorFix1/5 dispatch prepared, exactnarrowordinaryfixtures/nohugeinputs/nooldprobes/nofullrerun. SAMEreviewer scopedoriginalfindings+fixintroducedImportantCritical only afterDONE. Source/report remain unaccepted; continue all13/finalreview/release.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index 602a44e..2c95215 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -403,10 +403,18 @@ Task13 sourcecoverage concrete carry: root read runtime references afterTask11.
 Task11 authorDONE/STOP source7411eb34187bf2b7956472c186670660611e2f26/reporta4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9. Root FULLreport/commands/actual61EACH17.11/16.15+catalog1EACH/Ruff/14hashes READ; completeBASE58180c0..a4c4693package. FreshAstra/high/forkNONE /root/recovery_task11_requirements_review FULLreviewDONE/STOP SpecFAIL/QualityCHANGES_REQUIRED: R11-1Important expiredunusedauthorization UNIQUEbatch locksoutnewexplicitoperatorapprovalforever; noCritical. Root FULLreviewREAD; ONEFix1 SAMEauthor forverbatimR11-1+narrowaffectedowned17/16/catalog evidence, thenSAMEscopedreview. No acceptance11/release; all13/finalreview/authorizedcompletedreleaseactive.
 Task11: minor(deferred): R11-2 bombfixture uses2-bytecompressed limit/rejectsContentLength beforedecompression, notexporterpath; honestlabel/sourceprotection claims andfocusedoptionalexportpathfixture finaltriage. Superseded-shell7daycleanup dedicatedfixtureabsent andcombinedreviewer/maintenance/archive runtime sizingunmeasured carried13/final. Offlineworkerimport0.359sCPU/38,212KiBRSS NOTcombinedprodresourcecostneutrality.
 
 Task11 reviewedUNACCEPTED recoveryCONFIRMED Librarylibfile_d3efadd574f081919ce97b7e1b36d5c2 /file_000000006f9882308f0478cd58a857d2 v0; verifiedcompletehistory8b6638c8d14a707c2a6110cba3c36244e76c2586 /workspace/scratch/job-board-lifecycle-recovery-task11-reviewed-unaccepted.bundle; xattrsSAMEexec. Includes7411eb3/a4c4693source/report/evidence/FULLreview/ONEFix1dispatch andcontrollerRulings/carries; activeFix1dirtyworkexcluded. SAMEoriginalauthor Fix1 active R11-1; latestACCEPTED10Library89343da4 unchanged. No source/security-probe/releaserootactions; continueall13/finalreview/completedauthorizedrelease.
 
 Task11 SAMEauthorFix1 DONE/STOP source4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4/reportc91efc60b12cfa599c8c6d409a117fd23c02e6ad. Root FULLreport/commands/inventory/actual2focusedEACH17.11(1.94s)/16.15(2.46s)/exit0/Ruffpass/fivehashesmatchREAD. Newmirrored08 dropsunconditionalbatchapprovalunique andaddsconsumed-onlypartialunique;07/runtimerecovery/oldclaimsrolescapacityunchanged. CompleteFixBASEa4c4693..c91efc6packagegenerated; SAMEoriginalreviewer resumedONLYR11-1+fixintroducedImportant/Critical, no whole-taskrerun/coveredtests/omittedprobes. Expiredapprovalhistory retained/newexplicitapproval/rollbackfreshconnectionretry/exactbytes-and-times/oneconsumption-and-supersession ordinaryfixturepassed. MinorR11-2/combinedresources/supersededcleanupcoverage/readiness/physical/securitylimits remain. No acceptance11 yet; latestaccepted10Library89343da4; all13/finalreview/authorizedcompletedreleasecontinue.
 
 Task11: fix round1/5 (R11-1closed,0Important/Criticalopen;a4c4693..c91efc6/source4ff6d706). Task11: complete (commits58180c0b4b85860d33813509abe7d3054648816f..c91efc60b12cfa599c8c6d409a117fd23c02e6ad, permittedoriginal+SAMEscopedrequirements/code-qualityreviewclean). Root FULLFix1reviewREAD SpecPASS/QualityAPPROVED/fivehashes/full6116linediff/parityconfirmed, no reviewer runtimeprobes/reruns. Original61featureEACH17/16+1catalogEACH thenFix1newapprovalcase+catalog2EACH areincrementalphasecounts, notunrestricted/fullsinglematrix; oldruntimeunchanged. New08consumed-onlyapprovalunique preservesexpiredhistory/freshoperatorapproval/exactpendingidentity/onecommittedfence; workernevergrantsapprovals. MinorR11-2/correctlimitedbombfixtureclaim/combinedruntime/superseded-shellagingcoverage/readiness/physical/omittedsecuritylimits carry13/final. Actualsource4ff6d706/reportc91efc6; accepted11completehistoryLibrarycheckpointnext→freshsole12immediately. All12–13/finalreview/completedauthorizedrelease remain; no interimfinal/activation/productionsecurityapproval.
 
 Checkpoint11 CONFIRMED acceptedpermittedcompletehistory7c43e19e490827d6593434d55ae7cb77c975d050, verified /workspace/scratch/job-board-lifecycle-recovery-checkpoint-11.bundle, Librarylibfile_c221028586448191a44b35e1b8baee42 /file_000000009b2481f59baf69d0d16d7c10 v0/xattrsSAMEexec. Fullsource/report/evidence/initial+scopedreview/Rulings/costs preserved; no fullsecurity/activation/releaseclaim. NextfreshsoleTask12Astra/high/forkNONE actualforwardBASE, readtask12brief/preparedauthor-dispatch/bindingamendments/acceptedinterfaces, pureboundedadminprojectiononly.
+
+Task12 ACTIVE freshsole /root/recovery_task12_implementer Astra/high/forkNONE, BASE0f87454e965f3ef8d06b18ce93d23ea621d53b6f. Fulltask12brief/preparedauthor-dispatch/bindingamendments/acceptedarchiveinterfaces handedoff; pureboundedadminfile/testprojection, exactdup/conflict/provenance/retentiongaps/independentfactallowlist/suppressionepochprecedence, noappDBrestore/realS3/provider/paid/notifications/productionwrites/objectdeletion/activation/release. Exactpermittedtestinventorybeforeexecution; no oldomittedmechanismprobes/substitutes/broadpytest/shared55432. RootdocsunstagedwhileauthorGitactive. AfterDONEFULLreport/actualevidence→FULLBASE..HEADpackage→freshpermittedrequirementsqualityreview→sameauthor/scopedfixloopifneeded→Libraryaccepted12→fresh13. All12–13/finalreview/authorizedcompletedreleasecontinue; no intermediatefinal.
+
+Task12 Ruling: permit compatible defaulted ProjectionResult metadata appended after the existing applied_event_ids/ignored_event_ids and replay-local typed sealed-input/policy/limits; preserve actual permanent whole-aggregate suppression across all revisions/timestamps, with any trusted snapshot epoch serving provenance only — why: Task12 requires projection facts/coverage/gaps/errors and bounded policy absent from accepted interfaces, while persisted suppression has no epoch and exporter already rejects the entire scope. No DB or accepted seal/codec change. Cost if wrong: constructor compatibility or projection metadata requires local rework; permanent suppression can conservatively omit all historical facts, and a provenance epoch supplies no event-level authorization or restoration permission.
+
+Task12 authorDONE/STOP sourcea6dd9193076dad21017bf53b49965c7df168452d, report5ac3beebffcc2d37eb506610015e40ce5f3c7b99. Root read fullreport, actualRED/serializer/DSTfailures/final48pass1.11s no skips, inventory/versions/Ruff; all8recordedhashesverifiedmatching. FullBASE0f87454..5ac3beeb package1546lines. Fresh permitted /root/recovery_task12_requirements_review Astra/high/forkNONE ACTIVE, readonly/no testsrerun/no oldomittedmechanism review/probes. Not accepted yet; trustedcurrenttime/completesuppression snapshots/cooperativedeadline/bootstrapabsence remain explicit. Nextsameauthor/scopedfixifneeded→Library12→fresh13; all13/finalreview/completedreleasecontinue.
+
+Task12 initialpermittedreview CHANGES_REQUIRED/CHANGES_REQUIRED, twoImportantR12-1 presentbaselineoverridescoveragefloor andR12-2 unboundedmembershipcardinalitybeforetypewalk/sealbuilder. RootFULLreportread; noCritical/Minor. SameauthorFix1/5 dispatch prepared, exactnarrowordinaryfixtures/nohugeinputs/nooldprobes/nofullrerun. SAMEreviewer scopedoriginalfindings+fixintroducedImportantCritical only afterDONE. Source/report remain unaccepted; continue all13/finalreview/release.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
index 26c90e0..eb77606 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
@@ -62,10 +62,12 @@ Task9 Ruling: narrow additive read-only public lifecycle projection/predicate he
 
 Task10 Ruling: implement an additive bounded operational lane for existing-source verification/closure using proactively provisioned source/listing/claim/receipt and critical-public-event slots; keep ordinary growth admission and existing physical6000MiB/all-held forecasts unchanged — why: R6-4 cannot be satisfied by read-only HTTP or zero-byte reservation alone, and new ingestion must remain paused while exact full-feed evidence, health and eligible closure progress durably continue. The new lane may update ONLY fixed allowlisted operational fields/identities and consume bounded preallocated receipts/events, never create identities/payload or invent membership/absence. Missing slots/backlog/destination/readiness must yield explicit storage-deferred outcomes; closure is not reported committed if matching active-archive event cannot be retained. Existing gate/sortedkeys/claim/DBtime/originalrole checks remain; no general exemption/GUC bypass/new client grants. Narrow reusable transaction receipts are local feature integration, not replacement independent Task3 security review/probes. Critical slot reuse ONLY after durable exact ack/retained fences/markers; no pending TTL/cascade deletion. Physical MVCC UPDATE allocation and reusable space are explicitly UNKNOWN until measured; bounded logical preallocation is not a zero-physical-growth guarantee or DELETEcredit. Cost if wrong: operational-slot/receipt consistency and increased local scope require rework; above-guard service can pause on exhausted slots, and no full security/capacity/production guarantee follows. Record exact table/field/slot accounting and ordinary ownedDB workflow resource/delta evidence; no omitted enforcement/capacity/cross-user/adversarial probes. Changes must remain isolated additive interface; report concrete conflicts before altering old shared enforcement.
 
 Task10 Fix2 Ruling: allow the new logical archive lifecycle forecast to reserve bounded future membership, singleton batch/seal metadata and exact-ack workspace at event admission; retain this escrow while pending and materialize processing inside it, with actual retained representation bytes reported separately — why: F1-1 cannot be fixed by merely lowering a later batch ceiling, since admitted events could otherwise exhaust their own processing room and ordinary copies spend the closure-only reserve. Ordinary/critical admission stays within112/128MiB and unchanged event-slot dimensions; old physical6000MiB/all-held reservation, roles/gate/claims/DBtime remain untouched. Require exact arithmetic and small ordinary admitted→claim→seal→ack evidence; no omitted physical/security mechanism probes. Cost if wrong: conservative per-event singleton processing escrow reduces logical backlog/runway and increases local archive accounting complexity; an undersized estimate would require rework and can pause processing, while no physical/cost/security guarantee follows. SAMEauthor proposed this contract; source implementation/evidence and SAME independent scoped review remain required.
 
 Task11 Ruling: extend only the new archive schema/state/immutability protocol through an additive migration to permit explicitly authorized expired-batch supersession and atomic exact-membership transfer — why: accepted Task10 CHECK statesclaimed/sealed/acked and immutableitembatch_id intentionally cannot implement the bindingTask11expiredreplacement requirement without this narrow new transition. Persist and atomicallyconsume explicitoperatorauthorization; workerneverautoauthorizes; preserve exact IDs/body/hash/revisions/observed-recordedtimes anddurableoldowner/batchfences, rejectoldcallbacks, no generalmutablefield/GUC/clientbypass. Existingphysicaladmission/claims/roles/gateunchanged; noDeletecredit/pendingTTL/cascade/objectdelete/suppressionresurrection. Localownedarchivefeaturefixtures only, no productionreplacementpermission/omittedTask3probe. Cost if wrong: supersession/authorization/fence consistency increases archive state complexity and can retain extra metadata or defer recovery; requires source/evidence and fresh permitted Task11review, doesnotgrantphysical/securityassurance. SAMEsoleauthorreportedinterfaceconflictBEFOREedits; controllerresolvednarrowly, no replacementwriter.
 
 Task11 Ruling: allow a narrow additive archive-only migration extending claimed/sealed/acked state with persisted explicit RecoveryAuthorization and superseded/fenced terminal identity, and allow exact pending-item transfer only through that authorized recovery protocol — why: the existing immutable batch_id/state constraints otherwise make the binding expired-seal replacement requirement impossible. Preserve exact eventIDs/bodies/hash/revisions/observed-recordedtimes, oldseal/fences/callbackrejection, pendingretention, gate/sortedkeys and unchanged oldphysical/role/claim enforcement; no selfauthorization or realproductionrecovery/activation implied. Cost if wrong: archive state/immutability integration requires rework and ambiguous recovery could strand pending work; ordinary persistedfreshworker/connection fault evidence and independent permittedTask11review are required, not newsecurity/physicalassurance. Root authorizedthislocalprotocol scope before author implementation, not a productionaction.
 
 Task11 Ruling: permit only tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations as affected new-migration catalog parity onowned17/16 — why: root read the exactnode, which compares clean/frozen+additivemigration catalogs and reapplicationledger; the archive-only state/immutability migration needsmatching schema proof. No sibling owner-ACL/defaultgrant/drift/RLS/security/activation/probe nodes or wholemigrationfile, no oldmechanismreview, onlyownedfixtureDDL. Cost if wrong: staticcatalog parity can misssemantic runtime defects and supplies no production/securityassurance; persistedarchivefeaturetests/permittedreview remain separatelyrequired. Explicitinventory beforeexecution; no shared55432.
+
+Task12 Ruling: permit compatible defaulted ProjectionResult metadata appended after the existing applied_event_ids/ignored_event_ids and replay-local typed sealed-input/policy/limits; preserve actual permanent whole-aggregate suppression across all revisions/timestamps, with any trusted snapshot epoch serving provenance only — why: Task12 requires projection facts/coverage/gaps/errors and bounded policy absent from accepted interfaces, while persisted suppression has no epoch and exporter already rejects the entire scope. No DB or accepted seal/codec change. Cost if wrong: constructor compatibility or projection metadata requires local rework; permanent suppression can conservatively omit all historical facts, and a provenance epoch supplies no event-level authorization or restoration permission.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-dispatch.md
new file mode 100644
index 0000000..a9fc279
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-dispatch.md
@@ -0,0 +1,9 @@
+# Task12 Fix1/5 — same sole author, local only
+
+Original requirements/quality review CHANGES REQUIRED, exactly two Important findings in task-12-requirements-review.md (read FULL). FixBASE5ac3beebffcc2d37eb506610015e40ce5f3c7b99; controller-only intervening80f61fdb7ae8972778429c96ff5c7b0d5083e8a3. Correct both in one forward source/report wave, no controller files, no author helpers/reviewers.
+
+R12-1: present baseline/candidate below declared coverage floor must not override policy; consistent input eligibility/traversal, ranges/applied IDs/gap provenance. Narrow ordinary fixtures present below-floor baseline plus contiguous later chain, missing-prefix relationship remains unavailable, at-floor baseline usable. Terminal outside_declared_coverage/incomplete/independent-only/no below-floor retained ranges. Do not invent global posting history.
+
+R12-2: O(1) tuple cardinalities and per-seal cap/count agreement/remaining events before any membership ID traversal or seal builder. Preserve accepted codec/seal. Small mismatched descriptor and2001ID fixture with early rejection evidence/sanitized error/no facts; no large allocation/timing/stress/oldphysical probes.
+
+Record exact focused inventory BEFORE execution, RED/GREEN and affected reader regressions. Do not rerun whole original48/codec or unaffected flows absent justified changed concern. No DB/cloud/provider/production/excludedTask3/security probes or release/activation/deletion. Same independent reviewer performs originalR12-1/R12-2 and fix-introducedImportantCritical review only. task-12-fix1-report.md +task-12-fix1-evidence/; exact source/dependency hashes/commands/outputs/pins, forward commits and DONE/STOP.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/collection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/collection.txt
new file mode 100644
index 0000000..0800c3f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/collection.txt
@@ -0,0 +1,22 @@
+tests/test_archive_replay_fix1.py::test_present_prefix_below_floor_cannot_expand_declared_coverage
+tests/test_archive_replay_fix1.py::test_present_relationship_prefix_below_floor_cannot_supply_full_fields
+tests/test_archive_replay_fix1.py::test_baseline_at_floor_still_anchors_only_declared_history
+tests/test_archive_replay_fix1.py::test_entirely_below_floor_input_has_truthful_terminal_reason
+tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[2-1-1]
+tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[1-2-2]
+tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[2001-1-1]
+tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[0-1-1]
+tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[1-1-2]
+tests/test_archive_replay_fix1.py::test_remaining_event_budget_checked_before_membership_traversal
+tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal
+tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries
+tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only
+tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon
+tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits0]
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits1]
+tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits2]
+tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True]
+tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-2]
+
+20 tests collected in 0.06s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/commands.md
new file mode 100644
index 0000000..61624cb
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/commands.md
@@ -0,0 +1,28 @@
+# Fix1 commands and evidence
+
+Working directory /workspace/job-board/.claude/worktrees/lifecycle-recovery; bash login:false. Every pytest output was redirected with `> <evidence>/<name>.txt 2>&1`, then its exit status was saved to the corresponding .exit. Exact raw bytes are preserved in .raw.txt.gz; readable .txt strips trailing whitespace only.
+
+Initial fixture-import failure (red.txt) and intended RED after correcting the import (red2.txt):
+
+```text
+.venv/bin/python -m pytest tests/test_archive_replay_fix1.py -q
+```
+
+Final GREEN (green.txt):
+
+```text
+.venv/bin/python -m pytest tests/test_archive_replay_fix1.py tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times tests/test_archive_replay.py::test_finite_input_budgets_fail_closed tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer -q
+```
+
+collection.txt uses exactly that selection with `--collect-only -q` replacing `-q`;20 cases. No other test selection executed.
+
+```text
+.venv/bin/python -m ruff format job_discovery/archive/replay.py tests/test_archive_replay_fix1.py
+.venv/bin/python -m ruff check job_discovery/archive/replay.py tests/test_archive_replay_fix1.py
+sha256sum job_discovery/archive/replay.py tests/test_archive_replay_fix1.py tests/test_archive_replay.py job_discovery/archive/schema.py job_discovery/archive/types.py job_discovery/archive/batches.py job_discovery/archive/codec.py pyproject.toml
+sha256sum -c .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-before.sha256
+```
+
+Hashes captured before GREEN and checked afterward. versions.txt comes from .venv/bin/python printing sys.version and importlib.metadata.version('pytest'/'ruff'/'psycopg'); no PostgreSQL server used.
+
+Source: `git add job_discovery/archive/replay.py tests/test_archive_replay_fix1.py`; `git diff --cached --check` exit0; `git commit -m "fix: enforce replay coverage and bound membership before traversal"` -> ecba747343369c26041ef5655ed56b044d7098a0. Report/evidence are committed separately. No source changes after final GREEN.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-before.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-before.sha256
new file mode 100644
index 0000000..84ba2d3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-before.sha256
@@ -0,0 +1,8 @@
+f3facac4ac0938be43b2a217543388e8ebe6ec73133334d0bb093061d8b471e9  job_discovery/archive/replay.py
+d4139780c1b717add10ad38d9cd1eec715d662d27b42a7ab7c07b4033848e563  tests/test_archive_replay_fix1.py
+629b2518a264c2daacd6788148d5cd74a0bf44bce8c5d7696aa61dc68a794ba7  tests/test_archive_replay.py
+1d5e19a3bd937b51f34f16fcd56a1354d46c34c13370c2f69517ac19f2dd5ff5  job_discovery/archive/schema.py
+3bb96646d2e9225a9b65a821af7612c69d2a118b13738e180c97c71171862330  job_discovery/archive/types.py
+ec3b17f1cf76526ff22adcaf21648719ac6901479785e4cd4162a8d69dfd45d6  job_discovery/archive/batches.py
+4c9075ec074c2b8896a8c575ee61f4cf1401bfb0e0335dc9e69ad0218403230b  job_discovery/archive/codec.py
+e7396bb84fdd2f4bb67e3dbcd7a4576e1350e1573c6409de323125b3efe90459  pyproject.toml
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-hash-verification.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-hash-verification.txt
new file mode 100644
index 0000000..58fe571
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-hash-verification.txt
@@ -0,0 +1,8 @@
+job_discovery/archive/replay.py: OK
+tests/test_archive_replay_fix1.py: OK
+tests/test_archive_replay.py: OK
+job_discovery/archive/schema.py: OK
+job_discovery/archive/types.py: OK
+job_discovery/archive/batches.py: OK
+job_discovery/archive/codec.py: OK
+pyproject.toml: OK
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.raw.txt.gz
new file mode 100644
index 0000000..b2ca65c
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.txt
new file mode 100644
index 0000000..f5e2b8b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/green.txt
@@ -0,0 +1,2 @@
+....................                                                     [100%]
+20 passed in 0.19s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/inventory.md
new file mode 100644
index 0000000..2f6d796
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/inventory.md
@@ -0,0 +1,5 @@
+# Fix1 pre-execution ordinary inventory
+
+Read FULL task-12-requirements-review.md and task-12-fix1-dispatch.md. FixBASE5ac3beebffcc2d37eb506610015e40ce5f3c7b99; actualHEAD7291e2b documentation-only after sourcea6dd919. Tests written before product fixes. RED runs only tests/test_archive_replay_fix1.py: four R12-1 fixtures (present baseline1/chain2/3 below declaredfloor3; present relationship prefix belowfloor3; at-floor baseline3 stillusable after excluded1/2; entirelyexcluded input reports truthful outside-coverage gap), five R12-2 small malformed descriptor count combinations (IDcount/eventcount/declaredcount:2/1/1,1/2/2,2001/1/1,0/1/1,1/1/2), one cumulative event-budget fixture (one accepted event then two over remainingbudget). A tuple subclass fixture fails if traversed; a seal-builder guard fails if invoked for rejected descriptors. Largest descriptor2001 UUID references, no stress/timing/resource experiment.
+
+GREEN includes those10 cases and only directly affected existing exact nodes: test_outside_declared_coverage_is_terminal; test_missing_predecessor_unknown_cause_is_terminal_without_retries; test_expired_baseline_terminal_gap_independent_facts_only; test_projection_expiry_recomputes_no_retained_facts_after_horizon; test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times; test_finite_input_budgets_fail_closed (three parameters); test_total_manifest_rejects_unknown_or_boolean_serializer (two parameters). These ten existing cases check gap-reason precedence/emptyretained handling, unchanged bounded validmembership and count/type/budget handling in the changed reader path. No whole44/48 test selection, codec file, unaffected flows, DB/cloud/provider/old security/activation/Task3 probes.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.exit
new file mode 100644
index 0000000..0cfbf08
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.exit
@@ -0,0 +1 @@
+2
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.raw.txt.gz
new file mode 100644
index 0000000..ca9650f
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.txt
new file mode 100644
index 0000000..554801b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red.txt
@@ -0,0 +1,16 @@
+
+==================================== ERRORS ====================================
+______________ ERROR collecting tests/test_archive_replay_fix1.py ______________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_replay_fix1.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_archive_replay_fix1.py:11: in <module>
+    from test_archive_replay import NOW, event, manifest, project
+E   ModuleNotFoundError: No module named 'test_archive_replay'
+=========================== short test summary info ============================
+ERROR tests/test_archive_replay_fix1.py
+!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
+1 error in 0.26s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.raw.txt.gz
new file mode 100644
index 0000000..2dc2207
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.raw.txt.gz differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.txt
new file mode 100644
index 0000000..d642f3c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/red2.txt
@@ -0,0 +1,273 @@
+FFFFFFFFFF                                                               [100%]
+=================================== FAILURES ===================================
+_______ test_present_prefix_below_floor_cannot_expand_declared_coverage ________
+
+    def test_present_prefix_below_floor_cannot_expand_declared_coverage():
+        policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+        result = project(manifest(event(), event(2), event(3)), policy=policy)
+        assert not result.errors
+>       assert result.coverage[0].status == "incomplete"
+E       AssertionError: assert 'complete_from_baseline' == 'incomplete'
+E
+E         - incomplete
+E         + complete_from_baseline
+
+tests/test_archive_replay_fix1.py:18: AssertionError
+____ test_present_relationship_prefix_below_floor_cannot_supply_full_fields ____
+
+    def test_present_relationship_prefix_below_floor_cannot_supply_full_fields():
+        rid, brand = str(uuid4()), str(uuid4())
+        values = []
+        for revision in range(1, 4):
+            value = event(revision)
+            value.update(aggregate_type="company_brands", aggregate_id=rid,
+                         event_id=str(event_id("company_brands", rid, revision)),
+                         predecessor_id=str(event_id("company_brands", rid, revision-1)) if revision > 1 else None,
+                         body=dict(id=rid, company_id=1, brand_id=brand, revision=revision,
+                                   status="accepted", evidence_kind="structured_source",
+                                   public_evidence_ref="https://example.test/evidence"))
+            values.append(value)
+        policy = ProjectionPolicy(True, NOW, coverage_starts=(("company_brands", rid, 3),))
+        result = project(manifest(*values), policy=policy)
+>       assert not result.errors and not result.facts
+E       AssertionError: assert (not () and not (ProjectedFact(aggregate_type='company_brands', aggregate_id='a47f91f0-1469-483d-af56-72f3f4094b93', revision=3, event...0, 0, tzinfo=datetime.timezone.utc), event_sha256='585caf3bced88cc0bae564c6729800f5be8c98580f2098599d2fa1f8ee73af94'),))
+E        +  where () = ProjectionResult(applied_event_ids=(UUID('4b5a53dc-4470-5779-96fd-88811d9e3074'), UUID('bb95d590-9297-5535-af4d-37b95e...ed_revision_ranges=(('company_brands', 'a47f91f0-1469-483d-af56-72f3f4094b93', 1, 3),), errors=(), suppression_epoch=0).errors
+E        +  and   (ProjectedFact(aggregate_type='company_brands', aggregate_id='a47f91f0-1469-483d-af56-72f3f4094b93', revision=3, event...0, 0, tzinfo=datetime.timezone.utc), event_sha256='585caf3bced88cc0bae564c6729800f5be8c98580f2098599d2fa1f8ee73af94'),) = ProjectionResult(applied_event_ids=(UUID('4b5a53dc-4470-5779-96fd-88811d9e3074'), UUID('bb95d590-9297-5535-af4d-37b95e...ed_revision_ranges=(('company_brands', 'a47f91f0-1469-483d-af56-72f3f4094b93', 1, 3),), errors=(), suppression_epoch=0).facts
+
+tests/test_archive_replay_fix1.py:45: AssertionError
+__________ test_baseline_at_floor_still_anchors_only_declared_history __________
+
+    def test_baseline_at_floor_still_anchors_only_declared_history():
+        policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+        result = project(manifest(event(), event(2), event(3, kind="baseline", provenance="current_baseline"), event(4)), policy=policy)
+        assert not result.errors and not result.gaps
+        assert result.coverage[0].status == "complete_from_baseline"
+        assert result.coverage[0].baseline_revision == 3
+        assert not result.coverage[0].complete_history
+        assert result.facts[0].history_complete
+        assert "company_id" in result.facts[0].fields
+>       assert result.retained_revision_ranges == (("jobs", "job-1", 3, 4),)
+E       AssertionError: assert (('jobs', 'job-1', 1, 4),) == (('jobs', 'job-1', 3, 4),)
+E
+E         At index 0 diff: ('jobs', 'job-1', 1, 4) != ('jobs', 'job-1', 3, 4)
+E         Use -v to get more diff
+
+tests/test_archive_replay_fix1.py:61: AssertionError
+_________ test_entirely_below_floor_input_has_truthful_terminal_reason _________
+
+    def test_entirely_below_floor_input_has_truthful_terminal_reason():
+        policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+        result = project(manifest(event(), event(2)), policy=policy)
+>       assert not result.errors and not result.facts and not result.applied_event_ids
+E       AssertionError: assert (not () and not (ProjectedFact(aggregate_type='jobs', aggregate_id='job-1', revision=2, event_id=UUID('57d7310f-1180-5ef5-aeaf-3151bf0...0, 0, tzinfo=datetime.timezone.utc), event_sha256='e88029593a8f67d971b927c9933501fa0b1479e6b8bfa2f00d1878f75fdd02b7'),))
+E        +  where () = ProjectionResult(applied_event_ids=(UUID('05a808bb-f2dc-502a-a1d9-2d428b4aa161'), UUID('57d7310f-1180-5ef5-aeaf-3151bf...omplete_history=False),), gaps=(), retained_revision_ranges=(('jobs', 'job-1', 1, 2),), errors=(), suppression_epoch=0).errors
+E        +  and   (ProjectedFact(aggregate_type='jobs', aggregate_id='job-1', revision=2, event_id=UUID('57d7310f-1180-5ef5-aeaf-3151bf0...0, 0, tzinfo=datetime.timezone.utc), event_sha256='e88029593a8f67d971b927c9933501fa0b1479e6b8bfa2f00d1878f75fdd02b7'),) = ProjectionResult(applied_event_ids=(UUID('05a808bb-f2dc-502a-a1d9-2d428b4aa161'), UUID('57d7310f-1180-5ef5-aeaf-3151bf...omplete_history=False),), gaps=(), retained_revision_ranges=(('jobs', 'job-1', 1, 2),), errors=(), suppression_epoch=0).facts
+
+tests/test_archive_replay_fix1.py:68: AssertionError
+____ test_count_mismatch_rejected_before_membership_or_seal_builder[2-1-1] _____
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705b9cfe30>
+ids = 2, events = 1, declared = 1
+
+    @pytest.mark.parametrize("ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)])
+    def test_count_mismatch_rejected_before_membership_or_seal_builder(monkeypatch, ids, events, declared):
+        item = manifest(*(event(n) for n in range(1, events+1)))
+        ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)]*ids))
+        item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+        def forbidden(*args, **kwargs):
+            pytest.fail("malformed membership reached accepted seal builder")
+        monkeypatch.setattr(replay, "seal_batch", forbidden)
+>       result = project(item)
+                 ^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:88:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = (UUID('00000000-0000-0000-0000-000000000001'), UUID('00000000-0000-0000-0000-000000000001'))
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+____ test_count_mismatch_rejected_before_membership_or_seal_builder[1-2-2] _____
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705b9d64b0>
+ids = 1, events = 2, declared = 2
+
+    @pytest.mark.parametrize("ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)])
+    def test_count_mismatch_rejected_before_membership_or_seal_builder(monkeypatch, ids, events, declared):
+        item = manifest(*(event(n) for n in range(1, events+1)))
+        ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)]*ids))
+        item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+        def forbidden(*args, **kwargs):
+            pytest.fail("malformed membership reached accepted seal builder")
+        monkeypatch.setattr(replay, "seal_batch", forbidden)
+>       result = project(item)
+                 ^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:88:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = (UUID('00000000-0000-0000-0000-000000000001'),)
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+___ test_count_mismatch_rejected_before_membership_or_seal_builder[2001-1-1] ___
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705b95e4e0>
+ids = 2001, events = 1, declared = 1
+
+    @pytest.mark.parametrize("ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)])
+    def test_count_mismatch_rejected_before_membership_or_seal_builder(monkeypatch, ids, events, declared):
+        item = manifest(*(event(n) for n in range(1, events+1)))
+        ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)]*ids))
+        item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+        def forbidden(*args, **kwargs):
+            pytest.fail("malformed membership reached accepted seal builder")
+        monkeypatch.setattr(replay, "seal_batch", forbidden)
+>       result = project(item)
+                 ^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:88:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = (UUID('00000000-0000-0000-0000-000000000001'), UUID('00000000-0000-0000-0000-000000000001'), UUID('00000000-0000-0000-...0-0000-0000-000000000001'), UUID('00000000-0000-0000-0000-000000000001'), UUID('00000000-0000-0000-0000-000000000001'))
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+____ test_count_mismatch_rejected_before_membership_or_seal_builder[0-1-1] _____
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705b942330>
+ids = 0, events = 1, declared = 1
+
+    @pytest.mark.parametrize("ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)])
+    def test_count_mismatch_rejected_before_membership_or_seal_builder(monkeypatch, ids, events, declared):
+        item = manifest(*(event(n) for n in range(1, events+1)))
+        ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)]*ids))
+        item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+        def forbidden(*args, **kwargs):
+            pytest.fail("malformed membership reached accepted seal builder")
+        monkeypatch.setattr(replay, "seal_batch", forbidden)
+>       result = project(item)
+                 ^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:88:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = ()
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+____ test_count_mismatch_rejected_before_membership_or_seal_builder[1-1-2] _____
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705bdf3d40>
+ids = 1, events = 1, declared = 2
+
+    @pytest.mark.parametrize("ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)])
+    def test_count_mismatch_rejected_before_membership_or_seal_builder(monkeypatch, ids, events, declared):
+        item = manifest(*(event(n) for n in range(1, events+1)))
+        ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)]*ids))
+        item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+        def forbidden(*args, **kwargs):
+            pytest.fail("malformed membership reached accepted seal builder")
+        monkeypatch.setattr(replay, "seal_batch", forbidden)
+>       result = project(item)
+                 ^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:88:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = (UUID('00000000-0000-0000-0000-000000000001'),)
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+_______ test_remaining_event_budget_checked_before_membership_traversal ________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f705b9cc7a0>
+
+    def test_remaining_event_budget_checked_before_membership_traversal(monkeypatch):
+        first = manifest(event())
+        second = manifest(event(2), event(3))
+        ref = replace(second.seal.batch, ordered_event_ids=_NoTraversal(second.seal.batch.ordered_event_ids))
+        second = replace(second, seal=replace(second.seal, batch=ref))
+        original = replay.seal_batch
+        calls = []
+        def guarded(ref):
+            assert ref is first.seal.batch, "over-budget descriptor reached seal builder"
+            calls.append(ref.batch_id)
+            return original(ref)
+        monkeypatch.setattr(replay, "seal_batch", guarded)
+>       result = project(first, second, limits=ReplayLimits(max_events=2))
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_archive_replay_fix1.py:105:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_archive_replay.py:68: in project
+    return project_archive(
+job_discovery/archive/replay.py:281: in project_archive
+    or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
+                                                ^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = (UUID('57d7310f-1180-5ef5-aeaf-3151bf024cd2'), UUID('895d39da-1513-5c27-9f4b-c15e65cbdec3'))
+
+    def __iter__(self):
+>       pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+E       Failed: membership traversal preceded cardinality/event-budget rejection
+
+tests/test_archive_replay_fix1.py:77: Failed
+=========================== short test summary info ============================
+FAILED tests/test_archive_replay_fix1.py::test_present_prefix_below_floor_cannot_expand_declared_coverage
+FAILED tests/test_archive_replay_fix1.py::test_present_relationship_prefix_below_floor_cannot_supply_full_fields
+FAILED tests/test_archive_replay_fix1.py::test_baseline_at_floor_still_anchors_only_declared_history
+FAILED tests/test_archive_replay_fix1.py::test_entirely_below_floor_input_has_truthful_terminal_reason
+FAILED tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[2-1-1]
+FAILED tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[1-2-2]
+FAILED tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[2001-1-1]
+FAILED tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[0-1-1]
+FAILED tests/test_archive_replay_fix1.py::test_count_mismatch_rejected_before_membership_or_seal_builder[1-1-2]
+FAILED tests/test_archive_replay_fix1.py::test_remaining_event_budget_checked_before_membership_traversal
+10 failed in 0.73s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/versions.txt
new file mode 100644
index 0000000..2a5cef1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/versions.txt
@@ -0,0 +1,5 @@
+3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
+pytest 9.1.1
+ruff 0.15.20
+psycopg 3.3.6
+No PostgreSQL server/DB verification: pure reader fix only.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-report.md
new file mode 100644
index 0000000..d323631
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-report.md
@@ -0,0 +1,47 @@
+# Task12 Fix1 — declared coverage and early membership bounds
+
+Status: both original Important findings corrected and focused ordinary verification passed. Same-reviewer reassessment of R12-1/R12-2 and fix-introduced Important/Critical issues remains pending. No independent acceptance or security approval is inferred.
+
+FixBASE: `5ac3beebffcc2d37eb506610015e40ce5f3c7b99`; actual starting HEAD `7291e2b` contained controller documentation only since that pin. Original source `a6dd9193076dad21017bf53b49965c7df168452d`. Fix1 source: **`ecba747343369c26041ef5655ed56b044d7098a0`**. Sole original author; no helpers, subagents or reviewers spawned. Only replay.py and new test_archive_replay_fix1.py are in the source commit.
+
+## R12-1 correction
+
+The review correctly identified that the old floor check ran only after a predecessor lookup failed. Present older events could therefore expand declared coverage. Input classification now excludes every revision below that scope's declared floor before insertion into the retained map. Those IDs remain ignored, cannot appear in applied IDs or retained ranges, cannot supply a baseline or prefix-dependent fields, and retain explicit `outside_declared_coverage` gap provenance. Existing exact-byte/conflict validation still applies to input copies; the floor does not allow conflicting archives to evade validation.
+
+Whole-scope suppression retains first precedence; outside-declared-coverage follows, then archive expiry. Since all retained candidates satisfy the floor, a predecessor walk cannot accept a present below-floor baseline. A baseline at the floor remains usable and anchors only its stated history. A per-scope set of known exclusion reasons also replaces the old hardcoded `expired` reason when nothing remains eligible: entirely outside-coverage input is reported truthfully. Multiple known exclusion reasons can be reported without inventing one cause or rescanning the full event map for every scope.
+
+Four new ordinary fixtures verify present eligible baseline1 plus contiguous revisions2/3 under floor3; the same case for a public relationship with no independent facts; a usable baseline3 and revision4 with earlier1/2 excluded; and a scope whose inputs are all below floor. Assertions cover terminal reason, incomplete provenance, independent-only fields, unavailable relationship facts, retained ranges, applied/ignored IDs and no invented complete posting history.
+
+## R12-2 correction
+
+Before any membership ID traversal or call to the unchanged accepted seal builder, the reader now verifies both descriptor containers are tuples, obtains cardinalities with the built-in O(1) `tuple.__len__`, enforces1..2,000 members, requires exact equality with event-byte count and strict integer declared event_count, and checks cumulative remaining max_events. Only then does the existing member-type/envelope/byte/seal validation proceed. The former late duplicate event-count check was removed. Invalid count descriptors return sanitized `invalid_membership_count` with no facts; an exhausted remaining event budget returns `event_limit` with no facts. Accepted codec/seal interfaces and implementations are unchanged.
+
+Five small malformed descriptor fixtures use ID/event/declared counts2/1/1,1/2/2,2001/1/1,0/1/1 and1/1/2. A tuple subclass fails if its iterator is invoked, and a guard fails if rejected input reaches seal reconstruction. GREEN therefore establishes rejection order, not merely eventual rejection. A sixth fixture first accepts one ordinary event, then rejects a two-event descriptor when only one event remains in the run budget, before traversing that descriptor or rebuilding its seal. The largest descriptor contains2,001 UUID references; no large allocation, stress, timing/resource experiment, DB or old capacity probe was used.
+
+## Actual evidence and phases
+
+`task-12-fix1-evidence/inventory.md` was written before execution and names every new fixture and directly affected existing node. The first run failed collection because the new test used an incorrect unqualified helper import; it was corrected to `tests.test_archive_replay`. No product change occurred before intended RED. The corrected RED executed all10 new cases against the original reader and all10 failed as expected: four coverage/range/fact failures and six membership-before-bound guard failures. The only subsequent fixture edit was Ruff formatting. All failures and exits are retained, including the initial fixture import error.
+
+| Phase | Exact scope | Actual result |
+| --- | --- | --- |
+| Initial fixture setup |new Fix1 test file|1 collection error,0.26s,exit2|
+| Intended RED |10 new Fix1 cases|10 failed,0.73s,exit1|
+| Final GREEN |10 new +10 directly affected existing cases|**20 passed,0.19s,exit0; no skips/deselections**|
+
+Final exact command:
+
+```text
+.venv/bin/python -m pytest tests/test_archive_replay_fix1.py tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times tests/test_archive_replay.py::test_finite_input_budgets_fail_closed tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer -q
+```
+
+The existing nodes specifically cover absent-prefix unknown/coverage/expiry reasons, all-expired empty-retained handling, bounded valid membership and duplicates, finite input budgets, and strict manifest serializer types in the changed validation path. No whole original44/48 run, codec file, unaffected feature flow, DB suite, activation suite or omitted security test ran. Collection of this exact20-case selection is retained separately; it did not execute tests.
+
+Python3.12.14, pytest9.1.1, Ruff0.15.20, psycopg3.3.6. Ruff and staged source whitespace checks pass. Eight final hashes were captured before GREEN and verified unchanged afterward: reader, new tests, unchanged original tests/schema/types/seal/codec/dependency manifest. No source changed during or after GREEN; source commit is the tested content. RED was executed against the original pinned reader; no separate pre-RED hash file was captured. Exact raw test outputs are preserved as deterministic gzip, and readable copies normalize trailing whitespace only. Full commands, exit files, collection, hashes and versions are in the evidence directory.
+
+## Integration scope and remaining limits
+
+The change is limited to new pure reader eligibility/diagnostics and validation order. Result constructors, policy/limit contracts, permanent whole-scope suppression and snapshot-provenance-only epoch remain as approved. No accepted producer, codec/seal, S3/export, DB/schema/migration, RLS/identity/private FK, current-state writer, reviewer/model/pricing setting, runtime invocation or dependency changes. No DB behavior changed, so no PostgreSQL17/16 rerun was needed or attributed to this fix. Current-PG bootstrap remains explicitly unimplemented.
+
+Original integration limits remain: a future trusted adapter must establish authorized archive access, current time and a complete fresh service-owned suppression snapshot; the admin policy boolean is not external authentication. Output consumers must discard/recompute on retention/suppression changes. The deadline is cooperative for bounded work and assumes a local nonblocking iterator, not a process sandbox. No real archive/cloud/provider/S3/production access, configuration, credential/IAM work, deletion, activation, push/PR/merge/deploy or release action occurred. Flags stay default off, retirement dry-run, archive inactive pending approved destination/readiness. Task3 expiry/physical-capacity/cross-user/adversarial reviews/probes remain deliberately omitted; no substitute review or probe occurred.
+
+No safeguard rejection occurred. The corrected fixture import failure was an ordinary local test setup error. Controller owns same-reviewer reassessment, remaining tasks/final review and release. Original verdicts remain CHANGES REQUIRED until that reassessment; this report claims implementation plus focused author verification only.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-requirements-review.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-requirements-review.md
new file mode 100644
index 0000000..febc81a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-requirements-review.md
@@ -0,0 +1,77 @@
+# Task 12 independent permitted requirements and code-quality review
+
+Requirements verdict: **CHANGES REQUIRED**.
+
+Code-quality verdict: **CHANGES REQUIRED**.
+
+Two Important findings below prevent acceptance. No Critical or separate Minor findings. These are ordinary correctness/bounded-reader findings in the NEW optional archive projector; this is not an independent security verdict or an old-mechanism review.
+
+## Exact review pins and authority
+
+- BASE: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`.
+- Reviewed HEAD/report: `5ac3beebffcc2d37eb506610015e40ce5f3c7b99`.
+- Source commit: `a6dd9193076dad21017bf53b49965c7df168452d`.
+- Package: `task-12-review-package.md`, all 1,546 lines, full BASE..HEAD.
+- During review the working HEAD was `80f61fdb7ae8972778429c96ff5c7b0d5083e8a3`; read-only diff inspection showed only controller documentation/package/dispatch additions after reviewed HEAD. Product review remains pinned above.
+
+Read the reviewer dispatch first, Task 12 brief, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, full author report and review package, CURRENT/rulings Task 12 compatibility ruling, relevant binding specification archive contracts/replay/retention sections, all changed product/test source, and the recorded ordinary evidence. The accepted codec/seal definitions were read to assess the new reader's calls and compatibility. A narrow producer-envelope/baseline lookup supplied integration context only; no old enforcement assurance follows.
+
+Compatible defaulted ProjectionResult metadata appended after its original two fields is authorized. Permanent whole-aggregate suppression remains authoritative across all revisions/object versions; the snapshot epoch supplies provenance only. Neither choice is a finding. Release authorization does not expand this review into production operations or the expressly omitted Task 3 reviews.
+
+## Important R12-1 — present input can override declared coverage
+
+Location: `job_discovery/archive/replay.py:340`, `:415`, `:425`, `:446`; existing test at `tests/test_archive_replay.py:289`.
+
+The coverage floor is consulted only inside `if candidate is None`. Input retention excludes removed/expired events but does not exclude revisions below `coverage_starts`. Consequently, with the ordinary existing fixture shapes, declare `coverage_starts=(("jobs", "job-1", 3),)` and supply eligible baseline revision 1 plus revisions 2 and 3. Source tracing shows all three retained, traversal reaches baseline 1, and the result reports `complete_from_baseline`, `baseline_revision=1`, and a fact with `history_complete=True` and full body fields such as `company_id` and `closed_at`. There is no terminal outside-coverage gap. This outcome is determined directly from the code; I did not execute it.
+
+The binding replay contract requires a terminal incomplete result when the needed baseline/predecessor is outside declared coverage, with only independent facts from later eligible events. A physically available older object must not silently expand the policy's declared coverage. The current test omits revisions 1 and 2, so it exercises only an absent predecessor and cannot detect this case.
+
+Required correction: apply the declared coverage floor to input eligibility and/or traversal before accepting a present candidate or baseline; keep coverage, ranges, applied IDs and gap provenance consistent with that policy. A later baseline at or above the floor can still anchor its explicitly declared coverage, and pre-activation history must remain unknown.
+
+Necessary narrow evidence: ordinary offline fixtures for a present below-floor baseline with a contiguous later chain, a relationship whose full fields must remain unavailable in that case, and an at-floor baseline that remains usable. Verify terminal `outside_declared_coverage`, incomplete provenance, independent-only eligible fields and no falsely retained below-floor range. No database, provider, old enforcement suite or broad rerun is needed.
+
+## Important R12-2 — membership tuple traversal precedes any cardinality bound
+
+Location: `job_discovery/archive/replay.py:280`–`:281`, `:303`–`:327`; unchanged callee `job_discovery/archive/batches.py:225`–`:229`.
+
+The total reader iterates every `ref.ordered_event_ids` entry with `any(...)` before checking the bounded member-event tuple or any event/byte budget. It verifies only that the ID container is a tuple, without an O(1) length cap or equality check against the bounded event bytes. A malformed membership descriptor containing N valid UUID entries alongside one ordinary event therefore causes an N-entry scan; `max_events` still charges just one event, and the serialized byte budget does not account for those excess descriptor entries. If the ordinary bytes fit, reconstruction subsequently materializes another N-entry tuple of UUID strings in `seal_batch` before detecting membership mismatch. N has no reader-enforced limit and no deadline check occurs within either traversal.
+
+This is a bounded-input validation defect even though the final result eventually rejects the malformed seal. The stated cooperative deadline exception is for already bounded CPU units; here the unit itself is not bounded by ReplayLimits or the 2,000-event seal cap. Valid accepted seals naturally have bounded membership, but a total reader must establish that invariant before iterating an input descriptor it is validating. This finding is static inspection of the new parser's ordinary count-validation ordering, not a resource-stress execution or an old physical-capacity probe.
+
+Required correction: validate tuple types and O(1) cardinalities, the per-seal cap, membership/event-count agreement, and applicable remaining event budget before iterating membership IDs or invoking the accepted seal builder. Preserve existing codec/seal interfaces.
+
+Necessary narrow evidence: small ordinary mismatched-count descriptors plus a 2,001-ID descriptor are enough; establish early rejection before codec reconstruction/type traversal as appropriate, with sanitized error/no facts. Do not allocate huge inputs or run timing/resource/adversarial experiments. Focused new unit cases and relevant directly affected reader cases suffice.
+
+## Evidence read and requirements assessment
+
+Recorded final command was `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`: **48 passed in 1.11s**, exit 0, no skips/deselections. Collection lists 44 replay cases and four codec cases. I read the actual saved outputs, including decompressed raw gzip outputs; no pytest, collection, Ruff or other author-covered verification command was rerun.
+
+Recorded chronology: missing-module RED (exit 2); first 36-pass development run; serializer boolean RED (1 failed/42 passed, exit 1); two 47-pass runs; two elapsed-UTC RED outputs with the fixture clarification preserved; final 48-pass GREEN. Ruff output is `All checks passed!`. Versions are Python 3.12.14, pytest 9.1.1, Ruff 0.15.20, psycopg 3.3.6. Commands, inventory, collection, exits, versions, all eight source/dependency digests and the saved eight-OK hash verification were read. The controller separately confirmed those eight hashes against current files; this reviewer does not relabel that controller action as a new independent test execution.
+
+| Requirement | Permitted review assessment |
+| --- | --- |
+| Pure optional admin projection; no app restore or side effects | Implemented as an in-memory internal API. Imports/call path and recorded socket/DB/subprocess guards plus application/provider call tracing support ordinary purity. No runtime adapter or authenticated endpoint is supplied. |
+| Finite events/bytes/deadline/depth | Limits, byte accounting, JSON-depth scan and bounded predecessor/suppression walks are present. Membership cardinality ordering remains incomplete under R12-2. Cooperative deadline and local nonblocking iterable limits are honestly documented. |
+| Total envelope/schema interpretation and seal compatibility | Exact envelope/schema/revision/identity/predecessor checks, canonical JSON, fixed diagnostics and accepted seal reconstruction are present. Existing codec/seal functions are unchanged. R12-2 concerns work performed before malformed membership rejection. |
+| ID/hash deduplication, conflicts and stale ordering | All copies are inspected for conflicts; exact duplicates deduplicate; latest retained per-aggregate revision wins. Recorded ordinary tests support these behaviors. Eligible reseals may extend the same event's retained eligibility; this reader grants no reseal authorization. |
+| Missing prefix, explicit incomplete provenance and terminal gaps | Finite walks, known/unknown gap reasons, exact disjoint revision ranges and independent-fact allowlist are implemented. R12-1 prevents full approval of outside-declared-coverage behavior. |
+| Archive eligibility and projection retention | Elapsed UTC 730-day seal validation, expired-copy exclusion, earliest prefix-dependency expiry and recomputation behavior are implemented and represented in recorded tests. This concerns archive retention only. |
+| Suppression and current/noncurrent objects | Supplied whole-scope markers dominate all copies and later snapshot labels; direct endpoint dependency suppression is conservative and bounded. In-memory fixtures match the approved pure snapshot contract. No DB marker mechanism changed. |
+| Public-only facts, corrections and no graph inference | Existing public validator is reused; independent fields exclude prefix-dependent relationships/lifespan. Explicit assertion status replacement/retraction is covered. No automatic merge, traversal product or graph engine was added. |
+| Interface compatibility and scope | Existing result positional fields remain first; added fields default. No codec/seal/export/S3/migration/runtime entrypoint modifications appear in the pinned diff. |
+
+## Implemented, tested, independently reviewed and deliberately unreviewed limits
+
+Implemented: the pure Task 12 projection module, replay-local policy/limits/input wrapper, additive output records/defaults, independent-fact fields, and ordinary offline tests. R12-1/R12-2 remain implementation gaps.
+
+Tested by author: the recorded 48 selected offline cases and stated development RED/GREEN sequence. Neither finding has a reviewer execution result; both have explicit source-based reasoning and narrowly requested author evidence. No new tests were executed here.
+
+Independently reviewed here: only new Task 12 ordinary feature requirements, input/output interpretation, bounded parsing structure, maintainability/compatibility and supplied evidence. The source is generally focused and preserves accepted shared interfaces, but coverage eligibility and validation ordering require correction before either verdict can pass.
+
+Deliberately unreviewed: Task 3 independent lease-expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial review/probes. No retry, reproduction, substitute reviewer/tool/probe or old mechanism assurance was attempted. No database, cloud, S3, IAM, provider, production, paid, deployment, activation, removal or release action occurred. No source/test edits, helper agents, Git mutation or author-covered test reruns occurred; the sole write is this requested review report.
+
+Integration limits remain explicit: a future trusted adapter must establish approved archive access, current time and a complete fresh service-owned suppression snapshot; the Boolean policy field is not external authentication. Consumers must discard/recompute output at eligibility/snapshot changes. Optional current-PG bootstrap, marker fetching, object loading, persisted projection serving, removal/provisioning and production use are absent. Synthetic sealed inputs cannot establish production readiness or any omitted security verdict.
+
+Next step: same author corrects R12-1/R12-2 and records focused ordinary evidence, then this same reviewer assesses those findings and fix-introduced Important/Critical issues only. No whole-task or old-suite rerun is requested.
+
+DONE — requirements CHANGES REQUIRED; code quality CHANGES REQUIRED — STOP.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-review-package.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-review-package.md
new file mode 100644
index 0000000..8dc52b9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-review-package.md
@@ -0,0 +1,1546 @@
+# Full pinned review package
+
+BASE: 0f87454e965f3ef8d06b18ce93d23ea621d53b6f
+
+HEAD: 5ac3beebffcc2d37eb506610015e40ce5f3c7b99
+
+## Commits
+
+5ac3beebffcc2d37eb506610015e40ce5f3c7b99 docs: record Task12 projection verification and limits
+a6dd9193076dad21017bf53b49965c7df168452d feat: project public archive with terminal retention gaps
+
+
+## Files
+
+ .../task-12-evidence/collection.txt                |  50 ++
+ .../task-12-evidence/commands.md                   |  21 +
+ .../task-12-evidence/dev1.exit                     |   1 +
+ .../task-12-evidence/dev1.raw.txt.gz               | Bin 0 -> 52 bytes
+ .../task-12-evidence/dev1.txt                      |   2 +
+ .../task-12-evidence/dev2.exit                     |   1 +
+ .../task-12-evidence/dev2.raw.txt.gz               | Bin 0 -> 633 bytes
+ .../task-12-evidence/dev2.txt                      |  23 +
+ .../task-12-evidence/dev3.exit                     |   1 +
+ .../task-12-evidence/dev3.raw.txt.gz               | Bin 0 -> 52 bytes
+ .../task-12-evidence/dev3.txt                      |   2 +
+ .../task-12-evidence/dev4.exit                     |   1 +
+ .../task-12-evidence/dev4.raw.txt.gz               | Bin 0 -> 52 bytes
+ .../task-12-evidence/dev4.txt                      |   2 +
+ .../task-12-evidence/final-before.sha256           |   8 +
+ .../task-12-evidence/final-hash-verification.txt   |   8 +
+ .../task-12-evidence/green.exit                    |   1 +
+ .../task-12-evidence/green.raw.txt.gz              | Bin 0 -> 52 bytes
+ .../task-12-evidence/green.txt                     |   2 +
+ .../task-12-evidence/inventory.md                  |  12 +
+ .../task-12-evidence/red.exit                      |   1 +
+ .../task-12-evidence/red.raw.txt.gz                | Bin 0 -> 447 bytes
+ .../task-12-evidence/red.txt                       |  16 +
+ .../task-12-evidence/ruff.txt                      |   1 +
+ .../task-12-evidence/utc-red.exit                  |   1 +
+ .../task-12-evidence/utc-red.raw.txt.gz            | Bin 0 -> 515 bytes
+ .../task-12-evidence/utc-red.txt                   |  23 +
+ .../task-12-evidence/utc-red2.exit                 |   1 +
+ .../task-12-evidence/utc-red2.raw.txt.gz           | Bin 0 -> 514 bytes
+ .../task-12-evidence/utc-red2.txt                  |  23 +
+ .../task-12-evidence/versions.txt                  |   5 +
+ .../task-12-report.md                              |  83 ++++
+ job_discovery/archive/replay.py                    | 501 +++++++++++++++++++++
+ job_discovery/archive/schema.py                    |  17 +
+ job_discovery/archive/types.py                     |  41 ++
+ tests/test_archive_replay.py                       | 421 +++++++++++++++++
+ 36 files changed, 1269 insertions(+)
+
+
+## Complete diff
+
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt
+new file mode 100644
+index 0000000..27c55da
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/collection.txt
+@@ -0,0 +1,50 @@
++tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times
++tests/test_archive_replay.py::test_conflicting_exact_id_fails_closed_even_after_good_fact
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes0]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes1]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes2]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes3]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes4]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes5]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes6]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes7]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes8]
++tests/test_archive_replay.py::test_total_envelope_unknown_schema_and_invalid_fields_fail_closed[changes9]
++tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only
++tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries
++tests/test_archive_replay.py::test_later_baseline_does_not_invent_earlier_history
++tests/test_archive_replay.py::test_authorized_suppression_dominates_current_noncurrent_and_later_epochs
++tests/test_archive_replay.py::test_suppressed_endpoint_invalidates_dependent_facts
++tests/test_archive_replay.py::test_expired_duplicate_does_not_invalidate_eligible_authorized_reseal
++tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon
++tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[canonical_data]
++tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[compressed_data]
++tests/test_archive_replay.py::test_tampered_seal_bytes_fail_closed[manifest_data]
++tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits0]
++tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits1]
++tests/test_archive_replay.py::test_finite_input_budgets_fail_closed[limits2]
++tests/test_archive_replay.py::test_deadline_fails_closed
++tests/test_archive_replay.py::test_depth_limits_json_and_predecessor_walk
++tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs0]
++tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs1]
++tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs2]
++tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs3]
++tests/test_archive_replay.py::test_invalid_limits_rejected[kwargs4]
++tests/test_archive_replay.py::test_explicit_admin_policy_and_aware_time_required
++tests/test_archive_replay.py::test_pure_projection_has_zero_application_or_external_calls
++tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal
++tests/test_archive_replay.py::test_missing_prefix_cannot_project_relationship_or_lifespan
++tests/test_archive_replay.py::test_prefix_dependent_fact_expires_with_earliest_baseline
++tests/test_archive_replay.py::test_predecessor_walk_stops_at_depth_with_normal_json
++tests/test_archive_replay.py::test_disjoint_retained_ranges_never_claim_missing_revisions
++tests/test_archive_replay.py::test_complete_relation_assertion_retracts_without_identity_inference
++tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True]
++tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-2]
++tests/test_archive_replay.py::test_invalid_iterable_member_returns_sanitized_error
++tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
++tests/test_archive_codec.py::test_canonical_utf8_sorted_jsonl_and_zero_time_gzip
++tests/test_archive_codec.py::test_total_public_schema_rejects_private_or_oversize_data
++tests/test_archive_codec.py::test_schema_enforces_complete_relation_endpoints_and_version_identity
++tests/test_archive_codec.py::test_body_is_bounded_and_gzip_single_event_boundary
++
++48 tests collected in 0.10s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md
+new file mode 100644
+index 0000000..ec74881
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/commands.md
+@@ -0,0 +1,21 @@
++# Exact verification commands and outputs
++
++Working directory: /workspace/job-board/.claude/worktrees/lifecycle-recovery. Shell /bin/bash, login:false. Commands below used .venv/bin/python explicitly. Each pytest stdout/stderr was redirected to its named .txt and `$?` written to its matching .exit. Readable outputs normalize trailing whitespace only; deterministic .raw.txt.gz preserves each exact original output.
++
++- red.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
++- dev1.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
++- dev2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
++- dev3.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
++- dev4.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
++- utc-red.txt and utc-red2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days -q`
++- green.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
++- collection.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py --collect-only -q`
++- formatting before GREEN: `.venv/bin/python -m ruff format job_discovery/archive/replay.py tests/test_archive_replay.py`
++- ruff.txt: `.venv/bin/python -m ruff check job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`
++- final-before.sha256: `sha256sum job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py job_discovery/archive/batches.py job_discovery/archive/codec.py job_discovery/archive/s3.py pyproject.toml`
++- final-hash-verification.txt: `sha256sum -c .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256`
++- versions.txt: `.venv/bin/python` printing sys.version and importlib.metadata.version for pytest, ruff, psycopg; explicitly records no PostgreSQL run.
++- source whitespace: `git diff --cached --check` after staging exactly the four owned files; exit0/no output.
++- upstream: `git ls-remote origin refs/heads/main` -> a8c4b82d95b35c0259600c19c1506faae807c3fc; `git merge-base --is-ancestor a8c4b82d95b35c0259600c19c1506faae807c3fc HEAD` -> exit0.
++
++Source forward commit: `git add job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`; `git commit -m "feat: project public archive with terminal retention gaps"` -> a6dd9193076dad21017bf53b49965c7df168452d. No source changes after final GREEN. Report/evidence have a separate forward documentation commit.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz
+new file mode 100644
+index 0000000..2be75c1
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt
+new file mode 100644
+index 0000000..640eb92
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev1.txt
+@@ -0,0 +1,2 @@
++....................................                                     [100%]
++36 passed in 0.19s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit
+new file mode 100644
+index 0000000..d00491f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.exit
+@@ -0,0 +1 @@
++1
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz
+new file mode 100644
+index 0000000..7336726
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt
+new file mode 100644
+index 0000000..b1b5723
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev2.txt
+@@ -0,0 +1,23 @@
++........................................F..                              [100%]
++=================================== FAILURES ===================================
++_ test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True] _
++
++field = 'serializer_version', value = True
++
++    @pytest.mark.parametrize("field,value", [("serializer_version", True), ("serializer_version", 2)])
++    def test_total_manifest_rejects_unknown_or_boolean_serializer(field, value):
++        item = manifest(event())
++        # A total reader also rejects the boolean/1 equality ambiguity.
++        ref = replace(item.seal.batch, **{field: value})
++        seal = replace(item.seal, batch=ref)
++        if value is True:
++            seal = seal_batch(ref)
++        result = project(replace(item, seal=seal))
++>       assert result.errors and not result.facts
++E       AssertionError: assert (())
++E        +  where () = ProjectionResult(applied_event_ids=(UUID('05a808bb-f2dc-502a-a1d9-2d428b4aa161'),), ignored_event_ids=(), facts=(Proje...omplete_history=False),), gaps=(), retained_revision_ranges=(('jobs', 'job-1', 1, 1),), errors=(), suppression_epoch=0).errors
++
++tests/test_archive_replay.py:258: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer[serializer_version-True]
++1 failed, 42 passed in 0.35s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz
+new file mode 100644
+index 0000000..1a59847
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt
+new file mode 100644
+index 0000000..aa61483
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev3.txt
+@@ -0,0 +1,2 @@
++...............................................                          [100%]
++47 passed in 0.26s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz
+new file mode 100644
+index 0000000..c8dedd3
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt
+new file mode 100644
+index 0000000..300e10f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/dev4.txt
+@@ -0,0 +1,2 @@
++...............................................                          [100%]
++47 passed in 0.23s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256
+new file mode 100644
+index 0000000..1152643
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256
+@@ -0,0 +1,8 @@
++0d6e3998760a5b6e05f49186c42c71fe8388afe7b7f9c8ea1fd83aa8317355be  job_discovery/archive/replay.py
++1d5e19a3bd937b51f34f16fcd56a1354d46c34c13370c2f69517ac19f2dd5ff5  job_discovery/archive/schema.py
++3bb96646d2e9225a9b65a821af7612c69d2a118b13738e180c97c71171862330  job_discovery/archive/types.py
++629b2518a264c2daacd6788148d5cd74a0bf44bce8c5d7696aa61dc68a794ba7  tests/test_archive_replay.py
++ec3b17f1cf76526ff22adcaf21648719ac6901479785e4cd4162a8d69dfd45d6  job_discovery/archive/batches.py
++4c9075ec074c2b8896a8c575ee61f4cf1401bfb0e0335dc9e69ad0218403230b  job_discovery/archive/codec.py
++24fa2a2fd6ea996208fb60c8ded22fed701f6c2c7862657235aa62431a295233  job_discovery/archive/s3.py
++e7396bb84fdd2f4bb67e3dbcd7a4576e1350e1573c6409de323125b3efe90459  pyproject.toml
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt
+new file mode 100644
+index 0000000..6d300f8
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-hash-verification.txt
+@@ -0,0 +1,8 @@
++job_discovery/archive/replay.py: OK
++job_discovery/archive/schema.py: OK
++job_discovery/archive/types.py: OK
++tests/test_archive_replay.py: OK
++job_discovery/archive/batches.py: OK
++job_discovery/archive/codec.py: OK
++job_discovery/archive/s3.py: OK
++pyproject.toml: OK
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit
+new file mode 100644
+index 0000000..573541a
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.exit
+@@ -0,0 +1 @@
++0
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz
+new file mode 100644
+index 0000000..5a8afb9
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt
+new file mode 100644
+index 0000000..35814cb
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/green.txt
+@@ -0,0 +1,2 @@
++................................................                         [100%]
++48 passed in 1.11s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md
+new file mode 100644
+index 0000000..0fb3b93
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/inventory.md
+@@ -0,0 +1,12 @@
++# Pre-execution Task12 inventory
++Only tests/test_archive_replay.py executes in RED and development. Synthetic seal_batch inputs with in-memory fixture suppression snapshots; no DB fixture, SDK, network, providers, file deletion, activation or old security suites. Exact ordinary contents before execution: ID/hash duplicate and conflict; shuffled/stale revisions and timestamp provenance; ten malformed/unknown-envelope cases; archive-only 730-day baseline retention gap and independent fields; missing predecessor unknown terminal cause; activation baseline revision5; whole-scope suppression across current/noncurrent copies and snapshot epochs; dependent scope invalidation; expired duplicate versus eligible reseal; whole projection archive horizon; three seal byte corruption cases; three finite budget cases; deterministic deadline; finite JSON/chain depth; five invalid limit cases; explicit trusted admin boundary; external/DB/subprocess call blockers. The only proposed integration regression is tests/test_archive_codec.py (all four ordinary codec/schema tests), read in full before execution. No DB behavior changes expected. No broad pytest. Test-driven skill's broad-suite suggestion is superseded by explicit task/review restrictions.
++
++Intended RED: missing job_discovery.archive.replay import. Command: .venv/bin/python -m pytest tests/test_archive_replay.py -q.
++
++Before implementation: add explicit outside-declared-coverage case and complete typed relationship-with-missing-prefix case proving no edge is projected. Correct malformed aggregate-ID fixture from unhashable list to None so accepted seal constructor can build the synthetic invalid envelope; the projector still rejects it. These cases remain blocked at the same missing-module RED boundary.
++
++Pre-execution extension: earliest-prefix eligibility (then independent-only recomputation); predecessor-depth cap with valid JSON nesting; exact disjoint revision ranges; complete explicit identity assertion changed to retracted without inference; serializer unknown and bool/1 total-type checks; malformed iterable member sanitized error. These are ordinary synthetic projection/interpretation cases, not old expiry/lease or adversarial security work.
++
++Before final verification: strengthen the existing zero-side-effects case with Python call tracing of reviewer/provider/lifecycle/current-state DB module boundaries, in addition to socket/psycopg/subprocess guards. Dashboard-only generation/notification code has no import or process/network bridge in this pure projection. No new external module execution is introduced by tracing.
++
++Final boundary concern before execution: accepted sealing records UTC times, so add a synthetic aware-timezone fixture requiring exactly730 elapsed UTC days, not730 wall-clock days across a DST offset. This examines only the new replay seal-window interpreter, not Task3 claim expiry.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit
+new file mode 100644
+index 0000000..0cfbf08
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.exit
+@@ -0,0 +1 @@
++2
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz
+new file mode 100644
+index 0000000..f83213c
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt
+new file mode 100644
+index 0000000..576469c
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/red.txt
+@@ -0,0 +1,16 @@
++
++==================================== ERRORS ====================================
++________________ ERROR collecting tests/test_archive_replay.py _________________
++ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_replay.py'.
++Hint: make sure your test modules/packages have valid Python names.
++Traceback:
++/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
++    return _bootstrap._gcd_import(name[level:], package, level)
++           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
++tests/test_archive_replay.py:13: in <module>
++    from job_discovery.archive.replay import (
++E   ModuleNotFoundError: No module named 'job_discovery.archive.replay'
++=========================== short test summary info ============================
++ERROR tests/test_archive_replay.py
++!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
++1 error in 0.35s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt
+new file mode 100644
+index 0000000..1f5f344
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/ruff.txt
+@@ -0,0 +1 @@
++All checks passed!
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit
+new file mode 100644
+index 0000000..d00491f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.exit
+@@ -0,0 +1 @@
++1
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz
+new file mode 100644
+index 0000000..8b3a4c3
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt
+new file mode 100644
+index 0000000..059b2c5
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red.txt
+@@ -0,0 +1,23 @@
++F                                                                        [100%]
++=================================== FAILURES ===================================
++_____________ test_retention_window_requires_730_elapsed_utc_days ______________
++
++    def test_retention_window_requires_730_elapsed_utc_days():
++        from zoneinfo import ZoneInfo
++        item = manifest(event())
++        london = ZoneInfo("Europe/London")
++        # The same wall time crosses a DST offset; it is one hour short of730days.
++        start = datetime(2024, 3, 31, 1, 30, tzinfo=london)
++        end = datetime(2026, 3, 31, 1, 30, tzinfo=london)
++        ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
++        result = project(replace(item, seal=seal_batch(ref)))
++>       assert result.errors == ("invalid_seal_window",)
++E       AssertionError: assert () == ('invalid_seal_window',)
++E
++E         Right contains one more item: 'invalid_seal_window'
++E         Use -v to get more diff
++
++tests/test_archive_replay.py:420: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
++1 failed in 0.20s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit
+new file mode 100644
+index 0000000..d00491f
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.exit
+@@ -0,0 +1 @@
++1
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz
+new file mode 100644
+index 0000000..a8252fb
+Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.raw.txt.gz differ
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt
+new file mode 100644
+index 0000000..824026b
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/utc-red2.txt
+@@ -0,0 +1,23 @@
++F                                                                        [100%]
++=================================== FAILURES ===================================
++_____________ test_retention_window_requires_730_elapsed_utc_days ______________
++
++    def test_retention_window_requires_730_elapsed_utc_days():
++        from zoneinfo import ZoneInfo
++        item = manifest(event())
++        london = ZoneInfo("Europe/London")
++        # The same wall time crosses a DST offset; it is one hour short of730days.
++        start = datetime(2024, 3, 31, 0, 30, tzinfo=london)
++        end = datetime(2026, 3, 31, 0, 30, tzinfo=london)
++        ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
++        result = project(replace(item, seal=seal_batch(ref)))
++>       assert result.errors == ("invalid_seal_window",)
++E       AssertionError: assert () == ('invalid_seal_window',)
++E
++E         Right contains one more item: 'invalid_seal_window'
++E         Use -v to get more diff
++
++tests/test_archive_replay.py:420: AssertionError
++=========================== short test summary info ============================
++FAILED tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days
++1 failed in 0.20s
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt
+new file mode 100644
+index 0000000..4d7a53c
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/versions.txt
+@@ -0,0 +1,5 @@
++3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
++pytest 9.1.1
++ruff 0.15.20
++psycopg 3.3.6
++No PostgreSQL server used: pure Python only; no DB behavior change.
+diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md
+new file mode 100644
+index 0000000..817ad89
+--- /dev/null
++++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-report.md
+@@ -0,0 +1,83 @@
++# Task12 author report — bounded optional public archive projection
++
++Status: implemented and locally verified; controller-dispatched independent permitted requirements/code-quality review is pending. This is not security approval, production restoration, archive activation or release readiness.
++
++Base: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`. Source commit: **`a6dd9193076dad21017bf53b49965c7df168452d`**. Accepted Task11 source `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`, report `c91efc6`, review through `7c43e19` and checkpoint `11libfile_c221028586448191a44b35e1b8baee42` were preserved. Sole author; no helpers/subagents/reviewers were spawned.
++
++## Implemented behavior and compatibility ruling
++
++`job_discovery/archive/replay.py` adds `project_archive(manifests, policy, limits) -> ProjectionResult`, a synchronous pure optional admin projection. `Manifest` wraps an in-memory accepted immutable `SealedBatch` and opaque current/noncurrent object-version label. No loader, destination discovery, S3 access, SQL connection, bootstrap or runtime invocation is added. Only synthetic local test projections were executed.
++
++Before editing established interfaces, the author reported that Task10's `ProjectionResult` had only `applied_event_ids` and `ignored_event_ids`, and that Manifest/policy/limits types did not exist. The controller explicitly approved replay-local wrapper/policy/limits and additive defaulted result metadata following the two existing fields. Existing positional constructors remain compatible. Added metadata: facts, coverage, gaps, exact disjoint retained revision ranges, sanitized errors and suppression snapshot epoch. New fact/coverage/gap records remain in accepted archive/types.py. Existing producer/codec/seal/export behavior is unchanged.
++
++The total reader checks exact version1 envelope fields, exact deterministic event identity and predecessor, strict integer revisions/schema/serializer fields, typed allowlisted public bodies, aware occurrence/observation/record times, and accepted public provenance. It validates canonical JSON and reconstructs the complete accepted immutable seal to compare manifest/content/keys/counts/digests/membership. Unknown schema, malformed inputs, content/seal changes, conflicting event hashes or exhausted work budgets fail the whole run closed with no facts; diagnostics contain fixed error codes, never input bodies or URLs. This reuses `seal_batch` without changing accepted batching or serialization.
++
++Exact same-ID/same-hash objects deduplicate, including current/noncurrent copies. A conflicting hash fails closed regardless of ordering. Duplicates, expired objects and rejected input bytes consume the bounded input budget. An eligible explicitly resealed copy can contribute the unchanged event when an older copy has expired; suppression still overrides both. Supersession/reseal authorization itself belongs to accepted Task11; this pure reader does not grant it.
++
++Per-aggregate revisions are interpreted independently of object order and global timestamps. The latest retained event supplies projected fields, so stale arrivals cannot overwrite it. A retained baseline anchors coverage from that revision only, including activation baselines above revision1; `complete_history` is always false because pre-activation history is not established. `history_complete` on a fact means contiguous history **from its declared baseline**, not all posting history. Retained ranges are disjoint and never bridge missing revisions. Output applied IDs represent eligible interpreted events; duplicate/excluded IDs appear in ignored IDs and these can overlap when the same ID has both an excluded/duplicate copy and an eligible contributing copy.
++
++A missing predecessor is considered only within this finite run. The result reports terminal `retention_gap` with known cause `expired`, `removed`, `outside_declared_coverage` or `depth_limit`; absent evidence remains `unknown`. There is no automatic prefix fetch/retry. With an unavailable prefix, only version1 `INDEPENDENT_FACT_FIELDS` in schema.py can contribute: public descriptive identity/metadata fields, no closure/discovery/lifespan fields, foreign endpoints, inferred identity or relationships. Relationship schemas have no independent-field allowance. A complete explicit assertion can retain or retract its stated status and provenance, without inference or transitive merging. No lifespan calculation or inferred/derived relationship engine exists.
++
++Every fact includes source event ID/hash, revision, distinct occurrence/observation/recorded times, public provenance, incomplete-history flag and eligibility boundary. A prefix-dependent fact expires at the earliest seal expiry among its dependencies. Recomputing after that boundary removes expired input and changes remaining later events to independent-only facts. Pure output is not stored or maintained automatically: consumers must discard/recompute at eligibility and suppression snapshot changes. All seal windows require exactly730 elapsed UTC days, not wall-clock arithmetic across daylight-saving offsets.
++
++## Suppression precedence and trusted boundary
++
++The actual accepted service-only `public_archive_suppressions` table contains `(aggregate_type, aggregate_id, suppressed_at, reason)` and has a whole-scope primary key. It has no event epoch column. The controller approved preserving permanent whole-scope precedence across all revisions/timestamps/object versions; no schema or enforcement mechanism changed. `Suppression` fixtures mirror that snapshot. A policy `suppression_epoch` labels the trusted snapshot used; it cannot lift suppression, reinterpret an event epoch or authorize reopening. The reader does not fabricate a persisted epoch mechanism.
++
++Supplied markers win regardless of whether object copies are current/noncurrent, whether events are newer, or whether the snapshot label increases. Explicit endpoint references propagate suppression conservatively, within the depth bound, so dependent facts cannot retain removed endpoints; unfinished suppression closure fails closed. No object deletion/removal command, database marker mutation or lifecycle provisioning exists. Tests use authorized **in-memory** suppression fixtures only; no PostgreSQL tests were needed because no DB behavior changed.
++
++`ProjectionPolicy(admin_authorized=True, as_of=<aware current snapshot>, suppressions=<complete service snapshot>, ...)` is a trusted internal caller contract, not authentication infrastructure. The caller must obtain authorized read access, supply a complete current service-owned suppression snapshot and current time, and enforce output disposal. There is no end-user endpoint or current-PG bootstrap. Historical arbitrary-time access, authentication, marker retrieval, cloud object loading and serving/persisting projections are not implemented. Suppression snapshot freshness cannot be independently proved by a pure function; a future adapter must establish it before calling. This is an explicit integration limit, not a claim that a caller boolean secures external access.
++
++## Exact finite limits
++
++| Limit | Default | Maximum accepted |
++| --- | --- | --- |
++| Event occurrences, including duplicates/expired copies |10,000|100,000|
++| Input byte accounting |64MiB|128MiB|
++| Deadline |30seconds|120seconds|
++| JSON/prefix/suppression depth |64|256|
++| Input manifests |2,000|10,000|
++| Suppression/coverage snapshot entries |bounded tuple|100,000 each|
++
++Byte accounting charges canonical, compressed, manifest and member-event byte representations, including duplicate copies; it is deliberately stricter than expanded-only accounting. Every individual seal retains accepted caps of2,000 events,16MiB compressed,8MiB canonical/expanded and1MiB manifest. Each event envelope is capped at16KiB before JSON parsing; accepted body validation remains8KiB. Positive finite values only; boolean integer ambiguity and NaN/infinity are rejected. JSON nesting is scanned before recursive decoding. Predecessor traversal and suppression propagation terminate at the depth cap. Deadline checks surround bounded CPU units and occur during event/scope walks; the caller-supplied iterable must be local and nonblocking. A cooperative deadline cannot interrupt an arbitrary blocking Python iterator, OS suspension or an already-running bounded codec unit; no hard process sandbox is claimed.
++
++## Actual verification and chronology
++
++Pre-execution ordinary-case inventory is `task-12-evidence/inventory.md`, including subsequent test extensions before each execution. Final source/dependency hashes were recorded **before** final verification and verified unchanged afterward. Full output, exits, collection inventory, versions and commands are retained. No broad pytest or old security/activation suite ran.
++
++| Phase | Exact selection | Result |
++| --- | --- | --- |
++| Initial RED |new replay file|missing replay module,1 collection error,exit2,0.35s|
++| First implementation |new replay file|36 passed,exit0,0.19s|
++| Extended interpretation RED |new replay file|1 failed/42 passed,exit1,0.35s; boolean serializer accepted as integer1|
++| Corrected integration |replay + four codec cases|47 passed,exit0,0.26s|
++| Stronger side-effect assertion |same files|47 passed,exit0,0.23s|
++| UTC arithmetic RED |exact new elapsed-UTC node|1 failed,exit1,0.20s|
++| Corrected valid-local-time UTC RED fixture |same node|1 failed,exit1,0.20s|
++| **Final GREEN** |**44 replay +4 codec cases**|**48 passed,exit0,1.11s; no skips/deselections**|
++
++Final command:
++
++```text
++.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q
++```
++
++The initial malformed aggregate-ID fixture changed from an unhashable list to None so the existing synthetic seal builder could construct the envelope and the new reader could reject it. This happened before the first implementation run. The first UTC RED used01:30 at a DST transition; it was refined to valid00:30 local times and failed identically before correcting production UTC arithmetic. Both outputs are preserved. The admin/time test was renamed to describe its actual assertions; bootstrap absence is an implementation/integration fact, not claimed as a dedicated test.
++
++Final ordinary coverage includes exact-ID/hash duplicates/conflicts; stale/shuffled ordering; malformed/unknown schema/envelope fields; baseline expiry with eligible later event; terminal unknown/outside-coverage gaps; non-reconstructed lifespan/relationship fields; activation baseline revision5; current/noncurrent removed copies; snapshot labels unable to unsuppress; dependent endpoint suppression; eligible reseal after old-copy expiry; projection expiry and earliest-prefix eligibility; seal-byte corruption; finite infinite-iterator input stopping on event/byte/manifest budgets; cooperative deterministic deadline; JSON and predecessor depth; invalid finite limits; explicit admin/time contract; complete identity assertion retraction without inference; exact disjoint revision ranges; strict serializer types; elapsed UTC seal horizon.
++
++The side-effect test installs socket/psycopg/subprocess fail guards and traces Python calls at reviewer, provider, lifecycle and current-state database module boundaries: zero calls during actual projection. Dashboard generation/notification code has no import or process/network bridge. This establishes ordinary pure execution; no production system was contacted to prove a negative. It is not a substitute security test.
++
++Python3.12.14, pytest9.1.1, Ruff0.15.20 and psycopg3.3.6 recorded. Ruff passes for all four owned source/test files. Scoped staged whitespace check passes. No PostgreSQL server ran: existing PG17/16 evidence remains historical Task11 evidence, not re-attributed to Task12. No DB/RLS/claim/capacity behavior changes require a DB rerun here. No source changed after final GREEN and source commit.
++
++## Integration inventory and deliberately omitted work
++
++Owned implementation: new replay.py and test_archive_replay.py; additive result records/default fields in archive/types.py; additive independent-field constant in archive/schema.py. Existing schema validator code is unchanged. Accepted seal/codec/export/S3 modules, migration/schema.sql, dependency registration and runtime entrypoints are unchanged. No dashboard, reviewer/model/pricing settings, identity/private FKs, legacy timestamps or RLS changes. Four controller ledger files remain unstaged and excluded from author commits.
++
++Live read-only `git ls-remote origin refs/heads/main` returned `a8c4b82d95b35c0259600c19c1506faae807c3fc`, matching Task11's accepted upstream; `git merge-base --is-ancestor` verified it is already in the base. The local origin/main cache is stale (`73ce118`); it was not mistaken for live main. No upstream delta needed integration. No fetch/reset/rewrite/push/PR/merge/deploy/activation occurred.
++
++Flags remain default off, retirement dry-run, archive producer/export inactive without approved destination/readiness. No real archive objects, destination coordinates, credentials/IAM/provider/S3/production access, paid/model calls, app DB restore, current-state reopening, automatic merges, graph product or Parquet engine were used/added. No permanent deletion/removal/lifecycle-provisioning command exists. Optional current-PG bootstrap is explicitly unimplemented.
++
++Task3 expiry/physical-capacity/cross-user/adversarial reviews/probes remain deliberately omitted under the amendment. New expiry checks concern only Task12's archive-replay retention horizon, not old claims or physical accounting. No independent security verdict is inferred from these passes. Independent permitted Task12 review, all13 completion, final review and any release remain the controller's responsibility. Combined production resource sizing, approved destination validation and fresh suppression snapshot integration remain prerequisites for future use. Existing Task11/Task3 limitations are not resolved by this pure feature.
++
++No platform safeguard rejection occurred. A skill ancillary-resource read returned `failed to read skill resource`; no bypass or missing task requirement followed. The TDD skill's generic broad-suite recommendation was superseded by explicit task/review-scope restrictions. All implementation was completed within the permitted ordinary offline scope.
+diff --git a/job_discovery/archive/replay.py b/job_discovery/archive/replay.py
+new file mode 100644
+index 0000000..538754b
+--- /dev/null
++++ b/job_discovery/archive/replay.py
+@@ -0,0 +1,501 @@
++"""Optional offline public projection; no I/O, restoration or runtime integration.
++
++The trusted admin caller supplies a complete service-owned suppression snapshot
++and already loaded seals from an approved archive. This module grants no read
++capability. Snapshot epochs label outputs; they can never unsuppress a scope.
++Recompute/discard projections at their eligibility boundary and on suppression
++snapshot changes. Current-PostgreSQL bootstrap is deliberately unimplemented.
++"""
++
++from dataclasses import dataclass
++from datetime import UTC, datetime, timedelta
++import hashlib
++import json
++import math
++import time
++from typing import Iterable
++from uuid import UUID
++
++from .batches import seal_batch
++from .codec import MAX_COMPRESSED, MAX_EXPANDED, MAX_MANIFEST, canonical_json
++from .schema import (
++    AggregateType,
++    ChangeKind,
++    PublicChange,
++    INDEPENDENT_FACT_FIELDS,
++    event_id,
++    validate_change,
++)
++from .types import (
++    SealedBatch,
++    ProjectionResult,
++    ProjectedFact,
++    ProjectionCoverage,
++    ProjectionGap,
++)
++
++
++@dataclass(frozen=True)
++class Manifest:
++    """In-memory exact persisted seal plus an opaque current/noncurrent label."""
++
++    seal: SealedBatch
++    object_version: str = "current"
++
++
++@dataclass(frozen=True)
++class ReplayLimits:
++    max_events: int = 10000
++    max_bytes: int = 64 * 1024**2
++    deadline_seconds: float = 30
++    max_depth: int = 64
++    max_manifests: int = 2000
++
++    def __post_init__(self):
++        for value, maximum in (
++            (self.max_events, 100000),
++            (self.max_bytes, 128 * 1024**2),
++            (self.max_depth, 256),
++            (self.max_manifests, 10000),
++        ):
++            if type(value) is not int or not 1 <= value <= maximum:
++                raise ValueError("invalid finite replay limits")
++        if (
++            type(self.deadline_seconds) not in {int, float}
++            or not math.isfinite(self.deadline_seconds)
++            or not 0 < self.deadline_seconds <= 120
++        ):
++            raise ValueError("invalid finite replay deadline")
++
++
++def _aware(value):
++    return (
++        isinstance(value, datetime)
++        and value.tzinfo is not None
++        and value.utcoffset() is not None
++    )
++
++
++def _scope(kind, identity):
++    if (
++        not isinstance(kind, str)
++        or kind not in AggregateType
++        or not isinstance(identity, str)
++        or not 1 <= len(identity.encode()) <= 2048
++    ):
++        raise ValueError("invalid projection scope")
++
++
++@dataclass(frozen=True)
++class Suppression:
++    """Trusted service snapshot of public_archive_suppressions; never a grant."""
++
++    aggregate_type: str
++    aggregate_id: str
++    suppressed_at: datetime
++    reason: str
++
++    def __post_init__(self):
++        _scope(self.aggregate_type, self.aggregate_id)
++        if (
++            not _aware(self.suppressed_at)
++            or not isinstance(self.reason, str)
++            or not 1 <= len(self.reason) <= 256
++        ):
++            raise ValueError("invalid suppression snapshot")
++
++
++@dataclass(frozen=True)
++class ProjectionPolicy:
++    admin_authorized: bool
++    as_of: datetime
++    suppressions: tuple[Suppression, ...] = ()
++    suppression_epoch: int = 0
++    coverage_starts: tuple[tuple[str, str, int], ...] = ()
++
++    def __post_init__(self):
++        if self.admin_authorized is not True or not _aware(self.as_of):
++            raise ValueError(
++                "explicit admin authorization and aware projection time required"
++            )
++        if type(self.suppression_epoch) is not int or self.suppression_epoch < 0:
++            raise ValueError("invalid suppression snapshot epoch")
++        if (
++            not isinstance(self.suppressions, tuple)
++            or len(self.suppressions) > 100000
++            or not all(isinstance(s, Suppression) for s in self.suppressions)
++        ):
++            raise ValueError("bounded suppression snapshot required")
++        if (
++            not isinstance(self.coverage_starts, tuple)
++            or len(self.coverage_starts) > 100000
++        ):
++            raise ValueError("bounded coverage declaration required")
++        seen = set()
++        for entry in self.coverage_starts:
++            if not isinstance(entry, tuple) or len(entry) != 3:
++                raise ValueError("invalid coverage declaration")
++            kind, identity, first = entry
++            _scope(kind, identity)
++            if type(first) is not int or first < 1 or (kind, identity) in seen:
++                raise ValueError("invalid coverage declaration")
++            seen.add((kind, identity))
++
++
++class _Invalid(ValueError):
++    pass
++
++
++def _json(raw, depth):
++    """Bound JSON nesting before the recursive standard decoder sees input."""
++    level, quoted, escaped = 0, False, False
++    for byte in raw:
++        if quoted:
++            if escaped:
++                escaped = False
++            elif byte == 92:
++                escaped = True
++            elif byte == 34:
++                quoted = False
++        elif byte == 34:
++            quoted = True
++        elif byte in (91, 123):
++            level += 1
++            if level > depth:
++                raise _Invalid("depth_limit")
++        elif byte in (93, 125):
++            level -= 1
++    value = json.loads(raw)
++    if canonical_json(value) != raw:
++        raise _Invalid("noncanonical_json")
++    return value
++
++
++_FIELDS = frozenset(
++    "event_id aggregate_type aggregate_id revision predecessor_id kind body occurred_at observed_at recorded_at provenance schema_version".split()
++)
++
++
++def _event(raw, depth):
++    value = _json(raw, depth)
++    if not isinstance(value, dict) or set(value) != _FIELDS:
++        raise _Invalid("invalid_envelope")
++    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
++        raise _Invalid("unknown_schema")
++    _scope(value["aggregate_type"], value["aggregate_id"])
++    revision = value["revision"]
++    if type(revision) is not int or not 1 <= revision <= 9223372036854775807:
++        raise _Invalid("invalid_revision")
++    expected = str(event_id(value["aggregate_type"], value["aggregate_id"], revision))
++    previous = (
++        str(event_id(value["aggregate_type"], value["aggregate_id"], revision - 1))
++        if revision > 1
++        else None
++    )
++    if value["event_id"] != expected or value["predecessor_id"] != previous:
++        raise _Invalid("invalid_lineage")
++    if value["provenance"] not in (
++        "current_baseline",
++        "database_change",
++        "source_observation",
++    ):
++        raise _Invalid("invalid_provenance")
++    for name in ("occurred_at", "observed_at", "recorded_at"):
++        item = value[name]
++        if name == "observed_at" and item is None:
++            continue
++        if not isinstance(item, str) or not _aware(datetime.fromisoformat(item)):
++            raise _Invalid("invalid_timestamp")
++    validate_change(
++        PublicChange(
++            AggregateType(value["aggregate_type"]),
++            value["aggregate_id"],
++            ChangeKind(value["kind"]),
++            value["body"],
++            datetime.fromisoformat(value["occurred_at"]),
++        )
++    )
++    return value
++
++
++# Direct public endpoints only: no inferred identity or transitive graph merging.
++_ENDPOINTS = {
++    "company_id": "companies",
++    "legacy_company_id": "companies",
++    "job_id": "jobs",
++    "source_account_id": "source_accounts",
++    "source_listing_id": "source_listings",
++    "job_version_id": "job_versions",
++    "current_version_id": "job_versions",
++    "brand_id": "brands",
++    "skill_id": "skills",
++    "location_id": "locations",
++    "left_listing_id": "source_listings",
++    "right_listing_id": "source_listings",
++}
++
++
++def project_archive(
++    manifests: Iterable[Manifest], policy: ProjectionPolicy, limits: ReplayLimits
++) -> ProjectionResult:
++    """All errors fail the run closed; gaps remain terminal partial evidence.
++
++    Iterators must be local/nonblocking. The deadline is cooperative between
++    bounded CPU units, not a process sandbox for a caller's blocking iterator.
++    Exact bytes include duplicates/expired objects in budgets and conflict checks.
++    """
++    if not isinstance(policy, ProjectionPolicy) or not isinstance(limits, ReplayLimits):
++        raise ValueError("typed policy and limits required")
++    deadline = time.monotonic() + limits.deadline_seconds
++    seen, retained, excluded = {}, {}, {}
++    ignored, applied = set(), set()
++    count = byte_count = 0
++
++    def check():
++        if time.monotonic() >= deadline:
++            raise _Invalid("deadline")
++
++    try:
++        blocked = {(s.aggregate_type, s.aggregate_id) for s in policy.suppressions}
++        starts = {(t, i): n for t, i, n in policy.coverage_starts}
++        iterator = iter(manifests)
++        for position in range(limits.max_manifests + 1):
++            check()
++            try:
++                item = next(iterator)
++            except StopIteration:
++                break
++            if position == limits.max_manifests:
++                raise _Invalid("manifest_limit")
++            if not isinstance(item, Manifest) or not isinstance(item.seal, SealedBatch):
++                raise _Invalid("invalid_manifest")
++            seal = item.seal
++            ref = seal.batch
++            if (
++                type(ref.serializer_version) is not int
++                or ref.serializer_version != 1
++                or not isinstance(ref.batch_id, UUID)
++                or ref.prior_batch_id is not None
++                and not isinstance(ref.prior_batch_id, UUID)
++                or not isinstance(ref.ordered_event_ids, tuple)
++                or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
++                or any(
++                    type(n) is not int
++                    for n in (
++                        seal.event_count,
++                        seal.expanded_bytes,
++                        seal.compressed_bytes,
++                        seal.manifest_bytes,
++                    )
++                )
++            ):
++                raise _Invalid("invalid_manifest_types")
++            if (
++                not isinstance(item.object_version, str)
++                or len(item.object_version) > 1024
++                or not _aware(ref.sealed_at)
++                or not _aware(ref.eligible_until)
++                or ref.eligible_until.astimezone(UTC) - ref.sealed_at.astimezone(UTC)
++                != timedelta(days=730)
++                or ref.sealed_at.astimezone(UTC) > policy.as_of.astimezone(UTC)
++            ):
++                raise _Invalid("invalid_seal_window")
++            chunks = (seal.canonical_data, seal.compressed_data, seal.manifest_data)
++            if (
++                any(not isinstance(b, bytes) for b in chunks)
++                or not isinstance(ref.event_bytes, tuple)
++                or not 1 <= len(ref.event_bytes) <= 2000
++                or len(chunks[0]) > MAX_EXPANDED
++                or len(chunks[1]) > MAX_COMPRESSED
++                or len(chunks[2]) > MAX_MANIFEST
++            ):
++                raise _Invalid("seal_size_limit")
++            count += len(ref.event_bytes)
++            if count > limits.max_events:
++                raise _Invalid("event_limit")
++            for raw in ref.event_bytes:
++                if not isinstance(raw, bytes) or len(raw) > 16384:
++                    raise _Invalid("event_size_limit")
++            byte_count += sum(map(len, chunks)) + sum(map(len, ref.event_bytes))
++            if byte_count > limits.max_bytes:
++                raise _Invalid("byte_limit")
++            events = []
++            for raw in ref.event_bytes:
++                check()
++                events.append(_event(raw, limits.max_depth))
++            _json(seal.manifest_data, limits.max_depth)
++            if seal_batch(ref) != seal:
++                raise _Invalid("invalid_seal")
++            check()
++            for raw, value in zip(ref.event_bytes, events, strict=True):
++                eid = value["event_id"]
++                digest = hashlib.sha256(raw).hexdigest()
++                if eid in seen and seen[eid] != digest:
++                    raise _Invalid("conflicting_event_id")
++                if eid in seen:
++                    ignored.add(UUID(eid))
++                seen[eid] = digest
++                key = (value["aggregate_type"], value["aggregate_id"])
++                revision = value["revision"]
++                # Snapshot markers dominate all object versions and seal epochs.
++                reason = (
++                    "removed"
++                    if key in blocked
++                    else "expired"
++                    if ref.eligible_until.astimezone(UTC)
++                    <= policy.as_of.astimezone(UTC)
++                    else None
++                )
++                if reason:
++                    excluded[(key, revision)] = reason
++                    ignored.add(UUID(eid))
++                    continue
++                values = retained.setdefault(key, {})
++                existing = values.get(revision)
++                if existing is None or existing[1] < ref.eligible_until.astimezone(UTC):
++                    values[revision] = (
++                        value,
++                        ref.eligible_until.astimezone(UTC),
++                        digest,
++                    )
++        else:
++            raise _Invalid("manifest_limit")
++
++        # Suppression propagates only along explicit endpoints. No graph output or
++        # merge is built. A finite depth cap fails closed if closure is unfinished.
++        for _ in range(limits.max_depth):
++            check()
++            newly = set()
++            for key, revisions in retained.items():
++                check()
++                if key in blocked:
++                    continue
++                if any(
++                    (target, str(v[0]["body"].get(field))) in blocked
++                    for v in revisions.values()
++                    for field, target in _ENDPOINTS.items()
++                    if field in v[0]["body"]
++                ):
++                    newly.add(key)
++            if not newly:
++                break
++            blocked.update(newly)
++        else:
++            raise _Invalid("suppression_depth_limit")
++
++        facts, coverage, gaps, ranges = [], [], [], []
++        keys = set(retained) | {key for key, _ in excluded}
++        for key in sorted(keys):
++            check()
++            revisions = retained.get(key, {})
++            if key in blocked:
++                coverage.append(ProjectionCoverage(*key, "suppressed", None))
++                gaps.append(ProjectionGap(*key, "retention_gap", "removed", None))
++                ignored.update(UUID(v[0]["event_id"]) for v in revisions.values())
++                continue
++            if not revisions:
++                coverage.append(ProjectionCoverage(*key, "incomplete", None))
++                gaps.append(ProjectionGap(*key, "retention_gap", "expired", None))
++                continue
++            ordered = sorted(revisions)
++            # Exact disjoint ranges, never min/max across a missing revision.
++            first = last = ordered[0]
++            for rev in ordered[1:]:
++                if rev != last + 1:
++                    ranges.append((*key, first, last))
++                    first = rev
++                last = rev
++            ranges.append((*key, first, last))
++            latest = ordered[-1]
++            current = latest
++            baseline = None
++            reason = "unknown"
++            for _ in range(limits.max_depth):
++                check()
++                candidate = revisions.get(current)
++                if candidate is None:
++                    reason = excluded.get(
++                        (key, current),
++                        "outside_declared_coverage"
++                        if current < starts.get(key, 1)
++                        else "unknown",
++                    )
++                    break
++                value = candidate[0]
++                if value["kind"] == "baseline":
++                    baseline = current
++                    break
++                current -= 1
++            else:
++                reason = "depth_limit"
++            complete = baseline is not None
++            coverage.append(
++                ProjectionCoverage(
++                    *key,
++                    "complete_from_baseline" if complete else "incomplete",
++                    baseline,
++                )
++            )
++            if not complete:
++                gaps.append(
++                    ProjectionGap(*key, "retention_gap", reason, max(1, current))
++                )
++            value, eligible, digest = revisions[latest]
++            # Every prefix-derived field expires with its earliest dependency.
++            if complete:
++                eligible = min(revisions[r][1] for r in range(baseline, latest + 1))
++                fields = value["body"].copy()
++            else:
++                allow = INDEPENDENT_FACT_FIELDS.get(key[0], frozenset())
++                fields = {k: v for k, v in value["body"].items() if k in allow}
++            if value["kind"] == "removed":
++                fields = {}
++            applied.update(UUID(revisions[r][0]["event_id"]) for r in ordered)
++            if fields:
++                facts.append(
++                    ProjectedFact(
++                        *key,
++                        latest,
++                        UUID(value["event_id"]),
++                        fields,
++                        datetime.fromisoformat(value["occurred_at"]),
++                        datetime.fromisoformat(value["observed_at"])
++                        if value["observed_at"]
++                        else None,
++                        datetime.fromisoformat(value["recorded_at"]),
++                        value["provenance"],
++                        complete,
++                        eligible,
++                        digest,
++                    )
++                )
++        check()
++        return ProjectionResult(
++            tuple(sorted(applied, key=str)),
++            tuple(sorted(ignored, key=str)),
++            tuple(facts),
++            tuple(coverage),
++            tuple(gaps),
++            tuple(ranges),
++            (),
++            policy.suppression_epoch,
++        )
++    except _Invalid as exc:
++        return ProjectionResult(
++            (), (), errors=(str(exc),), suppression_epoch=policy.suppression_epoch
++        )
++    except (
++        ValueError,
++        TypeError,
++        KeyError,
++        AttributeError,
++        OverflowError,
++        RecursionError,
++    ):
++        # Do not include source bodies/URLs in diagnostics.
++        return ProjectionResult(
++            (),
++            (),
++            errors=("invalid_archive_input",),
++            suppression_epoch=policy.suppression_epoch,
++        )
+diff --git a/job_discovery/archive/schema.py b/job_discovery/archive/schema.py
+index 54090dc..977c0c0 100644
+--- a/job_discovery/archive/schema.py
++++ b/job_discovery/archive/schema.py
+@@ -252,10 +252,27 @@ def validate_change(value) -> PublicChange:
+                     raise ValueError("public URL required")
+             if key == "content_hash" and (
+                 len(item) != 64 or any(c not in "0123456789abcdef" for c in item)
+             ):
+                 raise ValueError("content hash requires sha256 hex")
+         if len(canonical_json(body)) > 8192:
+             raise ValueError("public event body exceeds 8KiB")
+     except (TypeError, OverflowError) as exc:
+         raise ValueError("invalid public body") from exc
+     return value
++
++
++# Version-1 facts that remain interpretable without any historical prefix.
++# In particular no availability/lifespan, foreign endpoints, identity edges,
++# revisions of other entities, or relationship evidence is independent.
++INDEPENDENT_FACT_FIELDS = {
++    "jobs": frozenset("id external_id title url location department remote".split()),
++    "source_accounts": frozenset("id ats public_board_ref public_url".split()),
++    "source_listings": frozenset("id external_id".split()),
++    "job_versions": frozenset("id content_hash public_metadata observed_at".split()),
++    "companies": frozenset(
++        "id name ats token display_name industry industry_subcategory size hq_country".split()
++    ),
++    "locations": frozenset("raw canonicals components source".split()),
++    "brands": frozenset({"id", "name"}),
++    "skills": frozenset({"id", "canonical_name"}),
++}
+diff --git a/job_discovery/archive/types.py b/job_discovery/archive/types.py
+index 29dd468..e99a263 100644
+--- a/job_discovery/archive/types.py
++++ b/job_discovery/archive/types.py
+@@ -98,14 +98,55 @@ class VerifiedBatch:
+     data_receipt: VerificationReceipt
+     manifest_receipt: VerificationReceipt
+ 
+ 
+ @dataclass(frozen=True)
+ class AckResult:
+     exact_event_ids: tuple[UUID, ...]
+     archived_revision_markers: tuple[tuple[str, str, int], ...]
+ 
+ 
++@dataclass(frozen=True)
++class ProjectedFact:
++    aggregate_type: str
++    aggregate_id: str
++    revision: int
++    event_id: UUID
++    fields: dict
++    occurred_at: datetime
++    observed_at: datetime | None
++    recorded_at: datetime
++    provenance: str
++    history_complete: bool  # Only from the declared activation baseline.
++    eligible_until: datetime
++    event_sha256: str
++
++
++@dataclass(frozen=True)
++class ProjectionCoverage:
++    aggregate_type: str
++    aggregate_id: str
++    status: str
++    baseline_revision: int | None
++    complete_history: bool = False  # No assertion about pre-activation history.
++
++
++@dataclass(frozen=True)
++class ProjectionGap:
++    aggregate_type: str
++    aggregate_id: str
++    kind: str
++    reason: str
++    missing_revision: int | None
++    terminal: bool = True  # Never a request for an automatic retry.
++
++
+ @dataclass(frozen=True)
+ class ProjectionResult:
+     applied_event_ids: tuple[UUID, ...]
+     ignored_event_ids: tuple[UUID, ...]
++    facts: tuple[ProjectedFact, ...] = ()
++    coverage: tuple[ProjectionCoverage, ...] = ()
++    gaps: tuple[ProjectionGap, ...] = ()
++    retained_revision_ranges: tuple[tuple[str, str, int, int], ...] = ()
++    errors: tuple[str, ...] = ()
++    suppression_epoch: int = 0
+diff --git a/tests/test_archive_replay.py b/tests/test_archive_replay.py
+new file mode 100644
+index 0000000..b7255a7
+--- /dev/null
++++ b/tests/test_archive_replay.py
+@@ -0,0 +1,421 @@
++"""Ordinary offline projection correctness; synthetic immutable public seals only."""
++
++from dataclasses import replace
++from datetime import UTC, datetime, timedelta
++from itertools import repeat
++from uuid import UUID, uuid4
++import pytest
++
++from job_discovery.archive.batches import seal_batch
++from job_discovery.archive.codec import canonical_json
++from job_discovery.archive.schema import event_id
++from job_discovery.archive.types import BatchRef
++from job_discovery.lifecycle.types import ClaimRef
++from job_discovery.archive.replay import (
++    Manifest,
++    ProjectionPolicy,
++    ReplayLimits,
++    Suppression,
++    project_archive,
++)
++
++NOW = datetime(2026, 10, 7, tzinfo=UTC)
++
++
++def event(revision=1, *, title="Engineer", aggregate_id="job-1", kind=None, **changes):
++    value = dict(
++        event_id=str(event_id("jobs", aggregate_id, revision)),
++        aggregate_type="jobs",
++        aggregate_id=aggregate_id,
++        revision=revision,
++        predecessor_id=str(event_id("jobs", aggregate_id, revision - 1))
++        if revision > 1
++        else None,
++        kind=kind or ("baseline" if revision == 1 else "upsert"),
++        body=dict(
++            id=aggregate_id,
++            company_id=1,
++            external_id="ext",
++            title=title,
++            url="https://example.test/job",
++            closed_at=None,
++        ),
++        occurred_at=(NOW - timedelta(days=2)).isoformat(),
++        observed_at=(NOW - timedelta(days=3)).isoformat(),
++        recorded_at=(NOW - timedelta(days=1)).isoformat(),
++        provenance="current_baseline" if revision == 1 else "source_observation",
++        schema_version=1,
++    )
++    return value | changes
++
++
++def manifest(*events, expired=False, version="current"):
++    sealed = NOW - timedelta(days=731 if expired else 1)
++    ref = BatchRef(
++        uuid4(),
++        ClaimRef("fixture", 1, NOW + timedelta(seconds=180)),
++        tuple(UUID(e["event_id"]) for e in events),
++        1,
++        sealed,
++        sealed + timedelta(days=730),
++        tuple(canonical_json(e) for e in events),
++        object_prefix="synthetic/public",
++    )
++    return Manifest(seal_batch(ref), version)
++
++
++def project(*items, policy=None, limits=None):
++    return project_archive(
++        items,
++        policy or ProjectionPolicy(admin_authorized=True, as_of=NOW),
++        limits or ReplayLimits(),
++    )
++
++
++def test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times():
++    old, new = event(), event(2, title="Senior")
++    result = project(manifest(new), manifest(old), manifest(old, version="noncurrent"))
++    assert result.errors == ()
++    assert len(result.facts) == 1
++    fact = result.facts[0]
++    assert fact.fields["title"] == "Senior" and fact.revision == 2
++    assert fact.observed_at == datetime.fromisoformat(new["observed_at"])
++    assert fact.recorded_at == datetime.fromisoformat(new["recorded_at"])
++    assert fact.history_complete and fact.provenance == "source_observation"
++    assert len(result.applied_event_ids) == 2
++    assert result.retained_revision_ranges == (("jobs", "job-1", 1, 2),)
++
++
++def test_conflicting_exact_id_fails_closed_even_after_good_fact():
++    result = project(manifest(event()), manifest(event(title="Conflict")))
++    assert not result.facts and "conflicting_event_id" in result.errors
++
++
++@pytest.mark.parametrize(
++    "changes",
++    [
++        {"schema_version": 2},
++        {"schema_version": True},
++        {"revision": True},
++        {"aggregate_id": None},
++        {"body": []},
++        {"occurred_at": 3},
++        {"observed_at": "2026-01-01"},
++        {"extra": "unknown"},
++        {"provenance": "private"},
++        {"predecessor_id": str(uuid4())},
++    ],
++)
++def test_total_envelope_unknown_schema_and_invalid_fields_fail_closed(changes):
++    value = event() | changes
++    # Keep a synthetically sealed exact membership despite invalid envelope fields.
++    result = project(manifest(value))
++    assert not result.facts and result.errors
++
++
++def test_expired_baseline_terminal_gap_independent_facts_only():
++    result = project(manifest(event(), expired=True), manifest(event(2)))
++    assert result.gaps[0].kind == "retention_gap"
++    assert result.gaps[0].reason == "expired" and result.gaps[0].terminal
++    assert not result.facts[0].history_complete
++    assert set(result.facts[0].fields) == {"id", "external_id", "title", "url"}
++    assert result.retained_revision_ranges == (("jobs", "job-1", 2, 2),)
++    assert result.facts[0].eligible_until == NOW + timedelta(days=729)
++
++
++def test_missing_predecessor_unknown_cause_is_terminal_without_retries():
++    result = project(manifest(event(3)))
++    assert result.gaps[0].reason == "unknown"
++    assert result.gaps[0].missing_revision == 2 and result.gaps[0].terminal
++    assert result.coverage[0].status == "incomplete"
++    assert not result.coverage[0].complete_history
++
++
++def test_later_baseline_does_not_invent_earlier_history():
++    result = project(manifest(event(5, kind="baseline", provenance="current_baseline")))
++    assert result.coverage[0].baseline_revision == 5
++    assert result.coverage[0].status == "complete_from_baseline"
++    assert not result.coverage[0].complete_history
++
++
++def test_authorized_suppression_dominates_current_noncurrent_and_later_epochs():
++    marker = Suppression("jobs", "job-1", NOW - timedelta(days=1), "authorized_removal")
++    policy = ProjectionPolicy(True, NOW, suppressions=(marker,), suppression_epoch=7)
++    result = project(
++        manifest(event()),
++        manifest(event(), version="noncurrent"),
++        manifest(event(2)),
++        policy=policy,
++    )
++    assert not result.facts and result.coverage[0].status == "suppressed"
++    assert result.gaps[0].reason == "removed" and result.gaps[0].terminal
++    assert result.suppression_epoch == 7
++    assert not project(
++        manifest(event(3)), policy=replace(policy, suppression_epoch=8)
++    ).facts
++
++
++def test_suppressed_endpoint_invalidates_dependent_facts():
++    policy = ProjectionPolicy(
++        True,
++        NOW,
++        suppressions=(Suppression("companies", "1", NOW, "authorized_removal"),),
++    )
++    assert not project(manifest(event()), policy=policy).facts
++
++
++def test_expired_duplicate_does_not_invalidate_eligible_authorized_reseal():
++    result = project(manifest(event(), expired=True), manifest(event()))
++    assert result.facts[0].history_complete and not result.gaps
++
++
++def test_projection_expiry_recomputes_no_retained_facts_after_horizon():
++    item = manifest(event())
++    assert project(item).facts
++    result = project(item, policy=ProjectionPolicy(True, NOW + timedelta(days=729)))
++    assert not result.facts and result.gaps[0].reason == "expired"
++
++
++@pytest.mark.parametrize(
++    "field", ["canonical_data", "compressed_data", "manifest_data"]
++)
++def test_tampered_seal_bytes_fail_closed(field):
++    item = manifest(event())
++    item = replace(item, seal=replace(item.seal, **{field: b"corrupt"}))
++    result = project(item)
++    assert result.errors and not result.facts
++
++
++@pytest.mark.parametrize(
++    "limits",
++    [
++        ReplayLimits(max_events=1),
++        ReplayLimits(max_bytes=1),
++        ReplayLimits(max_manifests=1),
++    ],
++)
++def test_finite_input_budgets_fail_closed(limits):
++    item = manifest(event())
++    result = project_archive(repeat(item), ProjectionPolicy(True, NOW), limits)
++    assert result.errors and not result.facts
++
++
++def test_deadline_fails_closed(monkeypatch):
++    ticks = iter([0, 2, 3, 4])
++    monkeypatch.setattr(
++        "job_discovery.archive.replay.time.monotonic", lambda: next(ticks, 5)
++    )
++    assert (
++        "deadline"
++        in project(manifest(event()), limits=ReplayLimits(deadline_seconds=1)).errors
++    )
++
++
++def test_depth_limits_json_and_predecessor_walk():
++    result = project(
++        manifest(event(), event(2), event(3)), limits=ReplayLimits(max_depth=2)
++    )
++    assert not result.facts or not result.facts[0].history_complete
++    assert result.errors or result.gaps
++
++
++@pytest.mark.parametrize(
++    "kwargs",
++    [
++        {"max_events": 0},
++        {"max_bytes": float("inf")},
++        {"deadline_seconds": float("nan")},
++        {"max_depth": True},
++        {"max_manifests": 0},
++    ],
++)
++def test_invalid_limits_rejected(kwargs):
++    with pytest.raises(ValueError):
++        ReplayLimits(**kwargs)
++
++
++def test_explicit_admin_policy_and_aware_time_required():
++    with pytest.raises(ValueError):
++        project(manifest(event()), policy=ProjectionPolicy(False, NOW))
++    with pytest.raises(ValueError):
++        ProjectionPolicy(True, datetime(2026, 1, 1))
++
++
++def test_pure_projection_has_zero_application_or_external_calls(monkeypatch):
++    import socket
++    import psycopg
++    import subprocess
++
++    def forbidden(*args, **kwargs):
++        pytest.fail("projection attempted external/application work")
++
++    monkeypatch.setattr(socket, "socket", forbidden)
++    monkeypatch.setattr(psycopg, "connect", forbidden)
++    monkeypatch.setattr(subprocess, "Popen", forbidden)
++    # Trace application/provider Python calls as well as blocking all external
++    # effects. Dashboard-only generation/notification code has no in-process
++    # import here and cannot run through a subprocess or network bridge.
++    import sys
++
++    item = manifest(event())
++    calls = []
++    forbidden_modules = (
++        "reviewer.",
++        "openai.",
++        "boto3.",
++        "botocore.",
++        "requests.",
++        "httpx.",
++        "job_discovery.db",
++        "job_discovery.lifecycle.",
++    )
++
++    def trace(frame, action, arg):
++        if action == "call" and frame.f_globals.get("__name__", "").startswith(
++            forbidden_modules
++        ):
++            calls.append(frame.f_code.co_name)
++
++    previous = sys.getprofile()
++    try:
++        sys.setprofile(trace)
++        result = project(item)
++    finally:
++        sys.setprofile(previous)
++    assert result.facts
++    assert calls == []
++
++
++def test_outside_declared_coverage_is_terminal():
++    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
++    result = project(manifest(event(3)), policy=policy)
++    assert result.gaps[0].reason == "outside_declared_coverage"
++
++
++def test_missing_prefix_cannot_project_relationship_or_lifespan():
++    rid = str(uuid4())
++    value = event(2)
++    value.update(
++        aggregate_type="company_brands",
++        aggregate_id=rid,
++        event_id=str(event_id("company_brands", rid, 2)),
++        predecessor_id=str(event_id("company_brands", rid, 1)),
++        body=dict(
++            id=rid,
++            company_id=1,
++            brand_id=str(uuid4()),
++            revision=2,
++            status="accepted",
++            evidence_kind="structured_source",
++            public_evidence_ref="https://example.test/evidence",
++        ),
++    )
++    result = project(manifest(value))
++    assert not result.facts and result.gaps[0].kind == "retention_gap"
++
++
++def test_prefix_dependent_fact_expires_with_earliest_baseline():
++    old = manifest(event())
++    # A still eligible baseline has only one second left.
++    ref = replace(
++        old.seal.batch,
++        sealed_at=NOW - timedelta(days=730) + timedelta(seconds=1),
++        eligible_until=NOW + timedelta(seconds=1),
++    )
++    old = replace(old, seal=seal_batch(ref))
++    result = project(old, manifest(event(2)))
++    assert result.facts[0].history_complete
++    assert result.facts[0].eligible_until == NOW + timedelta(seconds=1)
++    later = project(
++        old,
++        manifest(event(2)),
++        policy=ProjectionPolicy(True, NOW + timedelta(seconds=1)),
++    )
++    assert not later.facts[0].history_complete
++    assert "closed_at" not in later.facts[0].fields
++
++
++def test_predecessor_walk_stops_at_depth_with_normal_json():
++    result = project(
++        manifest(*(event(i) for i in range(1, 7))), limits=ReplayLimits(max_depth=4)
++    )
++    assert not result.errors
++    assert result.gaps[0].reason == "depth_limit"
++    assert not result.facts[0].history_complete
++
++
++def test_disjoint_retained_ranges_never_claim_missing_revisions():
++    result = project(manifest(event(), event(3)))
++    assert result.retained_revision_ranges == (
++        ("jobs", "job-1", 1, 1),
++        ("jobs", "job-1", 3, 3),
++    )
++    assert result.gaps[0].missing_revision == 2
++
++
++def test_complete_relation_assertion_retracts_without_identity_inference():
++    rid, left, right = (str(uuid4()) for _ in range(3))
++
++    def assertion(rev, status, kind):
++        value = event(rev, kind=kind)
++        value.update(
++            aggregate_type="identity_assertions",
++            aggregate_id=rid,
++            event_id=str(event_id("identity_assertions", rid, rev)),
++            predecessor_id=str(event_id("identity_assertions", rid, rev - 1))
++            if rev > 1
++            else None,
++            body=dict(
++                id=rid,
++                left_listing_id=left,
++                right_listing_id=right,
++                relation="possible_same_posting",
++                revision=rev,
++                status=status,
++                evidence_kind="public_correction",
++                public_evidence_ref="https://example.test/evidence",
++            ),
++        )
++        return value
++
++    result = project(
++        manifest(
++            assertion(1, "proposed", "baseline"), assertion(2, "retracted", "upsert")
++        )
++    )
++    assert len(result.facts) == 1
++    assert result.facts[0].fields["status"] == "retracted"
++    assert result.facts[0].fields["relation"] == "possible_same_posting"
++    assert result.facts[0].revision == 2
++
++
++@pytest.mark.parametrize(
++    "field,value", [("serializer_version", True), ("serializer_version", 2)]
++)
++def test_total_manifest_rejects_unknown_or_boolean_serializer(field, value):
++    item = manifest(event())
++    # A total reader also rejects the boolean/1 equality ambiguity.
++    ref = replace(item.seal.batch, **{field: value})
++    seal = replace(item.seal, batch=ref)
++    if value is True:
++        seal = seal_batch(ref)
++    result = project(replace(item, seal=seal))
++    assert result.errors and not result.facts
++
++
++def test_invalid_iterable_member_returns_sanitized_error():
++    result = project({"private": "never log bodies"})
++    assert result.errors == ("invalid_manifest",) and not result.facts
++
++
++def test_retention_window_requires_730_elapsed_utc_days():
++    from zoneinfo import ZoneInfo
++
++    item = manifest(event())
++    london = ZoneInfo("Europe/London")
++    # The same wall time crosses a DST offset; it is one hour short of730days.
++    start = datetime(2024, 3, 31, 0, 30, tzinfo=london)
++    end = datetime(2026, 3, 31, 0, 30, tzinfo=london)
++    ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
++    result = project(replace(item, seal=seal_batch(ref)))
++    assert result.errors == ("invalid_seal_window",)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-reviewer-dispatch.md
new file mode 100644
index 0000000..aaa1c92
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-reviewer-dispatch.md
@@ -0,0 +1,9 @@
+# Task12 permitted independent requirements/code-quality review
+
+After author DONE/STOP and controller full report/evidence read, use fresh reviewer on full pinned BASE `0f87454e965f3ef8d06b18ce93d23ea621d53b6f` through actual report HEAD. Read task-12-brief.md first, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, task-12-report.md, complete task-12-review-package.md and binding specification sections for Task12. Both explicit requirements and code-quality verdicts are required. Task12 only; whole-branch review follows Task13.
+
+Assess optional pure admin public archive projection: explicit finite event/byte/deadline/depth bounds; total parsing; exact ID/hash duplicates and conflicts; deterministic revisions and incomplete coverage; bounded missing predecessors; terminal retention gaps; independent schema-fact allowlist; suppression across duplicate/current/noncurrent objects; no invented prefix-dependent history, graph merge, application DB restore/state reopening, private data, review/generation/notification/paid call side effects. Compatible appended defaulted ProjectionResult metadata is authorized. Accepted database suppression is permanent whole-aggregate with no epoch column; trusted snapshot epoch is provenance only and cannot lift suppression. Verify accepted codec/seal interfaces unchanged and read exact ordinary offline commands, outputs, source hashes and RED/GREEN. No author-covered test reruns.
+
+This reviews ordinary NEW archive projection/retention semantics only, including its own archive input eligibility. Do not reproduce, split, disguise or substitute the omitted Task3 independent lease expiry enforcement, physical-capacity accounting, cross-user isolation or related adversarial reviews/probes. No old mechanism assurance or production readiness inferred from synthetic sealed inputs. Functional feature requirements remain required; scopes must be stated honestly.
+
+Read-only source/evidence review: no source/test edits, stage/commit, helpers/subagents, tests rerun, network/DB/provider/production/S3/IAM/config/credential/activation/release actions. Write task-12-requirements-review.md with exact pins, concrete findings ranked Critical/Important/Minor, both verdicts, implemented/tested/reviewed/deliberately unreviewed limits and necessary narrow ordinary evidence. Return DONE + both verdicts + STOP. Controller handles fixes via same author and scoped same-reviewer follow-up, checkpointing and next Task13.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
index 952401e..8b6c5ae 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-author-dispatch.md
@@ -76,10 +76,12 @@ Task9 public-board freshness cost carry:120sISR removed for exactexpiry/per-requ
 
 Task9 independent review carried default/owned Vitest lane-selection gap: newConsumers.db strict owned-env import guard plus BOTH BASEjobLifecycle.db/flow.db suites already included bydefaultvitest/plainnpmCIwithoutownedvars. Authorbroadsuiteexcluded.db is notproofplainCIgreen. Task13mustexplicitordinarydefaultvsownedDBselection+17/16permittedfixtures, preserveALLstrictowned-targetguards; neverpointfixtureDDL atsharedDSN orexecuteomittedprobes viaCI. MinorFunnelSection suffixofopen vs discovery denominator mustconsistent ifnothandledTask9fix. Task9 ownReactchecklist wasabsentinitialreport; assessactualphasefixrecord, no borrowedTask8assurance.
 
 Task9 fresh-review CI nuance: Consumers.db import requires owned TEST_DATABASE_URL/LIFECYCLE_REQUIRE_DB_TESTS=1 while plain default npmCI includes all*.test.ts. BASE Task8 jobLifecycle.db/flow.db already have same strictguards: inherited lane-selection rootcause, notpreviouslygreenCI/newthirdTask9functionalblocker. Under13 aligndefaultunit exclusions andexplicitowned17/16DBlanes using actualpermittedcontents; preserveguards/neverpointownedresetfixtureatsharedDSN. Task9review report also carries analyticsFunnel 'of open' vsdiscovery denominatorcopy and missing explicitauthorReactchecklist; readfinalFix1report for disposition.
 
 Task10 operational/outbox integration carry (read final10report+independentreview before acting): additive bounded preallocated operational lane intended to resolveR6-4; missing/insufficient slots musttruthfullydefer, no newidentity/payloadaboveguard, ordinarygrowthguardunchanged. Smallownedfixturezeroallocationdelta notproduction/sustainedMVCCguarantee; report slotprovisioning/exhaustion/criticaleventexactack andlogical-vs-physicalmetrics. All publictables triggerprojection contract includes jobs/source_accounts/source_listings/job_versions/companies/locations/brands/skills/edges/identityassertions. Author10 currentinventory says legacy db/companydiscoverydirect writers intentionally failclosed whenactivearchiveeventful; activation readiness blocked. Task13actualwritercallerreadiness MUSTaccount each legitimate runtimewriter/mode, neverclaim activationcompatiblemerelybecauselegacynegativepathfails. Noarchiveactivation/userpermission/infrastructure implied. Exact version-ID/listing/revision/hash coverage replaces listingwatermark; inspectfinalacceptedinterfaces.
 
 Task13 sourcecoverage concrete carry: root read runtime references afterTask11. verify_due_sources(conn,max_boards=100,seconds=300) has exactlyone actualcaller job_discovery/run.py:179. Poller remainsdaily00UTC; reviewer supervisor has reviewer/maintenance/archive children, no periodic sourceverifier. Thus the healthy normalpath processes atmost100selectedboards/day (resumedtailscanconsume turns); ifenabledcorpus exceeds100, that runtimecannotgiveeveryboard24hverification. Operationalfallback behavior maydiffer and noactualproductionenabledsourcecount was queried. Task13 actualwritercaller/scheduler inventory mustresolve this concrete integration limit with bounded scheduling preservingdaily discovery/independentmaintenance/claims/guard, or surfacealoadbearinggap rather than callsmallmanualfixturefairness a24hcoverageproof. No redundantproductionaggregates/wholecrawl/securityprobes authorizedbythisnote; useparentcountifneeded.
 
 Task11finalintegration carry: readfinalaccepted11report/reviewbeforeacting. Ordinarycombinedruntime overhead measurement remainsrequired; importonly0.359s/38212KiBRSS notcombinedcost. Superseded-shellseven-dayboundedcleanup lacksdedicatedfixture; pendingdata/markers/authhistorymustsurvive. MinorR11-2bombfixturedoesContentLength rejectionattwo-bytecompressedlimit, notrealexportpath; fixhonestlabel orordinaryfocusedfixture withoutweakening exact-bytecheck. No oldomittedprobes/substitutes.
+
+Current accepted-state clarification: R6-5 normal shared transport was integrated in Task8; R6-4 has a concrete Task10 operational lane. Earlier notes above describe historical blockers, not instructions to reimplement accepted work or rerun covered tests. Read final accepted8/10 reports and assess actual runtime callers/readiness under Task13; only concrete remaining integration gaps warrant changes. Task12 adds a pure optional reader with no runtime caller, trusted current time/comprehensive service suppression snapshot and cooperative CPU deadline, not cloud loading/auth/bootstrap. Do not turn Task13 into a new replay product. Verify finite selected ordinary end-to-end mapping and document these boundaries.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-reviewer-dispatch.md
new file mode 100644
index 0000000..99ea7e0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-reviewer-dispatch.md
@@ -0,0 +1,9 @@
+# Task13 permitted independent integration review
+
+Dispatch only after sole author DONE/STOP, controller full report/evidence read and complete actual Task13 BASE..HEAD package. Read task-13-brief.md first, REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md, task-13-author-dispatch.md, task-13-report.md, full task-13-review-package.md, binding spec and final-review-carry-forward.md. Require explicit requirements and code-quality verdicts. Scope Task13 integration changes and acceptance evidence; subsequent fresh whole-branch review is separate.
+
+Verify actual caller/writer/consumer/cascade inventory and modes; maintenance before additions/guards; source scheduling24h feasibility; truthful committed closure counts; ordinary end-to-end sixATS/fakeS3/replay flow and private artifacts preservation; bounded batches and default-off/dryrun; additive migration/runbook/readiness inventory; explicit permitted test contents in BOTH local and automatic CI before publication; unit/ownedVitest separation preserving owned guards; inherited fixture repairs preserving assertions; combined supervisor resource evidence and uncertainty; pending/ack/superseded aging correctness; no invented physical capacity, storage savings, production resource/cost or security approval. Accepted source modules need integration assessment, not wholesale reimplementation or reruns.
+
+Do not reproduce, split, disguise, retry or substitute omitted Task3 independent expiry-enforcement, physical-capacity, cross-user isolation or related adversarial reviews/probes. Do not run broad legacy/default suites or independently review old mechanisms as substitute assurance. Ordinary NEW feature and real caller functional integration remain permitted and required. Report exactly what functional requirements are implemented versus documented limitations; a default-off readiness gate is not functional completion by itself.
+
+Read-only source/evidence: no test reruns already covered by author, edits/stage/commit, helpers/subagents, DB/cloud/provider/production calls, infrastructure/credentials/activation/deletion/push/merge/deploy. Write task-13-requirements-review.md with exact pins, every concrete Critical/Important/Minor finding, both verdicts, acceptance mapping and evidence limits. Return DONE+verdicts+STOP. Root dispatches same-author/scoped-review fixes and all13 checkpoint, then fresh permitted whole-branch review.
diff --git a/job_discovery/archive/replay.py b/job_discovery/archive/replay.py
index 538754b..a2c2b96 100644
--- a/job_discovery/archive/replay.py
+++ b/job_discovery/archive/replay.py
@@ -241,20 +241,21 @@ def project_archive(
     """All errors fail the run closed; gaps remain terminal partial evidence.
 
     Iterators must be local/nonblocking. The deadline is cooperative between
     bounded CPU units, not a process sandbox for a caller's blocking iterator.
     Exact bytes include duplicates/expired objects in budgets and conflict checks.
     """
     if not isinstance(policy, ProjectionPolicy) or not isinstance(limits, ReplayLimits):
         raise ValueError("typed policy and limits required")
     deadline = time.monotonic() + limits.deadline_seconds
     seen, retained, excluded = {}, {}, {}
+    exclusion_reasons = {}
     ignored, applied = set(), set()
     count = byte_count = 0
 
     def check():
         if time.monotonic() >= deadline:
             raise _Invalid("deadline")
 
     try:
         blocked = {(s.aggregate_type, s.aggregate_id) for s in policy.suppressions}
         starts = {(t, i): n for t, i, n in policy.coverage_starts}
@@ -264,27 +265,43 @@ def project_archive(
             try:
                 item = next(iterator)
             except StopIteration:
                 break
             if position == limits.max_manifests:
                 raise _Invalid("manifest_limit")
             if not isinstance(item, Manifest) or not isinstance(item.seal, SealedBatch):
                 raise _Invalid("invalid_manifest")
             seal = item.seal
             ref = seal.batch
+            # Establish constant-time cardinalities and remaining work before
+            # walking either descriptor or passing it to the accepted codec.
+            if not isinstance(ref.ordered_event_ids, tuple) or not isinstance(
+                ref.event_bytes, tuple
+            ):
+                raise _Invalid("invalid_manifest_types")
+            membership_count = tuple.__len__(ref.ordered_event_ids)
+            if (
+                not 1 <= membership_count <= 2000
+                or membership_count != tuple.__len__(ref.event_bytes)
+                or type(seal.event_count) is not int
+                or seal.event_count != membership_count
+            ):
+                raise _Invalid("invalid_membership_count")
+            count += membership_count
+            if count > limits.max_events:
+                raise _Invalid("event_limit")
             if (
                 type(ref.serializer_version) is not int
                 or ref.serializer_version != 1
                 or not isinstance(ref.batch_id, UUID)
                 or ref.prior_batch_id is not None
                 and not isinstance(ref.prior_batch_id, UUID)
-                or not isinstance(ref.ordered_event_ids, tuple)
                 or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
                 or any(
                     type(n) is not int
                     for n in (
                         seal.event_count,
                         seal.expanded_bytes,
                         seal.compressed_bytes,
                         seal.manifest_bytes,
                     )
                 )
@@ -296,30 +313,25 @@ def project_archive(
                 or not _aware(ref.sealed_at)
                 or not _aware(ref.eligible_until)
                 or ref.eligible_until.astimezone(UTC) - ref.sealed_at.astimezone(UTC)
                 != timedelta(days=730)
                 or ref.sealed_at.astimezone(UTC) > policy.as_of.astimezone(UTC)
             ):
                 raise _Invalid("invalid_seal_window")
             chunks = (seal.canonical_data, seal.compressed_data, seal.manifest_data)
             if (
                 any(not isinstance(b, bytes) for b in chunks)
-                or not isinstance(ref.event_bytes, tuple)
-                or not 1 <= len(ref.event_bytes) <= 2000
                 or len(chunks[0]) > MAX_EXPANDED
                 or len(chunks[1]) > MAX_COMPRESSED
                 or len(chunks[2]) > MAX_MANIFEST
             ):
                 raise _Invalid("seal_size_limit")
-            count += len(ref.event_bytes)
-            if count > limits.max_events:
-                raise _Invalid("event_limit")
             for raw in ref.event_bytes:
                 if not isinstance(raw, bytes) or len(raw) > 16384:
                     raise _Invalid("event_size_limit")
             byte_count += sum(map(len, chunks)) + sum(map(len, ref.event_bytes))
             if byte_count > limits.max_bytes:
                 raise _Invalid("byte_limit")
             events = []
             for raw in ref.event_bytes:
                 check()
                 events.append(_event(raw, limits.max_depth))
@@ -334,27 +346,30 @@ def project_archive(
                     raise _Invalid("conflicting_event_id")
                 if eid in seen:
                     ignored.add(UUID(eid))
                 seen[eid] = digest
                 key = (value["aggregate_type"], value["aggregate_id"])
                 revision = value["revision"]
                 # Snapshot markers dominate all object versions and seal epochs.
                 reason = (
                     "removed"
                     if key in blocked
+                    else "outside_declared_coverage"
+                    if revision < starts.get(key, 1)
                     else "expired"
                     if ref.eligible_until.astimezone(UTC)
                     <= policy.as_of.astimezone(UTC)
                     else None
                 )
                 if reason:
                     excluded[(key, revision)] = reason
+                    exclusion_reasons.setdefault(key, set()).add(reason)
                     ignored.add(UUID(eid))
                     continue
                 values = retained.setdefault(key, {})
                 existing = values.get(revision)
                 if existing is None or existing[1] < ref.eligible_until.astimezone(UTC):
                     values[revision] = (
                         value,
                         ref.eligible_until.astimezone(UTC),
                         digest,
                     )
@@ -388,21 +403,24 @@ def project_archive(
         for key in sorted(keys):
             check()
             revisions = retained.get(key, {})
             if key in blocked:
                 coverage.append(ProjectionCoverage(*key, "suppressed", None))
                 gaps.append(ProjectionGap(*key, "retention_gap", "removed", None))
                 ignored.update(UUID(v[0]["event_id"]) for v in revisions.values())
                 continue
             if not revisions:
                 coverage.append(ProjectionCoverage(*key, "incomplete", None))
-                gaps.append(ProjectionGap(*key, "retention_gap", "expired", None))
+                gaps.extend(
+                    ProjectionGap(*key, "retention_gap", reason, None)
+                    for reason in sorted(exclusion_reasons[key])
+                )
                 continue
             ordered = sorted(revisions)
             # Exact disjoint ranges, never min/max across a missing revision.
             first = last = ordered[0]
             for rev in ordered[1:]:
                 if rev != last + 1:
                     ranges.append((*key, first, last))
                     first = rev
                 last = rev
             ranges.append((*key, first, last))
diff --git a/tests/test_archive_replay_fix1.py b/tests/test_archive_replay_fix1.py
new file mode 100644
index 0000000..66cdbbf
--- /dev/null
+++ b/tests/test_archive_replay_fix1.py
@@ -0,0 +1,148 @@
+"""Task12 Fix1: ordinary coverage and small descriptor-order regressions only."""
+
+from dataclasses import replace
+from uuid import UUID, uuid4
+
+import pytest
+
+from job_discovery.archive import replay
+from job_discovery.archive.replay import ProjectionPolicy, ReplayLimits
+from job_discovery.archive.schema import event_id
+from tests.test_archive_replay import NOW, event, manifest, project
+
+
+def test_present_prefix_below_floor_cannot_expand_declared_coverage():
+    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+    result = project(manifest(event(), event(2), event(3)), policy=policy)
+    assert not result.errors
+    assert result.coverage[0].status == "incomplete"
+    assert result.coverage[0].baseline_revision is None
+    assert not result.coverage[0].complete_history
+    assert (
+        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
+    )
+    assert result.gaps[0].missing_revision == 2
+    fact = result.facts[0]
+    assert not fact.history_complete
+    assert set(fact.fields) == {"id", "external_id", "title", "url"}
+    assert result.retained_revision_ranges == (("jobs", "job-1", 3, 3),)
+    assert result.applied_event_ids == (event_id("jobs", "job-1", 3),)
+    assert set(result.ignored_event_ids) == {
+        event_id("jobs", "job-1", n) for n in (1, 2)
+    }
+
+
+def test_present_relationship_prefix_below_floor_cannot_supply_full_fields():
+    rid, brand = str(uuid4()), str(uuid4())
+    values = []
+    for revision in range(1, 4):
+        value = event(revision)
+        value.update(
+            aggregate_type="company_brands",
+            aggregate_id=rid,
+            event_id=str(event_id("company_brands", rid, revision)),
+            predecessor_id=str(event_id("company_brands", rid, revision - 1))
+            if revision > 1
+            else None,
+            body=dict(
+                id=rid,
+                company_id=1,
+                brand_id=brand,
+                revision=revision,
+                status="accepted",
+                evidence_kind="structured_source",
+                public_evidence_ref="https://example.test/evidence",
+            ),
+        )
+        values.append(value)
+    policy = ProjectionPolicy(True, NOW, coverage_starts=(("company_brands", rid, 3),))
+    result = project(manifest(*values), policy=policy)
+    assert not result.errors and not result.facts
+    assert result.coverage[0].status == "incomplete"
+    assert (
+        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
+    )
+    assert result.retained_revision_ranges == (("company_brands", rid, 3, 3),)
+    assert result.applied_event_ids == (event_id("company_brands", rid, 3),)
+
+
+def test_baseline_at_floor_still_anchors_only_declared_history():
+    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+    result = project(
+        manifest(
+            event(),
+            event(2),
+            event(3, kind="baseline", provenance="current_baseline"),
+            event(4),
+        ),
+        policy=policy,
+    )
+    assert not result.errors and not result.gaps
+    assert result.coverage[0].status == "complete_from_baseline"
+    assert result.coverage[0].baseline_revision == 3
+    assert not result.coverage[0].complete_history
+    assert result.facts[0].history_complete
+    assert "company_id" in result.facts[0].fields
+    assert result.retained_revision_ranges == (("jobs", "job-1", 3, 4),)
+    assert set(result.applied_event_ids) == {
+        event_id("jobs", "job-1", n) for n in (3, 4)
+    }
+
+
+def test_entirely_below_floor_input_has_truthful_terminal_reason():
+    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
+    result = project(manifest(event(), event(2)), policy=policy)
+    assert not result.errors and not result.facts and not result.applied_event_ids
+    assert not result.retained_revision_ranges
+    assert result.coverage[0].status == "incomplete"
+    assert (
+        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
+    )
+
+
+class _NoTraversal(tuple):
+    """Small fixture descriptor: detect order without time/resource experiments."""
+
+    def __iter__(self):
+        pytest.fail("membership traversal preceded cardinality/event-budget rejection")
+
+
+@pytest.mark.parametrize(
+    "ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)]
+)
+def test_count_mismatch_rejected_before_membership_or_seal_builder(
+    monkeypatch, ids, events, declared
+):
+    item = manifest(*(event(n) for n in range(1, events + 1)))
+    ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)] * ids))
+    item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))
+
+    def forbidden(*args, **kwargs):
+        pytest.fail("malformed membership reached accepted seal builder")
+
+    monkeypatch.setattr(replay, "seal_batch", forbidden)
+    result = project(item)
+    assert result.errors == ("invalid_membership_count",)
+    assert not result.facts and not result.applied_event_ids
+
+
+def test_remaining_event_budget_checked_before_membership_traversal(monkeypatch):
+    first = manifest(event())
+    second = manifest(event(2), event(3))
+    ref = replace(
+        second.seal.batch,
+        ordered_event_ids=_NoTraversal(second.seal.batch.ordered_event_ids),
+    )
+    second = replace(second, seal=replace(second.seal, batch=ref))
+    original = replay.seal_batch
+    calls = []
+
+    def guarded(ref):
+        assert ref is first.seal.batch, "over-budget descriptor reached seal builder"
+        calls.append(ref.batch_id)
+        return original(ref)
+
+    monkeypatch.setattr(replay, "seal_batch", guarded)
+    result = project(first, second, limits=ReplayLimits(max_events=2))
+    assert result.errors == ("event_limit",) and not result.facts
+    assert calls == [first.seal.batch.batch_id]
