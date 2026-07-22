import { describe, expect, test } from "vitest";
import {
  EMPTY_EXCLUSIONS,
  parseCompanyExclusions,
  type CompanyExclusions,
} from "./companyExclusions";

describe("parseCompanyExclusions", () => {
  test("round-trips a fully-valid object", () => {
    const input: CompanyExclusions = {
      industries: ["software_internet", "unknown"],
      countries: ["IN", "US", "unknown"],
      sizes: ["1-10", "unknown"],
      redFlagCategories: ["consulting_agency", "other"],
    };
    expect(parseCompanyExclusions(input)).toEqual(input);
  });

  test("parses a JSON string input (double-encoded jsonb scalar branch)", () => {
    const input = {
      industries: ["fintech_finance"],
      countries: ["US"],
      sizes: [],
      redFlagCategories: [],
    };
    expect(parseCompanyExclusions(JSON.stringify(input))).toEqual({
      industries: ["fintech_finance"],
      countries: ["US"],
      sizes: [],
      redFlagCategories: [],
    });
  });

  test("garbage input → EMPTY_EXCLUSIONS", () => {
    for (const bad of [null, undefined, 42, "not json", "[", true, "42"]) {
      expect(parseCompanyExclusions(bad)).toEqual(EMPTY_EXCLUSIONS);
    }
  });

  test("a fresh empty result never aliases the shared EMPTY_EXCLUSIONS arrays", () => {
    const a = parseCompanyExclusions(null);
    a.industries.push("software_internet");
    // Mutating one result must not leak into EMPTY_EXCLUSIONS or a later parse.
    expect(EMPTY_EXCLUSIONS.industries).toEqual([]);
    expect(parseCompanyExclusions(null).industries).toEqual([]);
  });

  test("drops invalid members, keeps valid ones", () => {
    expect(
      parseCompanyExclusions({
        industries: ["software_internet", "not_a_real_industry", 123, "unknown"],
        countries: ["US", "usa", "u", "lowercase", "unknown"],
        sizes: ["1-10", "999-999", "unknown"],
        redFlagCategories: ["defense_military", "totally_made_up", null],
      }),
    ).toEqual({
      industries: ["software_internet", "unknown"],
      countries: ["US", "unknown"],
      sizes: ["1-10", "unknown"],
      redFlagCategories: ["defense_military"],
    });
  });

  test("a non-array facet is ignored (yields an empty list)", () => {
    expect(
      parseCompanyExclusions({
        industries: "software_internet",
        countries: { US: true },
        sizes: 5,
        redFlagCategories: ["other"],
      }),
    ).toEqual({
      industries: [],
      countries: [],
      sizes: [],
      redFlagCategories: ["other"],
    });
  });

  test("caps each list at 50 valid members", () => {
    // 60 distinct uppercase ISO-2-shaped codes: AA..AZ, BA..BZ, CA..CH.
    const many = Array.from(
      { length: 60 },
      (_, i) =>
        String.fromCharCode(65 + Math.floor(i / 26)) +
        String.fromCharCode(65 + (i % 26)),
    );
    const parsed = parseCompanyExclusions({
      industries: [],
      sizes: [],
      redFlagCategories: [],
      countries: many,
    });
    expect(parsed.countries).toHaveLength(50);
    expect(parsed.countries).toEqual(many.slice(0, 50));
  });
});
