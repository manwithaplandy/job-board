// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

// Live board population (spec 2026-07-16), integration-tested through the REAL
// ReviewNowPanel poll: fetch answers with newMatches, and the board must merge,
// highlight, dedupe-against-props, and expire the highlight.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function makeJob(id: string, title: string): JobRow {
  return {
    id, title,
    location: "Phoenix, AZ", remote: true,
    first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
    company_name: "Acme", ats: "greenhouse", human_override: false,
    verdict: "approve", role_category: "engineering", seniority: "staff",
    work_arrangement: "remote", pay_min: 150000, pay_max: 200000,
    pay_currency: "USD", pay_period: "year", headcount: null,
    skills_score: 8, experience_score: 8, comp_score: 8, fit_score: 88,
    skill_gaps: [],
  };
}

const baseProps: RolefitBoardProps = {
  jobs: [],
  nowIso: "2026-07-16T00:00:00.000Z",
  isAuthed: true,
  initialFilters: DEFAULT_FILTERS,
  saveResume: vi.fn(async () => {}),
  rejectJob: vi.fn(async () => {}),
  unrejectJob: vi.fn(async () => {}),
  markApplied: vi.fn(async () => {}),
  unmarkApplied: vi.fn(async () => {}),
  // unreviewed > 0 mounts the ReviewNowPanel — the poll under test.
  operator: { health: "ok", unreviewed: 5, reviewed: 0 },
  hasProfile: true,
  viewerEmail: "u@x.com",
  resumeText: "resume text",
  currentProfileVersion: null,
  initialPackages: [],
  initialRejected: [],
  initialJobQuestions: {},
};

// Narrow layout: JobList renders the plain (non-virtualized) list, which jsdom can
// actually lay out (the virtualizer against a 0-height pane would mount no rows).
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// The panel's polls answer from this mutable response (same pattern as
// ReviewNowPanel.test.tsx); non-review fetches answer benignly.
let nextResponse: Record<string, unknown> = { status: null };

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubMatchMedia();
  window.history.replaceState({}, "", "/");
  nextResponse = { status: null };
  global.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.startsWith("/api/review/request")) {
      return { ok: true, status: 200, json: async () => nextResponse };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  }) as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe("RolefitBoard — live population", () => {
  test("streamed matches appear mid-run with the arrival highlight, then it expires", async () => {
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} />);
    await flush(0); // initial poll — establishes the cursor
    expect(screen.queryByText("Staff Engineer")).toBeNull();

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "Staff Engineer")],
    };
    await flush(4_000); // running-cadence poll delivers the match
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(document.querySelector(".rf-job-card--new")).toBeTruthy();

    // Quiet next tick so the arrival isn't re-flagged; highlight expires at 2.6s.
    nextResponse = { status: "running", reviewedToday: 1, cursor: "C3", newMatches: [] };
    await flush(2_600);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(document.querySelector(".rf-job-card--new")).toBeNull();
  });

  test("props win: a streamed row whose id is already in props never duplicates or overrides", async () => {
    const propsJob = makeJob("greenhouse:acme:1", "Staff Engineer");
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} jobs={[propsJob]} />);
    await flush(0);

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "STALE TITLE — MUST NOT RENDER")],
    };
    await flush(4_000);
    expect(screen.getAllByText("Staff Engineer")).toHaveLength(1);
    expect(screen.queryByText("STALE TITLE — MUST NOT RENDER")).toBeNull();
  });

  test("multiple ticks accumulate distinct matches", async () => {
    nextResponse = { status: "running", reviewedToday: 0, cursor: "C1", newMatches: [] };
    render(<RolefitBoard {...baseProps} />);
    await flush(0);

    nextResponse = {
      status: "running", reviewedToday: 1, cursor: "C2",
      newMatches: [makeJob("greenhouse:acme:1", "Staff Engineer")],
    };
    await flush(4_000);
    nextResponse = {
      status: "running", reviewedToday: 2, cursor: "C3",
      newMatches: [makeJob("greenhouse:acme:2", "Platform Engineer")],
    };
    await flush(4_000);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByText("Platform Engineer")).toBeTruthy();
  });
});
