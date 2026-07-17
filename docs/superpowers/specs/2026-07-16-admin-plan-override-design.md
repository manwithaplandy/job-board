# Admin plan override — design

**Date:** 2026-07-16
**Status:** approved (brainstorm with owner; storage approach A chosen).
Rev 2: rebased on origin/main 497bc34 (user-invites merge) — `resolvePlan` now
carries a 4th `compPlan` param, the tenants page already hosts an inline per-row
editor (`AllowanceEditor`), and `invite_allowances` provides the exact RLS
template (deny-all + `owner_read` SELECT + authenticated SELECT grant).

## Problem

The admin tenants page (`/admin/tenants`) shows every user's plan and subscription
but is read-only. The operator has no way to change a user's effective tier —
comp a beta tester to Pro, drop them back to Standard — without either touching
real Stripe billing or deleting their invite. Directly editing `subscriptions.plan`
is off the table: that table is a local mirror of Stripe truth whose sole writer
is the Stripe webhook; a manual edit desyncs from real billing and is clobbered by
the next webhook event.

## Decision summary

- New **`plan_overrides`** table: operator policy, one row per user, service-role
  writes only. Values: `standard` or `pro`; **clearing = deleting the row**. An
  optional `expires_at` lets a comp lapse automatically.
- **Pin semantics** in plan resolution: an *active* override (no expiry, or expiry
  in the future) returns exactly that plan, winning over both the Stripe
  subscription and the invite comp. An expired or absent override changes nothing
  — resolution falls through to today's logic untouched.
- Admin UI: an inline per-row control on `/admin/tenants` (select + optional
  expiry date + optional note + Save) calling an admin-gated server action, the
  same pattern as invite generation.

Out of scope (explicit non-goals): changing real Stripe billing via the Stripe
API; a "None" kill-switch value that blocks access; auto-cleanup of expired
override rows (harmless residue, replaced on next upsert); an audit log.

## Schema

`migrations/2026-07-16-plan-overrides.sql`, house conventions (BEGIN/COMMIT,
`IF NOT EXISTS` idempotency, `schema_migrations` record, mirrored into
`schema.sql` and the test-DB bootstrap; clean twice on a scratch DB):

```sql
CREATE TABLE IF NOT EXISTS plan_overrides (
  user_id    UUID PRIMARY KEY,
  plan       TEXT NOT NULL CHECK (plan IN ('standard','pro')),
  expires_at TIMESTAMPTZ,          -- NULL = until cleared
  note       TEXT,                 -- operator memo ("comped for feedback")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`user_id` is deliberately not FK'd to `auth.users` (house convention, see
`profiles`).

**RLS:** deny-all + an owner **SELECT-only** `owner_read` policy
(`user_id = (SELECT public.app_user_id())`), and `GRANT SELECT` to
`authenticated` — no INSERT/UPDATE/DELETE policies or grants, so the service role
is the only writer. This is exactly the `invite_allowances` pattern: the owner may
see their own override (it already surfaces as their effective plan), and
`getViewerPlan` can read it inside the existing `withUserSql` RLS session without
widening the service-role allowlist for reads.

## Plan resolution (both languages, kept in lockstep)

`dashboard/lib/entitlements.ts` and `reviewer/entitlements.py`:

- `resolvePlan(sub, invited, now?, compPlan?, override?)` / `resolve_plan(sub,
  invited, now=None, comp_plan=…, override=None)`. `override` is
  `{ plan, expires_at }` or null, appended as the LAST parameter so every
  existing call site (which already passes `now`/`compPlan` positionally or by
  keyword) compiles unchanged.
- If `override.plan` is `standard`/`pro` and (`expires_at` is null or
  `expires_at > now`) → return `override.plan`. Otherwise proceed with the
  existing subscription → invite → null logic unchanged.
- The trialing-below-Pro clamp does **not** apply to overrides: a pin is explicit
  operator intent.
- The entitlements **parity test** (`tests/test_entitlements_parity.py`)
  regex-extracts constants only, so it is unaffected; behavioral parity is held by
  mirrored unit tests (below).

Wired at the three existing chokepoints — no new resolution paths:

1. **`getViewerPlan`** (`dashboard/lib/subscriptions.ts`) — every dashboard money
   gate. Adds an override fetch (own row, under `withUserSql` RLS) to the existing
   `Promise.all`.
2. **`getTenantMetrics`** (`dashboard/lib/tenantMetrics.ts`) — admin display.
   `LEFT JOIN plan_overrides` in the aggregate SQL; `TenantMetric` gains
   `overridePlan`, `overrideExpiresAt`, `overrideNote` so the UI can show both the
   effective plan and the pin.
3. **Reviewer** — `reviewer/db.py load_profiles` adds the override columns
   (`ov_plan`, `ov_expires_at`) to its per-user query; `reviewer/run.py` passes
   them to `resolve_plan`. A Pro override on a non-paying, non-invited user makes
   the reviewer serve them at Pro caps — that is the point of the feature.

## Admin write path

Split following the invites precedent (SQL in an allowlisted lib, gate in the
action):

- `dashboard/lib/planOverrides.ts` — `getOwnPlanOverride` (owner-read via
  `withUserSql`, for `getViewerPlan`), `setPlanOverride` (upsert,
  `ON CONFLICT (user_id) DO UPDATE`, refreshing `updated_at`) and
  `clearPlanOverride` (DELETE) via `serviceSql`, with the standard allowlist
  justification header (admin-only, isAdmin-gated, cross-tenant by design — same
  argument as `tenantMetrics`); `lib/serviceRoleAllowlist.test.ts` gets the new
  entry.
- `setPlanOverrideAction` added to the existing
  `dashboard/app/actions/adminSettings.ts` (isAdmin re-gate FIRST, then
  validation, mirroring `setInviteAllowanceAction`). Input: target `userId`,
  `plan` (`"standard" | "pro" | ""` where empty = clear), `expiresAt`
  (`""` or `YYYY-MM-DD`, must be a future date, stored as midnight UTC), `note`
  (`""` → stored NULL, ≤200 chars). The client calls `router.refresh()` on
  success (AllowanceEditor pattern) rather than the action revalidating a path.

## UI (`/admin/tenants`)

- New **Override** column in the tenants table, right after **Plan**. Each row
  renders `components/admin/PlanOverrideControl.tsx` (client component, modeled
  on `AllowanceEditor`): a compact select — *No override / Standard / Pro* — an
  expiry date input and a note input (both shown only when a plan is selected),
  and a Set button that calls the server action, `router.refresh()`es on
  success, and surfaces errors inline. Styling via `rf-control` primitives +
  `.rf-override-editor` classes in `components/secondary-surfaces.css` (the
  ui-contract audit forbids raw controls/inline geometry).
- The **Plan** column keeps showing the *effective* plan (now override-aware via
  `resolvePlan`) and gains a `Pinned` badge — with `until <date>` when expiring,
  and the note as its tooltip. The `Comped` badge is suppressed while a pin is
  active (the plan no longer comes from the invite comp). An expired override
  shows nothing special in Plan; the control simply reflects the stored (lapsed)
  row so the admin can clear or renew it.

## Ripple work (house checklists)

- `lib/userScopedTables.ts`: add `plan_overrides` to `USER_DELETE_TABLES` — the
  deletion cascade picks it up, and `accountExport`'s type-level completeness
  check then forces the matching export query (`SELECT * FROM plan_overrides
  WHERE user_id = …`).
- `schema.sql` + test-DB bootstrap mirror the migration.
- `tests/test_rls_isolation.py`: the standard trio for the new table — owner
  reads own row only, anon reads nothing, authenticated cannot write.

## Testing

- **TS unit** (`entitlements.test.ts`): active override wins over active Pro/
  Standard subscription and over invite; expired override falls through; null
  override preserves every existing case (existing assertions unchanged; their
  call sites gain the new positional parameter).
- **Python unit**: mirrored cases for `resolve_plan`.
- **Server action test**: non-admin rejected; bad plan value rejected; past
  expiry rejected; set upserts; clear deletes.
- **`tenantMetrics` test**: override fields flow through and effective plan
  reflects the pin.
- **Component test** (jsdom) for `PlanOverrideControl`: renders current state,
  submits set and clear, shows action errors.

## Deploy

Apply the migration to Supabase **before** pushing the code (standing
migration-before-deploy gate). No Railway/reviewer env changes — the reviewer
picks the override up from the DB on its next run.
