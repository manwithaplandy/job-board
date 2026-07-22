import { describe, expect, it, test } from "vitest";
import { applyFilters, facetCounts, filterByApplied, filterByView, fmtPayRange, mergeRejectedPool, sortJobs, type BoardFilterState } from "@/lib/rolefit/filter";
import type { JobRow } from "@/lib/types";

function job(p: Partial<JobRow>): JobRow {
  return {
    id: "x", title: "Engineer", url: "u", location: "Remote (US)", location_canonicals: null, remote: true,
    first_seen_at: "2026-06-20T00:00:00Z", closed_at: null, company_name: "Acme", ats: "lever",
    verdict: "approve", human_override: false, experience_match: "match", industry: null, industry_subcategory: null,
    confidence: "high", reasoning: null, stage1_decision: "pass", stage1_reason: null,
    role_category: "Backend", seniority: "senior", work_arrangement: "remote", about: null,
    pay_min: 150000, pay_max: 200000, pay_currency: "USD", pay_period: "year", headcount: null,
    skills_score: 80, experience_score: 70, comp_score: 60, fit_score: 80,
    red_flags: [], skill_gaps: ["Go"], benefits: [], requirements: null, ...p,
  };
}
const ST: BoardFilterState = { search: "", cats: [], locs: [], sources: [], industries: [], sizes: [], countries: [], remote: "all", minFit: 0, payMin: 0, payMax: null, payIncludeUndisclosed: false, sort: "match" };

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

describe("company facet filters (industry / size / country)", () => {
  test("industry filter keeps only matching industries; null field → 'unknown'", () => {
    const jobs = [
      job({ id: "a", industry: "software_internet" }),
      job({ id: "b", industry: "fintech_finance" }),
      job({ id: "u", industry: null }),
    ];
    expect(applyFilters(jobs, { ...ST, industries: ["software_internet"] }).map((j) => j.id)).toEqual(["a"]);
    expect(applyFilters(jobs, { ...ST, industries: ["unknown"] }).map((j) => j.id)).toEqual(["u"]);
  });

  test("size filter keeps only matching buckets; missing size → 'unknown'", () => {
    const jobs = [
      job({ id: "small", size: "11-50" }),
      job({ id: "big", size: "5000+" }),
      job({ id: "u" }), // size left unset (undefined) → treated as 'unknown'
    ];
    expect(applyFilters(jobs, { ...ST, sizes: ["5000+"] }).map((j) => j.id)).toEqual(["big"]);
    expect(applyFilters(jobs, { ...ST, sizes: ["unknown"] }).map((j) => j.id)).toEqual(["u"]);
  });

  test("country filter keeps only matching HQ; null field → 'unknown'", () => {
    const jobs = [
      job({ id: "us", hq_country: "US" }),
      job({ id: "de", hq_country: "DE" }),
      job({ id: "u", hq_country: null }),
    ];
    expect(applyFilters(jobs, { ...ST, countries: ["DE"] }).map((j) => j.id)).toEqual(["de"]);
    expect(applyFilters(jobs, { ...ST, countries: ["unknown"] }).map((j) => j.id)).toEqual(["u"]);
  });

  test("multi-select within a facet ORs; an empty facet is a no-op", () => {
    const jobs = [
      job({ id: "a", industry: "software_internet" }),
      job({ id: "b", industry: "fintech_finance" }),
      job({ id: "c", industry: "healthcare_life_sciences" }),
    ];
    expect(
      applyFilters(jobs, { ...ST, industries: ["software_internet", "healthcare_life_sciences"] }).map((j) => j.id),
    ).toEqual(["a", "c"]);
    expect(applyFilters(jobs, { ...ST, industries: [] }).map((j) => j.id)).toEqual(["a", "b", "c"]);
  });

  test("facets AND across each other (industry AND size AND country)", () => {
    const jobs = [
      job({ id: "hit", industry: "software_internet", size: "11-50", hq_country: "US" }),
      job({ id: "wrongSize", industry: "software_internet", size: "5000+", hq_country: "US" }),
      job({ id: "wrongCountry", industry: "software_internet", size: "11-50", hq_country: "DE" }),
    ];
    expect(
      applyFilters(jobs, { ...ST, industries: ["software_internet"], sizes: ["11-50"], countries: ["US"] }).map((j) => j.id),
    ).toEqual(["hit"]);
  });
});

describe("pay range filter", () => {
  const band = (id: string, min: number | null, max: number | null, period = "year") =>
    job({ id, pay_min: min, pay_max: max, pay_period: period });

  test("inactive (0 / null) keeps everything, including undisclosed", () => {
    const jobs = [
      band("a", 100000, 140000),
      band("b", null, null, "year"),
      job({ id: "c", pay_min: null, pay_max: null, pay_period: null }),
    ];
    expect(applyFilters(jobs, ST).map((j) => j.id)).toEqual(["a", "b", "c"]);
  });

  test("band overlaps window: keeps inside, straddling top, and straddling bottom", () => {
    const jobs = [
      band("inside", 90000, 110000),
      band("straddle-top", 100000, 140000),
      band("straddle-bottom", 60000, 85000),
      band("above", 130000, 160000),
      band("below", 50000, 70000),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["inside", "straddle-top", "straddle-bottom"]);
  });

  test("lower-bound-only ($100k+) matches today's max>=threshold rule", () => {
    const jobs = [band("meets", 120000, 160000), band("under", 60000, 90000)];
    const out = applyFilters(jobs, { ...ST, payMin: 100, payMax: null });
    expect(out.map((j) => j.id)).toEqual(["meets"]);
  });

  test("open-topped 'From $X' job now matches a lower bound", () => {
    const jobs = [band("from150", 150000, null)];
    const out = applyFilters(jobs, { ...ST, payMin: 100, payMax: null });
    expect(out.map((j) => j.id)).toEqual(["from150"]);
  });

  test("upper-bound-only (Up to $120k) drops bands whose floor exceeds the ceiling", () => {
    const jobs = [band("uptoOk", null, 100000), band("floorTooHigh", 130000, 160000)];
    const out = applyFilters(jobs, { ...ST, payMin: 0, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["uptoOk"]);
  });

  test("undisclosed and hourly hidden by default when active", () => {
    const jobs = [
      band("annual", 100000, 140000),
      job({ id: "none", pay_min: null, pay_max: null, pay_period: null }),
      band("hourly", 50, 90, "hour"),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120 });
    expect(out.map((j) => j.id)).toEqual(["annual"]);
  });

  test("includeUndisclosed shows no-band jobs but still drops disclosed out-of-range", () => {
    const jobs = [
      band("annualOut", 40000, 60000),
      job({ id: "none", pay_min: null, pay_max: null, pay_period: null }),
      band("hourly", 50, 90, "hour"),
    ];
    const out = applyFilters(jobs, { ...ST, payMin: 80, payMax: 120, payIncludeUndisclosed: true });
    expect(out.map((j) => j.id)).toEqual(["none", "hourly"]);
  });
});

describe("fmtPayRange", () => {
  test("inactive → null", () => expect(fmtPayRange(0, null)).toBeNull());
  test("lower bound only → $Xk+", () => expect(fmtPayRange(100, null)).toBe("$100k+"));
  test("upper bound only → Up to $Yk", () => expect(fmtPayRange(0, 120)).toBe("Up to $120k"));
  test("both bounds → en-dash range", () => expect(fmtPayRange(80, 120)).toBe("$80–120k"));
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
    const jobs = [
      job({ role_category: "Backend", location: "NYC", remote: false }),
      job({ role_category: "Backend", location: "SF", remote: false }),
    ];
    const f = facetCounts(jobs);
    expect(f.categories).toEqual({ Backend: 2 });
    expect(f.locations).toEqual({ NYC: 1, SF: 1 });
  });
  test("counts sources", () => {
    const jobs = [job({ ats: "greenhouse" }), job({ ats: "greenhouse" }), job({ ats: "workday" })];
    expect(facetCounts(jobs).sources).toEqual({ greenhouse: 2, workday: 1 });
  });
  test("buckets industry/size/country, nulls (and absent fields) under 'unknown'", () => {
    const jobs = [
      job({ industry: "software_internet", size: "11-50", hq_country: "US" }),
      job({ industry: "software_internet", size: null, hq_country: null }),
      job({ industry: null }), // size + hq_country left unset (undefined)
    ];
    const f = facetCounts(jobs);
    expect(f.industries).toEqual({ software_internet: 2, unknown: 1 });
    expect(f.sizes).toEqual({ "11-50": 1, unknown: 2 });
    expect(f.countries).toEqual({ US: 1, unknown: 2 });
  });
});

describe("canonical location filtering (remote opt-in)", () => {
  // build from the file's job() factory, overriding only these fields
  const phx = job({ id: "phx", location: "Phoenix Arizona",
    location_canonicals: ["Phoenix, AZ"], remote: false });
  const multi = job({ id: "multi", location: "NYC or Remote",
    location_canonicals: ["New York City, NY", "Remote"], remote: true });
  const remoteFlag = job({ id: "rflag", location: "Austin, TX",
    location_canonicals: ["Austin, TX"], remote: true });
  const unstamped = job({ id: "raw", location: "Phoenix, AZ",
    location_canonicals: null, remote: false });
  const all = [phx, multi, remoteFlag, unstamped];

  it("matches on canonicals, not the raw string", () => {
    const out = applyFilters(all, { ...ST, locs: ["Phoenix, AZ"] });
    expect(out.map((j) => j.id).sort()).toEqual(["phx", "raw"]);
  });

  it("multi-location rows match any of their canonicals", () => {
    const out = applyFilters(all, { ...ST, locs: ["New York City, NY"] });
    expect(out.map((j) => j.id)).toEqual(["multi"]);
  });

  it("Remote facet matches the remote flag, including city-listed remote jobs", () => {
    const out = applyFilters(all, { ...ST, locs: ["Remote"] });
    expect(out.map((j) => j.id).sort()).toEqual(["multi", "rflag"]);
  });

  it("facetCounts unnests canonicals and computes Remote from the flag", () => {
    const { locations } = facetCounts(all);
    expect(locations).toEqual({
      "Phoenix, AZ": 2,          // phx (canonical) + unstamped (raw fallback)
      "New York City, NY": 1,
      "Austin, TX": 1,
      Remote: 2,                 // multi + rflag via the remote flag
    });
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
