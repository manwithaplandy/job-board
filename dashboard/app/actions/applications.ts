"use server";

import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BARE_MARKER_PREDICATE } from "@/lib/queries";

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
}

// Transitional no-op shims: /api/resume and /api/cover-letter now persist the
// regenerated content server-side (they upsert the application package before
// responding), so this client-initiated persistence round-trip is redundant.
// RolefitBoard still requires these props and calls them after a regenerate —
// keep them as harmless server actions until the component drops the call sites
// (a plain function can't cross the server→client component boundary).
export async function persistRegeneratedResume(): Promise<void> {}

// Cover-letter counterpart of the persistRegeneratedResume shim.
export async function persistRegeneratedCover(): Promise<void> {}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
// The apply_url IS NULL guard is future-proof: if a write path for apply_url-only
// rows is ever added, this won't accidentally delete them.
export async function unmarkApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM application_packages
       WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
         AND ${BARE_MARKER_PREDICATE}
    `;
    await tx`
      UPDATE application_packages
         SET status = 'prepared', applied_at = NULL
       WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
    `;
  });
}
