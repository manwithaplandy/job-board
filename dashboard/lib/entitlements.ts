// Single source of tier truth for the dashboard runtime. MIRRORED, field-for-field,
// by reviewer/entitlements.py (the reviewer/worker consume the same numbers) and
// guarded by tests/test_entitlements_parity.py, which regex-extracts the model ids,
// caps, and monthly allowances from THIS file and asserts equality with the Python
// module. Keep the two in lockstep — the parity test fails loudly on drift.
//
// Pricing table: spec 2026-07-03 "Pricing & tiers". A tier is a monthly compute
// budget; the per-model daily review cap holds cost constant across model choice
// (cheap model → high cap, premium model → low cap). Premium-model access is the
// real differentiator, not review volume.

export const CHEAP_MODEL = "deepseek/deepseek-v4-flash";
export const PREMIUM_MODEL = "anthropic/claude-haiku-4.5";

export type Plan = "standard" | "pro";
export type ModelSlot = "cheap" | "premium";

export interface Entitlement {
  // slot → per-user, per-day cap on jobs entering review on that model.
  stage2Models: Partial<Record<ModelSlot, number>>;
  monthlyResume: number;
  monthlyCover: number;
}

export type EntitlementMap = Record<Plan, Entitlement>;

export const ENTITLEMENTS: EntitlementMap = {
  standard: { stage2Models: { cheap: 400 }, monthlyResume: 30, monthlyCover: 30 },
  pro: { stage2Models: { cheap: 1000, premium: 100 }, monthlyResume: 100, monthlyCover: 100 },
};

// Display-only monthly price (USD), spec "Pricing & tiers". Dashboard billing UI reads
// this so the price is never hardcoded in JSX; the reviewer doesn't need it, so it is
// intentionally TS-only (not mirrored in entitlements.py / the parity test).
//
// NOTE (T1): these are the COMPILE-TIME DEFAULTS. Money-gating call sites read the
// DB-overlaid values via lib/tierConfig.ts loadTierConfig() instead of these constants
// directly, so caps/allowances/prices are tunable without a redeploy. The pure functions
// below accept an optional `ent` map (defaulting to ENTITLEMENTS) so they operate on
// either the compiled defaults or the loaded overlay with identical semantics.
export const PLAN_PRICE_USD: Record<Plan, number> = { standard: 5, pro: 20 };
export const PLAN_LABEL: Record<Plan, string> = { standard: "Standard", pro: "Pro" };

// ── Invite comp plan (user-sent invites, spec 2026-07-13) ────────────────────
// What an invited-but-not-paying user is comped. DB-overridable via
// app_settings.invite_comp_plan (lib/appSettings.ts); this compiled constant is the
// fallback AND the parity-guarded default — tests/test_entitlements_parity.py
// regex-extracts it and asserts equality with reviewer/entitlements.py, so keep the
// bare `export const NAME = "value";` shape.
export type InviteCompPlan = Plan | "none";
export const DEFAULT_INVITE_COMP_PLAN = "standard";

// ── Reasoning effort (résumé / cover-letter generation) ─────────────────────
// TS-ONLY, intentionally NOT mirrored in reviewer/entitlements.py: generation is
// dashboard-only, the reviewer never reads these (same precedent as
// PLAN_PRICE_USD). Kept OUTSIDE the ENTITLEMENTS literal so the parity test's
// regexes never see it. Compile-time constants, not part of the tierConfig DB
// overlay — effort tiers are product shape, not a tunable money cap.
export type ReasoningEffort = "off" | "low" | "medium" | "high";

const EFFORT_ORDER: ReasoningEffort[] = ["off", "low", "medium", "high"];

export const REASONING_EFFORTS: Record<Plan, ReasoningEffort[]> = {
  standard: ["off", "low"],
  pro: ["off", "low", "medium", "high"],
};

/**
 * Call-time clamp (mirrors resolveStage2Model's hard fallback): the requested
 * effort if the plan grants it, otherwise the highest granted level below it —
 * so a Pro→Standard downgrade with a saved "high" degrades to "low", not "off".
 * null plan → "off" (the routes' 402 gate fires before this ever matters).
 */
export function resolveReasoningEffort(
  plan: Plan | null,
  requested: ReasoningEffort,
): ReasoningEffort {
  if (!plan) return "off";
  const allowed = REASONING_EFFORTS[plan];
  for (let i = EFFORT_ORDER.indexOf(requested); i > 0; i--) {
    if (allowed.includes(EFFORT_ORDER[i])) return EFFORT_ORDER[i];
  }
  return "off";
}

export type ReasoningEffortValidation =
  | { ok: true; value: "low" | "medium" | "high" | null }
  | { ok: false; reason: string };

/**
 * Save-time gate for the profile form (mirrors the stage-2 model gate): ""/"off"
 * normalize to null (Off, the stored default), low passes on any plan, medium/high
 * require Pro, anything else (hand-crafted post) is rejected.
 */
export function validateReasoningEffort(
  raw: string,
  plan: Plan | null,
): ReasoningEffortValidation {
  const v = raw.trim().toLowerCase();
  if (!v || v === "off") return { ok: true, value: null };
  if (v !== "low" && v !== "medium" && v !== "high") {
    return { ok: false, reason: `unknown reasoning effort: ${raw}` };
  }
  if (v === "low") return { ok: true, value: "low" };
  if (plan !== "pro") {
    return { ok: false, reason: "Medium and High reasoning effort require the Pro plan." };
  }
  return { ok: true, value: v };
}

// Subscription is valid for 3 extra days past current_period_end so a webhook lag or
// renewal-retry doesn't briefly strand a paying user.
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// TRIALING and PREMIUM (defense-in-depth): we do NOT configure Stripe trials today
// (no trial_period_days on any price), so a `trialing` subscription is not expected
// from our own checkout. It means an in-good-standing but UNPAID subscription; we let
// it entitle at Standard so a legitimate future trial keeps working, but clamp it
// BELOW Pro so a zero-cost trial can never unlock Pro's premium-model daily budget —
// the real cost lever. Flip this to true ONLY when a paid-trial product deliberately
// grants full-plan access during the trial window. Mirrored in entitlements.py.
const TRIAL_GRANTS_FULL_PLAN = false;

/** Which entitlement slot a concrete OpenRouter model id maps to (null = neither). */
export function modelSlot(model: string | null | undefined): ModelSlot | null {
  if (model === PREMIUM_MODEL) return "premium";
  if (model === CHEAP_MODEL) return "cheap";
  return null;
}

export interface SubscriptionLike {
  plan: Plan | string | null;
  status: string | null;
  current_period_end: Date | string | null;
}

/**
 * The user's effective plan under the chargeable-beta policy:
 *   - a paying subscriber (status active|trialing AND current_period_end + grace >
 *     now) gets their subscribed plan;
 *   - otherwise a Phase-0 invitee (invited === true) is comped at the configured
 *     comp plan (default Standard) — a deliberate choice so trusted testers keep
 *     working through the beta;
 *   - a stranger with neither gets null (no entitlement → gated everywhere).
 */
export function resolvePlan(
  sub: SubscriptionLike | null,
  invited: boolean,
  now: Date = new Date(),
  compPlan: InviteCompPlan = DEFAULT_INVITE_COMP_PLAN as InviteCompPlan,
): Plan | null {
  if (
    sub &&
    (sub.status === "active" || sub.status === "trialing") &&
    (sub.plan === "standard" || sub.plan === "pro") &&
    sub.current_period_end != null
  ) {
    const cpe =
      sub.current_period_end instanceof Date
        ? sub.current_period_end
        : new Date(sub.current_period_end);
    if (!Number.isNaN(cpe.getTime()) && cpe.getTime() + GRACE_MS > now.getTime()) {
      // Clamp a trialing subscription below Pro (see TRIAL_GRANTS_FULL_PLAN): an unpaid
      // trial entitles at most to Standard so it can't unlock the premium-model budget.
      if (sub.status === "trialing" && !TRIAL_GRANTS_FULL_PLAN && sub.plan === "pro") {
        return "standard";
      }
      return sub.plan;
    }
  }
  // Comped plan is operator-configurable (app_settings.invite_comp_plan); "none"
  // switches comping off entirely — invited users then need a real subscription.
  if (invited && compPlan !== "none") return compPlan;
  return null;
}

/**
 * The stage-2 model the user is entitled to run: the requested model if the plan
 * grants its slot, otherwise the always-available cheap model. null plan → cheap
 * (the reviewer skips null-plan users before this ever matters).
 */
export function resolveStage2Model(
  plan: Plan | null,
  requestedModel: string | null | undefined,
  ent: EntitlementMap = ENTITLEMENTS,
): string {
  if (plan) {
    const slot = modelSlot(requestedModel);
    if (slot && ent[plan].stage2Models[slot] != null) return requestedModel!;
  }
  return CHEAP_MODEL;
}

/** Per-user, per-day review cap for (plan, resolved stage-2 model). null plan → 0. */
export function dailyReviewCap(
  plan: Plan | null,
  model: string,
  ent: EntitlementMap = ENTITLEMENTS,
): number {
  if (!plan) return 0;
  const e = ent[plan];
  const slot = modelSlot(model) ?? "cheap";
  return e.stage2Models[slot] ?? e.stage2Models.cheap ?? 0;
}

/** Monthly generation allowance for a kind. null plan → 0. */
export function monthlyAllowance(
  plan: Plan | null,
  kind: "resume" | "cover",
  ent: EntitlementMap = ENTITLEMENTS,
): number {
  if (!plan) return 0;
  const e = ent[plan];
  return kind === "resume" ? e.monthlyResume : e.monthlyCover;
}
