# Recoverable reconstruction checkpoints

All bundles contain complete Git history for `feature/lifecycle-recovery`.
They preserve source, approved requirements, tests, reports and sanitized review
evidence. They contain no environment files, production database exports or
credentials. Library IDs below are confirmed tool results; local version
attributes were applied after upload.

| Checkpoint | Accepted scope | Bundle branch tip | Confirmed Library ID |
| --- | --- | --- | --- |
| 00 | Recovered approved requirements and reconstruction setup | `51624db86ae9f1e31363a7ccce8479776f533fd6` | `libfile_3e9c3823515c8191aa66373a20a5c5c7` |
| 01 | Task 1 isolated PostgreSQL harness, frozen migration baseline, CI 17 parity, both independent review gates | `95669e3d4bb57c81f3b117add7c6352de260487e` | `libfile_857c7cc774e48191aa481f7028271350` |
| 02 | Task 2 additive identity/control schema and private prerequisites, legacy compatibility, both independent review gates | `48c1adab2fdb3eb32be410e32b61965ec93b207a` | `libfile_fa262f9ce5e88191a44b964b0bb12a67` |

Task 1 accepted source tip: `204eea6ac9be1e1fd3263708577d1483f26969fb`.
Final affected harness/migration/RLS verification: **86 passed, zero skipped**
on PostgreSQL **17.11** and **16.15**. Initial whole-suite **899 passed** on
each major predates the cleanup fixes and is not represented as a final rerun.
Requirements and security both approved after two scoped fix rounds.

Task 2 accepted source tip: `b0fc09a0012b06bc6e16262b641a08a37ccc3ca1`.
Final affected verification: **93 passed, zero skipped** on PostgreSQL
**17.11** and **16.15**; both independent reviews approved. The full 17 suite
passed 931 tests before the final focused collect-stage change; that change is
covered by both final targeted lanes. No final-SHA full-suite claim is made.

Tasks 3–13 and the final independent whole-branch review remain pending.
Production activation, destination setup, deployment, push and merge remain
unauthorized. Reconstruction continues; this file is not a completion claim.

## Blocked, unaccepted Task 3 recovery checkpoint

Source HEAD: `a17b6427ea06c60e801836e56114890441166842`. Fix Round 1 tested 344 Python tests per PostgreSQL major and 5 dashboard DB tests per major. Final requirements-only Fix Round 2 tested 109 covering business tests per major. Versions: 17.11 / 16.15; zero skips. The 344-test lane predates the subsequent business-only fix and is not claimed as a final whole-suite rerun.

Independent Fix Round 2 requirements/business review: PASS / APPROVED. Independent Fix Round 1 security re-review: platform content safeguard blocked execution, no verdict. Task 3 is UNACCEPTED; this artifact is not accepted checkpoint 03. Tasks 4–13 require the unavailable security gate. See BLOCKERS.md for exact platform response. Full-history blocked bundle and confirmed Library ID are recorded in the next forward persistence ledger.

Blocked/unaccepted recovery persistence CONFIRMED: full-history bundle commit962a9ed96b977378591cf8630be76e7fc7d40509 (contains sourcea17b6427 plus complete approvedrequirements/Tasks1–3/tests/reviews/sanitizedevidence). /workspace/scratch/job-board-lifecycle-recovery-blocked-task03.bundle verifiedcompletehistory. Librarylibfile_f456c28e1bc0819190e70b5787de71e4, file_0000000010e081f7a4a9b043749c3284 v0, xattrs appliedsameexecsuccess. This is NOTacceptedcheckpoint03. Securitygateplatformblocked, Task3UNACCEPTED, Tasks4–13notstarted. RootreportedconfirmedID. Resume legitimateindependentsecuritygate at Task3 fixes; do not repeatcompletedretentionaudit oracceptedTasks1–2. No productionwrites/deploy/merge/push/activation.

Supplementallimitedreviewcompletehistorybundle22757c9df3fa91b5a5f0efed216a163c26936b42 VERIFIEDandLibraryCONFIRMED libfile_e46e35c614f48191a4aa0158c853efc8 / file_00000000976081f59777336d86e18415 v0, xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-limited-review.bundle. Originalblockedartifactlibfile_f456c28e1bc0819190e70b5787de71e4 remainsunchanged. This supplementalartifact includes limitedsource/config/dependencyreview+allpriorhistory, NOTsecurityacceptance. Sourcea17b6427unchanged; Task3unaccepted/Task4blockedpendingexplicitreviewgatedecision.

LATEST APPROVEDAMENDMENT2026-10-07 13:53UTC: Andrewapprovedcontinueddevelopment underreducedreviewscope, deploymentblocked. REVIEW-SCOPE-AMENDMENT.md authoritative supersedesearliersecuritygateblockFORDEVELOPMENTONLY. Task3sourcea17b6427usablebasis requirementsPASS+limiteddefensivereview; NOTfullysecurityapproved. Expiry/capacity/cross-user/relatedadversarialindependentreviewgaps preserved; neverretry/refusalbypass. Tasks4–13+final permittedrequirements/qualityreviews ordinarytests proceed; Librarycompletehistorycheckpointseachsaved withscope. ControllerdispatchfreshTask4afterconfirmeddevelopmentcheckpoint03; noaudit/Tasks1–3duplication.

Checkpoint03 LIMITEDDEVELOPMENT confirmed: fullhistorya38191e10c736949ef96f79aeba00c33b68fef8e Librarylibfile_279af9355680819193cd6d7575d1ac3f / file_0000000063f48230831c323349873131 v0, xattrsappliedsameexec; /workspace/scratch/job-board-lifecycle-recovery-checkpoint-03-limited-development.bundle. Task3basisallowedunderAndrewexplicitamendment, NOTfullysecurityapproved. Priorblocked/reducedartifactsunchanged. NextfreshTask4authorrecordBASEthisforwardledgercommit. Continueall13+permittedfinalwholebranchreview; no productionactions.

LATESTRELEASEAUTHORIZATION2026-10-07 14:27UTC Andrew:“Don’t keep deployment blocked, let’s just send it.” FinishALL13+permittedfinalreview THENpublish/mergecompletedupgrade/service-scopedexistingworkflowdeploy verifyexactlivecommit/E2E. RELEASE-AUTHORIZATION.md supersedesolddeployholdonlycompletedrelease; no unfinishedTask4deployment. Reducedreviewgapsremain/norefusalbypass. Permanentdeletion/newcredentialsIAM/securitysensitivesettingsothersafetyfloorstillapplicableconfirmation. PreserveunrelatedRailwaydiscoverystagedchanges. Authorlocalonlycontrollerfinalrelease; currentTask4Fix1continues.

Task4 COMPLETEpermittedrequirements/qualityat e67d4f4b62c1e2f8ab096e76cd8638856b5124a8; finalFix2SpecPASS/QualityAPPROVED fullreportrootread. R4-1/R4-1a/R4-2resolved, no ordinaryopenfindings. Final101passedzero-skip EACHPG17.11/16.15 authoritativeaffectedlane; original111eachpredatesfixes (historicalmigrationevidence) notfinalfullrun. ReducedindependentsecuritygapsunchangedNOTsecurityapproved. Controllercompletehistorycheckpoint04bundle/Librarysave next thenfreshTask5 immediately. Latestcompleted-releaseauthorization preserved, no productionactions yet.

Checkpoint04 CONFIRMEDcompletehistory8898b0f8596b71de4894971021868f70ed4bd815; Librarylibfile_16de2cb6d71881919e96eebc41a508f1 / file_00000000475481f49767317db27b4816 v0, xattrsappliedsameexec. /workspace/scratch/job-board-lifecycle-recovery-checkpoint-04.bundle. Task4productfinale67d4f4 +allapprovedrequirements/reviews/sanitizedevidence/releaseauthorization safelyoutsideexecutor. Permittedrequirements/qualityPASS/APPROVED; securityreviewgapsunchangednoapproval. FreshTask5author next BASEthisforwardIDledgercommit. Continueall13+permittedfinalreview+authorizedcompletedpublish/merge/service-scopeddeploy, applicableconfirmationexceptionsremain.
