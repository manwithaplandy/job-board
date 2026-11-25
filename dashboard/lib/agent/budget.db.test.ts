// getAgentSpend against real Postgres: the UTC day and month windows, the kind filter
// and RLS (it runs as the user, so another user's rows are invisible). Runs only under
// `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { getAgentSpend } from "@/lib/agent/budget";
import { USAGE_KIND_AGENT } from "@/lib/agent/config";
import { serviceSql } from "@/lib/db";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

beforeEach(async () => {
  await db.sql`TRUNCATE usage_counters`;
});

const TODAY = "(now() AT TIME ZONE 'utc')::date";
const MONTH_START = "date_trunc('month', (now() AT TIME ZONE 'utc'))::date";

async function charge(userId: string, dayExpr: string, kind: string, n: number) {
  await db.sql.unsafe(
    `INSERT INTO usage_counters (user_id, day, kind, n) VALUES ($1::uuid, ${dayExpr}, $2, $3)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET n = usage_counters.n + EXCLUDED.n`,
    [userId, kind, n],
  );
}

test("sums today and this UTC month, for this user and kind only", async () => {
  await charge(USER_A, TODAY, USAGE_KIND_AGENT, 300);
  await charge(USER_A, MONTH_START, USAGE_KIND_AGENT, 50); // same row as today on the 1st
  await charge(USER_A, `${MONTH_START} - 1`, USAGE_KIND_AGENT, 7_000); // last month
  await charge(USER_A, TODAY, "resume", 1); // another kind
  await charge(USER_B, TODAY, USAGE_KIND_AGENT, 900); // another user

  const [{ first }] = await db.sql.unsafe(`SELECT ${TODAY} = ${MONTH_START} AS first`);
  const spend = await getAgentSpend(USER_A);
  expect(spend).toEqual({ dayMicros: first ? 350 : 300, monthMicros: 350 });
});

test("no rows reads as zero spend", async () => {
  expect(await getAgentSpend(USER_A)).toEqual({ dayMicros: 0, monthMicros: 0 });
});
