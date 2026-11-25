"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims, requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { getViewerPlan } from "@/lib/subscriptions";
import { loadAppSettings } from "@/lib/appSettings";
import { createThread, getThread, renameThread, setThreadVariant } from "@/lib/agent/threads";
import { getDefaultVariant, setDefaultVariant } from "@/lib/agent/settings";
import { isVariant } from "@/lib/agent/variants";
import { undoAction, type UndoResult } from "@/lib/agent/actions/audit";
import { confirmIntent, executeIntent } from "@/lib/agent/actions/handlers";
import type { ActionIntent, IntentOutcome } from "@/lib/agent/actions/intents";
import { describeIntent, frameIntent, isDirectOpen, type IntentDescription } from "@/lib/agent/actions/describe";
import { getSurface, markSurfaceFailed } from "@/lib/agent/surfaces/store";
import { SurfacePayloadV1Schema, type SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import { isFrameFailure } from "@/lib/agent/surfaces/v3/bridge";
import { parseOrNull } from "@/lib/zodParse";
import { describePendingApproval, type PendingApproval } from "@/lib/agent/actions/approvalCard";
import { loadHostSurface, type HostSurface } from "@/lib/agent/surfaces/host";
import type { BlockRows } from "@/components/agent/blocks/types";

// The pages that show agent writes, refreshed after a successful undo. undoAction does
// not say which kind it undid, so this covers every registered undoer:
//   shortlist.set        /shortlist
//   application.*        /applications, /shortlist (tracked stage), / and /board (package status)
//   profile.set_resume   /documents, /profile, /profile/resume, /looking-for
//   analytics.set_tiles  /analytics
//   document.update_draft  /documents, /applications, / (the cover letter overlay)
// and /agent for all of them.
const UNDO_PATHS = [
  "/shortlist",
  "/applications",
  "/documents",
  "/agent",
  "/",
  "/board",
  "/profile",
  "/profile/resume",
  "/looking-for",
  "/analytics",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Thread actions for the agent page (plan Task 0.14). The user id always comes from the
// session; a thread id from the client is only ever matched together with it
// (lib/agent/threads.ts puts both in every WHERE, under RLS).

/**
 * Starts a new conversation in the user's default variant (agent_settings.default_variant,
 * plan Task 2.8). A failed settings read starts it in variant 1. A variant 3 default is
 * kept as recorded: while variant 3 is switched off the thread presents as variant 1.
 */
export async function newThread(): Promise<{ id: string }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  const variant = await getDefaultVariant(userId).catch(() => 1 as const);
  const thread = await createThread(userId, variant);
  revalidatePath("/agent");
  return { id: thread.id };
}

export type VariantChange = { ok: true } | { ok: false; reason: "invalid" | "no_plan" | "variant3_off" | "not_found" };

/**
 * The switcher's two checks (plan Task 2.8): any signed-in user with a plan may pick any of
 * the three variants (spec 7.2, Andrew 2026-11-19: no admin gate). Variant 3 is refused
 * while the operator switch agentVariant3Enabled is off; nothing here changes that switch.
 */
async function variantAllowed(userId: string, variant: unknown): Promise<VariantChange> {
  if (!isVariant(variant)) return { ok: false, reason: "invalid" };
  const claims = await getUserClaims();
  if (!(await getViewerPlan(userId, claims?.email ?? null))) return { ok: false, reason: "no_plan" };
  if (variant === 3 && !(await loadAppSettings()).agentVariant3Enabled) return { ok: false, reason: "variant3_off" };
  return { ok: true };
}

/**
 * Sets the variant of one of the caller's threads. It applies from the next turn on (the
 * loop reads the thread's variant when a turn starts); surfaces already shown keep the
 * variant recorded on their rows.
 */
export async function setThreadVariantAction(threadId: string, variant: number): Promise<VariantChange> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof threadId !== "string" || !UUID_RE.test(threadId)) return { ok: false, reason: "not_found" };
  const allowed = await variantAllowed(userId, variant);
  if (!allowed.ok || !isVariant(variant)) return allowed;
  if (!(await getThread(userId, threadId))) return { ok: false, reason: "not_found" };
  await setThreadVariant(userId, threadId, variant);
  revalidatePath("/agent");
  return { ok: true };
}

/** Sets the variant new threads start with (agent_settings.default_variant). */
export async function setDefaultVariantAction(variant: number): Promise<VariantChange> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  const allowed = await variantAllowed(userId, variant);
  if (!allowed.ok || !isVariant(variant)) return allowed;
  await setDefaultVariant(userId, variant);
  revalidatePath("/agent");
  return { ok: true };
}

/** Renames one of the caller's threads. A blank title or an unknown thread is refused. */
export async function renameThreadAction(id: string, title: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof id !== "string" || typeof title !== "string") return { ok: false };
  try {
    await renameThread(userId, id, title);
  } catch {
    return { ok: false };
  }
  revalidatePath("/agent");
  return { ok: true };
}

/**
 * Undoes one of the caller's agent writes (the "by agent" marker's Undo, plan Task 1.5).
 * undoAction re-reads the live row and refuses with changed_since when it moved on; a
 * refusal is passed back as is and nothing is revalidated.
 */
export async function undoAgentAction(actionId: number): Promise<UndoResult> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof actionId !== "number" || !Number.isSafeInteger(actionId) || actionId <= 0) {
    return { ok: false, reason: "not_found" };
  }
  const result = await undoAction(userId, actionId);
  if (result.ok) for (const path of UNDO_PATHS) revalidatePath(path);
  return result;
}

/**
 * A press on a surface (plan Task 1.14). The intent is parsed against the closed enum
 * and dispatched host-side; the session user is the only user it can act for. A write
 * refreshes the workspaces the same way an undo does. `source` is "frame" for the press
 * of a variant 3 frame's chip (Task 2.6); executeIntent accepts that only for a variant 3
 * surface of the thread.
 */
export async function executeIntentAction(
  threadId: string,
  surfaceId: string,
  raw: unknown,
  source: "host" | "frame" = "host",
): Promise<IntentOutcome> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof threadId !== "string" || typeof surfaceId !== "string") return { kind: "dropped" };
  if (source !== "host" && source !== "frame") return { kind: "dropped" };
  const claims = await getUserClaims();
  const outcome = await executeIntent(userId, { threadId, surfaceId, raw, source, email: claims?.email ?? null });
  if (outcome.kind === "done" && outcome.actionId !== undefined) for (const path of UNDO_PATHS) revalidatePath(path);
  return outcome;
}

/** A variant 3 surface of the caller's in this thread, or null. */
async function ownVariant3(userId: string, surfaceId: string, threadId: string | null): Promise<boolean> {
  if (!UUID_RE.test(surfaceId) || (threadId !== null && !UUID_RE.test(threadId))) return false;
  const surface = await getSurface(userId, surfaceId);
  return surface !== null && surface.variant === 3 && (threadId === null || surface.threadId === threadId);
}

/** The chip a frame's action request becomes (D13): the parsed intent and its database-built text. */
export interface FrameChip extends IntentDescription {
  intent: ActionIntent;
  /** An open of a workspace page with nothing else, which may run without a press once per surface. */
  direct: boolean;
}

/**
 * What a variant 3 frame's action message would do, for its chip (plan Task 2.6). Writes
 * nothing. The name and args are the frame's: they are parsed with the closed enum, and
 * the label is built from database values only (lib/agent/actions/describe.ts). Null when
 * they do not parse, the surface is not a variant 3 surface of the caller's in this
 * thread, or describeIntent offers no chip.
 */
export async function describeFrameIntentAction(
  threadId: string,
  surfaceId: string,
  name: unknown,
  args: unknown,
): Promise<FrameChip | null> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof threadId !== "string" || typeof surfaceId !== "string" || typeof name !== "string") return null;
  const intent = frameIntent(name, args);
  if (intent === null) return null;
  if (!(await ownVariant3(userId, surfaceId, threadId))) return null;
  const described = await describeIntent(userId, intent);
  return described === null ? null : { ...described, intent, direct: isDirectOpen(intent) };
}

/**
 * A variant 3 frame failed in the browser (plan Task 2.6): no handshake, an error, a
 * self-navigation or too many action requests. Marks the caller's surface as fallen back
 * with the reason (one of FRAME_FAILURES) and returns its stored variant 1 fallback, parsed
 * with the variant 1 schema, or null (the frame then shows the fallback it already has).
 */
export async function reportSurfaceFailure(surfaceId: string, reason: string): Promise<SurfacePayloadV1 | null> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof surfaceId !== "string" || !isFrameFailure(reason)) return null;
  if (!(await ownVariant3(userId, surfaceId, null))) return null;
  const stored = await markSurfaceFailed(userId, surfaceId, reason);
  return stored === null ? null : parseOrNull(SurfacePayloadV1Schema, stored);
}

/** The Confirm button of a fixed confirm card: runs the intent its signed token carries. */
export async function confirmIntentAction(token: string): Promise<IntentOutcome> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  const claims = await getUserClaims();
  const outcome = await confirmIntent(userId, claims?.email ?? null, token);
  if (outcome.kind === "done") for (const path of UNDO_PATHS) revalidatePath(path);
  return outcome;
}

// Reads for the agent page's surface host (plan Task 1.20). They write nothing; the ids
// are only ever matched together with the session user (lib/agent/surfaces/host.ts).

/** A surface the turn just presented, parsed for BlockList, or null when it is not the caller's in this thread. */
export async function loadSurfaceAction(threadId: string, surfaceId: string): Promise<HostSurface | null> {
  const userId = await requireUserId();
  if (typeof threadId !== "string" || typeof surfaceId !== "string") return null;
  // A variant 3 surface mounts its frame only while the operator switch is on (R15).
  const { agentVariant3Enabled } = await loadAppSettings();
  return loadHostSurface(userId, threadId, surfaceId, { variant3Enabled: agentVariant3Enabled });
}

/** A shown surface's database rows again (after a prep settles), keyed by the stored payload's ids. */
export async function reloadSurfaceRowsAction(threadId: string, surfaceId: string): Promise<BlockRows | null> {
  const surface = await loadSurfaceAction(threadId, surfaceId);
  return surface?.rows ?? null;
}

/** The fixed confirm card for a pending tool approval, built from the stored part (never the client's copy). */
export async function describeApprovalAction(threadId: string, approvalId: string): Promise<PendingApproval> {
  const userId = await requireUserId();
  if (typeof threadId !== "string" || typeof approvalId !== "string") return { status: "invalid" };
  const claims = await getUserClaims();
  return describePendingApproval(userId, threadId, approvalId, claims?.email ?? null);
}
