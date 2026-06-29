import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { companyProfileVersion } from "@/lib/companyProfileVersion";

describe("companyProfileVersion", () => {
  it("matches sha256 of the raw instructions (parity with company_discovery/profile.py)", () => {
    const expected = createHash("sha256").update("prefer devtools", "utf8").digest("hex");
    expect(companyProfileVersion("prefer devtools")).toBe(expected);
  });
  it("hashes empty string for null", () => {
    const expected = createHash("sha256").update("", "utf8").digest("hex");
    expect(companyProfileVersion(null)).toBe(expected);
  });
});
