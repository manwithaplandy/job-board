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

// ── Admin invite minting (Feature 2: /admin/invites) ────────────────────────
// createInvite/listInvites run on serviceSql under the SAME justification as the
// header above: invite_codes has no authenticated RLS policy by design. They must
// only ever be called from isAdmin-gated code (app/actions/invites.ts and
// app/admin/invites/page.tsx) — never from an anon/tenant-reachable route.

/** Camel-case shape of an invite_codes row (rows arrive snake_case; see toInviteCode). */
export type InviteCode = {
  code: string;
  note: string | null;
  maxUses: number;
  uses: number;
  expiresAt: Date | null;
  createdAt: Date;
};

type InviteRow = {
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  expires_at: Date | null;
  created_at: Date;
};

const toInviteCode = (r: InviteRow): InviteCode => ({
  code: r.code,
  note: r.note,
  maxUses: r.max_uses,
  uses: r.uses,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
});

/** A caller-supplied custom code already exists — surfaced legibly by the action. */
export class InviteCodeExistsError extends Error {
  constructor() {
    super("That code already exists.");
    this.name = "InviteCodeExistsError";
  }
}

// 30 chars, no I/L/O/U/0/1 — nothing a human can misread when relaying a code.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const MAX_GENERATION_ATTEMPTS = 5;

/**
 * CSPRNG invite code in the form RF-XXXX-XXXX (~30^8 ≈ 6.6e11 space). Rejection
 * sampling (bytes ≥ 240 are discarded; 240 = 8 × 30) removes the modulo bias a
 * plain `b % 30` over 0..255 would have. Exported for tests; treat as internal.
 */
export function generateInviteCode(): string {
  const chars: string[] = [];
  while (chars.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (chars.length === 8) break;
      if (b < 240) chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return `RF-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export type CreateInviteOpts = {
  note?: string;
  maxUses?: number;
  expiresAt?: Date | null;
  code?: string;
};

/**
 * Insert one invite code and return the created row. Without `code`, an
 * RF-XXXX-XXXX code is generated; a 23505 PK collision (vanishingly rare)
 * regenerates and retries up to MAX_GENERATION_ATTEMPTS times. A caller-supplied
 * `code` is tried exactly once — a collision throws InviteCodeExistsError so the
 * action can surface it as user-legible copy instead of a raw PG error.
 */
export async function createInvite(opts: CreateInviteOpts = {}): Promise<InviteCode> {
  const note = opts.note?.trim() ? opts.note.trim() : null;
  const maxUses = opts.maxUses ?? 1;
  const expiresAt = opts.expiresAt ?? null;
  const custom = opts.code?.trim() ? opts.code.trim() : undefined;

  const attempts = custom ? 1 : MAX_GENERATION_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const code = custom ?? generateInviteCode();
    try {
      const rows = (await serviceSql`
        INSERT INTO invite_codes (code, note, max_uses, expires_at)
        VALUES (${code}, ${note}, ${maxUses}, ${expiresAt})
        RETURNING code, note, max_uses, uses, expires_at, created_at
      `) as unknown as InviteRow[];
      return toInviteCode(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code !== "23505") throw err; // real failures propagate
      if (custom) throw new InviteCodeExistsError();
      // else: astronomically unlucky collision — loop regenerates a fresh code
    }
  }
  throw new Error("Couldn't generate a unique invite code after 5 attempts.");
}

/** Every invite code, newest first, for the admin list view (`uses` IS the usage count — no join needed). */
export async function listInvites(): Promise<InviteCode[]> {
  const rows = (await serviceSql`
    SELECT code, note, max_uses, uses, expires_at, created_at
    FROM invite_codes
    ORDER BY created_at DESC
  `) as unknown as InviteRow[];
  return rows.map(toInviteCode);
}
