"use client";

import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
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

const inert = () => {};

export function AgentBlocksJobsFixture() {
  return <BlockList payload={JOBS_FIXTURE_PAYLOAD} gathered={FIXTURE_GATHERED} rows={JOBS_FIXTURE_ROWS} onIntent={inert} />;
}
