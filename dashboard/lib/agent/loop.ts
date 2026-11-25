// The agent loop (plan Task 0.11): one interactive turn, streamed to the client and
// persisted on the server whatever the client does.
//
// Order: validate the input, startRun (a TurnInProgressError propagates before anything
// is written), load history (so it includes a turn that finished just before), save the
// user message `complete` and a placeholder assistant row `pending`, then stream. Any
// failure after startRun closes the run. Every step is charged in onStepEnd the moment
// it ends, so spend is recorded whether or not the turn finishes.
//
// Persistence follows Spike B (lib/agent/spikes/persistOnDisconnect.test.ts), not the
// brief's onEnd path: toUIMessageStream's onEnd fires at a client cancel with only the
// parts streamed so far, so the turn is persisted inside after() from next/server once
// `await result.steps` settles, from a server-side UI message stream that no client can
// cancel. result.consumeStream() keeps the model stream draining after a disconnect;
// the pending row is the hedge if the process dies before after() runs.
//
// What is stored is only what the server built: the user message is rebuilt from the
// input's text (never client-sent parts), history comes from the database (never the
// request), and the assistant message comes from the model stream.
//
// No database transaction is open across a model call: each runs.ts call is its own
// short transaction. The request's own abort signal is never passed to the model: the
// turn runs to the end under its own AbortController and wall-clock timer.
//
// Approvals (plan Task 1.16, Spike B): an approval tool stops its turn with the tool part
// at `approval-requested`, signed with AGENT_TOOL_APPROVAL_SECRET. The user's decision
// arrives as a TurnInput of kind `approval`: the loop finds that pending part in the
// thread's last assistant message (else 400 through TurnInputError), patches the STORED
// part to `approval-responded` (a denial carries a reason telling the model not to try
// again), and continues that same assistant message with a new turn. The SDK runs the
// tool only when approved and only if the signature still matches. Without the secret
// there are no approval tools, no toolApproval and no secret on the model call, and an
// approval input is refused before anything is written.
import { after } from "next/server";
import { z } from "zod";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  getToolName,
  hasToolCall,
  isStepCount,
  isToolUIPart,
  readUIMessageStream,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { catalogNow } from "@/lib/catalogClock";
import { flushLangfuseTraces } from "@/lib/observability";
import { AGENT_LIMITS, AGENT_MODEL_DEFAULT } from "@/lib/agent/config";
import { AGENT_DOCUMENTS_MAX, AGENT_TEXT_MAX } from "@/lib/agent/request";
import { stepCostMicros } from "@/lib/agent/budget";
import { buildInstructions } from "@/lib/agent/context";
import { emptyGathered } from "@/lib/agent/gathered";
import { MESSAGE_STATUSES, type AgentUIMessage, type MessageStatus } from "@/lib/agent/messageCodec";
import { agentModel } from "@/lib/agent/provider";
import { chargeStep, finishRun, saveMessages, startRun } from "@/lib/agent/runs";
import type { AgentThread } from "@/lib/agent/threads";
import { loadMessages } from "@/lib/agent/threads";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import { getProfileSummary } from "@/lib/agent/tools/read";
import { TOOL_APPROVAL, approvalStreamOptions } from "@/lib/agent/tools/approval";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { withAgentTrace } from "@/lib/agent/telemetry";
import { listDocuments } from "@/lib/workspaces/documents";
import { getMemo } from "@/lib/workspaces/memo";
import { compileMemo } from "@/lib/workspaces/memoCompile";
import { summarizeIfLong } from "@/lib/agent/summary";
import type { DocumentMeta, ProfileSummary } from "@/lib/workspaces/types";

export type TurnInput =
  | { kind: "message"; id: string; text: string; documentIds: string[] }
  | { kind: "approval"; approvalId: string; approved: boolean };

export type TurnInputErrorCode =
  | "approval_unavailable"
  | "approval_not_found"
  | "unknown_document"
  | "too_many_documents"
  | "bad_message_id"
  | "duplicate_message_id"
  | "empty_text"
  | "text_too_long";

/**
 * The input cannot start a turn. Thrown before startRun, so nothing is written, except
 * duplicate_message_id and approval_not_found: history is read after the run opens (so
 * it includes a turn that finished just before), and that run is then closed `failed`
 * with `bad_input`.
 */
export class TurnInputError extends Error {
  constructor(readonly code: TurnInputErrorCode) {
    super(`agent: turn input rejected (${code})`);
    this.name = "TurnInputError";
  }
}

// The client's message id (route Task 0.13: 1 to 64 characters).
const MESSAGE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Why the loop itself stopped the turn early; null when it ran to its own end. */
type StopReason = "over_budget" | "charge_failed" | "wall_clock";

type FinalStatus = "done" | "failed" | "aborted" | "over_budget";

/** The run's final status and short error code (agent_runs.error, 64 characters or fewer). */
export function turnOutcome(o: { stopReason: StopReason | null; modelError: boolean }): {
  run: { status: FinalStatus; error?: string };
  message: MessageStatus;
} {
  if (o.stopReason === "over_budget") return { run: { status: "over_budget", error: "over_budget" }, message: "failed" };
  if (o.stopReason === "charge_failed") return { run: { status: "failed", error: "charge_failed" }, message: "failed" };
  if (o.stopReason === "wall_clock") return { run: { status: "aborted", error: "wall_clock" }, message: "failed" };
  if (o.modelError) return { run: { status: "failed", error: "model_error" }, message: "failed" };
  return { run: { status: "done" }, message: "complete" };
}

/** A provider token count as a whole non-negative number (chargeStep rejects anything else). */
function wholeTokens(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), Number.MAX_SAFE_INTEGER);
}

function errorName(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}

const ATTACHED_NAME_MAX = 120;
// Quotes, control and bidi-override characters in a filename become spaces, so a name
// cannot close its own quotes or reorder the note.
const UNSAFE_NAME_CHARS = /["\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

/** The fixed note that names the message's attached documents for the model (Task 1.20). */
export function attachmentNote(docs: ReadonlyArray<Pick<DocumentMeta, "id" | "filename">>): string {
  const names = docs.map((d) => {
    const flat = d.filename.replace(UNSAFE_NAME_CHARS, " ").replace(/\s+/g, " ").trim();
    const name = Array.from(flat).slice(0, ATTACHED_NAME_MAX).join("");
    return `"${name}" (document id ${d.id})`;
  });
  return `Attached files, readable with read_document: ${names.join("; ")}.`;
}

/**
 * Checks the input and builds the user message from its text, plus a fixed note naming
 * the attached documents. Each document id must be one of the caller's own documents
 * (read under RLS); the note carries only ids and filenames, never document text. The
 * text cap is the route's (AGENT_TEXT_MAX, 8,000 characters), enforced here too for any
 * other caller.
 */
async function userMessageFrom(userId: string, input: Extract<TurnInput, { kind: "message" }>): Promise<AgentUIMessage> {
  if (!MESSAGE_ID_RE.test(input.id)) throw new TurnInputError("bad_message_id");
  if (input.text.trim() === "") throw new TurnInputError("empty_text");
  if (input.text.length > AGENT_TEXT_MAX) throw new TurnInputError("text_too_long");
  const ids = [...new Set(input.documentIds)];
  if (ids.length > AGENT_DOCUMENTS_MAX) throw new TurnInputError("too_many_documents");
  const parts: AgentUIMessage["parts"] = [{ type: "text", text: input.text }];
  if (ids.length > 0) {
    const mine = new Map((await listDocuments(userId)).map((d) => [d.id, d]));
    const attached = ids.map((id) => mine.get(id));
    if (attached.some((d) => d === undefined)) throw new TurnInputError("unknown_document");
    parts.push({ type: "text", text: attachmentNote(attached.filter((d): d is DocumentMeta => d !== undefined)) });
  }
  return { id: input.id, role: "user", parts };
}

/** What the model reads for a denied approval (the SDK passes it as the tool result). */
export const APPROVAL_DENIED_REASON =
  "The user declined this action. Do not call this tool again for the same request unless the user asks for it.";

/**
 * Patches the pending approval `approvalId` in the thread's last assistant message to
 * `approval-responded`. Only an approval tool's part counts. Null when the last message
 * holds no such pending part (already answered, superseded by a newer message, or never
 * there), so a stale or forged approval id never reaches the model.
 */
export function patchApproval(
  history: AgentUIMessage[],
  approvalId: string,
  approved: boolean,
): { history: AgentUIMessage[]; assistant: AgentUIMessage } | null {
  const last = history.at(-1);
  if (!last || last.role !== "assistant") return null;
  let found = false;
  const parts = last.parts.map((part): AgentUIMessage["parts"][number] => {
    if (found || !isToolUIPart(part) || part.state !== "approval-requested" || part.approval.id !== approvalId) return part;
    if (!Object.prototype.hasOwnProperty.call(TOOL_APPROVAL, getToolName(part))) return part;
    found = true;
    return {
      ...part,
      state: "approval-responded",
      approval: approved ? { ...part.approval, approved: true } : { ...part.approval, approved: false, reason: APPROVAL_DENIED_REASON },
    };
  });
  if (!found) return null;
  const assistant: AgentUIMessage = { id: last.id, role: "assistant", parts };
  return { history: [...history.slice(0, -1), assistant], assistant };
}

/**
 * The history the model sees (AGENT_LIMITS.historyMaxMessages and historyMaxChars): the
 * newest messages that fit both caps, then cut to start at a user message, so the
 * window never opens on a reply to a question it no longer holds.
 */
export function historyWindow(history: AgentUIMessage[]): AgentUIMessage[] {
  let chars = 0;
  let start = history.length;
  while (start > 0 && history.length - start < AGENT_LIMITS.historyMaxMessages) {
    const size = JSON.stringify(history[start - 1].parts).length;
    if (chars + size > AGENT_LIMITS.historyMaxChars) break;
    chars += size;
    start -= 1;
  }
  while (start < history.length && history[start].role !== "user") start += 1;
  return history.slice(start);
}

// The pause before the one retry of a failed finishRun.
export const FINISH_RETRY_MS = 200;

/**
 * Closes the run, retrying once after a short pause (PR C batch 4 review M7). A run left
 * `running` holds the thread's one live-run slot, so the user would get 409 until the
 * stale rule (AGENT_LIMITS.staleTurnMs) fires. finishRun is idempotent (it updates only
 * a row still `running`), so the retry cannot change a run that the first call closed.
 * Never throws: a second failure is logged and left to the stale rule.
 */
async function closeRun(userId: string, runId: string, final: Parameters<typeof finishRun>[2]): Promise<void> {
  try {
    await finishRun(userId, runId, final);
    return;
  } catch (first) {
    console.warn("agent: finishRun failed; retrying once", errorName(first));
  }
  await new Promise((resolve) => setTimeout(resolve, FINISH_RETRY_MS));
  try {
    await finishRun(userId, runId, final);
  } catch (second) {
    console.error("agent: finishRun failed twice; the stale rule will close the run", errorName(second));
  }
}

/** The profile for the instructions; null when the read failed (getProfileSummary itself never returns null). */
async function loadProfile(base: Omit<ToolCtx, "gathered" | "repairsLeft">): Promise<ProfileSummary | null> {
  try {
    return await getProfileSummary({ ...base, gathered: emptyGathered(), repairsLeft: { n: 0 } });
  } catch (e) {
    // A profile is context, not a requirement: the turn goes on, and the instructions
    // say the profile could not be read (not that there is none).
    console.warn("agent: profile read failed; instructions say it could not be read", errorName(e));
    return null;
  }
}

/**
 * The compiled memo for the instructions (compileMemo: the memo's sections only, so no
 * EEO field); null when there is none or the read failed. A memo is context, not a
 * requirement, so a failed read never stops the turn.
 */
async function loadMemoText(userId: string): Promise<string | null> {
  try {
    const memo = await getMemo(userId);
    return memo ? compileMemo(memo.doc) : null;
  } catch (e) {
    console.warn("agent: memo read failed; instructions go without it", errorName(e));
    return null;
  }
}

type TurnArgs = {
  userId: string;
  email: string | null;
  thread: AgentThread;
  input: TurnInput;
  model?: LanguageModel;
  tools?: typeof buildTools;
};

export async function streamAgentTurn(a: TurnArgs): Promise<Response> {
  // The whole turn runs inside the trace context, so the model, tool and step spans
  // (including those that end after this returns) carry the thread and variant.
  return withAgentTrace(
    { userId: a.userId, threadId: a.thread.id, variant: a.thread.variant, runKind: "interactive" },
    () => runTurn(a),
  );
}

async function runTurn(a: TurnArgs): Promise<Response> {
  const { userId, thread } = a;
  const model = a.model ?? agentModel();
  const modelId = typeof model === "string" ? model : (model.modelId ?? AGENT_MODEL_DEFAULT);

  // Checked before startRun, so a refused input writes nothing.
  let start: { kind: "message"; message: AgentUIMessage } | { kind: "approval"; approvalId: string; approved: boolean };
  if (a.input.kind === "approval") {
    if (approvalSecret() === null) throw new TurnInputError("approval_unavailable");
    start = { kind: "approval", approvalId: a.input.approvalId, approved: a.input.approved };
  } else {
    start = { kind: "message", message: await userMessageFrom(userId, a.input) };
  }

  const runId = await startRun(userId, { threadId: thread.id, kind: "interactive", model: modelId, variant: thread.variant });

  // History is read only once this turn holds the thread's one live run, so it includes
  // a turn that finished just before (PR C batch 3 review M2).
  let history: AgentUIMessage[];
  try {
    history = await loadMessages(userId, thread.id);
  } catch (e) {
    console.error("agent: history read failed", errorName(e));
    await closeRun(userId, runId, { status: "failed", error: "setup_failed" });
    throw e;
  }
  // One id for the placeholder row, both UI streams and the final save: they are one row.
  // An approval continues the assistant message that asked for it, so its id and its
  // parts so far are the placeholder.
  let originalMessages: AgentUIMessage[];
  let placeholder: AgentUIMessage;
  // The whole thread as of this turn, for the summary (originalMessages is the window).
  let fullHistory: AgentUIMessage[];
  if (start.kind === "approval") {
    const patched = patchApproval(history, start.approvalId, start.approved);
    if (!patched) {
      await closeRun(userId, runId, { status: "failed", error: "bad_input" });
      throw new TurnInputError("approval_not_found");
    }
    const window = historyWindow(patched.history);
    originalMessages = window.at(-1)?.id === patched.assistant.id ? window : [patched.assistant];
    placeholder = patched.assistant;
    fullHistory = patched.history;
  } else {
    const userMessage = start.message;
    if (history.some((m) => m.id === userMessage.id)) {
      await closeRun(userId, runId, { status: "failed", error: "bad_input" });
      throw new TurnInputError("duplicate_message_id");
    }
    originalMessages = [...historyWindow(history), userMessage];
    fullHistory = [...history, userMessage];
    placeholder = { id: createIdGenerator({ prefix: "msg", size: 16 })(), role: "assistant", parts: [] };
  }
  const assistantId = placeholder.id;
  // A turn that never reached the model leaves the thread as it was: an approval's
  // message goes back to waiting with its stored status (so the user can answer again),
  // a new turn's placeholder is closed `failed`.
  const waiting = start.kind === "approval" ? history.at(-1) : undefined;
  const waitingStatus = z.object({ status: z.enum(MESSAGE_STATUSES) }).safeParse(waiting?.metadata);
  const undoPlaceholder = () =>
    (waiting
      ? saveMessages(userId, thread.id, [{ id: waiting.id, role: waiting.role, parts: waiting.parts }], waitingStatus.success ? waitingStatus.data.status : "complete")
      : saveMessages(userId, thread.id, [{ id: assistantId, role: "assistant", parts: [] }], "failed")
    ).catch(() => {});
  try {
    if (start.kind === "message") await saveMessages(userId, thread.id, [start.message], "complete");
    await saveMessages(userId, thread.id, [placeholder], "pending");
  } catch (e) {
    await closeRun(userId, runId, { status: "failed", error: "persist_failed" });
    throw e;
  }

  const base = {
    userId,
    email: a.email,
    threadId: thread.id,
    runId,
    variant: thread.variant,
    unattended: false,
  };
  let instructions: string;
  let tools: ReturnType<typeof buildTools>;
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;

  let stopReason: StopReason | null = null;
  let modelError = false;
  const controller = new AbortController();
  const stop = (reason: StopReason) => {
    if (stopReason === null) stopReason = reason;
    controller.abort(reason);
  };
  const charges: Promise<void>[] = [];
  // The wall clock starts before the setup, so the summary call counts against the
  // turn's time (PR I3b review I2). Every path below clears it.
  const timer = setTimeout(() => stop("wall_clock"), AGENT_LIMITS.wallClockMs);

  try {
    // The stable prefix (Task 1.21): fixed rules, then the profile summary, then the
    // compiled memo; the tool definitions follow in the request.
    const [clock, profile, memoText] = await Promise.all([catalogNow(), loadProfile(base), loadMemoText(userId)]);
    instructions = buildInstructions({
      profile,
      memoText,
      variant: thread.variant,
      clock: { frozen: clock.frozen },
      unattended: false,
    });
    const ctx: ToolCtx = { ...base, gathered: emptyGathered(), repairsLeft: { n: 1 } };
    tools = (a.tools ?? buildTools)(ctx);
    // A long thread goes as its summary plus the newest messages. When it is short, or
    // the summary call failed or timed out (the same array comes back), the plain
    // window goes. A refused or failed charge for the summary stops the turn before its
    // first step (the controller is already aborted when streamText starts).
    const summarized = await summarizeIfLong(userId, thread, fullHistory, {
      runId,
      model,
      modelId,
      onStop: stop,
      abortSignal: controller.signal,
    });
    const sent = summarized === fullHistory ? originalMessages : summarized;
    // A turn cut short (wall clock, provider drop) can be stored with a tool call that
    // never got its result; replayed as is, the SDK refuses the whole prompt
    // (MissingToolResultsError) and the thread could never answer again. Such calls are
    // dropped; the text around them is kept (PR C batch 3 review I1).
    modelMessages = await convertToModelMessages(sent, { ignoreIncompleteToolCalls: true });
  } catch (e) {
    // Nothing reached the model: close the run and the placeholder, then let the route
    // answer 500.
    console.error("agent: turn setup failed", errorName(e));
    clearTimeout(timer);
    controller.abort("setup_failed");
    await undoPlaceholder();
    await closeRun(userId, runId, { status: "failed", error: "setup_failed" });
    throw e;
  }

  // Stopped during setup (the summary's charge was refused or failed, or the wall clock
  // ran out during the summary): no model step starts. streamText would still call the
  // model with an aborted signal, so it is not called at all.
  if (stopReason !== null) {
    clearTimeout(timer);
    const outcome = turnOutcome({ stopReason, modelError });
    await saveMessages(userId, thread.id, [{ id: assistantId, role: "assistant", parts: placeholder.parts }], outcome.message).catch(
      (e: unknown) => console.error("agent: closing the placeholder failed", errorName(e)),
    );
    await closeRun(userId, runId, outcome.run);
    return createUIMessageStreamResponse({ stream: errorOnlyStream() });
  }

  // Everything from here to the return runs with the run open. A synchronous throw
  // (streamText, a UI stream) closes the run and the placeholder instead of leaving
  // them live until the stale-turn rule (PR C batch 3 review M3). Persistence starts
  // only once both streams exist, so it never races this cleanup.
  try {
    const result = streamText({
      model,
      instructions,
      messages: modelMessages,
      tools,
      // toolApproval and the signing secret, or nothing when the secret is missing.
      ...approvalStreamOptions(base),
      // The second condition: onStepEnd has stopped the turn (over budget, a failed
      // charge, the wall clock), so no further step starts even before the abort lands.
      // The third: the turn ends at an ask_user call, whose answers come next turn.
      stopWhen: [isStepCount(AGENT_LIMITS.maxSteps), () => stopReason !== null, hasToolCall("ask_user")],
      maxOutputTokens: AGENT_LIMITS.maxOutputTokens,
      abortSignal: controller.signal,
      telemetry: { functionId: "agent-turn" },
      onEnd: async () => {
        await flushLangfuseTraces();
      },
      onStepEnd: (step) => {
        const charge = (async () => {
          try {
            const charged = await chargeStep(userId, runId, {
              costMicros: stepCostMicros(step, modelId),
              inputTokens: wholeTokens(step.usage.inputTokens),
              outputTokens: wholeTokens(step.usage.outputTokens),
            });
            if (!charged.ok) stop("over_budget");
          } catch (e) {
            // chargeStep already retried once on a lock or statement timeout.
            console.error("agent: chargeStep failed; stopping the turn", errorName(e));
            stop("charge_failed");
          }
        })();
        charges.push(charge);
        return charge;
      },
      onError: ({ error }) => {
        modelError = true;
        console.warn("agent: model stream error", errorName(error));
      },
    });
    void result.consumeStream({ onError: () => {} });

    // Server-side copy of the UI stream, read only by persistence. Created now so the
    // replayed model stream buffers for it from the first chunk.
    const persistStream = toUIMessageStream({
      stream: result.stream,
      originalMessages,
      generateMessageId: () => assistantId,
      onError: () => "error",
    });

    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages,
        generateMessageId: () => assistantId,
        onError: () => "The assistant hit an error.",
      }),
    });

    const persisting = persistTurn({
      userId,
      threadId: thread.id,
      runId,
      placeholder,
      steps: result.steps,
      persistStream,
      outcome: () => turnOutcome({ stopReason, modelError }),
      noteModelError: () => {
        modelError = true;
      },
      charges,
      timer,
    });
    try {
      after(persisting);
    } catch (e) {
      // after() throws outside a Next request scope (an eval harness, a script). The
      // persistence promise is already running; it just is not tied to a request.
      console.warn("agent: after() unavailable; persisting without it", errorName(e));
    }
    return response;
  } catch (e) {
    clearTimeout(timer);
    controller.abort("setup_failed");
    console.error("agent: starting the stream failed", errorName(e));
    await undoPlaceholder();
    await closeRun(userId, runId, { status: "failed", error: "setup_failed" });
    throw e;
  }
}

/**
 * The assistant message the stream built: its last snapshot, with the turn's id. It
 * starts from the placeholder, so an approval's turn continues the message that asked
 * (the tool part the stream updates is already in it).
 */
/** A UI stream that carries only the fixed error line, for a turn stopped before its first step. */
function errorOnlyStream(): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "error", errorText: "The assistant hit an error." });
      controller.close();
    },
  });
}

async function finalAssistantMessage(stream: ReadableStream<UIMessageChunk>, placeholder: AgentUIMessage): Promise<AgentUIMessage> {
  let last: UIMessage = placeholder;
  for await (const m of readUIMessageStream({ stream, message: structuredClone(placeholder), onError: () => {} })) last = m;
  return { id: placeholder.id, role: "assistant", parts: last.parts };
}

async function persistTurn(p: {
  userId: string;
  threadId: string;
  runId: string;
  placeholder: AgentUIMessage;
  steps: PromiseLike<ReadonlyArray<{ finishReason: string }>>;
  persistStream: ReadableStream<UIMessageChunk>;
  outcome: () => ReturnType<typeof turnOutcome>;
  noteModelError: () => void;
  charges: Promise<void>[];
  timer: ReturnType<typeof setTimeout>;
}): Promise<void> {
  let assistant: AgentUIMessage = { id: p.placeholder.id, role: "assistant", parts: p.placeholder.parts };
  try {
    try {
      const steps = await p.steps;
      if (steps.at(-1)?.finishReason === "error") p.noteModelError();
    } catch (e) {
      p.noteModelError();
      console.warn("agent: the turn ended without its steps", errorName(e));
    }
    assistant = await finalAssistantMessage(p.persistStream, p.placeholder);
  } catch (e) {
    p.noteModelError();
    console.warn("agent: reading the turn's messages failed", errorName(e));
  } finally {
    clearTimeout(p.timer);
  }
  // Every step's charge lands before the run is closed.
  await Promise.allSettled(p.charges);

  const outcome = p.outcome();
  let final = outcome.run;
  try {
    await saveMessages(p.userId, p.threadId, [assistant], outcome.message);
  } catch (e) {
    console.error("agent: saving the turn failed", errorName(e));
    final = { status: "failed", error: "persist_failed" };
    // Keep what the user read and close the placeholder: the text parts alone, which
    // always pass the stored-message schema, saved `failed` (PR C batch 3 review M4).
    const textOnly: AgentUIMessage = {
      id: p.placeholder.id,
      role: "assistant",
      parts: assistant.parts.flatMap((part) => (part.type === "text" ? [{ type: "text" as const, text: part.text }] : [])),
    };
    await saveMessages(p.userId, p.threadId, [textOnly], "failed").catch((err: unknown) =>
      console.error("agent: the text-only fallback save failed too", errorName(err)),
    );
  }
  await closeRun(p.userId, p.runId, final);
  // Spans that ended after streamText's onEnd (an aborted turn, the outer spans).
  await flushLangfuseTraces();
}
