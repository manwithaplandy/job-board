#!/usr/bin/env node
// The only entry point of the live agent eval (plan Tasks 1.22 and 2.10, gate A17).
//
//   npm run eval:agent -- --variant <1|2|3> [--model <id>] [--seed <n>] [golden caps]
//       The golden scenarios (lib/agent/evals/live.eval.ts: 4 scenarios by 3 personas).
//       Recordings go under lib/agent/evals/recordings/v<variant>/.
//   npm run eval:agent -- --matrix [--models a,b | --model <id>] [matrix caps] [--dry-run]
//       The variant matrix (lib/agent/evals/matrix.eval.ts): per model, 180 cells (4
//       scenarios by 3 personas by 5 repeats live in variant 1, each re-rendered into
//       variants 2 and 3). Models default to AGENT_EVAL_MODELS, Sonnet 5.5 first.
//       Recordings go under lib/agent/evals/recordings/matrix/<model>/v<variant>/.
//
// --dry-run prints the cell plan and the estimated tokens and list-price dollars per model
// (lib/agent/evals/matrixPlan.ts, PRICE_PER_MTOK_MICROS) and the caps the run would have,
// then exits 0. It needs no key and no database, and spends nothing.
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
// --max-usd and --max-total-usd are enforced only when OpenRouter reports each call's cost;
// if it does not, only the token caps apply and the report says so. No price table stands
// in for them.
//
// Needs Node 22.18 or later: it loads budget.ts and matrixPlan.ts directly (type
// stripping), so a bad flag is refused here before vitest or the database starts any work.
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
  "       [--max-total-tokens <n>] [--max-total-usd <n>]";

/** Each mode: its cap profile and the eval file vitest runs (vitest.eval.config.ts includes every *.eval.ts). */
const MODES = {
  golden: { profile: "golden", file: "lib/agent/evals/live.eval.ts" },
  matrix: { profile: "matrix", file: "lib/agent/evals/matrix.eval.ts" },
};

function usage(message) {
  console.error(`eval:agent: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

let budget;
let plan;
try {
  budget = await import("../lib/agent/evals/budget.ts");
  plan = await import("../lib/agent/evals/matrixPlan.ts");
} catch (error) {
  console.error(`eval:agent: could not load lib/agent/evals/budget.ts or matrixPlan.ts (${error?.message ?? error}); this script needs Node 22.18 or later`);
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
  const modeFlags = argv.filter((a) => a === "--matrix");
  const mode = modeFlags.length === 0 ? "golden" : "matrix";
  const { profile } = MODES[mode];
  const flags = profileFlags(profile);
  const out = { mode, profile, variant: null, model: null, models: null, seed: "1", dryRun: false, caps: {}, totals: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length) usage(`${flag} needs a value`);
      return argv[i];
    };
    if (flag === "--matrix" && inline === undefined) continue;
    if (flag === "--variant" && mode === "golden") out.variant = value();
    else if (flag === "--model") out.model = value();
    else if (flag === "--models" && mode !== "golden") out.models = parseModels(value());
    else if (flag === "--seed" && mode === "golden") out.seed = value();
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
const models = args.mode === "golden" ? null : plan.runModels({ models: args.models, model: args.model });

if (args.dryRun) {
  console.log(plan.formatMatrixDryRun({ models, caps: args.caps, totals: args.totals }));
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

const reportDir = mkdtempSync(path.join(os.tmpdir(), "eval-agent-"));
const reportFile = path.join(reportDir, "run.json");
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" "),
  EVAL_RUN_REPORT: reportFile,
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
