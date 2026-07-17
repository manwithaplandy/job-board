"use server";

import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { saveAppSetting } from "@/lib/appSettings";
import { setInviteAllowance } from "@/lib/invites";

// Admin-only operator settings. SECURITY: independently reachable regardless of the
// admin pages' gates, so each action re-gates on isAdmin FIRST — before validation,
// before any DB work (mirrors app/actions/invites.ts). ERROR CONTRACT: validation
// failures return { ok: false, error }; the unauthorized case THROWS (strangers get
// no legible detail by design).

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function saveInviteSettingsAction(input: {
  compPlan: string;
  defaultAllowance: number;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  const compPlan = input.compPlan.trim().toLowerCase();
  if (compPlan !== "standard" && compPlan !== "pro" && compPlan !== "none") {
    return { ok: false, error: "Comp plan must be Standard, Pro, or None." };
  }
  const n = input.defaultAllowance;
  if (!Number.isInteger(n) || n < 0 || n > 1000) {
    return { ok: false, error: "Default allowance must be a whole number between 0 and 1000." };
  }
  try {
    await saveAppSetting("invite_comp_plan", compPlan);
    await saveAppSetting("invite_default_allowance", n);
    return { ok: true };
  } catch (err) {
    console.error("saveInviteSettingsAction failed", err);
    return { ok: false, error: "Couldn't save settings. Please try again." };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setInviteAllowanceAction(input: {
  userId: string;
  remaining: number;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  if (!UUID_RE.test(input.userId)) return { ok: false, error: "Invalid user id." };
  if (!Number.isInteger(input.remaining) || input.remaining < 0 || input.remaining > 1000) {
    return { ok: false, error: "Invites left must be a whole number between 0 and 1000." };
  }
  try {
    await setInviteAllowance(input.userId, input.remaining);
    return { ok: true };
  } catch (err) {
    console.error("setInviteAllowanceAction failed", err);
    return { ok: false, error: "Couldn't update the allowance. Please try again." };
  }
}
