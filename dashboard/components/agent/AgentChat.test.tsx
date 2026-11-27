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

test("renders assistant text as markdown, never as HTML or links; the user's text stays plain", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Show me **a link**" }], metadata: { status: "complete" } },
    {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "- **One** item\n- [a link](https://x.example)\n\n<a href=x>y</a>" }],
      metadata: { status: "complete" },
    },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(screen.getByText("Show me **a link**")).toBeTruthy();
  expect(container.querySelectorAll(".rf-md li")).toHaveLength(2);
  expect(container.querySelector(".rf-md strong")?.textContent).toBe("One");
  expect(container.querySelector('a[href="x"]')).toBeNull();
  expect(container.querySelector(".rf-agent-transcript a")).toBeNull();
  expect(container.querySelector(".rf-agent-transcript [href]")).toBeNull();
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

// The steps row and the assistant message chrome (spec 08 sections 4.2 and 7.2).
type Part = UIMessage["parts"][number];
let call = 0;
function toolPart(name: string, state = "output-available"): Part {
  call += 1;
  return { type: `tool-${name}`, toolCallId: `call-${call}`, state, input: {}, output: {} } as Part;
}
const stepsToggle = () => screen.getByRole("button", { name: /Worked through|Stopped after|Thinking|Searching/ });

test("a stored reply's tool calls fold into one steps row above the answer, with no tool lines", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    {
      id: "a1",
      role: "assistant",
      parts: [...Array.from({ length: 5 }, () => toolPart("search_jobs")), toolPart("get_job"), { type: "text", text: "Here they are." }],
      metadata: { status: "complete" },
    },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  const toggles = container.querySelectorAll(".rf-steps__toggle");
  expect(toggles).toHaveLength(1);
  expect(toggles[0].textContent).toContain("Worked through 6 steps");
  // The row comes before every part of the answer (the role label is visually hidden),
  // and no per-call tool line is drawn beside it: the message holds the row and the text.
  const message = container.querySelector(".rf-agent-message--assistant") as HTMLElement;
  const visible = [...message.children].filter((el) => !el.classList.contains("rf-agent-message__role"));
  expect(visible).toHaveLength(2);
  expect(visible[0].classList.contains("rf-steps")).toBe(true);
  expect(visible[1].classList.contains("rf-md")).toBe(true);
});

test("a text-only reply has no steps row", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hello." }], metadata: { status: "complete" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(container.querySelector(".rf-steps")).toBeNull();
  expect(screen.getByText("Hello.")).toBeTruthy();
});

test("ask_user's questions stay in the answer and are not counted as a step", () => {
  const ask = { type: "tool-ask_user", toolCallId: "ask-1", state: "output-available", input: { questions: [{ label: "Remote only?", options: ["Yes", "No"] }] }, output: {} } as Part;
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs"), ask], metadata: { status: "complete" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(stepsToggle().textContent).toContain("Worked through 1 step");
  expect(container.querySelector(".rf-agent-message__questions")?.textContent).toBe("Remote only? (Yes, No)");
});

test("a stored failed reply with two steps reads Stopped after 2 steps", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs"), toolPart("get_job")], metadata: { status: "failed" } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(stepsToggle().textContent).toContain("Stopped after 2 steps");
  expect(screen.getByText("This reply was interrupted")).toBeTruthy();
});

test("while a turn waits for its first part, a provisional reply holds the working row and its timer", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ working: { elapsedMs: 65_000 } }} />);
  const provisional = container.querySelectorAll(".rf-agent-message--assistant");
  expect(provisional).toHaveLength(1);
  expect(provisional[0].textContent).toContain("Thinking");
  expect(container.querySelector(".rf-steps__timer")?.textContent).toBe("1:05");
  // The row replaces the old dashed waiting line: nothing else in the chat says "Thinking".
  expect(screen.getAllByText(/Thinking/)).toHaveLength(1);
});

test("the working row names the running step of the last reply", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs", "input-available")], metadata: { status: "pending" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ working: { elapsedMs: 5_000 } }} />);
  expect(container.querySelectorAll(".rf-agent-message--assistant")).toHaveLength(1);
  expect(stepsToggle().textContent).toContain("Searching your reviewed jobs");
  expect(container.querySelector(".rf-steps__timer")?.textContent).toBe("0:05");
});

test("a live send shows the provisional working row until the reply arrives, then the reply alone", async () => {
  let release: () => void = () => {};
  fetchMock.mockImplementation(async () =>
    createUIMessageStreamResponse({
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          release = () => {
            controller.enqueue({ type: "start", messageId: "msg-reply" });
            controller.enqueue({ type: "text-start", id: "t1" });
            controller.enqueue({ type: "text-delta", id: "t1", delta: "Done." });
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({ type: "finish" });
            controller.close();
          };
        },
      }),
    }),
  );
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Go" } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(container.querySelector(".rf-steps__toggle")?.textContent).toContain("Thinking"));
  expect(container.querySelector(".rf-steps__timer")?.textContent).toMatch(/^0:0\d$/);
  act(() => release());
  await screen.findByText("Done.");
  await waitFor(() => expect(container.querySelector(".rf-steps")).toBeNull());
  expect(container.querySelectorAll(".rf-agent-message--assistant")).toHaveLength(1);
});

test("a click opens the steps panel and it stays open across a re-render", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs"), toolPart("search_jobs"), { type: "text", text: "Two." }], metadata: { status: "complete" } },
  ];
  const props = { threadId: THREAD, initialMessages: messages, notice: null };
  const { container, rerender } = render(<AgentChat {...props} />);
  const panel = () => container.querySelector(".rf-steps__panel") as HTMLElement;
  expect(panel().hidden).toBe(true);
  fireEvent.click(stepsToggle());
  expect(panel().hidden).toBe(false);
  expect(panel().textContent).toContain("Searched your reviewed jobs (2 times)");
  rerender(<AgentChat {...props} title="Renamed" />);
  expect(panel().hidden).toBe(false);
  expect(stepsToggle().getAttribute("aria-expanded")).toBe("true");
});

test("the fixture seam can open one message's steps on load", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs"), { type: "text", text: "One." }], metadata: { status: "complete" } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ openStepsFor: "a1" }} />);
  expect(stepsToggle().getAttribute("aria-expanded")).toBe("true");
});

test("a failed reply with no parts renders no list item", () => {
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [], metadata: { status: "failed" } },
  ];
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  expect(container.querySelectorAll(".rf-agent-transcript > li")).toHaveLength(1);
  expect(container.querySelector(".rf-steps")).toBeNull();
});

function toolThenError(): Response {
  return createUIMessageStreamResponse({
    stream: new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "start", messageId: "msg-tool-failed" });
        controller.enqueue({ type: "start-step" });
        controller.enqueue({ type: "tool-input-available", toolCallId: "t-1", toolName: "search_jobs", input: { query: "ml" } });
        controller.enqueue({ type: "error", errorText: "model_error:503" });
        controller.close();
      },
    }),
  });
}

test("a turn that fails after a tool call reads Stopped after 1 step, with no spinner left running", async () => {
  fetchMock.mockImplementationOnce(async () => toolThenError());
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Find ML roles" } });
  fireEvent.click(sendButton());
  await screen.findByText(PROVIDER_DOWN_PROBLEM);
  await waitFor(() => expect(stepsToggle().textContent).toContain("Stopped after 1 step"));
  fireEvent.click(stepsToggle());
  expect(container.querySelector(".rf-steps__panel")?.textContent).toContain("Searched your reviewed jobs");
  expect(container.querySelector(".rf-steps__spinner")).toBeNull();
});

test("the failed reply stays stopped after the next turn answers", async () => {
  fetchMock.mockImplementationOnce(async () => toolThenError());
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Find ML roles" } });
  fireEvent.click(sendButton());
  await screen.findByText(PROVIDER_DOWN_PROBLEM);
  fireEvent.change(composer(), { target: { value: "Something else" } });
  fireEvent.click(sendButton());
  await screen.findByText("Here are two roles.");
  await waitFor(() => expect(container.querySelector(".rf-steps--working")).toBeNull());
  expect(container.querySelectorAll(".rf-steps")).toHaveLength(1);
  expect(stepsToggle().textContent).toContain("Stopped after 1 step");
});

test("a refused send leaves the earlier finished reply reading done", async () => {
  fetchMock.mockImplementationOnce(async () => Response.json({ error: "turn_in_progress" }, { status: 409 }));
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Find roles" }], metadata: { status: "complete" } },
    { id: "a1", role: "assistant", parts: [toolPart("search_jobs"), { type: "text", text: "One." }], metadata: { status: "complete" } },
  ];
  render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Again" } });
  fireEvent.click(sendButton());
  await screen.findByText(/A reply is still being written/);
  expect(stepsToggle().textContent).toContain("Worked through 1 step");
});
