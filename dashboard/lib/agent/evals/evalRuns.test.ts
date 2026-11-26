// Eval runs (fix round 1, I3): each live run writes into its own folder named by its run
// id, readers take the latest complete run or the one named, and a file carrying another
// run's id is left out. Pure apart from a temporary folder; no model, no database.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  EVAL_PASS_BUDGET_ENV,
  EVAL_PASS_ID_ENV,
  RUN_ID_RE,
  RunSelectionError,
  assertRerenderSource,
  costIsFloor,
  describeRun,
  finishRun,
  listRuns,
  newRunId,
  passBudgetFromEnv,
  passIdFromEnv,
  recordedV1Cells,
  rerenderSourceProblem,
  runRoot,
  selectRun,
  startRun,
} from "@/lib/agent/evals/evalRuns";
import { judgeFiles, readInjectionResults, readJudgeResults, readMatrixRecordings, readMatrixRun, readRerenderSources } from "@/lib/agent/evals/evalFiles";
import { emptySnapshot, type Recording } from "@/lib/agent/evals/recording";
import type { JudgeResult } from "@/lib/agent/evals/judge";

const A = "20261126T010000Z";
const B = "20261126T020000Z";
const C = "20261126T030000Z";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "eval-runs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function recording(evalRun: string | undefined, variant: 1 | 2 | 3 = 1): Recording {
  return {
    format: 1,
    source: variant === 1 ? "live" : "rerender",
    scenario: "b_compare",
    persona: "senior-backend",
    variant,
    model: "m/a",
    seed: 1,
    toolCalls: [],
    approvals: [],
    intents: [],
    surfaces: [],
    dbBefore: emptySnapshot(),
    dbAfter: emptySnapshot(),
    usage: { costMicros: 1, inputTokens: 1, outputTokens: 1 },
    timings: { firstRenderMs: null, completeMs: 1 },
    ...(evalRun ? { evalRun } : {}),
  };
}

function judged(evalRun: string, matrixRun: string): JudgeResult {
  return {
    model: "m/a",
    scenario: "b_compare",
    persona: "senior-backend",
    seed: 1,
    variantA: 1,
    variantB: 2,
    shownFirst: "a",
    winner: "a",
    reason: "x",
    parsed: true,
    evalRun,
    matrixRun,
  };
}

describe("run ids and folders", () => {
  test("a run id is the UTC start time to the second", () => {
    expect(newRunId(new Date("2026-11-26T01:02:03.456Z"))).toBe("20261126T010203Z");
    expect(newRunId()).toMatch(RUN_ID_RE);
    expect(runRoot("judge", "/r")).toBe(path.join("/r", "judge"));
  });

  test("startRun makes a new folder with run.json, refuses one that exists, and finishRun records the end", () => {
    const root = runRoot("matrix", dir);
    const runDir = startRun(root, { runId: A, mode: "matrix", models: ["m/a"], matrixRun: null, startedAt: "2026-11-26T01:00:00.000Z" });
    expect(JSON.parse(readFileSync(path.join(runDir, "run.json"), "utf8"))).toMatchObject({ runId: A, status: "running", finishedAt: null });
    expect(() => startRun(root, { runId: A, mode: "matrix", models: [], matrixRun: null })).toThrow(RunSelectionError);
    expect(() => startRun(root, { runId: "latest", mode: "matrix", models: [], matrixRun: null })).toThrow(/not a run id/);
    finishRun(runDir, "cap_exceeded", new Date("2026-11-26T01:30:00Z"));
    expect(listRuns(root)).toEqual([
      {
        runId: A,
        mode: "matrix",
        status: "cap_exceeded",
        startedAt: "2026-11-26T01:00:00.000Z",
        finishedAt: "2026-11-26T01:30:00.000Z",
        models: ["m/a"],
        matrixRun: null,
        kind: "full",
        passId: null,
        sourceRun: null,
        costUsd: null,
        passBudgetUsd: null,
        costFloor: false,
      },
    ]);
  });

  test("PR J7: a run records its pass id and kind when it starts and its reported cost when it ends", () => {
    const root = runRoot("matrix", dir);
    const runDir = startRun(root, { runId: B, mode: "matrix", models: ["m/a"], matrixRun: null, passId: A });
    finishRun(runDir, "complete", new Date("2026-11-26T02:30:00Z"), 1.25);
    expect(listRuns(root)[0]).toMatchObject({ runId: B, kind: "full", passId: A, sourceRun: null, costUsd: 1.25 });
    // A cost that is not a finite, non-negative number is recorded as unknown, never as zero.
    finishRun(runDir, "complete", new Date(), Number.NaN);
    expect(listRuns(root)[0].costUsd).toBeNull();
    expect(() => startRun(root, { runId: C, mode: "matrix", models: [], matrixRun: null, passId: "pass-1" })).toThrow(/not a run id/);
  });

  test("PR J7: a run.json from before J7 reads as full; one with a bad kind, pass id or cost does not read", () => {
    const root = runRoot("matrix", dir);
    const old = { runId: A, mode: "matrix", status: "complete", startedAt: "x", finishedAt: "y", models: [], matrixRun: null };
    const write = (id: string, extra: Record<string, unknown>) => {
      mkdirSync(path.join(root, id), { recursive: true });
      writeFileSync(path.join(root, id, "run.json"), JSON.stringify({ ...old, runId: id, ...extra }));
    };
    write(A, {});
    write(B, { kind: "everything" });
    write(C, { passId: "../x" });
    write("20261126T040000Z", { costUsd: -1 });
    // A rerender-only run names its source, and no other kind does.
    write("20261126T050000Z", { kind: "rerender-only", sourceRun: null });
    write("20261126T060000Z", { kind: "full", sourceRun: A });
    expect(listRuns(root).map((r) => [r.runId, r.kind, r.passId, r.costUsd])).toEqual([[A, "full", null, null]]);
  });

  test("PR J7: the spot check is never the latest complete matrix run, but reads by name", () => {
    const root = runRoot("matrix", dir);
    finishRun(startRun(root, { runId: A, mode: "matrix", models: [], matrixRun: null }), "complete");
    finishRun(startRun(root, { runId: B, mode: "matrix", models: [], matrixRun: null, kind: "spot-check" }), "complete");
    expect(selectRun(root, null)?.runId).toBe(A);
    expect(describeRun(selectRun(root, B))).toBe(`${B} (spot check)`);
  });

  test("fix round 1: a run records its pass's budget when it starts and whether its cost is a floor when it ends", () => {
    const root = runRoot("matrix", dir);
    const runDir = startRun(root, { runId: B, mode: "matrix", models: ["m/a"], matrixRun: null, passId: A, passBudgetUsd: 2 });
    finishRun(runDir, "cap_exceeded", new Date("2026-11-26T02:30:00Z"), 0.5, costIsFloor("cost_unknown"));
    expect(listRuns(root)[0]).toMatchObject({ runId: B, passBudgetUsd: 2, costUsd: 0.5, costFloor: true });
    finishRun(runDir, "complete", new Date(), 0.5);
    expect(listRuns(root)[0].costFloor).toBe(false);
    expect(() => startRun(root, { runId: C, mode: "matrix", models: [], matrixRun: null, passBudgetUsd: 0 })).toThrow(/positive number of dollars/);
    // A run.json from before fix round 1 reads with no budget and an exact cost; a bad value does not read.
    const old = { mode: "matrix", status: "complete", startedAt: "x", finishedAt: "y", models: [], matrixRun: null };
    const write = (id: string, extra: Record<string, unknown>) => {
      mkdirSync(path.join(root, id), { recursive: true });
      writeFileSync(path.join(root, id, "run.json"), JSON.stringify({ ...old, runId: id, ...extra }));
    };
    write("20261126T040000Z", {});
    write("20261126T050000Z", { passBudgetUsd: "3" });
    write("20261126T060000Z", { costFloor: "yes" });
    const old4 = listRuns(root).find((r) => r.runId === "20261126T040000Z");
    expect(old4).toMatchObject({ passBudgetUsd: null, costFloor: false });
    expect(listRuns(root).map((r) => r.runId)).not.toContain("20261126T050000Z");
    expect(listRuns(root).map((r) => r.runId)).not.toContain("20261126T060000Z");
  });

  test("fix round 1: the pass budget comes from EVAL_PASS_BUDGET_USD; only an unread cost or usage makes a floor", () => {
    expect(passBudgetFromEnv({})).toBeNull();
    expect(passBudgetFromEnv({ [EVAL_PASS_BUDGET_ENV]: "" })).toBeNull();
    expect(passBudgetFromEnv({ [EVAL_PASS_BUDGET_ENV]: "3" })).toBe(3);
    expect(passBudgetFromEnv({ [EVAL_PASS_BUDGET_ENV]: "2.5" })).toBe(2.5);
    for (const bad of ["0", "-1", "1e3", "2.505", "three"]) {
      expect(() => passBudgetFromEnv({ [EVAL_PASS_BUDGET_ENV]: bad })).toThrow(RunSelectionError);
    }
    expect(costIsFloor("cost_unknown")).toBe(true);
    expect(costIsFloor("usage_unknown")).toBe(true);
    for (const cap of ["usd", "steps", null, undefined]) expect(costIsFloor(cap)).toBe(false);
  });

  test("PR J7: the pass id comes from EVAL_PASS_ID and must be a run id", () => {
    expect(passIdFromEnv({})).toBeNull();
    expect(passIdFromEnv({ [EVAL_PASS_ID_ENV]: "" })).toBeNull();
    expect(passIdFromEnv({ [EVAL_PASS_ID_ENV]: A })).toBe(A);
    expect(() => passIdFromEnv({ [EVAL_PASS_ID_ENV]: "latest" })).toThrow(RunSelectionError);
  });

  test("selectRun takes the latest complete run by default, any named run, and refuses a bad or missing name", () => {
    const root = runRoot("matrix", dir);
    expect(selectRun(root, null)).toBeNull();
    finishRun(startRun(root, { runId: A, mode: "matrix", models: [], matrixRun: null }), "complete");
    finishRun(startRun(root, { runId: B, mode: "matrix", models: [], matrixRun: null }), "complete");
    finishRun(startRun(root, { runId: C, mode: "matrix", models: [], matrixRun: null }), "failed");
    // Junk beside the runs is ignored.
    mkdirSync(path.join(root, "notes"));
    mkdirSync(path.join(root, "20261126T040000Z"));
    writeFileSync(path.join(root, "20261126T040000Z", "run.json"), "{not json");
    expect(listRuns(root).map((r) => r.runId)).toEqual([A, B, C]);
    expect(selectRun(root, null)?.runId).toBe(B);
    expect(selectRun(root, undefined, (r) => r.runId === A)?.runId).toBe(A);
    expect(selectRun(root, C)?.status).toBe("failed");
    expect(describeRun(selectRun(root, C))).toBe(`${C} (failed)`);
    expect(describeRun(selectRun(root, B))).toBe(B);
    expect(describeRun(null)).toBe("none");
    expect(() => selectRun(root, "20261126T050000Z")).toThrow(/no run 20261126T050000Z/);
    expect(() => selectRun(root, "../x")).toThrow(/not a run id/);
  });
});

describe("reading one run", () => {
  test("matrix recordings: run.json is skipped and a recording from another run, or with none, is left out", () => {
    const runDir = path.join(dir, A);
    mkdirSync(path.join(runDir, "m-a", "v1"), { recursive: true });
    writeFileSync(path.join(runDir, "run.json"), JSON.stringify({ runId: A }));
    writeFileSync(path.join(runDir, "m-a", "v1", "ok.json"), JSON.stringify(recording(A)));
    writeFileSync(path.join(runDir, "m-a", "v1", "other.json"), JSON.stringify(recording(B)));
    writeFileSync(path.join(runDir, "m-a", "v1", "none.json"), JSON.stringify(recording(undefined)));
    const read = readMatrixRecordings(runDir, A);
    expect(read.items.map((r) => r.evalRun)).toEqual([A]);
    expect(read.unreadable).toEqual(["m-a/v1/none.json", "m-a/v1/other.json"]);
  });

  test("injection results: only this run's", () => {
    const runDir = path.join(dir, A);
    mkdirSync(path.join(runDir, "m-a", "v1"), { recursive: true });
    const base = { caseId: "c", variant: 1, model: "m/a", recording: null, texts: [], contacts: [], replay: null, html: null };
    writeFileSync(path.join(runDir, "m-a", "v1", "c.json"), JSON.stringify({ ...base, evalRun: A }));
    writeFileSync(path.join(runDir, "m-a", "v1", "d.json"), JSON.stringify({ ...base, caseId: "d", evalRun: B }));
    const read = readInjectionResults(runDir, A);
    expect(read.items.map((r) => r.caseId)).toEqual(["c"]);
    expect(read.unreadable).toEqual(["m-a/v1/d.json"]);
  });

  test("PR J7: a rerender-only run reads its own variants 2 and 3 with its source run's variant 1; strays are counted", () => {
    const root = runRoot("matrix", dir);
    const put = (run: string, rel: string, r: Recording) => {
      mkdirSync(path.dirname(path.join(root, run, rel)), { recursive: true });
      writeFileSync(path.join(root, run, rel), JSON.stringify(r));
    };
    finishRun(startRun(root, { runId: A, mode: "matrix", models: ["m/a"], matrixRun: null }), "complete");
    put(A, "m-a/v1/b.json", recording(A, 1));
    put(A, "m-a/v2/b.json", recording(A, 2));
    writeFileSync(path.join(root, A, "m-a", "v1", "bad.json"), "{");
    finishRun(startRun(root, { runId: B, mode: "matrix", models: ["m/a"], matrixRun: null, kind: "rerender-only", sourceRun: A }), "complete");
    put(B, "m-a/v2/b.json", recording(B, 2));
    put(B, "m-a/v3/b.json", recording(B, 3));
    put(B, "m-a/v1/stray.json", recording(B, 1));
    const run = selectRun(root, null)!;
    expect(run).toMatchObject({ runId: B, kind: "rerender-only", sourceRun: A });
    expect(describeRun(run)).toBe(`${B} (re-render of ${A})`);
    const read = readMatrixRun(root, run);
    // The source's variant 2 is its own re-render, not this run's, and is not read.
    expect(read.items.map((r) => [r.evalRun, r.variant])).toEqual([
      [A, 1],
      [B, 2],
      [B, 3],
    ]);
    expect(read.unreadable).toEqual([`../${A}/m-a/v1/bad.json`, "m-a/v1/stray.json"]);
    expect(readRerenderSources(root, A).items.map((r) => r.variant)).toEqual([1]);
    // A full run reads as before.
    expect(readMatrixRun(root, selectRun(root, A)!).items.map((r) => r.variant)).toEqual([1, 2]);
  });

  test("PR J7: only a complete full matrix run can be re-rendered, and its variant 1 cells read without the schema", () => {
    const root = runRoot("matrix", dir);
    finishRun(startRun(root, { runId: A, mode: "matrix", models: ["m/a"], matrixRun: null }), "complete");
    finishRun(startRun(root, { runId: B, mode: "matrix", models: ["m/a"], matrixRun: null, kind: "spot-check" }), "complete");
    finishRun(startRun(root, { runId: C, mode: "matrix", models: ["m/a"], matrixRun: null }), "cap_exceeded");
    expect(rerenderSourceProblem(selectRun(root, A))).toBeNull();
    expect(assertRerenderSource(selectRun(root, A)).runId).toBe(A);
    expect(rerenderSourceProblem(selectRun(root, B))).toMatch(/spot-check run; only a full matrix run/);
    expect(rerenderSourceProblem(selectRun(root, C))).toMatch(/ended cap_exceeded; only a complete matrix run/);
    expect(rerenderSourceProblem(null)).toMatch(/no matrix run/);
    expect(() => assertRerenderSource(selectRun(root, C))).toThrow(RunSelectionError);
    const judgeRoot = runRoot("judge", dir);
    finishRun(startRun(judgeRoot, { runId: A, mode: "judge", models: [], matrixRun: A }), "complete");
    expect(rerenderSourceProblem(selectRun(judgeRoot, A))).toMatch(/not a matrix run/);

    const v1 = path.join(root, A, "m-a", "v1");
    mkdirSync(v1, { recursive: true });
    mkdirSync(path.join(root, A, "m-a", "v2"), { recursive: true });
    const withSurfaces = { ...recording(A, 1), surfaces: [{}, {}] };
    writeFileSync(path.join(v1, "b_compare.senior-backend.r1.json"), JSON.stringify(withSurfaces));
    writeFileSync(path.join(v1, "other.json"), JSON.stringify({ ...withSurfaces, evalRun: B }));
    writeFileSync(path.join(v1, "v2.json"), JSON.stringify({ ...withSurfaces, variant: 2 }));
    writeFileSync(path.join(v1, "junk.json"), "nope");
    writeFileSync(path.join(root, A, "m-a", "v2", "ignored.json"), JSON.stringify({ ...withSurfaces, variant: 2 }));
    expect(recordedV1Cells(path.join(root, A), A)).toEqual({
      cells: [{ file: "m-a/v1/b_compare.senior-backend.r1.json", model: "m/a", scenario: "b_compare", persona: "senior-backend", seed: 1, surfaces: 2 }],
      unreadable: ["m-a/v1/junk.json", "m-a/v1/other.json", "m-a/v1/v2.json"],
    });
    expect(recordedV1Cells(path.join(root, "20261126T090000Z"), "20261126T090000Z")).toEqual({ cells: [], unreadable: [] });
  });

  test("judge results: none when the run wrote none; a result from another run or matrix run makes the file unreadable", () => {
    const runDir = path.join(dir, B);
    mkdirSync(runDir);
    expect(readJudgeResults(runDir, B)).toEqual({ items: [], unreadable: [] });
    writeFileSync(judgeFiles(runDir).results, JSON.stringify([judged(B, A)]));
    expect(readJudgeResults(runDir, B, A).items).toHaveLength(1);
    expect(readJudgeResults(runDir, B, C).unreadable).toEqual(["results.json"]);
    expect(readJudgeResults(runDir, C).unreadable).toEqual(["results.json"]);
    expect(judgeFiles(runDir).handCheck).toBe(path.join(runDir, "hand-check.csv"));
  });
});
