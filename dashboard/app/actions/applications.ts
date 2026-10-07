"use server";

import { requestJobPayload, readPrivateSnapshot } from "@/lib/jobLifecycle";

import { requireUserId } from "@/lib/auth";
import { withUserSql, withUserPayloadMutation } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { bareMarkerPredicate } from "@/lib/queries";

// Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
// user never prepared a package (a content-less marker row); the Prepare-panel
// button hits the same path (its row already exists, so ON CONFLICT updates it).
// Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
export async function markApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
  const payload = await requestJobPayload(userId, jobId, "prepare");
  if (payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
  await withUserPayloadMutation(userId, jobId, "application_packages", async (tx) => {
    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
    return tx`
    INSERT INTO application_packages (user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, status, applied_at)
    VALUES (${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
      ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, 'applied', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      status     = 'applied',
      applied_at = COALESCE(application_packages.applied_at, now())
  `;
  });
}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
// The apply_url IS NULL guard is future-proof: if a write path for apply_url-only
// rows is ever added, this won't accidentally delete them.
export async function unmarkApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  // withUserSql already wraps this in a single transaction, so the DELETE + UPDATE
  // stay atomic under the authenticated role (RLS scopes both to the viewer's rows).
  await withUserSql(userId, async (tx) => {
    await tx`
      DELETE FROM application_packages
       WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
         AND ${bareMarkerPredicate(tx)}
    `;
    await tx`
      UPDATE application_packages
         SET status = 'prepared', applied_at = NULL
       WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
    `;
  });
}
