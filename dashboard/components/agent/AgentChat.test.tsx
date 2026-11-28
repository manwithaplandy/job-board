// @vitest-environment jsdom
// The minimal agent page's chat (plan Task 0.14). fetch is stubbed: the route answers
// either a UI message stream or one of its JSON rejections.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createUIMessageStreamResponse, type UIMessage, type UIMessageChunk } from "ai";

const actions = vi.hoisted(() => ({
  renameThreadAction: vi.fn(),
  newThread: vi.fn(),
  describeFrameIntentAction: vi.fn(),
  reportSurfaceFailure: vi.fn(),
  setThreadVariantAction: vi.fn(),
  setDefaultVariantAction: vi.fn(),
  loadSurfaceAction: vi.fn(),
  describeApprovalAction: vi.fn(),
}));
vi.mock("@/app/actions/agent", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
// The review indicator polls its own route; these tests count only /api/agent requests.
vi.mock("./ReviewProgress", () => ({ ReviewProgress: () => null }));
// The real SurfaceHost, which also records the view host its frame hands it, by surface id,
// so a test can send the in-frame Escape a sandbox frame would send (spec 08 S6.3).
const viewHosts = vi.hoisted(() => new Map<string, { onEscape: () => void }>());
vi.mock("./SurfaceHost", async (importOriginal) => {
  const real = await importOriginal<typeof import("./SurfaceHost")>();
  const { createElement, useContext } = await import("react");
  const { ViewHostContext } = await import("./ViewHostContext");
  function SurfaceHost(props: Parameters<typeof real.SurfaceHost>[0]) {
    const host = useContext(ViewHostContext);
    if (host) viewHosts.set(props.surface.id, host);
    return createElement(real.SurfaceHost, props);
  }
  return { ...real, SurfaceHost };
});

import {
  AgentChat,
  GENERIC_PROBLEM,
  PROVIDER_DOWN_PROBLEM,
  RATE_LIMITED_PROBLEM,
  UNAVAILABLE_PROBLEM,
  problemFromStreamError,
} from "./AgentChat";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { gatheredFixture } from "@/lib/agent/surfaces/v1/testFixtures";
import { sandboxChain, SURFACE_FAILED_TEXT } from "./SurfaceHost";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { VIEW_LOAD_FAILED_TEXT, ViewUpdatedStub } from "./ViewPlaceholder";
import { CONFIRMATIONS_UNAVAILABLE } from "@/lib/agent/approvalSecret";
import type { ConfirmDescriptor } from "@/lib/agent/actions/intents";

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

test("a successful Retry of a failed reply reads done, though the server reuses the reply's id", async () => {
  fetchMock.mockImplementationOnce(async () => toolThenError());
  fetchMock.mockImplementationOnce(async () =>
    createUIMessageStreamResponse({
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          // The retried reply streams in under the failed reply's id (lib/agent/loop.ts).
          controller.enqueue({ type: "start", messageId: "msg-tool-failed" });
          controller.enqueue({ type: "start-step" });
          controller.enqueue({ type: "tool-input-available", toolCallId: "t-2", toolName: "search_jobs", input: { query: "ml" } });
          controller.enqueue({ type: "tool-output-available", toolCallId: "t-2", output: { jobs: [] } });
          controller.enqueue({ type: "finish-step" });
          controller.enqueue({ type: "start-step" });
          controller.enqueue({ type: "text-start", id: "t1" });
          controller.enqueue({ type: "text-delta", id: "t1", delta: "Found them." });
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({ type: "finish-step" });
          controller.enqueue({ type: "finish" });
          controller.close();
        },
      }),
    }),
  );
  const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
  fireEvent.change(composer(), { target: { value: "Find ML roles" } });
  fireEvent.click(sendButton());
  await screen.findByText(PROVIDER_DOWN_PROBLEM);
  await waitFor(() => expect(stepsToggle().textContent).toContain("Stopped after 1 step"));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Found them.");
  await waitFor(() => expect(container.querySelector(".rf-steps--working")).toBeNull());
  expect(container.querySelectorAll(".rf-steps")).toHaveLength(1);
  expect(stepsToggle().textContent).toContain("Worked through 1 step");
});


// PR 2 Task 2.4: views render inline at their present part (spec 08 S4.1, S7.3, S11); the
// surface column is gone.
const V1 = "aaaaaaaa-0000-4000-8000-0000000000a1";
const V2 = "aaaaaaaa-0000-4000-8000-0000000000a2";
const V3 = "aaaaaaaa-0000-4000-8000-0000000000a3";

function hostSurface(id: string, title: string, supersedes: string | null = null): HostSurface {
  return {
    id,
    threadId: THREAD,
    supersedes,
    rerenderOf: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    variant: 1,
    view: { kind: "blocks" },
    payload: { variant: 1, title, blocks: [{ type: "Callout", tone: "info", text: `${title} body` }] },
    gathered: gatheredFixture(),
    rows: {},
    degraded: false,
    outcome: "valid",
  };
}

const chainOf = (surface: HostSurface, memberIds: string[] = [surface.id]): HostChain => ({ chainId: memberIds[0], memberIds, surface });

function presentPart(surfaceId: string | null, state = "output-available", output?: unknown): Part {
  call += 1;
  return {
    type: "tool-present",
    toolCallId: `call-${call}`,
    state,
    input: { payload: {} },
    ...(state === "output-available" ? { output: output ?? { surfaceId, variant: 1, outcome: "valid" } } : {}),
  } as Part;
}

const text = (t: string): Part => ({ type: "text", text: t });
const reply = (id: string, parts: Part[], status: "complete" | "failed" = "complete"): UIMessage => ({ id, role: "assistant", parts, metadata: { status } });
const ask = (id: string, t: string): UIMessage => ({ id, role: "user", parts: [text(t)], metadata: { status: "complete" } });

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

describe("inline views", () => {
  beforeEach(() => {
    actions.loadSurfaceAction.mockReset().mockResolvedValue(null);
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  test.each([true, false])("there is no surface column (wide %s); the newest chain renders in the transcript at its part", (wide) => {
    stubMatchMedia(wide);
    const messages = [ask("u1", "Show me"), reply("a1", [text("Here they are."), presentPart(V1)])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "Top matches"))]} />);
    expect(container.querySelector(".rf-agent-surface-column")).toBeNull();
    expect(container.querySelector(".rf-agent-workspace--split")).toBeNull();
    const view = container.querySelector<HTMLElement>(`.rf-view[data-chain-id="${V1}"]`);
    expect(view?.closest(".rf-agent-transcript")).not.toBeNull();
    expect(view?.closest("li")?.textContent).toContain("Here they are.");
    expect(container.querySelectorAll(".rf-view")).toHaveLength(1);
  });

  test("a message's parts render text, view, text, view in stored order", () => {
    const messages = [ask("u1", "Compare"), reply("a1", [text("First paragraph."), presentPart(V1), text("Second paragraph."), presentPart(V2)])];
    const chains = [chainOf(hostSurface(V1, "View A")), chainOf(hostSurface(V2, "View B"))];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={chains} />);
    const li = container.querySelectorAll(".rf-agent-transcript > li")[1];
    const order = [...li.querySelectorAll(".rf-md, .rf-view")].map((el) => (el.classList.contains("rf-view") ? `view:${el.getAttribute("data-chain-id")}` : `text:${el.textContent}`));
    expect(order).toEqual(["text:First paragraph.", `view:${V1}`, "text:Second paragraph.", `view:${V2}`]);
  });

  test("a present part still being written in the working turn shows the placeholder", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("Before."), presentPart(null, "input-available"), text("After.")])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ working: { elapsedMs: 0 } }} />);
    const li = container.querySelectorAll(".rf-agent-transcript > li")[1];
    const placeholder = li.querySelector(".rf-view-placeholder");
    expect(placeholder?.getAttribute("role")).toBe("status");
    expect(placeholder?.textContent).toContain("Building a view…");
    // Between the two paragraphs.
    const order = [...li.querySelectorAll(".rf-md, .rf-view-placeholder")].map((el) => (el.className.includes("placeholder") ? "placeholder" : el.textContent));
    expect(order).toEqual(["Before.", "placeholder", "After."]);
    expect(actions.loadSurfaceAction).not.toHaveBeenCalled();
  });

  test("an invalid or limit result shows nothing", () => {
    const messages = [
      ask("u2", "Again"),
      reply("a2", [text("Tried."), presentPart(null, "output-available", { variant: 2, outcome: "invalid", errors: ["bad"] })]),
      ask("u3", "More"),
      reply("a3", [text("Full."), presentPart(null, "output-available", { variant: 1, outcome: "limit", errors: ["This turn already has 3 views. Finish the answer in text."] })]),
    ];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ working: { elapsedMs: 0 } }} />);
    for (const li of container.querySelectorAll(".rf-agent-transcript > li")) {
      expect(li.querySelector(".rf-view-placeholder")).toBeNull();
      expect(li.querySelector(".rf-view")).toBeNull();
    }
    expect(actions.loadSurfaceAction).not.toHaveBeenCalled();
  });

  test("the placeholder is sized for the thread's variant", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [presentPart(null, "input-streaming")])];
    const variants = { thread: 3 as const, default: 3 as const, variant3Enabled: true };
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={messages} notice={null} variants={variants} fixture={{ working: { elapsedMs: 0 } }} />,
    );
    expect(container.querySelector(".rf-view-placeholder--code")).not.toBeNull();
  });

  test("a building part in a reply that is not working (an older reply, or a finished one) shows nothing", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("Cut off."), presentPart(null, "input-available")]), ask("u2", "Again"), reply("a2", [text("Working.")])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} fixture={{ working: { elapsedMs: 0 } }} />);
    expect(container.querySelector(".rf-view-placeholder")).toBeNull();
    expect(screen.queryByText("Building a view…")).toBeNull();
  });

  test("a stored failed reply that died mid-present shows no placeholder, only the interruption (Important 2)", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("Starting."), presentPart(null, "input-available")], "failed")];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    expect(container.querySelector(".rf-view-placeholder")).toBeNull();
    expect(screen.queryByText("Building a view…")).toBeNull();
    expect(screen.getByText("This reply was interrupted")).toBeTruthy();
    expect(stepsToggle().textContent).toContain("Stopped");
  });

  test("a stream error after present's input arrived leaves no placeholder (Important 2)", async () => {
    fetchMock.mockImplementationOnce(async () =>
      createUIMessageStreamResponse({
        stream: new ReadableStream<UIMessageChunk>({
          start(controller) {
            controller.enqueue({ type: "start", messageId: "msg-mid-present" });
            controller.enqueue({ type: "start-step" });
            controller.enqueue({ type: "text-start", id: "t1" });
            controller.enqueue({ type: "text-delta", id: "t1", delta: "Building it." });
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({ type: "tool-input-available", toolCallId: "p-1", toolName: "present", input: { payload: {} } });
            controller.enqueue({ type: "error", errorText: "model_error:503" });
            controller.close();
          },
        }),
      }),
    );
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Show me" } });
    fireEvent.click(sendButton());
    await screen.findByText(PROVIDER_DOWN_PROBLEM);
    await waitFor(() => expect(stepsToggle().textContent).toContain("Stopped"));
    expect(screen.getByText("Building it.")).toBeTruthy();
    expect(container.querySelector(".rf-view-placeholder")).toBeNull();
    expect(screen.queryByText("Building a view…")).toBeNull();
    expect(actions.loadSurfaceAction).not.toHaveBeenCalled();
  });

  test("an updated view's older part says it was updated below; Go to it focuses the latest frame's title", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    try {
      const messages = [ask("u1", "Show me"), reply("a1", [text("First."), presentPart(V1)]), ask("u2", "Change it"), reply("a2", [text("Changed."), presentPart(V2)])];
      const chains = [chainOf(hostSurface(V2, "Updated view", V1), [V1, V2])];
      const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={chains} />);
      const items = container.querySelectorAll(".rf-agent-transcript > li");
      expect(items[1].textContent).toContain("This view was updated below.");
      expect(items[1].querySelector(".rf-view")).toBeNull();
      expect(items[3].querySelector(`.rf-view[data-chain-id="${V1}"]`)).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Go to it" }));
      const title = items[3].querySelector(".rf-view__title");
      expect(document.activeElement).toBe(title);
      expect(scrolled).toHaveBeenCalled();
    } finally {
      // @ts-expect-error jsdom has no scrollIntoView of its own; restore that.
      delete Element.prototype.scrollIntoView;
    }
  });

  test("Go to it reaches the latest frame when only an orphan shows it (Review Focus 2)", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("First."), presentPart(V1)])];
    // V2 updated V1, and no loaded message names V2: the chain renders after the transcript.
    const chains = [chainOf(hostSurface(V2, "Updated view", V1), [V1, V2])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={chains} />);
    const orphan = container.querySelector<HTMLElement>(`.rf-view[data-chain-id="${V1}"]`);
    expect(orphan?.closest(".rf-agent-transcript")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Go to it" }));
    expect(document.activeElement).toBe(orphan?.querySelector(".rf-view__title"));
  });

  test("without a frame to go to the stub has no button (Review Focus 2)", () => {
    render(<ViewUpdatedStub />);
    expect(screen.getByText("This view was updated below.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a view that cannot be loaded says so with Try again, which loads it again", async () => {
    actions.loadSurfaceAction.mockRejectedValueOnce(new Error("offline"));
    const messages = [ask("u1", "Show me"), reply("a1", [text("Here."), presentPart(V3)])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    expect(container.querySelector(".rf-view-placeholder")).not.toBeNull();
    await screen.findByText(VIEW_LOAD_FAILED_TEXT);
    // Fix wave M5: its own line, not the render failure's "Ask again to see it." beside Try again.
    expect(VIEW_LOAD_FAILED_TEXT).toBe("This view could not be loaded.");
    expect(screen.queryByText(SURFACE_FAILED_TEXT)).toBeNull();
    expect(container.querySelector(".rf-view-placeholder")).toBeNull();
    expect(actions.loadSurfaceAction).toHaveBeenCalledTimes(1);
    actions.loadSurfaceAction.mockResolvedValueOnce(hostSurface(V3, "Loaded at last"));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { level: 3, name: "Loaded at last" });
    expect(actions.loadSurfaceAction).toHaveBeenCalledTimes(2);
    expect(actions.loadSurfaceAction).toHaveBeenLastCalledWith(THREAD, V3);
    expect(screen.queryByText(VIEW_LOAD_FAILED_TEXT)).toBeNull();
    expect(container.querySelector(`.rf-agent-transcript .rf-view[data-chain-id="${V3}"]`)).not.toBeNull();
  });

  test("a load that returns nothing shows the same line", async () => {
    const messages = [ask("u1", "Show me"), reply("a1", [presentPart(V3)])];
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    await screen.findByText(VIEW_LOAD_FAILED_TEXT);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  test("a stored failed reply whose view was stored still shows it, with Stopped after 1 step (Review Focus 1)", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("Here is the start."), presentPart(V1)], "failed")];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "Kept view"))]} />);
    const li = container.querySelectorAll(".rf-agent-transcript > li")[1];
    expect(li.querySelector(`.rf-view[data-chain-id="${V1}"]`)).not.toBeNull();
    expect(stepsToggle().textContent).toContain("Stopped after 1 step");
    expect(screen.getByText("This reply was interrupted")).toBeTruthy();
  });

  test("a reply that fails in the session after its view was stored keeps the view and reads Stopped (Review Focus 1)", async () => {
    actions.loadSurfaceAction.mockResolvedValue(hostSurface(V1, "Streamed view"));
    fetchMock.mockImplementationOnce(async () =>
      createUIMessageStreamResponse({
        stream: new ReadableStream<UIMessageChunk>({
          start(controller) {
            controller.enqueue({ type: "start", messageId: "msg-view-failed" });
            controller.enqueue({ type: "start-step" });
            controller.enqueue({ type: "tool-input-available", toolCallId: "p-1", toolName: "present", input: { payload: {} } });
            controller.enqueue({ type: "tool-output-available", toolCallId: "p-1", output: { surfaceId: V1, variant: 1, outcome: "valid" } });
            controller.enqueue({ type: "finish-step" });
            controller.enqueue({ type: "error", errorText: "model_error:503" });
            controller.close();
          },
        }),
      }),
    );
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Show me" } });
    fireEvent.click(sendButton());
    await screen.findByText(PROVIDER_DOWN_PROBLEM);
    await screen.findByRole("heading", { level: 3, name: "Streamed view" });
    await waitFor(() => expect(stepsToggle().textContent).toContain("Stopped after 1 step"));
    expect(container.querySelector(`.rf-agent-transcript .rf-view[data-chain-id="${V1}"]`)).not.toBeNull();
  });

  test("a chain no loaded message names renders after the transcript", () => {
    const messages = [ask("u1", "Hello"), reply("a1", [text("Hi.")])];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "Earlier view"))]} />);
    const view = container.querySelector(`.rf-view[data-chain-id="${V1}"]`)!;
    const transcript = container.querySelector(".rf-agent-transcript")!;
    expect(transcript.contains(view)).toBe(false);
    expect(transcript.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// PR 3 Task 3.4: the dock, inert and the status line (spec 08 S6.2, S6.3, S8). The expanded
// state is held here, keyed by chain, so it survives a chain moving to a newer message.
describe("an expanded view", () => {
  let back: { mockRestore(): void } | null = null;
  beforeEach(() => {
    // jsdom's history.back() traverses asynchronously, so a collapse's back() could land in a
    // later test and collapse that test's view. Here it lands at once: the entry below is
    // the plain one, and its popstate arrives (the hook swallows it as its own back).
    back = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    actions.loadSurfaceAction.mockReset().mockResolvedValue(null);
    actions.describeApprovalAction.mockReset();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    window.history.replaceState(null, "");
  });
  afterEach(() => {
    back?.mockRestore();
    document.documentElement.classList.remove("rf-view-expanded");
  });

  const descriptor: ConfirmDescriptor = { title: "Prepare this application?", lines: ["Engineer at Acme"], proposed: [], confirmLabel: "Prepare", danger: false };
  const approvalPart = (id: string): Part =>
    ({ type: "tool-start_application_prep", toolCallId: `c-${id}`, state: "approval-requested", input: { jobId: "j" }, approval: { id } }) as Part;
  const dock = (c: HTMLElement) => c.querySelector<HTMLElement>(".rf-agent-dock")!;
  const frameOf = (c: HTMLElement, chainId: string) => [...c.querySelectorAll<HTMLElement>(".rf-view")].find((el) => el.dataset.chainId === chainId) ?? null;
  const isInert = (el: Element) => el.closest("[inert]") !== null;
  const expandButton = (title: string) => screen.getByRole("button", { name: `Expand view: ${title}` });

  /** A reply that presents one surface, then says a sentence. */
  function presentReply(messageId: string, surfaceId: string): Response {
    return createUIMessageStreamResponse({
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({ type: "start", messageId });
          controller.enqueue({ type: "start-step" });
          controller.enqueue({ type: "tool-input-available", toolCallId: `p-${messageId}`, toolName: "present", input: { payload: {} } });
          controller.enqueue({ type: "tool-output-available", toolCallId: `p-${messageId}`, output: { surfaceId, variant: 1, outcome: "valid" } });
          controller.enqueue({ type: "finish-step" });
          controller.enqueue({ type: "text-start", id: "t" });
          controller.enqueue({ type: "text-delta", id: "t", delta: "Done." });
          controller.enqueue({ type: "text-end", id: "t" });
          controller.enqueue({ type: "finish" });
          controller.close();
        },
      }),
    });
  }
  const sendText = (t: string) => {
    fireEvent.change(composer(), { target: { value: t } });
    fireEvent.click(sendButton());
  };

  test("the approval alert, the confirm card and the composer sit in the dock; the empty state does not", async () => {
    const withoutSecret = render(<AgentChat threadId={THREAD} initialMessages={[ask("u1", "Prepare it"), reply("a1", [approvalPart("ap-1")])]} notice={null} />);
    const alert = await screen.findByText(CONFIRMATIONS_UNAVAILABLE);
    expect(dock(withoutSecret.container).contains(alert)).toBe(true);
    expect(dock(withoutSecret.container).contains(composer())).toBe(true);
    cleanup();

    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    const withCard = render(<AgentChat threadId={THREAD} initialMessages={[ask("u1", "Prepare it"), reply("a1", [approvalPart("ap-2")])]} notice={null} approvalsEnabled />);
    const card = await screen.findByRole("group", { name: "Prepare this application?" });
    expect(dock(withCard.container).contains(card)).toBe(true);
    cleanup();

    const empty = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    expect(dock(empty.container)).toBeNull();
    expect(composer()).toBeTruthy();
  });

  test("with the fixture's expanded chain, everything but the frame, the dock and the toasts is inert", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("First."), presentPart(V1)]), ask("u2", "And another"), reply("a2", [text("Second."), presentPart(V2)])];
    const chains = [chainOf(hostSurface(V1, "View A")), chainOf(hostSurface(V2, "View B"))];
    const { container } = render(
      <>
        <nav aria-label="Threads" />
        <AgentChat threadId={THREAD} title="A thread" initialMessages={messages} notice={null} surfaces={chains} fixture={{ expandedChainId: V2 }} />
        <section aria-label="Notifications alt+T" />
      </>,
    );
    const expanded = frameOf(container, V2)!;
    expect(expanded.dataset.expanded).toBe("true");
    expect(isInert(expanded)).toBe(false);
    expect(isInert(dock(container))).toBe(false);
    expect(isInert(screen.getByRole("navigation", { name: "Threads" }))).toBe(true);
    expect(isInert(container.querySelector(".rf-agent-toolbar")!)).toBe(true);
    expect(isInert(frameOf(container, V1)!)).toBe(true);
    expect(isInert(screen.getByText("And another"))).toBe(true);
    expect(isInert(screen.getByText("Second."))).toBe(true);
    expect(isInert(screen.getByRole("region", { name: "Notifications alt+T" }))).toBe(false);
    expect(document.documentElement.classList.contains("rf-view-expanded")).toBe(true);
  });

  test("collapsing restores what was made inert", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [text("First."), presentPart(V1)])];
    const { container } = render(<AgentChat threadId={THREAD} title="A thread" initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} />);
    fireEvent.click(expandButton("View A"));
    expect(isInert(container.querySelector(".rf-agent-toolbar")!)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close expanded view" }));
    expect(container.querySelector("[inert]")).toBeNull();
    expect(frameOf(container, V1)!.dataset.expanded).toBeUndefined();
  });

  test("Escape does nothing while a confirm card shows; the card is in the dock and live", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    const messages = [ask("u1", "Prepare it"), reply("a1", [presentPart(V1), approvalPart("ap-3")])];
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={messages} notice={null} approvalsEnabled surfaces={[chainOf(hostSurface(V1, "View A"))]} fixture={{ expandedChainId: V1 }} />,
    );
    const card = await screen.findByRole("group", { name: "Prepare this application?" });
    expect(isInert(card)).toBe(false);
    act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(frameOf(container, V1)!.dataset.expanded).toBe("true");
  });

  test("Escape from inside the frame goes through the same gate: nothing while a confirm card shows", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    const messages = [ask("u1", "Prepare it"), reply("a1", [presentPart(V1), approvalPart("ap-4")])];
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={messages} notice={null} approvalsEnabled surfaces={[chainOf(hostSurface(V1, "View A"))]} fixture={{ expandedChainId: V1 }} />,
    );
    await screen.findByRole("group", { name: "Prepare this application?" });
    expect(frameOf(container, V1)!.dataset.expanded).toBe("true");
    act(() => viewHosts.get(V1)!.onEscape());
    expect(frameOf(container, V1)!.dataset.expanded).toBe("true");
  });

  test("Escape from inside the frame collapses when no confirm card shows", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [presentPart(V1)])];
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} fixture={{ expandedChainId: V1 }} />,
    );
    expect(frameOf(container, V1)!.dataset.expanded).toBe("true");
    act(() => viewHosts.get(V1)!.onEscape());
    expect(frameOf(container, V1)!.dataset.expanded).toBeUndefined();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand view: View A" }));
  });

  test("a collapse whose view is gone puts focus in the composer (spec 08 S6.3)", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [presentPart(V1)])];
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} fixture={{ expandedChainId: V1 }} />,
    );
    // Within one mount a chain never leaves the page (chains only grow, and each renders
    // somewhere), so the frame stands in for a view that went: it no longer answers to its
    // chain when the collapse looks for it.
    frameOf(container, V1)!.dataset.chainId = "gone";
    act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(container.querySelector('.rf-view[data-expanded="true"]')).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  test("the variant switcher is disabled while a view is expanded", () => {
    const messages = [ask("u1", "Show me"), reply("a1", [presentPart(V1)])];
    const variants = { thread: 1 as const, default: 1 as const, variant3Enabled: true };
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} variants={variants} surfaces={[chainOf(hostSurface(V1, "View A"))]} />);
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(expandButton("View A"));
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.every((r) => (r as HTMLInputElement).disabled)).toBe(true);
  });

  test('a turn that adds a new view while one is expanded says "New view ready."; Show it expands it in place of the first, with one history entry', async () => {
    actions.loadSurfaceAction.mockResolvedValue(hostSurface(V2, "New view"));
    fetchMock.mockImplementationOnce(async () => presentReply("a2", V2));
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[ask("u1", "Show me"), reply("a1", [presentPart(V1)])]} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} />);
    const before = window.history.length;
    fireEvent.click(expandButton("View A"));
    expect(window.history.length).toBe(before + 1);
    sendText("Another one");
    const status = await screen.findByText("New view ready.");
    expect(dock(container).contains(status)).toBe(true);
    // The first view is still the expanded one until Show it.
    expect(frameOf(container, V1)!.dataset.expanded).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(frameOf(container, V2)!.dataset.expanded).toBe("true");
    expect(frameOf(container, V1)!.dataset.expanded).toBeUndefined();
    expect(window.history.state).toEqual({ rfView: V2 });
    expect(window.history.length).toBe(before + 1);
    expect(screen.queryByText("New view ready.")).toBeNull();
  });

  test('a turn with only an answer says "Reply ready."; Back to conversation collapses the view', async () => {
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[ask("u1", "Show me"), reply("a1", [presentPart(V1)])]} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} />);
    fireEvent.click(expandButton("View A"));
    sendText("Thanks, what next?");
    await screen.findByText("Reply ready.");
    fireEvent.click(screen.getByRole("button", { name: "Back to conversation" }));
    expect(frameOf(container, V1)!.dataset.expanded).toBeUndefined();
    expect(screen.queryByText("Reply ready.")).toBeNull();
    expect(screen.getByText("Here are two roles.")).toBeTruthy();
  });

  test("an update that lands in a newer message keeps its chain expanded there, with no status line", async () => {
    actions.loadSurfaceAction.mockResolvedValue(hostSurface(V2, "View A, updated", V1));
    fetchMock.mockImplementationOnce(async () => presentReply("a2", V2));
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[ask("u1", "Show me"), reply("a1", [presentPart(V1)])]} notice={null} surfaces={[chainOf(hostSurface(V1, "View A"))]} />);
    fireEvent.click(expandButton("View A"));
    sendText("Make it shorter");
    await screen.findByRole("heading", { level: 3, name: "View A, updated" });
    await waitFor(() => expect(container.querySelector(".rf-steps--done")).not.toBeNull());
    const frames = [...container.querySelectorAll<HTMLElement>(".rf-view")];
    expect(frames).toHaveLength(1);
    const [frame] = frames;
    expect(frame.dataset.chainId).toBe(V1);
    expect(frame.dataset.expanded).toBe("true");
    // It is the newer message's frame now; the older part says it was updated below.
    expect(frame.closest(".rf-agent-message")!.textContent).toContain("Done.");
    expect(isInert(frame)).toBe(false);
    expect(document.documentElement.classList.contains("rf-view-expanded")).toBe(true);
    expect(container.querySelector(".rf-agent-dock .rf-expanded-status")).toBeNull();
    expect(window.history.state).toEqual({ rfView: V1 });
  });
});

// PR 6 Task 6.4 (spec 08 S10.4): a view's pending ask, sent on the user's press of Send, is
// the user's message with a view- id and the view's source; the composer's draft is left alone.
describe("a view's ask", () => {
  const CODE = "aaaaaaaa-0000-4000-8000-0000000000c3";
  const ASK_TEXT = "Compare the top two";
  function codeChain(): HostChain {
    const gathered = gatheredFixture();
    return sandboxChain({
      id: CODE,
      threadId: THREAD,
      payload: { variant: 3, title: "Code view", html: "<p>Hello from the view</p>" },
      gathered,
      fallback: fallbackSurface(gathered, "The plain view."),
      rows: {},
    });
  }
  const history = () => [ask("u1", "Show me"), reply("a1", [presentPart(CODE, "output-available", { surfaceId: CODE, variant: 3, outcome: "valid" })])];
  const askSend = () => screen.getByRole("button", { name: `Send: ${ASK_TEXT}` }) as HTMLButtonElement;
  const describedBy = (el: HTMLElement) => document.getElementById(el.getAttribute("aria-describedby") ?? "")?.textContent ?? null;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    actions.reportSurfaceFailure.mockReset().mockResolvedValue(null);
    actions.describeFrameIntentAction.mockReset();
  });

  test("Send posts the ask as a view message with the view's source, and the composer keeps its half-typed draft (Review Focus 5)", async () => {
    render(<AgentChat threadId={THREAD} initialMessages={history()} notice={null} surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />);
    fireEvent.change(composer(), { target: { value: "half typed" } });
    fireEvent.click(askSend());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = bodyOf(0);
    expect(Object.keys(body).sort()).toEqual(["id", "kind", "source", "text", "threadId"]);
    expect(body).toMatchObject({ threadId: THREAD, kind: "message", text: ASK_TEXT, source: { kind: "view", surfaceId: CODE } });
    expect(String(body.id)).toMatch(/^view-[A-Za-z0-9]{16}$/);
    await screen.findByText("Here are two roles.");
    expect(composer().value).toBe("half typed");
    // The pending message is gone, and the sent message has its caption.
    expect(screen.queryByRole("button", { name: `Send: ${ASK_TEXT}` })).toBeNull();
    const sent = screen.getByText(ASK_TEXT, { selector: ".rf-agent-message__text" }).closest("li")!;
    expect(sent.dataset.messageId).toBe(body.id);
    expect(sent.textContent).toContain("Sent from a view");
  });

  test("a stored user message with a view- id shows Sent from a view; one with a u- id does not", () => {
    const messages: UIMessage[] = [
      ask("view-abc", "From the view"),
      reply("a1", [text("First answer")]),
      ask("u-abc", "Typed by me"),
      reply("a2", [text("Second answer")]),
    ];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    const fromView = container.querySelector<HTMLElement>('[data-message-id="view-abc"]')!;
    const typed = container.querySelector<HTMLElement>('[data-message-id="u-abc"]')!;
    expect(fromView.querySelector(".rf-agent-message__from-view")?.textContent).toBe("Sent from a view");
    expect(fromView.querySelector(".rf-agent-message__bubble .rf-agent-message__text")?.textContent).toBe("From the view");
    expect(typed.textContent).not.toContain("Sent from a view");
    expect(screen.getAllByText("Sent from a view")).toHaveLength(1);
  });

  test("Send is disabled while a turn runs, with the reason as its description", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    render(<AgentChat threadId={THREAD} initialMessages={history()} notice={null} surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />);
    expect(askSend().disabled).toBe(false);
    fireEvent.change(composer(), { target: { value: "Another question" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(askSend().disabled).toBe(true));
    expect(describedBy(askSend())).toBe("Wait for the current reply.");
    fireEvent.click(askSend());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a blocking notice disables Send with the notice's own sentence", () => {
    render(<AgentChat threadId={THREAD} initialMessages={history()} notice="daily_ceiling" surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />);
    expect(askSend().disabled).toBe(true);
    expect(describedBy(askSend())).toBe("Today's agent budget is used up");
  });

  test("a refused view message is taken back out and its text does not go to the composer", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "view_source_invalid" }, { status: 400 }));
    const { container } = render(
      <AgentChat threadId={THREAD} initialMessages={history()} notice={null} surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />,
    );
    fireEvent.click(askSend());
    await screen.findByText(GENERIC_PROBLEM);
    expect(container.querySelector('[data-message-id^="view-"]')).toBeNull();
    expect(composer().value).toBe("");
    // PR 6 review, minor 9: it goes back to its frame as the pending ask, to retry or dismiss.
    expect(askSend().disabled).toBe(false);
    expect(container.querySelector("[data-sandbox-ask] .rf-ask__text")?.textContent).toBe(ASK_TEXT);
  });

  test("a network failure puts the ask back too; a failure after the server accepted it does not", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { container, unmount } = render(
      <AgentChat threadId={THREAD} initialMessages={history()} notice={null} surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />,
    );
    fireEvent.click(askSend());
    await waitFor(() => expect(container.querySelector("[data-sandbox-ask] .rf-ask__text")?.textContent).toBe(ASK_TEXT));
    expect(composer().value).toBe("");
    unmount();
    // A 5xx may come after the server stored the message: it stays, and the ask is not shown again.
    fetchMock.mockResolvedValueOnce(Response.json({ error: "internal" }, { status: 500 }));
    const again = render(
      <AgentChat threadId={THREAD} initialMessages={history()} notice={null} surfaces={[codeChain()]} fixture={{ askFor: { surfaceId: CODE, text: ASK_TEXT } }} />,
    );
    fireEvent.click(askSend());
    await waitFor(() => expect(again.container.querySelector('[data-message-id^="view-"]')).not.toBeNull());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));
    expect(again.container.querySelector("[data-sandbox-ask]")).toBeNull();
  });
});
