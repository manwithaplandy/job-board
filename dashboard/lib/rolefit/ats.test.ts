import { describe, expect, test } from "vitest";
import { ATS_LABELS, atsLabel } from "@/lib/rolefit/ats";

describe("atsLabel", () => {
  test("labels all six providers with correct casing", () => {
    expect(atsLabel("greenhouse")).toBe("Greenhouse");
    expect(atsLabel("lever")).toBe("Lever");
    expect(atsLabel("ashby")).toBe("Ashby");
    expect(atsLabel("workable")).toBe("Workable");
    expect(atsLabel("smartrecruiters")).toBe("SmartRecruiters");
    expect(atsLabel("workday")).toBe("Workday");
  });

  test("falls back to the raw identifier for an unknown provider", () => {
    expect(atsLabel("someats")).toBe("someats");
  });

  test("ATS_LABELS covers exactly the six known identifiers", () => {
    expect(Object.keys(ATS_LABELS).sort()).toEqual(
      ["ashby", "greenhouse", "lever", "smartrecruiters", "workable", "workday"],
    );
  });
});
