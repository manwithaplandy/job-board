// Eval runs (fix round 1, I3): every live matrix, injection and judge run writes into its
// own folder, named by a run id taken from the clock when it starts, so files from two
// runs never mix and a reader always reads one run.
//
//   recordings/matrix/<run id>/run.json + <model>/v<variant>/<scenario>.<persona>.r<seed>.json
//   recordings/injection/<run id>/run.json + <model>/v<variant>/<case>.json
//   recordings/judge/<run id>/run.json + results.json + hand-check.csv
//
// run.json says what the run was and how it ended: "running" while it runs, then
// "complete", "cap_exceeded" or "failed". Readers (the judge, the render smoke, the
// summary) take the latest complete run unless they are given one with --run. Every
// recording and result also carries its run id (evalRun), and a reader leaves out a file
// whose id does not match its folder.
//
// Pure apart from the file system: node:fs and node:path only, no @/ imports, so
// scripts/eval-agent.mjs and the Playwright spec can load it directly.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** A run id: the UTC time the run started, to the second, e.g. 20261126T011500Z. */
export const RUN_ID_RE = /^\d{8}T\d{6}Z$/;
export const RUN_FILE = "run.json";

export type EvalRunMode = "matrix" | "injection" | "judge";
export type EvalRunStatus = "running" | "complete" | "cap_exceeded" | "failed";
const STATUSES: readonly EvalRunStatus[] = ["running", "complete", "cap_exceeded", "failed"];

export interface EvalRun {
  runId: string;
  mode: EvalRunMode;
  status: EvalRunStatus;
  startedAt: string;
  finishedAt: string | null;
  models: string[];
  /** The judge only: the matrix run it judged. */
  matrixRun: string | null;
}

/** recordings/ (every caller runs with dashboard/ as its working directory). */
export const EVAL_RECORDINGS_DIR = path.join(process.cwd(), "lib", "agent", "evals", "recordings");

/**
 * The folder that holds a mode's runs. The replay page imports this file, and a path built
 * from a parameter would make Next's file tracing copy the whole project into that route's
 * server output; the runs are read from the working directory at run time and never ship
 * (next.config.mjs also excludes recordings/ from the route), so tracing skips this call.
 */
export function runRoot(mode: EvalRunMode, recordingsDir: string = EVAL_RECORDINGS_DIR): string {
  return path.join(/*turbopackIgnore: true*/ recordingsDir, mode);
}

export class RunSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunSelectionError";
  }
}

/** The run id for a run starting at `at`. */
export function newRunId(at: Date = new Date()): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function readRun(file: string): EvalRun | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const ok =
    typeof r.runId === "string" &&
    RUN_ID_RE.test(r.runId) &&
    (r.mode === "matrix" || r.mode === "injection" || r.mode === "judge") &&
    STATUSES.includes(r.status as EvalRunStatus) &&
    typeof r.startedAt === "string" &&
    (r.finishedAt === null || typeof r.finishedAt === "string") &&
    Array.isArray(r.models) &&
    r.models.every((m) => typeof m === "string") &&
    (r.matrixRun === null || (typeof r.matrixRun === "string" && RUN_ID_RE.test(r.matrixRun)));
  return ok ? (r as unknown as EvalRun) : null;
}

/**
 * Creates `<root>/<runId>/` and its run.json ("running"). The folder must be new: a second
 * run in the same second, or a reused id, is refused rather than mixed into the first.
 */
export function startRun(root: string, run: Omit<EvalRun, "status" | "startedAt" | "finishedAt"> & { startedAt?: string }): string {
  if (!RUN_ID_RE.test(run.runId)) throw new RunSelectionError(`eval: ${run.runId} is not a run id (expected YYYYMMDDTHHMMSSZ)`);
  mkdirSync(root, { recursive: true });
  const dir = path.join(root, run.runId);
  try {
    mkdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new RunSelectionError(`eval: run folder ${run.runId} already exists; start the run again`);
    throw e;
  }
  const record: EvalRun = { ...run, status: "running", startedAt: run.startedAt ?? new Date().toISOString(), finishedAt: null };
  writeFileSync(path.join(dir, RUN_FILE), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  return dir;
}

/** Marks the run in `dir` as ended with `status`. */
export function finishRun(dir: string, status: Exclude<EvalRunStatus, "running">, at: Date = new Date()): void {
  const run = readRun(path.join(dir, RUN_FILE));
  if (!run) throw new RunSelectionError(`eval: ${path.join(dir, RUN_FILE)} is missing or does not parse`);
  writeFileSync(path.join(dir, RUN_FILE), `${JSON.stringify({ ...run, status, finishedAt: at.toISOString() }, null, 2)}\n`);
}

/** Every run under `root` with a readable run.json, oldest first. */
export function listRuns(root: string): EvalRun[] {
  if (!existsSync(root)) return [];
  const out: EvalRun[] = [];
  for (const name of readdirSync(root).sort()) {
    if (!RUN_ID_RE.test(name)) continue;
    const run = readRun(path.join(root, name, RUN_FILE));
    if (run && run.runId === name) out.push(run);
  }
  return out;
}

/**
 * The run to read under `root`: `explicit` when given (any status, so a stopped run can be
 * read on purpose), else the latest complete one, else null. An explicit id that is not a
 * run id, or names no run, is a RunSelectionError.
 */
export function selectRun(root: string, explicit: string | null | undefined, filter: (run: EvalRun) => boolean = () => true): EvalRun | null {
  const runs = listRuns(root);
  if (explicit) {
    if (!RUN_ID_RE.test(explicit)) throw new RunSelectionError(`eval: --run ${explicit} is not a run id (expected YYYYMMDDTHHMMSSZ)`);
    const run = runs.find((r) => r.runId === explicit);
    if (!run) throw new RunSelectionError(`eval: no run ${explicit} under ${root}`);
    return run;
  }
  return [...runs].reverse().find((r) => r.status === "complete" && filter(r)) ?? null;
}

/** How a selected run reads in a report: its id, and its status when it did not complete. */
export function describeRun(run: EvalRun | null): string {
  if (!run) return "none";
  return run.status === "complete" ? run.runId : `${run.runId} (${run.status})`;
}
