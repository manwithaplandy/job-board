"use server";

import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";

// Résumé-only save from the board's profile modal. Preserves model choices and
// instructions the user set on /profile (the modal doesn't expose them).
export async function saveProfileResume(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const existing = await getProfile(userId);

  let resumeText = String(formData.get("resume_text") ?? "").trim() || existing?.resume_text || null;
  let resumeFilePath = existing?.resume_file_path ?? null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage.from("resumes")
      .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted;
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
  });
}
