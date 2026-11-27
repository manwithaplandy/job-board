// @vitest-environment jsdom
// The steps row (spec 08 section 7.2): one toggle and a list panel above an assistant
// answer. The summary comes from lib/agent/steps.ts; here it is built by hand.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { StepSummary } from "@/lib/agent/steps";
import { StepsRow } from "./StepsRow";

afterEach(cleanup);

const none: StepSummary = { groups: [], failures: [], declined: [], total: 0, failed: 0 };
const eight: StepSummary = {
  groups: [
    { key: "search_jobs", label: "Searched your reviewed jobs", count: 5, running: false },
    { key: "get_job", label: "Read a job posting", count: 1, running: false },
    { key: "present:Built a view", label: "Built a view", count: 1, running: false },
  ],
  failures: ["Could not read a job review"],
  declined: [],
  total: 8,
  failed: 1,
};

function row(props: Partial<Parameters<typeof StepsRow>[0]> = {}) {
  const onToggle = vi.fn();
  const utils = render(<StepsRow id="m1-steps" summary={eight} state="done" open={false} onToggle={onToggle} {...props} />);
  return { ...utils, onToggle };
}
const toggle = () => screen.getByRole("button");

test("working: the current label and a timer that screen readers skip", () => {
  const { container } = row({ state: "working", summary: none, currentLabel: "Searching your reviewed jobs", elapsedMs: 65_000 });
  expect(toggle().textContent).toContain("Searching your reviewed jobs");
  const timer = container.querySelector(".rf-steps__timer");
  expect(timer?.textContent).toBe("1:05");
  expect(timer?.getAttribute("aria-hidden")).toBe("true");
});

test("working with no steps yet still shows the row", () => {
  row({ state: "working", summary: none, currentLabel: "Thinking", elapsedMs: 0 });
  expect(toggle().textContent).toContain("Thinking");
  expect(toggle().textContent).toContain("0:00");
});

test("done: the headline, and no timer", () => {
  const { container } = row({ summary: { ...eight, failures: [], failed: 0 } });
  expect(toggle().textContent).toContain("Worked through 8 steps");
  expect(container.querySelector(".rf-steps__timer")).toBeNull();
});

test("one step reads 1 step", () => {
  row({ summary: { ...none, groups: [{ key: "get_job", label: "Read a job posting", count: 1, running: false }], total: 1 } });
  expect(toggle().textContent).toContain("Worked through 1 step");
  expect(toggle().textContent).not.toContain("1 steps");
});

test("done with no steps renders nothing; stopped with none too", () => {
  const { container } = row({ summary: none });
  expect(container.innerHTML).toBe("");
  cleanup();
  const again = row({ summary: none, state: "stopped" });
  expect(again.container.innerHTML).toBe("");
});

test("failures change the headline and list in the danger style", () => {
  const { container } = row({ open: true });
  expect(toggle().textContent).toContain("Worked through 8 steps, 1 did not work");
  const failed = container.querySelector(".rf-steps__item--failed");
  expect(failed?.textContent).toBe("Could not read a job review");
});

test("declined lines are listed after the failures", () => {
  const { container } = row({ open: true, summary: { ...eight, declined: ["You declined: updated your résumé"], total: 9 } });
  const items = [...container.querySelectorAll(".rf-steps__panel li")].map((li) => li.textContent);
  expect(items.at(-1)).toBe("You declined: updated your résumé");
  expect(items.at(-2)).toBe("Could not read a job review");
});

test("stopped headline", () => {
  row({ state: "stopped", summary: { ...none, groups: eight.groups.slice(0, 1), total: 5 } });
  expect(toggle().textContent).toContain("Stopped after 5 steps");
});

test("a click calls onToggle", () => {
  const { onToggle } = row();
  fireEvent.click(toggle());
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("the panel is hidden when closed and lists grouped counts when open", () => {
  const { container, rerender } = row();
  const panel = container.querySelector("ul.rf-steps__panel");
  expect(panel?.hasAttribute("hidden")).toBe(true);
  rerender(<StepsRow id="m1-steps" summary={eight} state="done" open onToggle={() => {}} />);
  expect(panel?.hasAttribute("hidden")).toBe(false);
  const items = [...container.querySelectorAll(".rf-steps__panel li")].map((li) => li.textContent);
  expect(items).toContain("Searched your reviewed jobs (5 times)");
  expect(items).toContain("Read a job posting");
});

test("the toggle names its panel and says whether it is open", () => {
  const { container, rerender } = row();
  const panel = container.querySelector("ul.rf-steps__panel");
  expect(panel?.id).toBe("m1-steps-panel");
  expect(toggle().getAttribute("aria-controls")).toBe("m1-steps-panel");
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  rerender(<StepsRow id="m1-steps" summary={eight} state="done" open onToggle={() => {}} />);
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
});

test("a running group shows a small spinner in the open panel", () => {
  const running: StepSummary = { ...none, groups: [{ key: "search_jobs", label: "Searched your reviewed jobs", count: 2, running: true }], total: 2 };
  const { container } = row({ state: "working", summary: running, currentLabel: "Searching your reviewed jobs", elapsedMs: 0, open: true });
  expect(container.querySelector(".rf-steps__panel .rf-steps__spinner")).not.toBeNull();
});
