#!/usr/bin/env node
// The only entry point of the live agent eval (plan Tasks 1.22, 2.10, 2.12 and 2.13, gate A17).
//
//   npm run eval:agent -- --variant <1|2|3> [--model <id>] [--seed <n>] [golden caps]
//       The golden scenarios (lib/agent/evals/live.eval.ts: 4 scenarios by 3 personas).
//       Recordings go under lib/agent/evals/recordings/v<variant>/.
//   npm run eval:agent -- --matrix [--models a,b | --model <id>] [matrix caps] [--dry-run]
//       The variant matrix (lib/agent/evals/matrix.eval.ts): per model, 180 cells (4
//       scenarios by 3 personas by 5 repeats live in variant 1, each re-rendered into
//       variants 2 and 3). Models default to AGENT_EVAL_MODELS, Sonnet 5.5 first.
//       Recordings go under lib/agent/evals/recordings/matrix/<run id>/<model>/v<variant>/.
//   npm run eval:agent -- --injection [--models a,b | --model <id>] [injection caps] [--dry-run]
//       The prompt-injection set (lib/agent/evals/injection.eval.ts): per model, 15
//       model-driven cases in variants 1, 2 and 3 (45 runs). Results go under
//       lib/agent/evals/recordings/injection/<run id>/<model>/v<variant>/<case>.json.
//   npm run eval:agent -- --judge [--run <matrix run id>] [judge caps] [--dry-run]
//       The judge (lib/agent/evals/judge.eval.ts): openai/gpt-5.5 compares pairs of matrix
//       recordings (same model, scenario, persona and repeat; variants 1-2, 1-3, 2-3),
//       blind to the variant, from one matrix run: --run, else the latest complete one.
//       Needs, for variant 3, the render smoke's results over that run
//       (EVAL_MATRIX_RUN=<id> npm run test:render-smoke). Results go under
//       lib/agent/evals/recordings/judge/<run id>/ with a 10% hand-check CSV. One model
//       only: it takes no --model or --models.
//
// Run ids (lib/agent/evals/evalRuns.ts): every matrix, injection and judge run gets a new
// id from the clock (UTC, YYYYMMDDTHHMMSSZ), a folder of its own named by it, and a
// run.json that ends as complete, cap_exceeded or failed. Every recording and result
// carries the id. The script prints it before and after the run.
//
// --dry-run (matrix, injection and judge) prints the plan and the estimated tokens and list-price dollars per model
// (lib/agent/evals/matrixPlan.ts, PRICE_PER_MTOK_MICROS), whether that estimate stays
// within the caps, and the caps the run would have (the judge's also names the matrix run
// it would read), then exits 0. It needs no key and no database, and spends nothing.
//
// The script sets EVAL_MODE to the mode it starts; each *.eval.ts refuses to start under
// any other value, so the live files run only through here.
//
// Every other run SPENDS MONEY on the OpenRouter key it is given. Use a dedicated
// OpenRouter key with its own credit limit, as an outer guard beyond the caps below. Run it
// only inside the owned throwaway database, which forwards the key only when asked
// (gate A17):
//   python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \
//     npm --prefix dashboard run eval:agent -- --variant 1 --model anthropic/claude-sonnet-5.5
// The database guards (lib/testing/dbHarness assertHarnessDsn) refuse anything else, and
// this script refuses to start without OPENROUTER_API_KEY.
//
// Spend caps (lib/agent/evals/budget.ts). Each flag may lower its cap, never raise it past
// the ceiling (a usage error, exit 2). Any cap trips the whole run: the case or cell in
// progress writes no recording, later ones are skipped, the run is marked cap_exceeded
// and the script exits non-zero. A model call whose usage cannot be read trips it too.
// Golden run:
//   --max-cases <n>     scenario x persona cases played (the first n)  default 12, ceiling 12
//   --max-steps <n>     model calls in one turn of a case              default 8,  ceiling 8 (the route's limit)
//   --max-tokens <n>    input + output tokens over the whole run       default 2,000,000, ceiling 8,000,000
//   --max-usd <n>       reported cost over the whole run, in dollars   default 5,  ceiling 20
//   --max-minutes <n>   wall clock for the whole run                   default 30, ceiling 60
// Matrix (each model's run has these caps; the whole command also has the two totals):
//   --max-cells <n>         cells per model (the first n of its plan) default 180, ceiling 180
//   --max-steps <n>         model calls in one turn or re-render      default 8,   ceiling 8
//   --max-tokens <n>        tokens per model                          default 22,000,000, ceiling 44,000,000
//   --max-usd <n>           reported dollars per model                default 60,  ceiling 120
//   --max-minutes <n>       wall clock per model                      default 360, ceiling 600
//   --max-total-tokens <n>  tokens over every model                   default 44,000,000, ceiling 88,000,000
//   --max-total-usd <n>     reported dollars over every model         default 80,  ceiling 200
// Injection (each model's run has these caps; the whole command also has the two totals):
//   --max-cases <n>         runs per model (the first n of its plan)  default 45,  ceiling 45
//   --max-steps <n>         model calls in one turn                   default 8,   ceiling 8
//   --max-tokens <n>        tokens per model                          default 9,000,000, ceiling 18,000,000
//   --max-usd <n>           reported dollars per model                default 25,  ceiling 50
//   --max-minutes <n>       wall clock per model                      default 120, ceiling 240
//   --max-total-tokens <n>  tokens over every model                   default 18,000,000, ceiling 36,000,000
//   --max-total-usd <n>     reported dollars over every model         default 35,  ceiling 90
// Judge (one model, one budget):
//   --max-pairs <n>         pairs judged (repeat by repeat)           default 144, ceiling 360
//   --max-steps <n>         model calls per pair                      default 1,   ceiling 1
//   --max-tokens <n>        tokens over the whole run                 default 3,000,000, ceiling 6,000,000
//   --max-usd <n>           reported dollars over the whole run       default 10,  ceiling 20
//   --max-minutes <n>       wall clock for the whole run              default 60,  ceiling 120
// Dollar caps come from the cost OpenRouter reports for each call; no price table stands in
// for them. Matrix, injection and judge: a call that reports no cost stops the run
// (cost_unknown), so --max-usd and --max-total-usd never switch off. Golden run (A17,
// unchanged): --max-usd is enforced only when OpenRouter reports the cost; if the first
// call carries none, only the token cap applies and the report says so.
//
// --models and --model (matrix, injection) take only models with a row in
// lib/agent/prices.ts; any other is a usage error (exit 2), dry run included.
//
// Needs Node 22.18 or later: it loads budget.ts, matrixPlan.ts, judgeModel.ts and
// evalRuns.ts directly (type stripping), so a bad flag is refused here before vitest or
// the database starts any work.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const MAX_MODELS = 8;
const USAGE =
  "usage: npm run eval:agent -- --variant <1|2|3> [--model <openrouter model id>] [--seed <integer>]\n" +
  "       [--max-cases <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]\n" +
  "   or: npm run eval:agent -- --matrix [--models <id,id> | --model <id>] [--dry-run]\n" +
  "       [--max-cells <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]\n" +
  "       [--max-total-tokens <n>] [--max-total-usd <n>]\n" +
  "   or: npm run eval:agent -- --injection [--models <id,id> | --model <id>] [--dry-run]\n" +
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
try {
  budget = await import("../lib/agent/evals/budget.ts");
  plan = await import("../lib/agent/evals/matrixPlan.ts");
  judgeModel = await import("../lib/agent/evals/judgeModel.ts");
  runs = await import("../lib/agent/evals/evalRuns.ts");
} catch (error) {
  console.error(`eval:agent: could not load lib/agent/evals/budget.ts, matrixPlan.ts, judgeModel.ts or evalRuns.ts (${error?.message ?? error}); this script needs Node 22.18 or later`);
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
  const { profile } = MODES[mode];
  const flags = profileFlags(profile);
  const out = { mode, profile, variant: null, model: null, models: null, seed: "1", run: null, dryRun: false, caps: {}, totals: {} };
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
    if (flag === "--variant" && mode === "golden") out.variant = value();
    else if (flag === "--model" && mode !== "judge") out.model = value();
    else if (flag === "--models" && mode !== "golden" && mode !== "judge") out.models = parseModels(value());
    else if (flag === "--seed" && mode === "golden") out.seed = value();
    else if (flag === "--run" && mode === "judge") out.run = value();
    else if (flag === "--dry-run" && mode !== "golden" && inline === undefined) out.dryRun = true;
    else if (flags.has(flag)) {
      const { key, total } = flags.get(flag);
      (total ? out.totals : out.caps)[key] = value();
    } else usage(`unknown argument ${arg}${mode === "golden" ? "" : ` for --${mode}`}`);
  }
  if (mode === "golden" && !["1", "2", "3"].includes(out.variant ?? "")) usage("--variant must be 1, 2 or 3");
  if (out.model !== null && !MODEL_RE.test(out.model)) usage("--model is not a model id");
  if (out.model !== null && out.models !== null) usage("give --model or --models, not both");
  if (!/^-?\d{1,9}$/.test(out.seed)) usage("--seed must be an integer");
  if (out.run !== null && !runs.RUN_ID_RE.test(out.run)) usage("--run must be a run id (YYYYMMDDTHHMMSSZ, a folder under lib/agent/evals/recordings/matrix/)");
  try {
    out.caps = parseCaps(out.caps, profile);
    out.totals = parseTotalCaps(out.totals, profile);
  } catch (error) {
    if (error instanceof CapUsageError) usage(error.message);
    throw error;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const models =
  args.mode === "golden"
    ? null
    : args.mode === "judge"
      ? [judgeModel.AGENT_JUDGE_MODEL]
      : plan.runModels({ models: args.models, model: args.model });
// The matrix and the injection set run only models in the price table, so neither the dry
// run nor the caps' sizing ever prices a model at another model's rate (dry run included).
if (args.mode === "matrix" || args.mode === "injection") {
  const unpriced = plan.unpricedModels(models);
  if (unpriced.length > 0) usage(plan.unpricedMessage(unpriced));
}

// The judge reads one matrix run: the one named, else the latest complete one.
let matrixRun = null;
if (args.mode === "judge") {
  try {
    matrixRun = runs.selectRun(runs.runRoot("matrix", path.join(DASHBOARD_DIR, "lib", "agent", "evals", "recordings")), args.run);
  } catch (error) {
    if (error instanceof runs.RunSelectionError) usage(error.message.replace(/^eval: /, ""));
    throw error;
  }
}

if (args.dryRun) {
  if (args.mode === "matrix") console.log(plan.formatMatrixDryRun({ models, caps: args.caps, totals: args.totals }));
  else {
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

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.error(
    "eval:agent: OPENROUTER_API_KEY is not set. Run this inside the throwaway database with the key forwarded:\n" +
      "  python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \\\n" +
      `    npm --prefix dashboard run eval:agent -- ${args.mode === "golden" ? "--variant 1" : `--${args.mode}`}\n` +
      (args.mode === "golden" ? "" : `Add --dry-run to see the plan and the estimated cost without a key.\n`),
  );
  process.exit(2);
}

if (args.mode === "judge" && !matrixRun) usage("no complete matrix run to judge under lib/agent/evals/recordings/matrix/; run --matrix first, or name one with --run");

// A new run id for every matrix, injection and judge run: its folder is created by the eval file.
const runId = args.mode === "golden" ? null : runs.newRunId();
if (runId) console.log(`eval:agent: ${args.mode} run ${runId}${matrixRun ? ` over matrix run ${runs.describeRun(matrixRun)}` : ""}`);

const reportDir = mkdtempSync(path.join(os.tmpdir(), "eval-agent-"));
const reportFile = path.join(reportDir, "run.json");
const inherited = { ...process.env };
// Only this script picks the mode and the runs.
for (const name of ["EVAL_MODE", "EVAL_RUN_ID", "EVAL_MATRIX_RUN"]) delete inherited[name];
const env = {
  ...inherited,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" "),
  EVAL_RUN_REPORT: reportFile,
  [budget.EVAL_MODE_ENV]: args.mode,
  ...(runId ? { EVAL_RUN_ID: runId } : {}),
  ...(matrixRun ? { EVAL_MATRIX_RUN: matrixRun.runId } : {}),
  ...capsToEnv(args.caps, args.profile),
  ...totalCapsToEnv(args.totals, args.profile),
  ...(args.mode === "golden"
    ? { EVAL_VARIANT: args.variant, EVAL_SEED: args.seed, ...(args.model ? { EVAL_MODEL: args.model } : {}) }
    : { EVAL_MODELS: models.join(",") }),
};

const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
const result = spawnSync(vitest, ["run", "--config", "vitest.eval.config.ts", MODES[args.mode].file], {
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
  // No report: the run never reached its end (a setup failure). Fail closed below.
}
rmSync(reportDir, { recursive: true, force: true });

if (report) console.log(`\n${report.text}\n`);
if (runId) console.log(`eval:agent: run ${runId}: lib/agent/evals/recordings/${args.mode}/${runId}/`);
const vitestStatus = result.status ?? 1;
if (report?.status === "cap_exceeded") {
  console.error(`eval:agent: run stopped: cap_exceeded (${report.cap})`);
  process.exit(vitestStatus || 3);
}
if (!report) {
  console.error("eval:agent: the run wrote no report");
  process.exit(vitestStatus || 1);
}
process.exit(vitestStatus);
