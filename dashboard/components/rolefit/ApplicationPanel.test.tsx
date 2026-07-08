// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    resumeInstructions: "",
    onResumeInstructionsChange: () => {},
    coverInstructions: "",
    onCoverInstructionsChange: () => {},
    resumeInstructionsDirty: false,
    resumeInstructionsApplied: "none",
    onSaveResumeInstructions: async () => {},
    coverInstructionsDirty: false,
    coverInstructionsApplied: "none",
    onSaveCoverInstructions: async () => {},
    coverState: undefined,
    coverData: undefined,
    onGenerateCover: vi.fn(),
    onRegenerateCover: vi.fn(),
    coverEditedText: null,
    onCoverEditSaved: () => {},
    onCoverEditReset: () => {},
    onPrepare: vi.fn(),
    greenhouseQuestions: null,
    prefilledAnswers: null,
    status: null,
    appliedAt: null,
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

    const prepare = screen.getByRole("button", { name: /Prefill application/ });
    const prepareStyle = prepare.getAttribute("style") ?? "";
    expect(prepareStyle).toContain("background: var(--bg-surface)");
    expect(prepareStyle).not.toContain("background: var(--accent)");
  });

  test("Apply link keeps accent styling once prepared", () => {
    renderPanel({ status: "prepared" });

    const apply = screen.getByRole("link", { name: /Apply on/ });
    expect(apply.getAttribute("style") ?? "").toContain("background: var(--accent)");

    const prepare = screen.getByRole("button", { name: /Re-prefill/ });
    expect(prepare.getAttribute("style") ?? "").toContain("background: var(--bg-surface)");
  });

  test("Prepare leads only when the job has no apply url", () => {
    renderPanel({ job: makeJob({ url: null }), status: null });

    expect(screen.queryByRole("link", { name: /Apply on/ })).toBeNull();
    const prepare = screen.getByRole("button", { name: /Prefill application/ });
    expect(prepare.getAttribute("style") ?? "").toContain("background: var(--accent)");
  });
});

describe("ApplicationPanel — Greenhouse Prefill button + collapsible questions", () => {
  test("Greenhouse job shows a 'Prefill application' button", () => {
    renderPanel({ job: makeJob({ ats: "greenhouse" }) });
    expect(screen.getByRole("button", { name: /Prefill application/ })).toBeTruthy();
    // Greenhouse subtitle advertises prefilled answers (the GH-only behavior).
    expect(screen.getByText(/prefilled answers/i)).toBeTruthy();
  });

  test("non-Greenhouse job hides the prefill button (résumé/cover panels remain)", () => {
    renderPanel({ job: makeJob({ ats: "lever", url: "https://jobs.lever.co/acme/1" }) });
    expect(screen.queryByRole("button", { name: /Prefill application/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Prepare application/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Generate cover letter/ })).toBeTruthy();
    // Non-Greenhouse subtitle must NOT claim prefilled answers (prefill is GH-only) —
    // it advertises only the standalone résumé + cover generation available here.
    expect(screen.queryByText(/prefilled answers/i)).toBeNull();
    expect(screen.getByText(/Tailored résumé and cover letter/)).toBeTruthy();
  });

  test("Greenhouse questions render collapsed by default, expand on click", () => {
    renderPanel({
      job: makeJob({ ats: "greenhouse" }),
      greenhouseQuestions: { questions: [
        { label: "Why us?", required: true, fields: [{ name: "q0", type: "textarea", options: [] }] },
        { label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
      ] },
      prefilledAnswers: null,
    });
    // The single toggle button carries the summary; its accessible name (concatenated
    // child text) uniquely contains "Application questions". Query it specifically to
    // avoid getByText's multiple-match throw.
    const toggle = screen.getByRole("button", { name: /Application questions/i });
    expect(toggle.textContent).toMatch(/cover letter requested/i); // flag shown while collapsed
    expect(screen.queryByText("Why us?")).toBeNull();               // labels hidden until expanded
    fireEvent.click(toggle);
    expect(screen.getByText("Why us?")).toBeTruthy();
  });

  test("cover-letter-only posting (file field) still shows the panel + flag", () => {
    renderPanel({
      job: makeJob({ ats: "greenhouse" }),
      greenhouseQuestions: { questions: [
        { label: "Cover Letter", required: false, fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
      ] },
      prefilledAnswers: null,
    });
    // mergeGreenhouseQuestions drops file fields (ghRows is empty), but the panel must
    // still render so the charged cover-letter leg is signalled (spec transparency).
    const toggle = screen.getByRole("button", { name: /Application questions/i });
    expect(toggle.textContent).toMatch(/cover letter requested/i);
  });
});
