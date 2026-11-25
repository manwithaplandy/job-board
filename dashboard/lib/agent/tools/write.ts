// Phase 1 write tools (plan Task 1.15, spec 8.1). None needs a confirmation: each is
// audited in the same transaction as its write (ToolCtx is the audit context, so the
// row is logged agent or agent_unattended) and is one-tap undoable through the undoer
// its library registered, and every output carries the actionId the client shows Undo
// for. request_review and propose_memo_change change nothing undoable: one queues
// within the daily budget, the other only records a proposal the user approves or not.
//
// Unattended runs (spec section 9) get only set_shortlist_state, limited to suggested
// and skipped (and, through setShortlistState, to rows the user has not set), and
// propose_memo_change. No input schema takes a user id; the user is ctx.userId.
import { tool } from "ai";
import { z } from "zod";
import type { ToolCtx } from "@/lib/agent/tools";
import { logAction, actorFor } from "@/lib/agent/actions/audit";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { getViewerPlan } from "@/lib/subscriptions";
import { remainingDailyBudget, resumeMatching } from "@/lib/reviewRequests";
import { CoverLetterEditError, saveCoverLetterEditCore } from "@/lib/coverLetterEditCore";
import { AGENT_SKIP_REASONS, NotReviewedError, REASON_TEXT_MAX, ShortlistInputError, setShortlistState } from "@/lib/workspaces/shortlist";
import {
  ApplicationInputError,
  CLOSED_REASONS,
  NOTE_MAX,
  STAGES,
  addApplicationNote,
  setApplicationStage,
} from "@/lib/workspaces/applications";
import { TileLayoutError, TileLayoutSchema, saveTileLayout } from "@/lib/workspaces/analyticsTiles";
import { enqueueScopedReview, reviewScopeForMemoChange } from "@/lib/workspaces/reviewScope";
import { MemoInputError, createMemoProposal, getMemo } from "@/lib/workspaces/memo";
import { diffMemo } from "@/lib/workspaces/memoCompile";
import type { ShortlistState } from "@/lib/workspaces/types";
import { MEMO_RATIONALE_MAX, MemoDocSchema, emptyMemoDoc } from "@/lib/workspaces/memoSchema";

export const DRAFT_TEXT_MAX = 8000;
const UNATTENDED_SHORTLIST_STATES = ["suggested", "skipped"] as const;
const ATTENDED_SHORTLIST_STATES = ["suggested", "shortlisted", "later", "skipped"] as const;

export type WriteRefusal = {
  status: "refused";
  reason: "not_allowed" | "not_reviewed" | "user_owned" | "no_generated_letter";
};

const jobId = z.string().regex(JOB_ID_RE).max(300);

/** A library's input refusal becomes a refusal the model can read; anything else is a real error. */
function refusal(error: unknown): WriteRefusal {
  if (error instanceof NotReviewedError) return { status: "refused", reason: "not_reviewed" };
  if (error instanceof CoverLetterEditError) return { status: "refused", reason: "no_generated_letter" };
  if (
    error instanceof ShortlistInputError ||
    error instanceof ApplicationInputError ||
    error instanceof TileLayoutError ||
    error instanceof MemoInputError
  ) {
    return { status: "refused", reason: "not_allowed" };
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function shortlistInput<S extends readonly [ShortlistState, ...ShortlistState[]]>(states: S) {
  return z
    .object({
      jobId,
      state: z.enum(states),
      reasonCode: z.enum(AGENT_SKIP_REASONS).optional(),
      reasonText: z.string().max(REASON_TEXT_MAX).optional(),
    })
    .strict()
    .refine((i) => (i.state === "skipped") === (i.reasonCode !== undefined), {
      message: "a skip needs one of the agent's reason codes; other states take none",
    });
}
export const shortlistInputAttended = shortlistInput(ATTENDED_SHORTLIST_STATES);
export const shortlistInputUnattended = shortlistInput(UNATTENDED_SHORTLIST_STATES);
export const setStageInput = z
  .object({ jobId, stage: z.enum(STAGES), closedReason: z.enum(CLOSED_REASONS).optional() })
  .strict();
export const addNoteInput = z.object({ jobId, note: z.string().min(1).max(NOTE_MAX) }).strict();
export const setTilesInput = z.object({ layout: TileLayoutSchema }).strict();
export const updateDraftInput = z.object({ jobId, text: z.string().min(1).max(DRAFT_TEXT_MAX) }).strict();
export const requestReviewInput = z.object({ scope: z.enum(["full", "shortlist"]) }).strict();
export const proposeMemoInput = z
  .object({ proposedDoc: MemoDocSchema, rationale: z.string().min(1).max(MEMO_RATIONALE_MAX) })
  .strict();

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

type ShortlistIn = { jobId: string; state: ShortlistState; reasonCode?: (typeof AGENT_SKIP_REASONS)[number]; reasonText?: string };

export async function setShortlistStateTool(ctx: ToolCtx, input: ShortlistIn) {
  if (ctx.unattended && !(UNATTENDED_SHORTLIST_STATES as readonly string[]).includes(input.state)) {
    return { status: "refused", reason: "not_allowed" } satisfies WriteRefusal;
  }
  try {
    const out = await setShortlistState(ctx.userId, {
      jobId: input.jobId,
      state: input.state,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      setBy: "agent",
      audit: ctx,
    });
    if ("skipped" in out) return { status: "refused", reason: "user_owned" } satisfies WriteRefusal;
    return { status: "done" as const, state: out.after.state, actionId: out.actionId };
  } catch (error) {
    return refusal(error);
  }
}

export async function setApplicationStageTool(ctx: ToolCtx, input: z.infer<typeof setStageInput>) {
  try {
    const out = await setApplicationStage(ctx.userId, { ...input, actor: "agent", audit: ctx });
    return { status: "done" as const, stage: input.stage, actionId: out.actionId };
  } catch (error) {
    return refusal(error);
  }
}

export async function addApplicationNoteTool(ctx: ToolCtx, input: z.infer<typeof addNoteInput>) {
  try {
    const out = await addApplicationNote(ctx.userId, { ...input, actor: "agent", audit: ctx });
    return { status: "done" as const, actionId: out.actionId };
  } catch (error) {
    return refusal(error);
  }
}

export async function setAnalyticsTilesTool(ctx: ToolCtx, input: z.infer<typeof setTilesInput>) {
  try {
    const out = await saveTileLayout(ctx.userId, input.layout, "agent", ctx);
    return { status: "done" as const, version: out.version, actionId: out.actionId };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Writes the user-edit overlay of the job's generated cover letter (never the letter
 * itself or any résumé column). Refused when no generated letter exists. Audited with
 * the previous edit (null when there was none) as `before`. An edit equal to the live
 * one writes nothing new to undo. The user's comment on their edit is left as it is.
 */
export async function updateDocumentDraftTool(ctx: ToolCtx, input: z.infer<typeof updateDraftInput>) {
  if (ctx.unattended) return { status: "refused", reason: "not_allowed" } satisfies WriteRefusal;
  let actionId: number | null = null;
  try {
    await saveCoverLetterEditCore(ctx.userId, input.jobId, input.text, {
      requireGenerated: true,
      also: async (tx, src, text) => {
        if (src.previousText === text) return;
        actionId = await logAction(tx, {
          ctx,
          actor: actorFor(ctx),
          kind: "document.update_draft",
          targetKey: { jobId: input.jobId },
          before: src.previousText,
          after: text,
        });
      },
    });
    return { status: "done" as const, actionId };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Queues reviews within the daily budget: "full" resumes matching (the reviewer's own
 * queue), "shortlist" enqueues the scoped re-review of the shortlist and newest jobs.
 * With no budget left today it queues nothing and says so.
 */
export async function requestReviewTool(ctx: ToolCtx, input: z.infer<typeof requestReviewInput>) {
  if (ctx.unattended) return { status: "refused", reason: "not_allowed" } satisfies WriteRefusal;
  const plan = await getViewerPlan(ctx.userId, ctx.email);
  const remaining = await remainingDailyBudget(ctx.userId, plan);
  if (remaining <= 0) return { status: "budget_exhausted" as const, remainingDailyBudget: 0 };
  if (input.scope === "full") {
    const out = await resumeMatching(ctx.userId);
    return { status: out.existing ? ("already_active" as const) : ("queued" as const), queue: out.status, remainingDailyBudget: remaining };
  }
  const queued = await enqueueScopedReview(ctx.userId, await reviewScopeForMemoChange(ctx.userId));
  return { status: queued, remainingDailyBudget: remaining };
}

/** Records a pending memo proposal and returns its diff against the current memo; the memo itself is untouched. */
export async function proposeMemoChangeTool(ctx: ToolCtx, input: z.infer<typeof proposeMemoInput>) {
  try {
    const current = await getMemo(ctx.userId);
    const proposal = await createMemoProposal(ctx.userId, {
      proposedDoc: input.proposedDoc,
      rationale: input.rationale,
      source: ctx.unattended ? "background" : "interactive",
    });
    return { status: "done" as const, proposalId: proposal.id, diff: diffMemo(current?.doc ?? emptyMemoDoc(), proposal.proposedDoc) };
  } catch (error) {
    return refusal(error);
  }
}

// ---------------------------------------------------------------------------
// The tool set
// ---------------------------------------------------------------------------

const SHORTLIST_DESCRIPTION =
  "Move a reviewed job on the user's shortlist. A skip needs one of the agent's reason codes " +
  `(${AGENT_SKIP_REASONS.join(", ")}); other states take none. Undoable; the output's actionId is the Undo.`;

function proposeMemoTool(ctx: ToolCtx) {
  return tool({
    description:
      "Propose a change to the user's memo. It creates a pending proposal the user approves or declines on a " +
      "fixed diff card; the memo itself does not change. Returns the proposal id and the diff.",
    inputSchema: proposeMemoInput,
    execute: (input) => proposeMemoChangeTool(ctx, input),
  });
}

function unattendedWriteTools(ctx: ToolCtx) {
  return {
    set_shortlist_state: tool({
      description: `${SHORTLIST_DESCRIPTION} In a background run only suggested and skipped are allowed, and rows the user set are left alone.`,
      inputSchema: shortlistInputUnattended,
      execute: (input) => setShortlistStateTool(ctx, input),
    }),
    propose_memo_change: proposeMemoTool(ctx),
  };
}

/** The write tools for `ctx`: the full set, or the unattended subset (see the module header). */
export function writeTools(ctx: ToolCtx) {
  return ctx.unattended ? unattendedWriteTools(ctx) : attendedWriteTools(ctx);
}

function attendedWriteTools(ctx: ToolCtx) {
  const proposeMemo = proposeMemoTool(ctx);
  return {
    set_shortlist_state: tool({
      description: SHORTLIST_DESCRIPTION,
      inputSchema: shortlistInputAttended,
      execute: (input) => setShortlistStateTool(ctx, input),
    }),
    set_application_stage: tool({
      description:
        "Move a job on the user's application tracker (adding it when absent). Closed needs a reason. Moving to " +
        "applied marks the job's application package applied. Undoable.",
      inputSchema: setStageInput,
      execute: (input) => setApplicationStageTool(ctx, input),
    }),
    add_application_note: tool({
      description: `Add a note (at most ${NOTE_MAX} characters) to a job's application history. Undoable.`,
      inputSchema: addNoteInput,
      execute: (input) => addApplicationNoteTool(ctx, input),
    }),
    set_analytics_tiles: tool({
      description:
        "Replace the user's analytics page layout: up to 24 tiles (catalog metrics with a fitting chart) and " +
        "headings. Undoable.",
      inputSchema: setTilesInput,
      execute: (input) => setAnalyticsTilesTool(ctx, input),
    }),
    update_document_draft: tool({
      description:
        `Replace the user's edited version of the generated cover letter for a job (1 to ${DRAFT_TEXT_MAX} ` +
        "characters). Only when a generated letter exists; the generated letter itself is kept. Undoable.",
      inputSchema: updateDraftInput,
      execute: (input) => updateDocumentDraftTool(ctx, input),
    }),
    request_review: tool({
      description:
        "Ask the reviewer to score more jobs today, within the user's daily budget: full (resume matching) or " +
        "shortlist (re-score the shortlist and newest jobs first). Reports the queue state and budget left.",
      inputSchema: requestReviewInput,
      execute: (input) => requestReviewTool(ctx, input),
    }),
    propose_memo_change: proposeMemo,
  };
}
