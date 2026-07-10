"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { validateReasoningEffort, resolveStage2Model, PREMIUM_MODEL } from "@/lib/entitlements";
import { getStructuredModels, validateModelId } from "@/lib/openrouter";
import { parsePreferredLocations } from "@/lib/preferredLocations";
import {
  updateApplicationDetails,
  updateGenerationDefaults,
  updateJobPreferences,
  updateModelPreferences,
  updateResumeSource,
} from "@/lib/profileSettings";
import type { SectionSaveState } from "@/lib/profileSettingsState";
import { getProfile } from "@/lib/queries";
import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
import { resumeObjectPath } from "@/lib/resumeStorage";
import { safeErrorMessage } from "@/lib/safeError";
import { getViewerPlan } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { assertNotDeleted } from "@/lib/tombstone";
import type { ApplicationAnswers } from "@/lib/types";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const text = (fd: FormData, key: string): string | null =>
  String(fd.get(key) ?? "").trim() || null;
const triState = (fd: FormData, key: string): boolean | null => {
  const value = String(fd.get(key) ?? "");
  return value === "yes" ? true : value === "no" ? false : null;
};
const success = (): SectionSaveState => ({
  status: "success", savedAt: new Date().toISOString(),
});
const invalid = (fieldErrors: Record<string, string>): SectionSaveState => ({
  status: "error", message: "Check the highlighted fields.", fieldErrors,
});
const failure = (error: unknown): SectionSaveState => ({
  status: "error",
  message: safeErrorMessage("profile.section-save", error, "Changes were not saved. Please try again."),
  fieldErrors: {},
});
const revalidate = (...paths: string[]) => paths.forEach((path) => revalidatePath(path));

export async function saveApplicationDetails(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  try {
    const userId = await requireUserId();
    const answers: ApplicationAnswers = {
      full_name: text(fd, "full_name"),
      email: text(fd, "email"),
      phone: text(fd, "phone"),
      location: text(fd, "location"),
      links: {
        linkedin: text(fd, "link_linkedin"),
        github: text(fd, "link_github"),
        portfolio: text(fd, "link_portfolio"),
      },
      work_authorized: triState(fd, "work_authorized"),
      needs_sponsorship: triState(fd, "needs_sponsorship"),
      eeo_gender: text(fd, "eeo_gender"),
      eeo_race: text(fd, "eeo_race"),
      eeo_veteran: text(fd, "eeo_veteran"),
      eeo_disability: text(fd, "eeo_disability"),
      screening_answers: {
        notice_period: text(fd, "screen_notice_period"),
        salary_expectation: text(fd, "screen_salary_expectation"),
        relocation: text(fd, "screen_relocation"),
      },
    };
    await updateApplicationDetails(userId, answers);
    revalidate("/profile", "/profile/application-details");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function saveJobPreferences(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  try {
    const userId = await requireUserId();
    const preferredLocations = parsePreferredLocations(String(fd.get("preferred_locations") ?? ""));
    if (!preferredLocations.length) return invalid({ preferred_locations: "Pick at least one location." });
    await updateJobPreferences(userId, {
      preferredLocations,
      instructions: text(fd, "instructions"),
      companyInstructions: text(fd, "company_instructions"),
    });
    revalidate("/profile", "/profile/job-preferences");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function saveApplicationPersonalization(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  try {
    const userId = await requireUserId();
    const resume = normalizeInstructions(fd.get("resume_generation_instructions"), "résumé generation");
    const cover = normalizeInstructions(fd.get("cover_letter_generation_instructions"), "cover letter generation");
    const fieldErrors: Record<string, string> = {};
    if (!resume.ok) fieldErrors.resume_generation_instructions = resume.error;
    if (!cover.ok) fieldErrors.cover_letter_generation_instructions = cover.error;
    if (!resume.ok || !cover.ok) return invalid(fieldErrors);
    await updateGenerationDefaults(userId, {
      resumeGenerationInstructions: resume.value,
      coverLetterGenerationInstructions: cover.value,
    });
    revalidate("/profile", "/profile/application-personalization");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function saveAdvancedAiSettings(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  try {
    const userId = await requireUserId();
    const catalogIds = (await getStructuredModels()).map((model) => model.id);
    const fields = ["model_stage2", "model_resume", "model_company", "model_cover"] as const;
    const models = Object.fromEntries(fields.map((field) => [
      field, validateModelId(String(fd.get(field) ?? ""), catalogIds),
    ])) as Record<(typeof fields)[number], ReturnType<typeof validateModelId>>;
    const fieldErrors: Record<string, string> = {};
    for (const field of fields) if (!models[field].ok) fieldErrors[field] = models[field].reason;
    if (Object.keys(fieldErrors).length) return invalid(fieldErrors);

    const claims = await getUserClaims();
    const plan = await getViewerPlan(userId, claims?.email ?? null);
    const stage2 = models.model_stage2;
    if (stage2.ok && stage2.value && resolveStage2Model(plan, stage2.value) !== stage2.value) {
      const name = stage2.value === PREMIUM_MODEL ? "Haiku 4.5" : stage2.value;
      return invalid({ model_stage2: `${name} requires the Pro plan.` });
    }
    const resumeEffort = validateReasoningEffort(String(fd.get("reasoning_effort_resume") ?? ""), plan);
    const coverEffort = validateReasoningEffort(String(fd.get("reasoning_effort_cover") ?? ""), plan);
    if (!resumeEffort.ok) fieldErrors.reasoning_effort_resume = resumeEffort.reason;
    if (!coverEffort.ok) fieldErrors.reasoning_effort_cover = coverEffort.reason;
    if (!resumeEffort.ok || !coverEffort.ok) return invalid(fieldErrors);

    await updateModelPreferences(userId, {
      modelStage2: models.model_stage2.ok ? models.model_stage2.value : null,
      modelResume: models.model_resume.ok ? models.model_resume.value : null,
      modelCompany: models.model_company.ok ? models.model_company.value : null,
      modelCover: models.model_cover.ok ? models.model_cover.value : null,
      reasoningEffortResume: resumeEffort.value,
      reasoningEffortCover: coverEffort.value,
    });
    revalidate("/profile", "/profile/advanced-ai");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function saveResumeSettings(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  let uploadedPath: string | null = null;
  let uploadSucceeded = false;
  let storage: Awaited<ReturnType<typeof createClient>>["storage"] | null = null;
  try {
    const userId = await requireUserId();
    await assertNotDeleted(userId);
    const existing = await getProfile(userId);
    const submittedText = text(fd, "resume_text");
    const resumeText = submittedText || existing?.resume_text || null;
    let resumeFilePath = existing?.resume_file_path ?? null;
    const file = fd.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return invalid({ resume_pdf: "Upload a PDF file." });
      if (file.size > MAX_RESUME_BYTES) return invalid({ resume_pdf: "PDF must be 5 MiB or smaller." });
      uploadedPath = resumeObjectPath(userId, file.name);
      const client = await createClient();
      storage = client.storage;
      const { error } = await storage.from("resumes").upload(
        uploadedPath,
        new Uint8Array(await file.arrayBuffer()),
        { contentType: file.type || "application/pdf", upsert: true },
      );
      if (error) throw error;
      uploadSucceeded = true;
      resumeFilePath = uploadedPath;
    }
    await updateResumeSource(userId, { resumeText, resumeFilePath });
    revalidate("/", "/profile", "/profile/resume");
    return success();
  } catch (error) {
    if (uploadSucceeded && uploadedPath && storage) {
      try { await storage.from("resumes").remove([uploadedPath]); } catch { /* preserve original failure */ }
    }
    return failure(error);
  }
}
