"use server";

import { headers } from "next/headers";
import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { loadAppSettings } from "@/lib/appSettings";
import {
  createUserInvite,
  getInviteAllowance,
  isInvitedUser,
  releaseUserInvite,
} from "@/lib/invites";
import { sendInviteEmail, sesConfig } from "@/lib/inviteEmail";
import { isDisposableEmail } from "@/lib/emailGuard";

// User-facing invite actions (spec 2026-07-13). SECURITY: each action re-gates on an
// authenticated session AND a non-null effective plan (getViewerPlan) FIRST — before
// any parsing or DB work — so a direct-API account that bypassed /signup (the
// documented trust-model hole in lib/invites.ts) can neither mint codes nor send
// email. Privileged SQL stays in lib/invites.ts (mirrors app/actions/invites.ts).
//
// ERROR CONTRACT: expected failures return { ok: false, error } (house pattern —
// thrown server-action messages are redacted in production).

// Per-call sanity bound on addresses; the allowance is the real limiter (each mint
// atomically spends one invite).
const MAX_ADDRESSES_PER_SEND = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NO_PLAN_ERROR = "Inviting requires an active plan.";

async function gateViewer(): Promise<{ userId: string; email: string | null } | null> {
  const claims = await getUserClaims();
  if (!claims) return null;
  const plan = await getViewerPlan(claims.id, claims.email);
  if (!plan) return null;
  return { userId: claims.id, email: claims.email };
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
}

const signupLink = (origin: string, code: string) =>
  `${origin}/signup?code=${encodeURIComponent(code)}`;

export type InviteStatus =
  | { ok: true; remaining: number; granted: number; emailConfigured: boolean }
  | { ok: false; error: string };

export async function getInviteStatusAction(): Promise<InviteStatus> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  const settings = await loadAppSettings();
  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return { ok: true, ...allowance, emailConfigured: sesConfig() !== null };
}

export type SendResult = {
  email: string;
  status: "sent" | "skipped" | "failed";
  detail: string;
};
export type SendInvitesResult =
  | { ok: true; results: SendResult[]; remaining: number }
  | { ok: false; error: string };

export async function sendInvitesAction(rawEmails: string): Promise<SendInvitesResult> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  // Config check BEFORE any spend — an unconfigured SES must not burn allowance.
  if (sesConfig() === null) {
    return { ok: false, error: "Email sending isn't configured yet — generate a code instead." };
  }

  const addresses = Array.from(
    new Set(rawEmails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  if (addresses.length === 0) return { ok: false, error: "Enter at least one email address." };
  if (addresses.length > MAX_ADDRESSES_PER_SEND) {
    return { ok: false, error: `At most ${MAX_ADDRESSES_PER_SEND} addresses per send.` };
  }

  const origin = await requestOrigin();
  const settings = await loadAppSettings();
  const results: SendResult[] = [];
  let exhausted = false;

  for (const email of addresses) {
    if (exhausted) {
      results.push({ email, status: "skipped", detail: "no invites left" });
      continue;
    }
    // Zero-spend pre-checks: none of these consume an invite.
    if (!EMAIL_RE.test(email)) {
      results.push({ email, status: "skipped", detail: "not a valid email address" });
      continue;
    }
    if (isDisposableEmail(email)) {
      results.push({ email, status: "skipped", detail: "this address would be blocked at signup" });
      continue;
    }
    if (await isInvitedUser(email)) {
      results.push({ email, status: "skipped", detail: "already a member" });
      continue;
    }

    const minted = await createUserInvite(viewer.userId, {
      defaultAllowance: settings.inviteDefaultAllowance,
      recipientEmail: email,
    });
    if (!minted.ok) {
      if (minted.reason === "exhausted") {
        exhausted = true;
        results.push({ email, status: "failed", detail: "no invites left" });
      } else {
        results.push({ email, status: "failed", detail: "couldn't create an invite" });
      }
      continue;
    }

    const sent = await sendInviteEmail({
      to: email,
      code: minted.invite.code,
      link: signupLink(origin, minted.invite.code),
      inviterEmail: viewer.email,
    });
    if (!sent.ok) {
      // Refund: an invite is only spent when the email actually handed off to SES.
      await releaseUserInvite(minted.invite.code, viewer.userId);
      results.push({ email, status: "failed", detail: "sending failed — invite refunded" });
    } else {
      results.push({ email, status: "sent", detail: "invite sent" });
    }
  }

  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return { ok: true, results, remaining: allowance.remaining };
}

export type GenerateCodeResult =
  | { ok: true; code: string; link: string; remaining: number }
  | { ok: false; error: string };

export async function generateInviteCodeAction(): Promise<GenerateCodeResult> {
  const viewer = await gateViewer();
  if (!viewer) return { ok: false, error: NO_PLAN_ERROR };
  const settings = await loadAppSettings();
  const minted = await createUserInvite(viewer.userId, {
    defaultAllowance: settings.inviteDefaultAllowance,
  });
  if (!minted.ok) {
    return {
      ok: false,
      error: minted.reason === "exhausted"
        ? "You've used all your invites."
        : "Couldn't create an invite. Please try again.",
    };
  }
  const origin = await requestOrigin();
  const allowance = await getInviteAllowance(viewer.userId, settings.inviteDefaultAllowance);
  return {
    ok: true,
    code: minted.invite.code,
    link: signupLink(origin, minted.invite.code),
    remaining: allowance.remaining,
  };
}
