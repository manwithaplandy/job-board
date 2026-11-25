"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { createThread, renameThread } from "@/lib/agent/threads";
import { undoAction, type UndoResult } from "@/lib/agent/actions/audit";

// The pages that show agent writes, refreshed after a successful undo.
const UNDO_PATHS = ["/shortlist", "/applications", "/agent"] as const;

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
