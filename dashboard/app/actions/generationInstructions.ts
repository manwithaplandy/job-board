"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { assertNotDeleted } from "@/lib/tombstone";
import { upsertInstructionDraft } from "@/lib/queries";
import { INSTRUCTIONS_MAX_LENGTH } from "@/lib/rolefit/generationInstructions";

// Persist the SAVED DRAFT of a per-job generation-instructions box, independent of
// generating (the Save button). Un-gated — plain text, no LLM cost, like cover-letter
// edits (app/actions/coverLetterEdits.ts). Each Save button is per-leg, so `patch`
// normally carries exactly one leg; both are supported for completeness.
//
// NOTE: unlike normalizeInstructions (which collapses blank -> null for GENERATION),
// a blank draft is stored as "" so a cleared+saved box persists as a real empty value
// and survives reload (reads "not applied" until regenerated).
export async function saveGenerationInstructions(
  jobId: string,
  patch: { resumeInstructions?: string; coverLetterInstructions?: string },
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no writing through a stale JWT for an erased account

  const guard = (raw: string, label: string): string => {
    if (raw.length > INSTRUCTIONS_MAX_LENGTH) {
      throw new Error(`${label} instructions too long (max ${INSTRUCTIONS_MAX_LENGTH} characters)`);
    }
    return raw.trim();
  };

  if (patch.resumeInstructions !== undefined) {
    await upsertInstructionDraft(userId, jobId, "resume", guard(patch.resumeInstructions, "résumé"));
  }
  if (patch.coverLetterInstructions !== undefined) {
    await upsertInstructionDraft(userId, jobId, "cover", guard(patch.coverLetterInstructions, "cover letter"));
  }

  revalidatePath("/");
  return { ok: true };
}
