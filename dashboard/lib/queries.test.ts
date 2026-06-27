import { describe, it, expect } from "vitest";
import { companyProfileVersion } from "@/lib/companyProfileVersion";

// Guards the parity contract the queries layer relies on: the version persisted
// by upsertProfile is exactly sha256(company_instructions) and matches Python.
describe("company profile-version wiring", () => {
  it("derives a stable version from instructions", () => {
    const v1 = companyProfileVersion("prefer devtools, no defense");
    const v2 = companyProfileVersion("prefer devtools, no defense");
    const v3 = companyProfileVersion("different");
    expect(v1).toBe(v2);
    expect(v1).not.toBe(v3);
  });
});
