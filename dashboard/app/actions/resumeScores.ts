"use server";

import { readPrivateSnapshot } from "@/lib/jobLifecycle";

import { revalidatePath } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { withUserPayloadMutation } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { formToScoreRow, buildResumeGoldenItem, type ResumeScoreForm } from "@/lib/rolefit/resumeScore";
import { upsertResumeGoldenItem } from "@/lib/resumeGoldenDataset";
import { parseTailoredResume } from "@/lib/rolefit/packageCodec";

// Persist a human résumé score (grounding + JD-relevance, 1–5) and — for ADMINS only —
// push it to the SHARED LangFuse `resume-golden` dataset. DB commits first, so a LangFuse
// failure never loses the score — it returns langfuseSynced=false and is reconciled by
// `node scripts/calibrate-resume-judge.ts --sync`.
//
// TENANT EVAL-POISONING (minor 8): resume-golden is a SHARED eval asset; unvalidated
// tenant input must not poison it, so the golden push is gated to isAdmin. A normal
// user's score still persists (the DB row below) — it just never reaches the dataset.
export async function saveResumeScore(
  jobId: string,
  form: ResumeScoreForm,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  await assertNotDeleted(userId); // no resurrecting an erased account's score via a stale JWT
  const row = formToScoreRow(form);

  const scoredAt = new Date().toISOString();
  // Snapshot the exact résumé scored + persist, under the viewer's RLS context in
  // one transaction. Returns the source row for the (post-commit) LangFuse sync.
  const src = await withUserPayloadMutation(userId, jobId, "resume_scores", async (tx) => {
    const snapshot = await readPrivateSnapshot(tx, jobId, "application_packages");
    const rows = await tx`
      SELECT ap.resume_json, ap.resume_trace_id,
             j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
             p.resume_text, p.model_resume
      FROM application_packages ap
      JOIN jobs j       ON j.id = ap.job_id
      JOIN companies c  ON c.id = j.company_id
      LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
      WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
    `;
    const s = rows[0] as
      | {
          resume_json: unknown; resume_trace_id: string | null;
          title: string; company_name: string; description: string | null;
          resume_text: string | null; model_resume: string | null;
        }
      | undefined;
    if (!s) throw new Error(`no résumé generated for job ${jobId}`);

    await tx`
      INSERT INTO resume_scores (
        user_id, job_id, job_version_id, description_snapshot, questions_snapshot, snapshot_captured_at, grounding, jd_relevance, comment,
        resume_trace_id, resume_snapshot, model, scored_at
      ) VALUES (
        ${userId}::uuid, ${jobId}, ${snapshot?.versionId ?? null}::uuid, ${snapshot?.description ?? null},
        ${snapshot?.questions ? JSON.stringify(snapshot.questions) : null}::text::jsonb, ${snapshot?.capturedAt ?? null}, ${row.grounding}, ${row.jd_relevance}, ${row.comment},
        ${s.resume_trace_id}, ${JSON.stringify(parseTailoredResume(s.resume_json) ?? {})}::jsonb, ${s.model_resume}, now()
      )
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        grounding = EXCLUDED.grounding, jd_relevance = EXCLUDED.jd_relevance,
        comment = EXCLUDED.comment, resume_trace_id = EXCLUDED.resume_trace_id,
        resume_snapshot = EXCLUDED.resume_snapshot, model = EXCLUDED.model,
        scored_at = now()
    `;
    return { ...s, description: snapshot ? snapshot.description : s.description };
  });

  // Admin-only push to the shared golden dataset (minor 8). Non-admins: DB row persisted
  // above, nothing to reconcile → langfuseSynced stays true.
  let langfuseSynced = true;
  if (isAdmin(await getUserClaims())) {
    try {
      await upsertResumeGoldenItem(
        buildResumeGoldenItem({
          userId, jobId,
          input: {
            title: src.title, company: src.company_name, description: src.description,
            background: src.resume_text, model: src.model_resume,
          },
          form, traceId: src.resume_trace_id, model: src.model_resume, scoredAt,
        }),
      );
    } catch (e) {
      console.error("resume-golden dataset upsert failed", e);
      langfuseSynced = false;
    }
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}
