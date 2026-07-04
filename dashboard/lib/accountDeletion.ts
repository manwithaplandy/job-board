import { createHash } from "node:crypto";
// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// Account deletion is a cross-tenant, cross-table ERASURE cascade. It must DELETE rows
// across every RLS-protected user table AND write the account_deletions ledger (a
// service-role-only table with no authenticated policy), so it legitimately needs the
// privileged role. It is invoked ONLY by app/actions/account.ts, which derives the
// target id from the caller's OWN verified session (requireUserId) and passes no
// arbitrary id — so the RLS bypass can never be steered at another tenant.
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql } from "@/lib/db";
import { cancelSubscriptionIfPresent } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";

// Ordered account-deletion cascade (T3, spec subsystem E). user_id is NOT FK'd to
// auth.users, so deletion is deliberate and ordered. Each step is idempotent /
// "already-gone"-tolerant so a retry after a partial failure converges:
//   1. cancel any active Stripe subscription
//   2. one DB transaction: delete every user-scoped row + anonymize review_runs +
//      insert the erasure ledger row
//   3. remove every storage object under resumes/{userId}/
//   4. delete the auth.users record (service-role admin)
// (signOut + redirect happen in the calling server action, after this returns.)

/** SHA-256 of the lowercased email — the erasure ledger stores this, never plaintext. */
export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return createHash("sha256").update(e).digest("hex");
}

// invite_redemptions is keyed by email and only later back-fills user_id, so it is
// deleted specially (by user_id OR email); the generic loop handles the rest.
const _LOOP_DELETE_TABLES = USER_DELETE_TABLES.filter((t) => t !== "invite_redemptions");

/** Step 1: cancel the user's Stripe subscription if present (tolerates already-gone). */
export async function cancelStripeForUser(userId: string): Promise<void> {
  const rows = await serviceSql<{ stripe_subscription_id: string | null; status: string | null }[]>`
    SELECT stripe_subscription_id, status FROM subscriptions WHERE user_id = ${userId}::uuid
  `;
  const row = rows[0];
  // The webhook mirror keeps canceled subscriptions (id intact, status='canceled'), so
  // a lapsed subscriber's row still has an id. Skip the API call entirely when the
  // mirror already says canceled — no double-cancel, no error to swallow.
  if (row?.status === "canceled") return;
  await cancelSubscriptionIfPresent(row?.stripe_subscription_id ?? null);
}

/**
 * Step 2: single transaction — delete every user-scoped row, anonymize review_runs
 * (keep pipeline accounting, drop the identity), and insert the erasure ledger row.
 * ON CONFLICT DO NOTHING makes the ledger insert idempotent. A DELETE of zero rows is
 * a harmless no-op, so re-running converges.
 */
export async function deleteUserRowsTx(userId: string, email: string | null): Promise<void> {
  const emailHash = hashEmail(email);
  await serviceSql.begin(async (tx) => {
    for (const table of _LOOP_DELETE_TABLES) {
      await tx.unsafe(`DELETE FROM ${table} WHERE user_id = $1::uuid`, [userId]);
    }
    // Both, since early invite rows may predate the user_id back-fill.
    await tx.unsafe(
      `DELETE FROM invite_redemptions WHERE user_id = $1::uuid OR ($2::text IS NOT NULL AND lower(email) = lower($2))`,
      [userId, email],
    );
    // Anonymize (not delete) review_runs — pipeline stats survive the user.
    await tx.unsafe(`UPDATE review_runs SET user_id = NULL WHERE user_id = $1::uuid`, [userId]);
    await tx.unsafe(
      `INSERT INTO account_deletions (user_id, email_hash) VALUES ($1::uuid, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, emailHash],
    );
  });
}

/** Step 3: remove every object under resumes/{userId}/ (tolerates none / errors). */
export async function deleteStorageObjects(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from("resumes").list(userId, { limit: 1000 });
  if (error || !data || data.length === 0) return; // nothing to remove / already gone
  const paths = data.filter((o) => o.name).map((o) => `${userId}/${o.name}`);
  if (paths.length === 0) return;
  const { error: rmError } = await admin.storage.from("resumes").remove(paths);
  if (rmError) {
    // Tolerate: log and continue so a storage hiccup doesn't strand the deletion. The
    // objects are orphaned at worst (no user row references them anymore).
    console.error("account deletion: storage remove failed", rmError);
  }
}

/** Step 4: delete the auth.users record (tolerates already-deleted / not-found). */
export async function deleteAuthUser(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    const status = (error as { status?: number }).status;
    const msg = error.message ?? "";
    if (status === 404 || /not found|user_not_found/i.test(msg)) return; // already gone
    throw error;
  }
}

/**
 * Run the full ordered cascade for `userId`. The caller (the server action) supplies
 * the id from the caller's OWN verified session — this function never derives or accepts
 * a target from untrusted input. Ordered so a retry after any partial failure converges.
 */
export async function deleteAccount(userId: string, email: string | null): Promise<void> {
  await cancelStripeForUser(userId);
  await deleteUserRowsTx(userId, email);
  await deleteStorageObjects(userId);
  await deleteAuthUser(userId);
}
