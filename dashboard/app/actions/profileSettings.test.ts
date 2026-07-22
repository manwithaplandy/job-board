import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getUserClaims: vi.fn(),
  getProfile: vi.fn(),
  updateCompanyExclusions: vi.fn(),
  getStructuredModels: vi.fn(),
  getViewerPlan: vi.fn(),
  createClient: vi.fn(),
  assertNotDeleted: vi.fn(),
  updateApplicationDetails: vi.fn(),
  updateJobPreferences: vi.fn(),
  updateGenerationDefaults: vi.fn(),
  updateModelPreferences: vi.fn(),
  updateResumeSource: vi.fn(),
  revalidatePath: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: mocks.requireUserId,
  getUserClaims: mocks.getUserClaims,
}));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  updateCompanyExclusions: mocks.updateCompanyExclusions,
}));
vi.mock("@/lib/openrouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openrouter")>();
  return { ...actual, getStructuredModels: mocks.getStructuredModels };
});
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: mocks.getViewerPlan }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));
vi.mock("@/lib/profileSettings", () => ({
  updateApplicationDetails: mocks.updateApplicationDetails,
  updateJobPreferences: mocks.updateJobPreferences,
  updateGenerationDefaults: mocks.updateGenerationDefaults,
  updateModelPreferences: mocks.updateModelPreferences,
  updateResumeSource: mocks.updateResumeSource,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { INITIAL_SECTION_SAVE_STATE } from "@/lib/profileSettingsState";
import {
  saveAdvancedAiSettings,
  saveApplicationDetails,
  saveApplicationPersonalization,
  saveCompanyFilters,
  saveJobPreferences,
  saveResumeSettings,
} from "@/app/actions/profileSettings";

const form = (values: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
};

const GEMINI = "google/gemini-3.5-flash";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue("u1");
  mocks.getUserClaims.mockResolvedValue({ id: "u1", email: "jane@example.com" });
  mocks.getProfile.mockResolvedValue({ resume_text: "old text", resume_file_path: "old.pdf" });
  mocks.getStructuredModels.mockResolvedValue([
    { id: "deepseek/deepseek-v4-flash" },
    { id: "anthropic/claude-haiku-4.5" },
    { id: "openai/gpt-5.5" },
    { id: GEMINI, name: "Gemini Flash 3.5" },
  ]);
  mocks.getViewerPlan.mockResolvedValue("pro");
  mocks.assertNotDeleted.mockResolvedValue(undefined);
  mocks.updateApplicationDetails.mockResolvedValue(undefined);
  mocks.updateJobPreferences.mockResolvedValue(undefined);
  mocks.updateGenerationDefaults.mockResolvedValue(undefined);
  mocks.updateModelPreferences.mockResolvedValue(undefined);
  mocks.updateResumeSource.mockResolvedValue(undefined);
  mocks.updateCompanyExclusions.mockResolvedValue(undefined);
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) },
  });
});

describe("profile settings actions", () => {
  test("returns a field error when job preferences omit locations", async () => {
    expect(await saveJobPreferences(INITIAL_SECTION_SAVE_STATE, form({
      preferred_locations: "[]",
    }))).toEqual({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { preferred_locations: "Pick at least one location." },
    });
    expect(mocks.updateJobPreferences).not.toHaveBeenCalled();
  });

  test("saves all job preferences atomically", async () => {
    await expect(saveJobPreferences(INITIAL_SECTION_SAVE_STATE, form({
      preferred_locations: '[" Remote "]', instructions: " backend ", company_instructions: " fintech ",
    }))).resolves.toMatchObject({ status: "success" });
    expect(mocks.updateJobPreferences).toHaveBeenCalledWith("u1", {
      preferredLocations: ["Remote"], instructions: "backend", companyInstructions: "fintech",
    });
  });

  test("company filters preserve the 'unknown' HQ sentinel case-insensitively", async () => {
    // Regression: uppercasing every token turned "unknown" → "UNKNOWN", which the codec
    // drops (its country validator is `x === "unknown" || isCountryCode(x)`), silently
    // deleting the "exclude unclassified HQ" exclusion the form invites users to type.
    await expect(saveCompanyFilters(INITIAL_SECTION_SAVE_STATE, form({
      exclude_countries: "in, Unknown, US",
    }))).resolves.toMatchObject({ status: "success" });
    expect(mocks.updateCompanyExclusions).toHaveBeenCalledWith("u1", expect.objectContaining({
      countries: ["IN", "unknown", "US"],
    }));
  });

  test("company filters reject unrecognized country tokens instead of silently dropping them", async () => {
    // Regression: unrecognized free-text tokens (e.g. "USA") fail the codec's country
    // validator; without an up-front check they'd be discarded while the action still
    // reported success, stranding the user's typed text against an empty DB list.
    const result = await saveCompanyFilters(INITIAL_SECTION_SAVE_STATE, form({
      exclude_countries: "USA, in",
    }));
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { exclude_countries: expect.stringContaining("USA") },
    });
    expect(mocks.updateCompanyExclusions).not.toHaveBeenCalled();
  });

  test("company filters reject an over-cap country list instead of silently truncating it", async () => {
    // Regression: the codec caps each facet at 50 by truncation; without an up-front
    // length check a 51+ valid-code submission would store only the first 50 while the
    // action reported success — the same silent-drop class as the bad-token fix.
    const codes = Array.from(
      { length: 51 },
      (_, i) =>
        String.fromCharCode(65 + Math.floor(i / 26)) +
        String.fromCharCode(65 + (i % 26)),
    );
    const result = await saveCompanyFilters(INITIAL_SECTION_SAVE_STATE, form({
      exclude_countries: codes.join(", "),
    }));
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { exclude_countries: expect.stringContaining("max 50") },
    });
    expect(mocks.updateCompanyExclusions).not.toHaveBeenCalled();
  });

  test("company filters dedupe country tokens (case-insensitively) before storing", async () => {
    // "IN, in, US" must not persist as ["IN", "IN", "US"] (inflates the count and
    // re-renders as "IN, IN"); case-folded repeats collapse to one entry.
    await expect(saveCompanyFilters(INITIAL_SECTION_SAVE_STATE, form({
      exclude_countries: "IN, in, US",
    }))).resolves.toMatchObject({ status: "success" });
    expect(mocks.updateCompanyExclusions).toHaveBeenCalledWith("u1", expect.objectContaining({
      countries: ["IN", "US"],
    }));
  });

  test("addresses oversized personalization instructions by field", async () => {
    expect(await saveApplicationPersonalization(INITIAL_SECTION_SAVE_STATE, form({
      resume_generation_instructions: "x".repeat(4001),
    }))).toMatchObject({
      status: "error",
      fieldErrors: { resume_generation_instructions: expect.stringContaining("max 4000") },
    });
  });

  test("normalizes and saves reusable application details", async () => {
    await expect(saveApplicationDetails(INITIAL_SECTION_SAVE_STATE, form({
      full_name: " Jane Doe ", email: " jane@example.com ", link_github: " https://github.com/jane ",
      work_authorized: "yes", needs_sponsorship: "no",
    }))).resolves.toMatchObject({ status: "success" });
    expect(mocks.updateApplicationDetails).toHaveBeenCalledWith("u1", expect.objectContaining({
      full_name: "Jane Doe", email: "jane@example.com", links: expect.objectContaining({ github: "https://github.com/jane" }),
      work_authorized: true, needs_sponsorship: false,
    }));
  });

  test.each([
    [{ full_name: " ", email: "jane@example.com" }, { full_name: expect.stringContaining("required") }],
    [{ full_name: "Jane", email: " " }, { email: expect.stringContaining("required") }],
    [{ full_name: "Jane", email: "not-an-email" }, { email: expect.stringContaining("valid email") }],
    [{ full_name: "Jane", email: "jane@example.com", link_linkedin: "linkedin" }, { link_linkedin: expect.stringContaining("valid URL") }],
    [{ full_name: "Jane", email: "jane@example.com", link_github: "github" }, { link_github: expect.stringContaining("valid URL") }],
    [{ full_name: "Jane", email: "jane@example.com", link_portfolio: "/portfolio" }, { link_portfolio: expect.stringContaining("valid URL") }],
  ])("rejects invalid application details without writing", async (values, fieldErrors) => {
    expect(await saveApplicationDetails(INITIAL_SECTION_SAVE_STATE, form(values))).toMatchObject({
      status: "error", fieldErrors,
    });
    expect(mocks.updateApplicationDetails).not.toHaveBeenCalled();
  });

  test("blank résumé text preserves the canonical saved résumé", async () => {
    await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_text: "   " }));
    expect(mocks.updateResumeSource).toHaveBeenCalledWith("u1", {
      resumeText: "old text", resumeFilePath: "old.pdf",
    });
  });

  test.each([
    ["application details", mocks.updateApplicationDetails, () => saveApplicationDetails(INITIAL_SECTION_SAVE_STATE, form({ full_name: "Jane", email: "jane@example.com" }))],
    ["job preferences", mocks.updateJobPreferences, () => saveJobPreferences(INITIAL_SECTION_SAVE_STATE, form({ preferred_locations: '["Remote"]' }))],
    ["personalization", mocks.updateGenerationDefaults, () => saveApplicationPersonalization(INITIAL_SECTION_SAVE_STATE, form({}))],
    ["advanced settings", mocks.updateModelPreferences, () => saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, form({}))],
    ["résumé", mocks.updateResumeSource, () => saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({}))],
  ])("returns failure, never success, when tombstoned during %s save", async (_name, write, invoke) => {
    write.mockRejectedValueOnce(new Error("account has been deleted"));
    expect(await invoke()).toEqual({ status: "error", message: "Changes were not saved. Please try again.", fieldErrors: {} });
  });

  test("rejects invalid model ids with field-addressable errors", async () => {
    const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, form({ model_resume: "fake/model" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { model_resume: "unknown model: fake/model" } });
    expect(mocks.updateModelPreferences).not.toHaveBeenCalled();
  });

  test("rejects Standard-plan premium Stage 2", async () => {
    mocks.getViewerPlan.mockResolvedValue("standard");
    const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, form({
      model_stage2: "anthropic/claude-haiku-4.5",
    }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { model_stage2: expect.stringContaining("requires the Pro plan") } });
  });

  test("Pro user can save Gemini Flash 3.5 as the stage-2 model", async () => {
    mocks.getViewerPlan.mockResolvedValue("pro");
    const fd = form({ model_stage2: GEMINI });
    const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, fd);
    expect(result.status).toBe("success");
  });

  test("Standard user selecting Gemini gets an accurate Pro message + upgrade CTA", async () => {
    mocks.getViewerPlan.mockResolvedValue("standard");
    const fd = form({ model_stage2: GEMINI });
    const result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, fd);
    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("expected error");
    expect(result.fieldErrors.model_stage2).toMatch(/requires the Pro plan\.$/);
    expect(result.fieldErrors.model_stage2).not.toContain("google/gemini"); // friendly name, not raw id
    expect(result.upgrade).toEqual({ href: "/billing", label: "Upgrade to Pro" });
  });

  test("rejects invalid and unentitled reasoning effort by field", async () => {
    let result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, form({ reasoning_effort_resume: "maximum" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { reasoning_effort_resume: expect.stringContaining("unknown reasoning effort") } });
    mocks.getViewerPlan.mockResolvedValue("standard");
    result = await saveAdvancedAiSettings(INITIAL_SECTION_SAVE_STATE, form({ reasoning_effort_cover: "high" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { reasoning_effort_cover: expect.stringContaining("require the Pro plan") } });
  });

  test("rejects invalid resume MIME and size", async () => {
    const badType = new File(["x"], "resume.txt", { type: "text/plain" });
    expect(await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_pdf: badType })))
      .toMatchObject({ status: "error", fieldErrors: { resume_pdf: expect.stringContaining("PDF") } });
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "resume.pdf", { type: "application/pdf" });
    expect(await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_pdf: tooLarge })))
      .toMatchObject({ status: "error", fieldErrors: { resume_pdf: expect.stringContaining("5 MiB") } });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.updateResumeSource).not.toHaveBeenCalled();
  });

  test("checks deletion before creating a storage client", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
    const pdf = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_pdf: pdf }));
    expect(mocks.assertNotDeleted).toHaveBeenCalledWith("u1");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.updateResumeSource).not.toHaveBeenCalled();
  });

  test("removes a newly uploaded file when the profile update fails", async () => {
    mocks.updateResumeSource.mockRejectedValue(new Error("db host secret"));
    const pdf = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const result = await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_pdf: pdf }));
    expect(result).toEqual({ status: "error", message: "Changes were not saved. Please try again.", fieldErrors: {} });
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringContaining("u1/")]);
  });

  test("observes a resolved cleanup error without replacing the original safe failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateResumeSource.mockRejectedValue(new Error("db host secret"));
    mocks.remove.mockResolvedValue({ error: new Error("storage host secret") });
    const pdf = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    const result = await saveResumeSettings(INITIAL_SECTION_SAVE_STATE, form({ resume_pdf: pdf }));

    expect(result).toEqual({ status: "error", message: "Changes were not saved. Please try again.", fieldErrors: {} });
    expect(log).toHaveBeenCalledWith("[profile.resume-cleanup]", expect.objectContaining({ message: "storage host secret" }));
    expect(log).toHaveBeenCalledWith("[profile.section-save]", expect.objectContaining({ message: "db host secret" }));
    log.mockRestore();
  });

  test("returns a generic safe error from non-upload actions", async () => {
    mocks.updateApplicationDetails.mockRejectedValue(new Error("postgres credentials"));
    expect(await saveApplicationDetails(INITIAL_SECTION_SAVE_STATE, form({ full_name: "Jane", email: "jane@example.com" }))).toEqual({
      status: "error", message: "Changes were not saved. Please try again.", fieldErrors: {},
    });
  });
});
