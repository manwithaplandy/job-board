"use server";

import { requestJobPayload, readPrivateSnapshot } from "@/lib/jobLifecycle";

import { requireUserId } from "@/lib/auth";
import { withUserSql, withUserPayloadMutation } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";

// Manual reject. Mirrors an AI deny: flips the operator's review row to
// verdict='deny' and marks it human_override so it is distinguishable and sticky
// (the AI reviewer won't overwrite it; shared descriptions remain intact).
// Inserts a minimal row if the job
// was never reviewed. profile_version='' matches the company-override convention.
export async function rejectJob(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's rows via a stale JWT
  await withUserSql(userId, (tx) => tx`
    INSERT INTO job_reviews
      (user_id, job_id, profile_version, verdict, human_override, reviewed_at)
    VALUES (${userId}::uuid, ${jobId}, '', 'deny', TRUE, now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = 'deny', human_override = TRUE, reviewed_at = now()
  `);
}

// Undo (in-session). Non-destructive restore of the prior verdict, guarded by
// human_override = TRUE so it only ever touches a row this feature rejected.
// Never DELETEs — undoing a reject of a gate-rejected row keeps its
// stage1_decision intact. Shared job descriptions are not affected by rejection.
export async function unrejectJob(
  jobId: string,
  priorVerdict: string | null,
): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (priorVerdict === "approve") {
    const payload=await requestJobPayload(userId,jobId,"review");
    if(payload.status === "pending" || payload.status === "deferred") throw new Error("Job details are being prepared. Try again shortly.");
  }
  await withUserPayloadMutation(userId,jobId,"job_reviews",async tx => {
    const snapshot=await readPrivateSnapshot(tx,jobId,"job_reviews");
    await tx`
    UPDATE job_reviews
       SET verdict=${priorVerdict},human_override=FALSE,reviewed_at=now(),
           job_version_id=COALESCE(job_version_id,${snapshot?.versionId ?? null}::uuid),
           description_snapshot=COALESCE(description_snapshot,${snapshot?.description ?? null}),
           questions_snapshot=COALESCE(questions_snapshot,${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb),
           snapshot_captured_at=COALESCE(snapshot_captured_at,${snapshot?.capturedAt ?? null})
     WHERE user_id=${userId}::uuid AND job_id=${jobId} AND human_override = TRUE`;
  });
}
