import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { saveBoardFiltersWith } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import type { BoardFilterState } from "@/lib/rolefit/filter";

// Real-Postgres proof that the board_filters WRITE stores a jsonb OBJECT, not a
// double-encoded jsonb STRING scalar (bug 2026-07-19). Gated on TEST_DATABASE_URL
// (unset -> skips). Session-local TEMP profiles shadows public.profiles; max: 1 pins
// the connection. Drives the executor impl directly (withUserSql opens its own
// connection that can't see these temp tables — same pattern as locationScoping.db).

const TEST_DSN = process.env.TEST_DATABASE_URL;
const U1 = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!TEST_DSN)("saveBoardFilters storage shape — real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });
    await sql`CREATE TEMP TABLE profiles (user_id uuid PRIMARY KEY, board_filters jsonb)`;
    await sql`INSERT INTO profiles (user_id, board_filters) VALUES (${U1}, NULL)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  // Pay values are $k within the parser's [PAY_FLOOR, PAY_CEIL] clamp window, non-default
  // so the round-trip proves persistence rather than default-fill.
  const state: BoardFilterState = {
    search: "react", cats: ["Engineering"], locs: ["Remote"], sources: ["greenhouse"],
    remote: "remote", minFit: 70, payMin: 100, payMax: 200, payIncludeUndisclosed: true,
    sort: "pay",
  };

  it("stores a jsonb OBJECT, not a double-encoded string scalar", async () => {
    await sql.begin((tx) => saveBoardFiltersWith(tx, U1, state));
    const [row] = await sql`
      SELECT jsonb_typeof(board_filters) AS typ, board_filters AS bf
      FROM profiles WHERE user_id = ${U1}::uuid`;
    // RED discriminator: the old ${JSON.stringify(filters)}::jsonb write yields 'string'.
    expect(row.typ).toBe("object");
    // Value integrity (order-independent — jsonb doesn't preserve key order).
    expect(parseBoardFilters(row.bf)).toEqual(state);
  });
});
