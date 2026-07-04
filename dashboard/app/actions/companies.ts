"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { withUserSql, serviceSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { getOpenRouterCredits } from "@/lib/openrouter";

// Sticky per-user company override. Upserts the override onto the viewer's
// company_reviews row (creating a minimal row if the company was never AI-reviewed).
// Runs under the viewer's RLS context so it can only touch their OWN override.
//
// Multi-tenant note: the pre-Phase-1 single-operator version ALSO flipped the global
// companies.active flag. That is deliberately dropped — companies is the shared,
// global corpus (no user_id), so one tenant's include/exclude must not mutate a
// poller-wide flag for everyone. The per-user override is the source of truth for
// the viewer's board (getCompanyReviews computes effective_verdict from it).
export async function setCompanyOverride(
  companyId: number,
  verdict: "include" | "exclude",
): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's override via a stale JWT
  await withUserSql(userId, (tx) => tx`
    INSERT INTO company_reviews
      (user_id, company_id, company_profile_version, human_override, override_verdict, reviewed_at)
    VALUES (${userId}::uuid, ${companyId}, '', TRUE, ${verdict}, now())
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      human_override = TRUE, override_verdict = ${verdict}, reviewed_at = now()
  `);
  revalidatePath("/companies");
}

// Refresh: re-check credits; clear the halt if topped up; flag a resume so the
// next company discovery run drains the backlog.
//
// SERVICE-ROLE JUSTIFICATION (this file is on the serviceRoleAllowlist): discovery_state
// is a GLOBAL singleton for the shared company-discovery pipeline — it has no user_id
// and no authenticated write policy by design. Clearing the credit halt is a shared
// operator control, not tenant data, so it runs via serviceSql.
//
// ADMIN-ONLY: this mutates the SHARED, poller-wide discovery pipeline (unhalt + request a
// resume), so it must NOT be triggerable by any signed-in tenant — one user could
// otherwise drive everyone's OpenRouter spend. Gated to ADMIN_EMAILS (lib/admin) against
// the verified JWT email; a non-admin gets a thrown error, not a redirect. (Assumes
// Supabase email-confirmation stays ON — see the launch checklist note.)
export async function refreshCompanyDiscoveryStatus(): Promise<void> {
  const claims = await getUserClaims();
  if (!isAdmin(claims)) throw new Error("not authorized");
  const remaining = await getOpenRouterCredits();
  const hasCredits = remaining === null ? false : remaining > 0;
  await serviceSql`
    UPDATE discovery_state SET
      halted_no_credits = CASE WHEN ${hasCredits} THEN FALSE ELSE halted_no_credits END,
      resume_requested_at = now(),
      updated_at = now()
    WHERE id = TRUE
  `;
  revalidatePath("/companies");
}
