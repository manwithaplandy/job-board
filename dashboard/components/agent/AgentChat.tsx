"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { createIdGenerator, DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";
import {
  confirmIntentAction,
  describeApprovalAction,
  executeIntentAction,
  loadSurfaceAction,
  newThread,
  reloadSurfaceRowsAction,
  renameThreadAction,
} from "@/app/actions/agent";
import { useGenerationTracker } from "@/components/generation/GenerationToastProvider";
import { Alert } from "@/components/ui/SystemStates";
import { Button } from "@/components/ui/Button";
import { AGENT_LIMITS, type Variant } from "@/lib/agent/config";
import { CONFIRMATIONS_UNAVAILABLE } from "@/lib/agent/approvalSecret";
import { compareMessage } from "@/lib/agent/actions/compareText";
import type { PendingApproval } from "@/lib/agent/actions/approvalCard";
import type { ActionIntent, ConfirmDescriptor, IntentOutcome } from "@/lib/agent/actions/intents";
import type { AgentRequest } from "@/lib/agent/request";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { titleFromFirstMessage } from "@/lib/agent/titles";
import { parseGenerationJob } from "@/lib/generationJobCodec";
import { AgentNotice, type AgentBlockingNotice } from "./AgentNotice";
import { AttachButton, type AttachedDocument } from "./AttachButton";
import { Composer } from "./Composer";
import { ConfirmCard } from "./ConfirmCard";
import { EmptyState } from "./EmptyState";
import { stashFirstMessage, takeFirstMessage } from "./firstMessage";
import { ReviewProgress } from "./ReviewProgress";
import { mergeSurface, withBlocksView } from "./SurfaceHost";
import { VariantSwitcher, type VariantsState } from "./VariantSwitcher";
import { showUndoToast, writeToastText } from "./UndoToast";
import { currentStepLabel, summarizeSteps, type StepsState } from "@/lib/agent/steps";
import { AgentMarkdown } from "./AgentMarkdown";
import { StepsRow } from "./StepsRow";
import { ViewFrame } from "./ViewFrame";
import { ViewLoadFailed, ViewPlaceholder, ViewUpdatedStub } from "./ViewPlaceholder";

// The agent chat (plan Tasks 0.14 and 1.20). The server owns history (D7): every request
// carries only the thread id and either the new message's id, text and attached document
// ids, or an approval decision; the route loads the rest from agent_messages. Assistant
// text is drawn as markdown by AgentMarkdown, as React elements only: no raw HTML, and no
// links or images (spec section 10). The user's text stays plain. The one rich output is
// a surface, and it is rendered only by SurfaceHost from the server-parsed surface row,
// never from the tool part's own payload. Every view renders inline, in a ViewFrame, at the
// present part that made it (spec 08 S4.1); there is no second column. Approvals and high-risk intents show only the
// fixed ConfirmCard, built on the server from database values.

const generateId = createIdGenerator({ prefix: "u", size: 16 });

// A stored message's metadata (lib/agent/threads.ts loadMessages): a total parse, so a
// stray shape reads as "no status" rather than crashing the page.
const metadataSchema = z.object({
  status: z.enum(["complete", "pending", "failed"]),
  createdAt: z.string().optional(),
});

function metaOf(m: UIMessage): z.infer<typeof metadataSchema> | null {
  const r = metadataSchema.safeParse(m.metadata);
  return r.success ? r.data : null;
}

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/**
 * A reply that never finished: a failed assistant row, or one still pending after the
 * stale-turn window (the server aborts such a run on the next turn, AGENT_LIMITS.staleTurnMs).
 */
function isUnfinished(m: UIMessage, now: number): boolean {
  if (m.role !== "assistant") return false;
  const meta = metaOf(m);
  if (!meta) return false;
  if (meta.status === "failed") return true;
  if (meta.status !== "pending" || !meta.createdAt) return false;
  const at = Date.parse(meta.createdAt);
  return Number.isFinite(at) && now - at > AGENT_LIMITS.staleTurnMs;
}

/** The last reply never finished. */
function isInterrupted(messages: UIMessage[], now: number): boolean {
  const last = messages.at(-1);
  return last !== undefined && isUnfinished(last, now);
}

/**
 * What a failed request means for the page. `rollback` is true when nothing was stored,
 * so the optimistic message comes back out and its text returns to the composer.
 */
type Rejection = ({ notice: AgentBlockingNotice } | { message: string }) & { rollback: boolean };

export const GENERIC_PROBLEM = "The assistant could not answer just now. Try again.";
export const UNAVAILABLE_PROBLEM = "The assistant is unavailable right now. Try again later.";
export const RATE_LIMITED_PROBLEM = "Too many requests right now. Try again in a minute.";
export const PROVIDER_DOWN_PROBLEM = "The assistant's service is having trouble. Try again in a moment.";

/**
 * The sentence for a turn that failed mid-stream. The route sends only a fixed reason
 * code as the stream's error text (lib/agent/modelError.ts: model_error:<status>), never
 * the provider's own words; anything else reads as the generic line.
 */
export function problemFromStreamError(errorText: string): string {
  const m = /^model_error:(\d{3})$/.exec(errorText.trim());
  if (!m) return GENERIC_PROBLEM;
  const status = Number(m[1]);
  // A bad key, no credits, or no access to the model: nothing the user can fix.
  if (status === 401 || status === 402 || status === 403) return UNAVAILABLE_PROBLEM;
  if (status === 429) return RATE_LIMITED_PROBLEM;
  if (status >= 500) return PROVIDER_DOWN_PROBLEM;
  return GENERIC_PROBLEM;
}
const INTENT_DROPPED = "That action isn't available any more.";
const INTENT_FAILED = "That action could not run. Try again.";
const APPROVAL_INVALID = "This request can't be confirmed. Ask again.";

// The route's own refusals, each answered before anything is stored (app/api/agent/route.ts).
// Any other status (a 5xx) may come after the server stored the user message, so the
// message stays and a reload shows what was kept.
const NOTHING_STORED = new Set([400, 402, 404, 409, 429, 503]);

function rejectionFrom(status: number, body: unknown): Rejection {
  const rollback = NOTHING_STORED.has(status);
  const reason = z.object({ reason: z.string() }).safeParse(body);
  if (status === 429) return { rollback, notice: reason.success && reason.data.reason === "monthly_ceiling" ? "monthly_ceiling" : "daily_ceiling" };
  if (status === 503) return { rollback, notice: "agent_disabled" };
  if (status === 402) return { rollback, notice: "no_plan" };
  if (status === 409) return { rollback, message: "A reply is still being written in this conversation. Wait for it to finish, then send again." };
  if (status === 404) return { rollback, message: "This conversation was not found. Start a new one from the list." };
  return { rollback, message: GENERIC_PROBLEM };
}

// How often the stale-turn check is re-run, so a pending reply turns "interrupted" once
// it passes AGENT_LIMITS.staleTurnMs without a reload.
const CLOCK_TICK_MS = 15_000;

// What a send passes to the transport beside the messages (sendMessage's options.body).
const requestExtraSchema = z.object({
  documentIds: z.array(z.string()).optional(),
  approval: z.object({ approvalId: z.string(), approved: z.boolean() }).optional(),
});

/**
 * The HTTP transport plus a small ledger of the request in flight: its message id and
 * text, and how the route rejected it, so a rejection can take the optimistic message
 * back out and return the text to the composer. An approval has no message of its own
 * to take back.
 */
function chatTransport(threadId: string) {
  // `retry`: the request answered a stored question again, so a refusal keeps it on screen.
  let sent: { id: string; text: string; retry: boolean } | null = null;
  let rejected: Rejection | null = null;
  const transport = new DefaultChatTransport<UIMessage>({
    api: "/api/agent",
    prepareSendMessagesRequest: ({ messages, body: extraRaw, trigger }) => {
      const extra = requestExtraSchema.safeParse(extraRaw ?? {});
      const approval = extra.success ? extra.data.approval : undefined;
      rejected = null;
      if (approval) {
        sent = null;
        const body: AgentRequest = { threadId, kind: "approval", approvalId: approval.approvalId, approved: approval.approved };
        return { body };
      }
      const last = messages.at(-1);
      const text = last ? textOf(last) : "";
      // Retry (regenerate): the server reads the stored question by id; nothing is resent.
      if (trigger === "regenerate-message" && last?.role === "user") {
        const body: AgentRequest = { threadId, kind: "retry", id: last.id };
        sent = { id: last.id, text, retry: true };
        return { body };
      }
      const documentIds = extra.success ? (extra.data.documentIds ?? []) : [];
      const body: AgentRequest = {
        threadId,
        kind: "message",
        id: last?.id ?? generateId(),
        text,
        ...(documentIds.length > 0 ? { documentIds } : {}),
      };
      sent = { id: body.id, text, retry: false };
      return { body };
    },
    fetch: async (input, init) => {
      let res: Response;
      try {
        res = await globalThis.fetch(input, init);
      } catch (e) {
        // A network failure: treated like a refusal, so the text goes back to the
        // composer for a resend (unless the user aborted it, which is no error).
        if (!init?.signal?.aborted) rejected = { rollback: true, message: GENERIC_PROBLEM };
        throw e;
      }
      if (!res.ok) rejected = rejectionFrom(res.status, await res.clone().json().catch(() => null));
      return res;
    },
  });
  const book = {
    take: () => {
      const out = { sent, rejected };
      rejected = null;
      return out;
    },
  };
  return { transport, book };
}

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

function toolPartsOf(m: UIMessage): ToolPart[] {
  return m.parts.filter((p): p is ToolPart => isToolUIPart(p));
}

// What the page reads of a present result: the stored row's id and the outcome. The
// payload is never read (the view is drawn from the stored row).
const presentOutputSchema = z.object({ surfaceId: z.uuid().optional(), outcome: z.string().optional() });
const writeOutputSchema = z.object({ status: z.literal("done"), actionId: z.number().int().positive() });
// The approval tools that start a generation, and the outputs that mean one is running.
const PREP_TOOLS: ReadonlySet<string> = new Set(["start_application_prep", "refine_documents"]);
const prepOutputSchema = z.object({ status: z.enum(["started", "already_running"]), generation: z.unknown().optional() });
// ask_user's questions, shown as plain text (the answer is the user's next message).
const askUserInputSchema = z.object({ questions: z.array(z.object({ label: z.string(), options: z.array(z.string()).optional() })) });

/** What stands at a present part (spec 08 S7.3): a placeholder while it is written, its stored row, or nothing. */
export type PresentView = { kind: "building" } | { kind: "none" } | { kind: "surface"; surfaceId: string };

export function presentView(part: ToolPart): PresentView {
  if (part.state === "input-streaming" || part.state === "input-available") return { kind: "building" };
  if (part.state !== "output-available") return { kind: "none" };
  const out = presentOutputSchema.safeParse(part.output);
  // An invalid payload or a turn past its views stored nothing: the steps row says so.
  if (!out.success || out.data.outcome === "invalid" || out.data.outcome === "limit" || !out.data.surfaceId) return { kind: "none" };
  return { kind: "surface", surfaceId: out.data.surfaceId };
}

/** The surface a present part produced, or null. */
function presentedSurfaceId(part: ToolPart): string | null {
  if (getToolName(part) !== "present") return null;
  const view = presentView(part);
  return view.kind === "surface" ? view.surfaceId : null;
}

/** The first approval in the last assistant message that waits for the user (an automatic one never does). */
function waitingApproval(messages: UIMessage[]): { id: string } | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return null;
  for (const part of toolPartsOf(last)) {
    if (part.state === "approval-requested" && part.approval.isAutomatic !== true) return { id: part.approval.id };
  }
  return null;
}

/** ask_user's questions, shown in the answer as plain text (the answer is the user's next message). */
function AskUserQuestions({ part }: { part: ToolPart }) {
  const input = askUserInputSchema.safeParse(part.input);
  if (!input.success) return null;
  return (
    <ul className="rf-agent-message__questions">
      {input.data.questions.map((q, i) => (
        <li key={i}>
          {q.label}
          {q.options && q.options.length > 0 ? ` (${q.options.join(", ")})` : ""}
        </li>
      ))}
    </ul>
  );
}

/** An assistant message's steps row: its state, the working label and time, and whether it is open. */
type StepsView = { state: StepsState; elapsedMs: number; open: boolean; onToggle: () => void };

function MessageView({
  message,
  renderPresent,
  steps,
}: {
  message: UIMessage;
  /** What stands at a present part: its view, a placeholder, a stub, a load failure, or nothing. */
  renderPresent: (part: ToolPart) => ReactNode;
  /** Assistant messages only; null for the user's. */
  steps: StepsView | null;
}) {
  const who = message.role === "user" ? "You" : "Assistant";
  // Parts render in stored order. A tool call is a step, shown only in the steps row,
  // except present (its view renders where it was made) and ask_user (its questions
  // are part of the answer).
  const shown = message.parts.flatMap((part, i): ReactNode[] => {
    if (part.type === "text") {
      if (part.text.trim() === "") return [];
      // The user's own words stay plain text; the assistant's are drawn as markdown.
      return message.role === "assistant"
        ? [<AgentMarkdown key={i} text={part.text} />]
        : [<p key={i} className="rf-agent-message__text">{part.text}</p>];
    }
    if (!isToolUIPart(part)) return [];
    const name = getToolName(part);
    if (name === "present") {
      const view = renderPresent(part);
      return view ? [<Fragment key={i}>{view}</Fragment>] : [];
    }
    if (name === "ask_user" && askUserInputSchema.safeParse(part.input).success) return [<AskUserQuestions key={i} part={part} />];
    return [];
  });
  const summary = steps ? summarizeSteps(message.parts) : null;
  const row =
    steps && summary && (steps.state === "working" || summary.total > 0) ? (
      <StepsRow
        id={`steps-${message.id}`}
        summary={summary}
        state={steps.state}
        currentLabel={steps.state === "working" ? currentStepLabel(message.parts) : undefined}
        elapsedMs={steps.elapsedMs}
        open={steps.open}
        onToggle={steps.onToggle}
      />
    ) : null;
  // A reply with nothing to show (a failed turn with no steps) is not drawn as an empty
  // bubble; the error line stands in.
  if (shown.length === 0 && row === null) return null;
  return (
    <li className={`rf-agent-message rf-agent-message--${message.role}`}>
      <span className="rf-agent-message__role">{who}</span>
      {row}
      {shown}
    </li>
  );
}

/**
 * A failed or interrupted reply, shown once in the transcript where the answer would have
 * been, with Retry when the question can be sent again.
 */
function TurnError({ title, text, onRetry }: { title?: string; text: string; onRetry: (() => void) | null }) {
  return (
    <div className="rf-agent-turn-error" role="alert">
      <div className="rf-agent-turn-error__copy">
        {title && <p className="rf-agent-turn-error__title">{title}</p>}
        <p className="rf-agent-turn-error__text">{text}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export const INTERRUPTED_TITLE = "This reply was interrupted";
export const INTERRUPTED_TEXT = "The last reply did not finish. Retry to send your message again.";

type ConfirmState =
  | { source: "intent"; descriptor: ConfirmDescriptor; token: string }
  | { source: "approval"; descriptor: ConfirmDescriptor; approvalId: string };

const APPROVAL_RETRY_MS = [500, 1_000, 2_000];

// How often the working steps row's timer ticks while a turn runs.
const TIMER_TICK_MS = 1_000;

/**
 * Test and gallery seams (spec 08 section 14.2), in the pattern of SandboxFrame's `server`
 * prop: show the working row with a frozen timer, or open one message's steps, without a
 * network or a click. Product code never passes it.
 */
export type AgentChatFixture = { working?: { elapsedMs: number }; openStepsFor?: string; expandedChainId?: string };

// The provisional reply that holds the working row before the first part arrives.
const PROVISIONAL_ID = "provisional";

export function AgentChat({
  threadId,
  initialMessages,
  notice,
  autoTitle = false,
  surfaces = [],
  approvalsEnabled = false,
  compare = null,
  hasProfile = true,
  variants = null,
  title = null,
  fixture,
}: {
  threadId: string;
  /** The thread's title, shown in the toolbar above the conversation. */
  title?: string | null;
  initialMessages: UIMessage[];
  notice: AgentBlockingNotice | null;
  autoTitle?: boolean;
  /** The variant switcher's state (plan Task 2.8); null hides it (no plan). */
  variants?: VariantsState | null;
  /** The thread's surface chains, parsed on the server (lib/agent/surfaces/host.ts). */
  surfaces?: HostChain[];
  /** False without AGENT_TOOL_APPROVAL_SECRET: no confirm card is ever shown for an approval. */
  approvalsEnabled?: boolean;
  /** Two validated job ids from ?compare=a,b: sent once as the structured compare message. */
  compare?: readonly [string, string] | null;
  hasProfile?: boolean;
  /** Gallery and test seam only; see AgentChatFixture. */
  fixture?: AgentChatFixture;
}) {
  const router = useRouter();
  const tracker = useGenerationTracker();
  const [draft, setDraft] = useState("");
  // The toolbar's title: an untitled thread takes its first message's title at once (the
  // server rename lands in the background).
  const [shownTitle, setShownTitle] = useState(title);
  const [blocking, setBlocking] = useState<AgentBlockingNotice | null>(notice);
  // A failed send: its sentence, and whether Retry can resend (the message stayed; a
  // refusal took it back out and returned its text to the composer instead).
  const [problem, setProblem] = useState<{ text: string; retry: boolean } | null>(null);
  const [attached, setAttached] = useState<AttachedDocument[]>([]);
  const [chains, setChains] = useState<HostChain[]>(surfaces);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [approvalCards, setApprovalCards] = useState<Record<string, PendingApproval>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);
  // When the page sent the running turn (a send, a Retry, an approval answer): the working
  // steps row's timer counts from it. A turn sent on mount (the handed-over first message,
  // ?compare) counts from the mount.
  const [mountedAt] = useState(() => Date.now());
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  // Which messages' steps panels are open, kept for the session; all start collapsed.
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>(() => (fixture?.openStepsFor ? { [fixture.openStepsFor]: true } : {}));
  // A turn that failed while the page was open: the user message it answered (null for an
  // approval answer) until the render below finds the reply, then that reply's id in
  // failedReplies for the session. Streamed replies carry no stored status, so this is how
  // their steps row reads "Stopped" (spec 08 section 11, row 13).
  const [pendingFailure, setPendingFailure] = useState<{ afterUserId: string | null } | null>(null);
  const [failedReplies, setFailedReplies] = useState<ReadonlySet<string>>(() => new Set());
  // A turn about to re-stream replies under their own ids (a Retry: the server reuses the
  // failed reply's id; an approval answer: the continuation fills the waiting reply) must
  // not inherit their "Stopped" mark. Other failed replies keep theirs for the session.
  const clearFailed = (ids: string[]) => {
    if (ids.some((id) => failedReplies.has(id))) {
      setFailedReplies((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    }
  };
  const startTurn = () => {
    const at = Date.now();
    setTurnStartedAt(at);
    setNow(at);
  };
  const named = useRef(!autoTitle);
  // One transport per mounted chat (the page keys AgentChat by thread id).
  const [{ transport, book }] = useState(() => chatTransport(threadId));

  const { messages, sendMessage, regenerate, setMessages, status, addToolApprovalResponse } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    generateId,
    onError: (error) => {
      // A refusal or a network failure stored nothing; a 5xx or an error mid-stream may
      // come after the server saved the message, so it stays.
      const { rejected, sent } = book.take();
      // No HTTP refusal: the turn failed mid-stream, and the stream's error text is the
      // route's fixed reason code.
      const r = rejected ?? { rollback: false, message: problemFromStreamError(error instanceof Error ? error.message : "") };
      if (sent && r.rollback && !sent.retry) {
        setMessages((prev) => prev.filter((m) => m.id !== sent.id));
        setDraft((d) => (d === "" ? sent.text : d));
      }
      // Kept: the reply that was streaming (if one arrived) failed. A refusal rolled back,
      // so no reply is marked and earlier replies stay as they were.
      if (!r.rollback) setPendingFailure({ afterUserId: sent?.id ?? null });
      if ("notice" in r) {
        setBlocking(r.notice);
        setProblem(null);
      } else {
        // Retry resends a message; an approval's failure has none to resend.
        // A failed Retry left the stored question in place, so it can be retried again.
        setProblem({ text: r.message, retry: sent !== null && (sent.retry || !r.rollback) });
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const interrupted = !busy && isInterrupted(messages, now);
  const lastUserText = [...messages].reverse().find((m) => m.role === "user");
  const last = messages.at(-1);
  // The working row's timer ticks once a second while a turn runs.
  useEffect(() => {
    if (!busy) return;
    const tick = setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => clearInterval(tick);
  }, [busy]);
  // Resolve a failure into the reply it ended, once the turn has stopped: the last message,
  // when it is an assistant reply after the kept user message. State adjusted during
  // render (the React pattern for deriving from an event), so no effect is needed.
  if (pendingFailure && !busy) {
    const reply = messages.at(-1);
    const askedAt = pendingFailure.afterUserId === null ? -1 : messages.findIndex((m) => m.id === pendingFailure.afterUserId);
    if (reply?.role === "assistant" && messages.length - 1 > askedAt && !failedReplies.has(reply.id)) {
      setFailedReplies((prev) => new Set(prev).add(reply.id));
    }
    setPendingFailure(null);
  }
  const working = busy || fixture?.working !== undefined;
  const elapsedMs = fixture?.working?.elapsedMs ?? now - (turnStartedAt ?? mountedAt);
  const stepsFor = (m: UIMessage, isLast: boolean): StepsView => {
    // "Stopped": the stored status says so (a reload after a failure), or the turn failed
    // while the page was open.
    const state: StepsState = isLast && working ? "working" : isUnfinished(m, now) || failedReplies.has(m.id) ? "stopped" : "done";
    return {
      state,
      elapsedMs,
      open: openSteps[m.id] === true,
      onToggle: () => setOpenSteps((prev) => ({ ...prev, [m.id]: !prev[m.id] })),
    };
  };

  const send = (text: string) => {
    setProblem(null);
    setDraft("");
    startTurn();
    if (!named.current) {
      named.current = true;
      setShownTitle(titleFromFirstMessage(text));
      void renameThreadAction(threadId, titleFromFirstMessage(text)).catch(() => {});
    }
    const documentIds = attached.map((d) => d.id);
    setAttached([]);
    void sendMessage({ text }, documentIds.length > 0 ? { body: { documentIds } } : undefined);
  };
  // Retry answers the last question again: everything after it is dropped from the screen
  // and the server reuses the stored question (kind "retry"), so it is never stored twice.
  // The composer's draft and attachments stay as they are.
  const retry = lastUserText
    ? () => {
        setProblem(null);
        startTurn();
        clearFailed(messages.slice(messages.findIndex((m) => m.id === lastUserText.id) + 1).filter((m) => m.role === "assistant").map((m) => m.id));
        void regenerate({ messageId: lastUserText.id });
      }
    : null;

  // On mount, once: the first message handed over by the empty page (StartConversation),
  // or ?compare=a,b as one structured message, after which the query is cleared so a
  // reload does not send it again.
  const compared = useRef(false);
  useEffect(() => {
    if (compared.current) return;
    compared.current = true;
    const first = takeFirstMessage(threadId);
    if (first && notice === null && !compare) {
      // The composer is empty and nothing is attached on mount, so this is send() without
      // its state resets.
      named.current = true;
      const firstTitle = titleFromFirstMessage(first.text);
      void renameThreadAction(threadId, firstTitle).then(() => setShownTitle(firstTitle), () => {});
      void sendMessage({ text: first.text }, first.documentIds.length > 0 ? { body: { documentIds: first.documentIds } } : undefined);
      return;
    }
    if (!compare) return;
    if (notice === null) {
      // The composer is empty and nothing is attached on mount, so this is send() without
      // its state resets.
      const text = compareMessage(compare[0], compare[1]);
      named.current = true;
      const compareTitle = titleFromFirstMessage(text);
      void renameThreadAction(threadId, compareTitle).then(() => setShownTitle(compareTitle), () => {});
      void sendMessage({ text });
    }
    router.replace(`/agent?t=${encodeURIComponent(threadId)}`);
    // Runs once per mounted chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A present result: load the stored row, parsed on the server, and fold it into its chain.
  // A load that rejects or finds nothing is kept in failedLoads, so its part shows the
  // fixed line with Try again instead of a placeholder that never resolves (spec 08 S7.3).
  const loading = useRef(new Set<string>());
  const [failedLoads, setFailedLoads] = useState<ReadonlySet<string>>(() => new Set());
  const loadSurface = useCallback(
    (surfaceId: string) => {
      loading.current.add(surfaceId);
      const failed = () => setFailedLoads((prev) => new Set(prev).add(surfaceId));
      void loadSurfaceAction(threadId, surfaceId).then((surface) => {
        if (surface) setChains((prev) => mergeSurface(prev, surface));
        else failed();
      }, failed);
    },
    [threadId],
  );
  const retryLoad = (surfaceId: string) => {
    setFailedLoads((prev) => new Set([...prev].filter((id) => id !== surfaceId)));
    loading.current.delete(surfaceId);
    loadSurface(surfaceId);
  };
  useEffect(() => {
    for (const m of messages) {
      for (const part of toolPartsOf(m)) {
        const surfaceId = presentedSurfaceId(part);
        if (!surfaceId || loading.current.has(surfaceId) || chains.some((c) => c.memberIds.includes(surfaceId))) continue;
        loadSurface(surfaceId);
      }
    }
  }, [messages, chains, loadSurface]);

  // A write tool's result with an actionId raises an Undo toast, once, for results that
  // arrive while the page is open (not for the stored history).
  const toasted = useRef<Set<string> | null>(null);
  if (toasted.current === null) {
    toasted.current = new Set(initialMessages.flatMap((m) => toolPartsOf(m).map((p) => p.toolCallId)));
  }
  useEffect(() => {
    const seen = toasted.current as Set<string>;
    for (const m of messages) {
      for (const part of toolPartsOf(m)) {
        if (part.state !== "output-available" || seen.has(part.toolCallId)) continue;
        const out = writeOutputSchema.safeParse(part.output);
        if (!out.success) continue;
        seen.add(part.toolCallId);
        showUndoToast({ text: writeToastText(getToolName(part)), actionId: out.data.actionId, onUndone: () => router.refresh() });
      }
    }
  }, [messages, router]);

  // A prep the agent started through its approval tool (start_application_prep or
  // refine_documents, after the user approved the card) tells the generation tracker,
  // once per call and not for the stored history, so the checklist and the completion
  // toast follow it (PR I3b review I3). The tool's output carries only the generation
  // id, so the tracker refreshes; a parseable generation view is handed over directly.
  const prepSeen = useRef<Set<string> | null>(null);
  if (prepSeen.current === null) {
    prepSeen.current = new Set(initialMessages.flatMap((m) => toolPartsOf(m).map((p) => p.toolCallId)));
  }
  useEffect(() => {
    const seen = prepSeen.current as Set<string>;
    for (const m of messages) {
      for (const part of toolPartsOf(m)) {
        if (part.state !== "output-available" || seen.has(part.toolCallId)) continue;
        if (!PREP_TOOLS.has(getToolName(part))) continue;
        const out = prepOutputSchema.safeParse(part.output);
        if (!out.success) continue;
        seen.add(part.toolCallId);
        const generation = parseGenerationJob(out.data.generation);
        if (generation && tracker) tracker.notifyStarted(generation);
        else tracker?.refresh();
      }
    }
  }, [messages, tracker]);

  // The waiting approval's fixed card, built on the server from the stored part. The
  // turn may still be saving when the stream ends, so "pending" is retried briefly.
  const waiting = busy ? null : waitingApproval(messages);
  const waitingId = waiting?.id ?? null;
  useEffect(() => {
    if (!approvalsEnabled || waitingId === null || approvalCards[waitingId]) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; ; attempt++) {
        let result: PendingApproval;
        try {
          result = await describeApprovalAction(threadId, waitingId);
        } catch {
          result = { status: "invalid" };
        }
        if (cancelled) return;
        if (result.status !== "pending" || attempt >= APPROVAL_RETRY_MS.length) {
          const settled: PendingApproval = result.status === "pending" ? { status: "invalid" } : result;
          setApprovalCards((prev) => ({ ...prev, [waitingId]: settled }));
          return;
        }
        await new Promise((r) => setTimeout(r, APPROVAL_RETRY_MS[attempt]));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approvalsEnabled, waitingId, approvalCards, threadId]);

  const respondToApproval = async (approvalId: string, approved: boolean) => {
    setProblem(null);
    await addToolApprovalResponse({ id: approvalId, approved });
    startTurn();
    const waitingReply = messages.at(-1);
    if (waitingReply?.role === "assistant") clearFailed([waitingReply.id]);
    void sendMessage(undefined, { body: { approval: { approvalId, approved } } });
  };

  const notifyPrep = (outcome: IntentOutcome) => {
    if (outcome.kind !== "done") return;
    const generation = parseGenerationJob(outcome.generation);
    if (generation && tracker) tracker.notifyStarted(generation);
    else tracker?.refresh();
  };

  const handleOutcome = (outcome: IntentOutcome) => {
    switch (outcome.kind) {
      case "done":
        if (outcome.actionId !== undefined) showUndoToast({ text: outcome.toast, actionId: outcome.actionId, onUndone: () => router.refresh() });
        else toast(outcome.toast);
        return;
      case "confirm":
        setConfirm({ source: "intent", descriptor: outcome.confirm, token: outcome.token });
        return;
      case "send":
        send(outcome.text);
        return;
      case "navigate":
        if (outcome.href.startsWith("/") && !outcome.href.startsWith("//")) router.push(outcome.href);
        else if (/^https?:\/\//i.test(outcome.href)) window.open(outcome.href, "_blank", "noopener,noreferrer");
        return;
      case "dropped":
        toast(INTENT_DROPPED);
        return;
    }
  };

  // Stable callbacks for the blocks (their effects depend on them); the latest handlers
  // are read through a ref.
  const handlers = useRef({ handleOutcome });
  useEffect(() => {
    handlers.current = { handleOutcome };
  });
  const onIntent = useCallback(
    (surfaceId: string, intent: ActionIntent, source: "host" | "frame" = "host") => {
      void executeIntentAction(threadId, surfaceId, intent, source).then(
        (outcome) => handlers.current.handleOutcome(outcome),
        () => toast(INTENT_FAILED),
      );
    },
    [threadId],
  );
  const onPrepSettled = useCallback(
    (surfaceId: string) => {
      void reloadSurfaceRowsAction(threadId, surfaceId).then(
        (rows) => {
          if (!rows) return;
          setChains((prev) =>
            prev.map((c) => {
              if (c.surface.id === surfaceId) return { ...c, surface: { ...c.surface, rows } };
              // A re-render's rows (Task 2.9).
              if (c.rerenders?.some((r) => r.id === surfaceId)) {
                return { ...c, rerenders: c.rerenders.map((r) => (r.id === surfaceId ? { ...r, rows } : r)) };
              }
              return c;
            }),
          );
        },
        () => {},
      );
    },
    [threadId],
  );
  // A frame fell back: the surface shows its blocks for the rest of the session (R15).
  const onFallback = useCallback((surfaceId: string) => setChains((prev) => withBlocksView(prev, surfaceId)), []);
  // A re-render joins its original's chain as another version (Task 2.9).
  const onRerendered = useCallback((surface: HostSurface) => setChains((prev) => mergeSurface(prev, surface)), []);
  const rerenderSwitch = variants ? variants.variant3Enabled : null;
  // "Go to it": the latest frame of a chain, found in this chat when pressed, scrolled into
  // view with its title focused.
  const chatRef = useRef<HTMLElement>(null);
  const goToChain = (chainId: string) => {
    const frame = [...(chatRef.current?.querySelectorAll<HTMLElement>(".rf-view") ?? [])].find((el) => el.dataset.chainId === chainId);
    const title = frame?.querySelector<HTMLElement>(".rf-view__title");
    if (!frame || !title) return;
    if (typeof frame.scrollIntoView === "function") frame.scrollIntoView({ block: "start" });
    title.focus({ preventScroll: true });
  };
  // Keyed by chain, never by row: an update or a version switch keeps the frame (spec 08 S5).
  const chainView = (chain: HostChain) => (
    <ViewFrame
      key={chain.chainId}
      chain={chain}
      threadId={threadId}
      variant3Enabled={rerenderSwitch}
      onIntent={onIntent}
      onPrepSettled={onPrepSettled}
      onFallback={onFallback}
      onRerendered={onRerendered}
    />
  );

  const approve = async (target: ConfirmState) => {
    setConfirmBusy(true);
    try {
      if (target.source === "approval") {
        await respondToApproval(target.approvalId, true);
      } else {
        const outcome = await confirmIntentAction(target.token);
        handleOutcome(outcome);
        notifyPrep(outcome);
      }
    } catch {
      toast(INTENT_FAILED);
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };
  const deny = (target: ConfirmState) => {
    if (target.source === "approval") void respondToApproval(target.approvalId, false);
    setConfirm(null);
  };

  // The approval card, when the server built one, takes the confirm slot.
  const approvalCard = approvalsEnabled && waitingId !== null ? approvalCards[waitingId] : undefined;
  const shownConfirm: ConfirmState | null =
    confirm ?? (approvalCard?.status === "ready" && waitingId !== null ? { source: "approval", descriptor: approvalCard.descriptor, approvalId: waitingId } : null);
  const approvalProblem =
    waitingId === null ? null : !approvalsEnabled || approvalCard?.status === "unavailable" ? CONFIRMATIONS_UNAVAILABLE : approvalCard?.status === "invalid" ? APPROVAL_INVALID : null;

  // Placement (spec 08 S4.1): one column at every width. Each chain renders once, inline
  // at the present call that produced its latest row; an earlier row's call shows the
  // "updated below" stub; a chain no call in the loaded history names renders after the
  // transcript. A call whose row has not loaded shows the placeholder sized for the
  // thread's variant, or the load failure with Try again.
  const placeholderVariant: Variant = variants?.thread ?? 1;
  const presentedIds = new Set(messages.flatMap((m) => toolPartsOf(m).map(presentedSurfaceId).filter((id): id is string => id !== null)));
  const orphans = chains.filter((c) => !presentedIds.has(c.surface.id));
  const renderPresent = (part: ToolPart): ReactNode => {
    const view = presentView(part);
    if (view.kind === "none") return null;
    if (view.kind === "building") return <ViewPlaceholder variant={placeholderVariant} />;
    const id = view.surfaceId;
    const latestOf = chains.find((c) => c.surface.id === id);
    if (latestOf) return chainView(latestOf);
    // Every known chain renders (here or as an orphan), so its latest frame is on the page.
    const memberOf = chains.find((c) => c.memberIds.includes(id));
    if (memberOf) return <ViewUpdatedStub onGo={() => goToChain(memberOf.chainId)} />;
    if (failedLoads.has(id)) return <ViewLoadFailed onRetry={() => retryLoad(id)} />;
    return <ViewPlaceholder variant={placeholderVariant} />;
  };

  const reviewWatch = messages.reduce(
    (n, m) => n + toolPartsOf(m).filter((p) => getToolName(p) === "request_review" && p.state === "output-available").length,
    0,
  );

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={send}
      disabled={blocking !== null}
      busy={busy}
      attachments={
        <AttachButton
          attached={attached}
          onAttach={(d) => setAttached((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d]))}
          onRemove={(id) => setAttached((prev) => prev.filter((d) => d.id !== id))}
          disabled={blocking !== null || busy}
        />
      }
    />
  );

  return (
    <div className="rf-agent-conversation">
      {(shownTitle || variants) && (
        // The fixed chrome above the conversation (spec 6.1): the thread's title and the
        // switcher for how answers are drawn. It wraps; nothing in it overlaps.
        <div className="rf-agent-toolbar">
          {shownTitle && (
            <h2 className="rf-agent-toolbar__title" title={shownTitle}>
              {shownTitle}
            </h2>
          )}
          {/* A change during a turn applies to the next one: the loop read the variant when the turn started. */}
          {variants && <VariantSwitcher threadId={threadId} state={variants} />}
        </div>
      )}
      <section ref={chatRef} className="rf-agent-chat" aria-label="Conversation">
        {messages.length > 0 && (
          // aria-busy holds the live region's announcement while a reply streams, so a
          // screen reader reads the finished reply once, not every token.
          <ol className="rf-agent-transcript" aria-live="polite" aria-busy={busy}>
            {messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                renderPresent={renderPresent}
                steps={m.role === "assistant" ? stepsFor(m, i === messages.length - 1) : null}
              />
            ))}
            {/* Before the reply's first part arrives, a provisional reply holds the working row. */}
            {working && last?.role === "user" && (
              <MessageView
                message={{ id: PROVISIONAL_ID, role: "assistant", parts: [] }}
                renderPresent={renderPresent}
                steps={stepsFor({ id: PROVISIONAL_ID, role: "assistant", parts: [] }, true)}
              />
            )}
          </ol>
        )}
        {/* One failure line, where the answer would have been: a failed send, or else a
            stored reply that never finished. */}
        {problem && !blocking ? (
          <TurnError text={problem.text} onRetry={problem.retry ? retry : null} />
        ) : (
          interrupted && !blocking && <TurnError title={INTERRUPTED_TITLE} text={INTERRUPTED_TEXT} onRetry={retry} />
        )}
        {orphans.map((c) => (
          <Fragment key={c.chainId}>{chainView(c)}</Fragment>
        ))}
        <ReviewProgress watch={reviewWatch} />
        {blocking && <AgentNotice kind={blocking} />}
        {approvalProblem && !shownConfirm && <Alert tone="warning">{approvalProblem}</Alert>}
        {shownConfirm && <ConfirmCard descriptor={shownConfirm.descriptor} onApprove={() => void approve(shownConfirm)} onDeny={() => deny(shownConfirm)} busy={confirmBusy} />}
        {messages.length === 0 ? <EmptyState hasProfile={hasProfile} composer={composer} /> : composer}
      </section>
    </div>
  );
}

/**
 * The agent page with no conversation open (plan Task 1.20, spec 5(a) step 1): the empty
 * state's one sentence, the composer and the upload target. Uploads need no thread. The
 * first Send, from its handler and never during render, creates the thread, hands the
 * message to it (firstMessage.ts) and opens it; its chat sends the message on mount.
 */
export function StartConversation({ hasProfile }: { hasProfile: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<AttachedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const starting = useRef(false);
  const send = (text: string) => {
    // One thread per first message, however often Send is pressed.
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setFailed(false);
    const documentIds = attached.map((d) => d.id);
    void newThread().then(
      ({ id }) => {
        stashFirstMessage(id, { text, documentIds });
        router.push(`/agent?t=${encodeURIComponent(id)}`);
      },
      () => {
        starting.current = false;
        setBusy(false);
        setFailed(true);
      },
    );
  };
  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={send}
      disabled={false}
      busy={busy}
      attachments={
        <AttachButton
          attached={attached}
          onAttach={(d) => setAttached((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d]))}
          onRemove={(id) => setAttached((prev) => prev.filter((d) => d.id !== id))}
          disabled={busy}
        />
      }
    />
  );
  return (
    <section className="rf-agent-chat" aria-label="New conversation">
      {failed && <Alert tone="danger">A new conversation could not be started. Try again.</Alert>}
      <EmptyState hasProfile={hasProfile} composer={composer} />
    </section>
  );
}

/**
 * ?compare=a,b with no conversation open: starts one, then reopens the page on it with
 * the same compare, which AgentChat sends once. Runs on the user's own navigation from
 * the shortlist's Compare button, never during a server render.
 */
export function CompareStarter({ compare }: { compare: readonly [string, string] }) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void newThread().then(
      ({ id }) =>
        router.replace(`/agent?t=${encodeURIComponent(id)}&compare=${compare.map((j) => encodeURIComponent(j)).join(",")}`),
      () => setFailed(true),
    );
  }, [compare, router]);
  return failed ? (
    <Alert tone="danger">A new conversation could not be started. Try again.</Alert>
  ) : (
    <p className="rf-agent-chat__empty" role="status">
      Starting a comparison.
    </p>
  );
}
