# Go-public review findings (3 Fable reviewers)

**Date:** 2026-07-03 · **Branch:** `go-public-saas` (`origin/main..HEAD`)
**Reviewers:** RLS/isolation, billing/caps, deletion/PII — all Fable, adversarial, read-only.
**Bottom line:** tenant **confidentiality is sound**; **cost-integrity and résumé-file isolation are not**. Not safe to open paid signups until the blockers below are closed. Isolation layer itself is shippable.

## Per-commit go / no-go

| Commit | Phase | Verdict |
|---|---|---|
| `3feb0be` | P0 multi-tenant foundation | **Conditional** — isolation sound; ship as a *closed trusted* invite beta ONLY after the résumé-bucket storage policy (B1) is verified/codified. The cap-bypass hole exists here (counters + `daily_review_cap`) but only bites once users have a resolved plan (invited users are comped → in scope). |
| `e711cbd` | P1 billing, RLS, caps | **NO-GO** — the cost-cap bypass BLOCKER and both webhook MAJORs live here. This is the "charge money" commit; do not deploy until B-COST + webhook fixes land. |
| `bebab60` | P2 harden & comply | **NO-GO** — résumé-storage BLOCKER + the deletion/PII MAJORs (resurrection, swallowed storage-delete, post-deletion recreate) live here. |

## Root cause (systemic — read first)
Supabase default privileges grant full `arwdDxt` to `anon`+`authenticated` on every `public` table (confirmed live via `pg_default_acl`), and PostgREST (tables) + the Storage API (files) are exposed to the browser via the public `anon` key + the user's JWT. So **RLS/Storage policies must enforce integrity and immutability, not just tenant isolation** — the app cannot assume it mediates every access. The branch has no `REVOKE` and no codified storage policy.

## Blockers (must fix before charging real users)

**B-COST — Self-serve cost-cap bypass.** `usage_counters` (`owner_access FOR ALL`, migration :104-107) and `profiles.daily_review_cap` (`owner_access FOR ALL`, :74-77) are user-writable via `PATCH/DELETE /rest/v1/…` with a normal user JWT. A user zeroes their counter (resets daily review budget + monthly generation allowance) and/or raises `daily_review_cap`, which the reviewer applies **unclamped** (`reviewer/run.py:305`, `dashboard/lib/reviewRequests.ts:103`). Result: unbounded LLM spend on the operator's OpenRouter balance — the entire margin lever, defeated. Scope: needs a resolved plan (paid or comped/invited); bare signup → plan null → cap 0.
- Fix (all three):
  1. Move cost writes off the `authenticated` role — `usage_counters` increments via `serviceSql` (or a `SECURITY DEFINER` RPC); move `daily_review_cap` to an operator-only table **or** `REVOKE UPDATE (daily_review_cap) ON profiles FROM authenticated`.
  2. Defense-in-depth clamp: `cap = min(daily_review_cap, tier_cap)` in `reviewer/run.py` **and** `reviewRequests.ts` (mirror the discipline `resolve_stage2_model` already uses for the model).
  3. Verify + **enforce** the Supabase Data API posture (disable public-schema exposure, or `REVOKE` the default grants) as a hard pre-deploy gate, not a checklist line. Live probe: `curl https://<proj>.supabase.co/rest/v1/profiles -H "apikey: <anon key>"`.

**B-STORAGE — Résumé-bucket Storage policies not codified.** No `storage.objects` policy for the `resumes` bucket exists in any migration or `schema.sql`; whatever exists lives only in the Supabase dashboard from single-operator days. User-session clients upload/list/sign against it (`onboarding.ts:51`, `profile.ts:27`, `accountExport.ts:58,64`). If it is bucket-wide for `authenticated`, any tenant can `createSignedUrl("<victimUserId>/…pdf")` and download strangers' résumés.
- Fix: codify per-prefix policies as a migration — `USING (bucket_id='resumes' AND (storage.foldername(name))[1] = auth.uid()::text)` for select/insert/update/delete on `authenticated`, nothing for `anon` — and **live-verify** from a second test account that cross-prefix `list`/`createSignedUrl` fails.

## Majors (fix before / immediately around launch)

- **M-TOCTOU** (caps): cap read is a snapshot; the cron reviewer and the on-demand worker on the same user can each select up to `cap` and spend → up to **2× cap**. Fix: per-user advisory lock (`pg_advisory_xact_lock`) or reserve-before-spend across get_spend→select→charge.
- **M-WEBHOOK-ORDER**: `upsertSubscription` unconditionally applies `status`; Stripe doesn't guarantee order, so a stale `subscription.updated` after `deleted` flips canceled→active → unpaid access. Fix: monotonic guard (store event/object timestamp, apply only if newer) or re-`retrieve` in the handler.
- **M-RESURRECT-1**: account deletion cancels Stripe (step 1); the resulting `customer.subscription.deleted` webhook re-INSERTs the `subscriptions` row for the just-erased user (metadata `user_id` survives). Fix: tombstone-check `account_deletions` in the webhook.
- **M-RESURRECT-2**: a deleted user's JWT stays valid ≤1h, and in-flight reviewer runs re-insert rows after purge → recreated PII. `saveProfileResume` gates only on `requireUserId` (no tombstone). Fix: shared `account_deletions` tombstone check in `upsertProfile` + a reviewer re-check before final writes. (Same pattern as M-RESURRECT-1.)
- **M-STORAGE-DELETE**: `deleteStorageObjects` swallows list+remove errors → résumé PDFs can survive a "successful" deletion; also non-recursive (a client-controlled filename with `/` evades it) and unpaginated. Fix: throw on `rmError`, reject/normalize `/` in filenames at upload, paginate; consider a sweep job.
- **M-STRIPE-CUSTOMER**: the Stripe customer (email/name/history) is never deleted and the purge destroys the only mapping to it → can't honor a later erasure-propagation request; retention undisclosed in `/privacy`. Fix: `stripe.customers.del()` or persist `stripe_customer_id` in `account_deletions` + disclose.

## Minors
trialing→full plan (latent; no `trial_period_days` set today) · `COALESCE` keeps old plan on switch to an unrecognized price · no block on a second subscription · unsalted `hashEmail` (use HMAC) · drift-guard scans `schema.sql` only (add an `information_schema` assertion) · export `resume_files` silently `[]` on storage error (add an error marker) · admin gate assumes Supabase email-confirmation stays ON (checklist) · any tenant can trigger the global company-discovery resume (`companies.ts:39`; gate to admin) · narrow `GRANT` lines mislead (add a per-table RLS-enabled+policy-set test).

## Verified solid (the real worries — cleared)
No cross-tenant read/write of PII; `WITH CHECK` blocks `user_id` reassignment; `application_packages` (generated résumés) owner-scoped. anon contained to shared_read. `subscriptions` + `review_requests` user-write-protected (no self-upgrade). `app_user_id()` fails closed; `authenticated`/`anon` NOLOGIN/non-BYPASSRLS. No pooled-connection identity leak (`withUserSql` sets role+claims transaction-locally). serviceSql allowlist legit. Webhook signature verified against raw body; `STRIPE_WEBHOOK_SECRET` required. `resolvePlan` fails closed. T9 charge-only-fulfilled fix correct. No IDOR on delete/export (target from verified claims). Admin gate fails closed. Disposable-email guard runs before invite redemption. Retry convergence for already-canceled/no-sub/auth-404. No internal leakage in error surfaces.

## Remediation order (dependency-aware)
1. **B-STORAGE** — storage policy migration + live cross-account probe (PII; also gates P0 beta).
2. **B-COST** — move cost writes off `authenticated` + clamp `daily_review_cap` to tier + enforce Data API posture.
3. **M-RESURRECT-1 + M-RESURRECT-2** — one shared `account_deletions` tombstone helper across webhook, `upsertProfile`, reviewer.
4. **M-STORAGE-DELETE** — fail-closed deletion + pagination + filename hardening.
5. **M-WEBHOOK-ORDER** — monotonic subscription upsert.
6. **M-TOCTOU** — per-user lock / reserve-before-spend.
7. **M-STRIPE-CUSTOMER** — delete customer / persist id + `/privacy` disclosure.
8. Minors + a systemic guard: blanket `REVOKE` of default grants on user-scoped tables + a test asserting each has RLS + the expected policy set.

## Needs YOU / live infra (code fixes alone don't close these)
- Confirm the Supabase Data API exposure with the live probe above (settles whether B-COST is a today-blocker vs latent).
- Codify + **live-verify** the résumé-bucket storage policies from a second account (B-STORAGE).
- Stripe test-mode: real out-of-order + deletion-race verification (M-WEBHOOK-ORDER, M-RESURRECT-1).
- Ensure Supabase email-confirmation ON + "disable public signups" (minor m4).

## MINORS-GUARD — manual / live steps (code landed; these gate deploy)
- **Set `ACCOUNT_DELETION_HASH_SECRET` in Vercel (all envs).** `hashEmail` now HMACs the
  erasure-ledger email with this secret and **fails closed** (throws) if it is unset —
  account deletion will error until the env is present. Use a long random value; treat it
  as stable (rotating it re-anonymizes past `account_deletions.email_hash` rows, which is
  acceptable for a proof-of-deletion ledger). No remote DB change needed.
- **Admin gating assumes Supabase email-confirmation stays ON.** `isAdmin` (and thus the
  now-admin-gated `refreshCompanyDiscoveryStatus` + `/admin/*`) trusts the **verified JWT
  email**. With email-confirmation OFF a stranger could sign up under an admin's address
  (unverified) and inherit admin. Keep email-confirmation ON as a hard pre-deploy gate;
  re-audit every `isAdmin` call if it is ever turned off.
- **Systemic RLS guard is a test, not live infra.** `test_every_user_scoped_table_has_rls
  _enabled_and_expected_policy_set` (tests/test_rls_isolation.py) runs against the
  throwaway test DB from schema.sql; it needs no remote change, but any NEW user-scoped
  table must be classified in its `EXPECTED_RLS` map (mirroring the migrations) or it
  fails — that is the intended drift alarm.
