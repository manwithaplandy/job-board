// The surface store (plan Task 1.2, migration 19): every UI the agent rendered, with the
// data it was rendered from and how it ended. The only writers are the SECURITY DEFINER
// functions agent_save_surface and agent_set_surface_outcome, which stamp the caller
// from the transaction's JWT claims.
//
// Reads validate the envelope only (a known variant and outcome, object payload,
// fallback and gathered data). The payload itself is parsed by its variant's schema
// where it is rendered (Tasks 1.18, 2.2, 2.6), so this module depends on no later
// schema.
//
// `failure` and `model` are clamped to 200 characters (the table CHECKs). `failure` is
// a short code like agent_runs.error, never provider or stack text: anything else is
// stored as unknown_failure.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import type { Variant } from "@/lib/agent/config";
import type { GatheredData } from "@/lib/agent/gathered";

export type SurfaceOutcome = "valid" | "repaired" | "fallback";

/**
 * A stored surface. payload, fallbackPayload and gathered are checked to be JSON
 * objects only; their content is parsed by the renderer of the surface's variant.
 */
export interface StoredSurface {
  id: string;
  threadId: string;
  runId: string | null;
  variant: Variant;
  payload: Record<string, unknown>;
  fallbackPayload: Record<string, unknown> | null;
  gathered: Record<string, unknown>;
  outcome: SurfaceOutcome;
  failure: string | null;
  supersedes: string | null;
  rerenderOf: string | null;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface SaveSurfaceArgs {
  threadId: string;
  runId: string | null;
  variant: Variant;
  payload: unknown;
  fallbackPayload: unknown;
  gathered: GatheredData;
  outcome: SurfaceOutcome;
  supersedes: string | null;
  rerenderOf: string | null;
  model: string | null;
  latencyMs: number | null;
  outputTokens: number | null;
}

/** The table CHECK on failure and model. */
export const SURFACE_TEXT_MAX = 200;
const FAILURE_CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The first `max` code points of `text`, so a surrogate pair is never split. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return Array.from(text).slice(0, max).join("");
}

/** A failure code as stored: a short snake_case code, else unknown_failure. */
export function failureCode(failure: string): string {
  return FAILURE_CODE_RE.test(failure) ? failure : "unknown_failure";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonNegativeIntOrNull(n: number | null): number | null {
  if (n === null || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Saves a surface inside the caller's transaction (the turn's own, so the surface and
 * the turn's writes commit together) and returns its id. The thread must be the
 * caller's; the definer function refuses another user's thread and payloads over
 * 256 kB.
 */
export async function saveSurface(tx: TransactionSql, a: SaveSurfaceArgs): Promise<string> {
  if (a.variant !== 1 && a.variant !== 2 && a.variant !== 3) throw new Error("surface: variant must be 1, 2 or 3");
  if (!isPlainObject(a.payload)) throw new Error("surface: payload must be an object");
  if (a.fallbackPayload !== null && !isPlainObject(a.fallbackPayload)) {
    throw new Error("surface: fallback payload must be an object or null");
  }
  const model = a.model === null ? null : clamp(a.model, SURFACE_TEXT_MAX);
  const rows = await tx`
    SELECT public.agent_save_surface(
      ${a.threadId}::uuid, ${a.runId}::uuid, ${a.variant}::bigint,
      ${JSON.stringify(a.payload)}::text::jsonb,
      ${a.fallbackPayload === null ? null : JSON.stringify(a.fallbackPayload)}::text::jsonb,
      ${JSON.stringify(a.gathered)}::text::jsonb,
      ${a.outcome}, ${a.supersedes}::uuid, ${a.rerenderOf}::uuid, ${model},
      ${nonNegativeIntOrNull(a.latencyMs)}::bigint, ${nonNegativeIntOrNull(a.outputTokens)}::bigint
    ) AS id`;
  const saved = parseOrNull(z.object({ id: z.string().regex(UUID_RE) }), rows[0]);
  if (!saved) throw new Error("surface: agent_save_surface returned no id");
  return saved.id;
}

const variantSchema = z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]));
const objectSchema = z.record(z.string(), z.unknown());

// variant, latency_ms are bigint (strings from postgres.js); created_at arrives as Date.
const surfaceRowSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  run_id: z.string().nullable(),
  variant: variantSchema,
  payload: objectSchema,
  fallback_payload: objectSchema.nullable(),
  gathered: objectSchema,
  outcome: z.enum(["valid", "repaired", "fallback"]),
  failure: z.string().nullable(),
  supersedes: z.string().nullable(),
  rerender_of: z.string().nullable(),
  model: z.string().nullable(),
  latency_ms: z.coerce.number().int().min(0).nullable(),
  created_at: z.coerce.date(),
});

function toSurface(raw: unknown): StoredSurface | null {
  const r = parseOrNull(surfaceRowSchema, raw);
  if (!r || Number.isNaN(r.created_at.getTime())) return null;
  return {
    id: r.id,
    threadId: r.thread_id,
    runId: r.run_id,
    variant: r.variant,
    payload: r.payload,
    fallbackPayload: r.fallback_payload,
    gathered: r.gathered,
    outcome: r.outcome,
    failure: r.failure,
    supersedes: r.supersedes,
    rerenderOf: r.rerender_of,
    model: r.model,
    latencyMs: r.latency_ms,
    createdAt: r.created_at.toISOString(),
  };
}

/** One of the caller's surfaces, or null when it is unknown, another user's or malformed. */
export async function getSurface(userId: string, id: string): Promise<StoredSurface | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, thread_id, run_id, variant, payload, fallback_payload, gathered, outcome, failure,
           supersedes, rerender_of, model, latency_ms, created_at
    FROM agent_surfaces
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`);
  return rows.length === 0 ? null : toSurface(rows[0]);
}

/**
 * Records that a surface failed to render (outcome fallback, with a short failure code)
 * and returns its stored fallback payload, or null when it has none or is not the
 * caller's. The fallback is envelope-checked only; the variant 1 renderer parses it.
 */
export async function markSurfaceFailed(
  userId: string,
  id: string,
  failure: string,
): Promise<Record<string, unknown> | null> {
  if (!UUID_RE.test(id)) return null;
  const code = clamp(failureCode(failure), SURFACE_TEXT_MAX);
  const rows = await withUserSql(userId, async (tx) => {
    await tx`SELECT public.agent_set_surface_outcome(${id}::uuid, 'fallback', ${code})`;
    return tx`SELECT fallback_payload FROM agent_surfaces WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
  });
  if (rows.length === 0) return null;
  return parseOrNull(z.object({ fallback_payload: objectSchema.nullable() }), rows[0])?.fallback_payload ?? null;
}
