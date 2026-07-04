import { unstable_cache } from "next/cache";
import { withAnonSql } from "@/lib/db";
import {
  ENTITLEMENTS,
  PLAN_PRICE_USD,
  type EntitlementMap,
  type Entitlement,
  type Plan,
  type ModelSlot,
} from "@/lib/entitlements";

// DB-overridable tier config (T1, spec 2026-07-03 "Pricing & tiers" + the ±3.6x
// cost-band caveat). The compiled ENTITLEMENTS / PLAN_PRICE_USD in entitlements.ts are
// the DEFAULTS; the tier_settings table holds one jsonb config row per plan that
// OVERLAYS them field-by-field. Every money-gating call site (usage.ts allowance,
// reviewRequests.ts daily budget, the billing page prices) reads the OVERLAY via
// loadTierConfig() so caps/allowances/prices are tunable WITHOUT a redeploy.
//
// NO-REDEPLOY GUARANTEE: an operator changing a cap via `UPDATE tier_settings ...`
// takes effect on the dashboard within one cache window (CACHE_TTL_SECONDS below) and
// on the reviewer's next run (reviewer.db.load_tier_settings, loaded once per run). No
// deploy, no restart.
//
// jsonb-boundary discipline (dashboard/CLAUDE.md): the config column is read through a
// HAND-ROLLED TOTAL PARSER — never an `as`-cast, never zod. Any invalid/partial/hostile
// field (a string scalar, a negative/zero/fractional cap, an unknown key) falls back to
// the compiled default for THAT field and logs; the parser never throws to a page/route.

const CACHE_TTL_SECONDS = 60;

export interface TierConfig {
  entitlements: EntitlementMap;
  prices: Record<Plan, number>;
}

/** The compiled defaults, as a TierConfig (the fallback for everything below). */
export function defaultTierConfig(): TierConfig {
  return {
    entitlements: {
      standard: cloneEntitlement(ENTITLEMENTS.standard),
      pro: cloneEntitlement(ENTITLEMENTS.pro),
    },
    prices: { ...PLAN_PRICE_USD },
  };
}

function cloneEntitlement(e: Entitlement): Entitlement {
  return {
    stage2Models: { ...e.stage2Models },
    monthlyResume: e.monthlyResume,
    monthlyCover: e.monthlyCover,
  };
}

/** A positive integer (caps/allowances) or null. Rejects strings, floats, ≤0, NaN. */
function posInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) return null;
  return v;
}

/** A positive finite number (display price) or null. Prices may be fractional. */
function posNum(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * postgres.js returns a jsonb column as a parsed JS value, but a DOUBLE-ENCODED write
 * (a jsonb string scalar) arrives as a JS string — unwrap one level of JSON string
 * before validating (mirrors lib/rolefit/packageCodec.ts).
 */
function unwrap(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Overlay one plan's DB config onto its compiled default, field-by-field. `raw` is the
 * jsonb value straight off the row. Every bad/absent field keeps the default and logs.
 * Never throws.
 */
export function overlayPlan(
  plan: Plan,
  raw: unknown,
  defaults: TierConfig,
): { entitlement: Entitlement; price: number } {
  const entitlement = cloneEntitlement(defaults.entitlements[plan]);
  let price = defaults.prices[plan];

  const cfg = unwrap(raw);
  if (!isObject(cfg)) {
    if (raw != null && !(isObject(raw) && Object.keys(raw).length === 0)) {
      console.error(`tierConfig: ${plan} config is not an object; using compiled defaults`);
    }
    return { entitlement, price };
  }

  const s2 = cfg.stage2Models;
  if (s2 !== undefined) {
    if (isObject(s2)) {
      // Only override slots the compiled default already grants — a DB row cannot
      // invent a premium slot for Standard (that would change the tier's identity).
      for (const slot of Object.keys(entitlement.stage2Models) as ModelSlot[]) {
        if (s2[slot] === undefined) continue;
        const cap = posInt(s2[slot]);
        if (cap === null) {
          console.error(`tierConfig: ${plan}.stage2Models.${slot} invalid; keeping default`);
        } else {
          entitlement.stage2Models[slot] = cap;
        }
      }
    } else {
      console.error(`tierConfig: ${plan}.stage2Models not an object; keeping defaults`);
    }
  }

  if (cfg.monthlyResume !== undefined) {
    const n = posInt(cfg.monthlyResume);
    if (n === null) console.error(`tierConfig: ${plan}.monthlyResume invalid; keeping default`);
    else entitlement.monthlyResume = n;
  }
  if (cfg.monthlyCover !== undefined) {
    const n = posInt(cfg.monthlyCover);
    if (n === null) console.error(`tierConfig: ${plan}.monthlyCover invalid; keeping default`);
    else entitlement.monthlyCover = n;
  }
  if (cfg.priceUsd !== undefined) {
    const n = posNum(cfg.priceUsd);
    if (n === null) console.error(`tierConfig: ${plan}.priceUsd invalid; keeping default`);
    else price = n;
  }

  return { entitlement, price };
}

/** Build a full TierConfig from the raw tier_settings rows (plan → config jsonb). */
export function overlayTierConfig(rows: { plan: string; config: unknown }[]): TierConfig {
  const defaults = defaultTierConfig();
  const byPlan = new Map(rows.map((r) => [r.plan, r.config]));
  const out = defaultTierConfig();
  for (const plan of ["standard", "pro"] as Plan[]) {
    const { entitlement, price } = overlayPlan(plan, byPlan.get(plan), defaults);
    out.entitlements[plan] = entitlement;
    out.prices[plan] = price;
  }
  return out;
}

async function fetchTierConfig(): Promise<TierConfig> {
  try {
    const rows = await withAnonSql(async (tx) => {
      const r = await tx`SELECT plan, config FROM tier_settings`;
      return r as unknown as { plan: string; config: unknown }[];
    });
    return overlayTierConfig(rows);
  } catch (e) {
    // A read failure must never take a money-gating page down — degrade to defaults.
    console.error("tierConfig: failed to load tier_settings; using compiled defaults", e);
    return defaultTierConfig();
  }
}

const _cached = unstable_cache(fetchTierConfig, ["tier-config"], {
  revalidate: CACHE_TTL_SECONDS,
});

/**
 * The DB-overlaid tier config, cached ~60s. Money-gating call sites call this instead
 * of reading the compiled ENTITLEMENTS / PLAN_PRICE_USD directly, so an operator can
 * retune caps/allowances/prices with a single UPDATE and no redeploy.
 */
export async function loadTierConfig(): Promise<TierConfig> {
  try {
    return await _cached();
  } catch {
    // Outside a Next request context (unit tests, standalone scripts) unstable_cache
    // throws "incrementalCache missing". Fall back to a direct, uncached read — which
    // itself degrades to the compiled defaults on any DB error.
    return fetchTierConfig();
  }
}
