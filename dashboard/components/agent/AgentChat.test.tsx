// @vitest-environment jsdom
// The minimal agent page's chat (plan Task 0.14). fetch is stubbed: the route answers
// either a UI message stream or one of its JSON rejections.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createUIMessageStreamResponse, type UIMessage, type UIMessageChunk } from "ai";

const actions = vi.hoisted(() => ({ renameThreadAction: vi.fn(), newThread: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import { AgentChat } from "./AgentChat";

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
  expect(bodyOf(0)).toMatchObject({ kind: "message", text: "What did you review?" });
  await screen.findByText("Here are two roles.");
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

test("the first message of an untitled thread names the thread from its text", async () => {
  render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} autoTitle />);
  fireEvent.change(composer(), { target: { value: "  Find   remote ML roles  " } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(actions.renameThreadAction).toHaveBeenCalledWith(THREAD, "Find remote ML roles"));
});
