// catalogNow against real Postgres: the reader (authenticated, nil subject) can see
// lifecycle_control and jobs, and the frozen clock is max(jobs.last_seen_at). Runs
// only under `npm run test:db`; openTestDb recreates the schema, so flipping
// source_enabled here touches no other test file.
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openTestDb, seedJob, type TestDb } from "@/lib/testing/dbHarness";
import { ageDays, catalogNow, isNew } from "@/lib/catalogClock";
import { serviceSql } from "@/lib/db";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
  await seedJob(db.sql, "clock-old", { first_seen_at: "2026-10-01T00:00:00Z", last_seen_at: "2026-10-05T00:00:00Z" });
  await seedJob(db.sql, "clock-new", { first_seen_at: "2026-11-19T06:00:00Z", last_seen_at: "2026-11-20T06:00:00Z" });
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

test("discovery off (the schema default): frozen at the newest last_seen_at", async () => {
  const clock = await catalogNow();
  expect(clock).toEqual({ now: new Date("2026-11-20T06:00:00Z"), frozen: true });
  expect(ageDays("2026-11-19T06:00:00Z", clock)).toBe(1);
  expect(isNew("2026-11-19T06:00:00Z", clock)).toBe(true);
});

test("discovery on: the wall clock", async () => {
  await db.sql`UPDATE lifecycle_control
               SET source_enabled = true, activation_generation = activation_generation + 1
               WHERE singleton`;
  // A failed read also returns the wall clock; prove this came from a real read.
  const errors = vi.spyOn(console, "error");
  const before = Date.now();
  const clock = await catalogNow();
  expect(errors).not.toHaveBeenCalled();
  expect(clock.frozen).toBe(false);
  expect(clock.now.getTime()).toBeGreaterThanOrEqual(before);
});
