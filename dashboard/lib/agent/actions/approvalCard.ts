// The confirm card for a pending tool approval (plan Task 1.20, PR #51 carried items).
// An approval tool's part stops the turn at `approval-requested`; the page shows the
// fixed card describeConfirmation builds for it. The card is built from the stored
// part's input (the thread's last assistant message, read under RLS), never from what
// the client holds, so neither the model's free text nor a tampered client message can
// write the title, lines, costs or button.
//
// Fail closed: without AGENT_TOOL_APPROVAL_SECRET there are no approval tools, the
// loop refuses approvals, and no card is built.
import { getToolName, isToolUIPart } from "ai";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { loadMessages } from "@/lib/agent/threads";
import { describeConfirmation, type ConfirmKind } from "@/lib/agent/actions/confirm";
import type { ConfirmDescriptor } from "@/lib/agent/actions/intents";
import type { ApprovalToolName } from "@/lib/agent/tools/approval";

/** Which fixed card each approval tool shows. start_application_prep is the prepare card. */
export const APPROVAL_CONFIRM_KIND: Record<ApprovalToolName, ConfirmKind> = {
  start_application_prep: "application.prepare",
  set_resume: "set_resume",
  refine_documents: "refine_documents",
  propose_profile_details: "propose_profile_details",
};

export type PendingApproval =
  | { status: "ready"; descriptor: ConfirmDescriptor }
  /** The part is not (yet) stored as pending: the turn may still be saving. */
  | { status: "pending" }
  /** The target is gone or the stored input does not parse. */
  | { status: "invalid" }
  /** No approval secret: approvals are off. */
  | { status: "unavailable" };

function isApprovalTool(name: string): name is ApprovalToolName {
  return Object.prototype.hasOwnProperty.call(APPROVAL_CONFIRM_KIND, name);
}

/** The fixed card for the pending approval `approvalId` in the thread's last assistant message. */
export async function describePendingApproval(
  userId: string,
  threadId: string,
  approvalId: string,
  email: string | null,
): Promise<PendingApproval> {
  if (approvalSecret() === null) return { status: "unavailable" };
  const messages = await loadMessages(userId, threadId);
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return { status: "pending" };
  for (const part of last.parts) {
    if (!isToolUIPart(part) || part.state !== "approval-requested" || part.approval.id !== approvalId) continue;
    const name = getToolName(part);
    if (!isApprovalTool(name)) return { status: "invalid" };
    const descriptor = await describeConfirmation(userId, APPROVAL_CONFIRM_KIND[name], part.input, email);
    return descriptor ? { status: "ready", descriptor } : { status: "invalid" };
  }
  return { status: "pending" };
}
