// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApplicationPanel, type ApplicationPanelProps } from "./ApplicationPanel";
import type { JobRow } from "@/lib/types";

// Regression guard: the external "Apply on {ATS}" link is the panel's primary CTA at
// ALL times — accent fill, never the muted surface/outline treatment. It used to lead
// only after Prepare ran, which in dark mode left Apply background-colored (invisible)
// while the blue Prepare button pulled the eye. Prepare is secondary whenever an apply
// link exists; it only leads when the job has no usable apply url.

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
    url: "https://boards.greenhouse.io/acme/jobs/1",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<ApplicationPanelProps> = {}) {
  const props: ApplicationPanelProps = {
    job: makeJob({}),
    isAuthed: true,
    resumeState: undefined,
    resumeData: undefined,
    resumeStale: false,
    onGenerateResume: vi.fn(),
    onRegenerateResume: vi.fn(),
    onCopyResume: vi.fn(),
    resumeCopyLabel: "Copy",
    usingSample: false,
    onOpenProfile: vi.fn(),
    coverState: undefined,
    coverData: undefined,
    onGenerateCover: vi.fn(),
    onRegenerateCover: vi.fn(),
    onPrepare: vi.fn(),
    greenhouseQuestions: null,
    prefilledAnswers: null,
    status: null,
    appliedAt: null,
    onMarkApplied: vi.fn(),
    ...overrides,
  };
  return render(<ApplicationPanel {...props} />);
}

afterEach(() => cleanup());

describe("ApplicationPanel CTA hierarchy", () => {
  test("Apply link leads with accent styling even before Prepare runs", () => {
    renderPanel({ status: null });

    const apply = screen.getByRole("link", { name: /Apply on/ });
    const applyStyle = apply.getAttribute("style") ?? "";
    expect(applyStyle).toContain("background: var(--accent)");
    expect(applyStyle).not.toContain("var(--bg-surface)");

    const prepare = screen.getByRole("button", { name: /Prepare application/ });
    const prepareStyle = prepare.getAttribute("style") ?? "";
    expect(prepareStyle).toContain("background: var(--bg-surface)");
    expect(prepareStyle).not.toContain("background: var(--accent)");
  });

  test("Apply link keeps accent styling once prepared", () => {
    renderPanel({ status: "prepared" });

    const apply = screen.getByRole("link", { name: /Apply on/ });
    expect(apply.getAttribute("style") ?? "").toContain("background: var(--accent)");

    const prepare = screen.getByRole("button", { name: /Re-prepare/ });
    expect(prepare.getAttribute("style") ?? "").toContain("background: var(--bg-surface)");
  });

  test("Prepare leads only when the job has no apply url", () => {
    renderPanel({ job: makeJob({ url: null }), status: null });

    expect(screen.queryByRole("link", { name: /Apply on/ })).toBeNull();
    const prepare = screen.getByRole("button", { name: /Prepare application/ });
    expect(prepare.getAttribute("style") ?? "").toContain("background: var(--accent)");
  });
});
