import { describe, expect, test } from "vitest";
import { applyFilters, facetCounts, filterByApplied, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

function job(p: Partial<JobRow>): JobRow {
  return {
    id: "x", title: "Engineer", url: "u", location: "Remote (US)", remote: true,
    first_seen_at: "2026-06-20T00:00:00Z", closed_at: null, company_name: "Acme", ats: "lever",
    verdict: "approve", human_override: false, experience_match: "match", industry: null, industry_subcategory: null,
    confidence: "high", reasoning: null, stage1_decision: "pass", stage1_reason: null,
    role_category: "Backend", seniority: "senior", work_arrangement: "remote", about: null,
    pay_min: 150000, pay_max: 200000, pay_currency: "USD", pay_period: "year", headcount: null,
    skills_score: 80, experience_score: 70, comp_score: 60, fit_score: 80,
    red_flags: [], skill_gaps: ["Go"], benefits: [], requirements: null, ...p,
  };
}
const ST: BoardFilterState = { search: "", cats: [], locs: [], remote: "all", minFit: 0, payMin: 0, sort: "match" };

describe("applyFilters", () => {
  test("category filter", () => {
    const jobs = [job({ id: "a", role_category: "Backend" }), job({ id: "b", role_category: "Frontend" })];
    expect(applyFilters(jobs, { ...ST, cats: ["Frontend"] }).map((j) => j.id)).toEqual(["b"]);
  });
  test("search across title and skills", () => {
    const jobs = [job({ id: "a", title: "SRE" }), job({ id: "b", title: "Designer", role_category: "Frontend", skill_gaps: [] })];
    expect(applyFilters(jobs, { ...ST, search: "sre" }).map((j) => j.id)).toEqual(["a"]);
  });
  test("minFit excludes lower scores", () => {
    const jobs = [job({ id: "a", fit_score: 90 }), job({ id: "b", fit_score: 60 })];
    expect(applyFilters(jobs, { ...ST, minFit: 75 }).map((j) => j.id)).toEqual(["a"]);
  });
  test("payMin excludes undisclosed and hourly", () => {
    const jobs = [
      job({ id: "a", pay_max: 200000, pay_period: "year" }),
      job({ id: "b", pay_min: null, pay_max: null, pay_period: null }),
      job({ id: "c", pay_max: 300000, pay_period: "hour" }),
    ];
    expect(applyFilters(jobs, { ...ST, payMin: 180 }).map((j) => j.id)).toEqual(["a"]);
  });
  test("remote arrangement filter", () => {
    const jobs = [job({ id: "a", work_arrangement: "hybrid" }), job({ id: "b", work_arrangement: "remote" })];
    expect(applyFilters(jobs, { ...ST, remote: "hybrid" }).map((j) => j.id)).toEqual(["a"]);
  });
  test("remote null-fallback", () => {
    const jobs = [
      job({ id: "match", work_arrangement: null, remote: true }),
      job({ id: "nomatch", work_arrangement: null, remote: false }),
    ];
    expect(applyFilters(jobs, { ...ST, remote: "remote" }).map((j) => j.id)).toEqual(["match"]);
  });
});

describe("sortJobs", () => {
  test("match sorts by fit desc, nulls last", () => {
    const jobs = [job({ id: "a", fit_score: 50 }), job({ id: "b", fit_score: null }), job({ id: "c", fit_score: 90 })];
    expect(sortJobs(jobs, "match").map((j) => j.id)).toEqual(["c", "a", "b"]);
  });
  test("pay sort, nulls last", () => {
    const jobs = [job({ id: "high", pay_max: 200000 }), job({ id: "null", pay_max: null }), job({ id: "low", pay_max: 150000 })];
    expect(sortJobs(jobs, "pay").map((j) => j.id)).toEqual(["high", "low", "null"]);
  });
  test("newest sort", () => {
    const jobs = [
      job({ id: "old", first_seen_at: "2026-06-18T00:00:00Z" }),
      job({ id: "new", first_seen_at: "2026-06-25T00:00:00Z" }),
      job({ id: "mid", first_seen_at: "2026-06-21T00:00:00Z" }),
    ];
    expect(sortJobs(jobs, "newest").map((j) => j.id)).toEqual(["new", "mid", "old"]);
  });
  test("does not mutate input", () => {
    const jobs = [job({ id: "a", fit_score: 50 }), job({ id: "b", fit_score: 90 })];
    const ids = jobs.map((j) => j.id);
    sortJobs(jobs, "match");
    expect(jobs.map((j) => j.id)).toEqual(ids);
  });
  test("az sorts by company", () => {
    const jobs = [job({ id: "a", company_name: "Zeta" }), job({ id: "b", company_name: "Acme" })];
    expect(sortJobs(jobs, "az").map((j) => j.id)).toEqual(["b", "a"]);
  });
});

describe("facetCounts", () => {
  test("counts categories and locations", () => {
    const jobs = [job({ role_category: "Backend", location: "NYC" }), job({ role_category: "Backend", location: "SF" })];
    const f = facetCounts(jobs);
    expect(f.categories).toEqual({ Backend: 2 });
    expect(f.locations).toEqual({ NYC: 1, SF: 1 });
  });
});

describe("filterByApplied", () => {
  const jobs = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" })];

  test("default view hides applied jobs", () => {
    const out = filterByApplied(jobs, new Set(["b"]), false);
    expect(out.map((j) => j.id)).toEqual(["a", "c"]);
  });

  test("applied view shows only applied jobs", () => {
    const out = filterByApplied(jobs, new Set(["b"]), true);
    expect(out.map((j) => j.id)).toEqual(["b"]);
  });

  test("empty set: default shows all, applied view shows none", () => {
    expect(filterByApplied(jobs, new Set(), false).map((j) => j.id)).toEqual(["a", "b", "c"]);
    expect(filterByApplied(jobs, new Set(), true)).toEqual([]);
  });
});
