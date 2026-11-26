// The live runs' files read back (plan Task 2.13): the matrix recordings, the injection
// results and the judge's results, as matrix.eval.ts, injection.eval.ts and judge.eval.ts
// write them under lib/agent/evals/recordings/. For the judge and the summary. Reads
// files only; a file that does not parse is counted, not used. No database, no model.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { InjectionResult } from "@/lib/agent/evals/injection";
import type { JudgeResult } from "@/lib/agent/evals/judge";
import { parseRecording, type Recording } from "@/lib/agent/evals/recording";

export const RECORDINGS_DIR = path.join(process.cwd(), "lib", "agent", "evals", "recordings");
export const JUDGE_DIR = path.join(RECORDINGS_DIR, "judge");
export const JUDGE_RESULTS_FILE = path.join(JUDGE_DIR, "results.json");
export const HAND_CHECK_FILE = path.join(JUDGE_DIR, "hand-check.csv");

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

/** Every matrix recording under recordings/matrix/. */
export function readMatrixRecordings(dir: string = path.join(RECORDINGS_DIR, "matrix")): Read<Recording> {
  const out: Read<Recording> = { items: [], unreadable: [] };
  for (const rel of jsonFiles(dir)) {
    const r = parseRecording(readJson(path.join(dir, rel)));
    if (r) out.items.push(r);
    else out.unreadable.push(rel);
  }
  return out;
}

const VariantSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const InjectionFileSchema = z.object({
  caseId: z.string(),
  variant: VariantSchema,
  model: z.string(),
  recording: z.unknown(),
  texts: z.array(z.string()),
  contacts: z.array(z.string()),
  replay: z.object({ canaryHits: z.number(), loads: z.number() }).nullable(),
  html: z.null(),
});

/** Every injection result under recordings/injection/ (the live, model-driven cases). */
export function readInjectionResults(dir: string = path.join(RECORDINGS_DIR, "injection")): Read<InjectionResult> {
  const out: Read<InjectionResult> = { items: [], unreadable: [] };
  for (const rel of jsonFiles(dir)) {
    const parsed = InjectionFileSchema.safeParse(readJson(path.join(dir, rel)));
    const recording = parsed.success && parsed.data.recording !== null ? parseRecording(parsed.data.recording) : null;
    if (!parsed.success || (parsed.data.recording !== null && !recording)) {
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
  })
  .strict() satisfies z.ZodType<JudgeResult>;

/** The judge's results (recordings/judge/results.json); empty when it has not run. */
export function readJudgeResults(file: string = JUDGE_RESULTS_FILE): Read<JudgeResult> {
  if (!existsSync(file)) return { items: [], unreadable: [] };
  const parsed = z.array(JudgeResultSchema).safeParse(readJson(file));
  return parsed.success ? { items: parsed.data, unreadable: [] } : { items: [], unreadable: [path.basename(file)] };
}
