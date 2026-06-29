"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getOpenRouterCredits } from "@/lib/openrouter";

// Sticky human override. Upserts the override onto the review row (creating a
// minimal row if the company was never AI-reviewed), then flips companies.active.
export async function setCompanyOverride(
  companyId: number,
  verdict: "include" | "exclude",
): Promise<void> {
  const userId = await requireUserId();
  await sql`
    INSERT INTO company_reviews
      (user_id, company_id, company_profile_version, human_override, override_verdict, reviewed_at)
    VALUES (${userId}::uuid, ${companyId}, '', TRUE, ${verdict}, now())
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      human_override = TRUE, override_verdict = ${verdict}, reviewed_at = now()
  `;
  await sql`UPDATE companies SET active = ${verdict === "include"} WHERE id = ${companyId}`;
  revalidatePath("/companies");
}

// Refresh: re-check credits; clear the halt if topped up; flag a resume so the
// next company discovery run drains the backlog.
export async function refreshCompanyDiscoveryStatus(): Promise<void> {
  await requireUserId();
  const remaining = await getOpenRouterCredits();
  const hasCredits = remaining === null ? false : remaining > 0;
  await sql`
    UPDATE discovery_state SET
      halted_no_credits = CASE WHEN ${hasCredits} THEN FALSE ELSE halted_no_credits END,
      resume_requested_at = now(),
      updated_at = now()
    WHERE id = TRUE
  `;
  revalidatePath("/companies");
}
