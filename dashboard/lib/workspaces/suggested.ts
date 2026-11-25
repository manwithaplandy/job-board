// The deterministic "suggested" fill (plan Task 1.4, spec 14.17): the best finished
// reviews the user has not triaged yet become `suggested` shortlist rows, so the
// shortlist is never empty after a review. No model call.
//
// One INSERT ... SELECT inside withUserMutation (shortlist_items carries the lifecycle
// trigger, and the gate's global lock serializes concurrent fills, so the count of
// suggested rows read by the statement cannot race). Candidates are the caller's
// non-errored reviews, read as COALESCE(correction, review) like the agent's read
// tools, with verdict approve, a fit score, the current profile version, and a job the
// board shows as open and visible (lib/jobsQuery.ts predicates, as search_jobs uses
// them). They are ordered by fit, then job id, and capped so that the caller never
// holds more than `limit` suggested rows.
//
// briefWhy is the first sentence of the reasoning, cut to 300 characters; briefRisk is
// the first red flag, else the first skill gap, else null (also cut to 300).
import type { TransactionSql } from "postgres";
import { withUserMutation } from "@/lib/db";
import { boardOpenPredicateSql, companyGateSql } from "@/lib/jobsQuery";

export const SUGGESTED_MAX = 10;
export const BRIEF_MAX = 300;

/** The first element of a jsonb array when it is a non-blank string, cut to 300. */
function firstString(col: string): string {
  return (
    `CASE WHEN jsonb_typeof(${col}) = 'array' AND jsonb_typeof(${col} -> 0) = 'string'` +
    ` THEN NULLIF(left(btrim(${col} ->> 0), ${BRIEF_MAX}), '') END`
  );
}

/** The fill statement. $1 is the caller's user id, $2 the cap on suggested rows. */
export function fillSuggestedSql(): string {
  const gate = companyGateSql("$1");
  const reasoning = "btrim(COALESCE(rc.reasoning, r.reasoning))";
  return [
    "WITH room AS (",
    "  SELECT GREATEST(0, $2::bigint - count(*)) AS n",
    "  FROM shortlist_items WHERE user_id = $1::uuid AND state = 'suggested'",
    "), picks AS (",
    "  SELECT r.job_id,",
    `         NULLIF(left(COALESCE(substring(${reasoning} from '^.*?[.!?](?=\\s|$)'), ${reasoning}), ${BRIEF_MAX}), '') AS brief_why,`,
    `         COALESCE(${firstString("COALESCE(rc.red_flags, r.red_flags)")}, ${firstString("COALESCE(rc.skill_gaps, r.skill_gaps)")}) AS brief_risk`,
    "  FROM job_reviews r",
    "  JOIN profiles p ON p.user_id = r.user_id",
    "  JOIN jobs j ON j.id = r.job_id",
    "  JOIN companies c ON c.id = j.company_id",
    "  LEFT JOIN review_corrections rc ON rc.job_id = r.job_id AND rc.user_id = r.user_id",
    `  ${gate.join}`,
    "  WHERE r.user_id = $1::uuid",
    "    AND r.error IS NULL",
    "    AND COALESCE(rc.verdict, r.verdict) = 'approve'",
    "    AND COALESCE(rc.fit_score, r.fit_score) IS NOT NULL",
    "    AND r.profile_version = p.profile_version",
    `    AND ${boardOpenPredicateSql()}`,
    `    AND ${gate.where}`,
    "    AND NOT EXISTS (SELECT 1 FROM shortlist_items s WHERE s.user_id = r.user_id AND s.job_id = r.job_id)",
    "  ORDER BY COALESCE(rc.fit_score, r.fit_score) DESC, r.job_id",
    "  LIMIT (SELECT n FROM room)",
    ")",
    "INSERT INTO shortlist_items (user_id, job_id, state, set_by, brief_why, brief_risk)",
    "SELECT $1::uuid, job_id, 'suggested', 'system', brief_why, brief_risk FROM picks",
    "ON CONFLICT (user_id, job_id) DO NOTHING",
    "RETURNING job_id",
  ].join("\n");
}

/** Fills the caller's suggested rows up to `limit` (at most 10) and returns how many it inserted. */
export async function fillSuggested(userId: string, limit = SUGGESTED_MAX): Promise<number> {
  const cap = Number.isFinite(limit) ? Math.min(SUGGESTED_MAX, Math.max(0, Math.floor(limit))) : SUGGESTED_MAX;
  if (cap === 0) return 0;
  const text = fillSuggestedSql();
  const rows = await withUserMutation(userId, (tx: TransactionSql) => tx.unsafe(text, [userId, cap]));
  return rows.length;
}
