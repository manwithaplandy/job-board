# Go-public cutover runbook

**Branch:** `go-public-saas` (code final at `bb8f91f`; `fde0307` adds only this-class docs).
**Status:** all review findings fixed, full 11-migration set rehearsed GO on a Supabase branch, suites green (dashboard 626, python 418). Nothing pushed/deployed yet.
**Audience:** the operator (you). Nothing here deploys by itself.

## The three load-bearing gotchas (read first)
1. **CODE-FIRST.** Migration #1 drops `profiles.is_owner`, which the *currently-deployed* prod code still reads. Deploy the new code BEFORE applying migrations, or the live board 500s. New code doesn't read `is_owner`, so once it's live the drop is safe. (Signup/billing are degraded between deploy and migrations — minutes, and there are no external users yet.)
2. **Migrations apply in DEPENDENCY order, NOT filename/alphabetical order.** `billing-review-requests` sorts before its dependencies but must run after them. Use the exact order in §D.3.
3. **reviewer-worker + poller need a DIRECT / session-mode `DATABASE_URL`** (Supabase port `5432`, not the `6543` transaction pooler). The per-user review advisory lock (M-TOCTOU) silently no-ops on a transaction pooler.

---

## A. External accounts (do first; Stripe in TEST mode first, then repeat live at cutover)
- **Stripe** — create products/prices **Standard $5/mo** and **Pro $20/mo** (copy the two `price_…` ids); copy the **secret key**; add a **webhook endpoint** `https://<domain>/api/stripe/webhook` for events `checkout.session.completed`, `customer.subscription.{created,updated,deleted}` (copy the **signing secret**); **activate the Customer Portal** (enable cancel + update payment; do NOT enable plan-switching). Set branding/support email.
- **Transactional SMTP** (Resend/Postmark/SES) — verify the sending domain (SPF+DKIM DNS), create SMTP creds + a `no-reply@…` sender. (Supabase's built-in mailer only reaches team members — public signup will not work without this.)
- **Slack/Discord incoming webhook** — for the spend-alert (Discord: append `/slack` to the URL).
- Decide the **public domain**; `NEXT_PUBLIC_SITE_URL`, the Stripe webhook URL, and the Supabase Site URL must all use it.

## B. Environment variables (set BEFORE the deploy)
**Vercel** (project `prj_7Z7btXKAhM80SgKkdw35K8UaOUtH`, team `team_2w1ofxlgr52EIaZZXJaItBf6`), Production:
- `STRIPE_SECRET_KEY` (sensitive), `STRIPE_WEBHOOK_SECRET` (sensitive), `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PRO`
- `NEXT_PUBLIC_SITE_URL` (canonical origin, no trailing slash)
- `SUPABASE_SERVICE_ROLE_KEY` (sensitive, **server-only — never `NEXT_PUBLIC_`**; account deletion needs it)
- `ACCOUNT_DELETION_HASH_SECRET` (sensitive; **deletion fails closed until set**; keep stable — rotating re-anonymizes past `account_deletions` rows)
- `NEXT_PUBLIC_SUPPORT_EMAIL`, `ADMIN_EMAILS` (comma-sep; unset = nobody reaches `/admin/*`)
- (existing `DATABASE_URL` via txn pooler, `NEXT_PUBLIC_SUPABASE_*`, `OPENROUTER_API_KEY`, `LANGFUSE_*` stay as-is)

**Railway — NEW service `reviewer-worker`** (from `railway.reviewer-worker.json`, start `python -m reviewer.worker`, always-on, no cron):
`DATABASE_URL` (**direct/session-mode 5432, not 6543**), `OPENROUTER_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST=https://us.cloud.langfuse.com`. Optional: `REVIEW_WORKER_POLL_SECONDS` (15), `REVIEW_CONCURRENCY` (5).

**Railway — NEW service `spend-alert`** (from `railway.spend-alert.json`, `python -m observability.spend_alert`, cron `0 * * * *`):
`DATABASE_URL`, `OPENROUTER_API_KEY`, `ALERT_WEBHOOK_URL`. Optional: `SPEND_ALERT_DAILY_USD` (10), `SPEND_ALERT_CREDITS_FLOOR_USD` (20).

**Railway — existing `poller`** (service `64107603-…`): DELETE stale `REVIEW_MAX_JOBS_PER_RUN`, `REVIEW_MODEL_STAGE1`, `REVIEW_MODEL_STAGE2` (bypassed now). Ensure its `DATABASE_URL` is direct/session-mode. Add `observability/**` to watch patterns.

## C. Supabase Auth config (project `fdhspmavadgucktetzoi`)
- Email provider: enable **Confirm email = ON** (admin gating trusts the verified email; keep it on).
- **Custom SMTP**: host/port/user/pass + sender (from A).
- **Email templates — REQUIRED rewrite** (the `/auth/confirm` route consumes `token_hash`+`type`, which the default `{{ .ConfirmationURL }}` does not produce): set
  - Confirm signup → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
  - Reset password → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password/update`
- URL config: Site URL = `NEXT_PUBLIC_SITE_URL`; add redirect `https://<domain>/auth/confirm`.
- Raise email rate limits; enable leaked-password protection + min length.
- No new DB connection string for RLS — the dashboard stays on `postgres` via the txn pooler and drops to `authenticated`/`anon` per-transaction (`withUserSql`/`withAnonSql`).

## D. Cutover window (quiet window; affects only you)
1. **Merge/deploy:** push `go-public-saas` → `main` → Vercel + Railway auto-deploy the new code. Wait for Vercel READY. (Board works; signup/billing degraded until D.3.)
2. **Create the 2 new Railway services** (reviewer-worker, spend-alert) from their config-as-code files.
3. **Apply the 11 migrations to Supabase prod, IN THIS ORDER** (each self-records into `schema_migrations`, idempotent):
   1. `2026-07-03-multitenant-foundation.sql`  ← destructive (drops `is_owner`)
   2. `2026-07-03-rls-tenant-isolation.sql`
   3. `2026-07-03-billing-review-requests.sql`
   4. `2026-07-04-account-deletions.sql`
   5. `2026-07-04-openrouter-usage-snapshots.sql`
   6. `2026-07-04-tier-settings.sql`
   7. `2026-07-04-resume-bucket-storage-policies.sql`
   8. `2026-07-04-cost-cap-hardening.sql`
   9. `2026-07-04-subscription-event-ordering.sql`
   10. `2026-07-05-app-user-id-search-path.sql`
   11. `2026-07-05-default-privileges-revoke.sql`
4. **Post-apply data steps:**
   - Set the operator profile's `preferred_locations` (the mandatory location filter skips empty-location profiles).
   - Expire the seed invite `UPDATE invite_codes SET expires_at = now() WHERE code='FOUNDER-01';` and mint real codes.
   - Optional tidy: `DROP POLICY resumes_select_own ON storage.objects;` (+ insert/update/delete) — the 4 legacy dashboard policies that duplicate the new `resumes_owner_*` (harmless if left).
   - Run `get_advisors(security)` on prod; expect 0 errors.

## E. Live verification (closes the last-mile findings; needs real creds + a test account)
- **B-COST:** with a real user JWT, `PATCH /rest/v1/usage_counters {"n":0}` and `PATCH /rest/v1/profiles {"daily_review_cap":999}` → must be **401/403**, and the row unchanged.
- **B-STORAGE:** from a 2nd account, `list('<otherUid>')` / `createSignedUrl('<otherUid>/x.pdf')` → **fail**; own prefix works.
- **default-privileges:** `CREATE TABLE public._probe(x int)` as postgres → `has_table_privilege('authenticated','public._probe','SELECT')` = FALSE; drop it.
- **Stripe (test mode):** signup → `/billing` → subscribe with `4242…` → webhook 200 writes `subscriptions` → portal opens → cancel flips status. Negative test: POST garbage to `/api/stripe/webhook` → 400.
- **Account deletion** (throwaway subscribed account): danger-zone delete → Stripe sub canceled + customer deleted, auth user gone, all user rows purged, one `account_deletions` row (hashed email). Verify a stale JWT can't recreate PII (the `assertNotDeleted` guards).
- **Signup/reset e2e** on real SMTP (DKIM/SPF pass); **disposable-email** rejected without burning an invite.
- **On-demand review + cap:** set a low `daily_review_cap`, click "Review now" → exactly N reviewed, 2nd click same day = zero LLM calls; anon → 401, no-plan → 402.
- **RLS cross-tenant:** 2 accounts, A cannot see B's rows (app + direct SQL).
- **Surfaces:** `/terms` + `/privacy` load logged-out; `/admin/tenants` 404s non-admins.

## Open product decisions (not blockers)
- Premium model for Pro is `anthropic/claude-haiku-4.5` (compiled in `entitlements.ts` + `reviewer/entitlements.py` — edit both). Caps/prices are DB-tunable via `tier_settings`.
- Free trial: undecided (`resolvePlan` honors `trialing`; enable via `trial_period_days` if wanted).
- Standard cap 400/day @ $5 (board trails the stale tail) vs ~650/day @ $10 (current) — shipped 400/$5; tunable live via `tier_settings`.
- Live-mode Stripe cutover is a separate pass (recreate products/prices/webhook, swap all 4 `STRIPE_*` values, run one real-card txn + refund).
- Legal copy in `/terms` + `/privacy` shipped as code — have a human review for your jurisdiction/business before charging.
- PITR add-on decision for Supabase backups (daily-only = up to ~24h RPO on résumés + billing).
