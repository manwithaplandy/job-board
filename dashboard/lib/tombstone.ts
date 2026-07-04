// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// account_deletions is the erasure TOMBSTONE — a service-role-only table (RLS enabled,
// deny-all no_anon_access, no authenticated policy) so a user JWT can neither read nor
// forge it. This module is the ONE shared "has this account been erased?" gate that
// every write-back path checks at its write boundary before it recreates data for a
// just-deleted user (finding M-RESURRECT). It only ever reads its OWN argument's
// tombstone row (a cheap EXISTS) — no cross-tenant surface — so the service role is
// used purely to see PAST the deny-all policy a user session can't read through.
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql } from "@/lib/db";

/**
 * True if `userId` has an `account_deletions` tombstone — i.e. the account was erased.
 *
 * Deletion is an ordered cascade (lib/accountDeletion.ts), but three things can still
 * try to write for an erased user AFTER the purge: a stale JWT (valid ≤1h post-delete),
 * an out-of-order Stripe webhook (metadata `user_id` survives the Stripe cancel), and an
 * in-flight job that loaded the user before the purge. Each write-back path re-checks
 * this at its write boundary so none of them can resurrect erased data.
 */
export async function isAccountDeleted(userId: string): Promise<boolean> {
  const rows = await serviceSql<{ deleted: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM account_deletions WHERE user_id = ${userId}::uuid
    ) AS deleted
  `;
  return rows[0]?.deleted === true;
}
