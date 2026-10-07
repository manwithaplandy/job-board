# Full pinned review package

BASE: 5a319253169cd03e1821e7c3d02df82249e6ce8b

HEAD: 7d9216d6c3a2a0ad8f28350e0f7992afbb725410

## Commits

7d9216d6c3a2a0ad8f28350e0f7992afbb725410 docs: record Task9 source pin and verification limits
ba00e50153f948ebe8726db1a445e201ebce5901 feat: separate discovery expiry from availability and history


## Files

 .../task-9-evidence/browser/default.png            | Bin 0 -> 46138 bytes
 .../task-9-evidence/browser/entry.tsx              |  13 +
 .../task-9-evidence/browser/mobile-detail.png      | Bin 0 -> 45489 bytes
 .../task-9-evidence/browser/older-detail.png       | Bin 0 -> 79298 bytes
 .../task-9-evidence/browser/result.json            |  28 +
 .../task-9-evidence/browser/run.cjs                |  58 ++
 .../task-9-evidence/chronology.md                  | 120 +++++
 .../task-9-evidence/task9-analytics-red.txt        | 152 ++++++
 .../task-9-evidence/task9-browser-complete.txt     |   1 +
 .../task-9-evidence/task9-browser-final.txt        |   1 +
 .../task-9-evidence/task9-browser-install.txt      |  36 ++
 .../task-9-evidence/task9-browser-release.txt      |   1 +
 .../task-9-evidence/task9-browser.txt              |  84 +++
 .../task-9-evidence/task9-browser2.txt             |  38 ++
 .../task-9-evidence/task9-browser3.txt             |  39 ++
 .../task-9-evidence/task9-browser4.txt             |  10 +
 .../task-9-evidence/task9-closed-red.txt           |  38 ++
 .../task-9-evidence/task9-consumers-final.txt      |  99 ++++
 .../task-9-evidence/task9-consumers.txt            |  90 ++++
 .../task-9-evidence/task9-dashboard-final.txt      | 102 ++++
 .../task-9-evidence/task9-dashboard-full.txt       | 126 +++++
 .../task-9-evidence/task9-db-red.txt               |  35 ++
 .../task-9-evidence/task9-db-red2.txt              |  28 +
 .../task-9-evidence/task9-db16-complete.txt        |  10 +
 .../task-9-evidence/task9-db16-final.txt           |  36 ++
 .../task-9-evidence/task9-db17-complete.txt        |  10 +
 .../task-9-evidence/task9-db17-final.txt           |  36 ++
 .../task-9-evidence/task9-db17.txt                 |  10 +
 .../task-9-evidence/task9-detail-green.txt         |   9 +
 .../task-9-evidence/task9-detail-red.txt           | 375 +++++++++++++
 .../task-9-evidence/task9-diff-check.txt           |   0
 .../task-9-evidence/task9-diff-final.txt           |   0
 .../task-9-evidence/task9-lint-complete.txt        |  45 ++
 .../task-9-evidence/task9-lint-release.txt         |  45 ++
 .../task-9-evidence/task9-lint.txt                 |  48 ++
 .../task-9-evidence/task9-red.txt                  |  72 +++
 .../task-9-evidence/task9-reviewer-count-red.txt   |  44 ++
 .../task-9-evidence/task9-reviewer-red.txt         |  26 +
 .../task-9-evidence/task9-reviewer16-complete.txt  |   3 +
 .../task-9-evidence/task9-reviewer16-release.txt   |   3 +
 .../task-9-evidence/task9-reviewer16.txt           |   3 +
 .../task-9-evidence/task9-reviewer17-complete.txt  |   3 +
 .../task-9-evidence/task9-reviewer17-release.txt   |   3 +
 .../task-9-evidence/task9-reviewer17.txt           |   3 +
 .../task-9-evidence/task9-route-red.txt            |  25 +
 .../task-9-evidence/task9-ruff-final.txt           |   1 +
 .../task-9-evidence/task9-ruff-release.txt         |   1 +
 .../task-9-evidence/task9-ruff.txt                 |   1 +
 .../task-9-evidence/task9-selected-complete.txt    | 114 ++++
 .../task-9-evidence/task9-selected-cwd-final.txt   |  27 +
 .../task-9-evidence/task9-selected-final-pin.txt   |   9 +
 .../task-9-evidence/task9-selected-final.txt       | 142 +++++
 .../task-9-evidence/task9-selected-green.txt       |   8 +
 .../task-9-evidence/task9-selected-release.txt     |   9 +
 .../task-9-evidence/task9-selected.txt             | 100 ++++
 .../task-9-evidence/task9-tsc-complete.txt         |   0
 .../task-9-evidence/task9-tsc-final.txt            |   0
 .../task-9-evidence/task9-tsc.txt                  |   0
 .../task-9-evidence/task9-tsc2.txt                 |   0
 .../task-9-evidence/task9-typecheck-release.txt    |   0
 .../task-9-evidence/task9-typecheck-source.txt     |   9 +
 .../task-9-evidence/task9-typecheck-verified.txt   |   0
 .../task-9-evidence/task9-ui-contract-final.txt    |   9 +
 .../task-9-evidence/task9-ui-contract-green.txt    |  40 ++
 .../task-9-evidence/task9-ui-green.txt             | 388 ++++++++++++++
 .../task-9-evidence/task9-ui-green2.txt            |   8 +
 .../task-9-evidence/task9-ui-red.txt               | 596 +++++++++++++++++++++
 .../task-9-evidence/task9-utc-red.txt              |  39 ++
 .../task-9-report.md                               | 212 ++++++++
 dashboard/app/api/jobs/[id]/route.test.ts          |  11 +
 dashboard/app/api/jobs/[id]/route.ts               |   9 +-
 dashboard/app/board/page.tsx                       |  37 +-
 dashboard/app/page.tsx                             |  44 +-
 .../components/analytics/BreakdownsSection.tsx     |  14 +-
 dashboard/components/analytics/FunnelSection.tsx   |   4 +-
 dashboard/components/analytics/KpiStrip.tsx        |   6 +-
 .../analytics/SecondarySurfaceFixes.test.tsx       |   8 +
 dashboard/components/rolefit/JobCard.tsx           |   5 +-
 dashboard/components/rolefit/JobDetail.tsx         |   6 +-
 dashboard/components/rolefit/JobList.tsx           |  16 +-
 dashboard/components/rolefit/RolefitBoard.test.tsx |  26 +
 dashboard/components/rolefit/RolefitBoard.tsx      |  85 ++-
 dashboard/components/rolefit/board.css             |   4 +
 dashboard/lib/analyticsLabels.ts                   |   6 +-
 dashboard/lib/filters.test.ts                      |   1 +
 dashboard/lib/filters.ts                           |   4 +-
 dashboard/lib/jobLifecycle.ts                      |   3 +
 dashboard/lib/jobLifecycleConsumers.db.test.ts     | 100 ++++
 dashboard/lib/jobLifecycleConsumers.test.ts        |  63 +++
 dashboard/lib/jobLifecycleState.ts                 |  72 +++
 dashboard/lib/jobPayloadNotice.ts                  |  15 +
 dashboard/lib/jobsQuery.test.ts                    |   2 +-
 dashboard/lib/jobsQuery.ts                         |  34 +-
 dashboard/lib/metrics.ts                           |  24 +-
 dashboard/lib/queries.ts                           |  41 +-
 dashboard/lib/rolefit/boardFilters.test.ts         |   1 +
 dashboard/lib/rolefit/boardFilters.ts              |  16 +-
 dashboard/lib/rolefit/filter.ts                    |   5 +-
 dashboard/lib/types.ts                             |   3 +
 docs/runbooks/2026-10-07-lifecycle-consumers.md    | 112 ++++
 migrations/2026-10-07-04-lifecycle-feed.sql        |  58 ++
 reviewer/db.py                                     |  36 +-
 schema.sql                                         |  58 ++
 tests/test_reviewer_lifecycle_feed.py              |  57 ++
 104 files changed, 4463 insertions(+), 144 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/default.png b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/default.png
new file mode 100644
index 0000000..da130d4
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/default.png differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/entry.tsx b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/entry.tsx
new file mode 100644
index 0000000..8962332
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/entry.tsx
@@ -0,0 +1,13 @@
+import React from 'react';
+import {createRoot} from 'react-dom/client';
+import {RolefitBoard} from '@/components/rolefit/RolefitBoard';
+import {DEFAULT_FILTERS} from '@/lib/rolefit/filter';
+import '@/app/globals.css';
+const older=new URLSearchParams(location.search).get('older')==='1';
+const lifecycle=(availability:'open'|'unknown'|'closed',anchor:string,expires:string,payload:'available'|'retired')=>({feedEnabled:true,sourceEnabled:true,sourceAvailability:availability,discoveryAnchorAt:anchor,discoveryExpiresAt:expires,payloadAvailability:payload});
+const base={location:'Remote',location_canonicals:['Remote'],remote:true,closed_at:null,company_name:'Offline Fixture',ats:'lever',human_override:false,verdict:null,role_category:null,seniority:null,work_arrangement:null,pay_min:null,pay_max:null,pay_currency:null,pay_period:null,headcount:null,skills_score:null,experience_score:null,comp_score:null,fit_score:null,skill_gaps:[]};
+const jobs=[{...base,id:'lever:fixture:fresh',title:'Recent Engineer',first_seen_at:'2026-10-06T00:00:00Z',lifecycle:lifecycle('open','2026-10-06T00:00:00Z','2026-11-05T00:00:00Z','available')},
+  ...(older?[{...base,id:'lever:fixture:older',title:'Older Live Engineer',first_seen_at:'2026-09-01T00:00:00Z',lifecycle:lifecycle('open','2026-09-01T00:00:00Z','2026-10-01T00:00:00Z','retired')}]:[])];
+createRoot(document.getElementById('root')!).render(<RolefitBoard jobs={jobs} nowIso='2026-10-07T12:00:00Z' isAuthed={false}
+  initialFilters={{...DEFAULT_FILTERS,includeOlderLive:older}} discoveryTotal={jobs.length} saveResume={async()=>{}} rejectJob={async()=>{}} unrejectJob={async()=>{}} markApplied={async()=>{}} unmarkApplied={async()=>{}}
+  hasProfile={false} viewerEmail={null} resumeText='' currentProfileVersion={null} initialPackages={[]} initialRejected={[]}/>);
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/mobile-detail.png b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/mobile-detail.png
new file mode 100644
index 0000000..7c8055e
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/mobile-detail.png differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/older-detail.png b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/older-detail.png
new file mode 100644
index 0000000..e7be7e6
Binary files /dev/null and b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/older-detail.png differ
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/result.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/result.json
new file mode 100644
index 0000000..7e9ccd9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/result.json
@@ -0,0 +1,28 @@
+{
+  "browser": "151.0.7922.173",
+  "target": "owned random loopback port",
+  "boundaries": "fake server props/actions/navigation/API; actual RolefitBoard and components",
+  "assertions": [
+    "default current visible",
+    "default older absent",
+    "default toggle unchecked",
+    "older visible after opt-in",
+    "expiry label",
+    "retirement label",
+    "selected detail",
+    "offline description disclosure",
+    "mobile detail"
+  ],
+  "requests": [
+    "GET /board",
+    "GET /entry.css",
+    "GET /entry.js",
+    "GET /board?older=1",
+    "POST /api/board-filters",
+    "GET /entry.css",
+    "GET /entry.js",
+    "GET /api/jobs/lever:fixture:older"
+  ],
+  "errors": [],
+  "blocked": []
+}
\ No newline at end of file
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs
new file mode 100644
index 0000000..5837389
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs
@@ -0,0 +1,58 @@
+// Actual RolefitBoard browser; fake server props/actions/navigation/data only. No auth/providers.
+const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
+const root=process.cwd(),dir=__dirname;
+const esbuild=require(path.join(root,'dashboard/node_modules/esbuild'));
+const {chromium,expect}=require(path.join(root,'dashboard/node_modules/@playwright/test'));
+(async()=>{
+  const output=path.join('/tmp','task9-browser-bundle');fs.mkdirSync(output,{recursive:true});
+  await esbuild.build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,outdir:output,jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},tsconfig:path.join(root,'dashboard/tsconfig.json'),nodePaths:[path.join(root,'dashboard/node_modules')],plugins:[{name:'offline-boundaries',setup(build){
+    build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'offline'}));
+    build.onResolve({filter:/^@\/app\/actions\//},args=>({path:args.path,namespace:'offline'}));
+    build.onLoad({filter:/.*/,namespace:'offline'},args=>{
+      if(args.path==='navigation') return {contents:'export const useRouter=()=>({push:url=>location.assign(url),refresh:()=>location.reload(),replace:url=>location.replace(url)});',loader:'js'};
+      const original=fs.readFileSync(path.join(root,'dashboard',args.path.slice(2)+'.ts'),'utf8');
+      const names=[...original.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
+      return {contents:names.map(name=>`export const ${name}=async()=>{throw new Error("Fake browser actions must not run")};`).join('\n'),loader:'js'};
+    });
+  }}]});
+  const requests=[],errors=[],blocked=[];
+  const server=http.createServer((req,res)=>{
+    requests.push(req.method+' '+req.url);
+    if(req.url.startsWith('/api/jobs/')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({description:'Offline current posting',descriptionIsSaved:false,requirements:'broken',benefits:'["Health"]',questions:null,lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'open',discoveryAnchorAt:'2026-09-01T00:00:00Z',discoveryExpiresAt:'2026-10-01T00:00:00Z',payloadAvailability:'retired'}}));return;}
+    if(req.url.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end('{}');return;}
+    const filename=req.url==='/entry.js'?'entry.js':req.url==='/entry.css'?'entry.css':null;
+    if(filename){res.setHeader('Content-Type',filename.endsWith('css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(output,filename)));return;}
+    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script src="/entry.js"></script></body></html>');
+  });
+  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
+  const port=server.address().port,base=`http://127.0.0.1:${port}`;
+  let browser;
+  try {
+    browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
+    const page=await browser.newPage({viewport:{width:1280,height:800}});
+    page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(10000);
+    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser page error: '+error.message);});
+    await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort();}return route.continue();});
+    await page.goto(base+'/board');
+    await expect(page.getByText('Recent Engineer',{exact:true})).toBeVisible();
+    await expect(page.getByText('Older Live Engineer',{exact:true})).toHaveCount(0);
+    await expect(page.getByRole('checkbox',{name:'Include older live jobs'})).not.toBeChecked();
+    await page.screenshot({path:path.join(dir,'default.png'),fullPage:true});
+    await page.getByRole('checkbox',{name:'Include older live jobs'}).check();
+    await page.waitForURL('**?older=1');
+    await expect(page.getByText('Older Live Engineer',{exact:true})).toBeVisible();
+    await expect(page.getByText('Discovery expired',{exact:true})).toBeVisible();
+    await expect(page.getByText('Posting payload retired',{exact:true})).toBeVisible();
+    await page.getByRole('button',{name:/Older Live Engineer/}).click();
+    await expect(page.getByRole('heading',{name:'Older Live Engineer',level:1})).toBeVisible();
+    await page.getByRole('button',{name:'Show full job description'}).click();
+    await expect(page.getByText('Offline current posting',{exact:true})).toBeVisible();
+    await page.screenshot({path:path.join(dir,'older-detail.png'),fullPage:true});
+    await page.setViewportSize({width:390,height:844});
+    await expect(page.getByRole('heading',{name:'Older Live Engineer',level:1})).toBeVisible();
+    await page.screenshot({path:path.join(dir,'mobile-detail.png'),fullPage:true});
+    if(errors.length||blocked.length) throw new Error(JSON.stringify({errors,blocked}));
+    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({browser:browser.version(),target:'owned random loopback port',boundaries:'fake server props/actions/navigation/API; actual RolefitBoard and components',assertions:["default current visible","default older absent","default toggle unchecked","older visible after opt-in","expiry label","retirement label","selected detail","offline description disclosure","mobile detail"],requests,errors,blocked},null,2));
+    console.log('PASS: actual public board, older-live opt-in, independent expiry/source/payload labels, detail JSON tolerance, desktop/mobile; Chromium '+browser.version());
+  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
+})().catch(error=>{console.error(error);process.exitCode=1;});
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/chronology.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/chronology.md
new file mode 100644
index 0000000..91b935e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/chronology.md
@@ -0,0 +1,120 @@
+# Task9 verification chronology and selection
+
+All shell commands used `/bin/bash` with login startup disabled. All DB commands
+used owned random loopback targets via `tools/lifecycle_test_db.py`, never55432.
+Ordinary feature tests only. No Task3 omitted mechanism probes, transport suite,
+reserved feedback/destructive fixtures, real ATS/provider/model/auth or production
+write/activation was invoked. Fixture DDL resets only its harness-owned database.
+
+- Unit RED (`task9-red.txt`): 5 new cases failed for missing lifecycle parser,
+  predicate/count builder and history owner guard. Unit GREEN followed.
+- Reviewer RED on owned17.11 (`task9-reviewer-red.txt`): flag-off candidate
+  incorrectly absent due to the old unconditional expiry check. Shared SQL
+  predicate fixed this ordinary candidate feature regression.
+- First DB RED (`task9-db-red.txt`): fixture violated existing applied timestamp
+  constraint; fixed only fixture applied_at. Corrected RED (`task9-db-red2.txt`):
+  4 cases failed on missing read-only projection. First GREEN `task9-db17.txt`:
+  4 passed,17.11.
+- UI RED (`task9-ui-red.txt`): absent older/history controls. First GREEN attempt
+  (`task9-ui-green.txt`) uncovered deep-link fixture and zero-width jsdom
+  virtual-list effects. Corrected test navigation/viewport fixture, preserving
+  actual components: `task9-ui-green2.txt` 2 passed /9 tests filtered out by `-t`
+  (Vitest prints skipped for these name-filtered tests).
+- Actual history open plus total HTTP boundary RED (`task9-detail-red.txt`):
+  selected history row was absent from detail lookup and parser missing. GREEN
+  (`task9-detail-green.txt`): 2 passed /15 name-filtered tests. The jsdom narrow
+  open prints its ordinary unimplemented `window.scrollTo` notice.
+- Route RED (`task9-route-red.txt`): closed sources lacked deferred current
+  hydration response. Route now retains saved detail and queues no new current
+  demand for proven closure; included in subsequent selected GREEN.
+- First selected broad feature pass: `task9-selected-green.txt` 165/11files.
+  Previous `task9-selected.txt` was 161passed/3failed because new filter defaults
+  and new query predicate needed corresponding old expectations updated.
+- First broader dashboard non-DB run (`task9-dashboard-full.txt`):
+  1706passed/4failed/2skipped,217files. Task9 source UI contract failure had five
+  raw-control/geometry/link issues, fixed with shared Buttons/ButtonLinks and
+  labelled checkbox/CSS. An 18px explicit input-size contract failure followed
+  (`task9-ui-contract-green.txt`); removed explicit input dimensions, leaving
+  labelled 44px target. `task9-ui-contract-final.txt`:32passed/3files.
+- Three broader dashboard failures predate Task9: two live-action cases in
+  `app/actions/tombstoneGuard.test.ts` mock db without Task8 demand/mutation
+  exports; workflow contract expects two DATABASE_URL entries while BASE CI has
+  three. BASE source inspection confirms those conditions; these files unchanged.
+- Browser dependency download failed HTTP403 `Domain forbidden` from the normal
+  Playwright CDN (`task9-browser-install.txt`). No alternate host or bypass.
+  Readable installed `/usr/bin/chromium`151.0.7922.173 supplied local browser.
+- Fake browser initial bundle (`task9-browser.txt`) exposed transitive DB imports
+  from new client lifecycle consumers. Fixed by client-safe `jobLifecycleState`
+  and server-facing reexports. The next harness needed a normal process.env
+  placeholder (`task9-browser2.txt`,`task9-browser3.txt`), then an actual
+  disclosure-button locator (`task9-browser4.txt`). Those are harness attempts,
+  not product/browser successes. Success logs are `task9-browser-final.txt`,
+  `task9-browser-complete.txt` and final `task9-browser-release.txt`; screenshot
+  and actual nine-assertion result in `browser/`. Same browser scope, not summed.
+- DB actual getJobsPage profile fixture initially lacked required profile_version:
+  `task9-db17-final.txt` and `task9-db16-final.txt`:4passed/1failed. Corrected
+  fixture and added actual closed-status case; final `task9-db17-complete.txt`
+  and `task9-db16-complete.txt`:6passed each,17.11/16.15, no skipped DB tests.
+  They install the additive migration twice against pre-Task9 schema and verify
+  schema.sql suffix parity. No unrelated DB suites rerun.
+- Closed filter RED `task9-closed-red.txt`, timezone-free parser RED
+  `task9-utc-red.txt`; fixed respective source-closure predicate and zoned ISO
+  validation. Covered in final selected GREEN.
+- Some author editing commands failed before editing due to wrong cwd-relative
+  paths and one unterminated Python string. No product edits occurred on those
+  failed commands. Tests chained afterward did execute; their logs are retained:
+  `task9-selected-final.txt` and `task9-selected-complete.txt` were launched at
+  repo root and hit UI-contract fixture paths (11 failures), with one additionally
+  retaining the timezone RED before its patch. Correct dashboard cwd run
+  `task9-selected-cwd-final.txt`:182passed/1UI-audit timeout under concurrent
+  broader test load. Subsequent uncrowded `task9-selected-final-pin.txt`:
+  183passed/12files. These intermediate filenames are chronology, not source pins.
+- Second broader non-DB run `task9-dashboard-final.txt`:
+  1708passed/4failed/2skipped,217files. It started before UTC parser correction:
+  includes that Task9 RED plus the same three inherited fixture gaps. Do not call
+  the broad suite green or sum overlapping runs. All new feature failures are
+  covered by the final scoped passing selection; inherited three remain for13.
+- Analytics actual caption RED `task9-analytics-red.txt`:1failed/9name-filtered;
+  corrected discovery/retained-history scope labels without implying closure.
+- FINAL scoped TS selection `task9-selected-release.txt`:193passed/13files,
+  no skips. Reviewer selection before final count fix `task9-reviewer17-complete.txt` and
+  `task9-reviewer16-complete.txt`:8passed/30deselected each,17.11/16.15. Earlier
+  repeated runs are not additional unique cases.
+- Final typecheck `task9-typecheck-source.txt` (`npm run typecheck`):exit0; prior empty-output `task9-typecheck-verified.txt`:exit0; final lint
+  `task9-lint-release.txt`:exit0,9warnings/0errors, all retained older warnings
+  (TanStack compiler warning, existing other modules/config). Earlier lint had
+  new missing isAuthed dependency, fixed. Final Ruff `task9-ruff-final.txt`:pass (prior `task9-ruff-release.txt` also passed).
+  `task9-diff-final.txt`:exit0. Exact final source pin is in the report.
+- One ordinary exec_command failed create-process with
+  `exec-server transport disconnected`. Immediate read retry succeeded in the
+  same environment. No executor replacement/reinitialization, capacity workaround
+  or completed-stage restart. This is distinct from refused Task3 security work.
+
+- Final reviewer count/page ordinary feature regression RED
+  `task9-reviewer-count-red.txt`:1failed/1deselected on17.11, recording two actual
+  candidate SELECTs. Replaced the two reads with count/page subqueries in ONE
+  statement, stable first-seen/job-ID order and unchanged candidate DTO. Final
+  `task9-reviewer17-release.txt` and `task9-reviewer16-release.txt`:9passed and
+  30deselected each,17.11/16.15. This checks actual query use/results; it is not a
+  two-session adversarial/expiry-enforcement mechanism probe.
+
+Final TS command from dashboard:
+
+```
+./node_modules/.bin/vitest run lib/jobLifecycleConsumers.test.ts lib/jobsQuery.test.ts lib/filters.test.ts lib/rolefit/boardFilters.test.ts lib/rolefit/filter.test.ts lib/queries.jobDetail.test.ts lib/queries.reviewFeed.test.ts components/rolefit/RolefitBoard.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/JobCard.test.tsx 'app/api/jobs/[id]/route.test.ts' components/analytics/SecondarySurfaceFixes.test.tsx app/ui-contract.test.ts
+```
+
+Final DB command from repo (MAJOR17 then16; each invocation owns its own DB):
+
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
+```
+
+Broader non-DB selection from dashboard:
+`npm test -- --exclude '**/*.db.test.ts'`. Two genuine skipped non-DB cases are
+preexisting missing-binary-PDF cases:
+`lib/rolefit/fileToResumeMarkdown.test.ts` — "converts the real PDF to parseable markdown";
+`lib/rolefit/parseProfile.test.ts` — "parses the binary via the PDF path".
+Do not confuse them with the name-filtered `-t` attempts. No broad
+old pytest, feedback/safety fixture or reserved shared service was used.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-analytics-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-analytics-red.txt
new file mode 100644
index 0000000..24e2c59
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-analytics-red.txt
@@ -0,0 +1,152 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ components/analytics/SecondarySurfaceFixes.test.tsx (10 tests | 1 failed | 9 skipped) 167ms
+   × discovery totals do not claim employer openness and distinguish retained applied history 165ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  components/analytics/SecondarySurfaceFixes.test.tsx > discovery totals do not claim employer openness and distinguish retained applied history
+TestingLibraryElementError: Unable to find an element with the text: In discovery. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div>[39m
+      [36m<div[39m
+        [33mstyle[39m=[32m"font-size: 12.5px; color: var(--text-secondary); margin: -6px 0px 12px;"[39m
+      [36m>[39m
+        [0mCurrent snapshot — job rows count open jobs only; bars within a group share a scale, and the % text is the honest figure.[0m
+      [36m</div>[39m
+      [36m<div[39m
+        [33mstyle[39m=[32m"display: flex; gap: 32px; flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px;"[39m
+      [36m>[39m
+        [36m<div[39m
+          [33mstyle[39m=[32m"flex: 1 1 380px; min-width: 0px;"[39m
+        [36m>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px;"[39m
+          [36m>[39m
+            [0mCompanies — Company Discovery[0m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"display: flex; flex-direction: column; gap: 7px;"[39m
+          [36m>[39m
+            [36m<div[39m
+              [33mstyle[39m=[32m"font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.4px; margin: 16px 0px 8px; text-transform: uppercase;"[39m
+            [36m>[39m
+              [0mPipeline stages[0m
+            [36m</div>[39m
+            [36m<div[39m
+              [33mstyle[39m=[32m"display: flex; align-items: center; gap: 10px;"[39m
+            [36m>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 148px; flex: 0 0 auto; font-size: 12px; color: var(--text-secondary); font-weight: 600;"[39m
+              [36m>[39m
+                [0mTracked[0m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"flex: 1 1 0%; min-width: 40px; height: 20px; background: var(--bg-muted); border-radius: 6px; overflow: hidden;"[39m
+              [36m>[39m
+                [36m<div[39m
+                  [33mstyle[39m=[32m"width: 100%; height: 100%; background: var(--chart-stage); border-radius: 6px; min-width: 3px;"[39m
+                [36m/>[39m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 62px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--text-primary);"[39m
+              [36m>[39m
+                [0m1[0m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 74px; text-align: right; font-size: 11px; color: var(--text-secondary);"[39m
+              [36m/>[39m
+            [36m</div>[39m
+            [36m<div[39m
+              [33mstyle[39m=[32m"display: flex; align-items: center; gap: 10px;"[39m
+            [36m>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 148px; flex: 0 0 auto; font-size: 12px; color: var(--text-secondary); font-weight: 600;"[39m
+              [36m>[39m
+                [36m<span[39m
+                  [33mstyle[39m=[32m"position: relative; display: inline-flex; align-items: center;"[39m
+                [36m>[39m
+                  [36m<span[39m
+                    [33maria-expanded[39m=[32m"false"[39m
+                    [33maria-label[39m=[32m"Found by discovery. Companies the discovery pipeline found automatically (rather than ones added by hand)."[39m
+                    [33mclass[39m=[32m"rf-info-tip__trigger rf-focusable"[39m
+                    [33mrole[39m=[32m"button"[39m
+                    [33mstyle[39m=[32m"border-bottom: 1px dotted var(--text-muted); cursor: help; color: var(--text-secondary);"[39m
+                    [33mtabindex[39m=[32m"0"[39m
+                  [36m>[39m
+                    [0mFound by discovery[0m
+                  [36m</span>[39m
+                [36m</span>[39m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"flex: 1 1 0%; min-width: 40px; height: 20px; background: var(--bg-muted); border-radius: 6px; overflow: hidden;"[39m
+              [36m>[39m
+                [36m<div[39m
+                  [33mstyle[39m=[32m"width: 100%; height: 100%; background: var(--chart-stage); border-radius: 6px; min-width: 3px;"[39m
+                [36m/>[39m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 62px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--text-primary);"[39m
+              [36m>[39m
+                [0m1[0m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 74px; text-align: right; font-size: 11px; color: var(--text-secondary);"[39m
+              [36m>[39m
+                [0m100% of tracked[0m
+              [36m</div>[39m
+            [36m</div>[39m
+            [36m<div[39m
+              [33mstyle[39m=[32m"display: flex; align-items: center; gap: 10px;"[39m
+            [36m>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 148px; flex: 0 0 auto; font-size: 12px; color: var(--text-secondary); font-weight: 600;"[39m
+              [36m>[39m
+                [0mClassified[0m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"flex: 1 1 0%; min-width: 40px; height: 20px; background: var(--bg-muted); border-radius: 6px; overflow: hidden;"[39m
+              [36m>[39m
+                [36m<div[39m
+                  [33mstyle[39m=[32m"width: 100%; height: 100%; background: var(--chart-stage); border-radius: 6px; min-width: 3px;"[39m
+                [36m/>[39m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 62px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--text-primary);"[39m
+              [36m>[39m
+                [0m1[0m
+              [36m</div>[39m
+              [36m<div[39m
+                [33mstyle[39m=[32m"width: 74px; text-align: right; font-size: 11px; color: var(--text-secondary);"[39m
+              [36m>[39m
+                [0m100% of found[0m
+              [36m</div>[39m
+            [36m</div>[39m
+            [36m<div[39m
+              [33mstyle[39m=[32m"font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.4px; margin: 16px 0px 8px; text-transform: uppercase;"[39m
+            [36m>[39m
+              [36m<span[39m
+                [33mstyle[39m=[32m"position: relative; display: inline-flex; align-items: center;"[39m
+              [36m>[39m
+                [36m<span[39m
+                  [33maria-expanded[39m=[32m"false"[39m
+                  [33maria-label[39m=[32m"Verdicts. Counts every classified company, including a few you added by hand — so these can total slightly more than the discovery-only 'Classified' stage above."[39m
+                 ...
+ ❯ Object.getElementError ../../../../dashboard/node_modules/@testing-library/dom/dist/config.js:37:19
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:76:38
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:52:17
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:95:19
+ ❯ components/analytics/SecondarySurfaceFixes.test.tsx:119:17
+
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 9 skipped (10)
+   Start at  20:06:02
+   Duration  1.42s (transform 149ms, setup 0ms, import 238ms, tests 167ms, environment 700ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-complete.txt
new file mode 100644
index 0000000..0e26dc0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-complete.txt
@@ -0,0 +1 @@
+PASS: actual public board, older-live opt-in, independent expiry/source/payload labels, detail JSON tolerance, desktop/mobile; Chromium 151.0.7922.173
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-final.txt
new file mode 100644
index 0000000..0e26dc0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-final.txt
@@ -0,0 +1 @@
+PASS: actual public board, older-live opt-in, independent expiry/source/payload labels, detail JSON tolerance, desktop/mobile; Chromium 151.0.7922.173
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-install.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-install.txt
new file mode 100644
index 0000000..304ee64
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-install.txt
@@ -0,0 +1,36 @@
+Downloading Chrome for Testing 149.0.7827.55 (playwright chromium v1228)[2m from https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip[22m
+Error: Download failed: server returned code 403 body 'Domain forbidden'. URL: https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip
+    at IncomingMessage.handleError (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27916:23)
+    at IncomingMessage.emit (node:events:521:24)
+    at endReadableNT (node:internal/streams/readable:1736:12)
+    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
+Downloading Chrome for Testing 149.0.7827.55 (playwright chromium v1228)[2m from https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip[22m
+Error: Download failed: server returned code 403 body 'Domain forbidden'. URL: https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip
+    at IncomingMessage.handleError (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27916:23)
+    at IncomingMessage.emit (node:events:521:24)
+    at endReadableNT (node:internal/streams/readable:1736:12)
+    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
+Downloading Chrome for Testing 149.0.7827.55 (playwright chromium v1228)[2m from https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip[22m
+Error: Download failed: server returned code 403 body 'Domain forbidden'. URL: https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip
+    at IncomingMessage.handleError (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27916:23)
+    at IncomingMessage.emit (node:events:521:24)
+    at endReadableNT (node:internal/streams/readable:1736:12)
+    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
+Downloading Chrome for Testing 149.0.7827.55 (playwright chromium v1228)[2m from https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip[22m
+Error: Download failed: server returned code 403 body 'Domain forbidden'. URL: https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip
+    at IncomingMessage.handleError (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27916:23)
+    at IncomingMessage.emit (node:events:521:24)
+    at endReadableNT (node:internal/streams/readable:1736:12)
+    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
+Downloading Chrome for Testing 149.0.7827.55 (playwright chromium v1228)[2m from https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip[22m
+Error: Download failed: server returned code 403 body 'Domain forbidden'. URL: https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip
+    at IncomingMessage.handleError (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27916:23)
+    at IncomingMessage.emit (node:events:521:24)
+    at endReadableNT (node:internal/streams/readable:1736:12)
+    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
+Failed to install browsers
+Error: Failed to download Chrome for Testing 149.0.7827.55 (playwright chromium v1228), caused by
+Error: Download failure, code=1
+    at ChildProcess.<anonymous> (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:27793:32)
+    at ChildProcess.emit (node:events:509:28)
+    at ChildProcess._handle.onexit (node:internal/child_process:295:12)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-release.txt
new file mode 100644
index 0000000..0e26dc0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser-release.txt
@@ -0,0 +1 @@
+PASS: actual public board, older-live opt-in, independent expiry/source/payload labels, detail JSON tolerance, desktop/mobile; Chromium 151.0.7922.173
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser.txt
new file mode 100644
index 0000000..122189c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser.txt
@@ -0,0 +1,84 @@
+✘ [ERROR] Could not resolve "os"
+
+    ../../../dashboard/node_modules/postgres/src/index.js:1:15:
+      1 │ import os from 'os'
+        ╵                ~~~~
+
+  The package "os" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "fs"
+
+    ../../../dashboard/node_modules/postgres/src/index.js:2:15:
+      2 │ import fs from 'fs'
+        ╵                ~~~~
+
+  The package "fs" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "stream"
+
+    ../../../dashboard/node_modules/postgres/src/large.js:1:19:
+      1 │ import Stream from 'stream'
+        ╵                    ~~~~~~~~
+
+  The package "stream" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "net"
+
+    ../../../dashboard/node_modules/postgres/src/connection.js:1:16:
+      1 │ import net from 'net'
+        ╵                 ~~~~~
+
+  The package "net" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "tls"
+
+    ../../../dashboard/node_modules/postgres/src/connection.js:2:16:
+      2 │ import tls from 'tls'
+        ╵                 ~~~~~
+
+  The package "tls" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "crypto"
+
+    ../../../dashboard/node_modules/postgres/src/connection.js:3:19:
+      3 │ import crypto from 'crypto'
+        ╵                    ~~~~~~~~
+
+  The package "crypto" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "stream"
+
+    ../../../dashboard/node_modules/postgres/src/connection.js:4:19:
+      4 │ import Stream from 'stream'
+        ╵                    ~~~~~~~~
+
+  The package "stream" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+✘ [ERROR] Could not resolve "perf_hooks"
+
+    ../../../dashboard/node_modules/postgres/src/connection.js:5:28:
+      5 │ import { performance } from 'perf_hooks'
+        ╵                             ~~~~~~~~~~~~
+
+  The package "perf_hooks" wasn't found on the file system but is built into node. Are you trying to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
+
+Error: Build failed with 8 errors:
+../../../dashboard/node_modules/postgres/src/connection.js:1:16: ERROR: Could not resolve "net"
+../../../dashboard/node_modules/postgres/src/connection.js:2:16: ERROR: Could not resolve "tls"
+../../../dashboard/node_modules/postgres/src/connection.js:3:19: ERROR: Could not resolve "crypto"
+../../../dashboard/node_modules/postgres/src/connection.js:4:19: ERROR: Could not resolve "stream"
+../../../dashboard/node_modules/postgres/src/connection.js:5:28: ERROR: Could not resolve "perf_hooks"
+...
+    at failureErrorWithLog (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:1748:15)
+    at /workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:1207:25
+    at runOnEndCallbacks (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:1588:45)
+    at buildResponseToResult (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:1205:7)
+    at /workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:1232:16
+    at responseCallbacks.<computed> (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:884:9)
+    at handleIncomingPacket (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:939:12)
+    at Socket.readFromStdout (/workspace/job-board/dashboard/node_modules/esbuild/lib/main.js:862:7)
+    at Socket.emit (node:events:509:28)
+    at addChunk (node:internal/streams/readable:563:12) {
+  errors: [Getter/Setter],
+  warnings: [Getter/Setter]
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser2.txt
new file mode 100644
index 0000000..e9d2076
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser2.txt
@@ -0,0 +1,38 @@
+ExpectError: expect(locator).toBeVisible() failed
+
+Locator: getByText('Recent Engineer', { exact: true })
+Expected: visible
+Timeout: 5000ms
+Error: element(s) not found
+
+Call log:
+  - Expect "to.be.visible" with timeout 5000ms
+  - waiting for getByText('Recent Engineer', { exact: true })
+
+    at captureRawStack (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:3172:17)
+    at callMatcherAsStep (/workspace/job-board/dashboard/node_modules/playwright/lib/matchers/expect.js:12877:57)
+    at Object.toBeVisible (/workspace/job-board/dashboard/node_modules/playwright/lib/matchers/expect.js:12867:23)
+    at /workspace/job-board/.claude/worktrees/lifecycle-recovery/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs:36:66 {
+  matcherResult: {
+    message: 'expect(locator).toBeVisible() failed\n' +
+      '\n' +
+      "Locator: getByText('Recent Engineer', { exact: true })\n" +
+      'Expected: visible\n' +
+      'Timeout: 5000ms\n' +
+      'Error: element(s) not found\n' +
+      '\n' +
+      'Call log:\n' +
+      '  - Expect "to.be.visible" with timeout 5000ms\n' +
+      "  - waiting for getByText('Recent Engineer', { exact: true })\n",
+    pass: false,
+    actual: undefined,
+    name: 'toBeVisible',
+    expected: 'visible',
+    log: [
+      '  - Expect "to.be.visible" with timeout 5000ms',
+      "  - waiting for getByText('Recent Engineer', { exact: true })"
+    ],
+    timeout: 5000,
+    ariaSnapshot: ''
+  }
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser3.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser3.txt
new file mode 100644
index 0000000..d34089f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser3.txt
@@ -0,0 +1,39 @@
+Browser page error: process is not defined
+ExpectError: expect(locator).toBeVisible() failed
+
+Locator: getByText('Recent Engineer', { exact: true })
+Expected: visible
+Timeout: 5000ms
+Error: element(s) not found
+
+Call log:
+  - Expect "to.be.visible" with timeout 5000ms
+  - waiting for getByText('Recent Engineer', { exact: true })
+
+    at captureRawStack (/workspace/job-board/dashboard/node_modules/playwright-core/lib/coreBundle.js:3172:17)
+    at callMatcherAsStep (/workspace/job-board/dashboard/node_modules/playwright/lib/matchers/expect.js:12877:57)
+    at Object.toBeVisible (/workspace/job-board/dashboard/node_modules/playwright/lib/matchers/expect.js:12867:23)
+    at /workspace/job-board/.claude/worktrees/lifecycle-recovery/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs:36:66 {
+  matcherResult: {
+    message: 'expect(locator).toBeVisible() failed\n' +
+      '\n' +
+      "Locator: getByText('Recent Engineer', { exact: true })\n" +
+      'Expected: visible\n' +
+      'Timeout: 5000ms\n' +
+      'Error: element(s) not found\n' +
+      '\n' +
+      'Call log:\n' +
+      '  - Expect "to.be.visible" with timeout 5000ms\n' +
+      "  - waiting for getByText('Recent Engineer', { exact: true })\n",
+    pass: false,
+    actual: undefined,
+    name: 'toBeVisible',
+    expected: 'visible',
+    log: [
+      '  - Expect "to.be.visible" with timeout 5000ms',
+      "  - waiting for getByText('Recent Engineer', { exact: true })"
+    ],
+    timeout: 5000,
+    ariaSnapshot: ''
+  }
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser4.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser4.txt
new file mode 100644
index 0000000..f6af886
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-browser4.txt
@@ -0,0 +1,10 @@
+locator.click: Timeout 30000ms exceeded.
+Call log:
+[2m  - waiting for getByText('Full job description', { exact: true })[22m
+
+    at /workspace/job-board/.claude/worktrees/lifecycle-recovery/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs:47:63 {
+  log: [
+    "  - waiting for getByText('Full job description', { exact: true })"
+  ],
+  name: 'TimeoutError'
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-closed-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-closed-red.txt
new file mode 100644
index 0000000..0fc41ff
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-closed-red.txt
@@ -0,0 +1,38 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.test.ts (7 tests | 1 failed | 6 skipped) 12ms
+   × closed filter uses proven source closure instead of discovery expiry 10ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > closed filter uses proven source closure instead of discovery expiry
+AssertionError: expected 'SELECT j.id, j.title, j.location, j.l…' to contain 'public.lifecycle_source_closed(j.id, …'
+
+- Expected
++ Received
+
+- public.lifecycle_source_closed(j.id, j.closed_at)
++ SELECT j.id, j.title, j.location, j.location_canonicals, j.remote, public.lifecycle_job_state(j.id) AS lifecycle, j.first_seen_at, j.closed_at, COALESCE(c.display_name, c.name) AS company_name, c.ats, c.industry, c.size, c.hq_country
++ FROM jobs j
++ JOIN companies c ON c.id = j.company_id
++ WHERE j.closed_at IS NOT NULL AND j.title ILIKE $1
++ ORDER BY j.first_seen_at DESC, j.id ASC
++ LIMIT 500
++ OFFSET 0
+
+ ❯ lib/jobLifecycleConsumers.test.ts:57:22
+     55| it('closed filter uses proven source closure instead of discovery expi…
+     56|   const query=buildJobsQuery({...serverBoardFilters('anon'),status:'cl…
+     57|   expect(query.text).toContain('public.lifecycle_source_closed(j.id, j…
+       |                      ^
+     58|   expect(query.text).not.toContain('WHERE j.closed_at IS NOT NULL');
+     59| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 6 skipped (7)
+   Start at  19:57:43
+   Duration  497ms (transform 135ms, setup 0ms, import 163ms, tests 12ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers-final.txt
new file mode 100644
index 0000000..46ca366
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers-final.txt
@@ -0,0 +1,99 @@
+job_discovery/db.py:118:        description = CASE WHEN jobs.description IS NULL AND NOT jobs.description_pruned
+job_discovery/db.py:120:        last_seen_at = now(),
+job_discovery/db.py:121:        closed_at    = NULL
+job_discovery/db.py:122:    WHERE jobs.closed_at IS NOT NULL
+job_discovery/db.py:127:       OR (jobs.description IS NULL AND NOT jobs.description_pruned
+job_discovery/db.py:148:    skipped update is counted as not new. Note: last_seen_at does not advance for
+job_discovery/db.py:186:            "SELECT external_id FROM jobs WHERE company_id = %s AND closed_at IS NULL",
+job_discovery/db.py:206:            "UPDATE jobs SET closed_at = NULL WHERE company_id = %s "
+job_discovery/db.py:207:            "AND closed_at IS NOT NULL AND external_id = ANY(%s)",
+job_discovery/db.py:218:            "UPDATE jobs SET closed_at = now() "
+job_discovery/db.py:219:            "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
+job_discovery/db.py:282:            WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
+job_discovery/lifecycle/demand.py:220:        AND j.closed_at IS NULL ORDER BY l.id LIMIT 1""",
+job_discovery/lifecycle/demand.py:323:                description_captured_at=clock_timestamp(),description_capture_provenance='demand',description_pruned=false
+job_discovery/lifecycle/maintenance.py:167:                conn.execute('UPDATE jobs SET description=NULL,description_pruned=true WHERE id=%s', (row['id'],))
+job_discovery/lifecycle/identity.py:120:                discovery_expires_at,legacy_closed_at)
+job_discovery/lifecycle/identity.py:126:                    job["first_seen_at"],
+job_discovery/lifecycle/identity.py:127:                    job["first_seen_at"],
+job_discovery/lifecycle/identity.py:128:                    job["first_seen_at"].astimezone(UTC) + timedelta(days=30),
+job_discovery/lifecycle/identity.py:129:                    job["closed_at"],
+job_discovery/lifecycle/identity.py:487:            discovered = job["first_seen_at"] if job else now
+job_discovery/lifecycle/identity.py:497:                    source_published_at,source_published_provenance,legacy_closed_at)
+job_discovery/lifecycle/identity.py:509:                        job["closed_at"] if job else None,
+job_discovery/lifecycle/reconcile.py:145:        conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
+job_discovery/lifecycle/reconcile.py:215:       WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
+job_discovery/lifecycle/reconcile.py:270:            conn.execute("""UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s
+reviewer/db.py:269:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
+reviewer/db.py:298:          AND (%(hydrate)s OR NOT COALESCE(j.description_pruned, FALSE))
+reviewer/db.py:312:              COALESCE(jsonb_agg(to_jsonb(candidate) - '_candidate_first_seen'
+reviewer/db.py:313:                ORDER BY candidate._candidate_first_seen DESC, candidate.id ASC)
+reviewer/db.py:320:                c.red_flags, c.about, j.first_seen_at AS _candidate_first_seen
+reviewer/db.py:321:              {_where} ORDER BY j.first_seen_at DESC, j.id ASC LIMIT %(lim)s
+job_discovery/prune.py:23:    j.closed_at IS NOT NULL
+job_discovery/prune.py:24:    AND j.closed_at < now() - make_interval(days => %s)
+job_discovery/prune.py:33:ORDER BY j.closed_at, j.id
+job_discovery/prune.py:89:    closed_at is written after complete source reconciliation; last_seen_at is
+dashboard/lib/types.ts:45:  first_seen_at: string | Date;
+dashboard/lib/types.ts:46:  closed_at: string | Date | null;
+dashboard/lib/types.ts:69:  first_seen_at: string;
+dashboard/lib/types.ts:70:  closed_at: string | null;
+dashboard/components/rolefit/JobDetail.test.tsx:22:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobDetail.test.tsx:23:    closed_at: null,
+dashboard/components/rolefit/ReviewNowPanel.test.tsx:26:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/ReviewNowPanel.test.tsx:27:  closed_at: null,
+dashboard/lib/jobsQuery.ts:181:    "j.first_seen_at", "j.closed_at", "COALESCE(c.display_name, c.name) AS company_name",
+dashboard/lib/jobsQuery.ts:220:  const pageSql = opts.countOnly ? [] : ["ORDER BY j.first_seen_at DESC, j.id ASC", `LIMIT ${limit}`, `OFFSET ${offset}`];
+dashboard/components/rolefit/JobCard.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobCard.test.tsx:21:    closed_at: null,
+dashboard/components/rolefit/JobCard.test.tsx:94:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobCard.test.tsx:95:    closed_at: null,
+dashboard/components/rolefit/ApplicationPanel.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/ApplicationPanel.test.tsx:21:    closed_at: null,
+dashboard/components/rolefit/RolefitBoard.liveMatches.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
+dashboard/lib/queries.ts:42:    first_seen_at: iso(row.first_seen_at),
+dashboard/lib/queries.ts:43:    closed_at: row.closed_at != null ? iso(row.closed_at) : null,
+dashboard/lib/queries.ts:99:      SELECT total.total, COALESCE(jsonb_agg(page ORDER BY page.first_seen_at DESC,page.id ASC) FILTER (WHERE page.id IS NOT NULL),'[]'::jsonb) AS rows
+dashboard/lib/queries.ts:288:    WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
+dashboard/lib/queries.ts:331:      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+dashboard/lib/queries.ts:335:      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND remote IS TRUE
+dashboard/components/rolefit/JobDetail.tsx:179:  const postedText = "Discovered " + fmtPosted(job.first_seen_at, nowIso);
+dashboard/components/rolefit/RolefitBoard.tsx:588:      : !j.closed_at && discoveryVisible(j.lifecycle,includeOlderLive,nowIso))), [boardJobs,includeOlderLive,nowIso]);
+dashboard/lib/queries.reviewFeed.test.ts:50:        remote: true, first_seen_at: new Date("2026-07-01T00:00:00.000Z"),
+dashboard/lib/queries.reviewFeed.test.ts:51:        closed_at: null, company_name: "Acme", ats: "greenhouse",
+dashboard/lib/queries.reviewFeed.test.ts:65:      first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/lib/jobLifecycleConsumers.test.ts:57:  expect(query.text).toContain('public.lifecycle_source_closed(j.id, j.closed_at)');
+dashboard/lib/jobLifecycleConsumers.test.ts:58:  expect(query.text).not.toContain('WHERE j.closed_at IS NOT NULL');
+dashboard/components/rolefit/RolefitBoard.test.tsx:23:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/RolefitBoard.test.tsx:24:  closed_at: null,
+dashboard/components/rolefit/RolefitBoard.test.tsx:236:  const saved={...job,id:'saved',title:'Saved Role',closed_at:'2026-07-01T00:00:00Z',lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'closed' as const,discoveryAnchorAt:'2026-06-01T00:00:00.000Z',discoveryExpiresAt:'2026-07-01T00:00:00.000Z',payloadAvailability:'retired' as const}};
+dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx:22:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx:23:  closed_at: null,
+dashboard/components/rolefit/VisualBoardState.tsx:15:  location: "Remote", location_canonicals: null, remote: true, first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
+dashboard/lib/queries.locationScoping.db.test.ts:35:      remote BOOLEAN, closed_at TIMESTAMPTZ
+dashboard/lib/queries.locationScoping.db.test.ts:51:    await sql`INSERT INTO jobs (id, location, location_canonicals, remote, closed_at) VALUES
+dashboard/lib/rolefit/filter.test.ts:8:    first_seen_at: "2026-06-20T00:00:00Z", closed_at: null, company_name: "Acme", ats: "lever",
+dashboard/lib/rolefit/filter.test.ts:215:      job({ id: "old", first_seen_at: "2026-06-18T00:00:00Z" }),
+dashboard/lib/rolefit/filter.test.ts:216:      job({ id: "new", first_seen_at: "2026-06-25T00:00:00Z" }),
+dashboard/lib/rolefit/filter.test.ts:217:      job({ id: "mid", first_seen_at: "2026-06-21T00:00:00Z" }),
+dashboard/lib/jobsQuery.test.ts:28:    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
+dashboard/lib/jobsQuery.test.ts:107:    expect(q.text).toContain("public.lifecycle_discovery_visible(j.id, j.closed_at, false)"); // persisted flag-aware discovery
+dashboard/lib/queries.boardInclude.db.test.ts:29:      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
+dashboard/lib/queries.boardInclude.db.test.ts:53:      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
+dashboard/lib/queries.boardLocationScoping.db.test.ts:45:      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
+dashboard/lib/queries.boardLocationScoping.db.test.ts:71:      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
+dashboard/lib/rolefit/filter.ts:116:    case "newest": return copy.sort((a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at));
+dashboard/lib/jobLifecycleState.ts:38:  return {text:`public.lifecycle_discovery_visible(j.id, j.closed_at, ${includeOlderLive ? "true" : "false"})`,values:[]};
+dashboard/lib/jobLifecycleState.ts:41:  if (!state) return true; // Unmapped legacy rows retain their existing caller's closed_at gate.
+dashboard/lib/jobLifecycleState.ts:71:  return {text:"public.lifecycle_source_closed(j.id, j.closed_at)",values:[]};
+dashboard/lib/metrics.ts:133:      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
+dashboard/lib/metrics.ts:169:             count(*) FILTER (WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false))::int AS open,
+dashboard/lib/metrics.ts:170:             count(*) FILTER (WHERE public.lifecycle_source_closed(j.id,j.closed_at))::int AS closed
+dashboard/lib/metrics.ts:320:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+dashboard/lib/metrics.ts:324:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND remote IS TRUE
+dashboard/lib/metrics.ts:328:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND department IS NOT NULL AND department <> ''
+dashboard/lib/metrics.ts:331:        FROM jobs j WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY 1 ORDER BY count DESC`,
+dashboard/lib/metrics.ts:334:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY COALESCE(c.display_name, c.name) ORDER BY count DESC LIMIT ${TOP_N}`,
+dashboard/lib/metrics.ts:337:        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY c.ats ORDER BY count DESC`,
+dashboard/lib/metrics.ts:343:        FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
+dashboard/lib/metrics.ts:344:              FROM jobs WHERE closed_at IS NOT NULL) s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers.txt
new file mode 100644
index 0000000..b2f8901
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-consumers.txt
@@ -0,0 +1,90 @@
+reviewer/db.py:268:        WHERE j.closed_at IS NULL
+reviewer/db.py:299:          AND (%(hydrate)s OR NOT COALESCE(j.description_pruned, FALSE))
+reviewer/db.py:321:            f" {_where} ORDER BY j.first_seen_at DESC LIMIT %(lim)s",
+job_discovery/db.py:118:        description = CASE WHEN jobs.description IS NULL AND NOT jobs.description_pruned
+job_discovery/db.py:120:        last_seen_at = now(),
+job_discovery/db.py:121:        closed_at    = NULL
+job_discovery/db.py:122:    WHERE jobs.closed_at IS NOT NULL
+job_discovery/db.py:127:       OR (jobs.description IS NULL AND NOT jobs.description_pruned
+job_discovery/db.py:148:    skipped update is counted as not new. Note: last_seen_at does not advance for
+job_discovery/db.py:186:            "SELECT external_id FROM jobs WHERE company_id = %s AND closed_at IS NULL",
+job_discovery/db.py:206:            "UPDATE jobs SET closed_at = NULL WHERE company_id = %s "
+job_discovery/db.py:207:            "AND closed_at IS NOT NULL AND external_id = ANY(%s)",
+job_discovery/db.py:218:            "UPDATE jobs SET closed_at = now() "
+job_discovery/db.py:219:            "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
+job_discovery/db.py:282:            WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
+job_discovery/prune.py:23:    j.closed_at IS NOT NULL
+job_discovery/prune.py:24:    AND j.closed_at < now() - make_interval(days => %s)
+job_discovery/prune.py:33:ORDER BY j.closed_at, j.id
+job_discovery/prune.py:89:    closed_at is written after complete source reconciliation; last_seen_at is
+job_discovery/lifecycle/demand.py:220:        AND j.closed_at IS NULL ORDER BY l.id LIMIT 1""",
+job_discovery/lifecycle/demand.py:323:                description_captured_at=clock_timestamp(),description_capture_provenance='demand',description_pruned=false
+job_discovery/lifecycle/maintenance.py:167:                conn.execute('UPDATE jobs SET description=NULL,description_pruned=true WHERE id=%s', (row['id'],))
+job_discovery/lifecycle/reconcile.py:145:        conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
+job_discovery/lifecycle/reconcile.py:215:       WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
+job_discovery/lifecycle/reconcile.py:270:            conn.execute("""UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s
+job_discovery/lifecycle/identity.py:120:                discovery_expires_at,legacy_closed_at)
+job_discovery/lifecycle/identity.py:126:                    job["first_seen_at"],
+job_discovery/lifecycle/identity.py:127:                    job["first_seen_at"],
+job_discovery/lifecycle/identity.py:128:                    job["first_seen_at"].astimezone(UTC) + timedelta(days=30),
+job_discovery/lifecycle/identity.py:129:                    job["closed_at"],
+job_discovery/lifecycle/identity.py:487:            discovered = job["first_seen_at"] if job else now
+job_discovery/lifecycle/identity.py:497:                    source_published_at,source_published_provenance,legacy_closed_at)
+job_discovery/lifecycle/identity.py:509:                        job["closed_at"] if job else None,
+dashboard/lib/types.ts:42:  first_seen_at: string | Date;
+dashboard/lib/types.ts:43:  closed_at: string | Date | null;
+dashboard/lib/types.ts:66:  first_seen_at: string;
+dashboard/lib/types.ts:67:  closed_at: string | null;
+dashboard/lib/jobsQuery.ts:58:  if (f.status === "open") where.push("j.closed_at IS NULL");
+dashboard/lib/jobsQuery.ts:59:  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");
+dashboard/lib/jobsQuery.ts:168:    "j.first_seen_at", "j.closed_at", "COALESCE(c.display_name, c.name) AS company_name",
+dashboard/lib/jobsQuery.ts:210:    "ORDER BY j.first_seen_at DESC",
+dashboard/lib/queries.ts:41:    first_seen_at: iso(row.first_seen_at),
+dashboard/lib/queries.ts:42:    closed_at: row.closed_at != null ? iso(row.closed_at) : null,
+dashboard/lib/queries.ts:267:    WHERE j.closed_at IS NULL
+dashboard/lib/queries.ts:310:      WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+dashboard/lib/queries.ts:314:      WHERE closed_at IS NULL AND remote IS TRUE
+dashboard/lib/queries.reviewFeed.test.ts:50:        remote: true, first_seen_at: new Date("2026-07-01T00:00:00.000Z"),
+dashboard/lib/queries.reviewFeed.test.ts:51:        closed_at: null, company_name: "Acme", ats: "greenhouse",
+dashboard/lib/queries.reviewFeed.test.ts:65:      first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/lib/queries.locationScoping.db.test.ts:35:      remote BOOLEAN, closed_at TIMESTAMPTZ
+dashboard/lib/queries.locationScoping.db.test.ts:51:    await sql`INSERT INTO jobs (id, location, location_canonicals, remote, closed_at) VALUES
+dashboard/lib/rolefit/filter.test.ts:8:    first_seen_at: "2026-06-20T00:00:00Z", closed_at: null, company_name: "Acme", ats: "lever",
+dashboard/lib/rolefit/filter.test.ts:215:      job({ id: "old", first_seen_at: "2026-06-18T00:00:00Z" }),
+dashboard/lib/rolefit/filter.test.ts:216:      job({ id: "new", first_seen_at: "2026-06-25T00:00:00Z" }),
+dashboard/lib/rolefit/filter.test.ts:217:      job({ id: "mid", first_seen_at: "2026-06-21T00:00:00Z" }),
+dashboard/lib/rolefit/filter.ts:114:    case "newest": return copy.sort((a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at));
+dashboard/lib/queries.boardLocationScoping.db.test.ts:45:      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
+dashboard/lib/queries.boardLocationScoping.db.test.ts:71:      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
+dashboard/lib/metrics.ts:133:      WHERE j.closed_at IS NULL
+dashboard/lib/metrics.ts:169:             count(*) FILTER (WHERE closed_at IS NULL)::int AS open,
+dashboard/lib/metrics.ts:170:             count(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
+dashboard/lib/metrics.ts:320:        WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+dashboard/lib/metrics.ts:324:        WHERE closed_at IS NULL AND remote IS TRUE
+dashboard/lib/metrics.ts:328:        WHERE closed_at IS NULL AND department IS NOT NULL AND department <> ''
+dashboard/lib/metrics.ts:331:        FROM jobs WHERE closed_at IS NULL GROUP BY 1 ORDER BY count DESC`,
+dashboard/lib/metrics.ts:334:        WHERE j.closed_at IS NULL GROUP BY COALESCE(c.display_name, c.name) ORDER BY count DESC LIMIT ${TOP_N}`,
+dashboard/lib/metrics.ts:337:        WHERE j.closed_at IS NULL GROUP BY c.ats ORDER BY count DESC`,
+dashboard/lib/metrics.ts:343:        FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
+dashboard/lib/metrics.ts:344:              FROM jobs WHERE closed_at IS NOT NULL) s
+dashboard/lib/jobsQuery.test.ts:28:    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
+dashboard/lib/jobsQuery.test.ts:107:    expect(q.text).toContain("j.closed_at IS NULL"); // plain status filter still applies
+dashboard/lib/queries.boardInclude.db.test.ts:29:      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
+dashboard/lib/queries.boardInclude.db.test.ts:53:      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
+dashboard/components/rolefit/JobDetail.test.tsx:22:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobDetail.test.tsx:23:    closed_at: null,
+dashboard/components/rolefit/ReviewNowPanel.test.tsx:26:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/ReviewNowPanel.test.tsx:27:  closed_at: null,
+dashboard/components/rolefit/JobDetail.tsx:178:  const postedText = "Posted " + fmtPosted(job.first_seen_at, nowIso);
+dashboard/components/rolefit/JobCard.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobCard.test.tsx:21:    closed_at: null,
+dashboard/components/rolefit/JobCard.test.tsx:94:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/JobCard.test.tsx:95:    closed_at: null,
+dashboard/components/rolefit/ApplicationPanel.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/ApplicationPanel.test.tsx:21:    closed_at: null,
+dashboard/components/rolefit/RolefitBoard.liveMatches.test.tsx:20:    first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
+dashboard/components/rolefit/VisualBoardState.tsx:15:  location: "Remote", location_canonicals: null, remote: true, first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
+dashboard/components/rolefit/RolefitBoard.test.tsx:23:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/RolefitBoard.test.tsx:24:  closed_at: null,
+dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx:22:  first_seen_at: "2026-07-01T00:00:00.000Z",
+dashboard/components/rolefit/RolefitBoard.rejectAffordance.test.tsx:23:  closed_at: null,
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-final.txt
new file mode 100644
index 0000000..135752a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-final.txt
@@ -0,0 +1,102 @@
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run --exclude **/*.db.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ app/actions/tombstoneGuard.test.ts (10 tests | 2 failed) 26ms
+     × markApplicationApplied proceeds to the DB write for a live account 12ms
+     × unrejectJob proceeds to the DB write for a live account 2ms
+ ❯ tests/visual/deployment-workflow-contract.test.ts (17 tests | 1 failed) 204ms
+     × uses only inert local infrastructure placeholders in ordinary dashboard CI 11ms
+ ❯ lib/jobLifecycleConsumers.test.ts (8 tests | 1 failed) 66ms
+   × rejects timezone-free lifecycle dates rather than applying browser local time 19ms
+Not implemented: Window's scrollTo() method
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > rejects timezone-free lifecycle dates rather than applying browser local time
+AssertionError: expected { feedEnabled: true, …(5) } to be null
+
+- Expected:
+null
+
++ Received:
+{
+  "discoveryAnchorAt": "2026-03-01T07:00:00",
+  "discoveryExpiresAt": "2026-03-31T07:00:00",
+  "feedEnabled": true,
+  "payloadAvailability": "retired",
+  "sourceAvailability": "open",
+  "sourceEnabled": true,
+}
+
+ ❯ lib/jobLifecycleConsumers.test.ts:62:122
+     60|
+     61| it('rejects timezone-free lifecycle dates rather than applying browser…
+     62|   expect(parseJobLifecycle({...state,discoveryAnchorAt:'2026-03-01T07:…
+       |                                                                                                                          ^
+     63| });
+     64|
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯
+
+ FAIL  app/actions/tombstoneGuard.test.ts > mutating actions honor the tombstone guard > markApplicationApplied proceeds to the DB write for a live account
+ FAIL  app/actions/tombstoneGuard.test.ts > mutating actions honor the tombstone guard > unrejectJob proceeds to the DB write for a live account
+AssertionError: promise rejected "Error: [vitest] No "withUserDemandSql" ex… { codeFrame: '…' }" instead of resolving
+ ❯ app/actions/tombstoneGuard.test.ts:57:23
+     55|   test.each(ACTIONS)("%s proceeds to the DB write for a live account",…
+     56|     state.deleted = false;
+     57|     await expect(run()).resolves.toBeUndefined();
+       |                       ^
+     58|     expect(withUserSql).toHaveBeenCalledTimes(1);
+     59|   });
+
+Caused by: Error: [vitest] No "withUserDemandSql" export is defined on the "@/lib/db" mock. Did you forget to return it from "vi.mock"?
+If you need to partially mock a module, you can use "importOriginal" helper inside:
+
+vi.mock(import("@/lib/db"), async (importOriginal) => {
+  const actual = await importOriginal()
+  return {
+    ...actual,
+    // your mocked methods
+  }
+})
+
+ ❯ requestJobPayload lib/jobLifecycle.ts:96:11
+ ❯ markApplicationApplied app/actions/applications.ts:17:19
+ ❯ app/actions/tombstoneGuard.test.ts:57:5
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯
+
+ FAIL  tests/visual/deployment-workflow-contract.test.ts > deployment-triggered authenticated visual workflow > uses only inert local infrastructure placeholders in ordinary dashboard CI
+AssertionError: expected [ '          DATABASE_URL:', …(2) ] to have a length of 2 but got 3
+
+- Expected
++ Received
+
+- 2
++ 3
+
+ ❯ tests/visual/deployment-workflow-contract.test.ts:60:53
+     58|       expect(job).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY: test");
+     59|     }
+     60|     expect(ordinaryCi.match(/^\s+DATABASE_URL:/gm)).toHaveLength(2);
+       |                                                     ^
+     61|     for (const variable of [
+     62|       "DATABASE_URL",
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯
+
+
+ Test Files  3 failed | 214 passed (217)
+      Tests  4 failed | 1708 passed | 2 skipped (1714)
+   Start at  19:59:54
+   Duration  138.09s (transform 25.09s, setup 0ms, import 106.65s, tests 61.51s, environment 114.17s)
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-full.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-full.txt
new file mode 100644
index 0000000..fc2318d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-dashboard-full.txt
@@ -0,0 +1,126 @@
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run --exclude **/*.db.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ tests/visual/deployment-workflow-contract.test.ts (17 tests | 1 failed) 541ms
+     × uses only inert local infrastructure placeholders in ordinary dashboard CI 23ms
+Not implemented: Window's scrollTo() method
+ ❯ app/ui-contract.test.ts (15 tests | 1 failed) 676ms
+     × production UI satisfies every source contract 638ms
+ ❯ app/actions/tombstoneGuard.test.ts (10 tests | 2 failed) 28ms
+     × markApplicationApplied proceeds to the DB write for a live account 10ms
+     × unrejectJob proceeds to the DB write for a live account 5ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > production UI satisfies every source contract
+AssertionError: expected [ …(5) ] to deeply equal []
+
+- Expected
++ Received
+
+- []
++ [
++   {
++     "code": "inline-geometry",
++     "detail": "Move geometry to shared CSS or mark the exact node, or the smallest data-driven composite scope, with a reason.",
++     "file": "components/rolefit/RolefitBoard.tsx",
++     "line": 1410,
++   },
++   {
++     "code": "raw-control",
++     "detail": "Use a shared primitive or a locally marked semantic composite wrapper with a reason.",
++     "file": "components/rolefit/RolefitBoard.tsx",
++     "line": 1411,
++   },
++   {
++     "code": "raw-control",
++     "detail": "Use a shared primitive or a locally marked semantic composite wrapper with a reason.",
++     "file": "components/rolefit/RolefitBoard.tsx",
++     "line": 1417,
++   },
++   {
++     "code": "unapproved-action",
++     "detail": "Use ButtonLink/BackLink or a marked semantic navigation composite.",
++     "file": "components/rolefit/RolefitBoard.tsx",
++     "line": 1424,
++   },
++   {
++     "code": "unapproved-action",
++     "detail": "Use ButtonLink/BackLink or a marked semantic navigation composite.",
++     "file": "components/rolefit/RolefitBoard.tsx",
++     "line": 1424,
++   },
++ ]
+
+ ❯ app/ui-contract.test.ts:44:33
+     42|
+     43|   test("production UI satisfies every source contract", () => {
+     44|     expect(auditProductionUi()).toEqual([]);
+       |                                 ^
+     45|   });
+     46| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯
+
+ FAIL  app/actions/tombstoneGuard.test.ts > mutating actions honor the tombstone guard > markApplicationApplied proceeds to the DB write for a live account
+ FAIL  app/actions/tombstoneGuard.test.ts > mutating actions honor the tombstone guard > unrejectJob proceeds to the DB write for a live account
+AssertionError: promise rejected "Error: [vitest] No "withUserDemandSql" ex… { codeFrame: '…' }" instead of resolving
+ ❯ app/actions/tombstoneGuard.test.ts:57:23
+     55|   test.each(ACTIONS)("%s proceeds to the DB write for a live account",…
+     56|     state.deleted = false;
+     57|     await expect(run()).resolves.toBeUndefined();
+       |                       ^
+     58|     expect(withUserSql).toHaveBeenCalledTimes(1);
+     59|   });
+
+Caused by: Error: [vitest] No "withUserDemandSql" export is defined on the "@/lib/db" mock. Did you forget to return it from "vi.mock"?
+If you need to partially mock a module, you can use "importOriginal" helper inside:
+
+vi.mock(import("@/lib/db"), async (importOriginal) => {
+  const actual = await importOriginal()
+  return {
+    ...actual,
+    // your mocked methods
+  }
+})
+
+ ❯ requestJobPayload lib/jobLifecycle.ts:143:11
+ ❯ markApplicationApplied app/actions/applications.ts:17:19
+ ❯ app/actions/tombstoneGuard.test.ts:57:5
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯
+
+ FAIL  tests/visual/deployment-workflow-contract.test.ts > deployment-triggered authenticated visual workflow > uses only inert local infrastructure placeholders in ordinary dashboard CI
+AssertionError: expected [ '          DATABASE_URL:', …(2) ] to have a length of 2 but got 3
+
+- Expected
++ Received
+
+- 2
++ 3
+
+ ❯ tests/visual/deployment-workflow-contract.test.ts:60:53
+     58|       expect(job).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY: test");
+     59|     }
+     60|     expect(ordinaryCi.match(/^\s+DATABASE_URL:/gm)).toHaveLength(2);
+       |                                                     ^
+     61|     for (const variable of [
+     62|       "DATABASE_URL",
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯
+
+
+ Test Files  3 failed | 214 passed (217)
+      Tests  4 failed | 1706 passed | 2 skipped (1712)
+   Start at  19:51:16
+   Duration  69.15s (transform 12.08s, setup 0ms, import 37.28s, tests 43.91s, environment 67.75s)
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red.txt
new file mode 100644
index 0000000..89db7a4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red.txt
@@ -0,0 +1,35 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.db.test.ts (4 tests | 4 skipped) 387ms
+   ↓ flag-off anonymous legacy path and unmapped fallback stay readable
+   ↓ source/expiry/payload remain independent, count matches concatenated page boundaries
+   ↓ approved/corrected/prepared/applied history is independent of discovery and owner profile gates
+   ↓ flag rollback changes no frozen dates, retired payload or proven closure
+
+⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.db.test.ts [ lib/jobLifecycleConsumers.db.test.ts ]
+PostgresError: new row for relation "application_packages" violates check constraint "applied_iff_timestamp"
+ ❯ ErrorResponse ../../../../dashboard/node_modules/postgres/src/connection.js:815:30
+ ❯ handle ../../../../dashboard/node_modules/postgres/src/connection.js:489:6
+ ❯ Socket.data ../../../../dashboard/node_modules/postgres/src/connection.js:324:9
+ ❯ cachedError ../../../../dashboard/node_modules/postgres/src/query.js:170:23
+ ❯ new Query ../../../../dashboard/node_modules/postgres/src/query.js:36:24
+ ❯ sql ../../../../dashboard/node_modules/postgres/src/index.js:112:11
+ ❯ lib/jobLifecycleConsumers.db.test.ts:37:9
+     35|   await sql`INSERT INTO job_reviews(user_id,job_id,profile_version,ver…
+     36|   await sql`INSERT INTO review_corrections(user_id,job_id,verdict) VAL…
+     37|   await sql`INSERT INTO application_packages(user_id,job_id,status) VA…
+       |         ^
+     38|   db=await import('./db');
+     39| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  4 skipped (4)
+   Start at  19:36:34
+   Duration  935ms (transform 158ms, setup 0ms, import 275ms, tests 387ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red2.txt
new file mode 100644
index 0000000..436e666
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db-red2.txt
@@ -0,0 +1,28 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.db.test.ts (4 tests | 4 failed) 364ms
+   × flag-off anonymous legacy path and unmapped fallback stay readable 22ms
+   × source/expiry/payload remain independent, count matches concatenated page boundaries 6ms
+   × approved/corrected/prepared/applied history is independent of discovery and owner profile gates 7ms
+   × flag rollback changes no frozen dates, retired payload or proven closure 6ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > flag-off anonymous legacy path and unmapped fallback stay readable
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > source/expiry/payload remain independent, count matches concatenated page boundaries
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > approved/corrected/prepared/applied history is independent of discovery and owner profile gates
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > flag rollback changes no frozen dates, retired payload or proven closure
+PostgresError: function public.lifecycle_job_state(text) does not exist
+ ❯ ErrorResponse ../../../../dashboard/node_modules/postgres/src/connection.js:815:30
+ ❯ handle ../../../../dashboard/node_modules/postgres/src/connection.js:489:6
+ ❯ Socket.data ../../../../dashboard/node_modules/postgres/src/connection.js:324:9
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  4 failed (4)
+   Start at  19:36:51
+   Duration  759ms (transform 139ms, setup 0ms, import 178ms, tests 364ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-complete.txt
new file mode 100644
index 0000000..ee5b5ac
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-complete.txt
@@ -0,0 +1,10 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycleConsumers.db.test.ts (6 tests) 982ms
+
+ Test Files  1 passed (1)
+      Tests  6 passed (6)
+   Start at  19:58:33
+   Duration  1.47s (transform 335ms, setup 0ms, import 253ms, tests 982ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-final.txt
new file mode 100644
index 0000000..8764d6b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db16-final.txt
@@ -0,0 +1,36 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.db.test.ts (5 tests | 1 failed) 944ms
+   ✓ flag-off anonymous legacy path and unmapped fallback stay readable 29ms
+   ✓ source/expiry/payload remain independent, count matches concatenated page boundaries 29ms
+   ✓ approved/corrected/prepared/applied history is independent of discovery and owner profile gates 14ms
+   ✓ flag rollback changes no frozen dates, retired payload or proven closure 8ms
+   × actual server paging DTO keeps private history independent of discovery location preferences 307ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > actual server paging DTO keeps private history independent of discovery location preferences
+PostgresError: null value in column "profile_version" of relation "profiles" violates not-null constraint
+ ❯ ErrorResponse ../../../../dashboard/node_modules/postgres/src/connection.js:815:30
+ ❯ handle ../../../../dashboard/node_modules/postgres/src/connection.js:489:6
+ ❯ Socket.data ../../../../dashboard/node_modules/postgres/src/connection.js:324:9
+ ❯ cachedError ../../../../dashboard/node_modules/postgres/src/query.js:170:23
+ ❯ new Query ../../../../dashboard/node_modules/postgres/src/query.js:36:24
+ ❯ sql ../../../../dashboard/node_modules/postgres/src/index.js:112:11
+ ❯ lib/jobLifecycleConsumers.db.test.ts:88:9
+     86|   expect(publicPage.total).toBe(2);
+     87|   expect(publicPage.rows.map(r=>r.id).sort()).toEqual(['fresh','unmapp…
+     88|   await sql`INSERT INTO profiles(user_id,preferred_locations) VALUES($…
+       |         ^
+     89|   const discovery=await getJobsPage(serverBoardFilters('authed'),owner…
+     90|   expect(discovery.total).toBe(0);
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 4 passed (5)
+   Start at  19:57:11
+   Duration  1.43s (transform 348ms, setup 0ms, import 230ms, tests 944ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-complete.txt
new file mode 100644
index 0000000..b224eb1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-complete.txt
@@ -0,0 +1,10 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycleConsumers.db.test.ts (6 tests) 734ms
+
+ Test Files  1 passed (1)
+      Tests  6 passed (6)
+   Start at  19:58:33
+   Duration  1.19s (transform 343ms, setup 0ms, import 258ms, tests 734ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-final.txt
new file mode 100644
index 0000000..652739f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17-final.txt
@@ -0,0 +1,36 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.db.test.ts (5 tests | 1 failed) 543ms
+   ✓ flag-off anonymous legacy path and unmapped fallback stay readable 24ms
+   ✓ source/expiry/payload remain independent, count matches concatenated page boundaries 23ms
+   ✓ approved/corrected/prepared/applied history is independent of discovery and owner profile gates 15ms
+   ✓ flag rollback changes no frozen dates, retired payload or proven closure 9ms
+   × actual server paging DTO keeps private history independent of discovery location preferences 230ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.db.test.ts > actual server paging DTO keeps private history independent of discovery location preferences
+PostgresError: null value in column "profile_version" of relation "profiles" violates not-null constraint
+ ❯ ErrorResponse ../../../../dashboard/node_modules/postgres/src/connection.js:815:30
+ ❯ handle ../../../../dashboard/node_modules/postgres/src/connection.js:489:6
+ ❯ Socket.data ../../../../dashboard/node_modules/postgres/src/connection.js:324:9
+ ❯ cachedError ../../../../dashboard/node_modules/postgres/src/query.js:170:23
+ ❯ new Query ../../../../dashboard/node_modules/postgres/src/query.js:36:24
+ ❯ sql ../../../../dashboard/node_modules/postgres/src/index.js:112:11
+ ❯ lib/jobLifecycleConsumers.db.test.ts:88:9
+     86|   expect(publicPage.total).toBe(2);
+     87|   expect(publicPage.rows.map(r=>r.id).sort()).toEqual(['fresh','unmapp…
+     88|   await sql`INSERT INTO profiles(user_id,preferred_locations) VALUES($…
+       |         ^
+     89|   const discovery=await getJobsPage(serverBoardFilters('authed'),owner…
+     90|   expect(discovery.total).toBe(0);
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 4 passed (5)
+   Start at  19:56:45
+   Duration  1.09s (transform 287ms, setup 0ms, import 194ms, tests 543ms, environment 1ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17.txt
new file mode 100644
index 0000000..0d609e1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-db17.txt
@@ -0,0 +1,10 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ✓ lib/jobLifecycleConsumers.db.test.ts (4 tests) 737ms
+
+ Test Files  1 passed (1)
+      Tests  4 passed (4)
+   Start at  19:37:55
+   Duration  1.57s (transform 170ms, setup 0ms, import 210ms, tests 737ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-green.txt
new file mode 100644
index 0000000..0a37593
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-green.txt
@@ -0,0 +1,9 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+Not implemented: Window's scrollTo() method
+
+ Test Files  2 passed (2)
+      Tests  2 passed | 15 skipped (17)
+   Start at  19:50:09
+   Duration  2.86s (transform 1.05s, setup 0ms, import 1.62s, tests 528ms, environment 738ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-red.txt
new file mode 100644
index 0000000..3a802c8
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-detail-red.txt
@@ -0,0 +1,375 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.test.ts (6 tests | 1 failed | 5 skipped) 20ms
+   × total-parses HTTP detail arrays and lifecycle instead of trusting legacy scalars 17ms
+Not implemented: Window's scrollTo() method
+ ❯ components/rolefit/RolefitBoard.test.tsx (11 tests | 1 failed | 10 skipped) 1448ms
+   × history retains a closed saved job independently of discovery and its totals 1446ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > total-parses HTTP detail arrays and lifecycle instead of trusting legacy scalars
+TypeError: parseJobDetailResponse is not a function
+ ❯ lib/jobLifecycleConsumers.test.ts:51:18
+
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
+
+ FAIL  components/rolefit/RolefitBoard.test.tsx > history retains a closed saved job independently of discovery and its totals
+TestingLibraryElementError: Unable to find role="heading" and name "Saved Role"
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div[39m
+      [33mclass[39m=[32m"app-shell app-shell--board"[39m
+      [33mdata-ui-contract-geometry[39m=[32m"board viewport shell geometry"[39m
+      [33mstyle[39m=[32m"display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary);"[39m
+    [36m>[39m
+      [36m<header[39m
+        [33mclass[39m=[32m"app-header app-header--compact"[39m
+      [36m>[39m
+        [36m<a[39m
+          [33maria-label[39m=[32m"Rolefit board"[39m
+          [33mclass[39m=[32m"app-header__brand"[39m
+          [33mhref[39m=[32m"/"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33maria-hidden[39m=[32m"true"[39m
+            [33mclass[39m=[32m"app-header__logo"[39m
+          [36m>[39m
+            [36m<span />[39m
+          [36m</span>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__wordmark"[39m
+          [36m>[39m
+            [0mRolefit[0m
+          [36m</span>[39m
+        [36m</a>[39m
+        [36m<nav[39m
+          [33maria-label[39m=[32m"Primary"[39m
+          [33mclass[39m=[32m"app-header__desktop-nav"[39m
+        [36m>[39m
+          [36m<a[39m
+            [33maria-current[39m=[32m"page"[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/"[39m
+          [36m>[39m
+            [0mBoard[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/analytics"[39m
+          [36m>[39m
+            [0mAnalytics[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/companies"[39m
+          [36m>[39m
+            [0mCompanies[0m
+          [36m</a>[39m
+        [36m</nav>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__center"[39m
+        [36m>[39m
+          [36m<label[39m
+            [33mclass[39m=[32m"rf-search app-header__search"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<circle[39m
+                [33mcx[39m=[32m"9"[39m
+                [33mcy[39m=[32m"9"[39m
+                [33mr[39m=[32m"5.5"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13 13 4 4"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [36m<span[39m
+              [33mclass[39m=[32m"sr-only"[39m
+            [36m>[39m
+              [0mSearch roles[0m
+            [36m</span>[39m
+            [36m<input[39m
+              [33maria-label[39m=[32m"Search roles"[39m
+              [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+              [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+              [33mtype[39m=[32m"search"[39m
+              [33mvalue[39m=[32m""[39m
+            [36m/>[39m
+          [36m</label>[39m
+        [36m</div>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__actions"[39m
+        [36m>[39m
+          [36m<button[39m
+            [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+            [33mtype[39m=[32m"button"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13.5 3.5 3 3L7 16H4v-3z"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m11.5 5.5 3 3"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [0mRésumé[0m
+          [36m</button>[39m
+          [36m<div[39m
+            [33mclass[39m=[32m"app-header__mobile-nav"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Open navigation"[39m
+              [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+              [33mdata-visual-size[39m=[32m"44"[39m
+              [33mtype[39m=[32m"button"[39m
+            [36m>[39m
+              [36m<svg[39m
+                [33maria-hidden[39m=[32m"true"[39m
+                [33mclass[39m=[32m"rf-icon"[39m
+                [33mfill[39m=[32m"none"[39m
+                [33mfocusable[39m=[32m"false"[39m
+                [33mheight[39m=[32m"18"[39m
+                [33mstroke[39m=[32m"currentColor"[39m
+                [33mstroke-linecap[39m=[32m"round"[39m
+                [33mstroke-linejoin[39m=[32m"round"[39m
+                [33mstroke-width[39m=[32m"1.75"[39m
+                [33mviewBox[39m=[32m"0 0 20 20"[39m
+                [33mwidth[39m=[32m"18"[39m
+              [36m>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 5h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 10h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 15h14"[39m
+                [36m/>[39m
+              [36m</svg>[39m
+            [36m</button>[39m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"position: relative; flex: 0 0 auto;"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Account: u@x.com"[39m
+              [33mclass[39m=[32m"rf-account-trigger rf-focusable"[39m
+              [33mstyle[39m=[32m"w...
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div[39m
+      [33mclass[39m=[32m"app-shell app-shell--board"[39m
+      [33mdata-ui-contract-geometry[39m=[32m"board viewport shell geometry"[39m
+      [33mstyle[39m=[32m"display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary);"[39m
+    [36m>[39m
+      [36m<header[39m
+        [33mclass[39m=[32m"app-header app-header--compact"[39m
+      [36m>[39m
+        [36m<a[39m
+          [33maria-label[39m=[32m"Rolefit board"[39m
+          [33mclass[39m=[32m"app-header__brand"[39m
+          [33mhref[39m=[32m"/"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33maria-hidden[39m=[32m"true"[39m
+            [33mclass[39m=[32m"app-header__logo"[39m
+          [36m>[39m
+            [36m<span />[39m
+          [36m</span>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__wordmark"[39m
+          [36m>[39m
+            [0mRolefit[0m
+          [36m</span>[39m
+        [36m</a>[39m
+        [36m<nav[39m
+          [33maria-label[39m=[32m"Primary"[39m
+          [33mclass[39m=[32m"app-header__desktop-nav"[39m
+        [36m>[39m
+          [36m<a[39m
+            [33maria-current[39m=[32m"page"[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/"[39m
+          [36m>[39m
+            [0mBoard[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/analytics"[39m
+          [36m>[39m
+            [0mAnalytics[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/companies"[39m
+          [36m>[39m
+            [0mCompanies[0m
+          [36m</a>[39m
+        [36m</nav>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__center"[39m
+        [36m>[39m
+          [36m<label[39m
+            [33mclass[39m=[32m"rf-search app-header__search"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<circle[39m
+                [33mcx[39m=[32m"9"[39m
+                [33mcy[39m=[32m"9"[39m
+                [33mr[39m=[32m"5.5"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13 13 4 4"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [36m<span[39m
+              [33mclass[39m=[32m"sr-only"[39m
+            [36m>[39m
+              [0mSearch roles[0m
+            [36m</span>[39m
+            [36m<input[39m
+              [33maria-label[39m=[32m"Search roles"[39m
+              [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+              [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+              [33mtype[39m=[32m"search"[39m
+              [33mvalue[39m=[32m""[39m
+            [36m/>[39m
+          [36m</label>[39m
+        [36m</div>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__actions"[39m
+        [36m>[39m
+          [36m<button[39m
+            [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+            [33mtype[39m=[32m"button"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13.5 3.5 3 3L7 16H4v-3z"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m11.5 5.5 3 3"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [0mRésumé[0m
+          [36m</button>[39m
+          [36m<div[39m
+            [33mclass[39m=[32m"app-header__mobile-nav"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Open navigation"[39m
+              [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+              [33mdata-visual-size[39m=[32m"44"[39m
+              [33mtype[39m=[32m"button"[39m
+            [36m>[39m
+              [36m<svg[39m
+                [33maria-hidden[39m=[32m"true"[39m
+                [33mclass[39m=[32m"rf-icon"[39m
+                [33mfill[39m=[32m"none"[39m
+                [33mfocusable[39m=[32m"false"[39m
+                [33mheight[39m=[32m"18"[39m
+                [33mstroke[39m=[32m"currentColor"[39m
+                [33mstroke-linecap[39m=[32m"round"[39m
+                [33mstroke-linejoin[39m=[32m"round"[39m
+                [33mstroke-width[39m=[32m"1.75"[39m
+                [33mviewBox[39m=[32m"0 0 20 20"[39m
+                [33mwidth[39m=[32m"18"[39m
+              [36m>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 5h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 10h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 15h14"[39m
+                [36m/>[39m
+              [36m</svg>[39m
+            [36m</button>[39m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"position: relative; flex: 0 0 auto;"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Account: u@x.com"[39m
+              [33mclass[39m=[32m"rf-account-trigger rf-focusable"[39m
+              [33mstyle[39m=[32m"w...
+ ❯ waitForWrapper ../../../../dashboard/node_modules/@testing-library/dom/dist/wait-for.js:163:27
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:86:33
+ ❯ components/rolefit/RolefitBoard.test.tsx:243:23
+    241|   expect(screen.getByText('Source closed')).toBeTruthy();
+    242|   fireEvent.click(screen.getByRole('button',{name:/Saved Role/}));
+    243|   expect(await screen.findByRole('heading',{name:'Saved Role',level:1}…
+       |                       ^
+    244| });
+    245|
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
+
+
+ Test Files  2 failed (2)
+      Tests  2 failed | 15 skipped (17)
+   Start at  19:49:07
+   Duration  4.10s (transform 1.05s, setup 0ms, import 1.67s, tests 1.47s, environment 971ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-diff-check.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-diff-check.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-diff-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-diff-final.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-complete.txt
new file mode 100644
index 0000000..917d53f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-complete.txt
@@ -0,0 +1,45 @@
+
+> job-board-dashboard@0.1.0 lint
+> eslint .
+
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/analytics/TrendCharts.tsx
+   98:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  103:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  109:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx
+  69:23  warning  Compilation Skipped: Use of incompatible library
+
+This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx:69:23
+  67 |   useEffect(() => setMounted(true), []);
+  68 |
+> 69 |   const virtualizer = useVirtualizer({
+     |                       ^^^^^^^^^^^^^^ TanStack Virtual's `useVirtualizer()` API returns functions that cannot be memoized safely
+  70 |     count: jobs.length,
+  71 |     getScrollElement: () => scrollParentRef.current,
+  72 |     estimateSize: () => 116,  react-hooks/incompatible-library
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/eslint.config.mjs
+  4:1  warning  Assign array to a variable before exporting as module default  import/no-anonymous-default-export
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/rolefit/parseProfile.ts
+  186:47  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+  358:24  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/theme.script.test.ts
+  12:3  warning  Unused eslint-disable directive (no problems were reported from 'no-new-func')
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/postcss.config.mjs
+  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
+
+✖ 9 problems (0 errors, 9 warnings)
+  0 errors and 1 warning potentially fixable with the `--fix` option.
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-release.txt
new file mode 100644
index 0000000..917d53f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint-release.txt
@@ -0,0 +1,45 @@
+
+> job-board-dashboard@0.1.0 lint
+> eslint .
+
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/analytics/TrendCharts.tsx
+   98:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  103:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  109:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx
+  69:23  warning  Compilation Skipped: Use of incompatible library
+
+This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx:69:23
+  67 |   useEffect(() => setMounted(true), []);
+  68 |
+> 69 |   const virtualizer = useVirtualizer({
+     |                       ^^^^^^^^^^^^^^ TanStack Virtual's `useVirtualizer()` API returns functions that cannot be memoized safely
+  70 |     count: jobs.length,
+  71 |     getScrollElement: () => scrollParentRef.current,
+  72 |     estimateSize: () => 116,  react-hooks/incompatible-library
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/eslint.config.mjs
+  4:1  warning  Assign array to a variable before exporting as module default  import/no-anonymous-default-export
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/rolefit/parseProfile.ts
+  186:47  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+  358:24  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/theme.script.test.ts
+  12:3  warning  Unused eslint-disable directive (no problems were reported from 'no-new-func')
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/postcss.config.mjs
+  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
+
+✖ 9 problems (0 errors, 9 warnings)
+  0 errors and 1 warning potentially fixable with the `--fix` option.
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint.txt
new file mode 100644
index 0000000..3035ead
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-lint.txt
@@ -0,0 +1,48 @@
+
+> job-board-dashboard@0.1.0 lint
+> eslint .
+
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/analytics/TrendCharts.tsx
+   98:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  103:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+  109:5  warning  React Hook useMemo has a missing dependency: 'prep'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx
+  69:23  warning  Compilation Skipped: Use of incompatible library
+
+This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/JobList.tsx:69:23
+  67 |   useEffect(() => setMounted(true), []);
+  68 |
+> 69 |   const virtualizer = useVirtualizer({
+     |                       ^^^^^^^^^^^^^^ TanStack Virtual's `useVirtualizer()` API returns functions that cannot be memoized safely
+  70 |     count: jobs.length,
+  71 |     getScrollElement: () => scrollParentRef.current,
+  72 |     estimateSize: () => 116,  react-hooks/incompatible-library
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/components/rolefit/RolefitBoard.tsx
+  546:6  warning  React Hook useEffect has a missing dependency: 'isAuthed'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/eslint.config.mjs
+  4:1  warning  Assign array to a variable before exporting as module default  import/no-anonymous-default-export
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/rolefit/parseProfile.ts
+  186:47  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+  358:24  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/lib/theme.script.test.ts
+  12:3  warning  Unused eslint-disable directive (no problems were reported from 'no-new-func')
+
+/workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard/postcss.config.mjs
+  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
+
+✖ 10 problems (0 errors, 10 warnings)
+  0 errors and 1 warning potentially fixable with the `--fix` option.
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-red.txt
new file mode 100644
index 0000000..6a3d8f0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-red.txt
@@ -0,0 +1,72 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.test.ts (5 tests | 5 failed) 16ms
+     × expires at exactly 720 elapsed UTC hours across DST, without implying closure 7ms
+     × distinguishes unknown and closed, and only opts into older confirmed live jobs 1ms
+     × parses double encoded JSON and rejects malformed or incoherent boundaries 1ms
+     × rows/count/page boundaries share one predicate and deterministic order 1ms
+     × history queries require an owner and do not apply discovery or profile filters 4ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > lifecycle consumers > expires at exactly 720 elapsed UTC hours across DST, without implying closure
+TypeError: parseJobLifecycle is not a function
+ ❯ lib/jobLifecycleConsumers.test.ts:12:23
+     10| describe("lifecycle consumers", () => {
+     11|   it("expires at exactly 720 elapsed UTC hours across DST, without imp…
+     12|     const lifecycle = parseJobLifecycle(state)!;
+       |                       ^
+     13|     expect(discoveryVisible(lifecycle, false, "2026-03-31T06:59:59.999…
+     14|     expect(discoveryVisible(lifecycle, false, "2026-03-31T07:00:00.000…
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > lifecycle consumers > distinguishes unknown and closed, and only opts into older confirmed live jobs
+TypeError: parseJobLifecycle is not a function
+ ❯ lib/jobLifecycleConsumers.test.ts:20:25
+     18|   it("distinguishes unknown and closed, and only opts into older confi…
+     19|     for (const sourceAvailability of ["unknown", "closed"] as const) {
+     20|       const lifecycle = parseJobLifecycle({...state, sourceAvailabilit…
+       |                         ^
+     21|       expect(discoveryVisible(lifecycle, true, "2026-03-31T07:00:00.00…
+     22|       expect(lifecycleLabels(lifecycle, "2026-03-31T07:00:00.000Z")[0]…
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > lifecycle consumers > parses double encoded JSON and rejects malformed or incoherent boundaries
+TypeError: parseJobLifecycle is not a function
+ ❯ lib/jobLifecycleConsumers.test.ts:26:12
+
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > lifecycle consumers > rows/count/page boundaries share one predicate and deterministic order
+TypeError: buildJobsCountQuery is not a function
+ ❯ lib/jobLifecycleConsumers.test.ts:33:19
+     31|     const filters = {...serverBoardFilters("anon"), includeOlderLive:t…
+     32|     const rows = buildJobsQuery(filters, null, [], {limit:2,offset:2});
+     33|     const count = buildJobsCountQuery(filters,null);
+       |                   ^
+     34|     expect(rows.text).toContain(discoveryPredicate(true).text);
+     35|     expect(count.text).toContain(discoveryPredicate(true).text);
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > lifecycle consumers > history queries require an owner and do not apply discovery or profile filters
+AssertionError: expected [Function] to throw an error
+ ❯ lib/jobLifecycleConsumers.test.ts:40:89
+     38|   });
+     39|   it("history queries require an owner and do not apply discovery or p…
+     40|     expect(() => buildJobsQuery(serverBoardFilters("anon"),null,[],{hi…
+       |                                                                                         ^
+     41|     const query = buildJobsQuery(serverBoardFilters("authed"),"owner",…
+     42|     expect(query.text).toContain("application_packages");
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  5 failed (5)
+   Start at  19:34:24
+   Duration  658ms (transform 138ms, setup 0ms, import 163ms, tests 16ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-count-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-count-red.txt
new file mode 100644
index 0000000..060a9a1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-count-red.txt
@@ -0,0 +1,44 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+____________ test_candidate_count_and_rows_share_one_read_statement ____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33052 user=postgres database=poller_lifecycle_test) at 0x7fa725b766f0>
+
+    def test_candidate_count_and_rows_share_one_read_statement(conn):
+        """A candidate page and its total must use one statement-time boundary."""
+        from contextlib import contextmanager
+
+        conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
+        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('fresh',1,'1','Role','https://example.test/job')")
+        conn.commit()
+        candidate_reads = []
+
+        class RecordedConnection:
+            def __getattr__(self, name):
+                return getattr(conn, name)
+
+            @contextmanager
+            def cursor(self, *args, **kwargs):
+                with conn.cursor(*args, **kwargs) as cursor:
+                    class RecordedCursor:
+                        def __getattr__(self, name):
+                            return getattr(cursor, name)
+
+                        def execute(self, query, params=None):
+                            if "FROM jobs j" in query:
+                                candidate_reads.append(query)
+                            return cursor.execute(query, params)
+
+                    yield RecordedCursor()
+
+        rows, count = rdb.select_candidates(RecordedConnection(), USER, 'v1', 1)
+        assert [row['id'] for row in rows] == ['fresh'] and count == 1
+>       assert len(candidate_reads) == 1
+E       assert 2 == 1
+E        +  where 2 = len(["SELECT count(*)::int AS n \n        FROM jobs j\n        JOIN companies c ON c.id = j.company_id\n        LEFT JOIN ...       OR ('Remote' = ANY(%(prefs)s::text[]) AND j.remote IS TRUE))\n     ORDER BY j.first_seen_at DESC LIMIT %(lim)s"])
+
+tests/test_reviewer_lifecycle_feed.py:56: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_reviewer_lifecycle_feed.py::test_candidate_count_and_rows_share_one_read_statement
+1 failed, 1 deselected in 0.43s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-red.txt
new file mode 100644
index 0000000..d31beda
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer-red.txt
@@ -0,0 +1,26 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+____________________ test_feed_flags_candidates_and_counts _____________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=33040 user=postgres database=poller_lifecycle_test) at 0x7f1799f760c0>
+
+    def test_feed_flags_candidates_and_counts(conn):
+        conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
+        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('old',1,'1','Role','https://example.test/job')")
+        source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id").fetchone()['id']
+        conn.execute("""INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
+          discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,source_availability)
+          VALUES(%s,'1','old',now()-interval '721 hours',now()-interval '721 hours','local_observation',now()-interval '1 hour','open')""", (source,))
+        conn.commit()
+        rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
+>       assert [r['id'] for r in rows] == ['old'] and count == 1
+E       AssertionError: assert ([] == ['old']
+E
+E         Right contains one more item: 'old'
+E         Use -v to get more diff)
+
+tests/test_reviewer_lifecycle_feed.py:18: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_reviewer_lifecycle_feed.py::test_feed_flags_candidates_and_counts
+1 failed in 0.58s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-complete.txt
new file mode 100644
index 0000000..2559e88
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-complete.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........                                                                 [100%]
+8 passed, 30 deselected in 9.69s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-release.txt
new file mode 100644
index 0000000..06ac131
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16-release.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+.........                                                                [100%]
+9 passed, 30 deselected in 5.84s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16.txt
new file mode 100644
index 0000000..328e2f3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........                                                                 [100%]
+8 passed, 30 deselected in 5.96s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-complete.txt
new file mode 100644
index 0000000..6ed1533
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-complete.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........                                                                 [100%]
+8 passed, 30 deselected in 7.15s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-release.txt
new file mode 100644
index 0000000..23041fa
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17-release.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.........                                                                [100%]
+9 passed, 30 deselected in 3.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17.txt
new file mode 100644
index 0000000..ad17c3a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-reviewer17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........                                                                 [100%]
+8 passed, 30 deselected in 2.48s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-route-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-route-red.txt
new file mode 100644
index 0000000..9da04b1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-route-red.txt
@@ -0,0 +1,25 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ app/api/jobs/[id]/route.test.ts (14 tests | 1 failed | 13 skipped) 34ms
+   × closed source exposes retained history without enqueueing current hydration 32ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/api/jobs/[id]/route.test.ts > closed source exposes retained history without enqueueing current hydration
+TypeError: Cannot read properties of undefined (reading 'status')
+ ❯ app/api/jobs/[id]/route.test.ts:125:23
+    123|   expect(body.description).toBe('Saved JD');
+    124|   expect(body.lifecycle.sourceAvailability).toBe('closed');
+    125|   expect(body.payload.status).toBe('deferred');
+       |                       ^
+    126|   expect(requestJobPayload).not.toHaveBeenCalled();
+    127| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 13 skipped (14)
+   Start at  19:46:57
+   Duration  483ms (transform 127ms, setup 0ms, import 155ms, tests 34ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-final.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-final.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-release.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff-release.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-complete.txt
new file mode 100644
index 0000000..20b0754
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-complete.txt
@@ -0,0 +1,114 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ app/ui-contract.test.ts (15 tests | 11 failed) 241ms
+     × isolates the purpose-built raw-control fixture 28ms
+     × isolates the purpose-built unicode-control-icon fixture 1ms
+     × isolates the purpose-built inline-geometry fixture 1ms
+     × isolates the purpose-built raw-theme-value fixture 9ms
+     × isolates the purpose-built undersized-target fixture 1ms
+     × isolates the purpose-built overflow-risk fixture 1ms
+     × isolates the purpose-built missing-shared-shell fixture 1ms
+     × isolates the purpose-built unapproved-svg-icon fixture 1ms
+     × isolates the purpose-built unapproved-action fixture 13ms
+     × isolates the purpose-built undocumented-compact-density fixture 2ms
+     × production UI satisfies every source contract 6ms
+Not implemented: Window's scrollTo() method
+
+⎯⎯⎯⎯⎯⎯ Failed Tests 11 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built raw-control fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/raw-controls.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unicode-control-icon fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unicode-icons.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built inline-geometry fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/inline-geometry.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built raw-theme-value fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/theme-drift.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built undersized-target fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/undersized-target.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built overflow-risk fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/overflow.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built missing-shared-shell fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/missing-shell.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unapproved-svg-icon fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unapproved-svg.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unapproved-action fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unapproved-action.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built undocumented-compact-density fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/compact-density.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/11]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > production UI satisfies every source contract
+Error: ENOENT: no such file or directory, scandir '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app'
+ ❯ walk lib/uiContract.ts:30:85
+
+ ❯ lib/uiContract.ts:111:53
+ ❯ auditProductionUi lib/uiContract.ts:111:30
+ ❯ app/ui-contract.test.ts:44:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/11]⎯
+
+
+ Test Files  1 failed | 11 passed (12)
+      Tests  11 failed | 172 passed (183)
+   Start at  20:00:34
+   Duration  19.80s (transform 9.09s, setup 0ms, import 17.47s, tests 13.70s, environment 8.78s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-cwd-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-cwd-final.txt
new file mode 100644
index 0000000..ca7d137
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-cwd-final.txt
@@ -0,0 +1,27 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ app/ui-contract.test.ts (15 tests | 1 failed) 26696ms
+     × production UI satisfies every source contract 26411ms
+Not implemented: Window's scrollTo() method
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > production UI satisfies every source contract
+Error: Test timed out in 5000ms.
+If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
+ ❯ app/ui-contract.test.ts:43:3
+     41|   });
+     42|
+     43|   test("production UI satisfies every source contract", () => {
+       |   ^
+     44|     expect(auditProductionUi()).toEqual([]);
+     45|   });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed | 11 passed (12)
+      Tests  1 failed | 182 passed (183)
+   Start at  20:01:24
+   Duration  45.47s (transform 32.76s, setup 0ms, import 60.44s, tests 40.15s, environment 17.60s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final-pin.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final-pin.txt
new file mode 100644
index 0000000..4223951
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final-pin.txt
@@ -0,0 +1,9 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+Not implemented: Window's scrollTo() method
+
+ Test Files  12 passed (12)
+      Tests  183 passed (183)
+   Start at  20:03:17
+   Duration  5.76s (transform 2.23s, setup 0ms, import 4.31s, tests 4.94s, environment 3.04s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final.txt
new file mode 100644
index 0000000..d0aed6d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-final.txt
@@ -0,0 +1,142 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.test.ts (8 tests | 1 failed) 164ms
+   × rejects timezone-free lifecycle dates rather than applying browser local time 47ms
+ ❯ app/ui-contract.test.ts (15 tests | 11 failed) 105ms
+     × isolates the purpose-built raw-control fixture 8ms
+     × isolates the purpose-built unicode-control-icon fixture 1ms
+     × isolates the purpose-built inline-geometry fixture 0ms
+     × isolates the purpose-built raw-theme-value fixture 1ms
+     × isolates the purpose-built undersized-target fixture 0ms
+     × isolates the purpose-built overflow-risk fixture 0ms
+     × isolates the purpose-built missing-shared-shell fixture 1ms
+     × isolates the purpose-built unapproved-svg-icon fixture 1ms
+     × isolates the purpose-built unapproved-action fixture 1ms
+     × isolates the purpose-built undocumented-compact-density fixture 1ms
+     × production UI satisfies every source contract 4ms
+Not implemented: Window's scrollTo() method
+
+⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built raw-control fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/raw-controls.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unicode-control-icon fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unicode-icons.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built inline-geometry fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/inline-geometry.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built raw-theme-value fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/theme-drift.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built undersized-target fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/undersized-target.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built overflow-risk fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/overflow.css'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built missing-shared-shell fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/missing-shell.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unapproved-svg-icon fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unapproved-svg.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built unapproved-action fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/unapproved-action.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > isolates the purpose-built undocumented-compact-density fixture
+Error: ENOENT: no such file or directory, open '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app/__fixtures__/ui-contract/compact-density.tsx'
+ ❯ auditFixtureFile lib/uiContract.ts:109:114
+
+ ❯ app/ui-contract.test.ts:14:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/12]⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > production UI satisfies every source contract
+Error: ENOENT: no such file or directory, scandir '/workspace/job-board/.claude/worktrees/lifecycle-recovery/app'
+ ❯ walk lib/uiContract.ts:30:85
+
+ ❯ lib/uiContract.ts:111:53
+ ❯ auditProductionUi lib/uiContract.ts:111:30
+ ❯ app/ui-contract.test.ts:44:12
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/12]⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > rejects timezone-free lifecycle dates rather than applying browser local time
+AssertionError: expected { feedEnabled: true, …(5) } to be null
+
+- Expected:
+null
+
++ Received:
+{
+  "discoveryAnchorAt": "2026-03-01T07:00:00",
+  "discoveryExpiresAt": "2026-03-31T07:00:00",
+  "feedEnabled": true,
+  "payloadAvailability": "retired",
+  "sourceAvailability": "open",
+  "sourceEnabled": true,
+}
+
+ ❯ lib/jobLifecycleConsumers.test.ts:62:122
+     60|
+     61| it('rejects timezone-free lifecycle dates rather than applying browser…
+     62|   expect(parseJobLifecycle({...state,discoveryAnchorAt:'2026-03-01T07:…
+       |                                                                                                                          ^
+     63| });
+     64|
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/12]⎯
+
+
+ Test Files  2 failed | 10 passed (12)
+      Tests  12 failed | 171 passed (183)
+   Start at  20:00:16
+   Duration  15.10s (transform 6.00s, setup 0ms, import 13.41s, tests 13.18s, environment 5.90s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-green.txt
new file mode 100644
index 0000000..6ce7a2a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-green.txt
@@ -0,0 +1,8 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+
+ Test Files  11 passed (11)
+      Tests  165 passed (165)
+   Start at  19:47:49
+   Duration  6.33s (transform 2.36s, setup 0ms, import 4.33s, tests 3.50s, environment 3.51s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-release.txt
new file mode 100644
index 0000000..0f06805
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected-release.txt
@@ -0,0 +1,9 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+Not implemented: Window's scrollTo() method
+
+ Test Files  13 passed (13)
+      Tests  193 passed (193)
+   Start at  20:06:21
+   Duration  13.89s (transform 6.57s, setup 0ms, import 13.32s, tests 10.63s, environment 8.43s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected.txt
new file mode 100644
index 0000000..45121df
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-selected.txt
@@ -0,0 +1,100 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobsQuery.test.ts (43 tests | 1 failed) 23ms
+     × null owner: no review join, columns, error clause, or user binding 9ms
+ ❯ lib/rolefit/boardFilters.test.ts (17 tests | 1 failed) 26ms
+     × parses a valid JSON string 9ms
+ ❯ lib/filters.test.ts (8 tests | 1 failed) 42ms
+     × empty params → defaults incl. verdict=approve 28ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/filters.test.ts > parseFilters > empty params → defaults incl. verdict=approve
+AssertionError: expected { companies: [], …(10) } to deeply equal { companies: [], …(9) }
+
+- Expected
++ Received
+
+@@ -3,10 +3,11 @@
+    "exclude": [],
+    "experience": "",
+    "include": [
+      "engineer",
+    ],
++   "includeOlderLive": false,
+    "industry": "",
+    "location": "",
+    "remoteOnly": false,
+    "status": "open",
+    "subcategory": "",
+
+ ❯ lib/filters.test.ts:8:33
+      6| describe("parseFilters", () => {
+      7|   test("empty params → defaults incl. verdict=approve", () => {
+      8|     expect(parseFilters({}, D)).toEqual({
+       |                                 ^
+      9|       companies: [],
+     10|       include: ["engineer"],
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
+
+ FAIL  lib/jobsQuery.test.ts > buildJobsQuery > null owner: no review join, columns, error clause, or user binding
+AssertionError: expected 'SELECT j.id, j.title, j.location, j.l…' to contain 'j.closed_at IS NULL'
+
+- Expected
++ Received
+
+- j.closed_at IS NULL
++ SELECT j.id, j.title, j.location, j.location_canonicals, j.remote, public.lifecycle_job_state(j.id) AS lifecycle, j.first_seen_at, j.closed_at, COALESCE(c.display_name, c.name) AS company_name, c.ats, c.industry, c.size, c.hq_country
++ FROM jobs j
++ JOIN companies c ON c.id = j.company_id
++ WHERE public.lifecycle_discovery_visible(j.id, j.closed_at, false)
++ ORDER BY j.first_seen_at DESC, j.id ASC
++ LIMIT 500
++ OFFSET 0
+
+ ❯ lib/jobsQuery.test.ts:107:20
+    105|     expect(q.text).not.toContain("r.verdict");
+    106|     expect(q.text).not.toContain("r.error IS NULL");
+    107|     expect(q.text).toContain("j.closed_at IS NULL"); // plain status f…
+       |                    ^
+    108|     expect(q.values).toEqual([]);
+    109|   });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
+
+ FAIL  lib/rolefit/boardFilters.test.ts > parseBoardFilters > parses a valid JSON string
+AssertionError: expected { includeOlderLive: false, …(13) } to deeply equal { search: 'eng', …(12) }
+
+- Expected
++ Received
+
+@@ -1,10 +1,11 @@
+  {
+    "cats": [
+      "Backend",
+    ],
+    "countries": [],
++   "includeOlderLive": false,
+    "industries": [],
+    "locs": [
+      "Berlin",
+    ],
+    "minFit": 75,
+
+ ❯ lib/rolefit/boardFilters.test.ts:17:15
+     15|       '{"search":"eng","cats":["Backend"],"locs":["Berlin"],"remote":"…
+     16|     );
+     17|     expect(f).toEqual({
+       |               ^
+     18|       search: "eng", cats: ["Backend"], locs: ["Berlin"], sources: [],
+     19|       industries: [], sizes: [], countries: [],
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
+
+
+ Test Files  3 failed | 8 passed (11)
+      Tests  3 failed | 161 passed (164)
+   Start at  19:44:21
+   Duration  6.79s (transform 2.29s, setup 0ms, import 4.48s, tests 4.68s, environment 3.39s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc-complete.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc-complete.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc-final.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-tsc2.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-release.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-release.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-source.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-source.txt
new file mode 100644
index 0000000..b030527
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-source.txt
@@ -0,0 +1,9 @@
+
+> job-board-dashboard@0.1.0 typecheck
+> tsc --noEmit
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-verified.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-typecheck-verified.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-final.txt
new file mode 100644
index 0000000..d0ed36b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-final.txt
@@ -0,0 +1,9 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+Not implemented: Window's scrollTo() method
+
+ Test Files  3 passed (3)
+      Tests  32 passed (32)
+   Start at  19:56:00
+   Duration  5.46s (transform 2.08s, setup 0ms, import 3.38s, tests 2.97s, environment 1.05s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-green.txt
new file mode 100644
index 0000000..4c5867e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-contract-green.txt
@@ -0,0 +1,40 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ app/ui-contract.test.ts (15 tests | 1 failed) 537ms
+     × production UI satisfies every source contract 485ms
+Not implemented: Window's scrollTo() method
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  app/ui-contract.test.ts > cohesive interface source contracts > production UI satisfies every source contract
+AssertionError: expected [ { code: 'undersized-target', …(3) } ] to deeply equal []
+
+- Expected
++ Received
+
+- []
++ [
++   {
++     "code": "undersized-target",
++     "detail": "Interactive selectors with explicit dimensions must preserve a 44px target.",
++     "file": "components/rolefit/board.css",
++     "line": 516,
++   },
++ ]
+
+ ❯ app/ui-contract.test.ts:44:33
+     42|
+     43|   test("production UI satisfies every source contract", () => {
+     44|     expect(auditProductionUi()).toEqual([]);
+       |                                 ^
+     45|   });
+     46| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed | 2 passed (3)
+      Tests  1 failed | 31 passed (32)
+   Start at  19:54:22
+   Duration  5.93s (transform 1.94s, setup 0ms, import 3.32s, tests 3.06s, environment 1.43s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green.txt
new file mode 100644
index 0000000..7f9d7e3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green.txt
@@ -0,0 +1,388 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ components/rolefit/RolefitBoard.test.tsx (11 tests | 2 failed | 9 skipped) 1513ms
+   × discovery hides expired rows until older-live opt-in, and labels availability separately 160ms
+   × history retains a closed saved job independently of discovery and its totals 1351ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  components/rolefit/RolefitBoard.test.tsx > discovery hides expired rows until older-live opt-in, and labels availability separately
+AssertionError: expected <h1 …(1)></h1> to be null
+
+- Expected:
+null
+
++ Received:
+<h1
+  style="margin: 0px; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: var(--text-primary); line-height: 1.15;"
+>
+  Staff Engineer
+</h1>
+
+ ❯ components/rolefit/RolefitBoard.test.tsx:223:48
+
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
+
+ FAIL  components/rolefit/RolefitBoard.test.tsx > history retains a closed saved job independently of discovery and its totals
+TestingLibraryElementError: Unable to find an element with the text: Saved Role. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div[39m
+      [33mclass[39m=[32m"app-shell app-shell--board"[39m
+      [33mdata-ui-contract-geometry[39m=[32m"board viewport shell geometry"[39m
+      [33mstyle[39m=[32m"height: 100vh; display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary); overflow: hidden;"[39m
+    [36m>[39m
+      [36m<header[39m
+        [33mclass[39m=[32m"app-header"[39m
+      [36m>[39m
+        [36m<a[39m
+          [33maria-label[39m=[32m"Rolefit board"[39m
+          [33mclass[39m=[32m"app-header__brand"[39m
+          [33mhref[39m=[32m"/"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33maria-hidden[39m=[32m"true"[39m
+            [33mclass[39m=[32m"app-header__logo"[39m
+          [36m>[39m
+            [36m<span />[39m
+          [36m</span>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__wordmark"[39m
+          [36m>[39m
+            [0mRolefit[0m
+          [36m</span>[39m
+        [36m</a>[39m
+        [36m<nav[39m
+          [33maria-label[39m=[32m"Primary"[39m
+          [33mclass[39m=[32m"app-header__desktop-nav"[39m
+        [36m>[39m
+          [36m<a[39m
+            [33maria-current[39m=[32m"page"[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/"[39m
+          [36m>[39m
+            [0mBoard[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/analytics"[39m
+          [36m>[39m
+            [0mAnalytics[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/companies"[39m
+          [36m>[39m
+            [0mCompanies[0m
+          [36m</a>[39m
+        [36m</nav>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__center"[39m
+        [36m>[39m
+          [36m<label[39m
+            [33mclass[39m=[32m"rf-search app-header__search"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<circle[39m
+                [33mcx[39m=[32m"9"[39m
+                [33mcy[39m=[32m"9"[39m
+                [33mr[39m=[32m"5.5"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13 13 4 4"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [36m<span[39m
+              [33mclass[39m=[32m"sr-only"[39m
+            [36m>[39m
+              [0mSearch roles[0m
+            [36m</span>[39m
+            [36m<input[39m
+              [33maria-label[39m=[32m"Search roles"[39m
+              [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+              [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+              [33mtype[39m=[32m"search"[39m
+              [33mvalue[39m=[32m""[39m
+            [36m/>[39m
+          [36m</label>[39m
+        [36m</div>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__actions"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__reviewed-badge"[39m
+          [36m>[39m
+            [0mAI-REVIEWED[0m
+          [36m</span>[39m
+          [36m<button[39m
+            [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+            [33mtype[39m=[32m"button"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13.5 3.5 3 3L7 16H4v-3z"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m11.5 5.5 3 3"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [0mRésumé[0m
+          [36m</button>[39m
+          [36m<div[39m
+            [33mclass[39m=[32m"app-header__mobile-nav"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Open navigation"[39m
+              [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+              [33mdata-visual-size[39m=[32m"44"[39m
+              [33mtype[39m=[32m"button"[39m
+            [36m>[39m
+              [36m<svg[39m
+                [33maria-hidden[39m=[32m"true"[39m
+                [33mclass[39m=[32m"rf-icon"[39m
+                [33mfill[39m=[32m"none"[39m
+                [33mfocusable[39m=[32m"false"[39m
+                [33mheight[39m=[32m"18"[39m
+                [33mstroke[39m=[32m"currentColor"[39m
+                [33mstroke-linecap[39m=[32m"round"[39m
+                [33mstroke-linejoin[39m=[32m"round"[39m
+                [33mstroke-width[39m=[32m"1.75"[39m
+                [33mviewBox[39m=[32m"0 0 20 20"[39m
+                [33mwidth[39m=[32m"18"[39m
+              [36m>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 5h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 10h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 15h14"[39m
+                [36m/>[39m
+              [36m</svg>[39m
+            [36m</button>[39m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"position: relative; flex: 0 0 auto;"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32...
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div[39m
+      [33mclass[39m=[32m"app-shell app-shell--board"[39m
+      [33mdata-ui-contract-geometry[39m=[32m"board viewport shell geometry"[39m
+      [33mstyle[39m=[32m"height: 100vh; display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary); overflow: hidden;"[39m
+    [36m>[39m
+      [36m<header[39m
+        [33mclass[39m=[32m"app-header"[39m
+      [36m>[39m
+        [36m<a[39m
+          [33maria-label[39m=[32m"Rolefit board"[39m
+          [33mclass[39m=[32m"app-header__brand"[39m
+          [33mhref[39m=[32m"/"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33maria-hidden[39m=[32m"true"[39m
+            [33mclass[39m=[32m"app-header__logo"[39m
+          [36m>[39m
+            [36m<span />[39m
+          [36m</span>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__wordmark"[39m
+          [36m>[39m
+            [0mRolefit[0m
+          [36m</span>[39m
+        [36m</a>[39m
+        [36m<nav[39m
+          [33maria-label[39m=[32m"Primary"[39m
+          [33mclass[39m=[32m"app-header__desktop-nav"[39m
+        [36m>[39m
+          [36m<a[39m
+            [33maria-current[39m=[32m"page"[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/"[39m
+          [36m>[39m
+            [0mBoard[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/analytics"[39m
+          [36m>[39m
+            [0mAnalytics[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/companies"[39m
+          [36m>[39m
+            [0mCompanies[0m
+          [36m</a>[39m
+        [36m</nav>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__center"[39m
+        [36m>[39m
+          [36m<label[39m
+            [33mclass[39m=[32m"rf-search app-header__search"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<circle[39m
+                [33mcx[39m=[32m"9"[39m
+                [33mcy[39m=[32m"9"[39m
+                [33mr[39m=[32m"5.5"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13 13 4 4"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [36m<span[39m
+              [33mclass[39m=[32m"sr-only"[39m
+            [36m>[39m
+              [0mSearch roles[0m
+            [36m</span>[39m
+            [36m<input[39m
+              [33maria-label[39m=[32m"Search roles"[39m
+              [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+              [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+              [33mtype[39m=[32m"search"[39m
+              [33mvalue[39m=[32m""[39m
+            [36m/>[39m
+          [36m</label>[39m
+        [36m</div>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__actions"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__reviewed-badge"[39m
+          [36m>[39m
+            [0mAI-REVIEWED[0m
+          [36m</span>[39m
+          [36m<button[39m
+            [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+            [33mtype[39m=[32m"button"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13.5 3.5 3 3L7 16H4v-3z"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m11.5 5.5 3 3"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [0mRésumé[0m
+          [36m</button>[39m
+          [36m<div[39m
+            [33mclass[39m=[32m"app-header__mobile-nav"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Open navigation"[39m
+              [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+              [33mdata-visual-size[39m=[32m"44"[39m
+              [33mtype[39m=[32m"button"[39m
+            [36m>[39m
+              [36m<svg[39m
+                [33maria-hidden[39m=[32m"true"[39m
+                [33mclass[39m=[32m"rf-icon"[39m
+                [33mfill[39m=[32m"none"[39m
+                [33mfocusable[39m=[32m"false"[39m
+                [33mheight[39m=[32m"18"[39m
+                [33mstroke[39m=[32m"currentColor"[39m
+                [33mstroke-linecap[39m=[32m"round"[39m
+                [33mstroke-linejoin[39m=[32m"round"[39m
+                [33mstroke-width[39m=[32m"1.75"[39m
+                [33mviewBox[39m=[32m"0 0 20 20"[39m
+                [33mwidth[39m=[32m"18"[39m
+              [36m>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 5h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 10h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 15h14"[39m
+                [36m/>[39m
+              [36m</svg>[39m
+            [36m</button>[39m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"position: relative; flex: 0 0 auto;"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32...
+ ❯ waitForWrapper ../../../../dashboard/node_modules/@testing-library/dom/dist/wait-for.js:163:27
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:86:33
+ ❯ components/rolefit/RolefitBoard.test.tsx:236:23
+    234|   expect(screen.queryByText('Saved Role')).toBeNull();
+    235|   fireEvent.click(screen.getByRole('button',{name:'History'}));
+    236|   expect(await screen.findByText('Saved Role')).toBeTruthy();
+       |                       ^
+    237|   expect(screen.getByText('Source closed')).toBeTruthy();
+    238| });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  2 failed | 9 skipped (11)
+   Start at  19:41:30
+   Duration  4.14s (transform 1.00s, setup 0ms, import 1.51s, tests 1.51s, environment 778ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green2.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green2.txt
new file mode 100644
index 0000000..80d12a1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-green2.txt
@@ -0,0 +1,8 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+
+ Test Files  1 passed (1)
+      Tests  2 passed | 9 skipped (11)
+   Start at  19:43:22
+   Duration  2.90s (transform 895ms, setup 0ms, import 1.44s, tests 433ms, environment 713ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-red.txt
new file mode 100644
index 0000000..6334fc4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-ui-red.txt
@@ -0,0 +1,596 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ components/rolefit/RolefitBoard.test.tsx (11 tests | 2 failed | 9 skipped) 993ms
+   × discovery hides expired rows until older-live opt-in, and labels availability separately 247ms
+   × history retains a closed saved job independently of discovery and its totals 744ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  components/rolefit/RolefitBoard.test.tsx > discovery hides expired rows until older-live opt-in, and labels availability separately
+AssertionError: expected <h1 …(1)></h1> to be null
+
+- Expected:
+null
+
++ Received:
+<h1
+  style="margin: 0px; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: var(--text-primary); line-height: 1.15;"
+>
+  Staff Engineer
+</h1>
+
+ ❯ components/rolefit/RolefitBoard.test.tsx:223:48
+
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
+
+ FAIL  components/rolefit/RolefitBoard.test.tsx > history retains a closed saved job independently of discovery and its totals
+TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "History"
+
+Here are the accessible roles:
+
+  banner:
+
+  Name "":
+  [36m<header[39m
+    [33mclass[39m=[32m"app-header"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  link:
+
+  Name "Rolefit board":
+  [36m<a[39m
+    [33maria-label[39m=[32m"Rolefit board"[39m
+    [33mclass[39m=[32m"app-header__brand"[39m
+    [33mhref[39m=[32m"/"[39m
+  [36m/>[39m
+
+  Name "Board":
+  [36m<a[39m
+    [33maria-current[39m=[32m"page"[39m
+    [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+    [33mhref[39m=[32m"/"[39m
+  [36m/>[39m
+
+  Name "Analytics":
+  [36m<a[39m
+    [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+    [33mhref[39m=[32m"/analytics"[39m
+  [36m/>[39m
+
+  Name "Companies":
+  [36m<a[39m
+    [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+    [33mhref[39m=[32m"/companies"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  navigation:
+
+  Name "Primary":
+  [36m<nav[39m
+    [33maria-label[39m=[32m"Primary"[39m
+    [33mclass[39m=[32m"app-header__desktop-nav"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  searchbox:
+
+  Name "Search roles":
+  [36m<input[39m
+    [33maria-label[39m=[32m"Search roles"[39m
+    [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+    [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+    [33mtype[39m=[32m"search"[39m
+    [33mvalue[39m=[32m""[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  button:
+
+  Name "Résumé":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Open navigation":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"menu"[39m
+    [33maria-label[39m=[32m"Open navigation"[39m
+    [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+    [33mdata-visual-size[39m=[32m"44"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Account: u@x.com":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"menu"[39m
+    [33maria-label[39m=[32m"Account: u@x.com"[39m
+    [33mclass[39m=[32m"rf-account-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"width: 44px; height: 44px; border-radius: 50%; background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent); font-size: 13px; font-weight: 800; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0px;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Filters":
+  [36m<button[39m
+    [33maria-controls[39m=[32m"_r_1_"[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--ghost rf-button--md rf-board-filter-summary__toggle"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Category":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Pay":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"dialog"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Match":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Location":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Source":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Industry":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Size":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Country":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Sort: Best match":
+  [36m<button[39m
+    [33maria-expanded[39m=[32m"false"[39m
+    [33maria-haspopup[39m=[32m"listbox"[39m
+    [33mclass[39m=[32m"rf-board-filter-trigger rf-focusable"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12.5px; color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Reject":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--secondary rf-button--md"[39m
+    [33mstyle[39m=[32m"font-size: 12.5px; color: var(--danger); border: 1px solid var(--danger-border); border-radius: 9px; padding: 7px 16px;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Mark as applied":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--secondary rf-button--md"[39m
+    [33mstyle[39m=[32m"font-size: 12.5px; color: var(--success); border: 1px solid var(--success-border); border-radius: 9px; padding: 7px 16px;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Correct job details":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--secondary rf-button--md"[39m
+    [33mstyle[39m=[32m"font-size: 12.5px; color: var(--accent); border: 1px solid var(--accent-border); border-radius: 9px; padding: 7px 14px;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Prefill application":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--md"[39m
+    [33mstyle[39m=[32m"flex: 0 0 auto;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Generation instructions":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--outline rf-button--compact"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: var(--text-secondary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Generate résumé":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--md"[39m
+    [33mstyle[39m=[32m"flex: 0 0 auto;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Generation instructions":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--outline rf-button--compact"[39m
+    [33mstyle[39m=[32m"display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: var(--text-secondary); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 11px; cursor: pointer;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Generate cover letter":
+  [36m<button[39m
+    [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--md"[39m
+    [33mstyle[39m=[32m"flex: 0 0 auto;"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  status:
+
+  Name "":
+  [36m<span[39m
+    [33maria-live[39m=[32m"polite"[39m
+    [33mclass[39m=[32m"rf-board-filter-summary__count"[39m
+    [33mrole[39m=[32m"status"[39m
+  [36m/>[39m
+
+  Name "":
+  [36m<div[39m
+    [33maria-live[39m=[32m"polite"[39m
+    [33mclass[39m=[32m"rf-board-result-count"[39m
+    [33mrole[39m=[32m"status"[39m
+  [36m/>[39m
+
+  Name "":
+  [36m<div[39m
+    [33maria-live[39m=[32m"polite"[39m
+    [33mrole[39m=[32m"status"[39m
+    [33mstyle[39m=[32m"font-size: 12px; color: var(--text-secondary); margin-top: 0px;"[39m
+  [36m/>[39m
+
+  Name "Loading full job details":
+  [36m<div[39m
+    [33maria-label[39m=[32m"Loading full job details"[39m
+    [33maria-live[39m=[32m"polite"[39m
+    [33mclass[39m=[32m"rf-loading-state rf-job-detail-system-state"[39m
+    [33mrole[39m=[32m"status"[39m
+  [36m/>[39m
+
+  Name "":
+  [36m<div[39m
+    [33mrole[39m=[32m"status"[39m
+  [36m/>[39m
+
+  Name "":
+  [36m<div[39m
+    [33mrole[39m=[32m"status"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  radiogroup:
+
+  Name "Remote filter":
+  [36m<div[39m
+    [33maria-label[39m=[32m"Remote filter"[39m
+    [33mclass[39m=[32m"rf-segments rf-board-filter-segments"[39m
+    [33mrole[39m=[32m"radiogroup"[39m
+  [36m/>[39m
+
+  Name "Job status view":
+  [36m<div[39m
+    [33maria-label[39m=[32m"Job status view"[39m
+    [33mclass[39m=[32m"rf-segments rf-board-view-segments"[39m
+    [33mrole[39m=[32m"radiogroup"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  radio:
+
+  Name "All":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"true"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"0"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Remote":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"false"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"-1"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Hybrid":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"false"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"-1"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Onsite":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"false"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"-1"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Active":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"true"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"0"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  Name "Applied":
+  [36m<button[39m
+    [33maria-checked[39m=[32m"false"[39m
+    [33mclass[39m=[32m"rf-segments__item rf-focusable"[39m
+    [33mrole[39m=[32m"radio"[39m
+    [33mtabindex[39m=[32m"-1"[39m
+    [33mtype[39m=[32m"button"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  list:
+
+  Name "":
+  [36m<div[39m
+    [33mclass[39m=[32m"rf-job-list"[39m
+    [33mrole[39m=[32m"list"[39m
+    [33mstyle[39m=[32m"position: relative; height: 116px;"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  heading:
+
+  Name "Staff Engineer":
+  [36m<h1[39m
+    [33mstyle[39m=[32m"margin: 0px; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: var(--text-primary); line-height: 1.15;"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+  alert:
+
+  Name "":
+  [36m<div[39m
+    [33mrole[39m=[32m"alert"[39m
+  [36m/>[39m
+
+  --------------------------------------------------
+
+Ignored nodes: comments, script, style
+[36m<body>[39m
+  [36m<div>[39m
+    [36m<div[39m
+      [33mclass[39m=[32m"app-shell app-shell--board"[39m
+      [33mdata-ui-contract-geometry[39m=[32m"board viewport shell geometry"[39m
+      [33mstyle[39m=[32m"height: 100vh; display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary); overflow: hidden;"[39m
+    [36m>[39m
+      [36m<header[39m
+        [33mclass[39m=[32m"app-header"[39m
+      [36m>[39m
+        [36m<a[39m
+          [33maria-label[39m=[32m"Rolefit board"[39m
+          [33mclass[39m=[32m"app-header__brand"[39m
+          [33mhref[39m=[32m"/"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33maria-hidden[39m=[32m"true"[39m
+            [33mclass[39m=[32m"app-header__logo"[39m
+          [36m>[39m
+            [36m<span />[39m
+          [36m</span>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__wordmark"[39m
+          [36m>[39m
+            [0mRolefit[0m
+          [36m</span>[39m
+        [36m</a>[39m
+        [36m<nav[39m
+          [33maria-label[39m=[32m"Primary"[39m
+          [33mclass[39m=[32m"app-header__desktop-nav"[39m
+        [36m>[39m
+          [36m<a[39m
+            [33maria-current[39m=[32m"page"[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/"[39m
+          [36m>[39m
+            [0mBoard[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/analytics"[39m
+          [36m>[39m
+            [0mAnalytics[0m
+          [36m</a>[39m
+          [36m<a[39m
+            [33mclass[39m=[32m"app-header__nav-link rf-focusable"[39m
+            [33mhref[39m=[32m"/companies"[39m
+          [36m>[39m
+            [0mCompanies[0m
+          [36m</a>[39m
+        [36m</nav>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__center"[39m
+        [36m>[39m
+          [36m<label[39m
+            [33mclass[39m=[32m"rf-search app-header__search"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<circle[39m
+                [33mcx[39m=[32m"9"[39m
+                [33mcy[39m=[32m"9"[39m
+                [33mr[39m=[32m"5.5"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13 13 4 4"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [36m<span[39m
+              [33mclass[39m=[32m"sr-only"[39m
+            [36m>[39m
+              [0mSearch roles[0m
+            [36m</span>[39m
+            [36m<input[39m
+              [33maria-label[39m=[32m"Search roles"[39m
+              [33mdata-ui-contract-composite[39m=[32m"board search field"[39m
+              [33mplaceholder[39m=[32m"Search roles, companies, locations…"[39m
+              [33mtype[39m=[32m"search"[39m
+              [33mvalue[39m=[32m""[39m
+            [36m/>[39m
+          [36m</label>[39m
+        [36m</div>[39m
+        [36m<div[39m
+          [33mclass[39m=[32m"app-header__actions"[39m
+        [36m>[39m
+          [36m<span[39m
+            [33mclass[39m=[32m"app-header__reviewed-badge"[39m
+          [36m>[39m
+            [0mAI-REVIEWED[0m
+          [36m</span>[39m
+          [36m<button[39m
+            [33mclass[39m=[32m"rf-button rf-focusable rf-button--primary rf-button--sm"[39m
+            [33mtype[39m=[32m"button"[39m
+          [36m>[39m
+            [36m<svg[39m
+              [33maria-hidden[39m=[32m"true"[39m
+              [33mclass[39m=[32m"rf-icon"[39m
+              [33mfill[39m=[32m"none"[39m
+              [33mfocusable[39m=[32m"false"[39m
+              [33mheight[39m=[32m"16"[39m
+              [33mstroke[39m=[32m"currentColor"[39m
+              [33mstroke-linecap[39m=[32m"round"[39m
+              [33mstroke-linejoin[39m=[32m"round"[39m
+              [33mstroke-width[39m=[32m"1.75"[39m
+              [33mviewBox[39m=[32m"0 0 20 20"[39m
+              [33mwidth[39m=[32m"16"[39m
+            [36m>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m13.5 3.5 3 3L7 16H4v-3z"[39m
+              [36m/>[39m
+              [36m<path[39m
+                [33md[39m=[32m"m11.5 5.5 3 3"[39m
+              [36m/>[39m
+            [36m</svg>[39m
+            [0mRésumé[0m
+          [36m</button>[39m
+          [36m<div[39m
+            [33mclass[39m=[32m"app-header__mobile-nav"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32m"menu"[39m
+              [33maria-label[39m=[32m"Open navigation"[39m
+              [33mclass[39m=[32m"rf-icon-button rf-focusable rf-icon-button--md rf-icon-button--default"[39m
+              [33mdata-visual-size[39m=[32m"44"[39m
+              [33mtype[39m=[32m"button"[39m
+            [36m>[39m
+              [36m<svg[39m
+                [33maria-hidden[39m=[32m"true"[39m
+                [33mclass[39m=[32m"rf-icon"[39m
+                [33mfill[39m=[32m"none"[39m
+                [33mfocusable[39m=[32m"false"[39m
+                [33mheight[39m=[32m"18"[39m
+                [33mstroke[39m=[32m"currentColor"[39m
+                [33mstroke-linecap[39m=[32m"round"[39m
+                [33mstroke-linejoin[39m=[32m"round"[39m
+                [33mstroke-width[39m=[32m"1.75"[39m
+                [33mviewBox[39m=[32m"0 0 20 20"[39m
+                [33mwidth[39m=[32m"18"[39m
+              [36m>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 5h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 10h14"[39m
+                [36m/>[39m
+                [36m<path[39m
+                  [33md[39m=[32m"M3 15h14"[39m
+                [36m/>[39m
+              [36m</svg>[39m
+            [36m</button>[39m
+          [36m</div>[39m
+          [36m<div[39m
+            [33mstyle[39m=[32m"position: relative; flex: 0 0 auto;"[39m
+          [36m>[39m
+            [36m<button[39m
+              [33maria-expanded[39m=[32m"false"[39m
+              [33maria-haspopup[39m=[32...
+ ❯ Object.getElementError ../../../../dashboard/node_modules/@testing-library/dom/dist/config.js:37:19
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:76:38
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:52:17
+ ❯ ../../../../dashboard/node_modules/@testing-library/dom/dist/query-helpers.js:95:19
+ ❯ components/rolefit/RolefitBoard.test.tsx:235:26
+    233|   render(<RolefitBoard {...baseProps} initialHistory={[saved]} />);
+    234|   expect(screen.queryByText('Saved Role')).toBeNull();
+    235|   fireEvent.click(screen.getByRole('button',{name:'History'}));
+       |                          ^
+    236|   expect(await screen.findByText('Saved Role')).toBeTruthy();
+    237|   expect(screen.getByText('Source closed')).toBeTruthy();
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  2 failed | 9 skipped (11)
+   Start at  19:37:10
+   Duration  4.82s (transform 1.72s, setup 0ms, import 2.47s, tests 993ms, environment 1.04s)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-utc-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-utc-red.txt
new file mode 100644
index 0000000..37cb7f3
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/task9-utc-red.txt
@@ -0,0 +1,39 @@
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/jobLifecycleConsumers.test.ts (8 tests | 1 failed | 7 skipped) 10ms
+   × rejects timezone-free lifecycle dates rather than applying browser local time 8ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/jobLifecycleConsumers.test.ts > rejects timezone-free lifecycle dates rather than applying browser local time
+AssertionError: expected { feedEnabled: true, …(5) } to be null
+
+- Expected:
+null
+
++ Received:
+{
+  "discoveryAnchorAt": "2026-03-01T07:00:00",
+  "discoveryExpiresAt": "2026-03-31T07:00:00",
+  "feedEnabled": true,
+  "payloadAvailability": "retired",
+  "sourceAvailability": "open",
+  "sourceEnabled": true,
+}
+
+ ❯ lib/jobLifecycleConsumers.test.ts:62:122
+     60|
+     61| it('rejects timezone-free lifecycle dates rather than applying browser…
+     62|   expect(parseJobLifecycle({...state,discoveryAnchorAt:'2026-03-01T07:…
+       |                                                                                                                          ^
+     63| });
+     64|
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
+
+
+ Test Files  1 failed (1)
+      Tests  1 failed | 7 skipped (8)
+   Start at  19:58:30
+   Duration  964ms (transform 307ms, setup 0ms, import 356ms, tests 10ms, environment 0ms)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-report.md
new file mode 100644
index 0000000..f809173
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-report.md
@@ -0,0 +1,212 @@
+# Task 9 — discovery, availability and retained history
+
+Local implementation complete, pending the controller's fresh independent permitted
+requirements/quality review. No production changes or activation. Source pin:
+`ba00e50153f948ebe8726db1a445e201ebce5901`; author base:
+`5a319253169cd03e1821e7c3d02df82249e6ce8b`. Report/evidence-only follow-up does not
+change product source. Task8 interfaces reused from source
+`eaef2fb43199771d3d18a3ed876cc62fb240a6ac` and report
+`98c1fde4a160ee99ba664d69e73a9cc885fea2f4`.
+
+## Result and interfaces
+
+Discovery uses the frozen listing expiry, exactly anchor + 720 elapsed UTC hours.
+At expiry the default feed excludes a listing; `older=1` explicitly includes
+expired confirmed-open listings. Unknown availability, proven closure, discovery
+expiry and payload retirement/unavailability are separate states. Original
+`first_seen_at` remains readable as Discovered and supplies existing newest sort;
+no employer posting-age or expiry-as-closure claim. Payload absence never closes
+an open source. Multiple mappings use any eligible source for membership, with a
+stable representative listing for display.
+
+`dashboard/lib/jobLifecycle.ts` reexports `parseJobLifecycle` and
+`discoveryPredicate` from client-safe `jobLifecycleState.ts`. That split prevents
+a client component from bundling demand/DB imports. Total bounded parsers handle
+legacy scalar/double-encoded JSON, validate enum/boolean/array fields and require
+zoned dates with a coherent 720-hour interval. Actual detail HTTP responses use
+the validated parser, including benefits, requirements, red flags and questions.
+
+Dashboard discovery rows/counts, reviewer candidates, review-pool statistics,
+locations and analytics discovery pools reuse the shared SQL predicate. Closed
+filters/counts use the separate source-closure helper. Actual dashboard page and
+reviewer total/rows are each one statement, sharing membership/snapshot/expiry
+boundary; ties use original first-seen then job ID. Reviewer retains its existing
+location/company/verdict and hydration-dependent pruned-payload gates and has no
+automatic older-live option. Analytics labels distinguish current discovery from
+retained private review/application aggregates and legacy observed closure durations.
+
+Private approved/corrected/prepared/applied history has a separate owner-scoped
+query/count/page, independent of discovery expiry, closure, review errors and
+profile location/company gates. History cards open their actual detail. Saved
+JD/Q/version and exact actual demand receipts remain authoritative; current
+hydrated detail stays separate. NULL historical questions retain orphan answers
+and explicitly say the historical schema is unavailable. No retrofit to current
+questions. Proven-closed detail queues no new current hydration demand. Genuine
+historical generated artifacts with unknown original inputs still terminal-defer;
+full atomic recapture remains UNIMPLEMENTED. Existing contentless instruction or
+application markers can establish first actual input under Task8's contract.
+
+The public board now renders per request instead of its former 120-second ISR
+cache, so a cached response cannot span expiry. This increases anonymous DB
+traffic; production throughput/per-row cost is unmeasured. `page`/`historyPage`
+independently page at 500 rows. Server total/pagination are separate from
+page-local client facets/search/N-of-M; those local counts share their loaded
+view pool and are not full-corpus facet/search claims. Saved filter JSON cannot
+silently activate older-live. Existing editorial audience curation is retained.
+
+## Narrow public projection ruling
+
+An additive migration and identical `schema.sql` suffix provide:
+
+- `public.lifecycle_job_state(text) -> nullable jsonb`: feed/source display
+  booleans, source availability, frozen anchor/expiry, payload availability.
+- `public.lifecycle_discovery_visible(text,timestamptz,boolean) -> boolean`.
+- `public.lifecycle_source_closed(text,timestamptz) -> boolean`.
+
+They are fixed schema-qualified SELECTs, STABLE SECURITY DEFINER with fixed
+`pg_catalog, public` search path, PUBLIC EXECUTE revoked and anon/authenticated
+EXECUTE granted. No dynamic SQL, DML, bypass switch or user/private/claim/capacity/
+credential projection. Underlying lifecycle table grants and existing anon/owner
+wrappers remain unchanged; board reads never switch to serviceSql. The parent
+explicitly authorized this narrow local interface because lifecycle state stays
+service-only. It is a new derived public read capability and adds per-row read
+work; ordinary role/query results below do not establish independent security or
+load approval. No production helper/grant installation was performed.
+
+Unmapped public rows return NULL state and honestly fall back to legacy closed_at;
+no anchor/status is invented. Mapping/readiness is a rollout prerequisite. Flags
+off preserve that legacy path except proven all-source closure stays excluded on
+rollback. Rollback changes no frozen dates, payload content or closure proof.
+Existing flags remain off; retirement stays dry-run and archive inactive.
+
+## Commands, results and evidence
+
+All shell commands used `/bin/bash`, login disabled. Commands below ran in the
+worktree; the TS command ran from `dashboard`. Evidence is in
+[task-9-evidence](task-9-evidence/), with full intermediate failure chronology in
+[chronology.md](task-9-evidence/chronology.md). Overlapping runs are not summed.
+Final checks assessed the working source committed at the source pin; the last
+reviewer-only change was followed by affected reviewer checks on both majors.
+
+```sh
+./node_modules/.bin/vitest run lib/jobLifecycleConsumers.test.ts lib/jobsQuery.test.ts lib/filters.test.ts lib/rolefit/boardFilters.test.ts lib/rolefit/filter.test.ts lib/queries.jobDetail.test.ts lib/queries.reviewFeed.test.ts components/rolefit/RolefitBoard.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/JobCard.test.tsx 'app/api/jobs/[id]/route.test.ts' components/analytics/SecondarySurfaceFixes.test.tsx app/ui-contract.test.ts
+```
+
+`task9-selected-release.txt`: **193 passed /13 files, no skips**, exit0. The
+history-opening jsdom case prints its ordinary unimplemented window.scrollTo
+notice. Coverage includes exact elapsed UTC/DST boundary, explicit older-live,
+unknown/closed/expired/retired distinctions, total JSON, count/query/paging,
+private history/detail access and actual analytic captions/UI source contracts.
+
+From repo, each MAJOR substitution was a separate owned random loopback harness:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
+```
+
+`task9-db17-complete.txt`, `task9-db16-complete.txt`: **6 passed each**, no skips,
+actual servers **17.11 Debian17.11-1.pgdg13+2 /16.15 Debian16.15-1.pgdg13+2**.
+They install the additive migration twice against pre-Task9 schema, verify schema
+suffix parity, and execute actual anon/owner wrappers: flag-off/unmapped,
+current/older membership, total/page agreement, approved/corrected/prepared/
+applied history, profile-discovery0/history4, distinct closed filter and rollback
+preserving dates/retired payload/closure. No shared55432 service or unrelated DB
+suite was used. Fixture reset affects only its harness-owned test DB.
+
+`task9-reviewer17-release.txt`, `task9-reviewer16-release.txt`: **9 passed,
+30 deselected each**, exit0, same actual server versions. Selection is explicitly
+candidate/stale/feed_flags, not the broad existing reviewer suite. Initial shared
+predicate RED showed flag-off expired candidates incorrectly excluded. Final
+one-statement regression RED recorded two real candidate reads; GREEN records one
+read and actual unchanged DTO/count. This is ordinary feed feature coverage,
+not omitted independent expiry-enforcement/capacity/security mechanism assurance.
+
+```sh
+# dashboard cwd
+npm run typecheck
+npm run lint
+# repo cwd
+.venv/bin/ruff check reviewer/db.py tests/test_reviewer_lifecycle_feed.py
+git diff --check
+```
+
+`task9-typecheck-source.txt`: exit0. `task9-lint-release.txt`: exit0, **0 errors,
+9 inherited warnings** (TrendCharts dependencies, existing TanStack Virtual
+compiler warning, config exports, parseProfile expressions, theme test directive).
+`task9-ruff-final.txt`: All checks passed. `task9-diff-final.txt`: product working
+diff check exit0. The later staged check flagged terminal-output whitespace in
+literal evidence copies; report follow-up normalizes only copied text whitespace,
+preserving all result/failure text and leaving original /tmp logs intact.
+
+```sh
+node .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/browser/run.cjs
+```
+
+`task9-browser-release.txt` and `browser/result.json`: **9 assertions passed**,
+installed **Chromium151.0.7922.173**, desktop1280x800/mobile390x844, zero page
+errors/blocked external requests. Actual RolefitBoard and descendant components;
+only server props/actions/navigation/API are fake. Owned random loopback target,
+external requests aborted. Actual default feed, unchecked older-live toggle,
+opt-in older card, expiry/retired labels, selected detail and current-description
+disclosure verified. Screenshots: `browser/default.png`, `older-detail.png`,
+`mobile-detail.png`. This is not Next SSR/real auth/provider/pipeline verification.
+Normal Playwright Chromium installation failed HTTP403 `Domain forbidden` at
+cdn.playwright.dev; no alternate-host bypass. Local installed Chromium supplied
+the successful browser. Bundle first exposed DB transitive imports; corrected
+client module boundary, then browser passed. Intermediate harness errors retained.
+
+Broader requested dashboard non-DB command, from dashboard:
+
+```sh
+npm test -- --exclude '**/*.db.test.ts'
+```
+
+First `task9-dashboard-full.txt`:1706 passed/4 failed/2 skipped,217 files. Second
+`task9-dashboard-final.txt`:1708 passed/4 failed/2 skipped,217 files. The first
+included the new UI contract failure; the second began while the new UTC parser
+case was RED. Both Task9 failures were fixed and are in final scoped GREEN; the
+broad suite is **not claimed green**. Three inherited fixture failures remain:
+two live-action cases in `app/actions/tombstoneGuard.test.ts` whose mocks omit
+Task8 demand/mutation DB exports; workflow contract expects2 DATABASE_URL entries
+while BASE CI has3. Those files unchanged; carried to Task13. Two genuine skips
+are existing missing binary-PDF fixtures in fileToResumeMarkdown and parseProfile
+(named in chronology). Narrow `-t` attempts printed Vitest skipped for **name-
+filtered** cases (UI2 passed/9 filtered; detail2 passed/15 filtered); do not treat
+those as genuine skip declarations. Wrong-cwd attempts, one concurrent UI audit
+timeout, DB fixture constraint failures, intermediate source RED and fixes are
+retained explicitly. No invented full matrix or whole-suite success.
+
+## Inventory, upstream and remaining limits
+
+Actual before/after:
+`rg -n 'first_seen|last_seen|closed_at|description_pruned' reviewer dashboard job_discovery`.
+Outputs `task9-consumers.txt`/`task9-consumers-final.txt`; every returned production
+module and test/demo group is accounted in
+[consumer/rollback runbook](../../../docs/runbooks/2026-10-07-lifecycle-consumers.md).
+Safe coexistence retains Task8 source/demand/private interfaces. Rollback uses a
+compatible consumer, preserves anchors/closure/snapshots and never resets dates,
+refills retired caches, reopens proven sources or resumes destructive legacy prune.
+
+Read-only local upstream cache `refs/remotes/origin/main`:
+`73ce118205bfdbb56c18207acc0c1c4e3708c860`. Local `git log` from approved main
+reference `114cce96cb244546864a6bddc5476b5630bc024a` showed no newer delta. This is
+cached ancestry evidence, **not fresh remote/network proof**; Task13 owns that.
+One exec-server create-process call disconnected; immediate ordinary read retry
+recovered the same environment. No executor replacement/reinitialization or
+completed-stage restart. No current concrete tooling blocker.
+
+R6-5 resolved Task8 shared public transport reused unchanged, no duplicate
+integration/probes. R6-4 durable closure/health progress above physical guard is
+mandatory Task10/13 work, untouched/unwaived here. Existing unknown-artifact full
+recapture remains unimplemented; mapping completeness, public projection/per-row
+cost, dynamic board traffic and live-provider compatibility/load are unresolved
+release limits. The deliberately omitted Task3 independent expiry-enforcement,
+capacity-accounting, cross-user/adversarial security review/probes remain absent.
+No broad old pytest/safety tests, reserved destructive feedback fixtures,
+production migration/writes/grants, flag enabling, IAM/S3 provisioning, real
+provider/model/auth calls, push/PR/merge/deployment or paid model calls occurred.
+This handoff is Task9 implementation evidence; it is not all13/final release or
+independent security acceptance.
diff --git a/dashboard/app/api/jobs/[id]/route.test.ts b/dashboard/app/api/jobs/[id]/route.test.ts
index 9884e72..787134f 100644
--- a/dashboard/app/api/jobs/[id]/route.test.ts
+++ b/dashboard/app/api/jobs/[id]/route.test.ts
@@ -107,10 +107,21 @@ describe("GET /api/jobs/[id] — anti-error contract survives multi-tenancy", ()
 
 test("saved review JD remains authoritative while current public detail is separate", async () => {
   const { requestJobPayload } = await import("@/lib/jobLifecycle");
   vi.mocked(requestJobPayload).mockResolvedValueOnce({status:"ready", id:"d", kind:"description", versionId:"v", description:"Current JD", questions:null});
   mocks.getJobReviewDetail.mockResolvedValue({description:"Saved private JD", reasoning:"Saved reasoning"});
   const body = await (await call("greenhouse:acme:123")).json();
   expect(body.description).toBe("Saved private JD");
   expect(body.currentDescription).toBe("Current JD");
   expect(body.reasoning).toBe("Saved reasoning");
 });
+
+test('closed source exposes retained history without enqueueing current hydration',async()=>{
+  const {requestJobPayload}=await import('@/lib/jobLifecycle');
+  const lifecycle={feedEnabled:true,sourceEnabled:true,sourceAvailability:'closed',discoveryAnchorAt:'2026-09-01T00:00:00Z',discoveryExpiresAt:'2026-10-01T00:00:00Z',payloadAvailability:'retired'};
+  mocks.getJobReviewDetail.mockResolvedValue({description:'Saved JD',descriptionIsSaved:true,lifecycle});
+  const body=await (await call('greenhouse:acme:123')).json();
+  expect(body.description).toBe('Saved JD');
+  expect(body.lifecycle.sourceAvailability).toBe('closed');
+  expect(body.payload.status).toBe('deferred');
+  expect(requestJobPayload).not.toHaveBeenCalled();
+});
diff --git a/dashboard/app/api/jobs/[id]/route.ts b/dashboard/app/api/jobs/[id]/route.ts
index b529946..73ef7a2 100644
--- a/dashboard/app/api/jobs/[id]/route.ts
+++ b/dashboard/app/api/jobs/[id]/route.ts
@@ -1,11 +1,11 @@
-import { requestJobPayload } from "@/lib/jobLifecycle";
+import { parseJobLifecycle, requestJobPayload, type DemandResult } from "@/lib/jobLifecycle";
 import { getJobReviewDetail, getJobQuestion } from "@/lib/queries";
 import { getUserId } from "@/lib/auth";
 import { JOB_ID_RE } from "@/lib/jobIdValidator";
 
 export const dynamic = "force-dynamic";
 
 const EMPTY = {
   reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
   description: null, url: null,
   experience_match: null, industry: null, industry_subcategory: null,
@@ -30,16 +30,21 @@ export async function GET(
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
-  const payload = viewerId && detail ? await requestJobPayload(viewerId, id, "description") : null;
+  const lifecycle=parseJobLifecycle(detail?.lifecycle);
+  const payload: DemandResult | null = viewerId && detail
+    ? lifecycle?.sourceAvailability === "closed"
+      ? {status:"deferred",id:null,reason:"Source closed. Your saved review and application history remains available."}
+      : await requestJobPayload(viewerId,id,"description")
+    : null;
   return Response.json({ ...(detail ?? EMPTY), questions,
     ...(payload?.status === "ready" ? {currentDescription:payload.description,currentQuestions:payload.questions} : {}), ...(payload && payload.status !== "legacy" ? {payload} : {}) }, {
     headers: { "Cache-Control": "private, no-store" },
   });
 }
diff --git a/dashboard/app/board/page.tsx b/dashboard/app/board/page.tsx
index 64ae96e..1ffca08 100644
--- a/dashboard/app/board/page.tsx
+++ b/dashboard/app/board/page.tsx
@@ -1,46 +1,47 @@
 import { serverBoardFilters } from "@/lib/filters";
-import { getJobs } from "@/lib/queries";
+import { getJobsPage } from "@/lib/queries";
 import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
 import { saveProfileResume } from "@/app/actions/profile";
 import { rejectJob, unrejectJob } from "@/app/actions/jobs";
 import {
   markApplicationApplied, unmarkApplicationApplied,
 } from "@/app/actions/applications";
 import { RolefitBoard } from "@/components/rolefit/RolefitBoard";
 
-// The public board, edge-cached (ISR): identical for every anonymous visitor, so
-// anon hits stop paying the ~400ms 500-row dynamic SSR on every request. The auth
-// proxy REWRITES anon GET / here (the URL stays "/"); authed / renders dynamically
-// in app/page.tsx, and an authed visitor navigating here directly is redirected
-// back to / by the proxy. Per-visitor state (the board_filters cookie — httpOnly)
-// cannot vary a cached render, so RolefitBoard hydrates it client-side after mount
-// (hydrateFiltersFromApi). nowIso freshness labels tolerate the staleness window.
-export const revalidate = 120;
+// Anonymous / rewrites here. Discovery expiry/count/page are evaluated per request;
+// caching the complete page would retain rows across the exact expiry boundary.
+// The older-live choice is explicit in the query string; other saved client filters
+// still hydrate from the existing cookie API.
+export const dynamic = "force-dynamic";
 
-export default async function PublicBoardPage() {
+export default async function PublicBoardPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
+  const params=await searchParams;
+  const includeOlderLive=params.older === "1";
+  const page=typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Number(params.page) : 0;
   // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
   // The public board keeps the deliberate engineer-only editorial curation.
-  // In production a failed fetch must THROW so a failed ISR revalidation keeps
-  // serving the last good cached board (stale-while-error) instead of caching an
-  // empty one. Outside production (the infra-less public visual gate runs `next
-  // dev` against an unreachable DB) render the empty board shell instead.
-  const jobs = await getJobs(serverBoardFilters("anon"), null).catch((error: unknown) => {
+  // Production failures remain visible to the route error boundary. The existing
+  // infra-less development visual harness can render an empty shell.
+  const jobsPage = await getJobsPage({...serverBoardFilters("anon"),includeOlderLive}, null,page).catch((error: unknown) => {
     if (process.env.NODE_ENV === "production") throw error;
-    return [];
+    return {rows:[],total:0,page};
   });
   return (
     <RolefitBoard
-      jobs={jobs}
+      key={`${includeOlderLive}:${page}`}
+      jobs={jobsPage.rows}
+      discoveryTotal={jobsPage.total}
+      discoveryPage={page}
       nowIso={new Date().toISOString()}
       isAuthed={false}
-      initialFilters={parseBoardFilters(undefined)}
+      initialFilters={{...parseBoardFilters(undefined),includeOlderLive}}
       hydrateFiltersFromApi
       saveResume={saveProfileResume}
       rejectJob={rejectJob}
       unrejectJob={unrejectJob}
       markApplied={markApplicationApplied}
       unmarkApplied={unmarkApplicationApplied}
       operator={undefined}
       hasProfile={false}
       viewerEmail={null}
       isAdmin={false}
diff --git a/dashboard/app/page.tsx b/dashboard/app/page.tsx
index f9358cf..233b360 100644
--- a/dashboard/app/page.tsx
+++ b/dashboard/app/page.tsx
@@ -1,15 +1,15 @@
 import { cookies } from "next/headers";
 import { redirect } from "next/navigation";
 import { serverBoardFilters } from "@/lib/filters";
 import {
-  getApplicationPackages, getJobs, getLatestPollRun,
+  getApplicationPackages, getJobsPage, getLatestPollRun,
   getProfile, getRejectedJobs, getReviewStats,
 } from "@/lib/queries";
 import { STALE_HEALTH_HOURS } from "@/lib/config";
 import { computeHealth } from "@/lib/status";
 import { getUserClaims } from "@/lib/auth";
 import { isAdmin } from "@/lib/admin";
 import { saveProfileResume } from "@/app/actions/profile";
 import { rejectJob, unrejectJob } from "@/app/actions/jobs";
 import {
   markApplicationApplied, unmarkApplicationApplied,
@@ -21,63 +21,74 @@ import type { OperatorSignals } from "@/lib/types";
 
 export const dynamic = "force-dynamic";
 
 export default async function Page({
   searchParams,
 }: {
   searchParams: Promise<Record<string, string | string[] | undefined>>;
 }) {
   const claims = await getUserClaims();
   const viewerId = claims?.id ?? null;
-  await searchParams; // filters now client-side; keep the param contract
+  const params = await searchParams;
+  const includeOlderLive=params.older === "1";
+  const pageNumber=(value:unknown) => typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 0;
+  const page=pageNumber(params.page), historyPage=pageNumber(params.historyPage);
 
   if (viewerId) {
     // Authed board: the reviewer's approve join already curates it, so no title
     // prefilter (include: []). See lib/filters.ts serverBoardFilters.
-    const filters = serverBoardFilters("authed");
-    // Single wave. getJobs/getRejectedJobs self-serve the viewer's preferred_locations via
-    // a correlated subquery, so getProfile no longer gates them — all six board queries run
+    const filters = {...serverBoardFilters("authed"),includeOlderLive};
+    // Single wave. Discovery/rejected queries self-serve the viewer's preferred_locations via
+    // a correlated subquery, so getProfile no longer gates them — all seven board queries run
     // through ONE dbLimit(3). Pool max is 3 (lib/db.ts), so exactly three execute at a time
     // and postgres.js never queues (preserving the "fired ≤ pool max" invariant the old
     // jobs+dbLimit(2) split held). The render-critical trio (profile, jobs, rejected) leads
-    // the array so it starts first; the secondary trio drains as those slots free.
-    const [profile, jobs, rejectedJobs, pollRun, reviewStats, packages] = await dbLimit<unknown>([
+    // the array so it starts first; the remaining queries drain as those slots free.
+    const [profile, jobsPage, rejectedJobs, pollRun, reviewStats, packages, savedPage] = await dbLimit<unknown>([
       () => getProfile(viewerId),
-      () => getJobs(filters, viewerId),
+      () => getJobsPage(filters, viewerId,page),
       () => getRejectedJobs(viewerId),
       () => getLatestPollRun(viewerId),
       () => getReviewStats(viewerId),
       () => getApplicationPackages(viewerId),
+      () => getJobsPage(filters,viewerId,historyPage,true),
     ], 3) as [
       Awaited<ReturnType<typeof getProfile>>,
-      Awaited<ReturnType<typeof getJobs>>,
+      Awaited<ReturnType<typeof getJobsPage>>,
       Awaited<ReturnType<typeof getRejectedJobs>>,
       Awaited<ReturnType<typeof getLatestPollRun>>,
       Awaited<ReturnType<typeof getReviewStats>>,
       Awaited<ReturnType<typeof getApplicationPackages>>,
+      Awaited<ReturnType<typeof getJobsPage>>,
     ];
     // A brand-new account has no profile row yet — send them through onboarding before any
     // board render (the concurrently-fetched jobs are simply discarded on this rare path).
     if (profile == null) redirect("/onboarding");
     const operator: OperatorSignals = {
       health: computeHealth(
         pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
         new Date(),
         STALE_HEALTH_HOURS,
       ),
       unreviewed: reviewStats.unreviewed,
       reviewed: reviewStats.reviewed,
     };
-    const initialFilters = parseBoardFilters(profile.board_filters);
+    const initialFilters = {...parseBoardFilters(profile.board_filters),includeOlderLive};
     return (
       <RolefitBoard
-        jobs={jobs}
+        key={`${includeOlderLive}:${page}:${historyPage}`}
+        jobs={jobsPage.rows}
+        initialHistory={savedPage.rows}
+        discoveryTotal={jobsPage.total}
+        historyTotal={savedPage.total}
+        discoveryPage={page}
+        historyPage={historyPage}
         nowIso={new Date().toISOString()}
         isAuthed
         initialFilters={initialFilters}
         saveResume={saveProfileResume}
         rejectJob={rejectJob}
         unrejectJob={unrejectJob}
         markApplied={markApplicationApplied}
         unmarkApplied={unmarkApplicationApplied}
         operator={operator}
         hasProfile
@@ -86,27 +97,30 @@ export default async function Page({
         resumeText={profile.resume_text ?? ""}
         currentProfileVersion={profile.profile_version}
         initialPackages={packages}
         initialRejected={rejectedJobs}
       />
     );
   }
 
   // Anonymous viewer: plain open jobs, no review join, no operator telemetry.
   // The public board keeps the deliberate engineer-only editorial curation.
-  const filters = serverBoardFilters("anon");
-  const jobs = await getJobs(filters, null);
+  const filters = {...serverBoardFilters("anon"),includeOlderLive};
+  const jobsPage = await getJobsPage(filters, null,page);
   const store = await cookies();
-  const initialFilters = parseBoardFilters(store.get("board_filters")?.value);
+  const initialFilters = {...parseBoardFilters(store.get("board_filters")?.value),includeOlderLive};
   return (
     <RolefitBoard
-      jobs={jobs}
+      key={`${includeOlderLive}:${page}`}
+      jobs={jobsPage.rows}
+      discoveryTotal={jobsPage.total}
+      discoveryPage={page}
       nowIso={new Date().toISOString()}
       isAuthed={false}
       initialFilters={initialFilters}
       saveResume={saveProfileResume}
       rejectJob={rejectJob}
       unrejectJob={unrejectJob}
       markApplied={markApplicationApplied}
       unmarkApplied={unmarkApplicationApplied}
       operator={undefined}
       hasProfile={false}
diff --git a/dashboard/components/analytics/BreakdownsSection.tsx b/dashboard/components/analytics/BreakdownsSection.tsx
index 2fa3705..17030c3 100644
--- a/dashboard/components/analytics/BreakdownsSection.tsx
+++ b/dashboard/components/analytics/BreakdownsSection.tsx
@@ -41,29 +41,29 @@ function mergeTags(bars: Bar[]): Bar[] {
     if (existing) existing.count += b.count;
     else map.set(norm, { label: techTagLabel(norm), count: b.count });
   }
   return [...map.values()].sort((a, b) => b.count - a.count);
 }
 
 export function BreakdownsSection({ distributions: d }: { distributions: Distributions }) {
   const redFlagBars = d.topRedFlags.map((b) => ({ ...b, label: redFlagCategoryLabel(b.label) }));
   return (
     <div>
-      <Group label="JOBS" intro="What kinds of roles are open right now.">
-        <HBarCard title="Open jobs by location" data={hz(d.jobsByLocation)} />
-        <HBarCard title="Open jobs by department" data={hz(d.jobsByDepartment)} />
+      <Group label="JOBS" intro="Roles in the default discovery pool; source availability may be open or unknown.">
+        <HBarCard title="Discovery jobs by location" data={hz(d.jobsByLocation)} />
+        <HBarCard title="Discovery jobs by department" data={hz(d.jobsByDepartment)} />
         <HBarCard title="Remote vs on-site / hybrid" data={hz(d.jobsRemote)} />
-        <HBarCard title="Top companies by open roles" data={prettyCompanies(d.jobsByCompany)} />
-        <HBarCard title="Open jobs by ATS" subtitle="ATS = the job-posting software each company uses." data={hz(d.jobsByAts)} />
-        <SimpleBarCard title="Job lifespan (closed roles)" data={d.jobLifespan} allTicks />
+        <HBarCard title="Top companies in discovery" data={prettyCompanies(d.jobsByCompany)} />
+        <HBarCard title="Discovery jobs by ATS" subtitle="ATS = the job-posting software each company uses." data={hz(d.jobsByAts)} />
+        <SimpleBarCard title="Observed closure duration (legacy dates)" data={d.jobLifespan} allTicks />
       </Group>
-      <Group label="REVIEWS" intro="How the reviewer scored open jobs against your profile.">
+      <Group label="REVIEWS" intro="Your retained review history, independent of discovery expiry.">
         <SimpleBarCard title="Fit-score distribution" data={d.fitScore} color="var(--chart-good)" allTicks />
         <HBarCard title="Approvals by industry" data={hz(d.approvalsByIndustry)} color="var(--chart-good)" />
         <HBarCard title="Approvals by role category" data={hz(d.approvalsByRole)} color="var(--chart-good)" />
         <HBarCard title="Approvals by seniority" data={hz(notSpecified(d.approvalsBySeniority))} color="var(--chart-good)" />
         <HBarCard title="Experience match" data={hz(d.experienceMatch)} color="var(--chart-violet)" />
         <HBarCard title="Work arrangement" data={hz(notSpecified(d.workArrangement))} color="var(--chart-violet)" />
       </Group>
       <Group label="COMPANIES" intro="Who is being tracked and why some were flagged.">
         <HBarCard title="Companies by ATS" data={hz(d.companiesByAts)} />
         <HBarCard title="Companies by discovery source" subtitle="How each tracked company first entered the system." data={hz(d.companiesBySource)} />
diff --git a/dashboard/components/analytics/FunnelSection.tsx b/dashboard/components/analytics/FunnelSection.tsx
index 0fe170e..65544ec 100644
--- a/dashboard/components/analytics/FunnelSection.tsx
+++ b/dashboard/components/analytics/FunnelSection.tsx
@@ -105,41 +105,41 @@ export function FunnelSection({ funnel }: { funnel: FunnelCounts }) {
       info: { term: GLOSSARY.excluded.label, gloss: GLOSSARY.excluded.gloss } },
     { label: "Unknown", value: c.unknown, tone: "muted", pctBase: c.reviewed, pctSuffix: "of classified",
       info: { term: GLOSSARY.unknown.label, gloss: GLOSSARY.unknown.gloss } },
   ];
   const companyVerdictMax = Math.max(1, c.include, c.exclude, c.unknown);
 
   // ── Jobs: sequential stages scaled to Ever seen ────────────────────────────
   const jobStageMax = Math.max(1, j.ever_seen);
   const jobStages: RowSpec[] = [
     { label: "Jobs ever seen", value: j.ever_seen, tone: "stage" },
-    { label: "Open now", value: j.open, tone: "stage", pctBase: j.ever_seen, pctSuffix: "of ever seen" },
+    { label: "In discovery", value: j.open, tone: "stage", pctBase: j.ever_seen, pctSuffix: "of ever seen" },
     { label: "Reviewed", value: j.reviewed, tone: "stage", pctBase: j.open, pctSuffix: "of open" },
   ];
   const jobOutcomes: RowSpec[] = [
     { label: "Gate-rejected", value: j.gate_rejected, tone: "amber", pctBase: j.reviewed, pctSuffix: "of reviewed",
       info: { term: GLOSSARY["gate-rejected"].label, gloss: GLOSSARY["gate-rejected"].gloss } },
     { label: "Approved", value: j.approved, tone: "good", pctBase: j.reviewed, pctSuffix: "of reviewed",
       info: { term: GLOSSARY.approved.label, gloss: GLOSSARY.approved.gloss } },
     { label: "Denied", value: j.denied, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
       info: { term: GLOSSARY.denied.label, gloss: GLOSSARY.denied.gloss } },
     { label: "Manually rejected", value: j.manual_rejected, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
       info: { term: GLOSSARY["manual-reject"].label, gloss: GLOSSARY["manual-reject"].gloss } },
     { label: "Errors", value: j.errors, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
       info: { term: GLOSSARY.errors.label, gloss: GLOSSARY.errors.gloss } },
   ];
   const jobOutcomeMax = Math.max(1, j.gate_rejected, j.approved, j.denied, j.manual_rejected, j.errors);
 
   return (
     <div>
       <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: "-6px 0 12px" }}>
-        Current snapshot — job rows count open jobs only; bars within a group share a scale, and the % text is the honest figure.
+        Current discovery and review pool. Applied totals include retained history beyond discovery expiry. Bars within a group share a scale.
       </div>
       <div
         style={{
           display: "flex", gap: "32px", flexWrap: "wrap",
           background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px",
         }}
       >
         <Panel title="Companies — Company Discovery">
           <SubHead>Pipeline stages</SubHead>
           {companyStages.map((s) => <Row key={s.label} spec={s} barMax={companyStageMax} />)}
diff --git a/dashboard/components/analytics/KpiStrip.tsx b/dashboard/components/analytics/KpiStrip.tsx
index ffb843c..374b762 100644
--- a/dashboard/components/analytics/KpiStrip.tsx
+++ b/dashboard/components/analytics/KpiStrip.tsx
@@ -131,23 +131,23 @@ export function KpiStrip({ snapshot, series, nowIso }: { snapshot: PipelineSnaps
   const newJobsPriorSpike = priorSpikeDay(series.jobDiscovery, "new_jobs", endMs, 13, 6);
   const approved7 = sumWindow(series.review, "approved", endMs, 6, -1);
   const approvedPrior7 = sumWindow(series.review, "approved", endMs, 13, 6);
   const approvedPriorSpike = priorSpikeDay(series.review, "approved", endMs, 13, 6);
 
   return (
     <div id="overview" className="rf-analytics-overview">
       <div className="rf-analytics-kpi-grid">
         <Tile
           value={j.open}
-          label="Open jobs"
-          gloss="Jobs currently open across every tracked company — the live pool the reviewer works through."
-          glossTerm="Open jobs"
+          label="Discovery jobs"
+          gloss="Jobs in the default discovery pool. Source availability may be open or unknown; discovery expiry does not mean employer closure."
+          glossTerm="Discovery jobs"
           delta={<Delta current={newJobs7} prior={newJobsPrior7} noun="found this week" spikeDay={newJobsPriorSpike} />}
         />
         <Tile
           value={j.unreviewed}
           label="Awaiting review"
           gloss={GLOSSARY.unreviewed.gloss}
           glossTerm={GLOSSARY.unreviewed.label}
         />
         <Tile
           value={j.approved}
diff --git a/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx b/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
index 9f63f43..d09878d 100644
--- a/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
+++ b/dashboard/components/analytics/SecondarySurfaceFixes.test.tsx
@@ -104,10 +104,18 @@ describe("analytics content width", () => {
   });
 
   // The only consumer of --wide is the analytics dashboard; if it drops the modifier the width
   // fix above becomes dead CSS. Mirrors adminWrap's "all three admin tabs carry the wrap".
   test("the analytics dashboard carries the --wide wrap", () => {
     expect(readFileSync("components/analytics/PipelineDashboard.tsx", "utf8")).toContain(
       "rf-secondary-wrap--wide",
     );
   });
 });
+
+test('discovery totals do not claim employer openness and distinguish retained applied history', async () => {
+  const {FunnelSection}=await import('./FunnelSection');
+  const funnel={companies:{tracked:1,active:1,discovery_sourced:1,reviewed:1,include:1,exclude:0,unknown:0,backlog:0},jobs:{ever_seen:4,open:2,closed:1,reviewed:2,gate_rejected:0,approved:1,applied:3,denied:0,manual_rejected:0,unreviewed:0,errors:0}};
+  render(<FunnelSection funnel={funnel}/>);
+  expect(screen.getByText('In discovery')).toBeTruthy();
+  expect(screen.getByText(/Applied totals include retained history/)).toBeTruthy();
+});
diff --git a/dashboard/components/rolefit/JobCard.tsx b/dashboard/components/rolefit/JobCard.tsx
index 1befe8f..0622824 100644
--- a/dashboard/components/rolefit/JobCard.tsx
+++ b/dashboard/components/rolefit/JobCard.tsx
@@ -1,12 +1,13 @@
 "use client";
 import React from "react";
+import { lifecycleLabels } from "@/lib/jobLifecycleState";
 import type { JobRow } from "@/lib/types";
 import { fitColor, initialsOf, fmtPay } from "@/lib/rolefit/fit";
 import { displayEnumLabel } from "@/lib/rolefit/taxonomy";
 import { Chip } from "@/components/ui/Chip";
 import { Button } from "@/components/ui/Button";
 
 // Palette from the reference design's getBaseJobs() logoBg array
 const LOGO_COLORS = [
   "var(--logo-1)", "var(--logo-2)", "var(--logo-3)", "var(--logo-4)", "var(--logo-5)",
   "var(--logo-6)", "var(--logo-7)", "var(--logo-8)", "var(--logo-9)", "var(--logo-10)",
@@ -22,23 +23,24 @@ function logoColor(name: string): string {
 export interface JobCardProps {
   job: JobRow;
   selected: boolean;
   onSelect: (id: string) => void;
   // Hover/focus-revealed "Reject" pill on the card (#14, redesigned 2026-07-17: labeled
   // pill in a slot the chips row reserves - see board.css). Absent -> not rendered.
   onReject?: (id: string) => void;
   // Live population: TRUE for ~2.6s after this row streamed in mid-review — plays the
   // pop-in + arrival-glow entrance (app/globals.css .rf-job-card--new).
   isNew?: boolean;
+  nowIso?: string;
 }
 
-export const JobCard = React.memo(function JobCard({ job, selected, onSelect, onReject, isNew }: JobCardProps) {
+export const JobCard = React.memo(function JobCard({ job, selected, onSelect, onReject, isNew, nowIso }: JobCardProps) {
   // A null fit_score means "not yet reviewed" — same gate JobDetail uses (`hasReview`).
   // fitColor(0) bottoms out at the red end of its red→green scale, so an unscored card
   // would read as a misleading RED. Instead give it the SAME neutral-grey treatment as
   // JobDetail's "Not yet reviewed" card (var(--bg-muted) fill / var(--border) edge /
   // var(--text-secondary) text); scored cards keep the fitColor tint exactly as before.
   const hasReview = job.fit_score != null;
   const c = fitColor(job.fit_score ?? 0);
   const initials = initialsOf(job.company_name);
   const payLabel = fmtPay(job);
   // "unknown" is a real taxonomy value (lib/rolefit/taxonomy.ts) — displayEnumLabel hides
@@ -95,20 +97,21 @@ export const JobCard = React.memo(function JobCard({ job, selected, onSelect, on
             >
               {job.fit_score ?? "—"}
             </div>
           </div>
           <div
             className="rf-job-card__meta"
           >
             {companyLine}
           </div>
           <div className="rf-job-card__chips">
+            {lifecycleLabels(job.lifecycle,nowIso ?? new Date().toISOString()).map(label => <Chip key={label}>{label}</Chip>)}
             {payLabel && <Chip>{payLabel}</Chip>}
             {remoteLabel && <Chip>{remoteLabel}</Chip>}
             {job.role_category && <Chip>{job.role_category}</Chip>}
           </div>
         </div>
       </button>
       {onReject && (
         <Button
           variant="secondary"
           size="sm"
diff --git a/dashboard/components/rolefit/JobDetail.tsx b/dashboard/components/rolefit/JobDetail.tsx
index 51f22b1..e371d21 100644
--- a/dashboard/components/rolefit/JobDetail.tsx
+++ b/dashboard/components/rolefit/JobDetail.tsx
@@ -1,11 +1,12 @@
 "use client";
+import { lifecycleLabels } from "@/lib/jobLifecycleState";
 
 import { useState } from "react";
 import type { ApplicationPackage, JobReviewDetail, JobRow } from "@/lib/types";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 import type { CorrectionForm } from "@/lib/rolefit/correction";
 import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import type { PrepareLegStatus } from "./RolefitBoard";
 import { fitColor, initialsOf, fmtPay, fmtPosted } from "@/lib/rolefit/fit";
 import { displayEnumLabel } from "@/lib/rolefit/taxonomy";
@@ -168,21 +169,21 @@ export function JobDetail({
   const initials = initialsOf(job.company_name);
   const payLabel = fmtPay(job);
   const rawArrangement = job.work_arrangement;
   // displayEnumLabel hides the literal "unknown" taxonomy value and Title-Cases the rest,
   // matching JobCard (and the seniority pill below) so the treatments can't drift.
   const arrangement = displayEnumLabel(rawArrangement);
   const seniorityLabel = displayEnumLabel(job.seniority);
   const metaLine = [job.company_name, job.location, arrangement]
     .filter(Boolean)
     .join(" · ");
-  const postedText = "Posted " + fmtPosted(job.first_seen_at, nowIso);
+  const postedText = "Discovered " + fmtPosted(job.first_seen_at, nowIso);
 
   // Per-job gen state
   const genState = gen[job.id];
   const gd = genData[job.id];
   const genErrorMsg = genError[job.id];
   const copyLabel = copiedId === job.id ? "Copied!" : "Copy text";
 
   // Per-job cover-letter state
   const coverState = coverGen[job.id];
   const coverGd = coverData[job.id];
@@ -317,20 +318,21 @@ export function JobDetail({
                 display: "inline-flex",
                 alignItems: "center",
                 fontSize: "11.5px",
                 fontWeight: 700,
                 color: "var(--text-secondary)",
                 borderRadius: "7px",
                 padding: "4px 2px",
               }}
             >
               {postedText}
+              {lifecycleLabels(job.lifecycle,nowIso).map(label => <span key={label}> · {label}</span>)}
             </span>
           </div>
         </div>
 
         {/* Fit ring — only when reviewed */}
         {hasReview && (
           <div
             style={{
               flex: "0 0 auto",
               position: "relative",
@@ -681,21 +683,21 @@ export function JobDetail({
             status={pkg?.status ?? null}
             appliedAt={pkg?.appliedAt ?? null}
           />
 
         </>
       )}
 
       {(pkg?.prefilledAnswers != null || !hasReview) && currentQuestions && (
         <details style={{marginTop:"20px"}}>
           <summary>Current application questions</summary>
-          {pkg?.prefilledAnswers != null && <p>Saved answers above use the questions captured with your application.</p>}
+          {pkg?.prefilledAnswers != null && <p>{pkg.questionsSnapshot ? "Saved answers above use the questions captured with your application." : "The historical question schema is unavailable. Saved answers are retained without borrowing the current questions."}</p>}
           <ul>{currentQuestions.questions.map((question, index) => <li key={`${index}:${question.label}`}>{question.label}</li>)}</ul>
         </details>
       )}
 
       {/* ── Full job description (collapsible) + Apply fallback — the Apply button here
            renders only for not-yet-reviewed roles (which have no Application panel), so an
            unreviewed role is never a dead end. Reviewed roles apply via the panel's
            "Apply on {provider}" button. ── */}
       {(fullJD || (!hasReview && applyUrl)) && (
         <div
diff --git a/dashboard/components/rolefit/JobList.tsx b/dashboard/components/rolefit/JobList.tsx
index 52608fa..759fa23 100644
--- a/dashboard/components/rolefit/JobList.tsx
+++ b/dashboard/components/rolefit/JobList.tsx
@@ -2,25 +2,26 @@
 
 import { useEffect, useRef, useState } from "react";
 import type { RefObject } from "react";
 import { useVirtualizer } from "@tanstack/react-virtual";
 import type { JobRow } from "@/lib/types";
 import { JobCard } from "./JobCard";
 import { Button, ButtonLink } from "@/components/ui/Button";
 import { EmptyState } from "@/components/ui/SystemStates";
 
 export interface JobListProps {
+  nowIso?: string;
   jobs: JobRow[];
   selectedId: string | null;
   onSelect: (id: string) => void;
   onClearFilters: () => void;
-  view?: "all" | "applied" | "rejected";
+  view?: "all" | "applied" | "rejected" | "history";
   onBackToAll?: () => void;
   // Whether the board's "all" pool has any jobs before search/facet filtering. Lets the
   // empty state distinguish a pipeline with zero roles from a filter that matched none.
   hasUnfilteredJobs: boolean;
   // The active view's pool size BEFORE search/facet filtering (the board's totalInView).
   // For the "all" view this is the untriaged count: 0 with jobs present means every role
   // has been rejected/applied ("all caught up"), which is distinct from filters narrowing.
   viewPoolCount: number;
   // The board's scroll container. When provided the list virtualizes against it; when
   // absent (narrow single-pane layout uses natural page scroll) it renders in full.
@@ -34,28 +35,29 @@ export interface JobListProps {
   // Live population: ids that streamed in within the last ~2.6s — each matching card
   // renders with the arrival entrance (JobCard isNew).
   freshIds?: Set<string>;
 }
 
 // Windowed list: only the cards near the viewport are mounted, so filtering a ~100k-row
 // board stays cheap. The full (filtered) array stays in memory — virtualization is purely
 // a render optimization. Row heights vary slightly (chips wrap), so measureElement refines
 // the estimate as rows mount.
 function VirtualJobList({
-  jobs,
+  nowIso, jobs,
   selectedId,
   onSelect,
   scrollParentRef,
   scrollToId,
   onReject,
   freshIds,
 }: {
+  nowIso?: string;
   jobs: JobRow[];
   selectedId: string | null;
   onSelect: (id: string) => void;
   scrollParentRef: RefObject<HTMLDivElement | null>;
   scrollToId?: string | null;
   onReject?: (id: string) => void;
   freshIds?: Set<string>;
 }) {
   // The scroll element is an ancestor (the board's list pane), whose ref attaches after
   // this child's layout effect — so getScrollElement() is null on the first commit. Force
@@ -104,30 +106,30 @@ function VirtualJobList({
             data-index={vi.index}
             ref={virtualizer.measureElement}
             style={{
               position: "absolute",
               top: 0,
               left: 0,
               width: "100%",
               transform: `translateY(${vi.start}px)`,
             }}
           >
-            <JobCard job={job} selected={job.id === selectedId} onSelect={onSelect} onReject={onReject} isNew={freshIds?.has(job.id) ?? false} />
+            <JobCard nowIso={nowIso} job={job} selected={job.id === selectedId} onSelect={onSelect} onReject={onReject} isNew={freshIds?.has(job.id) ?? false} />
           </div>
         );
       })}
     </div>
   );
 }
 
 export function JobList({
-  jobs,
+  nowIso, jobs,
   selectedId,
   onSelect,
   onClearFilters,
   view = "all",
   onBackToAll,
   hasUnfilteredJobs,
   viewPoolCount,
   scrollParentRef,
   scrollToId,
   onReject,
@@ -141,21 +143,23 @@ export function JobList({
       // with only a "Back to all roles" escape, hides that their filter is the cause.
       if (viewPoolCount > 0) {
         return (
           <EmptyState className="rf-board-empty-state" title="No roles match your filters" description="Try removing one or more filters."
             action={<Button variant="ghost" onClick={onClearFilters}>Clear filters</Button>} />
         );
       }
       // Empty bucket (viewPoolCount === 0): it isn't "filtered out", it's genuinely empty.
       // Say so, and offer a route back to the full board instead of a no-op "Clear filters".
       const msg =
-        view === "applied"
+        view === "history"
+          ? "You have no saved review or application history yet."
+          : view === "applied"
           ? "You haven't marked any roles as applied yet."
           : "You haven't rejected any roles yet.";
       return (
         <EmptyState className="rf-board-empty-state" title={msg}
           action={onBackToAll && <Button variant="ghost" onClick={onBackToAll}>Back to all roles</Button>} />
       );
     }
     if (!hasUnfilteredJobs) {
       return (
         <EmptyState className="rf-board-empty-state" title="Your board is being built"
@@ -172,36 +176,38 @@ export function JobList({
     }
     return (
       <EmptyState className="rf-board-empty-state" title="No roles match your filters" description="Try removing one or more filters."
         action={<Button variant="ghost" onClick={onClearFilters}>Clear filters</Button>} />
     );
   }
 
   if (scrollParentRef) {
     return (
       <VirtualJobList
+        nowIso={nowIso}
         jobs={jobs}
         selectedId={selectedId}
         onSelect={onSelect}
         scrollParentRef={scrollParentRef}
         scrollToId={scrollToId}
         onReject={onReject}
         freshIds={freshIds}
       />
     );
   }
 
   return (
     <div role="list">
       {jobs.map((job) => (
         <div role="listitem" key={job.id}>
           <JobCard
+            nowIso={nowIso}
             job={job}
             selected={job.id === selectedId}
             onSelect={onSelect}
             onReject={onReject}
             isNew={freshIds?.has(job.id) ?? false}
           />
         </div>
       ))}
     </div>
   );
diff --git a/dashboard/components/rolefit/RolefitBoard.test.tsx b/dashboard/components/rolefit/RolefitBoard.test.tsx
index 16e1615..e986d68 100644
--- a/dashboard/components/rolefit/RolefitBoard.test.tsx
+++ b/dashboard/components/rolefit/RolefitBoard.test.tsx
@@ -209,10 +209,36 @@ test("current posting is visible separately from saved review JD and saved packa
   expect(await screen.findByText("Saved review JD")).toBeTruthy();
   fireEvent.click(await screen.findByRole("button", {name:/Application questions/}));
   const answer=await screen.findByText("Saved answer");
   const savedPanel=answer.closest(".rf-generation-panel");
   if (!(savedPanel instanceof HTMLElement)) throw new Error("saved answer panel missing");
   expect(within(savedPanel).queryByText("Current Q")).toBeNull();
   expect(await screen.findByText("Saved application JD")).toBeTruthy();
   expect(await screen.findByText("Current application questions")).toBeTruthy();
   expect(await screen.findByText("Current Q")).toBeTruthy();
 });
+
+test('discovery hides expired rows until older-live opt-in, and labels availability separately', async () => {
+  stubMatchMedia(); window.history.replaceState({},'', '/');
+  vi.spyOn(window,'matchMedia').mockImplementation(query => ({matches:true,media:query,onchange:null,addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>false,addListener:()=>{},removeListener:()=>{}}));
+  mockFetch({status:200,body:{}});
+  render(<RolefitBoard {...baseProps} isAuthed={false} jobs={[{...job,lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'open',discoveryAnchorAt:'2026-06-01T00:00:00.000Z',discoveryExpiresAt:'2026-07-01T00:00:00.000Z',payloadAvailability:'retired'}}]} />);
+  expect(screen.queryByText('Staff Engineer')).toBeNull();
+  fireEvent.click(screen.getByRole('checkbox',{name:'Include older live jobs'}));
+  expect(await screen.findByText('Staff Engineer')).toBeTruthy();
+  expect(screen.getByText('Discovery expired')).toBeTruthy();
+  expect(screen.getByText('Source open')).toBeTruthy();
+});
+
+test('history retains a closed saved job independently of discovery and its totals', async () => {
+  stubMatchMedia(); window.history.replaceState({},'', '/');
+  vi.spyOn(window,'matchMedia').mockImplementation(query => ({matches:true,media:query,onchange:null,addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>false,addListener:()=>{},removeListener:()=>{}}));
+  mockFetch({status:200,body:{}});
+  const saved={...job,id:'saved',title:'Saved Role',closed_at:'2026-07-01T00:00:00Z',lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'closed' as const,discoveryAnchorAt:'2026-06-01T00:00:00.000Z',discoveryExpiresAt:'2026-07-01T00:00:00.000Z',payloadAvailability:'retired' as const}};
+  render(<RolefitBoard {...baseProps} initialHistory={[saved]} />);
+  expect(screen.queryByText('Saved Role')).toBeNull();
+  fireEvent.click(screen.getByRole('button',{name:'History'}));
+  expect(await screen.findByText('Saved Role')).toBeTruthy();
+  expect(screen.getByText('Source closed')).toBeTruthy();
+  fireEvent.click(screen.getByRole('button',{name:/Saved Role/}));
+  expect(await screen.findByRole('heading',{name:'Saved Role',level:1})).toBeTruthy();
+});
diff --git a/dashboard/components/rolefit/RolefitBoard.tsx b/dashboard/components/rolefit/RolefitBoard.tsx
index 2e44fc9..b88c56a 100644
--- a/dashboard/components/rolefit/RolefitBoard.tsx
+++ b/dashboard/components/rolefit/RolefitBoard.tsx
@@ -1,13 +1,14 @@
 "use client";
+import { discoveryVisible } from "@/lib/jobLifecycleState";
 
-import { jobPayloadNotice, currentJobDetail } from "@/lib/jobPayloadNotice";
+import { jobPayloadNotice, currentJobDetail, parseJobDetailResponse } from "@/lib/jobPayloadNotice";
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
@@ -25,21 +26,21 @@ import {
 } from "@/lib/generationJobCodec";
 import { UpsellNotice } from "./UpsellNotice";
 import { Header } from "./Header";
 import { FilterBar } from "./FilterBar";
 import { JobList } from "./JobList";
 import { JobDetail } from "./JobDetail";
 import { ProfileModal } from "./ProfileModal";
 import { composeResumeText, legacyCopy } from "./ResumePanel";
 import { DetailErrorBoundary } from "./DetailErrorBoundary";
 import { saveGenerationInstructions } from "@/app/actions/generationInstructions";
-import { Button } from "@/components/ui/Button";
+import { Button, ButtonLink } from "@/components/ui/Button";
 import { Icon } from "@/components/ui/Icon";
 
 // The lazy /api/jobs/[id] payload: the heavy review detail PLUS the opened job's Greenhouse
 // question schema (authed-only; null for anon or a non-Greenhouse job). Questions moved off
 // the eager board load onto this fetch — the client only ever reads the ONE open job's schema.
 type JobDetailResponse = JobReviewDetail & { questions: GreenhouseQuestions | null } & ReturnType<typeof currentJobDetail>;
 
 type DetailState =
   | { status: "loading" }
   | { status: "error" }
@@ -52,20 +53,25 @@ export interface PrepareLegStatus {
   resume: LegStatus;
   coverLetter: LegStatus;
   answers: LegStatus;
 }
 
 // Stable empty fallback so a provider-less render (isolated tests) doesn't churn memos.
 const NO_PENDING: GenerationJobView[] = [];
 
 export interface RolefitBoardProps {
   jobs: JobRow[];
+  initialHistory?: JobRow[];
+  discoveryTotal?: number;
+  historyTotal?: number;
+  discoveryPage?: number;
+  historyPage?: number;
   nowIso: string;
   isAuthed: boolean;
   initialFilters: BoardFilterState;
   saveResume: (fd: FormData) => Promise<void>;
   rejectJob: (jobId: string) => Promise<void>;
   unrejectJob: (jobId: string, priorVerdict: string | null) => Promise<void>;
   markApplied: (jobId: string) => Promise<void>;
   unmarkApplied: (jobId: string) => Promise<void>;
   operator?: OperatorSignals;
   hasProfile: boolean;
@@ -78,24 +84,22 @@ export interface RolefitBoardProps {
   // was generated from an older résumé/instructions and is flagged stale. null for
   // anon or a profile-less viewer (never stale).
   currentProfileVersion: string | null;
   // Saved application packages (Phase 3) — the board seeds résumé/cover-letter +
   // Greenhouse Q/A state from these so reopening a role loads instead of regenerating.
   initialPackages: ApplicationPackage[];
   // The operator's server-loaded rejects (verdict='deny' + human_override). The default
   // board loads only approves, so these seed the Rejected view for cross-session recovery
   // of a mis-clicked reject. Empty on the anon path.
   initialRejected: JobRow[];
-  // ISR anon board (/board): the page is edge-cached identically for every anonymous
-  // visitor, so the per-visitor board_filters cookie (httpOnly — unreadable from JS)
-  // cannot influence the server render. When set, the saved filters are fetched from
-  // GET /api/board-filters after mount instead.
+  // Public board can hydrate the anonymous viewer's existing saved client filters
+  // from the cookie API; discovery navigation remains query-string controlled.
   hydrateFiltersFromApi?: boolean;
 }
 
 const NARROW_QUERY = "(max-width: 760px)";
 
 function subscribeNarrow(onChange: () => void) {
   const mq = window.matchMedia(NARROW_QUERY);
   mq.addEventListener("change", onChange);
   return () => mq.removeEventListener("change", onChange);
 }
@@ -135,20 +139,22 @@ function emptyPreparedPackage(jobId: string, preparedAt: string): ApplicationPac
     resumeInstructionsDraft: null,
     coverLetterInstructionsDraft: null,
     coverLetterEditedText: null,
     preparedAt,
     appliedAt: null,
   };
 }
 
 export function RolefitBoard({
   jobs,
+  initialHistory = [],
+  discoveryTotal, historyTotal, discoveryPage = 0, historyPage = 0,
   nowIso,
   isAuthed,
   initialFilters,
   saveResume,
   rejectJob,
   unrejectJob,
   markApplied,
   unmarkApplied,
   operator,
   hasProfile,
@@ -156,20 +162,21 @@ export function RolefitBoard({
   isAdmin,
   resumeText,
   currentProfileVersion,
   initialPackages,
   initialRejected,
   hydrateFiltersFromApi = false,
 }: RolefitBoardProps) {
   const isNarrow = useIsNarrow();
   const router = useRouter();
   // Filter state — seeded from persisted filters (cookie/DB) resolved on the server.
+  const [includeOlderLive, setIncludeOlderLive] = useState(initialFilters.includeOlderLive === true);
   const [search, setSearch] = useState(initialFilters.search);
   const deferredSearch = useDeferredValue(search);
   const [cats, setCats] = useState<string[]>(initialFilters.cats);
   const [locs, setLocs] = useState<string[]>(initialFilters.locs);
   const [sources, setSources] = useState<string[]>(initialFilters.sources);
   const [industries, setIndustries] = useState<string[]>(initialFilters.industries);
   const [sizes, setSizes] = useState<string[]>(initialFilters.sizes);
   const [countries, setCountries] = useState<string[]>(initialFilters.countries);
   const [remote, setRemote] = useState<BoardFilterState["remote"]>(initialFilters.remote);
   const [minFit, setMinFit] = useState(initialFilters.minFit);
@@ -177,21 +184,21 @@ export function RolefitBoard({
   const [payMax, setPayMax] = useState<BoardFilterState["payMax"]>(initialFilters.payMax);
   const [payIncludeUndisclosed, setPayIncludeUndisclosed] = useState(initialFilters.payIncludeUndisclosed);
   const deferredPayMin = useDeferredValue(payMin);
   const deferredPayMax = useDeferredValue(payMax);
   const [sort, setSort] = useState<BoardFilterState["sort"]>(initialFilters.sort);
 
   // UI state
   const [openMenu, setOpenMenu] = useState<string | null>(null);
   const [selectedId, setSelectedId] = useState<string | null>(null);
   const [profileOpen, setProfileOpen] = useState(false);
-  const [view, setView] = useState<"all" | "applied" | "rejected">("all");
+  const [view, setView] = useState<"all" | "applied" | "rejected" | "history">("all");
   // True while the inline ReviewPanel correction editor is open with in-progress edits.
   // Lifted here (mirroring profileOpen) and fed to the keydown guard so the global j/k/
   // Arrow/Esc nav can't remount/unmount the detail pane — and silently discard the
   // unsaved correction — out from under the editor. ReviewPanel signals it.
   const [correctionEditing, setCorrectionEditing] = useState(false);
 
   // Manual-rejection state: hidden ids + the pending Undo toast. Seeded from the server's
   // rejected jobs (prior-session rejects) so the Rejected view survives a reload; live
   // rejects add to it and un-rejects remove from it.
   const [rejectedIds, setRejectedIds] = useState<Set<string>>(
@@ -452,22 +459,22 @@ export function RolefitBoard({
     const handler = (e: MouseEvent) => {
       if (!(e.target as Element).closest("[data-menuroot]")) {
         setOpenMenu((prev) => (prev !== null ? null : prev));
       }
     };
     document.addEventListener("click", handler);
     return () => document.removeEventListener("click", handler);
   }, []);
 
   const filterState: BoardFilterState = useMemo(
-    () => ({ search: deferredSearch, cats, locs, sources, industries, sizes, countries, remote, minFit, payMin: deferredPayMin, payMax: deferredPayMax, payIncludeUndisclosed, sort }),
-    [deferredSearch, cats, locs, sources, industries, sizes, countries, remote, minFit, deferredPayMin, deferredPayMax, payIncludeUndisclosed, sort],
+    () => ({ includeOlderLive, search: deferredSearch, cats, locs, sources, industries, sizes, countries, remote, minFit, payMin: deferredPayMin, payMax: deferredPayMax, payIncludeUndisclosed, sort }),
+    [includeOlderLive, deferredSearch, cats, locs, sources, industries, sizes, countries, remote, minFit, deferredPayMin, deferredPayMax, payIncludeUndisclosed, sort],
   );
 
   // Persist filter changes (debounced) so they survive navigation/visits.
   // Skips the initial mount so the just-loaded initialFilters aren't re-saved.
   // Best-effort: failures are swallowed and never block filtering.
   const firstFilterSave = useRef(true);
   const lastSavedRef = useRef<string | null>(null);
   useEffect(() => {
     if (firstFilterSave.current) {
       firstFilterSave.current = false;
@@ -491,24 +498,22 @@ export function RolefitBoard({
   useEffect(() => {
     const handlePageHide = () => {
       const serialized = JSON.stringify(filterState);
       if (serialized === lastSavedRef.current) return;
       navigator.sendBeacon("/api/board-filters", serialized);
     };
     window.addEventListener("pagehide", handlePageHide);
     return () => window.removeEventListener("pagehide", handlePageHide);
   }, [filterState]);
 
-  // ISR anon board: pull the visitor's saved filters (httpOnly cookie, server-read)
-  // after mount, since the edge-cached render couldn't. lastSavedRef is pre-seeded
-  // with the fetched state — SAME literal shape/key order as the filterState memo —
-  // so applying it doesn't echo a no-op save back through the persistence effect.
+  // Pull the anonymous visitor's saved client filters without allowing a cookie
+  // to activate older-live discovery. The server resolves that explicit URL choice.
   useEffect(() => {
     if (!hydrateFiltersFromApi) return;
     let cancelled = false;
     void fetch("/api/board-filters", { credentials: "same-origin" })
       .then((r) => (r.ok ? r.json() : null))
       .then((raw: unknown) => {
         if (cancelled || raw == null) return;
         const f = parseBoardFilters(raw);
         lastSavedRef.current = JSON.stringify({
           search: f.search, cats: f.cats, locs: f.locs, sources: f.sources,
@@ -524,24 +529,24 @@ export function RolefitBoard({
       .catch(() => {});
     return () => { cancelled = true; };
   }, [hydrateFiltersFromApi]);
 
   // Deep-linkable selection + view. Seed from the query string once on mount (read from
   // window rather than a useState initializer so SSR and the client agree), then mirror
   // selectedId + view back into the URL via replaceState (no navigation, no history spam).
   useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const v = params.get("view");
-    if (v === "applied" || v === "rejected") setView(v);
+    if (v === "applied" || v === "rejected" || (v === "history" && isAuthed)) setView(v);
     const job = params.get("job");
     if (job) setSelectedId(job);
-  }, []);
+  }, [isAuthed]);
   // The completion toast's "View" action (GenerationToastProvider): claim the event
   // (preventDefault) and select the job in place — unclaimed events make the provider
   // fall back to a /?job= router push, which the mount-time seed above resolves.
   useEffect(() => {
     const onOpen = (e: Event) => {
       const detail = (e as CustomEvent<{ jobId?: unknown }>).detail;
       const jobId = typeof detail?.jobId === "string" ? detail.jobId : null;
       if (!jobId) return;
       e.preventDefault();
       setSelectedId(jobId);
@@ -570,45 +575,52 @@ export function RolefitBoard({
     );
   }, [selectedId, view]);
 
   // The board's working list: server rows plus live-streamed arrivals not yet in props.
   const boardJobs = useMemo(() => {
     const ids = new Set(jobs.map((j) => j.id));
     const extras = Object.values(liveMatches).filter((m) => !ids.has(m.id));
     return extras.length ? [...jobs, ...extras] : jobs;
   }, [jobs, liveMatches]);
 
+  const discoveryJobs = useMemo(() => boardJobs.filter(j =>
+    (j.lifecycle && (j.lifecycle.feedEnabled || j.lifecycle.sourceEnabled)
+      ? discoveryVisible(j.lifecycle,includeOlderLive,nowIso)
+      : !j.closed_at && discoveryVisible(j.lifecycle,includeOlderLive,nowIso))), [boardJobs,includeOlderLive,nowIso]);
+  const historyJobs = useMemo(() => mergeRejectedPool(initialHistory,boardJobs.filter(j =>
+    j.verdict === "approve" || j.corrected || packages[j.id] != null)), [initialHistory,boardJobs,packages]);
   const appliedSet = useMemo(
-    () => new Set(boardJobs.filter((j) => packages[j.id]?.status === "applied").map((j) => j.id)),
-    [boardJobs, packages],
+    () => new Set(historyJobs.filter((j) => packages[j.id]?.status === "applied").map((j) => j.id)),
+    [historyJobs, packages],
   );
 
   // Facet counts scan every job; memoize on `boardJobs` so they aren't recomputed on every
   // keystroke/render (FilterBar used to recompute them internally each render).
-  const facets = useMemo(() => facetCounts(boardJobs), [boardJobs]);
+  const activePool = view === "history" || view === "applied" ? historyJobs : discoveryJobs;
+  const facets = useMemo(() => facetCounts(activePool), [activePool]);
 
   // The Rejected view draws from the approve list plus the server rejects (the latter
   // aren't in `boardJobs`); every other view draws from `boardJobs` alone so server rejects
   // can't leak into "all"/"applied".
   const rejectedPool = useMemo(
     () => mergeRejectedPool(boardJobs, initialRejected),
     [boardJobs, initialRejected],
   );
 
   const visible = useMemo(
     () => filterByView(
-      sortJobs(applyFilters(view === "rejected" ? rejectedPool : boardJobs, filterState), filterState.sort),
+      sortJobs(applyFilters(view === "rejected" ? rejectedPool : activePool, filterState), filterState.sort),
       view,
       rejectedIds,
       appliedSet,
     ),
-    [boardJobs, rejectedPool, filterState, rejectedIds, appliedSet, view],
+    [activePool, rejectedPool, filterState, rejectedIds, appliedSet, view],
   );
 
   // Visible ids in render order — the input to selectionAfterRemoval so reject/apply can
   // auto-advance to the next card instead of dumping to the placeholder (#2).
   const visibleIds = useMemo(() => visible.map((j) => j.id), [visible]);
 
   // Board keyboard nav — navigation + search only, no action keys (#3). `/` focuses the
   // search input; j/↓ and k/↑ step the selection (which JobList scrolls into view via
   // scrollToId, #5); Esc clears it. Inert while typing or when the profile modal / a
   // filter menu is open. Declared after `visibleIds` so the deps read the current list.
@@ -652,59 +664,60 @@ export function RolefitBoard({
       }
     }
     document.addEventListener("keydown", onKey);
     return () => document.removeEventListener("keydown", onKey);
   }, [visibleIds, profileOpen, openMenu, correctionEditing]);
 
   // The active view's pool size BEFORE search/facet filtering — same view partition as
   // `visible`, minus `applyFilters`. This is the "N of M" counter's denominator so the
   // Rejected/Applied views read against their own totals, not the all-jobs total (#13).
   const totalInView = useMemo(
-    () => filterByView(view === "rejected" ? rejectedPool : boardJobs, view, rejectedIds, appliedSet).length,
-    [boardJobs, rejectedPool, view, rejectedIds, appliedSet],
+    () => filterByView(view === "rejected" ? rejectedPool : activePool, view, rejectedIds, appliedSet).length,
+    [activePool, rejectedPool, view, rejectedIds, appliedSet],
   );
 
   // Display-only overlay of `corrections` on top of the filtered/sorted/bucketed
   // `visible` rows — a corrected job keeps its current position until reload (same
   // tradeoff as rejectedIds); this only refreshes what the card renders.
   const visibleWithCorrections = useMemo(
     () => visible.map((j) => (corrections[j.id] ? { ...j, ...corrections[j.id] } : j)),
     [visible, corrections],
   );
 
   // Resolve selected job from the rejected pool (a superset of `jobs`) so opening a
   // server-sourced rejected job — which isn't in the approve list — still renders its
   // detail pane, and with it the un-reject action.
   const selectedJob = useMemo(
-    () => rejectedPool.find((j) => j.id === selectedId) ?? null,
-    [rejectedPool, selectedId],
+    () => rejectedPool.find((j) => j.id === selectedId) ?? historyJobs.find((j) => j.id === selectedId) ?? null,
+    [rejectedPool, historyJobs, selectedId],
   );
 
   // Heavy, detail-only review fields (reasoning/about/requirements/benefits/
   // red_flags) are not in the list payload — fetch them on job-open and cache by
   // id. JobDetail renders them as they arrive (its sections are already guarded
   // for absent fields), so the lightweight detail view shows instantly.
   const [details, setDetails] = useState<Record<string, DetailState>>({});
   // Ids with an in-flight /api/jobs/[id] request. This — not the effect's cleanup — is
   // how we dedup: the previous version put `details` in the effect deps AND set the
   // loading state inside it, so writing "loading" re-ran the effect, whose cleanup set
   // `cancelled=true` and dropped the still-in-flight result (detail stuck on the skeleton
   // forever). The ref lets the effect depend on `selectedId` alone.
   const detailInFlightRef = useRef<Set<string>>(new Set());
   const loadDetail = useCallback((id: string) => {
     if (detailInFlightRef.current.has(id)) return;
     detailInFlightRef.current.add(id);
     setDetails((prev) => ({ ...prev, [id]: { status: "loading" } }));
     fetch(`/api/jobs/${id}`)
       .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
-      .then((d: JobDetailResponse) => {
-        setDetails((prev) => ({ ...prev, [id]: { status: "done", detail: {...d, ...currentJobDetail(d)} } }));
+      .then((raw: unknown) => {
+        const detail=parseJobDetailResponse(raw);
+        setDetails((prev) => ({ ...prev, [id]: { status: "done", detail } }));
       })
       .catch((e) => {
         console.error("job detail fetch failed", e);
         setDetails((prev) => ({ ...prev, [id]: { status: "error" } }));
       })
       .finally(() => {
         detailInFlightRef.current.delete(id);
       });
   }, []);
   useEffect(() => {
@@ -1383,38 +1396,55 @@ export function RolefitBoard({
         hasProfile={hasProfile}
         operator={operator}
         viewerEmail={viewerEmail}
         isAdmin={isAdmin}
         isNarrow={isNarrow}
         // The header CTA is authed-only now (anon gets Sign in / Sign up anchors),
         // so this only ever opens the modal. (JobDetail's onOpenProfile below was
         // already modal-only.)
         onOpenProfile={() => setProfileOpen(true)}
       />
+      <div className="rf-lifecycle-controls">
+        <label className="rf-lifecycle-older" data-ui-contract-composite="Native labelled checkbox controls explicit older-live navigation"><input type="checkbox" checked={includeOlderLive} onChange={event => {
+          const enabled=event.target.checked; setIncludeOlderLive(enabled);
+          const url=new URL(window.location.href);
+          if (enabled) url.searchParams.set("older","1"); else url.searchParams.delete("older");
+          url.searchParams.delete("page"); router.push(url.pathname+url.search);
+        }} /> Include older live jobs</label>
+        {isAuthed && <Button variant="ghost" aria-pressed={view === "history"} onClick={() => setView(view === "history" ? "all" : "history")}>History</Button>}
+        {(() => {
+          const historical=view === "history" || view === "applied";
+          const total=historical ? historyTotal : discoveryTotal;
+          const page=historical ? historyPage : discoveryPage;
+          const param=historical ? "historyPage" : "page";
+          const href=(next:number) => { const params=new URLSearchParams(); if(includeOlderLive) params.set("older","1"); if(historical) params.set("view",view); params.set(param,String(next)); return `?${params}`; };
+          return total !== undefined ? <span>{total} {historical ? "saved jobs" : "discovery jobs"} · Page {page+1} {page>0 && <ButtonLink variant="text-link" href={href(page-1)}>Previous page</ButtonLink>} {(page+1)*500<total && <ButtonLink variant="text-link" href={href(page+1)}>Next page</ButtonLink>}</span> : null;
+        })()}
+      </div>
       <FilterBar
         totalInView={totalInView}
         facets={facets}
         cats={cats}
         locs={locs}
         sources={sources}
         industries={industries}
         sizes={sizes}
         countries={countries}
         remote={remote}
         minFit={minFit}
         payMin={payMin}
         payMax={payMax}
         payIncludeUndisclosed={payIncludeUndisclosed}
         sort={sort}
         openMenu={openMenu}
         visibleCount={visible.length}
-        view={view}
+        view={view === "history" ? "all" : view}
         appliedCount={appliedSet.size}
         rejectedCount={rejectedIds.size}
         onToggleView={setView}
         onToggleMenu={toggleMenu}
         onToggleCat={toggleCat}
         onToggleLoc={toggleLoc}
         onToggleSource={toggleSource}
         onToggleIndustry={toggleIndustry}
         onToggleSize={toggleSize}
         onToggleCountry={toggleCountry}
@@ -1440,20 +1470,21 @@ export function RolefitBoard({
 
       {/* Split pane — left: job list; right: detail */}
       <div className="rf-board-workspace" data-mode={isNarrow ? (selectedId ? "detail" : "list") : "split"}>
         {/* List pane */}
         {(!isNarrow || !selectedId) && (
           <div
             ref={listScrollRef}
             className="rf-board-list-pane rf-scroll"
           >
             <JobList
+              nowIso={nowIso}
               jobs={visibleWithCorrections}
               selectedId={selectedId}
               onSelect={handleSelect}
               onClearFilters={clearFilters}
               view={view}
               onBackToAll={() => setView("all")}
               hasUnfilteredJobs={boardJobs.length > 0}
               viewPoolCount={totalInView}
               freshIds={freshIds}
               scrollParentRef={isNarrow ? undefined : listScrollRef}
diff --git a/dashboard/components/rolefit/board.css b/dashboard/components/rolefit/board.css
index 8399228..a9ee69a 100644
--- a/dashboard/components/rolefit/board.css
+++ b/dashboard/components/rolefit/board.css
@@ -504,10 +504,14 @@
   flex: 1 1 0; min-width: 0; height: 34px; padding: 0 var(--space-2);
   font-size: var(--font-size-caption); color: var(--text-primary);
   background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
 }
 .rf-pay__dash { color: var(--text-secondary); }
 .rf-pay__toggle {
   display: flex; align-items: center; gap: var(--space-2);
   font-size: var(--font-size-caption); color: var(--text-primary); cursor: pointer;
 }
 .rf-pay__checkbox { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
+
+.rf-lifecycle-controls { display: flex; flex-wrap: wrap; gap: 16px; padding: 8px 20px; align-items: center; }
+.rf-lifecycle-older { display: inline-flex; gap: 8px; align-items: center; min-height: 44px; cursor: pointer; }
+.rf-lifecycle-older input { accent-color: var(--accent); }
diff --git a/dashboard/lib/analyticsLabels.ts b/dashboard/lib/analyticsLabels.ts
index 5f6ea89..0130a2c 100644
--- a/dashboard/lib/analyticsLabels.ts
+++ b/dashboard/lib/analyticsLabels.ts
@@ -38,21 +38,21 @@ export const GLOSSARY: Record<string, GlossEntry> = {
   unknown: {
     label: "Unknown",
     gloss: "The classifier couldn't confidently decide include or exclude for this company — usually thin or unverifiable public data.",
   },
   "manual-reject": {
     label: "Manually rejected",
     gloss: "A job you rejected by hand, overriding the reviewer's approval. Counts toward denials.",
   },
   unreviewed: {
     label: "Not yet reviewed",
-    gloss: "Open jobs the reviewer hasn't scored yet — the review backlog. Lower means the reviewer is keeping up with new postings.",
+    gloss: "Discovery jobs the reviewer hasn't scored yet — the review backlog. Lower means the reviewer is keeping up with new postings.",
   },
   "inclusion-rate": {
     label: "Inclusion rate",
     gloss: "Share of newly classified companies accepted for tracking. Neither high nor low is inherently better — it reflects how selective the filter is.",
   },
   "approval-rate": {
     label: "Approval rate",
     gloss: "Share of reviewed jobs marked a fit. Naturally low — most postings aren't a match — so a small percentage here is expected.",
   },
   "gate-rate": {
@@ -78,25 +78,25 @@ export const GLOSSARY: Record<string, GlossEntry> = {
   applied: {
     label: "Applied",
     gloss: "Jobs you've submitted an application to. The end of the funnel — higher means more of the approved matches converted to applications.",
   },
   denied: {
     label: "Denied",
     gloss: "Jobs the reviewer scored as not a fit after full review. Expected to dwarf approvals.",
   },
   approved: {
     label: "Approved matches",
-    gloss: "Open jobs the reviewer scored as a genuine fit for your profile — the shortlist worth applying to.",
+    gloss: "Jobs the reviewer scored as a genuine fit for your profile — the shortlist worth applying to.",
   },
   reviewed: {
     label: "Reviewed",
-    gloss: "Open jobs the reviewer has scored for fit. Scope varies by widget — see each section's caption.",
+    gloss: "Jobs the reviewer has scored for fit. Scope varies by widget — see each section's caption.",
   },
   excluded: {
     label: "Excluded",
     gloss: "Companies the classifier decided not to track (wrong industry, non-tech, unverifiable, etc.). High is normal — it keeps the board relevant.",
   },
   included: {
     label: "Included",
     gloss: "Companies accepted for tracking — we poll their ATS for open jobs.",
   },
   errors: {
diff --git a/dashboard/lib/filters.test.ts b/dashboard/lib/filters.test.ts
index a606456..2939a34 100644
--- a/dashboard/lib/filters.test.ts
+++ b/dashboard/lib/filters.test.ts
@@ -1,18 +1,19 @@
 import { describe, expect, test } from "vitest";
 import { serverBoardFilters, parseFilters } from "@/lib/filters";
 
 const D = { include: ["engineer"] };
 
 describe("parseFilters", () => {
   test("empty params → defaults incl. verdict=approve", () => {
     expect(parseFilters({}, D)).toEqual({
+      includeOlderLive: false,
       companies: [],
       include: ["engineer"],
       exclude: [],
       remoteOnly: false,
       status: "open",
       verdict: "approve",
       experience: "",
       industry: "",
       subcategory: "",
       location: "",
diff --git a/dashboard/lib/filters.ts b/dashboard/lib/filters.ts
index a3a76c7..d7b574d 100644
--- a/dashboard/lib/filters.ts
+++ b/dashboard/lib/filters.ts
@@ -2,30 +2,31 @@ import { VERDICT_OPTIONS, PUBLIC_BOARD_INCLUDE_KEYWORDS } from "@/lib/config";
 
 export type Status = "open" | "closed" | "all";
 export type Verdict = (typeof VERDICT_OPTIONS)[number];
 
 export interface Filters {
   companies: number[];
   include: string[];
   exclude: string[];
   remoteOnly: boolean;
   status: Status;
+  includeOlderLive?: boolean;
   verdict: Verdict;
   experience: string;
   industry: string;
   subcategory: string;
   location: string;
 }
 
 const FILTER_KEYS = [
   "company", "include", "exclude", "remote", "status",
-  "verdict", "experience", "industry", "subcategory", "location",
+  "older", "verdict", "experience", "industry", "subcategory", "location",
 ] as const;
 
 function first(v: string | string[] | undefined): string | undefined {
   return Array.isArray(v) ? v[0] : v;
 }
 
 function csv(v: string | undefined): string[] {
   if (!v) return [];
   return v.split(",").map((s) => s.trim()).filter(Boolean);
 }
@@ -43,20 +44,21 @@ export function parseFilters(
     verdictRaw && (VERDICT_OPTIONS as readonly string[]).includes(verdictRaw)
       ? (verdictRaw as Verdict)
       : "approve";
 
   return {
     companies: csv(first(params.company)).map(Number).filter((n) => Number.isInteger(n)),
     include: hasAnyFilter ? csv(first(params.include)) : defaults.include,
     exclude: csv(first(params.exclude)),
     remoteOnly: first(params.remote) === "1",
     status: validStatus,
+    includeOlderLive: first(params.older) === "1",
     verdict,
     experience: first(params.experience) ?? "",
     industry: first(params.industry) ?? "",
     subcategory: first(params.subcategory) ?? "",
     location: first(params.location) ?? "",
   };
 }
 
 // The board's server-side Filters, one object per viewer class. All client filters now
 // apply client-side (app/page.tsx passes {} to parseFilters), so the ONLY server-side
diff --git a/dashboard/lib/jobLifecycle.ts b/dashboard/lib/jobLifecycle.ts
index 711c5f5..a2b5dc6 100644
--- a/dashboard/lib/jobLifecycle.ts
+++ b/dashboard/lib/jobLifecycle.ts
@@ -1,13 +1,16 @@
 import type { TransactionSql } from "postgres";
 import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 
+export {sourceClosedPredicate,parseJobLifecycle,unwrapLifecycleJson,discoveryPredicate,discoveryVisible,lifecycleLabels,parseStringList,parseRequirements} from "./jobLifecycleState";
+export type {JobLifecycle,SqlFragment} from "./jobLifecycleState";
+
 export type LifecycleStage = "legacy" | "collect" | "enforced";
 export function parseLifecycleStage(value: unknown): LifecycleStage | null {
   return value === "legacy" || value === "collect" || value === "enforced" ? value : null;
 }
 
 /** Must be the first lock in a short mutating transaction. No network work here. */
 export async function acquireLifecycleGate(tx: TransactionSql): Promise<void> {
   await tx`SELECT set_config('lock_timeout', '2s', true),
                   set_config('statement_timeout', '5s', true)`;
   await tx`SELECT pg_advisory_xact_lock(20916294442894917)`;
diff --git a/dashboard/lib/jobLifecycleConsumers.db.test.ts b/dashboard/lib/jobLifecycleConsumers.db.test.ts
new file mode 100644
index 0000000..bb4c6b3
--- /dev/null
+++ b/dashboard/lib/jobLifecycleConsumers.db.test.ts
@@ -0,0 +1,100 @@
+/** Owned, offline ordinary consumer coverage; no adversarial mechanism probes. */
+import { readFileSync } from "node:fs";
+import { resolve } from "node:path";
+import postgres from "postgres";
+import { afterAll, beforeAll, expect, test } from "vitest";
+import { buildJobsQuery, buildJobsCountQuery } from "./jobsQuery";
+import { serverBoardFilters } from "./filters";
+import { parseJobLifecycle } from "./jobLifecycle";
+const dsn=process.env.TEST_DATABASE_URL;
+if(!dsn || process.env.LIFECYCLE_REQUIRE_DB_TESTS!=="1") throw new Error("Owned harness required");
+const address=new URL(dsn);
+if(address.hostname!=="127.0.0.1" || !address.port || address.port==="55432" || address.pathname!=="/poller_lifecycle_test") throw new Error("Unsafe test target");
+process.env.DATABASE_URL=dsn;
+const sql=postgres(dsn,{max:1,prepare:false,onnotice:()=>{}});
+const owner="11111111-1111-1111-1111-111111111111";
+let db: typeof import("./db");
+beforeAll(async()=>{
+  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
+  const migration=readFileSync(resolve(process.cwd(),"../migrations/2026-10-07-04-lifecycle-feed.sql"),"utf8");
+  const schema=readFileSync(resolve(process.cwd(),"../schema.sql"),"utf8");
+  expect(schema.endsWith(migration)).toBe(true);
+  await sql.unsafe(schema.slice(0,-migration.length));
+  await sql.unsafe(migration);
+  await sql.unsafe(migration);
+  await sql`INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')`;
+  await sql`INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES
+    ('fresh',1,'fresh','Engineer','https://example.test/fresh','JD'),
+    ('older',1,'older','Engineer','https://example.test/older',NULL),
+    ('unknown',1,'unknown','Engineer','https://example.test/unknown',NULL),
+    ('closed',1,'closed','Engineer','https://example.test/closed',NULL),
+    ('unmapped',1,'unmapped','Engineer','https://example.test/unmapped',NULL)`;
+  const source=await sql`INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id`;
+  await sql`INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
+    discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,source_availability,payload_retired_at)
+    SELECT ${source[0].id},id,id,now()-age,now()-age,'local_observation',now()-age+interval '720 hours',availability,retired
+    FROM (VALUES ('fresh',interval '719 hours','open',NULL::timestamptz),
+                 ('older',interval '721 hours','open',now()),
+                 ('unknown',interval '721 hours','unknown',NULL),
+                 ('closed',interval '1 hour','closed',NULL)) AS fixture(id,age,availability,retired)`;
+  await sql`INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(${owner},'older','v1','approve')`;
+  await sql`INSERT INTO review_corrections(user_id,job_id,verdict) VALUES(${owner},'closed','approve')`;
+  await sql`INSERT INTO application_packages(user_id,job_id,status,applied_at) VALUES(${owner},'unknown','prepared',NULL),(${owner},'unmapped','applied',now())`;
+  db=await import('./db');
+});
+afterAll(async()=>{await db?.serviceSql.end();await sql.end();});
+async function rows(older=false,offset=0,limit=500,history=false) {
+  const f={...serverBoardFilters(history?'authed':'anon'),includeOlderLive:older};
+  const query=buildJobsQuery(f,history?owner:null,[],{limit,offset,historyOnly:history});
+  return history?db.withUserSql(owner,tx=>tx.unsafe(query.text,query.values as never[])):db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
+}
+test('flag-off anonymous legacy path and unmapped fallback stay readable',async()=>{
+  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','older','unknown','unmapped']);
+  expect((await rows()).find(r=>r.id==='unmapped')?.lifecycle).toBeNull();
+});
+test('source/expiry/payload remain independent, count matches concatenated page boundaries',async()=>{
+  await sql`UPDATE lifecycle_control SET feed_enabled=true,source_enabled=true,activation_generation=activation_generation+1`;
+  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','unmapped']);
+  const all=await rows(true);
+  expect(all.map(r=>r.id).sort()).toEqual(['fresh','older','unmapped']);
+  const page1=await rows(true,0,2),page2=await rows(true,2,2);
+  expect([...page1,...page2].map(r=>r.id)).toEqual(all.map(r=>r.id));
+  const query=buildJobsCountQuery({...serverBoardFilters('anon'),includeOlderLive:true},null);
+  const count=await db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
+  expect(count[0].total).toBe(all.length);
+  expect(parseJobLifecycle(all.find(r=>r.id==='older')?.lifecycle)).toMatchObject({sourceAvailability:'open',payloadAvailability:'retired'});
+});
+test('approved/corrected/prepared/applied history is independent of discovery and owner profile gates',async()=>{
+  expect((await rows(false,0,500,true)).map(r=>r.id).sort()).toEqual(['closed','older','unknown','unmapped']);
+  const query=buildJobsCountQuery(serverBoardFilters('authed'),owner,[],{historyOnly:true});
+  const count=await db.withUserSql(owner,tx=>tx.unsafe(query.text,query.values as never[]));
+  expect(count[0].total).toBe(4);
+});
+test('flag rollback changes no frozen dates, retired payload or proven closure',async()=>{
+  const before=await sql`SELECT id,discovery_anchor_at,discovery_expires_at,source_availability,payload_retired_at FROM source_listings ORDER BY id`;
+  await sql`UPDATE lifecycle_control SET feed_enabled=false,source_enabled=false,activation_generation=activation_generation+1`;
+  expect((await rows()).map(r=>r.id).sort()).toEqual(['fresh','older','unknown','unmapped']);
+  const after=await sql`SELECT id,discovery_anchor_at,discovery_expires_at,source_availability,payload_retired_at FROM source_listings ORDER BY id`;
+  expect(after).toEqual(before);
+  expect((await sql`SELECT description FROM jobs WHERE id='older'`)[0].description).toBeNull();
+});
+
+test('actual server paging DTO keeps private history independent of discovery location preferences',async()=>{
+  const {getJobsPage}=await import('./queries');
+  await sql`UPDATE lifecycle_control SET feed_enabled=true,source_enabled=true,activation_generation=activation_generation+1`;
+  const publicPage=await getJobsPage(serverBoardFilters('anon'),null);
+  expect(publicPage.total).toBe(2);
+  expect(publicPage.rows.map(r=>r.id).sort()).toEqual(['fresh','unmapped']);
+  await sql`INSERT INTO profiles(user_id,profile_version,preferred_locations) VALUES(${owner},'v1',ARRAY['Tokyo'])`;
+  const discovery=await getJobsPage(serverBoardFilters('authed'),owner);
+  expect(discovery.total).toBe(0);
+  const history=await getJobsPage(serverBoardFilters('authed'),owner,0,true);
+  expect(history.total).toBe(4);
+  expect(history.rows.map(r=>r.id).sort()).toEqual(['closed','older','unknown','unmapped']);
+});
+
+test('source closed query labels closure without including merely expired jobs',async()=>{
+  const query=buildJobsQuery({...serverBoardFilters('anon'),status:'closed'},null);
+  const result=await db.withAnonSql(tx=>tx.unsafe(query.text,query.values as never[]));
+  expect(result.map(r=>r.id)).toEqual(['closed']);
+});
diff --git a/dashboard/lib/jobLifecycleConsumers.test.ts b/dashboard/lib/jobLifecycleConsumers.test.ts
new file mode 100644
index 0000000..28c0c89
--- /dev/null
+++ b/dashboard/lib/jobLifecycleConsumers.test.ts
@@ -0,0 +1,63 @@
+import { describe, expect, it } from "vitest";
+import { discoveryPredicate, parseJobLifecycle, lifecycleLabels, discoveryVisible } from "./jobLifecycle";
+import { parseBoardFilters } from "./rolefit/boardFilters";
+import { buildJobsQuery, buildJobsCountQuery } from "./jobsQuery";
+import { serverBoardFilters } from "./filters";
+
+const state = { feedEnabled: true, sourceEnabled: true, sourceAvailability: "open",
+  discoveryAnchorAt: "2026-03-01T07:00:00.000Z", discoveryExpiresAt: "2026-03-31T07:00:00.000Z",
+  payloadAvailability: "retired" };
+describe("lifecycle consumers", () => {
+  it("expires at exactly 720 elapsed UTC hours across DST, without implying closure", () => {
+    const lifecycle = parseJobLifecycle(state)!;
+    expect(discoveryVisible(lifecycle, false, "2026-03-31T06:59:59.999Z")).toBe(true);
+    expect(discoveryVisible(lifecycle, false, "2026-03-31T07:00:00.000Z")).toBe(false);
+    expect(discoveryVisible(lifecycle, true, "2026-03-31T07:00:00.000Z")).toBe(true);
+    expect(lifecycleLabels(lifecycle, "2026-03-31T07:00:00.000Z")).toEqual(["Source open", "Discovery expired", "Posting payload retired"]);
+  });
+  it("distinguishes unknown and closed, and only opts into older confirmed live jobs", () => {
+    for (const sourceAvailability of ["unknown", "closed"] as const) {
+      const lifecycle = parseJobLifecycle({...state, sourceAvailability})!;
+      expect(discoveryVisible(lifecycle, true, "2026-03-31T07:00:00.000Z")).toBe(false);
+      expect(lifecycleLabels(lifecycle, "2026-03-31T07:00:00.000Z")[0]).toBe(`Source ${sourceAvailability}`);
+    }
+  });
+  it("parses double encoded JSON and rejects malformed or incoherent boundaries", () => {
+    expect(parseJobLifecycle(JSON.stringify(JSON.stringify(state)))).toEqual(state);
+    for (const raw of [null, [], "{", 4, {...state, discoveryAnchorAt: "bad"}, {...state, sourceAvailability: "expired"}, {...state, discoveryExpiresAt: "2026-03-31T08:00:00Z"}]) expect(parseJobLifecycle(raw)).toBeNull();
+    expect(parseBoardFilters(JSON.stringify(JSON.stringify({includeOlderLive:true})) ).includeOlderLive).toBe(true);
+  });
+  it("rows/count/page boundaries share one predicate and deterministic order", () => {
+    const filters = {...serverBoardFilters("anon"), includeOlderLive:true};
+    const rows = buildJobsQuery(filters, null, [], {limit:2,offset:2});
+    const count = buildJobsCountQuery(filters,null);
+    expect(rows.text).toContain(discoveryPredicate(true).text);
+    expect(count.text).toContain(discoveryPredicate(true).text);
+    expect(rows.text).toContain("j.id ASC");
+    expect(rows.text).toContain("LIMIT 2\nOFFSET 2");
+  });
+  it("history queries require an owner and do not apply discovery or profile filters", () => {
+    expect(() => buildJobsQuery(serverBoardFilters("anon"),null,[],{historyOnly:true})).toThrow();
+    const query = buildJobsQuery(serverBoardFilters("authed"),"owner",[],{historyOnly:true,locationFromProfile:true,companyFiltersFromProfile:true});
+    expect(query.text).toContain("application_packages");
+    expect(query.text).not.toContain("lifecycle_discovery_visible");
+    expect(query.text).not.toContain("preferred_locations");
+    expect(query.text).not.toContain("company_exclusions");
+  });
+});
+
+it('total-parses HTTP detail arrays and lifecycle instead of trusting legacy scalars',async()=>{
+  const {parseJobDetailResponse}=await import('./jobPayloadNotice');
+  const response=parseJobDetailResponse({benefits:'["Health",7]',red_flags:'broken',requirements:JSON.stringify(JSON.stringify([{text:'TypeScript',met:true},{text:4,met:true}])),lifecycle:JSON.stringify(state),questions:'broken',description:'Saved JD'});
+  expect(response).toMatchObject({description:'Saved JD',benefits:['Health'],red_flags:null,requirements:[{text:'TypeScript',met:true}],lifecycle:state,questions:null});
+});
+
+it('closed filter uses proven source closure instead of discovery expiry',()=>{
+  const query=buildJobsQuery({...serverBoardFilters('anon'),status:'closed'},null);
+  expect(query.text).toContain('public.lifecycle_source_closed(j.id, j.closed_at)');
+  expect(query.text).not.toContain('WHERE j.closed_at IS NOT NULL');
+});
+
+it('rejects timezone-free lifecycle dates rather than applying browser local time',()=>{
+  expect(parseJobLifecycle({...state,discoveryAnchorAt:'2026-03-01T07:00:00',discoveryExpiresAt:'2026-03-31T07:00:00'})).toBeNull();
+});
diff --git a/dashboard/lib/jobLifecycleState.ts b/dashboard/lib/jobLifecycleState.ts
new file mode 100644
index 0000000..9293234
--- /dev/null
+++ b/dashboard/lib/jobLifecycleState.ts
@@ -0,0 +1,72 @@
+/** Client-safe lifecycle state: no DB, service credentials or mutation imports. */
+export interface JobLifecycle {
+  feedEnabled: boolean;
+  sourceEnabled: boolean;
+  sourceAvailability: "open" | "unknown" | "closed";
+  discoveryAnchorAt: string;
+  discoveryExpiresAt: string;
+  payloadAvailability: "available" | "missing" | "retired";
+}
+/** Bounded JSON unwrapping tolerates old string-scalar writes; every result is validated. */
+export function unwrapLifecycleJson(raw: unknown): unknown {
+  let value = raw;
+  for (let i = 0; i < 3 && typeof value === "string"; i++) {
+    try { value = JSON.parse(value); } catch { return null; }
+  }
+  return value;
+}
+export function parseJobLifecycle(raw: unknown): JobLifecycle | null {
+  const value = unwrapLifecycleJson(raw);
+  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
+  const row = Object.fromEntries(Object.entries(value));
+  const availability = row.sourceAvailability;
+  const payload = row.payloadAvailability;
+  if (typeof row.feedEnabled !== "boolean" || typeof row.sourceEnabled !== "boolean" ||
+      (availability !== "open" && availability !== "unknown" && availability !== "closed") ||
+      (payload !== "available" && payload !== "missing" && payload !== "retired") ||
+      typeof row.discoveryAnchorAt !== "string" || typeof row.discoveryExpiresAt !== "string") return null;
+  const zonedIso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
+  if (!zonedIso.test(row.discoveryAnchorAt) || !zonedIso.test(row.discoveryExpiresAt)) return null;
+  const anchor = Date.parse(row.discoveryAnchorAt), expires = Date.parse(row.discoveryExpiresAt);
+  if (!Number.isFinite(anchor) || !Number.isFinite(expires) || expires - anchor !== 720 * 3600000) return null;
+  return {feedEnabled:row.feedEnabled,sourceEnabled:row.sourceEnabled,sourceAvailability:availability,
+    discoveryAnchorAt:row.discoveryAnchorAt,discoveryExpiresAt:row.discoveryExpiresAt,payloadAvailability:payload};
+}
+export interface SqlFragment { text: string; values: unknown[] }
+/** SQL owns aggregation over multiple source listings and the persisted flag decision. */
+export function discoveryPredicate(includeOlderLive: boolean): SqlFragment {
+  return {text:`public.lifecycle_discovery_visible(j.id, j.closed_at, ${includeOlderLive ? "true" : "false"})`,values:[]};
+}
+export function discoveryVisible(state: JobLifecycle | null | undefined, includeOlderLive: boolean, nowIso: string): boolean {
+  if (!state) return true; // Unmapped legacy rows retain their existing caller's closed_at gate.
+  if (state.sourceAvailability === "closed") return false;
+  if (!state.feedEnabled) return true;
+  return Date.parse(nowIso) < Date.parse(state.discoveryExpiresAt) || (includeOlderLive && state.sourceAvailability === "open");
+}
+export function lifecycleLabels(state: JobLifecycle | null | undefined, nowIso: string): string[] {
+  if (!state || !(state.feedEnabled || state.sourceEnabled)) return [];
+  const labels = [`Source ${state.sourceAvailability}`];
+  if (state.feedEnabled && Date.parse(nowIso) >= Date.parse(state.discoveryExpiresAt)) labels.push("Discovery expired");
+  if (state.payloadAvailability !== "available") labels.push(state.payloadAvailability === "retired" ? "Posting payload retired" : "Posting payload unavailable");
+  return labels;
+}
+
+export function parseStringList(raw: unknown): string[] | null {
+  const value=unwrapLifecycleJson(raw);
+  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
+}
+export function parseRequirements(raw: unknown): {text:string;met:boolean}[] | null {
+  const value=unwrapLifecycleJson(raw);
+  if (!Array.isArray(value)) return null;
+  const out: {text:string;met:boolean}[]=[];
+  for (const rawItem of value) {
+    if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) continue;
+    const item=Object.fromEntries(Object.entries(rawItem));
+    if (typeof item.text === "string" && typeof item.met === "boolean") out.push({text:item.text,met:item.met});
+  }
+  return out;
+}
+
+export function sourceClosedPredicate(): SqlFragment {
+  return {text:"public.lifecycle_source_closed(j.id, j.closed_at)",values:[]};
+}
diff --git a/dashboard/lib/jobPayloadNotice.ts b/dashboard/lib/jobPayloadNotice.ts
index d094d5a..f2bfd15 100644
--- a/dashboard/lib/jobPayloadNotice.ts
+++ b/dashboard/lib/jobPayloadNotice.ts
@@ -1,10 +1,12 @@
+import {parseJobLifecycle,parseStringList,parseRequirements,unwrapLifecycleJson} from "@/lib/jobLifecycleState";
+import type {JobReviewDetail} from "@/lib/types";
 import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 
 /** A hydration acknowledgement is distinct from a started generation. */
 export function jobPayloadNotice(value:unknown):string|null {
   if(typeof value!=="object" || value===null || !("payload" in value)) return null;
   const payload=value.payload;
   if(typeof payload!=="object" || payload===null || !("status" in payload) ||
     (payload.status!=="pending" && payload.status!=="deferred")) return null;
   return "message" in value && typeof value.message==="string" && value.message.length<=300
     ? value.message : "Job details are being prepared. Try again shortly.";
@@ -13,10 +15,23 @@ export function jobPayloadNotice(value:unknown):string|null {
 /** Total parsing for the new current-versus-saved detail response fields. */
 export function currentJobDetail(value: unknown) {
   const row = typeof value === "object" && value !== null && !Array.isArray(value)
     ? Object.fromEntries(Object.entries(value)) : {};
   return {
     descriptionIsSaved: row.descriptionIsSaved === true,
     currentDescription: typeof row.currentDescription === "string" ? row.currentDescription : null,
     currentQuestions: parseGreenhouseQuestions(row.currentQuestions),
   };
 }
+
+/** Validate the actual HTTP detail boundary before merging it into a board row. */
+export function parseJobDetailResponse(value: unknown): JobReviewDetail & {questions: ReturnType<typeof parseGreenhouseQuestions>} & ReturnType<typeof currentJobDetail> {
+  const decoded=unwrapLifecycleJson(value);
+  const row=decoded && typeof decoded === "object" && !Array.isArray(decoded) ? Object.fromEntries(Object.entries(decoded)) : {};
+  const text=(raw:unknown) => typeof raw === "string" ? raw : null;
+  return {...currentJobDetail(row),lifecycle:parseJobLifecycle(row.lifecycle),
+    reasoning:text(row.reasoning),about:text(row.about),description:text(row.description),url:text(row.url),
+    experience_match:text(row.experience_match),industry:text(row.industry),industry_subcategory:text(row.industry_subcategory),
+    confidence:text(row.confidence),note:text(row.note),corrected:row.corrected === true,
+    benefits:parseStringList(row.benefits),red_flags:parseStringList(row.red_flags),requirements:parseRequirements(row.requirements),
+    questions:parseGreenhouseQuestions(unwrapLifecycleJson(row.questions))};
+}
diff --git a/dashboard/lib/jobsQuery.test.ts b/dashboard/lib/jobsQuery.test.ts
index 87f887e..f2ff42f 100644
--- a/dashboard/lib/jobsQuery.test.ts
+++ b/dashboard/lib/jobsQuery.test.ts
@@ -97,21 +97,21 @@ describe("buildJobsQuery", () => {
   test("verdict=approve + experience applies dimension filter", () => {
     const q = buildJobsQuery({ ...base, verdict: "approve", experience: "reach" }, UID);
     expect(q.text).toContain("COALESCE(rc.experience_match, r.experience_match) = $2");
   });
 
   test("null owner: no review join, columns, error clause, or user binding", () => {
     const q = buildJobsQuery(base, null);
     expect(q.text).not.toContain("job_reviews");
     expect(q.text).not.toContain("r.verdict");
     expect(q.text).not.toContain("r.error IS NULL");
-    expect(q.text).toContain("j.closed_at IS NULL"); // plain status filter still applies
+    expect(q.text).toContain("public.lifecycle_discovery_visible(j.id, j.closed_at, false)"); // persisted flag-aware discovery
     expect(q.values).toEqual([]);
   });
 
   test("null owner: plain filters bind from $1", () => {
     const q = buildJobsQuery({ ...base, companies: [1, 2] }, null);
     expect(q.text).toContain("j.company_id = ANY($1)");
     expect(q.values).toEqual([[1, 2]]);
   });
 
   test("location filter adds an ILIKE clause in the owner branch", () => {
diff --git a/dashboard/lib/jobsQuery.ts b/dashboard/lib/jobsQuery.ts
index dd4d0db..b114e90 100644
--- a/dashboard/lib/jobsQuery.ts
+++ b/dashboard/lib/jobsQuery.ts
@@ -1,28 +1,39 @@
+import { discoveryPredicate, sourceClosedPredicate } from "@/lib/jobLifecycle";
 import type { Filters } from "@/lib/filters";
 
 export interface SqlQuery {
   text: string;
   values: unknown[];
 }
 
 export function buildJobsQuery(
   f: Filters,
   userId: string | null,
   viewerLocations: string[] = [],
   opts: {
+    historyOnly?: boolean;
+    countOnly?: boolean;
+    limit?: number;
+    offset?: number;
     humanOverrideOnly?: boolean;
     reviewedSince?: string;
     locationFromProfile?: boolean;
     companyFiltersFromProfile?: boolean;
   } = {},
 ): SqlQuery {
+  if (opts.historyOnly) {
+    if (!userId) throw new Error("History requires a viewer");
+    f = {...f, status:"all", verdict:"all", companies:[],include:[],exclude:[],remoteOnly:false,location:"",experience:"",industry:"",subcategory:""};
+    opts = {...opts,locationFromProfile:false,companyFiltersFromProfile:false};
+    viewerLocations = [];
+  }
   const values: unknown[] = [];
   const ph = () => `$${values.length + 1}`;
   const where: string[] = [];
   const hasReviews = userId !== null;
 
   // reviewedSince filters the viewer's review join — meaningless without a viewer.
   if (opts.reviewedSince && !hasReviews) {
     throw new Error("buildJobsQuery: reviewedSince requires a viewer (userId)");
   }
 
@@ -33,37 +44,38 @@ export function buildJobsQuery(
   if (hasReviews) values.push(userId);
 
   // --- review-scoped filters (only when the viewer's reviews are joined) ---
   if (hasReviews) {
     const v = "COALESCE(rc.verdict, r.verdict)";
     if (f.verdict === "approve") where.push(`${v} = 'approve'`);
     else if (f.verdict === "deny") where.push(`${v} = 'deny'`);
     else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
     else if (f.verdict === "pending") where.push("r.job_id IS NULL");
     // "all" adds no verdict clause
-    where.push("r.error IS NULL");
+    if (!opts.historyOnly) where.push("r.error IS NULL");
+    if (opts.historyOnly) where.push(`(COALESCE(rc.verdict,r.verdict)='approve' OR rc.job_id IS NOT NULL OR EXISTS (SELECT 1 FROM application_packages ap WHERE ap.job_id=j.id AND ap.user_id=${viewerPh}::uuid))`);
     // Rejected-view recovery (getRejectedJobs): restrict to the operator's deliberate
     // rejects so AI denies — the bulk of deny rows — don't flood the view.
     if (opts.humanOverrideOnly) where.push("r.human_override IS TRUE");
     // Live-population delta (getReviewFeed): only reviews newer than the client's
     // cursor. The 10s overlap re-sends rows near the boundary — the client dedupes by
     // id, so delivery is at-least-once rather than gapped (in-flight upserts whose
     // reviewed_at predates the cursor snapshot would otherwise be lost).
     if (opts.reviewedSince) {
       where.push(`r.reviewed_at > ${ph()}::timestamptz - interval '10 seconds'`);
       values.push(opts.reviewedSince);
     }
   }
 
   // --- plain job filters (apply with or without an owner) ---
-  if (f.status === "open") where.push("j.closed_at IS NULL");
-  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");
+  if (f.status === "open") where.push(discoveryPredicate(f.includeOlderLive === true).text);
+  else if (f.status === "closed") where.push(sourceClosedPredicate().text);
 
   if (f.companies.length) {
     where.push(`j.company_id = ANY(${ph()})`);
     values.push(f.companies);
   }
   for (const kw of f.include) {
     where.push(`j.title ILIKE ${ph()}`);
     values.push(`%${kw}%`);
   }
   for (const kw of f.exclude) {
@@ -158,20 +170,21 @@ export function buildJobsQuery(
   // being shown one-at-a-time in JobDetail. They're fetched on job-open via
   // GET /api/jobs/[id] instead. c.ats IS selected (below) — the board's Source facet
   // filter (lib/rolefit/filter.ts) reads it. Seven more columns that no render path
   // reads (url, experience_match, industry, industry_subcategory, confidence,
   // stage1_decision, stage1_reason) are dropped entirely. Note experience_match /
   // industry / industry_subcategory are still referenced in the WHERE clause above
   // for the (currently UI-dormant) dimension filters — it's selecting them that was
   // unnecessary, not filtering on them.
   const selectCols = [
     "j.id", "j.title", "j.location", "j.location_canonicals", "j.remote",
+    "public.lifecycle_job_state(j.id) AS lifecycle",
     "j.first_seen_at", "j.closed_at", "COALESCE(c.display_name, c.name) AS company_name",
     // c.ats drives the Source facet; c.industry/size/hq_country are the global company
     // classification facts — selected ALWAYS (the anon board's facet filters read them
     // too; three tiny columns) and mapped in toJobRow (lib/queries.ts).
     "c.ats", "c.industry", "c.size", "c.hq_country",
   ];
   if (hasReviews) {
     selectCols.push(
       "COALESCE(rc.verdict, r.verdict) AS verdict",
       "r.human_override",
@@ -192,26 +205,35 @@ export function buildJobsQuery(
     );
   }
   const reviewJoin = hasReviews
     ? `LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${viewerPh}::uuid`
     : "";
   const correctionsJoin = hasReviews
     ? `LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = ${viewerPh}::uuid`
     : "";
 
   const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
+  const finiteInt = (value: number | undefined, fallback: number) =>
+    value !== undefined && Number.isFinite(value) ? Math.trunc(value) : fallback;
+  const limit = Math.min(500, Math.max(1, finiteInt(opts.limit,500)));
+  const offset = Math.max(0, finiteInt(opts.offset,0));
+  // These literals are bounded integers derived here, never boundary text.
+  const pageSql = opts.countOnly ? [] : ["ORDER BY j.first_seen_at DESC, j.id ASC", `LIMIT ${limit}`, `OFFSET ${offset}`];
   const text = [
-    `SELECT ${selectCols.join(", ")}`,
+    opts.countOnly ? "SELECT count(*)::int AS total" : `SELECT ${selectCols.join(", ")}`,
     "FROM jobs j",
     "JOIN companies c ON c.id = j.company_id",
     reviewJoin,
     correctionsJoin,
     overridesJoin,
     whereSql,
-    "ORDER BY j.first_seen_at DESC",
-    "LIMIT 500",
+    ...pageSql,
   ]
     .filter(Boolean)
     .join("\n");
 
   return { text, values };
 }
+
+export function buildJobsCountQuery(f: Filters, userId: string | null, viewerLocations: string[] = [], opts: Parameters<typeof buildJobsQuery>[3] = {}): SqlQuery {
+  return buildJobsQuery(f,userId,viewerLocations,{...opts,countOnly:true});
+}
diff --git a/dashboard/lib/metrics.ts b/dashboard/lib/metrics.ts
index 8751e60..e3687ec 100644
--- a/dashboard/lib/metrics.ts
+++ b/dashboard/lib/metrics.ts
@@ -123,21 +123,21 @@ export interface ReviewAgg {
 // COALESCE to '{}' makes `&&` definitively false. Empty/missing prefs → empty pool.
 export async function reviewAggWith(tx: TransactionSql, userId: string): Promise<ReviewAgg> {
   const rows = await tx`
       SELECT count(*) FILTER (WHERE r.job_id IS NOT NULL)::int AS reviewed,
              count(*) FILTER (WHERE r.stage1_decision = 'reject')::int AS gate_rejected,
              count(*) FILTER (WHERE r.verdict = 'approve')::int AS approved,
              count(*) FILTER (WHERE r.verdict = 'deny')::int AS denied,
              count(*) FILTER (WHERE r.verdict = 'deny' AND r.human_override)::int AS manual_rejected
       FROM jobs j
       LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
-      WHERE j.closed_at IS NULL
+      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
         AND (
           COALESCE(j.location_canonicals, ARRAY[j.location]) && COALESCE(
             (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
             '{}'::text[])
           OR ('Remote' = ANY(COALESCE(
             (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
             '{}'::text[])) AND j.remote IS TRUE)
         )
     `;
   return (rows[0] as unknown as ReviewAgg)
@@ -159,23 +159,23 @@ async function getFunnel(
     () => tx`
       SELECT count(*)::int AS tracked,
              count(*) FILTER (WHERE c.active)::int AS active,
              count(*) FILTER (WHERE c.discovery_source <> 'manual')::int AS discovery_sourced,
              count(*) FILTER (WHERE c.discovery_source <> 'manual' AND cr.company_id IS NOT NULL)::int AS reviewed
       FROM companies c
       LEFT JOIN company_reviews cr ON cr.company_id = c.id AND cr.user_id = ${userId}::uuid
     `,
     () => tx`
       SELECT count(*)::int AS ever_seen,
-             count(*) FILTER (WHERE closed_at IS NULL)::int AS open,
-             count(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
-      FROM jobs
+             count(*) FILTER (WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false))::int AS open,
+             count(*) FILTER (WHERE public.lifecycle_source_closed(j.id,j.closed_at))::int AS closed
+      FROM jobs j
     `,
     () => reviewAggWith(tx, userId),
     () => tx`
       SELECT count(*)::int AS applied
       FROM application_packages
       WHERE user_id = ${userId}::uuid AND status = 'applied'
     `,
     () => companyVerdictCountsWith(tx, userId),
     () => reviewStatsWith(tx, userId),
   ]) as unknown as [
@@ -310,38 +310,38 @@ async function getDistributions(tx: TransactionSql, userId: string): Promise<Dis
     jobsByLocation, jobsByDepartment, jobsRemote, jobsByCompany, jobsByAts, jobLifespan,
     fitScore, approvalsByIndustry, approvalsByRole, approvalsBySeniority,
     experienceMatch, workArrangement,
     companiesByAts, companiesBySource, includedByIndustry, topTechTags, topRedFlags,
     otherRedFlags,
   ] = await dbLimit([
     () => tx`SELECT location AS label, count FROM (
         SELECT loc AS location, count(*)::int AS count
         FROM jobs j
         CROSS JOIN LATERAL unnest(COALESCE(j.location_canonicals, ARRAY[j.location])) AS loc
-        WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
         GROUP BY loc
         UNION ALL
-        SELECT 'Remote', count(*)::int FROM jobs
-        WHERE closed_at IS NULL AND remote IS TRUE
+        SELECT 'Remote', count(*)::int FROM jobs j
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND remote IS TRUE
         HAVING count(*) > 0
       ) t ORDER BY count DESC LIMIT ${TOP_N}`,
-    () => tx`SELECT department AS label, count(*)::int AS count FROM jobs
-        WHERE closed_at IS NULL AND department IS NOT NULL AND department <> ''
+    () => tx`SELECT department AS label, count(*)::int AS count FROM jobs j
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND department IS NOT NULL AND department <> ''
         GROUP BY department ORDER BY count DESC LIMIT ${TOP_N}`,
     () => tx`SELECT CASE WHEN remote THEN 'Remote' ELSE 'On-site / hybrid' END AS label, count(*)::int AS count
-        FROM jobs WHERE closed_at IS NULL GROUP BY 1 ORDER BY count DESC`,
+        FROM jobs j WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY 1 ORDER BY count DESC`,
     () => tx`SELECT COALESCE(c.display_name, c.name) AS label, count(*)::int AS count
         FROM jobs j JOIN companies c ON c.id = j.company_id
-        WHERE j.closed_at IS NULL GROUP BY COALESCE(c.display_name, c.name) ORDER BY count DESC LIMIT ${TOP_N}`,
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY COALESCE(c.display_name, c.name) ORDER BY count DESC LIMIT ${TOP_N}`,
     () => tx`SELECT c.ats AS label, count(*)::int AS count
         FROM jobs j JOIN companies c ON c.id = j.company_id
-        WHERE j.closed_at IS NULL GROUP BY c.ats ORDER BY count DESC`,
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) GROUP BY c.ats ORDER BY count DESC`,
     () => tx`SELECT CASE
                WHEN d < 1 THEN '<1d' WHEN d < 3 THEN '1-3d' WHEN d < 7 THEN '3-7d'
                WHEN d < 14 THEN '1-2w' WHEN d < 30 THEN '2-4w' WHEN d < 60 THEN '1-2mo'
                ELSE '2mo+' END AS label,
                count(*)::int AS count
         FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
               FROM jobs WHERE closed_at IS NOT NULL) s
         GROUP BY label
         ORDER BY min(d)`,
     () => tx`SELECT ((fit_score / 10) * 10)::text || '-' || ((fit_score / 10) * 10 + 9)::text AS label,
diff --git a/dashboard/lib/queries.ts b/dashboard/lib/queries.ts
index 56344bc..827a513 100644
--- a/dashboard/lib/queries.ts
+++ b/dashboard/lib/queries.ts
@@ -1,15 +1,15 @@
-import { consumeJobVersion, assertPackageInput, parseGenerationContext, requestJobPayload, readPrivateSnapshot, type DemandResult } from "@/lib/jobLifecycle";
+import { parseStringList, parseRequirements, parseJobLifecycle, unwrapLifecycleJson, consumeJobVersion, assertPackageInput, parseGenerationContext, requestJobPayload, readPrivateSnapshot, type DemandResult } from "@/lib/jobLifecycle";
 import { withUserPayloadMutation, withUserSql, withAnonSql } from "@/lib/db";
 import type { Sql, TransactionSql } from "postgres";
 import { unstable_cache } from "next/cache";
-import { buildJobsQuery } from "@/lib/jobsQuery";
+import { buildJobsQuery, buildJobsCountQuery } from "@/lib/jobsQuery";
 import type { Filters } from "@/lib/filters";
 import type { ApplicationPackage, CompanyRow, CompanyBrowseRow, DiscoveryStateRow, ReviewedJobRow, JobReviewDetail, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
 import { toCompanyBrowseRow } from "@/lib/companies/browseCodec";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
 import { profileVersion } from "@/lib/profileVersion";
 import { parseProfileLinks } from "@/lib/profileLinks";
 import { parseScreeningAnswers } from "@/lib/screeningAnswers";
@@ -31,20 +31,21 @@ function toJobRow(row: Record<string, unknown>): ReviewedJobRow {
   const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ""));
   return {
     id: row.id as string,
     title: row.title as string,
     location: (row.location as string | null) ?? null,
     location_canonicals: Array.isArray(row.location_canonicals)
       ? (row.location_canonicals as unknown[]).filter(
           (v): v is string => typeof v === "string")
       : null,
     remote: (row.remote as boolean | null) ?? null,
+    lifecycle: parseJobLifecycle(row.lifecycle),
     first_seen_at: iso(row.first_seen_at),
     closed_at: row.closed_at != null ? iso(row.closed_at) : null,
     company_name: row.company_name as string,
     ats: row.ats as string,
     industry: (row.industry as string | null) ?? null,
     size: (row.size as string | null) ?? null,
     hq_country: (row.hq_country as string | null) ?? null,
     verdict: (row.verdict as string | null) ?? null,
     human_override: (row.human_override as boolean) ?? false,
     corrected: row.corrected as boolean | undefined,
@@ -53,21 +54,21 @@ function toJobRow(row: Record<string, unknown>): ReviewedJobRow {
     work_arrangement: (row.work_arrangement as string | null) ?? null,
     pay_min: (row.pay_min as number | null) ?? null,
     pay_max: (row.pay_max as number | null) ?? null,
     pay_currency: (row.pay_currency as string | null) ?? null,
     pay_period: (row.pay_period as string | null) ?? null,
     headcount: (row.headcount as string | null) ?? null,
     skills_score: (row.skills_score as number | null) ?? null,
     experience_score: (row.experience_score as number | null) ?? null,
     comp_score: (row.comp_score as number | null) ?? null,
     fit_score: (row.fit_score as number | null) ?? null,
-    skill_gaps: (row.skill_gaps as string[] | null) ?? null,
+    skill_gaps: parseStringList(row.skill_gaps),
   };
 }
 
 export async function getJobs(
   f: Filters,
   userId: string | null,
 ): Promise<ReviewedJobRow[]> {
   // locationFromProfile: the authed board self-serves the viewer's preferred_locations via
   // a correlated subquery (no viewerLocations param), so getProfile no longer gates this
   // query. companyFiltersFromProfile self-serves the viewer's company_exclusions +
@@ -80,20 +81,38 @@ export async function getJobs(
   const run = async (tx: TransactionSql): Promise<ReviewedJobRow[]> => {
     const rows = await tx.unsafe(text, values as never[]);
     return (rows as unknown as Record<string, unknown>[]).map(toJobRow);
   };
   // Anonymous board reads run under the `anon` role (shared-read policy only); the
   // authed board runs under the viewer's `authenticated` context so RLS scopes the
   // review join to their own rows.
   return userId ? withUserSql(userId, run) : withAnonSql(run);
 }
 
+export async function getJobsPage(f: Filters, userId: string | null, page=0, historyOnly=false) {
+  const offset=Math.max(0, Math.trunc(Number.isFinite(page) ? page : 0))*500;
+  const opts={locationFromProfile:true,companyFiltersFromProfile:true,historyOnly,offset};
+  const query=buildJobsQuery(f,userId,[],opts);
+  const count=buildJobsCountQuery(f,userId,[],opts);
+  const run=async(tx: TransactionSql) => {
+    // One statement gives count and page the same membership/expiry snapshot.
+    const result=await tx.unsafe(`WITH total AS (${count.text})
+      SELECT total.total, COALESCE(jsonb_agg(page ORDER BY page.first_seen_at DESC,page.id ASC) FILTER (WHERE page.id IS NOT NULL),'[]'::jsonb) AS rows
+      FROM total LEFT JOIN (${query.text}) page ON true GROUP BY total.total`,query.values as never[]);
+    const raw=unwrapLifecycleJson(result[0]?.rows);
+    const rows=Array.isArray(raw) ? raw.flatMap(item =>
+      item && typeof item === "object" && !Array.isArray(item) ? [toJobRow(Object.fromEntries(Object.entries(item)))] : []) : [];
+    return {rows,total:typeof result[0]?.total === "number" ? result[0].total : 0,page:offset/500};
+  };
+  return userId ? withUserSql(userId,run) : withAnonSql(run);
+}
+
 // The operator's deliberate rejects (verdict='deny' + human_override) — loaded so a
 // mis-clicked reject is recoverable from the board's Rejected view AFTER a reload, not
 // just in-session. The default board loads only verdict='approve', so these rows are
 // otherwise never sent to the client. Same lean JobRow shape as the board list (reuses
 // buildJobsQuery), bounded by its LIMIT. human_override scopes to operator rejects so
 // the (huge) set of AI denies is excluded. Only called on the authed path.
 export async function getRejectedJobs(
   userId: string,
 ): Promise<ReviewedJobRow[]> {
   const f: Filters = {
@@ -160,26 +179,27 @@ export async function getReviewFeed(
       cursor,
       newMatches: (rows as unknown as Record<string, unknown>[]).map(toJobRow),
     };
   });
 }
 
 // postgres.js delivers jsonb columns as parsed JS values; normalize a detail row
 // into the typed shape at the boundary instead of an `as unknown as` cast.
 function toJobReviewDetail(row: Record<string, unknown>): JobReviewDetail {
   return {
+    lifecycle: parseJobLifecycle(row.lifecycle),
     descriptionIsSaved: row.description_is_saved === true,
     reasoning: (row.reasoning as string | null) ?? null,
     about: (row.about as string | null) ?? null,
-    red_flags: (row.red_flags as string[] | null) ?? null,
-    benefits: (row.benefits as string[] | null) ?? null,
-    requirements: (row.requirements as { text: string; met: boolean }[] | null) ?? null,
+    red_flags: parseStringList(row.red_flags),
+    benefits: parseStringList(row.benefits),
+    requirements: parseRequirements(row.requirements),
     description: (row.description as string | null) ?? null,
     url: (row.url as string | null) ?? null,
     experience_match: (row.experience_match as string | null) ?? null,
     industry: (row.industry as string | null) ?? null,
     industry_subcategory: (row.industry_subcategory as string | null) ?? null,
     confidence: (row.confidence as string | null) ?? null,
     note: (row.note as string | null) ?? null,
     corrected: (row.corrected as boolean) ?? false,
   };
 }
@@ -190,20 +210,21 @@ export async function getJobReviewDetail(
 ): Promise<JobReviewDetail | null> {
   // Heavy, detail-only fields for one job, scoped to the VIEWER's own review.
   // Driven FROM jobs so j.description (full JD plaintext) + j.url (apply link)
   // always come back — even for a pending job the viewer hasn't been reviewed for,
   // and for an anonymous viewer (userId=null → the review joins match nothing, so
   // every review field is null and only the job-only fields are populated). Fetched
   // lazily on job-open so the board list stays lean.
   const run = async (tx: TransactionSql): Promise<JobReviewDetail | null> => {
     const rows = await tx`
       SELECT
+        public.lifecycle_job_state(j.id) AS lifecycle,
         COALESCE(rc.reasoning, r.reasoning) AS reasoning,
         COALESCE(rc.about, r.about) AS about,
         COALESCE(rc.red_flags, r.red_flags) AS red_flags,
         COALESCE(rc.benefits, r.benefits) AS benefits,
         COALESCE(rc.requirements, r.requirements) AS requirements,
         COALESCE(rc.description_snapshot,r.description_snapshot,j.description) AS description, j.url,
         (COALESCE(rc.description_snapshot,r.description_snapshot) IS NOT NULL) AS description_is_saved,
         COALESCE(rc.experience_match, r.experience_match) AS experience_match,
         COALESCE(rc.industry, r.industry) AS industry,
         COALESCE(rc.industry_subcategory, r.industry_subcategory) AS industry_subcategory,
@@ -257,21 +278,21 @@ function toReviewStats(row: Record<string, unknown>): ReviewStats {
 // side; the header uses it to stay hidden until the viewer's first review lands (see
 // components/rolefit/Header.tsx).
 export async function reviewStatsWith(tx: TransactionSql, userId: string): Promise<ReviewStats> {
   const rows = await tx`
     SELECT
       (count(*) FILTER (WHERE r.job_id IS NULL))::int       AS unreviewed,
       (count(*) FILTER (WHERE r.job_id IS NOT NULL))::int    AS reviewed,
       (count(*) FILTER (WHERE r.error IS NOT NULL))::int     AS errors
     FROM jobs j
     LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
-    WHERE j.closed_at IS NULL
+    WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
       AND (
         COALESCE(j.location_canonicals, ARRAY[j.location]) && COALESCE(
           (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
           '{}'::text[])
         OR ('Remote' = ANY(COALESCE(
           (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
           '{}'::text[])) AND j.remote IS TRUE)
       )
   `;
   const row = rows[0] as Record<string, unknown> | undefined;
@@ -300,25 +321,25 @@ export async function getCompanies(userId: string): Promise<CompanyRow[]> {
 // the unnest) so its count reflects exactly what selecting "Remote" matches;
 // canonical 'Remote' elements are excluded from the unnest to avoid a double row.
 export async function distinctLocationsWith(
   tx: TransactionSql,
 ): Promise<{ location: string; count: number }[]> {
   const rows = await tx`
     SELECT location, count FROM (
       SELECT loc AS location, count(*)::int AS count
       FROM jobs j
       CROSS JOIN LATERAL unnest(COALESCE(j.location_canonicals, ARRAY[j.location])) AS loc
-      WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
+      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
       GROUP BY loc
       UNION ALL
-      SELECT 'Remote', count(*)::int FROM jobs
-      WHERE closed_at IS NULL AND remote IS TRUE
+      SELECT 'Remote', count(*)::int FROM jobs j
+      WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false) AND remote IS TRUE
       HAVING count(*) > 0
     ) t
     ORDER BY count DESC, location ASC
     LIMIT 500
   `;
   return rows as unknown as { location: string; count: number }[];
 }
 
 export async function getDistinctLocations(
   userId: string,
diff --git a/dashboard/lib/rolefit/boardFilters.test.ts b/dashboard/lib/rolefit/boardFilters.test.ts
index a04229c..338c99c 100644
--- a/dashboard/lib/rolefit/boardFilters.test.ts
+++ b/dashboard/lib/rolefit/boardFilters.test.ts
@@ -8,20 +8,21 @@ describe("parseBoardFilters", () => {
     expect(parseBoardFilters(undefined)).toEqual(DEFAULT_FILTERS);
     expect(parseBoardFilters("not json")).toEqual(DEFAULT_FILTERS);
     expect(parseBoardFilters(42)).toEqual(DEFAULT_FILTERS);
   });
 
   test("parses a valid JSON string", () => {
     const f = parseBoardFilters(
       '{"search":"eng","cats":["Backend"],"locs":["Berlin"],"remote":"remote","minFit":75,"payMin":150,"sort":"pay"}',
     );
     expect(f).toEqual({
+      includeOlderLive: false,
       search: "eng", cats: ["Backend"], locs: ["Berlin"], sources: [],
       industries: [], sizes: [], countries: [],
       remote: "remote", minFit: 75, payMin: 150, payMax: null, payIncludeUndisclosed: false, sort: "pay",
     });
   });
 
   test("parses a plain object and falls back per-field for missing keys", () => {
     expect(parseBoardFilters({ search: "x" })).toEqual({ ...DEFAULT_FILTERS, search: "x" });
   });
 
diff --git a/dashboard/lib/rolefit/boardFilters.ts b/dashboard/lib/rolefit/boardFilters.ts
index 1993feb..7a8ea24 100644
--- a/dashboard/lib/rolefit/boardFilters.ts
+++ b/dashboard/lib/rolefit/boardFilters.ts
@@ -1,10 +1,11 @@
+import { unwrapLifecycleJson } from "@/lib/jobLifecycleState";
 import type { BoardFilterState } from "@/lib/rolefit/filter";
 import { DEFAULT_FILTERS, PAY_CEIL, PAY_FLOOR } from "@/lib/rolefit/filter";
 
 const REMOTE = new Set<BoardFilterState["remote"]>(["all", "remote", "hybrid", "onsite"]);
 const SORT = new Set<BoardFilterState["sort"]>(["match", "pay", "newest", "az"]);
 const MAX_SEARCH = 200;
 const MAX_ITEMS = 50;
 const MAX_ITEM_LEN = 120;
 
 function strList(v: unknown): string[] {
@@ -33,33 +34,26 @@ function payCeiling(v: unknown, floor: number): number | null {
   if (typeof v !== "number" || !Number.isFinite(v) || v < PAY_FLOOR) return null;
   const clamped = Math.min(Math.max(v, PAY_FLOOR), PAY_CEIL);
   return clamped < floor || clamped === PAY_CEIL ? null : clamped;
 }
 
 function defaults(): BoardFilterState {
   return { ...DEFAULT_FILTERS, cats: [], locs: [], sources: [], industries: [], sizes: [], countries: [] };
 }
 
 export function parseBoardFilters(raw: unknown): BoardFilterState {
-  let obj: unknown = raw;
-  if (typeof raw === "string") {
-    // LOAD-BEARING string tolerance — do NOT remove. Legit string inputs: the anon
-    // board-filter cookie (app/api/board-filters/route.ts stores serializeBoardFilters())
-    // replayed at login (app/login/page.tsx), plus legacy double-encoded
-    // profiles.board_filters rows. The write path (saveBoardFilters) now stores jsonb
-    // objects, but this branch must stay for those inputs.
-    try { obj = JSON.parse(raw); } catch { return defaults(); }
-  }
-  if (obj == null || typeof obj !== "object") return defaults();
-  const o = obj as Record<string, unknown>;
+  const obj = unwrapLifecycleJson(raw);
+  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return defaults();
+  const o = Object.fromEntries(Object.entries(obj));
   const payMin = payFloor(o.payMin);
   return {
+    includeOlderLive: o.includeOlderLive === true,
     search: typeof o.search === "string" ? o.search.slice(0, MAX_SEARCH) : DEFAULT_FILTERS.search,
     cats: strList(o.cats),
     locs: strList(o.locs),
     sources: strList(o.sources),
     industries: strList(o.industries),
     sizes: strList(o.sizes),
     countries: strList(o.countries),
     remote: REMOTE.has(o.remote as BoardFilterState["remote"])
       ? (o.remote as BoardFilterState["remote"]) : DEFAULT_FILTERS.remote,
     minFit: nonNegNum(o.minFit),
diff --git a/dashboard/lib/rolefit/filter.ts b/dashboard/lib/rolefit/filter.ts
index e5a8df7..3f706ae 100644
--- a/dashboard/lib/rolefit/filter.ts
+++ b/dashboard/lib/rolefit/filter.ts
@@ -1,31 +1,33 @@
 import type { JobRow } from "@/lib/types";
 
 export interface BoardFilterState {
+  includeOlderLive?: boolean;
   search: string;
   cats: string[];
   locs: string[];
   sources: string[];
   // Company-classification facets (companies.industry/size/hq_country). Each holds the
   // raw stored values the viewer selected, with "unknown" standing in for a NULL field.
   industries: string[];
   sizes: string[];
   countries: string[];
   remote: "all" | "remote" | "hybrid" | "onsite";
   minFit: number;
   payMin: number;              // $k, 0 = no floor
   payMax: number | null;       // $k, null = "+" (no upper limit)
   payIncludeUndisclosed: boolean;
   sort: "match" | "pay" | "newest" | "az";
 }
 
 export const DEFAULT_FILTERS: BoardFilterState = {
+  includeOlderLive: false,
   search: "",
   cats: [],
   locs: [],
   sources: [],
   industries: [],
   sizes: [],
   countries: [],
   remote: "all",
   minFit: 0,
   payMin: 0,
@@ -173,19 +175,20 @@ export function mergeRejectedPool(jobs: JobRow[], serverRejected: JobRow[]): Job
   const byId = new Map(jobs.map((j) => [j.id, j]));
   for (const j of serverRejected) if (!byId.has(j.id)) byId.set(j.id, j);
   return [...byId.values()];
 }
 
 // Three-way view partition: "all" hides both rejected and applied; "applied" shows only
 // applied; "rejected" shows only rejected — seeded from the server rejects union the
 // in-session rejects (see RolefitBoard), so both a reload and a live reject show up.
 export function filterByView(
   jobs: JobRow[],
-  view: "all" | "applied" | "rejected",
+  view: "all" | "applied" | "rejected" | "history",
   rejectedIds: ReadonlySet<string>,
   appliedIds: ReadonlySet<string>,
 ): JobRow[] {
+  if (view === "history") return jobs;
   if (view === "rejected") return jobs.filter((j) => rejectedIds.has(j.id));
   if (view === "applied") return jobs.filter((j) => appliedIds.has(j.id));
   // "all" — hide both rejected and applied
   return jobs.filter((j) => !rejectedIds.has(j.id) && !appliedIds.has(j.id));
 }
diff --git a/dashboard/lib/types.ts b/dashboard/lib/types.ts
index 9075ae8..5e22ec8 100644
--- a/dashboard/lib/types.ts
+++ b/dashboard/lib/types.ts
@@ -1,22 +1,24 @@
+import type { JobLifecycle } from "@/lib/jobLifecycleState";
 import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
 import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
 import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
 import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
 import type { RedFlag } from "@/lib/redFlags";
 
 // Heavy, detail-only fields. These are NOT included in the board's list query
 // (they serialized ~171KB into every board response while only ever showing
 // one-at-a-time in JobDetail). They're fetched on job-open via GET /api/jobs/[id]
 // and merged into the selected JobRow client-side. description (full JD plaintext)
 // and url (apply link) come from the jobs table and ride along on the same fetch.
 export interface JobReviewDetail {
+  lifecycle?: JobLifecycle | null;
   descriptionIsSaved?: boolean;
   reasoning: string | null;
   about: string | null;
   red_flags: string[] | null;
   benefits: string[] | null;
   requirements: { text: string; met: boolean }[] | null;
   description: string | null;
   url: string | null;
   // categoricals + provenance for the correction edit form
   experience_match: string | null;
@@ -32,20 +34,21 @@ export interface JobReviewDetail {
 // row mappers consume: postgres delivers timestamptz as Date (normalized to ISO
 // strings by toJobRow), and human_override is null when no owner review was joined.
 export interface JobRowBase {
   id: string;
   title: string;
   location: string | null;
   // Canonical location strings stamped by the poller (locations.canonicals);
   // null = not yet resolved (filters fall back to the raw location string).
   location_canonicals: string[] | null;
   remote: boolean | null;
+  lifecycle?: JobLifecycle | null;
   first_seen_at: string | Date;
   closed_at: string | Date | null;
   company_name: string;
   // Source ATS provider (companies.ats): one of greenhouse/lever/ashby/workable/
   // smartrecruiters/workday. Always selected (present with or without an owner);
   // read by the board's Source facet filter (lib/rolefit/filter.ts).
   ats: string;
   // Global company-classification facts (companies.industry/size/hq_country), always
   // selected — the board's Industry/Size/Country facet filters read them (owner or
   // anon; see lib/rolefit/filter.ts). Optional because pre-classification companies
diff --git a/docs/runbooks/2026-10-07-lifecycle-consumers.md b/docs/runbooks/2026-10-07-lifecycle-consumers.md
new file mode 100644
index 0000000..317cafe
--- /dev/null
+++ b/docs/runbooks/2026-10-07-lifecycle-consumers.md
@@ -0,0 +1,112 @@
+# Lifecycle consumer cutover and rollback
+
+Task9 adds read-only feed consumers; existing flags default off, retirement is
+still dry-run and archive inactive. Install the additive feed migration before
+this dashboard/reviewer version. Do not enable feed semantics until source
+mapping/readiness and the separately required rollout checks are complete.
+
+The public read interface is `lifecycle_job_state(job_id)` (nullable JSON with
+only feed/source booleans, availability, frozen anchor/expiry and public payload
+availability), `lifecycle_discovery_visible(job_id, legacy_closed_at, older_live)`
+and `lifecycle_source_closed(job_id, legacy_closed_at)`. These fixed, schema-
+qualified read-only functions run with a fixed search path. They preserve the
+service-only table grants; dashboard reads retain `withAnonSql`/`withUserSql`.
+They expose no user, private snapshot, claim, capacity or source credential data.
+The narrow read capability needs normal release review; ordinary feature tests
+are not independent security approval.
+
+A mapped listing is discoverable before its persisted expiry (strictly greater
+than the statement timestamp); expiry is exactly anchor + 720 hours. Sightings,
+private use and flag toggles do not establish a new anchor. Current unknown
+availability can appear, labelled Source unknown. Expired unknown and closed
+listings do not pass the older-live option; expired confirmed open listings do.
+Any eligible source listing can keep a Job discoverable. The displayed listing
+prefers a nonclosed current source, then open state, then latest frozen expiry,
+with stable listing-ID ties. All proven-closed mappings remain excluded on
+flag rollback. Unmapped rows return NULL lifecycle data and use legacy
+`closed_at`; no source state or anchor is invented. Mapping completeness is a
+rollout prerequisite, since unmapped legacy rows have no new horizon proof.
+
+The public board evaluates discovery per request; its previous 120-second ISR
+cache is disabled so cached pages cannot cross the exact expiry boundary. This
+increases anonymous read traffic; no throughput/load performance claim is made.
+
+`older=1` is the explicit navigation option; saved filter JSON cannot silently
+activate it. `page` and `historyPage` independently page at 500 rows, with stable
+first-seen/job-ID order. One statement returns the matching total and page under
+the same membership/time snapshot. Client facets, filtered rows and N-of-M count
+use the same loaded view pool; these are page-local filters, not full-corpus
+search/count claims. Pagination and total are shown separately. Existing newest
+sort remains the original discovered date, readable independently of the frozen
+feed anchor and source publication time; it does not claim an employer posting
+age. Direct detail reads are not restricted by discovery expiry.
+
+History reads are owner scoped and select persisted approval, correction, or
+application package work independently of expiry, source closure, review errors,
+profile location/company exclusions and discovery filters. History has its own
+count/page and actual card-to-detail path. Existing application package snapshot
+JD/Q/version and demand receipt rules remain authoritative. Saved answers with
+NULL historical questions are retained as orphan answers and labelled unavailable
+history; no current question schema is borrowed. Ready current detail remains
+separate from saved review/application inputs. A proven-closed detail does not
+queue new current hydration; retained work stays readable. Real old generated
+artifacts whose original inputs cannot be recovered still terminal-defer: full
+atomic input recapture is UNIMPLEMENTED. Contentless instruction/application
+markers can establish a first actual input under the existing Task8 contract.
+
+## Actual timestamp/payload consumer inventory
+
+Executed before edits and after cutover:
+`rg -n 'first_seen|last_seen|closed_at|description_pruned' reviewer dashboard job_discovery`.
+Every returned line is retained in Task9 evidence (`task9-consumers.txt` and
+`task9-consumers-final.txt`), including test fixtures. This table accounts for all
+returned production modules; the fixture groups below account for all returned
+test-only modules. Line numbers are historical evidence, not stable interfaces.
+
+| Consumer | Final purpose / disposition |
+| --- | --- |
+| `reviewer/db.py` | Candidate count and bounded newest-first rows share one statement/snapshot and the DB discovery predicate; no automatic older opt-in. Payload-pruned gate remains hydration-dependent. Private persistence/snapshots unchanged. |
+| `dashboard/lib/jobsQuery.ts` | Discovery rows/counts/page share the predicate; closed status uses source closure separately. Owner history bypasses discovery/profile predicates. Lean rows include parsed lifecycle projection; first-seen sort remains legacy readable. |
+| `dashboard/lib/queries.ts` | List mapper retains original timestamps and total-parses lifecycle/skill gaps. Actual page/count uses one statement. Review pool statistics and distinct locations use discovery. Saved detail/private package reads remain owner scoped and horizon independent; detail JSON arrays validated. Review-feed arrivals use the same builder. |
+| Analytics captions/KPI/glossary | Discovery totals are labelled discovery rather than employer open. Saved review distributions and applied totals identify retained history. Legacy closure-duration bins are labelled observed closure duration. |
+| `dashboard/lib/metrics.ts` | Discovery pools/distributions use discovery; closed counts use actual closure, not expiration. Applied and approval/private aggregates retain their owner-scoped history. Lifespan bins explicitly retain historical `closed_at - first_seen_at`; they are legacy observed closure durations, not expiry durations. |
+| `dashboard/lib/types.ts` | Legacy timestamps remain readable; lifecycle DTO is separate and nullable. |
+| `dashboard/lib/rolefit/filter.ts` | Newest sort retains first observed date; filtering/facets/row totals share the selected loaded discovery/history pool. |
+| `dashboard/components/rolefit/JobDetail.tsx` | Labels original date Discovered, plus distinct source/expiry/payload labels. Current and immutable saved contexts remain separate; honest NULL-question copy. |
+| `dashboard/components/rolefit/VisualBoardState.tsx` | Test/demo fixture date only, no production filtering or mutation. |
+| `job_discovery/db.py` | Existing compatibility ingestion timestamps/open-ID enumeration, legacy close/reopen, missing-question selector. Unchanged writers: permitted only in their existing bounded/gated legacy path; postcutover capture predicate disables unconditional refill. Do not restart old writer binaries during rollback. |
+| `job_discovery/prune.py` | Existing legacy closure cleanup selector, bounded gate, durable cutover exclusion. Never run alongside new identity-preserving maintenance; last-seen is never a deletion cutoff. Unchanged. |
+| `job_discovery/lifecycle/identity.py` | Existing first-observed identity migration and frozen 720-hour anchor; preserves legacy closure provenance, no invented use dates. Unchanged. |
+| `job_discovery/lifecycle/reconcile.py` | Existing verified sightings/miss reconciliation updates legacy closure mirror; suspicious/partial feed handling unchanged. Feed rollback is not a new source observation and does not reopen mappings. |
+| `job_discovery/lifecycle/demand.py` | Existing source coordinates plus no-refill/private-snapshot hydration contract. Current saved package data and real receipts retained; no blanket consumer rollback to cache backfill. |
+| `job_discovery/lifecycle/maintenance.py` | Existing retirement stamps payload pruning, keeps lean identity and protected history; durable cutover marker prevents restarting destructive legacy prune. Unchanged enforcement/dry-run. |
+
+Returned test/demo consumer groups: `queries.reviewFeed`, `queries.locationScoping.db`,
+`queries.boardLocationScoping.db`, `queries.boardInclude.db`, `jobsQuery`,
+`rolefit/filter`, `rolefit/JobDetail`, `ReviewNowPanel`, `JobCard`,
+`ApplicationPanel`, `RolefitBoard.liveMatches`, `RolefitBoard`,
+`RolefitBoard.rejectAffordance`, and the new `jobLifecycleConsumers` unit/DB tests.
+Those fixture timestamps remain legitimate legacy representations; new tests
+cover lifecycle display and owner history without changing old observations.
+
+## Safe coexistence and rollback
+
+The new read-only dashboard/reviewer can coexist with Task8 source/demand/private
+snapshot writers and service-only lifecycle state. Before activation, flag-off
+legacy reads remain compatible with mapped and unmapped rows. Legacy timestamp
+fields remain populated/readable; they are not source completeness evidence.
+After mapping/feed cutover, compatible source reconciliation stays authoritative.
+Do not use old dashboard/reviewer builds that equate pruning/expiry with closure
+or hide retained private history. Roll back to this compatible read version and
+pause relevant flags/workers, retaining every additive row, immutable snapshot,
+anchor, use/capture provenance, pending event and durable cutover marker. Never
+reset first-seen/anchors, refill retired caches, clear source closure proof, resume
+unconditional backfill or restart destructive legacy prune to make a rollback
+look healthy. If a compatible writer cannot progress, report degradation and
+preserve state; do not switch to old bypass paths.
+
+R6-4 physical-guard closure/health progress remains mandatory Task10/13 work.
+R6-5 shared public transport is reused unchanged; prior offline results are not
+live-provider/load proof. Task3's omitted independent expiry-enforcement,
+capacity-accounting, cross-user/adversarial review remains deliberately absent.
+This runbook and Task9 functional feed tests do not supply that assurance.
diff --git a/migrations/2026-10-07-04-lifecycle-feed.sql b/migrations/2026-10-07-04-lifecycle-feed.sql
new file mode 100644
index 0000000..76bb2d6
--- /dev/null
+++ b/migrations/2026-10-07-04-lifecycle-feed.sql
@@ -0,0 +1,58 @@
+BEGIN;
+-- Read-only public lifecycle display/predicate. Underlying tables stay service-only.
+-- Fixed SELECTs expose no private rows, claims, credentials or control internals.
+CREATE OR REPLACE FUNCTION public.lifecycle_job_state(p_job_id text) RETURNS jsonb
+LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT jsonb_build_object(
+    'feedEnabled', ctl.feed_enabled, 'sourceEnabled', ctl.source_enabled,
+    'sourceAvailability', sl.source_availability,
+    'discoveryAnchorAt', sl.discovery_anchor_at,
+    'discoveryExpiresAt', sl.discovery_expires_at,
+    'payloadAvailability', CASE WHEN j.description IS NOT NULL THEN 'available'
+      WHEN sl.payload_retired_at IS NOT NULL OR j.description_pruned THEN 'retired' ELSE 'missing' END)
+  FROM public.jobs j
+  CROSS JOIN public.lifecycle_control ctl
+  JOIN LATERAL (
+    SELECT l.source_availability,l.discovery_anchor_at,l.discovery_expires_at,l.payload_retired_at
+    FROM public.source_listings l WHERE l.job_id=j.id
+    ORDER BY (l.source_availability='closed') ASC,
+      (l.discovery_expires_at > statement_timestamp()) DESC,
+      (l.source_availability='open') DESC,l.discovery_expires_at DESC,l.id ASC LIMIT 1
+  ) sl ON true
+  WHERE j.id=p_job_id AND ctl.singleton
+$$;
+CREATE OR REPLACE FUNCTION public.lifecycle_discovery_visible(p_job_id text,p_legacy_closed_at timestamptz,p_include_older_live boolean DEFAULT false)
+RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT CASE
+    -- Missing mappings retain honest legacy behavior; rollout requires mapping readiness.
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
+      THEN p_legacy_closed_at IS NULL
+    -- Proven closure remains excluded when flags roll back.
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN false
+    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NULL
+    ELSE EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id
+      AND l.source_availability<>'closed'
+      AND (NOT ctl.feed_enabled OR l.discovery_expires_at > statement_timestamp()
+        OR (p_include_older_live AND l.source_availability='open')))
+    END
+  FROM public.lifecycle_control ctl WHERE ctl.singleton
+$$;
+REVOKE ALL ON FUNCTION public.lifecycle_job_state(text) FROM PUBLIC;
+REVOKE ALL ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.lifecycle_job_state(text) TO anon,authenticated;
+GRANT EXECUTE ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) TO anon,authenticated;
+
+CREATE OR REPLACE FUNCTION public.lifecycle_source_closed(p_job_id text,p_legacy_closed_at timestamptz)
+RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT CASE
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
+      THEN p_legacy_closed_at IS NOT NULL
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
+    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
+    ELSE false END
+  FROM public.lifecycle_control ctl WHERE ctl.singleton
+$$;
+REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
+INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/reviewer/db.py b/reviewer/db.py
index 84f7f98..54d2fbc 100644
--- a/reviewer/db.py
+++ b/reviewer/db.py
@@ -235,22 +235,23 @@ def parse_company_exclusions(raw) -> dict:
     return out
 
 
 def select_candidates(
     conn, user_id: str, profile_version: str, limit: int,
     preferred_locations: list[str] | None = None,
     exclusions: dict | None = None,
 ) -> tuple[list[dict], int]:
     """Return (rows, total_stale) where total_stale is the unbounded stale count.
 
-    Splitting the count into a separate bounded SELECT avoids materialising the
-    full stale set before LIMIT when the window-aggregate approach would do.
+    Count and bounded rows are independent subqueries in one statement, so they
+    share the same snapshot and expiry boundary without materialising all stale
+    rows before LIMIT. The job-ID tie breaker keeps equal-date pages stable.
 
     `exclusions` is the parsed company_exclusions dict (parse_company_exclusions):
     a deterministic, per-user, pre-LLM gate on the company's globally-classified
     facts (industry / size / hq_country / red-flag category). A per-user
     company_overrides verdict wins over the facet gate in BOTH directions:
     'include' readmits a facet-excluded company; 'exclude' removes an
     otherwise-passing one. None/empty lists apply no gate (fail-open).
     """
     # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
     # guard makes the whole OR true). When set: match the job's canonical
@@ -258,23 +259,21 @@ def select_candidates(
     # stamped), and remote jobs ONLY when the user opted in by selecting
     # 'Remote' (spec 2026-07-16: remote no longer bypasses the filter).
     prefs = preferred_locations or []
     exc = exclusions or {"industries": [], "countries": [], "sizes": [],
                          "red_flag_categories": []}
     _where = """
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
         LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
         LEFT JOIN company_overrides co ON co.company_id = c.id AND co.user_id = %(uid)s
-        WHERE j.closed_at IS NULL
-          AND NOT EXISTS(SELECT FROM source_listings sl WHERE sl.job_id=j.id
-            AND sl.discovery_expires_at<=clock_timestamp())
+        WHERE public.lifecycle_discovery_visible(j.id,j.closed_at,false)
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
@@ -302,34 +301,37 @@ def select_candidates(
                OR ('Remote' = ANY(%(prefs)s::text[]) AND j.remote IS TRUE))
     """
     from job_discovery.lifecycle.config import read_control
     params = {"uid": _uuid(user_id), "pv": profile_version, "lim": limit,
               "hydrate": read_control(conn).hydration_enabled,
               "has_prefs": bool(prefs), "prefs": prefs,
               "exc_ind": exc["industries"], "exc_size": exc["sizes"],
               "exc_ctry": exc["countries"], "exc_flag": exc["red_flag_categories"]}
     with conn.cursor() as cur:
         cur.execute(
-            f"SELECT count(*)::int AS n {_where}",
+            f"""SELECT totals.n,
+              COALESCE(jsonb_agg(to_jsonb(candidate) - '_candidate_first_seen'
+                ORDER BY candidate._candidate_first_seen DESC, candidate.id ASC)
+                FILTER (WHERE candidate.id IS NOT NULL), '[]'::jsonb) AS rows
+            FROM (SELECT count(*)::int AS n {_where}) totals
+            LEFT JOIN (
+              SELECT j.id, j.title, j.location, j.remote, j.description,
+                c.ats, COALESCE(c.display_name, c.name) AS company_name,
+                c.industry, c.industry_subcategory, c.size, c.hq_country,
+                c.red_flags, c.about, j.first_seen_at AS _candidate_first_seen
+              {_where} ORDER BY j.first_seen_at DESC, j.id ASC LIMIT %(lim)s
+            ) candidate ON true
+            GROUP BY totals.n""",
             params,
         )
-        total = cur.fetchone()["n"]
-        cur.execute(
-            f"SELECT j.id, j.title, j.location, j.remote, j.description,"
-            f" c.ats, COALESCE(c.display_name, c.name) AS company_name,"
-            f" c.industry, c.industry_subcategory, c.size, c.hq_country,"
-            f" c.red_flags, c.about"
-            f" {_where} ORDER BY j.first_seen_at DESC LIMIT %(lim)s",
-            params,
-        )
-        rows = cur.fetchall()
-    return rows, total
+        result = cur.fetchone()
+    return result["rows"], result["n"]
 
 
 
 def upsert_review(conn, row: dict) -> None:
     # Normalize to the full column set so callers may omit new keys; wrap JSONB.
     full = {c: row.get(c) for c in _REVIEW_COLUMNS}
     full["user_id"] = _uuid(full["user_id"])
     for c in _JSONB_COLUMNS:
         full[c] = None if c == "questions_snapshot" and full[c] is None else Json(full[c] if full[c] is not None else [])
     if row.get('job_version_id'):
diff --git a/schema.sql b/schema.sql
index 1091d3d..e84bbc0 100644
--- a/schema.sql
+++ b/schema.sql
@@ -2190,10 +2190,68 @@ CREATE TABLE IF NOT EXISTS lifecycle_writer_readiness (
  writer text PRIMARY KEY, contract_version integer NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  validated_at timestamptz, notes text NOT NULL
 );
 REVOKE ALL ON lifecycle_writer_readiness FROM PUBLIC,anon,authenticated;
 ALTER TABLE lifecycle_writer_readiness ENABLE ROW LEVEL SECURITY;
 INSERT INTO lifecycle_writer_readiness(writer,contract_version,notes)
 VALUES ('demand_snapshots',1,'Prerequisite columns present; runtime writers require release verification. No activation granted.')
 ON CONFLICT(writer) DO NOTHING;
 INSERT INTO schema_migrations(filename) VALUES('2026-10-03-03-lifecycle-snapshots.sql') ON CONFLICT DO NOTHING;
+BEGIN;
+-- Read-only public lifecycle display/predicate. Underlying tables stay service-only.
+-- Fixed SELECTs expose no private rows, claims, credentials or control internals.
+CREATE OR REPLACE FUNCTION public.lifecycle_job_state(p_job_id text) RETURNS jsonb
+LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT jsonb_build_object(
+    'feedEnabled', ctl.feed_enabled, 'sourceEnabled', ctl.source_enabled,
+    'sourceAvailability', sl.source_availability,
+    'discoveryAnchorAt', sl.discovery_anchor_at,
+    'discoveryExpiresAt', sl.discovery_expires_at,
+    'payloadAvailability', CASE WHEN j.description IS NOT NULL THEN 'available'
+      WHEN sl.payload_retired_at IS NOT NULL OR j.description_pruned THEN 'retired' ELSE 'missing' END)
+  FROM public.jobs j
+  CROSS JOIN public.lifecycle_control ctl
+  JOIN LATERAL (
+    SELECT l.source_availability,l.discovery_anchor_at,l.discovery_expires_at,l.payload_retired_at
+    FROM public.source_listings l WHERE l.job_id=j.id
+    ORDER BY (l.source_availability='closed') ASC,
+      (l.discovery_expires_at > statement_timestamp()) DESC,
+      (l.source_availability='open') DESC,l.discovery_expires_at DESC,l.id ASC LIMIT 1
+  ) sl ON true
+  WHERE j.id=p_job_id AND ctl.singleton
+$$;
+CREATE OR REPLACE FUNCTION public.lifecycle_discovery_visible(p_job_id text,p_legacy_closed_at timestamptz,p_include_older_live boolean DEFAULT false)
+RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT CASE
+    -- Missing mappings retain honest legacy behavior; rollout requires mapping readiness.
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
+      THEN p_legacy_closed_at IS NULL
+    -- Proven closure remains excluded when flags roll back.
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN false
+    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NULL
+    ELSE EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id
+      AND l.source_availability<>'closed'
+      AND (NOT ctl.feed_enabled OR l.discovery_expires_at > statement_timestamp()
+        OR (p_include_older_live AND l.source_availability='open')))
+    END
+  FROM public.lifecycle_control ctl WHERE ctl.singleton
+$$;
+REVOKE ALL ON FUNCTION public.lifecycle_job_state(text) FROM PUBLIC;
+REVOKE ALL ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.lifecycle_job_state(text) TO anon,authenticated;
+GRANT EXECUTE ON FUNCTION public.lifecycle_discovery_visible(text,timestamptz,boolean) TO anon,authenticated;
+
+CREATE OR REPLACE FUNCTION public.lifecycle_source_closed(p_job_id text,p_legacy_closed_at timestamptz)
+RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
+  SELECT CASE
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id)
+      THEN p_legacy_closed_at IS NOT NULL
+    WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
+    WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
+    ELSE false END
+  FROM public.lifecycle_control ctl WHERE ctl.singleton
+$$;
+REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
+GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
+INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/tests/test_reviewer_lifecycle_feed.py b/tests/test_reviewer_lifecycle_feed.py
new file mode 100644
index 0000000..098dcd7
--- /dev/null
+++ b/tests/test_reviewer_lifecycle_feed.py
@@ -0,0 +1,57 @@
+"""Ordinary feed candidate semantics; excludes the deliberately omitted mechanism review."""
+import pytest
+from reviewer import db as rdb
+
+pytestmark = pytest.mark.usefixtures("conn")
+USER = "11111111-1111-1111-1111-111111111111"
+
+
+def test_feed_flags_candidates_and_counts(conn):
+    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
+    conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('old',1,'1','Role','https://example.test/job')")
+    source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id").fetchone()['id']
+    conn.execute("""INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
+      discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,source_availability)
+      VALUES(%s,'1','old',now()-interval '721 hours',now()-interval '721 hours','local_observation',now()-interval '1 hour','open')""", (source,))
+    conn.commit()
+    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
+    assert [r['id'] for r in rows] == ['old'] and count == 1
+    conn.execute("UPDATE lifecycle_control SET feed_enabled=true,activation_generation=activation_generation+1")
+    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
+    assert rows == [] and count == 0
+    conn.execute("UPDATE lifecycle_control SET feed_enabled=false,activation_generation=activation_generation+1")
+    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
+    assert len(rows) == count == 1
+
+
+def test_candidate_count_and_rows_share_one_read_statement(conn):
+    """A candidate page and its total must use one statement-time boundary."""
+    from contextlib import contextmanager
+
+    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
+    conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('fresh',1,'1','Role','https://example.test/job')")
+    conn.commit()
+    candidate_reads = []
+
+    class RecordedConnection:
+        def __getattr__(self, name):
+            return getattr(conn, name)
+
+        @contextmanager
+        def cursor(self, *args, **kwargs):
+            with conn.cursor(*args, **kwargs) as cursor:
+                class RecordedCursor:
+                    def __getattr__(self, name):
+                        return getattr(cursor, name)
+
+                    def execute(self, query, params=None):
+                        if "FROM jobs j" in query:
+                            candidate_reads.append(query)
+                        return cursor.execute(query, params)
+
+                yield RecordedCursor()
+
+    rows, count = rdb.select_candidates(RecordedConnection(), USER, 'v1', 1)
+    assert [row['id'] for row in rows] == ['fresh'] and count == 1
+    assert len(candidate_reads) == 1
+    assert '_candidate_first_seen' not in rows[0]
