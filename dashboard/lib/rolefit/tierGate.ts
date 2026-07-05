import { PLAN_LABEL, PLAN_PRICE_USD } from "@/lib/entitlements";

// Tier-gate rejection → upsell notice mapping, shared by the board's generation
// handlers (/api/resume, /api/cover-letter, /api/application/prepare) and the
// ReviewNowPanel (/api/review/request). A gate rejection is an upgrade moment, not a
// dead-end error: the notice keeps the server's specific error string as the base
// message, layers an encouraging next step on top, and always points at /billing.
//
// Keying: the HTTP status selects the gate kind; the body's machine-readable `code`
// (see lib/usage.ts AllowanceGateRejection) disambiguates where the status alone is
// overloaded — the generation routes also map an upstream LLM rate limit to 429, and
// 409 is a generic conflict status — so a transient rate limit never masquerades as
// "monthly allowance used". Never matched: the human-readable error string.

export interface TierGateNotice {
  message: string;
  // CTA label for the /billing link ("See plans" / "Upgrade to Pro" / "View billing").
  cta: string;
}

// Total parse of the rejection body — fetch-boundary data, so no field is trusted
// (see dashboard/CLAUDE.md's boundary rule; same reason there's no `as`-cast here).
function parseBody(body: unknown): { error: string | null; code: string | null; plan: string | null } {
  if (typeof body !== "object" || body === null) return { error: null, code: null, plan: null };
  const b = body as Record<string, unknown>;
  return {
    error: typeof b.error === "string" ? b.error : null,
    code: typeof b.code === "string" ? b.code : null,
    plan: typeof b.plan === "string" ? b.plan : null,
  };
}

// A Standard subscriber has a real upgrade to sell; Pro (or unknown) gets the neutral
// reset note — never a false "Upgrade to Pro" promise.
const upgradeCta = (plan: string | null): string =>
  plan === "standard" ? `Upgrade to ${PLAN_LABEL.pro}` : "View billing";

/**
 * Map a rejected gated fetch (status + parsed JSON body) to an upsell notice, or null
 * when the failure is NOT a tier gate (generic errors keep their existing handling).
 */
export function tierGateNotice(status: number, body: unknown): TierGateNotice | null {
  const { error, code, plan } = parseBody(body);

  // 402 is only ever produced by the subscription gates (an upstream payment error is
  // remapped to 502 server-side), so the status alone is decisive.
  if (status === 402) {
    const base = error ?? "This feature needs an active subscription.";
    return {
      message: `${base} Plans start at $${PLAN_PRICE_USD.standard}/month.`,
      cta: "See plans",
    };
  }

  // 429 = monthly résumé/cover allowance — but ONLY with the gate's code; a bare 429
  // from the generation routes is a transient upstream rate limit, not an allowance.
  if (status === 429 && code === "allowance_exhausted") {
    const base = error ?? "You’ve used this month’s generation allowance.";
    const next =
      plan === "standard"
        ? `${PLAN_LABEL.pro} includes a bigger monthly allowance — or it resets next month.`
        : "It resets at the start of next month.";
    return { message: `${base} ${next}`, cta: upgradeCta(plan) };
  }

  // 409 = daily review budget spent (code-gated: 409 is a generic conflict status).
  if (status === 409 && code === "review_budget_exhausted") {
    const base = error ?? "Today’s review budget is used up — it resets tomorrow.";
    const next =
      plan === "standard" ? ` ${PLAN_LABEL.pro} includes a bigger daily review budget.` : "";
    return { message: `${base}${next}`, cta: upgradeCta(plan) };
  }

  return null;
}
