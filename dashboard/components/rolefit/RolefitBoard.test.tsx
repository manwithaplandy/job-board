// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

// Tier-gate upsell integration: a gated generation fetch that comes back 402/429 must
// surface the bottom-of-screen upsell pill with a /billing CTA (keyed off the status +
// the body's machine `code`, never the error string), while every other failure keeps
// the pre-existing generic error handling.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const job: JobRow = {
  id: "job-1",
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

const baseProps: RolefitBoardProps = {
  jobs: [job],
  nowIso: "2026-07-04T00:00:00.000Z",
  isAuthed: true,
  initialFilters: DEFAULT_FILTERS,
  saveResume: vi.fn(async () => {}),
  rejectJob: vi.fn(async () => {}),
  unrejectJob: vi.fn(async () => {}),
  markApplied: vi.fn(async () => {}),
  unmarkApplied: vi.fn(async () => {}),
  hasProfile: true,
  viewerEmail: "u@x.com",
  resumeText: "resume text",
  currentProfileVersion: null,
  initialPackages: [],
  initialRejected: [],
  initialJobQuestions: {},
};

// The board reads window.matchMedia through useSyncExternalStore; jsdom has none.
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Route the board's fetches: the gated POST answers with `prepare`; the polling GETs
// (review status, job detail) answer benignly so the detail pane settles.
function mockFetch(prepare: { status: number; body: Record<string, unknown> }) {
  global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u === "/api/application/prepare" && init?.method === "POST") {
      return {
        ok: prepare.status < 400,
        status: prepare.status,
        json: async () => prepare.body,
      };
    }
    if (u.startsWith("/api/jobs/")) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ status: null }) };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  stubMatchMedia();
  // Deep-link the fixture job so the detail pane (and its Prepare button) mounts.
  window.history.replaceState({}, "", "/?job=job-1");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

async function renderAndPrepare(status: number, body: Record<string, unknown>) {
  mockFetch({ status, body });
  render(<RolefitBoard {...baseProps} />);
  fireEvent.click(await screen.findByRole("button", { name: /Prefill application/ }));
}

describe("RolefitBoard — tier-gate upsell pill (/billing CTA)", () => {
  test("429 allowance_exhausted → monthly-limit message + Upgrade-to-Pro link; panes revert, no error state", async () => {
    await renderAndPrepare(429, {
      error: "Monthly résumé allowance used (30/30 on Standard).",
      code: "allowance_exhausted",
      plan: "standard",
    });
    const pill = await screen.findByTestId("upsell-notice");
    expect(within(pill).getByText(/Monthly résumé allowance used \(30\/30 on Standard\)\./)).toBeTruthy();
    expect(within(pill).getByText(/resets next month/)).toBeTruthy();
    const cta = within(pill).getByRole("link", { name: /Upgrade to Pro/ });
    expect(cta.getAttribute("href")).toBe("/billing");
    // The rejection is an upsell, not a failure: the pane reverts to idle (the Prepare
    // button is back) instead of entering the error state.
    expect(await screen.findByRole("button", { name: /Prefill application/ })).toBeTruthy();
    expect(screen.queryByText(/Couldn’t generate/)).toBeNull();
  });

  test("402 subscription_required → subscribe invitation with a See-plans link to /billing", async () => {
    await renderAndPrepare(402, {
      error: "Subscribe to generate résumés and cover letters.",
      code: "subscription_required",
    });
    const pill = await screen.findByTestId("upsell-notice");
    expect(within(pill).getByText(/Subscribe to generate résumés and cover letters\./)).toBeTruthy();
    const cta = within(pill).getByRole("link", { name: /See plans/ });
    expect(cta.getAttribute("href")).toBe("/billing");
  });

  test("a bare 429 (upstream rate limit, no gate code) stays on the generic error path", async () => {
    await renderAndPrepare(429, { error: "Rate limited — try again in a moment." });
    // The generic path surfaces the error in the panes — and NO upsell pill appears.
    expect((await screen.findAllByText(/Rate limited — try again in a moment\./)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("upsell-notice")).toBeNull();
  });

  test("a non-gate failure (502) keeps the generic error handling, no upsell pill", async () => {
    await renderAndPrepare(502, { error: "Generation failed — try again." });
    expect((await screen.findAllByText(/Generation failed — try again\./)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("upsell-notice")).toBeNull();
  });
});

describe("pay range filter wiring", () => {
  const lowPay: JobRow = { ...job, id: "job-2", title: "Junior Engineer", pay_min: 60000, pay_max: 80000 };

  test("a persisted range hides out-of-range jobs and labels the Pay pill", () => {
    stubMatchMedia();
    mockFetch({ status: 200, body: {} }); // benign: no generation is driven here
    const { container } = render(
      <RolefitBoard
        {...baseProps}
        jobs={[job, lowPay]}
        initialFilters={{ ...DEFAULT_FILTERS, payMin: 100, payMax: null }}
      />,
    );
    // Load-bearing: the FilterBar result-count is layout-independent (unlike the virtualized
    // JobList, which renders no card rows in jsdom, and the auto-selected detail pane). It
    // reads `visibleCount of totalInView roles` where visibleCount is the count AFTER the pay
    // filter — so "1 of 2" proves the payMin:100 filter actually dropped the 60–80k job.
    expect(container.querySelector(".rf-board-result-count")?.textContent).toBe("1 of 2 roles");
    // Pay trigger reflects the active lower bound.
    expect(screen.getByRole("button", { name: /Pay.*\$100k\+/ })).toBeTruthy();
  });
});
