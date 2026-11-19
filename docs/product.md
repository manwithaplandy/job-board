# job-board: product

Status: living spec of the product **as it works on `main`** (checked against code at
`a478659`, 2026-11-19). Architecture, deploy and data flow are in
[`architecture.md`](architecture.md). The June 2026 PRD is archived at
[`archive/job-tracker-prd.md`](archive/job-tracker-prd.md) and no longer describes the product.

Conventions in this doc:
- **(inferred)** means read from code behavior, not from a written decision.
- **(planned)** means not built.
- Production configuration that lives outside the repo (Railway cron settings, Supabase
  auth settings, `lifecycle_control` row values, Stripe portal config) is called out as
  **unverified** where it matters.

## 1. What it is and why

job-board pulls job postings straight from companies' applicant-tracking systems (ATS)
instead of aggregators, scores each one against a user's résumé and preferences with an
LLM, and shows the user a short board of roles worth acting on. For the roles they pick,
it drafts a tailored résumé and cover letter and, for Greenhouse postings, pre-fills the
application answers. It never submits an application.

Why:
- Aggregator boards are low-signal and late; company ATS feeds are first-party and
  structured.
- The goal is a few high-signal, actionable postings, not volume.
- Stated intent (from the owner, not in code): the product is "designed to be deleted".
  Success is the user getting hired and leaving. It is also a portfolio piece.

Deployed at `jobs.andrewmalvani.com`. In-app copy still uses the name "Rolefit" in places
(e.g. "Always uses the Rolefit default" in Advanced AI settings); a rebrand is parked.

## 2. Users and accounts

| Who | What they get |
|---|---|
| Logged-out visitor | A public board at `/` (ISR page `/board`): open jobs whose title contains "engineer", no scores. Filters persist in a 180-day cookie. |
| Invited user with no plan | Account exists but onboarding refuses ("Your account hasn't been invited yet") and LLM routes return 402/403. |
| Comped user (redeemed an invite) | The plan set by `app_settings.invite_comp_plan` (default **Standard**; `none` turns comps off). |
| Subscriber | Standard or Pro via Stripe. |
| Admin | Email listed in `ADMIN_EMAILS` (fail-closed). Admin pages 404 for everyone else. |

### Signup and invites
- **Signup is invite-only** with no setting to open it. The signup form requires an invite
  code, rejects disposable email domains, redeems the code, then creates the Supabase auth
  user. A failed signup releases the code.
- Email confirmation is required (the confirm link goes to `/onboarding`).
- Login is email + password only. No OAuth, magic link or MFA.
- Password reset is neutral-response (does not reveal whether an account exists).
- **Admin-minted codes:** 1-1000 uses, optional expiry, optional custom code, note.
- **User-sent invites:** any user with an effective plan (comped included) gets an
  allowance (default 3, admin-settable 0-1000 globally and per user). Codes are single-use
  and expire after 30 days. Up to 20 addresses per send. Emailing requires AWS SES env
  vars; without them the UI only generates a code to share. The recipient email is
  recorded but not enforced at redemption.
- **Known gap:** Supabase public signups are left enabled by design (`lib/invites.ts`
  comment). Someone can create an auth account directly, bypassing the code. That account
  has no entitlement, so it can't onboard or spend LLM budget. Whether "disable signups"
  was set in Supabase is **unverified**.

### Onboarding
Requires a résumé (paste text, or upload a PDF which is converted to editable markdown
locally) and at least one preferred location. Instructions are optional. On completion
it creates the profile and enqueues the user's first review.

## 3. Plans

Prices are display values in code; the charge is whatever the Stripe price ID is.

| | Standard | Pro |
|---|---|---|
| Price | $5/mo | $20/mo |
| Job reviews per day | 400 on the cheap model slot | 1000 cheap + 100 premium-slot |
| Résumés / cover letters per month | 30 / 30 | 100 / 100 |
| Reasoning effort for résumé/cover generation | off, low | off, low, medium, high |
| Stage-2 review models | Tier-1 models only (DeepSeek V4 Flash, GPT-5.4 nano) | Any model; non-tier-1 models count against the 100/day premium slot |
| Default stage-2 model | `deepseek/deepseek-v4-flash` | `openai/gpt-6-luna` (premium slot) |

- Daily review counters reset at UTC midnight. A per-profile `daily_review_cap` can only
  lower the plan cap.
- Plan resolution order: admin plan override > active/trialing subscription (3-day grace
  past period end; a trialing Pro is clamped to Standard) > invite comp > no plan.
- `past_due` loses entitlement immediately (falls back to comp or nothing). No trials
  are configured.
- Caps and display prices can be overridden per plan in the `tier_settings` table. There
  is **no admin UI** for this; it is SQL-only.

### Model choice today
Users still choose models in **Profile > Advanced AI**:
- Stage-1 review (title/company gate) is fixed to the cheap model.
- Stage-2 review model: user-selectable, tier-gated at save.
- Company review, résumé and cover-letter models: user-selectable from the OpenRouter
  catalog and **not tier-gated** (deliberate per a code comment: generation is a small
  share of cost). Résumé/cover default is `anthropic/claude-haiku-4.5`.
- Prefill model is fixed (`claude-haiku-4.5`, reasoning off).

The "decide models by plan, remove user model choice" change was never merged to `main`
(inferred from code: the Advanced AI form and its save action are still present).

## 4. The board

Signed-in users see jobs the reviewer **approved** for them, plus their own overlays.

- **Views:** All (hides rejected and applied), Applied, Rejected, History (approved,
  corrected or has an application package). There is no "saved" status.
- **Filters** (client-side): search, role category, location, ATS, industry, company size,
  HQ country, work arrangement, minimum fit, pay range (with "include undisclosed"), and
  sort by match, pay, newest or A-Z. Filters persist to the profile (or a cookie when
  logged out).
- **Pages** of 500 rows; jobs past their discovery window are hidden unless "Include older
  live jobs" is checked (window defined in DB lifecycle functions).
- **Manual reject:** sticky deny that the AI won't overwrite; undo from a toast or the
  Rejected view.
- **Mark applied / unapplied.**
- **Review my board now:** enqueues a review request (one active per user). 402 without a
  plan, 409 when today's budget is spent. The panel polls and streams in new matches.
- **Companies page:** browse classified companies (industry, size, country, red flags,
  tech tags), include/exclude per company.
- **Analytics page:** pipeline run series plus the viewer's own review stats. Open to any
  signed-in user.

### When reviews happen
- In the repo, review requests are created only by onboarding and by the user (Review now
  / Resume matching). The always-on reviewer worker drains that queue.
- `lib/schedules.ts` tells users reviews run every 2 hours, but no periodic review exists
  in the repo or in Railway (checked 2026-11-19). New jobs are scored for a user only
  after they (or onboarding) queue a request. See architecture.md §3 and §9.

### Matching inactivity pause
Free, comped and admin-overridden accounts stop being reviewed after 7 days without a
deliberate action (profile/preference edits, corrections, company overrides, reject,
applied changes). Page views and background work don't count. Paid subscriptions are
exempt. The board shows "Matching paused" with a Resume button.

Known gap (inferred): the pause banner and Resume button live inside the Review-now
panel, which only renders when the user has unreviewed jobs.

## 5. Reviews and scoring

Two stages per job (details in architecture.md §3):
1. **Gate:** title, company and location only, batched, cheap model. Rejects are stored.
2. **Full review:** résumé + full description + verified company facts. Produces a verdict,
   sub-scores (skills, experience, comp), a computed fit score, role category, seniority,
   work arrangement, pay, skill gaps, requirements met/unmet, red flags, benefits and
   reasoning.

A job is only re-reviewed if the profile version changed, the review errored, or the fit
score is missing. Users must have at least one preferred location or they are skipped.

**Corrections:** users can correct any reviewed field and the scores; corrections are an
overlay on their own board and never mutate the AI review. Admin corrections also feed a
shared Langfuse golden dataset for evals. Whether user corrections influence future AI
reviews: not found in code.

## 6. Résumé and cover-letter tailoring

- **Source of truth:** the profile's résumé text. Uploaded PDFs are archival only.
- **Inputs:** résumé, profile-level résumé/cover-letter guidance, optional per-job
  instructions (4,000 chars), application details.
- **Résumé:** fixed facts (name, contact, education, titles, dates) are parsed
  deterministically; the LLM writes only the headline focus, summary, skills and bullets.
  Regenerate available; flagged "Outdated" when the profile changes.
- **Cover letter:** greeting, 3-4 paragraphs, closing, signature. Editable.
- **Output:** download as PDF (client-side) or copy text; stored as an application package.
- **Prefill (Greenhouse only):** generates a résumé, then answers the posting's
  application questions from it; EEO answers come straight from the profile, not the LLM.
  Ignores per-job instructions. Other ATSs get an "Apply on {ATS}" link only.
- **Allowance:** monthly résumé/cover counts are reserved before the call. Refunded if the
  call fails before inference; not refunded if the provider already billed it.
- Users can rate a generated résumé 1-5 on grounding and relevance.

## 7. Profile

Hub at `/profile` with sections: Job Preferences (locations, must-haves/deal-breakers,
companies/industries free text, company exclusion filters), Résumé & Experience,
Application Details (contact, links, work authorization, sponsorship, EEO, screening
answers), Application Personalization, Advanced AI, Account & App (theme, billing,
export, delete).

## 8. Feedback, legal, export and deletion

- **Feedback** at `/feedback` (account menu): issue, criticism or feature request; up to
  4,000 chars; 5 per hour, enforced in the database.
- **Privacy and Terms** pages, last updated 2026-07-05.
- **Export:** JSON download of all of the user's rows across ~20 tables (Stripe IDs
  omitted) plus short-lived signed URLs for résumé files.
- **Deletion:** type DELETE or your email. Writes a hashed tombstone, cancels the Stripe
  subscription and deletes the customer, deletes all user rows in one transaction
  (anonymizing run logs), removes résumé files, deletes the auth user. Invite codes the
  user minted survive, anonymized, so codes already sent still work. Langfuse traces and
  provider-side data are not deleted (the privacy page says so).

## 9. Limits

| Limit | Value |
|---|---|
| Résumé text | 50,000 chars |
| Résumé PDF upload | 5 MiB |
| Free-text preferences / guidance | 8,000 chars each |
| Per-job generation instructions | 4,000 chars |
| Preferred locations | 100 |
| Company exclusions | 50 per facet |
| Feedback | 4,000 chars, 5/hour |
| Inactivity pause | 7 days |
| Subscription grace | 3 days |
| User invite codes | 30-day expiry, 20 addresses per send |

No rate limiting on login, signup or password reset in app code (Supabase's own limits
apply; unverified).

## 10. Known gaps and inconsistencies

**Job discovery has been stalled since 2026-10-12** (verified in prod 2026-11-19): the
source path is switched off, so no new postings have been added and closed postings
aren't being detected. See architecture.md §2 and §5.


1. Supabase public signups bypass invite codes at the auth layer (no entitlement results).
2. A Standard subscriber sees an enabled "Subscribe to Pro" button that returns 409;
   upgrades must go through the Stripe portal (portal config unverified).
3. Pause banner/Resume hidden when there are no unreviewed jobs.
4. Advanced AI shows the Standard default as the stage-2 placeholder even for Pro, and
   `openai/gpt-6-luna` isn't in the curated model list.
5. Billing copy says the plan sets "the review model"; in practice it's a Pro gate plus a
   user pick, and résumé/cover models aren't gated at all.
6. Privacy page omits AWS SES (invite email) and says export/delete are "on your profile
   page" (they're at `/profile/account`).
7. `/ui-gallery` (visual-test fixtures) is publicly reachable.
8. User-facing schedules (`lib/schedules.ts`) promise reviews every 2 hours; no periodic
   review runs in production (architecture.md §7, §9).
9. Legacy application packages with unknown inputs can't be re-prepared.
10. Webhook ignores invoice events (`invoice.payment_failed` etc.); entitlement follows
    subscription status only.
