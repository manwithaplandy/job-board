// Marking a job applied and unmarking it (plan Task 1.6). The bodies of the board's
// markApplicationApplied and unmarkApplicationApplied (app/actions/applications.ts),
// extracted unchanged so the tracker's move to and from "applied" reuses them, the same
// move as denyJobTx in Task 1.3. `also` runs inside the same transaction, after the
// package write, so a tracker stage, its event, the package status and an audit row
// commit together or not at all.
//
// The caller has already checked the session (requireUserId, assertNotDeleted).
import type { TransactionSql } from "postgres";
import { consumeJobVersion, requestJobPayload } from "@/lib/jobLifecycle";
import { withUserMutation, withUserPayloadMutation, withUserSql } from "@/lib/db";
import { bareMarkerPredicate } from "@/lib/queries";

export type AlsoTx = (tx: TransactionSql) => Promise<void>;

// Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
// user never prepared a package (a content-less marker row); the Prepare-panel
// button hits the same path (its row already exists, so ON CONFLICT updates it).
// Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
export async function markAppliedCore(userId: string, jobId: string, also?: AlsoTx): Promise<void> {
  const existing = await withUserSql(userId, tx => tx`SELECT 1 FROM application_packages WHERE user_id=${userId}::uuid AND job_id=${jobId}`);
  const payload = existing.length ? null : await requestJobPayload(userId, jobId, "description");
  if (payload?.status === "pending" || payload?.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
  await withUserPayloadMutation(userId, jobId, "application_packages", async (tx) => {
    await markPackageTx(tx, userId, jobId, payload);
    if (also) await also(tx);
  });
}

async function markPackageTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  payload: Awaited<ReturnType<typeof requestJobPayload>> | null,
): Promise<void> {
  // A status transition never recaptures or relabels a retained artifact.
  const updated = await tx`UPDATE application_packages SET status='applied',
    applied_at=COALESCE(applied_at,now()) WHERE user_id=${userId}::uuid AND job_id=${jobId} RETURNING job_id`;
  if (updated.length) return;
  if (!payload) throw new Error("Application changed; retry marking it applied.");
  const captured = payload.status === "ready"
    ? await tx`SELECT snapshot_captured_at FROM job_payload_demands WHERE id=${payload.id}::uuid AND user_id=${userId}::uuid`
    : [];
  await tx`
    INSERT INTO application_packages (user_id,job_id,job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,status,applied_at)
    VALUES (${userId}::uuid,${jobId},${payload.status === "ready" ? payload.versionId : null}::uuid,
      ${payload.status === "ready" ? payload.description : null},
      ${payload.status === "ready" && payload.questions ? JSON.stringify(payload.questions) : null}::text::jsonb,
      ${captured[0]?.snapshot_captured_at ?? null},'applied',now())`;
  if (payload.status === "ready") await consumeJobVersion(tx,jobId,payload.versionId,payload.kind,payload.id,payload);
}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
// The apply_url IS NULL guard is future-proof: if a write path for apply_url-only
// rows is ever added, this won't accidentally delete them.
export async function unmarkAppliedTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
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
}

/**
 * Re-marks the job applied inside the caller's transaction, for an undo that restores a
 * tracker row forward to applied-or-later (it cannot open markAppliedCore's payload
 * transaction). A package that still exists (a prepared package unmarked earlier) only
 * changes status and applied_at, the status-only update the lifecycle trigger exempts. A
 * deleted bare marker is re-created content-less, as the board's one-click mark does,
 * pinned to the job's current description version when it has one (the lifecycle
 * trigger's protection check asks for a version-ready job once enforced). If the trigger
 * still refuses, the error rolls the whole undo back rather than half-applying it.
 */
export async function remarkAppliedTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
  // Update first and insert only when nothing was there, so an existing package never
  // passes through an INSERT row trigger (as in markPackageTx).
  const updated = await tx`UPDATE application_packages SET status = 'applied',
    applied_at = COALESCE(applied_at, now()) WHERE user_id = ${userId}::uuid AND job_id = ${jobId} RETURNING job_id`;
  if (updated.length) return;
  await tx`
    INSERT INTO application_packages (user_id, job_id, job_version_id, status, applied_at)
    SELECT ${userId}::uuid, j.id, CASE WHEN j.description IS NOT NULL THEN j.description_version_id END, 'applied', now()
      FROM jobs j WHERE j.id = ${jobId}`;
}

/**
 * Unmarks the job, in one transaction (RLS scopes both statements to the caller). With
 * `also` the transaction takes the lifecycle gate, because the tracker tables carry the
 * lifecycle trigger; without it the transaction is exactly the board's as before.
 */
export async function unmarkAppliedCore(userId: string, jobId: string, also?: AlsoTx): Promise<void> {
  if (!also) {
    await withUserSql(userId, (tx) => unmarkAppliedTx(tx, userId, jobId));
    return;
  }
  await withUserMutation(userId, async (tx) => {
    await unmarkAppliedTx(tx, userId, jobId);
    await also(tx);
  });
}
