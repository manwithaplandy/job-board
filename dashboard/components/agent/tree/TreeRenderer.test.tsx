// @vitest-environment jsdom
// The variant 2 tree renderer (plan Task 2.2): one component per node over the shared
// primitives, bound atoms read from the gathered data by job id, agent text as text
// nodes, buttons that emit only their own closed-enum intent, and a fixed placeholder
// (never a crash) for a bind that no longer resolves.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import { gatheredFixture, jobFacts, reviewFacts, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";
import { V2_LIMITS, V2_NODE_TYPES, validateSurfaceV2, type SurfacePayloadV2, type V2Node } from "@/lib/agent/surfaces/v2/tree";
import { everyNodePayload } from "@/lib/agent/surfaces/v2/testFixtures";
import { AgentTreeFixture, TREE_FIXTURE_GATHERED, TREE_FIXTURE_PAYLOAD } from "./AgentTreeFixture";
import { TREE_NA_TEXT, TREE_RENDER_DEPTH_MAX } from "./nodes";
import { TreeRenderer } from "./TreeRenderer";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function gathered(): GatheredData {
  const g = gatheredFixture();
  g.jobs[JOB_A] = { ...jobFacts(JOB_A), title: "Staff Platform Engineer", url: "https://jobs.example.com/acme/101" };
  g.jobs[JOB_B] = { ...jobFacts(JOB_B), title: "Backend Engineer", url: "https://jobs.example.com/globex/202" };
  g.reviews[JOB_A] = { ...reviewFacts(JOB_A, 3), fitScore: 87, payMin: 180000, payMax: 210000, payCurrency: "USD", payPeriod: "year" };
  return g;
}

const tree = (root: V2Node, title?: string): SurfacePayloadV2 => ({ variant: 2, ...(title ? { title } : {}), root });

function draw(payload: SurfacePayloadV2, g: GatheredData = gathered()) {
  const onIntent = vi.fn<(i: ActionIntent) => void>();
  const view = render(<TreeRenderer payload={payload} gathered={g} onIntent={onIntent} />);
  return { onIntent, ...view };
}

describe("TreeRenderer", () => {
  test("renders each of the 19 node types from a sample tree", () => {
    const payload = everyNodePayload();
    expect(validateSurfaceV2(payload, gathered()).ok).toBe(true);
    const { container } = draw(payload);
    const drawn = new Set([...container.querySelectorAll("[data-tree-node]")].map((el) => el.getAttribute("data-tree-node")));
    expect([...drawn].sort()).toEqual([...V2_NODE_TYPES].sort());
    expect(screen.getByRole("heading", { name: "Your matches" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Matches" })).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Requirement" })).toBeTruthy();
    expect(screen.getByText("Requirement 2")).toBeTruthy();
    expect(screen.getByLabelText("Minimum pay")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Where" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Shortlist" })).toBeTruthy();
    // Tabs show one panel at a time.
    expect(screen.getByText("First tab")).toBeTruthy();
    expect(screen.queryByText("Second tab")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Two" }));
    expect(screen.getByText("Second tab")).toBeTruthy();
    expect(screen.queryByText("First tab")).toBeNull();
    // The chart sits inside the data-viz marker.
    expect(container.querySelector('[data-tree-node="Chart"] [data-ui-visual="data-viz"]')).toBeTruthy();
    expect(screen.queryByText(TREE_NA_TEXT)).toBeNull();
  });

  test("FitScore, Pay and JobTitle show database values for their jobId", () => {
    const { container } = draw(
      tree({
        type: "Stack", gap: "2", children: [
          { type: "JobTitle", jobId: JOB_A }, { type: "FitScore", jobId: JOB_A }, { type: "Pay", jobId: JOB_A },
          { type: "PostingLink", jobId: JOB_A }, { type: "Stat", label: "Fit score", bind: `/reviews/${JOB_A}/fitScore` },
        ],
      }),
    );
    expect(screen.getByText("Staff Platform Engineer")).toBeTruthy();
    expect(screen.getByText("87 fit")).toBeTruthy();
    expect(container.querySelector('[data-tree-node="Pay"]')?.textContent).toMatch(/180/);
    expect(container.querySelector('[data-tree-node="Pay"]')?.textContent).toMatch(/210/);
    const link = screen.getByRole("link", { name: /View posting/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://jobs.example.com/acme/101");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(within(container.querySelector('[data-tree-node="Stat"]') as HTMLElement).getByText("87")).toBeTruthy();
  });

  test("Text containing HTML renders literally", () => {
    const html = '<img src=x onerror="alert(1)"><a href="https://evil.example">click</a>';
    const { container } = draw(
      tree({ type: "Stack", gap: "1", children: [{ type: "Text", text: html }, { type: "List", items: [html] }, { type: "Badge", text: "<b>x</b>", tone: "danger" }] }, "<i>t</i>"),
    );
    expect(screen.getAllByText(html)).toHaveLength(2);
    expect(screen.getByText("<b>x</b>")).toBeTruthy();
    expect(screen.getByText("<i>t</i>")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  test("a Button click calls onIntent with its action and nothing else", () => {
    const action: ActionIntent = { name: "shortlist.set", jobId: JOB_A, state: "later" };
    const { onIntent } = draw(
      tree({ type: "Stack", gap: "1", children: [
        { type: "Field", id: "note", label: "Note", kind: "text" },
        { type: "Button", label: "Later", variant: "secondary", action },
      ] }),
    );
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(action);
  });

  test("Field and Select values go with the next answer button, then clear", () => {
    const action: ActionIntent = { name: "answer", questionId: "intake", value: "send" };
    const { onIntent } = draw(
      tree({ type: "Stack", gap: "1", children: [
        { type: "Field", id: "floor", label: "Pay floor", kind: "number" },
        { type: "Select", id: "where", label: "Where", options: ["Remote", "Austin"] },
        { type: "Field", id: "skip", label: "Left empty", kind: "text" },
        { type: "Button", label: "Send", variant: "primary", action },
      ] }),
    );
    fireEvent.change(screen.getByLabelText("Pay floor"), { target: { value: "180000" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Where" }), { target: { value: "Austin" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onIntent.mock.calls.map((c) => c[0])).toEqual([
      { name: "answer", questionId: "floor", value: "180000" },
      { name: "answer", questionId: "where", value: "Austin" },
      action,
    ]);
    expect((screen.getByLabelText("Pay floor") as HTMLInputElement).value).toBe("");
    onIntent.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onIntent.mock.calls.map((c) => c[0])).toEqual([action]);
  });

  test("M5: answers go in the order first filled, numeric field ids included", () => {
    const action: ActionIntent = { name: "answer", questionId: "intake", value: "send" };
    const { onIntent } = draw(
      tree({ type: "Stack", gap: "1", children: [
        { type: "Field", id: "where", label: "Where", kind: "text" },
        { type: "Field", id: "2", label: "Second", kind: "text" },
        { type: "Field", id: "1", label: "First", kind: "text" },
        { type: "Button", label: "Send", variant: "primary", action },
      ] }),
    );
    fireEvent.change(screen.getByLabelText("Where"), { target: { value: "Austin" } });
    fireEvent.change(screen.getByLabelText("Second"), { target: { value: "b" } });
    fireEvent.change(screen.getByLabelText("First"), { target: { value: "a" } });
    // A refill keeps the field's first place.
    fireEvent.change(screen.getByLabelText("Where"), { target: { value: "Remote" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onIntent.mock.calls.map((c) => c[0])).toEqual([
      { name: "answer", questionId: "where", value: "Remote" },
      { name: "answer", questionId: "2", value: "b" },
      { name: "answer", questionId: "1", value: "a" },
      action,
    ]);
  });

  test("M7: a PostingLink whose stored URL is not http(s) renders no link", () => {
    const g = gathered();
    g.jobs[JOB_A] = { ...g.jobs[JOB_A], url: "javascript:alert(1)" };
    const { container } = draw(tree({ type: "PostingLink", jobId: JOB_A }), g);
    expect(screen.getByText("View posting")).toBeTruthy();
    expect(container.querySelector("a")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  test("R14: a Table bound to the whole shortlist draws one row per shortlist item", () => {
    const g = gathered();
    g.shortlist = [JOB_A, JOB_B].map((jobId) => ({
      jobId, state: "suggested" as const, reasonCode: null, reasonText: null, briefWhy: null, briefRisk: null,
      setBy: "agent" as const, updatedAt: "2026-11-24T00:00:00.000Z", job: g.jobs[jobId], fitScore: jobId === JOB_A ? 87 : 70,
    }));
    const payload = tree({
      type: "Table",
      rowsBind: "/shortlist",
      columns: [{ header: "Job", bind: "/job/title" }, { header: "Fit", bind: "/fitScore" }],
    });
    expect(validateSurfaceV2(payload, g).ok).toBe(true);
    draw(payload, g);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("Staff Platform Engineer")).toBeTruthy();
    expect(within(rows[2]).getByText("Backend Engineer")).toBeTruthy();
  });

  test("an unresolved bind renders a placeholder, not a crash", () => {
    const g = emptyGathered();
    const { container } = draw(
      tree({ type: "Stack", gap: "1", children: [
        { type: "Stat", label: "Fit", bind: `/reviews/${JOB_A}/fitScore` },
        { type: "Chart", viz: "line", bind: "/metrics/3", title: "Gone" },
        { type: "Table", columns: [{ header: "X", bind: "/text" }], rowsBind: `/reviews/${JOB_A}/requirements` },
        { type: "JobTitle", jobId: JOB_A }, { type: "FitScore", jobId: JOB_A }, { type: "Pay", jobId: JOB_A },
        { type: "PostingLink", jobId: JOB_A },
      ] }),
      g,
    );
    expect(screen.getAllByText(TREE_NA_TEXT).length).toBe(7);
    expect(container.querySelector("a")).toBeNull();
    // A bind to something that is not a value (a whole row) is a placeholder too.
    cleanup();
    draw(tree({ type: "Stat", label: "Job", bind: `/jobs/${JOB_A}` as string }), gathered());
    expect(screen.getByText(TREE_NA_TEXT)).toBeTruthy();
  });

  test("a tree deeper than the cap or with an unknown node renders placeholders, not a crash", () => {
    expect(TREE_RENDER_DEPTH_MAX).toBe(V2_LIMITS.maxDepth);
    let node: V2Node = { type: "Text", text: "deep" };
    for (let i = 0; i < 10; i++) node = { type: "Stack", gap: "1", children: [node] };
    draw(tree(node));
    expect(screen.queryByText("deep")).toBeNull();
    expect(screen.getByText(TREE_NA_TEXT)).toBeTruthy();
    cleanup();
    draw(tree({ type: "Stack", gap: "1", children: [{ type: "Marquee" } as unknown as V2Node] }));
    expect(screen.getByText(TREE_NA_TEXT)).toBeTruthy();
  });
});

describe("visual fixture", () => {
  test("the agent-tree-sample fixture is a valid payload whose binds and ids all resolve", () => {
    expect(validateSurfaceV2(TREE_FIXTURE_PAYLOAD, TREE_FIXTURE_GATHERED)).toEqual({ ok: true, payload: TREE_FIXTURE_PAYLOAD });
    const { container } = render(<AgentTreeFixture />);
    expect(screen.queryByText(TREE_NA_TEXT)).toBeNull();
    const drawn = new Set([...container.querySelectorAll("[data-tree-node]")].map((el) => el.getAttribute("data-tree-node")));
    expect([...drawn].sort()).toEqual([...V2_NODE_TYPES].sort());
  });
});
