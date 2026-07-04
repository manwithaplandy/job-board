import { createHmac } from "node:crypto";
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
import { cancelSubscriptionIfPresent, deleteCustomerIfPresent } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";

// Ordered account-deletion cascade (T3, spec subsystem E). user_id is NOT FK'd to
// auth.users, so deletion is deliberate and ordered. Each step is idempotent /
// "already-gone"-tolerant so a retry after a partial failure converges:
//   0. write the erasure tombstone in its OWN transaction FIRST (minor 2), so a Stripe
//      webhook fired by step 1's cancel can't re-insert a mirror row mid-cascade
//   1. cancel any active Stripe subscription AND delete the Stripe customer (erase the
//      email/name PII Stripe holds), before step 2 destroys the only id→customer mapping
//   2. one DB transaction: delete every user-scoped row + anonymize review_runs +
//      re-insert the erasure ledger row idempotently
//   3. remove every storage object under resumes/{userId}/
//   4. delete the auth.users record (service-role admin)
// (signOut + redirect happen in the calling server action, after this returns.)

/**
 * Keyed (HMAC-SHA256) hash of the lowercased email — the erasure ledger stores THIS,
 * never plaintext. HMAC with a server-held secret (not a bare SHA-256): the email space
 * is small and guessable, so an unsalted digest is trivially reversible by hashing a
 * dictionary of candidate addresses. Keyed with a secret an attacker who reads the
 * account_deletions ledger cannot tell which addresses it covers. The secret lives in
 * ACCOUNT_DELETION_HASH_SECRET (a stable deploy-time env; rotating it re-anonymizes past
 * hashes, acceptable for a proof-of-deletion ledger). FAIL CLOSED: a missing secret
 * THROWS rather than silently degrading to an unsalted hash — deletion is a rare,
 * explicitly-invoked op and hashEmail runs at the very start of the DB step, so a config
 * error aborts before any row is touched. Read at call time so tests can stub the env.
 */
export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const secret = process.env.ACCOUNT_DELETION_HASH_SECRET;
  if (!secret) throw new Error("ACCOUNT_DELETION_HASH_SECRET is not set");
  return createHmac("sha256", secret).update(e).digest("hex");
}

// invite_redemptions is keyed by email and only later back-fills user_id, so it is
// deleted specially (by user_id OR email); the generic loop handles the rest.
const _LOOP_DELETE_TABLES = USER_DELETE_TABLES.filter((t) => t !== "invite_redemptions");

/**
 * Step 0 (minor 2): write the erasure tombstone in its OWN transaction, BEFORE anything
 * else in the cascade. Step 1 cancels the Stripe subscription, which fires
 * customer.subscription.deleted/.updated webhooks carrying the user's metadata — those
 * land on the webhook route, which now short-circuits on the tombstone. Writing the
 * tombstone first (its own committed transaction) closes the race where a webhook
 * arrives mid-cascade — after the cancel but before deleteUserRowsTx commits the ledger
 * — and re-inserts a subscriptions mirror row for the account we're erasing. hashEmail
 * FAILS CLOSED on a missing secret, so a config error aborts here before any row is
 * touched. deleteUserRowsTx still writes the ledger idempotently (ON CONFLICT DO NOTHING)
 * so this and that converge.
 */
export async function writeTombstone(userId: string, email: string | null): Promise<void> {
  const emailHash = hashEmail(email);
  await serviceSql.begin(async (tx) => {
    await tx.unsafe(
      `INSERT INTO account_deletions (user_id, email_hash) VALUES ($1::uuid, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, emailHash],
    );
  });
}

/**
 * Step 1: cancel the user's Stripe subscription AND delete the Stripe customer (both
 * tolerate already-gone). M-STRIPE-CUSTOMER — we must delete the Customer object here,
 * BEFORE step 2 destroys the subscriptions row that holds the only stripe_customer_id
 * mapping; otherwise the customer's email/name/history is orphaned in Stripe with no way
 * left to reach it. Deleting the customer also cancels its subscriptions Stripe-side, so
 * the explicit cancel is belt-and-suspenders (and keeps the webhook-mirror short-circuit).
 * Both calls are idempotent, so a retry after a partial failure converges.
 */
export async function cancelStripeForUser(userId: string): Promise<void> {
  const rows = await serviceSql<
    { stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string | null }[]
  >`
    SELECT stripe_subscription_id, stripe_customer_id, status
    FROM subscriptions WHERE user_id = ${userId}::uuid
  `;
  const row = rows[0];
  // The webhook mirror keeps canceled subscriptions (id intact, status='canceled'), so
  // a lapsed subscriber's row still has an id. Skip the cancel API call when the mirror
  // already says canceled — no double-cancel, no error to swallow — but STILL delete the
  // customer below (a canceled subscription does not mean the PII customer is gone).
  if (row?.status !== "canceled") {
    await cancelSubscriptionIfPresent(row?.stripe_subscription_id ?? null);
  }
  await deleteCustomerIfPresent(row?.stripe_customer_id ?? null);
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

/** Page size for the résumé-object sweep — `list` returns at most this many per call. */
const STORAGE_LIST_PAGE = 100;

/**
 * Step 3: remove every object under resumes/{userId}/. FAIL-CLOSED (M-STORAGE-DELETE):
 * a list OR remove error THROWS rather than being swallowed, because the cascade reports
 * success only when every step returns. Swallowing here would report a "successful"
 * erasure while the user's résumé PDFs survived. The cascade is ordered and idempotent,
 * so throwing lets the caller retry and converge. The listing is paginated (no unbounded
 * single page), and every object key is a direct child of `{userId}/` because uploads go
 * through `resumeObjectPath`, which strips path separators from the filename (so a
 * crafted `foo/bar.pdf` name can't nest an object beyond this non-recursive sweep).
 */
export async function deleteStorageObjects(userId: string): Promise<void> {
  const bucket = getSupabaseAdmin().storage.from("resumes");
  const paths: string[] = [];
  for (let offset = 0; ; offset += STORAGE_LIST_PAGE) {
    const { data, error } = await bucket.list(userId, { limit: STORAGE_LIST_PAGE, offset });
    if (error) throw new Error(`account deletion: storage list failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const o of data) if (o.name) paths.push(`${userId}/${o.name}`);
    if (data.length < STORAGE_LIST_PAGE) break; // last (partial) page
  }
  if (paths.length === 0) return; // nothing to remove / already gone
  const { error: rmError } = await bucket.remove(paths);
  // FAIL-CLOSED: do NOT swallow. If we can't confirm the PDFs are gone, the deletion has
  // NOT succeeded — throw so the ordered, idempotent cascade is retried.
  if (rmError) throw new Error(`account deletion: storage remove failed: ${rmError.message}`);
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
  await writeTombstone(userId, email); // BEFORE the Stripe cancel — see writeTombstone
  await cancelStripeForUser(userId);
  await deleteUserRowsTx(userId, email);
  await deleteStorageObjects(userId);
  await deleteAuthUser(userId);
}
