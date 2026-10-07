# Read-only release preflight

Release approval is recorded in RELEASE-AUTHORIZATION.md. Implementation and
permitted verification are incomplete; no release mutation has been attempted.

Railway connected read calls succeeded on both named links (Railway and Primary),
returning the same job-board-poller project/workspace. For writes, resolve intended
link using prior project context or explicit account selection if still ambiguous.

Project: c9bd4688-5416-4796-a75d-48cd4dc92163 (Andrew Malvani’s Projects).
Production environment: 374211c1-6c80-4a9c-9038-520883ccfae2.

- poller: 64107603-4072-4d34-80ce-a2bd2f9f2e10, main repository
  manwithaplandy/job-board, live, daily cron `0 0 * * *`, staged changes 0.
- reviewer-worker: 258ed329-47b9-47b6-ab70-a0347e6db1d7, same repo/main,
  live, no cron, staged changes 0.
- discovery: 550af5ec-9b76-4f65-8263-5796caba0f05, same repo/main,
  live-with-staged-changes, five unrelated pending changes.

Unrelated patch da73b611-4582-4d21-9dec-1f377bb1771a is STAGED, five changes,
created July 17 / updated July 22. Do not accept/deploy the environment-wide
patch. Existing environment has no Railway volumes or buckets. That observation
does not establish absence of an external approved archive destination; later
configuration/destination checks remain required. No variable values were read.

README records Vercel dashboard rooted at dashboard/, manual Supabase migrations
before dependent code, and affected-component auto-deploys from main. README’s
old two-hour poller cron differs from live daily cron; live service is the
verified reference and daily schedule must remain unchanged.

railway/vercel CLI are absent locally; gh exists. Connected Railway MCP has
read access. No migration, deployment, setting, staged patch or credential
mutation occurred. Revalidate exact service config/commit and staged state at
actual release. Skill: c2/use-railway read for this preflight.

Tool metadata confirmed accept_deploy has only environmentId and commits ALL
staged changes, no service filter. It must not be used on this pending patch.
The redeploy tool reuses a prior deployment commit, so it is not proof of shipping
the new exact commit. Use existing main auto-deploy workflow and verify scoped
service exact deployment metadata after merge; do not create another service or
apply the unrelated patch to obtain a release.

Vercel read-only list_projects(search=job-board) and get_project succeeded.
Intended dashboard: job-board-dashboard / prj_7Z7btXKAhM80SgKkdw35K8UaOUtH,
team/account team_2w1ofxlgr52EIaZZXJaItBf6, framework nextjs. Connected project
response did not expose rootDirectory/Git link/production targets in the
selected fields; these are not claimed verified. README supplies dashboard/
root only. Exact deployment gitSource/commit and current production alias must
be resolved and verified at actual release. No deployment or env-values calls
were made. Vercel deployments-cicd skill read; existing Git workflow preferred.

Vercel current production deployment resolved read-only: dpl_ARhsncvQVGE4ykLerrdcj6gZVd4B,
READY/production, metadata githubCommitSha a8c4b82d95b35c0259600c19c1506faae807c3fc
(matches reconstruction base). URL job-board-dashboard-blesz20rv-andrews-projects-ecc12687.vercel.app.
Domains include jobs.andrewmalvani.com and job-board-dashboard-mu.vercel.app.
get_deployment(withGitRepoInfo=true) returned commit via meta; gitSource was absent,
so no assertion about a gitSource field. This is baseline state only; recheck
new exact commit and deployed domains after completed release.

Additional read-only release preflight: Railway whoami succeeded for BOTH configured links, exposing only sanitized actorID; both resolve same actor f9a98432-9fa9-4a45-96e0-384633f9667d and priorlistprojects showed same intendedproject. They are duplicate connections to the same account, not evidenceof distinctaccount ambiguity; futurewrites stillverifyexacttarget/link. No profileemail/name/credentialsprinted/saved. Currenttooldeclaration connect_service_source: livechange ALWAYSappliesallsourcenvironments; environmentIdonlyvalidstaged; commitShapin stopsbranchfollowinguntilreconnectedwithoutpin. Therefore not a safe implicitproduction-only deployfallback; preserve existingGitmainautodeploy workflow and unrelateddiscoverystagedpatch, no live sourcechange/no broadaccept. Redeployreusesoldbuild anddoesnotproveexactnewcommit. No writesperformed.

Release readonly remote recheck duringTask10: git ls-remote origin refs/heads/main confirmed a8c4b82d95b35c0259600c19c1506faae807c3fc (matches preserved sourcebaseline); gh repo view GraphQL returned HTTPForbidden, exit1. No write/publish attempted. ExistingGitremote remains readable; finalremote exactSHA recheck required. Do not infer GitHub API write capability from shellauth.

Connected GitHub app harmless get_repo succeeded isErrorfalse for manwithaplandy/job-board/id1278568393: main/public/notarchived; permissions push+admin/maintain/pull true, mergecommit/squash allowed, auto_mergefalse. No write occurred. Existing explicit completedrelease authorization remains; connector capabilities/read success resolve later PR/merge route despite shellGraphQLForbidden, notproofanywriteexecuted. Neverrebase/rewriteexistinghistory. Actual permittedCIinventory must land13 beforepublication.
