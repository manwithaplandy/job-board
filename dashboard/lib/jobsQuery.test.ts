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
  location: "",
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
    expect(buildJobsQuery(base, UID).text).toContain(
      "COALESCE(rc.verdict, r.verdict) = 'approve'",
    );
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
    expect(q.text).toContain("COALESCE(rc.experience_match, r.experience_match) = $2");
    expect(q.text).toContain("COALESCE(rc.industry, r.industry) = $3");
    expect(q.text).toContain("COALESCE(rc.industry_subcategory, r.industry_subcategory) = $4");
    expect(q.values).toEqual([UID, "reach", "software_internet", "gaming"]);
  });

  test("include/exclude keep placeholders aligned after userId + verdict", () => {
    const q = buildJobsQuery({ ...base, include: ["engineer"], exclude: ["manager"] }, UID);
    expect(q.text).toContain("j.title ILIKE $2");
    expect(q.text).toContain("j.title NOT ILIKE $3");
    expect(q.values).toEqual([UID, "%engineer%", "%manager%"]);
  });

  test("errored rows excluded by default (r.error IS NULL always present)", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.error IS NULL");
  });

  test("verdict=all still contains r.error IS NULL", () => {
    expect(buildJobsQuery({ ...base, verdict: "all" }, UID).text).toContain("r.error IS NULL");
  });

  test("verdict=pending + experience skips dimension filter but retains pending clause", () => {
    const q = buildJobsQuery({ ...base, verdict: "pending", experience: "reach" }, UID);
    expect(q.text).not.toContain("r.experience_match =");
    expect(q.text).toContain("r.job_id IS NULL");
  });

  test("verdict=approve + experience applies dimension filter", () => {
    const q = buildJobsQuery({ ...base, verdict: "approve", experience: "reach" }, UID);
    expect(q.text).toContain("COALESCE(rc.experience_match, r.experience_match) = $2");
  });

  test("null owner: no review join, columns, error clause, or user binding", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("job_reviews");
    expect(q.text).not.toContain("r.verdict");
    expect(q.text).not.toContain("r.error IS NULL");
    expect(q.text).toContain("j.closed_at IS NULL"); // plain status filter still applies
    expect(q.values).toEqual([]);
  });

  test("null owner: plain filters bind from $1", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, null);
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.values).toEqual([[1, 2]]);
  });

  test("location filter adds an ILIKE clause in the owner branch", () => {
    const q = buildJobsQuery({ ...base, location: "remote" }, UID);
    expect(q.text).toContain("j.location ILIKE $2");
    expect(q.values).toEqual([UID, "%remote%"]);
  });

  test("location filter applies without an owner, binding from $1", () => {
    const q = buildJobsQuery({ ...base, location: "berlin" }, null);
    expect(q.text).toContain("j.location ILIKE $1");
    expect(q.values).toEqual(["%berlin%"]);
  });

  test("owner preferred locations add a remote-or-exact-match clause at $2", () => {
    const q = buildJobsQuery(base, UID, ["Berlin, Germany", "Remote"]);
    expect(q.text).toContain("(j.remote IS TRUE OR j.location = ANY($2))");
    expect(q.values).toEqual([UID, ["Berlin, Germany", "Remote"]]);
  });

  test("empty owner preferred locations add no baseline clause", () => {
    const q = buildJobsQuery(base, UID, []);
    expect(q.text).not.toContain("j.location = ANY(");
  });

  test("owner preferred locations apply without an owner, binding from $1", () => {
    const q = buildJobsQuery(base, null, ["Berlin, Germany"]);
    expect(q.text).toContain("(j.remote IS TRUE OR j.location = ANY($1))");
    expect(q.values).toEqual([["Berlin, Germany"]]);
  });

  test("selects the lean rolefit list columns when an owner is present", () => {
    const t = buildJobsQuery(base, UID).text;
    for (const col of ["r.role_category", "r.fit_score", "r.pay_min",
      "r.skills_score", "r.work_arrangement", "r.skill_gaps", "r.seniority"]) {
      expect(t).toContain(col);
    }
  });

  test("does NOT select heavy detail-only or dead columns", () => {
    // Detail-only fields are fetched lazily via /api/jobs/[id]; the rest are read
    // by no render path. Keeping them out of the list query is the payload trim.
    const t = buildJobsQuery(base, UID).text;
    for (const col of ["r.reasoning", "r.requirements", "r.about", "r.benefits",
      "r.red_flags", "r.stage1_reason", "r.stage1_decision", "r.confidence",
      "r.experience_match", "r.industry", "r.industry_subcategory", "j.url", "c.ats"]) {
      expect(t).not.toContain(col);
    }
  });

  test("rolefit columns absent without an owner", () => {
    const t = buildJobsQuery(base, null).text;
    expect(t).not.toContain("r.fit_score");
    expect(t).not.toContain("r.skill_gaps");
  });

  test("selects r.human_override when an owner is present", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.human_override");
  });

  test("human_override absent without an owner", () => {
    expect(buildJobsQuery(base, null).text).not.toContain("r.human_override");
  });

  test("coalesces corrections over the model review when an owner is present", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = $1::uuid",
    );
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) AS verdict");
    expect(q.text).toContain("COALESCE(rc.fit_score, r.fit_score) AS fit_score");
    // the verdict filter uses the coalesced value so filtering matches display
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
  });

  test("no corrections join without an owner", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("review_corrections");
  });
});
