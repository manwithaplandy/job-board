"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { updateApplicationPackageResume, updateApplicationPackageCover } from "@/lib/queries";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

// Mark a prepared package as applied. Idempotent: only flips a row this user owns,
// and only stamps applied_at on the first transition (re-clicks keep the original
// timestamp). Building the package (POST /api/application/prepare) created the row.
export async function markApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    UPDATE application_packages
       SET status = 'applied',
           applied_at = COALESCE(applied_at, now())
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
  `;
  revalidatePath("/");
}

// Persist a regenerated résumé back into the user's prepared package (no-op if the
// job was never prepared). The /api/resume regenerate path only returns content; this
// keeps the saved package in sync so the regenerated version survives a reload.
export async function persistRegeneratedResume(jobId: string, resume: TailoredResume): Promise<void> {
  const userId = await requireUserId();
  await updateApplicationPackageResume(userId, jobId, resume);
  revalidatePath("/");
}

// Cover-letter counterpart of persistRegeneratedResume.
export async function persistRegeneratedCover(jobId: string, coverLetter: TailoredCoverLetter): Promise<void> {
  const userId = await requireUserId();
  await updateApplicationPackageCover(userId, jobId, coverLetter);
  revalidatePath("/");
}
