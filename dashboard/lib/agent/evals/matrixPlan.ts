// The variant matrix's plan and the cost estimates of every paid eval mode (plan Tasks
// 2.10, 2.12 and 2.13; PR J7). Pure, with relative imports of pure files only, so
// scripts/eval-agent.mjs loads it through Node's type stripping: `--dry-run` prints the
// plan and the estimate with no key, no database and no model call.
//
// The matrix (Task 2.10): 4 scenarios by 3 personas by 5 repeats by 3 variants, 180
// cells a model. To hold the gathered data constant, variant 1 runs live once per
// scenario, persona and repeat; variants 2 and 3 are re-renders (rerenderSurface, run kind
// rerender) of each surface that run stored, so all three variants show the same data.
// The spot check (PR J7) is the same plan cut to one persona and one repeat.
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
//   - prices: lib/agent/prices.ts, list prices per call (Haiku 5.5 at the tier of one
//     call's prompt), [Unverified] on OpenRouter. The matrix and the injection set run only
//     models with their own row (UnpricedModelError otherwise; eval-agent.mjs refuses them
//     with exit 2), so no estimate prices an unknown model at another model's rate. The
//     judge (Haiku 5.5 since PR J7) is priced at its own row too;
//   - prompt caching (PR J7, lib/agent/cache.ts): every estimate is shown uncached (the
//     conservative figure, what the caps are sized against) and cached, with the shares of
//     input below (CACHE_SHARES): a cache read at 0.1x the input price, a write at 1.25x.
import { AGENT_EVAL_DEFAULT_MODEL, type Variant } from "../config.ts";
import { callCostMicros, isPriced } from "../prices.ts";
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

/** The spot check's persona when --persona names none: the first of the plan's. */
export const SPOT_CHECK_PERSONA: MatrixPersona = MATRIX_PERSONAS[0];

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

export function isMatrixPersona(p: string): p is MatrixPersona {
  return (MATRIX_PERSONAS as readonly string[]).includes(p);
}

/**
 * The matrix cells for each model, in the order they run: per scenario, persona and
 * repeat, the variant 1 cell first, then the variant 2 and 3 re-renders of it. `personas`
 * narrows the plan (the spot check runs one).
 */
export function matrixPlan(
  models: readonly string[],
  repeats: number = MATRIX_REPEATS,
  personas: readonly MatrixPersona[] = MATRIX_PERSONAS,
): MatrixCell[] {
  const out: MatrixCell[] = [];
  for (const model of models) {
    for (const scenario of MATRIX_SCENARIOS) {
      for (const persona of MATRIX_PERSONAS) {
        if (!personas.includes(persona)) continue;
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

/** The spot check's plan (PR J7): one model, one persona, one repeat, every scenario and variant (12 cells). */
export function spotCheckPlan(model: string, persona: MatrixPersona = SPOT_CHECK_PERSONA): MatrixCell[] {
  return matrixPlan([model], 1, [persona]);
}

// ---------------------------------------------------------------------------
// Which models may run
// ---------------------------------------------------------------------------

/** The models in `models` other than the eval default (Haiku 5.5). */
export function nonDefaultModels(models: readonly string[]): string[] {
  return models.filter((m) => m !== AGENT_EVAL_DEFAULT_MODEL);
}

/** Why a matrix or injection run on another model is refused without --allow-non-haiku. */
export function nonDefaultMessage(models: readonly string[]): string {
  return (
    `${models.join(", ")} is not ${AGENT_EVAL_DEFAULT_MODEL}, the eval default. The matrix and the injection set run on ` +
    "Haiku unless you pass --allow-non-haiku, so a dearer model is never run by accident (its cap still stops the run at " +
    "$3); for a Sonnet 5.5 comparison use --matrix --spot-check"
  );
}

export class NonDefaultModelError extends Error {
  constructor(models: string[]) {
    super(nonDefaultMessage(models));
    this.name = "NonDefaultModelError";
  }
}

/** Refuses a run over any model but Haiku 5.5 unless the command allowed it (eval files re-check what the script checked). */
export function assertDefaultModelOrAllowed(models: readonly string[], allowed: boolean): void {
  const others = nonDefaultModels(models);
  if (others.length > 0 && !allowed) throw new NonDefaultModelError(others);
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

/** The shares of a call's input tokens assumed read from and written to the prompt cache; the rest pays full price. */
export interface CacheShare {
  read: number;
  write: number;
}

/**
 * The cached estimate's assumption (PR J7), per kind of call, and where it comes from:
 *   - agent: a variant 1 or injection step. lib/agent/cache.ts puts a breakpoint after the
 *     system prompt and one after the last user or tool message, so each step reads the
 *     whole previous prompt from the cache and writes only what the turn added since (the
 *     model's last message and the new tool results). Over a case that writes about one
 *     call's prompt in all: at the A17 sizing (a ~7k prefix growing to ~20k over 7 to 13
 *     calls) 11-18% of the case's input is written and the rest read. The estimate rounds
 *     that to 25% written and 75% read, the conservative side; it also covers a turn that
 *     starts after the 5-minute TTL or after the history window slid.
 *   - rerender: only the ~4k of instructions, grammar and present's schema (a third of a
 *     12k call) is a shared prefix (no tail breakpoint: the gathered data differs per
 *     surface). It is written by a cell's first call and read by its others, about 3.5
 *     calls a cell: 25% of the input read, 10% written, 65% at full price.
 *   - judge: no breakpoints (judge.eval.ts does not wrap its model), so nothing cached.
 * Reads are priced at 0.1x (prices.ts CACHE_READ_MULTIPLIER), writes at 1.25x.
 */
export const CACHE_SHARES: Record<"agent" | "rerender" | "judge", CacheShare> = {
  agent: { read: 0.75, write: 0.25 },
  rerender: { read: 0.25, write: 0.1 },
  judge: { read: 0, write: 0 },
};

export interface TokenCost {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** At the model's list price with no prompt cache, in micro-dollars (what the caps are sized against). */
  costMicros: number;
  /** The same work with the prompt cache at CACHE_SHARES, in micro-dollars. */
  cachedCostMicros: number;
}

/** A matrix or injection model with no row in the price table: refused, never priced at another model's rate. */
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

function cost(modelId: string, calls: number, input: number, output: number, share: CacheShare): TokenCost {
  assertPricedModels([modelId]);
  const inputTokens = calls * input;
  const outputTokens = calls * output;
  // Priced per call, so a tiered model (Haiku 5.5) is priced at the tier of one call's prompt.
  const perCall = callCostMicros({ inputTokens: input, outputTokens: output }, modelId, { discountReads: true });
  const perCallCached = callCostMicros(
    { inputTokens: input, outputTokens: output, cacheReadTokens: input * share.read, cacheWriteTokens: input * share.write },
    modelId,
    { discountReads: true },
  );
  return { calls, inputTokens, outputTokens, costMicros: Math.ceil(calls * perCall), cachedCostMicros: Math.ceil(calls * perCallCached) };
}

function add(a: TokenCost, b: TokenCost): TokenCost {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costMicros: a.costMicros + b.costMicros,
    cachedCostMicros: a.cachedCostMicros + b.cachedCostMicros,
  };
}

const ZERO: TokenCost = { calls: 0, inputTokens: 0, outputTokens: 0, costMicros: 0, cachedCostMicros: 0 };

export interface ModelEstimate {
  model: string;
  cells: Record<Variant, number>;
  byVariant: Record<Variant, TokenCost>;
  total: TokenCost;
}

/** One re-render cell of `surfaces` surfaces into `variant`. */
export function estimateRerenderCell(model: string, variant: 2 | 3, surfaces: number): TokenCost {
  const t = RERENDER_CALL_TOKENS[variant];
  return cost(model, surfaces * RERENDER_CALLS_PER_SURFACE, t.input, t.output, CACHE_SHARES.rerender);
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
        ? cost(model, V1_CALLS[c.scenario], V1_CALL_TOKENS.input, V1_CALL_TOKENS.output, CACHE_SHARES.agent)
        : estimateRerenderCell(model, c.variant, V1_SURFACES[c.scenario]);
    byVariant[c.variant] = add(byVariant[c.variant], one);
  }
  return { model, cells, byVariant, total: add(add(byVariant[1], byVariant[2]), byVariant[3]) };
}

/** The injection set's estimate for one model: `runs` runs of about INJECTION_CALLS_PER_RUN calls. */
export function estimateInjection(model: string, runs: number): TokenCost {
  return cost(model, runs * INJECTION_CALLS_PER_RUN, V1_CALL_TOKENS.input, V1_CALL_TOKENS.output, CACHE_SHARES.agent);
}

/** The judge's estimate: one call per pair, at the judge model's own list price (it must be priced). */
export function estimateJudge(model: string, pairs: number = JUDGE_PAIRS_DEFAULT): TokenCost {
  return cost(model, pairs, JUDGE_CALL_TOKENS.input, JUDGE_CALL_TOKENS.output, CACHE_SHARES.judge);
}

/**
 * The judge pairs of a full matrix of one model (4 x 3 x 5 cells, three variant pairs each)
 * that need no render smoke: variants 1 and 2 only (60). A pass runs no render smoke, so
 * its judge judges these; the variant 3 pairs need `npm run test:render-smoke` first.
 */
export const PASS_JUDGE_PAIRS_WITHOUT_RENDER = MATRIX_SCENARIOS.length * MATRIX_PERSONAS.length * MATRIX_REPEATS;

// ---------------------------------------------------------------------------
// The dry run's report
// ---------------------------------------------------------------------------

export const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
const millions = (n: number) => `${(n / 1_000_000).toFixed(2)}M`;

/** The models a run covers: --models, else --model, else the eval default (Haiku 5.5, PR J7). */
export function runModels(a: { models?: readonly string[] | null; model?: string | null }): string[] {
  if (a.models && a.models.length > 0) return [...a.models];
  if (a.model) return [a.model];
  return [AGENT_EVAL_DEFAULT_MODEL];
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

const CACHE_NOTE = [
  "Uncached is the conservative figure the caps are sized against. Cached assumes lib/agent/evals/matrixPlan.ts CACHE_SHARES:",
  "an agent step reads 75% of its input from the prompt cache and writes 25%; a re-render reads 25% and writes 10%; the judge",
  "caches nothing. Reads at 0.1x the input price, writes at 1.25x (lib/agent/prices.ts).",
];

const within = (e: TokenCost, maxTokens: number, maxUsd: number) => e.inputTokens + e.outputTokens <= maxTokens && e.costMicros <= maxUsd * 1_000_000;

/**
 * What `--matrix --dry-run` prints: the cell plan, the estimate per model and the caps.
 * `plan` defaults to the full plan of `models`; the spot check passes its own, with its
 * own profile. Spends nothing.
 */
export function formatMatrixDryRun(a: {
  models: readonly string[];
  caps: EvalCaps;
  totals: TotalCaps | null;
  plan?: readonly MatrixCell[];
  profile?: "matrix" | "spot-check";
  title?: string;
}): string {
  assertPricedModels(a.models);
  const plan = a.plan ?? matrixPlan(a.models);
  const lines = [
    `${a.title ?? "Matrix dry run"}: nothing is run and nothing is spent. ${plan.length} cells over ${a.models.length} model(s).`,
    "",
    "| Model | Cells (v1 live / v2 / v3 re-render) | Calls | Input tokens | Output tokens | Est. cost uncached | Est. cost cached | Within caps |",
    "|---|---|---|---|---|---|---|---|",
  ];
  let all = ZERO;
  for (const model of a.models) {
    const e = estimateMatrix(plan, model);
    all = add(all, e.total);
    lines.push(
      `| ${model} | ${e.cells[1]} / ${e.cells[2]} / ${e.cells[3]} | ${e.total.calls} | ${millions(e.total.inputTokens)} | ` +
        `${millions(e.total.outputTokens)} | ${dollars(e.total.costMicros)} | ${dollars(e.total.cachedCostMicros)} | ` +
        `${within(e.total, a.caps.maxTokens, a.caps.maxUsd) ? "yes" : "NO: the run would stop at a cap"} |`,
    );
    for (const v of MATRIX_VARIANTS) {
      const b = e.byVariant[v];
      lines.push(
        `| (variant ${v}) | ${e.cells[v]} | ${b.calls} | ${millions(b.inputTokens)} | ${millions(b.outputTokens)} | ${dollars(b.costMicros)} | ${dollars(b.cachedCostMicros)} | |`,
      );
    }
  }
  const totalWithin = a.totals === null || within(all, a.totals.maxTotalTokens, a.totals.maxTotalUsd);
  lines.push(
    `| all models | ${plan.length} | ${all.calls} | ${millions(all.inputTokens)} | ${millions(all.outputTokens)} | ${dollars(all.costMicros)} | ` +
      `${dollars(all.cachedCostMicros)} | ${totalWithin ? "yes" : "NO: the run would stop at the total cap"} |`,
    "",
    "The estimate is a model of the work (lib/agent/evals/matrixPlan.ts), at list prices; OpenRouter's prices for these",
    "slugs are unverified. The caps below are what stops a real run.",
    ...CACHE_NOTE,
    "",
    ...capLines(a.profile ?? "matrix", a.caps, a.totals),
  );
  return lines.join("\n");
}

/** One variant 1 recording a rerender-only run would re-render (evalRuns.ts recordedV1Cells). */
export interface RerenderSourceCell {
  model: string;
  scenario: string;
  persona: string;
  seed: number;
  /** The recording's surfaces: each is re-rendered once into variant 2 and once into 3. */
  surfaces: number;
}

/**
 * The re-render cells a rerender-only run plays for `model` (PR J7): the plan's variant 2
 * and 3 cells whose variant 1 recording is in `sources`, in plan order, the first
 * `maxCells`, each with the surface count of its recording.
 */
export function rerenderOnlyCells(model: string, sources: readonly RerenderSourceCell[], maxCells: number): { cell: MatrixCell; surfaces: number }[] {
  const key = (s: RerenderSourceCell) => cellKey({ model: s.model, scenario: s.scenario as MatrixScenario, persona: s.persona as MatrixPersona, repeat: s.seed, variant: 1 });
  const byKey = new Map(sources.filter((s) => s.model === model).map((s) => [key(s), s.surfaces]));
  return matrixPlan([model])
    .filter((c) => c.kind === "rerender" && c.from !== null && byKey.has(c.from))
    .slice(0, maxCells)
    .map((cell) => ({ cell, surfaces: byKey.get(cell.from as string) ?? 0 }));
}

/**
 * What `--matrix --rerender-only --run <id> --dry-run` prints (PR J7): per model of the
 * source run, the variant 2 and 3 cells it would re-render from that run's recorded variant
 * 1 surfaces, their estimate at those surface counts, and the matrix caps. Spends nothing.
 */
export function formatRerenderOnlyDryRun(a: {
  sourceRun: string;
  sources: readonly RerenderSourceCell[];
  unreadable: number;
  models: readonly string[];
  caps: EvalCaps;
  totals: TotalCaps | null;
}): string {
  assertPricedModels(a.models);
  let all = ZERO;
  let cells = 0;
  const rows: string[] = [];
  for (const model of a.models) {
    const planned = rerenderOnlyCells(model, a.sources, a.caps.maxCases);
    const byVariant: Record<2 | 3, TokenCost> = { 2: ZERO, 3: ZERO };
    const count: Record<2 | 3, number> = { 2: 0, 3: 0 };
    let surfaces = 0;
    for (const { cell, surfaces: n } of planned) {
      const v = cell.variant as 2 | 3;
      byVariant[v] = add(byVariant[v], estimateRerenderCell(model, v, n));
      count[v] += 1;
      surfaces += n;
    }
    const total = add(byVariant[2], byVariant[3]);
    all = add(all, total);
    cells += planned.length;
    rows.push(
      `| ${model} | ${count[2]} / ${count[3]} | ${surfaces} | ${total.calls} | ${millions(total.inputTokens)} | ${millions(total.outputTokens)} | ` +
        `${dollars(total.costMicros)} | ${dollars(total.cachedCostMicros)} | ${within(total, a.caps.maxTokens, a.caps.maxUsd) ? "yes" : "NO: the run would stop at a cap"} |`,
    );
  }
  const totalWithin = a.totals === null || within(all, a.totals.maxTotalTokens, a.totals.maxTotalUsd);
  return [
    `Re-render-only dry run over matrix run ${a.sourceRun}: nothing is run and nothing is spent. ${cells} re-render cells over ${a.models.length} model(s); no variant 1 cell is played.`,
    "",
    "| Model | Cells (v2 / v3) | Surfaces re-rendered | Calls | Input tokens | Output tokens | Est. cost uncached | Est. cost cached | Within caps |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    `| all models | ${cells} | | ${all.calls} | ${millions(all.inputTokens)} | ${millions(all.outputTokens)} | ${dollars(all.costMicros)} | ` +
      `${dollars(all.cachedCostMicros)} | ${totalWithin ? "yes" : "NO: the run would stop at the total cap"} |`,
    "",
    `The surface counts are the source run's recorded variant 1 surfaces${a.unreadable > 0 ? ` (${a.unreadable} file(s) did not parse and are left out)` : ""};`,
    "the calls and tokens per surface are the model in lib/agent/evals/matrixPlan.ts, at list prices (OpenRouter's prices for these",
    "slugs are unverified). The caps below are what stops a real run; --max-cells counts re-render cells.",
    ...CACHE_NOTE,
    "",
    ...capLines("matrix", a.caps, a.totals),
  ].join("\n");
}

/** What `--injection --dry-run` and `--judge --dry-run` print. */
export function formatSimpleDryRun(a: {
  profile: "injection" | "judge";
  models: readonly string[];
  runs: number;
  caps: EvalCaps;
  totals: TotalCaps | null;
}): string {
  assertPricedModels(a.models);
  const lines = [
    `${a.profile === "injection" ? "Injection" : "Judge"} dry run: nothing is run and nothing is spent.`,
    "",
    "| Model | Runs | Calls | Input tokens | Output tokens | Est. cost uncached | Est. cost cached | Within caps |",
    "|---|---|---|---|---|---|---|---|",
  ];
  let all = ZERO;
  for (const model of a.models) {
    const e = a.profile === "injection" ? estimateInjection(model, a.runs) : estimateJudge(model, a.runs);
    all = add(all, e);
    lines.push(
      `| ${model} | ${a.runs} | ${e.calls} | ${millions(e.inputTokens)} | ${millions(e.outputTokens)} | ${dollars(e.costMicros)} | ` +
        `${dollars(e.cachedCostMicros)} | ${within(e, a.caps.maxTokens, a.caps.maxUsd) ? "yes" : "NO: the run would stop at a cap"} |`,
    );
  }
  if (a.totals !== null) {
    const totalWithin = within(all, a.totals.maxTotalTokens, a.totals.maxTotalUsd);
    lines.push(
      `| all models | ${a.runs * a.models.length} | ${all.calls} | ${millions(all.inputTokens)} | ${millions(all.outputTokens)} | ${dollars(all.costMicros)} | ` +
        `${dollars(all.cachedCostMicros)} | ${totalWithin ? "yes" : "NO: the run would stop at the total cap"} |`,
    );
  }
  if (a.profile === "judge") {
    lines.push(
      "",
      "Judged pairs need the render smoke for any variant 3 surface: without it only the variant 1 and 2 pairs are judged",
      `(${PASS_JUDGE_PAIRS_WITHOUT_RENDER} for a full one-model matrix), and the estimate above is the most the run takes.`,
    );
  }
  lines.push("", ...CACHE_NOTE, "", ...capLines(a.profile, a.caps, a.totals));
  return lines.join("\n");
}

/** One stage of a pass in its dry run. */
export interface PassStageEstimate {
  stage: "matrix" | "injection" | "judge";
  model: string;
  what: string;
  cost: TokenCost;
}

/** The estimate of one `--pass` (matrix, injection, judge on the eval default model). */
export function estimatePass(model: string = AGENT_EVAL_DEFAULT_MODEL, judgePairs: number = JUDGE_PAIRS_DEFAULT): PassStageEstimate[] {
  const injectionRuns = PROFILE_CAP_SPECS.injection.maxCases.default;
  return [
    { stage: "matrix", model, what: `${matrixPlan([model]).length} cells`, cost: estimateMatrix(matrixPlan([model]), model).total },
    { stage: "injection", model, what: `${injectionRuns} runs`, cost: estimateInjection(model, injectionRuns) },
    { stage: "judge", model, what: `up to ${judgePairs} pairs`, cost: estimateJudge(model, judgePairs) },
  ];
}

/** What `--pass --dry-run` prints: each stage's estimate, the pass's total against its budget, and how the cap holds. */
export function formatPassDryRun(a: { budgetUsd: number; model?: string; judgePairs?: number }): string {
  const stages = estimatePass(a.model, a.judgePairs);
  const total = stages.reduce((s, x) => add(s, x.cost), ZERO);
  const budgetMicros = a.budgetUsd * 1_000_000;
  const fits = (micros: number) => (micros <= budgetMicros ? "yes" : "NO");
  const lines = [
    `Pass dry run: nothing is run and nothing is spent. Matrix, then injection, then judge, one budget of $${a.budgetUsd.toFixed(2)}.`,
    "",
    "| Stage | Model | Work | Calls | Input tokens | Output tokens | Est. cost uncached | Est. cost cached |",
    "|---|---|---|---|---|---|---|---|",
    ...stages.map(
      (s) =>
        `| ${s.stage} | ${s.model} | ${s.what} | ${s.cost.calls} | ${millions(s.cost.inputTokens)} | ${millions(s.cost.outputTokens)} | ` +
        `${dollars(s.cost.costMicros)} | ${dollars(s.cost.cachedCostMicros)} |`,
    ),
    `| pass total | | | ${total.calls} | ${millions(total.inputTokens)} | ${millions(total.outputTokens)} | ${dollars(total.costMicros)} | ${dollars(total.cachedCostMicros)} |`,
    "",
    `Pass total against the budget: ${dollars(total.costMicros)} uncached (within $${a.budgetUsd.toFixed(2)}: ${fits(total.costMicros)}), ` +
      `${dollars(total.cachedCostMicros)} cached (within: ${fits(total.cachedCostMicros)}).`,
  ];
  if (total.costMicros > budgetMicros) {
    lines.push(
      "The uncached estimate is above the budget. The cap still holds: each stage's dollar caps are what is left of the",
      "budget, so the stage that reaches it stops (cap_exceeded), records nothing from the cell or case in progress, and",
      "no later stage starts. To fit uncached, lower --max-cells or --max-cases on the single modes, or judge fewer pairs.",
    );
  }
  lines.push(
    "",
    "How the budget is shared: each stage's --max-usd (and the matrix's and injection's --max-total-usd) is the pass budget",
    "minus what the earlier stages reported, rounded down to the cent, and never above that mode's own ceiling. A call that",
    "reports no cost stops the pass (cost_unknown). A stage may pass its cap by at most part of one call (the budget refuses",
    "a call that could pass it, judged by the dearest call so far); the next stage then has nothing left and does not start.",
    `The judge here is the most it takes: a pass runs no render smoke, so it judges the ${PASS_JUDGE_PAIRS_WITHOUT_RENDER} variant 1 / 2 pairs of the`,
    "matrix it just ran; judge the variant 3 pairs afterwards with the render smoke and --judge --run <matrix run>.",
    ...CACHE_NOTE,
  );
  return lines.join("\n");
}
