import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(f: Filters, userId: string): SqlQuery {
  const values: unknown[] = [userId]; // userId is always $1 (used by the join)
  const ph = () => `$${values.length + 1}`;
  const where: string[] = [];

  if (f.status === "open") where.push("j.closed_at IS NULL");
  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");

  if (f.verdict === "approve") where.push("r.verdict = 'approve'");
  else if (f.verdict === "deny") where.push("r.verdict = 'deny'");
  else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
  else if (f.verdict === "pending") where.push("r.job_id IS NULL");
  // "all" adds no verdict clause

  where.push("r.error IS NULL");

  if (f.companies.length) {
    where.push(`j.company_id = ANY(${ph()})`);
    values.push(f.companies);
  }
  for (const kw of f.include) {
    where.push(`j.title ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  for (const kw of f.exclude) {
    where.push(`j.title NOT ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  if (f.remoteOnly) where.push("j.remote IS TRUE");
  if (f.verdict === "approve" || f.verdict === "deny" || f.verdict === "all") {
    if (f.experience) {
      where.push(`r.experience_match = ${ph()}`);
      values.push(f.experience);
    }
    if (f.industry) {
      where.push(`r.industry = ${ph()}`);
      values.push(f.industry);
    }
    if (f.subcategory) {
      where.push(`r.industry_subcategory = ${ph()}`);
      values.push(f.subcategory);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    "SELECT j.id, j.title, j.url, j.location, j.remote,",
    "       j.first_seen_at, j.closed_at, c.name AS company_name, c.ats,",
    "       r.verdict, r.experience_match, r.industry, r.industry_subcategory,",
    "       r.confidence, r.reasoning, r.stage1_decision, r.stage1_reason",
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid",
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
