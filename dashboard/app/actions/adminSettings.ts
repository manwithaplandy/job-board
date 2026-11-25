"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  isValidAgentCeiling,
  saveAgentSettings,
  saveInviteSettings,
  type AgentSettingsInput,
} from "@/lib/appSettings";
import { setInviteAllowance } from "@/lib/invites";
import { clearPlanOverride, setPlanOverride } from "@/lib/planOverrides";

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
    // Atomic two-key upsert: never half-apply the (comp plan, allowance) pair.
    await saveInviteSettings(compPlan, n);
    return { ok: true };
  } catch (err) {
    console.error("saveInviteSettingsAction failed", err);
    return { ok: false, error: "Couldn't save settings. Please try again." };
  }
}

/** Agent kill switches and per-user spend ceilings (micros). Same contract as above. */
export async function saveAgentSettingsAction(input: AgentSettingsInput): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  const toggles = [input.agentEnabled, input.agentBackgroundEnabled, input.agentVariant3Enabled];
  if (!toggles.every((t) => typeof t === "boolean")) {
    return { ok: false, error: "Each switch must be On or Off." };
  }
  if (!isValidAgentCeiling(input.agentDailyCeilingMicros) || !isValidAgentCeiling(input.agentMonthlyCeilingMicros)) {
    return { ok: false, error: "Each ceiling must be between $0 and $1,000." };
  }
  try {
    // Atomic five-key upsert: never half-apply a switch and its ceilings.
    await saveAgentSettings({
      agentEnabled: input.agentEnabled,
      agentBackgroundEnabled: input.agentBackgroundEnabled,
      agentVariant3Enabled: input.agentVariant3Enabled,
      agentDailyCeilingMicros: input.agentDailyCeilingMicros,
      agentMonthlyCeilingMicros: input.agentMonthlyCeilingMicros,
    });
  } catch (err) {
    console.error("saveAgentSettingsAction failed", err);
    return { ok: false, error: "Couldn't save agent settings. Please try again." };
  }
  revalidatePath("/admin/invites");
  return { ok: true };
}

const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Pin (or clear) a tenant's effective tier (plan_overrides, spec 2026-07-16).
 * plan "" = clear the pin; expiresAt "" = pinned until cleared, else a FUTURE
 * YYYY-MM-DD stored as midnight UTC (the pin lapses at the start of that UTC day).
 */
export async function setPlanOverrideAction(input: {
  userId: string;
  plan: string;
  expiresAt: string;
  note: string;
}): Promise<AdminActionResult> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  if (!UUID_RE.test(input.userId)) return { ok: false, error: "Invalid user id." };

  const plan = input.plan.trim().toLowerCase();
  if (plan === "") {
    try {
      await clearPlanOverride(input.userId);
      return { ok: true };
    } catch (err) {
      console.error("setPlanOverrideAction clear failed", err);
      return { ok: false, error: "Couldn't clear the override. Please try again." };
    }
  }
  if (plan !== "standard" && plan !== "pro") {
    return { ok: false, error: "Override must be Standard, Pro, or No override." };
  }

  let expiresAt: Date | null = null;
  const rawExpiry = input.expiresAt.trim();
  if (rawExpiry !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)) {
      return { ok: false, error: "Expiry must be a date (YYYY-MM-DD)." };
    }
    expiresAt = new Date(`${rawExpiry}T00:00:00Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: "Expiry must be in the future." };
    }
  }

  const note = input.note.trim();
  if (note.length > 200) return { ok: false, error: "Note must be 200 characters or fewer." };

  try {
    await setPlanOverride(input.userId, plan, expiresAt, note === "" ? null : note);
    return { ok: true };
  } catch (err) {
    console.error("setPlanOverrideAction failed", err);
    return { ok: false, error: "Couldn't save the override. Please try again." };
  }
}
