// The agent's tool set (plan Tasks 0.10, 1.15 and 1.16): the phase 0 read tools, the
// phase 1 workspace read tools, the undoable write tools and the approval tools. Every tool gets the caller's
// identity from ToolCtx and never from model input. A turn started from a view's ask gets no
// write tools (ToolCtx.fromView, PR 6).
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
  /** The turn's variant 2 or 3 repair state: one object per turn (lib/agent/tools/present.ts). */
  repairsLeft: RepairState;
  /**
   * The turn's view counter (spec 08 S4.4): one object per turn, so parallel present calls
   * share it. `used` is the slots taken, at most AGENT_LIMITS.maxViewsPerTurn.
   */
  views: { used: number };
  /**
   * PR 6 (spec 08 S10.4): the turn answers a message sent from a view (its user message id
   * starts with "view-"; plan D6 for an approval continuation). Text a generated view wrote
   * then reaches the model as the user's words, so the turn is built without the write
   * tools: it can read, show a view, ask a question, or ask for something the user approves
   * on a fixed card. False everywhere else.
   */
  fromView: boolean;
  /** The model the run calls, recorded on every surface it presents (Task 2.9 re-renders with it). */
  modelId?: string;
  /**
   * Set only by a re-render run (Task 2.9, lib/agent/rerender.ts): the original surface the
   * stored row re-renders. Such a row never supersedes another.
   */
  rerenderOf?: string;
}

/**
 * Variant 2's and 3's one repair per turn. `n` is the repairs left; `attempt` is set when an
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
    // None in a turn started from a view (PR 6, spec 08 S10.4).
    ...(ctx.fromView ? {} : writeTools(ctx)),
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
