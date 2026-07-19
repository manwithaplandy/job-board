import { describe, expect, test } from "vitest";
import { serverBoardFilters, parseFilters } from "@/lib/filters";

const D = { include: ["engineer"] };

describe("parseFilters", () => {
  test("empty params → defaults incl. verdict=approve", () => {
    expect(parseFilters({}, D)).toEqual({
      companies: [],
      include: ["engineer"],
      exclude: [],
      remoteOnly: false,
      status: "open",
      verdict: "approve",
      experience: "",
      industry: "",
      subcategory: "",
      location: "",
    });
  });

  test("parses location and suppresses default include", () => {
    const f = parseFilters({ location: "remote" }, D);
    expect(f.location).toBe("remote");
    expect(f.include).toEqual([]);
  });

  test("any filter param present suppresses default include", () => {
    expect(parseFilters({ status: "all" }, D).include).toEqual([]);
  });

  test("parses review dimensions", () => {
    const f = parseFilters(
      { verdict: "deny", experience: "reach", industry: "software_internet",
        subcategory: "cybersecurity" },
      D,
    );
    expect(f.verdict).toBe("deny");
    expect(f.experience).toBe("reach");
    expect(f.industry).toBe("software_internet");
    expect(f.subcategory).toBe("cybersecurity");
  });

  test("invalid verdict falls back to approve", () => {
    expect(parseFilters({ verdict: "bogus" }, D).verdict).toBe("approve");
  });
});

describe("serverBoardFilters", () => {
  test("authed board drops the title-keyword prefilter (include: [])", () => {
    // The reviewer's verdict='approve' join already curates the viewer's board;
    // a title prefilter on top only removes correct matches (bug 2026-07-19).
    expect(serverBoardFilters("authed").include).toEqual([]);
  });

  test("anon/public board keeps the deliberate engineer curation", () => {
    expect(serverBoardFilters("anon").include).toEqual(["engineer"]);
  });

  test("both classes share the non-include parseFilters defaults", () => {
    for (const f of [serverBoardFilters("authed"), serverBoardFilters("anon")]) {
      expect(f.verdict).toBe("approve");
      expect(f.status).toBe("open");
      expect(f.companies).toEqual([]);
      expect(f.exclude).toEqual([]);
      expect(f.remoteOnly).toBe(false);
    }
  });
});
