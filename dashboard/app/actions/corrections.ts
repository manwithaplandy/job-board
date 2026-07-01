"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formToCorrection, buildDatasetItem } from "@/lib/rolefit/correction";
import type { CorrectionForm } from "@/lib/rolefit/correction";
import { upsertDatasetItem } from "@/lib/langfuseDataset";

// Persist a human correction (overlay; never mutates job_reviews) and push it to
// the LangFuse golden dataset. DB commits first, so a LangFuse failure never
// loses the correction — it returns langfuseSynced=false and is reconciled by
// `python -m reviewer.experiments sync`.
export async function saveReviewCorrection(
  jobId: string,
  form: CorrectionForm,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  const row = formToCorrection(form);

  // Model snapshot + dataset input, one round-trip.
  const inputRows = await sql`
    SELECT j.title, c.name AS company_name, j.location, c.ats, j.description,
           p.resume_text, p.instructions,
           to_jsonb(r.*) AS model_snapshot
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.id = ${jobId}
  `;
  const src = inputRows[0] as
    | {
        title: string; company_name: string; location: string | null;
        ats: string | null; description: string | null;
        resume_text: string | null; instructions: string | null;
        model_snapshot: unknown;
      }
    | undefined;
  if (!src) throw new Error(`job ${jobId} not found`);

  const correctedAt = new Date().toISOString();
  await sql`
    INSERT INTO review_corrections (
      user_id, job_id, verdict, experience_match, industry, industry_subcategory,
      confidence, role_category, seniority, work_arrangement,
      skills_score, experience_score, comp_score, fit_score,
      reasoning, about, pay_min, pay_max, pay_currency, pay_period, headcount,
      red_flags, skill_gaps, benefits, requirements, model_snapshot, note, corrected_at
    ) VALUES (
      ${userId}::uuid, ${jobId}, ${row.verdict}, ${row.experience_match},
      ${row.industry}, ${row.industry_subcategory}, ${row.confidence},
      ${row.role_category}, ${row.seniority}, ${row.work_arrangement},
      ${row.skills_score}, ${row.experience_score}, ${row.comp_score}, ${row.fit_score},
      ${row.reasoning}, ${row.about}, ${row.pay_min}, ${row.pay_max},
      ${row.pay_currency}, ${row.pay_period}, ${row.headcount},
      ${sql.json(row.red_flags)}, ${sql.json(row.skill_gaps)},
      ${sql.json(row.benefits)}, ${sql.json(row.requirements)},
      ${sql.json((src.model_snapshot ?? {}) as any)}, ${form.note}, ${correctedAt}
    )
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      verdict = EXCLUDED.verdict, experience_match = EXCLUDED.experience_match,
      industry = EXCLUDED.industry, industry_subcategory = EXCLUDED.industry_subcategory,
      confidence = EXCLUDED.confidence, role_category = EXCLUDED.role_category,
      seniority = EXCLUDED.seniority, work_arrangement = EXCLUDED.work_arrangement,
      skills_score = EXCLUDED.skills_score, experience_score = EXCLUDED.experience_score,
      comp_score = EXCLUDED.comp_score, fit_score = EXCLUDED.fit_score,
      reasoning = EXCLUDED.reasoning, about = EXCLUDED.about,
      pay_min = EXCLUDED.pay_min, pay_max = EXCLUDED.pay_max,
      pay_currency = EXCLUDED.pay_currency, pay_period = EXCLUDED.pay_period,
      headcount = EXCLUDED.headcount, red_flags = EXCLUDED.red_flags,
      skill_gaps = EXCLUDED.skill_gaps, benefits = EXCLUDED.benefits,
      requirements = EXCLUDED.requirements, model_snapshot = EXCLUDED.model_snapshot,
      note = EXCLUDED.note, corrected_at = EXCLUDED.corrected_at
  `;

  let langfuseSynced = true;
  try {
    await upsertDatasetItem(
      buildDatasetItem({
        userId, jobId,
        input: {
          title: src.title, company_name: src.company_name, location: src.location,
          ats: src.ats, description: src.description,
          resume_text: src.resume_text, instructions: src.instructions,
        },
        row, note: form.note, correctedAt,
      }),
    );
  } catch (e) {
    console.error("langfuse dataset upsert failed", e);
    langfuseSynced = false;
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}
