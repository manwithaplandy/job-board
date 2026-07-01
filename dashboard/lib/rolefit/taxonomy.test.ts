import { describe, expect, test } from "vitest";
import {
  INDUSTRIES, SUBCATEGORIES, SUBCATEGORIES_BY_INDUSTRY, ROLE_CATEGORIES,
} from "@/lib/rolefit/taxonomy";

describe("taxonomy mirror", () => {
  test("industries and subcategories match reviewer/schemas.py", () => {
    expect(INDUSTRIES).toContain("software_internet");
    expect(SUBCATEGORIES_BY_INDUSTRY.software_internet).toContain("gaming");
    // SUBCATEGORIES is the flattened union of every industry's list
    expect(SUBCATEGORIES).toEqual(
      Object.values(SUBCATEGORIES_BY_INDUSTRY).flat(),
    );
    expect(ROLE_CATEGORIES).toContain("Backend");
  });
});
