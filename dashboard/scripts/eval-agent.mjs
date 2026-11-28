#!/usr/bin/env node
// The only entry point of the live agent eval (plan Tasks 1.22, 2.10, 2.12 and 2.13, gate
// A17; PR J7: Haiku 5.5 by default, prompt caching, a hard $3 per pass).
//
//   npm run eval:agent -- --pass [--max-usd <n>] [--dry-run]
//       One full pass on Haiku 5.5 under one dollar budget, $3 by default and at most
//       (Andrew 2026-11-26: "max $2-3 per pass total, ideally without compromising
//       quality"): the matrix, then the injection set, then the judge over that matrix
//       run. Each stage's dollar caps are what is left of the budget after the stages
//       before it (their reported OpenRouter cost); a stage that stops, a stage whose
//       report carries no cost, or a budget with less than a cent left stops the pass, and
//       no later stage starts. Every run.json of the pass carries the pass id and the
//       pass's --max-usd, and the end prints the pass's reported spend against it ("at
//       least" when a stage stopped on a call whose cost or usage it could not read).
//       PR 7: a pass whose uncached estimate is over its budget, or whose stages would not
//       each fit what is left, is refused before any call (exit 3); since variant 3 calls
//       may emit 8,000 tokens it is ($3.49 at $3), so run the modes on their own instead.
//   npm run eval:agent -- --variant <1|2|3> [--model <id>] [--allow-non-haiku] [--seed <n>] [golden caps] [--dry-run]
//       The golden scenarios (lib/agent/evals/live.eval.ts: 4 scenarios by 3 personas).
//       Haiku 5.5 by default; --model must name a priced model (exit 2 otherwise, dry run
//       included), and any model but Haiku 5.5 also needs --allow-non-haiku (PR J7 fix
//       round 1). Recordings go under lib/agent/evals/recordings/v<variant>/.
//   npm run eval:agent -- --matrix [--models a,b | --model <id>] [--allow-non-haiku] [matrix caps] [--dry-run]
//       The variant matrix (lib/agent/evals/matrix.eval.ts): per model, 180 cells (4
//       scenarios by 3 personas by 5 repeats live in variant 1, each re-rendered into
//       variants 2 and 3). Haiku 5.5 by default; any other model needs --allow-non-haiku
//       (exit 2 otherwise, dry run included). Recordings go under
//       lib/agent/evals/recordings/matrix/<run id>/<model>/v<variant>/.
//   npm run eval:agent -- --matrix --spot-check [--persona <id>] [spot-check caps] [--dry-run]
//       The Sonnet 5.5 spot check, opt-in and never part of --pass: one persona
//       (senior-backend unless --persona names another), one repeat, all 4 scenarios in
//       all 3 variants (12 cells), its own caps ($2.90 at most) and its own run folder
//       under recordings/matrix/ (run.json kind "spot-check"; readers take it only by
//       --run, never as "the latest complete" matrix run).
//   npm run eval:agent -- --matrix --rerender-only --run <matrix run id> [--allow-non-haiku] [matrix caps] [--dry-run]
//       Variants 2 and 3 again, without replaying variant 1: every recorded variant 1
//       surface of that complete full matrix run is written into the throwaway database
//       and re-rendered from its stored gathered data, on that run's models, under the
//       matrix caps (--max-cells counts re-render cells), into a new matrix run (run.json
//       kind "rerender-only", sourceRun the run re-rendered). Only re-render calls are
//       spent. Readers (the render smoke, the judge, the summary) read it as a matrix run,
//       pairing its variants 2 and 3 with the source run's variant 1. A source on another
//       model than Haiku 5.5 needs --allow-non-haiku. The dry run counts the source's
//       recorded surfaces.
//   npm run eval:agent -- --injection [--models a,b | --model <id>] [--allow-non-haiku] [injection caps] [--dry-run]
//       The prompt-injection set (lib/agent/evals/injection.eval.ts): per model, 15
//       model-driven cases in variants 1, 2 and 3 (45 runs). Haiku 5.5 by default, as the
//       matrix. Results go under lib/agent/evals/recordings/injection/<run id>/<model>/v<variant>/<case>.json.
//   npm run eval:agent -- --judge [--run <matrix run id>] [judge caps] [--dry-run]
//       The judge (lib/agent/evals/judge.eval.ts): Haiku 5.5 (judgeModel.ts) compares pairs
//       of matrix recordings (same model, scenario, persona and repeat; variants 1-2, 1-3,
//       2-3), blind to the variant, from one matrix run: --run, else the latest complete
//       one. Needs, for variant 3, the render smoke's results over that run
//       (EVAL_MATRIX_RUN=<id> npm run test:render-smoke). Results go under
//       lib/agent/evals/recordings/judge/<run id>/ with a 10% hand-check CSV. One model
//       only: it takes no --model or --models.
//
// Run ids (lib/agent/evals/evalRuns.ts): every matrix, injection and judge run gets a new
// id from the clock (UTC, YYYYMMDDTHHMMSSZ), a folder of its own named by it, and a
// run.json that ends as complete, cap_exceeded or failed with the cost its calls reported.
// Every recording and result carries the id. The script prints it before and after the run.
//
// --dry-run (every mode) prints the plan and the estimated tokens
// and list-price dollars, uncached and with the prompt cache (lib/agent/evals/matrixPlan.ts),
// whether that estimate stays within the caps, and the caps the run would have (the judge's
// also names the matrix run it would read), then exits 0. It needs no key and no database,
// and spends nothing. EVAL_RECORDINGS_ROOT, honoured only with --dry-run, points the run
// lookup at another recordings folder (the script's tests use a temporary one).
//
// The script sets EVAL_MODE to the mode it starts; each *.eval.ts refuses to start under
// any other value, so the live files run only through here.
//
// Every other run SPENDS MONEY on the OpenRouter key it is given. Use a dedicated
// OpenRouter key with its own credit limit, as an outer guard beyond the caps below. Run it
// only inside the owned throwaway database, which forwards the key only when asked
// (gate A17):
//   python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \
//     npm --prefix dashboard run eval:agent -- --pass
// The database guards (lib/testing/dbHarness assertHarnessDsn) refuse anything else, and
// this script refuses to start without OPENROUTER_API_KEY.
//
// Spend caps (lib/agent/evals/budget.ts). Each flag may lower its cap, never raise it past
// the ceiling (a usage error, exit 2). Any cap trips the whole run: the case or cell in
// progress writes no recording, later ones are skipped, the run is marked cap_exceeded
// and the script exits non-zero. A model call whose usage cannot be read trips it too.
// No mode can spend more than $3 on its own (PR J7):
// Pass:
//   --max-usd <n>       reported dollars over all three stages     default 3,   ceiling 3
// Golden run:
//   --max-cases <n>     scenario x persona cases played (the first n)  default 12, ceiling 12
//   --max-steps <n>     model calls in one turn of a case              default 8,  ceiling 8 (the route's limit)
//   --max-tokens <n>    input + output tokens over the whole run       default 2,000,000, ceiling 8,000,000
//   --max-usd <n>       reported cost over the whole run, in dollars   default 2,  ceiling 3
//   --max-minutes <n>   wall clock for the whole run                   default 30, ceiling 60
// Matrix (each model's run has these caps; the whole command also has the two totals):
//   --max-cells <n>         cells per model (the first n of its plan) default 180, ceiling 180
//   --max-steps <n>         model calls in one turn or re-render      default 8,   ceiling 8
//   --max-tokens <n>        tokens per model                          default 22,000,000, ceiling 44,000,000
//   --max-usd <n>           reported dollars per model                default 3, ceiling 3
//   --max-minutes <n>       wall clock per model                      default 360, ceiling 600
//   --max-total-tokens <n>  tokens over every model                   default 44,000,000, ceiling 88,000,000
//   --max-total-usd <n>     reported dollars over every model         default 3, ceiling 3
// Spot check (--matrix --spot-check; one model):
//   --max-cells <n>         cells (the first n of its 12)             default 12,  ceiling 12
//   --max-steps <n>         model calls in one turn or re-render      default 8,   ceiling 8
//   --max-tokens <n>        tokens                                    default 2,000,000, ceiling 4,000,000
//   --max-usd <n>           reported dollars                          default 2.9, ceiling 2.9
//   --max-minutes <n>       wall clock                                default 60,  ceiling 120
//   --max-total-tokens <n>  as --max-tokens                           default 2,000,000, ceiling 4,000,000
//   --max-total-usd <n>     as --max-usd                              default 2.9, ceiling 2.9
// Injection (each model's run has these caps; the whole command also has the two totals):
//   --max-cases <n>         runs per model (the first n of its plan)  default 45,  ceiling 45
//   --max-steps <n>         model calls in one turn                   default 8,   ceiling 8
//   --max-tokens <n>        tokens per model                          default 9,000,000, ceiling 18,000,000
//   --max-usd <n>           reported dollars per model                default 1,   ceiling 1.5
//   --max-minutes <n>       wall clock per model                      default 120, ceiling 240
//   --max-total-tokens <n>  tokens over every model                   default 18,000,000, ceiling 36,000,000
//   --max-total-usd <n>     reported dollars over every model         default 1,   ceiling 1.5
// Judge (one model, one budget):
//   --max-pairs <n>         pairs judged (repeat by repeat)           default 144, ceiling 360
//   --max-steps <n>         model calls per pair                      default 1,   ceiling 1
//   --max-tokens <n>        tokens over the whole run                 default 3,000,000, ceiling 6,000,000
//   --max-usd <n>           reported dollars over the whole run       default 0.5, ceiling 1
//   --max-minutes <n>       wall clock for the whole run              default 60,  ceiling 120
// In a pass, each stage takes its mode's defaults except the dollar caps, which are what
// is left of the pass budget (never above the mode's own ceiling).
//
// Dollar caps come from the cost OpenRouter reports for each call; no price table stands in
// for them. In every mode (the golden run too, since PR J7 fix round 1) a call that
// reports no cost stops the run (cost_unknown), so --max-usd and --max-total-usd never
// switch off.
//
// --models and --model (golden, matrix, injection) take only models with a row in
// lib/agent/prices.ts; any other is a usage error (exit 2), dry run included.
//
// Needs Node 22.18 or later: it loads config.ts, budget.ts, matrixPlan.ts, judgeModel.ts
// and evalRuns.ts directly (type stripping), so a bad flag is refused here before vitest
// or the database starts any work.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const MAX_MODELS = 8;
const USAGE =
  "usage: npm run eval:agent -- --pass [--max-usd <n>] [--dry-run]\n" +
  "   or: npm run eval:agent -- --variant <1|2|3> [--model <openrouter model id>] [--allow-non-haiku] [--seed <integer>] [--dry-run]\n" +
  "       [--max-cases <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]\n" +
  "   or: npm run eval:agent -- --matrix [--models <id,id> | --model <id>] [--allow-non-haiku] [--dry-run]\n" +
  "       [--max-cells <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]\n" +
  "       [--max-total-tokens <n>] [--max-total-usd <n>]\n" +
  "   or: npm run eval:agent -- --matrix --spot-check [--persona <id>] [--dry-run] [spot-check caps as the matrix's]\n" +
  "   or: npm run eval:agent -- --matrix --rerender-only --run <matrix run id> [--allow-non-haiku] [--dry-run] [matrix caps]\n" +
  "   or: npm run eval:agent -- --injection [--models <id,id> | --model <id>] [--allow-non-haiku] [--dry-run]\n" +
  "       [--max-cases <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]\n" +
  "       [--max-total-tokens <n>] [--max-total-usd <n>]\n" +
  "   or: npm run eval:agent -- --judge [--run <matrix run id>] [--dry-run]\n" +
  "       [--max-pairs <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]";

/** Each mode: its cap profile and the eval file vitest runs (vitest.eval.config.ts includes every *.eval.ts). */
const MODES = {
  golden: { profile: "golden", file: "lib/agent/evals/live.eval.ts" },
  matrix: { profile: "matrix", file: "lib/agent/evals/matrix.eval.ts" },
  injection: { profile: "injection", file: "lib/agent/evals/injection.eval.ts" },
  judge: { profile: "judge", file: "lib/agent/evals/judge.eval.ts" },
  pass: { profile: null, file: null },
};
const MODE_FLAGS = Object.keys(MODES)
  .filter((m) => m !== "golden")
  .map((m) => `--${m}`);

function usage(message) {
  console.error(`eval:agent: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

let budget;
let plan;
let judgeModel;
let runs;
let config;
try {
  config = await import("../lib/agent/config.ts");
  budget = await import("../lib/agent/evals/budget.ts");
  plan = await import("../lib/agent/evals/matrixPlan.ts");
  judgeModel = await import("../lib/agent/evals/judgeModel.ts");
  runs = await import("../lib/agent/evals/evalRuns.ts");
} catch (error) {
  console.error(`eval:agent: could not load lib/agent/config.ts or lib/agent/evals/budget.ts, matrixPlan.ts, judgeModel.ts or evalRuns.ts (${error?.message ?? error}); this script needs Node 22.18 or later`);
  process.exit(2);
}
const { CapUsageError, capsToEnv, parseCaps, parseTotalCaps, profileFlags, totalCapsToEnv } = budget;

function parseModels(raw) {
  const list = raw.split(",").map((m) => m.trim());
  if (list.length === 0 || list.length > MAX_MODELS || list.some((m) => !MODEL_RE.test(m))) {
    usage(`--models must be 1 to ${MAX_MODELS} comma-separated model ids`);
  }
  if (new Set(list).size !== list.length) usage("--models names a model twice");
  return list;
}

function parseArgs(argv) {
  const modeFlags = argv.filter((a) => MODE_FLAGS.includes(a));
  if (modeFlags.length > 1) usage(`give one of ${MODE_FLAGS.join(", ")}, once`);
  const mode = modeFlags.length === 0 ? "golden" : modeFlags[0].slice(2);
  // The spot check is the matrix mode with its own profile (one persona, one repeat, Sonnet).
  const spotCheck = mode === "matrix" && argv.includes("--spot-check");
  // A rerender-only run is the matrix mode, with the matrix profile, over an earlier run.
  const rerenderOnly = mode === "matrix" && argv.includes("--rerender-only");
  if (spotCheck && rerenderOnly) usage("give --spot-check or --rerender-only, not both");
  const profile = spotCheck ? "spot-check" : MODES[mode].profile;
  const flags = profile ? profileFlags(profile) : new Map();
  const out = {
    mode,
    profile,
    spotCheck,
    rerenderOnly,
    variant: null,
    model: null,
    models: null,
    seed: "1",
    run: null,
    persona: null,
    allowNonHaiku: false,
    dryRun: false,
    passUsd: undefined,
    caps: {},
    totals: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length) usage(`${flag} needs a value`);
      return argv[i];
    };
    if (MODE_FLAGS.includes(flag) && inline === undefined) continue;
    if (flag === "--spot-check" && spotCheck && inline === undefined) continue;
    if (flag === "--rerender-only" && rerenderOnly && inline === undefined) continue;
    // A rerender-only run takes its models from the run it re-renders.
    const ownModels = (mode === "matrix" || mode === "injection") && !spotCheck && !rerenderOnly;
    if (flag === "--variant" && mode === "golden") out.variant = value();
    else if (flag === "--model" && (mode === "golden" || ownModels)) out.model = value();
    else if (flag === "--models" && ownModels) out.models = parseModels(value());
    else if (flag === "--allow-non-haiku" && (mode === "golden" || mode === "matrix" || mode === "injection") && !spotCheck && inline === undefined) out.allowNonHaiku = true;
    else if (flag === "--persona" && spotCheck) out.persona = value();
    else if (flag === "--seed" && mode === "golden") out.seed = value();
    else if (flag === "--run" && (mode === "judge" || rerenderOnly)) out.run = value();
    else if (flag === "--max-usd" && mode === "pass") out.passUsd = value();
    else if (flag === "--dry-run" && inline === undefined) out.dryRun = true;
    else if (flags.has(flag)) {
      const { key, total } = flags.get(flag);
      (total ? out.totals : out.caps)[key] = value();
    } else usage(`unknown argument ${arg}${mode === "golden" ? "" : ` for --${mode}${spotCheck ? " --spot-check" : rerenderOnly ? " --rerender-only" : ""}`}`);
  }
  if (rerenderOnly && out.run === null) usage("--rerender-only needs --run <matrix run id>, the complete matrix run to re-render");
  if (mode === "golden" && !["1", "2", "3"].includes(out.variant ?? "")) usage("--variant must be 1, 2 or 3");
  if (out.model !== null && !MODEL_RE.test(out.model)) usage("--model is not a model id");
  if (out.model !== null && out.models !== null) usage("give --model or --models, not both");
  if (!/^-?\d{1,9}$/.test(out.seed)) usage("--seed must be an integer");
  if (out.run !== null && !runs.RUN_ID_RE.test(out.run)) usage("--run must be a run id (YYYYMMDDTHHMMSSZ, a folder under lib/agent/evals/recordings/matrix/)");
  if (out.persona !== null && !plan.isMatrixPersona(out.persona)) usage(`--persona must be one of ${plan.MATRIX_PERSONAS.join(", ")}`);
  try {
    if (mode === "pass") out.passUsd = budget.parsePassUsd(out.passUsd);
    else {
      out.caps = parseCaps(out.caps, profile);
      out.totals = parseTotalCaps(out.totals, profile);
    }
  } catch (error) {
    if (error instanceof CapUsageError) usage(error.message);
    throw error;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
// Where runs are looked up: the real recordings folder, or EVAL_RECORDINGS_ROOT for a dry run only.
const RECORDINGS_DIR =
  args.dryRun && process.env.EVAL_RECORDINGS_ROOT ? path.resolve(process.env.EVAL_RECORDINGS_ROOT) : path.join(DASHBOARD_DIR, "lib", "agent", "evals", "recordings");

// --matrix --rerender-only: the run it re-renders, a complete full matrix run, and its variant 1 recordings.
let sourceRun = null;
let sourceCells = null;
if (args.rerenderOnly) {
  try {
    sourceRun = runs.selectRun(runs.runRoot("matrix", RECORDINGS_DIR), args.run);
  } catch (error) {
    if (error instanceof runs.RunSelectionError) usage(error.message.replace(/^eval: /, ""));
    throw error;
  }
  const problem = runs.rerenderSourceProblem(sourceRun);
  if (problem) usage(problem);
  sourceCells = runs.recordedV1Cells(path.join(runs.runRoot("matrix", RECORDINGS_DIR), sourceRun.runId), sourceRun.runId);
  if (sourceRun.models.length === 0) usage(`matrix run ${sourceRun.runId} names no model to re-render with`);
  if (sourceCells.cells.length === 0) usage(`matrix run ${sourceRun.runId} has no variant 1 recording to re-render`);
}

const models =
  args.mode === "pass"
    ? null
    : args.mode === "golden"
      ? [args.model ?? config.AGENT_EVAL_DEFAULT_MODEL]
      : args.mode === "judge"
      ? [judgeModel.AGENT_JUDGE_MODEL]
      : args.spotCheck
        ? [config.AGENT_SPOT_CHECK_MODEL]
        : sourceRun
          ? [...sourceRun.models]
          : plan.runModels({ models: args.models, model: args.model });
// The golden run, the matrix and the injection set run only models in the price table, so
// neither the dry run, the caps' sizing nor the per-call worst case ever prices a model at
// another model's rate (dry run included), and only Haiku 5.5 unless --allow-non-haiku (or
// the spot check) says otherwise (PR J7; the golden run since fix round 1).
if (args.mode === "golden" || args.mode === "matrix" || args.mode === "injection") {
  const unpriced = plan.unpricedModels(models);
  if (unpriced.length > 0) usage(plan.unpricedMessage(unpriced));
  const others = plan.nonDefaultModels(models);
  if (others.length > 0 && !args.allowNonHaiku && !args.spotCheck) usage(plan.nonDefaultMessage(others));
}

// The judge reads one matrix run: the one named, else the latest complete one (never a spot check).
let matrixRun = null;
if (args.mode === "judge") {
  try {
    matrixRun = runs.selectRun(runs.runRoot("matrix", RECORDINGS_DIR), args.run);
  } catch (error) {
    if (error instanceof runs.RunSelectionError) usage(error.message.replace(/^eval: /, ""));
    throw error;
  }
}

if (args.dryRun) {
  if (args.mode === "pass") console.log(plan.formatPassDryRun({ budgetUsd: args.passUsd }));
  else if (args.mode === "golden") {
    console.log(plan.formatGoldenDryRun({ variant: Number(args.variant), model: models[0], seed: Number(args.seed), caps: args.caps }));
  } else if (args.mode === "matrix" && sourceRun) {
    console.log(
      plan.formatRerenderOnlyDryRun({
        sourceRun: sourceRun.runId,
        sources: sourceCells.cells,
        unreadable: sourceCells.unreadable.length,
        models,
        caps: args.caps,
        totals: args.totals,
      }),
    );
  } else if (args.mode === "matrix") {
    console.log(
      args.spotCheck
        ? plan.formatMatrixDryRun({
            models,
            caps: args.caps,
            totals: args.totals,
            plan: plan.spotCheckPlan(models[0], args.persona ?? plan.SPOT_CHECK_PERSONA),
            profile: "spot-check",
            title: `Spot check dry run (persona ${args.persona ?? plan.SPOT_CHECK_PERSONA}, one repeat)`,
          })
        : plan.formatMatrixDryRun({ models, caps: args.caps, totals: args.totals }),
    );
  } else {
    // The judge's estimate is for --max-pairs pairs; fewer run when the matrix has fewer.
    const count = args.mode === "judge" ? args.caps.maxCases : Math.min(args.caps.maxCases, budget.INJECTION_RUNS_PER_MODEL);
    console.log(plan.formatSimpleDryRun({ profile: args.profile, models, runs: count, caps: args.caps, totals: args.totals }));
    if (args.mode === "judge") {
      console.log(
        matrixRun
          ? `\nMatrix run judged: ${runs.describeRun(matrixRun)}${args.run ? "" : " (the latest complete one)"}.`
          : "\nMatrix run judged: none yet (no complete run under lib/agent/evals/recordings/matrix/); a real run would stop here.",
      );
    }
  }
  process.exit(0);
}

// PR 7: a pass whose uncached estimate is over its budget, or one a stage would not fit, is
// refused here, before the key check and before any vitest stage or model call: it would
// otherwise spend on its first stages and stop at a cap part way (matrixPlan.ts passRefusal).
if (args.mode === "pass") {
  const refusal = plan.passRefusal({ budgetUsd: args.passUsd });
  if (refusal !== null) {
    console.error(`eval:agent: ${refusal}`);
    process.exit(3);
  }
}

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  const command =
    args.mode === "golden"
      ? "--variant 1"
      : args.spotCheck
        ? "--matrix --spot-check"
        : args.rerenderOnly
          ? `--matrix --rerender-only --run ${args.run}`
          : `--${args.mode}`;
  console.error(
    "eval:agent: OPENROUTER_API_KEY is not set. Run this inside the throwaway database with the key forwarded:\n" +
      "  python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \\\n" +
      `    npm --prefix dashboard run eval:agent -- ${command}\n` +
      `Add --dry-run to see the plan and the estimated cost without a key.\n`,
  );
  process.exit(2);
}

if (args.mode === "judge" && !matrixRun) usage("no complete matrix run to judge under lib/agent/evals/recordings/matrix/; run --matrix first, or name one with --run");

/**
 * Runs one mode in vitest and reads the report its eval file writes. Returns the report
 * (null when there is none: the run never reached its end) and vitest's exit status.
 */
function runStage(stage) {
  const reportDir = mkdtempSync(path.join(os.tmpdir(), "eval-agent-"));
  const reportFile = path.join(reportDir, "run.json");
  const inherited = { ...process.env };
  // Only this script picks the mode, the runs, the models and what they may do: none of it
  // is inherited from the caller's environment (PR J7 fix round 1 adds the per-mode model,
  // variant and seed, and the pass's budget).
  for (const name of [
    "EVAL_MODE",
    "EVAL_RUN_ID",
    "EVAL_MATRIX_RUN",
    "EVAL_PASS_ID",
    "EVAL_MODEL",
    "EVAL_MODELS",
    "EVAL_VARIANT",
    "EVAL_SEED",
    runs.EVAL_PASS_BUDGET_ENV,
    "EVAL_MATRIX_KIND",
    "EVAL_PERSONA",
    "EVAL_SOURCE_RUN",
    "EVAL_ALLOW_NON_HAIKU",
    "EVAL_RECORDINGS_ROOT",
  ]) {
    delete inherited[name];
  }
  const env = {
    ...inherited,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" "),
    EVAL_RUN_REPORT: reportFile,
    [budget.EVAL_MODE_ENV]: stage.mode,
    ...(stage.runId ? { EVAL_RUN_ID: stage.runId } : {}),
    ...(stage.matrixRunId ? { EVAL_MATRIX_RUN: stage.matrixRunId } : {}),
    ...(stage.passId ? { [runs.EVAL_PASS_ID_ENV]: stage.passId } : {}),
    ...capsToEnv(stage.caps, stage.profile),
    ...totalCapsToEnv(stage.totals, stage.profile),
    ...(stage.env ?? {}),
  };
  const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
  const result = spawnSync(vitest, ["run", "--config", "vitest.eval.config.ts", MODES[stage.mode].file], {
    cwd: DASHBOARD_DIR,
    env,
    stdio: "inherit",
  });
  if (result.error) {
    rmSync(reportDir, { recursive: true, force: true });
    console.error(`eval:agent: could not start vitest (${result.error.message})`);
    process.exit(1);
  }
  let report = null;
  try {
    report = JSON.parse(readFileSync(reportFile, "utf8"));
  } catch {
    // No report: the run never reached its end (a setup failure). Fail closed.
  }
  rmSync(reportDir, { recursive: true, force: true });
  if (report) console.log(`\n${report.text}\n`);
  if (stage.runId) console.log(`eval:agent: run ${stage.runId}: lib/agent/evals/recordings/${stage.mode}/${stage.runId}/`);
  return { report, vitestStatus: result.status ?? 1 };
}

/** The exit of a single run, from its report, as before PR J7. */
function exitFor({ report, vitestStatus }) {
  if (report?.status === "cap_exceeded") {
    console.error(`eval:agent: run stopped: cap_exceeded (${report.cap})`);
    process.exit(vitestStatus || 3);
  }
  if (!report) {
    console.error("eval:agent: the run wrote no report");
    process.exit(vitestStatus || 1);
  }
  process.exit(vitestStatus);
}

if (args.mode === "pass") runPass();

// One mode on its own. A new run id for every matrix, injection and judge run: its folder is created by the eval file.
const runId = args.mode === "golden" ? null : runs.newRunId();
if (runId) {
  const what = args.spotCheck ? " spot check" : sourceRun ? ` re-render of run ${sourceRun.runId}` : "";
  console.log(`eval:agent: ${args.mode}${what} run ${runId}${matrixRun ? ` over matrix run ${runs.describeRun(matrixRun)}` : ""}`);
}
exitFor(
  runStage({
    mode: args.mode,
    profile: args.profile,
    runId,
    matrixRunId: matrixRun?.runId ?? null,
    passId: null,
    caps: args.caps,
    totals: args.totals,
    env:
      args.mode === "golden"
        ? { EVAL_VARIANT: args.variant, EVAL_SEED: args.seed, EVAL_MODEL: models[0], ...(args.allowNonHaiku ? { EVAL_ALLOW_NON_HAIKU: "1" } : {}) }
        : {
            EVAL_MODELS: models.join(","),
            ...(args.allowNonHaiku ? { EVAL_ALLOW_NON_HAIKU: "1" } : {}),
            ...(args.spotCheck ? { EVAL_MATRIX_KIND: "spot-check", EVAL_PERSONA: args.persona ?? plan.SPOT_CHECK_PERSONA } : {}),
            ...(sourceRun ? { EVAL_MATRIX_KIND: "rerender-only", EVAL_SOURCE_RUN: sourceRun.runId } : {}),
          },
  }),
);

/**
 * `--pass`: matrix, then injection, then judge over that matrix run, all on Haiku 5.5,
 * under one dollar budget. Each stage's dollar caps are what is left; any stage that does
 * not complete with a reported cost stops the pass. Never returns.
 */
function runPass() {
  const passId = runs.newRunId();
  const model = config.AGENT_EVAL_DEFAULT_MODEL;
  const spent = [];
  const rows = [];
  console.log(`eval:agent: pass ${passId} on ${model}, budget $${args.passUsd.toFixed(2)}: matrix, then injection, then judge`);

  // Fix round 1: a stage that stopped on a call whose cost or usage it could not read
  // (cost_unknown, usage_unknown) reported only what it could read, so its cost and the
  // pass total are floors ("at least").
  const finish = (outcome, code) => {
    const total = spent.reduce((a, b) => a + b, 0);
    const floor = rows.some((r) => r.costUsd === null || r.floor);
    const cost = (r) => (r.costUsd === null ? "unknown" : `${r.floor ? "at least " : ""}$${r.costUsd.toFixed(4)}`);
    console.log(
      [
        "",
        `Pass ${passId}: ${outcome}`,
        "",
        "| Stage | Run | Status | Reported cost |",
        "|---|---|---|---|",
        ...rows.map((r) => `| ${r.stage} | ${r.runId} | ${r.status} | ${cost(r)} |`),
        `| pass total | | | ${floor ? "at least " : ""}$${total.toFixed(4)} of $${args.passUsd.toFixed(2)} |`,
        "",
      ].join("\n"),
    );
    process.exit(code);
  };

  let matrixRunId = null;
  for (const mode of ["matrix", "injection", "judge"]) {
    const left = budget.passRemaining(args.passUsd, spent);
    if (left <= 0) finish(`stopped before ${mode}: less than a cent of the budget is left`, 3);
    const profile = MODES[mode].profile;
    const ceiling = budget.profileCeilings(profile).maxUsd;
    const usd = String(Math.min(left, ceiling));
    let caps;
    let totals;
    try {
      caps = parseCaps({ maxUsd: usd }, profile);
      totals = parseTotalCaps(budget.TOTAL_CAP_SPECS[profile] ? { maxTotalUsd: usd } : {}, profile);
    } catch (error) {
      if (error instanceof CapUsageError) finish(`stopped before ${mode}: ${error.message}`, 3);
      throw error;
    }
    const runId = runs.newRunId();
    console.log(`eval:agent: pass ${passId}: ${mode} run ${runId}, up to $${usd} (of $${left.toFixed(2)} left)`);
    const { report, vitestStatus } = runStage({
      mode,
      profile,
      runId,
      matrixRunId: mode === "judge" ? matrixRunId : null,
      passId,
      caps,
      totals,
      // Every stage records the pass's whole budget in its run.json, for eval:summary's Pass spend.
      env: { [runs.EVAL_PASS_BUDGET_ENV]: String(args.passUsd), ...(mode === "judge" ? {} : { EVAL_MODELS: model }) },
    });
    const cost = typeof report?.costUsd === "number" && Number.isFinite(report.costUsd) && report.costUsd >= 0 ? report.costUsd : null;
    const status = report ? report.status : "no report";
    rows.push({ stage: mode, runId, status, costUsd: cost, floor: runs.costIsFloor(report?.cap) });
    if (cost === null) finish(`stopped at ${mode}: its report carries no reported cost, so the budget cannot be checked`, vitestStatus || 1);
    spent.push(cost);
    if (report.status === "cap_exceeded") finish(`stopped at ${mode}: cap_exceeded (${report.cap})`, vitestStatus || 3);
    if (report.status !== "complete" || vitestStatus !== 0) finish(`stopped at ${mode}: ${status}`, vitestStatus || 1);
    if (mode === "matrix") matrixRunId = runId;
  }
  finish("complete", 0);
}
