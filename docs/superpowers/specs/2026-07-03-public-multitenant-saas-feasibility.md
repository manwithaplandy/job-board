# Feasibility: Going public — self-serve accounts + paid subscriptions

**Date:** 2026-07-03
**Status:** Feasibility spec (not a build commitment)
**Author:** brainstorming session

## Purpose

Assess what it takes to turn this single-operator job tracker into a public,
multi-tenant SaaS where strangers register accounts and pay a subscription.
The goal of this document is an honest map of subsystems, cost, effort, and
sequencing — enough to decide *how far* to take it — not a green-lit build.

## Locked decisions (from brainstorming)

1. **Feasibility-first.** Deliverable is this analysis + a phased path, not a
   full implementation plan.
2. **Shared global job corpus.** Every user sees the same pool (curated targets
   + company-discovery). Personalization is per-user (profile, filters, AI
   reviews, generated résumés). Polling cost does *not* scale with user count.
   Users cannot yet add companies the system doesn't already poll (a future
   "request a company" affordance is out of scope here).
3. **Flat subscription + caps.** Two tiers (Standard $5, Pro $20); bound
   per-user LLM cost with a per-user, per-day review cap rather than a usage
   ledger. Priced at 100% markup on each tier's cost ceiling, rounded up to $5.

## Current architecture (what's already in place)

The app is single-operator today but already has multi-tenant bones:

- **Corpus is global.** `jobs` and `companies` have no `user_id`. As of
  2026-07-03 the pool is **~114,478 open jobs across ~15,864 companies**
  (company-discovery expanded it far beyond the original curated
  `targets.json`), growing **~2,500 jobs/day**.
- **Personalization is already per-user.** `profiles`, `job_reviews`,
  `company_reviews`, `application_packages`, `resume_scores`,
  `review_corrections` are all scoped by `user_id` (mirrors `auth.users(id)`).
- **The reviewer already fans out per profile.** `review_all` →
  `load_profiles(conn)` → `_review_user(conn, profile)` for every profile.
  It is already shaped for multiple users; cost scales linearly with them.
- **Each job is reviewed once per user** at their current `profile_version`
  (`select_candidates` predicate: `r.job_id IS NULL OR r.profile_version <> pv`).
  Steady-state review cost = *new jobs only*.
- **A profile edit re-reviews the whole pool** for that user: editing résumé
  or instructions bumps `profile_version` (`sha256(resume_text || instructions)`),
  and every open, non-denied job becomes re-selectable. This is the dominant
  cost spike (see Economics).
- **Denies are terminal.** A denied job's JD is pruned to NULL and it is never
  re-reviewed, even across profile versions. This caps re-review cost at ~85%
  of the pool.
- **Supabase Auth is wired** for login (`signInWithPassword`, local JWT verify
  via `getClaims`). Anonymous→account board-filter adoption already exists.
  **There is no signup, email-verification, or password-reset flow.**
- **One hard single-tenant chokepoint:** the `one_board_owner` unique index
  forces exactly one profile to be `is_owner = TRUE`.
- **Isolation is app-enforced, not DB-enforced.** Every table is
  `no_anon_access` (RLS denies the anon role) and the dashboard uses the
  Supabase **service role**, filtering `user_id` in query code. There are no
  per-user RLS policies with teeth.
- **No billing, metering, or quotas** exist anywhere.

## Economics (the feasibility crux)

Measured from LangFuse project `cmqvp2hg103h8ad0cjibfrrhw` (30-day window) and
prod DB `fdhspmavadgucktetzoi`. Full tables in the Appendix.

### Two facts that dominate everything

1. **Cost is review, not generation.** Résumé + cover-letter generation is
   **1–3% of per-user cost** in every scenario. Metering "AI generations" — the
   obvious instinct — protects almost no margin.
2. **The current prod model is not the configured one.** All measured traffic
   ran on `deepseek/deepseek-v4-flash` (the code fallback), *not* the
   `claude-haiku-4-5` in `.env.example`. Model choice is a **~14× cost swing**
   and is the single biggest pricing lever.

### Per-user monthly cost

Blended cost per reviewed job = `gate + 0.235 × stage2`
(23.5% of jobs pass the gate and reach stage-2 scoring):

- deepseek-v4-flash (current): **$0.000184/job**
- Haiku 4.5 (configured): **$0.00260/job** (~14×)

At a realistic **"remote + one metro" pool of ~30,000 jobs** per user
(steady-state review of new-in-scope jobs ≈ 19,650/mo + `0.85 × 30,000` per
profile edit + generation):

| Usage profile | deepseek (current) | Haiku 4.5 |
|---|---|---|
| Light — 1 edit, 3 résumés | **$8/mo** | $117/mo |
| Typical — 2 edits, 10 résumés + 10 covers | **$13/mo** | $184/mo |
| Power — 8 edits, 40 résumés + 40 covers | **$41/mo** | $582/mo |

Sensitivity to pool size **P** (Typical user):

| Effective pool P | deepseek | Haiku 4.5 |
|---|---|---|
| 5,000 (narrow metro) | ~$2/mo | ~$28/mo |
| 30,000 (remote + metro) | ~$13/mo | ~$184/mo |
| 114,478 (no location filter) | ~$49/mo | ~$720/mo |

Empirical anchor: the one real user's *actual* recorded 30-day spend was
**~$0.13** — but they have not reached steady state (3,066 of ~30k jobs
reviewed).

### Cost-control levers, in order of power

1. **Require a location filter.** No unfiltered global search. Bounds P from
   114k → ~30k = **3.8× cut**. Cheap to enforce; high leverage.
2. **Model policy.** deepseek vs Haiku on stage-2 is **~14×**. A hybrid — cheap
   gate always, premium stage-2 only when metered/entitled — is the way to buy
   quality without breaking flat pricing.
3. **Throttle profile-edit re-reviews.** Each edit costs `0.85 × P × blended`
   = **$4.69 (deepseek) / $66 (Haiku)** at P=30k. Debounce edits and cap
   included re-reviews per period (e.g. 4/mo, then meter).
4. **(Do not bother capping generation for margin.)** 40 résumés + 40 covers =
   **$0.05 (deepseek) / $0.67 (Haiku)**. Cap it only for abuse, not economics.

### Pricing & tiers (decided)

The cost-control mechanism is a **per-user, per-day cap on jobs entering
review** (see subsystem D). This converts the previously-unbounded product of
*pool size × profile-edit frequency × model price* into a single hard ceiling:

> **max review $/user/month = daily_cap × 30 × blended_cost_per_job**

**A tier is a monthly compute budget.** The daily cap is derived per model as
`budget ÷ (30 × model_cost_per_job)`, so a user can trade quantity for quality
within a tier without moving margin: cheap model → high cap, premium model →
low cap.

**Key consequence:** on the cheap model, review is so cheap ($0.000184/job)
that even ~1,000 reviews/day costs ~$5.50/mo — you cannot make the cheap model
expensive enough to separate tiers on volume alone. **Premium-model access is
the real tier differentiator, not review count.**

**Pricing formula (decided):** `price = ceil(2 × cost_ceiling / 5) × 5`
— 100% markup on the tier's worst-case cost ceiling, rounded up to the nearest
$5. Cost ceiling = `daily_cap × 30 × blended + generation allowance` (i.e. a
user maxing the cap and all generations every day; real usage runs far under).

**Two tiers:**

| | **Standard** | **Pro** |
|---|---|---|
| Model | deepseek (cheap) | Haiku (premium) *or* deepseek |
| Daily review cap | 400/day | 100/day Haiku · 1000/day deepseek |
| Generation/mo | 30 résumé + 30 cover | 100 + 100 |
| Cost ceiling | ~$2.25/mo | ~$9.48/mo |
| **Price** | **$5/mo** | **$20/mo** |
| Markup (post-round) | 122% | 111% |

Open knob: Standard's 400/day is slightly below the ~650/day in-scope inflow,
so a Standard board gradually trails the *oldest* new postings (newest-first
ordering means the hottest leads always get through — only the stale tail is
missed). Raising Standard to ~650/day to fully keep up pushes cost to ~$3.60 →
price rounds to **$10**. So Standard is a choice between **$5-but-trails** and
**$10-but-current**; written as $5 here.

⚠️ **Uncertainty band:** stage1/stage2 cost records show p50=$0 (a cost-capture
gap), giving a **±3.6× band** on the deepseek figures. Instrument real cost
capture before finalizing tier caps/prices. The zero-free ops (`stage1_batch`,
`resume-generation`) match list pricing exactly and are trustworthy. The cap
itself is a hard ceiling regardless of this band — the band only affects how
much *headroom* (extra margin) each tier actually has.

## Subsystem decomposition

Effort: **S** = days, **M** = ~1–2 weeks, **L** = multi-week.

### A. Registration & onboarding — M
- Signup route, email verification, password reset (Supabase Auth supports all).
- **Delete the `one_board_owner` constraint** and the "board owner" concept;
  audit any code that assumes a single owning profile.
- Onboarding wizard: résumé upload → review box (extractor exists), **mandatory
  location filter** (also a cost control), instructions.
- Reuse existing anon→account filter adoption.

### B. Tenant isolation hardening (full RLS) — L
**Decision: full RLS**, not audited-service-role. Given stranger-held résumés,
the DB must refuse cross-tenant access even if app code slips.
- Add per-user RLS policies (`user_id = auth.uid()`) to every user-scoped table.
- **Move user-facing reads off the service role** onto the user's JWT (an
  authenticated Postgres role). This splits the data-access layer in two:
  - **User requests** (dashboard reads/writes) → authenticated role, RLS-enforced.
  - **Backend jobs** (reviewer, pollers, company-discovery) → keep service role
    (they legitimately operate across all users).
- Audit remaining service-role paths for `user_id` predicates as belt-and-braces.
- This is the single biggest line item in the build; hence **L**.

### C. Billing (Stripe) + plan gating — M
- Two tiers: **Standard $5/mo**, **Pro $20/mo** (see Pricing & tiers).
- Stripe Checkout + customer portal + webhook → a `subscriptions` table keyed
  by `user_id` (plan, status, current_period_end).
- Plan → entitlements map: which models are available and the per-model daily
  review cap + monthly generation allowance for that tier.
- Gate premium-model access and enforce caps at the action boundary.
- Stripe covers PCI; no card data touches our systems.

### D. Cost caps — S (critical)
The **per-user, per-day review cap** is the primary lever — a hard ceiling on
cost regardless of pool size, edit frequency, or model. Supporting levers:
- **Per-user, per-model daily review budget.** Replace the global
  `MAX_JOBS_PER_RUN` env var with a per-user cap sourced from the tier's
  entitlement, and add a **daily-spent counter** (reset at midnight) that the
  reviewer decrements so the limit is a rolling daily budget, not a per-run cap.
  `select_candidates` / `_review_user` consume the remaining daily budget.
- **Newest-first draining** (already the default `first_seen_at DESC` order):
  the freshest, hottest-lead jobs always get the budget first; the stale tail
  drains slowly, which is acceptable (a user can only apply to so many/day).
- **Mandatory location filter** at onboarding — bounds the pool and the daily
  inflow (secondary, but high-leverage: 114k → ~30k).
- **Model policy** — cheap gate always; premium stage-2/model by tier entitlement.
- Small per-period counter table (e.g. `usage_counters(user_id, day, kind, n)`);
  OpenRouter spend alert as a backstop.

### E. Legal / compliance — S–M (mostly non-code)
- ToS + privacy policy (storing résumés = PII).
- Data export + account deletion with cascade (user_id is not FK'd to
  `auth.users` today — deletion cascade must be built deliberately).
- Cookie/consent as needed by jurisdiction.

### F. First-run product UX — M
- The app assumes a trusted operator with a populated board. New accounts need
  empty/"your board is being built" states.
- The reviewer runs on cron, so a new user sees **nothing until the next
  cycle**. Add an **on-demand "review my board now"** trigger for first-run
  (bounded by the user's daily review cap and their location filter).
- Error surfaces that don't leak internals; support/contact path.

### G. Ops / abuse — S–M
- Disposable-email guard on signup; per-tenant monitoring; OpenRouter spend
  alerts; backups; incident basics.

## Recommended phased path

- **Phase 0 — prove multi-user (days).** Drop `one_board_owner`; signup +
  onboarding behind invite-only (trusted testers, so app-enforced isolation is
  acceptable for now); per-user daily-cap plumbing (D core); **no billing**.
  Also **fix cost-capture instrumentation** so tier caps/prices rest on real
  numbers. Cheapest way to surface the true unknowns (first-run latency,
  onboarding friction).
- **Phase 1 — chargeable beta.** The point where strangers + money enter, so the
  hard parts land together: **full RLS (B)**, Stripe + two tiers + caps (C/D),
  mandatory location filter, on-demand first-run trigger (F core). Ship to a
  small paid cohort.
- **Phase 2 — harden & scale.** Legal/compliance (E), first-run polish (F),
  abuse/ops (G), tier tuning, and any premium-model quality work.

## Top risks (residual, after the decisions above)

1. **RLS migration correctness** — the service-role → authenticated-role split
   is the highest-stakes change: user reads must run under RLS, backend jobs
   must keep the service role, and no user-facing path may quietly keep the
   service role (that would silently bypass RLS). Test cross-tenant denial
   explicitly.
2. **Cost-capture accuracy** — the daily cap is a hard ceiling, but the ±3.6×
   instrumentation gap means the *headroom* under each tier is uncertain. Fix
   cost capture (Phase 0) before trusting the margin figures.
3. **First-run latency** — cron-only reviewer → new users need the on-demand
   trigger or they see an empty board.
4. **PII liability** — strangers' résumés raise the compliance/security bar
   (drives the full-RLS decision and subsystem E).
5. **Standard-tier UX** — if 400/day trails inflow too visibly, users may feel
   the board is stale; watch backlog growth and revisit the $5-vs-$10 knob.

## Resolved decisions

- **Cost control:** per-user, per-day cap on jobs entering review, sourced from
  the tier entitlement; per-model caps hold cost constant across model choice.
- **Model policy:** cheap gate always; premium model available by tier. The cap
  makes the premium model affordable, so model choice is now a *quality*
  decision, not a cost one. (Remaining: pick which premium model gives review
  quality you're happy with — a taste call, not a blocker.)
- **Tiers:** two — Standard $5/mo, Pro $20/mo (see Pricing & tiers).
- **Pricing:** 100% markup on the tier cost ceiling, rounded up to nearest $5.
- **Isolation:** full RLS (subsystem B).
- **Queue priority under the cap:** newest-first (already the default).

## Remaining open questions

- Standard daily cap: 400/day at $5 (board trails the stale tail) vs 650/day at
  $10 (fully current)? Written as $5.
- Which specific premium model for Pro's stage-2 (quality taste-test).
- Is there a time-limited free trial (freemium was ruled out)?

## Appendix: measured cost data

Source: LangFuse `cmqvp2hg103h8ad0cjibfrrhw` (us cloud), 2026-06-03→07-04;
Supabase prod `fdhspmavadgucktetzoi`.

### Per-operation cost (as run, deepseek-v4-flash)

| Operation | n (30d) | Cost (list-consistent) | Notes |
|---|---|---|---|
| Gate (`stage1_batch`, per job) | ~200 jobs | $0.0000372/job | Clean sample; batched 50/call; only op using prompt caching |
| Stage 2 (`stage2`) | 432 | $0.000626/call | p50=$0 capture gap; list-consistent used |
| Résumé (`resume-generation`) | 43 | $0.000818/call | Clean; matches list pricing exactly |
| Cover letter | 0 | ~$0.0005/call (est.) | No 30d traffic; token-based estimate |
| Company review (`company-screen`) | 35 (mock only) | ~$0.0006/company (est.) | Shared/amortized platform cost, not per-user |

Haiku 4.5 equivalents (from the same measured token counts): gate ~$0.00055/job,
stage2 $0.008724, résumé $0.01084, cover ~$0.006 — roughly 13–15×.

### Volumes / rates (prod DB)

- Open jobs: **114,478** (97.6% with a JD); companies: **15,864**.
- New jobs/day (organic, excl. 06-27 backfill): **~2,500/day** (~75k/mo).
- Gate-pass rate: **23.8%**; stage-2-reach: **23.5%**; deny rate: **15.4%** of
  reviewed (denies pruned, excluded from re-review).
- Effective per-user pool P: remote-only ~27,707; remote + one metro
  ~28k–34k; no location filter 114,478.

### Cost-capture caveat

stage1/stage2 single-call records show p50=$0 (≥50% zero-cost), dragging their
means ~6× below list pricing. The zero-free ops match list pricing exactly, so
list-consistent per-token cost is used for stage2. If the zeros are genuinely
free (promo), true deepseek cost is ~3.6× lower than modeled. Instrument before
trusting the floor.
