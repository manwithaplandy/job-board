"use server";

import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { markAppliedCore, unmarkAppliedCore } from "@/lib/workspaces/appliedCore";
import { trackAppliedTx, untrackAppliedTx } from "@/lib/workspaces/applications";

// Mark a job applied. Upsert so a one-click "Mark as applied" works even when the
// user never prepared a package (a content-less marker row); the Prepare-panel
// button hits the same path (its row already exists, so ON CONFLICT updates it).
// Idempotent: applied_at is stamped once (COALESCE keeps the first transition).
// The body lives in lib/workspaces/appliedCore.ts, shared with the tracker (Task 1.6).
// The same transaction moves a reviewed job's tracker row to applied (trackAppliedTx).
export async function markApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
  await markAppliedCore(userId, jobId, (tx) => trackAppliedTx(tx, userId, jobId));
}

// Undo "mark applied". A content-less marker row (created by the one-click path) is
// deleted so no phantom "prepared" package lingers; a real prepared package is
// reverted to status='prepared' (applied_at cleared) with its content preserved.
// The same transaction moves a tracker row at applied back to ready (untrackAppliedTx);
// with that `also`, the unmark runs under the lifecycle gate (the tracker tables carry
// the lifecycle trigger).
export async function unmarkApplicationApplied(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await unmarkAppliedCore(userId, jobId, (tx) => untrackAppliedTx(tx, userId, jobId));
}
