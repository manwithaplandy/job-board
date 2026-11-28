// @vitest-environment jsdom
// The expanded view's turn status line (spec 08 S6.2, PR 3 Task 3.4): one line in the dock
// while a view is expanded, saying what the running or finished turn did.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ExpandedStatus, turnOutcome } from "./ExpandedStatus";
import type { HostChain } from "@/lib/agent/surfaces/host";

afterEach(cleanup);

type Props = Parameters<typeof ExpandedStatus>[0];

function status(props: Partial<Props> = {}) {
  const handlers = { onBack: vi.fn(), onShow: vi.fn(), onRetry: vi.fn() };
  const utils = render(<ExpandedStatus expanded working={null} outcome="none" {...handlers} {...props} />);
  return { ...utils, ...handlers };
}

test("renders nothing while no view is expanded, whatever the turn did", () => {
  for (const outcome of ["none", "reply", "new-view", "error"] as const) {
    const { container, unmount } = status({ expanded: false, outcome, errorText: "It failed." });
    expect(container.innerHTML).toBe("");
    unmount();
  }
  const { container } = status({ expanded: false, working: { label: "Thinking", elapsedMs: 3_000 } });
  expect(container.innerHTML).toBe("");
});

test("working: the steps row's working label and its timer", () => {
  status({ working: { label: "Searching your reviewed jobs", elapsedMs: 65_000 } });
  const line = screen.getByRole("status");
  expect(line.textContent).toContain("Searching your reviewed jobs");
  expect(line.textContent).toContain("1:05");
  // The ticking time is for the eye only, as in the steps row.
  expect(screen.getByText("1:05").getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByRole("button")).toBeNull();
});

test('a reply with no new view: "Reply ready." and "Back to conversation"', () => {
  const { onBack } = status({ outcome: "reply" });
  expect(screen.getByRole("status").textContent).toContain("Reply ready.");
  fireEvent.click(screen.getByRole("button", { name: "Back to conversation" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('a new view: "New view ready." and "Show it"', () => {
  const { onShow } = status({ outcome: "new-view" });
  expect(screen.getByRole("status").textContent).toContain("New view ready.");
  fireEvent.click(screen.getByRole("button", { name: "Show it" }));
  expect(onShow).toHaveBeenCalledTimes(1);
});

test("the turn updated the expanded view itself: nothing", () => {
  const { container } = status({ outcome: "none" });
  expect(container.innerHTML).toBe("");
});

test("a failed turn: the error sentence and Retry, or no Retry when the turn cannot be resent", () => {
  const { onRetry, unmount } = status({ outcome: "error", errorText: "The agent could not answer. Try again." });
  expect(screen.getByRole("status").textContent).toContain("The agent could not answer. Try again.");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  unmount();
  status({ outcome: "error", errorText: "Refused.", onRetry: null });
  expect(screen.getByRole("status").textContent).toContain("Refused.");
  expect(screen.queryByRole("button")).toBeNull();
});

test("a running turn wins over the last turn's outcome", () => {
  status({ outcome: "reply", working: { label: "Thinking", elapsedMs: 0 } });
  expect(screen.getByRole("status").textContent).toContain("Thinking");
  expect(screen.queryByText("Reply ready.")).toBeNull();
});

describe("turnOutcome", () => {
  const chain = (chainId: string, ...more: string[]) => ({ chainId, memberIds: [chainId, ...more] }) as unknown as HostChain;
  const chains = [chain("a", "a2"), chain("b")];
  const of = (surfaceIds: string[], failed: string[] = []) => turnOutcome({ surfaceIds, chains, failedLoads: new Set(failed), expandedChainId: "a" });

  test("no surface is a reply; only the expanded chain is an update with no line", () => {
    expect(of([])).toEqual({ outcome: "reply", newChainId: null });
    expect(of(["a2"])).toEqual({ outcome: "none", newChainId: null });
  });
  test("another chain is a new view, even beside an update", () => {
    expect(of(["a2", "b"])).toEqual({ outcome: "new-view", newChainId: "b" });
  });
  test("a surface still loading says nothing yet; one that failed to load is no view", () => {
    expect(of(["c"])).toEqual({ outcome: "none", newChainId: null });
    expect(of(["c"], ["c"])).toEqual({ outcome: "reply", newChainId: null });
  });
});
