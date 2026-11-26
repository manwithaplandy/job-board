// The variant matrix's plan and the cost estimates of every paid eval mode (plan Tasks
// 2.10, 2.12 and 2.13). Pure, with relative imports of pure files only, so
// scripts/eval-agent.mjs loads it through Node's type stripping: `--dry-run` prints the
// plan and the estimate with no key, no database and no model call.
//
// The matrix (Task 2.10): 4 scenarios by 3 personas by 5 repeats by 3 variants, 180
// cells a model. To hold the gathered data constant, variant 1 runs live once per
// scenario, persona and repeat; variants 2 and 3 are re-renders (rerenderSurface, run kind
// rerender) of each surface that run stored, so all three variants show the same data.
//
// The estimate is a model of the work, not a measurement. Its inputs, and where they come
// from:
//   - model calls per variant 1 case: the phase 1 gate's scripted turns (gateScripts.ts:
//     a 12, b 6, c 6, d 6) plus one each for a model that takes an extra step;
//   - tokens per variant 1 call: 15,000 in and 600 out, the top of the 12-15k average the
//     A17 sizing found (7k fixed prefix plus the growing thread);
//   - surfaces per variant 1 case: what the scripted turns present (a 3, b 2, c 1, d 1);
//   - a re-render: two calls per surface (present's one repair, the worst case), 12,000
//     tokens in each (instructions, grammar and present's schema, about 4k, plus the
//     surface's gathered data, typically 8k and capped at 120,000 characters), and out
//     2,000 tokens for a variant 2 tree or 4,000 (AGENT_LIMITS.maxOutputTokens, the
//     worst case) for a variant 3 document;
//   - prices: PRICE_PER_MTOK_MICROS (lib/agent/prices.ts), list prices, [Unverified] on
//     OpenRouter. The matrix and the injection set run only models with their own row
//     (UnpricedModelError otherwise; eval-agent.mjs refuses them with exit 2), so no
//     estimate prices an unknown model at another model's rate. The judge's fixed model
//     has no row and is estimated at the default (Sonnet 5.5's list price), labelled so.
import { AGENT_EVAL_MODELS, type Variant } from "../config.ts";
import { isPriced, priceFor } from "../prices.ts";
import {
  JUDGE_PAIRS_DEFAULT,
  PROFILE_CAP_SPECS,
  TOTAL_CAP_SPECS,
  type CapProfile,
  type EvalCaps,
  type TotalCaps,
} from "./budget.ts";

/** SCENARIO_IDS and PERSONA_IDS, restated so this file stays pure; matrix.test.ts holds them equal. */
export const MATRIX_SCENARIOS = ["a_resume_upload", "b_compare", "c_prep", "d_weekly"] as const;
export const MATRIX_PERSONAS = ["senior-backend", "career-switcher", "new-grad"] as const;
export const MATRIX_VARIANTS = [1, 2, 3] as const satisfies readonly Variant[];
export const MATRIX_REPEATS = 5;

export type MatrixScenario = (typeof MATRIX_SCENARIOS)[number];
export type MatrixPersona = (typeof MATRIX_PERSONAS)[number];

/** One cell: a model, scenario, persona, repeat and variant. Variant 1 is played live; 2 and 3 re-render it. */
export interface MatrixCell {
  model: string;
  scenario: MatrixScenario;
  persona: MatrixPersona;
  /** 1 to MATRIX_REPEATS; also the run's seed, so the five repeats differ. */
  repeat: number;
  variant: Variant;
  /** live: the scenario played on the model; rerender: variant 1's surfaces re-rendered. */
  kind: "live" | "rerender";
  /** For a re-render: the key of the variant 1 cell whose data it reuses. */
  from: string | null;
}

/** A cell's key, unique within a model's plan. */
export function cellKey(c: Pick<MatrixCell, "model" | "scenario" | "persona" | "repeat" | "variant">): string {
  return `${c.model}|${c.scenario}|${c.persona}|r${c.repeat}|v${c.variant}`;
}

/**
 * The matrix cells for each model, in the order they run: per scenario, persona and
 * repeat, the variant 1 cell first, then the variant 2 and 3 re-renders of it.
 */
export function matrixPlan(models: readonly string[], repeats: number = MATRIX_REPEATS): MatrixCell[] {
  const out: MatrixCell[] = [];
  for (const model of models) {
    for (const scenario of MATRIX_SCENARIOS) {
      for (const persona of MATRIX_PERSONAS) {
        for (let repeat = 1; repeat <= repeats; repeat++) {
          const live: MatrixCell = { model, scenario, persona, repeat, variant: 1, kind: "live", from: null };
          out.push(live);
          for (const variant of [2, 3] as const) {
            out.push({ model, scenario, persona, repeat, variant, kind: "rerender", from: cellKey(live) });
          }
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The estimate
// ---------------------------------------------------------------------------

export const V1_CALLS: Record<MatrixScenario, number> = { a_resume_upload: 13, b_compare: 7, c_prep: 7, d_weekly: 7 };
export const V1_SURFACES: Record<MatrixScenario, number> = { a_resume_upload: 3, b_compare: 2, c_prep: 1, d_weekly: 1 };
export const V1_CALL_TOKENS = { input: 15_000, output: 600 };
export const RERENDER_CALLS_PER_SURFACE = 2;
export const RERENDER_CALL_TOKENS: Record<2 | 3, { input: number; output: number }> = {
  2: { input: 12_000, output: 2_000 },
  3: { input: 12_000, output: 4_000 },
};
/** An injection run: about one of the shorter scenarios (two turns, about eight calls). */
export const INJECTION_CALLS_PER_RUN = 8;
/** A judge call: two recordings' surfaces as data plus the rubric, and a short verdict. */
export const JUDGE_CALL_TOKENS = { input: 12_000, output: 400 };

export interface TokenCost {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** At the model's list price, in micro-dollars. */
  costMicros: number;
}

/** A matrix or injection model with no row in PRICE_PER_MTOK_MICROS: refused, never priced at another model's rate. */
export class UnpricedModelError extends Error {
  readonly models: string[];

  constructor(models: string[]) {
    super(unpricedMessage(models));
    this.name = "UnpricedModelError";
    this.models = models;
  }
}

/** The models in `models` with no row of their own in the price table. */
export function unpricedModels(models: readonly string[]): string[] {
  return models.filter((m) => !isPriced(m));
}

/** Why a run over unpriced models is refused, for the script's usage error and the eval files. */
export function unpricedMessage(models: readonly string[]): string {
  return (
    `no price for ${models.join(", ")} in lib/agent/prices.ts (PRICE_PER_MTOK_MICROS). The matrix and the injection set ` +
    "run only priced models, so the dry run's estimate and the caps' sizing hold; add its list price there first"
  );
}

/** Refuses a matrix or injection run over a model the price table does not have. */
export function assertPricedModels(models: readonly string[]): void {
  const missing = unpricedModels(models);
  if (missing.length > 0) throw new UnpricedModelError(missing);
}

function cost(modelId: string, calls: number, input: number, output: number, opts: { allowDefault?: boolean } = {}): TokenCost {
  if (!opts.allowDefault) assertPricedModels([modelId]);
  const price = priceFor(modelId);
  const inputTokens = calls * input;
  const outputTokens = calls * output;
  return {
    calls,
    inputTokens,
    outputTokens,
    costMicros: Math.ceil((inputTokens * price.input + outputTokens * price.output) / 1_000_000),
  };
}

function add(a: TokenCost, b: TokenCost): TokenCost {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costMicros: a.costMicros + b.costMicros,
  };
}

const ZERO: TokenCost = { calls: 0, inputTokens: 0, outputTokens: 0, costMicros: 0 };

export interface ModelEstimate {
  model: string;
  cells: Record<Variant, number>;
  byVariant: Record<Variant, TokenCost>;
  total: TokenCost;
}

/** The estimated tokens and list-price cost of one model's cells in `plan`. */
export function estimateMatrix(plan: readonly MatrixCell[], model: string): ModelEstimate {
  const cells: Record<Variant, number> = { 1: 0, 2: 0, 3: 0 };
  const byVariant: Record<Variant, TokenCost> = { 1: ZERO, 2: ZERO, 3: ZERO };
  for (const c of plan) {
    if (c.model !== model) continue;
    cells[c.variant] += 1;
    const one =
      c.variant === 1
        ? cost(model, V1_CALLS[c.scenario], V1_CALL_TOKENS.input, V1_CALL_TOKENS.output)
        : cost(
            model,
            V1_SURFACES[c.scenario] * RERENDER_CALLS_PER_SURFACE,
            RERENDER_CALL_TOKENS[c.variant].input,
            RERENDER_CALL_TOKENS[c.variant].output,
          );
    byVariant[c.variant] = add(byVariant[c.variant], one);
  }
  return { model, cells, byVariant, total: add(add(byVariant[1], byVariant[2]), byVariant[3]) };
}

/** The injection set's estimate for one model: `runs` runs of about INJECTION_CALLS_PER_RUN calls. */
export function estimateInjection(model: string, runs: number): TokenCost {
  return cost(model, runs * INJECTION_CALLS_PER_RUN, V1_CALL_TOKENS.input, V1_CALL_TOKENS.output);
}

/**
 * The judge's estimate: one call per pair. The judge model has no row in the price table,
 * so it is priced at the default (Sonnet 5.5's list price): an estimate that may be high or
 * low. The judge's reported-cost cap is what bounds the run.
 */
export function estimateJudge(model: string, pairs: number = JUDGE_PAIRS_DEFAULT): TokenCost {
  return cost(model, pairs, JUDGE_CALL_TOKENS.input, JUDGE_CALL_TOKENS.output, { allowDefault: true });
}

// ---------------------------------------------------------------------------
// The dry run's report
// ---------------------------------------------------------------------------

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
const millions = (n: number) => `${(n / 1_000_000).toFixed(2)}M`;

/** The models a run covers: --models, else --model, else every AGENT_EVAL_MODELS entry. */
export function runModels(a: { models?: readonly string[] | null; model?: string | null }): string[] {
  if (a.models && a.models.length > 0) return [...a.models];
  if (a.model) return [a.model];
  return [...AGENT_EVAL_MODELS];
}

function capLines(profile: CapProfile, caps: EvalCaps, totals: TotalCaps | null): string[] {
  const specs = PROFILE_CAP_SPECS[profile];
  const lines = [
    "| Cap | Applies to | This run | Default | Ceiling |",
    "|---|---|---|---|---|",
    ...(Object.keys(specs) as Array<keyof EvalCaps>).map(
      (k) => `| ${specs[k].flag} | ${specs[k].label} | ${caps[k]} | ${specs[k].default} | ${specs[k].ceiling} |`,
    ),
  ];
  const t = TOTAL_CAP_SPECS[profile];
  if (t && totals) {
    for (const k of Object.keys(t) as Array<keyof TotalCaps>) {
      lines.push(`| ${t[k].flag} | ${t[k].label} | ${totals[k]} | ${t[k].default} | ${t[k].ceiling} |`);
    }
  }
  return lines;
}

/** What `--matrix --dry-run` prints: the cell plan, the estimate per model and the caps. Spends nothing. */
export function formatMatrixDryRun(a: { models: readonly string[]; caps: EvalCaps; totals: TotalCaps | null }): string {
  assertPricedModels(a.models);
  const plan = matrixPlan(a.models);
  const lines = [
    `Matrix dry run: nothing is run and nothing is spent. ${plan.length} cells over ${a.models.length} model(s).`,
    "",
    "| Model | Cells (v1 live / v2 / v3 re-render) | Calls | Input tokens | Output tokens | Est. cost (list price) | Within caps |",
    "|---|---|---|---|---|---|---|",
  ];
  let all = ZERO;
  for (const model of a.models) {
    const e = estimateMatrix(plan, model);
    all = add(all, e.total);
    const within =
      e.total.inputTokens + e.total.outputTokens <= a.caps.maxTokens && e.total.costMicros <= a.caps.maxUsd * 1_000_000;
    lines.push(
      `| ${model} | ${e.cells[1]} / ${e.cells[2]} / ${e.cells[3]} | ${e.total.calls} | ${millions(e.total.inputTokens)} | ` +
        `${millions(e.total.outputTokens)} | ${dollars(e.total.costMicros)} | ${within ? "yes" : "NO: the run would stop at a cap"} |`,
    );
    for (const v of MATRIX_VARIANTS) {
      const b = e.byVariant[v];
      lines.push(`| (variant ${v}) | ${e.cells[v]} | ${b.calls} | ${millions(b.inputTokens)} | ${millions(b.outputTokens)} | ${dollars(b.costMicros)} | |`);
    }
  }
  const totalWithin =
    a.totals === null ||
    (all.inputTokens + all.outputTokens <= a.totals.maxTotalTokens && all.costMicros <= a.totals.maxTotalUsd * 1_000_000);
  lines.push(
    `| all models | ${plan.length} | ${all.calls} | ${millions(all.inputTokens)} | ${millions(all.outputTokens)} | ${dollars(all.costMicros)} | ${totalWithin ? "yes" : "NO: the run would stop at the total cap"} |`,
    "",
    "The estimate is a model of the work (lib/agent/evals/matrixPlan.ts), at list prices; OpenRouter's prices for these",
    "slugs are unverified. The caps below are what stops a real run.",
    "",
    ...capLines("matrix", a.caps, a.totals),
  );
  return lines.join("\n");
}

/** What `--injection --dry-run` and `--judge --dry-run` print. */
export function formatSimpleDryRun(a: {
  profile: "injection" | "judge";
  models: readonly string[];
  runs: number;
  caps: EvalCaps;
  totals: TotalCaps | null;
}): string {
  if (a.profile === "injection") assertPricedModels(a.models);
  const lines = [
    `${a.profile === "injection" ? "Injection" : "Judge"} dry run: nothing is run and nothing is spent.`,
    "",
    "| Model | Runs | Calls | Input tokens | Output tokens | Est. cost (list price) | Within caps |",
    "|---|---|---|---|---|---|---|",
  ];
  let all = ZERO;
  for (const model of a.models) {
    const e = a.profile === "injection" ? estimateInjection(model, a.runs) : estimateJudge(model, a.runs);
    all = add(all, e);
    const within = e.inputTokens + e.outputTokens <= a.caps.maxTokens && e.costMicros <= a.caps.maxUsd * 1_000_000;
    lines.push(
      `| ${model} | ${a.runs} | ${e.calls} | ${millions(e.inputTokens)} | ${millions(e.outputTokens)} | ${dollars(e.costMicros)} | ` +
        `${within ? "yes" : "NO: the run would stop at a cap"} |`,
    );
  }
  if (a.totals !== null) {
    const totalWithin = all.inputTokens + all.outputTokens <= a.totals.maxTotalTokens && all.costMicros <= a.totals.maxTotalUsd * 1_000_000;
    lines.push(
      `| all models | ${a.runs * a.models.length} | ${all.calls} | ${millions(all.inputTokens)} | ${millions(all.outputTokens)} | ${dollars(all.costMicros)} | ` +
        `${totalWithin ? "yes" : "NO: the run would stop at the total cap"} |`,
    );
  }
  if (a.profile === "judge") {
    lines.push(
      "",
      "The judge model has no row in lib/agent/prices.ts, so it is estimated at Sonnet 5.5's list price: its real price may be",
      "higher or lower. The reported-cost cap (--max-usd) is what bounds the run, and a call that reports no cost stops it.",
    );
  }
  lines.push("", ...capLines(a.profile, a.caps, a.totals));
  return lines.join("\n");
}
