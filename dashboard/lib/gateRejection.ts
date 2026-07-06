import type { Plan } from "@/lib/entitlements";

// Wire contract for a rejected money gate. Rejections carry a machine-readable `code`
// (and the plan, once known) alongside the human error string, so the client can key
// its /billing upsell CTA off structured fields — the status alone is ambiguous (the
// generation routes also map an upstream LLM rate limit to 429, and 409 is a generic
// conflict status), and matching the display string would be brittle.
//
// Producers: lib/usage.ts (monthly generation allowances) and app/api/review/request
// (daily review budget, same field shape). Consumer: lib/rolefit/tierGate.ts.
// Kept in its own pure module (no serviceSql import) so route tests that mock
// @/lib/usage still run the real body builder.
export type AllowanceGateRejection =
  | { ok: false; status: 402; code: "subscription_required"; error: string }
  | { ok: false; status: 429; code: "allowance_exhausted"; plan: Plan; error: string };

/** JSON body a route returns for a rejected gate (plan present only on the 429 variant). */
export function gateRejectionBody(
  gate: AllowanceGateRejection,
): { error: string; code: string; plan?: Plan } {
  return gate.status === 402
    ? { error: gate.error, code: gate.code }
    : { error: gate.error, code: gate.code, plan: gate.plan };
}
