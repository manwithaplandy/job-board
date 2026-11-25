"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { createThread, renameThread } from "@/lib/agent/threads";

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
