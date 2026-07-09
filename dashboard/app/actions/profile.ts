"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { assertNotDeleted } from "@/lib/tombstone";
import { safeErrorMessage } from "@/lib/safeError";
import { resumeObjectPath } from "@/lib/resumeStorage";

// Résumé-only save from the board's profile modal. Preserves model choices and
// instructions the user set on /profile (the modal doesn't expose them).
export async function saveProfileResume(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  // M-RESURRECT-2: a deleted user's JWT stays valid ≤1h. upsertProfile refuses the DB
  // write for a tombstoned user, but this action also uploads a résumé PDF to storage
  // BEFORE that write — bail out here so an erased account can't re-create a stored PDF.
  await assertNotDeleted(userId);
  const existing = await getProfile(userId);

  const submittedText = String(formData.get("resume_text") ?? "").trim();
  const resumeText = submittedText || existing?.resume_text || null;

  // The uploaded file is archived only — the client already extracted it into the
  // review box and that reviewed text (resume_text) is the single source generation
  // reads. Save no longer re-extracts or resolves a competing path.
  let resumeFilePath = existing?.resume_file_path ?? null;
  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = resumeObjectPath(userId, file.name);
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    // Log the storage internals server-side; throw only a generic message so the
    // client overlay never shows storage/host details (T5).
    if (error) throw new Error(safeErrorMessage("profile.resume-upload", error, "Résumé upload failed. Please try again."));
    resumeFilePath = path; // archival only — generation reads resume_text
  }

  await upsertProfile(userId, {
    resumeText,
    instructions: existing?.instructions ?? null,
    resumeFilePath,
    modelStage1: existing?.model_stage1 ?? null,
    modelStage2: existing?.model_stage2 ?? null,
    preferredLocations: existing?.preferred_locations ?? [],
    modelResume: existing?.model_resume ?? null,
    companyInstructions: existing?.company_instructions ?? null,
    modelCompany: existing?.model_company ?? null,
    // Application answers are edited only on /profile — preserve them here.
    fullName: existing?.full_name ?? null,
    email: existing?.email ?? null,
    phone: existing?.phone ?? null,
    links: existing?.links ?? {},
    location: existing?.location ?? null,
    workAuthorized: existing?.work_authorized ?? null,
    needsSponsorship: existing?.needs_sponsorship ?? null,
    eeoGender: existing?.eeo_gender ?? null,
    eeoRace: existing?.eeo_race ?? null,
    eeoVeteran: existing?.eeo_veteran ?? null,
    eeoDisability: existing?.eeo_disability ?? null,
    screeningAnswers: existing?.screening_answers ?? {},
    modelCover: existing?.model_cover ?? null,
    resumeGenerationInstructions: existing?.resume_generation_instructions ?? null,
    coverLetterGenerationInstructions: existing?.cover_letter_generation_instructions ?? null,
  });
  revalidatePath("/");
}
