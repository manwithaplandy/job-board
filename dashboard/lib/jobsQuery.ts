import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(f: Filters): SqlQuery {
  const where: string[] = [];
  const values: unknown[] = [];
  const ph = () => `$${values.length + 1}`;

  if (f.status === "open") where.push("j.closed_at IS NULL");
  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");

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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    "SELECT j.id, j.title, j.url, j.location, j.remote,",
    "       j.first_seen_at, j.closed_at, c.name AS company_name, c.ats",
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
