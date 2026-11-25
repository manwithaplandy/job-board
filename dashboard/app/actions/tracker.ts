"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { addApplicationNote, setApplicationStage, setNextStep } from "@/lib/workspaces/applications";
import type { ClosedReason, Stage } from "@/lib/workspaces/types";

// The application tracker's actions (plan Task 1.6). The user always comes from the
// session; every write is the user's own. The library validates the stage, reason, note
// and date, and refuses an unreviewed job.

/** Moves a job on the caller's tracker. Closing needs a reason. */
export async function setStageAction(jobId: string, stage: Stage, closedReason?: ClosedReason): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await setApplicationStage(userId, { jobId, stage, closedReason, actor: "user" });
  revalidatePath("/applications");
}

/** Adds a note to a job's history on the caller's tracker. */
export async function addNoteAction(jobId: string, note: string): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await addApplicationNote(userId, { jobId, note, actor: "user" });
  revalidatePath("/applications");
}

/** Sets (YYYY-MM-DD) or clears (null) the date of a job's next step. */
export async function setNextStepAction(jobId: string, date: string | null): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await setNextStep(userId, jobId, date);
  revalidatePath("/applications");
}
