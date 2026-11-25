"use client";

import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import type { JobFacts, MemoDoc, ReviewFacts } from "@/lib/workspaces/types";
import { BlockList } from "./BlockList";
import type { BlockRows } from "./types";

// The gallery's variant 1 blocks (visual fixtures agent-blocks-*): the production blocks
// with fixed gathered data and inert intents. The handler lives here because a server
// component cannot pass functions to client components.

const ACME = "greenhouse:acme:1001";
const GLOBEX = "lever:globex:2002";
const PROPOSAL = "00000000-0000-4000-8000-0000000000c1";

function job(jobId: string, over: Partial<JobFacts>): JobFacts {
  return {
    jobId, title: "", company: "", location: "Remote", remote: true, url: "https://example.com/jobs/1001",
    firstSeenAt: "2026-11-18T00:00:00.000Z", ageDays: 2, closed: false, ...over,
  };
}

function review(jobId: string, over: Partial<ReviewFacts>): ReviewFacts {
  return {
    jobId, verdict: "approve", fitScore: null, skillsScore: null, experienceScore: null, compScore: null,
    payMin: null, payMax: null, payCurrency: null, payPeriod: null, workArrangement: null, seniority: "senior",
    redFlags: [], skillGaps: [], requirements: [], reasoning: null, stale: false, ...over,
  };
}

export const FIXTURE_GATHERED: GatheredData = {
  ...emptyGathered(),
  profile: {
    name: "Sam Rivera",
    titles: ["Senior Backend Engineer", "Platform Engineer"],
    yearsOfExperience: 8,
    education: ["BS Computer Science"],
    preferredLocations: ["Remote", "Austin, TX"],
    workAuthorized: true,
    needsSponsorship: false,
  },
  jobs: {
    [ACME]: job(ACME, { title: "Senior Product Engineer", company: "Acme Systems" }),
    [GLOBEX]: job(GLOBEX, {
      title: "Staff Backend Engineer", company: "Globex", location: "Austin, TX", remote: false,
      url: "https://example.com/jobs/2002", ageDays: 9,
    }),
  },
  reviews: {
    [ACME]: review(ACME, {
      fitScore: 84, payMin: 175000, payMax: 205000, payCurrency: "USD", payPeriod: "year", workArrangement: "remote",
      requirements: [
        { text: "5+ years building web products", met: true },
        { text: "TypeScript and React", met: true },
        { text: "Postgres at scale", met: false },
      ],
    }),
    [GLOBEX]: review(GLOBEX, {
      fitScore: 71, workArrangement: "onsite", redFlags: ["On-call every other week"],
      requirements: [
        { text: "Go or Rust in production", met: false },
        { text: "Distributed systems", met: true },
      ],
    }),
  },
};

const CURRENT_MEMO: MemoDoc = { ...emptyMemoDoc(), role: "Senior backend or product engineer.", compensation: "Market rate." };

export const JOBS_FIXTURE_ROWS: BlockRows = {
  memo: {
    current: CURRENT_MEMO,
    version: 3,
    proposals: {
      [PROPOSAL]: {
        id: PROPOSAL,
        baseVersion: 3,
        proposedDoc: { ...CURRENT_MEMO, compensation: "At least $180k base salary." },
        rationale: "You skipped three jobs for pay this week.",
        status: "pending",
        source: "interactive",
        createdAt: "2026-11-20T10:00:00.000Z",
      },
    },
  },
};

export const JOBS_FIXTURE_PAYLOAD: SurfacePayloadV1 = {
  variant: 1,
  title: "Two strong matches",
  blocks: [
    { type: "Callout", tone: "info", text: "Both postings fit what you asked for. Acme pays more; Globex is on-site." },
    { type: "JobCard", jobId: ACME, note: "Closest to your product work, and fully remote." },
    { type: "JobComparison", jobIds: [ACME, GLOBEX], rowOrder: ["requirements", "pay", "arrangement", "red_flags", "age", "unknowns"], verdict: "Acme first: remote, listed pay and fewer gaps." },
    { type: "ShortlistQueue", jobIds: [ACME, GLOBEX] },
    { type: "MemoDiff", proposalId: PROPOSAL },
    { type: "ProfileReadback", note: "Tell me if any of this is wrong." },
    {
      type: "IntakeQuestions",
      questions: [
        { id: "floor", label: "What base salary is your floor?", kind: "text" },
        { id: "level", label: "Which level are you aiming for?", kind: "choice", options: ["Senior", "Staff"] },
      ],
    },
  ],
};

const FIXTURE_RESUME: TailoredResume = {
  name: "Sam Rivera",
  contact: "sam@example.com · Austin, TX",
  headline: "Senior Backend Engineer",
  summary: "Eight years building reliable web products and the data platforms behind them.",
  skills: ["TypeScript", "React", "Node.js", "Postgres", "Go", "Kubernetes", "AWS", "Terraform", "GraphQL", "Redis", "Kafka", "CI/CD"],
  experience: [
    {
      role: "Senior Backend Engineer",
      company: "Initrode",
      dates: "2021 to 2026",
      bullets: ["Built the billing pipeline that settles 2M invoices a month.", "Cut p95 API latency from 900 ms to 180 ms."],
    },
    { role: "Software Engineer", company: "Hooli", dates: "2018 to 2021", bullets: ["Shipped the self-serve onboarding flow in React."] },
  ],
  education: ["BS Computer Science"],
  certifications: [],
};

export const PREP_FIXTURE_GATHERED: GatheredData = {
  ...FIXTURE_GATHERED,
  metrics: [
    { spec: { metric: "response_rate", window: "30d" }, n: 14, kind: "value", value: 0.29 },
    { spec: { metric: "response_rate", window: "7d" }, n: 2, kind: "value", value: null },
    { spec: { metric: "stale_applications", window: "all" }, n: 9, kind: "value", value: 1 },
    {
      spec: { metric: "applications_by_stage", groupBy: "stage", window: "90d" }, n: 9, kind: "rows", columns: ["stage", "count"],
      rows: [["applied", 5], ["interviewing", 3], ["offer", 1]],
    },
  ],
  applications: [
    {
      id: "00000000-0000-4000-8000-0000000000e1", jobId: GLOBEX, stage: "applied", closedReason: null, nextStepOn: null,
      updatedAt: "2026-11-02T00:00:00.000Z", job: FIXTURE_GATHERED.jobs[GLOBEX], events: [],
      documents: { resume: true, cover: true, outdated: false },
    },
  ],
};

export const PREP_FIXTURE_ROWS: BlockRows = {
  now: "2026-11-20T00:00:00.000Z",
  packages: {
    [ACME]: {
      status: "prepared",
      resume: FIXTURE_RESUME,
      coverLetter: {
        greeting: "Dear Acme hiring team,",
        paragraphs: ["I build web products and the systems that keep them fast.", "I would like to bring that to Acme Systems."],
        closing: "Best regards,",
        signature: "Sam Rivera",
      },
      coverLetterEditedText: null,
      prefilledAnswers: [
        { question: "Why Acme?", answer: "Your product work matches mine." },
        { question: "Earliest start date?", answer: "Two weeks after an offer." },
      ],
      applyUrl: "https://example.com/jobs/1001/apply",
      ats: "greenhouse",
    },
  },
};

export const PREP_FIXTURE_PAYLOAD: SurfacePayloadV1 = {
  variant: 1,
  title: "Your Acme application is ready",
  blocks: [
    { type: "PrepChecklist", jobId: ACME },
    {
      type: "EvidenceMap",
      jobId: ACME,
      rows: [
        { requirementIndex: 0, evidence: "Eight years shipping web products at Initrode and Hooli.", gap: false },
        { requirementIndex: 1, evidence: "React onboarding flow at Hooli; TypeScript throughout.", gap: false },
        { requirementIndex: 2, evidence: "Postgres is listed, but no scale numbers yet.", gap: true },
      ],
    },
    { type: "DocumentPreview", jobId: ACME, doc: "resume" },
    { type: "StatRow", metricRefs: [0, 1, 2] },
    { type: "MetricChart", metricRef: 3, viz: "bar", title: "Where your applications are" },
    { type: "StaleList", limit: 3 },
  ],
};

const inert = () => {};

export function AgentBlocksJobsFixture() {
  return <BlockList surfaceKey="fixture-jobs" payload={JOBS_FIXTURE_PAYLOAD} gathered={FIXTURE_GATHERED} rows={JOBS_FIXTURE_ROWS} onIntent={inert} />;
}

export function AgentBlocksPrepFixture() {
  return <BlockList surfaceKey="fixture-prep" payload={PREP_FIXTURE_PAYLOAD} gathered={PREP_FIXTURE_GATHERED} rows={PREP_FIXTURE_ROWS} onIntent={inert} />;
}
