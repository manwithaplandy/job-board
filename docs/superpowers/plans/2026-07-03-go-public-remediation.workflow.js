// Go-public REMEDIATION workflow — fixes the review findings.
//
// Source of truth for each fix: docs/superpowers/plans/2026-07-03-go-public-review-findings.md
// Per fix-group (blockers first): Opus implements the specified fix → Fable
// adversarially reviews (must confirm the finding is CLOSED + suites green, not
// just that tests pass) → loop until production-ready → commit on go-public-saas.
// Commits locally, never pushes. Stops if a group can't converge.
//
// Run:    Workflow({ scriptPath: "docs/superpowers/plans/2026-07-03-go-public-remediation.workflow.js" })
// Subset: args:{ groups:["Blockers"] } to run only certain severity groups.

export const meta = {
  name: 'go-public-remediation',
  description: 'Fix the go-public review findings (2 blockers + 6 majors + minors): Opus fixes, Fable reviews to closed-and-green, commit per fix-group on go-public-saas.',
  phases: [
    { title: 'Blockers' },
    { title: 'Majors' },
    { title: 'Minors & systemic guard' },
  ],
}

const REPORT = 'docs/superpowers/plans/2026-07-03-go-public-review-findings.md'
const MAX_ITERS = 4

// Each fix = one commit. `done` is what the Fable reviewer must independently confirm is CLOSED.
const FIXES = [
  {
    id: 'B-STORAGE', group: 'Blockers',
    title: 'Codify résumé-bucket storage policies (per-prefix tenant isolation)',
    spec: "Add a migration creating storage.objects RLS policies for the `resumes` bucket: authenticated may select/insert/update/delete ONLY within its own prefix — USING/WITH CHECK (bucket_id='resumes' AND (storage.foldername(name))[1] = auth.uid()::text); anon gets nothing. Mirror into schema.sql if storage objects are represented there; otherwise document that this policy must be applied to the live project. This CANNOT be fully verified without live infra — implement the SQL + a clear header, and record the live cross-account probe as a deferred setup step.",
    files: ['migrations/', 'schema.sql'],
    done: 'A migration codifies per-prefix storage.objects policies for the resumes bucket scoped by auth.uid(); the live cross-account verification is recorded as deferredToSetup (not treated as a code blocker).',
  },
  {
    id: 'B-COST', group: 'Blockers',
    title: 'Close the cost-cap bypass (counters + daily_review_cap non-user-writable + clamp + REVOKE defaults)',
    spec: "Three-part fix from the report's B-COST: (1) Move usage_counters WRITES off the authenticated role — route dashboard/lib/usage.ts chargeGeneration/chargeGenerations through serviceSql (add to the serviceRole allowlist + its guard test with justification); keep SELECT for remaining-budget reads. The reviewer/worker already write as postgres/service so they're unaffected. (2) Make profiles.daily_review_cap non-user-writable: REVOKE UPDATE (daily_review_cap) ON profiles FROM authenticated (column privilege) in a migration; keep the user's UPDATE on resume_text/model_* etc. (3) Defense-in-depth clamp: in reviewer/run.py (~:305) and dashboard/lib/reviewRequests.ts (~:103), the daily_review_cap override may only LOWER the tier cap, never raise it: cap = min(override, tier_cap) when override present, else tier_cap. ALSO add a blanket REVOKE of the default anon/authenticated DML grants on every user-scoped + deny-all table (the report's systemic guard) so RLS is not the only gate. Add/extend tests.",
    files: ['migrations/', 'dashboard/lib/usage.ts', 'dashboard/lib/serviceRoleAllowlist.test.ts', 'reviewer/run.py', 'dashboard/lib/reviewRequests.ts', 'schema.sql'],
    done: 'usage_counters is no longer writable by the authenticated role (writes go via service role, DML revoked); daily_review_cap cannot be raised by a user (column REVOKE + code clamp to min(override, tier)); default anon/authenticated grants are REVOKEd on user-scoped tables; tests cover the clamp and the allowlist addition.',
  },
  {
    id: 'M-RESURRECT', group: 'Majors',
    title: 'Deletion tombstone: stop webhook / profile / reviewer from recreating erased data',
    spec: "One shared tombstone helper keyed on account_deletions, applied at all three write-back paths (report M-RESURRECT-1 + M-RESURRECT-2): (a) the Stripe webhook acks-and-skips any event whose resolved user_id EXISTS in account_deletions (dashboard/app/api/stripe/webhook + subscriptions.ts upsert); (b) upsertProfile / saveProfileResume refuses to write for a tombstoned user; (c) the reviewer re-checks the profiles row / tombstone before its final writes (reviewer/run.py + worker.py). Cheap EXISTS queries. Add tests.",
    files: ['dashboard/app/api/stripe/webhook/route.ts', 'dashboard/lib/subscriptions.ts', 'dashboard/lib/queries.ts', 'dashboard/app/actions/profile.ts', 'reviewer/run.py', 'reviewer/worker.py'],
    done: 'A tombstone (account_deletions) check blocks re-insert at the webhook, profile upsert, and reviewer final-write paths; tests prove a deleted user cannot be resurrected by a trailing webhook or an in-flight review.',
  },
  {
    id: 'M-STORAGE-DELETE', group: 'Majors',
    title: 'Fail-closed résumé deletion (throw on error, paginate, reject nested filenames)',
    spec: "Report M-STORAGE-DELETE: deleteStorageObjects (dashboard/lib/accountDeletion.ts) must THROW on the storage remove error (and surface list errors) so the deletion cascade does not report success while résumé PDFs survive — the cascade order is designed so a retry converges. Paginate the list (no unbounded {limit:1000}). Prevent the filename-with-'/' evasion by rejecting or normalizing '/' in uploaded filenames at profile.ts / onboarding.ts upload sites (or recurse the delete). Add tests for the throw-on-failure and filename cases.",
    files: ['dashboard/lib/accountDeletion.ts', 'dashboard/app/actions/profile.ts', 'dashboard/app/actions/onboarding.ts'],
    done: 'Storage-delete failures fail the deletion cascade (no silent success); list is paginated; nested-filename evasion is prevented; tests cover failure + filename.',
  },
  {
    id: 'M-WEBHOOK-ORDER', group: 'Majors',
    title: 'Monotonic subscription upsert (ignore stale out-of-order Stripe events)',
    spec: "Report M-WEBHOOK-ORDER: guard upsertSubscription (dashboard/lib/subscriptions.ts) so a stale customer.subscription.updated delivered after a delete cannot flip canceled→active. Store the event/object timestamp and apply only if newer, OR re-retrieve the subscription fresh in the updated/deleted handlers (as the completed handler already does). Add a test for out-of-order delivery.",
    files: ['dashboard/lib/subscriptions.ts', 'dashboard/app/api/stripe/webhook/route.ts'],
    done: 'An out-of-order/stale subscription event cannot re-grant a canceled plan (monotonic guard or fresh retrieve); a test proves canceled stays canceled.',
  },
  {
    id: 'M-TOCTOU', group: 'Majors',
    title: 'Serialize per-user review spend (no 2x cap under cron + on-demand concurrency)',
    spec: "Report M-TOCTOU: the cron reviewer and the on-demand worker can each read spend=0 and spend up to cap for the same user. Take a per-user lock across get_daily_spend → select_candidates → add_daily_spend (pg_advisory_xact_lock(hashtext(user_id)) or SELECT ... FOR UPDATE on a per-user row), OR reserve budget by incrementing the counter before the LLM calls and refunding unused. Apply in reviewer/run.py _review_user (shared by run + worker). Add a test simulating concurrent runs.",
    files: ['reviewer/run.py', 'reviewer/db.py', 'reviewer/worker.py'],
    done: 'Concurrent cron + on-demand review of the same user cannot exceed the daily cap (per-user lock or reserve-before-spend); a test demonstrates the bound holds.',
  },
  {
    id: 'M-STRIPE-CUSTOMER', group: 'Majors',
    title: 'Handle the Stripe customer on deletion (delete or persist + disclose)',
    spec: "Report M-STRIPE-CUSTOMER: account deletion cancels the subscription but leaves the Stripe customer (email/name/history) and then destroys the only stripe_customer_id mapping. Either stripe.customers.del(customerId) during deletion step 1, OR persist stripe_customer_id into account_deletions AND disclose the Stripe retention in dashboard/app/privacy/page.tsx (like the LangFuse/OpenRouter carve-out already does). Pick one coherent approach; add a test.",
    files: ['dashboard/lib/accountDeletion.ts', 'dashboard/app/privacy/page.tsx', 'migrations/'],
    done: 'The Stripe customer is either deleted or its id is retained in account_deletions with the retention disclosed in /privacy; test covers it.',
  },
  {
    id: 'MINORS-GUARD', group: 'Minors & systemic guard',
    title: 'Minors + a systemic RLS/policy test',
    spec: "Report minors, batched: (1) clamp resolvePlan so trialing does not grant Pro/premium unless intended (or gate premium behind active-paid) — entitlements.ts + entitlements.py; (2) fix upsertSubscription COALESCE so a switch to an unrecognized price does NOT preserve the old plan (subscriptions.ts); (3) block creating a second subscription for an already-subscribed customer (checkout route); (4) HMAC (server secret) instead of unsalted SHA-256 for hashEmail (accountDeletion.ts); (5) export marks resume_files_error instead of silently [] on storage error (accountExport.ts); (6) gate refreshCompanyDiscoveryStatus (companies.ts) to admins; (7) add a DB-backed test asserting every user-scoped table has RLS enabled + the expected owner/shared policy set (the systemic guard). Add a checklist note that admin gating assumes Supabase email-confirmation stays ON.",
    files: ['dashboard/lib/entitlements.ts', 'reviewer/entitlements.py', 'dashboard/lib/subscriptions.ts', 'dashboard/app/api/stripe/checkout/route.ts', 'dashboard/lib/accountDeletion.ts', 'dashboard/lib/accountExport.ts', 'dashboard/app/actions/companies.ts', 'tests/'],
    done: 'All listed minors are addressed and a DB-backed test asserts each user-scoped table has RLS + the expected policies; suites green.',
  },
]

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['productionReady', 'closesFinding', 'blockingIssues', 'summary'],
  properties: {
    productionReady: { type: 'boolean' },
    closesFinding: { type: 'boolean' },
    testsPass: { type: 'boolean' },
    blockingIssues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['problem', 'suggestedFix'],
        properties: { file: { type: 'string' }, problem: { type: 'string' }, suggestedFix: { type: 'string' } },
      },
    },
    deferredToSetup: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const base = `Repo root: /Users/andrew/Scripts/job-board, branch go-public-saas (do NOT push, do NOT switch branches). Full findings + rationale: ${REPORT} — READ the relevant finding first. Match existing code style. Tests: dashboard \`cd dashboard && npx tsc --noEmit && npx vitest run\`; python \`TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/poller_test" python3 -m pytest\`. Migrations go under migrations/ and must be idempotent; do NOT apply them to any remote DB (that is a manual step).`

function fixPrompt(fix, priorReview) {
  const redo = priorReview
    ? `\n\nThis is a FIX iteration — the reviewer did NOT accept the previous attempt. Resolve every blocking issue, then re-run the suites:\n${JSON.stringify(priorReview.blockingIssues, null, 2)}`
    : ''
  return `${base}

You are the EXECUTOR fixing finding **${fix.id} — ${fix.title}**.
Read this finding in the report, inspect current state with \`git status\` / \`git diff HEAD\` (HEAD is the prior fix's commit).

What to do:
${fix.spec}

Rules: production-quality, pattern-matching code + tests for the new behavior; run the suites before finishing and do not leave them broken; anything that genuinely needs live infra (Supabase Storage/Data-API config, real Stripe) cannot be done here — implement the code that depends on it and record the manual step, do not fake it. Do NOT commit or push — leave changes in the tree for review.${redo}

Return a concise summary of what you changed (files + why), how it CLOSES ${fix.id}, test results, and any manual/live step it now depends on.`
}

function reviewPrompt(fix, executeSummary) {
  return `${base}

You are the adversarial REVIEWER for the fix to **${fix.id} — ${fix.title}**. Inspect the current-fix changes (\`git diff HEAD\`).

Definition of done (must be TRUE to pass): ${fix.done}

Executor's self-report:
${executeSummary}

You MUST run the suites yourself (dashboard tsc+vitest; python pytest with the TEST_DATABASE_URL above) and set testsPass from what you observe. Then judge closesFinding: does the change ACTUALLY close ${fix.id}'s failure scenario (not merely pass tests)? Be adversarial — try to defeat the fix. productionReady = closesFinding AND testsPass AND no new correctness/isolation defects. Items that legitimately need live infra to verify go in deferredToSetup, and do NOT block productionReady if the code is correct. List concrete blockingIssues (with fixes) otherwise. No style nits.`
}

function commitPrompt(fix, executeSummary) {
  return `${base}

You are the COMMITTER for the fix **${fix.id}**. It passed review. First confirm \`git branch --show-current\` is NOT main/master (STOP and report if it is). \`git add -A\` and make ONE commit: subject like \`fix(saas): <what> [${fix.id}]\`, body summarizing the fix, ending with the line:
  Claude-Session: https://claude.ai/code/session_01CursE6Ez9Nskcr3sFvfdUU
Do NOT push. Context:
${executeSummary}
Return the short commit hash and subject.`
}

// ---- Orchestration ----
log(`remediation args=${JSON.stringify(args)}`) // diagnostic: confirms whether args arrives
const ONLY = args && Array.isArray(args.groups) ? args.groups : null
const SELECTED = ONLY ? FIXES.filter(f => ONLY.includes(f.group)) : FIXES

const results = []
let stoppedEarly = null

for (const fix of SELECTED) {
  let review = null, summary = null, iter = 0
  while (iter < MAX_ITERS) {
    iter++
    log(`${fix.id}: fix #${iter}`)
    summary = await agent(fixPrompt(fix, review), {
      label: `fix:${fix.id}#${iter}`, phase: fix.group,
      model: 'opus', effort: 'high', agentType: 'general-purpose',
    })
    log(`${fix.id}: review #${iter}`)
    review = await agent(reviewPrompt(fix, summary), {
      label: `review:${fix.id}#${iter}`, phase: fix.group,
      model: 'fable', effort: 'high', agentType: 'general-purpose', schema: REVIEW_SCHEMA,
    })
    if (review && review.productionReady) break
    log(`${fix.id}: not closed (${(review && review.blockingIssues || []).length} issue(s)); iterating`)
  }
  if (!review || !review.productionReady) {
    stoppedEarly = { fix: fix.id, blockingIssues: (review && review.blockingIssues) || [] }
    log(`STOPPING: ${fix.id} did not converge in ${MAX_ITERS} iterations; leaving uncommitted for human review`)
    results.push({ id: fix.id, productionReady: false, iterations: iter, review, commit: null })
    break
  }
  const commit = await agent(commitPrompt(fix, summary), {
    label: `commit:${fix.id}`, phase: fix.group,
    model: 'fable', effort: 'low', agentType: 'general-purpose',
  })
  results.push({ id: fix.id, productionReady: true, iterations: iter, summary: review.summary, deferredToSetup: review.deferredToSetup || [], commit })
}

return { results, stoppedEarly }
