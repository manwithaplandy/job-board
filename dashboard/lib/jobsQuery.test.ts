import { describe, expect, test } from "vitest";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";

const UID = "user-123";
const base: Filters = {
  companies: [],
  include: [],
  exclude: [],
  remoteOnly: false,
  status: "open",
  verdict: "approve",
  experience: "",
  industry: "",
  subcategory: "",
};

describe("buildJobsQuery", () => {
  test("joins job_reviews scoped to the user via $1", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid",
    );
    expect(q.values[0]).toBe(UID);
    expect(q.text).toContain("r.verdict");
    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
  });

  test("default verdict=approve filters on r.verdict", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.verdict = 'approve'");
  });

  test("verdict=gate_rejected / pending / all", () => {
    expect(buildJobsQuery({ ...base, verdict: "gate_rejected" }, UID).text)
      .toContain("r.stage1_decision = 'reject'");
    expect(buildJobsQuery({ ...base, verdict: "pending" }, UID).text)
      .toContain("r.job_id IS NULL");
    const all = buildJobsQuery({ ...base, verdict: "all" }, UID);
    expect(all.text).not.toContain("r.verdict =");
    expect(all.text).not.toContain("r.stage1_decision =");
  });

  test("company filter placeholder shifts to $2 (userId is $1)", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, UID);
    expect(q.text).toContain("j.company_id = ANY($2)");
    expect(q.values).toEqual([UID, [1, 2]]);
  });

  test("experience/industry/subcategory become equality filters in lockstep", () => {
    const q = buildJobsQuery(
      { ...base, experience: "reach", industry: "software_internet", subcategory: "gaming" },
      UID,
    );
    expect(q.text).toContain("r.experience_match = $2");
    expect(q.text).toContain("r.industry = $3");
    expect(q.text).toContain("r.industry_subcategory = $4");
    expect(q.values).toEqual([UID, "reach", "software_internet", "gaming"]);
  });

  test("include/exclude keep placeholders aligned after userId + verdict", () => {
    const q = buildJobsQuery({ ...base, include: ["engineer"], exclude: ["manager"] }, UID);
    expect(q.text).toContain("j.title ILIKE $2");
    expect(q.text).toContain("j.title NOT ILIKE $3");
    expect(q.values).toEqual([UID, "%engineer%", "%manager%"]);
  });
});
