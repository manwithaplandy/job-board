// What a variant 3 frame's action request is shown as (plan Task 2.6, decision D13). The
// frame never acts: each request becomes a chip under the frame, and nothing runs until
// the user presses it. The chip's label is built here from the parsed intent's ids and
// enum values and from database values (the job's title and company, fixed labels), never
// from a string the frame wrote. The frame's own free text (a skip note, an answer, a
// chart title or note) is the value being proposed: it is shown apart from the label, in
// `proposed`, after "From the view:", and only when it fits whole on the chip and holds
// no control or bidi characters, so what the user reads is exactly what a press sends or
// stores (frameTextProblem; executeIntent re-checks it for every frame press).
//
// Server only: it reads the database (jobLine) and parses with ActionIntentSchema.
import { ActionIntentSchema, OPEN_TARGETS, type ActionIntent, type IntentOf } from "@/lib/agent/actions/intents";
import { UNSAFE_CHARS, clamp, jobLine } from "@/lib/agent/actions/confirm";
import { CLOSED_REASON_LABELS, STAGE_LABELS, skipReasonLabel } from "@/lib/workspaces/labels";
import { USER_SKIP_REASONS } from "@/lib/workspaces/shortlist";
import type { ShortlistState } from "@/lib/workspaces/types";

const USER_SKIP_REASON_SET: ReadonlySet<string> = new Set(USER_SKIP_REASONS);

/** The longest free text a frame may propose: it is shown whole on the chip. */
export const FRAME_TEXT_MAX = 280;
export const FRAME_LABEL_MAX = 160;

export interface IntentDescription {
  /** Built from ids, enum values and database values only. */
  label: string;
  /** The frame's own values, each prefixed "From the view:", shown as proposed. */
  proposed?: string[];
}

const WORKSPACE_LABELS: Record<Exclude<(typeof OPEN_TARGETS)[number], "posting">, string> = {
  shortlist: "your shortlist",
  applications: "your applications",
  "looking-for": "What I'm looking for",
  documents: "your documents",
  analytics: "Analytics",
};

/** The message the answer intent sends (the handler and the chip share it). */
export function answerMessage(i: IntentOf<"answer">): string {
  return `Answer to ${i.questionId}: ${Array.isArray(i.value) ? i.value.join(", ") : i.value}`;
}

/** The intent an action message from the frame asks for, or null. The message's name wins. */
export function frameIntent(name: string, args: unknown): ActionIntent | null {
  if (args === null || typeof args !== "object" || Array.isArray(args)) return null;
  const r = ActionIntentSchema.safeParse({ ...args, name });
  return r.success ? r.data : null;
}

/** The frame-written strings an intent carries, as they will be sent or stored. */
function frameTexts(intent: ActionIntent): string[] {
  switch (intent.name) {
    case "shortlist.set":
      return intent.reasonText === undefined ? [] : [intent.reasonText];
    case "answer":
      return [answerMessage(intent)];
    case "analytics.pin":
      return [intent.tile.title, ...(intent.tile.note === undefined ? [] : [intent.tile.note])];
    default:
      return [];
  }
}

/**
 * Why a frame may not propose this intent, or null when it may: free text over
 * FRAME_TEXT_MAX, or with a control or bidi character, could not be shown exactly as it
 * would be sent or stored.
 */
export function frameTextProblem(intent: ActionIntent): string | null {
  // A skip reason the user's own skip could not store would show as "Other".
  if (intent.name === "shortlist.set" && intent.reasonCode !== undefined && !USER_SKIP_REASON_SET.has(intent.reasonCode)) {
    return "frame_reason_unknown";
  }
  for (const text of frameTexts(intent)) {
    if (text.length > FRAME_TEXT_MAX) return "frame_text_too_long";
    if (text.search(UNSAFE_CHARS) !== -1) return "frame_text_unsafe";
  }
  return null;
}

/** An open of a workspace page with nothing else: the one frame request that may run without a press (once per surface). */
export function isDirectOpen(intent: ActionIntent): boolean {
  return intent.name === "open" && intent.target !== "posting" && intent.jobId === undefined;
}

function fromTheView(text: string): string {
  return `From the view: ${clamp(text, FRAME_TEXT_MAX)}`;
}

function shortlistLabel(state: ShortlistState, job: string): string {
  switch (state) {
    case "shortlisted":
      return `Shortlist ${job}`;
    case "later":
      return `Save ${job} for later`;
    case "skipped":
      return `Skip ${job}`;
    case "suggested":
      return `Move ${job} back to suggestions`;
  }
}

function result(label: string, proposed: string[] = []): IntentDescription {
  const out: IntentDescription = { label: clamp(label, FRAME_LABEL_MAX) };
  return proposed.length > 0 ? { ...out, proposed } : out;
}

/**
 * The chip for a frame's intent, or null when there is none to offer (an unknown job, or
 * free text frameTextProblem refuses).
 */
export async function describeIntent(userId: string, intent: ActionIntent): Promise<IntentDescription | null> {
  if (frameTextProblem(intent) !== null) return null;
  switch (intent.name) {
    case "shortlist.set": {
      const job = await jobLine(userId, intent.jobId);
      if (job === null) return null;
      const proposed: string[] = [];
      if (intent.reasonCode !== undefined) proposed.push(`Reason: ${skipReasonLabel(intent.reasonCode)}`);
      if (intent.reasonText !== undefined) proposed.push(fromTheView(intent.reasonText));
      return result(shortlistLabel(intent.state, job), proposed);
    }
    case "application.set_stage": {
      const job = await jobLine(userId, intent.jobId);
      if (job === null) return null;
      const proposed = intent.closedReason === undefined ? [] : [`Reason: ${CLOSED_REASON_LABELS[intent.closedReason]}`];
      return result(`Move ${job} to ${STAGE_LABELS[intent.stage]}`, proposed);
    }
    case "application.prepare": {
      const job = await jobLine(userId, intent.jobId);
      return job === null ? null : result(`Prepare an application for ${job}`);
    }
    case "analytics.pin": {
      const proposed = [fromTheView(intent.tile.title)];
      if (intent.tile.note !== undefined) proposed.push(fromTheView(intent.tile.note));
      return result("Pin a chart to Analytics", proposed);
    }
    case "compare": {
      const [a, b] = await Promise.all([jobLine(userId, intent.jobIds[0]), jobLine(userId, intent.jobIds[1])]);
      return a === null || b === null ? null : result(`Compare ${a} with ${b}`);
    }
    case "answer":
      return result("Send a message to the agent", [fromTheView(answerMessage(intent))]);
    case "open": {
      if (intent.target !== "posting") return result(`Open ${WORKSPACE_LABELS[intent.target]}`);
      if (intent.jobId === undefined) return null;
      const job = await jobLine(userId, intent.jobId);
      return job === null ? null : result(`Open the posting for ${job}`);
    }
    case "memo.review":
      return result("Review a proposed change to What I'm looking for");
    case "memo.resolve":
      return result(
        intent.decision === "approve"
          ? "Approve the proposed change to What I'm looking for"
          : "Decline the proposed change to What I'm looking for",
      );
  }
}
