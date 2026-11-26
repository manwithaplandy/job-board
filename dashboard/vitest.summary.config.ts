// `npm run eval:summary` only (scripts/eval-summary.mjs, plan Task 2.13): the base config
// with the one summary file, which reads the eval outputs on disk and writes the
// per-variant summary. No database and no model; not part of `npm test`.
import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["lib/agent/evals/summary.run.ts"],
    exclude: ["**/node_modules/**"],
  },
});
