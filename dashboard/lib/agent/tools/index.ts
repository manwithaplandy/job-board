// The agent's tool set (plan Tasks 0.10, 1.15 and 1.16): the phase 0 read tools, the
// phase 1 workspace read tools, the undoable write tools and the approval tools. Every tool gets the caller's
// identity from ToolCtx and never from model input.
import type { Variant } from "@/lib/agent/config";
import type { GatheredData } from "@/lib/agent/gathered";
import { readTools } from "@/lib/agent/tools/read";
import { workspaceReadTools } from "@/lib/agent/tools/workspaceRead";
import { writeTools } from "@/lib/agent/tools/write";
import { approvalTools } from "@/lib/agent/tools/approval";
import { presentTool } from "@/lib/agent/tools/present";
import { askUserTool } from "@/lib/agent/tools/askUser";

export interface ToolCtx {
  userId: string;
  email: string | null;
  threadId: string | null;
  runId: string;
  variant: Variant;
  unattended: boolean;
  gathered: GatheredData;
  /** The turn's variant 2 repair state: one object per turn (lib/agent/tools/present.ts). */
  repairsLeft: RepairState;
}

/**
 * Variant 2's one repair per turn. `n` is the repairs left; `attempt` is set when an
 * invalid payload spent one, and stays `open` until a later payload settles it or the
 * turn ends (then the loop stores the variant 1 fallback, present.ts finishPendingRepair).
 */
export interface RepairState {
  n: number;
  attempt?: RepairAttempt;
}

export interface RepairAttempt {
  /** The step that sent the invalid payload (its input message count), null if unknown. */
  step: number | null;
  /** True until a later payload is stored or the turn's end stores the fallback. */
  open: boolean;
  /** The invalid payload's title and surfaceId, for the fallback the turn may store. */
  title?: string;
  surfaceId?: string;
  started: number;
}

// No return annotation on purpose: the object literal's own type keeps each tool's
// input and output types, so InferUITools<ReturnType<typeof buildTools>> gives typed
// tool parts. Annotating it as ToolSet would erase them.
export function buildTools(ctx: ToolCtx) {
  return {
    ...readTools(ctx),
    ...workspaceReadTools(ctx),
    ...writeTools(ctx),
    // Empty without the approval secret or in an unattended run (Task 1.16).
    ...approvalTools(ctx),
    // A surface and a question need a user on the page (Task 1.20): interactive only.
    ...interactiveTools(ctx),
  };
}

function interactiveTools(ctx: ToolCtx): Partial<ReturnType<typeof attendedInteractiveTools>> {
  return ctx.unattended ? {} : attendedInteractiveTools(ctx);
}

function attendedInteractiveTools(ctx: ToolCtx) {
  return { present: presentTool(ctx), ask_user: askUserTool(ctx) };
}
