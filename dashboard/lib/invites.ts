import { serviceSql } from "@/lib/db";

// Invite-code gating for public signup (Phase 0 — invite-only beta).
//
// SERVICE-ROLE JUSTIFICATION (this file is on the serviceRoleAllowlist): redemption
// runs at SIGNUP, before an auth session/JWT exists, so there is no authenticated
// user context to drop into — and invite_codes/invite_redemptions have no
// authenticated RLS policy or grant by design. It therefore uses serviceSql (the
// privileged, RLS-bypassing pool). Correctness rests on the atomic UPDATE…RETURNING
// guard below, not on RLS.
//
// TRUST MODEL (read before touching this):
//   GoTrue public signups remain ENABLED, so a stranger CAN create an account by
//   calling Supabase Auth's signUp endpoint directly, bypassing our /signup route
//   and its invite check. That is acceptable because such an account has NO
//   invite_redemptions row: `invite_redemptions` — NOT user_metadata — is the
//   server-side source of truth for "this account was invited". user_metadata is
//   client-settable and must never be trusted. Every cost-incurring boundary
//   (onboarding, /api/resume/extract, and future generation routes) gates on
//   isInvitedUser() OR an existing profiles row, so a direct-API account that
//   skipped /signup can authenticate but cannot spend LLM budget.
//
//   The truly-closed alternative — disable public signups in the Supabase Auth
//   settings and mint accounts via auth.admin.createUser() from a server action —
//   is noted for the PRE-DEPLOY CHECKLIST. It is a dashboard config change, not a
//   code change, so it is not done here.

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export type RedeemResult = { ok: true } | { ok: false; reason: string };

/**
 * Atomically redeem an invite code for an email, in ONE transaction:
 *   1. UPDATE invite_codes SET uses = uses + 1 WHERE code matches AND is not
 *      exhausted (uses < max_uses) AND not expired — RETURNING proves it applied.
 *   2. INSERT the invite_redemptions row (the trusted "invited" marker).
 * The `uses < max_uses` predicate is the concurrency guard: two racing redeems of a
 * max_uses=1 code cannot both pass — the second UPDATE matches zero rows. A duplicate
 * email (unique PK) rolls the whole tx back, so a code use is never consumed for an
 * email that already redeemed.
 */
export async function redeemInvite(code: string, email: string): Promise<RedeemResult> {
  const c = code.trim();
  const e = normalizeEmail(email);
  if (!c) return { ok: false, reason: "Enter your invite code." };
  if (!e) return { ok: false, reason: "Enter your email." };
  try {
    const consumed = await serviceSql.begin(async (tx) => {
      const rows = await tx`
        UPDATE invite_codes
        SET uses = uses + 1
        WHERE code = ${c}
          AND uses < max_uses
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING code
      `;
      if (rows.length === 0) return false; // invalid / exhausted / expired
      await tx`
        INSERT INTO invite_redemptions (email, code) VALUES (${e}, ${c})
      `;
      return true;
    });
    return consumed
      ? { ok: true }
      : { ok: false, reason: "That invite code is invalid, expired, or fully used." };
  } catch (err) {
    // 23505 = unique_violation on invite_redemptions.email: this email already
    // redeemed. The tx rolled back, so the code use was NOT consumed.
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, reason: "This email has already been used to redeem an invite." };
    }
    console.error("redeemInvite failed", err);
    return { ok: false, reason: "Couldn't redeem the invite. Please try again." };
  }
}

/**
 * Best-effort rollback of a redemption when the Supabase signUp that followed it
 * fails, so the code use isn't burned on a failed signup. Deletes the redemption
 * row and decrements uses (floored at 0) in one transaction. Never throws.
 */
export async function releaseInvite(code: string, email: string): Promise<void> {
  const c = code.trim();
  const e = normalizeEmail(email);
  try {
    await serviceSql.begin(async (tx) => {
      const del = await tx`
        DELETE FROM invite_redemptions WHERE email = ${e} AND code = ${c} RETURNING code
      `;
      if (del.length > 0) {
        await tx`UPDATE invite_codes SET uses = GREATEST(uses - 1, 0) WHERE code = ${c}`;
      }
    });
  } catch (err) {
    console.error("releaseInvite failed", err);
  }
}

/** Server-side proof that this account was invited (the trusted marker). */
export async function isInvitedUser(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  const rows = await serviceSql`
    SELECT 1 FROM invite_redemptions WHERE email = ${e} LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Attach the auth user's id to their invite_redemptions row once known (at
 * onboarding). Only fills a NULL user_id so re-runs are idempotent.
 */
export async function linkInviteRedemption(email: string, userId: string): Promise<void> {
  const e = normalizeEmail(email);
  await serviceSql`
    UPDATE invite_redemptions
    SET user_id = ${userId}::uuid
    WHERE email = ${e} AND user_id IS NULL
  `;
}
