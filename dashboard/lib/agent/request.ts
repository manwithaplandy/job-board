// The body of POST /api/agent (plan Task 0.13), shared by the route and the chat client
// (Task 0.14), so the client builds exactly what the route accepts. Pure: safe to import
// from client code. It lives here, not in the route file, because a Next.js route
// module may only export its handlers and route config.
//
// Strict objects: an extra key (a `userId`, client-sent message parts, history) is a
// 400, never silently dropped. The user id always comes from the server session.
import { z } from "zod";
import { ASK_TEXT_MAX, normalizeAskText } from "@/lib/agent/surfaces/v3/bridge";

export const AGENT_TEXT_MAX = 8000;
export const AGENT_MESSAGE_ID_MAX = 64;
export const AGENT_DOCUMENTS_MAX = 4;

/**
 * PR 6 (spec 08 S10.4): a message sent from a view's pending ask carries where it came from.
 * The route checks that the surface is a variant 3 row of the caller's in this thread.
 */
export const ViewSourceSchema = z.strictObject({ kind: z.literal("view"), surfaceId: z.uuid() });
export type ViewSource = z.infer<typeof ViewSourceSchema>;

/**
 * The id prefix of a message sent from a view (the client makes these ids with
 * createIdGenerator({ prefix: "view" })). It is the message's provenance: it is stored as
 * agent_messages.id, a Retry answers the same id, and the loop builds a turn that answers
 * one without write tools (ToolCtx.fromView).
 */
export const VIEW_MESSAGE_PREFIX = "view-";

export function isViewMessageId(id: string): boolean {
  return id.startsWith(VIEW_MESSAGE_PREFIX);
}

/**
 * The pairing of a view id and a source (plan D7, checked by the route): a view id needs a
 * source, a source needs a view id, and a view message's text is at most ASK_TEXT_MAX code
 * points (the ask's own cap, tighter than AGENT_TEXT_MAX). Polish wave, M4 (defence in
 * depth; the host page is the trust anchor): a view message's text must also be exactly what
 * normalizeAskText makes of it, the text the host showed beside Send, so no invisible
 * character, control or extra whitespace reaches the model through a crafted request. Null
 * when the request is fine.
 */
export function viewSourceError(req: {
  id: string;
  text: string;
  source?: unknown;
}): "view_id_without_source" | "source_without_view_id" | "view_text_too_long" | "view_text_not_normalized" | null {
  const fromView = isViewMessageId(req.id);
  const hasSource = req.source !== undefined;
  if (fromView && !hasSource) return "view_id_without_source";
  if (hasSource && !fromView) return "source_without_view_id";
  if (fromView && Array.from(req.text).length > ASK_TEXT_MAX) return "view_text_too_long";
  if (fromView && normalizeAskText(req.text) !== req.text) return "view_text_not_normalized";
  return null;
}

const MessageRequestSchema = z.strictObject({
  threadId: z.uuid(),
  kind: z.literal("message"),
  id: z.string().min(1).max(AGENT_MESSAGE_ID_MAX),
  text: z.string().min(1).max(AGENT_TEXT_MAX),
  documentIds: z.array(z.uuid()).max(AGENT_DOCUMENTS_MAX).optional(),
  source: ViewSourceSchema.optional(),
});

const ApprovalRequestSchema = z.strictObject({
  threadId: z.uuid(),
  kind: z.literal("approval"),
  approvalId: z.string().min(1).max(128),
  approved: z.boolean(),
});

// Retry: answer the stored question `id` again. No text: the server reads the question
// from the thread, so a Retry can never change what was asked.
const RetryRequestSchema = z.strictObject({
  threadId: z.uuid(),
  kind: z.literal("retry"),
  id: z.string().min(1).max(AGENT_MESSAGE_ID_MAX),
});

export const AgentRequestSchema = z.discriminatedUnion("kind", [MessageRequestSchema, ApprovalRequestSchema, RetryRequestSchema]);

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
