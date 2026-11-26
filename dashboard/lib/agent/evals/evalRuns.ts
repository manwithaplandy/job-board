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

/**
 * What a matrix run holds (PR J7): full, the plan's cells (every persona and repeat);
 * spot-check, the opt-in Sonnet spot check (one persona, one repeat, every scenario and
 * variant); rerender-only, variants 2 and 3 re-rendered from the variant 1 recordings of
 * an earlier complete matrix run (sourceRun), with no variant 1 cells of its own. The
 * injection set and the judge are always full.
 */
export type EvalRunKind = "full" | "spot-check" | "rerender-only";
const KINDS: readonly EvalRunKind[] = ["full", "spot-check", "rerender-only"];

export interface EvalRun {
  runId: string;
  mode: EvalRunMode;
  status: EvalRunStatus;
  startedAt: string;
  finishedAt: string | null;
  models: string[];
  /** The judge only: the matrix run it judged. */
  matrixRun: string | null;
  /** PR J7; a run.json written before it reads as full. */
  kind: EvalRunKind;
  /** The `eval-agent.mjs --pass` this run was a stage of (the pass id), or null. */
  passId: string | null;
  /** A rerender-only matrix run: the matrix run whose variant 1 recordings it re-rendered. */
  sourceRun: string | null;
  /** The OpenRouter cost the run's calls reported, in dollars, written when it ends; null while running or when unknown. */
  costUsd: number | null;
}

/** What startRun takes: the run's identity; kind, passId and sourceRun default to full, null and null. */
export type NewEvalRun = Pick<EvalRun, "runId" | "mode" | "models" | "matrixRun"> &
  Partial<Pick<EvalRun, "kind" | "passId" | "sourceRun">> & { startedAt?: string };

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

/** The variable eval-agent.mjs --pass sets to the pass id for each of its stages (PR J7). */
export const EVAL_PASS_ID_ENV = "EVAL_PASS_ID";

/** The pass id an eval file was started with, or null; anything set that is not a run id is refused. */
export function passIdFromEnv(env: Readonly<Record<string, string | undefined>>): string | null {
  const raw = env[EVAL_PASS_ID_ENV];
  if (raw === undefined || raw === "") return null;
  if (!RUN_ID_RE.test(raw)) throw new RunSelectionError(`eval: ${EVAL_PASS_ID_ENV} ${JSON.stringify(raw)} is not a pass id (YYYYMMDDTHHMMSSZ)`);
  return raw;
}

/** The run id for a run starting at `at`. */
export function newRunId(at: Date = new Date()): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const optionalRunId = (v: unknown) => v === undefined || v === null || (typeof v === "string" && RUN_ID_RE.test(v));

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
    (r.matrixRun === null || (typeof r.matrixRun === "string" && RUN_ID_RE.test(r.matrixRun))) &&
    (r.kind === undefined || KINDS.includes(r.kind as EvalRunKind)) &&
    optionalRunId(r.passId) &&
    optionalRunId(r.sourceRun) &&
    (r.costUsd === undefined || r.costUsd === null || (typeof r.costUsd === "number" && Number.isFinite(r.costUsd) && r.costUsd >= 0));
  if (!ok) return null;
  const kind = (r.kind as EvalRunKind | undefined) ?? "full";
  const sourceRun = (r.sourceRun as string | null | undefined) ?? null;
  // A rerender-only run names its source, and only it does.
  if ((kind === "rerender-only") !== (sourceRun !== null) || (kind !== "full" && r.mode !== "matrix")) return null;
  return {
    runId: r.runId as string,
    mode: r.mode as EvalRunMode,
    status: r.status as EvalRunStatus,
    startedAt: r.startedAt as string,
    finishedAt: r.finishedAt as string | null,
    models: r.models as string[],
    matrixRun: r.matrixRun as string | null,
    kind,
    passId: (r.passId as string | null | undefined) ?? null,
    sourceRun,
    costUsd: (r.costUsd as number | null | undefined) ?? null,
  };
}

/**
 * Creates `<root>/<runId>/` and its run.json ("running"). The folder must be new: a second
 * run in the same second, or a reused id, is refused rather than mixed into the first.
 */
export function startRun(root: string, run: NewEvalRun): string {
  if (!RUN_ID_RE.test(run.runId)) throw new RunSelectionError(`eval: ${run.runId} is not a run id (expected YYYYMMDDTHHMMSSZ)`);
  for (const [name, id] of [["passId", run.passId], ["sourceRun", run.sourceRun]] as const) {
    if (id !== undefined && id !== null && !RUN_ID_RE.test(id)) throw new RunSelectionError(`eval: ${name} ${id} is not a run id`);
  }
  mkdirSync(root, { recursive: true });
  const dir = path.join(root, run.runId);
  try {
    mkdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new RunSelectionError(`eval: run folder ${run.runId} already exists; start the run again`);
    throw e;
  }
  const record: EvalRun = {
    runId: run.runId,
    mode: run.mode,
    status: "running",
    startedAt: run.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    models: run.models,
    matrixRun: run.matrixRun,
    kind: run.kind ?? "full",
    passId: run.passId ?? null,
    sourceRun: run.sourceRun ?? null,
    costUsd: null,
  };
  writeFileSync(path.join(dir, RUN_FILE), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  return dir;
}

/**
 * Marks the run in `dir` as ended with `status` and, when known, the cost its calls
 * reported (a non-finite or negative cost is recorded as null, never as zero).
 */
export function finishRun(dir: string, status: Exclude<EvalRunStatus, "running">, at: Date = new Date(), costUsd: number | null = null): void {
  const run = readRun(path.join(dir, RUN_FILE));
  if (!run) throw new RunSelectionError(`eval: ${path.join(dir, RUN_FILE)} is missing or does not parse`);
  const cost = costUsd !== null && Number.isFinite(costUsd) && costUsd >= 0 ? costUsd : null;
  writeFileSync(path.join(dir, RUN_FILE), `${JSON.stringify({ ...run, status, finishedAt: at.toISOString(), costUsd: cost }, null, 2)}\n`);
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
 * The run to read under `root`: `explicit` when given (any status and kind, so a stopped
 * run or a spot check can be read on purpose), else the latest complete one that is not a
 * spot check (PR J7: the Sonnet spot check is a side run that readers take only by name),
 * else null. An explicit id that is not a run id, or names no run, is a RunSelectionError.
 */
export function selectRun(root: string, explicit: string | null | undefined, filter: (run: EvalRun) => boolean = () => true): EvalRun | null {
  const runs = listRuns(root);
  if (explicit) {
    if (!RUN_ID_RE.test(explicit)) throw new RunSelectionError(`eval: --run ${explicit} is not a run id (expected YYYYMMDDTHHMMSSZ)`);
    const run = runs.find((r) => r.runId === explicit);
    if (!run) throw new RunSelectionError(`eval: no run ${explicit} under ${root}`);
    return run;
  }
  return [...runs].reverse().find((r) => r.status === "complete" && r.kind !== "spot-check" && filter(r)) ?? null;
}

/** How a selected run reads in a report: its id, its kind when not full, and its status when it did not complete. */
export function describeRun(run: EvalRun | null): string {
  if (!run) return "none";
  const notes = [
    ...(run.kind === "spot-check" ? ["spot check"] : []),
    ...(run.kind === "rerender-only" ? [`re-render of ${run.sourceRun}`] : []),
    ...(run.status === "complete" ? [] : [run.status]),
  ];
  return notes.length === 0 ? run.runId : `${run.runId} (${notes.join(", ")})`;
}
