"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { updateApplicationPackageResume, updateApplicationPackageCover } from "@/lib/queries";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

// Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
// user never prepared a package (a content-less marker row); the Prepare-panel
// button hits the same path (its row already exists, so ON CONFLICT updates it).
// Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
export async function markApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO application_packages (user_id, job_id, status, applied_at)
    VALUES (${userId}::uuid, ${jobId}, 'applied', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      status     = 'applied',
      applied_at = COALESCE(application_packages.applied_at, now())
  `;
  revalidatePath("/");
}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
export async function unmarkApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    DELETE FROM application_packages
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
       AND resume_json IS NULL AND cover_letter_json IS NULL
       AND greenhouse_questions IS NULL AND prefilled_answers IS NULL
       AND answers_snapshot IS NULL
  `;
  await sql`
    UPDATE application_packages
       SET status = 'prepared', applied_at = NULL
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
