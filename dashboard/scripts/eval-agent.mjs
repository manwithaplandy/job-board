#!/usr/bin/env node
// `npm run eval:agent -- --variant 1 [--model <openrouter id>] [--seed <n>]` (plan Task 1.22).
//
// Runs the live golden scenarios (lib/agent/evals/live.eval.ts: 4 scenarios by 3
// personas) against a real model, writes their recordings under
// lib/agent/evals/recordings/v<variant>/, prints the cost and latency table and exits
// non-zero on any assert failure. It spends money on OpenRouter.
//
// Run it only inside the owned throwaway database, after gate A17 lets the key through:
//   python tools/lifecycle_test_db.py --postgres-major 17 --allow-env OPENROUTER_API_KEY -- \
//     npm --prefix dashboard run eval:agent -- --variant 1 --model anthropic/claude-sonnet-5.5
// The database guards (lib/testing/dbHarness assertHarnessDsn) refuse anything else.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

function usage(message) {
  console.error(`eval:agent: ${message}`);
  console.error("usage: npm run eval:agent -- --variant <1|2|3> [--model <openrouter model id>] [--seed <integer>]");
  process.exit(2);
}

function parseArgs(argv) {
  const out = { variant: null, model: null, seed: "1" };
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
    else usage(`unknown argument ${arg}`);
  }
  if (!["1", "2", "3"].includes(out.variant ?? "")) usage("--variant must be 1, 2 or 3");
  if (out.model !== null && !MODEL_RE.test(out.model)) usage("--model is not a model id");
  if (!/^-?\d{1,9}$/.test(out.seed)) usage("--seed must be an integer");
  return out;
}

const args = parseArgs(process.argv.slice(2));
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" "),
  EVAL_VARIANT: args.variant,
  EVAL_SEED: args.seed,
  ...(args.model ? { EVAL_MODEL: args.model } : {}),
};

const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
const result = spawnSync(vitest, ["run", "--config", "vitest.eval.config.ts"], { cwd: DASHBOARD_DIR, env, stdio: "inherit" });
if (result.error) {
  console.error(`eval:agent: could not start vitest (${result.error.message})`);
  process.exit(1);
}
process.exit(result.status ?? 1);
