import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { buildJobsQuery } from "@/lib/jobsQuery";
import { serverBoardFilters } from "@/lib/filters";
import type { Filters } from "@/lib/filters";

// Real-Postgres proof for the authed board's include contract (bug 2026-07-19):
// with include: [] a non-engineer-titled approved job is returned; the OLD
// include: ["engineer"] prefilter would have dropped it. Gated on
// TEST_DATABASE_URL (unset -> skips). Session-local TEMP tables shadow public.*;
// max: 1 pins the connection they live on. The temp schema mirrors the columns
// buildJobsQuery's SELECT names (keep in lockstep with lib/jobsQuery.ts).

const TEST_DSN = process.env.TEST_DATABASE_URL;
const U1 = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!TEST_DSN)("authed board include contract — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    await sql`CREATE TEMP TABLE companies (
      id INT PRIMARY KEY, name TEXT, display_name TEXT, ats TEXT,
      industry TEXT, size TEXT, hq_country TEXT
    )`;
    await sql`CREATE TEMP TABLE jobs (
      id TEXT PRIMARY KEY, title TEXT, location TEXT, location_canonicals TEXT[],
      remote BOOLEAN, first_seen_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, company_id INT
    )`;
    // Only the columns buildJobsQuery reads (SELECT COALESCE set + WHERE predicates).
    await sql`CREATE TEMP TABLE job_reviews (
      user_id UUID, job_id TEXT, verdict TEXT, error TEXT,
      human_override BOOLEAN NOT NULL DEFAULT FALSE, stage1_decision TEXT,
      role_category TEXT, seniority TEXT, work_arrangement TEXT,
      pay_min INT, pay_max INT, pay_currency TEXT, pay_period TEXT, headcount TEXT,
      skills_score INT, experience_score INT, comp_score INT, fit_score INT,
      skill_gaps TEXT[],
      PRIMARY KEY (user_id, job_id)
    )`;
    await sql`CREATE TEMP TABLE review_corrections (
      user_id UUID, job_id TEXT, verdict TEXT,
      role_category TEXT, seniority TEXT, work_arrangement TEXT,
      pay_min INT, pay_max INT, pay_currency TEXT, pay_period TEXT, headcount TEXT,
      skills_score INT, experience_score INT, comp_score INT, fit_score INT,
      skill_gaps TEXT[],
      PRIMARY KEY (user_id, job_id)
    )`;

    await sql`INSERT INTO companies (id, name, display_name, ats) VALUES
      (1, 'acme', 'Acme', 'greenhouse')`;
    await sql`INSERT INTO jobs
      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
      ('j-eng', 'Senior Software Engineer', 'Remote', ARRAY['Remote'], true, now(), NULL, 1),
      ('j-pm',  'Program Manager',          'Remote', ARRAY['Remote'], true, now(), NULL, 1)`;
    // Both approved for U1, no error — the reviewer curated both onto her board.
    await sql`INSERT INTO job_reviews (user_id, job_id, verdict, error) VALUES
      (${U1}, 'j-eng', 'approve', NULL),
      (${U1}, 'j-pm',  'approve', NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("authed board (include: []) returns the non-engineer-titled approved job", async () => {
    const { text, values } = buildJobsQuery(serverBoardFilters("authed"), U1, []);
    const rows = await sql.begin((tx) => tx.unsafe(text, values as never[]));
    const titles = (rows as unknown as { title: string }[]).map((r) => r.title).sort();
    expect(titles).toEqual(["Program Manager", "Senior Software Engineer"]);
  });

  it("the OLD engineer prefilter dropped the non-engineer job (bug repro)", async () => {
    const engineerOnly: Filters = { ...serverBoardFilters("authed"), include: ["engineer"] };
    const { text, values } = buildJobsQuery(engineerOnly, U1, []);
    const rows = await sql.begin((tx) => tx.unsafe(text, values as never[]));
    const titles = (rows as unknown as { title: string }[]).map((r) => r.title);
    expect(titles).toEqual(["Senior Software Engineer"]);
  });
});
