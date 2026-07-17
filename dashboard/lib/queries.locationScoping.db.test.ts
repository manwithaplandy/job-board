import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { distinctLocationsWith, reviewStatsWith } from "@/lib/queries";
import { reviewAggWith } from "@/lib/metrics";

// Real-Postgres guard for the location-scoping predicate (and heir to the
// b0a2689 42883 regression test): the profile subquery MUST stay in ARRAY form
// — COALESCE((SELECT ...), '{}'::text[]). Bare `= ANY((SELECT ...))` is what
// Postgres rejects at plan time (42883: text = text[]); bare `&&` is legal, but
// COALESCE to '{}' still matters — a 0-row subquery yields NULL so the row would
// drop only implicitly, whereas '{}' makes an empty pool definitively false.
//
// Contract under test (spec 2026-07-16-location-dedupe-design.md):
//   COALESCE(j.location_canonicals, ARRAY[j.location]) && prefs
//   OR ('Remote' = ANY(prefs) AND j.remote IS TRUE)
// Remote is OPT-IN: no 'Remote' in prefs -> remote-only jobs drop out.
//
// Gated on TEST_DATABASE_URL (unset -> suite skips). Session-local TEMP tables
// shadow public.*; max: 1 pins the connection they live on.

const TEST_DSN = process.env.TEST_DATABASE_URL;

const U1 = "11111111-1111-1111-1111-111111111111"; // {Phoenix, AZ; Remote} — migrated user
const U2 = "22222222-2222-2222-2222-222222222222"; // no profiles row
const U3 = "33333333-3333-3333-3333-333333333333"; // {Phoenix, AZ} — remote opted out

describe.skipIf(!TEST_DSN)("location-scoping predicate — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    await sql`CREATE TEMP TABLE jobs (
      id TEXT PRIMARY KEY, location TEXT, location_canonicals TEXT[],
      remote BOOLEAN, closed_at TIMESTAMPTZ
    )`;
    await sql`CREATE TEMP TABLE job_reviews (
      user_id UUID, job_id TEXT, stage1_decision TEXT, verdict TEXT,
      human_override BOOLEAN NOT NULL DEFAULT FALSE, error TEXT,
      PRIMARY KEY (user_id, job_id)
    )`;
    await sql`CREATE TEMP TABLE profiles (
      user_id UUID PRIMARY KEY, preferred_locations TEXT[] NOT NULL DEFAULT '{}'
    )`;

    await sql`INSERT INTO profiles (user_id, preferred_locations) VALUES
      (${U1}, ARRAY['Phoenix, AZ','Remote']::text[]),
      (${U3}, ARRAY['Phoenix, AZ']::text[])`;

    // Trailing comment = how the predicate should treat the row for U1 / U3.
    await sql`INSERT INTO jobs (id, location, location_canonicals, remote, closed_at) VALUES
      ('j-remote-sd',   'San Diego, CA',   ARRAY['San Diego, CA'],  true,  NULL),  -- U1 via Remote; U3 out
      ('j-remote-err',  'Remote',          ARRAY['Remote'],         true,  NULL),  -- U1 via Remote (error row); U3 out
      ('j-remote-gate', 'Anywhere',        NULL,                    true,  NULL),  -- unstamped remote: U1 via flag; U3 out
      ('j-office-phx',  'Phoenix, AZ',     ARRAY['Phoenix, AZ'],    false, NULL),  -- U1+U3 via canonicals
      ('j-office-phx2', 'Phoenix Arizona', ARRAY['Phoenix, AZ'],    false, NULL),  -- raw≠pref: only canonicals match
      ('j-unmapped-phx','Phoenix, AZ',     NULL,                    false, NULL),  -- COALESCE raw fallback
      ('j-office-sd',   'San Diego, CA',   ARRAY['San Diego, CA'],  false, NULL),  -- out of location
      ('j-closed-phx',  'Phoenix, AZ',     ARRAY['Phoenix, AZ'],    false, now())  -- closed
    `;

    await sql`INSERT INTO job_reviews (user_id, job_id, stage1_decision, verdict, human_override, error) VALUES
      (${U1}, 'j-remote-sd',   'pass',   'approve', false, NULL),
      (${U1}, 'j-remote-err',  NULL,     NULL,      false, 'boom'),
      (${U1}, 'j-remote-gate', 'reject', NULL,      false, NULL),
      (${U1}, 'j-office-phx2', 'pass',   'deny',    true,  NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  // U1 pool: remote-sd, remote-err, remote-gate (Remote opt-in) + office-phx,
  // office-phx2, unmapped-phx (canonicals / raw fallback) = 6.
  it("reviewStatsWith: canonical overlap + opted-in remote", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U1));
    expect(stats).toEqual({ reviewed: 4, unreviewed: 2, errors: 1 });
  });

  it("reviewAggWith aggregates the same viewer pool (lockstep)", async () => {
    const agg = await sql.begin((tx) => reviewAggWith(tx, U1));
    expect(agg).toEqual({
      reviewed: 4, gate_rejected: 1, approved: 1, denied: 1, manual_rejected: 1,
    });
  });

  // U3 never selected 'Remote': all three remote jobs drop out. Pool =
  // office-phx, office-phx2, unmapped-phx = 3, none reviewed.
  it("remote is opt-in: no 'Remote' pref -> remote jobs excluded", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U3));
    expect(stats).toEqual({ reviewed: 0, unreviewed: 3, errors: 0 });
  });

  // No profiles row -> prefs '{}' -> empty pool (remote no longer auto-included).
  // Also the COALESCE-empty-array 42883 guard path.
  it("no profile row -> empty pool, no plan-time error", async () => {
    const stats = await sql.begin((tx) => reviewStatsWith(tx, U2));
    expect(stats).toEqual({ reviewed: 0, unreviewed: 0, errors: 0 });
    const agg = await sql.begin((tx) => reviewAggWith(tx, U2));
    expect(agg).toEqual({
      reviewed: 0, gate_rejected: 0, approved: 0, denied: 0, manual_rejected: 0,
    });
  });

  // Facet list: unnest canonicals (raw fallback), Remote computed from the flag.
  // Open jobs -> Phoenix, AZ ×3 (phx, phx2, unmapped-phx), Remote ×3 (flag),
  // San Diego, CA ×2, Anywhere ×1 (unstamped raw). Ties break location ASC.
  it("distinctLocationsWith unnests canonicals and computes the Remote row", async () => {
    const rows = await sql.begin((tx) => distinctLocationsWith(tx));
    expect(rows).toEqual([
      { location: "Phoenix, AZ", count: 3 },
      { location: "Remote", count: 3 },
      { location: "San Diego, CA", count: 2 },
      { location: "Anywhere", count: 1 },
    ]);
  });
});
