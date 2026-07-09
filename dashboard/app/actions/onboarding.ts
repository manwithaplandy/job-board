"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { isInvitedUser, linkInviteRedemption } from "@/lib/invites";
import { enqueueReviewRequest } from "@/lib/reviewRequests";
import { parsePreferredLocations } from "@/lib/preferredLocations";
import { validateOnboarding, hasErrors, type OnboardingErrors } from "@/lib/onboarding";
import { safeErrorMessage } from "@/lib/safeError";
import { resumeObjectPath } from "@/lib/resumeStorage";

export type OnboardingState = { errors: OnboardingErrors } | null;

// Deliberately create the new account's profiles row: résumé (source of truth) +
// MANDATORY location filter (the spec's #1 cost lever) + instructions. Also closes
// the direct-signup cost hole — a non-invited account with no profile is rejected
// here (and at /api/resume/extract) before any LLM budget is spent.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const claims = await getUserClaims();
    if (!claims) redirect("/login");
    // Already onboarded → straight to the board (also guarded on the page).
    const existing = await getProfile(claims.id);
    if (existing) redirect("/");

    const email = claims.email ?? "";
    const invited = email ? await isInvitedUser(email) : false;
    const resumeText = String(formData.get("resume_text") ?? "");
    const preferredLocations = parsePreferredLocations(
      String(formData.get("preferred_locations") ?? ""),
    );
    const instructions = String(formData.get("instructions") ?? "").trim() || null;

    const errors = validateOnboarding({
      invited, hasProfile: false, resumeText, preferredLocations,
    });
    if (hasErrors(errors)) return { errors };

    // Archive an uploaded résumé file exactly like saveProfileResume — the reviewed
    // resume_text is what generation reads; the file is archival only.
    let resumeFilePath: string | null = null;
    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = resumeObjectPath(claims.id, file.name);
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
      if (error) {
        return { errors: { form: safeErrorMessage("onboarding.resume-upload", error, "Résumé upload failed. Please try again.") } };
      }
      resumeFilePath = path;
    }

    await upsertProfile(claims.id, {
      resumeText: resumeText.trim(),
      instructions,
      resumeFilePath,
      preferredLocations,
      // Everything below is edited later on /profile — nulls/empties at onboarding.
      modelStage1: null, modelStage2: null, modelResume: null, modelCompany: null,
      modelCover: null, companyInstructions: null,
      reasoningEffortResume: null, reasoningEffortCover: null,
      fullName: null, email: null, phone: null, links: {},
      location: null, workAuthorized: null, needsSponsorship: null,
      eeoGender: null, eeoRace: null, eeoVeteran: null, eeoDisability: null,
      screeningAnswers: {},
      // Standing generation guidance is edited later on /profile — null at onboarding.
      resumeGenerationInstructions: null,
      coverLetterGenerationInstructions: null,
    });
    // Back-fill the invite redemption with the now-known user id.
    if (email) await linkInviteRedemption(email, claims.id);

    // Kick off an immediate first-run review so the new account doesn't stare at an
    // empty board until the next cron. Best-effort: onboarding must not fail if the
    // enqueue does (the cron reviewer will still populate the board).
    try {
      await enqueueReviewRequest(claims.id);
    } catch (e) {
      console.error("onboarding review-request enqueue failed", e);
    }
  } catch (e) {
    // Re-throw Next control-flow (redirect); log + genericize anything else (T5 — the
    // raw message can carry DB/storage internals).
    unstable_rethrow(e);
    return { errors: { form: safeErrorMessage("onboarding", e) } };
  }
  redirect("/");
}
