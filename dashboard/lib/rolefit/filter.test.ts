import { describe, expect, test } from "vitest";
import { applyFilters, facetCounts, filterByApplied, filterByView, mergeRejectedPool, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
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
const ST: BoardFilterState = { search: "", cats: [], locs: [], sources: [], remote: "all", minFit: 0, payMin: 0, sort: "match" };

describe("applyFilters", () => {
  test("category filter", () => {
    const jobs = [job({ id: "a", role_category: "Backend" }), job({ id: "b", role_category: "Frontend" })];
    expect(applyFilters(jobs, { ...ST, cats: ["Frontend"] }).map((j) => j.id)).toEqual(["b"]);
  });
  test("search across title and skills", () => {
    const jobs = [job({ id: "a", title: "SRE" }), job({ id: "b", title: "Designer", role_category: "Frontend", skill_gaps: [] })];
    expect(applyFilters(jobs, { ...ST, search: "sre" }).map((j) => j.id)).toEqual(["a"]);
  });
  test("search matches location", () => {
    const jobs = [
      job({ id: "a", title: "Engineer", company_name: "Acme", location: "Berlin, DE", role_category: null, skill_gaps: [] }),
      job({ id: "b", title: "Engineer", company_name: "Acme", location: "Remote (US)", role_category: null, skill_gaps: [] }),
    ];
    expect(applyFilters(jobs, { ...ST, search: "berlin" }).map((j) => j.id)).toEqual(["a"]);
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
  test("source filter keeps only matching providers", () => {
    const jobs = [job({ id: "a", ats: "greenhouse" }), job({ id: "b", ats: "workday" })];
    expect(applyFilters(jobs, { ...ST, sources: ["workday"] }).map((j) => j.id)).toEqual(["b"]);
  });
  test("source filter is multi-select (OR within the filter)", () => {
    const jobs = [
      job({ id: "a", ats: "greenhouse" }),
      job({ id: "b", ats: "workday" }),
      job({ id: "c", ats: "lever" }),
    ];
    expect(applyFilters(jobs, { ...ST, sources: ["greenhouse", "lever"] }).map((j) => j.id))
      .toEqual(["a", "c"]);
  });
  test("empty sources is a no-op", () => {
    const jobs = [job({ id: "a", ats: "greenhouse" }), job({ id: "b", ats: "workday" })];
    expect(applyFilters(jobs, { ...ST, sources: [] }).map((j) => j.id)).toEqual(["a", "b"]);
  });
  test("source combines with category (AND across filters)", () => {
    const jobs = [
      job({ id: "a", ats: "greenhouse", role_category: "Backend" }),
      job({ id: "b", ats: "greenhouse", role_category: "Frontend" }),
      job({ id: "c", ats: "workday", role_category: "Backend" }),
    ];
    expect(applyFilters(jobs, { ...ST, sources: ["greenhouse"], cats: ["Backend"] }).map((j) => j.id))
      .toEqual(["a"]);
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
  test("counts sources", () => {
    const jobs = [job({ ats: "greenhouse" }), job({ ats: "greenhouse" }), job({ ats: "workday" })];
    expect(facetCounts(jobs).sources).toEqual({ greenhouse: 2, workday: 1 });
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

describe("filterByView", () => {
  const jobs = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" }), job({ id: "d" })];

  test("rejected view returns only rejected jobs", () => {
    const out = filterByView(jobs, "rejected", new Set(["b", "c"]), new Set(["d"]));
    expect(out.map((j) => j.id)).toEqual(["b", "c"]);
  });

  test("applied view returns only applied jobs", () => {
    const out = filterByView(jobs, "applied", new Set(["b"]), new Set(["d"]));
    expect(out.map((j) => j.id)).toEqual(["d"]);
  });

  test("all view hides rejected and applied", () => {
    const out = filterByView(jobs, "all", new Set(["b"]), new Set(["d"]));
    expect(out.map((j) => j.id)).toEqual(["a", "c"]);
  });

  test("empty sets: all view shows everything", () => {
    const out = filterByView(jobs, "all", new Set(), new Set());
    expect(out.map((j) => j.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("rejected view surfaces server-sourced rejects folded into the pool", () => {
    // A reload loses the in-session rejects: the approve list ("a") plus the server
    // reject ("s", not in the approve list) form the pool, and the seeded rejectedIds
    // include "s", so the Rejected view still shows it.
    const approve = [job({ id: "a" })];
    const serverReject = job({ id: "s", verdict: "deny", human_override: true });
    const pool = mergeRejectedPool(approve, [serverReject]);
    const out = filterByView(pool, "rejected", new Set(["s"]), new Set());
    expect(out.map((j) => j.id)).toEqual(["s"]);
  });
});

describe("mergeRejectedPool", () => {
  test("appends server rejects not already in the approve list", () => {
    const jobs = [job({ id: "a" }), job({ id: "b" })];
    const out = mergeRejectedPool(jobs, [job({ id: "s" })]);
    expect(out.map((j) => j.id)).toEqual(["a", "b", "s"]);
  });

  test("dedupes by id — the board (approve) row wins on collision", () => {
    const jobs = [job({ id: "a", verdict: "approve" })];
    const out = mergeRejectedPool(jobs, [job({ id: "a", verdict: "deny" })]);
    expect(out).toHaveLength(1);
    expect(out[0].verdict).toBe("approve");
  });

  test("returns the input array unchanged when there are no server rejects", () => {
    const jobs = [job({ id: "a" })];
    expect(mergeRejectedPool(jobs, [])).toBe(jobs);
  });
});
