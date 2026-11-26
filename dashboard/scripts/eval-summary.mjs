#!/usr/bin/env node
// `npm run eval:summary [-- --run <id>] [--injection-run <id>] [--judge-run <id>]` (plan
// Task 2.13): writes the per-variant summary to
// docs/superpowers/plans/2026-11-20-variant-summary.md from one run of each live mode
// under lib/agent/evals/recordings/<mode>/<run id>/ (the latest complete one unless named;
// the judge run must be one that judged the matrix run) and the render smoke's results
// for those runs under test-results/render-smoke/results/. The summary names the runs it
// read. Missing inputs read "not run yet".
//
// Free: no model, no database, no key. It runs lib/agent/evals/summary.run.ts through
// vitest (vitest.summary.config.ts), which resolves the @/ imports the measures need.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: npm run eval:summary -- [--run <matrix run id>] [--injection-run <run id>] [--judge-run <run id>]";
const FLAGS = { "--run": "EVAL_MATRIX_RUN", "--injection-run": "EVAL_INJECTION_RUN", "--judge-run": "EVAL_JUDGE_RUN" };
const RUN_ID_RE = /^\d{8}T\d{6}Z$/;

function usage(message) {
  console.error(`eval:summary: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

// Run ids are checked here; whether the run exists is checked when it is read.
const runs = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const [flag, inline] = argv[i].includes("=") ? argv[i].split(/=(.*)/s, 2) : [argv[i], undefined];
  if (!Object.hasOwn(FLAGS, flag)) usage(`unknown argument ${argv[i]}`);
  const value = inline ?? argv[++i];
  if (value === undefined || !RUN_ID_RE.test(value)) usage(`${flag} needs a run id (YYYYMMDDTHHMMSSZ)`);
  if (Object.hasOwn(runs, FLAGS[flag])) usage(`${flag} given twice`);
  runs[FLAGS[flag]] = value;
}
const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" ") };
// Only what this command was given reaches the reader: a stray variable in the shell does not pick the run.
for (const name of Object.values(FLAGS)) delete env[name];
const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
const result = spawnSync(vitest, ["run", "--config", "vitest.summary.config.ts", "lib/agent/evals/summary.run.ts"], {
  cwd: DASHBOARD_DIR,
  env: { ...env, ...runs },
  stdio: "inherit",
});
if (result.error) {
  console.error(`eval:summary: could not start vitest (${result.error.message})`);
  process.exit(1);
}
process.exit(result.status ?? 1);
