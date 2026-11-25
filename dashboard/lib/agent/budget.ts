// Per-user agent spend ceiling (Task 0.7): pure pricing and headroom functions plus two
// reads. All charging is in lib/agent/runs.ts (Task 0.8), which re-reads spend under a
// lock as the service role; checkBudget here is only the cheap advisory pre-check a
// route uses to refuse early.
//
// Spend is usage_counters rows of kind USAGE_KIND_AGENT, n in micro-dollars, read as
// the user (users have SELECT on their own rows). Windows match lib/usage.ts: the UTC
// day and the UTC calendar month.
import { z } from "zod";
import { loadAppSettings, type AppSettings } from "@/lib/appSettings";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { AGENT_EVAL_MODELS, USAGE_KIND_AGENT } from "@/lib/agent/config";

export type BudgetState =
  | { ok: true; remainingMicros: number }
  | { ok: false; reason: "agent_disabled" | "daily_ceiling" | "monthly_ceiling" };

export type AgentSpend = { dayMicros: number; monthMicros: number };

type BudgetSettings = Pick<AppSettings, "agentEnabled" | "agentDailyCeilingMicros" | "agentMonthlyCeilingMicros">;

type Price = { input: number; output: number };

// Micro-dollars per million tokens, used only when a step carries no billed cost.
// Anthropic first-party list prices (claude-api reference, cached 2026-11-03); the
// OpenRouter prices for these slugs are [Unverified] (Spike A did not run). Haiku 5.5
// is priced at its long-prompt tier ($0.50 / $2.50 above 100K input tokens), because an
// estimate that runs high only stops a user early, while one that runs low lets spend
// pass the ceiling.
const MODEL_PRICES: Record<(typeof AGENT_EVAL_MODELS)[number], Price> = {
  "anthropic/claude-sonnet-5.5": { input: 2_000_000, output: 10_000_000 },
  "anthropic/claude-haiku-5.5": { input: 500_000, output: 2_500_000 },
};

function mostExpensive(prices: Price[]): Price {
  return prices.reduce((a, b) => (b.input + b.output > a.input + a.output ? b : a));
}

/** Every AGENT_EVAL_MODELS entry, plus `default` (the most expensive of them) for anything else. */
export const PRICE_PER_MTOK_MICROS: Record<string, Price> & { default: Price } = {
  ...MODEL_PRICES,
  default: mostExpensive(Object.values(MODEL_PRICES)),
};

const openRouterCostSchema = z.object({
  openrouter: z.object({ usage: z.object({ cost: z.number().finite().nonnegative() }) }),
});

/** Whole micros, rounding up, without float noise turning 12300.000000000002 into 12301. */
function ceilMicros(micros: number): number {
  const nearest = Math.round(micros);
  return Math.abs(micros - nearest) < 1e-6 ? nearest : Math.ceil(micros);
}

/**
 * What one model step cost, in micro-dollars. Prefers OpenRouter's billed cost
 * (providerMetadata.openrouter.usage.cost, in dollars); falls back to a token estimate
 * at the model's price, or the default price for an unknown model. A step that used any
 * tokens costs at least 1 micro.
 */
export function stepCostMicros(
  step: { providerMetadata?: unknown; usage: { inputTokens?: number; outputTokens?: number } },
  modelId: string,
): number {
  const inputTokens = Math.max(0, step.usage.inputTokens ?? 0);
  const outputTokens = Math.max(0, step.usage.outputTokens ?? 0);
  const billed = parseOrNull(openRouterCostSchema, step.providerMetadata);
  let micros: number;
  if (billed) {
    micros = ceilMicros(billed.openrouter.usage.cost * 1_000_000);
  } else {
    const price = PRICE_PER_MTOK_MICROS[modelId] ?? PRICE_PER_MTOK_MICROS.default;
    micros = ceilMicros((inputTokens * price.input + outputTokens * price.output) / 1_000_000);
  }
  return inputTokens + outputTokens > 0 ? Math.max(1, micros) : micros;
}

/** Remaining headroom under both ceilings; the kill switch wins over any spend. */
export function headroom(spend: AgentSpend, settings: BudgetSettings): BudgetState {
  if (!settings.agentEnabled) return { ok: false, reason: "agent_disabled" };
  const day = settings.agentDailyCeilingMicros - spend.dayMicros;
  if (day <= 0) return { ok: false, reason: "daily_ceiling" };
  const month = settings.agentMonthlyCeilingMicros - spend.monthMicros;
  if (month <= 0) return { ok: false, reason: "monthly_ceiling" };
  return { ok: true, remainingMicros: Math.min(day, month) };
}

// SUM(int4) is bigint, which postgres.js returns as a string: coerce, never cast.
const spendRowSchema = z.object({
  day_micros: z.coerce.number().int().nonnegative(),
  month_micros: z.coerce.number().int().nonnegative(),
});

/** This user's agent spend today and this month (UTC), in micro-dollars. */
export async function getAgentSpend(userId: string): Promise<AgentSpend> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT
      COALESCE(SUM(n) FILTER (WHERE day = (now() AT TIME ZONE 'utc')::date), 0) AS day_micros,
      COALESCE(SUM(n), 0) AS month_micros
    FROM usage_counters
    WHERE user_id = ${userId}::uuid
      AND kind = ${USAGE_KIND_AGENT}
      AND day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date
  `);
  const row = parseOrNull(spendRowSchema, rows[0]);
  if (!row) throw new Error("agent: spend read returned an unexpected row");
  return { dayMicros: row.day_micros, monthMicros: row.month_micros };
}

/** Advisory pre-check: skips the spend read when the agent is switched off. */
export async function checkBudget(userId: string): Promise<BudgetState> {
  const settings = await loadAppSettings();
  if (!settings.agentEnabled) return { ok: false, reason: "agent_disabled" };
  return headroom(await getAgentSpend(userId), settings);
}
