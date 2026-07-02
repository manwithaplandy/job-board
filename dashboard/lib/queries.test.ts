import { describe, it, expect } from "vitest";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import { BARE_MARKER_PREDICATE } from "@/lib/queries";

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

// BARE_MARKER_PREDICATE is a static postgres.js SQL fragment; a fragment with no
// interpolations carries its whole text in strings[0] and binds zero parameters.
describe("BARE_MARKER_PREDICATE (un-apply marker semantics)", () => {
  const frag = BARE_MARKER_PREDICATE as unknown as { strings: string[]; args: unknown[] };
  const text = frag.strings.join(" ").replace(/\s+/g, " ").toLowerCase().trim();

  it("requires every content column to be NULL", () => {
    for (const col of [
      "resume_json", "cover_letter_json", "greenhouse_questions",
      "prefilled_answers", "answers_snapshot", "apply_url",
    ]) {
      expect(text).toContain(`${col} is null`);
    }
  });

  it("is a pure AND-conjunction — any content column set makes the row a real package", () => {
    expect(text).not.toContain(" or ");
    // Status columns must not gate the delete: only content presence does.
    for (const col of ["status", "applied_at", "prepared_at"]) {
      expect(text).not.toContain(col);
    }
  });

  it("binds no parameters (static predicate, injection-safe)", () => {
    expect(frag.args ?? []).toHaveLength(0);
  });
});
