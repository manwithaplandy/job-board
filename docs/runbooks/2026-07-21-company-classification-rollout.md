# Global company classification — rollout runbook

Spec: docs/superpowers/specs/2026-07-21-global-company-classification-design.md
Plan: docs/superpowers/plans/2026-07-21-global-company-classification.md

Order is load-bearing. Push-to-main auto-deploys **Vercel** (dashboard) and the
Railway **poller**; the Railway **discovery** worker does **NOT** auto-deploy —
Section 2 covers its manual deploy. The migration — with its `$0` seed from
`company_reviews` and its `human_override` → `company_overrides` copy — must land
on prod **before** the code push, or the deploy goes live against a DB without the
new columns/tables (a board-500 window). Sections 1–2 are the cutover; 3–5 are
post-deploy validation/monitoring; 6 is deferred cleanup.

Prod IDs (deploy-topology memory): Supabase project `fdhspmavadgucktetzoi`
(us-west-1, PG17). Railway project `job-board-poller` = `c9bd4688-5416-4796-a75d-48cd4dc92163`,
service `discovery` = `550af5ec-9b76-4f65-8263-5796caba0f05` (Company Discovery),
service `poller` = `64107603-4072-4d34-80ce-a2bd2f9f2e10`. Live prod domain
`https://jobs.andrewmalvani.com`.

## 1. Apply the migration to prod (before any push)

Apply `migrations/2026-07-21-company-classification.sql` via the Supabase MCP
`apply_migration` on project `fdhspmavadgucktetzoi` (or the SQL editor / psql).
The file is BEGIN/COMMIT-wrapped and fully IF-NOT-EXISTS / ON-CONFLICT guarded,
so it is idempotent — safe to re-run if a partial apply is suspected.

It does four things: adds the global-facts columns + `poll_failures` to
`companies`; creates `classification_jobs` (RLS deny-all, no grants — admin UI
reads/writes via `serviceSql`) and `company_overrides` (owner-scoped RLS +
authenticated CRUD grant); adds `profiles.company_exclusions` (with the
column-level INSERT/UPDATE grants); then **seeds** global classification from the
most-recent successful `company_reviews` row per company (`classification_source
= 'seeded_from_user_review'`, `size`/`hq_country` = `'unknown'`) and copies
`human_override` rows into `company_overrides`.

Verify (expect the seed to have populated the bulk of the corpus):

    SELECT count(*) FROM companies WHERE classification_source = 'seeded_from_user_review';  -- expect ~15.8k
    SELECT count(*) FROM company_overrides;                                                  -- migrated manual overrides
    SELECT count(*) FROM companies WHERE classified_at IS NULL;                              -- the never-reviewed tail

## 2. Merge + push to main (the cutover deploy)

Merge the branch and push. Vercel (dashboard: `/admin/classification`, board
facet filters, profile company-exclusion editor, `/companies` rework) and the
Railway **poller** (active-by-default + dead-board deactivation) deploy on the
push. The Railway **`discovery` worker does NOT auto-deploy on push** — it needs
a manual deploy of the latest `main` commit (see the follow-ups below), or the
always-on classification worker never starts on the new code.

Two Railway follow-ups on the `discovery` service:

- **Convert cron → always-on, then deploy the latest `main` commit.** `railway.discovery.json`
  no longer sets `cronSchedule`; it now runs `python -m company_discovery` with
  `restartPolicyType = ON_FAILURE` (maxRetries 100). Previously the service was a
  weekly cron (`0 6 * * 1`, restart NEVER). Two manual steps are required — push
  alone does neither:
    1. The Railway UI can hold a **server-side cron setting** that
       `railway.discovery.json` does not override — open the `discovery` service
       settings and **remove any cron schedule** so it runs as a persistent
       always-on process, not a scheduled one-shot (memory: stale start-cmd /
       server-side-cron footgun). Removing the cron does **not** by itself start
       a deployment.
    2. **Deploy the latest `main` commit to the `discovery` service.** This
       service does **not** rebuild on push-to-main: its active deployment is
       stale — the current image predates the 2026-06-29 `discovery` →
       `company_discovery` module rename and still carries the old
       `python -m discovery` start command and `0 6 * * 1` cron. Use Railway's
       **Deploy Latest Commit** action (open the `discovery` service → command
       palette (**Cmd/Ctrl+K**) → **Deploy Latest Commit**), which deploys the
       latest commit from the Default branch (`main`). While there, **re-enable
       the service's GitHub auto-deploy trigger if it is disabled** — a disabled
       trigger (`serviceAutoDeployTool` / GitHub trigger `enabled: false`) is
       exactly what silently stalled the reviewer-worker for ~8 days (memory:
       reviewer-worker-crashed), and a disabled trigger is why `discovery` went
       stale in the first place; leaving it off means the *next* push stalls the
       same way.
       - Do **NOT** use Railway's **Redeploy** action or
         `railway redeploy --service discovery` here. Redeploy recreates the
         *existing* (stale) deployment verbatim — same old code, same old
         build/deploy configuration — and because it copies deploy configuration
         it can even reinstate the cron you just removed in step 1. It ships **no
         new code** (this is exactly how the reviewer-worker "recovery" via MCP
         `redeploy` reused a stale snapshot before the real fix).
       - Only if **Deploy Latest Commit** is unavailable, fall back to
         `railway up --service discovery` run from a **freshly-pulled
         `origin/main`** checkout (`git fetch origin && git checkout main &&
         git pull` first) — `railway up` deploys your **local** working tree, so a
         stale local `main` (a known footgun in this repo) would ship old code.
       Without a new-code deploy the always-on worker never picks up the new code,
       so admin-launched `classification_jobs` sit `pending` forever and the
       confirmation below fails.
  After the deploy, confirm the service shows a running (not
  "completed"/exited) deployment and its log tails the queue-poll loop.
- **Set `SERPER_API_KEY`** on the `discovery` service (env var). Optional until a
  SERP-grounded run is wanted — without it, `serp_available()` is false and jobs
  with `use_serp = TRUE` classify from ATS/about data only.
- **Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and
  `LANGFUSE_HOST=https://us.cloud.langfuse.com`** on the `discovery` service.
  Required for the Section 5 `company-classify` LangFuse spot-check to work:
  Python tracing is hard-gated on the keys (`observability/tracing.py`
  `tracing_enabled()` needs **both** `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`;
  `get_langfuse()` returns `None` and `traced_structured_call` runs **untraced**
  when either is absent). The prod `discovery` service historically does **not**
  have these (only the reviewer-worker is traced) — copy the three values from the
  Railway **reviewer-worker** service. `LANGFUSE_HOST` is not optional: project
  `cmqvp2hg103h8ad0cjibfrrhw` lives on the **US** region and the SDK's default host
  is the **EU** cloud, so keys-only (no host) exports to the wrong region and the
  spot-check still shows zero traces (memory: langfuse-us-cloud-region). Leave all
  three unset only if you intend to skip the Section 5 LangFuse spot-check
  entirely — classification itself runs fine untraced.

## 3. Validation runs (from `/admin/classification`)

Launch runs from the admin Classification page on prod
(`https://jobs.andrewmalvani.com/admin/classification`; anon → 307 `/login`, so
sign in as the admin/owner first).

Day-one note: the migration **seeded** nearly the whole corpus from
`company_reviews`, so `selection_mode = 'unclassified'` (matches
`classified_at IS NULL`) only picks up the small never-reviewed tail. The
meaningful backfill mode is **`unknown_repass`** — seeded rows have
`size`/`hq_country` = `'unknown'`, so they all match the repass predicate and get
real facts (headcount bucket, HQ country, refreshed industry/confidence).

Run, in order, and watch the live progress counters (`processed` / `errored`) on
the jobs panel (the panel also shows a static SERP Yes/— column per run);
confirm `serp_queries` advanced after run (b) via the `classification_jobs` SQL
query below (or the `/api/admin/classification-jobs` payload — the panel itself
does not surface a live `serp_queries` counter):

- **(a)** cap **500**, mode **`unknown_repass`**, **SERP off**, model
  **`google/gemini-3.5-flash-lite`** (Flash-Lite, the default) — expect
  `est_cost` ≈ **$0.6**.
- **(b)** cap **200**, mode **`unknown_repass`**, **SERP on**, Flash-Lite — expect
  `est_cost` ≈ **$0.5** (SERP adds a per-company Serper fee + snippet tokens).

Checks:

- **est vs actual.** After each finishes, compare `est_cost` against `actual_cost`
  / `actual_prompt_tokens` / `actual_completion_tokens`. They should be the same
  order of magnitude (the estimate is a coarse spend gate, not billing).
- **cancel path.** Launch a third run and **Cancel it mid-flight** from the panel;
  confirm it stops within one chunk (25 companies) and finishes `status =
  'canceled'` with partial `processed` recorded — no runaway spend.

    SELECT id, model, selection_mode, use_serp, company_cap, status,
           processed, errored, serp_queries,
           est_cost, actual_cost, actual_prompt_tokens, actual_completion_tokens,
           created_at, started_at, finished_at
    FROM classification_jobs ORDER BY created_at DESC LIMIT 10;

## 4. Staged activation of the dormant corpus

Poller Task 15 makes newly-ingested companies `active = TRUE`, but the existing
corpus carries dormant (`active = FALSE`) boards. Reactivate in **~3000-company
batches**, one batch per daily poll run, so poll runtime and DB size grow
gradually:

    UPDATE companies SET active = TRUE
    WHERE active = FALSE AND discovery_source <> 'manual'
      AND id IN (SELECT id FROM companies WHERE active = FALSE ORDER BY id LIMIT 3000);

`discovery_source <> 'manual'` leaves operator-added boards untouched. Repeat at
most **once per daily poll run** — the poller cron is `0 0 * * *` (daily); its
schedule lives in the Railway `poller` service UI, not `railway.json`, so confirm
it there rather than trusting this doc — i.e. one batch per day between the
`poll_runs` checks below, while watching:

    -- Poll runtime + fetch health (a batch that blows up runtime → pause reactivation).
    SELECT id, started_at, finished_at, finished_at - started_at AS runtime,
           companies_ok, companies_failed, new_jobs, closed_jobs
    FROM poll_runs ORDER BY started_at DESC LIMIT 10;

    -- DB size vs the poller's ceiling guard (job_discovery over_size_ceiling / DB_SIZE_CEILING_MB, default 6000).
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

    -- Open-job count (the board's working set).
    SELECT count(*) AS open_jobs FROM jobs WHERE closed_at IS NULL;
    SELECT count(*) FILTER (WHERE active) AS active, count(*) AS total FROM companies;

Note dead boards self-heal the other direction: 5 consecutive failed board
fetches auto-deactivate a non-`seed` company (`poll_failures` /
`record_poll_result`). Continue batches until the whole corpus is active and poll
runtime + DB size stay comfortably under budget.

## 5. Monitoring queries

    -- Classification coverage: share of companies with real (non-seed) facts, and the seed remainder.
    SELECT
      count(*)                                                              AS companies,
      count(*) FILTER (WHERE classified_at IS NOT NULL)                     AS classified,
      count(*) FILTER (WHERE classification_source IN ('job','job_serp'))   AS llm_classified,
      count(*) FILTER (WHERE classification_source = 'seeded_from_user_review') AS still_seed,
      round(100.0 * count(*) FILTER (WHERE classification_source IN ('job','job_serp'))
            / NULLIF(count(*), 0), 1)                                       AS pct_llm_classified
    FROM companies;

    -- Unknown-tail size: rows an `unknown_repass` run would still target
    -- (MUST mirror company_discovery/jobs_db.py _TARGET_MODES['unknown_repass']).
    SELECT count(*) AS unknown_tail
    FROM companies
    WHERE classified_at IS NOT NULL AND (
          COALESCE(size, 'unknown') = 'unknown'
       OR COALESCE(hq_country, 'unknown') = 'unknown'
       OR COALESCE(industry, 'unknown') = 'unknown'
       OR classification_confidence = 'low');

    -- Per-job cost history: estimate accuracy + spend trend over time.
    SELECT id, created_at, finished_at, model, selection_mode, use_serp,
           company_cap, processed, errored, serp_queries,
           est_cost, actual_cost,
           actual_prompt_tokens, actual_completion_tokens
    FROM classification_jobs
    WHERE status IN ('done','canceled','error')
    ORDER BY created_at DESC;

Also spot-check LangFuse: `company-classify` generations should appear for each
processed company during a run (region us.cloud.langfuse.com). **This requires the
`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` env vars set on the
`discovery` service in Section 2** — without them tracing silently no-ops and this
spot-check shows zero traces on a perfectly healthy worker (a false alarm, not a
broken run). If you deliberately left them unset, skip this check and rely on the
`classification_jobs` `processed`/`actual_*` counters above instead.

## 6. Cleanup checklist (LATER — separate branch, after activation is stable)

Once global classification fully replaces the per-user path and no rollback is
foreseen, a follow-up branch + migration removes the legacy surface:

- **DB (new migration):** drop table `company_reviews`; drop columns
  `profiles.company_profile_version`, `profiles.model_company`.
- **Python:** delete `company_discovery/run.py`'s per-user review path,
  `reconcile_active`, `select_for_review`, and `company_discovery/profile.py`.
- **Dashboard:** delete `dashboard/lib/companyProfileVersion.ts`; remove
  `model_company` from `AdvancedAiForm`.

Keep this deferred: `company_reviews` stays read-only legacy until then (its data
already seeded `companies` + `company_overrides`, so nothing live depends on it).

## Rollback

The migration is additive (new columns/tables; the seed only fills previously
NULL classification fields), so reverting the merge commit restores the old
per-user review behavior without touching data — do **not** drop
`company_reviews`, `companies.industry/size/...`, or `company_overrides` on a
revert; the seed/override copies are one-way and would be lost. If the always-on
`discovery` service misbehaves, redeploy it pinned to the pre-merge commit (it
falls back to the weekly cron shape) while the dashboard revert deploys. In-flight
`classification_jobs` rows are safe to leave — a reverted worker simply stops
claiming them; cancel any `running`/`pending` rows via
`UPDATE classification_jobs SET status='canceled' WHERE status IN ('pending','running')`.
