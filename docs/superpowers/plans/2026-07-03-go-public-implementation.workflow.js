// Go-public SaaS implementation — dynamic workflow orchestrator.
//
// Drives the feasibility spec
//   docs/superpowers/specs/2026-07-03-public-multitenant-saas-feasibility.md
// to implementation, phase by phase. Per phase:
//   1. PLAN    — a Fable agent reads the spec + current code, emits a task list.
//   2. EXECUTE — an Opus agent implements the phase in the working tree.
//   3. REVIEW  — a Fable agent adversarially reviews; decides production-ready.
//      EXECUTE⇄REVIEW loop until the reviewer passes it (bounded by MAX_ITERS).
//   4. COMMIT  — a Fable agent commits the phase on the current branch (no push).
// After all phases: a Fable agent emits the manual pre-deploy setup checklist
// (Stripe, Supabase Auth, env vars, migrations, live verification).
//
// Safety: runs on whatever branch is checked out (expected: go-public-saas),
// commits locally, NEVER pushes — so nothing auto-deploys. If a phase fails to
// converge within MAX_ITERS, the workflow stops and reports rather than
// compounding errors into the next phase.
//
// Run:    Workflow({ scriptPath: "docs/superpowers/plans/2026-07-03-go-public-implementation.workflow.js" })
// Resume: Workflow({ scriptPath: "...", resumeFromRunId: "wf_..." })

export const meta = {
  name: 'go-public-implementation',
  description: 'Implement the go-public SaaS spec phase by phase (Fable plans, Opus executes, Fable reviews to production-ready, commit), then emit a pre-deploy setup checklist.',
  phases: [
    { title: 'Phase 0: Multi-tenant foundation', model: 'fable + opus' },
    { title: 'Phase 1: Billing, RLS & cost caps', model: 'fable + opus' },
    { title: 'Phase 2: Harden & comply', model: 'fable + opus' },
    { title: 'Pre-deploy setup checklist', model: 'fable' },
  ],
}

const SPEC = 'docs/superpowers/specs/2026-07-03-public-multitenant-saas-feasibility.md'
const MAX_ITERS = 5

// ---- Phase definitions (scope lifted from the spec) -------------------------

const PHASES = [
  {
    title: 'Phase 0: Multi-tenant foundation',
    slug: 'phase-0',
    goal: 'Make the app genuinely multi-user behind an invite gate, with no billing. Prove multiple real accounts work end-to-end.',
    scope: [
      'Remove the `one_board_owner` unique index and the single "board owner" concept; audit and fix every code path that assumes exactly one owning profile (reviewer, dashboard queries, profile creation).',
      'Signup + email verification + password reset via Supabase Auth. Gate signup behind an invite mechanism (invite code or allowlist) so it is NOT open to the public yet.',
      'Onboarding flow for a brand-new account: résumé upload → the existing review box/extractor, a MANDATORY location filter, and instructions. Creates the user profile row.',
      'Per-user daily review-cap plumbing: replace the global MAX_JOBS_PER_RUN env var with a per-user daily cap (a sane default for now; tier entitlements arrive in Phase 1), plus a daily-spent counter table (reset at midnight) the reviewer decrements so the limit is a rolling daily budget, not a per-run cap. Preserve newest-first (first_seen_at DESC) ordering.',
      'Fix the cost-capture instrumentation gap (stage1/stage2 LangFuse records show p50=$0) so per-operation cost/usage is recorded reliably.',
    ],
  },
  {
    title: 'Phase 1: Billing, RLS & cost caps',
    slug: 'phase-1',
    goal: 'The point where strangers + money enter: full tenant isolation, Stripe subscriptions, and enforced per-tier caps.',
    scope: [
      'Full RLS: add per-user RLS policies (user_id = auth.uid()) to every user-scoped table. Move user-facing dashboard reads/writes OFF the service role onto the user JWT (authenticated Postgres role). Backend jobs (reviewer, pollers, company-discovery) KEEP the service role. Add tests proving cross-tenant reads are denied. No user-facing path may silently retain the service role.',
      'Stripe: Checkout + customer portal + webhook handler → a subscriptions table keyed by user_id (plan, status, current_period_end). Two tiers: Standard $5/mo, Pro $20/mo. A plan→entitlements map: which models are available and the per-model daily review cap + monthly generation allowance per tier.',
      'Wire caps to entitlements: the Phase-0 daily review cap now reads from the tier; enforce the monthly generation allowance; enforce the mandatory location filter. Cheap gate model always; premium model gated by tier.',
      'On-demand "review my board now" trigger for first-run, bounded by the user\'s daily cap and location filter (so a new user is not stuck at an empty board until the next cron cycle).',
    ],
  },
  {
    title: 'Phase 2: Harden & comply',
    slug: 'phase-2',
    goal: 'Production hardening, legal/compliance, and product polish for real paying strangers.',
    scope: [
      'Legal: ToS and privacy-policy pages (résumés = PII). Data export + account deletion with a deliberate cascade (user_id is NOT FK-d to auth.users today, so build the deletion cascade explicitly across all user-scoped tables + archived résumé files).',
      'First-run and empty-state UX polish: "your board is being built" states, error surfaces that do not leak internals, a support/contact path.',
      'Ops/abuse: disposable-email guard on signup, per-tenant monitoring, an OpenRouter spend alert backstop, and backup basics.',
      'Tier tuning hooks: make the tier caps/prices configurable rather than hard-coded so they can be tuned without a redeploy.',
    ],
  },
]

// ---- Schemas ----------------------------------------------------------------

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks', 'risks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'files', 'acceptanceCriteria'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
          migrationNeeded: { type: 'boolean' },
        },
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    testStrategy: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['productionReady', 'blockingIssues', 'summary'],
  properties: {
    productionReady: { type: 'boolean' },
    testsPass: { type: 'boolean' },
    typecheckPass: { type: 'boolean' },
    blockingIssues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'problem', 'suggestedFix'],
        properties: {
          area: { type: 'string' },
          file: { type: 'string' },
          problem: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
    nonBlockingNotes: { type: 'array', items: { type: 'string' } },
    deferredToSetup: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const SETUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['externalAccounts', 'envVars', 'migrations', 'preDeployVerification'],
  properties: {
    externalAccounts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['service', 'steps'],
        properties: {
          service: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    envVars: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'where', 'purpose'],
        properties: {
          name: { type: 'string' },
          where: { type: 'string' },
          purpose: { type: 'string' },
          exampleOrHowToGet: { type: 'string' },
        },
      },
    },
    migrations: { type: 'array', items: { type: 'string' } },
    supabaseAuthConfig: { type: 'array', items: { type: 'string' } },
    preDeployVerification: { type: 'array', items: { type: 'string' } },
    openItems: { type: 'array', items: { type: 'string' } },
  },
}

// ---- Prompt builders --------------------------------------------------------

const baseContext = `You are working in the repo at its root (a Next.js dashboard under dashboard/, Python backend: job_discovery/, reviewer/, company_discovery/; Postgres schema in schema.sql + migrations/; deploys: Vercel + Railway + Supabase). The full design + economics is in ${SPEC} — READ IT FIRST. Match existing code style and patterns. The working branch is go-public-saas; do NOT push and do NOT switch branches.`

function planPrompt(phase) {
  return `${baseContext}

You are the PLANNER for "${phase.title}".
Goal: ${phase.goal}

Scope for this phase:
${phase.scope.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Read the spec and the relevant existing code, then produce a concrete, ordered task list to implement THIS PHASE ONLY (do not pull in later phases). For each task give the files it touches and crisp acceptance criteria a reviewer can check. Flag which tasks need a DB migration. List the real risks and a test strategy (which existing test suites to extend: dashboard vitest, python pytest). Your output is data for the executor — be specific and actionable, not aspirational.`
}

function executePrompt(phase, plan, priorReview) {
  const fixBlock = priorReview
    ? `\n\nThis is a FIX iteration. The reviewer did NOT pass the previous attempt. You MUST resolve every blocking issue below, then re-run tests:\n${JSON.stringify(priorReview.blockingIssues, null, 2)}`
    : ''
  return `${baseContext}

You are the EXECUTOR for "${phase.title}". Implement the plan in the working tree (edit/create files). Inspect current state first with \`git status\` and \`git diff HEAD\` (HEAD is the previous phase's commit, so that diff is this phase's work so far).

Plan to implement:
${JSON.stringify(plan.tasks, null, 2)}

Rules:
- Implement production-quality code that matches existing patterns. Write/extend tests for new behavior.
- Run the relevant test suites and typecheck before you finish; do not leave them broken. Dashboard: \`cd dashboard && npx tsc --noEmit && npx vitest run\`. Python: \`python3 -m pytest\` (DB tests need TEST_DATABASE_URL; skip is acceptable if unavailable — note it).
- Add DB migrations under migrations/ where needed; do NOT apply them to any remote database (that is a manual pre-deploy step).
- Anything that genuinely requires live credentials/external setup (real Stripe keys, prod Supabase Auth config, DNS) cannot be done here — implement the code that USES them and note the manual step; do not fake it or stub it silently.
- Do NOT commit, do NOT push. Leave changes in the working tree for review.${fixBlock}

Return a concise summary of what you changed (files + why), test/typecheck results, and any manual setup your code now depends on.`
}

function reviewPrompt(phase, plan, executeSummary) {
  return `${baseContext}

You are the REVIEWER for "${phase.title}". Be adversarial and rigorous. Review the current-phase work: run \`git diff HEAD\` and \`git status\` to see uncommitted changes (HEAD is the prior phase commit).

Judge against the plan's acceptance criteria:
${JSON.stringify(plan.tasks.map(t => ({ id: t.id, title: t.title, acceptanceCriteria: t.acceptanceCriteria })), null, 2)}

Executor's self-report:
${executeSummary}

You MUST actually run the tests and typecheck yourself (dashboard: \`cd dashboard && npx tsc --noEmit && npx vitest run\`; python: \`python3 -m pytest\`) and set testsPass/typecheckPass from what you observe — do not trust the self-report.

Definition of productionReady for THIS phase: (a) all acceptance criteria met in code; (b) tests + typecheck pass; (c) no correctness, security, or tenant-isolation defects; (d) migrations are valid SQL and idempotent where expected. Work that legitimately requires live credentials/external setup is NOT a blocker — record it under deferredToSetup instead, and still allow productionReady=true if the code that consumes it is correct.

Set productionReady=false and list blockingIssues (each with a concrete suggestedFix) if any real defect remains. Otherwise productionReady=true. Do not rubber-stamp; do not block on taste. Be specific.`
}

function commitPrompt(phase, executeSummary) {
  return `${baseContext}

You are the COMMITTER for "${phase.title}". The phase passed review. Commit its work.
- First confirm you are NOT on main/master (\`git branch --show-current\`); if you somehow are, STOP and report instead of committing.
- Stage all of this phase's changes (\`git add -A\`) and create ONE commit with a clear conventional message summarizing the phase. End the commit message body with the line:
  Claude-Session: https://claude.ai/code/session_01CursE6Ez9Nskcr3sFvfdUU
- Do NOT push.
Context on what was implemented:
${executeSummary}

Return the short commit hash and the commit subject line.`
}

function setupPrompt(committedPhases) {
  return `${baseContext}

You are producing the MANUAL PRE-DEPLOY SETUP CHECKLIST — everything the operator (a human) must do by hand before this can be deployed to production. All code for these phases is now committed: ${committedPhases.map(p => p.title).join('; ')}.

Read the committed diffs (\`git log --oneline\` and \`git show\` the phase commits) and the spec to ground this in what was actually built. Produce an exhaustive, specific checklist covering at least:
- External accounts/services: Stripe (account, two products/prices for $5 Standard and $20 Pro, customer portal config, webhook endpoint + signing secret, test-mode vs live), Supabase Auth (email confirmations on, SMTP/email templates, redirect URLs, the authenticated DB role / connection used for RLS), any others the code introduced.
- Env vars: exact names the code reads (grep for them), where each goes (Vercel / Railway / Supabase / .env), purpose, and how to obtain each.
- Migrations: the exact migration files to apply to Supabase, in order.
- Supabase Auth config steps.
- Pre-deploy VERIFICATION steps that need live creds and thus could not be tested here: e.g. run a real Stripe test-mode checkout end-to-end, verify RLS denies cross-tenant reads on the real DB, trigger an on-demand review, confirm the daily cap enforces.
- Open items / decisions still outstanding (e.g. which premium model for Pro, free-trial? Standard 400 vs 650/day).

Be concrete: real env var names, real file paths, real Stripe/Supabase menu locations. This is the operator's runbook.`
}

// ---- Orchestration ----------------------------------------------------------

// Optionally run a subset of phases: Workflow({ scriptPath, args: { phases: ["phase-0"] } }).
// Default (no args) runs all phases in order.
const ONLY = args && Array.isArray(args.phases) ? args.phases : null
const SELECTED = ONLY ? PHASES.filter(p => ONLY.includes(p.slug)) : PHASES

const results = []
let stoppedEarly = null

for (const ph of SELECTED) {
  phase(ph.title) // group progress under this phase
  log(`Planning ${ph.title}`)
  const plan = await agent(planPrompt(ph), {
    label: `plan:${ph.slug}`, phase: ph.title,
    model: 'fable', effort: 'high', agentType: 'general-purpose', schema: PLAN_SCHEMA,
  })

  let review = null
  let executeSummary = null
  let iter = 0
  while (iter < MAX_ITERS) {
    iter++
    log(`${ph.title}: execute #${iter}`)
    executeSummary = await agent(executePrompt(ph, plan, review), {
      label: `execute:${ph.slug}#${iter}`, phase: ph.title,
      model: 'opus', effort: 'high', agentType: 'general-purpose',
    })
    log(`${ph.title}: review #${iter}`)
    review = await agent(reviewPrompt(ph, plan, executeSummary), {
      label: `review:${ph.slug}#${iter}`, phase: ph.title,
      model: 'fable', effort: 'high', agentType: 'general-purpose', schema: REVIEW_SCHEMA,
    })
    if (review && review.productionReady) {
      log(`${ph.title}: production-ready after ${iter} iteration(s)`)
      break
    }
    log(`${ph.title}: not ready (${(review && review.blockingIssues || []).length} blocking issue(s)); iterating`)
  }

  if (!review || !review.productionReady) {
    stoppedEarly = {
      phase: ph.title,
      reason: `did not reach production-ready within ${MAX_ITERS} iterations`,
      blockingIssues: (review && review.blockingIssues) || [],
    }
    log(`STOPPING: ${ph.title} did not converge; leaving work uncommitted for human review`)
    results.push({ phase: ph.title, productionReady: false, iterations: iter, review, commit: null })
    break
  }

  log(`Committing ${ph.title}`)
  const commit = await agent(commitPrompt(ph, executeSummary), {
    label: `commit:${ph.slug}`, phase: ph.title,
    model: 'fable', effort: 'low', agentType: 'general-purpose',
  })
  results.push({
    phase: ph.title, productionReady: true, iterations: iter,
    reviewSummary: review.summary, deferredToSetup: review.deferredToSetup || [], commit,
  })
}

let setup = null
if (!stoppedEarly) {
  phase('Pre-deploy setup checklist')
  log('Generating manual pre-deploy setup checklist')
  setup = await agent(setupPrompt(results), {
    label: 'setup-checklist', phase: 'Pre-deploy setup checklist',
    model: 'fable', effort: 'high', agentType: 'general-purpose', schema: SETUP_SCHEMA,
  })
}

return { phases: results, stoppedEarly, setup }
