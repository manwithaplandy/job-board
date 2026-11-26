// The judge, live (plan Task 2.13): AGENT_JUDGE_MODEL (openai/gpt-5.5) compares pairs of
// matrix recordings, the same model, scenario, persona and repeat in two variants. NEVER
// part of `npm test` or the db lane: only `npm run eval:agent -- --judge`
// (scripts/eval-agent.mjs) runs it, inside tools/lifecycle_test_db.py with the OpenRouter
// key forwarded (gate A17), like the other live modes. It opens no database. It spends
// money: one model call per pair.
//
// Inputs: one matrix run (evalRuns.ts): the run eval-agent.mjs was given with --run
// (EVAL_MATRIX_RUN), else the latest complete one under recordings/matrix/. For every
// variant 3 surface, its rendered words from the render smoke over that same run
// (test-results/render-smoke/results/, from `npm run test:render-smoke` or CI's
// render-smoke artifact; results from any other run are ignored). A pair with a variant 3
// surface that has no rendered words is skipped and counted, not judged as an empty page.
//
// Spend caps (budget.ts, judge profile): one RunBudget, one call per pair (--max-steps 1),
// --max-pairs pairs at most, taken repeat by repeat (judgeQueue). The first cap to trip
// stops the run: the pair in progress records nothing, and the report says cap_exceeded.
//
// Output: a new folder per judge run, recordings/judge/<run id>/, with run.json (naming
// the matrix run it judged), results.json (every judged pair, each with both run ids) and
// hand-check.csv (ceil(10%) of them, with empty columns for Andrew's own call). Neither
// file is written when no pair was judged, and neither ever replaces an existing file.
// The judge informs and never decides.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { agentModel } from "@/lib/agent/provider";
import { budgetedModel } from "@/lib/agent/evals/budgetMiddleware";
import { assertEvalMode, capsFromEnv, profileBudget } from "@/lib/agent/evals/budget";
import { AGENT_JUDGE_MODEL } from "@/lib/agent/evals/judgeModel";
import { awaitsRender, handCheckCsv, judgePair, judgePairs, judgeQueue, judgeTable, sampleForHandCheck, type JudgeResult, type RenderedText } from "@/lib/agent/evals/judge";
import { matrixRecordingPath } from "@/lib/agent/evals/matrix";
import { judgeFiles, readMatrixRecordings } from "@/lib/agent/evals/evalFiles";
import { describeRun, finishRun, newRunId, runRoot, selectRun, startRun } from "@/lib/agent/evals/evalRuns";
import { readRenderResults, renderedTextIndex } from "@/lib/agent/evals/renderResults";

// Only eval-agent.mjs starts this file (it sets EVAL_MODE): refuse anything else first.
assertEvalMode(process.env, "judge");

// A cap above its ceiling throws CapUsageError here, before any model work.
const caps = capsFromEnv(process.env, "judge");
// The judge profile: a call that reports no cost trips cost_unknown.
const budget = profileBudget("judge", caps);
const results: JudgeResult[] = [];
const notes: string[] = [];

// The matrix run to judge. A --run that names no run throws here.
const matrixRun = selectRun(runRoot("matrix"), process.env.EVAL_MATRIX_RUN || null);
const evalRun = process.env.EVAL_RUN_ID || newRunId();
let runDir: string | null = null;
let ranToEnd = false;

const texts = matrixRun ? renderedTextIndex(readRenderResults(), matrixRun.runId) : new Map<string, string>();
const rendered: RenderedText = (r, i) => (matrixRun ? (texts.get(`matrix/${matrixRun.runId}/${matrixRecordingPath(r)}#${i}`) ?? null) : null);

function writeRunReport(text: string): void {
  const file = process.env.EVAL_RUN_REPORT;
  if (!file) {
    console.log(text);
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const t = budget.tripped;
  writeFileSync(file, `${JSON.stringify({ status: t ? "cap_exceeded" : "complete", cap: t?.cap ?? null, usd: budget.usdEnforcement, text })}\n`);
}

beforeAll(() => {
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.AGENT_OPENROUTER_API_KEY?.trim()) {
    throw new Error("eval: OPENROUTER_API_KEY is not set (tools/lifecycle_test_db.py --allow-env OPENROUTER_API_KEY)");
  }
  if (!matrixRun) throw new Error("eval: no complete matrix run to judge; run `npm run eval:agent -- --matrix` first, or name one with --run");
  runDir = startRun(runRoot("judge"), { runId: evalRun, mode: "judge", models: [AGENT_JUDGE_MODEL], matrixRun: matrixRun.runId });
});

afterAll(() => {
  budget.dispose();
  const files = runDir ? judgeFiles(runDir) : null;
  // Never an empty results set, and never over an existing file (wx): each judge run has its own folder.
  if (files && results.length > 0) {
    writeFileSync(files.results, `${JSON.stringify(results, null, 2)}\n`, { flag: "wx" });
    writeFileSync(files.handCheck, handCheckCsv(sampleForHandCheck(results)), { flag: "wx" });
  }
  if (runDir) finishRun(runDir, budget.tripped ? "cap_exceeded" : ranToEnd ? "complete" : "failed");
  writeRunReport(
    [
      `Judge ${AGENT_JUDGE_MODEL}: ${results.length} pairs judged`,
      `Judge run ${evalRun} over matrix run ${describeRun(matrixRun)}`,
      ...notes,
      "",
      judgeTable(results),
      "",
      files && results.length > 0
        ? `Results: ${path.relative(process.cwd(), files.results)}; hand-check sample: ${path.relative(process.cwd(), files.handCheck)}`
        : "No pair was judged: no results file was written.",
      "",
      budget.report(),
    ].join("\n"),
  );
});

describe("judge", () => {
  test(
    `up to ${caps.maxCases} pairs`,
    async () => {
      const run = matrixRun!;
      const read = readMatrixRecordings(path.join(runRoot("matrix"), run.runId), run.runId);
      if (read.unreadable.length > 0) notes.push(`${read.unreadable.length} matrix file(s) did not parse or carry another run's id, and were left out`);
      const all = judgePairs(read.items);
      if (all.length === 0) throw new Error(`eval: matrix run ${run.runId} has no pairs to judge`);
      const ready = all.filter((p) => !awaitsRender(p.a, rendered) && !awaitsRender(p.b, rendered));
      if (ready.length < all.length) {
        notes.push(
          `${all.length - ready.length} pair(s) skipped: a variant 3 surface has no rendered words from run ${run.runId} (run \`EVAL_MATRIX_RUN=${run.runId} npm run test:render-smoke\` first)`,
        );
      }
      const model = budgetedModel(agentModel(AGENT_JUDGE_MODEL), budget);
      budget.armClock();
      for (const p of judgeQueue(ready).slice(0, caps.maxCases)) {
        budget.startCase();
        budget.startTurn();
        const v = await judgePair(p.a, p.b, { model, rendered });
        budget.endTurn();
        results.push({
          model: p.model,
          scenario: p.scenario,
          persona: p.persona,
          seed: p.seed,
          variantA: p.a.variant,
          variantB: p.b.variant,
          shownFirst: v.shownFirst,
          winner: v.winner,
          reason: v.reason,
          parsed: v.parsed,
          evalRun,
          matrixRun: run.runId,
        });
      }
      expect(budget.tripped).toBeNull();
      ranToEnd = true;
    },
    (caps.maxMinutes + 5) * 60_000,
  );
});
