import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withUserSql: vi.fn(async (_userId: string, _fn: (tx: unknown) => Promise<unknown>) => undefined),
  isAccountDeleted: vi.fn(async () => false),
}));

vi.mock("@/lib/db", () => ({ withUserSql: mocks.withUserSql }));
vi.mock("@/lib/tombstone", () => ({
  isAccountDeleted: mocks.isAccountDeleted,
  AccountDeletedError: class AccountDeletedError extends Error {
    constructor() { super("account has been deleted"); }
  },
}));

const settings = await import("@/lib/profileSettings");

describe("profile settings write boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  test.each([
    ["updateResumeSource", { resumeText: "r", resumeFilePath: null }],
    ["updateReviewPreferences", { instructions: "backend" }],
    ["updateJobPreferences", { preferredLocations: ["Remote"], instructions: "backend", companyInstructions: null }],
    ["updateDiscoveryPreferences", { preferredLocations: ["Remote"], companyInstructions: null }],
    ["updateApplicationDetails", {
      full_name: "Jane", email: "jane@example.com", phone: null, location: null, links: {},
      work_authorized: null, needs_sponsorship: null, eeo_gender: null,
      eeo_race: null, eeo_veteran: null, eeo_disability: null, screening_answers: {},
    }],
    ["updateGenerationDefaults", { resumeGenerationInstructions: null, coverLetterGenerationInstructions: null }],
    ["updateModelPreferences", {
      modelStage2: null, modelResume: null, modelCompany: null, modelCover: null,
      reasoningEffortResume: null, reasoningEffortCover: null,
    }],
  ] as const)("%s rejects a tombstoned account without a transaction", async (name, input) => {
    mocks.isAccountDeleted.mockResolvedValueOnce(true);
    await expect((settings[name] as (u: string, d: typeof input) => Promise<void>)("u1", input))
      .rejects.toThrow(/deleted/i);
    expect(mocks.withUserSql).not.toHaveBeenCalled();
  });

  test.each([
    ["updateResumeSource", { resumeText: "r", resumeFilePath: null }],
    ["updateReviewPreferences", { instructions: "backend" }],
    ["updateJobPreferences", { preferredLocations: ["Remote"], instructions: "backend", companyInstructions: null }],
    ["updateDiscoveryPreferences", { preferredLocations: ["Remote"], companyInstructions: null }],
    ["updateApplicationDetails", {
      full_name: null, email: null, phone: null, location: null, links: {},
      work_authorized: null, needs_sponsorship: null, eeo_gender: null,
      eeo_race: null, eeo_veteran: null, eeo_disability: null,
      screening_answers: {},
    }],
    ["updateGenerationDefaults", {
      resumeGenerationInstructions: null, coverLetterGenerationInstructions: null,
    }],
    ["updateModelPreferences", {
      modelStage2: null, modelResume: null, modelCompany: null, modelCover: null,
      reasoningEffortResume: null, reasoningEffortCover: null,
    }],
  ] as const)("%s uses one RLS transaction", async (name, input) => {
    await (settings[name] as (u: string, d: typeof input) => Promise<void>)("u1", input);
    expect(mocks.withUserSql).toHaveBeenCalledTimes(1);
  });
});
