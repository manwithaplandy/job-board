import { describe, expect, test } from "vitest";
import { parseFilters } from "@/lib/filters";

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
    });
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
