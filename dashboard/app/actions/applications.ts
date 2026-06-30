"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

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
