// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { JobDetail, type JobDetailProps } from "./JobDetail";
import type { JobRow } from "@/lib/types";

// Regression guard for the plan-phase-J4 leak: the seniority pill used to render
// `{job.seniority}` raw, so seniority==="unknown" showed a literal lowercase "unknown"
// pill and every seniority rendered lowercase. It now routes through displayEnumLabel
// (shared with the work_arrangement chip) — hidden for "unknown", Title-Cased otherwise.

// fit_score:null keeps hasReview false so ReviewPanel/ApplicationPanel don't render;
// the seniority pill lives in the always-rendered header, so this is enough to exercise it.
function makeJob(overrides: Partial<JobRow>): JobRow {
  return {
    id: "job-1",
    title: "Staff Engineer",
    location: "Phoenix, AZ",
    remote: null,
    first_seen_at: "2026-07-01T00:00:00.000Z",
    closed_at: null,
    company_name: "Acme",
    ats: "greenhouse",
    human_override: false,
    verdict: null,
    role_category: null,
    seniority: null,
    work_arrangement: null,
    pay_min: null,
    pay_max: null,
    pay_currency: null,
    pay_period: null,
    headcount: null,
    skills_score: null,
    experience_score: null,
    comp_score: null,
    fit_score: null,
    skill_gaps: null,
    ...overrides,
  };
}

const baseProps: Omit<JobDetailProps, "job"> = {
  nowIso: "2026-07-04T00:00:00.000Z",
  isAuthed: false,
  gen: {},
  genData: {},
  genError: {},
  onGenerate: vi.fn(),
  onCopy: vi.fn(),
  copiedId: null,
  coverGen: {},
  coverData: {},
  coverError: {},
  onGenerateCover: vi.fn(),
  coverEdited: {},
  onCoverEditSaved: vi.fn(),
  onCoverEditReset: vi.fn(),
  onPrepare: vi.fn(),
  resumeStale: false,
  onMarkApplied: vi.fn(),
  onOpenProfile: vi.fn(),
};

afterEach(() => cleanup());

describe("JobDetail seniority pill", () => {
  test('seniority "unknown" renders no literal "unknown" pill', () => {
    render(<JobDetail job={makeJob({ seniority: "unknown" })} {...baseProps} />);
    expect(screen.queryByText("unknown")).toBeNull();
    expect(screen.queryByText("Unknown")).toBeNull();
  });

  test('seniority "senior" renders a Title-Cased "Senior" pill (not raw lowercase)', () => {
    render(<JobDetail job={makeJob({ seniority: "senior" })} {...baseProps} />);
    expect(screen.getByText("Senior")).toBeTruthy();
    expect(screen.queryByText("senior")).toBeNull();
  });
});
