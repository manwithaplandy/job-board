"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

// Manual reject. Mirrors an AI deny: flips the operator's review row to
// verdict='deny' and marks it human_override so it is distinguishable and sticky
// (the AI reviewer won't overwrite it; prune.py Rule A nulls the JD next poll;
// select_candidates never re-reviews a deny). Inserts a minimal row if the job
// was never reviewed. profile_version='' matches the company-override convention.
export async function rejectJob(jobId: string): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO job_reviews
      (user_id, job_id, profile_version, verdict, human_override, reviewed_at)
    VALUES (${userId}::uuid, ${jobId}, '', 'deny', TRUE, now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = 'deny', human_override = TRUE, reviewed_at = now()
  `;
  revalidatePath("/");
}

// Undo (in-session). Non-destructive restore of the prior verdict, guarded by
// human_override = TRUE so it only ever touches a row this feature rejected.
// Never DELETEs — undoing a reject of a gate-rejected row keeps its
// stage1_decision intact. Effective only until the next poll runs prune.
export async function unrejectJob(
  jobId: string,
  priorVerdict: string | null,
): Promise<void> {
  const userId = await requireUserId();
  await sql`
    UPDATE job_reviews
       SET verdict = ${priorVerdict}, human_override = FALSE, reviewed_at = now()
     WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND human_override = TRUE
  `;
  revalidatePath("/");
}
