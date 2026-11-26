// @vitest-environment jsdom
// The minimal agent page's chat (plan Task 0.14). fetch is stubbed: the route answers
// either a UI message stream or one of its JSON rejections.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createUIMessageStreamResponse, type UIMessage, type UIMessageChunk } from "ai";

const actions = vi.hoisted(() => ({
  renameThreadAction: vi.fn(),
  newThread: vi.fn(),
  describeFrameIntentAction: vi.fn(),
  reportSurfaceFailure: vi.fn(),
  setThreadVariantAction: vi.fn(),
  setDefaultVariantAction: vi.fn(),
}));
vi.mock("@/app/actions/agent", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
// The review indicator polls its own route; these tests count only /api/agent requests.
vi.mock("./ReviewProgress", () => ({ ReviewProgress: () => null }));

import {
  AgentChat,
  GENERIC_PROBLEM,
  PROVIDER_DOWN_PROBLEM,
  RATE_LIMITED_PROBLEM,
  UNAVAILABLE_PROBLEM,
  problemFromStreamError,
} from "./AgentChat";

const THREAD = "22222222-2222-4222-8222-222222222222";

function streamReply(text: string): Response {
  const chunks: UIMessageChunk[] = [
    { type: "start", messageId: "msg-reply" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish" },
  ];
  return createUIMessageStreamResponse({
    stream: new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    }),
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => streamReply("Here are two roles."));
  vi.stubGlobal("fetch", fetchMock);
  actions.renameThreadAction.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const composer = () => screen.getByLabelText(/Message/) as HTMLTextAreaElement;
const sendButton = () => screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;

function bodyOf(call: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

test("renders assistant text parts as plain text, never as HTML or links", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Show me a link" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [{ type: "text", text: "<a href=x>y</a>" }], metadata: { status: "complete" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(screen.getByText("<a href=x>y</a>")).toBeTruthy();
  expect(container.querySelector('a[href="x"]')).toBeNull();
  expect(container.querySelector(".rf-agent-transcript a")).toBeNull();
});

test("the transport body carries only threadId, kind, id, text", async () => {
  const history: UIMessage[] = [
    { id: "u0", role: "user", parts: [{ type: "text", text: "Earlier question" }], metadata: { status: "complete" } },
    { id: "a0", role: "assistant", parts: [{ type: "text", text: "Earlier answer" }], metadata: { status: "complete" } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={history} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Which roles fit best?" } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const body = bodyOf(0);
  expect(Object.keys(body).sort()).toEqual(["id", "kind", "text", "threadId"]);
  expect(body).toMatchObject({ threadId: THREAD, kind: "message", text: "Which roles fit best?" });
  expect(body.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/agent");
  await screen.findByText("Here are two roles.");
});

test("a 429 response shows the budget notice and keeps the composer disabled", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "agent_budget_exhausted", reason: "daily_ceiling" }, { status: 429 }));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "One more question" } });
  fireEvent.click(sendButton());
  await screen.findByText("Today's agent budget is used up");
  expect(composer().disabled).toBe(true);
  expect(sendButton().disabled).toBe(true);
  // The rejected text is not shown as sent, and every notice links to the workspaces.
  expect(screen.queryByText("One more question", { selector: ".rf-agent-message__text" })).toBeNull();
  expect(screen.getByRole("link", { name: "Board" }).getAttribute("href")).toBe("/");
});

test("a blocking notice from the page disables the composer before any send", () => {
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice="agent_disabled" />);
  expect(screen.getByText("The agent is switched off")).toBeTruthy();
  expect(composer().disabled).toBe(true);
  expect(screen.getByRole("link", { name: "Companies" }).getAttribute("href")).toBe("/companies");
});

test("a pending assistant message older than 300 s shows the interrupted notice with Retry", async () => {
  const old = new Date(Date.now() - 301_000).toISOString();
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "What did you review?" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [], metadata: { status: "pending", createdAt: old } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(screen.getByText("This reply was interrupted")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(bodyOf(0)).toEqual({ threadId: THREAD, kind: "retry", id: "u1" });
  await screen.findByText("Here are two roles.");
  expect(screen.getAllByText("What did you review?")).toHaveLength(1);
  expect(screen.queryByText("This reply was interrupted")).toBeNull();
});

test("a pending assistant message younger than 300 s is not interrupted", () => {
  const fresh = new Date(Date.now() - 10_000).toISOString();
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [], metadata: { status: "pending", createdAt: fresh } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(screen.queryByText("This reply was interrupted")).toBeNull();
});

test("Enter sends, Shift+Enter adds a line, empty text does not send", async () => {
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.keyDown(composer(), { key: "Enter" });
  fireEvent.change(composer(), { target: { value: "   " } });
  fireEvent.keyDown(composer(), { key: "Enter" });
  fireEvent.click(sendButton());
  fireEvent.change(composer(), { target: { value: "First line" } });
  fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });
  await act(async () => {});
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.keyDown(composer(), { key: "Enter" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(bodyOf(0)).toMatchObject({ text: "First line" });
  await waitFor(() => expect(composer().value).toBe(""));
});

const sentText = (text: string) => screen.queryByText(text, { selector: ".rf-agent-message__text" });

test("a 409 shows an inline Alert, takes the message back out and restores the draft", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "turn_in_progress" }, { status: 409 }));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Are you still there?" } });
  fireEvent.click(sendButton());
  await screen.findByText(/A reply is still being written in this conversation/);
  expect(sentText("Are you still there?")).toBeNull();
  expect(composer().value).toBe("Are you still there?");
  expect(composer().disabled).toBe(false);
});

test("a 404 shows an inline Alert and restores the draft", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "not_found" }, { status: 404 }));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Hello?" } });
  fireEvent.click(sendButton());
  await screen.findByText(/This conversation was not found/);
  expect(sentText("Hello?")).toBeNull();
  expect(composer().value).toBe("Hello?");
});

test("a 5xx keeps the user message (the server may have stored it) and shows the generic Alert", async () => {
  fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Which roles fit?" } });
  fireEvent.click(sendButton());
  await screen.findByText("The assistant could not answer just now. Try again.");
  expect(sentText("Which roles fit?")).toBeTruthy();
  expect(composer().value).toBe("");
});

test("an error mid-stream keeps the user message and shows the generic Alert", async () => {
  fetchMock.mockImplementation(async () =>
    createUIMessageStreamResponse({
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({ type: "start", messageId: "msg-reply" });
          controller.enqueue({ type: "error", errorText: "boom" });
          controller.close();
        },
      }),
    }),
  );
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Tell me more" } });
  fireEvent.click(sendButton());
  await screen.findByText("The assistant could not answer just now. Try again.");
  expect(sentText("Tell me more")).toBeTruthy();
  expect(composer().value).toBe("");
});

test("a thrown fetch (network error) takes the message back out and restores the draft", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Offline question" } });
  fireEvent.click(sendButton());
  await screen.findByText("The assistant could not answer just now. Try again.");
  await waitFor(() => expect(sentText("Offline question")).toBeNull());
  expect(composer().value).toBe("Offline question");
});

test("the transcript is not a token-by-token live region: it is marked busy while a reply streams", async () => {
  let release: () => void = () => {};
  fetchMock.mockImplementation(async () =>
    createUIMessageStreamResponse({
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({ type: "start", messageId: "msg-reply" });
          controller.enqueue({ type: "text-start", id: "t1" });
          controller.enqueue({ type: "text-delta", id: "t1", delta: "Partial" });
          release = () => {
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({ type: "finish" });
            controller.close();
          };
        },
      }),
    }),
  );
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Stream please" } });
  fireEvent.click(sendButton());
  await screen.findByText("Partial");
  const transcript = () => container.querySelector(".rf-agent-transcript");
  expect(transcript()?.getAttribute("aria-busy")).toBe("true");
  act(() => release());
  await waitFor(() => expect(transcript()?.getAttribute("aria-busy")).toBe("false"));
});

test("a pending reply turns into the interrupted notice once it passes 300 s, without a reload", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  try {
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }], metadata: { status: "complete" } },
      { id: "a1", role: "assistant", parts: [], metadata: { status: "pending", createdAt: "2026-11-25T11:55:10Z" } },
    ];
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    expect(screen.queryByText("This reply was interrupted")).toBeNull();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("This reply was interrupted")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

test("the first message of an untitled thread names the thread from its text", async () => {
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} autoTitle />);
  fireEvent.change(composer(), { target: { value: "  Find   remote ML roles  " } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(actions.renameThreadAction).toHaveBeenCalledWith(THREAD, "Find remote ML roles"));
});

function failedTurn(errorText: string): Response {
  return createUIMessageStreamResponse({
    stream: new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "start", messageId: "msg-failed" });
        controller.enqueue({ type: "error", errorText });
        controller.close();
      },
    }),
  });
}

test("a failed turn shows one inline error with Retry and no empty assistant bubble; Retry answers the same question again", async () => {
  fetchMock.mockImplementationOnce(async () => failedTurn("model_error:402"));
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Which roles fit?" } });
  fireEvent.click(sendButton());
  await screen.findByText(UNAVAILABLE_PROBLEM);
  expect(container.querySelectorAll(".rf-agent-message--assistant")).toHaveLength(0);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  // The draft typed meanwhile is kept by Retry.
  fireEvent.change(composer(), { target: { value: "half-typed" } });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  // The stored question is answered again by its id: no second copy, here or on the server.
  expect(bodyOf(1)).toEqual({ threadId: THREAD, kind: "retry", id: bodyOf(0).id });
  await screen.findByText("Here are two roles.");
  expect(screen.getAllByText("Which roles fit?")).toHaveLength(1);
  expect(screen.queryByText(UNAVAILABLE_PROBLEM)).toBeNull();
  expect(composer().value).toBe("half-typed");
});

test("a 429 from the provider reads as too many requests", async () => {
  fetchMock.mockImplementationOnce(async () => failedTurn("model_error:429"));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Again?" } });
  fireEvent.click(sendButton());
  await screen.findByText(RATE_LIMITED_PROBLEM);
});

test("the stream's error text maps to a fixed sentence; provider text is never shown", () => {
  expect(problemFromStreamError("model_error:401")).toBe(UNAVAILABLE_PROBLEM);
  expect(problemFromStreamError("model_error:403")).toBe(UNAVAILABLE_PROBLEM);
  expect(problemFromStreamError("model_error:503")).toBe(PROVIDER_DOWN_PROBLEM);
  expect(problemFromStreamError("model_error:400")).toBe(GENERIC_PROBLEM);
  expect(problemFromStreamError("model_error")).toBe(GENERIC_PROBLEM);
  expect(problemFromStreamError("Insufficient credits on key sk-or-v1-x")).toBe(GENERIC_PROBLEM);
});

test("a stored failed turn (a reload after the failure) shows no empty bubble, one interrupted line and Retry", async () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Any remote roles?" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [], metadata: { status: "failed" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(container.querySelectorAll(".rf-agent-message")).toHaveLength(1);
  expect(container.querySelectorAll(".rf-agent-message--assistant")).toHaveLength(0);
  expect(screen.getByText("This reply was interrupted")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(bodyOf(0)).toEqual({ threadId: THREAD, kind: "retry", id: "u1" });
});

test("a refused Retry keeps the question on screen and offers Retry again", async () => {
  fetchMock.mockImplementationOnce(async () => failedTurn("model_error:503"));
  fetchMock.mockImplementationOnce(async () => Response.json({ error: "turn_in_progress" }, { status: 409 }));
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Which roles fit?" } });
  fireEvent.click(sendButton());
  await screen.findByText(PROVIDER_DOWN_PROBLEM);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText(/A reply is still being written/);
  expect(screen.getAllByText("Which roles fit?")).toHaveLength(1);
  expect(composer().value).toBe("");
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
