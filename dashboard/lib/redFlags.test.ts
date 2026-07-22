import { describe, expect, test } from "vitest";
import { redFlagLabel, redFlagCategoryLabel, parseRedFlags } from "@/lib/redFlags";

describe("redFlagLabel", () => {
  test("concrete category maps to label", () => {
    expect(redFlagLabel({ category: "consulting_agency", note: null })).toBe("Consulting / agency");
  });
  test("other uses the note", () => {
    expect(redFlagLabel({ category: "other", note: "fossil fuel exposure" })).toBe("fossil fuel exposure");
  });
  test("other with no note falls back", () => {
    expect(redFlagLabel({ category: "other", note: null })).toBe("Other");
  });
  test("legacy bare string passes through", () => {
    expect(redFlagLabel("consulting firm")).toBe("consulting firm");
  });
});

describe("redFlagCategoryLabel", () => {
  test("maps a category key to its label", () => {
    expect(redFlagCategoryLabel("defense_military")).toBe("Defense / military");
  });
  test("unknown key passes through unchanged", () => {
    expect(redFlagCategoryLabel("weird_new_key")).toBe("weird_new_key");
  });
});

// Total parser for the companies.red_flags jsonb column ([{category, note}]). Never
// `as`-casts the raw read (dashboard/CLAUDE.md); a malformed payload degrades to null
// (UI shows no flags) instead of crashing the card.
describe("parseRedFlags", () => {
  test("parses a well-formed array of {category, note}", () => {
    expect(
      parseRedFlags([
        { category: "consulting_agency", note: "outsourcing shop" },
        { category: "defense_military", note: null },
      ]),
    ).toEqual([
      { category: "consulting_agency", note: "outsourcing shop" },
      { category: "defense_military", note: null },
    ]);
  });

  test("tolerates a double-encoded string scalar (legacy/manual jsonb write)", () => {
    expect(parseRedFlags('[{"category":"non_tech","note":"retail"}]')).toEqual([
      { category: "non_tech", note: "retail" },
    ]);
  });

  test("keeps a forward-compatible unknown category string (never drops a real flag)", () => {
    expect(parseRedFlags([{ category: "brand_new_category", note: "x" }])).toEqual([
      { category: "brand_new_category", note: "x" },
    ]);
  });

  test("drops malformed members but keeps the valid ones", () => {
    expect(
      parseRedFlags([
        { category: "non_tech", note: "ok" },
        { note: "no category" },
        "bare string",
        42,
        null,
        { category: "" },
      ]),
    ).toEqual([{ category: "non_tech", note: "ok" }]);
  });

  test("coerces a non-string note to null", () => {
    expect(parseRedFlags([{ category: "other", note: 5 }])).toEqual([
      { category: "other", note: null },
    ]);
  });

  test("returns null for null / non-array / unparseable string", () => {
    expect(parseRedFlags(null)).toBeNull();
    expect(parseRedFlags(undefined)).toBeNull();
    expect(parseRedFlags({ category: "non_tech" })).toBeNull();
    expect(parseRedFlags("not json")).toBeNull();
    expect(parseRedFlags(42)).toBeNull();
  });

  test("an empty array stays an empty array (classified, no flags)", () => {
    expect(parseRedFlags([])).toEqual([]);
  });
});
