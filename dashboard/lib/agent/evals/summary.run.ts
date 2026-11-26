// `npm run eval:summary` (scripts/eval-summary.mjs) runs this one file through
// vitest.summary.config.ts: it reads one matrix run, one injection run and one judge run
// (evalRuns.ts; the latest complete ones unless the script was given --run,
// --injection-run or --judge-run) and the render smoke's results for those runs, and
// writes the per-variant summary (summary.ts), run ids included, to
// docs/superpowers/plans/2026-11-20-variant-summary.md. No model, no database, no spend;
// an input that is not there reads "not run yet".
//
// Through vitest rather than plain Node: the measures import the asserts, whose imports
// use the @/ alias, which vitest resolves.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { measure } from "@/lib/agent/evals/measures";
import { judgeFiles, readInjectionResults, readJudgeResults, readMatrixRun, type Read } from "@/lib/agent/evals/evalFiles";
import { describeRun, listRuns, runRoot, selectRun } from "@/lib/agent/evals/evalRuns";
import { PASS_USD_CEILING } from "@/lib/agent/evals/budget";
import type { Recording } from "@/lib/agent/evals/recording";
import { forRuns, readRenderResults, renderCounts, v3MisstatementsByModel } from "@/lib/agent/evals/renderResults";
import { variantSummary, withReplays } from "@/lib/agent/evals/summary";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const OUT = process.env.EVAL_SUMMARY_OUT || path.join(REPO_ROOT, "docs", "superpowers", "plans", "2026-11-20-variant-summary.md");
const EMPTY = { items: [], unreadable: [] as string[] };

test("write the per-variant summary", () => {
  // One run of each (evalRuns.ts): the one eval-summary.mjs was given, else the latest complete.
  const matrixRun = selectRun(runRoot("matrix"), process.env.EVAL_MATRIX_RUN || null);
  const injectionRun = selectRun(runRoot("injection"), process.env.EVAL_INJECTION_RUN || null);
  // The judge run: the one given, else the latest complete one that judged this matrix run.
  const judgeRun = matrixRun ? selectRun(runRoot("judge"), process.env.EVAL_JUDGE_RUN || null, (r) => r.matrixRun === matrixRun.runId) : null;
  // A rerender-only run (PR J7) reads with variant 1 from its source run.
  const matrix: Read<Recording> = matrixRun ? readMatrixRun(runRoot("matrix"), matrixRun) : EMPTY;
  const injection = injectionRun ? readInjectionResults(path.join(runRoot("injection"), injectionRun.runId), injectionRun.runId) : EMPTY;
  const judgeDir = judgeRun ? path.join(runRoot("judge"), judgeRun.runId) : null;
  const judge = judgeRun && judgeDir ? readJudgeResults(judgeDir, judgeRun.runId, matrixRun?.runId ?? null) : EMPTY;
  const render = forRuns(readRenderResults(), {
    matrix: matrixRun?.runId ?? null,
    matrixSource: matrixRun?.kind === "rerender-only" ? matrixRun.sourceRun : null,
    injection: injectionRun?.runId ?? null,
  });
  const models = [...new Set(matrix.items.map((r) => r.model))];
  const handCheck = judgeDir ? judgeFiles(judgeDir).handCheck : null;
  // PR J7: a matrix run from `eval-agent.mjs --pass` brings every run of that pass and their reported cost.
  const passId = matrixRun?.passId ?? null;
  const pass = passId
    ? {
        passId,
        limitUsd: PASS_USD_CEILING,
        runs: (["matrix", "injection", "judge"] as const).flatMap((mode) =>
          listRuns(runRoot(mode))
            .filter((r) => r.passId === passId)
            .map((r) => ({ mode, runId: r.runId, status: r.status, costUsd: r.costUsd })),
        ),
      }
    : null;

  const md = variantSummary({
    generatedAt: new Date().toISOString().slice(0, 10),
    measures: matrix.items.length > 0 && matrixRun ? measure(matrix.items, v3MisstatementsByModel(render, models, matrixRun.runId)) : null,
    injection: injection.items.length > 0 ? withReplays(injection.items, render) : null,
    render: render.length > 0 ? { results: render, counts: renderCounts(render) } : null,
    judge: judge.items.length > 0 ? judge.items : null,
    handCheckFile: handCheck && existsSync(handCheck) ? path.relative(REPO_ROOT, handCheck) : null,
    runs: { matrix: describeRun(matrixRun), injection: describeRun(injectionRun), judge: describeRun(judgeRun) },
    pass,
  });
  const unreadable = [
    ...matrix.unreadable.map((f) => `recordings/matrix/${matrixRun?.runId}/${f}`),
    ...injection.unreadable.map((f) => `recordings/injection/${injectionRun?.runId}/${f}`),
    ...judge.unreadable.map((f) => `recordings/judge/${judgeRun?.runId}/${f}`),
  ];
  const note =
    unreadable.length > 0 ? `\n## Files left out\n\nThese did not parse or carry another run's id: ${unreadable.map((f) => `\`${f}\``).join(", ")}.\n` : "";

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${md}${note}`);
  console.log(
    `eval:summary: wrote ${path.relative(REPO_ROOT, OUT)} (matrix run ${describeRun(matrixRun)}, injection run ${describeRun(injectionRun)}, judge run ${describeRun(judgeRun)})`,
  );
  expect(md).toContain("Supporting information, not a gate.");
});
