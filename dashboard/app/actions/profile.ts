"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries";
import { updateResumeSource } from "@/lib/profileSettings";
import { assertNotDeleted } from "@/lib/tombstone";
import { safeErrorMessage } from "@/lib/safeError";
import { resumeObjectPath } from "@/lib/resumeStorage";

// Résumé-only save from the board's profile modal. Preserves model choices and
// instructions the user set on /profile (the modal doesn't expose them).
export async function saveProfileResume(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  // M-RESURRECT-2: a deleted user's JWT stays valid ≤1h. The scoped service refuses the DB
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

  await updateResumeSource(userId, { resumeText, resumeFilePath });
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/profile/resume");
}
