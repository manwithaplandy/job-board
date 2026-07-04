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

export const ENTITLEMENTS: Record<Plan, Entitlement> = {
  standard: { stage2Models: { cheap: 400 }, monthlyResume: 30, monthlyCover: 30 },
  pro: { stage2Models: { cheap: 1000, premium: 100 }, monthlyResume: 100, monthlyCover: 100 },
};

// Display-only monthly price (USD), spec "Pricing & tiers". Dashboard billing UI reads
// this so the price is never hardcoded in JSX; the reviewer doesn't need it, so it is
// intentionally TS-only (not mirrored in entitlements.py / the parity test).
export const PLAN_PRICE_USD: Record<Plan, number> = { standard: 5, pro: 20 };
export const PLAN_LABEL: Record<Plan, string> = { standard: "Standard", pro: "Pro" };

// Subscription is valid for 3 extra days past current_period_end so a webhook lag or
// renewal-retry doesn't briefly strand a paying user.
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

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
 *   - otherwise a Phase-0 invitee (invited === true) is COMPED at Standard — a
 *     deliberate choice so trusted testers keep working through the beta;
 *   - a stranger with neither gets null (no entitlement → gated everywhere).
 */
export function resolvePlan(
  sub: SubscriptionLike | null,
  invited: boolean,
  now: Date = new Date(),
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
      return sub.plan;
    }
  }
  if (invited) return "standard";
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
): string {
  if (plan) {
    const slot = modelSlot(requestedModel);
    if (slot && ENTITLEMENTS[plan].stage2Models[slot] != null) return requestedModel!;
  }
  return CHEAP_MODEL;
}

/** Per-user, per-day review cap for (plan, resolved stage-2 model). null plan → 0. */
export function dailyReviewCap(plan: Plan | null, model: string): number {
  if (!plan) return 0;
  const ent = ENTITLEMENTS[plan];
  const slot = modelSlot(model) ?? "cheap";
  return ent.stage2Models[slot] ?? ent.stage2Models.cheap ?? 0;
}

/** Monthly generation allowance for a kind. null plan → 0. */
export function monthlyAllowance(plan: Plan | null, kind: "resume" | "cover"): number {
  if (!plan) return 0;
  const ent = ENTITLEMENTS[plan];
  return kind === "resume" ? ent.monthlyResume : ent.monthlyCover;
}
