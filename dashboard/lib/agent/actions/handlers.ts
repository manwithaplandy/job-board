// Host-side handlers for the closed action enum (plan Task 1.14). executeIntent parses
// a surface's intent, checks that the surface is the caller's and belongs to the thread
// the press came from, and dispatches to the one handler registered for its name.
//
// A handler writes through the same library function a workspace page uses, as the
// user, with an audit context whose run is null: the press is the user's, so the row is
// logged user_via_surface and a later agent marker on that job is hidden. Spending
// actions never run here directly: application.prepare answers with a fixed confirm card
// (confirm.ts) and a signed token, and only confirmIntent runs it. Without the approval
// secret there are no confirm cards, and such intents answer with a fixed toast.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import type { AuditCtx } from "@/lib/agent/actions/audit";
import { getSurface } from "@/lib/agent/surfaces/store";
import { CONFIRMATIONS_UNAVAILABLE, approvalSecret } from "@/lib/agent/approvalSecret";
import { ActionIntentSchema, type IntentName, type IntentOf, type IntentOutcome } from "@/lib/agent/actions/intents";
import { describeConfirmation, signConfirmToken, verifyConfirmToken } from "@/lib/agent/actions/confirm";
import { startApplicationPrep, type PrepOutcome } from "@/lib/applicationPrep";
import { NotReviewedError, ShortlistInputError, setShortlistState } from "@/lib/workspaces/shortlist";
import { ApplicationInputError, setApplicationStage } from "@/lib/workspaces/applications";
import { TILE_LAYOUT_MAX_ITEMS, TileLayoutError, getTileLayout, saveTileLayout } from "@/lib/workspaces/analyticsTiles";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IntentCtx {
  userId: string;
  email: string | null;
  threadId: string;
  surfaceId: string;
  audit: AuditCtx;
}
type Handler<N extends IntentName> = (ctx: IntentCtx, intent: IntentOf<N>) => Promise<IntentOutcome>;

const OPEN_ROUTES = {
  shortlist: "/shortlist",
  applications: "/applications",
  "looking-for": "/looking-for",
  documents: "/documents",
  analytics: "/analytics",
} as const;

const NOT_ALLOWED = "That change isn't allowed here.";
export const CONFIRM_ALREADY_USED = "That confirmation was already used.";

/** The fixed toast for each prep outcome of a confirmed application.prepare. */
const PREP_TOASTS: Record<PrepOutcome["status"], string> = {
  started: "Preparing your application. It takes a minute or two.",
  already_running: "That application is already being prepared.",
  pending_payload: "The job's details are still loading. Try again shortly.",
  no_plan: "Generating needs a subscription.",
  allowance_exhausted: "You've used this month's allowance for that.",
  no_resume: "Add your résumé first.",
  unknown_job: "That job isn't available any more.",
  not_greenhouse: "Prefill works for Greenhouse postings only.",
  not_configured: "Preparing couldn't start. Try again later.",
  tracking_failed: "Preparing couldn't start. Try again.",
};

/** A library refusal (bad input, unreviewed job) becomes a fixed toast; anything else is a real error. */
function refused(error: unknown): IntentOutcome {
  if (
    error instanceof ShortlistInputError ||
    error instanceof NotReviewedError ||
    error instanceof ApplicationInputError ||
    error instanceof TileLayoutError
  ) {
    return { kind: "done", toast: NOT_ALLOWED };
  }
  throw error;
}

function logDropped(reason: string, surfaceId: unknown): void {
  const id = typeof surfaceId === "string" && UUID_RE.test(surfaceId) ? surfaceId : "invalid";
  console.warn("agent: intent dropped", { reason, surfaceId: id });
}

async function postingUrl(userId: string, jobId: string): Promise<string | null> {
  const rows = await withUserSql(userId, (tx) => tx`SELECT url FROM jobs WHERE id = ${jobId}`);
  const r = parseOrNull(z.object({ url: z.string().min(1).max(2000) }), rows[0]);
  if (!r) return null;
  try {
    const u = new URL(r.url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

async function pendingProposalExists(userId: string, proposalId: string): Promise<boolean> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT 1 AS ok FROM search_memo_proposals
    WHERE id = ${proposalId}::uuid AND user_id = ${userId}::uuid AND status = 'pending'`);
  return rows.length > 0;
}

/** The registered handler for every intent name, and no other. */
export const INTENT_HANDLERS: { [N in IntentName]: Handler<N> } = {
  "shortlist.set": async (ctx, i) => {
    try {
      const out = await setShortlistState(ctx.userId, {
        jobId: i.jobId,
        state: i.state,
        reasonCode: i.reasonCode,
        reasonText: i.reasonText,
        setBy: "user",
        audit: ctx.audit,
      });
      if ("skipped" in out) return { kind: "done", toast: NOT_ALLOWED };
      return { kind: "done", toast: "Shortlist updated.", ...(out.actionId === null ? {} : { actionId: out.actionId }) };
    } catch (error) {
      return refused(error);
    }
  },
  "application.set_stage": async (ctx, i) => {
    try {
      const out = await setApplicationStage(ctx.userId, {
        jobId: i.jobId,
        stage: i.stage,
        closedReason: i.closedReason,
        actor: "user",
        audit: ctx.audit,
      });
      return { kind: "done", toast: "Application updated.", ...(out.actionId === null ? {} : { actionId: out.actionId }) };
    } catch (error) {
      return refused(error);
    }
  },
  "application.prepare": async (ctx, i) => {
    if (!approvalSecret()) return { kind: "done", toast: CONFIRMATIONS_UNAVAILABLE };
    const confirm = await describeConfirmation(ctx.userId, "application.prepare", { jobId: i.jobId }, ctx.email);
    if (!confirm) return { kind: "dropped" };
    const token = signConfirmToken(ctx.userId, { intent: i, threadId: ctx.threadId, surfaceId: ctx.surfaceId });
    if (!token) return { kind: "done", toast: CONFIRMATIONS_UNAVAILABLE };
    return { kind: "confirm", confirm, token };
  },
  "analytics.pin": async (ctx, i) => {
    try {
      const { layout } = await getTileLayout(ctx.userId);
      if (layout.items.some((it) => it.type === "tile" && it.tile.id === i.tile.id)) {
        return { kind: "done", toast: "That chart is already pinned." };
      }
      if (layout.items.length >= TILE_LAYOUT_MAX_ITEMS) return { kind: "done", toast: "Your analytics page is full." };
      const out = await saveTileLayout(ctx.userId, { items: [...layout.items, { type: "tile", tile: i.tile }] }, "user", ctx.audit);
      return { kind: "done", toast: "Pinned to Analytics.", ...(out.actionId === null ? {} : { actionId: out.actionId }) };
    } catch (error) {
      return refused(error);
    }
  },
  compare: async (_ctx, i) => ({ kind: "send", text: `Compare these two jobs: ${i.jobIds[0]} and ${i.jobIds[1]}.` }),
  answer: async (_ctx, i) => ({
    kind: "send",
    text: `Answer to ${i.questionId}: ${Array.isArray(i.value) ? i.value.join(", ") : i.value}`,
  }),
  open: async (ctx, i) => {
    if (i.target !== "posting") return { kind: "navigate", href: OPEN_ROUTES[i.target] };
    if (i.jobId === undefined) return { kind: "dropped" };
    const href = await postingUrl(ctx.userId, i.jobId);
    return href ? { kind: "navigate", href } : { kind: "done", toast: "That posting has no link." };
  },
  "memo.review": async (ctx, i) =>
    (await pendingProposalExists(ctx.userId, i.proposalId)) ? { kind: "navigate", href: "/looking-for" } : { kind: "dropped" },
};

function dispatch(ctx: IntentCtx, intent: z.infer<typeof ActionIntentSchema>): Promise<IntentOutcome> {
  const handler = INTENT_HANDLERS[intent.name] as Handler<typeof intent.name>;
  return handler(ctx, intent as never);
}

function auditFor(userId: string, threadId: string): AuditCtx {
  return { userId, threadId, runId: null, unattended: false };
}

/** The surface is the caller's and belongs to the thread; checked for every press. */
async function surfaceInThread(userId: string, threadId: string, surfaceId: string): Promise<boolean> {
  if (!UUID_RE.test(threadId) || !UUID_RE.test(surfaceId)) return false;
  const surface = await getSurface(userId, surfaceId);
  return surface !== null && surface.threadId === threadId;
}

/**
 * Runs one intent from a surface. `frame` (variant 3) is reserved until the host chip
 * press of Task 2.6 exists; until then a frame intent is dropped.
 */
export async function executeIntent(
  userId: string,
  a: { threadId: string; surfaceId: string; raw: unknown; source: "host" | "frame"; email?: string | null },
): Promise<IntentOutcome> {
  if (a.source !== "host") {
    logDropped("frame_unsupported", a.surfaceId);
    return { kind: "dropped" };
  }
  const parsed = ActionIntentSchema.safeParse(a.raw);
  if (!parsed.success) {
    logDropped("invalid_intent", a.surfaceId);
    return { kind: "dropped" };
  }
  if (!(await surfaceInThread(userId, a.threadId, a.surfaceId))) {
    logDropped("surface_not_in_thread", a.surfaceId);
    return { kind: "dropped" };
  }
  return dispatch(
    { userId, email: a.email ?? null, threadId: a.threadId, surfaceId: a.surfaceId, audit: auditFor(userId, a.threadId) },
    parsed.data,
  );
}

/**
 * Whether a prepare generation job for this user and job was created at or after the
 * token's issue time: the token then already started its prep (one read, no new table).
 */
async function prepCreatedSince(userId: string, jobId: string, issuedAt: number): Promise<boolean> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT 1 AS ok FROM generation_jobs
    WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND kind = 'prepare'
      AND created_at >= ${new Date(issuedAt).toISOString()}::timestamptz
    LIMIT 1`);
  return rows.length > 0;
}

/**
 * Runs a confirmed intent: the token must verify for this user, unexpired, from a surface
 * still in its thread, and must not have started a prep already.
 */
export async function confirmIntent(userId: string, email: string | null, token: unknown): Promise<IntentOutcome> {
  if (!approvalSecret()) return { kind: "done", toast: CONFIRMATIONS_UNAVAILABLE };
  const confirmed = verifyConfirmToken(userId, token);
  if (!confirmed) {
    logDropped("bad_confirm_token", null);
    return { kind: "dropped" };
  }
  if (!(await surfaceInThread(userId, confirmed.threadId, confirmed.surfaceId))) {
    logDropped("surface_not_in_thread", confirmed.surfaceId);
    return { kind: "dropped" };
  }
  switch (confirmed.intent.name) {
    case "application.prepare":
      if (await prepCreatedSince(userId, confirmed.intent.jobId, confirmed.issuedAt)) {
        logDropped("confirm_token_used", confirmed.surfaceId);
        return { kind: "done", toast: CONFIRM_ALREADY_USED };
      }
      return { kind: "done", toast: PREP_TOASTS[(await startApplicationPrep(userId, email, confirmed.intent.jobId)).status] };
    default:
      return { kind: "dropped" };
  }
}
