// Shared fixtures for the variant 1 surface tests (plan Task 1.17). Test-only.
import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import type { JobFacts, MetricResult, ReviewFacts } from "@/lib/workspaces/types";

export const JOB_A = "greenhouse:acme:101";
export const JOB_B = "lever:globex:202";

export function jobFacts(jobId: string): JobFacts {
  return {
    jobId, title: "Engineer", company: "Acme", location: "Remote", remote: true, url: "https://jobs.example/x",
    firstSeenAt: "2026-11-20T00:00:00.000Z", ageDays: 5, closed: false,
  };
}

export function reviewFacts(jobId: string, requirements = 2): ReviewFacts {
  return {
    jobId, verdict: "approve", fitScore: 80, skillsScore: 70, experienceScore: 75, compScore: null,
    payMin: null, payMax: null, payCurrency: null, payPeriod: null, workArrangement: "remote", seniority: "senior",
    redFlags: [], skillGaps: [], reasoning: null, stale: false,
    requirements: Array.from({ length: requirements }, (_, i) => ({ text: `Requirement ${i}`, met: i % 2 === 0 })),
  };
}

export const VALUE_METRIC: MetricResult = { spec: { metric: "response_rate", window: "30d" }, n: 12, kind: "value", value: 0.25 };
export const SERIES_METRIC: MetricResult = {
  spec: { metric: "applications_over_time", window: "30d" }, n: 12, kind: "series", points: [{ x: "2026-11-01", y: 3 }],
};

/** Two jobs read this turn (one with its review) and two metrics. */
export function gatheredFixture(): GatheredData {
  return {
    ...emptyGathered(),
    jobs: { [JOB_A]: jobFacts(JOB_A), [JOB_B]: jobFacts(JOB_B) },
    reviews: { [JOB_A]: reviewFacts(JOB_A) },
    metrics: [VALUE_METRIC, SERIES_METRIC],
  };
}
