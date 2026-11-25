// The present tool (plan Task 1.17, spec 7.1): renders or updates a surface in the
// thread's variant. A turn gathers with the read and write tools, then presents once.
//
// The model sees the variant's full JSON schema, but the tool's own validation is
// permissive on purpose: an invalid payload must reach execute, where validateSurface
// decides and, in variant 1, the deterministic fallback (D8, "text plus a default
// block") is stored with outcome `fallback` instead of the SDK refusing the call. Every
// surface is stored through saveSurface with the turn's gathered data, so it can be
// re-rendered in another variant later.
//
// Variants 2 and 3 have no grammar yet (Tasks 2.x): their payloads fail validation and
// the variant 1 fallback is stored, as the spec's variant 2/3 failure path does.
import { jsonSchema, tool } from "ai";
import { z } from "zod";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { Variant } from "@/lib/agent/config";
import type { ToolCtx } from "@/lib/agent/tools";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { saveSurface, type SurfaceOutcome } from "@/lib/agent/surfaces/store";
import { SurfacePayloadV1Schema, V1_TITLE_MAX } from "@/lib/agent/surfaces/v1/blocks";
import { validateSurface, type SurfacePayload } from "@/lib/agent/surfaces/v1/validate";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS_TO_MODEL_MAX = 10;

export interface PresentInput {
  surfaceId?: string;
  payload: unknown;
}

export type PresentResult = {
  surfaceId: string;
  variant: Variant;
  outcome: Extract<SurfaceOutcome, "valid" | "fallback">;
  payload: SurfacePayload;
  /** Why the payload fell back (only with outcome fallback). */
  errors?: string[];
};

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

/** The fallback's text: the invalid payload's title when it has one (plain text, capped by fallbackSurface). */
function fallbackText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const title = (payload as Record<string, unknown>).title;
  return typeof title === "string" ? Array.from(title).slice(0, V1_TITLE_MAX).join("") : undefined;
}

export async function runPresent(ctx: ToolCtx, input: PresentInput): Promise<PresentResult> {
  const threadId = ctx.threadId;
  if (threadId === null) throw new Error("present: a surface needs a thread");
  const started = Date.now();
  const fallback = fallbackSurface(ctx.gathered, fallbackText(input.payload));
  const checked = await validateSurface(input.payload, ctx.variant, ctx);
  const payload = checked.ok ? checked.payload : fallback;
  const outcome = checked.ok ? "valid" : "fallback";
  // A stored payload is in its own variant's grammar: the fallback is variant 1.
  const variant: Variant = checked.ok ? ctx.variant : 1;

  const surfaceId = await withUserSql(ctx.userId, async (tx) => {
    // Only one of the caller's own surfaces in this thread can be superseded; any other
    // id is ignored and the surface is stored as a new one.
    let supersedes: string | null = null;
    if (input.surfaceId !== undefined && UUID_RE.test(input.surfaceId)) {
      const rows = await tx`
        SELECT id::text AS id FROM agent_surfaces
        WHERE id = ${input.surfaceId}::uuid AND user_id = ${ctx.userId}::uuid AND thread_id = ${threadId}::uuid`;
      supersedes = parseOrNull(z.object({ id: z.string().regex(UUID_RE) }), rows[0])?.id ?? null;
    }
    return saveSurface(tx, {
      threadId,
      runId: ctx.runId,
      variant,
      payload,
      fallbackPayload: fallback,
      gathered: ctx.gathered,
      outcome,
      supersedes,
      rerenderOf: null,
      model: null,
      latencyMs: Date.now() - started,
      outputTokens: null,
    });
  });
  return checked.ok
    ? { surfaceId, variant, outcome, payload }
    : { surfaceId, variant, outcome, payload, errors: checked.errors.slice(0, ERRORS_TO_MODEL_MAX) };
}

export function presentTool(ctx: ToolCtx) {
  return tool({
    description:
      "Show the user a surface: an ordered list of 1 to 8 blocks from the fixed catalog. Blocks name jobs, metrics " +
      "and proposals by the ids your tools returned this turn; the app fills in the data. Text is plain (no links). " +
      "Pass surfaceId to replace a surface shown earlier in this thread. An invalid payload is shown as a default " +
      "summary instead.",
    inputSchema: jsonSchema<PresentInput>(presentJsonSchema, { validate: permissive }),
    execute: (input) => runPresent(ctx, input),
  });
}
