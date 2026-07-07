"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { withUserSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import {
  buildCoverLetterGoldenItem,
  type CoverLetterGoldenInput,
} from "@/lib/rolefit/coverLetterScore";
import { upsertCoverLetterGoldenItem } from "@/lib/coverLetterGoldenDataset";

const EDITED_TEXT_MAX_LENGTH = 20_000;

// Persist a human EDIT of the generated cover letter (overlay; never mutates
// application_packages) and push it to the SHARED LangFuse cover-letter-golden dataset
// as the expected_output. EVERY authenticated user's edit is golden signal here — the
// evals are a proxy for user preference, so each user's edit is exactly the "ideal
// letter" we want the dataset to learn from. The push is best-effort and runs AFTER the
// DB transaction commits, so a LangFuse failure never loses the edit — it returns
// langfuseSynced=false and is reconciled by `scripts/calibrate-cover-letter-judge.ts
// --sync`. Structured like saveResumeScore (app/actions/resumeScores.ts).
export async function saveCoverLetterEdit(
  jobId: string,
  editedText: string,
  comment: string | null = null,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's edit via a stale JWT
  const text = editedText.trim();
  if (!text) throw new Error("edited cover letter must not be empty");
  if (text.length > EDITED_TEXT_MAX_LENGTH) {
    throw new Error(`edited cover letter too long (max ${EDITED_TEXT_MAX_LENGTH} characters)`);
  }

  const editedAt = new Date().toISOString();
  // Read the full replay context + persist the edit under the viewer's RLS context in
  // one transaction. Returns the source row for the (post-commit) LangFuse push.
  const src = await withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT ap.cover_letter_json, ap.cover_letter_trace_id, ap.cover_letter_instructions,
             j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
             r.about,
             COALESCE(r.requirements, '[]'::jsonb) AS requirements,
             COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
             COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
             p.resume_text, p.full_name, p.model_cover
      FROM application_packages ap
      JOIN jobs j       ON j.id = ap.job_id
      JOIN companies c  ON c.id = j.company_id
      LEFT JOIN job_reviews r ON r.job_id = ap.job_id AND r.user_id = ${userId}::uuid
      LEFT JOIN profiles p    ON p.user_id = ${userId}::uuid
      WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
    `;
    const s = rows[0] as
      | {
          cover_letter_json: unknown; cover_letter_trace_id: string | null;
          cover_letter_instructions: string | null;
          title: string; company_name: string; description: string | null;
          about: string | null; requirements: { text: string; met: boolean }[];
          skill_gaps: string[]; red_flags: string[];
          resume_text: string | null; full_name: string | null; model_cover: string | null;
        }
      | undefined;
    if (!s) throw new Error(`no cover letter generated for job ${jobId}`);

    // The eval "before": composed text of the stored structured letter. A malformed
    // jsonb (total parser returns null) degrades to null, never a crash.
    const parsed = parseTailoredCoverLetter(s.cover_letter_json);
    const originalText = parsed ? composeCoverLetterText(parsed) : null;

    // Re-saving overwrites (last-write-wins) and REVIVES a superseded edit
    // (superseded_at back to NULL) — the fresh edit is current again.
    await tx`
      INSERT INTO cover_letter_edits
        (user_id, job_id, edited_text, original_text, cover_letter_trace_id,
         model, comment, superseded_at, edited_at)
      VALUES (${userId}::uuid, ${jobId}, ${text}, ${originalText}, ${s.cover_letter_trace_id},
              ${s.model_cover}, ${comment}, NULL, now())
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        edited_text = EXCLUDED.edited_text, original_text = EXCLUDED.original_text,
        cover_letter_trace_id = EXCLUDED.cover_letter_trace_id, model = EXCLUDED.model,
        comment = EXCLUDED.comment, superseded_at = NULL, edited_at = now()
    `;
    return { ...s, originalText };
  });

  // Push this edit to the shared golden dataset as the expected_output. Best-effort:
  // the DB row is already committed above, so a LangFuse failure only flips
  // langfuseSynced=false (reconciled later by the --sync script) — never lost.
  let langfuseSynced = true;
  try {
    const input: CoverLetterGoldenInput = {
      background: src.resume_text,
      candidateName: src.full_name,
      instructions: src.cover_letter_instructions,
      job: {
        title: src.title, company: src.company_name, description: src.description,
        about: src.about, requirements: src.requirements,
        skillGaps: src.skill_gaps, redFlags: src.red_flags,
      },
      model: src.model_cover,
    };
    await upsertCoverLetterGoldenItem(
      buildCoverLetterGoldenItem({
        userId, jobId, input, editedText: text, comment,
        traceId: src.cover_letter_trace_id, model: src.model_cover,
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
  await withUserSql(userId, (tx) => tx`
    DELETE FROM cover_letter_edits WHERE user_id = ${userId}::uuid AND job_id = ${jobId}
  `);
  revalidatePath("/");
  return { ok: true };
}
