// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ReviewNowPanel } from "./ReviewNowPanel";

// Flush the panel's async poll (fetch → json → setState) and any due timers, inside act
// so React applies the resulting state before assertions.
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// A single mutable "next response" the mocked fetch returns; tests set it before
// advancing timers to drive the panel through its poll transitions.
let nextResponse: Record<string, unknown> = { status: null };

beforeEach(() => {
  vi.useFakeTimers();
  nextResponse = { status: null };
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => nextResponse,
  })) as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe("ReviewNowPanel (T6)", () => {
  test("compact progress strip stays mounted while a request runs, even with jobs present", async () => {
    nextResponse = { status: "running", reviewedToday: 3 };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0); // flush the initial poll
    // firstRun is false (jobs are present) yet the compact strip shows because a request
    // is active — and it renders the progress figure.
    expect(screen.getByTestId("review-progress")).toBeTruthy();
    expect(screen.getByText(/3 roles scored so far/)).toBeTruthy();
  });

  test("settling as 'done' triggers a board refresh and hides the strip", async () => {
    const onSettled = vi.fn();
    nextResponse = { status: "running", reviewedToday: 1 };
    render(<ReviewNowPanel firstRun={false} onSettled={onSettled} />);
    await flush(0);
    expect(screen.getByTestId("review-progress")).toBeTruthy();
    expect(screen.getByText(/1 role scored so far/)).toBeTruthy();

    // Next poll (10s later) reports the request finished.
    nextResponse = { status: "done" };
    await flush(10_000);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("review-progress")).toBeNull();
  });

  test("empty board (firstRun) with no active request shows the being-built CTA", async () => {
    nextResponse = { status: null, remaining: 400 };
    render(<ReviewNowPanel firstRun />);
    await flush(0);
    expect(screen.getByText("Your board is being built")).toBeTruthy();
    expect(screen.getByText(/Review my board now/)).toBeTruthy();
  });

  test("populated board (not firstRun) with no active request renders nothing", async () => {
    nextResponse = { status: null };
    const { container } = render(<ReviewNowPanel firstRun={false} />);
    await flush(0);
    expect(container.querySelector('[data-testid="review-progress"]')).toBeNull();
    expect(screen.queryByText(/Review my board now/)).toBeNull();
  });

  test("a stale 'done' seen on the first poll does NOT fire onSettled", async () => {
    const onSettled = vi.fn();
    nextResponse = { status: "done" };
    render(<ReviewNowPanel firstRun={false} onSettled={onSettled} />);
    await flush(0);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
