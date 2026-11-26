// Eval runs (fix round 1, I3): each live run writes into its own folder named by its run
// id, readers take the latest complete run or the one named, and a file carrying another
// run's id is left out. Pure apart from a temporary folder; no model, no database.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  EVAL_PASS_ID_ENV,
  RUN_ID_RE,
  RunSelectionError,
  describeRun,
  finishRun,
  listRuns,
  newRunId,
  passIdFromEnv,
  runRoot,
  selectRun,
  startRun,
} from "@/lib/agent/evals/evalRuns";
import { judgeFiles, readInjectionResults, readJudgeResults, readMatrixRecordings } from "@/lib/agent/evals/evalFiles";
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
