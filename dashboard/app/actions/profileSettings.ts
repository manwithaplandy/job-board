"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import {
  validateReasoningEffort, resolveStage2Model, stage2ModelTier, planForTier,
  upgradeCtaLabel, PLAN_LABEL,
} from "@/lib/entitlements";
import { isCountryCode } from "@/lib/companyMeta";
import { getStructuredModels, validateModelId } from "@/lib/openrouter";
import { parsePreferredLocations } from "@/lib/preferredLocations";
import {
  updateApplicationDetails,
  updateGenerationDefaults,
  updateJobPreferences,
  updateModelPreferences,
  updateResumeSource,
} from "@/lib/profileSettings";
import type { SectionSaveState, UpgradeCta } from "@/lib/profileSettingsState";
import { getProfile, updateCompanyExclusions } from "@/lib/queries";
import { MAX_EXCLUSION_ITEMS, parseCompanyExclusions } from "@/lib/rolefit/companyExclusions";
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
const invalid = (fieldErrors: Record<string, string>, upgrade?: UpgradeCta): SectionSaveState => ({
  status: "error", message: "Check the highlighted fields.", fieldErrors,
  ...(upgrade ? { upgrade } : {}),
});
const upsell = (plan: Parameters<typeof upgradeCtaLabel>[0]): UpgradeCta => ({
  href: "/billing", label: upgradeCtaLabel(plan),
});
const failure = (error: unknown): SectionSaveState => ({
  status: "error",
  message: safeErrorMessage("profile.section-save", error, "Changes were not saved. Please try again."),
  fieldErrors: {},
});
const revalidate = (...paths: string[]) => paths.forEach((path) => revalidatePath(path));
const validEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

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
    const fieldErrors: Record<string, string> = {};
    if (!answers.full_name) fieldErrors.full_name = "Full name is required.";
    if (!answers.email) fieldErrors.email = "Email is required.";
    else if (!validEmail(answers.email)) fieldErrors.email = "Enter a valid email address.";
    for (const [field, value] of [
      ["link_linkedin", answers.links.linkedin],
      ["link_github", answers.links.github],
      ["link_portfolio", answers.links.portfolio],
    ] as const) {
      if (value && !validHttpUrl(value)) fieldErrors[field] = "Enter a valid URL beginning with http:// or https://.";
    }
    if (Object.keys(fieldErrors).length) return invalid(fieldErrors);
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

export async function saveCompanyFilters(
  _previous: SectionSaveState,
  fd: FormData,
): Promise<SectionSaveState> {
  try {
    const userId = await requireUserId();
    // Preserve the "unknown" sentinel case-insensitively: uppercasing it to
    // "UNKNOWN" fails the codec's country validator (`x === "unknown" ||
    // isCountryCode(x)`), silently dropping the "exclude unclassified HQ" token
    // the form invites users to type (CompanyFiltersForm exclude_countries copy).
    // Dedup case-insensitively (IN/in both uppercase to IN): duplicates would otherwise
    // be stored verbatim, inflating the count toward the cap and re-rendering as "IN, IN".
    const countries = [
      ...new Set(
        String(fd.get("exclude_countries") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (s.toLowerCase() === "unknown" ? "unknown" : s.toUpperCase())),
      ),
    ];
    // exclude_countries is the only free-text facet. An unrecognized token (e.g.
    // "USA", "India", "U.K.") fails the codec's country validator and would be
    // silently discarded while the action still reports "Changes saved" — the same
    // silent-delete failure class the "unknown" sentinel fix (e7ce3c3) closed.
    // Reject bad tokens up front so the field error renders, matching every other
    // free-text field in this file (email/URL/location).
    const badCountries = countries.filter((c) => c !== "unknown" && !isCountryCode(c));
    if (badCountries.length) {
      return invalid({
        exclude_countries: `Unrecognized country codes: ${badCountries.join(", ")} — use two-letter ISO codes (e.g. IN, US) or "unknown".`,
      });
    }
    // The codec caps each facet at MAX_EXCLUSION_ITEMS and would otherwise silently
    // truncate an over-long list — storing fewer codes than the user typed while the
    // action reports success. Reject over the cap (after dedup) so nothing vanishes.
    if (countries.length > MAX_EXCLUSION_ITEMS) {
      return invalid({
        exclude_countries: `Too many country codes (max ${MAX_EXCLUSION_ITEMS}).`,
      });
    }
    const exclusions = parseCompanyExclusions({
      industries: fd.getAll("exclude_industries").map(String),
      sizes: fd.getAll("exclude_sizes").map(String),
      redFlagCategories: fd.getAll("exclude_red_flags").map(String),
      countries,
    });
    await updateCompanyExclusions(userId, exclusions);
    revalidate("/", "/profile", "/profile/job-preferences", "/companies");
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
    const structured = await getStructuredModels();
    const catalogIds = structured.map((model) => model.id);
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
      const requiredPlan = planForTier(stage2ModelTier(stage2.value));
      const label = structured.find((m) => m.id === stage2.value)?.name ?? stage2.value;
      return invalid(
        { model_stage2: `${label} requires the ${PLAN_LABEL[requiredPlan]} plan.` },
        upsell(plan),
      );
    }
    const resumeEffort = validateReasoningEffort(String(fd.get("reasoning_effort_resume") ?? ""), plan);
    const coverEffort = validateReasoningEffort(String(fd.get("reasoning_effort_cover") ?? ""), plan);
    if (!resumeEffort.ok) fieldErrors.reasoning_effort_resume = resumeEffort.reason;
    if (!coverEffort.ok) fieldErrors.reasoning_effort_cover = coverEffort.reason;
    if (!resumeEffort.ok || !coverEffort.ok) {
      const tierGated =
        (!resumeEffort.ok && resumeEffort.tierGated) || (!coverEffort.ok && coverEffort.tierGated);
      return invalid(fieldErrors, tierGated ? upsell(plan) : undefined);
    }

    await updateModelPreferences(userId, {
      modelStage2: models.model_stage2.ok ? models.model_stage2.value : null,
      modelResume: models.model_resume.ok ? models.model_resume.value : null,
      modelCompany: models.model_company.ok ? models.model_company.value : null,
      modelCover: models.model_cover.ok ? models.model_cover.value : null,
      reasoningEffortResume: resumeEffort.value,
      reasoningEffortCover: coverEffort.value,
    });
    revalidate("/profile", "/profile/advanced");
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
      try {
        const { error: cleanupError } = await storage.from("resumes").remove([uploadedPath]);
        if (cleanupError) safeErrorMessage("profile.resume-cleanup", cleanupError);
      } catch (cleanupError) {
        safeErrorMessage("profile.resume-cleanup", cleanupError);
      }
    }
    return failure(error);
  }
}
