# User-Sent Invites (SES email + manual codes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users invite others from the avatar menu — emailed invite links via AWS SES or manually generated codes — spending a per-user allowance, with the comped plan and default allowance admin-configurable.

**Architecture:** Extends the existing invite-code machinery (spec `docs/superpowers/specs/2026-07-13-user-invites-design.md`, approach A). User-sent invites mint ordinary single-use `invite_codes` rows that flow through the untouched `redeemInvite` → `invite_redemptions` → `resolvePlan` comp path. New pieces: `invite_allowances` (atomic per-user spend), `app_settings` (admin-tunable comp plan + default allowance, read by BOTH the TS dashboard and the Python reviewer), a thin SES module, an Invite modal, and `/signup?code=` prefill.

**Tech Stack:** Next.js 16 (App Router, server actions), postgres.js, Supabase Postgres (RLS), `@aws-sdk/client-sesv2`, vitest (+ jsdom for components), Python (psycopg) reviewer, pytest.

## Global Constraints

- **Git:** NEVER rewrite existing commits (no amend/rebase/reset/force-push). Fix forward with a new commit. (repo CLAUDE.md)
- **Branch:** all work on `user-invites` (already created; spec committed as bb78a4b).
- **jsonb boundary:** every jsonb read goes through a hand-rolled total parser — never an `as`-cast, never zod. (dashboard/CLAUDE.md)
- **serviceSql allowlist:** any new file importing `serviceSql` from `@/lib/db` MUST be added to `ALLOWLIST` in `dashboard/lib/serviceRoleAllowlist.test.ts` with a justification header comment in the file.
- **SES env names:** `SES_REGION`, `SES_FROM_ADDRESS`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY` — deliberately NOT `AWS_*` (reserved/overwritten on Vercel's Lambda runtime).
- **Config values (spec):** default allowance **3**; comp plan default **"standard"** (valid: `standard|pro|none`); user-code expiry **30 days**; sender `invites@andrewmalvani.com`, region `us-west-1`.
- **Deploy order:** migration applied to Supabase BEFORE pushing migration-coupled code to main (push auto-deploys Vercel + Railway).
- **Test commands:** dashboard: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run <file>` (all: `npm test`; types: `npm run typecheck`). Python: `cd /Users/andrew/Scripts/job-board && python3 -m pytest <file> -q`. DB-backed pytest needs `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test` (local PG on 55432; the suite SKIPS when unset — for Task 1 a skip is NOT a pass, get the DB up; check `docker ps` if the DSN differs).
- **Copy rules (spec):** modal header "Invite someone to Rolefit"; counts as "N of M invites left"; zero state "You've used all your invites."; unconfigured email must fail legibly BEFORE spending an invite.

## File Structure

| File | Responsibility |
|---|---|
| `migrations/2026-07-13-user-invites.sql` (create) | invite_codes attribution cols; invite_allowances; app_settings |
| `schema.sql` (modify) | mirror the migration |
| `dashboard/lib/userScopedTables.ts` (modify) | classify invite_allowances |
| `dashboard/lib/accountExport.ts` / `accountDeletion.ts` (modify) | export/erase allowance row; scrub invite_codes attribution |
| `dashboard/lib/entitlements.ts` (modify) | `DEFAULT_INVITE_COMP_PLAN`, `InviteCompPlan`, resolvePlan compPlan param |
| `dashboard/lib/appSettings.ts` (create) | app_settings loader (total parser, cached) + admin write |
| `dashboard/lib/subscriptions.ts` / `tenantMetrics.ts` (modify) | thread compPlan into resolvePlan |
| `reviewer/entitlements.py` / `db.py` / `run.py` / `worker.py` (modify) | Python mirror + comp-plan read |
| `tests/test_entitlements_parity.py` / `test_entitlements.py` / `test_rls_isolation.py` (modify) | parity + RLS/grant contracts |
| `dashboard/lib/invites.ts` (modify) | allowance view/spend, user minting, refund, admin set, attribution in listInvites |
| `dashboard/lib/inviteEmail.ts` (create) | SES v2 client, invite email build + send |
| `dashboard/app/actions/userInvites.ts` (create) | plan-gated status/send/generate actions |
| `dashboard/app/actions/adminSettings.ts` (create) | isAdmin-gated settings + allowance writes |
| `dashboard/components/rolefit/InviteModal.tsx` (create) | the Invite dialog |
| `dashboard/components/rolefit/AccountMenu.tsx` (modify) | "Invite" menuitem + modal mount |
| `dashboard/app/signup/page.tsx` (modify) | `?code=` prefill |
| `dashboard/components/admin/InviteSettings.tsx` (create) | comp-plan/default-allowance card |
| `dashboard/components/admin/AllowanceEditor.tsx` (create) | per-tenant invites-left editor |
| `dashboard/app/admin/invites/page.tsx` / `admin/tenants/page.tsx` (modify) | settings card, attribution + allowance columns |

---

### Task 1: Migration + schema mirror + PII classification (the whole new-table checklist, one green unit)

`accountExport.ts` has a TYPE-level completeness check and `accountDeletion.test.ts` scans `schema.sql` for `user_id` tables — so schema.sql, `userScopedTables.ts`, the export collector, and the deletion scrub MUST land together or the suite goes red between commits.

**Files:**
- Create: `migrations/2026-07-13-user-invites.sql`
- Modify: `schema.sql` (invite_codes block ~line 342; new tables after `tier_settings` ~line 413)
- Modify: `dashboard/lib/userScopedTables.ts`
- Modify: `dashboard/lib/accountExport.ts` (AccountExport interface + `collectUserRows`)
- Modify: `dashboard/lib/accountDeletion.ts` (`deleteUserRowsTx`)
- Modify: `tests/test_rls_isolation.py` (`EXPECTED_RLS` ~line 425, `EXPECTED_GRANTS` ~line 505)
- Modify: `docs/superpowers/specs/2026-07-13-user-invites-design.md` (spec amendment, step 1)
- Test: `dashboard/lib/accountDeletion.test.ts`, `dashboard/lib/accountExport.test.ts`, `tests/test_rls_isolation.py`

**Interfaces:**
- Produces (later tasks rely on): tables `invite_allowances(user_id UUID PK, remaining INT ≥0, granted INT, created_at, updated_at)` — RLS deny-all + `owner_read` SELECT, GRANT SELECT to authenticated; `app_settings(key TEXT PK, value JSONB, updated_at)` — RLS deny-all + `shared_read` SELECT to anon+authenticated, GRANT SELECT to both; `invite_codes.created_by UUID NULL`, `invite_codes.recipient_email TEXT NULL`.

- [ ] **Step 1: Amend the spec (one deviation), commit forward**

The spec says app_settings is "service-only (no authenticated policies/grants)". Writing it that way would force the READ path onto `serviceSql` and grow the allowlist for a plain operator-config read. `tier_settings` — the precedent the spec itself cites — instead uses a `shared_read` policy (anon + authenticated SELECT) so the loader runs on `withAnonSql`. Follow tier_settings. In `docs/superpowers/specs/2026-07-13-user-invites-design.md`, replace the app_settings line:

```
   Service-only (no authenticated policies/grants). Initial keys:
```

with:

```
   RLS: deny-all + `shared_read` SELECT for anon + authenticated (mirrors
   tier_settings — shared operator policy, values non-secret), so the dashboard
   loader reads via withAnonSql; WRITES are service-role only, through the
   admin-gated `lib/appSettings.ts` (serviceSql-allowlisted). Initial keys:
```

```bash
cd /Users/andrew/Scripts/job-board
git add docs/superpowers/specs/2026-07-13-user-invites-design.md
git commit -m "docs(rolefit): spec amendment — app_settings reads via shared_read like tier_settings"
```

- [ ] **Step 2: Write the migration**

Create `migrations/2026-07-13-user-invites.sql`:

```sql
-- User-sent invites (spec docs/superpowers/specs/2026-07-13-user-invites-design.md).
--
-- invite_codes gains attribution: created_by (NULL = operator/admin-minted — every
-- pre-existing row stays valid) and recipient_email (bookkeeping for emailed invites;
-- redemption does NOT enforce it — codes stay open single-use). The column is named
-- created_by, not user_id, deliberately: the user_id-discovery drift guards
-- (test_rls_isolation / accountDeletion.test) key on `user_id`, and this table's
-- erasure semantics are custom (anonymize, never delete — a code already in someone's
-- inbox must keep redeeming; see dashboard/lib/accountDeletion.ts deleteUserRowsTx).
--
-- invite_allowances: per-user invite budget. Rows are lazy-created on first invite
-- action with the then-current default (app_settings.invite_default_allowance);
-- `granted` records the initial grant for audit/top-up legibility. Service-write-only
-- (all writes in dashboard/lib/invites.ts, the serviceSql-allowlisted file); the owner
-- may only SELECT ("2 of 3 invites left" renders under the user's own session).
-- Correctness of the spend rests on the atomic UPDATE … WHERE remaining > 0 RETURNING
-- guard in lib/invites.ts createUserInvite, same idiom as redeemInvite.
--
-- app_settings: generic operator key-value config (deliberately separate from
-- tier_settings, whose PK is CHECK-constrained to plan names). Same RLS shape as
-- tier_settings: shared operator policy, non-secret → shared_read for anon +
-- authenticated (dashboard reads via withAnonSql; reviewer reads on its privileged
-- conn); ALL writes are service-role (admin-gated lib/appSettings.ts). Unseeded keys
-- mean "use the compiled defaults" (invite_comp_plan='standard',
-- invite_default_allowance=3 — dashboard/lib/appSettings.ts + reviewer/entitlements.py).
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql mirrors it. Applies cleanly twice on a scratch DB.

BEGIN;

ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS recipient_email TEXT;
-- Sender-scoped lookups (deletion scrub, export of "codes I minted").
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by
  ON invite_codes (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS invite_allowances (
  user_id    UUID PRIMARY KEY,
  remaining  INT NOT NULL CHECK (remaining >= 0),
  granted    INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_allowances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON invite_allowances;
CREATE POLICY no_anon_access ON invite_allowances FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_read ON invite_allowances;
CREATE POLICY owner_read ON invite_allowances FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
GRANT SELECT ON invite_allowances TO authenticated;

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON app_settings;
CREATE POLICY no_anon_access ON app_settings FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS shared_read ON app_settings;
CREATE POLICY shared_read ON app_settings FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON app_settings TO anon, authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-13-user-invites.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 3: Mirror into schema.sql**

In `/Users/andrew/Scripts/job-board/schema.sql`:
1. In the `CREATE TABLE invite_codes` block (line ~342), add after `expires_at TIMESTAMPTZ,`:

```sql
  -- NULL = operator/admin-minted. Named created_by (not user_id) deliberately: erasure
  -- is a custom ANONYMIZE (see 2026-07-13-user-invites.sql), not the user_id-loop DELETE.
  created_by      UUID,
  -- Recorded for emailed invites (bookkeeping only — redemption does not enforce it).
  recipient_email TEXT,
```

2. After the `tier_settings` block (line ~413), append the `CREATE INDEX idx_invite_codes_created_by`, `invite_allowances`, and `app_settings` definitions from the migration verbatim (including the RLS policies and GRANTs, with a one-line pointer comment `-- See migrations/2026-07-13-user-invites.sql.` above each).

- [ ] **Step 4: Write the failing TS tests (classification + export + deletion scrub)**

In `dashboard/lib/accountDeletion.test.ts`, add to the existing describe blocks (match the file's mock harness — it records `tx.unsafe(sql, params)` calls; read the file's existing "deletes every USER_DELETE_TABLES row" test at ~line 190 and model these on it):

```ts
test("scrubs invite_codes attribution both directions (sender + recipient), never deletes codes", async () => {
  await deleteUserRowsTx("00000000-0000-0000-0000-000000000001", "gone@example.com");
  const sqls = unsafeCalls().map((c) => c.sql.replace(/\s+/g, " "));
  // Sender direction: codes this user minted are anonymized, not deleted.
  expect(sqls.some((s) =>
    s.includes("UPDATE invite_codes SET created_by = NULL, recipient_email = NULL") &&
    s.includes("created_by = $1"),
  )).toBe(true);
  // Recipient direction: codes OTHERS minted for this email drop the address.
  expect(sqls.some((s) =>
    s.includes("UPDATE invite_codes SET recipient_email = NULL") &&
    s.includes("lower(recipient_email)"),
  )).toBe(true);
  // No DELETE ever touches invite_codes.
  expect(sqls.some((s) => s.includes("DELETE FROM invite_codes"))).toBe(false);
});
```

(`unsafeCalls()` = whatever accessor the file already uses for recorded `tx.unsafe` calls; reuse it.)

No new export test needed: `accountExport.test.ts:83` ("includes a top-level key for every classified user-scoped table") starts failing the moment `invite_allowances` joins `USER_DELETE_TABLES` and passes once the collector + interface exist — that's the failing test for the export half.

- [ ] **Step 5: Run to verify failures**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/accountDeletion.test.ts lib/accountExport.test.ts`
Expected: new scrub test FAILS (no such UPDATE recorded). Export completeness still passes (classification not yet added — that flips in step 6).

- [ ] **Step 6: Implement classification, export, deletion**

`dashboard/lib/userScopedTables.ts` — add to `USER_DELETE_TABLES` after `"generation_jobs"`:

```ts
  // Per-user invite budget (user-sent invites). The codes a user MINTED are handled
  // separately in accountDeletion.ts (anonymized, never deleted).
  "invite_allowances",
```

`dashboard/lib/accountExport.ts`:
1. Add to the `AccountExport` interface (wherever the other table keys sit): `invite_allowances: unknown;`
2. In `collectUserRows`, add to the destructure + `Promise.all` + return:

```ts
      // owner_read RLS grants this SELECT under withUserSql
      tx`SELECT remaining, granted, created_at, updated_at
         FROM invite_allowances WHERE user_id = ${userId}::uuid`,
```

```ts
      invite_allowances: (inviteAllowances[0] as unknown) ?? null,
```

`dashboard/lib/accountDeletion.ts` — in `deleteUserRowsTx`, after the `invite_redemptions` delete (line ~120):

```ts
    // User-minted invite codes: ANONYMIZE, never delete — a code already in someone's
    // inbox must keep redeeming. Two directions: codes this user minted (drop the
    // sender link AND the recipient address together), and codes OTHERS minted for
    // this user's email (drop just the address).
    await tx.unsafe(
      `UPDATE invite_codes SET created_by = NULL, recipient_email = NULL
       WHERE created_by = $1::uuid`,
      [userId],
    );
    await tx.unsafe(
      `UPDATE invite_codes SET recipient_email = NULL
       WHERE $1::text IS NOT NULL AND lower(recipient_email) = lower($1)`,
      [email],
    );
```

- [ ] **Step 7: Run TS tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/accountDeletion.test.ts lib/accountExport.test.ts && npm run typecheck`
Expected: PASS (completeness check now sees the `invite_allowances` key; scrub assertions pass; the type-level check in accountExport.ts:52 compiles).

- [ ] **Step 8: Update the Python RLS/grant contracts**

`tests/test_rls_isolation.py`:

In `EXPECTED_RLS` (after the `review_runs` entry):

```python
    # Per-user invite budget (2026-07-13-user-invites): owner may READ their count;
    # all writes are service-role (dashboard/lib/invites.ts atomic spend).
    "invite_allowances": {
        "no_anon_access": _DENY,
        "owner_read": ("SELECT", frozenset({"authenticated"})),
    },
```

In `EXPECTED_GRANTS` (after `job_questions`):

```python
    "invite_allowances":    (_R(), _R({"SELECT"})),           # owner reads own count
    "app_settings":         (_R({"SELECT"}), _R({"SELECT"})), # shared_read like tier_settings
```

- [ ] **Step 9: Run the DB-backed contract tests**

Run: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_rls_isolation.py -q`
Expected: PASS (conftest rebuilds the schema from schema.sql each run, so the new tables + policies are discovered). A SKIP means the DB isn't up — fix that, don't proceed on a skip.

- [ ] **Step 10: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add migrations/2026-07-13-user-invites.sql schema.sql \
  dashboard/lib/userScopedTables.ts dashboard/lib/accountExport.ts \
  dashboard/lib/accountDeletion.ts dashboard/lib/accountDeletion.test.ts \
  tests/test_rls_isolation.py
git commit -m "feat(invites): user-invite schema — attribution cols, invite_allowances, app_settings + PII classification"
```

---

### Task 2: Comp-plan config, TS side — entitlements + appSettings loader + threading

**Files:**
- Modify: `dashboard/lib/entitlements.ts` (~line 160, the `if (invited)` branch)
- Create: `dashboard/lib/appSettings.ts`
- Modify: `dashboard/lib/subscriptions.ts` (`getViewerPlan`, ~line 46)
- Modify: `dashboard/lib/tenantMetrics.ts` (`getTenantMetrics`, ~line 104)
- Modify: `dashboard/lib/serviceRoleAllowlist.test.ts` (`ALLOWLIST`, ~line 16)
- Test: `dashboard/lib/entitlements.test.ts` (append), `dashboard/lib/appSettings.test.ts` (create)

**Interfaces:**
- Consumes: `withAnonSql`, `serviceSql` from `@/lib/db`; Task 1's `app_settings` table.
- Produces: `entitlements.ts`: `export type InviteCompPlan = Plan | "none"`, `export const DEFAULT_INVITE_COMP_PLAN = "standard";`, `resolvePlan(sub, invited, now?: Date, compPlan?: InviteCompPlan): Plan | null`. `appSettings.ts`: `interface AppSettings { inviteCompPlan: InviteCompPlan; inviteDefaultAllowance: number }`, `defaultAppSettings(): AppSettings`, `overlayAppSettings(rows: {key: string; value: unknown}[]): AppSettings`, `loadAppSettings(): Promise<AppSettings>` (cached 60s, degrades to defaults), `saveAppSetting(key: "invite_comp_plan" | "invite_default_allowance", value: string | number): Promise<void>` (serviceSql; admin actions only).

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/lib/entitlements.test.ts`:

```ts
describe("resolvePlan comp plan (invite comp config)", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  test("invited + default comp → standard (unchanged behavior)", () => {
    expect(resolvePlan(null, true, now)).toBe("standard");
  });
  test("invited + compPlan pro → pro", () => {
    expect(resolvePlan(null, true, now, "pro")).toBe("pro");
  });
  test("invited + compPlan none → null (comping switched off)", () => {
    expect(resolvePlan(null, true, now, "none")).toBeNull();
  });
  test("a paying subscription still wins over the comp plan", () => {
    const sub = { plan: "pro", status: "active", current_period_end: new Date("2026-08-01") };
    expect(resolvePlan(sub, true, now, "none")).toBe("pro");
  });
  test("not invited → compPlan irrelevant, null", () => {
    expect(resolvePlan(null, false, now, "pro")).toBeNull();
  });
});
```

Create `dashboard/lib/appSettings.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

// Mock the db module BEFORE importing appSettings — loadAppSettings/saveAppSetting
// touch withAnonSql/serviceSql; overlay tests are pure and never reach them.
vi.mock("@/lib/db", () => ({
  withAnonSql: vi.fn(),
  serviceSql: Object.assign(() => Promise.resolve([]), { begin: vi.fn() }),
}));

import { defaultAppSettings, overlayAppSettings } from "@/lib/appSettings";

describe("overlayAppSettings (total parser — dashboard/CLAUDE.md jsonb discipline)", () => {
  test("empty rows → compiled defaults (standard / 3)", () => {
    expect(overlayAppSettings([])).toEqual({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 });
  });
  test("valid rows override both keys", () => {
    const s = overlayAppSettings([
      { key: "invite_comp_plan", value: "pro" },
      { key: "invite_default_allowance", value: 10 },
    ]);
    expect(s).toEqual({ inviteCompPlan: "pro", inviteDefaultAllowance: 10 });
  });
  test("'none' is a valid comp plan (comping off)", () => {
    expect(overlayAppSettings([{ key: "invite_comp_plan", value: "none" }]).inviteCompPlan).toBe("none");
  });
  test("a DOUBLE-ENCODED jsonb string scalar is unwrapped one level", () => {
    // postgres.js returns a double-encoded write as the JS string '"pro"'.
    expect(overlayAppSettings([{ key: "invite_comp_plan", value: '"pro"' }]).inviteCompPlan).toBe("pro");
  });
  test("garbage values keep the default field-by-field", () => {
    const s = overlayAppSettings([
      { key: "invite_comp_plan", value: "platinum" },
      { key: "invite_default_allowance", value: -2 },
    ]);
    expect(s).toEqual(defaultAppSettings());
  });
  test("allowance rejects floats/strings/negatives, accepts 0 (invites off)", () => {
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 2.5 }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: "5" }]).inviteDefaultAllowance).toBe(3);
    expect(overlayAppSettings([{ key: "invite_default_allowance", value: 0 }]).inviteDefaultAllowance).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/entitlements.test.ts lib/appSettings.test.ts`
Expected: FAIL — resolvePlan rejects a 4th argument's expectations (`"pro"` case returns `"standard"`), and `@/lib/appSettings` doesn't exist.

- [ ] **Step 3: Implement entitlements.ts changes**

In `dashboard/lib/entitlements.ts`, below the `PLAN_LABEL` constant add:

```ts
// ── Invite comp plan (user-sent invites, spec 2026-07-13) ────────────────────
// What an invited-but-not-paying user is comped. DB-overridable via
// app_settings.invite_comp_plan (lib/appSettings.ts); this compiled constant is the
// fallback AND the parity-guarded default — tests/test_entitlements_parity.py
// regex-extracts it and asserts equality with reviewer/entitlements.py, so keep the
// bare `export const NAME = "value";` shape.
export type InviteCompPlan = Plan | "none";
export const DEFAULT_INVITE_COMP_PLAN = "standard";
```

Change `resolvePlan`'s signature and invited branch (line ~136):

```ts
export function resolvePlan(
  sub: SubscriptionLike | null,
  invited: boolean,
  now: Date = new Date(),
  compPlan: InviteCompPlan = DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
): Plan | null {
```

and replace `if (invited) return "standard";` with:

```ts
  // Comped plan is operator-configurable (app_settings.invite_comp_plan); "none"
  // switches comping off entirely — invited users then need a real subscription.
  if (invited && compPlan !== "none") return compPlan;
```

Also update the doc comment's second bullet to say "comped at the configured comp plan (default Standard)".

- [ ] **Step 4: Implement lib/appSettings.ts**

```ts
// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// app_settings is service-write-only (shared_read SELECT for reads, no authenticated
// write policy — mirrors tier_settings). saveAppSetting is the ONE write path and is
// called ONLY from isAdmin-gated actions (app/actions/adminSettings.ts). Reads go
// through withAnonSql (shared_read), NOT serviceSql.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { serviceSql, withAnonSql } from "@/lib/db";
import { DEFAULT_INVITE_COMP_PLAN, type InviteCompPlan } from "@/lib/entitlements";

// Operator app config (user-sent invites, spec 2026-07-13). Same pattern as
// lib/tierConfig.ts: compiled defaults + a DB overlay read through a HAND-ROLLED
// TOTAL PARSER (dashboard/CLAUDE.md jsonb discipline) — a bad/absent value keeps the
// default for THAT key and logs; the loader never throws to a page/route.

const CACHE_TTL_SECONDS = 60;

export interface AppSettings {
  inviteCompPlan: InviteCompPlan;
  inviteDefaultAllowance: number;
}

export function defaultAppSettings(): AppSettings {
  return {
    inviteCompPlan: DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
    inviteDefaultAllowance: 3,
  };
}

/** Unwrap one level of a double-encoded jsonb string scalar (mirrors tierConfig.ts). */
function unwrap(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // a plain string value ("standard") is not JSON — keep it as-is
  }
}

function parseCompPlan(raw: unknown): InviteCompPlan {
  const v = unwrap(raw);
  if (v === "standard" || v === "pro" || v === "none") return v;
  console.error("appSettings: invite_comp_plan invalid; keeping default", raw);
  return defaultAppSettings().inviteCompPlan;
}

/** A non-negative integer allowance (0 = user invites off). */
function parseDefaultAllowance(raw: unknown): number {
  const v = unwrap(raw);
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1000) return v;
  console.error("appSettings: invite_default_allowance invalid; keeping default", raw);
  return defaultAppSettings().inviteDefaultAllowance;
}

/** Overlay raw app_settings rows onto the compiled defaults, key-by-key. */
export function overlayAppSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const out = defaultAppSettings();
  for (const r of rows) {
    if (r.key === "invite_comp_plan") out.inviteCompPlan = parseCompPlan(r.value);
    else if (r.key === "invite_default_allowance") out.inviteDefaultAllowance = parseDefaultAllowance(r.value);
  }
  return out;
}

async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const rows = await withAnonSql(async (tx) => {
      const r = await tx`
        SELECT key, value FROM app_settings
        WHERE key IN ('invite_comp_plan', 'invite_default_allowance')
      `;
      return r as unknown as { key: string; value: unknown }[];
    });
    return overlayAppSettings(rows);
  } catch (e) {
    // A read failure must never take a gated page down — degrade to defaults.
    console.error("appSettings: failed to load app_settings; using compiled defaults", e);
    return defaultAppSettings();
  }
}

const _cached = unstable_cache(fetchAppSettings, ["app-settings"], {
  revalidate: CACHE_TTL_SECONDS,
});

/** The DB-overlaid operator settings, cached ~60s. Degrades to compiled defaults. */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    return await _cached();
  } catch {
    // Outside a Next request context (unit tests, scripts) unstable_cache throws.
    return fetchAppSettings();
  }
}

/**
 * Upsert one operator setting. Callers MUST be isAdmin-gated (the table has no
 * authenticated write policy by design — this is the serviceSql escape hatch).
 * The value is stored as a jsonb scalar; overlayAppSettings re-validates on read.
 */
export async function saveAppSetting(
  key: "invite_comp_plan" | "invite_default_allowance",
  value: string | number,
): Promise<void> {
  await serviceSql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
```

- [ ] **Step 5: Thread compPlan through the two resolvePlan callers**

`dashboard/lib/subscriptions.ts` — add `import { loadAppSettings } from "@/lib/appSettings";` and change `getViewerPlan`:

```ts
export async function getViewerPlan(userId: string, email: string | null): Promise<Plan | null> {
  const [sub, invited, settings] = await Promise.all([
    getSubscription(userId),
    email ? isInvitedUser(email) : Promise.resolve(false),
    loadAppSettings(),
  ]);
  return resolvePlan(sub, invited, new Date(), settings.inviteCompPlan);
}
```

`dashboard/lib/tenantMetrics.ts` — add the same import; in `getTenantMetrics`, before the map: `const settings = await loadAppSettings();` and pass it:

```ts
    const plan = resolvePlan(
      { plan: r.plan, status: r.status, current_period_end: r.current_period_end },
      r.invited,
      new Date(),
      settings.inviteCompPlan,
    );
```

- [ ] **Step 6: Allowlist the new serviceSql importer**

In `dashboard/lib/serviceRoleAllowlist.test.ts` `ALLOWLIST`, add (keep the array sorted):

```ts
  "lib/appSettings.ts", // admin-gated app_settings writes (operator config); reads go through withAnonSql
```

- [ ] **Step 7: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/entitlements.test.ts lib/appSettings.test.ts lib/serviceRoleAllowlist.test.ts lib/subscriptions.test.ts lib/tenantMetrics.test.ts && npm run typecheck`
Expected: PASS. If subscriptions/tenantMetrics tests fail on the new `loadAppSettings` import, add `vi.mock("@/lib/appSettings", () => ({ loadAppSettings: async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 }) }))` to those test files — behavior under the default is unchanged by design.

- [ ] **Step 8: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/lib/entitlements.ts dashboard/lib/appSettings.ts \
  dashboard/lib/appSettings.test.ts dashboard/lib/entitlements.test.ts \
  dashboard/lib/subscriptions.ts dashboard/lib/tenantMetrics.ts \
  dashboard/lib/serviceRoleAllowlist.test.ts
git commit -m "feat(invites): DB-configurable invite comp plan — appSettings loader + resolvePlan threading (TS)"
```

---

### Task 3: Comp-plan config, Python mirror + parity

**Files:**
- Modify: `reviewer/entitlements.py` (below `_TRIAL_GRANTS_FULL_PLAN`, and `resolve_plan` ~line 90)
- Modify: `reviewer/db.py` (below `load_tier_settings`, ~line 70)
- Modify: `reviewer/run.py` (`_review_user` def ~line 286, resolve_plan call ~line 321, run loop ~line 458)
- Modify: `reviewer/worker.py` (line 67)
- Test: `tests/test_entitlements.py` (append), `tests/test_entitlements_parity.py` (append)

**Interfaces:**
- Consumes: TS `DEFAULT_INVITE_COMP_PLAN` constant shape from Task 2 (parity regex).
- Produces: `entitlements.DEFAULT_INVITE_COMP_PLAN = "standard"`; `entitlements.parse_comp_plan(v) -> str`; `resolve_plan(sub, invited, now=None, comp_plan=DEFAULT_INVITE_COMP_PLAN)`; `db.load_invite_comp_plan(conn) -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_entitlements.py` (match its existing imports/style):

```python
def test_resolve_plan_comp_plan_variants():
    from reviewer.entitlements import resolve_plan
    # Default: invited -> standard (unchanged Phase-0 behavior).
    assert resolve_plan(None, True) == "standard"
    # Operator-configured comp plans.
    assert resolve_plan(None, True, comp_plan="pro") == "pro"
    assert resolve_plan(None, True, comp_plan="none") is None
    # A live subscription still wins over comp config.
    from datetime import datetime, timedelta, timezone
    sub = {"plan": "pro", "status": "active",
           "current_period_end": datetime.now(timezone.utc) + timedelta(days=10)}
    assert resolve_plan(sub, True, comp_plan="none") == "pro"
    # Not invited: comp plan is irrelevant.
    assert resolve_plan(None, False, comp_plan="pro") is None


def test_parse_comp_plan_total():
    from reviewer.entitlements import parse_comp_plan, DEFAULT_INVITE_COMP_PLAN
    assert parse_comp_plan("pro") == "pro"
    assert parse_comp_plan("none") == "none"
    # Absent row / malformed writes all degrade to the compiled default.
    for bad in (None, "", "platinum", 3, {"x": 1}, True):
        assert parse_comp_plan(bad) == DEFAULT_INVITE_COMP_PLAN
```

Append to `tests/test_entitlements_parity.py`:

```python
def test_invite_comp_plan_default_parity():
    """The invite-comp default must match across runtimes: a drift would comp invited
    users on the dashboard but skip them in the reviewer (or vice versa)."""
    text = _TS.read_text()
    assert _const("DEFAULT_INVITE_COMP_PLAN", text) == py_ent.DEFAULT_INVITE_COMP_PLAN
```

- [ ] **Step 2: Run to verify failures**

Run: `cd /Users/andrew/Scripts/job-board && python3 -m pytest tests/test_entitlements.py tests/test_entitlements_parity.py -q`
Expected: FAIL — `resolve_plan() got an unexpected keyword argument 'comp_plan'`, `ImportError: parse_comp_plan`, `AttributeError: DEFAULT_INVITE_COMP_PLAN`.

- [ ] **Step 3: Implement the Python mirror**

`reviewer/entitlements.py` — below `_TRIAL_GRANTS_FULL_PLAN` add:

```python
# Invite comp plan (user-sent invites, spec 2026-07-13). Mirrors
# DEFAULT_INVITE_COMP_PLAN in entitlements.ts (parity-guarded). DB-overridable via
# app_settings.invite_comp_plan (db.load_invite_comp_plan, read once per run).
DEFAULT_INVITE_COMP_PLAN = "standard"


def parse_comp_plan(v):
    """The invite comp plan from an app_settings jsonb value: 'standard' | 'pro' |
    'none'. Anything else (absent row, malformed write) -> the compiled default.
    Mirrors lib/appSettings.ts parseCompPlan."""
    if isinstance(v, str) and v in ("standard", "pro", "none"):
        return v
    return DEFAULT_INVITE_COMP_PLAN
```

Change `resolve_plan`'s signature to `def resolve_plan(sub, invited, now=None, comp_plan=DEFAULT_INVITE_COMP_PLAN):`, update its docstring bullet to `- else invited (comped beta) -> comp_plan ('none' disables comping)`, and replace the invited branch:

```python
    if invited and comp_plan in ("standard", "pro"):
        return comp_plan
    return None
```

`reviewer/db.py` — after `load_tier_settings`:

```python
def load_invite_comp_plan(conn) -> str:
    """app_settings.invite_comp_plan, read once per run (same lifecycle as
    load_tier_settings) and threaded into resolve_plan, so an operator's comp-plan
    change is honored on the next run with no redeploy. Degrades to the compiled
    default on any read failure."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_settings WHERE key = 'invite_comp_plan'")
            row = cur.fetchone()
    except Exception:
        conn.rollback()
        return _entitlements.DEFAULT_INVITE_COMP_PLAN
    return _entitlements.parse_comp_plan(row["value"] if row else None)
```

`reviewer/run.py`:
- `_review_user` signature (line ~286): `def _review_user(conn, profile: dict, ent: dict | None = None, comp_plan: str = entitlements.DEFAULT_INVITE_COMP_PLAN) -> None:`
- resolve_plan call (line ~321): `plan = entitlements.resolve_plan(sub, bool(profile.get("invited")), comp_plan=comp_plan)`
- run loop (line ~458): after `ent = db.load_tier_settings(conn)` add `comp_plan = db.load_invite_comp_plan(conn)`, and change the loop call to `_review_user(conn, profile, ent, comp_plan)`.

`reviewer/worker.py` line 67:

```python
        run._review_user(conn, profile, db.load_tier_settings(conn), db.load_invite_comp_plan(conn))
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/andrew/Scripts/job-board && python3 -m pytest tests/test_entitlements.py tests/test_entitlements_parity.py -q`
Expected: PASS. Also run the reviewer's own suite guard: `python3 -m pytest tests/ -q -k "reviewer or entitle or worker"` — expected: no new failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add reviewer/entitlements.py reviewer/db.py reviewer/run.py reviewer/worker.py \
  tests/test_entitlements.py tests/test_entitlements_parity.py
git commit -m "feat(invites): mirror configurable comp plan in Python reviewer + parity guard"
```

---

### Task 4: lib/invites.ts — allowance spend, user minting, refund, admin set, attribution

**Files:**
- Modify: `dashboard/lib/invites.ts`
- Test: `dashboard/lib/invites.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; existing `generateInviteCode`, `toInviteCode`, `serviceSql`; `withUserSql` from `@/lib/db`.
- Produces (Tasks 6/9/10 rely on):
  - `export const USER_INVITE_EXPIRY_DAYS = 30;`
  - `getInviteAllowance(userId: string, defaultAllowance: number): Promise<{ remaining: number; granted: number }>` — read-only view; a missing row reports the default (no row created).
  - `createUserInvite(userId: string, opts: { defaultAllowance: number; recipientEmail?: string | null }): Promise<{ ok: true; invite: InviteCode } | { ok: false; reason: "exhausted" | "error" }>`
  - `releaseUserInvite(code: string, userId: string): Promise<void>` — compensation; never throws.
  - `setInviteAllowance(userId: string, remaining: number): Promise<void>` — admin upsert.
  - `InviteCode` gains `createdBy: string | null; recipientEmail: string | null; creatorEmail: string | null`; `listInvites()` returns them; `listInvitesCreatedBy(userId: string): Promise<InviteCode[]>` for the account export.

- [ ] **Step 1: Extend the test file's db mock, write failing tests**

In `dashboard/lib/invites.test.ts`, the `vi.mock("@/lib/db", …)` factory currently returns `{ serviceSql: sql }`. Change its return to also cover the owner-read path:

```ts
  return { serviceSql: sql, withUserSql: async (_uid: string, cb: (tx: unknown) => unknown) => cb(sql) };
```

Append test blocks:

```ts
describe("createUserInvite", () => {
  test("lazy-inits the allowance, decrements atomically, mints an attributed 30-day code", async () => {
    stage(
      [],                       // INSERT … ON CONFLICT DO NOTHING (lazy-init)
      [{ remaining: 2 }],       // UPDATE … remaining - 1 … RETURNING
      [{ code: "RF-AAAA-2222", note: null, max_uses: 1, uses: 0,
         expires_at: new Date("2026-08-12"), created_at: new Date() }],
    );
    const r = await createUserInvite("u-1", { defaultAllowance: 3, recipientEmail: "friend@x.com" });
    expect(r.ok).toBe(true);
    const t = text();
    // The atomic-spend guard is in the SQL, not JS.
    expect(t).toContain("remaining > 0");
    expect(t).toContain("on conflict (user_id) do nothing");
    // Attribution + bounded lifetime ride on the insert.
    expect(t).toContain("created_by");
    expect(t).toContain("recipient_email");
    expect(t).toContain("make_interval");
    expect(calls.some((c) => c.values.includes("friend@x.com"))).toBe(true);
  });

  test("zero-row decrement → exhausted, and NO code insert happens", async () => {
    stage([], []); // lazy-init, then UPDATE matches nothing
    const r = await createUserInvite("u-1", { defaultAllowance: 3 });
    expect(r).toEqual({ ok: false, reason: "exhausted" });
    expect(text()).not.toContain("insert into invite_codes");
  });

  test("a 23505 code collision retries with a fresh code (allowance untouched by rollback)", async () => {
    const dup = Object.assign(new Error("dup"), { code: "23505" });
    stage(
      [], [{ remaining: 2 }], dup,                       // attempt 1: insert collides → tx rolls back
      [], [{ remaining: 2 }],                            // attempt 2 succeeds
      [{ code: "RF-BBBB-3333", note: null, max_uses: 1, uses: 0, expires_at: null, created_at: new Date() }],
    );
    const r = await createUserInvite("u-1", { defaultAllowance: 3 });
    expect(r.ok).toBe(true);
  });
});

describe("releaseUserInvite", () => {
  test("deletes an UNUSED own code and refunds the allowance", async () => {
    stage([{ code: "RF-AAAA-2222" }], []); // DELETE returned a row → UPDATE refund
    await releaseUserInvite("RF-AAAA-2222", "u-1");
    const t = text();
    expect(t).toContain("uses = 0");            // only an unredeemed code is refundable
    expect(t).toContain("created_by");          // only the minter's own code
    expect(t).toContain("remaining = remaining + 1");
  });
  test("a redeemed/foreign code deletes nothing and refunds nothing", async () => {
    stage([]); // DELETE matched no rows
    await releaseUserInvite("RF-AAAA-2222", "u-2");
    expect(text()).not.toContain("remaining = remaining + 1");
  });
});

describe("getInviteAllowance", () => {
  test("existing row wins", async () => {
    stage([{ remaining: 1, granted: 3 }]);
    expect(await getInviteAllowance("u-1", 5)).toEqual({ remaining: 1, granted: 3 });
  });
  test("no row → the configured default, WITHOUT creating a row", async () => {
    stage([]);
    expect(await getInviteAllowance("u-1", 5)).toEqual({ remaining: 5, granted: 5 });
    expect(text()).not.toContain("insert");
  });
});

describe("setInviteAllowance", () => {
  test("upserts remaining; granted only seeds on first insert", async () => {
    stage([]);
    await setInviteAllowance("u-1", 7);
    const t = text();
    expect(t).toContain("on conflict (user_id) do update");
    expect(t).toContain("remaining = excluded.remaining");
    // granted is NOT overwritten on update (audit value keeps the initial grant).
    expect(t).not.toContain("granted = excluded.granted");
  });
});

describe("listInvites attribution", () => {
  test("selects created_by/recipient_email and joins the creator's profile email", async () => {
    stage([]);
    await listInvites();
    const t = text();
    expect(t).toContain("created_by");
    expect(t).toContain("recipient_email");
    expect(t).toContain("left join profiles");
  });
});
```

Add the new names to the existing import from `@/lib/invites`.

- [ ] **Step 2: Run to verify failures**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/invites.test.ts`
Expected: FAIL — the new exports don't exist.

- [ ] **Step 3: Implement in lib/invites.ts**

Add `withUserSql` to the db import: `import { serviceSql, withUserSql } from "@/lib/db";`

Extend the row/typing plumbing — `InviteCode` gains three fields, `InviteRow` gains the columns, `toInviteCode` maps them:

```ts
export type InviteCode = {
  code: string;
  note: string | null;
  maxUses: number;
  uses: number;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string | null;       // null = operator/admin-minted
  recipientEmail: string | null;  // recorded for emailed invites (not enforced)
  creatorEmail: string | null;    // joined from profiles for the admin list; null elsewhere
};

type InviteRow = {
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  expires_at: Date | null;
  created_at: Date;
  created_by?: string | null;
  recipient_email?: string | null;
  creator_email?: string | null;
};

const toInviteCode = (r: InviteRow): InviteCode => ({
  code: r.code,
  note: r.note,
  maxUses: r.max_uses,
  uses: r.uses,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  createdBy: r.created_by ?? null,
  recipientEmail: r.recipient_email ?? null,
  creatorEmail: r.creator_email ?? null,
});
```

Append the new section at the end of the file:

```ts
// ── User-sent invites (spec 2026-07-13) ─────────────────────────────────────
// Same serviceSql justification as the header: invite_codes and the
// invite_allowances WRITE path have no authenticated policy by design; correctness
// of the spend rests on the atomic UPDATE … WHERE remaining > 0 RETURNING guard,
// the same idiom as redeemInvite. Callers (app/actions/userInvites.ts) gate on an
// authenticated session + non-null effective plan BEFORE reaching this file.

export const USER_INVITE_EXPIRY_DAYS = 30;

export type InviteAllowance = { remaining: number; granted: number };

/**
 * Read-only allowance view. A user with no row yet sees the CURRENT configured
 * default (rows are lazy-created at first spend, not at first look, so raising the
 * default later benefits users who never opened the modal). Owner-read RLS applies.
 */
export async function getInviteAllowance(
  userId: string,
  defaultAllowance: number,
): Promise<InviteAllowance> {
  const rows = await withUserSql(userId, async (tx) => {
    const r = await tx`
      SELECT remaining, granted FROM invite_allowances WHERE user_id = ${userId}::uuid
    `;
    return r as unknown as { remaining: number; granted: number }[];
  });
  if (rows.length > 0) return { remaining: rows[0].remaining, granted: rows[0].granted };
  return { remaining: defaultAllowance, granted: defaultAllowance };
}

export type UserInviteResult =
  | { ok: true; invite: InviteCode }
  | { ok: false; reason: "exhausted" | "error" };

/**
 * Spend one invite and mint an attributed single-use code, in ONE transaction:
 *   1. lazy-init the allowance row with the configured default (ON CONFLICT DO NOTHING);
 *   2. UPDATE … SET remaining = remaining - 1 WHERE remaining > 0 RETURNING — the
 *      atomic guard: two racing spends of the last invite cannot both pass;
 *   3. INSERT the code (max_uses 1, USER_INVITE_EXPIRY_DAYS lifetime, created_by,
 *      recipient_email).
 * A 23505 on the code PK (astronomically rare) rolls the whole tx back — allowance
 * untouched — and retries with a fresh code, mirroring createInvite.
 */
export async function createUserInvite(
  userId: string,
  opts: { defaultAllowance: number; recipientEmail?: string | null },
): Promise<UserInviteResult> {
  try {
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
      const code = generateInviteCode();
      try {
        const row = await serviceSql.begin(async (tx) => {
          await tx`
            INSERT INTO invite_allowances (user_id, remaining, granted)
            VALUES (${userId}::uuid, ${opts.defaultAllowance}, ${opts.defaultAllowance})
            ON CONFLICT (user_id) DO NOTHING
          `;
          const dec = await tx`
            UPDATE invite_allowances
            SET remaining = remaining - 1, updated_at = now()
            WHERE user_id = ${userId}::uuid AND remaining > 0
            RETURNING remaining
          `;
          if (dec.length === 0) return null;
          const rows = await tx`
            INSERT INTO invite_codes (code, note, max_uses, expires_at, created_by, recipient_email)
            VALUES (${code}, NULL, 1, now() + make_interval(days => ${USER_INVITE_EXPIRY_DAYS}),
                    ${userId}::uuid, ${opts.recipientEmail ?? null})
            RETURNING code, note, max_uses, uses, expires_at, created_at, created_by, recipient_email
          `;
          return rows[0];
        });
        if (row === null) return { ok: false, reason: "exhausted" };
        return { ok: true, invite: toInviteCode(row as unknown as InviteRow) };
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
        // code collision — tx rolled back (spend undone); regenerate and retry
      }
    }
    throw new Error(`Couldn't generate a unique invite code after ${MAX_GENERATION_ATTEMPTS} attempts.`);
  } catch (err) {
    console.error("createUserInvite failed", err);
    return { ok: false, reason: "error" };
  }
}

/**
 * Compensation when the email send that followed a mint fails: delete the code IF it
 * is still unused and belongs to this minter, and refund the spend. An invite is only
 * "spent" once the email actually handed off to SES. Never throws (mirrors releaseInvite).
 */
export async function releaseUserInvite(code: string, userId: string): Promise<void> {
  try {
    await serviceSql.begin(async (tx) => {
      const del = await tx`
        DELETE FROM invite_codes
        WHERE code = ${code} AND created_by = ${userId}::uuid AND uses = 0
        RETURNING code
      `;
      if (del.length > 0) {
        await tx`
          UPDATE invite_allowances
          SET remaining = remaining + 1, updated_at = now()
          WHERE user_id = ${userId}::uuid
        `;
      }
    });
  } catch (err) {
    console.error("releaseUserInvite failed", err);
  }
}

/**
 * Admin top-up/claw-back (must be called ONLY from isAdmin-gated actions). Sets
 * `remaining` outright; `granted` seeds on first insert and is never overwritten —
 * it stays the audit record of the initial grant.
 */
export async function setInviteAllowance(userId: string, remaining: number): Promise<void> {
  await serviceSql`
    INSERT INTO invite_allowances (user_id, remaining, granted)
    VALUES (${userId}::uuid, ${remaining}, ${remaining})
    ON CONFLICT (user_id) DO UPDATE SET remaining = EXCLUDED.remaining, updated_at = now()
  `;
}

/** The codes a user minted (account export). Attribution columns, no profile join. */
export async function listInvitesCreatedBy(userId: string): Promise<InviteCode[]> {
  const rows = (await serviceSql`
    SELECT code, note, max_uses, uses, expires_at, created_at, created_by, recipient_email
    FROM invite_codes
    WHERE created_by = ${userId}::uuid
    ORDER BY created_at DESC
  `) as unknown as InviteRow[];
  return rows.map(toInviteCode);
}
```

Update `listInvites`'s query (keep LIMIT and ordering):

```ts
  const rows = (await serviceSql`
    SELECT ic.code, ic.note, ic.max_uses, ic.uses, ic.expires_at, ic.created_at,
           ic.created_by, ic.recipient_email, p.email AS creator_email
    FROM invite_codes ic
    LEFT JOIN profiles p ON p.user_id = ic.created_by
    ORDER BY ic.created_at DESC
    LIMIT 1000
  `) as unknown as InviteRow[];
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/invites.test.ts && npm run typecheck`
Expected: PASS (including all pre-existing invites tests — `toInviteCode`'s new fields are optional-safe).

- [ ] **Step 5: Wire the export of minted codes (Task 1 left the hook open)**

In `dashboard/lib/accountExport.ts`: add `created_invite_codes: unknown[];` to `AccountExport`, import `listInvitesCreatedBy` from `@/lib/invites`, add a guarded collector next to `collectInviteRedemptions`:

```ts
/** Codes this user minted (service-role read via lib/invites; guarded like redemptions). */
async function collectCreatedInviteCodes(userId: string): Promise<unknown[]> {
  try {
    return await listInvitesCreatedBy(userId);
  } catch (e) {
    console.error("account export: created invite codes could not be listed", e);
    return [];
  }
}
```

and in `buildAccountExport`, add `collectCreatedInviteCodes(userId)` to the `Promise.all` and `created_invite_codes: createdCodes,` to the returned object.

Run: `npx vitest run lib/accountExport.test.ts` — expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/lib/invites.ts dashboard/lib/invites.test.ts dashboard/lib/accountExport.ts
git commit -m "feat(invites): allowance spend + user minting + refund + admin set in lib/invites"
```

---

### Task 5: SES email module

**Files:**
- Modify: `dashboard/package.json` (dependency)
- Create: `dashboard/lib/inviteEmail.ts`
- Test: `dashboard/lib/inviteEmail.test.ts` (create)

**Interfaces:**
- Produces (Task 6 relies on): `sesConfig(): SesConfig | null` (null when any of the four `SES_*` env vars is missing); `sendInviteEmail(params: { to: string; code: string; link: string; inviterEmail: string | null }): Promise<{ ok: true } | { ok: false; error: "not_configured" | "send_failed" }>`; `buildInviteEmail(params: { code: string; link: string; inviterEmail: string | null }): { subject: string; text: string; html: string }` (exported for tests).

- [ ] **Step 1: Add the dependency**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npm install @aws-sdk/client-sesv2`
Expected: package.json + package-lock.json updated, no peer warnings that break install.

- [ ] **Step 2: Write the failing tests**

Create `dashboard/lib/inviteEmail.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Capture SendEmailCommand inputs without any AWS traffic.
const sends: unknown[] = [];
let failNext = false;
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    async send(cmd: { input: unknown }) {
      if (failNext) throw new Error("ses down");
      sends.push(cmd.input);
      return {};
    }
  },
  SendEmailCommand: class {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  },
}));

import { buildInviteEmail, sendInviteEmail, sesConfig } from "@/lib/inviteEmail";

const ENV = ["SES_REGION", "SES_FROM_ADDRESS", "SES_ACCESS_KEY_ID", "SES_SECRET_ACCESS_KEY"] as const;

beforeEach(() => {
  sends.length = 0;
  failNext = false;
  vi.stubEnv("SES_REGION", "us-west-1");
  vi.stubEnv("SES_FROM_ADDRESS", "invites@andrewmalvani.com");
  vi.stubEnv("SES_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("sesConfig", () => {
  test("all four env vars present → config", () => {
    expect(sesConfig()).toEqual({
      region: "us-west-1",
      from: "invites@andrewmalvani.com",
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
    });
  });
  for (const k of ENV) {
    test(`missing ${k} → null (send path must fail legibly, never half-configured)`, () => {
      vi.stubEnv(k, "");
      expect(sesConfig()).toBeNull();
    });
  }
});

describe("buildInviteEmail", () => {
  test("contains the code, the link, and the inviter", () => {
    const m = buildInviteEmail({
      code: "RF-AAAA-2222",
      link: "https://rolefit.app/signup?code=RF-AAAA-2222",
      inviterEmail: "andrew@example.com",
    });
    expect(m.subject).toContain("Rolefit");
    for (const body of [m.text, m.html]) {
      expect(body).toContain("RF-AAAA-2222");
      expect(body).toContain("https://rolefit.app/signup?code=RF-AAAA-2222");
      expect(body).toContain("andrew@example.com");
      expect(body).toContain("30 days");
    }
  });
  test("HTML-escapes a hostile inviter email", () => {
    const m = buildInviteEmail({
      code: "RF-AAAA-2222", link: "https://x/signup",
      inviterEmail: `<img src=x onerror=alert(1)>@x.com`,
    });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
  });
  test("null inviter falls back to neutral copy", () => {
    const m = buildInviteEmail({ code: "C", link: "L", inviterEmail: null });
    expect(m.text).toContain("You've been invited");
  });
});

describe("sendInviteEmail", () => {
  test("sends via SES with the configured from-address", async () => {
    const r = await sendInviteEmail({
      to: "friend@example.com", code: "RF-AAAA-2222",
      link: "https://rolefit.app/signup?code=RF-AAAA-2222", inviterEmail: "a@b.com",
    });
    expect(r).toEqual({ ok: true });
    expect(sends).toHaveLength(1);
    const input = sends[0] as {
      FromEmailAddress: string;
      Destination: { ToAddresses: string[] };
    };
    expect(input.FromEmailAddress).toBe("invites@andrewmalvani.com");
    expect(input.Destination.ToAddresses).toEqual(["friend@example.com"]);
  });
  test("unconfigured env → not_configured, zero SES traffic", async () => {
    vi.stubEnv("SES_REGION", "");
    const r = await sendInviteEmail({ to: "x@y.com", code: "C", link: "L", inviterEmail: null });
    expect(r).toEqual({ ok: false, error: "not_configured" });
    expect(sends).toHaveLength(0);
  });
  test("an SES throw → send_failed (caller refunds the invite)", async () => {
    failNext = true;
    const r = await sendInviteEmail({ to: "x@y.com", code: "C", link: "L", inviterEmail: null });
    expect(r).toEqual({ ok: false, error: "send_failed" });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/inviteEmail.test.ts`
Expected: FAIL — `@/lib/inviteEmail` doesn't exist.

- [ ] **Step 4: Implement lib/inviteEmail.ts**

```ts
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { USER_INVITE_EXPIRY_DAYS } from "@/lib/invites";

// Invite email over AWS SES (spec 2026-07-13). ENV NAMES ARE DELIBERATE: Vercel
// functions run on AWS Lambda, where AWS_REGION / AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY are reserved and overwritten by the platform's own runtime
// credentials — SES_* sidesteps that. Missing config degrades to a legible
// "not_configured" BEFORE any allowance is spent (the action checks sesConfig()
// up front); generate-code keeps working without email entirely.

export interface SesConfig {
  region: string;
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The full SES config, or null if ANY piece is missing (never half-configured). */
export function sesConfig(): SesConfig | null {
  const region = process.env.SES_REGION;
  const from = process.env.SES_FROM_ADDRESS;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !from || !accessKeyId || !secretAccessKey) return null;
  return { region, from, accessKeyId, secretAccessKey };
}

// One client per warm serverless instance; keyed by region so a config change
// mid-lifetime can't silently keep the old region.
let _client: { region: string; client: SESv2Client } | null = null;
function client(cfg: SesConfig): SESv2Client {
  if (_client?.region !== cfg.region) {
    _client = {
      region: cfg.region,
      client: new SESv2Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      }),
    };
  }
  return _client.client;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface InviteEmailParams {
  code: string;
  link: string;
  inviterEmail: string | null;
}

/** Subject + text + minimal HTML. Exported for tests; treat as internal. */
export function buildInviteEmail({ code, link, inviterEmail }: InviteEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const who = inviterEmail ? `${inviterEmail} invited you` : "You've been invited";
  const subject = "You're invited to Rolefit";
  const text = [
    `${who} to join Rolefit — a job-search copilot that reviews openings against your résumé.`,
    "",
    `Your invite code: ${code}`,
    `Sign up here: ${link}`,
    "",
    `This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days.`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(who)} to join <strong>Rolefit</strong> — a job-search copilot that reviews openings against your résumé.</p>`,
    `<p>Your invite code: <strong style="font-family:monospace">${escapeHtml(code)}</strong></p>`,
    `<p><a href="${escapeHtml(link)}">Accept your invite</a> (or paste the code at signup: ${escapeHtml(link)})</p>`,
    `<p style="color:#666;font-size:12px">This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days.</p>`,
  ].join("\n");
  return { subject, text, html };
}

export type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; error: "not_configured" | "send_failed" };

/** One SendEmail per recipient. Errors are logged and mapped — never thrown. */
export async function sendInviteEmail(
  params: InviteEmailParams & { to: string },
): Promise<SendInviteEmailResult> {
  const cfg = sesConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const { subject, text, html } = buildInviteEmail(params);
  try {
    await client(cfg).send(
      new SendEmailCommand({
        FromEmailAddress: cfg.from,
        Destination: { ToAddresses: [params.to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: text, Charset: "UTF-8" },
              Html: { Data: html, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    return { ok: true };
  } catch (err) {
    console.error("sendInviteEmail failed", err);
    return { ok: false, error: "send_failed" };
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/inviteEmail.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/package.json dashboard/package-lock.json \
  dashboard/lib/inviteEmail.ts dashboard/lib/inviteEmail.test.ts
git commit -m "feat(invites): SES invite-email module (SES_* env, legible unconfigured state)"
```

---

### Task 6: Plan-gated server actions — status / send / generate

**Files:**
- Create: `dashboard/app/actions/userInvites.ts`
- Test: `dashboard/app/actions/userInvites.test.ts` (create)

**Interfaces:**
- Consumes: `getUserClaims` (`@/lib/auth`), `getViewerPlan` (`@/lib/subscriptions`), `loadAppSettings` (Task 2), `getInviteAllowance`/`createUserInvite`/`releaseUserInvite`/`isInvitedUser` (Task 4), `sendInviteEmail`/`sesConfig` (Task 5), `isDisposableEmail` (`@/lib/emailGuard`), `headers` (next/headers).
- Produces (Task 7's modal relies on):
  - `getInviteStatusAction(): Promise<{ ok: true; remaining: number; granted: number; emailConfigured: boolean } | { ok: false; error: string }>`
  - `sendInvitesAction(rawEmails: string): Promise<{ ok: true; results: { email: string; status: "sent" | "skipped" | "failed"; detail: string }[]; remaining: number } | { ok: false; error: string }>`
  - `generateInviteCodeAction(): Promise<{ ok: true; code: string; link: string; remaining: number } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/app/actions/userInvites.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const subs = vi.hoisted(() => ({ getViewerPlan: vi.fn() }));
vi.mock("@/lib/subscriptions", () => subs);
const settings = vi.hoisted(() => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/appSettings", () => settings);
const invites = vi.hoisted(() => ({
  getInviteAllowance: vi.fn(async () => ({ remaining: 2, granted: 3 })),
  createUserInvite: vi.fn(),
  releaseUserInvite: vi.fn(async () => {}),
  isInvitedUser: vi.fn(async () => false),
}));
vi.mock("@/lib/invites", () => invites);
const mail = vi.hoisted(() => ({
  sesConfig: vi.fn(() => ({ region: "r", from: "f", accessKeyId: "k", secretAccessKey: "s" })),
  sendInviteEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/inviteEmail", () => mail);
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-proto", "https"], ["host", "rolefit.app"]]),
}));

import { generateInviteCodeAction, getInviteStatusAction, sendInvitesAction } from "@/app/actions/userInvites";

const invite = (code: string) => ({
  ok: true as const,
  invite: { code, note: null, maxUses: 1, uses: 0, expiresAt: null, createdAt: new Date(),
            createdBy: "u-1", recipientEmail: null, creatorEmail: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUserClaims.mockResolvedValue({ id: "u-1", email: "me@x.com" });
  subs.getViewerPlan.mockResolvedValue("standard");
  invites.getInviteAllowance.mockResolvedValue({ remaining: 2, granted: 3 });
  invites.isInvitedUser.mockResolvedValue(false);
  mail.sesConfig.mockReturnValue({ region: "r", from: "f", accessKeyId: "k", secretAccessKey: "s" });
  mail.sendInviteEmail.mockResolvedValue({ ok: true });
  settings.loadAppSettings.mockResolvedValue({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 });
});

describe("gate ordering", () => {
  test("anonymous caller is rejected before ANY invite/db work", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
    expect(mail.sendInviteEmail).not.toHaveBeenCalled();
  });
  test("null-plan caller (direct-API account) is rejected the same way", async () => {
    subs.getViewerPlan.mockResolvedValue(null);
    for (const r of [await sendInvitesAction("a@b.com"), await generateInviteCodeAction(), await getInviteStatusAction()]) {
      expect(r.ok).toBe(false);
    }
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });
});

describe("getInviteStatusAction", () => {
  test("returns allowance + email configuration", async () => {
    const r = await getInviteStatusAction();
    expect(r).toEqual({ ok: true, remaining: 2, granted: 3, emailConfigured: true });
  });
});

describe("sendInvitesAction", () => {
  test("unconfigured SES fails legibly BEFORE spending anything", async () => {
    mail.sesConfig.mockReturnValue(null);
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("zero-spend pre-checks: invalid, disposable, already-member — nothing minted", async () => {
    invites.isInvitedUser.mockImplementation(async (e: string) => e === "member@x.com");
    const r = await sendInvitesAction("not-an-email member@x.com a@mailinator.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results.map((x) => x.status)).toEqual(["skipped", "skipped", "skipped"]);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("happy path: mints then sends per address, dedupes + lowercases", async () => {
    invites.createUserInvite
      .mockResolvedValueOnce(invite("RF-AAAA-1111"))
      .mockResolvedValueOnce(invite("RF-BBBB-2222"));
    const r = await sendInvitesAction("A@x.com, b@y.com\na@X.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results).toHaveLength(2); // duplicate collapsed
    expect(r.results.every((x) => x.status === "sent")).toBe(true);
    expect(mail.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@x.com",
        link: "https://rolefit.app/signup?code=RF-AAAA-1111",
        inviterEmail: "me@x.com",
      }),
    );
  });

  test("SES failure → refund via releaseUserInvite, result 'failed'", async () => {
    invites.createUserInvite.mockResolvedValueOnce(invite("RF-AAAA-1111"));
    mail.sendInviteEmail.mockResolvedValueOnce({ ok: false, error: "send_failed" });
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results[0].status).toBe("failed");
    expect(invites.releaseUserInvite).toHaveBeenCalledWith("RF-AAAA-1111", "u-1");
  });

  test("more than 20 addresses → rejected outright, nothing minted", async () => {
    const many = Array.from({ length: 21 }, (_, i) => `u${i}@x.com`).join(" ");
    const r = await sendInvitesAction(many);
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("exhausted mid-batch: remaining addresses are skipped, not attempted", async () => {
    invites.createUserInvite
      .mockResolvedValueOnce(invite("RF-AAAA-1111"))
      .mockResolvedValueOnce({ ok: false, reason: "exhausted" });
    const r = await sendInvitesAction("a@x.com b@y.com c@z.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results.map((x) => x.status)).toEqual(["sent", "failed", "skipped"]);
    expect(invites.createUserInvite).toHaveBeenCalledTimes(2); // c@z.com never minted
  });
});

describe("generateInviteCodeAction", () => {
  test("mints and returns code + full signup link + fresh remaining", async () => {
    invites.createUserInvite.mockResolvedValueOnce(invite("RF-CCCC-3333"));
    invites.getInviteAllowance.mockResolvedValue({ remaining: 1, granted: 3 });
    const r = await generateInviteCodeAction();
    expect(r).toEqual({
      ok: true, code: "RF-CCCC-3333",
      link: "https://rolefit.app/signup?code=RF-CCCC-3333", remaining: 1,
    });
  });
  test("exhausted → the spec's zero-state copy", async () => {
    invites.createUserInvite.mockResolvedValueOnce({ ok: false, reason: "exhausted" });
    const r = await generateInviteCodeAction();
    expect(r).toEqual({ ok: false, error: "You've used all your invites." });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/actions/userInvites.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement app/actions/userInvites.ts**

```ts
"use server";

import { headers } from "next/headers";
import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { loadAppSettings } from "@/lib/appSettings";
import {
  createUserInvite,
  getInviteAllowance,
  isInvitedUser,
  releaseUserInvite,
} from "@/lib/invites";
import { sendInviteEmail, sesConfig } from "@/lib/inviteEmail";
import { isDisposableEmail } from "@/lib/emailGuard";

// User-facing invite actions (spec 2026-07-13). SECURITY: each action re-gates on an
// authenticated session AND a non-null effective plan (getViewerPlan) FIRST — before
// any parsing or DB work — so a direct-API account that bypassed /signup (the
// documented trust-model hole in lib/invites.ts) can neither mint codes nor send
// email. Privileged SQL stays in lib/invites.ts (mirrors app/actions/invites.ts).
//
// ERROR CONTRACT: expected failures return { ok: false, error } (house pattern —
// thrown server-action messages are redacted in production).

// Per-call sanity bound on addresses; the allowance is the real limiter (each mint
// atomically spends one invite).
const MAX_ADDRESSES_PER_SEND = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NO_PLAN_ERROR = "Inviting requires an active plan.";

async function gateViewer(): Promise<{ userId: string; email: string | null } | null> {
  const claims = await getUserClaims();
  if (!claims) return null;
  const plan = await getViewerPlan(claims.id, claims.email);
  if (!plan) return null;
  return { userId: claims.id, email: claims.email };
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
}

const signupLink = (origin: string, code: string) =>
  `${origin}/signup?code=${encodeURIComponent(code)}`;

export type InviteStatus =
  | { ok: true; remaining: number; granted: number; emailConfigured: boolean }
  | { ok: false; error: string };

export async function getInviteStatusAction(): Promise<InviteStatus> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  const settings = await loadAppSettings();
  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return { ok: true, ...allowance, emailConfigured: sesConfig() !== null };
}

export type SendResult = {
  email: string;
  status: "sent" | "skipped" | "failed";
  detail: string;
};
export type SendInvitesResult =
  | { ok: true; results: SendResult[]; remaining: number }
  | { ok: false; error: string };

export async function sendInvitesAction(rawEmails: string): Promise<SendInvitesResult> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  // Config check BEFORE any spend — an unconfigured SES must not burn allowance.
  if (sesConfig() === null) {
    return { ok: false, error: "Email sending isn't configured yet — generate a code instead." };
  }

  const addresses = Array.from(
    new Set(rawEmails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  if (addresses.length === 0) return { ok: false, error: "Enter at least one email address." };
  if (addresses.length > MAX_ADDRESSES_PER_SEND) {
    return { ok: false, error: `At most ${MAX_ADDRESSES_PER_SEND} addresses per send.` };
  }

  const origin = await requestOrigin();
  const settings = await loadAppSettings();
  const results: SendResult[] = [];
  let exhausted = false;

  for (const email of addresses) {
    if (exhausted) {
      results.push({ email, status: "skipped", detail: "no invites left" });
      continue;
    }
    // Zero-spend pre-checks: none of these consume an invite.
    if (!EMAIL_RE.test(email)) {
      results.push({ email, status: "skipped", detail: "not a valid email address" });
      continue;
    }
    if (isDisposableEmail(email)) {
      results.push({ email, status: "skipped", detail: "this address would be blocked at signup" });
      continue;
    }
    if (await isInvitedUser(email)) {
      results.push({ email, status: "skipped", detail: "already a member" });
      continue;
    }

    const minted = await createUserInvite(viewer.userId, {
      defaultAllowance: settings.inviteDefaultAllowance,
      recipientEmail: email,
    });
    if (!minted.ok) {
      if (minted.reason === "exhausted") {
        exhausted = true;
        results.push({ email, status: "failed", detail: "no invites left" });
      } else {
        results.push({ email, status: "failed", detail: "couldn't create an invite" });
      }
      continue;
    }

    const sent = await sendInviteEmail({
      to: email,
      code: minted.invite.code,
      link: signupLink(origin, minted.invite.code),
      inviterEmail: viewer.email,
    });
    if (!sent.ok) {
      // Refund: an invite is only spent when the email actually handed off to SES.
      await releaseUserInvite(minted.invite.code, viewer.userId);
      results.push({ email, status: "failed", detail: "sending failed — invite refunded" });
    } else {
      results.push({ email, status: "sent", detail: "invite sent" });
    }
  }

  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return { ok: true, results, remaining: allowance.remaining };
}

export type GenerateCodeResult =
  | { ok: true; code: string; link: string; remaining: number }
  | { ok: false; error: string };

export async function generateInviteCodeAction(): Promise<GenerateCodeResult> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  const settings = await loadAppSettings();
  const minted = await createUserInvite(viewer.userId, {
    defaultAllowance: settings.inviteDefaultAllowance,
  });
  if (!minted.ok) {
    return {
      ok: false,
      error: minted.reason === "exhausted"
        ? "You've used all your invites."
        : "Couldn't create an invite. Please try again.",
    };
  }
  const origin = await requestOrigin();
  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return {
    ok: true,
    code: minted.invite.code,
    link: signupLink(origin, minted.invite.code),
    remaining: allowance.remaining,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/actions/userInvites.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/app/actions/userInvites.ts dashboard/app/actions/userInvites.test.ts
git commit -m "feat(invites): plan-gated status/send/generate server actions"
```

---

### Task 7: InviteModal + AccountMenu "Invite" item

**Files:**
- Create: `dashboard/components/rolefit/InviteModal.tsx`
- Modify: `dashboard/components/rolefit/AccountMenu.tsx`
- Test: `dashboard/components/rolefit/InviteModal.test.tsx` (create), `dashboard/components/rolefit/AccountMenu.test.tsx` (append)

**Interfaces:**
- Consumes: Task 6 actions (imported directly — client components may import a "use server" module); `CopyButton` from `@/components/admin/CopyButton`.
- Produces: `InviteModal({ open, onClose }: { open: boolean; onClose: () => void })`.

- [ ] **Step 1: Write the failing tests**

Create `dashboard/components/rolefit/InviteModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const actions = vi.hoisted(() => ({
  getInviteStatusAction: vi.fn(),
  sendInvitesAction: vi.fn(),
  generateInviteCodeAction: vi.fn(),
}));
vi.mock("@/app/actions/userInvites", () => actions);

import { InviteModal } from "./InviteModal";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  actions.getInviteStatusAction.mockResolvedValue({
    ok: true, remaining: 2, granted: 3, emailConfigured: true,
  });
});

const open = () => render(<InviteModal open onClose={() => {}} />);

describe("InviteModal", () => {
  test("closed → renders nothing, no status fetch", () => {
    render(<InviteModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.getInviteStatusAction).not.toHaveBeenCalled();
  });

  test("open → dialog with the spec copy and the allowance count", async () => {
    open();
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByText("Invite someone to Rolefit")).not.toBeNull();
    await waitFor(() => expect(screen.getByText(/2 of 3 invites left/)).not.toBeNull());
  });

  test("zero remaining → both controls disabled with the spec zero-state copy", async () => {
    actions.getInviteStatusAction.mockResolvedValue({
      ok: true, remaining: 0, granted: 3, emailConfigured: true,
    });
    open();
    await waitFor(() => expect(screen.getByText("You've used all your invites.")).not.toBeNull());
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /generate code/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("send: shows per-address results and the refreshed count", async () => {
    actions.sendInvitesAction.mockResolvedValue({
      ok: true, remaining: 1,
      results: [
        { email: "a@x.com", status: "sent", detail: "invite sent" },
        { email: "b@y.com", status: "skipped", detail: "already a member" },
      ],
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.change(screen.getByLabelText(/email addresses/i), {
      target: { value: "a@x.com b@y.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
    await waitFor(() => expect(screen.getByText("a@x.com")).not.toBeNull());
    expect(actions.sendInvitesAction).toHaveBeenCalledWith("a@x.com b@y.com");
    expect(screen.getByText(/already a member/)).not.toBeNull();
    expect(screen.getByText(/1 of 3 invites left/)).not.toBeNull();
  });

  test("send disabled when addresses exceed remaining, with 'You can send N more' copy", async () => {
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.change(screen.getByLabelText(/email addresses/i), {
      target: { value: "a@x.com b@y.com c@z.com" }, // 3 addresses, 2 remaining
    });
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/you can send 2 more/i)).not.toBeNull();
    expect(actions.sendInvitesAction).not.toHaveBeenCalled();
  });

  test("generate: shows the code, the link, and the 30-day note", async () => {
    actions.generateInviteCodeAction.mockResolvedValue({
      ok: true, code: "RF-CCCC-3333",
      link: "https://rolefit.app/signup?code=RF-CCCC-3333", remaining: 1,
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    fireEvent.click(screen.getByRole("button", { name: /generate code/i }));
    await waitFor(() => expect(screen.getByText("RF-CCCC-3333")).not.toBeNull());
    expect(screen.getByText(/expires in 30 days/i)).not.toBeNull();
    expect(screen.getByText("https://rolefit.app/signup?code=RF-CCCC-3333")).not.toBeNull();
  });

  test("gate failure (no plan) renders the action's error legibly", async () => {
    actions.getInviteStatusAction.mockResolvedValue({ ok: false, error: "Inviting requires an active plan." });
    open();
    await waitFor(() =>
      expect(screen.getByText("Inviting requires an active plan.")).not.toBeNull(),
    );
  });

  test("email not configured → send disabled with explanatory copy, generate still works", async () => {
    actions.getInviteStatusAction.mockResolvedValue({
      ok: true, remaining: 2, granted: 3, emailConfigured: false,
    });
    open();
    await waitFor(() => screen.getByText(/2 of 3 invites left/));
    expect((screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/email sending isn't configured/i)).not.toBeNull();
    expect((screen.getByRole("button", { name: /generate code/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
```

Append to `dashboard/components/rolefit/AccountMenu.test.tsx` (inside a new describe; the file's existing helpers apply). NOTE: also add this mock at the top of that file, next to its imports, because AccountMenu now (indirectly) imports the actions module:

```tsx
vi.mock("@/app/actions/userInvites", () => ({
  getInviteStatusAction: vi.fn(async () => ({ ok: true, remaining: 3, granted: 3, emailConfigured: true })),
  sendInvitesAction: vi.fn(),
  generateInviteCodeAction: vi.fn(),
}));
```

```tsx
describe("AccountMenu — Invite item", () => {
  test("renders an Invite menuitem between Billing and Admin; selecting it closes the menu and opens the modal", () => {
    renderMenu({ isAdmin: true });
    openWithClick();
    const items = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(items.indexOf("Invite")).toBeGreaterThan(items.indexOf("Billing"));
    expect(items.indexOf("Invite")).toBeLessThan(items.indexOf("Admin"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Invite" }));
    expect(screen.queryByRole("menu")).toBeNull(); // menu closed
    expect(screen.getByRole("dialog")).not.toBeNull(); // modal open
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run components/rolefit/InviteModal.test.tsx components/rolefit/AccountMenu.test.tsx`
Expected: FAIL — InviteModal doesn't exist; no Invite menuitem.

- [ ] **Step 3: Implement InviteModal.tsx**

Match the house dialog conventions (ProfileModal.tsx: overlay + centered card, Escape close, focus trap, design tokens — read its render section lines 110–260 and keep the overlay/card styles visually identical).

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import {
  generateInviteCodeAction,
  getInviteStatusAction,
  sendInvitesAction,
  type SendResult,
} from "@/app/actions/userInvites";

export interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

type Status =
  | { state: "loading" }
  | { state: "error"; error: string }
  | { state: "ready"; remaining: number; granted: number; emailConfigured: boolean };

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 60, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "rgba(15,22,35,.45)", padding: "16px",
};
const cardStyle: React.CSSProperties = {
  width: "440px", maxWidth: "100%", maxHeight: "min(640px, calc(100vh - 32px))",
  overflowY: "auto", background: "var(--bg-surface)", borderRadius: "16px",
  border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(15,22,35,.25)",
  padding: "24px",
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "6px",
};
const primaryBtnStyle: React.CSSProperties = {
  border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "13px",
  fontWeight: 700, color: "var(--text-on-accent)", background: "var(--accent)",
  boxShadow: "var(--shadow-accent)", cursor: "pointer", fontFamily: "inherit",
};
const mutedTextStyle: React.CSSProperties = {
  fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5,
};

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState<"send" | "generate" | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [minted, setMinted] = useState<{ code: string; link: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Fetch allowance on each open; reset transient state on close.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    setStatus({ state: "loading" });
    setResults(null);
    setMinted(null);
    setActionError(null);
    setEmails("");
    let cancelled = false;
    getInviteStatusAction().then((r) => {
      if (cancelled) return;
      setStatus(r.ok
        ? { state: "ready", remaining: r.remaining, granted: r.granted, emailConfigured: r.emailConfigured }
        : { state: "error", error: r.error });
    });
    const timer = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const ready = status.state === "ready" ? status : null;
  const remaining = ready?.remaining ?? 0;
  const zero = ready !== null && remaining === 0;
  // Client-side count guard (spec: "Send disabled when … count > remaining"). The
  // action re-enforces via the atomic spend — this is UX, not the control.
  const addressCount = emails.split(/[\s,;]+/).filter(Boolean).length;
  const overRemaining = addressCount > remaining;

  const doSend = async () => {
    setBusy("send");
    setActionError(null);
    setResults(null);
    try {
      const r = await sendInvitesAction(emails);
      if (!r.ok) {
        setActionError(r.error);
      } else {
        setResults(r.results);
        setEmails("");
        if (ready) setStatus({ ...ready, remaining: r.remaining });
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const doGenerate = async () => {
    setBusy("generate");
    setActionError(null);
    try {
      const r = await generateInviteCodeAction();
      if (!r.ok) {
        setActionError(r.error);
      } else {
        setMinted({ code: r.code, link: r.link });
        if (ready) setStatus({ ...ready, remaining: r.remaining });
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const resultColor = (s: SendResult["status"]) =>
    s === "sent" ? "var(--accent)" : s === "failed" ? "var(--danger)" : "var(--text-secondary)";

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite someone to Rolefit"
        tabIndex={-1}
        style={cardStyle}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--text-primary)" }}>
            Invite someone to Rolefit
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ border: "none", background: "transparent", color: "var(--text-secondary)",
                     fontSize: "18px", cursor: "pointer", padding: "2px 6px", fontFamily: "inherit" }}
          >
            ×
          </button>
        </div>

        {status.state === "loading" && <div style={mutedTextStyle}>Loading…</div>}
        {status.state === "error" && (
          <p role="alert" style={{ ...mutedTextStyle, color: "var(--danger)", fontWeight: 600 }}>{status.error}</p>
        )}

        {ready && (
          <>
            <div style={{ ...mutedTextStyle, marginBottom: "16px", fontWeight: 600 }}>
              {remaining} of {ready.granted} invites left
            </div>
            {zero && (
              <p style={{ ...mutedTextStyle, fontWeight: 600, color: "var(--text-primary)" }}>
                You&apos;ve used all your invites.
              </p>
            )}

            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="invite-emails" style={sectionLabelStyle}>Email addresses</label>
              <textarea
                id="invite-emails"
                aria-label="Email addresses"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                disabled={zero || !ready.emailConfigured || busy !== null}
                rows={3}
                placeholder="friend@example.com, colleague@example.com"
                style={{
                  width: "100%", boxSizing: "border-box", fontSize: "13px", fontFamily: "inherit",
                  color: "var(--text-primary)", background: "var(--bg-muted)",
                  border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 11px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={doSend}
                  disabled={zero || !ready.emailConfigured || busy !== null || emails.trim() === "" || overRemaining}
                  style={{ ...primaryBtnStyle, opacity: zero || !ready.emailConfigured || emails.trim() === "" || overRemaining ? 0.6 : 1 }}
                >
                  {busy === "send" ? "Sending…" : "Send invites"}
                </button>
                <span style={{ fontSize: "11.5px", color: overRemaining ? "var(--danger)" : "var(--text-muted)" }}>
                  {overRemaining
                    ? `You can send ${remaining} more.`
                    : "Each address spends one invite; codes expire in 30 days."}
                </span>
              </div>
              {!ready.emailConfigured && (
                <p style={{ ...mutedTextStyle, marginTop: "8px" }}>
                  Email sending isn&apos;t configured yet — generate a code below and share it yourself.
                </p>
              )}
              {results && (
                <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                  {results.map((r) => (
                    <li key={r.email} style={{ fontSize: "12.5px", padding: "3px 0" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.email}</span>{" "}
                      <span style={{ color: resultColor(r.status) }}>
                        {r.status === "sent" ? "✓" : r.status === "failed" ? "✗" : "—"} {r.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div role="separator" style={{ borderTop: "1px solid var(--bg-muted)", margin: "14px 0" }} />

            <div>
              <div style={sectionLabelStyle}>Or share a code yourself</div>
              <button
                type="button"
                onClick={doGenerate}
                disabled={zero || busy !== null}
                style={{
                  ...primaryBtnStyle, background: "var(--bg-muted)", color: "var(--text-primary)",
                  boxShadow: "none", border: "1px solid var(--border)",
                  opacity: zero ? 0.6 : 1,
                }}
              >
                {busy === "generate" ? "Generating…" : "Generate code"}
              </button>
              {minted && (
                <div
                  style={{
                    marginTop: "10px", background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)", borderRadius: "10px", padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                   fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                      {minted.code}
                    </span>
                    <CopyButton text={minted.code} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
                    <span style={{ fontSize: "11.5px", color: "var(--text-secondary)",
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {minted.link}
                    </span>
                    <CopyButton text={minted.link} />
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                    Single-use · expires in 30 days
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {actionError && (
          <p role="alert" style={{ ...mutedTextStyle, color: "var(--danger)", fontWeight: 600, marginTop: "12px" }}>
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the menu item + modal mount to AccountMenu.tsx**

1. `import { InviteModal } from "./InviteModal";`
2. Add state next to `open`: `const [inviteOpen, setInviteOpen] = useState(false);`
3. Between the Billing `<a>` and the `{isAdmin && …}` block, insert:

```tsx
          {/* Invite (user-sent invites): opens the modal — a button, not a link.
              The action re-gates on plan server-side; this is discoverability only. */}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="rf-picker-option"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              setInviteOpen(true);
            }}
          >
            Invite
          </button>
```

4. After the closing `</div>` of the popup (but inside the root `<div ref={rootRef}>`… actually AFTER the root div's children, still inside the component's returned fragment — place it as a sibling of the popup, inside the root div):

```tsx
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
```

(The modal is `position: fixed`, so rendering inside the root div is fine; the root's `onBlur` close only affects the `open` menu state, not the modal.)

- [ ] **Step 5: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run components/rolefit/InviteModal.test.tsx components/rolefit/AccountMenu.test.tsx && npm run typecheck`
Expected: PASS, including every pre-existing AccountMenu test (keyboard nav now includes one more menuitem — if an existing test asserts an exact item COUNT or order list, update it to include "Invite").

- [ ] **Step 6: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/components/rolefit/InviteModal.tsx dashboard/components/rolefit/InviteModal.test.tsx \
  dashboard/components/rolefit/AccountMenu.tsx dashboard/components/rolefit/AccountMenu.test.tsx
git commit -m "feat(invites): Invite menu item + invite modal (send emails / generate code)"
```

---

### Task 8: Signup `?code=` prefill

**Files:**
- Modify: `dashboard/app/signup/page.tsx` (searchParams type line ~34, invite input line ~77)
- Test: `dashboard/app/signup/page.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new. Produces: the emailed link `/signup?code=RF-XXXX-XXXX` lands with the code pre-filled (still editable, still required).

- [ ] **Step 1: Write the failing test**

Create `dashboard/app/signup/page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The page imports the signUp server action (next/headers, supabase) — stub it out.
vi.mock("@/app/actions/signup", () => ({ signUp: async () => {} }));

import SignupPage from "@/app/signup/page";

afterEach(cleanup);

describe("SignupPage invite-code prefill", () => {
  test("?code= pre-fills the invite input (still editable + required)", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ code: "RF-AAAA-2222" }) }));
    const input = screen.getByPlaceholderText("Your invite code") as HTMLInputElement;
    expect(input.value).toBe("RF-AAAA-2222");
    expect(input.required).toBe(true);
    expect(input.readOnly).toBe(false);
  });
  test("no code param → empty input", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));
    const input = screen.getByPlaceholderText("Your invite code") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/signup/page.test.tsx`
Expected: FAIL — value is `""` for the prefill case (the page ignores `code`).

- [ ] **Step 3: Implement**

In `dashboard/app/signup/page.tsx`:
- Type: `searchParams: Promise<{ error?: string; sent?: string; code?: string }>;`
- Destructure: `const { error, sent, code } = await searchParams;`
- Input (line ~77): add `defaultValue={code ?? ""}`:

```tsx
            <input className="rf-focusable" name="invite_code" required
              defaultValue={code ?? ""}
              placeholder="Your invite code" style={inputStyle} />
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/signup/page.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/app/signup/page.tsx dashboard/app/signup/page.test.tsx
git commit -m "feat(invites): /signup?code= prefill — the invite-link landing"
```

---

### Task 9: Admin — invite settings card + attribution columns

**Files:**
- Create: `dashboard/app/actions/adminSettings.ts`
- Create: `dashboard/components/admin/InviteSettings.tsx`
- Modify: `dashboard/app/admin/invites/page.tsx` (settings card between the generator card and the list; two new columns)
- Test: `dashboard/app/actions/adminSettings.test.ts` (create)

**Interfaces:**
- Consumes: `saveAppSetting`, `loadAppSettings` (Task 2), `setInviteAllowance` (Task 4), `isAdmin`/`getUserClaims`; `InviteCode.createdBy/recipientEmail/creatorEmail` (Task 4).
- Produces (Task 10 reuses): `saveInviteSettingsAction(input: { compPlan: string; defaultAllowance: number }): Promise<{ ok: true } | { ok: false; error: string }>`; `setInviteAllowanceAction(input: { userId: string; remaining: number }): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing action tests**

Create `dashboard/app/actions/adminSettings.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const settings = vi.hoisted(() => ({ saveAppSetting: vi.fn(async () => {}) }));
vi.mock("@/lib/appSettings", () => settings);
const invites = vi.hoisted(() => ({ setInviteAllowance: vi.fn(async () => {}) }));
vi.mock("@/lib/invites", () => invites);

import { saveInviteSettingsAction, setInviteAllowanceAction } from "@/app/actions/adminSettings";

const OLD = process.env.ADMIN_EMAILS;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "op@example.com";
  auth.getUserClaims.mockResolvedValue({ id: "u-op", email: "op@example.com" });
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
});

describe("admin gate FIRST (mirrors createInviteAction)", () => {
  test("non-admin throws before any write", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u-x", email: "stranger@x.com" });
    await expect(saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: 3 })).rejects.toThrow();
    await expect(setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 5 })).rejects.toThrow();
    expect(settings.saveAppSetting).not.toHaveBeenCalled();
    expect(invites.setInviteAllowance).not.toHaveBeenCalled();
  });
});

describe("saveInviteSettingsAction", () => {
  test("valid input writes both keys", async () => {
    const r = await saveInviteSettingsAction({ compPlan: "pro", defaultAllowance: 5 });
    expect(r).toEqual({ ok: true });
    expect(settings.saveAppSetting).toHaveBeenCalledWith("invite_comp_plan", "pro");
    expect(settings.saveAppSetting).toHaveBeenCalledWith("invite_default_allowance", 5);
  });
  test("bad comp plan / bad allowance → legible errors, no writes", async () => {
    expect((await saveInviteSettingsAction({ compPlan: "platinum", defaultAllowance: 3 })).ok).toBe(false);
    expect((await saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: 2.5 })).ok).toBe(false);
    expect((await saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: -1 })).ok).toBe(false);
    expect(settings.saveAppSetting).not.toHaveBeenCalled();
  });
  test("'none' is a valid comp plan", async () => {
    expect((await saveInviteSettingsAction({ compPlan: "none", defaultAllowance: 0 })).ok).toBe(true);
  });
});

describe("setInviteAllowanceAction", () => {
  test("valid input upserts", async () => {
    const r = await setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 7 });
    expect(r).toEqual({ ok: true });
    expect(invites.setInviteAllowance).toHaveBeenCalledWith("8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", 7);
  });
  test("bad uuid / bad remaining → legible errors, no writes", async () => {
    expect((await setInviteAllowanceAction({ userId: "not-a-uuid", remaining: 5 })).ok).toBe(false);
    expect((await setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 1.5 })).ok).toBe(false);
    expect(invites.setInviteAllowance).not.toHaveBeenCalled();
  });
});
```

(Add the missing `afterEach` import to the vitest import line.)

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/actions/adminSettings.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement app/actions/adminSettings.ts**

```ts
"use server";

import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { saveAppSetting } from "@/lib/appSettings";
import { setInviteAllowance } from "@/lib/invites";

// Admin-only operator settings. SECURITY: independently reachable regardless of the
// admin pages' gates, so each action re-gates on isAdmin FIRST — before validation,
// before any DB work (mirrors app/actions/invites.ts). ERROR CONTRACT: validation
// failures return { ok: false, error }; the unauthorized case THROWS (strangers get
// no legible detail by design).

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function saveInviteSettingsAction(input: {
  compPlan: string;
  defaultAllowance: number;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  const compPlan = input.compPlan.trim().toLowerCase();
  if (compPlan !== "standard" && compPlan !== "pro" && compPlan !== "none") {
    return { ok: false, error: "Comp plan must be Standard, Pro, or None." };
  }
  const n = input.defaultAllowance;
  if (!Number.isInteger(n) || n < 0 || n > 1000) {
    return { ok: false, error: "Default allowance must be a whole number between 0 and 1000." };
  }
  try {
    await saveAppSetting("invite_comp_plan", compPlan);
    await saveAppSetting("invite_default_allowance", n);
    return { ok: true };
  } catch (err) {
    console.error("saveInviteSettingsAction failed", err);
    return { ok: false, error: "Couldn't save settings. Please try again." };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setInviteAllowanceAction(input: {
  userId: string;
  remaining: number;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  if (!UUID_RE.test(input.userId)) return { ok: false, error: "Invalid user id." };
  if (!Number.isInteger(input.remaining) || input.remaining < 0 || input.remaining > 1000) {
    return { ok: false, error: "Invites left must be a whole number between 0 and 1000." };
  }
  try {
    await setInviteAllowance(input.userId, input.remaining);
    return { ok: true };
  } catch (err) {
    console.error("setInviteAllowanceAction failed", err);
    return { ok: false, error: "Couldn't update the allowance. Please try again." };
  }
}
```

- [ ] **Step 4: Implement the settings card component**

Create `dashboard/components/admin/InviteSettings.tsx` (style tokens mirror InviteGenerator.tsx):

```tsx
"use client";

import { useState } from "react";
import { saveInviteSettingsAction } from "@/app/actions/adminSettings";

// Operator knobs for user-sent invites (rendered inside the isAdmin-gated
// /admin/invites page; the action re-gates independently). NOTE: the comp plan
// applies to ALL invited users — Phase-0/FOUNDER invitees included (one shared
// notion of "invited"; spec 2026-07-13).

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "4px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", fontSize: "13px", color: "var(--text-primary)",
  background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "9px",
  padding: "8px 10px", fontFamily: "inherit",
};

export function InviteSettings({
  initialCompPlan,
  initialDefaultAllowance,
}: {
  initialCompPlan: "standard" | "pro" | "none";
  initialDefaultAllowance: number;
}) {
  const [compPlan, setCompPlan] = useState<string>(initialCompPlan);
  const [allowance, setAllowance] = useState(String(initialDefaultAllowance));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveInviteSettingsAction({
        compPlan,
        defaultAllowance: Number(allowance),
      });
      setMessage(res.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: res.error });
    } catch {
      setMessage({ kind: "error", text: "Couldn't save settings. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 180px" }}>
          <label htmlFor="invite-comp-plan" style={labelStyle}>Comped plan for invitees</label>
          <select
            id="invite-comp-plan"
            value={compPlan}
            onChange={(e) => setCompPlan(e.target.value)}
            style={inputStyle}
          >
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="none">None (no comp)</option>
          </select>
        </div>
        <div style={{ flex: "0 0 150px" }}>
          <label htmlFor="invite-default-allowance" style={labelStyle}>Default invites/user</label>
          <input
            id="invite-default-allowance"
            type="number"
            min={0}
            max={1000}
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "13px",
            fontWeight: 700, color: "var(--text-on-accent)", background: "var(--accent)",
            boxShadow: "var(--shadow-accent)", cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1, fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
      <div style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--text-muted)" }}>
        The comped plan applies to every invited user (Phase-0 invitees included). Changing the
        default only affects users who haven&apos;t spent an invite yet; per-user overrides live on
        the Tenants page.
      </div>
      {message && (
        <div
          style={{
            marginTop: "10px", fontSize: "12.5px",
            color: message.kind === "ok" ? "var(--accent)" : "var(--danger)",
          }}
        >
          {message.text}
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Wire the page**

In `dashboard/app/admin/invites/page.tsx`:
1. Imports: `import { loadAppSettings } from "@/lib/appSettings";` and `import { InviteSettings } from "@/components/admin/InviteSettings";`
2. In the page component, after `const invites = await listInvites();`: `const settings = await loadAppSettings();`
3. Between the generator card and the list card insert:

```tsx
          <div style={{ ...cardStyle, marginBottom: "18px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
              Invite settings
            </h2>
            <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "14px" }}>
              What invited users are comped, and how many invites each user gets.
            </div>
            <InviteSettings
              initialCompPlan={settings.inviteCompPlan}
              initialDefaultAllowance={settings.inviteDefaultAllowance}
            />
          </div>
```

4. Table: add `<th style={thStyle}>Created by</th>` and `<th style={thStyle}>Sent to</th>` after the Note column, and in `Row`:

```tsx
      <td style={tdStyle}>{inv.createdBy ? (inv.creatorEmail ?? inv.createdBy.slice(0, 8)) : "Operator"}</td>
      <td style={tdStyle}>{inv.recipientEmail ?? "—"}</td>
```

Bump the table's `minWidth` from `640px` to `860px` and the wrap's `maxWidth` from `860px` to `1000px`.

- [ ] **Step 6: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run app/actions/adminSettings.test.ts app/admin/invites/page.test.ts && npm run typecheck`
Expected: PASS. If `page.test.ts` fails on the new `loadAppSettings` import, add to its mocks: `vi.mock("@/lib/appSettings", () => ({ loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })) }));`

- [ ] **Step 7: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/app/actions/adminSettings.ts dashboard/app/actions/adminSettings.test.ts \
  dashboard/components/admin/InviteSettings.tsx dashboard/app/admin/invites/page.tsx
git commit -m "feat(invites): admin invite-settings card + code attribution columns"
```

---

### Task 10: Admin tenants — invites-left column + editor

**Files:**
- Modify: `dashboard/lib/tenantMetrics.ts` (SQL CTE join + interface)
- Create: `dashboard/components/admin/AllowanceEditor.tsx`
- Modify: `dashboard/app/admin/tenants/page.tsx`
- Test: `dashboard/lib/tenantMetrics.test.ts` (append)

**Interfaces:**
- Consumes: `setInviteAllowanceAction` (Task 9), `loadAppSettings` (Task 2).
- Produces: `TenantMetric.invitesRemaining: number | null` (null = no row yet → renders the default).

- [ ] **Step 1: Write the failing test**

Append to `dashboard/lib/tenantMetrics.test.ts` (match its existing harness — it stages rows through a mocked `serviceSql.unsafe`):

```ts
test("maps invites_remaining through (null = never initialized)", async () => {
  stageRows([
    { ...baseRow(), user_id: "u-1", invites_remaining: 1 },
    { ...baseRow(), user_id: "u-2", invites_remaining: null },
  ]);
  const metrics = await getTenantMetrics();
  expect(metrics[0].invitesRemaining).toBe(1);
  expect(metrics[1].invitesRemaining).toBeNull();
});
```

(`stageRows`/`baseRow` = whatever helpers the file already uses; reuse them.)

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/tenantMetrics.test.ts`
Expected: FAIL — `invitesRemaining` is `undefined`.

- [ ] **Step 3: Implement**

`dashboard/lib/tenantMetrics.ts`:
- `TenantMetric` gains `invitesRemaining: number | null;`, `Row` gains `invites_remaining: number | null;`
- In `_SQL`: add `ia.remaining AS invites_remaining,` to the SELECT list and `LEFT JOIN invite_allowances ia ON ia.user_id = p.user_id` after the `inv` join.
- In the map: `invitesRemaining: r.invites_remaining,`

Create `dashboard/components/admin/AllowanceEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInviteAllowanceAction } from "@/app/actions/adminSettings";

// Per-tenant invites-left editor (isAdmin-gated /admin/tenants; the action re-gates).
// remaining=null means "no allowance row yet" — the tenant would see the default.
export function AllowanceEditor({
  userId,
  remaining,
  defaultAllowance,
}: {
  userId: string;
  remaining: number | null;
  defaultAllowance: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(remaining ?? defaultAllowance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await setInviteAllowanceAction({ userId, remaining: Number(value) });
      if (!res.ok) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <input
        type="number"
        min={0}
        max={1000}
        value={value}
        aria-label="Invites left"
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: "58px", fontSize: "12px", fontFamily: "inherit", color: "var(--text-primary)",
          background: "var(--bg-muted)", border: error ? "1px solid var(--danger)" : "1px solid var(--border)",
          borderRadius: "7px", padding: "3px 6px",
        }}
      />
      {remaining === null && (
        <span title="No allowance row yet — this tenant sees the default" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          default
        </span>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        style={{
          border: "1px solid var(--border)", borderRadius: "7px", background: "var(--bg-surface)",
          color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, padding: "3px 8px",
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}
      >
        {busy ? "…" : "Set"}
      </button>
    </span>
  );
}
```

`dashboard/app/admin/tenants/page.tsx`:
- Imports: `AllowanceEditor`, `loadAppSettings`.
- Page body: `const settings = await loadAppSettings();`
- `Row` takes an extra prop `defaultAllowance: number` (thread it from the map: `<Row key={t.userId} t={t} defaultAllowance={settings.inviteDefaultAllowance} />`).
- New header `<th style={{ ...thStyle, textAlign: "right" }}>Invites left</th>` after "Résumé/Cover mo", and cell:

```tsx
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <AllowanceEditor userId={t.userId} remaining={t.invitesRemaining} defaultAllowance={defaultAllowance} />
      </td>
```

- Bump the table `minWidth` from `980px` to `1080px`.

- [ ] **Step 4: Run tests**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npx vitest run lib/tenantMetrics.test.ts && npm run typecheck`
Expected: PASS (add the `loadAppSettings` mock to any tenants-page test if one exists and complains).

- [ ] **Step 5: Commit**

```bash
cd /Users/andrew/Scripts/job-board
git add dashboard/lib/tenantMetrics.ts dashboard/lib/tenantMetrics.test.ts \
  dashboard/components/admin/AllowanceEditor.tsx dashboard/app/admin/tenants/page.tsx
git commit -m "feat(invites): per-tenant invites-left column + admin editor"
```

---

### Task 11: Full verification sweep

**Files:** none new — this is the gate before rollout.

- [ ] **Step 1: Dashboard suite + types + lint**

Run: `cd /Users/andrew/Scripts/job-board/dashboard && npm test && npm run typecheck && npm run lint`
Expected: ALL pass, zero new lint errors. (If `npm test` shows failures unrelated to this branch, check `git log origin/main..HEAD` — do NOT paper over; report.)

- [ ] **Step 2: Python suite**

Run: `cd /Users/andrew/Scripts/job-board && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/ -q`
Expected: pass; `test_rls_isolation.py` and `test_entitlements_parity.py` MUST have run (not skipped).

- [ ] **Step 3: Binary/control-byte scan (repo gotcha for generated tests)**

Run: `cd /Users/andrew/Scripts/job-board && git diff origin/main...HEAD --stat | grep -i bin; git diff origin/main...HEAD | grep -P '[\x00-\x08\x0b\x0c\x0e-\x1f]' | head`
Expected: no output from either (no raw control bytes in any test literal).

- [ ] **Step 4: Commit any straggler fixes**

```bash
cd /Users/andrew/Scripts/job-board && git status --short
# commit anything outstanding with a descriptive message; never amend
```

---

### Task 12: Rollout (coordinated with the user — do not free-run this)

Order is load-bearing (deploy-topology rule: migration BEFORE coupled code reaches prod).

- [ ] **Step 1: Apply the migration to prod Supabase**

Use the Supabase MCP `apply_migration` tool with the contents of `migrations/2026-07-13-user-invites.sql` (project: the one in the deploy-topology memory). Verify: `execute_sql` → `SELECT filename FROM schema_migrations WHERE filename = '2026-07-13-user-invites.sql';` returns 1 row, and `SELECT count(*) FROM invite_allowances;` returns 0.

- [ ] **Step 2: Set the four SES env vars in Vercel (user provides secret values)**

`SES_REGION=us-west-1`, `SES_FROM_ADDRESS=invites@andrewmalvani.com`, `SES_ACCESS_KEY_ID=…`, `SES_SECRET_ACCESS_KEY=…` (production env). ASK THE USER for the key pair — do not mint AWS credentials yourself. Absent vars degrade gracefully (generate-code works; send reports "not configured"), so deploy may proceed while this is pending.

- [ ] **Step 3: Merge + push**

Fetch first and check divergence (local main is often behind origin — repo memory). Then merge `user-invites` into `main` (real integration if diverged; new commits only, never rebase) and push. Vercel + Railway auto-deploy.

- [ ] **Step 4: Live smoke**

1. On prod, open the avatar menu → Invite → confirm "3 of 3 invites left".
2. Generate a code → confirm it appears with a copyable `https://…/signup?code=…` link, count drops to 2, and the code shows on /admin/invites attributed to your email.
3. Send an invite to an address you own → email arrives from invites@andrewmalvani.com; the link lands on /signup with the code pre-filled; count drops.
4. Redeem it end-to-end (throwaway real mailbox, not disposable) → account signs up, onboarding works, /admin/tenants shows the new user comped Standard.
5. /admin/invites → flip default allowance to 4, save, reload → sticks. Flip back to 3.

---

## Execution notes for whoever runs this

- Tasks 2–10 each assume the prior tasks' commits exist; run them in order. Tasks 5 (SES) and 8 (signup prefill) have no dependency on each other and could swap if convenient.
- Anywhere a step says "match the file's existing harness", READ the test file before editing — the exact mock accessor names differ per file and the code above shows intent, not guaranteed identifiers.
- Any deviation you discover (a drifted line number, a different helper name) is expected; a CHANGED contract (exports, SQL shapes, RLS matrices) is not — stop and surface it.
