# Full pinned review package

BASE: 03a7f8921e23726c29cb0a7e14fb36906d50b2b3

HEAD: 500aeacbd55050f7384de66291d3a4112a1f7f49

## Commits

500aeacbd55050f7384de66291d3a4112a1f7f49 docs: pin task13 fix1 handoff and scoped rereview
74808a484ba55e7061f483213d62592dced4cc18 docs: record Task13 Fix1 regression and acceptance evidence
efc4c67869d65261b80e189175b318118837566b fix: propagate admission decisions and unblock bounded archive bootstrap
78ca2657b21aa9862ff6e046935b818c9a307ea3 test: include daily catalog deferral in Task13 regression
57b4154d1040cfa07ef839b4f4810fc6cd28e51d test: specify permitted Task13 review regressions


## Files

 .../progress.md                                    |   6 +
 .../release-preflight.md                           |   4 +
 .../rulings-current.md                             |   2 +
 .../commands/task13_fix1_checks.py                 |  10 +
 .../commands/task13_fix1_green.py                  |  21 ++
 .../commands/task13_fix1_red.py                    |  10 +
 .../task-13-fix1-evidence/dashboard-green16.exit   |   1 +
 .../task-13-fix1-evidence/dashboard-green16.json   |  16 ++
 .../task-13-fix1-evidence/dashboard-green16.txt    |  25 +++
 .../task-13-fix1-evidence/dashboard-green17.exit   |   1 +
 .../task-13-fix1-evidence/dashboard-green17.json   |  16 ++
 .../task-13-fix1-evidence/dashboard-green17.txt    |  24 ++
 .../task-13-fix1-evidence/dashboard-red17.exit     |   1 +
 .../task-13-fix1-evidence/dashboard-red17.json     |  16 ++
 .../task-13-fix1-evidence/dashboard-red17.txt      |  33 +++
 .../task-13-fix1-evidence/interpreter-layout.txt   |   6 +
 .../task-13-fix1-evidence/interpreter-versions.txt |   3 +
 .../task-13-fix1-evidence/inventory.md             |  15 ++
 .../no-post-green-source-changes.txt               |   1 +
 .../task-13-fix1-evidence/python-green16.exit      |   1 +
 .../task-13-fix1-evidence/python-green16.json      |  27 +++
 .../task-13-fix1-evidence/python-green16.txt       |  24 ++
 .../task-13-fix1-evidence/python-green17.exit      |   1 +
 .../task-13-fix1-evidence/python-green17.json      |  27 +++
 .../task-13-fix1-evidence/python-green17.txt       |  24 ++
 .../task-13-fix1-evidence/python-red17.exit        |   1 +
 .../task-13-fix1-evidence/python-red17.json        |  20 ++
 .../task-13-fix1-evidence/python-red17.txt         | 245 +++++++++++++++++++++
 .../task-13-fix1-evidence/results.json             | 159 +++++++++++++
 .../task-13-fix1-evidence/ruff.exit                |   1 +
 .../task-13-fix1-evidence/ruff.json                |  10 +
 .../task-13-fix1-evidence/ruff.txt                 |   1 +
 .../task-13-fix1-evidence/sanitization.txt         |   1 +
 .../task-13-fix1-evidence/selection.json           |  10 +
 .../task-13-fix1-evidence/sha256.json              |  38 ++++
 .../task-13-fix1-evidence/source-review.txt        |   4 +
 .../task-13-fix1-evidence/source-sha256.json       |  17 ++
 .../task-13-fix1-evidence/typecheck.exit           |   1 +
 .../task-13-fix1-evidence/typecheck.json           |  10 +
 .../task-13-fix1-evidence/typecheck.txt            |   4 +
 .../task-13-fix1-report.md                         |  50 +++++
 .../task-13-fix1-reviewer-dispatch.md              |   7 +
 dashboard/lib/jobLifecycle.flow.db.test.ts         |   4 +-
 docs/runbooks/job-lifecycle-outbox.md              |   4 +-
 job_discovery/lifecycle/reconcile.py               |  16 +-
 job_discovery/lifecycle/source_worker.py           |   7 +-
 job_discovery/run.py                               |  19 +-
 migrations/2026-10-07-09-lifecycle-readiness.sql   |   2 -
 schema.sql                                         |   2 -
 tests/test_lifecycle_end_to_end.py                 |  52 ++++-
 tests/test_lifecycle_task13_fix1.py                |  70 ++++++
 tools/lifecycle_test_selection.json                |   1 +
 tools/run_lifecycle_acceptance.py                  |   5 +
 53 files changed, 1044 insertions(+), 32 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
index 2b40626..a710b3e 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/progress.md
@@ -461,10 +461,16 @@ Task13 CURRENT-source-unaccepted recoveryce256702f85b5e42fecb99002d7c2f36f009e40
 
 Task13 CURRENTce256 fullselected17GREEN381pass0skip148.36s pytest164.968s harness/exit0, sameexplicitallowlist/no productdeadline/enforcement/sourcechanges. Readonlysamplerobserved~682–1071files/~164–566zero during source/E2E (olderunmodified16>22688/22143zero), observedhousekeepingeffect/notprodcause-sizingproof. SAMEauthor current16same381sequentialRUNNING; exactfinalreport/evidencehashes/commitDOnepending. Rootaccepted12Library983f296f/currentce256unacceptedcompleteLibrary72a32736 preserve; no interimfinal/productionactivation/releaseclaim. Nextfreshpermitted13review→checkpoint→finalreview/release.
 
 Task13 CURRENTce256 fullselectedGREEN BOTHmajors same381nodes/no skips/exit0:17.11 148.36s pytest164.968harness;16.15 190.95s pytest208.628harness. No sourcechangesafterGREEN. Readonlyownedresetfiles~700–1100/~164–570zero vsold16reached36654/36126zero, observedtesthousekeepingeffect/notprodguarantee. SAMEauthor finishingreport/evidence-onlyhashpin commit then DONE/STOP; rootFULLreport/actualevidence/hashread+freshpermitted13reviewnext. Currentunaccepted Library72a32736/ce256preserved, accepted12Library983f296f remainslastaccepted. All13/finalreview/authorizedcompleteddeployment/liveverificationcontinue; no interimfinal.
 
 Task13 authorDONE/STOP sourcece256702f85b5e42fecb99002d7c2f36f009e405/reporteca7f6c438a29cc3ae93b615b7cad236453a2ad9/product2858d42. RootFULLreport/checklist/exclusions/actualresultsread; current381EACH17/16 summaries/exits/1717+2PDFskip/owned13EACH/billing23/browser17/build/type/lint9/Ruff verified fromsavedoutputs. All31SOURCE-PINce256hashesmatch (30current source/test/runbook/workflowbytes plus1recordedpre-executioninventory laterexpandedasfinalevidence); all110currentevidencehashesmatch. Rootfirstcurrentworkspacehashcheckcorrectlyidentifiedexpandedmetadata-only inventory, thencheckedpinnedsourcece256; not productdrift/testfailure. Combined4child112779264RSSmetricexcludessupervisor/pytest/PG/inactivefakereviewer/fullarchiveworker/sustainedsourceworkload peractualchecklist, no cost/prodclaim. CompleteTask13BASE..actualcontrollerHEADpackage/freshpermittedrequirementsqualityreviewnext; all13/finalreview/completedreleasecontinue.
 
 Task13 independent review DONE: Requirements FAIL / Code quality CHANGES_REQUIRED; 0 Critical, 3 Important, 0 Minor. Full report read by controller. R13-1 maintenance restriction lost in both source callers, R13-2 finite-backlog bootstrap/export circular prerequisite, R13-3 CI absent virtualenv. Same-author complete Fix1 dispatch and same-reviewer scoped rereview required; no omitted probes/reviews reopened.
 
 Task13 Fix1 Ruling: permit bounded baseline production interleaved with exact export acknowledgement before global baseline completion, removing only the new global-head prerequisite for enabling export while preserving validated destination, compatible writer/mapping readiness, producer activation, fixed budgets and exact acknowledgement — why: all-corpus heads plus export-off causes a finite-backlog bootstrap deadlock; completion is a rollout/cutover readiness fact, not a prerequisite to draining correctly sealed baseline batches. Keep producers quiesced until documented complete baseline/acknowledgement checks and preserve existing retirement proof rules. Cost if wrong: incomplete baseline could be mistaken for archive completeness, requiring corrected rollout sequencing and forward protocol repair; local functional evidence supplies no security, physical-capacity or production activation assurance.
+
+Task13 Fix1 Ruling: add backward-compatible keyword-only admission_allowed=True to the shared source verifier/staging; source child passes not maintenance.blocked and daily passes its combined not-over maintenance/capacity decision; false skips metadata admission while exact feed membership and existing-identity verification/reconciliation continue — why: newly composed caller otherwise ignores the actual pre-admission decision; total verification shutdown would lose permitted closure progress. Preserve existing bool reconciliation APIs and accepted operational/physical contracts. Cost if wrong: overly conservative staging can delay metadata/version refresh, or incomplete caller propagation can admit unintended growth; targeted ordinary caller regressions and forward repair required, with no independent physical/security assurance.
+
+Task13 Fix1 same-author regression/inventory committed BEFOREexecution57b4154/78ca265. Targeted12 ordinary Python cases planned EACH17/16, original5caller/readiness RED17; fresh /tmp layout WITHOUT.venv and independentcachedPython interpreter owned13TS EACH17/16 with pre-fixRED17. Includes daily novel source catalog deferral under R13-1; no old probes/budget changes. Root no Git mutation while authoractive; actualresults pending.
+
+Task13 Fix1 authorDONE/STOP sourceefc4c67869d65261b80e189175b318118837566b/report74808a484ba55e7061f483213d62592dced4cc18. Root FULLreport read, saved actualexits/summaryverified: targeted12PythonEACH17/16, freshno.venv owned13TSEACH17/16, Ruff/type0; RED3Pythonoriginals+realENOENT preserved. Prior381/default1717/browser/build remain prior-source phase only. CompleteFixBASE03a7f89..actualHEAD package then SAMEoriginalreviewer scoped originals/fixintroducedImportantCritical, no acceptance13yet.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
index 16dc219..8127d4d 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/release-preflight.md
@@ -55,10 +55,14 @@ READY/production, metadata githubCommitSha a8c4b82d95b35c0259600c19c1506faae807c
 Domains include jobs.andrewmalvani.com and job-board-dashboard-mu.vercel.app.
 get_deployment(withGitRepoInfo=true) returned commit via meta; gitSource was absent,
 so no assertion about a gitSource field. This is baseline state only; recheck
 new exact commit and deployed domains after completed release.
 
 Additional read-only release preflight: Railway whoami succeeded for BOTH configured links, exposing only sanitized actorID; both resolve same actor f9a98432-9fa9-4a45-96e0-384633f9667d and priorlistprojects showed same intendedproject. They are duplicate connections to the same account, not evidenceof distinctaccount ambiguity; futurewrites stillverifyexacttarget/link. No profileemail/name/credentialsprinted/saved. Currenttooldeclaration connect_service_source: livechange ALWAYSappliesallsourcenvironments; environmentIdonlyvalidstaged; commitShapin stopsbranchfollowinguntilreconnectedwithoutpin. Therefore not a safe implicitproduction-only deployfallback; preserve existingGitmainautodeploy workflow and unrelateddiscoverystagedpatch, no live sourcechange/no broadaccept. Redeployreusesoldbuild anddoesnotproveexactnewcommit. No writesperformed.
 
 Release readonly remote recheck duringTask10: git ls-remote origin refs/heads/main confirmed a8c4b82d95b35c0259600c19c1506faae807c3fc (matches preserved sourcebaseline); gh repo view GraphQL returned HTTPForbidden, exit1. No write/publish attempted. ExistingGitremote remains readable; finalremote exactSHA recheck required. Do not infer GitHub API write capability from shellauth.
 
 Connected GitHub app harmless get_repo succeeded isErrorfalse for manwithaplandy/job-board/id1278568393: main/public/notarchived; permissions push+admin/maintain/pull true, mergecommit/squash allowed, auto_mergefalse. No write occurred. Existing explicit completedrelease authorization remains; connector capabilities/read success resolve later PR/merge route despite shellGraphQLForbidden, notproofanywriteexecuted. Neverrebase/rewriteexistinghistory. Actual permittedCIinventory must land13 beforepublication.
+
+## Continuation read-only migration ledger check
+
+Production Supabase fdhspmavadgucktetzoi read-only query `SELECT filename FROM public.schema_migrations WHERE filename LIKE '2026-10-%' ORDER BY filename` returned only 2026-10-02-feedback.sql and 2026-10-02-matching-activity.sql. No lifecycle migration ledger entries are present. This checks recorded ledger, not every catalog definition; reconcile exact current schema before any deployment-dependent migration. No DDL/DML performed. Dependent main code must not auto-deploy before required reviewed migration prerequisite is handled. No activation/retirement/destination/IAM authorization inferred.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
index 3f00854..5fbfb0e 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/rulings-current.md
@@ -80,10 +80,12 @@ Task13 Ruling: add only missing clean-schema schema_migrations ledger entries202
 
 Task13 Ruling: move existing cancelOtherActiveSubscriptions helper unchanged from Next stripewebhook route into focused separate billingmodule and update existing unit-test import, leaving only validrouteexports — why: offlineNextcompile succeeds but routevalidation rejects the preexisting helperexport, blocking completed build/publication. Preserve billingbehavior/types/calls; no liveStripe/paid/network or unrelatedrefactor; affectedexistinghelpertests+offlinebuild required. Cost if wrong: movedmodule/import or packaging can regress billing webhook behavior and require localforwardfix; mockedunit/offlinebuild supply no livebilling assurance. Soleauthorraised concrete unrelatedbuildblocker beforeedit; minimal ordinarycompatibilityfix authorized.
 
 Task13 Ruling: extract unchanged TierCard/slotLabel from Next app/billing/page.tsx into components/billing/TierCard.tsx, preserve exact currentpricing/modelcopy/props/render/handlers/server-clientboundary and update existing testimport — why: after the minimal stripehelperfix, offlineNextbuild reveals another inheritedinvalid pageexport, blocking build; authorinventoryfound noother invalidnamedpage-route-layoutexports. Existingaffectedcomponentcases+offlinebuild/actualReactchecklist required; no pricing/checkout/businessrefactor/livebilling change. Cost if wrong: component import/boundary/packaging can regress billing rendering/interaction and require localforwardfix; mocks/offlinebuild not livebillingassurance. Countcorrection: actual priorstripehelperphase21pass (route17+dedupe4), existingTierCard2parameterizedcases, notauthorinitial24/3 estimates; exactlogs governfinalreport. Soleauthorraised concretebuildblocker beforeedit; same minimalordinarycompatibilityscope authorized.
 
 Task13 Ruling: permit conditional test-only CHECKPOINT immediately after owned disposable clean-schema reset/reapplication if sanitized normalquery/wait and reset-file observations support obsoleteDROP/CREATE fixture-file accumulation; revalidate ownedtarget/marker, then unchangedordinaryaction — why: completed381selection17 has380pass/1newE2Efailure at existing5s reserve_capacity read-onlysize/heldSUM query, and tests need faithful clean fixture isolation rather than deadline/enforcement changes. Preserve5sstatement/2slock deadlines/actualallocatedsize/allheldsemantics/no mockedallocation/DELETEcredit/guardrelaxation; no productionCHECKPOINT or omittedphysical/adversarial probes. Focused unchangedE2E then same381selected17/16, retain failure/runtime/causaluncertainty. Cost if wrong: fixturehousekeeping can conceal an actual workload-dependent production latency issue or add testruntime, requiring corrected diagnosis/runbook; successful fresh-fixture behavior would not prove production physical/capacity/performance assurance. Authorrequestednarrowfixturehousekeeping BEFOREedit; rootconditionalordinarytest-isolation approval, not oldmechanism review.
 
 Task13 Ruling: extend only isolated_database test-harness path to forward immutable ownedDockercontainerID/invocationlabel marker; housekeeping helper validates exact ID/label/random127.0.0.1publishedport against currentfixtureconnection, commitscleanreset/CHECKPOINTautocommit/restoresmodefinally — why: existingvalidate_test_connection verifies targetshapeonly andcannot satisfy previousexplicit ownedmarker prerequisite. Existing-service path receives no marker/neverCHECKPOINT; inspectonlysafeID/label/port metadata/noenvironmentsecrets. No productconfig/guard/normaldeadline/actualallocation changes or oldownership/crossuser/security/adversarialprobe. Supporting ownedfilecounts3403/2902zero→6120/5610zero in10s/noactivewaitevent supportreset-churnhypothesis butnotcausalproofalone; actualhousekeeping/E2E/same38117/16 evidence required. Cost if wrong: mistaken ownerplumbing could affect an unrelated localfixture or breakCI/cleanup and needharnessrework; test-onlychecks are not newproduction/securityassurance. Authorreported exactownershipinterfacebeforeedit; approvednarrowhousekeeping-only extension.
 
 Task13 Fix1 Ruling: permit bounded baseline production interleaved with exact export acknowledgement before global baseline completion, removing only the new global-head prerequisite for enabling export while preserving validated destination, compatible writer/mapping readiness, producer activation, fixed budgets and exact acknowledgement — why: all-corpus heads plus export-off causes a finite-backlog bootstrap deadlock; completion is a rollout/cutover readiness fact, not a prerequisite to draining correctly sealed baseline batches. Keep producers quiesced until documented complete baseline/acknowledgement checks and preserve existing retirement proof rules. Cost if wrong: incomplete baseline could be mistaken for archive completeness, requiring corrected rollout sequencing and forward protocol repair; local functional evidence supplies no security, physical-capacity or production activation assurance.
+
+Task13 Fix1 Ruling: add backward-compatible keyword-only admission_allowed=True to the shared source verifier/staging; source child passes not maintenance.blocked and daily passes its combined not-over maintenance/capacity decision; false skips metadata admission while exact feed membership and existing-identity verification/reconciliation continue — why: newly composed caller otherwise ignores the actual pre-admission decision; total verification shutdown would lose permitted closure progress. Preserve existing bool reconciliation APIs and accepted operational/physical contracts. Cost if wrong: overly conservative staging can delay metadata/version refresh, or incomplete caller propagation can admit unintended growth; targeted ordinary caller regressions and forward repair required, with no independent physical/security assurance.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_checks.py b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_checks.py
new file mode 100644
index 0000000..b022992
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_checks.py
@@ -0,0 +1,10 @@
+import subprocess,time,json,os
+from pathlib import Path
+root=Path.cwd();ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence'
+env={k:v for k,v in os.environ.items() if k in {'PATH','HOME','LANG','USER','TMPDIR'}}
+env.update(DATABASE_URL='postgresql://test:test@127.0.0.1:1/test',NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY='test',OPENAI_API_KEY='test-disabled',NEXT_TELEMETRY_DISABLED='1')
+for name,cwd,cmd in [('ruff',root,[str(root/'.venv/bin/ruff'),'check','.']),('typecheck',root/'dashboard',['npm','run','typecheck'])]:
+ start=time.monotonic()
+ with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
+ (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
+ record=dict(name=name,command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3));(ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_green.py b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_green.py
new file mode 100644
index 0000000..3834399
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_green.py
@@ -0,0 +1,21 @@
+import subprocess,time,json,shutil
+from pathlib import Path
+root=Path('/workspace/job-board/.claude/worktrees/lifecycle-recovery');ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence';layout=Path('/tmp/task13-fix1-layout')
+for name in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines():
+ if name.startswith(('.superpowers/','.claude/')):continue
+ p=root/name
+ if not p.is_file():continue
+ target=layout/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
+assert not (layout/'.venv').exists()
+selection=json.loads((ev/'selection.json').read_text())
+commands=[]
+for major in (17,16):
+ commands.append((f'python-green{major}',root,[str(root/'.venv/bin/python'),'tools/lifecycle_test_db.py','--postgres-major',str(major),'--',str(root/'.venv/bin/python'),'-m','pytest',*selection,'-vv','-ra','-s']))
+ commands.append((f'dashboard-green{major}',layout,['/tmp/task13-fix1-python/bin/python','tools/lifecycle_test_db.py','--postgres-major',str(major),'--','/tmp/task13-fix1-python/bin/python','tools/run_lifecycle_acceptance.py','dashboard']))
+for name,cwd,cmd in commands:
+ start=time.monotonic()
+ with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
+ (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
+ record=dict(name=name,cwd=str(cwd),command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3))
+ (ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
+ if r.returncode:break
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_red.py b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_red.py
new file mode 100644
index 0000000..4fcb559
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/commands/task13_fix1_red.py
@@ -0,0 +1,10 @@
+import subprocess,time,json
+from pathlib import Path
+root=Path('/workspace/job-board/.claude/worktrees/lifecycle-recovery');ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence'
+commands=[('python-red17',root,[str(root/'.venv/bin/python'),'tools/lifecycle_test_db.py','--postgres-major','17','--',str(root/'.venv/bin/python'),'-m','pytest','tests/test_lifecycle_task13_fix1.py','tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api','-vv','-ra']),('dashboard-red17',Path('/tmp/task13-fix1-layout'),['/tmp/task13-fix1-python/bin/python','tools/lifecycle_test_db.py','--postgres-major','17','--','/tmp/task13-fix1-python/bin/python','tools/run_lifecycle_acceptance.py','dashboard'])]
+for name,cwd,cmd in commands:
+ start=time.monotonic()
+ with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
+ (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
+ record=dict(name=name,cwd=str(cwd),command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3))
+ (ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.json
new file mode 100644
index 0000000..1ef407e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.json
@@ -0,0 +1,16 @@
+{
+  "name": "dashboard-green16",
+  "cwd": "/tmp/task13-fix1-layout",
+  "command": [
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "16",
+    "--",
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/run_lifecycle_acceptance.py",
+    "dashboard"
+  ],
+  "exit": 0,
+  "seconds": 15.369
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.txt
new file mode 100644
index 0000000..e0ba785
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green16.txt
@@ -0,0 +1,25 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+Owned dashboard Python: /tmp/task13-fix1-python/bin/python
+
+ RUN  v4.1.9 /tmp/task13-fix1-layout/dashboard
+
+ ✓ lib/jobLifecycle.flow.db.test.ts (7 tests) 2376ms
+   ✓ package persistence copies pinned input and records consumption with the artifact  506ms
+   ✓ instruction-only and application marker rows acquire their genuine first input and output  657ms
+
+ Test Files  1 passed (1)
+      Tests  7 passed (7)
+   Start at  09:51:26
+   Duration  2.96s (transform 457ms, setup 0ms, import 313ms, tests 2.38s, environment 0ms)
+
+
+ RUN  v4.1.9 /tmp/task13-fix1-layout/dashboard
+
+ ✓ lib/jobLifecycleConsumers.db.test.ts (6 tests) 1597ms
+   ✓ actual server paging DTO keeps private history independent of discovery location preferences  391ms
+
+ Test Files  1 passed (1)
+      Tests  6 passed (6)
+   Start at  09:51:29
+   Duration  2.17s (transform 364ms, setup 0ms, import 288ms, tests 1.60s, environment 0ms)
+
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.json
new file mode 100644
index 0000000..b7d1172
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.json
@@ -0,0 +1,16 @@
+{
+  "name": "dashboard-green17",
+  "cwd": "/tmp/task13-fix1-layout",
+  "command": [
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "17",
+    "--",
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/run_lifecycle_acceptance.py",
+    "dashboard"
+  ],
+  "exit": 0,
+  "seconds": 22.201
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.txt
new file mode 100644
index 0000000..df97872
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-green17.txt
@@ -0,0 +1,24 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+Owned dashboard Python: /tmp/task13-fix1-python/bin/python
+
+ RUN  v4.1.9 /tmp/task13-fix1-layout/dashboard
+
+ ✓ lib/jobLifecycle.flow.db.test.ts (7 tests) 2267ms
+   ✓ package persistence copies pinned input and records consumption with the artifact  554ms
+   ✓ instruction-only and application marker rows acquire their genuine first input and output  523ms
+
+ Test Files  1 passed (1)
+      Tests  7 passed (7)
+   Start at  09:50:21
+   Duration  2.74s (transform 397ms, setup 0ms, import 171ms, tests 2.27s, environment 0ms)
+
+
+ RUN  v4.1.9 /tmp/task13-fix1-layout/dashboard
+
+ ✓ lib/jobLifecycleConsumers.db.test.ts (6 tests) 926ms
+
+ Test Files  1 passed (1)
+      Tests  6 passed (6)
+   Start at  09:50:24
+   Duration  1.33s (transform 255ms, setup 0ms, import 169ms, tests 926ms, environment 0ms)
+
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.json
new file mode 100644
index 0000000..c082eba
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.json
@@ -0,0 +1,16 @@
+{
+  "name": "dashboard-red17",
+  "cwd": "/tmp/task13-fix1-layout",
+  "command": [
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "17",
+    "--",
+    "/tmp/task13-fix1-python/bin/python",
+    "tools/run_lifecycle_acceptance.py",
+    "dashboard"
+  ],
+  "exit": 1,
+  "seconds": 11.635
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.txt
new file mode 100644
index 0000000..e109939
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/dashboard-red17.txt
@@ -0,0 +1,33 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /tmp/task13-fix1-layout/dashboard
+
+ ❯ lib/jobLifecycle.flow.db.test.ts (7 tests | 1 failed) 1057ms
+   ✓ owner demand coalesces, ready pins a durable input, generation copies it and consumption follows success 123ms
+   ✓ flag-off missing Greenhouse questions queues service work and accepts its exact ready snapshot 20ms
+   ✓ package persistence copies pinned input and records consumption with the artifact 274ms
+   ✓ résumé-first preparation queues missing Q, pins the saved tuple, and consumes its exact receipt 96ms
+   ✓ calibration SQL reads saved score/edit JD and explicitly falls back for legacy NULL 15ms
+   × instruction-only and application marker rows acquire their genuine first input and output 51ms
+   ✓ new payload wrapper preserves authenticated invoking role in an ordinary enforced write 38ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycle.flow.db.test.ts > instruction-only and application marker rows acquire their genuine first input and output
+Error: spawnSync /tmp/task13-fix1-layout/.venv/bin/python ENOENT
+ ❯ lib/jobLifecycle.flow.db.test.ts:177:3
+    175|   // Execute the actual Python service worker against this same owned …
+    176|   // Only its public fetch boundary is replaced, with an outside-TX as…
+    177|   execFileSync(resolve(process.cwd(),"../.venv/bin/python"), ["-c", `
+       |   ^
+    178| import os, psycopg
+    179| from psycopg.rows import dict_row
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 6 passed (7)
+   Start at  09:47:44
+   Duration  1.45s (transform 273ms, setup 0ms, import 160ms, tests 1.06s, environment 0ms)
+
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-layout.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-layout.txt
new file mode 100644
index 0000000..02bf087
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-layout.txt
@@ -0,0 +1,6 @@
+Independent interpreter: /tmp/task13-fix1-python/bin/python
+Fresh source layout: /tmp/task13-fix1-layout
+Repository-local .venv exists: False
+Node modules symlink: /workspace/job-board/dashboard/node_modules
+Offline setup: initial default uv cache was read-only; redirected to /workspace/.cache/uv. Full requirements offline resolution lacked boto3 in that cache; no download attempted. Installed only the real worker imports needed by the selected TS hydration case with uv --cache-dir /workspace/.cache/uv pip install --offline --python /tmp/task13-fix1-python/bin/python psycopg[binary] requests httpx.
+No source/test/harness weakening or shared virtualenv mutation. Local Node24 differs from CI Node22; no GitHub CI run is claimed.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-versions.txt
new file mode 100644
index 0000000..7ad27f3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/interpreter-versions.txt
@@ -0,0 +1,3 @@
+3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
+/tmp/task13-fix1-python/bin/python
+psycopg 3.3.6 requests 2.34.2 httpx 0.28.1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/inventory.md
new file mode 100644
index 0000000..9f8e8eb
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/inventory.md
@@ -0,0 +1,15 @@
+# Task13 Fix1 pre-execution scope
+
+BASE/controller dispatch: 03a7f89. Read full independent requirements review and Fix1 dispatch before edits. All three Important originals addressed in one same-author pass. No helper agents.
+
+R13-1: new ordinary caller fixture has real daily/source worker, actual shared verifier with fake HTTP, maintenance SweepResult blocked/allowed, one novel posting, an existing closed identity reopening and another existing identity getting one complete miss. Check durable membership, counts, versions and daily accounting. No physical guard challenge. Add backward-compatible keyword-only admission_allowed=True to shared verifier/staging under controller ruling; both callers propagate actual maintenance/combined decision.
+
+R13-2: only remove new full-baseline export-enable prerequisite in09/schema; preserve completion predicate and every other prerequisite. Existing positive readiness/control test now enables export after a single baseline page, then interleaves one-row pages and normal export_once/fake-S3 exact ACK with max_events=1 flush threshold (smaller fixture, no backlog budget change). All compatible-writer/destination/mapping claim/CAS prerequisites remain explicit. Preserve pause/resume pending-history assertion.
+
+R13-3: installed runner interpreter flows through test-only LIFECYCLE_TEST_PYTHON; strict DB guards and genuine hydration assertion unchanged. Fresh /tmp source layout without .venv and independent /tmp Python environment; dashboard dependencies may be symlinked to installed node_modules. Run exact two existing owned files sequentially through acceptance runner, on17/16. Before repair, use the same fresh-layout17 lane to capture hardcoded missing-executable failure. No broad default Vitest.
+
+Read exact selected bodies and helpers before execution. selection.json names the eight selectors expanding to12 ordinary Python cases: four caller cases, order, readiness, six-family composition, actual admission, two scheduler variants, two ordinary catalog/reapplication nodes. RED only new four caller cases and changed readiness positive node on17. GREEN full selection on17/16. Catalog siblings remain unselected. Ruff and TS typecheck relevant. No full381/default1717/browser/build rerun intended; prior results remain prior-source evidence.
+
+Automatic CI retains existing explicit allowlist and adds only the new four-case ordinary file. Default/owned separation and all exclusions remain. No omitted expiry-enforcement, physical-capacity, cross-user or adversarial probe/review; no production/provider/cloud/release action.
+
+Controller caller-context clarification: blocked daily runs also defer sync_source_accounts novel catalog registration. Same four-case regression includes an inactive unknown company, ensuring allowed registration remains unpolled and blocked registration is absent. No physical guard challenge.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/no-post-green-source-changes.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/no-post-green-source-changes.txt
new file mode 100644
index 0000000..2b6649c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/no-post-green-source-changes.txt
@@ -0,0 +1 @@
+All 11 source/test/runbook/selection paths still match efc4c67869d65261b80e189175b318118837566b after all four successful owned lanes. Fresh-layout source paths also match. No post-GREEN product/test/harness edits.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.json
new file mode 100644
index 0000000..ea79b0a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.json
@@ -0,0 +1,27 @@
+{
+  "name": "python-green16",
+  "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+  "command": [
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "16",
+    "--",
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "-m",
+    "pytest",
+    "tests/test_lifecycle_task13_fix1.py",
+    "tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification",
+    "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+    "tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition",
+    "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
+    "tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget",
+    "tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations",
+    "tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift",
+    "-vv",
+    "-ra",
+    "-s"
+  ],
+  "exit": 0,
+  "seconds": 50.537
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.txt
new file mode 100644
index 0000000..4d2d026
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green16.txt
@@ -0,0 +1,24 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+============================= test session starts ==============================
+platform linux -- Python 3.12.14, pytest-9.1.1, pluggy-1.6.0 -- /workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python
+cachedir: .pytest_cache
+rootdir: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+configfile: pyproject.toml
+plugins: anyio-4.15.1
+collecting ... collected 12 items
+
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-source_worker] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-daily] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-source_worker] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-daily] PASSED
+tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification PASSED
+tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api PASSED
+tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition TASK13_METRICS {"seconds": 13.9, "jobs": 12, "retired_rows": 5, "retired_bytes": 80, "job_row_bytes": 1741, "database_allocated_bytes": 39255063, "canonical_event_bytes": 6340, "compressed_event_bytes": 923, "manifest_bytes": 2671, "pending": {"events": 0, "bytes": 0, "live_bytes": 0, "age_seconds": "0", "warning": false, "ordinary_paused": false}}
+PASSED
+tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings PASSED
+tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget[requests] PASSED
+tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget[time] PASSED
+tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations PASSED
+tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift PASSED
+
+============================= 12 passed in 38.50s ==============================
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.json
new file mode 100644
index 0000000..c10e0c2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.json
@@ -0,0 +1,27 @@
+{
+  "name": "python-green17",
+  "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+  "command": [
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "17",
+    "--",
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "-m",
+    "pytest",
+    "tests/test_lifecycle_task13_fix1.py",
+    "tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification",
+    "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+    "tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition",
+    "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
+    "tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget",
+    "tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations",
+    "tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift",
+    "-vv",
+    "-ra",
+    "-s"
+  ],
+  "exit": 0,
+  "seconds": 58.888
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.txt
new file mode 100644
index 0000000..afe372f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-green17.txt
@@ -0,0 +1,24 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+============================= test session starts ==============================
+platform linux -- Python 3.12.14, pytest-9.1.1, pluggy-1.6.0 -- /workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python
+cachedir: .pytest_cache
+rootdir: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+configfile: pyproject.toml
+plugins: anyio-4.15.1
+collecting ... collected 12 items
+
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-source_worker] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-daily] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-source_worker] PASSED
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-daily] PASSED
+tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification PASSED
+tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api PASSED
+tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition TASK13_METRICS {"seconds": 23.3, "jobs": 12, "retired_rows": 5, "retired_bytes": 80, "job_row_bytes": 1744, "database_allocated_bytes": 39207439, "canonical_event_bytes": 6340, "compressed_event_bytes": 923, "manifest_bytes": 2671, "pending": {"events": 0, "bytes": 0, "live_bytes": 0, "age_seconds": "0", "warning": false, "ordinary_paused": false}}
+PASSED
+tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings PASSED
+tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget[requests] PASSED
+tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget[time] PASSED
+tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations PASSED
+tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift PASSED
+
+============================= 12 passed in 46.87s ==============================
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.exit
new file mode 100644
index 0000000..d00491f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.exit
@@ -0,0 +1 @@
+1
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.json
new file mode 100644
index 0000000..c5c44cf
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.json
@@ -0,0 +1,20 @@
+{
+  "name": "python-red17",
+  "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+  "command": [
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "tools/lifecycle_test_db.py",
+    "--postgres-major",
+    "17",
+    "--",
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+    "-m",
+    "pytest",
+    "tests/test_lifecycle_task13_fix1.py",
+    "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+    "-vv",
+    "-ra"
+  ],
+  "exit": 1,
+  "seconds": 16.417
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.txt
new file mode 100644
index 0000000..d8db07a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/python-red17.txt
@@ -0,0 +1,245 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+============================= test session starts ==============================
+platform linux -- Python 3.12.14, pytest-9.1.1, pluggy-1.6.0 -- /workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python
+cachedir: .pytest_cache
+rootdir: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+configfile: pyproject.toml
+plugins: anyio-4.15.1
+collecting ... collected 5 items
+
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-source_worker] FAILED [ 20%]
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-daily] FAILED [ 40%]
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-source_worker] PASSED [ 60%]
+tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[False-daily] PASSED [ 80%]
+tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api FAILED [100%]
+
+=================================== FAILURES ===================================
+_ test_maintenance_result_defers_admission_but_commits_source_progress[True-source_worker] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33115 user=postgres database=poller_lifecycle_test) at 0x7f463ac091c0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f463ac09280>
+caller = 'source_worker', blocked = True
+
+    @requires_db
+    @pytest.mark.parametrize("caller", ["source_worker", "daily"])
+    @pytest.mark.parametrize("blocked", [True, False])
+    def test_maintenance_result_defers_admission_but_commits_source_progress(
+        conn, monkeypatch, caller, blocked
+    ):
+        source = setup_source(conn, count=2)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        before = conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"]
+        conn.commit()
+        # Inactive unknown company is a catalog candidate, but is not a due board.
+        if caller == "daily":
+            conn.execute("INSERT INTO companies(name,ats,token,active) VALUES('Unregistered','lever','unregistered',false)")
+            conn.commit()
+        calls = []
+    
+        def maintenance(dsn):
+            assert dsn == TEST_DSN
+            calls.append("maintenance")
+            return SweepResult(0, 0, blocked, None)
+    
+        def feed(url, **kwargs):
+            assert calls == ["maintenance"]
+            calls.append("feed")
+            return [
+                {"id": "0", "text": "Changed title", "hostedUrl": "https://example.test/0"},
+                {"id": "novel", "text": "Novel role", "hostedUrl": "https://example.test/novel"},
+            ]
+    
+        monkeypatch.setattr(http, "get_json", feed)
+        target = source_worker if caller == "source_worker" else daily
+        monkeypatch.setattr(target, "pre_admission_maintenance", maintenance)
+        if caller == "daily":
+            monkeypatch.setattr(daily, "load_targets", lambda: [])
+            result = daily.run(TEST_DSN)
+        else:
+            result = source_worker.run_source_once(TEST_DSN)
+    
+        assert calls == ["maintenance", "feed"]
+        assert result["ok"] == 1 and result["failed"] == 0
+>       assert result["new_jobs"] == int(not blocked) and result["closed_jobs"] == 0
+E       assert (1 == 0)
+E        +  where 0 = int(not True)
+
+tests/test_lifecycle_task13_fix1.py:52: AssertionError
+_ test_maintenance_result_defers_admission_but_commits_source_progress[True-daily] _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33115 user=postgres database=poller_lifecycle_test) at 0x7f463ac36120>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f463ac36a20>
+caller = 'daily', blocked = True
+
+    @requires_db
+    @pytest.mark.parametrize("caller", ["source_worker", "daily"])
+    @pytest.mark.parametrize("blocked", [True, False])
+    def test_maintenance_result_defers_admission_but_commits_source_progress(
+        conn, monkeypatch, caller, blocked
+    ):
+        source = setup_source(conn, count=2)
+        conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+        before = conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"]
+        conn.commit()
+        # Inactive unknown company is a catalog candidate, but is not a due board.
+        if caller == "daily":
+            conn.execute("INSERT INTO companies(name,ats,token,active) VALUES('Unregistered','lever','unregistered',false)")
+            conn.commit()
+        calls = []
+    
+        def maintenance(dsn):
+            assert dsn == TEST_DSN
+            calls.append("maintenance")
+            return SweepResult(0, 0, blocked, None)
+    
+        def feed(url, **kwargs):
+            assert calls == ["maintenance"]
+            calls.append("feed")
+            return [
+                {"id": "0", "text": "Changed title", "hostedUrl": "https://example.test/0"},
+                {"id": "novel", "text": "Novel role", "hostedUrl": "https://example.test/novel"},
+            ]
+    
+        monkeypatch.setattr(http, "get_json", feed)
+        target = source_worker if caller == "source_worker" else daily
+        monkeypatch.setattr(target, "pre_admission_maintenance", maintenance)
+        if caller == "daily":
+            monkeypatch.setattr(daily, "load_targets", lambda: [])
+            result = daily.run(TEST_DSN)
+        else:
+            result = source_worker.run_source_once(TEST_DSN)
+    
+        assert calls == ["maintenance", "feed"]
+        assert result["ok"] == 1 and result["failed"] == 0
+>       assert result["new_jobs"] == int(not blocked) and result["closed_jobs"] == 0
+E       assert (1 == 0)
+E        +  where 0 = int(not True)
+
+tests/test_lifecycle_task13_fix1.py:52: AssertionError
+------------------------------ Captured log call -------------------------------
+WARNING  job_discovery:run.py:140 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
+_______ test_explicit_readiness_transitions_through_existing_control_api _______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33115 user=postgres database=poller_lifecycle_test) at 0x7f463ac37e30>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f463ac37e90>
+
+    @requires_db
+    def test_explicit_readiness_transitions_through_existing_control_api(conn, monkeypatch):
+        """New positive readiness integration, not the omitted activation probe suite.
+    
+        Service attestations below are local fixture evidence only. No production
+        readiness, permission, destination ownership or runtime compatibility is inferred.
+        """
+        from job_discovery.lifecycle.config import read_control, transition_control
+        from job_discovery.lifecycle.readiness import COMPONENTS, verify_backfill_batch
+        from job_discovery.archive.outbox import baseline_batch
+        from job_discovery.archive.schema import AggregateType
+    
+        setup_source(conn)
+        conn.execute(
+            "UPDATE lifecycle_control SET identity_enabled=true,maintenance_enabled=true,hydration_enabled=true,safety_stage='collect',activation_generation=activation_generation+1"
+        )
+        # One actual bounded mapping pass has already run in setup_source.
+        revision = "a" * 40
+        for component in COMPONENTS:
+            conn.execute(
+                """INSERT INTO lifecycle_writer_readiness(writer,contract_version,source_revision,validated_at,notes)
+              VALUES(%s,1,%s,clock_timestamp(),'explicit local fixture attestation, not production approval')
+              ON CONFLICT(writer) DO UPDATE SET source_revision=EXCLUDED.source_revision,
+               validated_at=EXCLUDED.validated_at,notes=EXCLUDED.notes""",
+                (component, revision),
+            )
+        conn.commit()
+    
+        def certify():
+            turns = 0
+            while True:
+                turns += 1
+                done = verify_backfill_batch(conn, revision, limit=1)
+                conn.commit()
+                if done:
+                    break
+                assert turns <= 4
+            return turns
+    
+        assert certify() == 4
+        claim = claim_work(conn, "control", "singleton", 120)
+        control = read_control(conn)
+        enforced = transition_control(
+            conn,
+            control.activation_generation,
+            replace(control, safety_stage="enforced"),
+            claim,
+        )
+        conn.commit()
+        assert enforced.safety_stage == "enforced" and enforced.retirement_dry_run
+        certify()
+        conn.execute("""INSERT INTO public_archive_destination(singleton,object_prefix,validated_at,bucket,region,expected_owner,
+          private_validated,encryption_validated,policy_validated,validation_evidence)
+          VALUES(true,'fixture/public',clock_timestamp(),'fixture-bucket','us-east-1','123456789012',true,true,true,'offline fixture approval only')""")
+        active = transition_control(
+            conn,
+            enforced.activation_generation,
+            replace(enforced, archive_ever_activated=True, archive_stage="active"),
+            claim,
+        )
+        conn.commit()
+        assert active.archive_ever_activated and not active.export_enabled
+        # Deliver a bounded first page while the rest of the corpus is incomplete.
+        first = baseline_batch(conn, "jobs", claim, limit=1)
+        conn.commit()
+        assert len(first) == 1
+        assert not conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
+        conn.commit()
+        certify()
+>       exporting = transition_control(
+            conn, active.activation_generation, replace(active, export_enabled=True), claim
+        )
+
+tests/test_lifecycle_end_to_end.py:562: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/lifecycle/config.py:85: in transition_control
+    conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33115 user=postgres database=poller_lifecycle_test) at 0x7f463ac37e30>
+query = Composed([SQL('UPDATE lifecycle_control SET '), Composed([Composed([Identifier('flags_version'), SQL('=%s')]), SQL(','...('=%s')]), SQL(','), Composed([Identifier('identity_migration_activated_at'), SQL('=%s')])]), SQL(' WHERE singleton')])
+params = [1, 'enforced', True, True, True, True, ...], prepare = None
+binary = False
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
+E           psycopg.errors.RaiseException: archive export requires completed bounded baseline
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 23 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-source_worker] - assert (1 == 0)
+ +  where 0 = int(not True)
+FAILED tests/test_lifecycle_task13_fix1.py::test_maintenance_result_defers_admission_but_commits_source_progress[True-daily] - assert (1 == 0)
+ +  where 0 = int(not True)
+FAILED tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api - psycopg.errors.RaiseException: archive export requires completed bounded baseline
+CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 23 at RAISE
+========================= 3 failed, 2 passed in 5.84s ==========================
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/results.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/results.json
new file mode 100644
index 0000000..6bc927d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/results.json
@@ -0,0 +1,159 @@
+{
+  "python-red17": {
+    "name": "python-red17",
+    "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+    "command": [
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "17",
+      "--",
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "-m",
+      "pytest",
+      "tests/test_lifecycle_task13_fix1.py",
+      "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+      "-vv",
+      "-ra"
+    ],
+    "exit": 1,
+    "seconds": 16.417,
+    "pytest_summary": "3 failed, 2 passed in 5.84s"
+  },
+  "dashboard-red17": {
+    "name": "dashboard-red17",
+    "cwd": "/tmp/task13-fix1-layout",
+    "command": [
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "17",
+      "--",
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/run_lifecycle_acceptance.py",
+      "dashboard"
+    ],
+    "exit": 1,
+    "seconds": 11.635,
+    "vitest_test_summaries": [
+      "1 failed | 6 passed (7)"
+    ]
+  },
+  "python-green17": {
+    "name": "python-green17",
+    "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+    "command": [
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "17",
+      "--",
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "-m",
+      "pytest",
+      "tests/test_lifecycle_task13_fix1.py",
+      "tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification",
+      "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+      "tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition",
+      "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
+      "tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget",
+      "tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations",
+      "tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift",
+      "-vv",
+      "-ra",
+      "-s"
+    ],
+    "exit": 0,
+    "seconds": 58.888,
+    "pytest_summary": "12 passed in 46.87s"
+  },
+  "dashboard-green17": {
+    "name": "dashboard-green17",
+    "cwd": "/tmp/task13-fix1-layout",
+    "command": [
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "17",
+      "--",
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/run_lifecycle_acceptance.py",
+      "dashboard"
+    ],
+    "exit": 0,
+    "seconds": 22.201,
+    "vitest_test_summaries": [
+      "7 passed (7)",
+      "6 passed (6)"
+    ]
+  },
+  "python-green16": {
+    "name": "python-green16",
+    "cwd": "/workspace/job-board/.claude/worktrees/lifecycle-recovery",
+    "command": [
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "16",
+      "--",
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python",
+      "-m",
+      "pytest",
+      "tests/test_lifecycle_task13_fix1.py",
+      "tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification",
+      "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+      "tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition",
+      "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
+      "tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget",
+      "tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations",
+      "tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift",
+      "-vv",
+      "-ra",
+      "-s"
+    ],
+    "exit": 0,
+    "seconds": 50.537,
+    "pytest_summary": "12 passed in 38.50s"
+  },
+  "dashboard-green16": {
+    "name": "dashboard-green16",
+    "cwd": "/tmp/task13-fix1-layout",
+    "command": [
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/lifecycle_test_db.py",
+      "--postgres-major",
+      "16",
+      "--",
+      "/tmp/task13-fix1-python/bin/python",
+      "tools/run_lifecycle_acceptance.py",
+      "dashboard"
+    ],
+    "exit": 0,
+    "seconds": 15.369,
+    "vitest_test_summaries": [
+      "7 passed (7)",
+      "6 passed (6)"
+    ]
+  },
+  "ruff": {
+    "name": "ruff",
+    "command": [
+      "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/ruff",
+      "check",
+      "."
+    ],
+    "exit": 0,
+    "seconds": 0.04
+  },
+  "typecheck": {
+    "name": "typecheck",
+    "command": [
+      "npm",
+      "run",
+      "typecheck"
+    ],
+    "exit": 0,
+    "seconds": 14.387
+  },
+  "source": "efc4c67869d65261b80e189175b318118837566b"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.json
new file mode 100644
index 0000000..573bccc
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.json
@@ -0,0 +1,10 @@
+{
+  "name": "ruff",
+  "command": [
+    "/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/ruff",
+    "check",
+    "."
+  ],
+  "exit": 0,
+  "seconds": 0.04
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sanitization.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sanitization.txt
new file mode 100644
index 0000000..94b3b43
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sanitization.txt
@@ -0,0 +1 @@
+Evidence is local synthetic fixture output. No environment/credential dumps or production payloads. Secret-shape scan found only the explicit test:test@127.0.0.1:1 inert dashboard checks placeholder in its saved command script. Actual generated owned DB passwords/DSNs are not printed. No cloud/provider calls. Raw failure whitespace/ANSI output retained.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/selection.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/selection.json
new file mode 100644
index 0000000..9cb35b4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/selection.json
@@ -0,0 +1,10 @@
+[
+  "tests/test_lifecycle_task13_fix1.py",
+  "tests/test_lifecycle_end_to_end.py::test_source_worker_flag_off_and_maintenance_before_verification",
+  "tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api",
+  "tests/test_lifecycle_end_to_end.py::test_six_family_identity_demand_retirement_and_exact_archive_composition",
+  "tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings",
+  "tests/test_lifecycle_reconcile.py::test_scheduler_finite_six_cycle_bound_across_families_and_request_budget",
+  "tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations",
+  "tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift"
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sha256.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sha256.json
new file mode 100644
index 0000000..618b4b5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/sha256.json
@@ -0,0 +1,38 @@
+{
+  "commands/task13_fix1_checks.py": "7d0d99a2c014fec640b07fa7ab03c5451c4f1a0d59dd75ba1af2bba79b486c06",
+  "commands/task13_fix1_green.py": "7562abf8fabd55e17b9622157c9c2b2959b891740af7892acc443c6c7ece6923",
+  "commands/task13_fix1_red.py": "90dddfbec1f1f274e9dc2f021bd04ac25e56f7b00a5655e8dac2295bba5bdae0",
+  "dashboard-green16.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "dashboard-green16.json": "78554e52c153b7089f85f89fac29019376c78f5191ecb63ab4a55dbfdd396089",
+  "dashboard-green16.txt": "927d28b7514fe61d8bbc4de5b655be84c370f9a8f219e8f3fe125f1963b620b4",
+  "dashboard-green17.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "dashboard-green17.json": "16605cbacc10480b5ffc4fe92dcc9d3aeba8e9df5bd6156759aa9975afb8e6af",
+  "dashboard-green17.txt": "0ff062d8a8a09ed42e37145fd713d36a3f8ce2ff345748930866ef0d7aa02d73",
+  "dashboard-red17.exit": "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
+  "dashboard-red17.json": "3dcda2337367c981dfbcf5bae5d26a849860beadd285de89694c21aba0c7f37c",
+  "dashboard-red17.txt": "5cdcb7a0929932aa9fffc909d020d78964ef249eee2710f0bbed66dec31f990b",
+  "interpreter-layout.txt": "0ce2efb046df7c4f04667c7efe48a353c1a91bf22162c9e450746c050da3e592",
+  "interpreter-versions.txt": "54b67d58d44897829bb8439033a2c9efe75ad5d2502b2a9e0882646c4c4e46da",
+  "inventory.md": "d4107a7eed02569f2fb550015d12d570cec6aaa5fcc64fc55b102a71b29bd320",
+  "no-post-green-source-changes.txt": "9536cd2567ec12d620138556739f30ffdee5f32a9b82987c8ff27ad3b96d730f",
+  "python-green16.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "python-green16.json": "59ad6fb67ceac98ff0dffaeb3f9ac9ca465e5e7d822375d3d58cb073a3491415",
+  "python-green16.txt": "872d75ef6f47e7189d73fdcaa7fdb2b3e8d30443b5d73cf7e40c3ac59e1eea69",
+  "python-green17.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "python-green17.json": "ac9768be5a291883d99b9f6ec9b95cb07e69cd0acee7c6a9380e24a6338a7d79",
+  "python-green17.txt": "c41991d498ad11e846b413a77eb591f3e03c50eebb6ae0b0bcace034170420b2",
+  "python-red17.exit": "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
+  "python-red17.json": "01535295055c58f7dcd52cba8085d180eea263cf44be9bbec00a8ef27d4ebdee",
+  "python-red17.txt": "e2f0915fe1982ecdf4cf5407cd1130d09a30ec93112a4eb0ef7419b947fccd3a",
+  "results.json": "a364302007f003b07854af5c9f9c7a62e373cacd9a3c640d7290c6af15a8a166",
+  "ruff.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "ruff.json": "6bad05ddfbbc4b32589b2e667498cc79b3911cfd6ebb7f804d831cb60bb539d3",
+  "ruff.txt": "82b3e6a6c090a57601d22943bd23fca9218d1031dbe5a7b754092f9a156b4f18",
+  "sanitization.txt": "876f23abd2690b23e3091b7e41f0725a2cf9cfe5c25f2524ceefdd4b242473b8",
+  "selection.json": "1419296bfd7bbc3a2209160ba4dd9e0a2b9de2dfd5728720941c5b231a3a742a",
+  "source-review.txt": "2ec8e16c1e9d811d17c9b025661484efc3614865385c4d02f4455be3520d514a",
+  "source-sha256.json": "cfe8eb632a07896cee8c8a0e823da1b79b7f776659f23f96d3eb68f1d5cc52ad",
+  "typecheck.exit": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
+  "typecheck.json": "174df4b29e6455370c6de9d7b844213af32b6446a6588cde9e378811752c6529",
+  "typecheck.txt": "56e70c6c65874795f3a202d28d2e9313eded38feb0a47d71207ded07152c5f84"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-review.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-review.txt
new file mode 100644
index 0000000..70987fc
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-review.txt
@@ -0,0 +1,4 @@
+Compared full09 migration to controllerBASE: the only removed text is the two-line archive_baseline_ready export condition. Exact modified09 body occurs in schema.sql. Every other readiness/history/generation/role/claim/physical predicate is unchanged.
+R13-1 public boolean reconcile_chunk APIs untouched; both stage_postings sites receive the backward-compatible keyword. Existing _write/commit ordering/operational fallback unmodified. Daily catalog sync skips only when its combined over decision blocks admission.
+R13-3 DSN target guard text and real Python hydration body unchanged; runner selects sys.executable explicitly and passes it in subprocess environment.
+Author self-review only, no omitted independent mechanism review.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-sha256.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-sha256.json
new file mode 100644
index 0000000..b4f087f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/source-sha256.json
@@ -0,0 +1,17 @@
+{
+  "base": "03a7f8921e23726c29cb0a7e14fb36906d50b2b3",
+  "source": "efc4c67869d65261b80e189175b318118837566b",
+  "files": {
+    "dashboard/lib/jobLifecycle.flow.db.test.ts": "c585b3f9a5810b7292217e3bd22e4e5f392779b32cd5d808a9c7adc17b4abbd8",
+    "docs/runbooks/job-lifecycle-outbox.md": "f06c0ecd9c61c05ced3d8313d8454ca0322da7c32cdfd851be35a4348628f431",
+    "job_discovery/lifecycle/reconcile.py": "2ff740dd4bf445406e00845aca55fa4172b3d2410d273265d79f1b680cbfc3ac",
+    "job_discovery/lifecycle/source_worker.py": "96440298bb3b34c18befabf2fd5681a34df19bc3dac61cc2de4abad31357a723",
+    "job_discovery/run.py": "a41bb323abc16274f565c2d62666c4fc5912881f05191358f40072f23aa9353f",
+    "migrations/2026-10-07-09-lifecycle-readiness.sql": "5608e9931b1fad743c0643fb6dc7e71268bab4ca49ef1ea505b62763d91208e0",
+    "schema.sql": "4b3f287ce4382245a949248ff646ef5c91a6111dff84b346365fa233cb79f532",
+    "tests/test_lifecycle_end_to_end.py": "a6d3a739fc99a88bd2927225aa35b77188505dee8b67d2eec9193b8906078c5c",
+    "tests/test_lifecycle_task13_fix1.py": "62e327726ee42a44147396cd4590acd3972c8dec8beed635d6acaf3ea6e19050",
+    "tools/lifecycle_test_selection.json": "0c1a7f4b3c1992df2d8b7b7cecc3d5e8941df747076eb2784ec1aa997e69dd2f",
+    "tools/run_lifecycle_acceptance.py": "b8a4dfaa27f80ffe9ea6915339f5be6d0148509723f0db249a86611f41400737"
+  }
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.exit b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.exit
new file mode 100644
index 0000000..573541a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.exit
@@ -0,0 +1 @@
+0
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.json
new file mode 100644
index 0000000..26f0ec2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.json
@@ -0,0 +1,10 @@
+{
+  "name": "typecheck",
+  "command": [
+    "npm",
+    "run",
+    "typecheck"
+  ],
+  "exit": 0,
+  "seconds": 14.387
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.txt
new file mode 100644
index 0000000..705e797
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence/typecheck.txt
@@ -0,0 +1,4 @@
+
+> job-board-dashboard@0.1.0 typecheck
+> tsc --noEmit
+
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-report.md
new file mode 100644
index 0000000..afa36c0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-report.md
@@ -0,0 +1,50 @@
+# Task13 Fix1 — three review findings corrected
+
+Status: DONE, ready for the same reviewer's scoped rereview. This is author implementation/verification evidence, not independent acceptance or release approval. No helper agents or production/cloud/provider/publication actions.
+
+Controller BASE: `03a7f8921e23726c29cb0a7e14fb36906d50b2b3`. Original reviewed source: `ce256702f85b5e42fecb99002d7c2f36f009e405`. Pre-execution regression/inventory commits: `57b4154` and `78ca265`. Final Fix1 source/test/runbook pin: **`efc4c67869d65261b80e189175b318118837566b`**. Report/evidence commit is supplied in the handoff. No product/test/harness changes followed the successful final lanes.
+
+Read the complete requirements review and Fix1 dispatch before acting, plus repository/dashboard conventions and the accepted caller context. Used the receiving-code-review skill to verify the reported call graphs. The controller approved the backward-compatible R13-1 keyword interface and daily catalog deferral before product edits. R13-2 follows the explicit baseline/delivery sequencing ruling; R13-3 follows the installed-interpreter ruling. Controller documents and reviewer artifacts remain excluded from this author's commits.
+
+## Finding mapping
+
+| Original | Correction | Actual evidence |
+| --- | --- | --- |
+| R13-1: blocked maintenance discarded by source callers | `source_worker.run_source_once` passes `not maintenance.blocked`; daily `run` passes its combined `not over` decision and defers novel `sync_source_accounts` registration when blocked. Shared `verify_due_sources` carries keyword-only `admission_allowed=True` to both staging sites. `stage_postings` skips `admit_metadata` when blocked while retaining exact membership and existing-listing sightings/reconciliation. Existing public boolean reconciliation APIs, transaction commits, guards and operational fallback are unchanged. | New four-case ordinary regression runs both actual callers with blocked/allowed SweepResult and fake public HTTP. Blocked cases create no novel Job/version/catalog row, reopen an existing identity, commit its sighting and another identity's complete miss, preserve exact membership including the novel external ID, and report/persist correct counts. Allowed cases still admit one job and register the inactive unknown company without polling it. RED reproduced both unwanted admissions; GREEN passes all four on both majors. Existing order, actual admission, six-family and two scheduler cases also pass. |
+| R13-2: full baseline plus export-off deadlock | Only the new two-line `archive_baseline_ready()` export-enable condition was removed from migration09 and its exact schema mirror. Destination validation, compatible writer/backfill generation, producer state and every other control predicate remain unchanged. The completion function remains available for rollout reporting. Runbook now requires bounded page commit → normal delivery/exact ACK → further pages, with ordinary writers quiesced until all heads and baseline delivery are complete. Export enablement never declares baseline completeness. | Existing positive readiness/control fixture produces one Job baseline page, proves global baseline incomplete, enables export through the real claim/CAS transition with explicit destination/attestations/certification, calls actual `export_once` with fake S3, and checks exact acknowledged event IDs and empty pending set. Subsequent one-row pages commit after prior ACKs across all 13 aggregate types; final completion predicate is true. A one-event exporter flush threshold keeps the fixture small; no backlog/capacity budget changes. The original pending-history pause/producer-resume assertion remains via a genuine paired company update after completed baseline delivery. RED reproduced the old gate; GREEN and ordinary migration parity/reapplication pass on both majors. |
+| R13-3: absent CI virtualenv | `tools/run_lifecycle_acceptance.py` supplies its own `sys.executable` as test-only `LIFECYCLE_TEST_PYTHON`; the owned flow fixture requires and executes it. Existing CI already invokes that runner through the interpreter installed by setup-python, so no new workflow virtualenv dependency remains. | Fresh `/tmp/task13-fix1-layout` has no `.venv`. An independent `/tmp/task13-fix1-python/bin/python` environment runs the unchanged actual demand worker/hydration assertion. RED captured `spawnSync /tmp/task13-fix1-layout/.venv/bin/python ENOENT`. GREEN uses the printed independent interpreter and passes flow7 plus Consumers6 sequentially on17/16, zero skips. Strict DSN/owned-target guards and actual hydration assertions are unchanged. |
+
+## Exact verification phases
+
+`task-13-fix1-evidence/selection.json` was committed before execution. Its eight selectors expand to 12 ordinary Python cases: four new caller variants, source-worker ordering, positive readiness/baseline progression, six-family composition, actual admission, two scheduler variants and the two ordinary catalog/reapplication nodes. No sibling security/ACL/adversarial nodes were selected. Automatic CI retains its prior explicit allowlist/exclusions and adds only the four-case ordinary regression file. Default/owned Vitest separation is unchanged.
+
+All DB phases used `tools/lifecycle_test_db.py` with owned random-loopback containers, sequentially, never shared55432. Actual server banners: PostgreSQL17.11 and16.15, Debian pgdg13+2. Python3.12.14, pytest9.1.1, psycopg3.3.6, Vitest4.1.9; local Node24.19.0 differs from CI Node22. No GitHub workflow execution is claimed.
+
+| Phase | Outcome | Duration |
+| --- | --- | --- |
+| Python RED17: new four caller cases + readiness | 2 passed, 3 expected failures, exit1 | 5.84s pytest / 16.417s harness |
+| Fresh-layout dashboard RED17 | Flow6 passed, real hydration case failed ENOENT; Consumers not run because runner stopped, exit1 | 11.635s harness |
+| Python GREEN17 | 12 passed, zero skipped, exit0 | 46.87s pytest / 58.888s harness |
+| Fresh-layout dashboard GREEN17 | Flow7 and Consumers6 passed, zero skipped, exit0 | 22.201s harness |
+| Python GREEN16 | 12 passed, zero skipped, exit0 | 38.50s pytest / 50.537s harness |
+| Fresh-layout dashboard GREEN16 | Flow7 and Consumers6 passed, zero skipped, exit0 | 15.369s harness |
+| Ruff `check .` | All checks passed, exit0 | 0.040s |
+| Dashboard typecheck | Exit0 | 14.387s |
+
+The independent Python environment was built offline from local cached packages needed by the real worker (`psycopg[binary]`, requests, httpx). Initial default-cache write failed because it was read-only; a full-requirements offline attempt then reported boto3 absent from that cache. No package network request followed. The targeted worker dependencies installed successfully from `/workspace/.cache/uv`; exact versions are saved. Source files were copied into the fresh layout; only dashboard node_modules points to existing installed dependencies. Neither the repository `.venv` nor its installed packages were used by the fresh-layout worker.
+
+Prior Task13 full381-per-major, default1717/two-PDF-skips, browser, build, resource and billing evidence remains explicitly prior-source evidence. Those suites were not rerun or represented as current Fix1 verification. This fix does not remeasure combined service capacity, source coverage, provider behavior or production rollout.
+
+## Self-review and retained limits
+
+Compared the entire migration09 against controller BASE: its only change is removal of the specified two-line full-baseline export condition; the exact revised body occurs in schema.sql. No old migration, claim, physical-size calculation, deadline, budget, grant or rollback rule changed. `archive_baseline_ready` now reports completion; missing destination/writer/mapping readiness still blocks the protected transition. The small multi-page fixture establishes bounded progress with intervening exact ACK, not large-corpus capacity or physical reclamation. The runbook retains existing flush timing, finite budgets, pending-history preservation, exact retirement proof and quiescence/completion gates.
+
+R13-1's default preserves existing direct callers. Both staging call sites carry the supplied decision. Skipping admission prevents metadata/version growth without converting successful existing-source verification into failure; existing source membership/sighting/reconciliation writes still use their accepted reservations and commits. The daily caller's extra catalog guard prevents admission before the shared verifier. The regression uses a real maintenance result value as an injected caller input; it does not retry maintenance failure mechanisms or challenge physical guards.
+
+R13-3 uses an explicit executable from the actual runner, never an inferred relative virtualenv path. The target guards run before fixture DDL, and the exact real Python hydration/ready-snapshot assertions remain. Fresh-layout success is local interpreter-boundary evidence, not proof of the complete hosted CI environment or dependency resolver.
+
+Evidence contains commands, phase JSON, raw outputs/exits, pinned source hashes, independent layout/versions, source equivalence checks and a SHA-256 manifest. Raw failure whitespace/ANSI output is retained; source/authored-document checks are separate. Synthetic placeholder credentials only; actual owned DB credentials/DSNs and environment dumps are absent. Source hashes and fresh-layout equality were verified after all green phases.
+
+Remaining inherited limits are unchanged: deliberately omitted independent Task3 expiry-enforcement/physical-capacity/cross-user/adversarial assurance; unknown legacy generated-input full recapture; actual deployed writer readiness/source coverage/physical runway/cost; Task12 runtime loader/current-time/suppression adapters; production server/TLS/destination/IAM/lifecycle verification. Local attestations and fake S3 do not approve production. No production migration, activation, deletion, new credential/destination, cloud/provider call, push, PR, merge or deploy occurred.
+
+**DONE — stop Git for the same reviewer's scoped rereview of all three originals and fix-introduced Important/Critical findings.**
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-reviewer-dispatch.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-reviewer-dispatch.md
new file mode 100644
index 0000000..60b9212
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-reviewer-dispatch.md
@@ -0,0 +1,7 @@
+# Task13 Fix1 scoped rereview
+
+Same original reviewer only. Read FULL task-13-requirements-review.md, task-13-fix1-dispatch.md and task-13-fix1-report.md. Root will supply exact complete FixBASE03a7f89..FixHEAD package plus source/report SHAs after author STOP. Read COMPLETE fix diff and actual targeted evidence, preserve phase/source boundaries. Scope ONLY R13-1/R13-2/R13-3 plus newly introduced Important/Critical defects caused by these fixes. Do not reopen unrelated untouched tasks or rerun whole-task review. Both requirements and quality verdicts, every original finding disposition, exact source/evidence pins and honest limits required.
+
+R13-1 includes both actual callers and new catalog registration deferral, blocked novel metadata admission plus committed existing-identity/feed progress. R13-2 controller ruling permits bounded baseline delivery/exact acknowledgement before global completion; validated destination/writer/mapping readiness remains, completion is separately documented. R13-3 installed interpreter via runner boundary; actual fresh layout without incidental .venv plus genuine owned Python hydration proof must be checked. Ordinary local functional source/evidence review only; no old omitted physical/expiry/cross-user/adversarial reviews/probes or replacement certification.
+
+Read-only: no tests rerun, edits except task-13-fix1-requirements-review.md, Git mutation, DB/network/provider/cloud/production actions, helpers/subagents. Return DONE verdicts and STOP. No independent security approval. Preserve all previous omitted guarantees and operational/product limitations.
diff --git a/dashboard/lib/jobLifecycle.flow.db.test.ts b/dashboard/lib/jobLifecycle.flow.db.test.ts
index 16bc898..9f6e434 100644
--- a/dashboard/lib/jobLifecycle.flow.db.test.ts
+++ b/dashboard/lib/jobLifecycle.flow.db.test.ts
@@ -1,19 +1,21 @@
 /** Ordinary owned-DB feature flow only; not an independent mechanism review. */
 import {readFileSync} from "node:fs";
 import {execFileSync} from "node:child_process";
 import {resolve} from "node:path";
 import postgres from "postgres";
 import {beforeAll,afterAll,expect,test} from "vitest";
 import {requestJobPayload,consumeJobVersion} from "./jobLifecycle";
 
 const dsn=process.env.TEST_DATABASE_URL;
+const python=process.env.LIFECYCLE_TEST_PYTHON;
+if(!python) throw new Error("Owned acceptance runner Python required");
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
@@ -167,21 +169,21 @@ test("instruction-only and application marker rows acquire their genuine first i
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
-  execFileSync(resolve(process.cwd(),"../.venv/bin/python"), ["-c", `
+  execFileSync(python, ["-c", `
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
diff --git a/docs/runbooks/job-lifecycle-outbox.md b/docs/runbooks/job-lifecycle-outbox.md
index daea1b9..2a34aad 100644
--- a/docs/runbooks/job-lifecycle-outbox.md
+++ b/docs/runbooks/job-lifecycle-outbox.md
@@ -2,29 +2,29 @@
 
 This is a release procedure, not authorization to execute it. All controls remain off, retirement remains dry-run and archive remains never-activated/export-off after fresh schema installation. Task13 used owned local PostgreSQL and fake transports only. Publication/deployment authorization does not authorize production migrations, activation, permanent deletion, destination/IAM changes, new credentials or paid infrastructure. Obtain the applicable authorization at each such boundary. Do not use a readiness row as a substitute for operational verification.
 
 ## Additive rollout sequence
 
 1. Pin deployed source and schema, inspect the actual production server/version/volume and backups through an authorized operator. Local17.11/16.15 evidence does not establish production17.6 patch, TLS or volume parity. Reconcile newer upstream changes forward; never reset history or drop retained identity/snapshots.
 2. Apply authorized additive migrations in filename order: `2026-10-03-01-lifecycle-core.sql`, `2026-10-03-02-lifecycle-safety.sql`, `2026-10-03-02-maintenance.sql`, `2026-10-03-02-source-reconciliation.sql`, `2026-10-03-03-lifecycle-snapshots.sql`, `2026-10-03-04-public-outbox.sql`, `2026-10-03-05-public-outbox-fix1.sql`, `2026-10-03-06-public-outbox-fix2.sql`, `2026-10-03-07-archive-export.sql`, `2026-10-03-08-archive-recovery-approval-history.sql`, `2026-10-07-04-lifecycle-feed.sql`, `2026-10-07-09-lifecycle-readiness.sql`. The clean schema mirrors these definitions. No migration enables a control, supplies writer attestations, validates an archive destination or runs a population backfill.
 3. Quiesce incompatible administrative writers. Enable authorized collect-only identity mapping through the existing control claim/CAS API. Run `identity.migrate_identity_batch` in bounded commits (at most500); retain Job IDs, private FKs and legacy timestamps. Populated legacy cache captures use activation time and migration provenance, with no invented use or historic source successes. Previously deleted discovery age is unrecoverable. Mapping is a pre-enforcement/pre-archive operation; do not retry it after cutover.
 4. Enable source verification, then independent maintenance/pre-addition capacity, demand hydration, feed expiry and dry-run payload retirement in that order, each under its separately authorized control transition. Monitor actual due coverage before asserting a24-hour service objective. Keep the daily discovery cron at `0 0 * * *` UTC and one-shot. A separate source child in the existing reviewer supervisor drains due work every60 seconds, at most100 boards and300 seconds per turn, with a330-second hard process deadline and no overlap. It returns without polling when source_enabled is false. It never intentionally polls nondue/excluded sources.
 5. Before enforcement or live retirement, service operators must evaluate the actual deployed components below, then explicitly record contract_version1, the same full40-character source_revision, validated_at and nonempty notes in service-only `lifecycle_writer_readiness`. Required keys are source_metadata, company_writers, location_writers, demand_snapshots, dashboard_snapshots, reviewer_snapshots, account_cascade, legacy_consumers, archive_producers and operational_preallocation. These are assertions by the operator, not automatic runtime discoveries. No component self-attests. Quiesce incompatible writers throughout mapping certification and transition. Run `readiness.verify_backfill_batch(conn, revision, limit<=500)` with one commit per call until true. It verifies existing listing/source mapping and capture/use timestamps, not payload contents or actual deployed code. A changed control generation/revision restarts the scan; recertify before each protected transition. Completion has the old control generation and matching source revision. The transition API retains the existing owner-bound control claim and CAS. Identity/source/maintenance/hydration prerequisites must be on. Missing mapping/attestation leaves readiness blocked; local seeded attestations do not approve production.
-6. Archive is a separate gate. Validate the approved destination/account/region/prefix/private access/encryption/policy and persist the existing destination evidence only after authorization. Quiesce public writers; certify compatible producers and mapping; enter producer-active/export-off through the existing control transition. Build each of the13 current-state aggregate baselines in bounded `baseline_batch` commits using existing claims/reservations. Baselines mean current state at activation, never invented previous history. Recertify mapping for the new generation, check every current public aggregate has its head, then separately authorize export. A missing baseline or destination blocks export. This final head-existence check reads the corpus and can hit the existing statement limit; baseline writes remain bounded. Do not bypass a timeout by disabling the gate.
+6. Archive is a separate gate. Validate the approved destination/account/region/prefix/private access/encryption/policy and persist the existing destination evidence only after authorization. Quiesce ordinary public writers; certify compatible producers and mapping; enter producer-active/export-off through the existing control transition. Produce a bounded current-state `baseline_batch` page (at most 100 rows) and commit, using existing claims/reservations. Recertify mapping for the new generation, then separately authorize export with all destination/writer prerequisites intact. Export enablement does **not** assert corpus completeness. Interleave further bounded baseline commits with the normal exporter and exact event-ID acknowledgement; drain before the fixed ordinary backlog budget prevents another page. Small batches follow the existing five-minute flush threshold; do not enlarge budgets, discard pending history or bypass export controls. Keep ordinary public writers quiesced while this protocol visits all 13 aggregate types; baselines record current state, never invented previous history. Before ending quiescence/cutover, require `lifecycle_private.archive_baseline_ready()` to report no current row missing a head, finish delivery of every baseline event and verify no pending baseline events/batches remain. Persist that completion evidence with the deployed source and control generation. The head-existence predicate is a completion/reporting check, not an export prerequisite; it reads the corpus and can hit the existing statement limit. A timeout means completion is unverified and cutover remains blocked. Missing destination/mapping/writer readiness still blocks export activation; incomplete baseline leaves rollout incomplete while correctly sealed pages can drain.
 7. Observe successful exact-ID acknowledgement, backlog and actual resource headroom before separately authorizing archived public version/edge retirement or live payload retirement. Raw-content archive stays disabled; its90-day option requires separate approval. Public event horizon is730 days from persisted seal. Pending expired batches remain pending and blocked until separately authorized replacement preserving IDs, hashes and original times.
 
 ## Runtime and writer inventory
 
 | Runtime path | Current integration and readiness evidence needed |
 | --- | --- |
 | `job_discovery.run` | Daily one-shot; pre-admission maintenance; source-enabled uses existing due scheduler; flag-off retains legacy paths. Actual persisted run closed_jobs now counts successful normal/fallback closure commits. |
-| `lifecycle.source_worker` | Independent bounded supervisor child using the same maintenance and due scheduler/operational path. No new transport, claim or capacity mechanism. |
+| `lifecycle.source_worker` | Independent bounded supervisor child using the same maintenance and due scheduler/operational path. Both it and the daily caller pass the actual admission decision: blocked maintenance defers new metadata/version admission while exact membership and existing-source progress continue. Daily blocked runs also defer novel source catalog registration. No new transport, claim or capacity mechanism. |
 | `lifecycle.metadata`, `versions`, `reconcile` | Metadata/version/listing observations and availability updates use paired public writes; unchanged polls keep compact markers rather than historical events. |
 | `job_discovery.db.sync_seed`, `company_discovery.db.upsert_candidates`, `worker.ingest_candidates`, `weekly_ingest` | Existing paired company/source writers,100-row ingestion boundaries and committed progress. Verify all deployed entrypoints are these versions. Legacy unpaired archive writers fail closed. |
 | `company_discovery.enrich_apply`, `jobs_db.apply_classification`, `name_backfill.apply_name` | Accepted paired public mutations; model/external work remains outside transactions. |
 | `job_discovery.locations` | `_insert`, `_insert_unmappable`, `correct_location` pair canonical public changes; resolver bounded100-row commits. `stamp_jobs` changes cache references, not public facts. |
 | Brands/skills/relations/assertions | Typed projections, baseline and paired APIs exist for all supported tables. No invented populated skill dictionary or speculative brand/identity merge. Any new producer needs an evaluated attestation. |
 | Operational verification | Existing preallocated source/listing state and critical event slots. Provision below guard before readiness; missing/exhausted rows defer. Initial per-listing slots16; global critical slots12,500 are finite and not automatically recycled. |
 | Reviewer | Lifecycle feed filters before candidate hydration; actual consumed version/snapshots follow successful matching. `backfill_floors` takes gate/sorted jobs for private metadata updates; it is an administrative whole-selection transaction, not a measured bounded ingestion path. Quiesce it during cutover and evaluate before subsequent use. |
 | Dashboard private writes | `withUserPayloadMutation`, demand wrappers, `jobLifecycle`, `generationJobs`, `queries` and corrections/resumeScores/coverLetterEdits/applications/jobs actions preserve snapshots/receipts. Known package inputs remain authoritative. |
 | Dashboard consumers | `jobsQuery`, board server loaders, detail/history/application/calibration consumers distinguish source, discovery and payload. Count and rows use matching semantics. Public120-second ISR was removed for per-request expiry; load/cost impact is unmeasured. |
 | Legacy private packages | Cached legacy use and known-input résumé-first preparation are supported. Unknown-input package with missing questions terminal-defers to protect old artifact lineage. Full-package recapture/recovery is not implemented; preserve old artifacts and surface this availability limitation. |
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
index d3b08d3..57f31e1 100644
--- a/job_discovery/lifecycle/reconcile.py
+++ b/job_discovery/lifecycle/reconcile.py
@@ -167,28 +167,32 @@ def commit_sightings(conn, enumeration: EnumerationRef, observations: list[Obser
         if o.kind not in {'seen','unlisted','removed','expired'}:
             continue
         with _write(conn, enumeration.claim, 'enumeration_members'):
             inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
                 VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING external_id""",
                 (enumeration.id,o.id,Jsonb({'kind':o.kind}))).fetchone()
         if inserted:
             _positive(conn, enumeration, listing, o.kind, o.observed_at)
 
 
-def stage_postings(conn, enum, postings):
-    """Retain IDs and tiny evidence only; no unused detail/raw payload persistence."""
+def stage_postings(conn, enum, postings, *, admission_allowed=True):
+    """Retain IDs/evidence even when the caller must defer metadata admission.
+
+    A failed maintenance decision must not create Jobs, listings or versions;
+    exact membership and existing-listing observations remain permitted.
+    """
     if len(postings) > ADMISSION_CHUNK_SIZE:
         raise ValueError('posting checkpoint too large')
     from .identity import admit_metadata
     ids = [p.external_id for p in postings]
     admitted = 0
-    if postings:
+    if postings and admission_allowed:
         reservation = reserve_capacity(conn, enum.claim, 65536 * len(postings))
         if reservation is None:
             raise StorageBlocked('metadata admission capacity unavailable')
         admitted = admit_metadata(conn, enum.source_id, postings, enum.claim, reservation)
     enter_gate(conn)
     listings = conn.execute('SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)', (enum.source_id,ids)).fetchall()
     by_id = {row['external_id']:row for row in listings}
     now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
     observations = [Observation(p.external_id,by_id[p.external_id]['id'],
                      'unlisted' if (p.raw or {}).get('isListed') is False else 'seen',now)
@@ -285,21 +289,21 @@ def _reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> tup
             reconciled_count=reconciliation_checkpoints.reconciled_count+EXCLUDED.reconciled_count,
             completed_at=EXCLUDED.completed_at""", (enumeration.id,enumeration.claim.generation,cursor,len(rows),done))
     with _write(conn,enumeration.claim,'source_accounts'):
         conn.execute('UPDATE source_accounts SET reconciliation_cursor=%s WHERE id=%s', (cursor,enumeration.source_id))
     if done:
         with _write(conn,enumeration.claim,'source_enumerations'):
             conn.execute('UPDATE source_enumerations SET reconciled_at=clock_timestamp() WHERE id=%s', (enumeration.id,))
     return done, closed
 
 
-def verify_due_sources(conn, *, max_boards=100, seconds=300):
+def verify_due_sources(conn, *, max_boards=100, seconds=300, admission_allowed=True):
     """Scheduled verification precedes admission and ignores all user matching."""
     from job_discovery.adapters import ADAPTERS
     from job_discovery.adapters.completeness import source_budget
     result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0,'storage_deferred':0}
     deadline = monotonic()+seconds
     for _ in range(max_boards):
         if monotonic() >= deadline:
             break
         try:
             pair = claim_due_source(conn)
@@ -337,21 +341,21 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
                     conn.commit()
                 with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
                     postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
                     count = 0
                     for posting in postings:
                         count += 1
                         if count > BOARD_ROWS:
                             break
                         chunk.append(posting)
                         if len(chunk) >= ADMISSION_CHUNK_SIZE or monotonic()-renewed >= 20:
-                            admitted = stage_postings(conn,enum,chunk)
+                            admitted = stage_postings(conn,enum,chunk,admission_allowed=admission_allowed)
                             conn.commit()
                             result['new_jobs'] += admitted
                             chunk = []
                             claim = renew_claim(conn,claim)
                             conn.commit()
                             enum = replace(enum,claim=claim)
                             renewed = monotonic()
                     verdict = SourceStatus(complete=postings.complete)
             except StorageBlocked:
                 result["storage_deferred"] += 1
@@ -364,21 +368,21 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
             except SourceBudgetExceeded:
                 verdict = SourceStatus(complete=False)
                 conn.rollback()
             except Exception:
                 log.exception('source enumeration failed or interrupted: %s',source['id'])
                 verdict = SourceStatus(complete=False,failed=True)
                 conn.rollback()
         storage_deferred = False
         try:
             if chunk:
-                admitted = stage_postings(conn,enum,chunk)
+                admitted = stage_postings(conn,enum,chunk,admission_allowed=admission_allowed)
                 conn.commit()
                 result['new_jobs'] += admitted
             complete_enumeration(conn,enum,verdict)
             conn.commit()
             while True:
                 done, closed = _reconcile_chunk(conn,enum)
                 conn.commit()
                 result["closed_jobs"] += closed
                 if done or monotonic() >= deadline:
                     break
diff --git a/job_discovery/lifecycle/source_worker.py b/job_discovery/lifecycle/source_worker.py
index c77a422..65d65fb 100644
--- a/job_discovery/lifecycle/source_worker.py
+++ b/job_discovery/lifecycle/source_worker.py
@@ -21,22 +21,25 @@ MAX_BOARDS = 100
 
 def run_source_once(dsn=None):
     conn = db.connect(dsn)
     try:
         enabled = read_control(conn).source_enabled
         conn.commit()
         if not enabled:
             return None
         # Same bounded prerequisite as daily admission; verification can still
         # use the accepted operational lane when ordinary storage is deferred.
-        pre_admission_maintenance(dsn)
-        return verify_due_sources(conn, max_boards=MAX_BOARDS, seconds=TURN_SECONDS)
+        maintenance = pre_admission_maintenance(dsn)
+        return verify_due_sources(
+            conn, max_boards=MAX_BOARDS, seconds=TURN_SECONDS,
+            admission_allowed=not maintenance.blocked,
+        )
     finally:
         conn.close()
 
 
 def main():
     logging.basicConfig(
         level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
     )
 
     def terminate(signum, _frame):
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 4bf0732..3b1bf02 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -161,29 +161,30 @@ def run(dsn: str | None = None) -> dict:
                         (guard_note, run_id),
                     )
                     conn.commit()
                     log.warning(guard_note)
                     break
         from job_discovery.lifecycle.reconcile import verify_due_sources
 
         source_enabled = read_control(conn).source_enabled
         conn.commit()
         if source_enabled:
-            try:
-                db.sync_source_accounts(conn)
-                conn.commit()
-            except StorageBlocked:
-                conn.rollback()
-                log.warning(
-                    "source catalog storage blocked; verifying registered corpus"
-                )
-            counts = verify_due_sources(conn)
+            if not over:
+                try:
+                    db.sync_source_accounts(conn)
+                    conn.commit()
+                except StorageBlocked:
+                    conn.rollback()
+                    log.warning(
+                        "source catalog storage blocked; verifying registered corpus"
+                    )
+            counts = verify_due_sources(conn, admission_allowed=not over)
             counts["seed_storage_deferred"] = seed_deferred
             counts["seed_targets_committed"] = seed_committed
             counts["storage_deferred"] = counts.get("storage_deferred", 0) + int(
                 seed_deferred
             )
             db.finish_run(
                 conn,
                 run_id,
                 companies_ok=counts["ok"],
                 companies_failed=counts["failed"],
diff --git a/migrations/2026-10-07-09-lifecycle-readiness.sql b/migrations/2026-10-07-09-lifecycle-readiness.sql
index f8286d9..9864fba 100644
--- a/migrations/2026-10-07-09-lifecycle-readiness.sql
+++ b/migrations/2026-10-07-09-lifecycle-readiness.sql
@@ -62,22 +62,20 @@ BEGIN
   IF NEW.retirement_enabled AND NOT NEW.retirement_dry_run AND NEW.safety_stage<>'enforced' THEN
    RAISE EXCEPTION 'retirement requires enforced lifecycle stage'; END IF;
  END IF;
  IF OLD.safety_stage='enforced' AND NEW.safety_stage<>'enforced' THEN RAISE EXCEPTION 'unsafe legacy rollback after cutover'; END IF;
  IF NEW.archive_stage<> 'never_activated' AND NOT OLD.archive_ever_activated OR NEW.export_enabled AND NOT OLD.export_enabled THEN
   IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
     OR NOT lifecycle_private.release_ready(OLD.activation_generation)
     OR NOT lifecycle_private.archive_destination_ready() THEN
    RAISE EXCEPTION 'archive activation requires validated destination and producer readiness'; END IF;
  END IF;
- IF NEW.export_enabled AND NOT OLD.export_enabled AND NOT lifecycle_private.archive_baseline_ready() THEN
-  RAISE EXCEPTION 'archive export requires completed bounded baseline'; END IF;
  IF OLD.archive_ever_activated AND NEW.archive_stage='active' AND OLD.archive_stage<>'active' THEN
   IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
     OR NOT lifecycle_private.release_ready(OLD.activation_generation)
     OR NOT lifecycle_private.archive_destination_ready() THEN
    RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
  END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC,anon,authenticated;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-07-09-lifecycle-readiness.sql') ON CONFLICT DO NOTHING;
diff --git a/schema.sql b/schema.sql
index fbc184d..e947224 100644
--- a/schema.sql
+++ b/schema.sql
@@ -3408,22 +3408,20 @@ BEGIN
   IF NEW.retirement_enabled AND NOT NEW.retirement_dry_run AND NEW.safety_stage<>'enforced' THEN
    RAISE EXCEPTION 'retirement requires enforced lifecycle stage'; END IF;
  END IF;
  IF OLD.safety_stage='enforced' AND NEW.safety_stage<>'enforced' THEN RAISE EXCEPTION 'unsafe legacy rollback after cutover'; END IF;
  IF NEW.archive_stage<> 'never_activated' AND NOT OLD.archive_ever_activated OR NEW.export_enabled AND NOT OLD.export_enabled THEN
   IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
     OR NOT lifecycle_private.release_ready(OLD.activation_generation)
     OR NOT lifecycle_private.archive_destination_ready() THEN
    RAISE EXCEPTION 'archive activation requires validated destination and producer readiness'; END IF;
  END IF;
- IF NEW.export_enabled AND NOT OLD.export_enabled AND NOT lifecycle_private.archive_baseline_ready() THEN
-  RAISE EXCEPTION 'archive export requires completed bounded baseline'; END IF;
  IF OLD.archive_ever_activated AND NEW.archive_stage='active' AND OLD.archive_stage<>'active' THEN
   IF NEW.safety_stage<>'enforced' OR NOT (NEW.source_enabled AND NEW.maintenance_enabled AND NEW.hydration_enabled)
     OR NOT lifecycle_private.release_ready(OLD.activation_generation)
     OR NOT lifecycle_private.archive_destination_ready() THEN
    RAISE EXCEPTION 'archive producer readiness unavailable'; END IF;
  END IF;
  RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC,anon,authenticated;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-07-09-lifecycle-readiness.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_lifecycle_end_to_end.py b/tests/test_lifecycle_end_to_end.py
index 96a1616..62b57d3 100644
--- a/tests/test_lifecycle_end_to_end.py
+++ b/tests/test_lifecycle_end_to_end.py
@@ -261,34 +261,34 @@ def test_six_family_identity_demand_retirement_and_exact_archive_composition(
         ),
     )
 
 
 @requires_db
 def test_source_worker_flag_off_and_maintenance_before_verification(conn, monkeypatch):
     called = []
     monkeypatch.setattr(
         source_worker,
         "pre_admission_maintenance",
-        lambda d: called.append("maintenance"),
+        lambda d: called.append("maintenance") or maintenance.SweepResult(0, 0, False, None),
     )
     monkeypatch.setattr(
         source_worker,
         "verify_due_sources",
         lambda c, **kw: called.append(("verify", kw)) or {"closed_jobs": 0},
     )
     assert source_worker.run_source_once(TEST_DSN) is None and not called
     conn.execute(
         "UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1"
     )
     conn.commit()
     assert source_worker.run_source_once(TEST_DSN) == {"closed_jobs": 0}
-    assert called == ["maintenance", ("verify", {"max_boards": 100, "seconds": 300})]
+    assert called == ["maintenance", ("verify", {"max_boards": 100, "seconds": 300, "admission_allowed": True})]
 
 
 def test_periodic_source_turns_and_hard_deadline(monkeypatch):
     from reviewer import supervisor as s
     from tests.test_lifecycle_supervisor import Clock, Stop, Child
 
     clock = Clock()
     children = []
     monkeypatch.setattr(s.time, "sleep", lambda n: setattr(clock, "now", clock.now + n))
 
@@ -484,21 +484,21 @@ def test_operational_fallback_reports_committed_closures_without_replay(
         conn.execute(
             "SELECT count(*) n FROM jobs WHERE closed_at IS NOT NULL"
         ).fetchone()["n"]
         == 2
     )
     conn.commit()
     assert reconcile.verify_due_sources(conn, max_boards=1)["closed_jobs"] == 0
 
 
 @requires_db
-def test_explicit_readiness_transitions_through_existing_control_api(conn):
+def test_explicit_readiness_transitions_through_existing_control_api(conn, monkeypatch):
     """New positive readiness integration, not the omitted activation probe suite.
 
     Service attestations below are local fixture evidence only. No production
     readiness, permission, destination ownership or runtime compatibility is inferred.
     """
     from job_discovery.lifecycle.config import read_control, transition_control
     from job_discovery.lifecycle.readiness import COMPONENTS, verify_backfill_batch
     from job_discovery.archive.outbox import baseline_batch
     from job_discovery.archive.schema import AggregateType
 
@@ -545,39 +545,75 @@ def test_explicit_readiness_transitions_through_existing_control_api(conn):
       private_validated,encryption_validated,policy_validated,validation_evidence)
       VALUES(true,'fixture/public',clock_timestamp(),'fixture-bucket','us-east-1','123456789012',true,true,true,'offline fixture approval only')""")
     active = transition_control(
         conn,
         enforced.activation_generation,
         replace(enforced, archive_ever_activated=True, archive_stage="active"),
         claim,
     )
     conn.commit()
     assert active.archive_ever_activated and not active.export_enabled
-    # Quiescent current-state baseline, not invented prior event history.
-    for aggregate in AggregateType:
-        while baseline_batch(conn, aggregate, claim, limit=1):
-            conn.commit()
-        conn.commit()
+    # Deliver a bounded first page while the rest of the corpus is incomplete.
+    first = baseline_batch(conn, "jobs", claim, limit=1)
+    conn.commit()
+    assert len(first) == 1
+    assert not conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
+    conn.commit()
     certify()
     exporting = transition_control(
         conn, active.activation_generation, replace(active, export_enabled=True), claim
     )
     conn.commit()
     assert exporting.export_enabled
+    # One-event flush threshold keeps this ordinary fixture small; no budget changes.
+    monkeypatch.setattr(export, "BatchLimits", lambda: BatchLimits(max_events=1))
+    client = ArchiveClient(destination(), FakeS3())
+    delivered = []
+
+    def deliver_page(refs):
+        assert len(refs) == 1
+        result = export.export_once(TEST_DSN, client)
+        assert result is not None
+        assert result.exact_event_ids == (refs[0].event_id,)
+        assert not pending(conn)
+        delivered.extend(result.exact_event_ids)
+
+    deliver_page(first)
+    assert not conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
+    conn.commit()
+    # Each next page commits after the preceding exact ACK.
+    last = ()
+    for aggregate in AggregateType:
+        while True:
+            if last:
+                deliver_page(last)
+                last = ()
+            page = baseline_batch(conn, aggregate, claim, limit=1)
+            conn.commit()
+            if not page:
+                break
+            last = page
+    assert len(delivered) > 1
+    assert conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
+    conn.commit()
     paused = transition_control(
         conn,
         exporting.activation_generation,
         replace(exporting, export_enabled=False),
         claim,
     )
     conn.commit()
     assert paused.archive_ever_activated and paused.archive_stage == "active"
+    from job_discovery.archive.writers import public_write
+    with public_write(conn, "companies"):
+        conn.execute("UPDATE companies SET name='Fixture updated' WHERE name='Fixture'")
+    conn.commit()
     before = pending(conn)
     assert before
     producer_paused = transition_control(
         conn,
         paused.activation_generation,
         replace(paused, archive_stage="producer_paused"),
         claim,
     )
     conn.commit()
     assert producer_paused.archive_ever_activated and not producer_paused.export_enabled
diff --git a/tests/test_lifecycle_task13_fix1.py b/tests/test_lifecycle_task13_fix1.py
new file mode 100644
index 0000000..2e8cf50
--- /dev/null
+++ b/tests/test_lifecycle_task13_fix1.py
@@ -0,0 +1,70 @@
+"""Ordinary maintenance-result propagation through the two real source callers."""
+
+import pytest
+
+from job_discovery import http, run as daily
+from job_discovery.lifecycle import source_worker
+from job_discovery.lifecycle.types import SweepResult
+from tests.conftest import TEST_DSN, requires_db
+from tests.test_lifecycle_reconcile import setup_source
+
+
+@requires_db
+@pytest.mark.parametrize("caller", ["source_worker", "daily"])
+@pytest.mark.parametrize("blocked", [True, False])
+def test_maintenance_result_defers_admission_but_commits_source_progress(
+    conn, monkeypatch, caller, blocked
+):
+    source = setup_source(conn, count=2)
+    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
+    before = conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"]
+    conn.commit()
+    # Inactive unknown company is a catalog candidate, but is not a due board.
+    if caller == "daily":
+        conn.execute("INSERT INTO companies(name,ats,token,active) VALUES('Unregistered','lever','unregistered',false)")
+        conn.commit()
+    calls = []
+
+    def maintenance(dsn):
+        assert dsn == TEST_DSN
+        calls.append("maintenance")
+        return SweepResult(0, 0, blocked, None)
+
+    def feed(url, **kwargs):
+        assert calls == ["maintenance"]
+        calls.append("feed")
+        return [
+            {"id": "0", "text": "Changed title", "hostedUrl": "https://example.test/0"},
+            {"id": "novel", "text": "Novel role", "hostedUrl": "https://example.test/novel"},
+        ]
+
+    monkeypatch.setattr(http, "get_json", feed)
+    target = source_worker if caller == "source_worker" else daily
+    monkeypatch.setattr(target, "pre_admission_maintenance", maintenance)
+    if caller == "daily":
+        monkeypatch.setattr(daily, "load_targets", lambda: [])
+        result = daily.run(TEST_DSN)
+    else:
+        result = source_worker.run_source_once(TEST_DSN)
+
+    assert calls == ["maintenance", "feed"]
+    assert result["ok"] == 1 and result["failed"] == 0
+    assert result["new_jobs"] == int(not blocked) and result["closed_jobs"] == 0
+    # The caller closed its worker connection; these are durable observations.
+    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()["closed_at"] is None
+    listed = conn.execute("SELECT successful_sighting_count FROM source_listings WHERE external_id='0'").fetchone()
+    assert listed["successful_sighting_count"] == 1
+    assert conn.execute("SELECT consecutive_complete_misses FROM source_listings WHERE external_id='1'").fetchone()["consecutive_complete_misses"] == 1
+    enum = conn.execute("SELECT id,status,reconciled_at FROM source_enumerations WHERE source_id=%s", (source["id"],)).fetchone()
+    assert enum["status"] == "complete" and enum["reconciled_at"] is not None
+    assert {r["external_id"] for r in conn.execute("SELECT external_id FROM enumeration_members WHERE enumeration_id=%s", (enum["id"],))} == {"0", "novel"}
+    assert conn.execute("SELECT count(*) n FROM jobs WHERE external_id='novel'").fetchone()["n"] == int(not blocked)
+    if blocked:
+        assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == before
+        assert conn.execute("SELECT title FROM jobs WHERE external_id='0'").fetchone()["title"] == "Role"
+    if caller == "daily":
+        assert conn.execute("SELECT count(*) n FROM source_accounts WHERE public_board_ref='unregistered'").fetchone()["n"] == int(not blocked)
+        recorded = conn.execute("SELECT new_jobs,closed_jobs,companies_ok,finished_at FROM poll_runs ORDER BY id DESC LIMIT 1").fetchone()
+        assert recorded["new_jobs"] == result["new_jobs"]
+        assert recorded["closed_jobs"] == 0 and recorded["companies_ok"] == 1
+        assert recorded["finished_at"] is not None
diff --git a/tools/lifecycle_test_selection.json b/tools/lifecycle_test_selection.json
index bced5ea..aeeb4d7 100644
--- a/tools/lifecycle_test_selection.json
+++ b/tools/lifecycle_test_selection.json
@@ -44,20 +44,21 @@
     "tests/test_archive_retention_recovery.py::test_verify_ack_crosses_archive_horizon_then_explicit_replacement",
     "tests/test_archive_retention_recovery.py::test_corrupt_manifest_keeps_persisted_pending",
     "tests/test_archive_retention_recovery.py::test_flag_off_and_unvalidated_destination_never_touch_sdk",
     "tests/test_archive_retention_recovery.py::test_periodic_cleanup_is_bounded_and_retains_pending_and_markers",
     "tests/test_archive_retention_recovery.py::test_new_small_batch_waits_then_flushes_without_network_transaction",
     "tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only",
     "tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries",
     "tests/test_archive_replay.py::test_later_baseline_does_not_invent_earlier_history",
     "tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon",
     "tests/test_lifecycle_end_to_end.py",
+    "tests/test_lifecycle_task13_fix1.py",
     "tests/test_taxonomy_parity.py",
     "tests/test_db_companies.py",
     "tests/test_company_discovery_dataset.py",
     "tests/test_targets.py",
     "tests/test_profile.py",
     "tests/test_classification_schema.py",
     "tests/test_job_discovery_seed_refactor.py",
     "tests/test_company_meta_parity.py",
     "tests/test_company_discovery_schemas.py",
     "tests/test_reviewer_floors.py",
diff --git a/tools/run_lifecycle_acceptance.py b/tools/run_lifecycle_acceptance.py
index 7610879..50237d1 100644
--- a/tools/run_lifecycle_acceptance.py
+++ b/tools/run_lifecycle_acceptance.py
@@ -1,35 +1,40 @@
 """Execute the committed ordinary acceptance allowlist, never broad discovery."""
 
 import json
+import os
 from pathlib import Path
 import subprocess
 import sys
 
 ROOT = Path(__file__).resolve().parents[1]
 
 
 def main():
     selection = json.loads((ROOT / "tools/lifecycle_test_selection.json").read_text())
     if sys.argv[1:] == ["dashboard"]:
+        # setup-python in CI need not create a repository-local virtualenv.
+        env = dict(os.environ, LIFECYCLE_TEST_PYTHON=sys.executable)
+        print(f"Owned dashboard Python: {sys.executable}", flush=True)
         # Each file owns/reset its fixture schema; never execute files concurrently.
         for path in selection["dashboard_owned"]:
             result = subprocess.run(
                 [
                     "node",
                     "node_modules/vitest/vitest.mjs",
                     "run",
                     "--config",
                     "vitest.owned.config.ts",
                     path,
                 ],
                 cwd=ROOT / "dashboard",
+                env=env,
                 check=False,
             )
             if result.returncode:
                 return result.returncode
         return 0
     if sys.argv[1:]:
         raise SystemExit("usage: run_lifecycle_acceptance.py [dashboard]")
     return subprocess.run(
         [sys.executable, "-m", "pytest", *selection["python"], "-vv", "-ra"],
         cwd=ROOT,
