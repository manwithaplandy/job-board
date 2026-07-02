"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formToScoreRow, buildResumeGoldenItem, type ResumeScoreForm } from "@/lib/rolefit/resumeScore";
import { upsertResumeGoldenItem } from "@/lib/resumeGoldenDataset";
import { parseTailoredResume } from "@/lib/rolefit/packageCodec";

// Persist a human résumé score (grounding + JD-relevance, 1–5) and push it to the
// LangFuse `resume-golden` dataset. DB commits first, so a LangFuse failure never
// loses the score — it returns langfuseSynced=false and is reconciled by
// `node scripts/calibrate-resume-judge.ts --sync`.
export async function saveResumeScore(
  jobId: string,
  form: ResumeScoreForm,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  const row = formToScoreRow(form);

  // Snapshot the exact résumé scored + capture the trace id and generation inputs.
  const rows = await sql`
    SELECT ap.resume_json, ap.resume_trace_id,
           j.title, c.name AS company_name, j.description,
           p.resume_text, p.model_resume
    FROM application_packages ap
    JOIN jobs j       ON j.id = ap.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
    WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
  `;
  const src = rows[0] as
    | {
        resume_json: unknown; resume_trace_id: string | null;
        title: string; company_name: string; description: string | null;
        resume_text: string | null; model_resume: string | null;
      }
    | undefined;
  if (!src) throw new Error(`no résumé generated for job ${jobId}`);

  const scoredAt = new Date().toISOString();
  await sql`
    INSERT INTO resume_scores (
      user_id, job_id, grounding, jd_relevance, comment,
      resume_trace_id, resume_snapshot, model, scored_at
    ) VALUES (
      ${userId}::uuid, ${jobId}, ${row.grounding}, ${row.jd_relevance}, ${row.comment},
      ${src.resume_trace_id}, ${JSON.stringify(parseTailoredResume(src.resume_json) ?? {})}::jsonb, ${src.model_resume}, now()
    )
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      grounding = EXCLUDED.grounding, jd_relevance = EXCLUDED.jd_relevance,
      comment = EXCLUDED.comment, resume_trace_id = EXCLUDED.resume_trace_id,
      resume_snapshot = EXCLUDED.resume_snapshot, model = EXCLUDED.model,
      scored_at = now()
  `;

  let langfuseSynced = true;
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

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}
