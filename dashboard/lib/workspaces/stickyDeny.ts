// The sticky deny on job_reviews (extracted from app/actions/jobs.ts in plan Task 1.3,
// behaviour unchanged): a manual reject flips the caller's review row to verdict 'deny'
// with human_override = TRUE, so the AI reviewer never overwrites it, and an undeny
// restores a prior verdict on a row this feature rejected. Both take the caller's
// transaction: rejectJob/unrejectJob run them in their own, and the shortlist runs
// them inside its withUserMutation write so the shortlist row and the deny commit
// together.
import type { TransactionSql } from "postgres";
import type { readPrivateSnapshot } from "@/lib/jobLifecycle";

/** A job's private snapshot as readPrivateSnapshot returns it. */
export type DenySnapshot = NonNullable<Awaited<ReturnType<typeof readPrivateSnapshot>>>;

// Inserts a minimal row if the job was never reviewed. profile_version='' matches the
// company-override convention.
export async function denyJobTx(tx: TransactionSql, userId: string, jobId: string): Promise<void> {
  await tx`
    INSERT INTO job_reviews
      (user_id, job_id, profile_version, verdict, human_override, reviewed_at)
    VALUES (${userId}::uuid, ${jobId}, '', 'deny', TRUE, now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = 'deny', human_override = TRUE, reviewed_at = now()
  `;
}

// Non-destructive restore of the prior verdict, guarded by human_override = TRUE so it
// only ever touches a row a manual reject wrote. Never DELETEs: undoing a reject of a
// gate-rejected row keeps its stage1_decision intact. A null prior verdict restores
// the row to unreviewed. Snapshot columns are only filled where empty (COALESCE), so a
// null snapshot changes none of them.
export async function undenyJobTx(
  tx: TransactionSql,
  userId: string,
  jobId: string,
  priorVerdict: string | null,
  snapshot: DenySnapshot | null = null,
): Promise<void> {
  await tx`
    UPDATE job_reviews
       SET verdict=${priorVerdict},human_override=FALSE,reviewed_at=now(),
           job_version_id=COALESCE(job_version_id,${snapshot?.versionId ?? null}::uuid),
           description_snapshot=COALESCE(description_snapshot,${snapshot?.description ?? null}),
           questions_snapshot=COALESCE(questions_snapshot,${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb),
           snapshot_captured_at=COALESCE(snapshot_captured_at,${snapshot?.capturedAt ?? null})
     WHERE user_id=${userId}::uuid AND job_id=${jobId} AND human_override = TRUE`;
}
