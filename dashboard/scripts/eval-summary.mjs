#!/usr/bin/env node
// `npm run eval:summary` (plan Task 2.13): writes the per-variant summary to
// docs/superpowers/plans/2026-11-20-variant-summary.md from what is on disk: the matrix
// recordings, the injection results and the judge's results under
// lib/agent/evals/recordings/, and the render smoke's results under
// test-results/render-smoke/results/. Missing inputs read "not run yet".
//
// Free: no model, no database, no key. It runs lib/agent/evals/summary.run.ts through
// vitest (vitest.summary.config.ts), which resolves the @/ imports the measures need.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.length > 2) {
  console.error("eval:summary: takes no arguments");
  process.exit(2);
}
const vitest = path.join(DASHBOARD_DIR, "node_modules", ".bin", "vitest");
const result = spawnSync(vitest, ["run", "--config", "vitest.summary.config.ts", "lib/agent/evals/summary.run.ts"], {
  cwd: DASHBOARD_DIR,
  env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" ") },
  stdio: "inherit",
});
if (result.error) {
  console.error(`eval:summary: could not start vitest (${result.error.message})`);
  process.exit(1);
}
process.exit(result.status ?? 1);
