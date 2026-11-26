// The body of POST /api/agent (plan Task 0.13), shared by the route and the chat client
// (Task 0.14), so the client builds exactly what the route accepts. Pure: safe to import
// from client code. It lives here, not in the route file, because a Next.js route
// module may only export its handlers and route config.
//
// Strict objects: an extra key (a `userId`, client-sent message parts, history) is a
// 400, never silently dropped. The user id always comes from the server session.
import { z } from "zod";

export const AGENT_TEXT_MAX = 8000;
export const AGENT_MESSAGE_ID_MAX = 64;
export const AGENT_DOCUMENTS_MAX = 4;

const MessageRequestSchema = z.strictObject({
  threadId: z.uuid(),
  kind: z.literal("message"),
  id: z.string().min(1).max(AGENT_MESSAGE_ID_MAX),
  text: z.string().min(1).max(AGENT_TEXT_MAX),
  documentIds: z.array(z.uuid()).max(AGENT_DOCUMENTS_MAX).optional(),
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
