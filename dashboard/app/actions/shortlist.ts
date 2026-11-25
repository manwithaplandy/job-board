"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { setShortlistState } from "@/lib/workspaces/shortlist";
import { fillSuggested } from "@/lib/workspaces/suggested";
import type { ShortlistState } from "@/lib/workspaces/types";

// The shortlist page's actions (plan Task 1.5). The user always comes from the session;
// every write is the user's own (setBy "user"). setShortlistState validates the state,
// the reason and the job, and throws before any SQL for a malformed request.

/** One-tap triage of a job on the caller's shortlist. A skip needs one of the user reasons. */
export async function setShortlistStateAction(
  jobId: string,
  state: ShortlistState,
  reasonCode?: string,
  reasonText?: string,
): Promise<void> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await setShortlistState(userId, { jobId, state, reasonCode, reasonText, setBy: "user" });
  revalidatePath("/shortlist");
}

/**
 * Fills the Suggested section from the caller's finished reviews (no model call). The
 * page never does this on render: previews read the production database, so only this
 * action (and a finished review, Task 1.20) writes suggestions.
 */
export async function refreshSuggestedAction(): Promise<number> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  const added = await fillSuggested(userId);
  revalidatePath("/shortlist");
  return added;
}
