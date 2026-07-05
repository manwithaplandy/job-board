"use server";

import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createInvite, InviteCodeExistsError } from "@/lib/invites";

// Admin-only invite minting (Feature 2). SECURITY: this action is independently
// reachable regardless of the /admin/invites page gate, so it re-gates on isAdmin
// FIRST — before validation, before any DB work (mirrors app/actions/companies.ts).
// It deliberately does NOT import serviceSql: all privileged SQL stays inside
// lib/invites.ts (the serviceRoleAllowlist file).
//
// ERROR CONTRACT: validation/collision failures return { ok: false, error } rather
// than throwing — Next.js redacts thrown server-action messages in production, so a
// thrown "Max uses must be…" would reach the form as a useless generic error. The
// result union mirrors the RedeemResult house pattern (lib/invites.ts). The
// unauthorized case still THROWS: strangers get no legible detail by design.

// Custom codes: 4-40 chars of A-Z / 0-9 / hyphen, starting and ending alphanumeric
// (covers the FOUNDER-01 and RF-XXXX-XXXX shapes). Input is uppercased first —
// redeemInvite is case-sensitive and every real code is uppercase.
const CUSTOM_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/;

export type CreateInviteInput = {
  note?: string;
  // From the form's <input type="number"> via Number(...) — validated to an int in 1..1000.
  maxUses?: number;
  // From the form's <input type="date"> (YYYY-MM-DD) — interpreted as end of that day; must be today or later.
  expiresAt?: string | null;
  code?: string;
};

export type CreateInviteResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function createInviteAction(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  const maxUses = input.maxUses ?? 1;
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
    return { ok: false, error: "Max uses must be a whole number between 1 and 1000." };
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Expiry must be a valid date." };
    }
    // A date-only value (YYYY-MM-DD) parses to UTC midnight; treat it as the END of
    // that day so an expiry of "today" stays valid through the whole day rather than
    // being rejected as already past.
    // NOTE: this boundary is intentionally UTC end-of-day, so a "today" picked in a
    // far-west timezone (still on the prior UTC date) could theoretically be rejected.
    parsed.setUTCHours(23, 59, 59, 999);
    if (parsed.getTime() <= Date.now()) {
      return { ok: false, error: "Expiry must be today or later." };
    }
    expiresAt = parsed;
  }

  let code: string | undefined;
  const trimmedCode = input.code?.trim();
  if (trimmedCode) {
    code = trimmedCode.toUpperCase();
    if (!CUSTOM_CODE_RE.test(code)) {
      return {
        ok: false,
        error: "Custom codes must be 4-40 characters of letters, digits, or hyphens.",
      };
    }
  }

  // Pass the trimmed note through; createInvite owns the 200-char cap (an app-chosen
  // bound — the note column is unconstrained TEXT; the form's maxLength mirrors it).
  const note = input.note?.trim() || undefined;

  try {
    const created = await createInvite({ note, maxUses, expiresAt, code });
    return { ok: true, code: created.code };
  } catch (err) {
    if (err instanceof InviteCodeExistsError) {
      return { ok: false, error: err.message };
    }
    console.error("createInviteAction failed", err);
    return { ok: false, error: "Couldn't create the invite. Please try again." };
  }
}
