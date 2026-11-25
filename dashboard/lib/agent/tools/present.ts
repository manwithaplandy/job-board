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
//   - variants 2 and 3 (R13): one repair attempt per turn, kept on the turn's context
//     (ctx.repairsLeft, one object per turn). While ctx.repairsLeft.n > 0 the errors go
//     back to the model as the tool output (outcome `invalid`, nothing stored), the count
//     is spent and the attempt is recorded as open; the next payload that validates, in
//     a later step, is stored with outcome `repaired`. Another invalid payload in a later
//     step stores the variant 1 fallback with outcome `fallback` and the short failure
//     code `invalid_after_repair` (the errors themselves go to the model, since the
//     failure column holds codes only). If the turn ends with the attempt still open
//     (an ask_user stop, the step cap, or the model stopping without presenting again),
//     the loop calls finishPendingRepair, which stores the same fallback with the code
//     `repair_not_attempted` (PR J1 review I1);
//   - parallel calls (PR J1 review M2): every present call in the step that spent the
//     repair is part of that one attempt. Another invalid payload from the same step
//     gets `invalid` with its errors and stores nothing; a valid one from the same step
//     is stored with outcome `valid` (it was not a repair) and settles the attempt. A step
//     is told apart by the count of messages the model was sent for it, which every
//     call in one step shares and which grows from step to step;
//   - a surface that falls back is stored as a row of the thread's variant (2 or 3) with
//     the variant 1 fallback in both payload and fallback_payload (plan R13). A valid
//     variant 3 surface stores its HTML document as the payload and the fallback beside
//     it; the sandbox frame falls back to it at render time (Task 2.6). Variant 3's gate
//     is its schema and static checks (v3/document.ts, Task 2.4).
//
// The model is shown the schema of the turn's variant (presentSchemaFor, Task 2.8): the
// variant the loop picked for this turn from the thread (lib/agent/variants.ts
// presentVariant), so a switch in the middle of a turn changes only the next turn. The
// grammar's prose is in the instructions (lib/agent/context.ts variantGrammar).
//
// Every stored surface records the run's model (ctx.modelId), so "Re-render as" (Task
// 2.9) calls the same model as the original.
import { jsonSchema, tool } from "ai";
import { z } from "zod";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { Variant } from "@/lib/agent/config";
import type { ToolCtx } from "@/lib/agent/tools";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { saveSurface, setSurfaceFailure, type SurfaceOutcome } from "@/lib/agent/surfaces/store";
import { SurfacePayloadV1Schema, V1_TITLE_MAX, type SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import { SurfacePayloadV2Schema } from "@/lib/agent/surfaces/v2/tree";
import { SurfacePayloadV3Schema } from "@/lib/agent/surfaces/v3/document";
import { validateSurface, type SurfacePayload } from "@/lib/agent/surfaces/v1/validate";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS_TO_MODEL_MAX = 10;
/** The failure code of a variant 2 surface whose repair also failed. */
export const REPAIR_FAILED = "invalid_after_repair";
/** The failure code of a variant 2 surface whose turn ended before the repair came. */
export const REPAIR_NOT_ATTEMPTED = "repair_not_attempted";

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

/** The payload schema of one variant (plan Task 2.8): the grammar the model is shown. */
export function presentSchemaFor(variant: Variant): z.ZodType {
  if (variant === 2) return SurfacePayloadV2Schema;
  if (variant === 3) return SurfacePayloadV3Schema;
  return SurfacePayloadV1Schema;
}

/**
 * The JSON schema the model is shown: { surfaceId?, payload } with the variant's grammar.
 * Draft 7 (PR #51 review L1): the JobComparison tuple is then `items: [...]` with
 * `additionalItems: false`, not draft 2020-12's `prefixItems`, which the tool's
 * JSONSchema7 type and some providers do not read. The variant 2 tree is recursive, so
 * zod emits its node schema under `definitions` with `#/definitions/...` references;
 * those resolve against the document root, so the definitions move to the tool schema's
 * root.
 */
export function presentJsonSchema(variant: Variant = 1): JSONSchema7 {
  const payload = z.toJSONSchema(presentSchemaFor(variant), { io: "input", target: "draft-7" }) as Record<string, unknown>;
  delete payload.$schema;
  const definitions = payload.definitions;
  delete payload.definitions;
  return {
    type: "object",
    properties: {
      surfaceId: { type: "string", description: "The surface to replace, when updating one shown earlier in this thread." },
      payload: payload as JSONSchema7,
    },
    required: ["payload"],
    additionalProperties: false,
    ...(definitions !== undefined ? { definitions: definitions as Record<string, JSONSchema7> } : {}),
  };
}

const PRESENT_GRAMMAR: Record<Variant, string> = {
  1:
    "Show the user a surface: an ordered list of 1 to 8 blocks from the fixed catalog. Blocks name jobs, metrics " +
    "and proposals by the ids your tools returned this turn; the app fills in the data.",
  2:
    "Show the user a surface: a tree of layout, content, input and bound nodes styled only by token enums. Bound " +
    "nodes name jobs your tools returned this turn and binds point into the data read this turn; the app fills in " +
    "the values.",
  3:
    "Show the user a surface: one self-contained HTML document written against the injected kit, shown in a " +
    "sandboxed frame with no network. The data read this turn reaches it through host.onInit.",
};

/** The tool description for one variant. */
export function presentDescription(variant: Variant): string {
  return (
    `${PRESENT_GRAMMAR[variant]} Text is plain (no links). Pass surfaceId to replace a surface shown earlier in ` +
    "this thread. An invalid payload is shown as a default summary instead. If the result's outcome is invalid, " +
    "nothing was shown: fix the listed errors and call present once more."
  );
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
      model: ctx.modelId ?? null,
      latencyMs: Date.now() - a.started,
      outputTokens: null,
    });
    if (a.failure !== null) await setSurfaceFailure(tx, id, a.failure);
    return id;
  });
}

/** The variants with one repair attempt per turn. */
type RepairVariant = 2 | 3;

/**
 * Variants 2 and 3: validate, spend the one repair on the first invalid payload, then fall
 * back. The repair state is read and settled before any await that stores, so parallel
 * calls see each other's changes.
 */
async function presentWithRepair(
  ctx: ToolCtx,
  variant: RepairVariant,
  threadId: string,
  input: PresentInput,
  started: number,
  step: number | null,
): Promise<PresentResult> {
  const state = ctx.repairsLeft;
  const checked = await validateSurface(input.payload, variant, ctx);
  const attempt = state.attempt;
  if (!checked.ok) {
    const errors = checked.errors.slice(0, ERRORS_TO_MODEL_MAX);
    // Part of the attempt that spent the repair (M2): the same answer, nothing stored.
    if (attempt !== undefined && sameStep(attempt.step, step)) return { variant, outcome: "invalid", errors };
    if (state.n > 0) {
      state.n -= 1;
      const title = fallbackText(input.payload);
      state.attempt = {
        step,
        open: true,
        started,
        ...(title !== undefined ? { title } : {}),
        ...(input.surfaceId !== undefined ? { surfaceId: input.surfaceId } : {}),
      };
      return { variant, outcome: "invalid", errors };
    }
    if (attempt !== undefined) attempt.open = false;
    const fallback = fallbackSurface(ctx.gathered, fallbackText(input.payload));
    const surfaceId = await storeSurface(ctx, {
      threadId, surfaceId: input.surfaceId, variant, payload: fallback, fallback, outcome: "fallback", failure: REPAIR_FAILED, started,
    });
    return { surfaceId, variant, outcome: "fallback", payload: fallback, errors };
  }
  const outcome: SurfaceOutcome = attempt?.open === true && !sameStep(attempt.step, step) ? "repaired" : "valid";
  if (attempt !== undefined) attempt.open = false;
  const fallback = fallbackSurface(ctx.gathered, fallbackText(checked.payload));
  const surfaceId = await storeSurface(ctx, {
    threadId, surfaceId: input.surfaceId, variant, payload: checked.payload, fallback, outcome, failure: null, started,
  });
  return { surfaceId, variant, outcome, payload: checked.payload };
}

/**
 * At the end of a turn (lib/agent/loop.ts): when a variant 2 or 3 repair is still open,
 * store the variant 1 fallback for it with the code `repair_not_attempted`, so the turn
 * still leaves a surface and the failure is counted (PR J1 review I1). Closes the attempt
 * first, so it runs at most once. Returns the stored surface's id, or null when nothing
 * was owed. An attempt is only ever opened in a variant 2 or 3 turn, whose variant the
 * context keeps for the whole turn.
 */
export async function finishPendingRepair(ctx: ToolCtx): Promise<string | null> {
  const attempt = ctx.repairsLeft.attempt;
  if (attempt === undefined || !attempt.open) return null;
  attempt.open = false;
  if (ctx.threadId === null || (ctx.variant !== 2 && ctx.variant !== 3)) return null;
  const fallback = fallbackSurface(ctx.gathered, attempt.title);
  return storeSurface(ctx, {
    threadId: ctx.threadId,
    surfaceId: attempt.surfaceId,
    variant: ctx.variant,
    payload: fallback,
    fallback,
    outcome: "fallback",
    failure: REPAIR_NOT_ATTEMPTED,
    started: attempt.started,
  });
}

/**
 * The step a call belongs to: the count of messages the model was sent for that step.
 * Every call in one step shares it and it grows from step to step. Null when the caller
 * gave no messages (a direct call): such a call shares a step with no other.
 */
function stepOf(options: PresentCallOptions | undefined): number | null {
  return options !== undefined && Array.isArray(options.messages) ? options.messages.length : null;
}

function sameStep(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && a === b;
}

/** The part of the SDK's tool execution options present reads. */
export interface PresentCallOptions {
  messages?: readonly unknown[];
}

export async function runPresent(ctx: ToolCtx, input: PresentInput, options?: PresentCallOptions): Promise<PresentResult> {
  const threadId = ctx.threadId;
  if (threadId === null) throw new Error("present: a surface needs a thread");
  const started = Date.now();
  if (ctx.variant === 2 || ctx.variant === 3) return presentWithRepair(ctx, ctx.variant, threadId, input, started, stepOf(options));

  // Variant 1: an invalid payload falls back at once.
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

/** The present tool in the turn's variant (ctx.variant, fixed for the whole turn). */
export function presentTool(ctx: ToolCtx) {
  const variant = ctx.variant;
  return tool({
    description: presentDescription(variant),
    inputSchema: jsonSchema<PresentInput>(() => presentJsonSchema(variant), { validate: permissive }),
    execute: (input, options) => runPresent(ctx, input, options),
  });
}
