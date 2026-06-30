import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(
  f: Filters,
  userId: string | null,
  ownerLocations: string[] = [],
): SqlQuery {
  const values: unknown[] = [];
  const ph = () => `$${values.length + 1}`;
  const where: string[] = [];
  const hasReviews = userId !== null;

  // The review join binds the owner's user_id. Capture its placeholder before
  // seeding the value (so it resolves to $1, with values still empty), so the
  // join string isn't coupled to a hardcoded "$1" if the seeding order changes.
  const ownerPh = hasReviews ? ph() : null;
  if (hasReviews) values.push(userId);

  // --- review-scoped filters (only when an owner's reviews are joined) ---
  if (hasReviews) {
    if (f.verdict === "approve") where.push("r.verdict = 'approve'");
    else if (f.verdict === "deny") where.push("r.verdict = 'deny'");
    else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
    else if (f.verdict === "pending") where.push("r.job_id IS NULL");
    // "all" adds no verdict clause
    where.push("r.error IS NULL");
  }

  // --- plain job filters (apply with or without an owner) ---
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
  if (f.location) {
    where.push(`j.location ILIKE ${ph()}`);
    values.push(`%${f.location}%`);
  }
  // Board owner's location include-list (set on the profile). Mirrors the
  // reviewer pre-filter: keep remote jobs always, else require an exact match.
  // Empty list => no clause (everything shows). Applies with or without an owner.
  if (ownerLocations.length) {
    where.push(`(j.remote IS TRUE OR j.location = ANY(${ph()}))`);
    values.push(ownerLocations);
  }

  // --- review dimension filters (only on verdicts that carry review columns) ---
  if (hasReviews && (f.verdict === "approve" || f.verdict === "deny" || f.verdict === "all")) {
    const dimensions: [string, string][] = [
      [f.experience, "r.experience_match"],
      [f.industry, "r.industry"],
      [f.subcategory, "r.industry_subcategory"],
    ];
    for (const [value, col] of dimensions) {
      if (value) {
        where.push(`${col} = ${ph()}`);
        values.push(value);
      }
    }
  }

  // List payload is deliberately lean: only the columns the JobCard list and the
  // client filter/sort (lib/rolefit/filter.ts) actually read. The heavy, detail-only
  // review fields (reasoning, requirements, about, benefits, red_flags) are NOT
  // selected here — they serialized ~171KB into every board response while only ever
  // being shown one-at-a-time in JobDetail. They're fetched on job-open via
  // GET /api/jobs/[id] instead. Eight more columns that no render path reads
  // (url, ats, experience_match, industry, industry_subcategory, confidence,
  // stage1_decision, stage1_reason) are dropped entirely. Note experience_match /
  // industry / industry_subcategory are still referenced in the WHERE clause above
  // for the (currently UI-dormant) dimension filters — it's selecting them that was
  // unnecessary, not filtering on them.
  const selectCols = [
    "j.id", "j.title", "j.location", "j.remote",
    "j.first_seen_at", "j.closed_at", "c.name AS company_name",
  ];
  if (hasReviews) {
    selectCols.push(
      "r.verdict", "r.human_override",
      "r.role_category", "r.seniority", "r.work_arrangement",
      "r.pay_min", "r.pay_max", "r.pay_currency", "r.pay_period", "r.headcount",
      "r.skills_score", "r.experience_score", "r.comp_score", "r.fit_score",
      "r.skill_gaps",
    );
  }
  const reviewJoin = hasReviews
    ? `LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${ownerPh}::uuid`
    : "";

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    `SELECT ${selectCols.join(", ")}`,
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    reviewJoin,
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
