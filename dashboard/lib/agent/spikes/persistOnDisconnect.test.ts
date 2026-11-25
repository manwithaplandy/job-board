// Spike B (Task 0.3), part 1: does a turn persist when the client disconnects?
//
// Permanent test: it pins the AI SDK 7 behaviour Task 0.11 relies on. No network:
// the model is a MockLanguageModelV4 streaming five text deltas 20 ms apart.
//
// Result (2026-11-25, ai@7.0.163), recorded in the plan's Spike log:
// - toUIMessageStream's onEnd DOES fire after the client cancels the body, but at
//   the moment of the cancel, with `isCancelled: true` and only what had been
//   streamed so far. It never sees the full turn. So the plan's first fallback
//   applies: Task 0.11 persists from `await result.steps` inside `after()`, not
//   from onEnd, and keeps the pending-row hedge.
// - With `result.consumeStream()` the model stream keeps draining after the
//   cancel, the turn finishes, and `await result.steps` holds the full text.
// - Without it, nothing pulls the model stream after the cancel and the turn
//   stalls: the tail is never generated unless something later reads the result.
import { expect, test } from "vitest";
import {
  createUIMessageStreamResponse,
  simulateReadableStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";

const DELTAS = ["a", "b", "c", "d", "e"];
const CHUNK_DELAY_MS = 20;

function slowTextModel() {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    ...DELTAS.map((delta): LanguageModelV4StreamPart => ({ type: "text-delta", id: "t1", delta })),
    { type: "text-end", id: "t1" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
    },
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks, chunkDelayInMs: CHUNK_DELAY_MS }),
    }),
  });
}

const originalMessages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "say abcde" }] },
];

function textOf(message: UIMessage): string {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

type EndEvent = { messages: UIMessage[]; isCancelled?: true };

/** Starts a turn the way the chat route will, reads one chunk of the response body,
 *  then cancels it like a client that closed the tab. */
async function turnWithCancel({ consume }: { consume: boolean }) {
  let resolveTurnEnded!: (text: string) => void;
  const turnEnded = new Promise<string>((r) => (resolveTurnEnded = r));
  let turnEndedText: string | null = null;
  const result = streamText({
    model: slowTextModel(),
    prompt: "say abcde",
    onEnd: (e) => {
      turnEndedText = e.text;
      resolveTurnEnded(e.text);
    },
  });
  if (consume) void result.consumeStream();

  let resolveEnded!: (e: EndEvent) => void;
  const ended = new Promise<EndEvent>((r) => (resolveEnded = r));
  const res = createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages,
      generateMessageId: () => "a1",
      onEnd: (e) => resolveEnded(e),
    }),
  });
  const reader = res.body!.getReader();
  await reader.read();
  await reader.cancel();
  return { result, saved: await ended, turnEnded, turnEndedText: () => turnEndedText };
}

test("onEnd fires on the client cancel, but only with what was streamed before it", async () => {
  // The brief expected the full "abcde" here; the SDK calls onEnd at the cancel instead.
  const { saved } = await turnWithCancel({ consume: true });
  expect(saved.isCancelled).toBe(true);
  expect(textOf(saved.messages.at(-1)!)).not.toBe("abcde");
});

test("with consumeStream the turn finishes after the cancel and await result.steps holds it all", async () => {
  // The fallback Task 0.11 uses: persist from result.steps inside after().
  const { result, turnEnded } = await turnWithCancel({ consume: true });
  expect(await turnEnded).toBe("abcde");
  const steps = await result.steps;
  expect(steps.map((s) => s.text).join("")).toBe("abcde");
  expect((await result.response).messages.at(-1)).toMatchObject({
    role: "assistant",
    content: [{ type: "text", text: "abcde" }],
  });
});

test("without consumeStream the same cancel loses the tail: the turn stalls", async () => {
  const { result, turnEndedText } = await turnWithCancel({ consume: false });
  // Well past the time the whole stream needs (7 chunks x 20 ms).
  await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS * 15));
  expect(turnEndedText()).toBeNull();
  await result.consumeStream(); // drain so the test leaves nothing running
});
