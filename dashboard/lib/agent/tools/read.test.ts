import { beforeEach, describe, expect, test, vi } from "vitest";

// The database is stubbed: each query's text and bound values are recorded, and the
// rows it returns come from `db.respond`, chosen by the query text.
const db = vi.hoisted(() => ({
  calls: [] as { userId: string; text: string; values: unknown[] }[],
  respond: (_text: string): unknown[] => [],
}));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (userId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      db.calls.push({ userId, text, values });
      return Promise.resolve(db.respond(text));
    };
    const unsafe = (text: string, values: unknown[] = []) => {
      db.calls.push({ userId, text, values });
      return Promise.resolve(db.respond(text));
    };
    return fn(Object.assign(tx, { unsafe }));
  }),
}));
const queries = vi.hoisted(() => ({ getProfile: vi.fn(), getJobReviewDetail: vi.fn() }));
vi.mock("@/lib/queries", () => queries);
vi.mock("@/lib/catalogClock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogClock")>()),
  catalogNow: vi.fn(async () => ({ now: new Date("2026-11-20T00:00:00Z"), frozen: true })),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { emptyGathered } from "@/lib/agent/gathered";
import { assertNoUserIdInput } from "@/lib/agent/tools/assertNoUserIdInput";
import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import {
  TEXT_CAPS,
  getJob,
  getProfileSummary,
  getReview,
  searchJobs,
  searchJobsInput,
  yearsOfExperience,
} from "@/lib/agent/tools/read";
import { boardClosedPredicateSql, boardOpenPredicateSql, companyGateSql } from "@/lib/jobsQuery";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB = "lever:acme:123";

function ctx(): ToolCtx {
  return {
    userId: USER,
    email: "me@example.test",
    threadId: null,
    runId: "11111111-1111-4111-8111-111111111111",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 },
  };
}

const jobRow = (extra: Record<string, unknown> = {}) => ({
  id: JOB,
  title: "Engineer",
  company: "Acme",
  location: "Remote, US",
  remote: true,
  url: "https://example.test/j/123",
  first_seen_at: new Date("2026-11-18T00:00:00Z"),
  reviewed: true,
  closed: false,
  excluded: false,
  ...extra,
});

const detail = (description: string | null) => ({
  description,
  reasoning: null,
  about: null,
  red_flags: null,
  benefits: null,
  requirements: null,
  url: null,
  experience_match: null,
  industry: null,
  industry_subcategory: null,
  confidence: null,
  note: null,
  corrected: false,
});

beforeEach(() => {
  db.calls = [];
  db.respond = () => [];
  vi.clearAllMocks();
});

describe("tool surface", () => {
  test("no read tool input schema has a user id field", async () => {
    await assertNoUserIdInput(buildTools(ctx()));
  });

  test("assertNoUserIdInput catches a userId field", async () => {
    const { z } = await import("zod");
    const { tool } = await import("ai");
    const bad = {
      leak: tool({ description: "x", inputSchema: z.object({ filter: z.object({ user_id: z.string() }) }), execute: async () => 1 }),
    };
    await expect(assertNoUserIdInput(bad)).rejects.toThrow(/user_id/);
  });

  test("buildTools exposes exactly the four phase-0 read tools", () => {
    expect(Object.keys(buildTools(ctx())).sort()).toEqual(["get_job", "get_profile_summary", "get_review", "search_jobs"]);
  });
});

describe("get_job", () => {
  test("get_job rejects a malformed id without touching the database", async () => {
    expect(await getJob(ctx(), { jobId: "not a job id" })).toEqual({ status: "not_available", reason: "unknown_job" });
    expect(db.calls).toHaveLength(0);
    expect(queries.getJobReviewDetail).not.toHaveBeenCalled();
  });

  test("an unknown job is unknown_job", async () => {
    expect(await getJob(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "unknown_job" });
  });

  test("get_job on a job with no review for this user is not_reviewed", async () => {
    db.respond = () => [jobRow({ reviewed: false })];
    expect(await getJob(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "not_reviewed" });
    expect(queries.getJobReviewDetail).not.toHaveBeenCalled();
    expect(db.calls[0]?.userId).toBe(USER);
  });

  test("a closed job is closed and an excluded company is excluded", async () => {
    db.respond = () => [jobRow({ closed: true })];
    expect(await getJob(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "closed" });
    db.respond = () => [jobRow({ excluded: true })];
    expect(await getJob(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "excluded" });
    expect(queries.getJobReviewDetail).not.toHaveBeenCalled();
  });

  test("get_job decides closed, excluded and reviewed with the board's own predicates", async () => {
    await getJob(ctx(), { jobId: JOB });
    const call = db.calls[0];
    expect(call?.text).toContain(boardClosedPredicateSql());
    expect(call?.text).toContain(companyGateSql("$1").where);
    expect(call?.text).toContain(companyGateSql("$1").join);
    expect(call?.text).toContain("r.error IS NULL");
    expect(call?.values).toEqual([USER, JOB]);
  });

  test("posting strings are capped", async () => {
    db.respond = () => [jobRow({ title: "T".repeat(500), company: "C".repeat(500), location: "L".repeat(500) })];
    queries.getJobReviewDetail.mockResolvedValue(detail(null));
    const out = await getJob(ctx(), { jobId: JOB });
    if ("status" in out) throw new Error("expected job facts");
    expect(out.title).toHaveLength(TEXT_CAPS.title);
    expect(out.company).toHaveLength(TEXT_CAPS.company);
    expect(out.location).toHaveLength(TEXT_CAPS.location);
  });

  test("get_job wraps the description as untrusted and cuts it to 12000 chars", async () => {
    db.respond = () => [jobRow()];
    queries.getJobReviewDetail.mockResolvedValue(detail(`${"x".repeat(12_000)}TAIL-BEYOND-THE-CUT`));
    const out = await getJob(ctx(), { jobId: JOB });
    if ("status" in out) throw new Error("expected job facts");
    expect(out.description?.startsWith("<job_description>")).toBe(true);
    expect(out.description?.endsWith("</job_description>")).toBe(true);
    expect(out.description).toContain("x".repeat(12_000));
    expect(out.description).not.toContain("TAIL-BEYOND-THE-CUT");
    expect(out.descriptionOmitted).toBe(true);
    expect(out).toMatchObject({ jobId: JOB, title: "Engineer", company: "Acme", remote: true, ageDays: 2, closed: false });
    expect(queries.getJobReviewDetail).toHaveBeenCalledWith(JOB, USER);
  });

  test("a short description is not marked omitted", async () => {
    db.respond = () => [jobRow()];
    queries.getJobReviewDetail.mockResolvedValue(detail("Build things."));
    const out = await getJob(ctx(), { jobId: JOB });
    expect(out).toMatchObject({ descriptionOmitted: false });
  });

  test("get_job with a pruned description returns description null and no throw", async () => {
    db.respond = () => [jobRow()];
    queries.getJobReviewDetail.mockResolvedValue(detail(null));
    expect(await getJob(ctx(), { jobId: JOB })).toMatchObject({ jobId: JOB, description: null, descriptionOmitted: false });
    queries.getJobReviewDetail.mockResolvedValue(null);
    expect(await getJob(ctx(), { jobId: JOB })).toMatchObject({ jobId: JOB, description: null });
  });
});

describe("get_profile_summary", () => {
  test("get_profile_summary output has no eeo, email, phone or links key", async () => {
    queries.getProfile.mockResolvedValue({
      user_id: USER,
      resume_text: "Jane Doe\njane@example.test | 555-0100\nEXPERIENCE\nJan 2019 - Present\nSenior Engineer\nAcme\n- Built\nEDUCATION\nBS Computer Science",
      full_name: "Jane Doe",
      email: "jane@example.test",
      phone: "555-0100",
      links: { linkedin: "https://linkedin.example/jane" },
      location: "Austin",
      preferred_locations: ["Austin, TX", "Remote"],
      work_authorized: true,
      needs_sponsorship: false,
      eeo_gender: "x",
      eeo_race: "x",
      eeo_veteran: "x",
      eeo_disability: "x",
      screening_answers: { salary_expectation: "lots" },
    });
    const out = await getProfileSummary(ctx());
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object" && v !== null) {
        for (const [k, inner] of Object.entries(v)) {
          keys.push(k);
          walk(inner);
        }
      }
    };
    walk(out);
    for (const k of keys) expect(k).not.toMatch(/eeo|email|phone|link|screening/i);
    expect(JSON.stringify(out)).not.toMatch(/jane@example|555-0100|linkedin/);
    expect(out).toMatchObject({
      name: "Jane Doe",
      preferredLocations: ["Austin, TX", "Remote"],
      workAuthorized: true,
      needsSponsorship: false,
    });
  });

  test("years of experience is the union of role ranges: gaps do not count, overlaps count once", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    // 2015-2018 is 3 years and Nov 2022 - Present (Nov 2026) is 4: 7, not the 11-year span.
    expect(yearsOfExperience(["2015 - 2018", "Nov 2022 - Present"], now)).toBe(7);
    // Overlapping roles count once: Jan 2019-Jan 2022 and Jan 2020-Jan 2021 is 3 years.
    expect(yearsOfExperience(["Jan 2019 - Jan 2022", "Jan 2020 - Jan 2021"], now)).toBe(3);
    // Months are honoured: Mar 2020 - Sep 2020 is half a year.
    expect(yearsOfExperience(["Mar 2020 - Sep 2020"], now)).toBe(0.5);
    // Order of roles does not matter.
    expect(yearsOfExperience(["Nov 2022 - Present", "2015 - 2018"], now)).toBe(7);
    expect(yearsOfExperience(["no dates here"], now)).toBeNull();
    expect(yearsOfExperience([], now)).toBeNull();
    // A range that runs backwards is ignored.
    expect(yearsOfExperience(["2020 - 2010"], now)).toBeNull();
  });

  test("no profile gives an empty summary", async () => {
    queries.getProfile.mockResolvedValue(null);
    expect(await getProfileSummary(ctx())).toEqual({
      name: null,
      titles: [],
      yearsOfExperience: null,
      education: [],
      preferredLocations: [],
      workAuthorized: null,
      needsSponsorship: null,
    });
  });
});

describe("search_jobs", () => {
  const searchRow = (extra: Record<string, unknown> = {}) => ({
    ...jobRow(),
    verdict: "approve",
    fit_score: 91,
    pay_min: 150_000,
    pay_max: 190_000,
    pay_currency: "USD",
    pay_period: "year",
    total: "1", // count(*) is bigint
    ...extra,
  });

  test("search_jobs uses the board's open test and company gate, and skips errored reviews", async () => {
    await searchJobs(ctx(), { sort: "fit", limit: 10 });
    const text = db.calls[0]?.text ?? "";
    expect(text).toContain(boardOpenPredicateSql());
    expect(text).toContain(companyGateSql("$1").where);
    expect(text).toContain(companyGateSql("$1").join);
    expect(text).toContain("r.error IS NULL");
    expect(text).not.toContain("j.closed_at IS NULL");
  });

  test("sort pay annualizes hours and months and puts USD first", async () => {
    await searchJobs(ctx(), { sort: "pay", limit: 10 });
    const text = db.calls[0]?.text ?? "";
    expect(text).toMatch(/WHEN 'hour' THEN 2080 WHEN 'month' THEN 12 ELSE 1/);
    expect(text).toMatch(/= 'USD' THEN 0/);
  });

  test("search rows carry payPeriod and currency", async () => {
    db.respond = () => [searchRow({ pay_period: "hour", pay_max: 90 })];
    const out = await searchJobs(ctx(), { sort: "pay", limit: 10 });
    expect(out.rows[0]).toMatchObject({ payMax: 90, payCurrency: "USD", payPeriod: "hour" });
  });

  test("search_jobs caps limit at 25 and defaults sort to fit", async () => {
    expect(searchJobsInput.parse({})).toEqual({ sort: "fit", limit: 10 });
    expect(searchJobsInput.safeParse({ limit: 26 }).success).toBe(false);
    expect(searchJobsInput.safeParse({ text: "x".repeat(81) }).success).toBe(false);
    await searchJobs(ctx(), { sort: "fit", limit: 100 });
    expect(db.calls[0]?.values).toContain(25);
    expect(db.calls[0]?.values).not.toContain(100);
  });

  test("search_jobs returns the corrected fit and pay when a review_corrections row exists", async () => {
    // The corrected values are what the query's COALESCE(rc.x, r.x) columns return.
    db.respond = () => [searchRow({ fit_score: 40, pay_min: 90_000, pay_max: 100_000, verdict: "deny" })];
    const out = await searchJobs(ctx(), { sort: "fit", limit: 10 });
    for (const col of ["verdict", "fit_score", "pay_min", "pay_max", "pay_currency"]) {
      expect(db.calls[0]?.text).toContain(`COALESCE(rc.${col}, r.${col})`);
    }
    expect(db.calls[0]?.text).toMatch(/LEFT JOIN review_corrections rc/);
    expect(out).toEqual({
      rows: [
        expect.objectContaining({ jobId: JOB, verdict: "deny", fitScore: 40, payMin: 90_000, payMax: 100_000, payCurrency: "USD" }),
      ],
      total: 1,
    });
  });

  test("filters are bound as values, never spliced into the SQL", async () => {
    await searchJobs(ctx(), { verdict: "approve", minFit: 70, remoteOnly: true, text: "50%_off' OR 1=1", sort: "pay", limit: 5 });
    const call = db.calls[0];
    expect(call?.text).not.toContain("OR 1=1");
    expect(call?.text).not.toContain("_off");
    expect(call?.values).toEqual(expect.arrayContaining([USER, "approve", 70, 5]));
    expect(call?.values).toContain("50\\%\\_off' OR 1=1"); // LIKE wildcards escaped
  });

  test("a row that fails the parse is dropped, not thrown", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.respond = () => [searchRow(), searchRow({ id: 42, fit_score: "high" })];
    const out = await searchJobs(ctx(), { sort: "fit", limit: 10 });
    expect(out.rows).toHaveLength(1);
  });
});

describe("get_review", () => {
  const reviewRow = (extra: Record<string, unknown> = {}) => ({
    reviewed: true,
    closed: false,
    excluded: false,
    verdict: "approve",
    fit_score: 88,
    skills_score: 90,
    experience_score: 80,
    comp_score: 70,
    pay_min: 100,
    pay_max: 200,
    pay_currency: "USD",
    pay_period: "year",
    work_arrangement: "remote",
    seniority: "senior",
    red_flags: ["on-call"],
    skill_gaps: '["Rust"]', // a double-encoded jsonb string is unwrapped
    requirements: [{ text: "5 years", met: true }, { text: 7 }],
    reasoning: "Strong match",
    stale: false,
    ...extra,
  });

  test("returns the review with every list total-parsed", async () => {
    db.respond = () => [reviewRow()];
    expect(await getReview(ctx(), { jobId: JOB })).toEqual({
      jobId: JOB,
      verdict: "approve",
      fitScore: 88,
      skillsScore: 90,
      experienceScore: 80,
      compScore: 70,
      payMin: 100,
      payMax: 200,
      payCurrency: "USD",
      payPeriod: "year",
      workArrangement: "remote",
      seniority: "senior",
      redFlags: ["on-call"],
      skillGaps: ["Rust"],
      requirements: [{ text: "5 years", met: true }],
      reasoning: "Strong match",
      stale: false,
    });
  });

  test("unknown job, malformed id and no review are not_available", async () => {
    expect(await getReview(ctx(), { jobId: "bad" })).toEqual({ status: "not_available", reason: "unknown_job" });
    expect(db.calls).toHaveLength(0);
    expect(await getReview(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "unknown_job" });
    db.respond = () => [reviewRow({ reviewed: false })];
    expect(await getReview(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "not_reviewed" });
  });

  test("a closed job's review is closed, as get_job says; an errored review is not a review", async () => {
    db.respond = () => [reviewRow({ closed: true })];
    expect(await getReview(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "closed" });
    db.respond = () => [reviewRow({ excluded: true })];
    expect(await getReview(ctx(), { jobId: JOB })).toEqual({ status: "not_available", reason: "excluded" });
    expect(db.calls.at(-1)?.text).toContain("(r.job_id IS NOT NULL AND r.error IS NULL) AS reviewed");
  });

  test("a list column that fails the parse is logged and read as empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.respond = () => [reviewRow({ red_flags: "{not json", skill_gaps: null, requirements: 7 })];
    const out = await getReview(ctx(), { jobId: JOB });
    expect(out).toMatchObject({ redFlags: [], skillGaps: [], requirements: [] });
    // A NULL column is simply absent; the two corrupt columns are each logged.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/red_flags/);
  });

  test("reasoning and list items are capped", async () => {
    db.respond = () => [
      reviewRow({
        reasoning: "r".repeat(5_000),
        red_flags: ["f".repeat(1_000)],
        skill_gaps: ["g".repeat(1_000)],
        requirements: [{ text: "q".repeat(1_000), met: false }],
      }),
    ];
    const out = await getReview(ctx(), { jobId: JOB });
    if ("status" in out) throw new Error("expected review facts");
    expect(out.reasoning).toHaveLength(TEXT_CAPS.reasoning);
    expect(out.redFlags[0]).toHaveLength(TEXT_CAPS.listItem);
    expect(out.skillGaps[0]).toHaveLength(TEXT_CAPS.listItem);
    expect(out.requirements[0]?.text).toHaveLength(TEXT_CAPS.listItem);
  });
});

describe("gathered", () => {
  test("a read tool records what it returned in ctx.gathered", async () => {
    const c = ctx();
    db.respond = (text) => (text.includes("FROM job_reviews r") ? [] : [jobRow()]);
    queries.getJobReviewDetail.mockResolvedValue(detail("secret posting text"));
    const job = await getJob(c, { jobId: JOB });
    expect(c.gathered.jobs[JOB]).toMatchObject({ jobId: JOB, title: "Engineer", ageDays: 2 });
    // Gathered data never holds the description.
    expect(JSON.stringify(c.gathered)).not.toContain("secret posting text");
    expect(job).toMatchObject({ jobId: JOB });

    queries.getProfile.mockResolvedValue(null);
    const profile = await getProfileSummary(c);
    expect(c.gathered.profile).toEqual(profile);
  });
});
