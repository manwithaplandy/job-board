"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims, requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { createThread, renameThread } from "@/lib/agent/threads";
import { undoAction, type UndoResult } from "@/lib/agent/actions/audit";
import { confirmIntent, executeIntent } from "@/lib/agent/actions/handlers";
import type { IntentOutcome } from "@/lib/agent/actions/intents";

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

// Thread actions for the agent page (plan Task 0.14). The user id always comes from the
// session; a thread id from the client is only ever matched together with it
// (lib/agent/threads.ts puts both in every WHERE, under RLS).

/** Starts a new conversation. Phase 0 runs variant 1 only. */
export async function newThread(): Promise<{ id: string }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  const thread = await createThread(userId, 1);
  revalidatePath("/agent");
  return { id: thread.id };
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
 * refreshes the workspaces the same way an undo does.
 */
export async function executeIntentAction(threadId: string, surfaceId: string, raw: unknown): Promise<IntentOutcome> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  if (typeof threadId !== "string" || typeof surfaceId !== "string") return { kind: "dropped" };
  const claims = await getUserClaims();
  const outcome = await executeIntent(userId, { threadId, surfaceId, raw, source: "host", email: claims?.email ?? null });
  if (outcome.kind === "done" && outcome.actionId !== undefined) for (const path of UNDO_PATHS) revalidatePath(path);
  return outcome;
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
