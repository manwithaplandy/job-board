"use client";

import type { ApplicationPackage, JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import { JobDetail, type JobDetailProps } from "./JobDetail";
import { JobList } from "./JobList";

export type VisualBoardStateName = "selected" | "filter-empty" | "rejected" | "applied" | "loading" | "error-retry" | "generation" | "application-package";

const noop = () => {};
const noopSave = async () => {};
const JOB: JobRow = {
  id: "visual-job-1", title: "Senior Product Engineer", company_name: "Acme Systems",
  location: "Remote", location_canonicals: null, remote: true, first_seen_at: "2026-07-01T00:00:00.000Z", closed_at: null,
  ats: "greenhouse", human_override: false, verdict: "approve", role_category: "engineering",
  seniority: "senior", work_arrangement: "remote", pay_min: 175000, pay_max: 210000,
  pay_currency: "USD", pay_period: "year", headcount: null, skills_score: 94,
  experience_score: 90, comp_score: 91, fit_score: 92, skill_gaps: ["Domain onboarding"],
  url: "https://boards.greenhouse.io/acme/jobs/visual-1",
};
const RESUME: TailoredResume = {
  name: "Alex Morgan", contact: "alex@example.com", headline: "Product Engineer · Platform systems",
  summary: "Product-minded engineer who ships reliable workflow software.", skills: ["TypeScript", "React", "Postgres"],
  experience: [{ role: "Senior Engineer", company: "Northstar", dates: "2022–Present", bullets: ["Led workflow reliability improvements."] }],
  education: ["B.S. Computer Science"], certifications: [],
};
const COVER: TailoredCoverLetter = {
  greeting: "Dear Hiring Manager,", paragraphs: ["I’m excited to bring product engineering experience to Acme Systems."],
  closing: "Sincerely,", signature: "Alex Morgan",
};
const PACKAGE: ApplicationPackage = {
  jobId: JOB.id, status: "prepared", resume: RESUME, coverLetter: COVER, prefilledAnswers: null,
  applyUrl: JOB.url ?? null, profileVersion: "visual-profile-v3", resumeInstructions: "Emphasize platform work",
  coverLetterInstructions: "Keep it concise", resumeInstructionsDraft: null, coverLetterInstructionsDraft: null,
  coverLetterEditedText: null, preparedAt: "2026-07-04T00:00:00.000Z", appliedAt: null,
};

function detailProps(state: VisualBoardStateName): Omit<JobDetailProps, "job"> {
  const prepared = state === "application-package" || state === "applied";
  const generating = state === "generation";
  return {
    nowIso: "2026-07-04T00:00:00.000Z", isAuthed: true,
    gen: prepared ? { [JOB.id]: "done" } : generating ? { [JOB.id]: "busy" } : {},
    genData: prepared ? { [JOB.id]: RESUME } : {}, genError: {}, onGenerate: noop, onCopy: noop,
    copiedId: null, coverGen: prepared ? { [JOB.id]: "done" } : {},
    coverData: prepared ? { [JOB.id]: COVER } : {}, coverError: {}, onGenerateCover: noop,
    resumeInstructions: { [JOB.id]: "Emphasize platform work" }, coverInstructions: { [JOB.id]: "Keep it concise" },
    onResumeInstructionsChange: noop, onCoverInstructionsChange: noop,
    savedResumeInstructions: { [JOB.id]: "Emphasize platform work" }, savedCoverInstructions: { [JOB.id]: "Keep it concise" },
    onSaveResumeInstructions: noopSave, onSaveCoverInstructions: noopSave, coverEdited: {},
    onCoverEditSaved: noop, onCoverEditReset: noop, onPrepare: noop, generating,
    onCancelGeneration: generating ? noop : undefined, greenhouseQuestions: null,
    pkg: prepared ? { ...PACKAGE, status: state === "applied" ? "applied" : "prepared", appliedAt: state === "applied" ? "2026-07-04T00:00:00.000Z" : null } : undefined,
    resumeStale: false, onMarkApplied: noop, onOpenProfile: noop, onReject: noop, onUnapply: noop,
    isRejected: state === "rejected", onUnreject: noop,
    detailState: state === "loading" ? { status: "loading" } : state === "error-retry" ? { status: "error" } : undefined,
    onRetryDetail: noop,
  };
}

/** Deterministic visual harness around the same board components used by RolefitBoard. */
export function VisualBoardState({ state }: { state: VisualBoardStateName }) {
  if (state === "filter-empty") {
    return <div className="rf-board-list-pane rf-visual-production-board"><JobList jobs={[]} selectedId={null} onSelect={noop} onClearFilters={noop} hasUnfilteredJobs viewPoolCount={3} /></div>;
  }
  if (state === "selected" || state === "rejected") {
    return (
      <div className="rf-visual-board-composition rf-visual-production-board" data-board-story={state}>
        <div className="rf-board-list-pane">
          <JobList jobs={[JOB]} selectedId={JOB.id} onSelect={noop} onClearFilters={noop}
            view={state === "rejected" ? "rejected" : "all"} hasUnfilteredJobs viewPoolCount={1} />
        </div>
        <div className="rf-board-detail-pane"><JobDetail job={JOB} {...detailProps(state)} /></div>
      </div>
    );
  }
  return <div className="rf-board-detail-pane rf-visual-production-board"><JobDetail job={JOB} {...detailProps(state)} /></div>;
}
