import { describe, expect, test } from "vitest";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import { serverBoardFilters } from "@/lib/filters";

const UID = "user-123";
const base: Filters = {
  companies: [],
  include: [],
  exclude: [],
  remoteOnly: false,
  status: "open",
  verdict: "approve",
  experience: "",
  industry: "",
  subcategory: "",
  location: "",
};

describe("buildJobsQuery", () => {
  test("joins job_reviews scoped to the user via $1", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = $1::uuid",
    );
    expect(q.values[0]).toBe(UID);
    expect(q.text).toContain("r.verdict");
    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
  });

  test("default verdict=approve filters on r.verdict", () => {
    expect(buildJobsQuery(base, UID).text).toContain(
      "COALESCE(rc.verdict, r.verdict) = 'approve'",
    );
  });

  test("verdict=gate_rejected / pending / all", () => {
    expect(buildJobsQuery({ ...base, verdict: "gate_rejected" }, UID).text)
      .toContain("r.stage1_decision = 'reject'");
    expect(buildJobsQuery({ ...base, verdict: "pending" }, UID).text)
      .toContain("r.job_id IS NULL");
    const all = buildJobsQuery({ ...base, verdict: "all" }, UID);
    expect(all.text).not.toContain("r.verdict =");
    expect(all.text).not.toContain("r.stage1_decision =");
  });

  test("company filter placeholder shifts to $2 (userId is $1)", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, UID);
    expect(q.text).toContain("j.company_id = ANY($2)");
    expect(q.values).toEqual([UID, [1, 2]]);
  });

  test("experience/industry/subcategory become equality filters in lockstep", () => {
    const q = buildJobsQuery(
      { ...base, experience: "reach", industry: "software_internet", subcategory: "gaming" },
      UID,
    );
    expect(q.text).toContain("COALESCE(rc.experience_match, r.experience_match) = $2");
    expect(q.text).toContain("COALESCE(rc.industry, r.industry) = $3");
    expect(q.text).toContain("COALESCE(rc.industry_subcategory, r.industry_subcategory) = $4");
    expect(q.values).toEqual([UID, "reach", "software_internet", "gaming"]);
  });

  test("include/exclude keep placeholders aligned after userId + verdict", () => {
    const q = buildJobsQuery({ ...base, include: ["engineer"], exclude: ["manager"] }, UID);
    expect(q.text).toContain("j.title ILIKE $2");
    expect(q.text).toContain("j.title NOT ILIKE $3");
    expect(q.values).toEqual([UID, "%engineer%", "%manager%"]);
  });

  test("errored rows excluded by default (r.error IS NULL always present)", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.error IS NULL");
  });

  test("verdict=all still contains r.error IS NULL", () => {
    expect(buildJobsQuery({ ...base, verdict: "all" }, UID).text).toContain("r.error IS NULL");
  });

  test("humanOverrideOnly restricts deny to operator rejects (Rejected view)", () => {
    const q = buildJobsQuery({ ...base, verdict: "deny" }, UID, [], { humanOverrideOnly: true });
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) = 'deny'");
    expect(q.text).toContain("r.human_override IS TRUE");
  });

  test("no human_override WHERE clause without the opt", () => {
    // r.human_override is still SELECTed as a column, but must not appear as a filter.
    expect(buildJobsQuery({ ...base, verdict: "deny" }, UID).text)
      .not.toContain("r.human_override IS TRUE");
  });

  test("verdict=pending + experience skips dimension filter but retains pending clause", () => {
    const q = buildJobsQuery({ ...base, verdict: "pending", experience: "reach" }, UID);
    expect(q.text).not.toContain("r.experience_match =");
    expect(q.text).toContain("r.job_id IS NULL");
  });

  test("verdict=approve + experience applies dimension filter", () => {
    const q = buildJobsQuery({ ...base, verdict: "approve", experience: "reach" }, UID);
    expect(q.text).toContain("COALESCE(rc.experience_match, r.experience_match) = $2");
  });

  test("null owner: no review join, columns, error clause, or user binding", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("job_reviews");
    expect(q.text).not.toContain("r.verdict");
    expect(q.text).not.toContain("r.error IS NULL");
    expect(q.text).toContain("j.closed_at IS NULL"); // plain status filter still applies
    expect(q.values).toEqual([]);
  });

  test("null owner: plain filters bind from $1", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] }, null);
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.values).toEqual([[1, 2]]);
  });

  test("location filter adds an ILIKE clause in the owner branch", () => {
    const q = buildJobsQuery({ ...base, location: "remote" }, UID);
    expect(q.text).toContain("j.location ILIKE $2");
    expect(q.values).toEqual([UID, "%remote%"]);
  });

  test("location filter applies without an owner, binding from $1", () => {
    const q = buildJobsQuery({ ...base, location: "berlin" }, null);
    expect(q.text).toContain("j.location ILIKE $1");
    expect(q.values).toEqual(["%berlin%"]);
  });

  test("owner preferred locations add a canonical-overlap clause with remote opt-in", () => {
    const q = buildJobsQuery(base, UID, ["Austin, TX", "Remote"]);
    expect(q.text).toContain(
      "(COALESCE(j.location_canonicals, ARRAY[j.location]) && $2" +
      " OR ('Remote' = ANY($2) AND j.remote IS TRUE))",
    );
    expect(q.values[1]).toEqual(["Austin, TX", "Remote"]);
  });

  test("board rows select location_canonicals", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).toContain("j.location_canonicals");
  });

  test("empty owner preferred locations add no baseline clause", () => {
    const q = buildJobsQuery(base, UID, []);
    expect(q.text).not.toContain("&& $");
    expect(q.text).not.toContain("'Remote' = ANY");
  });

  test("owner preferred locations apply without an owner, binding from $1", () => {
    const q = buildJobsQuery(base, null, ["Berlin, Germany"]);
    expect(q.text).toContain(
      "(COALESCE(j.location_canonicals, ARRAY[j.location]) && $1" +
      " OR ('Remote' = ANY($1) AND j.remote IS TRUE))",
    );
    expect(q.values).toEqual([["Berlin, Germany"]]);
  });

  test("selects the lean rolefit list columns when an owner is present", () => {
    const t = buildJobsQuery(base, UID).text;
    for (const col of ["r.role_category", "r.fit_score", "r.pay_min",
      "r.skills_score", "r.work_arrangement", "r.skill_gaps", "r.seniority"]) {
      expect(t).toContain(col);
    }
  });

  test("does NOT select heavy detail-only or dead columns", () => {
    // Detail-only fields are fetched lazily via /api/jobs/[id]; the rest are read
    // by no render path. Keeping them out of the list query is the payload trim.
    const t = buildJobsQuery(base, UID).text;
    for (const col of ["r.reasoning", "r.requirements", "r.about", "r.benefits",
      "r.red_flags", "r.stage1_reason", "r.stage1_decision", "r.confidence",
      "r.experience_match", "r.industry", "r.industry_subcategory", "j.url"]) {
      expect(t).not.toContain(col);
    }
  });

  test("selects c.ats for the Source facet — with and without an owner", () => {
    expect(buildJobsQuery(base, UID).text).toContain("c.ats");
    expect(buildJobsQuery(base, null).text).toContain("c.ats");
  });

  test("rolefit columns absent without an owner", () => {
    const t = buildJobsQuery(base, null).text;
    expect(t).not.toContain("r.fit_score");
    expect(t).not.toContain("r.skill_gaps");
  });

  test("selects r.human_override when an owner is present", () => {
    expect(buildJobsQuery(base, UID).text).toContain("r.human_override");
  });

  test("human_override absent without an owner", () => {
    expect(buildJobsQuery(base, null).text).not.toContain("r.human_override");
  });

  test("coalesces corrections over the model review when an owner is present", () => {
    const q = buildJobsQuery(base, UID);
    expect(q.text).toContain(
      "LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = $1::uuid",
    );
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) AS verdict");
    expect(q.text).toContain("COALESCE(rc.fit_score, r.fit_score) AS fit_score");
    // the verdict filter uses the coalesced value so filtering matches display
    expect(q.text).toContain("COALESCE(rc.verdict, r.verdict) = 'approve'");
  });

  test("no corrections join without an owner", () => {
    const q = buildJobsQuery(base, null);
    expect(q.text).not.toContain("review_corrections");
  });

  test("company_name prefers the enriched display_name, falling back to the slug", () => {
    expect(buildJobsQuery(base, UID).text).toContain(
      "COALESCE(c.display_name, c.name) AS company_name",
    );
  });

  test("reviewedSince adds an overlapped reviewed_at predicate bound as a parameter", () => {
    const q = buildJobsQuery(base, UID, [], { reviewedSince: "2026-07-16T00:00:00.000Z" });
    expect(q.text).toContain(
      "r.reviewed_at > $2::timestamptz - interval '10 seconds'",
    );
    expect(q.values).toEqual([UID, "2026-07-16T00:00:00.000Z"]);
  });

  test("reviewedSince composes with viewer locations (placeholders stay aligned)", () => {
    const q = buildJobsQuery(base, UID, ["Phoenix, AZ"], {
      reviewedSince: "2026-07-16T00:00:00.000Z",
    });
    // reviewedSince is pushed in the review-scoped block ($2); locations follow ($3).
    // The canonical-overlap predicate calls ph() once and reuses $3 twice (one value push).
    expect(q.text).toContain("r.reviewed_at > $2::timestamptz - interval '10 seconds'");
    expect(q.text).toContain(
      "(COALESCE(j.location_canonicals, ARRAY[j.location]) && $3" +
      " OR ('Remote' = ANY($3) AND j.remote IS TRUE))",
    );
    expect(q.values).toEqual([UID, "2026-07-16T00:00:00.000Z", ["Phoenix, AZ"]]);
  });

  test("reviewedSince without a viewer is a programmer error", () => {
    expect(() =>
      buildJobsQuery(base, null, [], { reviewedSince: "2026-07-16T00:00:00.000Z" }),
    ).toThrow(/reviewedSince requires a viewer/);
  });

  test("no reviewedSince → no reviewed_at clause", () => {
    expect(buildJobsQuery(base, UID).text).not.toContain("reviewed_at");
  });

  test("empty include emits no title ILIKE clause (authed board contract)", () => {
    const q = buildJobsQuery({ ...base, include: [] }, UID);
    expect(q.text).not.toContain("j.title ILIKE");
  });

  test("anon board (serverBoardFilters('anon')) keeps the engineer title ILIKE", () => {
    const q = buildJobsQuery(serverBoardFilters("anon"), null);
    expect(q.text).toContain("j.title ILIKE $1");
    expect(q.values).toEqual(["%engineer%"]);
  });

  test("authed board and review feed agree: neither emits a title ILIKE (parity)", () => {
    // Authed board (serverBoardFilters("authed") -> include: []).
    const authed = buildJobsQuery(serverBoardFilters("authed"), UID, ["Remote"]);
    expect(authed.text).not.toContain("j.title ILIKE");
    // getReviewFeed (lib/queries.ts) builds its Filters with include: [] and a
    // reviewedSince cursor — same title predicate (none). getRejectedJobs also uses
    // include: []. All three now agree, so streamed matches survive router.refresh().
    const feedLike = buildJobsQuery(
      { ...base, include: [] },
      UID,
      ["Remote"],
      { reviewedSince: "2026-07-16T00:00:00.000Z" },
    );
    expect(feedLike.text).not.toContain("j.title ILIKE");
  });
});
