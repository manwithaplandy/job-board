import { describe, expect, test } from "vitest";
import { parseTechTags, toCompanyBrowseRow } from "@/lib/companies/browseCodec";

// tech_tags is a jsonb string[] on companies. Total-parse it (never `as`-cast a jsonb
// read — dashboard/CLAUDE.md): a malformed payload degrades to null (UI shows no tags).
describe("parseTechTags", () => {
  test("keeps a clean string array", () => {
    expect(parseTechTags(["react", "postgres", "aws"])).toEqual(["react", "postgres", "aws"]);
  });

  test("tolerates a double-encoded string scalar", () => {
    expect(parseTechTags('["go","kubernetes"]')).toEqual(["go", "kubernetes"]);
  });

  test("drops non-string members", () => {
    expect(parseTechTags(["react", 5, null, { x: 1 }, "go"])).toEqual(["react", "go"]);
  });

  test("returns null for null / non-array / unparseable string", () => {
    expect(parseTechTags(null)).toBeNull();
    expect(parseTechTags(undefined)).toBeNull();
    expect(parseTechTags("not json")).toBeNull();
    expect(parseTechTags(42)).toBeNull();
    expect(parseTechTags({ a: 1 })).toBeNull();
  });

  test("an empty array stays empty", () => {
    expect(parseTechTags([])).toEqual([]);
  });
});

// toCompanyBrowseRow normalizes a raw companies-browse DB row into the typed shape at the
// boundary: jsonb columns (red_flags, tech_tags) through total parsers, classified_at
// (timestamptz Date) to ISO or null, everything else null-coalesced.
describe("toCompanyBrowseRow", () => {
  const base = {
    id: 7,
    name: "Vanta",
    ats: "greenhouse",
    token: "vanta",
    industry: "software_internet",
    industry_subcategory: "security_compliance",
    size: "201-1000",
    hq_country: "US",
    red_flags: [{ category: "non_tech", note: null }],
    tech_tags: ["react", "go"],
    about: "Automated security & compliance.",
    classified_at: new Date("2026-07-20T00:00:00.000Z"),
    override_verdict: "include",
  };

  test("maps a fully-populated classified row", () => {
    expect(toCompanyBrowseRow(base)).toEqual({
      id: 7,
      name: "Vanta",
      ats: "greenhouse",
      token: "vanta",
      industry: "software_internet",
      industry_subcategory: "security_compliance",
      size: "201-1000",
      hq_country: "US",
      red_flags: [{ category: "non_tech", note: null }],
      tech_tags: ["react", "go"],
      about: "Automated security & compliance.",
      classified_at: "2026-07-20T00:00:00.000Z",
      override_verdict: "include",
    });
  });

  test("an unclassified row → nullable facts null, classified_at null, no override", () => {
    const row = toCompanyBrowseRow({
      id: 9,
      name: "acme",
      ats: "lever",
      token: "acme",
      industry: null,
      industry_subcategory: null,
      size: null,
      hq_country: null,
      red_flags: null,
      tech_tags: null,
      about: null,
      classified_at: null,
      override_verdict: null,
    });
    expect(row.classified_at).toBeNull();
    expect(row.override_verdict).toBeNull();
    expect(row.industry).toBeNull();
    expect(row.red_flags).toBeNull();
    expect(row.tech_tags).toBeNull();
  });

  test("a malformed jsonb payload degrades to null, not a crash", () => {
    const row = toCompanyBrowseRow({ ...base, red_flags: "garbage", tech_tags: 42 });
    expect(row.red_flags).toBeNull();
    expect(row.tech_tags).toBeNull();
  });
});
