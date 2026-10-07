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
