import { describe, expect, test } from "vitest";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import type { ProfileRow } from "@/lib/types";

// This projection is snapshotted verbatim into application_packages jsonb. The real
// risk is LEAKAGE: a sensitive/large ProfileRow field (resume_text, instructions)
// spilling into the persisted snapshot. So we pin the EXACT key set, not just values.
function fullProfile(): ProfileRow {
  return {
    user_id: "u",
    resume_text: "SENSITIVE RESUME BODY",
    resume_file_path: "path/x.pdf",
    instructions: "SENSITIVE INSTRUCTIONS",
    model_stage1: "m1",
    model_stage2: "m2",
    preferred_locations: ["Phoenix"],
    model_resume: "mr",
    company_instructions: "ci",
    company_profile_version: "cpv",
    model_company: "mc",
    board_filters: null,
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "555",
    links: { linkedin: "https://l", github: null, portfolio: null },
    location: "London",
    work_authorized: true,
    needs_sponsorship: false,
    eeo_gender: "female",
    eeo_race: null,
    eeo_veteran: "no",
    eeo_disability: null,
    screening_answers: { notice_period: "2w", salary_expectation: null },
    model_cover: "mcv",
    reasoning_effort_resume: "medium",
    reasoning_effort_cover: "high",
    resume_generation_instructions: "rgi",
    cover_letter_generation_instructions: "clgi",
    profile_version: "pv",
    updated_at: "2026-01-01",
  };
}

describe("applicationAnswersFromProfile", () => {
  test("copies each answer field verbatim, preserving nulls", () => {
    const p = fullProfile();
    const a = applicationAnswersFromProfile(p);
    expect(a.full_name).toBe(p.full_name);
    expect(a.email).toBe(p.email);
    expect(a.phone).toBe(p.phone);
    expect(a.location).toBe(p.location);
    expect(a.links).toEqual(p.links);
    expect(a.work_authorized).toBe(p.work_authorized);
    expect(a.needs_sponsorship).toBe(p.needs_sponsorship);
    expect(a.eeo_gender).toBe(p.eeo_gender);
    expect(a.eeo_race).toBeNull();
    expect(a.eeo_veteran).toBe(p.eeo_veteran);
    expect(a.eeo_disability).toBeNull();
  });

  test("exposes EXACTLY the 12 answer keys — no profile field can leak in", () => {
    const a = applicationAnswersFromProfile(fullProfile());
    expect(Object.keys(a).sort()).toEqual(
      [
        "eeo_disability", "eeo_gender", "eeo_race", "eeo_veteran",
        "email", "full_name", "links", "location", "needs_sponsorship",
        "phone", "screening_answers", "work_authorized",
      ].sort(),
    );
    // Explicit regression guard: the sensitive/large fields must be absent.
    const keys = Object.keys(a);
    expect(keys).not.toContain("resume_text");
    expect(keys).not.toContain("instructions");
    expect(keys).not.toContain("profile_version");
  });

  test("screening_answers pass through unmodified (no re-encoding)", () => {
    const p = fullProfile();
    const a = applicationAnswersFromProfile(p);
    // Same value, not a double-encoded string (the double-encode twin bug class).
    expect(a.screening_answers).toEqual(p.screening_answers);
    expect(typeof a.screening_answers).toBe("object");
  });
});
