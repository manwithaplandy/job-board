// The judge, live (plan Task 2.13): AGENT_JUDGE_MODEL (openai/gpt-5.5) compares pairs of
// matrix recordings, the same model, scenario, persona and repeat in two variants. NEVER
// part of `npm test` or the db lane: only `npm run eval:agent -- --judge`
// (scripts/eval-agent.mjs) runs it, inside tools/lifecycle_test_db.py with the OpenRouter
// key forwarded (gate A17), like the other live modes. It opens no database. It spends
// money: one model call per pair.
//
// Inputs: the matrix recordings under recordings/matrix/ (matrix.eval.ts) and, for every
// variant 3 surface, its rendered words from the render smoke
// (test-results/render-smoke/results/, from `npm run test:render-smoke` or CI's
// render-smoke artifact). A pair with a variant 3 surface that has no rendered words is
// skipped and counted, not judged as an empty page.
//
// Spend caps (budget.ts, judge profile): one RunBudget, one call per pair (--max-steps 1),
// --max-pairs pairs at most, taken repeat by repeat (judgeQueue). The first cap to trip
// stops the run: the pair in progress records nothing, and the report says cap_exceeded.
//
// Output: recordings/judge/results.json (every judged pair) and
// recordings/judge/hand-check.csv (ceil(10%) of them, with empty columns for Andrew's own
// call). The judge informs and never decides.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { agentModel } from "@/lib/agent/provider";
import { budgetedModel } from "@/lib/agent/evals/budgetMiddleware";
import { RunBudget, capsFromEnv } from "@/lib/agent/evals/budget";
import { AGENT_JUDGE_MODEL } from "@/lib/agent/evals/judgeModel";
import { awaitsRender, handCheckCsv, judgePair, judgePairs, judgeQueue, judgeTable, sampleForHandCheck, type JudgeResult, type RenderedText } from "@/lib/agent/evals/judge";
import { matrixRecordingPath } from "@/lib/agent/evals/matrix";
import { HAND_CHECK_FILE, JUDGE_DIR, JUDGE_RESULTS_FILE, readMatrixRecordings } from "@/lib/agent/evals/evalFiles";
import { readRenderResults, renderedTextIndex } from "@/lib/agent/evals/renderResults";

// A cap above its ceiling throws CapUsageError here, before any model work.
const caps = capsFromEnv(process.env, "judge");
const budget = new RunBudget(caps);
const results: JudgeResult[] = [];
const notes: string[] = [];

const texts = renderedTextIndex(readRenderResults());
const rendered: RenderedText = (r, i) => texts.get(`matrix/${matrixRecordingPath(r)}#${i}`) ?? null;

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
});

afterAll(() => {
  budget.dispose();
  mkdirSync(JUDGE_DIR, { recursive: true });
  writeFileSync(JUDGE_RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(HAND_CHECK_FILE, handCheckCsv(sampleForHandCheck(results)));
  writeRunReport(
    [
      `Judge ${AGENT_JUDGE_MODEL}: ${results.length} pairs judged`,
      ...notes,
      "",
      judgeTable(results),
      "",
      `Results: ${path.relative(process.cwd(), JUDGE_RESULTS_FILE)}; hand-check sample: ${path.relative(process.cwd(), HAND_CHECK_FILE)}`,
      "",
      budget.report(),
    ].join("\n"),
  );
});

describe("judge", () => {
  test(
    `up to ${caps.maxCases} pairs`,
    async () => {
      const read = readMatrixRecordings();
      if (read.unreadable.length > 0) notes.push(`${read.unreadable.length} matrix file(s) did not parse and were left out`);
      const all = judgePairs(read.items);
      if (all.length === 0) throw new Error("eval: no matrix pairs to judge; run `npm run eval:agent -- --matrix` first");
      const ready = all.filter((p) => !awaitsRender(p.a, rendered) && !awaitsRender(p.b, rendered));
      if (ready.length < all.length) {
        notes.push(`${all.length - ready.length} pair(s) skipped: a variant 3 surface has no rendered words (run \`npm run test:render-smoke\` first)`);
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
        });
      }
      expect(budget.tripped).toBeNull();
    },
    (caps.maxMinutes + 5) * 60_000,
  );
});
