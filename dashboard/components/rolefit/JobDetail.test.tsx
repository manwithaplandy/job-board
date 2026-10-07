// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { JobDetail, type JobDetailProps } from "./JobDetail";
import type { ApplicationPackage, JobRow } from "@/lib/types";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

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
    location_canonicals: null,
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
  resumeInstructions: {},
  coverInstructions: {},
  onResumeInstructionsChange: vi.fn(),
  onCoverInstructionsChange: vi.fn(),
  savedResumeInstructions: {},
  savedCoverInstructions: {},
  onSaveResumeInstructions: vi.fn(),
  onSaveCoverInstructions: vi.fn(),
  coverEdited: {},
  onCoverEditSaved: vi.fn(),
  onCoverEditReset: vi.fn(),
  onPrepare: vi.fn(),
  greenhouseQuestions: null,
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

// The applied-status badge and Save-enabled state are DERIVED in JobDetail (the
// coverInstructionsApplied / coverInstructionsDirty ternaries feeding ApplicationPanel),
// not passed in — so a wiring regression (e.g. comparing the box against the draft
// instead of the generated-with column, or dropping the state!=="done" guard) would slip
// past GenerationInstructions' own leaf tests. This locks that derivation on the cover leg.
describe("JobDetail — generation-instructions applied/dirty derivation", () => {
  const LETTER: TailoredCoverLetter = {
    greeting: "Dear Hiring Manager,",
    paragraphs: ["Body."],
    closing: "Sincerely,",
    signature: "Ada",
  };
  // A prepared package whose cover letter was generated WITH "Mention the launch".
  const pkg: ApplicationPackage = {
    jobId: "job-1",
    status: "prepared",
    resume: null,
    coverLetter: LETTER,
    prefilledAnswers: null,
    applyUrl: null,
    profileVersion: null,
    resumeInstructions: null,
    coverLetterInstructions: "Mention the launch",
    resumeInstructionsDraft: null,
    coverLetterInstructionsDraft: null,
    coverLetterEditedText: null,
    preparedAt: "2026-07-01T00:00:00.000Z",
    appliedAt: null,
  };

  // Reviewed job so the ApplicationPanel renders; cover leg is "done" with the fixture letter.
  function renderCover(coverBox: string, savedCover: string) {
    render(
      <JobDetail
        job={makeJob({ fit_score: 88 })}
        {...baseProps}
        isAuthed
        pkg={pkg}
        coverGen={{ "job-1": "done" }}
        coverData={{ "job-1": LETTER }}
        coverInstructions={{ "job-1": coverBox }}
        savedCoverInstructions={{ "job-1": savedCover }}
      />,
    );
    // Two "Generation instructions" expanders (résumé + cover); open the cover one (last).
    const toggles = screen.getAllByRole("button", { name: /generation instructions/i });
    fireEvent.click(toggles[toggles.length - 1]);
  }

  test('box matches the generated-with instructions → "Applied", Save disabled (not dirty)', () => {
    renderCover("Mention the launch", "Mention the launch");
    expect(screen.getByText(/Applied to current cover letter/)).toBeTruthy();
    expect(screen.queryByText(/Not yet applied/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('box diverges from generated-with → "Not yet applied", Save enabled (dirty)', () => {
    renderCover("Emphasize scale instead", "Mention the launch");
    expect(screen.getByText(/Not yet applied — Regenerate to apply/)).toBeTruthy();
    expect(screen.queryByText(/Applied to current cover letter/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

for (const status of ["prepared","applied"] as const) {
  test(`unscored retained ${status} application shows saved artifacts, answers and status without generation`, () => {
    const resume={name:"Ada",contact:"ada@example.test",headline:"Saved résumé headline",summary:"Retained résumé summary",skills:["TypeScript"],experience:[],education:[],certifications:[]};
    const letter={greeting:"Dear team,",paragraphs:["Retained cover letter body"],closing:"Sincerely,",signature:"Ada"};
    const pkg:ApplicationPackage={jobId:"job-1",status,resume,coverLetter:letter,
      descriptionSnapshot:"Immutable application JD",questionsSnapshot:null,
      prefilledAnswers:[{question:"Historical orphan question",answer:"Retained historical answer"}],
      applyUrl:null,profileVersion:null,resumeInstructions:null,coverLetterInstructions:null,
      resumeInstructionsDraft:null,coverLetterInstructionsDraft:null,coverLetterEditedText:null,
      preparedAt:baseProps.nowIso,appliedAt:status === "applied" ? baseProps.nowIso : null};
    render(<JobDetail {...baseProps} job={makeJob({fit_score:null,verdict:null,description:null,url:"https://boards.greenhouse.io/fixture/jobs/1"})} isAuthed pkg={pkg}
      gen={{"job-1":"done"}} genData={{"job-1":resume}} coverGen={{"job-1":"done"}} coverData={{"job-1":letter}}
      currentQuestions={{questions:[{label:"Current employer question",required:false,fields:[{name:"current",type:"input_text",options:[]}]}]}}/>);
    expect(screen.getByText("Not yet reviewed")).toBeTruthy();
    expect(screen.getAllByRole("link",{name:/Apply/})).toHaveLength(1);
    expect(screen.getByText("Retained résumé summary")).toBeTruthy();
    expect(screen.getByText("Retained cover letter body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/Application questions/}));
    expect(screen.getByText("Retained historical answer")).toBeTruthy();
    expect(screen.getByText("Historical orphan question")).toBeTruthy();
    expect(screen.getByText(/historical question schema is unavailable/)).toBeTruthy();
    expect(screen.getByText("Immutable application JD")).toBeTruthy();
    if(status === "applied") expect(screen.getByText("Applied · you")).toBeTruthy();
    else expect(screen.getByText("Prepared application")).toBeTruthy();
    expect(screen.queryByRole("button",{name:/Regenerate|Re-prefill|Generate résumé|Generate cover letter/})).toBeNull();
    expect(screen.queryByRole("button",{name:/Generation instructions/})).toBeNull();
  });
}
