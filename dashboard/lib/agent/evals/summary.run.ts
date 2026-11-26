// `npm run eval:summary` (scripts/eval-summary.mjs) runs this one file through
// vitest.summary.config.ts: it reads what the live runs and the render smoke left on disk
// and writes the per-variant summary (summary.ts) to
// docs/superpowers/plans/2026-11-20-variant-summary.md. No model, no database, no spend;
// an input that is not there reads "not run yet".
//
// Through vitest rather than plain Node: the measures import the asserts, whose imports
// use the @/ alias, which vitest resolves.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { measure } from "@/lib/agent/evals/measures";
import { HAND_CHECK_FILE, readInjectionResults, readJudgeResults, readMatrixRecordings } from "@/lib/agent/evals/evalFiles";
import { readRenderResults, renderCounts, v3MisstatementsByModel } from "@/lib/agent/evals/renderResults";
import { variantSummary, withReplays } from "@/lib/agent/evals/summary";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const OUT = process.env.EVAL_SUMMARY_OUT || path.join(REPO_ROOT, "docs", "superpowers", "plans", "2026-11-20-variant-summary.md");

test("write the per-variant summary", () => {
  const matrix = readMatrixRecordings();
  const injection = readInjectionResults();
  const judge = readJudgeResults();
  const render = readRenderResults();
  const models = [...new Set(matrix.items.map((r) => r.model))];

  const md = variantSummary({
    generatedAt: new Date().toISOString().slice(0, 10),
    measures: matrix.items.length > 0 ? measure(matrix.items, v3MisstatementsByModel(render, models)) : null,
    injection: injection.items.length > 0 ? withReplays(injection.items, render) : null,
    render: render.length > 0 ? { results: render, counts: renderCounts(render) } : null,
    judge: judge.items.length > 0 ? judge.items : null,
    handCheckFile: existsSync(HAND_CHECK_FILE) ? path.relative(REPO_ROOT, HAND_CHECK_FILE) : null,
  });
  const unreadable = [
    ...matrix.unreadable.map((f) => `recordings/matrix/${f}`),
    ...injection.unreadable.map((f) => `recordings/injection/${f}`),
    ...judge.unreadable.map((f) => `recordings/judge/${f}`),
  ];
  const note = unreadable.length > 0 ? `\n## Files left out\n\nThese did not parse: ${unreadable.map((f) => `\`${f}\``).join(", ")}.\n` : "";

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${md}${note}`);
  console.log(`eval:summary: wrote ${path.relative(REPO_ROOT, OUT)}`);
  expect(md).toContain("Supporting information, not a gate.");
});
