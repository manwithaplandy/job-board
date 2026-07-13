import { describe, expect, test } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { deriveProfileReadiness, formatProfileDate } from "@/lib/profileReadiness";

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: "user-1",
    resume_text: null,
    resume_file_path: null,
    instructions: null,
    model_stage1: null,
    model_stage2: null,
    preferred_locations: [],
    model_resume: null,
    company_instructions: null,
    company_profile_version: null,
    model_company: null,
    board_filters: null,
    full_name: null,
    email: null,
    phone: null,
    links: {},
    location: null,
    work_authorized: null,
    needs_sponsorship: null,
    eeo_gender: null,
    eeo_race: null,
    eeo_veteran: null,
    eeo_disability: null,
    screening_answers: {},
    model_cover: null,
    reasoning_effort_resume: null,
    reasoning_effort_cover: null,
    resume_generation_instructions: null,
    cover_letter_generation_instructions: null,
    profile_version: "version-1",
    updated_at: "2026-07-09T23:30:00-07:00",
    ...overrides,
  };
}

describe("deriveProfileReadiness", () => {
  test("reports all core sections ready using deterministic persisted summaries", () => {
    expect(deriveProfileReadiness(profile({
      preferred_locations: ["Remote", "Seattle, WA"],
      instructions: "Infrastructure roles",
      resume_text: "  Experienced engineer  ",
      full_name: "Avery Example",
      email: "avery@example.com",
      resume_generation_instructions: "Use concise bullets",
    }))).toEqual({
      readyCount: 3,
      totalCore: 3,
      overall: "Ready to find matching jobs",
      jobPreferences: { status: "Ready", summary: "2 locations · Matching guidance added" },
      resume: { status: "Ready", summary: "Résumé updated 2026-07-09" },
      applicationDetails: { status: "Ready", summary: "Name and email ready" },
      personalization: { status: "Optional", summary: "Writing preferences added" },
    });
  });

  test("keeps matching ready when only application details need attention", () => {
    const readiness = deriveProfileReadiness(profile({
      preferred_locations: ["Remote"],
      resume_text: "Résumé",
      full_name: "Avery Example",
    }));

    expect(readiness.readyCount).toBe(2);
    expect(readiness.overall).toBe("Ready to find matching jobs");
    expect(readiness.applicationDetails).toEqual({ status: "Needs attention", summary: "1 essential answer missing" });
  });

  test("treats blank values as missing and uses Rolefit defaults without writing preferences", () => {
    expect(deriveProfileReadiness(profile({
      resume_text: "   ",
      full_name: " ",
      email: "",
      resume_generation_instructions: " ",
      cover_letter_generation_instructions: null,
    }))).toEqual({
      readyCount: 0,
      totalCore: 3,
      overall: "Finish setting up your profile",
      jobPreferences: { status: "Needs attention", summary: "0 locations" },
      resume: { status: "Needs attention", summary: "Add a résumé to improve matching" },
      applicationDetails: { status: "Needs attention", summary: "2 essential answers missing" },
      personalization: { status: "Optional", summary: "Use Rolefit defaults" },
    });
  });

  test("formats profile dates without locale or timezone conversion", () => {
    expect(formatProfileDate("2026-07-09T23:30:00-07:00")).toBe("2026-07-09");
  });

  test("formats Date objects returned by the production database client", () => {
    expect(formatProfileDate(new Date("2026-07-10T06:30:00.000Z"))).toBe("2026-07-10");
  });
});
