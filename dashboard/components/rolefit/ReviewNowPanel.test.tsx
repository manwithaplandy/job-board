// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewNowPanel } from "./ReviewNowPanel";
import type { JobRow } from "@/lib/types";

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
let fetchUrls: string[] = [];

const matchRow: JobRow = {
  id: "greenhouse:acme:1",
  title: "Staff Engineer",
  location: "Phoenix, AZ",
  location_canonicals: null,
  remote: true,
  first_seen_at: "2026-07-01T00:00:00.000Z",
  closed_at: null,
  company_name: "Acme",
  ats: "greenhouse",
  human_override: false,
  verdict: "approve",
  role_category: "engineering",
  seniority: "staff",
  work_arrangement: "remote",
  pay_min: 150000,
  pay_max: 200000,
  pay_currency: "USD",
  pay_period: "year",
  headcount: null,
  skills_score: 8,
  experience_score: 8,
  comp_score: 8,
  fit_score: 88,
  skill_gaps: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  nextResponse = { status: null };
  fetchUrls = [];
  global.fetch = vi.fn(async (url: unknown) => {
    fetchUrls.push(String(url));
    return { ok: true, json: async () => nextResponse };
  }) as unknown as typeof fetch;
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

  test("keeps idle live messages separate from review and billing actions", async () => {
    nextResponse = { status: null, remaining: 400 };
    render(<ReviewNowPanel firstRun />);
    await flush(0);

    const button = screen.getByRole("button", { name: "Review my board now" });
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((status) => status.textContent?.includes("400 reviews left"))).toBe(true);
    expect(statuses.every((status) => !status.contains(button))).toBe(true);
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

describe("ReviewNowPanel — tier-gate upsell (402 / 409 → /billing)", () => {
  // GET polls keep answering from nextResponse; the POST answers with the gate rejection.
  function mockPostRejection(status: number, body: Record<string, unknown>) {
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return { ok: false, status, json: async () => body };
      return { ok: true, status: 200, json: async () => nextResponse };
    }) as unknown as typeof fetch;
  }

  async function clickReviewNow() {
    render(<ReviewNowPanel firstRun />);
    await flush(0); // initial poll → idle first-run card
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Review my board now/ }));
    });
    await flush(0);
  }

  test("402 (no plan) → subscribe invitation with a /billing CTA, not the generic error", async () => {
    mockPostRejection(402, {
      error: "Subscribe to have your board reviewed.",
      code: "subscription_required",
    });
    await clickReviewNow();
    expect(screen.getByText(/Subscribe to have your board reviewed\./)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /See plans/ });
    expect(cta.getAttribute("href")).toBe("/billing");
    expect(screen.queryByText(/Couldn't start a review/)).toBeNull();
  });

  test("409 (daily budget spent, Standard) → reset note + Upgrade-to-Pro link to /billing", async () => {
    mockPostRejection(409, {
      error: "Daily review budget used — resumes tomorrow.",
      code: "review_budget_exhausted",
      plan: "standard",
      remaining: 0,
    });
    await clickReviewNow();
    expect(screen.getByText(/Daily review budget used — resumes tomorrow\./)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Upgrade to Pro/ });
    expect(cta.getAttribute("href")).toBe("/billing");
  });

  test("non-gate failures keep the generic retry copy and get NO billing link", async () => {
    mockPostRejection(500, { error: "boom" });
    await clickReviewNow();
    const error = screen.getByRole("alert");
    expect(error.textContent).toBe("boom");
    expect(error.closest('[role="status"]')).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("ReviewNowPanel — live-population cursor poll", () => {
  test("first poll carries no since; the server cursor threads into the next poll", async () => {
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0);
    expect(fetchUrls[0]).toBe("/api/review/request");

    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [] };
    await flush(4_000);
    expect(fetchUrls[1]).toBe("/api/review/request?since=C1");
  });

  test("forwards non-empty newMatches to onNewMatches; empty ticks stay silent", async () => {
    const onNewMatches = vi.fn();
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} onNewMatches={onNewMatches} />);
    await flush(0);
    expect(onNewMatches).not.toHaveBeenCalled();

    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [matchRow] };
    await flush(4_000);
    expect(onNewMatches).toHaveBeenCalledTimes(1);
    expect(onNewMatches).toHaveBeenCalledWith([matchRow]);
  });

  test("polls every 4s while running, but keeps 10s while pending", async () => {
    nextResponse = { status: "pending", cursor: "C1" };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0);           // initial poll
    expect(fetchUrls).toHaveLength(1);
    await flush(4_000);       // pending: 4s is NOT enough
    expect(fetchUrls).toHaveLength(1);
    nextResponse = { status: "running", cursor: "C2" };
    await flush(6_000);       // pending tick fires at 10s → status flips to running
    expect(fetchUrls).toHaveLength(2);
    await flush(4_000);       // running: 4s cadence
    expect(fetchUrls).toHaveLength(3);
  });

  test("the 4s running cadence recurs across a stable streak (reviewedToday keeps updating)", async () => {
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} />);
    await flush(0);           // initial poll
    expect(fetchUrls).toHaveLength(1);
    expect(screen.getByText(/1 role scored so far/)).toBeTruthy();

    // Status stays "running" (a React no-op) — the poll must still re-arm itself.
    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [] };
    await flush(4_000);
    expect(fetchUrls).toHaveLength(2);

    nextResponse = { status: "running", reviewedToday: 3, cursor: "C3", newMatches: [] };
    await flush(4_000);
    expect(fetchUrls).toHaveLength(3);
    expect(screen.getByText(/3 roles scored so far/)).toBeTruthy();
  });

  test("settles after several running ticks — onSettled fires once and the strip unmounts", async () => {
    const onSettled = vi.fn();
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C1", newMatches: [] };
    render(<ReviewNowPanel firstRun={false} onSettled={onSettled} />);
    await flush(0);
    expect(screen.getByTestId("review-progress")).toBeTruthy();

    nextResponse = { status: "running", reviewedToday: 2, cursor: "C2", newMatches: [] };
    await flush(4_000);
    nextResponse = { status: "running", reviewedToday: 3, cursor: "C3", newMatches: [] };
    await flush(4_000);
    expect(onSettled).not.toHaveBeenCalled();

    // The next running tick reports the run finished.
    nextResponse = { status: "done" };
    await flush(4_000);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("review-progress")).toBeNull();
  });
});
