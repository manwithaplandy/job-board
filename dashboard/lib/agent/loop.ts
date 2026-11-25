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
import { after } from "next/server";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
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
import { AGENT_TEXT_MAX } from "@/lib/agent/request";
import { stepCostMicros } from "@/lib/agent/budget";
import { buildInstructions } from "@/lib/agent/context";
import { emptyGathered } from "@/lib/agent/gathered";
import type { AgentUIMessage, MessageStatus } from "@/lib/agent/messageCodec";
import { agentModel } from "@/lib/agent/provider";
import { chargeStep, finishRun, saveMessages, startRun } from "@/lib/agent/runs";
import type { AgentThread } from "@/lib/agent/threads";
import { loadMessages } from "@/lib/agent/threads";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import { getProfileSummary } from "@/lib/agent/tools/read";
import { withAgentTrace } from "@/lib/agent/telemetry";
import type { ProfileSummary } from "@/lib/workspaces/types";

export type TurnInput =
  | { kind: "message"; id: string; text: string; documentIds: string[] }
  | { kind: "approval"; approvalId: string; approved: boolean };

export type TurnInputErrorCode =
  | "approval_unsupported"
  | "documents_unsupported"
  | "bad_message_id"
  | "duplicate_message_id"
  | "empty_text"
  | "text_too_long";

/**
 * The input cannot start a turn. Thrown before startRun, so nothing is written, except
 * duplicate_message_id: history is read after the run opens (so it includes a turn that
 * finished just before), and that run is then closed `failed` with `bad_input`.
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

/**
 * Checks the input and builds the user message from its text alone. The text cap is the
 * route's (AGENT_TEXT_MAX, 8,000 characters), enforced here too for any other caller.
 */
function userMessageFrom(input: TurnInput): AgentUIMessage {
  if (input.kind === "approval") throw new TurnInputError("approval_unsupported");
  // Phase 0 has no documents table; Task 1.x adds document attachments.
  if (input.documentIds.length > 0) throw new TurnInputError("documents_unsupported");
  if (!MESSAGE_ID_RE.test(input.id)) throw new TurnInputError("bad_message_id");
  if (input.text.trim() === "") throw new TurnInputError("empty_text");
  if (input.text.length > AGENT_TEXT_MAX) throw new TurnInputError("text_too_long");
  return { id: input.id, role: "user", parts: [{ type: "text", text: input.text }] };
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

  const userMessage = userMessageFrom(a.input);

  const runId = await startRun(userId, { threadId: thread.id, kind: "interactive", model: modelId, variant: thread.variant });

  // History is read only once this turn holds the thread's one live run, so it includes
  // a turn that finished just before (PR C batch 3 review M2).
  let history: AgentUIMessage[];
  try {
    history = await loadMessages(userId, thread.id);
  } catch (e) {
    console.error("agent: history read failed", errorName(e));
    await finishRun(userId, runId, { status: "failed", error: "setup_failed" }).catch(() => {});
    throw e;
  }
  if (history.some((m) => m.id === userMessage.id)) {
    await finishRun(userId, runId, { status: "failed", error: "bad_input" }).catch(() => {});
    throw new TurnInputError("duplicate_message_id");
  }
  const originalMessages: AgentUIMessage[] = [...historyWindow(history), userMessage];

  // One id for the placeholder row, both UI streams and the final save: they are one row.
  const assistantId = createIdGenerator({ prefix: "msg", size: 16 })();
  try {
    await saveMessages(userId, thread.id, [userMessage], "complete");
    await saveMessages(userId, thread.id, [{ id: assistantId, role: "assistant", parts: [] }], "pending");
  } catch (e) {
    await finishRun(userId, runId, { status: "failed", error: "persist_failed" }).catch(() => {});
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
  try {
    const [clock, profile] = await Promise.all([catalogNow(), loadProfile(base)]);
    instructions = buildInstructions({
      profile,
      memoText: null,
      variant: thread.variant,
      clock: { frozen: clock.frozen },
      unattended: false,
    });
    const ctx: ToolCtx = { ...base, gathered: emptyGathered(), repairsLeft: { n: 1 } };
    tools = (a.tools ?? buildTools)(ctx);
    // A turn cut short (wall clock, provider drop) can be stored with a tool call that
    // never got its result; replayed as is, the SDK refuses the whole prompt
    // (MissingToolResultsError) and the thread could never answer again. Such calls are
    // dropped; the text around them is kept (PR C batch 3 review I1).
    modelMessages = await convertToModelMessages(originalMessages, { ignoreIncompleteToolCalls: true });
  } catch (e) {
    // Nothing reached the model: close the run and the placeholder, then let the route
    // answer 500.
    console.error("agent: turn setup failed", errorName(e));
    await saveMessages(userId, thread.id, [{ id: assistantId, role: "assistant", parts: [] }], "failed").catch(() => {});
    await finishRun(userId, runId, { status: "failed", error: "setup_failed" }).catch(() => {});
    throw e;
  }

  let stopReason: StopReason | null = null;
  let modelError = false;
  const controller = new AbortController();
  const stop = (reason: StopReason) => {
    if (stopReason === null) stopReason = reason;
    controller.abort(reason);
  };
  const charges: Promise<void>[] = [];
  const timer = setTimeout(() => stop("wall_clock"), AGENT_LIMITS.wallClockMs);

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
      // The second condition: onStepEnd has stopped the turn (over budget, a failed
      // charge, the wall clock), so no further step starts even before the abort lands.
      stopWhen: [isStepCount(AGENT_LIMITS.maxSteps), () => stopReason !== null],
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
      assistantId,
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
    await saveMessages(userId, thread.id, [{ id: assistantId, role: "assistant", parts: [] }], "failed").catch(() => {});
    await finishRun(userId, runId, { status: "failed", error: "setup_failed" }).catch(() => {});
    throw e;
  }
}

/** The assistant message the stream built: its last snapshot, with the turn's id. */
async function finalAssistantMessage(stream: ReadableStream<UIMessageChunk>, assistantId: string): Promise<AgentUIMessage> {
  let last: UIMessage = { id: assistantId, role: "assistant", parts: [] };
  for await (const m of readUIMessageStream({ stream, onError: () => {} })) last = m;
  return { id: assistantId, role: "assistant", parts: last.parts };
}

async function persistTurn(p: {
  userId: string;
  threadId: string;
  runId: string;
  assistantId: string;
  steps: PromiseLike<ReadonlyArray<{ finishReason: string }>>;
  persistStream: ReadableStream<UIMessageChunk>;
  outcome: () => ReturnType<typeof turnOutcome>;
  noteModelError: () => void;
  charges: Promise<void>[];
  timer: ReturnType<typeof setTimeout>;
}): Promise<void> {
  let assistant: AgentUIMessage = { id: p.assistantId, role: "assistant", parts: [] };
  try {
    try {
      const steps = await p.steps;
      if (steps.at(-1)?.finishReason === "error") p.noteModelError();
    } catch (e) {
      p.noteModelError();
      console.warn("agent: the turn ended without its steps", errorName(e));
    }
    assistant = await finalAssistantMessage(p.persistStream, p.assistantId);
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
      id: p.assistantId,
      role: "assistant",
      parts: assistant.parts.flatMap((part) => (part.type === "text" ? [{ type: "text" as const, text: part.text }] : [])),
    };
    await saveMessages(p.userId, p.threadId, [textOnly], "failed").catch((err: unknown) =>
      console.error("agent: the text-only fallback save failed too", errorName(err)),
    );
  }
  await finishRun(p.userId, p.runId, final).catch((err: unknown) => console.error("agent: finishRun failed", errorName(err)));
  // Spans that ended after streamText's onEnd (an aborted turn, the outer spans).
  await flushLangfuseTraces();
}
