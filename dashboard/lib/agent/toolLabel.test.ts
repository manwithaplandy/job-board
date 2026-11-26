import { describe, expect, it } from "vitest";
import { toolActivityLabel } from "./toolLabel";

describe("toolActivityLabel", () => {
  it("says what a known tool did in plain words", () => {
    expect(toolActivityLabel("get_profile_summary")).toBe("Read your profile");
    expect(toolActivityLabel("search_jobs")).toBe("Searched your reviewed jobs");
  });
  it("falls back to readable words for an unknown tool", () => {
    expect(toolActivityLabel("compare_offers")).toBe("Used compare offers");
    expect(toolActivityLabel("")).toBe("Used a tool");
  });
});
