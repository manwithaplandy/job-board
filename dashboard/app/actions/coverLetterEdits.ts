"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { withUserSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import {
  buildCoverLetterGoldenItem,
  type CoverLetterGoldenInput,
} from "@/lib/rolefit/coverLetterScore";
import { upsertCoverLetterGoldenItem } from "@/lib/coverLetterGoldenDataset";
import { deleteCoverLetterEditTx, saveCoverLetterEditCore } from "@/lib/coverLetterEditCore";

// Persist a human EDIT of the generated cover letter (overlay; never mutates
// application_packages) and push it to the SHARED LangFuse cover-letter-golden dataset
// as the expected_output. EVERY authenticated user's edit is golden signal here — the
// evals are a proxy for user preference, so each user's edit is exactly the "ideal
// letter" we want the dataset to learn from. The push is best-effort and runs AFTER the
// DB transaction commits, so a LangFuse failure never loses the edit — it returns
// langfuseSynced=false and is reconciled by `scripts/calibrate-cover-letter-judge.ts
// --sync`. Structured like saveResumeScore (app/actions/resumeScores.ts). The write
// itself is lib/coverLetterEditCore.ts, shared with the agent's update_document_draft.
export async function saveCoverLetterEdit(
  jobId: string,
  editedText: string,
  comment: string | null = null,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's edit via a stale JWT

  const editedAt = new Date().toISOString();
  // Read the full replay context + persist the edit under the viewer's RLS context in
  // one transaction. Returns the source row for the (post-commit) LangFuse push.
  const { text, src } = await saveCoverLetterEditCore(userId, jobId, editedText, { comment });

  // Push this edit to the shared golden dataset as the expected_output. Best-effort:
  // the DB row is already committed above, so a LangFuse failure only flips
  // langfuseSynced=false (reconciled later by the --sync script) — never lost.
  let langfuseSynced = true;
  try {
    const input: CoverLetterGoldenInput = {
      background: src.resumeText,
      candidateName: src.fullName,
      instructions: src.coverLetterInstructions,
      job: {
        title: src.title, company: src.companyName, description: src.description,
        about: src.about, requirements: src.requirements,
        skillGaps: src.skillGaps, redFlags: src.redFlags,
      },
      model: src.modelCover,
    };
    await upsertCoverLetterGoldenItem(
      buildCoverLetterGoldenItem({
        userId, jobId, input, editedText: text, comment,
        traceId: src.coverLetterTraceId, model: src.modelCover,
        originalText: src.originalText, editedAt,
      }),
    );
  } catch (e) {
    console.error("cover-letter-golden dataset upsert failed", e);
    langfuseSynced = false;
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}

// "Reset to generated": drop the local overlay row so display reverts to the
// structured original. The LangFuse golden item is deliberately left intact — it
// remains a valid historical (job context → ideal letter) capture.
export async function deleteCoverLetterEdit(jobId: string): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId);
  await withUserSql(userId, (tx) => deleteCoverLetterEditTx(tx, userId, jobId));
  revalidatePath("/");
  return { ok: true };
}
