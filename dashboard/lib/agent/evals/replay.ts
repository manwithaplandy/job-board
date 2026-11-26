// The surfaces the render smoke replays (plan Task 2.11): a closed list built from files in
// this folder, shared by the replay page (app/ui-gallery/surface-replay) and the spec
// (tests/sandbox/render-smoke.spec.ts), so the page renders nothing that is not on it.
//
//   v1/<file>#<i>          surface i of a committed golden recording (recordings/v1/)
//   matrix/<run>/<path>#<i>     surface i of a matrix recording (recordings/matrix/<run>/, Task 2.10)
//   injection/<run>/<path>#<i>  surface i of an injection result (recordings/injection/<run>/, Task 2.12)
//   fixture/<file>         a hand-written variant 2 or 3 surface (fixtures/surfaces/), laid
//                          over a surface of a v1 recording: its gathered data, and its
//                          variant 1 payload as the stored fallback
//
// Recorded surfaces from live or re-rendered runs are data: their render failures are
// counted, not asserted. The hand-written ones (the *.handwritten.json golden recordings
// and the fixtures) exercise each renderer now and must pass.
//
// One matrix run and one injection run are on the list (evalRuns.ts): the latest complete
// one of each, or the run named by EVAL_MATRIX_RUN / EVAL_INJECTION_RUN in the environment
// (the render smoke's webServer passes its own environment through). The list is built
// once per process and those two variables.
//
// Pure apart from reading files under lib/agent/evals; no database, no model. A name is
// looked up in the list, never joined into a path.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { StoredSurface } from "@/lib/agent/surfaces/store";
import { RUN_FILE, runRoot, selectRun } from "./evalRuns";

/** The folder the lists are read from (the server and the spec both run with dashboard/ as cwd). */
export const EVALS_DIR = path.join(process.cwd(), "lib", "agent", "evals");

/** The replay page renders only when the server has this set to "1"; never in production. */
export const REPLAY_ENABLE_ENV = "SURFACE_REPLAY";
/** The matrix and injection runs to replay; unset means the latest complete run of each. */
export const REPLAY_MATRIX_RUN_ENV = "EVAL_MATRIX_RUN";
export const REPLAY_INJECTION_RUN_ENV = "EVAL_INJECTION_RUN";

export type ReplaySource = "v1" | "matrix" | "injection" | "fixture";

export interface ReplayEntry {
  name: string;
  source: ReplaySource;
  variant: 1 | 2 | 3;
  /** Hand-written surfaces must render cleanly; recorded ones are data. */
  handwritten: boolean;
  /** The eval run a matrix or injection surface came from; null for v1 and fixtures. */
  evalRun: string | null;
}

const SurfaceSchema = z
  .object({
    id: z.string(),
    threadId: z.string(),
    runId: z.string().nullable(),
    variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    payload: z.record(z.string(), z.unknown()),
    fallbackPayload: z.record(z.string(), z.unknown()).nullable(),
    gathered: z.record(z.string(), z.unknown()),
    outcome: z.enum(["valid", "repaired", "fallback"]),
    failure: z.string().nullable(),
    supersedes: z.string().nullable(),
    rerenderOf: z.string().nullable(),
    model: z.string().nullable(),
    latencyMs: z.number().nullable(),
    createdAt: z.string(),
  })
  .passthrough();
const SurfacesSchema = z.object({ surfaces: z.array(SurfaceSchema) }).passthrough();
const InjectionFileSchema = z.object({ recording: SurfacesSchema.nullable() }).passthrough();

/** A hand-written surface: a variant 2 or 3 payload over surface `surface` of the v1 recording `base`. */
export const ReplayFixtureSchema = z
  .object({
    base: z.string().regex(/^[a-z0-9_]+\.[a-z0-9-]+\.[a-z0-9.-]+\.json$/),
    surface: z.number().int().min(0).max(20),
    payload: z.union([
      z.object({ variant: z.literal(2) }).passthrough(),
      z.object({ variant: z.literal(3) }).passthrough(),
    ]),
  })
  .strict();
export type ReplayFixture = z.infer<typeof ReplayFixtureSchema>;

const NAME_RE = /^(?:v1|matrix|injection|fixture)\/[A-Za-z0-9._/-]{1,200}(?:#\d{1,2})?$/;

function jsonFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
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
    return null;
  }
}

function recordedSurfaces(source: "v1" | "matrix" | "injection", rel: string): StoredSurface[] {
  const raw = readJson(path.join(EVALS_DIR, "recordings", source, rel));
  if (source === "injection") {
    const parsed = InjectionFileSchema.safeParse(raw);
    return parsed.success && parsed.data.recording ? (parsed.data.recording.surfaces as StoredSurface[]) : [];
  }
  const parsed = SurfacesSchema.safeParse(raw);
  return parsed.success ? (parsed.data.surfaces as StoredSurface[]) : [];
}

function fixtureSurface(rel: string): StoredSurface | null {
  const fixture = ReplayFixtureSchema.safeParse(readJson(path.join(EVALS_DIR, "fixtures", "surfaces", rel)));
  if (!fixture.success) return null;
  const base = recordedSurfaces("v1", fixture.data.base)[fixture.data.surface];
  if (!base) return null;
  const id = `fixture-${rel.replace(/\.json$/, "")}`;
  return {
    ...base,
    id,
    variant: fixture.data.payload.variant,
    payload: fixture.data.payload,
    fallbackPayload: base.payload,
    outcome: "valid",
    failure: null,
    supersedes: null,
    rerenderOf: base.id,
    model: null,
    latencyMs: null,
  };
}

type ListedSurface = ReplayEntry & { surface: StoredSurface };
let cached: { key: string; list: ListedSurface[] } | null = null;

/** The runs on the list: the named ones, else the latest complete ones (null when none). */
export function replayRuns(env: Readonly<Record<string, string | undefined>> = process.env): { matrix: string | null; injection: string | null } {
  const recordings = path.join(EVALS_DIR, "recordings");
  return {
    matrix: selectRun(runRoot("matrix", recordings), env[REPLAY_MATRIX_RUN_ENV] || null)?.runId ?? null,
    injection: selectRun(runRoot("injection", recordings), env[REPLAY_INJECTION_RUN_ENV] || null)?.runId ?? null,
  };
}

function buildList(runs: { matrix: string | null; injection: string | null }): ListedSurface[] {
  const out: ListedSurface[] = [];
  for (const rel of jsonFiles(path.join(EVALS_DIR, "recordings", "v1"))) {
    recordedSurfaces("v1", rel).forEach((surface, i) => {
      out.push({ name: `v1/${rel}#${i}`, source: "v1", variant: surface.variant, handwritten: rel.endsWith(".handwritten.json"), evalRun: null, surface });
    });
  }
  for (const source of ["matrix", "injection"] as const) {
    const run = runs[source];
    if (!run) continue;
    for (const file of jsonFiles(path.join(EVALS_DIR, "recordings", source, run))) {
      const rel = `${run}/${file}`;
      recordedSurfaces(source, rel).forEach((surface, i) => {
        out.push({ name: `${source}/${rel}#${i}`, source, variant: surface.variant, handwritten: false, evalRun: run, surface });
      });
    }
  }
  for (const rel of jsonFiles(path.join(EVALS_DIR, "fixtures", "surfaces"))) {
    const surface = fixtureSurface(rel);
    if (surface) out.push({ name: `fixture/${rel}`, source: "fixture", variant: surface.variant, handwritten: true, evalRun: null, surface });
  }
  return out;
}

/** Every surface the page may render, in a stable order (built once per process and run choice). */
export function listReplaySurfaces(): ListedSurface[] {
  const runs = replayRuns();
  const key = JSON.stringify(runs);
  if (cached?.key !== key) cached = { key, list: buildList(runs) };
  return cached.list;
}

/** The surface named `name`, only if it is on the list. */
export function loadReplaySurface(name: unknown): (ReplayEntry & { surface: StoredSurface }) | null {
  if (typeof name !== "string" || !NAME_RE.test(name) || name.includes("..")) return null;
  return listReplaySurfaces().find((e) => e.name === name) ?? null;
}
