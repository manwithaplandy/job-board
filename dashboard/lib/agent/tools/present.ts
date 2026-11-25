// The present tool (plan Tasks 1.17 and 2.3, spec 7.1): renders or updates a surface in
// the thread's variant. A turn gathers with the read and write tools, then presents once.
//
// The model sees the variant's full JSON schema, but the tool's own validation is
// permissive on purpose: an invalid payload must reach execute, where validateSurface
// decides, instead of the SDK refusing the call. Every surface is stored through
// saveSurface with the turn's gathered data and the deterministic variant 1 fallback
// (D8) beside it, so it can be re-rendered in another variant later and the host has
// something to show if the payload fails to render.
//
// On an invalid payload (spec 7.1 "On failure"):
//   - variant 1: the fallback ("text plus a default block") is stored at once with
//     outcome `fallback`;
//   - variant 2: one repair attempt. While ctx.repairsLeft.n > 0 the errors go back to
//     the model as the tool output (outcome `invalid`, nothing stored) and the count is
//     spent; the next payload that validates is stored with outcome `repaired`. Another
//     invalid payload stores the variant 1 fallback with outcome `fallback` and the short
//     failure code `invalid_after_repair` (the errors themselves go to the model, since
//     the failure column holds codes only);
//   - variant 3 has no grammar until Task 2.4: its payloads fail and the variant 1
//     fallback is stored, as the spec's variant 3 failure path does.
//
// The model is still shown the variant 1 schema in every thread; the per-variant schema
// and grammar instructions come with the switcher (Task 2.8), and no thread is on
// variant 2 until then.
import { jsonSchema, tool } from "ai";
import { z } from "zod";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { Variant } from "@/lib/agent/config";
import type { ToolCtx } from "@/lib/agent/tools";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { saveSurface, setSurfaceFailure, type SurfaceOutcome } from "@/lib/agent/surfaces/store";
import { SurfacePayloadV1Schema, V1_TITLE_MAX, type SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import { validateSurface, type SurfacePayload } from "@/lib/agent/surfaces/v1/validate";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS_TO_MODEL_MAX = 10;
/** The failure code of a variant 2 surface whose repair also failed. */
export const REPAIR_FAILED = "invalid_after_repair";

export interface PresentInput {
  surfaceId?: string;
  payload: unknown;
}

export type PresentResult =
  | {
      surfaceId: string;
      variant: Variant;
      outcome: SurfaceOutcome;
      payload: SurfacePayload;
      /** Why the payload fell back (only with outcome fallback). */
      errors?: string[];
    }
  | {
      /** Variant 2's one repair attempt: nothing was stored; fix these and present again. */
      variant: Variant;
      outcome: "invalid";
      errors: string[];
    };

// The repair budgets (ctx.repairsLeft, one object per turn) that an invalid payload has
// drawn on and whose repair is still pending: the next valid payload in that turn is
// `repaired`. Keyed weakly, so a finished turn's entry goes with its context.
const repairing = new WeakSet<object>();

/**
 * The JSON schema the model is shown: { surfaceId?, payload } with the variant 1 grammar.
 * Draft 7 (PR #51 review L1): the JobComparison tuple is then `items: [...]` with
 * `additionalItems: false`, not draft 2020-12's `prefixItems`, which the tool's
 * JSONSchema7 type and some providers do not read.
 */
export function presentJsonSchema(): JSONSchema7 {
  const payload = z.toJSONSchema(SurfacePayloadV1Schema, { io: "input", target: "draft-7" }) as Record<string, unknown>;
  delete payload.$schema;
  return {
    type: "object",
    properties: {
      surfaceId: { type: "string", description: "The surface to replace, when updating one shown earlier in this thread." },
      payload: payload as JSONSchema7,
    },
    required: ["payload"],
    additionalProperties: false,
  };
}

/** Any object passes; the payload is judged in execute. */
function permissive(value: unknown): { success: true; value: PresentInput } | { success: false; error: Error } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false, error: new Error("present takes an object with a payload") };
  }
  const v = value as Record<string, unknown>;
  return {
    success: true,
    value: { ...(typeof v.surfaceId === "string" ? { surfaceId: v.surfaceId } : {}), payload: v.payload },
  };
}

/** The fallback's text: the payload's title when it has one (plain text, capped by fallbackSurface). */
function fallbackText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const title = (payload as Record<string, unknown>).title;
  return typeof title === "string" ? Array.from(title).slice(0, V1_TITLE_MAX).join("") : undefined;
}

interface StoreArgs {
  threadId: string;
  surfaceId: string | undefined;
  variant: Variant;
  payload: SurfacePayload;
  fallback: SurfacePayloadV1;
  outcome: SurfaceOutcome;
  failure: string | null;
  started: number;
}

/** Stores one surface (and its failure code, if any) in one transaction; returns its id. */
async function storeSurface(ctx: ToolCtx, a: StoreArgs): Promise<string> {
  return withUserSql(ctx.userId, async (tx) => {
    // Only one of the caller's own surfaces in this thread can be superseded; any other
    // id is ignored and the surface is stored as a new one.
    let supersedes: string | null = null;
    if (a.surfaceId !== undefined && UUID_RE.test(a.surfaceId)) {
      const rows = await tx`
        SELECT id::text AS id FROM agent_surfaces
        WHERE id = ${a.surfaceId}::uuid AND user_id = ${ctx.userId}::uuid AND thread_id = ${a.threadId}::uuid`;
      supersedes = parseOrNull(z.object({ id: z.string().regex(UUID_RE) }), rows[0])?.id ?? null;
    }
    const id = await saveSurface(tx, {
      threadId: a.threadId,
      runId: ctx.runId,
      variant: a.variant,
      payload: a.payload,
      fallbackPayload: a.fallback,
      gathered: ctx.gathered,
      outcome: a.outcome,
      supersedes,
      rerenderOf: null,
      model: null,
      latencyMs: Date.now() - a.started,
      outputTokens: null,
    });
    if (a.failure !== null) await setSurfaceFailure(tx, id, a.failure);
    return id;
  });
}

/** Variant 2: validate, spend the one repair on the first invalid payload, then fall back. */
async function presentTree(ctx: ToolCtx, threadId: string, input: PresentInput, started: number): Promise<PresentResult> {
  const budget = ctx.repairsLeft;
  const checked = await validateSurface(input.payload, 2, ctx);
  if (!checked.ok) {
    const errors = checked.errors.slice(0, ERRORS_TO_MODEL_MAX);
    if (budget.n > 0) {
      budget.n -= 1;
      repairing.add(budget);
      return { variant: 2, outcome: "invalid", errors };
    }
    repairing.delete(budget);
    const fallback = fallbackSurface(ctx.gathered, fallbackText(input.payload));
    const surfaceId = await storeSurface(ctx, {
      threadId, surfaceId: input.surfaceId, variant: 2, payload: fallback, fallback, outcome: "fallback", failure: REPAIR_FAILED, started,
    });
    return { surfaceId, variant: 2, outcome: "fallback", payload: fallback, errors };
  }
  const outcome: SurfaceOutcome = repairing.has(budget) ? "repaired" : "valid";
  repairing.delete(budget);
  const fallback = fallbackSurface(ctx.gathered, fallbackText(checked.payload));
  const surfaceId = await storeSurface(ctx, {
    threadId, surfaceId: input.surfaceId, variant: 2, payload: checked.payload, fallback, outcome, failure: null, started,
  });
  return { surfaceId, variant: 2, outcome, payload: checked.payload };
}

export async function runPresent(ctx: ToolCtx, input: PresentInput): Promise<PresentResult> {
  const threadId = ctx.threadId;
  if (threadId === null) throw new Error("present: a surface needs a thread");
  const started = Date.now();
  if (ctx.variant === 2) return presentTree(ctx, threadId, input, started);

  // Variant 1 (and variant 3 until it has a grammar): an invalid payload falls back at once.
  const fallback = fallbackSurface(ctx.gathered, fallbackText(input.payload));
  const checked = await validateSurface(input.payload, ctx.variant, ctx);
  const payload = checked.ok ? checked.payload : fallback;
  const outcome = checked.ok ? "valid" : "fallback";
  const surfaceId = await storeSurface(ctx, {
    threadId, surfaceId: input.surfaceId, variant: 1, payload, fallback, outcome, failure: null, started,
  });
  return checked.ok
    ? { surfaceId, variant: 1, outcome, payload }
    : { surfaceId, variant: 1, outcome, payload, errors: checked.errors.slice(0, ERRORS_TO_MODEL_MAX) };
}

export function presentTool(ctx: ToolCtx) {
  return tool({
    description:
      "Show the user a surface: an ordered list of 1 to 8 blocks from the fixed catalog. Blocks name jobs, metrics " +
      "and proposals by the ids your tools returned this turn; the app fills in the data. Text is plain (no links). " +
      "Pass surfaceId to replace a surface shown earlier in this thread. An invalid payload is shown as a default " +
      "summary instead. If the result's outcome is invalid, nothing was shown: fix the listed errors and call " +
      "present once more.",
    inputSchema: jsonSchema<PresentInput>(presentJsonSchema, { validate: permissive }),
    execute: (input) => runPresent(ctx, input),
  });
}
