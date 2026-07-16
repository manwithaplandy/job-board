# User-sent invites (SES email + manual codes) — Design

**Date:** 2026-07-13
**Status:** Approved (brainstorming session)
**Approach:** Extend the existing invite-code machinery (approach A)

## Summary

Let signed-in users invite others to Rolefit from the account menu. An "Invite"
item in the avatar dropdown opens a modal where the user can (a) enter email
addresses that each receive a generated single-use code + signup link via AWS
SES, or (b) generate a code manually to share themselves. Both spend from a
per-user invite allowance (default **3**, admin-adjustable). Redeemed invites
comp the plan named by a new admin-editable config setting (initially
**Standard**) — via the *existing* `invite_redemptions` → `resolvePlan` path,
which is reused untouched at its core.

Context: SES production access was granted on the `andrewmalvani.com` domain
identity in `us-west-1`. There is currently **no** email infrastructure in the
app; invite codes exist but are admin-minted only, and `/signup` has no URL
prefill.

## Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Who can invite | Every user with a non-null effective plan (paying **or** comped); invitees can invite onward (viral loop bounded by allowance size) |
| Emailed-code binding | **Open single-use** (`max_uses = 1`); a forwarded code still works — blast radius is one signup either way |
| SES identity | `invites@andrewmalvani.com`, region `us-west-1` |
| Default allowance | **3**, seeded lazily, admin-adjustable per user |
| Comp-plan config | DB settings row (`app_settings`), editable in the admin UI; **not** an env var (avoids Vercel/Railway drift; readable by both TS and Python runtimes) |
| User-code expiry | 30 days (compile-time constant, not config) |

## Data model (one migration)

Modeled on the generation-jobs migration per the new-user_id-table checklist.

1. **`invite_codes`** gains:
   - `created_by UUID` — null = operator/admin-minted (all existing rows remain
     valid); otherwise the inviting user's id.
   - `recipient_email TEXT` — recorded for emailed invites (bookkeeping only;
     redemption does **not** enforce it). Null for manually generated codes.

2. **`invite_allowances`** (new):
   ```sql
   CREATE TABLE invite_allowances (
     user_id    UUID PRIMARY KEY,
     remaining  INT NOT NULL CHECK (remaining >= 0),
     granted    INT NOT NULL,          -- initial grant, for audit/top-up legibility
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```
   - Service-write-only: every write goes through `lib/invites.ts` (already on
     the serviceRoleAllowlist). RLS: deny-all + **owner SELECT** policy +
     authenticated grants (SELECT only), so the modal can show "2 of 3 left"
     under the user's own session.
   - Rows are **lazy-created on first invite action** with the then-current
     default (`INSERT … ON CONFLICT DO NOTHING`). No backfill.

3. **`app_settings`** (new) — generic operator key-value, deliberately separate
   from `tier_settings` (whose PK is CHECK-constrained to plan names):
   ```sql
   CREATE TABLE app_settings (
     key        TEXT PRIMARY KEY,
     value      JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```
   RLS: deny-all + `shared_read` SELECT for anon + authenticated (mirrors
   tier_settings — shared operator policy, values non-secret), so the dashboard
   loader reads via withAnonSql; WRITES are service-role only, through the
   admin-gated `lib/appSettings.ts` (serviceSql-allowlisted). Initial keys:
   - `invite_comp_plan`: `"standard"` — valid values `"standard" | "pro" | "none"`.
     Drives the ONE shared resolvePlan comp path, so changing it affects **all**
     invited users, including Phase-0/FOUNDER invitees (accepted trade-off;
     there is a single notion of "invited").
   - `invite_default_allowance`: `3` — seeds new `invite_allowances` rows.

   Read through a new **`lib/appSettings.ts`** loader following the
   `tierConfig.ts` pattern: compiled defaults, per-key validation, loud
   fallback (console.error + default) on malformed values.

4. **Checklist riders:** `schema.sql` updated; `invite_allowances` added to
   `userScopedTables`, the RLS test trio, `accountExport`, and
   `accountDeletion`. On account deletion: the allowance row is erased; the
   user's **unredeemed** minted codes get `created_by` nulled (NOT deleted), so
   a code already sitting in someone's inbox still redeems.

## Server flow

### Gating

New actions live in `app/actions/userInvites.ts` (`"use server"`). Both
require an authenticated session **and** a non-null effective plan via
`getViewerPlan()` — comped invitees can invite; a direct-API account that
bypassed `/signup` (the documented trust-model hole in `lib/invites.ts`)
cannot mint or send. Privileged SQL stays in `lib/invites.ts` (action/lib
split mirrors `createInviteAction`).

### Minting (`lib/invites.ts`, new `createUserInvite`)

One transaction:
1. Lazy-init allowance row with the current default.
2. `UPDATE invite_allowances SET remaining = remaining - 1, updated_at = now()
   WHERE user_id = … AND remaining > 0 RETURNING …` — the same atomic-guard
   idiom as `redeemInvite`; two racing spends of the last invite cannot both
   pass.
3. Insert the code: generated `RF-XXXX-XXXX`, `max_uses = 1`,
   `expires_at = now() + interval '30 days'`, `created_by`, `recipient_email`.

Zero rows from the UPDATE → "no invites left", nothing minted.

### Email (`lib/inviteEmail.ts`, new)

- `@aws-sdk/client-sesv2`, one `SendEmail` per recipient.
- Plain-text + minimal HTML: who invited you (sender's email), the code
  itself, and a link/button to `{origin}/signup?code=RF-XXXX-XXXX`. Origin is
  derived from `x-forwarded-proto`/`host` request headers (same as
  `app/actions/signup.ts`).
- Env config — **not** the standard `AWS_*` names, which are reserved/
  overwritten on Vercel's Lambda runtime:
  - `SES_REGION` = `us-west-1`
  - `SES_FROM_ADDRESS` = `invites@andrewmalvani.com`
  - `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`
- Missing config → the send action fails legibly ("email sending isn't
  configured") **before** any allowance is spent. Generate-code keeps working.

### Send-emails action

Input: list of addresses (modal caps count at `remaining`). Normalize
(trim/lowercase, dedupe), then per address in order:

1. **Zero-spend pre-checks:** malformed → rejected; disposable domain
   (`isDisposableEmail`, reused from signup) → rejected ("this address would
   be blocked at signup"); already present in `invite_redemptions` → rejected
   ("already a member"). No allowance burned on any of these.
2. Mint (atomic decrement + code insert in one tx).
3. Send via SES. **SES failure → compensate:** delete the just-minted code if
   still unused and increment `remaining` back — an invite is only spent when
   the email actually handed off to SES.

Returns a per-address result list (`sent` / `skipped: reason` / `failed`) plus
the fresh remaining count.

### Generate-code action

Same mint, no recipient and no email; the decrement is immediate and final.
Returns the code and the full signup link for copying.

### Explicitly out of scope (YAGNI)

Refunds for expired unredeemed codes; invite resends/reminders; notifying the
sender on redemption; per-sender rate limiting beyond the allowance itself.

## UI

### Account menu

New "Invite" menuitem in `components/rolefit/AccountMenu.tsx`, between
Billing and Admin, for every signed-in user (`Header` and `SlimHeader` both
render this component). Selecting it closes the menu and opens the modal;
modal state lives in `AccountMenu` (already a client component).

### Invite modal (`components/rolefit/InviteModal.tsx`, new)

Follows `ProfileModal` dialog conventions + Rolefit design tokens. Fetches
remaining count via a small server action on open.

- Header: "Invite someone to Rolefit" + "**2 of 3 invites left**".
- **Email section:** textarea accepting comma/space/newline-separated
  addresses; Send button disabled when empty or count > remaining ("You can
  send 2 more"). After sending: per-address result list (sent ✓ / skipped with
  reason / failed), count refreshed from the response.
- **Manual section** (below a divider): "Generate code" button → shows the
  code + full signup link with the existing `CopyButton` affordance +
  "expires in 30 days".
- **Zero-remaining state:** both controls disabled, "You've used all your
  invites."
- Action errors (including the unreachable-in-practice null-plan case) render
  legibly in the modal.

### Signup prefill

`/signup` reads a `code` search param into the invite-code input's
`defaultValue` (still editable, still required). That IS the invite-link
mechanism — no new route.

### Admin

- `/admin/invites` gains a **Settings card**: comp-plan select
  (Standard/Pro/None) + default-allowance number input, saved by an
  `isAdmin`-gated action writing `app_settings` (re-gate **first**, same as
  `createInviteAction`).
- The codes list gains a **Created by** column (Operator vs. inviter's email)
  and shows `recipient_email` where recorded.
- `/admin/tenants` gains an **Invites left** column with a set-value control
  (admin-gated action writing `invite_allowances.remaining`, and `granted` on
  first grant).

## Reviewer (Python) parity

- `reviewer/entitlements.py` `resolve_plan(sub, invited)` gains a `comp_plan`
  parameter (default `'standard'`; `'none'` → no comp). The reviewer reads
  `app_settings.invite_comp_plan` in the same query/cached path where it
  already determines `invited`.
- TS `resolvePlan` mirrors: comp plan supplied from the `appSettings` loader,
  identical compiled default.
- The parity test (`tests/test_entitlements_parity.py`, regex-extraction over
  `entitlements.ts`) gets the new default constant added so the runtimes
  cannot drift silently.

## Testing

- **DB/unit (vitest, extending `lib/invites.test.ts`):** allowance lazy-init;
  atomic decrement (two racing spends of the last invite → exactly one wins);
  mint-then-compensate refund; `createUserInvite` attribution; `appSettings`
  loader validation fallbacks.
- **Action tests:** gate ordering (unauthenticated / null-plan rejected before
  any DB work); per-address skip reasons; batch cap.
- **Component (jsdom):** modal states (counts, zero-remaining, result list);
  AccountMenu renders the new item; signup prefill from `?code=`.
- **Python:** `resolve_plan` comp-plan variants; parity test update.
- **Live smoke (post-deploy):** send a real invite email to an owned address
  via prod SES; redeem it end-to-end through `/signup?code=…`.

## Rollout

Per the deploy-topology rule (migrations before migration-coupled code):

1. Apply the migration to Supabase (prod).
2. Set `SES_REGION`, `SES_FROM_ADDRESS`, `SES_ACCESS_KEY_ID`,
   `SES_SECRET_ACCESS_KEY` in Vercel.
3. Push to main → auto-deploy (Vercel dashboard + Railway reviewer).
4. Live smoke.

Missing env vars degrade gracefully (generate-code works; email send reports
"not configured"), so steps 2 and 3 are not order-coupled.
