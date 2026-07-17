// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

// Card-level reject is a signed-in triage affordance. For anon visitors it must not
// render at all: clicking it would optimistically hide the job, then the server
// action's requireUserId would redirect the visitor to /login mid-Undo-toast.

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
  nowIso: "2026-07-17T00:00:00.000Z",
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

beforeEach(() => {
  stubMatchMedia();
  // No ?job= deep link: with nothing selected, the narrow layout shows the list pane.
  window.history.replaceState({}, "", "/");
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RolefitBoard - card reject affordance gating", () => {
  test("authed board offers a per-card Reject control in the all view", () => {
    render(<RolefitBoard {...baseProps} />);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject Staff Engineer" })).toBeTruthy();
  });

  test("anon board renders the same card with no reject control", () => {
    render(<RolefitBoard {...baseProps} isAuthed={false} />);
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reject Staff Engineer" })).toBeNull();
  });
});
