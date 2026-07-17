# Admin Plan Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator pin any user's effective subscription tier (Standard/Pro, optional expiry) from `/admin/tenants`, without touching Stripe billing.

**Architecture:** A new service-write-only `plan_overrides` table (RLS: deny-all + owner `SELECT`, cloned from `invite_allowances`). An *active* override (no expiry, or expiry in the future) **pins** the plan in `resolvePlan` (TS) / `resolve_plan` (Python), winning over both the Stripe subscription mirror and the invite comp; expired/absent overrides change nothing. Wired at the three existing chokepoints: `getViewerPlan` (all dashboard money gates), `getTenantMetrics` (admin display), and the reviewer's `load_profiles` → `resolve_plan`. UI is an inline per-row control on the tenants table calling an isAdmin-gated server action — the exact `AllowanceEditor`/`setInviteAllowanceAction` pattern.

**Tech Stack:** Next.js 16 (App Router, server actions), postgres.js, Supabase RLS, vitest 4 (+jsdom for `.test.tsx`), Python + pytest + psycopg.

**Spec:** `docs/superpowers/specs/2026-07-16-admin-plan-override-design.md` (rev 2).

## Global Constraints

- Branch: `admin-plan-override`, already created off `origin/main` (497bc34) in this worktree with the spec commits on top. Work here; do NOT rebase or amend — reconcile forward with new commits only (repo CLAUDE.md).
- `subscriptions` stays untouched: the Stripe webhook remains its sole state writer.
- The trialing-below-Pro clamp does NOT apply to overrides — a pin is explicit operator intent.
- Override values are only `standard` / `pro`; clearing = deleting the row. Anything else read from the DB falls through (defensive, never throws).
- Entitlements TS↔Python mirror discipline: any semantic change to `resolvePlan` lands in the same task's twin, with mirrored tests. `tests/test_entitlements_parity.py` regex-extracts constants only — this feature adds no constants, so it must keep passing UNCHANGED.
- Dashboard tests: `cd dashboard && npm test -- <file>` (vitest). If `dashboard/node_modules` is missing in this worktree, run `cd dashboard && npm install` first (worktrees omit gitignored dirs).
- Python tests: `python3 -m pytest <file> -q` from the repo root (no venv). DB-backed suites additionally need `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test` (adjust credentials to your local PG if they differ); without it they skip — a skip is NOT a pass for Tasks 1 and 8.
- UI: no raw controls / inline geometry / raw theme values — shared primitives (`Button`) + `rf-control rf-focusable` classes + stylesheet geometry only. `dashboard/app/ui-contract.test.ts` (`auditProductionUi`) enforces this; it runs in the full vitest sweep.
- Deploy gate (execution session, after merge approval): apply `migrations/2026-07-16-plan-overrides.sql` to Supabase BEFORE pushing the code (standing migration-before-deploy rule).

---

### Task 1: `plan_overrides` table — migration, schema.sql, RLS contract

**Files:**
- Create: `migrations/2026-07-16-plan-overrides.sql`
- Modify: `schema.sql` (add table + RLS right after the `invite_allowances` block)
- Modify: `tests/test_rls_isolation.py` (policy-contract + grant-contract entries)

**Interfaces:**
- Produces: table `plan_overrides(user_id UUID PK, plan TEXT CHECK IN ('standard','pro') NOT NULL, expires_at TIMESTAMPTZ NULL, note TEXT NULL, created_at, updated_at)`. RLS: `no_anon_access` deny-all + `owner_read` SELECT for `authenticated`; `GRANT SELECT` to authenticated; service role is the only writer. All later tasks assume exactly these column names.

- [ ] **Step 1: Write the migration**

Create `migrations/2026-07-16-plan-overrides.sql`:

```sql
-- Admin plan override (spec docs/superpowers/specs/2026-07-16-admin-plan-override-design.md).
--
-- plan_overrides: operator-pinned effective tier, one row per user. An ACTIVE row
-- (expires_at NULL or in the future) WINS over both the Stripe subscription mirror
-- and the invite comp in resolvePlan/resolve_plan — pin semantics, explicit operator
-- intent, so the trialing-below-Pro clamp does not apply. Clearing the pin = DELETE.
-- subscriptions keeps its invariant (the Stripe webhook stays its sole state writer);
-- this table is a separate overlay — like tier_settings, but per-user.
--
-- RLS mirrors invite_allowances: deny-all + owner SELECT (the pin already surfaces to
-- its owner as their effective plan; getViewerPlan reads the row under the user's own
-- session); ALL writes are service-role (isAdmin-gated app/actions/adminSettings.ts →
-- dashboard/lib/planOverrides.ts).
--
-- user_id deliberately NOT FK'd to auth.users (house convention, see profiles).
--
-- House conventions: BEGIN/COMMIT, IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql mirrors it. Applies cleanly twice on a scratch DB.

BEGIN;

CREATE TABLE IF NOT EXISTS plan_overrides (
  user_id    UUID PRIMARY KEY,
  plan       TEXT NOT NULL CHECK (plan IN ('standard','pro')),
  expires_at TIMESTAMPTZ,          -- NULL = pinned until cleared
  note       TEXT,                 -- operator memo ("comped for feedback")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plan_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON plan_overrides;
CREATE POLICY no_anon_access ON plan_overrides FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS owner_read ON plan_overrides;
CREATE POLICY owner_read ON plan_overrides FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
GRANT SELECT ON plan_overrides TO authenticated;

INSERT INTO schema_migrations (filename) VALUES ('2026-07-16-plan-overrides.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Mirror into schema.sql**

Find the `invite_allowances` block in `schema.sql` (`grep -n "invite_allowances" schema.sql`). Immediately after that table's block (table + its RLS/GRANT statements, matching however schema.sql lays those out for invite_allowances), add the same `CREATE TABLE plan_overrides …` + `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + both policies + `GRANT SELECT` as in the migration (schema.sql may use bare `CREATE TABLE` without `IF NOT EXISTS` — match the file's local style), with this header comment:

```sql
-- Operator-pinned effective tier (see migrations/2026-07-16-plan-overrides.sql).
-- An ACTIVE row (expires_at NULL or future) wins over subscription + invite comp in
-- resolvePlan/resolve_plan. Service-write-only; owner may SELECT their own pin.
```

- [ ] **Step 3: Add the RLS contract entries (failing test first)**

In `tests/test_rls_isolation.py`, find the policy-contract dict entry for `"invite_allowances"` (~line 425) and add a sibling right below it:

```python
    # Operator-pinned effective tier (2026-07-16-plan-overrides): owner may READ their
    # own pin; all writes are service-role (isAdmin-gated admin action →
    # dashboard/lib/planOverrides.ts).
    "plan_overrides": {
        "no_anon_access": _DENY,
        "owner_read": ("SELECT", frozenset({"authenticated"})),
    },
```

Then find the grant-allowlist dict (~line 518, the one with `"invite_allowances":    (_R(), _R({"SELECT"})),`) and add below that line, matching the file's alignment style:

```python
    "plan_overrides":       (_R(), _R({"SELECT"})),           # owner reads own pin
```

- [ ] **Step 4: Run the RLS suite against the local test DB**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_rls_isolation.py -q`

Expected: PASS (conftest rebuilds the test schema from `schema.sql`, so the new table, policies, and grants are all verified). If any additional drift-guard in that file fails (e.g., a user_id-table discovery check), read its assertion message and add `plan_overrides` to the guard's expected set with a one-line comment matching its neighbors — the failure message names the exact structure. If the run reports the suite SKIPPED, the DB env is not set up — fix that rather than accepting the skip.

- [ ] **Step 5: Verify the migration is rerunnable**

Run: `TEST_DATABASE_URL=... psql "$TEST_DATABASE_URL" -f migrations/2026-07-16-plan-overrides.sql && psql "$TEST_DATABASE_URL" -f migrations/2026-07-16-plan-overrides.sql`

Expected: both applications succeed (idempotent). If `psql` isn't available locally, skip this step and note it in the commit body — the IF NOT EXISTS/DROP POLICY IF EXISTS forms are the same as every prior migration.

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-07-16-plan-overrides.sql schema.sql tests/test_rls_isolation.py
git commit -m "feat(db): plan_overrides table — operator-pinned effective tier"
```

---

### Task 2: TS `resolvePlan` override parameter (TDD)

**Files:**
- Modify: `dashboard/lib/entitlements.ts` (resolvePlan + new type, ~lines 131-175)
- Test: `dashboard/lib/entitlements.test.ts`

**Interfaces:**
- Consumes: existing `resolvePlan(sub, invited, now, compPlan)`.
- Produces: `export interface PlanOverrideLike { plan: Plan | string | null; expires_at: Date | string | null }` and `resolvePlan(sub, invited, now?, compPlan?, override?: PlanOverrideLike | null)` — override appended LAST so all existing call sites compile unchanged. Tasks 5 and 7 pass `override` as the 5th argument.

- [ ] **Step 1: Write the failing tests**

In `dashboard/lib/entitlements.test.ts`, after the existing `describe("resolvePlan", …)` block, add (reusing the file's `NOW` and `future` helpers):

```ts
describe("resolvePlan operator override (pin semantics)", () => {
  test("active pin DOWNGRADES below a paying subscription", () => {
    expect(
      resolvePlan(
        { plan: "pro", status: "active", current_period_end: future(10) },
        false, NOW, "standard", { plan: "standard", expires_at: null },
      ),
    ).toBe("standard");
  });

  test("active pin comps a stranger (no sub, not invited) to pro", () => {
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: null })).toBe("pro");
  });

  test("pin wins even when invite comping is off (compPlan none)", () => {
    expect(resolvePlan(null, true, NOW, "none", { plan: "standard", expires_at: null })).toBe("standard");
  });

  test("future-dated pin is active; expired pin falls through", () => {
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(1) })).toBe("pro");
    // expired + invited → back to the natural comp
    expect(resolvePlan(null, true, NOW, "standard", { plan: "pro", expires_at: future(-1) })).toBe("standard");
    // expired + stranger → null
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(-1) })).toBeNull();
  });

  test("string expiry (DB/json round-trip) works; junk plan or junk date is inert", () => {
    expect(
      resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(2).toISOString() }),
    ).toBe("pro");
    expect(resolvePlan(null, false, NOW, "standard", { plan: "platinum", expires_at: null })).toBeNull();
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: "not-a-date" })).toBeNull();
  });

  test("a pin is NOT trial-clamped — pro pin + trialing pro sub stays pro", () => {
    expect(
      resolvePlan(
        { plan: "pro", status: "trialing", current_period_end: future(5) },
        false, NOW, "standard", { plan: "pro", expires_at: null },
      ),
    ).toBe("pro");
  });

  test("null/absent override preserves existing behavior exactly", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(10) }, false, NOW, "standard", null),
    ).toBe("pro");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test -- lib/entitlements.test.ts`
Expected: FAIL — TypeScript/vitest errors on the 5-argument calls (resolvePlan accepts 4).

- [ ] **Step 3: Implement**

In `dashboard/lib/entitlements.ts`, add below the `SubscriptionLike` interface:

```ts
/** Shape of a plan_overrides row as resolvePlan consumes it (Task boundary: the
 * operator pin). expires_at tolerates the string form a JSON/DB round-trip yields. */
export interface PlanOverrideLike {
  plan: Plan | string | null;
  expires_at: Date | string | null;
}
```

Change the `resolvePlan` signature and add the pin check as the FIRST logic in the body:

```ts
export function resolvePlan(
  sub: SubscriptionLike | null,
  invited: boolean,
  now: Date = new Date(),
  compPlan: InviteCompPlan = DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
  override: PlanOverrideLike | null = null,
): Plan | null {
  // Operator pin (plan_overrides, spec 2026-07-16): an ACTIVE override returns exactly
  // its plan — it wins over the subscription AND the invite comp, and the trialing
  // clamp below does not apply (a pin is explicit operator intent). Expired, junk, or
  // absent overrides are inert. Mirrored in entitlements.py resolve_plan.
  if (override && (override.plan === "standard" || override.plan === "pro")) {
    if (override.expires_at == null) return override.plan;
    const exp =
      override.expires_at instanceof Date ? override.expires_at : new Date(override.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() > now.getTime()) return override.plan;
  }
  // …existing subscription/invite logic below, byte-for-byte unchanged…
```

Also extend the function's doc comment first line list with: `— unless an operator override pins the plan (plan_overrides; see spec 2026-07-16).`

- [ ] **Step 4: Run to verify pass**

Run: `cd dashboard && npm test -- lib/entitlements.test.ts`
Expected: PASS — all pre-existing resolvePlan tests plus the 7 new ones.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/entitlements.ts dashboard/lib/entitlements.test.ts
git commit -m "feat(entitlements): resolvePlan operator-override pin (TS)"
```

---

### Task 3: Python `resolve_plan` mirror (TDD)

**Files:**
- Modify: `reviewer/entitlements.py` (`resolve_plan`, ~line 115)
- Test: `tests/test_entitlements.py`

**Interfaces:**
- Consumes: existing `resolve_plan(sub, invited, now=None, comp_plan=DEFAULT_INVITE_COMP_PLAN)`.
- Produces: `resolve_plan(sub, invited, now=None, comp_plan=DEFAULT_INVITE_COMP_PLAN, override=None)` where `override` is a mapping with keys `plan` and `expires_at` (tz-aware datetime or None) — Task 8 passes it as `override={"plan": …, "expires_at": …}`.

- [ ] **Step 1: Write the failing tests**

In `tests/test_entitlements.py`, after `test_resolve_plan_none_current_period_end`, add (reuse the file's `NOW` and `_sub` helpers; ensure `timedelta` is imported from `datetime` at the top — add it to the existing import line if absent):

```python
def test_resolve_plan_override_downgrades_paying_sub():
    ov = {"plan": "standard", "expires_at": None}
    assert resolve_plan(_sub("pro", "active", 10), False, NOW, override=ov) == "standard"


def test_resolve_plan_override_comps_stranger_to_pro():
    ov = {"plan": "pro", "expires_at": None}
    assert resolve_plan(None, False, NOW, override=ov) == "pro"


def test_resolve_plan_override_beats_comp_plan_none():
    ov = {"plan": "standard", "expires_at": None}
    assert resolve_plan(None, True, NOW, comp_plan="none", override=ov) == "standard"


def test_resolve_plan_override_expiry():
    active = {"plan": "pro", "expires_at": NOW + timedelta(days=1)}
    lapsed = {"plan": "pro", "expires_at": NOW - timedelta(days=1)}
    assert resolve_plan(None, False, NOW, override=active) == "pro"
    assert resolve_plan(None, True, NOW, override=lapsed) == "standard"  # falls back to comp
    assert resolve_plan(None, False, NOW, override=lapsed) is None


def test_resolve_plan_override_junk_plan_is_inert():
    assert resolve_plan(None, False, NOW, override={"plan": "platinum", "expires_at": None}) is None


def test_resolve_plan_override_not_trial_clamped():
    ov = {"plan": "pro", "expires_at": None}
    assert resolve_plan(_sub("pro", "trialing", 5), False, NOW, override=ov) == "pro"
```

- [ ] **Step 2: Run to verify failure**

Run: `python3 -m pytest tests/test_entitlements.py -q`
Expected: FAIL — `TypeError: resolve_plan() got an unexpected keyword argument 'override'`.

- [ ] **Step 3: Implement**

In `reviewer/entitlements.py`, change the signature and insert the pin check immediately after the `now` default resolution (BEFORE the subscription branch):

```python
def resolve_plan(sub, invited, now=None, comp_plan=DEFAULT_INVITE_COMP_PLAN, override=None):
```

Extend the docstring's semantics list with a first bullet:

```
      - an ACTIVE operator override (plan_overrides row; expires_at None or in the
        future) -> exactly its plan, winning over subscription AND invite comp; the
        trialing clamp does not apply (a pin is explicit operator intent)
```

Body insert (right after the `if now is None:` block):

```python
    # Operator pin (plan_overrides, spec 2026-07-16). Mirrors resolvePlan in
    # entitlements.ts: active pin wins over everything; expired/junk pins are inert.
    if override is not None:
        ov_plan = override.get("plan")
        if ov_plan in ("standard", "pro"):
            exp = override.get("expires_at")
            if exp is None or exp > now:
                return ov_plan
```

- [ ] **Step 4: Run to verify pass (and parity untouched)**

Run: `python3 -m pytest tests/test_entitlements.py tests/test_entitlements_parity.py -q`
Expected: PASS, with test_entitlements_parity requiring NO changes (this feature adds no mirrored constants).

- [ ] **Step 5: Commit**

```bash
git add reviewer/entitlements.py tests/test_entitlements.py
git commit -m "feat(entitlements): resolve_plan operator-override pin (Python mirror)"
```

---

### Task 4: `lib/planOverrides.ts` — read/write helpers + service-role allowlist

**Files:**
- Create: `dashboard/lib/planOverrides.ts`
- Modify: `dashboard/lib/serviceRoleAllowlist.test.ts` (ALLOWLIST array, ~line 16)

**Interfaces:**
- Consumes: `serviceSql`, `withUserSql` from `@/lib/db`; `Plan` from `@/lib/entitlements`; table from Task 1.
- Produces: `getOwnPlanOverride(userId: string): Promise<PlanOverrideRow | null>` where `PlanOverrideRow = { plan: Plan; expires_at: Date | null }` (consumed by Task 5); `setPlanOverride(userId: string, plan: Plan, expiresAt: Date | null, note: string | null): Promise<void>` and `clearPlanOverride(userId: string): Promise<void>` (consumed by Task 6).

- [ ] **Step 1: Create the module**

Create `dashboard/lib/planOverrides.ts`:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// plan_overrides is service-write-only (owner_read SELECT is its only authenticated
// policy). setPlanOverride/clearPlanOverride are the write paths, called ONLY from the
// isAdmin-gated action (app/actions/adminSettings.ts setPlanOverrideAction) — the
// operator pins ANOTHER user's tier, so the write is legitimately cross-tenant (same
// argument as lib/tenantMetrics.ts). getOwnPlanOverride READS stay on RLS (withUserSql).
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql, withUserSql } from "@/lib/db";
import type { Plan } from "@/lib/entitlements";

// Operator-pinned effective tier (spec 2026-07-16-admin-plan-override). One row per
// user; an ACTIVE row (expires_at NULL or future) wins in resolvePlan. Clearing the
// pin DELETES the row — absence is the "no override" state, so there is no
// tri-state to misread.

export interface PlanOverrideRow {
  plan: Plan;
  expires_at: Date | null;
}

/** The viewer's OWN pin (owner_read RLS) — getViewerPlan's override input. */
export async function getOwnPlanOverride(userId: string): Promise<PlanOverrideRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT plan, expires_at FROM plan_overrides WHERE user_id = ${userId}::uuid
    `;
    return (rows[0] as unknown as PlanOverrideRow) ?? null;
  });
}

/** Pin a user's effective plan (admin). expiresAt null = pinned until cleared. */
export async function setPlanOverride(
  userId: string,
  plan: Plan,
  expiresAt: Date | null,
  note: string | null,
): Promise<void> {
  await serviceSql`
    INSERT INTO plan_overrides (user_id, plan, expires_at, note)
    VALUES (${userId}::uuid, ${plan}, ${expiresAt}, ${note})
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan, expires_at = EXCLUDED.expires_at, note = EXCLUDED.note,
      updated_at = now()
  `;
}

/** Remove the pin — resolution falls back to subscription, then invite comp. */
export async function clearPlanOverride(userId: string): Promise<void> {
  await serviceSql`DELETE FROM plan_overrides WHERE user_id = ${userId}::uuid`;
}
```

- [ ] **Step 2: Allowlist the new serviceSql import site**

In `dashboard/lib/serviceRoleAllowlist.test.ts`, add one entry inside the `ALLOWLIST` array (order within the literal doesn't matter — the array is `.sort()`ed):

```ts
  "lib/planOverrides.ts", // operator-pinned effective tier: service-write-only plan_overrides; writes reachable only via the isAdmin-gated setPlanOverrideAction
```

- [ ] **Step 3: Run the allowlist test**

Run: `cd dashboard && npm test -- lib/serviceRoleAllowlist.test.ts`
Expected: PASS. (Without Step 2 it fails, naming lib/planOverrides.ts as an unallowlisted offender — if you want to see the failing state first, run between Steps 1 and 2.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/planOverrides.ts dashboard/lib/serviceRoleAllowlist.test.ts
git commit -m "feat(dashboard): plan_overrides read/write helpers (service-role allowlisted)"
```

---

### Task 5: Wire the pin into `getViewerPlan` (TDD)

**Files:**
- Modify: `dashboard/lib/subscriptions.ts` (`getViewerPlan`, ~lines 41-54)
- Test (create): `dashboard/lib/getViewerPlan.test.ts`

**Interfaces:**
- Consumes: `getOwnPlanOverride` (Task 4), `resolvePlan` 5th param (Task 2).
- Produces: unchanged signature `getViewerPlan(userId, email)` — every existing money gate gets pin-awareness for free.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/getViewerPlan.test.ts` (a dedicated file — `subscriptions.test.ts` is a webhook-focused harness whose db mock returns one shared row set for every withUserSql query, which can't distinguish the subscription read from the override read):

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

// getViewerPlan = getSubscription (withUserSql) + isInvitedUser + loadAppSettings +
// getOwnPlanOverride, composed through resolvePlan (REAL — the pin semantics under
// test live there). Everything else is mocked at the module boundary.

const state = vi.hoisted(() => ({
  sub: null as unknown,
  invited: false,
  override: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  serviceSql: vi.fn(),
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) =>
    fn(() => Promise.resolve(state.sub ? [state.sub] : [])),
}));
vi.mock("@/lib/invites", () => ({ isInvitedUser: vi.fn(async () => state.invited) }));
vi.mock("@/lib/appSettings", () => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/planOverrides", () => ({
  getOwnPlanOverride: vi.fn(async () => state.override),
}));

const { getViewerPlan } = await import("@/lib/subscriptions");

beforeEach(() => {
  state.sub = null;
  state.invited = false;
  state.override = null;
});

describe("getViewerPlan operator pin", () => {
  test("active pin comps a stranger to pro", async () => {
    state.override = { plan: "pro", expires_at: null };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("pro");
  });

  test("active pin downgrades a paying pro subscriber to standard", async () => {
    state.sub = {
      user_id: "u1", stripe_customer_id: null, stripe_subscription_id: null,
      plan: "pro", status: "active",
      current_period_end: new Date(Date.now() + 10 * 86400_000), cancel_at_period_end: false,
    };
    state.override = { plan: "standard", expires_at: null };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("standard");
  });

  test("expired pin falls back to the invite comp", async () => {
    state.invited = true;
    state.override = { plan: "pro", expires_at: new Date(Date.now() - 86400_000) };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("standard");
  });

  test("no pin: stranger stays null (existing behavior)", async () => {
    expect(await getViewerPlan("u1", "a@x.com")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test -- lib/getViewerPlan.test.ts`
Expected: FAIL — "active pin comps a stranger to pro" and "downgrades" get null/"pro" (getViewerPlan doesn't consume the override yet).

- [ ] **Step 3: Implement**

In `dashboard/lib/subscriptions.ts` add the import and extend `getViewerPlan`:

```ts
import { getOwnPlanOverride } from "@/lib/planOverrides";
```

```ts
export async function getViewerPlan(userId: string, email: string | null): Promise<Plan | null> {
  const [sub, invited, settings, override] = await Promise.all([
    getSubscription(userId),
    email ? isInvitedUser(email) : Promise.resolve(false),
    loadAppSettings(),
    getOwnPlanOverride(userId),
  ]);
  return resolvePlan(sub, invited, new Date(), settings.inviteCompPlan, override);
}
```

Extend the getViewerPlan doc comment's composition list: `…the subscription mirror + the server-side invite proof + the operator pin (plan_overrides) through resolvePlan…`.

- [ ] **Step 4: Run to verify pass (plus the neighboring suite)**

Run: `cd dashboard && npm test -- lib/getViewerPlan.test.ts lib/subscriptions.test.ts`
Expected: both PASS (subscriptions.test.ts confirms the webhook harness is unaffected by the new import).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/subscriptions.ts dashboard/lib/getViewerPlan.test.ts
git commit -m "feat(dashboard): getViewerPlan honors the operator plan pin"
```

---

### Task 6: `setPlanOverrideAction` (TDD)

**Files:**
- Modify: `dashboard/app/actions/adminSettings.ts`
- Test: `dashboard/app/actions/adminSettings.test.ts`

**Interfaces:**
- Consumes: `setPlanOverride`/`clearPlanOverride` (Task 4), `isAdmin`/`getUserClaims`, existing `AdminActionResult` + `UUID_RE` in the same file.
- Produces: `setPlanOverrideAction(input: { userId: string; plan: string; expiresAt: string; note: string }): Promise<AdminActionResult>` — `plan` `"standard" | "pro" | ""` (empty = clear), `expiresAt` `""` or `YYYY-MM-DD` (future; stored as midnight UTC), `note` trimmed, `""` → NULL, ≤200 chars. Consumed by Task 9's control.

- [ ] **Step 1: Write the failing tests**

In `dashboard/app/actions/adminSettings.test.ts`: add the module mock next to the existing ones at the top:

```ts
const overrides = vi.hoisted(() => ({
  setPlanOverride: vi.fn(async () => {}),
  clearPlanOverride: vi.fn(async () => {}),
}));
vi.mock("@/lib/planOverrides", () => overrides);
```

Extend the import line to include `setPlanOverrideAction`. In the `"admin gate FIRST"` describe's `"non-admin throws before any write"` test, add:

```ts
    await expect(
      setPlanOverrideAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", plan: "pro", expiresAt: "", note: "" }),
    ).rejects.toThrow();
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
    expect(overrides.clearPlanOverride).not.toHaveBeenCalled();
```

Then a new describe at the end of the file:

```ts
describe("setPlanOverrideAction", () => {
  const UID = "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f";

  test("valid set upserts with UTC-midnight expiry and trimmed note", async () => {
    const r = await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "2099-01-02", note: " beta comp " });
    expect(r).toEqual({ ok: true });
    expect(overrides.setPlanOverride).toHaveBeenCalledWith(UID, "pro", new Date("2099-01-02T00:00:00Z"), "beta comp");
  });

  test("no expiry and empty note are stored as nulls", async () => {
    await setPlanOverrideAction({ userId: UID, plan: "standard", expiresAt: "", note: "" });
    expect(overrides.setPlanOverride).toHaveBeenCalledWith(UID, "standard", null, null);
  });

  test("empty plan clears the pin (never upserts)", async () => {
    const r = await setPlanOverrideAction({ userId: UID, plan: "", expiresAt: "", note: "" });
    expect(r).toEqual({ ok: true });
    expect(overrides.clearPlanOverride).toHaveBeenCalledWith(UID);
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
  });

  test("bad uuid / bad plan / malformed or past expiry / oversized note → legible errors, no writes", async () => {
    expect((await setPlanOverrideAction({ userId: "nope", plan: "pro", expiresAt: "", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "platinum", expiresAt: "", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "someday", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "2001-01-01", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "", note: "x".repeat(201) })).ok).toBe(false);
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
    expect(overrides.clearPlanOverride).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test -- app/actions/adminSettings.test.ts`
Expected: FAIL — `setPlanOverrideAction` is not exported.

- [ ] **Step 3: Implement**

In `dashboard/app/actions/adminSettings.ts`, add the import at the top:

```ts
import { clearPlanOverride, setPlanOverride } from "@/lib/planOverrides";
```

And append after `setInviteAllowanceAction`:

```ts
/**
 * Pin (or clear) a tenant's effective tier (plan_overrides, spec 2026-07-16).
 * plan "" = clear the pin; expiresAt "" = pinned until cleared, else a FUTURE
 * YYYY-MM-DD stored as midnight UTC (the pin lapses at the start of that UTC day).
 */
export async function setPlanOverrideAction(input: {
  userId: string;
  plan: string;
  expiresAt: string;
  note: string;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  if (!UUID_RE.test(input.userId)) return { ok: false, error: "Invalid user id." };

  const plan = input.plan.trim().toLowerCase();
  if (plan === "") {
    try {
      await clearPlanOverride(input.userId);
      return { ok: true };
    } catch (err) {
      console.error("setPlanOverrideAction clear failed", err);
      return { ok: false, error: "Couldn't clear the override. Please try again." };
    }
  }
  if (plan !== "standard" && plan !== "pro") {
    return { ok: false, error: "Override must be Standard, Pro, or No override." };
  }

  let expiresAt: Date | null = null;
  const rawExpiry = input.expiresAt.trim();
  if (rawExpiry !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)) {
      return { ok: false, error: "Expiry must be a date (YYYY-MM-DD)." };
    }
    expiresAt = new Date(`${rawExpiry}T00:00:00Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: "Expiry must be in the future." };
    }
  }

  const note = input.note.trim();
  if (note.length > 200) return { ok: false, error: "Note must be 200 characters or fewer." };

  try {
    await setPlanOverride(input.userId, plan, expiresAt, note === "" ? null : note);
    return { ok: true };
  } catch (err) {
    console.error("setPlanOverrideAction failed", err);
    return { ok: false, error: "Couldn't save the override. Please try again." };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd dashboard && npm test -- app/actions/adminSettings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/actions/adminSettings.ts dashboard/app/actions/adminSettings.test.ts
git commit -m "feat(admin): setPlanOverrideAction — pin/clear a tenant's effective tier"
```

---

### Task 7: `getTenantMetrics` carries and applies the pin (TDD)

**Files:**
- Modify: `dashboard/lib/tenantMetrics.ts`
- Test: `dashboard/lib/tenantMetrics.test.ts`

**Interfaces:**
- Consumes: `plan_overrides` table (Task 1), `resolvePlan` 5th param (Task 2).
- Produces: `TenantMetric` gains `overridePlan: Plan | null`, `overrideExpiresAt: Date | null`, `overrideNote: string | null`; `plan` is now pin-aware. Consumed by Task 9's page.

- [ ] **Step 1: Write the failing tests**

In `dashboard/lib/tenantMetrics.test.ts` add to the `getTenantMetrics` describe (matching the file's fixture idiom — plain row objects for the mocked `serviceSql.unsafe`):

```ts
  test("an ACTIVE override pins the effective plan and surfaces its fields", async () => {
    rows.value = [{
      user_id: "u3", email: "c@x.com",
      plan: null, status: null, current_period_end: null, invited: false,
      reviews_today: 0, reviews_30d: 0, resume_month: 0, cover_month: 0,
      last_run_at: null, last_run_errors: null,
      active_requests: 0, failed_requests: 0, profile_updated_at: null,
      invites_remaining: null,
      override_plan: "pro", override_expires_at: null, override_note: "beta comp",
    }];
    const out = await getTenantMetrics();
    expect(out[0].plan).toBe("pro"); // stranger, no sub — the pin alone entitles
    expect(out[0].overridePlan).toBe("pro");
    expect(out[0].overrideExpiresAt).toBeNull();
    expect(out[0].overrideNote).toBe("beta comp");
  });

  test("an EXPIRED override does not entitle but is still surfaced for the editor", async () => {
    rows.value = [{
      user_id: "u4", email: "d@x.com",
      plan: null, status: null, current_period_end: null, invited: true,
      reviews_today: 0, reviews_30d: 0, resume_month: 0, cover_month: 0,
      last_run_at: null, last_run_errors: null,
      active_requests: 0, failed_requests: 0, profile_updated_at: null,
      invites_remaining: null,
      override_plan: "pro", override_expires_at: new Date("2000-01-01"), override_note: null,
    }];
    const out = await getTenantMetrics();
    expect(out[0].plan).toBe("standard"); // falls back to the invite comp
    expect(out[0].overridePlan).toBe("pro"); // lapsed row still shown so admin can clear/renew
  });
```

(The existing fixtures omit the `override_*` keys — they read as `undefined` → no override; those tests must keep passing untouched.)

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test -- lib/tenantMetrics.test.ts`
Expected: FAIL — `out[0].plan` is null and `overridePlan` is undefined.

- [ ] **Step 3: Implement**

In `dashboard/lib/tenantMetrics.ts`:

1. Import type: change the entitlements import to `import { resolvePlan, type Plan, type PlanOverrideLike } from "@/lib/entitlements";`
2. `TenantMetric`: after `invitesRemaining`, add:

```ts
  // Operator pin (plan_overrides). Surfaced even when lapsed so the row editor can
  // show/clear it; `plan` above only reflects an ACTIVE pin (resolvePlan decides).
  overridePlan: Plan | null;
  overrideExpiresAt: Date | null;
  overrideNote: string | null;
```

3. `Row`: add `override_plan: string | null; override_expires_at: Date | null; override_note: string | null;`
4. `_SQL`: in the final SELECT list, after `ia.remaining AS invites_remaining`, add:

```sql
  po.plan AS override_plan, po.expires_at AS override_expires_at, po.note AS override_note
```

(with a comma after `invites_remaining`), and after the `LEFT JOIN invite_allowances ia …` line add:

```sql
LEFT JOIN plan_overrides po ON po.user_id = p.user_id
```

5. In the mapping, before the `resolvePlan` call:

```ts
    const override: PlanOverrideLike | null =
      r.override_plan != null ? { plan: r.override_plan, expires_at: r.override_expires_at } : null;
```

pass it as the 5th argument:

```ts
    const plan = resolvePlan(
      { plan: r.plan, status: r.status, current_period_end: r.current_period_end },
      r.invited,
      new Date(),
      settings.inviteCompPlan,
      override,
    );
```

and add to the returned object:

```ts
      overridePlan: r.override_plan === "standard" || r.override_plan === "pro" ? r.override_plan : null,
      overrideExpiresAt: r.override_expires_at,
      overrideNote: r.override_note,
```

- [ ] **Step 4: Run to verify pass**

Run: `cd dashboard && npm test -- lib/tenantMetrics.test.ts`
Expected: PASS — the two new tests plus every pre-existing one.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/tenantMetrics.ts dashboard/lib/tenantMetrics.test.ts
git commit -m "feat(admin): tenant metrics carry and apply the plan-override pin"
```

---

### Task 8: Reviewer wiring — `load_profiles` + `_review_user` (TDD)

**Files:**
- Modify: `reviewer/db.py` (`_PROFILE_COLUMNS` + `_LOAD_PROFILES_SQL`, ~lines 39-52)
- Modify: `reviewer/run.py` (`_review_user` tier gate, ~lines 315-325)
- Test: `tests/test_reviewer_db.py`

**Interfaces:**
- Consumes: `plan_overrides` table (Task 1), `resolve_plan(…, override=…)` (Task 3).
- Produces: each profile dict from `load_profiles` / the single-user variant gains `ov_plan` (str|None) and `ov_expires_at` (tz-aware datetime|None).

- [ ] **Step 1: Write the failing tests**

In `tests/test_reviewer_db.py`:

1. In `test_load_profiles`, extend the expected dict (it asserts the FULL dict, so the new columns must appear) — after `"invited": False`, add:

```python
         # Operator pin (plan_overrides) — none for this user.
         "ov_plan": None, "ov_expires_at": None,
```

2. Add a new test right after it:

```python
@requires_db
def test_load_profiles_carries_plan_override(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
        cur.execute(
            "INSERT INTO plan_overrides (user_id, plan, note) VALUES (%s, 'pro', 'beta comp')",
            (USER,),
        )
    conn.commit()
    profiles = rdb.load_profiles(conn)
    assert profiles[0]["ov_plan"] == "pro"
    assert profiles[0]["ov_expires_at"] is None
```

- [ ] **Step 2: Run to verify failure**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_reviewer_db.py -q`
Expected: FAIL — `test_load_profiles` dict mismatch (no ov_* keys) and `KeyError: 'ov_plan'` in the new test. A SKIP means the DB env is missing — fix it; do not proceed on a skip.

- [ ] **Step 3: Implement**

In `reviewer/db.py`, extend `_PROFILE_COLUMNS` (after the `invited` line, keeping the comma discipline):

```python
_PROFILE_COLUMNS = """
    p.user_id, p.resume_text, p.instructions, p.profile_version,
    p.model_stage1, p.model_stage2, p.preferred_locations, p.daily_review_cap,
    s.plan AS sub_plan, s.status AS sub_status,
    s.current_period_end AS sub_current_period_end,
    EXISTS(SELECT 1 FROM invite_redemptions ir WHERE ir.user_id = p.user_id) AS invited,
    po.plan AS ov_plan, po.expires_at AS ov_expires_at
"""
```

and add the join in `_LOAD_PROFILES_SQL`:

```python
_LOAD_PROFILES_SQL = f"""
    SELECT {_PROFILE_COLUMNS}
    FROM profiles p
    LEFT JOIN subscriptions s ON s.user_id = p.user_id
    LEFT JOIN plan_overrides po ON po.user_id = p.user_id
"""
```

Also extend the comment above `_LOAD_PROFILES_SQL`: `…so run._review_user can resolve each user's tier entitlement (plan → model + daily cap), including the operator pin (plan_overrides).`

In `reviewer/run.py` `_review_user`, replace the `plan = entitlements.resolve_plan(...)` line (keep the `sub = {...}` dict as-is):

```python
        override = None
        if profile.get("ov_plan"):
            override = {"plan": profile.get("ov_plan"), "expires_at": profile.get("ov_expires_at")}
        plan = entitlements.resolve_plan(
            sub, bool(profile.get("invited")), comp_plan=comp_plan, override=override
        )
```

and extend the tier-gate comment above it: `…subscription mirror + invite proof + operator pin (all loaded by db.load_profiles).`

- [ ] **Step 4: Run to verify pass**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest tests/test_reviewer_db.py tests/test_entitlements.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py reviewer/run.py tests/test_reviewer_db.py
git commit -m "feat(reviewer): honor the operator plan pin in the tier gate"
```

---

### Task 9: Admin UI — `PlanOverrideControl` + tenants-page column (TDD)

**Files:**
- Create: `dashboard/components/admin/PlanOverrideControl.tsx`
- Test (create): `dashboard/components/admin/PlanOverrideControl.test.tsx`
- Modify: `dashboard/components/secondary-surfaces.css` (after the `.rf-allowance-editor` block, ~line 58)
- Modify: `dashboard/app/admin/tenants/page.tsx`

**Interfaces:**
- Consumes: `setPlanOverrideAction` (Task 6), `TenantMetric.overridePlan/overrideExpiresAt/overrideNote` (Task 7), `Button` from `@/components/ui/Button`, `Badge` from `@/components/ui/Panel`.
- Produces: `<PlanOverrideControl userId plan expiresAt note />` where `plan: "" | "standard" | "pro"`, `expiresAt`/`note` are strings (`""` = none; expiry as `YYYY-MM-DD`).

- [ ] **Step 1: Write the failing component test**

Create `dashboard/components/admin/PlanOverrideControl.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Thin client shell over the server action: assert rendered state + the values handed
// to the (mocked) action — never real network or DB (dashboard-component-tests-jsdom
// convention, same as InviteGenerator.test.tsx).

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

const action = vi.hoisted(() => ({
  setPlanOverrideAction: vi.fn<
    (input: unknown) => Promise<{ ok: true } | { ok: false; error: string }>
  >(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/adminSettings", () => action);

import { PlanOverrideControl } from "./PlanOverrideControl";

const UID = "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f";

afterEach(() => {
  cleanup();
  nav.refresh.mockClear();
  action.setPlanOverrideAction.mockClear();
});

describe("PlanOverrideControl", () => {
  test("expiry and note stay hidden until a plan is picked", () => {
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    expect((screen.getByLabelText("Plan override") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByLabelText("Override expiry (optional)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "pro" } });
    expect(screen.getByLabelText("Override expiry (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Override note (optional)")).toBeTruthy();
  });

  test("Set submits plan/expiry/note and refreshes on success", async () => {
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "pro" } });
    fireEvent.change(screen.getByLabelText("Override expiry (optional)"), { target: { value: "2099-01-02" } });
    fireEvent.change(screen.getByLabelText("Override note (optional)"), { target: { value: "beta comp" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("button", { name: "Set" })).toBeTruthy(); // action settled
    expect(action.setPlanOverrideAction).toHaveBeenCalledWith({
      userId: UID, plan: "pro", expiresAt: "2099-01-02", note: "beta comp",
    });
    expect(nav.refresh).toHaveBeenCalled();
  });

  test("switching back to No override submits an empty plan (clear)", async () => {
    render(<PlanOverrideControl userId={UID} plan="pro" expiresAt="2099-01-02" note="x" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("button", { name: "Set" })).toBeTruthy();
    expect(action.setPlanOverrideAction).toHaveBeenCalledWith({
      userId: UID, plan: "", expiresAt: "", note: "",
    });
  });

  test("an action error surfaces as an alert and does not refresh", async () => {
    action.setPlanOverrideAction.mockResolvedValueOnce({ ok: false, error: "Expiry must be in the future." });
    render(<PlanOverrideControl userId={UID} plan="" expiresAt="" note="" />);
    fireEvent.change(screen.getByLabelText("Plan override"), { target: { value: "standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test -- components/admin/PlanOverrideControl.test.tsx`
Expected: FAIL — module `./PlanOverrideControl` not found.

- [ ] **Step 3: Implement the component + CSS**

Create `dashboard/components/admin/PlanOverrideControl.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPlanOverrideAction } from "@/app/actions/adminSettings";
import { Button } from "@/components/ui/Button";

// Per-tenant effective-tier pin (isAdmin-gated /admin/tenants; the action re-gates).
// plan "" = no pin (natural subscription/invite resolution). Set with a plan upserts;
// Set on "No override" clears. Expiry/note only apply alongside a plan, so they are
// hidden (and submitted empty) when clearing. Compact inline editor like
// AllowanceEditor; geometry lives in .rf-override-editor (secondary-surfaces.css).
export function PlanOverrideControl({
  userId,
  plan,
  expiresAt,
  note,
}: {
  userId: string;
  plan: "" | "standard" | "pro";
  expiresAt: string; // YYYY-MM-DD or ""
  note: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(plan);
  const [expiry, setExpiry] = useState(expiresAt);
  const [memo, setMemo] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await setPlanOverrideAction({
        userId,
        plan: value,
        expiresAt: value === "" ? "" : expiry,
        note: value === "" ? "" : memo,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't save the override. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="rf-override-editor">
      <select
        value={value}
        aria-label="Plan override"
        onChange={(e) => setValue(e.target.value)}
        className="rf-control rf-focusable rf-override-editor__select"
      >
        <option value="">No override</option>
        <option value="standard">Standard</option>
        <option value="pro">Pro</option>
      </select>
      {value !== "" && (
        <>
          <input
            type="date"
            value={expiry}
            aria-label="Override expiry (optional)"
            onChange={(e) => setExpiry(e.target.value)}
            className="rf-control rf-focusable rf-override-editor__date"
          />
          <input
            type="text"
            value={memo}
            maxLength={200}
            placeholder="note"
            aria-label="Override note (optional)"
            onChange={(e) => setMemo(e.target.value)}
            className="rf-control rf-focusable rf-override-editor__note"
          />
        </>
      )}
      <Button size="sm" onClick={save} loading={busy} loadingLabel="Saving override">
        Set
      </Button>
      {error && (
        <span role="alert" className="rf-override-editor__error">
          {error}
        </span>
      )}
    </span>
  );
}
```

In `dashboard/components/secondary-surfaces.css`, directly after the `.rf-allowance-editor__input` line, add:

```css
/* Per-tenant plan-override pin editor (Tenants admin page). */
.rf-override-editor { display: inline-flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.rf-override-editor__select { min-width: 118px; }
.rf-override-editor__date { width: 140px; }
.rf-override-editor__note { width: 120px; }
.rf-override-editor__error { flex-basis: 100%; color: var(--danger); font-size: var(--font-size-caption); }
```

- [ ] **Step 4: Run component test to verify pass**

Run: `cd dashboard && npm test -- components/admin/PlanOverrideControl.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the tenants page**

In `dashboard/app/admin/tenants/page.tsx`:

1. Add import: `import { PlanOverrideControl } from "@/components/admin/PlanOverrideControl";`
2. Add a module-level helper under `fmtDate`:

```tsx
// An override entitles only while unexpired; a lapsed row is still handed to the
// editor (so the admin can clear/renew) but must not read as active here.
function overrideActive(t: TenantMetric): boolean {
  return t.overridePlan != null && (t.overrideExpiresAt == null || new Date(t.overrideExpiresAt).getTime() > Date.now());
}
```

3. In `Row`, replace the Plan `<td>` with:

```tsx
      <td>
        {t.plan ? PLAN_LABEL[t.plan] : "None"}
        {overrideActive(t) && (
          <> <Badge tone="accent" title={t.overrideNote ?? undefined}>
            Pinned{t.overrideExpiresAt ? ` until ${fmtDate(t.overrideExpiresAt)}` : ""}
          </Badge></>
        )}
        {t.plan && t.invited && !t.subStatus && !overrideActive(t) && (
          <> <Badge tone="accent">Comped</Badge></>
        )}
      </td>
```

4. Immediately after that Plan cell, add the Override cell:

```tsx
      <td>
        <PlanOverrideControl
          userId={t.userId}
          plan={t.overridePlan ?? ""}
          expiresAt={t.overrideExpiresAt ? new Date(t.overrideExpiresAt).toISOString().slice(0, 10) : ""}
          note={t.overrideNote ?? ""}
        />
      </td>
```

5. In the `<thead>` row, add `<th>Override</th>` right after `<th>Plan</th>`.
6. Bump the table's `minWidth` from `"1080px"` to `"1400px"` (the new cell holds a select + two inputs + button).
7. Update the `PageHeader` description to `"Per-tenant plan, tier pin, usage, pipeline health, and an estimated 30-day review cost."`

- [ ] **Step 6: Run the page-adjacent suites + UI contract**

Run: `cd dashboard && npm test -- app/admin/tenants/page.test.ts app/admin/AdminEmptyStates.test.tsx && npm run test:ui-contract`
Expected: all PASS. (AdminEmptyStates renders the real page with empty data — it exercises the new imports; ui-contract's `auditProductionUi` must accept the new control exactly as it accepts AllowanceEditor. If a contract violation fires, fix the control/CSS to the reported rule — do NOT add exemptions.)

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/admin/PlanOverrideControl.tsx dashboard/components/admin/PlanOverrideControl.test.tsx dashboard/components/secondary-surfaces.css dashboard/app/admin/tenants/page.tsx
git commit -m "feat(admin): per-tenant plan-override editor on /admin/tenants"
```

---

### Task 10: Erasure + export coverage for `plan_overrides`

**Files:**
- Modify: `dashboard/lib/userScopedTables.ts` (`USER_DELETE_TABLES`)
- Modify: `dashboard/lib/accountExport.ts` (`AccountExport` interface + `collectUserRows`)
- Modify (only if their fixtures require it): `dashboard/lib/accountExport.test.ts`, `dashboard/lib/accountDeletion.test.ts`

**Interfaces:**
- Consumes: table from Task 1.
- Produces: account deletion erases `plan_overrides` rows; account export includes the user's pin (single-row object or null, like `invite_allowances`).

- [ ] **Step 1: Classify the table (this intentionally breaks compilation)**

In `dashboard/lib/userScopedTables.ts`, add to `USER_DELETE_TABLES` after `"invite_allowances"`:

```ts
  // Operator-pinned effective tier. Deleting the row with the account is correct:
  // a pin for an erased user is meaningless, and absence is the well-defined state.
  "plan_overrides",
```

- [ ] **Step 2: Verify the completeness guard trips**

Run: `cd dashboard && npm test -- lib/accountExport.test.ts`
Expected: FAIL to compile — the `_ExportCoversEveryTable` assertion in `accountExport.ts` no longer typechecks (AccountExport lacks a `plan_overrides` key). This failure is the drift-guard working.

- [ ] **Step 3: Extend the export**

In `dashboard/lib/accountExport.ts`:

1. `AccountExport` interface — after `invite_allowances: unknown;` add:

```ts
  plan_overrides: unknown;
```

2. In `collectUserRows`, add to the destructuring list (after `inviteAllowances`) a `planOverrides` entry, and to the `Promise.all` array (right after the invite_allowances query):

```ts
      // owner_read RLS grants this SELECT under withUserSql
      tx`SELECT plan, expires_at, note, created_at, updated_at
         FROM plan_overrides WHERE user_id = ${userId}::uuid`,
```

3. In the returned object, after `invite_allowances: …`:

```ts
      plan_overrides: (planOverrides[0] as unknown) ?? null,
```

- [ ] **Step 4: Update test fixtures where the suites enumerate tables**

Run: `cd dashboard && npm test -- lib/accountExport.test.ts lib/accountDeletion.test.ts`

If either fails, the failures are fixture-shaped, not logic-shaped; apply the matching mechanical fix and re-run:
- `accountExport.test.ts`: its SQL-dispatch mock returns rows per table regex (e.g. `if (/FROM invite_redemptions/.test(sql)) …`). Add the sibling dispatch line `if (/FROM plan_overrides/.test(sql)) return rows.plan_overrides ?? [];` and add `plan_overrides: []` (or a one-row fixture) to each `rows` fixture object, mirroring exactly how `invite_allowances` appears in that file.
- `accountDeletion.test.ts`: it loops `USER_DELETE_TABLES`, so the new table is usually covered automatically; if an expected-tables literal exists, add `"plan_overrides"` to it.

Expected after fixes: both PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/userScopedTables.ts dashboard/lib/accountExport.ts dashboard/lib/accountExport.test.ts dashboard/lib/accountDeletion.test.ts
git commit -m "feat(privacy): plan_overrides in the deletion cascade and account export"
```

---

### Task 11: Full verification sweep

**Files:** none created — verification only. (Any failure gets fixed with a forward commit, never an amend.)

- [ ] **Step 1: Dashboard typecheck + full test suite**

Run: `cd dashboard && npx tsc --noEmit && npm test`
Expected: tsc clean; every vitest suite green (includes ui-contract, visual-regression-contract inventory, allowlist, admin pages, entitlements, tenantMetrics, export/deletion).

- [ ] **Step 2: Python full suite with the DB**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test python3 -m pytest -q`
Expected: green; `tests/test_rls_isolation.py`, `tests/test_reviewer_db.py`, `tests/test_entitlements.py`, `tests/test_entitlements_parity.py` all ran (not skipped). The parseProfile binary-fixture test may skip in a worktree — that specific skip is expected (worktree-tests-and-fixtures memory).

- [ ] **Step 3: Confirm the diff tells the spec's story**

Run: `git log --oneline origin/main..HEAD && git diff --stat origin/main..HEAD`
Expected: the two spec commits + one commit per task (1–10), touching only the files this plan names. Scan `git diff origin/main..HEAD -- '*.test.*' '*test_*'` output for raw control bytes (git marking a test file `Bin` is the tell — generated-tests memory); if any appear, convert them to `\xNN` escapes and commit the fix.

- [ ] **Step 4: Commit any stragglers and stop**

If Steps 1–3 forced fixes, commit them (`git add -A && git commit -m "fix: verification-sweep fixes for plan-override"`). Do NOT push, merge, or open a PR — the deploy gate (apply `migrations/2026-07-16-plan-overrides.sql` to Supabase prod BEFORE the code ships) belongs to the human-supervised finish, along with a live prod smoke of `/admin/tenants` after deploy.
