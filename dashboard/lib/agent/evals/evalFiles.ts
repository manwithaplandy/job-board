// The live runs' files read back (plan Task 2.13): the matrix recordings, the injection
// results and the judge's results, as matrix.eval.ts, injection.eval.ts and judge.eval.ts
// write them, one folder per run (evalRuns.ts). For the judge and the summary. Each reader
// reads one run: a file that does not parse, or carries another run's id, is counted, not
// used. Reads files only; no database, no model.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { InjectionResult } from "@/lib/agent/evals/injection";
import type { JudgeResult } from "@/lib/agent/evals/judge";
import { parseRecording, type Recording } from "@/lib/agent/evals/recording";
import { RUN_FILE, RUN_ID_RE, type EvalRun } from "@/lib/agent/evals/evalRuns";

/** The judge's two files inside its run folder. */
export function judgeFiles(runDir: string): { results: string; handCheck: string } {
  return { results: path.join(runDir, "results.json"), handCheck: path.join(runDir, "hand-check.csv") };
}

export interface Read<T> {
  items: T[];
  /** Files that were there but did not parse. */
  unreadable: string[];
}

function jsonFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    // The run's own record, not a result.
    if (prefix === "" && name === RUN_FILE) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsonFiles(full, `${prefix}${name}/`));
    else if (name.endsWith(".json")) out.push(`${prefix}${name}`);
  }
  return out;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Every matrix recording of the run in `runDir` (run id `runId`); with `variants`, only
 * the recordings of the variants it accepts (a file of another variant, in the folder of
 * that variant or not, is unreadable).
 */
export function readMatrixRecordings(runDir: string, runId: string, variants: (variant: 1 | 2 | 3) => boolean = () => true): Read<Recording> {
  const out: Read<Recording> = { items: [], unreadable: [] };
  for (const rel of jsonFiles(runDir)) {
    const r = parseRecording(readJson(path.join(runDir, rel)));
    if (r && r.evalRun === runId && variants(r.variant)) out.items.push(r);
    else out.unreadable.push(rel);
  }
  return out;
}

/**
 * Every recording a reader of the matrix run `run` (under the matrix root `root`) works
 * from (PR J7). A full or spot-check run: its own recordings. A rerender-only run: its own
 * variant 2 and 3 recordings, with variant 1 taken from its source run, so the judge, the
 * summary and the render smoke pair them as one matrix run. A variant 1 file in a
 * rerender-only run's own folder, or a variant 2 or 3 file read from the source, is
 * counted as unreadable, not used; the source's files are named ../<source run>/<path>.
 */
export function readMatrixRun(root: string, run: Pick<EvalRun, "runId" | "kind" | "sourceRun">): Read<Recording> {
  if (run.kind !== "rerender-only" || run.sourceRun === null) return readMatrixRecordings(path.join(root, run.runId), run.runId);
  const own = readMatrixRecordings(path.join(root, run.runId), run.runId, (variant) => variant !== 1);
  const source = readRerenderSources(root, run.sourceRun);
  return {
    items: [...source.items, ...own.items],
    unreadable: [...source.unreadable.map((f) => `../${run.sourceRun}/${f}`), ...own.unreadable],
  };
}

/**
 * The run each recording of readMatrixRun(`run`) pairs under, for the judge (judge.ts
 * judgePairs; PR J7 fix round 1). A rerender-only run's variant 1 recordings carry its
 * source run's id: they pair under the rerender-only run's id, with its variants 2 and 3,
 * so the judge builds 1-2, 1-3 and 2-3. Any other recording pairs under its own run. The
 * files on disk keep their own ids, so the readers still refuse a file from another run.
 */
export function matrixPairRunKey(run: Pick<EvalRun, "runId" | "kind" | "sourceRun">): (r: Recording) => string {
  return (r) => (run.kind === "rerender-only" && run.sourceRun !== null && r.evalRun === run.sourceRun ? run.runId : (r.evalRun ?? ""));
}

/**
 * The variant 1 recordings of the matrix run `sourceRun` (under `root`) that a
 * rerender-only run re-renders and pairs with (PR J7): only the <model>/v1/ folders.
 */
export function readRerenderSources(root: string, sourceRun: string): Read<Recording> {
  const runDir = path.join(root, sourceRun);
  const read = readMatrixRecordings(runDir, sourceRun, (variant) => variant === 1);
  return { items: read.items, unreadable: read.unreadable.filter((f) => V1_FILE_RE.test(f)) };
}

const V1_FILE_RE = /^[^/]+\/v1\//;

const VariantSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const InjectionFileSchema = z.object({
  caseId: z.string(),
  variant: VariantSchema,
  model: z.string(),
  recording: z.unknown(),
  texts: z.array(z.string()),
  contacts: z.array(z.string()),
  // asksWithoutClick (PR 6): optional, so a result written before it, or by a replay that
  // did not count asks, still reads; without it the key would be stripped on read.
  replay: z.object({ canaryHits: z.number(), loads: z.number(), asksWithoutClick: z.number().optional() }).nullable(),
  html: z.null(),
  evalRun: z.string().regex(RUN_ID_RE),
});

/** Every injection result of the run in `runDir` (the live, model-driven cases). */
export function readInjectionResults(runDir: string, runId: string): Read<InjectionResult> {
  const out: Read<InjectionResult> = { items: [], unreadable: [] };
  for (const rel of jsonFiles(runDir)) {
    const parsed = InjectionFileSchema.safeParse(readJson(path.join(runDir, rel)));
    const recording = parsed.success && parsed.data.recording !== null ? parseRecording(parsed.data.recording) : null;
    if (!parsed.success || parsed.data.evalRun !== runId || (parsed.data.recording !== null && !recording)) {
      out.unreadable.push(rel);
      continue;
    }
    out.items.push({ ...parsed.data, recording, html: null });
  }
  return out;
}

export const JudgeResultSchema = z
  .object({
    model: z.string(),
    scenario: z.string(),
    persona: z.string(),
    seed: z.number().int(),
    variantA: VariantSchema,
    variantB: VariantSchema,
    shownFirst: z.enum(["a", "b"]),
    winner: z.enum(["a", "b", "tie"]),
    reason: z.string(),
    parsed: z.boolean(),
    evalRun: z.string().regex(RUN_ID_RE),
    matrixRun: z.string().regex(RUN_ID_RE),
  })
  .strict() satisfies z.ZodType<JudgeResult>;

/**
 * The judge's results in the run folder `runDir` (run id `runId`); empty when it wrote
 * none. A result from another judge run, or for a matrix run other than `matrixRun` when
 * one is given, makes the file unreadable.
 */
export function readJudgeResults(runDir: string, runId: string, matrixRun: string | null = null): Read<JudgeResult> {
  const file = judgeFiles(runDir).results;
  if (!existsSync(file)) return { items: [], unreadable: [] };
  const parsed = z.array(JudgeResultSchema).safeParse(readJson(file));
  const ok = parsed.success && parsed.data.every((r) => r.evalRun === runId && (matrixRun === null || r.matrixRun === matrixRun));
  return ok && parsed.success ? { items: parsed.data, unreadable: [] } : { items: [], unreadable: [path.basename(file)] };
}
