"use server";

import { requireUserId } from "@/lib/auth";
import { withUserSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
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
  await assertNotDeleted(userId); // no resurrecting an erased account's correction via a stale JWT
  const row = formToCorrection(form);

  // Read inputs + persist the correction under the viewer's RLS context, in one
  // transaction. Returns the source row for the (post-commit) LangFuse sync.
  const correctedAt = new Date().toISOString(); // used for LangFuse dataset item only
  const src = await withUserSql(userId, async (tx) => {
    // Model snapshot + dataset input, one round-trip.
    const inputRows = await tx`
      SELECT j.title, c.name AS company_name, j.location, c.ats, j.description,
             p.resume_text, p.instructions,
             to_jsonb(r.*) AS model_snapshot
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
      LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
      WHERE j.id = ${jobId}
    `;
    const s = inputRows[0] as
      | {
          title: string; company_name: string; location: string | null;
          ats: string | null; description: string | null;
          resume_text: string | null; instructions: string | null;
          model_snapshot: unknown;
        }
      | undefined;
    if (!s) throw new Error(`job ${jobId} not found`);

    await tx`
      INSERT INTO review_corrections (
        user_id, job_id, verdict, experience_match, industry, industry_subcategory,
        confidence, role_category, seniority, work_arrangement,
        skills_score, experience_score, comp_score, fit_score,
        reasoning, about, pay_min, pay_max, pay_currency, pay_period, headcount,
        red_flags, skill_gaps, benefits, requirements, model_snapshot, note, corrected_at,
        description_snapshot, resume_text_snapshot, instructions_snapshot
      ) VALUES (
        ${userId}::uuid, ${jobId}, ${row.verdict}, ${row.experience_match},
        ${row.industry}, ${row.industry_subcategory}, ${row.confidence},
        ${row.role_category}, ${row.seniority}, ${row.work_arrangement},
        ${row.skills_score}, ${row.experience_score}, ${row.comp_score}, ${row.fit_score},
        ${row.reasoning}, ${row.about}, ${row.pay_min}, ${row.pay_max},
        ${row.pay_currency}, ${row.pay_period}, ${row.headcount},
        ${tx.json(row.red_flags)}, ${tx.json(row.skill_gaps)},
        ${tx.json(row.benefits)}, ${tx.json(row.requirements)},
        ${tx.json((s.model_snapshot ?? {}) as any)}, ${form.note}, now(),
        ${s.description}, ${s.resume_text}, ${s.instructions}
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
        note = EXCLUDED.note, corrected_at = now(),
        description_snapshot = EXCLUDED.description_snapshot,
        resume_text_snapshot = EXCLUDED.resume_text_snapshot,
        instructions_snapshot = EXCLUDED.instructions_snapshot
    `;
    return s;
  });

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

  return { ok: true, langfuseSynced };
}
