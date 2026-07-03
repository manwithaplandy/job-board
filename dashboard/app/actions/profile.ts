"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
import { resolveResumeFilePath } from "@/lib/resumeFilePath";

// Résumé-only save from the board's profile modal. Preserves model choices and
// instructions the user set on /profile (the modal doesn't expose them).
export async function saveProfileResume(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const existing = await getProfile(userId);

  const submittedText = String(formData.get("resume_text") ?? "").trim();
  let resumeText = submittedText || existing?.resume_text || null;
  let freshUploadPath: string | null = null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    freshUploadPath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted;
  }

  // Replacing the pasted text (with no fresh upload this submit) drops the stale
  // PDF so generation stops parsing it instead of the new text.
  const resumeFilePath = resolveResumeFilePath({
    submittedText,
    existingText: existing?.resume_text ?? null,
    existingPath: existing?.resume_file_path ?? null,
    freshUploadPath,
  });

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
  });
  revalidatePath("/");
}
