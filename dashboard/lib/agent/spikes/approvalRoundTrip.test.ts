// Spike B (Task 0.3), part 2: the tool-approval round trip Task 1.16 uses.
//
// Permanent test. No network: MockLanguageModelV4. Every call sets
// experimental_toolApprovalSecret, because production always sets it and a signed
// approval could reject a server-side patch that an unsigned one accepts.
//
// The flow under test: turn 1 stops with the tool part at `approval-requested`
// (signed). The server patches the STORED part to `approval-responded` with the
// user's decision and runs turn 2 over the patched history.
//
// Result (2026-11-25, ai@7.0.163), recorded in the plan's Spike log: all four pass.
// The server-side patch of a signed approval part is accepted (the signature binds
// approval id, tool call id, tool name and input, not the approval state), so the
// primary path of Task 1.16 stands and its fallback is not needed.
import { expect, test, vi } from "vitest";
import { z } from "zod";
import {
  convertToModelMessages,
  InvalidToolApprovalSignatureError,
  isToolUIPart,
  simulateReadableStream,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";

const SECRET = "test-secret-32-bytes-minimum-len!";

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function streamingModel(chunks: LanguageModelV4StreamPart[]) {
  return new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks }) }) });
}

/** Turn 1's model: asks to archive job-1. */
const toolCallModel = () =>
  streamingModel([
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "call-1", toolName: "archiveJob", input: JSON.stringify({ jobId: "job-1" }) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
  ]);

/** Turn 2's model: answers in text after the tool step. */
const textModel = () =>
  streamingModel([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: "done" },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
  ]);

type Execute = (input: { jobId: string }) => Promise<{ archived: string }>;

type EndEvent = { messages: UIMessage[]; outcome: { status: string; error?: unknown } };

async function runTurn(model: MockLanguageModelV4, messages: UIMessage[], execute: Execute) {
  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    tools: { archiveJob: tool({ inputSchema: z.object({ jobId: z.string() }), execute }) },
    toolApproval: { archiveJob: "user-approval" },
    experimental_toolApprovalSecret: SECRET,
  });
  let saved: EndEvent | undefined;
  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: messages,
    generateMessageId: () => "a1",
    onEnd: (e) => {
      saved = e;
    },
    onError: (e) => String(e),
  });
  const chunkTypes: string[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunkTypes.push(r.value.type);
  if (!saved) throw new Error("onEnd did not fire");
  return { saved, chunkTypes };
}

function toolPart(message: UIMessage) {
  const part = message.parts.find((p) => p.type === "tool-archiveJob");
  if (!part || !isToolUIPart(part)) throw new Error("no archiveJob part");
  return part;
}

const user: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "archive job-1" }] };

/** Turn 1: returns the stored history, ending in the assistant message that waits. */
async function requestApproval(execute: Execute) {
  const { saved } = await runTurn(toolCallModel(), [user], execute);
  return saved.messages;
}

/** What the server does on the user's click: patch the stored part in place. */
function patchStoredApproval(
  history: UIMessage[],
  approved: boolean,
  alteredInput?: { jobId: string },
): UIMessage[] {
  const patched = structuredClone(history);
  const last = patched.at(-1)!;
  last.parts = last.parts.map((p) => {
    if (p.type !== "tool-archiveJob" || !isToolUIPart(p) || p.state !== "approval-requested") return p;
    const responded: UIMessage["parts"][number] = {
      ...p,
      state: "approval-responded",
      input: alteredInput ?? p.input,
      approval: { ...p.approval, approved },
    };
    return responded;
  });
  return patched;
}

test("a tool under toolApproval 'user-approval' stops at approval-requested", async () => {
  const execute = vi.fn<Execute>(async ({ jobId }) => ({ archived: jobId }));
  const history = await requestApproval(execute);
  const part = toolPart(history.at(-1)!);
  expect(part.state).toBe("approval-requested");
  expect(part.input).toEqual({ jobId: "job-1" });
  expect(part.approval?.signature).toEqual(expect.any(String));
  expect(execute).not.toHaveBeenCalled();
});

test("patching the stored part to approval-responded approved:true makes the next call execute the tool", async () => {
  const execute = vi.fn<Execute>(async ({ jobId }) => ({ archived: jobId }));
  const history = await requestApproval(execute);
  const { saved } = await runTurn(textModel(), patchStoredApproval(history, true), execute);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0][0]).toEqual({ jobId: "job-1" });
  const part = toolPart(saved.messages.at(-1)!);
  expect(part.state).toBe("output-available");
  expect(part.output).toEqual({ archived: "job-1" });
  expect(saved.outcome.status).toBe("completed");
});

test("approved:false yields output-denied and execute is never called", async () => {
  const execute = vi.fn<Execute>(async ({ jobId }) => ({ archived: jobId }));
  const history = await requestApproval(execute);
  const { saved } = await runTurn(textModel(), patchStoredApproval(history, false), execute);
  expect(execute).not.toHaveBeenCalled();
  expect(toolPart(saved.messages.at(-1)!).state).toBe("output-denied");
});

test("with the secret set, an approval part whose input was altered after signing is rejected", async () => {
  const execute = vi.fn<Execute>(async ({ jobId }) => ({ archived: jobId }));
  const history = await requestApproval(execute);
  const { saved, chunkTypes } = await runTurn(
    textModel(),
    patchStoredApproval(history, true, { jobId: "job-2" }),
    execute,
  );
  expect(execute).not.toHaveBeenCalled();
  expect(chunkTypes).toContain("error");
  expect(saved.outcome.status).toBe("failed");
  expect(InvalidToolApprovalSignatureError.isInstance(saved.outcome.error)).toBe(true);
});
