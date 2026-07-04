// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// account_deletions is the erasure TOMBSTONE — a service-role-only table (RLS enabled,
// deny-all no_anon_access, no authenticated policy) so a user JWT can neither read nor
// forge it. This module is the shared "has this account been erased?" predicate
// (finding M-RESURRECT): the mutating server actions call assertNotDeleted at their top,
// the Stripe webhook and the résumé-upload paths call isAccountDeleted before they
// re-create data, and any future write-back path SHOULD do the same. (This is a
// convention, not something enforced here — it is not literally checked by "every" path,
// only by those wired to call in.) It only ever reads its OWN argument's tombstone row
// (a cheap EXISTS) — no cross-tenant surface — so the service role is used purely to see
// PAST the deny-all policy a user session can't read through.
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

/** Thrown by assertNotDeleted when a tombstoned account tries to write. */
export class AccountDeletedError extends Error {
  constructor() {
    super("account has been deleted");
    this.name = "AccountDeletedError";
  }
}

/**
 * Guard the top of every MUTATING server-action entry point (finding M-RESURRECT /
 * minor 1). A deleted user's JWT stays valid for ≤1h post-erasure, so without this a
 * stale session could re-INSERT user-keyed rows (applications, corrections, scores,
 * overrides, résumé scores) or re-upload a résumé PDF AFTER the purge — silently
 * resurrecting the account's data. Reads are intentionally NOT guarded (they expose
 * nothing an erased user didn't already own); only writes are. FAILS LOUD (throws)
 * rather than returning so a caller can't accidentally proceed past it.
 */
export async function assertNotDeleted(userId: string): Promise<void> {
  if (await isAccountDeleted(userId)) throw new AccountDeletedError();
}
