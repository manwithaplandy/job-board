import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { buildJobsQuery } from "@/lib/jobsQuery";
import { serverBoardFilters } from "@/lib/filters";

// Real-Postgres proof for the board's `locationFromProfile` clause (the getProfile→getJobs
// de-serialization, spec 2026-07-21): the jobs query self-serves preferred_locations via a
// correlated subquery on the viewer's OWN profiles row instead of a bound array param. Two
// things MUST hold and are proven here against a live planner, not just SQL-text shape:
//   1. NO 42883 — the `&&`/ANY subqueries stay COALESCE-wrapped to '{}'::text[] (bare
//      `= ANY((SELECT array_col))` is subquery-form ANY and rejects: text = text[]).
//   2. The empty-prefs escape — a cleared preferred_locations ('{}') yields the FULL board,
//      NOT an empty pool. A naive rewrite drops that gate and silently zeroes the board.
//
// Gated on TEST_DATABASE_URL (unset -> skips). Session-local TEMP tables shadow public.*;
// max: 1 pins the connection they live on. Temp schema mirrors the columns buildJobsQuery's
// SELECT names (keep in lockstep with lib/jobsQuery.ts, as queries.boardInclude.db.test.ts does).

const TEST_DSN = process.env.TEST_DATABASE_URL;

const U_EMPTY = "11111111-1111-1111-1111-111111111111"; // prefs '{}' -> full board
const U_PHX = "22222222-2222-2222-2222-222222222222";   // {Phoenix, AZ} -> remote opted out
const U_REMOTE = "33333333-3333-3333-3333-333333333333"; // {Phoenix, AZ, Remote}

describe.skipIf(!TEST_DSN)("board locationFromProfile clause — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  const boardTitles = async (userId: string) => {
    const { text, values } = buildJobsQuery(serverBoardFilters("authed"), userId, [], {
      locationFromProfile: true,
    });
    const rows = await sql.begin((tx) => tx.unsafe(text, values as never[]));
    return (rows as unknown as { title: string }[]).map((r) => r.title).sort();
  };

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
    await sql`CREATE TEMP TABLE profiles (
      user_id UUID PRIMARY KEY, preferred_locations TEXT[] NOT NULL DEFAULT '{}'
    )`;

    await sql`INSERT INTO companies (id, name, display_name, ats) VALUES
      (1, 'acme', 'Acme', 'greenhouse')`;
    await sql`INSERT INTO jobs
      (id, title, location, location_canonicals, remote, first_seen_at, closed_at, company_id) VALUES
      ('j-phx',    'Phoenix Role',   'Phoenix, AZ',   ARRAY['Phoenix, AZ'],   false, now(), NULL, 1),
      ('j-sd',     'San Diego Role', 'San Diego, CA', ARRAY['San Diego, CA'], false, now(), NULL, 1),
      ('j-remote', 'Remote Role',    'Remote',        ARRAY['Remote'],        true,  now(), NULL, 1)`;

    await sql`INSERT INTO profiles (user_id, preferred_locations) VALUES
      (${U_EMPTY},  '{}'::text[]),
      (${U_PHX},    ARRAY['Phoenix, AZ']::text[]),
      (${U_REMOTE}, ARRAY['Phoenix, AZ','Remote']::text[])`;

    // Each viewer approved all three jobs — location is the ONLY thing scoping their board.
    for (const u of [U_EMPTY, U_PHX, U_REMOTE]) {
      await sql`INSERT INTO job_reviews (user_id, job_id, verdict, error) VALUES
        (${u}, 'j-phx', 'approve', NULL),
        (${u}, 'j-sd', 'approve', NULL),
        (${u}, 'j-remote', 'approve', NULL)`;
    }
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("cleared prefs ('{}') -> FULL board (empty-prefs data-loss guard)", async () => {
    expect(await boardTitles(U_EMPTY)).toEqual(["Phoenix Role", "Remote Role", "San Diego Role"]);
  });

  it("{Phoenix, AZ}, remote opted out -> only the Phoenix job", async () => {
    expect(await boardTitles(U_PHX)).toEqual(["Phoenix Role"]);
  });

  it("{Phoenix, AZ, Remote} -> Phoenix + remote, San Diego excluded", async () => {
    expect(await boardTitles(U_REMOTE)).toEqual(["Phoenix Role", "Remote Role"]);
  });
});
