// @vitest-environment jsdom
// The agent page chrome (plan Task 1.20): surface host, fixed confirm cards, undo toasts,
// uploads, the empty state, ?compare and the test-data badge. fetch is stubbed per URL;
// the server actions, the router, sonner and the generation tracker are mocks.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createUIMessageStreamResponse, type UIMessage, type UIMessageChunk } from "ai";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import type { ConfirmDescriptor } from "@/lib/agent/actions/intents";
import { emptyGathered } from "@/lib/agent/gathered";
import { gatheredFixture, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";

const actions = vi.hoisted(() => ({
  renameThreadAction: vi.fn(),
  newThread: vi.fn(),
  undoAgentAction: vi.fn(),
  executeIntentAction: vi.fn(),
  confirmIntentAction: vi.fn(),
  loadSurfaceAction: vi.fn(),
  reloadSurfaceRowsAction: vi.fn(),
  describeApprovalAction: vi.fn(),
  describeFrameIntentAction: vi.fn(),
  reportSurfaceFailure: vi.fn(),
  setThreadVariantAction: vi.fn(),
  setDefaultVariantAction: vi.fn(),
}));
vi.mock("@/app/actions/agent", () => actions);
const shortlist = vi.hoisted(() => ({ refreshSuggestedAction: vi.fn() }));
vi.mock("@/app/actions/shortlist", () => shortlist);
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const sonner = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("sonner", () => sonner);
const tracker = vi.hoisted(() => ({ value: null as null | { notifyStarted: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn> } }));
vi.mock("@/components/generation/GenerationToastProvider", () => ({ useGenerationTracker: () => tracker.value }));

import { AgentChat, StartConversation } from "./AgentChat";
import { EMPTY_SENTENCE } from "./EmptyState";
import { TestDataBadge } from "./TestDataBadge";
import { SURFACE_FAILED_TEXT } from "./SurfaceHost";
import { compareMessage } from "@/lib/agent/actions/compareText";
import { CONFIRMATIONS_UNAVAILABLE } from "@/lib/agent/approvalSecret";

const THREAD = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaaa-0000-4000-8000-000000000001";
const S2 = "aaaaaaaa-0000-4000-8000-000000000002";
const S3 = "aaaaaaaa-0000-4000-8000-000000000003";
const DOC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function stream(chunks: UIMessageChunk[]): Response {
  return createUIMessageStreamResponse({
    stream: new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    }),
  });
}

const textReply = (text: string): UIMessageChunk[] => [
  { type: "start", messageId: "msg-reply" },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: text },
  { type: "text-end", id: "t1" },
  { type: "finish" },
];

function toolReply(toolName: string, input: unknown, output: unknown, callId = "call-1"): UIMessageChunk[] {
  return [
    { type: "start", messageId: `msg-${callId}` },
    { type: "tool-input-available", toolCallId: callId, toolName, input },
    { type: "tool-output-available", toolCallId: callId, output },
    { type: "finish" },
  ];
}

function surface(id: string, text: string, supersedes: string | null = null, blocks?: unknown[]): HostSurface {
  return {
    id,
    threadId: THREAD,
    supersedes,
    rerenderOf: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    variant: 1,
    view: { kind: "blocks" },
    payload: { variant: 1, title: `View ${text}`, blocks: (blocks ?? [{ type: "Callout", tone: "info", text }]) as never },
    gathered: gatheredFixture(),
    rows: {},
    degraded: false,
    outcome: "valid",
  };
}

const presentPart = (callId: string, surfaceId: string) =>
  ({
    type: "tool-present",
    toolCallId: callId,
    state: "output-available",
    input: { payload: { variant: 1, blocks: [{ type: "Callout", tone: "info", text: "MODEL PAYLOAD TEXT" }] } },
    output: { surfaceId, variant: 1, outcome: "valid", payload: { variant: 1, blocks: [] } },
  }) as UIMessage["parts"][number];

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
let agentReply: FetchHandler;
let uploadReply: FetchHandler;

beforeEach(() => {
  for (const f of Object.values(actions)) f.mockReset();
  actions.renameThreadAction.mockResolvedValue({ ok: true });
  actions.loadSurfaceAction.mockResolvedValue(null);
  actions.undoAgentAction.mockResolvedValue({ ok: true });
  shortlist.refreshSuggestedAction.mockReset().mockResolvedValue(0);
  router.replace.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  sonner.toast.mockReset();
  tracker.value = null;
  agentReply = () => stream(textReply("Done."));
  uploadReply = () => Response.json({ error: "too_large" }, { status: 413 });
  fetchMock.mockReset().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/review/request")) return Response.json({ status: null });
    if (url === "/api/agent/upload") return uploadReply(url, init);
    return agentReply(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const agentCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]) === "/api/agent");
const agentBody = (i: number) => JSON.parse(String(agentCalls()[i]?.[1]?.body)) as Record<string, unknown>;
const composer = () => screen.getByLabelText(/^Message/) as HTMLTextAreaElement;
const sendButton = () => screen.getByRole("button", { name: "Send" });

describe("SurfaceHost", () => {
  test("an updated surface replaces its predecessor instead of appending", async () => {
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Show me" }] },
      { id: "a1", role: "assistant", parts: [presentPart("c1", S1)] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "Change it" }] },
      { id: "a2", role: "assistant", parts: [presentPart("c2", S2)] },
    ];
    // The server folded S1 and S2 into one chain at S2.
    const chains: HostChain[] = [{ chainId: S1, memberIds: [S1, S2], surface: surface(S2, "Version two", S1) }];
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={chains} />);
    expect(container.querySelectorAll(".rf-agent-surface")).toHaveLength(1);
    expect(screen.getByText("Version two")).toBeTruthy();
    // The tool part's own payload is never rendered.
    expect(screen.queryByText("MODEL PAYLOAD TEXT")).toBeNull();

    // A live update of the same chain: the new row replaces it in place.
    actions.loadSurfaceAction.mockResolvedValue(surface(S3, "Version three", S2));
    agentReply = () => stream(toolReply("present", { payload: {} }, { surfaceId: S3, variant: 1, outcome: "valid", payload: {} }, "c3"));
    fireEvent.change(composer(), { target: { value: "Again" } });
    fireEvent.click(sendButton());
    await screen.findByText("Version three");
    expect(actions.loadSurfaceAction).toHaveBeenCalledWith(THREAD, S3);
    expect(screen.queryByText("Version two")).toBeNull();
    expect(container.querySelectorAll(".rf-agent-surface")).toHaveLength(1);
  });

  test("a block that throws while rendering shows the fixed line, and the page stays up", () => {
    // Gathered data that slipped past the server parse: the job card throws reading it.
    const broken: HostSurface = { ...surface(S1, "x", null, [{ type: "JobCard", jobId: JOB_A }]), gathered: { ...emptyGathered(), jobs: null as never } };
    const messages: UIMessage[] = [{ id: "a1", role: "assistant", parts: [presentPart("c1", S1)] }];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={[{ chainId: S1, memberIds: [S1], surface: broken }]} />);
    spy.mockRestore();
    expect(screen.getByText(SURFACE_FAILED_TEXT)).toBeTruthy();
    expect(screen.getByLabelText(/^Message/)).toBeTruthy();
  });
});

describe("confirm cards", () => {
  const descriptor: ConfirmDescriptor = {
    title: "Prepare this application?",
    lines: ["Engineer at Acme", "Left this month: résumé 3."],
    proposed: ["Instructions: shorter"],
    confirmLabel: "Prepare",
    danger: false,
  };
  const waiting = (approval: { id: string; isAutomatic?: boolean }): UIMessage[] => [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Prepare it" }], metadata: { status: "complete" } },
    {
      id: "a1",
      role: "assistant",
      metadata: { status: "complete" },
      parts: [
        {
          type: "tool-start_application_prep",
          toolCallId: "c1",
          state: "approval-requested",
          input: { jobId: JOB_A, title: "FREE TEXT FROM THE MODEL", confirmLabel: "Yes do it" },
          approval,
        } as UIMessage["parts"][number],
      ],
    },
  ];

  test("ConfirmCard text comes from describeConfirmation, never from the tool input's free text", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={waiting({ id: "ap-1" })} notice={null} approvalsEnabled />);
    const card = await screen.findByRole("group", { name: "Prepare this application?" });
    // The server builds the card from the stored part: the client sends only the ids.
    expect(actions.describeApprovalAction).toHaveBeenCalledWith(THREAD, "ap-1");
    expect(within(card).getByText("Engineer at Acme")).toBeTruthy();
    expect(within(card).getByText("Proposed")).toBeTruthy();
    expect(within(card).getByText("Instructions: shorter")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Prepare" })).toBeTruthy();
    expect(container.textContent).not.toContain("FREE TEXT FROM THE MODEL");
    expect(container.textContent).not.toContain("Yes do it");
  });

  test("Approve posts kind approval with the part's approval id; Deny posts approved false", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    render(<AgentChat threadId={THREAD} initialMessages={waiting({ id: "ap-1" })} notice={null} approvalsEnabled />);
    fireEvent.click(await screen.findByRole("button", { name: "Prepare" }));
    await waitFor(() => expect(agentCalls()).toHaveLength(1));
    expect(agentBody(0)).toEqual({ threadId: THREAD, kind: "approval", approvalId: "ap-1", approved: true });
    cleanup();

    render(<AgentChat threadId={THREAD} initialMessages={waiting({ id: "ap-2" })} notice={null} approvalsEnabled />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(agentCalls()).toHaveLength(2));
    expect(agentBody(1)).toEqual({ threadId: THREAD, kind: "approval", approvalId: "ap-2", approved: false });
  });

  test("automatic approvals (isAutomatic) render no card", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    render(<AgentChat threadId={THREAD} initialMessages={waiting({ id: "ap-3", isAutomatic: true })} notice={null} approvalsEnabled />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(actions.describeApprovalAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Prepare this application?" })).toBeNull();
  });

  test("without the approval secret no card renders and nothing is asked of the server", async () => {
    actions.describeApprovalAction.mockResolvedValue({ status: "ready", descriptor });
    render(<AgentChat threadId={THREAD} initialMessages={waiting({ id: "ap-4" })} notice={null} />);
    expect(await screen.findByText(CONFIRMATIONS_UNAVAILABLE)).toBeTruthy();
    expect(actions.describeApprovalAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Prepare" })).toBeNull();
  });

  test("a confirmed application.prepare hands its generation to the tracker, else refreshes it", async () => {
    tracker.value = { notifyStarted: vi.fn(), refresh: vi.fn() };
    const chains: HostChain[] = [{ chainId: S1, memberIds: [S1], surface: surface(S1, "x", null, [{ type: "JobCard", jobId: JOB_A }]) }];
    const messages: UIMessage[] = [{ id: "a1", role: "assistant", parts: [presentPart("c1", S1)] }];
    actions.executeIntentAction.mockResolvedValue({ kind: "confirm", confirm: descriptor, token: "tok" });
    const generation = {
      id: "g1", jobId: JOB_A, kind: "prepare", status: "pending", error: null, jobTitle: "Engineer", company: "Acme",
      createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z",
    };
    actions.confirmIntentAction.mockResolvedValue({ kind: "done", toast: "Preparing your application.", generation });
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} surfaces={chains} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare application" }));
    await waitFor(() => expect(actions.executeIntentAction).toHaveBeenCalledWith(THREAD, S1, { name: "application.prepare", jobId: JOB_A }, "host"));
    fireEvent.click(await screen.findByRole("button", { name: "Prepare" }));
    await waitFor(() => expect(tracker.value?.notifyStarted).toHaveBeenCalledWith(generation));
    expect(actions.confirmIntentAction).toHaveBeenCalledWith("tok");
    expect(sonner.toast).toHaveBeenCalledWith("Preparing your application.");

    actions.confirmIntentAction.mockResolvedValue({ kind: "done", toast: "You've used this month's allowance for that." });
    fireEvent.click(screen.getByRole("button", { name: "Prepare application" }));
    fireEvent.click(await screen.findByRole("button", { name: "Prepare" }));
    await waitFor(() => expect(tracker.value?.refresh).toHaveBeenCalledTimes(1));
  });
});

describe("a prep started through the approval tool (PR I3b review I3)", () => {
  const generation = {
    id: "g2", jobId: JOB_A, kind: "prepare", status: "pending", error: null, jobTitle: "Engineer", company: "Acme",
    createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z",
  };

  test("an approved start_application_prep result refreshes the tracker once per call", async () => {
    tracker.value = { notifyStarted: vi.fn(), refresh: vi.fn() };
    agentReply = () => stream(toolReply("start_application_prep", { jobId: JOB_A }, { status: "started", generationId: "g1" }, "prep-1"));
    const { rerender } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Prepare it" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(tracker.value?.refresh).toHaveBeenCalledTimes(1));
    expect(tracker.value?.notifyStarted).not.toHaveBeenCalled();
    // A later rerender and a later turn do not raise it again for the same call.
    rerender(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    agentReply = () => stream(textReply("It is running."));
    fireEvent.change(composer(), { target: { value: "Thanks" } });
    fireEvent.click(sendButton());
    await screen.findByText("It is running.");
    expect(tracker.value?.refresh).toHaveBeenCalledTimes(1);
  });

  test("a refine_documents result that carries a generation view hands it to the tracker", async () => {
    tracker.value = { notifyStarted: vi.fn(), refresh: vi.fn() };
    agentReply = () =>
      stream(toolReply("refine_documents", { jobId: JOB_A }, { status: "already_running", generationId: "g2", generation }, "refine-1"));
    render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Shorter letter" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(tracker.value?.notifyStarted).toHaveBeenCalledWith(generation));
    expect(tracker.value?.refresh).not.toHaveBeenCalled();
  });

  test("a stored prep result, or one that started nothing, does not touch the tracker", async () => {
    tracker.value = { notifyStarted: vi.fn(), refresh: vi.fn() };
    const stored: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "tool-start_application_prep", toolCallId: "old", state: "output-available", input: {}, output: { status: "started", generationId: "g0" } } as UIMessage["parts"][number]],
      },
    ];
    agentReply = () => stream(toolReply("start_application_prep", { jobId: JOB_A }, { status: "allowance_exhausted", kind: "resume" }, "prep-2"));
    render(<AgentChat threadId={THREAD} initialMessages={stored} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Prepare it" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(agentCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(tracker.value?.refresh).not.toHaveBeenCalled();
    expect(tracker.value?.notifyStarted).not.toHaveBeenCalled();
  });
});

describe("undo and uploads", () => {
  test("a write tool result shows Undo, and Undo calls undoAgentAction with its actionId", async () => {
    agentReply = () => stream(toolReply("set_shortlist_state", { jobId: JOB_A, state: "shortlisted" }, { status: "done", state: "shortlisted", actionId: 42 }));
    render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(composer(), { target: { value: "Shortlist it" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(sonner.toast).toHaveBeenCalledWith("The agent updated your shortlist.", expect.anything()));
    const options = sonner.toast.mock.calls.find((c) => c[0] === "The agent updated your shortlist.")?.[1] as {
      duration: number;
      action: { label: string; onClick: () => void };
    };
    expect(options.duration).toBe(10_000);
    expect(options.action.label).toBe("Undo");
    options.action.onClick();
    await waitFor(() => expect(actions.undoAgentAction).toHaveBeenCalledWith(42));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  test("a stored write result raises no toast on load", () => {
    const messages: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "tool-set_shortlist_state", toolCallId: "old", state: "output-available", input: {}, output: { status: "done", actionId: 7 } } as UIMessage["parts"][number]],
      },
    ];
    render(<AgentChat threadId={THREAD} initialMessages={messages} notice={null} />);
    expect(sonner.toast).not.toHaveBeenCalled();
  });

  test("an upload error shows the fixed message for its code", async () => {
    uploadReply = () => Response.json({ error: "too_large", message: "SERVER TEXT" }, { status: 413 });
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    const input = screen.getByLabelText("Attach a file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "big.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("That file is larger than 4 MB.")).toBeTruthy();
    expect(container.textContent).not.toContain("SERVER TEXT");
    uploadReply = () => Response.json({ error: "something_new" }, { status: 400 });
    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("That upload did not go through. Try again.")).toBeTruthy();
  });

  test("an uploaded file's id rides on the next message's documentIds, once", async () => {
    uploadReply = () => Response.json({ document: { id: DOC, filename: "resume.pdf", kind: "resume" } });
    render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [new File(["x"], "resume.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("resume.pdf")).toBeTruthy();
    fireEvent.change(composer(), { target: { value: "Here is my résumé" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(agentCalls()).toHaveLength(1));
    expect(agentBody(0)).toMatchObject({ kind: "message", text: "Here is my résumé", documentIds: [DOC] });
    await screen.findByText("Done.");
    fireEvent.change(composer(), { target: { value: "Thanks" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(agentCalls()).toHaveLength(2));
    expect(Object.keys(agentBody(1)).sort()).toEqual(["id", "kind", "text", "threadId"]);
  });
});

describe("empty state, compare and the test-data badge", () => {
  test("the empty state has exactly one sentence, the composer and an upload target", () => {
    const { container } = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} />);
    const empty = container.querySelector(".rf-agent-empty") as HTMLElement;
    expect(empty).toBeTruthy();
    const sentences = empty.querySelectorAll("p.rf-agent-empty__sentence");
    expect(sentences).toHaveLength(1);
    expect(sentences[0].textContent).toBe(EMPTY_SENTENCE.profile);
    expect(sentences[0].textContent?.match(/[.!?](\s|$)/g)).toHaveLength(1);
    expect(within(empty).getByLabelText(/^Message/)).toBeTruthy();
    expect((within(empty).getByLabelText("Attach a file") as HTMLInputElement).type).toBe("file");
    cleanup();
    const again = render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} hasProfile={false} />);
    expect(again.container.querySelector(".rf-agent-empty__sentence")?.textContent).toBe(EMPTY_SENTENCE.noProfile);
  });

  test("no open thread: the empty state has the composer and upload target, and the first send creates exactly one thread", async () => {
    const NEW = "33333333-3333-4333-8333-333333333333";
    let finish: (v: { id: string }) => void = () => {};
    actions.newThread.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    uploadReply = () => Response.json({ document: { id: DOC, filename: "resume.pdf", kind: "resume" } });
    const { container } = render(<StartConversation hasProfile={false} />);
    const empty = container.querySelector(".rf-agent-empty") as HTMLElement;
    expect(empty.querySelectorAll("p.rf-agent-empty__sentence")).toHaveLength(1);
    expect(empty.querySelector(".rf-agent-empty__sentence")?.textContent).toBe(EMPTY_SENTENCE.noProfile);
    expect(within(empty).getByLabelText(/^Message/)).toBeTruthy();
    // Nothing is created on render.
    expect(actions.newThread).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [new File(["x"], "resume.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("resume.pdf")).toBeTruthy();
    fireEvent.change(composer(), { target: { value: "Here is my résumé" } });
    fireEvent.click(sendButton());
    fireEvent.submit(composer().closest("form")!);
    expect(actions.newThread).toHaveBeenCalledTimes(1);
    await act(async () => finish({ id: NEW }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/agent?t=${NEW}`));
    expect(String(router.push.mock.calls[0][0])).not.toContain("r%C3%A9sum");
    expect(agentCalls()).toHaveLength(0);
    cleanup();

    // The opened thread's chat sends the handed-over message once, with its file.
    render(<AgentChat threadId={NEW} initialMessages={[]} notice={null} />);
    await waitFor(() => expect(agentCalls()).toHaveLength(1));
    expect(agentBody(0)).toMatchObject({ threadId: NEW, kind: "message", text: "Here is my résumé", documentIds: [DOC] });
    expect(actions.renameThreadAction).toHaveBeenCalledWith(NEW, "Here is my résumé");
    cleanup();
    render(<AgentChat threadId={NEW} initialMessages={[]} notice={null} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(agentCalls()).toHaveLength(1);
  });

  test("a failed thread start says so and lets the user try again", async () => {
    actions.newThread.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ id: "44444444-4444-4444-8444-444444444444" });
    render(<StartConversation hasProfile />);
    fireEvent.change(composer(), { target: { value: "Hi" } });
    fireEvent.click(sendButton());
    expect(await screen.findByText("A new conversation could not be started. Try again.")).toBeTruthy();
    fireEvent.click(sendButton());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/agent?t=44444444-4444-4444-8444-444444444444"));
    expect(actions.newThread).toHaveBeenCalledTimes(2);
  });

  test("?compare with two ids sends one structured message and clears the query", async () => {
    render(<AgentChat threadId={THREAD} initialMessages={[]} notice={null} compare={[JOB_A, JOB_B]} />);
    await waitFor(() => expect(agentCalls()).toHaveLength(1));
    expect(agentBody(0)).toMatchObject({ threadId: THREAD, kind: "message", text: compareMessage(JOB_A, JOB_B) });
    expect(router.replace).toHaveBeenCalledWith(`/agent?t=${THREAD}`);
    await screen.findByText("Done.");
    expect(agentCalls()).toHaveLength(1);
  });

  test("the test-data badge shows for an admin on a frozen catalog and for nobody else", () => {
    const frozen = { now: new Date("2026-10-01T12:00:00.000Z"), frozen: true };
    const live = { now: new Date("2026-11-25T12:00:00.000Z"), frozen: false };
    const { container, rerender } = render(<TestDataBadge admin clock={frozen} />);
    expect(container.textContent).toBe("Test data: catalog frozen at 2026-10-01");
    rerender(<TestDataBadge admin={false} clock={frozen} />);
    expect(container.textContent).toBe("");
    rerender(<TestDataBadge admin clock={live} />);
    expect(container.textContent).toBe("");
    rerender(<TestDataBadge admin={false} clock={live} />);
    expect(container.textContent).toBe("");
  });
});

test("a surface no loaded message names still renders once, after the transcript", () => {
  const orphan: HostSurface = { ...surface(S1, "Earlier view"), gathered: emptyGathered() };
  const { container } = render(
    <AgentChat threadId={THREAD} initialMessages={[]} notice={null} surfaces={[{ chainId: S1, memberIds: [S1], surface: orphan }]} />,
  );
  expect(screen.getByText("Earlier view")).toBeTruthy();
  expect(container.querySelectorAll(".rf-agent-surface")).toHaveLength(1);
});
