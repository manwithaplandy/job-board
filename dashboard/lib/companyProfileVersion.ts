import { createHash } from "node:crypto";

// MUST match discovery/profile.py: sha256(company_instructions ?? "").
export function companyProfileVersion(companyInstructions: string | null): string {
  return createHash("sha256").update(companyInstructions ?? "", "utf8").digest("hex");
}
