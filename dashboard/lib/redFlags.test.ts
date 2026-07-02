import { describe, expect, test } from "vitest";
import { redFlagLabel, redFlagCategoryLabel } from "@/lib/redFlags";

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
