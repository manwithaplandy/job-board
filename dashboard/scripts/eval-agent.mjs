#!/usr/bin/env node
// `npm run eval:agent -- --variant 1 [--model <openrouter id>] [--seed <n>] [caps]` (plan
// Task 1.22, gate A17). The only entry point of the live agent eval.
//
// Runs the live golden scenarios (lib/agent/evals/live.eval.ts: 4 scenarios by 3
// personas) against a real model, writes their recordings under
// lib/agent/evals/recordings/v<variant>/, prints the cost and latency table and the run's
// usage against its caps, and exits non-zero on any assert failure or any cap.
//
// IT SPENDS MONEY on the OpenRouter key it is given. Use a dedicated OpenRouter key with
// its own credit limit, as an outer guard beyond the caps below.
//
// Run it only inside the owned throwaway database, which forwards the key only when
// asked (gate A17):
//   python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \
//     npm --prefix dashboard run eval:agent -- --variant 1 --model anthropic/claude-sonnet-5.5
// The database guards (lib/testing/dbHarness assertHarnessDsn) refuse anything else, and
// this script refuses to start without OPENROUTER_API_KEY.
//
// Spend caps (lib/agent/evals/budget.ts). Each flag may lower its cap, never raise it
// past the ceiling (a usage error, exit 2). Any cap trips the whole run: the case in
// progress writes no recording, later cases are skipped, the run is marked cap_exceeded
// and the script exits non-zero. A model call whose usage cannot be read trips it too.
//   --max-cases <n>     scenario x persona cases played (the first n)  default 12, ceiling 12
//   --max-steps <n>     model calls in one turn of a case              default 8,  ceiling 8 (the route's limit)
//   --max-tokens <n>    input + output tokens over the whole run       default 2,000,000, ceiling 8,000,000
//   --max-usd <n>       reported cost over the whole run, in dollars   default 5,  ceiling 20
//   --max-minutes <n>   wall clock for the whole run                   default 30, ceiling 60
// --max-usd is enforced only when OpenRouter reports each call's cost; if it does not,
// only the token cap applies and the report says so. No price table stands in for it.
//
// Needs Node 22.18 or later: it loads budget.ts directly (type stripping), so a bad flag
// is refused here before vitest or the database starts any work.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const USAGE =
  "usage: npm run eval:agent -- --variant <1|2|3> [--model <openrouter model id>] [--seed <integer>]\n" +
  "       [--max-cases <n>] [--max-steps <n>] [--max-tokens <n>] [--max-usd <n>] [--max-minutes <n>]";

function usage(message) {
  console.error(`eval:agent: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

let budget;
try {
  budget = await import("../lib/agent/evals/budget.ts");
} catch (error) {
  console.error(`eval:agent: could not load lib/agent/evals/budget.ts (${error?.message ?? error}); this script needs Node 22.18 or later`);
  process.exit(2);
}
const { CAP_KEYS, CAP_SPECS, CapUsageError, capsToEnv, parseCaps } = budget;
const CAP_BY_FLAG = new Map(CAP_KEYS.map((key) => [CAP_SPECS[key].flag, key]));

function parseArgs(argv) {
  const out = { variant: null, model: null, seed: "1", caps: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length) usage(`${flag} needs a value`);
      return argv[i];
    };
    if (flag === "--variant") out.variant = value();
    else if (flag === "--model") out.model = value();
    else if (flag === "--seed") out.seed = value();
    else if (CAP_BY_FLAG.has(flag)) out.caps[CAP_BY_FLAG.get(flag)] = value();
    else usage(`unknown argument ${arg}`);
  }
  if (!["1", "2", "3"].includes(out.variant ?? "")) usage("--variant must be 1, 2 or 3");
  if (out.model !== null && !MODEL_RE.test(out.model)) usage("--model is not a model id");
  if (!/^-?\d{1,9}$/.test(out.seed)) usage("--seed must be an integer");
  try {
    out.caps = parseCaps(out.caps);
  } catch (error) {
    if (error instanceof CapUsageError) usage(error.message);
    throw error;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.error(
    "eval:agent: OPENROUTER_API_KEY is not set. Run this inside the throwaway database with the key forwarded:\n" +
      "  python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \\\n" +
      "    npm --prefix dashboard run eval:agent -- --variant 1",
  );
  process.exit(2);
}

const reportDir = mkdtempSync(path.join(os.tmpdir(), "eval-agent-"));
const reportFile = path.join(reportDir, "run.json");
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" "),
  EVAL_VARIANT: args.variant,
  EVAL_SEED: args.seed,
  EVAL_RUN_REPORT: reportFile,
  ...capsToEnv(args.caps),
  ...(args.model ? { EVAL_MODEL: args.model } : {}),
};

const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
const result = spawnSync(vitest, ["run", "--config", "vitest.eval.config.ts"], { cwd: DASHBOARD_DIR, env, stdio: "inherit" });
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
