import { describe, it, expect } from "vitest";
import { verdictMeta } from "@/lib/companies/format";

describe("verdictMeta", () => {
  it("labels the three verdicts distinctly", () => {
    expect(verdictMeta("include").label).toBe("Included");
    expect(verdictMeta("exclude").label).toBe("Excluded");
    expect(verdictMeta("unknown").label).toBe("Unknown");
  });
  it("falls back for unexpected input", () => {
    expect(verdictMeta("garbage").label).toBe("Unknown");
  });
});
