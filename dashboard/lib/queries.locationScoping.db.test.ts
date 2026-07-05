import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { reviewStatsWith } from "@/lib/queries";
import { reviewAggWith } from "@/lib/metrics";

// Real-Postgres regression guard for the authed-500 incident (b0a2689).
//
// The location-scoping predicate in reviewStatsWith (lib/queries.ts) and reviewAggWith
// (lib/metrics.ts) MUST use the ARRAY form of ANY:
//     j.location = ANY(COALESCE((SELECT preferred_locations ...), '{}'::text[]))
// NOT the SUBQUERY form  j.location = ANY((SELECT ...))  which makes Postgres compare a
// text against each ROW (a whole text[]) -> error 42883 "operator does not exist:
// text = text[]", thrown at PLAN time (independent of the data) -- it 500'd 100% of
// authenticated / and /analytics renders. The rest of the dashboard suite MOCKS the DB
// and tsc cannot type-check SQL strings, so only a real engine catches this class of
// bug -- hence this integration test drives the ACTUAL exported query functions.
//
// Gated on TEST_DATABASE_URL (mirrors the Python requires_db skip): unset -> the whole
// suite skips cleanly so `npx vitest run` stays green with no DB. To run it:
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/poller_test npx vitest run
// It builds its own session-local TEMP tables (they shadow public.* for name resolution,
// are invisible to other sessions, and drop on disconnect) so it never reads or writes
// real rows; max: 1 pins the single connection those temp tables live on.

const TEST_DSN = process.env.TEST_DATABASE_URL;

const U1 = "11111111-1111-1111-1111-111111111111"; // profile: preferred_locations = {Phoenix, AZ}
const U2 = "22222222-2222-2222-2222-222222222222"; // deliberately has NO profiles row

describe.skipIf(!TEST_DSN)("location-scoping predicate -- real Postgres (array-form ANY)", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    // Minimal schema -- only the columns reviewStatsWith / reviewAggWith actually read.
    await sql`CREATE TEMP TABLE jobs (
      id TEXT PRIMARY KEY, location TEXT, remote BOOLEAN, closed_at TIMESTAMPTZ
    )`;
    await sql`CREATE TEMP TABLE job_reviews (
      user_id UUID, job_id TEXT, stage1_decision TEXT, verdict TEXT,
      human_override BOOLEAN NOT NULL DEFAULT FALSE, error TEXT,
      PRIMARY KEY (user_id, job_id)
    )`;
    await sql`CREATE TEMP TABLE profiles (
      user_id UUID PRIMARY KEY, preferred_locations TEXT[] NOT NULL DEFAULT '{}'
    )`;

    // U1 has a profile scoped to Phoenix; U2 has none (the no-profile / only-remote case).
    await sql`INSERT INTO profiles (user_id, preferred_locations)
              VALUES (${U1}, ARRAY['Phoenix, AZ']::text[])`;

    // The trailing comment on each row is how the predicate should treat it for U1.
    await sql`INSERT INTO jobs (id, location, remote, closed_at) VALUES
      ('j-remote-sd',   'San Diego, CA', true,  NULL),    -- remote: always in pool
      ('j-remote-err',  'Remote',        true,  NULL),    -- remote: in pool (carries an error)
      ('j-remote-gate', 'Anywhere',      true,  NULL),    -- remote: in pool (gate-rejected)
      ('j-office-phx',  'Phoenix, AZ',   false, NULL),    -- in preferred: in U1 pool, NOT U2
      ('j-office-phx2', 'Phoenix, AZ',   false, NULL),    -- in preferred: in U1 pool, NOT U2
      ('j-office-sd',   'San Diego, CA', false, NULL),    -- out of location: excluded
      ('j-closed-phx',  'Phoenix, AZ',   false, now())    -- closed: excluded
    `;

    // U1's reviews (U2 has none). j-office-phx is intentionally left unreviewed.
    await sql`INSERT INTO job_reviews (user_id, job_id, stage1_decision, verdict, human_override, error) VALUES
      (${U1}, 'j-remote-sd',   'pass',   'approve', false, NULL),
      (${U1}, 'j-remote-err',  NULL,     NULL,      false, 'boom'),
      (${U1}, 'j-remote-gate', 'reject', NULL,      false, NULL),
      (${U1}, 'j-office-phx2', 'pass',   'deny',    true,  NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  // Covers lib/queries.ts. Pool = open jobs that are remote OR in preferred_locations:
  // j-remote-sd, j-remote-err, j-remote-gate, j-office-phx, j-office-phx2 (5). j-office-sd
  // is excluded (San Diego, not remote, not preferred); j-closed-phx is excluded (closed).
  // reviewed = the 4 with a job_reviews row; unreviewed = j-office-phx; errors = j-remote-err.
  it("reviewStatsWith runs (no 42883) and scopes to remote-or-preferred, open only", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U1));
    expect(stats).toEqual({ reviewed: 4, unreviewed: 1, errors: 1 });
  });

  // Covers lib/metrics.ts over the SAME pool (lockstep with reviewStatsWith).
  it("reviewAggWith runs (no 42883) and aggregates the same viewer pool", async () => {
    const agg = await sql.begin((tx) => reviewAggWith(tx, U1));
    expect(agg).toEqual({
      reviewed: 4, gate_rejected: 1, approved: 1, denied: 1, manual_rejected: 1,
    });
  });

  // The COALESCE('{}') branch: a viewer with no profiles row -> preferred = {} -> the pool
  // is only the 3 remote jobs (the two Phoenix office jobs drop out). This is exactly the
  // path the buggy subquery form also 42883'd on. U2 has no reviews, so all counts are 0
  // except unreviewed.
  it("no profile row -> only-remote pool, no error (COALESCE empty-array branch)", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U2));
    expect(stats).toEqual({ reviewed: 0, unreviewed: 3, errors: 0 });

    const agg = await sql.begin((tx) => reviewAggWith(tx, U2));
    expect(agg).toEqual({
      reviewed: 0, gate_rejected: 0, approved: 0, denied: 0, manual_rejected: 0,
    });
  });
});
