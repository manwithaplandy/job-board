import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(
  f: Filters,
  userId: string | null,
  viewerLocations: string[] = [],
  opts: { humanOverrideOnly?: boolean; reviewedSince?: string; locationFromProfile?: boolean } = {},
): SqlQuery {
  const values: unknown[] = [];
  const ph = () => `$${values.length + 1}`;
  const where: string[] = [];
  const hasReviews = userId !== null;

  // reviewedSince filters the viewer's review join — meaningless without a viewer.
  if (opts.reviewedSince && !hasReviews) {
    throw new Error("buildJobsQuery: reviewedSince requires a viewer (userId)");
  }

  // The review join binds the VIEWER's own user_id. Capture its placeholder before
  // seeding the value (so it resolves to $1, with values still empty), so the
  // join string isn't coupled to a hardcoded "$1" if the seeding order changes.
  const viewerPh = hasReviews ? ph() : null;
  if (hasReviews) values.push(userId);

  // --- review-scoped filters (only when the viewer's reviews are joined) ---
  if (hasReviews) {
    const v = "COALESCE(rc.verdict, r.verdict)";
    if (f.verdict === "approve") where.push(`${v} = 'approve'`);
    else if (f.verdict === "deny") where.push(`${v} = 'deny'`);
    else if (f.verdict === "gate_rejected") where.push("r.stage1_decision = 'reject'");
    else if (f.verdict === "pending") where.push("r.job_id IS NULL");
    // "all" adds no verdict clause
    where.push("r.error IS NULL");
    // Rejected-view recovery (getRejectedJobs): restrict to the operator's deliberate
    // rejects so AI denies — the bulk of deny rows — don't flood the view.
    if (opts.humanOverrideOnly) where.push("r.human_override IS TRUE");
    // Live-population delta (getReviewFeed): only reviews newer than the client's
    // cursor. The 10s overlap re-sends rows near the boundary — the client dedupes by
    // id, so delivery is at-least-once rather than gapped (in-flight upserts whose
    // reviewed_at predates the cursor snapshot would otherwise be lost).
    if (opts.reviewedSince) {
      where.push(`r.reviewed_at > ${ph()}::timestamptz - interval '10 seconds'`);
      values.push(opts.reviewedSince);
    }
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
  // The viewer's location include-list (profile.preferred_locations, canonical values).
  // Both shapes mirror the reviewer pre-filter (reviewer/db.py select_candidates) EXACTLY:
  // canonical-array overlap with a raw-string COALESCE fallback for not-yet-stamped jobs,
  // and remote jobs only when the viewer selected "Remote" (opt-in — remote no longer
  // bypasses the filter).
  //   • locationFromProfile (server-rendered board + rejected view): self-serve the
  //     viewer's preferred_locations via a correlated subquery on their OWN profiles row
  //     (RLS-scoped, same authenticated-role tx; precedent reviewStatsWith), so the board
  //     renders without a serial getProfile round-trip gating the jobs query. The subquery
  //     reuses the viewer placeholder ($1) — no extra bind. The `&&`/ANY subqueries MUST
  //     stay COALESCE-wrapped to '{}'::text[]: a bare `= ANY((SELECT array_col))` is
  //     subquery-form ANY and 42883s (text = text[]); the COALESCE makes it an array
  //     expression. DIVERGENCE FROM reviewStats: an EMPTY/cleared preferred_locations must
  //     yield the FULL board (no filter), NOT an empty pool — so a cardinality-0 escape
  //     gates the clause, mirroring the param path's `if (viewerLocations.length)`. Dropping
  //     that gate silently zeroes a cleared-prefs user's board.
  //   • the param list (getReviewFeed, which already fetched preferred_locations in its tx).
  // Empty list / cleared prefs => full board. Owner-only: anon has no profiles row.
  if (opts.locationFromProfile && viewerPh) {
    const sub = `(SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${viewerPh}::uuid)`;
    where.push(
      `((SELECT COALESCE(cardinality(p.preferred_locations), 0)` +
      ` FROM profiles p WHERE p.user_id = ${viewerPh}::uuid) = 0` +
      ` OR COALESCE(j.location_canonicals, ARRAY[j.location]) && COALESCE(${sub}, '{}'::text[])` +
      ` OR ('Remote' = ANY(COALESCE(${sub}, '{}'::text[])) AND j.remote IS TRUE))`,
    );
  } else if (viewerLocations.length) {
    const p = ph();
    where.push(
      `(COALESCE(j.location_canonicals, ARRAY[j.location]) && ${p}` +
      ` OR ('Remote' = ANY(${p}) AND j.remote IS TRUE))`,
    );
    values.push(viewerLocations);
  }

  // --- review dimension filters (only on verdicts that carry review columns) ---
  if (hasReviews && (f.verdict === "approve" || f.verdict === "deny" || f.verdict === "all")) {
    const dimensions: [string, string][] = [
      [f.experience, "COALESCE(rc.experience_match, r.experience_match)"],
      [f.industry, "COALESCE(rc.industry, r.industry)"],
      [f.subcategory, "COALESCE(rc.industry_subcategory, r.industry_subcategory)"],
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
  // GET /api/jobs/[id] instead. c.ats IS selected (below) — the board's Source facet
  // filter (lib/rolefit/filter.ts) reads it. Seven more columns that no render path
  // reads (url, experience_match, industry, industry_subcategory, confidence,
  // stage1_decision, stage1_reason) are dropped entirely. Note experience_match /
  // industry / industry_subcategory are still referenced in the WHERE clause above
  // for the (currently UI-dormant) dimension filters — it's selecting them that was
  // unnecessary, not filtering on them.
  const selectCols = [
    "j.id", "j.title", "j.location", "j.location_canonicals", "j.remote",
    "j.first_seen_at", "j.closed_at", "COALESCE(c.display_name, c.name) AS company_name",
    "c.ats",
  ];
  if (hasReviews) {
    selectCols.push(
      "COALESCE(rc.verdict, r.verdict) AS verdict",
      "r.human_override",
      "COALESCE(rc.role_category, r.role_category) AS role_category",
      "COALESCE(rc.seniority, r.seniority) AS seniority",
      "COALESCE(rc.work_arrangement, r.work_arrangement) AS work_arrangement",
      "COALESCE(rc.pay_min, r.pay_min) AS pay_min",
      "COALESCE(rc.pay_max, r.pay_max) AS pay_max",
      "COALESCE(rc.pay_currency, r.pay_currency) AS pay_currency",
      "COALESCE(rc.pay_period, r.pay_period) AS pay_period",
      "COALESCE(rc.headcount, r.headcount) AS headcount",
      "COALESCE(rc.skills_score, r.skills_score) AS skills_score",
      "COALESCE(rc.experience_score, r.experience_score) AS experience_score",
      "COALESCE(rc.comp_score, r.comp_score) AS comp_score",
      "COALESCE(rc.fit_score, r.fit_score) AS fit_score",
      "COALESCE(rc.skill_gaps, r.skill_gaps) AS skill_gaps",
      "(rc.job_id IS NOT NULL) AS corrected",
    );
  }
  const reviewJoin = hasReviews
    ? `LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${viewerPh}::uuid`
    : "";
  const correctionsJoin = hasReviews
    ? `LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = ${viewerPh}::uuid`
    : "";

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    `SELECT ${selectCols.join(", ")}`,
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    reviewJoin,
    correctionsJoin,
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
