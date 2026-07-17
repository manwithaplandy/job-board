# Stage-2 Model Tiers + Tier-Gate Upgrade Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Pro user select any catalog model (e.g. Google Gemini Flash 3.5) as the Stage-2 review model instead of hitting a contradictory "requires the Pro plan" error, by replacing the two-model whitelist with an extensible plan-tier system, and add a `/billing` upgrade link to tier-gate errors.

**Architecture:** Introduce an ordered access-tier layer (`PLAN_TIER`, `STAGE2_MODEL_TIER`, `DEFAULT_STAGE2_MODEL_TIER`) in the entitlement source-of-truth. A model's minimum required tier gates access; models not explicitly assigned default to tier 2 (Pro). This is mirrored field-for-field across the TS (`dashboard/lib/entitlements.ts`) and Python (`reviewer/entitlements.py`) runtimes — both are authoritative (the reviewer worker re-resolves at review time), and parity is enforced by `tests/test_entitlements_parity.py`. The existing `stage2Models` daily-cap table and its `{cheap, premium}` slots are **preserved unchanged** (no DB migration); `modelSlot` is redefined to derive the cost slot from a model's tier, so unassigned models meter at the conservative premium cap. Tier-gate errors gain an optional form-level `upgrade` CTA rendered in the existing error summary.

**Tech Stack:** TypeScript (Next.js App Router, server actions, `useActionState`), Python 3 (stdlib-only reviewer), Vitest (dashboard), pytest (reviewer).

## Global Constraints

- **Never rewrite existing commits** (repo CLAUDE.md). Reconcile by committing forward — no `--amend`, no rebase, no force-push.
- **TS + Python entitlement files must stay in lockstep.** Every new constant added to `dashboard/lib/entitlements.ts` that affects tier resolution MUST be mirrored in `reviewer/entitlements.py` AND covered by `tests/test_entitlements_parity.py`, using bare `export const NAME = ...` / literal shapes the parity regexes can extract.
- **Do NOT change the `stage2Models` cap-table shape** (`{cheap, premium}` per plan) or its numbers — `standard: { cheap: 400 }`, `pro: { cheap: 1000, premium: 100 }`. The DB overlay (`dashboard/lib/tierConfig.ts` / `reviewer/entitlements.py::overlay_entitlements`) and `test_entitlements_parity.py::_plan_block` depend on it. No DB migration is required or wanted.
- **No `as`-cast on boundary data** (dashboard/CLAUDE.md). Not directly in scope but keep it in mind if touching any jsonb read.
- Test env: run dashboard tests with `npm test` in `dashboard/`; run Python tests with `python3 -m pytest` from repo root (no `.venv`; DB tests, not needed here, would need `TEST_DATABASE_URL`).
- Canonical upgrade destination is the `/billing` route. Never link to `/api/stripe/*` (POST-only JSON).
- Copy rule: a **Standard** subscriber sees "Upgrade to Pro"; a Pro/null user sees the neutral "View billing" — never a false upgrade promise (mirrors `lib/rolefit/tierGate.ts` `upgradeCta`).

---

### Task 1: Extensible plan-tier core (TS + Python + parity), keeping the cap table intact

**Files:**
- Modify: `dashboard/lib/entitlements.ts`
- Modify: `reviewer/entitlements.py`
- Modify: `tests/test_entitlements_parity.py`
- Test: `dashboard/lib/entitlements.test.ts`
- Test: `tests/test_entitlements.py`
- Test: `tests/test_reviewer_run.py`

**Interfaces:**
- Produces (TS, `@/lib/entitlements`):
  - `PLAN_TIER: Record<Plan, number>` = `{ standard: 1, pro: 2 }`
  - `DEFAULT_STAGE2_MODEL_TIER = 2`
  - `STAGE2_MODEL_TIER: Record<string, number>` = `{ [CHEAP_MODEL]: 1 }`
  - `planTier(plan: Plan | null): number`
  - `stage2ModelTier(model: string | null | undefined): number`
  - `planForTier(tier: number): Plan`
  - `modelSlot(model): ModelSlot` (return type narrows from `ModelSlot | null` to `ModelSlot`)
  - `resolveStage2Model(plan, requested, ent?)` — now tier-gated (same signature)
  - `ReasoningEffortValidation` failure variant gains optional `tierGated?: boolean`
- Produces (Python, `reviewer.entitlements`): `PLAN_TIER`, `DEFAULT_STAGE2_MODEL_TIER`, `STAGE2_MODEL_TIER`, `plan_tier`, `stage2_model_tier`, `model_slot`, `resolve_stage2_model` — field-for-field mirrors.
- Consumes: `CHEAP_MODEL`, `PREMIUM_MODEL`, `Plan`, `ModelSlot`, `ENTITLEMENTS`, `PLAN_LABEL` (existing).

- [ ] **Step 1: Write the failing TS tests** in `dashboard/lib/entitlements.test.ts`. First READ the file and rewrite the two existing cases whose behavior this change deliberately flips (their *names* encode the old policy, so rename, don't just tweak):
  - the case at ~line 132 asserting `resolveStage2Model("pro", "some/other-model") === CHEAP_MODEL` → now returns the model (that IS the feature).
  - any case asserting `modelSlot(<non-whitelist id>) === null` → now `=== "premium"`.

  Then add the new cases below (keep the still-valid existing cases):

```ts
import {
  resolveStage2Model, dailyReviewCap, modelSlot, planTier, stage2ModelTier,
  planForTier, CHEAP_MODEL, PREMIUM_MODEL,
} from "./entitlements";

const GEMINI = "google/gemini-3.5-flash";

test("plan tier ranks: null < standard < pro", () => {
  expect(planTier(null)).toBe(0);
  expect(planTier("standard")).toBe(1);
  expect(planTier("pro")).toBe(2);
});

test("stage2 model tier: explicit tier-1 model, everything else defaults to tier 2", () => {
  expect(stage2ModelTier(CHEAP_MODEL)).toBe(1);
  expect(stage2ModelTier(GEMINI)).toBe(2);
  expect(stage2ModelTier(PREMIUM_MODEL)).toBe(2);
  expect(stage2ModelTier(null)).toBe(2);
});

test("planForTier returns the lowest plan meeting the tier", () => {
  expect(planForTier(1)).toBe("standard");
  expect(planForTier(2)).toBe("pro");
});

test("resolveStage2Model: Pro can run any catalog model (Gemini), Standard cannot", () => {
  expect(resolveStage2Model("pro", GEMINI)).toBe(GEMINI);
  expect(resolveStage2Model("pro", PREMIUM_MODEL)).toBe(PREMIUM_MODEL);
  expect(resolveStage2Model("pro", CHEAP_MODEL)).toBe(CHEAP_MODEL);
  expect(resolveStage2Model("standard", GEMINI)).toBe(CHEAP_MODEL);
  expect(resolveStage2Model("standard", PREMIUM_MODEL)).toBe(CHEAP_MODEL);
  expect(resolveStage2Model("standard", CHEAP_MODEL)).toBe(CHEAP_MODEL);
  expect(resolveStage2Model(null, GEMINI)).toBe(CHEAP_MODEL);
});

test("modelSlot: tier-1 → cheap, tier-2+ → premium (never null)", () => {
  expect(modelSlot(CHEAP_MODEL)).toBe("cheap");
  expect(modelSlot(PREMIUM_MODEL)).toBe("premium");
  expect(modelSlot(GEMINI)).toBe("premium");
});

test("dailyReviewCap: a Pro Gemini review meters at the premium (conservative) cap", () => {
  expect(dailyReviewCap("pro", GEMINI)).toBe(100);
  expect(dailyReviewCap("pro", CHEAP_MODEL)).toBe(1000);
  expect(dailyReviewCap("standard", CHEAP_MODEL)).toBe(400);
  expect(dailyReviewCap(null, GEMINI)).toBe(0);
});

// Guard against a recurrence of the exact bug this change fixes: if a plan GRANTS a
// model's tier but does not FUND that model's cost slot, resolveStage2Model would
// silently clamp while the save gate blames the user's OWN plan ("requires the <your
// plan> plan"). Pins the entitlement data so a future tier can't reintroduce it.
test("invariant: granting a model's tier implies funding its cost slot (no self-contradiction)", () => {
  const plans: import("./entitlements").Plan[] = ["standard", "pro"];
  for (const p of plans) {
    for (const m of [CHEAP_MODEL, PREMIUM_MODEL, GEMINI]) {
      if (planTier(p) >= stage2ModelTier(m)) expect(resolveStage2Model(p, m)).toBe(m);
    }
  }
});
```

- [ ] **Step 2: Run TS tests, verify they fail**

Run: `cd dashboard && npx vitest run lib/entitlements.test.ts`
Expected: FAIL (`planTier`/`stage2ModelTier`/`planForTier` not exported; `resolveStage2Model("pro", GEMINI)` returns `CHEAP_MODEL`).

- [ ] **Step 3: Implement the TS tier core** in `dashboard/lib/entitlements.ts`.

Add, immediately after the `PLAN_PRICE_USD` / `PLAN_LABEL` block (they reference `Plan` and `CHEAP_MODEL`, already defined above):

```ts
// ── Extensible access tiers (spec 2026-07-17 "Stage-2 model tiers") ───────────
// A plan's RANK and a model's MINIMUM required rank. resolveStage2Model grants a
// stage-2 model when planTier(plan) >= stage2ModelTier(model). Models NOT explicitly
// assigned default to DEFAULT_STAGE2_MODEL_TIER (Pro) — so any catalog model is
// Pro-available, and (via modelSlot below) meters at the conservative premium cap.
// Mirrored field-for-field in reviewer/entitlements.py and parity-guarded
// (tests/test_entitlements_parity.py) — keep the bare literal shapes.
//
// Extending: add a plan to PLAN_TIER with its rank; assign a model a lower tier in
// STAGE2_MODEL_TIER to widen its availability (and drop it to the cheap cap); change
// DEFAULT_STAGE2_MODEL_TIER to move where unassigned models land.
export const PLAN_TIER: Record<Plan, number> = { standard: 1, pro: 2 };
export const DEFAULT_STAGE2_MODEL_TIER = 2;
export const STAGE2_MODEL_TIER: Record<string, number> = {
  [CHEAP_MODEL]: 1,
};

/** Rank of a plan (null = 0, below every paid tier). */
export function planTier(plan: Plan | null): number {
  return plan ? PLAN_TIER[plan] : 0;
}

/** Minimum plan-rank required to run `model` for stage-2. Unassigned → the default. */
export function stage2ModelTier(model: string | null | undefined): number {
  const t = model ? STAGE2_MODEL_TIER[model] : undefined;
  return t ?? DEFAULT_STAGE2_MODEL_TIER;
}

/** The lowest plan whose rank satisfies `tier` (for accurate gate messaging). */
export function planForTier(tier: number): Plan {
  const plans = (Object.keys(PLAN_TIER) as Plan[]).sort((a, b) => PLAN_TIER[a] - PLAN_TIER[b]);
  return plans.find((p) => PLAN_TIER[p] >= tier) ?? plans[plans.length - 1];
}
```

Replace `modelSlot` (currently the two-id whitelist returning `ModelSlot | null`):

```ts
/** Cost slot for a stage-2 model: tier-1 models meter at the cheap cap, tier ≥2 at the
 *  premium cap. Derived from the access tier (was a two-id whitelist), so every model
 *  is priced and unassigned models take the conservative premium cap. */
export function modelSlot(model: string | null | undefined): ModelSlot {
  return stage2ModelTier(model) <= 1 ? "cheap" : "premium";
}
```

Replace `resolveStage2Model` body with the tier gate (same signature/JSDoc intent):

```ts
export function resolveStage2Model(
  plan: Plan | null,
  requestedModel: string | null | undefined,
  ent: EntitlementMap = ENTITLEMENTS,
): string {
  if (plan && requestedModel && planTier(plan) >= stage2ModelTier(requestedModel)) {
    const slot = modelSlot(requestedModel);
    if (ent[plan].stage2Models[slot] != null) return requestedModel;
  }
  return CHEAP_MODEL;
}
```

Simplify `dailyReviewCap`'s slot line (now that `modelSlot` never returns null):

```ts
  const slot = modelSlot(model);
  return e.stage2Models[slot] ?? e.stage2Models.cheap ?? 0;
```

Add the `tierGated` flag to the reasoning-effort validation (TS-only; used by Task 2 to decide whether the upgrade CTA applies). Change the type and the Pro branch:

```ts
export type ReasoningEffortValidation =
  | { ok: true; value: "low" | "medium" | "high" | null }
  | { ok: false; reason: string; tierGated?: boolean };
```
```ts
  if (plan !== "pro") {
    return { ok: false, reason: "Medium and High reasoning effort require the Pro plan.", tierGated: true };
  }
```

- [ ] **Step 4: Run TS tests, verify they pass**

Run: `cd dashboard && npx vitest run lib/entitlements.test.ts`
Expected: PASS. If a pre-existing case asserted `modelSlot("some/other") === null`, update it to `=== "premium"`.

- [ ] **Step 5: Write the failing Python tests.**

First READ `tests/test_entitlements.py` and update the two existing cases this change flips (Step 8's "Expected: PASS" will not hold otherwise):
- `test_resolve_stage2_model_unknown` (~lines 106–109) asserts a non-whitelist model → `CHEAP_MODEL` for a Pro user; now Pro gets the model. Rewrite to assert Pro keeps it and Standard is clamped.
- `test_model_slot` (~lines 127–129) asserts `model_slot("x") is None`; now `== "premium"`. Update.

Then add (adjust import to the module's existing style):

```python
from reviewer.entitlements import (
    resolve_stage2_model, daily_review_cap, model_slot, plan_tier,
    stage2_model_tier, CHEAP_MODEL, PREMIUM_MODEL,
)

GEMINI = "google/gemini-3.5-flash"

def test_plan_tier_ranks():
    assert plan_tier(None) == 0
    assert plan_tier("standard") == 1
    assert plan_tier("pro") == 2

def test_stage2_model_tier_default_is_pro():
    assert stage2_model_tier(CHEAP_MODEL) == 1
    assert stage2_model_tier(GEMINI) == 2
    assert stage2_model_tier(PREMIUM_MODEL) == 2
    assert stage2_model_tier(None) == 2

def test_resolve_stage2_pro_runs_any_model_standard_clamped():
    assert resolve_stage2_model("pro", GEMINI) == GEMINI
    assert resolve_stage2_model("pro", PREMIUM_MODEL) == PREMIUM_MODEL
    assert resolve_stage2_model("standard", GEMINI) == CHEAP_MODEL
    assert resolve_stage2_model("standard", PREMIUM_MODEL) == CHEAP_MODEL
    assert resolve_stage2_model(None, GEMINI) == CHEAP_MODEL

def test_model_slot_tier_derived():
    assert model_slot(CHEAP_MODEL) == "cheap"
    assert model_slot(GEMINI) == "premium"
    assert model_slot(PREMIUM_MODEL) == "premium"

def test_daily_cap_pro_gemini_is_premium_cap():
    assert daily_review_cap("pro", GEMINI) == 100
    assert daily_review_cap("pro", CHEAP_MODEL) == 1000
    assert daily_review_cap("standard", CHEAP_MODEL) == 400
    assert daily_review_cap(None, GEMINI) == 0
```

In `tests/test_reviewer_run.py`, read the file first; keep the existing "downgrade → CHEAP_MODEL" and "Pro + Haiku → PREMIUM_MODEL" assertions, and ADD a case proving the worker honors a Pro user's arbitrary model (mirror the harness the existing stage-2 test uses — same profile fixture with `model_stage2` set to `"google/gemini-3.5-flash"`, plan resolving to `pro`, asserting the resolved `model_stage2` passed to `ReviewClient` equals `"google/gemini-3.5-flash"`).

**DB-gating caveat (important):** `test_reviewer_run.py` is `@requires_db` — without `TEST_DATABASE_URL` it SILENTLY SKIPS, so a green run would give false confidence for the one test that proves the Python half of the fix. Run it with the DB var set (memory "Test env: no .venv, local PG"): `TEST_DATABASE_URL='postgresql://…@localhost:55432/poller_test' python3 -m pytest tests/test_reviewer_run.py -q` and confirm the new case actually RAN (not `s`/skipped) — e.g. add `-rs` and check the skip summary is empty for it.

- [ ] **Step 6: Run Python tests, verify they fail**

Run: `python3 -m pytest tests/test_entitlements.py -q`
Expected: FAIL (`plan_tier`/`stage2_model_tier` missing; `resolve_stage2_model("pro", GEMINI)` returns `CHEAP_MODEL`).

- [ ] **Step 7: Implement the Python mirror** in `reviewer/entitlements.py`.

Add after `DEFAULT_INVITE_COMP_PLAN` (near the top constants):

```python
# Extensible access tiers (spec 2026-07-17). Mirrors PLAN_TIER / STAGE2_MODEL_TIER /
# DEFAULT_STAGE2_MODEL_TIER in entitlements.ts (parity-guarded). Unassigned models
# default to tier 2 (Pro) — Pro-available, priced at the premium cap via model_slot.
PLAN_TIER = {"standard": 1, "pro": 2}
DEFAULT_STAGE2_MODEL_TIER = 2
STAGE2_MODEL_TIER = {CHEAP_MODEL: 1}


def plan_tier(plan):
    """Rank of a plan (None -> 0, below every paid tier)."""
    return PLAN_TIER.get(plan, 0) if plan else 0


def stage2_model_tier(model):
    """Minimum plan-rank required to run `model` for stage-2. Unassigned -> default."""
    return STAGE2_MODEL_TIER.get(model, DEFAULT_STAGE2_MODEL_TIER)
```

Replace `model_slot`:

```python
def model_slot(model):
    """Cost slot for a stage-2 model: tier-1 -> cheap cap, tier >=2 -> premium cap.
    Derived from the access tier (was a two-id whitelist); never None."""
    return "cheap" if stage2_model_tier(model) <= 1 else "premium"
```

Replace `resolve_stage2_model` body with the tier gate:

```python
def resolve_stage2_model(plan, requested_model, ent=None):
    """The entitled stage-2 model: the requested one if the plan's tier grants it,
    else CHEAP_MODEL. `ent` overrides the compiled ENTITLEMENTS map (T1 overlay)."""
    ent = ent if ent is not None else ENTITLEMENTS
    if plan and requested_model and plan_tier(plan) >= stage2_model_tier(requested_model):
        slot = model_slot(requested_model)
        if ent[plan]["stage2_models"].get(slot) is not None:
            return requested_model
    return CHEAP_MODEL
```

`daily_review_cap` needs no change (its `model_slot(model) or "cheap"` still works; `model_slot` now never returns None, so the `or "cheap"` is dead but harmless — leave it).

- [ ] **Step 8: Run Python tests, verify they pass**

Run: `python3 -m pytest tests/test_entitlements.py -q` then `TEST_DATABASE_URL='postgresql://…@localhost:55432/poller_test' python3 -m pytest tests/test_reviewer_run.py -q -rs`
Expected: PASS, and the new "worker honors Pro's Gemini" case is NOT in the skip summary (i.e. the DB var took effect). If it skips, the Python half of the fix is unverified — resolve the DB connection before proceeding.

- [ ] **Step 9: Write the failing parity test** — add to `tests/test_entitlements_parity.py`:

```python
from reviewer.entitlements import DEFAULT_STAGE2_MODEL_TIER, PLAN_TIER, STAGE2_MODEL_TIER

def test_tier_map_parity():
    """The access-tier maps (spec 2026-07-17) must match across runtimes, or a model
    would be Pro-gated on one runtime and open on the other."""
    text = _TS.read_text()
    consts = {"CHEAP_MODEL": CHEAP_MODEL, "PREMIUM_MODEL": PREMIUM_MODEL}

    # NOTE: every regex is left-anchored on `export const NAME` (mirroring the _const
    # precedent at line 16). A bare `NAME\b[^=]*=` would first match the constant's
    # name inside a comment, then let [^=]* run to the NEXT const's `=` and capture the
    # wrong object — a silent false failure. Keep the `export const` anchor.
    m = re.search(r"export const PLAN_TIER\b[^=]*=\s*\{([^}]*)\}", text)
    assert m, "PLAN_TIER not found in entitlements.ts"
    ts_plan_tier = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", m.group(1))}
    assert ts_plan_tier == PLAN_TIER

    m = re.search(r"export const DEFAULT_STAGE2_MODEL_TIER\s*=\s*(\d+)", text)
    assert m, "DEFAULT_STAGE2_MODEL_TIER not found in entitlements.ts"
    assert int(m.group(1)) == DEFAULT_STAGE2_MODEL_TIER

    m = re.search(r"export const STAGE2_MODEL_TIER\b[^=]*=\s*\{([^}]*)\}", text)
    assert m, "STAGE2_MODEL_TIER not found in entitlements.ts"
    body = m.group(1)
    ts_model_tier = {}
    for key, val in re.findall(r"\[(\w+)\]:\s*(\d+)", body):      # computed-key entries [CONST]: N
        assert key in consts, f"unknown computed key {key!r} in STAGE2_MODEL_TIER"
        ts_model_tier[consts[key]] = int(val)
    for key, val in re.findall(r'"([^"]+)":\s*(\d+)', body):       # string-literal entries "id": N
        ts_model_tier[key] = int(val)
    assert ts_model_tier == STAGE2_MODEL_TIER
```

- [ ] **Step 10: Run the parity suite, verify pass**

Run: `python3 -m pytest tests/test_entitlements_parity.py -q`
Expected: PASS (all parity tests, including the new `test_tier_map_parity`, and the unchanged `_plan_block` table parity).

- [ ] **Step 11: Commit**

```bash
git add dashboard/lib/entitlements.ts reviewer/entitlements.py tests/test_entitlements_parity.py dashboard/lib/entitlements.test.ts tests/test_entitlements.py tests/test_reviewer_run.py
git commit -m "feat(entitlements): extensible plan-tier gate for stage-2 model selection"
```

---

### Task 2: Accurate tier-gate messages + form-level upgrade link

**Files:**
- Modify: `dashboard/lib/profileSettingsState.ts`
- Modify: `dashboard/app/actions/profileSettings.ts`
- Modify: `dashboard/components/profile/SectionFormShell.tsx`
- Modify: `dashboard/components/profile/AdvancedAiForm.tsx`
- Modify: `dashboard/lib/entitlements.ts` (add `upgradeCtaLabel` helper — TS-only, not parity-relevant)
- Test: `dashboard/app/actions/profileSettings.test.ts`
- Test: `dashboard/components/profile/SectionFormShell.test.tsx` (new)

**Interfaces:**
- Consumes: from Task 1 — `resolveStage2Model`, `stage2ModelTier`, `planForTier`, `PLAN_LABEL`, `ReasoningEffortValidation.tierGated`.
- Produces:
  - `UpgradeCta = { href: string; label: string }` and an optional `upgrade?: UpgradeCta` on the `SectionSaveState` error variant.
  - `upgradeCtaLabel(plan: Plan | null): string` in `@/lib/entitlements`.
  - `invalid(fieldErrors, upgrade?)` — the action helper gains an optional second arg.

- [ ] **Step 1: Write the failing action test** in `dashboard/app/actions/profileSettings.test.ts` (read the file first; follow its existing mocking style for `getViewerPlan`, `getUserClaims`, `getStructuredModels`, `validateModelId`, `updateModelPreferences`). Add:

```ts
const GEMINI = "google/gemini-3.5-flash";

test("Pro user can save Gemini Flash 3.5 as the stage-2 model", async () => {
  // getViewerPlan → "pro"; catalog includes GEMINI
  const fd = advancedAiFormData({ model_stage2: GEMINI });
  const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, fd);
  expect(result.status).toBe("success");
});

test("Standard user selecting Gemini gets an accurate Pro message + upgrade CTA", async () => {
  // getViewerPlan → "standard"
  const fd = advancedAiFormData({ model_stage2: GEMINI });
  const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, fd);
  expect(result.status).toBe("error");
  if (result.status !== "error") throw new Error("expected error");
  expect(result.fieldErrors.model_stage2).toMatch(/requires the Pro plan\.$/);
  expect(result.fieldErrors.model_stage2).not.toContain("google/gemini"); // friendly name, not raw id
  expect(result.upgrade).toEqual({ href: "/billing", label: "Upgrade to Pro" });
});
```

**Mock prerequisites (REQUIRED — the tests fail for the wrong reason otherwise):**
- Add a Gemini entry to the mocked catalog `getStructuredModels` returns (its `beforeEach` list is `{ id }`-only with no Gemini): `{ id: GEMINI, name: "Gemini Flash 3.5" }`. Without it, `validateModelId` rejects Gemini as "unknown model" BEFORE the tier gate, and the `?.name` friendly-name lookup falls back to the raw id (breaking `not.toContain("google/gemini")`).
- First test: mock `getViewerPlan` → `"pro"`. Second test: mock `getViewerPlan` → `"standard"`.
- Adapt `advancedAiFormData` to the file's existing helpers; if none, build a `FormData` with the four model fields + `reasoning_effort_*` set to `"off"` so only the stage-2 gate fires.

- [ ] **Step 2: Run, verify it fails**

Run: `cd dashboard && npx vitest run app/actions/profileSettings.test.ts`
Expected: FAIL (Pro+Gemini currently errors; `result.upgrade` undefined).

- [ ] **Step 3: Add the `UpgradeCta` type** to `dashboard/lib/profileSettingsState.ts`:

```ts
export interface UpgradeCta {
  href: string;
  label: string;
}

export type SectionSaveState =
  | { status: "idle" }
  | { status: "success"; savedAt: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; upgrade?: UpgradeCta };

export const INITIAL_SECTION_SAVE_STATE: SectionSaveState = { status: "idle" };
```

- [ ] **Step 4: Add `upgradeCtaLabel`** to `dashboard/lib/entitlements.ts` (near `PLAN_LABEL`):

```ts
/** CTA label for a tier-gate upsell link (→ /billing). A Standard subscriber has a real
 *  upgrade to sell; Pro/null get the neutral label — never a false "Upgrade to Pro". */
export function upgradeCtaLabel(plan: Plan | null): string {
  return plan === "standard" ? `Upgrade to ${PLAN_LABEL.pro}` : "View billing";
}
```

- [ ] **Step 5: Rewrite the gate in `dashboard/app/actions/profileSettings.ts`.**

Update imports (line 5) — drop `PREMIUM_MODEL`, add the new helpers:

```ts
import {
  validateReasoningEffort, resolveStage2Model, stage2ModelTier, planForTier,
  upgradeCtaLabel, PLAN_LABEL,
} from "@/lib/entitlements";
import type { SectionSaveState, UpgradeCta } from "@/lib/profileSettingsState";
```

Widen the `invalid` helper (line 35) to accept an optional upgrade CTA, and add a local `upsell` helper:

```ts
const invalid = (fieldErrors: Record<string, string>, upgrade?: UpgradeCta): SectionSaveState => ({
  status: "error", message: "Check the highlighted fields.", fieldErrors,
  ...(upgrade ? { upgrade } : {}),
});
const upsell = (plan: Parameters<typeof upgradeCtaLabel>[0]): UpgradeCta => ({
  href: "/billing", label: upgradeCtaLabel(plan),
});
```

Keep the full structured-model list so we can show a friendly name (line 151):

```ts
    const structured = await getStructuredModels();
    const catalogIds = structured.map((model) => model.id);
```

Replace the stage-2 gate (lines 163–166) — accurate required-plan name + CTA:

```ts
    const stage2 = models.model_stage2;
    if (stage2.ok && stage2.value && resolveStage2Model(plan, stage2.value) !== stage2.value) {
      const requiredPlan = planForTier(stage2ModelTier(stage2.value));
      const label = structured.find((m) => m.id === stage2.value)?.name ?? stage2.value;
      return invalid(
        { model_stage2: `${label} requires the ${PLAN_LABEL[requiredPlan]} plan.` },
        upsell(plan),
      );
    }
```

(Confirm the structured-model display field is `name`; if the `ORModel` type names it differently, use that field, falling back to the id.)

Attach the CTA to the reasoning-effort gate too (lines 169–171), but ONLY when the failure is the tier gate (not a malformed-effort rejection):

```ts
    if (!resumeEffort.ok) fieldErrors.reasoning_effort_resume = resumeEffort.reason;
    if (!coverEffort.ok) fieldErrors.reasoning_effort_cover = coverEffort.reason;
    if (!resumeEffort.ok || !coverEffort.ok) {
      const tierGated =
        (!resumeEffort.ok && resumeEffort.tierGated) || (!coverEffort.ok && coverEffort.tierGated);
      return invalid(fieldErrors, tierGated ? upsell(plan) : undefined);
    }
```

- [ ] **Step 6: Run the action test, verify pass**

Run: `cd dashboard && npx vitest run app/actions/profileSettings.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing UI test** — new file `dashboard/components/profile/SectionFormShell.test.tsx` (jsdom; follow the `environmentMatchGlobs` + `@testing-library/react` setup noted for this repo). Assert the upgrade link renders when the action returns an `upgrade` payload:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SectionFormShell } from "./SectionFormShell";
import type { SectionSaveState } from "@/lib/profileSettingsState";

test("renders the upgrade CTA link to /billing when the action returns one", async () => {
  const action = async (): Promise<SectionSaveState> => ({
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: { model_stage2: "Gemini Flash 3.5 requires the Pro plan." },
    upgrade: { href: "/billing", label: "Upgrade to Pro" },
  });
  render(
    <SectionFormShell action={action} submitLabel="Save">
      <input name="model_stage2" defaultValue="x" />
    </SectionFormShell>,
  );
  // Make the form dirty so the submit button enables, then submit.
  fireEvent.input(screen.getByDisplayValue("x"), { target: { value: "y" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const link = await screen.findByRole("link", { name: "Upgrade to Pro" });
  expect(link).toHaveAttribute("href", "/billing");
});
```

- [ ] **Step 8: Run, verify it fails**

Run: `cd dashboard && npx vitest run components/profile/SectionFormShell.test.tsx`
Expected: FAIL (no upgrade link rendered).

- [ ] **Step 9: Render the CTA in `dashboard/components/profile/SectionFormShell.tsx`.**

Import the same button-link component `AccountSettings.tsx` uses (grep for `ButtonLink` to confirm its path, e.g. `@/components/ui/Navigation` or `@/components/ui/Button`). Inside the error summary `<div>` (after the `<ul>…</ul>` of field errors, lines 249–255), add:

```tsx
            {state.upgrade && (
              <p className="section-error-upgrade">
                <ButtonLink href={state.upgrade.href} variant="primary" size="sm">
                  {state.upgrade.label}
                </ButtonLink>
              </p>
            )}
```

(Use whatever prop names the existing `ButtonLink` accepts; if it takes no `variant`/`size`, drop them. A plain `<a className="rf-button rf-button--primary rf-button--sm" href={state.upgrade.href}>` is an acceptable fallback that matches the app's button classes.)

- [ ] **Step 10: Run the UI test, verify pass**

Run: `cd dashboard && npx vitest run components/profile/SectionFormShell.test.tsx`
Expected: PASS.

- [ ] **Step 11: Update the stage-2 hint copy** in `dashboard/components/profile/AdvancedAiForm.tsx` (it referenced `PREMIUM_MODEL`, which is no longer accurate — a single premium id no longer describes the gate). Remove the `PREMIUM_MODEL` import (line 6) and change the hint (line 49):

```tsx
          hint={isPro ? "Choose the model used for detailed job review." : "Choose the review model — some models require the Pro plan."}
```

- [ ] **Step 12: Run the dashboard lint/type + the touched suites**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run lib/entitlements.test.ts app/actions/profileSettings.test.ts components/profile/SectionFormShell.test.tsx`
Expected: PASS, no type errors (verifies the widened `SectionSaveState` and the dropped `PREMIUM_MODEL` import have no dangling references).

- [ ] **Step 13: Commit**

```bash
git add dashboard/lib/profileSettingsState.ts dashboard/lib/entitlements.ts dashboard/app/actions/profileSettings.ts dashboard/components/profile/SectionFormShell.tsx dashboard/components/profile/AdvancedAiForm.tsx dashboard/app/actions/profileSettings.test.ts dashboard/components/profile/SectionFormShell.test.tsx
git commit -m "feat(profile): accurate stage-2 tier-gate messages + /billing upgrade link"
```

---

### Task 3: Full-suite verification + drive the flow

**Files:** none (verification only). Use `superpowers:verification-before-completion`.

- [ ] **Step 1: Run the full dashboard test suite**

Run: `cd dashboard && npm test`
Expected: PASS (including `test:ui-contract` if part of `npm test`; if it's a separate script, run `npm run test:ui-contract` too).

- [ ] **Step 2: Run the full Python suite**

Run: `python3 -m pytest tests/test_entitlements.py tests/test_entitlements_parity.py tests/test_reviewer_run.py -q`
Expected: PASS. (A broader `python3 -m pytest -q` is fine but DB-backed tests may skip without `TEST_DATABASE_URL`.)

- [ ] **Step 3: Drive the real flow** (per `superpowers:verification-before-completion` — behavior, not just tests). Using the local authed-page dev shim (memory: "Local authed-page dev shim" / "Dashboard .env.local not in worktrees"), load `/profile/advanced` as a Pro user, select "Google Gemini Flash 3.5" for the Stage-2 field, Save, and confirm it saves with no error. Then (if a Standard test identity is available) confirm a Standard user selecting a Pro-tier model sees "… requires the Pro plan." plus a working "Upgrade to Pro" button linking to `/billing`. If the shim/browser drive isn't available in this environment, state that explicitly and rely on the action + component tests as the behavioral evidence.

- [ ] **Step 4: Report** the verification evidence (commands run + output). Do not claim done without it.

---

## Self-Review

**Spec coverage:**
- "All models available for Stage 2 (pro)" → Task 1 `resolveStage2Model` (Pro passes any catalog model). ✓
- "Not explicitly assigned to tier 1 → available in tier 2" → `stage2ModelTier` defaults to `DEFAULT_STAGE2_MODEL_TIER = 2`. ✓
- "Extensible to more tiers + changing defaults" → `PLAN_TIER` map + `STAGE2_MODEL_TIER` map + `DEFAULT_STAGE2_MODEL_TIER` constant, all data-driven and parity-guarded; `planForTier` generalizes messaging. ✓
- "Errors include an upgrade link" → Task 2 form-level `upgrade` CTA → `/billing`, on both the model gate and the (tier-gated) reasoning-effort gate. ✓
- Reviewer worker honors the pick (not just the save) → Task 1 Python mirror + `test_reviewer_run.py` case. ✓

**Placeholder scan:** none — every step carries concrete code/commands.

**Type consistency:** `resolveStage2Model`/`resolve_stage2_model` signatures unchanged; `modelSlot` return narrows to `ModelSlot` (consumers `dailyReviewCap` and `resolveStage2Model` updated); `UpgradeCta`/`upgrade?` added to `SectionSaveState` and consumed identically in the action (`invalid`) and the shell render; `upgradeCtaLabel` used only where imported.

**Known consequence to confirm at review:** a Pro user running any newly-allowed model for Stage-2 meters at the **premium daily cap (100/day)**, not the cheap cap (1000/day), because unassigned models default to tier 2 → premium slot. This is intentional (conservative cost) and matches "unassigned → tier 2". To make a specific cheap model both universally available AND high-cap, assign it `STAGE2_MODEL_TIER[id] = 1` (a one-line, parity-guarded change). **Cost caveat (honesty):** the premium cap holds review *count* constant (100/day), not *cost* — a Pro user can now run a frontier-priced model 100×/day, so per-review price is unbounded within the premium slot. The future lever for bounding that is a price-band → tier/slot assignment (i.e. give expensive models a higher tier or a lower-cap slot); out of scope here because the owner's directive is to make all models Pro-available now.

**Optional polish (do if the context is loaded; each is small and independently revertible):**
- **Billing copy (recommended — the new CTA links here).** `app/billing/page.tsx:17,43` describes Pro's stage-2 benefit as the single Haiku premium model; after this change Pro unlocks *any* catalog model. Update the Pro card's stage-2 line to reflect "any model, 100 reviews/day" so a Standard user who clicks "Upgrade to Pro" from a Gemini gate lands on accurate copy. Keep the numbers reading from the entitlement/tierConfig source, not hardcoded.
- **Dedupe the CTA label.** `lib/rolefit/tierGate.ts:35`'s private `upgradeCta` is now identical to the new `upgradeCtaLabel`; have `tierGate.ts` consume the export (widen `upgradeCtaLabel`'s param to `Plan | string | null` since tierGate passes a parsed-body string) so the "never a false upgrade promise" rule has one home. Re-run `npx vitest run lib/rolefit/tierGate.test.ts` (if present) after.

**Truly out of scope (unrelated pre-existing bug):** the reasoning-effort summary-anchor mismatch (`SectionFormShell` anchors to `#reasoning_effort_resume`, the select's id is `reasoning-effort-…`).
